export * from './types';
export * from './types/unified-state';

// Application State Manager
export { default as ApplicationStateManager, getStateManager } from './ApplicationStateManager';
export type {
  ApplicationState,
  MapState as AppMapState,
  SelectionState,
  IQBuilderState,
  WorkflowState,
  BehaviorState,
  TemporalState,
  SegmentationState,
  ComparisonState,
  ReportState,
  StateEventType,
  StateEvent,
  StateListener,
} from './ApplicationStateManager';

// Suggestion Engine
export { default as SuggestionEngine, getSuggestionEngine } from './SuggestionEngine';

export { MapCommandBridge, mapCommandBridge } from './MapCommandBridge';

// UI Hooks

export { useToolUrlParams, hasUrlParams, buildQueryString } from './hooks/useToolUrlParams';

// Navigation
export {
  CrossToolNavigator,
  navigateToSegments,
  navigateToComparison,
} from './navigation/CrossToolNavigator';

// Performance Utilities
export {
  useDebounce,
  useDebouncedCallback,
  useThrottle,
  useThrottledCallback,
  useMemoWithTTL,
  useIntersectionObserver,
  useLazyLoad,
  useRAFCallback,
  useBatchedUpdates,
  MemoCache,
  PreloadManager,
  preloadManager,
} from './performance';

// NLP Handlers
export {
  ToolOrchestrator,
  toolOrchestrator,
  processQuery,
  canHandleQuery,
  segmentationHandler,
  reportHandler,
} from './handlers';

// Re-export commonly used types
export type {
  Message,
  SuggestedAction,
  MapCommand,
  PoliticalAIContext,
  AISession,
  ToolResult,
  ParsedQuery,
  Citation,
} from './types';

export type {
  MapState,
  MapBridgeConfig,
  MapEvent,
} from './MapCommandBridge';


// Performance Types
export type {
  VirtualScrollConfig,
  VirtualScrollResult,
} from './performance';

// NLP Handler Types
export type {
  NLPHandler,
  ParsedQuery as NLPParsedQuery,
  QueryIntent,
  ExtractedEntities,
  HandlerResult,
  QueryPattern,
} from './handlers';

// Navigation Types
export type {
  ToolUrlParams,
} from './hooks/useToolUrlParams';

export type {
  NavigableTool,
  NavigationContext,
} from './navigation/CrossToolNavigator';
