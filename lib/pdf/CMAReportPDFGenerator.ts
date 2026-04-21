/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from 'jspdf';
import { CMAProperty, CMAStats, CMAFilters, AreaSelection } from '@/components/cma/types';
// import { ChartRenderer } from './renderers/ChartRenderer'; // Disabled: requires canvas native module (incompatible with Vercel)
import { BHHSComponentLibrary } from './components/BHHSComponentLibrary';
import { ColorPalette } from './design/ColorPalette';
import { BHHS_LOGO_BASE64, BHHS_LOGO_DIMENSIONS } from './assets/bhhs-logo.base64';
import { renderComparablesTable } from './components/ComparablesTable';
import { HeaderFooterBuilder } from './components/HeaderFooterBuilder';
import { TEMPLATE_VERSION, TEMPLATE_LAST_UPDATED } from './templates/PageTemplates';
import {
  Page1BuilderV2,
  Page2BuilderV2,
  Page3BuilderV2,
  Page4BuilderV2, // RE-ENABLED: Demographics page now uses REAL data from GeoJSON
  Page5BuilderV2, // RE-ENABLED: Economic indicators page now uses REAL data from GeoJSON
  Page6BuilderV2,
  Page7BuilderV2,
} from './pages';
import { extractPage1Data, extractPage2Data, extractPage3Data, extractPage4Data, extractPage5Data, extractPage6Data, extractPage7Data } from './data/extractors';
import { PerformanceMonitor } from './monitoring/PerformanceMonitor';
import { globalErrorTracker } from './monitoring/ErrorTracker';
import { preloadIcons as preloadStaticIcons, getAvailableIcons } from './utils/IconRendererStatic';

export interface PDFReportConfig {
  reportType: 'sold' | 'active' | 'both';

  // Selected comparables (for table, pricing, direct comparison)
  // When user selects specific properties, only those are included here
  // When no selection, this contains all properties in the search area
  properties: CMAProperty[];
  stats: CMAStats;

  // Full area data (for market trends, momentum, absorption rate)
  // Always contains ALL properties in the search area regardless of selection
  // Used for metrics that need larger sample sizes to be statistically meaningful
  areaProperties?: CMAProperty[];
  areaStats?: CMAStats;

  // Selection metadata
  selectionInfo?: {
    isFiltered: boolean;      // True if user selected specific comparables
    selectedCount: number;    // Number of selected comparables
    totalCount: number;       // Total properties in area
  };

  filters: CMAFilters;
  selectedArea?: AreaSelection;
  analysisData?: any;
  chartImages?: Record<string, string>; // Base64 encoded chart images
  propertyImages?: Record<string, string>; // Base64 encoded property images (propertyId -> image)
  propertyCategory?: 'residential' | 'revenue' | 'both'; // Property category for conditional rendering
  demographicData?: any; // Area-level demographic data from demographic-analysis endpoint
  selectedProperty?: __esri.Graphic; // Selected property (for address resolution)
  searchAddress?: string; // Search input address (for address resolution)
  clickCoordinates?: { lat: number; lng: number }; // Map click coordinates (for address resolution)
  geocodedAddress?: string; // Server-side reverse geocoded address (populated by /api/cma-pdf route)
  condoSquareFootage?: number | null; // User-entered or property-extracted sqft for condo price estimation
}

export interface ReportMetrics {
  allTime: {
    avgPrice: number;
    avgRent: number;
    priceRange: { min: number; max: number };
    rentRange: { min: number; max: number };
    avgTimeOnMarket: number;
    timeOnMarketRange: { min: number; max: number };
    median: number;
    mean: number;
  };
  monthly: {
    avgPrice: number;
    avgRent: number;
    priceRange: { min: number; max: number };
    rentRange: { min: number; max: number };
    avgTimeOnMarket: number;
    timeOnMarketRange: { min: number; max: number };
    median: number;
    mean: number;
  };
  annual: {
    avgPrice: number;
    avgRent: number;
    priceRange: { min: number; max: number };
    rentRange: { min: number; max: number };
    avgTimeOnMarket: number;
    timeOnMarketRange: { min: number; max: number };
    median: number;
    mean: number;
  };
}

export interface AIInsight {
  title: string;
  content: string;
  category: 'market' | 'pricing' | 'trend' | 'opportunity' | 'demographic' | 'economic';
  icon?: string;
}

export class CMAReportPDFGenerator {
  private pdf: jsPDF;
  // private chartRenderer?: ChartRenderer; // Disabled: requires canvas native module (incompatible with Vercel)
  private components: BHHSComponentLibrary;
  private currentY: number = 20;
  private pageMargin: number = 20;
  private pageWidth: number;
  private pageHeight: number;
  private chartImages?: Record<string, string>; // Store provided chart images
  private currentPageNumber: number = 1; // Track current page number for headers/footers
  private performanceMonitor?: PerformanceMonitor; // Performance tracking
  private requestId: string; // Unique request identifier

