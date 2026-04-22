/**
 * ApplicationStateManager - Central state tracking for AI context awareness
 *
 * This singleton maintains awareness of the entire application state,
 * enabling the AI to provide proactive, context-aware suggestions.
 *
 * Part of Phase 1: State Infrastructure
 * See docs/AI-CONTEXT-AWARENESS-PLAN.md for full architecture
 */

import type { PrecinctData, SegmentFilters } from '@/lib/segmentation/types';
import type { BoundaryLayerType } from '@/types/political';
import type {
  ToolType,
  ExplorationHistoryEntry,
  ToolContexts,
  SharedMapState,
  UnifiedStateEventType,
  SelectedFeatureData,
  FeatureSelectionState,
} from './types/unified-state';
import { getSettingsManager, type CampaignState, type AllSettings } from '@/lib/settings';
import { formatPartisanLeanPanel } from '@/lib/political/formatPartisanLeanPanel';

// Municipality data type (simplified for state tracking)
export interface MunicipalityData {
  id: string;
  name: string;
  type?: string;
  county?: string;
  population?: number;
  attributes?: Record<string, unknown>;
}

// Saved segment type for state tracking
export interface SavedSegment {
  id: string;
  name: string;
  filters: SegmentFilters;
  matchingPrecincts: string[];
  createdAt: Date;
  updatedAt?: Date;
}

// Lookalike result type for state tracking
export interface LookalikeResult {
  precinctId: string;
  precinctName: string;
  score: number;
  matchedFactors: string[];
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface MapState {
  center: [number, number];
  zoom: number;
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  } | null;
  visiblePrecincts: string[];
  activeLayer: 'choropleth' | 'heatmap' | 'none';
  activeMetric: string | null;
  highlightedFeatures: string[];
}

export interface SelectionState {
  type: 'none' | 'precinct' | 'municipality' | 'boundary' | 'drawn';
  selectedIds: string[];
  selectedEntity: PrecinctData | MunicipalityData | null;
  selectionHistory: SelectionHistoryEntry[];
}

export interface SelectionHistoryEntry {
  type: string;
  id: string;
  name: string;
  timestamp: Date;
  metrics?: Record<string, number>;
}

export interface IQBuilderState {
  activeTab: 'select' | 'results' | 'report';
  hasAnalysisResult: boolean;
  lastAnalysis: AreaAnalysisResult | null;
  boundaryType: BoundaryLayerType | null;
  selectedBoundaryIds: string[];
}

export interface AreaAnalysisResult {
  precincts: PrecinctData[];
  aggregatedMetrics: Record<string, number>;
  areaName: string;
  timestamp: Date;
}

export interface WorkflowState {
  activeWorkflow: string | null;
  workflowStep: number;
  workflowData: Record<string, unknown>;
}

export interface UserAction {
  type: string;
  target?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface BehaviorState {
  sessionStartTime: Date;
  lastInteractionTime: Date;
  actionsThisSession: UserAction[];
  exploredPrecincts: Set<string>;
  exploredMunicipalities: Set<string>;
  queriesAsked: string[];
  suggestionsAccepted: string[];
  suggestionsIgnored: string[];
}

export interface TemporalState {
  idleTime: number;
  timeInCurrentView: number;
  returningUser: boolean;
  previousSessionContext: SessionContext | null;
}

export interface SessionContext {
  lastVisit: Date;
  lastViewedPrecincts: string[];
  lastWorkflow: string | null;
  lastAnalysis: AreaAnalysisResult | null;
}

// Enhanced session continuity types (Phase 9)
export interface SessionTimelineEntry {
  timestamp: Date;
  type: 'navigation' | 'selection' | 'filter' | 'comparison' | 'report' | 'save' | 'query';
  description: string;
  tool: string;
  details?: {
    entityId?: string;
    entityName?: string;
    action?: string;
    result?: string;
  };
}

export interface ResumeOption {
  id: string;
  label: string;
  description: string;
  action: string;
  priority: number; // Higher = more relevant
  context: {
    precincts?: string[];
    filters?: Partial<SegmentFilters>;
    tool?: string;
    workflow?: string;
    // S7-003: Map commands for direct state restoration
    mapCommands?: Array<{
      type: string;
      target?: string | string[];
      metric?: string;
      [key: string]: unknown;
    }>;
  };
}

export interface EnhancedSessionContext extends SessionContext {
  sessionDuration: number; // minutes
  toolsUsed: string[];
  queriesAsked: string[];
  savedSegments: string[];
  reportsGenerated: string[];
  timeline: SessionTimelineEntry[];
  explorationDepth: number;
  highValueFindings: Array<{
    precinctId: string;
    precinctName: string;
    metric: string;
    value: number;
  }>;
}

// Phase 11: Temporal Visualization State
export interface TemporalVisualizationState {
  isTemporalMode: boolean;
  selectedYear: number | null;              // For election year selection
  comparisonYears: number[];                // Years being compared
  visualizationMode: 'slider' | 'animated' | 'comparison' | 'momentum';
  isPlaying: boolean;
  animationSpeed: number;                   // ms between frames
  availableYears: number[];                 // Elections we have data for
}

// Tool-specific state tracking
export interface SegmentationState {
  activeFilters: SegmentFilters | null;
  filterCount: number;
  matchingPrecincts: string[];
  matchCount: number;
  savedSegments: SavedSegment[];
  currentSegmentName: string | null;
  lookalikeReference: string | null;
  lookalikeResults: LookalikeResult[];
}

export interface Turf {
  id: string;
  name: string;
  precinctIds: string[];
  doorCount: number;
  priority: number;
}

export interface Volunteer {
  id: string;
  name: string;
  skills: string[];
  availability: string[];
}

export interface TurfAssignment {
  turfId: string;
  volunteerId: string;
  assignedAt: Date;
}

export interface PerformanceMetrics {
  doorsPerHour: number;
  contactRate: number;
  responseRate: number;
}

export interface ComparisonState {
  leftEntity: ComparisonEntity | null;
  rightEntity: ComparisonEntity | null;
  comparisonType: 'same' | 'cross-boundary' | null;
  similarityResults: SimilarityResult[];
  activeMetrics: string[];
}

export interface ComparisonEntity {
  type: 'precinct' | 'municipality' | 'district';
  id: string;
  name: string;
  data: PrecinctData | MunicipalityData;
}

export interface SimilarityResult {
  entityId: string;
  entityName: string;
  score: number;
  matchedFactors: string[];
}

export interface ReportState {
  selectedArea: AreaSelection | null;
  reportType: 'political' | 'demographic' | 'full';
  generationStatus: 'idle' | 'generating' | 'complete' | 'error';
  lastGeneratedReport: ReportMetadata | null;
  recentReports: ReportMetadata[];
}

export interface AreaSelection {
  type: 'precinct' | 'municipality' | 'custom';
  ids: string[];
  name: string;
}

export interface ReportMetadata {
  id: string;
  type: string;
  areaName: string;
  generatedAt: Date;
  pageCount: number;
}

// Phase 12: User Expertise Tracking
export type UserExpertiseLevel = 'novice' | 'intermediate' | 'power_user';

export interface ExpertiseIndicators {
  avgActionSpeed: number;        // Average ms between actions (lower = more expert)
  complexQueryRatio: number;     // Ratio of complex to simple queries
  helpsRequested: number;        // Number of times help/explanation was requested
  tutorialSkips: number;         // Number of tutorial/guide skips
  shortcutsUsed: number;         // Use of keyboard shortcuts or quick actions
  precisionClicks: number;       // Accurate first-click selections
  explorationBreadth: number;    // Unique tools/features explored
  sessionCount: number;          // Number of sessions (returning users)
}

export interface ExpertiseState {
  currentLevel: UserExpertiseLevel;
  indicators: ExpertiseIndicators;
  confidenceScore: number;       // 0-100 confidence in level assessment
  lastUpdated: Date;
  levelHistory: Array<{
    level: UserExpertiseLevel;
    timestamp: Date;
    reason: string;
  }>;
}

// Loading operation state for error recovery (P0-9)
export interface LoadingOperation {
  id: string;
  name: string;
  startTime: number;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
  retryCount: number;
}

export interface LoadingState {
  activeOperations: Map<string, LoadingOperation>;
  recentErrors: Array<{
    operationId: string;
    operationName: string;
    error: string;
    timestamp: Date;
    recovered: boolean;
  }>;
  isAnyLoading: boolean;
  lastError: string | null;
}

// Full application state
export interface ApplicationState {
  map: MapState;
  selection: SelectionState;
  iqBuilder: IQBuilderState;
  workflow: WorkflowState;
  behavior: BehaviorState;
  temporal: TemporalState;
  segmentation: SegmentationState;
  comparison: ComparisonState;
  reports: ReportState;

  // Unified AI Architecture fields
  currentTool: ToolType;
  explorationHistory: ExplorationHistoryEntry[];
  toolContexts: ToolContexts;
  sharedMapState: SharedMapState;

  // Feature Selection (Phase G)
  featureSelection: FeatureSelectionState;

  // Temporal Visualization (Phase 11)
  temporal_viz: TemporalVisualizationState;

  // User Expertise Tracking (Phase 12)
  expertise: ExpertiseState;

  // Numbered Markers (Wave 5D - Issue #17)
  numberedMarkers: Array<{ id: string; precinctId: string; number: number }>;

  // Loading State (P0-9 Error Recovery)
  loading: LoadingState;
}

// Event types for state updates
export type StateEventType =
  | 'MAP_MOVED'
  | 'MAP_LAYER_CHANGED'
  | 'MAP_METRIC_CHANGED'
  | 'MAP_COMMAND_EXECUTED'
  | 'PRECINCT_SELECTED'
  | 'PRECINCT_DESELECTED'
  | 'MUNICIPALITY_SELECTED'
  | 'BOUNDARY_SELECTED'
  | 'BOUNDARY_DESELECTED'
  | 'IQBUILDER_TAB_CHANGED'
  | 'ANALYSIS_COMPLETED'
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_STEP_CHANGED'
  | 'WORKFLOW_COMPLETED'
  | 'USER_QUERY_SUBMITTED'
  | 'SUGGESTION_ACCEPTED'
  | 'SUGGESTION_IGNORED'
  | 'USER_IDLE'
  | 'USER_ACTIVE'
  | 'SESSION_STARTED'
  | 'SESSION_RESUMED'
  | 'SEGMENT_FILTER_CHANGED'
  | 'SEGMENT_CREATED'
  | 'SEGMENT_SAVED'
  | 'SAVED_SEGMENT_UPDATED'
  | 'COMPARISON_STARTED'
  | 'COMPARISON_COMPLETED'
  | 'COMPARISON_LOADED'
  | 'COMPARISON_CLEARED'
  | 'COMPARISON_ENTITY_SELECTED'
  | 'REPORT_GENERATION_STARTED'
  | 'REPORT_GENERATION_COMPLETED'
  | 'DATA_EXPORTED'
  | 'TOOL_CHANGED'
  // Temporal Visualization events (Phase 11)
  | 'TEMPORAL_MODE_ENABLED'
  | 'TEMPORAL_MODE_DISABLED'
  | 'TEMPORAL_YEAR_CHANGED'
  | 'TEMPORAL_COMPARISON_CHANGED'
  | 'TEMPORAL_ANIMATION_STARTED'
  | 'TEMPORAL_ANIMATION_STOPPED'
  // Expertise tracking events (Phase 12)
  | 'EXPERTISE_LEVEL_CHANGED'
  | 'HELP_REQUESTED'
  | 'SHORTCUT_USED'
  // Numbered Markers (Wave 5D - Issue #17)
  | 'NUMBERED_MARKERS_UPDATED'
  | 'NUMBERED_MARKERS_CLEARED'
  // Loading State (P0-9 Error Recovery)
  | 'LOADING_STARTED'
  | 'LOADING_SUCCESS'
  | 'LOADING_ERROR'
  | 'LOADING_RETRY'
  | 'ERROR_RECOVERED'
  // Session Management (P2 Fix)
  | 'SESSION_EXPIRED'
  | 'SESSION_CLEARED'
  | UnifiedStateEventType;

export interface StateEvent {
  type: StateEventType;
  payload: Record<string, unknown>;
  timestamp: Date;
}

// Listener callback type
export type StateListener = (state: ApplicationState, event: StateEvent) => void;

// ============================================================================
// ApplicationStateManager Singleton
// ============================================================================

class ApplicationStateManager {
  private static instance: ApplicationStateManager;
  private state: ApplicationState;
  private listeners: Set<StateListener> = new Set();
  private idleTimer: NodeJS.Timeout | null = null;
  private idleThreshold = 30000; // 30 seconds

