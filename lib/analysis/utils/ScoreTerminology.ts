/**
 * ScoreTerminology - Centralized score terminology for all 16 endpoints
 * 
 * Ensures Claude analysis uses the correct score terminology based on 
 * the analysis type and endpoint used.
 * 
 * Uses ConfigurationManager for endpoint configuration retrieval.
 */

import { ConfigurationManager } from '../ConfigurationManager';

export interface ScoreConfig {
  primaryScoreType: string;
  secondaryScoreType?: string;
  scoreFieldName: string;
  scoreDescription: string;
  scoreRange?: string;
  interpretationHigh: string;
  interpretationLow: string;
}

/**
 * Comprehensive score terminology mapping for all 16 endpoints
 */
export const ENDPOINT_SCORE_CONFIG: Record<string, ScoreConfig> = {
  '/analyze': {
    primaryScoreType: 'strategic value scores',
  scoreFieldName: 'analysis_score',
    scoreDescription: 'Comprehensive strategic importance rating combining market opportunity (0-3 pts), economic attractiveness (0-2 pts), competitive position (0-2 pts), growth potential (0-2 pts), and strategic fit (0-1 pts)',
    scoreRange: '0-10',
    interpretationHigh: 'high strategic value for expansion',
    interpretationLow: 'limited strategic value'
  },
  
  '/competitive-analysis': {
    primaryScoreType: 'competitive advantage scores',
    secondaryScoreType: 'market share percentages',
  scoreFieldName: 'competitive_analysis_score',
    scoreDescription: 'Competitive positioning strength relative to key competitors',
    scoreRange: '0-10',
    interpretationHigh: 'strong competitive advantage',
    interpretationLow: 'competitive disadvantage'
  },
  
  '/correlation-analysis': {
    primaryScoreType: 'correlation coefficients',
  scoreFieldName: 'correlation_analysis_score',
    scoreDescription: 'Statistical relationship strength between variables',
    scoreRange: '-1 to +1',
    interpretationHigh: 'strong positive correlation',
    interpretationLow: 'weak or negative correlation'
  },
  
  '/spatial-clusters': {
    primaryScoreType: 'cluster similarity scores',
  scoreFieldName: 'spatial_clusters_score',
    scoreDescription: 'Geographic similarity and cluster membership strength',
    scoreRange: '0-1',
    interpretationHigh: 'high cluster coherence',
    interpretationLow: 'weak cluster membership'
  },
  
  '/demographic-insights': {
    primaryScoreType: 'demographic compatibility scores',
  scoreFieldName: 'demographic_insights_score',
    scoreDescription: 'Population and demographic alignment with target market',
    scoreRange: '0-100',
    interpretationHigh: 'excellent demographic match',
    interpretationLow: 'poor demographic alignment'
  },
  
  '/trend-analysis': {
    primaryScoreType: 'trend strength scores',
    secondaryScoreType: 'growth rates',
  scoreFieldName: 'trend_analysis_score',
    scoreDescription: 'Temporal trend magnitude and consistency',
    scoreRange: '0-10',
    interpretationHigh: 'strong positive trend',
    interpretationLow: 'weak or declining trend'
  },
  
  '/anomaly-detection': {
    primaryScoreType: 'anomaly scores',
  scoreFieldName: 'anomaly_detection_score',
    scoreDescription: 'Statistical deviation from expected patterns',
    scoreRange: '0-10',
    interpretationHigh: 'significant anomaly detected',
    interpretationLow: 'normal pattern behavior'
  },
  
  '/feature-interactions': {
    primaryScoreType: 'interaction strength scores',
  scoreFieldName: 'feature_interactions_score',
    scoreDescription: 'Combined effect magnitude of multiple variables',
    scoreRange: '0-1',
    interpretationHigh: 'strong feature interaction',
    interpretationLow: 'minimal interaction effect'
  },
  
  '/outlier-detection': {
    primaryScoreType: 'outlier deviation scores',
  scoreFieldName: 'outlier_detection_score',
    scoreDescription: 'Statistical distance from population center',
    scoreRange: '0-10',
    interpretationHigh: 'significant outlier',
    interpretationLow: 'within normal range'
  },
  
  '/comparative-analysis': {
    primaryScoreType: 'comparative performance scores',
  scoreFieldName: 'comparison_score',
    scoreDescription: 'Relative performance comparison between groups',
    scoreRange: '0-100',
    interpretationHigh: 'superior comparative performance',
    interpretationLow: 'underperforming relative to comparison'
  },
  
  '/predictive-modeling': {
    primaryScoreType: 'prediction confidence scores',
    secondaryScoreType: 'forecasted values',
  scoreFieldName: 'predictive_modeling_score',
    scoreDescription: 'Model confidence in future performance predictions',
    scoreRange: '0-1',
    interpretationHigh: 'high prediction confidence',
    interpretationLow: 'low prediction reliability'
  },
  
  '/segment-profiling': {
    primaryScoreType: 'segment affinity scores',
  scoreFieldName: 'segment_profiling_score',
    scoreDescription: 'Market segment membership and characteristics strength',
    scoreRange: '0-10',
    interpretationHigh: 'strong segment alignment',
    interpretationLow: 'weak segment fit'
  },
  
  '/customer-profile': {
    primaryScoreType: 'customer profile scores',
    scoreFieldName: 'customer_profile_score',
    scoreDescription: 'Comprehensive customer persona fit combining demographic alignment (30%), lifestyle patterns (25%), behavioral indicators (25%), and market context (20%)',
    scoreRange: '0-100',
    interpretationHigh: 'ideal customer profile match',
    interpretationLow: 'poor customer profile alignment'
  },
  
  '/scenario-analysis': {
    primaryScoreType: 'scenario impact scores',
  scoreFieldName: 'scenario_analysis_score',
    scoreDescription: 'Projected impact magnitude under different scenarios',
    scoreRange: '0-10',
    interpretationHigh: 'high scenario impact potential',
    interpretationLow: 'minimal scenario sensitivity'
  },
  
  '/market-sizing': {
    primaryScoreType: 'market potential scores',
    secondaryScoreType: 'addressable market size',
  scoreFieldName: 'market_sizing_score',
    scoreDescription: 'Total addressable market opportunity rating',
    scoreRange: '0-10',
    interpretationHigh: 'large market opportunity',
    interpretationLow: 'limited market potential'
  },
  
  '/brand-analysis': {
    primaryScoreType: 'brand performance scores',
    secondaryScoreType: 'brand awareness metrics',
  scoreFieldName: 'brand_analysis_score',
    scoreDescription: 'Overall brand strength and market positioning',
    scoreRange: '0-100',
    interpretationHigh: 'strong brand performance',
    interpretationLow: 'weak brand presence'
  },
  
  '/real-estate-analysis': {
    primaryScoreType: 'location suitability scores',
    secondaryScoreType: 'property value indices',
  scoreFieldName: 'real_estate_analysis_score',
    scoreDescription: 'Real estate location attractiveness for business purposes',
    scoreRange: '0-10',
    interpretationHigh: 'excellent location potential',
    interpretationLow: 'poor location suitability'
  },
  
  '/strategic-analysis': {
    primaryScoreType: 'strategic value scores',
  scoreFieldName: 'strategic_analysis_score',
    scoreDescription: 'Comprehensive measure of market potential for Nike expansion combining market share, competitive landscape, demographic fit, and growth opportunities',
    scoreRange: '0-100',
    interpretationHigh: 'high strategic value for expansion',
    interpretationLow: 'limited strategic opportunity'
  },
  
  '/risk-analysis': {
    primaryScoreType: 'risk-adjusted scores',
  scoreFieldName: 'risk_adjusted_score',
    scoreDescription: 'Risk assessment rating incorporating market volatility, competitive threats, and operational challenges',
    scoreRange: '0-100',
    interpretationHigh: 'high risk level',
    interpretationLow: 'low risk level'
  },
  
  '/threshold-analysis': {
    primaryScoreType: 'threshold scores',
    scoreFieldName: 'threshold_score',
    scoreDescription: 'Performance relative to established business thresholds and benchmarks',
    scoreRange: '0-100',
    interpretationHigh: 'exceeds thresholds',
    interpretationLow: 'below thresholds'
  },
  
  '/feature-importance-ranking': {
    primaryScoreType: 'importance scores',
  scoreFieldName: 'feature_importance_ranking_score',
    scoreDescription: 'Relative importance of features in driving business outcomes',
    scoreRange: '0-1',
    interpretationHigh: 'highly influential feature',
    interpretationLow: 'minimal impact feature'
  },
  
  '/sensitivity-analysis': {
    primaryScoreType: 'sensitivity coefficients',
  scoreFieldName: 'sensitivity_analysis_score',
    scoreDescription: 'Market response sensitivity to changes in key variables',
    scoreRange: '0-100',
    interpretationHigh: 'highly sensitive to changes',
    interpretationLow: 'stable/insensitive to changes'
  },
  
  '/model-performance': {
    primaryScoreType: 'performance metrics',
  scoreFieldName: 'model_performance_score',
    scoreDescription: 'Model accuracy and reliability in predictions',
    scoreRange: '0-1',
    interpretationHigh: 'excellent model performance',
    interpretationLow: 'poor model performance'
  }
};

