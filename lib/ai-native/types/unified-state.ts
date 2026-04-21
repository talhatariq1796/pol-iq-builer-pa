/**
 * Unified State Types for Cross-Tool Context Awareness
 *
 * Part of Phase 1: Unified AI-First Architecture
 * See docs/UNIFIED-AI-ARCHITECTURE-PLAN.md
 */

import type { SegmentFilters } from '@/lib/segmentation/types';

// ============================================================================
// Tool Type
// ============================================================================

/**
 * Available tool pages in the application
 */
export type ToolType = 'political-ai' | 'segments' | 'compare' | 'settings';

// ============================================================================
// Exploration History
// ============================================================================

/**
 * Single exploration action entry for tracking user journey
 */
export interface ExplorationHistoryEntry {
  tool: ToolType;
  action: string;
  timestamp: Date;
  result?: string;
  precinctIds?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Tool-Specific Contexts
// ============================================================================

/**
 * Segmentation tool context
 */
export interface SegmentToolContext {
  filters: SegmentFilters | null;
  matchingPrecincts: string[];
  savedSegmentId?: string;
}

/**
 * Donor tool context
 */
export interface DonorToolContext {
  selectedZips: string[];
  timeRange: { start: Date; end: Date } | null;
  partyFilter: 'all' | 'D' | 'R' | 'other';
  activeView: 'zip' | 'timeSeries' | 'occupations' | 'committees' | 'ies' | 'lapsed' | 'upgrade';
}

/**
 * Canvassing tool context
 */
export interface CanvassToolContext {
  turfs: Array<{ id: string; name: string; precinctIds: string[]; doorCount: number }>;
  targetPrecincts: string[];
  efficiency?: number;
}

/**
 * Comparison tool context
 */
export interface CompareToolContext {
  leftEntity: { type: string; id: string; name: string } | null;
  rightEntity: { type: string; id: string; name: string } | null;
}

/**
 * Political AI tool context (main page)
 */
export interface PoliticalAIToolContext {
  lastQuery?: string;
  activeWorkflow?: string;
}

/**
 * Settings page context
 */
export interface SettingsToolContext {
  activeSection?: string;
}

/**
 * Knowledge Graph context
 */
export interface KnowledgeGraphToolContext {
  selectedNode?: string;
  expandedNodes?: string[];
}

/**
 * Combined tool contexts structure
 */
export interface ToolContexts {
  'political-ai': PoliticalAIToolContext;
  segments: SegmentToolContext;
  compare: CompareToolContext;
  settings: SettingsToolContext;
}

// ============================================================================
// Shared Map State
// ============================================================================

/**
 * Map state shared across all pages
 * Enables consistent map visualization across tool transitions
 */
export interface SharedMapState {
  layer: 'choropleth' | 'heatmap' | 'none';
  metric: string | null;
  highlights: string[];
  visiblePrecincts: string[];
  center: [number, number];
  zoom: number;
  // Temporal visualization state (Phase 16)
  isTemporalMode?: boolean;
  selectedElectionYear?: number;
  availableElectionYears?: number[];
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * New state event types for unified architecture
 */
export type UnifiedStateEventType =
  | 'TOOL_SWITCHED'
  | 'TOOL_CONTEXT_UPDATED'
  | 'EXPLORATION_LOGGED'
  | 'SHARED_MAP_UPDATED'
  | 'FEATURE_SELECTED'
  | 'FEATURE_DESELECTED'
  | 'TEMPORAL_MODE_CHANGED'
  | 'MAP_COMMAND_EXECUTED'
  | 'SEGMENT_LOADED';

// ============================================================================
// Feature Selection Types (Phase G)
// ============================================================================

/**
 * Type of geographic feature selected on the map
 */
export type FeatureType =
  | 'precinct'
  | 'hexagon'
  | 'zip'
  | 'municipality'
  | 'state_house'
  | 'state_senate';

/**
 * Generic feature data structure for any selected map feature
 */
export interface SelectedFeatureData {
  id: string;
  name: string;
  featureType: FeatureType;
  metrics: Record<string, number | string | undefined>;
  geometry?: GeoJSON.Geometry;
  raw?: Record<string, unknown>;
}

/**
 * Feature selection state tracked in ApplicationStateManager
 */
export interface FeatureSelectionState {
  currentFeature: SelectedFeatureData | null;
  featureHistory: Array<{
    feature: SelectedFeatureData;
    timestamp: Date;
  }>;
}

// ============================================================================
// Exploration Metrics & Output Suggestions (Phase 8)
// ============================================================================

/**
 * Exploration depth metrics for output suggestion triggering
 */
export interface ExplorationMetrics {
  precinctsViewed: number;
  filtersApplied: number;
  toolsVisited: string[];
  sessionDuration: number; // minutes
  lastActivity: Date;
  highValueFound: boolean; // true if swing/gotv precincts discovered
  comparisonsMade: number;
  segmentsSaved: number;
}

/**
 * Output suggestion types
 */
export interface OutputSuggestion {
  type: 'saveSegment' | 'exportCSV' | 'generateReport' | 'planCanvass';
  label: string;
  reason: string; // Why this is suggested
  priority: number; // 0-100
  metadata?: Record<string, unknown>;
}
