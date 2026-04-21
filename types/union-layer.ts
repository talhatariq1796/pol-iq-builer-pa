// Utility types & helpers to support new field-union merge logic
// ----------------------------------------------------------------------------
// A MergedFeature is a GeoJSON-ish object whose attribute bag may be
// incrementally filled by multiple source layers.  We keep geometry optional
// because the merge step may overwrite the geometry only once (first layer
// wins) or keep them all identical.

export interface MergedFeature {
  /** Unique geographic identifier (ZIP / GEOID / FSA / etc.). */
  id: string;
  /** Attribute dictionary – each key is a canonical dataset column. */
  properties: Record<string, any>;
  /** Representative geometry – optional until first layer provides it. */
  geometry?: {
    type: string;
    coordinates: any;
  };
}

/**
 * Collection returned by the union step – one entry per merged geography.
 */
export interface MergedLayer {
  layerId: 'union';
  /** Synthetic layer name for downstream logging. */
  name: string;
  /** Final feature set after union. */
  features: MergedFeature[];
  /** Which source layers contributed to this union. */
  componentLayerIds: string[];
}

// ----------------------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------------------

/**
 * Merge attribute records from `source` into `target` without overwriting
 * previously-set values – fills holes only.
 */
export function mergeRecord(
  target: Record<string, any>,
  source: Record<string, any>
): void {
  Object.entries(source).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (target[k] === undefined || target[k] === null) {
      target[k] = v;
    }
  });
}

/**
 * Given arrays of features from multiple layers, build a Map keyed by the geo
 * identifier (`idField`, default "ID") and return the merged result.
 * Only the fields listed in `wantedFields` are copied; everything else is
 * ignored to keep the payload small.
 */
export function unionByGeoId(
  layers: Array<{ layerId: string; features: Array<Record<string, any>> }>,
  wantedFields: string[],
  idField: string = 'ID'
): MergedLayer {
  const unionMap: Map<string, MergedFeature> = new Map();
  const idKey = idField.toUpperCase();

  layers.forEach(({ layerId, features }) => {
    features.forEach((feat: any) => {
      const idVal = (feat[idKey] ?? feat[idField] ?? '').toString();
      if (!idVal) return; // skip records without geo id

      // Project only desired fields from this feature
      const subset: Record<string, any> = {};
      wantedFields.forEach((f) => {
        if (f in feat && feat[f] !== undefined && feat[f] !== null) {
          subset[f] = feat[f];
        }
      });

      const existing = unionMap.get(idVal);
      if (existing) {
        mergeRecord(existing.properties, subset);
      } else {
        unionMap.set(idVal, {
          id: idVal,
          properties: { ...subset },
          geometry: feat.geometry ? { ...feat.geometry } : undefined,
        });
      }
    });
  });

  return {
    layerId: 'union',
    name: 'Analysis Results',
    features: Array.from(unionMap.values()),
    componentLayerIds: layers.map((l) => l.layerId),
  };
} 