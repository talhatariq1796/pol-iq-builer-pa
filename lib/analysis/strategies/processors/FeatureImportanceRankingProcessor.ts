/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProcessorStrategy, RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BrandNameResolver } from '../../utils/BrandNameResolver';

/**
 * FeatureImportanceRankingProcessor - Handles data processing for feature importance ranking
 * 
 * Processes feature importance rankings to understand which variables
 * contribute most to model predictions across geographic areas.
 */
export class FeatureImportanceRankingProcessor implements DataProcessorStrategy {
  private brandResolver: BrandNameResolver;
  // Prefer canonical mapping for primary score field
  private scoreField: string = 'feature_importance_ranking_score';

  constructor() {
    this.brandResolver = new BrandNameResolver();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    // Use canonical primary field (allow metadata override)
    const primary = getPrimaryScoreField('feature_importance_ranking', (rawData as any)?.metadata ?? undefined) || 'feature_importance_ranking_score';

    const hasRequiredFields = rawData.results.length === 0 ||
      rawData.results.some(record =>
        record &&
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        ((record as any)[primary] !== undefined)
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [FEATURE IMPORTANCE RANKING PROCESSOR] Processing ${rawData.results?.length || 0} records for feature importance ranking`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for FeatureImportanceRankingProcessor');
    }

  // Use canonical primary score field mapping (allows metadata override internally)
  this.scoreField = getPrimaryScoreField('feature_importance_ranking', (rawData as any)?.metadata ?? undefined) || 'feature_importance_ranking_score';

    const processedRecords = rawData.results.map((record: any, index: number) => {
  const primaryScore = Number((record as any)[this.scoreField]);
      
      if (isNaN(primaryScore)) {
        throw new Error(`Feature importance ranking record ${(record as any).ID || index} is missing ${this.scoreField}`);
      }
      
      // Generate area name
  const areaName = String(this.generateAreaName(record));
  const recordId = String((record as any).ID ?? (record as any).id ?? (record as any).area_id ?? `area_${index + 1}`);
      
      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);
      
      const out: any = {
        area_id: recordId,
        area_name: areaName,
        value: Math.round(primaryScore * 100) / 100,
        feature_importance_ranking_score: Math.round(primaryScore * 100) / 100,
        rank: 0, // Will be calculated after sorting
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          feature_importance_ranking_score: primaryScore,
          score_source: this.scoreField,
          target_brand_share: this.extractTargetBrandShare(record),
          total_population: Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0,
          median_income: Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0
        }
      };

      if (this.scoreField && this.scoreField !== 'feature_importance_ranking_score') {
        out[this.scoreField] = out.value;
        (out.properties as any)[this.scoreField] = out.value;
      }

      return out;
    });
    
  // Calculate statistics
    const statistics = this.calculateStatistics(processedRecords);
    
    // Rank records by feature importance score
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate summary
    const summary = this.generateSummary(rankedRecords, statistics);

    const renderer = this.createRenderer(rankedRecords);
    const legend = this.createLegend(rankedRecords);
    
    return {
      type: 'feature_importance_ranking',
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
    console.log(`🎯 [FEATURE IMPORTANCE RENDERER] Creating renderer for ${records.length} records`);
    
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use standard red-to-green gradient: Red (low) -> Orange -> Light Green -> Dark Green (high)
    const importanceColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (low importance)
      [253, 174, 97, 0.6],  // #fdae61 - Orange
      [166, 217, 106, 0.6], // #a6d96a - Light Green
      [26, 152, 80, 0.6]    // #1a9850 - Dark Green (high importance)
    ];
    
    const classBreakInfos = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      classBreakInfos.push({
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1],
        symbol: {
          type: 'simple-fill',
          color: importanceColors[i],
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
    
    const importanceColors = [
      'rgba(215, 48, 39, 0.6)',   // Red (low importance)
      'rgba(253, 174, 97, 0.6)',  // Orange
      'rgba(166, 217, 106, 0.6)', // Light Green
      'rgba(26, 152, 80, 0.6)'    // Dark Green (high importance)
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: importanceColors[i],
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1]
      });
    }
    
    return {
      title: 'Feature Importance Score',
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
  const fieldDefinitions = getTopFieldDefinitions('feature_importance_ranking');
  console.log(`[FeatureImportanceRankingProcessor] Using hardcoded top field definitions for feature_importance_ranking`);
    
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

  /**
   * Process feature importance with proper filtering and deduplication
   */
  private processFeatureImportance(rawFeatureImportance: any[]): any[] {
    if (!rawFeatureImportance || rawFeatureImportance.length === 0) {
      return [];
    }

    // Filter out thematic/meta fields and target variables
    const validFeatures = rawFeatureImportance.filter(item => {
      const featureName = (item as any).feature || (item as any).name || '';
      const lowerName = featureName.toLowerCase();
      
      // Exclude thematic/meta fields
      const thematicFields = [
        'theme', 'category', 'type', 'classification', 'group',
        'segment', 'cluster', 'label', 'status', 'flag', 'indicator'
      ];
      
      // Exclude target variables (should not be in feature importance)
      const targetFields = [
        'target', 'prediction', 'output', 'result', 'score', 'ranking',
        'nike', 'brand', 'market_share', 'h&r_block', 'turbotax'
      ];
      
      // Exclude meta fields
      const metaFields = [
        'id', 'area_id', 'geoid', 'objectid', 'description', 'name', 
        'coordinates', 'geometry', 'shape', 'area_name'
      ];
      
      const isThematic = thematicFields.some(field => lowerName.includes(field));
      const isTarget = targetFields.some(field => lowerName.includes(field));
      const isMeta = metaFields.some(field => lowerName === field || lowerName.includes(`_${field}`) || lowerName.includes(`${field}_`));
      
      return !isThematic && !isTarget && !isMeta && featureName.length > 0;
    });

    // Convert to standard format and deduplicate by score
    const processedFeatures = validFeatures.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getFeatureDescription((item as any).feature || (item as any).name)
    }));

    // Deduplicate by score (keep highest importance for duplicate scores)
    const scoreMap = new Map<number, any>();
    processedFeatures.forEach(feature => {
      const existingFeature = scoreMap.get(feature.importance);
      if (!existingFeature || feature.feature.length > existingFeature.feature.length) {
        scoreMap.set(feature.importance, feature);
      }
    });

    // Sort by importance and validate field names
    const deduplicatedFeatures = Array.from(scoreMap.values())
      .filter(feature => feature.importance > 0) // Remove zero importance
      .sort((a, b) => b.importance - a.importance);

    console.log(`[FeatureImportanceRankingProcessor] Processed ${rawFeatureImportance.length} raw features -> ${deduplicatedFeatures.length} valid features`);
    
    return deduplicatedFeatures;
  }

  /**
   * Get feature description for common field names
   */
  private getFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'total_population': 'Total population in the area',
      'totpop_cy': 'Current year total population',
      'median_income': 'Median household income',
      'avghinc_cy': 'Average household income',
      'meddi_cy': 'Median disposable income',
      'age': 'Age-related demographics',
      'medage_cy': 'Median age',
      'white_cy': 'White population percentage',
      'black_cy': 'Black population percentage',
      'asian_cy': 'Asian population percentage',
      'hispanic_cy': 'Hispanic population percentage',
      'educ': 'Education levels',
      'employment': 'Employment statistics',
      'housing': 'Housing characteristics',
      'density': 'Population density',
      'urbanization': 'Urban/rural classification',
      'economic': 'Economic indicators',
      'competition': 'Competitive landscape factors',
      'accessibility': 'Market accessibility measures'
    };
    
    const lowerName = featureName.toLowerCase();
    
    // Check for direct matches
    if (descriptions[lowerName]) {
      return descriptions[lowerName];
    }
    
    // Check for partial matches
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key) || key.includes(lowerName)) {
        return desc;
      }
    }
    
    // Generate description based on field name patterns
    if (lowerName.includes('pop')) return 'Population-related metric';
    if (lowerName.includes('income') || lowerName.includes('hinc')) return 'Income-related metric';
    if (lowerName.includes('age')) return 'Age demographic factor';
    if (lowerName.includes('race') || lowerName.includes('ethnic')) return 'Ethnic/racial demographic';
    if (lowerName.includes('edu')) return 'Education-related factor';
    if (lowerName.includes('employ')) return 'Employment-related metric';
    if (lowerName.includes('hous')) return 'Housing characteristic';
    if (lowerName.includes('dens')) return 'Density measure';
    if (lowerName.includes('urban') || lowerName.includes('rural')) return 'Urban/rural factor';
    if (lowerName.includes('econ')) return 'Economic indicator';
    if (lowerName.includes('comp')) return 'Competitive factor';
    if (lowerName.includes('access')) return 'Accessibility measure';
    if (lowerName.includes('value') || lowerName.includes('_cy')) return 'Calculated demographic value';
    
    return `${featureName} importance factor`;
  }

  private generateSummary(records: GeographicDataPoint[], statistics: AnalysisStatistics): string {
    let summary = getScoreExplanationForAnalysis('feature-importance-ranking', 'feature_importance_ranking');
    
    const targetBrandName = this.brandResolver.getTargetBrandName();
    summary += `**Feature Importance Ranking Complete:** ${statistics.total} geographic areas analyzed for ${targetBrandName} variable importance. `;
    summary += `Importance scores range from ${statistics.min.toFixed(1)} to ${statistics.max.toFixed(1)} (average: ${statistics.mean.toFixed(1)}). `;
    
    const topAreas = records.slice(0, 10);
    if (topAreas.length > 0) {
      summary += `**Highest Feature Importance:** `;
      const topNames = topAreas.map(r => `${r.area_name} (${r.value.toFixed(1)})`);
      summary += `${topNames.join(', ')}. `;
    }
    
    const highImportance = records.filter(r => r.value >= (statistics.percentile75 || statistics.mean)).length;
    summary += `**Variable Significance:** ${highImportance} areas (${(highImportance/records.length*100).toFixed(1)}%) show high feature importance rankings. `;
    
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