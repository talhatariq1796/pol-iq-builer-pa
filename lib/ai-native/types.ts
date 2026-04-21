/**
 * AI-Native Interface Types
 *
 * Type definitions for AI-powered political analysis interface
 * Supports conversational interaction with map and data visualization
 */

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: SuggestedAction[];
  citations?: Citation[];
  metadata?: MessageMetadata;
}

export interface Citation {
  id: string;
  type: 'poll' | 'data' | 'election' | 'demographic';
  label: string;
  source?: string;
  url?: string;
}

export interface MessageMetadata {
  workflow?: string;
  districtIds?: string[];
  precinctIds?: string[];
  mapCommands?: MapCommand[];
  toolUsed?: string;
  executionTime?: number;
}

// ============================================================================
// Suggested Actions
// ============================================================================

export interface SuggestedAction {
  id: string;
  label: string;
  action: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'secondary';
  metadata?: Record<string, unknown>;
  /** Optional description for more context */
  description?: string;
  /** Optional priority for sorting (lower = higher priority) */
  priority?: number;
  /** Optional parameters for the action */
  params?: Record<string, unknown>;
}

// ============================================================================
// Map Commands
// ============================================================================

export type MapCommandType =
  | 'zoom'
  | 'pan'
  | 'flyTo'
  | 'highlight'
  | 'highlightComparison'
  | 'clearHighlight'
  | 'filter'
  | 'clearFilter'
  | 'showLayer'
  | 'hideLayer'
  | 'showHeatmap'
  | 'showChoropleth'
  | 'showBivariate'
  | 'showProportional'
  | 'showValueByAlpha'
  | 'showTemporal'        // P2-35: Time-series visualization (election trends over years)
  | 'showClusters'        // Spatial reasoning: show precinct clusters
  | 'showOptimizedRoute'  // Spatial reasoning: show optimized canvassing route
  | 'showBuffer'          // Spatial query: show radius/drivetime buffer
  | 'showNumberedMarkers' // AI coordination: numbered markers for ranked lists
  | 'setExtent'           // Set map to specific geographic bounds
  | 'showRoute'           // Display canvassing route with waypoints
  | 'showComparison'      // Side-by-side temporal comparison
  | 'annotate'            // Add temporary map annotation
  | 'pulseFeature'        // Animate attention to specific area
  | 'clear';

export interface MapCommand {
  /** Command type - required if action not provided */
  type?: MapCommandType;
  /** Alternative to type - some handlers use action string */
  action?: string;
  target?: string | string[];
  /** IDs for targeting (e.g., precinct IDs, ZIP codes) */
  ids?: string[];
  /** Names for targeting (e.g., precinct names) */
  names?: string[];
  metric?: string;
  bounds?: [number, number, number, number];
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  layer?: string;
  field?: string;
  /** Color scheme for heatmaps */
  colorScheme?: string;
  /** Comparison period for temporal displays */
  comparisonPeriod?: string;
  data?: Record<string, unknown>;
  style?: MapStyle;
  animation?: boolean;
  /** For split-screen comparison view */
  leftEntityId?: string;
  rightEntityId?: string;

  // Multi-variable visualization options
  /** For bivariate choropleth: X-axis metric */
  xMetric?: string;
  /** For bivariate choropleth: Y-axis metric */
  yMetric?: string;
  /** For bivariate choropleth: preset name */
  bivariatePreset?: 'gotv_targets' | 'persuasion_gotv' | 'swing_turnout' | 'income_education';
  /** For proportional symbols: size metric */
  sizeMetric?: string;
  /** For proportional symbols: color metric */
  colorMetric?: string;
  /** For proportional symbols: preset name */
  proportionalPreset?: 'voter_population' | 'gotv_population' | 'canvass_turnout' | 'donor_concentration';
  /** For value-by-alpha: alpha/confidence metric */
  alphaMetric?: string;
  /** For value-by-alpha: preset name */
  valueByAlphaPreset?: 'partisan_confidence' | 'turnout_sample_size' | 'gotv_data_quality' | 'swing_voter_count';

