/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BaseProcessor } from './BaseProcessor';

/**
 * ConsensusAnalysisProcessor - Handles data processing for consensus analysis
 * 
 * Processes consensus scores to understand agreement across multiple
 * models or analysis approaches for real estate investment insights.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class ConsensusAnalysisProcessor extends BaseProcessor {
  private scoreField: string = 'consensus_analysis_score';

  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Consensus analysis requires consensus_analysis_score
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        (record as any).consensus_analysis_score !== undefined
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [CONSENSUS ANALYSIS PROCESSOR] Processing ${rawData.results?.length || 0} records for consensus analysis`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for ConsensusAnalysisProcessor');
    }

    // Determine primary score field deterministically from hardcoded defs; allow metadata override
    const primary = getPrimaryScoreField('consensus_analysis', (rawData as any)?.metadata);
    if (!primary) {
      throw new Error('[ConsensusAnalysisProcessor] No primary score field defined for consensus_analysis endpoint.');
    }
    this.scoreField = primary;

    const processedRecords = rawData.results.map((record: any, index: number) => {
      const primaryScore = Number((record as any)[this.scoreField]);
      
      if (isNaN(primaryScore)) {
        throw new Error(`Consensus analysis record ${(record as any).ID || index} is missing ${this.scoreField}`);
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
  [this.scoreField]: Math.round(primaryScore * 100) / 100,
        rank: 0, // Will be calculated after sorting
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          [this.scoreField]: primaryScore,
          score_source: this.scoreField,
          target_brand_share: this.extractTargetBrandShare(record),
          total_population: Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0,
          median_income: Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0
        }
      };
      if (this.scoreField && this.scoreField !== 'consensus_analysis_score') {
        out[this.scoreField] = out.value;
        (out.properties as any)[this.scoreField] = out.value;
      }
      return out;
    });
    
    // Calculate statistics
    const statistics = this.calculateStatistics(processedRecords.map(r => r.value));
    
    // Rank records by consensus score
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate summary
    const summary = this.generateSummary(rankedRecords, statistics);

    const renderer = this.createRenderer(rankedRecords);
    const legend = this.createLegend(rankedRecords);
    
    return {
      type: 'consensus_analysis',
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
    console.log(`🎯 [CONSENSUS RENDERER] Creating renderer for ${records.length} records`);
    
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use standard red-to-green gradient: Red (low) -> Orange -> Light Green -> Dark Green (high)
    const consensusColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (low consensus)
      [253, 174, 97, 0.6],  // #fdae61 - Orange
      [166, 217, 106, 0.6], // #a6d96a - Light Green
      [26, 152, 80, 0.6]    // #1a9850 - Dark Green (high consensus)
    ];
    
    const classBreakInfos = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      classBreakInfos.push({
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1],
        symbol: {
          type: 'simple-fill',
          color: consensusColors[i],
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
    
    const consensusColors = [
      'rgba(215, 48, 39, 0.6)',   // Red (low consensus)
      'rgba(253, 174, 97, 0.6)',  // Orange
      'rgba(166, 217, 106, 0.6)', // Light Green
      'rgba(26, 152, 80, 0.6)'    // Dark Green (high consensus)
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length - 1; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: consensusColors[i],
        minValue: quartileBreaks[i],
        maxValue: quartileBreaks[i + 1]
      });
    }
    
    return {
      title: 'Consensus Agreement Score',
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
  const fieldDefinitions = getTopFieldDefinitions('consensus_analysis');
  console.log(`[ConsensusAnalysisProcessor] Using hardcoded top field definitions for consensus_analysis`);
    
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

  private extractTargetBrandShare(record: any): number {
    const brandFields = (this as any).brandResolver?.detectBrandFields?.(record) || [];
    const targetBrand = brandFields.find((bf: any) => bf.isTarget);
    return targetBrand?.value || 0;
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
      'consensus': 'Model consensus',
      'agreement': 'Cross-model agreement',
      'confidence': 'Prediction confidence',
      'variance': 'Prediction variance',
      'reliability': 'Result reliability'
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
    let summary = getScoreExplanationForAnalysis('consensus-analysis', 'consensus_analysis');
    
    // Removed brand resolver dependency - now using BaseProcessor
    
    // Clear differentiation from ensemble analysis
    summary += `**🤝 Consensus Analysis vs Ensemble Analysis:** Consensus analysis measures **agreement across different analytical approaches** (strategic, competitive, demographic methods), while ensemble analysis measures **combined model performance** (ML algorithms working together). Consensus identifies where different analytical frameworks reach similar conclusions about market opportunities.

`;

    summary += `**📊 Cross-Method Consensus Analysis Complete:** ${statistics.total} geographic markets evaluated for real estate investment analytical agreement across multiple business intelligence approaches. `;
    summary += `Consensus scores range from ${statistics.min.toFixed(1)} to ${statistics.max.toFixed(1)} (average: ${statistics.mean.toFixed(1)}). `;
    
    // Add specific use cases
    summary += `**🎯 Unique Use Cases for Real Estate Consensus Analysis:** `;
    const useCaseExamples = this.generateUseCaseExamples(records);
    summary += `${useCaseExamples} `;
    
    // Specific consensus patterns
    summary += `**🔍 Analytical Method Agreement Patterns:** `;
    const consensusPatterns = this.generateConsensusPatterns(records);
    summary += `${consensusPatterns} `;
    
    const topAreas = records.slice(0, 10);
    if (topAreas.length > 0) {
      summary += `**Highest Cross-Method Consensus:** `;
      const topNames = topAreas.map(r => `${r.area_name} (${r.value.toFixed(1)} consensus score)`);
      summary += `${topNames.join(', ')}. `;
    }
    
    const highThreshold = statistics.percentile75 || statistics.mean;
    const lowThreshold = statistics.percentile25 || statistics.mean * 0.5;
    
    const highConsensus = records.filter(r => r.value >= highThreshold).length;
    const moderateConsensus = records.filter(r => r.value >= lowThreshold && r.value < highThreshold).length;
    const lowConsensus = records.filter(r => r.value < lowThreshold).length;
    
    summary += `**📈 Analytical Agreement Distribution:** ${highConsensus} areas (${(highConsensus/records.length*100).toFixed(1)}%) show high cross-method consensus where strategic, competitive, and demographic analyses align. ${moderateConsensus} areas (${(moderateConsensus/records.length*100).toFixed(1)}%) show partial agreement between 2-3 methods. ${lowConsensus} areas (${(lowConsensus/records.length*100).toFixed(1)}%) show analytical disagreement requiring deeper investigation. `;
    
    const strongConsensus = records.filter(r => r.value >= 80).length;
    if (strongConsensus > 0) {
      summary += `${strongConsensus} areas have exceptionally strong consensus (score ≥ 80), indicating high-confidence opportunities where all analytical approaches agree. `;
    }
    
    // Decision-making implications
    summary += `**🚀 Strategic Decision Making:** High-consensus areas offer low-risk investment opportunities with analytical validation. Moderate-consensus areas require focused analysis to resolve disagreements. Low-consensus areas present either hidden opportunities (if one method identifies unique value) or high-risk investments requiring additional validation.`;
    
    return summary;
  }

  private generateUseCaseExamples(records: GeographicDataPoint[]): string {
    const useCases = [
      'Investment validation (do strategic, competitive, and demographic analyses all recommend this market?)',
      'Risk assessment (are there analytical disagreements that indicate uncertainty?)',
      'Portfolio diversification (balance high-consensus safe bets with low-consensus high-potential areas)',
      'Resource allocation confidence (allocate more resources to markets with high analytical agreement)'
    ];
    
    // Determine primary use case based on consensus patterns
    const highConsensusCount = records.filter(r => r.value >= 75).length;
    const lowConsensusCount = records.filter(r => r.value <= 30).length;
    
    if (highConsensusCount > records.length * 0.3) {
      return `Primary application: **Investment validation** - ${highConsensusCount} markets show strong agreement across analytical methods, ideal for confident strategic decisions. Additional uses: ${useCases.slice(1, 3).join(', ')}.`;
    } else if (lowConsensusCount > records.length * 0.4) {
      return `Primary application: **Risk assessment** - ${lowConsensusCount} markets show analytical disagreements requiring investigation. Consider ${useCases[2]} and ${useCases[3]}.`;
    } else {
      return useCases.slice(0, 2).join('. ') + '. Balanced consensus distribution supports comprehensive strategic planning.';
    }
  }

  private generateConsensusPatterns(records: GeographicDataPoint[]): string {
    const patterns = [];
    
    // Strong consensus markets
    const strongConsensus = records.filter(r => r.value >= 75);
    if (strongConsensus.length >= 3) {
      const avgScore = strongConsensus.reduce((sum, r) => sum + r.value, 0) / strongConsensus.length;
      patterns.push(`${strongConsensus.length} markets show strong analytical alignment (avg ${avgScore.toFixed(1)}) where strategic opportunity + competitive advantage + demographic fit all agree`);
    }
    
    // Disagreement patterns
    const lowConsensus = records.filter(r => r.value <= 40);
    if (lowConsensus.length >= 3) {
      patterns.push(`${lowConsensus.length} markets have analytical disagreements potentially indicating either hidden opportunities or high-risk scenarios requiring deeper investigation`);
    }
    
    // Mixed signals
    const moderateConsensus = records.filter(r => r.value >= 50 && r.value <= 70);
    if (moderateConsensus.length >= 5) {
      patterns.push(`${moderateConsensus.length} markets show partial consensus suggesting 2 out of 3 analytical approaches align while requiring focused resolution of the disagreement`);
    }
    
    if (patterns.length > 0) {
      return patterns.slice(0, 2).join('. ') + '.';
    }
    
    return 'Analysis reveals mixed consensus patterns requiring case-by-case evaluation to understand analytical agreement sources.';
  }
}