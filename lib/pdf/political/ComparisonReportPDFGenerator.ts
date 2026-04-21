/**
 * Comparison Report PDF Generator
 *
 * Generates 2-4 page side-by-side comparison reports
 * Perfect for A/B analysis, resource allocation decisions, and strategy planning
 *
 * Pages:
 * 1. Header + Side-by-Side KPIs with winner indicators
 * 2. Demographic Comparison (population, age, income, education)
 * 3. Political Comparison (partisan lean, registration, ideology) + Electoral History
 * 4. AI Insights (key differences and strategic implications)
 */

import jsPDF from 'jspdf';
import { renderKPICard, BRAND_COLORS } from '../components/KPICard';

// ============================================================================
// Configuration Types
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
  // The two entities being compared
  entityA: ComparisonEntityData;
  entityB: ComparisonEntityData;

  // Comparison metadata
  comparisonTitle?: string;
  comparisonPurpose?: string; // e.g., "Resource Allocation", "Strategy Planning"

  // AI-generated insights
  keyDifferences?: string[];
  strategicImplications?: string[];
  recommendation?: string;

  // Location context
  county: string;
  state: string;

  // Optional
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Political-specific colors
// ============================================================================

const POLITICAL_COLORS = {
  democrat: '#2E5EAA',
  republican: '#C93135',
  entityA: '#3B82F6', // Blue for entity A
  entityB: '#8B5CF6', // Purple for entity B
  winner: '#059669', // Green for winner
  loser: '#DC2626', // Red for worse
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

export class ComparisonReportPDFGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 12;
  private currentPage: number = 1;

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'letter');
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.pageHeight = this.pdf.internal.pageSize.height;
  }

  /**
   * Generate Comparison Report PDF
   */
  async generateReport(config: ComparisonReportConfig): Promise<Blob> {
    console.log('[ComparisonReportPDFGenerator] Starting PDF generation');

    try {
      this.buildPage1(config);
      this.addNewPage();
      this.buildPage2(config);
      this.addNewPage();
      this.buildPage3(config);

      // Only add page 4 if we have AI insights
      if (config.keyDifferences?.length || config.strategicImplications?.length || config.recommendation) {
        this.addNewPage();
        this.buildPage4(config);
      }

      const pdfBlob = this.pdf.output('blob');
      console.log('[ComparisonReportPDFGenerator] PDF generation complete');
      return pdfBlob;
    } catch (error) {
      console.error('[ComparisonReportPDFGenerator] Error:', error);
      throw error;
    }
  }

  /**
   * Page 1: Header + Side-by-Side KPIs
   */
  private buildPage1(config: ComparisonReportConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Header
    y = this.renderHeader(config, y, contentWidth);

    // Entity labels
    y = this.renderEntityLabels(config, y, contentWidth);

    // Side-by-side KPI comparison
    y = this.renderKPIComparison(config, y, contentWidth);

    // Quick summary table
    y = this.renderQuickSummaryTable(config, y, contentWidth);

    this.renderFooter(config, 1);
  }

  /**
   * Page 2: Demographic Comparison
   */
  private buildPage2(config: ComparisonReportConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Page header
    y = this.renderPageHeader('Demographic Comparison', y, contentWidth);

    // Population comparison
    y = this.renderDemographicSection(config, y, contentWidth, 'Population & Voters', [
      { label: 'Total Population', valueA: config.entityA.totalPopulation, valueB: config.entityB.totalPopulation, format: 'number' },
      { label: 'Registered Voters', valueA: config.entityA.registeredVoters, valueB: config.entityB.registeredVoters, format: 'number' },
      { label: 'Median Age', valueA: config.entityA.medianAge, valueB: config.entityB.medianAge, format: 'decimal', suffix: ' years' },
    ]);

    // Income & Education
    y = this.renderDemographicSection(config, y, contentWidth, 'Income & Education', [
      { label: 'Median Income', valueA: config.entityA.medianIncome, valueB: config.entityB.medianIncome, format: 'currency' },
      { label: 'College Educated', valueA: config.entityA.collegeEducated, valueB: config.entityB.collegeEducated, format: 'percent' },
    ]);

    // Visual bar comparison
    y = this.renderBarComparison(config, y, contentWidth);

    this.renderFooter(config, 2);
  }

  /**
   * Page 3: Political Comparison + Electoral History
   */
  private buildPage3(config: ComparisonReportConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Page header
    y = this.renderPageHeader('Political Comparison', y, contentWidth);

    // Political metrics
    y = this.renderDemographicSection(config, y, contentWidth, 'Political Scores', [
      { label: 'Partisan Lean', valueA: config.entityA.partisanLean, valueB: config.entityB.partisanLean, format: 'lean' },
      { label: 'Swing Potential', valueA: config.entityA.swingPotential, valueB: config.entityB.swingPotential, format: 'score' },
      { label: 'GOTV Priority', valueA: config.entityA.gotvPriority, valueB: config.entityB.gotvPriority, format: 'score' },
      { label: 'Persuasion Opportunity', valueA: config.entityA.persuasionOpportunity, valueB: config.entityB.persuasionOpportunity, format: 'score' },
      { label: 'Avg Turnout', valueA: config.entityA.avgTurnout, valueB: config.entityB.avgTurnout, format: 'percent' },
    ]);

    // Electoral history table
    if (config.entityA.electionHistory && config.entityB.electionHistory) {
      y = this.renderElectoralHistory(config, y, contentWidth);
    }

    this.renderFooter(config, 3);
  }

  /**
   * Page 4: AI Insights
   */
  private buildPage4(config: ComparisonReportConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Page header
    y = this.renderPageHeader('Analysis & Recommendations', y, contentWidth);

    // Key differences
    if (config.keyDifferences?.length) {
      y = this.renderInsightSection('Key Differences', config.keyDifferences, y, contentWidth, POLITICAL_COLORS.entityA);
    }

    // Strategic implications
    if (config.strategicImplications?.length) {
      y = this.renderInsightSection('Strategic Implications', config.strategicImplications, y, contentWidth, POLITICAL_COLORS.entityB);
    }

    // Recommendation
    if (config.recommendation) {
      y = this.renderRecommendation(config.recommendation, y, contentWidth);
    }

    this.renderFooter(config, 4);
  }

  // ============================================================================
  // Render Helper Methods
  // ============================================================================

  private renderHeader(config: ComparisonReportConfig, startY: number, width: number): number {
    let y = startY;

    // Title bar
    this.pdf.setFillColor(30, 41, 59);
    this.pdf.rect(this.margin, y, width, 16, 'F');

    // Title
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    const title = config.comparisonTitle || 'COMPARISON REPORT';
    this.pdf.text(title.toUpperCase(), this.margin + 5, y + 10);

    // Date
    const reportDate = config.reportDate || new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    const dateWidth = this.pdf.getTextWidth(reportDate);
    this.pdf.text(reportDate, this.margin + width - dateWidth - 5, y + 10);

    y += 20;

    // Subtitle with purpose
    if (config.comparisonPurpose) {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(100, 116, 139);
      this.pdf.text(`Purpose: ${config.comparisonPurpose}`, this.margin, y);
      y += 5;
    }

    // Location
    this.pdf.setFontSize(9);
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text(`${config.county} County, ${config.state}`, this.margin, y);

    return y + 8;
  }

  private renderEntityLabels(config: ComparisonReportConfig, startY: number, width: number): number {
    const y = startY;
    const halfWidth = (width - 10) / 2;

    // Entity A label
    this.pdf.setFillColor(59, 130, 246); // Blue
    this.pdf.rect(this.margin, y, halfWidth, 12, 'F');
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text(config.entityA.name, this.margin + halfWidth / 2, y + 8, { align: 'center' });

    // Entity B label
    this.pdf.setFillColor(139, 92, 246); // Purple
    this.pdf.rect(this.margin + halfWidth + 10, y, halfWidth, 12, 'F');
    this.pdf.text(config.entityB.name, this.margin + halfWidth + 10 + halfWidth / 2, y + 8, { align: 'center' });

    return y + 16;
  }

  private renderKPIComparison(config: ComparisonReportConfig, startY: number, width: number): number {
    let y = startY;
    const halfWidth = (width - 10) / 2;
    const cardWidth = (halfWidth - 5) / 2;
    const cardHeight = 28;
    const gap = 5;

    // Row 1: Partisan Lean & Swing
    this.renderComparisonKPIPair(
      'Partisan Lean',
      this.formatLean(config.entityA.partisanLean),
      this.formatLean(config.entityB.partisanLean),
      config.entityA.partisanLean,
      config.entityB.partisanLean,
      y, cardWidth, cardHeight, 'lean'
    );

    this.renderComparisonKPIPair(
      'Swing Potential',
      `${config.entityA.swingPotential.toFixed(0)}/100`,
      `${config.entityB.swingPotential.toFixed(0)}/100`,
      config.entityA.swingPotential,
      config.entityB.swingPotential,
      y, cardWidth, cardHeight, 'score',
      halfWidth + 10
    );

    y += cardHeight + gap;

    // Row 2: GOTV & Persuasion
    this.renderComparisonKPIPair(
      'GOTV Priority',
      `${config.entityA.gotvPriority.toFixed(0)}/100`,
      `${config.entityB.gotvPriority.toFixed(0)}/100`,
      config.entityA.gotvPriority,
      config.entityB.gotvPriority,
      y, cardWidth, cardHeight, 'score'
    );

    this.renderComparisonKPIPair(
      'Persuasion',
      `${config.entityA.persuasionOpportunity.toFixed(0)}/100`,
      `${config.entityB.persuasionOpportunity.toFixed(0)}/100`,
      config.entityA.persuasionOpportunity,
      config.entityB.persuasionOpportunity,
      y, cardWidth, cardHeight, 'score',
      halfWidth + 10
    );

    return y + cardHeight + gap + 5;
  }

  private renderComparisonKPIPair(
    label: string,
    valueA: string,
    valueB: string,
    numA: number,
    numB: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    type: 'lean' | 'score',
    xOffset: number = 0
  ): void {
    const baseX = this.margin + xOffset;
    const gap = 5;

    // Determine winner (for scores, higher is better; for lean, depends on party preference)
    const aWins = type === 'score' ? numA > numB : Math.abs(numA) < Math.abs(numB); // For lean, closer to 0 is "better" as a swing target

    // Entity A card
    renderKPICard(this.pdf, baseX, y, cardWidth, cardHeight, {
      label: `${label} (A)`,
      value: valueA,
      backgroundColor: POLITICAL_COLORS.entityA,
      textColor: '#FFFFFF',
    });

    // Winner indicator for A
    if (aWins && numA !== numB) {
      this.pdf.setFillColor(5, 150, 105);
      this.pdf.circle(baseX + cardWidth - 4, y + 4, 3, 'F');
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.text('✓', baseX + cardWidth - 5.5, y + 5.5);
    }

    // Entity B card
    renderKPICard(this.pdf, baseX + cardWidth + gap, y, cardWidth, cardHeight, {
      label: `${label} (B)`,
      value: valueB,
      backgroundColor: POLITICAL_COLORS.entityB,
      textColor: '#FFFFFF',
    });

    // Winner indicator for B
    if (!aWins && numA !== numB) {
      this.pdf.setFillColor(5, 150, 105);
      this.pdf.circle(baseX + 2 * cardWidth + gap - 4, y + 4, 3, 'F');
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.text('✓', baseX + 2 * cardWidth + gap - 5.5, y + 5.5);
    }
  }

  private renderQuickSummaryTable(config: ComparisonReportConfig, startY: number, width: number): number {
    let y = startY;

    // Section label
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('QUICK SUMMARY', this.margin, y);
    y += 6;

    // Table header
    const colWidths = [width * 0.35, width * 0.3, width * 0.3, width * 0.05];
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 8, 'F');

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text('Metric', this.margin + 3, y + 5);
    this.pdf.text(config.entityA.name, this.margin + colWidths[0], y + 5);
    this.pdf.text(config.entityB.name, this.margin + colWidths[0] + colWidths[1], y + 5);
    y += 8;

    // Table rows
    const rows = [
      { label: 'Registered Voters', a: config.entityA.registeredVoters.toLocaleString(), b: config.entityB.registeredVoters.toLocaleString() },
      { label: 'Avg Turnout', a: `${config.entityA.avgTurnout.toFixed(1)}%`, b: `${config.entityB.avgTurnout.toFixed(1)}%` },
      { label: 'Partisan Lean', a: this.formatLean(config.entityA.partisanLean), b: this.formatLean(config.entityB.partisanLean) },
    ];

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    rows.forEach((row, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, y, width, 7, 'F');
      }
      this.pdf.setFontSize(8);
      this.pdf.text(row.label, this.margin + 3, y + 5);
      this.pdf.text(row.a, this.margin + colWidths[0], y + 5);
      this.pdf.text(row.b, this.margin + colWidths[0] + colWidths[1], y + 5);
      y += 7;
    });

    return y + 5;
  }

  private renderPageHeader(title: string, startY: number, width: number): number {
    let y = startY;

    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 10, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.text(title, this.margin + 4, y + 7);

    return y + 14;
  }

  private renderDemographicSection(
    config: ComparisonReportConfig,
    startY: number,
    width: number,
    sectionTitle: string,
    metrics: Array<{
      label: string;
      valueA: number;
      valueB: number;
      format: 'number' | 'currency' | 'percent' | 'decimal' | 'score' | 'lean';
      suffix?: string;
    }>
  ): number {
    let y = startY;

    // Section title
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text(sectionTitle.toUpperCase(), this.margin, y);
    y += 5;

    // Table header
    const colWidths = [width * 0.35, width * 0.25, width * 0.25, width * 0.15];
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 7, 'F');

    this.pdf.setFontSize(7);
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text('Metric', this.margin + 2, y + 5);
    this.pdf.text(config.entityA.name.substring(0, 15), this.margin + colWidths[0], y + 5);
    this.pdf.text(config.entityB.name.substring(0, 15), this.margin + colWidths[0] + colWidths[1], y + 5);
    this.pdf.text('Diff', this.margin + colWidths[0] + colWidths[1] + colWidths[2], y + 5);
    y += 7;

    // Rows
    this.pdf.setFont('helvetica', 'normal');
    metrics.forEach((metric, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, y, width, 6, 'F');
      }

      this.pdf.setTextColor(30, 41, 59);
      this.pdf.setFontSize(7);
      this.pdf.text(metric.label, this.margin + 2, y + 4);

      const formattedA = this.formatValue(metric.valueA, metric.format, metric.suffix);
      const formattedB = this.formatValue(metric.valueB, metric.format, metric.suffix);
      const diff = metric.valueA - metric.valueB;
      const diffStr = diff > 0 ? `+${this.formatValue(Math.abs(diff), metric.format, metric.suffix)}` :
                      diff < 0 ? `-${this.formatValue(Math.abs(diff), metric.format, metric.suffix)}` : '0';

      this.pdf.text(formattedA, this.margin + colWidths[0], y + 4);
      this.pdf.text(formattedB, this.margin + colWidths[0] + colWidths[1], y + 4);

      // Color the difference
      if (diff > 0) this.pdf.setTextColor(5, 150, 105);
      else if (diff < 0) this.pdf.setTextColor(220, 38, 38);
      else this.pdf.setTextColor(107, 114, 128);
      this.pdf.text(diffStr, this.margin + colWidths[0] + colWidths[1] + colWidths[2], y + 4);

      y += 6;
    });

    return y + 8;
  }

  private renderBarComparison(config: ComparisonReportConfig, startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('VISUAL COMPARISON', this.margin, y);
    y += 8;

    const metrics = [
      { label: 'Swing Potential', a: config.entityA.swingPotential, b: config.entityB.swingPotential, max: 100 },
      { label: 'GOTV Priority', a: config.entityA.gotvPriority, b: config.entityB.gotvPriority, max: 100 },
      { label: 'Persuasion', a: config.entityA.persuasionOpportunity, b: config.entityB.persuasionOpportunity, max: 100 },
    ];

    const barHeight = 8;
    const maxBarWidth = (width - 60) / 2;

    metrics.forEach(metric => {
      // Label
      this.pdf.setFontSize(7);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(71, 85, 105);
      this.pdf.text(metric.label, this.margin, y + 5);

      const centerX = this.margin + 50 + maxBarWidth;

      // Entity A bar (grows left from center)
      const aWidth = (metric.a / metric.max) * maxBarWidth;
      this.pdf.setFillColor(59, 130, 246);
      this.pdf.rect(centerX - aWidth, y, aWidth, barHeight, 'F');

      // Entity B bar (grows right from center)
      const bWidth = (metric.b / metric.max) * maxBarWidth;
      this.pdf.setFillColor(139, 92, 246);
      this.pdf.rect(centerX, y, bWidth, barHeight, 'F');

      // Center line
      this.pdf.setDrawColor(107, 114, 128);
      this.pdf.setLineWidth(0.3);
      this.pdf.line(centerX, y - 1, centerX, y + barHeight + 1);

      // Values
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(255, 255, 255);
      if (aWidth > 15) this.pdf.text(`${metric.a.toFixed(0)}`, centerX - aWidth + 2, y + 5);
      if (bWidth > 15) this.pdf.text(`${metric.b.toFixed(0)}`, centerX + 2, y + 5);

      y += barHeight + 5;
    });

    return y + 5;
  }

  private renderElectoralHistory(config: ComparisonReportConfig, startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('ELECTORAL HISTORY', this.margin, y);
    y += 6;

    const historyA = config.entityA.electionHistory || [];
    const historyB = config.entityB.electionHistory || [];

    // Simple table
    const colWidth = width / 5;

    // Header
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 7, 'F');
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text('Year', this.margin + 2, y + 5);
    this.pdf.text(`${config.entityA.name.substring(0, 10)} (D%)`, this.margin + colWidth, y + 5);
    this.pdf.text(`${config.entityA.name.substring(0, 10)} (R%)`, this.margin + 2 * colWidth, y + 5);
    this.pdf.text(`${config.entityB.name.substring(0, 10)} (D%)`, this.margin + 3 * colWidth, y + 5);
    this.pdf.text(`${config.entityB.name.substring(0, 10)} (R%)`, this.margin + 4 * colWidth, y + 5);
    y += 7;

    // Rows
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    const maxRows = Math.max(historyA.length, historyB.length);
    for (let i = 0; i < Math.min(maxRows, 3); i++) {
      if (i % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, y, width, 6, 'F');
      }

      const elecA = historyA[i];
      const elecB = historyB[i];
      const year = elecA?.year || elecB?.year || '';

      this.pdf.text(String(year), this.margin + 2, y + 4);
      if (elecA) {
        this.pdf.setTextColor(46, 94, 170);
        this.pdf.text(`${elecA.demPct.toFixed(1)}%`, this.margin + colWidth, y + 4);
        this.pdf.setTextColor(201, 49, 53);
        this.pdf.text(`${elecA.repPct.toFixed(1)}%`, this.margin + 2 * colWidth, y + 4);
      }
      if (elecB) {
        this.pdf.setTextColor(46, 94, 170);
        this.pdf.text(`${elecB.demPct.toFixed(1)}%`, this.margin + 3 * colWidth, y + 4);
        this.pdf.setTextColor(201, 49, 53);
        this.pdf.text(`${elecB.repPct.toFixed(1)}%`, this.margin + 4 * colWidth, y + 4);
      }
      this.pdf.setTextColor(30, 41, 59);
      y += 6;
    }

    return y + 8;
  }

  private renderInsightSection(title: string, items: string[], startY: number, width: number, accentColor: string): number {
    let y = startY;

    // Section background
    this.pdf.setFillColor(248, 250, 252);
    const sectionHeight = 10 + items.length * 12;
    this.pdf.rect(this.margin, y, width, sectionHeight, 'F');

    // Accent bar
    const rgb = this.hexToRgb(accentColor);
    this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    this.pdf.rect(this.margin, y, 3, sectionHeight, 'F');

    // Title
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.text(title, this.margin + 8, y + 7);
    y += 12;

    // Items
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    items.forEach(item => {
      this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      this.pdf.circle(this.margin + 10, y, 1.5, 'F');
      const lines = this.pdf.splitTextToSize(item, width - 20);
      lines.forEach((line: string, i: number) => {
        this.pdf.text(line, this.margin + 15, y + 2 + i * 4);
      });
      y += 4 + (lines.length - 1) * 4 + 4;
    });

    return y + 8;
  }

  private renderRecommendation(recommendation: string, startY: number, width: number): number {
    let y = startY;

    // Background
    this.pdf.setFillColor(254, 243, 199);
    this.pdf.rect(this.margin, y, width, 25, 'F');

    // Accent bar
    this.pdf.setFillColor(245, 158, 11);
    this.pdf.rect(this.margin, y, 3, 25, 'F');

    // Label
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(146, 64, 14);
    this.pdf.text('RECOMMENDATION', this.margin + 8, y + 7);

    // Text
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);
    const lines = this.pdf.splitTextToSize(recommendation, width - 15);
    lines.forEach((line: string, i: number) => {
      this.pdf.text(line, this.margin + 8, y + 14 + i * 4);
    });

    return y + 30;
  }

  private renderFooter(config: ComparisonReportConfig, pageNum: number): void {
    const y = this.pageHeight - 10;

    this.pdf.setDrawColor(226, 232, 240);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margin, y - 3, this.pageWidth - this.margin, y - 3);

    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(148, 163, 184);

    const generatedBy = config.generatedBy || 'Political Analysis Platform';
    this.pdf.text(`Generated by ${generatedBy}`, this.margin, y);
    this.pdf.text(`Comparison Report | Page ${pageNum}`, this.pageWidth - this.margin - 35, y);
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

  private formatValue(value: number, format: string, suffix?: string): string {
    let result: string;
    switch (format) {
      case 'number':
        result = value.toLocaleString();
        break;
      case 'currency':
        result = `$${value.toLocaleString()}`;
        break;
      case 'percent':
        result = `${value.toFixed(1)}%`;
        break;
      case 'decimal':
        result = value.toFixed(1);
        break;
      case 'score':
        result = `${value.toFixed(0)}/100`;
        break;
      case 'lean':
        result = this.formatLean(value);
        break;
      default:
        result = String(value);
    }
    return result + (suffix || '');
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

export default ComparisonReportPDFGenerator;
