/**
 * Build PA H3 resolution-7 aggregates + GeoJSON for H3HeatmapLayer / PoliticalDataService.
 *
 * Usage: npm run build:pa-h3
 *
 * Reads:
 *   - public/data/political/pensylvania/precincts/pa_2020_presidential.geojson
 *   - public/data/political/pensylvania/precincts/precinct_targeting_scores.json
 *
 * Writes:
 *   - public/data/political/pensylvania/precincts/pa_h3_aggregates.json
 *   - public/data/political/pensylvania/precincts/pa_h3_aggregates.geojson
 */

import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import { latLngToCell, cellToBoundary, cellToLatLng } from 'h3-js';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

const H3_RES = 7;
const H3_CELL_AREA_KM2 = 5.16;

const DATA_DIR = path.join(process.cwd(), 'public/data/political/pensylvania');
const PRECINCT_DIR = path.join(DATA_DIR, 'precincts');
const PRECINCT_GEO = path.join(PRECINCT_DIR, 'pa_2020_presidential.geojson');
const SCORES_JSON = path.join(PRECINCT_DIR, 'precinct_targeting_scores.json');
const OUT_JSON = path.join(PRECINCT_DIR, 'pa_h3_aggregates.json');
const OUT_GEOJSON = path.join(PRECINCT_DIR, 'pa_h3_aggregates.geojson');

type PrecinctRow = {
  precinct_id?: string;
  precinct_name?: string;
  total_population?: number;
  gotv_priority?: number;
  persuasion_opportunity?: number;
  combined_score?: number;
  swing_potential?: number;
  political_scores?: { partisan_lean?: number; swing_potential?: number };
};

type Bucket = {
  weights: number[];
  partisan: number[];
  swing: number[];
  gotv: number[];
  persuasion: number[];
  combined: number[];
  names: string[];
};

function weightedMean(values: number[], weights: number[]): number | null {
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || Number.isNaN(v)) continue;
    const w = weights[i] > 0 && !Number.isNaN(weights[i]) ? weights[i] : 1;
    sum += v * w;
    wsum += w;
  }
  if (wsum === 0) return null;
  return sum / wsum;
}

function aggregateMetrics(b: Bucket) {
  const w = b.weights;
  const pick = (vals: number[]) => {
    const vv: number[] = [];
    const ww: number[] = [];
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v == null || Number.isNaN(v)) continue;
      vv.push(v);
      ww.push(w[i] > 0 && !Number.isNaN(w[i]) ? w[i] : 1);
    }
    return weightedMean(vv, ww);
  };

  return {
    partisan_lean: pick(b.partisan),
    swing_potential: pick(b.swing),
    gotv_priority: pick(b.gotv),
    persuasion_opportunity: pick(b.persuasion),
    combined_score: pick(b.combined),
    total_population: w.reduce((a, x) => a + (x > 0 && !Number.isNaN(x) ? x : 0), 0),
  };
}

