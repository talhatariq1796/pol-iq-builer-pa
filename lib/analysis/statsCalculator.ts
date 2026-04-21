/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Statistics Calculator for Progressive Analysis
 * Provides fast statistical computations for immediate user feedback
 */

import { analysisFeatures } from './analysisLens';


// Shared function to extract score from various field names
function extractScore(record: any): number {
  // Check for all known score field names used by different processors
  // Listed in priority order based on specificity
  
  // Analysis-specific scores (highest priority)
  if (record.brand_difference_score !== undefined) return record.brand_difference_score;
  if (record.anomaly_detection_score !== undefined) return record.anomaly_detection_score;
  if (record.brand_analysis_score !== undefined) return record.brand_analysis_score;
  if (record.cluster_performance_score !== undefined) return record.cluster_performance_score;
  if (record.comparison_score !== undefined) return record.comparison_score;
  if (record.correlation_strength_score !== undefined) return record.correlation_strength_score;
  if (record.customer_profile_score !== undefined) return record.customer_profile_score;
  if (record.demographic_opportunity_score !== undefined) return record.demographic_opportunity_score;
  if (record.expansion_opportunity_score !== undefined) return record.expansion_opportunity_score;
  if (record.feature_interaction_score !== undefined) return record.feature_interaction_score;
  if (record.market_sizing_score !== undefined) return record.market_sizing_score;
  if (record.outlier_detection_score !== undefined) return record.outlier_detection_score;
  if (record.predictive_modeling_score !== undefined) return record.predictive_modeling_score;
  if (record.real_estate_analysis_score !== undefined) return record.real_estate_analysis_score;
  if (record.risk_adjusted_score !== undefined) return record.risk_adjusted_score;
  if (record.scenario_analysis_score !== undefined) return record.scenario_analysis_score;
  if (record.trend_strength_score !== undefined) return record.trend_strength_score;
  if (record.trend_strength !== undefined) return record.trend_strength;
  
  // Generic scores (medium priority)
  if (record.strategic_score !== undefined) return record.strategic_score;
  if (record.strategic_value_score !== undefined) return record.strategic_value_score;
  if (record.competitive_advantage_score !== undefined) return record.competitive_advantage_score;
  
  // Fallback to generic fields
  return record.score || 
         record.demographic_score ||
         record.value ||
         0;
}

export interface BasicStats {
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  min: { area: string; score: number };
  max: { area: string; score: number };
  top5: Array<{ area: string; score: number }>;
  bottom5: Array<{ area: string; score: number }>;
  coverage?: {
    totalArea?: number;
    totalPopulation?: number;
  };
}

export interface Distribution {
  quartiles: { q1: number; q2: number; q3: number };
  iqr: number;
  outliers: Array<{ area: string; score: number; type: 'high' | 'low' }>;
  shape: 'normal' | 'skewed-left' | 'skewed-right' | 'bimodal' | 'uniform';
  buckets: Array<{
    range: string;
    min: number;
    max: number;
    count: number;
    percentage: number;
    areas: string[];
  }>;
}

export interface Patterns {
  clusters: Array<{
    name: string;
    size: number;
    avgScore: number;
    characteristics: string[];
  }>;
  correlations: Array<{
    factor: string;
    correlation: number;
    significance: 'strong' | 'moderate' | 'weak';
  }>;
  trends: Array<{
    pattern: string;
    strength: 'strong' | 'moderate' | 'weak';
    areas: string[];
  }>;
}

/**
 * Calculate basic statistics from analysis records
 */
