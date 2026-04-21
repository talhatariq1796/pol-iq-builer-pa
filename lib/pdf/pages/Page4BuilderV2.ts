/**
 * Page 4 Builder V2 - Template-Based Implementation
 * Uses strict template system instead of dynamic positioning
 */

import jsPDF from 'jspdf';
import { TemplateRenderer } from '../core/TemplateRenderer';
import { PAGE_TEMPLATES } from '../templates/PageTemplates';
import type { Page4Data } from '../data/extractors';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { renderKPICardGrid, BRAND_COLORS } from '../components/KPICard';
import { ChartKeys } from '../../charts/ChartKeys';

export class Page4BuilderV2 {
  private renderer: TemplateRenderer;
  private template = PAGE_TEMPLATES[3];

  constructor(
    private pdf: jsPDF,
    private data: Page4Data,
    private chartImages?: Record<string, string>
  ) {
    this.renderer = new TemplateRenderer(pdf);
  }

  /**
   * Render demographic KPI cards at top of page
   * 6 cards in 2 rows of 3 - all using REAL data from Esri demographics
   */
  private renderDemographicKPICards(): void {
    const demo = this.data.demographics;
    
    // Extract key demographic metrics - all from real Esri fields (no hardcoding or fallbacks)
    const totalPopulation = demo?.population?.total ?? 0;
    const totalHouseholds = demo?.population?.households ?? 0;
    const rentalRate = demo?.housing?.rentalRate ?? 0;
    const avgIncome = demo?.population?.avgIncome ?? 0;
    const medianIncome = demo?.population?.medianIncome ?? 0;
    const ownershipRate = demo?.housing?.ownershipRate ?? 0;
    
    const cards = [
      {
        label: 'Total Population',
        value: demo?.population?.total !== undefined ? formatNumber(totalPopulation) : 'No Data',
        backgroundColor: BRAND_COLORS.burgundy,
        textColor: '#FFFFFF'
      },
      {
        label: 'Total Households',
        value: demo?.population?.households !== undefined ? formatNumber(totalHouseholds) : 'No Data',
        backgroundColor: BRAND_COLORS.dark1,
        textColor: '#FFFFFF'
      },
      {
        label: 'Rental Rate',
        value: demo?.housing?.rentalRate !== undefined ? `${rentalRate.toFixed(1)}%` : 'No Data',
        backgroundColor: BRAND_COLORS.dark2,
        textColor: '#FFFFFF'
      },
      {
        label: 'Median Income',
        value: demo?.population?.medianIncome !== undefined ? formatCurrency(medianIncome) : 'No Data',
        backgroundColor: BRAND_COLORS.burgundy,
        textColor: '#FFFFFF'
      },
      {
        label: 'Average Income',
        value: demo?.population?.avgIncome !== undefined ? formatCurrency(avgIncome) : 'No Data',
        backgroundColor: BRAND_COLORS.dark1,
        textColor: '#FFFFFF'
      },
      {
        label: 'Homeownership Rate',
        value: demo?.housing?.ownershipRate !== undefined ? `${ownershipRate.toFixed(1)}%` : 'No Data',
        backgroundColor: BRAND_COLORS.dark3,
        textColor: BRAND_COLORS.white
      }
    ];
    
    // Render 2 rows × 3 columns grid at Y=35mm (after page header)
    // Card dimensions: 56mm width × 22mm height
    // Gaps: 10mm horizontal, 8mm vertical
    // Total width: (56 × 3) + (10 × 2) = 188mm (fits in 180mm content area with margins)
    renderKPICardGrid(this.pdf, 15, 35, cards, 3, 56, 22, 10, 8);
  }

  /**
   * Build complete Page 4 using template system
   * @returns Final Y position after rendering
   */
  public build(): number {
    // Render KPI cards first (before template)
    this.renderDemographicKPICards();
    
    // Then render template elements
    const templateData = this.mapDataToTemplate();
    this.renderer.renderPage(this.template, templateData);
    return this.template.pageHeight || 279.4;
  }

  /**
   * Map Page4Data structure to template element IDs
   */
  private mapDataToTemplate(): Record<string, string | number | undefined> {
    return {
      // Page header
      pageTitle: 'Demographics',

      // AI text removed per requirements - Page 4 should show only KPI cards and charts

      // Chart titles for 4 real data charts (2×2 grid)
      housingTenureChartTitle: 'Housing Tenure',
      incomeComparisonChartTitle: 'Household Income Comparison',
      ageDistributionChartTitle: 'Homeownership Trends',
      populationStatsChartTitle: 'Population & Households',

      // Chart images from client-side Chart.js generation - use ChartKeys constants
      [ChartKeys.HOUSING_TENURE]: this.chartImages?.[ChartKeys.HOUSING_TENURE],
      [ChartKeys.INCOME_COMPARISON]: this.chartImages?.[ChartKeys.INCOME_COMPARISON],
      [ChartKeys.AGE_DISTRIBUTION_DEMOGRAPHIC]: this.chartImages?.[ChartKeys.AGE_DISTRIBUTION_DEMOGRAPHIC],
      [ChartKeys.POPULATION_STATS]: this.chartImages?.[ChartKeys.POPULATION_STATS],
    };
  }
}

export interface DemographicsData {
  ageDistribution?: {
    '0-17': number;
    '18-34': number;
    '35-54': number;
    '55-64': number;
    '65+': number;
  };
  householdIncome?: {
    '<25k': number;
    '25-50k': number;
    '50-75k': number;
    '75-100k': number;
    '100k+': number;
  };
  population?: {
    total: number;
    households: number;
    avgHouseholdSize: number;
    medianAge: number;
  };
  employment?: {
    employed: number;
    unemployed: number;
    notInLaborForce: number;
  };
  education?: {
    highSchool: number;
    bachelors: number;
    masters: number;
    other: number;
  };
}
