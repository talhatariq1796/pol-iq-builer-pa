/**
 * Display partisan lean like the IQ analysis panel: positive = Democratic, negative = Republican.
 * (Same convention as `PoliticalAnalysisPanel` `formatLean`.)
 */
export function formatPartisanLeanPanel(lean: number): string {
  if (lean === 0) return '0';
  const prefix = lean > 0 ? 'D+' : 'R+';
  return `${prefix}${Math.abs(lean).toFixed(1)}`;
}
