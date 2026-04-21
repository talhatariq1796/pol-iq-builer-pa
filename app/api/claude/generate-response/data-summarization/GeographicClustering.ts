/**
 * Geographic Clustering Module
 * 
 * Identifies geographic patterns and clusters in the data to provide
 * spatial insights for analysis without enumerating all features.
 */

import { FeatureProperties, extractNumericValues, calculateStatistics } from './StatisticalFoundation';

interface GeographicCluster {
  clusterId: string;
  centerPoint: { lat: number; lng: number } | null;
  regionName: string;
  featureCount: number;
  averageValue: number;
  minValue: number;
  maxValue: number;
  stdDeviation: number;
  states?: string[];
  cities?: string[];
  zipCodes?: string[];
}

interface SpatialPattern {
  type: 'hotspot' | 'coldspot' | 'uniform' | 'dispersed';
  intensity: number;
  description: string;
}

interface GeographicSummary {
  clusters: GeographicCluster[];
  patterns: SpatialPattern[];
  dominantRegions: string[];
  spatialAutocorrelation?: number;
}

/**
 * Extract geographic identifiers from features
 */
function extractGeographicIdentifiers(features: FeatureProperties[]): {
  states: Set<string>;
  cities: Set<string>;
  counties: Set<string>;
  zipCodes: Set<string>;
} {
  const states = new Set<string>();
  const cities = new Set<string>();
  const counties = new Set<string>();
  const zipCodes = new Set<string>();
  
  features.forEach(feature => {
    const properties = feature.properties || feature;
    
    // Extract state
    const state = properties.STATE || properties.state || properties.state_abbr;
    if (state && typeof state === 'string') {
      states.add(state.toUpperCase());
    }
    
    // Extract city from description or city field
    const description = properties.DESCRIPTION || properties.description || properties.name;
    if (description && typeof description === 'string') {
      // Try to extract city from description (e.g., "Miami Beach, FL")
      const cityMatch = description.match(/^([^,]+),/);
      if (cityMatch) {
        cities.add(cityMatch[1].trim());
      }
    }
    
    const city = properties.CITY || properties.city || properties.city_name;
    if (city && typeof city === 'string') {
      cities.add(city);
    }
    
    // Extract county
    const county = properties.COUNTY || properties.county || properties.county_name;
    if (county && typeof county === 'string') {
      counties.add(county);
    }
    
    // Extract ZIP code
    const zipCode = properties.zipcode || properties.zip_code || properties.ZIP || 
                     properties.ZIPCODE || properties.GEOID || properties.geoid;
    if (zipCode && typeof zipCode === 'string') {
      // Take first 5 digits of ZIP code
      const zip5 = zipCode.substring(0, 5);
      if (/^\d{5}$/.test(zip5)) {
        zipCodes.add(zip5);
      }
    }
  });
  
  return { states, cities, counties, zipCodes };
}

/**
 * Group features by geographic region
 */
function groupByGeography(
  features: FeatureProperties[], 
  primaryField: string
): Map<string, FeatureProperties[]> {
  const groups = new Map<string, FeatureProperties[]>();
  
  features.forEach(feature => {
    const properties = feature.properties || feature;
    
    // Try to determine the geographic key
    let geoKey = 'Unknown';
    
    // Priority 1: State
    const state = properties.STATE || properties.state;
    if (state) {
      geoKey = state;
    }
    
    // Priority 2: County + State
    const county = properties.COUNTY || properties.county;
    if (county && state) {
      geoKey = `${county}, ${state}`;
    }
    
    // Priority 3: City + State from description
    const description = properties.DESCRIPTION || properties.description;
    if (description && typeof description === 'string') {
      const locationMatch = description.match(/^([^,]+),\s*([A-Z]{2})/);
      if (locationMatch) {
        const city = locationMatch[1];
        const stateAbbr = locationMatch[2];
        geoKey = `${city}, ${stateAbbr}`;
      }
    }
    
    if (!groups.has(geoKey)) {
      groups.set(geoKey, []);
    }
    groups.get(geoKey)!.push(feature);
  });
  
  return groups;
}

/**
 * Create geographic clusters from grouped features
 */
