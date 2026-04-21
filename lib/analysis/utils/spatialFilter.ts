/* eslint-disable @typescript-eslint/no-explicit-any */
/*
  Utility: Spatial filter enforcement with robust feature ID extraction.
  Contract:
  - Input: features (array of objects with properties or nested properties), ids (array of strings/numbers), options { analysisScope?, scope?, forceProjectScope? }
  - Behavior: If project scope is active, return features unchanged. Otherwise, filter features whose extracted ID matches any provided id (string compare).
  - ID extraction order:
    1) props.ID, props.id, props.area_id, props.areaID, props.geoid, props.GEOID
    2) Extract a ZIP-like token from DESCRIPTION or area_name (supports formats like "11234 (Brooklyn)" or "ZIP 12345 - City")
    3) Final fallback: return null (caller will drop)
*/

export type SpatialFilterOptions = {
  analysisScope?: string;
  scope?: string;
  forceProjectScope?: boolean;
};

function normalizeId(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length ? s : null;
}

function extractFromDescription(text: string): string | null {
  const src = text.trim();
  // Pattern: leading digits before space/parenthesis
  let m = src.match(/^(\d{3,})\s*\(/);
  if (m?.[1]) return m[1];
  // Pattern: any 5 consecutive digits (US ZIP)
  m = src.match(/\b(\d{5})\b/);
  if (m?.[1]) return m[1];
  // Fallback: any leading number sequence
  m = src.match(/^(\d{3,})/);
  if (m?.[1]) return m[1];
  return null;
}

export function extractFeatureId(feature: any): string | null {
  if (!feature) return null;
  const lvl1 = (typeof feature === 'object' && feature) ? (feature as any).properties || feature : feature;
  const props = (lvl1 && typeof lvl1 === 'object') ? (lvl1 as any).properties || lvl1 : lvl1; // handle double nesting

  // Direct ID fields
  const direct = normalizeId(
    (props as any)?.ID ?? (props as any)?.id ?? (props as any)?.area_id ?? (props as any)?.areaID ?? (props as any)?.geoid ?? (props as any)?.GEOID
  );
  if (direct) return direct;

  // From DESCRIPTION/area_name
  const desc = (props as any)?.DESCRIPTION ?? (props as any)?.area_name;
  if (typeof desc === 'string' && desc.trim()) {
    const idFromDesc = extractFromDescription(desc);
    if (idFromDesc) return idFromDesc;
  }

  return null;
}

export function filterFeaturesBySpatialFilterIds(
  features: any[] | undefined | null,
  ids: Array<string | number> | undefined | null,
  options?: SpatialFilterOptions
): any[] {
  if (!Array.isArray(features) || features.length === 0) return [];
  const scope = options?.analysisScope || options?.scope;
  if (options?.forceProjectScope || scope === 'project' || scope === 'projects') {
    return features;
  }
  if (!Array.isArray(ids) || ids.length === 0) return features;

  const idSet = new Set(ids.map((v) => String(v).trim()).filter(Boolean));
  return features.filter((f) => {
    const fid = extractFeatureId(f);
    return fid ? idSet.has(fid) : false;
  });
}

export default filterFeaturesBySpatialFilterIds;
