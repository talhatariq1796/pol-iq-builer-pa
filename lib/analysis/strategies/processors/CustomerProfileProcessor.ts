/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getPrimaryScoreField } from './HardcodedFieldDefs';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseProcessor } from './BaseProcessor';
import { BrandNameResolver } from '../../utils/BrandNameResolver';

/**
 * CustomerProfileProcessor - Handles data processing for customer profiling across markets
 * 
 * Processes customer profile analysis with comprehensive demographic analysis,
 * lifestyle characteristics, behavioral indicators, and market patterns across regions.
 * 
 * Extends BaseProcessor for configuration-driven behavior with customer focus.
 */
export class CustomerProfileProcessor extends BaseProcessor {
  private scoreField: string | undefined;
  private brandResolver: BrandNameResolver;

  constructor() {
    super(); // Initialize BaseProcessor with configuration
    this.brandResolver = new BrandNameResolver();
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;

    // Handle both formats: direct array or wrapped object (use local casts)
    const dataAny = rawData as any;
    let dataArray: any[];
    if (Array.isArray(dataAny)) {
      // Direct array format: [{...}, {...}]
      dataArray = dataAny as any[];
    } else if (dataAny.success && Array.isArray(dataAny.results)) {
      // Wrapped format: {success: true, results: [{...}, {...}]}
      dataArray = dataAny.results as any[];
    } else {
      return false;
    }
    
    // Validate customer profile-specific fields
    const hasCustomerProfileFields = dataArray.length === 0 || 
  dataArray.some((record: any) => 
        record && 
        ((record as any).purchase_propensity !== undefined || // Latest scoring field
         (record as any).customer_profile_score !== undefined || // Pre-calculated score
         (record as any).total_population !== undefined ||        // Population for analysis
         (record as any).median_income !== undefined ||          // Income demographics
         (record as any).value_TOTPOP_CY !== undefined ||        // Legacy population
         (record as any).value_AVGHINC_CY !== undefined ||       // Legacy income
         (record as any).value_MEDAGE_CY !== undefined ||        // Age demographics
         // Quebec housing market fields
         (record as any).ECYTENOWN !== undefined ||              // Home ownership
         (record as any).ECYTENRENT !== undefined ||             // Rental units
         (record as any).ECYMTN2534 !== undefined ||             // Young adults
         (record as any).demographic_opportunity_score !== undefined) // Demographic base
      );
    
    return hasCustomerProfileFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    // Handle both formats: direct array or wrapped object
    const dataAny = rawData as any;
    let dataArray: any[];
    if (Array.isArray(dataAny)) {
      // Direct array format: [{...}, {...}]
      dataArray = dataAny as any[];
      console.log(`👤 [CUSTOMER PROFILE PROCESSOR] CALLED WITH ${dataArray.length} RECORDS (direct array) 👤`);
    } else if (dataAny.success && Array.isArray(dataAny.results)) {
      // Wrapped format: {success: true, results: [{...}, {...}]}
      dataArray = dataAny.results as any[];
      console.log(`👤 [CUSTOMER PROFILE PROCESSOR] CALLED WITH ${dataArray.length} RECORDS (wrapped) 👤`);
    } else {
      throw new Error('Invalid data format for CustomerProfileProcessor');
    }
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for CustomerProfileProcessor');
    }

  // Resolve canonical primary score field for residential profiles
  this.scoreField = getPrimaryScoreField('residential_profile', (rawData as any)?.metadata) || 'residential_profile_score';

  // Process records with customer profile information
  const records = this.processCustomerProfileRecords(dataArray);
    
    // Calculate customer profile statistics
    const statistics = this.calculateCustomerProfileStatistics(records);
    
    // Analyze customer profile patterns and personas
    const customerProfileAnalysis = this.analyzeCustomerProfilePatterns(records);
    
    // Process feature importance for customer profile factors
    const featureImportance = this.processCustomerProfileFeatureImportance(
      Array.isArray(dataAny) ? [] : ((dataAny.feature_importance as any[]) || [])
    );
    
    // Generate customer profile summary
    const summary = this.generateCustomerProfileSummary(
  records,
  customerProfileAnalysis,
  Array.isArray(dataAny) ? undefined : (dataAny.summary as string | undefined)
    );

    // Calculate extent from features for map zooming
    const extent = this.calculateExtentFromFeatures(records);