  private readonly STORAGE_KEY = 'political-ai-session';
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // P2 Fix: 30 minutes idle timeout
  private readonly LAST_ACTIVITY_KEY = 'political-ai-last-activity';

  private constructor() {
    this.state = this.createInitialState();
    this.checkSessionExpiration(); // P2 Fix: Check session expiration on init
    this.loadPersistedState();
    this.loadPersistedSession();
    this.startIdleTracking();
  }

  static getInstance(): ApplicationStateManager {
    if (!ApplicationStateManager.instance) {
      ApplicationStateManager.instance = new ApplicationStateManager();
    }
    return ApplicationStateManager.instance;
  }

  // ============================================================================
  // State Access
  // ============================================================================

  getState(): ApplicationState {
    return { ...this.state };
  }

  getMapState(): MapState {
    return { ...this.state.map };
  }

  getSelectionState(): SelectionState {
    return { ...this.state.selection };
  }

  getWorkflowState(): WorkflowState {
    return { ...this.state.workflow };
  }

  getBehaviorState(): BehaviorState {
    return {
      ...this.state.behavior,
      exploredPrecincts: new Set(this.state.behavior.exploredPrecincts),
      exploredMunicipalities: new Set(this.state.behavior.exploredMunicipalities),
    };
  }

  getSegmentationState(): SegmentationState {
    return { ...this.state.segmentation };
  }

  getComparisonState(): ComparisonState {
    return { ...this.state.comparison };
  }

  getReportState(): ReportState {
    return { ...this.state.reports };
  }

  getCurrentTool(): ToolType {
    return this.state.currentTool;
  }

  getExplorationHistory(): ExplorationHistoryEntry[] {
    return [...this.state.explorationHistory];
  }

  getToolContexts(): ToolContexts {
    return { ...this.state.toolContexts };
  }

  getSharedMapState(): SharedMapState {
    return { ...this.state.sharedMapState };
  }

  /**
   * Get current active map layer information
   */
  getActiveMapLayer(): { layerType: string | null; metric: string | null } {
    const mapState = this.state.sharedMapState;
    return {
      layerType: mapState?.layer || null,
      metric: mapState?.metric || null,
    };
  }

  /**
   * Check if a specific visualization is already active
   */
  isVisualizationActive(type: string, metric?: string): boolean {
    const active = this.getActiveMapLayer();
    if (type !== active.layerType) return false;
    if (metric && metric !== active.metric) return false;
    return true;
  }

  getFeatureSelectionState(): FeatureSelectionState {
    return { ...this.state.featureSelection };
  }

  getCurrentFeature(): SelectedFeatureData | null {
    return this.state.featureSelection.currentFeature;
  }

  // ============================================================================
  // Feature Selection Methods (Phase G)
  // ============================================================================

  /**
   * Select a map feature and dispatch FEATURE_SELECTED event
   */
  selectFeature(feature: SelectedFeatureData): void {
    // Update current feature
    this.state.featureSelection.currentFeature = feature;

    // Add to history (keep last 20)
    this.state.featureSelection.featureHistory.push({
      feature,
      timestamp: new Date(),
    });
    if (this.state.featureSelection.featureHistory.length > 20) {
      this.state.featureSelection.featureHistory.shift();
    }

    // Dispatch event
    this.dispatch({
      type: 'FEATURE_SELECTED',
      payload: {
        featureId: feature.id,
        featureName: feature.name,
        featureType: feature.featureType,
        metrics: feature.metrics,
        feature,
      },
      timestamp: new Date(),
    });

    // Detect high-value findings (Principle 6: Serendipitous Discoveries)
    // Use Number() to handle metrics that may be strings
    const swingPotential = Number(feature.metrics?.swing_potential ?? feature.metrics?.swingPotential ?? 0);
    const gotvPriority = Number(feature.metrics?.gotv_priority ?? feature.metrics?.gotvPriority ?? 0);
    const isHighSwing = !isNaN(swingPotential) && swingPotential > 70;
    const isHighGotv = !isNaN(gotvPriority) && gotvPriority > 70;

    // Also track in exploration history with high-value flags
    this.logExploration({
      tool: this.state.currentTool,
      action: `selected ${feature.featureType}`,
      precinctIds: feature.featureType === 'precinct' ? [feature.id] : undefined,
      result: feature.name,
      metadata: {
        featureType: feature.featureType,
        ...feature.metrics,
        // Set high-value flags for output suggestion triggering
        highSwing: isHighSwing,
        highGotv: isHighGotv,
      },
    });

    // Log high-value discovery for debugging
    if (isHighSwing || isHighGotv) {
      console.log('[StateManager] High-value precinct discovered:', {
        name: feature.name,
        highSwing: isHighSwing,
        highGotv: isHighGotv,
        swingPotential,
        gotvPriority,
      });
    }
  }

