/**
 * ElectionHistoryFilter - Filter precincts by historical election results
 *
 * Enables segmentation by election outcomes (2020, 2022, 2024):
 * - Vote share filtering (Dem/Rep percentages)
 * - Margin filtering (point spread)
 * - Turnout filtering
 * - Turnout dropoff analysis (presidential vs midterm)
 * - Ticket-splitting detection
 * - Trend analysis (margin shifts over time)
 *
 * Data structure: Precinct elections embedded in precinct data
 * {
 *   precinctId: "el-pct-1",
 *   elections: {
 *     "2024": { demPct, repPct, margin, turnout, ballotsCast },
 *     "2022": { ... },
 *     "2020": { ... }
 *   }
 * }
 */

import type {
  ElectionHistoryFilters,
  PrecinctElectionResult,
} from './types';

/**
 * Election summary for a precinct across all years
 */
export interface ElectionSummary {
  precinctId: string;
  elections: Record<string, PrecinctElectionResult>;
  avgTurnout: number;
  avgDemPct: number;
  avgRepPct: number;
  avgMargin: number;
  trend2020to2024?: number; // Margin shift
  trend2022to2024?: number;
  trend2020to2022?: number;
  turnoutDropoff?: number; // 2024 vs 2022
}

/**
 * Election History Filter Engine
 *
 * Filters precincts based on historical election results (2020-2024)
 */
export class ElectionHistoryFilter {
  private precinctElections: Map<string, Record<string, PrecinctElectionResult>>;

  constructor(precinctElections: Map<string, Record<string, PrecinctElectionResult>>) {
    this.precinctElections = precinctElections;
  }

  /**
   * Filter by Dem/Rep vote share percentage
   */
  filterByVoteShare(
    precinctIds: string[],
    filters: ElectionHistoryFilters
  ): string[] {
    const { minDemVoteShare, maxDemVoteShare, minRepVoteShare, maxRepVoteShare } = filters;

    // Determine year from filters (default to 2024)
    const year = filters.races?.[0]?.year ?? 2024;

    return precinctIds.filter(id => {
      const elections = this.precinctElections.get(id);
      if (!elections) return false;

      const election = elections[year.toString()];
      if (!election) return false;

      // Check Dem vote share
      if (minDemVoteShare !== undefined && election.demPct < minDemVoteShare) {
        return false;
      }
      if (maxDemVoteShare !== undefined && election.demPct > maxDemVoteShare) {
        return false;
      }

      // Check Rep vote share
      if (minRepVoteShare !== undefined && election.repPct < minRepVoteShare) {
        return false;
      }
      if (maxRepVoteShare !== undefined && election.repPct > maxRepVoteShare) {
        return false;
      }

      return true;
    });
  }

  /**
   * Filter by margin range (point spread)
   * Positive margin = Dem advantage, negative = Rep advantage
   */
  filterByMargin(
    precinctIds: string[],
    marginRange: [number, number],
    year: number
  ): string[] {
    const [minMargin, maxMargin] = marginRange;

    return precinctIds.filter(id => {
      const elections = this.precinctElections.get(id);
      if (!elections) return false;

      const election = elections[year.toString()];
      if (!election) return false;

      return election.margin >= minMargin && election.margin <= maxMargin;
    });
  }

  /**
   * Filter by turnout percentage
   */
  filterByTurnout(
    precinctIds: string[],
    minTurnout?: number,
    maxTurnout?: number,
    year?: number
  ): string[] {
    const targetYear = year ?? 2024;

    return precinctIds.filter(id => {
      const elections = this.precinctElections.get(id);
      if (!elections) return false;

      const election = elections[targetYear.toString()];
      if (!election) return false;

      if (minTurnout !== undefined && election.turnout < minTurnout) {
        return false;
      }
      if (maxTurnout !== undefined && election.turnout > maxTurnout) {
        return false;
      }

      return true;
    });
  }

