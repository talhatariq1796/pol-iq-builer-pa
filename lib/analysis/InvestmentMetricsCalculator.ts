/**
 * Investment Metrics Calculator
 * Calculates revenue property investment metrics (NIM, GIM, PGI, NOI, EGI, Effective NOI, Price to Assessment)
 *
 * Data Source: All required fields are scraped from Centris for revenue properties:
 * - potential_gross_revenue: Annual rental income (PGI)
 * - common_expenses: Monthly operating expenses
 * - gross_income_multiplier: Pre-calculated GIM
 * - price_vs_assessment: Price as percentage of municipal assessment
 *
 * Vacancy Rate: 2.5% (CMHC 2025 Montreal projection)
 * Source: CMHC Fall 2024 Rental Market Report
 */

export interface InvestmentMetrics {
  // Direct from Centris (no calculation)
  pgi: number | null; // Potential Gross Income
  gim: number | null; // Gross Income Multiplier
  price_to_assessment_ratio: number | null; // Price to Assessment Ratio

  // Calculated metrics
  noi: number | null; // Net Operating Income
  nim: number | null; // Net Income Multiplier
  egi: number | null; // Effective Gross Income (with vacancy)
  effective_noi: number | null; // Effective NOI (with vacancy)

  // Metadata
  isRevenueProperty: boolean; // Whether this property has revenue data
  hasCompleteData: boolean; // Whether all required fields are present
}

// Montreal vacancy rate from CMHC 2025 projection
const VACANCY_RATE = 0.025; // 2.5%

export class InvestmentMetricsCalculator {
  /**
   * Calculate all investment metrics for a property
   * Returns null values for non-revenue properties or incomplete data
   */
  static calculate(property: {
    price?: number;
    potential_gross_revenue?: number;
    common_expenses?: number;
    gross_income_multiplier?: number;
    price_vs_assessment?: number;
  }): InvestmentMetrics {
    // Check if this is a revenue property with any investment data
    const isRevenueProperty = Boolean(
      property.potential_gross_revenue ||
      property.common_expenses ||
      property.gross_income_multiplier
    );

    // If not a revenue property, return null values
    if (!isRevenueProperty) {
      return {
        pgi: null,
        gim: null,
        price_to_assessment_ratio: null,
        noi: null,
        nim: null,
        egi: null,
        effective_noi: null,
        isRevenueProperty: false,
        hasCompleteData: false,
      };
    }

    // Extract direct values from Centris data
    const pgi = property.potential_gross_revenue || null;
    const gim = property.gross_income_multiplier || null;
    const price_to_assessment_ratio = property.price_vs_assessment || null;
    const monthlyExpenses = property.common_expenses || 0;
    const price = property.price || 0;

    // Calculate annual operating expenses
    const annualExpenses = monthlyExpenses * 12;

    // Calculate NOI (Net Operating Income)
    // Formula: PGI - (Operating Expenses × 12)
    const noi = pgi && pgi > 0 ? pgi - annualExpenses : null;

    // Calculate NIM (Net Income Multiplier)
    // Formula: Sale Price / NOI
    const nim = noi && noi > 0 && price > 0 ? price / noi : null;

    // Calculate EGI (Effective Gross Income) - accounts for vacancy
    // Formula: PGI × (1 - Vacancy Rate)
    const egi = pgi && pgi > 0 ? pgi * (1 - VACANCY_RATE) : null;

    // Calculate Effective NOI - accounts for vacancy
    // Formula: EGI - (Operating Expenses × 12)
    const effective_noi = egi && egi > 0 ? egi - annualExpenses : null;

    // Check if we have complete data for meaningful analysis
    const hasCompleteData = Boolean(
      pgi &&
      price > 0 &&
      monthlyExpenses >= 0
    );

    return {
      pgi,
      gim,
      price_to_assessment_ratio,
      noi,
      nim,
      egi,
      effective_noi,
      isRevenueProperty: true,
      hasCompleteData,
    };
  }

  /**
   * Format metric for display
   */
  static formatMetric(
    value: number | null,
    type: 'currency' | 'ratio' | 'percentage'
  ): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }

    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-CA', {
          style: 'currency',
          currency: 'CAD',
          maximumFractionDigits: 0,
        }).format(value);

      case 'ratio':
        return value.toFixed(2);

      case 'percentage':
        return `${value.toFixed(1)}%`;

      default:
        return String(value);
    }
  }

  /**
   * Get metric explanation for tooltips
   */
  static getMetricExplanation(metric: keyof InvestmentMetrics): string {
    const explanations: Record<string, string> = {
      pgi: 'Potential Gross Income: Total annual rental income at 100% occupancy',
      gim: 'Gross Income Multiplier: Sale Price ÷ PGI. Lower values indicate better cash flow potential.',
      price_to_assessment_ratio: 'Price to Assessment Ratio: Sale price as percentage of municipal assessment',
      noi: 'Net Operating Income: PGI minus annual operating expenses. Represents property\'s annual profit.',
      nim: 'Net Income Multiplier: Sale Price ÷ NOI. Lower values indicate better investment returns.',
      egi: 'Effective Gross Income: PGI adjusted for 2.5% vacancy (CMHC Montreal 2025 projection)',
      effective_noi: 'Effective NOI: EGI minus annual operating expenses. More conservative profit estimate.',
      isRevenueProperty: 'Whether this property generates rental income',
      hasCompleteData: 'Whether all required investment data is available',
    };

    return explanations[metric] || '';
  }

  /**
   * Validate metric value and provide warnings
   */
  static validateMetric(
    metricName: keyof InvestmentMetrics,
    value: number | null
  ): { isValid: boolean; warning?: string } {
    if (value === null || value === undefined) {
      return { isValid: true }; // Null is acceptable
    }

    // Validation rules
    switch (metricName) {
      case 'nim':
      case 'gim':
        if (value < 0) {
          return { isValid: false, warning: 'Multiplier cannot be negative' };
        }
        if (value > 30) {
          return { isValid: true, warning: 'Unusually high multiplier - may indicate poor cash flow' };
        }
        break;

      case 'noi':
      case 'effective_noi':
        if (value < 0) {
          return { isValid: true, warning: 'Negative NOI - property is losing money' };
        }
        break;

      case 'price_to_assessment_ratio':
        if (value < 50) {
          return { isValid: true, warning: 'Price significantly below assessment' };
        }
        if (value > 150) {
          return { isValid: true, warning: 'Price significantly above assessment' };
        }
        break;
    }

    return { isValid: true };
  }
}
