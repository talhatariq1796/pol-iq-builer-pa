/**
 * Price Delta Analysis Utilities
 * 
 * Calculates the difference between asking and sold prices from
 * real comparables data to provide market insights.
 */

export interface PriceDeltaStats {
  /** Average price delta as percentage (negative = below ask, positive = above ask) */
  averageDelta: number;
  /** Median price delta as percentage */
  medianDelta: number;
  /** Minimum delta (most below ask) */
  minDelta: number;
  /** Maximum delta (most above ask) */
  maxDelta: number;
  /** Range string (e.g., "-12% to +5%") */
  range: string;
  /** Market interpretation based on delta */
  marketSignal: 'Buyer\'s Market' | 'Seller\'s Market' | 'Balanced Market';
  /** Number of comparables analyzed */
  sampleSize: number;
  /** Percentage of properties selling below ask */
  belowAskPercent: number;
  /** Percentage of properties selling above ask */
  aboveAskPercent: number;
  /** Percentage of properties selling at ask */
  atAskPercent: number;
}

export interface ComparableProperty {
  listPrice?: number;
  soldPrice?: number;
  askingPrice?: number;
  salePrice?: number;
  // Allow flexible property names from different data sources
  [key: string]: any;
}

/**
 * Calculate price delta statistics from comparable properties
 * 
 * @param comparables Array of comparable properties with asking/sold prices
 * @returns PriceDeltaStats object with comprehensive analysis
 */
export function calculatePriceDelta(
  comparables: ComparableProperty[]
): PriceDeltaStats | null {
  if (!comparables || comparables.length === 0) {
    return null;
  }

  // Extract deltas from comparables
  const deltas: number[] = [];
  
  for (const comp of comparables) {
    // Try different field name combinations
    const askPrice = comp.listPrice || comp.askingPrice;
    const soldPrice = comp.soldPrice || comp.salePrice;
    
    // Only include if both prices are available and valid
    if (askPrice && soldPrice && askPrice > 0 && soldPrice > 0) {
      // Calculate delta as percentage: (sold - ask) / ask * 100
      const delta = ((soldPrice - askPrice) / askPrice) * 100;
      deltas.push(delta);
    }
  }

  // Need at least 3 comparables for meaningful analysis
  if (deltas.length < 3) {
    return null;
  }

  // Calculate statistics
  const averageDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  
  const sortedDeltas = [...deltas].sort((a, b) => a - b);
  const medianDelta = sortedDeltas[Math.floor(sortedDeltas.length / 2)];
  
  const minDelta = Math.min(...deltas);
  const maxDelta = Math.max(...deltas);
  
  // Calculate distribution
  const belowAsk = deltas.filter(d => d < -0.5).length;
  const aboveAsk = deltas.filter(d => d > 0.5).length;
  const atAsk = deltas.length - belowAsk - aboveAsk;
  
  const belowAskPercent = (belowAsk / deltas.length) * 100;
  const aboveAskPercent = (aboveAsk / deltas.length) * 100;
  const atAskPercent = (atAsk / deltas.length) * 100;
  
  // Determine market signal
  let marketSignal: PriceDeltaStats['marketSignal'];
  
  if (averageDelta < -2) {
    // Selling significantly below ask = Buyer's Market
    marketSignal = 'Buyer\'s Market';
  } else if (averageDelta > 2) {
    // Selling significantly above ask = Seller's Market
    marketSignal = 'Seller\'s Market';
  } else {
    // Close to ask price = Balanced Market
    marketSignal = 'Balanced Market';
  }
  
  // Format range string
  const range = `${formatDelta(minDelta)} to ${formatDelta(maxDelta)}`;
  
  return {
    averageDelta,
    medianDelta,
    minDelta,
    maxDelta,
    range,
    marketSignal,
    sampleSize: deltas.length,
    belowAskPercent,
    aboveAskPercent,
    atAskPercent,
  };
}

/**
 * Format delta as percentage string with sign
 * 
 * @param delta Number to format
 * @returns Formatted string (e.g., "-2.3%", "+5.1%", "0%")
 */
export function formatDelta(delta: number): string {
  if (delta === 0) {
    return '0%';
  }
  
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

/**
 * Get interpretation text for price delta
 * 
 * @param stats Price delta statistics
 * @returns Human-readable interpretation
 */
export function interpretPriceDelta(stats: PriceDeltaStats): string {
  const { averageDelta, marketSignal, belowAskPercent } = stats;
  
  if (marketSignal === 'Buyer\'s Market') {
    return `Properties selling ${formatDelta(averageDelta)} below ask on average. ${belowAskPercent.toFixed(0)}% of sales below asking price.`;
  } else if (marketSignal === 'Seller\'s Market') {
    return `Properties selling ${formatDelta(averageDelta)} above ask on average. Strong seller demand.`;
  } else {
    return `Properties selling close to asking price. Balanced market conditions.`;
  }
}

/**
 * Get market strength indicator (0-100 scale)
 * Higher = stronger seller's market
 * Lower = stronger buyer's market
 * 
 * @param stats Price delta statistics
 * @returns Market strength score (0-100)
 */
export function getMarketStrength(stats: PriceDeltaStats): number {
  const { averageDelta } = stats;
  
  // Map -10% to +10% range to 0-100 scale
  // -10% or below = 0 (extreme buyer's market)
  // 0% = 50 (balanced)
  // +10% or above = 100 (extreme seller's market)
  
  const normalized = ((averageDelta + 10) / 20) * 100;
  return Math.max(0, Math.min(100, normalized));
}
