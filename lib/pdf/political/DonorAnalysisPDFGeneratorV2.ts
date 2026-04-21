/**
 * Donor Analysis PDF Generator V2
 *
 * Uses fixed-position template system for consistent layouts.
 * Generates 3-4 page fundraising intelligence reports.
 *
 * Pages:
 * 1. Fundraising Summary + Top ZIP Codes
 * 2. Donor Segments + Lapsed Donor Opportunity
 * 3. Geographic Opportunities + Time Trends
 * 4. Strategic Recommendations (optional)
 *
 * @version 2.0.0
 */

import jsPDF from 'jspdf';

import {
  PAGE_DIMENSIONS,
  MARGINS,
  CONTENT_AREA,
  COLUMN_LAYOUT,
  POLITICAL_COLORS,
  FONT_SPECS,
} from './templates/PoliticalPageTemplates';

import {
  renderStatCard,
} from './components/PoliticalKPICard';

import {
  PoliticalTemplateRenderer,
  createPoliticalRenderer,
} from './components/PoliticalTemplateRenderer';

import {
  hexToRgb as hexToRgbUtil,
  formatCurrency as formatCurrencyUtil,
  formatCompact as formatCompactUtil,
  formatDate,
  validateRequiredFields,
  logValidationWarnings,
} from './utils';

// ============================================================================
// Configuration Types (preserved from V1)
// ============================================================================

export interface ZipDonorData {
  zipCode: string;
  totalAmount: number;
  donorCount: number;
  avgDonation: number;
  maxDonation: number;
}

export interface DonorSegment {
  name: string;
  description: string;
  donorCount: number;
  totalAmount: number;
  avgDonation: number;
  percentOfTotal: number;
}

export interface LapsedDonor {
  segment: string;
  count: number;
  lastGaveTotal: number;
  recoveryPotential: number;
  suggestedAction: string;
}

export interface MonthlyTrend {
  month: string;
  amount: number;
  donorCount: number;
}

export interface DonorAnalysisConfig {
  reportTitle: string;
  analysisArea: string;
  dateRange: string;

  summary: {
    totalRaised: number;
    totalDonors: number;
    avgDonation: number;
    medianDonation: number;
    largestDonation: number;
    repeatDonorRate: number;
  };

  topZipCodes: ZipDonorData[];
  segments: DonorSegment[];
  lapsedDonors?: LapsedDonor[];

  geographicOpportunities?: Array<{
    zipCode: string;
    currentDonors: number;
    potentialDonors: number;
    untappedPotential: number;
    recommendation: string;
  }>;

  monthlyTrends?: MonthlyTrend[];
  recommendations?: string[];

  county: string;
  state: string;
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Fixed Position Templates
// ============================================================================

// Use POLITICAL_COLORS for consistency (donorPrimary, donorSecondary added)

const DONOR_PAGE1_TEMPLATE = {
  // Header bar
  headerBar: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 16 },
  headerTitle: { x: MARGINS.left + 5, y: 26, width: 100, height: 10 },
  headerDate: { x: 165, y: 26, width: 30, height: 10 },

  // Report info
  reportTitle: { x: MARGINS.left, y: 36, width: CONTENT_AREA.width, height: 8 },
  reportMeta: { x: MARGINS.left, y: 44, width: CONTENT_AREA.width, height: 5 },

  // Summary KPIs (4 in a row)
  summaryTitle: { x: MARGINS.left, y: 54, width: CONTENT_AREA.width, height: 5 },
  kpiRow1: { x: MARGINS.left, y: 62, cardWidth: 42, cardHeight: 26, gap: 4 },
  kpiRow2: { x: MARGINS.left, y: 92, width: CONTENT_AREA.width, height: 16 },

  // Top ZIP codes
  zipTitle: { x: MARGINS.left, y: 114, width: CONTENT_AREA.width, height: 5 },
  zipChart: { x: MARGINS.left, y: 122, width: CONTENT_AREA.width, height: 120 },
};

const DONOR_PAGE2_TEMPLATE = {
  pageHeader: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 10 },

  // Segments table
  segmentsTitle: { x: MARGINS.left, y: 30, width: CONTENT_AREA.width, height: 5 },
  segmentsTable: {
    x: MARGINS.left,
    y: 38,
    width: CONTENT_AREA.width,
    headerHeight: 8,
    rowHeight: 12,
    maxRows: 8,
  },

  // Lapsed donors
  lapsedTitle: { x: MARGINS.left, y: 145, width: CONTENT_AREA.width, height: 5 },
  lapsedBox: { x: MARGINS.left, y: 153, width: CONTENT_AREA.width, height: 90 },
};

