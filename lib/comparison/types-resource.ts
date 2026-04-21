/**
 * Type definitions for the Resource Allocation Optimizer feature
 */

import type { ComparisonEntity } from './types';

/**
 * ROI score breakdown by component
 */
export interface ROIBreakdown {
  persuadableVoters: number;      // 30% weight
  efficiency: number;              // 25% weight
  swingImpact: number;            // 20% weight
  turnoutGap: number;             // 15% weight
  competitiveProximity: number;   // 10% weight
}

/**
 * Overall ROI score for an entity
 */
export interface ROIScore {
  totalScore: number;             // 0-100 overall ROI score
  breakdown: ROIBreakdown;
  rank?: number;                  // Rank among compared entities
  recommendation: string;         // Human-readable recommendation
}

/**
 * Cost estimate for a single outreach channel
 */
export interface ChannelCostEstimate {
  channel: 'canvassing' | 'digital' | 'mail' | 'phone';

  // Channel-specific metrics
  doorsPerHour?: number;          // Canvassing only
  impressionsNeeded?: number;     // Digital only
  householdsTargeted?: number;    // Mail only
  callsPerHour?: number;          // Phone only

  // Common metrics
  contactRate: number;            // % of targets successfully contacted
  persuadableRate: number;        // % of contacts who are persuadable
  costPerUnit: number;            // Cost per door/impression/piece/call
  costPerPersuadable: number;     // Final cost per persuaded voter

  // Efficiency metrics
  isRecommended: boolean;         // Is this the most efficient channel?
  relativeEfficiency: number;     // 1.0 = best, lower = worse
}

/**
 * Cost breakdown across all channels
 */
export interface ChannelCosts {
  canvassing: ChannelCostEstimate;
  digital: ChannelCostEstimate;
  mail: ChannelCostEstimate;
  phone: ChannelCostEstimate;
}

/**
 * Resource analysis for a single entity
 */
export interface EntityResourceAnalysis {
  entity: ComparisonEntity;
  roiScore: ROIScore;
  channelCosts: ChannelCosts;
  recommendedChannel: 'canvassing' | 'digital' | 'mail' | 'phone';

  // Summary metrics
  estimatedPersuadableVoters: number;
  bestCostPerPersuadable: number;

  // Projections
  projections: {
    reach: number;                // Voters reached with typical budget
    marginImprovement: number;    // Expected margin improvement in points
    costFor1000Voters: number;    // Cost to reach 1000 persuadable voters
  };
}

/**
 * Budget allocation across entities
 */
export interface BudgetAllocation {
  [entityId: string]: number;     // Percentage allocation (0-1)
}

/**
 * Channel split within budget
 */
export interface ChannelSplit {
  canvassing: number;             // 0-1
  digital: number;                // 0-1
  mail: number;                   // 0-1
  phone: number;                  // 0-1
}

/**
 * Result for a single entity in simulation
 */
export interface EntitySimulationResult {
  entity: ComparisonEntity;
  budget: number;                 // Allocated budget in dollars
  expectedReach: number;          // Number of voters reached
  marginImprovement: number;      // Expected margin improvement (points)
  probabilityFlip: number;        // Monte Carlo flip probability (0-1)
  channelBreakdown: {
    channel: string;
    budget: number;
    expectedReach: number;
  }[];
}

/**
 * Full simulation result
 */
export interface SimulationResult {
  totalBudget: number;
  allocation: BudgetAllocation;
  channelSplit: ChannelSplit;
  entityResults: EntitySimulationResult[];

  // Aggregate metrics
  totalReach: number;
  avgMarginImprovement: number;
  entitiesLikelyToFlip: number;

  // Recommendations
  recommendations: string[];
}

/**
 * Configuration for resource optimizer
 */
export interface ResourceOptimizerConfig {
  // Industry benchmark costs
  canvasserHourlyWage: number;    // Default: $20/hr
  digitalCPM: number;             // Default: $15 per 1000 impressions
  mailCostPerPiece: number;       // Default: $1.00/piece
  phoneBankerHourlyWage: number;  // Default: $15/hr

  // Conversion rates (can be adjusted based on campaign data)
  canvassingContactRate: number;  // Default: 0.30
  digitalConversionRate: number;  // Default: 0.02
  mailReadRate: number;           // Default: 0.45
  phoneContactRate: number;       // Default: 0.30
}