    return {
      type: 'customer_profile',
      records,
      summary,
      featureImportance,
      statistics,
      targetVariable: this.scoreField || 'customer_profile_score', // Use canonical primary field
      renderer: this.createCustomerProfileRenderer(records), // Add direct renderer
      legend: this.createCustomerProfileLegend(records), // Add direct legend
      customerProfileAnalysis, // Additional metadata for customer profile visualization
      extent, // Add extent for map zooming
      shouldZoom: extent !== null // Enable zooming if we have valid extent
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  private processCustomerProfileRecords(rawRecords: any[]): GeographicDataPoint[] {
    return rawRecords.map((record, index) => {
      // Use BaseProcessor methods for area identification
      const area_id = this.extractGeographicId(record) || `area_${index}`;
      const area_name = this.generateAreaName(record);
      
      // Extract customer profile score
      const customerProfileScore = this.extractCustomerProfileScore(record);
      
  // Use customer profile score as the primary value
  const value = customerProfileScore;
      
      // Extract customer profile-specific properties from pre-calculated data
      const properties = {
        ...this.extractProperties(record),
        customer_profile_score: customerProfileScore,
        demographic_alignment: Number((record as any).demographic_alignment) || 0,
        lifestyle_score: Number((record as any).lifestyle_score) || 0,
        behavioral_score: Number((record as any).behavioral_score) || 0,
        market_context_score: Number((record as any).market_context_score) || 0,
        profile_category: (record as any).profile_category || this.getCustomerProfileCategory(customerProfileScore),
        persona_type: (record as any).persona_type || this.identifyPersonaType(record),
        target_confidence: Number((record as any).target_confidence) || 0,
        brand_loyalty_indicator: Number((record as any).brand_loyalty_indicator) || 0,
        lifestyle_alignment: Number((record as any).lifestyle_alignment) || 0,
        purchase_propensity: Number((record as any).purchase_propensity) || 0,
        population: this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population']) || (record as any).population || 0,
        avg_income: this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income']) || (record as any).income || 0,
        median_age: (record as any).value_MEDAGE_CY || (record as any).age || 0,
        household_size: (record as any).value_AVGHHSZ_CY || (record as any).household_size || 0,
        wealth_index: (record as any).value_WLTHINDXCY || 100,
        target_brand_affinity: this.extractTargetBrandAffinity(record)
      };
      
      // Extract SHAP values
      const shapValues = this.extractShapValues(record);
      
      // Category based on customer profile strength
      const category = this.getCustomerProfileCategory(customerProfileScore);

      const outRec: any = {
        area_id,
        area_name,
        value,
        rank: 0, // Will be calculated in ranking
        category,
        coordinates: (record as any).coordinates || [0, 0],
        properties,
        shapValues
      };

      // Mirror canonical scoring field to top-level and properties
      outRec[this.scoreField!] = customerProfileScore;
      (outRec.properties as any)[this.scoreField!] = customerProfileScore;

      return outRec;
    }).sort((a, b) => b.value - a.value) // Sort by customer profile score
      .map((record, index) => ({ ...record, rank: index + 1 })); // Assign ranks
  }

  private extractCustomerProfileScore(record: any): number {
    // First try to use the pre-calculated customer_profile_score if available
    const rawScore = Number((record as any)[this.scoreField || 'customer_profile_score'] ?? (record as any).customer_profile_score);
    if (!isNaN(rawScore) && rawScore > 0) {
      return rawScore;
    }
    
    // Fallback: Calculate composite score from multiple available fields
    
    const purchasePropensity = Number((record as any).purchase_propensity) || 0;
    const lifestyleScore = Number((record as any).lifestyle_score) || 0;
    const demographicAlignment = Number((record as any).demographic_alignment) || 0;
    const behavioralScore = Number((record as any).behavioral_score) || 0;
    const marketContextScore = Number((record as any).market_context_score) || 0;
    const brandLoyalty = Number((record as any).brand_loyalty_indicator) || 0;
    const targetConfidence = Number((record as any).target_confidence) || 0;
    const lifestyleAlignment = Number((record as any).lifestyle_alignment) || 0;
    
    // Consider strategic context fields if available (but don't use raw market shares)
    const thematicValue = Number((record as any).thematic_value) || 0;
    const strategicScore = Number((record as any).strategic_score) || 0;
    
    // Create a balanced composite score that gives meaningful variation
    let compositeScore = 0;
    
    // Core persona factors (60% weight)
    compositeScore += purchasePropensity * 0.25; // Purchase intent is key
    compositeScore += demographicAlignment * 0.20; // Demographics matter
    compositeScore += Math.max(lifestyleScore, lifestyleAlignment) * 0.15; // Use better lifestyle indicator
    
    // Brand and confidence factors (25% weight)
    compositeScore += targetConfidence * 0.15;
    compositeScore += brandLoyalty * 0.10;
    
    // Market context (15% weight)
    compositeScore += marketContextScore * 0.10;
    compositeScore += behavioralScore * 0.05;
    
    // Add bonus for high strategic score (up to 10 points) - but only if it's a proper strategic score
    if (strategicScore > 10) { // Only use if it's likely a real strategic score, not a tiny market share
      const strategicBonus = Math.min((strategicScore - 10) * 0.15, 10); // 0.15 points per point above 10, max 10 points
      compositeScore += strategicBonus;
    }
    
    // If we still have a very low score, use thematic value as floor (but scale it properly)
    if (compositeScore < 25 && thematicValue > 0) {
      // If thematic value is very small (< 1), it might be a percentage that needs scaling
      const scaledThematic = thematicValue < 1 ? thematicValue * 100 : thematicValue;
      compositeScore = Math.max(compositeScore, scaledThematic * 0.4); // Use scaled thematic value as floor
    }
    
    // Ensure score is in reasonable range
    compositeScore = Math.max(0, Math.min(100, compositeScore));
    
    if (compositeScore > 50) { // Only log high scores for debugging
      console.log(`👤 [CustomerProfileProcessor] High composite score: ${compositeScore.toFixed(1)} for ${(record as any).DESCRIPTION || 'Unknown'} (purchase: ${purchasePropensity}, demographic: ${demographicAlignment}, strategic: ${strategicScore})`);
    }
    
    return compositeScore;
  }

  private getCustomerProfileCategory(score: number): string {
    if (score >= 90) return 'Ideal Customer Profile Match';
    if (score >= 75) return 'Strong Customer Profile Fit';
    if (score >= 60) return 'Good Customer Profile Alignment';
    if (score >= 45) return 'Moderate Customer Profile Potential';
    if (score >= 30) return 'Developing Customer Profile Market';
    return 'Limited Customer Profile Fit';
  }

  private identifyPersonaType(record: any): string {
    const income = this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income']) || (record as any).income || 0;
    const age = (record as any).median_age || (record as any).value_MEDAGE_CY || (record as any).age || 35;
    const targetBrandAffinity = this.extractTargetBrandAffinity(record);
    const behavioralScore = Number((record as any).behavioral_score) || 0;
  // const demographicScore = Number((record as any).demographic_alignment) || 0;

    // Brand Enthusiasts: High target brand affinity + strong behavioral score
    if (targetBrandAffinity >= 25 && behavioralScore >= 70) {
      return 'Brand Enthusiasts';
    }
    
    // Fashion-Forward Professionals: High income + good lifestyle score
    if (income >= 60000 && Number((record as any).lifestyle_score) >= 70) {
      return 'Fashion-Forward Professionals';
    }
    
    // Premium Brand Loyalists: High income + target brand affinity + prime age
    if (income >= 75000 && targetBrandAffinity >= 15 && age >= 25 && age <= 50) {
      return 'Premium Brand Loyalists';
    }
    
    // Emerging Young Adults: Young age + moderate income + high behavioral potential
    if (income >= 25000 && behavioralScore >= 50) {
      return 'Emerging Young Adults';
    }
    
    // Value-Conscious Families: Moderate income + family household + practical focus
    if (income >= 35000 && income <= 70000 && age >= 30 && age <= 50) {
      return 'Value-Conscious Families';
    }
    
    // Default to mixed profile
    return 'Mixed Customer Profile';
  }


  private calculateBrandLoyalty(record: any): number {
    const targetBrandAffinity = this.extractTargetBrandAffinity(record);
    const income = this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income']) || (record as any).income || 0;
    const age = (record as any).value_MEDAGE_CY || (record as any).age || 0;
    
    let loyaltyScore = 0;
    
    // Target brand affinity as primary loyalty indicator
    loyaltyScore += (targetBrandAffinity / 50) * 40;
    
    // Income stability (higher income = more brand loyal)
    if (income >= 50000) loyaltyScore += 30;
    else if (income >= 35000) loyaltyScore += 20;
    else loyaltyScore += 10;
    
    // Age stability (prime adults are more brand loyal)
    if (age >= 25 && age <= 50) loyaltyScore += 30;
    else if (age >= 18 && age <= 60) loyaltyScore += 20;
    else loyaltyScore += 10;
    
    return Math.min(100, loyaltyScore);
  }

  private calculateLifestyleAlignment(record: any): number {
    const age = (record as any).value_MEDAGE_CY || (record as any).age || 0;
    const income = this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income']) || (record as any).income || 0;
    const wealthIndex = (record as any).value_WLTHINDXCY || 100;
    const householdSize = (record as any).value_AVGHHSZ_CY || (record as any).household_size || 0;
    
    let alignmentScore = 0;
    
    // Active lifestyle age range
    if (age >= 18 && age <= 45) alignmentScore += 25;
    else if (age >= 16 && age <= 55) alignmentScore += 15;
    else alignmentScore += 5;
    
    // Lifestyle income (disposable income for brand purchases)
    if (income >= 50000) alignmentScore += 25;
    else if (income >= 35000) alignmentScore += 20;
    else if (income >= 25000) alignmentScore += 10;
    else alignmentScore += 5;
    
    // Wealth index lifestyle indicator
    alignmentScore += Math.min(25, (wealthIndex / 150) * 25);
    
    // Household composition (smaller households often more active/trendy)
    if (householdSize <= 2) alignmentScore += 15;
    else if (householdSize <= 4) alignmentScore += 10;
    else alignmentScore += 5;
    
    // Urban/professional lifestyle (higher income + smaller household)
    if (income >= 60000 && householdSize <= 3) alignmentScore += 10;
    
    return Math.min(100, alignmentScore);
  }

  private calculatePurchasePropensity(record: any): number {
    const age = (record as any).value_MEDAGE_CY || (record as any).age || 0;
    const income = this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income']) || (record as any).income || 0;
    const targetBrandAffinity = this.extractTargetBrandAffinity(record);
    const wealthIndex = (record as any).value_WLTHINDXCY || 100;
    
    let propensityScore = 0;
    
    // Core purchasing age
    if (age >= 16 && age <= 45) propensityScore += 25;
    else if (age >= 12 && age <= 55) propensityScore += 15;
    else propensityScore += 5;
    
    // Purchasing power
    if (income >= 40000) propensityScore += 30;
    else if (income >= 25000) propensityScore += 20;
    else if (income >= 15000) propensityScore += 10;
    else propensityScore += 5;
    
    // Brand preference (existing target brand customers likely to purchase more)
    propensityScore += (targetBrandAffinity / 50) * 25;
    
    // Wealth-driven propensity
    propensityScore += Math.min(20, (wealthIndex / 150) * 20);
    
    return Math.min(100, propensityScore);
  }

  private extractTargetBrandAffinity(record: any): number {
    // Try to use brand resolver to find target brand fields
    const brandFields = this.brandResolver?.detectBrandFields?.(record) || [];
    const targetBrand = brandFields.find((bf: any) => bf.isTarget);
    
    if (targetBrand?.value !== undefined) {
      return Number(targetBrand.value) || 0;
    }
    
    // Fallback to common brand affinity field names
    const affinityFields = [
      'brand_affinity', 'target_brand_affinity', 'brand_loyalty',
      'target_brand_preference', 'brand_strength', 'target_brand_share',
      'brand_preference_score', 'customer_brand_alignment'
    ];
    
    for (const fieldName of affinityFields) {
      const value = record[fieldName];
      if (value !== undefined && value !== null) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          return numValue;
        }
      }
    }
    
