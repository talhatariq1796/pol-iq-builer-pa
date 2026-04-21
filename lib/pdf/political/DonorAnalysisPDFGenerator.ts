/**
 * Donor Analysis PDF Generator
 *
 * Generates 3-4 page fundraising intelligence reports
 * Perfect for finance team briefings and donor prospecting
 *
 * Pages:
 * 1. Fundraising Summary + Top ZIP Codes
 * 2. Donor Segments + Lapsed Donor Opportunity
 * 3. Geographic Opportunities + Time Trends
 * 4. Recommendations (optional)
 */

import jsPDF from 'jspdf';
import { renderKPICard, BRAND_COLORS } from '../components/KPICard';

// ============================================================================
// Configuration Types
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
  // Report identification
  reportTitle: string;
  analysisArea: string;
  dateRange: string;

  // Summary statistics
  summary: {
    totalRaised: number;
    totalDonors: number;
    avgDonation: number;
    medianDonation: number;
    largestDonation: number;
    repeatDonorRate: number;
  };

  // Top ZIP codes
  topZipCodes: ZipDonorData[];

  // Donor segments (RFM or custom)
  segments: DonorSegment[];

  // Lapsed donor analysis
  lapsedDonors?: LapsedDonor[];

  // Geographic opportunities
  geographicOpportunities?: Array<{
    zipCode: string;
    currentDonors: number;
    potentialDonors: number;
    untappedPotential: number;
    recommendation: string;
  }>;

  // Time trends
  monthlyTrends?: MonthlyTrend[];

  // AI recommendations
  recommendations?: string[];

  // Metadata
  county: string;
  state: string;
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Colors
// ============================================================================

const COLORS = {
  primary: '#7C3AED', // Purple for donor
  secondary: '#8B5CF6',
  success: '#059669',
  warning: '#F59E0B',
  danger: '#DC2626',
  neutral: '#6B7280',
  background: '#F8FAFC',
  border: '#E2E8F0',
  text: {
    dark: '#1E293B',
    medium: '#64748B',
    light: '#94A3B8',
  },
};

// ============================================================================
// PDF Generator Class
// ============================================================================

