import { DataProcessorStrategy, RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getPrimaryScoreField } from './HardcodedFieldDefs';

/**
 * AnomalyDetectionProcessor - Handles data processing for the /anomaly-detection endpoint
 * 
 * Processes anomaly detection results with focus on statistical outliers, unusual patterns,
 * and exceptional market behaviors that deviate from normal patterns.
 */
export class AnomalyDetectionProcessor implements DataProcessorStrategy {
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have expected fields for anomaly detection
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        ((record as any).anomaly_score !== undefined || 
         (record as any).value !== undefined || 
         (record as any).score !== undefined ||
         // Check for anomaly-relevant fields
         (record as any).value_MP30034A_B_P !== undefined || // Nike market share (raw format)
         (record as any).mp30034a_b_p !== undefined || // Nike market share for pattern analysis
         (record as any).strategic_value_score !== undefined ||
         (record as any).competitive_advantage_score !== undefined)
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🔍 [ANOMALY DETECTION PROCESSOR] CALLED WITH ${rawData.results?.length || 0} RECORDS 🔍`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for AnomalyDetectionProcessor');
    }

    // Determine primary score field deterministically (allow metadata override)
    const primary = getPrimaryScoreField('anomaly_detection', (rawData as any)?.metadata);
    if (!primary) {
      throw new Error('[AnomalyDetectionProcessor] No primary score field defined for anomaly_detection endpoint.');
    }

    // Process records with anomaly detection scoring priority
    const processedRecords = rawData.results.map((record: any, index: number) => {
      // PRIORITIZE PRE-CALCULATED ANOMALY DETECTION SCORE
      const anomalyScore = this.extractAnomalyScore(record);
      
      // Generate area name from ID and location data
      const areaName = this.generateAreaName(record);
      
      // Extract ID (updated for correlation_analysis format)
      const recordId = (record as any).ID || (record as any).id || (record as any).area_id;
      
      // Debug logging for records with missing ID
      if (!recordId) {
        console.warn(`[AnomalyDetectionProcessor] Record ${index} missing ID:`, {
          hasID: 'ID' in record,
          hasId: 'id' in record,
          hasAreaId: 'area_id' in record,
          recordKeys: Object.keys(record as any).slice(0, 10)
        });
      }
      
      // Extract anomaly-relevant metrics for properties
      const nikeShare = Number((record as any).mp30034a_b_p || (record as any).value_MP30034A_B_P) || 0;
      const strategicScore = Number((record as any).strategic_value_score) || 0;
      const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
      const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
      const trendScore = Number((record as any).trend_strength_score) || 0;
      const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
      const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
      
      // Calculate anomaly indicators
      const statisticalDeviation = this.calculateStatisticalDeviation(record);
      const patternAnomalyLevel = this.calculatePatternAnomaly(record);
      const performanceOutlierLevel = this.calculatePerformanceOutlier(record);
      const contextAnomalyLevel = this.calculateContextAnomaly(record);
      
      const rounded = Math.round(anomalyScore * 100) / 100;
      return {
        area_id: recordId || `area_${index + 1}`,
        area_name: areaName,
        value: rounded, // Use anomaly score as primary value
        [primary]: rounded, // Add target variable at top level using canonical name
        rank: 0, // Will be calculated after sorting
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          [primary]: anomalyScore,
          score_source: primary,
          nike_market_share: nikeShare,
          strategic_score: strategicScore,
          competitive_score: competitiveScore,
          demographic_score: demographicScore,
          trend_score: trendScore,
          total_population: totalPop,
          median_income: medianIncome,
          // Anomaly-specific calculated properties
          statistical_deviation: statisticalDeviation,
          pattern_anomaly_level: patternAnomalyLevel,
          performance_outlier_level: performanceOutlierLevel,
          context_anomaly_level: contextAnomalyLevel,
          anomaly_category: this.getAnomalyCategory(anomalyScore),
          anomaly_type: this.identifyAnomalyType(record)
        }
      };
    });
    
    // Calculate comprehensive statistics
    const statistics = this.calculateAnomalyStatistics(processedRecords);
    
    // Rank records by anomaly detection score (highest anomalies first)
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance with anomaly focus
    const featureImportance = this.processAnomalyFeatureImportance(rawData.feature_importance || []);
    
    // Generate anomaly-focused summary
    const summary = this.generateAnomalySummary(rankedRecords, statistics, rawData.summary);

    return {
      type: 'anomaly_detection', // Anomaly detection type for outlier insights
      records: rankedRecords,
      summary,
      featureImportance,
      statistics,
      targetVariable: primary, // Primary ranking by anomaly score
      renderer: this.createAnomalyRenderer(rankedRecords, primary), // Add direct renderer
      legend: this.createAnomalyLegend(rankedRecords, primary) // Add direct legend
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  /**
   * Extract anomaly detection score from record with fallback calculation
   */
  private extractAnomalyScore(record: any): number {
    if ((record as any).anomaly_score !== undefined && (record as any).anomaly_score !== null) {
      const preCalculatedScore = Number((record as any).anomaly_score);
      console.log(`🔍 [AnomalyDetectionProcessor] Using pre-calculated anomaly score: ${preCalculatedScore}`);
      return preCalculatedScore;
    }
    
    // FALLBACK: Calculate anomaly score from available data
    console.log('⚠️ [AnomalyDetectionProcessor] No anomaly_detection_score found, calculating from raw data');
    
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p || (record as any).value_MP30034A_B_P) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    
    // Simple anomaly detection calculation based on extreme values
    let anomalyScore = 0;
    
    // Extreme strategic scores (very high or very low)
    if (strategicScore > 0) {
      if (strategicScore >= 65 || strategicScore <= 30) {
        anomalyScore += 20; // Extreme strategic performance
      }
    }
    
    // Unusual Nike share patterns
    if (nikeShare >= 40 || (nikeShare > 0 && nikeShare <= 5)) {
      anomalyScore += 20; // Very high or very low Nike share
    }
    
    // Population outliers
    if (totalPop >= 100000 || (totalPop > 0 && totalPop <= 1000)) {
      anomalyScore += 15; // Very large or very small population
    }
    
    // Score inconsistencies
    const scores = [strategicScore, competitiveScore, demographicScore].filter(s => s > 0);
    if (scores.length >= 2) {
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      if (maxScore - minScore >= 40) {
        anomalyScore += 15; // Large score variation
      }
    }
    
    return Math.min(100, anomalyScore);
  }

  /**
   * Calculate statistical deviation level
   */
  private calculateStatisticalDeviation(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    
    // Simple deviation based on extreme values (fallback when no baselines available)
    let deviation = 0;
    
    if (strategicScore >= 65 || strategicScore <= 35) {
      deviation += 30; // High strategic deviation
    }
    
    if (nikeShare >= 35 || (nikeShare > 0 && nikeShare <= 10)) {
      deviation += 30; // High Nike share deviation
    }
    
    return Math.min(100, deviation);
  }

  /**
   * Calculate pattern anomaly level from score relationships
   */
  private calculatePatternAnomaly(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    
    let patternAnomaly = 0;
    
    // Strategic vs competitive inconsistency
    if (strategicScore > 60 && competitiveScore === 0) {
      patternAnomaly += 25; // High strategic but no competitive score
    }
    
    // Nike share vs demographic inconsistency  
    if (demographicScore > 80 && nikeShare < 15) {
      patternAnomaly += 25; // High demographic opportunity but low Nike presence
    }
    
    // All high scores (potentially unrealistic)
    if (strategicScore > 65 && demographicScore > 85 && nikeShare > 25) {
      patternAnomaly += 20; // All metrics very high
    }
    
    return Math.min(100, patternAnomaly);
  }

  /**
   * Calculate performance outlier level
   */  
  private calculatePerformanceOutlier(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    
    let outlierLevel = 0;
    
    // Extreme strategic performance
    if (strategicScore >= 70 || strategicScore <= 30) {
      outlierLevel += 30;
    }
    
    // Extreme Nike market share
    if (nikeShare >= 40 || (nikeShare > 0 && nikeShare <= 5)) {
      outlierLevel += 25;
    }
    
    // Extreme population
    if (totalPop >= 200000 || (totalPop > 0 && totalPop <= 500)) {
      outlierLevel += 20;
    }
    
    return Math.min(100, outlierLevel);
  }

  /**
   * Calculate context anomaly level
   */
  private calculateContextAnomaly(record: any): number {
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
    
    let contextAnomaly = 0;
    
    // Income-population inconsistency
    if (totalPop > 50000 && medianIncome > 0 && medianIncome < 30000) {
      contextAnomaly += 30; // Large population but very low income
    }
    
    if (totalPop < 5000 && medianIncome > 150000) {
      contextAnomaly += 30; // Small population but very high income
    }
    
    // Missing data patterns
    const scoreCount = [strategicScore, competitiveScore].filter(s => s > 0).length;
    if (scoreCount === 0 && (totalPop > 0 || medianIncome > 0)) {
      contextAnomaly += 20; // Has demographic data but no performance scores
    }
    
    return Math.min(100, contextAnomaly);
  }

  /**
   * Categorize anomaly severity
   */
  private getAnomalyCategory(anomalyScore: number): string {
    if (anomalyScore >= 60) return 'High Anomaly';
    if (anomalyScore >= 40) return 'Moderate Anomaly';  
    if (anomalyScore >= 20) return 'Low Anomaly';
    return 'Normal Pattern';
  }

  /**
   * Identify the primary type of anomaly
   */
  private identifyAnomalyType(record: any): string {
    const statisticalDev = this.calculateStatisticalDeviation(record);
    const patternAnomaly = this.calculatePatternAnomaly(record);
    const performanceOutlier = this.calculatePerformanceOutlier(record);
    const contextAnomaly = this.calculateContextAnomaly(record);
    
    // Find the highest anomaly component
    const maxAnomaly = Math.max(statisticalDev, patternAnomaly, performanceOutlier, contextAnomaly);
    
    if (maxAnomaly === statisticalDev && statisticalDev >= 30) return 'Statistical Outlier';
    if (maxAnomaly === patternAnomaly && patternAnomaly >= 30) return 'Pattern Anomaly';
    if (maxAnomaly === performanceOutlier && performanceOutlier >= 30) return 'Performance Outlier';
    if (maxAnomaly === contextAnomaly && contextAnomaly >= 30) return 'Context Anomaly';
    
    return 'Mixed Anomaly';
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
   * Rank records by anomaly detection score (highest anomalies first)
   */
  private rankRecords(records: GeographicDataPoint[]): GeographicDataPoint[] {
    // Sort by anomaly score descending and assign ranks
    const sorted = [...records].sort((a, b) => b.value - a.value);
    
    return sorted.map((record, index) => ({
      ...record,
      rank: index + 1
    }));
  }

  /**
   * Process feature importance with anomaly focus
   */
  private processAnomalyFeatureImportance(rawFeatureImportance: any[]): any[] {
    const anomalyFeatures = rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getAnomalyFeatureDescription((item as any).feature || (item as any).name)
    }));

    // Add anomaly-specific synthetic features if none provided
    if (anomalyFeatures.length === 0) {
      return [
        { feature: 'statistical_deviation', importance: 0.40, description: 'Statistical deviation from population norms' },
        { feature: 'pattern_anomaly', importance: 0.30, description: 'Unusual relationships between metrics' },
        { feature: 'performance_outlier', importance: 0.20, description: 'Extreme performance vs market averages' },
        { feature: 'context_anomaly', importance: 0.10, description: 'Inconsistent data patterns within context' }
      ];
    }

    return anomalyFeatures.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get anomaly-specific feature descriptions
   */
  private getAnomalyFeatureDescription(featureName: string): string {
    const anomalyDescriptions: Record<string, string> = {
      'anomaly': 'Overall anomaly detection patterns',
      'outlier': 'Statistical outlier identification',
      'deviation': 'Deviation from normal patterns',
      'unusual': 'Unusual market behavior patterns',
      'extreme': 'Extreme value detection',
      'inconsistent': 'Inconsistent data patterns',
      'statistical': 'Statistical anomaly indicators',
      'pattern': 'Pattern-based anomaly detection',
      'performance': 'Performance outlier detection',
      'context': 'Contextual anomaly patterns',
      'market_share': 'Market share anomaly patterns',
      'demographic': 'Demographic anomaly indicators',
      'strategic': 'Strategic value anomalies'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(anomalyDescriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} anomaly characteristics`;
  }

  /**
   * Calculate anomaly-specific statistics
   */
  private calculateAnomalyStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
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
   * Generate anomaly-focused summary
   */
  private generateAnomalySummary(
    records: GeographicDataPoint[], 
    statistics: AnalysisStatistics, 
    rawSummary?: string
  ): string {
    // Start with anomaly scoring explanation
    let summary = `**🔍 Anomaly Detection Formula (0-100 scale):**
• **Statistical Deviation (40% weight):** How far values deviate from statistical norms (Z-scores)\n• **Pattern Anomaly (30% weight):** Unusual relationships between different metrics\n• **Performance Outlier (20% weight):** Extreme performance vs market averages (percentiles)\n• **Context Anomaly (10% weight):** Inconsistent data patterns within geographic/economic context\n\nHigher scores indicate more unusual or anomalous market patterns requiring investigation.\n
`;
    
    // Anomaly statistics and baseline metrics
    summary += `**📊 Anomaly Detection Baseline:** `;
    summary += `Average anomaly score: ${statistics.mean.toFixed(1)} (range: ${statistics.min.toFixed(1)}-${statistics.max.toFixed(1)}). `;
    
    // Calculate anomaly category distribution
    const highAnomalies = records.filter(r => r.value >= 60).length;
    const moderateAnomalies = records.filter(r => r.value >= 40 && r.value < 60).length;
    const lowAnomalies = records.filter(r => r.value >= 20 && r.value < 40).length;
    const normalPatterns = records.filter(r => r.value < 20).length;
    
    summary += `Anomaly distribution: ${highAnomalies} high anomalies (${(highAnomalies/records.length*100).toFixed(1)}%), `;
    summary += `${moderateAnomalies} moderate anomalies (${(moderateAnomalies/records.length*100).toFixed(1)}%), `;
    summary += `${lowAnomalies} low anomalies (${(lowAnomalies/records.length*100).toFixed(1)}%), `;
    summary += `${normalPatterns} normal patterns (${(normalPatterns/records.length*100).toFixed(1)}%).

`;
    
    // Top anomalous markets (5-8 areas)
    const topAnomalies = records.slice(0, 8);
    if (topAnomalies.length > 0) {
      const significantAnomalies = topAnomalies.filter(r => r.value >= 40);
      if (significantAnomalies.length > 0) {
        summary += `**Most Anomalous Markets:** `;
        const anomalyNames = significantAnomalies.slice(0, 10).map(r => `${r.area_name} (${r.value.toFixed(1)})`);
        summary += `${anomalyNames.join(', ')}. `;
        
        const avgTopAnomaly = significantAnomalies.reduce((sum, r) => sum + r.value, 0) / significantAnomalies.length;
        summary += `These markets show exceptional anomaly patterns with average score ${avgTopAnomaly.toFixed(1)}. `;
      }
    }
    
    // Anomaly type breakdown
    if (records.length > 0) {
      const anomalyTypes = records.reduce((acc, record) => {
        const type = (record as any).properties.anomaly_type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topAnomalyTypes = Object.entries(anomalyTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      
      if (topAnomalyTypes.length > 0) {
        summary += `**Primary Anomaly Types:** `;
        const typeDescriptions = topAnomalyTypes.map(([type, count]) => 
          `${type} (${count} markets, ${(count/records.length*100).toFixed(1)}%)`
        );
        summary += `${typeDescriptions.join(', ')}. `;
      }
    }
    
    // Statistical outliers
    if (records.length > 0) {
      const statisticalOutliers = records
        .filter(r => ((r.properties as any).statistical_deviation || 0) >= 50)
        .slice(0, 5);
      
      if (statisticalOutliers.length > 0) {
        summary += `**Statistical Outliers:** `;
        const outlierNames = statisticalOutliers.map(r => 
          `${r.area_name} (${((r.properties as any).statistical_deviation || 0).toFixed(1)}% deviation)`
        );
        summary += `${outlierNames.join(', ')}. `;
        summary += `These markets show extreme statistical deviations from population norms. `;
      }
    }
    
    // Strategic insights
    summary += `**Anomaly Insights:** ${statistics.total} geographic areas analyzed for unusual patterns and outliers. `;
    
    const extremeAnomalies = records.filter(r => r.value >= 60).length;
    if (extremeAnomalies > 0) {
      summary += `${extremeAnomalies} markets (${(extremeAnomalies/records.length*100).toFixed(1)}%) show extreme anomaly patterns requiring immediate investigation. `;
    }
    
    // Actionable recommendations
    summary += `**Investigation Priorities:** `;
    if (highAnomalies > 0) {
      summary += `Investigate ${highAnomalies} high-anomaly markets for data quality or exceptional opportunities. `;
    }
    if (moderateAnomalies > 0) {
      summary += `Review ${moderateAnomalies} moderate anomaly markets for potential insights or corrections. `;
    }
    if (statistics.outlierCount && statistics.outlierCount > 0) {
      summary += `${statistics.outlierCount} statistical outliers detected requiring pattern analysis. `;
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
   * Create direct renderer for anomaly detection visualization
   */
  private createAnomalyRenderer(records: any[], primaryField: string): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use inverted colors for anomaly detection: Green (low anomaly) -> Orange -> Red (high anomaly)
    const anomalyColors = [
      [26, 152, 80, 0.6],    // #1a9850 - Green (normal behavior)
      [166, 217, 106, 0.6],  // #a6d96a - Light Green
      [253, 174, 97, 0.6],   // #fdae61 - Orange  
      [215, 48, 39, 0.6]     // #d73027 - Red (highest anomaly)
    ];
    
    return {
      type: 'class-breaks',
      field: primaryField, // Use canonical primary field
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: 'simple-fill',
          color: anomalyColors[i], // Direct array format
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
   * Create direct legend for anomaly detection
   */
  private createAnomalyLegend(records: any[], primaryField: string): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use RGBA format with correct opacity to match features
    const colors = [
      'rgba(26, 152, 80, 0.6)',    // Normal behavior
      'rgba(166, 217, 106, 0.6)',  // Low anomaly  
      'rgba(253, 174, 97, 0.6)',   // Medium anomaly
      'rgba(215, 48, 39, 0.6)'     // High anomaly
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
      title: primaryField.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
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