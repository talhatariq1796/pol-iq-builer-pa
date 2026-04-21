/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataProcessorStrategy, RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics, ProcessingContext } from '../../types';
import { getPrimaryScoreField } from './HardcodedFieldDefs';
import { calculateEqualCountQuintiles } from '../../utils/QuintileUtils';

/**
 * BrandDifferenceProcessor - Calculates and visualizes percent difference in market share between any two brands
 * 
 * Processes brand market share data to show competitive positioning differences
 * across geographic areas with contextual analysis.
 */
export class BrandDifferenceProcessor implements DataProcessorStrategy {
  
  // Brand code mappings for market share data
  private readonly BRAND_MAPPINGS = {
    'red bull': 'MP12207A_B_P',
    'monster energy': 'MP12206A_B_P',
  '5-hour energy': 'MP12205A_B_P',
  'h&r block': 'MP10128A_B_P',
  'turbotax': 'MP10104A_B_P'
  };

  validate(rawData: RawAnalysisResult): boolean {
    console.log('🔍 [BrandDifferenceProcessor] VALIDATE CALLED');
    console.log('🔍 [BrandDifferenceProcessor] Raw data structure:', {
      success: rawData?.success,
      resultsLength: rawData?.results?.length,
      firstRecordKeys: rawData?.results?.[0] ? Object.keys(rawData.results[0]) : []
    });
    
    if (!rawData || typeof rawData !== 'object') {
      console.log('❌ [BrandDifferenceProcessor] VALIDATION FAILED: Invalid rawData object');
      return false;
    }
    if (!rawData.success) {
      console.log('❌ [BrandDifferenceProcessor] VALIDATION FAILED: rawData.success is false');
      return false;
    }
    if (!Array.isArray(rawData.results)) {
      console.log('❌ [BrandDifferenceProcessor] VALIDATION FAILED: rawData.results is not an array');
      return false;
    }
    
    // Brand difference analysis requires brand market share data OR direct brand-difference fields
    const hasBrandFields = rawData.results.length === 0 || 
      rawData.results.some(record => {
        const hasIdField = record && ((record as any).area_id || (record as any).id || (record as any).ID);
        const recordKeys = record ? Object.keys(record as any) : [];
        const brandFields = recordKeys.filter(key => (key.includes('MP122') || key.includes('MP101')) && key.endsWith('A_B_P'));
        // Accept simple pre-computed brand difference fields used in tests/data
        const hasSimpleDifference = record && ((record as any).brand_difference_score !== undefined || (record as any).comparison_score !== undefined);
        
        console.log('🔍 [BrandDifferenceProcessor] Validation debug for record:', {
          hasRecord: !!record,
          hasIdField,
          totalKeys: recordKeys.length,
          brandFieldsFound: brandFields,
          brandFieldCount: brandFields.length
        });
        
  const hasBrandFieldsForRecord = brandFields.length > 0 || hasSimpleDifference;
  return hasIdField && hasBrandFieldsForRecord;
      });
    
    console.log('🔍 [BrandDifferenceProcessor] Brand fields validation result:', hasBrandFields);
    if (!hasBrandFields) {
      console.log('❌ [BrandDifferenceProcessor] VALIDATION FAILED: No brand fields found');
      if (rawData.results.length > 0) {
        console.log('🔍 [BrandDifferenceProcessor] Available fields in first record:', Object.keys(rawData.results[0] as any));
      }
    } else {
      console.log('✅ [BrandDifferenceProcessor] VALIDATION PASSED: Brand fields found');
    }
    
    return hasBrandFields;
  }

  process(rawData: RawAnalysisResult, context?: ProcessingContext): ProcessedAnalysisData {
    console.log(`[BrandDifferenceProcessor] ===== BRAND DIFFERENCE PROCESSOR CALLED =====`);
    console.log(`[BrandDifferenceProcessor] Processing ${rawData.results?.length || 0} records for brand difference analysis`);
    console.log(`[BrandDifferenceProcessor] Context:`, context);
    
    // Debug: Show available fields in first record
    if (rawData.results && rawData.results.length > 0) {
      const firstRecord = rawData.results[0];
  const brandFields = Object.keys(firstRecord as any).filter(key => (key.includes('MP122') || key.includes('MP101')) && key.includes('_P'));
      console.log(`[BrandDifferenceProcessor] Available brand fields in data:`, brandFields);
    }
    
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for BrandDifferenceProcessor');
    }

