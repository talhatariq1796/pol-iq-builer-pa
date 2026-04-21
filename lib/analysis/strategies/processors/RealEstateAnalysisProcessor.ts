import { RawAnalysisResult, ProcessedAnalysisData } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

export class RealEstateAnalysisProcessor extends BaseProcessor {
  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }

  validate(rawData: RawAnalysisResult): boolean {
    return rawData && rawData.success && Array.isArray(rawData.results) && rawData.results.length > 0;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'Real estate analysis failed');
    }

  const rawResults = rawData.results as unknown[];
  // Respect metadata override for target variable
  const scoreField = getPrimaryScoreField('real_estate_analysis', (rawData as any)?.metadata ?? undefined) || 'real_estate_analysis_score';
    const records = rawResults.map((recordRaw: unknown, index: number) => {
      const record = (recordRaw && typeof recordRaw === 'object') ? recordRaw as Record<string, unknown> : {};
      const realEstateScore = this.extractPrimaryMetric(record);
      const totalPop = this.extractNumericValue(record, this.configManager.getFieldMapping('populationField'), 0);
      const medianIncome = this.extractNumericValue(record, this.configManager.getFieldMapping('incomeField'), 0);
      const strategicScore = Number((record as any).strategic_value_score) || 0;
      const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
      
      // Real estate specific metrics
      const homeOwnership = this.extractNumericValue(record, ['ECYTENOWN', 'home_ownership_count', 'homeowners'], 0);
      const rentalUnits = this.extractNumericValue(record, ['ECYTENRENT', 'rental_count', 'renters'], 0);
      const housingAffordability = this.extractNumericValue(record, ['home_affordability_index', 'affordability_index'], 0);
      const marketGrowth = this.extractNumericValue(record, ['hot_growth_market_index', 'growth_index', 'market_growth'], 0);

      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);

      return {
        area_id: this.extractGeographicId(record),
        area_name: this.generateAreaName(record),
        value: realEstateScore,
        rank: index + 1,
        category: this.categorizeRealEstateOpportunity(realEstateScore),
        coordinates: this.extractCoordinates(record),
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          [scoreField]: realEstateScore,
          housing_market_strength: this.getHousingMarketStrength(housingAffordability, marketGrowth),
          demographic_profile: this.getHousingDemographicProfile(homeOwnership, rentalUnits),
          investment_accessibility: this.getInvestmentAccessibility(medianIncome, housingAffordability),
          market_growth_potential: this.getMarketGrowthPotential(marketGrowth, totalPop),
          housing_supply_characteristics: this.getHousingSupplyCharacteristics(homeOwnership, rentalUnits),
          investment_priority: this.getRealEstateInvestmentPriority(realEstateScore, housingAffordability),
          population: totalPop,
          median_income: medianIncome,
          home_ownership_rate: homeOwnership,
          rental_market_size: rentalUnits,
          affordability_index: housingAffordability,
          growth_index: marketGrowth
        },
        shapValues: (record.shap_values || {}) as Record<string, number>
      };
    });

    // Use BaseProcessor ranking
    const rankedRecords = this.rankRecords(records);
    
    // Calculate statistics using BaseProcessor method
    const statistics = this.calculateStatistics(rankedRecords.map(r => r.value));
    
    // Generate summary using configuration-driven templates
    const customSubstitutions = {
      avgIncome: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.median_income) || 0), 0) / rankedRecords.length).toFixed(0),
      topAreaName: rankedRecords[0]?.area_name || 'N/A',
      cityCount: [...new Set(rankedRecords.map(r => r.area_name.split(' ')[0]))].length,
      totalAreas: rankedRecords.length
    };
    
    const summary = this.buildSummaryFromTemplates(rankedRecords, statistics, customSubstitutions);

    return this.createProcessedData(
      'real_estate_analysis',
      rankedRecords,
      summary,
      statistics,
      {
        featureImportance: rawData.feature_importance || []
      }
    );
  }

  private categorizeRealEstateOpportunity(score: number): string {
    const scoreRange = this.getScoreInterpretation(score);
    return scoreRange.description;
  }

  // Real estate specific assessment methods
  private getHousingMarketStrength(affordability: number, growth: number): string {
    if (affordability >= 75 && growth >= 75) return 'Exceptional Market Strength';
    if (affordability >= 60 && growth >= 60) return 'Strong Housing Market';
    if (affordability >= 45 && growth >= 45) return 'Stable Housing Market';
    if (affordability >= 30 || growth >= 30) return 'Developing Housing Market';
    return 'Emerging Housing Market';
  }

  private getHousingDemographicProfile(homeOwnership: number, rentalUnits: number): string {
    const totalHousing = homeOwnership + rentalUnits;
    if (totalHousing === 0) return 'Limited Housing Data';
    
    const ownershipRate = (homeOwnership / totalHousing) * 100;
    if (ownershipRate >= 75) return 'Owner-Dominated Market';
    if (ownershipRate >= 60) return 'High Ownership Market';
    if (ownershipRate >= 40) return 'Balanced Housing Market';
    if (ownershipRate >= 25) return 'Rental-Leaning Market';
    return 'Rental-Dominated Market';
  }

  private getInvestmentAccessibility(income: number, affordability: number): string {
    if (income >= 80000 && affordability >= 70) return 'Premium Investment Zone';
    if (income >= 65000 && affordability >= 55) return 'High-Quality Investment Area';
    if (income >= 50000 && affordability >= 40) return 'Solid Investment Opportunity';
    if (income >= 35000 && affordability >= 25) return 'Affordable Investment Market';
    return 'Value Investment Opportunity';
  }

  private getMarketGrowthPotential(growth: number, population: number): string {
    if (growth >= 75 && population >= 50000) return 'High Growth Potential';
    if (growth >= 60 && population >= 25000) return 'Strong Growth Prospects';
    if (growth >= 45 && population >= 10000) return 'Moderate Growth Potential';
    if (growth >= 30) return 'Emerging Growth Market';
    return 'Stable Market Conditions';
  }

  private getHousingSupplyCharacteristics(homeOwnership: number, rentalUnits: number): string {
    const totalHousing = homeOwnership + rentalUnits;
    if (totalHousing >= 10000) return 'Large Housing Market';
    if (totalHousing >= 5000) return 'Medium Housing Market';
    if (totalHousing >= 2000) return 'Small Housing Market';
    if (totalHousing >= 500) return 'Limited Housing Supply';
    return 'Very Small Housing Market';
  }

  private getRealEstateInvestmentPriority(realEstateScore: number, affordability: number): string {
    if (realEstateScore >= 75 && affordability >= 65) return 'Top Investment Priority';
    if (realEstateScore >= 65 && affordability >= 50) return 'High Investment Priority';
    if (realEstateScore >= 55 && affordability >= 35) return 'Medium Investment Priority';
    if (realEstateScore >= 45 && affordability >= 20) return 'Consider for Investment';
    return 'Lower Priority Investment';
  }

  /**
   * Identify top 5 fields that contribute most to the real estate analysis score
   * Returns them as a flattened object for popup display
   */
  private getTopContributingFields(record: Record<string, unknown>): Record<string, number> {
    const contributingFields: Array<{field: string, value: number, importance: number}> = [];
    
    // Define field importance weights based on real estate analysis factors
    // Use dynamic field detection instead of hardcoded mappings
  const fieldDefinitions = getTopFieldDefinitions('real_estate_analysis');
  console.log(`[RealEstateAnalysisProcessor] Using hardcoded top field definitions for real_estate_analysis`);
    
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
        acc[item.field] = item.value;
        return acc;
      }, {} as Record<string, number>);
    
  console.log(`[RealEstateAnalysisProcessor] Top contributing fields for ${(record as any).ID}:`, topFields);
    return topFields;
  }

  private extractCoordinates(record: Record<string, unknown>): [number, number] {
    if (record['coordinates'] && Array.isArray(record['coordinates'])) {
      const coords = record['coordinates'] as unknown as number[];
      return [coords[0] || 0, coords[1] || 0];
    }
    const lat = Number((record['latitude'] || record['lat'] || 0) as unknown as number);
    const lng = Number((record['longitude'] || record['lng'] || 0) as unknown as number);
    return [lng, lat];
  }


}