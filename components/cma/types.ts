/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CMA (Comparative Market Analysis) Types
 */

// Use loose typing so existing code doesn't need null-safety changes
export type CMAProperty = Record<string, any>;

export type CMAStats = Record<string, any>;

export type CMAFilters = Record<string, any>;

export type AreaSelection = Record<string, any>;

/**
 * Calculate time on market in days from list/sold date strings
 */
export function calculateTimeOnMarket(listDate?: string, soldDate?: string): number {
  if (!listDate) return 0;
  const start = new Date(listDate);
  const end = soldDate ? new Date(soldDate) : new Date();
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}
