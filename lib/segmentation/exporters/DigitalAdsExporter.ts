/**
 * DigitalAdsExporter - Digital advertising platform export format
 *
 * Exports segment results aggregated by ZIP code for digital advertising
 * platforms (Facebook, Google, etc.) with Tapestry segments and demographics.
 */

import type { SegmentResults, PrecinctMatch, DigitalAdsExportRow } from '../types';

export interface DigitalAdsExportOptions {
  aggregationLevel?: 'zip' | 'zip4' | 'municipality';
}

interface ZIPAggregate {
  zip: string;
  municipality: string;
  totalVoters: number;
  avgGOTVPriority: number;
  avgPersuasionScore: number;
  topStrategy: string;
  topTapestrySegment: string;
  tapestryConcentration: number;
  avgMedianIncome: number;
  avgMedianAge: number;
  avgCollegeDegree: number;
  precincts: string[];
}

export class DigitalAdsExporter {
  private segmentResults: SegmentResults;

  constructor(segmentResults: SegmentResults) {
    this.segmentResults = segmentResults;
  }

  /**
   * Export segment results to digital advertising format (ZIP-level aggregates)
   */
  export(options: DigitalAdsExportOptions = {}): string {
    const {
      aggregationLevel = 'zip',
    } = options;

    // Aggregate by ZIP code
    const zipAggregates = this.aggregateByZIP();

    const headers = this.buildHeaders();
    const rows = zipAggregates.map(aggregate => this.buildRow(aggregate));

    return [headers, ...rows].join('\n');
  }

  /**
   * Aggregate results by ZIP code
   */
  private aggregateByZIP(): ZIPAggregate[] {
    // Group precincts by ZIP code (extract from precinct ID or use jurisdiction as proxy)
    const zipMap = new Map<string, PrecinctMatch[]>();

    for (const result of this.segmentResults.matchingPrecincts) {
      // Use jurisdiction as grouping key (in real implementation, would use actual ZIP)
      const groupKey = result.jurisdiction || 'Unknown';

      if (!zipMap.has(groupKey)) {
        zipMap.set(groupKey, []);
      }
      zipMap.get(groupKey)!.push(result);
    }

    // Aggregate each ZIP group
    const aggregates: ZIPAggregate[] = [];

    for (const [zip, results] of zipMap.entries()) {
      aggregates.push(this.aggregateResults(zip, results));
    }

    // Sort by total voters (descending)
    return aggregates.sort((a, b) => b.totalVoters - a.totalVoters);
  }

  /**
   * Aggregate multiple precinct results into a single ZIP aggregate
   */
  private aggregateResults(zip: string, results: PrecinctMatch[]): ZIPAggregate {
    const totalVoters = results.reduce((sum, r) => sum + r.registeredVoters, 0);

    // Weighted averages
    const avgGOTVPriority = this.weightedAverage(
      results,
      r => r.gotvPriority,
      r => r.registeredVoters
    );

    const avgPersuasionScore = this.weightedAverage(
      results,
      r => r.persuasionOpportunity,
      r => r.registeredVoters
    );

    // Most common strategy
    const topStrategy = this.mostCommon(results.map(r => r.targetingStrategy));

    // Placeholder values for data that would come from PoliticalDataService
    const topTapestrySegment = 'N/A';
    const tapestryConcentration = 0;
    const avgMedianIncome = 0;
    const avgMedianAge = 0;
    const avgCollegeDegree = 0;

    return {
      zip,
      municipality: results[0].jurisdiction || zip,
      totalVoters,
      avgGOTVPriority,
      avgPersuasionScore,
      topStrategy,
      topTapestrySegment,
      tapestryConcentration,
      avgMedianIncome,
      avgMedianAge,
      avgCollegeDegree,
      precincts: results.map(r => r.precinctName),
    };
  }

  /**
   * Build digital ads CSV headers
   */
  private buildHeaders(): string {
    const headers: string[] = [
      'ZIP Code',
      'Target Voters',
      'Avg Age',
      'Median Income',
      'Tapestry Segments',
      'Targeting Strategy',
      'Precinct Count',
    ];

    return this.escapeCSVRow(headers);
  }