    // If no specific brand affinity fields found, calculate from demographic characteristics
    // This creates a synthetic brand affinity score based on customer profile factors
    const income = this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income']) || record.income || 0;
    const age = record.value_MEDAGE_CY || record.age || 0;
    const wealthIndex = record.value_WLTHINDXCY || 100;
    const population = this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population']) || record.population || 0;
    
    let syntheticAffinity = 0;
    
    // Age-based affinity (target demographic 16-45 years)
    if (age >= 16 && age <= 45) {
      syntheticAffinity += 15;
    } else if (age >= 12 && age <= 55) {
      syntheticAffinity += 10;
    } else {
      syntheticAffinity += 5;
    }
    
    // Income-based affinity (purchasing power)
    if (income >= 40000 && income <= 100000) {
      syntheticAffinity += 15;
    } else if (income >= 25000) {
      syntheticAffinity += 10;
    } else {
      syntheticAffinity += 3;
    }
    
    // Wealth index contribution
    if (wealthIndex > 120) {
      syntheticAffinity += 10;
    } else if (wealthIndex > 100) {
      syntheticAffinity += 5;
    }
    
    // Population density factor (urban markets often have higher brand presence)
    if (population > 10000) {
      syntheticAffinity += 5;
    } else if (population > 1000) {
      syntheticAffinity += 2;
    }
    
