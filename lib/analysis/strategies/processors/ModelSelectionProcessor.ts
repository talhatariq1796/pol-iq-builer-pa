/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProcessorStrategy, RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BrandNameResolver } from '../../utils/BrandNameResolver';

/**
 * ModelSelectionProcessor - Handles data processing for model selection analysis
 * 
 * Processes algorithm category data to understand which modeling approaches
 * work best for different geographic areas. Note: Uses 'algorithm_category' 
 * which is a string field, not a score.
 */
export class ModelSelectionProcessor implements DataProcessorStrategy {
  private brandResolver: BrandNameResolver;

  constructor() {
    this.brandResolver = new BrandNameResolver();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Model selection requires algorithm_category
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        (record as any).algorithm_category !== undefined
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [MODEL SELECTION PROCESSOR] Processing ${rawData.results?.length || 0} records for model selection analysis`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for ModelSelectionProcessor');
    }

    // Count algorithm categories to create numeric values for visualization
    const algorithmCounts = new Map<string, number>();
    rawData.results.forEach(record => {
      const category = (record as any).algorithm_category;
      if (category) {
        algorithmCounts.set(category, (algorithmCounts.get(category) || 0) + 1);
      }
    });

    // Create category to numeric mapping based on frequency (most common = highest value)
    const sortedCategories = Array.from(algorithmCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry, index) => [entry[0], index + 1]);
    const categoryMapping = new Map(sortedCategories as [string, number][]);

  // Resolve a primary numeric field for visualization (allow metadata override)
  const primaryField = getPrimaryScoreField('model_selection', (rawData as any)?.metadata) || 'algorithm_category';

  const processedRecords = rawData.results.map((record: any, index: number) => {
      const algorithmCategory = (record as any).algorithm_category;
      
      if (!algorithmCategory) {
        throw new Error(`Model selection record ${(record as any).ID || index} is missing algorithm_category`);
      }
      
      // Use category mapping for numeric value (for visualization)
      const numericValue = categoryMapping.get(algorithmCategory) || 0;
      
      // Generate area name
      const areaName = this.generateAreaName(record);
      const recordId = (record as any).ID || (record as any).id || (record as any).area_id || `area_${index + 1}`;
      
      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);
      
      const out: any = {
        area_id: recordId,
        area_name: areaName,
        value: numericValue, // Numeric value for visualization
        algorithm_category: algorithmCategory, // Original string value
        rank: 0, // Will be calculated after sorting
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          algorithm_category: algorithmCategory,
          score_source: primaryField,
          category_numeric: numericValue,
          [primaryField]: numericValue,
          target_brand_share: this.extractTargetBrandShare(record),
          total_population: Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0,
          median_income: Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0
        }
      };
      // Mirror primary numeric field to top-level if not algorithm_category
      if (primaryField && primaryField !== 'algorithm_category') {
        out[primaryField] = out.value;
      }
      return out;
    });
    
    // Calculate statistics based on numeric values
    const statistics = this.calculateStatistics(processedRecords);
    
    // Rank records by category frequency (most common categories ranked higher)
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate summary
    const summary = this.generateSummary(rankedRecords, statistics, algorithmCounts);

    const renderer = this.createRenderer(rankedRecords, categoryMapping, primaryField);
    const legend = this.createLegend(rankedRecords, categoryMapping, primaryField);
    
    return {
      type: 'model_selection',
      records: rankedRecords,
      summary,
      featureImportance,
      statistics,
      targetVariable: primaryField,
      renderer: renderer,
      legend: legend
    };
  }

  private createRenderer(records: GeographicDataPoint[], categoryMapping: Map<string, number>, primaryField?: string): any {
    console.log(`🎯 [MODEL SELECTION RENDERER] Creating renderer for ${records.length} records`);
    
    // Create unique value renderer based on algorithm categories
    const categories = Array.from(categoryMapping.keys());
    const colors = this.generateCategoryColors(categories.length);
    
    const uniqueValueInfos = categories.map((category, index) => ({
      value: category,
      symbol: {
        type: 'simple-fill',
        color: colors[index],
        outline: { color: [0, 0, 0, 0], width: 0 }
      },
      label: category
    }));
    
    return {
      type: 'unique-value',
      field: primaryField || 'algorithm_category',
      uniqueValueInfos,
      defaultSymbol: {
        type: 'simple-fill',
        color: [200, 200, 200, 0.5],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }
    };
  }

  private createLegend(records: GeographicDataPoint[], categoryMapping: Map<string, number>, primaryField?: string): any {
    const categories = Array.from(categoryMapping.keys());
    const colors = this.generateCategoryColors(categories.length);
    
    const legendItems = categories.map((category, index) => ({
      label: category,
      color: colors[index].map(c => c / 255).join(', '),
      category: category
    }));
    
    return {
      title: 'Algorithm Category',
      items: legendItems,
      position: 'bottom-right'
    };
  }

  private generateCategoryColors(count: number): number[][] {
    // Generate distinct colors for categories
    const baseColors = [
      [27, 158, 119, 0.6],   // Teal
      [217, 95, 2, 0.6],     // Orange
      [117, 112, 179, 0.6],  // Purple
      [231, 41, 138, 0.6],   // Pink
      [102, 166, 30, 0.6],   // Green
      [230, 171, 2, 0.6],    // Yellow
      [166, 118, 29, 0.6],   // Brown
      [102, 102, 102, 0.6]   // Gray
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }

  private getTopContributingFields(record: any): Record<string, number> {
    const contributingFields: Array<{field: string, value: number, importance: number}> = [];
    
  const fieldDefinitions = getTopFieldDefinitions('model_selection');
  // console.log('[ModelSelectionProcessor] Using hardcoded top field definitions for model_selection');
    
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
    // Rank by category frequency (higher numeric value = more common category)
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
      'algorithm': 'Algorithm selection',
      'model': 'Model type influence',
      'accuracy': 'Accuracy importance',
      'complexity': 'Model complexity',
      'interpretability': 'Model interpretability'
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

  private generateSummary(records: GeographicDataPoint[], statistics: AnalysisStatistics, algorithmCounts: Map<string, number>): string {
    let summary = getScoreExplanationForAnalysis('model-selection', 'algorithm_category');
    
    const targetBrandName = this.brandResolver.getTargetBrandName();
    summary += `**Model Selection Analysis Complete:** ${statistics.total} geographic areas analyzed for ${targetBrandName} optimal algorithm selection. `;
    
    // Algorithm distribution
    const totalCategories = algorithmCounts.size;
    summary += `${totalCategories} different algorithm categories identified across areas. `;
    
    // Most common algorithm
    const sortedAlgorithms = Array.from(algorithmCounts.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedAlgorithms.length > 0) {
      const [topAlgorithm, count] = sortedAlgorithms[0];
      summary += `**Most Effective Algorithm:** ${topAlgorithm} works best in ${count} areas (${(count/records.length*100).toFixed(1)}%). `;
    }
    
    // Algorithm diversity
    if (sortedAlgorithms.length > 1) {
      summary += `**Algorithm Diversity:** Areas show varying optimal algorithms: `;
      const topThree = sortedAlgorithms.slice(0, 3).map(([alg, cnt]) => `${alg} (${cnt} areas)`);
      summary += `${topThree.join(', ')}. `;
    }
    
    return summary;
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