/**
 * Resource Optimizer for Political Campaign Analysis
 *
 * Calculates ROI scores and cost-per-persuadable estimates for campaign resource allocation.
 * Helps campaign managers optimize budget allocation across precincts and outreach channels.
 */

import type { ComparisonEntity } from './types';
import type {
  ROIScore,
  ROIBreakdown,
  ChannelCosts,
  ChannelCostEstimate,
  EntityResourceAnalysis,
  ResourceOptimizerConfig,
} from './types-resource';

// Default configuration with industry benchmarks
const DEFAULT_CONFIG: ResourceOptimizerConfig = {
  canvasserHourlyWage: 20,
  digitalCPM: 15,
  mailCostPerPiece: 1.0,
  phoneBankerHourlyWage: 15,
  canvassingContactRate: 0.3,
  digitalConversionRate: 0.02,
  mailReadRate: 0.45,
  phoneContactRate: 0.3,
};

export class ResourceOptimizer {
  private config: ResourceOptimizerConfig;

  constructor(config?: Partial<ResourceOptimizerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate ROI score for resource allocation in an entity
   * Returns score (0-100) with breakdown by component
   */
  calculateROI(entity: ComparisonEntity): ROIScore {
    const breakdown: ROIBreakdown = {
      persuadableVoters: this.calculatePersuadableVotersScore(entity),
      efficiency: this.calculateEfficiencyScore(entity),
      swingImpact: this.calculateSwingImpactScore(entity),
      turnoutGap: this.calculateTurnoutGapScore(entity),
      competitiveProximity: this.calculateCompetitiveProximityScore(entity),
    };

    // Weighted total (weights from requirements doc)
    const totalScore = Math.round(
      breakdown.persuadableVoters * 0.3 +
        breakdown.efficiency * 0.25 +
        breakdown.swingImpact * 0.2 +
        breakdown.turnoutGap * 0.15 +
        breakdown.competitiveProximity * 0.1
    );

    return {
      totalScore,
      breakdown,
      recommendation: this.generateRecommendation(totalScore, breakdown),
    };
  }

  /**
   * Calculate cost per persuadable voter by channel
   */
  calculateCostPerPersuadable(entity: ComparisonEntity): ChannelCosts {
    const persuadableRate = entity.targetingScores.persuasionOpportunity / 100;
    const density = this.getDensityCategory(entity.demographics.populationDensity);

    const canvassing = this.calculateCanvassingCost(entity, persuadableRate, density);
    const digital = this.calculateDigitalCost(entity, persuadableRate, density);
    const mail = this.calculateMailCost(entity, persuadableRate);
    const phone = this.calculatePhoneCost(entity, persuadableRate);

    // Find minimum cost channel
    const costs = [canvassing, digital, mail, phone];
    const minCost = Math.min(...costs.map((c) => c.costPerPersuadable));

    // Mark recommended and calculate relative efficiency
    for (const channel of costs) {
      channel.isRecommended = channel.costPerPersuadable === minCost;
      channel.relativeEfficiency = minCost / channel.costPerPersuadable;
    }

    return { canvassing, digital, mail, phone };
  }

  /**
   * Get full resource analysis for an entity
   */
  analyzeEntity(entity: ComparisonEntity): EntityResourceAnalysis {
    const roiScore = this.calculateROI(entity);
    const channelCosts = this.calculateCostPerPersuadable(entity);

    // Find recommended channel
    const channels: Array<'canvassing' | 'digital' | 'mail' | 'phone'> = [
      'canvassing',
      'digital',
      'mail',
      'phone',
    ];
    const recommendedChannel =
      channels.find((c) => channelCosts[c].isRecommended) || 'canvassing';

    // Calculate summary metrics
    const persuadableRate = entity.targetingScores.persuasionOpportunity / 100;
    const estimatedPersuadableVoters = Math.round(
      entity.demographics.registeredVoters * persuadableRate
    );
    const bestCostPerPersuadable = channelCosts[recommendedChannel].costPerPersuadable;

    // Calculate projections with typical $30K budget
    const typicalBudget = 30000;
    const reach = Math.round(typicalBudget / bestCostPerPersuadable);
    const marginImprovement = this.estimateMarginImprovement(reach, entity);
    const costFor1000Voters = bestCostPerPersuadable * 1000;

    return {
      entity,
      roiScore,
      channelCosts,
      recommendedChannel,
      estimatedPersuadableVoters,
      bestCostPerPersuadable,
      projections: {
        reach,
        marginImprovement,
        costFor1000Voters,
      },
    };
  }

  /**
   * Compare resource efficiency across multiple entities
   * Returns entities ranked by ROI
   */
  rankByROI(entities: ComparisonEntity[]): EntityResourceAnalysis[] {
    const analyses = entities.map((e) => this.analyzeEntity(e));

    // Sort by ROI score descending
    analyses.sort((a, b) => b.roiScore.totalScore - a.roiScore.totalScore);

    // Add ranks
    analyses.forEach((a, i) => {
      a.roiScore.rank = i + 1;
    });

    return analyses;
  }

  // =====================================================================
  // PRIVATE SCORING METHODS
  // =====================================================================

  /**
   * Score based on number of persuadable voters
   * Formula: Persuasion Opportunity × Registered Voters × (1 - abs(Partisan Lean)/100)
   * Normalized to 0-100
   */
  private calculatePersuadableVotersScore(entity: ComparisonEntity): number {
    const persuadableRate = entity.targetingScores.persuasionOpportunity / 100;
    const leanModifier = 1 - Math.abs(entity.politicalProfile.partisanLean) / 100;
    const rawScore = persuadableRate * entity.demographics.registeredVoters * leanModifier;

    // Normalize: 1000+ persuadable = 100, scale down
    return Math.min(100, Math.round(rawScore / 10));
  }

  /**
   * Score based on canvassing efficiency and density
   * Higher density = more efficient
   */
  private calculateEfficiencyScore(entity: ComparisonEntity): number {
    const efficiency = entity.targetingScores.canvassingEfficiency;
    // Efficiency is doors/hour, typically 20-50
    // Normalize: 50 doors/hr = 100, 20 doors/hr = 40
    return Math.min(100, Math.round(efficiency * 2));
  }

  /**
   * Score based on swing potential and margin closeness
   */
  private calculateSwingImpactScore(entity: ComparisonEntity): number {
    const swingPotential = entity.politicalProfile.swingPotential;
    const marginCloseness = 100 - Math.min(100, entity.electoral.marginOfVictory * 2);

    // Average of swing potential and margin closeness
    return Math.round((swingPotential + marginCloseness) / 2);
  }

  /**
   * Score based on turnout gap (potential for GOTV)
   * Formula: (80 - Current Turnout) × Base Support
   */
  private calculateTurnoutGapScore(entity: ComparisonEntity): number {
    const turnoutGap = Math.max(0, 80 - entity.politicalProfile.avgTurnoutRate);
    const baseSupport = entity.targetingScores.gotvPriority / 100;

    return Math.min(100, Math.round(turnoutGap * baseSupport * 2));
  }

  /**
   * Score based on competitiveness level
   * Toss-up = 100, Lean = 80, Likely = 60, Safe = 40
   */
  private calculateCompetitiveProximityScore(entity: ComparisonEntity): number {
    const competitiveness = entity.politicalProfile.competitiveness;

    switch (competitiveness) {
      case 'tossup':
        return 100;
      case 'lean_d':
      case 'lean_r':
        return 80;
      case 'likely_d':
      case 'likely_r':
        return 60;
      case 'safe_d':
      case 'safe_r':
        return 40;
      default:
        return 50;
    }
  }

  // =====================================================================
  // PRIVATE COST CALCULATION METHODS
  // =====================================================================

  /**
   * Calculate canvassing cost per persuadable voter
   */
  private calculateCanvassingCost(
    entity: ComparisonEntity,
    persuadableRate: number,
    density: 'urban' | 'suburban' | 'rural'
  ): ChannelCostEstimate {
    const doorsPerHour = entity.targetingScores.canvassingEfficiency;
    const contactRate = this.config.canvassingContactRate;

    // Contacts per hour × persuadable rate = persuaded per hour
    const persuadedPerHour = doorsPerHour * contactRate * persuadableRate;

    // Cost per persuaded voter
    const costPerPersuadable =
      persuadedPerHour > 0 ? this.config.canvasserHourlyWage / persuadedPerHour : Infinity;

    return {
      channel: 'canvassing',
      doorsPerHour,
      contactRate,
      persuadableRate,
      costPerUnit: this.config.canvasserHourlyWage / doorsPerHour,
      costPerPersuadable: Math.round(costPerPersuadable * 100) / 100,
      isRecommended: false,
      relativeEfficiency: 0,
    };
  }

  /**
   * Calculate digital advertising cost per persuadable voter
   */
  private calculateDigitalCost(
    entity: ComparisonEntity,
    persuadableRate: number,
    density: 'urban' | 'suburban' | 'rural'
  ): ChannelCostEstimate {
    // Digital is less effective for persuasion than canvassing
    const conversionRate = this.config.digitalConversionRate * persuadableRate;

    // Cost per 1000 impressions / conversions per 1000 = cost per conversion
    const costPerPersuadable =
      conversionRate > 0 ? this.config.digitalCPM / (conversionRate * 1000) : Infinity;

    // Estimate impressions needed to reach voter base
    const impressionsNeeded = Math.round(entity.demographics.registeredVoters * 10);

    return {
      channel: 'digital',
      impressionsNeeded,
      contactRate: 1.0, // Digital reaches everyone
      persuadableRate: conversionRate,
      costPerUnit: this.config.digitalCPM / 1000,
      costPerPersuadable: Math.round(costPerPersuadable * 100) / 100,
      isRecommended: false,
      relativeEfficiency: 0,
    };
  }

  /**
   * Calculate mail cost per persuadable voter
   */
  private calculateMailCost(
    entity: ComparisonEntity,
    persuadableRate: number
  ): ChannelCostEstimate {
    // Assume 2.5 people per household
    const householdsTargeted = Math.round(entity.demographics.registeredVoters / 2.5);

    // Read rate × persuadable rate = effective persuasion rate
    const effectiveRate = this.config.mailReadRate * persuadableRate * 0.25; // Mail is 25% as effective as canvassing

    const costPerPersuadable =
      effectiveRate > 0 ? this.config.mailCostPerPiece / effectiveRate : Infinity;

    return {
      channel: 'mail',
      householdsTargeted,
      contactRate: this.config.mailReadRate,
      persuadableRate: persuadableRate * 0.25,
      costPerUnit: this.config.mailCostPerPiece,
      costPerPersuadable: Math.round(costPerPersuadable * 100) / 100,
      isRecommended: false,
      relativeEfficiency: 0,
    };
  }

  /**
   * Calculate phone banking cost per persuadable voter
   */
  private calculatePhoneCost(
    entity: ComparisonEntity,
    persuadableRate: number
  ): ChannelCostEstimate {
    const callsPerHour = 20; // Industry standard
    const contactRate = this.config.phoneContactRate;
    const persuasionRate = persuadableRate * 0.2; // Phone is 20% as effective as canvassing

    const persuadedPerHour = callsPerHour * contactRate * persuasionRate;
    const costPerPersuadable =
      persuadedPerHour > 0 ? this.config.phoneBankerHourlyWage / persuadedPerHour : Infinity;

    return {
      channel: 'phone',
      callsPerHour,
      contactRate,
      persuadableRate: persuasionRate,
      costPerUnit: this.config.phoneBankerHourlyWage / callsPerHour,
      costPerPersuadable: Math.round(costPerPersuadable * 100) / 100,
      isRecommended: false,
      relativeEfficiency: 0,
    };
  }

  // =====================================================================
  // PRIVATE HELPER METHODS
  // =====================================================================

  /**
   * Categorize population density
   */
  private getDensityCategory(density: number): 'urban' | 'suburban' | 'rural' {
    if (density > 3000) return 'urban';
    if (density > 500) return 'suburban';
    return 'rural';
  }

  /**
   * Estimate margin improvement based on voters reached
   */
  private estimateMarginImprovement(votersReached: number, entity: ComparisonEntity): number {
    // Assume 50% of persuaded voters switch, 50% mobilize
    const voteSwitches = votersReached * 0.5;
    const newTurnout = votersReached * 0.5;

    // Net vote change = switches × 2 (takes from opponent, adds to us) + new turnout
    const netChange = voteSwitches * 2 + newTurnout;

    // Convert to margin improvement
    const totalVotes = entity.electoral.totalVotesCast;
    const marginImprovement = totalVotes > 0 ? (netChange / totalVotes) * 100 : 0;

    return Math.round(marginImprovement * 10) / 10;
  }

  /**
   * Generate human-readable recommendation based on ROI analysis
   */
  private generateRecommendation(totalScore: number, breakdown: ROIBreakdown): string {
    if (totalScore >= 80) {
      return 'HIGH PRIORITY: Strong ROI potential, allocate maximum resources';
    } else if (totalScore >= 60) {
      return 'MEDIUM PRIORITY: Good ROI potential, consider moderate resource allocation';
    } else if (totalScore >= 40) {
      return 'LOW PRIORITY: Limited ROI potential, allocate minimal resources';
    } else {
      return 'NOT RECOMMENDED: Poor ROI, redirect resources elsewhere';
    }
  }
}
