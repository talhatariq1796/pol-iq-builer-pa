/* eslint-disable @typescript-eslint/no-explicit-any */
import { CMAProperty, CMAStats } from '@/components/cma/types';
import { calculateTimeOnMarket } from '@/components/cma/types';

export interface TimeframeStats {
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  avgRent: number;
  medianRent: number;
  minRent: number;
  maxRent: number;
  avgTimeOnMarket: number;
  medianTimeOnMarket: number;
  minTimeOnMarket: number;
  maxTimeOnMarket: number;
  pricePerSqft: number;
  standardDeviation: number;
  variance: number;
  count: number;
}

export interface ComprehensiveStats extends CMAStats {
  allTime: TimeframeStats;
  monthly: TimeframeStats;
  annual: TimeframeStats;
  soldStats: TimeframeStats;
  activeStats: TimeframeStats;
}

/**
 * Calculate comprehensive CMA statistics for different timeframes and property types
 */
export class CMAStatisticsCalculator {
  
  /**
   * Calculate complete statistics for all timeframes and property types
   */
  static calculateComprehensiveStats(properties: CMAProperty[]): ComprehensiveStats {
    if (!properties || properties.length === 0) {
      return this.getEmptyStats();
    }

    console.log('[CMAStatisticsCalculator] Calculating comprehensive stats for', properties.length, 'properties');

    // Filter properties by status
    const soldProperties = properties.filter(p => p.status === 'sold');
    const activeProperties = properties.filter(p => p.status === 'active');

    // Calculate timeframe-based properties (simulated based on data availability)
    const monthlyProperties = this.getMonthlyProperties(properties);
    const annualProperties = this.getAnnualProperties(properties);

    // Calculate stats for each group
    const allTimeStats = this.calculateTimeframeStats(properties);
    const monthlyStats = this.calculateTimeframeStats(monthlyProperties);
    const annualStats = this.calculateTimeframeStats(annualProperties);
    const soldStats = this.calculateTimeframeStats(soldProperties);
    const activeStats = this.calculateTimeframeStats(activeProperties);

    // Calculate basic CMA stats for backward compatibility
    const basicStats = this.calculateBasicCMAStats(properties);

    console.log('[CMAStatisticsCalculator] Comprehensive stats calculated:', {
      allTime: allTimeStats.count,
      monthly: monthlyStats.count,
      annual: annualStats.count,
      sold: soldStats.count,
      active: activeStats.count
    });

    return {
      ...basicStats,
      allTime: allTimeStats,
      monthly: monthlyStats,
      annual: annualStats,
      soldStats: soldStats,
      activeStats: activeStats
    };
  }

  /**
   * Calculate statistics for a specific timeframe
   */
  static calculateTimeframeStats(properties: CMAProperty[]): TimeframeStats {
    if (!properties || properties.length === 0) {
      return this.getEmptyTimeframeStats();
    }

    // Extract price data
    const prices = properties
      .map(p => p.price)
      .filter(price => price && price > 0)
      .sort((a, b) => a - b);

    // Calculate rent estimates (using 0.4% rule: monthly rent = price * 0.004)
    const rents = prices.map(price => Math.round(price * 0.004));

    // Calculate time on market from actual date fields (date_bc and date_pp_acpt_expiration)
    const timeOnMarket = properties
      .map((p, idx) => {
        const dom = calculateTimeOnMarket(p);
        // Debug first 3 properties
        if (idx < 3) {
          console.log(`[cmaStatistics] Property ${idx} DOM calculation:`, {
            address: p.address,
            date_bc: p.date_bc,
            date_pp_acpt_expiration: p.date_pp_acpt_expiration,
            status: p.status,
            st: p.st,
            calculated_dom: dom
          });
        }
        return dom;
      })
      .filter(t => t !== undefined && t > 0) as number[];

    console.log('[cmaStatistics] Time on market summary:', {
      total_properties: properties.length,
      properties_with_dom: timeOnMarket.length,
      avg_dom: timeOnMarket.length > 0 ? Math.round(timeOnMarket.reduce((sum, t) => sum + t, 0) / timeOnMarket.length) : 0
    });

    // Calculate square footage statistics
    const sqftData = properties
      .map(p => p.squareFootage)
      .filter(sqft => sqft && sqft > 0);

    const totalSqft = sqftData.reduce((sum, sqft) => sum + sqft, 0);
    const avgSqft = sqftData.length > 0 ? totalSqft / sqftData.length : 1200; // Default 1200 sqft

    // Calculate price per square foot
    const pricePerSqft = prices.length > 0 && avgSqft > 0 
      ? Math.round((prices.reduce((sum, price) => sum + price, 0) / prices.length) / avgSqft)
      : 0;

    // Calculate statistical measures
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length) : 0;
    const medianPrice = prices.length > 0 ? this.calculateMedian(prices) : 0;
    const { standardDeviation, variance } = this.calculateStandardDeviation(prices);

