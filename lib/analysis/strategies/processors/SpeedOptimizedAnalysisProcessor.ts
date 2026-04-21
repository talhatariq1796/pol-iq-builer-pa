/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { BaseProcessor } from './BaseProcessor';

/**
 * SpeedOptimizedAnalysisProcessor - Fast housing market insights for time-critical decisions
 * 
 * Provides rapid housing market analysis for urgent real estate decisions including
 * quick market assessments, fast opportunity identification, and immediate response
 * to market changes for time-sensitive situations.
 * 
 * Real Estate Focus: Optimized for speed to support quick property decisions, urgent
 * market assessments, and rapid response to changing housing market conditions.
 */
export class SpeedOptimizedAnalysisProcessor extends BaseProcessor {
  private scoreField: string = 'speed_optimized_score';

  constructor() {
    super();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Simplified validation for speed
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => {
        const hasGeographicId = !!(
          (record as any).area_id || 
          (record as any).id || 
          (record as any).ID || 
          (record as any).GEOID
        );
        
        const hasAnalysisData = !!(
          (record as any).speed_optimized_score !== undefined || 
          (record as any).value !== undefined || 
          (record as any).score !== undefined ||
          (record as any).quick_score !== undefined
        );
        
        return hasGeographicId && hasAnalysisData;
      });
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!this.validate(rawData)) {
      throw new Error('Invalid data provided to SpeedOptimizedAnalysisProcessor');
    }

    const features: GeographicDataPoint[] = [];
    const rawResults = rawData.results as any[];

    for (const record of rawResults) {
      // Fast extraction with minimal processing
      const geographicId = this.extractGeographicId(record);
      if (!geographicId) continue;

      // Quick score extraction
      const primaryScore = this.extractPrimaryMetric(record);
      
      // Essential metrics only for speed
      const quickMarketScore = this.extractNumericValue(record, 
        ['quick_market_score', 'fast_assessment', 'rapid_score'], primaryScore);
      const urgencyRating = this.extractNumericValue(record, 
        ['urgency_rating', 'time_sensitivity', 'speed_priority'], 0);
      const processingTime = this.extractNumericValue(record, 
        ['processing_time', 'computation_speed', 'analysis_duration'], 0);

      // Simple area name generation
      const areaName = this.generateAreaName(record);

      // Streamlined feature creation
      const feature: GeographicDataPoint = {
        area_id: geographicId,
        area_name: areaName,
        value: primaryScore,
        properties: {
          [this.scoreField]: primaryScore,
          quick_market_score: quickMarketScore,
          urgency_rating: urgencyRating,
          processing_time: processingTime,
          analysis_type: 'speed_optimized_housing',
          score_interpretation: this.getScoreInterpretation(primaryScore)
        }
      };

      features.push(feature);
    }

    // Fast statistics calculation
    const values = features.map(f => f.value);
    const statistics: AnalysisStatistics = this.calculateFastStatistics(values);

    return {
      type: 'speed_optimized_analysis',
      records: features,
      statistics,
      summary: `Speed-optimized analysis processed ${features.length} areas in minimal time. Average speed score: ${statistics.mean.toFixed(2)}.`,
      targetVariable: this.scoreField,
      metadata: {
        algorithm: 'fast_housing_assessment',
        processorVersion: '1.0.0',
        analysisDate: new Date().toISOString(),
        recordsProcessed: features.length,
        primaryScoreField: this.scoreField,
        description: 'Speed-optimized housing analysis for time-critical real estate decisions'
      }
    };
  }

  /**
   * Fast statistics calculation optimized for speed
   */
  private calculateFastStatistics(values: number[]): AnalysisStatistics {
    if (values.length === 0) {
      return { total: 0, min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
    }

    // Fast min/max calculation
    let min = values[0];
    let max = values[0];
    let sum = 0;

    for (const value of values) {
      if (value < min) min = value;
      if (value > max) max = value;
      sum += value;
    }

    const mean = sum / values.length;
    
    // Simple median approximation for speed
    const median = values.length > 0 ? values[Math.floor(values.length / 2)] : 0;
    
    // Simplified standard deviation
    let variance = 0;
    for (const value of values) {
      variance += Math.pow(value - mean, 2);
    }
    const stdDev = Math.sqrt(variance / values.length);

    return { total: values.length, min, max, mean, median, stdDev };
  }
}