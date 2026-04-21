/* eslint-disable @typescript-eslint/no-explicit-any */
import { 
  DataProcessorStrategy, 
  RawAnalysisResult, 
  ProcessedAnalysisData, 
  GeographicDataPoint, 
  AnalysisStatistics,
  MultiTargetAnalysisData,
  TargetVariableAnalysis,
  TargetVariableType,
  TargetCorrelationMatrix,
  MultiTargetSummary
} from '../../types';
import { AnalysisConfigurationManager } from '../../AnalysisConfigurationManager';
import { ProcessingContextManager } from '../../ProcessingContextManager';
import { ProcessingContext } from '../../types';
import { 
  AnalysisContext, 
  ScoreRange} from '../../../../config/analysis-contexts/base-context';
import { getPrimaryScoreField } from './HardcodedFieldDefs';

/**
 * Base class for all analysis processors
 * Provides common functionality and configuration-driven behavior
 */
export abstract class BaseProcessor implements DataProcessorStrategy {
  protected configManager: AnalysisConfigurationManager;
  protected config: AnalysisContext;
  protected processingContextManager: ProcessingContextManager;

  constructor() {
    this.configManager = AnalysisConfigurationManager.getInstance();
    this.config = this.configManager.getCurrentContext();
    this.processingContextManager = ProcessingContextManager.getInstance();
  }

  /**
   * Abstract method that subclasses must implement
   */
  abstract validate(rawData: RawAnalysisResult): boolean;
  abstract process(rawData: RawAnalysisResult): ProcessedAnalysisData;

  /**
   * Refresh configuration (call when project type changes)
   */
  protected refreshConfig(): void {
    this.config = this.configManager.getCurrentContext();
  }

  /**
   * Extract primary metric from record using configuration
   */
  protected extractPrimaryMetric(record: any): number {
    return this.configManager.extractPrimaryMetric(record);
  }

  /**
   * Extract geographic ID from record using configuration
   */
  protected extractGeographicId(record: any): string {
    return this.configManager.extractGeographicId(record);
  }

  /**
   * Generate area name from record using configuration
   */
  protected generateAreaName(record: any): string {
    return this.configManager.extractDescriptiveName(record);
  }

  /**
   * Get score interpretation for a given score
   */
  protected getScoreInterpretation(score: number): ScoreRange {
    return this.configManager.getScoreInterpretation(score);
  }

  /**
   * Extract field value with fallback options
   */
  protected extractFieldValue(record: any, fieldNames: string[]): any {
    for (const fieldName of fieldNames) {
      if (record[fieldName] !== undefined && record[fieldName] !== null) {
        return record[fieldName];
      }
    }
    return null;
  }

  /**
   * Extract numeric field value with fallback options
   */
  protected extractNumericValue(record: any, fieldNames: string[], defaultValue: number = 0): number {
    const value = this.extractFieldValue(record, fieldNames);
    if (value !== null) {
      const numValue = Number(value);
      return isNaN(numValue) ? defaultValue : numValue;
    }
    return defaultValue;
  }