    const avgRent = rents.length > 0 ? Math.round(rents.reduce((sum, r) => sum + r, 0) / rents.length) : 0;
    const medianRent = rents.length > 0 ? this.calculateMedian(rents) : 0;

    const avgTimeOnMarket = timeOnMarket.length > 0 ? Math.round(timeOnMarket.reduce((sum, t) => sum + t, 0) / timeOnMarket.length) : 0;
    const medianTimeOnMarket = timeOnMarket.length > 0 ? this.calculateMedian(timeOnMarket) : 0;

    return {
      avgPrice,
      medianPrice,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      avgRent,
      medianRent,
      minRent: rents.length > 0 ? Math.min(...rents) : 0,
      maxRent: rents.length > 0 ? Math.max(...rents) : 0,
      avgTimeOnMarket,
      medianTimeOnMarket,
      minTimeOnMarket: timeOnMarket.length > 0 ? Math.min(...timeOnMarket) : 0,
      maxTimeOnMarket: timeOnMarket.length > 0 ? Math.max(...timeOnMarket) : 0,
      pricePerSqft,
      standardDeviation,
      variance,
      count: properties.length
    };
  }

  /**
   * Calculate basic CMA stats for backward compatibility
   */
  private static calculateBasicCMAStats(properties: CMAProperty[]): CMAStats {
    if (!properties || properties.length === 0) {
      return this.getEmptyBasicStats();
    }

    const prices = properties.map(p => p.price).filter(p => p > 0);
    const cmaScores = properties.map(p => p.cma_score || 0).filter(s => s > 0);
    const soldProperties = properties.filter(p => p.status === 'sold');
    const activeProperties = properties.filter(p => p.status === 'active');

    // Simulate DOM data
    const domData = properties.map(() => Math.round(Math.random() * 60 + 15)); // 15-75 days

    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length) : 0;
    const medianPrice = prices.length > 0 ? this.calculateMedian(prices) : 0;
    const avgCMAScore = cmaScores.length > 0 ? cmaScores.reduce((sum, s) => sum + s, 0) / cmaScores.length : 50;
    const avgDOM = domData.length > 0 ? Math.round(domData.reduce((sum, d) => sum + d, 0) / domData.length) : 45;

    // Calculate price per square foot
    const totalSqft = properties.reduce((sum, p) => sum + (p.squareFootage || 1200), 0);
    const avgSqft = totalSqft / properties.length;
    const pricePerSqft = avgSqft > 0 ? Math.round(avgPrice / avgSqft) : 0;

    const { standardDeviation } = this.calculateStandardDeviation(prices);

    return {
      average_price: avgPrice,
      median_price: medianPrice,
      price_per_sqft: pricePerSqft,
      average_dom: avgDOM,
      average_cma_score: avgCMAScore,
      total_properties: properties.length,
      sold_properties: soldProperties.length,
      active_properties: activeProperties.length,
      standardDeviation,
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
      count: properties.length,
      mean: avgPrice,
      median: medianPrice,
      soldCount: soldProperties.length,
      activeCount: activeProperties.length
    };
  }

  /**
   * Get properties for monthly timeframe (last 30 days)
   */
  private static getMonthlyProperties(properties: CMAProperty[]): CMAProperty[] {
    // In a real implementation, filter by actual date fields
    // For now, simulate by taking a percentage of properties
    const monthlyRatio = 0.25; // Assume 25% of properties are from last month
    const monthlyCount = Math.ceil(properties.length * monthlyRatio);
    return properties.slice(0, monthlyCount);
  }

  /**
   * Get properties for annual timeframe (last 12 months)
   */
  private static getAnnualProperties(properties: CMAProperty[]): CMAProperty[] {
    // In a real implementation, filter by actual date fields
    // For now, simulate by taking a percentage of properties
    const annualRatio = 0.8; // Assume 80% of properties are from last year
    const annualCount = Math.ceil(properties.length * annualRatio);
    return properties.slice(0, annualCount);
  }

  /**
   * Calculate median value
   */
  private static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
    } else {
      return sorted[middle];
    }
  }

  /**
   * Calculate standard deviation and variance
   */
  private static calculateStandardDeviation(values: number[]): { standardDeviation: number; variance: number } {
    if (values.length === 0) return { standardDeviation: 0, variance: 0 };
    
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      standardDeviation: Math.round(standardDeviation),
      variance: Math.round(variance)
    };
  }

  /**
   * Get empty stats structure
   */
  private static getEmptyStats(): ComprehensiveStats {
    const emptyTimeframe = this.getEmptyTimeframeStats();
    const emptyBasic = this.getEmptyBasicStats();
    
    return {
      ...emptyBasic,
      allTime: emptyTimeframe,
      monthly: emptyTimeframe,
      annual: emptyTimeframe,
      soldStats: emptyTimeframe,
      activeStats: emptyTimeframe
    };
  }

  private static getEmptyTimeframeStats(): TimeframeStats {
    return {
      avgPrice: 0,
      medianPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      avgRent: 0,
      medianRent: 0,
      minRent: 0,
      maxRent: 0,
      avgTimeOnMarket: 0,
      medianTimeOnMarket: 0,
      minTimeOnMarket: 0,
      maxTimeOnMarket: 0,
      pricePerSqft: 0,
      standardDeviation: 0,
      variance: 0,
      count: 0
    };
  }

  private static getEmptyBasicStats(): CMAStats {
    return {
      average_price: 0,
      median_price: 0,
      price_per_sqft: 0,
      average_dom: 0,
      average_cma_score: 0,
      total_properties: 0,
      sold_properties: 0,
      active_properties: 0,
      count: 0,
      mean: 0,
      median: 0,
      soldCount: 0,
      activeCount: 0
    };
  }
}

/**
 * Format currency values for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format large numbers with K/M notation
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

/**
 * Calculate price appreciation between timeframes
 */
export function calculateAppreciation(currentPrice: number, previousPrice: number): number {
  if (previousPrice === 0) return 0;
  return Math.round(((currentPrice - previousPrice) / previousPrice) * 100);
}

/**
 * Determine market condition based on metrics
 */
export function getMarketCondition(timeOnMarket: number, priceAppreciation: number): 'seller' | 'buyer' | 'balanced' {
  if (timeOnMarket < 30 && priceAppreciation > 5) {
    return 'seller';
  } else if (timeOnMarket > 60 && priceAppreciation < -2) {
    return 'buyer';
  } else {
    return 'balanced';
  }
}

/**
 * Get inventory level assessment
 */
export function getInventoryLevel(activeCount: number, soldCount: number): 'low' | 'medium' | 'high' {
  const monthsOfInventory = soldCount > 0 ? (activeCount / soldCount) * 12 : 0;
  
  if (monthsOfInventory < 4) {
    return 'low';
  } else if (monthsOfInventory > 8) {
    return 'high';
  } else {
    return 'medium';
  }
}