export class DonorAnalysisPDFGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 12;
  private currentPage: number = 1;
  private totalPages: number = 3;

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'letter');
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.pageHeight = this.pdf.internal.pageSize.height;
  }

  /**
   * Generate Donor Analysis PDF
   */
  async generateReport(config: DonorAnalysisConfig): Promise<Blob> {
    console.log('[DonorAnalysisPDFGenerator] Starting PDF generation');

    try {
      // Calculate total pages
      const hasRecommendations = config.recommendations?.length;
      this.totalPages = 3 + (hasRecommendations ? 1 : 0);

      // Page 1: Summary + Top ZIPs
      this.buildPage1(config);

      // Page 2: Segments + Lapsed
      this.addNewPage();
      this.buildPage2(config);

      // Page 3: Geographic + Trends
      this.addNewPage();
      this.buildPage3(config);

      // Page 4: Recommendations (optional)
      if (hasRecommendations) {
        this.addNewPage();
        this.buildRecommendationsPage(config);
      }

      const pdfBlob = this.pdf.output('blob');
      console.log('[DonorAnalysisPDFGenerator] PDF generation complete');
      return pdfBlob;
    } catch (error) {
      console.error('[DonorAnalysisPDFGenerator] Error:', error);
      throw error;
    }
  }

  /**
   * Page 1: Fundraising Summary + Top ZIP Codes
   */
  private buildPage1(config: DonorAnalysisConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Header
    y = this.renderHeader(config, y, contentWidth);

    // Summary KPIs
    y = this.renderSummary(config.summary, y, contentWidth);

    // Top ZIP codes chart
    y = this.renderTopZipCodes(config.topZipCodes, y, contentWidth);

    this.renderFooter(config, 1);
  }

  /**
   * Page 2: Donor Segments + Lapsed Donors
   */
  private buildPage2(config: DonorAnalysisConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    y = this.renderPageHeader('Donor Segmentation', y, contentWidth);

    // Segments table
    y = this.renderSegmentsTable(config.segments, y, contentWidth);

    // Lapsed donors
    if (config.lapsedDonors?.length) {
      y = this.renderLapsedDonors(config.lapsedDonors, y, contentWidth);
    }

    this.renderFooter(config, 2);
  }

  /**
   * Page 3: Geographic Opportunities + Time Trends
   */
  private buildPage3(config: DonorAnalysisConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    y = this.renderPageHeader('Geographic & Trend Analysis', y, contentWidth);

    // Geographic opportunities
    if (config.geographicOpportunities?.length) {
      y = this.renderGeographicOpportunities(config.geographicOpportunities, y, contentWidth);
    }

    // Monthly trends
    if (config.monthlyTrends?.length) {
      y = this.renderMonthlyTrends(config.monthlyTrends, y, contentWidth);
    }

    this.renderFooter(config, 3);
  }

  /**
   * Recommendations page
   */
  private buildRecommendationsPage(config: DonorAnalysisConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    y = this.renderPageHeader('Strategic Recommendations', y, contentWidth);

    if (config.recommendations?.length) {
      y = this.renderRecommendations(config.recommendations, y, contentWidth);
    }

    this.renderFooter(config, this.totalPages);
  }

  // ============================================================================
  // Render Helper Methods
  // ============================================================================

  private renderHeader(config: DonorAnalysisConfig, startY: number, width: number): number {
    let y = startY;

    // Title bar
    this.pdf.setFillColor(124, 58, 237); // Purple
    this.pdf.rect(this.margin, y, width, 16, 'F');

    // Title
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text('DONOR ANALYSIS REPORT', this.margin + 5, y + 10);

    // Date
    const reportDate = config.reportDate || new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    const dateWidth = this.pdf.getTextWidth(reportDate);
    this.pdf.text(reportDate, this.margin + width - dateWidth - 5, y + 10);

    y += 20;

    // Report title
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.text(config.reportTitle, this.margin, y);
    y += 5;

    // Metadata
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text(`${config.analysisArea} | ${config.dateRange}`, this.margin, y);

    return y + 8;
  }

  private renderSummary(summary: DonorAnalysisConfig['summary'], startY: number, width: number): number {
    let y = startY;

    // Section header
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('FUNDRAISING SUMMARY', this.margin, y);
    y += 5;

    // KPI cards - Row 1
    const cardWidth = (width - 15) / 4;
    const cardHeight = 26;
    const gap = 5;

    renderKPICard(this.pdf, this.margin, y, cardWidth, cardHeight, {
      label: 'Total Raised',
      value: this.formatCurrency(summary.totalRaised),
      backgroundColor: COLORS.primary,
      textColor: '#FFFFFF',
    });

    renderKPICard(this.pdf, this.margin + cardWidth + gap, y, cardWidth, cardHeight, {
      label: 'Total Donors',
      value: summary.totalDonors.toLocaleString(),
      backgroundColor: BRAND_COLORS.darkGray,
      textColor: '#FFFFFF',
    });

    renderKPICard(this.pdf, this.margin + 2 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'Avg Donation',
      value: this.formatCurrency(summary.avgDonation),
      backgroundColor: COLORS.success,
      textColor: '#FFFFFF',
    });

    renderKPICard(this.pdf, this.margin + 3 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'Repeat Rate',
      value: `${(summary.repeatDonorRate * 100).toFixed(0)}%`,
      backgroundColor: COLORS.warning,
      textColor: '#FFFFFF',
    });

    y += cardHeight + gap;

    // Row 2 - smaller metrics
    this.pdf.setFillColor(248, 250, 252);
    this.pdf.rect(this.margin, y, width, 16, 'F');

    const smallMetrics = [
      { label: 'Median Donation', value: this.formatCurrency(summary.medianDonation) },
      { label: 'Largest Gift', value: this.formatCurrency(summary.largestDonation) },
    ];

    const smallWidth = width / 2;
    smallMetrics.forEach((metric, i) => {
      const x = this.margin + i * smallWidth + 5;
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(100, 116, 139);
      this.pdf.text(metric.label, x, y + 5);
      this.pdf.setFontSize(11);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(metric.value, x, y + 12);
      this.pdf.setFont('helvetica', 'normal');
    });

    return y + 22;
  }

  private renderTopZipCodes(zipCodes: ZipDonorData[], startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('TOP ZIP CODES BY TOTAL RAISED', this.margin, y);
    y += 6;

    // Find max for scaling
    const maxAmount = Math.max(...zipCodes.map(z => z.totalAmount));

    // Display top 10
    const displayZips = zipCodes.slice(0, 10);
    const barMaxWidth = width - 60;

    displayZips.forEach((zip, i) => {
      const barWidth = (zip.totalAmount / maxAmount) * barMaxWidth;
      const barY = y + i * 10;

      // Background
      if (i % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, barY - 2, width, 10, 'F');
      }

      // ZIP code
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(zip.zipCode, this.margin + 3, barY + 4);

      // Bar
      const rgb = this.hexToRgb(i < 3 ? COLORS.primary : COLORS.secondary);
      this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      this.pdf.rect(this.margin + 25, barY, barWidth, 6, 'F');

      // Amount
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(71, 85, 105);
      this.pdf.text(this.formatCurrency(zip.totalAmount), this.margin + 30 + barWidth, barY + 4);

      // Donor count
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(148, 163, 184);
      this.pdf.text(`${zip.donorCount} donors`, this.margin + width - 25, barY + 4);
    });

    return y + displayZips.length * 10 + 8;
  }

  private renderPageHeader(title: string, startY: number, width: number): number {
    let y = startY;

    this.pdf.setFillColor(248, 250, 252);
    this.pdf.rect(this.margin, y, width, 10, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.text(title, this.margin + 4, y + 7);

    return y + 14;
  }

  private renderSegmentsTable(segments: DonorSegment[], startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('DONOR SEGMENTS', this.margin, y);
    y += 5;

    // Table header
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 7, 'F');

    this.pdf.setFontSize(6);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(71, 85, 105);

    const cols = [
      { label: 'Segment', x: this.margin + 2, width: 45 },
      { label: 'Donors', x: this.margin + 47, width: 25 },
      { label: 'Total', x: this.margin + 72, width: 30 },
      { label: 'Avg', x: this.margin + 102, width: 25 },
      { label: '% of Total', x: this.margin + 127, width: 25 },
    ];

    cols.forEach(col => {
      this.pdf.text(col.label, col.x, y + 5);
    });
    y += 7;

    // Rows
    this.pdf.setFont('helvetica', 'normal');
    segments.forEach((segment, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, y, width, 12, 'F');
      }

      this.pdf.setFontSize(7);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(segment.name, cols[0].x, y + 4);

      this.pdf.setFontSize(6);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(100, 116, 139);
      const descLines = this.pdf.splitTextToSize(segment.description, 42);
      this.pdf.text(descLines[0] || '', cols[0].x, y + 9);

      this.pdf.setTextColor(30, 41, 59);
      this.pdf.setFontSize(7);
      this.pdf.text(segment.donorCount.toLocaleString(), cols[1].x, y + 6);
      this.pdf.text(this.formatCurrency(segment.totalAmount), cols[2].x, y + 6);
      this.pdf.text(this.formatCurrency(segment.avgDonation), cols[3].x, y + 6);

      // Percent bar
      const pctWidth = (segment.percentOfTotal / 100) * 20;
      this.pdf.setFillColor(124, 58, 237);
      this.pdf.rect(cols[4].x, y + 3, pctWidth, 4, 'F');
      this.pdf.text(`${segment.percentOfTotal.toFixed(0)}%`, cols[4].x + pctWidth + 2, y + 6);

      y += 12;
    });

    return y + 5;
  }

  private renderLapsedDonors(lapsed: LapsedDonor[], startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('LAPSED DONOR RECOVERY OPPORTUNITIES', this.margin, y);
    y += 6;

    // Warning box
    this.pdf.setFillColor(254, 243, 199);
    const boxHeight = lapsed.length * 16 + 10;
    this.pdf.rect(this.margin, y, width, boxHeight, 'F');

    this.pdf.setFillColor(245, 158, 11);
    this.pdf.rect(this.margin, y, 3, boxHeight, 'F');

    let itemY = y + 8;
    lapsed.forEach(item => {
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(item.segment, this.margin + 8, itemY);

      this.pdf.setFontSize(7);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(71, 85, 105);
      this.pdf.text(
        `${item.count} donors | Last gave: ${this.formatCurrency(item.lastGaveTotal)} | Recovery: ${this.formatCurrency(item.recoveryPotential)}`,
        this.margin + 8,
        itemY + 5
      );

      this.pdf.setFontSize(6);
      this.pdf.setTextColor(100, 116, 139);
      this.pdf.text(`Action: ${item.suggestedAction}`, this.margin + 8, itemY + 10);

      itemY += 16;
    });

    return y + boxHeight + 8;
  }

  private renderGeographicOpportunities(
    opportunities: NonNullable<DonorAnalysisConfig['geographicOpportunities']>,
    startY: number,
    width: number
  ): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('GEOGRAPHIC OPPORTUNITIES', this.margin, y);
    y += 6;

    // Table
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 7, 'F');

    this.pdf.setFontSize(6);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text('ZIP', this.margin + 3, y + 5);
    this.pdf.text('Current', this.margin + 25, y + 5);
    this.pdf.text('Potential', this.margin + 50, y + 5);
    this.pdf.text('Untapped', this.margin + 75, y + 5);
    this.pdf.text('Recommendation', this.margin + 105, y + 5);
    y += 7;

    this.pdf.setFont('helvetica', 'normal');
    opportunities.slice(0, 8).forEach((opp, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, y, width, 8, 'F');
      }

      this.pdf.setFontSize(7);
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(opp.zipCode, this.margin + 3, y + 5);
      this.pdf.text(opp.currentDonors.toLocaleString(), this.margin + 25, y + 5);
      this.pdf.text(opp.potentialDonors.toLocaleString(), this.margin + 50, y + 5);

      // Untapped with color
      this.pdf.setTextColor(5, 150, 105);
      this.pdf.text(this.formatCurrency(opp.untappedPotential), this.margin + 75, y + 5);

      this.pdf.setTextColor(100, 116, 139);
      this.pdf.setFontSize(6);
      const recText = opp.recommendation.length > 35 ? opp.recommendation.substring(0, 32) + '...' : opp.recommendation;
      this.pdf.text(recText, this.margin + 105, y + 5);

      y += 8;
    });

    return y + 5;
  }

  private renderMonthlyTrends(trends: MonthlyTrend[], startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('MONTHLY TRENDS', this.margin, y);
    y += 6;

    // Chart area
    this.pdf.setFillColor(248, 250, 252);
    const chartHeight = 50;
    this.pdf.rect(this.margin, y, width, chartHeight, 'F');

    if (trends.length > 0) {
      const maxAmount = Math.max(...trends.map(t => t.amount));
      const barWidth = Math.min(15, (width - 20) / trends.length);
      const maxBarHeight = chartHeight - 20;

      trends.forEach((trend, i) => {
        const x = this.margin + 10 + i * (barWidth + 2);
        const barHeight = (trend.amount / maxAmount) * maxBarHeight;
        const barY = y + chartHeight - 10 - barHeight;

        // Bar
        this.pdf.setFillColor(124, 58, 237);
        this.pdf.rect(x, barY, barWidth, barHeight, 'F');

        // Month label
        this.pdf.setFontSize(5);
        this.pdf.setTextColor(100, 116, 139);
        this.pdf.text(trend.month, x, y + chartHeight - 3);

        // Amount on top
        if (barHeight > 10) {
          this.pdf.setTextColor(255, 255, 255);
          this.pdf.setFontSize(5);
          const amtText = this.formatCompact(trend.amount);
          this.pdf.text(amtText, x + 1, barY + 6);
        }
      });
    }

    return y + chartHeight + 8;
  }

  private renderRecommendations(recommendations: string[], startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('STRATEGIC RECOMMENDATIONS', this.margin, y);
    y += 6;

    // Recommendation box
    this.pdf.setFillColor(243, 232, 255);
    const boxHeight = recommendations.length * 20 + 15;
    this.pdf.rect(this.margin, y, width, boxHeight, 'F');

    this.pdf.setFillColor(124, 58, 237);
    this.pdf.rect(this.margin, y, 3, boxHeight, 'F');

    let recY = y + 10;
    recommendations.forEach((rec, i) => {
      // Number badge
      this.pdf.setFillColor(124, 58, 237);
      this.pdf.circle(this.margin + 10, recY, 4, 'F');
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.text((i + 1).toString(), this.margin + 8.5, recY + 2.5);

      // Text
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'normal');
      const lines = this.pdf.splitTextToSize(rec, width - 25);
      lines.forEach((line: string, li: number) => {
        this.pdf.text(line, this.margin + 18, recY + 2 + li * 5);
      });

      recY += Math.max(20, lines.length * 5 + 8);
    });

    return y + boxHeight + 8;
  }

  private renderFooter(config: DonorAnalysisConfig, pageNum: number): void {
    const y = this.pageHeight - 10;

    this.pdf.setDrawColor(226, 232, 240);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margin, y - 3, this.pageWidth - this.margin, y - 3);

    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(148, 163, 184);

    const generatedBy = config.generatedBy || 'Political Analysis Platform';
    this.pdf.text(`Generated by ${generatedBy}`, this.margin, y);
    this.pdf.text(`Donor Analysis | Page ${pageNum} of ${this.totalPages}`, this.pageWidth - this.margin - 40, y);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private addNewPage(): void {
    this.pdf.addPage();
    this.currentPage++;
  }

  private formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  }

  private formatCompact(value: number): string {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleanHex = hex.replace('#', '');
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16),
    };
  }
}

export default DonorAnalysisPDFGenerator;
