/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProcessorStrategy, RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BrandNameResolver } from '../../utils/BrandNameResolver';

/**
 * SensitivityAnalysisProcessor - Handles data processing for sensitivity analysis
 * 
 * Processes sensitivity analysis to understand how changes in key variables
 * affect model predictions and market outcomes.
 */
export class SensitivityAnalysisProcessor implements DataProcessorStrategy {
  private brandResolver: BrandNameResolver;

  constructor() {
    this.brandResolver = new BrandNameResolver();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Get configured primary field (supporting metadata override)
    const primaryField = getPrimaryScoreField('sensitivity-analysis', (rawData as any)?.metadata);
    
    // Sensitivity analysis requires either configured primary field or legacy sensitivity_analysis_score
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        ((record as any)[primaryField] !== undefined || (record as any).sensitivity_analysis_score !== undefined)
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [SENSITIVITY ANALYSIS PROCESSOR] Processing ${rawData.results?.length || 0} records for sensitivity analysis`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for SensitivityAnalysisProcessor');
    }

    // Resolve canonical primary score for sensitivity analysis (allow metadata override)
    const primaryField = getPrimaryScoreField('sensitivity_analysis', (rawData as any)?.metadata) || 'sensitivity_analysis_score';

  const processedRecords = rawData.results.map((record: any, index: number) => {
      const primaryScore = Number((record as any)[primaryField] ?? (record as any).sensitivity_analysis_score);
      
      if (isNaN(primaryScore)) {
        throw new Error(`Sensitivity analysis record ${(record as any).ID || index} is missing sensitivity_analysis_score`);
      }
      
      // Generate area name
      const areaName = this.generateAreaName(record);
      const recordId = (record as any).ID || (record as any).id || (record as any).area_id || `area_${index + 1}`;
      
      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);
      
      const out: any = {
        area_id: recordId,
        area_name: areaName,
        value: Math.round(primaryScore * 100) / 100,
        rank: 0, // Will be calculated after sorting
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          [primaryField]: primaryScore,
          score_source: primaryField,
          target_brand_share: this.extractTargetBrandShare(record),
          total_population: Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0,
          median_income: Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0
        }
      };
      // Mirror canonical field into top-level if not the default key
      if (primaryField && primaryField !== 'sensitivity_analysis_score') {
        out[primaryField] = out.value;
      }
      return out;
  });
    
    // Calculate statistics
    const statistics = this.calculateStatistics(processedRecords);
    
    // Rank records by sensitivity score
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate summary
    const summary = this.generateSummary(rankedRecords, statistics);

    const renderer = this.createRenderer(rankedRecords);
    const legend = this.createLegend(rankedRecords);
    
    return {
      type: 'sensitivity_analysis',
      records: rankedRecords,
      summary,
      featureImportance,
      statistics,
      targetVariable: primaryField,
      renderer: renderer,
      legend: legend
    };
  }

  private createRenderer(records: GeographicDataPoint[]): any {
    console.log(`🎯 [SENSITIVITY RENDERER] Creating renderer for ${records.length} records`);
    
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Sensitivity colors: Blue (low sensitivity) -> Green -> Yellow -> Red (high sensitivity)
    const sensitivityColors = [
      [49, 130, 189, 0.6],   // Blue (low sensitivity)
      [116, 196, 118, 0.6],  // Green
      [255, 255, 153, 0.6],  // Yellow
      [215, 48, 39, 0.6]     // Red (high sensitivity)
    ];
    
    const classBreakInfos = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      classBreakInfos.push({
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1],
        symbol: {
          type: 'simple-fill',
          color: sensitivityColors[i],
          outline: { color: [0, 0, 0, 0], width: 0 }
        },
        label: this.formatClassLabel(i, quartileBreaks)
      });
    }
    
    return {
      type: 'class-breaks',
      field: 'sensitivity_analysis_score',
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
    
    const sensitivityColors = [
      'rgba(49, 130, 189, 0.6)',   // Blue
      'rgba(116, 196, 118, 0.6)',  // Green
      'rgba(255, 255, 153, 0.6)',  // Yellow
      'rgba(215, 48, 39, 0.6)'     // Red
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: sensitivityColors[i],
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1]
      });
    }
    
    return {
      title: 'Sensitivity Score',
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
    
    // Use dynamic field detection instead of hardcoded mappings
  const fieldDefinitions = getTopFieldDefinitions('sensitivity_analysis');
  console.log(`[SensitivityAnalysisProcessor] Using hardcoded top field definitions for sensitivity_analysis`);
    
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

  private generateAreaName(record: any): string {
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

  private rankRecords(records: GeographicDataPoint[]): GeographicDataPoint[] {
    const sorted = [...records].sort((a, b) => b.value - a.value);
    return sorted.map((record, index) => ({
      ...record,
      rank: index + 1
    }));
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
      'sensitivity': 'Parameter sensitivity',
      'elasticity': 'Variable elasticity',
      'volatility': 'Market volatility',
      'stability': 'Model stability',
      'parameter': 'Parameter influence'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} impact`;
  }

