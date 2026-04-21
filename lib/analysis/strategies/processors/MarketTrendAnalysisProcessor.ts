import { RawAnalysisResult, ProcessedAnalysisData } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

export class MarketTrendAnalysisProcessor extends BaseProcessor {
  constructor() {
    super();
  }

  validate(rawData: RawAnalysisResult): boolean {
    // Allow empty results to pass validation - they will be handled gracefully in process()
    return rawData && rawData.success && Array.isArray(rawData.results);
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'Market trend analysis failed');
    }

    const rawResults = rawData.results as unknown[];
    const scoreField = getPrimaryScoreField('market_trend_analysis', (rawData as any)?.metadata) || 'market_trend_score';
    
    const records = rawResults.map((recordRaw: unknown, index: number) => {
      const record = (recordRaw && typeof recordRaw === 'object') ? recordRaw as Record<string, unknown> : {};
      const marketTrendScore = this.extractPrimaryMetric(record);
      
      // Extract market trend specific metrics
      const timeOnMarket = this.extractNumericValue(record, ['time_on_market', 'days_on_market', 'dom'], 0);
      const priceChange = this.extractNumericValue(record, ['price_change_pct', 'price_delta_pct', 'price_trend'], 0);
      const marketVelocity = this.extractNumericValue(record, ['market_velocity', 'sales_velocity', 'turnover_rate'], 0);
      const inventoryLevel = this.extractNumericValue(record, ['inventory_level', 'available_units', 'supply_level'], 0);
      const priceVolatility = this.extractNumericValue(record, ['price_volatility', 'price_stability', 'price_variance'], 0);

      return {
        area_id: this.extractGeographicId(record),
        area_name: this.generateAreaName(record),
        value: marketTrendScore,
        rank: index + 1,
        category: this.categorizeMarketTrend(marketTrendScore, priceChange),
        coordinates: this.extractCoordinates(record),
        properties: {
          [scoreField]: marketTrendScore,
          market_trend_direction: this.getMarketTrendDirection(priceChange, marketVelocity),
          time_on_market_trend: this.getTimeOnMarketTrend(timeOnMarket),
          market_momentum: this.getMarketMomentum(marketVelocity, priceChange),
          price_stability: this.getPriceStability(priceVolatility),
          market_health: this.getMarketHealth(marketTrendScore, timeOnMarket, priceChange),
          supply_demand_balance: this.getSupplyDemandBalance(inventoryLevel, marketVelocity),
          time_on_market: timeOnMarket,
          price_change_pct: priceChange,
          market_velocity: marketVelocity,
          inventory_level: inventoryLevel,
          price_volatility: priceVolatility
        },
        shapValues: (record.shap_values || {}) as Record<string, number>
      };
    });

    const rankedRecords = this.rankRecords(records);
    const statistics = this.calculateStatistics(rankedRecords.map(r => r.value));
    
    const customSubstitutions = {
      avgTimeOnMarket: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.time_on_market) || 0), 0) / rankedRecords.length).toFixed(1),
      avgPriceChange: (rankedRecords.reduce((sum, r) => sum + (Number(r.properties?.price_change_pct) || 0), 0) / rankedRecords.length).toFixed(1),
      topTrendingArea: rankedRecords[0]?.area_name || 'N/A',
      marketCount: rankedRecords.length
    };
    
    const summary = this.buildSummaryFromTemplates(rankedRecords, statistics, customSubstitutions);

    const renderer = this.createMarketTrendRenderer(rankedRecords);
    const legend = this.createMarketTrendLegend(rankedRecords);

    console.log('[MarketTrendAnalysisProcessor] 🎨 RENDERER & LEGEND CREATED:', {
      hasRenderer: !!renderer,
      hasLegend: !!legend,
      rendererType: (renderer as any)?.type,
      rendererField: (renderer as any)?.field,
      classBreaks: (renderer as any)?.classBreakInfos?.length,
      legendTitle: (legend as any)?.title,
      legendItems: (legend as any)?.items?.length
    });

    return {
      ...this.createProcessedData(
        'market_trend_analysis',
        rankedRecords,
        summary,
        statistics,
        {
          featureImportance: rawData.feature_importance || [],
          trendMetrics: {
            avgTimeOnMarket: customSubstitutions.avgTimeOnMarket,
            avgPriceChange: customSubstitutions.avgPriceChange,
            marketVolatility: this.calculateMarketVolatility(rankedRecords)
          }
        }
      ),
      renderer,
      legend
    };
  }

  private categorizeMarketTrend(score: number, priceChange: number): string {
    if (score >= 80 && priceChange > 5) return 'Hot Seller\'s Market';
    if (score >= 70 && priceChange > 0) return 'Strong Market Growth';
    if (score >= 60) return 'Stable Market Conditions';
    if (score >= 40) return 'Cooling Market';
    if (priceChange < -5) return 'Buyer\'s Market';
    return 'Market Uncertainty';
  }

  private getMarketTrendDirection(priceChange: number, velocity: number): string {
    if (priceChange > 5 && velocity > 70) return 'Rapidly Rising';
    if (priceChange > 2 && velocity > 50) return 'Rising';
    if (priceChange > -2 && priceChange <= 2) return 'Stable';
    if (priceChange <= -2 && velocity < 50) return 'Declining';
    if (priceChange <= -5) return 'Rapidly Declining';
    return 'Mixed Signals';
  }

  private getTimeOnMarketTrend(timeOnMarket: number): string {
    if (timeOnMarket <= 15) return 'Very Fast Sales';
    if (timeOnMarket <= 30) return 'Fast Sales';
    if (timeOnMarket <= 60) return 'Normal Sales Pace';
    if (timeOnMarket <= 90) return 'Slow Sales';
    return 'Very Slow Sales';
  }

  private getMarketMomentum(velocity: number, priceChange: number): string {
    const momentum = (velocity * 0.6) + (Math.max(-10, Math.min(10, priceChange)) * 4);
    if (momentum >= 80) return 'Very High Momentum';
    if (momentum >= 60) return 'High Momentum';
    if (momentum >= 40) return 'Moderate Momentum';
    if (momentum >= 20) return 'Low Momentum';
    return 'Stagnant Market';
  }

  private getPriceStability(volatility: number): string {
    if (volatility <= 5) return 'Very Stable Prices';
    if (volatility <= 10) return 'Stable Prices';
    if (volatility <= 15) return 'Moderate Volatility';
    if (volatility <= 25) return 'High Volatility';
    return 'Very Volatile Prices';
  }

  private getMarketHealth(score: number, timeOnMarket: number, priceChange: number): string {
    const healthScore = (score * 0.5) + ((120 - Math.min(120, timeOnMarket)) * 0.3) + (Math.max(-10, Math.min(10, priceChange)) * 2);
    if (healthScore >= 80) return 'Excellent Market Health';
    if (healthScore >= 60) return 'Good Market Health';
    if (healthScore >= 40) return 'Fair Market Health';
    if (healthScore >= 20) return 'Poor Market Health';
    return 'Distressed Market';
  }

  private getSupplyDemandBalance(inventory: number, velocity: number): string {
    if (inventory <= 30 && velocity >= 70) return 'High Demand, Low Supply';
    if (inventory <= 60 && velocity >= 50) return 'Balanced Market';
    if (inventory >= 90 && velocity <= 30) return 'High Supply, Low Demand';
    if (inventory >= 60) return 'Oversupplied Market';
    return 'Undersupplied Market';
  }

  private calculateMarketVolatility(records: any[]): number {
    const priceChanges = records.map(r => Number(r.properties?.price_change_pct) || 0);
    const mean = priceChanges.reduce((sum, val) => sum + val, 0) / priceChanges.length;
    const variance = priceChanges.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / priceChanges.length;
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

  private createMarketTrendRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter((v: number) => !isNaN(v)).sort((a: number, b: number) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);

    // Red (declining) -> Orange -> Yellow -> Green (growing)
    const trendColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (declining market)
      [253, 174, 97, 0.6],  // #fdae61 - Orange (cooling)
      [254, 224, 139, 0.6], // #fee08b - Yellow (stable)
      [166, 217, 106, 0.6]  // #a6d96a - Green (growing market)
    ];

    return {
      type: 'class-breaks',
      field: 'market_trend_score',
      classBreakInfos: quartileBreaks.map((breakInfo, index) => ({
        minValue: breakInfo.min,
        maxValue: breakInfo.max,
        symbol: {
          type: 'simple-fill',
          color: trendColors[index],
          outline: {
            color: [255, 255, 255, 0.5],
            width: 0.5
          }
        },
        label: this.formatClassLabel(breakInfo, index, quartileBreaks.length)
      }))
    };
  }

  private createMarketTrendLegend(records: any[]): any {
    const values = records.map(r => r.value).filter((v: number) => !isNaN(v)).sort((a: number, b: number) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);

    const legendItems = quartileBreaks.map((breakInfo, index) => ({
      label: this.formatClassLabel(breakInfo, index, quartileBreaks.length),
      color: index === 0 ? '#d73027' : index === 1 ? '#fdae61' : index === 2 ? '#fee08b' : '#a6d96a',
      value: `${breakInfo.min.toFixed(1)} - ${breakInfo.max.toFixed(1)}`
    }));

    return {
      title: 'Market Trend Score',
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