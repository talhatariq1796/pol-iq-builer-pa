/**
 * Targeting Brief PDF Generator
 *
 * Generates 1-2 page targeting reports with ranked precinct lists
 * Perfect for field team prioritization and resource allocation
 *
 * Sections:
 * - Header: Area/Segment name, filter criteria
 * - Summary Stats: Total precincts, total voters, average scores
 * - Ranked Table: Top precincts with GOTV Score, Persuasion Score, Swing, Voters, Priority Rank
 * - Score Legend: What each score means and how to interpret
 */

import jsPDF from 'jspdf';
import { renderKPICard, BRAND_COLORS } from '../components/KPICard';

// ============================================================================
// Configuration Types
// ============================================================================

export interface PrecinctTargetingData {
  rank: number;
  name: string;
  jurisdiction: string;
  gotvScore: number; // 0-100
  persuasionScore: number; // 0-100
  swingPotential: number; // 0-100
  partisanLean: number; // -100 to +100
  registeredVoters: number;
  avgTurnout: number; // percentage
  priorityTier: 'High' | 'Medium' | 'Low';
}

export interface TargetingBriefConfig {
  // Report identification
  reportTitle: string; // e.g., "GOTV Priority Targeting Brief"
  segmentName?: string; // e.g., "High-Turnout Swing Precincts"
  filterCriteria?: string[]; // e.g., ["Swing Potential > 60", "GOTV Priority > 70"]

  // Summary stats
  summary: {
    totalPrecincts: number;
    totalVoters: number;
    avgGotvScore: number;
    avgPersuasionScore: number;
    avgSwingPotential: number;
    highPriorityCount: number;
  };

  // Precinct list (sorted by priority)
  precincts: PrecinctTargetingData[];

