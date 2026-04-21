/**
 * Segment Report PDF Generator V2
 *
 * Uses fixed-position template system for consistent layouts.
 * Generates 2-3 page segment documentation reports for sharing with teams.
 *
 * Pages:
 * 1. Segment Definition + Summary Statistics + Score Distributions
 * 2. Precinct List (paginated if large)
 * 3. Demographic Profile + Strategic Recommendations (optional)
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
  formatPartisanLean,
  getPartisanColor,
} from './templates/PoliticalPageTemplates';

import {
  renderScoreCard,
  renderStatCard,
} from './components/PoliticalKPICard';

import {
  PoliticalTemplateRenderer,
  createPoliticalRenderer,
} from './components/PoliticalTemplateRenderer';

import {
  hexToRgb as hexToRgbUtil,
  formatNumber as formatNumberUtil,
  formatDate,
  validateRequiredFields,
  logValidationWarnings,
} from './utils';

// ============================================================================
// Configuration Types (preserved from V1)
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
  segmentName: string;
  segmentDescription?: string;
  createdAt?: string;
  createdBy?: string;

  filters: SegmentFilter[];

  summary: {
    totalPrecincts: number;
    totalVoters: number;
    avgSwingPotential: number;
    avgGotvPriority: number;
    avgPersuasion: number;
    avgTurnout: number;
    avgPartisanLean: number;
  };

  distributions?: {
    swing: number[];
    gotv: number[];
    persuasion: number[];
  };

  precincts: SegmentPrecinctData[];

  demographics?: {
    totalPopulation: number;
    medianAge: number;
    medianIncome: number;
    collegeEducated: number;
    urbanRural: 'urban' | 'suburban' | 'rural' | 'mixed';
  };

  recommendations?: string[];

  county: string;
  state: string;
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Fixed Position Templates
// ============================================================================

const SEGMENT_PAGE1_TEMPLATE = {
  // Header bar
  headerBar: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 16 },
  headerTitle: { x: MARGINS.left + 5, y: 26, width: 100, height: 10 },
  headerDate: { x: 165, y: 26, width: 30, height: 10 },

  // Segment info
  segmentName: { x: MARGINS.left, y: 36, width: CONTENT_AREA.width, height: 8 },
  segmentDesc: { x: MARGINS.left, y: 44, width: CONTENT_AREA.width, height: 10 },
  segmentMeta: { x: MARGINS.left, y: 54, width: CONTENT_AREA.width, height: 5 },

  // Filter criteria box
  filterTitle: { x: MARGINS.left, y: 64, width: CONTENT_AREA.width, height: 5 },
  filterBox: { x: MARGINS.left, y: 70, width: CONTENT_AREA.width, height: 40 },

  // Summary stats KPIs (4 in a row)
  summaryTitle: { x: MARGINS.left, y: 116, width: CONTENT_AREA.width, height: 5 },
  kpiRow: { x: MARGINS.left, y: 124, cardWidth: 42, cardHeight: 26, gap: 4 },

  // Secondary stats row
  secondaryStats: { x: MARGINS.left, y: 156, width: CONTENT_AREA.width, height: 18 },

  // Score distributions (3 mini charts)
  distTitle: { x: MARGINS.left, y: 180, width: CONTENT_AREA.width, height: 5 },
  distCharts: { x: MARGINS.left, y: 188, chartWidth: 56, chartHeight: 30, gap: 6 },
};

const SEGMENT_PRECINCT_TABLE_TEMPLATE = {
  pageHeader: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 10 },
  table: {
    x: MARGINS.left,
    y: 30,
    width: CONTENT_AREA.width,
    rowHeight: 7,
    headerHeight: 8,
    maxRows: 30, // Per page
    columns: [
      { label: 'Precinct', width: 50 },
      { label: 'Voters', width: 22 },
      { label: 'Lean', width: 20 },
      { label: 'Swing', width: 18 },
      { label: 'GOTV', width: 18 },
      { label: 'Persuade', width: 20 },
      { label: 'Turnout', width: 20 },
    ],
  },
};

const SEGMENT_DEMO_PAGE_TEMPLATE = {
  pageHeader: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 10 },

  // Demographics section
  demoTitle: { x: MARGINS.left, y: 30, width: CONTENT_AREA.width, height: 5 },
  demoBox: { x: MARGINS.left, y: 38, width: CONTENT_AREA.width, height: 35 },

  // Recommendations section
  recTitle: { x: MARGINS.left, y: 85, width: CONTENT_AREA.width, height: 5 },
  recBox: { x: MARGINS.left, y: 93, width: CONTENT_AREA.width, height: 80 },
};

// ============================================================================
// PDF Generator Class
// ============================================================================

export class SegmentReportPDFGeneratorV2 {
  private renderer: PoliticalTemplateRenderer;
  private pdf: jsPDF;
  private totalPages: number = 2;

  constructor() {
    this.renderer = createPoliticalRenderer();
    this.pdf = this.renderer.getPdf();
  }

  async generateReport(config: SegmentReportConfig): Promise<Blob> {
    console.log('[SegmentReportPDFGeneratorV2] Starting generation:', config.segmentName);

    // Validate configuration
    const validation = validateRequiredFields(
      config as unknown as Record<string, unknown>,
      ['segmentName', 'filters', 'summary', 'precincts', 'county', 'state'],
      'SegmentReportConfig'
    );
    logValidationWarnings(validation, 'SegmentReportPDFGeneratorV2');

    // Calculate total pages
    const precinctsPerPage = 30;
    const precinctPages = Math.ceil(config.precincts.length / precinctsPerPage);
    const hasDemoPage = config.demographics || config.recommendations?.length;
    this.totalPages = 1 + precinctPages + (hasDemoPage ? 1 : 0);

    // Page 1: Definition + Summary
    this.buildPage1(config);

    // Precinct list pages
    for (let i = 0; i < precinctPages; i++) {
      this.pdf.addPage();
      const startIdx = i * precinctsPerPage;
      const endIdx = Math.min(startIdx + precinctsPerPage, config.precincts.length);
      this.buildPrecinctPage(config, config.precincts.slice(startIdx, endIdx), i + 1, precinctPages);
    }

    // Demographics & Recommendations page
    if (hasDemoPage) {
      this.pdf.addPage();
      this.buildDemographicsPage(config);
    }

    const pdfBlob = this.pdf.output('blob');
    console.log('[SegmentReportPDFGeneratorV2] Generation complete');
    return pdfBlob;
  }

  private buildPage1(config: SegmentReportConfig): void {
    const t = SEGMENT_PAGE1_TEMPLATE;

    // ========================================================================
    // Header Section
    // ========================================================================

    // Header bar (purple for segments)
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.swing));
    this.pdf.rect(t.headerBar.x, t.headerBar.y, t.headerBar.width, t.headerBar.height, 'F');

    // Title
    this.pdf.setFontSize(14);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text('SEGMENT REPORT', t.headerTitle.x, t.headerTitle.y);

    // Date
    const reportDate = config.reportDate || formatDate(new Date());
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.text(reportDate, t.headerDate.x, t.headerDate.y);

    // Segment name
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.setFontSize(12);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.text(config.segmentName, t.segmentName.x, t.segmentName.y);

    // Description
    if (config.segmentDescription) {
      this.pdf.setFontSize(9);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      const lines = this.pdf.splitTextToSize(config.segmentDescription, t.segmentDesc.width);
      lines.slice(0, 2).forEach((line: string, i: number) => {
        this.pdf.text(line, t.segmentDesc.x, t.segmentDesc.y + i * 4);
      });
    }

    // Metadata
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textMuted));
    const metaText = [
      config.createdBy ? `Created by: ${config.createdBy}` : null,
      config.createdAt ? `Date: ${config.createdAt}` : null,
      `${config.county} County, ${config.state}`,
    ].filter(Boolean).join(' | ');
    this.pdf.text(metaText, t.segmentMeta.x, t.segmentMeta.y);

    // ========================================================================
    // Filter Criteria
    // ========================================================================

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('FILTER CRITERIA', t.filterTitle.x, t.filterTitle.y);

    // Filter box
    const filterBoxHeight = Math.min(40, config.filters.length * 7 + 8);
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.filterBox.x, t.filterBox.y, t.filterBox.width, filterBoxHeight, 'F');

    // Accent bar
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.swing));
    this.pdf.rect(t.filterBox.x, t.filterBox.y, 3, filterBoxHeight, 'F');

    // Filter items
    this.pdf.setFontSize(8);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));

    let filterY = t.filterBox.y + 6;
    config.filters.slice(0, 5).forEach(filter => {
      const filterText = this.formatFilter(filter);
      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.swing));
      this.pdf.circle(t.filterBox.x + 8, filterY - 1, 1.5, 'F');
      this.pdf.text(filterText, t.filterBox.x + 12, filterY);
      filterY += 7;
    });

    // ========================================================================
    // Summary Statistics
    // ========================================================================

    const kpiY = t.kpiRow.y;
    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('SUMMARY STATISTICS', t.summaryTitle.x, t.summaryTitle.y);

    const kpi = t.kpiRow;
    const m = config.summary;

    // Card 1: Precincts
    renderStatCard(this.pdf, kpi.x, kpiY, kpi.cardWidth, kpi.cardHeight, {
      label: 'Precincts',
      value: m.totalPrecincts.toLocaleString(),
    });

    // Card 2: Voters
    renderStatCard(this.pdf, kpi.x + kpi.cardWidth + kpi.gap, kpiY, kpi.cardWidth, kpi.cardHeight, {
      label: 'Total Voters',
      value: this.formatNumber(m.totalVoters),
    });

    // Card 3: Avg Swing
    renderScoreCard(this.pdf, kpi.x + 2 * (kpi.cardWidth + kpi.gap), kpiY, kpi.cardWidth, kpi.cardHeight, {
      label: 'Avg Swing',
      score: m.avgSwingPotential,
      metric: 'swing',
    });

    // Card 4: Avg GOTV
    renderScoreCard(this.pdf, kpi.x + 3 * (kpi.cardWidth + kpi.gap), kpiY, kpi.cardWidth, kpi.cardHeight, {
      label: 'Avg GOTV',
      score: m.avgGotvPriority,
      metric: 'gotv',
    });

    // Secondary stats row
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.secondaryStats.x, t.secondaryStats.y, t.secondaryStats.width, t.secondaryStats.height, 'F');

    const smallStats = [
      { label: 'Avg Turnout', value: `${m.avgTurnout.toFixed(1)}%` },
      { label: 'Avg Persuasion', value: `${m.avgPersuasion.toFixed(0)}/100` },
      { label: 'Avg Lean', value: formatPartisanLean(m.avgPartisanLean) },
    ];

    const smallWidth = t.secondaryStats.width / 3;
    smallStats.forEach((stat, i) => {
      const x = t.secondaryStats.x + i * smallWidth + 5;
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text(stat.label, x, t.secondaryStats.y + 6);
      this.pdf.setFontSize(11);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(stat.value, x, t.secondaryStats.y + 13);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
    });

    // ========================================================================
    // Score Distributions
    // ========================================================================

    if (config.distributions) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('SCORE DISTRIBUTIONS', t.distTitle.x, t.distTitle.y);

      const dist = t.distCharts;
      const distributions = [
        { label: 'Swing', data: config.distributions.swing, color: POLITICAL_COLORS.swing },
        { label: 'GOTV', data: config.distributions.gotv, color: POLITICAL_COLORS.gotv },
        { label: 'Persuasion', data: config.distributions.persuasion, color: POLITICAL_COLORS.persuasion },
      ];

      distributions.forEach((metric, i) => {
        const x = dist.x + i * (dist.chartWidth + dist.gap);
        this.renderMiniHistogram(metric.label, metric.data, x, dist.y, dist.chartWidth, dist.chartHeight, metric.color);
      });
    }

    // Footer
    this.renderer.renderPageFooter('Segment Report');
  }

  private buildPrecinctPage(
    config: SegmentReportConfig,
    precincts: SegmentPrecinctData[],
    pageNum: number,
    totalPrecinctPages: number
  ): void {
    const t = SEGMENT_PRECINCT_TABLE_TEMPLATE;

    // Page header
    const subtitle = totalPrecinctPages > 1 ? ` (${pageNum}/${totalPrecinctPages})` : '';
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.pageHeader.x, t.pageHeader.y, t.pageHeader.width, t.pageHeader.height, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text(`Matching Precincts${subtitle}`, t.pageHeader.x + 4, t.pageHeader.y + 7);

    // Table header
    let y = t.table.y;
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(t.table.x, y, t.table.width, t.table.headerHeight, 'F');

    this.pdf.setFontSize(6);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(71, 85, 105);

    let colX = t.table.x + 2;
    t.table.columns.forEach(col => {
      this.pdf.text(col.label, colX, y + 5.5);
      colX += col.width;
    });
    y += t.table.headerHeight;

    // Table rows
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    precincts.forEach((precinct, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
        this.pdf.rect(t.table.x, y, t.table.width, t.table.rowHeight, 'F');
      }

      colX = t.table.x + 2;
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));

      // Precinct name (truncate if needed)
      let name = precinct.name;
      while (this.pdf.getTextWidth(name) > 48 && name.length > 0) {
        name = name.slice(0, -1);
      }
      if (name !== precinct.name) name += '...';
      this.pdf.text(name, colX, y + 4.5);
      colX += t.table.columns[0].width;

      // Voters
      this.pdf.text(precinct.registeredVoters.toLocaleString(), colX, y + 4.5);
      colX += t.table.columns[1].width;

      // Partisan lean with color
      const lean = precinct.partisanLean;
      const leanColor = getPartisanColor(lean);
      this.pdf.setTextColor(...this.hexToRgb(leanColor));
      this.pdf.text(formatPartisanLean(lean), colX, y + 4.5);
      colX += t.table.columns[2].width;

      // Reset color for rest
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(precinct.swingPotential.toFixed(0), colX, y + 4.5);
      colX += t.table.columns[3].width;

      this.pdf.text(precinct.gotvPriority.toFixed(0), colX, y + 4.5);
      colX += t.table.columns[4].width;

      this.pdf.text(precinct.persuasionScore.toFixed(0), colX, y + 4.5);
      colX += t.table.columns[5].width;

      this.pdf.text(`${precinct.avgTurnout.toFixed(0)}%`, colX, y + 4.5);

      y += t.table.rowHeight;
    });

    // Footer
    this.renderer.renderPageFooter('Segment Report');
  }

  private buildDemographicsPage(config: SegmentReportConfig): void {
    const t = SEGMENT_DEMO_PAGE_TEMPLATE;

    // Page header
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.pageHeader.x, t.pageHeader.y, t.pageHeader.width, t.pageHeader.height, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text('Segment Profile & Recommendations', t.pageHeader.x + 4, t.pageHeader.y + 7);

    // Demographics
    if (config.demographics) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('AGGREGATE DEMOGRAPHICS', t.demoTitle.x, t.demoTitle.y);

      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
      this.pdf.rect(t.demoBox.x, t.demoBox.y, t.demoBox.width, t.demoBox.height, 'F');

      const demo = config.demographics;
      const stats = [
        { label: 'Total Population', value: demo.totalPopulation.toLocaleString() },
        { label: 'Median Age', value: `${demo.medianAge.toFixed(1)} years` },
        { label: 'Median Income', value: `$${demo.medianIncome.toLocaleString()}` },
        { label: 'College Educated', value: `${demo.collegeEducated.toFixed(1)}%` },
        { label: 'Area Type', value: demo.urbanRural.charAt(0).toUpperCase() + demo.urbanRural.slice(1) },
      ];

      const colWidth = t.demoBox.width / 3;
      stats.forEach((stat, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = t.demoBox.x + col * colWidth + 5;
        const statY = t.demoBox.y + 8 + row * 15;

        this.pdf.setFontSize(7);
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
        this.pdf.text(stat.label, x, statY);
        this.pdf.setFontSize(10);
        this.pdf.setFont(FONT_SPECS.family, 'bold');
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
        this.pdf.text(stat.value, x, statY + 6);
        this.pdf.setFont(FONT_SPECS.family, 'normal');
      });
    }

    // Recommendations
    if (config.recommendations?.length) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('STRATEGIC RECOMMENDATIONS', t.recTitle.x, t.recTitle.y);

      const boxHeight = Math.min(t.recBox.height, config.recommendations.length * 14 + 10);
      this.pdf.setFillColor(254, 243, 199);
      this.pdf.rect(t.recBox.x, t.recBox.y, t.recBox.width, boxHeight, 'F');

      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.persuasion));
      this.pdf.rect(t.recBox.x, t.recBox.y, 3, boxHeight, 'F');

      this.pdf.setFontSize(8);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));

      let recY = t.recBox.y + 8;
      config.recommendations.slice(0, 5).forEach(rec => {
        this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.persuasion));
        this.pdf.circle(t.recBox.x + 8, recY - 1, 1.5, 'F');
        const lines = this.pdf.splitTextToSize(rec, t.recBox.width - 18);
        lines.forEach((line: string, li: number) => {
          this.pdf.text(line, t.recBox.x + 12, recY + li * 4);
        });
        recY += lines.length * 4 + 6;
      });
    }

    // Footer
    this.renderer.renderPageFooter('Segment Report');
  }

  // ============================================================================
  // Render Helpers
  // ============================================================================

  private renderMiniHistogram(
    label: string,
    data: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): void {
    // Background
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(x, y, width, height, 'F');

    // Label
    this.pdf.setFontSize(7);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text(label, x + 2, y + 5);

    // Bars
    if (data.length > 0) {
      const maxVal = Math.max(...data, 1);
      const barWidth = (width - 4) / data.length;
      const maxBarHeight = height - 12;

      data.forEach((val, i) => {
        const barHeight = (val / maxVal) * maxBarHeight;
        this.pdf.setFillColor(...this.hexToRgb(color));
        this.pdf.rect(x + 2 + i * barWidth, y + height - 5 - barHeight, barWidth - 1, barHeight, 'F');
      });
    }

    // X-axis labels
    this.pdf.setFontSize(5);
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textMuted));
    this.pdf.text('0', x + 2, y + height - 1);
    this.pdf.text('100', x + width - 8, y + height - 1);
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

  private formatNumber(num: number): string {
    return formatNumberUtil(num);
  }

  private hexToRgb(hex: string): [number, number, number] {
    return hexToRgbUtil(hex);
  }
}

export default SegmentReportPDFGeneratorV2;
