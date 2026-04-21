/**
 * Build PA precinct_targeting_scores.json from election GeoJSON files
 *
 * Usage: npx ts-node scripts/build-pa-targeting-scores.ts
 *
 * Reads:
 *   - public/data/political/pensylvania/precincts/pa_2020_presidential.geojson
 *   - public/data/political/pensylvania/precincts/pa_2022_precinct.geojson
 *   - public/data/political/pensylvania/precincts/pa_2024_precincts_with_votes.geojson
 *       (optional override: pa_2024_precincts_with_votes_full.geojson if present — use when the default
 *        file has null dem_votes/rep_votes for most precincts)
 *   - optional fills for sparse 2024: pa_2024_precinct_votes_supplement.json, pa_2024_precinct_votes.csv
 *   - public/data/political/pensylvania/demographics/pa_total_population_2025.geojson (block groups, optional)
 *
 * Outputs:
 *   - public/data/political/pensylvania/precincts/precinct_targeting_scores.json
 *
 * Each precinct includes:
 *   - political_scores.partisan_lean / swing_potential (for UnifiedPrecinct merge)
 *   - swing_potential (0–100): volatility of D–R margin across 2020/22/24 when available
 *   - total_population: block-group 2025 population where precinct centroid falls (approximate)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

const DATA_DIR = path.join(process.cwd(), 'public/data/political/pensylvania');
const PRECINCT_DIR = path.join(DATA_DIR, 'precincts');
const DEMO_DIR = path.join(DATA_DIR, 'demographics');
const OUTPUT_FILE = path.join(PRECINCT_DIR, 'precinct_targeting_scores.json');
const ELECTION_HISTORY_FILE = path.join(PRECINCT_DIR, 'pa_precinct_election_history.json');
const POP_BG_FILE = path.join(DEMO_DIR, 'pa_total_population_2025.geojson');

const PA_ELECTION_DATES = {
  '2020': { date: '2020-11-03', type: 'general' as const },
  '2022': { date: '2022-11-08', type: 'midterm' as const },
  '2024': { date: '2024-11-05', type: 'general' as const },
};

/** Per-precinct shape expected by PoliticalDataService + political-pdf aggregateElectionHistory */
function buildPrecinctElectionPayload(
  registered: number | undefined,
  demVotes: number,
  repVotes: number,
  electionType: 'general' | 'midterm',
): {
  type: string;
  registered_voters: number;
  ballots_cast: number;
  turnout: number;
  races: Record<string, Record<string, unknown>>;
} {
  const totalVotes = demVotes + repVotes;
  const ballotsCast = totalVotes;
  let reg =
    registered && registered > 0 ? registered : totalVotes > 0 ? totalVotes : 0;
  if (reg > 0 && ballotsCast > reg) {
    reg = ballotsCast;
  }
  const turnout = reg > 0 ? (ballotsCast / reg) * 100 : 0;
  return {
    type: electionType,
    registered_voters: reg,
    ballots_cast: ballotsCast,
    turnout,
    races: {
      President: {
        office: 'President',
        district: 'Pennsylvania',
        candidates: [] as unknown[],
        total_votes: totalVotes,
        dem_votes: demVotes,
        rep_votes: repVotes,
        other_votes: 0,
        winner: demVotes >= repVotes ? 'Democratic' : 'Republican',
        winner_party: demVotes >= repVotes ? 'DEM' : 'REP',
      },
    },
  };
}

interface ElectionRecord {
  key: string;
  name: string;
  countyFp: string;
  vtdst: string;
  demVotes: number;
  repVotes: number;
  totalVotes: number;
  demPct: number;
  repPct: number;
  margin: number;
  registeredVoters?: number;
  turnout?: number;
}

function normalizeKey(countyFp: string, vtdst: string): string {
  return `${String(countyFp).padStart(3, '0')}_${String(vtdst).padStart(6, '0')}`;
}

