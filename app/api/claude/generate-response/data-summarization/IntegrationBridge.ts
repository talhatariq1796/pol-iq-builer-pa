/**
 * Integration Bridge
 * 
 * Provides a seamless integration point between the new data summarization system
 * and the existing Claude API route, ensuring backward compatibility while
 * preventing 413 errors through intelligent summarization.
 */

import { createOptimizedDataSummary, shouldUseComprehensiveSummary } from './DataSummarizationManager';

// Type definitions for existing system compatibility
interface ProcessedLayerResult {
  layerId: string;
  layerName: string;
  layerType: string;
  features: any[];
  extent: any;
  fields?: any[];
  geometryType?: string;
  isComprehensiveSummary?: boolean;
  originalSummary?: any;
}

interface LayerConfig {
  id: string;
  name: string;
  rendererField?: string;
  [key: string]: any;
}

interface Metadata {
  analysisType?: string;
  spatialFilterIds?: any;
  clusterOptions?: any;
  isClustered?: boolean;
  [key: string]: any;
}

interface IntegrationOptions {
  enableOptimization?: boolean;
  forceOptimization?: boolean;
  maxPayloadSize?: number;
  logPerformance?: boolean;
}

/**
 * Default integration options
 */
const DEFAULT_INTEGRATION_OPTIONS: IntegrationOptions = {
  enableOptimization: true,
  forceOptimization: false,
  maxPayloadSize: 50000, // 50KB threshold for optimization
  logPerformance: true
};

/**
 * Estimate if current approach would exceed size limits
 */
function wouldExceedSizeLimits(
  processedLayersData: ProcessedLayerResult[],
  maxSize: number = 50000
): boolean {
  // Conservative estimate: 350 characters per feature
  const estimatedSize = processedLayersData.reduce(
    (total, layer) => total + (layer.features?.length || 0) * 350,
    0
  );
  
  return estimatedSize > maxSize;
}

/**
 * Extract analysis type from various sources
 */
function extractAnalysisType(metadata?: Metadata, processedLayersData?: ProcessedLayerResult[]): string {
  // Priority 1: Direct metadata
  if (metadata?.analysisType) {
    return metadata.analysisType;
  }
  
  // Priority 2: Infer from layer types
  if (processedLayersData && processedLayersData.length > 0) {
    const firstLayer = processedLayersData[0];
    
    // Check layer ID for analysis type
    if (firstLayer.layerId.includes('competitive')) return 'competitive-analysis';
    if (firstLayer.layerId.includes('strategic')) return 'strategic-analysis';
    if (firstLayer.layerId.includes('demographic')) return 'demographic-insights';
    if (firstLayer.layerId.includes('correlation')) return 'correlation-analysis';
    if (firstLayer.layerId.includes('outlier')) return 'outlier-detection';
    if (firstLayer.layerId.includes('spatial')) return 'spatial-clusters';
    if (firstLayer.layerId.includes('brand')) return 'brand-difference';
  }
  
  return 'analyze'; // Default fallback
}

/**
 * Main integration function - replaces the existing feature enumeration section
 */
