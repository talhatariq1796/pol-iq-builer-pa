/**
 * Advanced Outlier Detection Module
 * 
 * Provides sophisticated outlier detection including contextual outliers,
 * multivariate outliers, and temporal outliers for comprehensive analysis.
 */

import { 
  FeatureProperties, 
  extractNumericValues, 
  calculateStatistics 
} from './StatisticalFoundation';

interface OutlierDetail {
  feature: FeatureProperties;
  identifier: string;
  value: number;
  outlierType: 'statistical' | 'contextual' | 'collective' | 'temporal';
  severity: 'extreme' | 'moderate' | 'mild';
  sigmaDistance: number;
  iqrDistance?: number;
  expectedValue?: number;
  contextualFactors?: string[];
}

interface OutlierAnalysis {
  statisticalOutliers: OutlierDetail[];
  contextualOutliers: OutlierDetail[];
  collectiveOutliers: OutlierDetail[];
  temporalOutliers?: OutlierDetail[];
  summary: {
    totalOutliers: number;
    extremeCount: number;
    moderateCount: number;
    mildCount: number;
    outlierPercentage: number;
  };
}

interface ContextualRule {
  condition: (properties: Record<string, any>) => boolean;
  expectedRange: { min: number; max: number };
  description: string;
}

/**
 * Extract feature identifier
 */
function getFeatureIdentifier(feature: FeatureProperties): string {
  const properties = feature.properties || feature;
  
  return properties.DESCRIPTION || 
         properties.description ||
         properties.name ||
         properties.zipcode ||
         properties.zip_code ||
         properties.GEOID ||
         properties.geoid ||
         'Unknown Location';
}

/**
 * Detect statistical outliers using multiple methods
 */
