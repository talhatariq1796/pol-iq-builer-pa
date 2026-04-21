/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

/**
 * DemographicDataProcessor - Handles data processing for real estate demographic insights analysis
 * 
 * Processes demographic analysis results focused on housing market demographics including
 * household income, population characteristics, age distributions, and economic indicators
 * relevant to real estate investment and development opportunities.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class DemographicDataProcessor extends BaseProcessor {
  private scoreField: string | undefined;

  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Validate real estate demographic fields - check for housing market data structure
    const hasRealEstateDemographicFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        // Check for Quebec housing market demographic fields
        ((record as any).ECYPTAPOP !== undefined ||            // Population (Quebec data)
         (record as any).ECYHRIAVG !== undefined ||            // Household income (Quebec data)
         (record as any).value_TOTPOP_CY !== undefined ||      // Total population (other sources)
         (record as any).TOTPOP_CY !== undefined ||            // Total population (alternative)
         (record as any).value_DESCRIPTION !== undefined ||     // Area description
         (record as any).ID !== undefined ||                   // Area ID
         // Real estate demographic fields
         (record as any).demographic_insights_score !== undefined || 
         (record as any).real_estate_demographic_score !== undefined || 
         (record as any).demographic_score !== undefined ||    
         (record as any).total_population !== undefined ||     
         (record as any).household_income !== undefined ||        
         (record as any).value_AVGHINC_CY !== undefined ||     
         (record as any).value_MEDAGE_CY !== undefined ||      
         (record as any).population !== undefined ||           
         (record as any).income !== undefined ||
         // Housing-specific demographic indicators
         (record as any).ECYTENOWN !== undefined ||            // Home ownership
         (record as any).ECYTENRENT !== undefined ||           // Rental units
         (record as any).ECYMTN2534 !== undefined)             // Age 25-34 population
      );
    
    return hasRealEstateDemographicFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for DemographicDataProcessor');
    }

  // Resolve primary score field for reading values (may be legacy). Prefer canonical
  // demographic_insights_score if present in incoming records; otherwise fall back to the
  // hardcoded primary mapping so legacy names are respected.
  this.scoreField = getPrimaryScoreField('demographic_analysis', (rawData as any)?.metadata) || 'demographic_score';
  const hasPrimaryFieldInData = Array.isArray(rawData.results) && rawData.results.some(r => (r as any)[this.scoreField!] !== undefined);
  const hasCanonicalInData = Array.isArray(rawData.results) && rawData.results.some(r => (r as any)['demographic_insights_score'] !== undefined);
  const canonicalScoreField = hasPrimaryFieldInData ? this.scoreField! : (hasCanonicalInData ? 'demographic_insights_score' : this.scoreField!);

  // Process records with demographic information
  const records = this.processDemographicRecords(rawData.results);
    
    // Calculate demographic statistics
    const statistics = this.calculateDemographicStatistics(records);
    
    // Filter out national parks for business analysis - COMMENTED OUT FOR DEBUGGING
    /*
    const nonParkRecords = records.filter(record => {
      const props = (record.properties || {}) as Record<string, unknown>;
      const areaId = record.area_id || props.ID || props.id || '';
      const description = props.DESCRIPTION || props.description || '';
      
      // Filter out national parks using same logic as analysisLens
      if (String(areaId).startsWith('000')) return false;
      
      const nameStr = String(description).toLowerCase();
      const parkPatterns = [
        /national\s+park/i, /ntl\s+park/i, /national\s+monument/i, /national\s+forest/i, 
        /state\s+park/i, /\bpark\b.*national/i, /\bnational\b.*\bpark\b/i,
        /\bnp\b/i, /\bnm\b/i, /\bnf\b/i
      ];
      return !parkPatterns.some(pattern => pattern.test(nameStr));
    });
    */
    const nonParkRecords = records; // Use all records for debugging
    
    console.log(`🎯 [DEMOGRAPHIC DATA] Filtered ${records.length - nonParkRecords.length} parks from demographic analysis`);
    
    // Analyze demographic patterns using filtered records
    const demographicAnalysis = this.analyzeDemographicPatterns(nonParkRecords);
    
    // Process feature importance for demographic factors
    const featureImportance = this.processDemographicFeatureImportance(rawData.feature_importance || []);
    
    // Generate demographic summary using filtered records
    const summary = this.generateDemographicSummary(nonParkRecords, demographicAnalysis, rawData.summary);

    return {
      type: 'demographic_analysis',
      records: nonParkRecords, // Return filtered records to prevent park data in visualizations
      summary,
      featureImportance,
      statistics,
      targetVariable: canonicalScoreField,
      renderer: this.createDemographicRenderer(nonParkRecords), // Add direct renderer
      legend: this.createDemographicLegend(nonParkRecords), // Add direct legend
      demographicAnalysis // Additional metadata for demographic visualization
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  private processDemographicRecords(rawRecords: any[]): GeographicDataPoint[] {
    return rawRecords.map((record, index) => {
      const area_id = (record as any).ID || (record as any).area_id || (record as any).id || (record as any).GEOID || `area_${index}`;
      const area_name = (record as any).value_DESCRIPTION || (record as any).DESCRIPTION || (record as any).area_name || (record as any).name || (record as any).NAME || `Area ${index + 1}`;
      
      // Extract demographic score
      const demographicScore = this.extractDemographicScore(record);
      
  // Use demographic score as the primary value
  const value = demographicScore;
      
      // Extract demographic-specific properties (updated for actual dataset fields)
      const properties = {
        ...this.extractProperties(record),
        demographic_insights_score: demographicScore,
        demographic_opportunity_score: demographicScore, // Legacy compatibility
        population: (record as any).value_TOTPOP_CY || (record as any).TOTPOP_CY || (record as any).total_population || (record as any).population || 0,
        avg_income: (record as any).value_MEDDI_CY || (record as any).value_AVGHINC_CY || (record as any).median_income || (record as any).income || 0,
        median_age: (record as any).value_MEDAGE_CY || (record as any).age || 0,
        household_size: (record as any).value_AVGHHSZ_CY || (record as any).household_size || 0,
        white_population: (record as any).value_WHITE_CY || (record as any).white_population || 0,
        asian_population: (record as any).value_ASIAN_CY || (record as any).asian_population || 0,
        black_population: (record as any).value_BLACK_CY || (record as any).black_population || 0,
        diversity_index: (record as any).value_DIVINDX_CY || this.calculateDiversityIndex(record),
        lifestyle_score: this.calculateLifestyleScore(record),
        economic_stability: this.calculateEconomicStability(record)
      };
      
      // Extract SHAP values
      const shapValues = this.extractShapValues(record);
      
      // Category based on demographic characteristics
      const category = this.getDemographicCategory(demographicScore, properties);

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

      // Mirror canonical scoring field into top-level and properties for downstream consumers
      outRec[this.scoreField!] = demographicScore;
      (outRec.properties as any)[this.scoreField!] = demographicScore;

      return outRec;
    }).sort((a, b) => b.value - a.value) // Sort by demographic score
      .map((record, index) => ({ ...record, rank: index + 1 })); // Assign ranks
  }

  private extractDemographicScore(record: any): number {
    // PRIORITY 1: PRE-CALCULATED REAL ESTATE DEMOGRAPHIC SCORES
    if (((record as any).demographic_insights_score !== undefined && (record as any).demographic_insights_score !== null) ||
        ((record as any).real_estate_demographic_score !== undefined && (record as any).real_estate_demographic_score !== null) ||
        ((record as any).demographic_score !== undefined && (record as any).demographic_score !== null)) {
      const preCalculatedScore = Number((record as any).demographic_insights_score || (record as any).real_estate_demographic_score || (record as any).demographic_score);
      
      // Use the pre-calculated demographic score for real estate markets
      console.log(`🎯 [DemographicDataProcessor] Using pre-calculated real estate demographic score: ${preCalculatedScore} for ${(record as any).DESCRIPTION || (record as any).area_name || 'Unknown'}`);
      return preCalculatedScore;
    }
    
    // PRIORITY 2: Calculate real estate demographic fit score from housing market data
    // Use configuration-driven field extraction for Quebec housing market data
    const population = this.extractNumericValue(record, this.configManager.getFieldMapping('populationField'), 0);
    const householdIncome = this.extractNumericValue(record, this.configManager.getFieldMapping('incomeField'), 0);
    const homeOwnership = this.extractNumericValue(record, ['ECYTENOWN', 'home_ownership_count', 'homeowners'], 0);
    const rentalUnits = this.extractNumericValue(record, ['ECYTENRENT', 'rental_count', 'renters'], 0);
    const youngAdults = this.extractNumericValue(record, ['ECYMTN2534', 'population_25_34', 'age_25_34'], 0);
    
    // Calculate real estate demographic score (0-100) focused on housing market potential
    let realEstateDemographicScore = 0;
    
    // Household Income component (40% weight) - higher income indicates better real estate market
    const incomeScore = householdIncome > 0 ? Math.min((householdIncome / 100000) * 40, 40) : 0;
    
    // Population Market Size component (25% weight) - larger markets have more opportunities
    const populationScore = population > 0 ? Math.min((population / 50000) * 25, 25) : 0;
    
    // Housing Market Activity component (20% weight) - balance of ownership vs rental
    const totalHousing = homeOwnership + rentalUnits;
    const housingActivityScore = totalHousing > 0 ? Math.min((totalHousing / 10000) * 20, 20) : 0;
    
    // Young Adult Demographics component (15% weight) - key home buying demographic
    const youngAdultScore = youngAdults > 0 ? Math.min((youngAdults / population) * 100 * 15, 15) : 0;
    
    realEstateDemographicScore = incomeScore + populationScore + housingActivityScore + youngAdultScore;
    
    // Try explicit real estate demographic score fields as fallback
    const explicitScoreFields = [
      'real_estate_demographic_score', 'housing_demographic_score', 'demographic_score', 
      'housing_market_score', 'residential_demographic_score'
    ];
    
    for (const field of explicitScoreFields) {
      if (record[field] !== undefined && record[field] !== null) {
        const score = Number(record[field]);
        if (!isNaN(score)) {
          return Math.max(0, Math.min(100, score)); // Normalize to 0-100
        }
      }
    }
    
    console.log('⚠️ [DemographicDataProcessor] No pre-calculated real estate demographic score found, using housing market calculation');
    return Math.max(0, Math.min(100, realEstateDemographicScore));
  }

  private calculateDiversityIndex(record: any): number {
    // Simplified diversity calculation - would be more complex in real implementation
    const factors = [];
    
    if ((record as any).ethnic_diversity) factors.push((record as any).ethnic_diversity);
    if ((record as any).age_diversity) factors.push((record as any).age_diversity);
    if ((record as any).income_diversity) factors.push((record as any).income_diversity);
    
    if (factors.length > 0) {
      return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
    }
    
    // Default calculation based on available data
    const income = (record as any).value_AVGHINC_CY || 50000;
    const age = (record as any).value_MEDAGE_CY || 40;
    
    // Higher diversity in mixed income/age areas
    return Math.min(1, (Math.abs(income - 60000) / 30000 + Math.abs(age - 40) / 20) / 2);
  }

  private calculateLifestyleScore(record: any): number {
    // Calculate lifestyle fit based on demographic characteristics
    const income = (record as any).value_AVGHINC_CY || 0;
    const age = (record as any).value_MEDAGE_CY || 0;
    const householdSize = (record as any).value_AVGHHSZ_CY || 0;
    
    // Target lifestyle: moderate-high income, working age, small families
    let lifestyleScore = 0;
    
    if (income > 50000 && income < 120000) lifestyleScore += 0.3;
    if (age > 25 && age < 50) lifestyleScore += 0.3;
    if (householdSize > 1.5 && householdSize < 4) lifestyleScore += 0.2;
    if ((record as any).education_level === 'college' || (record as any).education_score > 0.6) lifestyleScore += 0.2;
    
    return Math.min(1, lifestyleScore);
  }

  private calculateEconomicStability(record: any): number {
    // Calculate economic stability indicators
    const income = (record as any).value_AVGHINC_CY || 0;
    const unemploymentRate = (record as any).unemployment_rate || 0.05; // Default 5%
    const householdSize = (record as any).value_AVGHHSZ_CY || 2;
    
    let stabilityScore = 0;
    
    // Income stability (higher income = more stable)
    stabilityScore += Math.min(0.4, income / 125000);
    
    // Employment stability (lower unemployment = more stable)
    stabilityScore += Math.max(0, 0.3 - unemploymentRate * 3);
    
    // Household stability (moderate size indicates stability)
    const householdStability = 1 - Math.abs(householdSize - 2.5) / 2.5;
    stabilityScore += householdStability * 0.3;
    
    return Math.min(1, stabilityScore);
  }

  private extractProperties(record: any): Record<string, any> {
    const internalFields = new Set([
      'area_id', 'id', 'area_name', 'name', 'demographic_insights_score', 'demographic_score',
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

  private getDemographicCategory(score: number, properties: any): string {
    // Categorize based on demographic characteristics
    const income = properties.avg_income || 0;
    const age = properties.median_age || 0;
    
    if (score >= 80) return 'optimal_demographics';
    if (score >= 60) return 'strong_demographics';
    if (score >= 40) return 'moderate_demographics';
    if (score >= 20) return 'developing_demographics';
    return 'emerging_demographics';
  }

  private calculateDemographicStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
    const scores = records.map(r => r.value);
    const incomes = records.map(r => (r.properties as any).avg_income || 0);
    const ages = records.map(r => (r.properties as any).median_age || 0);
    
    if (scores.length === 0) {
      return {
        total: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0,
        avgIncome: 0, medianAge: 0, diversityIndex: 0
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
    
    // Demographic-specific metrics
    const avgIncome = incomes.reduce((a, b) => a + b, 0) / total;
    const medianAge = ages.reduce((a, b) => a + b, 0) / total;
    const diversityIndex = records.reduce((sum, r) => sum + ((r.properties as any).diversity_index || 0), 0) / total;
    
    return {
      total,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev,
      avgIncome,
      medianAge,
      diversityIndex
    };
  }

  private analyzeDemographicPatterns(records: GeographicDataPoint[]): any {
    // Group by demographic categories
    const categoryMap = new Map<string, GeographicDataPoint[]>();
    
    records.forEach(record => {
      const category = (record as any).category!;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(record);
    });
    
    // Analyze each category
    const categoryAnalysis = Array.from(categoryMap.entries()).map(([category, categoryRecords]) => {
      const avgScore = categoryRecords.reduce((sum, r) => sum + r.value, 0) / categoryRecords.length;
      const avgIncome = categoryRecords.reduce((sum, r) => sum + ((r.properties as any).avg_income || 0), 0) / categoryRecords.length;
      
      return {
        category,
        size: categoryRecords.length,
        percentage: (categoryRecords.length / records.length) * 100,
        avgDemographicScore: avgScore,
        avgIncome,
        topAreas: categoryRecords
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map(r => ({
            name: r.area_name,
            score: r.value,
            income: (r.properties as any).avg_income,
            age: (r.properties as any).median_age
          }))
      };
    });
    
    // Identify demographic leaders and targets
    const demographicLeaders = records
      .filter(r => r.category === 'optimal_demographics')
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    const growthTargets = records
      .filter(r => ['moderate_demographics', 'developing_demographics'].includes(r.category!))
      .sort((a, b) => (b.properties as any).economic_stability - (a.properties as any).economic_stability)
      .slice(0, 5);
    
    return {
      categories: categoryAnalysis,
      demographicLeaders: demographicLeaders.map(r => ({
        area: r.area_name,
        score: r.value,
        income: (r.properties as any).avg_income,
        age: (r.properties as any).median_age,
        stability: (r.properties as any).economic_stability
      })),
      growthTargets: growthTargets.map(r => ({
        area: r.area_name,
        currentScore: r.value,
        stability: (r.properties as any).economic_stability,
        potential: 'high'
      })),
      marketSegmentation: this.analyzeMarketSegmentation(categoryAnalysis)
    };
  }

  private analyzeMarketSegmentation(categoryAnalysis: any[]): string {
    const optimalPercentage = categoryAnalysis.find(c => c.category === 'optimal_demographics')?.percentage || 0;
    const strongPercentage = categoryAnalysis.find(c => c.category === 'strong_demographics')?.percentage || 0;
    
    if (optimalPercentage > 40) return 'premium_market_dominated';
    if (optimalPercentage + strongPercentage > 60) return 'upscale_market_focused';
    if (strongPercentage > 40) return 'middle_market_strong';
    return 'diverse_market_mix';
  }

  private processDemographicFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getDemographicFeatureDescription((item as any).feature || (item as any).name),
      demographicImpact: this.assessDemographicImpact((item as any).importance || 0)
    })).sort((a, b) => b.importance - a.importance);
  }

  private getDemographicFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'income': 'Household income levels and purchasing power',
      'age': 'Age demographics and generational characteristics',
      'population': 'Population density and market size',
      'education': 'Education levels and professional demographics',
      'household_size': 'Family size and household composition',
      'diversity': 'Cultural and economic diversity indicators',
      'lifestyle': 'Lifestyle patterns and consumer behavior',
      'employment': 'Employment rates and job market strength'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} demographic characteristic`;
  }

  private assessDemographicImpact(importance: number): string {
    if (importance >= 0.8) return 'primary_demographic_driver';
    if (importance >= 0.6) return 'significant_demographic_factor';
    if (importance >= 0.4) return 'moderate_demographic_influence';
    if (importance >= 0.2) return 'minor_demographic_factor';
    return 'negligible_demographic_impact';
  }

  private generateDemographicSummary(
    records: GeographicDataPoint[], 
    demographicAnalysis: any, 
    rawSummary?: string
  ): string {
    const totalAreas = records.length;
    const demographicLeaders = demographicAnalysis.demographicLeaders;
    const growthTargets = demographicAnalysis.growthTargets;
    const marketSegmentation = demographicAnalysis.marketSegmentation;
    
    // Calculate baseline metrics first
    const avgScore = records.reduce((sum, r) => sum + r.value, 0) / records.length;
    const avgIncome = records.reduce((sum, r) => sum + ((r.properties as any).avg_income || 0), 0) / records.length;
    const avgAge = records.reduce((sum, r) => sum + ((r.properties as any).median_age || 0), 0) / records.length;
    
    // Start with formula explanation
    let summary = `**📊 Demographic Fit Formula (0-100 scale):**