// Initialize ConfigurationManager singleton instance
const configManager = ConfigurationManager.getInstance();

/**
 * Get score configuration for a specific endpoint
 * Uses ConfigurationManager for scoreFieldName and falls back to ENDPOINT_SCORE_CONFIG for descriptions
 */
export function getScoreConfigForEndpoint(endpoint: string): ScoreConfig {
  const scoreConfig = configManager.getScoreConfig(endpoint);
  const terminologyConfig = ENDPOINT_SCORE_CONFIG[endpoint];
  
  if (!terminologyConfig) {
    console.warn(`[ScoreTerminology] No score config found for endpoint: ${endpoint}, using default`);
    return {
      primaryScoreType: 'analysis scores',
      scoreFieldName: scoreConfig?.scoreFieldName || 'analysis_score',
      scoreDescription: 'General analysis rating',
      interpretationHigh: 'high performance',
      interpretationLow: 'low performance'
    };
  }
  
  // Combine ConfigurationManager data with terminology data
  return {
    ...terminologyConfig,
    scoreFieldName: scoreConfig?.scoreFieldName || terminologyConfig.scoreFieldName
  };
}

/**
 * Generate Claude-friendly score description for query enhancement
 * Ensures Claude explains the score calculation method at the beginning of the analysis
 */
