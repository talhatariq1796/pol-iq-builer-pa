/**
 * Batch Comparison Engine for Multi-Entity Analysis
 *
 * Enables comparing 3-8 entities simultaneously with statistical analysis,
 * rankings, clustering, and strategic insights.
 */

import type { ComparisonEntity } from './types';
import type {
  BatchComparisonResult,
  Rankings,
  RankedEntity,
  PairwiseSimilarity,
  BatchComparisonOptions,
} from './types-batch';
import type { EntityCluster } from './types-similarity';
import { MatrixAnalyzer } from './MatrixAnalyzer';
import { SimilarityEngine } from './SimilarityEngine';
import { ClusterAnalyzer } from './ClusterAnalyzer';
import { ResourceOptimizer } from './ResourceOptimizer';

const DEFAULT_OPTIONS: BatchComparisonOptions = {
  includeSimilarities: false,
  includeClustering: true,
  clusterCount: 3,
  includeCorrelations: true,
};

export class BatchComparisonEngine {
  private matrixAnalyzer: MatrixAnalyzer;
  private similarityEngine: SimilarityEngine;
  private clusterAnalyzer: ClusterAnalyzer;
  private resourceOptimizer: ResourceOptimizer;

  constructor() {
    this.matrixAnalyzer = new MatrixAnalyzer();
    this.similarityEngine = new SimilarityEngine();
    this.clusterAnalyzer = new ClusterAnalyzer();
    this.resourceOptimizer = new ResourceOptimizer();
  }

  /**
   * Compare multiple entities simultaneously
   * @param entities - 3-8 entities to compare
   * @param options - Comparison options
   * @returns Comprehensive batch comparison result
   */
  compareBatch(
    entities: ComparisonEntity[],
    options: Partial<BatchComparisonOptions> = {}
  ): BatchComparisonResult {
    // Validate entity count
    if (entities.length < 3) {
      throw new Error('Batch comparison requires at least 3 entities');
    }
    if (entities.length > 8) {
      throw new Error('Batch comparison supports maximum 8 entities');
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Matrix-level analytics
    const analytics = this.matrixAnalyzer.analyze(entities);

    // Generate rankings
    const rankings = this.generateRankings(entities);

    // Optional clustering
    let clusters: EntityCluster[] = [];
    if (opts.includeClustering) {
      const k = opts.clusterCount || Math.min(3, entities.length);
      clusters = this.clusterAnalyzer.clusterEntities(entities, { k });
    }

    // Optional pairwise similarities
    let pairwiseSimilarities: PairwiseSimilarity[] | undefined;
    if (opts.includeSimilarities) {
      pairwiseSimilarities = this.calculatePairwiseSimilarities(entities);
    }

    return {
      entities,
      analytics,
      rankings,
      clusters,
      pairwiseSimilarities,
      timestamp: new Date(),
    };
  }

  /**
   * Get top entities by a specific metric
   * @param entities - Entities to rank
   * @param metric - Metric to rank by
   * @param topN - Number of top entities (default: 3)
   */
  getTopByMetric(
    entities: ComparisonEntity[],
    metric: 'gotv' | 'persuasion' | 'roi' | 'turnout' | 'swing',
    topN: number = 3
  ): RankedEntity[] {
    let getter: (e: ComparisonEntity) => number;

    switch (metric) {
      case 'gotv':
        getter = e => e.targetingScores.gotvPriority;
        break;
      case 'persuasion':
        getter = e => e.targetingScores.persuasionOpportunity;
        break;
      case 'roi':
        getter = e => this.resourceOptimizer.calculateROI(e).totalScore;
        break;
      case 'turnout':
        getter = e => e.politicalProfile.avgTurnoutRate;
        break;
      case 'swing':
        getter = e => e.politicalProfile.swingPotential;
        break;
      default:
        getter = e => e.targetingScores.combinedScore;
    }

    return this.rankByMetric(entities, getter).slice(0, topN);
  }

  /**
   * Find entities that stand out from the group
   * @param entities - Entities to analyze
   * @returns Entities that are outliers on any major metric
   */
  findOutliers(entities: ComparisonEntity[]): ComparisonEntity[] {
    const analytics = this.matrixAnalyzer.analyze(entities);
    const outlierIds = new Set<string>();

    // Check all metric groups for outliers
    for (const group of [analytics.demographics, analytics.political, analytics.targeting]) {
      for (const [_, stats] of Object.entries(group)) {
        for (const outlier of stats.outliers) {
          outlierIds.add(outlier.entityId);
        }
      }
    }

    return entities.filter(e => outlierIds.has(e.id));
  }

  /**
   * Generate summary insights for the batch
   */
  generateInsights(result: BatchComparisonResult): string[] {
    const insights: string[] = [];

    // Top performers
    const topGOTV = result.rankings.gotvPriority[0];
    const topPersuasion = result.rankings.persuasionOpportunity[0];

    insights.push(
      `Highest GOTV priority: ${topGOTV.entity.name} (score: ${Math.round(topGOTV.value)})`
    );
    insights.push(
      `Best persuasion opportunity: ${topPersuasion.entity.name} (score: ${Math.round(topPersuasion.value)})`
    );

    // Pareto insight
    insights.push(result.analytics.paretoAnalysis.insight);

    // Strong correlations
    for (const corr of result.analytics.correlations.strongPositive.slice(0, 2)) {
      if (corr.interpretation) {
        insights.push(corr.interpretation);
      }
    }

    // Cluster insights
    if (result.clusters.length > 0) {
      for (const cluster of result.clusters) {
        insights.push(
          `Cluster "${cluster.label}": ${cluster.entities.length} entities, avg persuasion ${Math.round(cluster.characteristics.avgPersuasion)}`
        );
      }
    }

    return insights;
  }

  // =====================================================================
  // PRIVATE METHODS
  // =====================================================================

  /**
   * Generate all rankings
   */
  private generateRankings(entities: ComparisonEntity[]): Rankings {
    return {
      gotvPriority: this.rankByMetric(entities, e => e.targetingScores.gotvPriority),
      persuasionOpportunity: this.rankByMetric(entities, e => e.targetingScores.persuasionOpportunity),
      resourceEfficiency: this.rankByMetric(entities, e => this.resourceOptimizer.calculateROI(e).totalScore),
      donorDensity: this.rankByMetric(entities, e => 0), // Placeholder - needs donor data
      overallScore: this.rankByMetric(entities, e => e.targetingScores.combinedScore),
    };
  }

  /**
   * Rank entities by a metric
   */
  private rankByMetric(
    entities: ComparisonEntity[],
    getter: (e: ComparisonEntity) => number
  ): RankedEntity[] {
    return entities
      .map(entity => ({
        entity,
        value: getter(entity),
        rank: 0,
      }))
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
  }

  /**
   * Calculate pairwise similarities between all entities
   */
  private calculatePairwiseSimilarities(entities: ComparisonEntity[]): PairwiseSimilarity[] {
    const similarities: PairwiseSimilarity[] = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const result = this.similarityEngine.calculateSimilarity(entities[i], entities[j]);
        similarities.push({
          entity1Id: entities[i].id,
          entity2Id: entities[j].id,
          similarity: result.score,
          matchingFactors: result.factors,
        });
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity);
  }
}
