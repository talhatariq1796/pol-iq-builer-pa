/**
 * Canvassing Plan PDF Generator
 *
 * Generates 3-5 page operational field documents
 * Perfect for distributing to canvass volunteers and field directors
 *
 * Pages:
 * 1. Operation Overview + Priority Ranking
 * 2. Turf Summary + Logistics
 * 3+ Turf Sheets (optional, can be many pages)
 * Last. Scripts & Tips
 */

import jsPDF from 'jspdf';
import { renderKPICard, BRAND_COLORS } from '../components/KPICard';

// ============================================================================
// Configuration Types
// ============================================================================

export interface CanvassTurfData {
  turfId: string;
  turfName: string;
  precinctName: string;
  totalDoors: number;
  estimatedHours: number;
  priorityRank: number;
  gotvScore: number;
  persuasionScore: number;
  contactRateExpected: number;
  suggestedTeamSize: number;
  notes?: string;
}

export interface CanvassingPlanConfig {
  // Operation details
  operationName: string;
  operationDate?: string;
  operationType: 'gotv' | 'persuasion' | 'voter_id' | 'general';

  // Target area summary
  targetArea: string;
  totalDoors: number;
  totalPrecincts: number;
  estimatedTotalHours: number;
  suggestedVolunteers: number;

  // Priority precincts
  priorityPrecincts: Array<{
    name: string;
    doors: number;
    gotvScore: number;
    persuasionScore: number;
    priorityRank: number;
    efficiencyScore: number; // doors per hour
  }>;

  // Turf breakdown (if available)
  turfs?: CanvassTurfData[];

  // Logistics
  logistics: {
    optimalTimes: string[];
    avgDoorsPerHour: number;
    expectedContactRate: number;
    returnVisitStrategy?: string;
  };

  // Scripts & talking points (optional)
  talkingPoints?: string[];
  faqs?: Array<{ question: string; answer: string }>;

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
  primary: '#059669', // Green for canvassing
  secondary: '#10B981',
  gotv: '#059669',
  persuasion: '#EC4899',
  warning: '#F59E0B',
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

export class CanvassingPlanPDFGenerator {
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
   * Generate Canvassing Plan PDF
   */
  async generateReport(config: CanvassingPlanConfig): Promise<Blob> {
    console.log('[CanvassingPlanPDFGenerator] Starting PDF generation');

    try {
      // Calculate total pages
      const turfPages = config.turfs ? Math.ceil(config.turfs.length / 6) : 0;
      const hasScripts = config.talkingPoints?.length || config.faqs?.length;
      this.totalPages = 2 + turfPages + (hasScripts ? 1 : 0);

      // Page 1: Overview + Priority
      this.buildPage1(config);

      // Page 2: Logistics
      this.addNewPage();
      this.buildPage2(config);

      // Turf pages (if available)
      if (config.turfs?.length) {
        const turfsPerPage = 6;
        for (let i = 0; i < turfPages; i++) {
          this.addNewPage();
          const startIdx = i * turfsPerPage;
          const endIdx = Math.min(startIdx + turfsPerPage, config.turfs.length);
          this.buildTurfPage(config, config.turfs.slice(startIdx, endIdx), i + 1, turfPages);
        }
      }

      // Scripts page
      if (hasScripts) {
        this.addNewPage();
        this.buildScriptsPage(config);
      }

      const pdfBlob = this.pdf.output('blob');
      console.log('[CanvassingPlanPDFGenerator] PDF generation complete');
      return pdfBlob;
    } catch (error) {
      console.error('[CanvassingPlanPDFGenerator] Error:', error);
      throw error;
    }
  }

  /**
   * Page 1: Operation Overview + Priority Ranking
   */
  private buildPage1(config: CanvassingPlanConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Header
    y = this.renderHeader(config, y, contentWidth);

    // Operation summary cards
    y = this.renderOperationSummary(config, y, contentWidth);

    // Priority precincts table
    y = this.renderPriorityTable(config.priorityPrecincts, y, contentWidth);

    this.renderFooter(config, 1);
  }