    return Math.min(50, syntheticAffinity); // Cap at 50 to match usage patterns
  }

  private extractProperties(record: any): Record<string, any> {
    const internalFields = new Set([
      'area_id', 'id', 'area_name', 'name', 'customer_profile_score',
      'coordinates', 'shap_values'
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
    
    const shapValues: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(record)) {
      if ((key.includes('shap') || key.includes('impact') || key.includes('contribution')) 
          && typeof value === 'number') {
        shapValues[key] = value;
      }
    }
    
    return shapValues;
  }

  private calculateCustomerProfileStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
    const scores = records.map(r => r.value);
  const demographicScores = records.map(r => Number((r.properties as any).demographic_alignment) || 0);
  const lifestyleScores = records.map(r => Number((r.properties as any).lifestyle_score) || 0);
  const behavioralScores = records.map(r => Number((r.properties as any).behavioral_score) || 0);
    
    if (scores.length === 0) {
      return {
        total: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0,
        avgDemographicAlignment: 0, avgLifestyleScore: 0, avgBehavioralScore: 0,
        avgTargetConfidence: 0
      };
    }
    
    const sorted = [...scores].sort((a, b) => a - b);
    const total = scores.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const mean = sum / total;
    
    const median = total % 2 === 0 
      ? (sorted[Math.floor(total / 2) - 1] + sorted[Math.floor(total / 2)]) / 2
      : sorted[Math.floor(total / 2)];
    
    const variance = scores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    // Customer profile-specific metrics
  const avgDemographicAlignment = demographicScores.reduce((a, b) => a + b, 0) / total;
  const avgLifestyleScore = lifestyleScores.reduce((a, b) => a + b, 0) / total;
  const avgBehavioralScore = behavioralScores.reduce((a, b) => a + b, 0) / total;
  const avgTargetConfidence = records.reduce((sum, r) => sum + (Number((r.properties as any).target_confidence) || 0), 0) / total;
    
    return {
      total,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev,
      avgDemographicAlignment,
      avgLifestyleScore,
      avgBehavioralScore,
      avgTargetConfidence
    };
  }

  private analyzeCustomerProfilePatterns(records: GeographicDataPoint[]): any {
    // Group by persona types
  const personaMap = new Map<string, GeographicDataPoint[]>();
    
    records.forEach(record => {
      const persona = String(((record as any).properties as any).persona_type || 'Unknown');
      if (!personaMap.has(persona)) {
        personaMap.set(persona, []);
      }
      personaMap.get(persona)!.push(record);
    });
    
    // Analyze each persona
    const personaAnalysis = Array.from(personaMap.entries()).map(([persona, personaRecords]) => {
      const avgScore = personaRecords.reduce((sum, r) => sum + r.value, 0) / personaRecords.length;
  const avgConfidence = personaRecords.reduce((sum, r) => sum + (Number((r.properties as any).target_confidence) || 0), 0) / personaRecords.length;
      
      return {
        persona,
        size: personaRecords.length,
        percentage: (personaRecords.length / records.length) * 100,
        avgCustomerProfileScore: avgScore,
        avgTargetConfidence: avgConfidence,
        topAreas: personaRecords
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map(r => ({
            name: r.area_name,
            score: r.value,
            confidence: Number((r.properties as any).target_confidence) || 0
          }))
      };
    });
    
    // Identify profile leaders and opportunities
    const profileLeaders = records
      .filter(r => r.value >= 75)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    const emergingOpportunities = records
      .filter(r => r.value >= 50 && r.value < 75 && ((Number((r.properties as any).target_confidence) || 0) >= 60))
      .sort((a, b) => ((Number((b.properties as any).target_confidence) || 0) - (Number((a.properties as any).target_confidence) || 0)))
      .slice(0, 5);
    
    return {
      personas: personaAnalysis,
      profileLeaders: profileLeaders.map(r => ({
        area: r.area_name,
        score: r.value,
  persona: (r.properties as any).persona_type,
  confidence: Number((r.properties as any).target_confidence) || 0
      })),
      emergingOpportunities: emergingOpportunities.map(r => ({
        area: r.area_name,
        currentScore: r.value,
  confidence: Number((r.properties as any).target_confidence) || 0,
  persona: (r.properties as any).persona_type
      })),
      marketDominance: this.assessMarketDominance(personaAnalysis)
    };
  }

  private assessMarketDominance(personaAnalysis: any[]): string {
    const enthusiastPercentage = personaAnalysis.find(p => p.persona === 'Brand Enthusiasts')?.percentage || 0;
    const professionalPercentage = personaAnalysis.find(p => p.persona === 'Fashion-Forward Professionals')?.percentage || 0;
    const premiumPercentage = personaAnalysis.find(p => p.persona === 'Premium Brand Loyalists')?.percentage || 0;
    
    if (enthusiastPercentage > 40) return 'Brand-Enthusiast Market';
    if (professionalPercentage > 35) return 'Professional-Focused Market';
    if (premiumPercentage > 30) return 'Premium-Oriented Market';
    if (enthusiastPercentage + professionalPercentage > 50) return 'Active-Professional Mix';
    return 'Diverse Customer Profile Mix';
  }

  private processCustomerProfileFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getCustomerProfileFeatureDescription((item as any).feature || (item as any).name),
      profileImpact: this.assessCustomerProfileImpact((item as any).importance || 0)
    })).sort((a, b) => b.importance - a.importance);
  }

  private getCustomerProfileFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'age': 'Age demographics and generational characteristics',
      'income': 'Income levels and purchasing power indicators',
      'lifestyle': 'Lifestyle patterns and activity preferences',
      'behavior': 'Purchase behavior and brand affinity patterns',
      'household': 'Household composition and family structure',
      'wealth': 'Wealth indicators and economic status',
      'brand': 'Target brand affinity and market presence',
      'demographic': 'Core demographic alignment factors',
      'propensity': 'Purchase propensity and buying likelihood',
      'loyalty': 'Brand loyalty and retention indicators'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} customer profile characteristic`;
  }

  private assessCustomerProfileImpact(importance: number): string {
    if (importance >= 0.8) return 'Critical Profile Driver';
    if (importance >= 0.6) return 'Significant Profile Factor';
    if (importance >= 0.4) return 'Moderate Profile Influence';
    if (importance >= 0.2) return 'Minor Profile Factor';
    return 'Minimal Profile Impact';
  }

  private generateCustomerProfileSummary(
    records: GeographicDataPoint[], 
    customerProfileAnalysis: any, 
    rawSummary?: string
  ): string {
    const totalAreas = records.length;
    const profileLeaders = customerProfileAnalysis.profileLeaders;
    const emergingOpportunities = customerProfileAnalysis.emergingOpportunities;
    const personas = customerProfileAnalysis.personas;
    const marketDominance = customerProfileAnalysis.marketDominance;
    
    // Calculate baseline metrics
    const avgScore = records.reduce((sum, r) => sum + r.value, 0) / records.length;
  const avgDemographic = records.reduce((sum, r) => sum + (Number((r.properties as any).demographic_alignment) || 0), 0) / records.length;
  const avgLifestyle = records.reduce((sum, r) => sum + (Number((r.properties as any).lifestyle_score) || 0), 0) / records.length;
  const avgBehavioral = records.reduce((sum, r) => sum + (Number((r.properties as any).behavioral_score) || 0), 0) / records.length;
  const avgConfidence = records.reduce((sum, r) => sum + (Number((r.properties as any).target_confidence) || 0), 0) / records.length;
    
    // Start with customer profile scoring explanation
    let summary = `**👤 Customer Profile Formula (0-100 scale):**
