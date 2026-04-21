/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';
import { GeoDataManager } from '../../../geo/GeoDataManager';
import { resolveAreaName } from '../../../shared/AreaName';
import { BaseProcessor } from './BaseProcessor';
interface RegionalMetric {
  value: number;
  fieldName: string;
  regionName: string;
}

/**
 * ComparativeAnalysisProcessor - Handles data processing for the /comparative-analysis endpoint
 * 
 * Processes comparative analysis results with focus on relative performance between different 
 * geographic regions and housing markets to identify investment opportunities and market positioning.
 * 
 * Now extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class ComparativeAnalysisProcessor extends BaseProcessor {
  private geoDataManager: any = null;
  
  constructor() {
    super(); // Initialize BaseProcessor with configuration
    // Using configuration-driven approach for real estate comparisons
  }

  /**
   * Update field aliases for dynamic regional naming (now unused)
   */
  updateFieldAliases(): void {
    // Using configuration-driven field mappings for real estate analysis
  }
  
  private getGeoDataManager() {
    if (!this.geoDataManager) {
      this.geoDataManager = GeoDataManager.getInstance();
    }
    return this.geoDataManager;
  }
  
  private extractCityFromRecord(record: any): string {
    // First check if there's an explicit city field
    if ((record as any).city) return (record as any).city;
    
    // Extract ZIP code and map to city using GeoDataManager
    const zipCode = (record as any).ID || (record as any).id || (record as any).area_id || (record as any).zipcode;
    if (zipCode) {
      const zipStr = String(zipCode);
      const database = this.getGeoDataManager().getDatabase();
      const city = database.zipCodeToCity.get(zipStr);
      if (city) {
        // Capitalize first letter of each word
        const formattedCity = city.split(' ').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        return formattedCity;
      }
    }
    
    return 'Unknown';
  }
  
  validate(rawData: RawAnalysisResult): boolean {
    console.log(`🔍 [ComparativeAnalysisProcessor] Validating data:`, {
      hasRawData: !!rawData,
      isObject: typeof rawData === 'object',
      hasSuccess: rawData?.success,
      hasResults: Array.isArray(rawData?.results),
      resultsLength: rawData?.results?.length,
  firstRecordKeys: rawData?.results?.[0] ? Object.keys(rawData.results[0] as any).slice(0, 15) : []
    });

    if (!rawData || typeof rawData !== 'object') {
      console.log(`❌ [ComparativeAnalysisProcessor] Validation failed: Invalid rawData structure`);
      return false;
    }
    if (!rawData.success) {
      console.log(`❌ [ComparativeAnalysisProcessor] Validation failed: success=false`);
      return false;
    }
    if (!Array.isArray(rawData.results)) {
      console.log(`❌ [ComparativeAnalysisProcessor] Validation failed: results not array`);
      return false;
    }
    
    // Empty results are valid
    if (rawData.results.length === 0) {
      console.log(`✅ [ComparativeAnalysisProcessor] Validation passed: Empty results`);
      return true;
    }

    // Check first few records for required fields - be more flexible with ID fields
  const sampleSize = Math.min(5, rawData.results.length);
  const sampleRecords = (rawData.results as any[]).slice(0, sampleSize);
    
    for (let i = 0; i < sampleRecords.length; i++) {
  const record = sampleRecords[i] as any;
      
      // Check for ID field (flexible naming)
      const hasIdField = record && (
        (record as any).area_id !== undefined || 
        (record as any).id !== undefined || 
        (record as any).ID !== undefined ||
        (record as any).GEOID !== undefined ||
        (record as any).zipcode !== undefined ||
        (record as any).area_name !== undefined
      );
      
      // Check for at least one scoring/value field using hardcoded primary
    const primary = getPrimaryScoreField('comparative_analysis', (rawData as any)?.metadata) || 'comparison_score';
        const hasScoringField = record && (
          (record as any)[primary] !== undefined ||
          (record as any).comparative_score !== undefined || 
          (record as any).comparison_score !== undefined ||
          (record as any).target_value !== undefined ||
          (record as any).value !== undefined || 
          (record as any).score !== undefined ||
          (record as any).thematic_value !== undefined
        );
      
      console.log(`🔍 [ComparativeAnalysisProcessor] Record ${i} validation:`, {
        hasIdField,
        hasScoringField,
  recordKeys: Object.keys(record as any).slice(0, 10)
      });
      
      if (hasIdField && hasScoringField) {
        console.log(`✅ [ComparativeAnalysisProcessor] Validation passed: Found valid record structure`);
        return true;
      }
    }
    
    console.log(`❌ [ComparativeAnalysisProcessor] Validation failed: No records with both ID and scoring fields found`);
    return false;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    this.log(`Processing ${rawData.results?.length || 0} records`);
    
    // DEBUG: Log ALL ZIP codes received by processor
    if (rawData.results && rawData.results.length > 0) {
      const resultsAny = rawData.results as any[];
      const allZips = resultsAny.map(r => r.ID || r.area_name || r.zipcode || 'unknown');
      console.log(`🔍 [COMPARATIVE PROCESSOR] DEBUGGING: ALL ${allZips.length} ZIP codes received:`, allZips);
      
      // Check which cities are represented
      const cityCount = resultsAny.reduce((acc: Record<string, number>, r: any) => {
        const city = this.extractCityFromRecord(r);
        acc[city] = (acc[city] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`🔍 [COMPARATIVE PROCESSOR] DEBUGGING: City distribution:`, cityCount);
    }
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for ComparativeAnalysisProcessor');
    }

    // Determine canonical primary score for comparative analysis (metadata override allowed)
    const primary = getPrimaryScoreField('comparative_analysis', (rawData as any)?.metadata) || 'comparison_score';

    // Find global min and max for unified scaling across all cities
    const allScores = (rawData.results as any[]).map(record => 
      this.extractPrimaryMetric(record)
    ).filter(score => !isNaN(score));
    
    const globalMin = Math.min(...allScores);
    const globalMax = Math.max(...allScores);
    const globalRange = globalMax - globalMin || 1; // Avoid division by zero
    
    this.log(`Global scale: min=${globalMin.toFixed(2)}, max=${globalMax.toFixed(2)}, range=${globalRange.toFixed(2)}`);
    
    // Group records by city for analysis (but use global scale)
    const recordsByCity = new Map<string, any[]>();
    (rawData.results as any[]).forEach((record: any) => {
      const city = this.extractCityFromRecord(record);
      if (!recordsByCity.has(city)) {
        recordsByCity.set(city, []);
      }
      recordsByCity.get(city)!.push(record);
    });
    
    this.log(`Grouped records by city`, 
      Array.from(recordsByCity.entries()).map(([city, records]) => ({ city, count: records.length }))
    );
    
    // Process records with globally-normalized scores (same scale for all cities)
    const processedRecords = (rawData.results as any[]).map((record: any, index: number) => {
      // Extract simple brand metrics used throughout comparative calculations
      const brandAMetric = this.extractBrandMetric(record, 'brand_a');
      const brandBMetric = this.extractBrandMetric(record, 'brand_b');
      const brandDominance = (brandAMetric?.value || 0) - (brandBMetric?.value || 0);
      const totalBrandShare = (brandAMetric?.value || 0) + (brandBMetric?.value || 0);
      const brandPerformanceGap = this.calculateRegionalPerformanceGap(record);
      // Get original score and normalize to 0-100 using GLOBAL scale
      const originalScore = this.extractPrimaryMetric(record);
      const normalizedScore = ((originalScore - globalMin) / globalRange) * 100;
      
      // Use globally-normalized score
      const comparativeScore = normalizedScore;
      
      // Get city for metadata
      const city = this.extractCityFromRecord(record);
      const recordId = (record as any).ID || (record as any).id || (record as any).area_id || `${city}_${index}`;
      
      // Generate area name using configuration-driven method
      const areaName = super.generateAreaName(record);
      
      // Debug logging for records with missing ID
      if (!recordId) {
        console.warn(`[ComparativeAnalysisProcessor] Record ${index} missing ID:`, {
          hasID: 'ID' in record,
          hasId: 'id' in record,
          hasAreaId: 'area_id' in record,
          recordKeys: Object.keys(record as any).slice(0, 10)
        });
      }
      
      // Extract comparative-relevant metrics for properties (generic approach)
      const regionAMetric = this.extractRegionalMetric(record, 'region_a');
      const regionBMetric = this.extractRegionalMetric(record, 'region_b');
      const strategicScore = Number((record as any).strategic_value_score) || 0;
      const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
      const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
      const trendScore = Number((record as any).trend_strength_score) || 0;
      const totalPop = this.extractNumericValue(record, this.configManager.getFieldMapping('populationField'), 0);
      const medianIncome = this.extractNumericValue(record, this.configManager.getFieldMapping('incomeField'), 0);
      
      // Calculate comparative indicators
      const regionalPerformanceGap = this.calculateRegionalPerformanceGap(record);
      const marketPositionStrength = this.calculateMarketPositionStrength(record);
      const competitiveDynamicsLevel = this.calculateCompetitiveDynamicsLevel(record);
      const growthDifferential = this.calculateGrowthDifferential(record);
      
      // Calculate regional dominance and market metrics for real estate
    // regionalDominance computed later when needed
      const totalRegionalScore = regionAMetric.value + regionBMetric.value;
      const marketGap = Math.max(0, 100 - totalRegionalScore);
      
      return {
        area_id: recordId || `area_${index + 1}`,
        area_name: areaName,
        city: city, // Add city for grouping
        value: Math.round(comparativeScore * 100) / 100, // Use comparative score as primary value
  comparison_score: Math.round(comparativeScore * 100) / 100, // Add comparison_score at top level for visualization
  // Expose canonical primary field for consumers
  [primary]: Math.round(comparativeScore * 100) / 100,
  competitive_advantage_score: Math.round(comparativeScore * 100) / 100, // Keep for compatibility
        rank: 0, // Will be calculated after sorting
        properties: {
          DESCRIPTION: (record as any).DESCRIPTION, // Pass through original DESCRIPTION
          city: city, // Include city in properties too
          competitive_advantage_score: comparativeScore, // Primary field for competitive analysis
          comparative_analysis_score: comparativeScore, // Keep for compatibility
          strategic_value_score: comparativeScore, // Keep for compatibility
          score_source: 'comparative_analysis_score',
          brand_a_market_share: brandAMetric.value, // Primary brand market share
          brand_b_market_share: brandBMetric.value, // Competitor brand market share
          brand_dominance: brandDominance, // Legacy field for compatibility
          total_brand_share: totalBrandShare,
          market_gap: marketGap,
          strategic_score: strategicScore,
          competitive_score: competitiveScore,
          demographic_score: demographicScore,
          trend_score: trendScore,
          total_population: totalPop,
          median_income: medianIncome,
          // Comparative-specific calculated properties
          brand_performance_gap: brandPerformanceGap,
          market_position_strength: marketPositionStrength,
          competitive_dynamics_level: competitiveDynamicsLevel,
          growth_differential: growthDifferential,
          comparative_category: this.getComparativeCategory(comparativeScore),
          dominant_brand: this.identifyDominantBrand(brandAMetric.value, brandBMetric.value),
          competitive_advantage_type: this.identifyCompetitiveAdvantageType(record),
          brand_a_share: brandAMetric.value,
          brand_b_share: brandBMetric.value,
          brand_a_name: brandAMetric.brandName,
          brand_b_name: brandBMetric.brandName,
          dominance_score: brandDominance
        }
      };
    });
    
    // Calculate comprehensive statistics
    const statistics = this.calculateStatistics(processedRecords.map(r => r.value));
    
    // Rank records by comparative analysis score (highest advantage first)
    const rankedRecords = this.rankRecords(processedRecords);
    
    // Filter out national parks for business analysis - COMMENTED OUT FOR DEBUGGING
    /*
    const nonParkRecords = rankedRecords.filter(record => {
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
    const nonParkRecords = rankedRecords; // Use all records for debugging
    
    console.log(`🎯 [COMPARATIVE ANALYSIS] Filtered ${rankedRecords.length - nonParkRecords.length} parks from comparative analysis`);
    
    // Extract feature importance with comparative focus
    const featureImportance = this.processComparativeFeatureImportance(rawData.feature_importance || []);
    
    // Get brand names from first record (all records should have same brand names)
    const firstRecord = nonParkRecords[0] || rankedRecords[0];
    const brandAName = typeof (firstRecord?.properties as any)?.brand_a_name === 'string'
      ? (firstRecord!.properties as any).brand_a_name as string
      : 'Brand A';
    const brandBName = typeof (firstRecord?.properties as any)?.brand_b_name === 'string'
      ? (firstRecord!.properties as any).brand_b_name as string
      : 'Brand B';

    // Generate summary using configuration-driven templates
    const customSubstitutions = {
      primaryBrand: brandAName,
      secondaryBrand: brandBName,
      totalMarkets: nonParkRecords.length,
      avgAdvantage: statistics.mean.toFixed(1),
      dominantMarkets: nonParkRecords.filter(r => r.value >= 75).length,
      competitiveMarkets: nonParkRecords.filter(r => r.value >= 50 && r.value < 75).length
    };
    
    const summary = this.buildSummaryFromTemplates(nonParkRecords, statistics, customSubstitutions);

    return this.createProcessedData(
      'comparative_analysis',
      nonParkRecords,
      summary,
      statistics,
      {
        featureImportance,
        renderer: this.createComparativeRenderer(rankedRecords),
        legend: this.createComparativeLegend(rankedRecords)
      }
    );
  }

  // ============================================================================
  // DIRECT RENDERING METHODS
  // ============================================================================

  /**
   * Create direct renderer for comparative analysis visualization
   */
  private createComparativeRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Comparative colors: Red (low competition) -> Orange -> Light Green -> Dark Green (high competitive advantage)
    const comparativeColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (lowest comparative advantage)
      [253, 174, 97, 0.6],  // #fdae61 - Orange  
      [166, 217, 106, 0.6], // #a6d96a - Light Green
      [26, 152, 80, 0.6]    // #1a9850 - Dark Green (highest comparative advantage)
    ];
    
    return {
      type: 'class-breaks',
      field: 'comparison_score', // Use the actual field name that matches the data
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: 'simple-fill',
          color: comparativeColors[i], // Direct array format
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
   * Create direct legend for comparative analysis
   */
  private createComparativeLegend(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use RGBA format with correct opacity to match features
    const colors = [
      'rgba(215, 48, 39, 0.6)',   // Low competitive advantage
      'rgba(253, 174, 97, 0.6)',  // Medium-low  
      'rgba(166, 217, 106, 0.6)', // Medium-high
      'rgba(26, 152, 80, 0.6)'    // High competitive advantage
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
      title: 'Comparative Advantage Score',
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
   * Format class labels for legend with proper < and > format
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

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  /**
   * Extract regional metric from record using Quebec housing market data
   */
  private extractRegionalMetric(record: any, regionType: 'region_a' | 'region_b'): RegionalMetric {
    // Extract housing market performance metrics for regional comparison
    let value = 0;
    let fieldName = '';
    let regionName = '';
    
    // Use configuration-driven field extraction for Quebec regions
    const householdIncome = this.extractNumericValue(record, this.configManager.getFieldMapping('incomeField'), 0);
    const population = this.extractNumericValue(record, this.configManager.getFieldMapping('populationField'), 0);
    const housingGrowth = this.extractNumericValue(record, ['hot_growth_market_index', 'growth_index'], 0);
    const housingAffordability = this.extractNumericValue(record, ['home_affordability_index', 'affordability_index'], 0);
    
    // Calculate regional performance based on real estate metrics
    if (regionType === 'region_a') {
      // Primary region - use higher performing metrics
      value = Math.max(householdIncome / 1000, housingGrowth, population / 1000);
      fieldName = 'primary_region_performance';
      regionName = this.extractRegionName(record, 'primary');
    } else {
      // Comparison region - use alternative or benchmark metrics
      value = Math.min(householdIncome / 1000, Math.max(housingGrowth * 0.8, population / 1000 * 0.9));
      fieldName = 'comparison_region_performance';
      regionName = this.extractRegionName(record, 'comparison');
    }
    
    // Fallback: Use explicit regional scores if available
    if (value === 0) {
      const explicitFields = regionType === 'region_a' 
        ? ['region_a_score', 'primary_region_score', 'montreal_score']
        : ['region_b_score', 'comparison_region_score', 'quebec_city_score'];
      
      for (const field of explicitFields) {
        if ((record as any)[field] !== undefined) {
          value = Number((record as any)[field]) || 0;
          fieldName = field;
          break;
        }
      }
    }
    
    // Final fallback: Use default regional names and calculated values
    if (!regionName) {
      if (regionType === 'region_a') {
        regionName = 'Montreal Region';
        value = value || householdIncome / 1000 || 50;
      } else {
        regionName = 'Quebec City Region';  
        value = value || householdIncome / 1200 || 45;
      }
    }
    
    console.log(`🔍 [extractRegionalMetric] ${regionType} result:`, {
      fieldName,
      value,
      regionName,
      recordId: (record as any).ID || 'unknown'
    });
    
    return {
      value,
      fieldName: fieldName || '',
      regionName
    };
  }

  /**
   * Extract region name from record for real estate comparison
   */
  private extractRegionName(record: any, regionType: 'primary' | 'comparison'): string {
    // Try to extract actual region/city name from the record
    const cityName = this.extractCityFromRecord(record);
    if (cityName && cityName !== 'Unknown') {
      return `${cityName} Region`;
    }
    
    // Fallback to geographic area description
    const description = (record as any).DESCRIPTION || (record as any).value_DESCRIPTION || '';
    if (description && typeof description === 'string') {
      const nameMatch = description.match(/\(([^)]+)\)/);
      if (nameMatch && nameMatch[1]) {
        return `${nameMatch[1]} Region`;
      }
    }
    
    // Final fallback based on region type
    if (regionType === 'primary') {
      return 'Montreal Region';
    } else {
      return 'Quebec City Region';
    }
  }

  /**
   * Extract comparative analysis score from record with fallback calculation
   */
  private extractComparativeScore(record: any, primary?: string): number {
    // DEBUG: Log all fields to identify the issue
    const recordId = (record as any).ID || (record as any).id || (record as any).area_id || 'unknown';
    console.log(`🔍 [ComparativeAnalysisProcessor] DEBUG - Record ${recordId} fields:`, {
      comparison_score: (record as any).comparison_score,
      comparative_score: (record as any).comparative_score,
      thematic_value: (record as any).thematic_value,
      value: (record as any).value,
      allNumericFields: Object.keys(record as any).filter((k: string) => typeof (record as any)[k] === 'number').slice(0, 10)
    });
    
    // Use canonical primary score field when available (primary passed in)
    const fieldToUse = primary || getPrimaryScoreField('comparative_analysis', (null as any)) || 'comparison_score';
    if ((record as any)[fieldToUse] !== undefined && (record as any)[fieldToUse] !== null) {
      const val = Number((record as any)[fieldToUse]);
      console.log(`⚖️ [ComparativeAnalysisProcessor] Using primary field ${fieldToUse}: ${val}`);
      return val;
    }

    // PRIORITY: legacy fields as fallbacks
    if ((record as any).comparison_score !== undefined && (record as any).comparison_score !== null) {
      const comparisonScore = Number((record as any).comparison_score);
      console.log(`⚖️ [ComparativeAnalysisProcessor] Using comparison_score: ${comparisonScore}`);
      return comparisonScore;
    }

    if ((record as any).comparative_score !== undefined && (record as any).comparative_score !== null) {
      const comparativeScore = Number((record as any).comparative_score);
      console.log(`⚖️ [ComparativeAnalysisProcessor] Using comparative_score: ${comparativeScore}`);
      return comparativeScore;
    }

    if ((record as any).thematic_value !== undefined && (record as any).thematic_value !== null) {
      const thematicScore = Number((record as any).thematic_value);
      console.log(`⚖️ [ComparativeAnalysisProcessor] Using thematic_value: ${thematicScore}`);
      return thematicScore;
    }

    if ((record as any).value !== undefined && (record as any).value !== null) {
      const valueScore = Number((record as any).value);
      console.log(`⚖️ [ComparativeAnalysisProcessor] Using value: ${valueScore}`);
      return valueScore;
    }
    
    // PRIORITY 5: Use competitive advantage score if available (scale from 1-10 to 0-100)
    if ((record as any).competitive_advantage_score !== undefined && (record as any).competitive_advantage_score !== null) {
      const competitiveScore = Number((record as any).competitive_advantage_score);
      const scaledScore = competitiveScore * 10; // Scale 1-10 to 10-100
      console.log(`⚖️ [ComparativeAnalysisProcessor] Using competitive_advantage_score: ${competitiveScore} -> scaled to ${scaledScore}`);
      return scaledScore;
    }
    
    // FALLBACK: Use any available numeric field as comparative score
    console.log('⚠️ [ComparativeAnalysisProcessor] No direct scores found, using first available numeric field');
    
    // Find the first numeric field that's not an ID, date, or geometric field
    const numericFields = Object.keys(record as any).filter((key: string) => {
      const value = (record as any)[key];
      const keyLower = key.toLowerCase();
      return typeof value === 'number' && 
             !isNaN(value) &&
             !keyLower.includes('id') &&
             !keyLower.includes('date') &&
             !keyLower.includes('time') &&
             !keyLower.includes('area') &&
             !keyLower.includes('length') &&
             !keyLower.includes('objectid') &&
             !keyLower.includes('shape') &&
             !keyLower.includes('creation') &&
             !keyLower.includes('edit') &&
             !keyLower.includes('point');
    });
    
    if (numericFields.length > 0) {
      // Use the first suitable numeric field
      const fieldName = numericFields[0];
      const fieldValue = Number(record[fieldName]);
      console.log(`⚖️ [ComparativeAnalysisProcessor] Using fallback field '${fieldName}': ${fieldValue}`);
      
      // Normalize to 0-100 range if needed
      if (fieldValue > 100) {
        return Math.min(100, fieldValue / 10); // Scale down large values
      } else if (fieldValue < 0) {
        return 0; // Floor negative values
      }
      return fieldValue;
    }
    
    // Ultimate fallback: return a default score
    console.log(`⚠️ [ComparativeAnalysisProcessor] Record ${recordId} has no suitable numeric fields, using default score`);
    return 50; // Neutral comparative score
  }

  /**
   * Calculate brand performance gap metrics
   */
  private calculateRegionalPerformanceGap(record: any): number {
    const regionAMetric = this.extractRegionalMetric(record, 'region_a');
    const regionBMetric = this.extractRegionalMetric(record, 'region_b');
    
    if (regionAMetric.value === 0 && regionBMetric.value === 0) {
      return 0; // No regional performance to compare
    }
    
  const regionalDominance = regionAMetric.value - regionBMetric.value;
  // Safely extract brand metrics for gap calculations
  const brandAMetric = this.extractBrandMetric(record, 'brand_a');
  const brandBMetric = this.extractBrandMetric(record, 'brand_b');
  const totalBrandShare = (brandAMetric?.value || 0) + (brandBMetric?.value || 0);
    
    let gapScore = 0;
    
    // Brand dominance scoring
  const brandDominance = (brandAMetric?.value || 0) - (brandBMetric?.value || 0);
  if (brandDominance >= 15) {
      gapScore += 40; // Very strong brand A lead
    } else if (brandDominance >= 10) {
      gapScore += 35; // Strong brand A lead
    } else if (brandDominance >= 5) {
      gapScore += 25; // Moderate brand A lead
    } else if (brandDominance >= 0) {
      gapScore += 15; // Slight brand A lead
    } else {
      gapScore += 5; // Brand A disadvantage
    }
    
    // Market share magnitude bonus
    if (totalBrandShare >= 40) {
      gapScore += 25; // High competitive intensity
    } else if (totalBrandShare >= 25) {
      gapScore += 20; // Moderate competitive intensity
    } else if (totalBrandShare >= 15) {
      gapScore += 15; // Developing competitive market
    }
    
    // Brand A absolute performance
    if ((brandAMetric?.value || 0) >= 35) {
      gapScore += 15; // Very high brand A performance
    } else if ((brandAMetric?.value || 0) >= 25) {
      gapScore += 10; // High brand A performance
    } else if ((brandAMetric?.value || 0) >= 15) {
      gapScore += 5; // Moderate brand A performance
    }
    
    return Math.min(100, gapScore);
  }

  /**
   * Extract a simple brand metric object from a record.
   * Conservative: look for several common field name patterns and return a consistent shape.
   */
  private extractBrandMetric(record: any, brandKey: string): { value: number; brandName: string } {
    if (!record) return { value: 0, brandName: '' };
    const candidates = [
      `${brandKey}_market_share`,
      `${brandKey}_share`,
      `${brandKey}_share_pct`,
      `brand_${brandKey}_share`,
      `${brandKey}_value`,
      `${brandKey}_score`
    ];
    let value = 0;
    for (const c of candidates) {
      if ((record as any)[c] !== undefined && (record as any)[c] !== null) {
        value = Number((record as any)[c]) || 0;
        break;
      }
    }
    // Fallback to generic brand fields
    if (value === 0) {
      if ((record as any)[`${brandKey}_name`]) {
        // leave value as 0
      } else if ((record as any)[`brand_${brandKey}`] !== undefined) {
        value = Number((record as any)[`brand_${brandKey}`]) || 0;
      }
    }
    const brandName = String((record as any)[`${brandKey}_name`] || (record as any)[`${brandKey}_brand`] || '').trim();
    return { value, brandName };
  }

  /**
   * Backwards-compatible alias used in some call sites. Keep conservative behavior.
   */
  private calculateBrandPerformanceGap(record: any): number {
    return this.calculateRegionalPerformanceGap(record);
  }

  /**
   * Calculate market position strength relative to competitors
   */
  private calculateMarketPositionStrength(record: any): number {
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const totalPop = Number(this.extractFieldValue(record, ['total_population', 'value_TOTPOP_CY', 'TOTPOP_CY', 'population'])) || 0;
    
    let positionStrength = 0;
    
    // Strategic positioning strength
    if (strategicScore >= 70) {
      positionStrength += 30; // Exceptional strategic position
    } else if (strategicScore >= 60) {
      positionStrength += 25; // Strong strategic position
    } else if (strategicScore >= 50) {
      positionStrength += 20; // Good strategic position
    } else if (strategicScore > 0) {
      positionStrength += 10; // Basic strategic position
    }
    
    // Competitive advantage strength
    if (competitiveScore >= 8) {
      positionStrength += 25; // Very strong competitive position
    } else if (competitiveScore >= 6) {
      positionStrength += 20; // Strong competitive position
    } else if (competitiveScore >= 4) {
      positionStrength += 15; // Moderate competitive position
    } else if (competitiveScore > 0) {
      positionStrength += 10; // Basic competitive position
    }
    
    // Market size advantage
    if (totalPop >= 100000) {
      positionStrength += 20; // Large market advantage
    } else if (totalPop >= 50000) {
      positionStrength += 15; // Medium market advantage
    } else if (totalPop >= 20000) {
      positionStrength += 10; // Small market advantage
    }
    
    // Demographic positioning advantage
    if (demographicScore >= 90) {
      positionStrength += 15; // Exceptional demographic position
    } else if (demographicScore >= 75) {
      positionStrength += 10; // Strong demographic position
    } else if (demographicScore >= 60) {
      positionStrength += 5; // Good demographic position
    }
    
    return Math.min(100, positionStrength);
  }

  /**
   * Calculate competitive dynamics level
   */
  private calculateCompetitiveDynamicsLevel(record: any): number {
    const brandAMetric = this.extractBrandMetric(record, 'brand_a');
    const brandBMetric = this.extractBrandMetric(record, 'brand_b');
    
    const totalBrandShare = brandAMetric.value + brandBMetric.value;
    const marketGap = Math.max(0, 100 - totalBrandShare);
    
    let dynamicsLevel = 0;
    
    // Market competitive intensity
    if (totalBrandShare >= 50) {
      dynamicsLevel += 20; // Very high competitive intensity
    } else if (totalBrandShare >= 35) {
      dynamicsLevel += 25; // High competitive intensity with room for growth
    } else if (totalBrandShare >= 20) {
      dynamicsLevel += 30; // Moderate intensity with good potential
    } else if (totalBrandShare >= 10) {
      dynamicsLevel += 25; // Developing market
    } else if (totalBrandShare > 0) {
      dynamicsLevel += 15; // Early stage market
    }
    
    // Brand competitive position in market
    if (brandAMetric.value > 0 && brandBMetric.value > 0) {
      const brandARatio = brandAMetric.value / (brandAMetric.value + brandBMetric.value);
      if (brandARatio >= 0.7) {
        dynamicsLevel += 25; // Brand A dominance
      } else if (brandARatio >= 0.6) {
        dynamicsLevel += 20; // Brand A advantage
      } else if (brandARatio >= 0.5) {
        dynamicsLevel += 15; // Balanced competition
      } else {
        dynamicsLevel += 10; // Brand A disadvantage but competitive
      }
    } else if (brandAMetric.value > 0) {
      dynamicsLevel += 20; // Brand A presence without Brand B competition
    }
    
    // Market gap opportunity
    if (marketGap >= 70) {
      dynamicsLevel += 15; // High untapped potential
    } else if (marketGap >= 50) {
      dynamicsLevel += 10; // Moderate untapped potential
    } else if (marketGap >= 30) {
      dynamicsLevel += 5; // Some untapped potential
    }
    
    // Competitive pressure assessment
    if (brandBMetric.value >= 25) {
      dynamicsLevel += 5; // High competitive pressure (competitive advantage)
    } else if (brandBMetric.value >= 15) {
      dynamicsLevel += 8; // Moderate competitive pressure
    } else if (brandBMetric.value >= 5) {
      dynamicsLevel += 10; // Low competitive pressure
    }
    
    return Math.min(100, dynamicsLevel);
  }

  /**
   * Calculate growth differential compared to market baseline
   */
  private calculateGrowthDifferential(record: any): number {
    const trendScore = Number((record as any).trend_strength_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const medianIncome = Number(this.extractFieldValue(record, ['median_income', 'value_AVGHINC_CY', 'AVGHINC_CY', 'household_income'])) || 0;
    
    let growthDifferential = 0;
    
    // Trend strength advantage
    if (trendScore >= 55) {
      growthDifferential += 25; // Strong trend advantage
    } else if (trendScore >= 45) {
      growthDifferential += 20; // Moderate trend advantage
    } else if (trendScore >= 35) {
      growthDifferential += 15; // Some trend advantage
    } else if (trendScore > 0) {
      growthDifferential += 5; // Minimal trend advantage
    }
    
    // Demographic growth potential
    if (demographicScore >= 85) {
      growthDifferential += 25; // Exceptional demographic growth potential
    } else if (demographicScore >= 70) {
      growthDifferential += 20; // Strong demographic growth potential
    } else if (demographicScore >= 55) {
      growthDifferential += 15; // Moderate demographic growth potential
    } else if (demographicScore > 0) {
      growthDifferential += 5; // Some demographic growth potential
    }
    
    // Strategic value growth indicator
    if (strategicScore >= 65) {
      growthDifferential += 20; // High strategic growth potential
    } else if (strategicScore >= 55) {
      growthDifferential += 15; // Moderate strategic growth potential
    } else if (strategicScore >= 45) {
      growthDifferential += 10; // Some strategic growth potential
    }
    
    // Income growth indicator (economic strength)
    if (medianIncome >= 80000) {
      growthDifferential += 15; // High income growth market
    } else if (medianIncome >= 60000) {
      growthDifferential += 10; // Moderate income market
    } else if (medianIncome >= 40000) {
      growthDifferential += 5; // Developing income market
    }
    
    return Math.min(100, growthDifferential);
  }

  /**
   * Categorize comparative performance
   */
  private getComparativeCategory(comparativeScore: number): string {
    if (comparativeScore >= 65) return 'Strong Comparative Advantage';
    if (comparativeScore >= 50) return 'Good Comparative Position';  
    if (comparativeScore >= 35) return 'Moderate Comparative Standing';
    return 'Weak Comparative Position';
  }

  /**
   * Identify the dominant brand in the market
   */
  private identifyDominantBrand(brandAShare: number, brandBShare: number): string {
    if (brandAShare === 0 && brandBShare === 0) {
      return 'No Brand Presence';
    }
    
    const brandDominance = brandAShare - brandBShare;
    
    if (brandDominance >= 15) return 'Brand A Strong Dominance';
    if (brandDominance >= 8) return 'Brand A Moderate Dominance';
    if (brandDominance >= 3) return 'Brand A Slight Lead';
    if (brandDominance >= -3) return 'Balanced Competition';
    if (brandDominance >= -8) return 'Brand B Slight Lead';
    if (brandDominance >= -15) return 'Brand B Moderate Dominance';
    return 'Brand B Strong Dominance';
  }

  /**
   * Identify the type of competitive advantage
   */
  private identifyCompetitiveAdvantageType(record: any): string {
    const brandGap = this.calculateBrandPerformanceGap(record);
    const positionStrength = this.calculateMarketPositionStrength(record);
    const dynamics = this.calculateCompetitiveDynamicsLevel(record);
    const growth = this.calculateGrowthDifferential(record);
    
    // Find the highest advantage component
    const maxAdvantage = Math.max(brandGap, positionStrength, dynamics, growth);
    
    if (maxAdvantage === brandGap && brandGap >= 40) return 'Brand Performance Advantage';
    if (maxAdvantage === positionStrength && positionStrength >= 40) return 'Market Position Advantage';
    if (maxAdvantage === dynamics && dynamics >= 40) return 'Competitive Dynamics Advantage';
    if (maxAdvantage === growth && growth >= 40) return 'Growth Differential Advantage';
    
    return 'Mixed Competitive Advantage';
  }



  /**
   * Process feature importance with comparative focus
   */
  private processComparativeFeatureImportance(rawFeatureImportance: any[]): any[] {
    const comparativeFeatures = rawFeatureImportance.map((item: any) => {
      const featureName = String((item as any).feature ?? (item as any).name ?? 'unknown');
      return {
        feature: featureName,
        importance: Number((item as any).importance ?? (item as any).value ?? 0),
        description: this.getComparativeFeatureDescription(featureName)
      };
    });

    // Add comparative-specific synthetic features if none provided
    if (comparativeFeatures.length === 0) {
      return [
        { feature: 'brand_performance_gap', importance: 0.35, description: 'Brand A vs competitors performance differential' },
        { feature: 'market_position_strength', importance: 0.30, description: 'Relative market positioning and dominance' },
        { feature: 'competitive_dynamics', importance: 0.25, description: 'Competitive pressure and market share dynamics' },
        { feature: 'growth_differential', importance: 0.10, description: 'Relative growth potential and trend momentum' }
      ];
    }

    return comparativeFeatures.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get comparative-specific feature descriptions
   */
  private getComparativeFeatureDescription(featureName: string): string {
    const comparativeDescriptions: Record<string, string> = {
      'comparative': 'Comparative analysis patterns and relationships',
      'brand': 'Brand performance comparison metrics',
      'competition': 'Competitive positioning and dynamics',
      'market_share': 'Market share comparative analysis',
      'dominance': 'Brand dominance and market control',
      'advantage': 'Competitive advantage indicators',
      'positioning': 'Market positioning strength',
      'performance': 'Performance comparison metrics',
      'gap': 'Performance gap analysis',
      'differential': 'Growth and performance differentials',
      'brand_a': 'Brand A comparative performance',
      'brand_b': 'Brand B competitive comparison',
      'strategic': 'Strategic comparative advantages',
      'demographic': 'Demographic comparative factors',
      'growth': 'Growth differential analysis'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(comparativeDescriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} comparative characteristics`;
  }

  


}