  /**
   * Filter by turnout dropoff (presidential to midterm)
   * Dropoff = presidential turnout - midterm turnout (in percentage points)
   */
  filterByTurnoutDropoff(
    precinctIds: string[],
    dropoffRange: { min?: number; max?: number }
  ): string[] {
    return precinctIds.filter(id => {
      const elections = this.precinctElections.get(id);
      if (!elections) return false;

      const presidential = elections['2024']; // 2024 presidential
      const midterm = elections['2022']; // 2022 midterm

      if (!presidential || !midterm) return false;

      const dropoff = presidential.turnout - midterm.turnout;

      if (dropoffRange.min !== undefined && dropoff < dropoffRange.min) {
        return false;
      }
      if (dropoffRange.max !== undefined && dropoff > dropoffRange.max) {
        return false;
      }

      return true;
    });
  }

  /**
   * Find ticket splitters (precincts where results diverge between years)
   * Ticket splitting = low correlation between years
   * Lower correlation = more independent voting behavior
   */
  findTicketSplitters(
    precinctIds: string[],
    topYear: number,
    bottomYear: number,
    maxCorrelation: number
  ): string[] {
    return precinctIds.filter(id => {
      const elections = this.precinctElections.get(id);
      if (!elections) return false;

      const topElection = elections[topYear.toString()];
      const bottomElection = elections[bottomYear.toString()];

      if (!topElection || !bottomElection) return false;

      // Calculate correlation based on margin difference
      // If margins are very different, correlation is low (ticket splitting)
      const marginDiff = Math.abs(topElection.margin - bottomElection.margin);

      // Normalize: 0 point difference = 1.0 correlation, 100 point difference = 0.0 correlation
      const correlation = Math.max(0, 1 - (marginDiff / 100));

      return correlation < maxCorrelation;
    });
  }

  /**
   * Filter by trend (margin shift between years)
   * Positive shift = moved toward Dems
   * Negative shift = moved toward Reps
   */
  filterByTrend(
    precinctIds: string[],
    startYear: number,
    endYear: number,
    minShift?: number,
    maxShift?: number
  ): string[] {
    return precinctIds.filter(id => {
      const shift = this.calculateMarginShift(id, startYear, endYear);
      if (shift === null) return false;

      if (minShift !== undefined && shift < minShift) {
        return false;
      }
      if (maxShift !== undefined && shift > maxShift) {
        return false;
      }

      return true;
    });
  }

  /**
   * Apply all election history filters
   */
  applyFilters(
    precinctIds: string[],
    filters: ElectionHistoryFilters
  ): string[] {
    let results = precinctIds;

    // Vote share filtering
    if (
      filters.minDemVoteShare !== undefined ||
      filters.maxDemVoteShare !== undefined ||
      filters.minRepVoteShare !== undefined ||
      filters.maxRepVoteShare !== undefined
    ) {
      results = this.filterByVoteShare(results, filters);
    }

    // Margin filtering
    if (filters.marginRange) {
      const year = filters.races?.[0]?.year ?? 2024;
      results = this.filterByMargin(results, filters.marginRange, year);
    }

    // Turnout filtering
    if (filters.minTurnout !== undefined || filters.maxTurnout !== undefined) {
      const year = filters.races?.[0]?.year ?? 2024;
      results = this.filterByTurnout(
        results,
        filters.minTurnout,
        filters.maxTurnout,
        year
      );
    }

    // Turnout dropoff filtering
    if (filters.turnoutDropoff) {
      results = this.filterByTurnoutDropoff(results, filters.turnoutDropoff);
    }

    // Ticket splitting detection
    if (filters.splitTicket) {
      const { topRace, bottomRace, maxCorrelation } = filters.splitTicket;
      if (maxCorrelation !== undefined) {
        results = this.findTicketSplitters(
          results,
          topRace.year,
          bottomRace.year,
          maxCorrelation
        );
      }
    }

    // Trend filtering
    if (filters.trend) {
      const { startYear, endYear, minMarginShift, maxMarginShift } = filters.trend;
      results = this.filterByTrend(
        results,
        startYear,
        endYear,
        minMarginShift,
        maxMarginShift
      );
    }

    return results;
  }

