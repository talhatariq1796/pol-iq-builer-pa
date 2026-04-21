/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BaseProcessor } from './BaseProcessor';

/**
 * SpatialClustersProcessor - Handles data processing for spatial cluster analysis
 * 
 * Processes spatial clustering results to identify geographic patterns
 * and housing market concentration across Quebec regions.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class SpatialClustersProcessor extends BaseProcessor {
  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Spatial clusters requires cluster_score
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        (record as any).cluster_score !== undefined
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [SPATIAL CLUSTERS PROCESSOR] Processing ${rawData.results?.length || 0} records for spatial cluster analysis`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for SpatialClustersProcessor');
    }

    const primary = getPrimaryScoreField('spatial_clusters', (rawData as any)?.metadata);
    if (!primary) throw new Error('[SpatialClustersProcessor] No primary score field defined for spatial_clusters');

    const processedRecords = rawData.results.map((record: any, index: number) => {
      // Extract cluster score directly using the hardcoded field
      const primaryScore = Number(record[primary]) || 0;
      
      if (isNaN(primaryScore)) {
        throw new Error(`Spatial clusters record ${this.extractGeographicId(record) || index} is missing primary metric`);
      }
      
      // Use BaseProcessor methods for area identification
      const areaName = this.generateAreaName(record);
      const recordId = this.extractGeographicId(record) || `area_${index + 1}`;
      
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
          housing_cluster_strength: this.extractHousingClusterStrength(record),
          total_population: this.extractNumericValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population']),
          median_income: this.extractNumericValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])
        }
      };
    });
    
    // Calculate statistics using BaseProcessor method
    const values = processedRecords.map(r => r.value).filter(v => !isNaN(v));
    const statistics = this.calculateStatistics(values);
    
    // Rank records by spatial cluster score using BaseProcessor method
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate summary
    const summary = this.generateSummary(rankedRecords, statistics);

    const renderer = this.createRenderer(rankedRecords);
    const legend = this.createLegend(rankedRecords);
    
    return {
      type: 'spatial_clusters',
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
    console.log(`🎯 [SPATIAL CLUSTERS RENDERER] Creating renderer for ${records.length} records`);
    
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Spatial cluster colors: Cyan (isolated) -> Blue -> Green -> Orange (clustered)
    const clusterColors = [
      [178, 223, 238, 0.6],  // Light cyan (isolated areas)
      [51, 160, 44, 0.6],    // Green
      [31, 120, 180, 0.6],   // Blue
      [255, 127, 0, 0.6]     // Orange (highly clustered)
    ];
    
    const classBreakInfos = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      classBreakInfos.push({
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1],
        symbol: {
          type: 'simple-fill',
          color: clusterColors[i],
          outline: { color: [0, 0, 0, 0], width: 0 }
        },
        label: this.formatClassLabel(i, quartileBreaks)
      });
    }
    
    // Use the canonical primary field name so downstream consumers see the expected field
    const primaryField = getPrimaryScoreField('spatial_clusters');
    return {
      type: 'class-breaks',
      field: primaryField || 'cluster_score',
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
    
    const clusterColors = [
      'rgba(178, 223, 238, 0.6)',  // Light cyan
      'rgba(51, 160, 44, 0.6)',    // Green
      'rgba(31, 120, 180, 0.6)',   // Blue
      'rgba(255, 127, 0, 0.6)'     // Orange
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: clusterColors[i],
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1]
      });
    }
    
    return {
      title: 'Spatial Clustering Score',
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
  const fieldDefinitions = getTopFieldDefinitions('spatial_clusters');
  // console.log(`[SpatialClustersProcessor] Using hardcoded top field definitions for spatial_clusters`);
    
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



  private processFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getFeatureDescription((item as any).feature || (item as any).name)
    })).sort((a, b) => b.importance - a.importance);
  }

  private getFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'cluster': 'Spatial clustering',
      'spatial': 'Spatial relationships',
      'autocorrelation': 'Spatial autocorrelation',
      'hotspot': 'Hotspot identification',
      'density': 'Cluster density'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} impact`;
  }


  private extractHousingClusterStrength(record: any): number {
    // Extract cluster score directly
    const primaryField = getPrimaryScoreField('spatial_clusters') || 'cluster_score';
    return Number(record[primaryField]) || 0;
  }

  private generateSummary(records: GeographicDataPoint[], statistics: AnalysisStatistics): string {
    let summary = getScoreExplanationForAnalysis('spatial-clusters', 'spatial_clusters');
    
    // Use configuration-driven terminology
    const terminology = this.configManager.getTerminology();
    summary += `**Spatial Clustering Analysis Complete:** ${statistics.total} ${terminology.entityType} analyzed for housing market spatial clustering patterns. `;
    summary += `Clustering scores range from ${statistics.min.toFixed(1)} to ${statistics.max.toFixed(1)} (average: ${statistics.mean.toFixed(1)}). `;
    
    const topAreas = records.slice(0, 10);
    if (topAreas.length > 0) {
      summary += `**Highest Clustering:** `;
      const topNames = topAreas.map(r => `${r.area_name} (${r.value.toFixed(1)})`);
      summary += `${topNames.join(', ')}. `;
    }
    
    const highClustering = records.filter(r => r.value >= (statistics.percentile75 || statistics.mean)).length;
    summary += `**Spatial Patterns:** ${highClustering} areas (${(highClustering/records.length*100).toFixed(1)}%) show significant spatial clustering effects. `;
    
    return summary;
  }

}