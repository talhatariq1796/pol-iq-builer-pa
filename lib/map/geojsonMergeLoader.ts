/**
 * Load GeoJSON FeatureCollections that may be sharded for GitHub (<100MB per file).
 *
 * - If the fetched JSON has a top-level `merge` array of URL strings, each URL is
 *   fetched as a FeatureCollection and features are concatenated in order.
 * - Otherwise the payload must be a FeatureCollection.
 */

import type { BoundaryLayerConfig } from "@/types/political";

export type GeoJSONMergeManifest = {
  merge: string[];
};

function isMergeManifest(data: unknown): data is GeoJSONMergeManifest {
  if (typeof data !== "object" || data === null || !("merge" in data)) {
    return false;
  }
  const m = (data as { merge: unknown }).merge;
  return Array.isArray(m) && m.length > 0 && m.every((x) => typeof x === "string");
}

function isFeatureCollection(
  data: unknown,
): data is GeoJSON.FeatureCollection {
  if (typeof data !== "object" || data === null) return false;
  const d = data as { type?: unknown; features?: unknown };
  return (
    d.type === "FeatureCollection" &&
    Array.isArray(d.features)
  );
}

/**
 * Resolve JSON that is either a merge manifest or a single FeatureCollection.
 */
export async function resolveGeoJSONData(
  data: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<GeoJSON.FeatureCollection> {
  if (isMergeManifest(data)) {
    const parts = await Promise.all(
      data.merge.map(async (url) => {
        const res = await fetchImpl(url);
        if (!res.ok) {
          throw new Error(
            `Failed to fetch GeoJSON part ${url}: ${res.status} ${res.statusText}`,
          );
        }
        const part = await res.json();
        if (!isFeatureCollection(part)) {
          throw new Error(`GeoJSON part is not a FeatureCollection: ${url}`);
        }
        return part;
      }),
    );
    return {
      type: "FeatureCollection",
      features: parts.flatMap((p) => p.features),
    };
  }

  if (isFeatureCollection(data)) {
    return data;
  }

  throw new Error(
    "Expected GeoJSON FeatureCollection or a manifest with a non-empty merge[] of URLs",
  );
}

/**
 * Fetch a URL and return a single merged FeatureCollection.
 */
export async function loadGeoJSONMerged(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeoJSON.FeatureCollection> {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return resolveGeoJSONData(await res.json(), fetchImpl);
}

/** True when the map layer cannot use `config.dataPath` alone (multi-part or merge manifest). */
export function boundaryLayerUsesMergedBlobUrl(
  config: BoundaryLayerConfig,
): boolean {
  return (
    (config.dataPaths?.length ?? 0) > 0 ||
    /\.manifest\.json$/i.test(config.dataPath)
  );
}

/**
 * Load one logical boundary layer: each entry in dataPaths (or single dataPath) is fetched
 * via loadGeoJSONMerged (supports manifests); feature arrays are concatenated in order.
 */
export async function loadBoundaryFeatureCollection(
  config: BoundaryLayerConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GeoJSON.FeatureCollection> {
  const urls =
    config.dataPaths && config.dataPaths.length > 0
      ? config.dataPaths
      : [config.dataPath];
  const parts = await Promise.all(
    urls.map(async (url, index) => {
      try {
        return await loadGeoJSONMerged(url, fetchImpl);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(
          `Boundary load failed at index ${index} (${url}): ${msg}`,
        );
      }
    }),
  );
  return {
    type: "FeatureCollection",
    features: parts.flatMap((p) => p.features),
  };
}
