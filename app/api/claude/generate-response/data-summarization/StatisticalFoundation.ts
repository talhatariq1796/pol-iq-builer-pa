/**
 * Statistical Foundation Generator
 * 
 * Creates consistent statistical foundation that all analysis types receive
 * to replace full feature enumeration and prevent 413 errors.
 */

interface FeatureProperties {
  properties?: Record<string, any>;
  [key: string]: any;
}

interface StatisticalMetrics {
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  quartiles: [number, number, number]; // Q1, Q2, Q3
  count: number;
}

interface DistributionAnalysis {
  type: 'normal' | 'skewed' | 'bimodal' | 'uniform';
  skewness?: number;
  kurtosis?: number;
}

interface GeographicCoverage {
  totalRegions: number;
  uniqueStates?: number;
  coverageType: string;
  hasDescriptions: boolean;
}

/**
 * Extract numeric values from features for statistical analysis
 */
function extractNumericValues(features: FeatureProperties[], fieldName: string): number[] {
  const values: number[] = [];
  
  for (const feature of features) {
    const properties = feature.properties || feature;
    const value = properties[fieldName];
    
    if (typeof value === 'number' && !isNaN(value)) {
      values.push(value);
    }
  }
  
  return values;
}

/**
 * Calculate comprehensive statistical metrics
 */
function calculateStatistics(values: number[]): StatisticalMetrics {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      standardDeviation: 0,
      quartiles: [0, 0, 0],
      count: 0
    };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  
  // Basic metrics
  const min = sorted[0];
  const max = sorted[count - 1];
  const mean = values.reduce((sum, val) => sum + val, 0) / count;
  
  // Median
  const median = count % 2 === 0 
    ? (sorted[Math.floor(count / 2) - 1] + sorted[Math.floor(count / 2)]) / 2
    : sorted[Math.floor(count / 2)];
  
  // Quartiles
  const q1Index = Math.floor(count * 0.25);
  const q2Index = Math.floor(count * 0.5);
  const q3Index = Math.floor(count * 0.75);
  
  const quartiles: [number, number, number] = [
    sorted[q1Index],
    sorted[q2Index], 
    sorted[q3Index]
  ];
  
  // Standard deviation
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
  const standardDeviation = Math.sqrt(variance);
  
  return {
    min,
    max,
    mean,
    median,
    standardDeviation,
    quartiles,
    count
  };
}

/**
 * Analyze distribution characteristics
 */
function analyzeDistribution(values: number[]): DistributionAnalysis {
  if (values.length < 3) {
    return { type: 'uniform' };
  }
  
  const stats = calculateStatistics(values);
  const { mean, median, standardDeviation, count } = stats;
  
  // Calculate skewness using Pearson's coefficient
  const skewness = (3 * (mean - median)) / standardDeviation;
  
  // Calculate kurtosis (simplified)
  const variance = standardDeviation * standardDeviation;
  const fourthMoment = values.reduce((sum, val) => 
    sum + Math.pow(val - mean, 4), 0) / count;
  const kurtosis = fourthMoment / (variance * variance) - 3;
  
  // Classify distribution
  let type: 'normal' | 'skewed' | 'bimodal' | 'uniform';
  
  if (Math.abs(skewness) < 0.5) {
    type = 'normal';
  } else {
    type = 'skewed';
  }
  
  // Check for bimodal (simplified heuristic)
  if (Math.abs(kurtosis) > 2) {
    type = 'bimodal';
  }
  
  return {
    type,
    skewness: Math.abs(skewness) > 0.1 ? skewness : undefined,
    kurtosis: Math.abs(kurtosis) > 0.5 ? kurtosis : undefined
  };
}

/**
 * Analyze geographic coverage characteristics
 */
