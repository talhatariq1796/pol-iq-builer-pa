/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { getScoreExplanationForAnalysis } from '../../utils/ScoreExplanations';
import { BaseProcessor } from './BaseProcessor';
import { BrandNameResolver } from '../../utils/BrandNameResolver';

/**
 * CoreAnalysisProcessor - Handles data processing for the /analyze endpoint
 * 
 * Processes general analysis results with comprehensive ranking, scoring,
 * and statistical analysis capabilities. Generic for any project type.
 * 
 * Extends BaseProcessor for configuration-driven behavior.
 */
export class CoreAnalysisProcessor extends BaseProcessor {
  private scoreField: string | undefined;
  private brandResolver: BrandNameResolver;

  constructor() {
    super(); // Initialize BaseProcessor with configuration
    this.brandResolver = new BrandNameResolver();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate that we have the expected fields for core analysis - Dynamic brand detection
    const hasRequiredFields = rawData.results.length === 0 || 
      rawData.results.some(record => {
        const recordData = record as Record<string, unknown>;
        if (!record || !(recordData.area_id || recordData.id || recordData.ID)) {
          return false;
        }
        
        // Check for standard score fields
        if (recordData.value !== undefined || recordData.score !== undefined) {
          return true;
        }
        
        // Check for common brand fields
        const commonBrandFields = ['value_nike', 'value_adidas', 'value_underarmour', 'brand_share_nike', 'brand_share_adidas'];
        if (commonBrandFields.some(field => recordData[field] !== undefined)) {
          return true;
        }
        
        // Check for demographic data that can be used for analysis
        return recordData.value_TOTPOP_CY !== undefined || recordData.value_AVGHINC_CY !== undefined;
      });
    
    return hasRequiredFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log(`📊 [CORE ANALYSIS PROCESSOR] CALLED WITH ${rawData.results?.length || 0} RECORDS 📊`);
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for CoreAnalysisProcessor');
    }

  // Resolve canonical primary score field for this endpoint
  this.scoreField = getPrimaryScoreField('core_analysis', (rawData as unknown as Record<string, unknown> & { metadata?: Record<string, unknown> })?.metadata) || 'strategic_value_score';

