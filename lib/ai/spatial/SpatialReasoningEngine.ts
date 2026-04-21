/**
 * Spatial Reasoning Engine
 *
 * Intelligent spatial analysis of precinct selections.
 * Detects clusters, identifies outliers, suggests optimizations.
 *
 * Key Features:
 * - DBSCAN clustering algorithm for geographic grouping
 * - Outlier detection with efficiency impact analysis
 * - "Suggest nearby precincts" capability
 * - Route efficiency optimization
 *
 * Implements Principle 16: Spatial Reasoning from AI-CONTEXT-AWARENESS-PLAN.md
 */

import type { DensityType } from '@/lib/canvassing/types';
import type {
  SpatialAnalysis,
  SpatialPrecinctInput,
  SpatialAnalysisOptions,
  PrecinctCluster,
  ClusterMetrics,
  SpatialOutlier,
  OutlierReason,
  OutlierImpact,
  SpatialSuggestion,
  SuggestionType,
  NearbyPrecinct,
  EfficiencyAnalysis,
  EfficiencyMetrics,
  SpatialSummary,
  DBSCANParams,
} from './types';

// Default analysis options
const DEFAULT_OPTIONS: Required<SpatialAnalysisOptions> = {
  clusterDistanceThreshold: 3, // km
  minClusterSize: 2,
  outlierDistanceThreshold: 5, // km
  minEfficiencyForInclusion: 15, // doors/hour
  searchRadiusKm: 5,
  maxNearbyResults: 10,
  targetDoorsPerHour: 35,
  contactRate: 0.35,
};

// Time estimates (minutes per door based on density)
const MINUTES_PER_DOOR: Record<DensityType, number> = {
  urban: 2.0,
  suburban: 1.5,
  rural: 2.5,
};

// Travel time estimates (minutes per km based on density)
const TRAVEL_MINUTES_PER_KM: Record<DensityType, number> = {
  urban: 12,
  suburban: 10,
  rural: 15,
};

/**
 * Spatial Reasoning Engine
 *
 * Singleton pattern for consistent analysis across the application.
 */
export class SpatialReasoningEngine {
  private static instance: SpatialReasoningEngine;
  private allPrecincts: Map<string, SpatialPrecinctInput> = new Map();

  private constructor() {}

  static getInstance(): SpatialReasoningEngine {
    if (!SpatialReasoningEngine.instance) {
      SpatialReasoningEngine.instance = new SpatialReasoningEngine();
    }
    return SpatialReasoningEngine.instance;
  }

  /**
   * Load all available precincts for nearby suggestions
   */
  loadAllPrecincts(precincts: SpatialPrecinctInput[]): void {
    this.allPrecincts.clear();
    precincts.forEach(p => this.allPrecincts.set(p.precinctId, p));
  }

  /**
   * Main entry point: Analyze a selection of precincts
   */
  analyze(
    selectedPrecincts: SpatialPrecinctInput[],
    options: SpatialAnalysisOptions = {}
  ): SpatialAnalysis {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Handle edge cases
    if (selectedPrecincts.length === 0) {
      return this.emptyAnalysis();
    }

    if (selectedPrecincts.length === 1) {
      return this.singlePrecinctAnalysis(selectedPrecincts[0], opts);
    }

    // Step 1: Cluster analysis using DBSCAN
    const { clusters, noise } = this.dbscan(selectedPrecincts, {
      epsilon: opts.clusterDistanceThreshold,
      minPoints: opts.minClusterSize,
    });

    // Step 2: Build cluster objects with metrics
    const clusterObjects = this.buildClusters(clusters, selectedPrecincts);

    // Step 3: Identify outliers
    const outliers = this.identifyOutliers(noise, clusterObjects, selectedPrecincts, opts);

    // Step 4: Calculate efficiency metrics
    const efficiency = this.calculateEfficiency(selectedPrecincts, clusterObjects, outliers, opts);

    // Step 5: Find nearby precincts that could be added
    const nearbyOpportunities = this.findNearbyOpportunities(
      selectedPrecincts,
      clusterObjects,
      opts
    );

    // Step 6: Generate suggestions
    const suggestions = this.generateSuggestions(
      clusterObjects,
      outliers,
      nearbyOpportunities,
      efficiency,
      opts
    );

    // Step 7: Build human-readable summary
    const summary = this.buildSummary(clusterObjects, outliers, efficiency, suggestions);

    return {
      inputPrecincts: selectedPrecincts.length,
      analyzedAt: new Date(),
      clusters: clusterObjects,
      outliers,
      efficiency,
      suggestions,
      nearbyOpportunities,
      summary,
    };
  }

