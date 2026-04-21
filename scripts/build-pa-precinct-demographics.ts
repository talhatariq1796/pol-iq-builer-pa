/**
 * Build pa_precinct_demographics.json — block-group demographics joined to PA precincts
 * (centroid in WGS84; 2025 ACS-style layers in EPSG:3857 use Mercator point-in-polygon).
 *
 * Usage: npx ts-node scripts/build-pa-precinct-demographics.ts
 *
 * Output: public/data/political/pensylvania/precincts/pa_precinct_demographics.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Point } from 'geojson';

const DATA_DIR = path.join(process.cwd(), 'public/data/political/pensylvania');
const PRECINCT_DIR = path.join(DATA_DIR, 'precincts');
const DEMO_DIR = path.join(DATA_DIR, 'demographics');
const PA_DEMO_2025 = path.join(
  DEMO_DIR,
  'PA_Demographics_2025/PA_Demographics_2025',
);

const OUT_FILE = path.join(PRECINCT_DIR, 'pa_precinct_demographics.json');
const PRECINCT_GEO = path.join(PRECINCT_DIR, 'pa_2020_presidential.geojson');
const MEDIAN_AGE_GEO = path.join(DEMO_DIR, 'pa_median_age.geojson');
const TARGETING_SCORES = path.join(PRECINCT_DIR, 'precinct_targeting_scores.json');

const SQ_M_PER_SQ_MI = 2589988.110336;

interface BgAttrs {
  median_household_income?: number;
  educ_base?: number;
  hs?: number;
  some_col?: number;
  bach?: number;
  grad?: number;
  med_home_value?: number;
}

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

/** Index block-group features by county FIPS (digits 2–4 of 11-char GEOID). */
function indexByCounty(
  gj: FeatureCollection,
): Map<string, Feature<Polygon | MultiPolygon>[]> {
  const m = new Map<string, Feature<Polygon | MultiPolygon>[]>();
  for (const f of gj.features || []) {
    const id = String((f.properties as Record<string, unknown>)?.ID ?? '');
    if (id.length < 5) continue;
    const county = id.slice(2, 5);
    if (!m.has(county)) m.set(county, []);
    m.get(county)!.push(f as Feature<Polygon | MultiPolygon>);
  }
  return m;
}

function mergeBgMaps(
  pathToFile: string,
  pick: (props: Record<string, unknown>) => Partial<BgAttrs>,
): Map<string, BgAttrs> {
  const gj = loadJson<FeatureCollection>(pathToFile);
  const out = new Map<string, BgAttrs>();
  for (const f of gj.features || []) {
    const props = (f.properties || {}) as Record<string, unknown>;
    const id = String(props.ID ?? '');
    if (!id) continue;
    const cur = out.get(id) || {};
    out.set(id, { ...cur, ...pick(props) });
  }
  return out;
}

function pipWgs84(
  pt: Feature<Point>,
  byCounty: Map<string, Feature<Polygon | MultiPolygon>[]>,
  countyFp: string,
): Feature<Polygon | MultiPolygon> | null {
  const bgs = byCounty.get(countyFp) || [];
  for (const bg of bgs) {
    const g = bg.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
    if (
      turf.booleanPointInPolygon(
        pt,
        { type: 'Feature', geometry: g, properties: {} } as Feature<Polygon | MultiPolygon>,
      )
    ) {
      return bg;
    }
  }
  return null;
}

function pipMercator(
  ptMerc: Feature<Point>,
  byCounty: Map<string, Feature<Polygon | MultiPolygon>[]>,
  countyFp: string,
): Feature<Polygon | MultiPolygon> | null {
  return pipWgs84(ptMerc, byCounty, countyFp);
}

function educationEntropy(a: BgAttrs): number {
  const base = a.educ_base || 0;
  if (base <= 0) return 50;
  const hs = Math.max(0, a.hs || 0);
  const sm = Math.max(0, a.some_col || 0);
  const ba = Math.max(0, a.bach || 0);
  const gr = Math.max(0, a.grad || 0);
  const parts = [hs / base, sm / base, ba / base, gr / base].filter((p) => p > 1e-9);
  if (parts.length === 0) return 50;
  const h = -parts.reduce((s, p) => s + p * Math.log(p), 0);
  const hMax = Math.log(4);
  return Math.round(Math.min(100, Math.max(0, (h / hMax) * 100)) * 10) / 10;
}

function collegePct(a: BgAttrs): number {
  const base = a.educ_base || 0;
  if (base <= 0) return 0;
  const ba = Math.max(0, a.bach || 0);
  const gr = Math.max(0, a.grad || 0);
  return Math.round(((ba + gr) / base) * 1000) / 10;
}

function ownerPctFromHomeValue(medVal: number | undefined): number {
  if (medVal == null || medVal <= 0 || !Number.isFinite(medVal)) return 62;
  const v = Math.min(1.2, Math.max(0, medVal / 450000));
  return Math.round(Math.min(92, Math.max(28, 32 + v * 48)) * 10) / 10;
}

