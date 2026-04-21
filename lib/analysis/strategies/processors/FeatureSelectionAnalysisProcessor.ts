/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { BaseProcessor } from './BaseProcessor';

/**
 * FeatureSelectionAnalysisProcessor - Handles analysis for optimal feature selection in housing markets
 * 
 * Determines which demographic, economic, and housing features are truly essential for
 * predicting housing market success and homeowner satisfaction. Helps brokers focus on
 * the most impactful variables for market analysis.
 * 
 * Real Estate Focus: Identifies key factors that drive housing market performance,
 * homeownership rates, and market stability for targeted analysis and decision-making.
 */
export class FeatureSelectionAnalysisProcessor extends BaseProcessor {
  private scoreField: string = 'feature_selection_score';

  constructor() {
    super();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have geographic identifier and feature selection metrics
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => {
        const hasGeographicId = !!(
          (record as any).area_id || 
          (record as any).id || 
          (record as any).ID || 
          (record as any).GEOID
        );
        
        const hasAnalysisData = !!(
          (record as any).feature_selection_score !== undefined || 
          (record as any).value !== undefined || 
          (record as any).score !== undefined ||
          (record as any).feature_importance !== undefined
        );
        
        return hasGeographicId && hasAnalysisData;
      });
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!this.validate(rawData)) {
      throw new Error('Invalid data provided to FeatureSelectionAnalysisProcessor');
    }

    const features: GeographicDataPoint[] = [];
    const rawResults = rawData.results as any[];

    for (const record of rawResults) {
      // Extract geographic identifier
      const geographicId = this.extractGeographicId(record);
      if (!geographicId) continue;

      // Extract primary feature selection score
      const primaryScore = this.extractPrimaryMetric(record);
      
      // Extract feature importance metrics
      const demographicImportance = this.extractNumericValue(record, 
        ['demographic_importance', 'demo_feature_weight', 'population_relevance'], 0);
      const economicImportance = this.extractNumericValue(record, 
        ['economic_importance', 'income_feature_weight', 'economic_relevance'], 0);
      const housingImportance = this.extractNumericValue(record, 
        ['housing_importance', 'market_feature_weight', 'housing_relevance'], 0);
      const featureRelevance = this.extractNumericValue(record, 
        ['feature_relevance', 'overall_importance', 'selection_weight'], primaryScore);

      // Generate area name
      const areaName = this.generateAreaName(record);

      // Create feature with feature selection analysis data
      const feature: GeographicDataPoint = {
        area_id: geographicId,
        area_name: areaName,
        value: primaryScore,
        properties: {
          [this.scoreField]: primaryScore,
          demographic_importance: demographicImportance,
          economic_importance: economicImportance,
          housing_importance: housingImportance,
          feature_relevance: featureRelevance,
          analysis_type: 'housing_feature_selection',
          score_interpretation: this.getScoreInterpretation(primaryScore)
        }
      };

      features.push(feature);
    }

    // Calculate statistics
    const values = features.map(f => f.value);
    const statistics: AnalysisStatistics = this.calculateStatistics(values);

    const summary = `Feature selection analysis completed with ${features.length} areas analyzed. ` +
      `Key features identified for housing market prediction with average importance score of ${statistics.mean.toFixed(2)}.`;

    return this.createProcessedData(
      'feature_selection_analysis',
      features,
      summary,
      statistics,
      {
        featureImportance: [],
        metadata: {
          algorithm: 'housing_feature_selection_optimization',
          processorVersion: '1.0.0',
          analysisDate: new Date().toISOString(),
          recordsProcessed: features.length,
          primaryScoreField: this.scoreField,
          description: 'Feature selection analysis identifying essential variables for housing market prediction'
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