  /**
   * DBSCAN Clustering Algorithm
   *
   * Density-Based Spatial Clustering of Applications with Noise
   * Groups precincts based on geographic proximity.
   */
  private dbscan(
    precincts: SpatialPrecinctInput[],
    params: DBSCANParams
  ): { clusters: SpatialPrecinctInput[][]; noise: SpatialPrecinctInput[] } {
    const { epsilon, minPoints } = params;
    const visited = new Set<string>();
    const clustered = new Set<string>();
    const clusters: SpatialPrecinctInput[][] = [];
    const noise: SpatialPrecinctInput[] = [];

    for (const precinct of precincts) {
      if (visited.has(precinct.precinctId)) continue;
      visited.add(precinct.precinctId);

      const neighbors = this.getNeighbors(precinct, precincts, epsilon);

      if (neighbors.length < minPoints) {
        // Mark as noise (potential outlier)
        noise.push(precinct);
      } else {
        // Start a new cluster
        const cluster: SpatialPrecinctInput[] = [];
        this.expandCluster(precinct, neighbors, cluster, precincts, epsilon, minPoints, visited, clustered);
        clusters.push(cluster);
      }
    }

    return { clusters, noise };
  }

  /**
   * Get all precincts within epsilon distance
   */
  private getNeighbors(
    precinct: SpatialPrecinctInput,
    allPrecincts: SpatialPrecinctInput[],
    epsilon: number
  ): SpatialPrecinctInput[] {
    return allPrecincts.filter(p => {
      if (p.precinctId === precinct.precinctId) return false;
      const dist = this.haversineDistance(precinct.centroid, p.centroid);
      return dist <= epsilon;
    });
  }

