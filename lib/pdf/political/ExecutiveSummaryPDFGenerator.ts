/**
 * Executive Summary PDF Generator
 *
 * Generates 1-page quick executive summary reports
 * Perfect for leadership briefings, quick sharing, and initial assessments
 *
 * Sections:
 * - Header: Area name, date, analyst
 * - Key Metrics: 4 KPI cards (Partisan Lean, Swing Potential, GOTV Priority, Registered Voters)
 * - Mini Map: Thumbnail of selected area
 * - Quick Assessment: 3-4 bullet AI-generated insights
 * - Recommendation: Single strategic recommendation
 */

import jsPDF from 'jspdf';
import { renderKPICard, renderKPICardGrid, BRAND_COLORS } from '../components/KPICard';
import { BHHSComponentLibrary } from '../components/BHHSComponentLibrary';

// ============================================================================
// Configuration Types
// ============================================================================

export interface ExecutiveSummaryConfig {
  // Area identification
  areaName: string;
  areaDescription?: string;
  county: string;
  state: string;

  // Key metrics
  metrics: {
    partisanLean: number; // -100 (D) to +100 (R)
    swingPotential: number; // 0-100
    gotvPriority: number; // 0-100
    persuasionOpportunity: number; // 0-100
    registeredVoters: number;
    avgTurnout: number; // percentage
    precinctCount: number;
  };

  // Insights
  quickAssessment: string[]; // 3-4 bullet points
  recommendation: string; // Single strategic recommendation

  // Optional
  mapThumbnail?: string; // Base64 encoded map image
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Political-specific colors
// ============================================================================

const POLITICAL_COLORS = {
  democrat: '#2E5EAA', // Blue
  republican: '#C93135', // Red
  swing: '#8B5CF6', // Purple
  gotv: '#059669', // Green
  neutral: '#6B7280', // Gray
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

export class ExecutiveSummaryPDFGenerator {
  private pdf: jsPDF;
  private components: BHHSComponentLibrary;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 15;

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'letter'); // US Letter size
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.pageHeight = this.pdf.internal.pageSize.height;
    this.components = new BHHSComponentLibrary();
  }

  /**
   * Generate Executive Summary PDF
   */
  async generateReport(config: ExecutiveSummaryConfig): Promise<Blob> {
    console.log('[ExecutiveSummaryPDFGenerator] Starting PDF generation for:', config.areaName);

    try {
      this.buildPage(config);

      const pdfBlob = this.pdf.output('blob');
      console.log('[ExecutiveSummaryPDFGenerator] PDF generation complete');
      return pdfBlob;
    } catch (error) {
      console.error('[ExecutiveSummaryPDFGenerator] Error:', error);
      throw error;
    }
  }

  /**
   * Build the single-page executive summary
   */
  private buildPage(config: ExecutiveSummaryConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let currentY = this.margin;

    // ========================================================================
    // Header Section
    // ========================================================================
    currentY = this.renderHeader(config, currentY, contentWidth);

    // ========================================================================
    // Key Metrics Section (4 KPI Cards)
    // ========================================================================
    currentY = this.renderKeyMetrics(config, currentY, contentWidth);

    // ========================================================================
    // Two-Column Layout: Map + Quick Assessment
    // ========================================================================
    currentY = this.renderMapAndAssessment(config, currentY, contentWidth);

    // ========================================================================
    // Recommendation Section
    // ========================================================================
    currentY = this.renderRecommendation(config, currentY, contentWidth);

    // ========================================================================
    // Footer
    // ========================================================================
    this.renderFooter(config);
  }

