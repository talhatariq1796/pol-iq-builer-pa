/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData } from '../../types';
import { getPrimaryScoreField } from './HardcodedFieldDefs';
import { BaseProcessor } from './BaseProcessor';

/**
 * PredictiveModelingProcessor - Specialized processor for real estate predictive modeling analysis
 * 
 * Focuses on identifying areas with high predictability and reliable housing market forecasting potential
 * by analyzing model confidence, market pattern stability, forecast reliability, and real estate data quality.
 * 
 * Extends BaseProcessor for configuration-driven behavior with real estate focus.
 */
export class PredictiveModelingProcessor extends BaseProcessor {
  private scoreField: string = 'prediction_score';
  
  constructor() {
    super(); // Initialize BaseProcessor with configuration
  }
  validate(rawData: RawAnalysisResult): boolean {
    console.log(`🔍 [PredictiveModelingProcessor] Validating data:`, {
      hasRawData: !!rawData,
      isObject: typeof rawData === 'object',
      hasSuccess: rawData?.success,
      hasResults: Array.isArray(rawData?.results),
      resultsLength: rawData?.results?.length,
      firstRecordKeys: rawData?.results?.[0] ? Object.keys(rawData.results[0]).slice(0, 15) : []
    });

    if (!rawData || typeof rawData !== 'object') {
      console.log(`❌ [PredictiveModelingProcessor] Validation failed: Invalid rawData structure`);
      return false;
    }
    if (!rawData.success) {
      console.log(`❌ [PredictiveModelingProcessor] Validation failed: success=false`);
      return false;
    }
    if (!Array.isArray(rawData.results)) {
      console.log(`❌ [PredictiveModelingProcessor] Validation failed: results not array`);
      return false;
    }
    
    // Empty results are valid
    if (rawData.results.length === 0) {
      console.log(`✅ [PredictiveModelingProcessor] Validation passed: Empty results`);
      return true;
    }

    // Check first few records for required fields - flexible approach
    const sampleSize = Math.min(5, rawData.results.length);
    const sampleRecords = rawData.results.slice(0, sampleSize);
    
    for (let i = 0; i < sampleRecords.length; i++) {
      const record = sampleRecords[i];
      
      // Check for ID field (flexible naming)
      const hasIdField = record && (
        (record as any).area_id !== undefined || 
        (record as any).id !== undefined || 
        (record as any).ID !== undefined ||
        (record as any).GEOID !== undefined ||
        (record as any).zipcode !== undefined ||
        (record as any).area_name !== undefined
      );
      
      // Check for predictive modeling fields or any numeric field
      const hasScoringField = record && (
        (record as any).prediction_score !== undefined || 
        (record as any).predictive_modeling_score !== undefined || 
        (record as any).predictive_score !== undefined ||
        (record as any).value !== undefined || 
        (record as any).score !== undefined ||
        (record as any).thematic_value !== undefined ||
        // Accept any numeric field that looks like data
        Object.keys(record as any).some(key => 
          typeof (record as any)[key] === 'number' && 
          !key.toLowerCase().includes('date') &&
          !key.toLowerCase().includes('time') &&
          !key.toLowerCase().includes('area') &&
          !key.toLowerCase().includes('length') &&
          !key.toLowerCase().includes('objectid')
        )
      );
      
      console.log(`🔍 [PredictiveModelingProcessor] Record ${i} validation:`, {
        hasIdField,
        hasScoringField,
        recordKeys: Object.keys(record as any).slice(0, 10)
      });
      
      if (hasIdField && hasScoringField) {
        console.log(`✅ [PredictiveModelingProcessor] Validation passed: Found valid record structure`);
        return true;
      }
    }
    
    console.log(`❌ [PredictiveModelingProcessor] Validation failed: No records with both ID and scoring fields found`);
    return false;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'Predictive modeling analysis failed');
    }

    // Determine canonical primary score for predictive modeling (metadata override allowed)
    try {
      const primary = getPrimaryScoreField('predictive_modeling', (rawData as any)?.metadata ?? undefined) || 'predictive_modeling_score';
      this.scoreField = primary;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      // keep default
    }

    const records = rawData.results.map((record: any, index: number) => {
      // Extract the pre-calculated predictive modeling score with flexible fallback
      const predictiveScore = this.extractPredictiveScore(record);
      
      // Extract related metrics for additional analysis (updated for actual dataset fields)
      const nikeShare = Number((record as any).value_MP30034A_B_P || (record as any).mp30034a_b_p) || 0;
      const strategicScore = Number((record as any).strategic_value_score) || 0;
      const correlationScore = Number((record as any).correlation_strength_score) || 0;
      const trendScore = Number((record as any).trend_strength_score) || 0;
      const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
      const totalPop = Number((record as any).value_TOTPOP_CY || (record as any).TOTPOP_CY || (record as any).total_population) || 0;
      const medianIncome = Number((record as any).value_MEDDI_CY || (record as any).value_AVGHINC_CY || (record as any).median_income) || 0;

      // Calculate additional predictive indicators
      const indicators = this.calculatePredictiveIndicators({
        predictiveScore,
        nikeShare,
        strategicScore,
        correlationScore,
        trendScore,
        demographicScore,
        totalPop,
        medianIncome
      });

      return {
        area_id: (record as any).area_id || (record as any).ID || `area_${index}`,
        area_name: (record as any).value_DESCRIPTION || (record as any).DESCRIPTION || (record as any).area_name || `Area ${index + 1}`,
        value: predictiveScore,
  // Mirror canonical primary score at top-level for downstream consumers
  [this.scoreField]: predictiveScore,
        rank: index + 1, // Will be sorted later
        category: this.categorizePredictiveLevel(predictiveScore),
        coordinates: this.extractCoordinates(record),
        properties: {
          // Core predictive metrics
          predictive_modeling_score: predictiveScore,
          [this.scoreField]: predictiveScore,
          model_confidence_level: indicators.modelConfidenceLevel,
          forecast_reliability: indicators.forecastReliability,
          pattern_stability: indicators.patternStability,
          data_quality_index: indicators.dataQualityIndex,
          
          // Supporting predictive factors
          prediction_confidence: indicators.predictionConfidence,
          prediction_accuracy_potential: indicators.accuracyPotential,
          model_reliability_score: indicators.reliabilityScore,
          forecast_horizon_strength: indicators.forecastHorizonStrength,
          
          // Predictive model components
          correlation_strength: correlationScore,
          trend_consistency: trendScore,
          strategic_predictability: strategicScore,
          demographic_stability: demographicScore,
          
          // Market characteristics affecting predictability
          nike_market_share: nikeShare,
          market_size: totalPop,
          income_stability: medianIncome,
          
          // Data completeness metrics
          data_completeness_score: indicators.dataCompletenessScore,
          variable_availability: indicators.variableAvailability,
          
          // Predictive insights
          prediction_type: indicators.predictionType,
          forecast_confidence: indicators.forecastConfidence,
          model_suitability: indicators.modelSuitability
        },
        shapValues: (record as any).shap_values || {}
      };
    });

    // Sort by predictive modeling score (highest first)
    records.sort((a, b) => b.value - a.value);
    
    // Update ranks after sorting
    records.forEach((record, index) => {
      (record as any).rank = index + 1;
    });

    // Calculate statistics
    const values = records.map(r => r.value);
    const statistics = this.calculateStatistics(values);

    // Generate predictive modeling summary
    const summary = this.generatePredictiveSummary(records, statistics);

    const renderer = this.createPredictiveRenderer(records);
    return {
      type: 'predictive_modeling',
      records,
      summary,
      featureImportance: rawData.feature_importance || [],
      statistics,
      targetVariable: this.scoreField,
      renderer
    };
  }

  private extractPredictiveScore(record: any): number {
    // First try to use the canonical score field
    const canonicalScore = Number((record as any)[this.scoreField]);
    if (!isNaN(canonicalScore) && canonicalScore > 0) {
      return canonicalScore;
    }
    
    // Try pre-calculated predictive modeling scores
    const predictiveFields = [
      'predictive_modeling_score',
      'prediction_score', 
      'predictive_score',
      'forecast_score',
      'model_score'
    ];
    
    for (const fieldName of predictiveFields) {
      const value = Number((record as any)[fieldName]);
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }
    
    // Fallback to general score fields
    const generalFields = [
      'value',
      'score',
      'thematic_value'
    ];
    
    for (const fieldName of generalFields) {
      const value = Number((record as any)[fieldName]);
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }
    
    // Calculate synthetic predictive score from available components
    const nikeShare = Number((record as any).value_MP30034A_B_P || (record as any).mp30034a_b_p) || 0;
    const strategicScore = Number((record as any).strategic_value_score) || 0;
    const correlationScore = Number((record as any).correlation_strength_score) || 0;
    const trendScore = Number((record as any).trend_strength_score) || 0;
    const demographicScore = Number((record as any).demographic_opportunity_score) || 0;
    
    // Create a composite score based on available predictive factors
    let compositeScore = 0;
    let components = 0;
    
    // Strategic score (30% weight)
    if (strategicScore > 0) {
      compositeScore += strategicScore * 0.3;
      components++;
    }
    
    // Correlation strength (25% weight)
    if (correlationScore > 0) {
      compositeScore += correlationScore * 0.25;
      components++;
    }
    
    // Trend consistency (20% weight)
    if (trendScore > 0) {
      compositeScore += trendScore * 0.2;
      components++;
    }
    
    // Market presence (15% weight)
    if (nikeShare > 0) {
      // Convert percentage to score (cap at 100)
      const marketScore = Math.min(nikeShare * 2, 100);
      compositeScore += marketScore * 0.15;
      components++;
    }
    
    // Demographic opportunity (10% weight)
    if (demographicScore > 0) {
      compositeScore += demographicScore * 0.1;
      components++;
    }
    
    // If we have enough components to make a meaningful score
    if (components >= 2) {
      // Normalize by the number of components to get a balanced score
      const normalizedScore = compositeScore / (components * 0.2); // Adjust for average weight
      return Math.min(100, Math.max(0, normalizedScore));
    }
    
    // Final fallback: use any available numeric field that looks meaningful
    const allKeys = Object.keys(record as any);
    for (const key of allKeys) {
      const value = Number((record as any)[key]);
      if (!isNaN(value) && value > 0 && value <= 1000) { // Reasonable range
        const lowerKey = key.toLowerCase();
        // Skip obviously non-score fields
        if (!lowerKey.includes('date') && 
            !lowerKey.includes('time') && 
            !lowerKey.includes('objectid') &&
            !lowerKey.includes('area') &&
            !lowerKey.includes('length') &&
            !lowerKey.includes('coord')) {
          // Scale if necessary
          return value > 100 ? Math.min(value / 10, 100) : value;
        }
      }
    }
    
    // Absolute fallback
    return 25; // Minimal predictive value
  }

  // Minimal renderer for predictive modeling to satisfy visualization tests
  private createPredictiveRenderer(records: any[]): any {
    const values = records.map(r => r.value).filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (values.length === 0) {
      return { type: 'simple', field: this.scoreField };
    }
    const q1 = values[Math.floor(values.length * 0.25)];
    const q2 = values[Math.floor(values.length * 0.5)];
    const q3 = values[Math.floor(values.length * 0.75)];
    return {
      type: 'class-breaks',
      field: this.scoreField,
      classBreakInfos: [
        { minValue: values[0], maxValue: q1 },
        { minValue: q1, maxValue: q2 },
        { minValue: q2, maxValue: q3 },
        { minValue: q3, maxValue: values[values.length - 1] }
      ]
    };
  }

  private calculatePredictiveIndicators(metrics: {
    predictiveScore: number;
    nikeShare: number;
    strategicScore: number;
    correlationScore: number;
    trendScore: number;
    demographicScore: number;
    totalPop: number;
    medianIncome: number;
  }) {
    const {
      predictiveScore,
      nikeShare,
      strategicScore,
      correlationScore,
      trendScore,
      demographicScore,
      totalPop,
      medianIncome
    } = metrics;

    // Model confidence level based on correlation and data availability
    const modelConfidenceLevel = correlationScore > 0 ? 
      (correlationScore >= 70 ? 'High' : correlationScore >= 50 ? 'Moderate' : 'Low') :
      (strategicScore > 60 && demographicScore > 60 ? 'Moderate' : 'Low');

    // Forecast reliability based on trend consistency and strategic alignment
    const forecastReliability = trendScore > 0 ?
      (trendScore >= 75 ? 'Excellent' : trendScore >= 60 ? 'Good' : trendScore >= 45 ? 'Fair' : 'Limited') :
      (strategicScore >= 70 ? 'Good' : 'Limited');

    // Pattern stability assessment
    const scores = [strategicScore, demographicScore, trendScore, correlationScore].filter(s => s > 0);
    let patternStability = 'Unknown';
    if (scores.length >= 3) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
      const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
      
      if (coefficientOfVariation < 0.2) patternStability = 'Very Stable';
      else if (coefficientOfVariation < 0.4) patternStability = 'Stable';
      else if (coefficientOfVariation < 0.6) patternStability = 'Moderate';
      else patternStability = 'Volatile';
    }

    // Data quality index
    const totalFields = 8;
    const availableFields = [nikeShare, strategicScore, correlationScore, trendScore, 
                           demographicScore, totalPop, medianIncome, predictiveScore].filter(v => v > 0).length;
    const dataQualityIndex = Math.round((availableFields / totalFields) * 100);

    // Prediction confidence level
    const predictionConfidence = predictiveScore >= 75 ? 'Very High' :
                               predictiveScore >= 65 ? 'High' :
                               predictiveScore >= 50 ? 'Moderate' :
                               predictiveScore >= 35 ? 'Low' : 'Very Low';

    // Accuracy potential assessment
    const accuracyPotential = (correlationScore > 60 && trendScore > 60) ? 'Excellent' :
                            (correlationScore > 45 || trendScore > 45) ? 'Good' :
                            (strategicScore > 60 && demographicScore > 60) ? 'Moderate' : 'Limited';

    // Model reliability score (0-100)
    const reliabilityScore = Math.round(
      (predictiveScore * 0.4) + 
      (correlationScore * 0.3) + 
      (trendScore * 0.2) + 
      (dataQualityIndex * 0.1)
    );

    // Forecast horizon strength
    const forecastHorizonStrength = predictiveScore >= 70 ? 'Long-term' :
                                  predictiveScore >= 55 ? 'Medium-term' :
                                  predictiveScore >= 40 ? 'Short-term' : 'Limited';

    // Data completeness score
    const dataCompletenessScore = dataQualityIndex;
    
    // Variable availability count
    const variableAvailability = `${availableFields}/${totalFields}`;

    // Prediction type based on strengths
    let predictionType = 'General';
    if (correlationScore >= 70) predictionType = 'Correlation-based';
    else if (trendScore >= 70) predictionType = 'Trend-based';
    else if (strategicScore >= 70 && demographicScore >= 70) predictionType = 'Multi-factor';
    else if (nikeShare >= 20) predictionType = 'Market-based';

    // Forecast confidence percentage
    const forecastConfidence = Math.min(100, Math.round(predictiveScore + (correlationScore * 0.2)));

    // Model suitability assessment
    const modelSuitability = predictiveScore >= 65 ? 'Highly Suitable' :
                           predictiveScore >= 50 ? 'Suitable' :
                           predictiveScore >= 35 ? 'Moderately Suitable' : 'Limited Suitability';

    return {
      modelConfidenceLevel,
      forecastReliability,
      patternStability,
      dataQualityIndex,
      predictionConfidence,
      accuracyPotential,
      reliabilityScore,
      forecastHorizonStrength,
      dataCompletenessScore,
      variableAvailability,
      predictionType,
      forecastConfidence,
      modelSuitability
    };
  }

  private categorizePredictiveLevel(score: number): string {
    if (score >= 80) return 'Excellent Predictability';
    if (score >= 65) return 'Good Predictive Potential';
    if (score >= 50) return 'Moderate Predictability';
    if (score >= 35) return 'Limited Predictive Value';
    return 'Poor Predictive Reliability';
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

  private generatePredictiveSummary(records: any[], statistics: any): string {
    const topPredictive = records.slice(0, 5);
    const excellentCount = records.filter(r => r.value >= 80).length;
    const goodCount = records.filter(r => r.value >= 65 && r.value < 80).length;
    const avgScore = statistics.mean.toFixed(1);

    const topMarkets = topPredictive
      .map(r => `${r.area_name} (${r.value.toFixed(1)})`)
      .join(', ');

    return `Predictive modeling analysis of ${records.length} markets identified ${excellentCount} areas with excellent predictability (80+) and ${goodCount} with good predictive potential (65-79). Average predictive modeling score: ${avgScore}. Top predictable markets: ${topMarkets}. Analysis considers model confidence, pattern stability, forecast reliability, and data quality to identify markets most suitable for accurate predictions and strategic planning.`;
  }


}