  /**
   * Calculate statistics for an array of values
   */
  protected calculateStatistics(values: number[]): AnalysisStatistics {
    if (values.length === 0) {
      return {
        total: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0,
        percentile25: 0, percentile75: 0, iqr: 0, outlierCount: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const total = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / total;

    // Calculate percentiles
    const p25Index = Math.floor(total * 0.25);
    const p75Index = Math.floor(total * 0.75);
    const medianIndex = Math.floor(total * 0.5);

    const percentile25 = sorted[p25Index];
    const percentile75 = sorted[p75Index];
    const median = sorted[medianIndex];
    const iqr = percentile75 - percentile25;

    // Calculate standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);

    // Count outliers (values beyond 1.5 * IQR from quartiles)
    const lowerBound = percentile25 - (1.5 * iqr);
    const upperBound = percentile75 + (1.5 * iqr);
    const outlierCount = values.filter(v => v < lowerBound || v > upperBound).length;

    return {
      total,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev,
      percentile25,
      percentile75,
      iqr,
      outlierCount
    };
  }

  /**
   * Rank records by their value (highest first)
   */
  protected rankRecords(records: GeographicDataPoint[]): GeographicDataPoint[] {
    return records.sort((a, b) => b.value - a.value).map((record, index) => ({
      ...record,
      rank: index + 1
    }));
  }

  /**
   * Group records by a field value
   */
  protected groupRecordsByField(records: any[], fieldName: string): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    records.forEach(record => {
      const value = String(record[fieldName] || 'Unknown');
      if (!groups.has(value)) {
        groups.set(value, []);
      }
      groups.get(value)!.push(record);
    });
    
    return groups;
  }

  /**
   * Apply template substitutions using configuration manager
   */
  protected applyTemplate(template: string, substitutions: Record<string, any>): string {
    return this.configManager.applyTemplate(template, substitutions);
  }

  /**
   * Build summary from template patterns
   */
  protected buildSummaryFromTemplates(
    records: GeographicDataPoint[], 
    statistics: AnalysisStatistics,
    customSubstitutions: Record<string, any> = {}
  ): string {
  const templates = this.configManager.getSummaryTemplates();
    
    // Basic statistics for substitution
    const baseSubstitutions = {
      totalAreas: records.length,
      avgScore: statistics.mean.toFixed(1),
      minScore: statistics.min.toFixed(1),
      maxScore: statistics.max.toFixed(1),
      scoreRange: (statistics.max - statistics.min).toFixed(1),
      ...customSubstitutions
    };

    // Build title
    let summary = this.applyTemplate(templates.analysisTitle, baseSubstitutions) + '\n\n';
    
    // Add methodology explanation
    summary += this.applyTemplate(templates.methodologyExplanation, baseSubstitutions) + '\n\n';
    
    // Calculate performance distribution
    const scoreRanges = this.configManager.getScoreRanges();
    const excellentCount = records.filter(r => r.value >= scoreRanges.excellent.min).length;
    const goodCount = records.filter(r => r.value >= scoreRanges.good.min && r.value < scoreRanges.excellent.min).length;
    const moderateCount = records.filter(r => r.value >= scoreRanges.moderate.min && r.value < scoreRanges.good.min).length;
    const poorCount = records.filter(r => r.value < scoreRanges.moderate.min).length;

    const distributionSubstitutions = {
      ...baseSubstitutions,
      excellentCount,
      goodCount,
      moderateCount,
      poorCount
    };

    // Add insights
    summary += '**Key Insights:**\n';
    templates.insightPatterns.forEach(pattern => {
      const insight = this.applyTemplate(pattern, distributionSubstitutions);
      summary += `• ${insight}\n`;
    });
    summary += '\n';

    // Add recommendations
    summary += '**Recommendations:**\n';
    templates.recommendationPatterns.forEach(pattern => {
      const recommendation = this.applyTemplate(pattern, distributionSubstitutions);
      summary += `• ${recommendation}\n`;
    });

    return summary;
  }

  /**
   * Create standardized processed data structure
   */
  protected createProcessedData(
    type: string,
    records: GeographicDataPoint[],
    summary: string,
    statistics: AnalysisStatistics,
    additionalData: Partial<ProcessedAnalysisData> = {}
  ): ProcessedAnalysisData {
    // Use hardcoded field mapping for the specific analysis type
    const targetVariable = getPrimaryScoreField(type) || this.configManager.getFieldMapping('primaryMetric')[0] || 'value';
    
    return {
      type,
      records,
      summary,
      statistics,
      targetVariable,
      featureImportance: [],
      renderer: null,
      legend: null,
      ...additionalData
    };
  }

  /**
   * Log processor activity with configuration context
   */
  protected log(message: string, data?: any): void {
    const projectType = this.configManager.getCurrentProjectType();
    console.log(`[${this.constructor.name}:${projectType}] ${message}`, data || '');
  }

  /**
   * Log warning with configuration context
   */
  protected warn(message: string, data?: any): void {
    const projectType = this.configManager.getCurrentProjectType();
    console.warn(`[${this.constructor.name}:${projectType}] ${message}`, data || '');
  }

  /**
   * Retrieve the active processing context for the current processor call.
   */
  protected getProcessingContext(): ProcessingContext | null {
    return this.processingContextManager.getContext();
  }

  /**
   * Build a lightweight snapshot of applied filters from the active context.
   */
  protected buildAppliedFilterSnapshot(): Record<string, unknown> | undefined {
    const context = this.getProcessingContext();
    const options = context?.analysisOptions;

    if (!options) return undefined;

    const snapshot: Record<string, unknown> = {};

    if (Array.isArray(options.spatialFilterIds) && options.spatialFilterIds.length > 0) {
      snapshot.spatialFilterIds = [...options.spatialFilterIds];
    }
    if (options.spatialFilterMethod) {
      snapshot.spatialFilterMethod = options.spatialFilterMethod;
    }
    if (options.spatialFilterGeometry) {
      snapshot.spatialFilterGeometry = options.spatialFilterGeometry;
    }
    if (options.fieldFilters) {
      snapshot.fieldFilters = options.fieldFilters;
    }
    if (options.filters) {
      snapshot.filters = options.filters;
    }
    if (options.persona) {
      snapshot.persona = options.persona;
    }
    if (options.geometry) {
      snapshot.geometry = options.geometry;
    }

    return Object.keys(snapshot).length > 0 ? snapshot : undefined;
  }

  // ============================================================================
  // MULTI-TARGET ANALYSIS SUPPORT
  // ============================================================================

  /**
   * Create multi-target analysis data from multiple raw results
   */
  protected createMultiTargetAnalysis(
    targetResults: Array<{
      target: string;
      type: TargetVariableType;
      rawData: RawAnalysisResult;
    }>,
    primaryTarget: string
  ): MultiTargetAnalysisData {
    const targets: TargetVariableAnalysis[] = [];
    
    // Process each target variable
    targetResults.forEach(({ target, type, rawData }) => {
      if (!this.validate(rawData)) {
        this.warn(`Invalid data for target variable: ${target}`);
        return;
      }

      // Extract statistics and model info
      const values = this.extractTargetValues(rawData, target);
      const statistics = this.calculateStatistics(values);
      
      const targetAnalysis: TargetVariableAnalysis = {
        variable: target,
        type,
        statistics,
        featureImportance: rawData.feature_importance || [],
        modelInfo: rawData.model_info
      };

      // Add predictions if available
      if (rawData.results && Array.isArray(rawData.results)) {
        targetAnalysis.predictions = this.extractPredictions(rawData.results, target);
        targetAnalysis.confidence = this.extractConfidenceScores(rawData.results, target);
      }

      targets.push(targetAnalysis);
    });

    // Calculate cross-target correlations
    const correlations = this.calculateTargetCorrelations(targets);

    // Generate multi-target summary
    const summary = this.generateMultiTargetSummary(targets, primaryTarget, correlations);

    return {
      primary: primaryTarget,
      targets,
      correlations,
      summary
    };
  }

  /**
   * Extract target values from raw analysis results
   */
  protected extractTargetValues(rawData: RawAnalysisResult, targetVariable: string): number[] {
    if (!rawData.results || !Array.isArray(rawData.results)) {
      return [];
    }

    return rawData.results
      .map(record => this.extractNumericValue(record, [targetVariable], NaN))
      .filter(value => !isNaN(value));
  }

  /**
   * Extract prediction values for a target variable
   */
  protected extractPredictions(results: any[], targetVariable: string): Record<string, number> {
    const predictions: Record<string, number> = {};
    
    results.forEach(record => {
      const areaId = this.extractGeographicId(record);
      const predictionValue = this.extractNumericValue(record, [
        `${targetVariable}_prediction`,
        `predicted_${targetVariable}`,
        `pred_${targetVariable}`,
        targetVariable
      ], NaN);
      
      if (areaId && !isNaN(predictionValue)) {
        predictions[areaId] = predictionValue;
      }
    });

    return predictions;
  }

  /**
   * Extract confidence scores for predictions
   */
  protected extractConfidenceScores(results: any[], targetVariable: string): Record<string, number> {
    const confidence: Record<string, number> = {};
    
    results.forEach(record => {
      const areaId = this.extractGeographicId(record);
      const confidenceValue = this.extractNumericValue(record, [
        `${targetVariable}_confidence`,
        `confidence_${targetVariable}`,
        `conf_${targetVariable}`,
        'confidence',
        'prediction_confidence'
      ], NaN);
      
      if (areaId && !isNaN(confidenceValue)) {
        confidence[areaId] = confidenceValue;
      }
    });

    return confidence;
  }

  /**
   * Calculate correlations between target variables
   */
  protected calculateTargetCorrelations(targets: TargetVariableAnalysis[]): TargetCorrelationMatrix {
    const correlations: TargetCorrelationMatrix['correlations'] = [];
    const labels = targets.map(t => t.variable);

    // Calculate pairwise correlations
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const target1 = targets[i];
        const target2 = targets[j];
        
        const correlation = this.calculatePearsonCorrelation(
          this.getStatisticsValues(target1.statistics),
          this.getStatisticsValues(target2.statistics)
        );

        if (!isNaN(correlation)) {
          correlations.push({
            target1: target1.variable,
            target2: target2.variable,
            coefficient: correlation,
            significance: Math.abs(correlation), // Simplified significance
            strength: this.getCorrelationStrength(correlation)
          });
        }
      }
    }