function loadPa2020FromGeoJSON(
  gj: FeatureCollection,
): Map<string, ElectionRecord> {
  const map = new Map<string, ElectionRecord>();

  for (const f of gj.features || []) {
    const p = f.properties || {};
    const countyFp = String(p.COUNTYFP || '').padStart(3, '0');
    const vtdst = String(p.VTDST || '').padStart(6, '0');
    const uniqueId = String(p.UNIQUE_ID || `${countyFp}-${vtdst}`);

    const dem = Number(p.G20PREDBID) || 0;
    const rep = Number(p.G20PRERTRU) || 0;
    const regDem = Number(p.G20AUDDAHM) || 0;
    const regRep = Number(p.G20AUDRDEF) || 0;
    const total = dem + rep;
    const registered = regDem + regRep;

    const demPct = total > 0 ? (dem / total) * 100 : 50;
    const repPct = total > 0 ? (rep / total) * 100 : 50;
    const margin = demPct - repPct;
    const turnout = registered > 0 ? (total / registered) * 100 : null;

    const record: ElectionRecord = {
      key: uniqueId,
      name: String(p.NAME || uniqueId),
      countyFp,
      vtdst,
      demVotes: dem,
      repVotes: rep,
      totalVotes: total,
      demPct,
      repPct,
      margin,
      registeredVoters: registered > 0 ? registered : undefined,
      turnout: turnout ?? undefined,
    };
    map.set(uniqueId, record);
  }
  return map;
}

function marginStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Assign each precinct the TOTPOP_CY of the block group polygon that contains its centroid.
 */
function estimatePopulationByPrecinct(
  precinctFeatures: Feature[],
  popGeojsonPath: string,
): Map<string, number> {
  const result = new Map<string, number>();
  if (!fs.existsSync(popGeojsonPath)) {
    console.warn(
      '[build-pa-targeting-scores] No block-group population file; total_population will be omitted.',
    );
    return result;
  }

  const popGj = JSON.parse(
    fs.readFileSync(popGeojsonPath, 'utf8'),
  ) as FeatureCollection;
  const byCounty = new Map<string, Feature[]>();

  for (const bg of popGj.features || []) {
    const id = String((bg.properties as Record<string, unknown>)?.ID ?? '');
    if (id.length < 5) continue;
    const county = id.slice(2, 5);
    if (!byCounty.has(county)) byCounty.set(county, []);
    byCounty.get(county)!.push(bg);
  }

  let hit = 0;
  let miss = 0;
  for (const f of precinctFeatures) {
    const p = (f.properties || {}) as Record<string, unknown>;
    const uid = String(p.UNIQUE_ID || '');
    const cfp = String(p.COUNTYFP || '').padStart(3, '0');
    if (!uid) continue;
    try {
      const cent = turf.centroid(f as Feature);
      const bgs = byCounty.get(cfp) || [];
      let pop = 0;
      for (const bg of bgs) {
        const g = bg.geometry;
        if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
        if (
          turf.booleanPointInPolygon(
            cent,
            { type: 'Feature', geometry: g, properties: {} } as Feature<
              Polygon | MultiPolygon
            >,
          )
        ) {
          pop = Number((bg.properties as Record<string, unknown>)?.TOTPOP_CY) || 0;
          break;
        }
      }
      if (pop > 0) {
        result.set(uid, Math.round(pop));
        hit++;
      } else {
        miss++;
      }
    } catch {
      miss++;
    }
  }

  console.log(
    `[build-pa-targeting-scores] Population (BG centroid join): ${hit} matched, ${miss} unmatched`,
  );
  return result;
}

function loadPa2022(): Map<string, { demVotes: number; repVotes: number }> {
  const file = path.join(PRECINCT_DIR, 'pa_2022_precinct.geojson');
  const gj = JSON.parse(fs.readFileSync(file, 'utf8')) as { features: Array<{ properties?: Record<string, unknown> }> };
  const map = new Map<string, { demVotes: number; repVotes: number }>();

  for (const f of gj.features || []) {
    const p = f.properties || {};
    const countyFp = String(p.COUNTYFP20 || p.COUNTYFP || '').padStart(3, '0');
    const vtdst = String(p.VTDST20 || p.VTDST || '').padStart(6, '0');
    const key = normalizeKey(countyFp, vtdst);
    const dem = Number(p.DEM_VOTES) || 0;
    const rep = Number(p.REP_VOTES) || 0;
    map.set(key, { demVotes: dem, repVotes: rep });
  }
  return map;
}