  // Resolve canonical primary field for this endpoint (allow metadata override)
  const primaryField = getPrimaryScoreField('brand_difference', (rawData as any)?.metadata) || 'brand_difference_score';

  // If the data already contains a precomputed primary difference field (brand_difference_score or comparison_score),
  // prefer that and skip MP122 brand auto-detection.
  const hasPrecomputedDifference = rawData.results && rawData.results.length > 0 &&
    ((rawData.results[0] as any)[primaryField] !== undefined || (rawData.results[0] as any).comparison_score !== undefined);

  // Auto-detect which brand fields are available in the data (used only when precomputed difference not present)
  const availableBrandFields = hasPrecomputedDifference ? [] : this.detectAvailableBrandFields(rawData);
  if (!hasPrecomputedDifference) {
    console.log(`[BrandDifferenceProcessor] Available brand fields:`, availableBrandFields);
  } else {
    console.log(`[BrandDifferenceProcessor] Precomputed primary field detected (${primaryField}), using direct difference values`);
  }
    
    // Extract brand parameters from context if available
    const extractedBrands = context?.extractedBrands || [];
    console.log(`[BrandDifferenceProcessor] Context received:`, { 
      hasContext: !!context,
      extractedBrands,
      query: context?.query
    });
    
    let brand1 = extractedBrands[0]?.toLowerCase() || null;
    let brand2 = extractedBrands[1]?.toLowerCase() || null;
    
    // If no brands from context, use the first two available brands from data
    if (!brand1 || !brand2) {
      const detectedBrands = availableBrandFields.slice(0, 2);
      brand1 = brand1 || detectedBrands[0] || 'red bull';
      brand2 = brand2 || detectedBrands[1] || 'monster energy';
    }
    
    // Ensure brands are never null
    brand1 = brand1 || 'red bull';
    brand2 = brand2 || 'monster energy';
    
    console.log(`[BrandDifferenceProcessor] Comparing brands: ${brand1} vs ${brand2} (from ${extractedBrands.length > 0 ? 'query' : 'auto-detected from data'})`);
    
    // No need to validate mappings anymore since detectAvailableBrandFields handles unknown brands
    console.log(`[BrandDifferenceProcessor] Processing comparison for: ${brand1} vs ${brand2}`);

    // Process records with brand difference calculations
    let records = [] as any[];
    if (hasPrecomputedDifference) {
      // Use the provided primary difference field directly
      records = (rawData.results || []).map((record: any, index: number) => {
        const area_id = (record as any).area_id || (record as any).id || (record as any).GEOID || `area_${index}`;
        const area_name = (record as any).value_DESCRIPTION || (record as any).DESCRIPTION || (record as any).area_name || (record as any).name || (record as any).NAME || `Area ${index + 1}`;
        const diff = Number((record as any)[primaryField] ?? (record as any).comparison_score ?? 0);
        const properties = {
          ...this.extractProperties(record),
          brand_difference_score: diff,
          absolute_difference: diff,
          total_population: Number((record as any).value_TOTPOP_CY) || 0
        };
        return {
          area_id,
          area_name,
          value: diff,
          brand_difference_score: diff,
          rank: 0,
          category: this.getDifferenceCategory(diff),
          coordinates: (record as any).coordinates || [0,0],
          properties,
          shapValues: (record as any).shap_values || {}
        };
      });
    } else {
      records = this.processBrandDifferenceRecords(rawData.results, brand1, brand2);
    }
    
    console.log(`[BrandDifferenceProcessor] Processed ${records.length} records for ${brand1} vs ${brand2}`);
    console.log(`[BrandDifferenceProcessor] Sample difference: ${records[0]?.value}%`);
    
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
    
    console.log(`🎯 [BRAND DIFFERENCE] Filtered ${records.length - nonParkRecords.length} parks from brand analysis`);
    
    // Calculate difference statistics using filtered records
    const statistics = this.calculateDifferenceStatistics(nonParkRecords);
    
