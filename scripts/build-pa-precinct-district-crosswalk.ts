/**
 * Build pa_precinct_district_crosswalk.json — precinct centroid → PA legislative & municipal districts.
 *
 * Usage: npx ts-node scripts/build-pa-precinct-district-crosswalk.ts
 *
 * Inputs (public/data/political/pensylvania/precincts/ and districts/):
 *   - precincts/pa_2020_presidential.geojson (precinct polygons, UNIQUE_ID)
 *   - districts/PaHouse2026_01.geojson (LEG_DISTRI)
 *   - districts/PaSenate2026_01_w_senators.geojson (TIGER SLDUST)
 *   - districts/PaCongressional2026_01.geojson (LEG_DISTRI)
 *   - districts/PaMunicipalities2026_01.geojson (FIPS_COUNT, MUNICIPAL1, CLASS_OF_M, COUNTY_NAM)
 *
 * Output keys match targeting / unified precinct names (UNIQUE_ID).
 * District slugs: pa-house-{n}, pa-senate-{n}, pa-congress-{NN}, municipality slug county-name.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';

const DATA_DIR = path.join(process.cwd(), 'public/data/political/pensylvania');
const PRECINCT_DIR = path.join(DATA_DIR, 'precincts');
const DISTRICT_DIR = path.join(DATA_DIR, 'districts');
const PRECINCT_FILE = path.join(PRECINCT_DIR, 'pa_2020_presidential.geojson');
const HOUSE_FILE = path.join(DISTRICT_DIR, 'PaHouse2026_01.geojson');
const SENATE_FILE = path.join(DISTRICT_DIR, 'PaSenate2026_01_w_senators.geojson');
const CONGRESS_FILE = path.join(DISTRICT_DIR, 'PaCongressional2026_01.geojson');
const MUNI_FILE = path.join(DISTRICT_DIR, 'PaMunicipalities2026_01.geojson');
const SCHOOL_FILE = path.join(DISTRICT_DIR, 'pa_school_districts.geojson');
const ZIP_FILE = path.join(DISTRICT_DIR, 'pa_zip_codes.geojson');
const OUTPUT_FILE = path.join(PRECINCT_DIR, 'pa_precinct_district_crosswalk.json');

type PolyFeat = Feature<Polygon | MultiPolygon>;

type LonLatBBox = [number, number, number, number];

interface IndexedPoly {
  f: PolyFeat;
  bbox: LonLatBBox;
}

function bbox2d(feat: PolyFeat): LonLatBBox {
  const b = turf.bbox(feat);
  return [b[0], b[1], b[2], b[3]];
}

/** DCED / legislative layers ship in Web Mercator; precincts are WGS84. */
function webMercatorToLngLat(x: number, y: number): [number, number] {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

function mapRing3857To4326(ring: number[][]): number[][] {
  return ring.map(([x, y]) => webMercatorToLngLat(x, y));
}

function reproject3857FeatureCollection(
  fc: FeatureCollection<Polygon | MultiPolygon>,
): FeatureCollection<Polygon | MultiPolygon> {
  return {
    type: 'FeatureCollection',
    features: fc.features.map(f => {
      const g = f.geometry;
      if (!g) return f as PolyFeat;
      if (g.type === 'Polygon') {
        return {
          ...f,
          geometry: {
            type: 'Polygon',
            coordinates: g.coordinates.map(mapRing3857To4326),
          },
        } as PolyFeat;
      }
      if (g.type === 'MultiPolygon') {
        return {
          ...f,
          geometry: {
            type: 'MultiPolygon',
            coordinates: g.coordinates.map(poly => poly.map(mapRing3857To4326)),
          },
        } as PolyFeat;
      }
      return f as PolyFeat;
    }),
  };
}

function loadFC(p: string): FeatureCollection<Polygon | MultiPolygon> {
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as FeatureCollection;
  return raw as FeatureCollection<Polygon | MultiPolygon>;
}

function indexPolygons(fc: FeatureCollection<Polygon | MultiPolygon>): IndexedPoly[] {
  const out: IndexedPoly[] = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    const pf = f as PolyFeat;
    out.push({ f: pf, bbox: bbox2d(pf) });
  }
  return out;
}

