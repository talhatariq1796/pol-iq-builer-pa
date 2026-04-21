/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { BaseProcessor } from './BaseProcessor';

/**
 * InterpretabilityAnalysisProcessor - Provides transparent, explainable housing market insights
 * 
 * Generates clear, interpretable explanations of housing market analysis for brokers and
 * homebuyers. Focuses on transparent insights that can be easily understood and acted upon
 * in real estate decision-making.
 * 
 * Real Estate Focus: Provides transparent explanations of why certain markets are recommended,
 * what factors drive housing values, and clear reasoning for market rankings.
 */
export class InterpretabilityAnalysisProcessor extends BaseProcessor {
  private scoreField: string = 'interpretability_score';

  constructor() {
    super();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have geographic identifier and interpretability metrics
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => {
        const hasGeographicId = !!(
          (record as any).area_id || 
          (record as any).id || 
          (record as any).ID || 
          (record as any).GEOID
        );
        
        const hasAnalysisData = !!(
          (record as any).interpretability_score !== undefined || 
          (record as any).value !== undefined || 
          (record as any).score !== undefined ||
          (record as any).transparency_score !== undefined
        );
        
        return hasGeographicId && hasAnalysisData;
      });
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!this.validate(rawData)) {
      throw new Error('Invalid data provided to InterpretabilityAnalysisProcessor');
    }

    const features: GeographicDataPoint[] = [];
    const rawResults = rawData.results as any[];

    for (const record of rawResults) {
      // Extract geographic identifier
      const geographicId = this.extractGeographicId(record);
      if (!geographicId) continue;

      // Extract primary interpretability score
      const primaryScore = this.extractPrimaryMetric(record);
      
      // Extract interpretability metrics
      const transparencyScore = this.extractNumericValue(record, 
        ['transparency_score', 'clarity_score', 'explanation_quality'], 0);
      const explainabilityIndex = this.extractNumericValue(record, 
        ['explainability_index', 'interpretable_score', 'reasoning_clarity'], 0);
      const understandabilityRating = this.extractNumericValue(record, 
        ['understandability_rating', 'comprehension_score', 'user_clarity'], 0);
      const actionabilityScore = this.extractNumericValue(record, 
        ['actionability_score', 'decision_utility', 'practical_value'], primaryScore);

      // Generate area name
      const areaName = this.generateAreaName(record);

      // Create feature with interpretability analysis data
      const feature: GeographicDataPoint = {
        area_id: geographicId,
        area_name: areaName,
        value: primaryScore,
        properties: {
          [this.scoreField]: primaryScore,
          transparency_score: transparencyScore,
          explainability_index: explainabilityIndex,
          understandability_rating: understandabilityRating,
          actionability_score: actionabilityScore,
          analysis_type: 'housing_interpretability_analysis',
          score_interpretation: this.getScoreInterpretation(primaryScore)
        }
      };

      features.push(feature);
    }

    // Calculate statistics
    const values = features.map(f => f.value);
    const statistics: AnalysisStatistics = this.calculateStatistics(values);

    const summary = `Interpretability analysis completed with ${features.length} areas analyzed. ` +
      `Transparency and explainability metrics computed with average score of ${statistics.mean.toFixed(2)}.`;

    return this.createProcessedData(
      'interpretability_analysis',
      features,
      summary,
      statistics,
      {
        featureImportance: [],
        metadata: {
          algorithm: 'housing_transparency_analysis',
          processorVersion: '1.0.0',
          analysisDate: new Date().toISOString(),
          recordsProcessed: features.length,
          primaryScoreField: this.scoreField,
          description: 'Interpretability analysis providing transparent, explainable housing market insights'
        }
      }
    );
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