• **Demographic Alignment (30% weight):** Age, income, household fit with target brand's customer profile (16-45 years, $35K-$150K income)
• **Lifestyle Score (25% weight):** Activity patterns, wealth indicators, and lifestyle characteristics aligned with brand positioning
• **Behavioral Score (25% weight):** Brand affinity, purchase propensity, and loyalty indicators based on target brand market presence
• **Market Context Score (20% weight):** Market size, economic stability, competitive environment, and growth potential

Higher scores indicate stronger alignment with the target brand's ideal customer profile across multiple dimensions.

`;
    
    // Customer profile baseline metrics
    summary += `**📊 Customer Profile Baseline:** `;
    summary += `Market average customer profile score: ${avgScore.toFixed(1)} (range: ${records[records.length - 1]?.value.toFixed(1) || '0'}-${records[0]?.value.toFixed(1) || '0'}). `;
    summary += `Component averages: ${avgDemographic.toFixed(1)} demographic alignment, ${avgLifestyle.toFixed(1)} lifestyle score, ${avgBehavioral.toFixed(1)} behavioral score. `;
    summary += `Average target confidence: ${avgConfidence.toFixed(1)}%.

`;
    
    // Customer profile distribution
    const idealProfile = records.filter(r => r.value >= 90).length;
    const strongProfile = records.filter(r => r.value >= 75).length;
    const goodProfile = records.filter(r => r.value >= 60).length;
    const moderateProfile = records.filter(r => r.value >= 45).length;
    
    summary += `Customer profile distribution: ${idealProfile} ideal matches (${(idealProfile/totalAreas*100).toFixed(1)}%), ${strongProfile} strong fits (${(strongProfile/totalAreas*100).toFixed(1)}%), ${goodProfile} good alignments (${(goodProfile/totalAreas*100).toFixed(1)}%), ${moderateProfile} moderate potential (${(moderateProfile/totalAreas*100).toFixed(1)}%).

