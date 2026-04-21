/**
 * Segment Report PDF Generator
 *
 * Generates 2-3 page segment documentation reports
 * Perfect for sharing segment definitions with teams and documenting targeting criteria
 *
 * Pages:
 * 1. Segment Definition + Summary Statistics + Score Distributions
 * 2. Precinct List (paginated if large)
 * 3. Demographic Profile + Strategic Recommendations
 */

import jsPDF from 'jspdf';
import { renderKPICard, BRAND_COLORS } from '../components/KPICard';

// ============================================================================
// Configuration Types
// ============================================================================

export interface SegmentFilter {
  field: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'between' | 'in';
  value: number | string | [number, number] | string[];
  label?: string;
}

export interface SegmentPrecinctData {
  name: string;
  jurisdiction: string;
  registeredVoters: number;
  partisanLean: number;
  swingPotential: number;
  gotvPriority: number;
  persuasionScore: number;
  avgTurnout: number;
}

export interface SegmentReportConfig {
  // Segment identification
  segmentName: string;
  segmentDescription?: string;
  createdAt?: string;
  createdBy?: string;

  // Filter criteria
  filters: SegmentFilter[];

  // Summary statistics
  summary: {
    totalPrecincts: number;
    totalVoters: number;
    avgSwingPotential: number;
    avgGotvPriority: number;
    avgPersuasion: number;
    avgTurnout: number;
    avgPartisanLean: number;
  };

  // Score distributions (for histograms)
  distributions?: {
    swing: number[];
    gotv: number[];
    persuasion: number[];
  };

  // Precinct list
  precincts: SegmentPrecinctData[];

  // Aggregate demographics
  demographics?: {
    totalPopulation: number;
    medianAge: number;
    medianIncome: number;
    collegeEducated: number;
    urbanRural: 'urban' | 'suburban' | 'rural' | 'mixed';
  };

  // AI recommendations
  recommendations?: string[];

  // Location context
  county: string;
  state: string;

