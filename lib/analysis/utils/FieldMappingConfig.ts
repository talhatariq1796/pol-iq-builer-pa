/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Centralized Field Mapping Configuration
 * 
 * This configuration defines how each analysis endpoint maps its data fields
 * to the standard visualization fields. This eliminates the need for multiple
 * if statements throughout the codebase.
 * 
 * To add a new endpoint:
 * 1. Add an entry with the endpoint name or analysis type
 * 2. Specify the primaryScoreField (the main metric to visualize)
 * 3. Optionally add any fallback fields
 * 4. That's it! No other code changes needed.
 */

export interface EndpointFieldMapping {
  // The primary field containing the main score/metric for this analysis
  primaryScoreField: string;
  
  // Optional fallback fields if primary is not found
  fallbackFields?: string[];
  
  // Optional display name for the field in legends/popups
  displayName?: string;
  
  // Optional value range for validation
  expectedRange?: {
    min: number;
    max: number;
  };
  
  // Optional flag to indicate if values should be treated as percentages
  isPercentage?: boolean;
  
  // Optional custom formatter for display
  formatter?: (value: number) => string;
}

// Centralized configuration for all endpoint field mappings
export const ENDPOINT_FIELD_MAPPINGS: Record<string, EndpointFieldMapping> = {
  // Strategic Analysis
  'strategic_analysis': {
  primaryScoreField: 'strategic_analysis_score',
    displayName: 'Strategic Value Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Competitive Analysis
  'competitive_analysis': {
    primaryScoreField: 'competitive_analysis_score',
    fallbackFields: ['competitive_score', 'competitive_advantage_score'],
    displayName: 'Competitive Advantage Score',
    expectedRange: { min: 0, max: 100 },
    formatter: (value) => value.toFixed(1)
  },
  
  // Demographic Analysis
  'demographic_analysis': {
    primaryScoreField: 'demographic_insights_score',
    fallbackFields: ['demographic_opportunity_score', 'demographic_score'],
    displayName: 'Demographic Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Market Sizing
  'market_sizing': {
    primaryScoreField: 'market_sizing_score',
    displayName: 'Market Size Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Trend Analysis
  'trend_analysis': {
    primaryScoreField: 'trend_analysis_score',
    fallbackFields: ['trend_strength', 'trend_score'],
    displayName: 'Trend Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Correlation Analysis
  'correlation_analysis': {
    primaryScoreField: 'correlation_analysis_score',
    fallbackFields: ['correlation_score', 'correlation_strength_score'],
    displayName: 'Correlation Score',
    expectedRange: { min: -1, max: 1 },
    formatter: (value) => value.toFixed(3)
  },
  
  // Anomaly Detection
  'anomaly_detection': {
    primaryScoreField: 'anomaly_detection_score',
    displayName: 'Anomaly Score',
    expectedRange: { min: 0, max: 1 },
    formatter: (value) => (value * 100).toFixed(1) + '%'
  },
  
  // Predictive Analysis
  'predictive_analysis': {
    primaryScoreField: 'predictive_modeling_score',
    displayName: 'Prediction Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Risk Analysis
  'risk_analysis': {
    primaryScoreField: 'risk_adjusted_score',
    displayName: 'Risk Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Spatial Clustering
  'spatial_clustering': {
    primaryScoreField: 'cluster_performance_score',
    fallbackFields: ['cluster_score'],
    displayName: 'Cluster Performance Score',
    expectedRange: { min: 0, max: 100 }
  },
  // Spatial Clusters (alternative endpoint used by SpatialClustersProcessor)
  'spatial_clusters': {
    primaryScoreField: 'spatial_clusters_score',
    displayName: 'Spatial Clusters Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Expansion Analysis
  'expansion_analysis': {
    primaryScoreField: 'expansion_opportunity_score',
    displayName: 'Expansion Opportunity Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Brand Analysis
  'brand_analysis': {
    primaryScoreField: 'brand_analysis_score',
    displayName: 'Brand Score',
    expectedRange: { min: 0, max: 100 }
  },
  // Brand Difference
  'brand_difference': {
    primaryScoreField: 'brand_difference_score',
    displayName: 'Brand Difference Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Segment Profiling
  'segment_profiling': {
    primaryScoreField: 'segment_profiling_score',
    displayName: 'Segment Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Real Estate Analysis
  'real_estate_analysis': {
    primaryScoreField: 'real_estate_analysis_score',
    displayName: 'Real Estate Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Scenario Analysis
  'scenario_analysis': {
    primaryScoreField: 'scenario_analysis_score',
    displayName: 'Scenario Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Comparative Analysis
  'comparative_analysis': {
    primaryScoreField: 'comparison_score',
    fallbackFields: ['comparative_score', 'thematic_value', 'value'],
    displayName: 'Comparative Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Analyze (general analysis)
  'analyze': {
    primaryScoreField: 'analysis_score',
    fallbackFields: ['analyze_score', 'value'],
    displayName: 'Analysis Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Consensus Analysis
  'consensus_analysis': {
    primaryScoreField: 'consensus_analysis_score',
    displayName: 'Consensus Analysis Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Ensemble Analysis
  'ensemble_analysis': {
    primaryScoreField: 'ensemble_analysis_score',
    displayName: 'Ensemble Analysis Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Feature Importance Ranking
  'feature_importance_ranking': {
    primaryScoreField: 'feature_importance_ranking_score',
    displayName: 'Feature Importance Ranking Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Feature Interactions
  'feature_interactions': {
    primaryScoreField: 'feature_interactions_score',
    fallbackFields: ['feature_interaction_score'],
    displayName: 'Feature Interaction Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Outlier Detection
  'outlier_detection': {
    primaryScoreField: 'outlier_detection_score',
    displayName: 'Outlier Detection Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Sensitivity Analysis
  'sensitivity_analysis': {
    primaryScoreField: 'sensitivity_analysis_score',
    displayName: 'Sensitivity Analysis Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Algorithm Comparison
  'algorithm_comparison': {
    primaryScoreField: 'algorithm_comparison_score',
    displayName: 'Algorithm Comparison Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Dimensionality Insights
  'dimensionality_insights': {
    primaryScoreField: 'dimensionality_insights_score',
    displayName: 'Dimensionality Insights Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Model Performance
  'model_performance': {
    primaryScoreField: 'model_performance_score',
    displayName: 'Model Performance Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Customer Profile
  'customer_profile': {
    primaryScoreField: 'customer_profile_score',
    displayName: 'Customer Profile Score',
    expectedRange: { min: 0, max: 100 }
  },

  // Core Analysis (legacy)
  'core_analysis': {
    primaryScoreField: 'strategic_value_score',
    fallbackFields: ['strategic_score'],
    displayName: 'Core Strategic Score',
    expectedRange: { min: 0, max: 100 }
  },
  
  // Default fallback for unknown analysis types
  'default': {
    primaryScoreField: 'value',
    fallbackFields: ['score', 'analysis_score', 'thematic_value'],
    displayName: 'Analysis Score'
  }
};

/**
 * Get the field mapping for a specific analysis type or endpoint
 */
export function getFieldMapping(analysisType: string): EndpointFieldMapping {
  // Try exact match first
  if (ENDPOINT_FIELD_MAPPINGS[analysisType]) {
    return ENDPOINT_FIELD_MAPPINGS[analysisType];
  }
  
  // Try with underscores replaced by hyphens (for endpoint names)
  const hyphenated = analysisType.replace(/_/g, '-');
  if (ENDPOINT_FIELD_MAPPINGS[hyphenated]) {
    return ENDPOINT_FIELD_MAPPINGS[hyphenated];
  }
  
  // Try removing 'analysis' suffix
  const withoutAnalysis = analysisType.replace(/_analysis$/, '');
  if (ENDPOINT_FIELD_MAPPINGS[withoutAnalysis]) {
    return ENDPOINT_FIELD_MAPPINGS[withoutAnalysis];
  }
  
  // Return default mapping
  return ENDPOINT_FIELD_MAPPINGS['default'];
}

/**
 * Get the primary score field for a specific analysis type
 */
export function getPrimaryScoreField(analysisType: string, targetVariable?: string): string {
  // If targetVariable is explicitly provided, use it
  if (targetVariable) {
    return targetVariable;
  }
  
  const mapping = getFieldMapping(analysisType);
  return mapping.primaryScoreField;
}

/**
 * Extract the score value from a record using the field mapping
 */
export function extractScoreValue(
  record: any, 
  analysisType: string, 
  targetVariable?: string
): number {
  const mapping = getFieldMapping(analysisType);
  
  // Try primary field first
  const primaryField = targetVariable || mapping.primaryScoreField;
  if (record[primaryField] !== undefined && record[primaryField] !== null) {
    return Number(record[primaryField]);
  }
  
  // Try properties
  if (record.properties?.[primaryField] !== undefined) {
    return Number(record.properties[primaryField]);
  }
  
  // Try fallback fields
  if (mapping.fallbackFields) {
    for (const field of mapping.fallbackFields) {
      if (record[field] !== undefined && record[field] !== null) {
        return Number(record[field]);
      }
      if (record.properties?.[field] !== undefined) {
        return Number(record.properties[field]);
      }
    }
  }
  
  // Last resort - try 'value' field
  if (record.value !== undefined && record.value !== null) {
    return Number(record.value);
  }
  
  return 0;
}

/**
 * Format a score value for display
 */
export function formatScoreValue(
  value: number, 
  analysisType: string
): string {
  const mapping = getFieldMapping(analysisType);
  
  if (mapping.formatter) {
    return mapping.formatter(value);
  }
  
  if (mapping.isPercentage) {
    return `${value.toFixed(1)}%`;
  }
  
  // Default formatting
  if (value % 1 === 0) {
    return value.toString();
  }
  return value.toFixed(2);
}

/**
 * Validate if a score value is within expected range
 */
export function isValidScoreValue(
  value: number, 
  analysisType: string
): boolean {
  const mapping = getFieldMapping(analysisType);
  
  if (!mapping.expectedRange) {
    return !isNaN(value);
  }
  
  return value >= mapping.expectedRange.min && value <= mapping.expectedRange.max;
}