• **Income Component (30 points):** Economic capability, optimal $40K-$100K range\n• **Population Component (25 points):** Market size and density factors\n• **Age Component (25 points):** Target demographics, optimal 25-45 years (peak at 35)\n• **Household Component (20 points):** Family size, optimal 2-4 people (peak at 3)\n\nHigher scores indicate better demographic alignment with target brand markets.\n
`;
    
    // Enhanced baseline and demographic metrics section
    summary += `**👥 Demographic Baseline & Market Averages:** `;
    summary += `Market average demographic score: ${avgScore.toFixed(1)} (range: ${records[records.length - 1]?.value.toFixed(1) || '0'}-${records[0]?.value.toFixed(1) || '0'}). `;
    
    // Calculate demographic baselines
    const avgPopulation = records.reduce((sum, r) => sum + ((r.properties as any).population || 0), 0) / totalAreas;
    const avgDiversityIndex = records.reduce((sum, r) => sum + ((r.properties as any).diversity_index || 0), 0) / totalAreas;
    const avgHouseholdSize = records.reduce((sum, r) => sum + ((r.properties as any).household_size || 0), 0) / totalAreas;
    const avgEconomicStability = records.reduce((sum, r) => sum + ((r.properties as any).economic_stability || 0), 0) / totalAreas;
    
    summary += `Demographic baseline: $${(avgIncome/1000).toFixed(0)}K income, ${avgAge.toFixed(0)} median age, ${(avgPopulation/1000).toFixed(0)}K population. `;
    summary += `Market characteristics: ${avgHouseholdSize.toFixed(1)} avg household size, ${(avgDiversityIndex*100).toFixed(1)}% diversity index, ${(avgEconomicStability*100).toFixed(1)}% economic stability. `;
    
    // Demographic fit distribution
    const optimalDemo = records.filter(r => r.value >= 70).length;
    const strongDemo = records.filter(r => r.value >= 50).length;
    const moderateDemo = records.filter(r => r.value >= 30).length;
    
    summary += `Demographic fit distribution: ${optimalDemo} optimal markets (${(optimalDemo/totalAreas*100).toFixed(1)}%), ${strongDemo} strong+ (${(strongDemo/totalAreas*100).toFixed(1)}%), ${moderateDemo} moderate+ (${(moderateDemo/totalAreas*100).toFixed(1)}%).