    // Analyze brand competitive landscape using filtered records
    const brandAnalysis = this.analyzeBrandDifferences(nonParkRecords, brand1, brand2);
    
    // Process feature importance for brand factors
    const featureImportance = this.processBrandFeatureImportance(rawData.feature_importance || []);
    
    // Generate brand difference summary using filtered records
    const summary = this.generateBrandDifferenceSummary(nonParkRecords, brandAnalysis, brand1, brand2, rawData.summary);

    console.log(`[BrandDifferenceProcessor] Final result summary:`, {
      type: 'brand_difference',
      recordCount: records.length,
      comparison: `${brand1} vs ${brand2}`,
      avgDifference: statistics.mean
    });

    // Extract the actual field codes used for the brands (capitalize for field lookup)
    const brand1Field = this.extractBrandFieldCode(rawData, brand1.charAt(0).toUpperCase() + brand1.slice(1));
    const brand2Field = this.extractBrandFieldCode(rawData, brand2.charAt(0).toUpperCase() + brand2.slice(1));
    
    // Create renderer and legend with filtered records
    const renderer = this.createBrandDifferenceRenderer(nonParkRecords);
    const legend = this.createBrandDifferenceLegend(nonParkRecords);
    
    console.log(`🔥 [BrandDifferenceProcessor] Created renderer and legend:`, {
      rendererType: renderer?.type,
      rendererField: renderer?.field,
      classBreakCount: renderer?.classBreakInfos?.length,
      firstLabel: renderer?.classBreakInfos?.[0]?.label,
      legendTitle: legend?.title,
      legendItemCount: legend?.items?.length,
      firstLegendLabel: legend?.items?.[0]?.label
    });

    const processedData = {
      type: 'brand_difference',
      records: nonParkRecords, // Return filtered records to prevent park data in visualizations
      summary,
      featureImportance,
      statistics,
      targetVariable: primaryField,
      renderer,
      legend,
      brandAnalysis: {
        ...brandAnalysis,
        relevantFields: [brand1Field, brand2Field], // Add the actual fields being compared
        brandComparison: { brand1, brand2 }
      }
    };
    
    console.log(`[BrandDifferenceProcessor] ===== RETURNING PROCESSED DATA =====`);
    console.log(`[BrandDifferenceProcessor] Brand comparison: ${brand1} (${brand1Field}) vs ${brand2} (${brand2Field})`);
    console.log(`[BrandDifferenceProcessor] Relevant fields for visualization:`, [brand1Field, brand2Field]);
    console.log(`[BrandDifferenceProcessor] Records generated:`, processedData.records?.length || 0);
    