export function generateScoreDescription(endpoint: string, query: string): string {
  const config = getScoreConfigForEndpoint(endpoint);
  const isRankingQuery = query.includes('rank') || query.includes('top') || query.includes('best');
  
  // For non-ranking queries, still add score explanation if scores are involved
  const hasScoreTerms = query.toLowerCase().includes('score') || 
                       query.toLowerCase().includes('performance') ||
                       query.toLowerCase().includes('analysis');
  
  if (!isRankingQuery && !hasScoreTerms) return query;
  
  const scoreText = config.secondaryScoreType 
    ? `${config.primaryScoreType} and ${config.secondaryScoreType}`
    : config.primaryScoreType;
  
  // Create comprehensive prompt that ensures score explanation comes first
  let enhancedQuery = query;
  
  if (isRankingQuery) {
    enhancedQuery += `\n\nPlease discuss the top 5-10 markets based on ${scoreText} (field: ${config.scoreFieldName}), providing specific market names and their scores.`;
  }
  
  // CRITICAL: Always prompt for score explanation at the beginning
  enhancedQuery += `\n\n**IMPORTANT: Begin your analysis by explaining in plain language how ${config.primaryScoreType} are calculated and what they measure.** Specifically explain that these scores represent ${config.scoreDescription}`;
  
  if (config.scoreRange) {
    enhancedQuery += ` on a scale of ${config.scoreRange}`;
  }
  
  enhancedQuery += `. Use easy-to-understand language rather than technical formulas. This explanation should lead your analysis before discussing specific market results.`;
  
  // EXPLICIT: Tell Claude exactly which field to use
  enhancedQuery += `\n\n**DATA ACCESS NOTE: The data includes a "${config.scoreFieldName}" field for each market. Use this field for your analysis rather than generic "opportunity_score" fields. Each market record contains specific ${config.primaryScoreType} in the "${config.scoreFieldName}" field.**`;
  
  if (config.secondaryScoreType) {
    enhancedQuery += ` Also briefly explain what ${config.secondaryScoreType} represent in this context.`;
  }
  
  return enhancedQuery;
}