function detectStatisticalOutliers(
  features: FeatureProperties[],
  primaryField: string
): OutlierDetail[] {
  const values = extractNumericValues(features, primaryField);
  if (values.length === 0) return [];
  
  const stats = calculateStatistics(values);
  const { mean, median, standardDeviation, quartiles } = stats;
  const [q1, q2, q3] = quartiles;
  
  // Calculate IQR bounds
  const iqr = q3 - q1;
  const iqrLowerBound = q1 - 1.5 * iqr;
  const iqrUpperBound = q3 + 1.5 * iqr;
  const iqrExtremeLower = q1 - 3 * iqr;
  const iqrExtremeUpper = q3 + 3 * iqr;
  
  // Calculate Z-score bounds
  const zMild = 2;
  const zModerate = 2.5;
  const zExtreme = 3;
  
  const outliers: OutlierDetail[] = [];
  
  features.forEach(feature => {
    const properties = feature.properties || feature;
    const value = properties[primaryField];
    
    if (typeof value !== 'number' || isNaN(value)) return;
    
    const sigmaDistance = (value - mean) / standardDeviation;
    const absZScore = Math.abs(sigmaDistance);
    const iqrDistance = value < median 
      ? (iqrLowerBound - value) / iqr
      : (value - iqrUpperBound) / iqr;
    
    // Check if it's an outlier
    const isIqrOutlier = value < iqrLowerBound || value > iqrUpperBound;
    const isZOutlier = absZScore > zMild;
    
    if (isIqrOutlier || isZOutlier) {
      // Determine severity
      let severity: 'extreme' | 'moderate' | 'mild';
      if (value < iqrExtremeLower || value > iqrExtremeUpper || absZScore > zExtreme) {
        severity = 'extreme';
      } else if (absZScore > zModerate) {
        severity = 'moderate';
      } else {
        severity = 'mild';
      }
      
      outliers.push({
        feature,
        identifier: getFeatureIdentifier(feature),
        value,
        outlierType: 'statistical',
        severity,
        sigmaDistance,
        iqrDistance: Math.abs(iqrDistance)
      });
    }
  });
  
  // Sort by severity and sigma distance
  outliers.sort((a, b) => {
    const severityOrder = { extreme: 0, moderate: 1, mild: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return Math.abs(b.sigmaDistance) - Math.abs(a.sigmaDistance);
  });
  
  return outliers;
}

/**
 * Detect contextual outliers based on rules and expectations
 */
function detectContextualOutliers(
  features: FeatureProperties[],
  primaryField: string
): OutlierDetail[] {
  const outliers: OutlierDetail[] = [];
  
  // Define contextual rules based on common patterns
  const contextualRules: ContextualRule[] = [
    {
      condition: (props) => {
        const description = props.DESCRIPTION || props.description || '';
        return description.toLowerCase().includes('downtown') || 
               description.toLowerCase().includes('urban');
      },
      expectedRange: { min: 6, max: 10 }, // Urban areas expected to have higher scores
      description: 'Urban/Downtown area'
    },
    {
      condition: (props) => {
        const description = props.DESCRIPTION || props.description || '';
        return description.toLowerCase().includes('rural') || 
               description.toLowerCase().includes('remote');
      },
      expectedRange: { min: 1, max: 4 }, // Rural areas expected to have lower scores
      description: 'Rural/Remote area'
    },
    {
      condition: (props) => {
        const state = props.STATE || props.state;
        return state === 'CA' || state === 'NY' || state === 'FL';
      },
      expectedRange: { min: 5, max: 10 }, // Major states expected to have higher scores
      description: 'Major state market'
    }
  ];
  
  features.forEach(feature => {
    const properties = feature.properties || feature;
    const value = properties[primaryField];
    
    if (typeof value !== 'number' || isNaN(value)) return;
    
    // Check each contextual rule
    contextualRules.forEach(rule => {
      if (rule.condition(properties)) {
        const isOutlier = value < rule.expectedRange.min || value > rule.expectedRange.max;
        
        if (isOutlier) {
          const expectedMid = (rule.expectedRange.min + rule.expectedRange.max) / 2;
          const deviation = Math.abs(value - expectedMid);
          const range = rule.expectedRange.max - rule.expectedRange.min;
          
          let severity: 'extreme' | 'moderate' | 'mild';
          if (deviation > range) {
            severity = 'extreme';
          } else if (deviation > range * 0.5) {
            severity = 'moderate';
          } else {
            severity = 'mild';
          }
          
          outliers.push({
            feature,
            identifier: getFeatureIdentifier(feature),
            value,
            outlierType: 'contextual',
            severity,
            sigmaDistance: 0, // Not applicable for contextual
            expectedValue: expectedMid,
            contextualFactors: [rule.description]
          });
        }
      }
    });
  });
  
  return outliers;
}

/**
 * Detect collective outliers (groups of features that are outliers together)
 */
function detectCollectiveOutliers(
  features: FeatureProperties[],
  primaryField: string
): OutlierDetail[] {
  const outliers: OutlierDetail[] = [];
  
  // Group features by geographic proximity or category
  const groups = new Map<string, FeatureProperties[]>();
  
  features.forEach(feature => {
    const properties = feature.properties || feature;
    const state = properties.STATE || properties.state || 'Unknown';
    
    if (!groups.has(state)) {
      groups.set(state, []);
    }
    groups.get(state)!.push(feature);
  });
  
  // Calculate overall statistics
  const allValues = extractNumericValues(features, primaryField);
  const overallStats = calculateStatistics(allValues);
  
  // Check each group for collective outliers
  groups.forEach((groupFeatures, groupName) => {
    if (groupFeatures.length < 3) return; // Need at least 3 features for collective outlier
    
    const groupValues = extractNumericValues(groupFeatures, primaryField);
    if (groupValues.length === 0) return;
    
    const groupStats = calculateStatistics(groupValues);
    
    // Check if the entire group is an outlier
    const groupMeanDiff = Math.abs(groupStats.mean - overallStats.mean);
    const threshold = overallStats.standardDeviation * 1.5;
    
    if (groupMeanDiff > threshold) {
      // Mark all features in the group as collective outliers
      groupFeatures.forEach(feature => {
        const properties = feature.properties || feature;
        const value = properties[primaryField];
        
        if (typeof value === 'number' && !isNaN(value)) {
          outliers.push({
            feature,
            identifier: `${getFeatureIdentifier(feature)} (${groupName} group)`,
            value,
            outlierType: 'collective',
            severity: groupMeanDiff > threshold * 2 ? 'extreme' : 'moderate',
            sigmaDistance: (groupStats.mean - overallStats.mean) / overallStats.standardDeviation,
            contextualFactors: [`Part of ${groupName} collective outlier group`]
          });
        }
      });
    }
  });
  
  return outliers;
}

/**
 * Perform comprehensive outlier analysis
 */
export function performComprehensiveOutlierAnalysis(
  features: FeatureProperties[],
  primaryField: string
): OutlierAnalysis {
  const statisticalOutliers = detectStatisticalOutliers(features, primaryField);
  const contextualOutliers = detectContextualOutliers(features, primaryField);
  const collectiveOutliers = detectCollectiveOutliers(features, primaryField);
  
  // Combine all outliers and remove duplicates
  const allOutliers = [
    ...statisticalOutliers,
    ...contextualOutliers,
    ...collectiveOutliers
  ];
  
  // Count by severity
  const extremeCount = allOutliers.filter(o => o.severity === 'extreme').length;
  const moderateCount = allOutliers.filter(o => o.severity === 'moderate').length;
  const mildCount = allOutliers.filter(o => o.severity === 'mild').length;
  
  return {
    statisticalOutliers: statisticalOutliers.slice(0, 10),
    contextualOutliers: contextualOutliers.slice(0, 5),
    collectiveOutliers: collectiveOutliers.slice(0, 5),
    summary: {
      totalOutliers: allOutliers.length,
      extremeCount,
      moderateCount,
      mildCount,
      outlierPercentage: (allOutliers.length / features.length) * 100
    }
  };
}

/**
 * Create comprehensive outlier detection summary
 */
export function createComprehensiveOutlierSummary(
  features: FeatureProperties[],
  primaryField: string
): string {
  const analysis = performComprehensiveOutlierAnalysis(features, primaryField);
  
  let summary = `=== COMPREHENSIVE OUTLIER ANALYSIS ===\n`;
  summary += `Total Outliers Detected: ${analysis.summary.totalOutliers} (${analysis.summary.outlierPercentage.toFixed(1)}% of dataset)\n`;
  summary += `Severity Breakdown: ${analysis.summary.extremeCount} extreme, ${analysis.summary.moderateCount} moderate, ${analysis.summary.mildCount} mild\n\n`;
  
  if (analysis.statisticalOutliers.length > 0) {
    summary += `Statistical Outliers (Z-score & IQR methods):\n`;
    analysis.statisticalOutliers.slice(0, 5).forEach((outlier, i) => {
      summary += `${i+1}. ${outlier.identifier}: ${outlier.value.toFixed(2)} [${outlier.sigmaDistance.toFixed(1)}σ, ${outlier.severity}]\n`;
    });
    summary += `\n`;
  }
  
  if (analysis.contextualOutliers.length > 0) {
    summary += `Contextual Outliers (unexpected for context):\n`;
    analysis.contextualOutliers.slice(0, 3).forEach((outlier, i) => {
      summary += `${i+1}. ${outlier.identifier}: ${outlier.value.toFixed(2)} (expected: ~${outlier.expectedValue?.toFixed(2)})\n`;
      if (outlier.contextualFactors && outlier.contextualFactors.length > 0) {
        summary += `   Context: ${outlier.contextualFactors.join(', ')}\n`;
      }
    });
    summary += `\n`;
  }
  
  if (analysis.collectiveOutliers.length > 0) {
    summary += `Collective Outliers (group anomalies):\n`;
    const groupNames = new Set(analysis.collectiveOutliers.map(o => 
      o.contextualFactors?.[0] || 'Unknown group'
    ));
    Array.from(groupNames).slice(0, 3).forEach(groupName => {
      summary += `- ${groupName}\n`;
    });
    summary += `\n`;
  }
  
  summary += `🔍 OUTLIER DIRECTIVE: Investigate extreme outliers for data quality issues or genuine anomalies requiring strategic attention.\n\n`;
  
  return summary;
}

// Export types and functions
export type { OutlierDetail, OutlierAnalysis };
export { detectStatisticalOutliers, detectContextualOutliers, detectCollectiveOutliers };