  // --- ENHANCED: Use pre-calculated strategic value scores with fallback ---
    const processedRecords = rawData.results.map((record: unknown, index: number) => {
      const recordData = record as Record<string, unknown>;
      // PRIORITIZE PRE-CALCULATED STRATEGIC VALUE SCORE
      let primaryScore;
      if (recordData.strategic_value_score !== undefined && recordData.strategic_value_score !== null) {
        primaryScore = Number(recordData.strategic_value_score);
        console.log(`🎯 [CoreAnalysisProcessor] Using strategic value score: ${primaryScore} for ${recordData.DESCRIPTION || recordData.ID || 'Unknown'}`);
      } else {
        // FALLBACK: Calculate opportunity score from available data
        console.log('⚠️ [CoreAnalysisProcessor] No strategic_value_score found, calculating from raw data');
        
        // Get brand values using dynamic detection
        const brandFields = this.brandResolver.detectBrandFields(recordData);
        const targetBrand = brandFields.find((bf: { isTarget: boolean }) => bf.isTarget);
        const primaryCompetitor = brandFields.find((bf: { isTarget: boolean }) => !bf.isTarget);
        
        const targetValue = targetBrand?.value || 0;
        const competitorValue = primaryCompetitor?.value || 0;
        const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 1;
        const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 50000;
        
        // DEBUG: Log raw data values to identify the calculation issue
        if (index < 5) {
          console.log(`🔍 [CoreAnalysisProcessor] Raw data analysis for record ${index + 1}:`, {
            area_id: recordData.ID || recordData.id,
            target_brand: targetBrand?.metricName,
            target_value: targetValue,
            competitor_brand: primaryCompetitor?.metricName,
            competitor_value: competitorValue,
            total_pop: totalPop,
            median_income: medianIncome,
            brand_fields_found: brandFields.length,
            all_field_sample: Object.keys(recordData).slice(0, 10)
          });
        }
        
        // Calculate fallback opportunity score from actual data
        const marketGap = Math.max(0, 100 - targetValue - competitorValue); // Untapped market
        const incomeBonus = Math.min((medianIncome - 50000) / 50000, 1); // Income advantage
        const populationWeight = Math.min(totalPop / 50000, 2); // Population density
        const competitiveAdvantage = Math.max(0, targetValue - competitorValue); // Target vs competitor
        
        // DEBUG: Log calculation components
        if (index < 5) {
          console.log(`🔍 [CoreAnalysisProcessor] Calculation components for record ${index + 1}:`, {
            marketGap: marketGap,
            marketGap_contribution: marketGap * 0.4,
            incomeBonus: incomeBonus,
            income_contribution: incomeBonus * 20,
            populationWeight: populationWeight,
            population_contribution: populationWeight * 15,
            competitiveAdvantage: competitiveAdvantage,
            competitive_contribution: competitiveAdvantage * 0.25,
            total_score: (marketGap * 0.4 + incomeBonus * 20 + populationWeight * 15 + competitiveAdvantage * 0.25)
          });
        }
        
        // IMPROVED: More sophisticated strategic value calculation (0-10 scale)
        // 1. Market Opportunity (0-3 points): Based on untapped market potential
        const marketOpportunity = Math.min(3, (marketGap / 100) * 3);
        
        // 2. Economic Attractiveness (0-2 points): Income-adjusted population
        const economicScore = Math.min(2, 
          (Math.max(0, (medianIncome - 30000) / 70000) * 1) + // Income factor (0-1)
          (Math.min(totalPop / 100000, 1) * 1)                // Population factor (0-1)
        );
        
        // 3. Competitive Position (0-2 points): Target brand's current standing
        const competitiveScore = Math.min(2,
          (Math.max(0, targetValue / 50) * 1) +           // Target brand strength (0-1)
          (Math.max(0, (targetValue - competitorValue) / 25) * 1) // Relative advantage (0-1)
        );
        
        // 4. Growth Potential (0-2 points): Based on market dynamics
        const growthPotential = Math.min(2,
          (marketGap > 80 ? 1 : marketGap / 80) +      // High untapped market (0-1)
          (medianIncome > 60000 ? 1 : 0)               // High-income bonus (0-1)
        );
        
        // 5. Strategic Fit (0-1 points): Urban/suburban preference
        const strategicFit = Math.min(1, 
          totalPop > 25000 ? 1 : totalPop / 25000      // Urban density preference
        );
        
        // Composite strategic value score (0-10 scale)
        primaryScore = Math.min(10, 
          marketOpportunity + economicScore + competitiveScore + growthPotential + strategicFit
        );
        
        // DEBUG: Log improved calculation components
        if (index < 5) {
          console.log(`✨ [CoreAnalysisProcessor] IMPROVED calculation for record ${index + 1}:`, {
            marketOpportunity: marketOpportunity.toFixed(2),
            economicScore: economicScore.toFixed(2),
            competitiveScore: competitiveScore.toFixed(2),
            growthPotential: growthPotential.toFixed(2),
            strategicFit: strategicFit.toFixed(2),
            total_strategic_score: primaryScore.toFixed(2)
          });
        }
      }
      
      // Generate area name from ID and location data (updated for correlation_analysis format)
      const areaName = this.generateAreaName(recordData);
      
      // Extract ID (updated for correlation_analysis format)
      const recordId = recordData.ID || recordData.id || recordData.area_id;
      
      // Debug logging for records with missing ID
      if (!recordId) {
        console.warn(`[CoreAnalysisProcessor] Record ${index} missing ID:`, {
          hasID: 'ID' in recordData,
          hasId: 'id' in recordData,
          hasAreaId: 'area_id' in recordData,
          ID_value: recordData.ID,
          id_value: recordData.id,
          area_id_value: recordData.area_id,
          recordKeys: Object.keys(recordData).slice(0, 10)
        });
      }
      
      // Extract key metrics for properties using dynamic brand detection
      const recordBrandFields = this.brandResolver.detectBrandFields(record);
      const targetBrandInfo = recordBrandFields.find(bf => bf.isTarget);
      const competitorBrandInfo = recordBrandFields.find(bf => !bf.isTarget);
      
      const targetBrandValue = targetBrandInfo?.value || 0;
      const competitorBrandValue = competitorBrandInfo?.value || 0;
      const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
      const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
      const marketGap = Math.max(0, 100 - targetBrandValue - competitorBrandValue);
      const competitiveAdvantage = Math.max(0, targetBrandValue - competitorBrandValue);
      
      // Get top contributing fields for popup display
      const topContributingFields = this.getTopContributingFields(record);
      
      const outRecord: Record<string, unknown> = {
        area_id: recordId || `area_${index + 1}`,
        area_name: areaName,
        value: Math.round(primaryScore * 100) / 100, // Use strategic score as primary value
        rank: 0, // Will be calculated after sorting
        // Flatten top contributing fields to top level for popup access
        ...topContributingFields,
        properties: {
          DESCRIPTION: recordData.DESCRIPTION, // Pass through original DESCRIPTION
          // Mirror the canonical scoring field into properties for downstream consumers
          [this.scoreField!]: primaryScore,
          score_source: this.scoreField!,
          target_brand_share: targetBrandValue,
          target_brand_name: targetBrandInfo?.metricName || 'Unknown',
          competitor_brand_share: competitorBrandValue,
          competitor_brand_name: competitorBrandInfo?.metricName || 'Unknown',
          market_gap: marketGap,
          total_population: totalPop,
          median_income: medianIncome,
          competitive_advantage: competitiveAdvantage,
          // Include other pre-calculated scores if available
          demographic_opportunity_score: Number(recordData.demographic_opportunity_score) || 0,
          correlation_strength_score: Number(recordData.correlation_strength_score) || 0,
          cluster_performance_score: Number(recordData.cluster_performance_score) || 0
        }
      };

      // Also expose canonical scoring field at top-level for compatibility
      outRecord[this.scoreField!] = primaryScore;

      return outRecord as unknown as GeographicDataPoint;
    });
    