  /**
   * Render header with title and metadata
   */
  private renderHeader(config: ExecutiveSummaryConfig, startY: number, width: number): number {
    let y = startY;

    // Title bar background
    this.pdf.setFillColor(103, 3, 56); // Brand burgundy
    this.pdf.rect(this.margin, y, width, 18, 'F');

    // Title text
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text('EXECUTIVE SUMMARY', this.margin + 5, y + 12);

    // Date on right
    const reportDate = config.reportDate || new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    const dateWidth = this.pdf.getTextWidth(reportDate);
    this.pdf.text(reportDate, this.margin + width - dateWidth - 5, y + 12);

    y += 22;

    // Area name and description
    this.pdf.setTextColor(30, 41, 59); // Dark text
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(config.areaName, this.margin, y);
    y += 5;

    if (config.areaDescription) {
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(100, 116, 139);
      this.pdf.text(config.areaDescription, this.margin, y);
      y += 4;
    }

    // Location line
    this.pdf.setFontSize(9);
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text(`${config.county} County, ${config.state}`, this.margin, y);
    y += 2;

    // Divider
    this.pdf.setDrawColor(226, 232, 240);
    this.pdf.setLineWidth(0.5);
    this.pdf.line(this.margin, y + 2, this.margin + width, y + 2);

    return y + 6;
  }

  /**
   * Render 4 KPI cards in a row
   */
  private renderKeyMetrics(config: ExecutiveSummaryConfig, startY: number, width: number): number {
    let y = startY;

    // Section label
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('KEY METRICS', this.margin, y);
    y += 5;

    const cardWidth = (width - 15) / 4; // 4 cards with gaps
    const cardHeight = 32;
    const gap = 5;

    // Card 1: Partisan Lean
    const leanValue = config.metrics.partisanLean;
    const leanLabel = leanValue > 0 ? `R+${leanValue.toFixed(0)}` : leanValue < 0 ? `D+${Math.abs(leanValue).toFixed(0)}` : 'Even';
    const leanColor = leanValue > 5 ? POLITICAL_COLORS.republican : leanValue < -5 ? POLITICAL_COLORS.democrat : POLITICAL_COLORS.neutral;

    renderKPICard(this.pdf, this.margin, y, cardWidth, cardHeight, {
      label: 'Partisan Lean',
      value: leanLabel,
      backgroundColor: leanColor,
      textColor: '#FFFFFF',
    });

    // Card 2: Swing Potential
    renderKPICard(this.pdf, this.margin + cardWidth + gap, y, cardWidth, cardHeight, {
      label: 'Swing Potential',
      value: `${config.metrics.swingPotential.toFixed(0)}/100`,
      backgroundColor: POLITICAL_COLORS.swing,
      textColor: '#FFFFFF',
    });

    // Card 3: GOTV Priority
    renderKPICard(this.pdf, this.margin + 2 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'GOTV Priority',
      value: `${config.metrics.gotvPriority.toFixed(0)}/100`,
      backgroundColor: POLITICAL_COLORS.gotv,
      textColor: '#FFFFFF',
    });

