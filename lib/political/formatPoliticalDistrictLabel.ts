import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

/** Human-readable label for canonical district ids (pa-* / mi-*). */
export function formatPoliticalDistrictLabel(districtId: string): string {
  if (districtId.startsWith('pa-congress-')) {
    const n = parseInt(districtId.replace('pa-congress-', ''), 10);
    return `Congressional District ${Number.isFinite(n) ? n : districtId.replace('pa-congress-', '')}`;
  }
  if (districtId.startsWith('pa-senate-')) {
    return `State Senate District ${districtId.replace('pa-senate-', '')}`;
  }
  if (districtId.startsWith('pa-house-')) {
    return `State House District ${districtId.replace('pa-house-', '')}`;
  }
  if (districtId.startsWith('mi-senate-')) {
    return `State Senate District ${districtId.replace('mi-senate-', '')}`;
  }
  if (districtId.startsWith('mi-house-')) {
    return `State House District ${districtId.replace('mi-house-', '')}`;
  }
  if (/^mi-0?\d{1,2}$/i.test(districtId)) {
    const raw = districtId.replace(/^mi-/i, '');
    const n = parseInt(raw, 10);
    return `Congressional District ${Number.isFinite(n) ? n : raw}`;
  }
  if (districtId.startsWith('pa-county-')) {
    const fp = districtId.replace('pa-county-', '');
    return `County FIPS ${fp}`;
  }
  if (districtId.startsWith('pa-sd-')) {
    return `School District ${districtId.replace('pa-sd-', '')}`;
  }
  if (districtId.startsWith('pa-zip-')) {
    return `ZIP ${districtId.replace('pa-zip-', '')}`;
  }
  return districtId;
}

/** Numeric / key fragment for enrichment APIs (state house/senate/congress). */
export function stripDistrictIdForEnrichment(
  districtId: string,
  level: 'congressional' | 'state_senate' | 'state_house'
): string {
  if (level === 'congressional') {
    if (districtId.startsWith('pa-congress-')) {
      return String(parseInt(districtId.replace('pa-congress-', ''), 10));
    }
    if (/^mi-0?\d{1,2}$/i.test(districtId)) {
      return String(parseInt(districtId.replace(/^mi-/i, ''), 10));
    }
  }
  if (level === 'state_senate') {
    if (districtId.startsWith('pa-senate-')) return districtId.replace('pa-senate-', '');
    if (districtId.startsWith('mi-senate-')) return districtId.replace('mi-senate-', '');
  }
  if (level === 'state_house') {
    if (districtId.startsWith('pa-house-')) return districtId.replace('pa-house-', '');
    if (districtId.startsWith('mi-house-')) return districtId.replace('mi-house-', '');
  }
  return districtId.replace(/^(pa|mi)-(congress|house|senate)-/i, '');
}

export function isPAPoliticalRegion(): boolean {
  return getPoliticalRegionEnv().stateFips === '42';
}
