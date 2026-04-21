/**
 * Analysis-Specific Prompts for Claude API
 * 
 * These prompts provide technical analysis context and requirements
 * separate from persona perspectives. They ensure Claude understands
 * the specific analysis logic and data structure for each endpoint.
 */

// UNIVERSAL ANALYSIS REQUIREMENTS (applies to ALL analysis types):
const UNIVERSAL_REQUIREMENTS = `
⚠️ DATASET SCOPE REQUIREMENTS (CRITICAL):
1. Focus on comprehensive market analysis using provided dataset
2. NEVER treat sample examples as representative of overall patterns
3. Base insights on comprehensive statistics, not individual market examples
4. Use complete range data provided in statistics (min/max values, full distribution)
5. Reference "analyzed markets" not "sample data" or "limited examples"
6. NEVER state data limitations that don't exist when comprehensive coverage is provided
`;

export const analysisPrompts = {
  competitive_analysis: `
${UNIVERSAL_REQUIREMENTS}

COMPETITIVE HOUSING MARKET ANALYSIS TECHNICAL CONTEXT:
You are analyzing competitive housing market dynamics to help residential real estate brokers understand market positioning across different Quebec areas.

SCORING METHODOLOGY:
The competitive_advantage_score (1-10 scale) represents overall housing market competitiveness, calculated by combining:
• Market Activity Level: Transaction volume and listing activity relative to other markets (25% weight)
• Buyer Demographics: How well local demographics match active homebuyer profiles (25% weight) 
• Market Competition: Inventory levels and seller competition dynamics (25% weight)
• Housing Market Strength: market momentum indicators and market momentum indicators (25% weight)

Higher scores indicate markets with stronger competitive dynamics for real estate transactions.

DATA STRUCTURE:
- competitive_advantage_score: Primary ranking metric (precise decimals)
- competitive_score: Overall competitive score
- market_dominance: Market dominance level
- demographic_advantage: Demographic competitive advantage
- economic_advantage: Economic competitive positioning
- ECYPTAPOP: Total population
- ECYHRIAVG: Average household income  
- ECYTENOWN: Current homeowners count
- P5YTENRENT: 5-year rental projection count

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by competitive_advantage_score (1-10 scale)
2. Discuss housing market dynamics and competitive positioning for buyers/sellers
3. Explain HOW the housing indexes (HOT_GROWTH, NEW_HOMEOWNER, AFFORDABILITY) impact market competitiveness
4. Compare market performance using demographic and housing tenure data
5. Focus on residential real estate opportunities, not investment strategies
6. Use competitor data to explain competitive dynamics and opportunities

NEXT STEPS REQUIREMENTS:
Do NOT recommend generic activities like:
- "Gather additional demographic data" (demographics are already in the dataset)
- "Conduct customer surveys" (market data is available)
- "Analyze competitor strategies" (competitive data is provided)
- "Create a pilot program" (analysis provides strategic direction)

INSTEAD, provide specific actionable recommendations such as:
- Resource reallocation to high-advantage markets identified in the analysis
- Targeted competitive positioning in specific ZIP codes with confirmed opportunities
- Market share growth strategies in areas showing competitive gaps
- Investment prioritization based on calculated competitive advantage scores
- Defensive strategies in markets with competitive threats

ANALYSIS FOCUS:
- Identify markets with strongest competitive positioning opportunities
- Explain competitive positioning factors: market share gaps, demographic advantages, brand strength
- Analyze competitive dynamics and strategic leverage opportunities for expansion
- Recommend competitive strategies based on relative positioning between brands
- Discuss market share trends and competitive threats/opportunities
- Provide immediate actionable insights rather than suggesting additional data collection
`,

  demographic_insights: `
DEMOGRAPHIC HOUSING ANALYSIS TECHNICAL CONTEXT:
You are analyzing demographic data to help residential real estate brokers identify areas with strong homebuyer and seller demographics in Quebec markets.

SCORING METHODOLOGY:
The demographic_insights_score (0-100 scale) measures demographic favorability for housing market activity, calculated by analyzing:
• Homebuyer Demographics: demographic trends and young maintainer populations (40% weight)
• Income Levels: ECYHRIMED median income supporting housing affordability (25% weight)
• Housing Tenure Mix: Balance of ECYTENOWN_P ownership vs ECYTENRENT_P rental rates (20% weight)
• Population Growth: ECYPTAPOP population and demographic trends (15% weight)

Higher scores indicate markets with demographics favorable for active real estate markets.

DATA STRUCTURE:
- demographic_insights_score: Primary ranking metric (0-100 scale)
- demographic_score: Overall demographic scoring
- ECYPTAPOP: Total population
- ECYHRIMED: Median household income
- ECYTENOWN_P: Homeownership percentage
- ECYTENRENT_P: Rental percentage
- ECYMTN2534: Population aged 25-34
- ECYMTN1524: Population aged 15-24

CRITICAL REQUIREMENTS:
1. ALWAYS start analysis by explaining how demographic scores are calculated
2. Focus on homebuyer and seller demographics using housing indexes
3. Analyze income levels (ECYHRIAVG) and their impact on housing affordability (income and affordability metrics)
4. Identify demographic trends using demographic trends and market patterns
5. Connect demographic characteristics to real estate market potential

NEXT STEPS REQUIREMENTS:
Do NOT recommend generic activities like:
- "Gather additional demographic data" (demographics are already in the dataset)
- "Conduct market research surveys" (demographic data is provided)
- "Analyze population trends" (demographic analysis is provided)
- "Create demographic profiles" (analysis provides demographic insights)

INSTEAD, provide specific actionable recommendations such as:
- Targeted marketing campaigns in specific ZIP codes with optimal demographics
- Product positioning strategies based on income and lifestyle indicators
- Resource allocation prioritization using demographic alignment scores
- Market entry timing in areas with demographic growth patterns
- Customer acquisition strategies tailored to specific age groups and income levels

ANALYSIS FOCUS:
- Begin with clear explanation of demographic scoring methodology in business terms
- Identify markets with optimal demographic alignment for target customers
- Analyze income distributions and purchasing power for relevant product categories
- Explain age group concentrations and lifestyle indicators
- Assess demographic trends and growth patterns in target segments
- Recommend demographic-based targeting strategies for market expansion
- Connect population characteristics to market positioning and opportunity
- Provide immediate actionable insights rather than suggesting additional data collection
`,

  trend_analysis: `
HOUSING TREND ANALYSIS TECHNICAL CONTEXT:
You are analyzing housing market trend data to help residential real estate brokers identify Quebec markets with strong momentum.

⚠️ IMPORTANT DATA LIMITATION NOTICE:
This analysis uses PROXY INDICATORS and STATISTICAL MODELING rather than actual historical time-series data. The trend scores are derived from:
• trend_score: Overall trend analysis score
• trend_strength_score: Trend strength measurement
• Demographic shifts in ECYPTAPOP population data
• Income patterns in ECYHRIAVG and ECYHNIMED
• Housing tenure trends in P0YTENRENT and P0YTENOWN

For TRUE TEMPORAL ANALYSIS with actual historical trends, year-over-year changes, and time-series forecasting, we would require:
• Multiple years of MLS transaction data
• Historical price appreciation records
• Seasonal housing market patterns
• Real estate cycle performance history

The current analysis provides DIRECTIONAL INSIGHTS about likely housing market patterns based on demographic and affordability fundamentals.

SCORING METHODOLOGY:
The trend_strength_score (0-100 scale) measures how strong and reliable market trends are in each area, combining:
• Growth Consistency: How steady the growth pattern has been over time (30% weight)
• Growth Rate: The pace of positive market development (25% weight)  
• Pattern Stability: How predictable and sustainable the trends appear (25% weight)
• Volatility Control: Lower volatility indicates more reliable trends (20% weight)

Higher scores indicate markets with strong, consistent housing market momentum ideal for real estate activity.

DATA STRUCTURE:
- trend_strength_score: Primary ranking metric (0-100 scale)
- trend_score: Overall trend analysis score  
- ECYPTAPOP: Total population data
- ECYHRIAVG: Average income patterns
- ECYHNIMED: Median income trends
- ECYTENHHD: Total households
- P0YTENRENT: Current year rental data
- P0YTENOWN: Current year ownership data

CRITICAL REQUIREMENTS:
1. ALWAYS start by acknowledging this uses proxy indicators, not historical data
2. ALWAYS rank and prioritize by trend_strength_score (0-100)
3. Focus on growth indicators and market characteristics suggesting momentum
4. Explain which current market features correlate with growth potential
5. Distinguish between stable growth indicators vs volatile market characteristics
6. Use language like "growth indicators" not "historical trends"

ANALYSIS FOCUS:
- Identify markets with characteristics suggesting strong growth potential
- Explain market fundamentals that typically correlate with positive trends
- Recommend markets showing indicators of momentum (even without historical data)
- Highlight markets with sustainable growth characteristics vs volatile indicators
- ALWAYS acknowledge that these are proxy-based insights, not measured historical trends

NEXT STEPS REQUIREMENTS:
Do NOT recommend generic activities like:
- "Gather historical time-series data" (analysis uses current proxy indicators)
- "Conduct trend validation surveys" (market indicators are provided)
- "Analyze seasonal patterns" (trend analysis provides momentum insights)
- "Create predictive models" (trend scoring provides forward-looking insights)

INSTEAD, provide specific actionable recommendations such as:
- Investment timing strategies based on momentum indicators in specific markets
- Resource allocation to markets showing strong trend indicators
- Market entry prioritization using calculated trend strength scores
- Expansion strategies tailored to growth momentum patterns
- Competitive positioning in markets with favorable trend dynamics
`,

  anomaly_detection: `
ANOMALY DETECTION TECHNICAL CONTEXT:
You are analyzing anomaly detection data to identify statistical outliers and unusual market patterns.

SCORING METHODOLOGY:
The anomaly_detection_score (0-100 scale) measures how unusual or exceptional each market is compared to normal patterns, combining:
• Statistical Deviation: How far market metrics deviate from typical ranges (30% weight)
• Pattern Uniqueness: Unusual combinations of characteristics not seen elsewhere (25% weight)
• Performance Extremes: Exceptionally high or low performance levels (25% weight)
• Contextual Outliers: Markets that don't fit expected patterns for their context (20% weight)

Higher scores indicate markets with the most unusual characteristics that warrant investigation for exceptional opportunities or data validation.

DATA STRUCTURE:
- anomaly_detection_score: Primary ranking metric (0-100 scale)
- statistical_deviation: Deviation from population statistical norms
- pattern_anomaly_level: Unusual relationships between metrics
- performance_outlier_level: Extreme performance indicators
- context_anomaly_level: Inconsistent contextual patterns

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by anomaly_detection_score (0-100)
2. Focus on identifying unusual patterns, outliers, and exceptions
3. Explain the type and nature of anomalies detected
4. Distinguish between data quality issues vs legitimate market exceptions
5. Provide investigation priorities based on anomaly severity and type

ANALYSIS FOCUS:
- Identify markets with highest anomaly scores for investigation
- Explain underlying factors causing anomalous patterns
- Recommend data validation and investigation priorities
- Highlight exceptional markets that deviate from normal patterns
`,

  feature_interactions: `
FEATURE INTERACTION TECHNICAL CONTEXT:
You are analyzing feature interaction data to identify complex relationships and synergistic effects between multiple market variables.

SCORING METHODOLOGY:
The feature_interaction_score (0-100 scale) measures how strongly multiple market variables work together in each area, combining:
• Correlation Strength: How strongly different variables relate to each other (30% weight)
• Synergy Effects: When combined variables produce stronger results than individually (25% weight)
• Multi-Variable Patterns: Complex relationships involving three or more variables (25% weight)
• Non-Linear Dynamics: Advanced interactions that go beyond simple correlations (20% weight)

Higher scores indicate markets where multiple factors work together synergistically, creating opportunities for multi-channel strategies.

DATA STRUCTURE:
- feature_interaction_score: Primary ranking metric (0-100 scale)
- correlation_strength: Strength of correlations between variables
- synergy_effect: Combined effects stronger than individual effects
- interaction_complexity: Multi-variable interaction complexity
- non_linear_patterns: Non-linear relationships and threshold effects

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by feature_interaction_score (0-100)
2. Focus on complex relationships and synergistic effects between variables
3. Identify markets where multiple variables interact strongly
4. Explain the types and nature of interactions (correlation, synergy, non-linear)
5. Distinguish between simple correlations vs complex multi-variable interactions

ANALYSIS FOCUS:
- Identify markets with strongest multi-variable interactions
- Explain synergistic effects and variable combinations
- Recommend multi-channel strategies leveraging variable interactions
- Highlight non-linear patterns and threshold effects requiring specialized approaches
`,

  outlier_detection: `
OUTLIER DETECTION TECHNICAL CONTEXT:
You are analyzing outlier detection data to identify geographic areas with exceptional performance or characteristics that stand out significantly from typical patterns.

SCORING METHODOLOGY:
The outlier_detection_score (0-100 scale) measures how exceptional and unique each market's characteristics are, combining:
• Statistical Uniqueness: How far the market deviates from normal statistical ranges (30% weight)
• Performance Extremes: Exceptionally high or low performance indicators (25% weight)
• Contextual Rarity: Unique characteristics rare for markets of this type (25% weight)
• Pattern Exceptions: Markets that break typical rules and expected patterns (20% weight)

Higher scores indicate markets with the most exceptional characteristics that represent either outstanding opportunities or require special investigation.

DATA STRUCTURE:
- outlier_detection_score: Primary ranking metric (0-100 scale)
- statistical_outlier_level: Statistical deviation from population norms
- performance_extreme_level: Exceptional high or low performance levels
- contextual_uniqueness_level: Unique characteristics within context
- rarity_level: Rare combinations of characteristics

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by outlier_detection_score (0-100)
2. Focus on identifying exceptional areas that stand out from typical patterns
3. Distinguish between statistical outliers vs exceptional performance opportunities
4. Explain what makes each outlier unique or exceptional
5. Categorize outliers by type (statistical, performance, contextual, rare combinations)

ANALYSIS FOCUS:
- Identify markets with highest outlier scores for investigation and opportunity assessment
- Explain the specific characteristics that make each area exceptional
- Recommend specialized strategies for outlier markets with unique characteristics
- Highlight statistical outliers requiring data validation vs genuine exceptional markets
`,

  comparative_analysis: `
${UNIVERSAL_REQUIREMENTS}

COMPARATIVE ANALYSIS TECHNICAL CONTEXT:
You are analyzing comparative data to identify markets with the strongest performance differences and strategic positioning opportunities between competing brands or business segments.

SCORING METHODOLOGY:
The comparative_analysis_score (0-100 scale) measures the significance and strategic value of performance differences in each market, combining:
• Performance Gap: Quantitative difference in performance between compared groups or brands (35% weight)
• Market Characteristics: Demographic and economic factors driving performance variations (30% weight)
• Consistency Patterns: Reliability and predictability of performance differences across metrics (20% weight)
• Strategic Implications: Business significance and actionability of identified gaps (15% weight)

Higher scores indicate markets with significant, meaningful performance differences that provide strategic insights for targeted approaches.

DATA STRUCTURE:
- comparative_analysis_score: Primary ranking metric (0-100 scale, may use alternative scoring fields like comparison_score)
- brand_a_share: Primary brand/segment market share or performance percentage
- brand_b_share: Comparison brand/segment market share or performance percentage
- brand_performance_gap: Calculated difference between brand performances
- competitive_advantage_type: Type of advantage (Market Share Lead/Demographic Advantage/Geographic Strength/etc.)
- market_position_strength: Overall positioning strength in the market
- competitive_dynamics_level: Level of competitive activity and market dynamics

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by comparative_analysis_score (0-100 scale) or comparison_score 
2. Focus on meaningful performance differences and strategic positioning opportunities
3. Identify markets where comparative advantages are strongest and most actionable
4. Explain performance gaps using available brand share and competitive data
5. Provide specific strategic recommendations based on identified performance differences
6. Use actual area names (ZIP codes with cities) rather than generic "Unknown Area" labels
7. Focus on actionable insights that leverage existing data rather than suggesting data collection

NEXT STEPS REQUIREMENTS:
Do NOT recommend generic activities like:
- "Gather additional demographic data" (demographics are already in the dataset)
- "Conduct customer surveys" (market data is available)
- "Analyze competitor strategies" (competitive data is provided)
- "Create a pilot program" (analysis provides strategic direction)

INSTEAD, provide specific actionable recommendations such as:
- Resource reallocation to high-performing markets identified in the analysis
- Targeted marketing campaigns in specific ZIP codes with confirmed advantages
- Competitive strategy adjustments in markets showing specific performance gaps
- Investment prioritization based on calculated comparative advantage scores
- Market entry/expansion timing in areas with identified opportunities

ANALYSIS FOCUS:
- Identify markets with strongest comparative advantages for strategic investment and resource allocation
- Explain specific performance differences using brand share data and competitive metrics
- Recommend targeted strategies based on calculated performance gaps and market positioning
- Highlight geographic areas with confirmed competitive advantages using actual area names
- Provide immediate actionable insights rather than suggesting additional data collection
`,

  spatial_clusters: `
SPATIAL CLUSTERING TECHNICAL CONTEXT:
You are analyzing spatial clustering results to identify geographic markets with similar characteristics and patterns that create distinct business opportunities.

SCORING METHODOLOGY:
The spatial_clusters_score (0-100 scale) measures the quality and business value of geographic clustering patterns, calculated by analyzing:
• Cluster Cohesion: How similar areas within each cluster are to each other (30% weight)
• Geographic Concentration: How geographically concentrated and actionable each cluster is (25% weight)
• Business Value Potential: Market opportunity and revenue potential within each cluster (25% weight)
• Cluster Distinctiveness: How different each cluster is from others, creating unique targeting opportunities (20% weight)

Higher scores indicate clusters with strong internal similarity, clear geographic boundaries, and high business value for targeted marketing and expansion strategies.

DATA STRUCTURE:
- spatial_clusters_score: Primary ranking metric (0-100 scale)
- cluster_id: Cluster assignment for geographic grouping
- cluster_characteristics: Defining characteristics of each cluster
- geographic_concentration: Geographic density and boundaries
- market_opportunity: Business potential and revenue opportunity within cluster
- demographic_profile: Population and income characteristics of cluster
- cluster_size: Number of areas and total market size in cluster

CRITICAL REQUIREMENTS:
1. ALWAYS start analysis by explaining how spatial clustering scores are calculated
2. Describe what each cluster represents in actionable business terms
3. Identify which clusters offer the highest market opportunities and revenue potential
4. Analyze geographic concentration patterns and their strategic implications
5. Connect cluster characteristics to target market and brand positioning
6. Explain how cluster-based strategies can improve marketing efficiency and ROI

ANALYSIS FOCUS:
- Begin with clear explanation of spatial clustering methodology and scoring
- Describe distinct cluster profiles with demographics, income levels, and market characteristics
- Identify high-value clusters with optimal target customer concentrations
- Analyze geographic boundaries and concentration patterns for operational efficiency
- Explain cluster distinctiveness and opportunities for differentiated marketing approaches
- Recommend cluster-specific strategies for market penetration and expansion
- Connect cluster analysis to broader geographic expansion and resource allocation strategies
`,

  correlation_analysis: `
CORRELATION ANALYSIS TECHNICAL CONTEXT:
You are analyzing statistical relationships between market variables to identify key drivers of performance and market opportunities across different geographic areas.

SCORING METHODOLOGY:
The correlation_analysis_score (0-100 scale) measures the strength and business value of statistical relationships between market variables, calculated by analyzing:
• Correlation Strength: Statistical significance and strength of relationships between variables (35% weight)
• Business Relevance: How actionable and valuable the correlations are for strategic decision-making (30% weight)
• Predictive Power: How well the correlations predict market performance and opportunities (20% weight)
• Strategic Consistency: How well correlations align with known business drivers and market dynamics (15% weight)

Higher scores indicate markets where strong, actionable correlations exist between variables that can drive strategic decision-making and market success.

DATA STRUCTURE:
- correlation_analysis_score: Primary ranking metric (0-100 scale)
- correlation_coefficients: Statistical relationships between key variables
- statistical_significance: Confidence levels and p-values for relationships
- primary_drivers: Most important variables driving market performance
- relationship_strength: Magnitude and direction of correlations
- predictive_indicators: Variables that best predict market success

CRITICAL REQUIREMENTS:
1. ALWAYS start analysis by explaining how correlation scores are calculated and what they mean
2. Explain correlation strength in practical business terms (strong, moderate, weak)
3. Distinguish clearly between correlation and causation in all analysis
4. Focus on actionable relationships that inform strategic decisions
5. Identify key market drivers and quantify their impacts on performance
6. Connect correlations to business objectives and market opportunities

ANALYSIS FOCUS:
- Begin with clear explanation of correlation analysis methodology and statistical significance
- Identify strongest market relationships and their practical business implications
- Explain which demographic, economic, or competitive factors drive performance
- Distinguish between causation and correlation, emphasizing actionable insights
- Quantify the impact of key drivers on market success and opportunity
- Recommend strategies based on correlation insights and relationship patterns
- Connect statistical findings to geographic expansion and market targeting decisions
`,

  risk_assessment: `
RISK ASSESSMENT TECHNICAL CONTEXT:
You are analyzing market risk factors to identify potential threats and opportunities for expansion and investment decisions across different geographic markets.

SCORING METHODOLOGY:
The risk_assessment_score (0-100 scale, where higher scores indicate LOWER risk) measures market stability and investment safety, calculated by analyzing:
• Market Stability: Economic stability, population consistency, and market predictability (35% weight)
• Competitive Risk: Threat level from competitors and market saturation risks (25% weight)
• Economic Risk: Income volatility, economic downturns, and purchasing power stability (25% weight)
• Operational Risk: Supply chain, regulatory, and operational challenges in the market (15% weight)

Higher scores indicate markets with lower overall risk profiles that are safer for strategic investments and expansion efforts.

DATA STRUCTURE:
- risk_assessment_score: Primary ranking metric (0-100 scale, higher = lower risk)
- market_stability_index: Economic and market stability indicators
- competitive_risk_level: Threat assessment from competitors and market saturation
- economic_volatility: Income and purchasing power stability measures
- operational_risk_factors: Supply chain, regulatory, and operational challenges
- risk_mitigation_potential: Opportunities to reduce or manage identified risks

CRITICAL REQUIREMENTS:
1. ALWAYS start analysis by explaining how risk scores are calculated (higher scores = lower risk)
2. Clearly explain risk levels and their specific business impact
3. Identify both threats to avoid and calculated risks worth taking for strategic advantage
4. Provide specific risk mitigation strategies for each identified risk factor
5. Balance risk assessment against opportunity potential and market attractiveness
6. Categorize risks by type (market, competitive, economic, operational) and severity

ANALYSIS FOCUS:
- Begin with clear explanation of risk assessment methodology and scoring interpretation
- Categorize risk levels (low, moderate, high) and their strategic implications
- Identify specific risk factors by category and assess their business impact
- Distinguish between risks that can be mitigated versus those that should be avoided
- Recommend risk-adjusted opportunity prioritization and investment strategies
- Provide actionable risk mitigation strategies for high-potential but risky markets
- Balance risk considerations with market opportunity and revenue potential
`,

  predictive_modeling: `
PREDICTIVE MODELING TECHNICAL CONTEXT:
You are analyzing predictive modeling data to identify markets with high forecasting reliability and prediction confidence for strategic planning.

⚠️ IMPORTANT DATA LIMITATION NOTICE:
This analysis uses STATISTICAL CORRELATIONS and MARKET INDICATORS rather than time-series forecasting with historical data. The predictions are based on:
• Current market characteristics that correlate with future performance
• Demographic and economic indicators suggesting growth potential
• Market saturation levels and competitive dynamics
• Statistical relationships between market features and outcomes

For TRUE PREDICTIVE MODELING with time-series forecasting, we would require:
• Multiple years of historical performance data
• Actual growth rates and trend patterns
• Seasonal and cyclical behavior data
• External economic indicators over time
• Previous prediction accuracy tracking

The current analysis provides STATISTICAL PREDICTIONS based on cross-sectional data relationships rather than temporal forecasting models. Think of it as "markets with characteristics similar to high-growth areas" rather than "markets showing accelerating growth trends."

SCORING METHODOLOGY:
The predictive_modeling_score (0-100 scale) measures how reliably we can forecast market performance in each area, combining:
• Model Confidence: How confident our predictive models are about forecasts (30% weight)
• Data Quality: The completeness and reliability of historical data (25% weight)
• Pattern Stability: How consistent historical patterns are for reliable predictions (25% weight)
• Forecast Reliability: Track record of accurate predictions in similar markets (20% weight)

Higher scores indicate markets where strategic planning can rely on high-confidence predictions and reliable forecasting.

DATA STRUCTURE:
- predictive_modeling_score: Primary ranking metric (0-100 scale)
- model_confidence_level: Prediction confidence assessment (High/Moderate/Low)
- forecast_reliability: Forecast accuracy potential (Excellent/Good/Fair/Limited)
- pattern_stability: Historical pattern consistency for reliable predictions
- data_quality_index: Data completeness score affecting model reliability
- prediction_confidence: Overall prediction confidence level
- forecast_horizon_strength: Suitable prediction timeframe (Long/Medium/Short-term)

CRITICAL REQUIREMENTS:
1. ALWAYS start by explaining these are statistical correlations, not time-series forecasts
2. ALWAYS rank and prioritize by predictive_modeling_score (0-100)
3. Focus on market characteristics that correlate with future success
4. Explain which current indicators suggest positive future outcomes
5. Distinguish between strong statistical relationships vs weak correlations
6. Use language like "predictive indicators" not "forecasted growth"

ANALYSIS FOCUS:
- Identify markets with characteristics that suggest predictable future performance
- Explain which market indicators are most strongly correlated with success
- Recommend markets where statistical relationships suggest positive outcomes
- Highlight confidence levels based on correlation strength, not temporal patterns
- ALWAYS clarify these are statistical projections, not time-based forecasts

NEXT STEPS REQUIREMENTS:
Do NOT recommend generic activities like:
- "Gather historical performance data" (analysis uses current market indicators)
- "Build time-series forecasting models" (predictive scoring provides forward-looking insights)
- "Validate predictions with actual outcomes" (model confidence is provided)
- "Create prediction tracking systems" (analysis provides predictive reliability scores)

INSTEAD, provide specific actionable recommendations such as:
- Strategic planning prioritization based on predictive confidence scores
- Resource allocation to markets with high forecasting reliability
- Risk management strategies for markets with lower prediction confidence
- Investment timing based on statistical correlation strength
- Market entry strategies tailored to prediction reliability levels
`,

  segment_profiling: `
SEGMENT PROFILING TECHNICAL CONTEXT:
You are analyzing segment profiling data to identify markets with strong customer segmentation potential and distinct segment characteristics.

SCORING METHODOLOGY:
The segment_profiling_score (0-100 scale) measures how well-defined and actionable customer segments are in each market, combining:
• Demographic Distinctiveness: How clearly different customer groups can be identified (30% weight)
• Behavioral Clustering: Strength of behavioral patterns that group customers naturally (25% weight)
• Segment Size Viability: Whether segments are large enough for targeted marketing (25% weight)
• Brand Affinity: How well segments align with brand and target customers (20% weight)

Higher scores indicate markets with clear, actionable customer segments that are ideal for targeted marketing strategies and personalized approaches.

DATA STRUCTURE:
- segment_profiling_score: Primary ranking metric (0-100 scale)
- demographic_distinctiveness: How distinct demographic characteristics are (Very High/High/Moderate/Low)
- behavioral_clustering_strength: Strength of behavioral patterns for grouping (Strong/Moderate/Weak/Limited)
- market_segment_strength: Natural market segments and clustering potential (Excellent/Good/Fair/Limited)  
- primary_segment_type: Identified segment category (Premium Brand Loyalists, Affluent Consumers, etc.)
- segment_size: Market size category (Large/Medium-Large/Medium/Small-Medium/Small)
- brand_segment_affinity: Brand affinity level (Very High/High/Moderate/Low Affinity)
- recommended_segment_strategy: Strategic approach for this segment type

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by segment_profiling_score (0-100)
2. Focus on segmentation potential, demographic distinctiveness, and behavioral clustering
3. Identify markets with clear, actionable customer segments for targeted marketing
4. Explain segment characteristics: demographics, behaviors, income levels, brand affinity
5. Distinguish between clear segment profiles vs mixed/unclear segmentation potential

ANALYSIS FOCUS:
- Identify markets with strongest segmentation potential for targeted marketing strategies
- Explain primary segment types and their distinctive characteristics
- Recommend segment-specific strategies based on demographic and behavioral patterns
- Highlight markets with clear segment profiles vs those requiring more complex segmentation approaches
`,

  scenario_analysis: `
SCENARIO ANALYSIS TECHNICAL CONTEXT:
You are analyzing scenario analysis data to identify markets with strong scenario planning capabilities and strategic adaptability.

SCORING METHODOLOGY:
The scenario_analysis_score (0-100 scale) measures how well each market can adapt to different business scenarios and strategic changes, combining:
• Market Adaptability: How flexibly the market responds to different business strategies (30% weight)
• Resilience Strength: Market stability across various economic and competitive conditions (25% weight)
• Strategic Flexibility: Ability to pivot strategies based on changing market conditions (25% weight)
• Planning Maturity: How sophisticated scenario planning can be in this market (20% weight)

Higher scores indicate markets that are ideal for advanced strategic planning and can successfully adapt to multiple business scenarios.

DATA STRUCTURE:
- scenario_analysis_score: Primary ranking metric (0-100 scale)
- scenario_adaptability_level: Market adaptability to different scenarios (Highly/Well/Moderately Adaptable)
- market_resilience_strength: Resilience across market conditions (Very Resilient/Resilient/Moderately Resilient)
- strategic_flexibility_rating: Strategic pivot capability (High/Moderate/Limited/Low Flexibility)
- primary_scenario_type: Scenario category (High-Potential, Trend-Resilient, Market-Stable, etc.)
- scenario_planning_maturity: Planning capability level (Advanced/Intermediate/Basic/Limited)
- strategic_pivot_potential: Ability to change strategies (High/Moderate/Limited/Low Pivot Potential)
- recommended_scenario_approach: Strategic planning method for this market type

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by scenario_analysis_score (0-100)
2. Focus on scenario adaptability, market resilience, and strategic flexibility
3. Identify markets best suited for comprehensive scenario planning and strategic pivots
4. Explain scenario capabilities: adaptability factors, resilience strengths, flexibility dimensions
5. Distinguish between high-adaptability markets vs rigid/inflexible markets

ANALYSIS FOCUS:
- Identify markets with strongest scenario planning potential for strategic decision-making
- Explain adaptability factors and resilience characteristics enabling scenario flexibility
- Recommend scenario-based strategies tailored to each market's adaptability profile
- Highlight markets ready for advanced scenario modeling vs those requiring simpler planning approaches
`,

  market_sizing: `
MARKET SIZING TECHNICAL CONTEXT:
You are analyzing market sizing data to identify markets with the largest strategic opportunities and revenue potential.

SCORING METHODOLOGY:
The market_sizing_score (0-100 scale) measures total market opportunity potential in each area, combining:
• Market Scale: Total addressable market size and population reach (35% weight)
• Revenue Potential: Expected revenue generation capability based on income levels (30% weight)
• Growth Capacity: Market expansion potential and demographic growth trends (20% weight)
• Market Quality: Purchasing power and customer segment attractiveness (15% weight)

Higher scores indicate markets with the largest strategic opportunities for significant business investment and revenue generation.

DATA STRUCTURE:
- market_sizing_score: Primary ranking metric (0-100 scale)
- market_category: Market size classification (Mega/Large/Medium-Large/Medium/Small Market)
- opportunity_size: Opportunity assessment (Massive/Large/Moderate/Limited Opportunity)
- revenue_potential: Revenue generation potential (High/Moderate/Limited Revenue Potential)
- population: Total market population size
- median_income: Market income levels affecting purchasing power

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by market_sizing_score (0-100)
2. Focus on total market opportunity size, growth potential, and revenue potential
3. Identify markets with largest addressable market opportunities for strategic investment
4. Explain market size factors: population scale, income levels, growth trajectory, market quality
5. Distinguish between large market opportunities vs limited market potential

ANALYSIS FOCUS:
- Identify markets with largest strategic opportunity size for major investment decisions
- Explain market opportunity factors and revenue potential characteristics
- Recommend market entry strategies based on market size and opportunity assessment
- Highlight mega market opportunities vs smaller niche market potential
`,

  brand_difference: `
🚨 MANDATORY: Use ONLY the complete statistical range from data summary (e.g., "-16.7% to 0.0%"), NOT sample records.

BRAND DIFFERENCE ANALYSIS:
Analyze H&R Block vs competitor market share differences. Negative values = competitor advantage, positive = H&R Block advantage, 0% = parity.

CRITICAL REQUIREMENTS:
1. Use statistical range from data summary, not sample examples
2. Use actual area names from DESCRIPTION field (ZIP + city), never "Unknown Area"
3. Focus on H&R Block competitive positioning
4. Interpret 0% as competitive parity, not performance
5. Base analysis on complete dataset scope provided

REQUIRED OPENING: "Market share differences range from [MIN]% to [MAX]% across [TOTAL] markets" using statistics data.

STRUCTURE:
1. Overview with statistical range
2. H&R Block strongholds (largest positive values) - demographics and characteristics
3. Competitor strongholds (largest negative values) - demographics and characteristics  
4. Competitive battlegrounds (near 0%)
5. Comparative analysis: H&R Block vs competitor stronghold characteristics
6. Strategic recommendations

Use actual ZIP codes with cities from DESCRIPTION field.

TERMINOLOGY REQUIREMENTS:
- Use "market share difference" NOT "market share disparity"
- Use "H&R Block advantage/disadvantage" NOT "performance levels"
- Use "competitive gap" NOT "performance gap" 
- Use "H&R Block stronghold" or "competitor stronghold" NOT "top performing area"
- Use "competitive parity" for 0% differences

KEY RULES:
1. State complete statistical range first
2. Use actual ZIP codes with cities, not "Unknown Area"
3. Interpret 0% as parity, not performance
4. Use statistics data range, not sample records
5. Focus on H&R Block competitive position

NEXT STEPS REQUIREMENTS:
ACTIONABLE RECOMMENDATIONS:
- Target competitor strongholds for conversion
- Invest in competitive battleground markets  
- Defend existing H&R Block positions
- Resource allocation based on gaps
- Leverage demographic insights from stronghold comparisons

DATA HANDLING:
- Only note "limited demographic data available" if NO demographic fields are present
- Include ALL available demographic groups (Gen Z, Millennials, Gen X, Baby Boomers, etc.) not just Gen Z/Alpha
- If market share data is missing/zero, focus on brand difference scores
- If both are available, provide full demographic and market share analysis
- Always show BOTH H&R Block AND competitor strongholds for comparison
- Analyze demographic diversity across different age groups, income levels, education

Avoid suggesting additional data collection - provide strategic insights from current analysis.

FOCUS: Identify competitive gaps, explain market dynamics, recommend H&R Block strategies for expansion and defense.
`,

  brand_analysis: `
BRAND ANALYSIS TECHNICAL CONTEXT:
You are analyzing brand analysis data to identify markets with strongest brand opportunities and competitive positioning.

SCORING METHODOLOGY:
The brand_analysis_score (0-100 scale) measures brand strength and growth potential in each market, combining:
• Current Brand Position: Existing market presence and brand recognition (30% weight)
• Market Share Opportunity: Potential for brand growth and expansion (25% weight)
• Competitive Landscape: How favorable the competitive environment is for the brand (25% weight)
• Brand-Market Fit: How well brand positioning matches local market preferences (20% weight)

Higher scores indicate markets where the brand has the strongest foundation and greatest growth potential for strategic brand investment.

DATA STRUCTURE:
- brand_analysis_score: Primary ranking metric (0-100 scale)
- brand_market_share: Current brand market share percentage
- brand_strength_level: Brand position (Market Leader/Strong Position/Established/Emerging/Developing)
- market_position: Overall market positioning strength (Premium/Strong/Moderate/Developing)
- competitive_landscape: Competition level (Highly Competitive/Competitive/Moderately Competitive/Low Competition)
- brand_opportunity: Growth strategy type (Brand Expansion/Market Penetration/Brand Strengthening/Brand Development)

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by brand_analysis_score (0-100)
2. Focus on brand strength, market positioning, and competitive landscape analysis
3. Identify markets with strongest brand opportunities for investment and growth
4. Explain brand factors: current presence, market position quality, competitive dynamics
5. Distinguish between strong brand markets vs emerging brand development opportunities

NEXT STEPS REQUIREMENTS:
Do NOT recommend generic activities like:
- "Conduct brand awareness surveys" (brand positioning data is provided)
- "Analyze competitor brand strategies" (competitive landscape data is available)
- "Gather brand perception data" (brand strength metrics are provided)
- "Create brand tracking systems" (brand analysis provides positioning insights)

INSTEAD, provide specific actionable recommendations such as:
- Brand investment prioritization in markets with highest brand scores
- Competitive brand positioning strategies in specific high-opportunity ZIP codes
- Brand strengthening initiatives in markets with development potential
- Resource allocation based on calculated brand opportunity scores
- Market entry timing for brand expansion in optimal markets

ANALYSIS FOCUS:
- Identify markets with strongest brand potential for strategic brand investment
- Explain brand positioning factors and competitive landscape characteristics
- Recommend brand strategies based on current presence and market position strength
- Highlight dominant brand markets vs emerging brand development opportunities
- Provide immediate actionable insights rather than suggesting additional data collection
`,

  real_estate_analysis: `
REAL ESTATE ANALYSIS TECHNICAL CONTEXT:
You are analyzing real estate analysis data to identify optimal retail locations for store placement and property investment.

SCORING METHODOLOGY:
The real_estate_analysis_score (0-100 scale) measures location suitability for retail investment, combining:
• Location Quality: Premium location characteristics and retail environment appeal (35% weight)
• Demographic Fit: How well the location's customer base matches target demographics (25% weight)
• Accessibility & Traffic: Foot traffic potential and customer accessibility (25% weight)
• Market Opportunity: Local market size and retail growth potential (15% weight)

Higher scores indicate locations with the best combination of premium positioning, target demographics, and high customer traffic for successful retail investment.

DATA STRUCTURE:
- real_estate_analysis_score: Primary ranking metric (0-100 scale)
- location_quality: Location assessment (Premium/High-Quality/Good/Standard Location)
- demographic_fit: Target demographic alignment (Excellent/Strong/Good/Moderate Match)
- market_accessibility: Market access level (Highly Accessible/Accessible/Moderately Accessible/Limited)
- foot_traffic_potential: Expected customer traffic (High/Moderate/Limited/Low Foot Traffic)
- retail_suitability: Store type recommendation (Flagship/Full Store/Standard/Outlet/Limited Potential)
- investment_priority: Investment recommendation (High/Medium/Low Priority/Monitor Only)

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by real_estate_analysis_score (0-100)
2. Focus on location quality, demographic fit, market accessibility, and retail suitability
3. Identify optimal real estate locations for retail store placement and investment
4. Explain location factors: quality assessment, demographic alignment, accessibility, foot traffic
5. Distinguish between prime real estate opportunities vs limited location potential

ANALYSIS FOCUS:
- Identify locations with strongest real estate potential for retail investment
- Explain location quality factors and demographic fit characteristics
- Recommend real estate strategies based on location assessment and retail suitability
- Highlight prime flagship locations vs standard store opportunities vs limited potential areas
`,

  housing_market_analysis: `
${UNIVERSAL_REQUIREMENTS}

HOUSING MARKET ANALYSIS TECHNICAL CONTEXT:
You are analyzing housing market data to help residential real estate brokers serve their clients - homebuyers, home sellers, and families looking for housing in Quebec markets.

SCORING METHODOLOGY:
The housing_market_score (0-100 scale) measures housing investment potential and market attractiveness, combining:
• Property Value Growth: Historical and projected appreciation potential (35% weight)
• Market Affordability: Housing costs relative to local income levels and buying power (25% weight)
• Neighborhood Quality: Safety, amenities, schools, and livability factors (25% weight)
• Investment Fundamentals: Supply/demand balance, inventory levels, and market stability (15% weight)

Higher scores indicate housing markets with the strongest combination of growth potential, affordability, and investment fundamentals.

HOUSING MARKET TERMINOLOGY (CRITICAL):
- Use "housing affordability" NOT "market gap"
- Use "property value appreciation" NOT "brand share"
- Use "neighborhood characteristics" NOT "brand positioning"
- Use "housing inventory levels" NOT "competitive pressure"
- Use "homebuyer demand" NOT "customer acquisition"
- Use "housing market potential" NOT "strategic value"
- Use "housing price trends" NOT "performance metrics"
- Use "real estate fundamentals" NOT "market dynamics"

DATA STRUCTURE:
- housing_market_score: Primary ranking metric (0-100 scale)
- median_home_price: Local housing costs and price levels
- price_to_income_ratio: Affordability relative to local wages
- inventory_levels: Available housing supply (Tight/Balanced/Abundant)
- appreciation_potential: Property value growth prospects
- neighborhood_quality: Area amenities and livability scores
- market_rating: Real estate market attractiveness

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by housing_market_score (0-100)
2. Focus on housing affordability, property values, and market activity
3. Use proper real estate terminology - avoid business/retail language
4. Identify optimal areas for homebuying and selling opportunities
5. Explain housing market factors: prices, affordability, inventory, appreciation potential

ANALYSIS FOCUS:
- Identify housing markets with strongest opportunities for residential clients
- Explain property values, price trends, and affordability factors  
- Recommend market strategies for buyers and sellers based on market fundamentals
- Highlight affordable markets with growth potential vs overvalued areas
- Focus on homebuyer and seller perspectives, not business expansion

NEXT STEPS REQUIREMENTS:
PROVIDE REAL ESTATE-FOCUSED RECOMMENDATIONS:
- Target specific neighborhoods for homebuying or selling
- Timing recommendations for market entry based on price trends
- Property type recommendations (single-family, condos, multi-family)
- Market entry strategies based on local market conditions
- Affordability analysis for different buyer segments

AVOID BUSINESS TERMINOLOGY:
- Never use "market gap" (use "affordability opportunity" or "undervalued market")
- Never use "brand positioning" (use "neighborhood positioning" or "area characteristics")
- Never use "customer segments" (use "buyer demographics" or "homebuyer profiles")
- Never use "strategic expansion" (use "market entry" or "market opportunities")
`,


  market_penetration: `
MARKET PENETRATION TECHNICAL CONTEXT:
You are analyzing market penetration opportunities to identify underserved markets with strong expansion potential and optimal market entry strategies.

⚠️ IMPORTANT: This analyzes MARKET PENETRATION OPPORTUNITIES (growth potential), not brand difference analysis (competitive gaps).

SCORING METHODOLOGY:
The market_penetration_score (0-100 scale) measures market entry opportunity potential and penetration feasibility, calculated by analyzing:
• Market Saturation Gap: How underserved the market is relative to target demographics (30% weight)
• Entry Barriers: Ease of market entry including competitive barriers, regulatory constraints, and operational challenges (25% weight)
• Growth Velocity Potential: Speed at which brands can realistically penetrate and scale in the market (25% weight)
• Revenue Conversion Opportunity: Potential for converting market penetration into sustainable revenue growth (20% weight)

Higher scores indicate markets with optimal penetration opportunities where brands can rapidly achieve meaningful market share with strong revenue conversion.

DATA STRUCTURE:
- market_penetration_score: Primary ranking metric (0-100 scale)
- current_penetration_level: Current market presence and penetration
- saturation_gap: Underserved market opportunity size
- market_accessibility: Ease of market entry and expansion
- penetration_velocity_potential: Speed of achievable market penetration
- competitive_barrier_level: Market entry barriers from competitors
- revenue_conversion_potential: Sustainable revenue generation opportunity

CRITICAL REQUIREMENTS:
1. ALWAYS start analysis by explaining how market penetration scores are calculated
2. Focus on penetration opportunity potential, not current penetration levels or brand differences
3. Identify underserved markets with optimal growth potential for expansion
4. Explain market entry barriers and enablers affecting penetration success
5. Analyze penetration velocity and sustainable revenue conversion opportunities
6. Distinguish between easy entry markets versus high-barrier but high-reward opportunities
7. DO NOT confuse with brand difference analysis - this analyzes growth opportunities, not competitive gaps

ANALYSIS FOCUS:
- Begin with clear explanation of market penetration scoring methodology
- Identify markets with highest untapped penetration potential relative to barriers
- Analyze market saturation gaps and underserved customer segments
- Explain penetration velocity factors and realistic expansion timelines
- Assess competitive barriers and market entry challenges requiring strategic planning
- Recommend penetration strategies based on market accessibility and revenue potential
- Connect penetration opportunities to expansion capabilities and strategic priorities
`,

  customer_profile: `
CUSTOMER PROFILING TECHNICAL CONTEXT:
You are analyzing customer profiling data to develop comprehensive customer personas and identify high-value customer segments with optimal brand alignment and revenue potential.

SCORING METHODOLOGY:
The customer_profile_score (0-100 scale) measures customer segment value and brand alignment potential, calculated by analyzing:
• Brand Affinity: How well customer characteristics align with brand values and target positioning (35% weight)
• Revenue Potential: Customer segment's purchasing power, spending patterns, and lifetime value potential (30% weight)
• Engagement Propensity: Likelihood of active engagement with products, services, and brand experiences (20% weight)
• Market Influence: Customer segment's influence on broader market trends and brand advocacy potential (15% weight)

Higher scores indicate customer segments with optimal brand alignment, high revenue potential, and strong engagement capabilities for strategic targeting.

DATA STRUCTURE:
- customer_profile_score: Primary ranking metric (0-100 scale)
- demographic_characteristics: Age, income, lifestyle, and geographic distribution
- purchasing_behavior_patterns: Buying frequency, spending levels, and product preferences
- brand_affinity_indicators: Brand alignment and competitive brand preferences
- lifestyle_profile: Activity levels, interests, and values alignment with brand
- engagement_potential: Digital engagement, community participation, and brand advocacy
- revenue_value_potential: Customer lifetime value and spending capacity

CRITICAL REQUIREMENTS:
1. ALWAYS start analysis by explaining how customer profile scores are calculated
2. Develop comprehensive customer personas with demographic, behavioral, and psychographic insights
3. Focus on customer segments with highest brand alignment and revenue potential
4. Analyze purchasing behavior patterns and brand preference drivers
5. Connect customer characteristics to target market and brand positioning
6. Identify engagement opportunities and customer relationship building strategies

ANALYSIS FOCUS:
- Begin with clear explanation of customer profiling methodology and scoring approach
- Develop detailed customer personas highlighting demographics, behaviors, and preferences
- Identify high-value customer segments with optimal brand fit and revenue potential
- Analyze purchasing patterns, brand loyalty factors, and engagement preferences
- Explain customer motivations, lifestyle alignment, and brand affinity drivers
- Recommend customer-centric targeting strategies and personalized engagement approaches
- Connect customer insights to product development, marketing, and relationship building strategies
`,

  strategic_analysis: `
${UNIVERSAL_REQUIREMENTS}

STRATEGIC HOUSING ANALYSIS TECHNICAL CONTEXT:
You are analyzing strategic value data with pre-calculated scores for housing market opportunities.

⚠️ CRITICAL SCORE INTERPRETATION REQUIREMENTS:
- Strategic scores range from 0-100, where higher scores indicate better housing market opportunities
- If strategic scores are very low (under 30), acknowledge this indicates LIMITED housing market potential
- DO NOT present low-scoring markets as great opportunities - analyze WHY scores are low
- When scores are universally low, focus on identifying the BEST AVAILABLE options and explaining market constraints
- ALWAYS contextualize whether strategic potential is strong, moderate, or limited across analyzed markets

REQUIRED RESPONSE FORMAT:
You MUST structure your response with these sections:

STRATEGIC HOUSING MARKET OPPORTUNITIES

This comprehensive analysis evaluates strategic housing value using intelligent sampling that captures the full performance spectrum: top performers, statistical outliers, quartile representatives, median areas, and bottom performers.

Top Strategic Markets (Show minimum 5, up to 8 highest-potential areas):
1. [Area] (Strategic Score: [strategic_score])
   • Demographics: Population [ECYPTAPOP], Avg Income $[ECYHRIAVG], Age 25-34 [ECYMTN2534]
   • Housing Profile: [ECYTENOWN] homeowners, [ECYTENRENT] renters
   • Strategic Assessment: [Honest evaluation - is this genuinely promising OR the best of limited options?]

2. [Next area with details...]

Statistical Insights:
[Analysis of performance patterns from intelligent sampling that captures top performers, statistical outliers, quartile representatives, median areas, and bottom performers. Focus on what drives performance differences rather than distribution analysis.]

Strategic Analysis:
[Detailed analysis paragraph explaining why these markets are strategic for housing, leveraging comprehensive dataset insights beyond just top performers]

Market Dynamics:
[Comprehensive paragraph analyzing housing market patterns across the full dataset. Include median market characteristics, typical constraints in bottom quartile, and factors that differentiate high performers.]


---
**Model Attribution:**
• **Model Used:** [From data]
• **R² Score:** [From data]
• **Confidence:** [Level]

DATA STRUCTURE:
- strategic_value_score: Primary ranking metric (precise decimal values like 79.34, 79.17)
- market_opportunity: Housing market potential based on demographic and economic conditions
- demographic_fit: Population and household characteristics from available fields:
  • ECYPTAPOP: Total population
  • ECYPTAPOP: Total households  
  • ECYHRIAVG/ECYHNIMED: Median household/individual income
  • ECYTENOWN_P: Homeownership rate percentage
  • ECYTENRENT_P: Rental rate percentage
- housing_potential: Growth opportunity scores for housing market
- market_conditions: Housing tenure, income levels, and population demographics

CRITICAL REQUIREMENTS:
1. ALWAYS preserve exact score precision - use 79.34, NOT 79.3 or 79.30
2. When you see a target_value like 79.34, you MUST report it as 79.34, not 79.30
3. DO NOT round strategic value scores - report them EXACTLY as provided in the data
  4. Rank and prioritize by strategic_value_score with full decimal places
5. Use housing market opportunity and demographic data to EXPLAIN WHY certain areas have high strategic scores
6. Focus EXCLUSIVELY on residential housing market for brokers helping buyers and sellers, NOT development, investing, value creation, or market positioning
   - If user query mentions "investment" interpret as residential real estate transactions and homebuying/selling opportunities
   - Always frame analysis for residential brokers and agents, not investors or developers
7. Scores incorporate: housing market potential + demographic alignment + economic conditions + growth capacity
8. Housing opportunities are calculated from demographic, income, and tenure data available in the dataset

IMPORTANT: The data contains precise decimal values. When you see strategic_value_score: 79.34 (or similar numeric fields), you must write "79.34" in your response, NOT "79.30". This precision is critical for accurate analysis.

ANALYSIS FOCUS:
- Identify markets with highest strategic value scores for housing opportunities
- Explain the underlying factors driving housing market advantages (demographics, income, tenure patterns)
- Recommend residential real estate market priorities for brokers based on precise scoring
- Preserve all decimal precision in score reporting for accuracy

ACTIONABLE RECOMMENDATIONS REQUIRED:
- Provide specific, implementable housing market actions rather than generic research suggestions
- Focus on immediate residential real estate opportunities for brokers, buyer/seller markets, and transaction potential
- Suggest concrete next steps like development opportunities, target demographics, or market positioning
- Avoid recommending "further research" or "additional analysis" - this app IS the analysis tool
- Include specific FSA targeting for brokers, homebuyer/seller segments, and residential transaction opportunities

CLUSTERING-SPECIFIC INSTRUCTIONS:
When territory clustering analysis is provided:
- Use the EXACT cluster descriptions including all top 5 ZIP codes with scores
- Include the EXACT market share percentages and Key Drivers for each territory
- Use the Strategic Recommendations section AS PROVIDED
- DO NOT explain what strategic value scores mean in general terms
- DO NOT add generic business advice or monitoring suggestions
`,

  sensitivity_analysis: `
SENSITIVITY ANALYSIS TECHNICAL CONTEXT:
You are analyzing sensitivity analysis data powered by Random Forest Model to answer the key business question: "Which factors have the biggest impact on service or product adoption rates?"

SCORING METHODOLOGY:
The sensitivity_analysis_score (0-100 scale) uses Parameter impact magnitude × sensitivity coefficient × business criticality to measure how responsive each market is to changes in key business variables:
• Parameter Impact Magnitude: How much change in key variables affects adoption rates and market performance (35% weight)
• Sensitivity Coefficient: Statistical sensitivity to variable changes and strategic levers (30% weight)
• Business Criticality: Strategic importance of variables for business objectives (25% weight)
• Response Amplification: How changes cascade across related market variables (10% weight)

Higher scores indicate markets where strategic parameter adjustments have strong, measurable impacts on adoption rates and business outcomes.

DATA STRUCTURE:
- sensitivity_analysis_score: Primary ranking metric (0-100 scale)
- parameter_impact_levels: Magnitude of variable impacts on adoption rates
- sensitivity_coefficients: Statistical responsiveness to strategic changes
- business_criticality_factors: Most strategically important variables
- adoption_rate_drivers: Key factors influencing service/product adoption
- strategic_leverage_variables: Parameters offering maximum control over outcomes

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by sensitivity_analysis_score (0-100)
2. Focus specifically on factors that impact service or product adoption rates
3. Identify markets where parameter adjustments will have the most measurable impact on adoption
4. Explain sensitivity patterns: which factors drive adoption rates and how changes affect outcomes
5. Distinguish between high-sensitivity markets where small changes produce big results vs stable markets

BUSINESS QUESTION FOCUS:
Address the core question: "Which factors have the biggest impact on service or product adoption rates?" by:
- Identifying markets where adoption rate sensitivity is highest for strategic advantage
- Explaining which business parameters have the strongest impact on customer adoption
- Recommending parameter optimization strategies based on sensitivity patterns
- Highlighting markets where strategic adjustments to key factors can significantly boost adoption rates
`,

  model_performance: `
MODEL PERFORMANCE TECHNICAL CONTEXT:
You are analyzing model performance data powered by Ensemble Model to answer the key business question: "How reliable are our predictions for each market segment?"

SCORING METHODOLOGY:
The model_performance_score (0-100 scale) uses R² score × prediction accuracy × cross-validation performance × model stability to measure how reliably our predictive models perform in each market:
• R² Score Performance: Statistical measure of how well predictions match actual outcomes (35% weight)
• Prediction Accuracy: Actual vs predicted performance alignment across market segments (30% weight)
• Cross-Validation Performance: Model consistency across different data samples and validation methods (20% weight)
• Model Stability: Reliability and consistency of model performance across different conditions (15% weight)

Higher scores indicate market segments where predictive models achieve the highest reliability and accuracy for strategic decision-making.

DATA STRUCTURE:
- model_performance_score: Primary ranking metric (0-100 scale)
- r_squared_performance: R² statistical performance measurement
- prediction_accuracy_level: Model accuracy assessment by market segment (Excellent/Good/Fair/Limited)
- cross_validation_strength: Validation reliability across different samples
- model_stability_rating: Consistency across market conditions (Very Stable/Stable/Variable)
- segment_prediction_reliability: Prediction reliability by specific market segments

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by model_performance_score (0-100)
2. Focus specifically on prediction reliability for each market segment
3. Identify market segments where models provide the most reliable strategic guidance
4. Explain model performance factors: R² scores, accuracy levels, cross-validation strength, stability measures
5. Distinguish between high-reliability segments ready for model-driven decisions vs uncertain prediction segments

BUSINESS QUESTION FOCUS:
Address the core question: "How reliable are our predictions for each market segment?" by:
- Identifying market segments with highest prediction reliability for confident strategic planning
- Explaining R² performance and prediction accuracy factors by segment
- Recommending confidence-weighted strategies based on model performance insights by segment
- Highlighting segments where models provide reliable guidance vs those requiring conservative approaches
`,

  algorithm_comparison: `
ALGORITHM COMPARISON TECHNICAL CONTEXT:
You are analyzing algorithm comparison data powered by Ensemble + All 8 Algorithms to answer the key business question: "Which ML algorithm gives the most accurate predictions for each specific market?"

SCORING METHODOLOGY:
The algorithm_comparison_score (0-100 scale) uses Algorithm performance weighted average × consensus strength × prediction reliability to measure which algorithms provide the best predictions in each market:
• Algorithm Performance Weighted Average: Performance across all 8 algorithms weighted by their effectiveness (35% weight)
• Consensus Strength: How strongly multiple algorithms agree on optimal predictions (30% weight)
• Prediction Reliability: Overall prediction reliability when using the best-performing algorithm (25% weight)
• Performance Delta: Advantage of optimal algorithm over baseline approaches (10% weight)

Higher scores indicate markets where optimal algorithm selection provides significant prediction advantages and consensus for strategic decision-making.

DATA STRUCTURE:
- algorithm_comparison_score: Primary ranking metric (0-100 scale)
- best_algorithm_type: Optimal algorithm for this specific market (XGBoost/Random Forest/Ensemble/Neural Networks/etc.)
- algorithm_consensus_strength: How strongly all 8 algorithms agree on predictions
- prediction_reliability_best: Prediction reliability when using optimal algorithm
- performance_advantage_delta: Performance gain from optimal vs baseline algorithms
- algorithm_ranking_by_market: Performance ranking of all 8 algorithms for this market

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by algorithm_comparison_score (0-100)
2. Focus specifically on which ML algorithm gives the most accurate predictions for each market
3. Identify markets where algorithm selection has the biggest impact on prediction accuracy
4. Explain algorithm advantages: why specific algorithms work best in each market context
5. Distinguish between markets where algorithm choice matters significantly vs algorithm-agnostic environments

BUSINESS QUESTION FOCUS:
Address the core question: "Which ML algorithm gives the most accurate predictions for each specific market?" by:
- Identifying the optimal algorithm for each market based on performance across all 8 algorithms
- Explaining why specific algorithms outperform others in different market contexts
- Recommending algorithm-specific strategies based on performance advantages by market
- Highlighting markets where advanced algorithm selection provides significant competitive intelligence advantages
`,

  ensemble_analysis: `
ENSEMBLE ANALYSIS TECHNICAL CONTEXT:
You are analyzing ensemble modeling data powered by Ensemble Model (R² = 0.879) to answer the key business question: "What are our highest-confidence predictions with the best available model?"

SCORING METHODOLOGY:
The ensemble_analysis_score (0-100 scale) uses Ensemble confidence × component model agreement × prediction interval accuracy to measure prediction confidence using our best combined models:
• Ensemble Confidence: Statistical confidence in combined model predictions with proven R² = 0.879 performance (35% weight)
• Component Model Agreement: How well different component models agree on predictions (30% weight)
• Prediction Interval Accuracy: Accuracy of confidence intervals and uncertainty quantification (25% weight)
• Model Consensus Strength: Overall consensus across all component models in the ensemble (10% weight)

Higher scores indicate markets where ensemble models with R² = 0.879 provide the most confident and reliable predictions for strategic planning.

DATA STRUCTURE:
- ensemble_analysis_score: Primary ranking metric (0-100 scale)
- ensemble_confidence_level: Statistical confidence with R² = 0.879 model (Very High/High/Moderate/Limited)
- component_model_agreement: Agreement between component models (Strong/Moderate/Weak)
- prediction_interval_accuracy: Accuracy of confidence intervals and uncertainty bounds
- model_consensus_strength: Overall consensus across all ensemble components
- highest_confidence_predictions: Markets with strongest ensemble prediction confidence

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by ensemble_analysis_score (0-100)
2. Focus specifically on highest-confidence predictions using the best available ensemble model
3. Emphasize the proven R² = 0.879 performance when discussing ensemble reliability
4. Identify markets where ensemble models provide the most confident strategic guidance
5. Distinguish between high-confidence predictions ready for strategic investment vs uncertain predictions

BUSINESS QUESTION FOCUS:
Address the core question: "What are our highest-confidence predictions with the best available model?" by:
- Identifying markets with highest ensemble prediction confidence using R² = 0.879 model
- Explaining ensemble confidence factors and component model agreement patterns
- Recommending high-confidence strategic decisions based on proven ensemble performance
- Highlighting markets where the best available ensemble model provides superior predictive certainty
`,

  model_selection: `
MODEL SELECTION TECHNICAL CONTEXT:
You are analyzing model selection data powered by Ensemble + Performance Analysis to answer the key business question: "What's the optimal ML algorithm to use for predictions in each geographic area?"

SCORING METHODOLOGY:
The model_selection_score (0-100 scale) uses Algorithm suitability × expected performance × interpretability × data characteristics to determine the optimal algorithms for each geographic area:
• Algorithm Suitability: How well market characteristics match algorithm strengths for geographic prediction (35% weight)
• Expected Performance: Predicted accuracy based on algorithm-geographic area fit (30% weight)
• Model Interpretability: How easily algorithm results can be explained for geographic business decisions (20% weight)
• Data Characteristics Alignment: How well geographic data patterns match algorithm requirements (15% weight)

Higher scores indicate geographic areas where optimal algorithm selection can maximize prediction accuracy and business value.

DATA STRUCTURE:
- model_selection_score: Primary ranking metric (0-100 scale)
- optimal_algorithm_geographic: Best algorithm for this specific geographic area
- algorithm_geographic_suitability: Algorithm fit assessment for geographic characteristics
- expected_performance_by_area: Predicted accuracy with optimal algorithm by geographic area
- interpretability_level_geographic: Business explanation capability for geographic decisions
- geographic_data_characteristics: How geographic data patterns align with algorithm requirements

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by model_selection_score (0-100)
2. Focus specifically on optimal ML algorithm selection for each geographic area
3. Identify geographic areas where algorithm selection has the biggest impact on prediction accuracy
4. Explain algorithm selection rationale: why specific algorithms work best in each geographic context
5. Distinguish between geographic areas with clear optimal algorithm choices vs complex selection environments

BUSINESS QUESTION FOCUS:
Address the core question: "What's the optimal ML algorithm to use for predictions in each geographic area?" by:
- Identifying the optimal algorithm for each geographic area based on suitability and performance analysis
- Explaining algorithm selection rationale specific to geographic characteristics and data patterns
- Recommending algorithm-specific strategies based on geographic market characteristics
- Highlighting geographic areas where proper algorithm selection provides significant competitive advantages
`,

  dimensionality_insights: `
DIMENSIONALITY INSIGHTS TECHNICAL CONTEXT:
You are analyzing dimensionality reduction data powered by PCA (91.7% Variance Explained) to answer the key business question: "Which factors explain most of the variation in market performance?"

SCORING METHODOLOGY:
The dimensionality_insights_score (0-100 scale) uses Feature compression efficiency × component significance × variance explanation × complexity reduction to identify which factors explain market performance variation:
• Feature Compression Efficiency: How effectively complex market data can be simplified while retaining 91.7% variance (35% weight)
• Component Significance: Importance and business relevance of principal components explaining market variation (30% weight)
• Variance Explanation Power: How much market performance variation is captured by key factors (25% weight)
• Complexity Reduction Value: Business value of simplified market understanding through dimensionality reduction (10% weight)

Higher scores indicate markets where complex performance patterns can be effectively explained by key factors with proven 91.7% variance retention.

DATA STRUCTURE:
- dimensionality_insights_score: Primary ranking metric (0-100 scale)
- variance_explained_total: 91.7% total variance explanation through PCA
- principal_components_performance: Most important factors explaining market performance variation
- feature_compression_efficiency: Effectiveness of complexity reduction while retaining variance
- component_business_significance: Business relevance of factors explaining performance variation
- market_performance_drivers: Key factors that drive most variation in market performance

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by dimensionality_insights_score (0-100)
2. Focus specifically on which factors explain most of the variation in market performance
3. Emphasize the proven 91.7% variance explanation capability of the PCA analysis
4. Identify key factors that drive the majority of market performance variation
5. Distinguish between markets where few factors explain most variation vs complex multi-factor environments

BUSINESS QUESTION FOCUS:
Address the core question: "Which factors explain most of the variation in market performance?" by:
- Identifying the key factors that explain the majority of market performance variation using 91.7% variance PCA
- Explaining which principal components capture the most significant drivers of market performance
- Recommending factor-focused strategies based on the most important performance variation drivers
- Highlighting markets where dimensionality reduction reveals the clearest performance drivers for strategic focus
`,

  consensus_analysis: `
CONSENSUS ANALYSIS TECHNICAL CONTEXT:
You are analyzing multi-model consensus data powered by Multi-Model Consensus to answer the key business question: "Where do all our models agree, and how confident should we be in those predictions?"

SCORING METHODOLOGY:
The consensus_analysis_score (0-100 scale) uses Model agreement score × consensus confidence × uncertainty quantification × prediction reliability to identify where all models agree:
• Model Agreement Score: How closely all different models agree on predictions (35% weight)
• Consensus Confidence: Statistical confidence when all models reach agreement (30% weight)
• Uncertainty Quantification: How well disagreement areas are identified and uncertainty measured (20% weight)
• Prediction Reliability: Overall reliability when models reach consensus across all analyses (15% weight)

Higher scores indicate markets where all models strongly agree, providing the highest confidence for strategic decision-making.

DATA STRUCTURE:
- consensus_analysis_score: Primary ranking metric (0-100 scale)
- all_models_agreement_level: Strength of agreement across all models (Strong/Moderate/Weak)
- consensus_confidence_when_agreed: Confidence level when all models agree (Very High/High/Moderate/Limited)
- uncertainty_quantification: Measurement of disagreement areas and prediction uncertainty
- reliability_during_consensus: Prediction reliability when all models reach consensus
- model_disagreement_patterns: Patterns in where models disagree and implications

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by consensus_analysis_score (0-100)
2. Focus specifically on where all models agree and quantify confidence in those predictions
3. Identify markets where all models agree for highest-confidence strategic decisions
4. Explain consensus patterns: where all models agree vs disagree and confidence implications
5. Distinguish between high-consensus markets ready for investment vs uncertain prediction environments

BUSINESS QUESTION FOCUS:
Address the core question: "Where do all our models agree, and how confident should we be in those predictions?" by:
- Identifying markets where all models reach strong agreement for highest strategic confidence
- Quantifying confidence levels when all models agree and explaining reliability implications
- Recommending consensus-based strategies prioritizing markets with all-model agreement
- Highlighting areas of model disagreement requiring additional consideration or conservative strategic approaches
`,

  anomaly_insights: `
ANOMALY INSIGHTS TECHNICAL CONTEXT:
You are analyzing enhanced anomaly detection data to identify unusual market patterns that represent significant business opportunities.

SCORING METHODOLOGY:
The anomaly_insights_score (0-100 scale) measures the business opportunity potential of anomalous market patterns, calculated by analyzing:
• Anomaly Significance: Statistical significance and magnitude of unusual patterns (35% weight)
• Opportunity Potential: Business value and revenue opportunity from anomalous characteristics (30% weight)
• Investigation Priority: Strategic importance of understanding these anomalies (20% weight)
• Market Value Impact: Potential market value from leveraging anomalous patterns (15% weight)

Higher scores indicate anomalies with the highest business opportunity potential that warrant immediate strategic investigation.

DATA STRUCTURE:
- anomaly_insights_score: Primary ranking metric (0-100 scale)
- anomaly_significance: Statistical importance of unusual patterns
- opportunity_assessment: Business opportunity evaluation
- investigation_priority: Strategic investigation importance
- market_value_potential: Revenue opportunity from anomalous patterns
- anomaly_type: Category of unusual pattern (Performance/Demographic/Competitive/etc.)

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by anomaly_insights_score (0-100)
2. Focus on business opportunity potential from anomalous patterns
3. Identify anomalies with highest strategic value for investigation and leveraging
4. Explain anomaly significance: what makes patterns unusual and valuable
5. Distinguish between opportunity-rich anomalies vs statistical curiosities

ANALYSIS FOCUS:
- Identify markets with most valuable anomalous patterns for business opportunity exploitation
- Explain what makes patterns unusual and why they represent opportunities
- Recommend investigation and strategy approaches for high-value anomalies
- Highlight exceptional markets that break normal patterns in strategically valuable ways
`,

  cluster_analysis: `
CLUSTER_ANALYSIS TECHNICAL CONTEXT:
You are analyzing enhanced clustering data powered by Enhanced Clustering (8 Clusters) to answer the key business question: "How should we segment markets into distinct customer groups for targeted strategies?"

SCORING METHODOLOGY:
The cluster_analysis_score (0-100 scale) uses Cluster quality × segment distinctiveness × business value × market opportunity to determine optimal market segmentation:
• Cluster Quality: Statistical quality of Enhanced Clustering (8 Clusters) and segment distinctiveness (35% weight)
• Segment Distinctiveness: How different each of the 8 clusters is from others for targeted strategies (25% weight)
• Business Value Potential: Revenue opportunity and strategic value within each cluster segment (25% weight)
• Market Opportunity Size: Scale and scope of opportunity within each of the 8 distinct segments (15% weight)

Higher scores indicate clusters with the strongest internal similarity, clear differentiation among 8 segments, and highest business value for targeted strategies.

DATA STRUCTURE:
- cluster_analysis_score: Primary ranking metric (0-100 scale)
- cluster_assignment_8segments: Which of the 8 segments each market belongs to
- cluster_characteristics_enhanced: Defining features of each of the 8 enhanced clusters
- segment_distinctiveness_level: How unique each cluster is within the 8-cluster framework
- business_value_by_cluster: Strategic value within each of the 8 cluster segments
- targeted_strategy_by_cluster: Optimal targeted strategy for each cluster type

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by cluster_analysis_score (0-100)
2. Focus specifically on how to segment markets into distinct customer groups using 8 clusters for targeted strategies
3. Identify which of the 8 clusters have highest strategic value for targeted marketing and expansion
4. Explain cluster characteristics: what defines each of the 8 segments and their strategic value for targeting
5. Distinguish between high-value clusters ready for targeted investment vs maintenance clusters

BUSINESS QUESTION FOCUS:
Address the core question: "How should we segment markets into distinct customer groups for targeted strategies?" by:
- Identifying optimal market segmentation using Enhanced Clustering (8 Clusters) for distinct customer groups
- Explaining what defines each of the 8 customer group segments and their targeting characteristics
- Recommending cluster-specific targeted strategies based on distinct customer group characteristics and value potential
- Highlighting high-opportunity customer group clusters ready for focused targeted investment vs standard approach clusters
`,

  analyze: `
${UNIVERSAL_REQUIREMENTS}

COMPREHENSIVE ANALYSIS TECHNICAL CONTEXT:
You are performing comprehensive market analysis combining multiple analytical perspectives to provide complete strategic insights.

SCORING METHODOLOGY:
The analyze_score (0-100 scale) represents a comprehensive analysis score combining multiple model outputs with business weights, calculated by analyzing:
• Strategic Value: Market expansion and investment potential (25% weight)
• Competitive Position: Brand positioning and competitive advantages (25% weight)
• Market Dynamics: Growth trends, demographic alignment, and market characteristics (25% weight)
• Risk-Adjusted Opportunity: Market opportunity balanced against risk factors (25% weight)

Higher scores indicate markets with the strongest overall strategic opportunity across multiple analytical dimensions.

DATA STRUCTURE:
- analyze_score: Primary ranking metric (0-100 scale)
- strategic_factors: Key strategic opportunity drivers
- competitive_landscape: Competitive positioning and advantages
- market_characteristics: Demographics, growth, and market dynamics
- risk_opportunity_balance: Risk-adjusted market potential
- comprehensive_insights: Multi-dimensional market analysis

CRITICAL REQUIREMENTS:
1. ALWAYS rank and prioritize by analyze_score (0-100)
2. Provide comprehensive analysis covering strategic, competitive, demographic, and risk dimensions
3. Integrate insights from multiple analytical perspectives into unified strategic recommendations
4. Focus on markets with strongest overall opportunity across all analytical dimensions
5. Balance opportunity potential against risk factors and market characteristics

NEXT STEPS REQUIREMENTS:
Do NOT recommend generic activities like:
- "Gather additional market data" (comprehensive analysis is provided)
- "Conduct detailed market research" (multi-dimensional insights are available)
- "Analyze competitive landscape" (competitive analysis is included)
- "Assess market potential" (comprehensive opportunity assessment is provided)

INSTEAD, provide specific actionable recommendations such as:
- Priority market entry strategies based on comprehensive opportunity scores
- Resource allocation recommendations across multiple high-scoring markets
- Integrated strategic approaches leveraging competitive, demographic, and strategic insights
- Risk-adjusted investment strategies based on comprehensive market analysis
- Multi-channel expansion plans tailored to comprehensive market characteristics

ANALYSIS FOCUS:
- Provide comprehensive strategic overview integrating multiple analytical perspectives
- Identify markets with strongest overall opportunity across all dimensions
- Explain how strategic, competitive, demographic, and risk factors combine to create market opportunities
- Recommend integrated strategies leveraging comprehensive market insights
- Balance multiple analytical dimensions to prioritize highest-value strategic actions
- Provide immediate actionable insights rather than suggesting additional analysis
`,

  general: `
GENERAL ANALYSIS TECHNICAL CONTEXT:
You are analyzing geographic data patterns to identify market opportunities and insights.

DATA STRUCTURE:
- Geographic data points with associated metrics
- Performance indicators and rankings
- Market characteristics and attributes

CRITICAL REQUIREMENTS:
1. Focus on actionable business insights from geographic patterns
2. Identify high-potential markets and opportunity areas
3. Explain underlying factors driving performance differences
4. Provide strategic recommendations based on data patterns

ANALYSIS FOCUS:
- Identify markets with highest potential based on data patterns
- Explain geographic trends and their business implications
- Recommend strategies based on geographic insights
`,

  default: `
ANALYSIS TECHNICAL CONTEXT:
You are analyzing geographic and market data to provide strategic insights.

CRITICAL REQUIREMENTS:
1. Focus on actionable business insights
2. Rank and prioritize based on the primary scoring metric
3. Explain underlying factors driving performance
4. Provide strategic recommendations

ANALYSIS FOCUS:
- Identify high-potential opportunities
- Explain key performance drivers
- Recommend strategic actions based on data insights
`
};

