import { DataProcessorStrategy, RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';

/**
 * FeatureInteractionProcessor - Handles data processing for the /feature-interactions endpoint
 * 
 * Processes feature interaction results with focus on complex relationships, synergistic effects,
 * and multi-variable interactions between different market characteristics.
 */
export class FeatureInteractionProcessor implements DataProcessorStrategy {
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have expected fields for feature interaction analysis
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        ((record as any).interaction_score !== undefined || 
         (record as any).value !== undefined || 
         (record as any).score !== undefined ||
         // Check for interaction-relevant fields
         (record as any).value_MP30034A_B_P !== undefined || // Nike market share (raw format)
         (record as any).mp30034a_b_p !== undefined || // Nike market share for interactions
         (record as any).strategic_value_score !== undefined ||
         (record as any).demographic_opportunity_score !== undefined ||
         (record as any).correlation_strength_score !== undefined)
      );
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`🔗 [FEATURE INTERACTION PROCESSOR] CALLED WITH ${rawData.results?.length || 0} RECORDS 🔗`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for FeatureInteractionProcessor');
    }

  // Determine primary canonical field for this endpoint (allow metadata override)
  const primary = getPrimaryScoreField('feature_interactions', (rawData as any)?.metadata) || 'feature_interactions_score';
  console.log(`[FeatureInteractionProcessor] Using primary score field: ${primary}`);
  // Process records with feature interaction scoring priority
    const processedRecords = rawData.results.map((record: any, index: number) => {
      // PRIORITIZE PRE-CALCULATED FEATURE INTERACTION SCORE
      const interactionScore = this.extractInteractionScore(record);
      
      // Generate area name from ID and location data
      const areaName = this.generateAreaName(record);
      
      // Extract ID (updated for correlation_analysis format)
      const recordId = (record as any).ID || (record as any).id || (record as any).area_id;
      
      // Debug logging for records with missing ID
      if (!recordId) {
        console.warn(`[FeatureInteractionProcessor] Record ${index} missing ID:`, {
          hasID: 'ID' in record,
          hasId: 'id' in record,
          hasAreaId: 'area_id' in record,
          recordKeys: Object.keys(record as any).slice(0, 10)
        });
      }
      
      // Extract interaction-relevant metrics for properties
      const nikeShare = Number((record as any).mp30034a_b_p || (record as any).value_MP30034A_B_P) || 0;
      const strategicScore = Number((record as any).strategic_value_score) || 0;
      const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
      const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
      const trendScore = Number((record as any).trend_strength_score) || 0;
      const correlationScore = Number((record as any).correlation_strength_score) || 0;
      const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
      const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
      
      // Calculate interaction indicators
      const correlationStrength = this.calculateCorrelationStrength(record);
      const synergyEffect = this.calculateSynergyEffect(record);
      const interactionComplexity = this.calculateInteractionComplexity(record);
      const nonLinearPatterns = this.calculateNonLinearPatterns(record);
      
      return {
        area_id: recordId || `area_${index + 1}`,
        area_name: areaName,
  value: Math.round(interactionScore * 100) / 100, // Use interaction score as primary value
  [primary]: Math.round(interactionScore * 100) / 100, // Add target variable at top level using canonical name
  feature_interaction_score: Math.round(interactionScore * 100) / 100, // Legacy compatibility
        rank: 0, // Will be calculated after sorting
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          [primary]: interactionScore,
          feature_interaction_score: interactionScore, // Legacy compatibility
          score_source: primary,
          nike_market_share: nikeShare,
          strategic_score: strategicScore,
          competitive_score: competitiveScore,
          demographic_score: demographicScore,
          trend_score: trendScore,
          correlation_score: correlationScore,
          total_population: totalPop,
          median_income: medianIncome,
          // Interaction-specific calculated properties
          correlation_strength: correlationStrength,
          synergy_effect: synergyEffect,
          interaction_complexity: interactionComplexity,
          non_linear_patterns: nonLinearPatterns,
          interaction_category: this.getInteractionCategory(interactionScore),
          dominant_interaction_type: this.identifyDominantInteractionType(record),
          variable_count: this.countActiveVariables(record)
        }
      };
    });
    
    // Calculate comprehensive statistics
    const statistics = this.calculateInteractionStatistics(processedRecords);
    
    // Rank records by feature interaction score (highest interactions first)
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance with interaction focus
    const featureImportance = this.processInteractionFeatureImportance(rawData.feature_importance || []);
    
    // Generate interaction-focused summary
    const summary = this.generateInteractionSummary(rankedRecords, statistics, rawData.summary);

    return {
      type: 'feature_interactions', // Feature interaction type for complex relationship insights
      records: rankedRecords,
      summary,
      featureImportance,
      statistics,
      targetVariable: primary, // Primary ranking by interaction strength
      renderer: this.createFeatureInteractionRenderer(rankedRecords, primary), // Add direct renderer
      legend: this.createFeatureInteractionLegend(rankedRecords, primary) // Add direct legend
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  /**
   * Extract feature interaction score from record with fallback calculation
   */
  private extractInteractionScore(record: any): number {
    if ((record as any).interaction_score !== undefined && (record as any).interaction_score !== null) {
      const preCalculatedScore = Number((record as any).interaction_score);
      console.log(`🔗 [FeatureInteractionProcessor] Using pre-calculated interaction score: ${preCalculatedScore}`);
      return preCalculatedScore;
    }
    
    // Check for feature_interactions_score (current field)
    if ((record as any).feature_interactions_score !== undefined && (record as any).feature_interactions_score !== null) {
      const currentScore = Number((record as any).feature_interactions_score);
      console.log(`🔗 [FeatureInteractionProcessor] Using current feature_interactions_score: ${currentScore}`);
      return currentScore;
    }
    
    // FALLBACK: Calculate interaction score from available data
    console.log('⚠️ [FeatureInteractionProcessor] No feature_interactions_score found, calculating from raw data');
    
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const correlationScore = Number((record as any).correlation_strength_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p || (record as any).value_MP30034A_B_P) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    
    // Simple interaction calculation based on variable relationships
    let interactionScore = 0;
    
    // Base interaction from correlation
    if (correlationScore > 0) {
      interactionScore += (correlationScore / 100) * 35; // 35% weight
    }
    
    // Strategic-demographic synergy
    if (strategicScore > 0 && demographicScore > 0) {
      const synergy = Math.min((strategicScore * demographicScore) / (100 * 100), 1) * 30; // 30% weight
      interactionScore += synergy;
    }
    
    // Variable complexity
    const activeVars = [strategicScore, demographicScore, nikeShare].filter(v => v > 0).length;
    interactionScore += (activeVars / 3) * 25; // 25% weight
    
    // Non-linear patterns
    if (strategicScore > 60 && demographicScore > 80) {
      interactionScore += 10; // 10% weight for non-linear threshold
    }
    
    return Math.min(100, interactionScore);
  }

  /**
   * Calculate correlation strength between variables
   */
  private calculateCorrelationStrength(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const correlationScore = Number((record as any).correlation_strength_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    
    let correlationStrength = 0;
    
    // Use pre-calculated correlation if available
    if (correlationScore > 0) {
      correlationStrength += correlationScore * 0.4; // 40% from correlation score
    }
    
    // Strategic-demographic correlation
    if (strategicScore > 0 && demographicScore > 0) {
      const correlation = 1 - (Math.abs(strategicScore - demographicScore) / Math.max(strategicScore, demographicScore));
      correlationStrength += correlation * 30; // 30% from strategic-demo correlation
    }
    
    // Nike-strategic correlation
    if (nikeShare > 0 && strategicScore > 0) {
      const normalizedNike = nikeShare / 50;
      const normalizedStrategic = strategicScore / 100;
      const correlation = 1 - Math.abs(normalizedNike - normalizedStrategic);
      correlationStrength += correlation * 30; // 30% from Nike-strategic correlation
    }
    
    return Math.min(100, correlationStrength);
  }

  /**
   * Calculate synergy effect between variables
   */
  private calculateSynergyEffect(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const trendScore = Number((record as any).trend_strength_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    
    let synergyEffect = 0;
    
    // High strategic + high demographic synergy
    if (strategicScore > 50 && demographicScore > 70) {
      const synergy = (strategicScore * demographicScore) / (100 * 100) * 40;
      synergyEffect += synergy;
    }
    
    // Nike share + trend strength synergy
    if (nikeShare > 20 && trendScore > 45) {
      const trendNikeSynergy = (nikeShare * trendScore) / (50 * 100) * 35;
      synergyEffect += trendNikeSynergy;
    }
    
    // Triple synergy (when three metrics are all strong)
    const strongMetrics = [strategicScore > 60, demographicScore > 75, trendScore > 50].filter(Boolean).length;
    if (strongMetrics >= 2) {
      synergyEffect += strongMetrics * 8.33; // Up to 25 points for triple synergy
    }
    
    return Math.min(100, synergyEffect);
  }

  /**
   * Calculate interaction complexity from multiple variables
   */
  private calculateInteractionComplexity(record: any): number {
    const activeVars = this.countActiveVariables(record);
    const scores = [
      Number((record as any).strategic_value_score) || 0,
      Number((record as any).demographic_opportunity_score) || 0,
      Number((record as any).trend_strength_score) || 0
    ].filter(s => s > 0);
    
    let complexity = 0;
    
    // Base complexity from number of active variables
    complexity += (activeVars / 7) * 40; // Up to 40 points for all variables active
    
    // Score variance complexity
    if (scores.length >= 2) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
      complexity += Math.min(variance / 400, 1) * 35; // Up to 35 points for high variance
    }
    
    // Population-income complexity
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
    
    if (totalPop > 0 && medianIncome > 0) {
      const popIncomeComplexity = Math.min(Math.log(totalPop) * medianIncome / 1000000, 1) * 25;
      complexity += popIncomeComplexity;
    }
    
    return Math.min(100, complexity);
  }

  /**
   * Calculate non-linear pattern indicators
   */
  private calculateNonLinearPatterns(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const nikeShare = Number((record as any).mp30034a_b_p) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    
    let nonLinearPatterns = 0;
    
    // Threshold effects
    if (nikeShare >= 30 && strategicScore >= 60) {
      nonLinearPatterns += 30; // High-performance threshold
    } else if (nikeShare <= 15 && demographicScore >= 80) {
      nonLinearPatterns += 30; // Untapped potential threshold
    }
    
    // Exponential-like patterns
    if (totalPop > 50000 && strategicScore > 55) {
      const exponentialEffect = Math.min(Math.log(totalPop / 50000) * strategicScore / 100, 1) * 25;
      nonLinearPatterns += exponentialEffect;
    }
    
    // Sigmoid-like patterns (large differences suggest non-linear relationships)
    if (strategicScore > 0 && demographicScore > 0) {
      const scoreDiff = Math.abs(strategicScore - demographicScore);
      if (scoreDiff >= 30) {
        nonLinearPatterns += 25;
      }
    }
    
    // Inverse relationships
    if (strategicScore > 65 && nikeShare < 20) {
      nonLinearPatterns += 20; // High strategic potential but low current share
    }
    
    return Math.min(100, nonLinearPatterns);
  }

  /**
   * Count active (non-zero) variables
   */
  private countActiveVariables(record: any): number {
    const variables = [
      Number((record as any).mp30034a_b_p) || 0,
      Number((record as any).strategic_value_score) || 0,
      Number((record as any).competitive_advantage_score) || 0,
      Number((record as any).demographic_opportunity_score) || 0,
      Number((record as any).trend_strength_score) || 0,
      Number((record as any).correlation_strength_score) || 0,
      Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0
    ];
    
    return variables.filter(v => v > 0).length;
  }

  /**
   * Categorize interaction strength
   */
  private getInteractionCategory(interactionScore: number): string {
    if (interactionScore >= 65) return 'High Interactions';
    if (interactionScore >= 50) return 'Moderate Interactions';  
    if (interactionScore >= 35) return 'Low Interactions';
    return 'Minimal Interactions';
  }

  /**
   * Identify the dominant type of interaction
   */
  private identifyDominantInteractionType(record: any): string {
    const correlationStrength = this.calculateCorrelationStrength(record);
    const synergyEffect = this.calculateSynergyEffect(record);
    const complexity = this.calculateInteractionComplexity(record);
    const nonLinear = this.calculateNonLinearPatterns(record);
    
    // Find the highest interaction component
    const maxInteraction = Math.max(correlationStrength, synergyEffect, complexity, nonLinear);
    
    if (maxInteraction === correlationStrength && correlationStrength >= 40) return 'Correlation-Driven';
    if (maxInteraction === synergyEffect && synergyEffect >= 40) return 'Synergy-Based';
    if (maxInteraction === complexity && complexity >= 40) return 'Multi-Variable Complex';
    if (maxInteraction === nonLinear && nonLinear >= 40) return 'Non-Linear Patterns';
    
    return 'Mixed Interactions';
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
   * Rank records by feature interaction score (highest interactions first)
   */
  private rankRecords(records: GeographicDataPoint[]): GeographicDataPoint[] {
    // Sort by interaction score descending and assign ranks
    const sorted = [...records].sort((a, b) => b.value - a.value);
    
    return sorted.map((record, index) => ({
      ...record,
      rank: index + 1
    }));
  }

  /**
   * Process feature importance with interaction focus
   */
  private processInteractionFeatureImportance(rawFeatureImportance: any[]): any[] {
    const interactionFeatures = rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getInteractionFeatureDescription((item as any).feature || (item as any).name)
    }));

    // Add interaction-specific synthetic features if none provided
    if (interactionFeatures.length === 0) {
      return [
        { feature: 'correlation_strength', importance: 0.35, description: 'Strength of correlations between variables' },
        { feature: 'synergy_effects', importance: 0.30, description: 'Combined effects stronger than individual effects' },
        { feature: 'interaction_complexity', importance: 0.25, description: 'Multi-variable interaction complexity' },
        { feature: 'non_linear_patterns', importance: 0.10, description: 'Non-linear relationships and threshold effects' }
      ];
    }

    return interactionFeatures.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get interaction-specific feature descriptions
   */
  private getInteractionFeatureDescription(featureName: string): string {
    const interactionDescriptions: Record<string, string> = {
      'interaction': 'Feature interaction patterns and relationships',
      'correlation': 'Correlation strength between variables',
      'synergy': 'Synergistic effects between features',
      'complexity': 'Multi-variable interaction complexity',
      'non_linear': 'Non-linear relationship patterns',
      'threshold': 'Threshold effect interactions',
      'combined': 'Combined variable effects',
      'relationship': 'Inter-variable relationship strength',
      'dependency': 'Variable dependency patterns',
      'effect': 'Interactive effect magnitudes',
      'strategic': 'Strategic value interactions',
      'demographic': 'Demographic factor interactions',
      'market_share': 'Market share interaction effects'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(interactionDescriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} interaction characteristics`;
  }

  /**
   * Calculate interaction-specific statistics
   */
  private calculateInteractionStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
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
   * Generate interaction-focused summary
   */
  private generateInteractionSummary(
    records: GeographicDataPoint[], 
    statistics: AnalysisStatistics, 
    rawSummary?: string
  ): string {
    // Start with interaction scoring explanation
    let summary = `**🔗 Feature Interaction Formula (0-100 scale):**
• **Correlation Strength (35% weight):** How strongly variables correlate with each other\n• **Synergy Effect (30% weight):** Combined effects stronger than individual effects\n• **Interaction Complexity (25% weight):** Multiple variables interacting simultaneously\n• **Non-Linear Patterns (10% weight):** Non-linear relationships and threshold effects\n\nHigher scores indicate stronger and more complex interactions between market variables.\n
`;
    
    // Interaction statistics and baseline metrics
    summary += `**📊 Feature Interaction Baseline:** `;
    summary += `Average interaction strength: ${statistics.mean.toFixed(1)} (range: ${statistics.min.toFixed(1)}-${statistics.max.toFixed(1)}). `;
    
    // Calculate interaction category distribution
    const highInteractions = records.filter(r => r.value >= 50).length;
    const moderateInteractions = records.filter(r => r.value >= 35 && r.value < 50).length;
    const lowInteractions = records.filter(r => r.value >= 20 && r.value < 35).length;
    const minimalInteractions = records.filter(r => r.value < 20).length;
    
    summary += `Interaction distribution: ${highInteractions} high interactions (${(highInteractions/records.length*100).toFixed(1)}%), `;
    summary += `${moderateInteractions} moderate interactions (${(moderateInteractions/records.length*100).toFixed(1)}%), `;
    summary += `${lowInteractions} low interactions (${(lowInteractions/records.length*100).toFixed(1)}%), `;
    summary += `${minimalInteractions} minimal interactions (${(minimalInteractions/records.length*100).toFixed(1)}%).

`;
    
    // Top interaction markets (5-8 areas)
    const topInteractions = records.slice(0, 8);
    if (topInteractions.length > 0) {
      const strongInteractions = topInteractions.filter(r => r.value >= 45);
      if (strongInteractions.length > 0) {
        summary += `**Strongest Interaction Markets:** `;
        const interactionNames = strongInteractions.slice(0, 6).map(r => `${r.area_name} (${r.value.toFixed(1)})`);
        summary += `${interactionNames.join(', ')}. `;
        
        const avgTopInteraction = strongInteractions.reduce((sum, r) => sum + r.value, 0) / strongInteractions.length;
        summary += `These markets show exceptional variable interactions with average score ${avgTopInteraction.toFixed(1)}. `;
      }
    }
    
    // Interaction type breakdown
    if (records.length > 0) {
      const interactionTypes = records.reduce((acc, record) => {
        const type = (record as any).properties.dominant_interaction_type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topInteractionTypes = Object.entries(interactionTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      
      if (topInteractionTypes.length > 0) {
        summary += `**Primary Interaction Types:** `;
        const typeDescriptions = topInteractionTypes.map(([type, count]) => 
          `${type} (${count} markets, ${(count/records.length*100).toFixed(1)}%)`
        );
        summary += `${typeDescriptions.join(', ')}. `;
      }
    }
    
    // Synergy effect markets
    if (records.length > 0) {
      const synergyMarkets = records
        .filter(r => ((r.properties as any).synergy_effect || 0) >= 60)
        .slice(0, 5);
      
      if (synergyMarkets.length > 0) {
        summary += `**High Synergy Markets:** `;
        const synergyNames = synergyMarkets.map(r => 
          `${r.area_name} (${((r.properties as any).synergy_effect || 0).toFixed(1)}% synergy)`
        );
        summary += `${synergyNames.join(', ')}. `;
        summary += `These markets show strong synergistic effects between variables. `;
      }
    }
    
    // Complex interaction markets
    if (records.length > 0) {
      const complexMarkets = records
        .filter(r => ((r.properties as any).interaction_complexity || 0) >= 70)
        .slice(0, 5);
      
      if (complexMarkets.length > 0) {
        summary += `**Complex Interaction Markets:** `;
        const complexNames = complexMarkets.map(r => 
          `${r.area_name} (${((r.properties as any).variable_count || 0)} active variables)`
        );
        summary += `${complexNames.join(', ')}. `;
        summary += `These markets demonstrate multi-variable complexity requiring sophisticated analysis. `;
      }
    }
    
    // Specific variable interaction examples
    summary += `**🔗 Specific Variable Interactions Identified:** `;
    
    // Top markets for detailed interaction analysis
    const topMarkets = records.slice(0, 3);
    if (topMarkets.length > 0) {
      topMarkets.forEach((market, index) => {
        const props = market.properties as any;
        const examples = this.generateSpecificInteractionExamples(market, props);
        summary += `${index + 1}. **${market.area_name}** (${market.value.toFixed(1)} interaction score): ${examples} `;
      });
    }
    
    // Add common interaction patterns discovered
    summary += `**📋 Common Interaction Patterns:** `;
    const sampleMarket = records.find(r => r.value >= 35);
    if (sampleMarket) {
      const commonExamples = this.generateCommonInteractionPatterns(records);
      summary += `${commonExamples} `;
    }
    
    // Strategic insights
    summary += `**📊 Interaction Analysis:** ${statistics.total} geographic areas analyzed for feature interactions and variable relationships. `;
    
    const strongInteractionMarkets = records.filter(r => r.value >= 50).length;
    if (strongInteractionMarkets > 0) {
      summary += `${strongInteractionMarkets} markets (${(strongInteractionMarkets/records.length*100).toFixed(1)}%) show strong multi-variable interactions offering sophisticated targeting opportunities. `;
    }
    
    // Variable complexity insights
    const avgVariableCount = records.reduce((sum, r) => sum + ((r.properties as any).variable_count || 0), 0) / records.length;
    summary += `Average active variables per market: ${avgVariableCount.toFixed(1)}, indicating ${avgVariableCount >= 5 ? 'high' : avgVariableCount >= 3 ? 'moderate' : 'low'} data complexity. `;
    
    // Actionable recommendations
    summary += `**Strategic Recommendations:** `;
    if (highInteractions > 0) {
      summary += `Leverage ${highInteractions} high-interaction markets for multi-channel coordinated campaigns. `;
    }
    if (moderateInteractions > 0) {
      summary += `Develop targeted strategies for ${moderateInteractions} moderate-interaction markets with focused variable optimization. `;
    }
    
    // Non-linear pattern insights
    const nonLinearMarkets = records.filter(r => ((r.properties as any).non_linear_patterns || 0) >= 40).length;
    if (nonLinearMarkets > 0) {
      summary += `${nonLinearMarkets} markets show non-linear patterns requiring threshold-based strategies. `;
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
   * Create direct renderer for feature interaction visualization
   */
  private createFeatureInteractionRenderer(records: any[], primaryField: string): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use standard red-to-green gradient: Red (low) -> Orange -> Light Green -> Dark Green (high)
    const interactionColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (low interaction)
      [253, 174, 97, 0.6],  // #fdae61 - Orange
      [166, 217, 106, 0.6], // #a6d96a - Light Green
      [26, 152, 80, 0.6]    // #1a9850 - Dark Green (high interaction)
    ];
    
    return {
      type: 'class-breaks',
  field: primaryField, // Use canonical primary field
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: 'simple-fill',
          color: interactionColors[i], // Direct array format
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
   * Create direct legend for feature interaction
   */
  private createFeatureInteractionLegend(records: any[], primaryField: string): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use standard red-to-green RGBA format to match renderer
    const colors = [
      'rgba(215, 48, 39, 0.6)',   // Low interaction
      'rgba(253, 174, 97, 0.6)',  // Medium-low  
      'rgba(166, 217, 106, 0.6)', // Medium-high
      'rgba(26, 152, 80, 0.6)'    // High interaction
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
      title: 'Feature Interaction Score',
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
   * Generate specific interaction examples for a market
   */
  private generateSpecificInteractionExamples(market: GeographicDataPoint, props: any): string {
    const examples = [];
    
    // Income and demographics interaction
    if (props.median_income > 0 && props.demographic_score > 0) {
      const incomeLevel = props.median_income > 60000 ? 'High income' : props.median_income > 40000 ? 'Moderate income' : 'Lower income';
      const demoStrength = props.demographic_score > 50 ? 'strong demographics' : 'moderate demographics';
      examples.push(`${incomeLevel} ($${(props.median_income/1000).toFixed(0)}K) amplifies ${demoStrength} (${props.demographic_score.toFixed(1)}/100)`);
    }
    
    // Population density and competitive factors
    if (props.total_population > 0 && props.competitive_score > 0) {
      const popDensity = props.total_population > 50000 ? 'High density' : props.total_population > 25000 ? 'Medium density' : 'Low density';
      const compStrength = props.competitive_score > 50 ? 'intense competition' : 'moderate competition';
      examples.push(`${popDensity} (${(props.total_population/1000).toFixed(0)}K people) creates ${compStrength} (${props.competitive_score.toFixed(1)}/100)`);
    }
    
    // Brand performance and market factors interaction
    if (props.nike_market_share > 0 && props.strategic_score > 0) {
      const brandShare = props.nike_market_share > 25 ? 'Strong brand presence' : props.nike_market_share > 15 ? 'Moderate brand presence' : 'Limited brand presence';
      const strategicValue = props.strategic_score > 60 ? 'high strategic value' : 'moderate strategic value';
      examples.push(`${brandShare} (${props.nike_market_share.toFixed(1)}%) correlates with ${strategicValue} (${props.strategic_score.toFixed(1)}/100)`);
    }
    
    // Correlation and trend interaction
    if (props.correlation_score > 0 && props.trend_score > 0) {
      const corrStrength = props.correlation_score > 60 ? 'Strong correlations' : 'Moderate correlations';
      const trendDirection = props.trend_score > 50 ? 'positive trends' : 'mixed trends';
      examples.push(`${corrStrength} (${props.correlation_score.toFixed(1)}/100) align with ${trendDirection} (${props.trend_score.toFixed(1)}/100)`);
    }
    
    // Return examples or fallback
    if (examples.length > 0) {
      return examples.slice(0, 2).join('; ') + '.';
    }
    
    // Fallback to interaction type analysis
    const interactionType = props.dominant_interaction_type || 'Mixed Interactions';
    const synergyEffect = props.synergy_effect || 0;
    return `${interactionType} detected with ${synergyEffect.toFixed(1)}% synergy between variables.`;
  }

  /**
   * Generate common interaction patterns across markets
   */
  private generateCommonInteractionPatterns(records: GeographicDataPoint[]): string {
    const patterns = [];
    
    // Analyze income-demographics patterns
    const incomeDemo = records.filter(r => {
      const props = r.properties as any;
      return props.median_income > 0 && props.demographic_score > 0;
    });
    
    if (incomeDemo.length >= 5) {
      const avgIncomeEffect = incomeDemo.reduce((sum, r) => {
        const props = r.properties as any;
        return sum + (props.median_income / 1000) * (props.demographic_score / 100);
      }, 0) / incomeDemo.length;
      
      patterns.push(`Income-demographics multiplier effect: ${avgIncomeEffect.toFixed(1)}x stronger in ${incomeDemo.length} markets`);
    }
    
    // Analyze population-competition patterns
    const popComp = records.filter(r => {
      const props = r.properties as any;
      return props.total_population > 0 && props.competitive_score > 0;
    });
    
    if (popComp.length >= 5) {
      const highPop = popComp.filter(r => (r.properties as any).total_population > 40000);
      const highPopCompScore = highPop.reduce((sum, r) => sum + (r.properties as any).competitive_score, 0) / (highPop.length || 1);
      
      patterns.push(`High-density markets (${highPop.length}) show ${highPopCompScore.toFixed(1)} average competitive intensity`);
    }
    
    // Analyze synergy patterns
    const synergyMarkets = records.filter(r => ((r.properties as any).synergy_effect || 0) > 40);
    if (synergyMarkets.length >= 3) {
      const avgSynergy = synergyMarkets.reduce((sum, r) => sum + ((r.properties as any).synergy_effect || 0), 0) / synergyMarkets.length;
      patterns.push(`Synergy amplification: ${synergyMarkets.length} markets show ${avgSynergy.toFixed(1)}% combined effects exceeding individual variable impact`);
    }
    
    // Analyze threshold effects
    const nonLinearMarkets = records.filter(r => ((r.properties as any).non_linear_patterns || 0) > 30);
    if (nonLinearMarkets.length >= 3) {
      patterns.push(`Non-linear thresholds: ${nonLinearMarkets.length} markets exhibit tipping points where variable combinations create disproportionate results`);
    }
    
    // Return patterns or fallback
    if (patterns.length > 0) {
      return patterns.slice(0, 3).join('. ') + '.';
    }
    
    return `Variable interactions primarily show correlation-driven patterns with moderate complexity across analyzed markets.`;
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