/** Parse vote counts from GeoJSON/CSV (handles strings, commas, null). */
function parseVoteField(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Prefer full 2024 layer when the default file has sparse vote columns. */
function resolve2024GeojsonPath(): string {
  const full = path.join(PRECINCT_DIR, 'pa_2024_precincts_with_votes_full.geojson');
  const def = path.join(PRECINCT_DIR, 'pa_2024_precincts_with_votes.geojson');
  if (fs.existsSync(full)) {
    console.log('[build-pa-targeting-scores] Using full 2024 GeoJSON (pa_2024_precincts_with_votes_full.geojson)');
    return full;
  }
  return def;
}

/** Supplement keys: 11-digit GEOID (e.g. 42037000010) or CCC_VVVVVV (e.g. 037_000010). */
function normalizeSupplementKey(key: string): string | null {
  const k = String(key).trim();
  if (/^\d{3}_\d{6}$/.test(k)) return k;
  const digits = k.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('42')) {
    return normalizeKey(digits.slice(2, 5), digits.slice(5, 11));
  }
  return null;
}

function fill2024IfEmpty(
  map: Map<string, { demVotes: number; repVotes: number }>,
  compKey: string,
  dem: number,
  rep: number,
): void {
  if (dem + rep <= 0) return;
  const existing = map.get(compKey);
  if (!existing || existing.demVotes + existing.repVotes === 0) {
    map.set(compKey, { demVotes: dem, repVotes: rep });
  }
}

function mergePa2024SupplementJson(
  map: Map<string, { demVotes: number; repVotes: number }>,
  filePath: string,
): number {
  if (!fs.existsSync(filePath)) return 0;
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
    string,
    { dem_votes?: number; rep_votes?: number; demVotes?: number; repVotes?: number }
  >;
  let merged = 0;
  for (const [key, row] of Object.entries(raw)) {
    const dem = row.dem_votes ?? row.demVotes ?? 0;
    const rep = row.rep_votes ?? row.repVotes ?? 0;
    const nk = normalizeSupplementKey(key);
    if (!nk) continue;
    const before = map.get(nk);
    const wasEmpty = !before || before.demVotes + before.repVotes === 0;
    fill2024IfEmpty(map, nk, dem, rep);
    if (wasEmpty && dem + rep > 0) merged++;
  }
  console.log(
    `[build-pa-targeting-scores] 2024 supplement JSON: ${merged} precincts filled from ${path.basename(filePath)}`,
  );
  return merged;
}

function mergePa2024SupplementCsv(
  map: Map<string, { demVotes: number; repVotes: number }>,
  filePath: string,
): number {
  if (!fs.existsSync(filePath)) return 0;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return 0;
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  let merged = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    let nk: string | null = null;
    let dem = 0;
    let rep = 0;

    const ig = col('geoid');
    const iDem = col('dem_votes');
    const iRep = col('rep_votes');
    if (ig >= 0 && iDem >= 0 && iRep >= 0) {
      nk = normalizeSupplementKey(cols[ig]);
      dem = parseVoteField(cols[iDem]);
      rep = parseVoteField(cols[iRep]);
    } else if (col('countyfp') >= 0 && col('vtdst') >= 0 && iDem >= 0 && iRep >= 0) {
      nk = normalizeKey(cols[col('countyfp')], cols[col('vtdst')]);
      dem = parseVoteField(cols[iDem]);
      rep = parseVoteField(cols[iRep]);
    } else {
      continue;
    }
    if (!nk || dem + rep <= 0) continue;
    const before = map.get(nk);
    const wasEmpty = !before || before.demVotes + before.repVotes === 0;
    fill2024IfEmpty(map, nk, dem, rep);
    if (wasEmpty) merged++;
  }
  console.log(
    `[build-pa-targeting-scores] 2024 supplement CSV: ${merged} precincts filled from ${path.basename(filePath)}`,
  );
  return merged;
}

function loadPa2024(): Map<string, { demVotes: number; repVotes: number }> {
  const file = resolve2024GeojsonPath();
  const gj = JSON.parse(fs.readFileSync(file, 'utf8')) as { features: Array<{ properties?: Record<string, unknown> }> };
  const map = new Map<string, { demVotes: number; repVotes: number }>();

  for (const f of gj.features || []) {
    const p = f.properties || {};
    const countyFp = String(p.COUNTYFP20 || p.COUNTYFP || '').padStart(3, '0');
    const vtdst = String(p.VTDST20 || p.VTDST || '').padStart(6, '0');
    const key = normalizeKey(countyFp, vtdst);
    const dem = parseVoteField(p.dem_votes ?? p.DEM_VOTES);
    const rep = parseVoteField(p.rep_votes ?? p.REP_VOTES);
    map.set(key, { demVotes: dem, repVotes: rep });
  }

  mergePa2024SupplementJson(map, path.join(PRECINCT_DIR, 'pa_2024_precinct_votes_supplement.json'));
  mergePa2024SupplementCsv(map, path.join(PRECINCT_DIR, 'pa_2024_precinct_votes.csv'));

  let nonzero = 0;
  for (const v of map.values()) {
    if (v.demVotes + v.repVotes > 0) nonzero++;
  }
  console.log(
    `[build-pa-targeting-scores] 2024 map: ${map.size} precincts, ${nonzero} with non-zero D+R presidential votes (after GeoJSON + optional supplements)`,
  );

  return map;
}