function slugPart(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function municipalityType(classOfM: string | undefined): string | null {
  if (!classOfM) return null;
  const c = classOfM.toUpperCase();
  if (c === 'CITY') return 'city';
  if (c === 'BORO') return 'borough';
  if (c === 'TOWN') return 'town';
  if (c === '1TWP' || c === '2TWP') return 'township';
  return 'other';
}

function senateDistrictFromProps(props: GeoJSON.GeoJsonProperties): number | null {
  if (!props || typeof props !== 'object') return null;
  const o = props as Record<string, unknown>;
  const key = Object.keys(o).find(k => k.endsWith('.SLDUST') || k === 'SLDUST');
  if (!key) return null;
  const v = o[key];
  const n = typeof v === 'string' || typeof v === 'number' ? parseInt(String(v), 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

function findContaining(
  indexed: IndexedPoly[],
  lon: number,
  lat: number,
  pick: (props: GeoJSON.GeoJsonProperties) => string | null,
): string | null {
  const pt = turf.point([lon, lat]);
  for (const { f, bbox: bb } of indexed) {
    if (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3]) continue;
    try {
      if (turf.booleanPointInPolygon(pt, f)) {
        return pick(f.properties);
      }
    } catch {
      continue;
    }
  }
  return null;
}

function findMunicipality(
  pool: IndexedPoly[],
  lon: number,
  lat: number,
): { slug: string | null; muniType: string | null } {
  const pt = turf.point([lon, lat]);
  for (const { f, bbox: bb } of pool) {
    if (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3]) continue;
    try {
      if (!turf.booleanPointInPolygon(pt, f)) continue;
      const o = f.properties as Record<string, unknown>;
      const name = String(o.MUNICIPAL1 ?? o.FIPS_AREA1 ?? '').trim();
      const cname = String(o.COUNTY_NAM ?? '').trim();
      if (!name) return { slug: null, muniType: municipalityType(String(o.CLASS_OF_M ?? '')) };
      const a = slugPart(cname);
      const b = slugPart(name);
      const slug = a && b ? `${a}-${b}` : b || a || null;
      return { slug, muniType: municipalityType(String(o.CLASS_OF_M ?? '')) };
    } catch {
      continue;
    }
  }
  return { slug: null, muniType: null };
}

function findSchoolDistrict(
  pool: IndexedPoly[],
  lon: number,
  lat: number,
): { id: string; name: string } | null {
  const pt = turf.point([lon, lat]);
  for (const { f, bbox: bb } of pool) {
    if (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3]) continue;
    try {
      if (!turf.booleanPointInPolygon(pt, f)) continue;
      const o = f.properties as Record<string, unknown>;
      const aun = o?.AUN_NUM;
      if (aun == null || aun === '') return null;
      const id = `pa-sd-${String(aun)}`;
      const name = String(o?.SCHOOL_DIS ?? o?.SCHOOL_NAM ?? '').trim() || id;
      return { id, name };
    } catch {
      continue;
    }
  }
  return null;
}

function findZipCode(
  pool: IndexedPoly[],
  lon: number,
  lat: number,
): { id: string; name: string } | null {
  const pt = turf.point([lon, lat]);
  for (const { f, bbox: bb } of pool) {
    if (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3]) continue;
    try {
      if (!turf.booleanPointInPolygon(pt, f)) continue;
      const o = f.properties as Record<string, unknown>;
      const raw = String(o?.ZIP_CODE ?? '').trim();
      if (!raw) return null;
      const code = raw.padStart(5, '0').slice(0, 5);
      if (!/^\d{5}$/.test(code)) return null;
      const id = `pa-zip-${code}`;
      const po = String(o?.PO_NAME ?? '').trim();
      const name = po ? `${code} — ${po}` : `ZIP ${code}`;
      return { id, name };
    } catch {
      continue;
    }
  }
  return null;
}