  /**
   * Page 2: Turf Summary + Logistics
   */
  private buildPage2(config: CanvassingPlanConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    // Page header
    y = this.renderPageHeader('Logistics & Planning', y, contentWidth);

    // Logistics info
    y = this.renderLogistics(config.logistics, y, contentWidth);

    // Team recommendations
    y = this.renderTeamRecommendations(config, y, contentWidth);

    // Shift schedule suggestion
    y = this.renderShiftSuggestion(config, y, contentWidth);

    this.renderFooter(config, 2);
  }

  /**
   * Turf detail page
   */
  private buildTurfPage(
    config: CanvassingPlanConfig,
    turfs: CanvassTurfData[],
    pageNum: number,
    totalTurfPages: number
  ): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    const subtitle = totalTurfPages > 1 ? ` (${pageNum}/${totalTurfPages})` : '';
    y = this.renderPageHeader(`Turf Assignments${subtitle}`, y, contentWidth);

    turfs.forEach(turf => {
      if (y > this.pageHeight - 50) {
        this.addNewPage();
        y = this.margin + 15;
      }
      y = this.renderTurfCard(turf, y, contentWidth);
    });

    this.renderFooter(config, 2 + pageNum);
  }

  /**
   * Scripts & Tips page
   */
  private buildScriptsPage(config: CanvassingPlanConfig): void {
    const contentWidth = this.pageWidth - 2 * this.margin;
    let y = this.margin;

    y = this.renderPageHeader('Talking Points & FAQs', y, contentWidth);

    // Talking points
    if (config.talkingPoints?.length) {
      y = this.renderTalkingPoints(config.talkingPoints, y, contentWidth);
    }

    // FAQs
    if (config.faqs?.length) {
      y = this.renderFAQs(config.faqs, y, contentWidth);
    }

    this.renderFooter(config, this.totalPages);
  }

  // ============================================================================
  // Render Helper Methods
  // ============================================================================

  private renderHeader(config: CanvassingPlanConfig, startY: number, width: number): number {
    let y = startY;

    // Title bar
    this.pdf.setFillColor(5, 150, 105); // Green
    this.pdf.rect(this.margin, y, width, 18, 'F');

    // Title
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text('CANVASSING PLAN', this.margin + 5, y + 8);

    // Operation type badge
    const typeLabels: Record<string, string> = {
      gotv: 'GOTV',
      persuasion: 'PERSUASION',
      voter_id: 'VOTER ID',
      general: 'GENERAL',
    };
    const typeLabel = typeLabels[config.operationType] || 'GENERAL';
    this.pdf.setFontSize(8);
    const badgeWidth = this.pdf.getTextWidth(typeLabel) + 8;
    this.pdf.setFillColor(255, 255, 255);
    this.pdf.roundedRect(this.margin + width - badgeWidth - 5, y + 3, badgeWidth, 6, 1, 1, 'F');
    this.pdf.setTextColor(5, 150, 105);
    this.pdf.text(typeLabel, this.margin + width - badgeWidth - 1, y + 7.5);

    // Date
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(9);
    const reportDate = config.reportDate || new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    this.pdf.text(reportDate, this.margin + 5, y + 14);

    y += 22;

    // Operation name
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.text(config.operationName, this.margin, y);
    y += 5;

    // Target area
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text(`Target: ${config.targetArea} | ${config.county} County, ${config.state}`, this.margin, y);

    if (config.operationDate) {
      y += 4;
      this.pdf.text(`Operation Date: ${config.operationDate}`, this.margin, y);
    }

    return y + 8;
  }

  private renderOperationSummary(config: CanvassingPlanConfig, startY: number, width: number): number {
    let y = startY;

    // Section header
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('OPERATION SUMMARY', this.margin, y);
    y += 5;

    // KPI cards
    const cardWidth = (width - 15) / 4;
    const cardHeight = 26;
    const gap = 5;

    renderKPICard(this.pdf, this.margin, y, cardWidth, cardHeight, {
      label: 'Total Doors',
      value: config.totalDoors.toLocaleString(),
      backgroundColor: COLORS.primary,
      textColor: '#FFFFFF',
    });

    renderKPICard(this.pdf, this.margin + cardWidth + gap, y, cardWidth, cardHeight, {
      label: 'Precincts',
      value: config.totalPrecincts.toString(),
      backgroundColor: BRAND_COLORS.darkGray,
      textColor: '#FFFFFF',
    });

    renderKPICard(this.pdf, this.margin + 2 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'Est. Hours',
      value: config.estimatedTotalHours.toFixed(0),
      backgroundColor: COLORS.warning,
      textColor: '#FFFFFF',
    });