export function integrateOptimizedSummarization(
  processedLayersData: ProcessedLayerResult[],
  layers: Record<string, LayerConfig> = {},
  metadata?: Metadata,
  options: Partial<IntegrationOptions> = {}
): {
  optimizedSummary: string;
  shouldUseOptimization: boolean;
  performanceMetrics: {
    originalEstimatedSize: number;
    optimizedSize: number;
    reductionPercentage: number;
    processingTime: number;
  };
} {
  const mergedOptions = { ...DEFAULT_INTEGRATION_OPTIONS, ...options };
  const startTime = performance.now();
  
  // Check if we should use comprehensive summary (existing logic)
  const hasComprehensiveSummary = shouldUseComprehensiveSummary(processedLayersData);
  
  console.log('[IntegrationBridge] DEBUG - Initial checks:', {
    hasComprehensiveSummary,
    forceOptimization: mergedOptions.forceOptimization,
    enableOptimization: mergedOptions.enableOptimization,
    maxPayloadSize: mergedOptions.maxPayloadSize
  });
  
  if (hasComprehensiveSummary && !mergedOptions.forceOptimization) {
    if (mergedOptions.logPerformance) {
      console.log('[IntegrationBridge] Using existing comprehensive summary path');
    }
    
    return {
      optimizedSummary: '', // Let existing logic handle comprehensive summaries
      shouldUseOptimization: false,
      performanceMetrics: {
        originalEstimatedSize: 0,
        optimizedSize: 0,
        reductionPercentage: 0,
        processingTime: performance.now() - startTime
      }
    };
  }
  
  // Check if optimization is needed
  const wouldExceedLimits = wouldExceedSizeLimits(processedLayersData, mergedOptions.maxPayloadSize);
  const shouldOptimize = mergedOptions.enableOptimization && 
                        (wouldExceedLimits || mergedOptions.forceOptimization);
  
  console.log('[IntegrationBridge] DEBUG - Optimization decision:', {
    wouldExceedLimits,
    shouldOptimize,
    totalFeatures: processedLayersData.reduce((total, layer) => total + (layer.features?.length || 0), 0),
    estimatedSize: processedLayersData.reduce((total, layer) => total + (layer.features?.length || 0) * 350, 0)
  });
  
  if (!shouldOptimize) {
    if (mergedOptions.logPerformance) {
      console.log('[IntegrationBridge] Optimization not needed - payload size within limits');
    }
    
    return {
      optimizedSummary: '', // Let existing logic handle small datasets
      shouldUseOptimization: false,
      performanceMetrics: {
        originalEstimatedSize: processedLayersData.reduce((total, layer) => 
          total + (layer.features?.length || 0) * 350, 0),
        optimizedSize: 0,
        reductionPercentage: 0,
        processingTime: performance.now() - startTime
      }
    };
  }
  
  // Extract analysis type
  const analysisType = extractAnalysisType(metadata, processedLayersData);
  
  if (mergedOptions.logPerformance) {
    console.log('[IntegrationBridge] Using optimized summarization:', {
      analysisType,
      layerCount: processedLayersData.length,
      totalFeatures: processedLayersData.reduce((total, layer) => 
        total + (layer.features?.length || 0), 0),
      exceedsLimits: wouldExceedLimits
    });
  }
  
  // Generate optimized summary
  const result = createOptimizedDataSummary(processedLayersData, layers, {
    analysisType,
    includeStatisticalFoundation: true,
    enableGeographicClustering: true,
    enableOutlierDetection: true
  });
  
  const endTime = performance.now();
  const originalEstimatedSize = result.featureCount * 350;
  
  if (mergedOptions.logPerformance) {
    console.log('[IntegrationBridge] Optimization complete:', {
      originalEstimatedSize,
      optimizedSize: result.payloadSize,
      reductionPercentage: result.reductionPercentage.toFixed(1) + '%',
      processingTime: (endTime - startTime).toFixed(2) + 'ms',
      analysisType: result.analysisType
    });
  }
  
  return {
    optimizedSummary: result.summary,
    shouldUseOptimization: true,
    performanceMetrics: {
      originalEstimatedSize,
      optimizedSize: result.payloadSize,
      reductionPercentage: result.reductionPercentage,
      processingTime: endTime - startTime
    }
  };
}

/**
 * Helper function to replace the existing feature enumeration section
 * This is the main entry point for integration with the existing route
 */
