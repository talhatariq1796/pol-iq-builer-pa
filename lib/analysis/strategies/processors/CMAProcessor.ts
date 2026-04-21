import { RawAnalysisResult, ProcessedAnalysisData } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

export class CMAProcessor extends BaseProcessor {
  constructor() {
    super();
  }

  validate(rawData: RawAnalysisResult): boolean {
    return rawData && rawData.success && Array.isArray(rawData.results) && rawData.results.length > 0;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'CMA analysis failed');
    }

    const rawResults = rawData.results as unknown[];
    const scoreField = getPrimaryScoreField('cma_analysis', (rawData as any)?.metadata) || 'cma_analysis_score';
    
    const records = rawResults.map((recordRaw: unknown, index: number) => {
      const record = (recordRaw && typeof recordRaw === 'object') ? recordRaw as Record<string, unknown> : {};
      const cmaScore = this.extractPrimaryMetric(record);
      
      // Extract CMA specific metrics
      const priceComparison = this.extractNumericValue(record, ['price_comparison', 'comp_price_variance', 'price_differential'], 0);
      const marketPosition = this.extractNumericValue(record, ['market_position', 'relative_position', 'market_ranking'], 0);
      const valueAccuracy = this.extractNumericValue(record, ['value_accuracy', 'valuation_confidence', 'price_precision'], 0);
      const compAvailability = this.extractNumericValue(record, ['comp_availability', 'comparable_count', 'sample_size'], 0);
      const marketActivity = this.extractNumericValue(record, ['market_activity', 'sales_volume', 'transaction_frequency'], 0);
      const priceStability = this.extractNumericValue(record, ['price_stability', 'price_volatility_inverse', 'market_consistency'], 0);

      return {
        area_id: this.extractGeographicId(record),
        area_name: this.generateAreaName(record),
        value: cmaScore,
        rank: index + 1,
        category: this.categorizeCMAAnalysis(cmaScore, valueAccuracy),
        coordinates: this.extractCoordinates(record),
        properties: {
          [scoreField]: cmaScore,
          valuation_reliability: this.getValuationReliability(valueAccuracy, compAvailability),
          market_comparison_strength: this.getMarketComparisonStrength(priceComparison, marketActivity),
          competitive_position: this.getCompetitivePosition(marketPosition, priceComparison),
          pricing_strategy_recommendation: this.getPricingStrategyRecommendation(priceComparison, marketPosition),
          market_timing_assessment: this.getMarketTimingAssessment(marketActivity, priceStability),
          comparable_quality: this.getComparableQuality(compAvailability, valueAccuracy),
          price_comparison: priceComparison,
          market_position: marketPosition,
          value_accuracy: valueAccuracy,
          comp_availability: compAvailability,
          market_activity: marketActivity,
          price_stability: priceStability
        },
        shapValues: (record.shap_values || {}) as Record<string, number>
      };
    });

    const rankedRecords = this.rankRecords(records);
    const statistics = this.calculateStatistics(rankedRecords.map(r => r.value));
    
    const customSubstitutions = {
      avgValueAccuracy: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.value_accuracy) || 0), 0) / rankedRecords.length).toFixed(1),
      avgCompAvailability: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.comp_availability) || 0), 0) / rankedRecords.length).toFixed(0),
      topCMAArea: rankedRecords[0]?.area_name || 'N/A',
      cmaAnalysisCount: rankedRecords.length
    };
    
    const summary = this.buildSummaryFromTemplates(rankedRecords, statistics, customSubstitutions);

    return this.createProcessedData(
      'cma_analysis',
      rankedRecords,
      summary,
      statistics,
      {
        featureImportance: rawData.feature_importance || [],
        cmaAnalysis: {
          avgValueAccuracy: customSubstitutions.avgValueAccuracy,
          avgCompAvailability: customSubstitutions.avgCompAvailability,
          overallReliability: this.calculateOverallReliability(rankedRecords)
        }
      }
    );
  }

  private categorizeCMAAnalysis(score: number, accuracy: number): string {
    if (score >= 85 && accuracy >= 90) return 'Highly Accurate CMA';
    if (score >= 75 && accuracy >= 80) return 'Reliable CMA Analysis';
    if (score >= 65 && accuracy >= 70) return 'Good CMA Confidence';
    if (score >= 55 && accuracy >= 60) return 'Moderate CMA Reliability';
    if (accuracy < 50) return 'Limited CMA Accuracy';
    return 'Challenging CMA Conditions';
  }

  private getValuationReliability(accuracy: number, compCount: number): string {
    const reliabilityScore = (accuracy * 0.7) + (Math.min(100, compCount * 10) * 0.3);
    if (reliabilityScore >= 90) return 'Very High Reliability';
    if (reliabilityScore >= 80) return 'High Reliability';
    if (reliabilityScore >= 70) return 'Good Reliability';
    if (reliabilityScore >= 60) return 'Moderate Reliability';
    if (reliabilityScore >= 50) return 'Limited Reliability';
    return 'Low Reliability';
  }

  private getMarketComparisonStrength(priceComparison: number, activity: number): string {
    const strengthScore = (100 - Math.abs(priceComparison - 50)) + (activity * 0.5);
    if (strengthScore >= 85) return 'Excellent Comparison Base';
    if (strengthScore >= 75) return 'Strong Comparison Base';
    if (strengthScore >= 65) return 'Good Comparison Base';
    if (strengthScore >= 55) return 'Adequate Comparison Base';
    return 'Weak Comparison Base';
  }

  private getCompetitivePosition(position: number, priceVariance: number): string {
    if (position >= 80 && priceVariance <= 10) return 'Premium Market Position';
    if (position >= 70 && priceVariance <= 15) return 'Strong Market Position';
    if (position >= 60 && priceVariance <= 20) return 'Competitive Market Position';
    if (position >= 50) return 'Average Market Position';
    if (position >= 40) return 'Below Average Position';
    return 'Weak Market Position';
  }

  private getPricingStrategyRecommendation(priceComparison: number, position: number): string {
    if (position >= 80 && priceComparison <= 5) return 'Premium Pricing Strategy';
    if (position >= 70 && priceComparison <= 10) return 'Competitive Pricing Plus';
    if (position >= 60 && priceComparison <= 15) return 'Market Rate Pricing';
    if (position >= 50) return 'Competitive Pricing';
    if (position >= 40) return 'Value Pricing Strategy';
    return 'Aggressive Pricing Required';
  }

  private getMarketTimingAssessment(activity: number, stability: number): string {
    const timingScore = (activity * 0.6) + (stability * 0.4);
    if (timingScore >= 80) return 'Excellent Market Timing';
    if (timingScore >= 70) return 'Good Market Timing';
    if (timingScore >= 60) return 'Fair Market Timing';
    if (timingScore >= 50) return 'Cautious Market Timing';
    if (activity < 30) return 'Wait for Better Market';
    return 'Poor Market Timing';
  }

  private getComparableQuality(availability: number, accuracy: number): string {
    const qualityScore = Math.min(100, availability * 10) * 0.4 + accuracy * 0.6;
    if (qualityScore >= 85) return 'Excellent Comparable Quality';
    if (qualityScore >= 75) return 'High Quality Comparables';
    if (qualityScore >= 65) return 'Good Quality Comparables';
    if (qualityScore >= 55) return 'Adequate Comparables';
    if (qualityScore >= 45) return 'Limited Comparables';
    return 'Poor Comparable Quality';
  }

  private calculateOverallReliability(records: any[]): number {
    if (records.length === 0) return 0;
    
    const reliabilityFactors = records.map(r => {
      const accuracy = Number(r.properties?.value_accuracy) || 0;
      const compCount = Number(r.properties?.comp_availability) || 0;
      const activity = Number(r.properties?.market_activity) || 0;
      const stability = Number(r.properties?.price_stability) || 0;
      
      // Weighted reliability calculation
      return (accuracy * 0.4) + (Math.min(100, compCount * 10) * 0.3) + (activity * 0.2) + (stability * 0.1);
    });
    
    return reliabilityFactors.reduce((sum, val) => sum + val, 0) / reliabilityFactors.length;
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