`;
    
    summary += `**Customer Profile Analysis:** Analyzed ${totalAreas} geographic markets to identify customer profile strength and persona distribution. `;
    
    // Top customer profile markets
    if (profileLeaders.length > 0) {
      summary += `**Strongest Customer Profile Markets:** ${profileLeaders[0].area} leads with ${profileLeaders[0].score.toFixed(1)} profile score (${profileLeaders[0].persona}, ${profileLeaders[0].confidence.toFixed(1)}% confidence). `;
      
      if (profileLeaders.length > 1) {
        const additionalLeaders = profileLeaders.slice(1, 4);
        const leaderNames = additionalLeaders.map((leader: any) => 
          `${leader.area} (${leader.score.toFixed(1)}, ${leader.persona})`
        );
        summary += `Other top markets: ${leaderNames.join(', ')}. `;
      }
    }
    
    // Persona breakdown
    if (personas.length > 0) {
      const topPersonas = personas.sort((a: any, b: any) => b.percentage - a.percentage).slice(0, 3);
      summary += `**Primary Customer Personas:** `;
      
      topPersonas.forEach((persona: any, index: number) => {
        summary += `${persona.persona} (${persona.size} markets, ${persona.percentage.toFixed(1)}%, avg score ${persona.avgCustomerProfileScore.toFixed(1)})`;
        if (index < topPersonas.length - 1) summary += ', ';
        else summary += '. ';
      });
      
      // Top areas for dominant persona
  if (topPersonas[0] && topPersonas[0].topAreas.length > 0) {
        const topAreas = topPersonas[0].topAreas.slice(0, 3);
        summary += `Top ${topPersonas[0].persona} markets: ${topAreas.map((area: any) => `${(area as any).name} (${(area as any).score.toFixed(1)})`).join(', ')}. `;
      }
    }
    
    // Emerging opportunities
    if (emergingOpportunities.length > 0) {
      summary += `**Emerging Opportunities:** `;
      const topEmergingAreas = emergingOpportunities.slice(0, 4);
      summary += topEmergingAreas.map((opp: any) => 
        `${opp.area} (${opp.currentScore.toFixed(1)} score, ${opp.confidence.toFixed(1)}% confidence, ${opp.persona})`
      ).join(', ');
      summary += '. ';
    }
    
    // Market dominance insights
    summary += `Market structure: ${marketDominance.replace(/-/g, ' ')}. `;
    
    // Component analysis insights
  const strongDemographic = records.filter(r => ((Number((r.properties as any).demographic_alignment) || 0) >= 70)).length;
  const strongLifestyle = records.filter(r => ((Number((r.properties as any).lifestyle_score) || 0) >= 70)).length;
  const strongBehavioral = records.filter(r => ((Number((r.properties as any).behavioral_score) || 0) >= 70)).length;
    
    summary += `**Component Strengths:** ${strongDemographic} markets with strong demographic alignment (${(strongDemographic/totalAreas*100).toFixed(1)}%), ${strongLifestyle} with strong lifestyle scores (${(strongLifestyle/totalAreas*100).toFixed(1)}%), ${strongBehavioral} with strong behavioral indicators (${(strongBehavioral/totalAreas*100).toFixed(1)}%). `;
    
    // Strategic recommendations
    summary += `**Strategic Insights:** `;
    if (avgScore >= 70) {
      summary += `Strong overall customer profile landscape with high alignment across multiple markets. `;
    } else if (avgScore >= 50) {
      summary += `Moderate customer profile strength with significant opportunities for targeted development. `;
    } else {
      summary += `Developing customer profile landscape requiring focused persona-based strategies. `;
    }
    
    summary += `**Recommendations:** Prioritize ${strongProfile} strong-fit markets for immediate expansion. Develop persona-specific strategies for different customer segments. Focus on ${emergingOpportunities.length} emerging opportunity markets with high confidence scores. `;
    
    if (rawSummary) {
      summary += rawSummary;
    }
    
    return summary;
  }

  // ============================================================================
  // DIRECT RENDERING METHODS
  // ============================================================================

  /**
   * Create direct renderer for customer profile visualization
   */
  private createCustomerProfileRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use standard red-to-green color scheme consistent with other endpoints
    const profileColors = [
      [215, 48, 39, 0.6],     // #d73027 - Red (low customer profile fit)
      [253, 174, 97, 0.6],    // #fdae61 - Orange  
      [166, 217, 106, 0.6],   // #a6d96a - Light Green
      [26, 152, 80, 0.6]      // #1a9850 - Dark Green (high customer profile fit)
    ];
    
    const fieldName = this.scoreField || 'customer_profile_score';
    return {
      type: 'class-breaks',
      field: fieldName, // Render on the primary customer profile score
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: 'simple-fill',
          color: profileColors[i], // Direct array format
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
   * Create direct legend for customer profile
   */
  private createCustomerProfileLegend(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use RGBA format with correct opacity to match features - standard red-to-green scheme
    const colors = [
      'rgba(215, 48, 39, 0.6)',   // Low customer profile fit
      'rgba(253, 174, 97, 0.6)',  // Medium-low  
      'rgba(166, 217, 106, 0.6)', // Medium-high
      'rgba(26, 152, 80, 0.6)'    // High customer profile fit
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
      title: 'Customer Profile Score',
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
   * Format class labels for legend
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
   * Calculate extent from geographic features for map zooming
   * Based on single-layer-visualization extent calculation method
   */
  private calculateExtentFromFeatures(records: GeographicDataPoint[]): Extent | null {
    if (!records || records.length === 0) {
      console.warn('[CustomerProfileProcessor] No records provided for extent calculation.');
      return null;
    }

    console.log(`[CustomerProfileProcessor] Calculating extent for ${records.length} customer profile records.`);

    // Filter for records with valid coordinates
    const validCoords = records
      .filter(record => 
        (record as any).coordinates && 
        Array.isArray((record as any).coordinates) && 
        (record as any).coordinates.length >= 2 &&
        isFinite((record as any).coordinates[0]) && 
        isFinite((record as any).coordinates[1])
      )
      .map(record => (record as any).coordinates);

    if (validCoords.length === 0) {
      console.warn('[CustomerProfileProcessor] No records with valid coordinates found.');
      return null;
    }

    console.log(`[CustomerProfileProcessor] Found ${validCoords.length} records with valid coordinates.`);

    // Calculate bounding box from coordinate points
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;

    validCoords.forEach(coord => {
      if (coord && coord.length >= 2) {
        const x = coord[0];
        const y = coord[1];
        xmin = Math.min(xmin, x);
        ymin = Math.min(ymin, y);
        xmax = Math.max(xmax, x);
        ymax = Math.max(ymax, y);
      }
    });

    // Validate calculated bounds
    if (!isFinite(xmin) || !isFinite(ymin) || !isFinite(xmax) || !isFinite(ymax)) {
      console.warn('[CustomerProfileProcessor] Invalid extent bounds calculated.');
      return null;
    }

    // Add small padding to ensure features are visible
    const paddingX = Math.max((xmax - xmin) * 0.1, 0.01); // 10% padding or minimum
    const paddingY = Math.max((ymax - ymin) * 0.1, 0.01);

    const extent = new Extent({
      xmin: xmin - paddingX,
      ymin: ymin - paddingY,
      xmax: xmax + paddingX,
      ymax: ymax + paddingY,
      spatialReference: { wkid: 4326 } // Assuming WGS84 coordinates
    });

    console.log(`[CustomerProfileProcessor] Calculated extent: ${JSON.stringify(extent.toJSON())}`);
    return extent;
  }
}