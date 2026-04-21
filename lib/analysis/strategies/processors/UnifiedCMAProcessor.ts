/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { 
  DataProcessorStrategy, 
  RawAnalysisResult, 
  ProcessedAnalysisData, 
  GeographicDataPoint 
} from '../../types';
import { EnhancedBaseProcessor } from './EnhancedBaseProcessor';

/**
 * Unified CMA Processor - Demonstrates the new unified configuration approach
 * 
 * This processor shows how to use the EnhancedBaseProcessor with UnifiedConfigurationManager
 * for simplified, maintainable, and consistent field mapping and configuration management.
 * 
 * Key improvements over the original approach:
 * - No hardcoded field mappings
 * - Automatic field resolution through unified configuration
 * - Context-aware processing based on project type
 * - Reduced code duplication
 * - Better maintainability
 */
export class UnifiedCMAProcessor extends EnhancedBaseProcessor {
  
  constructor() {
    super('comparative_market_analysis');
    this.log('Initialized UnifiedCMAProcessor with enhanced configuration management');
  }

  /**
   * Validate the raw analysis data
   */
  validate(rawData: RawAnalysisResult): boolean {
    // Basic validation
    if (!rawData || !rawData.results || !Array.isArray(rawData.results)) {
      this.warn('Invalid raw data structure');
      return false;
    }

    if (rawData.results.length === 0) {
      this.warn('No results found in raw data');
      return false;
    }

    // Validate that we can extract primary metrics from at least some records
    const validRecords = rawData.results.filter(record => {
      const primaryValue = this.extractCMAPrimaryMetric(record);
      return !isNaN(primaryValue) && primaryValue !== null;
    });

    if (validRecords.length === 0) {
      this.warn('No valid primary metrics found in any records');
      return false;
    }

    this.log(`Validation passed: ${validRecords.length}/${rawData.results.length} records valid`);
    return true;
  }

  /**
   * Process the raw analysis data into standardized format
   */
  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    this.log('Starting CMA processing with unified configuration');

    if (!this.validate(rawData)) {
      throw new Error('Invalid raw data for CMA processing');
    }

    // Extract geographic data points using unified field extraction
    const records: GeographicDataPoint[] = rawData.results.map(record => {
      const primaryValue = this.extractCMAPrimaryMetric(record);
      const geoId = this.extractGeographicId(record);
      const areaName = this.generateAreaName(record);
      
      // Extract additional CMA-specific metrics using unified field extraction
      const marketPosition = this.extractCMANumericValue(record, [
        'market_position', 'position_score', 'relative_position'
      ]);
      
      const priceComparison = this.extractCMANumericValue(record, [
        'price_comparison', 'price_comp_score', 'comparative_price'
      ]);
      
      const marketTrend = this.extractCMANumericValue(record, [
        'market_trend', 'trend_indicator', 'price_trend'
      ]);

      return {
        id: geoId,
        area_id: geoId,
        area: areaName,
        area_name: areaName,
        value: primaryValue,
        originalData: record,
        properties: {
          market_position: marketPosition,
          price_comparison: priceComparison,
          market_trend: marketTrend,
          // Include multi-target values if available
          ...(this.isMultiTargetEnabled() ? 
            this.extractMultiTargetValues(record, this.configManager.getDefaultTargetVariables()) : {})
        }
      };
    }).filter(record => !isNaN(record.value)); // Filter out invalid records

    // Rank records by their CMA score
    const rankedRecords = this.rankRecords(records);
    
    // Calculate statistics
    const values = rankedRecords.map(record => record.value);
    const statistics = this.calculateStatistics(values);

    // Build summary using unified templates
    const customSubstitutions = {
      analysisType: 'Comparative Market Analysis',
      topMarket: rankedRecords[0]?.area_name || 'N/A',
      topScore: rankedRecords[0]?.value?.toFixed(1) || '0',
      avgMarketPosition: statistics.mean.toFixed(1),
      totalComparableProperties: rankedRecords.length
    };

    const summary = this.buildSummaryFromTemplates(
      rankedRecords, 
      statistics, 
      customSubstitutions
    );

    // Create additional CMA-specific insights
    const cmaInsights = this.generateCMAInsights(rankedRecords, statistics);

    // Handle multi-target analysis if enabled
    let multiTargetData;
    if (this.isMultiTargetEnabled() && (rawData as any).target_variables) {
      multiTargetData = this.processMultiTargetCMA(rawData);
    }

    this.log(`CMA processing completed: ${rankedRecords.length} properties analyzed`);

