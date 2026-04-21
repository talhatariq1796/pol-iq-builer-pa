/**
 * Type definitions for Multi-Area Batch Comparison
 */

import type { ComparisonEntity } from './types';
import type { EntityCluster } from './types-similarity';

/**
 * Result of batch comparison
 */
export interface BatchComparisonResult {
  entities: ComparisonEntity[];
  analytics: MatrixAnalytics;
  rankings: Rankings;
  clusters: EntityCluster[];
  pairwiseSimilarities?: PairwiseSimilarity[];
  timestamp: Date;
}

/**
 * Matrix-level statistical analysis
 */
export interface MatrixAnalytics {
  demographics: MetricGroupAnalysis;
  political: MetricGroupAnalysis;
  targeting: MetricGroupAnalysis;
  correlations: CorrelationMatrix;
  paretoAnalysis: ParetoAnalysis;
}

/**
 * Analysis of a metric group (demographics, political, targeting)
 */
export interface MetricGroupAnalysis {
  [metricName: string]: MetricStats;
}

/**
 * Statistics for a single metric
 */
export interface MetricStats {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  outliers: OutlierEntity[];
}

/**
 * Entity that's an outlier for a metric
 */
export interface OutlierEntity {
  entityId: string;
  entityName: string;
  value: number;
  deviation: number;  // Number of std devs from mean
}

/**
 * Correlation between metrics
 */
export interface CorrelationMatrix {
  pairs: CorrelationPair[];
  strongPositive: CorrelationPair[];  // r > 0.7
  strongNegative: CorrelationPair[];  // r < -0.7
}

/**
 * Single correlation pair
 */
export interface CorrelationPair {
  metric1: string;
  metric2: string;
  correlation: number;
  interpretation?: string;
}

/**
 * Pareto analysis result
 */
export interface ParetoAnalysis {
  metric: string;
  top20Pct: number;           // % of total value in top 20% of entities
  insight: string;
}

/**
 * Rankings by different metrics
 */
export interface Rankings {
  gotvPriority: RankedEntity[];
  persuasionOpportunity: RankedEntity[];
  resourceEfficiency: RankedEntity[];
  donorDensity: RankedEntity[];
  overallScore: RankedEntity[];
}

/**
 * Ranked entity
 */
export interface RankedEntity {
  entity: ComparisonEntity;
  value: number;
  rank: number;
}

/**
 * Pairwise similarity between entities
 */
export interface PairwiseSimilarity {
  entity1Id: string;
  entity2Id: string;
  similarity: number;
  matchingFactors: string[];
}

/**
 * Options for batch comparison
 */
export interface BatchComparisonOptions {
  includeSimilarities: boolean;
  includeClustering: boolean;
  clusterCount?: number;
  includeCorrelations: boolean;
}
