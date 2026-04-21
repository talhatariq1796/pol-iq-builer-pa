/**
 * Property Enricher
 *
 * Enriches properties with investment metrics and classification flags.
 * Used when properties come from sources other than PropertyDataService
 * (e.g., map clicks, API calls, user input).
 */

import { PropertyTypeClassifier } from './PropertyTypeClassifier';
import { InvestmentMetricsCalculator } from './InvestmentMetricsCalculator';
import type { CMAProperty } from '@/components/cma/types';

export class PropertyEnricher {
  /**
   * Enrich a single property with classification and investment metrics
   * Safe to call on properties that may already be enriched (idempotent)
   */
  static enrichProperty(property: any): CMAProperty {
    // If already enriched (has isRevenueProperty flag), return as-is
    if ('isRevenueProperty' in property && typeof property.isRevenueProperty === 'boolean') {
      return property as CMAProperty;
    }

    // Classify property type (revenue vs residential)
    const classification = PropertyTypeClassifier.classify({
      potential_gross_revenue: property.potential_gross_revenue || property.potentialGrossIncome,
      common_expenses: property.common_expenses,
      gross_income_multiplier: property.gross_income_multiplier || property.grossIncomeMultiplier,
      price_vs_assessment: property.price_vs_assessment || property.priceVsAssessment,
      property_type: property.property_type || property.pt,
      pt: property.pt,
    });

    // Calculate investment metrics for revenue properties
    const investmentMetrics = InvestmentMetricsCalculator.calculate({
      price: property.price || property.askedsold_price || 0,
      potential_gross_revenue: property.potential_gross_revenue || property.potentialGrossIncome,
      common_expenses: property.common_expenses,
      gross_income_multiplier: property.gross_income_multiplier || property.grossIncomeMultiplier,
      price_vs_assessment: property.price_vs_assessment || property.priceVsAssessment,
    });

    return {
      ...property,
      // Add investment metrics first
      ...investmentMetrics,
      // Then override with classification flags
      isRevenueProperty: classification.isRevenueProperty,
      propertyCategory: classification.propertyCategory,
    } as CMAProperty;
  }

  /**
   * Enrich an array of properties
   */
  static enrichProperties(properties: any[]): CMAProperty[] {
    return properties.map(prop => this.enrichProperty(prop));
  }

  /**
   * Enrich a map graphic's attributes (for properties clicked on the map)
   * Safely handles __esri.Graphic objects
   */
  static enrichGraphicProperty(graphic: __esri.Graphic): CMAProperty {
    if (!graphic || !graphic.attributes) {
      throw new Error('Invalid graphic: missing attributes');
    }

    const enriched = this.enrichProperty(graphic.attributes);

    // Preserve graphic's geometry in the geometry field
    // (CMAProperty.geometry already contains coordinate data)
    if (graphic.geometry && !enriched.geometry) {
      enriched.geometry = graphic.geometry;
    }

    return enriched;
  }

  /**
   * Check if a property has investment metrics
   * Useful for conditional rendering in UI
   */
  static hasInvestmentMetrics(property: CMAProperty): boolean {
    return !!(
      property.pgi ||
      property.gim ||
      property.noi ||
      property.potential_gross_revenue ||
      property.gross_income_multiplier
    );
  }

  /**
   * Get investment summary for a property
   * Returns null if not a revenue property
   */
  static getInvestmentSummary(property: CMAProperty): {
    isRevenueProperty: boolean;
    hasCompleteMetrics: boolean;
    metricsAvailable: string[];
    metricsMissing: string[];
  } | null {
    if (!property.isRevenueProperty) {
      return null;
    }

    const allMetrics = [
      'pgi',
      'egi',
      'noi',
      'gim',
      'nim',
      'price_to_assessment_ratio',
    ];

    const available: string[] = [];
    const missing: string[] = [];

    for (const metric of allMetrics) {
      const value = (property as any)[metric];
      if (value !== undefined && value !== null) {
        available.push(metric);
      } else {
        missing.push(metric);
      }
    }

    return {
      isRevenueProperty: true,
      hasCompleteMetrics: missing.length === 0,
      metricsAvailable: available,
      metricsMissing: missing,
    };
  }

  /**
   * Validate that a property has minimum required fields for CMA
   */
  static validateProperty(property: any): {
    isValid: boolean;
    missingFields: string[];
    warnings: string[];
  } {
    const requiredFields = ['id', 'address', 'price'];
    const recommendedFields = ['bedrooms', 'bathrooms', 'squareFootage', 'yearBuilt'];

    const missingRequired: string[] = [];
    const missingRecommended: string[] = [];

    for (const field of requiredFields) {
      if (!property[field]) {
        missingRequired.push(field);
      }
    }

    for (const field of recommendedFields) {
      if (!property[field] && field !== 'squareFootage') {
        missingRecommended.push(field);
      } else if (field === 'squareFootage' && !property.squareFootage && !property.square_footage) {
        missingRecommended.push(field);
      }
    }

    const warnings: string[] = [];
    if (missingRecommended.length > 0) {
      warnings.push(`Missing recommended fields: ${missingRecommended.join(', ')}`);
    }

    return {
      isValid: missingRequired.length === 0,
      missingFields: missingRequired,
      warnings,
    };
  }
}

/**
 * React Hook for enriching properties in components
 * Usage:
 *
 * const enrichedProperty = usePropertyEnrichment(selectedProperty);
 *
 * if (enrichedProperty.isRevenueProperty) {
 *   // Show investment metrics
 * }
 */
export function usePropertyEnrichment(property: any): CMAProperty | null {
  if (!property) return null;

  try {
    return PropertyEnricher.enrichProperty(property);
  } catch (error) {
    console.error('[PropertyEnricher] Failed to enrich property:', error);
    return property as CMAProperty;
  }
}