    // Card 4: Registered Voters
    renderKPICard(this.pdf, this.margin + 3 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'Registered Voters',
      value: config.metrics.registeredVoters.toLocaleString(),
      backgroundColor: BRAND_COLORS.darkGray,
      textColor: '#FFFFFF',
    });

    return y + cardHeight + 8;
  }

  /**
   * Render two-column layout with map and quick assessment
   */
  private renderMapAndAssessment(config: ExecutiveSummaryConfig, startY: number, width: number): number {
    let y = startY;
    const leftColumnWidth = width * 0.35;
    const rightColumnWidth = width * 0.60;
    const columnGap = width * 0.05;

    // Left column: Map thumbnail + additional stats
    const leftX = this.margin;
    const mapHeight = 55;

    // Map placeholder or actual image
    if (config.mapThumbnail) {
      try {
        this.pdf.addImage(config.mapThumbnail, 'PNG', leftX, y, leftColumnWidth, mapHeight);
      } catch {
        this.renderMapPlaceholder(leftX, y, leftColumnWidth, mapHeight);
      }
    } else {
      this.renderMapPlaceholder(leftX, y, leftColumnWidth, mapHeight);
    }

    // Additional stats below map
    const statsY = y + mapHeight + 5;
    this.pdf.setFillColor(248, 250, 252);
    this.pdf.rect(leftX, statsY, leftColumnWidth, 30, 'F');
    this.pdf.setDrawColor(226, 232, 240);
    this.pdf.rect(leftX, statsY, leftColumnWidth, 30, 'S');

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(100, 116, 139);

    const statLines = [
      `Precincts: ${config.metrics.precinctCount}`,
      `Avg Turnout: ${config.metrics.avgTurnout.toFixed(1)}%`,
      `Persuasion: ${config.metrics.persuasionOpportunity.toFixed(0)}/100`,
    ];

    statLines.forEach((line, index) => {
      this.pdf.text(line, leftX + 3, statsY + 8 + index * 8);
    });

    // Right column: Quick Assessment
    const rightX = this.margin + leftColumnWidth + columnGap;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('QUICK ASSESSMENT', rightX, y + 4);

    // Assessment bullets
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    let bulletY = y + 12;
    const bulletIndent = 4;
    const lineHeight = 7;

    config.quickAssessment.slice(0, 4).forEach((bullet) => {
      // Bullet point
      this.pdf.setFillColor(103, 3, 56);
      this.pdf.circle(rightX + 2, bulletY - 1.5, 1, 'F');

      // Wrap text if needed
      const maxWidth = rightColumnWidth - bulletIndent - 4;
      const lines = this.pdf.splitTextToSize(bullet, maxWidth);

      lines.forEach((line: string, lineIndex: number) => {
        this.pdf.text(line, rightX + bulletIndent + 2, bulletY + lineIndex * 4);
      });

      bulletY += lines.length * 4 + lineHeight - 4;
    });

    return Math.max(y + mapHeight + 35, bulletY) + 5;
  }

  /**
   * Render map placeholder when no thumbnail provided
   */
  private renderMapPlaceholder(x: number, y: number, width: number, height: number): void {
    // Light background
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(x, y, width, height, 'F');

    // Border
    this.pdf.setDrawColor(203, 213, 225);
    this.pdf.setLineWidth(0.5);
    this.pdf.rect(x, y, width, height, 'S');

    // Map icon/text
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(148, 163, 184);
    this.pdf.text('Map Preview', x + width / 2, y + height / 2 - 3, { align: 'center' });
    this.pdf.setFontSize(8);
    this.pdf.text('(Not Available)', x + width / 2, y + height / 2 + 3, { align: 'center' });
  }

  /**
   * Render strategic recommendation section
   */
  private renderRecommendation(config: ExecutiveSummaryConfig, startY: number, width: number): number {
    let y = startY;

    // Section background
    this.pdf.setFillColor(254, 243, 199); // Light amber
    this.pdf.rect(this.margin, y, width, 28, 'F');

    // Left accent bar
    this.pdf.setFillColor(245, 158, 11); // Amber
    this.pdf.rect(this.margin, y, 3, 28, 'F');

    // Label
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(146, 64, 14);
    this.pdf.text('STRATEGIC RECOMMENDATION', this.margin + 8, y + 7);

    // Recommendation text
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    const maxWidth = width - 12;
    const lines = this.pdf.splitTextToSize(config.recommendation, maxWidth);

    lines.forEach((line: string, index: number) => {
      this.pdf.text(line, this.margin + 8, y + 14 + index * 4.5);
    });

    return y + 32;
  }

  /**
   * Render footer with branding and generation info
   */
  private renderFooter(config: ExecutiveSummaryConfig): void {
    const y = this.pageHeight - 12;

    // Divider
    this.pdf.setDrawColor(226, 232, 240);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margin, y - 3, this.pageWidth - this.margin, y - 3);

    // Left: Generated by
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(148, 163, 184);

    const generatedBy = config.generatedBy || 'Political Analysis Platform';
    this.pdf.text(`Generated by ${generatedBy}`, this.margin, y);

    // Right: Page indicator
    this.pdf.text('Executive Summary | Page 1 of 1', this.pageWidth - this.margin - 40, y);
  }
}

export default ExecutiveSummaryPDFGenerator;