  /**
   * Build digital ads row for a ZIP aggregate
   */
  private buildRow(aggregate: ZIPAggregate): string {
    const row: DigitalAdsExportRow = {
      ZipCode: aggregate.zip,
      TargetVoters: aggregate.totalVoters,
      AvgAge: aggregate.avgMedianAge,
      MedianIncome: aggregate.avgMedianIncome,
      TapestrySegments: aggregate.topTapestrySegment,
      TargetingStrategy: aggregate.topStrategy,
      PrecinctCount: aggregate.precincts.length,
    };

    const values = [
      row.ZipCode,
      row.TargetVoters.toLocaleString(),
      row.AvgAge > 0 ? row.AvgAge.toFixed(1) : 'N/A',
      row.MedianIncome > 0 ? `$${row.MedianIncome.toLocaleString()}` : 'N/A',
      row.TapestrySegments,
      row.TargetingStrategy,
      row.PrecinctCount,
    ];

    return this.escapeCSVRow(values);
  }

  /**
   * Generate geographic targeting recommendations
   */
  private getGeographicTargeting(aggregate: ZIPAggregate): string {
    return `ZIP ${aggregate.zip} (${aggregate.municipality})`;
  }

  /**
   * Generate audience interest recommendations based on Tapestry segment
   */
  private getAudienceInterests(aggregate: ZIPAggregate): string {
    // Map Tapestry segments to interest categories
    const segmentInterests: Record<string, string[]> = {
      'Urban Chic': ['Arts & Culture', 'Dining', 'Professional Development'],
      'Soccer Moms': ['Family', 'Education', 'Local Events'],
      'Rustbelt Traditions': ['Manufacturing', 'Veterans', 'Community'],
      'College Towns': ['Education', 'Social Issues', 'Innovation'],
      'Senior Escapes': ['Healthcare', 'Retirement', 'Social Security'],
    };

    const interests = segmentInterests[aggregate.topTapestrySegment] || ['Politics', 'Local News', 'Community'];
    return interests.join('; ');
  }

  /**
   * Calculate budget recommendation based on voter count and scores
   */
  private getBudgetRecommendation(aggregate: ZIPAggregate): string {
    const combinedScore = (aggregate.avgGOTVPriority + aggregate.avgPersuasionScore) / 2;

    // Base CPM (cost per 1000 impressions): $5-15 for political ads
    const baseCPM = 10;

    // Target reach: 5-10 impressions per voter
    const targetImpressions = aggregate.totalVoters * 7;

    // Budget = (impressions / 1000) * CPM
    const budget = (targetImpressions / 1000) * baseCPM;

    // Adjust by priority score
    const adjustedBudget = budget * (combinedScore / 100);

    if (adjustedBudget < 100) return 'Low ($50-100)';
    if (adjustedBudget < 500) return 'Medium ($100-500)';
    if (adjustedBudget < 1000) return 'High ($500-1K)';
    return `Very High ($${(adjustedBudget / 1000).toFixed(1)}K+)`;
  }

  /**
   * Calculate weighted average
   */
  private weightedAverage<T>(
    items: T[],
    getValue: (item: T) => number,
    getWeight: (item: T) => number
  ): number {
    if (items.length === 0) return 0;

    const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);
    if (totalWeight === 0) return 0;

    const weightedSum = items.reduce(
      (sum, item) => sum + getValue(item) * getWeight(item),
      0
    );

    return weightedSum / totalWeight;
  }

  /**
   * Find most common value in array
   */
  private mostCommon<T>(items: T[]): T {
    if (items.length === 0) throw new Error('Cannot find most common in empty array');

    const counts = new Map<T, number>();
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommonItem = items[0];

    for (const [item, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonItem = item;
      }
    }

    return mostCommonItem;
  }

  /**
   * Escape and format a CSV row
   */
  private escapeCSVRow(values: (string | number)[]): string {
    return values
      .map(value => this.escapeCSVValue(String(value)))
      .join(',');
  }

  /**
   * Escape a CSV value (handle quotes, commas, newlines)
   */
  private escapeCSVValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Export with custom aggregation level
   */
  exportByMunicipality(): string {
    return this.export({
      aggregationLevel: 'municipality',
    });
  }
}

export default DigitalAdsExporter;
