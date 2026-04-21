/**
 * Quartile Label System for Market Indexes
 * 
 * Provides descriptive labels for index scores based on which quartile they fall into.
 * Uses context-specific labels for different types of indexes.
 * 
 * @example
 * const label = getQuartileLabel(78, MARKET_INDEX_LABELS.hotGrowthIndex);
 * // Returns: "Strong Growth"
 */

export type QuartileRange = 'Q1' | 'Q2' | 'Q3' | 'Q4';

/**
 * Map of quartile ranges to descriptive labels
 */
export interface QuartileLabelMap {
  Q1: string;  // 0-25: Lowest quartile
  Q2: string;  // 26-50: Below average
  Q3: string;  // 51-75: Above average
  Q4: string;  // 76-100: Highest quartile
}

/**
 * Determine which quartile a score falls into
 * @param score - Numeric score (0-100)
 * @returns Quartile identifier (Q1, Q2, Q3, or Q4)
 */
export function getQuartile(score: number): QuartileRange {
  // Ensure score is within valid range
  const normalizedScore = Math.max(0, Math.min(100, score));
  
  if (normalizedScore <= 25) return 'Q1';
  if (normalizedScore <= 50) return 'Q2';
  if (normalizedScore <= 75) return 'Q3';
  return 'Q4';
}

/**
 * Get descriptive label for a score based on its quartile
 * @param score - Numeric score (0-100)
 * @param labelMap - Map of quartile ranges to labels
 * @returns Descriptive label string
 */
export function getQuartileLabel(
  score: number,
  labelMap: QuartileLabelMap
): string {
  const quartile = getQuartile(score);
  return labelMap[quartile];
}

/**
 * Predefined label maps for each market index type
 * Each index has context-appropriate labels for its quartiles
 */
export const MARKET_INDEX_LABELS: Record<string, QuartileLabelMap> = {
  /**
   * Hot Growth Index - Measures market heat and appreciation potential
   * Higher scores indicate stronger growth momentum
   */
  hotGrowthIndex: {
    Q1: 'Weak Growth',
    Q2: 'Moderate Growth',
    Q3: 'Strong Growth',
    Q4: 'Exceptional Growth',
  },

  /**
   * Affordability Index - Measures housing affordability
   * Higher scores indicate better affordability (easier to afford)
   */
  affordabilityIndex: {
    Q1: 'Unaffordable',
    Q2: 'Below Average',
    Q3: 'Affordable',
    Q4: 'Highly Affordable',
  },

  /**
   * New Homeowners Index - Measures first-time buyer activity
   * Higher scores indicate more new homeowner activity
   */
  newHomeownersIndex: {
    Q1: 'Low Activity',
    Q2: 'Moderate Activity',
    Q3: 'High Activity',
    Q4: 'Very High Activity',
  },

  /**
   * Overall Market Score - Composite health indicator
   * Higher scores indicate stronger overall market conditions
   */
  marketScore: {
    Q1: 'Poor',
    Q2: 'Fair',
    Q3: 'Good',
    Q4: 'Excellent',
  },
};

/**
 * Get formatted display string with score and label
 * @param score - Numeric score (0-100)
 * @param indexKey - Key for the index type in MARKET_INDEX_LABELS
 * @returns Formatted string like "78/100 - Strong Growth"
 */
export function getIndexDisplayValue(
  score: number,
  indexKey: keyof typeof MARKET_INDEX_LABELS
): string {
  const labelMap = MARKET_INDEX_LABELS[indexKey];
  const label = getQuartileLabel(score, labelMap);
  return `${Math.round(score)}/100 - ${label}`;
}

/**
 * Type-safe keys for market index labels
 */
export type MarketIndexKey = keyof typeof MARKET_INDEX_LABELS;

/**
 * Quartile background colors for visual enhancement
 * Subtle, professional colors that improve readability
 */
export const QUARTILE_COLORS: Record<QuartileRange, string> = {
  Q1: '#ffe0b2', // Light orange - attention needed
  Q2: '#fff9c4', // Light yellow - below average
  Q3: '#e3f2fd', // Light blue - above average
  Q4: '#e8f5e9', // Light green - excellent
};

/**
 * Get background color for a given score based on its quartile
 * @param score - Numeric score (0-100)
 * @returns Hex color string for background
 */
export function getQuartileColor(score: number): string {
  const quartile = getQuartile(score);
  return QUARTILE_COLORS[quartile];
}
