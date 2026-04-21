/**
 * Election Trend Analysis Service
 *
 * Analyzes historical election data to identify trends in partisan lean,
 * turnout, and swing behavior over time (2020 → 2022 → 2024).
 */

import { politicalDataService } from '@/lib/services/PoliticalDataService';

export interface ElectionTrendPoint {
  year: number;
  date: string;
  electionType: 'presidential' | 'midterm';
  demPct: number;
  repPct: number;
  margin: number;
  turnout: number;
  registeredVoters: number;
  ballotsCast: number;
}

export interface PrecinctTrend {
  precinctName: string;
  jurisdictionName: string;
  elections: ElectionTrendPoint[];
  trendMetrics: {
    partisanTrend: 'shifting_dem' | 'shifting_rep' | 'stable' | 'volatile';
    turnoutTrend: 'increasing' | 'decreasing' | 'stable';
    marginChange2020to2024: number;
    turnoutChange2020to2024: number;
    avgMarginVolatility: number;
    isSwingPrecinct: boolean;
  };
}

export interface JurisdictionTrend {
  jurisdictionName: string;
  precinctCount: number;
  elections: ElectionTrendPoint[];
  trendMetrics: {
    partisanTrend: 'shifting_dem' | 'shifting_rep' | 'stable' | 'volatile';
    turnoutTrend: 'increasing' | 'decreasing' | 'stable';
    marginChange2020to2024: number;
    turnoutChange2020to2024: number;
    avgMarginVolatility: number;
    swingPrecinctCount: number;
    swingPrecinctPct: number;
  };
  precinctTrends: PrecinctTrend[];
}

export interface CountyTrendSummary {
  countyName: string;
  elections: ElectionTrendPoint[];
  overallTrendMetrics: {
    partisanTrend: 'shifting_dem' | 'shifting_rep' | 'stable' | 'volatile';
    turnoutTrend: 'increasing' | 'decreasing' | 'stable';
    marginChange2020to2024: number;
    turnoutChange2020to2024: number;
  };
  jurisdictionSummary: Array<{
    name: string;
    partisanTrend: string;
    marginChange: number;
    swingPrecincts: number;
  }>;
  topSwingPrecincts: Array<{
    precinctName: string;
    jurisdiction: string;
    marginVolatility: number;
    marginChange: number;
  }>;
}

/**
 * Election Trend Analysis Class
 */
export class ElectionTrendAnalysis {
  private initialized = false;
  private precinctTrends: Map<string, PrecinctTrend> = new Map();
  private jurisdictionTrends: Map<string, JurisdictionTrend> = new Map();

