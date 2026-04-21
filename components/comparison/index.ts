/**
 * Split Screen Comparison Tool Components
 *
 * Exports all components for side-by-side comparison of precincts or jurisdictions.
 */

export { ComparisonPane } from './ComparisonPane';
export { EntitySelector } from './EntitySelector';
export { InsightsSummary } from './InsightsSummary';
export { ComparisonView } from './ComparisonView';

// Re-export types for convenience
export type {
  ComparisonEntity,
  ComparisonResult,
  MetricDifference,
  EntitySearchResult,
  EntityType,
  CompetitivenessLevel,
  TargetingStrategy,
} from '@/lib/comparison/types';
