/**
 * Central registry of all CMA chart keys
 * Single source of truth to prevent key mismatches between generation and rendering
 */

export const ChartKeys = {
  // Page 2 Charts
  PRICE_HISTORY: 'priceHistoryChart',
  INVENTORY_BY_TYPE: 'inventoryByTypeChart',
  DAYS_ON_MARKET: 'daysOnMarketChart',

  // Page 4 Charts (Demographics)
  HOUSING_TENURE: 'housingTenureChart',
  INCOME_COMPARISON: 'incomeComparisonChart',
  POPULATION_STATS: 'populationStatsChart',
  AGE_DISTRIBUTION_DEMOGRAPHIC: 'ageDistributionDemographicChart',

  // Page 5 Charts (Economic)
  INDUSTRY_DISTRIBUTION: 'industryDistributionChart',

  // Page 6 Charts (Velocity)
  VELOCITY_DISTRIBUTION: 'velocityDistributionChart',
  VELOCITY_BY_PRICE: 'velocityByPriceChart',
} as const;

// Type for chart keys
export type ChartKey = typeof ChartKeys[keyof typeof ChartKeys];

// Helper to validate chart keys
export function isValidChartKey(key: string): key is ChartKey {
  return Object.values(ChartKeys).includes(key as ChartKey);
}

// Page-specific chart mappings for validation
export const PAGE_CHARTS = {
  page2: [ChartKeys.PRICE_HISTORY, ChartKeys.INVENTORY_BY_TYPE, ChartKeys.DAYS_ON_MARKET],
  page4: [ChartKeys.HOUSING_TENURE, ChartKeys.INCOME_COMPARISON, ChartKeys.POPULATION_STATS, ChartKeys.AGE_DISTRIBUTION_DEMOGRAPHIC],
  page5: [ChartKeys.INDUSTRY_DISTRIBUTION],
  page6: [ChartKeys.VELOCITY_DISTRIBUTION, ChartKeys.VELOCITY_BY_PRICE],
} as const;
