// Export all data processor strategies
export { CoreAnalysisProcessor } from './CoreAnalysisProcessor';
export { ClusterDataProcessor } from './ClusterDataProcessor';
export { CompetitiveDataProcessor } from './CompetitiveDataProcessor';
export { DemographicDataProcessor } from './DemographicDataProcessor';
export { CorrelationAnalysisProcessor } from './CorrelationAnalysisProcessor';
export { TrendDataProcessor } from './TrendDataProcessor';

// Unified Configuration System Processors (New Architecture)
export { UnifiedCMAProcessor } from './UnifiedCMAProcessor';
export { EnhancedBaseProcessor } from './EnhancedBaseProcessor';

// Real Estate Specific Processors
export { MarketTrendAnalysisProcessor } from './MarketTrendAnalysisProcessor';
export { PricePredictionProcessor } from './PricePredictionProcessor';
export { RentalAnalysisProcessor } from './RentalAnalysisProcessor';
export { InvestmentOpportunityProcessor } from './InvestmentOpportunityProcessor';
export { CMAProcessor } from './CMAProcessor';
export { RiskDataProcessor } from './RiskDataProcessor';
export { TrendAnalysisProcessor } from './TrendAnalysisProcessor';
export { AnomalyDetectionProcessor } from './AnomalyDetectionProcessor';
export { FeatureInteractionProcessor } from './FeatureInteractionProcessor';
export { OutlierDetectionProcessor } from './OutlierDetectionProcessor';
export { ComparativeAnalysisProcessor } from './ComparativeAnalysisProcessor';
export { PredictiveModelingProcessor } from './PredictiveModelingProcessor';
export { SegmentProfilingProcessor } from './SegmentProfilingProcessor';
export { ScenarioAnalysisProcessor } from './ScenarioAnalysisProcessor';
export { MarketSizingProcessor } from './MarketSizingProcessor';
export { BrandAnalysisProcessor } from './BrandAnalysisProcessor';
export { BrandDifferenceProcessor } from './BrandDifferenceProcessor';
export { RealEstateAnalysisProcessor } from './RealEstateAnalysisProcessor';
export { StrategicAnalysisProcessor } from './StrategicAnalysisProcessor';
export { CustomerProfileProcessor } from './CustomerProfileProcessor';
export { SensitivityAnalysisProcessor } from './SensitivityAnalysisProcessor';
// DISABLED: Technical ML processors not relevant for real estate brokers
// export { ModelPerformanceProcessor } from './ModelPerformanceProcessor';
// export { ModelSelectionProcessor } from './ModelSelectionProcessor';
// export { EnsembleAnalysisProcessor } from './EnsembleAnalysisProcessor';
// OPTIONAL: May be useful for real estate feature analysis
// export { FeatureImportanceRankingProcessor } from './FeatureImportanceRankingProcessor';
// export { DimensionalityInsightsProcessor } from './DimensionalityInsightsProcessor';
// ACTIVE: Keep spatial and consensus analysis for real estate
export { SpatialClustersProcessor } from './SpatialClustersProcessor';
export { ConsensusAnalysisProcessor } from './ConsensusAnalysisProcessor';
// DISABLED: Algorithm comparison not relevant for brokers
// export { AlgorithmComparisonProcessor } from './AlgorithmComparisonProcessor';
export { AnalyzeProcessor } from './AnalyzeProcessor';

// Advanced Analysis Processors (Previously Disabled Categories)
export { NonlinearAnalysisProcessor } from './NonlinearAnalysisProcessor';
export { SimilarityAnalysisProcessor } from './SimilarityAnalysisProcessor';
export { FeatureSelectionAnalysisProcessor } from './FeatureSelectionAnalysisProcessor';
export { InterpretabilityAnalysisProcessor } from './InterpretabilityAnalysisProcessor';
// DISABLED: Neural network analysis too technical for real estate brokers
// export { NeuralNetworkAnalysisProcessor } from './NeuralNetworkAnalysisProcessor';
export { SpeedOptimizedAnalysisProcessor } from './SpeedOptimizedAnalysisProcessor';

// TODO: Export additional processors as they're developed
// export { OptimizationDataProcessor } from './OptimizationDataProcessor';

/**
 * Available processor types for different analysis endpoints
 */
export const PROCESSOR_TYPES = {
  CORE_ANALYSIS: 'core_analysis',
  CLUSTER_ANALYSIS: 'spatial_clustering', 
  COMPETITIVE_ANALYSIS: 'competitive_analysis',
  DEMOGRAPHIC_ANALYSIS: 'demographic_analysis',
  CORRELATION_ANALYSIS: 'correlation_analysis',
  TREND_ANALYSIS: 'trend_analysis',
  RISK_ANALYSIS: 'risk_analysis',
  FEATURE_INTERACTIONS: 'feature_interactions',
  OUTLIER_DETECTION: 'outlier_detection',
  ANOMALY_DETECTION: 'anomaly_detection',
  PREDICTIVE_MODELING: 'predictive_modeling',
  SCENARIO_ANALYSIS: 'scenario_analysis',
  SEGMENT_PROFILING: 'segment_profiling',
  BRAND_DIFFERENCE: 'brand_difference',
  SENSITIVITY_ANALYSIS: 'sensitivity_analysis',
  // DISABLED: Technical ML analysis types not relevant for real estate brokers
  // MODEL_PERFORMANCE: 'model_performance',
  // MODEL_SELECTION: 'model_selection', 
  // ENSEMBLE_ANALYSIS: 'ensemble_analysis',
  // OPTIONAL: May be useful for real estate analysis
  // FEATURE_IMPORTANCE_RANKING: 'feature_importance_ranking',
  // DIMENSIONALITY_INSIGHTS: 'dimensionality_insights',
  // ACTIVE: Keep spatial and consensus for real estate
  SPATIAL_CLUSTERS: 'spatial_clusters',
  CONSENSUS_ANALYSIS: 'consensus_analysis',
  // DISABLED: Algorithm comparison not relevant for brokers
  // ALGORITHM_COMPARISON: 'algorithm_comparison',
  ANALYZE: 'analyze',
  // Unified Configuration System Processors
  UNIFIED_CMA: 'unified_cma',
  // Advanced Analysis Types (Previously Disabled Categories)
  NONLINEAR_ANALYSIS: 'nonlinear_analysis',
  SIMILARITY_ANALYSIS: 'similarity_analysis',
  FEATURE_SELECTION_ANALYSIS: 'feature_selection_analysis',
  INTERPRETABILITY_ANALYSIS: 'interpretability_analysis',
  // DISABLED: Neural network analysis too technical for brokers
  // NEURAL_NETWORK_ANALYSIS: 'neural_network_analysis',
  SPEED_OPTIMIZED_ANALYSIS: 'speed_optimized_analysis',
  // Real Estate Specific Analysis Types
  MARKET_TREND_ANALYSIS: 'market_trend_analysis',
  PRICE_PREDICTION: 'price_prediction',
  RENTAL_ANALYSIS: 'rental_analysis',
  INVESTMENT_OPPORTUNITY: 'investment_opportunity',
  CMA_ANALYSIS: 'cma_analysis'
} as const;

