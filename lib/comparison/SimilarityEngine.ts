/**
 * Similarity Engine for Political Landscape Analysis
 *
 * Calculates similarity scores between political entities (precincts, municipalities, districts)
 * to help identify similar high-value areas for campaign targeting.
 *
 * Key Features:
 * - Weighted multi-dimensional similarity scoring
 * - Bonus scoring for strategic alignment (same strategy, competitiveness)
 * - Batch similarity search for multiple reference entities
 * - Flexible filtering by population, strategy, competitiveness
 *
 * Algorithm:
 * 1. Calculate 8 component scores (0-100 each) for political, demographic, and targeting dimensions
 * 2. Apply weights (default: 40% political, 30% demographic, 30% targeting)
 * 3. Add bonuses for strategic alignment (+10 same strategy, +5 same competitiveness)
 * 4. Return top N results above similarity threshold
 *
 * @example
 * ```typescript
 * const engine = new SimilarityEngine();
 * const similar = engine.findSimilar(myPrecinct, allPrecincts, {
 *   minSimilarity: 70,
 *   maxResults: 10,
 *   sameStrategy: true
 * });
 * ```
 */

import type { ComparisonEntity } from './types';
import type {
  SimilarityResult,
  SimilarityBreakdown,
  SimilarityBonuses,
  SimilaritySearchOptions,
  SimilarityWeights,
  SimilarEntityResult,
} from './types-similarity';

// Default weights from requirements doc
// Political Profile: 40%, Demographics: 30%, Targeting: 30%
const DEFAULT_WEIGHTS: SimilarityWeights = {
  partisanLean: 0.20,
  swingPotential: 0.10,
  turnout: 0.10,
  income: 0.10,
  age: 0.10,
  education: 0.10,
  gotvPriority: 0.15,
  persuasionOpportunity: 0.15,
};

/**
 * Main similarity engine for political entity comparison
 */
export class SimilarityEngine {
  private weights: SimilarityWeights;

  /**
   * Create a new similarity engine
   *
   * @param customWeights - Optional weight overrides (must sum to 1.0)
   */
  constructor(customWeights?: Partial<SimilarityWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
    this.validateWeights();
  }