function createClusters(
  groups: Map<string, FeatureProperties[]>,
  primaryField: string
): GeographicCluster[] {
  const clusters: GeographicCluster[] = [];
  
  groups.forEach((features, regionName) => {
    if (features.length === 0) return;
    
    const values = extractNumericValues(features, primaryField);
    if (values.length === 0) return;
    
    const stats = calculateStatistics(values);
    const geoIdentifiers = extractGeographicIdentifiers(features);
    
    // Extract center point if geometry is available
    let centerPoint = null;
    const firstFeature = features[0];
    if (firstFeature.geometry && firstFeature.geometry.type === 'Point') {
      centerPoint = {
        lng: firstFeature.geometry.coordinates[0],
        lat: firstFeature.geometry.coordinates[1]
      };
    }
    
    clusters.push({
      clusterId: `cluster_${clusters.length + 1}`,
      centerPoint,
      regionName,
      featureCount: features.length,
      averageValue: stats.mean,
      minValue: stats.min,
      maxValue: stats.max,
      stdDeviation: stats.standardDeviation,
      states: geoIdentifiers.states.size > 0 ? Array.from(geoIdentifiers.states) : undefined,
      cities: geoIdentifiers.cities.size > 0 ? Array.from(geoIdentifiers.cities).slice(0, 5) : undefined,
      zipCodes: geoIdentifiers.zipCodes.size > 0 ? Array.from(geoIdentifiers.zipCodes).slice(0, 10) : undefined
    });
  });
  
  // Sort clusters by average value (descending)
  clusters.sort((a, b) => b.averageValue - a.averageValue);
  
  return clusters;
}

/**
 * Detect spatial patterns in the data
 */
function detectSpatialPatterns(
  features: FeatureProperties[],
  primaryField: string,
  clusters: GeographicCluster[]
): SpatialPattern[] {
  const patterns: SpatialPattern[] = [];
  
  if (clusters.length === 0) return patterns;
  
  // Calculate overall statistics
  const allValues = extractNumericValues(features, primaryField);
  const overallStats = calculateStatistics(allValues);
  
  // Identify hotspots (clusters with high average values)
  const hotspotThreshold = overallStats.mean + overallStats.standardDeviation;
  const hotspots = clusters.filter(c => c.averageValue > hotspotThreshold);
  
  if (hotspots.length > 0) {
    patterns.push({
      type: 'hotspot',
      intensity: hotspots.length / clusters.length,
      description: `${hotspots.length} high-performance clusters identified (${hotspots.map(h => h.regionName).slice(0, 3).join(', ')}${hotspots.length > 3 ? ', ...' : ''})`
    });
  }
  
  // Identify coldspots (clusters with low average values)
  const coldspotThreshold = overallStats.mean - overallStats.standardDeviation;
  const coldspots = clusters.filter(c => c.averageValue < coldspotThreshold);
  
  if (coldspots.length > 0) {
    patterns.push({
      type: 'coldspot',
      intensity: coldspots.length / clusters.length,
      description: `${coldspots.length} low-performance clusters identified (${coldspots.map(c => c.regionName).slice(0, 3).join(', ')}${coldspots.length > 3 ? ', ...' : ''})`
    });
  }
  
  // Detect if distribution is uniform or dispersed
  const clusterStdDevs = clusters.map(c => c.stdDeviation);
  const avgClusterStdDev = clusterStdDevs.reduce((a, b) => a + b, 0) / clusterStdDevs.length;
  
  if (avgClusterStdDev < overallStats.standardDeviation * 0.5) {
    patterns.push({
      type: 'uniform',
      intensity: 1 - (avgClusterStdDev / overallStats.standardDeviation),
      description: 'Values show uniform distribution within geographic clusters'
    });
  } else if (avgClusterStdDev > overallStats.standardDeviation * 1.5) {
    patterns.push({
      type: 'dispersed',
      intensity: avgClusterStdDev / overallStats.standardDeviation,
      description: 'Values show high dispersion within geographic clusters'
    });
  }
  
  return patterns;
}

/**
 * Calculate spatial autocorrelation (Moran's I simplified)
 */
