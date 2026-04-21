/**
 * Page 6 Builder V2 - Template-Based Implementation
 * Uses strict template system instead of dynamic positioning
 */

import jsPDF from 'jspdf';
import { TemplateRenderer } from '../core/TemplateRenderer';
import { PAGE_TEMPLATES } from '../templates/PageTemplates';
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters';
import { renderKPICardGrid, BRAND_COLORS } from '../components/KPICard';
import { ChartKeys } from '../../charts/ChartKeys';
import { MarketMomentumData } from '../data/extractors';

/**
 * Page 6 Data Structure
 * Comparable properties with pricing analysis
 */
export interface Page6Data {
  comparableProperties: Array<{
    address: string;
    price: number;
    pricePerSqft: number;
    sqft: number;
    beds: number;
    baths: number;
    daysOnMarket: number;
    similarityScore: number;  // 0-100
    adjustments: {
      location: number;
      condition: number;
      size: number;
      features: number;
      total: number;
    };
  }>;
  subjectProperty: {
    address: string;
    sqft: number;
    beds: number;
    baths: number;
    estimatedValue: number;
    pricePerSqft: number;
  };
  marketAnalysis: {
    averagePricePerSqft: number;
    priceRange: { low: number; high: number; recommended: number };
    confidenceLevel: number;  // 0-100
    marketPosition: 'Above Market' | 'At Market' | 'Below Market';
  };
  adjustmentSummary: {
    averageAdjustment: number;
    adjustmentRange: { min: number; max: number };
    mostCommonAdjustments: string[];
  };
  // ✅ NEW: Market Activity & Velocity metrics
  marketActivity: {
    priceToMedianRatio: number;
    saleToListRatio: number;
    priceAchievementRate: number;
    marketMomentum: MarketMomentumData;
  };
  velocityDistribution: {
    '0-10': number;
    '11-20': number;
    '21-30': number;
    '31-45': number;
    '45+': number;
  };
  velocityByPrice: Array<{
    range: string;
    avgDaysOnMarket: number;
    propertyCount: number;
  }>;
}

export class Page6BuilderV2 {
  private renderer: TemplateRenderer;
  private template = PAGE_TEMPLATES[5];

  constructor(
    private pdf: jsPDF,
    private data: Page6Data,
    private chartImages?: Record<string, string>
  ) {
    this.renderer = new TemplateRenderer(pdf);
  }

  /**
   * Render Market Activity KPI cards at top of page
   * 2 cards side-by-side showing price and activity metrics
   */
  private renderPriceTrendsKPICards(): void {
    const priceToMedianRatio = this.data.marketActivity.priceToMedianRatio || 1.0;
    const saleToListRatio = this.data.marketActivity.saleToListRatio || 100;
    
    const cards = [
      {
        label: 'Price to Median Ratio',
        value: `${priceToMedianRatio.toFixed(2)}x`,
        backgroundColor: BRAND_COLORS.burgundy,
        textColor: '#FFFFFF'
      },
      {
        label: 'Sale-to-List Ratio',
        value: `${saleToListRatio}%`,
        backgroundColor: BRAND_COLORS.dark1,
        textColor: '#FFFFFF'
      }
    ];
    
    // Render 2 cards side-by-side at Y=35mm
    // Card dimensions: 85mm x 22mm, 10mm gap
    renderKPICardGrid(this.pdf, 15, 35, cards, 2, 85, 22, 10, 8);
  }

  /**
   * Render Market Velocity KPI cards in middle of page
   * 2 cards side-by-side showing price achievement and momentum metrics
   */
  private renderMarketVelocityKPICards(): void {
    const priceAchievementRate = this.data.marketActivity.priceAchievementRate || 100;
    const marketMomentum = this.data.marketActivity.marketMomentum;
    
    const cards = [
      {
        label: 'Price Achievement Rate',
        value: `${priceAchievementRate}%`,
        backgroundColor: BRAND_COLORS.dark2,
        textColor: '#FFFFFF'
      },
      {
        label: 'Market Momentum',
        value: marketMomentum.classification,
        backgroundColor: BRAND_COLORS.dark3,
        textColor: BRAND_COLORS.white
      }
    ];
    
    // Render 2 cards side-by-side at Y=68mm (below first KPI row, above charts at Y=100)
    // Card dimensions: 85mm x 22mm, 10mm gap
    renderKPICardGrid(this.pdf, 15, 68, cards, 2, 85, 22, 10, 8);
  }

