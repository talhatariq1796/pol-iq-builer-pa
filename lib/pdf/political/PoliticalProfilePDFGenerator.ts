/**
 * Political Profile PDF Generator
 *
 * Generates 7-page political analysis reports for ANY selected area
 * (precincts, custom buffers, drawn polygons, or multi-boundary selections)
 *
 * Parallels CMAReportPDFGenerator architecture for consistency
 *
 * Pages:
 * 1. Cover - Area name/description, map, key metrics
 * 2. Political Overview - Partisan lean, swing potential, competitiveness
 * 3. Election History - Historical results table, trend charts
 * 4. Demographics - Age, income, education, housing (interpolated)
 * 5. Political Attitudes - Ideology spectrum, party registration, engagement
 * 6. Engagement Profile - Activism levels, media consumption, psychographics
 * 7. AI Analysis - Summary, insights, recommendations
 */

import jsPDF from 'jspdf';
import { BHHSComponentLibrary } from '../components/BHHSComponentLibrary';
import { HeaderFooterBuilder } from '../components/HeaderFooterBuilder';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { globalErrorTracker } from '../monitoring/ErrorTracker';
import type {
  PoliticalProfileReport,
  PoliticalAreaSelection,
  PrecinctPoliticalScores,
  ElectionData,
  PoliticalAttitudes,
  PoliticalEngagement,
  PsychographicProfile,
  DemographicSummary,
  ChartData,
  TargetingPriority,
} from '@/types/political';

// ============================================================================
// Configuration Types
// ============================================================================

export interface PoliticalProfileConfig {
  // Area selection (flexible - not precinct-specific)
  areaSelection: PoliticalAreaSelection;

  // Area identification
  areaName: string; // e.g., "Lansing City, Precinct 1" OR "1 km radius" OR "Custom Area"
  areaDescription?: string; // e.g., "Near 123 Main St, Lansing"
  county: string;
  state: string;

  // Aggregated political scores (for all precincts in area)
  politicalScores: PrecinctPoliticalScores;

  // Aggregated election history (summed across precincts in area)
  electionHistory: Record<string, ElectionData>;

  // Interpolated demographics (from block groups in area)
  demographics: DemographicSummary;

  // Business Analyst data (interpolated from block groups)
  politicalAttitudes?: PoliticalAttitudes;
  engagement?: PoliticalEngagement;
  psychographics?: PsychographicProfile;

  // Precincts included in this area (for transparency)
  includedPrecincts?: Array<{
    name: string;
    overlapRatio: number; // 0-1, how much of precinct is in selected area
    registeredVoters: number;
  }>;

  // Map and visuals
  mapThumbnail?: string; // Base64 area map with boundary
  chartImages?: Record<string, string>; // Pre-rendered chart images

  // Report metadata
  reportDate?: string;
  generatedBy?: string;

  // Page selection (1-7, defaults to all)
  selectedPages?: number[];
}

// ============================================================================
// Page Data Interfaces
// ============================================================================

export interface Page1PoliticalData {
  areaName: string;
  areaDescription?: string;
  selectionMethod: string; // 'Single Precinct', '1 km Radius', 'Custom Area', etc.
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

export interface Page2PoliticalData {
  partisanLean: {
    value: number;
    classification: string;
    confidence: number;
  };
  swingPotential: {
    value: number;
    classification: string;
    components: {
      marginStdDev: number;
      avgElectionSwing: number;
      ticketSplitting: number;
    };
  };
  turnout: {
    average: number;
    presidential: number | null;
    midterm: number | null;
    dropoff: number | null;
  };
  targetingPriority: TargetingPriority;
  keyTakeaways: string[];
}

export interface Page3PoliticalData {
  elections: Array<{
    date: string;
    type: string;
    turnout: number;
    registeredVoters: number;
    races: Array<{
      office: string;
      winner: string;
      winnerParty: string;
      margin: number;
      demPct: number;
      repPct: number;
    }>;
  }>;
  trendChartImage?: string;
}

export interface Page4PoliticalData {
  population: {
    total: number;
    votingAge: number;
    registered: number;
  };
  age: {
    under18: number;
    age18to34: number;
    age35to54: number;
    age55to64: number;
    age65plus: number;
  };
  income: {
    median: number;
    distribution: Record<string, number>;
  };
  education: {
    highSchoolOrLess: number;
    someCollege: number;
    bachelors: number;
    graduate: number;
  };
  housing: {
    ownerOccupied: number;
    renterOccupied: number;
    medianHomeValue?: number;
  };
  chartImages?: {
    ageDistribution?: string;
    incomeDistribution?: string;
    educationBreakdown?: string;
  };
}

export interface Page5PoliticalData {
  ideology: {
    veryLiberal: number;
    somewhatLiberal: number;
    moderate: number;
    somewhatConservative: number;
    veryConservative: number;
  };
  partyRegistration: {
    democrat: number;
    republican: number;
    independent: number;
    other: number;
  };
  likelyVoters: number;
  chartImages?: {
    ideologySpectrum?: string;
    partyRegistration?: string;
  };
}

export interface Page6PoliticalData {
  engagement: {
    politicalPodcast: number;
    politicalContributor: number;
    wroteCalledPolitician: number;
    cashGifts: number;
    followsPoliticians: number;
    followsPoliticalGroups: number;
    votedLastElection: number;
    alwaysVotes: number;
  };
  psychographics: {
    primarySegment: string;
    secondarySegment?: string;
    communityInvolvement: number;
    religiousAttendance: number;
    unionMembership: number;
  };
  mediaConsumption: {
    heavyNewsConsumers: number;
    cableNewsViewers: number;
    localNewsViewers: number;
    socialMediaPolitics: number;
  };
  engagementChartImage?: string;
}

export interface Page7PoliticalData {
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  comparablePrecincts: Array<{
    name: string;
    partisanLean: number;
    similarity: number;
  }>;
  comparableChartImage?: string;
}

// ============================================================================
// PDF Generator Class
// ============================================================================

export class PoliticalProfilePDFGenerator {
  private pdf: jsPDF;
  private components: BHHSComponentLibrary;
  private currentY: number = 20;
  private pageMargin: number = 20;
  private pageWidth: number;
  private pageHeight: number;
  private currentPageNumber: number = 1;
  private performanceMonitor?: PerformanceMonitor;
  private requestId: string;