    // Create processed data using enhanced method
    return this.createProcessedDataWithMultiTarget(
      'comparative_market_analysis',
      rankedRecords,
      summary + '\n\n' + cmaInsights,
      statistics,
      multiTargetData,
      {
        metadata: {
          processor: 'UnifiedCMAProcessor',
          analysisDate: new Date().toISOString(),
          configurationVersion: 'unified_v1',
          projectType: this.configManager.getCurrentProjectType(),
          totalComparisons: rankedRecords.length
        }
      }
    );
  }

  /**
   * Generate CMA-specific insights
   */
  private generateCMAInsights(records: GeographicDataPoint[], statistics: any): string {
    let insights = '## CMA-Specific Market Analysis\n\n';
    
    const scoreRanges = this.configManager.getScoreRanges();
    
    // Market performance distribution
    const excellentMarkets = records.filter(r => r.value >= scoreRanges.excellent.min);
    const goodMarkets = records.filter(r => r.value >= scoreRanges.good.min && r.value < scoreRanges.excellent.min);
    
    insights += '**Market Performance Distribution:**\n';
    insights += `• Premium markets (${scoreRanges.excellent.min}+ score): ${excellentMarkets.length} properties\n`;
    insights += `• Strong markets (${scoreRanges.good.min}-${scoreRanges.excellent.min-1} score): ${goodMarkets.length} properties\n`;
    insights += `• Market average: ${statistics.mean.toFixed(1)} CMA score\n\n`;
    
    // Top performing markets
    if (excellentMarkets.length > 0) {
      insights += '**Top Performing Markets:**\n';
      excellentMarkets.slice(0, 5).forEach((market, index) => {
        const marketPosition = (market.properties?.market_position as number) || 0;
        const priceComp = (market.properties?.price_comparison as number) || 0;
        insights += `${index + 1}. **${market.area_name}**: ${market.value.toFixed(1)} (Position: ${marketPosition.toFixed(1)}, Price Comp: ${priceComp.toFixed(1)})\n`;
      });
      insights += '\n';
    }
    
    // Market recommendations based on context
    insights += this.generateCMARecommendations(records, statistics);
    
    return insights;
  }

  /**
   * Generate CMA-specific recommendations using context-aware terminology
   */
  private generateCMARecommendations(records: GeographicDataPoint[], statistics: any): string {
    const terminology = this.configManager.getTerminology();
    const scoreRanges = this.configManager.getScoreRanges();
    
    let recommendations = '**CMA Recommendations:**\n';
    
    const topPerformers = records.filter(r => r.value >= scoreRanges.excellent.min);
    const strongPerformers = records.filter(r => r.value >= scoreRanges.good.min);
    
    if (topPerformers.length > 0) {
      recommendations += `• **Premium Property Focus**: ${topPerformers.length} ${terminology.entityType} show exceptional ${terminology.scoreDescription}\n`;
      recommendations += `• **Market Leadership**: Consider ${topPerformers[0]?.area_name} as benchmark for ${terminology.comparisonContext}\n`;
    }
    
    if (strongPerformers.length > 0) {
      recommendations += `• **Growth Opportunities**: ${strongPerformers.length} ${terminology.entityType} demonstrate strong market potential\n`;
    }
    
    // Price positioning recommendations
    const avgMarketPosition = records.reduce((sum, r) => sum + ((r.properties?.market_position as number) || 0), 0) / records.length;
    if (avgMarketPosition > 70) {
      recommendations += `• **Pricing Strategy**: Markets showing strong positioning (avg: ${avgMarketPosition.toFixed(1)}) - consider premium pricing\n`;
    } else if (avgMarketPosition < 40) {
      recommendations += `• **Value Opportunity**: Markets below average positioning - potential value pricing strategy\n`;
    }
    
    return recommendations;
  }

  /**
   * Process multi-target CMA analysis if enabled
   */
  private processMultiTargetCMA(rawData: RawAnalysisResult): any {
    if (!(rawData as any).target_variables) return null;

    this.log('Processing multi-target CMA analysis');
    
    const targetResults = Object.entries((rawData as any).target_variables).map(([target, data]: [string, any]) => ({
      target,
      type: this.getTargetVariableType(target),
      rawData: { 
        success: true,
        results: data.results || [], 
        model_info: data.model_info 
      } as RawAnalysisResult
    }));

    return this.createMultiTargetAnalysis(
      targetResults,
      'cma_score' // Primary target for CMA
    );
  }

  /**
   * Extract primary metric from CMA GeoJSON structure
   */
  private extractCMAPrimaryMetric(record: any): number {
    // Handle GeoJSON structure where data is in properties
    const properties = record.properties || record;
    
    // CMA-specific primary metrics in order of preference
    const cmaFields = [
      'investment_score_prediction',
      'investment_score',
      'cma_score',
      'cma_analysis_score',
      'market_position_score',
      'comparative_score'
    ];
    
    for (const field of cmaFields) {
      if (properties[field] !== undefined && properties[field] !== null && !isNaN(properties[field])) {
        return Number(properties[field]);
      }
    }
    
    // Fallback: use any numeric field as primary metric
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === 'number' && !isNaN(value)) {
        return Number(value);
      }
    }
    
    this.warn(`No primary metric found in CMA record, using 0 as fallback`);
    return 0;
  }

  /**
   * Extract numeric value from CMA GeoJSON structure
   */
  private extractCMANumericValue(record: any, fieldNames: string[]): number {
    // Handle GeoJSON structure where data is in properties
    const properties = record.properties || record;
    
    for (const fieldName of fieldNames) {
      if (properties[fieldName] !== undefined && properties[fieldName] !== null && !isNaN(properties[fieldName])) {
        return Number(properties[fieldName]);
      }
    }
    
    return 0; // Default fallback
  }
}

// Export the processor for use in the analysis system
export default UnifiedCMAProcessor;