function calculateSpatialAutocorrelation(
  clusters: GeographicCluster[]
): number | undefined {
  if (clusters.length < 2) return undefined;
  
  // Simplified spatial autocorrelation based on cluster similarities
  const values = clusters.map(c => c.averageValue);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  
  let numerator = 0;
  let denominator = 0;
  let weights = 0;
  
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      // Simple adjacency weight (1 if same state, 0 otherwise)
      const weight = (clusters[i].states?.[0] === clusters[j].states?.[0]) ? 1 : 0;
      
      if (weight > 0) {
        numerator += weight * (values[i] - mean) * (values[j] - mean);
        weights += weight;
      }
    }
    denominator += Math.pow(values[i] - mean, 2);
  }
  
  if (weights === 0 || denominator === 0) return undefined;
  
  const moransI = (clusters.length / weights) * (numerator / denominator);
  
  // Normalize to [-1, 1] range
  return Math.max(-1, Math.min(1, moransI));
}

/**
 * Generate geographic clustering analysis
 */
export function analyzeGeographicClusters(
  features: FeatureProperties[],
  primaryField: string
): GeographicSummary {
  if (!features || features.length === 0) {
    return {
      clusters: [],
      patterns: [],
      dominantRegions: []
    };
  }
  
  // Group features by geography
  const groups = groupByGeography(features, primaryField);
  
  // Create clusters from groups
  const clusters = createClusters(groups, primaryField);
  
  // Detect spatial patterns
  const patterns = detectSpatialPatterns(features, primaryField, clusters);
  
  // Calculate spatial autocorrelation
  const spatialAutocorrelation = calculateSpatialAutocorrelation(clusters);
  
  // Identify dominant regions (top performing clusters)
  const dominantRegions = clusters
    .slice(0, 5)
    .map(c => c.regionName);
  
  return {
    clusters: clusters.slice(0, 10), // Return top 10 clusters
    patterns,
    dominantRegions,
    spatialAutocorrelation
  };
}

/**
 * Create a geographic clustering summary for Claude
 */
export function createGeographicClusteringSummary(
  features: FeatureProperties[],
  primaryField: string
): string {
  const geoAnalysis = analyzeGeographicClusters(features, primaryField);
  
  if (geoAnalysis.clusters.length === 0) {
    return '=== GEOGRAPHIC CLUSTERING ===\nNo geographic clusters identified.\n\n';
  }
  
  let summary = '=== GEOGRAPHIC CLUSTERING ===\n';
  summary += `Geographic Analysis: ${geoAnalysis.clusters.length} distinct clusters identified\n`;
  
  if (geoAnalysis.spatialAutocorrelation !== undefined) {
    const autocorr = geoAnalysis.spatialAutocorrelation;
    const interpretation = autocorr > 0.3 ? 'clustered' : 
                          autocorr < -0.3 ? 'dispersed' : 'random';
    summary += `Spatial Autocorrelation: ${autocorr.toFixed(2)} (${interpretation} pattern)\n`;
  }
  
  summary += `\nTop Geographic Clusters:\n`;
  geoAnalysis.clusters.slice(0, 5).forEach((cluster, i) => {
    summary += `${i + 1}. ${cluster.regionName}\n`;
    summary += `   - Features: ${cluster.featureCount}\n`;
    summary += `   - Avg Value: ${cluster.averageValue.toFixed(2)}\n`;
    summary += `   - Range: ${cluster.minValue.toFixed(2)} to ${cluster.maxValue.toFixed(2)}\n`;
    if (cluster.cities && cluster.cities.length > 0) {
      summary += `   - Key Cities: ${cluster.cities.slice(0, 3).join(', ')}\n`;
    }
  });
  
  if (geoAnalysis.patterns.length > 0) {
    summary += `\nSpatial Patterns:\n`;
    geoAnalysis.patterns.forEach(pattern => {
      summary += `- ${pattern.description}\n`;
    });
  }
  
  if (geoAnalysis.dominantRegions.length > 0) {
    summary += `\nDominant Regions: ${geoAnalysis.dominantRegions.join(', ')}\n`;
  }
  
  summary += `\n🗺️ GEOGRAPHIC DIRECTIVE: Analyze spatial clustering and regional performance variations.\n\n`;
  
  return summary;
}

// Export types and functions
export type { GeographicCluster, SpatialPattern, GeographicSummary };
export { extractGeographicIdentifiers, groupByGeography, detectSpatialPatterns };