  // Spatial reasoning options
  /** For showClusters: cluster definitions */
  clusters?: Array<{
    id: string;
    precinctIds: string[];
    color?: string;
    name?: string;
    centroid?: [number, number]; // [lng, lat]
  }>;
  /** For showOptimizedRoute: ordered precinct IDs for route */
  routePrecinctIds?: string[];
  /** For showOptimizedRoute: route metadata */
  routeMetadata?: {
    totalDoors?: number;
    totalHours?: number;
    doorsPerHour?: number;
  };
  /** For showBuffer: buffer center point [lng, lat] */
  bufferCenter?: [number, number];
  /** For showBuffer: buffer distance */
  bufferDistance?: number;
  /** For showBuffer: buffer unit */
  bufferUnit?: 'km' | 'miles' | 'mi' | 'minutes';
  /** For showBuffer: buffer type */
  bufferType?: 'radius' | 'drivetime' | 'walktime';

  // Numbered markers for AI-coordinated responses
  /** For showNumberedMarkers: array of precincts with numbers */
  numberedMarkers?: Array<{
    precinctId: string;
    number: number;
    label?: string;
    coordinates?: [number, number]; // Optional explicit coordinates
  }>;

  // New enhanced commands
  /** For setExtent: geographic bounds [xmin, ymin, xmax, ymax] */
  extent?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };

  /** For showRoute: ordered waypoints for canvassing route */
  waypoints?: Array<{
    precinctId: string;
    order: number;
    label?: string;
  }>;
  /** For showRoute: whether route is optimized */
  optimized?: boolean;

  /** For showComparison: left metric for temporal comparison */
  leftMetric?: string;
  /** For showComparison: right metric for temporal comparison */
  rightMetric?: string;
  /** For showComparison: split direction */
  splitDirection?: 'vertical' | 'horizontal';

  /** For annotate: annotation location */
  location?: [number, number]; // [lng, lat]
  /** For annotate: annotation label text */
  label?: string;
  /** For annotate: annotation icon type */
  icon?: 'pin' | 'flag' | 'star' | 'marker' | 'campaign-hq' | 'polling-place';
  /** For annotate: whether annotation is temporary */
  temporary?: boolean;

  /** For pulseFeature: duration of pulse animation in ms */
  duration?: number;
  /** For pulseFeature: pulse color */
  color?: string;

  /** For showTemporal: years to include in timeline */
  years?: number[];
  /** For showTemporal: auto-play animation */
  autoPlay?: boolean;
}

/**
 * Validates a MapCommand object for required properties based on command type
 * @param command - The map command to validate
 * @returns Validation result with error message if invalid
 */
export function validateMapCommand(command: MapCommand): { valid: boolean; error?: string } {
  // Must have either type or action
  if (!command.type && !command.action) {
    return { valid: false, error: 'MapCommand must have either type or action' };
  }

  const commandType = command.type || command.action;

  // Type-specific validations
  switch (commandType) {
    case 'flyTo':
      if (!command.center && !command.bounds) {
        return { valid: false, error: 'flyTo command requires center or bounds' };
      }
      break;

    case 'highlight':
    case 'highlightComparison':
      if (!command.ids && !command.names && !command.target) {
        return { valid: false, error: `${commandType} command requires ids, names, or target` };
      }
      break;

    case 'showHeatmap':
    case 'showChoropleth':
      if (!command.metric && !command.field) {
        return { valid: false, error: `${commandType} command requires metric or field` };
      }
      break;

    case 'showBivariate':
      if (!command.xMetric || !command.yMetric) {
        return { valid: false, error: 'showBivariate command requires xMetric and yMetric' };
      }
      break;

    case 'showProportional':
      if (!command.sizeMetric) {
        return { valid: false, error: 'showProportional command requires sizeMetric' };
      }
      break;

    case 'showValueByAlpha':
      if (!command.metric || !command.alphaMetric) {
        return { valid: false, error: 'showValueByAlpha command requires metric and alphaMetric' };
      }
      break;

    case 'showClusters':
      if (!command.clusters || command.clusters.length === 0) {
        return { valid: false, error: 'showClusters command requires clusters array' };
      }
      break;

    case 'showOptimizedRoute':
      if (!command.routePrecinctIds || command.routePrecinctIds.length === 0) {
        return { valid: false, error: 'showOptimizedRoute command requires routePrecinctIds' };
      }
      break;

    case 'showBuffer':
      if (!command.bufferCenter || !command.bufferDistance) {
        return { valid: false, error: 'showBuffer command requires bufferCenter and bufferDistance' };
      }
      break;

    case 'showNumberedMarkers':
      if (!command.numberedMarkers || command.numberedMarkers.length === 0) {
        return { valid: false, error: 'showNumberedMarkers command requires numberedMarkers array' };
      }
      break;

    case 'setExtent':
      if (!command.extent) {
        return { valid: false, error: 'setExtent command requires extent object with xmin, ymin, xmax, ymax' };
      }
      break;

    case 'showRoute':
      if (!command.waypoints || command.waypoints.length === 0) {
        return { valid: false, error: 'showRoute command requires waypoints array' };
      }
      break;

    case 'showComparison':
      if (!command.leftMetric || !command.rightMetric) {
        return { valid: false, error: 'showComparison command requires leftMetric and rightMetric' };
      }
      break;

    case 'annotate':
      if (!command.location || !command.label) {
        return { valid: false, error: 'annotate command requires location and label' };
      }
      break;

    case 'pulseFeature':
      if (!command.target) {
        return { valid: false, error: 'pulseFeature command requires target' };
      }
      break;

    case 'showTemporal':
      if (!command.metric) {
        return { valid: false, error: 'showTemporal command requires metric' };
      }
      break;
  }

  return { valid: true };
}

