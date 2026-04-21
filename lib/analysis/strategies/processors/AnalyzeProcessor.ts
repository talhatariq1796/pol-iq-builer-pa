/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BaseProcessor } from './BaseProcessor';

/**
 * AnalyzeProcessor - Handles data processing for general analysis
 * 
 * Processes general analysis results with analysis_score to provide
 * comprehensive market insights across geographic areas.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class AnalyzeProcessor extends BaseProcessor {
  private scoreField: string = 'analysis_score';

  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
  if (!Array.isArray(rawData.results)) return false;
  // Dynamic-only: don't require canonical fields; basic shape is enough
  return true;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [ANALYZE PROCESSOR] Processing ${rawData.results?.length || 0} records for general analysis`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for AnalyzeProcessor');
    }

  // Use hardcoded primary field list; metadata override still applies
  this.scoreField = getPrimaryScoreField('analyze', (rawData as any)?.metadata ?? undefined) || 'analysis_score';

    const processedRecords = rawData.results.map((record: any, index: number) => {
  const primaryScore = Number((record as any)[this.scoreField]);
      
      if (isNaN(primaryScore)) {
        throw new Error(`Analyze record ${(record as any).ID || index} is missing analysis_score`);
      }
      
      // Generate area name and ID using BaseProcessor methods
      const areaName = this.generateAreaName(record);
      const recordId = this.extractGeographicId(record) || `area_${index + 1}`;
      
      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);
      
  const out: any = {
        area_id: recordId,
        area_name: areaName,
        value: Math.round(primaryScore * 100) / 100,
  analysis_score: Math.round(primaryScore * 100) / 100,
        rank: 0, // Will be calculated after sorting
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          analysis_score: primaryScore,
          score_source: this.scoreField,
          target_brand_share: this.extractTargetBrandShare(record),
          total_population: this.extractNumericValue(record, ['ECYPTAPOP', 'total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population']),
          median_income: this.extractNumericValue(record, ['ECYHRIAVG', 'median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])
        }
      };
  // Mirror canonical primary field into top-level and properties
  out[this.scoreField] = out.value;
  (out.properties as any)[this.scoreField] = primaryScore;
  (out.properties as any).score_source = this.scoreField;
      return out;
    });
    
    // Calculate statistics
    const statistics = this.calculateStatistics(processedRecords.map(r => r.value));
    
    // Rank records by analyze score
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate summary
    const summary = this.generateSummary(rankedRecords, statistics);

    const renderer = this.createRenderer(rankedRecords);
    const legend = this.createLegend(rankedRecords);
    
    return {
      type: 'analyze',
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
    console.log(`🎯 [ANALYZE RENDERER] Creating renderer for ${records.length} records`);
    
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Analyze colors: Blue gradient (low) -> Teal -> Yellow -> Red (high analysis score)
    const analyzeColors = [
      [44, 123, 182, 0.6],   // Dark blue (low analysis score)
      [171, 217, 233, 0.6],  // Light blue
      [255, 255, 191, 0.6],  // Light yellow
      [215, 25, 28, 0.6]     // Red (high analysis score)
    ];
    
    const classBreakInfos = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      classBreakInfos.push({
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1],
        symbol: {
          type: 'simple-fill',
          color: analyzeColors[i],
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
    
    const analyzeColors = [
      'rgba(44, 123, 182, 0.6)',   // Dark blue
      'rgba(171, 217, 233, 0.6)',  // Light blue
      'rgba(255, 255, 191, 0.6)',  // Light yellow
      'rgba(215, 25, 28, 0.6)'     // Red
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: analyzeColors[i],
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1]
      });
    }
    
    return {
      title: 'Analysis Score',
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
    
    // General analysis fields that might be available
  // Use hardcoded top field definitions
  const fieldDefinitions = getTopFieldDefinitions('analyze');
  // console.log(`[AnalyzeProcessor] Using hardcoded top field definitions for analyze`);
    
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

  private extractTargetBrandShare(record: any): number {
    // For general analysis, try to find brand share fields
    const brandShareFields = Object.keys(record).filter(key => 
      key.toLowerCase().includes('share') || key.includes('MP101')
    );
    
    if (brandShareFields.length > 0) {
      const value = Number(record[brandShareFields[0]]);
      return isNaN(value) ? 0 : value;
    }
    
    return 0; // No brand share data found
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
      'market': 'Market opportunity',
      'demographic': 'Demographic factors',
      'competitive': 'Competitive landscape',
      'economic': 'Economic indicators',
      'trend': 'Market trends'
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
    let summary = getScoreExplanationForAnalysis('analyze', 'analyze');
    
    summary += `**General Analysis Complete:** ${statistics.total} geographic markets evaluated for real estate investment insights. `;
    summary += `Analysis scores range from ${statistics.min.toFixed(1)} to ${statistics.max.toFixed(1)} (average: ${statistics.mean.toFixed(1)}). `;
    
    const topAreas = records.slice(0, 10);
    if (topAreas.length > 0) {
      summary += `**Top Scoring Areas:** `;
      const topNames = topAreas.map(r => `${r.area_name} (${r.value.toFixed(1)})`);
      summary += `${topNames.join(', ')}. `;
    }
    
    const highScoring = records.filter(r => r.value >= (statistics.percentile75 || statistics.mean)).length;
    summary += `**Analysis Insights:** ${highScoring} areas (${(highScoring/records.length*100).toFixed(1)}%) demonstrate high analysis scores indicating strong market opportunity. `;
    
    return summary;
  }
  // Remove extractFieldValue - use BaseProcessor extractNumericValue instead

}