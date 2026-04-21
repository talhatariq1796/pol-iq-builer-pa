/**
 * Data Summarization Manager
 * 
 * Main integration point for the optimized data summarization system.
 * Replaces the current feature enumeration with intelligent summarization
 * to prevent 413 errors while maintaining analytical accuracy.
 */

import { createStatisticalFoundation } from './StatisticalFoundation';
import { createAnalysisSpecificSummary } from './AnalysisTypeProcessors';
import { analysisFeatures } from '@/lib/analysis/analysisLens';

// Re-export types for external usage
export type { FeatureProperties } from './StatisticalFoundation';

interface LayerConfig {
  id: string;
  name: string;
  [key: string]: any;
}

interface ProcessedLayerResult {
  layerId: string;
  layerName: string;
  layerType: string;
  features: any[];
  extent: any;
  fields?: any[];
  geometryType?: string;
}

interface SummarizationOptions {
  analysisType?: string;
  enableGeographicClustering?: boolean;
  enableOutlierDetection?: boolean;
  maxTopPerformers?: number;
  maxBottomPerformers?: number;
  includeStatisticalFoundation?: boolean;
}

interface SummarizationResult {
  summary: string;
  payloadSize: number;
  reductionPercentage: number;
  analysisType: string;
  layerCount: number;
  featureCount: number;
  processingTime: number;
}

/**
 * Default summarization options
 */
const DEFAULT_OPTIONS: SummarizationOptions = {
  analysisType: 'default',
  enableGeographicClustering: true,
  enableOutlierDetection: true,
  maxTopPerformers: 10,
  maxBottomPerformers: 5,
  includeStatisticalFoundation: true
};

/**
 * Extract primary field from layer data
 */
function extractPrimaryField(
  features: any[], 
  layerConfig?: LayerConfig,
  analysisType?: string
): string {
  if (!features || features.length === 0) return 'unknown_field';
  
  // Try to get from layer config first
  if (layerConfig?.rendererField) {
    return layerConfig.rendererField;
  }
  
  // Look for analysis-type specific fields
  const firstFeature = features[0];
  const properties = firstFeature.properties || firstFeature;
  
  // Analysis-type specific field mapping
  const analysisFieldMap: Record<string, string[]> = {
    'strategic-analysis': ['strategic_analysis_score', 'strategic_score'],
    'competitive-analysis': ['competitive_analysis_score', 'competitive_score'],
    'demographic-insights': ['demographic_insights_score', 'demographic_score'],
    'correlation-analysis': ['correlation_analysis_score', 'correlation_score'],
    'brand-difference': ['brand_difference_score', 'brand_diff_score'],
    'outlier-detection': ['outlier_detection_score', 'outlier_score'],
    'spatial-clusters': ['spatial_clusters_score', 'cluster_score'],
    'anomaly-detection': ['anomaly_detection_score', 'anomaly_score'],
    'predictive-modeling': ['predictive_modeling_score', 'prediction_score']
  };
  
  // Try analysis-specific fields first
  if (analysisType && analysisFieldMap[analysisType]) {
    for (const fieldName of analysisFieldMap[analysisType]) {
      if (properties[fieldName] !== undefined) {
        return fieldName;
      }
    }
  }
  
  // Common field patterns to look for
  const commonFields = [
    'thematic_value',
    'score',
    'value',
    'analysis_score',
    'competitive_analysis_score',
    'strategic_analysis_score'
  ];
  
  for (const fieldName of commonFields) {
    if (properties[fieldName] !== undefined && typeof properties[fieldName] === 'number') {
      return fieldName;
    }
  }
  
  // Last resort: find first numeric field
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'number' && !isNaN(value)) {
      return key;
    }
  }
  
  return 'unknown_field';
}

/**
 * Get human-readable layer name
 */
function getLayerDisplayName(layerResult: ProcessedLayerResult, layerConfig?: LayerConfig): string {
  return layerResult.layerName || 
         layerConfig?.name || 
         layerResult.layerId || 
         'Unknown Layer';
}

/**
 * Estimate payload size if full enumeration was used
 */
function estimateFullEnumerationSize(features: any[]): number {
  if (!features || features.length === 0) return 0;
  
  // Conservative estimate: 200-500 characters per feature
  const avgCharsPerFeature = 350;
  return features.length * avgCharsPerFeature;
}

/**
 * Create optimized data summary for a single layer
 */
