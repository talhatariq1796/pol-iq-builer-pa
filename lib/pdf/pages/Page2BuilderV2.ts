/**
 * Page 2 Builder V2 - Template-Based Implementation
 * Uses strict template system instead of dynamic positioning
 */

import jsPDF from 'jspdf';
import { TemplateRenderer } from '../core/TemplateRenderer';
import { PAGE_TEMPLATES } from '../templates/PageTemplates';
import type { Page2Data } from '../data/extractors';
import { formatCurrency, formatTrendValue } from '../utils/formatters';
import { renderKPICardGrid, BRAND_COLORS } from '../components/KPICard';
import { formatDelta } from '../utils/priceAnalysis';
import { ChartKeys } from '../../charts/ChartKeys';

export class Page2BuilderV2 {
  private renderer: TemplateRenderer;
  private template = PAGE_TEMPLATES[1];

  constructor(
    private pdf: jsPDF,
    private data: Page2Data,
    private chartImages?: Record<string, string>,
    private propertyCategory?: 'residential' | 'revenue' | 'both'
  ) {
    this.renderer = new TemplateRenderer(pdf);

    // Debug: Log chart image keys and first 30 chars
    if (this.chartImages) {
      console.log('[Page2BuilderV2] Constructor - received chart images:', Object.keys(this.chartImages));
      console.log('[Page2BuilderV2] priceHistoryChart preview:', this.chartImages.priceHistoryChart?.substring(0, 30));
      console.log('[Page2BuilderV2] ageDistributionDemographicChart preview:', this.chartImages.ageDistributionDemographicChart?.substring(0, 30));
    }
  }

  /**
   * Build complete Page 2 using template system
   * @returns Final Y position after rendering
   */
  public build(): number {
    // Render KPI cards first (before template)
    this.renderMarketKPICards();
    
    // Then render template elements
    const templateData = this.mapDataToTemplate();
    this.renderer.renderPage(this.template, templateData);
    
    return this.template.pageHeight || 279.4;
  }

  /**
   * Render Market Statistics KPI Cards
   * Displays 4 key metrics in a 2x2 grid
   * Conditional rendering: revenue vs residential metrics
   */
  private renderMarketKPICards(): void {
    const isRevenue = this.propertyCategory === 'revenue';
    
    // Format price delta with sign
    const formatPriceDelta = (delta: number | undefined): string => {
      if (delta === undefined) return 'No Data';
      const sign = delta > 0 ? '+' : '';
      return `${sign}${delta.toFixed(1)}%`;
    };

    const cards = isRevenue ? [
      // Revenue property metrics
      {
        label: 'Average PGI',
        value: formatCurrency((this.data.stats as any).avgPGI || 0),
        backgroundColor: BRAND_COLORS.burgundy,
      },
      {
        label: 'Median GIM',
        value: ((this.data.stats as any).medianGIM || 0).toFixed(2) + 'x',
        backgroundColor: BRAND_COLORS.dark1,
      },
      {
        label: 'Estimated Cap Rate',
        value: ((this.data.stats as any).avgCapRate || 0).toFixed(1) + '%',
        backgroundColor: BRAND_COLORS.dark2,
        textColor: BRAND_COLORS.white,
      },
      {
        label: 'Price vs Assessment',
        value: ((this.data.stats as any).avgPriceVsAssessment || 0).toFixed(0) + '%',
        backgroundColor: BRAND_COLORS.dark3,
      },
    ] : [
      // Residential property metrics (unchanged)
      {
        label: 'Median Price',
        value: formatCurrency(this.data.stats.medianPrice || 0),
        backgroundColor: BRAND_COLORS.burgundy,
      },
      {
        label: 'Avg Days on Market',
        value: `${Math.round(this.data.stats.avgDaysOnMarket || 0)} days`,
        backgroundColor: BRAND_COLORS.dark1,
      },
      {
        label: 'Average Difference Between Listed/Sold Price',
        value: formatPriceDelta(this.data.stats.avgPriceDelta),
        backgroundColor: BRAND_COLORS.dark2,
        textColor: BRAND_COLORS.white,
      },
      {
        label: 'Price per SqFt',
        value: formatCurrency(this.data.stats.pricePerSqFt || 0),
        trend: this.data.stats.marketAppreciation ? formatTrendValue(this.data.stats.marketAppreciation) : undefined,
        trendColor: (this.data.stats.marketAppreciation || 0) >= 0 ? BRAND_COLORS.darkGray : BRAND_COLORS.burgundy,
        backgroundColor: BRAND_COLORS.dark3,
      },
    ];
    
    // Render 2×2 grid at Y=35mm (after page title)
    renderKPICardGrid(
      this.pdf,     // Use PDF instance from constructor
      15,           // startX (left margin)
      35,           // startY (after page header)
      cards,
      2,            // columns
      85,           // cardWidth (matches column width from 2-column layouts)
      22,           // cardHeight
      10,           // gapX (matches column gutter)
      8             // gapY (vertical spacing)
    );
  }

