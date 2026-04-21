/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

/**
 * MarketSizingProcessor - Handles data processing for market sizing analysis
 * 
 * Processes housing market sizing analysis to evaluate market size, potential,
 * and investment opportunities across geographic areas.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class MarketSizingProcessor extends BaseProcessor {
  
  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  validate(rawData: RawAnalysisResult): boolean {
    return rawData && rawData.success && Array.isArray(rawData.results) && rawData.results.length > 0;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'Market sizing analysis failed');
    }

    const records = rawData.results.map((record: any, index: number) => {
  const primary = getPrimaryScoreField('market_sizing', (null as any)) || 'market_sizing_score';
  const marketSizingScore = Number((record as any)[primary] || (record as any).market_sizing_score) || 0;
      const totalPop = this.extractNumericValue(record, ['ECYPTAPOP', 'total_population', 'population']);
      const medianIncome = this.extractNumericValue(record, ['ECYHRIAVG', 'median_income', 'household_income']);
      const strategicScore = Number((record as any).strategic_value_score) || 0;
      const demographicScore = Number((record as any).demographic_opportunity_score) || 0;

      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);
      
      return {
        area_id: this.extractGeographicId(record) || `area_${index}`,
        area_name: this.generateAreaName(record),
        value: marketSizingScore,
        rank: index + 1,
        category: this.categorizeMarketSize(marketSizingScore, totalPop),
        coordinates: this.extractCoordinates(record),
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          market_sizing_score: marketSizingScore,
          population: totalPop,
          median_income: medianIncome,
          strategic_value: strategicScore,
          demographic_opportunity: demographicScore,
          market_category: this.getMarketCategory(totalPop, medianIncome),
          opportunity_size: this.getOpportunitySize(marketSizingScore),
          revenue_potential: this.getRevenuePotential(totalPop, medianIncome)
        },
        shapValues: (record as any).shap_values || {}
      };
    });

    records.sort((a, b) => b.value - a.value);
    records.forEach((record, index) => { (record as any).rank = index + 1; });

    const values = records.map(r => r.value);
    const statistics = this.calculateStatistics(values);
    const summary = this.generateMarketSizingSummary(records, statistics);

    return {
      type: 'market_sizing',
      records,
      summary,
      featureImportance: rawData.feature_importance || [],
  statistics,
  targetVariable: getPrimaryScoreField('market_sizing', (null as any)) || 'market_sizing_score'
    };
  }

  private categorizeMarketSize(score: number, population: number): string {
    if (score >= 80) return 'Mega Market Opportunity';
    if (score >= 65) return 'Large Market Potential';
    if (score >= 50) return 'Medium Market Size'; 
    if (score >= 35) return 'Small Market Opportunity';
    return 'Limited Market Size';
  }

  private getMarketCategory(population: number, income: number): string {
    if (population >= 150000 && income >= 80000) return 'Mega Market';
    if (population >= 100000 && income >= 60000) return 'Large Market';
    if (population >= 75000 || income >= 100000) return 'Medium-Large';
    if (population >= 50000 || income >= 80000) return 'Medium Market';
    return 'Small Market';
  }

  private getOpportunitySize(score: number): string {
    if (score >= 70) return 'Massive Opportunity';
    if (score >= 60) return 'Large Opportunity';
    if (score >= 45) return 'Moderate Opportunity';
    return 'Limited Opportunity';
  }

  private getRevenuePotential(population: number, income: number): string {
    const revenueIndex = Math.sqrt((population / 50000) * (income / 80000));
    if (revenueIndex >= 1.5) return 'High Revenue Potential';
    if (revenueIndex >= 1.0) return 'Moderate Revenue Potential';
    return 'Limited Revenue Potential';
  }

  /**
   * Identify top 5 fields that contribute most to the market sizing score
   * Returns them as a flattened object for popup display
   */
  private getTopContributingFields(record: any): Record<string, number> {
    const contributingFields: Array<{field: string, value: number, importance: number}> = [];
    
  // Define field importance weights based on market sizing factors
  const fieldDefinitions = getTopFieldDefinitions('market_sizing');
  // console.log(`[MarketSizingProcessor] Using hardcoded top field definitions for market_sizing`);
    
    fieldDefinitions.forEach(fieldDef => {
      let value = 0;
      const sources = Array.isArray(fieldDef.source) ? fieldDef.source : [fieldDef.source];
      
      // Find the first available source field
      for (const source of sources) {
        if (record[source] !== undefined && record[source] !== null) {
          value = Number(record[source]);
          break;
        }
      }
      
      // Only include fields with meaningful values
      if (!isNaN(value) && value > 0) {
        contributingFields.push({
          field: fieldDef.field,
          value: Math.round(value * 100) / 100,
          importance: fieldDef.importance
        });
      }
    });
    
    // Sort by importance and take top 5
    const topFields = contributingFields
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5)
      .reduce((acc, item) => {
        acc[(item as any).field] = (item as any).value;
        return acc;
      }, {} as Record<string, number>);
    
    console.log(`[MarketSizingProcessor] Top contributing fields for ${(record as any).ID}:`, topFields);
    return topFields;
  }

  private extractCoordinates(record: any): [number, number] {
    if ((record as any).coordinates && Array.isArray((record as any).coordinates)) {
      return [(record as any).coordinates[0] || 0, (record as any).coordinates[1] || 0];
    }
    const lat = Number((record as any).latitude || (record as any).lat || 0);
    const lng = Number((record as any).longitude || (record as any).lng || 0);
    return [lng, lat];
  }

  private generateMarketSizingSummary(records: any[], statistics: any): string {
    const topMarkets = records.slice(0, 5);
    const megaCount = records.filter(r => r.value >= 80).length;
    const largeCount = records.filter(r => r.value >= 65 && r.value < 80).length;
    const avgScore = statistics.mean.toFixed(1);

    const topNames = topMarkets.map(r => `${r.area_name} (${r.value.toFixed(1)})`).join(', ');

    return `Market sizing analysis of ${records.length} markets identified ${megaCount} mega market opportunities (80+) and ${largeCount} large market potential areas (65-79). Average market sizing score: ${avgScore}. Top market opportunities: ${topNames}. Analysis considers market opportunity size, growth potential, addressable market quality, and revenue potential to identify the largest strategic market opportunities.`;
  }


}