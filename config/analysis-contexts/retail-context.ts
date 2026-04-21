import { AnalysisContext } from './base-context';

/**
 * Retail/Brand Competition Analysis Configuration
 * Optimized for brand vs brand competition and market share analysis
 */
export const RETAIL_CONTEXT: AnalysisContext = {
  projectType: 'retail',
  domain: 'Brand Competition and Market Analysis',
  
  fieldMappings: {
    primaryMetric: ['strategic_score', 'competitive_advantage_score', 'brand_performance_gap', 'comparison_score', 'comparative_analysis_score'],
    secondaryMetrics: ['brand_a_share', 'brand_b_share', 'market_penetration', 'total_brand_share', 'market_gap'],
    populationField: ['total_population', 'market_size', 'customer_base', 'ECYPTAPOP'],
    incomeField: ['median_income', 'spending_power', 'disposable_income', 'ECYHRIAVG'],
    brandFields: ['mp30034a_b_p', 'nike_market_share', 'adidas_market_share', 'brand_a_share', 'brand_b_share'],
    competitiveFields: ['competitive_advantage_score', 'market_gap', 'brand_performance_gap', 'market_penetration'],
    geographicId: ['ID', 'store_id', 'market_id', 'zipcode', 'area_id'],
    descriptiveFields: ['DESCRIPTION', 'market_name', 'store_name', 'area_name']
  },
  
  terminology: {
    entityType: 'markets',
    metricName: 'competitive positioning',
    scoreDescription: 'brand performance and market advantage',
    comparisonContext: 'brand competition and market dynamics'
  },
  
  scoreRanges: {
    excellent: { 
      min: 75, 
      description: 'Dominant market position with strong competitive advantages',
      actionable: 'Leverage for aggressive expansion and premium positioning'
    },
    good: { 
      min: 50, 
      description: 'Strong competitive position with growth opportunities',
      actionable: 'Invest in market share growth and customer acquisition'
    },
    moderate: { 
      min: 25, 
      description: 'Competitive markets requiring strategic positioning',
      actionable: 'Focus on differentiation and tactical improvements'
    },
    poor: { 
      min: 0, 
      description: 'Challenging competitive environment with limited advantages',
      actionable: 'Consider strategic pivots or market exit strategies'
    }
  },
  
  summaryTemplates: {
    analysisTitle: '⚖️ Brand Competitive Analysis',
    methodologyExplanation: 'This analysis compares {metricName} across {entityType} using brand performance metrics and market share data.',
    insightPatterns: [
      '{primaryBrand} vs {secondaryBrand} competitive landscape analysis',
      'Average competitive advantage: {avgAdvantage} across {totalMarkets} {entityType}',
      'Market dominance: {dominantMarkets} {primaryBrand}-dominant vs {competitiveMarkets} competitive markets',
      'Brand presence: {avgBrandShare}% average market penetration',
      'Market opportunity: {avgMarketGap}% untapped potential',
      'Competitive intensity varies by {variationFactor}'
    ],
    recommendationPatterns: [
      'Leverage {excellentCount} dominant {entityType} for aggressive expansion',
      'Strengthen position in {goodCount} {entityType} with growth potential',
      'Develop strategies for {moderateCount} competitive {entityType}',
      'Consider repositioning in {poorCount} challenging {entityType}',
      'Capitalize on {primaryBrand} market leadership',
      'Defend against competitive threats in key markets'
    ]
  },
  
  processorConfig: {
    comparative: {
      comparisonType: 'categorical',
      groupingStrategy: 'region',
      normalizationMethod: 'global',
      entityLabels: { primary: 'Brand A', secondary: 'Brand B' }
    },
    competitive: {
      competitionType: 'market_share',
      benchmarkStrategy: 'peer_group',
      competitorIdentification: 'explicit'
    },
    demographic: {
      focusMetrics: ['customer_demographics', 'spending_patterns', 'brand_affinity'],
      segmentationCriteria: 'customer_segments'
    },
    strategic: {
      priorityFactors: ['market_share', 'competitive_advantage', 'growth_potential', 'brand_strength'],
      weightingScheme: 'weighted',
      strategicLenses: ['market_expansion', 'competitive_defense', 'brand_building']
    },
    trend: {
      timeHorizon: 'short_term',
      trendMetrics: ['market_share_change', 'competitive_dynamics', 'brand_momentum'],
      seasonalityAdjustment: true
    },
    spatial: {
      clusteringMethod: 'performance',
      proximityMetric: 'similarity',
      clusterSizePreference: 'adaptive'
    },
    ensemble: {
      methodWeights: {
        'competitive_analysis': 0.35,
        'market_analysis': 0.25,
        'brand_analysis': 0.25,
        'demographic_analysis': 0.15
      },
      consensusThreshold: 0.6,
      diversityBonus: true
    }
  }
};