  private calculateStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
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
    const brandFields = this.brandResolver.detectBrandFields(record);
    const targetBrand = brandFields.find(bf => bf.isTarget);
    return targetBrand?.value || 0;
  }

  private generateSummary(records: GeographicDataPoint[], statistics: AnalysisStatistics): string {
    let summary = getScoreExplanationForAnalysis('sensitivity-analysis', 'sensitivity_analysis');
    
    const targetBrandName = this.brandResolver.getTargetBrandName();
    
    // Enhanced differentiation from scenario analysis
    summary += `**🎯 Sensitivity vs Scenario Analysis Distinction:** This analysis focuses on **parameter sensitivity** - how changes in specific input variables (income weights, demographic coefficients, market factors) affect model predictions and outcomes. Unlike scenario analysis which evaluates market adaptability to external events, sensitivity analysis measures model stability and identifies which parameters most influence results.

`;

    summary += `**📊 Parameter Sensitivity Analysis Complete:** ${statistics.total} geographic areas analyzed for ${targetBrandName} model parameter sensitivity. `;
    summary += `Sensitivity scores range from ${statistics.min.toFixed(1)} to ${statistics.max.toFixed(1)} (average: ${statistics.mean.toFixed(1)}). `;
    
    // Focus on specific parameter impacts
    summary += `**🔧 Parameter Impact Analysis:** `;
    const parameterExamples = this.generateParameterImpactExamples(records);
    summary += `${parameterExamples} `;
    
    const topAreas = records.slice(0, 10);
    if (topAreas.length > 0) {
      summary += `**Most Parameter-Sensitive Areas:** `;
      const topNames = topAreas.map(r => `${r.area_name} (${r.value.toFixed(1)})`);
      summary += `${topNames.join(', ')}. `;
    }
    
    // Model stability assessment
    const highSensitivity = records.filter(r => r.value >= (statistics.percentile75 || statistics.mean)).length;
    const lowSensitivity = records.filter(r => r.value <= (statistics.percentile25 || statistics.mean)).length;
    
    summary += `**🔬 Model Stability Assessment:** ${highSensitivity} areas (${(highSensitivity/records.length*100).toFixed(1)}%) show high parameter sensitivity indicating volatile predictions when inputs change. ${lowSensitivity} areas (${(lowSensitivity/records.length*100).toFixed(1)}%) show low sensitivity indicating stable, robust predictions. `;
    
    // Specific parameter recommendations
    summary += `**⚙️ Parameter Optimization Recommendations:** `;
    if (highSensitivity > records.length * 0.3) {
      summary += `High sensitivity in ${highSensitivity} areas suggests model parameters need careful calibration. Consider reducing weight variations and using confidence intervals. `;
    } else {
      summary += `Moderate sensitivity indicates well-calibrated model parameters. Focus optimization on ${highSensitivity} high-sensitivity areas. `;
    }
    
    // Differentiate from scenario analysis
    summary += `**Key Difference:** While scenario analysis evaluates "what if external conditions change?", sensitivity analysis answers "what if we adjust our model parameters by X%?" This distinction is crucial for model validation and parameter tuning vs business scenario planning.`;
    
    return summary;
  }

  private generateParameterImpactExamples(records: GeographicDataPoint[]): string {
    // Sample parameter impacts from top sensitive areas
    const examples: string[] = [];
    const sampleRecords = records.slice(0, 3);
    
    sampleRecords.forEach((record, index) => {
      const props = record.properties as any;
      
      // Income weight sensitivity example
      if (props.median_income > 0) {
        const incomeLevel = props.median_income > 55000 ? 'High' : props.median_income > 35000 ? 'Moderate' : 'Lower';
        examples.push(`${incomeLevel}-income areas like ${record.area_name}: 20% income weight change = ${(record.value * 0.2).toFixed(1)}% prediction change`);
      }
      
      // Population parameter sensitivity
      if (props.total_population > 0 && index < 2) {
        const popLevel = props.total_population > 50000 ? 'high-density' : 'moderate-density';
        examples.push(`${popLevel} markets: Population coefficient adjustment impacts predictions by ${(record.value * 0.15).toFixed(1)}%`);
      }
    });
    
    if (examples.length > 0) {
      return examples.slice(0, 2).join('. ') + '.';
    }
    
    const avgValue = records.reduce((sum, r) => sum + r.value, 0) / records.length;
    return `Parameter adjustments of 20% typically change predictions by ${avgValue * 0.2 >= 20 ? 'significant' : 'moderate'} amounts (avg ${(avgValue * 0.2).toFixed(1)}% per market).`;
  }
  /**
   * Extract field value from multiple possible field names
   */
  private extractFieldValue(record: any, fieldNames: string[]): number {
    for (const fieldName of fieldNames) {
      const value = Number(record[fieldName]);
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }
    return 0;
  }

}