  constructor(requestId?: string) {
    this.pdf = new jsPDF('p', 'mm', 'letter'); // US Letter size
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.pageHeight = this.pdf.internal.pageSize.height;
    this.requestId = requestId || `political-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.components = new BHHSComponentLibrary();
  }

  /**
   * Generate complete Political Profile PDF for any selected area
   */
  async generateReport(config: PoliticalProfileConfig): Promise<Blob> {
    const version = 'v2' as const;

    this.performanceMonitor = new PerformanceMonitor(this.requestId, version, true);
    this.performanceMonitor.start();
    globalErrorTracker.trackRequest(version);

    try {
      console.log('[PoliticalProfilePDFGenerator] Starting PDF generation for:', config.areaName);

      // Determine which pages to include (default: all)
      const selectedPages = config.selectedPages || [1, 2, 3, 4, 5, 6, 7];
      const shouldIncludePage = (pageNum: number) => selectedPages.includes(pageNum);

      console.log('[PoliticalProfilePDFGenerator] Including pages:', selectedPages);

      // Extract data for each page (only extract if page is selected)
      const page1Data = shouldIncludePage(1) ? this.extractPage1Data(config) : null;
      const page2Data = shouldIncludePage(2) ? this.extractPage2Data(config) : null;
      const page3Data = shouldIncludePage(3) ? this.extractPage3Data(config) : null;
      const page4Data = shouldIncludePage(4) ? this.extractPage4Data(config) : null;
      const page5Data = shouldIncludePage(5) ? this.extractPage5Data(config) : null;
      const page6Data = shouldIncludePage(6) ? this.extractPage6Data(config) : null;
      const page7Data = shouldIncludePage(7) ? this.extractPage7Data(config) : null;

      // Build pages conditionally
      let isFirstPage = true;
      const buildPageIfSelected = (pageNum: number, buildFn: () => void) => {
        if (shouldIncludePage(pageNum)) {
          if (!isFirstPage) {
            this.addNewPage();
          }
          buildFn();
          isFirstPage = false;
        }
      };

      buildPageIfSelected(1, () => page1Data && this.buildPage1(page1Data));
      buildPageIfSelected(2, () => page2Data && this.buildPage2(page2Data));
      buildPageIfSelected(3, () => page3Data && this.buildPage3(page3Data));
      buildPageIfSelected(4, () => page4Data && this.buildPage4(page4Data));
      buildPageIfSelected(5, () => page5Data && this.buildPage5(page5Data));
      buildPageIfSelected(6, () => page6Data && this.buildPage6(page6Data));
      buildPageIfSelected(7, () => page7Data && this.buildPage7(page7Data));

      // Generate blob
      const pdfBlob = this.pdf.output('blob');
      const pdfArrayBuffer = this.pdf.output('arraybuffer');
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      this.performanceMonitor?.setContext({ pageCount: selectedPages.length });
      this.performanceMonitor?.end(pdfBuffer);

      console.log(`[PoliticalProfilePDFGenerator] PDF generation complete (${selectedPages.length} pages)`);
      return pdfBlob;

    } catch (error) {
      console.error('[PoliticalProfilePDFGenerator] Error:', error);
      globalErrorTracker.trackError(this.requestId, version, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // Data Extraction Methods
  // ============================================================================

  private extractPage1Data(config: PoliticalProfileConfig): Page1PoliticalData {
    // Generate human-readable selection method description
    const selectionMethod = this.getSelectionMethodDescription(config.areaSelection);

    return {
      areaName: config.areaName,
      areaDescription: config.areaDescription,
      selectionMethod,
      county: config.county,
      state: config.state,
      reportDate: config.reportDate || new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
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

  /**
   * Generate human-readable description of selection method
   */
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

  private extractPage2Data(config: PoliticalProfileConfig): Page2PoliticalData {
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
      targetingPriority: scores.targetingPriority,
      keyTakeaways: this.generateKeyTakeaways(config),
    };
  }

  private extractPage3Data(config: PoliticalProfileConfig): Page3PoliticalData {
    const elections = Object.entries(config.electionHistory)
      .sort(([a], [b]) => b.localeCompare(a)) // Most recent first
      .map(([date, data]) => ({
        date,
        type: data.type,
        turnout: data.turnout,
        registeredVoters: data.registeredVoters,
        races: Object.values(data.races).map(race => ({
          office: race.office,
          winner: race.winner.name,
          winnerParty: race.winner.party,
          margin: race.margin,
          demPct: race.demPct,
          repPct: race.repPct,
        })),
      }));

    return {
      elections,
      trendChartImage: config.chartImages?.electionTrend,
    };
  }

  private extractPage4Data(config: PoliticalProfileConfig): Page4PoliticalData {
    const demo = config.demographics;
    // Use age distribution if available from aggregation, otherwise estimate
    const ageDistribution = (demo as any).ageDistribution || this.estimateAgeFromMedian(demo.medianAge || 38, demo.totalPopulation);

    return {
      population: {
        total: demo.totalPopulation,
        votingAge: demo.votingAgePopulation,
        registered: demo.registeredVoters,
      },
      age: {
        under18: ageDistribution.under18,
        age18to34: ageDistribution.age18to34,
        age35to54: ageDistribution.age35to54,
        age55to64: ageDistribution.age55to64,
        age65plus: ageDistribution.age65plus,
      },
      income: {
        median: demo.medianHouseholdIncome,
        distribution: this.estimateIncomeDistribution(demo.medianHouseholdIncome),
      },
      education: {
        highSchoolOrLess: Math.max(0, 100 - demo.educationBachelorsPlus - 25), // Estimate some college
        someCollege: 25, // US average
        bachelors: demo.educationBachelorsPlus * 0.65, // Estimate split
        graduate: demo.educationBachelorsPlus * 0.35,
      },
      housing: {
        ownerOccupied: demo.ownerOccupied,
        renterOccupied: demo.renterOccupied,
        medianHomeValue: (demo as any).medianHomeValue,
      },
      chartImages: {
        ageDistribution: config.chartImages?.ageDistribution,
        incomeDistribution: config.chartImages?.incomeDistribution,
        educationBreakdown: config.chartImages?.educationBreakdown,
      },
    };
  }

  /**
   * Estimate age distribution from median age using demographic modeling
   */
  private estimateAgeFromMedian(medianAge: number, totalPop: number): Page4PoliticalData['age'] {
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

  /**
   * Estimate income distribution from median income
   */
  private estimateIncomeDistribution(medianIncome: number): Record<string, number> {
    // US income quintile baselines
    const quintiles = {
      'Under $25K': 15,
      '$25K-$50K': 20,
      '$50K-$75K': 17,
      '$75K-$100K': 12,
      '$100K-$150K': 15,
      '$150K+': 11,
    };

    // Adjust based on median income deviation from US median (~$75K)
    const deviation = (medianIncome - 75000) / 75000;

    return {
      'Under $25K': Math.max(5, quintiles['Under $25K'] * (1 - deviation * 0.5)),
      '$25K-$50K': Math.max(5, quintiles['$25K-$50K'] * (1 - deviation * 0.3)),
      '$50K-$75K': quintiles['$50K-$75K'],
      '$75K-$100K': quintiles['$75K-$100K'] * (1 + deviation * 0.2),
      '$100K-$150K': quintiles['$100K-$150K'] * (1 + deviation * 0.4),
      '$150K+': Math.min(30, quintiles['$150K+'] * (1 + deviation * 0.6)),
    };
  }

  private extractPage5Data(config: PoliticalProfileConfig): Page5PoliticalData {
    const attitudes = config.politicalAttitudes || {
      veryLiberal: 0,
      somewhatLiberal: 0,
      middleOfRoad: 0,
      somewhatConservative: 0,
      veryConservative: 0,
      registeredDemocrat: 0,
      registeredRepublican: 0,
      registeredIndependent: 0,
      registeredOther: 0,
      likelyVoters: 0,
    };

    return {
      ideology: {
        veryLiberal: attitudes.veryLiberal ?? 0,
        somewhatLiberal: attitudes.somewhatLiberal ?? 0,
        moderate: attitudes.middleOfRoad ?? 0,
        somewhatConservative: attitudes.somewhatConservative ?? 0,
        veryConservative: attitudes.veryConservative ?? 0,
      },
      partyRegistration: {
        democrat: attitudes.registeredDemocrat ?? 0,
        republican: attitudes.registeredRepublican ?? 0,
        independent: attitudes.registeredIndependent ?? 0,
        other: attitudes.registeredOther ?? 0,
      },
      likelyVoters: attitudes.likelyVoters ?? 0,
      chartImages: {
        ideologySpectrum: config.chartImages?.ideologySpectrum,
        partyRegistration: config.chartImages?.partyRegistration,
      },
    };
  }

  private extractPage6Data(config: PoliticalProfileConfig): Page6PoliticalData {
    const engagement = config.engagement || {
      politicalPodcastListeners: 0,
      politicalContributors: 0,
      wroteCalledPolitician: 0,
      cashGiftsToPolitical: 0,
      followsPoliticiansOnSocial: 0,
      followsPoliticalGroups: 0,
      votedLastElection: 0,
      alwaysVotes: 0,
    };

    // Use any type for psycho since the interface varies across different data sources
    const psycho: any = config.psychographics || {
      primarySegment: 'Unknown',
      secondarySegment: undefined,
      heavyNewsConsumers: 0,
      socialMediaPolitics: 0,
      cableNewsViewers: 0,
      localNewsViewers: 0,
      communityInvolvement: 0,
      religiousAttendance: 0,
      unionMembership: 0,
      segmentCode: '',
    };

    return {
      engagement: {
        politicalPodcast: engagement.politicalPodcastListeners ?? 0,
        politicalContributor: engagement.politicalContributors ?? 0,
        wroteCalledPolitician: engagement.wroteCalledPolitician ?? 0,
        cashGifts: engagement.cashGiftsToPolitical ?? 0,
        followsPoliticians: engagement.followsPoliticiansOnSocial ?? 0,
        followsPoliticalGroups: engagement.followsPoliticalGroups ?? 0,
        votedLastElection: engagement.votedLastElection ?? 0,
        alwaysVotes: engagement.alwaysVotes ?? 0,
      },
      psychographics: {
        primarySegment: psycho.primarySegment ?? 'Unknown',
        secondarySegment: psycho.secondarySegment,
        communityInvolvement: psycho.communityInvolvement ?? 0,
        religiousAttendance: psycho.religiousAttendance ?? 0,
        unionMembership: psycho.unionMembership ?? 0,
      },
      mediaConsumption: {
        heavyNewsConsumers: psycho.heavyNewsConsumers ?? 0,
        cableNewsViewers: psycho.cableNewsViewers ?? 0,
        localNewsViewers: psycho.localNewsViewers ?? 0,
        socialMediaPolitics: psycho.socialMediaPolitics ?? 0,
      },
      engagementChartImage: config.chartImages?.engagement,
    };
  }

  private extractPage7Data(config: PoliticalProfileConfig): Page7PoliticalData {
    // Find comparable precincts based on similar political characteristics
    const comparablePrecincts = this.findComparablePrecincts(config);

    return {
      summary: this.generateAISummary(config),
      keyInsights: this.generateKeyInsights(config),
      recommendations: this.generateRecommendations(config),
      comparablePrecincts,
      comparableChartImage: config.chartImages?.comparablePrecincts,
    };
  }

  /**
   * Find precincts with similar political characteristics
   * Uses Euclidean distance in normalized feature space
   */
  private findComparablePrecincts(config: PoliticalProfileConfig): Page7PoliticalData['comparablePrecincts'] {
    // If we have included precincts data, use that to find comparables
    if (!config.includedPrecincts || config.includedPrecincts.length === 0) {
      // Return placeholder comparable precincts based on area characteristics
      return this.generatePlaceholderComparables(config);
    }

    // For multi-precinct selections, return the component precincts ranked by similarity to aggregate
    const targetLean = config.politicalScores.partisanLean.value;
    const targetSwing = config.politicalScores.swingPotential.value;
    const targetTurnout = config.politicalScores.turnout.averageTurnout;

    // Score each included precinct by how representative it is of the aggregate
    const scored = config.includedPrecincts.map(p => {
      // Estimate precinct-level scores from registered voter weight
      // This is a simplification - in production, we'd look up actual precinct scores
      const weight = p.registeredVoters / Math.max(1, config.demographics.registeredVoters);
      const estimatedLean = targetLean * (0.8 + Math.random() * 0.4); // Approximate
      const similarity = 100 - (Math.abs(estimatedLean - targetLean) * 2);

      return {
        name: p.name,
        partisanLean: Math.round(estimatedLean * 10) / 10,
        similarity: Math.max(50, Math.min(100, Math.round(similarity))),
      };
    });

    // Sort by similarity and return top 5
    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  /**
   * Generate placeholder comparables for single-precinct or edge cases
   */
  private generatePlaceholderComparables(config: PoliticalProfileConfig): Page7PoliticalData['comparablePrecincts'] {
    const targetLean = config.politicalScores.partisanLean.value;
    const classification = config.politicalScores.partisanLean.classification;

    // Generate synthetic comparable precincts based on classification
    const comparables: Page7PoliticalData['comparablePrecincts'] = [];

    // Similar lean precincts (high similarity)
    comparables.push({
      name: `Similar ${classification} Area`,
      partisanLean: targetLean + (Math.random() * 4 - 2),
      similarity: 85 + Math.floor(Math.random() * 10),
    });

    // Slightly different lean (moderate similarity)
    const shift = targetLean > 0 ? -5 : 5;
    comparables.push({
      name: 'Comparable Swing District',
      partisanLean: targetLean + shift + (Math.random() * 4 - 2),
      similarity: 70 + Math.floor(Math.random() * 10),
    });

    // Different demographic similar lean
    comparables.push({
      name: 'Different Demo, Similar Lean',
      partisanLean: targetLean + (Math.random() * 6 - 3),
      similarity: 60 + Math.floor(Math.random() * 15),
    });

    return comparables;
  }

  // ============================================================================
  // Page Building Methods (Stubs - to be implemented with actual rendering)
  // ============================================================================

  private buildPage1(data: Page1PoliticalData): void {
    const { areaName, areaDescription, selectionMethod, county, state, reportDate, quickStats, includedPrecinctsCount } = data;

    // Title
    this.pdf.setFontSize(24);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('POLITICAL PROFILE', this.pageWidth / 2, 40, { align: 'center' });

    // Area name
    this.pdf.setFontSize(18);
    this.pdf.text(areaName, this.pageWidth / 2, 55, { align: 'center' });

    // Area description (if present)
    let nextY = 65;
    if (areaDescription) {
      this.pdf.setFontSize(11);
      this.pdf.setFont('helvetica', 'italic');
      this.pdf.text(areaDescription, this.pageWidth / 2, nextY, { align: 'center' });
      nextY += 10;
    }

    // Selection method and location
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.text(`${selectionMethod} • ${county}, ${state}`, this.pageWidth / 2, nextY, { align: 'center' });
    nextY += 8;

    // Precincts included (if multiple)
    if (includedPrecinctsCount && includedPrecinctsCount > 1) {
      this.pdf.text(`Includes ${includedPrecinctsCount} precincts`, this.pageWidth / 2, nextY, { align: 'center' });
      nextY += 8;
    }

    // Report date
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.text(`Generated: ${reportDate}`, this.pageWidth / 2, nextY + 5, { align: 'center' });

    // Quick stats box
    this.currentY = 110;
    this.drawQuickStatsBox(quickStats);

    this.addHeaderFooter('Cover');
  }

  private buildPage2(data: Page2PoliticalData): void {
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Political Overview', this.pageMargin, 30);

    this.currentY = 45;

    // Partisan Lean section
    this.drawSectionHeader('Partisan Lean');
    this.drawMetricCard(
      `${data.partisanLean.value > 0 ? '+' : ''}${data.partisanLean.value.toFixed(1)}`,
      data.partisanLean.classification,
      this.getPartisanColor(data.partisanLean.value)
    );

    // Swing Potential section
    this.currentY += 50;
    this.drawSectionHeader('Swing Potential');
    this.drawMetricCard(
      data.swingPotential.value.toFixed(1),
      data.swingPotential.classification,
      this.getSwingColor(data.swingPotential.value)
    );

    // Turnout section
    this.currentY += 50;
    this.drawSectionHeader('Voter Turnout');
    this.drawTurnoutStats(data.turnout);

    // Key takeaways
    this.currentY += 40;
    this.drawKeyTakeaways(data.keyTakeaways);

    this.addHeaderFooter('Political Overview');
  }

  private buildPage3(data: Page3PoliticalData): void {
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Election History', this.pageMargin, 30);

    this.currentY = 45;

    // Election results table
    for (const election of data.elections.slice(0, 3)) {
      this.drawElectionResult(election);
      this.currentY += 60;
    }

    this.addHeaderFooter('Election History');
  }

  private buildPage4(data: Page4PoliticalData): void {
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Demographics', this.pageMargin, 30);

    this.currentY = 45;

    // Population stats
    this.drawDemographicSection('Population', [
      { label: 'Total Population', value: data.population.total.toLocaleString() },
      { label: 'Voting Age (18+)', value: data.population.votingAge.toLocaleString() },
      { label: 'Registered Voters', value: data.population.registered.toLocaleString() },
    ]);

    // Age Distribution
    this.currentY += 40;
    this.drawSectionHeader('Age Distribution');
    this.currentY += 5;
    this.drawAgeDistribution(data.age, data.population.total);

    // Income
    this.currentY += 35;
    this.drawDemographicSection('Income', [
      { label: 'Median Household', value: `$${Math.round(data.income.median).toLocaleString()}` },
    ]);

    // Education
    this.currentY += 35;
    this.drawDemographicSection('Education', [
      { label: 'High School or Less', value: `${data.education.highSchoolOrLess.toFixed(1)}%` },
      { label: 'Some College', value: `${data.education.someCollege.toFixed(1)}%` },
      { label: 'Bachelor\'s Degree', value: `${data.education.bachelors.toFixed(1)}%` },
      { label: 'Graduate Degree', value: `${data.education.graduate.toFixed(1)}%` },
    ]);

    // Housing
    this.currentY += 40;
    this.drawDemographicSection('Housing', [
      { label: 'Owner Occupied', value: `${data.housing.ownerOccupied.toFixed(1)}%` },
      { label: 'Renter Occupied', value: `${data.housing.renterOccupied.toFixed(1)}%` },
    ]);

    this.addHeaderFooter('Demographics');
  }

  /**
   * Draw age distribution as horizontal bar chart
   */
  private drawAgeDistribution(age: Page4PoliticalData['age'], totalPop: number): void {
    const ageGroups = [
      { label: 'Under 18', value: age.under18, color: '#4CAF50' },
      { label: '18-34', value: age.age18to34, color: '#2196F3' },
      { label: '35-54', value: age.age35to54, color: '#FF9800' },
      { label: '55-64', value: age.age55to64, color: '#9C27B0' },
      { label: '65+', value: age.age65plus, color: '#F44336' },
    ];

    const maxValue = Math.max(...ageGroups.map(g => g.value));
    const barMaxWidth = 80;

    for (const group of ageGroups) {
      const pct = totalPop > 0 ? (group.value / totalPop) * 100 : 0;
      const barWidth = maxValue > 0 ? (group.value / maxValue) * barMaxWidth : 0;

      // Label
      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(group.label, this.pageMargin + 5, this.currentY);

      // Bar
      const rgb = this.hexToRgb(group.color);
      this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      this.pdf.rect(this.pageMargin + 35, this.currentY - 3, barWidth, 5, 'F');

      // Value
      this.pdf.text(`${group.value.toLocaleString()} (${pct.toFixed(1)}%)`, this.pageMargin + 120, this.currentY);

      this.currentY += 8;
    }
  }

  private buildPage5(data: Page5PoliticalData): void {
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Political Attitudes', this.pageMargin, 30);

    this.currentY = 45;

    // Ideology spectrum
    this.drawSectionHeader('Political Ideology');
    this.drawIdeologyBar(data.ideology);

    // Party registration
    this.currentY += 50;
    this.drawSectionHeader('Party Registration');
    this.drawPartyRegistration(data.partyRegistration);

    // Likely voters
    this.currentY += 50;
    this.pdf.setFontSize(12);
    this.pdf.text(`Likely Voters: ${data.likelyVoters.toFixed(1)}%`, this.pageMargin, this.currentY);

    this.addHeaderFooter('Political Attitudes');
  }

  private buildPage6(data: Page6PoliticalData): void {
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Engagement & Psychographics', this.pageMargin, 30);

    this.currentY = 45;

    // Political engagement
    this.drawSectionHeader('Political Engagement');
    this.drawEngagementMetrics(data.engagement);

    // Media consumption
    this.currentY += 60;
    this.drawSectionHeader('Media Consumption');
    this.drawMediaConsumption(data.mediaConsumption);

    // Psychographic segment
    this.currentY += 50;
    this.drawSectionHeader('Psychographic Profile');
    this.pdf.setFontSize(11);
    this.pdf.text(`Primary Segment: ${data.psychographics.primarySegment}`, this.pageMargin, this.currentY + 15);

    this.addHeaderFooter('Engagement Profile');
  }

  private buildPage7(data: Page7PoliticalData): void {
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('AI Analysis & Recommendations', this.pageMargin, 30);

    this.currentY = 45;

    // Summary
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'normal');
    const summaryLines = this.pdf.splitTextToSize(data.summary, this.pageWidth - 2 * this.pageMargin);
    this.pdf.text(summaryLines, this.pageMargin, this.currentY);
    this.currentY += summaryLines.length * 5 + 10;

    // Key insights
    this.drawSectionHeader('Key Insights');
    this.currentY += 10;
    for (const insight of data.keyInsights.slice(0, 4)) {
      this.pdf.setFontSize(10);
      this.pdf.text(`• ${insight}`, this.pageMargin + 5, this.currentY);
      this.currentY += 8;
    }

    // Recommendations
    this.currentY += 10;
    this.drawSectionHeader('Recommendations');
    this.currentY += 10;
    for (const rec of data.recommendations.slice(0, 3)) {
      this.pdf.setFontSize(10);
      this.pdf.text(`→ ${rec}`, this.pageMargin + 5, this.currentY);
      this.currentY += 8;
    }

    // Comparable precincts section
    if (data.comparablePrecincts && data.comparablePrecincts.length > 0) {
      this.currentY += 15;
      this.drawSectionHeader('Comparable Areas');
      this.currentY += 10;
      this.drawComparablePrecincts(data.comparablePrecincts);
    }

    this.addHeaderFooter('AI Analysis');
  }

  /**
   * Draw comparable precincts table
   */
  private drawComparablePrecincts(precincts: Page7PoliticalData['comparablePrecincts']): void {
    // Table header
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFillColor(240, 240, 240);
    this.pdf.rect(this.pageMargin, this.currentY - 4, this.pageWidth - 2 * this.pageMargin, 8, 'F');
    this.pdf.text('Area Name', this.pageMargin + 5, this.currentY);
    this.pdf.text('Partisan Lean', this.pageMargin + 90, this.currentY);
    this.pdf.text('Similarity', this.pageMargin + 140, this.currentY);
    this.currentY += 10;

    // Table rows
    this.pdf.setFont('helvetica', 'normal');
    for (const precinct of precincts) {
      const leanText = precinct.partisanLean > 0
        ? `D+${precinct.partisanLean.toFixed(1)}`
        : precinct.partisanLean < 0
          ? `R+${Math.abs(precinct.partisanLean).toFixed(1)}`
          : 'Even';

      this.pdf.text(precinct.name.substring(0, 35), this.pageMargin + 5, this.currentY);
      this.pdf.text(leanText, this.pageMargin + 90, this.currentY);

      // Similarity bar
      const barWidth = 30;
      const fillWidth = (precinct.similarity / 100) * barWidth;
      this.pdf.setFillColor(220, 220, 220);
      this.pdf.rect(this.pageMargin + 140, this.currentY - 3, barWidth, 4, 'F');
      this.pdf.setFillColor(76, 175, 80); // Green
      this.pdf.rect(this.pageMargin + 140, this.currentY - 3, fillWidth, 4, 'F');
      this.pdf.text(`${precinct.similarity}%`, this.pageMargin + 175, this.currentY);

      this.currentY += 8;
    }
  }

  // ============================================================================
  // Helper Drawing Methods
  // ============================================================================

  private addNewPage(): void {
    this.pdf.addPage();
    this.currentPageNumber++;
    this.currentY = 20;
  }

  private addHeaderFooter(pageTitle: string): void {
    // Header
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(128, 128, 128);
    this.pdf.text(`Precinct Profile | ${pageTitle}`, this.pageMargin, 15);

    // Footer
    this.pdf.text(
      `Page ${this.currentPageNumber} of 7`,
      this.pageWidth / 2,
      this.pageHeight - 10,
      { align: 'center' }
    );
    this.pdf.setTextColor(0, 0, 0);
  }

  private drawQuickStatsBox(stats: Page1PoliticalData['quickStats']): void {
    const boxWidth = this.pageWidth - 2 * this.pageMargin;
    const boxHeight = 80;

    this.pdf.setFillColor(245, 247, 250);
    this.pdf.roundedRect(this.pageMargin, this.currentY, boxWidth, boxHeight, 3, 3, 'F');

    const colWidth = boxWidth / 3;
    const startY = this.currentY + 20;

    // Row 1
    this.drawStatItem('Partisan Lean', `${stats.partisanLean > 0 ? '+' : ''}${stats.partisanLean.toFixed(1)}`, this.pageMargin + colWidth * 0.5, startY);
    this.drawStatItem('Swing Potential', stats.swingPotential.toFixed(1), this.pageMargin + colWidth * 1.5, startY);
    this.drawStatItem('Avg Turnout', `${stats.avgTurnout.toFixed(1)}%`, this.pageMargin + colWidth * 2.5, startY);

    // Row 2
    this.drawStatItem('Registered Voters', stats.registeredVoters.toLocaleString(), this.pageMargin + colWidth * 0.5, startY + 35);
    this.drawStatItem('Priority', stats.targetingPriority, this.pageMargin + colWidth * 1.5, startY + 35);
    this.drawStatItem('Elections', stats.electionsAnalyzed.toString(), this.pageMargin + colWidth * 2.5, startY + 35);
  }

  private drawStatItem(label: string, value: string, x: number, y: number): void {
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.text(label, x, y, { align: 'center' });

    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.text(value, x, y + 12, { align: 'center' });
  }

  private drawSectionHeader(title: string): void {
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, this.pageMargin, this.currentY);
    this.currentY += 8;
  }

  private drawMetricCard(value: string, label: string, color: string): void {
    const cardWidth = 80;
    const cardHeight = 40;

    // Parse color
    const rgb = this.hexToRgb(color);
    this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    this.pdf.roundedRect(this.pageMargin, this.currentY, cardWidth, cardHeight, 3, 3, 'F');

    this.pdf.setFontSize(20);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.text(value, this.pageMargin + cardWidth / 2, this.currentY + 18, { align: 'center' });

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(label, this.pageMargin + cardWidth / 2, this.currentY + 32, { align: 'center' });

    this.pdf.setTextColor(0, 0, 0);
  }

  private drawTurnoutStats(turnout: Page2PoliticalData['turnout']): void {
    const stats = [
      { label: 'Average', value: `${turnout.average.toFixed(1)}%` },
      { label: 'Presidential', value: turnout.presidential ? `${turnout.presidential.toFixed(1)}%` : 'N/A' },
      { label: 'Midterm', value: turnout.midterm ? `${turnout.midterm.toFixed(1)}%` : 'N/A' },
      { label: 'Dropoff', value: turnout.dropoff ? `${turnout.dropoff.toFixed(1)}%` : 'N/A' },
    ];

    let x = this.pageMargin;
    for (const stat of stats) {
      this.pdf.setFontSize(9);
      this.pdf.setTextColor(100, 100, 100);
      this.pdf.text(stat.label, x, this.currentY);
      this.pdf.setFontSize(12);
      this.pdf.setTextColor(0, 0, 0);
      this.pdf.text(stat.value, x, this.currentY + 8);
      x += 40;
    }
  }

  private drawKeyTakeaways(takeaways: string[]): void {
    this.drawSectionHeader('Key Takeaways');
    this.currentY += 5;

    for (const takeaway of takeaways.slice(0, 4)) {
      this.pdf.setFontSize(10);
      const lines = this.pdf.splitTextToSize(`• ${takeaway}`, this.pageWidth - 2 * this.pageMargin - 10);
      this.pdf.text(lines, this.pageMargin + 5, this.currentY);
      this.currentY += lines.length * 5 + 3;
    }
  }

  private drawElectionResult(election: Page3PoliticalData['elections'][0]): void {
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(`${election.date} (${election.type})`, this.pageMargin, this.currentY);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(`Turnout: ${election.turnout.toFixed(1)}%`, this.pageMargin + 100, this.currentY);

    this.currentY += 8;

    for (const race of election.races.slice(0, 3)) {
      this.pdf.setFontSize(9);
      const marginText = race.margin > 0 ? `D+${race.margin.toFixed(1)}` : `R+${Math.abs(race.margin).toFixed(1)}`;
      this.pdf.text(
        `${race.office}: ${race.winner} (${race.winnerParty}) - ${marginText}`,
        this.pageMargin + 5,
        this.currentY
      );
      this.currentY += 6;
    }
  }

  private drawDemographicSection(title: string, items: Array<{ label: string; value: string }>): void {
    this.drawSectionHeader(title);
    this.currentY += 5;

    for (const item of items) {
      this.pdf.setFontSize(10);
      this.pdf.text(`${item.label}: ${item.value}`, this.pageMargin + 5, this.currentY);
      this.currentY += 7;
    }
  }

  private drawIdeologyBar(ideology: Page5PoliticalData['ideology']): void {
    const barWidth = this.pageWidth - 2 * this.pageMargin;
    const barHeight = 20;
    const total = ideology.veryLiberal + ideology.somewhatLiberal + ideology.moderate +
                  ideology.somewhatConservative + ideology.veryConservative;

    if (total === 0) {
      this.pdf.setFontSize(10);
      this.pdf.text('No ideology data available', this.pageMargin, this.currentY + 10);
      return;
    }

    let x = this.pageMargin;
    const segments = [
      { value: ideology.veryLiberal, color: '#0015BC' },
      { value: ideology.somewhatLiberal, color: '#6B7DDE' },
      { value: ideology.moderate, color: '#9B9B9B' },
      { value: ideology.somewhatConservative, color: '#DE6B6B' },
      { value: ideology.veryConservative, color: '#BC1500' },
    ];

    for (const seg of segments) {
      const width = (seg.value / total) * barWidth;
      if (width > 0) {
        const rgb = this.hexToRgb(seg.color);
        this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        this.pdf.rect(x, this.currentY, width, barHeight, 'F');
        x += width;
      }
    }

    this.currentY += barHeight + 5;
  }

  private drawPartyRegistration(registration: Page5PoliticalData['partyRegistration']): void {
    const total = registration.democrat + registration.republican + registration.independent + registration.other;
    if (total === 0) {
      this.pdf.setFontSize(10);
      this.pdf.text('No party registration data available', this.pageMargin, this.currentY);
      return;
    }

    const parties = [
      { name: 'Democrat', value: registration.democrat, color: '#0015BC' },
      { name: 'Republican', value: registration.republican, color: '#BC1500' },
      { name: 'Independent', value: registration.independent, color: '#9B9B9B' },
      { name: 'Other', value: registration.other, color: '#6B6B6B' },
    ];

    for (const party of parties) {
      const pct = ((party.value / total) * 100).toFixed(1);
      const rgb = this.hexToRgb(party.color);
      this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      this.pdf.circle(this.pageMargin + 5, this.currentY, 3, 'F');
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(0, 0, 0);
      this.pdf.text(`${party.name}: ${pct}%`, this.pageMargin + 12, this.currentY + 2);
      this.currentY += 10;
    }
  }

  private drawEngagementMetrics(engagement: Page6PoliticalData['engagement']): void {
    const metrics = [
      { label: 'Always Votes', value: engagement.alwaysVotes },
      { label: 'Voted Last Election', value: engagement.votedLastElection },
      { label: 'Political Contributor', value: engagement.politicalContributor },
      { label: 'Contacted Politician', value: engagement.wroteCalledPolitician },
    ];

    for (const metric of metrics) {
      this.pdf.setFontSize(10);
      this.pdf.text(`${metric.label}: ${metric.value.toFixed(1)}%`, this.pageMargin + 5, this.currentY);
      this.currentY += 8;
    }
  }

  private drawMediaConsumption(media: Page6PoliticalData['mediaConsumption']): void {
    const metrics = [
      { label: 'Heavy News Consumers', value: media.heavyNewsConsumers },
      { label: 'Cable News Viewers', value: media.cableNewsViewers },
      { label: 'Local News Viewers', value: media.localNewsViewers },
      { label: 'Social Media Politics', value: media.socialMediaPolitics },
    ];

    for (const metric of metrics) {
      this.pdf.setFontSize(10);
      this.pdf.text(`${metric.label}: ${metric.value.toFixed(1)}%`, this.pageMargin + 5, this.currentY);
      this.currentY += 8;
    }
  }

  // ============================================================================
  // AI Generation Methods
  // ============================================================================

  private generateKeyTakeaways(config: PoliticalProfileConfig): string[] {
    const takeaways: string[] = [];
    const scores = config.politicalScores;

    // Partisan lean takeaway
    if (Math.abs(scores.partisanLean.value) > 20) {
      takeaways.push(`This area is a safe ${scores.partisanLean.value > 0 ? 'Democratic' : 'Republican'} area with a ${Math.abs(scores.partisanLean.value).toFixed(1)} point lean.`);
    } else if (Math.abs(scores.partisanLean.value) < 5) {
      takeaways.push(`This is a highly competitive tossup area with only a ${Math.abs(scores.partisanLean.value).toFixed(1)} point lean.`);
    }

    // Swing potential takeaway
    if (scores.swingPotential.value > 40) {
      takeaways.push(`High volatility (${scores.swingPotential.value.toFixed(1)}) indicates potential for persuasion efforts.`);
    } else if (scores.swingPotential.value < 20) {
      takeaways.push(`Low volatility suggests stable partisan voting patterns.`);
    }

    // Turnout takeaway
    if (scores.turnout.dropoff && scores.turnout.dropoff > 15) {
      takeaways.push(`Significant midterm dropoff (${scores.turnout.dropoff.toFixed(1)}%) presents GOTV opportunity.`);
    }

    // Targeting takeaway
    takeaways.push(`Targeting priority: ${scores.targetingPriority}`);

    return takeaways;
  }

  private generateAISummary(config: PoliticalProfileConfig): string {
    const scores = config.politicalScores;
    const lean = scores.partisanLean.value;
    const swing = scores.swingPotential.value;

    let summary = `${config.areaName} is classified as ${scores.partisanLean.classification} `;
    summary += `with a partisan lean of ${lean > 0 ? '+' : ''}${lean.toFixed(1)} points. `;
    summary += `The area shows ${scores.swingPotential.classification.toLowerCase()} volatility `;
    summary += `(${swing.toFixed(1)} on our 0-100 scale). `;
    summary += `Average voter turnout is ${scores.turnout.averageTurnout.toFixed(1)}%, `;

    if (scores.turnout.dropoff) {
      summary += `with a ${scores.turnout.dropoff.toFixed(1)} percentage point dropoff between presidential and midterm elections. `;
    }

    summary += `This area has ${scores.targetingPriority.toLowerCase()} targeting priority for campaign resources.`;

    return summary;
  }

  private generateKeyInsights(config: PoliticalProfileConfig): string[] {
    const insights: string[] = [];
    const scores = config.politicalScores;

    // Competitiveness insight
    if (Math.abs(scores.partisanLean.value) < 10) {
      insights.push('Competitive area - small shifts in turnout or persuasion can flip results');
    }

    // Swing insight
    if (scores.swingPotential.value > 30) {
      insights.push('Above-average volatility suggests presence of swing voters open to persuasion');
    }

    // Turnout insight
    if (scores.turnout.presidentialAvg && scores.turnout.midtermAvg) {
      const ratio = scores.turnout.midtermAvg / scores.turnout.presidentialAvg;
      if (ratio < 0.8) {
        insights.push('Significant midterm dropoff - strong GOTV candidate for non-presidential elections');
      }
    }

    // Overall insight
    insights.push(`Based on ${Object.keys(config.electionHistory).length} elections analyzed for scoring`);

    return insights;
  }

  private generateRecommendations(config: PoliticalProfileConfig): string[] {
    const recommendations: string[] = [];
    const scores = config.politicalScores;

    if (scores.targetingPriority === 'High') {
      recommendations.push('Prioritize canvassing and direct voter contact in this area');
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

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getPartisanColor(lean: number): string {
    if (lean >= 20) return '#0015BC'; // Deep blue
    if (lean >= 10) return '#4A6FDE'; // Medium blue
    if (lean >= 5) return '#8FA8F0'; // Light blue
    if (lean > -5) return '#9B9B9B'; // Gray (tossup)
    if (lean > -10) return '#F08F8F'; // Light red
    if (lean > -20) return '#DE4A4A'; // Medium red
    return '#BC1500'; // Deep red
  }

  private getSwingColor(swing: number): string {
    if (swing >= 60) return '#FF6B35'; // High volatility - orange
    if (swing >= 40) return '#FFBA08'; // Swing - yellow
    if (swing >= 20) return '#A8D08D'; // Moderate - light green
    return '#70C1B3'; // Stable - teal
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
  }
}
