/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData } from '../../types';
import { getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';
import { BrandNameResolver } from '../../utils/BrandNameResolver';

/**
 * SegmentProfilingProcessor - Specialized processor for real estate segment profiling analysis
 * 
 * Focuses on identifying areas with strong housing market segmentation potential by analyzing
 * demographic distinctiveness, housing type clustering, market segment strength, and investment profiling clarity.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class SegmentProfilingProcessor extends BaseProcessor {
  private brandResolver: BrandNameResolver;

  constructor() {
    super(); // Initialize BaseProcessor with configuration
    this.brandResolver = new BrandNameResolver();
  }

  validate(rawData: RawAnalysisResult): boolean {
    return rawData && 
           rawData.success && 
           Array.isArray(rawData.results) && 
           rawData.results.length > 0;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'Segment profiling analysis failed');
    }

  // Determine canonical primary score field (allow metadata override)
  const primaryField = getPrimaryScoreField('segment_profiling', (rawData as any)?.metadata) || 'segment_score';

  const records = rawData.results.map((record: any, index: number) => {
      // Extract segment profiling score using configuration-driven approach
      const segmentScore = this.extractPrimaryMetric(record);
      
      // Extract related metrics for real estate segment analysis
      const householdIncome = this.extractNumericValue(record, ['ECYHRIAVG', 'household_income', 'median_income'], 0);
      const strategicScore = Number((record as any).strategic_value_score) || 0;
      const competitiveScore = Number((record as any).competitive_advantage_score) || 0;
      const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
      const trendScore = Number((record as any).trend_strength_score) || 0;
      const correlationScore = Number((record as any).correlation_strength_score) || 0;
      const totalPop = this.extractNumericValue(record, ['value_TOTPOP_CY', 'TOTPOP_CY', 'total_population']);
      const medianIncome = this.extractNumericValue(record, ['value_MEDDI_CY', 'value_AVGHINC_CY', 'median_income', 'ECYHRIAVG']);

      // Extract brand information dynamically
      const brandInfo = this.extractBrandInfo(record);

      // Calculate additional segmentation indicators
      const indicators = this.calculateSegmentationIndicators({
        segmentScore,
        householdIncome,
        strategicScore,
        competitiveScore,
        demographicScore,
        trendScore,
        correlationScore,
        totalPop,
        medianIncome,
        brandInfo
      });

      const out: any = {
        area_id: this.extractGeographicId(record) || `area_${index}`,
        area_name: this.generateAreaName(record),
        value: segmentScore,
        rank: index + 1, // Will be sorted later
        category: this.categorizeSegmentPotential(segmentScore),
        coordinates: this.extractCoordinates(record),
        properties: {
          // Core segmentation metrics
          [primaryField]: segmentScore,
          demographic_distinctiveness: indicators.demographicDistinctiveness,
          behavioral_clustering_strength: indicators.behavioralClustering,
          market_segment_strength: indicators.marketSegmentStrength,
          profiling_clarity: indicators.profilingClarity,
          
          // Segment characteristics
          primary_segment_type: indicators.primarySegmentType,
          segment_size: indicators.segmentSize,
          segment_income_level: indicators.segmentIncomeLevel,
          housing_segment_affinity: indicators.housingSegmentAffinity,
          
          // Demographic segmentation factors
          income_distinctiveness: indicators.incomeDistinctiveness,
          population_segment_category: indicators.populationSegmentCategory,
          demographic_profile_strength: indicators.demographicProfileStrength,
          
          // Behavioral segmentation factors
          strategic_behavioral_pattern: indicators.strategicBehavioralPattern,
          competitive_behavioral_pattern: indicators.competitiveBehavioralPattern,
          housing_preference_segment: indicators.housingPreferenceSegment,
          trend_behavioral_alignment: indicators.trendBehavioralAlignment,
          
          // Supporting segmentation data
          housing_market_strength: householdIncome,
          area_classification: this.classifyHousingArea(householdIncome, totalPop),
          market_population: totalPop,
          median_household_income: medianIncome,
          strategic_alignment: strategicScore,
          demographic_opportunity: demographicScore,
          competitive_position: competitiveScore,
          
          // Segmentation quality metrics
          segment_coherence: indicators.segmentCoherence,
          profile_completeness: indicators.profileCompleteness,
          segmentation_reliability: indicators.segmentationReliability,
          
          // Actionable segment insights
          recommended_segment_strategy: indicators.recommendedStrategy,
          segment_targeting_priority: indicators.targetingPriority,
          segmentation_complexity: indicators.segmentationComplexity
        },
        shapValues: (record as any).shap_values || {}
      };
      // Add segment_score field at top level for consistency
      out.segment_score = out.value;
      (out.properties as any).segment_score = out.value;
      return out;
    });

    // Sort by segment profiling score (highest first)
    records.sort((a, b) => b.value - a.value);
    
    // Update ranks after sorting
    records.forEach((record, index) => {
      (record as any).rank = index + 1;
    });

    // Calculate statistics
    const values = records.map(r => r.value);
    const statistics = this.calculateStatistics(values);

    // Generate segment profiling summary
    const summary = this.generateSegmentSummary(records, statistics);

    return {
      type: 'segment_profiling',
      records,
      summary,
      featureImportance: rawData.feature_importance || [],
      statistics,
      targetVariable: primaryField, // use canonical primary field
      renderer: this.createSegmentRenderer(records, primaryField),
      legend: this.createSegmentLegend(records)
    };
  }


  private classifyHousingArea(income: number, population: number): string {
    if (income > 80000 && population > 50000) return 'Premium Urban Market';
    if (income > 60000 && population > 25000) return 'Established Suburban Market';
    if (income > 40000) return 'Growing Market Area';
    if (population > 10000) return 'Developing Urban Area';
    return 'Emerging Market';
  }

  private calculateSegmentationIndicators(metrics: {
    segmentScore: number;
    householdIncome: number;
    strategicScore: number;
    competitiveScore: number;
    demographicScore: number;
    trendScore: number;
    correlationScore: number;
    totalPop: number;
    medianIncome: number;
    brandInfo: { share: number; name: string };
  }) {
    const {
      segmentScore,
      householdIncome,
      strategicScore,
      competitiveScore,
      demographicScore,
      trendScore,
      correlationScore,
      totalPop,
      medianIncome,
      brandInfo
    } = metrics;

    // Extract brand values from brandInfo
    const targetBrandShare = brandInfo.share;
    const targetBrandName = brandInfo.name;

    // Demographic distinctiveness assessment
    const demographicDistinctiveness = demographicScore >= 80 ? 'Very High' :
                                     demographicScore >= 65 ? 'High' :
                                     demographicScore >= 50 ? 'Moderate' :
                                     demographicScore >= 35 ? 'Low' : 'Very Low';

    // Behavioral clustering strength
    const behavioralClustering = (strategicScore >= 70 && targetBrandShare >= 20) ? 'Strong' :
                               (strategicScore >= 50 || targetBrandShare >= 15) ? 'Moderate' :
                               (strategicScore >= 30 || targetBrandShare >= 8) ? 'Weak' : 'Limited';

    // Market segment strength assessment
    const marketSegmentStrength = correlationScore >= 70 ? 'Excellent' :
                                correlationScore >= 50 ? 'Good' :
                                correlationScore >= 35 ? 'Fair' : 'Limited';

    // Profiling clarity assessment  
    const dataFields = [targetBrandShare, strategicScore, competitiveScore, demographicScore, 
                       trendScore, correlationScore, totalPop, medianIncome].filter(v => v > 0).length;
    const profilingClarity = dataFields >= 7 ? 'Very Clear' :
                           dataFields >= 5 ? 'Clear' :
                           dataFields >= 3 ? 'Moderate' : 'Limited';

    // Primary segment type identification
    let primarySegmentType = 'Mixed Market';
    if (targetBrandShare >= 25 && medianIncome >= 100000) primarySegmentType = `Premium ${targetBrandName} Loyalists`;
    else if (targetBrandShare >= 20 && medianIncome >= 80000) primarySegmentType = `Affluent ${targetBrandName} Consumers`;
    else if (targetBrandShare >= 15 && demographicScore >= 70) primarySegmentType = `Demographic ${targetBrandName} Segment`;
    else if (medianIncome >= 100000) primarySegmentType = 'High-Income Market'; 
    else if (demographicScore >= 80) primarySegmentType = 'High-Demographic Potential';
    else if (strategicScore >= 70) primarySegmentType = 'Strategic Target Market';
    else if (totalPop >= 100000) primarySegmentType = 'Mass Market Segment';
    else if (totalPop >= 50000) primarySegmentType = 'Large Market Segment';
    else primarySegmentType = 'Niche Market Segment';

    // Segment size category
    const segmentSize = totalPop >= 100000 ? 'Large' :
                       totalPop >= 50000 ? 'Medium-Large' :
                       totalPop >= 25000 ? 'Medium' :
                       totalPop >= 10000 ? 'Small-Medium' : 'Small';

    // Segment income level
    const segmentIncomeLevel = medianIncome >= 120000 ? 'Very High Income' :
                              medianIncome >= 100000 ? 'High Income' :
                              medianIncome >= 80000 ? 'Upper-Middle Income' :
                              medianIncome >= 60000 ? 'Middle Income' :
                              medianIncome >= 40000 ? 'Lower-Middle Income' : 'Lower Income';

    // Housing segment affinity based on income and market characteristics
    const housingSegmentAffinity = householdIncome >= 80000 ? 'Premium Housing Affinity' :
                                   householdIncome >= 60000 ? 'Upper-Mid Housing Affinity' :
                                   householdIncome >= 40000 ? 'Mid-Market Housing Affinity' :
                                   householdIncome >= 25000 ? 'Affordable Housing Affinity' : 'Entry-Level Housing Affinity';

    // Income distinctiveness
    const incomeDistinctiveness = medianIncome >= 120000 ? 'Highly Distinctive' :
                                 medianIncome >= 100000 ? 'Very Distinctive' :
                                 medianIncome >= 80000 ? 'Distinctive' :
                                 medianIncome >= 60000 ? 'Moderately Distinctive' : 'Not Distinctive';

    // Population segment category
    const populationSegmentCategory = totalPop >= 100000 ? 'Metro Segment' :
                                    totalPop >= 50000 ? 'Urban Segment' :
                                    totalPop >= 25000 ? 'Suburban Segment' :
                                    totalPop >= 10000 ? 'Community Segment' : 'Local Segment';

    // Demographic profile strength
    const demographicProfileStrength = (demographicScore >= 70 && medianIncome >= 80000) ? 'Very Strong' :
                                     (demographicScore >= 60 || medianIncome >= 70000) ? 'Strong' :
                                     (demographicScore >= 45 || medianIncome >= 50000) ? 'Moderate' : 'Weak';

    // Strategic behavioral pattern
    const strategicBehavioralPattern = strategicScore >= 80 ? 'Highly Strategic' :
                                     strategicScore >= 65 ? 'Strategic' :
                                     strategicScore >= 50 ? 'Moderately Strategic' :
                                     strategicScore >= 35 ? 'Somewhat Strategic' : 'Non-Strategic';

    // Competitive behavioral pattern  
    const competitiveBehavioralPattern = competitiveScore >= 8 ? 'Highly Competitive' :
                                       competitiveScore >= 6 ? 'Competitive' :
                                       competitiveScore >= 4 ? 'Moderately Competitive' : 'Low Competition';

    // Housing preference segment based on market stability
    const housingPreferenceSegment = (strategicScore >= 70 && householdIncome >= 60000) ? 'Stable Market Preference' :
                                     (strategicScore >= 50 || householdIncome >= 45000) ? 'Growing Market Preference' :
                                     (strategicScore >= 35 || householdIncome >= 30000) ? 'Emerging Market Preference' : 'Developing Market Preference';

    // Trend behavioral alignment
    const trendBehavioralAlignment = trendScore >= 75 ? 'Strongly Aligned' :
                                   trendScore >= 60 ? 'Well Aligned' :
                                   trendScore >= 45 ? 'Moderately Aligned' : 'Poorly Aligned';

    // Segment coherence
    const activeScores = [strategicScore, demographicScore, trendScore, correlationScore].filter(s => s > 0);
    let segmentCoherence = 'Unknown';
    if (activeScores.length >= 3) {
      const mean = activeScores.reduce((a, b) => a + b, 0) / activeScores.length;
      const coherent = activeScores.every(s => Math.abs(s - mean) <= 25);
      segmentCoherence = coherent ? 'High Coherence' : 'Mixed Coherence';
    }

    // Profile completeness
    const profileCompleteness = Math.round((dataFields / 8) * 100);

    // Segmentation reliability
    const segmentationReliability = segmentScore >= 65 ? 'High Reliability' :
                                   segmentScore >= 50 ? 'Moderate Reliability' :
                                   segmentScore >= 35 ? 'Low Reliability' : 'Poor Reliability';

    // Recommended segment strategy
    let recommendedStrategy = 'General Marketing';
    if (primarySegmentType.includes('Premium')) recommendedStrategy = 'Luxury Positioning';
    else if (primarySegmentType.includes('Affluent')) recommendedStrategy = 'Premium Targeting';
    else if (primarySegmentType.includes('Demographic')) recommendedStrategy = 'Demographic-Focused';
    else if (primarySegmentType.includes('Strategic')) recommendedStrategy = 'Strategic Investment';
    else if (primarySegmentType.includes('Mass')) recommendedStrategy = 'Mass Market Approach';
    else if (primarySegmentType.includes('Niche')) recommendedStrategy = 'Niche Specialization';

    // Targeting priority
    const targetingPriority = (segmentScore >= 60 && (targetBrandShare >= 15 || medianIncome >= 80000)) ? 'High Priority' :
                            (segmentScore >= 50 || targetBrandShare >= 12) ? 'Medium Priority' :
                            (segmentScore >= 40) ? 'Low Priority' : 'Minimal Priority';

    // Segmentation complexity
    const segmentationComplexity = (dataFields >= 7 && activeScores.length >= 4) ? 'High Complexity' :
                                 (dataFields >= 5 && activeScores.length >= 3) ? 'Moderate Complexity' :
                                 (dataFields >= 3) ? 'Low Complexity' : 'Simple Segmentation';

    return {
      demographicDistinctiveness,
      behavioralClustering,
      marketSegmentStrength,
      profilingClarity,
      primarySegmentType,
      segmentSize,
      segmentIncomeLevel,
      housingSegmentAffinity,
      incomeDistinctiveness,
      populationSegmentCategory,
      demographicProfileStrength,
      strategicBehavioralPattern,
      competitiveBehavioralPattern,
      housingPreferenceSegment,
      trendBehavioralAlignment,
      segmentCoherence,
      profileCompleteness,
      segmentationReliability,
      recommendedStrategy,
      targetingPriority,
      segmentationComplexity
    };
  }

  private categorizeSegmentPotential(score: number): string {
    if (score >= 80) return 'Excellent Segmentation';
    if (score >= 65) return 'Good Segment Potential';
    if (score >= 50) return 'Moderate Segmentation';
    if (score >= 35) return 'Limited Segment Value';
    return 'Poor Segmentation';
  }

  private extractCoordinates(record: any): [number, number] {
    if ((record as any).coordinates && Array.isArray((record as any).coordinates)) {
      return [(record as any).coordinates[0] || 0, (record as any).coordinates[1] || 0];
    }
    
    // Try to extract from latitude/longitude fields
    const lat = Number((record as any).latitude || (record as any).lat || (record as any).LATITUDE) || 0;
    const lng = Number((record as any).longitude || (record as any).lng || (record as any).lon || (record as any).LONGITUDE) || 0;
    
    return [lng, lat]; // GeoJSON format [longitude, latitude]
  }

  private generateSegmentSummary(records: any[], statistics: any): string {
    const topSegmentable = records.slice(0, 5);
    const excellentCount = records.filter(r => r.value >= 80).length;
    const goodCount = records.filter(r => r.value >= 65 && r.value < 80).length;
    const avgScore = statistics.mean.toFixed(1);

    const topMarkets = topSegmentable
      .map(r => `${r.area_name} (${r.value.toFixed(1)})`)
      .join(', ');

    // Identify dominant segment types from top markets
    const segmentTypes = topSegmentable.map(r => (r.properties as any).primary_segment_type);
    const dominantSegmentType = this.findMostCommon(segmentTypes) || 'Mixed segments';

    return `Segment profiling analysis of ${records.length} markets identified ${excellentCount} areas with excellent segmentation potential (80+) and ${goodCount} with good segment potential (65-79). Average segment profiling score: ${avgScore}. Top segmentable markets: ${topMarkets}. Analysis reveals ${dominantSegmentType.toLowerCase()} as the primary high-value segment type, considering demographic distinctiveness, behavioral clustering, market segment strength, and profiling clarity.`;
  }

  private findMostCommon(arr: string[]): string {
    const frequency: Record<string, number> = {};
    arr.forEach(item => frequency[item] = (frequency[item] || 0) + 1);
    return Object.keys(frequency as any).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
  }

  /**
   * Extract brand information dynamically using brand resolver
   * Returns object with share value and brand name
   */
  private extractBrandInfo(record: any): { share: number; name: string } {
    // First try using dynamic brand detection
    const brandFields = this.brandResolver?.detectBrandFields?.(record) || [];
    
    if (brandFields.length > 0) {
      const primaryBrand = brandFields[0]; // Highest value brand field
      return {
        share: primaryBrand.value,
        name: primaryBrand.metricName || 'Primary Brand'
      };
    }
    
    // Fallback to common brand share field patterns
    const brandPatterns = [
      { field: 'value_MP30034A_B_P', name: 'Nike' },
      { field: 'mp30034a_b_p', name: 'Nike' },
      { field: 'brand_share', name: 'Brand' },
      { field: 'market_share', name: 'Market' },
      { field: 'share', name: 'Share' }
    ];
    
    for (const pattern of brandPatterns) {
      const value = Number(record[pattern.field]);
      if (!isNaN(value) && value > 0) {
        return {
          share: value,
          name: pattern.name
        };
      }
    }
    
    // Final fallback: return default values
    return {
      share: 0,
      name: 'Market'
    };
  }



  // ============================================================================
  // RENDERING METHODS  
  // ============================================================================

  private createSegmentRenderer(records: any[], primaryField?: string): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    // Use standard red-to-green color scheme: Red (low) -> Orange -> Light Green -> Dark Green (high)
    const segmentColors = [
      [215, 48, 39, 0.6],   // #d73027 - Red (low segment value)
      [253, 174, 97, 0.6],  // #fdae61 - Orange  
      [166, 217, 106, 0.6], // #a6d96a - Light Green
      [26, 152, 80, 0.6]    // #1a9850 - Dark Green (high segment value)
    ];
    
    return {
      type: 'class-breaks',
      field: primaryField || 'segment_score',
      classBreakInfos: quartileBreaks.map((breakRange, i) => ({
        minValue: breakRange.min,
        maxValue: breakRange.max,
        symbol: {
          type: 'simple-fill',
          color: segmentColors[i],
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

  private createSegmentLegend(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    const quartileBreaks = this.calculateQuartileBreaks(values);
    
    const colors = [
      'rgba(215, 48, 39, 0.6)',   // Low segment value
      'rgba(253, 174, 97, 0.6)',  // Medium-low  
      'rgba(166, 217, 106, 0.6)', // Medium-high
      'rgba(26, 152, 80, 0.6)'    // High segment value
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
      title: 'Segment Profile Score',
      items: legendItems,
      position: 'bottom-right'
    };
  }

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

  private formatClassLabel(classIndex: number, breaks: Array<{min: number, max: number}>): string {
    if (classIndex === 0) {
      return `< ${breaks[classIndex].max.toFixed(1)}`;
    } else if (classIndex === breaks.length - 1) {
      return `> ${breaks[classIndex].min.toFixed(1)}`;
    } else {
      return `${breaks[classIndex].min.toFixed(1)} - ${breaks[classIndex].max.toFixed(1)}`;
    }
  }
}