/**
 * Processor registry for mapping endpoints to processor types
 */
export const ENDPOINT_PROCESSOR_MAP = {
  '/analyze': PROCESSOR_TYPES.ANALYZE,
  '/spatial-clusters': PROCESSOR_TYPES.SPATIAL_CLUSTERS,
  '/competitive-analysis': PROCESSOR_TYPES.COMPETITIVE_ANALYSIS,
  '/demographic-insights': PROCESSOR_TYPES.DEMOGRAPHIC_ANALYSIS,
  '/trend-analysis': PROCESSOR_TYPES.TREND_ANALYSIS,
  '/risk-analysis': PROCESSOR_TYPES.RISK_ANALYSIS,
  '/correlation-analysis': PROCESSOR_TYPES.CORRELATION_ANALYSIS,
  '/threshold-analysis': PROCESSOR_TYPES.CORE_ANALYSIS,
  // Use specialized processors for endpoints that have them
  '/feature-interactions': PROCESSOR_TYPES.FEATURE_INTERACTIONS,
  '/outlier-detection': PROCESSOR_TYPES.OUTLIER_DETECTION,
  '/anomaly-detection': PROCESSOR_TYPES.ANOMALY_DETECTION,
  '/comparative-analysis': PROCESSOR_TYPES.COMPETITIVE_ANALYSIS,
  '/predictive-modeling': PROCESSOR_TYPES.PREDICTIVE_MODELING,
  '/scenario-analysis': PROCESSOR_TYPES.SCENARIO_ANALYSIS,
  '/segment-profiling': PROCESSOR_TYPES.SEGMENT_PROFILING,
  '/brand-difference': PROCESSOR_TYPES.BRAND_DIFFERENCE,
  // All endpoints now have specialized processors
  '/sensitivity-analysis': PROCESSOR_TYPES.SENSITIVITY_ANALYSIS,
  // DISABLED: Technical ML endpoints not relevant for real estate brokers
  // '/model-performance': PROCESSOR_TYPES.MODEL_PERFORMANCE,
  // '/model-selection': PROCESSOR_TYPES.MODEL_SELECTION,
  // '/ensemble-analysis': PROCESSOR_TYPES.ENSEMBLE_ANALYSIS,
  // OPTIONAL: May be useful for real estate feature analysis 
  // '/feature-importance-ranking': PROCESSOR_TYPES.FEATURE_IMPORTANCE_RANKING,
  // '/dimensionality-insights': PROCESSOR_TYPES.DIMENSIONALITY_INSIGHTS,
  // ACTIVE: Keep consensus analysis for real estate
  '/consensus-analysis': PROCESSOR_TYPES.CONSENSUS_ANALYSIS,
  // DISABLED: Algorithm comparison not relevant for brokers
  // '/algorithm-comparison': PROCESSOR_TYPES.ALGORITHM_COMPARISON,
  // Advanced Analysis Endpoints (Previously Disabled Categories)
  '/nonlinear-analysis': PROCESSOR_TYPES.NONLINEAR_ANALYSIS,
  '/similarity-analysis': PROCESSOR_TYPES.SIMILARITY_ANALYSIS,
  '/feature-selection-analysis': PROCESSOR_TYPES.FEATURE_SELECTION_ANALYSIS,
  '/interpretability-analysis': PROCESSOR_TYPES.INTERPRETABILITY_ANALYSIS,
  // DISABLED: Neural network endpoint too technical for brokers
  // '/neural-network-analysis': PROCESSOR_TYPES.NEURAL_NETWORK_ANALYSIS,
  '/speed-optimized-analysis': PROCESSOR_TYPES.SPEED_OPTIMIZED_ANALYSIS,
  // Real Estate Specific Endpoints
  '/market-trend-analysis': PROCESSOR_TYPES.MARKET_TREND_ANALYSIS,
  '/price-prediction-analysis': PROCESSOR_TYPES.PRICE_PREDICTION,
  '/rental-market-analysis': PROCESSOR_TYPES.RENTAL_ANALYSIS,
  '/investment-opportunities': PROCESSOR_TYPES.INVESTMENT_OPPORTUNITY,
  '/comparative-market-analysis': PROCESSOR_TYPES.CMA_ANALYSIS,
  // Unified Configuration System Endpoints
  '/unified-cma': PROCESSOR_TYPES.UNIFIED_CMA
} as const; 