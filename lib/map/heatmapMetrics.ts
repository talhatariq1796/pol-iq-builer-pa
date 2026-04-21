/**
 * Centralized Heatmap Metric Configuration
 *
 * This module provides standardized metric mappings for heatmap visualizations.
 * It eliminates hardcoded mappings and provides a single source of truth for
 * metric configuration across the application.
 *
 * Issue: S1A-014 - showHeatmap metric mapping is hardcoded
 */

import type { H3Metric } from '@/components/political-analysis';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended metric names that can be used in map commands.
 * These include both canonical names and common aliases.
 */
export type HeatmapMetricName =
  | 'partisan_lean'
  | 'swing_potential'
  | 'gotv_priority'
  | 'gotv'
  | 'persuasion_opportunity'
  | 'persuasion'
  | 'combined_score'
  | 'combined'
  | 'turnout';

/**
 * Metadata for a heatmap metric including display properties
 */
export interface HeatmapMetricConfig {
  /** Canonical H3Metric name */
  canonical: H3Metric;
  /** Display label for UI */
  label: string;
  /** Description of what this metric represents */
  description: string;
  /** Color scheme identifier */
  colorScheme: 'diverging' | 'sequential';
  /** Whether higher values are better (for color coding) */
  higherIsBetter?: boolean;
}

// ============================================================================
// Metric Configurations
// ============================================================================

/**
 * Complete metric configurations with metadata
 */
export const HEATMAP_METRIC_CONFIGS: Record<H3Metric, HeatmapMetricConfig> = {
  partisan_lean: {
    canonical: 'partisan_lean',
    label: 'Partisan Lean',
    description: 'Historical voting pattern (-100 D to +100 R)',
    colorScheme: 'diverging',
    higherIsBetter: undefined, // Neutral - depends on party
  },
  swing_potential: {
    canonical: 'swing_potential',
    label: 'Swing Potential',
    description: 'Electoral volatility and persuadability (0-100)',
    colorScheme: 'sequential',
    higherIsBetter: true,
  },
  gotv_priority: {
    canonical: 'gotv_priority',
    label: 'GOTV Priority',
    description: 'Get-out-the-vote mobilization value (0-100)',
    colorScheme: 'sequential',
    higherIsBetter: true,
  },
  persuasion_opportunity: {
    canonical: 'persuasion_opportunity',
    label: 'Persuasion Opportunity',
    description: 'Proportion of persuadable voters (0-100)',
    colorScheme: 'sequential',
    higherIsBetter: true,
  },
  combined_score: {
    canonical: 'combined_score',
    label: 'Combined Targeting Score',
    description: 'Composite targeting score (0-100)',
    colorScheme: 'sequential',
    higherIsBetter: true,
  },
};

/**
 * Mapping from all recognized metric names (including aliases) to canonical H3Metric values.
 * This allows flexible input while maintaining consistency.
 *
 * @example
 * ```typescript
 * HEATMAP_METRIC_MAPPING['gotv'] // Returns 'gotv_priority'
 * HEATMAP_METRIC_MAPPING['persuasion'] // Returns 'persuasion_opportunity'
 * ```
 */
export const HEATMAP_METRIC_MAPPING: Record<HeatmapMetricName, H3Metric> = {
  // Canonical names
  partisan_lean: 'partisan_lean',
  swing_potential: 'swing_potential',
  gotv_priority: 'gotv_priority',
  persuasion_opportunity: 'persuasion_opportunity',
  combined_score: 'combined_score',

  // Common aliases
  gotv: 'gotv_priority',
  persuasion: 'persuasion_opportunity',
  combined: 'combined_score',
  turnout: 'gotv_priority', // Turnout visualization uses GOTV priority metric
};

/**
 * Default metric to use when none is specified or an invalid metric is provided
 */
export const DEFAULT_HEATMAP_METRIC: H3Metric = 'partisan_lean';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve a metric name (including aliases) to its canonical H3Metric value.
 *
 * @param metric - The metric name to resolve (can be canonical or alias)
 * @returns The canonical H3Metric value
 *
 * @example
 * ```typescript
 * resolveHeatmapMetric('gotv') // Returns 'gotv_priority'
 * resolveHeatmapMetric('invalid') // Returns 'partisan_lean' (default)
 * ```
 */
export function resolveHeatmapMetric(metric?: string): H3Metric {
  if (!metric) {
    return DEFAULT_HEATMAP_METRIC;
  }

  const normalized = metric.toLowerCase().trim() as HeatmapMetricName;
  return HEATMAP_METRIC_MAPPING[normalized] || DEFAULT_HEATMAP_METRIC;
}

/**
 * Get the full configuration for a metric
 *
 * @param metric - The metric name (canonical or alias)
 * @returns The metric configuration
 *
 * @example
 * ```typescript
 * const config = getMetricConfig('gotv');
 * console.log(config.label); // "GOTV Priority"
 * ```
 */
export function getMetricConfig(metric?: string): HeatmapMetricConfig {
  const canonical = resolveHeatmapMetric(metric);
  return HEATMAP_METRIC_CONFIGS[canonical];
}

/**
 * Get all available metric names (for UI dropdowns, etc.)
 *
 * @returns Array of canonical metric names with their configurations
 */
export function getAvailableMetrics(): Array<{ value: H3Metric; config: HeatmapMetricConfig }> {
  return Object.entries(HEATMAP_METRIC_CONFIGS).map(([value, config]) => ({
    value: value as H3Metric,
    config,
  }));
}

/**
 * Validate if a metric name is recognized
 *
 * @param metric - The metric name to validate
 * @returns True if the metric is recognized (canonical or alias)
 */
export function isValidMetric(metric: string): boolean {
  const normalized = metric.toLowerCase().trim() as HeatmapMetricName;
  return normalized in HEATMAP_METRIC_MAPPING;
}