    // Calculate comprehensive statistics
    const statistics = this.calculateAdvancedStatistics(processedRecords);
    
    // Rank records by value
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Extract feature importance with descriptions
    const featureImportance = this.processFeatureImportance(rawData.feature_importance || []);
    
    // Generate intelligent summary
    const summary = this.generateSummary(rankedRecords, statistics, rawData.summary);

    return {
      type: 'strategic_analysis', // Strategic analysis type for comprehensive insights
      records: rankedRecords,
      summary,
      featureImportance,
      statistics,
      targetVariable: this.scoreField || 'strategic_value_score' // Primary ranking by strategic value
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  private processRecords(rawRecords: Record<string, unknown>[]): GeographicDataPoint[] {
    return rawRecords.map((record, index) => {
      // Extract core identifiers
      const recordData = record as Record<string, unknown>;
      const area_id = String(recordData.area_id || recordData.id || recordData.GEOID || `area_${index}`);
      const area_name = String(recordData.area_name || recordData.name || recordData.NAME || 
                       recordData.area_id || `Area ${index + 1}`);
      
      // Extract value - try multiple field names
      const value = this.extractValue(record);
      
      // Extract additional properties
      const properties = this.extractProperties(record);
      
      // Extract SHAP values if available
      const shapValues = this.extractShapValues(record);
      
      // Determine category based on value percentile
      const category = this.determineCategory(value, rawRecords);

      return {
        area_id,
        area_name,
        value,
        rank: 0, // Will be calculated in rankRecords
        category,
        coordinates: (recordData.coordinates as [number, number]) || [0, 0],
        properties,
        shapValues
      };
    });
  }

  /**
   * Extract meaningful value from record - Enhanced for brand analysis
   */
  private extractValue(record: any): number {
    // First try standard value fields
    const standardValue = (record as any).value || (record as any).score || (record as any).result || 
                         (record as any).target_value || (record as any).prediction;
    
    if (standardValue !== undefined && standardValue !== null && standardValue !== 0) {
      return Number(standardValue);
    }
    
    // --- ENHANCED: Calculate from brand data when available ---
    const brandFields = this.brandResolver.detectBrandFields(record);
    const targetBrand = brandFields.find(bf => bf.isTarget);
    const competitor = brandFields.find(bf => !bf.isTarget);
    
    const targetValue = targetBrand?.value || 0;
    const competitorValue = competitor?.value || 0;
    
    if (targetValue > 0 || competitorValue > 0) {
      // Calculate opportunity score from brand data
      const totalPop = (record as any).value_TOTPOP_CY || 1;
      const wealthIndex = Number((record as any).value_WLTHINDXCY) || 100;
      const avgIncome = (record as any).value_AVGHINC_CY || (wealthIndex * 500);
      
      // Market opportunity calculation
      const marketGap = Math.max(0, 100 - targetValue - competitorValue);
      const incomeBonus = Math.max(0, (avgIncome - 50000) / 1000);
      const populationWeight = Math.min(totalPop / 10000, 5);
      const competitiveAdvantage = Math.max(0, targetValue - competitorValue);
      
      // Composite opportunity score
      const opportunityScore = (
        marketGap * 0.3 +      // Untapped market potential
        incomeBonus * 0.2 +    // Income level bonus
        populationWeight * 0.2 + // Population density
        competitiveAdvantage * 0.15 +   // Target brand competitive position
        targetValue * 0.15       // Current target brand presence
      );
      
      return Math.round(opportunityScore * 100) / 100;
    }
    
    // Fallback to demographic indicators
    return (record as any).value_TOTPOP_CY || (record as any).value_AVGHINC_CY || (record as any).rank || 1;
  }

  private extractProperties(record: any): Record<string, any> {
    // Extract all properties except internal fields
    const internalFields = new Set([
      'area_id', 'id', 'area_name', 'name', 'value', 'score', 
      'coordinates', 'shap_values', 'rank', 'category'
    ]);
    
    const properties: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(record)) {
      if (!internalFields.has(key)) {
        properties[key] = value;
      }
    }
    
    return properties;
  }