  /**
   * Deselect current map feature
   */
  deselectFeature(): void {
    if (this.state.featureSelection.currentFeature) {
      this.state.featureSelection.currentFeature = null;

      this.dispatch({
        type: 'FEATURE_DESELECTED',
        payload: {},
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get recent feature selections for context
   */
  getRecentFeatures(count: number = 5): SelectedFeatureData[] {
    return this.state.featureSelection.featureHistory
      .slice(-count)
      .map(h => h.feature)
      .reverse();
  }

  // ============================================================================
  // Temporal Visualization Methods (Phase 11)
  // ============================================================================

  /**
   * Get current temporal visualization state
   */
  getTemporalState(): TemporalVisualizationState {
    return { ...this.state.temporal_viz };
  }

  /**
   * Set temporal mode state from map component (Phase 16)
   * Syncs temporal state to ApplicationStateManager for AI context awareness
   */
  setTemporalMode(enabled: boolean, year?: number): void {
    this.state.sharedMapState = {
      ...this.state.sharedMapState,
      isTemporalMode: enabled,
      selectedElectionYear: year,
    };

    this.dispatch({
      type: 'TEMPORAL_MODE_CHANGED',
      payload: { enabled, year },
      timestamp: new Date(),
    });
  }

  /**
   * Get current temporal state for AI context (Phase 16)
   */
  getTemporalStateForAI(): { isTemporalMode: boolean; selectedElectionYear: number | null } {
    return {
      isTemporalMode: this.state.sharedMapState?.isTemporalMode || false,
      selectedElectionYear: this.state.sharedMapState?.selectedElectionYear || null,
    };
  }

  /**
   * Enable temporal visualization mode
   */
  enableTemporalMode(year?: number): void {
    this.state.temporal_viz.isTemporalMode = true;
    if (year) {
      this.state.temporal_viz.selectedYear = year;
    }

    this.dispatch({
      type: 'TEMPORAL_MODE_ENABLED',
      payload: { year: year || this.state.temporal_viz.selectedYear },
      timestamp: new Date(),
    });
  }

  /**
   * Disable temporal visualization mode
   */
  disableTemporalMode(): void {
    this.state.temporal_viz.isTemporalMode = false;
    this.state.temporal_viz.isPlaying = false;

    this.dispatch({
      type: 'TEMPORAL_MODE_DISABLED',
      payload: {},
      timestamp: new Date(),
    });
  }

  /**
   * Set the selected year for temporal visualization
   */
  setSelectedYear(year: number): void {
    const previousYear = this.state.temporal_viz.selectedYear;
    this.state.temporal_viz.selectedYear = year;

    this.dispatch({
      type: 'TEMPORAL_YEAR_CHANGED',
      payload: { year, previousYear },
      timestamp: new Date(),
    });

    // Log exploration action
    this.logExploration({
      tool: this.state.currentTool,
      action: `changed election year to ${year}`,
      result: `Viewing ${year} election data`,
      metadata: { previousYear, newYear: year },
    });
  }

  /**
   * Set comparison years for side-by-side or trend analysis
   */
  setComparisonYears(years: number[]): void {
    this.state.temporal_viz.comparisonYears = years;

    this.dispatch({
      type: 'TEMPORAL_COMPARISON_CHANGED',
      payload: { years },
      timestamp: new Date(),
    });
  }

  /**
   * Set temporal visualization mode (slider, animated, comparison, momentum)
   */
  setTemporalVisualizationMode(mode: TemporalVisualizationState['visualizationMode']): void {
    this.state.temporal_viz.visualizationMode = mode;
  }

  /**
   * Start temporal animation
   */
  startTemporalAnimation(): void {
    this.state.temporal_viz.isPlaying = true;

    this.dispatch({
      type: 'TEMPORAL_ANIMATION_STARTED',
      payload: { speed: this.state.temporal_viz.animationSpeed },
      timestamp: new Date(),
    });
  }

  /**
   * Stop temporal animation
   */
  stopTemporalAnimation(): void {
    this.state.temporal_viz.isPlaying = false;

    this.dispatch({
      type: 'TEMPORAL_ANIMATION_STOPPED',
      payload: {},
      timestamp: new Date(),
    });
  }

  /**
   * Get temporal context for AI prompts
   */
  getTemporalContextForAI(): string | null {
    const temporal = this.state.temporal_viz;

    if (!temporal.isTemporalMode && !temporal.selectedYear) {
      return null;
    }

    const parts: string[] = [];

    if (temporal.isTemporalMode) {
      parts.push(`Temporal mode active (${temporal.visualizationMode})`);
    }

    if (temporal.selectedYear) {
      parts.push(`Viewing ${temporal.selectedYear} election data`);
    }

    if (temporal.comparisonYears.length > 0) {
      parts.push(`Comparing years: ${temporal.comparisonYears.join(' vs ')}`);
    }

    if (temporal.isPlaying) {
      parts.push('Animation playing');
    }

    if (temporal.availableYears.length > 0) {
      parts.push(`Available elections: ${temporal.availableYears.join(', ')}`);
    }

    return parts.length > 0 ? parts.join('\n') : null;
  }

  /**
   * Get suggestions for temporal analysis based on current state
   */
  getTemporalSuggestions(): Array<{
    id: string;
    label: string;
    action: string;
    reason: string;
  }> {
    const temporal = this.state.temporal_viz;
    const suggestions: Array<{ id: string; label: string; action: string; reason: string }> = [];

    // If viewing a specific year, suggest comparison
    if (temporal.selectedYear && temporal.comparisonYears.length === 0) {
      const otherYears = temporal.availableYears.filter(y => y !== temporal.selectedYear);
      if (otherYears.length > 0) {
        suggestions.push({
          id: 'compare-elections',
          label: `Compare to ${otherYears[otherYears.length - 1]}`,
          action: `temporal:compare:${temporal.selectedYear}:${otherYears[otherYears.length - 1]}`,
          reason: 'See how results changed between elections',
        });
      }
    }

    // If not in temporal mode, suggest enabling it
    if (!temporal.isTemporalMode && temporal.availableYears.length > 1) {
      suggestions.push({
        id: 'enable-temporal',
        label: 'View election trends over time',
        action: 'temporal:enable',
        reason: 'Analyze how precincts have shifted across elections',
      });
    }

    // If in temporal mode but not animating, suggest animation
    if (temporal.isTemporalMode && !temporal.isPlaying && temporal.availableYears.length > 2) {
      suggestions.push({
        id: 'animate-temporal',
        label: 'Animate election history',
        action: 'temporal:animate',
        reason: 'Watch how the map changes over time',
      });
    }

    // Suggest momentum analysis if comparing years
    if (temporal.comparisonYears.length === 2) {
      suggestions.push({
        id: 'momentum-analysis',
        label: 'Show momentum heatmap',
        action: 'temporal:momentum',
        reason: 'Visualize which precincts are shifting most',
      });
    }

    return suggestions;
  }

  // ============================================================================
  // Numbered Markers Methods (Wave 5D - Issue #17)
  // ============================================================================

  /**
   * Set numbered markers (clears existing before adding new)
   * This ensures deduplication - only one source can have markers at a time
   */
  setNumberedMarkers(markers: Array<{ precinctId: string; number: number }>): void {
    // Generate unique IDs for tracking
    const markersWithIds = markers.map((m, i) => ({
      id: `marker-${Date.now()}-${i}`,
      ...m,
    }));

    this.state.numberedMarkers = markersWithIds;

    this.dispatch({
      type: 'NUMBERED_MARKERS_UPDATED',
      payload: { markers: markersWithIds },
      timestamp: new Date(),
    });
  }

  /**
   * Clear all numbered markers
   */
  clearNumberedMarkers(): void {
    this.state.numberedMarkers = [];

    this.dispatch({
      type: 'NUMBERED_MARKERS_CLEARED',
      payload: {},
      timestamp: new Date(),
    });
  }

  /**
   * Get current numbered markers
   */
  getNumberedMarkers(): Array<{ id: string; precinctId: string; number: number }> {
    return this.state.numberedMarkers;
  }

  // ============================================================================
  // Loading State Management (P0-9 Error Recovery)
  // ============================================================================

  /**
   * Get current loading state
   */
  getLoadingState(): LoadingState {
    return {
      ...this.state.loading,
      activeOperations: new Map(this.state.loading.activeOperations),
    };
  }

  /**
   * Check if any operations are currently loading
   */
  isLoading(): boolean {
    return this.state.loading.isAnyLoading;
  }

  /**
   * Check if a specific operation is loading
   */
  isOperationLoading(operationId: string): boolean {
    const op = this.state.loading.activeOperations.get(operationId);
    return op?.status === 'loading';
  }

  /**
   * Start a loading operation
   */
  startLoading(operationId: string, operationName: string): void {
    const operation: LoadingOperation = {
      id: operationId,
      name: operationName,
      startTime: Date.now(),
      status: 'loading',
      retryCount: 0,
    };

    this.state.loading.activeOperations.set(operationId, operation);
    this.state.loading.isAnyLoading = true;

    this.dispatch({
      type: 'LOADING_STARTED',
      payload: { operationId, operationName },
      timestamp: new Date(),
    });
  }

  /**
   * Mark a loading operation as successful
   */
  loadingSuccess(operationId: string): void {
    const operation = this.state.loading.activeOperations.get(operationId);
    if (operation) {
      operation.status = 'success';
      this.state.loading.activeOperations.delete(operationId);
    }

    // Update isAnyLoading
    this.state.loading.isAnyLoading = Array.from(
      this.state.loading.activeOperations.values()
    ).some(op => op.status === 'loading');

    this.dispatch({
      type: 'LOADING_SUCCESS',
      payload: { operationId },
      timestamp: new Date(),
    });
  }

  /**
   * Mark a loading operation as failed
   */
  loadingError(operationId: string, error: string): void {
    const operation = this.state.loading.activeOperations.get(operationId);
    const operationName = operation?.name || operationId;

    if (operation) {
      operation.status = 'error';
      operation.error = error;
    }

    // Track error in recent errors (keep last 10)
    this.state.loading.recentErrors.push({
      operationId,
      operationName,
      error,
      timestamp: new Date(),
      recovered: false,
    });
    if (this.state.loading.recentErrors.length > 10) {
      this.state.loading.recentErrors.shift();
    }

    this.state.loading.lastError = error;
    this.state.loading.activeOperations.delete(operationId);

    // Update isAnyLoading
    this.state.loading.isAnyLoading = Array.from(
      this.state.loading.activeOperations.values()
    ).some(op => op.status === 'loading');

    this.dispatch({
      type: 'LOADING_ERROR',
      payload: { operationId, operationName, error },
      timestamp: new Date(),
    });
  }

  /**
   * Retry a failed loading operation
   */
  retryLoading(operationId: string, operationName: string): void {
    const existingOp = this.state.loading.activeOperations.get(operationId);
    const retryCount = (existingOp?.retryCount || 0) + 1;

    const operation: LoadingOperation = {
      id: operationId,
      name: operationName,
      startTime: Date.now(),
      status: 'loading',
      retryCount,
    };

    this.state.loading.activeOperations.set(operationId, operation);
    this.state.loading.isAnyLoading = true;

    this.dispatch({
      type: 'LOADING_RETRY',
      payload: { operationId, operationName, retryCount },
      timestamp: new Date(),
    });
  }

  /**
   * Mark an error as recovered
   */
  markErrorRecovered(operationId: string): void {
    const errorEntry = this.state.loading.recentErrors.find(
      e => e.operationId === operationId && !e.recovered
    );
    if (errorEntry) {
      errorEntry.recovered = true;
    }

    // Clear last error if it was this operation
    if (this.state.loading.lastError) {
      const lastErrorEntry = this.state.loading.recentErrors
        .slice()
        .reverse()
        .find(e => !e.recovered);
      this.state.loading.lastError = lastErrorEntry?.error || null;
    }

    this.dispatch({
      type: 'ERROR_RECOVERED',
      payload: { operationId },
      timestamp: new Date(),
    });
  }

  /**
   * Get recent errors for display
   */
  getRecentErrors(maxCount: number = 5): LoadingState['recentErrors'] {
    return this.state.loading.recentErrors.slice(-maxCount);
  }

  /**
   * Get unrecovered errors
   */
  getUnrecoveredErrors(): LoadingState['recentErrors'] {
    return this.state.loading.recentErrors.filter(e => !e.recovered);
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.state.loading.recentErrors = [];
    this.state.loading.lastError = null;
  }

  // ============================================================================
  // Unified AI Architecture Methods
  // ============================================================================

  /**
   * Set the current active tool
   */
  setCurrentTool(tool: ToolType): void {
    const previousTool = this.state.currentTool;
    this.state.currentTool = tool;

    // Clear numbered markers when switching tools to prevent stale markers
    this.clearNumberedMarkers();

    this.dispatch({
      type: 'TOOL_SWITCHED',
      payload: { from: previousTool, to: tool },
      timestamp: new Date(),
    });
  }

  /**
   * Log an exploration action
   */
  logExploration(entry: Omit<ExplorationHistoryEntry, 'timestamp'>): void {
    const fullEntry: ExplorationHistoryEntry = {
      ...entry,
      timestamp: new Date(),
    };

    this.state.explorationHistory.push(fullEntry);

    // Keep only last 50 entries
    if (this.state.explorationHistory.length > 50) {
      this.state.explorationHistory.shift();
    }

    this.dispatch({
      type: 'EXPLORATION_LOGGED',
      payload: { entry: fullEntry },
      timestamp: new Date(),
    });
  }

  /**
   * Update tool-specific context
   */
  updateToolContext<T extends keyof ToolContexts>(
    tool: T,
    context: Partial<ToolContexts[T]>
  ): void {
    this.state.toolContexts[tool] = {
      ...this.state.toolContexts[tool],
      ...context,
    } as ToolContexts[T];

    this.dispatch({
      type: 'TOOL_CONTEXT_UPDATED',
      payload: { tool, context },
      timestamp: new Date(),
    });
  }

  /**
   * Update shared map state
   */
  updateSharedMapState(state: Partial<SharedMapState>): void {
    this.state.sharedMapState = {
      ...this.state.sharedMapState,
      ...state,
    };

    this.dispatch({
      type: 'SHARED_MAP_UPDATED',
      payload: { state },
      timestamp: new Date(),
    });
  }

  /**
   * Subscribe to specific state changes that affect map (P1-10)
   * Returns unsubscribe function
   */
  subscribeToMapState(callback: (mapState: SharedMapState, event: StateEvent) => void): () => void {
    const listener: StateListener = (state, event) => {
      // Only notify on map-related events
      const mapEvents: StateEventType[] = [
        'SHARED_MAP_UPDATED',
        'MAP_MOVED',
        'MAP_LAYER_CHANGED',
        'MAP_METRIC_CHANGED',
        'MAP_COMMAND_EXECUTED',
        'TEMPORAL_MODE_CHANGED',
        'PRECINCT_SELECTED',
        'PRECINCT_DESELECTED',
        'FEATURE_SELECTED',
        'FEATURE_DESELECTED',
        'SEGMENT_FILTER_CHANGED',
      ];

      if (mapEvents.includes(event.type)) {
        callback(state.sharedMapState, event);
      }
    };

    return this.subscribe(listener);
  }

  /**
   * Subscribe to tool context changes (P1-10)
   * Allows components to react when toolContext updates
   */
  subscribeToToolContext<T extends keyof ToolContexts>(
    tool: T,
    callback: (context: ToolContexts[T], event: StateEvent) => void
  ): () => void {
    const listener: StateListener = (state, event) => {
      if (event.type === 'TOOL_CONTEXT_UPDATED' && event.payload.tool === tool) {
        callback(state.toolContexts[tool], event);
      }
    };

    return this.subscribe(listener);
  }

  /**
   * Get formatted context for AI prompts
   * Phase 4: Enhanced with richer context for Claude
   */
  getContextForAI(): string {
    const parts: string[] = [];
    const metrics = this.getExplorationMetrics();
    const depth = this.getExplorationDepth();

    // Current tool and exploration depth
    parts.push(`Current tool: ${this.state.currentTool}`);
    parts.push(`Exploration depth: ${depth}/100 (${depth > 60 ? 'deep' : depth > 30 ? 'moderate' : 'early'} exploration)`);

    // Temporal visualization context (Phase 16)
    const temporalState = this.getTemporalStateForAI();
    if (temporalState.isTemporalMode && temporalState.selectedElectionYear) {
      parts.push(`Temporal mode active: viewing ${temporalState.selectedElectionYear} election data`);
    } else if (temporalState.selectedElectionYear) {
      parts.push(`Viewing ${temporalState.selectedElectionYear} election data`);
    }

    // Session metrics
    parts.push(`Session: ${metrics.precinctsViewed} precincts viewed, ${metrics.filtersApplied} filters applied, ${metrics.comparisonsMade} comparisons`);

    // IQ "last area" is stale once the user focuses a new map feature — omit it so chat/deep-dive match current focus
    if (
      !this.state.featureSelection.currentFeature &&
      this.state.iqBuilder.lastAnalysis?.areaName
    ) {
      const n = this.state.iqBuilder.lastAnalysis.precincts?.length ?? 0;
      parts.push(
        `IQ area analysis (use as "this area" when the user says so): ${this.state.iqBuilder.lastAnalysis.areaName} — ${n} precincts`
      );
    }
    if (this.state.featureSelection.currentFeature) {
      const f = this.state.featureSelection.currentFeature;
      parts.push(`Current map focus: ${f.name} (${f.featureType})`);
    }
    if (metrics.toolsVisited.length > 1) {
      parts.push(`Tools visited: ${metrics.toolsVisited.join(', ')}`);
    }

    // Explored precincts (with names if available)
    const exploredPrecincts = Array.from(this.state.behavior.exploredPrecincts);
    if (exploredPrecincts.length > 0) {
      const precinctList = exploredPrecincts.slice(-5).join(', ');
      parts.push(`Recent precincts: ${precinctList}${exploredPrecincts.length > 5 ? ` (+${exploredPrecincts.length - 5} more)` : ''}`);
    }

    // Tool-specific active context
    switch (this.state.currentTool) {
      case 'segments': {
        const segCtx = this.state.toolContexts.segments;
        const filters = segCtx.filters;
        if (filters) {
          const filterKeys = Object.keys(filters).filter(k => {
            const val = filters[k as keyof typeof filters];
            return val !== null && val !== undefined;
          });
          parts.push(`Segment filters: ${filterKeys.length > 0 ? filterKeys.join(', ') : 'none'}`);
          parts.push(`Matching precincts: ${segCtx.matchingPrecincts.length}`);
        }
        break;
      }

      case 'compare': {
        const compareCtx = this.state.toolContexts.compare;
        if (compareCtx.leftEntity && compareCtx.rightEntity) {
          parts.push(`Comparing: ${compareCtx.leftEntity.name} vs ${compareCtx.rightEntity.name}`);
          parts.push(`Comparison type: ${compareCtx.leftEntity.type}`);
        }
        break;
      }
    }

    // Map state
    if (this.state.sharedMapState.layer !== 'none') {
      parts.push(
        `Map layer: ${this.state.sharedMapState.layer}${this.state.sharedMapState.metric ? ` showing ${this.state.sharedMapState.metric}` : ''
        }`
      );
    }
    if (this.state.sharedMapState.highlights.length > 0) {
      const highlightList = this.state.sharedMapState.highlights.slice(0, 5).join(', ');
      parts.push(`Highlighted: ${highlightList}${this.state.sharedMapState.highlights.length > 5 ? '...' : ''}`);
    }

    // Selection history (recent feature/precinct/municipality selections)
    const selectionHistory = this.state.selection.selectionHistory.slice(-5);
    if (selectionHistory.length > 0) {
      parts.push('Recent selections:');
      selectionHistory.forEach(sel => {
        let selDetail = `- ${sel.type}: ${sel.name}`;
        if (sel.metrics) {
          const keys = Object.keys(sel.metrics);
          const preferred = ['partisan_lean', 'swing_potential', 'gotv_priority', 'persuasion_opportunity'];
          const metricKeys = [
            ...preferred.filter((k) => keys.includes(k)),
            ...keys.filter((k) => !preferred.includes(k)),
          ].slice(0, 5);
          const metricStr = metricKeys
            .map((k) => {
              const raw = sel.metrics![k];
              if (k === 'partisan_lean') {
                const n = typeof raw === 'number' ? raw : Number(raw);
                if (!Number.isNaN(n)) {
                  return `${k}: ${formatPartisanLeanPanel(n)}`;
                }
              }
              return `${k}: ${raw}`;
            })
            .join(', ');
          if (metricStr) {
            selDetail += ` (${metricStr})`;
          }
        }
        parts.push(selDetail);
      });
    }

    // Recent exploration actions (more detailed)
    const recentActions = this.state.explorationHistory.slice(-5);
    if (recentActions.length > 0) {
      const actionDetails = recentActions.map(a => {
        let detail = `${a.action}`;
        if (a.precinctIds && a.precinctIds.length > 0) {
          detail += ` (${a.precinctIds.slice(0, 2).join(', ')}${a.precinctIds.length > 2 ? '...' : ''})`;
        }
        return detail;
      });
      parts.push(`Recent actions: ${actionDetails.join('; ')}`);
    }

    // High-value findings flag
    if (metrics.highValueFound) {
      parts.push(`Note: User has found high-value precincts (high swing or GOTV)`);
    }

    // Saved segments
    if (this.state.segmentation.savedSegments.length > 0) {
      parts.push(`Saved segments: ${this.state.segmentation.savedSegments.length}`);
    }

    // Temporal visualization context (Phase 11)
    const temporalContext = this.getTemporalContextForAI();
    if (temporalContext) {
      parts.push(`\nTemporal visualization:\n${temporalContext}`);
    }

    // Campaign state context (Phase 17)
    const campaignContext = this.getCampaignContextForAI();
    if (campaignContext) {
      parts.push(`\n${campaignContext}`);
    }

    // User expertise context (Phase 12)
    const expertiseContext = this.getExpertiseContextForAI();
    parts.push(`\n${expertiseContext}`);

    return parts.join('\n');
  }

  // ============================================================================
  // Settings Integration (Phase 17)
  // ============================================================================

  /**
   * Get campaign state for AI context.
   * Provides election dates, deadlines, and current campaign phase.
   */
  getCampaignState(): CampaignState {
    return getSettingsManager().getCampaignState();
  }

  /**
   * Get all settings (read-only copy).
   */
  getSettings(): AllSettings {
    return getSettingsManager().getAll();
  }

  /**
   * Get a specific category of settings.
   */
  getSettingsCategory<K extends keyof AllSettings>(category: K): AllSettings[K] {
    return getSettingsManager().get(category);
  }

  /**
   * Format campaign state for AI context injection.
   */
  getCampaignContextForAI(): string | null {
    try {
      const state = this.getCampaignState();
      const settings = getSettingsManager();
      const aiSettings = settings.get('ai');
      const targetingSettings = settings.get('targeting');

      const parts: string[] = [];

      // Campaign phase
      parts.push(`Campaign phase: ${this.formatPhaseForAI(state.currentPhase)}`);

      // Days until election
      if (state.daysUntilElection > 0) {
        parts.push(`Days until election: ${state.daysUntilElection}`);
      }

      // Upcoming deadlines (show urgent ones)
      const urgentDeadlines = state.upcomingDeadlines.filter(d => d.isUrgent);
      if (urgentDeadlines.length > 0) {
        const deadlineStr = urgentDeadlines
          .map(d => `${d.name} (${d.daysRemaining} days)`)
          .join(', ');
        parts.push(`⚠️ Urgent deadlines: ${deadlineStr}`);
      }

      // Targeting strategy
      parts.push(`Strategy: ${targetingSettings.strategy}`);

      // AI preferences that affect responses
      if (aiSettings.responseStyle !== 'auto') {
        parts.push(`Response style: ${aiSettings.responseStyle}`);
      }

      return parts.length > 0 ? `Campaign context:\n${parts.join('\n')}` : null;
    } catch {
      // Settings may not be available during SSR
      return null;
    }
  }

  /**
   * Format campaign phase for AI-friendly description.
   */
  private formatPhaseForAI(phase: CampaignState['currentPhase']): string {
    const phaseDescriptions: Record<CampaignState['currentPhase'], string> = {
      pre_primary: 'Pre-Primary (focus: voter ID, early persuasion)',
      primary_gotv: 'Primary GOTV (focus: base mobilization)',
      general_id: 'General ID Phase (focus: expand universe, identify supporters)',
      general_persuasion: 'General Persuasion (focus: swing voters)',
      general_gotv: 'General GOTV (focus: final mobilization, turnout)',
      post_election: 'Post-Election (focus: analysis, retention)',
    };
    return phaseDescriptions[phase] || phase;
  }

  // ============================================================================
  // User Expertise Tracking (Phase 12)
  // ============================================================================

  /**
   * Get current user expertise state
   */
  getExpertiseState(): ExpertiseState {
    return { ...this.state.expertise };
  }

  /**
   * Get the current inferred expertise level
   */
  getUserExpertiseLevel(): UserExpertiseLevel {
    return this.state.expertise.currentLevel;
  }

  /**
   * Infer user expertise level from behavior patterns
   * Called periodically to update expertise assessment
   */
  inferUserExpertise(): UserExpertiseLevel {
    const indicators = this.state.expertise.indicators;
    const behavior = this.state.behavior;

    // Calculate score based on indicators
    let expertScore = 0;
    let noviceScore = 0;

    // Action speed (power users are faster)
    if (indicators.avgActionSpeed < 1000) expertScore += 20;
    else if (indicators.avgActionSpeed < 2000) expertScore += 10;
    else if (indicators.avgActionSpeed > 4000) noviceScore += 15;

    // Complex query ratio (power users ask complex questions)
    if (indicators.complexQueryRatio > 0.5) expertScore += 20;
    else if (indicators.complexQueryRatio > 0.3) expertScore += 10;
    else if (indicators.complexQueryRatio < 0.1) noviceScore += 15;

    // Help requests (novices request more help)
    if (indicators.helpsRequested > 5) noviceScore += 20;
    else if (indicators.helpsRequested > 2) noviceScore += 10;
    else if (indicators.helpsRequested === 0 && indicators.sessionCount > 2) expertScore += 10;

    // Shortcut usage (power users use shortcuts)
    if (indicators.shortcutsUsed > 10) expertScore += 15;
    else if (indicators.shortcutsUsed > 3) expertScore += 8;

    // Exploration breadth (power users explore widely)
    const uniqueTools = new Set(behavior.queriesAsked.map(q => q.split(':')[0])).size;
    if (uniqueTools > 4 || indicators.explorationBreadth > 5) expertScore += 15;
    else if (uniqueTools < 2 && behavior.actionsThisSession.length > 10) noviceScore += 10;

    // Session count (returning users are more experienced)
    if (indicators.sessionCount > 5) expertScore += 10;
    else if (indicators.sessionCount === 1) noviceScore += 5;

    // Precision clicks (experts are precise)
    const totalClicks = behavior.actionsThisSession.filter(a => a.type.includes('click')).length;
    if (totalClicks > 0) {
      const precisionRatio = indicators.precisionClicks / totalClicks;
      if (precisionRatio > 0.8) expertScore += 10;
      else if (precisionRatio < 0.4) noviceScore += 10;
    }

    // Determine level based on scores
    const netScore = expertScore - noviceScore;
    let newLevel: UserExpertiseLevel;
    let confidence: number;

    if (netScore > 30) {
      newLevel = 'power_user';
      confidence = Math.min(95, 50 + netScore);
    } else if (netScore < -15) {
      newLevel = 'novice';
      confidence = Math.min(95, 50 + Math.abs(netScore));
    } else {
      newLevel = 'intermediate';
      confidence = Math.min(80, 40 + Math.abs(netScore));
    }

    // Update state if level changed
    if (newLevel !== this.state.expertise.currentLevel) {
      const previousLevel = this.state.expertise.currentLevel;
      this.state.expertise.currentLevel = newLevel;
      this.state.expertise.confidenceScore = confidence;
      this.state.expertise.lastUpdated = new Date();

      // Track level history
      this.state.expertise.levelHistory.push({
        level: newLevel,
        timestamp: new Date(),
        reason: `Expert score: ${expertScore}, Novice score: ${noviceScore}`,
      });

      // Keep only last 10 entries
      if (this.state.expertise.levelHistory.length > 10) {
        this.state.expertise.levelHistory.shift();
      }

      // Dispatch event
      this.dispatch({
        type: 'EXPERTISE_LEVEL_CHANGED',
        payload: {
          previousLevel,
          newLevel,
          confidence,
          expertScore,
          noviceScore,
        },
        timestamp: new Date(),
      });
    } else {
      // Update confidence even if level didn't change
      this.state.expertise.confidenceScore = confidence;
      this.state.expertise.lastUpdated = new Date();
    }

    return newLevel;
  }

  /**
   * Record that user requested help/explanation
   */
  recordHelpRequest(): void {
    this.state.expertise.indicators.helpsRequested++;
    this.dispatch({
      type: 'HELP_REQUESTED',
      payload: { total: this.state.expertise.indicators.helpsRequested },
      timestamp: new Date(),
    });
    this.inferUserExpertise(); // Re-evaluate
  }

  /**
   * Record that user used a shortcut or quick action
   */
  recordShortcutUsed(shortcutType: string): void {
    this.state.expertise.indicators.shortcutsUsed++;
    this.dispatch({
      type: 'SHORTCUT_USED',
      payload: { shortcutType, total: this.state.expertise.indicators.shortcutsUsed },
      timestamp: new Date(),
    });
    this.inferUserExpertise(); // Re-evaluate
  }

  /**
   * Record a user action and update action speed metric
   */
  recordActionForExpertise(actionType: string, isComplex: boolean = false): void {
    const now = Date.now();
    const lastAction = this.state.behavior.actionsThisSession.slice(-1)[0];

    if (lastAction) {
      const timeSinceLastAction = now - lastAction.timestamp.getTime();
      // Update rolling average (last 20 actions)
      const currentAvg = this.state.expertise.indicators.avgActionSpeed;
      this.state.expertise.indicators.avgActionSpeed =
        (currentAvg * 0.9) + (timeSinceLastAction * 0.1);
    }

    // Update complex query ratio
    if (isComplex) {
      const totalQueries = this.state.behavior.queriesAsked.length || 1;
      const complexCount = this.state.expertise.indicators.complexQueryRatio * totalQueries + 1;
      this.state.expertise.indicators.complexQueryRatio = complexCount / (totalQueries + 1);
    }

    // Track exploration breadth
    const uniqueActions = new Set(
      this.state.behavior.actionsThisSession.map(a => a.type)
    ).size;
    this.state.expertise.indicators.explorationBreadth = uniqueActions;
  }

  /**
   * Get expertise context for AI prompts
   */
  getExpertiseContextForAI(): string {
    const expertise = this.state.expertise;
    const level = expertise.currentLevel;
    const confidence = expertise.confidenceScore;

    // Build context string
    const parts: string[] = [];

    parts.push(`User expertise: ${level} (${confidence}% confidence)`);

    // Add behavioral hints
    if (level === 'novice') {
      parts.push('Guidance: Explain terminology, provide context, suggest next steps');
    } else if (level === 'power_user') {
      parts.push('Guidance: Be concise, use data shorthand, skip basic explanations');
    } else {
      parts.push('Guidance: Balance detail with efficiency');
    }

    // Include response style from settings if available
    try {
      const aiSettings = getSettingsManager().get('ai');
      if (aiSettings.responseStyle !== 'auto') {
        parts.push(`Preferred style: ${aiSettings.responseStyle}`);
      }
    } catch {
      // Settings not available
    }

    return parts.join('\n');
  }

  // ============================================================================
  // Exploration Tracking & Output Suggestions (Phase 8)
  // ============================================================================

  /**
   * Calculate exploration depth score (0-100)
   * Higher scores indicate deeper exploration and more output potential
   */
  getExplorationDepth(): number {
    const metrics = this.getExplorationMetrics();
    let score = 0;

    // Precinct exploration (0-30 points)
    score += Math.min(30, metrics.precinctsViewed * 6);

    // Filter usage (0-20 points)
    score += Math.min(20, metrics.filtersApplied * 5);

    // Tool diversity (0-20 points)
    score += Math.min(20, metrics.toolsVisited.length * 5);

    // Session duration (0-15 points)
    score += Math.min(15, metrics.sessionDuration * 1.5);

    // High-value discovery (0-10 points)
    if (metrics.highValueFound) {
      score += 10;
    }

    // Comparisons made (0-5 points)
    score += Math.min(5, metrics.comparisonsMade * 2.5);

    return Math.min(100, Math.round(score));
  }

  /**
   * Get detailed exploration metrics for output suggestions
   */
  getExplorationMetrics(): {
    precinctsViewed: number;
    filtersApplied: number;
    toolsVisited: string[];
    sessionDuration: number;
    lastActivity: Date;
    highValueFound: boolean;
    comparisonsMade: number;
    segmentsSaved: number;
  } {
    const sessionStart = this.state.behavior.sessionStartTime;
    const sessionDuration = Math.round((Date.now() - sessionStart.getTime()) / 60000); // minutes

    // Count unique tools visited
    const toolsVisited = new Set<string>();
    this.state.explorationHistory.forEach(entry => {
      toolsVisited.add(entry.tool);
    });

    // Check for high-value precincts
    const highValueFound = this.state.explorationHistory.some(entry =>
      entry.metadata?.highSwing === true ||
      entry.metadata?.highGotv === true
    );

    // Count filters applied
    let filtersApplied = 0;
    if (this.state.segmentation.activeFilters) {
      const filters = this.state.segmentation.activeFilters;
      filtersApplied = Object.keys(filters).filter(key => {
        const value = filters[key as keyof typeof filters];
        return value !== null && value !== undefined &&
          (typeof value !== 'object' || Object.keys(value).length > 0);
      }).length;
    }

    // Count comparisons
    const comparisonsMade = this.state.explorationHistory.filter(
      entry => entry.action.includes('compare')
    ).length;

    return {
      precinctsViewed: this.state.behavior.exploredPrecincts.size,
      filtersApplied,
      toolsVisited: Array.from(toolsVisited),
      sessionDuration,
      lastActivity: this.state.behavior.lastInteractionTime,
      highValueFound,
      comparisonsMade,
      segmentsSaved: this.state.segmentation.savedSegments.length,
    };
  }

  /**
   * Get a human-readable summary of exploration activity
   */
  getExplorationSummary(): string {
    const metrics = this.getExplorationMetrics();
    const parts: string[] = [];

    if (metrics.precinctsViewed > 0) {
      parts.push(`${metrics.precinctsViewed} precinct${metrics.precinctsViewed !== 1 ? 's' : ''} explored`);
    }

    if (metrics.filtersApplied > 0) {
      parts.push(`${metrics.filtersApplied} filter${metrics.filtersApplied !== 1 ? 's' : ''} applied`);
    }

    if (metrics.toolsVisited.length > 1) {
      parts.push(`${metrics.toolsVisited.length} tools used`);
    }

    if (metrics.comparisonsMade > 0) {
      parts.push(`${metrics.comparisonsMade} comparison${metrics.comparisonsMade !== 1 ? 's' : ''}`);
    }

    if (metrics.segmentsSaved > 0) {
      parts.push(`${metrics.segmentsSaved} segment${metrics.segmentsSaved !== 1 ? 's' : ''} saved`);
    }

    if (parts.length === 0) {
      return 'No activity yet';
    }

    return parts.join(', ');
  }

  // ============================================================================
  // State Updates via Events
  // ============================================================================

  dispatch(event: StateEvent): void {
    this.updateState(event);
    this.notifyListeners(event);
    this.resetIdleTimer();
    // P2 Fix: Update last activity timestamp for session expiration tracking
    this.updateLastActivity();
    // Persist state after each change (P3-1)
    this.persistState();
    // Use enhanced persistence for richer cross-session context (Phase 9)
    this.persistEnhancedSession();
  }

  private updateState(event: StateEvent): void {
    const { type, payload } = event;

    // Track action
    this.state.behavior.actionsThisSession.push({
      type,
      target: payload.target as string | undefined,
      timestamp: event.timestamp,
      metadata: payload,
    });
    this.state.behavior.lastInteractionTime = event.timestamp;

    switch (type) {
      case 'MAP_MOVED':
        this.state.map.center = payload.center as [number, number];
        this.state.map.zoom = payload.zoom as number;
        this.state.map.extent = payload.extent as MapState['extent'];
        this.state.map.visiblePrecincts = payload.visiblePrecincts as string[] || [];
        this.state.temporal.timeInCurrentView = 0;
        // Sync to shared map state - ensure updateSharedMapState is called
        this.state.sharedMapState = {
          ...this.state.sharedMapState,
          center: payload.center as [number, number],
          zoom: payload.zoom as number,
          visiblePrecincts: payload.visiblePrecincts as string[] || [],
        };
        break;

      case 'MAP_LAYER_CHANGED':
        this.state.map.activeLayer = payload.layer as MapState['activeLayer'];
        break;

      case 'MAP_METRIC_CHANGED':
        this.state.map.activeMetric = payload.metric as string | null;
        break;

      case 'PRECINCT_SELECTED':
        this.state.selection.type = 'precinct';
        this.state.selection.selectedIds = [payload.precinctId as string];
        this.state.selection.selectedEntity = payload.precinct as PrecinctData;
        this.state.selection.selectionHistory.push({
          type: 'precinct',
          id: payload.precinctId as string,
          name: payload.precinctName as string,
          timestamp: event.timestamp,
          metrics: payload.metrics as Record<string, number> | undefined,
        });
        this.state.behavior.exploredPrecincts.add(payload.precinctId as string);
        break;

      case 'PRECINCT_DESELECTED':
        this.state.selection.type = 'none';
        this.state.selection.selectedIds = [];
        this.state.selection.selectedEntity = null;
        break;

      case 'MUNICIPALITY_SELECTED':
        this.state.selection.type = 'municipality';
        this.state.selection.selectedIds = [payload.municipalityId as string];
        this.state.selection.selectedEntity = payload.municipality as MunicipalityData;
        this.state.selection.selectionHistory.push({
          type: 'municipality',
          id: payload.municipalityId as string,
          name: payload.municipalityName as string,
          timestamp: event.timestamp,
        });
        this.state.behavior.exploredMunicipalities.add(payload.municipalityId as string);
        break;

      case 'BOUNDARY_SELECTED':
        this.state.selection.type = 'boundary';
        this.state.selection.selectedIds = payload.ids as string[];
        this.state.iqBuilder.boundaryType = payload.boundaryType as BoundaryLayerType;
        this.state.iqBuilder.selectedBoundaryIds = payload.ids as string[];
        break;

      case 'BOUNDARY_DESELECTED':
        this.state.iqBuilder.boundaryType = null;
        this.state.iqBuilder.selectedBoundaryIds = [];
        break;

      case 'IQBUILDER_TAB_CHANGED':
        this.state.iqBuilder.activeTab = payload.tab as IQBuilderState['activeTab'];
        break;

      case 'ANALYSIS_COMPLETED':
        this.state.iqBuilder.hasAnalysisResult = true;
        this.state.iqBuilder.lastAnalysis = payload.result as AreaAnalysisResult;
        break;

      case 'WORKFLOW_STARTED':
        this.state.workflow.activeWorkflow = payload.workflowId as string;
        this.state.workflow.workflowStep = 0;
        this.state.workflow.workflowData = {};
        break;

      case 'WORKFLOW_STEP_CHANGED':
        this.state.workflow.workflowStep = payload.step as number;
        break;

      case 'WORKFLOW_COMPLETED':
        this.state.workflow.activeWorkflow = null;
        this.state.workflow.workflowStep = 0;
        break;

      case 'USER_QUERY_SUBMITTED':
        this.state.behavior.queriesAsked.push(payload.query as string);
        break;

      case 'SUGGESTION_ACCEPTED':
        this.state.behavior.suggestionsAccepted.push(payload.suggestionId as string);
        break;

      case 'SUGGESTION_IGNORED':
        this.state.behavior.suggestionsIgnored.push(payload.suggestionId as string);
        break;

      case 'USER_IDLE':
        this.state.temporal.idleTime = payload.idleSeconds as number;
        break;

      case 'USER_ACTIVE':
        this.state.temporal.idleTime = 0;
        break;

      case 'SEGMENT_FILTER_CHANGED':
        this.state.segmentation.activeFilters = payload.filters as SegmentFilters;
        this.state.segmentation.filterCount = payload.filterCount as number;
        this.state.segmentation.matchingPrecincts = payload.matchingPrecincts as string[];
        this.state.segmentation.matchCount = payload.matchCount as number;
        // Sync to toolContexts for cross-tool state sharing
        this.state.toolContexts.segments = {
          ...this.state.toolContexts.segments,
          filters: payload.filters as SegmentFilters,
          matchingPrecincts: payload.matchingPrecincts as string[],
        };
        break;

      case 'SEGMENT_SAVED':
        this.state.segmentation.currentSegmentName = payload.name as string;
        break;

      case 'COMPARISON_STARTED':
        this.state.comparison.leftEntity = payload.leftEntity as ComparisonEntity | null;
        this.state.comparison.rightEntity = payload.rightEntity as ComparisonEntity | null;
        break;

      case 'COMPARISON_COMPLETED':
        this.state.comparison.similarityResults = payload.results as SimilarityResult[];
        break;

      case 'REPORT_GENERATION_STARTED':
        this.state.reports.generationStatus = 'generating';
        this.state.reports.selectedArea = payload.area as AreaSelection;
        break;

      case 'REPORT_GENERATION_COMPLETED':
        this.state.reports.generationStatus = 'complete';
        this.state.reports.lastGeneratedReport = payload.report as ReportMetadata;
        this.state.reports.recentReports.unshift(payload.report as ReportMetadata);
        // Keep only last 10 reports
        if (this.state.reports.recentReports.length > 10) {
          this.state.reports.recentReports.pop();
        }
        break;

      // Unified AI Architecture events
      case 'TOOL_SWITCHED':
        // Already handled in setCurrentTool
        break;

      case 'TOOL_CONTEXT_UPDATED':
        // Already handled in updateToolContext
        break;

      case 'EXPLORATION_LOGGED':
        // Already handled in logExploration
        break;

      case 'SHARED_MAP_UPDATED':
        // Already handled in updateSharedMapState
        break;

      // Handled by MAP_LAYER_CHANGED event (already exists)
      // case 'LAYER_CHANGED' removed - replaced with MAP_LAYER_CHANGED

      // Feature Selection events (Phase G)
      case 'FEATURE_SELECTED':
        // Already handled in selectFeature
        break;

      case 'FEATURE_DESELECTED':
        // Already handled in deselectFeature
        break;
    }
  }

  // ============================================================================
  // Listeners
  // ============================================================================

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: StateEvent): void {
    const stateCopy = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(stateCopy, event);
      } catch (error) {
        console.error('[ApplicationStateManager] Listener error:', error);
      }
    });
  }

