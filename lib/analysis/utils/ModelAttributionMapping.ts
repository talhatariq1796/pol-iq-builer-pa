/**
 * Model Attribution Mapping - Centralized mapping for model names and calculation methods
 * Extracted from endpoints.csv for consistency across the application
 */

export const MODEL_NAME_MAPPING: Record<string, string> = {
  'strategic-analysis': 'Strategic Analysis Model',
  'competitive-analysis': 'Competitive Analysis Model',
  'demographic-insights': 'Demographic Analysis Model',
  'comparative-analysis': 'Ensemble Model',
  'correlation-analysis': 'Correlation Analysis Model',
  'predictive-modeling': 'Predictive Modeling',
  'trend-analysis': 'XGBoost Model',
  'spatial-clusters': 'Clustering Model (K-Means)',
  'anomaly-detection': 'Anomaly Detection Model',
  'scenario-analysis': 'Ensemble Model',
  'segment-profiling': 'Clustering Model',
  'sensitivity-analysis': 'Random Forest Model',
  'feature-interactions': 'XGBoost Model',
  'feature-importance-ranking': 'Ensemble Model',
  'model-performance': 'Ensemble Model',
  'outlier-detection': 'Anomaly Detection Model',
  'analyze': 'Ensemble Model',
  'brand-difference': 'Competitive Analysis Model',
  'customer-profile': 'Demographic Analysis Model',
  'algorithm-comparison': 'Ensemble + All 8 Algorithms',
  'ensemble-analysis': 'Ensemble Model',
  'model-selection': 'Ensemble + Performance Analysis',
  'cluster-analysis': 'Enhanced Clustering (8 Clusters)',
  'anomaly-insights': 'Enhanced Anomaly Detection',
  'dimensionality-insights': 'PCA (91.7% Variance Explained)',
  'consensus-analysis': 'Multi-Model Consensus'
};

export const SCORE_CALCULATION_MAPPING: Record<string, string> = {
  'Strategic Analysis Model': 'Investment potential weighted by market factors, growth indicators, and competitive positioning',
  'Competitive Analysis Model': 'Market share potential × brand positioning strength × competitive advantage factors',
  'Demographic Analysis Model': 'Population favorability score based on target demographic alignment and density',
  'Ensemble Model': 'Relative performance scoring × comparative advantage × market positioning strength',
  'Correlation Analysis Model': 'Statistical correlation strength weighted by significance and business relevance',
  'Predictive Modeling': 'Future trend probability × prediction confidence × model accuracy (ensemble weighted)',
  'XGBoost Model': 'Temporal pattern strength × trend consistency × directional confidence',
  'Clustering Model (K-Means)': 'Cluster cohesion score × geographic density × within-cluster similarity',
  'Anomaly Detection Model': 'Statistical deviation magnitude × outlier significance × detection confidence',
  'Clustering Model': 'Segment distinctiveness × profile clarity × business value potential',
  'Random Forest Model': 'Parameter impact magnitude × sensitivity coefficient × business criticality',
  'Ensemble + All 8 Algorithms': 'Algorithm performance weighted average × consensus strength × prediction reliability',
  'Ensemble + Performance Analysis': 'Algorithm suitability × expected performance × interpretability × data characteristics',
  'Enhanced Clustering (8 Clusters)': 'Cluster quality × segment distinctiveness × business value × market opportunity',
  'Enhanced Anomaly Detection': 'Anomaly significance × opportunity potential × investigation priority × market value',
  'PCA (91.7% Variance Explained)': 'Feature compression efficiency × component significance × variance explanation × complexity reduction',
  'Multi-Model Consensus': 'Model agreement score × consensus confidence × uncertainty quantification × prediction reliability'
};

/**
 * Get the score calculation method for a given model name
 */
export function getScoreCalculationMethod(modelName: string): string {
  return SCORE_CALCULATION_MAPPING[modelName] || 'Score calculation method not available for this model';
}