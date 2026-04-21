/**
 * Spatial Reasoning Types
 *
 * Type definitions for intelligent spatial analysis of precinct selections.
 * Supports cluster detection, outlier identification, and efficiency optimization.
 */

import type { DensityType } from '@/lib/canvassing/types';

/**
 * A geographic cluster of precincts
 */
export interface PrecinctCluster {
  id: string;
  name: string;
  precinctIds: string[];
  centroid: [number, number]; // [lng, lat]
  boundingBox: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
  metrics: ClusterMetrics;
}

/**
 * Metrics for a precinct cluster
 */
export interface ClusterMetrics {
  totalDoors: number;
  totalPrecincts: number;
  estimatedHours: number;
  doorsPerHour: number;
  avgGotvPriority: number;
  avgPersuasionOpportunity: number;
  avgSwingPotential: number;
  dominantDensity: DensityType;
  compactness: number; // 0-1, how tight the cluster is
  maxInternalDistance: number; // km between furthest precincts
}

/**
 * An outlier precinct that doesn't fit well in any cluster
 */
export interface SpatialOutlier {
  precinctId: string;
  precinctName: string;
  centroid: [number, number];
  reason: OutlierReason;
  distanceToNearestCluster: number; // km
  nearestClusterId: string;
  impactAnalysis: OutlierImpact;
}

/**
 * Reason a precinct is flagged as an outlier
 */
export type OutlierReason =
  | 'isolated' // Far from all other precincts
  | 'between_clusters' // Between clusters, doesn't fit either
  | 'low_efficiency' // High travel cost for low door count
  | 'density_mismatch'; // Different density than nearby precincts

/**
 * Impact of including/excluding an outlier
 */
export interface OutlierImpact {
  additionalTravelMinutes: number;
  additionalDoors: number;
  efficiencyDelta: number; // Change in doors/hour if included
  recommendation: 'keep' | 'drop' | 'consider';
  alternativePrecincts?: string[]; // Nearby precincts that would be more efficient
}

/**
 * Suggestion for improving spatial efficiency
 */
export interface SpatialSuggestion {
  id: string;
  type: SuggestionType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: {
    efficiencyChange: number; // Percentage change in doors/hour
    doorsChange: number; // Change in total doors
    timeChange: number; // Change in total hours
  };
  action: SpatialAction;
}

/**
 * Types of spatial suggestions
 */
export type SuggestionType =
  | 'drop_outlier' // Remove isolated precinct
  | 'add_connector' // Add precinct to connect clusters
  | 'add_nearby' // Add nearby high-value precinct
  | 'split_clusters' // Split into separate canvassing sessions
  | 'merge_clusters' // Combine nearby clusters
  | 'reorder_route'; // Optimize visit order

/**
 * Action to execute a spatial suggestion
 */
export interface SpatialAction {
  type: 'add' | 'remove' | 'split' | 'merge' | 'reorder';
  precinctIds?: string[];
  clusterIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Complete spatial analysis result
 */
export interface SpatialAnalysis {
  // Input summary
  inputPrecincts: number;
  analyzedAt: Date;

  // Cluster analysis
  clusters: PrecinctCluster[];
  outliers: SpatialOutlier[];

  // Efficiency metrics
  efficiency: EfficiencyAnalysis;

  // Suggestions for improvement
  suggestions: SpatialSuggestion[];

  // Nearby precincts that could be added
  nearbyOpportunities: NearbyPrecinct[];

  // Summary for AI response
  summary: SpatialSummary;
}

/**
 * Efficiency analysis comparing different configurations
 */
export interface EfficiencyAnalysis {
  asSelected: EfficiencyMetrics;
  optimized: EfficiencyMetrics;
  byCluster: Record<string, EfficiencyMetrics>;
}

/**
 * Efficiency metrics for a configuration
 */
export interface EfficiencyMetrics {
  totalDoors: number;
  totalHours: number;
  doorsPerHour: number;
  totalTravelKm: number;
  avgTravelBetweenStops: number; // km
  estimatedContacts: number;
  contactsPerHour: number;
}

/**
 * A nearby precinct that could be added
 */
export interface NearbyPrecinct {
  precinctId: string;
  precinctName: string;
  centroid: [number, number];
  distanceToNearestSelected: number; // km
  nearestSelectedId: string;
  wouldConnectClusters: boolean;
  metrics: {
    doors: number;
    gotvPriority: number;
    persuasionOpportunity: number;
    swingPotential: number;
    density: DensityType;
  };
  additionImpact: {
    efficiencyChange: number;
    additionalDoors: number;
    additionalMinutes: number;
  };
}

/**
 * Human-readable summary for AI responses
 */
export interface SpatialSummary {
  clusterDescription: string;
  outlierDescription: string;
  efficiencyDescription: string;
  topRecommendation: string;
  quickStats: {
    clusters: number;
    outliers: number;
    totalDoors: number;
    estimatedHours: number;
    doorsPerHour: number;
    potentialImprovement: number; // Percentage
  };
}

/**
 * Input precinct data for spatial analysis
 */
export interface SpatialPrecinctInput {
  precinctId: string;
  precinctName: string;
  jurisdiction: string;
  centroid: [number, number]; // [lng, lat]
  estimatedDoors: number;
  density: DensityType;
  gotvPriority: number;
  persuasionOpportunity: number;
  swingPotential: number;
}

/**
 * Options for spatial analysis
 */
export interface SpatialAnalysisOptions {
  // Clustering parameters
  clusterDistanceThreshold?: number; // km, default 3
  minClusterSize?: number; // precincts, default 2

  // Outlier detection
  outlierDistanceThreshold?: number; // km, default 5
  minEfficiencyForInclusion?: number; // doors/hour, default 15

  // Nearby precinct search
  searchRadiusKm?: number; // default 5
  maxNearbyResults?: number; // default 10

  // Efficiency parameters
  targetDoorsPerHour?: number; // default 35
  contactRate?: number; // default 0.35
}

/**
 * DBSCAN algorithm parameters
 */
export interface DBSCANParams {
  epsilon: number; // Maximum distance between points in cluster (km)
  minPoints: number; // Minimum points to form a cluster
}
