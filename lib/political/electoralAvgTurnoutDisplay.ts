/**
 * Unified segment precinct `electoral.avgTurnout` may be 0–1 (fraction) or 0–100 (% points).
 * Returns a 0–100 value suitable for display (same rule as workflowHandlers aggregate display).
 */
export function electoralAvgTurnoutToDisplayPct(
  avgTurnout: number | undefined | null,
): number {
  const raw = avgTurnout ?? 0;
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
  return raw > 1 ? raw : raw * 100;
}
