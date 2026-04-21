/**
 * Canvassing Plan PDF Generator V2
 *
 * Uses fixed-position template system for consistent layouts.
 * Generates 3-5 page operational field documents for volunteers.
 *
 * Pages:
 * 1. Operation Overview + Priority Ranking
 * 2. Logistics + Team Recommendations
 * 3+ Turf Assignments (paginated)
 * Last. Talking Points & FAQs (optional)
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
} from './templates/PoliticalPageTemplates';

import {
  renderStatCard,
  renderScoreCard,
} from './components/PoliticalKPICard';

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
// Configuration Types (preserved from V1)
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
  operationName: string;
  operationDate?: string;
  operationType: 'gotv' | 'persuasion' | 'voter_id' | 'general';

  targetArea: string;
  totalDoors: number;
  totalPrecincts: number;
  estimatedTotalHours: number;
  suggestedVolunteers: number;

  priorityPrecincts: Array<{
    name: string;
    doors: number;
    gotvScore: number;
    persuasionScore: number;
    priorityRank: number;
    efficiencyScore: number;
  }>;

  turfs?: CanvassTurfData[];

  logistics: {
    optimalTimes: string[];
    avgDoorsPerHour: number;
    expectedContactRate: number;
    returnVisitStrategy?: string;
  };

  talkingPoints?: string[];
  faqs?: Array<{ question: string; answer: string }>;

  county: string;
  state: string;
  generatedBy?: string;
  reportDate?: string;
}

// ============================================================================
// Fixed Position Templates
// ============================================================================

const CANVASS_PAGE1_TEMPLATE = {
  // Header bar
  headerBar: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 18 },
  headerTitle: { x: MARGINS.left + 5, y: 24, width: 100, height: 10 },
  headerBadge: { x: 160, y: 18, width: 30, height: 8 },
  headerDate: { x: MARGINS.left + 5, y: 30, width: 100, height: 6 },

  // Operation info
  operationName: { x: MARGINS.left, y: 40, width: CONTENT_AREA.width, height: 8 },
  operationTarget: { x: MARGINS.left, y: 48, width: CONTENT_AREA.width, height: 5 },
  operationDate: { x: MARGINS.left, y: 53, width: CONTENT_AREA.width, height: 4 },

  // Summary KPIs (4 in a row)
  summaryTitle: { x: MARGINS.left, y: 62, width: CONTENT_AREA.width, height: 5 },
  kpiRow: { x: MARGINS.left, y: 70, cardWidth: 42, cardHeight: 26, gap: 4 },

  // Priority ranking table
  priorityTitle: { x: MARGINS.left, y: 102, width: CONTENT_AREA.width, height: 5 },
  priorityTable: {
    x: MARGINS.left,
    y: 110,
    width: CONTENT_AREA.width,
    headerHeight: 8,
    rowHeight: 7,
    maxRows: 15,
  },
};

const CANVASS_PAGE2_TEMPLATE = {
  // Page header
  pageHeader: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 10 },

  // Logistics section
  logisticsTitle: { x: MARGINS.left, y: 30, width: CONTENT_AREA.width, height: 5 },
  logisticsBox: { x: MARGINS.left, y: 38, width: CONTENT_AREA.width, height: 35 },

  // Team recommendations
  teamTitle: { x: MARGINS.left, y: 80, width: CONTENT_AREA.width, height: 5 },
  teamBox: { x: MARGINS.left, y: 88, width: CONTENT_AREA.width, height: 45 },

  // Shift schedule
  shiftTitle: { x: MARGINS.left, y: 140, width: CONTENT_AREA.width, height: 5 },
  shiftTable: {
    x: MARGINS.left,
    y: 148,
    width: CONTENT_AREA.width,
    headerHeight: 7,
    rowHeight: 7,
  },
};

const CANVASS_TURF_TEMPLATE = {
  pageHeader: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 10 },
  turfCards: { x: MARGINS.left, y: 30, cardWidth: CONTENT_AREA.width, cardHeight: 35, gap: 5 },
};

const CANVASS_SCRIPTS_TEMPLATE = {
  pageHeader: { x: MARGINS.left, y: 15, width: CONTENT_AREA.width, height: 10 },
  talkingPointsTitle: { x: MARGINS.left, y: 30, width: CONTENT_AREA.width, height: 5 },
  talkingPointsBox: { x: MARGINS.left, y: 38, width: CONTENT_AREA.width, height: 80 },
  faqsTitle: { x: MARGINS.left, y: 125, width: CONTENT_AREA.width, height: 5 },
  faqsBox: { x: MARGINS.left, y: 133, width: CONTENT_AREA.width, height: 100 },
};

// ============================================================================
// PDF Generator Class
// ============================================================================

export class CanvassingPlanPDFGeneratorV2 {
  private renderer: PoliticalTemplateRenderer;
  private pdf: jsPDF;
  private totalPages: number = 2;

  constructor() {
    this.renderer = createPoliticalRenderer();
    this.pdf = this.renderer.getPdf();
  }

  async generateReport(config: CanvassingPlanConfig): Promise<Blob> {
    console.log('[CanvassingPlanPDFGeneratorV2] Starting generation:', config.operationName);

    // Validate configuration
    const validation = validateRequiredFields(
      config as unknown as Record<string, unknown>,
      ['operationName', 'operationType', 'targetArea', 'totalDoors', 'priorityPrecincts', 'logistics', 'county', 'state'],
      'CanvassingPlanConfig'
    );
    logValidationWarnings(validation, 'CanvassingPlanPDFGeneratorV2');

    // Calculate total pages
    const turfPages = config.turfs ? Math.ceil(config.turfs.length / 6) : 0;
    const hasScripts = config.talkingPoints?.length || config.faqs?.length;
    this.totalPages = 2 + turfPages + (hasScripts ? 1 : 0);

    // Page 1: Overview + Priority
    this.buildPage1(config);

    // Page 2: Logistics
    this.pdf.addPage();
    this.buildPage2(config);

    // Turf pages
    if (config.turfs?.length) {
      const turfsPerPage = 6;
      for (let i = 0; i < turfPages; i++) {
        this.pdf.addPage();
        const startIdx = i * turfsPerPage;
        const endIdx = Math.min(startIdx + turfsPerPage, config.turfs.length);
        this.buildTurfPage(config, config.turfs.slice(startIdx, endIdx), i + 1, turfPages);
      }
    }

    // Scripts page
    if (hasScripts) {
      this.pdf.addPage();
      this.buildScriptsPage(config);
    }

    const pdfBlob = this.pdf.output('blob');
    console.log('[CanvassingPlanPDFGeneratorV2] Generation complete');
    return pdfBlob;
  }

  private buildPage1(config: CanvassingPlanConfig): void {
    const t = CANVASS_PAGE1_TEMPLATE;

    // ========================================================================
    // Header Section
    // ========================================================================

    // Header bar (green for canvassing)
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
    this.pdf.rect(t.headerBar.x, t.headerBar.y, t.headerBar.width, t.headerBar.height, 'F');

    // Title
    this.pdf.setFontSize(14);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text('CANVASSING PLAN', t.headerTitle.x, t.headerTitle.y);

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
    this.pdf.roundedRect(t.headerBar.x + t.headerBar.width - badgeWidth - 5, t.headerBadge.y, badgeWidth, 6, 1, 1, 'F');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
    this.pdf.text(typeLabel, t.headerBar.x + t.headerBar.width - badgeWidth - 1, t.headerBadge.y + 4.5);

    // Date
    const reportDate = config.reportDate || formatDate(new Date());
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(9);
    this.pdf.text(reportDate, t.headerDate.x, t.headerDate.y);

    // Operation name
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.setFontSize(12);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.text(config.operationName, t.operationName.x, t.operationName.y);

    // Target area
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text(`Target: ${config.targetArea} | ${config.county} County, ${config.state}`, t.operationTarget.x, t.operationTarget.y);

    if (config.operationDate) {
      this.pdf.text(`Operation Date: ${config.operationDate}`, t.operationDate.x, t.operationDate.y);
    }

    // ========================================================================
    // Summary KPIs
    // ========================================================================

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('OPERATION SUMMARY', t.summaryTitle.x, t.summaryTitle.y);

    const kpi = t.kpiRow;

    // Card 1: Total Doors
    renderStatCard(this.pdf, kpi.x, kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Total Doors',
      value: config.totalDoors.toLocaleString(),
    });

    // Card 2: Precincts
    renderStatCard(this.pdf, kpi.x + kpi.cardWidth + kpi.gap, kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Precincts',
      value: config.totalPrecincts.toString(),
    });

    // Card 3: Est. Hours
    renderStatCard(this.pdf, kpi.x + 2 * (kpi.cardWidth + kpi.gap), kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Est. Hours',
      value: config.estimatedTotalHours.toFixed(0),
    });

    // Card 4: Volunteers
    renderStatCard(this.pdf, kpi.x + 3 * (kpi.cardWidth + kpi.gap), kpi.y, kpi.cardWidth, kpi.cardHeight, {
      label: 'Volunteers',
      value: config.suggestedVolunteers.toString(),
    });

    // ========================================================================
    // Priority Ranking Table
    // ========================================================================

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('PRIORITY RANKING', t.priorityTitle.x, t.priorityTitle.y);

    const table = t.priorityTable;
    let y = table.y;

    // Table header
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(table.x, y, table.width, table.headerHeight, 'F');

    this.pdf.setFontSize(7);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(71, 85, 105);

    const cols = [
      { label: '#', x: table.x + 2, width: 10 },
      { label: 'Precinct', x: table.x + 12, width: 60 },
      { label: 'Doors', x: table.x + 72, width: 25 },
      { label: 'GOTV', x: table.x + 97, width: 20 },
      { label: 'Persuade', x: table.x + 117, width: 25 },
      { label: 'Efficiency', x: table.x + 142, width: 25 },
    ];

    cols.forEach(col => {
      this.pdf.text(col.label, col.x, y + 5.5);
    });
    y += table.headerHeight;

    // Table rows
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    const displayPrecincts = config.priorityPrecincts.slice(0, table.maxRows);

    displayPrecincts.forEach((precinct, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
        this.pdf.rect(table.x, y, table.width, table.rowHeight, 'F');
      }

      // Priority indicator
      if (precinct.priorityRank <= 3) {
        this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
        this.pdf.circle(table.x + 5, y + 3.5, 2.5, 'F');
        this.pdf.setTextColor(255, 255, 255);
      } else {
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      }
      this.pdf.setFontSize(6);
      this.pdf.text(precinct.priorityRank.toString(), table.x + 4, y + 4.5);

      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
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
      if (gotv >= 70) this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
      else if (gotv >= 50) this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.persuasion));
      else this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text(`${gotv.toFixed(0)}`, cols[3].x, y + 4.5);

      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(`${precinct.persuasionScore.toFixed(0)}`, cols[4].x, y + 4.5);
      this.pdf.text(`${precinct.efficiencyScore.toFixed(0)}/hr`, cols[5].x, y + 4.5);

      y += table.rowHeight;
    });

    if (config.priorityPrecincts.length > table.maxRows) {
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text(`+ ${config.priorityPrecincts.length - table.maxRows} more precincts`, table.x, y + 5);
    }

    // Footer
    this.renderer.renderPageFooter('Canvassing Plan');
  }

  private buildPage2(config: CanvassingPlanConfig): void {
    const t = CANVASS_PAGE2_TEMPLATE;

    // Page header
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.pageHeader.x, t.pageHeader.y, t.pageHeader.width, t.pageHeader.height, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text('Logistics & Planning', t.pageHeader.x + 4, t.pageHeader.y + 7);

    // ========================================================================
    // Logistics
    // ========================================================================

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('LOGISTICS', t.logisticsTitle.x, t.logisticsTitle.y);

    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.logisticsBox.x, t.logisticsBox.y, t.logisticsBox.width, t.logisticsBox.height, 'F');

    // Optimal times
    this.pdf.setFontSize(8);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text('Optimal Canvass Times:', t.logisticsBox.x + 5, t.logisticsBox.y + 7);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text(config.logistics.optimalTimes.join(' | '), t.logisticsBox.x + 5, t.logisticsBox.y + 13);

    // Metrics row
    const metricsY = t.logisticsBox.y + 20;
    const metricWidth = t.logisticsBox.width / 3;

    const metrics = [
      { label: 'Avg Doors/Hour', value: config.logistics.avgDoorsPerHour.toFixed(0) },
      { label: 'Expected Contact Rate', value: `${(config.logistics.expectedContactRate * 100).toFixed(0)}%` },
      { label: 'Return Strategy', value: config.logistics.returnVisitStrategy || 'Same-day follow-up' },
    ];

    metrics.forEach((metric, i) => {
      const x = t.logisticsBox.x + i * metricWidth + 5;
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text(metric.label, x, metricsY);
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(metric.value, x, metricsY + 6);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
    });

    // ========================================================================
    // Team Recommendations
    // ========================================================================

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('TEAM RECOMMENDATIONS', t.teamTitle.x, t.teamTitle.y);

    const doorsPerVolunteerPerHour = config.logistics.avgDoorsPerHour;
    const hoursPerShift = 3;
    const doorsPerVolunteer = doorsPerVolunteerPerHour * hoursPerShift;

    const recommendations = [
      `Recommended ${config.suggestedVolunteers} volunteers for complete coverage`,
      `Each volunteer can cover ~${doorsPerVolunteer.toFixed(0)} doors in a ${hoursPerShift}-hour shift`,
      `Pair new canvassers with experienced team members`,
      `Assign turfs based on efficiency scores when possible`,
    ];

    this.pdf.setFillColor(236, 253, 245);
    this.pdf.rect(t.teamBox.x, t.teamBox.y, t.teamBox.width, t.teamBox.height, 'F');

    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
    this.pdf.rect(t.teamBox.x, t.teamBox.y, 3, t.teamBox.height, 'F');

    let recY = t.teamBox.y + 8;
    this.pdf.setFontSize(8);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));

    recommendations.forEach(rec => {
      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
      this.pdf.circle(t.teamBox.x + 8, recY - 1, 1.5, 'F');
      this.pdf.text(rec, t.teamBox.x + 12, recY);
      recY += 10;
    });

    // ========================================================================
    // Shift Schedule
    // ========================================================================

    this.pdf.setFontSize(10);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text('SUGGESTED SHIFT SCHEDULE', t.shiftTitle.x, t.shiftTitle.y);

    const shiftTable = t.shiftTable;
    let y = shiftTable.y;

    // Table header
    this.pdf.setFillColor(241, 245, 249);
    this.pdf.rect(shiftTable.x, y, shiftTable.width, shiftTable.headerHeight, 'F');

    this.pdf.setFontSize(7);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(71, 85, 105);
    this.pdf.text('Shift', shiftTable.x + 5, y + 5);
    this.pdf.text('Time', shiftTable.x + 40, y + 5);
    this.pdf.text('Volunteers', shiftTable.x + 80, y + 5);
    this.pdf.text('Doors Target', shiftTable.x + 120, y + 5);
    y += shiftTable.headerHeight;

    const shifts = [
      { name: 'Morning', time: '10:00 AM - 1:00 PM', volunteers: Math.ceil(config.suggestedVolunteers * 0.4) },
      { name: 'Afternoon', time: '3:00 PM - 6:00 PM', volunteers: Math.ceil(config.suggestedVolunteers * 0.6) },
      { name: 'Evening', time: '5:30 PM - 8:00 PM', volunteers: Math.ceil(config.suggestedVolunteers * 0.5) },
    ];

    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));

    shifts.forEach((shift, i) => {
      if (i % 2 === 0) {
        this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
        this.pdf.rect(shiftTable.x, y, shiftTable.width, shiftTable.rowHeight, 'F');
      }

      const doorsTarget = shift.volunteers * config.logistics.avgDoorsPerHour * 2.5;

      this.pdf.text(shift.name, shiftTable.x + 5, y + 5);
      this.pdf.text(shift.time, shiftTable.x + 40, y + 5);
      this.pdf.text(shift.volunteers.toString(), shiftTable.x + 80, y + 5);
      this.pdf.text(Math.round(doorsTarget).toLocaleString(), shiftTable.x + 120, y + 5);
      y += shiftTable.rowHeight;
    });

    // Footer
    this.renderer.renderPageFooter('Canvassing Plan');
  }

  private buildTurfPage(
    config: CanvassingPlanConfig,
    turfs: CanvassTurfData[],
    pageNum: number,
    totalTurfPages: number
  ): void {
    const t = CANVASS_TURF_TEMPLATE;

    // Page header
    const subtitle = totalTurfPages > 1 ? ` (${pageNum}/${totalTurfPages})` : '';
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.pageHeader.x, t.pageHeader.y, t.pageHeader.width, t.pageHeader.height, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text(`Turf Assignments${subtitle}`, t.pageHeader.x + 4, t.pageHeader.y + 7);

    let y = t.turfCards.y;
    turfs.forEach(turf => {
      if (y > PAGE_DIMENSIONS.height - 50) return; // Skip if no room

      this.renderTurfCard(turf, t.turfCards.x, y, t.turfCards.cardWidth, t.turfCards.cardHeight);
      y += t.turfCards.cardHeight + t.turfCards.gap;
    });

    // Footer
    this.renderer.renderPageFooter('Canvassing Plan');
  }

  private renderTurfCard(turf: CanvassTurfData, x: number, y: number, width: number, height: number): void {
    // Card background
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(x, y, width, height, 'F');

    // Priority accent bar
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
    this.pdf.rect(x, y, 3, height, 'F');

    // Turf name
    this.pdf.setFontSize(9);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text(turf.turfName, x + 8, y + 7);

    // Priority badge
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
    this.pdf.roundedRect(x + width - 25, y + 3, 20, 6, 1, 1, 'F');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(6);
    this.pdf.text(`#${turf.priorityRank}`, x + width - 22, y + 7);

    // Precinct
    this.pdf.setFontSize(7);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
    this.pdf.text(`Precinct: ${turf.precinctName}`, x + 8, y + 13);

    // Metrics row
    const metricsY = y + 20;
    const turfMetrics = [
      { label: 'Doors', value: turf.totalDoors.toLocaleString() },
      { label: 'Hours', value: turf.estimatedHours.toFixed(1) },
      { label: 'Team', value: turf.suggestedTeamSize.toString() },
      { label: 'GOTV', value: turf.gotvScore.toFixed(0) },
      { label: 'Contact', value: `${(turf.contactRateExpected * 100).toFixed(0)}%` },
    ];

    const metricGap = (width - 20) / turfMetrics.length;
    this.pdf.setFontSize(6);
    turfMetrics.forEach((metric, i) => {
      const mx = x + 8 + i * metricGap;
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text(metric.label, mx, metricsY);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
      this.pdf.text(metric.value, mx, metricsY + 5);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
    });

    // Notes
    if (turf.notes) {
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(107, 114, 128);
      this.pdf.text(`Note: ${turf.notes}`, x + 8, y + height - 5);
    }
  }

  private buildScriptsPage(config: CanvassingPlanConfig): void {
    const t = CANVASS_SCRIPTS_TEMPLATE;

    // Page header
    this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
    this.pdf.rect(t.pageHeader.x, t.pageHeader.y, t.pageHeader.width, t.pageHeader.height, 'F');

    this.pdf.setFontSize(11);
    this.pdf.setFont(FONT_SPECS.family, 'bold');
    this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
    this.pdf.text('Talking Points & FAQs', t.pageHeader.x + 4, t.pageHeader.y + 7);

    // Talking points
    if (config.talkingPoints?.length) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('KEY TALKING POINTS', t.talkingPointsTitle.x, t.talkingPointsTitle.y);

      const boxHeight = Math.min(t.talkingPointsBox.height, config.talkingPoints.length * 12 + 10);
      this.pdf.setFillColor(236, 253, 245);
      this.pdf.rect(t.talkingPointsBox.x, t.talkingPointsBox.y, t.talkingPointsBox.width, boxHeight, 'F');

      this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.gotv));
      this.pdf.rect(t.talkingPointsBox.x, t.talkingPointsBox.y, 3, boxHeight, 'F');

      let pointY = t.talkingPointsBox.y + 8;
      this.pdf.setFontSize(8);
      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));

      config.talkingPoints.slice(0, 6).forEach((point, i) => {
        this.pdf.setFont(FONT_SPECS.family, 'bold');
        this.pdf.text(`${i + 1}.`, t.talkingPointsBox.x + 6, pointY);
        this.pdf.setFont(FONT_SPECS.family, 'normal');
        const lines = this.pdf.splitTextToSize(point, t.talkingPointsBox.width - 20);
        lines.slice(0, 2).forEach((line: string, li: number) => {
          this.pdf.text(line, t.talkingPointsBox.x + 14, pointY + li * 4);
        });
        pointY += Math.min(lines.length, 2) * 4 + 6;
      });
    }

    // FAQs
    if (config.faqs?.length) {
      this.pdf.setFontSize(10);
      this.pdf.setFont(FONT_SPECS.family, 'bold');
      this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textSecondary));
      this.pdf.text('FREQUENTLY ASKED QUESTIONS', t.faqsTitle.x, t.faqsTitle.y);

      let faqY = t.faqsBox.y;
      config.faqs.slice(0, 4).forEach(faq => {
        // Question
        this.pdf.setFillColor(...this.hexToRgb(POLITICAL_COLORS.background));
        const qLines = this.pdf.splitTextToSize(`Q: ${faq.question}`, t.faqsBox.width - 10);
        const boxHeight = qLines.length * 4 + 6;
        this.pdf.rect(t.faqsBox.x, faqY, t.faqsBox.width, boxHeight, 'F');

        this.pdf.setFontSize(8);
        this.pdf.setFont(FONT_SPECS.family, 'bold');
        this.pdf.setTextColor(...this.hexToRgb(POLITICAL_COLORS.textPrimary));
        let lineY = faqY + 5;
        qLines.slice(0, 2).forEach((line: string) => {
          this.pdf.text(line, t.faqsBox.x + 5, lineY);
          lineY += 4;
        });
        faqY += boxHeight;

        // Answer
        this.pdf.setFont(FONT_SPECS.family, 'normal');
        this.pdf.setTextColor(71, 85, 105);
        const aLines = this.pdf.splitTextToSize(`A: ${faq.answer}`, t.faqsBox.width - 10);
        aLines.slice(0, 3).forEach((line: string) => {
          this.pdf.text(line, t.faqsBox.x + 5, faqY + 4);
          faqY += 4;
        });
        faqY += 6;
      });
    }

    // Footer
    this.renderer.renderPageFooter('Canvassing Plan');
  }

  private hexToRgb(hex: string): [number, number, number] {
    return hexToRgbUtil(hex);
  }
}

export default CanvassingPlanPDFGeneratorV2;