  // ============================================================================
  // Idle Tracking
  // ============================================================================

  private startIdleTracking(): void {
    if (typeof window === 'undefined') return;

    this.resetIdleTimer();

    // Track user activity
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(eventType => {
      window.addEventListener(eventType, () => this.resetIdleTimer(), { passive: true });
    });
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    // Dispatch active event if was idle
    if (this.state.temporal.idleTime > 0) {
      this.state.temporal.idleTime = 0;
    }

    // Set timer to detect idle
    this.idleTimer = setTimeout(() => {
      this.dispatch({
        type: 'USER_IDLE',
        payload: { idleSeconds: this.idleThreshold / 1000 },
        timestamp: new Date(),
      });
    }, this.idleThreshold);
  }

  // ============================================================================
  // Session Persistence (P3-1)
  // ============================================================================

  /**
   * P2 Fix: Check if session has expired due to inactivity
   * Clear state and notify user if idle for more than 30 minutes
   */
  private checkSessionExpiration(): void {
    if (typeof window === 'undefined') return;

    try {
      const lastActivityStr = localStorage.getItem(this.LAST_ACTIVITY_KEY);
      if (!lastActivityStr) {
        // First visit or localStorage cleared - set initial activity time
        localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
        return;
      }

      const lastActivity = parseInt(lastActivityStr, 10);
      const timeSinceActivity = Date.now() - lastActivity;

      if (timeSinceActivity > this.SESSION_TIMEOUT_MS) {
        console.log('[ApplicationStateManager] Session expired after 30 minutes of inactivity');

        // Clear session data
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem('pol_session_context');
        sessionStorage.removeItem('pol_nav_source');
        sessionStorage.removeItem('pol_nav_precincts');
        sessionStorage.removeItem('pol_nav_timestamp');
        sessionStorage.removeItem('pol_nav_mapState');

        // Reset state to initial
        this.state = this.createInitialState();

        // Update activity timestamp
        localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());

        // Dispatch event so UI can show "session expired" message
        this.dispatch({
          type: 'SESSION_EXPIRED',
          payload: { expiredAfterMinutes: Math.round(timeSinceActivity / 60000) },
          timestamp: new Date(),
        });
      }
    } catch (e) {
      console.warn('[ApplicationStateManager] Failed to check session expiration:', e);
    }
  }