  /**
   * Get election summary for a precinct
   */
  getPrecinctElectionSummary(precinctId: string): ElectionSummary | null {
    const elections = this.precinctElections.get(precinctId);
    if (!elections) return null;

    const years = Object.keys(elections);
    if (years.length === 0) return null;

    // Calculate averages
    let totalTurnout = 0;
    let totalDemPct = 0;
    let totalRepPct = 0;
    let totalMargin = 0;
    let count = 0;

    for (const year of years) {
      const election = elections[year];
      totalTurnout += election.turnout;
      totalDemPct += election.demPct;
      totalRepPct += election.repPct;
      totalMargin += election.margin;
      count++;
    }

    const summary: ElectionSummary = {
      precinctId,
      elections,
      avgTurnout: totalTurnout / count,
      avgDemPct: totalDemPct / count,
      avgRepPct: totalRepPct / count,
      avgMargin: totalMargin / count,
    };

    // Calculate trends
    const shift2020to2024 = this.calculateMarginShift(precinctId, 2020, 2024);
    const shift2022to2024 = this.calculateMarginShift(precinctId, 2022, 2024);
    const shift2020to2022 = this.calculateMarginShift(precinctId, 2020, 2022);

    if (shift2020to2024 !== null) summary.trend2020to2024 = shift2020to2024;
    if (shift2022to2024 !== null) summary.trend2022to2024 = shift2022to2024;
    if (shift2020to2022 !== null) summary.trend2020to2022 = shift2020to2022;

    // Calculate turnout dropoff
    if (elections['2024'] && elections['2022']) {
      summary.turnoutDropoff = elections['2024'].turnout - elections['2022'].turnout;
    }

    return summary;
  }

  /**
   * Calculate margin shift between two years
   * Positive = shifted toward Dems
   * Negative = shifted toward Reps
   */
  calculateMarginShift(
    precinctId: string,
    startYear: number,
    endYear: number
  ): number | null {
    const elections = this.precinctElections.get(precinctId);
    if (!elections) return null;

    const startElection = elections[startYear.toString()];
    const endElection = elections[endYear.toString()];

    if (!startElection || !endElection) return null;

    return endElection.margin - startElection.margin;
  }

  /**
   * Get all precincts with election data for a specific year
   */
  getPrecinctsWithElectionData(year: number): string[] {
    const precincts: string[] = [];

    for (const [precinctId, elections] of this.precinctElections.entries()) {
      if (elections[year.toString()]) {
        precincts.push(precinctId);
      }
    }

    return precincts;
  }

  /**
   * Get election result for a specific precinct and year
   */
  getElectionResult(
    precinctId: string,
    year: number
  ): PrecinctElectionResult | null {
    const elections = this.precinctElections.get(precinctId);
    if (!elections) return null;

    return elections[year.toString()] ?? null;
  }

  /**
   * Check if precinct has complete election history (2020, 2022, 2024)
   */
  hasCompleteHistory(precinctId: string): boolean {
    const elections = this.precinctElections.get(precinctId);
    if (!elections) return false;

    return !!(elections['2020'] && elections['2022'] && elections['2024']);
  }

  /**
   * Get statistical summary across all precincts
   */
  getStatisticalSummary(year: number): {
    count: number;
    avgDemPct: number;
    avgRepPct: number;
    avgMargin: number;
    avgTurnout: number;
    minTurnout: number;
    maxTurnout: number;
    minMargin: number;
    maxMargin: number;
  } | null {
    const precincts = this.getPrecinctsWithElectionData(year);
    if (precincts.length === 0) return null;

    let totalDemPct = 0;
    let totalRepPct = 0;
    let totalMargin = 0;
    let totalTurnout = 0;
    let minTurnout = Infinity;
    let maxTurnout = -Infinity;
    let minMargin = Infinity;
    let maxMargin = -Infinity;

    for (const precinctId of precincts) {
      const election = this.getElectionResult(precinctId, year);
      if (!election) continue;

      totalDemPct += election.demPct;
      totalRepPct += election.repPct;
      totalMargin += election.margin;
      totalTurnout += election.turnout;

      minTurnout = Math.min(minTurnout, election.turnout);
      maxTurnout = Math.max(maxTurnout, election.turnout);
      minMargin = Math.min(minMargin, election.margin);
      maxMargin = Math.max(maxMargin, election.margin);
    }

    const count = precincts.length;

    return {
      count,
      avgDemPct: totalDemPct / count,
      avgRepPct: totalRepPct / count,
      avgMargin: totalMargin / count,
      avgTurnout: totalTurnout / count,
      minTurnout,
      maxTurnout,
      minMargin,
      maxMargin,
    };
  }
}
