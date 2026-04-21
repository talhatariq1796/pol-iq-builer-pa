/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BaseProcessor } from './BaseProcessor';

/**
 * AlgorithmComparisonProcessor - Handles data processing for algorithm comparison
 * 
 * Processes algorithm comparison results to evaluate relative performance
 * of different modeling approaches across geographic areas. Generic for any project type.
 * 
 * Extends BaseProcessor for configuration-driven behavior.
 */
export class AlgorithmComparisonProcessor extends BaseProcessor {
  private scoreField: string = 'algorithm_comparison_score';

  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Use hardcoded primary score field (metadata.targetVariable may override)
    const primary = getPrimaryScoreField('algorithm_comparison', (rawData as any)?.metadata) || 'algorithm_comparison_score';
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        ((record as any)[primary] !== undefined)
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [ALGORITHM COMPARISON PROCESSOR] Processing ${rawData.results?.length || 0} records for algorithm comparison`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for AlgorithmComparisonProcessor');
    }

  // Determine primary score field using hardcoded defs with metadata override
  const canonical = getPrimaryScoreField('algorithm_comparison', (rawData as any)?.metadata) || 'algorithm_comparison_score';
  this.scoreField = canonical;

    const processedRecords = rawData.results.map((record: any, index: number) => {
      const primaryScore = Number((record as any)[this.scoreField]);
      
      if (isNaN(primaryScore)) {
        throw new Error(`Algorithm comparison record ${(record as any).ID || index} is missing ${this.scoreField}`);
      }
      
      // Use BaseProcessor methods for area identification
      const areaName = this.generateAreaName(record);
      const recordId = this.extractGeographicId(record) || `area_${index + 1}`;
      
      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);
      
  const out: any = {
        area_id: recordId,
        area_name: areaName,
        value: Math.round(primaryScore * 100) / 100,
        algorithm_comparison_score: Math.round(primaryScore * 100) / 100,
        rank: 0, // Will be calculated after sorting
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          algorithm_comparison_score: primaryScore,
          score_source: this.scoreField,
          algorithm_performance: this.extractPrimaryMetric(record),
          total_population: Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0,
          median_income: Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0
        }
      };

  // Ensure canonical primary field exists at top-level and in properties
  out[this.scoreField] = out.value;
  (out.properties as any)[this.scoreField] = primaryScore;
  (out.properties as any).score_source = this.scoreField;

      return out;
    });
    
    // Calculate statistics using BaseProcessor method
    const values = processedRecords.map(r => r.value).filter(v => !isNaN(v));
    const statistics = this.calculateStatistics(values);
    
    // Rank records by comparison score using BaseProcessor method
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate summary
    const summary = this.generateSummary(rankedRecords, statistics);

    const renderer = this.createRenderer(rankedRecords);
    const legend = this.createLegend(rankedRecords);
    
    return {
      type: 'algorithm_comparison',
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
    console.log(`🎯 [ALGORITHM COMPARISON RENDERER] Creating renderer for ${records.length} records`);
    
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Algorithm comparison colors: Red (poor comparison) -> Orange -> Blue -> Green (excellent comparison)
    const comparisonColors = [
      [215, 48, 39, 0.6],   // Red (poor algorithm performance)
      [253, 174, 97, 0.6],  // Orange
      [49, 130, 189, 0.6],  // Blue
      [26, 152, 80, 0.6]    // Green (excellent algorithm performance)
    ];
    
    const classBreakInfos = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      classBreakInfos.push({
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1],
        symbol: {
          type: 'simple-fill',
          color: comparisonColors[i],
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
    
    const comparisonColors = [
      'rgba(215, 48, 39, 0.6)',   // Red
      'rgba(253, 174, 97, 0.6)',  // Orange
      'rgba(49, 130, 189, 0.6)',  // Blue
      'rgba(26, 152, 80, 0.6)'    // Green
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: comparisonColors[i],
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1]
      });
    }
    
    return {
      title: 'Algorithm Performance Score',
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
    
  // Use hardcoded top field definitions
  const fieldDefinitions = getTopFieldDefinitions('algorithm_comparison');
  // console.log(`[AlgorithmComparisonProcessor] Using hardcoded top field definitions for algorithm_comparison`);
    
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


  protected generateAreaName(record: any): string {
    // Check for DESCRIPTION field first (common in strategic analysis data)
    if ((record as any).DESCRIPTION && typeof (record as any).DESCRIPTION === 'string') {
      const description = (record as any).DESCRIPTION.trim();
      // Extract city name from parentheses format like "32544 (Hurlburt Field)" -> "Hurlburt Field"
      const nameMatch = description.match(/\(([^)]+)\)/);
      if (nameMatch && nameMatch[1]) {
        return nameMatch[1].trim();
      }
      // If no parentheses, return the whole description
      return description;
    }
    
    // Try value_DESCRIPTION with same extraction logic
    if ((record as any).value_DESCRIPTION && typeof (record as any).value_DESCRIPTION === 'string') {
      const description = (record as any).value_DESCRIPTION.trim();
      const nameMatch = description.match(/\(([^)]+)\)/);
      if (nameMatch && nameMatch[1]) {
        return nameMatch[1].trim();
      }
      return description;
    }
    
    // Other name fields
    if ((record as any).area_name) return (record as any).area_name;
    if ((record as any).NAME) return (record as any).NAME;
    if ((record as any).name) return (record as any).name;
    
    const id = (record as any).ID || (record as any).id || (record as any).GEOID;
    if (id) {
      if (typeof id === 'string' && id.match(/^\d{5}$/)) {
        return `ZIP ${id}`;
      }
      if (typeof id === 'string' && id.match(/^[A-Z]\d[A-Z]$/)) {
        return `FSA ${id}`;
      }
      return `Area ${id}`;
    }
    
    return `Area ${(record as any).OBJECTID || 'Unknown'}`;
  }



  private processFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getFeatureDescription((item as any).feature || (item as any).name)
    })).sort((a, b) => b.importance - a.importance);
  }

  private getFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'algorithm': 'Algorithm selection',
      'performance': 'Performance metrics',
      'validation': 'Cross-validation results',
      'stability': 'Algorithm stability',
      'efficiency': 'Computational efficiency'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} impact`;
  }



  private generateSummary(records: GeographicDataPoint[], statistics: AnalysisStatistics): string {
    let summary = getScoreExplanationForAnalysis('algorithm-comparison', 'algorithm_comparison');
    
    const targetBrandName = (this as any).brandResolver?.getTargetBrandName?.() ?? 'Target Brand';
    summary += `**Algorithm Comparison Complete:** ${statistics.total} geographic areas evaluated for ${targetBrandName} algorithm performance. `;
    summary += `Comparison scores range from ${statistics.min.toFixed(1)} to ${statistics.max.toFixed(1)} (average: ${statistics.mean.toFixed(1)}). `;
    
    const topAreas = records.slice(0, 10);
    if (topAreas.length > 0) {
      summary += `**Best Algorithm Performance:** `;
      const topNames = topAreas.map(r => `${r.area_name} (${r.value.toFixed(1)})`);
      summary += `${topNames.join(', ')}. `;
    }
    
    const highPerformance = records.filter(r => r.value >= (statistics.percentile75 || statistics.mean)).length;
    summary += `**Algorithm Effectiveness:** ${highPerformance} areas (${(highPerformance/records.length*100).toFixed(1)}%) show superior algorithm performance. `;
    
    return summary;
  }
}