  /**
   * P2 Fix: Update last activity timestamp on user interaction
   */
  private updateLastActivity(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
    } catch (e) {
      // Silently fail - activity tracking is non-critical
    }
  }

  /**
   * P2 Fix: Public method to check if session is about to expire
   * Returns minutes remaining or null if session is fresh
   */
  getSessionTimeRemaining(): number | null {
    if (typeof window === 'undefined') return null;

    try {
      const lastActivityStr = localStorage.getItem(this.LAST_ACTIVITY_KEY);
      if (!lastActivityStr) return null;

      const lastActivity = parseInt(lastActivityStr, 10);
      const timeSinceActivity = Date.now() - lastActivity;
      const timeRemaining = this.SESSION_TIMEOUT_MS - timeSinceActivity;

      if (timeRemaining <= 0) return 0;
      return Math.round(timeRemaining / 60000); // Return minutes
    } catch {
      return null;
    }
  }

  /**
   * P2 Fix: Manually clear session (e.g., user clicks "Start Over")
   */
  clearSession(): void {
    if (typeof window === 'undefined') return;

    console.log('[ApplicationStateManager] Clearing session');

    // Clear all storage
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('pol_session_context');
    localStorage.removeItem(this.LAST_ACTIVITY_KEY);
    localStorage.removeItem(this.SESSION_STORAGE_KEY);
    sessionStorage.removeItem('pol_nav_source');
    sessionStorage.removeItem('pol_nav_precincts');
    sessionStorage.removeItem('pol_nav_timestamp');
    sessionStorage.removeItem('pol_nav_mapState');

    // Reset state
    this.state = this.createInitialState();

    // Set fresh activity timestamp
    localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());

    // Notify listeners
    this.dispatch({
      type: 'SESSION_CLEARED',
      payload: {},
      timestamp: new Date(),
    });
  }

  /**
   * Load persisted state (exploration, queries, expertise) from localStorage
   * Only restore if less than 24 hours old
   */
  private loadPersistedState(): void {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if less than 24 hours old
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          this.state.behavior.exploredPrecincts = new Set(parsed.exploredPrecincts || []);
          this.state.behavior.queriesAsked = parsed.recentQueries || [];
          this.state.expertise.currentLevel = parsed.expertiseLevel || 'intermediate';
          console.log('[ApplicationStateManager] Restored session state from localStorage');
        }
      }
    } catch (e) {
      console.warn('[ApplicationStateManager] Failed to load persisted state:', e);
    }
  }

  /**
   * Persist current state to localStorage after each state change
   */
  private persistState(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        timestamp: Date.now(),
        exploredPrecincts: Array.from(this.state.behavior.exploredPrecincts || []),
        recentQueries: (this.state.behavior.queriesAsked || []).slice(-20),
        expertiseLevel: this.state.expertise.currentLevel || 'intermediate'
      }));
    } catch (e) {
      console.warn('[ApplicationStateManager] Failed to persist state:', e);
    }
  }

  private loadPersistedSession(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('pol_session_context');
      if (stored) {
        const sessionContext = JSON.parse(stored) as SessionContext;
        const lastVisit = new Date(sessionContext.lastVisit);
        const hoursSinceLastVisit = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60);

        // Consider returning user if visited within 24 hours
        if (hoursSinceLastVisit < 24) {
          this.state.temporal.returningUser = true;
          this.state.temporal.previousSessionContext = {
            ...sessionContext,
            lastVisit: lastVisit,
          };
        }
      }
    } catch (error) {
      console.error('[ApplicationStateManager] Failed to load session:', error);
    }
  }

  // ============================================================================
  // Enhanced Session Continuity (Phase 9)
  // ============================================================================

  /**
   * Get a visual timeline of session activity for UI display
   * Returns recent actions grouped by type with human-readable descriptions
   */
  getSessionTimeline(maxEntries: number = 20): SessionTimelineEntry[] {
    const timeline: SessionTimelineEntry[] = [];
    const actions = this.state.behavior.actionsThisSession;

    // Convert actions to timeline entries
    for (const action of actions.slice(-maxEntries * 2)) {
      let entry: SessionTimelineEntry | null = null;

      switch (action.type) {
        case 'PRECINCT_SELECTED':
          entry = {
            timestamp: action.timestamp,
            type: 'selection',
            description: `Selected precinct: ${action.metadata?.precinctName || action.target}`,
            tool: this.state.currentTool,
            details: {
              entityId: action.target,
              entityName: action.metadata?.precinctName as string,
              action: 'select',
            },
          };
          break;

        case 'MUNICIPALITY_SELECTED':
          entry = {
            timestamp: action.timestamp,
            type: 'selection',
            description: `Selected municipality: ${action.metadata?.municipalityName || action.target}`,
            tool: this.state.currentTool,
            details: {
              entityId: action.target,
              entityName: action.metadata?.municipalityName as string,
              action: 'select',
            },
          };
          break;

        case 'SEGMENT_FILTER_CHANGED':
          entry = {
            timestamp: action.timestamp,
            type: 'filter',
            description: `Applied ${action.metadata?.filterCount || 0} filters (${action.metadata?.matchCount || 0} matches)`,
            tool: 'segments',
            details: {
              action: 'filter',
              result: `${action.metadata?.matchCount} precincts`,
            },
          };
          break;

        case 'COMPARISON_STARTED':
          entry = {
            timestamp: action.timestamp,
            type: 'comparison',
            description: 'Started comparison analysis',
            tool: 'compare',
            details: {
              action: 'compare',
            },
          };
          break;

        case 'REPORT_GENERATION_COMPLETED':
          entry = {
            timestamp: action.timestamp,
            type: 'report',
            description: `Generated report: ${(action.metadata?.report as ReportMetadata)?.areaName || 'Report'}`,
            tool: 'reports',
            details: {
              action: 'report',
              result: (action.metadata?.report as ReportMetadata)?.areaName,
            },
          };
          break;

        case 'SEGMENT_SAVED':
          entry = {
            timestamp: action.timestamp,
            type: 'save',
            description: `Saved segment: ${action.metadata?.name || 'Unnamed'}`,
            tool: 'segments',
            details: {
              action: 'save',
              result: action.metadata?.name as string,
            },
          };
          break;

        case 'USER_QUERY_SUBMITTED':
          entry = {
            timestamp: action.timestamp,
            type: 'query',
            description: `Asked: "${(action.metadata?.query as string)?.slice(0, 50)}${(action.metadata?.query as string)?.length > 50 ? '...' : ''}"`,
            tool: this.state.currentTool,
            details: {
              action: 'query',
            },
          };
          break;

        case 'TOOL_SWITCHED':
          entry = {
            timestamp: action.timestamp,
            type: 'navigation',
            description: `Navigated to ${action.metadata?.to || 'unknown'}`,
            tool: action.metadata?.to as string || 'unknown',
            details: {
              action: 'navigate',
            },
          };
          break;
      }

      if (entry) {
        timeline.push(entry);
      }
    }

    // Sort by timestamp descending (most recent first) and limit
    return timeline
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxEntries);
  }

  /**
   * Get "pick up where you left off" resume options based on previous session
   * Returns prioritized suggestions for continuing work
   */
  getResumeOptions(): ResumeOption[] {
    const options: ResumeOption[] = [];
    const previousSession = this.state.temporal.previousSessionContext as EnhancedSessionContext | null;

    if (!previousSession) {
      return options;
    }

    // Option 1: Continue with last viewed precincts
    if (previousSession.lastViewedPrecincts && previousSession.lastViewedPrecincts.length > 0) {
      const precinctList = previousSession.lastViewedPrecincts.slice(0, 3).join(', ');
      options.push({
        id: 'continue-precincts',
        label: 'Continue exploring precincts',
        description: `Pick up where you left off with ${precinctList}${previousSession.lastViewedPrecincts.length > 3 ? ` and ${previousSession.lastViewedPrecincts.length - 3} more` : ''}`,
        action: `resume:highlight-precincts`,
        priority: 90,
        context: {
          precincts: previousSession.lastViewedPrecincts,
          tool: 'political-ai',
          // S7-003: Include map command metadata for direct restoration
          mapCommands: [
            {
              type: 'highlight',
              target: previousSession.lastViewedPrecincts,
            },
          ],
        },
      });
    }

    // Option 2: Resume incomplete workflow
    if (previousSession.lastWorkflow) {
      // S7-003: Include any precincts from that workflow for map restoration
      const workflowPrecincts = previousSession.lastViewedPrecincts?.slice(0, 5) || [];
      options.push({
        id: 'resume-workflow',
        label: `Resume ${previousSession.lastWorkflow} workflow`,
        description: 'Continue the workflow you started last time',
        action: `resume:workflow`,
        priority: 85,
        context: {
          workflow: previousSession.lastWorkflow,
          precincts: workflowPrecincts,
          mapCommands: workflowPrecincts.length > 0 ? [
            {
              type: 'highlight',
              target: workflowPrecincts,
            },
          ] : undefined,
        },
      });
    }

    // Option 3: Continue last analysis
    if (previousSession.lastAnalysis) {
      const analysisPrecincts = previousSession.lastAnalysis.precincts?.map(p => p.id || p.name).filter(Boolean) || [];
      options.push({
        id: 'continue-analysis',
        label: 'Continue analysis',
        description: `Resume analysis of ${previousSession.lastAnalysis.areaName}`,
        action: `resume:analysis`,
        priority: 80,
        context: {
          tool: 'political-ai',
          precincts: analysisPrecincts,
          mapCommands: analysisPrecincts.length > 0 ? [
            {
              type: 'highlight',
              target: analysisPrecincts,
            },
          ] : undefined,
        },
      });
    }

    // Option 4: High-value findings from previous session
    const enhancedSession = previousSession as EnhancedSessionContext;
    if (enhancedSession.highValueFindings && enhancedSession.highValueFindings.length > 0) {
      const finding = enhancedSession.highValueFindings[0];
      const findingPrecincts = enhancedSession.highValueFindings.map(f => f.precinctId);
      // S7-003: Show heatmap of the metric they were exploring
      const primaryMetric = finding.metric || 'swing_potential';
      options.push({
        id: 'review-findings',
        label: 'Review high-value discoveries',
        description: `You found ${enhancedSession.highValueFindings.length} promising areas like ${finding.precinctName}`,
        action: `resume:findings`,
        priority: 75,
        context: {
          precincts: findingPrecincts,
          mapCommands: [
            {
              type: 'highlight',
              target: findingPrecincts,
            },
            {
              type: 'showHeatmap',
              metric: primaryMetric,
            },
          ],
        },
      });
    }

    // Option 5: Start fresh
    options.push({
      id: 'start-fresh',
      label: 'Start fresh',
      description: 'Begin a new exploration session',
      action: 'Start fresh',
      priority: 10,
      context: {},
    });

    // Sort by priority descending
    return options.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get a formatted welcome message for returning users
   */
  getReturningUserWelcome(): string | null {
    if (!this.state.temporal.returningUser || !this.state.temporal.previousSessionContext) {
      return null;
    }

    const previousSession = this.state.temporal.previousSessionContext;
    const lastVisit = new Date(previousSession.lastVisit);
    const hoursSince = Math.round((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60));

    let timeDesc: string;
    if (hoursSince < 1) {
      timeDesc = 'a few minutes ago';
    } else if (hoursSince < 24) {
      timeDesc = `${hoursSince} hour${hoursSince !== 1 ? 's' : ''} ago`;
    } else {
      const daysSince = Math.round(hoursSince / 24);
      timeDesc = `${daysSince} day${daysSince !== 1 ? 's' : ''} ago`;
    }

    const precinctCount = previousSession.lastViewedPrecincts?.length || 0;

    // P2: Remove "Welcome back!" greeting - use action-oriented language
    let message = `Continuing from ${timeDesc}`;
    if (precinctCount > 0) {
      message += `: ${precinctCount} precinct${precinctCount !== 1 ? 's' : ''} explored`;
    }
    if (previousSession.lastWorkflow) {
      message += precinctCount > 0 ? `, ${previousSession.lastWorkflow}` : `: ${previousSession.lastWorkflow}`;
    }
    message += '.';

    return message;
  }

  /**
   * Enhanced session persistence with full context
   */
  private persistEnhancedSession(): void {
    if (typeof window === 'undefined') return;

    try {
      const metrics = this.getExplorationMetrics();
      const timeline = this.getSessionTimeline(10);

      // Collect high-value findings from exploration history
      const highValueFindings: EnhancedSessionContext['highValueFindings'] = [];
      for (const entry of this.state.explorationHistory) {
        if (entry.metadata?.highSwing || entry.metadata?.highGotv) {
          const precinctId = entry.precinctIds?.[0];
          if (precinctId) {
            highValueFindings.push({
              precinctId,
              precinctName: entry.result || precinctId,
              metric: entry.metadata.highSwing ? 'swing_potential' : 'gotv_priority',
              value: (entry.metadata.swingScore as number) || (entry.metadata.gotvScore as number) || 0,
            });
          }
        }
      }

      const enhancedContext: EnhancedSessionContext = {
        lastVisit: new Date(),
        lastViewedPrecincts: Array.from(this.state.behavior.exploredPrecincts).slice(-10),
        lastWorkflow: this.state.workflow.activeWorkflow,
        lastAnalysis: this.state.iqBuilder.lastAnalysis,
        sessionDuration: metrics.sessionDuration,
        toolsUsed: metrics.toolsVisited,
        queriesAsked: this.state.behavior.queriesAsked.slice(-10),
        savedSegments: this.state.segmentation.savedSegments.map(s => s.name),
        reportsGenerated: this.state.reports.recentReports.map(r => r.areaName),
        timeline,
        explorationDepth: this.getExplorationDepth(),
        highValueFindings: highValueFindings.slice(0, 5),
      };

      localStorage.setItem('pol_session_context', JSON.stringify(enhancedContext));
    } catch (error) {
      console.error('[ApplicationStateManager] Failed to persist enhanced session:', error);
    }
  }

  // ============================================================================
  // Context Helpers for AI
  // ============================================================================

  /**
   * Get a summary of the current context for AI prompts
   */
  getContextSummary(): string {
    const parts: string[] = [];

    // Map context
    if (this.state.map.activeLayer !== 'none') {
      parts.push(`Viewing ${this.state.map.activeLayer} layer${this.state.map.activeMetric ? ` (${this.state.map.activeMetric})` : ''}`);
    }
    parts.push(`${this.state.map.visiblePrecincts.length} precincts in view`);

    // Selection context
    if (this.state.selection.type !== 'none') {
      const entity = this.state.selection.selectedEntity;
      if (entity) {
        parts.push(`Selected: ${entity.name || entity.id} (${this.state.selection.type})`);
      }
    }

    // Workflow context
    if (this.state.workflow.activeWorkflow) {
      parts.push(`Active workflow: ${this.state.workflow.activeWorkflow} (step ${this.state.workflow.workflowStep + 1})`);
    }

    // Tool context
    if (this.state.segmentation.filterCount > 0) {
      parts.push(`Segment: ${this.state.segmentation.matchCount} precincts matching ${this.state.segmentation.filterCount} filters`);
    }

    if (this.state.comparison.leftEntity && this.state.comparison.rightEntity) {
      parts.push(`Comparing: ${this.state.comparison.leftEntity.name} vs ${this.state.comparison.rightEntity.name}`);
    }

    // Session context
    if (this.state.temporal.returningUser && this.state.temporal.previousSessionContext) {
      parts.push(`Returning user (last session: ${this.state.temporal.previousSessionContext.lastViewedPrecincts.length} precincts explored)`);
    }

    return parts.join('. ');
  }

  /**
   * Get the most recently explored areas for continuity suggestions
   */
  getRecentExplorations(): SelectionHistoryEntry[] {
    return this.state.selection.selectionHistory.slice(-5);
  }

  /**
   * Check if the user has shown interest in a particular type of analysis
   */
  hasInterestIn(topic: string): boolean {
    const queries = this.state.behavior.queriesAsked;
    const actions = this.state.behavior.actionsThisSession;

    const topicPatterns: Record<string, RegExp[]> = {
      swing: [/swing/i, /competitive/i, /battleground/i],
      gotv: [/gotv/i, /turnout/i, /mobiliz/i],
      persuasion: [/persuad/i, /persuasion/i, /undecided/i],
      demographics: [/demograph/i, /population/i, /age/i, /income/i],
    };

    const patterns = topicPatterns[topic] || [];

    // Check queries
    const queryMatch = queries.some(q => patterns.some(p => p.test(q)));

    // Check action types
    const actionTypes = actions.map(a => a.type);
    const actionMatch = actionTypes.some(t => patterns.some(p => p.test(t)));

    return queryMatch || actionMatch;
  }

  /**
   * Reset state for a new session
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  // ============================================================================
  // Session Persistence (GAP 6 Fix - Cross-session memory)
  // ============================================================================

  private readonly SESSION_STORAGE_KEY = 'political-ai-session';
  private readonly SESSION_EXPIRY_HOURS = 24;

  /**
   * Save current session state to localStorage for cross-session memory
   */
  saveSession(): void {
    if (typeof window === 'undefined') return;

    try {
      const sessionData = {
        timestamp: new Date().toISOString(),
        currentTool: this.state.currentTool,
        selection: {
          type: this.state.selection.type,
          selectedIds: this.state.selection.selectedIds,
          selectedEntityName: this.state.selection.selectedEntity?.name || null,
        },
        segmentation: {
          matchingPrecincts: this.state.segmentation.matchingPrecincts.slice(0, 50), // Limit size
          savedSegmentName: this.state.segmentation.currentSegmentName || null,
        },
        exploration: {
          precinctsViewed: this.state.behavior.exploredPrecincts.size,
          queriesAsked: this.state.behavior.queriesAsked.slice(-10),
          toolsVisited: Array.from(new Set(this.state.explorationHistory.map(h => h.tool))).slice(0, 5),
        },
        mapState: {
          center: this.state.sharedMapState.center,
          zoom: this.state.sharedMapState.zoom,
          activeMetric: this.state.sharedMapState.metric,
        },
        expertise: {
          level: this.state.expertise.currentLevel,
          sessionCount: this.state.expertise.indicators.sessionCount,
        },
      };

      localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      console.log('[ApplicationStateManager] Session saved for cross-session memory');
    } catch (error) {
      console.warn('[ApplicationStateManager] Failed to save session:', error);
    }
  }

  /**
   * Restore previous session state if available and not expired
   * Returns true if a session was restored
   */
  restoreSession(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const stored = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!stored) return false;

      const sessionData = JSON.parse(stored);
      const timestamp = new Date(sessionData.timestamp);
      const hoursSinceSession = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);

      // Check if session is expired
      if (hoursSinceSession > this.SESSION_EXPIRY_HOURS) {
        localStorage.removeItem(this.SESSION_STORAGE_KEY);
        console.log('[ApplicationStateManager] Previous session expired, starting fresh');
        return false;
      }

      // Restore session data
      if (sessionData.expertise?.sessionCount) {
        this.state.expertise.indicators.sessionCount = sessionData.expertise.sessionCount + 1;
      }

      console.log('[ApplicationStateManager] Restored cross-session memory:', {
        hoursSinceSession: hoursSinceSession.toFixed(1),
        previousTool: sessionData.currentTool,
        precinctsViewed: sessionData.exploration?.precinctsViewed,
      });

      return true;
    } catch (error) {
      console.warn('[ApplicationStateManager] Failed to restore session:', error);
      return false;
    }
  }

  /**
   * Get summary of previous session for welcome message
   */
  getPreviousSessionSummary(): { available: boolean; summary: string; resumeContext?: any } | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!stored) return null;

      const sessionData = JSON.parse(stored);
      const timestamp = new Date(sessionData.timestamp);
      const hoursSinceSession = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);

      if (hoursSinceSession > this.SESSION_EXPIRY_HOURS) {
        return null;
      }

      const parts: string[] = [];

      if (sessionData.currentTool && sessionData.currentTool !== 'political-ai') {
        parts.push(`You were using the ${sessionData.currentTool} tool`);
      }

      if (sessionData.exploration?.precinctsViewed > 0) {
        parts.push(`viewed ${sessionData.exploration.precinctsViewed} precincts`);
      }

      if (sessionData.segmentation?.matchingPrecincts?.length > 0) {
        parts.push(`had ${sessionData.segmentation.matchingPrecincts.length} precincts selected`);
      }

      if (parts.length === 0) {
        return null;
      }

      const timeAgo = hoursSinceSession < 1
        ? 'less than an hour ago'
        : hoursSinceSession < 24
          ? `${Math.round(hoursSinceSession)} hours ago`
          : 'recently';

      return {
        available: true,
        summary: `Welcome back! Last time (${timeAgo}) you ${parts.join(', ')}.`,
        resumeContext: {
          precincts: sessionData.segmentation?.matchingPrecincts || [],
          tool: sessionData.currentTool,
          mapState: sessionData.mapState,
        },
      };
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // Initial State Factory
  // ============================================================================

  private createInitialState(): ApplicationState {
    return {
      map: {
        center: [-84.55, 42.60], // Ingham County center
        zoom: 10,
        extent: null,
        visiblePrecincts: [],
        activeLayer: 'none',
        activeMetric: null,
        highlightedFeatures: [],
      },
      selection: {
        type: 'none',
        selectedIds: [],
        selectedEntity: null,
        selectionHistory: [],
      },
      iqBuilder: {
        activeTab: 'select',
        hasAnalysisResult: false,
        lastAnalysis: null,
        boundaryType: null,
        selectedBoundaryIds: [],
      },
      workflow: {
        activeWorkflow: null,
        workflowStep: 0,
        workflowData: {},
      },
      behavior: {
        sessionStartTime: new Date(),
        lastInteractionTime: new Date(),
        actionsThisSession: [],
        exploredPrecincts: new Set(),
        exploredMunicipalities: new Set(),
        queriesAsked: [],
        suggestionsAccepted: [],
        suggestionsIgnored: [],
      },
      temporal: {
        idleTime: 0,
        timeInCurrentView: 0,
        returningUser: false,
        previousSessionContext: null,
      },
      segmentation: {
        activeFilters: null,
        filterCount: 0,
        matchingPrecincts: [],
        matchCount: 0,
        savedSegments: [],
        currentSegmentName: null,
        lookalikeReference: null,
        lookalikeResults: [],
      },
      comparison: {
        leftEntity: null,
        rightEntity: null,
        comparisonType: null,
        similarityResults: [],
        activeMetrics: [],
      },
      reports: {
        selectedArea: null,
        reportType: 'political',
        generationStatus: 'idle',
        lastGeneratedReport: null,
        recentReports: [],
      },

      // Unified AI Architecture fields
      currentTool: 'political-ai',
      explorationHistory: [],
      toolContexts: {
        'political-ai': {
          lastQuery: undefined,
          activeWorkflow: undefined,
        },
        segments: {
          filters: null,
          matchingPrecincts: [],
        },
        compare: {
          leftEntity: null,
          rightEntity: null,
        },
        settings: {
          activeSection: undefined,
        },
      },
      sharedMapState: {
        layer: 'none',
        metric: null,
        highlights: [],
        visiblePrecincts: [],
        center: [-84.55, 42.60],
        zoom: 10,
      },

      // Feature Selection (Phase G)
      featureSelection: {
        currentFeature: null,
        featureHistory: [],
      },

      // Temporal Visualization (Phase 11)
      temporal_viz: {
        isTemporalMode: false,
        selectedYear: null,
        comparisonYears: [],
        visualizationMode: 'slider',
        isPlaying: false,
        animationSpeed: 1000,
        availableYears: [2020, 2022, 2024], // Default election years
      },

      // User Expertise Tracking (Phase 12)
      expertise: {
        currentLevel: 'intermediate', // Default to intermediate
        indicators: {
          avgActionSpeed: 2000,       // 2 seconds average
          complexQueryRatio: 0.3,
          helpsRequested: 0,
          tutorialSkips: 0,
          shortcutsUsed: 0,
          precisionClicks: 0,
          explorationBreadth: 0,
          sessionCount: 1,
        },
        confidenceScore: 20,          // Low initial confidence
        lastUpdated: new Date(),
        levelHistory: [],
      },

      // Numbered Markers (Wave 5D - Issue #17)
      numberedMarkers: [],

      // Loading State (P0-9 Error Recovery)
      loading: {
        activeOperations: new Map(),
        recentErrors: [],
        isAnyLoading: false,
        lastError: null,
      },
    };
  }
}

// Export singleton accessor
export const getStateManager = () => ApplicationStateManager.getInstance();

// Export for direct use
export default ApplicationStateManager;