  /**
   * Initialize by loading and processing election data
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[ElectionTrendAnalysis] Initializing...');

    // Ensure political data service is initialized
    await politicalDataService.initialize();

    // Process election trends
    await this.processElectionTrends();

    this.initialized = true;
    console.log(`[ElectionTrendAnalysis] Initialized with ${this.precinctTrends.size} precinct trends`);
  }

  /**
   * Process election data into trend format
   */
  private async processElectionTrends(): Promise<void> {
    // Get election results from data service using public method
    const electionData = await politicalDataService.getAllElectionResults();
    if (!electionData || !electionData.precincts) {
      console.warn('[ElectionTrendAnalysis] No election data available');
      return;
    }

    // Get targeting scores for jurisdiction mapping using public method
    const targetingScores = await politicalDataService.getAllTargetingScores();

    // Process each precinct
    for (const [precinctName, data] of Object.entries(electionData.precincts)) {
      const precinctData = data as any;
      const elections = precinctData.elections;

      if (!elections) continue;

      const trendPoints: ElectionTrendPoint[] = [];

      // Extract data from each election
      for (const [dateStr, electionInfo] of Object.entries(elections)) {
        const election = electionInfo as any;
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const electionType = this.getElectionType(year);

        // Get top race (president in presidential years, governor in midterms)
        const topRace = this.getTopRace(election, electionType);
        if (!topRace) continue;

        // Calculate turnout from election-level data if not in race
        const registeredVoters = election.registered_voters || 0;
        const ballotsCast = election.ballots_cast || 0;
        const turnout = topRace.turnout
          ? parseFloat(topRace.turnout)
          : (registeredVoters > 0 ? (ballotsCast / registeredVoters) * 100 : 0);

        trendPoints.push({
          year,
          date: dateStr,
          electionType,
          demPct: parseFloat(topRace.dem_pct) || 0,
          repPct: parseFloat(topRace.rep_pct) || 0,
          margin: parseFloat(topRace.margin) || 0,
          turnout,
          registeredVoters,
          ballotsCast,
        });
      }

      // Sort by year
      trendPoints.sort((a, b) => a.year - b.year);

      if (trendPoints.length < 2) continue;

      // Calculate trend metrics
      const trendMetrics = this.calculateTrendMetrics(trendPoints);

      // Get jurisdiction from targeting scores
      const targetingData = targetingScores?.[precinctName] as any;
      const jurisdictionName = targetingData?.jurisdiction || this.extractJurisdiction(precinctName);

      const precinctTrend: PrecinctTrend = {
        precinctName,
        jurisdictionName,
        elections: trendPoints,
        trendMetrics,
      };

      this.precinctTrends.set(precinctName, precinctTrend);
    }

    // Aggregate to jurisdictions
    this.aggregateJurisdictionTrends();
  }

  /**
   * Get election type based on year
   */
  private getElectionType(year: number): 'presidential' | 'midterm' {
    return year % 4 === 0 ? 'presidential' : 'midterm';
  }

  /**
   * Get the top race from an election (president or governor)
   */
  private getTopRace(election: any, electionType: 'presidential' | 'midterm'): any {
    if (electionType === 'presidential') {
      return election.president || election.us_senate;
    }
    return election.governor || election.us_senate || election.attorney_general;
  }

  /**
   * Extract jurisdiction from precinct name
   */
  private extractJurisdiction(precinctName: string): string {
    // Pattern: "City of X, Ward Y, Precinct Z" or "X Township, Precinct Y"
    // First try to match "City of X" pattern
    const cityMatch = precinctName.match(/^City of ([^,]+)/i);
    if (cityMatch) {
      return cityMatch[1].trim();
    }

    // Pattern: "X Township" or "X Charter Township"
    const townshipMatch = precinctName.match(/^([^,]+?)\s*(Charter\s+)?Township/i);
    if (townshipMatch) {
      return townshipMatch[1].trim();
    }

    // Fallback: extract everything before ", Precinct"
    const match = precinctName.match(/^(.+?),\s*Precinct/i);
    if (match) {
      return match[1].replace(/\s*(Township|City|Twp|Charter)\s*/gi, '').trim();
    }
    return 'Unknown';
  }

  /**
   * Calculate trend metrics from election points
   */
  private calculateTrendMetrics(points: ElectionTrendPoint[]): PrecinctTrend['trendMetrics'] {
    const first = points[0];
    const last = points[points.length - 1];

    // Margin change
    const marginChange = last.margin - first.margin;

    // Turnout change
    const turnoutChange = last.turnout - first.turnout;

    // Calculate volatility (standard deviation of margin changes)
    const marginChanges: number[] = [];
    for (let i = 1; i < points.length; i++) {
      marginChanges.push(Math.abs(points[i].margin - points[i - 1].margin));
    }
    const avgVolatility = marginChanges.length > 0
      ? marginChanges.reduce((a, b) => a + b, 0) / marginChanges.length
      : 0;

    // Determine partisan trend
    let partisanTrend: PrecinctTrend['trendMetrics']['partisanTrend'];
    if (avgVolatility > 10) {
      partisanTrend = 'volatile';
    } else if (marginChange > 5) {
      partisanTrend = 'shifting_dem';
    } else if (marginChange < -5) {
      partisanTrend = 'shifting_rep';
    } else {
      partisanTrend = 'stable';
    }

    // Determine turnout trend
    let turnoutTrend: PrecinctTrend['trendMetrics']['turnoutTrend'];
    if (turnoutChange > 5) {
      turnoutTrend = 'increasing';
    } else if (turnoutChange < -5) {
      turnoutTrend = 'decreasing';
    } else {
      turnoutTrend = 'stable';
    }

    // Is swing precinct? (volatile or close margins)
    const isSwingPrecinct = avgVolatility > 8 || points.some(p => Math.abs(p.margin) < 10);

    return {
      partisanTrend,
      turnoutTrend,
      marginChange2020to2024: marginChange,
      turnoutChange2020to2024: turnoutChange,
      avgMarginVolatility: avgVolatility,
      isSwingPrecinct,
    };
  }

