/**
 * Type definitions for the Similar Precincts Finder feature
 *
 * Supports similarity scoring, search, and clustering of political entities
 * to identify comparable areas for campaign targeting.
 */

import type { ComparisonEntity, BoundaryType } from './types';

/**
 * Similarity score breakdown by category
 *
 * Each component represents a 0-100 similarity score for that dimension.
 * Weighted according to political targeting best practices:
 * - Political Profile: 40% total weight
 * - Demographics: 30% total weight
 * - Targeting Scores: 30% total weight
 */
export interface SimilarityBreakdown {
  // Political Profile (40% total weight)
  partisanLean: number;      // 20% weight - Core political alignment
  swingPotential: number;    // 10% weight - Volatility/persuadability
  turnout: number;           // 10% weight - Voter participation history

  // Demographics (30% total weight)
  income: number;            // 10% weight - Median household income
  age: number;               // 10% weight - Median age
  education: number;         // 10% weight - College degree percentage

  // Targeting (30% total weight)
  gotvPriority: number;      // 15% weight - Get-out-the-vote priority
  persuasionOpportunity: number; // 15% weight - Persuadable voter concentration
}

/**
 * Bonus factors that add to similarity score
 *
 * Applied on top of weighted similarity to reward strategic alignment:
 * - Same Strategy: +10 points (e.g., both GOTV targets)
 * - Same Competitiveness: +5 points (e.g., both toss-ups)
 * - Same Tapestry Segment: +8 points (future: psychographic clustering)
 */
export interface SimilarityBonuses {
  sameStrategy: boolean;       // +10 points if same recommended strategy
  sameCompetitiveness: boolean; // +5 points if same competitiveness level
  sameTapestrySegment: boolean; // +8 points if same dominant Tapestry segment (future)
}

/**
 * Result of similarity calculation between two entities
 *
 * Combines quantitative scoring with qualitative matching factors
 * to provide actionable similarity insights.
 */
export interface SimilarityResult {
  score: number;              // 0-100 overall similarity score (weighted + bonuses)
  factors: string[];          // Human-readable matching factors (e.g., "Similar partisan lean")
  breakdown: SimilarityBreakdown; // Individual component scores
  bonuses: SimilarityBonuses; // Applied bonus factors
}

/**
 * Options for similarity search
 *
 * Controls filtering, scoring, and result limits for finding similar entities.
 */
export interface SimilaritySearchOptions {
  minSimilarity: number;      // Minimum score to include (default: 60)
  maxResults: number;         // Maximum results to return (default: 10)

  // Filtering options
  sameCompetitiveness?: boolean;  // Only include same competitiveness level
  sameStrategy?: boolean;         // Only include same recommended strategy
  populationRange?: {
    min?: number;
    max?: number;
  };

  // Weighting overrides (must sum to 1.0)
  customWeights?: Partial<SimilarityWeights>;
}

/**
 * Weights for similarity scoring
 *
 * Must sum to 1.0. Default weights follow political targeting best practices.
 * Adjust to prioritize specific dimensions (e.g., emphasize demographics over politics).
 */
export interface SimilarityWeights {
  partisanLean: number;
  swingPotential: number;
  turnout: number;
  income: number;
  age: number;
  education: number;
  gotvPriority: number;
  persuasionOpportunity: number;
}

/**
 * Similarity search result with entity
 *
 * Combines the matched entity with its similarity score and optional boundary type.
 */
export interface SimilarEntityResult {
  entity: ComparisonEntity;
  similarity: SimilarityResult;
  boundaryType?: BoundaryType; // Precinct, municipality, or district
}

/**
 * Entity cluster from K-means clustering
 *
 * Groups similar entities together for pattern discovery.
 * Auto-generates descriptive labels based on cluster characteristics.
 */
export interface EntityCluster {
  id: string;                     // Cluster identifier
  label: string;                  // Auto-generated label (e.g., "High-income suburban swing")
  entities: ComparisonEntity[];   // Entities in this cluster
  centroid: number[];             // Feature vector centroid (8D: lean, swing, turnout, income, age, edu, gotv, persuasion)
  characteristics: ClusterCharacteristics; // Summary statistics
}

/**
 * Characteristics describing a cluster
 *
 * Statistical summary of entities in the cluster.
 */
export interface ClusterCharacteristics {
  avgPartisanLean: number;
  avgSwingPotential: number;
  avgGotvPriority: number;
  avgPersuasion: number;
  avgIncome: number;
  avgEducation: number;
  dominantStrategy: string;       // Most common recommended strategy
  dominantCompetitiveness: string; // Most common competitiveness level
  size: number;                   // Number of entities in cluster
}

/**
 * Options for clustering
 *
 * Controls K-means clustering algorithm parameters.
 */
export interface ClusterOptions {
  k: number;                      // Number of clusters (default: 5)
  maxIterations: number;          // Max iterations for K-means (default: 100)
  convergenceThreshold: number;   // Stop when centroids move less than this (default: 0.001)
}
