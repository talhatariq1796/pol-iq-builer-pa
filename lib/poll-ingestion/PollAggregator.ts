/**
 * Poll Aggregator
 *
 * Calculates weighted polling averages using FiveThirtyEight-style methodology.
 *
 * Weighting factors:
 * - Recency: Exponential decay (half-life = 14 days)
 * - Sample size: Square root scaling
 * - Pollster rating: A+ = 1.0, F = 0.3
 * - Population type: LV > RV > A
 * - Methodology: Live phone > Online > IVR
 */

import {
  Poll,
  PollAggregate,
  CandidateAverage,
  TrendDirection,
  PollsterRating,
  Party,
} from './types';

export class PollAggregator {
  // Configuration
  private readonly RECENCY_HALFLIFE_DAYS = 14;
  private readonly SAMPLE_SIZE_BASELINE = 600;
  private readonly MIN_POLLS_FOR_TREND = 3;

  /**
   * Aggregate polls for a specific race
   */
  aggregate(polls: Poll[], raceId: string): PollAggregate | null {
    // Filter to this race
    const racePolls = polls.filter((p) => p.race_id === raceId);

    if (racePolls.length === 0) {
      return null;
    }

    // Sort by date descending
    racePolls.sort(
      (a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
    );

    // Calculate weights
    const now = new Date();
    const weights = racePolls.map((poll) => this.calculateWeight(poll, now));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    if (totalWeight === 0) {
      return null;
    }

    // Build candidate results map
    const candidateData = new Map<
      string,
      {
        party: Party;
        weightedSum: number;
        totalWeight: number;
        high: number;
        low: number;
        count: number;
      }
    >();

    racePolls.forEach((poll, idx) => {
      for (const result of poll.results) {
        const existing = candidateData.get(result.candidate_name) || {
          party: result.party,
          weightedSum: 0,
          totalWeight: 0,
          high: -Infinity,
          low: Infinity,
          count: 0,
        };

        existing.weightedSum += result.percentage * weights[idx];
        existing.totalWeight += weights[idx];
        existing.high = Math.max(existing.high, result.percentage);
        existing.low = Math.min(existing.low, result.percentage);
        existing.count++;

        candidateData.set(result.candidate_name, existing);
      }
    });

    // Convert to candidate averages
    const candidates: CandidateAverage[] = [];
    for (const [name, data] of candidateData) {
      if (data.count < 1) continue;

      candidates.push({
        name,
        party: data.party,
        average: Math.round((data.weightedSum / data.totalWeight) * 10) / 10,
        high: data.high,
        low: data.low,
        poll_count: data.count,
      });
    }

    // Sort by average descending
    candidates.sort((a, b) => b.average - a.average);

    if (candidates.length < 2) {
      return null;
    }

    // Calculate margin (leader - runner-up)
    const leader = candidates[0];
    const runnerUp = candidates[1];
    const margin = leader.average - runnerUp.average;

    // Calculate trend
    const { margin7d, margin30d, trendDirection, trendMagnitude } =
      this.calculateTrend(racePolls, leader.name, runnerUp.name);

    // Count recent polls
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const pollsLast30d = racePolls.filter(
      (p) => new Date(p.end_date) >= thirtyDaysAgo
    ).length;

    // Calculate average sample size
    const avgSampleSize =
      racePolls.reduce((sum, p) => sum + p.sample_size, 0) / racePolls.length;

    // Calculate weighted N (effective sample size)
    const weightedN = totalWeight * this.SAMPLE_SIZE_BASELINE;

    return {
      race_id: raceId,
      race_name: this.formatRaceName(raceId),
      geography: racePolls[0].geography,
      last_updated: new Date().toISOString(),

      candidates,
      leader: leader.name,
      margin: Math.round(margin * 10) / 10,

      margin_7d_ago: margin7d,
      margin_30d_ago: margin30d,
      trend_direction: trendDirection,
      trend_magnitude: trendMagnitude,

      poll_count: racePolls.length,
      polls_last_30d: pollsLast30d,
      avg_sample_size: Math.round(avgSampleSize),
      weighted_n: Math.round(weightedN),
    };
  }

  /**
   * Aggregate all races in the poll set
   */
  aggregateAll(polls: Poll[]): Map<string, PollAggregate> {
    const raceIds = [...new Set(polls.map((p) => p.race_id))];
    const aggregates = new Map<string, PollAggregate>();

    for (const raceId of raceIds) {
      const aggregate = this.aggregate(polls, raceId);
      if (aggregate) {
        aggregates.set(raceId, aggregate);
      }
    }

    return aggregates;
  }

  /**
   * Calculate poll weight based on multiple factors
   */
  calculateWeight(poll: Poll, now: Date = new Date()): number {
    // 1. Recency weight (exponential decay)
    const pollDate = new Date(poll.end_date);
    const daysOld = (now.getTime() - pollDate.getTime()) / (24 * 60 * 60 * 1000);
    const recencyWeight = Math.pow(0.5, daysOld / this.RECENCY_HALFLIFE_DAYS);

    // 2. Sample size weight (square root scaling)
    const sampleWeight = Math.sqrt(
      Math.max(poll.sample_size, 100) / this.SAMPLE_SIZE_BASELINE
    );

    // 3. Pollster rating weight
    const ratingWeight = this.getRatingWeight(poll.pollster_rating);

    // 4. Population type weight (LV > RV > A)
    const populationWeight =
      poll.population === 'lv' ? 1.0 : poll.population === 'rv' ? 0.75 : 0.5;

    // 5. Methodology weight
    const methodWeight =
      poll.methodology === 'live_phone'
        ? 1.0
        : poll.methodology === 'online'
          ? 0.9
          : poll.methodology === 'ivr'
            ? 0.8
            : 0.7;

    return (
      recencyWeight * sampleWeight * ratingWeight * populationWeight * methodWeight
    );
  }

  /**
   * Get weight factor for pollster rating
   */
  private getRatingWeight(rating?: PollsterRating): number {
    const weights: Record<PollsterRating, number> = {
      'A+': 1.0,
      A: 0.95,
      'A-': 0.9,
      'B+': 0.85,
      B: 0.8,
      'B-': 0.75,
      'C+': 0.7,
      C: 0.65,
      'C-': 0.6,
      'D+': 0.55,
      D: 0.5,
      'D-': 0.45,
      F: 0.3,
    };
    return weights[rating as PollsterRating] ?? 0.7; // Default for unrated
  }

  /**
   * Calculate polling trend
   */
  private calculateTrend(
    polls: Poll[],
    leaderName: string,
    runnerUpName: string
  ): {
    margin7d?: number;
    margin30d?: number;
    trendDirection?: TrendDirection;
    trendMagnitude?: number;
  } {
    if (polls.length < this.MIN_POLLS_FOR_TREND) {
      return {};
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Find polls from each time window
    const polls7to14 = polls.filter((p) => {
      const date = new Date(p.end_date);
      return date >= sevenDaysAgo && date < now;
    });

    const polls14to30 = polls.filter((p) => {
      const date = new Date(p.end_date);
      return date >= thirtyDaysAgo && date < sevenDaysAgo;
    });

    const margin7d = this.calculateMarginForPeriod(
      polls7to14,
      leaderName,
      runnerUpName
    );
    const margin30d = this.calculateMarginForPeriod(
      polls14to30,
      leaderName,
      runnerUpName
    );

    // Calculate current margin
    const recentPolls = polls.slice(0, Math.min(5, polls.length));
    const currentMargin = this.calculateMarginForPeriod(
      recentPolls,
      leaderName,
      runnerUpName
    );

    // Determine trend
    let trendDirection: TrendDirection = 'stable';
    let trendMagnitude: number | undefined;

    if (margin30d !== undefined && currentMargin !== undefined) {
      const change = currentMargin - margin30d;

      if (Math.abs(change) >= 1) {
        // Find which party is gaining
        const leaderParty = polls[0].results.find(
          (r) => r.candidate_name === leaderName
        )?.party;

        if (leaderParty === 'DEM') {
          trendDirection = change > 0 ? 'dem_gaining' : 'rep_gaining';
        } else {
          trendDirection = change > 0 ? 'rep_gaining' : 'dem_gaining';
        }

        trendMagnitude = Math.abs(change);
      }
    }

    return {
      margin7d,
      margin30d,
      trendDirection,
      trendMagnitude,
    };
  }

  /**
   * Calculate margin for a set of polls
   */
  private calculateMarginForPeriod(
    polls: Poll[],
    leaderName: string,
    runnerUpName: string
  ): number | undefined {
    if (polls.length === 0) return undefined;

    let leaderSum = 0;
    let runnerUpSum = 0;
    let count = 0;

    for (const poll of polls) {
      const leader = poll.results.find((r) => r.candidate_name === leaderName);
      const runnerUp = poll.results.find(
        (r) => r.candidate_name === runnerUpName
      );

      if (leader && runnerUp) {
        leaderSum += leader.percentage;
        runnerUpSum += runnerUp.percentage;
        count++;
      }
    }

    if (count === 0) return undefined;

    return (leaderSum - runnerUpSum) / count;
  }

  /**
   * Format race ID into human-readable name
   */
  private formatRaceName(raceId: string): string {
    // Parse race ID: "MI-GOV-2026" -> "Michigan Governor 2026"
    const parts = raceId.split('-');
    if (parts.length < 3) return raceId;

    const [state, raceType, year] = parts;

    const stateNames: Record<string, string> = {
      MI: 'Michigan',
      US: 'National',
    };

    const raceNames: Record<string, string> = {
      PRES: 'Presidential',
      SEN: 'Senate',
      GOV: 'Governor',
      HOUSE: 'House',
      STSEN: 'State Senate',
      STHOUSE: 'State House',
      APPROVAL: 'Approval',
    };

    const stateName = stateNames[state] || state;
    const raceName = raceNames[raceType] || raceType;

    return `${stateName} ${raceName} ${year}`;
  }
}

// Singleton instance
let aggregatorInstance: PollAggregator | null = null;

export function getPollAggregator(): PollAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new PollAggregator();
  }
  return aggregatorInstance;
}
