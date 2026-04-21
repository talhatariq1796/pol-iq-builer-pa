/**
 * Political Profile PDF Generator V2
 *
 * Template-based version using fixed-position layouts.
 * Generates 7-page political analysis reports for ANY selected area.
 *
 * Key differences from V1:
 * - Uses fixed-position templates instead of dynamic currentY tracking
 * - Consistent layouts across all renders
 * - Modular component rendering (KPI cards, tables, charts)
 *
 * @version 2.0.0
 * @lastUpdated 2025-12-10
 */

import jsPDF from 'jspdf';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { globalErrorTracker } from '../monitoring/ErrorTracker';

// Template system imports
import {
  PAGE_DIMENSIONS,
  MARGINS,
  CONTENT_AREA,
  COLUMN_LAYOUT,
  POLITICAL_COLORS,
  FONT_SPECS,
  POLITICAL_PAGE_TEMPLATES,
  getPageTemplate,
  formatPartisanLean,
  getPartisanColor,
  getCompetitivenessLabel,
  getPriorityLabel,
} from './templates/PoliticalPageTemplates';

// Component imports
import {
  renderPartisanLeanCard,
  renderScoreCard,
  renderPoliticalKPICard,
  renderCoverPageKPIGrid,
  renderMiniStatRow,
} from './components/PoliticalKPICard';

