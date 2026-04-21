/**
 * Type definitions for Donor Integration in the Comparison Tool
 */

import type { ComparisonEntity } from './types';

/**
 * Donor concentration metrics for an entity
 */
export interface DonorConcentrationMetrics {
  // Summary metrics
  totalDonors: number;            // Unique donors in entity
  totalRaised: number;            // Total $ raised
  avgDonation: number;            // Average donation size
  medianDonation: number;         // Median donation size
  donorDensity: number;           // Donors per 1000 residents

  // Donor composition
  grassrootsPct: number;          // % of donations <$200
  midLevelPct: number;            // % of donations $200-$999
  majorDonorsPct: number;         // % of donations >= $1000

  // Growth metrics
  donorGrowth: DonorGrowthMetrics;

  // Recovery opportunities
  lapsedDonors: number;           // Donors who gave last cycle but not this
  upgradePotential: number;       // Score (0-100) for donor upgrade potential

  // Occupational breakdown
  topOccupations: OccupationBreakdown[];

  // Party breakdown
  demAmount: number;
  repAmount: number;
  demPct: number;
  repPct: number;

  // Independent expenditure data (if available)
  ieSpending?: IESpendingMetrics;
}

/**
 * Donor growth over time
 */
export interface DonorGrowthMetrics {
  last30Days: number;             // New donors in last 30 days
  last90Days: number;             // New donors in last 90 days
  yearOverYear: number;           // % change vs last year
  amountLast30Days: number;       // Amount raised in last 30 days
  amountLast90Days: number;       // Amount raised in last 90 days
}

/**
 * Occupation breakdown
 */
export interface OccupationBreakdown {
  occupation: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
}

/**
 * Independent expenditure spending
 */
export interface IESpendingMetrics {
  forCandidate: number;           // IE spending supporting candidate
  againstCandidate: number;       // IE spending opposing candidate
  netSupport: number;             // for - against
  spenderCount: number;           // Number of IE committees active
}

/**
 * Comparison of donor metrics between two entities
 */
export interface DonorComparison {
  left: DonorConcentrationMetrics | null;
  right: DonorConcentrationMetrics | null;

  // Comparison metrics (only if both have data)
  differences?: {
    totalRaisedDiff: number;      // left - right
    donorDensityDiff: number;
    grassrootsDiff: number;
    lapsedDonorsDiff: number;
  };

  // Generated insights
  insights: string[];
}

/**
 * ZIP code mapping result for an entity
 */
export interface EntityZIPMapping {
  entityId: string;
  entityType: 'precinct' | 'jurisdiction';
  zipCodes: string[];
  coverage: number;               // % of entity covered by ZIP data (0-1)
}

/**
 * Options for donor integration
 */
export interface DonorIntegrationOptions {
  includeIEData: boolean;         // Include independent expenditure data
  includeLapsedAnalysis: boolean; // Include lapsed donor analysis
  minDonorThreshold: number;      // Minimum donors to report metrics (default: 5)
}

/**
 * ZIP aggregate data structure (matches existing donor data format)
 */
export interface ZIPAggregateData {
  zipCode: string;
  city: string;
  state: string;
  totalAmount: number;
  donorCount: number;
  contributionCount: number;
  avgContribution: number;
  medianContribution: number;
  demAmount: number;
  repAmount: number;
  demDonors: number;
  repDonors: number;
  amountLast30Days: number;
  amountLast90Days: number;
  amountLast12Months: number;
  topDonorCount: number;
  maxSingleDonation: number;
}

/**
 * Lapsed donor data structure
 */
export interface LapsedDonorData {
  donorId: string;
  zipCode: string;
  lastContributionDate: string;
  totalHistoricalContributed: number;
  contributionCount: number;
  daysSinceLastGift: number;
  likelyParty: 'DEM' | 'REP' | 'split' | 'unknown';
  recoveryPotential: 'high' | 'medium' | 'low';
}
