/**
 * Comparison Report PDF Generator V2
 *
 * Uses fixed-position template system for consistent layouts.
 * Generates 2-4 page side-by-side comparison reports.
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
  renderPartisanLeanCard,
  renderScoreCard,
  renderStatCard,
} from './components/PoliticalKPICard';

import {
  renderComparisonTable,
} from './components/PoliticalTableRenderer';

import {
  PoliticalTemplateRenderer,
  createPoliticalRenderer,
} from './components/PoliticalTemplateRenderer';

import {
  hexToRgb as hexToRgbUtil,
  formatDate,
  validateRequiredFields,
  logValidationWarnings,
} from './utils';

// ============================================================================
// Configuration Types (preserved from V1 for compatibility)
// ============================================================================

export interface ComparisonEntityData {
  name: string;
  type: 'precinct' | 'municipality' | 'district' | 'segment';

  // Political scores
  partisanLean: number; // -100 to +100
  swingPotential: number; // 0-100
  gotvPriority: number; // 0-100
  persuasionOpportunity: number; // 0-100
  avgTurnout: number; // percentage

  // Demographics
  registeredVoters: number;
  totalPopulation: number;
  medianAge: number;
  medianIncome: number;
  collegeEducated: number; // percentage

  // Election history (last 3 elections)
  electionHistory?: Array<{
    year: number;
    demPct: number;
    repPct: number;
    turnout: number;
  }>;
}

export interface ComparisonReportConfig {
  entityA: ComparisonEntityData;
  entityB: ComparisonEntityData;
  comparisonTitle?: string;
  comparisonPurpose?: string;
  keyDifferences?: string[];
  strategicImplications?: string[];
  recommendation?: string;
  county: string;
  state: string;
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Fixed Position Templates
// ============================================================================

const COMPARISON_TEMPLATES = {
  page1: {
    // Header bar
    headerBar: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 16 },
    headerTitle: { x: MARGINS.left + 5, y: 25, width: 100, height: 10 },
    headerDate: { x: 150, y: 25, width: 45, height: 10 },

    // Entity labels
    entityALabel: { x: MARGINS.left, y: 38, width: 85, height: 12 },
    entityBLabel: { x: 110, y: 38, width: 85, height: 12 },

    // KPI card grid (2x2 for each entity)
    kpiRow1: { y: 55 },
    kpiRow2: { y: 88 },
    cardWidth: 40,
    cardHeight: 28,

    // Summary table
    summaryTitle: { x: MARGINS.left, y: 125, width: 100, height: 6 },
    summaryTable: { x: MARGINS.left, y: 133, width: CONTENT_AREA.width, height: 35 },

    // Visual comparison bars
    barsTitle: { x: MARGINS.left, y: 175, width: 100, height: 6 },
    bars: { x: MARGINS.left, y: 185, width: CONTENT_AREA.width, height: 60 },
  },
  page2: {
    pageTitle: { x: MARGINS.left, y: 35, width: CONTENT_AREA.width, height: 8 },
    demoTitle: { x: MARGINS.left, y: 48, width: 100, height: 5 },
    demoTable: { x: MARGINS.left, y: 55, width: CONTENT_AREA.width, height: 50 },
    polTitle: { x: MARGINS.left, y: 115, width: 100, height: 5 },
    polTable: { x: MARGINS.left, y: 122, width: CONTENT_AREA.width, height: 50 },
    historyTitle: { x: MARGINS.left, y: 180, width: 100, height: 5 },
    historyTable: { x: MARGINS.left, y: 188, width: CONTENT_AREA.width, height: 50 },
  },
  page3: {
    pageTitle: { x: MARGINS.left, y: 35, width: CONTENT_AREA.width, height: 8 },
    differencesSection: { x: MARGINS.left, y: 50, width: CONTENT_AREA.width, height: 70 },
    implicationsSection: { x: MARGINS.left, y: 130, width: CONTENT_AREA.width, height: 70 },
    recommendationSection: { x: MARGINS.left, y: 210, width: CONTENT_AREA.width, height: 40 },
  },
};

// ============================================================================
// PDF Generator Class
// ============================================================================

export class ComparisonReportPDFGeneratorV2 {
  private renderer: PoliticalTemplateRenderer;
  private pdf: jsPDF;
  private currentPage: number = 1;

  constructor() {
    this.renderer = createPoliticalRenderer();
    this.pdf = this.renderer.getPdf();
  }

  async generateReport(config: ComparisonReportConfig): Promise<Blob> {
    console.log('[ComparisonReportPDFGeneratorV2] Starting generation:', config.entityA.name, 'vs', config.entityB.name);

    // Validate configuration
    const validation = validateRequiredFields(
      config as unknown as Record<string, unknown>,
      ['entityA', 'entityB', 'county', 'state'],
      'ComparisonReportConfig'
    );
    logValidationWarnings(validation, 'ComparisonReportPDFGeneratorV2');

    // Page 1: Overview with KPIs
    this.buildPage1(config);

    // Page 2: Detailed metrics
    this.renderer.addPage();
    this.currentPage++;
    this.buildPage2(config);

    // Page 3: AI Insights (if available)
    if (config.keyDifferences?.length || config.strategicImplications?.length || config.recommendation) {
      this.renderer.addPage();
      this.currentPage++;
      this.buildPage3(config);
    }

    const pdfBlob = this.pdf.output('blob');
    console.log('[ComparisonReportPDFGeneratorV2] Generation complete');
    return pdfBlob;
  }

  // ============================================================================
  // Page Building Methods
  // ============================================================================

  private buildPage1(config: ComparisonReportConfig): void {
    const t = COMPARISON_TEMPLATES.page1;

    // Header bar
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.primary));
    this.pdf.rect(t.headerBar.x, t.headerBar.y, t.headerBar.width, t.headerBar.height, 'F');

    // Title
    this.pdf.setFontSize(14);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text((config.comparisonTitle || 'COMPARISON REPORT').toUpperCase(), t.headerTitle.x, t.headerTitle.y);

    // Date
    const reportDate = config.reportDate || formatDate(new Date());
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.text(reportDate, 180, t.headerDate.y, { align: 'right' });

    // Location subtitle
    this.pdf.setFontSize(9);
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text(`${config.county} County, ${config.state}`, MARGINS.left, 33);

    // Entity A label (blue)
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.democrat));
    this.pdf.rect(t.entityALabel.x, t.entityALabel.y, t.entityALabel.width, t.entityALabel.height, 'F');
    this.pdf.setFontSize(11);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text(config.entityA.name, t.entityALabel.x + t.entityALabel.width / 2, t.entityALabel.y + 8, { align: 'center' });

    // Entity B label (purple)
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.swing));
    this.pdf.rect(t.entityBLabel.x, t.entityBLabel.y, t.entityBLabel.width, t.entityBLabel.height, 'F');
    this.pdf.text(config.entityB.name, t.entityBLabel.x + t.entityBLabel.width / 2, t.entityBLabel.y + 8, { align: 'center' });

    // KPI Cards - Row 1
    const row1Y = t.kpiRow1.y;
    const cw = t.cardWidth;
    const ch = t.cardHeight;
    const gap = 5;

    // Entity A: Partisan Lean
    renderPartisanLeanCard(this.pdf, MARGINS.left, row1Y, cw, ch, {
      lean: config.entityA.partisanLean,
    });

    // Entity A: Swing
    renderScoreCard(this.pdf, MARGINS.left + cw + gap, row1Y, cw, ch, {
      label: 'Swing',
      score: config.entityA.swingPotential,
      metric: 'swing',
    });

    // Entity B: Partisan Lean
    renderPartisanLeanCard(this.pdf, 110, row1Y, cw, ch, {
      lean: config.entityB.partisanLean,
    });

    // Entity B: Swing
    renderScoreCard(this.pdf, 110 + cw + gap, row1Y, cw, ch, {
      label: 'Swing',
      score: config.entityB.swingPotential,
      metric: 'swing',
    });

    // KPI Cards - Row 2
    const row2Y = t.kpiRow2.y;

    // Entity A: GOTV
    renderScoreCard(this.pdf, MARGINS.left, row2Y, cw, ch, {
      label: 'GOTV',
      score: config.entityA.gotvPriority,
      metric: 'gotv',
    });

    // Entity A: Persuasion
    renderScoreCard(this.pdf, MARGINS.left + cw + gap, row2Y, cw, ch, {
      label: 'Persuasion',
      score: config.entityA.persuasionOpportunity,
      metric: 'persuasion',
    });

    // Entity B: GOTV
    renderScoreCard(this.pdf, 110, row2Y, cw, ch, {
      label: 'GOTV',
      score: config.entityB.gotvPriority,
      metric: 'gotv',
    });

    // Entity B: Persuasion
    renderScoreCard(this.pdf, 110 + cw + gap, row2Y, cw, ch, {
      label: 'Persuasion',
      score: config.entityB.persuasionOpportunity,
      metric: 'persuasion',
    });

    // Summary table
    this.renderer.renderText(
      { x: t.summaryTitle.x, y: t.summaryTitle.y, width: t.summaryTitle.width, height: t.summaryTitle.height, fontSize: 10, font: FONT_SPECS.family },
      'QUICK SUMMARY',
      { fontWeight: 'bold', color: POLITICAL_COLORS.textSecondary }
    );

    const summaryMetrics = [
      { label: 'Registered Voters', entityAValue: config.entityA.registeredVoters.toLocaleString(), entityBValue: config.entityB.registeredVoters.toLocaleString() },
      { label: 'Avg Turnout', entityAValue: `${config.entityA.avgTurnout.toFixed(1)}%`, entityBValue: `${config.entityB.avgTurnout.toFixed(1)}%` },
      { label: 'Partisan Lean', entityAValue: formatPartisanLean(config.entityA.partisanLean), entityBValue: formatPartisanLean(config.entityB.partisanLean) },
    ];

    renderComparisonTable(
      this.pdf,
      summaryMetrics,
      t.summaryTable.x,
      t.summaryTable.y,
      t.summaryTable.width,
      config.entityA.name,
      config.entityB.name
    );

    // Visual comparison bars
    this.renderer.renderText(
      { x: t.barsTitle.x, y: t.barsTitle.y, width: t.barsTitle.width, height: t.barsTitle.height, fontSize: 10, font: FONT_SPECS.family },
      'VISUAL COMPARISON',
      { fontWeight: 'bold', color: POLITICAL_COLORS.textSecondary }
    );

    this.drawComparisonBars(config, t.bars.y);

    this.renderer.renderPageFooter('Comparison Report');
  }

  private buildPage2(config: ComparisonReportConfig): void {
    const t = COMPARISON_TEMPLATES.page2;

    this.renderer.renderPageHeader(this.currentPage, 'Detailed Comparison');

    // Page title
    this.renderer.renderText(
      { x: t.pageTitle.x, y: t.pageTitle.y, width: t.pageTitle.width, height: t.pageTitle.height, fontSize: 14, font: FONT_SPECS.family },
      'Detailed Comparison',
      { fontWeight: 'bold', color: POLITICAL_COLORS.primary }
    );

    // Demographic comparison
    this.renderer.renderText(
      { x: t.demoTitle.x, y: t.demoTitle.y, width: t.demoTitle.width, height: t.demoTitle.height, fontSize: 10, font: FONT_SPECS.family },
      'DEMOGRAPHIC COMPARISON',
      { fontWeight: 'bold', color: POLITICAL_COLORS.textSecondary }
    );

    const demoMetrics = [
      { label: 'Population', entityAValue: config.entityA.totalPopulation.toLocaleString(), entityBValue: config.entityB.totalPopulation.toLocaleString(), difference: this.formatDiff(config.entityB.totalPopulation - config.entityA.totalPopulation) },
      { label: 'Median Age', entityAValue: `${config.entityA.medianAge}`, entityBValue: `${config.entityB.medianAge}`, difference: this.formatDiff(config.entityB.medianAge - config.entityA.medianAge, 'yrs') },
      { label: 'Median Income', entityAValue: `$${(config.entityA.medianIncome / 1000).toFixed(0)}k`, entityBValue: `$${(config.entityB.medianIncome / 1000).toFixed(0)}k`, difference: this.formatDiff((config.entityB.medianIncome - config.entityA.medianIncome) / 1000, 'k') },
      { label: 'College Degree', entityAValue: `${config.entityA.collegeEducated.toFixed(0)}%`, entityBValue: `${config.entityB.collegeEducated.toFixed(0)}%`, difference: this.formatDiff(config.entityB.collegeEducated - config.entityA.collegeEducated, 'pts') },
    ];

    renderComparisonTable(
      this.pdf,
      demoMetrics,
      t.demoTable.x,
      t.demoTable.y,
      t.demoTable.width,
      config.entityA.name,
      config.entityB.name
    );

    // Political comparison
    this.renderer.renderText(
      { x: t.polTitle.x, y: t.polTitle.y, width: t.polTitle.width, height: t.polTitle.height, fontSize: 10, font: FONT_SPECS.family },
      'POLITICAL COMPARISON',
      { fontWeight: 'bold', color: POLITICAL_COLORS.textSecondary }
    );

    const polMetrics = [
      { label: 'Partisan Lean', entityAValue: formatPartisanLean(config.entityA.partisanLean), entityBValue: formatPartisanLean(config.entityB.partisanLean), difference: `${Math.abs(config.entityB.partisanLean - config.entityA.partisanLean).toFixed(1)} pts` },
      { label: 'Swing Potential', entityAValue: `${config.entityA.swingPotential.toFixed(0)}`, entityBValue: `${config.entityB.swingPotential.toFixed(0)}`, difference: this.formatDiff(config.entityB.swingPotential - config.entityA.swingPotential, 'pts') },
      { label: 'GOTV Priority', entityAValue: `${config.entityA.gotvPriority.toFixed(0)}`, entityBValue: `${config.entityB.gotvPriority.toFixed(0)}`, difference: this.formatDiff(config.entityB.gotvPriority - config.entityA.gotvPriority, 'pts') },
      { label: 'Persuasion', entityAValue: `${config.entityA.persuasionOpportunity.toFixed(0)}`, entityBValue: `${config.entityB.persuasionOpportunity.toFixed(0)}`, difference: this.formatDiff(config.entityB.persuasionOpportunity - config.entityA.persuasionOpportunity, 'pts') },
      { label: 'Avg Turnout', entityAValue: `${config.entityA.avgTurnout.toFixed(1)}%`, entityBValue: `${config.entityB.avgTurnout.toFixed(1)}%`, difference: this.formatDiff(config.entityB.avgTurnout - config.entityA.avgTurnout, 'pts') },
    ];

    renderComparisonTable(
      this.pdf,
      polMetrics,
      t.polTable.x,
      t.polTable.y,
      t.polTable.width,
      config.entityA.name,
      config.entityB.name
    );

    // Electoral history if available
    if (config.entityA.electionHistory?.length && config.entityB.electionHistory?.length) {
      this.renderer.renderText(
        { x: t.historyTitle.x, y: t.historyTitle.y, width: t.historyTitle.width, height: t.historyTitle.height, fontSize: 10, font: FONT_SPECS.family },
        'ELECTORAL HISTORY',
        { fontWeight: 'bold', color: POLITICAL_COLORS.textSecondary }
      );

      const historyMetrics = config.entityA.electionHistory.slice(0, 3).map((elecA, i) => {
        const elecB = config.entityB.electionHistory?.[i];
        return {
          label: `${elecA.year}`,
          entityAValue: `D ${elecA.demPct.toFixed(1)}% / R ${elecA.repPct.toFixed(1)}%`,
          entityBValue: elecB ? `D ${elecB.demPct.toFixed(1)}% / R ${elecB.repPct.toFixed(1)}%` : 'N/A',
        };
      });

      renderComparisonTable(
        this.pdf,
        historyMetrics,
        t.historyTable.x,
        t.historyTable.y,
        t.historyTable.width,
        config.entityA.name,
        config.entityB.name
      );
    }

    this.renderer.renderPageFooter('Comparison Report');
  }

  private buildPage3(config: ComparisonReportConfig): void {
    const t = COMPARISON_TEMPLATES.page3;

    this.renderer.renderPageHeader(this.currentPage, 'Analysis & Recommendations');

    // Page title
    this.renderer.renderText(
      { x: t.pageTitle.x, y: t.pageTitle.y, width: t.pageTitle.width, height: t.pageTitle.height, fontSize: 14, font: FONT_SPECS.family },
      'Analysis & Recommendations',
      { fontWeight: 'bold', color: POLITICAL_COLORS.primary }
    );

    let currentY = 55;

    // Key differences
    if (config.keyDifferences?.length) {
      currentY = this.renderInsightSection('Key Differences', config.keyDifferences, currentY, POLITICAL_COLORS.democrat);
    }

    // Strategic implications
    if (config.strategicImplications?.length) {
      currentY = this.renderInsightSection('Strategic Implications', config.strategicImplications, currentY, POLITICAL_COLORS.swing);
    }

    // Recommendation
    if (config.recommendation) {
      this.renderRecommendation(config.recommendation, currentY);
    }

    this.renderer.renderPageFooter('Comparison Report');
  }

  // ============================================================================
  // Drawing Helpers
  // ============================================================================

  private drawComparisonBars(config: ComparisonReportConfig, startY: number): void {
    const metrics = [
      { label: 'Swing Potential', a: config.entityA.swingPotential, b: config.entityB.swingPotential },
      { label: 'GOTV Priority', a: config.entityA.gotvPriority, b: config.entityB.gotvPriority },
      { label: 'Persuasion', a: config.entityA.persuasionOpportunity, b: config.entityB.persuasionOpportunity },
    ];

    const barHeight = 8;
    const maxBarWidth = 60;
    const centerX = MARGINS.left + 50 + maxBarWidth;
    let y = startY;

    metrics.forEach(metric => {
      // Label
      this.pdf.setFontSize(8);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text(metric.label, MARGINS.left, y + 5);

      // Entity A bar (blue, grows left)
      const aWidth = (metric.a / 100) * maxBarWidth;
      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.democrat));
      this.pdf.rect(centerX - aWidth, y, aWidth, barHeight, 'F');

      // Entity B bar (purple, grows right)
      const bWidth = (metric.b / 100) * maxBarWidth;
      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.swing));
      this.pdf.rect(centerX, y, bWidth, barHeight, 'F');

      // Center line
      this.pdf.setDrawColor(...this.hexToRgb(POLITICAL_COLORS.textMuted));
      this.pdf.setLineWidth(0.3);
      this.pdf.line(centerX, y - 1, centerX, y + barHeight + 1);

      // Values
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(255, 255, 255);
      if (aWidth > 15) this.pdf.text(`${metric.a.toFixed(0)}`, centerX - aWidth + 3, y + 5.5);
      if (bWidth > 15) this.pdf.text(`${metric.b.toFixed(0)}`, centerX + 3, y + 5.5);

      y += barHeight + 8;
    });
  }

  private renderInsightSection(title: string, items: string[], startY: number, accentColor: string): number {
    const width = CONTENT_AREA.width;
    const sectionHeight = 12 + items.length * 14;

    // Background
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.cardBg));
    this.pdf.rect(MARGINS.left, startY, width, sectionHeight, 'F');

    // Accent bar
    this.pdf.setFillColor(...this.hexToRgb(accentColor));
    this.pdf.rect(MARGINS.left, startY, 3, sectionHeight, 'F');

    // Title
    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text(title, MARGINS.left + 8, startY + 8);

    // Items
    let y = startY + 16;
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');

    items.forEach(item => {
      this.pdf.setFillColor(...this.hexToRgb(accentColor));
      this.pdf.circle(MARGINS.left + 10, y - 1.5, 1.5, 'F');
      const lines = this.pdf.splitTextToSize(item, width - 20);
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      lines.forEach((line: string, i: number) => {
        this.pdf.text(line, MARGINS.left + 15, y + i * 4);
      });
      y += lines.length * 4 + 6;
    });

    return startY + sectionHeight + 10;
  }

  private renderRecommendation(recommendation: string, startY: number): void {
    const width = CONTENT_AREA.width;

    // Background (amber)
    this.pdf.setFillColor(254, 243, 199);
    this.pdf.rect(MARGINS.left, startY, width, 30, 'F');

    // Accent bar
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.persuasion));
    this.pdf.rect(MARGINS.left, startY, 3, 30, 'F');

    // Label
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(146, 64, 14);
    this.pdf.text('RECOMMENDATION', MARGINS.left + 8, startY + 8);

    // Text
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    const lines = this.pdf.splitTextToSize(recommendation, width - 15);
    lines.forEach((line: string, i: number) => {
      this.pdf.text(line, MARGINS.left + 8, startY + 16 + i * 4.5);
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private formatDiff(diff: number, suffix: string = ''): string {
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(diff < 10 && diff > -10 ? 1 : 0)}${suffix}`;
  }

  private hexToRgb(hex: string): [number, number, number] {
    return hexToRgbUtil(hex);
  }
}

export default ComparisonReportPDFGeneratorV2;
