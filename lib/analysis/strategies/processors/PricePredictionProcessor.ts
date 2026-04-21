import { RawAnalysisResult, ProcessedAnalysisData } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

export class PricePredictionProcessor extends BaseProcessor {
  constructor() {
    super();
  }

  validate(rawData: RawAnalysisResult): boolean {
    return rawData && rawData.success && Array.isArray(rawData.results) && rawData.results.length > 0;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'Price prediction analysis failed');
    }

    const rawResults = rawData.results as unknown[];
    const scoreField = getPrimaryScoreField('price_prediction', (rawData as any)?.metadata) || 'price_prediction_score';
    
    const records = rawResults.map((recordRaw: unknown, index: number) => {
      const record = (recordRaw && typeof recordRaw === 'object') ? recordRaw as Record<string, unknown> : {};
      const predictionScore = this.extractPrimaryMetric(record);
      
      // Extract price prediction specific metrics
      const predictedPrice = this.extractNumericValue(record, ['predicted_price', 'forecast_price', 'estimated_value'], 0);
      const currentPrice = this.extractNumericValue(record, ['current_price', 'market_value', 'median_price'], 0);
      const priceConfidence = this.extractNumericValue(record, ['price_confidence', 'prediction_confidence', 'confidence_score'], 0);
      const priceVariance = this.extractNumericValue(record, ['price_variance', 'prediction_variance', 'volatility'], 0);
      const growthPotential = this.extractNumericValue(record, ['growth_potential', 'appreciation_potential', 'upside_potential'], 0);

      const priceChangeAmt = predictedPrice - currentPrice;
      const priceChangePct = currentPrice > 0 ? (priceChangeAmt / currentPrice) * 100 : 0;

      return {
        area_id: this.extractGeographicId(record),
        area_name: this.generateAreaName(record),
        value: predictionScore,
        rank: index + 1,
        category: this.categorizePricePrediction(predictionScore, priceChangePct),
        coordinates: this.extractCoordinates(record),
        properties: {
          [scoreField]: predictionScore,
          price_prediction_outlook: this.getPricePredictionOutlook(priceChangePct, priceConfidence),
          prediction_reliability: this.getPredictionReliability(priceConfidence, priceVariance),
          investment_timing: this.getInvestmentTiming(priceChangePct, growthPotential),
          market_position: this.getMarketPosition(predictedPrice, currentPrice),
          risk_assessment: this.getRiskAssessment(priceVariance, priceConfidence),
          value_opportunity: this.getValueOpportunity(priceChangePct, priceConfidence),
          predicted_price: predictedPrice,
          current_price: currentPrice,
          price_change_amount: priceChangeAmt,
          price_change_pct: priceChangePct,
          price_confidence: priceConfidence,
          price_variance: priceVariance,
          growth_potential: growthPotential
        },
        shapValues: (record.shap_values || {}) as Record<string, number>
      };
    });

    const rankedRecords = this.rankRecords(records);
    const statistics = this.calculateStatistics(rankedRecords.map(r => r.value));
    
    const customSubstitutions = {
      avgPredictedGrowth: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.price_change_pct) || 0), 0) / rankedRecords.length).toFixed(1),
      avgConfidence: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.price_confidence) || 0), 0) / rankedRecords.length).toFixed(1),
      topGrowthArea: rankedRecords.find(r => (Number(r.properties?.price_change_pct) || 0) > 5)?.area_name || 'No high growth areas',
      predictionCount: rankedRecords.length
    };
    
    const summary = this.buildSummaryFromTemplates(rankedRecords, statistics, customSubstitutions);

    const processedData = this.createProcessedData(
      'price_prediction',
      rankedRecords,
      summary,
      statistics,
      {
        featureImportance: rawData.feature_importance || []
      }
    );
    
    // Add prediction metrics to metadata
    processedData.metadata = {
      ...processedData.metadata,
      predictionMetrics: {
        avgPredictedGrowth: customSubstitutions.avgPredictedGrowth,
        avgConfidence: customSubstitutions.avgConfidence,
        predictionReliability: this.calculateOverallReliability(rankedRecords)
      }
    };

    return {
      ...processedData,
      renderer: this.createPricePredictionRenderer(rankedRecords),
      legend: this.createPricePredictionLegend(rankedRecords)
    };
  }

  private categorizePricePrediction(score: number, priceChangePct: number): string {
    if (score >= 80 && priceChangePct > 10) return 'High Growth Potential';
    if (score >= 70 && priceChangePct > 5) return 'Strong Appreciation Expected';
    if (score >= 60 && priceChangePct > 0) return 'Moderate Growth Potential';
    if (score >= 50 && priceChangePct >= -2) return 'Stable Value Expected';
    if (priceChangePct < -5) return 'Value Decline Predicted';
    return 'Uncertain Price Outlook';
  }

  private getPricePredictionOutlook(priceChangePct: number, confidence: number): string {
    if (priceChangePct > 15 && confidence > 80) return 'Highly Bullish';
    if (priceChangePct > 8 && confidence > 70) return 'Bullish';
    if (priceChangePct > 3 && confidence > 60) return 'Moderately Bullish';
    if (priceChangePct > -3 && priceChangePct <= 3) return 'Neutral';
    if (priceChangePct <= -3 && confidence > 60) return 'Bearish';
    if (priceChangePct <= -8) return 'Highly Bearish';
    return 'Uncertain';
  }

  private getPredictionReliability(confidence: number, variance: number): string {
    const reliabilityScore = confidence - (variance * 2);
    if (reliabilityScore >= 85) return 'Very High Reliability';
    if (reliabilityScore >= 70) return 'High Reliability';
    if (reliabilityScore >= 55) return 'Moderate Reliability';
    if (reliabilityScore >= 40) return 'Low Reliability';
    return 'Very Low Reliability';
  }

  private getInvestmentTiming(priceChangePct: number, growthPotential: number): string {
    if (priceChangePct > 10 && growthPotential > 75) return 'Buy Now - Strong Growth';
    if (priceChangePct > 5 && growthPotential > 60) return 'Good Time to Buy';
    if (priceChangePct > 0 && growthPotential > 40) return 'Consider Buying';
    if (priceChangePct < -5) return 'Wait for Better Entry';
    if (priceChangePct < -10) return 'Avoid - Price Declining';
    return 'Monitor Market';
  }

  private getMarketPosition(predictedPrice: number, currentPrice: number): string {
    if (currentPrice === 0) return 'No Current Price Data';
    const ratio = predictedPrice / currentPrice;
    if (ratio >= 1.2) return 'Significantly Undervalued';
    if (ratio >= 1.1) return 'Undervalued';
    if (ratio >= 1.05) return 'Slightly Undervalued';
    if (ratio >= 0.95) return 'Fairly Valued';
    if (ratio >= 0.9) return 'Slightly Overvalued';
    if (ratio >= 0.8) return 'Overvalued';
    return 'Significantly Overvalued';
  }

  private getRiskAssessment(variance: number, confidence: number): string {
    const riskScore = variance + (100 - confidence);
    if (riskScore <= 20) return 'Very Low Risk';
    if (riskScore <= 40) return 'Low Risk';
    if (riskScore <= 60) return 'Moderate Risk';
    if (riskScore <= 80) return 'High Risk';
    return 'Very High Risk';
  }

  private getValueOpportunity(priceChangePct: number, confidence: number): string {
    const opportunityScore = (priceChangePct * 2) + (confidence * 0.5);
    if (opportunityScore >= 80) return 'Excellent Opportunity';
    if (opportunityScore >= 60) return 'Good Opportunity';
    if (opportunityScore >= 40) return 'Fair Opportunity';
    if (opportunityScore >= 20) return 'Limited Opportunity';
    return 'Poor Opportunity';
  }

  private calculateOverallReliability(records: any[]): number {
    const confidenceScores = records.map(r => Number(r.properties?.price_confidence) || 0);
    const varianceScores = records.map(r => Number(r.properties?.price_variance) || 0);
    
    const avgConfidence = confidenceScores.reduce((sum, val) => sum + val, 0) / confidenceScores.length;
    const avgVariance = varianceScores.reduce((sum, val) => sum + val, 0) / varianceScores.length;
    
    return Math.max(0, avgConfidence - (avgVariance * 2));
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

  private createPricePredictionRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter((v: number) => !isNaN(v)).sort((a: number, b: number) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);

    // Blue (low prices) -> Purple -> Pink -> Red (high prices)
    const priceColors = [
      [69, 117, 180, 0.6],   // #4575b4 - Blue (lowest prices)
      [171, 139, 194, 0.6],  // #ab8bc2 - Purple
      [244, 165, 180, 0.6],  // #f4a5b4 - Pink
      [215, 48, 39, 0.6]     // #d73027 - Red (highest prices)
    ];

    return {
      type: 'class-breaks',
      field: 'price_prediction_score',
      classBreakInfos: quartileBreaks.map((breakInfo, index) => ({
        minValue: breakInfo.min,
        maxValue: breakInfo.max,
        symbol: {
          type: 'simple-fill',
          color: priceColors[index],
          outline: {
            color: [255, 255, 255, 0.5],
            width: 0.5
          }
        },
        label: this.formatClassLabel(breakInfo, index, quartileBreaks.length)
      }))
    };
  }

  private createPricePredictionLegend(records: any[]): any {
    const values = records.map(r => r.value).filter((v: number) => !isNaN(v)).sort((a: number, b: number) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);

    const legendItems = quartileBreaks.map((breakInfo, index) => ({
      label: this.formatClassLabel(breakInfo, index, quartileBreaks.length),
      color: index === 0 ? '#4575b4' : index === 1 ? '#ab8bc2' : index === 2 ? '#f4a5b4' : '#d73027',
      value: `${breakInfo.min.toFixed(1)} - ${breakInfo.max.toFixed(1)}`
    }));

    return {
      title: 'Price Prediction Score',
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