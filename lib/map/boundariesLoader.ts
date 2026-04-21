/**
 * Smart boundary loader shared across all choropleth layer components.
 *
 * Priority order:
 * 1. Custom boundariesUrl prop (caller-supplied — e.g. user-uploaded file URL)
 * 2. politicalDataService.loadPrecinctBoundaries() — handles uploads registered with the service
 * 3. Default local file /data/political/ingham_precincts.geojson — always correct high-res fallback
 *
 * Validates the result before returning so callers always get usable data.
 */

import { politicalDataService } from "@/lib/services/PoliticalDataService";
import { loadGeoJSONMerged } from "@/lib/map/geojsonMergeLoader";

const DEFAULT_PRECINCT_GEOJSON =
  "/data/political/pensylvania/precincts/pa_2020_presidential.geojson";

/** Minimum number of features expected from a valid precinct boundary file */
const MIN_EXPECTED_FEATURES = 10;

/**
 * Check whether a GeoJSON FeatureCollection looks like valid precinct data.
 * Returns false if it has too few features or no recognizable name properties.
 */
function isValidPrecinctGeoJSON(geojson: GeoJSON.FeatureCollection): boolean {
  if (!geojson?.features || geojson.features.length < MIN_EXPECTED_FEATURES) {
    return false;
  }
  // Check first feature has a recognizable name field
  const props = geojson.features[0]?.properties || {};
  const hasNameField =
    "PRECINCT_NAME" in props ||
    "Precinct_Long_Name" in props ||
    "NAME" in props ||
    "UNIQUE_ID" in props ||
    "precinct_name" in props ||
    "name" in props;
  return hasNameField;
}

/**
 * Fetch a GeoJSON file or manifest from a URL and return a FeatureCollection.
 */
async function fetchGeoJSON(url: string): Promise<GeoJSON.FeatureCollection> {
  return loadGeoJSONMerged(url);
}

/**
 * Load precinct boundaries with smart fallback chain.
 *
 * @param boundariesUrl - Optional caller-supplied URL (e.g. user-uploaded blob URL or custom file path)
 * @returns GeoJSON FeatureCollection of precinct boundaries
 */
export async function loadBoundariesWithFallback(
  boundariesUrl?: string | null,
): Promise<GeoJSON.FeatureCollection> {
  // ── 1. Caller-supplied URL (user upload or custom data source) ──────────────
  if (boundariesUrl) {
    try {
      console.log(
        "[loadBoundaries] Loading from caller-supplied URL:",
        boundariesUrl,
      );
      const geojson = await fetchGeoJSON(boundariesUrl);
      if (isValidPrecinctGeoJSON(geojson)) {
        console.log(
          `[loadBoundaries] Caller URL loaded: ${geojson.features.length} features`,
        );
        return geojson;
      }
      console.warn(
        "[loadBoundaries] Caller URL returned invalid/empty GeoJSON, continuing fallback chain",
      );
    } catch (err) {
      console.warn(
        "[loadBoundaries] Caller URL failed:",
        err,
        "— continuing fallback chain",
      );
    }
  }

  // ── 2. politicalDataService (handles user-uploaded files registered with the service) ──
  try {
    const serviceData = await politicalDataService.loadPrecinctBoundaries();
    if (isValidPrecinctGeoJSON(serviceData as GeoJSON.FeatureCollection)) {
      const fc = serviceData as GeoJSON.FeatureCollection;
      console.log(
        `[loadBoundaries] Service loaded: ${fc.features.length} features`,
      );
      return fc;
    }
    console.warn(
      "[loadBoundaries] Service returned invalid/empty data, falling back to local file",
    );
  } catch (err) {
    console.warn(
      "[loadBoundaries] Service failed:",
      err,
      "— falling back to local file",
    );
  }

  // ── 3. Default local high-resolution file (always available in /public) ─────
  console.log(
    "[loadBoundaries] Loading default local file:",
    DEFAULT_PRECINCT_GEOJSON,
  );
  const geojson = await fetchGeoJSON(DEFAULT_PRECINCT_GEOJSON);
  console.log(
    `[loadBoundaries] Default file loaded: ${geojson.features.length} features`,
  );
  return geojson;
}
