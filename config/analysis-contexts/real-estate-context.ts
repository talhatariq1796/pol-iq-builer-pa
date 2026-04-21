import { AnalysisContext } from './base-context';

/**
 * Real Estate Analysis Configuration
 * Optimized for Quebec housing market analysis with household income and demographic data
 */
export const REAL_ESTATE_CONTEXT: AnalysisContext = {
  projectType: 'real-estate',
  domain: 'Quebec Housing Market Analysis',
  
  fieldMappings: {
    primaryMetric: ['strategic_score', 'thematic_value', 'ECYHRIAVG', 'household_income', 'value', 'housing_correlation_score', 'real_estate_analysis_score'],
    secondaryMetrics: ['ECYCDOOWCO', 'ECYTENOWN', 'ECYTENRENT', 'hot_growth_market_index', 'home_affordability_index', 'new_home_owner_index'],
    populationField: ['ECYPTAPOP', 'population', 'total_population', 'TOTPOP_CY', 'value_TOTPOP_CY'],
    incomeField: ['ECYHRIAVG', 'thematic_value', 'household_income', 'median_income', 'AVGHINC_CY', 'value_AVGHINC_CY'],
    housingFields: ['ECYTENOWN', 'ECYTENRENT', 'ECYCDOOWCO', 'ECYCDAPT', 'ECYCDHOUSE'],
    housingMarketFields: ['hot_growth_market_index', 'home_affordability_index', 'new_home_owner_index', 'median_home_price', 'housing_inventory_months'],
    demographicFields: ['ECYMTN2534', 'population_25_34', 'age_25_34', 'population_growth_rate'],
    geographicId: ['ID', 'FSA_ID', 'area_id', 'zipcode', 'GEOID'],
    descriptiveFields: ['DESCRIPTION', 'area_name', 'name', 'value_DESCRIPTION']
  },
  
  terminology: {
    entityType: 'geographic areas',
    metricName: 'household income levels',
    scoreDescription: 'economic prosperity and housing market strength',
    comparisonContext: 'regional housing market performance'
  },
  
  scoreRanges: {
    excellent: { 
      min: 75, 
      description: 'Premium housing markets with exceptional economic indicators',
      actionable: 'Ideal for luxury homebuyers and high-quality residential properties'
    },
    good: { 
      min: 50, 
      description: 'Strong housing markets with above-average economic performance',
      actionable: 'Suitable for quality homebuyers and solid residential properties'
    },
    moderate: { 
      min: 25, 
      description: 'Developing housing markets with moderate economic activity',
      actionable: 'Good opportunities for first-time homebuyers and affordable housing'
    },
    poor: { 
      min: 0, 
      description: 'Challenging markets requiring careful homebuyer consideration',
      actionable: 'Consider with government programs or community development support'
    }
  },
  
  summaryTemplates: {
    analysisTitle: '🏠 Real Estate Market Comparative Analysis',
    methodologyExplanation: 'This analysis compares {metricName} across {entityType} using household income and demographic data on a unified 0-100 scale.',
    insightPatterns: [
      'Average household income across analyzed {entityType}: ${avgIncome}',
      '{cityCount} cities analyzed with {totalAreas} total {entityType}',
      'Income distribution shows {distributionPattern} across regions',
      '{excellentCount} {entityType} identified as premium markets',
      '{goodCount} {entityType} show strong investment potential',
      'Market variance: ${incomeRange} across all areas'
    ],
    recommendationPatterns: [
      '{excellentCount} {entityType} identified for premium homebuyers and luxury properties',
      '{goodCount} {entityType} suitable for quality homebuyers and residential properties',
      '{moderateCount} {entityType} present first-time homebuyer and affordable housing opportunities',
      '{poorCount} {entityType} may benefit from government homebuyer programs',
      'Focus luxury homebuying in top {topCityName} areas',
      'Consider first-time homebuyer programs in developing markets'
    ]
  },
  
  processorConfig: {
    comparative: {
      comparisonType: 'geographic',
      groupingStrategy: 'city',
      normalizationMethod: 'global',
      entityLabels: { primary: 'Montreal', secondary: 'Quebec City' }
    },
    competitive: {
      competitionType: 'performance',
      benchmarkStrategy: 'top_performer',
      competitorIdentification: 'geographic'
    },
    demographic: {
      focusMetrics: ['household_income', 'population_density', 'housing_characteristics'],
      segmentationCriteria: 'income_quintiles',
      incomeQuintiles: [20, 40, 60, 80, 100]
    },
    strategic: {
      priorityFactors: ['household_income', 'population_growth', 'housing_affordability', 'market_accessibility'],
      weightingScheme: 'weighted',
      strategicLenses: ['market_potential', 'homeowner_opportunity', 'market_conditions']
    },
    trend: {
      timeHorizon: 'medium_term',
      trendMetrics: ['income_growth', 'population_change', 'housing_demand'],
      seasonalityAdjustment: false
    },
    spatial: {
      clusteringMethod: 'geographic',
      proximityMetric: 'distance',
      clusterSizePreference: 'medium'
    },
    ensemble: {
      methodWeights: {
        'income_analysis': 0.4,
        'demographic_analysis': 0.3,
        'geographic_analysis': 0.2,
        'market_analysis': 0.1
      },
      consensusThreshold: 0.7,
      diversityBonus: true
    }
  }
};