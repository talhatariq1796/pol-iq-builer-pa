/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

/**
 * CorrelationAnalysisProcessor - Handles data processing for real estate correlation analysis
 * 
 * Processes correlation analysis results to identify statistical relationships between housing market variables
 * across geographic areas, focusing on real estate investment correlations.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class CorrelationAnalysisProcessor extends BaseProcessor {
  private scoreField: string = 'correlation_score';
  
  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    // Use canonical primary field (allow metadata override)
    const primary = getPrimaryScoreField('correlation_analysis', (rawData as any)?.metadata ?? undefined) || 'correlation_score';

    const hasCorrelationFields = rawData.results.length === 0 ||
      rawData.results.some(record => {
        if (!record) return false;
        const hasId = ((record as any).ID || (record as any).area_id || (record as any).id);
        if (!hasId) return false;
        // Accept primary field, legacy aliases, or any numeric field as a last resort
        const hasPrimary = (record as any)[primary] !== undefined;
        const hasLegacy = (record as any).correlation_score !== undefined || (record as any).correlation_strength_score !== undefined;
        if (hasPrimary || hasLegacy) return true;
        // Last resort: any numeric field (excluding obvious id/date/geo fields)
        const numericField = Object.keys(record).find(k => {
          const v = (record as any)[k];
          const kl = k.toLowerCase();
          return typeof v === 'number' && !kl.includes('id') && !kl.includes('date') && !kl.includes('objectid') && !kl.includes('shape');
        });
        return !!numericField;
      });

    return hasCorrelationFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🔗 [CORRELATION PROCESSOR] CALLED WITH ${rawData.results?.length || 0} RECORDS 🔗`);
    
    if (!this.validate(rawData)) {
      console.error(`[CorrelationAnalysisProcessor] Validation failed`);
      throw new Error('Invalid data format for CorrelationAnalysisProcessor');
    }

  // Use canonical primary score field (allows metadata override)
  this.scoreField = getPrimaryScoreField('correlation_analysis', (rawData as any)?.metadata ?? undefined) || 'correlation_analysis_score';

    // Process records with correlation information
    const records = this.processCorrelationRecords(rawData.results);
    
    console.log(`[CorrelationAnalysisProcessor] Processed ${records.length} records`);
    console.log(`[CorrelationAnalysisProcessor] Sample processed record:`, {
      area_name: records[0]?.area_name,
      value: records[0]?.value,
      correlation_strength: records[0]?.properties?.correlation_strength_score,
      target_value: records[0]?.properties?.target_value
    });
    
    // Calculate correlation statistics
    const statistics = this.calculateCorrelationStatistics(records, rawData);
    
    // Analyze correlation patterns
    const correlationAnalysis = this.analyzeCorrelationPatterns(records, rawData);
    
    // Process feature importance for correlation factors
    const featureImportance = this.processCorrelationFeatureImportance(rawData.feature_importance || []);
    
    // Generate correlation summary
  const summary = this.generateCorrelationSummary(records, correlationAnalysis);

    console.log(`[CorrelationAnalysisProcessor] Final result summary:`, {
      type: 'correlation_analysis',
      recordCount: records.length,
      targetVariable: 'correlation_strength_score',
      avgCorrelation: statistics.mean
    });

    return {
      type: 'correlation_analysis',
      records,
      summary,
      featureImportance,
      statistics,
      targetVariable: this.scoreField, // dynamic or canonical
      renderer: this.createCorrelationRenderer(records), // Add direct renderer
      legend: this.createCorrelationLegend(records), // Add direct legend
      correlationAnalysis // Additional metadata for correlation visualization
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  private processCorrelationRecords(rawRecords: any[]): GeographicDataPoint[] {
    return rawRecords.map((record, index) => {
      // Use BaseProcessor methods for area identification
      const area_id = this.extractGeographicId(record) || `area_${index}`;
      const area_name = this.generateAreaName(record);
      
            // Extract correlation strength score directly from the field
      const primaryField = getPrimaryScoreField('correlation_analysis') || 'correlation_score';
      const correlationScore = Number(record[primaryField]) || 0;
      
      // Use correlation strength score as the primary value
      const value = correlationScore;
      
      // Extract correlation-specific properties (updated for actual dataset fields)
  const properties = {
        ...this.extractProperties(record),
        household_income: this.extractNumericValue(record, ['ECYHRIAVG', 'value_AVGHINC_CY', 'median_income', 'household_income']),
        total_population: this.extractNumericValue(record, ['ECYPTAPOP', 'value_TOTPOP_CY', 'TOTPOP_CY', 'total_population']),
        housing_correlation_score: this.extractNumericValue(record, ['housing_correlation_score', 'real_estate_analysis_score']),
        home_ownership: this.extractNumericValue(record, ['ECYTENOWN', 'home_ownership_count', 'homeowners']),
        rental_units: this.extractNumericValue(record, ['ECYTENRENT', 'rental_count', 'renters']),
        housing_affordability: this.extractNumericValue(record, ['home_affordability_index', 'affordability_index']),
        housing_growth: this.extractNumericValue(record, ['hot_growth_market_index', 'growth_index', 'housing_growth']),
        white_population: Number((record as any).value_WHITE_CY || (record as any).white_population) || 0,
        correlation_strength: this.getCorrelationStrengthLevel(correlationScore)
      };
  // Expose the canonical primary score field in properties and top-level
  (properties as any)[this.scoreField] = correlationScore;
      
      // Extract SHAP values
      const shapValues = this.extractShapValues(record);
      
      // Category based on correlation strength
      const category = this.getCorrelationCategory(correlationScore);

      const out: any = {
        area_id,
        area_name,
        value,
        // Expose only the canonical primary field at top-level for parity
  [this.scoreField]: correlationScore,
        rank: 0, // Will be calculated in ranking
        category,
        coordinates: (record as any).coordinates || [0, 0],
        properties,
        shapValues
      };
      return out;
    }).sort((a, b) => b.value - a.value) // Sort by correlation strength
      .map((record, index) => ({ ...record, rank: index + 1 })); // Assign ranks
  }


  private getCorrelationStrengthLevel(score: number): string {
    if (score >= 80) return 'very_strong';
    if (score >= 60) return 'strong';
    if (score >= 40) return 'moderate';
    if (score >= 20) return 'weak';
    return 'very_weak';
  }

  private getCorrelationCategory(score: number): string {
    if (score >= 80) return 'strong_correlation';
    if (score >= 60) return 'moderate_correlation';
    if (score >= 40) return 'weak_correlation';
    return 'poor_correlation';
  }

  private extractProperties(record: any): Record<string, any> {
    const internalFields = new Set([
      'area_id', 'id', 'area_name', 'name', 'correlation_strength_score',
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

  private calculateCorrelationStatistics(records: GeographicDataPoint[], rawData: RawAnalysisResult): AnalysisStatistics {
    const scores = records.map(r => r.value).filter(v => !isNaN(v));
    
    if (scores.length === 0) {
      return {
        total: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0,
        strongCorrelations: 0, correlationMatrix: {}
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
    
    // Correlation-specific metrics
    const strongCorrelations = records.filter(r => r.value >= 80).length;
    const correlationMatrix = this.extractCorrelationMatrix(rawData);
    
    return {
      total,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev,
      strongCorrelations,
      correlationMatrix
    };
  }

  private extractCorrelationMatrix(rawData: RawAnalysisResult): Record<string, any> {
    // Try to extract correlation matrix from dataset metadata
    if ((rawData as any).correlation_metadata?.correlation_matrix) {
      return (rawData as any).correlation_metadata.correlation_matrix;
    }
    return {};
  }

  private analyzeCorrelationPatterns(records: GeographicDataPoint[], rawData: RawAnalysisResult): any {
    // Group by correlation categories
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
      
      return {
        category,
        size: categoryRecords.length,
        percentage: (categoryRecords.length / records.length) * 100,
        avgCorrelationScore: avgScore,
        topAreas: categoryRecords
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map(r => ({
            name: r.area_name,
            score: r.value,
            targetValue: (r.properties as any).target_value,
            income: (r.properties as any).median_income
          }))
      };
    });
    
    // Extract key correlations from metadata
    const keyCorrelations = this.extractKeyCorrelations(rawData);
    
    return {
      categories: categoryAnalysis,
      keyCorrelations,
      correlationInsights: this.generateCorrelationInsights(categoryAnalysis, keyCorrelations)
    };
  }

  private extractKeyCorrelations(rawData: RawAnalysisResult): any[] {
    if ((rawData as any).correlation_metadata?.strong_correlations) {
      return (rawData as any).correlation_metadata.strong_correlations;
    }
    return [];
  }

  private generateCorrelationInsights(categoryAnalysis: any[], keyCorrelations: any[]): string[] {
    const insights = [];
    
    // Category distribution insights
    const strongCategory = categoryAnalysis.find(c => c.category === 'strong_correlation');
    if (strongCategory && strongCategory.percentage > 10) {
      insights.push(`${strongCategory.size} areas show strong correlation patterns (${strongCategory.percentage.toFixed(1)}%)`);
    }
    
    // Key correlation insights
    if (keyCorrelations.length > 0) {
      const topCorrelation = keyCorrelations[0];
      if (topCorrelation.strength > 0.7) {
        insights.push(`Strong relationship identified between ${topCorrelation.var1} and ${topCorrelation.var2} (${topCorrelation.correlation})`);
      }
    }
    
    return insights;
  }

  private processCorrelationFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getCorrelationFeatureDescription((item as any).feature || (item as any).name),
      correlationImpact: this.assessCorrelationImpact((item as any).importance || 0)
    })).sort((a, b) => b.importance - a.importance);
  }

  private getCorrelationFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'target_value': 'Primary target variable for correlation analysis',
      'demographic_opportunity_score': 'Demographic market opportunity indicator',
      'median_income': 'Income levels affecting market correlations',
      'total_population': 'Population size correlation factor',
      'mp30034a_b_p': 'Nike market share correlation indicator',
      'asian_population': 'Asian demographic correlation factor',
      'black_population': 'Black demographic correlation factor',
      'white_population': 'White demographic correlation factor'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key.toLowerCase())) {
        return desc;
      }
    }
    
    return `${featureName} correlation factor`;
  }

  private assessCorrelationImpact(importance: number): string {
    if (importance >= 0.8) return 'critical_correlation_driver';
    if (importance >= 0.6) return 'significant_correlation_factor';
    if (importance >= 0.4) return 'moderate_correlation_influence';
    if (importance >= 0.2) return 'minor_correlation_factor';
    return 'negligible_correlation_impact';
  }

  private generateCorrelationSummary(
    records: GeographicDataPoint[], 
    correlationAnalysis: any
  ): string {
    const recordCount = records.length;
    const avgScore = records.reduce((sum, r) => sum + r.value, 0) / recordCount;
    const topCorrelated = records.slice(0, 10);
    
    // Start with correlation methodology explanation
    let summary = `**🔗 Correlation Analysis Methodology:** Statistical relationships analyzed using Pearson correlation coefficients between key variables (target values, demographics, income, population). Correlation strength scores (0-100) measure how well each area follows identified correlation patterns.

`;
    
    // Enhanced baseline and correlation metrics
    summary += `**📊 Correlation Baseline & Averages:** `;
    summary += `Market average correlation strength: ${avgScore.toFixed(1)} (range: ${records[records.length - 1]?.value.toFixed(1) || '0'}-${records[0]?.value.toFixed(1) || '0'}). `;
    
    // Key correlation insights
    if (correlationAnalysis.keyCorrelations && correlationAnalysis.keyCorrelations.length > 0) {
      summary += `**Key Relationships:** `;
      correlationAnalysis.keyCorrelations.slice(0, 3).forEach((corr: any) => {
        summary += `${corr.var1} ↔ ${corr.var2} (${corr.correlation}), `;
      });
      summary = summary.slice(0, -2) + '. ';
    }
    
    // Correlation strength distribution
    const strongCorr = records.filter(r => r.value >= 80).length;
    const moderateCorr = records.filter(r => r.value >= 60).length;
    const weakCorr = records.filter(r => r.value >= 40).length;
    
    summary += `Correlation distribution: ${strongCorr} strong patterns (${(strongCorr/recordCount*100).toFixed(1)}%), ${moderateCorr} moderate+ (${(moderateCorr/recordCount*100).toFixed(1)}%), ${weakCorr} weak+ (${(weakCorr/recordCount*100).toFixed(1)}%).

`;
    
    summary += `**Correlation Analysis Complete:** ${recordCount} geographic markets analyzed for statistical relationships. `;
    
    // Top correlated areas
    if (topCorrelated.length > 0) {
      summary += `**🎯 Strongest Correlation Patterns:** `;
      
      topCorrelated.slice(0, 8).forEach((record, index) => {
        const targetValue = Number((record as any).properties?.target_value) || 0;
        const income = Number((record as any).properties?.median_income) || 0;
        const population = Number((record as any).properties?.total_population) || 0;
        
        summary += `${index + 1}. **${(record as any).area_name}**: ${(record as any).value.toFixed(1)} correlation score`;
        
        if (targetValue > 0 || income > 0) {
          summary += ` (Target: ${targetValue.toFixed(1)}`;
          if (income > 0) {
            summary += `, $${(income/1000).toFixed(0)}K income`;
          }
          if (population > 0) {
            summary += `, ${(population/1000).toFixed(0)}K pop`;
          }
          summary += `)`;
        }
        
        summary += `. `;
      });
    }
    
    // Category breakdown
    const categoryBreakdown = correlationAnalysis.categories;
    if (categoryBreakdown.length > 0) {
      const strongCategory = categoryBreakdown.find((c: any) => c.category === 'strong_correlation');
      const moderateCategory = categoryBreakdown.find((c: any) => c.category === 'moderate_correlation');
      
      if (strongCategory && strongCategory.size > 0) {
        summary += `**${strongCategory.size} Strong Correlation Areas** (${strongCategory.percentage.toFixed(1)}%): `;
        const topStrong = strongCategory.topAreas.slice(0, 3);
        summary += topStrong.map((area: any) => `${(area as any).name} (${(area as any).score.toFixed(1)})`).join(', ');
        summary += '. ';
      }
      
      if (moderateCategory && moderateCategory.size > 0) {
        summary += `**${moderateCategory.size} Moderate Correlation Areas** (${moderateCategory.percentage.toFixed(1)}%): `;
        const topModerate = moderateCategory.topAreas.slice(0, 3);
        summary += topModerate.map((area: any) => `${(area as any).name} (${(area as any).score.toFixed(1)})`).join(', ');
        summary += '. ';
      }
    }
    
    // Strategic insights
    summary += `**Strategic Correlation Insights:** `;
    
    if (avgScore >= 70) {
      summary += `Strong overall correlation patterns with average strength of ${avgScore.toFixed(1)} indicate predictable market relationships. `;
    } else if (avgScore >= 50) {
      summary += `Moderate correlation patterns with average strength of ${avgScore.toFixed(1)} suggest some market predictability. `;
    } else {
      summary += `Weak correlation patterns with average strength of ${avgScore.toFixed(1)} indicate complex, less predictable market dynamics. `;
    }
    
    // Correlation-based recommendations
    if (strongCorr > 0) {
      summary += `Focus on ${strongCorr} areas with strong correlation patterns for predictable market behavior. `;
    }
    
    summary += `**Recommendations:** Leverage identified correlation patterns for market prediction and strategic planning. Areas with strong correlation scores offer more predictable outcomes for business initiatives. `;
    
    return summary;
  }

  // ============================================================================
  // DIRECT RENDERING METHODS
  // ============================================================================

  /**
   * Create direct renderer for correlation analysis visualization
   */
  private createCorrelationRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use teal/cyan gradient for correlations: Light teal -> Dark teal (strong correlation)
    const correlationColors = [
      [199, 233, 192, 0.6],  // #c7e9c0 - Light teal (weak correlation)
      [116, 196, 118, 0.6],  // #74c476 - Medium teal
      [65, 171, 93, 0.6],    // #41ab5d - Teal  
      [35, 139, 69, 0.6]     // #238b45 - Dark teal (strong correlation)
    ];
    
    return {
      type: 'class-breaks',
      field: this.scoreField, // Use dynamic or canonical scoring field
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: 'simple-fill',
          color: correlationColors[i], // Direct array format
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
   * Create direct legend for correlation analysis
   */
  private createCorrelationLegend(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use RGBA format with correct opacity to match features
    const colors = [
      'rgba(199, 233, 192, 0.6)',  // Weak correlation
      'rgba(116, 196, 118, 0.6)',  // Medium-low  
      'rgba(65, 171, 93, 0.6)',    // Medium-high
      'rgba(35, 139, 69, 0.6)'     // Strong correlation
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
      title: 'Correlation Strength Score',
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