    renderKPICard(this.pdf, this.margin + 3 * (cardWidth + gap), y, cardWidth, cardHeight, {
      label: 'Volunteers',
      value: config.suggestedVolunteers.toString(),
      backgroundColor: COLORS.secondary,
      textColor: '#FFFFFF',
    });

    return y + cardHeight + 8;
  }

  private renderPriorityTable(
    precincts: CanvassingPlanConfig['priorityPrecincts'],
    startY: number,
    width: number
  ): number {
    let y = startY;

    // Section header
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('PRIORITY RANKING', this.margin, y);
    y += 5;

    // Table header
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 8, 'F');

    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(71, 85, 105);

    const cols = [
      { label: '#', x: this.margin + 2, width: 10 },
      { label: 'Precinct', x: this.margin + 12, width: 60 },
      { label: 'Doors', x: this.margin + 72, width: 25 },
      { label: 'GOTV', x: this.margin + 97, width: 20 },
      { label: 'Persuade', x: this.margin + 117, width: 25 },
      { label: 'Efficiency', x: this.margin + 142, width: 25 },
    ];

    cols.forEach(col => {
      this.pdf.text(col.label, col.x, y + 5.5);
    });
    y += 8;

    // Rows (max 15)
    this.pdf.setFont('helvetica', 'normal');
    const displayPrecincts = precincts.slice(0, 15);

    displayPrecincts.forEach((precinct, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, y, width, 7, 'F');
      }

      // Priority indicator
      if (precinct.priorityRank <= 3) {
        this.pdf.setFillColor(5, 150, 105);
        this.pdf.circle(this.margin + 5, y + 3.5, 2.5, 'F');
        this.pdf.setTextColor(255, 255, 255);
      } else {
        this.pdf.setTextColor(30, 41, 59);
      }
      this.pdf.setFontSize(6);
      this.pdf.text(precinct.priorityRank.toString(), this.margin + 4, y + 4.5);

      this.pdf.setTextColor(30, 41, 59);
      this.pdf.setFontSize(7);

      // Truncate name if needed
      let name = precinct.name;
      while (this.pdf.getTextWidth(name) > 55 && name.length > 0) {
        name = name.slice(0, -1);
      }
      if (name !== precinct.name) name += '...';

      this.pdf.text(name, cols[1].x, y + 4.5);
      this.pdf.text(precinct.doors.toLocaleString(), cols[2].x, y + 4.5);

      // GOTV with color coding
      const gotv = precinct.gotvScore;
      if (gotv >= 70) this.pdf.setTextColor(5, 150, 105);
      else if (gotv >= 50) this.pdf.setTextColor(245, 158, 11);
      else this.pdf.setTextColor(107, 114, 128);
      this.pdf.text(`${gotv.toFixed(0)}`, cols[3].x, y + 4.5);

      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(`${precinct.persuasionScore.toFixed(0)}`, cols[4].x, y + 4.5);
      this.pdf.text(`${precinct.efficiencyScore.toFixed(0)}/hr`, cols[5].x, y + 4.5);

      y += 7;
    });

    if (precincts.length > 15) {
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(100, 116, 139);
      this.pdf.text(`+ ${precincts.length - 15} more precincts`, this.margin, y + 5);
      y += 8;
    }

    return y + 5;
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

  private renderLogistics(logistics: CanvassingPlanConfig['logistics'], startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('LOGISTICS', this.margin, y);
    y += 6;

    // Info box
    this.pdf.setFillColor(248, 250, 252);
    this.pdf.rect(this.margin, y, width, 35, 'F');

    // Optimal times
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.text('Optimal Canvass Times:', this.margin + 5, y + 7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text(logistics.optimalTimes.join(' | '), this.margin + 5, y + 13);

    // Metrics row
    const metricsY = y + 20;
    const metricWidth = width / 3;

    const metrics = [
      { label: 'Avg Doors/Hour', value: logistics.avgDoorsPerHour.toFixed(0) },
      { label: 'Expected Contact Rate', value: `${(logistics.expectedContactRate * 100).toFixed(0)}%` },
      { label: 'Return Strategy', value: logistics.returnVisitStrategy || 'Same-day follow-up' },
    ];

    metrics.forEach((metric, i) => {
      const x = this.margin + i * metricWidth + 5;
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(100, 116, 139);
      this.pdf.text(metric.label, x, metricsY);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(metric.value, x, metricsY + 6);
      this.pdf.setFont('helvetica', 'normal');
    });

    return y + 42;
  }

  private renderTeamRecommendations(config: CanvassingPlanConfig, startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('TEAM RECOMMENDATIONS', this.margin, y);
    y += 6;

    const doorsPerVolunteerPerHour = config.logistics.avgDoorsPerHour;
    const hoursPerShift = 3;
    const doorsPerVolunteer = doorsPerVolunteerPerHour * hoursPerShift;

    const recommendations = [
      `Recommended ${config.suggestedVolunteers} volunteers for complete coverage`,
      `Each volunteer can cover ~${doorsPerVolunteer.toFixed(0)} doors in a ${hoursPerShift}-hour shift`,
      `Pair new canvassers with experienced team members`,
      `Assign turfs based on efficiency scores when possible`,
    ];

    this.pdf.setFillColor(236, 253, 245); // Light green
    const boxHeight = recommendations.length * 8 + 10;
    this.pdf.rect(this.margin, y, width, boxHeight, 'F');

    this.pdf.setFillColor(5, 150, 105);
    this.pdf.rect(this.margin, y, 3, boxHeight, 'F');

    let recY = y + 8;
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    recommendations.forEach(rec => {
      this.pdf.setFillColor(5, 150, 105);
      this.pdf.circle(this.margin + 8, recY - 1, 1.5, 'F');
      this.pdf.text(rec, this.margin + 12, recY);
      recY += 8;
    });

    return y + boxHeight + 8;
  }

  private renderShiftSuggestion(config: CanvassingPlanConfig, startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('SUGGESTED SHIFT SCHEDULE', this.margin, y);
    y += 6;

    // Simple schedule table
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(this.margin, y, width, 7, 'F');

    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text('Shift', this.margin + 5, y + 5);
    this.pdf.text('Time', this.margin + 40, y + 5);
    this.pdf.text('Volunteers', this.margin + 80, y + 5);
    this.pdf.text('Doors Target', this.margin + 120, y + 5);
    y += 7;

    const shifts = [
      { name: 'Morning', time: '10:00 AM - 1:00 PM', volunteers: Math.ceil(config.suggestedVolunteers * 0.4) },
      { name: 'Afternoon', time: '3:00 PM - 6:00 PM', volunteers: Math.ceil(config.suggestedVolunteers * 0.6) },
      { name: 'Evening', time: '5:30 PM - 8:00 PM', volunteers: Math.ceil(config.suggestedVolunteers * 0.5) },
    ];

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    shifts.forEach((shift, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, y, width, 7, 'F');
      }

      const doorsTarget = shift.volunteers * config.logistics.avgDoorsPerHour * 2.5;

      this.pdf.text(shift.name, this.margin + 5, y + 5);
      this.pdf.text(shift.time, this.margin + 40, y + 5);
      this.pdf.text(shift.volunteers.toString(), this.margin + 80, y + 5);
      this.pdf.text(Math.round(doorsTarget).toLocaleString(), this.margin + 120, y + 5);
      y += 7;
    });

    return y + 5;
  }

  private renderTurfCard(turf: CanvassTurfData, startY: number, width: number): number {
    let y = startY;

    // Card background
    this.pdf.setFillColor(248, 250, 252);
    this.pdf.rect(this.margin, y, width, 32, 'F');

    // Priority badge
    this.pdf.setFillColor(5, 150, 105);
    this.pdf.rect(this.margin, y, 3, 32, 'F');

    // Turf name
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.text(`${turf.turfName}`, this.margin + 8, y + 7);

    // Priority badge
    this.pdf.setFillColor(5, 150, 105);
    this.pdf.roundedRect(this.margin + width - 25, y + 3, 20, 6, 1, 1, 'F');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(6);
    this.pdf.text(`#${turf.priorityRank}`, this.margin + width - 22, y + 7);

    // Precinct
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text(`Precinct: ${turf.precinctName}`, this.margin + 8, y + 13);

    // Metrics row
    const metricsY = y + 20;
    this.pdf.setFontSize(6);
    this.pdf.setTextColor(100, 116, 139);

    const turfMetrics = [
      { label: 'Doors', value: turf.totalDoors.toLocaleString() },
      { label: 'Hours', value: turf.estimatedHours.toFixed(1) },
      { label: 'Team', value: turf.suggestedTeamSize.toString() },
      { label: 'GOTV', value: turf.gotvScore.toFixed(0) },
      { label: 'Contact', value: `${(turf.contactRateExpected * 100).toFixed(0)}%` },
    ];

    const metricGap = (width - 20) / turfMetrics.length;
    turfMetrics.forEach((metric, i) => {
      const x = this.margin + 8 + i * metricGap;
      this.pdf.text(metric.label, x, metricsY);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      this.pdf.text(metric.value, x, metricsY + 5);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(100, 116, 139);
    });

    // Notes if any
    if (turf.notes) {
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(107, 114, 128);
      this.pdf.text(`Note: ${turf.notes}`, this.margin + 8, y + 30);
    }

    return y + 37;
  }

  private renderTalkingPoints(points: string[], startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('KEY TALKING POINTS', this.margin, y);
    y += 6;

    this.pdf.setFillColor(236, 253, 245);
    const boxHeight = points.length * 12 + 10;
    this.pdf.rect(this.margin, y, width, boxHeight, 'F');

    this.pdf.setFillColor(5, 150, 105);
    this.pdf.rect(this.margin, y, 3, boxHeight, 'F');

    let pointY = y + 8;
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59);

    points.forEach((point, i) => {
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(`${i + 1}.`, this.margin + 6, pointY);
      this.pdf.setFont('helvetica', 'normal');
      const lines = this.pdf.splitTextToSize(point, width - 20);
      lines.forEach((line: string, li: number) => {
        this.pdf.text(line, this.margin + 14, pointY + li * 4);
      });
      pointY += lines.length * 4 + 4;
    });

    return y + boxHeight + 8;
  }

  private renderFAQs(faqs: Array<{ question: string; answer: string }>, startY: number, width: number): number {
    let y = startY;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.text('FREQUENTLY ASKED QUESTIONS', this.margin, y);
    y += 6;

    faqs.forEach(faq => {
      // Question
      this.pdf.setFillColor(248, 250, 252);
      const qLines = this.pdf.splitTextToSize(`Q: ${faq.question}`, width - 10);
      const boxHeight = qLines.length * 4 + 6;
      this.pdf.rect(this.margin, y, width, boxHeight, 'F');

      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(30, 41, 59);
      let lineY = y + 5;
      qLines.forEach((line: string) => {
        this.pdf.text(line, this.margin + 5, lineY);
        lineY += 4;
      });
      y += boxHeight;

      // Answer
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(71, 85, 105);
      const aLines = this.pdf.splitTextToSize(`A: ${faq.answer}`, width - 10);
      aLines.forEach((line: string) => {
        this.pdf.text(line, this.margin + 5, y + 4);
        y += 4;
      });
      y += 6;
    });

    return y + 5;
  }

  private renderFooter(config: CanvassingPlanConfig, pageNum: number): void {
    const y = this.pageHeight - 10;

    this.pdf.setDrawColor(226, 232, 240);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margin, y - 3, this.pageWidth - this.margin, y - 3);

    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(148, 163, 184);

    const generatedBy = config.generatedBy || 'Political Analysis Platform';
    this.pdf.text(`Generated by ${generatedBy}`, this.margin, y);
    this.pdf.text(`Canvassing Plan | Page ${pageNum} of ${this.totalPages}`, this.pageWidth - this.margin - 45, y);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private addNewPage(): void {
    this.pdf.addPage();
    this.currentPage++;
  }
}

export default CanvassingPlanPDFGenerator;
