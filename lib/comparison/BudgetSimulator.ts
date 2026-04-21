/**
 * Budget Simulator for Political Campaign Analysis
 *
 * Uses Monte Carlo simulation to estimate the impact of budget allocation
 * across different precincts and outreach channels.
 */

import type { ComparisonEntity } from './types';
import type {
  BudgetAllocation,
  ChannelSplit,
  SimulationResult,
  EntitySimulationResult,
  ResourceOptimizerConfig,
} from './types-resource';
import { ResourceOptimizer } from './ResourceOptimizer';

// Default channel split
const DEFAULT_CHANNEL_SPLIT: ChannelSplit = {
  canvassing: 0.40,
  digital: 0.25,
  mail: 0.20,
  phone: 0.15,
};

// Default simulation parameters
const DEFAULT_SIMULATION_CONFIG = {
  iterations: 10000,          // Monte Carlo iterations
  persuasionVariance: 0.3,    // Standard deviation for persuasion rate
  turnoutVariance: 0.2,       // Standard deviation for turnout boost
  minIterations: 1000,        // Minimum iterations for quick mode
};

export class BudgetSimulator {
  private optimizer: ResourceOptimizer;
  private config: typeof DEFAULT_SIMULATION_CONFIG;

  constructor(
    optimizerConfig?: Partial<ResourceOptimizerConfig>,
    simulationConfig?: Partial<typeof DEFAULT_SIMULATION_CONFIG>
  ) {
    this.optimizer = new ResourceOptimizer(optimizerConfig);
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...simulationConfig };
  }

  /**
   * Run budget allocation simulation
   * @param entities - Entities to allocate budget to
   * @param totalBudget - Total budget in dollars
   * @param allocation - Budget allocation per entity (0-1, must sum to 1)
   * @param channelSplit - Budget split by channel (optional)
   * @returns Simulation results with expected outcomes
   */
  simulate(
    entities: ComparisonEntity[],
    totalBudget: number,
    allocation: BudgetAllocation,
    channelSplit: ChannelSplit = DEFAULT_CHANNEL_SPLIT
  ): SimulationResult {
    // Validate allocation sums to approximately 1
    const allocationSum = Object.values(allocation).reduce((a, b) => a + b, 0);
    if (Math.abs(allocationSum - 1) > 0.01) {
      console.warn(`Budget allocation sums to ${allocationSum}, expected 1.0`);
    }

    // Validate channel split sums to approximately 1
    const channelSum = Object.values(channelSplit).reduce((a, b) => a + b, 0);
    if (Math.abs(channelSum - 1) > 0.01) {
      console.warn(`Channel split sums to ${channelSum}, expected 1.0`);
    }

    // Simulate each entity
    const entityResults: EntitySimulationResult[] = entities.map(entity => {
      const entityBudget = totalBudget * (allocation[entity.id] || 0);
      return this.simulateEntity(entity, entityBudget, channelSplit);
    });

    // Calculate aggregate metrics
    const totalReach = entityResults.reduce((sum, r) => sum + r.expectedReach, 0);
    const avgMarginImprovement = entityResults.reduce((sum, r) => sum + r.marginImprovement, 0) / entities.length;
    const entitiesLikelyToFlip = entityResults.filter(r => r.probabilityFlip > 0.5).length;

    // Generate recommendations
    const recommendations = this.generateRecommendations(entityResults, totalBudget);

    return {
      totalBudget,
      allocation,
      channelSplit,
      entityResults,
      totalReach,
      avgMarginImprovement,
      entitiesLikelyToFlip,
      recommendations,
    };
  }

  /**
   * Auto-optimize budget allocation using gradient descent
   * @param entities - Entities to optimize
   * @param totalBudget - Total budget
   * @param objective - Optimization objective
   * @returns Optimized allocation
   */
  optimizeAllocation(
    entities: ComparisonEntity[],
    totalBudget: number,
    objective: 'maximize_flips' | 'maximize_reach' | 'maximize_margin' = 'maximize_flips'
  ): BudgetAllocation {
    // Start with ROI-proportional allocation
    const analyses = entities.map(e => this.optimizer.analyzeEntity(e));
    const totalROI = analyses.reduce((sum, a) => sum + a.roiScore.totalScore, 0);

    const allocation: BudgetAllocation = {};
    for (const analysis of analyses) {
      allocation[analysis.entity.id] = analysis.roiScore.totalScore / totalROI;
    }

    // Gradient descent optimization (simplified)
    const learningRate = 0.1;
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const result = this.simulate(entities, totalBudget, allocation, DEFAULT_CHANNEL_SPLIT);

      // Calculate gradients
      const gradients: Record<string, number> = {};
      const delta = 0.05;

      for (const entity of entities) {
        // Estimate gradient by perturbation
        const perturbedAlloc = { ...allocation };
        perturbedAlloc[entity.id] = Math.min(1, allocation[entity.id] + delta);

        // Normalize
        const perturbSum = Object.values(perturbedAlloc).reduce((a, b) => a + b, 0);
        for (const id of Object.keys(perturbedAlloc)) {
          perturbedAlloc[id] /= perturbSum;
        }

        const perturbedResult = this.simulate(entities, totalBudget, perturbedAlloc, DEFAULT_CHANNEL_SPLIT);

        // Calculate objective change
        let baseObjective: number;
        let perturbedObjective: number;

        switch (objective) {
          case 'maximize_flips':
            baseObjective = result.entitiesLikelyToFlip;
            perturbedObjective = perturbedResult.entitiesLikelyToFlip;
            break;
          case 'maximize_reach':
            baseObjective = result.totalReach;
            perturbedObjective = perturbedResult.totalReach;
            break;
          case 'maximize_margin':
            baseObjective = result.avgMarginImprovement;
            perturbedObjective = perturbedResult.avgMarginImprovement;
            break;
        }

        gradients[entity.id] = (perturbedObjective - baseObjective) / delta;
      }

      // Update allocation based on gradients
      for (const entity of entities) {
        allocation[entity.id] += learningRate * gradients[entity.id];
        allocation[entity.id] = Math.max(0.05, Math.min(0.5, allocation[entity.id])); // Clamp
      }

      // Normalize
      const sum = Object.values(allocation).reduce((a, b) => a + b, 0);
      for (const id of Object.keys(allocation)) {
        allocation[id] /= sum;
      }
    }

    return allocation;
  }

  /**
   * Quick simulation mode with fewer iterations (for UI responsiveness)
   */
  quickSimulate(
    entities: ComparisonEntity[],
    totalBudget: number,
    allocation: BudgetAllocation,
    channelSplit: ChannelSplit = DEFAULT_CHANNEL_SPLIT
  ): SimulationResult {
    // Use reduced iterations for quick estimate
    const originalIterations = this.config.iterations;
    this.config.iterations = this.config.minIterations;

    const result = this.simulate(entities, totalBudget, allocation, channelSplit);

    this.config.iterations = originalIterations;
    return result;
  }

  // =====================================================================
  // PRIVATE SIMULATION METHODS
  // =====================================================================

  /**
   * Simulate a single entity
   */
  private simulateEntity(
    entity: ComparisonEntity,
    budget: number,
    channelSplit: ChannelSplit
  ): EntitySimulationResult {
    const analysis = this.optimizer.analyzeEntity(entity);

    // Split budget by channel
    const channelBudgets = {
      canvassing: budget * channelSplit.canvassing,
      digital: budget * channelSplit.digital,
      mail: budget * channelSplit.mail,
      phone: budget * channelSplit.phone,
    };

    // Calculate expected reach per channel
    const channelReach = {
      canvassing: this.calculateChannelReach(channelBudgets.canvassing, analysis.channelCosts.canvassing.costPerPersuadable),
      digital: this.calculateChannelReach(channelBudgets.digital, analysis.channelCosts.digital.costPerPersuadable),
      mail: this.calculateChannelReach(channelBudgets.mail, analysis.channelCosts.mail.costPerPersuadable),
      phone: this.calculateChannelReach(channelBudgets.phone, analysis.channelCosts.phone.costPerPersuadable),
    };

    const expectedReach = Object.values(channelReach).reduce((a, b) => a + b, 0);

    // Run Monte Carlo for flip probability
    const probabilityFlip = this.monteCarloProbability(entity, expectedReach);

    // Estimate margin improvement
    const marginImprovement = this.estimateMarginImprovement(expectedReach, entity);

    return {
      entity,
      budget,
      expectedReach: Math.round(expectedReach),
      marginImprovement,
      probabilityFlip,
      channelBreakdown: [
        { channel: 'canvassing', budget: channelBudgets.canvassing, expectedReach: Math.round(channelReach.canvassing) },
        { channel: 'digital', budget: channelBudgets.digital, expectedReach: Math.round(channelReach.digital) },
        { channel: 'mail', budget: channelBudgets.mail, expectedReach: Math.round(channelReach.mail) },
        { channel: 'phone', budget: channelBudgets.phone, expectedReach: Math.round(channelReach.phone) },
      ],
    };
  }

  /**
   * Calculate reach from budget and cost per persuadable
   */
  private calculateChannelReach(budget: number, costPerPersuadable: number): number {
    if (costPerPersuadable <= 0 || !isFinite(costPerPersuadable)) return 0;
    return budget / costPerPersuadable;
  }

  /**
   * Monte Carlo simulation for flip probability
   * @param entity - Entity to simulate
   * @param expectedReach - Expected persuaded voters
   * @returns Probability of flipping the entity (0-1)
   */
  private monteCarloProbability(entity: ComparisonEntity, expectedReach: number): number {
    const iterations = this.config.iterations;
    let flips = 0;

    const totalVotes = entity.electoral.totalVotesCast;
    const currentMargin = entity.electoral.demVoteShare - entity.electoral.repVoteShare;

    // We assume the campaign is Democratic for this simulation
    // A "flip" means changing from R-leaning to D-winning or increasing D margin significantly
    const needsFlip = currentMargin < 0;

    for (let i = 0; i < iterations; i++) {
      // Simulate persuasion (with variance)
      const persuasionMean = expectedReach * 0.5; // 50% of reached voters are persuadable
      const persuasionStd = persuasionMean * this.config.persuasionVariance;
      const persuadedVotes = Math.max(0, this.gaussianRandom(persuasionMean, persuasionStd));

      // Simulate turnout boost (with variance)
      const turnoutMean = expectedReach * 0.5; // Other 50% are turnout targets
      const turnoutStd = turnoutMean * this.config.turnoutVariance;
      const turnoutBoost = Math.max(0, this.gaussianRandom(turnoutMean, turnoutStd));

      // Net vote change
      // Persuaded voters swing 2x (we gain one, opponent loses one)
      // Turnout boost adds new votes (assuming they vote our way)
      const netVoteChange = persuadedVotes * 2 + turnoutBoost;

      // New margin calculation
      const newDemVotes = (totalVotes * entity.electoral.demVoteShare / 100) + netVoteChange;
      const newRepVotes = totalVotes * entity.electoral.repVoteShare / 100 - persuadedVotes;
      const newTotalVotes = totalVotes + turnoutBoost;

      const newDemPct = (newDemVotes / newTotalVotes) * 100;
      const newRepPct = (newRepVotes / newTotalVotes) * 100;
      const newMargin = newDemPct - newRepPct;

      // Check if flipped
      if (needsFlip && newMargin > 0) {
        flips++;
      } else if (!needsFlip && newMargin > currentMargin + 2) {
        // For already-D entities, count as "success" if margin improves by >2 points
        flips++;
      }
    }

    return flips / iterations;
  }

  /**
   * Estimate margin improvement based on voters reached
   */
  private estimateMarginImprovement(votersReached: number, entity: ComparisonEntity): number {
    const totalVotes = entity.electoral.totalVotesCast;
    if (totalVotes === 0) return 0;

    // Assume 50% persuasion, 50% turnout
    const persuaded = votersReached * 0.5;
    const turnout = votersReached * 0.5;

    // Net effect: persuaded × 2 (swing both ways) + turnout
    const netChange = persuaded * 2 + turnout;

    // Convert to margin points
    const marginImprovement = (netChange / totalVotes) * 100;

    return Math.round(marginImprovement * 10) / 10;
  }

  /**
   * Generate recommendations based on simulation results
   */
  private generateRecommendations(
    results: EntitySimulationResult[],
    totalBudget: number
  ): string[] {
    const recommendations: string[] = [];

    // Sort by probability of flip
    const sorted = [...results].sort((a, b) => b.probabilityFlip - a.probabilityFlip);

    // Top opportunity
    if (sorted[0].probabilityFlip > 0.3) {
      recommendations.push(
        `Best flip opportunity: ${sorted[0].entity.name} (${Math.round(sorted[0].probabilityFlip * 100)}% chance with current allocation)`
      );
    }

    // Entities likely to flip
    const likelyFlips = results.filter(r => r.probabilityFlip > 0.5);
    if (likelyFlips.length > 0) {
      recommendations.push(
        `${likelyFlips.length} entities have >50% flip probability with this budget`
      );
    } else {
      recommendations.push(
        `No entities have >50% flip probability - consider increasing budget or focusing resources`
      );
    }

    // Budget efficiency
    const avgCostPerFlip = likelyFlips.length > 0
      ? totalBudget / likelyFlips.length
      : Infinity;

    if (isFinite(avgCostPerFlip)) {
      recommendations.push(
        `Estimated cost per likely flip: $${Math.round(avgCostPerFlip).toLocaleString()}`
      );
    }

    // Low-hanging fruit
    const lowHanging = results.filter(r =>
      r.probabilityFlip > 0.3 &&
      r.probabilityFlip < 0.7 &&
      r.budget < totalBudget * 0.15
    );

    if (lowHanging.length > 0) {
      recommendations.push(
        `Consider increasing allocation to ${lowHanging.map(r => r.entity.name).join(', ')} - moderate flip probability with low current investment`
      );
    }

    // Diminishing returns
    const highInvestment = results.filter(r => r.budget > totalBudget * 0.25);
    for (const r of highInvestment) {
      if (r.probabilityFlip < 0.4) {
        recommendations.push(
          `${r.entity.name} has high investment ($${Math.round(r.budget).toLocaleString()}) but low flip probability (${Math.round(r.probabilityFlip * 100)}%) - consider reallocating`
        );
      }
    }

    return recommendations;
  }

  // =====================================================================
  // UTILITY METHODS
  // =====================================================================

  /**
   * Box-Muller transform for Gaussian random numbers
   */
  private gaussianRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }
}