    return processedData;
  }

  /**
   * Extract the actual field code for a brand from the raw data
   */
  private extractBrandFieldCode(rawData: RawAnalysisResult, brandName: string): string {
    // Check the first result record to find which field corresponds to the brand
    if (!rawData.results || rawData.results.length === 0) {
      // Fallback to known brand field mappings (case-insensitive)
      const brandLower = brandName.toLowerCase();
      
      if (brandLower.includes('red bull')) return 'MP12207A_B_P';
      if (brandLower.includes('monster')) return 'MP12206A_B_P';
      if (brandLower.includes('5-hour')) return 'MP12205A_B_P';
      if (brandLower.includes('h&r block')) return 'MP10128A_B_P';
      if (brandLower.includes('turbotax')) return 'MP10104A_B_P';
      
      return 'MP12207A_B_P'; // Default fallback
    }
    
    // Look through the first record to find fields that might match the brand
    const sampleRecord = rawData.results[0];
    
    // Find fields that contain data and might be brand fields
    for (const [key, value] of Object.entries(sampleRecord as any)) {
      // Check if this is a percentage field for energy drinks
      if (key.includes('MP122') && key.endsWith('A_B_P') && typeof value === 'number') {
        // Use the field code directly (e.g., MP12207A_B_P)
        const baseField = key;
        // Try to match based on known patterns (case-insensitive)
        const brandLower = brandName.toLowerCase();
        if (brandLower.includes('red bull') && key.includes('207A_B')) return baseField;
        if (brandLower.includes('monster') && key.includes('206A_B')) return baseField;
        if (brandLower.includes('5-hour') && key.includes('205A_B')) return baseField;
        if (brandLower.includes('h&r block') && key.includes('10128A_B')) return baseField;
        if (brandLower.includes('turbotax') && key.includes('10104A_B')) return baseField;
      }
    }
    
    // Default fallback with case-insensitive matching
    const brandLower = brandName.toLowerCase();
    console.warn(`[BrandDifferenceProcessor] Could not find field for brand: ${brandName}`);
    
    if (brandLower.includes('red bull')) return 'MP12207A_B_P';
    if (brandLower.includes('monster')) return 'MP12206A_B_P';
    if (brandLower.includes('5-hour')) return 'MP12205A_B_P';
    if (brandLower.includes('h&r block')) return 'MP10128A_B_P';
    if (brandLower.includes('turbotax')) return 'MP10104A_B_P';
    
    // Ultimate fallback
    return 'MP12207A_B_P';
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  private processBrandDifferenceRecords(rawRecords: any[], brand1: string, brand2: string): GeographicDataPoint[] {
    // Get field codes - either from BRAND_MAPPINGS or detect from data
    const brand1FieldCode = this.getBrandFieldCode(rawRecords[0], brand1);
    const brand2FieldCode = this.getBrandFieldCode(rawRecords[0], brand2);
    
    const brand1Field = brand1FieldCode;
    const brand2Field = brand2FieldCode;
    
    console.log(`[BrandDifferenceProcessor] Using fields: ${brand1Field} vs ${brand2Field}`);

    return rawRecords.map((record, index) => {
      const area_id = (record as any).area_id || (record as any).id || (record as any).GEOID || `area_${index}`;
      const area_name = (record as any).value_DESCRIPTION || (record as any).DESCRIPTION || (record as any).area_name || (record as any).name || (record as any).NAME || `Area ${index + 1}`;
      
      // Extract brand market shares
      const brand1Share = Number(record[brand1Field]) || 0; // Already in percentage format
      const brand2Share = Number(record[brand2Field]) || 0; // Already in percentage format
      
      // Calculate simple difference: brand1 - brand2 (both already in percentage format)
      const difference = brand1Share - brand2Share;
      
      // Debug: Log first few calculations
      if (index < 3) {
        console.log(`[BrandDifferenceProcessor] Record ${index}: ${brand1}=${brand1Share}%, ${brand2}=${brand2Share}%, difference=${difference}%`);
      }
      
      // Use difference as the primary value for visualization
      const value = difference;
      
      // Extract contextual properties
      const properties = {
        ...this.extractProperties(record),
        brand_difference_score: difference,
        [brand1 + '_market_share']: brand1Share,
        [brand2 + '_market_share']: brand2Share,
        absolute_difference: brand1Share - brand2Share,
        competitive_advantage_score: (record as any).competitive_advantage_score || 0,
        total_population: Number((record as any).value_TOTPOP_CY) || 0,
        wealth_index: Number((record as any).value_WLTHINDXCY) || 100,
        difference_category: this.categorizeDifference(difference),
        market_dominance: this.determineMarketDominance(brand1Share, brand2Share)
      };
      
      // Extract SHAP values for both brands
      const shapValues = this.extractBrandShapValues(record, brand1, brand2);
      
      // Category based on difference magnitude
      const category = this.getDifferenceCategory(difference);

      return {
        area_id,
        area_name,
        value,
        brand_difference_score: difference,
        rank: 0, // Will be calculated in ranking
        category,
        coordinates: (record as any).coordinates || [0, 0],
        properties,
        shapValues
      };
    }).sort((a, b) => b.value - a.value) // Sort by difference (brand1 advantage first)
      .map((record, index) => ({ ...record, rank: index + 1 })); // Assign ranks
  }

  private extractProperties(record: any): Record<string, any> {
    const internalFields = new Set([
      'area_id', 'id', 'area_name', 'name', 'coordinates', 'shap_values', 'brand_difference_score'
    ]);
    
    const properties: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(record as any)) {
      if (!internalFields.has(key)) {
        properties[key] = value;
      }
    }
    
    return properties;
  }

  private extractBrandShapValues(record: any, brand1: string, brand2: string): Record<string, number> {
    const brand1ShapField = `shap_${this.BRAND_MAPPINGS[brand1 as keyof typeof this.BRAND_MAPPINGS]}`;
    const brand2ShapField = `shap_${this.BRAND_MAPPINGS[brand2 as keyof typeof this.BRAND_MAPPINGS]}`;
    
    const shapValues: Record<string, number> = {};
    
    // Extract SHAP values for both brands
    if (record[brand1ShapField] !== undefined) {
      shapValues[`${brand1}_shap`] = Number(record[brand1ShapField]);
    }
    if (record[brand2ShapField] !== undefined) {
      shapValues[`${brand2}_shap`] = Number(record[brand2ShapField]);
    }
    
    // Extract general SHAP values
    for (const [key, value] of Object.entries(record as any)) {
      if (key.startsWith('shap_') && typeof value === 'number') {
        shapValues[key] = value;
      }
    }
    
    return shapValues;
  }

  private categorizeDifference(difference: number): string {
    if (difference >= 50) return 'major_advantage';
    if (difference >= 20) return 'significant_advantage';
    if (difference >= 5) return 'moderate_advantage';
    if (difference >= -5) return 'competitive_parity';
    if (difference >= -20) return 'moderate_disadvantage';
    if (difference >= -50) return 'significant_disadvantage';
    return 'major_disadvantage';
  }

  private determineMarketDominance(share1: number, share2: number): string {
    const total = share1 + share2;
    if (total < 10) return 'low_presence';
    if (share1 > share2 * 2) return 'brand1_dominant';
    if (share2 > share1 * 2) return 'brand2_dominant';
    return 'competitive_market';
  }

  private getDifferenceCategory(difference: number): string {
    if (difference >= 25) return 'strong_brand1';
    if (difference >= 0) return 'brand1_leading';
    if (difference >= -25) return 'brand2_leading';
    return 'strong_brand2';
  }

  private calculateDifferenceStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
    const differences = records.map(r => r.value).filter(v => !isNaN(v));
    
    if (differences.length === 0) {
      return {
        total: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0,
        quintiles: { differences: [] } as any
      };
    }
    
    const sorted = [...differences].sort((a, b) => a - b);
    const total = differences.length;
    const sum = differences.reduce((a, b) => a + b, 0);
    const mean = sum / total;
    
    const median = total % 2 === 0 
      ? (sorted[Math.floor(total / 2) - 1] + sorted[Math.floor(total / 2)]) / 2
      : sorted[Math.floor(total / 2)];
    
    const variance = differences.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    // Calculate quintiles for differences
    const quintileResult = calculateEqualCountQuintiles(sorted);
    
    console.log('[BrandDifferenceProcessor] Difference quintiles calculated:', quintileResult.quintiles);
    
    return {
      total,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev,
      quintiles: {
        differences: quintileResult.quintiles
      } as any
    };
  }

  private analyzeBrandDifferences(records: GeographicDataPoint[], brand1: string, brand2: string): any {
    // Group by difference categories
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
      const avgDifference = categoryRecords.reduce((sum, r) => sum + r.value, 0) / categoryRecords.length;
      const avgBrand1Share = categoryRecords.reduce((sum, r) => sum + ((r.properties as any)[`${brand1}_market_share`] || 0), 0) / categoryRecords.length;
      const avgBrand2Share = categoryRecords.reduce((sum, r) => sum + ((r.properties as any)[`${brand2}_market_share`] || 0), 0) / categoryRecords.length;
      
      return {
        category,
        size: categoryRecords.length,
        percentage: (categoryRecords.length / records.length) * 100,
        avgDifference,
        avgBrand1Share,
        avgBrand2Share,
        topAreas: categoryRecords
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
          .slice(0, 3)
          .map(r => ({
            name: r.area_name,
            difference: r.value,
            brand1Share: r.properties[`${brand1}_market_share`],
            brand2Share: r.properties[`${brand2}_market_share`]
          }))
      };
    });
    
    return {
      categories: categoryAnalysis,
      brandLeadership: this.assessBrandLeadership(records, brand1, brand2),
      competitiveBalance: this.assessCompetitiveBalance(categoryAnalysis)
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private assessBrandLeadership(records: GeographicDataPoint[], brand1: string, brand2: string): any {
    const brand1Leading = records.filter(r => r.value > 0).length;
    const brand2Leading = records.filter(r => r.value < 0).length;
    const competitive = records.filter(r => Math.abs(r.value) <= 5).length;
    
    return {
      brand1Leading,
      brand2Leading,
      competitive,
      brand1LeadingPct: (brand1Leading / records.length) * 100,
      brand2LeadingPct: (brand2Leading / records.length) * 100,
      competitivePct: (competitive / records.length) * 100
    };
  }

  private assessCompetitiveBalance(categoryAnalysis: any[]): string {
    const strongBrand1 = categoryAnalysis.find(c => c.category === 'strong_brand1')?.percentage || 0;
    const strongBrand2 = categoryAnalysis.find(c => c.category === 'strong_brand2')?.percentage || 0;
    
    if (strongBrand1 > 40) return 'brand1_dominance';
    if (strongBrand2 > 40) return 'brand2_dominance';
    if (Math.abs(strongBrand1 - strongBrand2) < 10) return 'balanced_competition';
    return 'fragmented_market';
  }

  private processBrandFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getBrandFeatureDescription((item as any).feature || (item as any).name),
      brandImpact: this.assessBrandImpact((item as any).importance || 0)
    })).sort((a, b) => b.importance - a.importance);
  }

  private getBrandFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'population': 'Market size and demographic density',
      'income': 'Income levels affecting brand preference',
      'age': 'Age demographics and brand affinity',
      'education': 'Education levels and brand perception',
      'urban': 'Urban vs suburban market characteristics',
      'wealth': 'Wealth distribution and premium brand preference'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} brand preference factor`;
  }

  private assessBrandImpact(importance: number): string {
    if (importance >= 0.8) return 'critical_differentiator';
    if (importance >= 0.6) return 'significant_factor';
    if (importance >= 0.4) return 'moderate_influence';
    if (importance >= 0.2) return 'minor_factor';
    return 'negligible_impact';
  }

  private generateBrandDifferenceSummary(
    records: GeographicDataPoint[], 
    brandAnalysis: any, 
    brand1: string, 
    brand2: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rawSummary?: string
  ): string {
    
    const recordCount = records.length;
    const avgDifference = records.reduce((sum, r) => sum + r.value, 0) / recordCount;
    const brand1Name = brand1.charAt(0).toUpperCase() + brand1.slice(1);
    const brand2Name = brand2.charAt(0).toUpperCase() + brand2.slice(1);
    
    let summary = `**📊 ${brand1Name} vs ${brand2Name} Market Share Difference Analysis**\n\n`;
    
    summary += `**Methodology:** Calculated market share difference between ${brand1Name} and ${brand2Name} across ${recordCount} markets (${brand1Name} % - ${brand2Name} %). `;
    summary += `Positive values indicate ${brand1Name} advantage, negative values indicate ${brand2Name} advantage.\n\n`;
    
    // Overall market comparison
    summary += `**Overall Market Position:** `;
    if (avgDifference > 10) {
      summary += `${brand1Name} holds a significant market advantage with an average ${avgDifference.toFixed(1)}% higher market share than ${brand2Name}. `;
    } else if (avgDifference > 0) {
      summary += `${brand1Name} slightly leads with an average ${avgDifference.toFixed(1)}% market share advantage. `;
    } else if (avgDifference > -10) {
      summary += `${brand2Name} slightly leads with an average ${Math.abs(avgDifference).toFixed(1)}% market share advantage. `;
    } else {
      summary += `${brand2Name} holds a significant market advantage with an average ${Math.abs(avgDifference).toFixed(1)}% higher market share than ${brand1Name}. `;
    }
    
    // Brand leadership distribution
    const leadership = brandAnalysis.brandLeadership;
    summary += `Market distribution: ${brand1Name} leads in ${leadership.brand1Leading} markets (${leadership.brand1LeadingPct.toFixed(1)}%), `;
    summary += `${brand2Name} leads in ${leadership.brand2Leading} markets (${leadership.brand2LeadingPct.toFixed(1)}%), `;
    summary += `with ${leadership.competitive} competitive markets (${leadership.competitivePct.toFixed(1)}%).\n\n`;
    
    // Top performance areas
    const topBrand1Markets = records.filter(r => r.value > 20).slice(0, 5);
    const topBrand2Markets = records.filter(r => r.value < -20).slice(0, 5);
    
    if (topBrand1Markets.length > 0) {
      summary += `**${brand1Name} Strongholds** (>20% advantage): `;
  topBrand1Markets.forEach((record) => {
        const brand1Share = (record as any).properties[`${brand1}_market_share`];
        const brand2Share = (record as any).properties[`${brand2}_market_share`];
        summary += `${(record as any).area_name} (${brand1Share.toFixed(1)}% vs ${brand2Share.toFixed(1)}%), `;
      });
      summary = summary.slice(0, -2) + '.\n\n';
    }
    
    if (topBrand2Markets.length > 0) {
      summary += `**${brand2Name} Strongholds** (>20% advantage): `;
  topBrand2Markets.forEach((record) => {
        const brand1Share = (record as any).properties[`${brand1}_market_share`];
        const brand2Share = (record as any).properties[`${brand2}_market_share`];
        summary += `${(record as any).area_name} (${brand2Share.toFixed(1)}% vs ${brand1Share.toFixed(1)}%), `;
      });
      summary = summary.slice(0, -2) + '.\n\n';
    }
    
    // Competitive insights
    summary += `**Strategic Insights:** `;
    const competitiveBalance = brandAnalysis.competitiveBalance;
    if (competitiveBalance === 'balanced_competition') {
      summary += `Markets show balanced competition with opportunities for both brands to gain share through targeted strategies. `;
    } else if (competitiveBalance.includes('brand1')) {
      summary += `${brand1Name} shows market dominance with opportunities to defend and expand leading positions. `;
    } else if (competitiveBalance.includes('brand2')) {
      summary += `${brand2Name} shows market dominance with ${brand1Name} needing strategic repositioning to compete effectively. `;
    }
    
    summary += `Focus on markets with moderate differences for highest growth potential and competitive conversion opportunities.`;
    
    return summary;
  }

  // ============================================================================
  // RENDERING METHODS
  // ============================================================================

  private createBrandDifferenceRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use diverging color scheme: red (brand2 advantage) -> green (brand1 advantage)
    // Use standard 4-color quartile scheme like other processors
    const differenceColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (Strong brand2 advantage)
      [253, 174, 97, 0.6],  // #fdae61 - Orange (Moderate brand2 advantage)
      [166, 217, 106, 0.6], // #a6d96a - Light green (Moderate brand1 advantage)
      [26, 152, 80, 0.6]    // #1a9850 - Dark green (Strong brand1 advantage)
    ];
    
    return {
      type: 'class-breaks',
      field: 'brand_difference_score',
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: 'simple-fill',
          color: differenceColors[i],
          outline: { color: [0, 0, 0, 0], width: 0 }
        },
        label: this.formatDifferenceLabel(i, quartileBreaks)
      })),
      defaultSymbol: {
        type: 'simple-fill',
        color: [200, 200, 200, 0.5],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }
    };
  }

  private createBrandDifferenceLegend(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use standard 4-color quartile scheme in rgba format
    const colors = [
      'rgba(215, 48, 39, 0.6)',    // #d73027 - Red (Strong brand2 advantage)
      'rgba(253, 174, 97, 0.6)',   // #fdae61 - Orange (Moderate brand2 advantage)
      'rgba(166, 217, 106, 0.6)',  // Light green - Moderate brand1 advantage  
      'rgba(26, 152, 80, 0.6)'     // Dark green - Strong brand1 advantage
    ];
    
    const legendItems = [];
    for (let i = 0; i < quartileBreaks.length; i++) {
      legendItems.push({
        label: this.formatDifferenceLabel(i, quartileBreaks),
        color: colors[i],
        minValue: quartileBreaks[i].min,
        maxValue: quartileBreaks[i].max
      });
    }
    
    return {
      title: 'Brand Market Share Difference (%)',
      items: legendItems,
      position: 'bottom-right'
    };
  }

  private calculateQuartileBreaks(values: number[]): Array<{min: number, max: number}> {
    if (values.length === 0) return [];
    
    // Use standard quartiles (4 equal groups) like other processors
    const q1 = values[Math.floor(values.length * 0.25)];
    const q2 = values[Math.floor(values.length * 0.5)];
    const q3 = values[Math.floor(values.length * 0.75)];
    
    // Create clean, non-overlapping ranges
    return [
      { min: values[0], max: q1 },
      { min: q1, max: q2 },
      { min: q2, max: q3 },
      { min: q3, max: values[values.length - 1] }
    ];
  }

  private formatDifferenceLabel(classIndex: number, breaks: Array<{min: number, max: number}>): string {
    if (classIndex === 0) {
      // First class: < maxValue
      return `< ${breaks[classIndex].max.toFixed(1)}%`;
    } else if (classIndex === breaks.length - 1) {
      // Last class: > minValue  
      return `> ${breaks[classIndex].min.toFixed(1)}%`;
    } else {
      // Middle classes: minValue% - maxValue%
      return `${breaks[classIndex].min.toFixed(1)}% - ${breaks[classIndex].max.toFixed(1)}%`;
    }
  }

  /**
   * Detect which brand fields are actually available in the raw data
   */
  private detectAvailableBrandFields(rawData: RawAnalysisResult): string[] {
    if (!rawData.results || rawData.results.length === 0) {
      return [];
    }

    const brandFieldsFound = new Map<string, string>(); // brand name -> field code
    const sampleRecord = rawData.results[0];
    
    // Look for ALL energy drink brand fields in the data (MP122XX_B_P pattern)
    for (const [key, value] of Object.entries(sampleRecord as any)) {
      if (key.includes('MP122') && key.endsWith('A_B_P') && typeof value === 'number') {
        // Use the field code directly (e.g., MP10128A_B_P)
        const fieldCode = key;
        
        // Try to find a known brand name from our mappings
        let brandName: string | null = null;
        for (const [brand, code] of Object.entries(this.BRAND_MAPPINGS)) {
          if (code === fieldCode) {
            brandName = brand;
            break;
          }
        }
        
        // If we don't know this brand, create a generic name from the field code
        if (!brandName) {
          // Extract the numeric part to create a generic brand name
          const match = fieldCode.match(/MP122(\d+)A_B_P/);
          if (match) {
            brandName = `energydrink${match[1]}`;
            console.log(`[BrandDifferenceProcessor] Found unknown brand field ${fieldCode}, naming it: ${brandName}`);
          } else {
            brandName = fieldCode; // Use field code as brand name if pattern doesn't match
          }
        }
        
        brandFieldsFound.set(brandName, fieldCode);
      }
    }
    
    const availableBrands = Array.from(brandFieldsFound.keys());
    console.log(`[BrandDifferenceProcessor] Detected ${availableBrands.length} brands in data:`, availableBrands);
    console.log(`[BrandDifferenceProcessor] Brand field mapping:`, Object.fromEntries(brandFieldsFound));
    return availableBrands;
  }

  /**
   * Get the field code for a brand, handling both known and unknown brands
   */
  private getBrandFieldCode(sampleRecord: any, brandName: string): string {
    // First check if it's a known brand
    const knownCode = this.BRAND_MAPPINGS[brandName as keyof typeof this.BRAND_MAPPINGS];
    if (knownCode) {
      return knownCode;
    }
    
    // Otherwise, search for the field in the data
    for (const [key, value] of Object.entries(sampleRecord as any)) {
      if (key.includes('MP122') && key.endsWith('A_B_P') && typeof value === 'number') {
        const fieldCode = key;
        
        // Check if this field matches any known brand
        for (const [brand, code] of Object.entries(this.BRAND_MAPPINGS)) {
          if (code === fieldCode && brand.toLowerCase() === brandName.toLowerCase()) {
            return fieldCode;
          }
        }
        
        // If brandName looks like a field code pattern (e.g., "energydrink207" for Red Bull), try to match it
        if (brandName.startsWith('energydrink')) {
          const brandNum = brandName.replace('energydrink', '');
          if (fieldCode.includes(brandNum)) {
            console.log(`[BrandDifferenceProcessor] Matched ${brandName} to field ${fieldCode}`);
            return fieldCode;
          }
        }
      }
    }
    
    console.warn(`[BrandDifferenceProcessor] Could not find field code for brand: ${brandName}, using Red Bull as fallback`);
    return 'MP12207A_B_P';
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