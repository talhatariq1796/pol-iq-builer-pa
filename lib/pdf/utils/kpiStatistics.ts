/**
 * KPI Statistics Utilities
 * 
 * Calculates comprehensive statistics (average, median, range, etc.)
 * for key performance indicators from property data arrays
 */

export interface KPIStatistics {
  /** Average (mean) value */
  average: number;
  /** Median value (50th percentile) */
  median: number;
  /** Minimum value in dataset */
  min: number;
  /** Maximum value in dataset */
  max: number;
  /** Range string (e.g., "$325K - $850K") */
  range: string;
  /** Standard deviation (measure of spread) */
  stdDev: number;
  /** First quartile (25th percentile) */
  q1: number;
  /** Third quartile (75th percentile) */
  q3: number;
  /** Number of data points analyzed */
  sampleSize: number;
}

export interface KPISummary {
  /** Median price statistics */
  medianPrice?: KPIStatistics;
  /** Days on market statistics */
  daysOnMarket?: KPIStatistics;
  /** Price per square foot statistics */
  pricePerSqFt?: KPIStatistics;
  /** Active inventory statistics */
  activeInventory?: KPIStatistics;
}

/**
 * Calculate comprehensive statistics for a numeric dataset
 * 
 * @param values Array of numeric values
 * @param formatter Optional formatting function for range display
 * @returns KPIStatistics object with all statistical measures
 */
export function calculateStatistics(
  values: number[],
  formatter?: (value: number) => string
): KPIStatistics | null {
  // Filter out invalid values
  const validValues = values.filter(v => 
    typeof v === 'number' && 
    !isNaN(v) && 
    isFinite(v) && 
    v >= 0
  );
  
  if (validValues.length === 0) {
    return null;
  }
  
  // Sort for percentile calculations
  const sorted = [...validValues].sort((a, b) => a - b);
  
  // Calculate average
  const average = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  
  // Calculate median
  const median = getPercentile(sorted, 50);
  
  // Calculate quartiles
  const q1 = getPercentile(sorted, 25);
  const q3 = getPercentile(sorted, 75);
  
  // Min and max
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  // Standard deviation
  const variance = sorted.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  
  // Format range
  const formatValue = formatter || ((v: number) => v.toString());
  const range = `${formatValue(min)} - ${formatValue(max)}`;
  
  return {
    average,
    median,
    min,
    max,
    range,
    stdDev,
    q1,
    q3,
    sampleSize: sorted.length,
  };
}

/**
 * Calculate percentile value from sorted array
 * 
 * @param sorted Sorted array of numbers
 * @param percentile Percentile to calculate (0-100)
 * @returns Value at the specified percentile
 */
function getPercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (lower === upper) {
    return sorted[lower];
  }
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Format statistics for display
 * 
 * @param stats KPIStatistics object
 * @param valueFormatter Function to format values (e.g., currency, days)
 * @returns Formatted string for display
 */
export function formatStatisticsDisplay(
  stats: KPIStatistics,
  valueFormatter: (value: number) => string
): string {
  return `Average: ${valueFormatter(stats.average)} | Median: ${valueFormatter(stats.median)} | Range: ${stats.range}`;
}

/**
 * Format statistics as compact summary
 * 
 * @param stats KPIStatistics object
 * @param valueFormatter Function to format values
 * @returns Compact summary string
 */
export function formatCompactSummary(
  stats: KPIStatistics,
  valueFormatter: (value: number) => string
): string {
  return `${valueFormatter(stats.average)} avg | ${valueFormatter(stats.median)} med | ${stats.range}`;
}

/**
 * Calculate KPI statistics from property data array
 * 
 * @param properties Array of property objects
 * @param priceFormatter Currency formatter function
 * @param numberFormatter Number formatter function
 * @returns KPISummary with statistics for all KPIs
 */
export function calculateKPISummary(
  properties: Array<{
    price?: number;
    soldPrice?: number;
    listPrice?: number;
    daysOnMarket?: number;
    dom?: number;
    pricePerSqFt?: number;
    price_per_sqft?: number;
    squareFootage?: number;
    sqft?: number;
    [key: string]: any;
  }>,
  priceFormatter: (value: number) => string,
  numberFormatter: (value: number) => string
): KPISummary {
  // Extract prices
  const prices = properties
    .map(p => p.price || p.soldPrice || p.listPrice)
    .filter((p): p is number => p !== undefined && p > 0);
  
  // Extract days on market (handles multiple field name variations)
  const daysOnMarketValues = properties
    .map(p => p.daysOnMarket || p.dom || p.time_on_market)
    .filter((d): d is number => d !== undefined && d >= 0);
  
  // Extract price per sqft
  const pricePerSqFtValues = properties
    .map(p => {
      // Try direct field first
      if (p.pricePerSqFt || p.price_per_sqft) {
        return p.pricePerSqFt || p.price_per_sqft;
      }
      // Calculate if we have price and sqft
      const price = p.price || p.soldPrice || p.listPrice;
      const sqft = p.squareFootage || p.sqft || p.square_footage || p.living_area;
      if (price && sqft && sqft > 0) {
        return price / sqft;
      }
      return undefined;
    })
    .filter((p): p is number => p !== undefined && p > 0);
  
  // Calculate statistics for each KPI
  const medianPrice = calculateStatistics(prices, (v) => priceFormatter(v));
  const daysOnMarket = calculateStatistics(daysOnMarketValues, (v) => `${Math.round(v)} days`);
  const pricePerSqFt = calculateStatistics(pricePerSqFtValues, (v) => `${priceFormatter(v)}/sqft`);
  
  return {
    medianPrice: medianPrice || undefined,
    daysOnMarket: daysOnMarket || undefined,
    pricePerSqFt: pricePerSqFt || undefined,
  };
}

/**
 * Get data quality indicator based on sample size
 * 
 * @param sampleSize Number of data points
 * @returns Quality rating
 */
export function getDataQuality(sampleSize: number): 'Excellent' | 'Good' | 'Fair' | 'Limited' {
  if (sampleSize >= 50) return 'Excellent';
  if (sampleSize >= 20) return 'Good';
  if (sampleSize >= 10) return 'Fair';
  return 'Limited';
}

/**
 * Get confidence level based on standard deviation relative to mean
 * 
 * @param stats KPIStatistics object
 * @returns Confidence level
 */
export function getConfidenceLevel(stats: KPIStatistics): 'High' | 'Medium' | 'Low' {
  const coefficientOfVariation = stats.stdDev / stats.average;
  
  if (coefficientOfVariation < 0.2) return 'High';   // Low variation
  if (coefficientOfVariation < 0.4) return 'Medium'; // Moderate variation
  return 'Low'; // High variation
}