const DONOR_PAGE3_TEMPLATE = {
  pageHeader: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 10 },

  // Geographic opportunities
  geoTitle: { x: MARGINS.left, y: 30, width: CONTENT_AREA.width, height: 5 },
  geoTable: {
    x: MARGINS.left,
    y: 38,
    width: CONTENT_AREA.width,
    headerHeight: 7,
    rowHeight: 8,
    maxRows: 8,
  },

  // Monthly trends
  trendsTitle: { x: MARGINS.left, y: 115, width: CONTENT_AREA.width, height: 5 },
  trendsChart: { x: MARGINS.left, y: 123, width: CONTENT_AREA.width, height: 60 },
};

const DONOR_PAGE4_TEMPLATE = {
  pageHeader: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 10 },
  recTitle: { x: MARGINS.left, y: 30, width: CONTENT_AREA.width, height: 5 },
  recBox: { x: MARGINS.left, y: 38, width: CONTENT_AREA.width, height: 180 },
};

// ============================================================================
// PDF Generator Class
// ============================================================================

export class DonorAnalysisPDFGeneratorV2 {
  private renderer: PoliticalTemplateRenderer;
  private pdf: jsPDF;
  private totalPages: number = 3;

  constructor() {
    this.renderer = createPoliticalRenderer();
    this.pdf = this.renderer.getPdf();
  }

  async generateReport(config: DonorAnalysisConfig): Promise<Blob> {
    console.log('[DonorAnalysisPDFGeneratorV2] Starting generation:', config.reportTitle);

    // Validate configuration
    const validation = validateRequiredFields(
      config as unknown as Record<string, unknown>,
      ['reportTitle', 'analysisArea', 'dateRange', 'summary', 'topZipCodes', 'segments', 'county', 'state'],
      'DonorAnalysisConfig'
    );
    logValidationWarnings(validation, 'DonorAnalysisPDFGeneratorV2');

    // Calculate total pages
    const hasRecommendations = config.recommendations?.length;
    this.totalPages = 3 + (hasRecommendations ? 1 : 0);

    // Page 1: Summary + Top ZIPs
    this.buildPage1(config);

    // Page 2: Segments + Lapsed
    this.pdf.addPage();
    this.buildPage2(config);

    // Page 3: Geographic + Trends
    this.pdf.addPage();
    this.buildPage3(config);

    // Page 4: Recommendations (optional)
    if (hasRecommendations) {
      this.pdf.addPage();
      this.buildPage4(config);
    }

    const pdfBlob = this.pdf.output('blob');
    console.log('[DonorAnalysisPDFGeneratorV2] Generation complete');
    return pdfBlob;
  }

