/**
 * Cluster Analyzer for Political Landscape Analysis
 *
 * Uses K-means clustering to group similar political entities (precincts, municipalities)
 * into strategic clusters for batch analysis and pattern identification.
 */

import type { ComparisonEntity } from './types';
import type { EntityCluster, ClusterOptions, ClusterCharacteristics } from './types-similarity';

// Default clustering options
const DEFAULT_OPTIONS: ClusterOptions = {
  k: 5,
  maxIterations: 100,
  convergenceThreshold: 0.001,
};

export class ClusterAnalyzer {
  /**
   * Cluster entities using K-means algorithm
   * @param entities - Entities to cluster
   * @param options - Clustering options (k = number of clusters)
   * @returns Array of clusters with labels and characteristics
   */
  clusterEntities(
    entities: ComparisonEntity[],
    options: Partial<ClusterOptions> = {}
  ): EntityCluster[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (entities.length < opts.k) {
      // Not enough entities for k clusters - return one cluster per entity
      return entities.map((entity, i) => this.createSingleEntityCluster(entity, i));
    }

    // 1. Extract feature vectors
    const features = entities.map(e => this.extractFeatureVector(e));

    // 2. Normalize features
    const normalizedFeatures = this.normalizeFeatures(features);

    // 3. Run K-means
    const assignments = this.kmeans(normalizedFeatures, opts.k, opts.maxIterations, opts.convergenceThreshold);

    // 4. Build clusters
    const clusters: EntityCluster[] = [];
    for (let i = 0; i < opts.k; i++) {
      const clusterEntities = entities.filter((_, idx) => assignments[idx] === i);

      if (clusterEntities.length === 0) continue;

      const centroid = this.calculateCentroid(
        normalizedFeatures.filter((_, idx) => assignments[idx] === i)
      );

      clusters.push({
        id: `cluster-${i + 1}`,
        label: this.generateClusterLabel(clusterEntities),
        entities: clusterEntities,
        centroid,
        characteristics: this.analyzeCluster(clusterEntities),
      });
    }

    return clusters;
  }

  /**
   * Find the best k using elbow method (within-cluster sum of squares)
   * @param entities - Entities to analyze
   * @param maxK - Maximum k to test (default: 10)
   * @returns Recommended k value
   */
  findOptimalK(entities: ComparisonEntity[], maxK: number = 10): number {
    if (entities.length < 3) return 1;

    const features = entities.map(e => this.extractFeatureVector(e));
    const normalized = this.normalizeFeatures(features);

    const wcss: number[] = [];
    const maxTestK = Math.min(maxK, entities.length);

    for (let k = 1; k <= maxTestK; k++) {
      const assignments = this.kmeans(normalized, k, 50, 0.01);
      wcss.push(this.calculateWCSS(normalized, assignments, k));
    }

    // Find elbow point using second derivative
    return this.findElbowPoint(wcss);
  }

  /**
   * Assign a new entity to the closest existing cluster
   * @param entity - New entity to classify
   * @param clusters - Existing clusters
   * @returns Cluster ID and distance
   */
  classifyEntity(
    entity: ComparisonEntity,
    clusters: EntityCluster[]
  ): { clusterId: string; distance: number } {
    const feature = this.extractFeatureVector(entity);

    // Normalize using cluster centroid ranges
    const normalized = this.normalizeFeatureVector(feature, clusters);

    let minDistance = Infinity;
    let closestCluster = clusters[0].id;

    for (const cluster of clusters) {
      const distance = this.euclideanDistance(normalized, cluster.centroid);
      if (distance < minDistance) {
        minDistance = distance;
        closestCluster = cluster.id;
      }
    }

    return { clusterId: closestCluster, distance: minDistance };
  }

  // =====================================================================
  // PRIVATE K-MEANS IMPLEMENTATION
  // =====================================================================

  /**
   * Extract 8-dimensional feature vector for clustering
   */
  private extractFeatureVector(entity: ComparisonEntity): number[] {
    return [
      entity.politicalProfile.partisanLean,
      entity.politicalProfile.swingPotential,
      entity.politicalProfile.avgTurnoutRate,
      entity.demographics.medianIncome / 1000, // Scale income to thousands
      entity.demographics.medianAge,
      entity.demographics.collegePct,
      entity.targetingScores.gotvPriority,
      entity.targetingScores.persuasionOpportunity,
    ];
  }

  /**
   * Normalize features to [0, 1] range
   */
  private normalizeFeatures(features: number[][]): number[][] {
    if (features.length === 0) return [];

    const numFeatures = features[0].length;
    const mins: number[] = new Array(numFeatures).fill(Infinity);
    const maxs: number[] = new Array(numFeatures).fill(-Infinity);

    // Find min/max for each feature
    for (const row of features) {
      for (let i = 0; i < numFeatures; i++) {
        mins[i] = Math.min(mins[i], row[i]);
        maxs[i] = Math.max(maxs[i], row[i]);
      }
    }

    // Normalize
    return features.map(row =>
      row.map((val, i) => {
        const range = maxs[i] - mins[i];
        return range > 0 ? (val - mins[i]) / range : 0.5;
      })
    );
  }