/**
 * Validate that analysis result uses correct score terminology
 */
export function validateScoreTerminology(endpoint: string, analysisText: string): {
  isValid: boolean;
  expectedTerms: string[];
  foundTerms: string[];
  issues: string[];
} {
  const config = getScoreConfigForEndpoint(endpoint);
  const expectedTerms = [config.primaryScoreType];
  if (config.secondaryScoreType) {
    expectedTerms.push(config.secondaryScoreType);
  }
  
  const foundTerms = expectedTerms.filter(term => 
    analysisText.toLowerCase().includes(term.toLowerCase())
  );
  
  const issues: string[] = [];
  
  // Check for wrong terminology
  const allScoreTypes = Object.values(ENDPOINT_SCORE_CONFIG)
    .flatMap(c => [c.primaryScoreType, c.secondaryScoreType].filter(Boolean)) as string[];
  
  const wrongTerms = allScoreTypes.filter(term => 
    term !== config.primaryScoreType && 
    term !== config.secondaryScoreType &&
    analysisText.toLowerCase().includes(term.toLowerCase())
  );
  
  if (wrongTerms.length > 0) {
    issues.push(`Uses incorrect terminology: ${wrongTerms.join(', ')}`);
  }
  
  if (foundTerms.length === 0) {
    issues.push(`Missing expected terminology: ${expectedTerms.join(', ')}`);
  }
  
  return {
    isValid: issues.length === 0,
    expectedTerms,
    foundTerms,
    issues
  };
}

/**
 * Validate that Claude included score explanation at the beginning of analysis
 */
export function validateScoreExplanationPlacement(endpoint: string, analysisText: string): {
  hasExplanation: boolean;
  isAtBeginning: boolean;
  issues: string[];
} {
  const config = getScoreConfigForEndpoint(endpoint);
  const issues: string[] = [];
  
  // Check if analysis includes score explanation
  const explanationTerms = [
    'calculated',
    'measure',
    'represent',
    'score',
    config.primaryScoreType.toLowerCase()
  ];
  
  const hasExplanation = explanationTerms.some(term => 
    analysisText.toLowerCase().includes(term)
  );
  
  if (!hasExplanation) {
    issues.push('Analysis does not explain how scores are calculated');
  }
  
  // Check if explanation comes at the beginning (within first 200 characters)
  const firstParagraph = analysisText.substring(0, 200).toLowerCase();
  const isAtBeginning = explanationTerms.some(term => 
    firstParagraph.includes(term)
  );
  
  if (hasExplanation && !isAtBeginning) {
    issues.push('Score explanation is not at the beginning of the analysis');
  }
  
  return {
    hasExplanation,
    isAtBeginning,
    issues
  };
}

/**
 * Get all endpoint score mappings for testing purposes
 */
export function getAllEndpointScoreMappings(): Array<{
  endpoint: string;
  scoreType: string;
  description: string;
}> {
  return Object.entries(ENDPOINT_SCORE_CONFIG).map(([endpoint, config]) => ({
    endpoint,
    scoreType: config.primaryScoreType,
    description: config.scoreDescription
  }));
}