function createLayerSummary(
  layerResult: ProcessedLayerResult,
  layerConfig: LayerConfig | undefined,
  options: SummarizationOptions
): string {
  const startTime = performance.now();
  
  try {
    const layerName = getLayerDisplayName(layerResult, layerConfig);
    const originalFeatures = layerResult.features || [];
    
    if (originalFeatures.length === 0) {
      return `\n=== ${layerName.toUpperCase()} ===\nNo features available for analysis.\n\n`;
    }
    
    // Filter features for analysis (exclude national parks)
    const features = analysisFeatures(originalFeatures);
    
    if (features.length === 0) {
      return `\n=== ${layerName.toUpperCase()} ===\nNo features available for analysis after filtering.\n\n`;
    }
    
    // Extract primary field for analysis
    const primaryField = extractPrimaryField(features, layerConfig, options.analysisType);
    
    let summary = '';
    
    // Add statistical foundation if enabled
    if (options.includeStatisticalFoundation) {
      summary += createStatisticalFoundation(features, primaryField, layerName);
    }
    
    // Add analysis-specific insights
    summary += createAnalysisSpecificSummary(
      features, 
      options.analysisType || 'default', 
      primaryField, 
      layerConfig
    );
    
    return summary;
    
  } catch (error) {
    console.error('[DataSummarization] Error creating layer summary:', error);
    return `\n=== ${getLayerDisplayName(layerResult, layerConfig).toUpperCase()} ===\nError generating summary: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
  }
}

/**
 * Main function to create optimized data summary
 */
export function createOptimizedDataSummary(
  processedLayersData: ProcessedLayerResult[],
  layers: Record<string, LayerConfig> = {},
  options: Partial<SummarizationOptions> = {}
): SummarizationResult {
  const startTime = performance.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  console.log('[DataSummarization] Starting optimized summarization...', {
    layerCount: processedLayersData.length,
    analysisType: mergedOptions.analysisType,
    options: mergedOptions
  });
  
  let dataSummary = '';
  let totalFeatures = 0;
  
  // Process each layer
  for (const layerResult of processedLayersData) {
    const layerConfig = layers[layerResult.layerId];
    const features = layerResult.features || [];
    totalFeatures += features.length;
    
    console.log(`[DataSummarization] Processing layer ${layerResult.layerId}:`, {
      featureCount: features.length,
      layerName: layerResult.layerName,
      hasConfig: !!layerConfig
    });
    
    // Create layer summary
    const layerSummary = createLayerSummary(layerResult, layerConfig, mergedOptions);
    dataSummary += layerSummary;
  }
  
  const endTime = performance.now();
  const processingTime = endTime - startTime;
  const payloadSize = dataSummary.length;
  const estimatedFullSize = processedLayersData.reduce(
    (total, layer) => total + estimateFullEnumerationSize(layer.features), 
    0
  );
  
  const reductionPercentage = estimatedFullSize > 0 
    ? ((estimatedFullSize - payloadSize) / estimatedFullSize) * 100 
    : 0;
  
  console.log('[DataSummarization] Summarization complete:', {
    payloadSize,
    estimatedFullSize,
    reductionPercentage: reductionPercentage.toFixed(1) + '%',
    processingTime: processingTime.toFixed(2) + 'ms',
    layerCount: processedLayersData.length,
    totalFeatures
  });
  
  return {
    summary: dataSummary,
    payloadSize,
    reductionPercentage,
    analysisType: mergedOptions.analysisType || 'default',
    layerCount: processedLayersData.length,
    featureCount: totalFeatures,
    processingTime
  };
}

/**
 * Check if comprehensive summary is available and should be used
 */
export function shouldUseComprehensiveSummary(processedLayersData: ProcessedLayerResult[]): boolean {
  return processedLayersData.some((layer: any) => layer.isComprehensiveSummary);
}

/**
 * Backward compatibility: replace existing feature enumeration
 */
export function replaceFeatureEnumeration(
  processedLayersData: ProcessedLayerResult[],
  layers: Record<string, LayerConfig>,
  metadata?: { analysisType?: string }
): string {
  // Extract analysis type from metadata
  const analysisType = metadata?.analysisType;
  
  // Check if we should use comprehensive summary (existing logic)
  if (shouldUseComprehensiveSummary(processedLayersData)) {
    console.log('[DataSummarization] Using existing comprehensive summary path');
    return ''; // Let existing comprehensive summary logic handle this
  }
  
  // Use optimized summarization for blob and direct data
  const result = createOptimizedDataSummary(processedLayersData, layers, {
    analysisType,
    includeStatisticalFoundation: true,
    enableGeographicClustering: true,
    enableOutlierDetection: true
  });
  
  return result.summary;
}

/**
 * Validation function to ensure data quality
 */
export function validateSummarizationInput(
  processedLayersData: ProcessedLayerResult[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!processedLayersData || !Array.isArray(processedLayersData)) {
    errors.push('processedLayersData must be an array');
  }
  
  if (processedLayersData.length === 0) {
    errors.push('processedLayersData cannot be empty');
  }
  
  processedLayersData.forEach((layer, index) => {
    if (!layer.layerId) {
      errors.push(`Layer ${index} missing layerId`);
    }
    
    if (!layer.features || !Array.isArray(layer.features)) {
      errors.push(`Layer ${index} missing or invalid features array`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Export all necessary functions and types
export {
  createLayerSummary,
  extractPrimaryField,
  getLayerDisplayName,
  estimateFullEnumerationSize,
  DEFAULT_OPTIONS
};

export type {
  SummarizationOptions,
  SummarizationResult,
  LayerConfig,
  ProcessedLayerResult
};