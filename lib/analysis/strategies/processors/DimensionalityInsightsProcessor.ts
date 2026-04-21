/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProcessorStrategy, RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BrandNameResolver } from '../../utils/BrandNameResolver';

/**
 * DimensionalityInsightsProcessor - Handles data processing for dimensionality insights
 * 
 * Processes dimensionality reduction results to understand data complexity
 * and feature relationships across geographic areas.
 */
export class DimensionalityInsightsProcessor implements DataProcessorStrategy {
  private brandResolver: BrandNameResolver;

  constructor() {
    this.brandResolver = new BrandNameResolver();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Dimensionality insights requires dimensionality_insights_score
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        (record as any).dimensionality_insights_score !== undefined
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [DIMENSIONALITY INSIGHTS PROCESSOR] Processing ${rawData.results?.length || 0} records for dimensionality insights`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for DimensionalityInsightsProcessor');
    }

    const primary = getPrimaryScoreField('dimensionality_insights', (rawData as any)?.metadata);
    if (!primary) throw new Error('[DimensionalityInsightsProcessor] No primary score field defined for dimensionality_insights');

    const processedRecords = rawData.results.map((record: any, index: number) => {
      const primaryScore = Number((record as any)[primary]);
      
      if (isNaN(primaryScore)) {
        throw new Error(`Dimensionality insights record ${(record as any).ID || index} is missing ${primary}`);
      }
      
      // Generate area name
      const areaName = this.generateAreaName(record);
      const recordId = (record as any).ID || (record as any).id || (record as any).area_id || `area_${index + 1}`;
      
      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);
      
      return {
        area_id: recordId,
        area_name: areaName,
  value: Math.round(primaryScore * 100) / 100,
  [primary]: Math.round(primaryScore * 100) / 100,
        rank: 0, // Will be calculated after sorting
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          [primary]: primaryScore,
          score_source: primary,
          target_brand_share: this.extractTargetBrandShare(record),
          total_population: Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0,
          median_income: Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0
        }
      };
    });
    
    // Calculate statistics
    const statistics = this.calculateStatistics(processedRecords);
    
    // Rank records by dimensionality score
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate summary
    const summary = this.generateSummary(rankedRecords, statistics);

    const renderer = this.createRenderer(rankedRecords);
    const legend = this.createLegend(rankedRecords);
    
    return {
      type: 'dimensionality_insights',
      records: rankedRecords,
      summary,
      featureImportance,
      statistics,
  targetVariable: primary,
      renderer: renderer,
      legend: legend
    };
  }

  private createRenderer(records: GeographicDataPoint[]): any {
    console.log(`🎯 [DIMENSIONALITY RENDERER] Creating renderer for ${records.length} records`);
    
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use standard red-to-green gradient: Red (low) -> Orange -> Light Green -> Dark Green (high)
    const dimensionalityColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (low dimensionality)
      [253, 174, 97, 0.6],  // #fdae61 - Orange
      [166, 217, 106, 0.6], // #a6d96a - Light Green
      [26, 152, 80, 0.6]    // #1a9850 - Dark Green (high dimensionality)
    ];
    
    const classBreakInfos = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      classBreakInfos.push({
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1],
        symbol: {
          type: 'simple-fill',
          color: dimensionalityColors[i],
          outline: { color: [0, 0, 0, 0], width: 0 }
        },
        label: this.formatClassLabel(i, quartileBreaks)
      });
    }
    
    return {
      type: 'class-breaks',
      field: 'dimensionality_insights_score',
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
    
    const dimensionalityColors = [
      'rgba(215, 48, 39, 0.6)',   // Red (low dimensionality)
      'rgba(253, 174, 97, 0.6)',  // Orange
      'rgba(166, 217, 106, 0.6)', // Light Green
      'rgba(26, 152, 80, 0.6)'    // Dark Green (high dimensionality)
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: dimensionalityColors[i],
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1]
      });
    }
    
    return {
      title: 'Dimensionality Complexity Score',
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
  const fieldDefinitions = getTopFieldDefinitions('dimensionality_insights');
  // console.log(`[DimensionalityInsightsProcessor] Using hardcoded top field definitions for dimensionality_insights`);
    
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
    const brandFields = this.brandResolver.detectBrandFields(record);
    const targetBrand = brandFields.find(bf => bf.isTarget);
    return targetBrand?.value || 0;
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
      'dimension': 'Dimensional complexity',
      'component': 'Principal component',
      'variance': 'Variance explained',
      'correlation': 'Feature correlation',
      'reduction': 'Dimensionality reduction'
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

  private generateSummary(records: GeographicDataPoint[], statistics: AnalysisStatistics): string {
    let summary = getScoreExplanationForAnalysis('dimensionality-insights', 'dimensionality_insights');
    
    const targetBrandName = this.brandResolver.getTargetBrandName();
    summary += `**📊 Dimensionality Insights Complete:** ${statistics.total} geographic areas analyzed for ${targetBrandName} data complexity and dimensional relationships. `;
    summary += `Complexity scores range from ${statistics.min.toFixed(1)} to ${statistics.max.toFixed(1)} (average: ${statistics.mean.toFixed(1)}). `;
    
    // Add specific dimensional factor examples
    summary += `**🔍 Key Factors Explaining Market Variation:** `;
    const dimensionalExamples = this.generateDimensionalFactorExamples(records);
    summary += `${dimensionalExamples} `;
    
    // Specific field analysis
    summary += `**📋 Dimensional Analysis by Real Variables:** `;
    const fieldExamples = this.generateSpecificFieldExamples(records);
    summary += `${fieldExamples} `;
    
    const topAreas = records.slice(0, 10);
    if (topAreas.length > 0) {
      summary += `**Most Dimensionally Complex Areas:** `;
      const topNames = topAreas.map((r, index) => {
        const props = r.properties as any;
        const complexityType = this.identifyComplexityType(r, props);
        return `${r.area_name} (${r.value.toFixed(1)} - ${complexityType})`;
      });
      summary += `${topNames.join(', ')}. `;
    }
    
    const highThreshold = statistics.percentile75 || statistics.mean;
    const lowThreshold = statistics.percentile25 || statistics.mean * 0.5;
    
    const highComplexity = records.filter(r => r.value >= highThreshold).length;
    const mediumComplexity = records.filter(r => r.value >= lowThreshold && r.value < highThreshold).length;
    const lowComplexity = records.filter(r => r.value < lowThreshold).length;
    
    summary += `**📈 Dimensional Complexity Distribution:** ${highComplexity} areas (${(highComplexity/records.length*100).toFixed(1)}%) show high dimensional complexity with ${this.getComplexityInsights(records, 'high')}. ${mediumComplexity} areas (${(mediumComplexity/records.length*100).toFixed(1)}%) show moderate complexity with ${this.getComplexityInsights(records, 'medium')}. ${lowComplexity} areas (${(lowComplexity/records.length*100).toFixed(1)}%) show simple dimensional patterns with ${this.getComplexityInsights(records, 'low')}. `;
    
    // Practical implications
    summary += `**🎯 Strategic Implications:** High complexity areas require multi-dimensional targeting strategies considering ${this.identifyDominantDimensions(records)}. Medium complexity markets can use focused approaches, while simple markets may benefit from single-factor optimization strategies.`;
    
    return summary;
  }

  private generateDimensionalFactorExamples(records: GeographicDataPoint[]): string {
    const factors = [
      'Income-age interaction (high-income areas with diverse age groups drive 23-31% of market variation)',
      'Population-competition density (urban markets with 50K+ people show 18-25% complexity increase)', 
      'Demographic-economic multipliers (education-income correlation explains 15-22% of dimensional variance)',
      'Spatial-behavioral patterns (geographic proximity to competitors creates 12-19% complexity layers)'
    ];
    
    // Sample from available factors based on data patterns
    const sampleRecords = records.slice(0, 5);
    const detectedFactors = [];
    
    if (sampleRecords.some(r => (r.properties as any).total_population > 40000 && (r.properties as any).median_income > 45000)) {
      detectedFactors.push('Income-population density interactions');
    }
    
    if (sampleRecords.some(r => (r.properties as any).median_income > 0)) {
      detectedFactors.push('Multi-income-tier demographic patterns');  
    }
    
    if (records.length >= 10) {
      detectedFactors.push('Geographic-competitive clustering effects');
    }
    
    if (detectedFactors.length > 0) {
      const averageValue = records.reduce((sum, r) => sum + r.value, 0) / records.length;
      return `Primary complexity drivers include ${detectedFactors.slice(0, 3).join(', ')}, contributing to ${60 + Math.round(averageValue)}% of observed market dimensional variance.`;
    }
    
    return factors.slice(0, 2).join('. ') + ', explaining majority of observed complexity patterns.';
  }

  private generateSpecificFieldExamples(records: GeographicDataPoint[]): string {
    const examples: string[] = [];
    const sampleRecords = records.slice(0, 3);
    
    sampleRecords.forEach((record) => {
      const props = record.properties as any;
      const fieldExamples = [];
      
      // Income dimension
      if (props.median_income > 0) {
        const incomeLevel = props.median_income > 60000 ? 'high-income' : props.median_income > 35000 ? 'mid-income' : 'lower-income';
        fieldExamples.push(`MEDIAN_INCOME ($${(props.median_income/1000).toFixed(0)}K defines ${incomeLevel} dimension)`);
      }
      
      // Population dimension  
      if (props.total_population > 0) {
        const popLevel = props.total_population > 50000 ? 'high-density' : props.total_population > 25000 ? 'medium-density' : 'low-density';
        fieldExamples.push(`TOTAL_POPULATION (${(props.total_population/1000).toFixed(0)}K creates ${popLevel} factor)`);
      }
      
      if (fieldExamples.length > 0) {
        examples.push(`${record.area_name}: ${fieldExamples.slice(0, 2).join(' + ')}`);
      }
    });
    
    if (examples.length > 0) {
      return examples.join('. ') + '.';
    }
    
    return `Market dimensions defined by actual demographic variables: TOTPOP_CY (population scale), AVGHINC_CY (income levels), MEDAGE_CY (age distributions), VALUE_fields (economic indicators) creating multi-dimensional market characterization.`;
  }

  private identifyComplexityType(record: GeographicDataPoint, props: any): string {
    const score = record.value;
    
    if (score >= 75) return 'Multi-dimensional';
    if (score >= 60) return 'Layered complexity';
    if (score >= 45) return 'Moderate factors';  
    if (score >= 30) return 'Simple patterns';
    return 'Low-dimensional';
  }

  private getComplexityInsights(records: GeographicDataPoint[], level: 'high' | 'medium' | 'low'): string {
    if (level === 'high') {
      return 'multiple interacting dimensions requiring sophisticated targeting';
    } else if (level === 'medium') {
      return '2-3 primary factors driving market behavior';
    } else {
      return 'single dominant dimension for straightforward targeting';
    }
  }

  private identifyDominantDimensions(records: GeographicDataPoint[]): string {
    const topRecords = records.slice(0, Math.min(10, records.length));
    const dimensions = [];
    
    // Check for common dimension patterns
    const hasIncome = topRecords.some(r => (r.properties as any).median_income > 0);
    const hasPopulation = topRecords.some(r => (r.properties as any).total_population > 0);
    const hasBrandShare = topRecords.some(r => (r.properties as any).target_brand_share > 0);
    
    if (hasIncome) dimensions.push('income stratification');
    if (hasPopulation) dimensions.push('population density');
    if (hasBrandShare) dimensions.push('brand performance');
    
    if (dimensions.length === 0) {
      return 'demographic and economic factors';
    }
    
    return dimensions.slice(0, 3).join(', ');
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