export function replaceExistingFeatureEnumeration(
  processedLayersData: ProcessedLayerResult[],
  layers: Record<string, LayerConfig>,
  metadata?: Metadata,
  currentLayerPrimaryField?: string,
  forceOptimization?: boolean
): string {
  try {
    console.log('[IntegrationBridge] DEBUG - Function called with:', {
      layerCount: processedLayersData?.length,
      totalFeatures: processedLayersData?.reduce((total, layer) => total + (layer.features?.length || 0), 0),
      forceOptimization: forceOptimization,
      primaryField: currentLayerPrimaryField,
      metadataAnalysisType: metadata?.analysisType
    });

    // Integration with optimized summarization
    const integration = integrateOptimizedSummarization(
      processedLayersData,
      layers,
      metadata,
      {
        enableOptimization: true,
        forceOptimization: forceOptimization || false, // Use passed parameter or default to false
        logPerformance: true // Enable logging to see what's happening
      }
    );
    
    console.log('[IntegrationBridge] DEBUG - Integration result:', {
      shouldUseOptimization: integration.shouldUseOptimization,
      summaryLength: integration.optimizedSummary?.length || 0,
      reductionPercentage: integration.performanceMetrics.reductionPercentage
    });
    
    if (integration.shouldUseOptimization) {
      console.log('[IntegrationBridge] ✅ Replaced feature enumeration with optimized summary');
      return integration.optimizedSummary;
    } else {
      console.log('[IntegrationBridge] ⏭️ Skipping optimization - using existing logic');
      return ''; // Return empty string to let existing logic continue
    }
    
  } catch (error) {
    console.error('[IntegrationBridge] ❌ Error in optimization, falling back to existing logic:', error);
    return ''; // Fail gracefully and let existing logic handle it
  }
}

/**
 * Validation function for integration readiness
 */
export function validateIntegrationReadiness(
  processedLayersData: ProcessedLayerResult[],
  layers: Record<string, LayerConfig>
): {
  isReady: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check basic data structure
  if (!processedLayersData || !Array.isArray(processedLayersData)) {
    issues.push('processedLayersData is not a valid array');
  } else if (processedLayersData.length === 0) {
    issues.push('processedLayersData is empty');
  }
  
  // Check layer configurations
  if (!layers || typeof layers !== 'object') {
    issues.push('layers configuration is missing or invalid');
    recommendations.push('Ensure layers object is properly passed to the integration');
  }
  
  // Check for potential optimization targets
  let totalFeatures = 0;
  processedLayersData.forEach((layer, index) => {
    if (!layer.features || !Array.isArray(layer.features)) {
      issues.push(`Layer ${index} has invalid features array`);
    } else {
      totalFeatures += layer.features.length;
    }
    
    if (!layer.layerId) {
      issues.push(`Layer ${index} missing layerId`);
    }
  });
  
  // Performance recommendations
  if (totalFeatures > 1000) {
    recommendations.push(`Large dataset detected (${totalFeatures} features) - optimization will provide significant benefits`);
  }
  
  if (totalFeatures > 10000) {
    recommendations.push('Very large dataset - consider enabling forceOptimization for maximum performance');
  }
  
  return {
    isReady: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Performance monitoring and metrics collection
 */
export function collectPerformanceMetrics(
  processedLayersData: ProcessedLayerResult[]
): {
  featureCount: number;
  layerCount: number;
  estimatedCurrentSize: number;
  optimizationRecommended: boolean;
  riskLevel: 'low' | 'medium' | 'high';
} {
  const featureCount = processedLayersData.reduce(
    (total, layer) => total + (layer.features?.length || 0), 
    0
  );
  
  const layerCount = processedLayersData.length;
  const estimatedCurrentSize = featureCount * 350; // Conservative estimate
  
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (estimatedCurrentSize > 100000) riskLevel = 'high';
  else if (estimatedCurrentSize > 50000) riskLevel = 'medium';
  
  return {
    featureCount,
    layerCount,
    estimatedCurrentSize,
    optimizationRecommended: estimatedCurrentSize > 20000,
    riskLevel
  };
}

// Export types for external usage
export type { ProcessedLayerResult, LayerConfig, Metadata, IntegrationOptions };