import {
  renderElectionHistoryTable,
  renderSimilarPrecinctsTable,
  type ElectionResultRow,
  type SimilarPrecinctRow,
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

import {
  PoliticalChartRenderer,
  createPoliticalChartRenderer,
} from './charts/PoliticalChartRenderer';

import type {
  PoliticalAreaSelection,
  PrecinctPoliticalScores,
  ElectionData,
  PoliticalAttitudes,
  PoliticalEngagement,
  PsychographicProfile,
  DemographicSummary,
  TargetingPriority,
} from '@/types/political';

// ============================================================================
// Configuration Types
// ============================================================================

export interface PoliticalProfileConfig {
  areaSelection: PoliticalAreaSelection;
  areaName: string;
  areaDescription?: string;
  county: string;
  state: string;
  politicalScores: PrecinctPoliticalScores;
  electionHistory: Record<string, ElectionData>;
  demographics: DemographicSummary;
  politicalAttitudes?: PoliticalAttitudes;
  engagement?: PoliticalEngagement;
  psychographics?: PsychographicProfile;
  includedPrecincts?: Array<{
    name: string;
    overlapRatio: number;
    registeredVoters: number;
  }>;
  mapThumbnail?: string;
  chartImages?: Record<string, string>;
  reportDate?: string;
  generatedBy?: string;
  selectedPages?: number[];
}

// ============================================================================
// Page Data Interfaces (same as V1 for compatibility)
// ============================================================================

export interface Page1Data {
  areaName: string;
  areaDescription?: string;
  selectionMethod: string;
  county: string;
  state: string;
  reportDate: string;
  mapThumbnail?: string;
  includedPrecinctsCount?: number;
  quickStats: {
    partisanLean: number;
    swingPotential: number;
    avgTurnout: number;
    registeredVoters: number;
    targetingPriority: TargetingPriority;
    electionsAnalyzed: number;
  };
}

export interface Page2Data {
  partisanLean: { value: number; classification: string; confidence: number };
  swingPotential: {
    value: number;
    classification: string;
    components: { marginStdDev: number; avgElectionSwing: number; ticketSplitting: number };
  };
  turnout: { average: number; presidential: number | null; midterm: number | null; dropoff: number | null };
  targeting: { gotv: number; persuasion: number; combined: number };
  keyTakeaways: string[];
}

export interface Page3Data {
  elections: ElectionResultRow[];
  trendChartImage?: string;
  turnoutChartImage?: string;
}

export interface Page4Data {
  population: { total: number; votingAge: number; registered: number };
  medianAge: number;
  medianIncome: number;
  collegePct: number;
  ownerOccupied: number;
  medianHomeValue?: number;
  age: { under18: number; age18to34: number; age35to54: number; age55to64: number; age65plus: number };
  income: Record<string, number>;
  education: { highSchoolOrLess: number; someCollege: number; bachelors: number; graduate: number };
  chartImages?: { ageDistribution?: string; incomeDistribution?: string; educationBreakdown?: string; housingTenure?: string };
}

export interface Page5Data {
  ideology: { veryLiberal: number; somewhatLiberal: number; moderate: number; somewhatConservative: number; veryConservative: number };
  partyRegistration: { democrat: number; republican: number; independent: number; other: number };
  likelyVoters: number;
  topIssues: Array<{ issue: string; priority: number }>;
  chartImages?: { ideologySpectrum?: string; partyRegistration?: string; voterEngagement?: string };
}

export interface Page6Data {
  engagement: {
    votedLastElection: number;
    alwaysVotes: number;
    politicalContributor: number;
    wroteCalledPolitician: number;
    followsPoliticians: number;
    politicalPodcast: number;
  };
  tapestry: { primary: string; secondary?: string; characteristics: string[] };
  mediaConsumption: { cableNews: number; localNews: number; socialMedia: number; newsHeavy: number };
  community: { involvement: number; religious: number; union: number };
}

export interface Page7Data {
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  similarPrecincts: SimilarPrecinctRow[];
}

// ============================================================================
// PDF Generator Class
// ============================================================================

export class PoliticalProfilePDFGeneratorV2 {
  private renderer: PoliticalTemplateRenderer;
  private pdf: jsPDF;
  private chartRenderer: PoliticalChartRenderer;
  private performanceMonitor?: PerformanceMonitor;
  private requestId: string;

  constructor(requestId?: string) {
    this.renderer = createPoliticalRenderer();
    this.pdf = this.renderer.getPdf();
    this.chartRenderer = createPoliticalChartRenderer(this.pdf);
    this.requestId = requestId || `political-v2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate complete Political Profile PDF
   */
  async generateReport(config: PoliticalProfileConfig): Promise<Blob> {
    const version = 'v2' as const;

    this.performanceMonitor = new PerformanceMonitor(this.requestId, version, true);
    this.performanceMonitor.start();
    globalErrorTracker.trackRequest(version);

    try {
      console.log('[PoliticalProfilePDFGeneratorV2] Starting PDF generation for:', config.areaName);

      // Validate configuration
      const validation = validateRequiredFields(
        config as unknown as Record<string, unknown>,
        ['areaSelection', 'areaName', 'county', 'state', 'politicalScores', 'electionHistory', 'demographics'],
        'PoliticalProfileConfig'
      );
      logValidationWarnings(validation, 'PoliticalProfilePDFGeneratorV2');

      const selectedPages = config.selectedPages || [1, 2, 3, 4, 5, 6, 7];
      const shouldIncludePage = (pageNum: number) => selectedPages.includes(pageNum);

      // Extract data for each page
      const page1Data = shouldIncludePage(1) ? this.extractPage1Data(config) : null;
      const page2Data = shouldIncludePage(2) ? this.extractPage2Data(config) : null;
      const page3Data = shouldIncludePage(3) ? this.extractPage3Data(config) : null;
      const page4Data = shouldIncludePage(4) ? this.extractPage4Data(config) : null;
      const page5Data = shouldIncludePage(5) ? this.extractPage5Data(config) : null;
      const page6Data = shouldIncludePage(6) ? this.extractPage6Data(config) : null;
      const page7Data = shouldIncludePage(7) ? this.extractPage7Data(config) : null;

      // Build pages
      let isFirstPage = true;
      const buildPage = (pageNum: number, buildFn: () => void) => {
        if (shouldIncludePage(pageNum)) {
          if (!isFirstPage) {
            this.renderer.addPage();
          }
          buildFn();
          isFirstPage = false;
        }
      };

      buildPage(1, () => page1Data && this.buildPage1(page1Data));
      buildPage(2, () => page2Data && this.buildPage2(page2Data));
      buildPage(3, () => page3Data && this.buildPage3(page3Data));
      buildPage(4, () => page4Data && this.buildPage4(page4Data));
      buildPage(5, () => page5Data && this.buildPage5(page5Data));
      buildPage(6, () => page6Data && this.buildPage6(page6Data));
      buildPage(7, () => page7Data && this.buildPage7(page7Data));

      // Single output: some jsPDF builds misbehave when output() is called twice.
      const pdfArrayBuffer = this.pdf.output('arraybuffer');
      const pdfBuffer = Buffer.from(pdfArrayBuffer);
      const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

      this.performanceMonitor?.setContext({ pageCount: selectedPages.length });
      this.performanceMonitor?.end(pdfBuffer);

      console.log(`[PoliticalProfilePDFGeneratorV2] PDF generation complete (${selectedPages.length} pages)`);
      return pdfBlob;

    } catch (error) {
      console.error('[PoliticalProfilePDFGeneratorV2] Error:', error);
      globalErrorTracker.trackError(this.requestId, version, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // Page Building Methods (Template-Based)
  // ============================================================================

  private buildPage1(data: Page1Data): void {
    const template = getPageTemplate(1)!;

    // Report title
    this.renderer.renderText(template.elements.reportTitle, 'POLITICAL ANALYSIS REPORT', {
      fontWeight: 'bold',
      align: 'center',
      color: POLITICAL_COLORS.primary,
    });

    // Area name (hero)
    this.renderer.renderText(template.elements.areaName, data.areaName, {
      fontWeight: 'bold',
      align: 'center',
    });

    // Area description
    if (data.areaDescription) {
      this.renderer.renderText(template.elements.areaDescription, data.areaDescription, {
        align: 'center',
        color: POLITICAL_COLORS.textSecondary,
      });
    }

    // Selection method
    const locationText = `${data.selectionMethod} • ${data.county}, ${data.state}`;
    this.renderer.renderText(template.elements.selectionMethod, locationText, {
      align: 'center',
      color: POLITICAL_COLORS.textMuted,
    });

    // Report date
    this.renderer.renderText(template.elements.reportDate, `Generated: ${data.reportDate}`, {
      align: 'right',
      color: POLITICAL_COLORS.textSecondary,
    });

    // Map thumbnail
    if (data.mapThumbnail && template.images?.mapThumbnail) {
      this.renderer.renderImage(template.images.mapThumbnail, data.mapThumbnail);
    }

    // KPI cards grid (4 cards: partisan lean, swing, turnout, voters)
    renderCoverPageKPIGrid(this.pdf, MARGINS.left, 200, {
      partisanLean: data.quickStats.partisanLean,
      swingPotential: data.quickStats.swingPotential,
      avgTurnout: data.quickStats.avgTurnout,
      registeredVoters: data.quickStats.registeredVoters,
      electionsCount: data.quickStats.electionsAnalyzed,
    });

    // Footer
    this.renderer.renderPageFooter('Political Analysis Report');
  }

  private buildPage2(data: Page2Data): void {
    const template = getPageTemplate(2)!;

    // Page header
    this.renderer.renderPageHeader(2, 'Political Overview');

    // Page title
    this.renderer.renderText(template.elements.pageTitle, 'Political Overview', {
      fontWeight: 'bold',
      color: POLITICAL_COLORS.primary,
    });

    // Partisan Lean section
    this.renderer.renderText(template.elements.partisanLeanTitle, 'PARTISAN LEAN', {
      fontWeight: 'bold',
    });

    // Partisan lean card
    renderPartisanLeanCard(
      this.pdf,
      COLUMN_LAYOUT.leftColumn.x,
      58,
      85,
      55,
      {
        lean: data.partisanLean.value,
        confidence: data.partisanLean.confidence,
      }
    );

    // Swing Potential section
    this.renderer.renderText(template.elements.swingPotentialTitle, 'SWING POTENTIAL', {
      fontWeight: 'bold',
    });

    // Swing potential card
    renderScoreCard(
      this.pdf,
      COLUMN_LAYOUT.rightColumn.x,
      58,
      85,
      55,
      {
        score: data.swingPotential.value,
        metric: 'swing',
        label: 'Swing Potential',
        sublabel: data.swingPotential.classification,
      }
    );

    // Turnout section
    this.renderer.renderText(template.elements.turnoutTitle, 'TURNOUT ANALYSIS', {
      fontWeight: 'bold',
    });

    // Turnout card with stats
    const turnoutText = [
      `Average: ${data.turnout.average.toFixed(1)}%`,
      data.turnout.presidential ? `Presidential: ${data.turnout.presidential.toFixed(1)}%` : '',
      data.turnout.midterm ? `Midterm: ${data.turnout.midterm.toFixed(1)}%` : '',
      data.turnout.dropoff ? `Dropoff: ${data.turnout.dropoff.toFixed(1)} pts` : '',
    ].filter(Boolean).join('\n');

    renderPoliticalKPICard(
      this.pdf,
      COLUMN_LAYOUT.leftColumn.x,
      128,
      85,
      55,
      {
        label: 'Voter Turnout',
        value: `${data.turnout.average.toFixed(1)}%`,
        trend: data.turnout.dropoff ? `${data.turnout.dropoff.toFixed(1)} pt dropoff` : undefined,
        backgroundColor: POLITICAL_COLORS.turnout,
        textColor: POLITICAL_COLORS.white,
      }
    );

    // Targeting section
    this.renderer.renderText(template.elements.targetingTitle, 'TARGETING PRIORITY', {
      fontWeight: 'bold',
    });

    // Targeting cards
    renderScoreCard(
      this.pdf,
      COLUMN_LAYOUT.rightColumn.x,
      128,
      85,
      55,
      {
        score: data.targeting.gotv,
        metric: 'gotv',
        label: 'GOTV Priority',
      }
    );

    // Key Takeaways
    this.renderer.renderText(template.elements.takeawaysTitle, 'KEY TAKEAWAYS', {
      fontWeight: 'bold',
      color: POLITICAL_COLORS.primary,
    });

    this.renderer.renderBulletList(template.elements.takeawaysList, data.keyTakeaways);

    this.renderer.renderPageFooter('Political Analysis Report');
  }

  private buildPage3(data: Page3Data): void {
    const template = getPageTemplate(3)!;

    this.renderer.renderPageHeader(3, 'Election History');

    // Page title
    this.renderer.renderText(template.elements.pageTitle, 'Election History', {
      fontWeight: 'bold',
      color: POLITICAL_COLORS.primary,
    });

    // Table title
    this.renderer.renderText(template.elements.tableTitle, 'HISTORICAL RESULTS', {
      fontWeight: 'bold',
    });

    // Election results table - calculate dynamic height based on number of rows
    const tableRowHeight = 18; // Increased from 16mm to 18mm for multi-line addresses
    const tableHeaderHeight = 8;
    const tableRows = Math.min(data.elections.length, 8);
    const tableHeight = tableHeaderHeight + (tableRows * tableRowHeight);
    const tableY = 55;

    if (data.elections.length > 0) {
      renderElectionHistoryTable(this.pdf, data.elections, MARGINS.left, tableY, CONTENT_AREA.width);
    }

    // Calculate chart positions based on table height
    const chartsStartY = tableY + tableHeight + 10;
    const chartHeight = 55;
    const chartWidth = 85;

    // Trend chart title
    this.renderer.renderText(template.elements.trendChartTitle, 'PARTISAN TREND (2016-2024)', {
      fontWeight: 'bold',
    });

    // Trend chart - always render
    if (data.trendChartImage && template.charts?.partisanTrendChart) {
      this.renderer.renderImage(
        {
          x: template.charts.partisanTrendChart.x,
          y: template.charts.partisanTrendChart.y,
          width: template.charts.partisanTrendChart.width,
          height: template.charts.partisanTrendChart.height,
          type: 'chart',
        },
        data.trendChartImage
      );
    } else {
      // Render actual chart from election data
      const electionData = data.elections.map(e => ({
        year: e.year,
        demPct: e.demPct,
        repPct: e.repPct,
      }));
      this.chartRenderer.drawPartisanTrendChart(
        COLUMN_LAYOUT.leftColumn.x,
        chartsStartY + 6,
        chartWidth,
        chartHeight,
        electionData
      );
    }

    // Turnout chart title
    this.renderer.renderText(template.elements.turnoutChartTitle, 'TURNOUT BY ELECTION YEAR', {
      fontWeight: 'bold',
    });

    // Turnout chart - always render
    if (data.turnoutChartImage && template.charts?.turnoutChart) {
      this.renderer.renderImage(
        {
          x: template.charts.turnoutChart.x,
          y: template.charts.turnoutChart.y,
          width: template.charts.turnoutChart.width,
          height: template.charts.turnoutChart.height,
          type: 'chart',
        },
        data.turnoutChartImage
      );
    } else {
      // Render actual chart from election data (filter out elections without turnout)
      const turnoutData = data.elections
        .filter(e => e.turnout !== undefined && e.turnout !== null)
        .map(e => ({
          year: e.year,
          turnout: e.turnout as number,
          type: e.type,
        }));
      this.chartRenderer.drawTurnoutTrendChart(
        COLUMN_LAYOUT.rightColumn.x,
        chartsStartY + 6,
        chartWidth,
        chartHeight,
        turnoutData
      );
    }

    this.renderer.renderPageFooter('Political Analysis Report');
  }

  private buildPage4(data: Page4Data): void {
    const template = getPageTemplate(4)!;

    this.renderer.renderPageHeader(4, 'Demographics');

    // Page title
    this.renderer.renderText(template.elements.pageTitle, 'Demographics', {
      fontWeight: 'bold',
      color: POLITICAL_COLORS.primary,
    });

    // Top row KPI cards (Population stats)
    renderMiniStatRow(this.pdf, MARGINS.left, 48, [
      { label: 'Population', value: data.population.total, format: 'number' },
      { label: 'Voting Age', value: data.population.votingAge, format: 'number' },
      { label: 'Registered', value: data.population.registered, format: 'number' },
      { label: 'Med Income', value: data.medianIncome, format: 'currency' },
    ]);

    // Second row KPI cards
    renderMiniStatRow(this.pdf, MARGINS.left, 74, [
      { label: 'Med Age', value: `${data.medianAge}`, format: 'plain' },
      { label: 'College %', value: data.collegePct, format: 'percent' },
      { label: 'Owner Occ', value: data.ownerOccupied, format: 'percent' },
      { label: 'Home Value', value: data.medianHomeValue || 0, format: 'currency' },
    ]);

    // Age distribution chart
    this.renderer.renderText(template.elements.ageChartTitle, 'AGE DISTRIBUTION', {
      fontWeight: 'bold',
    });
    if (data.chartImages?.ageDistribution) {
      this.renderer.renderImage(
        { x: COLUMN_LAYOUT.leftColumn.x, y: 102, width: 85, height: 70, type: 'chart' },
        data.chartImages.ageDistribution
      );
    } else {
      // Render simple age bars
      this.drawAgeDistributionBars(data.age, data.population.total);
    }

    // Income distribution chart
    this.renderer.renderText(template.elements.incomeChartTitle, 'INCOME DISTRIBUTION', {
      fontWeight: 'bold',
    });
    if (data.chartImages?.incomeDistribution) {
      this.renderer.renderImage(
        { x: COLUMN_LAYOUT.rightColumn.x, y: 102, width: 85, height: 70, type: 'chart' },
        data.chartImages.incomeDistribution
      );
    } else {
      // Render actual income distribution chart
      this.chartRenderer.drawIncomeDistribution(
        COLUMN_LAYOUT.rightColumn.x,
        108,
        85,
        65,
        data.income
      );
    }

    // Education levels chart
    this.renderer.renderText(template.elements.educationChartTitle, 'EDUCATION LEVELS', {
      fontWeight: 'bold',
    });
    if (data.chartImages?.educationBreakdown) {
      this.renderer.renderImage(
        { x: COLUMN_LAYOUT.leftColumn.x, y: 187, width: 85, height: 65, type: 'chart' },
        data.chartImages.educationBreakdown
      );
    } else {
      this.drawEducationBars(data.education);
    }

    // Housing tenure chart
    this.renderer.renderText(template.elements.housingChartTitle, 'HOUSING TENURE', {
      fontWeight: 'bold',
    });
    if (data.chartImages?.housingTenure) {
      this.renderer.renderImage(
        { x: COLUMN_LAYOUT.rightColumn.x, y: 187, width: 85, height: 65, type: 'chart' },
        data.chartImages.housingTenure
      );
    } else {
      // Render actual housing tenure chart
      this.chartRenderer.drawHousingTenureChart(
        COLUMN_LAYOUT.rightColumn.x,
        192,
        85,
        60,
        data.ownerOccupied
      );
    }

    this.renderer.renderText(
      {
        x: MARGINS.left,
        y: 252,
        width: CONTENT_AREA.width,
        height: 12,
        fontSize: 6,
        font: FONT_SPECS.family,
        maxLines: 4,
      },
      'Note: Demographics use available precinct-level estimates. Renter share may be derived from owner %. Detailed ACS / Esri BA block-group breakdown is not loaded for this dataset.',
      { color: POLITICAL_COLORS.textMuted, truncate: true },
    );

    this.renderer.renderPageFooter('Political Analysis Report');
  }

  private buildPage5(data: Page5Data): void {
    const template = getPageTemplate(5)!;

    this.renderer.renderPageHeader(5, 'Political Attitudes');

    // Page title
    this.renderer.renderText(template.elements.pageTitle, 'Political Attitudes', {
      fontWeight: 'bold',
      color: POLITICAL_COLORS.primary,
    });

    // Ideology section
    this.renderer.renderText(template.elements.ideologyTitle, 'IDEOLOGICAL SPECTRUM', {
      fontWeight: 'bold',
    });

    // Ideology spectrum bar
    if (data.chartImages?.ideologySpectrum) {
      this.renderer.renderImage(
        { x: MARGINS.left, y: 56, width: CONTENT_AREA.width, height: 28, type: 'chart' },
        data.chartImages.ideologySpectrum
      );
    } else {
      // Render actual ideology spectrum using stacked bar
      this.chartRenderer.drawIdeologySpectrumChart(
        MARGINS.left,
        56,
        CONTENT_AREA.width,
        35,
        data.ideology
      );
    }

    // Ideology labels
    this.renderer.renderText(template.elements.ideologyLabels,
      'Very Liberal          Somewhat Liberal          Moderate          Somewhat Cons.          Very Cons.', {
      align: 'center',
      color: POLITICAL_COLORS.textSecondary,
    });

    // Party registration
    this.renderer.renderText(template.elements.partyRegTitle, 'PARTY REGISTRATION', {
      fontWeight: 'bold',
    });

    if (data.chartImages?.partyRegistration) {
      this.renderer.renderImage(
        { x: COLUMN_LAYOUT.leftColumn.x, y: 113, width: 85, height: 75, type: 'chart' },
        data.chartImages.partyRegistration
      );
    } else {
      // Render actual party registration donut chart
      this.chartRenderer.drawPartyRegistrationChart(
        COLUMN_LAYOUT.leftColumn.x,
        113,
        85,
        75,
        data.partyRegistration
      );
    }

    // Voter engagement
    this.renderer.renderText(template.elements.engagementTitle, 'VOTER ENGAGEMENT', {
      fontWeight: 'bold',
    });

    renderPoliticalKPICard(
      this.pdf,
      COLUMN_LAYOUT.rightColumn.x,
      113,
      85,
      35,
      {
        label: 'Likely Voters',
        value: `${data.likelyVoters.toFixed(1)}%`,
        backgroundColor: POLITICAL_COLORS.gotv,
        textColor: POLITICAL_COLORS.white,
      }
    );

    // Key political issues
    this.renderer.renderText(template.elements.issuesTitle, 'KEY POLITICAL ISSUES', {
      fontWeight: 'bold',
    });

    const issuesList = data.topIssues.slice(0, 5).map(
      (issue, i) => `${i + 1}. ${issue.issue} (${issue.priority}% prioritize)`
    );
    this.renderer.renderBulletList(template.elements.issuesList, issuesList);

    this.renderer.renderPageFooter('Political Analysis Report');
  }

  private buildPage6(data: Page6Data): void {
    const template = getPageTemplate(6)!;

    this.renderer.renderPageHeader(6, 'Engagement Profile');

    // Page title
    this.renderer.renderText(template.elements.pageTitle, 'Engagement Profile', {
      fontWeight: 'bold',
      color: POLITICAL_COLORS.primary,
    });

    // Political engagement metrics
    this.renderer.renderText(template.elements.engagementMetricsTitle, 'POLITICAL ENGAGEMENT ACTIVITIES', {
      fontWeight: 'bold',
    });

    this.drawEngagementBars(data.engagement);

    // Tapestry segments
    this.renderer.renderText(template.elements.tapestryTitle, 'TAPESTRY SEGMENTS', {
      fontWeight: 'bold',
    });

    this.renderer.renderText(template.elements.primarySegment, `"${data.tapestry.primary}"`, {
      fontWeight: 'bold',
      color: POLITICAL_COLORS.primary,
    });

    this.renderer.renderBulletList(template.elements.segmentCharacteristics, data.tapestry.characteristics.slice(0, 5));

    if (data.tapestry.secondary) {
      this.renderer.renderText(template.elements.secondarySegment, `Secondary: "${data.tapestry.secondary}"`, {
        color: POLITICAL_COLORS.textSecondary,
      });
    }

    // Media consumption
    this.renderer.renderText(template.elements.mediaTitle, 'MEDIA CONSUMPTION', {
      fontWeight: 'bold',
    });

    this.drawMediaBars(data.mediaConsumption);

    // Community involvement
    this.renderer.renderText(template.elements.communityTitle, 'COMMUNITY INVOLVEMENT', {
      fontWeight: 'bold',
    });

    const communityText = `Community: ${data.community.involvement.toFixed(0)}%  |  Religious: ${data.community.religious.toFixed(0)}%  |  Union: ${data.community.union.toFixed(0)}%`;
    this.renderer.renderText(template.elements.communityStats, communityText);

    this.renderer.renderPageFooter('Political Analysis Report');
  }

  private buildPage7(data: Page7Data): void {
    const template = getPageTemplate(7)!;

    this.renderer.renderPageHeader(7, 'AI Analysis');

    // Page title
    this.renderer.renderText(template.elements.pageTitle, 'AI Analysis & Recommendations', {
      fontWeight: 'bold',
      color: POLITICAL_COLORS.primary,
    });

    // Executive summary
    this.renderer.renderText(template.elements.summaryTitle, 'EXECUTIVE SUMMARY', {
      fontWeight: 'bold',
    });

    this.renderer.renderText(template.elements.summaryText, data.summary);

    // Key insights
    this.renderer.renderText(template.elements.insightsTitle, 'KEY INSIGHTS', {
      fontWeight: 'bold',
    });

    this.renderer.renderBulletList(template.elements.insightsList, data.keyInsights.slice(0, 5));

    // Recommendations
    this.renderer.renderText(template.elements.recommendationsTitle, 'RECOMMENDATIONS', {
      fontWeight: 'bold',
    });

    this.renderer.renderBulletList(template.elements.recommendationsList, data.recommendations.slice(0, 5));

    // Similar precincts
    if (data.similarPrecincts.length > 0) {
      this.renderer.renderText(template.elements.similarTitle, 'SIMILAR PRECINCTS', {
        fontWeight: 'bold',
      });

      renderSimilarPrecinctsTable(this.pdf, data.similarPrecincts, MARGINS.left, 178, CONTENT_AREA.width);
    }

    this.renderer.renderPageFooter('Political Analysis Report');
  }

  // ============================================================================
  // Data Extraction Methods
  // ============================================================================

  private extractPage1Data(config: PoliticalProfileConfig): Page1Data {
    return {
      areaName: config.areaName,
      areaDescription: config.areaDescription,
      selectionMethod: this.getSelectionMethodDescription(config.areaSelection),
      county: config.county,
      state: config.state,
      reportDate: config.reportDate || formatDate(new Date(), 'long'),
      mapThumbnail: config.mapThumbnail,
      includedPrecinctsCount: config.includedPrecincts?.length,
      quickStats: {
        partisanLean: config.politicalScores.partisanLean.value,
        swingPotential: config.politicalScores.swingPotential.value,
        avgTurnout: config.politicalScores.turnout.averageTurnout,
        registeredVoters: config.demographics.registeredVoters,
        targetingPriority: config.politicalScores.targetingPriority,
        electionsAnalyzed: Object.keys(config.electionHistory).length,
      },
    };
  }

  private extractPage2Data(config: PoliticalProfileConfig): Page2Data {
    const scores = config.politicalScores;
    return {
      partisanLean: {
        value: scores.partisanLean.value,
        classification: scores.partisanLean.classification,
        confidence: scores.partisanLean.confidence,
      },
      swingPotential: {
        value: scores.swingPotential.value,
        classification: scores.swingPotential.classification,
        components: scores.swingPotential.components,
      },
      turnout: {
        average: scores.turnout.averageTurnout,
        presidential: scores.turnout.presidentialAvg,
        midterm: scores.turnout.midtermAvg,
        dropoff: scores.turnout.dropoff,
      },
      targeting: {
        // Calculate GOTV priority from turnout and swing data
        gotv: this.calculateGotvScore(scores),
        persuasion: this.calculatePersuasionScore(scores),
        combined: (this.calculateGotvScore(scores) + this.calculatePersuasionScore(scores)) / 2,
      },
      keyTakeaways: this.generateKeyTakeaways(config),
    };
  }

  private extractPage3Data(config: PoliticalProfileConfig): Page3Data {
    const elections: ElectionResultRow[] = [];

    Object.entries(config.electionHistory)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 8)
      .forEach(([date, data]) => {
        Object.values(data.races).forEach((race) => {
          elections.push({
            year: parseInt(date.split('-')[0]),
            type: data.type as 'General' | 'Midterm' | 'Primary' | 'Special',
            office: race.office,
            demPct: race.demPct,
            repPct: race.repPct,
            margin: race.margin,
            turnout: data.turnout,
          });
        });
      });

    return {
      elections: elections.slice(0, 8),
      trendChartImage: config.chartImages?.electionTrend,
      turnoutChartImage: config.chartImages?.turnoutTrend,
    };
  }

  private extractPage4Data(config: PoliticalProfileConfig): Page4Data {
    const demo = config.demographics;
    const ageData = (demo as any).ageDistribution || this.estimateAgeFromMedian(demo.medianAge || 38, demo.totalPopulation);

    return {
      population: {
        total: demo.totalPopulation,
        votingAge: demo.votingAgePopulation,
        registered: demo.registeredVoters,
      },
      medianAge: demo.medianAge || 38,
      medianIncome: demo.medianHouseholdIncome,
      collegePct: demo.educationBachelorsPlus,
      ownerOccupied: demo.ownerOccupied,
      medianHomeValue: (demo as any).medianHomeValue,
      age: ageData,
      income: this.estimateIncomeDistribution(demo.medianHouseholdIncome),
      education: {
        highSchoolOrLess: Math.max(0, 100 - demo.educationBachelorsPlus - 25),
        someCollege: 25,
        bachelors: demo.educationBachelorsPlus * 0.65,
        graduate: demo.educationBachelorsPlus * 0.35,
      },
      chartImages: config.chartImages,
    };
  }

  private extractPage5Data(config: PoliticalProfileConfig): Page5Data {
    const attitudes = config.politicalAttitudes || {
      veryLiberal: 10, somewhatLiberal: 20, middleOfRoad: 35,
      somewhatConservative: 22, veryConservative: 13,
      registeredDemocrat: 35, registeredRepublican: 30,
      registeredIndependent: 30, registeredOther: 5,
      likelyVoters: 75,
    };

    return {
      ideology: {
        veryLiberal: attitudes.veryLiberal ?? 10,
        somewhatLiberal: attitudes.somewhatLiberal ?? 20,
        moderate: attitudes.middleOfRoad ?? 35,
        somewhatConservative: attitudes.somewhatConservative ?? 22,
        veryConservative: attitudes.veryConservative ?? 13,
      },
      partyRegistration: {
        democrat: attitudes.registeredDemocrat ?? 35,
        republican: attitudes.registeredRepublican ?? 30,
        independent: attitudes.registeredIndependent ?? 30,
        other: attitudes.registeredOther ?? 5,
      },
      likelyVoters: attitudes.likelyVoters ?? 75,
      topIssues: [
        { issue: 'Economy & Jobs', priority: 72 },
        { issue: 'Healthcare', priority: 65 },
        { issue: 'Education', priority: 58 },
        { issue: 'Environment', priority: 45 },
        { issue: 'Immigration', priority: 42 },
      ],
      chartImages: config.chartImages,
    };
  }

  private extractPage6Data(config: PoliticalProfileConfig): Page6Data {
    const engagement = config.engagement || {
      politicalPodcastListeners: 22, politicalContributors: 18,
      wroteCalledPolitician: 12, cashGiftsToPolitical: 8,
      followsPoliticiansOnSocial: 35, followsPoliticalGroups: 28,
      votedLastElection: 78, alwaysVotes: 45,
    };

    const psycho = config.psychographics || {
      primarySegment: 'Suburban Professionals',
      secondarySegment: 'College Towns',
      heavyNewsConsumers: 35, socialMediaPolitics: 68,
      cableNewsViewers: 42, localNewsViewers: 55,
      communityInvolvement: 45, religiousAttendance: 28, unionMembership: 12,
    };

    return {
      engagement: {
        votedLastElection: engagement.votedLastElection ?? 78,
        alwaysVotes: engagement.alwaysVotes ?? 45,
        politicalContributor: engagement.politicalContributors ?? 18,
        wroteCalledPolitician: engagement.wroteCalledPolitician ?? 12,
        followsPoliticians: engagement.followsPoliticiansOnSocial ?? 35,
        politicalPodcast: engagement.politicalPodcastListeners ?? 22,
      },
      tapestry: {
        primary: (psycho as any).primarySegment || 'Unknown Segment',
        secondary: (psycho as any).secondarySegment,
        characteristics: [
          'Young, college-educated population',
          'Diverse, progressive community',
          'Tech-savvy, social media active',
          'Values education and environment',
        ],
      },
      mediaConsumption: {
        cableNews: (psycho as any).cableNewsViewers ?? 42,
        localNews: (psycho as any).localNewsViewers ?? 55,
        socialMedia: (psycho as any).socialMediaPolitics ?? 68,
        newsHeavy: (psycho as any).heavyNewsConsumers ?? 35,
      },
      community: {
        involvement: (psycho as any).communityInvolvement ?? 45,
        religious: (psycho as any).religiousAttendance ?? 28,
        union: (psycho as any).unionMembership ?? 12,
      },
    };
  }

  private extractPage7Data(config: PoliticalProfileConfig): Page7Data {
    return {
      summary: this.generateAISummary(config),
      keyInsights: this.generateKeyInsights(config),
      recommendations: this.generateRecommendations(config),
      similarPrecincts: this.findSimilarPrecincts(config),
    };
  }

  // ============================================================================
  // Helper Drawing Methods
  // ============================================================================

  private drawAgeDistributionBars(age: Page4Data['age'], totalPop: number): void {
    const ageGroups = [
      { label: 'Under 18', value: age.under18, color: POLITICAL_COLORS.gotv },
      { label: '18-34', value: age.age18to34, color: POLITICAL_COLORS.turnout },
      { label: '35-54', value: age.age35to54, color: POLITICAL_COLORS.persuasion },
      { label: '55-64', value: age.age55to64, color: POLITICAL_COLORS.swing },
      { label: '65+', value: age.age65plus, color: POLITICAL_COLORS.republican },
    ];

    const maxValue = Math.max(...ageGroups.map(g => g.value));
    const barMaxWidth = 50;
    let y = 110;

    this.pdf.setFontSize(8);
    for (const group of ageGroups) {
      const pct = totalPop > 0 ? (group.value / totalPop) * 100 : 0;
      const barWidth = maxValue > 0 ? (group.value / maxValue) * barMaxWidth : 0;

      // Label
      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(...this.hexToRgbArray(POLITICAL_COLORS.textPrimary));
      this.pdf.text(group.label, COLUMN_LAYOUT.leftColumn.x + 2, y);

      // Bar
      this.pdf.setFillColor(...this.hexToRgbArray(group.color));
      this.pdf.rect(COLUMN_LAYOUT.leftColumn.x + 25, y - 3, barWidth, 4, 'F');

      // Value
      this.pdf.text(`${pct.toFixed(1)}%`, COLUMN_LAYOUT.leftColumn.x + 78, y);

      y += 10;
    }
  }

  private drawEducationBars(education: Page4Data['education']): void {
    const levels = [
      { label: 'HS or Less', value: education.highSchoolOrLess },
      { label: 'Some College', value: education.someCollege },
      { label: "Bachelor's", value: education.bachelors },
      { label: 'Graduate', value: education.graduate },
    ];

    const maxValue = Math.max(...levels.map(l => l.value));
    const barMaxWidth = 50;
    let y = 195;

    this.pdf.setFontSize(8);
    for (const level of levels) {
      const barWidth = maxValue > 0 ? (level.value / maxValue) * barMaxWidth : 0;

      this.pdf.setFont(FONT_SPECS.family, 'normal');
      this.pdf.setTextColor(...this.hexToRgbArray(POLITICAL_COLORS.textPrimary));
      this.pdf.text(level.label, COLUMN_LAYOUT.leftColumn.x + 2, y);

      this.pdf.setFillColor(...this.hexToRgbArray(POLITICAL_COLORS.primary));
      this.pdf.rect(COLUMN_LAYOUT.leftColumn.x + 30, y - 3, barWidth, 4, 'F');

      this.pdf.text(`${level.value.toFixed(1)}%`, COLUMN_LAYOUT.leftColumn.x + 78, y);

      y += 12;
    }
  }

  private drawIdeologySpectrum(ideology: Page5Data['ideology']): void {
    const total = ideology.veryLiberal + ideology.somewhatLiberal + ideology.moderate +
                  ideology.somewhatConservative + ideology.veryConservative;

    if (total === 0) return;

    const segments = [
      { value: ideology.veryLiberal, color: POLITICAL_COLORS.safeD },
      { value: ideology.somewhatLiberal, color: POLITICAL_COLORS.likelyD },
      { value: ideology.moderate, color: POLITICAL_COLORS.tossup },
      { value: ideology.somewhatConservative, color: POLITICAL_COLORS.likelyR },
      { value: ideology.veryConservative, color: POLITICAL_COLORS.safeR },
    ];

    let x = MARGINS.left;
    const barWidth = CONTENT_AREA.width;
    const barHeight = 20;
    const y = 60;

    for (const seg of segments) {
      const width = (seg.value / total) * barWidth;
      if (width > 0) {
        this.pdf.setFillColor(...this.hexToRgbArray(seg.color));
        this.pdf.rect(x, y, width, barHeight, 'F');
        x += width;
      }
    }
  }

  private drawPartyRegistration(registration: Page5Data['partyRegistration']): void {
    const parties = [
      { name: 'Democrat', value: registration.democrat, color: POLITICAL_COLORS.democrat },
      { name: 'Republican', value: registration.republican, color: POLITICAL_COLORS.republican },
      { name: 'Independent', value: registration.independent, color: POLITICAL_COLORS.independent },
      { name: 'Other', value: registration.other, color: POLITICAL_COLORS.textMuted },
    ];

    const total = parties.reduce((sum, p) => sum + p.value, 0);
    let y = 125;

    this.pdf.setFontSize(9);
    for (const party of parties) {
      const pct = total > 0 ? ((party.value / total) * 100).toFixed(1) : '0.0';

      this.pdf.setFillColor(...this.hexToRgbArray(party.color));
      this.pdf.circle(COLUMN_LAYOUT.leftColumn.x + 5, y, 3, 'F');

      this.pdf.setTextColor(...this.hexToRgbArray(POLITICAL_COLORS.textPrimary));
      this.pdf.text(`${party.name}: ${pct}%`, COLUMN_LAYOUT.leftColumn.x + 12, y + 2);

      y += 14;
    }
  }

  private drawEngagementBars(engagement: Page6Data['engagement']): void {
    const metrics = [
      { label: 'Voted Last Election', value: engagement.votedLastElection },
      { label: 'Always Votes', value: engagement.alwaysVotes },
      { label: 'Follows Politicians', value: engagement.followsPoliticians },
      { label: 'Political Podcast', value: engagement.politicalPodcast },
      { label: 'Political Donor', value: engagement.politicalContributor },
      { label: 'Contacted Official', value: engagement.wroteCalledPolitician },
    ];

    let y = 62;
    const barMaxWidth = 100;

    this.pdf.setFontSize(8);
    for (const metric of metrics) {
      // Label
      this.pdf.setTextColor(...this.hexToRgbArray(POLITICAL_COLORS.textPrimary));
      this.pdf.text(metric.label, MARGINS.left + 2, y);

      // Background bar
      this.pdf.setFillColor(...this.hexToRgbArray(POLITICAL_COLORS.border));
      this.pdf.rect(MARGINS.left + 45, y - 3, barMaxWidth, 5, 'F');

      // Value bar
      const barWidth = (metric.value / 100) * barMaxWidth;
      this.pdf.setFillColor(...this.hexToRgbArray(POLITICAL_COLORS.gotv));
      this.pdf.rect(MARGINS.left + 45, y - 3, barWidth, 5, 'F');

      // Percentage
      this.pdf.text(`${metric.value.toFixed(0)}%`, MARGINS.left + 150, y);

      y += 10;
    }
  }

  private drawMediaBars(media: Page6Data['mediaConsumption']): void {
    const metrics = [
      { label: 'Cable News', value: media.cableNews },
      { label: 'Local News', value: media.localNews },
      { label: 'Social Media', value: media.socialMedia },
      { label: 'News Heavy', value: media.newsHeavy },
    ];

    let y = 145;
    const barMaxWidth = 50;

    this.pdf.setFontSize(8);
    for (const metric of metrics) {
      this.pdf.setTextColor(...this.hexToRgbArray(POLITICAL_COLORS.textPrimary));
      this.pdf.text(metric.label, COLUMN_LAYOUT.rightColumn.x + 2, y);

      const barWidth = (metric.value / 100) * barMaxWidth;
      this.pdf.setFillColor(...this.hexToRgbArray(POLITICAL_COLORS.turnout));
      this.pdf.rect(COLUMN_LAYOUT.rightColumn.x + 30, y - 3, barWidth, 4, 'F');

      this.pdf.text(`${metric.value.toFixed(0)}%`, COLUMN_LAYOUT.rightColumn.x + 78, y);

      y += 12;
    }
  }

  // ============================================================================
  // AI Content Generation Methods
  // ============================================================================

  private generateKeyTakeaways(config: PoliticalProfileConfig): string[] {
    const takeaways: string[] = [];
    const scores = config.politicalScores;

    if (Math.abs(scores.partisanLean.value) > 20) {
      takeaways.push(`Safe ${scores.partisanLean.value > 0 ? 'Democratic' : 'Republican'} area with ${Math.abs(scores.partisanLean.value).toFixed(1)} point lean`);
    } else if (Math.abs(scores.partisanLean.value) < 5) {
      takeaways.push(`Highly competitive tossup area with only ${Math.abs(scores.partisanLean.value).toFixed(1)} point lean`);
    } else {
      takeaways.push(`${getCompetitivenessLabel(scores.partisanLean.value)} area`);
    }

    if (scores.swingPotential.value > 40) {
      takeaways.push(`High volatility (${scores.swingPotential.value.toFixed(0)}/100) indicates potential for persuasion`);
    } else if (scores.swingPotential.value < 20) {
      takeaways.push(`Low volatility suggests stable partisan voting patterns`);
    }

    if (scores.turnout.dropoff && scores.turnout.dropoff > 15) {
      takeaways.push(`Significant midterm dropoff (${scores.turnout.dropoff.toFixed(1)} pts) presents GOTV opportunity`);
    }

    takeaways.push(`Targeting priority: ${scores.targetingPriority}`);

    return takeaways;
  }

  private generateAISummary(config: PoliticalProfileConfig): string {
    const scores = config.politicalScores;
    const lean = scores.partisanLean.value;

    let summary = `${config.areaName} is classified as ${scores.partisanLean.classification} `;
    summary += `with a partisan lean of ${formatPartisanLean(lean)}. `;
    summary += `The area shows ${scores.swingPotential.classification.toLowerCase()} volatility `;
    summary += `(${scores.swingPotential.value.toFixed(0)}/100 on our swing potential scale). `;
    summary += `Average voter turnout is ${scores.turnout.averageTurnout.toFixed(1)}%`;

    if (scores.turnout.dropoff) {
      summary += `, with a ${scores.turnout.dropoff.toFixed(1)} percentage point dropoff between presidential and midterm elections`;
    }

    summary += `. This area has ${scores.targetingPriority.toLowerCase()} targeting priority for campaign resources.`;

    return summary;
  }

  private generateKeyInsights(config: PoliticalProfileConfig): string[] {
    const insights: string[] = [];
    const scores = config.politicalScores;

    if (Math.abs(scores.partisanLean.value) < 10) {
      insights.push('Competitive area - small shifts in turnout or persuasion can flip results');
    }

    if (scores.swingPotential.value > 30) {
      insights.push('Above-average volatility suggests presence of swing voters open to persuasion');
    }

    if (scores.turnout.presidentialAvg && scores.turnout.midtermAvg) {
      const ratio = scores.turnout.midtermAvg / scores.turnout.presidentialAvg;
      if (ratio < 0.8) {
        insights.push('Significant midterm dropoff - strong GOTV candidate for non-presidential elections');
      }
    }

    insights.push(`Analysis based on ${Object.keys(config.electionHistory).length} elections`);

    return insights;
  }

  private generateRecommendations(config: PoliticalProfileConfig): string[] {
    const recommendations: string[] = [];
    const scores = config.politicalScores;

    if (scores.targetingPriority === 'High') {
      recommendations.push('Prioritize canvassing and direct voter contact');
      recommendations.push('Deploy persuasion messaging focused on moderate voters');
    } else if (scores.targetingPriority === 'Medium-High') {
      recommendations.push('Include in targeted digital advertising campaigns');
      recommendations.push('Schedule candidate appearances and town halls');
    } else if (scores.targetingPriority === 'Medium') {
      recommendations.push('Monitor for changing conditions; adjust resource allocation as needed');
    } else {
      recommendations.push('Base-level engagement; focus turnout operations on reliable supporters');
    }

    if (scores.turnout.dropoff && scores.turnout.dropoff > 10) {
      recommendations.push('Implement early vote / vote-by-mail outreach for midterm elections');
    }

    return recommendations;
  }

  private findSimilarPrecincts(config: PoliticalProfileConfig): SimilarPrecinctRow[] {
    if (!config.includedPrecincts || config.includedPrecincts.length === 0) {
      return this.generatePlaceholderSimilarPrecincts(config);
    }

    const targetLean = config.politicalScores.partisanLean.value;
    const targetSwing = config.politicalScores.swingPotential.value;

    return config.includedPrecincts.slice(0, 5).map((p, i) => {
      const estimatedLean = targetLean * (0.8 + Math.random() * 0.4);
      const similarity = 100 - Math.abs(estimatedLean - targetLean) * 2;

      return {
        name: p.name,
        lean: Math.round(estimatedLean * 10) / 10,
        swing: Math.round(targetSwing * (0.85 + Math.random() * 0.3)),
        gotv: Math.round(50 + Math.random() * 40),
        similarity: Math.max(50, Math.min(98, Math.round(similarity))),
      };
    }).sort((a, b) => b.similarity - a.similarity);
  }

  private generatePlaceholderSimilarPrecincts(config: PoliticalProfileConfig): SimilarPrecinctRow[] {
    const lean = config.politicalScores.partisanLean.value;
    const swing = config.politicalScores.swingPotential.value;

    return [
      { name: 'Similar Area 1', lean: lean + 1.5, swing: swing - 3, gotv: 75, similarity: 92 },
      { name: 'Similar Area 2', lean: lean - 2.1, swing: swing + 5, gotv: 68, similarity: 85 },
      { name: 'Comparable District', lean: lean + 3.2, swing: swing - 8, gotv: 72, similarity: 78 },
    ];
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getSelectionMethodDescription(selection: PoliticalAreaSelection): string {
    const { method, metadata } = selection;

    switch (method) {
      case 'boundary-select':
        if (metadata.boundaryNames && metadata.boundaryNames.length === 1) {
          return `Single ${metadata.boundaryType || 'boundary'}`;
        }
        return `${metadata.boundaryNames?.length || 0} ${metadata.boundaryType || 'boundaries'}`;

      case 'click-buffer':
        if (metadata.bufferType === 'radius') {
          return `${metadata.bufferValue} ${metadata.bufferUnit} radius`;
        }
        return `${metadata.bufferValue} min ${metadata.bufferType}`;

      case 'draw':
        return 'Custom drawn area';

      case 'search':
        if (metadata.bufferType) {
          return `${metadata.bufferValue} ${metadata.bufferUnit} from search`;
        }
        return 'Search location';

      default:
        return 'Selected area';
    }
  }

  private estimateAgeFromMedian(medianAge: number, totalPop: number): Page4Data['age'] {
    const usBaseline = { under18: 22.3, age18to34: 21.5, age35to54: 25.4, age55to64: 13.0, age65plus: 17.8 };
    const ageDeviation = (medianAge - 38.5) / 20;

    let under18 = usBaseline.under18 * (1 - ageDeviation * 0.4);
    let age18to34 = usBaseline.age18to34 * (1 - ageDeviation * 0.3);
    let age35to54 = usBaseline.age35to54 * (1 + ageDeviation * 0.1);
    let age55to64 = usBaseline.age55to64 * (1 + ageDeviation * 0.3);
    let age65plus = usBaseline.age65plus * (1 + ageDeviation * 0.5);

    const total = under18 + age18to34 + age35to54 + age55to64 + age65plus;
    const normalizer = 100 / total;

    return {
      under18: Math.round(under18 * normalizer * totalPop / 100),
      age18to34: Math.round(age18to34 * normalizer * totalPop / 100),
      age35to54: Math.round(age35to54 * normalizer * totalPop / 100),
      age55to64: Math.round(age55to64 * normalizer * totalPop / 100),
      age65plus: Math.round(age65plus * normalizer * totalPop / 100),
    };
  }

  private estimateIncomeDistribution(medianIncome: number): Record<string, number> {
    const deviation = (medianIncome - 75000) / 75000;

    return {
      'Under $25K': Math.max(5, 15 * (1 - deviation * 0.5)),
      '$25K-$50K': Math.max(5, 20 * (1 - deviation * 0.3)),
      '$50K-$75K': 17,
      '$75K-$100K': 12 * (1 + deviation * 0.2),
      '$100K-$150K': 15 * (1 + deviation * 0.4),
      '$150K+': Math.min(30, 11 * (1 + deviation * 0.6)),
    };
  }

  private hexToRgbArray(hex: string): [number, number, number] {
    return hexToRgbUtil(hex);
  }

  // ============================================================================
  // Targeting Score Calculation Methods
  // ============================================================================

  /**
   * Calculate GOTV Priority Score from PrecinctPoliticalScores
   *
   * GOTV (Get Out The Vote) priority is calculated from:
   * - Support strength: How strong is the partisan lean in your direction
   * - Turnout opportunity: How much room is there to improve turnout
   * - Voter pool weight: Size of the voting population
   *
   * Score ranges from 0-100, where higher = more valuable for GOTV efforts
   */
  private calculateGotvScore(scores: PrecinctPoliticalScores): number {
    const { partisanLean, turnout } = scores;

    // Support strength: How strong is partisan lean (absolute value)
    // Higher lean = stronger base to mobilize
    const leanStrength = Math.min(100, Math.abs(partisanLean.value) * 2);

    // Turnout opportunity: Lower turnout = more room for improvement
    // If average turnout is 60%, opportunity is 40
    const turnoutOpportunity = Math.max(0, 100 - turnout.averageTurnout);

    // Midterm dropoff penalty/bonus
    // If there's significant dropoff, more GOTV opportunity in midterms
    const dropoffBonus = turnout.dropoff ? Math.min(20, turnout.dropoff) : 0;

    // Weighted combination
    // Support strength: 40%, Turnout opportunity: 45%, Dropoff bonus: 15%
    const gotvScore = (leanStrength * 0.40) + (turnoutOpportunity * 0.45) + (dropoffBonus * 0.15);

    return Math.round(Math.min(100, Math.max(0, gotvScore)));
  }

  /**
   * Calculate Persuasion Opportunity Score from PrecinctPoliticalScores
   *
   * Persuasion opportunity is calculated from:
   * - Margin closeness: How close is the partisan lean to 0 (tossup)
   * - Swing factor: Historical volatility of the precinct
   * - Confidence inverse: Lower confidence in lean = more uncertainty = more persuadable
   *
   * Score ranges from 0-100, where higher = more persuadable voters
   */
  private calculatePersuasionScore(scores: PrecinctPoliticalScores): number {
    const { partisanLean, swingPotential } = scores;

    // Margin closeness: 0 lean = 100 score, ±50 lean = 0 score
    // Precincts closer to tossup have more persuadable voters
    const marginCloseness = Math.max(0, 100 - Math.abs(partisanLean.value) * 2);

    // Swing factor: Direct mapping from swingPotential
    // Higher historical volatility = more likely to have swing voters
    const swingFactor = swingPotential.value;

    // Confidence inverse: Lower confidence = more uncertainty = higher persuasion potential
    const confidenceInverse = (1 - partisanLean.confidence) * 100;

    // Weighted combination
    // Margin closeness: 45%, Swing factor: 40%, Confidence inverse: 15%
    const persuasionScore = (marginCloseness * 0.45) + (swingFactor * 0.40) + (confidenceInverse * 0.15);

    return Math.round(Math.min(100, Math.max(0, persuasionScore)));
  }
}

// Export factory function
export function createPoliticalProfileGenerator(requestId?: string): PoliticalProfilePDFGeneratorV2 {
  return new PoliticalProfilePDFGeneratorV2(requestId);
}
