/**
 * Page 5 Builder V2 - Template-Based Implementation
 * Uses strict template system instead of dynamic positioning
 */

import jsPDF from 'jspdf';
import { TemplateRenderer } from '../core/TemplateRenderer';
import { PAGE_TEMPLATES } from '../templates/PageTemplates';
import { formatPercent, formatNumber, formatTrend } from '../utils/formatters';
import { getIndexDisplayValue, getQuartileColor } from '../utils/quartileLabels';
import { ChartKeys } from '../../charts/ChartKeys';

export interface Page5Data {
  economicTrends: {
    medianIncome: { year: string; value: number }[];
    homeValues: { year: string; value: number }[];
  };
  employment: {
    sector: string;
    jobsAdded: number;
  }[];
  economicIndicators: {
    category: string;
    percentage: number;
    color?: string;
  }[];
  growthMetrics: {
    gdpGrowth: number;
    unemploymentRate: number;
    inflationRate: number;
  };
  futureProjections: {
    year: string;
    projection: string;
  }[];
  marketIndexes?: {
    hotGrowthIndex: number;
    affordabilityIndex: number;
    newHomeownersIndex?: number;
    marketScore?: number;
  };
  aiInsights?: {
    economicOutlook: string;
    jobMarketAnalysis: string;
    investmentPotential: string;
  };
}

export class Page5BuilderV2 {
  private renderer: TemplateRenderer;
  private template = PAGE_TEMPLATES[4];

  constructor(
    pdf: jsPDF,
    private data: Page5Data,
    private chartImages?: Record<string, string>
  ) {
    this.renderer = new TemplateRenderer(pdf);
  }

  /**
   * Build complete Page 5 using template system
   * @returns Final Y position after rendering
   */
  public build(): number {
    const templateData = this.mapDataToTemplate();
    this.renderer.renderPage(this.template, templateData);
    return this.template.pageHeight || 279.4;
  }

  /**
   * Map Page5Data structure to template element IDs
   */
  private mapDataToTemplate(): Record<string, any> {
    return {
      // Page header
      pageTitle: 'Market Indexes', // Removed emoji: was '📈 Market Indexes'

      // ============================================================================
      // PHASE 4.2: New 2×2 Index Grid Layout (replaces employment/business sections)
      // ============================================================================

      // No section title - removed per user request

      // ROW 1, COL 1: Hot Growth Index
      hotGrowthLabel: 'Hot Growth Index',
      hotGrowthValue: this.data.marketIndexes?.hotGrowthIndex !== undefined
        ? this.styleIndexValue(this.data.marketIndexes.hotGrowthIndex, 'hotGrowthIndex')
        : 'N/A',
      hotGrowthDescription: 'Household growth, income growth, ownership growth, population density',

      // ROW 1, COL 2: Affordability Index
      affordabilityLabel: 'Affordability Index',
      affordabilityValue: this.data.marketIndexes?.affordabilityIndex !== undefined
        ? this.styleIndexValue(this.data.marketIndexes.affordabilityIndex, 'affordabilityIndex')
        : 'N/A',
      affordabilityDescription: 'Debt service ratios, rental market, income growth, housing supply',

      // ROW 2, COL 1: New Homeowners Index
      newHomeownersLabel: 'New Homeowners Index',
      newHomeownersValue: this.data.marketIndexes?.newHomeownersIndex !== undefined
        ? this.styleIndexValue(this.data.marketIndexes.newHomeownersIndex, 'newHomeownersIndex')
        : 'N/A',
      newHomeownersDescription: 'Affordability, young demographics, rental-to-own transition, growth stability',

      // ROW 2, COL 2: Market Score
      marketScoreLabel: 'Overall Market Score',
      marketScoreValue: this.data.marketIndexes?.marketScore !== undefined
        ? this.styleIndexValue(this.data.marketIndexes.marketScore, 'marketScore')
        : 'N/A',
      marketScoreDescription: 'Composite: Growth potential, affordability, market health',

      // ============================================================================
      // AI Analysis Insights - Expanded 2-column layout
      // ============================================================================

      aiEconomicOutlookText: this.data.aiInsights?.economicOutlook || '', // No truncation - let template handle layout
      aiMarketAnalysisText: this.data.aiInsights?.jobMarketAnalysis || this.data.aiInsights?.investmentPotential || '', // No truncation - let template handle layout

      // Chart images from client-side Chart.js generation - use ChartKeys constants
      [ChartKeys.INDUSTRY_DISTRIBUTION]: this.chartImages?.[ChartKeys.INDUSTRY_DISTRIBUTION],
    };
  }

  /**
   * Style an index value with quartile-based background color
   * @param score - Index score (0-100)
   * @param indexKey - Index type key
   * @returns Styled text object with background color
   */
  private styleIndexValue(
    score: number,
    indexKey: 'hotGrowthIndex' | 'affordabilityIndex' | 'newHomeownersIndex' | 'marketScore'
  ): { text: string; style: { backgroundColor: string; backgroundPadding: number } } {
    return {
      text: getIndexDisplayValue(score, indexKey),
      style: {
        backgroundColor: getQuartileColor(score),
        backgroundPadding: 1.5, // Slightly more padding for better visual appearance
      },
    };
  }

  /**
   * Calculate trend indicator from historical data
   * Uses last two data points to show YoY change
   */
  private calculateTrend(
    currentValue?: number,
    historicalData?: Array<{ year: string; value: number }>
  ): string {
    if (!currentValue || !historicalData || historicalData.length < 2) {
      return ''; // No trend if insufficient data
    }

    // Get last year's value from historical data
    const lastYearValue = historicalData[historicalData.length - 2]?.value;
    const thisYearValue = historicalData[historicalData.length - 1]?.value;

    if (!lastYearValue || !thisYearValue) {
      return '';
    }

    return formatTrend(thisYearValue, lastYearValue);
  }
}