  /**
   * Normalize a single feature vector using cluster statistics
   */
  private normalizeFeatureVector(feature: number[], clusters: EntityCluster[]): number[] {
    // Use first cluster's centroid as reference (assumes normalized already)
    return feature.map((val, i) => {
      // Find min/max across all cluster centroids
      const centroidValues = clusters.map(c => c.centroid[i]);
      const min = Math.min(...centroidValues) - 0.5;
      const max = Math.max(...centroidValues) + 0.5;
      return (val - min) / (max - min);
    });
  }

  /**
   * K-means algorithm
   * @returns Assignment array (index = entity index, value = cluster index)
   */
  private kmeans(
    features: number[][],
    k: number,
    maxIterations: number,
    convergenceThreshold: number
  ): number[] {
    const n = features.length;
    const numFeatures = features[0].length;

    // Initialize centroids using k-means++
    const centroids = this.initializeCentroids(features, k);

    let assignments = new Array(n).fill(0);
    let prevCentroids = centroids.map(c => [...c]);

    for (let iter = 0; iter < maxIterations; iter++) {
      // Assign points to nearest centroid
      assignments = features.map(f => this.findNearestCentroid(f, centroids));

      // Update centroids
      for (let i = 0; i < k; i++) {
        const clusterPoints = features.filter((_, idx) => assignments[idx] === i);
        if (clusterPoints.length > 0) {
          centroids[i] = this.calculateCentroid(clusterPoints);
        }
      }

      // Check convergence
      let maxMove = 0;
      for (let i = 0; i < k; i++) {
        const move = this.euclideanDistance(centroids[i], prevCentroids[i]);
        maxMove = Math.max(maxMove, move);
      }

      if (maxMove < convergenceThreshold) {
        break;
      }

      prevCentroids = centroids.map(c => [...c]);
    }

    return assignments;
  }

  /**
   * K-means++ initialization for better starting centroids
   */
  private initializeCentroids(features: number[][], k: number): number[][] {
    const centroids: number[][] = [];

    // Choose first centroid randomly
    const firstIdx = Math.floor(Math.random() * features.length);
    centroids.push([...features[firstIdx]]);

    // Choose remaining centroids using weighted probability
    for (let i = 1; i < k; i++) {
      const distances = features.map(f => {
        let minDist = Infinity;
        for (const c of centroids) {
          minDist = Math.min(minDist, this.euclideanDistance(f, c));
        }
        return minDist * minDist; // Square for probability weighting
      });

      const totalDist = distances.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalDist;

      for (let j = 0; j < features.length; j++) {
        random -= distances[j];
        if (random <= 0) {
          centroids.push([...features[j]]);
          break;
        }
      }
    }

    return centroids;
  }

  /**
   * Find the nearest centroid for a point
   */
  private findNearestCentroid(feature: number[], centroids: number[][]): number {
    let minDist = Infinity;
    let nearest = 0;

    for (let i = 0; i < centroids.length; i++) {
      const dist = this.euclideanDistance(feature, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }

    return nearest;
  }

  /**
   * Calculate centroid of a set of points
   */
  private calculateCentroid(points: number[][]): number[] {
    if (points.length === 0) return [];

    const numFeatures = points[0].length;
    const centroid = new Array(numFeatures).fill(0);

    for (const point of points) {
      for (let i = 0; i < numFeatures; i++) {
        centroid[i] += point[i];
      }
    }

    return centroid.map(sum => sum / points.length);
  }

  /**
   * Euclidean distance between two points
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate Within-Cluster Sum of Squares
   */
  private calculateWCSS(features: number[][], assignments: number[], k: number): number {
    const centroids: number[][] = [];

    for (let i = 0; i < k; i++) {
      const clusterPoints = features.filter((_, idx) => assignments[idx] === i);
      if (clusterPoints.length > 0) {
        centroids.push(this.calculateCentroid(clusterPoints));
      } else {
        centroids.push(new Array(features[0].length).fill(0));
      }
    }

    let wcss = 0;
    for (let i = 0; i < features.length; i++) {
      const clusterId = assignments[i];
      wcss += this.euclideanDistance(features[i], centroids[clusterId]) ** 2;
    }

    return wcss;
  }

  /**
   * Find elbow point using second derivative
   */
  private findElbowPoint(wcss: number[]): number {
    if (wcss.length < 3) return 1;

    // Calculate second derivative
    const secondDerivative: number[] = [];
    for (let i = 1; i < wcss.length - 1; i++) {
      secondDerivative.push(wcss[i + 1] - 2 * wcss[i] + wcss[i - 1]);
    }

    // Find maximum second derivative (most abrupt change)
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < secondDerivative.length; i++) {
      if (secondDerivative[i] > maxVal) {
        maxVal = secondDerivative[i];
        maxIdx = i;
      }
    }

    return maxIdx + 2; // +2 because second derivative starts at k=2
  }

