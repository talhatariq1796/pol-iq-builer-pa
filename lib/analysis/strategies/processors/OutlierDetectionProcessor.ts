/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProcessorStrategy, RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getPrimaryScoreField } from './HardcodedFieldDefs';

/**
 * OutlierDetectionProcessor - Handles data processing for the /outlier-detection endpoint
 * 
 * Processes outlier detection results with focus on identifying geographic areas with 
 * exceptional performance or characteristics that stand out significantly from typical patterns.
 */
export class OutlierDetectionProcessor implements DataProcessorStrategy {
  private scoreField: string = 'outlier_score';
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have expected fields for outlier detection
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        ((record as any).outlier_score !== undefined || 
         (record as any).value !== undefined || 
         (record as any).score !== undefined ||
         // Check for outlier-relevant fields
         (record as any).value_MP30034A_B_P !== undefined || // Nike market share (raw format)
         (record as any).mp30034a_b_p !== undefined || // Nike market share for outlier analysis
         (record as any).strategic_value_score !== undefined ||
         (record as any).value_TOTPOP_CY !== undefined || // Total population (raw format)
         (record as any).total_population !== undefined ||
         (record as any).value_MEDDI_CY !== undefined || // Median income (raw format)
         (record as any).median_income !== undefined)
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🎯 [OUTLIER DETECTION PROCESSOR] CALLED WITH ${rawData.results?.length || 0} RECORDS 🎯`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for OutlierDetectionProcessor');
    }

    // Determine primary score field deterministically from hardcoded definitions.
    // Allow incoming metadata.targetVariable to override when present.
  const primary = getPrimaryScoreField('outlier_detection', (rawData as any)?.metadata);
    if (!primary) {
      throw new Error('[OutlierDetectionProcessor] No primary score field defined for outlier_detection endpoint.');
    }
    this.scoreField = primary;

    // Process records with outlier detection scoring priority
    const processedRecords = rawData.results.map((record: any, index: number) => {
  // PRIORITIZE defined primary score field
  const outlierScore = this.extractOutlierScore(record);
      
      // Generate area name from ID and location data
      const areaName = this.generateAreaName(record);
      
      // Extract ID (updated for correlation_analysis format)
      const recordId = (record as any).ID || (record as any).id || (record as any).area_id;
      
      // Debug logging for records with missing ID
      if (!recordId) {
        console.warn(`[OutlierDetectionProcessor] Record ${index} missing ID:`, {
          hasID: 'ID' in record,
          hasId: 'id' in record,
          hasAreaId: 'area_id' in record,
          recordKeys: Object.keys(record as any).slice(0, 10)
        });
      }
      
      // Extract outlier-relevant metrics for properties
  const nikeShare = Number((record as any).mp30034a_b_p || (record as any).value_MP30034A_B_P) || 0;
      const strategicScore = Number((record as any).strategic_value_score) || 0;
      const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
      const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
      const trendScore = Number((record as any).trend_strength_score) || 0;
      const correlationScore = Number((record as any).correlation_strength_score) || 0;
      const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
      const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
      
      // Calculate outlier indicators
      const statisticalOutlierLevel = this.calculateStatisticalOutlierLevel(record);
      const performanceExtremeLevel = this.calculatePerformanceExtremeLevel(record);
      const contextualUniquenessLevel = this.calculateContextualUniquenessLevel(record);
      const rarityLevel = this.calculateRarityLevel(record);
      
      const out: any = {
        area_id: recordId || `area_${index + 1}`,
        area_name: areaName,
        value: Math.round(outlierScore * 100) / 100, // Use outlier score as primary value
        outlier_score: Math.round(outlierScore * 100) / 100, // Add target variable at top level
        rank: 0, // Will be calculated after sorting
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          outlier_score: outlierScore,
          score_source: this.scoreField,
          nike_market_share: nikeShare,
          strategic_score: strategicScore,
          competitive_score: competitiveScore,
          demographic_score: demographicScore,
          trend_score: trendScore,
          correlation_score: correlationScore,
          total_population: totalPop,
          median_income: medianIncome,
          // Outlier-specific calculated properties
          statistical_outlier_level: statisticalOutlierLevel,
          performance_extreme_level: performanceExtremeLevel,
          contextual_uniqueness_level: contextualUniquenessLevel,
          rarity_level: rarityLevel,
          outlier_category: this.getOutlierCategory(outlierScore),
          outlier_type: this.identifyOutlierType(record),
          extreme_characteristics: this.identifyExtremeCharacteristics(record)
        }
      };
  if (this.scoreField && this.scoreField !== 'outlier_score') {
        out[this.scoreField] = out.value;
        (out.properties as any)[this.scoreField] = out.value;
      }
      return out;
    });
    
    // Calculate comprehensive statistics
    const statistics = this.calculateOutlierStatistics(processedRecords);
    
    // Rank records by outlier detection score (highest outliers first)
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance with outlier focus
    const featureImportance = this.processOutlierFeatureImportance(rawData.feature_importance || []);
    
    // Generate outlier-focused summary
    const summary = this.generateOutlierSummary(rankedRecords, statistics, rawData.summary);

    return {
      type: 'outlier_detection', // Outlier detection type for exceptional area insights
      records: rankedRecords,
      summary,
      featureImportance,
      statistics,
      targetVariable: this.scoreField, // Primary ranking by outlier strength
      renderer: this.createOutlierRenderer(rankedRecords), // Add direct renderer
      legend: this.createOutlierLegend(rankedRecords) // Add direct legend
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  /**
   * Extract outlier detection score from record with fallback calculation
   */
  private extractOutlierScore(record: any): number {
    if ((record as any).outlier_score !== undefined && (record as any).outlier_score !== null) {
      const preCalculatedScore = Number((record as any).outlier_score);
      console.log(`🎯 [OutlierDetectionProcessor] Using pre-calculated outlier score: ${preCalculatedScore}`);
      return preCalculatedScore;
    }
    
    // FALLBACK: Calculate outlier score from available data
    console.log('⚠️ [OutlierDetectionProcessor] No outlier_score found, calculating from raw data');
    
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p || (record as any).value_MP30034A_B_P) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
    
    // Simple outlier calculation based on extreme values
    let outlierScore = 0;
    
    // Extreme strategic performance
    if (strategicScore >= 70 || strategicScore <= 30) {
      outlierScore += 25; // Extreme strategic scores
    }
    
    // Extreme Nike share
    if (nikeShare >= 35 || (nikeShare > 0 && nikeShare <= 10)) {
      outlierScore += 20; // Very high or very low Nike share
    }
    
    // Extreme population
    if (totalPop >= 150000 || (totalPop > 0 && totalPop <= 2000)) {
      outlierScore += 20; // Very large or very small population
    }
    
    // Extreme income
    if (medianIncome >= 150000 || (medianIncome > 0 && medianIncome <= 25000)) {
      outlierScore += 15; // Very high or very low income
    }
    
    // Income-population context outlier
    if (totalPop > 80000 && medianIncome < 35000) {
      outlierScore += 10; // Large population but low income
    } else if (totalPop < 5000 && medianIncome > 120000) {
      outlierScore += 10; // Small population but high income
    }
    
    // Rare high performance combination
    if (strategicScore >= 65 && nikeShare >= 30) {
      outlierScore += 10; // Rare high combination
    }
    
    return Math.min(100, outlierScore);
  }

  /**
   * Calculate statistical outlier level based on deviations
   */
  private calculateStatisticalOutlierLevel(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
    
    let statisticalLevel = 0;
    
    // Strategic score deviation (assume population mean ~50, std ~15)
    if (strategicScore > 0) {
      const strategicZScore = Math.abs(strategicScore - 50) / 15;
      if (strategicZScore >= 2.5) statisticalLevel += 25; // 2.5+ sigma outlier
      else if (strategicZScore >= 2.0) statisticalLevel += 20; // 2+ sigma outlier
      else if (strategicZScore >= 1.5) statisticalLevel += 10; // 1.5+ sigma outlier
    }
    
    // Nike share deviation (assume mean ~22, std ~8)
    if (nikeShare > 0) {
      const nikeZScore = Math.abs(nikeShare - 22) / 8;
      if (nikeZScore >= 2.5) statisticalLevel += 25;
      else if (nikeZScore >= 2.0) statisticalLevel += 20;
      else if (nikeZScore >= 1.5) statisticalLevel += 10;
    }
    
    // Population deviation (log scale for population)
    if (totalPop > 0) {
      const logPop = Math.log(totalPop);
      const logPopZScore = Math.abs(logPop - 10.5) / 1.5; // Approximate log population stats
      if (logPopZScore >= 2.0) statisticalLevel += 20;
      else if (logPopZScore >= 1.5) statisticalLevel += 15;
    }
    
    // Income deviation (assume mean ~60K, std ~25K)
    if (medianIncome > 0) {
      const incomeZScore = Math.abs(medianIncome - 60000) / 25000;
      if (incomeZScore >= 2.5) statisticalLevel += 30;
      else if (incomeZScore >= 2.0) statisticalLevel += 25;
      else if (incomeZScore >= 1.5) statisticalLevel += 15;
    }
    
    return Math.min(100, statisticalLevel);
  }

  /**
   * Calculate performance extreme level
   */
  private calculatePerformanceExtremeLevel(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    
    let extremeLevel = 0;
    
    // Strategic performance extremes
    if (strategicScore >= 70) {
      extremeLevel += 30; // Extremely high strategic performance
    } else if (strategicScore > 0 && strategicScore <= 30) {
      extremeLevel += 25; // Extremely low strategic performance
    }
    
    // Nike share extremes
    if (nikeShare >= 40) {
      extremeLevel += 25; // Extremely high Nike share
    } else if (nikeShare > 0 && nikeShare <= 8) {
      extremeLevel += 20; // Extremely low Nike share
    }
    
    // Demographic extremes
    if (demographicScore >= 95) {
      extremeLevel += 20; // Extremely high demographic opportunity
    } else if (demographicScore > 0 && demographicScore <= 30) {
      extremeLevel += 15; // Extremely low demographic opportunity
    }
    
    // Population extremes
    if (totalPop >= 200000) {
      extremeLevel += 15; // Extremely large population
    } else if (totalPop > 0 && totalPop <= 1000) {
      extremeLevel += 15; // Extremely small population
    }
    
    return Math.min(100, extremeLevel);
  }

  /**
   * Calculate contextual uniqueness level
   */
  private calculateContextualUniquenessLevel(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
    const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
    
    let uniquenessLevel = 0;
    
    // Income-population context uniqueness
    if (totalPop > 80000 && medianIncome < 35000) {
      uniquenessLevel += 25; // Large population but low income (contextually unique)
    } else if (totalPop < 8000 && medianIncome > 120000) {
      uniquenessLevel += 25; // Small population but high income (contextually unique)
    }
    
    // Strategic vs Nike share context uniqueness
    if (strategicScore > 65 && nikeShare < 15) {
      uniquenessLevel += 20; // High strategic potential but low Nike presence
    } else if (strategicScore < 40 && nikeShare > 30) {
      uniquenessLevel += 20; // Low strategic score but high Nike presence
    }
    
    // Data completeness context uniqueness
    if (strategicScore > 60 && competitiveScore === 0) {
      uniquenessLevel += 15; // High strategic but missing competitive data
    }
    
    // Urban vs suburban income patterns
    if (totalPop > 100000 && medianIncome > 100000) {
      uniquenessLevel += 15; // Dense wealthy urban area (contextually unique)
    } else if (totalPop < 10000 && medianIncome < 30000) {
      uniquenessLevel += 15; // Small low-income area (contextually unique)
    }
    
    return Math.min(100, uniquenessLevel);
  }

  /**
   * Calculate rarity level of characteristic combinations
   */
  private calculateRarityLevel(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
    
    let rarityLevel = 0;
    
    // Rare triple-high combination
    if (strategicScore >= 65 && demographicScore >= 90 && nikeShare >= 28) {
      rarityLevel += 40; // Very rare combination
    }
    
    // Rare triple-low combination
    if (strategicScore <= 35 && demographicScore <= 40 && nikeShare <= 12) {
      rarityLevel += 35; // Rare underperformance combination
    }
    
    // Rare contradictory patterns
    if (demographicScore >= 85 && nikeShare <= 12) {
      rarityLevel += 30; // High opportunity but very low presence
    }
    
    // Rare population-income combinations
    if (totalPop >= 150000 && medianIncome <= 30000) {
      rarityLevel += 25; // Very large population but very low income
    } else if (totalPop <= 3000 && medianIncome >= 130000) {
      rarityLevel += 25; // Very small population but very high income
    }
    
    // Rare performance inversions
    if (strategicScore >= 65 && nikeShare <= 15) {
      rarityLevel += 20; // High strategic value but low market presence
    }
    
    return Math.min(100, rarityLevel);
  }

  /**
   * Categorize outlier strength
   */
  private getOutlierCategory(outlierScore: number): string {
    if (outlierScore >= 60) return 'Strong Outlier';
    if (outlierScore >= 40) return 'Moderate Outlier';  
    if (outlierScore >= 20) return 'Mild Outlier';
    return 'Normal Range';
  }

  /**
   * Identify the primary type of outlier
   */
  private identifyOutlierType(record: any): string {
    const statisticalLevel = this.calculateStatisticalOutlierLevel(record);
    const performanceLevel = this.calculatePerformanceExtremeLevel(record);
    const uniquenessLevel = this.calculateContextualUniquenessLevel(record);
    const rarityLevel = this.calculateRarityLevel(record);
    
    // Find the highest outlier component
    const maxOutlier = Math.max(statisticalLevel, performanceLevel, uniquenessLevel, rarityLevel);
    
    if (maxOutlier === statisticalLevel && statisticalLevel >= 30) return 'Statistical Outlier';
    if (maxOutlier === performanceLevel && performanceLevel >= 30) return 'Performance Extreme';
    if (maxOutlier === uniquenessLevel && uniquenessLevel >= 30) return 'Contextually Unique';
    if (maxOutlier === rarityLevel && rarityLevel >= 30) return 'Rare Combination';
    
    return 'Mixed Outlier';
  }

  /**
   * Identify specific extreme characteristics
   */
  private identifyExtremeCharacteristics(record: any): string[] {
    const characteristics: string[] = [];
    
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    
    // Strategic extremes
    if (strategicScore >= 70) characteristics.push('Extremely High Strategic Value');
    else if (strategicScore > 0 && strategicScore <= 30) characteristics.push('Extremely Low Strategic Value');
    
    // Nike share extremes
    if (nikeShare >= 35) characteristics.push('Extremely High Nike Share');
    else if (nikeShare > 0 && nikeShare <= 10) characteristics.push('Extremely Low Nike Share');
    
    // Population extremes
    if (totalPop >= 150000) characteristics.push('Extremely Large Population');
    else if (totalPop > 0 && totalPop <= 2000) characteristics.push('Extremely Small Population');
    
    // Income extremes
    if (medianIncome >= 120000) characteristics.push('Extremely High Income');
    else if (medianIncome > 0 && medianIncome <= 30000) characteristics.push('Extremely Low Income');
    
    // Demographic extremes
    if (demographicScore >= 95) characteristics.push('Extremely High Demographic Opportunity');
    else if (demographicScore > 0 && demographicScore <= 30) characteristics.push('Extremely Low Demographic Opportunity');
    
    // Contextual extremes
    if (totalPop > 80000 && medianIncome < 35000) characteristics.push('Large Population + Low Income');
    if (totalPop < 8000 && medianIncome > 100000) characteristics.push('Small Population + High Income');
    if (strategicScore > 65 && nikeShare < 15) characteristics.push('High Strategic + Low Nike Presence');
    
    return characteristics;
  }

  /**
   * Generate meaningful area name from available data
   */
  private generateAreaName(record: any): string {
    // Try explicit name fields first (updated for correlation_analysis format)
    if ((record as any).value_DESCRIPTION && typeof (record as any).value_DESCRIPTION === 'string') {
      const description = (record as any).value_DESCRIPTION.trim();
      const nameMatch = description.match(/\(([^)]+)\)/);
      if (nameMatch && nameMatch[1]) {
        return nameMatch[1].trim();
      }
      return description;
    }
    if ((record as any).DESCRIPTION && typeof (record as any).DESCRIPTION === 'string') {
      const description = (record as any).DESCRIPTION.trim();
      // Extract city name from parentheses format like "32544 (Hurlburt Field)" -> "Hurlburt Field"
      const nameMatch = description.match(/\(([^)]+)\)/);
      if (nameMatch && nameMatch[1]) {
        return nameMatch[1].trim();
      }
      return description;
    }
    if ((record as any).area_name) return (record as any).area_name;
    if ((record as any).NAME) return (record as any).NAME;
    if ((record as any).name) return (record as any).name;
    
    // Create name from ID and location data
    const id = (record as any).ID || (record as any).id || (record as any).GEOID;
    if (id) {
      // For ZIP codes, create format like "ZIP 12345"
      if (typeof id === 'string' && id.match(/^\d{5}$/)) {
        return `ZIP ${id}`;
      }
      // For FSA codes, create format like "FSA M5V"  
      if (typeof id === 'string' && id.match(/^[A-Z]\d[A-Z]$/)) {
        return `FSA ${id}`;
      }
      // For numeric IDs, create descriptive name
      if (typeof id === 'number' || !isNaN(Number(id))) {
        return `Area ${id}`;
      }
      return `Region ${id}`;
    }
    
    return `Area ${(record as any).OBJECTID || 'Unknown'}`;
  }

  /**
   * Rank records by outlier detection score (highest outliers first)
   */
  private rankRecords(records: GeographicDataPoint[]): GeographicDataPoint[] {
    // Sort by outlier score descending and assign ranks
    const sorted = [...records].sort((a, b) => b.value - a.value);
    
    return sorted.map((record, index) => ({
      ...record,
      rank: index + 1
    }));
  }

  /**
   * Process feature importance with outlier focus
   */
  private processOutlierFeatureImportance(rawFeatureImportance: any[]): any[] {
    const outlierFeatures = rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getOutlierFeatureDescription((item as any).feature || (item as any).name)
    }));

    // Add outlier-specific synthetic features if none provided
    if (outlierFeatures.length === 0) {
      return [
        { feature: 'statistical_deviation', importance: 0.40, description: 'Statistical deviation from population norms' },
        { feature: 'performance_extremes', importance: 0.30, description: 'Exceptional high or low performance levels' },
        { feature: 'contextual_uniqueness', importance: 0.20, description: 'Unique characteristics within context' },
        { feature: 'rarity_combinations', importance: 0.10, description: 'Rare combinations of characteristics' }
      ];
    }

    return outlierFeatures.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get outlier-specific feature descriptions
   */
  private getOutlierFeatureDescription(featureName: string): string {
    const outlierDescriptions: Record<string, string> = {
      'outlier': 'Overall outlier detection patterns',
      'extreme': 'Extreme value identification',
      'statistical': 'Statistical deviation measures',
      'performance': 'Performance outlier indicators',
      'unique': 'Contextual uniqueness factors',
      'rare': 'Rare characteristic combinations',
      'deviation': 'Deviation from normal patterns',
      'exceptional': 'Exceptional market characteristics',
      'unusual': 'Unusual market behavior patterns',
      'standout': 'Standout performance indicators',
      'market_share': 'Market share outlier patterns',
      'strategic': 'Strategic value outliers',
      'demographic': 'Demographic outlier characteristics',
      'population': 'Population size outliers',
      'income': 'Income level outliers'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(outlierDescriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} outlier characteristics`;
  }

  /**
   * Calculate outlier-specific statistics
   */
  private calculateOutlierStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
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
    
    // Calculate percentiles
    const p25Index = Math.floor(total * 0.25);
    const p75Index = Math.floor(total * 0.75);
    const medianIndex = Math.floor(total * 0.5);
    
    const percentile25 = sorted[p25Index];
    const percentile75 = sorted[p75Index];
    const median = total % 2 === 0 
      ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2
      : sorted[medianIndex];
    
    // Calculate standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    // Calculate IQR and outliers
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

  /**
   * Generate outlier-focused summary
   */
  private generateOutlierSummary(
    records: GeographicDataPoint[], 
    statistics: AnalysisStatistics, 
    rawSummary?: string
  ): string {
    // Start with outlier scoring explanation
    let summary = `**🎯 Outlier Detection Formula (0-100 scale):**
• **Statistical Outlier (40% weight):** Statistical deviation from norms (Z-scores, percentiles)\n• **Performance Extremes (30% weight):** Exceptional high or low performance vs market norms\n• **Contextual Uniqueness (20% weight):** Unique characteristics within geographic/economic context\n• **Rarity Score (10% weight):** How rare/uncommon the combination of characteristics is\n\nHigher scores indicate areas that stand out significantly from typical market patterns.\n
`;
    
    // Outlier statistics and baseline metrics
    summary += `**📊 Outlier Detection Baseline:** `;
    summary += `Average outlier score: ${statistics.mean.toFixed(1)} (range: ${statistics.min.toFixed(1)}-${statistics.max.toFixed(1)}). `;
    
    // Calculate outlier category distribution
    const strongOutliers = records.filter(r => r.value >= 60).length;
    const moderateOutliers = records.filter(r => r.value >= 40 && r.value < 60).length;
    const mildOutliers = records.filter(r => r.value >= 20 && r.value < 40).length;
    const normalRange = records.filter(r => r.value < 20).length;
    
    summary += `Outlier distribution: ${strongOutliers} strong outliers (${(strongOutliers/records.length*100).toFixed(1)}%), `;
    summary += `${moderateOutliers} moderate outliers (${(moderateOutliers/records.length*100).toFixed(1)}%), `;
    summary += `${mildOutliers} mild outliers (${(mildOutliers/records.length*100).toFixed(1)}%), `;
    summary += `${normalRange} normal range (${(normalRange/records.length*100).toFixed(1)}%).

`;
    
    // Top outlier markets (5-8 areas)
    const topOutliers = records.slice(0, 8);
    if (topOutliers.length > 0) {
      const significantOutliers = topOutliers.filter(r => r.value >= 50);
      if (significantOutliers.length > 0) {
        summary += `**Most Exceptional Markets:** `;
        const outlierNames = significantOutliers.slice(0, 10).map(r => `${r.area_name} (${r.value.toFixed(1)})`);;
        summary += `${outlierNames.join(', ')}. `;
        
        const avgTopOutlier = significantOutliers.reduce((sum, r) => sum + r.value, 0) / significantOutliers.length;
        summary += `These markets show exceptional outlier characteristics with average score ${avgTopOutlier.toFixed(1)}. `;
      }
    }
    
    // Outlier type breakdown
    if (records.length > 0) {
      const outlierTypes = records.reduce((acc, record) => {
        const type = (record as any).properties.outlier_type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topOutlierTypes = Object.entries(outlierTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      
      if (topOutlierTypes.length > 0) {
        summary += `**Primary Outlier Types:** `;
        const typeDescriptions = topOutlierTypes.map(([type, count]) => 
          `${type} (${count} markets, ${(count/records.length*100).toFixed(1)}%)`
        );
        summary += `${typeDescriptions.join(', ')}. `;
      }
    }
    
    // Statistical outliers
    if (records.length > 0) {
      const statisticalOutliers = records
        .filter(r => ((r.properties as any).statistical_outlier_level || 0) >= 50)
        .slice(0, 5);
      
      if (statisticalOutliers.length > 0) {
        summary += `**Statistical Outliers:** `;
        const statNames = statisticalOutliers.map(r => 
          `${r.area_name} (${((r.properties as any).statistical_outlier_level || 0).toFixed(1)}% deviation)`
        );
        summary += `${statNames.join(', ')}. `;
        summary += `These markets show extreme statistical deviations requiring investigation. `;
      }
    }
    
    // Performance extremes
    if (records.length > 0) {
      const performanceExtremes = records
        .filter(r => ((r.properties as any).performance_extreme_level || 0) >= 60)
        .slice(0, 5);
      
      if (performanceExtremes.length > 0) {
        summary += `**Performance Extremes:** `;
        const extremeNames = performanceExtremes.map(r => 
          `${r.area_name} (${((r.properties as any).performance_extreme_level || 0).toFixed(1)}% extreme)`
        );
        summary += `${extremeNames.join(', ')}. `;
        summary += `These markets demonstrate exceptional performance levels. `;
      }
    }
    
    // Contextually unique markets
    if (records.length > 0) {
      const uniqueMarkets = records
        .filter(r => ((r.properties as any).contextual_uniqueness_level || 0) >= 50)
        .slice(0, 5);
      
      if (uniqueMarkets.length > 0) {
        summary += `**Contextually Unique Markets:** `;
        const uniqueNames = uniqueMarkets.map(r => r.area_name);
        summary += `${uniqueNames.join(', ')}. `;
        summary += `These markets have unique characteristics within their economic/geographic context. `;
      }
    }
    
    // Strategic insights
    summary += `**Outlier Insights:** ${statistics.total} geographic areas analyzed for exceptional characteristics and outlier patterns. `;
    
    const extremeOutliers = records.filter(r => r.value >= 70).length;
    if (extremeOutliers > 0) {
      summary += `${extremeOutliers} markets (${(extremeOutliers/records.length*100).toFixed(1)}%) show extreme outlier patterns requiring detailed analysis. `;
    }
    
    // Rare combinations
    const rareMarkets = records.filter(r => ((r.properties as any).rarity_level || 0) >= 30).length;
    if (rareMarkets > 0) {
      summary += `${rareMarkets} markets exhibit rare characteristic combinations offering unique opportunities or challenges. `;
    }
    
    // Actionable recommendations
    summary += `**Investigation Recommendations:** `;
    if (strongOutliers > 0) {
      summary += `Prioritize detailed analysis of ${strongOutliers} strong outlier markets for exceptional opportunities or data validation. `;
    }
    if (moderateOutliers > 0) {
      summary += `Investigate ${moderateOutliers} moderate outlier markets for specialized strategies or market insights. `;
    }
    if (statistics.outlierCount && statistics.outlierCount > 0) {
      summary += `${statistics.outlierCount} statistical outliers detected requiring pattern validation and opportunity assessment. `;
    }
    
    if (rawSummary) {
      summary += rawSummary;
    }
    
    return summary;
  }

  // ============================================================================
  // DIRECT RENDERING METHODS
  // ============================================================================

  /**
   * Create direct renderer for outlier detection visualization
   */
  private createOutlierRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use inverted colors for outlier detection: Green (normal) -> Orange -> Red (extreme outlier)
    const outlierColors = [
      [26, 152, 80, 0.6],    // #1a9850 - Green (normal behavior)
      [166, 217, 106, 0.6],  // #a6d96a - Light Green
      [253, 174, 97, 0.6],   // #fdae61 - Orange  
      [215, 48, 39, 0.6]     // #d73027 - Red (extreme outlier)
    ];
    
    return {
      type: 'class-breaks',
      field: this.scoreField, // Direct field reference
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: 'simple-fill',
          color: outlierColors[i], // Direct array format
          outline: { color: [0, 0, 0, 0], width: 0 }
        },
        label: this.formatClassLabel(i, quartileBreaks)
      })),
      defaultSymbol: {
        type: 'simple-fill',
        color: [200, 200, 200, 0.5],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }
    };
  }

  /**
   * Create direct legend for outlier detection
   */
  private createOutlierLegend(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use RGBA format with correct opacity to match features
    const colors = [
      'rgba(26, 152, 80, 0.6)',    // Normal behavior
      'rgba(166, 217, 106, 0.6)',  // Mild outlier  
      'rgba(253, 174, 97, 0.6)',   // Notable outlier
      'rgba(215, 48, 39, 0.6)'     // Extreme outlier
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length; i++) {
      legendItems.push({
        label: this.formatClassLabel(i, quartileBreaks),
        color: colors[i],
        minValue: quartileBreaks[i].min,
        maxValue: quartileBreaks[i].max
      });
    }
    
    return {
      title: 'Outlier Detection Score',
      items: legendItems,
      position: 'bottom-right'
    };
  }

  /**
   * Calculate quartile breaks for rendering
   */
  private calculateQuartileBreaks(values: number[]): Array<{min: number, max: number}> {
    if (values.length === 0) return [];
    
    const q1 = values[Math.floor(values.length * 0.25)];
    const q2 = values[Math.floor(values.length * 0.5)];
    const q3 = values[Math.floor(values.length * 0.75)];
    
    return [
      { min: values[0], max: q1 },
      { min: q1, max: q2 },
      { min: q2, max: q3 },
      { min: q3, max: values[values.length - 1] }
    ];
  }

  /**
   * Format class labels for legend (same as strategic)
   */
  private formatClassLabel(classIndex: number, breaks: Array<{min: number, max: number}>): string {
    if (classIndex === 0) {
      // First class: < maxValue
      return `< ${breaks[classIndex].max.toFixed(1)}`;
    } else if (classIndex === breaks.length - 1) {
      // Last class: > minValue  
      return `> ${breaks[classIndex].min.toFixed(1)}`;
    } else {
      // Middle classes: minValue - maxValue
      return `${breaks[classIndex].min.toFixed(1)} - ${breaks[classIndex].max.toFixed(1)}`;
    }
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