  /**
   * Validate that weights sum to approximately 1.0
   */
  private validateWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      console.warn(`Similarity weights sum to ${sum.toFixed(3)}, expected 1.0`);
    }
  }

  /**
   * Calculate similarity score between two entities
   *
   * Returns score (0-100) with detailed breakdown of matching factors.
   *
   * @param entity1 - First entity to compare
   * @param entity2 - Second entity to compare
   * @returns Similarity result with score, breakdown, and matching factors
   */
  calculateSimilarity(
    entity1: ComparisonEntity,
    entity2: ComparisonEntity
  ): SimilarityResult {
    const factors: string[] = [];

    // Calculate individual component scores (0-100 each)
    const breakdown: SimilarityBreakdown = {
      partisanLean: this.compareLean(entity1, entity2),
      swingPotential: this.compareSwing(entity1, entity2),
      turnout: this.compareTurnout(entity1, entity2),
      income: this.compareIncome(entity1, entity2),
      age: this.compareAge(entity1, entity2),
      education: this.compareEducation(entity1, entity2),
      gotvPriority: this.compareGOTV(entity1, entity2),
      persuasionOpportunity: this.comparePersuasion(entity1, entity2),
    };

    // Identify matching factors (score > 70 = strong match)
    if (breakdown.partisanLean > 70) factors.push('Similar partisan lean');
    if (breakdown.swingPotential > 70) factors.push('Similar swing potential');
    if (breakdown.turnout > 70) factors.push('Similar turnout rates');
    if (breakdown.income > 70) factors.push('Similar median income');
    if (breakdown.age > 70) factors.push('Similar median age');
    if (breakdown.education > 70) factors.push('Similar education levels');
    if (breakdown.gotvPriority > 70) factors.push('Similar GOTV priority');
    if (breakdown.persuasionOpportunity > 70) factors.push('Similar persuasion opportunity');

    // Calculate weighted score
    let weightedScore =
      breakdown.partisanLean * this.weights.partisanLean +
      breakdown.swingPotential * this.weights.swingPotential +
      breakdown.turnout * this.weights.turnout +
      breakdown.income * this.weights.income +
      breakdown.age * this.weights.age +
      breakdown.education * this.weights.education +
      breakdown.gotvPriority * this.weights.gotvPriority +
      breakdown.persuasionOpportunity * this.weights.persuasionOpportunity;

    // Calculate bonuses
    const bonuses: SimilarityBonuses = {
      sameStrategy: entity1.targetingScores.recommendedStrategy === entity2.targetingScores.recommendedStrategy,
      sameCompetitiveness: entity1.politicalProfile.competitiveness === entity2.politicalProfile.competitiveness,
      sameTapestrySegment: false, // Future: Tapestry segment comparison
    };

    // Apply bonuses
    let bonusScore = 0;
    if (bonuses.sameStrategy) {
      bonusScore += 10;
      factors.push(`Same strategy: ${entity1.targetingScores.recommendedStrategy}`);
    }
    if (bonuses.sameCompetitiveness) {
      bonusScore += 5;
      factors.push(`Same competitiveness: ${entity1.politicalProfile.competitiveness}`);
    }
    if (bonuses.sameTapestrySegment) {
      bonusScore += 8;
      factors.push('Same Tapestry segment');
    }

    const totalScore = Math.min(100, Math.round(weightedScore + bonusScore));

    return {
      score: totalScore,
      factors,
      breakdown,
      bonuses,
    };
  }

  /**
   * Find top N similar entities from a list
   *
   * @param referenceEntity - Entity to find matches for
   * @param targetEntities - Pool of entities to search within
   * @param options - Search options (filters, limits, weights)
   * @returns Array of similar entities sorted by score (highest first)
   *
   * @example
   * ```typescript
   * const similar = engine.findSimilar(myTopPrecinct, allPrecincts, {
   *   minSimilarity: 70,
   *   maxResults: 10,
   *   sameStrategy: true,
   *   populationRange: { min: 1000, max: 5000 }
   * });
   * ```
   */
  findSimilar(
    referenceEntity: ComparisonEntity,
    targetEntities: ComparisonEntity[],
    options: Partial<SimilaritySearchOptions> = {}
  ): SimilarEntityResult[] {
    const {
      minSimilarity = 60,
      maxResults = 10,
      sameCompetitiveness,
      sameStrategy,
      populationRange,
    } = options;

    // Filter entities based on options
    let candidates = targetEntities.filter(target => {
      // Don't compare to self
      if (target.id === referenceEntity.id) return false;

      // Filter by competitiveness
      if (sameCompetitiveness &&
          target.politicalProfile.competitiveness !== referenceEntity.politicalProfile.competitiveness) {
        return false;
      }

      // Filter by strategy
      if (sameStrategy &&
          target.targetingScores.recommendedStrategy !== referenceEntity.targetingScores.recommendedStrategy) {
        return false;
      }

      // Filter by population range
      if (populationRange) {
        if (populationRange.min && target.demographics.totalPopulation < populationRange.min) {
          return false;
        }
        if (populationRange.max && target.demographics.totalPopulation > populationRange.max) {
          return false;
        }
      }

      return true;
    });

    // Score all candidates
    const scored: SimilarEntityResult[] = candidates.map(target => ({
      entity: target,
      similarity: this.calculateSimilarity(referenceEntity, target),
    }));

    // Filter by minimum similarity and sort
    return scored
      .filter(r => r.similarity.score >= minSimilarity)
      .sort((a, b) => b.similarity.score - a.similarity.score)
      .slice(0, maxResults);
  }

  /**
   * Calculate batch similarity - find similar entities for multiple references
   *
   * Useful for "find similar to all our top 20 performers" use case.
   *
   * @param referenceEntities - Array of entities to find matches for
   * @param targetEntities - Pool of entities to search within
   * @param options - Search options (filters, limits, weights)
   * @returns Map of reference entity ID → similar entities
   *
   * @example
   * ```typescript
   * const topPerformers = allPrecincts.filter(p => p.targetingScores.gotvPriority > 80);
   * const similarMap = engine.findSimilarBatch(topPerformers, allPrecincts, {
   *   minSimilarity: 70,
   *   maxResults: 5
   * });
   *
   * // Access results by entity ID
   * const similarToFirst = similarMap.get(topPerformers[0].id);
   * ```
   */
  findSimilarBatch(
    referenceEntities: ComparisonEntity[],
    targetEntities: ComparisonEntity[],
    options: Partial<SimilaritySearchOptions> = {}
  ): Map<string, SimilarEntityResult[]> {
    const results = new Map<string, SimilarEntityResult[]>();

    for (const reference of referenceEntities) {
      const similar = this.findSimilar(reference, targetEntities, options);
      results.set(reference.id, similar);
    }

    return results;
  }

  // =====================================================================
  // PRIVATE COMPARISON METHODS
  // Each returns a score from 0-100 based on how similar the metric is
  // =====================================================================

  /**
   * Compare partisan lean
   *
   * Formula: 100 - abs(lean1 - lean2) × 2
   * Entities within ±5 points score 90+
   *
   * @example
   * - Lean 1: +12 (R+12), Lean 2: +10 (R+10) → diff=2 → score=96
   * - Lean 1: +20 (R+20), Lean 2: -10 (D+10) → diff=30 → score=40
   */
  private compareLean(e1: ComparisonEntity, e2: ComparisonEntity): number {
    const diff = Math.abs(e1.politicalProfile.partisanLean - e2.politicalProfile.partisanLean);
    return Math.max(0, 100 - diff * 2);
  }

  /**
   * Compare swing potential
   *
   * Formula: 100 - abs(swing1 - swing2)
   *
   * @example
   * - Swing 1: 75, Swing 2: 80 → diff=5 → score=95
   */
  private compareSwing(e1: ComparisonEntity, e2: ComparisonEntity): number {
    const diff = Math.abs(e1.politicalProfile.swingPotential - e2.politicalProfile.swingPotential);
    return Math.max(0, 100 - diff);
  }

  /**
   * Compare turnout rates
   *
   * Formula: 100 - abs(turnout1 - turnout2) × 2
   *
   * @example
   * - Turnout 1: 68%, Turnout 2: 72% → diff=4 → score=92
   */
  private compareTurnout(e1: ComparisonEntity, e2: ComparisonEntity): number {
    const diff = Math.abs(e1.politicalProfile.avgTurnoutRate - e2.politicalProfile.avgTurnoutRate);
    return Math.max(0, 100 - diff * 2);
  }

  /**
   * Compare median income
   *
   * Formula: 100 - abs(income1 - income2) / 1000
   * Entities within $10K score 90+
   *
   * @example
   * - Income 1: $55K, Income 2: $58K → diff=3000 → score=97
   * - Income 1: $45K, Income 2: $95K → diff=50000 → score=50
   */
  private compareIncome(e1: ComparisonEntity, e2: ComparisonEntity): number {
    const diff = Math.abs(e1.demographics.medianIncome - e2.demographics.medianIncome);
    return Math.max(0, 100 - diff / 1000);
  }

  /**
   * Compare median age
   *
   * Formula: 100 - abs(age1 - age2) × 3
   * Entities within ±3 years score 90+
   *
   * @example
   * - Age 1: 42, Age 2: 44 → diff=2 → score=94
   * - Age 1: 35, Age 2: 55 → diff=20 → score=40
   */
  private compareAge(e1: ComparisonEntity, e2: ComparisonEntity): number {
    const diff = Math.abs(e1.demographics.medianAge - e2.demographics.medianAge);
    return Math.max(0, 100 - diff * 3);
  }

  /**
   * Compare education levels (college %)
   *
   * Formula: 100 - abs(college1 - college2) × 2
   *
   * @example
   * - College 1: 35%, College 2: 40% → diff=5 → score=90
   */
  private compareEducation(e1: ComparisonEntity, e2: ComparisonEntity): number {
    const diff = Math.abs(e1.demographics.collegePct - e2.demographics.collegePct);
    return Math.max(0, 100 - diff * 2);
  }

  /**
   * Compare GOTV priority scores
   *
   * Formula: 100 - abs(gotv1 - gotv2)
   *
   * @example
   * - GOTV 1: 85, GOTV 2: 90 → diff=5 → score=95
   */
  private compareGOTV(e1: ComparisonEntity, e2: ComparisonEntity): number {
    const diff = Math.abs(e1.targetingScores.gotvPriority - e2.targetingScores.gotvPriority);
    return Math.max(0, 100 - diff);
  }

  /**
   * Compare persuasion opportunity scores
   *
   * Formula: 100 - abs(pers1 - pers2)
   *
   * @example
   * - Persuasion 1: 60, Persuasion 2: 65 → diff=5 → score=95
   */
  private comparePersuasion(e1: ComparisonEntity, e2: ComparisonEntity): number {
    const diff = Math.abs(e1.targetingScores.persuasionOpportunity - e2.targetingScores.persuasionOpportunity);
    return Math.max(0, 100 - diff);
  }
}

/**
 * Singleton instance for global access
 */
export const similarityEngine = new SimilarityEngine();
