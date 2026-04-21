import { RawAnalysisResult, ProcessedAnalysisData } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

export class InvestmentOpportunityProcessor extends BaseProcessor {
  constructor() {
    super();
  }

  validate(rawData: RawAnalysisResult): boolean {
    return rawData && rawData.success && Array.isArray(rawData.results) && rawData.results.length > 0;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'Investment opportunity analysis failed');
    }

    const rawResults = rawData.results as unknown[];
    const scoreField = getPrimaryScoreField('investment_opportunity', (rawData as any)?.metadata) || 'investment_opportunity_score';
    
    const records = rawResults.map((recordRaw: unknown, index: number) => {
      const record = (recordRaw && typeof recordRaw === 'object') ? recordRaw as Record<string, unknown> : {};
      const investmentScore = this.extractPrimaryMetric(record);
      
      // Extract investment opportunity specific metrics
      const roiProjection = this.extractNumericValue(record, ['roi_projection', 'projected_roi', 'expected_return'], 0);
      const riskAssessment = this.extractNumericValue(record, ['risk_assessment', 'risk_score', 'investment_risk'], 0);
      const growthPotential = this.extractNumericValue(record, ['growth_potential', 'appreciation_potential', 'capital_growth'], 0);
      const liquidityScore = this.extractNumericValue(record, ['liquidity_score', 'market_liquidity', 'ease_of_sale'], 0);
      const entryBarrier = this.extractNumericValue(record, ['entry_barrier', 'affordability_index', 'cost_accessibility'], 0);
      const marketStability = this.extractNumericValue(record, ['market_stability', 'volatility_score', 'price_stability'], 0);

      return {
        area_id: this.extractGeographicId(record),
        area_name: this.generateAreaName(record),
        value: investmentScore,
        rank: index + 1,
        category: this.categorizeInvestmentOpportunity(investmentScore, roiProjection),
        coordinates: this.extractCoordinates(record),
        properties: {
          [scoreField]: investmentScore,
          investment_tier: this.getInvestmentTier(investmentScore, roiProjection, riskAssessment),
          risk_return_profile: this.getRiskReturnProfile(roiProjection, riskAssessment),
          investment_strategy_fit: this.getInvestmentStrategyFit(roiProjection, growthPotential, riskAssessment),
          market_entry_assessment: this.getMarketEntryAssessment(entryBarrier, liquidityScore),
          long_term_potential: this.getLongTermPotential(growthPotential, marketStability),
          investment_urgency: this.getInvestmentUrgency(investmentScore, growthPotential),
          roi_projection: roiProjection,
          risk_assessment: riskAssessment,
          growth_potential: growthPotential,
          liquidity_score: liquidityScore,
          entry_barrier: entryBarrier,
          market_stability: marketStability
        },
        shapValues: (record.shap_values || {}) as Record<string, number>
      };
    });

    const rankedRecords = this.rankRecords(records);
    const statistics = this.calculateStatistics(rankedRecords.map(r => r.value));
    
    const customSubstitutions = {
      avgROI: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.roi_projection) || 0), 0) / rankedRecords.length).toFixed(1),
      avgRisk: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.risk_assessment) || 0), 0) / rankedRecords.length).toFixed(1),
      topOpportunity: rankedRecords[0]?.area_name || 'N/A',
      opportunityCount: rankedRecords.length
    };
    
    const summary = this.buildSummaryFromTemplates(rankedRecords, statistics, customSubstitutions);

    return this.createProcessedData(
      'investment_opportunity',
      rankedRecords,
      summary,
      statistics,
      {
        featureImportance: rawData.feature_importance || [],
        investmentMetrics: {
          avgROI: customSubstitutions.avgROI,
          avgRisk: customSubstitutions.avgRisk,
          riskAdjustedReturn: this.calculateRiskAdjustedReturn(rankedRecords)
        }
      }
    );
  }

  private categorizeInvestmentOpportunity(score: number, roi: number): string {
    if (score >= 85 && roi >= 15) return 'Exceptional Investment Opportunity';
    if (score >= 75 && roi >= 12) return 'Outstanding Investment Potential';
    if (score >= 65 && roi >= 9) return 'Strong Investment Opportunity';
    if (score >= 55 && roi >= 6) return 'Good Investment Potential';
    if (score >= 45 && roi >= 3) return 'Moderate Investment Opportunity';
    if (roi < 3) return 'Limited Investment Appeal';
    return 'High Risk Investment';
  }

  private getInvestmentTier(score: number, roi: number, risk: number): string {
    const tierScore = (score * 0.4) + (roi * 3) - (risk * 0.5);
    if (tierScore >= 80) return 'Tier 1 - Premium Investment';
    if (tierScore >= 65) return 'Tier 2 - High-Quality Investment';
    if (tierScore >= 50) return 'Tier 3 - Standard Investment';
    if (tierScore >= 35) return 'Tier 4 - Speculative Investment';
    return 'Tier 5 - High-Risk Investment';
  }

  private getRiskReturnProfile(roi: number, risk: number): string {
    if (roi >= 15 && risk <= 30) return 'High Return, Low Risk';
    if (roi >= 12 && risk <= 50) return 'High Return, Moderate Risk';
    if (roi >= 9 && risk <= 40) return 'Good Return, Low Risk';
    if (roi >= 6 && risk <= 60) return 'Moderate Return, Moderate Risk';
    if (roi >= 3 && risk <= 50) return 'Low Return, Low Risk';
    if (risk > 70) return 'High Risk Profile';
    return 'Unfavorable Risk-Return';
  }

  private getInvestmentStrategyFit(roi: number, growth: number, risk: number): string {
    if (roi >= 12 && growth >= 70 && risk <= 40) return 'Aggressive Growth Strategy';
    if (roi >= 8 && growth >= 50 && risk <= 55) return 'Balanced Growth Strategy';
    if (roi >= 5 && risk <= 35) return 'Conservative Income Strategy';
    if (growth >= 60 && risk <= 60) return 'Long-Term Appreciation Strategy';
    if (roi >= 10 && risk >= 60) return 'High-Risk High-Reward Strategy';
    return 'Value Investment Strategy';
  }

  private getMarketEntryAssessment(entryBarrier: number, liquidity: number): string {
    const entryScore = (100 - entryBarrier) + liquidity;
    if (entryScore >= 150) return 'Very Easy Market Entry';
    if (entryScore >= 120) return 'Easy Market Entry';
    if (entryScore >= 90) return 'Moderate Market Entry';
    if (entryScore >= 60) return 'Challenging Market Entry';
    return 'Difficult Market Entry';
  }

  private getLongTermPotential(growth: number, stability: number): string {
    const longTermScore = (growth * 0.7) + (stability * 0.3);
    if (longTermScore >= 80) return 'Excellent Long-Term Potential';
    if (longTermScore >= 65) return 'Strong Long-Term Potential';
    if (longTermScore >= 50) return 'Good Long-Term Potential';
    if (longTermScore >= 35) return 'Limited Long-Term Potential';
    return 'Poor Long-Term Outlook';
  }

  private getInvestmentUrgency(score: number, growth: number): string {
    const urgencyScore = (score * 0.6) + (growth * 0.4);
    if (urgencyScore >= 85) return 'Act Now - Prime Opportunity';
    if (urgencyScore >= 70) return 'High Priority Investment';
    if (urgencyScore >= 55) return 'Consider Soon';
    if (urgencyScore >= 40) return 'Monitor for Changes';
    return 'Low Priority';
  }

  private calculateRiskAdjustedReturn(records: any[]): number {
    if (records.length === 0) return 0;
    
    const riskAdjustedReturns = records.map(r => {
      const roi = Number(r.properties?.roi_projection) || 0;
      const risk = Number(r.properties?.risk_assessment) || 0;
      // Sharpe ratio style calculation
      return risk > 0 ? roi / (risk / 100) : 0;
    });
    
    return riskAdjustedReturns.reduce((sum, val) => sum + val, 0) / riskAdjustedReturns.length;
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