  /**
   * Aggregate precinct trends to jurisdiction level
   */
  private aggregateJurisdictionTrends(): void {
    const jurisdictionGroups = new Map<string, PrecinctTrend[]>();

    // Group by jurisdiction
    for (const [, precinctTrend] of this.precinctTrends) {
      const jurisdiction = precinctTrend.jurisdictionName;
      if (!jurisdictionGroups.has(jurisdiction)) {
        jurisdictionGroups.set(jurisdiction, []);
      }
      jurisdictionGroups.get(jurisdiction)!.push(precinctTrend);
    }

    // Aggregate each jurisdiction
    for (const [jurisdictionName, precinctTrends] of jurisdictionGroups) {
      if (precinctTrends.length === 0) continue;

      // Calculate weighted averages for each election year
      const yearData = new Map<number, { dem: number[], rep: number[], margin: number[], turnout: number[], registered: number[], ballots: number[] }>();

      for (const precinct of precinctTrends) {
        for (const election of precinct.elections) {
          if (!yearData.has(election.year)) {
            yearData.set(election.year, { dem: [], rep: [], margin: [], turnout: [], registered: [], ballots: [] });
          }
          const data = yearData.get(election.year)!;
          data.dem.push(election.demPct);
          data.rep.push(election.repPct);
          data.margin.push(election.margin);
          data.turnout.push(election.turnout);
          data.registered.push(election.registeredVoters);
          data.ballots.push(election.ballotsCast);
        }
      }

      // Create aggregated election points
      const aggregatedPoints: ElectionTrendPoint[] = [];
      for (const [year, data] of Array.from(yearData.entries()).sort((a, b) => a[0] - b[0])) {
        const avgDem = data.dem.reduce((a, b) => a + b, 0) / data.dem.length;
        const avgRep = data.rep.reduce((a, b) => a + b, 0) / data.rep.length;
        const avgMargin = data.margin.reduce((a, b) => a + b, 0) / data.margin.length;
        const avgTurnout = data.turnout.reduce((a, b) => a + b, 0) / data.turnout.length;
        const totalRegistered = data.registered.reduce((a, b) => a + b, 0);
        const totalBallots = data.ballots.reduce((a, b) => a + b, 0);

        aggregatedPoints.push({
          year,
          date: `${year}-11-01`, // Approximate date
          electionType: year % 4 === 0 ? 'presidential' : 'midterm',
          demPct: avgDem,
          repPct: avgRep,
          margin: avgMargin,
          turnout: avgTurnout,
          registeredVoters: totalRegistered,
          ballotsCast: totalBallots,
        });
      }

      // Calculate jurisdiction-level metrics
      const swingCount = precinctTrends.filter(p => p.trendMetrics.isSwingPrecinct).length;
      const avgMarginChange = precinctTrends.reduce((a, b) => a + b.trendMetrics.marginChange2020to2024, 0) / precinctTrends.length;
      const avgTurnoutChange = precinctTrends.reduce((a, b) => a + b.trendMetrics.turnoutChange2020to2024, 0) / precinctTrends.length;
      const avgVolatility = precinctTrends.reduce((a, b) => a + b.trendMetrics.avgMarginVolatility, 0) / precinctTrends.length;

      const jurisdictionTrend: JurisdictionTrend = {
        jurisdictionName,
        precinctCount: precinctTrends.length,
        elections: aggregatedPoints,
        trendMetrics: {
          partisanTrend: this.determineAggregateTrend(avgMarginChange, avgVolatility),
          turnoutTrend: avgTurnoutChange > 5 ? 'increasing' : avgTurnoutChange < -5 ? 'decreasing' : 'stable',
          marginChange2020to2024: avgMarginChange,
          turnoutChange2020to2024: avgTurnoutChange,
          avgMarginVolatility: avgVolatility,
          swingPrecinctCount: swingCount,
          swingPrecinctPct: (swingCount / precinctTrends.length) * 100,
        },
        precinctTrends,
      };

      this.jurisdictionTrends.set(jurisdictionName, jurisdictionTrend);
    }
  }