  /**
   * Map Page2Data structure to template element IDs
   */
  private mapDataToTemplate(): Record<string, string | number | undefined> {
    return {
      // Page header
      pageTitle: 'Market Statistics',

      // PHASE 1.3: Removed Section 1 & Section 2 text elements - redundant with KPI cards
      // These were overlapping KPI cards at Y=35-87mm:
      // - section1Title, section1Metric1, section1Value1, section1Trend1, section1Metric2, section1Value2, section1Trend2
      // - section2Title, section2Description
      // All this data is already displayed in the visual KPI cards

      // Price Delta Analysis (if available)
      priceDeltaTitle: this.data.priceDelta ? '📊 Asking vs Sold Price Analysis' : undefined,
      priceDeltaAverage: this.data.priceDelta ? 'Average Delta' : undefined,
      priceDeltaAverageValue: this.data.priceDelta ? formatDelta(this.data.priceDelta.averageDelta) : undefined,
      priceDeltaMedian: this.data.priceDelta ? 'Median Delta' : undefined,
      priceDeltaMedianValue: this.data.priceDelta ? formatDelta(this.data.priceDelta.medianDelta) : undefined,
      priceDeltaRange: this.data.priceDelta ? 'Range' : undefined,
      priceDeltaRangeValue: this.data.priceDelta ? this.data.priceDelta.range : undefined,
      priceDeltaSignal: this.data.priceDelta ? 'Market Signal' : undefined,
      priceDeltaSignalValue: this.data.priceDelta ? this.data.priceDelta.marketSignal : undefined,
      priceDeltaInterpretation: this.data.priceDelta ? this.data.priceDelta.interpretation : undefined,

      // PHASE 5: Removed KPI Statistics Summary elements
      // These were causing overlaps at y=180-226 (on top of charts ending at 190)
      // KPI data is already displayed in visual KPI cards at y=35-87
      // (kpiStatsTitle, kpiPriceLabel, kpiPriceStats, kpiDaysLabel, kpiDaysStats, kpiSqftLabel, kpiSqftStats)

      // AI Analysis Insights (Full Width)
      // Combined text block: Full width (72mm height, ~2880 chars, 16 lines)
      // Combine supply/demand and price positioning insights
      aiSupplyDemandText: [
        this.data.aiInsights?.supplyDemand || '',
        this.data.aiInsights?.pricePositioning || ''
      ].filter(Boolean).join(' ').slice(0, 2880),

      // Chart title (only one chart now)
      priceHistoryChartTitle: '12-Month Price History',

      // Chart image from client-side Chart.js generation - use ChartKeys constants
      [ChartKeys.PRICE_HISTORY]: this.chartImages?.[ChartKeys.PRICE_HISTORY],
    };
  }
}