  // Optional
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Colors
// ============================================================================

const COLORS = {
  primary: '#8B5CF6', // Purple for segments
  secondary: '#3B82F6',
  gotv: '#059669',
  swing: '#F59E0B',
  persuasion: '#EC4899',
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

export class SegmentReportPDFGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 12;
  private currentPage: number = 1;
  private totalPages: number = 2;

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'letter');
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.pageHeight = this.pdf.internal.pageSize.height;
  }

  /**
   * Generate Segment Report PDF
   */
  async generateReport(config: SegmentReportConfig): Promise<Blob> {
    console.log('[SegmentReportPDFGenerator] Starting PDF generation');

    try {
      // Calculate total pages based on precinct count
      const precinctsPerPage = 25;
      const precinctPages = Math.ceil(config.precincts.length / precinctsPerPage);
      this.totalPages = 1 + precinctPages + (config.demographics || config.recommendations ? 1 : 0);

      this.buildPage1(config);

      // Precinct list pages
      for (let i = 0; i < precinctPages; i++) {
        this.addNewPage();
        const startIdx = i * precinctsPerPage;
        const endIdx = Math.min(startIdx + precinctsPerPage, config.precincts.length);
        this.buildPrecinctListPage(config, config.precincts.slice(startIdx, endIdx), i + 1, precinctPages);
      }

      // Demographics & Recommendations page
      if (config.demographics || config.recommendations?.length) {
        this.addNewPage();
        this.buildDemographicsPage(config);
      }

      const pdfBlob = this.pdf.output('blob');
      console.log('[SegmentReportPDFGenerator] PDF generation complete');
      return pdfBlob;
    } catch (error) {
      console.error('[SegmentReportPDFGenerator] Error:', error);
      throw error;
    }
  }

  /**
   * Page 1: Segment Definition + Summary Stats
   */
  private buildPage1(config: SegmentReportConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Header
    y = this.renderHeader(config, y, contentWidth);

    // Filter criteria
    y = this.renderFilterCriteria(config.filters, y, contentWidth);

    // Summary statistics
    y = this.renderSummaryStats(config.summary, y, contentWidth);

    // Score distributions (simple bar representation)
    if (config.distributions) {
      y = this.renderScoreDistributions(config.distributions, y, contentWidth);
    }

    this.renderFooter(config, 1);
  }

  /**
   * Precinct list page
   */
  private buildPrecinctListPage(
    config: SegmentReportConfig,
    precincts: SegmentPrecinctData[],
    pageNum: number,
    totalPrecinctPages: number
  ): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Page header
    const subtitle = totalPrecinctPages > 1 ? ` (${pageNum}/${totalPrecinctPages})` : '';
    y = this.renderPageHeader(`Matching Precincts${subtitle}`, y, contentWidth);

    // Table
    y = this.renderPrecinctTable(precincts, y, contentWidth);

    this.renderFooter(config, 1 + pageNum);
  }

  /**
   * Demographics & Recommendations page
   */
  private buildDemographicsPage(config: SegmentReportConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Page header
    y = this.renderPageHeader('Segment Profile & Recommendations', y, contentWidth);

    // Demographics
    if (config.demographics) {
      y = this.renderDemographicProfile(config.demographics, y, contentWidth);
    }

    // Recommendations
    if (config.recommendations?.length) {
      y = this.renderRecommendations(config.recommendations, y, contentWidth);
    }

    this.renderFooter(config, this.totalPages);
  }

  // ============================================================================
  // Render Helper Methods
  // ============================================================================

  private renderHeader(config: SegmentReportConfig, startY: number, width: number): number {
    let y = startY;

    // Title bar
    this.pdf.setFillColor(139, 92, 246); // Purple
    this.pdf.rect(this.margin, y, width, 16, 'F');

    // Title
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text('SEGMENT REPORT', this.margin + 5, y + 10);

    // Date
    const reportDate = config.reportDate || new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    const dateWidth = this.pdf.getTextWidth(reportDate);
    this.pdf.text(reportDate, this.margin + width - dateWidth - 5, y + 10);

    y += 20;

    // Segment name
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.text(config.segmentName, this.margin, y);
    y += 5;

    // Description
    if (config.segmentDescription) {
      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(100, 116, 139);
      const lines = this.pdf.splitTextToSize(config.segmentDescription, width);
      lines.forEach((line: string) => {
        this.pdf.text(line, this.margin, y);
        y += 4;
      });
    }

    // Metadata
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(148, 163, 184);
    const metaText = [
      config.createdBy ? `Created by: ${config.createdBy}` : null,
      config.createdAt ? `Date: ${config.createdAt}` : null,
      `${config.county} County, ${config.state}`,
    ].filter(Boolean).join(' | ');
    this.pdf.text(metaText, this.margin, y);

    return y + 8;
  }

  private renderFilterCriteria(filters: SegmentFilter[], startY: number, width: number): number {
    let y = startY;

    // Section header
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('FILTER CRITERIA', this.margin, y);
    y += 5;

    // Filter box
    this.pdf.setFillColor(248, 250, 252);
    const boxHeight = Math.max(20, filters.length * 7 + 8);
    this.pdf.rect(this.margin, y, width, boxHeight, 'F');

    // Accent bar
    this.pdf.setFillColor(139, 92, 246);
    this.pdf.rect(this.margin, y, 3, boxHeight, 'F');

    // Filters
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    let filterY = y + 6;
    filters.forEach(filter => {
      const filterText = this.formatFilter(filter);
      this.pdf.setFillColor(139, 92, 246);
      this.pdf.circle(this.margin + 8, filterY - 1, 1.5, 'F');
      this.pdf.text(filterText, this.margin + 12, filterY);
      filterY += 7;
    });

    return y + boxHeight + 8;
  }

  private formatFilter(filter: SegmentFilter): string {
    const fieldLabels: Record<string, string> = {
      swing_potential: 'Swing Potential',
      gotv_priority: 'GOTV Priority',
      persuasion_opportunity: 'Persuasion',
      partisan_lean: 'Partisan Lean',
      turnout: 'Turnout',
      registered_voters: 'Registered Voters',
    };

    const operatorLabels: Record<string, string> = {
      gt: '>',
      lt: '<',
      gte: '≥',
      lte: '≤',
      eq: '=',
      between: 'between',
      in: 'in',
    };

    const fieldLabel = filter.label || fieldLabels[filter.field] || filter.field;
    const op = operatorLabels[filter.operator] || filter.operator;

    if (filter.operator === 'between' && Array.isArray(filter.value)) {
      return `${fieldLabel} ${filter.value[0]} - ${filter.value[1]}`;
    }
    if (filter.operator === 'in' && Array.isArray(filter.value)) {
      return `${fieldLabel} in [${filter.value.join(', ')}]`;
    }
    return `${fieldLabel} ${op} ${filter.value}`;
  }

  private renderSummaryStats(summary: SegmentReportConfig['summary'], startY: number, width: number): number {
    let y = startY;

    // Section header
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('SUMMARY STATISTICS', this.margin, y);
    y += 5;

    // KPI cards
    const cardWidth = (width - 15) / 4;
    const cardHeight = 26;
    const gap = 5;

    // Row 1
    renderKPICard(this.pdf, this.margin, y, cardWidth, cardHeight, {
      label: 'Precincts',
      value: summary.totalPrecincts.toString(),
      backgroundColor: COLORS.primary,
      textColor: '#FFFFFF',
    });

    renderKPICard(this.pdf, this.margin + cardWidth + gap, y, cardWidth, cardHeight, {
      label: 'Voters',
      value: this.formatNumber(summary.totalVoters),
      backgroundColor: BRAND_COLORS.darkGray,
      textColor: '#FFFFFF',
    });

    renderKPICard(this.pdf, this.margin + 2 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'Avg Swing',
      value: `${summary.avgSwingPotential.toFixed(0)}/100`,
      backgroundColor: COLORS.swing,
      textColor: '#FFFFFF',
    });

    renderKPICard(this.pdf, this.margin + 3 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'Avg GOTV',
      value: `${summary.avgGotvPriority.toFixed(0)}/100`,
      backgroundColor: COLORS.gotv,
      textColor: '#FFFFFF',
    });

    y += cardHeight + gap;

    // Row 2 (smaller stats)
    const smallStats = [
      { label: 'Avg Turnout', value: `${summary.avgTurnout.toFixed(1)}%` },
      { label: 'Avg Persuasion', value: `${summary.avgPersuasion.toFixed(0)}/100` },
      { label: 'Avg Lean', value: this.formatLean(summary.avgPartisanLean) },
    ];

    const smallWidth = (width - 10) / 3;
    this.pdf.setFillColor(248, 250, 252);
    this.pdf.rect(this.margin, y, width, 18, 'F');

    smallStats.forEach((stat, i) => {
      const x = this.margin + i * (smallWidth + 5) + 5;
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(100, 116, 139);
      this.pdf.text(stat.label, x, y + 6);
      this.pdf.setFontSize(11);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(stat.value, x, y + 13);
      this.pdf.setFont('helvetica', 'normal');
    });

    return y + 24;
  }

  private renderScoreDistributions(distributions: NonNullable<SegmentReportConfig['distributions']>, startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('SCORE DISTRIBUTIONS', this.margin, y);
    y += 6;

    const metrics = [
      { label: 'Swing', data: distributions.swing, color: COLORS.swing },
      { label: 'GOTV', data: distributions.gotv, color: COLORS.gotv },
      { label: 'Persuasion', data: distributions.persuasion, color: COLORS.persuasion },
    ];

    const chartWidth = (width - 10) / 3;
    const chartHeight = 25;

    metrics.forEach((metric, i) => {
      const x = this.margin + i * (chartWidth + 5);
      this.renderMiniHistogram(metric.label, metric.data, x, y, chartWidth, chartHeight, metric.color);
    });

    return y + chartHeight + 10;
  }

  private renderMiniHistogram(label: string, data: number[], x: number, y: number, width: number, height: number, color: string): void {
    // Background
    this.pdf.setFillColor(248, 250, 252);
    this.pdf.rect(x, y, width, height, 'F');

    // Label
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text(label, x + 2, y + 5);

    // Bars (simplified - 5 buckets)
    if (data.length > 0) {
      const maxVal = Math.max(...data, 1);
      const barWidth = (width - 4) / data.length;
      const maxBarHeight = height - 10;
      const rgb = this.hexToRgb(color);

      data.forEach((val, i) => {
        const barHeight = (val / maxVal) * maxBarHeight;
        this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        this.pdf.rect(x + 2 + i * barWidth, y + height - 3 - barHeight, barWidth - 1, barHeight, 'F');
      });
    }

    // X-axis labels
    this.pdf.setFontSize(5);
    this.pdf.setTextColor(148, 163, 184);
    this.pdf.text('0', x + 2, y + height - 1);
    this.pdf.text('100', x + width - 8, y + height - 1);
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

  private renderPrecinctTable(precincts: SegmentPrecinctData[], startY: number, width: number): number {
    let y = startY;

    // Table header
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 7, 'F');

    this.pdf.setFontSize(6);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(71, 85, 105);

    const cols = [
      { label: 'Precinct', x: this.margin + 2, width: 50 },
      { label: 'Voters', x: this.margin + 52, width: 22 },
      { label: 'Lean', x: this.margin + 74, width: 20 },
      { label: 'Swing', x: this.margin + 94, width: 18 },
      { label: 'GOTV', x: this.margin + 112, width: 18 },
      { label: 'Persuade', x: this.margin + 130, width: 20 },
      { label: 'Turnout', x: this.margin + 150, width: 20 },
    ];

    cols.forEach(col => {
      this.pdf.text(col.label, col.x, y + 5);
    });
    y += 7;

    // Rows
    this.pdf.setFont('helvetica', 'normal');
    precincts.forEach((precinct, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, y, width, 6, 'F');
      }

      this.pdf.setTextColor(30, 41, 59);
      this.pdf.setFontSize(6);

      // Truncate name if needed
      let name = precinct.name;
      while (this.pdf.getTextWidth(name) > 48 && name.length > 0) {
        name = name.slice(0, -1);
      }
      if (name !== precinct.name) name += '...';

      this.pdf.text(name, cols[0].x, y + 4);
      this.pdf.text(precinct.registeredVoters.toLocaleString(), cols[1].x, y + 4);

      // Partisan lean with color
      const lean = precinct.partisanLean;
      if (lean > 0) this.pdf.setTextColor(201, 49, 53);
      else if (lean < 0) this.pdf.setTextColor(46, 94, 170);
      else this.pdf.setTextColor(107, 114, 128);
      this.pdf.text(this.formatLean(lean), cols[2].x, y + 4);

      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(precinct.swingPotential.toFixed(0), cols[3].x, y + 4);
      this.pdf.text(precinct.gotvPriority.toFixed(0), cols[4].x, y + 4);
      this.pdf.text(precinct.persuasionScore.toFixed(0), cols[5].x, y + 4);
      this.pdf.text(`${precinct.avgTurnout.toFixed(0)}%`, cols[6].x, y + 4);

      y += 6;
    });

    return y + 5;
  }

  private renderDemographicProfile(demographics: NonNullable<SegmentReportConfig['demographics']>, startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('AGGREGATE DEMOGRAPHICS', this.margin, y);
    y += 6;

    // Stats grid
    const stats = [
      { label: 'Total Population', value: demographics.totalPopulation.toLocaleString() },
      { label: 'Median Age', value: `${demographics.medianAge.toFixed(1)} years` },
      { label: 'Median Income', value: `$${demographics.medianIncome.toLocaleString()}` },
      { label: 'College Educated', value: `${demographics.collegeEducated.toFixed(1)}%` },
      { label: 'Area Type', value: demographics.urbanRural.charAt(0).toUpperCase() + demographics.urbanRural.slice(1) },
    ];

    this.pdf.setFillColor(248, 250, 252);
    this.pdf.rect(this.margin, y, width, 35, 'F');

    const colWidth = width / 3;
    stats.forEach((stat, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = this.margin + col * colWidth + 5;
      const statY = y + 8 + row * 15;

      this.pdf.setFontSize(7);
      this.pdf.setTextColor(100, 116, 139);
      this.pdf.text(stat.label, x, statY);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(stat.value, x, statY + 6);
      this.pdf.setFont('helvetica', 'normal');
    });

    return y + 42;
  }

  private renderRecommendations(recommendations: string[], startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('STRATEGIC RECOMMENDATIONS', this.margin, y);
    y += 6;

    // Recommendation box
    this.pdf.setFillColor(254, 243, 199);
    const boxHeight = recommendations.length * 14 + 10;
    this.pdf.rect(this.margin, y, width, boxHeight, 'F');

    this.pdf.setFillColor(245, 158, 11);
    this.pdf.rect(this.margin, y, 3, boxHeight, 'F');

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    let recY = y + 8;
    recommendations.forEach((rec, i) => {
      this.pdf.setFillColor(245, 158, 11);
      this.pdf.circle(this.margin + 8, recY - 1, 1.5, 'F');
      const lines = this.pdf.splitTextToSize(rec, width - 18);
      lines.forEach((line: string, li: number) => {
        this.pdf.text(line, this.margin + 12, recY + li * 4);
      });
      recY += lines.length * 4 + 6;
    });

    return y + boxHeight + 8;
  }

  private renderFooter(config: SegmentReportConfig, pageNum: number): void {
    const y = this.pageHeight - 10;

    this.pdf.setDrawColor(226, 232, 240);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margin, y - 3, this.pageWidth - this.margin, y - 3);

    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(148, 163, 184);

    const generatedBy = config.generatedBy || 'Political Analysis Platform';
    this.pdf.text(`Generated by ${generatedBy}`, this.margin, y);
    this.pdf.text(`Segment Report | Page ${pageNum} of ${this.totalPages}`, this.pageWidth - this.margin - 40, y);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private addNewPage(): void {
    this.pdf.addPage();
    this.currentPage++;
  }

  private formatLean(value: number): string {
    if (value > 0) return `R+${value.toFixed(0)}`;
    if (value < 0) return `D+${Math.abs(value).toFixed(0)}`;
    return 'Even';
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 10000) return (num / 1000).toFixed(0) + 'K';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
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

export default SegmentReportPDFGenerator;