  /**
   * Expand cluster by adding all reachable points
   */
  private expandCluster(
    precinct: SpatialPrecinctInput,
    neighbors: SpatialPrecinctInput[],
    cluster: SpatialPrecinctInput[],
    allPrecincts: SpatialPrecinctInput[],
    epsilon: number,
    minPoints: number,
    visited: Set<string>,
    clustered: Set<string>
  ): void {
    cluster.push(precinct);
    clustered.add(precinct.precinctId);

    const queue = [...neighbors];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (!visited.has(current.precinctId)) {
        visited.add(current.precinctId);
        const currentNeighbors = this.getNeighbors(current, allPrecincts, epsilon);

        if (currentNeighbors.length >= minPoints) {
          // Add new neighbors to queue
          for (const neighbor of currentNeighbors) {
            if (!visited.has(neighbor.precinctId)) {
              queue.push(neighbor);
            }
          }
        }
      }

      if (!clustered.has(current.precinctId)) {
        cluster.push(current);
        clustered.add(current.precinctId);
      }
    }
  }

  /**
   * Build cluster objects with metrics
   */
  private buildClusters(
    clusterArrays: SpatialPrecinctInput[][],
    allSelected: SpatialPrecinctInput[]
  ): PrecinctCluster[] {
    return clusterArrays.map((precincts, index) => {
      const precinctIds = precincts.map(p => p.precinctId);
      const centroid = this.calculateCentroid(precincts);
      const boundingBox = this.calculateBoundingBox(precincts);
      const metrics = this.calculateClusterMetrics(precincts);

      // Generate cluster name based on dominant jurisdiction
      const jurisdictions = precincts.map(p => p.jurisdiction);
      const dominantJurisdiction = this.mode(jurisdictions);
      const name = `${dominantJurisdiction} Cluster ${index + 1}`;

      return {
        id: `cluster-${index + 1}`,
        name,
        precinctIds,
        centroid,
        boundingBox,
        metrics,
      };
    });
  }

  /**
   * Calculate metrics for a cluster
   */
  private calculateClusterMetrics(precincts: SpatialPrecinctInput[]): ClusterMetrics {
    const totalDoors = precincts.reduce((sum, p) => sum + p.estimatedDoors, 0);
    const totalPrecincts = precincts.length;

    // Calculate dominant density
    const densities = precincts.map(p => p.density);
    const dominantDensity = this.mode(densities) as DensityType;

    // Estimate time
    const canvassingMinutes = precincts.reduce(
      (sum, p) => sum + p.estimatedDoors * MINUTES_PER_DOOR[p.density],
      0
    );
    const travelMinutes = this.estimateTravelTime(precincts);
    const totalMinutes = canvassingMinutes + travelMinutes;
    const estimatedHours = totalMinutes / 60;
    const doorsPerHour = totalMinutes > 0 ? (totalDoors / totalMinutes) * 60 : 0;

    // Calculate averages
    const avgGotvPriority = this.average(precincts.map(p => p.gotvPriority));
    const avgPersuasionOpportunity = this.average(precincts.map(p => p.persuasionOpportunity));
    const avgSwingPotential = this.average(precincts.map(p => p.swingPotential));

    // Calculate compactness (ratio of actual area to bounding box area)
    const maxInternalDistance = this.calculateMaxInternalDistance(precincts);
    const compactness = this.calculateCompactness(precincts);

    return {
      totalDoors,
      totalPrecincts,
      estimatedHours,
      doorsPerHour,
      avgGotvPriority,
      avgPersuasionOpportunity,
      avgSwingPotential,
      dominantDensity,
      compactness,
      maxInternalDistance,
    };
  }

  /**
   * Identify outliers and analyze their impact
   */
  private identifyOutliers(
    noisePrecincts: SpatialPrecinctInput[],
    clusters: PrecinctCluster[],
    allSelected: SpatialPrecinctInput[],
    opts: Required<SpatialAnalysisOptions>
  ): SpatialOutlier[] {
    return noisePrecincts.map(precinct => {
      // Find nearest cluster
      let nearestCluster: PrecinctCluster | null = null;
      let nearestDistance = Infinity;

      for (const cluster of clusters) {
        const dist = this.haversineDistance(precinct.centroid, cluster.centroid);
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestCluster = cluster;
        }
      }

      // Determine reason for being an outlier
      const reason = this.determineOutlierReason(precinct, nearestDistance, clusters, opts);

      // Calculate impact of including/excluding
      const impactAnalysis = this.analyzeOutlierImpact(precinct, nearestDistance, opts);

      return {
        precinctId: precinct.precinctId,
        precinctName: precinct.precinctName,
        centroid: precinct.centroid,
        reason,
        distanceToNearestCluster: nearestDistance,
        nearestClusterId: nearestCluster?.id || 'none',
        impactAnalysis,
      };
    });
  }

  /**
   * Determine why a precinct is an outlier
   */
  private determineOutlierReason(
    precinct: SpatialPrecinctInput,
    distanceToCluster: number,
    clusters: PrecinctCluster[],
    opts: Required<SpatialAnalysisOptions>
  ): OutlierReason {
    // Check if isolated (far from everything)
    if (distanceToCluster > opts.outlierDistanceThreshold) {
      return 'isolated';
    }

    // Check if between clusters
    if (clusters.length >= 2) {
      const distances = clusters.map(c =>
        this.haversineDistance(precinct.centroid, c.centroid)
      );
      const sorted = [...distances].sort((a, b) => a - b);
      if (sorted[0] > opts.clusterDistanceThreshold && sorted[1] < opts.outlierDistanceThreshold) {
        return 'between_clusters';
      }
    }

    // Check efficiency
    const travelTime = distanceToCluster * TRAVEL_MINUTES_PER_KM[precinct.density];
    const canvassingTime = precinct.estimatedDoors * MINUTES_PER_DOOR[precinct.density];
    const doorsPerHour = (precinct.estimatedDoors / (travelTime + canvassingTime)) * 60;
    if (doorsPerHour < opts.minEfficiencyForInclusion) {
      return 'low_efficiency';
    }

    // Check density mismatch
    if (clusters.length > 0) {
      const nearestCluster = clusters.reduce((nearest, c) => {
        const dist = this.haversineDistance(precinct.centroid, c.centroid);
        const nearestDist = this.haversineDistance(precinct.centroid, nearest.centroid);
        return dist < nearestDist ? c : nearest;
      });
      if (nearestCluster.metrics.dominantDensity !== precinct.density) {
        return 'density_mismatch';
      }
    }

    return 'isolated'; // Default
  }

  /**
   * Analyze impact of including/excluding an outlier
   */
  private analyzeOutlierImpact(
    precinct: SpatialPrecinctInput,
    distanceToCluster: number,
    opts: Required<SpatialAnalysisOptions>
  ): OutlierImpact {
    const travelMinutes = distanceToCluster * 2 * TRAVEL_MINUTES_PER_KM[precinct.density]; // Round trip
    const canvassingMinutes = precinct.estimatedDoors * MINUTES_PER_DOOR[precinct.density];
    const totalMinutes = travelMinutes + canvassingMinutes;
    const doorsPerHour = (precinct.estimatedDoors / totalMinutes) * 60;
    const efficiencyDelta = doorsPerHour - opts.targetDoorsPerHour;

    // Recommendation based on efficiency
    let recommendation: 'keep' | 'drop' | 'consider';
    if (efficiencyDelta >= -5) {
      recommendation = 'keep';
    } else if (efficiencyDelta < -15) {
      recommendation = 'drop';
    } else {
      recommendation = 'consider';
    }

    // Find alternative precincts nearby (if we have all precincts loaded)
    const alternativePrecincts = this.findAlternatives(precinct, opts);

    return {
      additionalTravelMinutes: travelMinutes,
      additionalDoors: precinct.estimatedDoors,
      efficiencyDelta,
      recommendation,
      alternativePrecincts,
    };
  }

  /**
   * Find alternative precincts that would be more efficient
   */
  private findAlternatives(
    outlier: SpatialPrecinctInput,
    opts: Required<SpatialAnalysisOptions>
  ): string[] {
    const alternatives: string[] = [];

    this.allPrecincts.forEach((precinct, id) => {
      if (id === outlier.precinctId) return;

      const dist = this.haversineDistance(outlier.centroid, precinct.centroid);
      if (dist <= opts.searchRadiusKm && precinct.estimatedDoors > outlier.estimatedDoors) {
        alternatives.push(id);
      }
    });

    return alternatives.slice(0, 3);
  }

  /**
   * Find nearby precincts that could be added
   */
  private findNearbyOpportunities(
    selected: SpatialPrecinctInput[],
    clusters: PrecinctCluster[],
    opts: Required<SpatialAnalysisOptions>
  ): NearbyPrecinct[] {
    const selectedIds = new Set(selected.map(p => p.precinctId));
    const opportunities: NearbyPrecinct[] = [];

    this.allPrecincts.forEach((precinct, id) => {
      if (selectedIds.has(id)) return;

      // Find nearest selected precinct
      let nearestSelected: SpatialPrecinctInput | null = null;
      let nearestDistance = Infinity;

      for (const sel of selected) {
        const dist = this.haversineDistance(precinct.centroid, sel.centroid);
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestSelected = sel;
        }
      }

      if (nearestDistance > opts.searchRadiusKm || !nearestSelected) return;

      // Check if this would connect clusters
      const wouldConnectClusters = this.wouldConnectClusters(precinct, clusters);

      // Calculate addition impact
      const travelMinutes = nearestDistance * TRAVEL_MINUTES_PER_KM[precinct.density];
      const canvassingMinutes = precinct.estimatedDoors * MINUTES_PER_DOOR[precinct.density];
      const totalMinutes = travelMinutes + canvassingMinutes;
      const doorsPerHour = (precinct.estimatedDoors / totalMinutes) * 60;
      const efficiencyChange = doorsPerHour - opts.targetDoorsPerHour;

      opportunities.push({
        precinctId: precinct.precinctId,
        precinctName: precinct.precinctName,
        centroid: precinct.centroid,
        distanceToNearestSelected: nearestDistance,
        nearestSelectedId: nearestSelected.precinctId,
        wouldConnectClusters,
        metrics: {
          doors: precinct.estimatedDoors,
          gotvPriority: precinct.gotvPriority,
          persuasionOpportunity: precinct.persuasionOpportunity,
          swingPotential: precinct.swingPotential,
          density: precinct.density,
        },
        additionImpact: {
          efficiencyChange,
          additionalDoors: precinct.estimatedDoors,
          additionalMinutes: totalMinutes,
        },
      });
    });

    // Sort by value: prioritize cluster connectors and high-value precincts
    return opportunities
      .sort((a, b) => {
        // Prioritize cluster connectors
        if (a.wouldConnectClusters && !b.wouldConnectClusters) return -1;
        if (!a.wouldConnectClusters && b.wouldConnectClusters) return 1;

        // Then by efficiency
        return b.additionImpact.efficiencyChange - a.additionImpact.efficiencyChange;
      })
      .slice(0, opts.maxNearbyResults);
  }

  /**
   * Check if adding a precinct would connect two clusters
   */
  private wouldConnectClusters(
    precinct: SpatialPrecinctInput,
    clusters: PrecinctCluster[]
  ): boolean {
    if (clusters.length < 2) return false;

    const threshold = 3; // km
    let nearbyClusterCount = 0;

    for (const cluster of clusters) {
      const dist = this.haversineDistance(precinct.centroid, cluster.centroid);
      if (dist <= threshold + cluster.metrics.maxInternalDistance / 2) {
        nearbyClusterCount++;
      }
    }

    return nearbyClusterCount >= 2;
  }

  /**
   * Calculate efficiency metrics
   */
  private calculateEfficiency(
    selected: SpatialPrecinctInput[],
    clusters: PrecinctCluster[],
    outliers: SpatialOutlier[],
    opts: Required<SpatialAnalysisOptions>
  ): EfficiencyAnalysis {
    // As-selected efficiency
    const asSelected = this.calculateEfficiencyMetrics(selected, opts);

    // Optimized (without outliers marked as 'drop')
    const optimizedPrecincts = selected.filter(p => {
      const outlier = outliers.find(o => o.precinctId === p.precinctId);
      return !outlier || outlier.impactAnalysis.recommendation !== 'drop';
    });
    const optimized = this.calculateEfficiencyMetrics(optimizedPrecincts, opts);

    // By cluster
    const byCluster: Record<string, EfficiencyMetrics> = {};
    for (const cluster of clusters) {
      const clusterPrecincts = selected.filter(p => cluster.precinctIds.includes(p.precinctId));
      byCluster[cluster.id] = this.calculateEfficiencyMetrics(clusterPrecincts, opts);
    }

    return { asSelected, optimized, byCluster };
  }

  /**
   * Calculate efficiency metrics for a set of precincts
   */
  private calculateEfficiencyMetrics(
    precincts: SpatialPrecinctInput[],
    opts: Required<SpatialAnalysisOptions>
  ): EfficiencyMetrics {
    if (precincts.length === 0) {
      return {
        totalDoors: 0,
        totalHours: 0,
        doorsPerHour: 0,
        totalTravelKm: 0,
        avgTravelBetweenStops: 0,
        estimatedContacts: 0,
        contactsPerHour: 0,
      };
    }

    const totalDoors = precincts.reduce((sum, p) => sum + p.estimatedDoors, 0);
    const canvassingMinutes = precincts.reduce(
      (sum, p) => sum + p.estimatedDoors * MINUTES_PER_DOOR[p.density],
      0
    );
    const travelMinutes = this.estimateTravelTime(precincts);
    const totalMinutes = canvassingMinutes + travelMinutes;
    const totalHours = totalMinutes / 60;
    const doorsPerHour = totalHours > 0 ? totalDoors / totalHours : 0;

    // Estimate travel distance
    const totalTravelKm = this.estimateTotalTravelDistance(precincts);
    const avgTravelBetweenStops = precincts.length > 1 ? totalTravelKm / (precincts.length - 1) : 0;

    const estimatedContacts = Math.round(totalDoors * opts.contactRate);
    const contactsPerHour = totalHours > 0 ? estimatedContacts / totalHours : 0;

    return {
      totalDoors,
      totalHours,
      doorsPerHour,
      totalTravelKm,
      avgTravelBetweenStops,
      estimatedContacts,
      contactsPerHour,
    };
  }

  /**
   * Generate suggestions for improvement
   */
  private generateSuggestions(
    clusters: PrecinctCluster[],
    outliers: SpatialOutlier[],
    nearby: NearbyPrecinct[],
    efficiency: EfficiencyAnalysis,
    opts: Required<SpatialAnalysisOptions>
  ): SpatialSuggestion[] {
    const suggestions: SpatialSuggestion[] = [];

    // Suggest dropping outliers
    for (const outlier of outliers) {
      if (outlier.impactAnalysis.recommendation === 'drop') {
        suggestions.push({
          id: `drop-${outlier.precinctId}`,
          type: 'drop_outlier',
          priority: 'high',
          title: `Drop ${outlier.precinctName}`,
          description: `${outlier.precinctName} is ${outlier.reason === 'isolated' ? 'isolated' : 'inefficient'} (${outlier.distanceToNearestCluster.toFixed(1)}km from nearest cluster, ${outlier.impactAnalysis.additionalDoors} doors).`,
          impact: {
            efficiencyChange: Math.abs(outlier.impactAnalysis.efficiencyDelta),
            doorsChange: -outlier.impactAnalysis.additionalDoors,
            timeChange: -outlier.impactAnalysis.additionalTravelMinutes / 60,
          },
          action: {
            type: 'remove',
            precinctIds: [outlier.precinctId],
          },
        });
      }
    }

    // Suggest adding connector precincts
    const connectors = nearby.filter(p => p.wouldConnectClusters);
    if (connectors.length > 0 && clusters.length >= 2) {
      const best = connectors[0];
      suggestions.push({
        id: `add-connector-${best.precinctId}`,
        type: 'add_connector',
        priority: 'high',
        title: `Add ${best.precinctName} to connect clusters`,
        description: `Adding ${best.precinctName} would connect ${clusters.length} clusters into a single efficient route. +${best.metrics.doors} doors.`,
        impact: {
          efficiencyChange: best.additionImpact.efficiencyChange,
          doorsChange: best.metrics.doors,
          timeChange: best.additionImpact.additionalMinutes / 60,
        },
        action: {
          type: 'add',
          precinctIds: [best.precinctId],
        },
      });
    }

    // Suggest adding high-value nearby precincts
    const highValue = nearby
      .filter(p => !p.wouldConnectClusters && p.additionImpact.efficiencyChange > 0)
      .slice(0, 3);

    for (const precinct of highValue) {
      suggestions.push({
        id: `add-nearby-${precinct.precinctId}`,
        type: 'add_nearby',
        priority: 'medium',
        title: `Add ${precinct.precinctName}`,
        description: `${precinct.precinctName} is ${precinct.distanceToNearestSelected.toFixed(1)}km away with ${precinct.metrics.doors} doors and GOTV score ${precinct.metrics.gotvPriority}.`,
        impact: {
          efficiencyChange: precinct.additionImpact.efficiencyChange,
          doorsChange: precinct.metrics.doors,
          timeChange: precinct.additionImpact.additionalMinutes / 60,
        },
        action: {
          type: 'add',
          precinctIds: [precinct.precinctId],
        },
      });
    }

    // Suggest splitting clusters for separate shifts
    if (clusters.length >= 2) {
      const clusterEfficiencies = clusters.map(c => efficiency.byCluster[c.id]);
      const totalHours = clusterEfficiencies.reduce((sum, e) => sum + e.totalHours, 0);

      if (totalHours > 8) {
        suggestions.push({
          id: 'split-shifts',
          type: 'split_clusters',
          priority: 'medium',
          title: `Split into ${clusters.length} shifts`,
          description: `Your ${clusters.length} clusters could be canvassed as separate shifts: ${clusters.map((c, i) => `${c.name} (${clusterEfficiencies[i]?.totalHours.toFixed(1)}h)`).join(', ')}.`,
          impact: {
            efficiencyChange: 0,
            doorsChange: 0,
            timeChange: 0,
          },
          action: {
            type: 'split',
            clusterIds: clusters.map(c => c.id),
          },
        });
      }
    }

    // Sort by priority and impact
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return Math.abs(b.impact.efficiencyChange) - Math.abs(a.impact.efficiencyChange);
    });
  }

  /**
   * Build human-readable summary
   */
  private buildSummary(
    clusters: PrecinctCluster[],
    outliers: SpatialOutlier[],
    efficiency: EfficiencyAnalysis,
    suggestions: SpatialSuggestion[]
  ): SpatialSummary {
    // Cluster description
    let clusterDescription: string;
    if (clusters.length === 0) {
      clusterDescription = 'Your precincts are scattered and don\'t form natural clusters.';
    } else if (clusters.length === 1) {
      clusterDescription = `Your precincts form a single cluster around ${clusters[0].name} (${clusters[0].metrics.totalDoors} doors).`;
    } else {
      clusterDescription = `Your precincts form ${clusters.length} clusters: ${clusters.map(c => `${c.name} (${c.metrics.totalDoors} doors)`).join(', ')}.`;
    }

    // Outlier description
    let outlierDescription: string;
    if (outliers.length === 0) {
      outlierDescription = 'All precincts fit well in the routing.';
    } else if (outliers.length === 1) {
      const o = outliers[0];
      outlierDescription = `${o.precinctName} is an outlier (${o.reason}) - ${o.impactAnalysis.recommendation === 'drop' ? 'consider dropping it' : 'worth keeping'}.`;
    } else {
      const dropCount = outliers.filter(o => o.impactAnalysis.recommendation === 'drop').length;
      outlierDescription = `${outliers.length} outlier precincts identified. ${dropCount > 0 ? `Consider dropping ${dropCount} for efficiency.` : 'All are worth keeping despite extra travel.'}`;
    }

    // Efficiency description
    const improvement = efficiency.asSelected.doorsPerHour > 0
      ? ((efficiency.optimized.doorsPerHour - efficiency.asSelected.doorsPerHour) / efficiency.asSelected.doorsPerHour) * 100
      : 0;

    let efficiencyDescription: string;
    if (improvement > 10) {
      efficiencyDescription = `Current efficiency: ${efficiency.asSelected.doorsPerHour.toFixed(1)} doors/hour. Could improve to ${efficiency.optimized.doorsPerHour.toFixed(1)} doors/hour (+${improvement.toFixed(0)}%).`;
    } else if (efficiency.asSelected.doorsPerHour >= 35) {
      efficiencyDescription = `Excellent efficiency: ${efficiency.asSelected.doorsPerHour.toFixed(1)} doors/hour. Well-clustered selection.`;
    } else {
      efficiencyDescription = `Efficiency: ${efficiency.asSelected.doorsPerHour.toFixed(1)} doors/hour. ${efficiency.asSelected.totalHours.toFixed(1)} hours total.`;
    }

    // Top recommendation
    const topRecommendation = suggestions.length > 0
      ? suggestions[0].description
      : 'Your selection is well-optimized for canvassing.';

    return {
      clusterDescription,
      outlierDescription,
      efficiencyDescription,
      topRecommendation,
      quickStats: {
        clusters: clusters.length,
        outliers: outliers.length,
        totalDoors: efficiency.asSelected.totalDoors,
        estimatedHours: efficiency.asSelected.totalHours,
        doorsPerHour: efficiency.asSelected.doorsPerHour,
        potentialImprovement: improvement,
      },
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Haversine distance between two points
   */
  private haversineDistance(point1: [number, number], point2: [number, number]): number {
    const [lng1, lat1] = point1;
    const [lng2, lat2] = point2;

    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Calculate centroid of precincts
   */
  private calculateCentroid(precincts: SpatialPrecinctInput[]): [number, number] {
    const sumLng = precincts.reduce((sum, p) => sum + p.centroid[0], 0);
    const sumLat = precincts.reduce((sum, p) => sum + p.centroid[1], 0);
    return [sumLng / precincts.length, sumLat / precincts.length];
  }

  /**
   * Calculate bounding box
   */
  private calculateBoundingBox(precincts: SpatialPrecinctInput[]): {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  } {
    const lngs = precincts.map(p => p.centroid[0]);
    const lats = precincts.map(p => p.centroid[1]);
    return {
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    };
  }

  /**
   * Calculate maximum internal distance in a cluster
   */
  private calculateMaxInternalDistance(precincts: SpatialPrecinctInput[]): number {
    if (precincts.length < 2) return 0;

    let maxDist = 0;
    for (let i = 0; i < precincts.length; i++) {
      for (let j = i + 1; j < precincts.length; j++) {
        const dist = this.haversineDistance(precincts[i].centroid, precincts[j].centroid);
        if (dist > maxDist) maxDist = dist;
      }
    }
    return maxDist;
  }

  /**
   * Calculate cluster compactness (0-1)
   */
  private calculateCompactness(precincts: SpatialPrecinctInput[]): number {
    if (precincts.length < 3) return 1;

    const bb = this.calculateBoundingBox(precincts);
    const bbArea = (bb.maxLng - bb.minLng) * (bb.maxLat - bb.minLat);
    if (bbArea === 0) return 1;

    // Approximate actual coverage (simple heuristic)
    const avgDist = this.calculateAverageDistance(precincts);
    const idealArea = Math.PI * avgDist * avgDist;
    return Math.min(1, idealArea / (bbArea * 111 * 111)); // Convert degrees to km
  }

  /**
   * Calculate average distance from centroid
   */
  private calculateAverageDistance(precincts: SpatialPrecinctInput[]): number {
    const centroid = this.calculateCentroid(precincts);
    const totalDist = precincts.reduce(
      (sum, p) => sum + this.haversineDistance(p.centroid, centroid),
      0
    );
    return totalDist / precincts.length;
  }

  /**
   * Estimate travel time using nearest-neighbor heuristic
   */
  private estimateTravelTime(precincts: SpatialPrecinctInput[]): number {
    if (precincts.length < 2) return 0;

    const visited = new Set<string>();
    let current = precincts[0];
    visited.add(current.precinctId);
    let totalMinutes = 0;

    while (visited.size < precincts.length) {
      let nearestDist = Infinity;
      let nearest: SpatialPrecinctInput | null = null;

      for (const p of precincts) {
        if (visited.has(p.precinctId)) continue;
        const dist = this.haversineDistance(current.centroid, p.centroid);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      }

      if (nearest) {
        totalMinutes += nearestDist * TRAVEL_MINUTES_PER_KM[nearest.density];
        visited.add(nearest.precinctId);
        current = nearest;
      }
    }

    return totalMinutes;
  }

  /**
   * Estimate total travel distance
   */
  private estimateTotalTravelDistance(precincts: SpatialPrecinctInput[]): number {
    if (precincts.length < 2) return 0;

    const visited = new Set<string>();
    let current = precincts[0];
    visited.add(current.precinctId);
    let totalKm = 0;

    while (visited.size < precincts.length) {
      let nearestDist = Infinity;
      let nearest: SpatialPrecinctInput | null = null;

      for (const p of precincts) {
        if (visited.has(p.precinctId)) continue;
        const dist = this.haversineDistance(current.centroid, p.centroid);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      }

      if (nearest) {
        totalKm += nearestDist;
        visited.add(nearest.precinctId);
        current = nearest;
      }
    }

    return totalKm;
  }

  /**
   * Calculate average of numbers
   */
  private average(nums: number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  /**
   * Find mode (most common value)
   */
  private mode<T>(arr: T[]): T {
    const counts = new Map<T, number>();
    let maxCount = 0;
    let modeValue = arr[0];

    for (const item of arr) {
      const count = (counts.get(item) || 0) + 1;
      counts.set(item, count);
      if (count > maxCount) {
        maxCount = count;
        modeValue = item;
      }
    }

    return modeValue;
  }

  /**
   * Empty analysis for no selections
   */
  private emptyAnalysis(): SpatialAnalysis {
    return {
      inputPrecincts: 0,
      analyzedAt: new Date(),
      clusters: [],
      outliers: [],
      efficiency: {
        asSelected: {
          totalDoors: 0,
          totalHours: 0,
          doorsPerHour: 0,
          totalTravelKm: 0,
          avgTravelBetweenStops: 0,
          estimatedContacts: 0,
          contactsPerHour: 0,
        },
        optimized: {
          totalDoors: 0,
          totalHours: 0,
          doorsPerHour: 0,
          totalTravelKm: 0,
          avgTravelBetweenStops: 0,
          estimatedContacts: 0,
          contactsPerHour: 0,
        },
        byCluster: {},
      },
      suggestions: [],
      nearbyOpportunities: [],
      summary: {
        clusterDescription: 'No precincts selected.',
        outlierDescription: '',
        efficiencyDescription: '',
        topRecommendation: 'Select precincts to begin spatial analysis.',
        quickStats: {
          clusters: 0,
          outliers: 0,
          totalDoors: 0,
          estimatedHours: 0,
          doorsPerHour: 0,
          potentialImprovement: 0,
        },
      },
    };
  }

  /**
   * Single precinct analysis
   */
  private singlePrecinctAnalysis(
    precinct: SpatialPrecinctInput,
    opts: Required<SpatialAnalysisOptions>
  ): SpatialAnalysis {
    const doors = precinct.estimatedDoors;
    const minutes = doors * MINUTES_PER_DOOR[precinct.density];
    const hours = minutes / 60;
    const doorsPerHour = hours > 0 ? doors / hours : 0;
    const contacts = Math.round(doors * opts.contactRate);

    const nearby = this.findNearbyOpportunities([precinct], [], opts);

    return {
      inputPrecincts: 1,
      analyzedAt: new Date(),
      clusters: [],
      outliers: [],
      efficiency: {
        asSelected: {
          totalDoors: doors,
          totalHours: hours,
          doorsPerHour,
          totalTravelKm: 0,
          avgTravelBetweenStops: 0,
          estimatedContacts: contacts,
          contactsPerHour: hours > 0 ? contacts / hours : 0,
        },
        optimized: {
          totalDoors: doors,
          totalHours: hours,
          doorsPerHour,
          totalTravelKm: 0,
          avgTravelBetweenStops: 0,
          estimatedContacts: contacts,
          contactsPerHour: hours > 0 ? contacts / hours : 0,
        },
        byCluster: {},
      },
      suggestions: nearby.length > 0 ? [{
        id: 'expand-selection',
        type: 'add_nearby',
        priority: 'medium',
        title: 'Expand selection',
        description: `Consider adding nearby precincts to build a more efficient canvassing turf.`,
        impact: {
          efficiencyChange: 0,
          doorsChange: nearby.slice(0, 3).reduce((sum, p) => sum + p.metrics.doors, 0),
          timeChange: 0,
        },
        action: {
          type: 'add',
          precinctIds: nearby.slice(0, 3).map(p => p.precinctId),
        },
      }] : [],
      nearbyOpportunities: nearby,
      summary: {
        clusterDescription: `Single precinct selected: ${precinct.precinctName}`,
        outlierDescription: '',
        efficiencyDescription: `${doors} doors, ~${hours.toFixed(1)} hours (${doorsPerHour.toFixed(1)} doors/hour)`,
        topRecommendation: nearby.length > 0
          ? `Consider adding ${nearby[0].precinctName} (${nearby[0].metrics.doors} doors, ${nearby[0].distanceToNearestSelected.toFixed(1)}km away)`
          : 'No nearby precincts found to suggest.',
        quickStats: {
          clusters: 0,
          outliers: 0,
          totalDoors: doors,
          estimatedHours: hours,
          doorsPerHour,
          potentialImprovement: 0,
        },
      },
    };
  }
}

// Export singleton accessor
export const getSpatialReasoningEngine = () => SpatialReasoningEngine.getInstance();
