/**
 * Targeting Brief PDF Generator V2
 *
 * Uses fixed-position template system for consistent layouts.
 * Generates 1-2 page targeting reports with ranked precinct lists.
 *
 * @version 2.0.0
 */

import jsPDF from 'jspdf';

import {
  PAGE_DIMENSIONS,
  MARGINS,
  CONTENT_AREA,
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
  renderPrecinctRankingTable,
} from './components/PoliticalTableRenderer';

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

export interface PrecinctTargetingData {
  rank: number;
  name: string;
  jurisdiction: string;
  gotvScore: number;
  persuasionScore: number;
  swingPotential: number;
  partisanLean: number;
  registeredVoters: number;
  avgTurnout: number;
  priorityTier: 'High' | 'Medium' | 'Low';
}

export interface TargetingBriefConfig {
  reportTitle: string;
  segmentName?: string;
  filterCriteria?: string[];

  summary: {
    totalPrecincts: number;
    totalVoters: number;
    avgGotvScore: number;
    avgPersuasionScore: number;
    avgSwingPotential: number;
    highPriorityCount: number;
  };

  precincts: PrecinctTargetingData[];

  county: string;
  state: string;
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Fixed Position Templates
// ============================================================================

const TARGETING_TEMPLATE = {
  // Header
  headerBar: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 14 },
  headerTitle: { x: MARGINS.left + 4, y: 24, width: 120, height: 10 },
  headerDate: { x: 160, y: 24, width: 35, height: 10 },

  // Segment info
  segmentName: { x: MARGINS.left, y: 33, width: CONTENT_AREA.width, height: 6 },
  location: { x: MARGINS.left, y: 39, width: CONTENT_AREA.width, height: 5 },

  // KPI cards (5 in a row)
  kpiRow: { x: MARGINS.left, y: 48, cardWidth: 34, cardHeight: 22, gap: 3 },

  // Filter criteria
  filters: { x: MARGINS.left, y: 75, width: CONTENT_AREA.width, height: 12 },

  // Table
  tableHeader: { x: MARGINS.left, y: 92, width: CONTENT_AREA.width, height: 8 },
  tableStart: { y: 101 },
  rowHeight: 7,

  // Legend
  legend: { x: MARGINS.left, y: 240, width: CONTENT_AREA.width, height: 20 },
};

// ============================================================================
// PDF Generator Class
// ============================================================================

export class TargetingBriefPDFGeneratorV2 {
  private renderer: PoliticalTemplateRenderer;
  private pdf: jsPDF;
  private currentPage: number = 1;
  private totalPages: number = 1;

  constructor() {
    this.renderer = createPoliticalRenderer();
    this.pdf = this.renderer.getPdf();
  }

  async generateReport(config: TargetingBriefConfig): Promise<Blob> {
    console.log('[TargetingBriefPDFGeneratorV2] Starting generation:', config.reportTitle);

    // Validate configuration
    const validation = validateRequiredFields(
      config as unknown as Record<string, unknown>,
      ['reportTitle', 'summary', 'precincts', 'county', 'state'],
      'TargetingBriefConfig'
    );
    logValidationWarnings(validation, 'TargetingBriefPDFGeneratorV2');

    // Calculate pages needed
    const rowsPerFirstPage = 18;
    const rowsPerContinuedPage = 25;
    if (config.precincts.length <= rowsPerFirstPage) {
      this.totalPages = 1;
    } else {
      this.totalPages = 1 + Math.ceil((config.precincts.length - rowsPerFirstPage) / rowsPerContinuedPage);
    }

    this.buildPages(config);

    const pdfBlob = this.pdf.output('blob');
    console.log('[TargetingBriefPDFGeneratorV2] Generation complete');
    return pdfBlob;
  }