function computeScores(record: ElectionRecord, data2022?: { demVotes: number; repVotes: number }, data2024?: { demVotes: number; repVotes: number }) {
  const margin = record.margin;
  const demPct = record.demPct;
  const turnout = record.turnout ?? 65;
  const absMargin = Math.abs(margin);

  const supportStrength = Math.min(100, Math.max(0, demPct));
  const turnoutOpportunity = Math.min(100, Math.max(0, 100 - turnout));
  const marginCloseness = Math.min(100, Math.max(0, 100 - absMargin));

  const margins: number[] = [record.margin];
  if (data2022 && data2022.demVotes + data2022.repVotes > 0) {
    const total = data2022.demVotes + data2022.repVotes;
    margins.push((data2022.demVotes / total) * 100 - (data2022.repVotes / total) * 100);
  }
  if (data2024 && data2024.demVotes + data2024.repVotes > 0) {
    const total = data2024.demVotes + data2024.repVotes;
    margins.push((data2024.demVotes / total) * 100 - (data2024.repVotes / total) * 100);
  }
  const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
  const avgMarginCount = margins.length;
  const effectiveMarginCloseness = avgMarginCount > 1 ? 100 - Math.abs(avgMargin / avgMarginCount) : marginCloseness;

  const voterPoolWeight = Math.min(100, (record.registeredVoters ?? record.totalVotes) / 50);

  const gotvPriority = Math.min(
    100,
    Math.max(
      0,
      (supportStrength * 0.4 + turnoutOpportunity * 0.4 + voterPoolWeight * 0.2) * (demPct > 45 ? 1.2 : 0.8)
    )
  );

  const persuasionOpportunity = Math.min(100, Math.max(0, effectiveMarginCloseness * 1.1));

  let gotvClassification: string;
  if (gotvPriority >= 70) gotvClassification = 'High Priority';
  else if (gotvPriority >= 55) gotvClassification = 'Medium-High';
  else if (gotvPriority >= 40) gotvClassification = 'Medium';
  else gotvClassification = 'Low Priority';

  let persuasionClassification: string;
  if (persuasionOpportunity >= 50) persuasionClassification = 'Moderate Opportunity';
  else persuasionClassification = 'Limited Opportunity';

  let targetingStrategy: string;
  if (absMargin < 12 && demPct > 40 && demPct < 60) {
    targetingStrategy = 'Battleground';
  } else if (margin > 25 && turnout < 72) {
    targetingStrategy = 'Base Mobilization';
  } else if (margin < -25) {
    targetingStrategy = 'Maintenance';
  } else if (absMargin >= 12 && absMargin < 30) {
    targetingStrategy = 'Persuasion Target';
  } else if (margin > 25) {
    targetingStrategy = 'Maintenance';
  } else {
    targetingStrategy = 'Persuasion Target';
  }

  const combinedScore = (gotvPriority + persuasionOpportunity) / 2;
  const targetingPriority = targetingStrategy === 'Battleground' ? 1 : targetingStrategy === 'Base Mobilization' ? 2 : targetingStrategy === 'Persuasion Target' ? 3 : 4;

  const recommendation =
    targetingStrategy === 'Battleground'
      ? 'High-priority competitive area: Persuasion and GOTV'
      : targetingStrategy === 'Base Mobilization'
        ? 'GOTV focus: Strong support with turnout opportunity'
        : targetingStrategy === 'Persuasion Target'
          ? 'Persuasion focus: Swing voters present'
          : 'Maintenance: Lower campaign priority';

  // Swing 0–100: multi-election margin volatility; single-year fallback from competitiveness.
  const volatility = marginStdDev(margins);
  const partisan_lean = Math.round((record.demPct - 50) * 2 * 10) / 10;
  let swing_potential: number;
  if (margins.length >= 2 && volatility >= 0.25) {
    swing_potential = Math.min(100, Math.round(volatility * 3.2 * 10) / 10);
  } else {
    swing_potential = Math.min(
      100,
      Math.round((100 - absMargin) * 0.62 * 10) / 10,
    );
  }

  return {
    gotv_priority: Math.round(gotvPriority * 10) / 10,
    gotv_components: {
      support_strength: Math.round(supportStrength * 10) / 10,
      turnout_opportunity: Math.round(turnoutOpportunity * 10) / 10,
      voter_pool_weight: Math.round(voterPoolWeight * 10) / 10,
    },
    gotv_classification: gotvClassification,
    persuasion_opportunity: Math.round(persuasionOpportunity * 10) / 10,
    persuasion_components: {
      margin_closeness: Math.round(effectiveMarginCloseness * 10) / 10,
      swing_factor: Math.round(effectiveMarginCloseness * 0.5 * 10) / 10,
      moderate_factor: 50,
      independent_factor: 50,
      low_engagement: Math.round(turnoutOpportunity * 10) / 10,
    },
    persuasion_classification: persuasionClassification,
    targeting_strategy: targetingStrategy,
    targeting_priority: targetingPriority,
    combined_score: Math.round(combinedScore * 10) / 10,
    recommendation,
    swing_potential,
    political_scores: {
      partisan_lean,
      swing_potential,
    },
  };
}