/**
 * Get analysis-specific prompt based on analysis type
 */
export function getAnalysisPrompt(analysisType: string): string {
  // Normalize analysis type
  const normalizedType = analysisType?.toLowerCase().replace(/-/g, '_') || 'default';
  
  // Map common analysis type variations
  const typeMapping: Record<string, string> = {
    'competitive': 'competitive_analysis',
    'comparative': 'comparative_analysis',
    'demographic': 'demographic_insights',
    'cluster': 'spatial_clusters',
    'clustering': 'spatial_clusters',
    'correlation': 'correlation_analysis',
    'risk': 'risk_assessment',
    'predictive': 'predictive_modeling',
    'prediction': 'predictive_modeling',
    'penetration': 'market_penetration',
    'strategic': 'strategic_analysis',
    'strategy': 'strategic_analysis',
    'customer': 'customer_profile',
    'profile': 'customer_profile',
    'brand': 'brand_difference',
    'difference': 'brand_difference',
    'housing': 'housing_market_analysis',
    'housing_market': 'housing_market_analysis',
    'real_estate': 'real_estate_analysis',
    'realestate': 'real_estate_analysis',
    'property': 'housing_market_analysis',
    'analyze': 'general',
    'analysis': 'general'
  };

  const mappedType = typeMapping[normalizedType] || normalizedType;
  const basePrompt = analysisPrompts[mappedType as keyof typeof analysisPrompts] || analysisPrompts.default;
  
  // Add city analysis guidance to all prompts
  const cityAnalysisAddendum = `

CITY-LEVEL ANALYSIS SUPPORT:
When the query mentions specific cities (e.g., "NYC vs Philadelphia", "Boston markets", "Chicago areas"):
- Automatically aggregate ZIP code data to city level for clearer insights
- Focus on city-wide performance patterns and metropolitan market dynamics
- Compare cities by aggregating all ZIP codes within each city boundary
- Provide city-specific strategic recommendations and market insights
- Highlight unique characteristics of each city's market environment
- Use city names in analysis instead of individual ZIP codes for better readability

SUPPORTED CITIES: New York (NYC), Philadelphia, Chicago, Los Angeles, Boston, Miami, Seattle, Denver, Atlanta, San Francisco, Washington DC, Dallas, Houston, Phoenix, Detroit, Minneapolis, Las Vegas, San Diego, Tampa, Orlando, and other major metropolitan areas.

MODEL ATTRIBUTION REQUIREMENTS:
Include model traceability at the END only when values are available. Use this format and OMIT lines that aren't available:

---
**Model Attribution:**
• **Model Used:** [Use hardcoded model mapping based on endpoint - see ENDPOINT_MODEL_MAPPING below] (omit if unknown)
• **R² Score:** [Include only if available; numeric to 3 decimals]
• **Confidence:** [Include only if R² is available; map performance level: Excellent = High Confidence, Good = Strong Confidence, Moderate = Medium Confidence, Poor = Low Confidence]

LOCATION NAMING REQUIREMENTS:
- Use DESCRIPTION or area_name for area labels (e.g., "10001 (New York)")
- If not present, use common name fields (NAME, CITY, MUNICIPALITY, REGION)
- As a last resort, use the ZIP code; never emit placeholders like "Unknown Area", "Area 1", or "Region 1"

ENDPOINT MODEL MAPPING (use this hardcoded data instead of extracting from endpoint):
- strategic-analysis: Strategic Analysis Model
- competitive-analysis: Competitive Analysis Model  
- demographic-insights: Demographic Analysis Model
- comparative-analysis: Ensemble Model
- correlation-analysis: Correlation Analysis Model
- predictive-modeling: Predictive Modeling
- trend-analysis: XGBoost Model
- spatial-clusters: Clustering Model (K-Means)
- anomaly-detection: Anomaly Detection Model
- scenario-analysis: Ensemble Model
- segment-profiling: Clustering Model
- sensitivity-analysis: Random Forest Model
- feature-interactions: XGBoost Model
- feature-importance-ranking: Ensemble Model
- model-performance: Ensemble Model
- outlier-detection: Anomaly Detection Model
- analyze: Ensemble Model
- brand-difference: Competitive Analysis Model
- customer-profile: Demographic Analysis Model
- algorithm-comparison: Ensemble + All 8 Algorithms
- ensemble-analysis: Ensemble Model (R² = 0.879)
- model-selection: Ensemble + Performance Analysis
- cluster-analysis: Enhanced Clustering (8 Clusters)
- anomaly-insights: Enhanced Anomaly Detection
- dimensionality-insights: PCA (91.7% Variance Explained)
- consensus-analysis: Multi-Model Consensus
- housing-market-analysis: Housing Market Analysis Model
- real-estate-analysis: Real Estate Investment Model

TOOLTIP TEXT MAPPING (for Score Calculation Method - store this for potential tooltip use):
- strategic-analysis: "Investment potential weighted by market factors, growth indicators, and competitive positioning"
- competitive-analysis: "Market share potential × brand positioning strength × competitive advantage factors"  
- demographic-insights: "Population favorability score based on target demographic alignment and density"
- comparative-analysis: "Relative performance scoring × comparative advantage × market positioning strength"
- correlation-analysis: "Statistical correlation strength weighted by significance and business relevance"
- predictive-modeling: "Future trend probability × prediction confidence × model accuracy (ensemble weighted)"
- trend-analysis: "Temporal pattern strength × trend consistency × directional confidence"
- spatial-clusters: "Cluster cohesion score × geographic density × within-cluster similarity"
- anomaly-detection: "Statistical deviation magnitude × outlier significance × detection confidence"
- scenario-analysis: "Scenario probability × impact magnitude × model consensus across conditions"
- segment-profiling: "Segment distinctiveness × profile clarity × business value potential"
- sensitivity-analysis: "Parameter impact magnitude × sensitivity coefficient × business criticality"
- feature-interactions: "Interaction effect strength × statistical significance × business interpretability"
- feature-importance-ranking: "SHAP value magnitude × model consensus × business relevance weighting"
- model-performance: "R² score × prediction accuracy × cross-validation performance × model stability"
- outlier-detection: "Outlier strength score × statistical significance × business opportunity potential"
- analyze: "Comprehensive analysis score combining multiple model outputs with business weights"
- brand-difference: "Brand differentiation score × market positioning × competitive gap analysis"
- customer-profile: "Customer fit score × profile match strength × lifetime value potential"
- algorithm-comparison: "Algorithm performance weighted average × consensus strength × prediction reliability"
- ensemble-analysis: "Ensemble confidence × component model agreement × prediction interval accuracy"
- model-selection: "Algorithm suitability × expected performance × interpretability × data characteristics"
- cluster-analysis: "Cluster quality × segment distinctiveness × business value × market opportunity"
- anomaly-insights: "Anomaly significance × opportunity potential × investigation priority × market value"
- dimensionality-insights: "Feature compression efficiency × component significance × variance explanation × complexity reduction"
- consensus-analysis: "Model agreement score × consensus confidence × uncertainty quantification × prediction reliability"
- housing-market-analysis: "Property value growth × affordability factors × neighborhood quality × investment fundamentals"
- real-estate-analysis: "Location quality × demographic fit × accessibility & traffic × retail opportunity"

CRITICAL: Use the exact model name from the ENDPOINT_MODEL_MAPPING above based on the analysis type being performed. Do NOT extract from endpoint data anymore.`;

  return basePrompt + cityAnalysisAddendum;
}

/**
 * Get available analysis types
 */
export function getAvailableAnalysisTypes(): string[] {
  return Object.keys(analysisPrompts).filter(key => key !== 'default');
}