    return {
      correlations,
      labels,
      heatmapData: this.createCorrelationHeatmap(targets, correlations)
    };
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  protected calculatePearsonCorrelation(values1: number[], values2: number[]): number {
    if (values1.length !== values2.length || values1.length === 0) {
      return NaN;
    }

    const n = values1.length;
    const sum1 = values1.reduce((a, b) => a + b, 0);
    const sum2 = values2.reduce((a, b) => a + b, 0);
    const sum1Sq = values1.reduce((a, b) => a + b * b, 0);
    const sum2Sq = values2.reduce((a, b) => a + b * b, 0);
    const sum12 = values1.reduce((a, b, i) => a + b * values2[i], 0);

    const numerator = n * sum12 - sum1 * sum2;
    const denominator = Math.sqrt((n * sum1Sq - sum1 * sum1) * (n * sum2Sq - sum2 * sum2));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Get correlation strength description
   */
  protected getCorrelationStrength(coefficient: number): 'weak' | 'moderate' | 'strong' {
    const absCoeff = Math.abs(coefficient);
    if (absCoeff >= 0.7) return 'strong';
    if (absCoeff >= 0.3) return 'moderate';
    return 'weak';
  }

  /**
   * Extract values from statistics for correlation calculation
   */
  protected getStatisticsValues(stats: AnalysisStatistics): number[] {
    return [stats.mean, stats.median, stats.min, stats.max, stats.stdDev];
  }

  /**
   * Create correlation heatmap data
   */
  protected createCorrelationHeatmap(
    targets: TargetVariableAnalysis[], 
    correlations: TargetCorrelationMatrix['correlations']
  ): number[][] {
    const size = targets.length;
    const heatmap: number[][] = Array(size).fill(null).map(() => Array(size).fill(0));

    // Fill diagonal with 1 (perfect correlation with self)
    for (let i = 0; i < size; i++) {
      heatmap[i][i] = 1;
    }

    // Fill correlation values
    correlations.forEach(corr => {
      const index1 = targets.findIndex(t => t.variable === corr.target1);
      const index2 = targets.findIndex(t => t.variable === corr.target2);
      
      if (index1 !== -1 && index2 !== -1) {
        heatmap[index1][index2] = corr.coefficient;
        heatmap[index2][index1] = corr.coefficient; // Symmetric matrix
      }
    });

    return heatmap;
  }

  /**
   * Generate multi-target analysis summary
   */
  protected generateMultiTargetSummary(
    targets: TargetVariableAnalysis[],
    primaryTarget: string,
    correlations: TargetCorrelationMatrix
  ): MultiTargetSummary {
    // Find strongest and weakest predictors
    const sortedTargets = targets.sort((a, b) => {
      const aR2 = a.modelInfo?.r2 || a.modelInfo?.r2_score || 0;
      const bR2 = b.modelInfo?.r2 || b.modelInfo?.r2_score || 0;
      return bR2 - aR2;
    });

    // Find most and least correlated target pairs
    const sortedCorrelations = correlations.correlations.sort((a, b) => 
      Math.abs(b.coefficient) - Math.abs(a.coefficient)
    );

    const primaryInsights = [
      `Analysis covers ${targets.length} target variables with ${primaryTarget} as primary focus`,
      `Strongest performing model: ${sortedTargets[0]?.variable || 'N/A'} (R² = ${(sortedTargets[0]?.modelInfo?.r2 || 0).toFixed(3)})`,
      `Target variable correlations range from ${(sortedCorrelations[sortedCorrelations.length - 1]?.coefficient || 0).toFixed(3)} to ${(sortedCorrelations[0]?.coefficient || 0).toFixed(3)}`
    ];

    const crossTargetInsights = correlations.correlations
      .filter(corr => corr.strength === 'strong')
      .map(corr => `Strong correlation between ${corr.target1} and ${corr.target2} (${corr.coefficient.toFixed(3)})`)
      .slice(0, 3); // Top 3 insights

    return {
      totalTargets: targets.length,
      analysisMode: 'parallel', // Default mode, can be configured
      primaryInsights,
      crossTargetInsights,
      keyFindings: {
        strongestPredictor: sortedTargets[0]?.variable || 'N/A',
        weakestPredictor: sortedTargets[sortedTargets.length - 1]?.variable || 'N/A',
        mostCorrelatedTargets: sortedCorrelations[0] ? 
          [sortedCorrelations[0].target1, sortedCorrelations[0].target2] : ['N/A', 'N/A'],
        leastCorrelatedTargets: sortedCorrelations[sortedCorrelations.length - 1] ? 
          [sortedCorrelations[sortedCorrelations.length - 1].target1, sortedCorrelations[sortedCorrelations.length - 1].target2] : ['N/A', 'N/A']
      }
    };
  }

  /**
   * Create enhanced processed data with multi-target support
   */
  protected createProcessedDataWithMultiTarget(
    type: string,
    records: GeographicDataPoint[],
    summary: string,
    statistics: AnalysisStatistics,
    multiTargetData?: MultiTargetAnalysisData,
    additionalData: Partial<ProcessedAnalysisData> = {}
  ): ProcessedAnalysisData {
    const baseData = this.createProcessedData(type, records, summary, statistics, additionalData);
    
    if (multiTargetData) {
      baseData.targetVariables = multiTargetData;
      // Update metadata to indicate multi-target analysis
      baseData.metadata = {
        ...baseData.metadata,
        multiTargetAnalysis: true
      };
    }

    return baseData;
  }

  /**
   * Determine target variable type from variable name
   */
  protected getTargetVariableType(variableName: string): TargetVariableType {
    const varLower = variableName.toLowerCase();
    
    if (varLower.includes('time') && varLower.includes('market')) return 'time_on_market';
    if (varLower.includes('sold') && varLower.includes('price')) return 'avg_sold_price';
    if (varLower.includes('rent') && varLower.includes('price')) return 'avg_rent_price';
    if (varLower.includes('price') && varLower.includes('delta')) return 'price_delta';
    if (varLower.includes('velocity') || varLower.includes('activity')) return 'market_velocity';
    if (varLower.includes('appreciation')) return 'appreciation_rate';
    if (varLower.includes('inventory')) return 'inventory_levels';
    
    return 'custom';
  }
}