function analyzeGeographicCoverage(features: FeatureProperties[]): GeographicCoverage {
  const descriptions = new Set<string>();
  const states = new Set<string>();
  let hasDescriptions = false;
  
  for (const feature of features) {
    const properties = feature.properties || feature;
    
    // Check for description field
    const description = properties.DESCRIPTION || properties.description || properties.name;
    if (description && typeof description === 'string') {
      descriptions.add(description);
      hasDescriptions = true;
      
      // Extract state information if available
      const stateMatch = description.match(/\b([A-Z]{2})\b/);
      if (stateMatch) {
        states.add(stateMatch[1]);
      }
    }
    
    // Check for direct state field
    const state = properties.STATE || properties.state;
    if (state && typeof state === 'string') {
      states.add(state);
    }
  }
  
  // Determine coverage type
  let coverageType = 'Unknown';
  if (features.length < 100) {
    coverageType = 'Limited Regional';
  } else if (features.length < 1000) {
    coverageType = 'Metropolitan Area';
  } else if (features.length < 5000) {
    coverageType = 'Multi-State Region';
  } else {
    coverageType = 'National Coverage';
  }
  
  return {
    totalRegions: features.length,
    uniqueStates: states.size > 0 ? states.size : undefined,
    coverageType,
    hasDescriptions
  };
}

/**
 * Get human-readable field name (placeholder - should match existing utility)
 */
function getHumanReadableFieldName(fieldName: string): string {
  // This should match the existing getHumanReadableFieldName function
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Score$/, ' Score');
}

/**
 * Create comprehensive statistical foundation summary
 */
export function createStatisticalFoundation(
  features: FeatureProperties[], 
  primaryField: string,
  layerName: string
): string {
  if (!features || features.length === 0) {
    return `\n=== ${layerName.toUpperCase()} STATISTICAL FOUNDATION ===\nNo data available for analysis.\n\n`;
  }
  
  const values = extractNumericValues(features, primaryField);
  
  if (values.length === 0) {
    return `\n=== ${layerName.toUpperCase()} STATISTICAL FOUNDATION ===\nNo valid numeric data found for field: ${getHumanReadableFieldName(primaryField)}\n\n`;
  }
  
  const stats = calculateStatistics(values);
  const distribution = analyzeDistribution(values);
  const geographic = analyzeGeographicCoverage(features);
  
  const fieldDisplayName = getHumanReadableFieldName(primaryField);
  
  let summary = `\n=== ${layerName.toUpperCase()} STATISTICAL FOUNDATION ===\n`;
  summary += `Dataset: ${features.length} total features analyzed\n`;
  summary += `Field: ${fieldDisplayName}\n`;
  summary += `Valid Values: ${stats.count} (${((stats.count / features.length) * 100).toFixed(1)}% coverage)\n\n`;
  
  summary += `Statistical Overview:\n`;
  summary += `- Range: ${stats.min.toFixed(2)} to ${stats.max.toFixed(2)}\n`;
  summary += `- Mean: ${stats.mean.toFixed(2)}\n`;
  summary += `- Median: ${stats.median.toFixed(2)}\n`;
  summary += `- Standard Deviation: ${stats.standardDeviation.toFixed(2)}\n`;
  summary += `- Quartiles: Q1=${stats.quartiles[0].toFixed(2)}, Q2=${stats.quartiles[1].toFixed(2)}, Q3=${stats.quartiles[2].toFixed(2)}\n`;
  
  summary += `- Distribution: ${distribution.type}`;
  if (distribution.skewness !== undefined) {
    summary += ` (skewness: ${distribution.skewness.toFixed(2)})`;
  }
  if (distribution.kurtosis !== undefined) {
    summary += ` (kurtosis: ${distribution.kurtosis.toFixed(2)})`;
  }
  summary += `\n\n`;
  
  summary += `Geographic Coverage:\n`;
  summary += `- Total Regions: ${geographic.totalRegions}\n`;
  summary += `- Coverage Type: ${geographic.coverageType}\n`;
  if (geographic.uniqueStates) {
    summary += `- States Covered: ${geographic.uniqueStates}\n`;
  }
  if (geographic.hasDescriptions) {
    summary += `- Named Regions: Available\n`;
  }
  summary += `\n`;
  
  return summary;
}

// Export utility functions for use by analysis-specific processors
export {
  extractNumericValues,
  calculateStatistics,
  analyzeDistribution,
  analyzeGeographicCoverage,
  getHumanReadableFieldName
};

export type {
  FeatureProperties,
  StatisticalMetrics,
  DistributionAnalysis,
  GeographicCoverage
};