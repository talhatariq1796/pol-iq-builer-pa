/**
 * Analysis-Type Specific Processors
 * 
 * Creates targeted data summaries based on analysis type to complement
 * the statistical foundation and prevent 413 errors while maintaining accuracy.
 */

import {
  FeatureProperties,
  StatisticalMetrics,
  extractNumericValues,
  calculateStatistics,
  getHumanReadableFieldName
} from './StatisticalFoundation';

import {
  analyzeGeographicClusters,
  createGeographicClusteringSummary
} from './GeographicClustering';

import {
  createComprehensiveOutlierSummary
} from './OutlierDetection';

// Interface for LayerConfig compatibility
interface LayerConfig {
  id: string;
  name: string;
  [key: string]: any;
}

// Utility types
interface TopFeature {
  zipCode: string;
  description: string | null;
  value: number;
}

interface CorrelationResult {
  field: string;
  coefficient: number;
  significance: 'Strong' | 'Moderate' | 'Weak';
}

interface OutlierResult {
  feature: TopFeature;
  sigmaDistance: number;
  expectedValue?: number;
}

interface PerformanceTier {
  count: number;
  averageScore: number;
  threshold: string;
}

/**
 * Main factory function for creating analysis-specific summaries
 */
export function createAnalysisSpecificSummary(
  features: FeatureProperties[],
  analysisType: string,
  primaryField: string,
  layerConfig?: LayerConfig
): string {
  
  const processors: Record<string, (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => string> = {
    'strategic-analysis': createStrategicAnalysisSummary,
    'competitive-analysis': createCompetitiveAnalysisSummary,
    'demographic-insights': createDemographicInsightsSummary,
    'correlation-analysis': createCorrelationAnalysisSummary,
    'brand-difference': createBrandDifferenceSummary,
    'comparative-analysis': createComparativeAnalysisSummary,
    'customer-profile': createCustomerProfileSummary,
    'trend-analysis': createTrendAnalysisSummary,
    'segment-profiling': createSegmentProfilingSummary,
    'anomaly-detection': createAnomalyDetectionSummary,
    'predictive-modeling': createPredictiveModelingSummary,
    'feature-interactions': createFeatureInteractionsSummary,
    'outlier-detection': createOutlierDetectionSummary,
    'scenario-analysis': createScenarioAnalysisSummary,
    'sensitivity-analysis': createSensitivityAnalysisSummary,
    'model-performance': createModelPerformanceSummary,
    'model-selection': createModelSelectionSummary,
    'ensemble-analysis': createEnsembleAnalysisSummary,
    'feature-importance-ranking': createFeatureImportanceRankingSummary,
    'dimensionality-insights': createDimensionalityInsightsSummary,
    'spatial-clusters': createSpatialClustersSummary,
    'consensus-analysis': createConsensusAnalysisSummary,
    'algorithm-comparison': createAlgorithmComparisonSummary,
    'analyze': createAnalyzeSummary,
    'default': createStandardSummary
  };
  
  const processor = processors[analysisType] || processors['default'];
  return processor(features, primaryField, layerConfig);
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get top and bottom performers from features
 */
function getTopAndBottomPerformers(
  features: FeatureProperties[], 
  field: string, 
  topCount: number = 10, 
  bottomCount: number = 5
): { top: TopFeature[], bottom: TopFeature[] } {
  
  const validFeatures = features
    .map(feature => {
      const properties = feature.properties || feature;
      const value = properties[field];
      
      if (typeof value !== 'number' || isNaN(value)) return null;
      
      // Extract location identifiers
      const zipCode = extractZipCode(properties);
      const description = extractDescription(properties);
      
      return { zipCode, description, value };
    })
    .filter((f): f is TopFeature => f !== null)
    .sort((a, b) => b.value - a.value); // Sort descending
  
  return {
    top: validFeatures.slice(0, topCount),
    bottom: validFeatures.slice(-bottomCount).reverse() // Get bottom N, reverse to show lowest first
  };
}

/**
 * Extract ZIP code from feature properties
 */
function extractZipCode(properties: Record<string, any>): string {
  return properties.zipcode || 
         properties.zip_code || 
         properties.ZIP || 
         properties.ZIPCODE ||
         properties.geoid ||
         properties.GEOID ||
         'Unknown';
}

/**
 * Extract description from feature properties  
 */
function extractDescription(properties: Record<string, any>): string | null {
  return properties.DESCRIPTION || 
         properties.description || 
         properties.name ||
         properties.NAME ||
         null;
}

/**
 * Detect outliers using IQR method
 */
function detectOutliers(features: FeatureProperties[], field: string): {
  high: OutlierResult[], 
  low: OutlierResult[], 
  contextual: OutlierResult[]
} {
  const values = extractNumericValues(features, field);
  const stats = calculateStatistics(values);
  
  const { quartiles, mean, standardDeviation } = stats;
  const [q1, , q3] = quartiles;
  const iqr = q3 - q1;
  
  // IQR method bounds
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  // Sigma method bounds  
  const sigmaLower = mean - 2.5 * standardDeviation;
  const sigmaUpper = mean + 2.5 * standardDeviation;
  
  const highOutliers: OutlierResult[] = [];
  const lowOutliers: OutlierResult[] = [];
  const contextualOutliers: OutlierResult[] = [];
  
  features.forEach(feature => {
    const properties = feature.properties || feature;
    const value = properties[field];
    
    if (typeof value !== 'number' || isNaN(value)) return;
    
    const featureData = {
      zipCode: extractZipCode(properties),
      description: extractDescription(properties),
      value
    };
    
    const sigmaDistance = (value - mean) / standardDeviation;
    
    if (value > upperBound || value > sigmaUpper) {
      highOutliers.push({ feature: featureData, sigmaDistance });
    } else if (value < lowerBound || value < sigmaLower) {
      lowOutliers.push({ feature: featureData, sigmaDistance });
    }
  });
  
  // Sort by sigma distance
  highOutliers.sort((a, b) => Math.abs(b.sigmaDistance) - Math.abs(a.sigmaDistance));
  lowOutliers.sort((a, b) => Math.abs(b.sigmaDistance) - Math.abs(a.sigmaDistance));
  
  return {
    high: highOutliers.slice(0, 10),
    low: lowOutliers.slice(0, 5), 
    contextual: contextualOutliers.slice(0, 5)
  };
}

/**
 * Create performance tiers
 */
function createPerformanceTiers(features: FeatureProperties[], field: string): {
  tier1: PerformanceTier,
  tier2: PerformanceTier, 
  tier3: PerformanceTier,
  tier4: PerformanceTier
} {
  const values = extractNumericValues(features, field);
  const sorted = [...values].sort((a, b) => b - a);
  
  const tier1Cutoff = Math.floor(sorted.length * 0.1);
  const tier2Cutoff = Math.floor(sorted.length * 0.3);
  const tier3Cutoff = Math.floor(sorted.length * 0.7);
  
  const tier1Values = sorted.slice(0, tier1Cutoff);
  const tier2Values = sorted.slice(tier1Cutoff, tier2Cutoff);
  const tier3Values = sorted.slice(tier2Cutoff, tier3Cutoff);
  const tier4Values = sorted.slice(tier3Cutoff);
  
  const calcAvg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  
  return {
    tier1: { count: tier1Values.length, averageScore: calcAvg(tier1Values), threshold: 'Top 10%' },
    tier2: { count: tier2Values.length, averageScore: calcAvg(tier2Values), threshold: 'Next 20%' },
    tier3: { count: tier3Values.length, averageScore: calcAvg(tier3Values), threshold: 'Middle 40%' },
    tier4: { count: tier4Values.length, averageScore: calcAvg(tier4Values), threshold: 'Bottom 30%' }
  };
}

/**
 * Format field value (placeholder - should match existing utility)
 */
function formatFieldValue(value: number, fieldName: string, layerConfig?: LayerConfig): string {
  // This should match the existing formatFieldValue function
  return value.toFixed(2);
}

// ===== ANALYSIS-SPECIFIC PROCESSORS =====

/**
 * Correlation Analysis Summary
 */
function createCorrelationAnalysisSummary(
  features: FeatureProperties[], 
  primaryField: string, 
  layerConfig?: LayerConfig
): string {
  const performers = getTopAndBottomPerformers(features, primaryField, 5, 5);
  
  let summary = `=== CORRELATION ANALYSIS INSIGHTS ===\n`;
  summary += `Primary Field: ${getHumanReadableFieldName(primaryField)}\n`;
  summary += `Analysis Focus: Correlation patterns and relationships\n\n`;
  
  summary += `Representative Examples:\n`;
  summary += `High Performance Regions:\n`;
  performers.top.forEach((ex, i) => {
    summary += `${i+1}. ${ex.description || ex.zipCode}: ${formatFieldValue(ex.value, primaryField, layerConfig)}\n`;
  });
  
  summary += `\nLow Performance Regions:\n`;
  performers.bottom.forEach((ex, i) => {
    summary += `${i+1}. ${ex.description || ex.zipCode}: ${formatFieldValue(ex.value, primaryField, layerConfig)}\n`;
  });
  
  summary += `\n🔍 ANALYSIS DIRECTIVE: Focus on correlation patterns between high and low performers.\n\n`;
  
  return summary;
}

/**
 * Enhanced Outlier Detection Summary
 */
function createOutlierDetectionSummary(
  features: FeatureProperties[], 
  primaryField: string, 
  layerConfig?: LayerConfig
): string {
  // Use the comprehensive outlier analysis
  return createComprehensiveOutlierSummary(features, primaryField);
}

/**
 * Strategic Analysis Summary with Geographic Insights
 */
function createStrategicAnalysisSummary(
  features: FeatureProperties[], 
  primaryField: string, 
  layerConfig?: LayerConfig
): string {
  const performers = getTopAndBottomPerformers(features, primaryField, 15, 5);
  const geoAnalysis = analyzeGeographicClusters(features, primaryField);
  
  let summary = `=== STRATEGIC ANALYSIS INSIGHTS ===\n`;
  summary += `Strategic Opportunities: ${performers.top.length} high-potential markets identified\n`;
  summary += `Analysis Focus: Market expansion and strategic positioning\n`;
  
  // Add geographic context if available
  if (geoAnalysis.dominantRegions.length > 0) {
    summary += `Key Geographic Markets: ${geoAnalysis.dominantRegions.slice(0, 3).join(', ')}\n`;
  }
  summary += `\n`;
  
  summary += `Top Strategic Opportunities:\n`;
  performers.top.forEach((performer, i) => {
    summary += `${i+1}. ${performer.description || performer.zipCode}: ${getHumanReadableFieldName(primaryField)} ${formatFieldValue(performer.value, primaryField, layerConfig)}\n`;
  });
  
  // Add spatial patterns if detected
  if (geoAnalysis.patterns.length > 0) {
    summary += `\nGeographic Patterns:\n`;
    geoAnalysis.patterns.slice(0, 2).forEach(pattern => {
      summary += `- ${pattern.description}\n`;
    });
  }
  
  summary += `\nStrategic Concerns:\n`;
  performers.bottom.forEach((performer, i) => {
    summary += `${i+1}. ${performer.description || performer.zipCode}: ${formatFieldValue(performer.value, primaryField, layerConfig)}\n`;
  });
  
  summary += `\n🎯 STRATEGIC DIRECTIVE: Prioritize market entry strategies for top opportunities while addressing underperformance in concern areas.\n\n`;
  
  return summary;
}

/**
 * Ranking Analysis Summary
 */
function createRankingSummary(
  features: FeatureProperties[], 
  primaryField: string, 
  layerConfig?: LayerConfig
): string {
  const performers = getTopAndBottomPerformers(features, primaryField, 25, 10);
  const tiers = createPerformanceTiers(features, primaryField);
  
  let summary = `=== RANKING ANALYSIS ===\n`;
  summary += `Performance Tiers:\n`;
  summary += `- Tier 1 (${tiers.tier1.threshold}): ${tiers.tier1.count} regions, avg score: ${tiers.tier1.averageScore.toFixed(2)}\n`;
  summary += `- Tier 2 (${tiers.tier2.threshold}): ${tiers.tier2.count} regions, avg score: ${tiers.tier2.averageScore.toFixed(2)}\n`;
  summary += `- Tier 3 (${tiers.tier3.threshold}): ${tiers.tier3.count} regions, avg score: ${tiers.tier3.averageScore.toFixed(2)}\n`;
  summary += `- Tier 4 (${tiers.tier4.threshold}): ${tiers.tier4.count} regions, avg score: ${tiers.tier4.averageScore.toFixed(2)}\n\n`;
  
  summary += `Top Performers:\n`;
  performers.top.forEach((performer, i) => {
    summary += `${i+1}. ${performer.description || performer.zipCode}: ${formatFieldValue(performer.value, primaryField, layerConfig)}\n`;
  });
  
  summary += `\nBottom Performers:\n`;
  performers.bottom.forEach((performer, i) => {
    summary += `${performers.top.length + i + 1}. ${performer.description || performer.zipCode}: ${formatFieldValue(performer.value, primaryField, layerConfig)}\n`;
  });
  
  summary += `\n📊 RANKING DIRECTIVE: Analyze tier distributions and performance gaps for comprehensive ranking insights.\n\n`;
  
  return summary;
}

// ===== PLACEHOLDER PROCESSORS =====
// These will be implemented in future phases or can use the standard processor

function createCompetitiveAnalysisSummary(features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig): string {
  return createRankingSummary(features, primaryField, layerConfig).replace('RANKING ANALYSIS', 'COMPETITIVE ANALYSIS INSIGHTS');
}

function createDemographicInsightsSummary(features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig): string {
  const performers = getTopAndBottomPerformers(features, primaryField, 10, 5);
  let summary = `=== DEMOGRAPHIC INSIGHTS ===\n`;
  summary += `Demographic Analysis: ${features.length} markets analyzed for demographic patterns\n\n`;
  summary += `High Demographic Performance:\n`;
  performers.top.forEach((p, i) => summary += `${i+1}. ${p.description || p.zipCode}: ${formatFieldValue(p.value, primaryField, layerConfig)}\n`);
  summary += `\n🎯 DEMOGRAPHIC DIRECTIVE: Focus on demographic clustering and segmentation patterns.\n\n`;
  return summary;
}

function createBrandDifferenceSummary(features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig): string {
  const performers = getTopAndBottomPerformers(features, primaryField, 10, 5);
  let summary = `=== BRAND DIFFERENCE ANALYSIS ===\n`;
  summary += `Brand Performance Gaps: Analyzing competitive positioning\n\n`;
  summary += `Largest Brand Advantages:\n`;
  performers.top.forEach((p, i) => summary += `${i+1}. ${p.description || p.zipCode}: ${formatFieldValue(p.value, primaryField, layerConfig)}\n`);
  summary += `\n🏷️ BRAND DIRECTIVE: Focus on brand positioning opportunities and competitive gaps.\n\n`;
  return summary;
}

// Default implementations for remaining processors (to be expanded)
const createComparativeAnalysisSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'COMPARATIVE ANALYSIS');
const createCustomerProfileSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'CUSTOMER PROFILE ANALYSIS');
const createTrendAnalysisSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'TREND ANALYSIS');
const createSegmentProfilingSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'SEGMENT PROFILING');
const createAnomalyDetectionSummary = createOutlierDetectionSummary; // Similar to outlier detection
const createPredictiveModelingSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'PREDICTIVE MODELING');
const createFeatureInteractionsSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'FEATURE INTERACTIONS');
const createScenarioAnalysisSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'SCENARIO ANALYSIS');
const createSensitivityAnalysisSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'SENSITIVITY ANALYSIS');
const createModelPerformanceSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'MODEL PERFORMANCE');
const createModelSelectionSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'MODEL SELECTION');
const createEnsembleAnalysisSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'ENSEMBLE ANALYSIS');
const createFeatureImportanceRankingSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createRankingSummary(features, primaryField, layerConfig).replace('RANKING', 'FEATURE IMPORTANCE RANKING');
const createDimensionalityInsightsSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'DIMENSIONALITY INSIGHTS');
/**
 * Spatial Clusters Analysis Summary
 */