function main() {
  console.log('[build-pa-targeting-scores] Loading PA election data...');
  const file2020 = path.join(PRECINCT_DIR, 'pa_2020_presidential.geojson');
  const gj2020 = JSON.parse(
    fs.readFileSync(file2020, 'utf8'),
  ) as FeatureCollection;
  const data2020 = loadPa2020FromGeoJSON(gj2020);
  const popByPrecinct = estimatePopulationByPrecinct(
    gj2020.features || [],
    POP_BG_FILE,
  );
  const data2022 = loadPa2022();
  const data2024 = loadPa2024();

  console.log(`[build-pa-targeting-scores] 2020: ${data2020.size}, 2022: ${data2022.size}, 2024: ${data2024.size}`);

  const precincts: Record<string, any> = {};
  const strategyCounts: Record<string, number> = {};
  const gotvCounts: Record<string, number> = {};
  const persuasionCounts: Record<string, number> = {};
  const gotvValues: number[] = [];
  const persuasionValues: number[] = [];
  const combinedValues: number[] = [];

  for (const [uniqueId, record] of data2020) {
    const compKey = normalizeKey(record.countyFp, record.vtdst);
    const d22 = data2022.get(compKey);
    const d24 = data2024.get(compKey);
    const scores = computeScores(record, d22, d24);
    const pop = popByPrecinct.get(uniqueId);

    precincts[uniqueId] = {
      precinct_id: uniqueId,
      precinct_name: record.name,
      short_name: record.name,
      jurisdiction: record.countyFp,
      registered_voters: record.registeredVoters,
      ...(pop && pop > 0 ? { total_population: pop } : {}),
      ...scores,
    };

    strategyCounts[scores.targeting_strategy] = (strategyCounts[scores.targeting_strategy] || 0) + 1;
    gotvCounts[scores.gotv_classification] = (gotvCounts[scores.gotv_classification] || 0) + 1;
    persuasionCounts[scores.persuasion_classification] = (persuasionCounts[scores.persuasion_classification] || 0) + 1;
    gotvValues.push(scores.gotv_priority);
    persuasionValues.push(scores.persuasion_opportunity);
    combinedValues.push(scores.combined_score);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr: number[]) => {
    const m = avg(arr);
    return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
  };

  const output = {
    metadata: {
      generated: new Date().toISOString(),
      source:
        'pa_2020_presidential, pa_2022_precinct, pa_2024_precincts_with_votes, pa_total_population_2025 (BG centroid)',
      precinct_count: Object.keys(precincts).length,
      scores_calculated: [
        'gotv_priority',
        'persuasion_opportunity',
        'combined_score',
        'targeting_strategy',
        'swing_potential',
        'political_scores',
        'total_population',
      ],
      population_note:
        'total_population is TOTPOP_CY of the block group containing the precinct centroid (approximate).',
      swing_note:
        'swing_potential uses standard deviation of D-R margin across 2020/22/24 when multiple years exist; otherwise a competitiveness-based estimate.',
    },
    summary: {
      strategy_distribution: strategyCounts,
      gotv_distribution: gotvCounts,
      persuasion_distribution: persuasionCounts,
      score_stats: {
        gotv: {
          mean: Math.round(avg(gotvValues) * 10) / 10,
          median: Math.round(gotvValues.sort((a, b) => a - b)[Math.floor(gotvValues.length / 2)] * 10) / 10,
          std: Math.round(std(gotvValues) * 10) / 10,
          min: Math.min(...gotvValues),
          max: Math.max(...gotvValues),
        },
        persuasion: {
          mean: Math.round(avg(persuasionValues) * 10) / 10,
          median: Math.round(persuasionValues.sort((a, b) => a - b)[Math.floor(persuasionValues.length / 2)] * 10) / 10,
          std: Math.round(std(persuasionValues) * 10) / 10,
          min: Math.min(...persuasionValues),
          max: Math.max(...persuasionValues),
        },
        combined: {
          mean: Math.round(avg(combinedValues) * 10) / 10,
          median: Math.round(combinedValues.sort((a, b) => a - b)[Math.floor(combinedValues.length / 2)] * 10) / 10,
          std: Math.round(std(combinedValues) * 10) / 10,
          min: Math.min(...combinedValues),
          max: Math.max(...combinedValues),
        },
      },
    },
    precincts,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[build-pa-targeting-scores] Wrote ${OUTPUT_FILE}`);
  console.log(`[build-pa-targeting-scores] Strategy distribution:`, strategyCounts);

  // PDF / API: precinct-keyed election history (same keys as targeting)
  const electionPrecincts: Record<string, { elections: Record<string, ReturnType<typeof buildPrecinctElectionPayload>> }> =
    {};
  for (const [uniqueId, record] of data2020) {
    const compKey = normalizeKey(record.countyFp, record.vtdst);
    const d22 = data2022.get(compKey);
    const d24 = data2024.get(compKey);
    const reg =
      record.registeredVoters && record.registeredVoters > 0
        ? record.registeredVoters
        : undefined;
    const elections: Record<string, ReturnType<typeof buildPrecinctElectionPayload>> = {};

    if (record.demVotes + record.repVotes > 0) {
      elections[PA_ELECTION_DATES['2020'].date] = buildPrecinctElectionPayload(
        reg,
        record.demVotes,
        record.repVotes,
        PA_ELECTION_DATES['2020'].type,
      );
    }
    if (d22 && d22.demVotes + d22.repVotes > 0) {
      elections[PA_ELECTION_DATES['2022'].date] = buildPrecinctElectionPayload(
        reg,
        d22.demVotes,
        d22.repVotes,
        PA_ELECTION_DATES['2022'].type,
      );
    }
    if (d24 && d24.demVotes + d24.repVotes > 0) {
      elections[PA_ELECTION_DATES['2024'].date] = buildPrecinctElectionPayload(
        reg,
        d24.demVotes,
        d24.repVotes,
        PA_ELECTION_DATES['2024'].type,
      );
    }
    if (Object.keys(elections).length > 0) {
      electionPrecincts[uniqueId] = { elections };
    }
  }

  const electionOutput = {
    metadata: {
      generated: new Date().toISOString(),
      state: 'Pennsylvania',
      source_files: [
        'pa_2020_presidential.geojson',
        'pa_2022_precinct.geojson',
        'pa_2024_precincts_with_votes.geojson',
      ],
      elections: [
        { year: 2020, type: 'general', date: PA_ELECTION_DATES['2020'].date },
        { year: 2022, type: 'midterm', date: PA_ELECTION_DATES['2022'].date },
        { year: 2024, type: 'general', date: PA_ELECTION_DATES['2024'].date },
      ],
      precinct_count: Object.keys(electionPrecincts).length,
      note:
        'registered_voters for 2022/2024 use 2020 presidential registration when available; turnout is ballots/registered. If pa_2024_precincts_with_votes.geojson has null dem_votes/rep_votes for most precincts, add pa_2024_precinct_votes_supplement.json (GEOID or CCC_VVVVVV keys) or pa_2024_precinct_votes.csv (geoid,dem_votes,rep_votes), or replace with pa_2024_precincts_with_votes_full.geojson.',
    },
    precincts: electionPrecincts,
  };
  fs.writeFileSync(ELECTION_HISTORY_FILE, JSON.stringify(electionOutput, null, 2), 'utf8');
  console.log(`[build-pa-targeting-scores] Wrote ${ELECTION_HISTORY_FILE} (${Object.keys(electionPrecincts).length} precincts)`);
}

main();