  // =====================================================================
  // CLUSTER LABELING AND ANALYSIS
  // =====================================================================

  /**
   * Generate human-readable label for a cluster
   */
  private generateClusterLabel(entities: ComparisonEntity[]): string {
    const characteristics = this.analyzeCluster(entities);

    const parts: string[] = [];

    // Income descriptor
    if (characteristics.avgIncome > 80) {
      parts.push('High-income');
    } else if (characteristics.avgIncome > 50) {
      parts.push('Middle-income');
    } else {
      parts.push('Lower-income');
    }

    // Education descriptor (if notable)
    if (characteristics.avgEducation > 55) {
      parts.push('college-educated');
    }

    // Political lean descriptor
    if (Math.abs(characteristics.avgPartisanLean) < 5) {
      parts.push('swing');
    } else if (characteristics.avgPartisanLean > 10) {
      parts.push('Democratic');
    } else if (characteristics.avgPartisanLean < -10) {
      parts.push('Republican');
    } else if (characteristics.avgPartisanLean > 0) {
      parts.push('lean-Democratic');
    } else {
      parts.push('lean-Republican');
    }

    // Strategy descriptor
    if (characteristics.dominantStrategy === 'Battleground') {
      parts.push('battleground');
    } else if (characteristics.dominantStrategy === 'Base Mobilization') {
      parts.push('base');
    } else if (characteristics.dominantStrategy === 'Persuasion Target') {
      parts.push('persuasion');
    }

    parts.push('precincts');

    return parts.join(' ');
  }

  /**
   * Analyze cluster characteristics
   */
  private analyzeCluster(entities: ComparisonEntity[]): ClusterCharacteristics {
    if (entities.length === 0) {
      return {
        avgPartisanLean: 0,
        avgSwingPotential: 0,
        avgGotvPriority: 0,
        avgPersuasion: 0,
        avgIncome: 0,
        avgEducation: 0,
        dominantStrategy: 'Low Priority',
        dominantCompetitiveness: 'tossup',
        size: 0,
      };
    }

    // Calculate averages
    const avgPartisanLean = entities.reduce((sum, e) =>
      sum + e.politicalProfile.partisanLean, 0) / entities.length;

    const avgSwingPotential = entities.reduce((sum, e) =>
      sum + e.politicalProfile.swingPotential, 0) / entities.length;

    const avgGotvPriority = entities.reduce((sum, e) =>
      sum + e.targetingScores.gotvPriority, 0) / entities.length;

    const avgPersuasion = entities.reduce((sum, e) =>
      sum + e.targetingScores.persuasionOpportunity, 0) / entities.length;

    const avgIncome = entities.reduce((sum, e) =>
      sum + e.demographics.medianIncome, 0) / entities.length / 1000;

    const avgEducation = entities.reduce((sum, e) =>
      sum + e.demographics.collegePct, 0) / entities.length;

    // Find dominant strategy
    const strategyCounts = new Map<string, number>();
    for (const e of entities) {
      const strategy = e.targetingScores.recommendedStrategy;
      strategyCounts.set(strategy, (strategyCounts.get(strategy) || 0) + 1);
    }
    let dominantStrategy = 'Low Priority';
    let maxCount = 0;
    const strategyEntries = Array.from(strategyCounts.entries());
    for (const [strategy, count] of strategyEntries) {
      if (count > maxCount) {
        maxCount = count;
        dominantStrategy = strategy;
      }
    }

    // Find dominant competitiveness
    const compCounts = new Map<string, number>();
    for (const e of entities) {
      const comp = e.politicalProfile.competitiveness;
      compCounts.set(comp, (compCounts.get(comp) || 0) + 1);
    }
    let dominantCompetitiveness = 'tossup';
    maxCount = 0;
    const compEntries = Array.from(compCounts.entries());
    for (const [comp, count] of compEntries) {
      if (count > maxCount) {
        maxCount = count;
        dominantCompetitiveness = comp;
      }
    }

    return {
      avgPartisanLean,
      avgSwingPotential,
      avgGotvPriority,
      avgPersuasion,
      avgIncome,
      avgEducation,
      dominantStrategy,
      dominantCompetitiveness,
      size: entities.length,
    };
  }

  /**
   * Create a cluster for a single entity
   */
  private createSingleEntityCluster(entity: ComparisonEntity, index: number): EntityCluster {
    return {
      id: `cluster-${index + 1}`,
      label: entity.name,
      entities: [entity],
      centroid: this.extractFeatureVector(entity),
      characteristics: this.analyzeCluster([entity]),
    };
  }
}
