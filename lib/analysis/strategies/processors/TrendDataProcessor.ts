import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

/**
 * TrendDataProcessor - Handles data processing for trend analysis
 * 
 * Processes trend analysis results with time-series patterns, growth trajectories,
 * seasonal variations, and forecasting insights for real estate markets.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class TrendDataProcessor extends BaseProcessor {
  
  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate trend-specific fields
    const hasTrendFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        // Check for trend-related fields
        ((record as any).trend_score !== undefined ||      // Trend score
         (record as any).growth_rate !== undefined ||      // Growth rate
         (record as any).momentum !== undefined ||         // Momentum indicator
         (record as any).trend_direction !== undefined ||  // Trend direction
         (record as any).seasonality !== undefined ||      // Seasonal patterns
         (record as any).volatility !== undefined ||       // Volatility measure
         (record as any).forecast !== undefined ||         // Forecast values
         (record as any).change_rate !== undefined ||      // Change rate
         (record as any).time_series !== undefined)        // Time series data
      );
    
    return hasTrendFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for TrendDataProcessor');
    }

  // Determine canonical primary score field for trend_analysis (honor metadata override)
  const primary = getPrimaryScoreField('trend_analysis', (rawData as any)?.metadata) || 'trend_score';
  // Process records with trend information
  const records = this.processTrendRecords(rawData.results, primary);
    
    // Calculate trend statistics with trend-specific metrics
    const statistics = this.calculateTrendStatistics(records);
    
    // Analyze trend patterns
    const trendAnalysis = this.analyzeTrendPatterns(records);
    
    // Process feature importance for trend factors
    const featureImportance = this.processTrendFeatureImportance(rawData.feature_importance || []);
    
    // Generate trend summary
    const summary = this.generateTrendSummary(records, trendAnalysis, rawData.summary);

    return {
      type: 'trend_analysis',
      records,
      summary,
      featureImportance,
      statistics,
      targetVariable: primary,
      trendAnalysis // Additional metadata for trend visualization
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  private processTrendRecords(rawRecords: any[], primaryField: string): GeographicDataPoint[] {
    return rawRecords.map((record, index) => {
      // Use BaseProcessor methods for area identification
      const area_id = this.extractGeographicId(record) || `area_${index}`;
      const area_name = this.generateAreaName(record);
      
      // Extract trend score using configuration-driven approach
      const trendScore = this.extractPrimaryMetric(record);
      
  // Use trend score as the primary value
  const value = trendScore;
      
      // Extract trend-specific properties
      const properties = {
        ...this.extractProperties(record),
        trend_score: trendScore,
        growth_rate: (record as any).growth_rate || 0,
        momentum: (record as any).momentum || 0,
        trend_direction: (record as any).trend_direction || 'stable',
        seasonality: (record as any).seasonality || 0,
        volatility: (record as any).volatility || 0,
        forecast_confidence: this.calculateForecastConfidence(record),
        trend_strength: this.calculateTrendStrength(record),
        stability_index: this.calculateStabilityIndex(record)
      };
      
  // Mirror primary canonical field at top-level and within properties for consistency
  (properties as any)[primaryField] = trendScore;

  // Extract SHAP values
      const shapValues = this.extractShapValues(record);
      
      // Category based on trend characteristics
      const category = this.getTrendCategory(trendScore, properties);

      return {
        area_id,
        area_name,
        value,
        rank: 0, // Will be calculated in ranking
        category,
        coordinates: (record as any).coordinates || [0, 0],
  // Mirror primary trend field at top-level
  [primaryField]: value,
  properties,
        shapValues
      };
    }).sort((a, b) => b.value - a.value) // Sort by trend score
      .map((record, index) => ({ ...record, rank: index + 1 })); // Assign ranks
  }


  private calculateForecastConfidence(record: any): number {
    // Calculate confidence in trend forecasting
    const volatility = (record as any).volatility || 0.5;
    const dataQuality = (record as any).data_quality || 0.8;
    const timeSpan = (record as any).time_span || 12; // months
    
    // Higher confidence with lower volatility, better data, longer timespan
    let confidence = 0;
    confidence += Math.max(0, 0.5 - volatility); // 0-0.5 based on volatility
    confidence += dataQuality * 0.3; // 0-0.3 based on data quality
    confidence += Math.min(0.2, timeSpan / 60); // 0-0.2 based on timespan (up to 5 years)
    
    return Math.min(1, confidence);
  }

  private calculateTrendStrength(record: any): number {
    // Calculate overall trend strength
    const growthRate = Math.abs((record as any).growth_rate || 0);
    const momentum = Math.abs((record as any).momentum || 0);
    const consistency = 1 - ((record as any).volatility || 0.5);
    
    // Combine factors for overall strength
    const strength = (growthRate * 0.4 + momentum * 0.3 + consistency * 0.3);
    return Math.min(1, strength);
  }

  private calculateStabilityIndex(record: any): number {
    // Calculate trend stability/predictability
    const volatility = (record as any).volatility || 0.5;
    const seasonality = (record as any).seasonality || 0;
    const autocorrelation = (record as any).autocorrelation || 0.5;
    
    // Higher stability with lower volatility, predictable seasonality, strong autocorrelation
    const stability = (1 - volatility) * 0.5 + Math.abs(seasonality) * 0.3 + autocorrelation * 0.2;
    return Math.min(1, stability);
  }

  private extractProperties(record: any): Record<string, any> {
    const internalFields = new Set([
      'area_id', 'id', 'area_name', 'name', 'trend_score',
      'coordinates', 'shap_values'
    ]);
    
    const properties: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(record)) {
      if (!internalFields.has(key)) {
        properties[key] = value;
      }
    }
    
    return properties;
  }

  private extractShapValues(record: any): Record<string, number> {
    if ((record as any).shap_values && typeof (record as any).shap_values === 'object') {
      return (record as any).shap_values;
    }
    
    const shapValues: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(record)) {
      if ((key.includes('shap') || key.includes('impact') || key.includes('contribution')) 
          && typeof value === 'number') {
        shapValues[key] = value;
      }
    }
    
    return shapValues;
  }

  private getTrendCategory(score: number, properties: any): string {
    // Categorize based on trend characteristics
    const growthRate = properties.growth_rate || 0;
    const momentum = properties.momentum || 0;
    
    if (score >= 80) return 'strong_positive_trend';
    if (score >= 60) return 'moderate_positive_trend';
    if (score >= 40) return 'stable_trend';
    if (score >= 20) return 'weak_trend';
    return 'negative_trend';
  }

  private calculateTrendStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
    const scores = records.map(r => r.value);
    const growthRates = records.map(r => (r.properties as any).growth_rate || 0);
    const momentums = records.map(r => (r.properties as any).momentum || 0);
    
    if (scores.length === 0) {
      return {
        total: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0,
        avgGrowthRate: 0, avgMomentum: 0, trendVolatility: 0
      };
    }
    
    const sorted = [...scores].sort((a, b) => a - b);
    const total = scores.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const mean = sum / total;
    
    const median = total % 2 === 0 
      ? (sorted[Math.floor(total / 2) - 1] + sorted[Math.floor(total / 2)]) / 2
      : sorted[Math.floor(total / 2)];
    
    const variance = scores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    // Trend-specific metrics
    const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / total;
    const avgMomentum = momentums.reduce((a, b) => a + b, 0) / total;
    const trendVolatility = records.reduce((sum, r) => sum + ((r.properties as any).volatility || 0), 0) / total;
    
    return {
      total,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev,
      avgGrowthRate,
      avgMomentum,
      trendVolatility
    };
  }

  private analyzeTrendPatterns(records: GeographicDataPoint[]): any {
    // Group by trend categories
    const categoryMap = new Map<string, GeographicDataPoint[]>();
    
    records.forEach(record => {
      const category = (record as any).category!;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(record);
    });
    
    // Analyze each category
    const categoryAnalysis = Array.from(categoryMap.entries()).map(([category, categoryRecords]) => {
      const avgScore = categoryRecords.reduce((sum, r) => sum + r.value, 0) / categoryRecords.length;
      const avgGrowthRate = categoryRecords.reduce((sum, r) => sum + ((r.properties as any).growth_rate || 0), 0) / categoryRecords.length;
      
      return {
        category,
        size: categoryRecords.length,
        percentage: (categoryRecords.length / records.length) * 100,
        avgTrendScore: avgScore,
        avgGrowthRate,
        topAreas: categoryRecords
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map(r => ({
            name: r.area_name,
            score: r.value,
            growthRate: (r.properties as any).growth_rate,
            momentum: (r.properties as any).momentum
          }))
      };
    });
    
    // Identify trend leaders and accelerating markets
    const trendLeaders = records
      .filter(r => r.category === 'strong_positive_trend')
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    const acceleratingMarkets = records
      .filter(r => (r.properties as any).momentum > 0.5)
      .sort((a, b) => (b.properties as any).momentum - (a.properties as any).momentum)
      .slice(0, 5);
    
    return {
      categories: categoryAnalysis,
      trendLeaders: trendLeaders.map(r => ({
        area: r.area_name,
        score: r.value,
        growthRate: (r.properties as any).growth_rate,
        momentum: (r.properties as any).momentum,
        stability: (r.properties as any).stability_index
      })),
      acceleratingMarkets: acceleratingMarkets.map(r => ({
        area: r.area_name,
        momentum: (r.properties as any).momentum,
        growthRate: (r.properties as any).growth_rate,
        trend: 'accelerating'
      })),
      marketMomentum: this.analyzeMarketMomentum(categoryAnalysis)
    };
  }

  private analyzeMarketMomentum(categoryAnalysis: any[]): string {
    const strongTrendPercentage = categoryAnalysis.find(c => c.category === 'strong_positive_trend')?.percentage || 0;
    const moderateTrendPercentage = categoryAnalysis.find(c => c.category === 'moderate_positive_trend')?.percentage || 0;
    
    if (strongTrendPercentage > 40) return 'strong_market_momentum';
    if (strongTrendPercentage + moderateTrendPercentage > 60) return 'positive_market_momentum';
    if (moderateTrendPercentage > 40) return 'moderate_market_momentum';
    return 'mixed_market_momentum';
  }

  private processTrendFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getTrendFeatureDescription((item as any).feature || (item as any).name),
      trendImpact: this.assessTrendImpact((item as any).importance || 0)
    })).sort((a, b) => b.importance - a.importance);
  }

  private getTrendFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'growth': 'Growth rate and expansion patterns',
      'momentum': 'Market momentum and acceleration indicators',
      'seasonality': 'Seasonal patterns and cyclical behavior',
      'volatility': 'Market volatility and stability measures',
      'forecast': 'Forecasting accuracy and predictability',
      'trend': 'Overall trend direction and strength',
      'change': 'Rate of change and transformation indicators',
      'time': 'Time-series patterns and temporal dynamics'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} trend characteristic`;
  }

  private assessTrendImpact(importance: number): string {
    if (importance >= 0.8) return 'primary_trend_driver';
    if (importance >= 0.6) return 'significant_trend_factor';
    if (importance >= 0.4) return 'moderate_trend_influence';
    if (importance >= 0.2) return 'minor_trend_factor';
    return 'negligible_trend_impact';
  }

  private generateTrendSummary(
    records: GeographicDataPoint[], 
    trendAnalysis: any, 
    rawSummary?: string
  ): string {
    const totalAreas = records.length;
    const trendLeaders = trendAnalysis.trendLeaders;
    const acceleratingMarkets = trendAnalysis.acceleratingMarkets;
    const marketMomentum = trendAnalysis.marketMomentum;
    
    // Start with formula explanation
    let summary = `**📊 Trend Score Formula:** Scores combine Growth Rate (40% weight - market expansion), Momentum (35% weight - acceleration), Trend Strength (15% weight - consistency), and Stability Index (10% weight - predictability). Higher scores indicate stronger positive trends.

`;
    
    // Enhanced baseline and trend metrics section
    const avgScore = records.reduce((sum, r) => sum + r.value, 0) / records.length;
    const avgGrowthRate = records.reduce((sum, r) => sum + ((r.properties as any).growth_rate || 0), 0) / records.length;
    const avgMomentum = records.reduce((sum, r) => sum + ((r.properties as any).momentum || 0), 0) / records.length;
    const avgTrendStrength = records.reduce((sum, r) => sum + ((r.properties as any).trend_strength || 0), 0) / records.length;
    
    summary += `**📈 Trend Baseline & Market Averages:** `;
    summary += `Market average trend score: ${avgScore.toFixed(1)} (range: ${records[records.length - 1]?.value.toFixed(1) || '0'}-${records[0]?.value.toFixed(1) || '0'}). `;
    summary += `Trend baseline: ${(avgGrowthRate * 100).toFixed(1)}% growth rate, ${(avgMomentum * 100).toFixed(1)}% momentum, ${(avgTrendStrength * 100).toFixed(1)}% trend strength. `;
    
    // Trend direction distribution
    const strongUptrend = records.filter(r => r.value >= 70).length;
    const moderateUptrend = records.filter(r => r.value >= 50).length;
    const stableTrend = records.filter(r => r.value >= 30).length;
    const decliningTrend = records.filter(r => r.value < 30).length;
    
    summary += `Trend distribution: ${strongUptrend} strong uptrends (${(strongUptrend/totalAreas*100).toFixed(1)}%), ${moderateUptrend} moderate+ trends (${(moderateUptrend/totalAreas*100).toFixed(1)}%), ${stableTrend} stable+ (${(stableTrend/totalAreas*100).toFixed(1)}%), ${decliningTrend} declining (${(decliningTrend/totalAreas*100).toFixed(1)}%).

`;
    
    summary += `**Trend Analysis Complete:** ${totalAreas} geographic markets analyzed across key trend indicators. `;
    
    // Enhanced trend leaders section with multiple examples
    if (trendLeaders.length > 0) {
      const topLeader = trendLeaders[0];
      summary += `**Trend Leaders:** ${topLeader.area} shows strongest trends with ${topLeader.score.toFixed(1)} trend score, ${(topLeader.growthRate * 100).toFixed(1)}% growth rate, and ${(topLeader.momentum * 100).toFixed(1)}% momentum. `;
      
      // Add additional trend leaders (2-5 areas)
      if (trendLeaders.length > 1) {
        const additionalLeaders = trendLeaders.slice(1, 5);
        const leaderNames = additionalLeaders.map((leader: any) => 
          `${leader.area} (${leader.score.toFixed(1)} score, ${(leader.growthRate * 100).toFixed(1)}% growth)`
        );
        
        if (leaderNames.length > 0) {
          summary += `Other strong trend markets include ${leaderNames.join(', ')}. `;
        }
      }
    }
    
    // Enhanced category breakdown with specific examples
    const categoryBreakdown = trendAnalysis.categories;
    if (categoryBreakdown.length > 0) {
      const strongCategory = categoryBreakdown.find((c: any) => c.category === 'strong_positive_trend');
      const moderateCategory = categoryBreakdown.find((c: any) => c.category === 'moderate_positive_trend');
      const stableCategory = categoryBreakdown.find((c: any) => c.category === 'stable_trend');
      
      if (strongCategory && strongCategory.size > 0) {
        summary += `**${strongCategory.size} Strong Growth Markets** (${strongCategory.percentage.toFixed(1)}%): `;
        const topStrong = strongCategory.topAreas.slice(0, 3);
        summary += topStrong.map((area: any) => `${(area as any).name} (${((area as any).growthRate * 100).toFixed(1)}%)`).join(', ');
        summary += '. ';
      }
      
      if (moderateCategory && moderateCategory.size > 0) {
        summary += `**${moderateCategory.size} Moderate Growth Markets** (${moderateCategory.percentage.toFixed(1)}%): `;
        const topModerate = moderateCategory.topAreas.slice(0, 3);
        summary += topModerate.map((area: any) => `${(area as any).name} (${((area as any).growthRate * 100).toFixed(1)}%)`).join(', ');
        summary += '. ';
      }
    }
    
    // Enhanced accelerating markets with detailed examples
    if (acceleratingMarkets.length > 0) {
      summary += `**${acceleratingMarkets.length} Accelerating Markets:** `;
      
      // Detailed first accelerating market
      const topAccelerating = acceleratingMarkets[0];
      summary += `${topAccelerating.area} shows highest momentum with ${(topAccelerating.momentum * 100).toFixed(1)}% acceleration and ${(topAccelerating.growthRate * 100).toFixed(1)}% growth. `;
      
      // Additional accelerating markets (2-6 areas)
      if (acceleratingMarkets.length > 1) {
        const additionalAccelerating = acceleratingMarkets.slice(1, 6);
        const acceleratingNames = additionalAccelerating.map((market: any) => 
          `${market.area} (${(market.momentum * 100).toFixed(1)}% momentum)`
        );
        
        if (acceleratingNames.length > 0) {
          summary += `Additional momentum leaders: ${acceleratingNames.join(', ')}. `;
        }
      }
    }
    
    // Market momentum insights
    summary += `Market momentum: ${marketMomentum.replace('_', ' ')}. `;
    
    // Add trend insights (variables already calculated above)
    summary += `**Market Overview:** Average trend score ${avgScore.toFixed(1)}, market growth ${(avgGrowthRate * 100).toFixed(1)}%, momentum index ${(avgMomentum * 100).toFixed(1)}%. `;
    
    // Strategic recommendations
    summary += `**Strategic Insights:** Market trends show `;
    if (avgGrowthRate > 0.15) {
      summary += `strong expansion opportunities with high growth rates. `;
    } else if (avgGrowthRate > 0.05) {
      summary += `moderate growth potential with steady expansion. `;
    } else {
      summary += `stabilizing conditions with selective opportunities. `;
    }
    
    summary += `**Recommendations:** Prioritize investment in strong trend leaders for maximum growth potential. Monitor accelerating markets for emerging opportunities. Develop strategic presence in moderate growth areas for sustained expansion. `;
    
    if (rawSummary) {
      summary += rawSummary;
    }
    
    return summary;
  }
  /**
   * Extract field value from multiple possible field names
   */

} 