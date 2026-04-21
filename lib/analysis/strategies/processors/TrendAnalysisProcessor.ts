/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

/**
 * TrendAnalysisProcessor - Handles data processing for the /trend-analysis endpoint
 * 
 * Processes real estate market trend analysis with focus on temporal patterns, growth rates,
 * housing market momentum, and trend consistency across geographic markets.
 * 
 * Now extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class TrendAnalysisProcessor extends BaseProcessor {
  private scoreField: string = 'trend_score';

  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have expected fields for trend analysis
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => {
        if (!record || !((record as any).area_id || (record as any).id || (record as any).ID)) {
          return false;
        }
        
        // Check for trend score or real estate trend metrics
        if ((record as any).trend_score !== undefined || (record as any).value !== undefined || (record as any).score !== undefined) {
          return true;
        }
        
        // Check for real estate trend indicators
        const hasRealEstateFields = (
          (record as any).ECYHRIAVG !== undefined || 
          (record as any).household_income !== undefined ||
          (record as any).housing_correlation_score !== undefined ||
          (record as any).hot_growth_market_index !== undefined
        );
        
        if (hasRealEstateFields) {
          return true;
        }
        
        // Check for other trend-relevant fields
        return (record as any).strategic_value_score !== undefined || (record as any).real_estate_analysis_score !== undefined;
      });
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`📈 [TREND ANALYSIS PROCESSOR] CALLED WITH ${rawData.results?.length || 0} RECORDS 📈`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for TrendAnalysisProcessor');
    }

  // Use canonical primary score field (allows metadata override)
  this.scoreField = getPrimaryScoreField('trend_analysis', (rawData as any)?.metadata ?? undefined) || 'trend_score';

    // Process records with trend strength scoring priority
    const processedRecords = rawData.results.map((record: any, index: number) => {
      // PRIORITIZE PRE-CALCULATED TREND STRENGTH SCORE
      const trendScore = this.extractTrendScore(record);
      
      // Extract ID using configuration-driven approach
      const recordId = this.extractGeographicId(record);
      
      // Generate area name using configuration
      const areaName = this.generateAreaName(record);
      
      // Extract real estate trend metrics using configuration-driven field mappings
      const householdIncome = this.extractNumericValue(record, this.configManager.getFieldMapping('incomeField'), 0);
      const population = this.extractNumericValue(record, this.configManager.getFieldMapping('populationField'), 0);
      const housingGrowth = this.extractNumericValue(record, ['hot_growth_market_index', 'growth_index', 'housing_growth'], 0);
      const housingAffordability = this.extractNumericValue(record, ['home_affordability_index', 'affordability_index'], 0);
      const newHomeOwners = this.extractNumericValue(record, ['new_home_owner_index', 'new_owner_index'], 0);
      
      // Extract strategic scores for trend correlation
      const strategicScore = Number((record as any).strategic_value_score) || 0;
      const realEstateScore = Number((record as any).real_estate_analysis_score) || 0;
      const housingCorrelationScore = Number((record as any).housing_correlation_score) || 0;
      
      // Calculate trend indicators
      const growthPotential = this.calculateGrowthPotential(record);
      const trendConsistency = this.calculateTrendConsistency(record);
      const volatilityIndex = this.calculateVolatilityIndex(record);
      
      const out: any = {
        area_id: recordId || `area_${index + 1}`,
        area_name: areaName,
        value: Math.round(trendScore * 100) / 100, // Use trend score as primary value
        trend_score: Math.round(trendScore * 100) / 100, // Add target variable at top level
        rank: 0, // Will be calculated after sorting
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          trend_score: trendScore,
          score_source: this.scoreField,
          // Real estate trend metrics
          household_income: householdIncome,
          total_population: population,
          housing_growth_index: housingGrowth,
          housing_affordability_index: housingAffordability,
          new_home_owner_index: newHomeOwners,
          strategic_score: strategicScore,
          real_estate_score: realEstateScore,
          housing_correlation_score: housingCorrelationScore,
          // Trend-specific calculated properties
          growth_potential: growthPotential,
          trend_consistency: trendConsistency,
          volatility_index: volatilityIndex,
          trend_category: this.getTrendCategory(trendScore)
        }
      };
      if (this.scoreField && this.scoreField !== 'trend_score') {
        out[this.scoreField] = out.value;
        (out.properties as any)[this.scoreField] = out.value;
      }
      return out;
    });
    
    // Use BaseProcessor for statistics and ranking
    const statistics = super.calculateStatistics(processedRecords.map(r => r.value));
    
    // Rank records by trend strength using BaseProcessor
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Filter out national parks for business analysis - COMMENTED OUT FOR DEBUGGING
    /*
    const nonParkRecords = rankedRecords.filter(record => {
      const props = (record.properties || {}) as Record<string, unknown>;
      const areaId = record.area_id || props.ID || props.id || '';
      const description = props.DESCRIPTION || props.description || '';
      
      // Filter out national parks using same logic as analysisLens
      if (String(areaId).startsWith('000')) return false;
      
      const nameStr = String(description).toLowerCase();
      const parkPatterns = [
        /national\s+park/i, /ntl\s+park/i, /national\s+monument/i, /national\s+forest/i, 
        /state\s+park/i, /\bpark\b.*national/i, /\bnational\b.*\bpark\b/i,
        /\bnp\b/i, /\bnm\b/i, /\bnf\b/i
      ];
      return !parkPatterns.some(pattern => pattern.test(nameStr));
    });
    */
    const nonParkRecords = rankedRecords; // Use all records for debugging
    
    console.log(`🎯 [TREND ANALYSIS] Filtered ${rankedRecords.length - nonParkRecords.length} parks from trend analysis`);
    
    // Extract feature importance with trend focus
    const featureImportance = this.processTrendFeatureImportance(rawData.feature_importance || []);
    
    // Generate trend-focused summary using filtered records
    const summary = this.generateTrendSummary(nonParkRecords, statistics, rawData.summary);

    return {
      type: 'trend_analysis', // Trend analysis type for temporal insights
      records: nonParkRecords, // Return filtered records to prevent park data in visualizations
      summary,
      featureImportance,
      statistics,
      targetVariable: this.scoreField, // Use dynamic or canonical
      renderer: this.createTrendRenderer(nonParkRecords), // Add direct renderer
      legend: this.createTrendLegend(nonParkRecords) // Add direct legend
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  /**
   * Extract trend strength score from record with fallback calculation
   */
  private extractTrendScore(record: any): number {
    if ((record as any).trend_score !== undefined && (record as any).trend_score !== null) {
      const preCalculatedScore = Number((record as any).trend_score);
      
      // Use the pre-calculated trend score - low values are valid trend scores  
      console.log(`📈 [TrendAnalysisProcessor] Using pre-calculated trend score: ${preCalculatedScore}`);
      return preCalculatedScore;
    }
    
    // COMPOSITE CALCULATION: Calculate trend score from available data
    console.log('⚠️ [TrendAnalysisProcessor] Calculating composite trend score from raw data');
    
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    
    // Calculate real estate trend strength from available data
    const householdIncome = this.extractNumericValue(record, this.configManager.getFieldMapping('incomeField'), 0);
    const housingGrowth = this.extractNumericValue(record, ['hot_growth_market_index', 'growth_index'], 0);
    const realEstateScore = Number((record as any).real_estate_analysis_score) || 0;
    const housingCorrelationScore = Number((record as any).housing_correlation_score) || 0;
    
    // Real estate trend strength calculation
    const incomeFactor = householdIncome > 0 ? Math.min((householdIncome / 100000) * 100, 100) * 0.3 : 20;
    const growthFactor = housingGrowth > 0 ? (housingGrowth / 100) * 30 : 15;
    const marketFactor = realEstateScore > 0 ? (realEstateScore / 100) * 25 : strategicScore > 0 ? (strategicScore / 100) * 25 : 15;
    const correlationFactor = housingCorrelationScore > 0 ? (housingCorrelationScore / 100) * 15 : 10;
    
    return Math.min(100, incomeFactor + growthFactor + marketFactor + correlationFactor);
  }

  /**
   * Calculate growth potential based on market fundamentals
   */
  private calculateGrowthPotential(record: any): number {
    // Calculate growth potential based on housing market fundamentals
    const housingGrowth = this.extractNumericValue(record, ['hot_growth_market_index', 'growth_index', 'housing_growth'], 0);
    const affordability = this.extractNumericValue(record, ['home_affordability_index', 'affordability_index'], 0);
    const newOwners = this.extractNumericValue(record, ['new_home_owner_index', 'new_owner_index'], 0);
    const population = this.extractNumericValue(record, this.configManager.getFieldMapping('populationField'), 0);
    
    // Real estate growth potential formula: Housing Growth (40%) + Affordability Balance (30%) + New Owner Activity (30%)
    const growthPotential = housingGrowth > 0 ? (housingGrowth / 100) * 40 : 10;
    const affordabilityBalance = affordability > 50 ? ((100 - affordability) / 100) * 30 : (affordability / 100) * 30; // Balance between growth and affordability
    const ownerActivity = newOwners > 0 ? (newOwners / 100) * 30 : 15;
    
    return Math.round((growthPotential + affordabilityBalance + ownerActivity) * 100) / 100;
  }

  /**
   * Calculate trend consistency from multiple score relationships
   */
  private calculateTrendConsistency(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    
    const scores = [strategicScore, competitiveScore, demographicScore].filter(s => s > 0);
    
    if (scores.length < 2) {
      return 50; // Default moderate consistency
    }
    
    // Calculate coefficient of variation (lower = more consistent)
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;
    
    // Convert to 0-100 scale (lower volatility = higher consistency)
    return Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)) * 100) / 100;
  }

  /**
   * Calculate volatility index from score relationships
   */  
  private calculateVolatilityIndex(record: any): number {
    const consistency = this.calculateTrendConsistency(record);
    // Volatility is inverse of consistency
    return Math.round((100 - consistency) * 100) / 100;
  }

  /**
   * Categorize trend strength
   */
  private getTrendCategory(trendScore: number): string {
    if (trendScore >= 65) return 'Strong Upward Trend';
    if (trendScore >= 50) return 'Moderate Growth Trend';  
    if (trendScore >= 35) return 'Weak/Volatile Trend';
    return 'Inconsistent/Declining';
  }



  /**
   * Process feature importance with trend focus
   */
  private processTrendFeatureImportance(rawFeatureImportance: any[]): any[] {
    const trendFeatures = rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getTrendFeatureDescription((item as any).feature || (item as any).name)
    }));

    // Add trend-specific synthetic features if none provided
    if (trendFeatures.length === 0) {
      return [
        { feature: 'market_consistency', importance: 0.35, description: 'Market performance consistency over time' },
        { feature: 'growth_momentum', importance: 0.28, description: 'Growth rate and momentum indicators' },
        { feature: 'competitive_positioning', importance: 0.22, description: 'Competitive market position strength' },
        { feature: 'volatility_factors', importance: 0.15, description: 'Market volatility and stability factors' }
      ];
    }

    return trendFeatures.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get trend-specific feature descriptions
   */
  private getTrendFeatureDescription(featureName: string): string {
    const trendDescriptions: Record<string, string> = {
      'trend_strength': 'Overall trend strength and direction',
      'growth_rate': 'Market growth rate and momentum',
      'consistency': 'Performance consistency over time',
      'volatility': 'Market volatility and fluctuation patterns',
      'market_share': 'Brand market share trend patterns',
      'demographic': 'Demographic trend influences',
      'competitive': 'Competitive positioning trends',
      'strategic': 'Strategic value trend indicators',
      'income': 'Income trend patterns and growth',
      'population': 'Population growth and demographic shifts'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(trendDescriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} trend characteristics`;
  }


  /**
   * Generate trend-focused summary
   */
  private generateTrendSummary(
    records: GeographicDataPoint[], 
    statistics: AnalysisStatistics, 
    rawSummary?: string
  ): string {
    // Start with trend scoring explanation
    let summary = `**📈 Trend Strength Formula (0-100 scale):**
• **Time Consistency (40% weight):** Performance stability and consistency over time
• **Growth Rate (30% weight):** Growth momentum and potential
• **Market Position (20% weight):** Current market strength and positioning
• **Volatility Factor (10% weight):** Predictability and stability (lower volatility = higher score)

Higher scores indicate stronger, more consistent, and predictable market trends.

`;
    
    // Real estate market trend baseline metrics
    summary += `**📊 Housing Market Trend Analysis:** `;
    summary += `Average trend strength: ${statistics.mean.toFixed(1)} (range: ${statistics.min.toFixed(1)}-${statistics.max.toFixed(1)}). `;
    
    // Calculate real estate trend category distribution
    const strongMarkets = records.filter(r => r.value >= 65).length;
    const growingMarkets = records.filter(r => r.value >= 50 && r.value < 65).length;
    const stableMarkets = records.filter(r => r.value >= 35 && r.value < 50).length;
    const challengingMarkets = records.filter(r => r.value < 35).length;
    
    summary += `Market distribution: ${strongMarkets} strong growth markets (${(strongMarkets/records.length*100).toFixed(1)}%), `;
    summary += `${growingMarkets} moderate growth markets (${(growingMarkets/records.length*100).toFixed(1)}%), `;
    summary += `${stableMarkets} stable markets (${(stableMarkets/records.length*100).toFixed(1)}%), `;
    summary += `${challengingMarkets} challenging markets (${(challengingMarkets/records.length*100).toFixed(1)}%).

`;
    
    // Top trending housing markets (5-8 areas)
    const topTrends = records.slice(0, 8);
    if (topTrends.length > 0) {
      const strongTrendAreas = topTrends.filter(r => r.value >= 50);
      if (strongTrendAreas.length > 0) {
        summary += `**Strongest Housing Market Trends:** `;
        const trendNames = strongTrendAreas.slice(0, 6).map(r => `${r.area_name} (${r.value.toFixed(1)})`);
        summary += `${trendNames.join(', ')}. `;
        
        const avgTopTrend = strongTrendAreas.reduce((sum, r) => sum + r.value, 0) / strongTrendAreas.length;
        summary += `These housing markets show exceptional momentum with average trend strength ${avgTopTrend.toFixed(1)}. `;
      }
    }
    
    // Growth potential markets
    if (records.length > 0) {
      const growthPotentialAreas = records
        .filter(r => (r.properties as any).growth_potential >= 60)
        .slice(0, 5);
      
      if (growthPotentialAreas.length > 0) {
        summary += `**High Growth Potential:** `;
        const growthNames = growthPotentialAreas.map(r => `${r.area_name} (${(r.properties as any).growth_potential?.toFixed(1)}% potential)`);
        summary += `${growthNames.join(', ')}. `;
        summary += `These areas demonstrate strong growth trajectory patterns. `;
      }
    }
    
    // Consistent performers
    if (records.length > 0) {
      const consistentPerformers = records
        .filter(r => (r.properties as any).trend_consistency >= 70)
        .slice(0, 5);
      
      if (consistentPerformers.length > 0) {
        summary += `**Most Consistent Trends:** `;
        const consistentNames = consistentPerformers.map(r => `${r.area_name} (${(r.properties as any).trend_consistency?.toFixed(1)}% consistency)`);
        summary += `${consistentNames.join(', ')}. `;
        summary += `These markets offer predictable and stable performance patterns. `;
      }
    }
    
    // Strategic insights
    summary += `**Trend Insights:** ${statistics.total} geographic areas analyzed for temporal patterns and trend strength. `;
    
    const highVolatility = records.filter(r => ((r.properties as any).volatility_index || 0) >= 70).length;
    if (highVolatility > 0) {
      summary += `${highVolatility} markets show high volatility (${(highVolatility/records.length*100).toFixed(1)}%) requiring careful monitoring. `;
    }
    
    // Actionable recommendations
    summary += `**Trend-Based Recommendations:** `;
    // Ensure counters exist (previous code referenced variables that could be undefined)
    const strongTrends = records.filter(r => r.value >= 65).length;
    const moderateTrends = records.filter(r => r.value >= 50 && r.value < 65).length;
    const volatileMarkets = records.filter(r => ((r.properties as any).volatility_index || 0) >= 70).length;

    if (strongTrends > 0) {
      summary += `Focus investment on ${strongTrends} markets with strong trend patterns. `;
    }
    if (moderateTrends > 0) {
      summary += `Monitor ${moderateTrends} moderate trend markets for optimization opportunities. `;
    }
    if (volatileMarkets > 0) {
      summary += `Develop risk mitigation strategies for ${volatileMarkets} volatile markets. `;
    }
    
    if (rawSummary) {
      summary += rawSummary;
    }
    
    return summary;
  }

  // ============================================================================
  // DIRECT RENDERING METHODS
  // ============================================================================

  /**
   * Create direct renderer for trend analysis visualization
   */
  private createTrendRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use same colors as strategic analysis: Red (low) -> Orange -> Light Green -> Dark Green (high)
    const trendColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (weakest trends)
      [253, 174, 97, 0.6],  // #fdae61 - Orange  
      [166, 217, 106, 0.6], // #a6d96a - Light Green
      [26, 152, 80, 0.6]    // #1a9850 - Dark Green (strongest trends)
    ];
    
    return {
      type: 'class-breaks',
      field: this.scoreField, // Use dynamic or canonical scoring field
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: 'simple-fill',
          color: trendColors[i], // Direct array format
          outline: { color: [0, 0, 0, 0], width: 0 }
        },
        label: this.formatClassLabel(i, quartileBreaks)
      })),
      defaultSymbol: {
        type: 'simple-fill',
        color: [200, 200, 200, 0.5],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }
    };
  }

  /**
   * Create direct legend for trend analysis
   */
  private createTrendLegend(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use RGBA format with correct opacity to match features (same as strategic)
    const colors = [
      'rgba(215, 48, 39, 0.6)',   // Weak trends
      'rgba(253, 174, 97, 0.6)',  // Medium-low  
      'rgba(166, 217, 106, 0.6)', // Medium-high
      'rgba(26, 152, 80, 0.6)'    // Strong trends
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: colors[i],
        minValue: quartileBreaks[i].min,
        maxValue: quartileBreaks[i].max
      });
    }
    
    return {
      title: 'Trend Strength Score',
      items: legendItems,
      position: 'bottom-right'
    };
  }

  /**
   * Calculate quartile breaks for rendering
   */
  private calculateQuartileBreaks(values: number[]): Array<{min: number, max: number}> {
    if (values.length === 0) return [];
    
    const q1 = values[Math.floor(values.length * 0.25)];
    const q2 = values[Math.floor(values.length * 0.5)];
    const q3 = values[Math.floor(values.length * 0.75)];
    
    return [
      { min: values[0], max: q1 },
      { min: q1, max: q2 },
      { min: q2, max: q3 },
      { min: q3, max: values[values.length - 1] }
    ];
  }

  /**
   * Format class labels for legend (same as strategic)
   */
  private formatClassLabel(classIndex: number, breaks: Array<{min: number, max: number}>): string {
    if (classIndex === 0) {
      // First class: < maxValue
      return `< ${breaks[classIndex].max.toFixed(1)}`;
    } else if (classIndex === breaks.length - 1) {
      // Last class: > minValue  
      return `> ${breaks[classIndex].min.toFixed(1)}`;
    } else {
      // Middle classes: minValue - maxValue
      return `${breaks[classIndex].min.toFixed(1)} - ${breaks[classIndex].max.toFixed(1)}`;
    }
  }

}