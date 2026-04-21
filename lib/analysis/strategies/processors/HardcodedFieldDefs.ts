/*
 * Hardcoded field definitions and primary score mapping
 * Centralizes deterministic field choices for processors.
 */
export function getPrimaryScoreField(analysisType: string, metadata?: Record<string, unknown> | undefined): string {
  if (metadata && typeof (metadata as Record<string, unknown>)['targetVariable'] === 'string') {
    return (metadata as Record<string, unknown>)['targetVariable'] as string;
  }
  const n = String(analysisType || '').toLowerCase().replace(/-/g, '_');
  const mapping: Record<string, string> = {
    // Use legacy primary score field names expected by existing processors/tests
    strategic_analysis: 'strategic_score',
    strategic: 'strategic_score',
    algorithm_comparison: 'algorithm_comparison_score',
    analyze: 'analysis_score',
    anomaly_detection: 'anomaly_score',
    anomaly_insights: 'anomaly_score',
    brand_difference: 'brand_difference_score',
    comparative_analysis: 'comparison_score',
    comparative: 'comparison_score',
    competitive_analysis: 'competitive_analysis_score',
    competitive: 'competitive_analysis_score',
    consensus_analysis: 'consensus_analysis_score',
    correlation_analysis: 'correlation_score',
    // demographic variants: map to legacy demographic_score for compatibility
    demographic_insights: 'demographic_score',
    demographic_analysis: 'demographic_score',
    demographic: 'demographic_score',
    dimensionality_insights: 'dimensionality_insights_score',
    ensemble_analysis: 'ensemble_analysis_score',
    feature_interactions: 'interaction_score',
    interaction: 'interaction_score',
    model_performance: 'model_performance_prediction_score',
    model_selection: 'algorithm_category',
    outlier_detection: 'outlier_score',
    predictive_modeling: 'prediction_score',
    prediction: 'prediction_score',
    scenario_analysis: 'scenario_score',
    segment_profiling: 'segment_score',
    sensitivity_analysis: 'sensitivity_score',
    spatial_clusters: 'cluster_score',
    cluster: 'cluster_score',
    customer_profile: 'customer_profile_score',
    similarity_analysis: 'similarity_performance_score',
    speed_optimized_analysis: 'speed_optimized_score',
    trend_analysis: 'trend_score',
    trend: 'trend_score',
    market_trend_analysis: 'price_delta_prediction',
    market_trend: 'price_delta_prediction',
    // Additional endpoints discovered in public/data/blob-urls.json
    feature_importance_ranking: 'importance_score',
    market_intelligence_report: 'strategic_score',
    // Housing market correlation analysis
    housing_market_correlation: 'housing_correlation_score',
    housing_correlation: 'housing_correlation_score',
    // Additional analysis endpoints from blob-urls.json
    feature_selection_analysis: 'feature_selection_score',
    interpretability_analysis: 'interpretability_score',
    neural_network_analysis: 'neural_network_score',
    nonlinear_analysis: 'nonlinear_score',
    composite_index: 'composite_index_score'
  };
  return mapping[n] || 'value';
}

export function getTopFieldDefinitions(analysisType: string): Array<{ field: string; source: string | string[]; importance: number; calculated?: boolean }> {
  const n = String(analysisType || '').toLowerCase().replace(/[-_]/g, '');

  // Provide a conservative, stable set of contributing fields per analysis type
  switch (n) {
    case 'strategic':
    case 'strategicanalysis':
      return [
        { field: 'ECYPTAPOP', source: ['ECYPTAPOP', 'total_population', 'population', 'TOTPOP_CY', 'value_TOTPOP_CY'], importance: 20 },
        { field: 'ECYHRIAVG', source: ['ECYHRIAVG', 'median_income', 'AVGHINC_CY', 'value_AVGHINC_CY', 'household_income'], importance: 18 },
        { field: 'ECYTENOWN', source: ['ECYTENOWN', 'home_ownership_count', 'homeowners'], importance: 16 },
        { field: 'ECYTENRENT', source: ['ECYTENRENT', 'rental_count', 'renters'], importance: 15 },
        { field: 'ECYMTN2534', source: ['ECYMTN2534', 'population_25_34', 'age_25_34'], importance: 14 }
      ];
    case 'competitive':
    case 'competitiveanalysis':
      return [
        { field: 'competitive_advantage_score', source: ['competitive_advantage_score', 'competitive_score'], importance: 30 },
        { field: 'target_brand_share', source: ['target_brand_share', 'brand_share'], importance: 18 },
        { field: 'market_gap', source: ['market_gap', 'opportunity_gap'], importance: 14 }
      ];
    case 'demographic':
    case 'demographicinsights':
      return [
        { field: 'total_population', source: ['total_population', 'population'], importance: 30 },
        { field: 'median_income', source: ['median_income', 'AVGHINC_CY'], importance: 25 },
        { field: 'diversity_index', source: ['diversity_index', 'DIVINDX_CY'], importance: 10 }
      ];
    case 'branddifference':
    case 'brandanalysis':
    case 'comparativeanalysis':
      return [
        { field: 'brand_difference_score', source: ['brand_difference_score', 'comparison_score', 'comparison'], importance: 28 },
        { field: 'target_brand_share', source: ['target_brand_share', 'brand_share'], importance: 18 },
        { field: 'market_gap', source: ['market_gap'], importance: 12 }
      ];
    case 'housingmarketcorrelation':
    case 'housingcorrelation':
      return [
        { field: 'hot_growth_market_index', source: ['hot_growth_market_index', 'growth_index', 'market_growth'], importance: 25 },
        { field: 'home_affordability_index', source: ['home_affordability_index', 'affordability_index', 'housing_affordability'], importance: 25 },
        { field: 'new_home_owner_index', source: ['new_home_owner_index', 'new_owner_index', 'homeowner_index'], importance: 20 },
        { field: 'median_home_price', source: ['median_home_price', 'home_price', 'housing_price'], importance: 15 },
        { field: 'population_growth_rate', source: ['population_growth_rate', 'pop_growth', 'growth_rate'], importance: 10 },
        { field: 'housing_inventory_months', source: ['housing_inventory_months', 'inventory_months', 'supply_months'], importance: 5 }
      ];
    default:
      // Generic fallback: common useful fields
      return [
        { field: 'target_value', source: ['target_value', 'value', 'score'], importance: 20 },
        { field: 'total_population', source: ['total_population', 'population'], importance: 12 },
        { field: 'median_income', source: ['median_income', 'AVGHINC_CY'], importance: 10 }
      ];
  }
}

// Named exports only to satisfy lint rules
// keep named exports