export function calculateBasicStats(data: any[]): BasicStats {
  if (!data || data.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      min: { area: 'N/A', score: 0 },
      max: { area: 'N/A', score: 0 },
      top5: [],
      bottom5: [],
      coverage: {}
    };
  }

  // Filter out national parks from analysis
  const originalCount = data.length;
  const filteredData = analysisFeatures(data);
  
  if (filteredData.length !== originalCount) {
    const filteredCount = originalCount - filteredData.length;
    console.log(`[calculateBasicStats] Filtered out ${filteredCount} national parks from statistics (${originalCount} -> ${filteredData.length})`);
  }
  
  if (filteredData.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      min: { area: 'N/A', score: 0 },
      max: { area: 'N/A', score: 0 },
      top5: [],
      bottom5: [],
      coverage: {}
    };
  }
  
  // Use filtered data for all calculations
  data = filteredData;

  // Use shared score extraction function
  const getScore = extractScore;

  const getAreaName = (record: any): string => {
    return record.area_name || 
           record.area_id || 
           record.name ||
           record.properties?.area_name ||
           record.properties?.area_id ||
           'Unknown';
  };

  // Sort data by score descending
  const sorted = [...data].sort((a, b) => getScore(b) - getScore(a));
  
  // Calculate statistics
  const count = data.length;
  const scores = sorted.map(d => getScore(d));
  const mean = scores.reduce((a, b) => a + b, 0) / count;
  
  // Median
  const median = count % 2 === 0
    ? (scores[Math.floor(count / 2) - 1] + scores[Math.floor(count / 2)]) / 2
    : scores[Math.floor(count / 2)];
  
  // Standard deviation
  const variance = scores.reduce((acc, val) => 
    acc + Math.pow(val - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  
  // Min/Max
  const minRecord = sorted[count - 1];
  const maxRecord = sorted[0];
  
  // Calculate coverage if available
  const coverage: any = {};
  if (data[0]?.properties?.total_population !== undefined) {
    coverage.totalPopulation = data.reduce((sum, d) => 
      sum + (d.properties?.total_population || 0), 0);
  }
  if (data[0]?.properties?.area_sqmi !== undefined) {
    coverage.totalArea = data.reduce((sum, d) => 
      sum + (d.properties?.area_sqmi || 0), 0);
  }
  
  return {
    count,
    mean,
    median,
    stdDev,
    min: { 
      area: getAreaName(minRecord), 
      score: getScore(minRecord) 
    },
    max: { 
      area: getAreaName(maxRecord), 
      score: getScore(maxRecord) 
    },
    top5: sorted.slice(0, Math.min(5, count)).map(d => ({ 
      area: getAreaName(d), 
      score: getScore(d) 
    })),
    bottom5: sorted.slice(-Math.min(5, count)).reverse().map(d => ({ 
      area: getAreaName(d), 
      score: getScore(d) 
    })),
    coverage
  };
}

/**
 * Calculate distribution analysis
 */
export function calculateDistribution(data: any[]): Distribution {
  if (!data || data.length === 0) {
    return {
      quartiles: { q1: 0, q2: 0, q3: 0 },
      iqr: 0,
      outliers: [],
      shape: 'uniform',
      buckets: []
    };
  }

  // Filter out national parks from analysis
  const filteredData = analysisFeatures(data);
  
  if (filteredData.length === 0) {
    return {
      quartiles: { q1: 0, q2: 0, q3: 0 },
      iqr: 0,
      outliers: [],
      shape: 'uniform',
      buckets: []
    };
  }
  
  // Use filtered data for all calculations
  data = filteredData;
  const getScore = extractScore;

  const getAreaName = (record: any): string => {
    return record.area_name || 
           record.area_id || 
           record.name ||
           record.properties?.area_name ||
           record.properties?.area_id ||
           'Unknown';
  };

  const sorted = [...data].sort((a, b) => getScore(a) - getScore(b));
  const n = sorted.length;
  const scores = sorted.map(d => getScore(d));
  
  // Calculate quartiles
  const q1Index = Math.floor(n * 0.25);
  const q2Index = Math.floor(n * 0.50);
  const q3Index = Math.floor(n * 0.75);
  
  const q1 = scores[q1Index];
  const q2 = scores[q2Index];
  const q3 = scores[q3Index];
  const iqr = q3 - q1;
  
  // Find outliers (1.5 * IQR rule)
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const outliers = data
    .filter(d => {
      const score = getScore(d);
      return score < lowerBound || score > upperBound;
    })
    .map(d => ({
      area: getAreaName(d),
      score: getScore(d),
      type: getScore(d) > upperBound ? 'high' : 'low' as 'high' | 'low'
    }));
  
  // Determine distribution shape
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const skewness = calculateSkewness(scores, mean, stdDev(scores));
  
  let shape: Distribution['shape'] = 'normal';
  if (Math.abs(skewness) < 0.5) {
    shape = 'normal';
  } else if (skewness > 0.5) {
    shape = 'skewed-right';
  } else if (skewness < -0.5) {
    shape = 'skewed-left';
  }
  
  // Check for bimodal
  if (detectBimodal(scores)) {
    shape = 'bimodal';
  }
  
  // Create score buckets
  const bucketDefs = [
    { min: 90, max: 100, label: 'Exceptional (90-100)' },
    { min: 80, max: 90, label: 'High (80-90)' },
    { min: 70, max: 80, label: 'Above Average (70-80)' },
    { min: 60, max: 70, label: 'Average (60-70)' },
    { min: 50, max: 60, label: 'Below Average (50-60)' },
    { min: 0, max: 50, label: 'Low (0-50)' }
  ];
  
  const buckets = bucketDefs.map(bucket => {
    const items = data.filter(d => {
      const score = getScore(d);
      return score >= bucket.min && score < bucket.max;
    });
    
    return {
      range: bucket.label,
      min: bucket.min,
      max: bucket.max,
      count: items.length,
      percentage: (items.length / n) * 100,
      areas: items.slice(0, 3).map(d => getAreaName(d))
    };
  }).filter(b => b.count > 0);
  
  return {
    quartiles: { q1, q2, q3 },
    iqr,
    outliers,
    shape,
    buckets
  };
}

/**
 * Detect patterns in the data
 */
export function detectPatterns(data: any[]): Patterns {
  if (!data || data.length === 0) {
    return {
      clusters: [],
      correlations: [],
      trends: []
    };
  }

  // Filter out national parks from analysis
  const filteredData = analysisFeatures(data);
  
  if (filteredData.length === 0) {
    return {
      clusters: [],
      correlations: [],
      trends: []
    };
  }
  
  // Use filtered data for all calculations
  data = filteredData;

  // Simple clustering by score ranges
  const clusters = identifyClusters(data);
  
  // Find correlations with available factors
  const correlations = findCorrelations(data);
  
  // Identify trends
  const trends = identifyTrends(data);
  
  return { clusters, correlations, trends };
}

// Helper functions

function stdDev(scores: number[]): number {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((acc, val) => 
    acc + Math.pow(val - mean, 2), 0) / scores.length;
  return Math.sqrt(variance);
}

function calculateSkewness(scores: number[], mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  const n = scores.length;
  const sum = scores.reduce((acc, val) => 
    acc + Math.pow((val - mean) / stdDev, 3), 0);
  return sum / n;
}

function detectBimodal(scores: number[]): boolean {
  // Simple bimodal detection - check for two distinct peaks
  const histogram: { [key: number]: number } = {};
  scores.forEach(score => {
    const bucket = Math.floor(score);
    histogram[bucket] = (histogram[bucket] || 0) + 1;
  });
  
  const peaks = Object.entries(histogram)
    .filter(([_, count]) => count > scores.length * 0.1)
    .map(([bucket, _]) => parseInt(bucket));
  
  return peaks.length >= 2 && Math.abs(peaks[0] - peaks[1]) > 2;
}

function identifyClusters(data: any[]): Patterns['clusters'] {
  // Simple clustering by score ranges
  const high = data.filter(d => extractScore(d) >= 8);
  const medium = data.filter(d => extractScore(d) >= 6 && extractScore(d) < 8);
  const low = data.filter(d => extractScore(d) < 6);
  
  const clusters: Patterns['clusters'] = [];
  
  if (high.length > 0) {
    clusters.push({
      name: 'High Performers',
      size: high.length,
      avgScore: high.reduce((sum, d) => sum + extractScore(d), 0) / high.length,
      characteristics: ['Strong market position', 'High growth potential']
    });
  }
  
  if (medium.length > 0) {
    clusters.push({
      name: 'Steady Markets',
      size: medium.length,
      avgScore: medium.reduce((sum, d) => sum + extractScore(d), 0) / medium.length,
      characteristics: ['Stable performance', 'Moderate opportunity']
    });
  }
  
  if (low.length > 0) {
    clusters.push({
      name: 'Emerging Areas',
      size: low.length,
      avgScore: low.reduce((sum, d) => sum + extractScore(d), 0) / low.length,
      characteristics: ['Development potential', 'Higher risk']
    });
  }
  
  return clusters;
}

function findCorrelations(data: any[]): Patterns['correlations'] {
  const correlations: Patterns['correlations'] = [];
  
  if (data.length === 0) return correlations;
  
  const scores = data.map(d => extractScore(d)).filter(s => s > 0);
  if (scores.length === 0) return correlations;
  
  // Check multiple population field possibilities
  const populationFields = [
    'total_population',
    'population', 
    'pop_total',
    'POPULATION',
    'Total_Pop'
  ];
  
  for (const field of populationFields) {
    const hasField = data.some(d => 
      d.properties?.[field] !== undefined || 
      d[field] !== undefined
    );
    
    if (hasField) {
      const popValues = data.map(d => {
        const val = d.properties?.[field] || d[field] || 0;
        return typeof val === 'number' ? val : parseFloat(val) || 0;
      }).filter(v => v > 0);
      
      if (popValues.length > 1 && popValues.length === scores.length) {
        const popCorr = calculateCorrelation(scores, popValues);
        if (!isNaN(popCorr) && popCorr !== 0) {
          correlations.push({
            factor: 'Population Density',
            correlation: popCorr,
            significance: Math.abs(popCorr) > 0.7 ? 'strong' : 
                          Math.abs(popCorr) > 0.4 ? 'moderate' : 'weak'
          });
          break;
        }
      }
    }
  }
  
  // Check multiple income field possibilities
  const incomeFields = [
    'median_income',
    'income',
    'med_income', 
    'INCOME',
    'Median_Inc',
    'household_income'
  ];
  
  for (const field of incomeFields) {
    const hasField = data.some(d => 
      d.properties?.[field] !== undefined || 
      d[field] !== undefined
    );
    
    if (hasField) {
      const incomeValues = data.map(d => {
        const val = d.properties?.[field] || d[field] || 0;
        return typeof val === 'number' ? val : parseFloat(val) || 0;
      }).filter(v => v > 0);
      
      if (incomeValues.length > 1 && incomeValues.length === scores.length) {
        const incomeCorr = calculateCorrelation(scores, incomeValues);
        if (!isNaN(incomeCorr) && incomeCorr !== 0) {
          correlations.push({
            factor: 'Median Income',
            correlation: incomeCorr,
            significance: Math.abs(incomeCorr) > 0.7 ? 'strong' : 
                          Math.abs(incomeCorr) > 0.4 ? 'moderate' : 'weak'
          });
          break;
        }
      }
    }
  }
  
  // Only show correlations if real data relationships exist
  // Do not generate synthetic correlations as they are misleading without temporal data
  if (correlations.length === 0) {
    // No meaningful correlations available with current data
    return [];
  }
  
  return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;
  
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  
  if (denomX === 0 || denomY === 0) return 0;
  return numerator / Math.sqrt(denomX * denomY);
}

function identifyTrends(data: any[]): Patterns['trends'] {
  const trends: Patterns['trends'] = [];
  
  // Geographic concentration
  const geoConcentration = detectGeographicConcentration(data);
  if (geoConcentration) {
    trends.push(geoConcentration);
  }
  
  // Score clustering
  const scoreClustering = detectScoreClustering(data);
  if (scoreClustering) {
    trends.push(scoreClustering);
  }
  
  return trends;
}

function detectGeographicConcentration(data: any[]): Patterns['trends'][0] | null {
  // Simple geographic pattern detection
  const highScoreAreas = data
    .filter(d => (d.score || 0) >= 8)
    .map(d => d.area_name || d.area_id || 'Unknown');
  
  if (highScoreAreas.length >= 3) {
    return {
      pattern: 'Geographic Concentration',
      strength: highScoreAreas.length > 5 ? 'strong' : 'moderate',
      areas: highScoreAreas.slice(0, 5)
    };
  }
  
  return null;
}

function detectScoreClustering(data: any[]): Patterns['trends'][0] | null {
  const scores = data.map(d => d.score || 0);
  const stdDevValue = stdDev(scores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // Check for tight clustering
  if (stdDevValue < mean * 0.15) {
    return {
      pattern: 'Tight Score Clustering',
      strength: 'strong',
      areas: data.slice(0, 3).map(d => d.area_name || d.area_id || 'Unknown')
    };
  }
  
  return null;
}

/**
 * Format statistics for display in chat
 */
export function formatStatsForChat(stats: BasicStats, analysisType?: string, brandNames?: { brand1: string; brand2: string }, allData?: any[]): string {
  console.log(`[formatStatsForChat] Called with analysisType: "${analysisType}"`);
  
  // Use specialized formatter for brand difference analysis
  if (analysisType === 'brand_difference' || analysisType === 'brand-difference') {
    console.log(`[formatStatsForChat] Using brand difference formatter`);
    return formatBrandDifferenceStatsForChat(stats, brandNames, allData);
  }
  
  console.log(`[formatStatsForChat] Using generic formatter`);
  
  const lines: string[] = [];
  
  lines.push(`**Market Analysis Overview**`);
  lines.push(`• **${stats.count}** markets analyzed across the region`);
  lines.push(`• Average performance: **${stats.mean.toFixed(1)}/100** ${stats.mean >= 70 ? '(strong overall)' : stats.mean >= 50 ? '(moderate overall)' : '(developing overall)'}`);
  lines.push(`• Performance range: **${Math.abs(stats.max.score - stats.min.score).toFixed(1)} points** between highest and lowest markets`);
  lines.push(`• Market consistency: **${stats.stdDev.toFixed(1)}** std dev ${stats.stdDev > 20 ? '(highly variable)' : stats.stdDev > 10 ? '(moderately variable)' : '(consistent)'}`);
  
  if (stats.coverage?.totalPopulation) {
    lines.push(`• Population coverage: **${(stats.coverage.totalPopulation / 1000000).toFixed(1)}M** people`);
  }
  if (stats.coverage?.totalArea) {
    lines.push(`• Geographic coverage: **${stats.coverage.totalArea.toFixed(0)} sq mi**`);
  }
  
  lines.push('');
  
  // Strategic insights based on performance distribution
  const performanceInsights = [];
  if (allData && allData.length > 0) {
    const highPerformers = allData.filter(d => extractScore(d) >= 70).length;
    const moderatePerformers = allData.filter(d => extractScore(d) >= 50 && extractScore(d) < 70).length;
    const developingMarkets = allData.filter(d => extractScore(d) >= 30 && extractScore(d) < 50).length;
    
    lines.push(`**Strategic Insights:**`);
    
    if (highPerformers > 0) {
      performanceInsights.push(`**${highPerformers}** high-performing markets (70+ score)`);
    }
    if (moderatePerformers > 0) {
      performanceInsights.push(`**${moderatePerformers}** moderate-performing markets (50-70 score)`);
    }
    if (developingMarkets > 0) {
      performanceInsights.push(`**${developingMarkets}** developing markets (30-50 score)`);
    }
    
    if (performanceInsights.length > 0) {
      lines.push(`• Market distribution: ${performanceInsights.join(', ')}`);
    }
    
    // Performance pattern analysis
    if (stats.mean >= 60 && stats.stdDev < 15) {
      lines.push(`• **Strong Consistent Performance:** Most markets show solid results with minimal variation`);
    } else if (stats.mean >= 50 && stats.stdDev > 20) {
      lines.push(`• **Mixed Performance Pattern:** High variation suggests market-specific factors drive outcomes`);
    } else if (stats.mean < 40) {
      lines.push(`• **Development Opportunity:** Most markets show potential for improvement across key metrics`);
    } else {
      lines.push(`• **Balanced Market Landscape:** Performance varies significantly across different market conditions`);
    }
  } else {
    // Fallback when no allData is available - show key performers as examples
    if (stats.top5.length > 0) {
      lines.push(`**Market Leaders** (top examples): ${stats.top5.slice(0, 3).map(area => `${area.area} (${area.score.toFixed(1)})`).join(', ')}`);
    }
    if (stats.bottom5.length > 0) {
      lines.push(`**Development opportunities** (lower examples): ${stats.bottom5.slice(0, 2).map(area => `${area.area} (${area.score.toFixed(1)})`).join(', ')}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format brand difference statistics for display in chat
 */
export function formatBrandDifferenceStatsForChat(stats: BasicStats, brandNames?: { brand1: string; brand2: string }, allData?: any[]): string {
  const lines: string[] = [];
  
  // Use dynamic brand names if provided, otherwise use generic terms
  const brand1Name = brandNames?.brand1 || 'Brand A';
  const brand2Name = brandNames?.brand2 || 'Brand B';
  
  lines.push(`**Brand Competitive Analysis: ${brand1Name} vs ${brand2Name}**`);
  lines.push('');
  
  // Focus on analytical insights first
  lines.push(`**Overall Market Analysis:**`);
  lines.push(`• **${stats.count}** markets analyzed across the competitive landscape`);
  lines.push(`• Average brand difference: **${stats.mean.toFixed(2)}%** (${stats.mean > 0 ? brand1Name + ' leads' : brand2Name + ' leads'})`);
  lines.push(`• Competition intensity: **${stats.stdDev.toFixed(2)}%** standard deviation ${stats.stdDev > 15 ? '(highly variable)' : stats.stdDev > 8 ? '(moderately variable)' : '(consistent)'}`);
  lines.push(`• Market range: **${Math.abs(stats.max.score - stats.min.score).toFixed(1)}%** difference between most/least competitive markets`);
  
  if (stats.coverage?.totalPopulation) {
    lines.push(`• Total population coverage: **${(stats.coverage.totalPopulation / 1000000).toFixed(1)}M** people`);
  }
  
  lines.push('');
  
  // Analytical insights based on the data patterns
  const strongAdvantageThreshold = 5;
  const moderateAdvantageThreshold = 2;
  
  let marketAnalysis = '';
  if (Math.abs(stats.mean) > strongAdvantageThreshold) {
    marketAnalysis = `**Market Dominance Pattern:** ${stats.mean > 0 ? brand1Name : brand2Name} shows strong overall dominance with clear competitive advantages across most markets.`;
  } else if (Math.abs(stats.mean) > moderateAdvantageThreshold) {
    marketAnalysis = `**Market Leadership Pattern:** ${stats.mean > 0 ? brand1Name : brand2Name} maintains moderate leadership, but competition remains active across markets.`;
  } else {
    marketAnalysis = `**Balanced Competition:** Both brands compete closely with no clear overall dominance. Success likely depends on local market factors.`;
  }
  
  if (stats.stdDev > 15) {
    marketAnalysis += ` High variation suggests significant market-specific factors drive competitive outcomes.`;
  } else if (stats.stdDev > 8) {
    marketAnalysis += ` Moderate variation indicates some regional competitive differences.`;
  } else {
    marketAnalysis += ` Low variation suggests consistent competitive patterns across markets.`;
  }
  
  lines.push(`**Strategic Insights:**`);
  lines.push(marketAnalysis);
  lines.push('');
  
  // Distribution analysis
  const highAdvantageCount = allData?.filter(d => extractScore(d) > strongAdvantageThreshold).length || 0;
  const highDisadvantageCount = allData?.filter(d => extractScore(d) < -strongAdvantageThreshold).length || 0;
  const competitiveCount = allData?.filter(d => Math.abs(extractScore(d)) <= moderateAdvantageThreshold).length || 0;
  
  if (highAdvantageCount + highDisadvantageCount + competitiveCount > 0) {
    lines.push(`**Market Distribution:**`);
    if (highAdvantageCount > 0) {
      lines.push(`• **${highAdvantageCount}** markets where ${brand1Name} has strong advantages (>${strongAdvantageThreshold}%)`);
    }
    if (highDisadvantageCount > 0) {
      lines.push(`• **${highDisadvantageCount}** markets where ${brand2Name} has strong advantages (>${strongAdvantageThreshold}%)`);
    }
    if (competitiveCount > 0) {
      lines.push(`• **${competitiveCount}** highly competitive markets (within ±${moderateAdvantageThreshold}%)`);
    }
    lines.push('');
  }
  
  // Include key market examples to illustrate strategic insights
  if (allData && allData.length > 0) {
    lines.push(`**Key Market Examples** (illustrating strategic patterns):`);
    
    // Show 3-4 examples of each category to illustrate the insights
    const getAreaName = (record: any): string => {
      return record.area_name || record.area_id || record.name || 
             record.properties?.area_name || record.properties?.area_id || 'Unknown';
    };
    
    const sortedAreas = allData
      .map(d => ({ area: getAreaName(d), score: extractScore(d) }))
      .sort((a, b) => b.score - a.score);
    
    const topAdvantages = sortedAreas.filter(item => item.score > strongAdvantageThreshold).slice(0, 3);
    const bottomAdvantages = sortedAreas.filter(item => item.score < -strongAdvantageThreshold).slice(-3).reverse();
    const competitive = sortedAreas.filter(item => Math.abs(item.score) <= moderateAdvantageThreshold).slice(0, 2);
    
    if (topAdvantages.length > 0) {
      lines.push(`• **${brand1Name} strongholds:** ${topAdvantages.map(item => `${item.area} (+${item.score.toFixed(1)}%)`).join(', ')}`);
    }
    if (bottomAdvantages.length > 0) {
      lines.push(`• **${brand2Name} strongholds:** ${bottomAdvantages.map(item => `${item.area} (${item.score.toFixed(1)}%)`).join(', ')}`);
    }
    if (competitive.length > 0) {
      lines.push(`• **Competitive battlegrounds:** ${competitive.map(item => `${item.area} (${item.score >= 0 ? '+' : ''}${item.score.toFixed(1)}%)`).join(', ')}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format distribution for display in chat
 */
export function formatDistributionForChat(dist: Distribution, analysisType?: string, brandNames?: { brand1: string; brand2: string }): string {
  // Use specialized formatter for brand difference analysis
  if (analysisType === 'brand_difference' || analysisType === 'brand-difference') {
    console.log(`[formatDistributionForChat] Using brand difference distribution formatter`);
    return formatBrandDifferenceDistributionForChat(dist, brandNames);
  }
  
  console.log(`[formatDistributionForChat] Using generic distribution formatter`);
  
  const lines: string[] = [];
  
  lines.push(`**Distribution Analysis**`);
  lines.push('');
  lines.push(`**Quartiles:** Q1=**${dist.quartiles.q1.toFixed(2)}**, Q2=**${dist.quartiles.q2.toFixed(2)}**, Q3=**${dist.quartiles.q3.toFixed(2)}**`);
  lines.push(`**IQR:** **${dist.iqr.toFixed(2)}**`);
  
  if (dist.outliers.length > 0) {
    lines.push(`**Outliers:** **${dist.outliers.length}** detected`);
    dist.outliers.slice(0, 3).forEach(outlier => {
      lines.push(`  • **${outlier.area}**: **${outlier.score.toFixed(2)}** (${outlier.type})`);
    });
  } else {
    lines.push('**Outliers:** None detected');
  }
  
  lines.push(`**Distribution shape:** **${dist.shape}**`);
  
  return lines.join('\n');
}

/**
 * Format brand difference distribution for display in chat
 */
export function formatBrandDifferenceDistributionForChat(dist: Distribution, brandNames?: { brand1: string; brand2: string }): string {
  const lines: string[] = [];
  
  lines.push(`**Competitive Distribution Analysis**`);
  lines.push('');
  
  // Skip technical distribution details for brand difference
  // Focus on competitive landscape summary instead
  const brand1Name = brandNames?.brand1 || 'Brand A';
  const brand2Name = brandNames?.brand2 || 'Brand B';
  
  const avgDiff = (dist.quartiles.q1 + dist.quartiles.q2 + dist.quartiles.q3) / 3;
  if (avgDiff < -5) {
    lines.push(`**Competitive Landscape:** ${brand2Name} holds significant advantages across most markets`);
  } else if (avgDiff < -2) {
    lines.push(`**Competitive Landscape:** ${brand2Name} maintains moderate competitive leads`);
  } else if (avgDiff > 2) {
    lines.push(`**Competitive Landscape:** ${brand1Name} shows competitive strength`);
  } else {
    lines.push('**Competitive Landscape:** Highly competitive markets with mixed brand performance');
  }
  
  lines.push('');
  
  // Show meaningful competitive ranges instead of technical quartiles
  const competitiveSpread = dist.quartiles.q3 - dist.quartiles.q1;
  if (competitiveSpread > 5) {
    lines.push('**Market Variation:** High variability in competitive positioning across markets');
  } else if (competitiveSpread > 2) {
    lines.push('**Market Variation:** Moderate differences in brand performance by market');
  } else {
    lines.push('**Market Variation:** Consistent competitive landscape across markets');
  }
  
  return lines.join('\n');
}

/**
 * Format patterns for display in chat
 */
export function formatPatternsForChat(patterns: Patterns, analysisType?: string, brandNames?: { brand1: string; brand2: string }): string {
  console.log(`[formatPatternsForChat] Called with analysisType: "${analysisType}"`);
  
  // Use specialized formatter for brand difference analysis
  if (analysisType === 'brand_difference' || analysisType === 'brand-difference') {
    console.log(`[formatPatternsForChat] Using brand difference patterns formatter`);
    return formatBrandDifferencePatternsForChat(patterns, brandNames);
  }
  
  console.log(`[formatPatternsForChat] Using generic patterns formatter`);
  
  const lines: string[] = [];
  
  lines.push(`**Key Patterns**`);
  lines.push('');
  
  if (patterns.clusters.length > 0) {
    lines.push('**Market Clusters:**');
    patterns.clusters.forEach(cluster => {
      lines.push(`• **${cluster.name}**: **${cluster.size}** areas (avg: **${cluster.avgScore.toFixed(2)}**)`);
      if (cluster.characteristics.length > 0) {
        lines.push(`  - ${cluster.characteristics.join(', ')}`);
      }
    });
    lines.push('');
  }
  
  if (patterns.correlations.length > 0) {
    lines.push('**Key Correlations:**');
    patterns.correlations.slice(0, 3).forEach(corr => {
      const sign = corr.correlation > 0 ? '+' : '';
      lines.push(`• **${corr.factor}**: **${sign}${(corr.correlation * 100).toFixed(0)}%** (${corr.significance})`);
    });
    lines.push('');
  } else {
    lines.push('**Key Correlations:** Insufficient temporal data for meaningful correlation analysis');
    lines.push('');
  }
  
  if (patterns.trends.length > 0) {
    lines.push('**Emerging Trends:**');
    patterns.trends.forEach(trend => {
      lines.push(`• **${trend.pattern}** (${trend.strength})`);
      if (trend.areas.length > 0) {
        lines.push(`  Areas: ${trend.areas.slice(0, 3).join(', ')}`);
      }
    });
  }
  
  return lines.join('\n');
}

/**
 * Format brand difference patterns for display in chat
 */
export function formatBrandDifferencePatternsForChat(patterns: Patterns, brandNames?: { brand1: string; brand2: string }): string {
  const lines: string[] = [];
  
  lines.push(`**Competitive Patterns**`);
  lines.push('');
  
  // Skip market clusters for brand difference - not meaningful for competitive analysis
  
  const brand1Name = brandNames?.brand1 || 'Brand A';
  const brand2Name = brandNames?.brand2 || 'Brand B';
  
  if (patterns.correlations.length > 0) {
    lines.push('**Brand Success Drivers:**');
    patterns.correlations.slice(0, 5).forEach(corr => {
      const sign = corr.correlation > 0 ? '+' : '';
      const direction = corr.correlation > 0 ? `favors ${brand1Name}` : `favors ${brand2Name}`;
      lines.push(`• **${corr.factor}**: **${sign}${(corr.correlation * 100).toFixed(0)}%** correlation (${direction})`);
    });
    lines.push('');
  } else {
    lines.push('**Brand Success Drivers:** Correlations based on cross-sectional data - temporal analysis requires time-series data');
    lines.push('');
  }
  
  if (patterns.trends.length > 0) {
    lines.push('**Competitive Trends:**');
    patterns.trends.forEach(trend => {
      lines.push(`• **${trend.pattern}** (${trend.strength})`);
      if (trend.areas.length > 0) {
        lines.push(`  Key markets: ${trend.areas.slice(0, 3).join(', ')}`);
      }
    });
  }
  
  return lines.join('\n');
}