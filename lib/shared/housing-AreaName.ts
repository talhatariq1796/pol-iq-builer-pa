/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Housing-specific utilities for resolving Quebec FSA codes and area names
 * Used specifically for Quebec housing projects with FSA postal codes
 */

export type ResolveMode = 'full' | 'cityOnly' | 'zipCity';

function normalizeFSA(fsa: string): string {
  if (!fsa) return '';
  
  // Canadian FSA (e.g., J9Z) - use directly if already clean
  const exactFsa = fsa.match(/^[A-Z]\d[A-Z]$/i)?.[0];
  if (exactFsa) return exactFsa.toUpperCase();
  
  // Try to extract FSA from within string (for cases like "J9Z (La Sarre)")
  const embeddedFsa = fsa.match(/\b[A-Z]\d[A-Z]\b/i)?.[0];
  if (embeddedFsa) return embeddedFsa.toUpperCase();
  
  // If no FSA pattern found, return as-is (no ZIP code padding)
  return fsa;
}

export function getFSA(input: any): string {
  try {
    if (!input) return '';
    const props = input.properties || input || {};
    const nested = props.properties || props;

    // Priority 1: ID field (contains clean FSA codes like "J9Z")
    const id = nested.ID || props.ID;
    if (id && typeof id === 'string') {
      const fsaPattern = id.match(/^[A-Z]\d[A-Z]$/i);
      if (fsaPattern) return id.toUpperCase();
    }

    // Priority 2: DESCRIPTION/area_name formats like "J9Z (La Sarre, QC)"
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
      const fsaMatch = desc.match(/\b([A-Z]\d[A-Z])\b/i)?.[1];
      if (fsaMatch) return normalizeFSA(fsaMatch);
    }

    // Priority 3: Other direct fields
    const direct = nested.fsa_code || nested.postal_code || props.fsa_code || props.postal_code;
    if (direct) return normalizeFSA(String(direct));

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

    const fsa = getFSA(input);
    const city = areaName ? extractCityFromDescription(areaName) : '';

    if (mode === 'full') {
      if (areaName) return areaName;
      if (fsa && city) return `${fsa} (${city})`;
      if (fsa) return `FSA ${fsa}`;
      return props.area_id || neutral;
    }

    if (mode === 'cityOnly') {
      if (city) return city;
      if (areaName && !fsa) return areaName;
      return neutral;
    }

    if (mode === 'zipCity') {
      if (fsa && city) return `${fsa} (${city})`;
      if (fsa) return `FSA ${fsa}`;
      if (city) return city;
      if (areaName) return areaName;
      return neutral;
    }

    return neutral;
  } catch {
    return options?.neutralFallback || 'Location';
  }
}

export function resolveRegionName(
  features: any[],
  regionId?: string,
  options?: { neutralFallback?: string }
): string {
  const neutral = options?.neutralFallback || (regionId ? `Region ${regionId}` : 'Quebec');
  
  try {
    // For Quebec housing project, try to extract region from first feature
    if (features && features.length > 0) {
      const firstFeature = features[0];
      const props = firstFeature?.properties || firstFeature || {};
      const nested = props.properties || props;
      
      // Look for Quebec/province info
      const region = nested.province || nested.region || nested.state || 
                     props.province || props.region || props.state;
      
      if (region && typeof region === 'string') {
        return region.trim();
      }
      
      // Extract region from description if available
      const desc = nested.DESCRIPTION || props.DESCRIPTION;
      if (desc && typeof desc === 'string') {
        const regionMatch = desc.match(/\b(QC|Quebec|Québec)\b/i);
        if (regionMatch) return 'Quebec';
      }
    }
    
    return neutral;
  } catch {
    return neutral;
  }
}