function main() {
  console.log('[build-pa-precinct-demographics] Loading inputs...');
  const precinctGj = loadJson<FeatureCollection>(PRECINCT_GEO);
  const medianAgeGj = loadJson<FeatureCollection>(MEDIAN_AGE_GEO);
  const targeting = fs.existsSync(TARGETING_SCORES)
    ? (loadJson<{ precincts?: Record<string, { total_population?: number }> }>(TARGETING_SCORES)
        .precincts || {})
    : {};

  const ageByCounty = indexByCounty(medianAgeGj);

  const bgMerged = new Map<string, BgAttrs>();
  const mergeFile = (p: string, pick: (props: Record<string, unknown>) => Partial<BgAttrs>) => {
    const m = mergeBgMaps(p, pick);
    for (const [id, attrs] of m) {
      const cur = bgMerged.get(id) || {};
      bgMerged.set(id, { ...cur, ...attrs });
    }
  };

  mergeFile(path.join(PA_DEMO_2025, '2025 Educational Attainment Base.geojson'), (props) => ({
    educ_base: Number(props.EDUCBASECY) || 0,
  }));
  mergeFile(path.join(PA_DEMO_2025, '2025 Pop Age 25+ High School Diploma.geojson'), (props) => ({
    hs: Number(props.HSGRAD_CY) || 0,
  }));
  mergeFile(path.join(PA_DEMO_2025, '2025 Pop Age 25+ Some College No Degree.geojson'), (props) => ({
    some_col: Number(props.SMCOLL_CY) || 0,
  }));
  mergeFile(path.join(PA_DEMO_2025, '2025 Pop Age 25+ Bachelor\'s Degree.geojson'), (props) => ({
    bach: Number(props.BACHDEG_CY) || 0,
  }));
  mergeFile(path.join(PA_DEMO_2025, '2025 Pop Age 25+ Grad Professional Degree.geojson'), (props) => ({
    grad: Number(props.GRADDEG_CY) || 0,
  }));
  mergeFile(path.join(PA_DEMO_2025, '2025MedianHouseholdIncome.geojson'), (props) => ({
    median_household_income: Number(props.MEDHINC_CY) || 0,
  }));
  mergeFile(path.join(PA_DEMO_2025, '2025MedianHomeValue.geojson'), (props) => ({
    med_home_value: Number(props.MEDVAL_CY) || 0,
  }));

  const mercByCounty = indexByCounty(
    loadJson<FeatureCollection>(
      path.join(PA_DEMO_2025, '2025 Educational Attainment Base.geojson'),
    ),
  );

  const precincts: Record<string, Record<string, number>> = {};
  let hit = 0;
  let miss = 0;

  for (const f of precinctGj.features || []) {
    const p = (f.properties || {}) as Record<string, unknown>;
    const uid = String(p.UNIQUE_ID || '');
    const cfp = String(p.COUNTYFP || '').padStart(3, '0');
    if (!uid) continue;

    try {
      const cent = turf.centroid(f as Feature);
      const areaSqM = turf.area(f as Feature);
      const areaSqMi = areaSqM / SQ_M_PER_SQ_MI;

      const bgAge = pipWgs84(cent as Feature<Point>, ageByCounty, cfp);
      const medAge = bgAge
        ? Number((bgAge.properties as Record<string, unknown>).MEDAGE_CY) || 0
        : 0;

      const ptM = turf.toMercator(cent.geometry);
      const bgMerc = pipMercator(
        { type: 'Feature', geometry: ptM as Point, properties: {} } as Feature<Point>,
        mercByCounty,
        cfp,
      );
      let attrs: BgAttrs | undefined;
      if (bgMerc) {
        const bid = String((bgMerc.properties as Record<string, unknown>).ID ?? '');
        attrs = bgMerged.get(bid);
      }

      const popFromTargeting = targeting[uid]?.total_population;
      const pop =
        popFromTargeting != null && popFromTargeting > 0
          ? popFromTargeting
          : Number(p.TOTPOP_CY) || 0;
      const density =
        areaSqMi > 0 && pop > 0 ? Math.round((pop / areaSqMi) * 10) / 10 : 0;

      const div = attrs ? educationEntropy(attrs) : 50;
      const coll = attrs ? collegePct(attrs) : 0;
      const hhi = attrs?.median_household_income || 0;
      const mhv = attrs?.med_home_value;
      const owner = ownerPctFromHomeValue(mhv);

      precincts[uid] = {
        median_age: Math.round(medAge * 10) / 10,
        median_household_income: Math.round(hhi),
        college_pct: coll,
        diversity_index: div,
        population_density: density,
        owner_pct: owner,
      };
      if (attrs && medAge > 0 && hhi > 0) hit++;
      else miss++;
    } catch {
      miss++;
    }
  }

  const out = {
    metadata: {
      generated: new Date().toISOString(),
      source:
        'pa_2020_presidential, pa_median_age, PA_Demographics_2025 (block groups, EPSG:3857 layers via Mercator PIP)',
      precinct_count: Object.keys(precincts).length,
      notes: [
        'diversity_index is normalized Shannon entropy of HS / some college / bachelor / grad shares (0–100).',
        'owner_pct is a proxy from median home value (no ACS owner field in bundle).',
        'population_density uses TOTPOP_CY from precinct feature when present, else 0; area from polygon.',
      ],
    },
    precincts,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  console.log(
    `[build-pa-precinct-demographics] Wrote ${Object.keys(precincts).length} precincts to ${OUT_FILE} (rough match quality: ${hit} with full BG attrs, ${miss} partial)`,
  );
}

main();
