/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { BaseProcessor } from './BaseProcessor';

/**
 * SimilarityAnalysisProcessor - Handles data processing for housing market similarity analysis
 * 
 * Identifies housing markets that are most similar to top-performing locations based on
 * demographic, economic, and housing characteristics. Helps brokers find comparable markets
 * and expansion opportunities.
 * 
 * Real Estate Focus: Finds similar housing markets for replication strategies, comparable
 * market analysis, and identifying untapped markets with similar potential.
 */
export class SimilarityAnalysisProcessor extends BaseProcessor {
  private scoreField: string = 'similarity_analysis_score';

  constructor() {
    super();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have geographic identifier and similarity metrics
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => {
        const hasGeographicId = !!(
          (record as any).area_id || 
          (record as any).id || 
          (record as any).ID || 
          (record as any).GEOID
        );
        
        const hasAnalysisData = !!(
          (record as any).similarity_score !== undefined || 
          (record as any).value !== undefined || 
          (record as any).score !== undefined ||
          (record as any).market_similarity !== undefined
        );
        
        return hasGeographicId && hasAnalysisData;
      });
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!this.validate(rawData)) {
      throw new Error('Invalid data provided to SimilarityAnalysisProcessor');
    }

    const features: GeographicDataPoint[] = [];
    const rawResults = rawData.results as any[];

    for (const record of rawResults) {
      // Extract geographic identifier
      const geographicId = this.extractGeographicId(record);
      if (!geographicId) continue;

      // Extract primary similarity score
      const primaryScore = this.extractPrimaryMetric(record);
      
      // Extract additional similarity metrics
      const demographicSimilarity = this.extractNumericValue(record, 
        ['demographic_similarity', 'demo_match', 'population_similarity'], 0);
      const economicSimilarity = this.extractNumericValue(record, 
        ['economic_similarity', 'income_similarity', 'economic_match'], 0);
      const housingSimilarity = this.extractNumericValue(record, 
        ['housing_similarity', 'market_similarity', 'housing_match'], 0);
      const overallSimilarity = this.extractNumericValue(record, 
        ['overall_similarity', 'total_similarity', 'composite_similarity'], primaryScore);

      // Generate area name
      const areaName = this.generateAreaName(record);

      // Create feature with similarity analysis data
      const feature: GeographicDataPoint = {
        area_id: geographicId,
        area_name: areaName,
        value: primaryScore,
        properties: {
          [this.scoreField]: primaryScore,
          demographic_similarity: demographicSimilarity,
          economic_similarity: economicSimilarity,
          housing_similarity: housingSimilarity,
          overall_similarity: overallSimilarity,
          analysis_type: 'housing_market_similarity',
          score_interpretation: this.getScoreInterpretation(primaryScore)
        }
      };

      features.push(feature);
    }

    // Calculate statistics
    const values = features.map(f => f.value);
    const statistics: AnalysisStatistics = this.calculateStatistics(values);

    return {
      type: 'similarity_analysis',
      records: features,
      statistics,
      summary: `Similarity analysis identified ${features.length} areas with comparable housing market characteristics. Average similarity score: ${statistics.mean.toFixed(2)}.`,
      targetVariable: this.scoreField,
      metadata: {
        algorithm: 'housing_market_similarity_matching',
        processorVersion: '1.0.0',
        analysisDate: new Date().toISOString(),
        recordsProcessed: features.length,
        primaryScoreField: this.scoreField,
        description: 'Housing market similarity analysis to identify comparable markets and expansion opportunities'
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