  private extractShapValues(record: any): Record<string, number> {
    if ((record as any).shap_values && typeof (record as any).shap_values === 'object') {
      return (record as any).shap_values;
    }
    
    // Look for SHAP-like fields (fields ending with _shap or _impact)
    const shapValues: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(record)) {
      if ((key.includes('shap') || key.includes('impact')) && typeof value === 'number') {
        shapValues[key] = value;
      }
    }
    
    return shapValues;
  }

  /**
   * Generate fallback SHAP-like values when microservice SHAP is zero
   * This creates meaningful importance scores from actual data relationships
   */
  private generateFallbackShapValues(record: any): Record<string, number> {
    const fallbackShap: Record<string, number> = {};
    
    // Get brand values using dynamic detection
    const brandFields = this.brandResolver.detectBrandFields(record);
    const targetBrand = brandFields.find(bf => bf.isTarget);
    const competitor = brandFields.find(bf => !bf.isTarget);
    
    const targetValue = targetBrand?.value || 0;
    const competitorValue = competitor?.value || 0;
    const totalPop = (record as any).value_TOTPOP_CY || 1;
    const wealthIndex = Number((record as any).value_WLTHINDXCY) || 100;
    const avgIncome = (record as any).value_AVGHINC_CY || (wealthIndex * 500);
    
    // Calculate brand preference strength (0-1 scale)
    const brandStrength = Math.max(targetValue, competitorValue) / 100;
    const competitiveFactor = Math.abs(targetValue - competitorValue) / 100;
    
    // Generate meaningful importance scores based on data relationships
    fallbackShap['demographic_income'] = (avgIncome - 50000) / 100000 * brandStrength;
    fallbackShap['brand_competition'] = competitiveFactor;
    fallbackShap['market_size'] = (totalPop / 10000) * brandStrength;
    fallbackShap['target_brand_preference'] = (targetValue / 100) - 0.2; // Baseline 20%
    fallbackShap['competitor_preference'] = (competitorValue / 100) - 0.15; // Baseline 15%
    
    // Add demographic factors with realistic importance
    if ((record as any).value_MEDAGE_CY) {
      const ageOptimality = 1 - Math.abs(((record as any).value_MEDAGE_CY - 35) / 35); // Optimal age ~35
      fallbackShap['age_factor'] = ageOptimality * brandStrength;
    }
    
    if ((record as any).value_AVGHHSZ_CY) {
      const familyFactor = Math.min((record as any).value_AVGHHSZ_CY / 4, 1); // Family size factor
      fallbackShap['family_factor'] = familyFactor * brandStrength * 0.3;
    }
    
    return fallbackShap;
  }

  /**
   * Enhanced processing that ensures meaningful analysis even with zero SHAP
   */
  private determineCategory(value: number, allRecords: any[]): string {
    const values = allRecords.map(r => this.extractValue(r)).filter(v => !isNaN(v));
    if (values.length === 0) return 'unknown';
    
    values.sort((a, b) => a - b);
    const p25 = values[Math.floor(values.length * 0.25)];
    const p75 = values[Math.floor(values.length * 0.75)];
    
    if (value >= p75) return 'high';
    if (value <= p25) return 'low';
    return 'medium';
  }



  private processFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getFeatureDescription((item as any).feature || (item as any).name)
    })).sort((a, b) => b.importance - a.importance);
  }

  private getFeatureDescription(featureName: string): string {
    // Map common feature names to human-readable descriptions
    const descriptions: Record<string, string> = {
      'income': 'Household income levels',
      'age': 'Age demographics',
      'education': 'Education levels',
      'population': 'Population density',
      'employment': 'Employment rates',
      'housing': 'Housing characteristics',
      'transportation': 'Transportation access',
      'retail': 'Retail accessibility'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} characteristics`;
  }

  private calculateAdvancedStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
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

  private generateSummary(
    records: GeographicDataPoint[], 
    statistics: AnalysisStatistics, 
    rawSummary?: string
  ): string {
    const categoryBreakdown = this.getCategoryBreakdown(records);
    
    // Start with plain-language score explanation
    let summary = getScoreExplanationForAnalysis('analyze', 'strategic_value');
    
    // Enhanced baseline and average metrics section
    summary += `**📈 Market Baseline & Averages:** `;
    summary += `Market average opportunity score: ${statistics.mean.toFixed(1)} (range: ${statistics.min.toFixed(1)}-${statistics.max.toFixed(1)}). `;
    
          // Calculate and show demographic baselines using dynamic brand detection
      const avgTargetShare = records.reduce((sum, r) => sum + ((r.properties as any).target_brand_share || 0), 0) / records.length;
      const avgCompetitorShare = records.reduce((sum, r) => sum + ((r.properties as any).competitor_brand_share || 0), 0) / records.length;
      const avgMarketGap = records.reduce((sum, r) => sum + ((r.properties as any).market_gap || 0), 0) / records.length;
      const avgWealthIndex = records.reduce((sum, r) => sum + ((r.properties as any).value_WLTHINDXCY || 100), 0) / records.length;
              const avgIncome = records.reduce((sum, r) => {
          const wealth = (r.properties as any).value_WLTHINDXCY || 100;
          const income = (r.properties as any).avg_income || (r.properties as any).value_AVGHINC_CY || (wealth * 500);
          return sum + income;
        }, 0) / records.length;
      const avgPopulation = records.reduce((sum, r) => sum + ((r.properties as any).total_population || (r.properties as any).value_TOTPOP_CY || 0), 0) / records.length;
    
      // Get brand names from the first record
      const targetBrandName = records[0]?.properties?.target_brand_name || this.brandResolver.getTargetBrandName();
      const competitorBrandName = records[0]?.properties?.competitor_brand_name || 'Competitor';
      
          summary += `Average ${targetBrandName} presence: ${avgTargetShare.toFixed(1)}%, ${competitorBrandName} presence: ${avgCompetitorShare.toFixed(1)}%, market gap: ${avgMarketGap.toFixed(1)}%. `;
      summary += `Demographic baseline: wealth index ${avgWealthIndex.toFixed(0)}, $${(avgIncome/1000).toFixed(0)}K estimated income, ${(avgPopulation/1000).toFixed(0)}K average population. `;
    
    // Performance distribution context
    const above70 = records.filter(r => r.value >= 70).length;
    const above50 = records.filter(r => r.value >= 50).length;
    const above30 = records.filter(r => r.value >= 30).length;
    
    summary += `Performance distribution: ${above70} markets (${(above70/records.length*100).toFixed(1)}%) score 70+, ${above50} (${(above50/records.length*100).toFixed(1)}%) score 50+, ${above30} (${(above30/records.length*100).toFixed(1)}%) score 30+.

`;
    
    summary += `**Market Analysis Complete:** ${statistics.total} geographic areas analyzed across key performance indicators. `;
    
    // Enhanced top performers section (5-8 areas)
    const topPerformers = records.slice(0, 8);
    if (topPerformers.length > 0) {
      const topTier = topPerformers.filter(r => r.value >= 70);
      if (topTier.length > 0) {
        summary += `**Top Performers** (Scores 70+): `;
        const topNames = topTier.slice(0, 10).map(r => `${r.area_name} (${r.value.toFixed(1)})`);
        summary += `${topNames.join(', ')}. `;
        
        // Add insights about top performers
        const avgTopScore = topTier.reduce((sum, r) => sum + r.value, 0) / topTier.length;
        summary += `These areas achieve exceptional performance with average score ${avgTopScore.toFixed(1)}. `;
      }
    }
    
    // Enhanced emerging opportunities section (3-5 areas)
    const emergingOpportunities = records.filter(r => r.value >= 50 && r.value < 70).slice(0, 5);
    if (emergingOpportunities.length > 0) {
      summary += `**Emerging Opportunities** (Scores 50-70): `;
      const emergingNames = emergingOpportunities.map(r => `${r.area_name} (${r.value.toFixed(1)})`);
      summary += `${emergingNames.join(', ')}. `;
      summary += `These areas show strong growth potential with developing market conditions. `;
    }
    
    // Investment targets section (3-5 areas)
    const investmentTargets = records.filter(r => r.value >= 30 && r.value < 50).slice(0, 5);
    if (investmentTargets.length > 0) {
      summary += `**Investment Targets** (Scores 30-50): `;
      const targetNames = investmentTargets.map(r => `${r.area_name} (${r.value.toFixed(1)})`);
      summary += `${targetNames.join(', ')}. `;
      summary += `These areas present strategic value despite lower current performance. `;
    }
    
    // Enhanced performance distribution with context
    summary += `**Market Structure:** ${categoryBreakdown.high} high-performance markets (${(categoryBreakdown.high / statistics.total * 100).toFixed(1)}%), `;
    summary += `${categoryBreakdown.medium} moderate markets (${(categoryBreakdown.medium / statistics.total * 100).toFixed(1)}%), `;
    summary += `${categoryBreakdown.low} developing markets (${(categoryBreakdown.low / statistics.total * 100).toFixed(1)}%). `;
    
    // Strategic insights based on data patterns
    const avgScore = statistics.mean;
    const highPerformers = records.filter(r => r.value > avgScore * 1.2).length;
    summary += `**Strategic Insights:** Market average performance is ${avgScore.toFixed(1)}. `;
    summary += `${highPerformers} areas significantly outperform market average (20%+ above mean). `;
    
    // Add demographic insights if available
    const hasIncomeData = records.some(r => (r.properties as any).avg_income || (r.properties as any).value_AVGHINC_CY);
    const hasPopulationData = records.some(r => (r.properties as any).total_population || (r.properties as any).value_TOTPOP_CY);
    
    if (hasIncomeData || hasPopulationData) {
      summary += `Performance correlates with `;
      const factors = [];
      if (hasIncomeData) factors.push('income levels');
      if (hasPopulationData) factors.push('population density');
      summary += `${factors.join(' and ')}. `;
    }
    
    // Outlier insights
    if (statistics.outlierCount && statistics.outlierCount > 0) {
      summary += `**Outliers Detected:** ${statistics.outlierCount} areas show exceptional patterns requiring further investigation. `;
    }
    
    // Actionable recommendations
    summary += `**Recommendations:** `;
    if (topPerformers.length > 0) {
      summary += `Prioritize immediate expansion in top-performing areas. `;
    }
    if (emergingOpportunities.length > 0) {
      summary += `Develop pilot programs for emerging opportunities. `;
    }
    if (investmentTargets.length > 0) {
      summary += `Consider strategic partnerships in investment target areas. `;
    }
    
    if (rawSummary) {
      summary += rawSummary;
    }
    
    return summary;
  }

  private getCategoryBreakdown(records: GeographicDataPoint[]) {
    return records.reduce((acc, record) => {
      acc[(record as any).category!] = (acc[(record as any).category!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Identify top 5 fields that contribute most to the strategic value score
   * Returns them as a flattened object for popup display
   */
  private getTopContributingFields(record: any): Record<string, number> {
    const contributingFields: Array<{field: string, value: number, importance: number}> = [];
    
    // Define field importance weights based on core analysis factors
    // Use dynamic field detection instead of hardcoded mappings
  const fieldDefinitions = getTopFieldDefinitions('core_analysis');
  console.log(`[CoreAnalysisProcessor] Using hardcoded top field definitions for core_analysis`);
    
    fieldDefinitions.forEach(fieldDef => {
      let value = 0;
      const sources = Array.isArray(fieldDef.source) ? fieldDef.source : [fieldDef.source];
      
      // Find the first available source field
      for (const source of sources) {
        if (record[source] !== undefined && record[source] !== null) {
          value = Number(record[source]);
          break;
        }
      }
      
      // Handle calculated fields
      if (fieldDef.calculated && fieldDef.field === 'market_gap') {
        const brandFields = this.brandResolver.detectBrandFields(record);
        const targetBrand = brandFields.find(bf => bf.isTarget);
        const competitor = brandFields.find(bf => !bf.isTarget);
        const targetValue = targetBrand?.value || 0;
        const competitorValue = competitor?.value || 0;
        value = Math.max(0, 100 - targetValue - competitorValue);
      }
      
      // Only include fields with meaningful values
      if (!isNaN(value) && value > 0) {
        contributingFields.push({
          field: fieldDef.field,
          value: Math.round(value * 100) / 100,
          importance: fieldDef.importance
        });
      }
    });
    
    // Sort by importance and take top 5
    const topFields = contributingFields
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5)
      .reduce((acc, item) => {
        acc[(item as any).field] = (item as any).value;
        return acc;
      }, {} as Record<string, number>);
    
    console.log(`[CoreAnalysisProcessor] Top contributing fields for ${(record as any).ID}:`, topFields);
    return topFields;
  }

  /**
   * Generate meaningful area name from available data
   */
  protected generateAreaName(record: any): string {
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
    } // Primary field in correlation_analysis
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
    
    // Last resort: use coordinates or index
    if ((record as any).coordinates) {
      return `Location ${(record as any).coordinates[0].toFixed(2)},${(record as any).coordinates[1].toFixed(2)}`;
    }
    
    return `Area ${(record as any).OBJECTID || 'Unknown'}`;
  }
  /**
   * Extract numeric field value from multiple possible field names
   */
  private extractNumericFieldValue(record: any, fieldNames: string[]): number {
    for (const fieldName of fieldNames) {
      const value = Number(record[fieldName]);
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }
    return 0;
  }

} 