/**
 * PropertyAnalysisRouter
 *
 * Routes properties to appropriate analysis paths based on property classification.
 * Determines which dialogs, PDF templates, AI prompts, and filters to use.
 *
 * Routes:
 * - Residential: Single-family, condos → lifestyle-focused analysis
 * - Revenue: Investment properties → cash flow & ROI analysis
 * - Hybrid: Properties with incomplete data → mixed analysis
 */

import { PropertyTypeClassifier, type PropertyCategory } from './PropertyTypeClassifier';

export type AnalysisMode = 'residential' | 'investment' | 'hybrid';

export interface AnalysisRoute {
  mode: AnalysisMode;
  dialogComponent: 'PropertyDialog' | 'RevenuePropertyDialog';
  pdfTemplate: 'ResidentialReport' | 'RevenuePropertyReport';
  aiPromptSet: 'residential' | 'investment';
  filterSet: 'residential' | 'investment' | 'combined';
  description: string;
}

export interface AnalysisContext {
  propertyType: PropertyCategory;
  property: {
    id?: string;
    address?: string;
    price?: number;
    potential_gross_revenue?: number | null;
    common_expenses?: number | null;
    isRevenueProperty?: boolean;
    propertyCategory?: PropertyCategory;
  };
  route: AnalysisRoute;
  classification: ReturnType<typeof PropertyTypeClassifier.classify>;
}

export class PropertyAnalysisRouter {
  /**
   * Determine the appropriate analysis route for a property
   *
   * @param property - Property to analyze
   * @returns Complete analysis context with routing information
   */
  static route(property: {
    id?: string;
    address?: string;
    price?: number;
    potential_gross_revenue?: number | null;
    common_expenses?: number | null;
    gross_income_multiplier?: number | null;
    price_vs_assessment?: number | null;
    isRevenueProperty?: boolean;
    propertyCategory?: PropertyCategory;
  }): AnalysisContext {
    // Classify property if not already classified
    const classification =
      property.isRevenueProperty !== undefined && property.propertyCategory
        ? {
            isRevenueProperty: property.isRevenueProperty,
            propertyCategory: property.propertyCategory,
            confidence: 1.0,
            detectionReason: 'Pre-classified during data loading',
            hasCompleteData: Boolean(
              property.potential_gross_revenue && property.common_expenses
            ),
          }
        : PropertyTypeClassifier.classify(property);

    // Determine route based on classification
    const route = this.determineRoute(classification);

    return {
      propertyType: classification.propertyCategory,
      property,
      route,
      classification,
    };
  }

  /**
   * Determine appropriate route based on classification result
   */
  private static determineRoute(
    classification: ReturnType<typeof PropertyTypeClassifier.classify>
  ): AnalysisRoute {
    const analysisType = PropertyTypeClassifier.getAnalysisType(classification);

    switch (analysisType.analysisType) {
      case 'investment':
        return {
          mode: 'investment',
          dialogComponent: 'RevenuePropertyDialog',
          pdfTemplate: 'RevenuePropertyReport',
          aiPromptSet: 'investment',
          filterSet: 'investment',
          description:
            'Full investment analysis with cash flow, NOI, cap rate, and ROI calculations',
        };

      case 'hybrid':
        return {
          mode: 'hybrid',
          dialogComponent: 'RevenuePropertyDialog', // Use revenue dialog but with warnings
          pdfTemplate: 'RevenuePropertyReport',
          aiPromptSet: 'investment',
          filterSet: 'combined',
          description:
            'Limited investment analysis - combining residential and investment metrics due to incomplete data',
        };

      case 'residential':
      default:
        return {
          mode: 'residential',
          dialogComponent: 'PropertyDialog',
          pdfTemplate: 'ResidentialReport',
          aiPromptSet: 'residential',
          filterSet: 'residential',
          description:
            'Residential analysis focused on comparable sales, neighborhood, and lifestyle factors',
        };
    }
  }