  /**
   * Determine aggregate partisan trend
   */
  private determineAggregateTrend(marginChange: number, volatility: number): JurisdictionTrend['trendMetrics']['partisanTrend'] {
    if (volatility > 10) return 'volatile';
    if (marginChange > 5) return 'shifting_dem';
    if (marginChange < -5) return 'shifting_rep';
    return 'stable';
  }

  // Public API methods

  /**
   * Get trend data for a specific precinct
   */
  async getPrecinctTrend(precinctName: string): Promise<PrecinctTrend | null> {
    await this.initialize();
    return this.precinctTrends.get(precinctName) || null;
  }

  /**
   * Get trend data for a jurisdiction (aggregated from precincts)
   */
  async getJurisdictionTrend(jurisdictionName: string): Promise<JurisdictionTrend | null> {
    await this.initialize();

    // Try exact match first
    if (this.jurisdictionTrends.has(jurisdictionName)) {
      return this.jurisdictionTrends.get(jurisdictionName)!;
    }

    // Try partial match
    for (const [key, value] of this.jurisdictionTrends) {
      if (key.toLowerCase().includes(jurisdictionName.toLowerCase()) ||
          jurisdictionName.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return null;
  }

  /**
   * Get county-wide trend summary
   */
  async getCountySummary(): Promise<CountyTrendSummary> {
    await this.initialize();

    // Aggregate all jurisdictions
    const allElections = new Map<number, ElectionTrendPoint[]>();

    for (const [, jurisdictionTrend] of this.jurisdictionTrends) {
      for (const election of jurisdictionTrend.elections) {
        if (!allElections.has(election.year)) {
          allElections.set(election.year, []);
        }
        allElections.get(election.year)!.push(election);
      }
    }

    // Calculate county-wide averages
    const countyElections: ElectionTrendPoint[] = [];
    for (const [year, elections] of Array.from(allElections.entries()).sort((a, b) => a[0] - b[0])) {
      const avgDem = elections.reduce((a, b) => a + b.demPct, 0) / elections.length;
      const avgRep = elections.reduce((a, b) => a + b.repPct, 0) / elections.length;
      const avgMargin = elections.reduce((a, b) => a + b.margin, 0) / elections.length;
      const avgTurnout = elections.reduce((a, b) => a + b.turnout, 0) / elections.length;
      const totalRegistered = elections.reduce((a, b) => a + b.registeredVoters, 0);
      const totalBallots = elections.reduce((a, b) => a + b.ballotsCast, 0);

      countyElections.push({
        year,
        date: `${year}-11-01`,
        electionType: year % 4 === 0 ? 'presidential' : 'midterm',
        demPct: avgDem,
        repPct: avgRep,
        margin: avgMargin,
        turnout: avgTurnout,
        registeredVoters: totalRegistered,
        ballotsCast: totalBallots,
      });
    }

    // Calculate overall trend metrics
    const first = countyElections[0];
    const last = countyElections[countyElections.length - 1];
    const marginChange = last ? last.margin - first.margin : 0;
    const turnoutChange = last ? last.turnout - first.turnout : 0;

    // Get jurisdiction summaries
    const jurisdictionSummary = Array.from(this.jurisdictionTrends.values())
      .map(j => ({
        name: j.jurisdictionName,
        partisanTrend: j.trendMetrics.partisanTrend,
        marginChange: j.trendMetrics.marginChange2020to2024,
        swingPrecincts: j.trendMetrics.swingPrecinctCount,
      }))
      .sort((a, b) => Math.abs(b.marginChange) - Math.abs(a.marginChange));

    // Get top swing precincts
    const topSwingPrecincts = Array.from(this.precinctTrends.values())
      .filter(p => p.trendMetrics.isSwingPrecinct)
      .sort((a, b) => b.trendMetrics.avgMarginVolatility - a.trendMetrics.avgMarginVolatility)
      .slice(0, 10)
      .map(p => ({
        precinctName: p.precinctName,
        jurisdiction: p.jurisdictionName,
        marginVolatility: p.trendMetrics.avgMarginVolatility,
        marginChange: p.trendMetrics.marginChange2020to2024,
      }));

    return {
      countyName: 'Ingham County',
      elections: countyElections,
      overallTrendMetrics: {
        partisanTrend: marginChange > 5 ? 'shifting_dem' : marginChange < -5 ? 'shifting_rep' : 'stable',
        turnoutTrend: turnoutChange > 5 ? 'increasing' : turnoutChange < -5 ? 'decreasing' : 'stable',
        marginChange2020to2024: marginChange,
        turnoutChange2020to2024: turnoutChange,
      },
      jurisdictionSummary,
      topSwingPrecincts,
    };
  }

  /**
   * Get all jurisdictions with their trend direction
   */
  async getAllJurisdictionTrends(): Promise<JurisdictionTrend[]> {
    await this.initialize();
    return Array.from(this.jurisdictionTrends.values());
  }

  /**
   * Get precincts by trend category
   */
  async getPrecinctsByTrend(trendType: 'shifting_dem' | 'shifting_rep' | 'stable' | 'volatile'): Promise<PrecinctTrend[]> {
    await this.initialize();
    return Array.from(this.precinctTrends.values())
      .filter(p => p.trendMetrics.partisanTrend === trendType);
  }

  /**
   * Compare trends between two jurisdictions
   */
  async compareJurisdictionTrends(jurisdiction1: string, jurisdiction2: string): Promise<{
    jurisdiction1: JurisdictionTrend | null;
    jurisdiction2: JurisdictionTrend | null;
    comparison: {
      marginDifference2020: number;
      marginDifference2024: number;
      trendDifference: number;
      moreVolatile: string;
    } | null;
  }> {
    const j1 = await this.getJurisdictionTrend(jurisdiction1);
    const j2 = await this.getJurisdictionTrend(jurisdiction2);

    if (!j1 || !j2) {
      return { jurisdiction1: j1, jurisdiction2: j2, comparison: null };
    }

    const j1First = j1.elections[0];
    const j1Last = j1.elections[j1.elections.length - 1];
    const j2First = j2.elections[0];
    const j2Last = j2.elections[j2.elections.length - 1];

    return {
      jurisdiction1: j1,
      jurisdiction2: j2,
      comparison: {
        marginDifference2020: (j1First?.margin || 0) - (j2First?.margin || 0),
        marginDifference2024: (j1Last?.margin || 0) - (j2Last?.margin || 0),
        trendDifference: j1.trendMetrics.marginChange2020to2024 - j2.trendMetrics.marginChange2020to2024,
        moreVolatile: j1.trendMetrics.avgMarginVolatility > j2.trendMetrics.avgMarginVolatility
          ? j1.jurisdictionName
          : j2.jurisdictionName,
      },
    };
  }
}

// Export singleton instance
export const electionTrendAnalysis = new ElectionTrendAnalysis();
