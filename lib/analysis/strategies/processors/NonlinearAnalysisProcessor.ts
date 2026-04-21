/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { BaseProcessor } from './BaseProcessor';

/**
 * NonlinearAnalysisProcessor - Handles data processing for nonlinear housing pattern analysis
 * 
 * Identifies complex, non-linear relationships in housing markets that linear models miss,
 * including interaction effects, threshold behaviors, and curved relationships in real estate data.
 * 
 * Real Estate Focus: Detects curved price relationships, interaction effects between demographics
 * and housing demand, and threshold behaviors in market dynamics.
 */
export class NonlinearAnalysisProcessor extends BaseProcessor {
  private scoreField: string = 'nonlinear_analysis_score';

  constructor() {
    super();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have geographic identifier and some analysis data
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => {
        const hasGeographicId = !!(
          (record as any).area_id || 
          (record as any).id || 
          (record as any).ID || 
          (record as any).GEOID
        );
        
        const hasAnalysisData = !!(
          (record as any).nonlinear_score !== undefined || 
          (record as any).value !== undefined || 
          (record as any).score !== undefined ||
          (record as any).complexity_score !== undefined
        );
        
        return hasGeographicId && hasAnalysisData;
      });
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!this.validate(rawData)) {
      throw new Error('Invalid data provided to NonlinearAnalysisProcessor');
    }

    const features: GeographicDataPoint[] = [];
    const rawResults = rawData.results as any[];

    for (const record of rawResults) {
      // Extract geographic identifier
      const geographicId = this.extractGeographicId(record);
      if (!geographicId) continue;

      // Extract primary nonlinear analysis score
      const primaryScore = this.extractPrimaryMetric(record);
      
      // Extract additional nonlinear metrics
      const complexityScore = this.extractNumericValue(record, 
        ['complexity_score', 'nonlinear_complexity', 'pattern_complexity'], 0);
      const interactionStrength = this.extractNumericValue(record, 
        ['interaction_strength', 'feature_interaction', 'nonlinear_interaction'], 0);
      const curvilinearity = this.extractNumericValue(record, 
        ['curvilinearity', 'curve_strength', 'nonlinear_curve'], 0);

      // Generate area name
      const areaName = this.generateAreaName(record);

      // Create feature with nonlinear analysis data
      const feature: GeographicDataPoint = {
        area_id: geographicId,
        area_name: areaName,
        value: primaryScore,
        properties: {
          [this.scoreField]: primaryScore,
          complexity_score: complexityScore,
          interaction_strength: interactionStrength,
          curvilinearity: curvilinearity,
          analysis_type: 'nonlinear_housing_analysis',
          score_interpretation: this.getScoreInterpretation(primaryScore)
        }
      };

      features.push(feature);
    }

    // Calculate statistics
    const values = features.map(f => f.value);
    const statistics: AnalysisStatistics = this.calculateStatistics(values);

    return {
      type: 'nonlinear_analysis',
      records: features,
      statistics,
      summary: `Nonlinear analysis identified ${features.length} areas with complex housing market patterns. Average complexity score: ${statistics.mean.toFixed(2)}.`,
      targetVariable: this.scoreField,
      metadata: {
        algorithm: 'nonlinear_housing_pattern_detection',
        processorVersion: '1.0.0',
        analysisDate: new Date().toISOString(),
        recordsProcessed: features.length,
        primaryScoreField: this.scoreField,
        description: 'Nonlinear housing market pattern analysis revealing complex relationships linear models miss'
      }
    };
  }

  /**
   * Calculate basic statistics for the analysis
   */
  protected calculateStatistics(values: number[]): AnalysisStatistics {
    if (values.length === 0) {
      return { total: 0, min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      total: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median,
      stdDev
    };
  }
}