  // Metadata
  county: string;
  state: string;
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Political-specific colors
// ============================================================================

const POLITICAL_COLORS = {
  democrat: '#2E5EAA',
  republican: '#C93135',
  swing: '#8B5CF6',
  gotv: '#059669',
  persuasion: '#F59E0B',
  highPriority: '#DC2626',
  mediumPriority: '#F59E0B',
  lowPriority: '#6B7280',
  header: '#1E293B',
  tableHeader: '#F1F5F9',
  tableRowAlt: '#F8FAFC',
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

export class TargetingBriefPDFGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 12;
  private currentPage: number = 1;
  private totalPages: number = 1;

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'letter');
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.pageHeight = this.pdf.internal.pageSize.height;
  }

  /**
   * Generate Targeting Brief PDF
   */
  async generateReport(config: TargetingBriefConfig): Promise<Blob> {
    console.log('[TargetingBriefPDFGenerator] Starting PDF generation');

    try {
      // Calculate total pages based on precinct count
      const precinctsPerPage = 18; // First page has less room
      const precinctsFirstPage = 12;
      this.totalPages = config.precincts.length <= precinctsFirstPage
        ? 1
        : 1 + Math.ceil((config.precincts.length - precinctsFirstPage) / precinctsPerPage);

      this.buildPages(config);

      const pdfBlob = this.pdf.output('blob');
      console.log('[TargetingBriefPDFGenerator] PDF generation complete');
      return pdfBlob;
    } catch (error) {
      console.error('[TargetingBriefPDFGenerator] Error:', error);
      throw error;
    }
  }

  /**
   * Build all pages
   */
  private buildPages(config: TargetingBriefConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let currentY = this.margin;

    // Page 1: Header, Summary, and first batch of precincts
    currentY = this.renderHeader(config, currentY, contentWidth);
    currentY = this.renderSummaryStats(config, currentY, contentWidth);
    currentY = this.renderFilterCriteria(config, currentY, contentWidth);

    // Table header
    currentY = this.renderTableHeader(currentY, contentWidth);

    // First page precincts
    const precinctsFirstPage = 12;
    let precinctIndex = 0;

    while (precinctIndex < config.precincts.length) {
      const precinct = config.precincts[precinctIndex];

      // Check if we need a new page
      if (currentY > this.pageHeight - 35) {
        this.renderFooter(config);
        this.addNewPage();
        this.currentPage++;
        currentY = this.margin + 5;

        // Page header for continuation
        this.pdf.setFontSize(10);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setTextColor(30, 41, 59);
        this.pdf.text(`${config.reportTitle} (continued)`, this.margin, currentY);
        currentY += 8;

        // Repeat table header
        currentY = this.renderTableHeader(currentY, contentWidth);
      }

      currentY = this.renderPrecinctRow(precinct, precinctIndex, currentY, contentWidth);
      precinctIndex++;
    }

    // Score legend on last page
    if (currentY < this.pageHeight - 50) {
      currentY = this.renderScoreLegend(currentY + 5, contentWidth);
    }

    // Footer on last page
    this.renderFooter(config);
  }

  /**
   * Render header with title and metadata
   */
  private renderHeader(config: TargetingBriefConfig, startY: number, width: number): number {
    let y = startY;

    // Title bar
    this.pdf.setFillColor(30, 41, 59); // Dark slate
    this.pdf.rect(this.margin, y, width, 14, 'F');

    // Title
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text(config.reportTitle.toUpperCase(), this.margin + 4, y + 9);

    // Date on right
    const reportDate = config.reportDate || new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    const dateWidth = this.pdf.getTextWidth(reportDate);
    this.pdf.text(reportDate, this.margin + width - dateWidth - 4, y + 9);

    y += 17;

    // Segment name if provided
    if (config.segmentName) {
      this.pdf.setFontSize(11);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(config.segmentName, this.margin, y);
      y += 5;
    }

    // Location
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text(`${config.county} County, ${config.state}`, this.margin, y);

    return y + 6;
  }

  /**
   * Render summary statistics
   */
  private renderSummaryStats(config: TargetingBriefConfig, startY: number, width: number): number {
    let y = startY;

    const cardWidth = (width - 20) / 5;
    const cardHeight = 22;
    const gap = 4;

    // Card 1: Total Precincts
    renderKPICard(this.pdf, this.margin, y, cardWidth, cardHeight, {
      label: 'Precincts',
      value: config.summary.totalPrecincts.toString(),
      backgroundColor: BRAND_COLORS.darkGray,
      textColor: '#FFFFFF',
    });

    // Card 2: Total Voters
    renderKPICard(this.pdf, this.margin + cardWidth + gap, y, cardWidth, cardHeight, {
      label: 'Voters',
      value: this.formatNumber(config.summary.totalVoters),
      backgroundColor: BRAND_COLORS.dark1,
      textColor: '#FFFFFF',
    });

    // Card 3: Avg GOTV
    renderKPICard(this.pdf, this.margin + 2 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'Avg GOTV',
      value: `${config.summary.avgGotvScore.toFixed(0)}`,
      backgroundColor: POLITICAL_COLORS.gotv,
      textColor: '#FFFFFF',
    });

    // Card 4: Avg Persuasion
    renderKPICard(this.pdf, this.margin + 3 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'Avg Persuasion',
      value: `${config.summary.avgPersuasionScore.toFixed(0)}`,
      backgroundColor: POLITICAL_COLORS.persuasion,
      textColor: '#FFFFFF',
    });

    // Card 5: High Priority Count
    renderKPICard(this.pdf, this.margin + 4 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'High Priority',
      value: config.summary.highPriorityCount.toString(),
      backgroundColor: POLITICAL_COLORS.highPriority,
      textColor: '#FFFFFF',
    });

    return y + cardHeight + 6;
  }

  /**
   * Render filter criteria if provided
   */
  private renderFilterCriteria(config: TargetingBriefConfig, startY: number, width: number): number {
    if (!config.filterCriteria || config.filterCriteria.length === 0) {
      return startY;
    }

    let y = startY;

    // Background
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 12, 'F');

    // Label
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('FILTERS:', this.margin + 3, y + 5);

    // Filter tags
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);
    const filterText = config.filterCriteria.join(' | ');
    this.pdf.text(filterText, this.margin + 22, y + 5);

    return y + 14;
  }

  /**
   * Render table header row
   */
  private renderTableHeader(startY: number, width: number): number {
    const y = startY;
    const rowHeight = 8;

    // Header background
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, rowHeight, 'F');

    // Column headers
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(71, 85, 105);

    const columns = this.getColumnWidths(width);

    this.pdf.text('#', columns.rank.x + 1, y + 5);
    this.pdf.text('PRECINCT', columns.name.x, y + 5);
    this.pdf.text('GOTV', columns.gotv.x, y + 5);
    this.pdf.text('PERSUADE', columns.persuasion.x, y + 5);
    this.pdf.text('SWING', columns.swing.x, y + 5);
    this.pdf.text('LEAN', columns.lean.x, y + 5);
    this.pdf.text('VOTERS', columns.voters.x, y + 5);
    this.pdf.text('PRIORITY', columns.priority.x, y + 5);

    // Bottom border
    this.pdf.setDrawColor(203, 213, 225);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margin, y + rowHeight, this.margin + width, y + rowHeight);

    return y + rowHeight + 1;
  }

  /**
   * Render a single precinct row
   */
  private renderPrecinctRow(
    precinct: PrecinctTargetingData,
    index: number,
    startY: number,
    width: number
  ): number {
    const y = startY;
    const rowHeight = 7;

    // Alternating row background
    if (index % 2 === 0) {
      this.pdf.setFillColor(248, 250, 252);
      this.pdf.rect(this.margin, y, width, rowHeight, 'F');
    }

    const columns = this.getColumnWidths(width);

    // Row content
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    // Rank
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(precinct.rank.toString(), columns.rank.x + 2, y + 5);

    // Precinct name (truncate if needed)
    this.pdf.setFont('helvetica', 'normal');
    const maxNameWidth = columns.name.width - 2;
    let displayName = precinct.name;
    if (this.pdf.getTextWidth(displayName) > maxNameWidth) {
      while (this.pdf.getTextWidth(displayName + '...') > maxNameWidth && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '...';
    }
    this.pdf.text(displayName, columns.name.x, y + 5);

    // GOTV Score with color
    this.setScoreColor(precinct.gotvScore);
    this.pdf.text(precinct.gotvScore.toFixed(0), columns.gotv.x + 4, y + 5);

    // Persuasion Score with color
    this.setScoreColor(precinct.persuasionScore);
    this.pdf.text(precinct.persuasionScore.toFixed(0), columns.persuasion.x + 6, y + 5);

    // Swing Potential with color
    this.setScoreColor(precinct.swingPotential);
    this.pdf.text(precinct.swingPotential.toFixed(0), columns.swing.x + 4, y + 5);

    // Partisan Lean with D/R color
    const leanValue = precinct.partisanLean;
    const leanText = leanValue > 0 ? `R+${leanValue.toFixed(0)}` : leanValue < 0 ? `D+${Math.abs(leanValue).toFixed(0)}` : 'Even';
    if (leanValue > 0) {
      this.pdf.setTextColor(201, 49, 53); // Republican red
    } else if (leanValue < 0) {
      this.pdf.setTextColor(46, 94, 170); // Democrat blue
    } else {
      this.pdf.setTextColor(107, 114, 128);
    }
    this.pdf.text(leanText, columns.lean.x, y + 5);

    // Voters
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.text(this.formatNumber(precinct.registeredVoters), columns.voters.x, y + 5);

    // Priority tier badge
    this.renderPriorityBadge(precinct.priorityTier, columns.priority.x, y + 1);

    return y + rowHeight;
  }

  /**
   * Set text color based on score value
   */
  private setScoreColor(score: number): void {
    if (score >= 70) {
      this.pdf.setTextColor(5, 150, 105); // Green
    } else if (score >= 50) {
      this.pdf.setTextColor(245, 158, 11); // Amber
    } else {
      this.pdf.setTextColor(107, 114, 128); // Gray
    }
  }

  /**
   * Render priority tier badge
   */
  private renderPriorityBadge(tier: 'High' | 'Medium' | 'Low', x: number, y: number): void {
    const badgeWidth = 18;
    const badgeHeight = 5;

    let bgColor: string;
    let textColor = '#FFFFFF';

    switch (tier) {
      case 'High':
        bgColor = POLITICAL_COLORS.highPriority;
        break;
      case 'Medium':
        bgColor = POLITICAL_COLORS.mediumPriority;
        textColor = '#1E293B';
        break;
      case 'Low':
      default:
        bgColor = POLITICAL_COLORS.lowPriority;
        break;
    }

    // Badge background
    const rgb = this.hexToRgb(bgColor);
    this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    this.pdf.roundedRect(x, y, badgeWidth, badgeHeight, 1, 1, 'F');

    // Badge text
    this.pdf.setFontSize(6);
    this.pdf.setFont('helvetica', 'bold');
    const textRgb = this.hexToRgb(textColor);
    this.pdf.setTextColor(textRgb.r, textRgb.g, textRgb.b);
    this.pdf.text(tier, x + badgeWidth / 2, y + 3.5, { align: 'center' });
  }

  /**
   * Render score legend
   */
  private renderScoreLegend(startY: number, width: number): number {
    let y = startY;

    // Divider
    this.pdf.setDrawColor(226, 232, 240);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margin, y, this.margin + width, y);
    y += 4;

    // Legend title
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('SCORE INTERPRETATION', this.margin, y);
    y += 5;

    // Legend items in two columns
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(71, 85, 105);

    const legendItems = [
      { label: 'GOTV Score', description: 'Get-out-the-vote priority based on support × low turnout' },
      { label: 'Persuasion', description: 'Proportion of persuadable voters in precinct' },
      { label: 'Swing', description: 'Likelihood of changing partisan outcome' },
      { label: 'Priority', description: 'High = 70+, Medium = 50-69, Low = <50' },
    ];

    const colWidth = width / 2;
    legendItems.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const xPos = this.margin + col * colWidth;
      const yPos = y + row * 6;

      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(`${item.label}: `, xPos, yPos);
      const labelWidth = this.pdf.getTextWidth(`${item.label}: `);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(item.description, xPos + labelWidth, yPos);
    });

    return y + 12;
  }

  /**
   * Get column widths and positions
   */
  private getColumnWidths(totalWidth: number): Record<string, { x: number; width: number }> {
    const rankW = 8;
    const nameW = 55;
    const gotvW = 16;
    const persuasionW = 20;
    const swingW = 16;
    const leanW = 18;
    const votersW = 22;
    const priorityW = 22;

    let x = this.margin;

    return {
      rank: { x: x, width: rankW },
      name: { x: x += rankW, width: nameW },
      gotv: { x: x += nameW, width: gotvW },
      persuasion: { x: x += gotvW, width: persuasionW },
      swing: { x: x += persuasionW, width: swingW },
      lean: { x: x += swingW, width: leanW },
      voters: { x: x += leanW, width: votersW },
      priority: { x: x += votersW, width: priorityW },
    };
  }

  /**
   * Render footer
   */
  private renderFooter(config: TargetingBriefConfig): void {
    const y = this.pageHeight - 10;

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

    // Right: Page number
    this.pdf.text(
      `Targeting Brief | Page ${this.currentPage} of ${this.totalPages}`,
      this.pageWidth - this.margin - 40,
      y
    );
  }

  /**
   * Add a new page
   */
  private addNewPage(): void {
    this.pdf.addPage();
  }

  /**
   * Format large numbers with K/M suffixes
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 10000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleanHex = hex.replace('#', '');
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16),
    };
  }
}

export default TargetingBriefPDFGenerator;