  /**
   * Batch route multiple properties
   * Useful for determining what UI components to load
   */
  static routeBatch(
    properties: Array<{
      potential_gross_revenue?: number | null;
      common_expenses?: number | null;
      gross_income_multiplier?: number | null;
      price_vs_assessment?: number | null;
      isRevenueProperty?: boolean;
      propertyCategory?: PropertyCategory;
    }>
  ): {
    contexts: AnalysisContext[];
    summary: {
      total: number;
      residential: number;
      investment: number;
      hybrid: number;
      needsRevenueDialog: number;
      needsResidentialDialog: number;
    };
  } {
    const contexts = properties.map((prop) => this.route(prop));

    const residential = contexts.filter((c) => c.route.mode === 'residential').length;
    const investment = contexts.filter((c) => c.route.mode === 'investment').length;
    const hybrid = contexts.filter((c) => c.route.mode === 'hybrid').length;

    const needsRevenueDialog = contexts.filter(
      (c) => c.route.dialogComponent === 'RevenuePropertyDialog'
    ).length;

    const needsResidentialDialog = contexts.filter(
      (c) => c.route.dialogComponent === 'PropertyDialog'
    ).length;

    return {
      contexts,
      summary: {
        total: properties.length,
        residential,
        investment,
        hybrid,
        needsRevenueDialog,
        needsResidentialDialog,
      },
    };
  }

  /**
   * Check if property should use investment-focused features
   */
  static shouldShowInvestmentFeatures(context: AnalysisContext): boolean {
    return context.route.mode === 'investment' || context.route.mode === 'hybrid';
  }

  /**
   * Check if property should use residential-focused features
   */
  static shouldShowResidentialFeatures(context: AnalysisContext): boolean {
    return context.route.mode === 'residential' || context.route.mode === 'hybrid';
  }

  /**
   * Get appropriate AI prompt template name
   */
  static getPromptTemplate(context: AnalysisContext, promptType: string): string {
    const prefix = context.route.aiPromptSet === 'investment' ? 'investment' : 'residential';
    return `${prefix}_${promptType}`;
  }

  /**
   * Get filter configuration for property type
   */
  static getFilterConfig(context: AnalysisContext): {
    showInvestmentFilters: boolean;
    showResidentialFilters: boolean;
    defaultFilterSet: string[];
  } {
    switch (context.route.filterSet) {
      case 'investment':
        return {
          showInvestmentFilters: true,
          showResidentialFilters: false,
          defaultFilterSet: ['price', 'gim', 'nim', 'noi', 'priceToAssessment'],
        };

      case 'residential':
        return {
          showInvestmentFilters: false,
          showResidentialFilters: true,
          defaultFilterSet: ['price', 'bedrooms', 'bathrooms', 'squareFootage', 'yearBuilt'],
        };

      case 'combined':
        return {
          showInvestmentFilters: true,
          showResidentialFilters: true,
          defaultFilterSet: [
            'price',
            'bedrooms',
            'bathrooms',
            'squareFootage',
            'gim',
            'noi',
          ],
        };

      default:
        return {
          showInvestmentFilters: false,
          showResidentialFilters: true,
          defaultFilterSet: ['price', 'bedrooms', 'bathrooms'],
        };
    }
  }

  /**
   * Get map popup configuration based on property type
   */
  static getMapPopupConfig(context: AnalysisContext): {
    showGIM: boolean;
    showCapRate: boolean;
    showNOI: boolean;
    showPricePerSqFt: boolean;
    showDaysOnMarket: boolean;
    primaryMetric: string;
  } {
    const isInvestment =
      context.route.mode === 'investment' || context.route.mode === 'hybrid';

    return {
      showGIM: isInvestment,
      showCapRate: isInvestment,
      showNOI: isInvestment,
      showPricePerSqFt: !isInvestment,
      showDaysOnMarket: !isInvestment,
      primaryMetric: isInvestment ? 'GIM' : 'Price per Sq.Ft.',
    };
  }

  /**
   * Get statistics to display for property collection
   */
  static getStatsConfig(context: AnalysisContext): {
    showInvestmentStats: boolean;
    showResidentialStats: boolean;
    primaryStats: string[];
  } {
    const isInvestment =
      context.route.mode === 'investment' || context.route.mode === 'hybrid';

    return {
      showInvestmentStats: isInvestment,
      showResidentialStats: !isInvestment,
      primaryStats: isInvestment
        ? ['Average GIM', 'Average NOI', 'Average Cap Rate', 'Total Properties']
        : ['Average Price', 'Median Price', 'Avg Days on Market', 'Total Properties'],
    };
  }
}
