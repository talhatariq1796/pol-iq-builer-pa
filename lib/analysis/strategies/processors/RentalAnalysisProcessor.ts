import { RawAnalysisResult, ProcessedAnalysisData } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

export class RentalAnalysisProcessor extends BaseProcessor {
  constructor() {
    super();
  }

  validate(rawData: RawAnalysisResult): boolean {
    return rawData && rawData.success && Array.isArray(rawData.results) && rawData.results.length > 0;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'Rental analysis failed');
    }

    const rawResults = rawData.results as unknown[];
    const scoreField = getPrimaryScoreField('rental_analysis', (rawData as any)?.metadata) || 'rental_analysis_score';
    
    const records = rawResults.map((recordRaw: unknown, index: number) => {
      const record = (recordRaw && typeof recordRaw === 'object') ? recordRaw as Record<string, unknown> : {};
      const rentalScore = this.extractPrimaryMetric(record);
      
      // Extract rental analysis specific metrics
      const rentalYield = this.extractNumericValue(record, ['rental_yield', 'yield_pct', 'rental_roi'], 0);
      const rentalIncome = this.extractNumericValue(record, ['rental_income', 'monthly_rent', 'avg_rent'], 0);
      const rentalDemand = this.extractNumericValue(record, ['rental_demand', 'demand_index', 'occupancy_rate'], 0);
      const vacancyRate = this.extractNumericValue(record, ['vacancy_rate', 'vacancy_pct', 'empty_units'], 0);
      const rentGrowth = this.extractNumericValue(record, ['rent_growth', 'rental_appreciation', 'rent_change_pct'], 0);
      const tenantQuality = this.extractNumericValue(record, ['tenant_quality', 'credit_score_avg', 'tenant_stability'], 0);

      return {
        area_id: this.extractGeographicId(record),
        area_name: this.generateAreaName(record),
        value: rentalScore,
        rank: index + 1,
        category: this.categorizeRentalOpportunity(rentalScore, rentalYield),
        coordinates: this.extractCoordinates(record),
        properties: {
          [scoreField]: rentalScore,
          rental_market_strength: this.getRentalMarketStrength(rentalDemand, vacancyRate),
          yield_classification: this.getYieldClassification(rentalYield),
          tenant_market_profile: this.getTenantMarketProfile(tenantQuality, rentalIncome),
          rental_growth_potential: this.getRentalGrowthPotential(rentGrowth, rentalDemand),
          investment_viability: this.getInvestmentViability(rentalYield, vacancyRate),
          market_competition: this.getMarketCompetition(rentalDemand, vacancyRate),
          rental_yield: rentalYield,
          rental_income: rentalIncome,
          rental_demand: rentalDemand,
          vacancy_rate: vacancyRate,
          rent_growth: rentGrowth,
          tenant_quality: tenantQuality
        },
        shapValues: (record.shap_values || {}) as Record<string, number>
      };
    });

    const rankedRecords = this.rankRecords(records);
    const statistics = this.calculateStatistics(rankedRecords.map(r => r.value));
    
    const customSubstitutions = {
      avgRentalYield: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.rental_yield) || 0), 0) / rankedRecords.length).toFixed(1),
      avgVacancyRate: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.vacancy_rate) || 0), 0) / rankedRecords.length).toFixed(1),
      topRentalArea: rankedRecords[0]?.area_name || 'N/A',
      rentalMarketCount: rankedRecords.length
    };
    
    const summary = this.buildSummaryFromTemplates(rankedRecords, statistics, customSubstitutions);

    return {
      ...this.createProcessedData(
        'rental_analysis',
        rankedRecords,
        summary,
        statistics,
        {
          featureImportance: rawData.feature_importance || [],
          rentalMetrics: {
            avgRentalYield: customSubstitutions.avgRentalYield,
            avgVacancyRate: customSubstitutions.avgVacancyRate,
            marketStability: this.calculateMarketStability(rankedRecords)
          }
        }
      ),
      renderer: this.createRentalRenderer(rankedRecords),
      legend: this.createRentalLegend(rankedRecords)
    };
  }

  private categorizeRentalOpportunity(score: number, rentalYield: number): string {
    if (score >= 80 && rentalYield >= 8) return 'Excellent Rental Investment';
    if (score >= 70 && rentalYield >= 6) return 'Strong Rental Opportunity';
    if (score >= 60 && rentalYield >= 4) return 'Good Rental Potential';
    if (score >= 50 && rentalYield >= 2) return 'Fair Rental Market';
    if (rentalYield < 2) return 'Low Yield Market';
    return 'Challenging Rental Market';
  }

  private getRentalMarketStrength(demand: number, vacancyRate: number): string {
    const strengthScore = demand - (vacancyRate * 2);
    if (strengthScore >= 80) return 'Very Strong Rental Market';
    if (strengthScore >= 65) return 'Strong Rental Market';
    if (strengthScore >= 50) return 'Moderate Rental Market';
    if (strengthScore >= 35) return 'Weak Rental Market';
    return 'Very Weak Rental Market';
  }

  private getYieldClassification(rentalYield: number): string {
    if (rentalYield >= 12) return 'Exceptional Yield';
    if (rentalYield >= 8) return 'High Yield';
    if (rentalYield >= 6) return 'Good Yield';
    if (rentalYield >= 4) return 'Average Yield';
    if (rentalYield >= 2) return 'Low Yield';
    return 'Very Low Yield';
  }

  private getTenantMarketProfile(tenantQuality: number, avgRent: number): string {
    if (tenantQuality >= 80 && avgRent >= 2000) return 'Premium Tenant Market';
    if (tenantQuality >= 70 && avgRent >= 1500) return 'High-Quality Tenant Market';
    if (tenantQuality >= 60 && avgRent >= 1200) return 'Stable Tenant Market';
    if (tenantQuality >= 50 && avgRent >= 900) return 'Standard Tenant Market';
    if (avgRent < 800) return 'Budget Tenant Market';
    return 'Mixed Tenant Market';
  }

  private getRentalGrowthPotential(rentGrowth: number, demand: number): string {
    const growthPotential = (rentGrowth * 2) + (demand * 0.5);
    if (growthPotential >= 80) return 'Very High Growth Potential';
    if (growthPotential >= 60) return 'High Growth Potential';
    if (growthPotential >= 40) return 'Moderate Growth Potential';
    if (growthPotential >= 20) return 'Limited Growth Potential';
    return 'No Growth Expected';
  }

  private getInvestmentViability(rentalYield: number, vacancyRate: number): string {
    const viabilityScore = (rentalYield * 8) - (vacancyRate * 3);
    if (viabilityScore >= 60) return 'Highly Viable Investment';
    if (viabilityScore >= 40) return 'Viable Investment';
    if (viabilityScore >= 20) return 'Moderately Viable';
    if (viabilityScore >= 0) return 'Marginally Viable';
    return 'Not Viable';
  }

  private getMarketCompetition(demand: number, vacancyRate: number): string {
    if (demand >= 80 && vacancyRate <= 5) return 'Low Competition - High Demand';
    if (demand >= 60 && vacancyRate <= 10) return 'Moderate Competition';
    if (demand >= 40 && vacancyRate <= 15) return 'High Competition';
    if (vacancyRate > 20) return 'Very High Competition';
    return 'Saturated Market';
  }

  private calculateMarketStability(records: any[]): number {
    const yieldVariance = this.calculateVariance(records.map(r => Number(r.properties?.rental_yield) || 0));
    const demandVariance = this.calculateVariance(records.map(r => Number(r.properties?.rental_demand) || 0));
    const vacancyVariance = this.calculateVariance(records.map(r => Number(r.properties?.vacancy_rate) || 0));
    
    // Lower variance indicates higher stability
    const stabilityScore = 100 - ((yieldVariance + demandVariance + vacancyVariance) / 3);
    return Math.max(0, Math.min(100, stabilityScore));
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
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

  private createRentalRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter((v: number) => !isNaN(v)).sort((a: number, b: number) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);

    // Purple (low rental yield) -> Blue -> Teal -> Green (high rental yield)
    const rentalColors = [
      [142, 1, 82, 0.6],    // #8e0152 - Purple (lowest rental yield)
      [69, 117, 180, 0.6],  // #4575b4 - Blue
      [102, 194, 165, 0.6], // #66c2a5 - Teal
      [0, 136, 55, 0.6]     // #008837 - Green (highest rental yield)
    ];

    return {
      type: 'class-breaks',
      field: 'rental_market_score',
      classBreakInfos: quartileBreaks.map((breakInfo, index) => ({
        minValue: breakInfo.min,
        maxValue: breakInfo.max,
        symbol: {
          type: 'simple-fill',
          color: rentalColors[index],
          outline: {
            color: [255, 255, 255, 0.5],
            width: 0.5
          }
        },
        label: this.formatClassLabel(breakInfo, index, quartileBreaks.length)
      }))
    };
  }

  private createRentalLegend(records: any[]): any {
    const values = records.map(r => r.value).filter((v: number) => !isNaN(v)).sort((a: number, b: number) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);

    const legendItems = quartileBreaks.map((breakInfo, index) => ({
      label: this.formatClassLabel(breakInfo, index, quartileBreaks.length),
      color: index === 0 ? '#8e0152' : index === 1 ? '#4575b4' : index === 2 ? '#66c2a5' : '#008837',
      value: `${breakInfo.min.toFixed(1)} - ${breakInfo.max.toFixed(1)}`
    }));

    return {
      title: 'Rental Market Score',
      items: legendItems,
      type: 'gradient'
    };
  }

  private calculateQuartileBreaks(values: number[]): Array<{ min: number; max: number; count: number }> {
    if (values.length === 0) return [];

    const q1Index = Math.floor(values.length * 0.25);
    const q2Index = Math.floor(values.length * 0.5);
    const q3Index = Math.floor(values.length * 0.75);

    return [
      { min: values[0], max: values[q1Index], count: q1Index },
      { min: values[q1Index], max: values[q2Index], count: q2Index - q1Index },
      { min: values[q2Index], max: values[q3Index], count: q3Index - q2Index },
      { min: values[q3Index], max: values[values.length - 1], count: values.length - q3Index }
    ];
  }

  private formatClassLabel(breakInfo: { min: number; max: number }, index: number, total: number): string {
    if (index === 0) {
      return `< ${breakInfo.max.toFixed(1)}`;
    } else if (index === total - 1) {
      return `> ${breakInfo.min.toFixed(1)}`;
    }
    return `${breakInfo.min.toFixed(1)} - ${breakInfo.max.toFixed(1)}`;
  }
}