/**
 * Default region labels for political data / PDF when not overridden by env.
 * PA-only deployment: set POLITICAL_REPORT_* in .env for other states.
 */

export function getPoliticalRegionEnv(): {
  state: string;
  county: string;
  stateFips: string;
  /** Display name for county summary (e.g. "Pennsylvania" when statewide). */
  summaryAreaName: string;
} {
  return {
    state: process.env.POLITICAL_REPORT_STATE || 'Pennsylvania',
    county: process.env.POLITICAL_REPORT_COUNTY || 'Statewide',
    stateFips: process.env.POLITICAL_STATE_FIPS || '42',
    summaryAreaName: process.env.POLITICAL_SUMMARY_AREA_NAME || 'Pennsylvania',
  };
}

/**
 * Default jurisdiction label for AI/spatial fallbacks when no place is parsed.
 * Uses county from env when set; otherwise statewide summary name (e.g. Pennsylvania).
 */
export function getDefaultPoliticalJurisdictionLabel(): string {
  const { county, state, summaryAreaName } = getPoliticalRegionEnv();
  if (county && county !== 'Statewide' && county.trim() !== '') {
    return `${county} County, ${state}`;
  }
  return summaryAreaName || state;
}

/**
 * One-line location for precinct cards when not using PA-specific formatting.
 */
export function formatPrecinctLocationFallback(countyName?: string | null): string {
  const r = getPoliticalRegionEnv();
  const c = countyName?.trim();
  if (c) return `${c}, ${r.state}`;
  return getDefaultPoliticalJurisdictionLabel();
}
