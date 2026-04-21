/**
 * Analysis Lens - Centralized filtering for analysis/statistics
 * 
 * This module provides a single source of truth for filtering features
 * 
 * Primary use case: Exclude national parks from statistics and AI analysis
 * while maintaining them in the visualization layers.
 */

// Environment flag for detailed logging
const ANALYSIS_FILTER_LOG = process.env.ANALYSIS_PARK_FILTER_LOG === '1' ||
  process.env.ANALYSIS_PARK_FILTER_LOG === 'true';

/**
 * Detects if a feature represents a national park area
 * Uses multiple detection strategies for robustness
 */
export function isNationalPark(properties: Record<string, unknown>): boolean {
  if (!properties) return false;

  // Normalize common field names
  const areaId = properties.area_id || properties.ID || properties.id || '';
  const name = properties.name || properties.DESCRIPTION || properties.description || '';
  const nameStr = String(name).toLowerCase();

  // Strategy 1: ID prefix rule - areas starting with "000" are typically parks
  if (String(areaId).startsWith('000')) {
    return true;
  }

  // Strategy 2: Name-based detection with comprehensive patterns
  const parkPatterns = [
    /national\s+park/i,
    /ntl\s+park/i,
    /national\s+monument/i,
    /national\s+forest/i,
    /state\s+park/i,
    /\bpark\b.*national/i,
    /\bnational\b.*\bpark\b/i,
    // Common abbreviations
    /\bnp\b/i,  // National Park abbreviation
    /\bnm\b/i,  // National Monument abbreviation
    /\bnf\b/i   // National Forest abbreviation
  ];

  return parkPatterns.some(pattern => pattern.test(nameStr));
}

/**
 * Filters features for analysis purposes, excluding national parks
 * Auto-detects whether features are flat objects or nested under 'properties'
 */
export function analysisFeatures<T>(features: T[]): T[] {
  if (!features || features.length === 0) return features;

  const originalCount = features.length;

  // Detect if features have properties nested or are flat
  const firstFeature = features[0] as T & { properties?: unknown };
  const hasPropertiesNesting = firstFeature?.properties !== undefined;

  const filtered = features.filter(feature => {
    const featureWithProps = feature as T & { properties?: Record<string, unknown> };
    const props = hasPropertiesNesting ? featureWithProps.properties : (feature as unknown as Record<string, unknown>);
    return !isNationalPark(props as Record<string, unknown>);
  });

  // Optional logging for debugging
  if (ANALYSIS_FILTER_LOG && filtered.length !== originalCount) {
    const filteredCount = originalCount - filtered.length;
    console.log(`[AnalysisLens] analysisFeatures: ${originalCount} -> ${filtered.length} (filtered ${filteredCount} parks)`);
  }

  return filtered;
}

/**
 * Creates analysis-ready copies of layers with filtered features
 * Returns new layer objects with features excluding national parks
 */
export function getAnalysisLayers(layers: Array<{ features?: unknown[] }>): Array<{ features?: unknown[] }> {
  if (!layers || layers.length === 0) return layers;

  return layers.map(layer => {
    if (!layer.features || layer.features.length === 0) {
      return layer;
    }

    return {
      ...layer,
      features: analysisFeatures(layer.features)
    };
  });
}

/**
 * Removes national parks from ranking arrays (top/bottom performers)
 * Maintains array structure while filtering content
 */
export function sanitizeRankingArrayForAnalysis<T>(arr: T[]): T[] {
  if (!arr || arr.length === 0) return arr;

  return analysisFeatures(arr);
}

/**
 * Cleans comprehensive summary rankings to exclude parks
 * Handles nested ranking structures in AI analysis summaries
 */
export function sanitizeSummaryForAnalysis(summary: Record<string, unknown>): Record<string, unknown> {
  if (!summary || typeof summary !== 'object') {
    return summary;
  }

  const sanitized = { ...summary };

  // Handle common ranking arrays in summaries
  const rankingFields = [
    'topPerformers', 'bottomPerformers', 'top5', 'bottom5',
    'highest', 'lowest', 'leaders', 'laggards',
    'strongholds', 'weakspots', 'opportunities'
  ];

  rankingFields.forEach(field => {
    if (sanitized[field] && Array.isArray(sanitized[field])) {
      sanitized[field] = sanitizeRankingArrayForAnalysis(sanitized[field]);
    }
  });

  // Handle nested objects recursively
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeSummaryForAnalysis(sanitized[key] as Record<string, unknown>);
    }
  });

  return sanitized;
}

/**
 * Utility function to check if filtering is enabled
 * Allows easy toggling of the entire filtering system
 */
export function isAnalysisFilteringEnabled(): boolean {
  return process.env.ANALYSIS_PARK_FILTER_ENABLED !== 'false';
}

/**
 * Gets statistics about what would be filtered
 * Useful for debugging and validation
 */
export function getFilteringStats(features: Array<Record<string, unknown> | { properties?: Record<string, unknown> }>): {
  total: number;
  parks: number;
  remaining: number;
  parkNames: string[];
} {
  if (!features || features.length === 0) {
    return { total: 0, parks: 0, remaining: 0, parkNames: [] };
  }

  const parkNames: string[] = [];
  let parkCount = 0;

  features.forEach(feature => {
    const props = (feature as { properties?: Record<string, unknown> }).properties || (feature as Record<string, unknown>);
    if (isNationalPark(props)) {
      parkCount++;
      const name = (props as Record<string, unknown>).name ||
        (props as Record<string, unknown>).DESCRIPTION ||
        (props as Record<string, unknown>).description ||
        (props as Record<string, unknown>).area_id ||
        (props as Record<string, unknown>).ID ||
        (props as Record<string, unknown>).id || 'Unknown Park';
      parkNames.push(String(name));
    }
  });

  return {
    total: features.length,
    parks: parkCount,
    remaining: features.length - parkCount,
    parkNames
  };
}