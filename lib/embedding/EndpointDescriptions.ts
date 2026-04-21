/**
 * EndpointDescriptions - Real Estate Analysis Endpoints
 * 
 * Rich descriptions including sample queries, field mappings, use cases,
 * and business context for each real estate analysis endpoint.
 */

export interface EndpointDescription {
  endpoint: string;
  title: string;
  description: string;
  sampleQueries: string[];
  fieldMappings: string[];
  useCases: string[];
  businessContext: string;
  keywords: string[];
  semanticConcepts: string[];
}

export const ENDPOINT_DESCRIPTIONS: Record<string, EndpointDescription> = {
  '/strategic-analysis': {
    endpoint: '/strategic-analysis',
    title: 'Strategic Real Estate Market Analysis',
    description: 'Comprehensive strategic analysis for real estate investment decisions, market expansion planning, and portfolio optimization. Identifies high-potential markets for property investment and development.',
    sampleQueries: [
      'Which neighborhoods offer the best strategic investment opportunities?',
      'Top strategic markets for real estate portfolio expansion',
      'Best areas for new real estate office locations',
      'Strategic analysis for property development opportunities',
      'Investment-grade markets with highest ROI potential'
    ],
    fieldMappings: ['strategic_score', 'investment_potential', 'market_opportunity', 'roi_projection'],
    useCases: ['Investment strategy', 'Market expansion', 'Portfolio planning', 'Development opportunities'],
    businessContext: 'Strategic planning for real estate investors, brokers, and developers',
    keywords: ['strategic', 'investment', 'expansion', 'portfolio', 'opportunities', 'ROI'],
    semanticConcepts: ['market analysis', 'investment strategy', 'business planning', 'growth opportunities']
  },

  '/comparative-market-analysis': {
    endpoint: '/comparative-market-analysis',
    title: 'Comparative Market Analysis (CMA)',
    description: 'Professional CMA reports comparing property values, market conditions, and pricing trends. Essential for pricing strategies and market positioning.',
    sampleQueries: [
      'Generate comprehensive CMA report for this area',
      'Compare homeownership rates between neighborhoods',
      'Compare sold vs asking prices across Montreal FSAs',
      'Show me price trends in different neighborhoods',
      'CMA analysis for property valuation'
    ],
    fieldMappings: ['comparative_score', 'market_positioning', 'price_comparison', 'valuation_metrics'],
    useCases: ['Property pricing', 'Market comparisons', 'Valuation reports', 'Pricing strategy'],
    businessContext: 'Essential tool for real estate brokers and appraisers',
    keywords: ['CMA', 'comparative', 'market', 'analysis', 'pricing', 'valuation'],
    semanticConcepts: ['property comparison', 'market valuation', 'pricing analysis', 'comparable sales']
  },

  '/affordability-analysis': {
    endpoint: '/affordability-analysis',
    title: 'Housing Affordability Analysis',
    description: 'Analyzes housing affordability trends, buyer purchasing power, and market accessibility for different income levels.',
    sampleQueries: [
      'What homes can buyers afford in this area?',
      'Show me affordability trends across neighborhoods',
      'Which areas offer the best value for money?',
      'Housing affordability for first-time buyers',
      'Affordability index for this market'
    ],
    fieldMappings: ['affordability_score', 'price_to_income_ratio', 'affordability_index', 'buyer_capacity'],
    useCases: ['Buyer qualification', 'Market accessibility', 'Affordability trends', 'Value analysis'],
    businessContext: 'Helps buyers and brokers understand market accessibility',
    keywords: ['affordability', 'value', 'buyers', 'income', 'accessibility', 'budget'],
    semanticConcepts: ['housing affordability', 'buyer capacity', 'value proposition', 'market accessibility']
  },

  '/demographic-analysis': {
    endpoint: '/demographic-analysis',
    title: 'Demographic Market Analysis',
    description: 'Comprehensive demographic analysis showing population trends, buyer profiles, and market characteristics by area.',
    sampleQueries: [
      'What are the demographics of this neighborhood?',
      'Which areas are popular with first-time buyers?',
      'Show me demographic trends affecting property values',
      'Demographic profile of potential buyers',
      'Population trends impacting real estate'
    ],
    fieldMappings: ['demographic_score', 'population_trends', 'buyer_profiles', 'market_demographics'],
    useCases: ['Target market identification', 'Buyer profiling', 'Market segmentation', 'Demographic trends'],
    businessContext: 'Understanding buyer demographics and market composition',
    keywords: ['demographics', 'population', 'buyers', 'trends', 'profiles', 'characteristics'],
    semanticConcepts: ['population analysis', 'buyer demographics', 'market segmentation', 'demographic trends']
  },

  '/development-potential-analysis': {
    endpoint: '/development-potential-analysis',
    title: 'Development Potential Analysis',
    description: 'Evaluates development opportunities, zoning potential, and property development feasibility across different areas.',
    sampleQueries: [
      'Which areas have the best development potential?',
      'Show me properties suitable for development',
      'What are the zoning opportunities in this area?',
      'Development feasibility analysis',
      'Best locations for new construction'
    ],
    fieldMappings: ['development_score', 'zoning_potential', 'development_feasibility', 'construction_opportunity'],
    useCases: ['Property development', 'Zoning analysis', 'Construction planning', 'Land development'],
    businessContext: 'Essential for developers and construction companies',
    keywords: ['development', 'construction', 'zoning', 'potential', 'feasibility', 'building'],
    semanticConcepts: ['property development', 'construction opportunities', 'zoning analysis', 'land development']
  },

  '/gentrification-analysis': {
    endpoint: '/gentrification-analysis',
    title: 'Gentrification Analysis',
    description: 'Analyzes gentrification trends, neighborhood changes, and evolving market dynamics affecting property values.',
    sampleQueries: [
      'Which neighborhoods are experiencing gentrification?',
      'Show me areas with changing demographics',
      'What are the gentrification trends in this market?',
      'Neighborhood transformation analysis',
      'Areas undergoing urban renewal'
    ],
    fieldMappings: ['gentrification_score', 'neighborhood_change', 'transformation_index', 'urban_renewal'],
    useCases: ['Neighborhood analysis', 'Investment timing', 'Market transformation', 'Urban planning'],
    businessContext: 'Understanding neighborhood evolution and market dynamics',
    keywords: ['gentrification', 'neighborhood', 'change', 'transformation', 'urban', 'renewal'],
    semanticConcepts: ['neighborhood transformation', 'urban development', 'market evolution', 'demographic shifts']
  },

  '/growth-potential-analysis': {
    endpoint: '/growth-potential-analysis',
    title: 'Growth Potential Analysis',
    description: 'Identifies areas with highest growth potential, appreciation prospects, and emerging market opportunities.',
    sampleQueries: [
      'Which areas have the highest growth potential?',
      'Show me neighborhoods with appreciation potential',
      'What drives growth in this market?',
      'Emerging markets with growth prospects',
      'Best areas for long-term appreciation'
    ],
    fieldMappings: ['growth_score', 'appreciation_potential', 'growth_indicators', 'market_momentum'],
    useCases: ['Investment planning', 'Growth forecasting', 'Market timing', 'Portfolio optimization'],
    businessContext: 'Critical for investors seeking appreciation opportunities',
    keywords: ['growth', 'appreciation', 'potential', 'emerging', 'prospects', 'momentum'],
    semanticConcepts: ['market growth', 'appreciation potential', 'emerging opportunities', 'investment prospects']
  },

  '/investment-opportunities': {
    endpoint: '/investment-opportunities',
    title: 'Investment Opportunities Analysis',
    description: 'Comprehensive analysis of real estate investment opportunities, ROI potential, and investment-grade properties.',
    sampleQueries: [
      'Which properties offer the best investment potential?',
      'Show me emerging neighborhoods for real estate investment',
      'What are the top investment opportunities in the area?',
      'Best ROI properties in this market',
      'Investment-grade real estate opportunities'
    ],
    fieldMappings: ['investment_score', 'roi_potential', 'investment_grade', 'opportunity_index'],
    useCases: ['Property investment', 'ROI analysis', 'Investment screening', 'Portfolio building'],
    businessContext: 'Essential for real estate investors and fund managers',
    keywords: ['investment', 'ROI', 'opportunities', 'returns', 'portfolio', 'yield'],
    semanticConcepts: ['investment analysis', 'ROI potential', 'property investment', 'investment opportunities']
  },

  '/market-liquidity-analysis': {
    endpoint: '/market-liquidity-analysis',
    title: 'Market Liquidity Analysis',
    description: 'Analyzes market liquidity, property turnover rates, and how quickly properties sell in different areas.',
    sampleQueries: [
      'How liquid is the market in this area?',
      'Which properties sell fastest?',
      'Show me market velocity indicators',
      'Market liquidity by neighborhood',
      'Time on market analysis'
    ],
    fieldMappings: ['liquidity_score', 'market_velocity', 'turnover_rate', 'days_on_market'],
    useCases: ['Market timing', 'Pricing strategy', 'Inventory management', 'Sales forecasting'],
    businessContext: 'Important for pricing and marketing strategies',
    keywords: ['liquidity', 'velocity', 'turnover', 'speed', 'market', 'selling'],
    semanticConcepts: ['market liquidity', 'property turnover', 'sales velocity', 'market dynamics']
  },

  '/market-saturation-analysis': {
    endpoint: '/market-saturation-analysis',
    title: 'Market Saturation Analysis',
    description: 'Evaluates market saturation levels, supply-demand balance, and competitive landscape intensity.',
    sampleQueries: [
      'Is this market oversaturated?',
      'Show me supply and demand balance',
      'What is the competitive landscape?',
      'Market saturation by area',
      'Supply vs demand analysis'
    ],
    fieldMappings: ['saturation_score', 'supply_demand_ratio', 'competitive_intensity', 'market_balance'],
    useCases: ['Market entry decisions', 'Competitive analysis', 'Supply planning', 'Market positioning'],
    businessContext: 'Critical for market entry and competitive positioning',
    keywords: ['saturation', 'supply', 'demand', 'competition', 'balance', 'market'],
    semanticConcepts: ['market saturation', 'supply-demand balance', 'competitive landscape', 'market dynamics']
  },

  '/market-trend-analysis': {
    endpoint: '/market-trend-analysis',
    title: 'Market Trend Analysis',
    description: 'Comprehensive analysis of market trends, price movements, and directional indicators for informed decision-making.',
    sampleQueries: [
      'Show me current market trends',
      'What direction is this market heading?',
      'Analyze price trend patterns',
      'Market trend forecasting',
      'Price movement analysis'
    ],
    fieldMappings: ['trend_score', 'price_direction', 'market_momentum', 'trend_indicators'],
    useCases: ['Market forecasting', 'Trend analysis', 'Price prediction', 'Market timing'],
    businessContext: 'Essential for strategic market decisions',
    keywords: ['trends', 'direction', 'momentum', 'patterns', 'forecasting', 'movement'],
    semanticConcepts: ['market trends', 'price trends', 'market direction', 'trend analysis']
  },

  '/neighborhood-quality-analysis': {
    endpoint: '/neighborhood-quality-analysis',
    title: 'Neighborhood Quality Analysis',
    description: 'Evaluates neighborhood quality factors, amenities, and desirability indicators that affect property values.',
    sampleQueries: [
      'What makes this a desirable neighborhood?',
      'Show me neighborhood quality indicators',
      'How does this area compare to others?',
      'Neighborhood amenity analysis',
      'Quality of life factors'
    ],
    fieldMappings: ['quality_score', 'amenity_index', 'desirability_rating', 'neighborhood_rank'],
    useCases: ['Neighborhood comparison', 'Quality assessment', 'Buyer guidance', 'Market positioning'],
    businessContext: 'Helps buyers understand neighborhood value propositions',
    keywords: ['quality', 'neighborhood', 'amenities', 'desirable', 'lifestyle', 'community'],
    semanticConcepts: ['neighborhood quality', 'community amenities', 'quality of life', 'area desirability']
  },

  '/price-prediction-analysis': {
    endpoint: '/price-prediction-analysis',
    title: 'Price Prediction Analysis',
    description: 'Advanced predictive modeling for future property values, price forecasting, and market trend predictions.',
    sampleQueries: [
      'What will prices look like in 6 months?',
      'Predict future property values',
      'Show me price forecasting for this area',
      'Price prediction modeling',
      'Future market value estimates'
    ],
    fieldMappings: ['predicted_price', 'price_forecast', 'prediction_confidence', 'forecast_range'],
    useCases: ['Price forecasting', 'Investment timing', 'Market planning', 'Valuation predictions'],
    businessContext: 'Critical for investment and pricing decisions',
    keywords: ['prediction', 'forecast', 'future', 'modeling', 'estimates', 'projections'],
    semanticConcepts: ['price prediction', 'market forecasting', 'predictive modeling', 'value forecasting']
  },

  '/rental-market-analysis': {
    endpoint: '/rental-market-analysis',
    title: 'Rental Market Analysis',
    description: 'Comprehensive rental market analysis including rental rates, yield analysis, and investment property performance.',
    sampleQueries: [
      'What are current rental rates in this neighborhood?',
      'Show me rental yield analysis for investment properties',
      'Compare rental vs purchase costs in this area',
      'Rental market trends',
      'Investment property cash flow analysis'
    ],
    fieldMappings: ['rental_rate', 'rental_yield', 'cash_flow', 'cap_rate'],
    useCases: ['Rental pricing', 'Investment analysis', 'Yield calculations', 'Cash flow planning'],
    businessContext: 'Essential for rental property investors and landlords',
    keywords: ['rental', 'yield', 'cash flow', 'cap rate', 'investment', 'income'],
    semanticConcepts: ['rental market', 'investment yield', 'cash flow analysis', 'rental pricing']
  },

  '/risk-assessment-analysis': {
    endpoint: '/risk-assessment-analysis',
    title: 'Real Estate Risk Assessment',
    description: 'Comprehensive risk analysis for real estate investments, market volatility assessment, and risk mitigation strategies.',
    sampleQueries: [
      'What are the market risks for this area?',
      'Show me properties with price volatility concerns',
      'Which neighborhoods have the most stable values?',
      'Investment risk analysis',
      'Market stability assessment'
    ],
    fieldMappings: ['risk_score', 'volatility_index', 'stability_rating', 'risk_factors'],
    useCases: ['Risk management', 'Investment screening', 'Portfolio diversification', 'Due diligence'],
    businessContext: 'Critical for risk-conscious investors and institutions',
    keywords: ['risk', 'volatility', 'stability', 'assessment', 'mitigation', 'analysis'],
    semanticConcepts: ['risk assessment', 'market volatility', 'investment risk', 'stability analysis']
  },

  '/transportation-access-analysis': {
    endpoint: '/transportation-access-analysis',
    title: 'Transportation Access Analysis',
    description: 'Analyzes transportation connectivity, transit access, and mobility factors that influence property desirability and values.',
    sampleQueries: [
      'How accessible is this area by transit?',
      'Show me transportation connectivity',
      'What transportation options are available?',
      'Transit access analysis',
      'Transportation convenience factors'
    ],
    fieldMappings: ['transit_score', 'accessibility_index', 'transportation_options', 'connectivity_rating'],
    useCases: ['Location analysis', 'Accessibility planning', 'Transportation planning', 'Commuter preferences'],
    businessContext: 'Important for buyers prioritizing transportation convenience',
    keywords: ['transportation', 'transit', 'access', 'connectivity', 'mobility', 'commute'],
    semanticConcepts: ['transportation access', 'transit connectivity', 'mobility options', 'accessibility']
  }
};

// Helper function to get endpoint description
export function getEndpointDescription(endpoint: string): EndpointDescription | null {
  return ENDPOINT_DESCRIPTIONS[endpoint] || null;
}

// Get all available endpoints
export function getAvailableEndpoints(): string[] {
  return Object.keys(ENDPOINT_DESCRIPTIONS);
}

// Search endpoints by keyword
export function searchEndpointsByKeyword(keyword: string): EndpointDescription[] {
  const searchTerm = keyword.toLowerCase();
  return Object.values(ENDPOINT_DESCRIPTIONS).filter(desc =>
    desc.keywords.some(k => k.includes(searchTerm)) ||
    desc.title.toLowerCase().includes(searchTerm) ||
    desc.description.toLowerCase().includes(searchTerm)
  );
}