/**
 * Executive Summary PDF Generator V2
 *
 * Uses fixed-position template system for consistent layouts.
 * Generates 1-page quick executive summary reports.
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
  PoliticalTemplateRenderer,
  createPoliticalRenderer,
} from './components/PoliticalTemplateRenderer';

import {
  hexToRgb,
  formatDate,
  validateRequiredFields,
  logValidationWarnings,
  safeNumber,
  safeString,
  safeArray,
} from './utils';

// ============================================================================
// Configuration Types (preserved from V1)
// ============================================================================

export interface ExecutiveSummaryConfig {
  areaName: string;
  areaDescription?: string;
  county: string;
  state: string;

  metrics: {
    partisanLean: number;
    swingPotential: number;
    gotvPriority: number;
    persuasionOpportunity: number;
    registeredVoters: number;
    avgTurnout: number;
    precinctCount: number;
  };

  quickAssessment: string[];
  recommendation: string;

  mapThumbnail?: string;
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Fixed Position Templates
// ============================================================================

const EXEC_SUMMARY_TEMPLATE = {
  // Header
  headerBar: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 18 },
  headerTitle: { x: MARGINS.left + 5, y: 27, width: 100, height: 10 },
  headerDate: { x: 160, y: 27, width: 35, height: 10 },

  // Area info
  areaName: { x: MARGINS.left, y: 38, width: CONTENT_AREA.width, height: 8 },
  areaDescription: { x: MARGINS.left, y: 46, width: CONTENT_AREA.width, height: 5 },
  areaLocation: { x: MARGINS.left, y: 53, width: CONTENT_AREA.width, height: 5 },

  // KPI cards (4 in a row)
  kpiRow: { x: MARGINS.left, y: 62, cardWidth: 42, cardHeight: 30, gap: 4 },

  // Two-column layout
  leftColumn: { x: MARGINS.left, y: 100, width: 65 },
  rightColumn: { x: 90, y: 100, width: 105 },

  // Map placeholder
  map: { x: MARGINS.left, y: 100, width: 65, height: 55 },

  // Stats box
  stats: { x: MARGINS.left, y: 160, width: 65, height: 30 },

  // Quick assessment
  assessmentTitle: { x: 90, y: 100, width: 100, height: 6 },
  assessmentList: { x: 90, y: 110, width: 105, height: 80 },

  // Recommendation
  recommendation: { x: MARGINS.left, y: 200, width: CONTENT_AREA.width, height: 35 },
};

// ============================================================================
// PDF Generator Class
// ============================================================================

export class ExecutiveSummaryPDFGeneratorV2 {
  private renderer: PoliticalTemplateRenderer;
  private pdf: jsPDF;

  constructor() {
    this.renderer = createPoliticalRenderer();
    this.pdf = this.renderer.getPdf();
  }

  async generateReport(config: ExecutiveSummaryConfig): Promise<Blob> {
    console.log('[ExecutiveSummaryPDFGeneratorV2] Starting generation:', config.areaName);

    // Validate required fields
    const validation = validateRequiredFields(
      config as unknown as Record<string, unknown>,
      ['areaName', 'county', 'state', 'metrics', 'quickAssessment', 'recommendation'],
      'ExecutiveSummaryConfig'
    );
    logValidationWarnings(validation, 'ExecutiveSummaryPDFGeneratorV2');

    this.buildPage(config);

    const pdfBlob = this.pdf.output('blob');
    console.log('[ExecutiveSummaryPDFGeneratorV2] Generation complete');
    return pdfBlob;
  }

  private buildPage(config: ExecutiveSummaryConfig): void {
    const t = EXEC_SUMMARY_TEMPLATE;

    // ========================================================================
    // Header Section
    // ========================================================================

    // Header bar (dark navy)
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.primary));
    this.pdf.rect(t.headerBar.x, t.headerBar.y, t.headerBar.width, t.headerBar.height, 'F');

    // Title
    this.pdf.setFontSize(16);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text('EXECUTIVE SUMMARY', t.headerTitle.x, t.headerTitle.y);

    // Date
    const reportDate = config.reportDate || formatDate(undefined, 'medium');
    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.text(reportDate, 180, t.headerDate.y, { align: 'right' });

    // Area name
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.setFontSize(14);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.text(config.areaName, t.areaName.x, t.areaName.y);

    // Area description
    if (config.areaDescription) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text(config.areaDescription, t.areaDescription.x, t.areaDescription.y);
    }

    // Location
    this.pdf.setFontSize(9);
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text(`${config.county} County, ${config.state}`, t.areaLocation.x, t.areaLocation.y);

    // Divider
    this.pdf.setDrawColor(...this.hexToRgb(POLITICAL_COLORS.border));
    this.pdf.setLineWidth(0.5);
    this.pdf.line(MARGINS.left, 58, MARGINS.left + CONTENT_AREA.width, 58);

    // ========================================================================
    // KPI Cards Row
    // ========================================================================

    const kpi = t.kpiRow;
    const m = config.metrics;

    // Card 1: Partisan Lean
    renderPartisanLeanCard(this.pdf, kpi.x, kpi.y, kpi.cardWidth, kpi.cardHeight, {
      lean: m.partisanLean,
    });

    // Card 2: Swing Potential
    renderScoreCard(this.pdf, kpi.x + kpi.cardWidth + kpi.gap, kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Swing Potential',
      score: m.swingPotential,
      metric: 'swing',
    });

    // Card 3: GOTV Priority
    renderScoreCard(this.pdf, kpi.x + 2 * (kpi.cardWidth + kpi.gap), kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'GOTV Priority',
      score: m.gotvPriority,
      metric: 'gotv',
    });

    // Card 4: Registered Voters
    renderStatCard(this.pdf, kpi.x + 3 * (kpi.cardWidth + kpi.gap), kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Registered Voters',
      value: m.registeredVoters.toLocaleString(),
    });

    // ========================================================================
    // Two-Column Layout: Map + Assessment
    // ========================================================================

    // Left: Map
    if (config.mapThumbnail) {
      try {
        this.pdf.addImage(config.mapThumbnail, 'PNG', t.map.x, t.map.y, t.map.width, t.map.height);
      } catch (error) {
        console.warn('[ExecutiveSummaryPDFGeneratorV2] Failed to add map image:', error);
        this.renderMapPlaceholder(t.map);
      }
    } else {
      this.renderMapPlaceholder(t.map);
    }

    // Left: Stats box below map
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.cardBg));
    this.pdf.setDrawColor(...this.hexToRgb(POLITICAL_COLORS.border));
    this.pdf.rect(t.stats.x, t.stats.y, t.stats.width, t.stats.height, 'FD');

    this.pdf.setFontSize(8);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text(`Precincts: ${m.precinctCount}`, t.stats.x + 4, t.stats.y + 8);
    this.pdf.text(`Avg Turnout: ${m.avgTurnout.toFixed(1)}%`, t.stats.x + 4, t.stats.y + 16);
    this.pdf.text(`Persuasion: ${m.persuasionOpportunity.toFixed(0)}/100`, t.stats.x + 4, t.stats.y + 24);

    // Right: Quick Assessment
    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('QUICK ASSESSMENT', t.assessmentTitle.x, t.assessmentTitle.y);

    // Assessment bullets
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));

    let bulletY = t.assessmentList.y;
    config.quickAssessment.slice(0, 5).forEach(bullet => {
      // Bullet point
      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.primary));
      this.pdf.circle(t.assessmentList.x + 2, bulletY - 1.5, 1, 'F');

      // Text (wrap if needed)
      const lines = this.pdf.splitTextToSize(bullet, t.assessmentList.width - 8);
      lines.forEach((line: string, i: number) => {
        this.pdf.text(line, t.assessmentList.x + 6, bulletY + i * 4);
      });

      bulletY += lines.length * 4 + 6;
    });

    // ========================================================================
    // Recommendation Section
    // ========================================================================

    const rec = t.recommendation;

    // Background (amber)
    this.pdf.setFillColor(254, 243, 199);
    this.pdf.rect(rec.x, rec.y, rec.width, rec.height, 'F');

    // Accent bar
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.persuasion));
    this.pdf.rect(rec.x, rec.y, 3, rec.height, 'F');

    // Label
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(146, 64, 14);
    this.pdf.text('STRATEGIC RECOMMENDATION', rec.x + 8, rec.y + 8);

    // Recommendation text
    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    const recLines = this.pdf.splitTextToSize(config.recommendation, rec.width - 15);
    recLines.forEach((line: string, i: number) => {
      this.pdf.text(line, rec.x + 8, rec.y + 16 + i * 4.5);
    });

    // ========================================================================
    // Footer
    // ========================================================================

    this.renderer.renderPageFooter('Executive Summary');
  }

  private renderMapPlaceholder(pos: { x: number; y: number; width: number; height: number }): void {
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.cardBg));
    this.pdf.setDrawColor(...this.hexToRgb(POLITICAL_COLORS.border));
    this.pdf.rect(pos.x, pos.y, pos.width, pos.height, 'FD');

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textMuted));
    this.pdf.text('Map Preview', pos.x + pos.width / 2, pos.y + pos.height / 2 - 3, { align: 'center' });
    this.pdf.setFontSize(8);
    this.pdf.text('(Not Available)', pos.x + pos.width / 2, pos.y + pos.height / 2 + 3, { align: 'center' });
  }

  private hexToRgb(hex: string): [number, number, number] {
    return hexToRgb(hex);
  }
}

export default ExecutiveSummaryPDFGeneratorV2;
