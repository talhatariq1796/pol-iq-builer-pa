/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Shared utilities for resolving area names and ZIP codes consistently
 * across route handlers, processors, and clustering.
 */

export type ResolveMode = 'full' | 'cityOnly' | 'zipCity';

function normalizeZip(zip: string): string {
  if (!zip) return '';
  
  // Canadian FSA (e.g., A1B) - first try exact match as before
  const exactFsa = zip.match(/^[A-Z]\d[A-Z]$/i)?.[0];
  if (exactFsa) return exactFsa.toUpperCase();
  
  // Then try to extract FSA from within string (for cases like "G0A (Quebec)")
  const embeddedFsa = zip.match(/\b[A-Z]\d[A-Z]\b/i)?.[0];
  if (embeddedFsa) return embeddedFsa.toUpperCase();
  
  // Extract 4-5 digits and pad to 5 (existing ZIP code logic preserved)
  const m = zip.match(/\d{4,5}/);
  if (!m) return '';
  const digits = m[0];
  return digits.length === 4 ? `0${digits}` : digits;
}

export function getZip(input: any): string {
  try {
    if (!input) return '';
    const props = input.properties || input || {};
    const nested = props.properties || props;

    // Prefer DESCRIPTION/area_name formats like "11234 (Brooklyn)"
    const desc = typeof nested.DESCRIPTION === 'string' && nested.DESCRIPTION.trim()
      ? nested.DESCRIPTION.trim()
      : typeof props.DESCRIPTION === 'string' && props.DESCRIPTION.trim()
        ? props.DESCRIPTION.trim()
        : typeof nested.area_name === 'string' && nested.area_name.trim()
          ? nested.area_name.trim()
          : typeof props.area_name === 'string' && props.area_name.trim()
            ? props.area_name.trim()
            : '';
    if (desc) {
      // Try FSA pattern first (Canadian postal codes like G0A)
      const fsaMatch = desc.match(/\b([A-Z]\d[A-Z])\b/i)?.[1];
      if (fsaMatch) return normalizeZip(fsaMatch);
      
      // Then try US ZIP codes
      const z = desc.match(/\b(\d{5})\b/)?.[1] || desc.match(/^(\d{4,5})/)?.[1];
      if (z) return normalizeZip(z);
    }

    // Direct fields
    const direct = nested.zip_code || nested.geo_id || nested.ID || props.zip_code || props.geo_id || props.ID;
    if (direct) return normalizeZip(String(direct));

    return '';
  } catch {
    return '';
  }
}

export function extractCityFromDescription(desc: string): string {
  if (!desc || typeof desc !== 'string') return '';
  const m = desc.match(/\(([^)]+)\)/);
  if (m?.[1]) return m[1].trim();
  return desc.trim();
}

export function resolveAreaName(
  input: any,
  options?: { mode?: ResolveMode; neutralFallback?: string }
): string {
  const mode = options?.mode || 'full';
  const neutral = options?.neutralFallback || 'Location';

  try {
    const props = input?.properties || input || {};
    const nested = props.properties || props;

    // 1) DESCRIPTION (full string), else area_name
    const description = typeof nested.DESCRIPTION === 'string' && nested.DESCRIPTION.trim()
      ? nested.DESCRIPTION.trim()
      : typeof props.DESCRIPTION === 'string' && props.DESCRIPTION.trim()
        ? props.DESCRIPTION.trim()
        : '';
    const areaName = description || (typeof nested.area_name === 'string' && nested.area_name.trim() ? nested.area_name.trim() : '') ||
      (typeof props.area_name === 'string' && props.area_name.trim() ? props.area_name.trim() : '');

    const zip = getZip(input);
    const city = areaName ? extractCityFromDescription(areaName) : '';

    if (mode === 'full') {
      if (areaName) return areaName;
      if (zip && city) return `${zip} (${city})`;
      if (zip) return `ZIP ${zip}`;
      return props.area_id || neutral;
    }

    if (mode === 'cityOnly') {
      if (city) return city;
      if (areaName) return areaName; // fallback to whatever string we have
      if (zip) return `ZIP ${zip}`;
      return props.area_id || neutral;
    }

    // mode === 'zipCity'
    if (zip && city) return `${zip} (${city})`;
    if (zip) return `ZIP ${zip}`;
    if (areaName) return areaName;
    return props.area_id || neutral;
  } catch {
    return options?.neutralFallback || 'Location';
  }
}

export function resolveRegionName(
  features: any[],
  regionId?: string,
  options?: { neutralFallback?: string }
): string {
  const neutral = options?.neutralFallback || (regionId ? `Region ${regionId}` : 'Location');
  if (!Array.isArray(features) || features.length === 0) return neutral;

  for (const f of features.slice(0, 6)) {
    const name = resolveAreaName(f, { mode: 'full', neutralFallback: '' });
    if (name) return name;
  }
  return neutral;
}