function createSpatialClustersSummary(
  features: FeatureProperties[], 
  primaryField: string, 
  layerConfig?: LayerConfig
): string {
  // Use the comprehensive geographic clustering analysis
  return createGeographicClusteringSummary(features, primaryField);
}
const createConsensusAnalysisSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'CONSENSUS ANALYSIS');
const createAlgorithmComparisonSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'ALGORITHM COMPARISON');
const createAnalyzeSummary = (features: FeatureProperties[], primaryField: string, layerConfig?: LayerConfig) => createStandardSummary(features, primaryField, layerConfig, 'GENERAL ANALYSIS');

/**
 * Standard/Default Summary Processor
 */
function createStandardSummary(
  features: FeatureProperties[], 
  primaryField: string, 
  layerConfig?: LayerConfig,
  analysisName: string = 'ANALYSIS'
): string {
  const performers = getTopAndBottomPerformers(features, primaryField, 10, 5);
  
  let summary = `=== ${analysisName} ===\n`;
  summary += `Analysis Scope: ${features.length} regions analyzed\n`;
  summary += `Primary Metric: ${getHumanReadableFieldName(primaryField)}\n\n`;
  
  if (performers.top.length > 0) {
    summary += `Top Performers:\n`;
    performers.top.forEach((performer, i) => {
      summary += `${i+1}. ${performer.description || performer.zipCode}: ${formatFieldValue(performer.value, primaryField, layerConfig)}\n`;
    });
    summary += `\n`;
  }
  
  if (performers.bottom.length > 0) {
    summary += `Areas for Improvement:\n`;
    performers.bottom.forEach((performer, i) => {
      summary += `${i+1}. ${performer.description || performer.zipCode}: ${formatFieldValue(performer.value, primaryField, layerConfig)}\n`;
    });
    summary += `\n`;
  }
  
  summary += `📈 ANALYSIS DIRECTIVE: Focus on performance patterns and actionable insights from the data.\n\n`;
  
  return summary;
}