function main(): void {
  console.log('Loading GeoJSON…');
  const precinctFc = loadFC(PRECINCT_FILE);
  const houseIdx = indexPolygons(reproject3857FeatureCollection(loadFC(HOUSE_FILE)));
  const senateIdx = indexPolygons(loadFC(SENATE_FILE));
  const congressIdx = indexPolygons(reproject3857FeatureCollection(loadFC(CONGRESS_FILE)));
  const muniFc = reproject3857FeatureCollection(loadFC(MUNI_FILE));
  const schoolIdx = indexPolygons(loadFC(SCHOOL_FILE));
  const zipIdx = indexPolygons(loadFC(ZIP_FILE));

  const muniByCounty = new Map<string, IndexedPoly[]>();
  const muniAll: IndexedPoly[] = [];
  for (const f of muniFc.features) {
    if (!f.geometry) continue;
    const pf = f as PolyFeat;
    const ip = { f: pf, bbox: bbox2d(pf) };
    muniAll.push(ip);
    const props = pf.properties as Record<string, unknown>;
    const fips = String(props.FIPS_COUNT ?? props.FIPS_COUNTY ?? '').padStart(3, '0');
    if (fips && fips !== '000') {
      if (!muniByCounty.has(fips)) muniByCounty.set(fips, []);
      muniByCounty.get(fips)!.push(ip);
    }
  }

  const precincts: Record<string, Record<string, unknown>> = {};
  const coverage = {
    stateHouse: 0,
    stateSenate: 0,
    congressional: 0,
    municipalities: 0,
    schoolDistricts: 0,
    zcta: 0,
  };

  let n = 0;
  for (const feat of precinctFc.features) {
    if (!feat.geometry) continue;
    const props = feat.properties as Record<string, unknown>;
    const uniqueId = String(props.UNIQUE_ID ?? '').trim();
    if (!uniqueId) continue;

    let repPoint: Feature<Point>;
    try {
      repPoint = turf.pointOnFeature(feat as PolyFeat);
    } catch {
      try {
        repPoint = turf.centroid(feat as PolyFeat);
      } catch {
        continue;
      }
    }
    const [lon, lat] = repPoint.geometry.coordinates;

    let centroidOut: [number, number];
    try {
      const c = turf.centroid(feat as PolyFeat);
      centroidOut = [c.geometry.coordinates[0], c.geometry.coordinates[1]];
    } catch {
      centroidOut = [lon, lat];
    }

    const houseNum = findContaining(houseIdx, lon, lat, p => {
      const leg = (p as Record<string, unknown>)?.LEG_DISTRI;
      const n0 = typeof leg === 'number' ? leg : parseInt(String(leg ?? ''), 10);
      return Number.isFinite(n0) ? `pa-house-${n0}` : null;
    });

    const senateNum = findContaining(senateIdx, lon, lat, p => {
      const d = senateDistrictFromProps(p);
      return d != null ? `pa-senate-${d}` : null;
    });

    const congressNum = findContaining(congressIdx, lon, lat, p => {
      const leg = (p as Record<string, unknown>)?.LEG_DISTRI;
      const n0 = typeof leg === 'number' ? leg : parseInt(String(leg ?? ''), 10);
      return Number.isFinite(n0) ? `pa-congress-${String(n0).padStart(2, '0')}` : null;
    });

    const countyFp = String(props.COUNTYFP ?? '').padStart(3, '0');
    const muniPool = muniByCounty.get(countyFp) ?? muniAll;
    let { slug: muniSlug, muniType } = findMunicipality(muniPool, lon, lat);
    if (!muniSlug) {
      const fallback = findMunicipality(muniAll, lon, lat);
      muniSlug = fallback.slug;
      muniType = muniType ?? fallback.muniType;
    }

    if (houseNum) coverage.stateHouse++;
    if (senateNum) coverage.stateSenate++;
    if (congressNum) coverage.congressional++;
    if (muniSlug) coverage.municipalities++;

    const schoolInfo = findSchoolDistrict(schoolIdx, lon, lat);
    const zipInfo = findZipCode(zipIdx, lon, lat);
    if (schoolInfo) coverage.schoolDistricts++;
    if (zipInfo) coverage.zcta++;

    const jurisdiction = String(props.NAME ?? uniqueId.split('-:-')[1] ?? uniqueId).trim();

    precincts[uniqueId] = {
      precinctId: uniqueId,
      precinctName: uniqueId,
      precinctNameAlt: [] as string[],
      jurisdiction,
      congressional: congressNum,
      stateSenate: senateNum,
      stateHouse: houseNum,
      municipality: muniSlug,
      municipalityType: muniType,
      cityWard: null,
      schoolDistrict: schoolInfo?.id ?? null,
      schoolDistrictName: schoolInfo?.name ?? null,
      zcta: zipInfo?.id ?? null,
      zctaName: zipInfo?.name ?? null,
      registeredVoters: null,
      activeVoters: null,
      centroid: centroidOut,
    };

    n++;
    if (n % 1000 === 0) console.log(`  …${n} precincts`);
  }

  const keys = Object.keys(precincts);
  const out = {
    metadata: {
      county: 'Statewide',
      state: 'Pennsylvania',
      generated: new Date().toISOString(),
      precinctCount: keys.length,
      dataSource:
        'PA 2020 precinct boundaries (LUSE), PA House/Congressional 2026 layers, TIGER SLDU senate, DCED municipalities 2026, pa_school_districts.geojson, pa_zip_codes.geojson',
      methodology:
        'Spatial join: turf.pointOnFeature (fallback centroid) in WGS84 point-in-polygon; House/Congress/Municipal reprojected from EPSG:3857; school + ZIP from WGS84 layers',
      districtCoverage: coverage,
    },
    precincts,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(out));
  console.log(`Wrote ${keys.length} precincts → ${OUTPUT_FILE}`);
  console.log('Coverage counts (non-null):', coverage);
}

main();