  private buildPages(config: TargetingBriefConfig): void {
    const t = TARGETING_TEMPLATE;

    // ========================================================================
    // Header
    // ========================================================================

    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.primary));
    this.pdf.rect(t.headerBar.x, t.headerBar.y, t.headerBar.width, t.headerBar.height, 'F');

    this.pdf.setFontSize(12);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text(config.reportTitle.toUpperCase(), t.headerTitle.x, t.headerTitle.y);

    const reportDate = config.reportDate || formatDate(new Date());
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.text(reportDate, 180, t.headerDate.y, { align: 'right' });

    // Segment name
    if (config.segmentName) {
      this.pdf.setFontSize(11);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(config.segmentName, t.segmentName.x, t.segmentName.y);
    }

    // Location
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text(`${config.county} County, ${config.state}`, t.location.x, t.location.y);

    // ========================================================================
    // KPI Cards Row
    // ========================================================================

    const kpi = t.kpiRow;
    const s = config.summary;

    renderStatCard(this.pdf, kpi.x, kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Precincts',
      value: s.totalPrecincts.toString(),
    });

    renderStatCard(this.pdf, kpi.x + kpi.cardWidth + kpi.gap, kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Voters',
      value: this.formatNumber(s.totalVoters),
    });

    renderScoreCard(this.pdf, kpi.x + 2 * (kpi.cardWidth + kpi.gap), kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Avg GOTV',
      score: s.avgGotvScore,
      metric: 'gotv',
    });

    renderScoreCard(this.pdf, kpi.x + 3 * (kpi.cardWidth + kpi.gap), kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Avg Persuasion',
      score: s.avgPersuasionScore,
      metric: 'persuasion',
    });

    renderStatCard(this.pdf, kpi.x + 4 * (kpi.cardWidth + kpi.gap), kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'High Priority',
      value: s.highPriorityCount.toString(),
    });

    // ========================================================================
    // Filter Criteria
    // ========================================================================

    if (config.filterCriteria?.length) {
      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.cardBg));
      this.pdf.rect(t.filters.x, t.filters.y, t.filters.width, t.filters.height, 'F');

      this.pdf.setFontSize(8);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('FILTERS:', t.filters.x + 3, t.filters.y + 5);

      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(config.filterCriteria.join(' | '), t.filters.x + 22, t.filters.y + 5);
    }

    // ========================================================================
    // Precinct Table
    // ========================================================================

    // Table header
    let currentY = config.filterCriteria?.length ? t.tableHeader.y : t.tableHeader.y - 15;
    currentY = this.renderTableHeader(currentY);

    // Table rows
    let rowIndex = 0;
    for (const precinct of config.precincts) {
      // Check for page break
      if (currentY > PAGE_DIMENSIONS.height - 40) {
        this.renderer.renderPageFooter('Targeting Brief');
        this.renderer.addPage();
        this.currentPage++;

        // Continuation header
        this.pdf.setFontSize(10);
        this.pdf.setFont(FONT_SPECS.family, 'bold');
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
        this.pdf.text(`${config.reportTitle} (continued)`, MARGINS.left, 20);

        currentY = 28;
        currentY = this.renderTableHeader(currentY);
      }

      currentY = this.renderPrecinctRow(precinct, rowIndex, currentY);
      rowIndex++;
    }

    // ========================================================================
    // Legend
    // ========================================================================

    if (currentY < PAGE_DIMENSIONS.height - 50) {
      this.renderLegend(currentY + 8);
    }

    this.renderer.renderPageFooter('Targeting Brief');
  }

  private renderTableHeader(startY: number): number {
    const cols = this.getColumnPositions();

    // Header background
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.cardBg));
    this.pdf.rect(MARGINS.left, startY, CONTENT_AREA.width, 8, 'F');

    // Column headers
    this.pdf.setFontSize(7);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));

    this.pdf.text('#', cols.rank, startY + 5);
    this.pdf.text('PRECINCT', cols.name, startY + 5);
    this.pdf.text('GOTV', cols.gotv, startY + 5);
    this.pdf.text('PERS', cols.persuasion, startY + 5);
    this.pdf.text('SWING', cols.swing, startY + 5);
    this.pdf.text('LEAN', cols.lean, startY + 5);
    this.pdf.text('VOTERS', cols.voters, startY + 5);
    this.pdf.text('PRIORITY', cols.priority, startY + 5);

    // Bottom border
    this.pdf.setDrawColor(...this.hexToRgb(POLITICAL_COLORS.border));
    this.pdf.setLineWidth(0.3);
    this.pdf.line(MARGINS.left, startY + 8, MARGINS.left + CONTENT_AREA.width, startY + 8);

    return startY + 9;
  }

  private renderPrecinctRow(precinct: PrecinctTargetingData, index: number, startY: number): number {
    const cols = this.getColumnPositions();
    const rowHeight = 7;

    // Alternating background
    if (index % 2 === 0) {
      this.pdf.setFillColor(248, 250, 252);
      this.pdf.rect(MARGINS.left, startY, CONTENT_AREA.width, rowHeight, 'F');
    }

    this.pdf.setFontSize(7);

    // Rank
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text(precinct.rank.toString(), cols.rank + 2, startY + 5);

    // Name (truncate if needed)
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    let displayName = precinct.name;
    const maxNameWidth = 52;
    if (this.pdf.getTextWidth(displayName) > maxNameWidth) {
      while (this.pdf.getTextWidth(displayName + '...') > maxNameWidth && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '...';
    }
    this.pdf.text(displayName, cols.name, startY + 5);

    // GOTV Score
    this.setScoreColor(precinct.gotvScore);
    this.pdf.text(precinct.gotvScore.toFixed(0), cols.gotv + 3, startY + 5);

    // Persuasion Score
    this.setScoreColor(precinct.persuasionScore);
    this.pdf.text(precinct.persuasionScore.toFixed(0), cols.persuasion + 3, startY + 5);

    // Swing
    this.setScoreColor(precinct.swingPotential);
    this.pdf.text(precinct.swingPotential.toFixed(0), cols.swing + 3, startY + 5);

    // Partisan Lean
    const leanColor = getPartisanColor(precinct.partisanLean);
    this.pdf.setTextColor(...this.hexToRgb(leanColor));
    this.pdf.text(formatPartisanLean(precinct.partisanLean), cols.lean, startY + 5);

    // Voters
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text(this.formatNumber(precinct.registeredVoters), cols.voters, startY + 5);

    // Priority badge
    this.renderPriorityBadge(precinct.priorityTier, cols.priority, startY + 1);

    return startY + rowHeight;
  }

  private renderPriorityBadge(tier: 'High' | 'Medium' | 'Low', x: number, y: number): void {
    const badgeWidth = 18;
    const badgeHeight = 5;

    const colors: Record<string, { bg: string; text: string }> = {
      High: { bg: '#DC2626', text: '#FFFFFF' },
      Medium: { bg: '#F59E0B', text: '#1E293B' },
      Low: { bg: '#6B7280', text: '#FFFFFF' },
    };

    const color = colors[tier];

    this.pdf.setFillColor(...this.hexToRgb(color.bg));
    this.pdf.roundedRect(x, y, badgeWidth, badgeHeight, 1, 1, 'F');

    this.pdf.setFontSize(6);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(color.text));
    this.pdf.text(tier, x + badgeWidth / 2, y + 3.5, { align: 'center' });
  }

  private renderLegend(startY: number): void {
    this.pdf.setDrawColor(...this.hexToRgb(POLITICAL_COLORS.border));
    this.pdf.setLineWidth(0.3);
    this.pdf.line(MARGINS.left, startY, MARGINS.left + CONTENT_AREA.width, startY);

    this.pdf.setFontSize(8);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('SCORE INTERPRETATION', MARGINS.left, startY + 6);

    const legendItems = [
      { label: 'GOTV Score', desc: 'Get-out-the-vote priority' },
      { label: 'Persuasion', desc: 'Persuadable voter proportion' },
      { label: 'Swing', desc: 'Likelihood of partisan change' },
      { label: 'Priority', desc: 'High = 70+, Med = 50-69, Low = <50' },
    ];

    this.pdf.setFontSize(7);
    const colWidth = CONTENT_AREA.width / 2;

    legendItems.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MARGINS.left + col * colWidth;
      const y = startY + 12 + row * 6;

      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text(`${item.label}: `, x, y);

      const labelWidth = this.pdf.getTextWidth(`${item.label}: `);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.text(item.desc, x + labelWidth, y);
    });
  }

  private getColumnPositions(): Record<string, number> {
    return {
      rank: MARGINS.left,
      name: MARGINS.left + 10,
      gotv: MARGINS.left + 62,
      persuasion: MARGINS.left + 78,
      swing: MARGINS.left + 96,
      lean: MARGINS.left + 114,
      voters: MARGINS.left + 134,
      priority: MARGINS.left + 158,
    };
  }

  private setScoreColor(score: number): void {
    if (score >= 70) {
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
    } else if (score >= 50) {
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.persuasion));
    } else {
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textMuted));
    }
  }

  private formatNumber(num: number): string {
    return formatNumberUtil(num);
  }

  private hexToRgb(hex: string): [number, number, number] {
    return hexToRgbUtil(hex);
  }
}

export default TargetingBriefPDFGeneratorV2;
