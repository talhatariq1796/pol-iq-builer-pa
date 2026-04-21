/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BaseProcessor } from './BaseProcessor';

/**
 * EnsembleAnalysisProcessor - Handles data processing for ensemble analysis
 * 
 * Processes ensemble model performance to evaluate combined model
 * effectiveness for real estate investment analysis across different geographic areas.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class EnsembleAnalysisProcessor extends BaseProcessor {
  // Prefer canonical; fallback to last numeric field for energy dataset
  private scoreField: string = 'ensemble_performance_score';

  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    return true; // Dynamic-only: basic shape is enough
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [ENSEMBLE ANALYSIS PROCESSOR] Processing ${rawData.results?.length || 0} records for ensemble analysis`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for EnsembleAnalysisProcessor');
    }

    // Determine primary score field deterministically from hardcoded defs; allow metadata override
  const primary = getPrimaryScoreField('ensemble_analysis', (rawData as any)?.metadata ?? undefined) || 'ensemble_performance_score';
  this.scoreField = primary;

    const processedRecords = rawData.results.map((record: any, index: number) => {
      const primaryScore = Number((record as any)[this.scoreField]);
      if (isNaN(primaryScore)) {
        throw new Error(`Ensemble analysis record ${(record as any).ID || index} is missing ${this.scoreField}`);
      }
      
      // Generate area name
      const areaName = this.generateAreaName(record);
      const recordId = this.extractGeographicId(record) || `area_${index + 1}`;
      
      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);
      
      const out: any = {
        area_id: recordId,
        area_name: areaName,
  value: Math.round(primaryScore * 100) / 100,
  [this.scoreField]: Math.round(primaryScore * 100) / 100,
        rank: 0, // Will be calculated after sorting
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          [this.scoreField]: primaryScore,
          score_source: this.scoreField,
          target_brand_share: this.extractTargetBrandShare(record),
          total_population: this.extractNumericValue(record, ['ECYPTAPOP', 'total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population']),
          median_income: this.extractNumericValue(record, ['ECYHRIAVG', 'median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])
        }
      };

  // Mirror dynamic field value for renderer/consumers when field name differs from ensemble_performance_score
  if (this.scoreField && this.scoreField !== 'ensemble_performance_score') {
        out[this.scoreField] = out.value;
        (out.properties as any)[this.scoreField] = out.value;
      }

      return out;
    });
    
    // Calculate statistics
    const statistics = this.calculateRecordStatistics(processedRecords);
    
    // Rank records by ensemble score
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate summary
    const summary = this.generateSummary(rankedRecords, statistics);

    const renderer = this.createRenderer(rankedRecords);
    const legend = this.createLegend(rankedRecords);
    
    return {
      type: 'ensemble_analysis',
      records: rankedRecords,
      summary,
      featureImportance,
      statistics,
      targetVariable: this.scoreField,
      renderer: renderer,
      legend: legend
    };
  }

  private createRenderer(records: GeographicDataPoint[]): any {
    console.log(`🎯 [ENSEMBLE RENDERER] Creating renderer for ${records.length} records`);
    
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use standard red-to-green gradient: Red (low) -> Orange -> Light Green -> Dark Green (high)
    const ensembleColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (low ensemble performance)
      [253, 174, 97, 0.6],  // #fdae61 - Orange
      [166, 217, 106, 0.6], // #a6d96a - Light Green
      [26, 152, 80, 0.6]    // #1a9850 - Dark Green (high ensemble performance)
    ];
    
    const classBreakInfos = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      classBreakInfos.push({
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1],
        symbol: {
          type: 'simple-fill',
          color: ensembleColors[i],
          outline: { color: [0, 0, 0, 0], width: 0 }
        },
        label: this.formatClassLabel(i, quartileBreaks)
      });
    }
    
    return {
      type: 'class-breaks',
      field: this.scoreField,
      classBreakInfos,
      defaultSymbol: {
        type: 'simple-fill',
        color: [200, 200, 200, 0.5],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }
    };
  }

  private createLegend(records: GeographicDataPoint[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    const ensembleColors = [
      'rgba(215, 48, 39, 0.6)',   // Red (low ensemble performance)
      'rgba(253, 174, 97, 0.6)',  // Orange
      'rgba(166, 217, 106, 0.6)', // Light Green
      'rgba(26, 152, 80, 0.6)'    // Dark Green (high ensemble performance)
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: ensembleColors[i],
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1]
      });
    }
    
    return {
      title: 'Real Estate Ensemble Performance',
      items: legendItems,
      position: 'bottom-right'
    };
  }

  private calculateQuartileBreaks(sortedValues: number[]): number[] {
    if (sortedValues.length === 0) return [0, 1];
    
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const q2 = sortedValues[Math.floor(sortedValues.length * 0.5)];
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
    
    return [min, q1, q2, q3, max];
  }

  private formatClassLabel(classIndex: number, quartileBreaks: number[]): string {
    const totalClasses = quartileBreaks.length - 1;
    
    if (classIndex === 0) {
      return `< ${quartileBreaks[classIndex + 1].toFixed(1)}`;
    } else if (classIndex === totalClasses - 1) {
      return `> ${quartileBreaks[classIndex].toFixed(1)}`;
    } else {
      return `${quartileBreaks[classIndex].toFixed(1)} - ${quartileBreaks[classIndex + 1].toFixed(1)}`;
    }
  }

  private getTopContributingFields(record: any): Record<string, number> {
    const contributingFields: Array<{field: string, value: number, importance: number}> = [];
    
  const fieldDefinitions = getTopFieldDefinitions('ensemble_analysis');
  console.log(`[EnsembleAnalysisProcessor] Using hardcoded top field definitions for ensemble_analysis`);
    
    fieldDefinitions.forEach(fieldDef => {
      const sourceKey = Array.isArray(fieldDef.source) ? fieldDef.source[0] : fieldDef.source;
      const value = Number(record[sourceKey]);
      if (!isNaN(value) && value > 0) {
        contributingFields.push({
          field: fieldDef.field,
          value: Math.round(value * 100) / 100,
          importance: fieldDef.importance
        });
      }
    });
    
    return contributingFields
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5)
      .reduce((acc, item) => {
        acc[(item as any).field] = (item as any).value;
        return acc;
      }, {} as Record<string, number>);
  }

  // Remove generateAreaName - use BaseProcessor method instead



  private processFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getFeatureDescription((item as any).feature || (item as any).name)
    })).sort((a, b) => b.importance - a.importance);
  }

  private getFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'ensemble': 'Ensemble method impact',
      'diversity': 'Model diversity benefit',
      'voting': 'Voting mechanism strength',
      'bias': 'Bias reduction effect',
      'accuracy': 'Base model accuracy'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} impact`;
  }

  private calculateRecordStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
    const values = records.map(r => r.value).filter(v => !isNaN(v));
    
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
    
    const p25Index = Math.floor(total * 0.25);
    const p75Index = Math.floor(total * 0.75);
    const medianIndex = Math.floor(total * 0.5);
    
    const percentile25 = sorted[p25Index];
    const percentile75 = sorted[p75Index];
    const median = total % 2 === 0 
      ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2
      : sorted[medianIndex];
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    const iqr = percentile75 - percentile25;
    const lowerBound = percentile25 - 1.5 * iqr;
    const upperBound = percentile75 + 1.5 * iqr;
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

  private extractTargetBrandShare(record: any): number {
    // Extract primary metric using BaseProcessor method
    return this.extractPrimaryMetric(record);
  }

  private generateSummary(records: GeographicDataPoint[], statistics: AnalysisStatistics): string {
    let summary = getScoreExplanationForAnalysis('ensemble-analysis', 'ensemble_analysis');
    
    summary += `**Ensemble Analysis Complete:** ${statistics.total} geographic markets evaluated for real estate investment ensemble model performance. `;
    summary += `Ensemble scores range from ${statistics.min.toFixed(1)} to ${statistics.max.toFixed(1)} (average: ${statistics.mean.toFixed(1)}). `;
    
    const topAreas = records.slice(0, 10);
    if (topAreas.length > 0) {
      summary += `**Best Ensemble Performance:** `;
      const topNames = topAreas.map(r => `${r.area_name} (${r.value.toFixed(1)})`);
      summary += `${topNames.join(', ')}. `;
    }
    
    const highPerformance = records.filter(r => r.value >= (statistics.percentile75 || statistics.mean)).length;
    summary += `**Ensemble Effectiveness:** ${highPerformance} areas (${(highPerformance/records.length*100).toFixed(1)}%) show strong ensemble model benefits. `;
    
    return summary;
  }
  // Remove extractFieldValue - use BaseProcessor extractNumericValue instead

}