  /**
   * Build complete Page 6 using template system
   * @returns Final Y position after rendering
   */
  public build(): number {
    // Render KPI cards first (before template)
    this.renderPriceTrendsKPICards();
    this.renderMarketVelocityKPICards();
    
    // Then render template elements
    const templateData = this.mapDataToTemplate();
    this.renderer.renderPage(this.template, templateData);
    return this.template.pageHeight || 279.4;
  }

  /**
   * Map Page6Data structure to template element IDs
   */
  private mapDataToTemplate(): Record<string, string | number | undefined> {
    const templateData = {
      // Page header
      pageTitle: 'Market Activity & Velocity',

      // PHASE 5.2: Removed KPI text element mappings - using visual KPI cards instead
      // Visual cards rendered at y=35 (price trends) and y=68 (market velocity)
      // Removing these prevents duplicate/overlapping KPI rendering
      // (avgPriceLabel, avgPriceValue, avgPriceChange, medianPriceLabel, medianPriceValue,
      //  medianPriceChange, daysOnMarketLabel, daysOnMarketValue, daysOnMarketTrend,
      //  saleToPriceRatioLabel, saleToPriceRatioValue)

      // Market Insights
      insightsTitle: 'Market Insights',
      insightsText: `The market shows ${this.data.marketActivity.marketMomentum.classification.toLowerCase()} momentum with ${this.data.marketActivity.priceAchievementRate}% price achievement rate. Properties are selling ${Math.abs(this.data.marketActivity.marketMomentum.components.daysOnMarket.change).toFixed(1)}% ${this.data.marketActivity.marketMomentum.components.daysOnMarket.trend === 'faster' ? 'faster' : this.data.marketActivity.marketMomentum.components.daysOnMarket.trend === 'slower' ? 'slower' : 'at the same pace'}, prices are ${this.data.marketActivity.marketMomentum.components.priceVelocity.trend}, and inventory turnover is ${this.data.marketActivity.marketMomentum.components.inventoryTurnover.trend} (${this.data.marketActivity.marketMomentum.components.inventoryTurnover.ratio.toFixed(2)}x ratio). Properties are selling at ${this.data.marketActivity.saleToListRatio}% of list price on average and are currently priced at ${this.data.marketActivity.priceToMedianRatio.toFixed(2)}x the median market value. Based on ${this.data.comparableProperties.length} comparable properties, the subject property at ${this.data.subjectProperty.address} is valued at ${formatCurrency(this.data.subjectProperty.estimatedValue)} with ${this.data.marketAnalysis.marketPosition.toLowerCase()} positioning.`,

      // Chart titles - updated for velocity focus
      velocityDistributionChartTitle: 'Days to Sold',
      velocityByPriceChartTitle: 'Velocity by Price Point',
      
      // Chart images (base64 encoded) - use ChartKeys constants
      [ChartKeys.VELOCITY_DISTRIBUTION]: this.chartImages?.[ChartKeys.VELOCITY_DISTRIBUTION],
      [ChartKeys.VELOCITY_BY_PRICE]: this.chartImages?.[ChartKeys.VELOCITY_BY_PRICE],
    };
    
    return templateData;
  }
}

/**
 * Main builder function for easy integration
 * @param pdf - jsPDF instance
 * @param data - Page 6 data
 * @returns Final Y position after rendering
 */
export function buildPage6V2(pdf: jsPDF, data: Page6Data): number {
  try {
    const builder = new Page6BuilderV2(pdf, data);
    return builder.build();
  } catch (error) {
    console.error('[buildPage6V2] Failed to build page:', error);
    throw new Error(`Page 6 generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