export interface MapStyle {
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  colorScale?: 'sequential' | 'diverging' | 'categorical';
  colorScheme?: string;
}

// ============================================================================
// AI Context
// ============================================================================

export type ViewType = 'overview' | 'jurisdiction' | 'precinct' | 'comparison' | 'segment' | 'canvass' | 'donor';

export type TargetingStrategy = 'gotv' | 'persuasion' | 'battleground';

export interface PoliticalAIContext {
  currentView: ViewType;
  selectedPrecincts: string[];
  selectedJurisdiction?: string;
  lastAction: string;
  conversationHistory: Message[];
  targetingStrategy?: TargetingStrategy;
  activeTool?: string;
  analysisResults?: AnalysisResult[];
}

export interface AnalysisResult {
  id: string;
  type: 'segment' | 'comparison' | 'canvass' | 'donor' | 'poll' | 'precinct' | 'jurisdiction';
  data: Record<string, unknown>;
  timestamp: Date;
  summary?: string;
}

// ============================================================================
// Session Management
// ============================================================================

export interface AISession {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  context: PoliticalAIContext;
  name?: string;
  tags?: string[];
}

// ============================================================================
// Workflow Types
// ============================================================================

export interface Workflow {
  id: string;
  name: string;
  description: string;
  icon?: string;
  initialPrompt?: string;
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  type: 'input' | 'analysis' | 'display' | 'action';
  prompt?: string;
  tool?: string;
  mapCommand?: MapCommand;
  nextSteps?: string[];
}

// ============================================================================
// Tool Integration Types
// ============================================================================

export interface ToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  response: string;
  mapCommands?: MapCommand[];
  suggestedActions?: SuggestedAction[];
  citations?: Citation[];
}

export interface ParsedQuery {
  intent: QueryIntent;
  entities: QueryEntities;
  filters?: QueryFilters;
  originalText: string;
}

export type QueryIntent =
  | 'find_precincts'
  | 'compare_areas'
  | 'show_demographics'
  | 'analyze_donors'
  | 'create_segment'
  | 'plan_canvass'
  | 'get_poll_data'
  | 'generate_report'
  | 'explain_score'
  | 'general_question';

export interface QueryEntities {
  jurisdictions?: string[];
  precincts?: string[];
  metrics?: string[];
  timeRange?: { start: Date; end: Date };
}

export interface QueryFilters {
  demographic?: DemographicFilters;
  political?: PoliticalFilters;
  targeting?: TargetingFilters;
}

export interface DemographicFilters {
  minAge?: number;
  maxAge?: number;
  minIncome?: number;
  maxIncome?: number;
  density?: 'urban' | 'suburban' | 'rural';
  education?: string;
}

export interface PoliticalFilters {
  partisanLean?: { min: number; max: number };
  partyRegistration?: 'D' | 'R' | 'I';
  votingHistory?: 'frequent' | 'occasional' | 'rare';
}

export interface TargetingFilters {
  gotvPriority?: { min: number; max: number };
  persuasionScore?: { min: number; max: number };
  swingPotential?: { min: number; max: number };
}