function main() {
  const fc = JSON.parse(fs.readFileSync(PRECINCT_GEO, 'utf-8')) as FeatureCollection;
  const scoresData = JSON.parse(fs.readFileSync(SCORES_JSON, 'utf-8')) as {
    precincts: Record<string, PrecinctRow>;
  };
  const scores = scoresData.precincts;

  const buckets = new Map<string, Bucket>();

  let skippedNoScore = 0;
  let skippedNoGeom = 0;

  for (const f of fc.features) {
    const id = String((f.properties as Record<string, unknown>)?.UNIQUE_ID ?? '');
    if (!id) continue;
    const row = scores[id];
    if (!row) {
      skippedNoScore++;
      continue;
    }
    if (!f.geometry) {
      skippedNoGeom++;
      continue;
    }

    const feat = f as Feature<Polygon | MultiPolygon>;
    const c = turf.centroid(feat);
    const [lng, lat] = c.geometry.coordinates;
    const h3 = latLngToCell(lat, lng, H3_RES);

    const pop =
      typeof row.total_population === 'number' && row.total_population > 0
        ? row.total_population
        : 1;

    const pl = row.political_scores?.partisan_lean;
    const sp = row.swing_potential ?? row.political_scores?.swing_potential;
    const gotv = row.gotv_priority;
    const pers = row.persuasion_opportunity;
    const comb = row.combined_score;

    let b = buckets.get(h3);
    if (!b) {
      b = {
        weights: [],
        partisan: [],
        swing: [],
        gotv: [],
        persuasion: [],
        combined: [],
        names: [],
      };
      buckets.set(h3, b);
    }

    b.weights.push(pop);
    b.partisan.push(pl != null && !Number.isNaN(pl) ? pl : NaN);
    b.swing.push(sp != null && !Number.isNaN(sp) ? sp : NaN);
    b.gotv.push(gotv != null && !Number.isNaN(gotv) ? gotv : NaN);
    b.persuasion.push(pers != null && !Number.isNaN(pers) ? pers : NaN);
    b.combined.push(comb != null && !Number.isNaN(comb) ? comb : NaN);
    b.names.push(String(row.precinct_name || row.precinct_id || id));
  }

  const cellCount = buckets.size;
  console.log(
    `H3 buckets: ${cellCount}, skipped (no targeting row): ${skippedNoScore}, skipped (no geometry): ${skippedNoGeom}`,
  );

  const cells: Record<string, Record<string, unknown>> = {};
  const features: Feature[] = [];

  const metricsList = [
    'partisan_lean',
    'swing_potential',
    'gotv_priority',
    'persuasion_opportunity',
    'combined_score',
    'total_population',
    'dem_affiliation_pct',
    'rep_affiliation_pct',
  ];

  for (const [h3Index, b] of buckets) {
    const agg = aggregateMetrics(b);
    const uniqueNames = [...new Set(b.names)];
    const [latC, lngC] = cellToLatLng(h3Index);
    const center: [number, number] = [lngC, latC];

    const cellJson = {
      h3_index: h3Index,
      resolution: H3_RES,
      precinct_count: b.names.length,
      precincts: uniqueNames,
      center,
      partisan_lean: agg.partisan_lean,
      swing_potential: agg.swing_potential,
      gotv_priority: agg.gotv_priority,
      persuasion_opportunity: agg.persuasion_opportunity,
      combined_score: agg.combined_score,
      total_population: agg.total_population > 0 ? agg.total_population : null,
      dem_affiliation_pct: null,
      rep_affiliation_pct: null,
    };
    cells[h3Index] = cellJson;

    const ring = cellToBoundary(h3Index, true) as [number, number][];
    const props = {
      h3_index: h3Index,
      resolution: H3_RES,
      precinct_count: cellJson.precinct_count,
      partisan_lean: cellJson.partisan_lean,
      swing_potential: cellJson.swing_potential,
      gotv_priority: cellJson.gotv_priority,
      persuasion_opportunity: cellJson.persuasion_opportunity,
      combined_score: cellJson.combined_score,
      total_population: cellJson.total_population,
      dem_affiliation_pct: null,
      rep_affiliation_pct: null,
    };

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
      properties: props,
    });
  }

  const outAgg = {
    metadata: {
      generated: new Date().toISOString(),
      h3_resolution: H3_RES,
      h3_cell_area_km2: H3_CELL_AREA_KM2,
      cell_count: cellCount,
      source_precincts: Object.keys(scores).length,
      metrics: metricsList,
      note: 'PA statewide; metrics are population-weighted means of precinct targeting scores per H3 cell.',
    },
    cells,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(outAgg, null, 2), 'utf-8');
  console.log(`Wrote ${OUT_JSON}`);

  const outFc: FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };
  fs.writeFileSync(OUT_GEOJSON, JSON.stringify(outFc), 'utf-8');
  console.log(`Wrote ${OUT_GEOJSON} (${features.length} features)`);
}

main();