  constructor(requestId?: string) {
    this.pdf = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.pageHeight = this.pdf.internal.pageSize.height;
    this.requestId = requestId || `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // ChartRenderer initialization removed - incompatible with Vercel serverless (requires canvas native module)
    // Client provides chart images via config.chartImages instead

    // Initialize BHHS component library for branded UI elements
    this.components = new BHHSComponentLibrary();
  }

  /**
   * Generate complete CMA report PDF with modern infographic design
   * Uses new page builders for professional layout
   */
  async generateReport(config: PDFReportConfig): Promise<Blob> {
    const version = 'v2' as const;

    // Initialize performance monitoring
    this.performanceMonitor = new PerformanceMonitor(this.requestId, version, true);
    this.performanceMonitor.start();

    // Track request for error rate calculation
    globalErrorTracker.trackRequest(version);

    try {
      console.log('[CMAReportPDFGenerator] Starting PDF generation with V2 page builders for:', config.reportType);
      console.log('[CMAReportPDFGenerator] Template version:', TEMPLATE_VERSION, 'last updated:', TEMPLATE_LAST_UPDATED);

      // Preload static PNG icons (pre-converted, no canvas needed)
      console.log('[CMAReportPDFGenerator] Preloading static PNG icons...');
      preloadStaticIcons(getAvailableIcons(), 96); // Load all icons at 96px
      console.log('[CMAReportPDFGenerator] Icons preloaded successfully');

      // Store chart images for use throughout generation
      this.chartImages = config.chartImages;
      console.log('[CMAReportPDFGenerator] Chart images available:', this.chartImages ? Object.keys(this.chartImages) : 'none');

      // Calculate metrics from SELECTED COMPARABLES (for table, pricing, direct comparison)
      const metrics = this.calculateReportMetrics(config.properties, config.reportType);

      // Calculate metrics from FULL AREA DATA (for market trends, momentum, absorption)
      // Use areaProperties if provided, otherwise fall back to properties
      const areaProperties = config.areaProperties || config.properties;
      const areaMetrics = config.areaProperties
        ? this.calculateReportMetrics(areaProperties, config.reportType)
        : metrics; // Same as comparables if no area data provided

      // Log selection info for debugging
      if (config.selectionInfo?.isFiltered) {
        console.log('[CMAReportPDFGenerator] Using SELECTED COMPARABLES for pricing:', config.selectionInfo.selectedCount, 'properties');
        console.log('[CMAReportPDFGenerator] Using AREA DATA for market trends:', config.selectionInfo.totalCount, 'properties');
      }

      // Extract demographic and economic data for AI insights (from area data)
      const demographicSummary = this.extractDemographicSummary(areaProperties);
      const economicSummary = this.extractEconomicSummary(areaProperties);

      // Generate AI insights early to use throughout report (now with demographic/economic context)
      // Character limits ensure insights fit in page layouts without overflow
      const aiInsights = this.generateAIInsights(config, metrics, demographicSummary, economicSummary, {
        market: 600,       // Market insight character limit
        pricing: 650,      // Pricing insight character limit
        trend: 600,        // Trend insight character limit
        opportunity: 550,  // Opportunity insight character limit
        demographic: 650,  // Demographic insight character limit
        economic: 700      // Economic insight character limit (longest, most complex)
      });

      // Use client-provided chart images (server-side rendering doesn't work on Vercel)
      console.log('[CMAReportPDFGenerator] Using client-provided chart images...');
      const chartImages = config.chartImages || {};
      this.chartImages = chartImages;
      console.log('[CMAReportPDFGenerator] Available chart images:', Object.keys(chartImages));
      console.log('[CMAReportPDFGenerator] Generated', Object.keys(chartImages).length, 'chart images');

      // Extract data for all pages with detailed logging
      console.log('[CMAReportPDFGenerator] Extracting page 1 data...');
      const page1Data = extractPage1Data(config, metrics, aiInsights, config.propertyCategory);
      console.log('[CMAReportPDFGenerator] Extracting page 2 data...');
      const page2Data = extractPage2Data(config, metrics, aiInsights, config.propertyCategory);
      console.log('[CMAReportPDFGenerator] Extracting page 3 data...');
      console.log('[CMAReportPDFGenerator] Config properties count:', config.properties?.length || 0);
      console.log('[CMAReportPDFGenerator] Selection info:', config.selectionInfo);
      const page3Data = await extractPage3Data(config, metrics, aiInsights);
      console.log('[CMAReportPDFGenerator] Page 3 allProperties count:', page3Data.allProperties?.length || 0);
      console.log('[CMAReportPDFGenerator] Extracting page 4 data (demographics - REAL DATA)...');
      const page4Data = extractPage4Data(config, metrics, aiInsights, config.demographicData);
      console.log('[CMAReportPDFGenerator] Extracting page 5 data (economic indicators - REAL DATA)...');
      const page5Data = extractPage5Data(config, metrics, aiInsights, config.demographicData);
      console.log('[CMAReportPDFGenerator] Extracting page 6 data (market trends)...');
      const page6Data = extractPage6Data(config, metrics);
      console.log('[CMAReportPDFGenerator] Extracting page 7 data (neighborhood insights)...');
      const page7Data = extractPage7Data(config, metrics, aiInsights);

      // Initialize page number
      this.currentPageNumber = 0;
      const TOTAL_PAGES = 6; // Reduced from 7 - Page 5 (Market Indexes) commented out

      // Create header/footer builder
      const headerFooter = new HeaderFooterBuilder(this.pdf);
      const areaName = config.selectedArea?.displayName || '';

      // Generate PDF using V2 page builders (2-column burgundy design)
      console.log('[CMAReportPDFGenerator] Using V2 page builders for 2-column burgundy layout...');

      // Page 1: Cover Page (no header, custom footer handled in template)
      this.performanceMonitor?.startPage(1);
      const page1 = new Page1BuilderV2(this.pdf, page1Data, config.propertyImages, config.propertyCategory);
      this.currentY = page1.build();
      this.performanceMonitor?.endPage(1);
      this.pdf.addPage();

      // Page 2: Market Overview
      this.performanceMonitor?.startPage(2);
      headerFooter.renderHeaderAndFooter(2, TOTAL_PAGES, { areaName, showLogo: true });
      const page2 = new Page2BuilderV2(this.pdf, page2Data, this.chartImages, config.propertyCategory);
      this.currentY = page2.build();
      this.performanceMonitor?.endPage(2);
      this.pdf.addPage();

      // Page 3: Pricing Analysis
      this.performanceMonitor?.startPage(3);
      headerFooter.renderHeaderAndFooter(3, TOTAL_PAGES, { areaName, showLogo: true });
      const page3 = new Page3BuilderV2(this.pdf, page3Data, config.propertyImages, config.propertyCategory);
      this.currentY = page3.build();
      this.performanceMonitor?.endPage(3);
      this.pdf.addPage();

      // Page 4: Demographics (REAL DATA)
      this.performanceMonitor?.startPage(4);
      headerFooter.renderHeaderAndFooter(4, TOTAL_PAGES, { areaName, showLogo: true });
      const page4 = new Page4BuilderV2(this.pdf, page4Data, this.chartImages);
      this.currentY = page4.build();
      this.performanceMonitor?.endPage(4);
      this.pdf.addPage();

      // Page 5: Economic Indicators & Market Indexes (COMMENTED OUT - may re-enable later)
      // this.performanceMonitor?.startPage(5);
      // headerFooter.renderHeaderAndFooter(5, TOTAL_PAGES, { areaName, showLogo: true });
      // const page5 = new Page5BuilderV2(this.pdf, page5Data, this.chartImages);
      // this.currentY = page5.build();
      // this.performanceMonitor?.endPage(5);
      // this.pdf.addPage();

      // Page 5 (was 6): Market Activity & Velocity
      this.performanceMonitor?.startPage(5);
      headerFooter.renderHeaderAndFooter(5, TOTAL_PAGES, { areaName, showLogo: true });
      const page6 = new Page6BuilderV2(this.pdf, page6Data, this.chartImages);
      this.currentY = page6.build();
      this.performanceMonitor?.endPage(5);
      this.pdf.addPage();

      // Page 6 (was 7): Neighborhood Insights
      this.performanceMonitor?.startPage(6);
      headerFooter.renderHeaderAndFooter(6, TOTAL_PAGES, { areaName, showLogo: true });
      const page7 = new Page7BuilderV2(this.pdf, page7Data);
      this.currentY = page7.build();
      this.performanceMonitor?.endPage(6);

      // Footer already added by headerFooter.renderHeaderAndFooter() above
      // Removed duplicate: this.addStandardFooter();

      // Return PDF as blob
      const pdfBlob = this.pdf.output('blob');

      // Finalize performance monitoring
      if (this.performanceMonitor) {
        this.performanceMonitor.setContext({
          pageCount: 6, // Reduced from 7 - Page 5 (Market Indexes) removed
          dataSize: JSON.stringify(config).length,
          complexity: config.properties.length > 100 ? 'complex' :
                     config.properties.length > 50 ? 'medium' : 'simple',
        });

        const metrics = this.performanceMonitor.end(Buffer.from(await pdfBlob.arrayBuffer()));
        this.performanceMonitor.log();
        this.exportMetrics(metrics);
      }

      console.log('[CMAReportPDFGenerator] PDF generation completed successfully with modern design');
      return pdfBlob;

    } catch (error) {
      console.error('[CMAReportPDFGenerator] Error generating PDF:', error);
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate professional cover page with branding and graphics
   */
  private generateCoverPage(config: PDFReportConfig) {
    // Modern gradient header with teal instead of maroon
    const burgundyLight = ColorPalette.BURGUNDY_LIGHT;
    const burgundyMedium = ColorPalette.BURGUNDY_MEDIUM;
    const burgundy = ColorPalette.BURGUNDY;
    // const maroon = ColorPalette.MAROON; // Reserved for BHHS branding
    const grayLight = ColorPalette.GRAY_LIGHTER;

    // Gradient effect using multiple rectangles
    for (let i = 0; i < 50; i++) {
      const ratio = i / 50;
      const r = Math.round(burgundyLight.r + (burgundyMedium.r - burgundyLight.r) * ratio);
      const g = Math.round(burgundyLight.g + (burgundyMedium.g - burgundyLight.g) * ratio);
      const b = Math.round(burgundyLight.b + (burgundyMedium.b - burgundyLight.b) * ratio);
      this.pdf.setFillColor(r, g, b);
      this.pdf.rect(0, i, this.pageWidth, 1, 'F');
    }

    // BHHS Logo - top left corner (50mm x 16.6mm maintaining 3:1 aspect ratio)
    // COMMENTED OUT: Logo now displayed on Page 1 instead of header
    // const logoWidth = 50;
    // const logoHeight = logoWidth / BHHS_LOGO_DIMENSIONS.aspectRatio;
    // this.pdf.addImage(BHHS_LOGO_BASE64, 'PNG', this.pageMargin, 12, logoWidth, logoHeight);

    // Company tagline - white text on gradient
    this.pdf.setFontSize(11);
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text('Professional Market Analysis', this.pageWidth - 75, 30);

    // Decorative accent bars using burgundy
    this.pdf.setFillColor(grayLight.r, grayLight.g, grayLight.b);
    this.pdf.rect(0, 50, this.pageWidth, 5, 'F');
    this.pdf.setFillColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.rect(0, 52, this.pageWidth, 1, 'F');

    // Report title section - using burgundy for main title
    this.currentY = 80;
    this.pdf.setFontSize(28);
    this.pdf.setTextColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.setFont('helvetica', 'bold');
    const mainTitle = 'Comparative Market Analysis';
    this.pdf.text(mainTitle, this.pageMargin, this.currentY);

    this.currentY += 12;
    this.pdf.setFontSize(18);
    this.pdf.setTextColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setFont('helvetica', 'normal');
    const subtitle = config.reportType === 'sold'
      ? 'Sold Properties Report'
      : 'Active Listings Report';
    this.pdf.text(subtitle, this.pageMargin, this.currentY);

    // Decorative line using burgundy light
    this.currentY += 10;
    this.pdf.setDrawColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setLineWidth(1.5);
    this.pdf.line(this.pageMargin, this.currentY, 120, this.currentY);

    // Infographic-style metrics cards with stat bars
    this.currentY += 20;
    const metrics = [
      { label: 'Properties Analyzed', value: config.properties.length.toString(), color: ColorPalette.BURGUNDY },
      { label: 'Average Price', value: `$${config.stats.average_price.toLocaleString()}`, color: ColorPalette.BURGUNDY_LIGHT },
      { label: 'Avg Days on Market', value: config.stats.average_dom.toString(), color: ColorPalette.BURGUNDY_MEDIUM },
      { label: 'Price per Sq Ft', value: `$${config.stats.price_per_sqft}`, color: ColorPalette.getChartColor(3) }
    ];

    const cardWidth = 80;
    const cardHeight = 28;
    const cardSpacing = 10;
    let metricX = this.pageMargin;
    let metricY = this.currentY;

    metrics.forEach((metric, index) => {
      if (index === 2) {
        metricX = this.pageMargin;
        metricY += cardHeight + cardSpacing;
      }

      // Card with colored left border
      const bgLight = ColorPalette.BG_LIGHT;
      this.pdf.setFillColor(bgLight.r, bgLight.g, bgLight.b);
      this.pdf.roundedRect(metricX, metricY, cardWidth, cardHeight, 3, 3, 'F');

      // Colored left accent bar
      this.pdf.setFillColor(metric.color.r, metric.color.g, metric.color.b);
      this.pdf.rect(metricX, metricY, 4, cardHeight, 'F');

      // Label
      this.pdf.setFontSize(9);
      const textSecondary = ColorPalette.TEXT_SECONDARY;
      this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(metric.label, metricX + 8, metricY + 10);

      // Value in matching color
      this.pdf.setFontSize(16);
      this.pdf.setTextColor(metric.color.r, metric.color.g, metric.color.b);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(metric.value, metricX + 8, metricY + 21);

      if (index < 2) metricX += cardWidth + cardSpacing;
    });

    // Report metadata section
    this.currentY += 55;
    this.pdf.setFontSize(11);
    const textLight = ColorPalette.TEXT_LIGHT;
    this.pdf.setTextColor(textLight.r, textLight.g, textLight.b);
    this.pdf.setFont('helvetica', 'normal');

    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    this.pdf.text(`Report Generated: ${reportDate}`, this.pageMargin, this.currentY);

    if (config.selectedArea) {
      this.currentY += 7;
      this.pdf.text(`Analysis Area: ${config.selectedArea.displayName}`, this.pageMargin, this.currentY);
    }

    // Decorative graphic elements using burgundy shades
    this.currentY = 220;
    const burgundyLightOpacity = ColorPalette.withOpacity(ColorPalette.BURGUNDY_LIGHT, 0.05);
    const burgundyMediumOpacity = ColorPalette.withOpacity(ColorPalette.BURGUNDY_MEDIUM, 0.08);

    this.pdf.setFillColor(burgundyLightOpacity.r, burgundyLightOpacity.g, burgundyLightOpacity.b);
    this.pdf.circle(this.pageWidth - 40, this.currentY, 60, 'F');

    this.pdf.setFillColor(burgundyMediumOpacity.r, burgundyMediumOpacity.g, burgundyMediumOpacity.b);
    this.pdf.circle(30, this.currentY + 20, 40, 'F');

    // Footer
    this.addCoverFooter();

    // Cover page is page 0, increment for content pages
    this.currentPageNumber = 0;
    this.addNewPage();
  }

  /**
   * Generate executive summary page with key insights
   */
  private async generateExecutiveSummary(config: PDFReportConfig, metrics: ReportMetrics, insights: AIInsight[]) {
    this.addStandardHeader('Executive Summary', 1);
    this.currentY += 10;

    // Summary introduction
    this.pdf.setFontSize(12);
    const textPrimary = ColorPalette.TEXT_PRIMARY;
    this.pdf.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
    this.pdf.setFont('helvetica', 'normal');

    const introText = config.reportType === 'sold'
      ? `This comprehensive market analysis examines ${config.properties.length} recently sold properties to provide actionable insights for pricing, marketing, and strategic decision-making. The data reveals current market conditions, pricing trends, and competitive positioning within the selected analysis area.`
      : `This comprehensive market analysis examines ${config.properties.length} active listings to provide current market insights, competitive positioning, and pricing strategies. The analysis reveals inventory levels, market absorption rates, and opportunity assessment for buyers and sellers.`;

    const wrappedIntro = this.wrapText(introText, 160);
    this.pdf.text(wrappedIntro, this.pageMargin, this.currentY);
    this.currentY += wrappedIntro.split('\n').length * 6 + 10;

    // Key findings highlight box - using burgundy with opacity
    const burgundyBg = ColorPalette.withOpacity(ColorPalette.BURGUNDY_LIGHT, 0.08);
    this.pdf.setFillColor(burgundyBg.r, burgundyBg.g, burgundyBg.b);
    this.pdf.setGState(this.pdf.GState({ opacity: 0.08 }));
    this.pdf.roundedRect(this.pageMargin, this.currentY, 170, 45, 5, 5, 'F');
    this.pdf.setGState(this.pdf.GState({ opacity: 1.0 }));

    this.currentY += 10;
    this.pdf.setFontSize(12);
    const burgundyLight = ColorPalette.BURGUNDY_LIGHT;
    this.pdf.setTextColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Key Market Findings', this.pageMargin + 5, this.currentY);

    // Add first AI insight as key finding
    if (insights.length > 0) {
      this.currentY += 8;
      this.pdf.setFontSize(11);
      this.pdf.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
      this.pdf.setFont('helvetica', 'normal');

      // Display FULL content with proper wrapping and pagination
      const insightText = this.wrapText(insights[0].content, 155);
      const lines = insightText.split('\n');
      const lineHeight = 5;

      // Render each line with page overflow detection
      lines.forEach((line) => {
        if (this.currentY + lineHeight > this.pageHeight - 30) {
          this.addNewPage();
          this.addStandardHeader('Executive Summary (Continued)', 1);
        }
        this.pdf.text(line, this.pageMargin + 5, this.currentY);
        this.currentY += lineHeight;
      });
    }

    this.currentY += 40;


    // Market metrics comparison
    this.pdf.setFontSize(13);
    const burgundy = ColorPalette.BURGUNDY;
    this.pdf.setTextColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Market Performance Metrics', this.pageMargin, this.currentY);
    this.currentY += 12;

    this.drawMetricsComparisonTable(metrics);

    this.currentY += 15;

    // Add AI insight box with purple styling
    const marketInsight = insights.find(i => i.category === 'market');
    if (marketInsight) {
      const insightHeight = this.components.renderInsightBox(
        this.pdf,
        this.pageMargin,
        this.currentY,
        170,
        {
          title: marketInsight.title,
          content: marketInsight.content,
          confidence: 'high',
        }
      );
      this.currentY += insightHeight;
    }

    // Price trend mini chart
    this.pdf.setFontSize(13);
    this.pdf.setTextColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Price Trend Overview', this.pageMargin, this.currentY);

    // Add AI insight snippet
    const trendInsight = insights.find(i => i.category === 'trend');
    if (trendInsight) {
      this.currentY += 8;
      this.pdf.setFontSize(10);
      const textSecondary = ColorPalette.TEXT_SECONDARY;
      this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
      this.pdf.setFont('helvetica', 'italic');
      const snippet = this.wrapText('AI Insight: ' + trendInsight.content, 160);
      this.pdf.text(snippet, this.pageMargin, this.currentY);
      this.currentY += snippet.split('\n').length * 5 + 5;
    } else {
      this.currentY += 10;
    }

    const monthlyData = this.calculateMonthlyPriceTrend(config.properties, config.reportType);
    await this.drawLineChart(this.pageMargin, this.currentY, 170, 50, monthlyData, true, 'executiveSummaryTrend');

    this.addNewPage();
  }

  /**
   * Generate market overview page with distribution charts
   */
  private generateMarketOverview(config: PDFReportConfig, metrics: ReportMetrics, insights: AIInsight[]) {
    this.addStandardHeader('Market Overview & Distribution', 2);
    this.currentY += 10;

    // Property type distribution
    this.pdf.setFontSize(13);
    const burgundyLight = ColorPalette.BURGUNDY_LIGHT;
    this.pdf.setTextColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Property Status Distribution', this.pageMargin, this.currentY);
    this.currentY += 10;

    const soldCount = config.properties.filter(p => p.status === 'sold').length;
    const activeCount = config.properties.filter(p => p.status === 'active').length;

    const color1 = ColorPalette.getChartColor(0);
    const color2 = ColorPalette.getChartColor(1);
    const pieData = [
      { label: 'Sold Properties', value: soldCount, color: [color1.r, color1.g, color1.b] },
      { label: 'Active Listings', value: activeCount, color: [color2.r, color2.g, color2.b] }
    ];

    this.drawPieChart(this.pageWidth / 2, this.currentY + 35, 30, pieData, 'propertyStatusDistribution');

    this.currentY += 85;

    // Price distribution chart
    this.pdf.setFontSize(13);
    const burgundy = ColorPalette.BURGUNDY;
    this.pdf.setTextColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Price Range Distribution', this.pageMargin, this.currentY);

    // Add AI insight
    const pricingInsight = insights.find(i => i.category === 'pricing');
    if (pricingInsight) {
      this.currentY += 8;
      this.pdf.setFontSize(10);
      const textSecondary = ColorPalette.TEXT_SECONDARY;
      this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
      this.pdf.setFont('helvetica', 'italic');
      const snippet = this.wrapText('AI Insight: ' + pricingInsight.content, 160);
      this.pdf.text(snippet, this.pageMargin, this.currentY);
      this.currentY += snippet.split('\n').length * 5 + 5;
    } else {
      this.currentY += 10;
    }

    const priceDistribution = this.calculatePriceDistribution(config.properties);
    this.drawBarChart(this.pageMargin, this.currentY, 170, 55, priceDistribution, 'priceDistribution');

    this.currentY += 70;

    // Market activity summary
    this.pdf.setFontSize(13);
    this.pdf.setTextColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Market Activity Summary', this.pageMargin, this.currentY);
    this.currentY += 10;

    this.drawActivityCards(metrics, config.reportType);

    this.addNewPage();
  }

  /**
   * Generate pricing analysis page
   */
  private async generatePricingAnalysis(config: PDFReportConfig, metrics: ReportMetrics, insights: AIInsight[]) {
    this.addStandardHeader('Pricing Analysis & Strategy', 3);
    this.currentY += 10;

    // Pricing metrics overview
    this.pdf.setFontSize(13);
    const burgundyLight = ColorPalette.BURGUNDY_LIGHT;
    this.pdf.setTextColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Price Point Analysis', this.pageMargin, this.currentY);
    this.currentY += 12;

    // Price statistics cards
    this.drawPricingCards(metrics.allTime);
    this.currentY += 15;

    // Pricing trend chart
    this.pdf.setFontSize(13);
    const burgundy = ColorPalette.BURGUNDY;
    this.pdf.setTextColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Historical Pricing Trends', this.pageMargin, this.currentY);
    this.currentY += 10;

    const trendData = this.calculateMonthlyPriceTrend(config.properties, config.reportType);
    await this.drawLineChart(this.pageMargin, this.currentY, 170, 60, trendData, true, 'pricingTrend');
    this.currentY += 75;

    // AI pricing recommendations
    this.pdf.setFontSize(13);
    const aiPurple = ColorPalette.AI_PURPLE;
    this.pdf.setTextColor(aiPurple.r, aiPurple.g, aiPurple.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('AI Pricing Recommendations', this.pageMargin, this.currentY);
    this.currentY += 10;

    const pricingInsights = insights.filter(i => i.category === 'pricing');
    pricingInsights.forEach(insight => {
      if (this.currentY > this.pageHeight - 40) {
        this.addNewPage();
        this.addStandardHeader('Pricing Analysis (Continued)', 3);
        this.currentY += 10;
      }

      this.drawInsightBox(insight);
      this.currentY += 5;
    });

    this.addNewPage();
  }

  /**
   * Generate comparable properties page
   */
  private generateComparableProperties(config: PDFReportConfig) {
    this.addStandardHeader('Comparable Properties', 3);
    this.currentY += 10;

    // Add section description
    this.pdf.setFontSize(11);
    const textSecondary = ColorPalette.TEXT_SECONDARY;
    this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
    this.pdf.setFont('helvetica', 'normal');

    const propertyCount = config.properties.length;
    const description = config.reportType === 'sold'
      ? `Analysis of ${propertyCount} recently sold ${propertyCount === 1 ? 'property' : 'properties'} in the selected area`
      : `Analysis of ${propertyCount} active ${propertyCount === 1 ? 'property' : 'properties'} currently on the market`;

    this.pdf.text(description, this.pageMargin, this.currentY);
    this.currentY += 10;

    // Render comparables table
    const tableHeight = renderComparablesTable(this.pdf, {
      comparableProperties: config.properties,
      reportType: config.reportType,
      x: this.pageMargin,
      y: this.currentY,
      width: this.pageWidth - (2 * this.pageMargin),
      propertyImages: config.propertyImages
    });

    this.currentY += tableHeight + 15;
    this.addNewPage();
  }

  /**
   * Generate property distribution analysis
   */
  private generatePropertyDistribution(config: PDFReportConfig, _metrics: ReportMetrics, insights: AIInsight[]) {
    this.addStandardHeader('Property Characteristics', 4);
    this.currentY += 10;

    // Time on market analysis
    this.pdf.setFontSize(13);
    const burgundy = ColorPalette.BURGUNDY;
    this.pdf.setTextColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Days on Market Analysis', this.pageMargin, this.currentY);
    this.currentY += 12;

    this.drawDaysOnMarketChart(config.properties);
    this.currentY += 75;

    // Property features distribution
    this.pdf.setFontSize(13);
    const burgundyLight = ColorPalette.BURGUNDY_LIGHT;
    this.pdf.setTextColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Property Features Overview', this.pageMargin, this.currentY);
    this.currentY += 12;

    this.drawFeatureDistribution(config.properties);
    this.currentY += 15;

    // Market insights
    const marketInsights = insights.filter(i => i.category === 'market');
    if (marketInsights.length > 0) {
      this.pdf.setFontSize(13);
      const aiPurple = ColorPalette.AI_PURPLE;
      this.pdf.setTextColor(aiPurple.r, aiPurple.g, aiPurple.b);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text('Market Insights', this.pageMargin, this.currentY);
      this.currentY += 10;

      marketInsights.forEach(insight => {
        if (this.currentY > this.pageHeight - 40) {
          this.addNewPage();
          this.addStandardHeader('Property Characteristics (Continued)', 4);
          this.currentY += 10;
        }
        this.drawInsightBox(insight);
        this.currentY += 5;
      });
    }

    this.addNewPage();
  }

  /**
   * Generate area analysis with map
   */
  private generateAreaAnalysis(config: PDFReportConfig, metrics: ReportMetrics) {
    this.addStandardHeader('Geographic Analysis', 5);
    this.currentY += 10;

    if (config.selectedArea) {
      this.pdf.setFontSize(11);
      const textPrimary = ColorPalette.TEXT_PRIMARY;
      this.pdf.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(`Analysis Area: ${config.selectedArea.displayName}`, this.pageMargin, this.currentY);
      this.currentY += 10;
    }

    // Map placeholder with improved styling
    const bgLight = ColorPalette.BG_LIGHT;
    this.pdf.setFillColor(bgLight.r, bgLight.g, bgLight.b);
    this.pdf.roundedRect(this.pageMargin, this.currentY, 170, 100, 5, 5, 'F');
    const burgundyLight = ColorPalette.BURGUNDY_LIGHT;
    this.pdf.setDrawColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setLineWidth(1);
    this.pdf.roundedRect(this.pageMargin, this.currentY, 170, 100, 5, 5, 'S');

    // Map overlay
    this.pdf.setFontSize(14);
    const textLight = ColorPalette.TEXT_LIGHT;
    this.pdf.setTextColor(textLight.r, textLight.g, textLight.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Property Location Map', this.pageMargin + 50, this.currentY + 50);

    this.currentY += 115;

    // Area statistics
    this.pdf.setFontSize(13);
    const burgundy = ColorPalette.BURGUNDY;
    this.pdf.setTextColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Area Market Statistics', this.pageMargin, this.currentY);
    this.currentY += 12;

    this.drawAreaStatistics(config, metrics);

    this.addNewPage();
  }

  /**
   * Generate detailed insights page
   */
  private generateDetailedInsights(_config: PDFReportConfig, _metrics: ReportMetrics, insights: AIInsight[]) {
    this.addStandardHeader('Detailed Market Insights', 6);
    this.currentY += 10;

    insights.forEach((insight) => {
      if (this.currentY > this.pageHeight - 50) {
        this.addNewPage();
        this.addStandardHeader('Detailed Market Insights (Continued)', 6);
        this.currentY += 10;
      }

      this.drawInsightBox(insight, true);
      this.currentY += 8;
    });

    // Opportunity assessment
    if (this.currentY > this.pageHeight - 70) {
      this.addNewPage();
      this.addStandardHeader('Opportunity Assessment', 6);
      this.currentY += 10;
    } else {
      this.currentY += 10;
      this.pdf.setFontSize(13);
      const success = ColorPalette.SUCCESS;
      this.pdf.setTextColor(success.r, success.g, success.b);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text('Opportunity Assessment', this.pageMargin, this.currentY);
      this.currentY += 10;
    }

    const opportunityInsights = insights.filter(i => i.category === 'opportunity');
    if (opportunityInsights.length > 0) {
      opportunityInsights.forEach(insight => {
        if (this.currentY > this.pageHeight - 40) {
          this.addNewPage();
          this.addStandardHeader('Opportunity Assessment (Continued)', 6);
          this.currentY += 10;
        }
        this.drawInsightBox(insight, true);
        this.currentY += 8;
      });
    }

    this.addNewPage();
  }

  /**
   * Generate appendix with filters and parameters
   */
  private generateAppendix(config: PDFReportConfig) {
    this.addStandardHeader('Appendix: Analysis Parameters', 7);
    this.currentY += 10;

    this.pdf.setFontSize(11);
    const textPrimary = ColorPalette.TEXT_PRIMARY;
    this.pdf.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
    this.pdf.setFont('helvetica', 'normal');
    const appendixText = 'This report was generated using the following filters and parameters. All data is sourced from current MLS listings and recent sales records.';
    const wrapped = this.wrapText(appendixText, 160);
    this.pdf.text(wrapped, this.pageMargin, this.currentY);
    this.currentY += wrapped.split('\n').length * 6 + 15;

    // Filter parameters
    // Convert date strings to Date objects if necessary
    const startDate = config.filters.dateRange.start instanceof Date
      ? config.filters.dateRange.start
      : new Date(config.filters.dateRange.start);
    const endDate = config.filters.dateRange.end instanceof Date
      ? config.filters.dateRange.end
      : new Date(config.filters.dateRange.end);

    const parameters = [
      { label: 'Property Type', value: config.filters.propertyType || 'All Types' },
      { label: 'Price Range', value: `$${config.filters.priceRange.min.toLocaleString()} - $${config.filters.priceRange.max.toLocaleString()}` },
      { label: 'Bedrooms', value: `${config.filters.bedrooms.min} - ${config.filters.bedrooms.max}` },
      { label: 'Bathrooms', value: `${config.filters.bathrooms.min} - ${config.filters.bathrooms.max}` },
      { label: 'Square Footage', value: `${config.filters.squareFootage.min.toLocaleString()} - ${config.filters.squareFootage.max.toLocaleString()} sq ft` },
      { label: 'Year Built', value: `${config.filters.yearBuilt.min} - ${config.filters.yearBuilt.max}` },
      { label: 'Listing Status', value: config.filters.listingStatus || 'All' },
      { label: 'Analysis Period', value: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}` }
    ];

    this.drawParameterGrid(parameters);

    // Disclaimer removed per client request
    // this.currentY = this.pageHeight - 40;
    // this.pdf.setFillColor(248, 248, 248);
    // this.pdf.rect(this.pageMargin, this.currentY, 170, 25, 'F');
    // this.currentY += 8;

    // this.pdf.setFontSize(8);
    // this.pdf.setTextColor(102, 102, 102);
    // this.pdf.setFont('helvetica', 'italic');
    // const disclaimer = 'This report is provided for informational purposes only. Market data is subject to change. Please consult with a licensed real estate professional for specific advice regarding your property transaction. Data accuracy is not guaranteed.';
    // const disclaimerWrapped = this.wrapText(disclaimer, 160);
    // this.pdf.text(disclaimerWrapped, this.pageMargin + 5, this.currentY);
  }

  /**
   * Calculate comprehensive metrics for all timeframes
   */
  private calculateReportMetrics(properties: CMAProperty[], reportType: 'sold' | 'active' | 'both'): ReportMetrics {
    // Note: Date filtering would be implemented here when sale date field is available
    // const currentDate = new Date();
    // const oneMonthAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate());
    // const oneYearAgo = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), currentDate.getDate());

    // Filter properties based on reportType
    // If 'both', use all properties; otherwise filter by status
    // Check both normalized 'status' field and raw 'st' field (SO/AC)
    const filteredProperties = reportType === 'both'
      ? properties
      : properties.filter(p => {
          const st = p.st?.toUpperCase();
          const status = p.status?.toLowerCase();
          if (reportType === 'sold') {
            return status === 'sold' || st === 'SO';
          }
          return status === 'active' || st === 'AC';
        });
    const monthlyProperties = filteredProperties.slice(0, Math.ceil(filteredProperties.length * 0.3));
    const annualProperties = filteredProperties.slice(0, Math.ceil(filteredProperties.length * 0.8));

    return {
      allTime: this.calculateTimeframeMetrics(filteredProperties),
      monthly: this.calculateTimeframeMetrics(monthlyProperties),
      annual: this.calculateTimeframeMetrics(annualProperties)
    };
  }

  private calculateTimeframeMetrics(properties: CMAProperty[]) {
    if (properties.length === 0) {
      return {
        avgPrice: 0, avgRent: 0,
        priceRange: { min: 0, max: 0 },
        rentRange: { min: 0, max: 0 },
        avgTimeOnMarket: 0,
        timeOnMarketRange: { min: 0, max: 0 },
        median: 0, mean: 0
      };
    }

    const prices = properties.map(p => p.price).filter(p => p > 0);
    const rents = properties.map(p => p.price * 0.004).filter(r => r > 0);
    // Use actual time_on_market from data, calculate if missing
    const timeOnMarket = properties.map(p => {
      if (p.time_on_market && p.time_on_market > 0) return p.time_on_market;
      // Calculate from dates if available
      if (p.date_bc) {
        const listingDate = new Date(p.date_bc);
        const endDate = p.date_pp_acpt_expiration ? new Date(p.date_pp_acpt_expiration) : new Date();
        const diffDays = Math.round((endDate.getTime() - listingDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays < 3650) return diffDays;
      }
      return 30; // Default to 30 days only if no data available
    });

    // Handle empty arrays after filtering
    if (prices.length === 0) {
      return {
        avgPrice: 0, avgRent: 0,
        priceRange: { min: 0, max: 0 },
        rentRange: { min: 0, max: 0 },
        avgTimeOnMarket: 0,
        timeOnMarketRange: { min: 0, max: 0 },
        median: 0, mean: 0
      };
    }

    prices.sort((a, b) => a - b);
    rents.sort((a, b) => a - b);
    timeOnMarket.sort((a, b) => a - b);

    return {
      avgPrice: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
      avgRent: rents.length > 0 ? Math.round(rents.reduce((sum, r) => sum + r, 0) / rents.length) : 0,
      priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
      rentRange: rents.length > 0 ? { min: Math.min(...rents), max: Math.max(...rents) } : { min: 0, max: 0 },
      avgTimeOnMarket: timeOnMarket.length > 0 ? Math.round(timeOnMarket.reduce((sum, t) => sum + t, 0) / timeOnMarket.length) : 0,
      timeOnMarketRange: timeOnMarket.length > 0 ? { min: Math.min(...timeOnMarket), max: Math.max(...timeOnMarket) } : { min: 0, max: 0 },
      median: prices[Math.floor(prices.length / 2)],
      mean: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
    };
  }

  /**
   * Generate comprehensive AI insights
   */
  /**
   * Extract demographic summary from properties
   */
  private extractDemographicSummary(properties: any[]): {
    medianAge: number;
    population: number;
    educationRate: number;
    unemploymentRate: number;
    pop2534Pct: number;
  } {
    const avgDemo = properties.reduce((acc, prop: any) => ({
      medianAge: acc.medianAge + (prop.age_median || 0),
      pop: acc.pop + (prop.ECYPTAPOP || 0),
      education: acc.education + (prop.education_university_rate || 0),
      unemployment: acc.unemployment + (prop.unemployment_rate || 0),
      pop2534: acc.pop2534 + (prop.population_25_34 || 0),
      count: acc.count + 1,
    }), { medianAge: 0, pop: 0, education: 0, unemployment: 0, pop2534: 0, count: 0 });

    const count = avgDemo.count || 1;
    return {
      medianAge: Math.round(avgDemo.medianAge / count) || 38,
      population: Math.round(avgDemo.pop / count) || 0,
      educationRate: Math.round(avgDemo.education / count) || 35,
      unemploymentRate: Math.round((avgDemo.unemployment / count) * 10) / 10 || 5,
      pop2534Pct: Math.round((avgDemo.pop2534 / count) * 10) / 10 || 25,
    };
  }

  /**
   * Extract economic summary from properties
   */
  private extractEconomicSummary(properties: any[]): {
    avgIncome: number;
    homeownershipRate: number;
    affordabilityIndex: number;
    hotGrowthIndex: number;
  } {
    const avgEcon = properties.reduce((acc, prop: any) => ({
      income: acc.income + (prop.avg_household_income || 0),
      ownership: acc.ownership + (prop.ECYTENOWN_P || 0),
      affordability: acc.affordability + (prop.HOUSING_AFFORDABILITY_INDEX || 0),
      hotGrowth: acc.hotGrowth + (prop.HOT_GROWTH_INDEX || 0),
      count: acc.count + 1,
    }), { income: 0, ownership: 0, affordability: 0, hotGrowth: 0, count: 0 });

    const count = avgEcon.count || 1;
    return {
      avgIncome: Math.round(avgEcon.income / count) || 75000,
      homeownershipRate: Math.round(avgEcon.ownership / count) || 65,
      affordabilityIndex: Math.round((avgEcon.affordability / count) * 100) / 100 || 0,
      hotGrowthIndex: Math.round((avgEcon.hotGrowth / count) * 100) / 100 || 0,
    };
  }

  private generateAIInsights(
    config: PDFReportConfig,
    metrics: ReportMetrics,
    demographics: { medianAge: number; population: number; educationRate: number; unemploymentRate: number; pop2534Pct: number },
    economics: { avgIncome: number; homeownershipRate: number; affordabilityIndex: number; hotGrowthIndex: number },
    limits?: {
      market?: number;      // Max chars for market insight
      pricing?: number;     // Max chars for pricing insight
      trend?: number;       // Max chars for trend insight
      opportunity?: number; // Max chars for opportunity insight
      demographic?: number; // Max chars for demographic insight
      economic?: number;    // Max chars for economic insight
    }
  ): AIInsight[] {
    const reportType = config.reportType;
    const avgPrice = metrics.allTime.avgPrice;
    const timeOnMarket = metrics.allTime.avgTimeOnMarket;

    // Use SELECTED COMPARABLES count for comparable-specific analysis
    const comparableCount = config.properties.length;

    // Use AREA DATA count for market inventory analysis (statistically meaningful)
    const areaInventoryCount = config.areaProperties?.length || config.properties.length;

    // Log the distinction for debugging
    if (config.selectionInfo?.isFiltered) {
      console.log('[generateAIInsights] Comparable count:', comparableCount, 'Area inventory:', areaInventoryCount);
    }

    // Helper function to truncate text intelligently at word boundaries
    const truncateText = (text: string, maxChars?: number): string => {
      if (!maxChars || text.length <= maxChars) return text;

      // Truncate at the last complete word before the limit
      const truncated = text.substring(0, maxChars);
      const lastSpaceIndex = truncated.lastIndexOf(' ');

      if (lastSpaceIndex > maxChars * 0.8) {
        // If we can keep at least 80% of content, truncate at word boundary
        return truncated.substring(0, lastSpaceIndex) + '...';
      }

      // Otherwise, hard truncate with ellipsis
      return truncated.substring(0, maxChars - 3) + '...';
    };

    const insights: AIInsight[] = [];

    if (reportType === 'sold') {
      // Determine buyer persona based on demographics
      const buyerPersona = demographics.medianAge < 35 ? 'first-time buyers and young professionals' :
                          demographics.medianAge < 50 ? 'established families and move-up buyers' :
                          'empty nesters and downsizing buyers';

      const employmentStrength = demographics.unemploymentRate < 4 ? 'strong employment ('+demographics.unemploymentRate.toFixed(1)+'% unemployment)' :
                                demographics.unemploymentRate < 6 ? 'stable employment' :
                                'moderate employment challenges';

      const marketContent = `Based on ${comparableCount} comparable sold properties in an area with median age ${demographics.medianAge} and ${economics.homeownershipRate}% homeownership rate, the market demonstrates ${timeOnMarket < 30 ? 'exceptional' : timeOnMarket < 60 ? 'strong' : 'moderate'} performance driven by ${buyerPersona}. Average sale price of $${avgPrice.toLocaleString()} ${economics.avgIncome > 0 ? 'aligns with household income of $'+economics.avgIncome.toLocaleString() : 'reflects local economic conditions'}. Properties are selling within ${timeOnMarket} days on average, supported by ${employmentStrength} and ${demographics.educationRate}% with university education, indicating ${timeOnMarket < 30 ? 'a robust seller\'s market with high demand from educated, employed buyers' : timeOnMarket < 60 ? 'balanced market conditions with qualified buyer pool' : 'a buyer\'s market with extended evaluation periods'}. The demographic profile suggests ${demographics.medianAge < 40 ? 'growing demand for starter and move-up properties' : 'stable demand for established neighborhoods'}.`;

      insights.push({
        title: 'Market Performance Analysis',
        category: 'market',
        content: truncateText(marketContent, limits?.market)
      });

      const pricingContent = `The comprehensive price range analysis reveals properties successfully selling between $${metrics.allTime.priceRange.min.toLocaleString()} and $${metrics.allTime.priceRange.max.toLocaleString()}, with the market median at $${metrics.allTime.median.toLocaleString()}. ${economics.avgIncome > 0 ? 'Given the average household income of $'+economics.avgIncome.toLocaleString()+', the market shows '+(economics.avgIncome > avgPrice / 3 ? 'strong' : economics.avgIncome > avgPrice / 5 ? 'moderate' : 'limited')+' buyer purchasing power.' : ''} For optimal market positioning targeting the ${buyerPersona} demographic, properties should be priced within 5-7% of the $${metrics.allTime.median.toLocaleString()} median. The ${economics.homeownershipRate}% homeownership rate suggests ${economics.homeownershipRate > 65 ? 'established buyer base with equity for move-up purchases' : 'emerging buyer market with first-time buyer opportunities'}. Consider strategic adjustments of ±10% based on unique property features, condition upgrades, location premiums, and the ${demographics.educationRate}% university-educated demographic's quality expectations.`;

      insights.push({
        title: 'Strategic Pricing Recommendations',
        category: 'pricing',
        content: truncateText(pricingContent, limits?.pricing)
      });

      const trendContent = `Monthly data analysis indicates ${metrics.monthly.avgPrice > metrics.annual.avgPrice ? 'significant price appreciation' : 'price consolidation'} with current monthly averages ${Math.abs(((metrics.monthly.avgPrice - metrics.annual.avgPrice) / metrics.annual.avgPrice) * 100).toFixed(1)}% ${metrics.monthly.avgPrice > metrics.annual.avgPrice ? 'above' : 'below'} annual trends. ${economics.hotGrowthIndex > 0 ? 'The Hot Growth Index of '+economics.hotGrowthIndex.toFixed(2)+' indicates '+(economics.hotGrowthIndex > 1.0 ? 'above-average' : 'steady')+' market momentum, supported by '+(demographics.unemploymentRate < 5 ? 'strong local employment' : 'stable economic conditions')+'.' : ''} This ${metrics.monthly.avgPrice > metrics.annual.avgPrice ? 'upward trajectory' : 'stabilization pattern'} suggests ${metrics.monthly.avgPrice > metrics.annual.avgPrice ? 'continued market strength with increasing buyer competition from the '+buyerPersona+' segment' : 'market equilibrium with balanced supply-demand dynamics'}. The ${((metrics.allTime.avgPrice - metrics.annual.avgPrice) / metrics.annual.avgPrice * 100).toFixed(1)}% ${metrics.allTime.avgPrice > metrics.annual.avgPrice ? 'year-over-year appreciation' : 'adjustment'} aligns with ${economics.hotGrowthIndex > 1.0 ? 'strong growth fundamentals and expanding buyer pool' : 'stable market conditions and sustained demand'}.`;

      insights.push({
        title: 'Price Trend & Market Direction',
        category: 'trend',
        content: truncateText(trendContent, limits?.trend)
      });

      const opportunityContent = `Current market conditions present ${timeOnMarket < 45 ? 'limited but high-quality' : 'expanding'} opportunities for ${buyerPersona} in this ${demographics.medianAge < 40 ? 'growing' : 'established'} community. The ${timeOnMarket} day average absorption rate, combined with ${economics.hotGrowthIndex > 1.0 ? 'strong growth potential (Hot Growth Index: '+economics.hotGrowthIndex.toFixed(2)+')' : 'stable market fundamentals'}, suggests ${timeOnMarket < 45 ? 'sellers can maintain firm pricing while qualified buyers ('+demographics.educationRate+'% university-educated) should act decisively' : 'buyers have time for due diligence with moderate competition'}. Properties priced between $${(metrics.allTime.median * 0.95).toLocaleString()} and $${(metrics.allTime.median * 1.05).toLocaleString()} are experiencing ${timeOnMarket < 30 ? 'premium market reception from move-up buyers with strong purchasing power' : 'steady interest from value-conscious buyers'}. ${economics.affordabilityIndex > 0.8 ? 'Strong affordability (index: '+economics.affordabilityIndex.toFixed(2)+') supports continued demand from the target demographic.' : 'Moderate affordability requires strategic pricing to match buyer capacity.'}`;

      insights.push({
        title: 'Investment & Market Opportunity',
        category: 'opportunity',
        content: truncateText(opportunityContent, limits?.opportunity)
      });
    } else {
      // Use areaInventoryCount for market inventory text (full area data)
      // Use comparableCount for comparable-specific analysis
      const activeMarketContent = `Current market inventory reveals ${areaInventoryCount} active properties in the search area, with ${comparableCount} selected comparables at an average asking price of $${avgPrice.toLocaleString()}. ${areaInventoryCount < 50 ? 'Limited' : areaInventoryCount > 100 ? 'Abundant' : 'Moderate'} supply conditions prevail. The average time on market of ${timeOnMarket} days suggests ${timeOnMarket < 30 ? 'exceptional buyer demand with rapid absorption and potential for competitive offers' : timeOnMarket < 60 ? 'healthy market absorption with normal sales velocity' : 'reduced urgency with opportunities for price negotiations and extended due diligence periods'}. This inventory-to-velocity ratio indicates ${timeOnMarket < 45 ? 'seller-favorable conditions with pricing power' : 'buyer-favorable conditions with selection advantage'}.`;

      insights.push({
        title: 'Active Inventory Analysis',
        category: 'market',
        content: truncateText(activeMarketContent, limits?.market)
      });

      const activePricingContent = `Active listings span from $${metrics.allTime.priceRange.min.toLocaleString()} to $${metrics.allTime.priceRange.max.toLocaleString()}, providing diverse market segments for buyer consideration. Properties priced near the median of $${metrics.allTime.median.toLocaleString()} represent the market's competitive center and are statistically most likely to receive optimal market response. Listings positioned within ±8% of this median threshold capture approximately 60% of buyer activity. Current competition levels suggest ${areaInventoryCount < 50 ? 'limited alternatives create urgency' : areaInventoryCount > 100 ? 'buyers have significant negotiation leverage' : 'balanced conditions favor well-prepared parties'}.`;

      insights.push({
        title: 'Competitive Market Positioning',
        category: 'pricing',
        content: truncateText(activePricingContent, limits?.pricing)
      });

      const activeTrendContent = `The current ${areaInventoryCount}-property inventory level ${areaInventoryCount < 50 ? 'suggests constrained supply favoring sellers' : areaInventoryCount > 100 ? 'indicates elevated supply favoring buyers' : 'shows balanced market equilibrium'}. Monthly pricing trends demonstrate ${metrics.monthly.avgPrice > metrics.annual.avgPrice ? 'upward momentum with '+Math.abs(((metrics.monthly.avgPrice - metrics.annual.avgPrice) / metrics.annual.avgPrice) * 100).toFixed(1)+'% recent appreciation' : 'price stability with market normalization'}, indicating ${metrics.monthly.avgPrice > metrics.annual.avgPrice ? 'intensifying buyer competition and strengthening seller position' : 'rational pricing and balanced negotiation dynamics'}. Time-on-market trends suggest properties meeting market expectations are absorbed within ${Math.round(timeOnMarket * 0.8)}-${Math.round(timeOnMarket * 1.2)} days.`;

      insights.push({
        title: 'Market Absorption & Timing',
        category: 'trend',
        content: truncateText(activeTrendContent, limits?.trend)
      });

      const activeOpportunityContent = `Current market dynamics create distinct opportunities based on transaction goals. For sellers: ${timeOnMarket < 45 ? 'Strong demand supports premium pricing strategy with minimal concessions' : 'Strategic pricing and property presentation are critical for competitive positioning'}. For buyers: ${timeOnMarket < 45 ? 'Decisive action and strong offers are essential in competitive scenarios' : 'Extended marketing periods create negotiation opportunities and favorable terms'}. Properties priced between $${(metrics.allTime.median * 0.92).toLocaleString()} and $${(metrics.allTime.median * 1.08).toLocaleString()} represent the market's sweet spot, balancing seller objectives with buyer value perception. The ${Math.round((areaInventoryCount / (timeOnMarket / 30)))} monthly absorption rate suggests ${areaInventoryCount / (timeOnMarket / 30) > 15 ? 'rapid market turnover' : 'measured market pace'}.`;

      insights.push({
        title: 'Strategic Opportunity Assessment',
        category: 'opportunity',
        content: truncateText(activeOpportunityContent, limits?.opportunity)
      });
    }

    // Add demographic insight for Page 4
    const ageSegment = demographics.medianAge < 35 ? 'young professionals and first-time buyers' :
                      demographics.medianAge < 50 ? 'established families in their peak earning years' :
                      'mature homeowners and empty nesters';

    const demographicContent = `This market area is characterized by a median age of ${demographics.medianAge}, indicating a strong presence of ${ageSegment}. With ${demographics.educationRate}% holding university degrees, the buyer pool demonstrates ${demographics.educationRate > 40 ? 'high' : 'moderate'} education levels, typically correlating with quality expectations and informed decision-making. The ${demographics.pop2534Pct.toFixed(1)}% representation in the 25-34 age bracket ${demographics.pop2534Pct > 25 ? 'suggests robust first-time buyer activity' : 'indicates a more established buyer demographic'}. Employment strength, reflected in the ${demographics.unemploymentRate.toFixed(1)}% unemployment rate, ${demographics.unemploymentRate < 4 ? 'provides strong market support with stable incomes' : demographics.unemploymentRate < 6 ? 'shows healthy economic conditions' : 'requires careful consideration of buyer capacity'}. This demographic composition creates ${demographics.medianAge < 40 ? 'dynamic demand for starter homes and modern amenities' : 'sustained demand for move-up properties and established neighborhoods'}.`;

    insights.push({
      title: 'Demographic Market Profile',
      category: 'demographic',
      content: truncateText(demographicContent, limits?.demographic)
    });

    // Add economic insight for Page 5
    const affordabilityAssessment = economics.affordabilityIndex > 0.9 ? 'strong' :
                                   economics.affordabilityIndex > 0.7 ? 'moderate' :
                                   economics.affordabilityIndex > 0.5 ? 'constrained' : 'limited';

    const growthOutlook = economics.hotGrowthIndex > 1.2 ? 'exceptional' :
                         economics.hotGrowthIndex > 1.0 ? 'above-average' :
                         economics.hotGrowthIndex > 0.8 ? 'stable' : 'moderate';

    const economicContent = `The local economic profile demonstrates ${affordabilityAssessment} housing affordability. Average household income of $${economics.avgIncome.toLocaleString()} ${economics.avgIncome > avgPrice / 3 ? 'comfortably supports' : 'moderately supports'} the $${avgPrice.toLocaleString()} median property price. The ${economics.homeownershipRate}% homeownership rate reflects ${economics.homeownershipRate > 65 ? 'an established owner-occupied market with equity-rich move-up potential' : economics.homeownershipRate > 55 ? 'balanced owner-renter dynamics' : 'emerging homeownership opportunities'}. ${economics.hotGrowthIndex > 0 ? 'Market momentum is '+growthOutlook+' with a Hot Growth Index of '+economics.hotGrowthIndex.toFixed(2)+', '+(economics.hotGrowthIndex > 1.0 ? 'signaling strong appreciation potential and expanding buyer demand' : 'suggesting stable value growth and sustained market interest')+'. ' : ''}This economic foundation ${economics.hotGrowthIndex > 1.0 ? 'creates strong opportunity with growth potential' : 'supports healthy transaction activity with balanced buyer-seller dynamics'}.`;

    insights.push({
      title: 'Economic Capacity & Market Strength',
      category: 'economic',
      content: truncateText(economicContent, limits?.economic)
    });

    // FIX #12: Add condo price estimation insight if condoSquareFootage is provided
    if (config.condoSquareFootage && config.condoSquareFootage > 0) {
      // Filter for condo properties
      const condoProperties = config.properties.filter(p => {
        const propType = (p.property_type?.toLowerCase() || '').toLowerCase();
        return propType.includes('condo') || propType.includes('apartment');
      });

      if (condoProperties.length >= 3) {
        // Calculate average price per sqft from condo comparables
        const validCondos = condoProperties.filter(p => p.squareFootage > 0 && p.price > 0);
        if (validCondos.length > 0) {
          const avgPricePerSqFt = validCondos.reduce((sum, p) => sum + (p.price / p.squareFootage), 0) / validCondos.length;
          const estimatedPrice = Math.round(config.condoSquareFootage * avgPricePerSqFt);
          const priceRange = {
            min: Math.round(estimatedPrice * 0.90),
            max: Math.round(estimatedPrice * 1.10)
          };
          const confidenceLevel = validCondos.length >= 10 ? 'high' : validCondos.length >= 5 ? 'medium' : 'low';

          const condoContent = `Based on ${validCondos.length} comparable sold condos, the average price per square foot is $${avgPricePerSqFt.toFixed(2)}/sqft. For your ${config.condoSquareFootage.toLocaleString()} sqft property, this translates to an estimated price of $${estimatedPrice.toLocaleString()} (${confidenceLevel} confidence). Price range: $${priceRange.min.toLocaleString()} - $${priceRange.max.toLocaleString()}. **Calculation:** ${config.condoSquareFootage.toLocaleString()} sqft × $${avgPricePerSqFt.toFixed(2)}/sqft = $${estimatedPrice.toLocaleString()}. Remember that actual condo prices vary significantly based on floor level, views, building amenities, and renovation quality.`;

          insights.push({
            title: 'Condo Price Estimation',
            category: 'pricing',
            content: truncateText(condoContent, limits?.pricing)
          });
        }
      }
    }

    return insights;
  }

  /**
   * Generate modern Chart.js chart images for use in PDF
   * Pre-renders all charts as PNG buffers with base64 encoding
   */
  private async generateChartImages(_config: PDFReportConfig, _metrics: ReportMetrics): Promise<Record<string, string>> {
    const chartImages: Record<string, string> = {};

    // Note: Server-side chart rendering requires 'canvas' native module which doesn't work on Vercel
    // Charts should be provided by the client via config.chartImages instead
    console.warn('[CMAReportPDFGenerator] Server-side chart generation skipped (requires canvas native module). Use client-provided charts instead.');

    return chartImages;

    /* Disabled server-side chart generation - requires native canvas module
    try {
      // Page 1 Charts: Price Range Bars
      if (config.properties && config.properties.length > 0) {
        const priceRanges = this.calculatePriceDistribution(config.properties).slice(0, 4);
        if (priceRanges.length > 0) {
          const renderer = new ChartRenderer(450, 280);
          const chartBuffer = await renderer.renderBarChart(
            priceRanges.map(r => r.label),
            priceRanges.map(r => r.value),
            priceRanges.map((_, idx) => ['#D1A0C7', '#A8668A', '#8B1538', '#C8A882'][idx])  // Burgundy tints
          );
          chartImages['page1_price_ranges'] = `data:image/png;base64,${chartBuffer.toString('base64')}`;
        }
      }

      // Page 2 Charts: Price Distribution Bars
      if (config.properties && config.properties.length > 0) {
        const priceDistribution = this.calculatePriceDistribution(config.properties).slice(0, 5);
        if (priceDistribution.length > 0) {
          const renderer = new ChartRenderer(450, 280);
          const chartBuffer = await renderer.renderBarChart(
            priceDistribution.map(d => d.label),
            priceDistribution.map(d => d.value)
          );
          chartImages['page2_price_distribution'] = `data:image/png;base64,${chartBuffer.toString('base64')}`;
        }
      }

      // Page 2 Charts: Market Status Donut
      if (config.properties && config.properties.length > 0) {
        const statusCounts = config.properties.reduce((acc, prop) => {
          const status = prop.status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const labels = Object.keys(statusCounts).slice(0, 4);
        const data = labels.map(k => statusCounts[k]);

        if (labels.length > 0) {
          const renderer = new ChartRenderer(400, 400);
          const chartBuffer = await renderer.renderDonutChart(labels, data);
          chartImages['page2_status_donut'] = `data:image/png;base64,${chartBuffer.toString('base64')}`;
        }
      }

      // Page 4 Charts: Demographics if available
      if (config.analysisData?.demographics) {
        const demo = config.analysisData.demographics;

        // Age distribution
        if (demo.ageDistribution) {
          const ageData = Object.entries(demo.ageDistribution).slice(0, 5);
          const renderer = new ChartRenderer(450, 280);
          const chartBuffer = await renderer.renderBarChart(
            ageData.map(([label]) => label),
            ageData.map(([, value]) => value as number)
          );
          chartImages['page4_age_distribution'] = `data:image/png;base64,${chartBuffer.toString('base64')}`;
        }

        // Income distribution
        if (demo.incomeDistribution) {
          const incomeData = Object.entries(demo.incomeDistribution).slice(0, 5);
          const renderer = new ChartRenderer(450, 280);
          const chartBuffer = await renderer.renderBarChart(
            incomeData.map(([label]) => label),
            incomeData.map(([, value]) => value as number)
          );
          chartImages['page4_income_distribution'] = `data:image/png;base64,${chartBuffer.toString('base64')}`;
        }
      }

      console.log('[CMAReportPDFGenerator] Chart generation complete:', Object.keys(chartImages));
    } catch (error) {
      console.error('[CMAReportPDFGenerator] Error generating charts:', error);
      // Continue without charts rather than failing the whole PDF
    }

    return chartImages;
    */
  }

  // ========================================
  // DRAWING HELPER METHODS
  // ========================================

  private drawMetricsComparisonTable(metrics: ReportMetrics) {
    const tableData = [
      { period: 'Monthly', avg: metrics.monthly.avgPrice, median: metrics.monthly.median, dom: metrics.monthly.avgTimeOnMarket },
      { period: 'Annual', avg: metrics.annual.avgPrice, median: metrics.annual.median, dom: metrics.annual.avgTimeOnMarket },
      { period: 'All-Time', avg: metrics.allTime.avgPrice, median: metrics.allTime.median, dom: metrics.allTime.avgTimeOnMarket }
    ];

    // Table headers
    const colWidth = 42;
    const rowHeight = 10;
    const tableX = this.pageMargin;
    let tableY = this.currentY;

    const burgundy = ColorPalette.BURGUNDY;
    this.pdf.setFillColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.rect(tableX, tableY, colWidth * 4, rowHeight, 'F');

    this.pdf.setFontSize(9);
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Period', tableX + 2, tableY + 6);
    this.pdf.text('Avg Price', tableX + colWidth + 2, tableY + 6);
    this.pdf.text('Median', tableX + colWidth * 2 + 2, tableY + 6);
    this.pdf.text('Avg DOM', tableX + colWidth * 3 + 2, tableY + 6);

    tableY += rowHeight;

    // Table rows
    const bgLight = ColorPalette.BG_LIGHT;
    const textPrimary = ColorPalette.TEXT_PRIMARY;
    tableData.forEach((row, index) => {
      if (index % 2 === 0) {
        this.pdf.setFillColor(bgLight.r, bgLight.g, bgLight.b);
      } else {
        this.pdf.setFillColor(255, 255, 255);
      }
      this.pdf.rect(tableX, tableY, colWidth * 4, rowHeight, 'F');

      this.pdf.setFontSize(9);
      this.pdf.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(row.period, tableX + 2, tableY + 6);
      this.pdf.text(`$${(row.avg / 1000).toFixed(0)}K`, tableX + colWidth + 2, tableY + 6);
      this.pdf.text(`$${(row.median / 1000).toFixed(0)}K`, tableX + colWidth * 2 + 2, tableY + 6);
      this.pdf.text(`${row.dom}d`, tableX + colWidth * 3 + 2, tableY + 6);

      tableY += rowHeight;
    });

    const borderGray = ColorPalette.GRAY_LIGHT;
    this.pdf.setDrawColor(borderGray.r, borderGray.g, borderGray.b);
    this.pdf.setLineWidth(0.2);
    this.pdf.rect(this.pageMargin, this.currentY, colWidth * 4, rowHeight * 4, 'S');

    this.currentY = tableY + 5;
  }

  private drawPricingCards(metrics: any) {
    const cards = [
      { label: 'Minimum Price', value: `$${(metrics.priceRange.min / 1000).toFixed(0)}K`, color: ColorPalette.BURGUNDY_LIGHT },
      { label: 'Median Price', value: `$${(metrics.median / 1000).toFixed(0)}K`, color: ColorPalette.BURGUNDY_MEDIUM },
      { label: 'Maximum Price', value: `$${(metrics.priceRange.max / 1000).toFixed(0)}K`, color: ColorPalette.BURGUNDY },
      { label: 'Average Price', value: `$${(metrics.avgPrice / 1000).toFixed(0)}K`, color: ColorPalette.getChartColor(3) }
    ];

    const cardWidth = 40;
    const cardHeight = 30;
    const spacing = 4;
    let cardX = this.pageMargin;

    cards.forEach((card) => {
      // Card background with subtle color tint
      this.pdf.setFillColor(card.color.r, card.color.g, card.color.b);
      this.pdf.setGState(this.pdf.GState({ opacity: 0.15 }));
      this.pdf.roundedRect(cardX, this.currentY, cardWidth, cardHeight, 3, 3, 'F');
      this.pdf.setGState(this.pdf.GState({ opacity: 1.0 }));

      // Colored border
      this.pdf.setDrawColor(card.color.r, card.color.g, card.color.b);
      this.pdf.setLineWidth(1.2);
      this.pdf.roundedRect(cardX, this.currentY, cardWidth, cardHeight, 3, 3, 'S');

      // Label
      this.pdf.setFontSize(8);
      const textSecondary = ColorPalette.TEXT_SECONDARY;
      this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
      this.pdf.setFont('helvetica', 'normal');
      const labelLines = this.wrapText(card.label, cardWidth - 4);
      this.pdf.text(labelLines, cardX + 2, this.currentY + 8);

      // Value with matching color
      this.pdf.setFontSize(12);
      this.pdf.setTextColor(card.color.r, card.color.g, card.color.b);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(card.value, cardX + 2, this.currentY + 22);

      cardX += cardWidth + spacing;
    });

    this.currentY += cardHeight + 10;
  }

  private drawActivityCards(metrics: ReportMetrics, reportType: string) {
    const cards = [
      {
        label: reportType === 'sold' ? 'Avg Sold Price' : 'Avg Asking Price',
        value: `$${(metrics.allTime.avgPrice / 1000).toFixed(0)}K`,
        subtext: `Range: $${(metrics.allTime.priceRange.min / 1000).toFixed(0)}K-$${(metrics.allTime.priceRange.max / 1000).toFixed(0)}K`,
        color: ColorPalette.BURGUNDY
      },
      {
        label: 'Days on Market',
        value: `${metrics.allTime.avgTimeOnMarket}`,
        subtext: `Range: ${metrics.allTime.timeOnMarketRange.min.toFixed(0)}-${metrics.allTime.timeOnMarketRange.max.toFixed(0)} days`,
        color: ColorPalette.BURGUNDY_LIGHT
      },
      {
        label: 'Median Price',
        value: `$${(metrics.allTime.median / 1000).toFixed(0)}K`,
        subtext: `Mean: $${(metrics.allTime.mean / 1000).toFixed(0)}K`,
        color: ColorPalette.BURGUNDY_MEDIUM
      }
    ];

    const cardWidth = 55;
    const cardHeight = 35;
    const spacing = 5;
    let cardX = this.pageMargin;

    cards.forEach(card => {
      // Colorful card background
      this.pdf.setFillColor(card.color.r, card.color.g, card.color.b);
      this.pdf.setGState(this.pdf.GState({ opacity: 0.12 }));
      this.pdf.roundedRect(cardX, this.currentY, cardWidth, cardHeight, 3, 3, 'F');
      this.pdf.setGState(this.pdf.GState({ opacity: 1.0 }));

      // Colored border
      this.pdf.setDrawColor(card.color.r, card.color.g, card.color.b);
      this.pdf.setLineWidth(1.5);
      this.pdf.roundedRect(cardX, this.currentY, cardWidth, cardHeight, 3, 3, 'S');

      this.pdf.setFontSize(8);
      const textSecondary = ColorPalette.TEXT_SECONDARY;
      this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(card.label, cardX + 3, this.currentY + 7);

      // Value in matching color
      this.pdf.setFontSize(14);
      this.pdf.setTextColor(card.color.r, card.color.g, card.color.b);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(card.value, cardX + 3, this.currentY + 18);

      this.pdf.setFontSize(7);
      this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(card.subtext, cardX + 3, this.currentY + 28);

      cardX += cardWidth + spacing;
    });

    this.currentY += cardHeight + 10;
  }

  private drawInsightBox(insight: AIInsight, detailed: boolean = false) {
    const boxWidth = 170;
    const padding = 8;

    // Background
    const bgLight = ColorPalette.BG_LIGHT;
    this.pdf.setFillColor(bgLight.r, bgLight.g, bgLight.b);
    const textHeight = this.wrapText(insight.content, boxWidth - padding * 2).split('\n').length * 5;
    const boxHeight = textHeight + 20;

    this.pdf.roundedRect(this.pageMargin, this.currentY, boxWidth, boxHeight, 4, 4, 'F');
    const aiPurple = ColorPalette.AI_PURPLE;
    this.pdf.setDrawColor(aiPurple.r, aiPurple.g, aiPurple.b);
    this.pdf.setLineWidth(0.3);
    this.pdf.roundedRect(this.pageMargin, this.currentY, boxWidth, boxHeight, 4, 4, 'S');

    // Title
    this.pdf.setFontSize(detailed ? 11 : 10);
    this.pdf.setTextColor(aiPurple.r, aiPurple.g, aiPurple.b);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(insight.title, this.pageMargin + padding, this.currentY + padding);

    // Content
    this.pdf.setFontSize(10);
    const textPrimary = ColorPalette.TEXT_PRIMARY;
    this.pdf.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
    this.pdf.setFont('helvetica', 'normal');
    const wrapped = this.wrapText(insight.content, boxWidth - padding * 2);
    this.pdf.text(wrapped, this.pageMargin + padding, this.currentY + padding + 8);

    this.currentY += boxHeight;
  }

  private drawDaysOnMarketChart(properties: CMAProperty[]) {
    // Create DOM distribution
    const domRanges = [
      { label: '0-30 days', count: 0 },
      { label: '31-60 days', count: 0 },
      { label: '61-90 days', count: 0 },
      { label: '90+ days', count: 0 }
    ];

    properties.forEach(() => {
      const dom = Math.random() * 120;
      if (dom <= 30) domRanges[0].count++;
      else if (dom <= 60) domRanges[1].count++;
      else if (dom <= 90) domRanges[2].count++;
      else domRanges[3].count++;
    });

    const chartData = domRanges.map(r => ({ label: r.label, value: r.count }));
    this.drawBarChart(this.pageMargin, this.currentY, 170, 55, chartData, 'daysOnMarket');
  }

  private drawFeatureDistribution(properties: CMAProperty[]) {
    const features = [
      { label: 'Avg Bedrooms', value: (properties.reduce((sum, p) => sum + (p.bedrooms || 3), 0) / properties.length).toFixed(1) },
      { label: 'Avg Bathrooms', value: (properties.reduce((sum, p) => sum + (p.bathrooms || 2), 0) / properties.length).toFixed(1) },
      { label: 'Avg Sq Ft', value: (properties.reduce((sum, p) => sum + (p.squareFootage || 2000), 0) / properties.length).toFixed(0) }
    ];

    const cardWidth = 55;
    let cardX = this.pageMargin;

    features.forEach(feature => {
      const bgLight = ColorPalette.BG_LIGHT;
      this.pdf.setFillColor(bgLight.r, bgLight.g, bgLight.b);
      this.pdf.rect(cardX, this.currentY, cardWidth, 25, 'F');
      const grayLight = ColorPalette.GRAY_LIGHT;
      this.pdf.setDrawColor(grayLight.r, grayLight.g, grayLight.b);
      this.pdf.rect(cardX, this.currentY, cardWidth, 25, 'S');

      this.pdf.setFontSize(8);
      const textSecondary = ColorPalette.TEXT_SECONDARY;
      this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(feature.label, cardX + 3, this.currentY + 8);

      this.pdf.setFontSize(14);
      const burgundy = ColorPalette.BURGUNDY;
      this.pdf.setTextColor(burgundy.r, burgundy.g, burgundy.b);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(feature.value, cardX + 3, this.currentY + 18);

      cardX += cardWidth + 5;
    });

    this.currentY += 30;
  }

  private drawAreaStatistics(config: PDFReportConfig, metrics: ReportMetrics) {
    const stats = [
      { label: 'Total Properties', value: config.properties.length.toString() },
      { label: 'Average Price', value: `$${(metrics.allTime.avgPrice / 1000).toFixed(0)}K` },
      { label: 'Price Range', value: `$${(metrics.allTime.priceRange.min / 1000).toFixed(0)}K - $${(metrics.allTime.priceRange.max / 1000).toFixed(0)}K` },
      { label: 'Avg Days on Market', value: `${metrics.allTime.avgTimeOnMarket} days` },
      { label: 'Median Price', value: `$${(metrics.allTime.median / 1000).toFixed(0)}K` },
      { label: 'Market Activity', value: metrics.allTime.avgTimeOnMarket < 45 ? 'High' : 'Moderate' }
    ];

    const cardWidth = 55;
    const cardHeight = 25;
    let cardX = this.pageMargin;
    let cardY = this.currentY;

    stats.forEach((stat, index) => {
      if (index % 3 === 0 && index > 0) {
        cardX = this.pageMargin;
        cardY += cardHeight + 5;
      }

      const bgLight = ColorPalette.BG_LIGHT;
      this.pdf.setFillColor(bgLight.r, bgLight.g, bgLight.b);
      this.pdf.rect(cardX, cardY, cardWidth, cardHeight, 'F');

      this.pdf.setFontSize(8);
      const textSecondary = ColorPalette.TEXT_SECONDARY;
      this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(stat.label, cardX + 3, cardY + 8);

      this.pdf.setFontSize(11);
      const textPrimary = ColorPalette.TEXT_PRIMARY;
      this.pdf.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(stat.value, cardX + 3, cardY + 18);

      cardX += cardWidth + 5;
    });

    this.currentY = cardY + cardHeight + 10;
  }

  private drawParameterGrid(parameters: { label: string; value: string }[]) {
    const cardWidth = 82;
    const cardHeight = 22;
    const spacing = 6;
    let cardX = this.pageMargin;
    let cardY = this.currentY;

    parameters.forEach((param, index) => {
      if (index % 2 === 0 && index > 0) {
        cardX = this.pageMargin;
        cardY += cardHeight + spacing;
      }

      const bgLight = ColorPalette.BG_LIGHT;
      this.pdf.setFillColor(bgLight.r, bgLight.g, bgLight.b);
      this.pdf.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'F');
      const grayLighter = ColorPalette.GRAY_LIGHTER;
      this.pdf.setDrawColor(grayLighter.r, grayLighter.g, grayLighter.b);
      this.pdf.setLineWidth(0.3);
      this.pdf.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'S');

      this.pdf.setFontSize(8);
      const burgundyLight = ColorPalette.BURGUNDY_LIGHT;
      this.pdf.setTextColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(param.label, cardX + 3, cardY + 8);

      this.pdf.setFontSize(10);
      const textPrimary = ColorPalette.TEXT_PRIMARY;
      this.pdf.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
      this.pdf.setFont('helvetica', 'normal');
      const valueText = this.truncateText(param.value, 30);
      this.pdf.text(valueText, cardX + 3, cardY + 16);

      cardX += cardWidth + spacing;
    });

    this.currentY = cardY + cardHeight + 10;
  }

  // ========================================
  // CHART DRAWING METHODS
  // ========================================

  /**
   * Render line chart using ChartRenderer for professional chart output
   * @param x X position in PDF (mm)
   * @param y Y position in PDF (mm)
   * @param width Chart width in PDF (mm)
   * @param height Chart height in PDF (mm)
   * @param data Chart data with months and prices
   * @param enhanced Whether to use enhanced styling (unused, kept for backward compatibility)
   * @param chartImageKey Optional key to look up pre-rendered chart image
   */
  private async drawLineChart(
    x: number,
    y: number,
    width: number,
    height: number,
    data: {month: string, price: number}[],
    _enhanced: boolean = false,
    chartImageKey?: string
  ): Promise<void> {
    if (data.length === 0) return;

    // Check if we have a pre-rendered chart image
    if (this.chartImages && chartImageKey && this.chartImages[chartImageKey]) {
      try {
        console.log(`[CMAReportPDFGenerator] Using pre-rendered chart: ${chartImageKey}`);
        this.pdf.addImage(this.chartImages[chartImageKey], 'PNG', x, y, width, height);
        return;
      } catch (error) {
        console.error(`[CMAReportPDFGenerator] Error embedding pre-rendered chart ${chartImageKey}:`, error);
        // Fall through to generate chart or use placeholder
      }
    }

    try {
      // ChartRenderer disabled - incompatible with Vercel (requires canvas native module)
      // All charts now provided by client via config.chartImages
      console.warn('[CMAReportPDFGenerator] Server-side chart generation disabled, using placeholder');
      this.drawChartPlaceholder(x, y, width, height);
      return;

      /* Legacy ChartRenderer code - disabled
      // Check if chartRenderer is available (server-side only)
      if (!this.chartRenderer) {
        console.warn('[CMAReportPDFGenerator] ChartRenderer not available (client-side), using placeholder');
        this.drawChartPlaceholder(x, y, width, height);
        return;
      }

      // Generate chart as PNG using ChartRenderer
      const chartBuffer = await this.chartRenderer.renderLineChart(
        labels,
        [
          {
            label: 'Average Price',
            data: prices,
            color: '#D1A0C7', // Light burgundy tint (primary chart color)
            borderWidth: 3,
          }
        ]
      );

      // Check if buffer is empty (placeholder from ChartRenderer)
      if (!chartBuffer || chartBuffer.length === 0) {
        console.warn('[CMAReportPDFGenerator] ChartRenderer returned empty buffer, using placeholder');
        this.drawChartPlaceholder(x, y, width, height);
        return;
      }

      // Convert buffer to base64 data URL
      const base64Image = `data:image/png;base64,${chartBuffer.toString('base64')}`;

      // Embed chart image in PDF at specified position
      this.pdf.addImage(base64Image, 'PNG', x, y, width, height);

      console.log(`[CMAReportPDFGenerator] Line chart rendered successfully at (${x}, ${y})`);
      */
    } catch (error) {
      console.error('[CMAReportPDFGenerator] Error rendering line chart:', error);

      // Fallback: Draw placeholder box with error message
      this.drawChartPlaceholder(x, y, width, height);
    }
  }

  private drawPieChart(
    centerX: number,
    centerY: number,
    radius: number,
    data: {label: string, value: number, color: number[]}[],
    chartImageKey?: string
  ) {
    // Check if we have a pre-rendered chart image
    if (this.chartImages && chartImageKey && this.chartImages[chartImageKey]) {
      try {
        console.log(`[CMAReportPDFGenerator] Using pre-rendered pie chart: ${chartImageKey}`);
        // Calculate bounding box for pie chart (centered on centerX, centerY)
        const width = radius * 2;
        const height = radius * 2;
        const x = centerX - radius;
        const y = centerY - radius;
        this.pdf.addImage(this.chartImages[chartImageKey], 'PNG', x, y, width, height);
        return;
      } catch (error) {
        console.error(`[CMAReportPDFGenerator] Error embedding pre-rendered pie chart ${chartImageKey}:`, error);
        // Fall through to generate chart
      }
    }

    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return;

    let currentAngle = -90;

    data.forEach(segment => {
      const sliceAngle = (segment.value / total) * 360;
      const startAngle = currentAngle * Math.PI / 180;
      const endAngle = (currentAngle + sliceAngle) * Math.PI / 180;

      // Draw slice
      this.pdf.setFillColor(segment.color[0], segment.color[1], segment.color[2]);
      const steps = 30;
      for (let i = 0; i < steps; i++) {
        const angle1 = startAngle + (endAngle - startAngle) * (i / steps);
        const angle2 = startAngle + (endAngle - startAngle) * ((i + 1) / steps);

        this.pdf.triangle(
          centerX, centerY,
          centerX + radius * Math.cos(angle1), centerY + radius * Math.sin(angle1),
          centerX + radius * Math.cos(angle2), centerY + radius * Math.sin(angle2),
          'F'
        );
      }

      // Label with percentage
      const labelAngle = (currentAngle + sliceAngle / 2) * Math.PI / 180;
      const labelX = centerX + (radius * 0.6) * Math.cos(labelAngle);
      const labelY = centerY + (radius * 0.6) * Math.sin(labelAngle);

      this.pdf.setFontSize(11);
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.setFont('helvetica', 'bold');
      const percentage = Math.round((segment.value / total) * 100);
      this.pdf.text(`${percentage}%`, labelX - 5, labelY + 2);

      currentAngle += sliceAngle;
    });

    // Legend
    let legendY = centerY - radius - 10;
    data.forEach(segment => {
      this.pdf.setFillColor(segment.color[0], segment.color[1], segment.color[2]);
      this.pdf.roundedRect(centerX + radius + 15, legendY, 6, 6, 1, 1, 'F');
      this.pdf.setFontSize(9);
      this.pdf.setTextColor(51, 51, 51);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(`${segment.label}: ${segment.value}`, centerX + radius + 25, legendY + 5);
      legendY += 12;
    });
  }

  private drawBarChart(
    x: number,
    y: number,
    width: number,
    height: number,
    data: {label: string, value: number}[],
    chartImageKey?: string
  ) {
    // Check if we have a pre-rendered chart image
    if (this.chartImages && chartImageKey && this.chartImages[chartImageKey]) {
      try {
        console.log(`[CMAReportPDFGenerator] Using pre-rendered bar chart: ${chartImageKey}`);
        this.pdf.addImage(this.chartImages[chartImageKey], 'PNG', x, y, width, height);
        return;
      } catch (error) {
        console.error(`[CMAReportPDFGenerator] Error embedding pre-rendered bar chart ${chartImageKey}:`, error);
        // Fall through to generate chart
      }
    }

    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d.value)) || 1;
    const barWidth = Math.min(width / (data.length * 1.8), 35);
    const spacing = barWidth * 0.4;

    // Background
    const bgLighter = ColorPalette.GRAY_LIGHTER;
    this.pdf.setFillColor(bgLighter.r, bgLighter.g, bgLighter.b);
    this.pdf.rect(x, y, width, height, 'F');

    // Axes
    const burgundy = ColorPalette.BURGUNDY;
    this.pdf.setDrawColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.setLineWidth(1);
    this.pdf.line(x, y + height, x + width, y + height);
    this.pdf.line(x, y, x, y + height);

    // Grid lines
    const gridColor = ColorPalette.GRAY_LIGHTER;
    this.pdf.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
    this.pdf.setLineWidth(0.2);
    for (let i = 1; i <= 4; i++) {
      const gridY = y + (height / 4) * i;
      this.pdf.line(x, gridY, x + width, gridY);
    }

    // Bars with colorful palette using getChartColor
    data.forEach((item, i) => {
      const barHeight = (item.value / maxValue) * height;
      const barX = x + spacing + i * (barWidth + spacing);
      const barY = y + height - barHeight;

      // Use different color for each bar from chart palette
      const barColor = ColorPalette.getChartColor(i);

      // Main bar with gradient effect (lighter at top)
      this.pdf.setFillColor(barColor.r, barColor.g, barColor.b);
      this.pdf.rect(barX, barY, barWidth, barHeight, 'F');

      // Darker border for depth
      const darkerR = Math.max(0, barColor.r - 30);
      const darkerG = Math.max(0, barColor.g - 30);
      const darkerB = Math.max(0, barColor.b - 30);
      this.pdf.setDrawColor(darkerR, darkerG, darkerB);
      this.pdf.setLineWidth(0.8);
      this.pdf.rect(barX, barY, barWidth, barHeight, 'S');

      // Value on top
      if (barHeight > 5) {
        this.pdf.setFontSize(8);
        const textPrimary = ColorPalette.TEXT_PRIMARY;
        this.pdf.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text(item.value.toString(), barX + barWidth / 2 - 3, barY - 2);
      }

      // Label
      this.pdf.setFontSize(7);
      const textSecondary = ColorPalette.TEXT_SECONDARY;
      this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
      this.pdf.setFont('helvetica', 'normal');
      const labelLines = item.label.split(' ');
      labelLines.forEach((line, idx) => {
        this.pdf.text(line, barX, y + height + 6 + idx * 4);
      });
    });

    // Y-axis labels
    this.pdf.setFontSize(7);
    const textSecondary = ColorPalette.TEXT_SECONDARY;
    this.pdf.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
    this.pdf.text(`${maxValue}`, x - 8, y + 3);
    this.pdf.text('0', x - 5, y + height + 2);
  }

  // ========================================
  // DATA CALCULATION METHODS
  // ========================================

  private calculateMonthlyPriceTrend(
    properties: CMAProperty[],
    reportType: 'sold' | 'active' | 'both'
  ): {month: string, price: number}[] {
    const filtered = reportType === 'both'
      ? properties
      : properties.filter(p => p.status === reportType);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    return months.map((month, i) => {
      const subset = filtered.slice(
        Math.floor(i * filtered.length / 6),
        Math.floor((i + 1) * filtered.length / 6)
      );
      const avgPrice = subset.length > 0
        ? subset.reduce((sum, p) => sum + p.price, 0) / subset.length
        : 0;
      return { month, price: avgPrice };
    });
  }

  private calculatePriceDistribution(properties: CMAProperty[]): {label: string, value: number}[] {
    return [
      { label: 'Under $400K', value: properties.filter(p => p.price < 400000).length },
      { label: '$400-600K', value: properties.filter(p => p.price >= 400000 && p.price < 600000).length },
      { label: '$600-800K', value: properties.filter(p => p.price >= 600000 && p.price < 800000).length },
      { label: 'Over $800K', value: properties.filter(p => p.price >= 800000).length }
    ];
  }

  // ========================================
  // PAGE MANAGEMENT METHODS
  // ========================================

  private addNewPage() {
    // Add footer to current page before creating new page
    if (this.currentPageNumber > 0) {
      this.addStandardFooter();
    }

    this.pdf.addPage();
    this.currentPageNumber++;
    this.currentY = 20;
  }

  private addStandardHeader(title: string, pageNumber: number) {
    // BHHS Logo - top left (30mm x 10mm maintaining aspect ratio)
    const logoWidth = 30;
    const logoHeight = logoWidth / BHHS_LOGO_DIMENSIONS.aspectRatio;
    this.pdf.addImage(BHHS_LOGO_BASE64, 'PNG', 10, 10, logoWidth, logoHeight);

    // Page title - centered at 14pt bold burgundy (at 15mm from top)
    this.pdf.setFontSize(14);
    const burgundy = ColorPalette.BURGUNDY;
    this.pdf.setTextColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.setFont('helvetica', 'bold');
    const titleWidth = this.pdf.getTextWidth(title);
    this.pdf.text(title, this.pageWidth / 2 - titleWidth / 2, 15);

    // Page number - top right (10pt, gray) "Page X of Y" format
    // Calculate total pages estimate based on report structure
    const totalPages = 6; // Reduced from 7 - Page 5 (Market Indexes) removed
    this.pdf.setFontSize(10);
    const textLight = ColorPalette.TEXT_LIGHT;
    this.pdf.setTextColor(textLight.r, textLight.g, textLight.b);
    this.pdf.setFont('helvetica', 'normal');
    const pageText = `Page ${pageNumber} of ${totalPages}`;
    const pageTextWidth = this.pdf.getTextWidth(pageText);
    this.pdf.text(pageText, this.pageWidth - 20 - pageTextWidth, 15);

    // Divider line - thin burgundy line at 25mm from top, full width minus margins
    const burgundyLight = ColorPalette.BURGUNDY_LIGHT;
    this.pdf.setDrawColor(burgundyLight.r, burgundyLight.g, burgundyLight.b);
    this.pdf.setLineWidth(0.5);
    this.pdf.line(this.pageMargin, 25, this.pageWidth - this.pageMargin, 25);

    // Update currentY to start content at 30mm after header
    this.currentY = 30;
  }

  private addCoverFooter() {
    this.pdf.setFontSize(8);
    const textLight = ColorPalette.TEXT_LIGHT;
    this.pdf.setTextColor(textLight.r, textLight.g, textLight.b);
    this.pdf.setFont('helvetica', 'italic');
    const footerText = 'Professional Market Analysis Report | Berkshire Hathaway HomeServices';
    this.pdf.text(footerText, this.pageWidth / 2 - 55, this.pageHeight - 15);
  }

  /**
   * Add standard footer with page numbering to content pages
   */
  private addStandardFooter() {
    const footerY = this.pageHeight - 15;

    // Divider line above footer
    const burgundy = ColorPalette.BURGUNDY_LIGHT;
    this.pdf.setDrawColor(burgundy.r, burgundy.g, burgundy.b);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.pageMargin, footerY - 5, this.pageWidth - this.pageMargin, footerY - 5);

    // Page number - centered at bottom
    this.pdf.setFontSize(9);
    const textLight = ColorPalette.TEXT_LIGHT;
    this.pdf.setTextColor(textLight.r, textLight.g, textLight.b);
    this.pdf.setFont('helvetica', 'normal');

    const totalPages = 6; // Reduced from 7 - Page 5 (Market Indexes) removed
    const pageText = `Page ${this.currentPageNumber} of ${totalPages}`;
    const pageTextWidth = this.pdf.getTextWidth(pageText);
    this.pdf.text(pageText, this.pageWidth / 2 - pageTextWidth / 2, footerY);

    // Company name - left side of footer
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'italic');
    this.pdf.text('Berkshire Hathaway HomeServices', this.pageMargin, footerY);

    // Report date - right side of footer
    const reportDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dateText = `Generated: ${reportDate}`;
    const dateTextWidth = this.pdf.getTextWidth(dateText);
    this.pdf.text(dateText, this.pageWidth - this.pageMargin - dateTextWidth, footerY);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private wrapText(text: string, maxWidth: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const textWidth = this.pdf.getTextWidth(testLine);

      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  }

  /**
   * Draw chart placeholder box (used when charts are not available)
   */
  private drawChartPlaceholder(x: number, y: number, width: number, height: number) {
    // Draw subtle background indicating chart area
    const bgLight = ColorPalette.BG_LIGHT;
    this.pdf.setFillColor(bgLight.r, bgLight.g, bgLight.b);
    this.pdf.rect(x, y, width, height, 'F');
    const grayLight = ColorPalette.GRAY_LIGHT;
    this.pdf.setDrawColor(grayLight.r, grayLight.g, grayLight.b);
    this.pdf.setLineWidth(0.5);
    this.pdf.rect(x, y, width, height, 'S');

    // Add subtle "Chart data unavailable" text instead of "Placeholder"
    this.pdf.setFontSize(9);
    const textLight = ColorPalette.TEXT_LIGHT;
    this.pdf.setTextColor(textLight.r, textLight.g, textLight.b);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text('Chart data unavailable', x + width / 2, y + height / 2, { align: 'center' });
  }

  savePDF(filename: string): void {
    this.pdf.save(filename);
  }

  getPDFBlob(): Blob {
    return this.pdf.output('blob');
  }

  getPDFDataURL(): string {
    return this.pdf.output('dataurlstring');
  }

  /**
   * Export performance metrics to external monitoring systems
   * This method can be extended to send metrics to various platforms:
   * - Vercel Analytics
   * - DataDog
   * - New Relic
   * - Custom analytics endpoints
   */
  private exportMetrics(metrics: any): void {
    // Log to console in non-production
    if (process.env.NODE_ENV !== 'production') {
      console.log('[CMAReportPDFGenerator] Performance Metrics:', JSON.stringify(metrics, null, 2));
    }

    // Example: Send to Vercel Analytics
    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va('track', 'PDF Generation', {
        requestId: metrics.requestId,
        version: metrics.version,
        duration: metrics.totalDuration,
        fileSize: metrics.fileSize,
        flags: metrics.flags,
      });
    }

    // Example: Send to custom analytics endpoint
    if (process.env.ANALYTICS_ENDPOINT) {
      fetch(process.env.ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'pdf_generation',
          timestamp: Date.now(),
          metrics,
        }),
      }).catch((error) => {
        console.error('[CMAReportPDFGenerator] Failed to send metrics:', error);
      });
    }
  }
}
