/**
 * Types for Serendipitous Discovery Engine
 * Phase 13 Implementation
 *
 * Cross-domain correlation for surfacing unexpected insights
 */

/**
 * Categories of insights the engine can discover
 */
export type InsightCategory =
  | 'donor_gotv_overlap'      // High-donor ZIPs overlap with GOTV precincts
  | 'tapestry_turnout'        // Tapestry segment has unusual turnout pattern
  | 'demographic_swing'       // Demographic group correlates with swing behavior
  | 'geographic_cluster'      // Geographic patterns across metrics
  | 'temporal_anomaly'        // Unusual temporal patterns in data
  | 'cross_tool_connection';  // User's exploration connected two concepts

/**
 * Priority levels for insights
 */
export type InsightPriority = 'high' | 'medium' | 'low';

/**
 * Confidence level of the insight
 */
export type InsightConfidence = 'high' | 'medium' | 'low';

/**
 * A discovered insight
 */
export interface Insight {
  id: string;
  category: InsightCategory;
  priority: InsightPriority;
  confidence: InsightConfidence;

  // Content
  title: string;           // Short title (e.g., "Donor-GOTV Overlap Found")
  message: string;         // Full message with data
  shortMessage: string;    // Brief version for notifications

  // Supporting data
  dataPoints: InsightDataPoint[];

  // Related entities
  relatedPrecincts?: string[];
  relatedZips?: string[];
  relatedSegments?: string[];

  // Actions
  suggestedActions: InsightAction[];

  // Tracking
  discoveredAt: Date;
  triggerContext: InsightTriggerContext;

  // Display metadata
  icon?: string;           // Emoji or icon name
  highlight?: boolean;     // Should this be emphasized?
}

/**
 * A data point supporting an insight
 */
export interface InsightDataPoint {
  label: string;
  value: string | number;
  unit?: string;
  comparison?: {
    label: string;
    value: string | number;
    unit?: string;
  };
}

/**
 * An action the user can take based on an insight
 */
export interface InsightAction {
  id: string;
  label: string;
  action: string;          // Action string (e.g., "map:showHeatmap" or plain text)
  metadata?: Record<string, unknown>;
}

/**
 * Context that triggered the insight discovery
 */
export interface InsightTriggerContext {
  trigger: InsightTrigger;
  currentTool?: string;
  selectedPrecincts?: string[];
  activeFilters?: Record<string, unknown>;
  explorationDepth?: number;
}

/**
 * What triggered the insight check
 */
export type InsightTrigger =
  | 'precinct_selection'    // User selected a precinct
  | 'filter_applied'        // User applied a filter
  | 'segment_created'       // User created a segment
  | 'tool_navigation'       // User navigated to a tool
  | 'exploration_milestone' // User hit an exploration milestone
  | 'periodic_check'        // Regular background check
  | 'query_response';       // During query processing

/**
 * Configuration for insight checking
 */
export interface InsightCheckConfig {
  trigger: InsightTrigger;
  minExplorationDepth?: number;
  requiredData?: ('precincts' | 'donors' | 'segments')[];
}

/**
 * Result from an insight check
 */
export interface InsightCheckResult {
  hasInsight: boolean;
  insights: Insight[];
  checksPerformed: string[];
  duration: number;        // ms
}

/**
 * Stored insight for deduplication
 */
export interface StoredInsight {
  insightId: string;
  category: InsightCategory;
  hash: string;            // Content hash for deduplication
  surfacedAt: Date;
  dismissed?: boolean;
  dismissedAt?: Date;
  clicked?: boolean;
  clickedAt?: Date;
}

/**
 * Insight storage state
 */
export interface InsightStorage {
  surfacedInsights: StoredInsight[];
  dismissedCategories: InsightCategory[];
  lastCheckAt: Date | null;
  totalInsightsSurfaced: number;
  totalInsightsClicked: number;
}

/**
 * Correlation definition for cross-domain analysis
 */
export interface CorrelationDefinition {
  id: string;
  name: string;
  description: string;
  category: InsightCategory;
  domains: string[];       // Data domains involved (e.g., ['donor', 'gotv'])
  minDataPoints: number;   // Minimum data needed for correlation
  checkFn: string;         // Name of check function
  priority: InsightPriority;
}

/**
 * Parameters for donor-GOTV overlap check
 */
export interface DonorGotvOverlapParams {
  gotvPrecincts: string[];
  donorZips: Array<{
    zip: string;
    totalAmount: number;
    donorCount: number;
  }>;
  threshold?: number;      // Minimum overlap percentage (default: 50%)
}

/**
 * Parameters for tapestry-turnout check
 */
export interface TapestryTurnoutParams {
  tapestrySegments: Array<{
    code: string;
    name: string;
    precinctCount: number;
  }>;
  turnoutData: Array<{
    precinctId: string;
    tapestryCode: string;
    turnout: number;
  }>;
  electionType: 'presidential' | 'midterm' | 'primary';
  deviationThreshold?: number; // Standard deviations from mean (default: 1.5)
}

/**
 * Parameters for demographic-swing check
 */
export interface DemographicSwingParams {
  precincts: Array<{
    id: string;
    swingPotential: number;
    demographics: {
      collegeEducated?: number;
      medianAge?: number;
      medianIncome?: number;
      urbanDensity?: number;
    };
  }>;
  correlationThreshold?: number; // Minimum r-value (default: 0.6)
}

/**
 * Parameters for geographic cluster check
 */
export interface GeographicClusterParams {
  precincts: Array<{
    id: string;
    centroid: [number, number];
    metrics: Record<string, number>;
  }>;
  metric: string;
  clusterThreshold?: number; // km (default: 5)
}

/**
 * Cross-tool connection insight parameters
 */
export interface CrossToolConnectionParams {
  explorationHistory: Array<{
    tool: string;
    precincts: string[];
    filters: Record<string, unknown>;
    timestamp: Date;
  }>;
  minOverlap?: number;     // Minimum precinct overlap (default: 3)
}

/**
 * Insight template for generating messages
 */
export interface InsightTemplate {
  category: InsightCategory;
  titleTemplate: string;   // Template with {{variable}} placeholders
  messageTemplate: string;
  shortMessageTemplate: string;
  icon: string;
  suggestedActionTemplates: Array<{
    labelTemplate: string;
    actionTemplate: string;
  }>;
}

/**
 * Engine configuration
 */
export interface InsightEngineConfig {
  // Check frequency
  checkIntervalMs: number;           // Default: 30000 (30 seconds)
  minTimeBetweenInsights: number;    // Default: 60000 (1 minute)

  // Deduplication
  deduplicationWindowHours: number;  // Default: 24
  maxStoredInsights: number;         // Default: 100

  // Thresholds
  minExplorationDepth: number;       // Default: 3
  minConfidenceToSurface: InsightConfidence; // Default: 'medium'

  // Categories to check
  enabledCategories: InsightCategory[];

  // Debug
  debug: boolean;
}

/**
 * Default engine configuration
 */
export const DEFAULT_INSIGHT_CONFIG: InsightEngineConfig = {
  checkIntervalMs: 30000,
  minTimeBetweenInsights: 60000,
  deduplicationWindowHours: 24,
  maxStoredInsights: 100,
  minExplorationDepth: 3,
  minConfidenceToSurface: 'medium',
  enabledCategories: [
    'donor_gotv_overlap',
    'tapestry_turnout',
    'demographic_swing',
    'geographic_cluster',
    'cross_tool_connection',
  ],
  debug: false,
};
