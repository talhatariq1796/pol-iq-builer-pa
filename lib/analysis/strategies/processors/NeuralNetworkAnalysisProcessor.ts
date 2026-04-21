/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { BaseProcessor } from './BaseProcessor';

/**
 * NeuralNetworkAnalysisProcessor - Deep learning analysis for complex housing market patterns
 * 
 * Leverages deep learning to uncover complex, non-obvious patterns in housing data that
 * traditional analysis methods miss. Identifies sophisticated relationships between demographics,
 * economics, and housing market performance.
 * 
 * Real Estate Focus: Discovers deep patterns in housing market data including hidden correlations,
 * complex demographic interactions, and sophisticated predictive signals for market timing.
 */
export class NeuralNetworkAnalysisProcessor extends BaseProcessor {
  private scoreField: string = 'neural_network_score';

  constructor() {
    super();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have geographic identifier and neural network analysis data
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => {
        const hasGeographicId = !!(
          (record as any).area_id || 
          (record as any).id || 
          (record as any).ID || 
          (record as any).GEOID
        );
        
        const hasAnalysisData = !!(
          (record as any).neural_network_score !== undefined || 
          (record as any).value !== undefined || 
          (record as any).score !== undefined ||
          (record as any).deep_learning_score !== undefined
        );
        
        return hasGeographicId && hasAnalysisData;
      });
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!this.validate(rawData)) {
      throw new Error('Invalid data provided to NeuralNetworkAnalysisProcessor');
    }

    const features: GeographicDataPoint[] = [];
    const rawResults = rawData.results as any[];

    for (const record of rawResults) {
      // Extract geographic identifier
      const geographicId = this.extractGeographicId(record);
      if (!geographicId) continue;

      // Extract primary neural network score
      const primaryScore = this.extractPrimaryMetric(record);
      
      // Extract deep learning metrics
      const patternComplexity = this.extractNumericValue(record, 
        ['pattern_complexity', 'deep_pattern_score', 'neural_complexity'], 0);
      const hiddenCorrelations = this.extractNumericValue(record, 
        ['hidden_correlations', 'latent_relationships', 'deep_connections'], 0);
      const nonlinearSignals = this.extractNumericValue(record, 
        ['nonlinear_signals', 'deep_signals', 'neural_insights'], 0);
      const confidenceScore = this.extractNumericValue(record, 
        ['confidence_score', 'prediction_confidence', 'neural_confidence'], primaryScore);

      // Generate area name
      const areaName = this.generateAreaName(record);

      // Create feature with neural network analysis data
      const feature: GeographicDataPoint = {
        area_id: geographicId,
        area_name: areaName,
        value: primaryScore,
        properties: {
          [this.scoreField]: primaryScore,
          pattern_complexity: patternComplexity,
          hidden_correlations: hiddenCorrelations,
          nonlinear_signals: nonlinearSignals,
          confidence_score: confidenceScore,
          analysis_type: 'neural_housing_analysis',
          score_interpretation: this.getScoreInterpretation(primaryScore)
        }
      };

      features.push(feature);
    }

    // Calculate statistics
    const values = features.map(f => f.value);
    const statistics: AnalysisStatistics = this.calculateStatistics(values);

    return this.createProcessedData(
      'neural_network_analysis',
      features,
      'Neural network analysis completed with advanced pattern recognition',
      statistics,
      {
        metadata: {
          algorithm: 'deep_learning_housing_analysis',
          processorVersion: '1.0.0',
          analysisDate: new Date().toISOString(),
          recordsProcessed: features.length,
          primaryScoreField: this.scoreField,
          description: 'Neural network analysis uncovering complex patterns in housing market data'
        }
      }
    );
  }

  /**
   * Calculate basic statistics for the analysis
   */
  protected calculateStatistics(values: number[]): AnalysisStatistics {
    if (values.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, total: 0 };
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
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median,
      stdDev,
      total: values.length
    };
  }
}