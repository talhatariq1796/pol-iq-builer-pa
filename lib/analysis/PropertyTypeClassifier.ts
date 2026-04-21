/**
 * PropertyTypeClassifier
 *
 * Automatically detects whether a property is a revenue property (investment real estate)
 * or residential property (single-family, condo) based on available data fields.
 *
 * Detection Logic:
 * - Revenue Property: Has potential_gross_revenue OR common_expenses data
 * - Residential Property: Lacks revenue-specific fields
 *
 * This classification drives separate analysis paths:
 * - Revenue: Investment-focused (NOI, GIM, cap rate, cash flow)
 * - Residential: Lifestyle-focused (schools, walkability, comparable sales)
 */

export type PropertyCategory = 'residential' | 'revenue';

export interface PropertyTypeResult {
  isRevenueProperty: boolean;
  propertyCategory: PropertyCategory;
  confidence: number; // 0-1, how confident we are in the classification
  detectionReason: string; // Why we classified it this way
  hasCompleteData: boolean; // Whether property has sufficient data for analysis
}

export class PropertyTypeClassifier {
  /**
   * Classify a property as revenue or residential
   *
   * @param property - Property data with potential revenue fields
   * @returns Classification result with confidence and reasoning
   */
  static classify(property: {
    potential_gross_revenue?: number | null;
    common_expenses?: number | null;
    gross_income_multiplier?: number | null;
    price_vs_assessment?: number | null;
    property_type?: string;
    pt?: string;
  }): PropertyTypeResult {
    // Check for revenue property indicators
    const hasPotentialRevenue = this.hasValue(property.potential_gross_revenue);
    const hasCommonExpenses = this.hasValue(property.common_expenses);
    const hasGIM = this.hasValue(property.gross_income_multiplier);
    const hasPriceVsAssessment = this.hasValue(property.price_vs_assessment);

    // Count revenue indicators present
    const revenueIndicators = [
      hasPotentialRevenue,
      hasCommonExpenses,
      hasGIM,
      hasPriceVsAssessment,
    ].filter(Boolean).length;

    // Primary detection: presence of potential_gross_revenue or common_expenses
    const isRevenueProperty = hasPotentialRevenue || hasCommonExpenses;

    // Calculate confidence based on number of indicators
    let confidence: number;
    let detectionReason: string;

    if (isRevenueProperty) {
      if (revenueIndicators >= 3) {
        confidence = 1.0; // Very confident
        detectionReason = `Strong revenue property signals: ${revenueIndicators}/4 investment metrics present`;
      } else if (revenueIndicators === 2) {
        confidence = 0.85;
        detectionReason = `Revenue property detected: ${this.getIndicatorsList(
          hasPotentialRevenue,
          hasCommonExpenses,
          hasGIM,
          hasPriceVsAssessment
        )}`;
      } else {
        confidence = 0.7;
        detectionReason = `Likely revenue property: ${this.getIndicatorsList(
          hasPotentialRevenue,
          hasCommonExpenses,
          hasGIM,
          hasPriceVsAssessment
        )}`;
      }
    } else {
      confidence = 0.95; // Confident it's residential
      detectionReason = 'No revenue property indicators found - classified as residential';
    }

    // Check for complete data
    const hasCompleteData = isRevenueProperty
      ? hasPotentialRevenue && hasCommonExpenses // Revenue needs both for calculations
      : true; // Residential doesn't have strict requirements

    return {
      isRevenueProperty,
      propertyCategory: isRevenueProperty ? 'revenue' : 'residential',
      confidence,
      detectionReason,
      hasCompleteData,
    };
  }

  /**
   * Batch classify multiple properties
   * Useful for statistics and reporting
   */
  static classifyBatch(
    properties: Array<{
      potential_gross_revenue?: number | null;
      common_expenses?: number | null;
      gross_income_multiplier?: number | null;
      price_vs_assessment?: number | null;
    }>
  ): {
    results: PropertyTypeResult[];
    summary: {
      totalProperties: number;
      revenueProperties: number;
      residentialProperties: number;
      revenuePercentage: number;
      averageConfidence: number;
    };
  } {
    const results = properties.map((prop) => this.classify(prop));

    const revenueProperties = results.filter((r) => r.isRevenueProperty).length;
    const residentialProperties = results.length - revenueProperties;
    const averageConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
      results,
      summary: {
        totalProperties: properties.length,
        revenueProperties,
        residentialProperties,
        revenuePercentage: (revenueProperties / properties.length) * 100,
        averageConfidence,
      },
    };
  }

  /**
   * Check if a value exists and is meaningful (not null, undefined, or 0)
   */
  private static hasValue(value: number | null | undefined): boolean {
    return value != null && value !== 0;
  }

  /**
   * Generate human-readable list of indicators found
   */
  private static getIndicatorsList(
    hasPotentialRevenue: boolean,
    hasCommonExpenses: boolean,
    hasGIM: boolean,
    hasPriceVsAssessment: boolean
  ): string {
    const indicators: string[] = [];

    if (hasPotentialRevenue) indicators.push('potential gross revenue');
    if (hasCommonExpenses) indicators.push('operating expenses');
    if (hasGIM) indicators.push('GIM');
    if (hasPriceVsAssessment) indicators.push('price/assessment ratio');

    if (indicators.length === 0) return 'no indicators';
    if (indicators.length === 1) return indicators[0];
    if (indicators.length === 2) return indicators.join(' and ');

    const last = indicators.pop();
    return `${indicators.join(', ')}, and ${last}`;
  }

  /**
   * Validate classification result
   * Returns warnings if classification seems uncertain
   */
  static validateClassification(result: PropertyTypeResult): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Low confidence warning
    if (result.confidence < 0.8) {
      warnings.push(
        `Low confidence (${(result.confidence * 100).toFixed(0)}%) in classification`
      );
    }

    // Incomplete data warning
    if (result.isRevenueProperty && !result.hasCompleteData) {
      warnings.push(
        'Revenue property missing key data - investment metrics may be incomplete'
      );
    }

    // Edge case: Has GIM but no revenue/expenses
    // This shouldn't happen but worth checking
    if (!result.isRevenueProperty && result.detectionReason.includes('GIM')) {
      warnings.push(
        'Property has GIM but no revenue data - classification may be incorrect'
      );
    }

    return {
      isValid: warnings.length === 0 || result.confidence >= 0.7,
      warnings,
    };
  }

  /**
   * Get recommended analysis type based on classification
   */
  static getAnalysisType(result: PropertyTypeResult): {
    analysisType: 'investment' | 'residential' | 'hybrid';
    description: string;
  } {
    if (result.isRevenueProperty && result.hasCompleteData) {
      return {
        analysisType: 'investment',
        description:
          'Full investment analysis with cash flow, NOI, cap rate, and ROI calculations',
      };
    }

    if (result.isRevenueProperty && !result.hasCompleteData) {
      return {
        analysisType: 'hybrid',
        description:
          'Limited investment analysis - some revenue data missing. Combining residential and investment metrics.',
      };
    }

    return {
      analysisType: 'residential',
      description:
        'Residential analysis focused on comparable sales, neighborhood, and lifestyle factors',
    };
  }
}
