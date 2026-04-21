/**
 * NLP Handlers Module
 *
 * Provides natural language processing handlers for all political analysis tools.
 * The ToolOrchestrator routes queries to the appropriate handler.
 */

// Types
export * from './types';

// Domain-specific handlers
export { SegmentationHandler, segmentationHandler } from './SegmentationHandler';
export { ReportHandler, reportHandler } from './ReportHandler';
export { ComparisonHandler, comparisonHandler } from './ComparisonHandler';
export { DistrictHandler, districtHandler } from './DistrictHandler';

// Analysis & visualization handlers
export { GraphHandler, graphHandler } from './GraphHandler';
export { SpatialHandler, spatialHandler } from './SpatialHandler';
export { FilterHandler, filterHandler } from './FilterHandler';
export { TrendHandler, trendHandler } from './TrendHandler';
export { PollHandler, getPollHandler } from './PollHandler';

// Navigation handler
export { NavigationHandler, navigationHandler } from './NavigationHandler';

// Fallback handler
export { GeneralHandler, generalHandler } from './GeneralHandler';

// Orchestrator
export {
  ToolOrchestrator,
  QueryParser,
  toolOrchestrator,
  processQuery,
  canHandleQuery,
} from './ToolOrchestrator';

// Re-export commonly used types
export type {
  NLPHandler,
  ParsedQuery,
  QueryIntent,
  ExtractedEntities,
  HandlerResult,
  QueryPattern,
  ConvertedFilters,
  Citation,
  HandlerMetadata,
} from './types';