`;
    
    summary += `**Demographic Analysis Complete:** ${totalAreas} geographic markets analyzed across key demographic indicators. `;
    
    // Enhanced demographic leaders section with multiple examples
    if (demographicLeaders.length > 0) {
      const topLeader = demographicLeaders[0];
      summary += `**Optimal Demographics:** ${topLeader.area} leads with ${topLeader.score.toFixed(1)} demographic score, $${(topLeader.income/1000).toFixed(0)}K income, and ${topLeader.age.toFixed(0)} median age. `;
      
      // Add additional demographic leaders (2-5 areas)
      if (demographicLeaders.length > 1) {
        const additionalLeaders = demographicLeaders.slice(1, 5);
        const leaderNames = additionalLeaders.map((leader: any) => 
          `${leader.area} (${leader.score.toFixed(1)} score, $${(leader.income/1000).toFixed(0)}K)`
        );
        
        if (leaderNames.length > 0) {
          summary += `Other premium markets include ${leaderNames.join(', ')}. `;
        }
      }
    }
    
    // Enhanced category breakdown with specific examples
    const categoryBreakdown = demographicAnalysis.categories;
    if (categoryBreakdown.length > 0) {
      const optimalCategory = categoryBreakdown.find((c: any) => c.category === 'optimal_demographics');
      const strongCategory = categoryBreakdown.find((c: any) => c.category === 'strong_demographics');
      const moderateCategory = categoryBreakdown.find((c: any) => c.category === 'moderate_demographics');
      
      if (optimalCategory && optimalCategory.size > 0) {
        summary += `**${optimalCategory.size} Optimal Markets** (${optimalCategory.percentage.toFixed(1)}%): `;
        const topOptimal = optimalCategory.topAreas.slice(0, 3);
        summary += topOptimal.map((area: any) => `${(area as any).name} ($${((area as any).income/1000).toFixed(0)}K)`).join(', ');
        summary += '. ';
      }
      
      if (strongCategory && strongCategory.size > 0) {
        summary += `**${strongCategory.size} Strong Markets** (${strongCategory.percentage.toFixed(1)}%): `;
        const topStrong = strongCategory.topAreas.slice(0, 3);
        summary += topStrong.map((area: any) => `${(area as any).name} ($${((area as any).income/1000).toFixed(0)}K)`).join(', ');
        summary += '. ';
      }
    }
    
    // Enhanced growth targets with detailed examples
    if (growthTargets.length > 0) {
      summary += `**${growthTargets.length} Growth Targets:** `;
      
      // Detailed first target
      const topTarget = growthTargets[0];
      summary += `${topTarget.area} shows high potential with ${topTarget.currentScore.toFixed(1)} current score and strong economic stability. `;
      
      // Additional targets (2-6 areas)
      if (growthTargets.length > 1) {
        const additionalTargets = growthTargets.slice(1, 6);
        const targetNames = additionalTargets.map((target: any) => 
          `${target.area} (${target.currentScore.toFixed(1)} score)`
        );
        
        if (targetNames.length > 0) {
          summary += `Additional targets: ${targetNames.join(', ')}. `;
        }
      }
    }
    
    // Market segmentation insights
    summary += `Market structure: ${marketSegmentation.replace('_', ' ')}. `;
    
    // Add demographic insights (variables already calculated above)
    
    summary += `**Market Overview:** Average demographic score ${avgScore.toFixed(1)}, median income $${(avgIncome/1000).toFixed(0)}K, median age ${avgAge.toFixed(0)}. `;
    
    // Strategic recommendations
    summary += `**Strategic Insights:** Target demographics favor `;
    if (avgIncome > 70000) {
      summary += `premium positioning with high-income focus. `;
    } else if (avgIncome > 45000) {
      summary += `middle-market positioning with value emphasis. `;
    } else {
      summary += `accessible positioning with price sensitivity. `;
    }
    
    summary += `**Recommendations:** Prioritize optimal demographic markets for immediate expansion. Develop targeted programs for strong demographic areas. Invest in long-term growth targets with economic stability. `;
    
    if (rawSummary) {
      summary += rawSummary;
    }
    
    return summary;
  }

  // ============================================================================
  // DIRECT RENDERING METHODS
  // ============================================================================

  /**
   * Create direct renderer for demographic analysis visualization
   */
  private createDemographicRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);

    // Detect geometry type to determine symbol type
    const sampleGeometryRecord = records.find(r => r.geometry);
    const sampleGeometryType = sampleGeometryRecord && (sampleGeometryRecord.geometry as any)?.type;
    const isPointGeometry = typeof sampleGeometryType === 'string' && sampleGeometryType.toLowerCase() === 'point';

    // Use same colors as strategic analysis: Red (low) -> Orange -> Light Green -> Dark Green (high)
    const demographicColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (lowest demographic opportunity)
      [253, 174, 97, 0.6],  // #fdae61 - Orange
      [166, 217, 106, 0.6], // #a6d96a - Light Green
      [26, 152, 80, 0.6]    // #1a9850 - Dark Green (highest demographic opportunity)
    ];

    // Use the resolved scoreField when available so renderer.field matches the returned targetVariable
    const fieldName = this.scoreField || 'value';
    return {
      type: 'class-breaks',
      field: fieldName, // Use the main value field that ArcGIS can access
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: isPointGeometry ? 'simple-marker' : 'simple-fill',
          color: demographicColors[i], // Direct array format
          size: isPointGeometry ? 12 : undefined,
          style: isPointGeometry ? 'circle' : undefined,
          outline: isPointGeometry
            ? { color: [255, 255, 255, 0.9], width: 0.8 }
            : { color: [0, 0, 0, 0], width: 0 }
        },
        label: this.formatClassLabel(i, quartileBreaks)
      })),
      defaultSymbol: {
        type: isPointGeometry ? 'simple-marker' : 'simple-fill',
        color: [200, 200, 200, 0.5],
        size: isPointGeometry ? 10 : undefined,
        style: isPointGeometry ? 'circle' : undefined,
        outline: isPointGeometry
          ? { color: [255, 255, 255, 0.9], width: 0.7 }
          : { color: [0, 0, 0, 0], width: 0 }
      }
    };
  }

  /**
   * Create direct legend for demographic analysis
   */
  private createDemographicLegend(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);

    // Detect geometry type to determine legend symbol type
    const sampleGeometryRecord = records.find(r => r.geometry);
    const sampleGeometryType = sampleGeometryRecord && (sampleGeometryRecord.geometry as any)?.type;
    const isPointGeometry = typeof sampleGeometryType === 'string' && sampleGeometryType.toLowerCase() === 'point';

    // Use RGBA format with correct opacity to match features (same as strategic)
    const colors = [
      'rgba(215, 48, 39, 0.6)',   // Low demographic opportunity
      'rgba(253, 174, 97, 0.6)',  // Medium-low
      'rgba(166, 217, 106, 0.6)', // Medium-high
      'rgba(26, 152, 80, 0.6)'    // High demographic opportunity
    ];

    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length; i++) {
      const item: any = {
        label: this.formatClassLabel(i, quartileBreaks),
        color: colors[i],
        minValue: quartileBreaks[i].min,
        maxValue: quartileBreaks[i].max
      };

      // For point geometries, specify symbol type and size
      if (isPointGeometry) {
        item.symbolType = 'circle';
        item.size = 12;
        item.outline = { color: 'rgba(255, 255, 255, 0.9)', width: 0.8 };
      }

      legendItems.push(item);
    }

    return {
      title: 'Demographic Opportunity Score',
      items: legendItems,
      symbolType: isPointGeometry ? 'point' : 'polygon',
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
} 