  private buildPage1(config: DonorAnalysisConfig): void {
    const t = DONOR_PAGE1_TEMPLATE;

    // ========================================================================
    // Header Section
    // ========================================================================

    // Header bar (purple for donors)
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.donorPrimary));
    this.pdf.rect(t.headerBar.x, t.headerBar.y, t.headerBar.width, t.headerBar.height, 'F');

    // Title
    this.pdf.setFontSize(14);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text('DONOR ANALYSIS REPORT', t.headerTitle.x, t.headerTitle.y);

    // Date
    const reportDate = config.reportDate || formatDate(new Date());
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.text(reportDate, t.headerDate.x, t.headerDate.y);

    // Report title
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.setFontSize(12);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.text(config.reportTitle, t.reportTitle.x, t.reportTitle.y);

    // Metadata
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text(`${config.analysisArea} | ${config.dateRange}`, t.reportMeta.x, t.reportMeta.y);

    // ========================================================================
    // Summary KPIs
    // ========================================================================

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('FUNDRAISING SUMMARY', t.summaryTitle.x, t.summaryTitle.y);

    const kpi = t.kpiRow1;
    const m = config.summary;

    // Card 1: Total Raised
    renderStatCard(this.pdf, kpi.x, kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Total Raised',
      value: this.formatCurrency(m.totalRaised),
    });

    // Card 2: Total Donors
    renderStatCard(this.pdf, kpi.x + kpi.cardWidth + kpi.gap, kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Total Donors',
      value: m.totalDonors.toLocaleString(),
    });

    // Card 3: Avg Donation
    renderStatCard(this.pdf, kpi.x + 2 * (kpi.cardWidth + kpi.gap), kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Avg Donation',
      value: this.formatCurrency(m.avgDonation),
    });

    // Card 4: Repeat Rate
    renderStatCard(this.pdf, kpi.x + 3 * (kpi.cardWidth + kpi.gap), kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Repeat Rate',
      value: `${(m.repeatDonorRate * 100).toFixed(0)}%`,
    });

    // Secondary stats row
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.kpiRow2.x, t.kpiRow2.y, t.kpiRow2.width, t.kpiRow2.height, 'F');

    const smallMetrics = [
      { label: 'Median Donation', value: this.formatCurrency(m.medianDonation) },
      { label: 'Largest Gift', value: this.formatCurrency(m.largestDonation) },
    ];

    const smallWidth = t.kpiRow2.width / 2;
    smallMetrics.forEach((metric, i) => {
      const x = t.kpiRow2.x + i * smallWidth + 5;
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text(metric.label, x, t.kpiRow2.y + 5);
      this.pdf.setFontSize(11);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(metric.value, x, t.kpiRow2.y + 12);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
    });

    // ========================================================================
    // Top ZIP Codes
    // ========================================================================

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('TOP ZIP CODES BY TOTAL RAISED', t.zipTitle.x, t.zipTitle.y);

    // Find max for scaling
    const maxAmount = Math.max(...config.topZipCodes.map(z => z.totalAmount));
    const barMaxWidth = t.zipChart.width - 60;

    const displayZips = config.topZipCodes.slice(0, 10);
    displayZips.forEach((zip, i) => {
      const barWidth = (zip.totalAmount / maxAmount) * barMaxWidth;
      const barY = t.zipChart.y + i * 10;

      // Background
      if (i % 2 === 0) {
        this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
        this.pdf.rect(t.zipChart.x, barY - 2, t.zipChart.width, 10, 'F');
      }

      // ZIP code
      this.pdf.setFontSize(8);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(zip.zipCode, t.zipChart.x + 3, barY + 4);

      // Bar
      const color = i < 3 ? POLITICAL_COLORS.donorPrimary : POLITICAL_COLORS.donorSecondary;
      this.pdf.setFillColor(...this.hexToRgb(color));
      this.pdf.rect(t.zipChart.x + 25, barY, barWidth, 6, 'F');

      // Amount
      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(71, 85, 105);
      this.pdf.text(this.formatCurrency(zip.totalAmount), t.zipChart.x + 30 + barWidth, barY + 4);

      // Donor count
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textMuted));
      this.pdf.text(`${zip.donorCount} donors`, t.zipChart.x + t.zipChart.width - 25, barY + 4);
    });

    // Footer
    this.renderer.renderPageFooter('Donor Analysis Report');
  }

  private buildPage2(config: DonorAnalysisConfig): void {
    const t = DONOR_PAGE2_TEMPLATE;

    // Page header
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.pageHeader.x, t.pageHeader.y, t.pageHeader.width, t.pageHeader.height, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text('Donor Segmentation', t.pageHeader.x + 4, t.pageHeader.y + 7);

    // ========================================================================
    // Segments Table
    // ========================================================================

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('DONOR SEGMENTS', t.segmentsTitle.x, t.segmentsTitle.y);

    const table = t.segmentsTable;
    let y = table.y;

    // Table header
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(table.x, y, table.width, table.headerHeight, 'F');

    this.pdf.setFontSize(6);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(71, 85, 105);

    const cols = [
      { label: 'Segment', x: table.x + 2, width: 45 },
      { label: 'Donors', x: table.x + 47, width: 25 },
      { label: 'Total', x: table.x + 72, width: 30 },
      { label: 'Avg', x: table.x + 102, width: 25 },
      { label: '% of Total', x: table.x + 127, width: 25 },
    ];

    cols.forEach(col => {
      this.pdf.text(col.label, col.x, y + 5.5);
    });
    y += table.headerHeight;

    // Table rows
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    config.segments.slice(0, table.maxRows).forEach((segment, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
        this.pdf.rect(table.x, y, table.width, table.rowHeight, 'F');
      }

      this.pdf.setFontSize(7);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(segment.name, cols[0].x, y + 4);

      this.pdf.setFontSize(6);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      const descLines = this.pdf.splitTextToSize(segment.description, 42);
      this.pdf.text(descLines[0] || '', cols[0].x, y + 9);

      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.setFontSize(7);
      this.pdf.text(segment.donorCount.toLocaleString(), cols[1].x, y + 6);
      this.pdf.text(this.formatCurrency(segment.totalAmount), cols[2].x, y + 6);
      this.pdf.text(this.formatCurrency(segment.avgDonation), cols[3].x, y + 6);

      // Percent bar
      const pctWidth = (segment.percentOfTotal / 100) * 20;
      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.donorPrimary));
      this.pdf.rect(cols[4].x, y + 3, pctWidth, 4, 'F');
      this.pdf.text(`${segment.percentOfTotal.toFixed(0)}%`, cols[4].x + pctWidth + 2, y + 6);

      y += table.rowHeight;
    });

    // ========================================================================
    // Lapsed Donors
    // ========================================================================

    if (config.lapsedDonors?.length) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('LAPSED DONOR RECOVERY OPPORTUNITIES', t.lapsedTitle.x, t.lapsedTitle.y);

      const boxHeight = Math.min(t.lapsedBox.height, config.lapsedDonors.length * 16 + 10);
      this.pdf.setFillColor(254, 243, 199);
      this.pdf.rect(t.lapsedBox.x, t.lapsedBox.y, t.lapsedBox.width, boxHeight, 'F');

      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.persuasion));
      this.pdf.rect(t.lapsedBox.x, t.lapsedBox.y, 3, boxHeight, 'F');

      let itemY = t.lapsedBox.y + 8;
      config.lapsedDonors.slice(0, 5).forEach(item => {
        this.pdf.setFontSize(8);
        this.pdf.setFont(FONT_SPECS.family, 'bold');
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
        this.pdf.text(item.segment, t.lapsedBox.x + 8, itemY);

        this.pdf.setFontSize(7);
        this.pdf.setFont(FONT_SPECS.family, 'normal');
        this.pdf.setTextColor(71, 85, 105);
        this.pdf.text(
          `${item.count} donors | Last gave: ${this.formatCurrency(item.lastGaveTotal)} | Recovery: ${this.formatCurrency(item.recoveryPotential)}`,
          t.lapsedBox.x + 8,
          itemY + 5
        );

        this.pdf.setFontSize(6);
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
        this.pdf.text(`Action: ${item.suggestedAction}`, t.lapsedBox.x + 8, itemY + 10);

        itemY += 16;
      });
    }

    // Footer
    this.renderer.renderPageFooter('Donor Analysis Report');
  }

  private buildPage3(config: DonorAnalysisConfig): void {
    const t = DONOR_PAGE3_TEMPLATE;

    // Page header
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.pageHeader.x, t.pageHeader.y, t.pageHeader.width, t.pageHeader.height, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text('Geographic & Trend Analysis', t.pageHeader.x + 4, t.pageHeader.y + 7);

    // ========================================================================
    // Geographic Opportunities
    // ========================================================================

    if (config.geographicOpportunities?.length) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('GEOGRAPHIC OPPORTUNITIES', t.geoTitle.x, t.geoTitle.y);

      const geoTable = t.geoTable;
      let y = geoTable.y;

      // Table header
      this.pdf.setFillColor(241, 245, 249);
      this.pdf.rect(geoTable.x, y, geoTable.width, geoTable.headerHeight, 'F');

      this.pdf.setFontSize(6);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(71, 85, 105);
      this.pdf.text('ZIP', geoTable.x + 3, y + 5);
      this.pdf.text('Current', geoTable.x + 25, y + 5);
      this.pdf.text('Potential', geoTable.x + 50, y + 5);
      this.pdf.text('Untapped', geoTable.x + 75, y + 5);
      this.pdf.text('Recommendation', geoTable.x + 105, y + 5);
      y += geoTable.headerHeight;

      this.pdf.setFont(FONT_SPECS.family, 'normal');
      config.geographicOpportunities.slice(0, geoTable.maxRows).forEach((opp, i) => {
        if (i % 2 === 0) {
          this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
          this.pdf.rect(geoTable.x, y, geoTable.width, geoTable.rowHeight, 'F');
        }

        this.pdf.setFontSize(7);
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
        this.pdf.text(opp.zipCode, geoTable.x + 3, y + 5);
        this.pdf.text(opp.currentDonors.toLocaleString(), geoTable.x + 25, y + 5);
        this.pdf.text(opp.potentialDonors.toLocaleString(), geoTable.x + 50, y + 5);

        // Untapped with color
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
        this.pdf.text(this.formatCurrency(opp.untappedPotential), geoTable.x + 75, y + 5);

        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
        this.pdf.setFontSize(6);
        const recText = opp.recommendation.length > 35 ? opp.recommendation.substring(0, 32) + '...' : opp.recommendation;
        this.pdf.text(recText, geoTable.x + 105, y + 5);

        y += geoTable.rowHeight;
      });
    }

    // ========================================================================
    // Monthly Trends
    // ========================================================================

    if (config.monthlyTrends?.length) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('MONTHLY TRENDS', t.trendsTitle.x, t.trendsTitle.y);

      // Chart area
      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
      this.pdf.rect(t.trendsChart.x, t.trendsChart.y, t.trendsChart.width, t.trendsChart.height, 'F');

      const trends = config.monthlyTrends;
      if (trends.length > 0) {
        const maxAmount = Math.max(...trends.map(tr => tr.amount));
        const barWidth = Math.min(15, (t.trendsChart.width - 20) / trends.length);
        const maxBarHeight = t.trendsChart.height - 20;

        trends.forEach((trend, i) => {
          const x = t.trendsChart.x + 10 + i * (barWidth + 2);
          const barHeight = (trend.amount / maxAmount) * maxBarHeight;
          const barY = t.trendsChart.y + t.trendsChart.height - 10 - barHeight;

          // Bar
          this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.donorPrimary));
          this.pdf.rect(x, barY, barWidth, barHeight, 'F');

          // Month label
          this.pdf.setFontSize(5);
          this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
          this.pdf.text(trend.month, x, t.trendsChart.y + t.trendsChart.height - 3);

          // Amount on top
          if (barHeight > 10) {
            this.pdf.setTextColor(255, 255, 255);
            this.pdf.setFontSize(5);
            const amtText = this.formatCompact(trend.amount);
            this.pdf.text(amtText, x + 1, barY + 6);
          }
        });
      }
    }

    // Footer
    this.renderer.renderPageFooter('Donor Analysis Report');
  }

  private buildPage4(config: DonorAnalysisConfig): void {
    const t = DONOR_PAGE4_TEMPLATE;

    // Page header
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.pageHeader.x, t.pageHeader.y, t.pageHeader.width, t.pageHeader.height, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text('Strategic Recommendations', t.pageHeader.x + 4, t.pageHeader.y + 7);

    // ========================================================================
    // Recommendations
    // ========================================================================

    if (config.recommendations?.length) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('STRATEGIC RECOMMENDATIONS', t.recTitle.x, t.recTitle.y);

      const boxHeight = Math.min(t.recBox.height, config.recommendations.length * 20 + 15);
      this.pdf.setFillColor(243, 232, 255);
      this.pdf.rect(t.recBox.x, t.recBox.y, t.recBox.width, boxHeight, 'F');

      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.donorPrimary));
      this.pdf.rect(t.recBox.x, t.recBox.y, 3, boxHeight, 'F');

      let recY = t.recBox.y + 10;
      config.recommendations.slice(0, 8).forEach((rec, i) => {
        // Number badge
        this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.donorPrimary));
        this.pdf.circle(t.recBox.x + 10, recY, 4, 'F');
        this.pdf.setFontSize(8);
        this.pdf.setFont(FONT_SPECS.family, 'bold');
        this.pdf.setTextColor(255, 255, 255);
        this.pdf.text((i + 1).toString(), t.recBox.x + 8.5, recY + 2.5);

        // Text
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
        this.pdf.setFontSize(9);
        this.pdf.setFont(FONT_SPECS.family, 'normal');
        const lines = this.pdf.splitTextToSize(rec, t.recBox.width - 25);
        lines.slice(0, 3).forEach((line: string, li: number) => {
          this.pdf.text(line, t.recBox.x + 18, recY + 2 + li * 5);
        });

        recY += Math.max(20, Math.min(lines.length, 3) * 5 + 8);
      });
    }

    // Footer
    this.renderer.renderPageFooter('Donor Analysis Report');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private formatCurrency(value: number): string {
    return formatCurrencyUtil(value);
  }

  private formatCompact(value: number): string {
    return formatCompactUtil(value);
  }

  private hexToRgb(hex: string): [number, number, number] {
    return hexToRgbUtil(hex);
  }
}

export default DonorAnalysisPDFGeneratorV2;
