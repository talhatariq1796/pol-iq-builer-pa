/**
 * NLP Handler Types
 *
 * Common types for all NLP tool handlers that connect
 * natural language queries to existing tool engines.
 */

import type { MapCommand, SuggestedAction } from '../types';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

// ============================================================================
// Handler Result Types
// ============================================================================

/**
 * Standard result returned by all handlers
 */
export interface HandlerResult {
  /** Whether the handler successfully processed the query */
  success: boolean;

  /** Natural language response to display to user */
  response: string;

  /** Map commands to execute (highlight, zoom, heatmap, etc.) */
  mapCommands?: MapCommand[];

  /** Suggested next actions based on result */
  suggestedActions?: SuggestedAction[];

  /** Structured data for further processing */
  data?: unknown;

  /** Error message if success is false */
  error?: string;

  /** Citations for data sources */
  citations?: Citation[];

  /** Processing metadata */
  metadata?: HandlerMetadata;
}

export interface Citation {
  id: string;
  source: string;
  type: 'data' | 'calculation' | 'external';
  description?: string;
}

export interface HandlerMetadata {
  handlerName: string;
  processingTimeMs: number;
  queryType: string;
  matchedIntent: string;
  confidence: number;
  /** Additional orchestrator metadata */
  orchestratorTime?: number;
  parsedIntent?: string;
  parsedConfidence?: number;
  /** Extensible for handler-specific metadata */
  [key: string]: unknown;
}

// ============================================================================
// Query Parsing Types
// ============================================================================

/**
 * Parsed query with extracted intent and entities
 */
export interface ParsedQuery {
  /** Original query text */
  originalQuery: string;

  /** Detected intent */
  intent: QueryIntent;

  /** Extracted entities */
  entities: ExtractedEntities;

  /** Confidence score 0-1 */
  confidence: number;
}

export type QueryIntent =
  | 'segment_create'
  | 'segment_find'
  | 'segment_save'
  | 'segment_export'
  | 'canvass_create'
  | 'canvass_plan'
  | 'canvass_estimate'
  | 'canvass_export'
  | 'canvassing_assign_volunteers'
  | 'canvassing_view_progress'
  | 'canvassing_optimize_route'
  | 'canvassing_analyze_performance'
  | 'canvassing_log_results'
  | 'canvassing_performance'
  | 'canvassing_volunteer_stats'
  | 'canvassing_stalled'
  | 'donor_concentration'
  | 'donor_prospects'
  | 'donor_trends'
  | 'donor_export'
  | 'donor_lapsed'
  | 'donor_lapsed_clusters'
  | 'donor_upgrade'
  | 'donor_upgrade_top'
  | 'donor_comparison'
  | 'donor_ie'
  | 'donor_ie_spending'
  | 'donor_committee'
  | 'donor_geographic'
  | 'donor_by_candidate'
  | 'report_generate'
  | 'report_preview'
  | 'compare_jurisdictions'
  | 'compare_find_similar'
  | 'compare_resource_analysis'
  | 'compare_field_brief'
  | 'compare_batch'
  | 'compare_export_pdf'
  // Multi-level district analysis intents
  | 'district_analysis'          // "Show State House 73" / "Analyze MI-07"
  | 'district_compare'           // "Compare HD-73 vs HD-74"
  | 'district_list'              // "Show all state house districts"
  | 'district_precincts'         // "What precincts are in Senate District 21?"
  // Segmentation Tool intents (Phase 6+)
  | 'segment_by_district'       // "Find voters in State House 73"
  | 'segment_by_election'       // "Show precincts that voted 60%+ for Biden"
  | 'segment_by_tapestry'       // "Find College Towns precincts"
  | 'segment_lookalike'         // "Find precincts similar to East Lansing"
  | 'segment_compare'           // "Compare my Base vs. Swing segments"
  | 'segment_donor_overlap'     // "Show high-donor GOTV precincts"
  // Map interaction intents (P0-5, P0-6)
  | 'map_click'                 // User clicked on map feature
  | 'map_selection'             // User made area selection on map
  | 'map_zoom'                  // User zoomed to area
  | 'map_highlight'             // Highlight specific precincts
  | 'map_layer_change'          // Change visualization layer
  | 'spatial_query'             // Spatial/proximity queries ("precincts near X")
  // Knowledge graph intents (P1-17)
  | 'graph_query'               // Query knowledge graph relationships
  | 'graph_explore'             // Explore node connections
  // Lookup intents (new)
  | 'precinct_lookup'           // "Tell me about Lansing Ward 1"
  | 'jurisdiction_lookup'       // "Show me precincts in East Lansing"
  | 'election_lookup'           // "How did Biden do in 2020?"
  | 'county_overview'           // "Give me an overview of Ingham County"
  // Trend analysis intents
  | 'election_trends'           // Historical election trends
  | 'turnout_trends'            // Voter turnout patterns over time
  | 'partisan_trends'           // Partisan lean changes over time
  | 'flip_risk'                 // Districts at risk of flipping
  | 'demographic_trends'        // Demographic changes over time
  | 'compare_elections'         // Compare multiple election cycles
  // Navigation intents (P1-14)
  | 'navigate_tool'             // Navigate to specific tool page
  | 'navigate_settings'         // Navigate to settings
  // Help/Guidance intents (P2-29)
  | 'help_general'              // General help request
  | 'help_tool'                 // Tool-specific help
  | 'help_example'              // Request example queries
  // Error recovery intents
  | 'retry_operation'           // Retry failed operation
  | 'error_explain'             // Explain what went wrong
  // Candidate & race intents
  | 'candidate_profile'         // "Tell me about Elissa Slotkin"
  | 'candidate_race'            // "Who's running for Senate?"
  | 'candidate_competitive'     // "Most competitive races"
  | 'candidate_fundraising'     // "How much has Slotkin raised?"
  | 'candidate_endorsements'    // "Who endorsed Slotkin?"
  // Issue-based intents
  | 'issue_by_area'             // "What issues matter in East Lansing?"
  | 'issue_precincts'           // "Which precincts care about healthcare?"
  | 'issue_analysis'            // "Healthcare as a campaign issue"
  // Election results intents
  | 'election_results'          // "What were the 2020 results?"
  | 'election_candidate_results' // "How did Biden do in Meridian?"
  | 'election_turnout'          // "Show me the 2022 turnout"
  | 'election_history'          // "Voting history for Lansing"
  // Data export intents
  | 'export_segments'           // "Export all my segments"
  | 'export_voter_file'         // "Download the voter file"
  | 'export_van'                // "Sync with VAN"
  | 'export_general'            // "Export data to CSV"
  | 'export_precincts'          // "Export precincts"
  | 'export_donors'             // "Export donor data"
  // Polling intents
  | 'poll_current'              // "What's the current polling?" / "Latest polls"
  | 'poll_race'                 // "Polling for the Senate race" / "MI-07 polls"
  | 'poll_competitive'          // "Most competitive races by polling"
  | 'poll_trend'                // "Polling trends" / "How has polling changed?"
  | 'poll_refresh'              // "Update polling data" / "Refresh polls"
  // Scenario modeling intents (GAP 4 fix - P17/P18)
  | 'scenario_turnout'          // "What if turnout increases 10%?"
  | 'scenario_partisan_shift'   // "What if there's a D+5 shift?"
  | 'scenario_demographic'      // "What if student turnout reaches 70%?"
  | 'scenario_canvass'          // "What if we double canvassing?"
  | 'scenario_general'          // Generic "what if" / scenario modeling
  | 'unknown';

export interface ExtractedEntities {
  // Location entities
  jurisdictions?: string[];
  precincts?: string[];
  zipCodes?: string[];

  // Demographic entities
  density?: ('urban' | 'suburban' | 'rural')[];
  ageRange?: [number, number];
  incomeRange?: [number, number];
  educationThreshold?: { min?: number; max?: number };
  /** Rank segment results by modeled college % (highest first) — set for "highest concentration of college-educated" queries */
  sortPrecinctsByCollegePctDesc?: boolean;

  // Political entities
  partyLean?: ('strong_dem' | 'lean_dem' | 'independent' | 'lean_rep' | 'strong_rep')[];
  competitiveness?: string[];
  partisanLeanRange?: { min?: number; max?: number };

  // Targeting entities
  strategy?: ('gotv' | 'persuasion' | 'battleground' | 'base')[];
  scoreThresholds?: {
    gotv?: { min?: number; max?: number };
    persuasion?: { min?: number; max?: number };
    swing?: { min?: number; max?: number };
    turnout?: { min?: number; max?: number };
  };

  // Canvassing entities
  doorCount?: number;
  turfSize?: number;
  volunteerCount?: number;
  shiftHours?: number;

  // Report entities
  reportType?: 'profile' | 'comparison' | 'briefing' | 'canvass';
  format?: 'pdf' | 'docx' | 'csv';

  // Comparison entities
  comparisonAreas?: [string, string];
  comparisonEntityIds?: string[];
  comparisonBoundaryType?: 'precincts' | 'municipalities' | 'state_house';
  comparisonMinSimilarity?: number;
  comparisonMaxResults?: number;

  // Segment reference
  segmentName?: string;
  segmentId?: string;

  // Time entities
  dateRange?: { start?: string; end?: string };
  electionCycle?: string;

  // Donor/Candidate entities
  candidates?: string[];
  donorTypes?: string[];

  // Poll entities
  raceType?: string;  // 'senate', 'house', 'governor', 'president'
  raceId?: string;    // 'MI-07', 'MI-SEN', etc.

  // Segmentation entities (Phase 6+)
  districtLevel?: 'state_house' | 'state_senate' | 'congressional' | 'county' | 'municipal';
  districtIds?: string[];                // ['mi-house-73', 'mi-senate-21']

  // Multi-level district entities (all Michigan elections)
  congressional?: string;                 // 'mi-07'
  stateSenate?: string;                   // 'mi-senate-21'
  stateHouse?: string;                    // 'mi-house-73'
  schoolDistrict?: string;                // 'mason-public-schools'
  countyCommissioner?: string;            // 'cc-district-5'
  tapestrySegments?: string[];           // ['14B', '3A']
  tapestryLifeMode?: number[];           // [8, 14] (LifeMode group numbers)
  electionYear?: 2020 | 2022 | 2024;
  voteShareThreshold?: { party: 'D' | 'R'; min?: number; max?: number };
  marginThreshold?: { min?: number; max?: number };
  lookalikeReference?: string;           // Precinct or segment name
  compareSegments?: string[];            // Segment names to compare
  exportFormat?: 'pdf' | 'van' | 'csv' | 'phone_list' | 'digital_ads';
}

// ============================================================================
// Query Pattern Types
// ============================================================================

/**
 * Pattern for matching queries to intents
 */
export interface QueryPattern {
  intent: QueryIntent;
  patterns: RegExp[];
  keywords: string[];
  entityExtractors?: EntityExtractor[];
  priority: number;
}

export interface EntityExtractor {
  name: keyof ExtractedEntities;
  pattern: RegExp;
  transform?: (match: string) => unknown;
}

// ============================================================================
// Filter Conversion Types
// ============================================================================

/**
 * Converted filters ready for engine consumption
 */
export interface ConvertedFilters {
  demographic?: {
    ageRange?: [number, number];
    incomeRange?: [number, number];
    density?: string[];
    education?: string;
  };
  political?: {
    partyLean?: string[];
    competitiveness?: string[];
    partisanLeanRange?: [number, number];
  };
  targeting?: {
    gotvPriorityRange?: [number, number];
    persuasionRange?: [number, number];
    swingPotentialRange?: [number, number];
    turnoutRange?: [number, number];
    strategy?: string[];
  };
  engagement?: {
    highDonorConcentration?: boolean;
    newsPreference?: string;
  };
}

// ============================================================================
// Handler Context (GAP 1 Fix)
// ============================================================================

/**
 * Context passed to handlers for state-aware responses
 * Enables handlers to reference current map state, selections, and session history
 */
export interface HandlerContext {
  /** Current tool/page the user is on */
  currentTool: string;

  /** Current map state */
  map: {
    center: [number, number];
    zoom: number;
    activeLayer: 'choropleth' | 'heatmap' | 'none';
    activeMetric: string | null;
    highlightedFeatures: string[];
    visiblePrecincts: string[];
  };

  /** Current selection state */
  selection: {
    type: 'none' | 'precinct' | 'municipality' | 'boundary' | 'drawn';
    selectedIds: string[];
    selectedEntityName: string | null;
  };

  /** Segmentation state */
  segmentation: {
    activeFilters: Record<string, unknown>;
    matchingPrecincts: string[];
    savedSegmentName: string | null;
  };

  /** Recent conversation history (last 5 exchanges) */
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;

  /** Session exploration metrics */
  exploration: {
    precinctsViewed: number;
    filtersApplied: number;
    toolsVisited: string[];
    explorationDepth: number;
  };

  /** Temporal/election context */
  temporal: {
    selectedElectionYear: string | null;
    isTemporalMode: boolean;
  };
}

// ============================================================================
// Handler Interface
// ============================================================================

/**
 * Base interface for all NLP handlers
 */
export interface NLPHandler {
  /** Handler name for logging/debugging */
  name: string;

  /** Query patterns this handler responds to */
  patterns: QueryPattern[];

  /** Check if handler can process this query */
  canHandle(query: ParsedQuery): boolean;

  /** Process the query and return result (context is optional for backward compatibility) */
  handle(query: ParsedQuery, context?: HandlerContext): Promise<HandlerResult>;
}

// ============================================================================
// Response Templates
// ============================================================================

export const RESPONSE_TEMPLATES = {
  segment: {
    found: (count: number, voters: number, name?: string) =>
      `Found ${count} precincts${name ? ` matching "${name}"` : ''} with approximately ${voters.toLocaleString()} voters.`,
    empty: (criteria: string) =>
      `No precincts found matching ${criteria}. Try broadening your search criteria.`,
    saved: (name: string, count: number) =>
      `Saved segment "${name}" with ${count} precincts.`,
    exported: (name: string, format: string) =>
      `Exported "${name}" to ${format.toUpperCase()} format.`,
  },
  canvass: {
    created: (name: string, doors: number, turfs: number) =>
      `Created canvass universe "${name}" with ${doors.toLocaleString()} doors across ${turfs} turfs.`,
    estimate: (doors: number, volunteers: number, hours: number) =>
      `For ${doors.toLocaleString()} doors, you'll need ${volunteers} volunteers working ${hours} total hours.`,
    exported: (name: string, format: string) =>
      `Walk list exported to ${format.toUpperCase()}.`,
  },
  donor: {
    concentration: (topZip: string, amount: number, count: number) =>
      `Top donor concentration: ${topZip} with $${amount.toLocaleString()} from ${count} donors.`,
    prospects: (count: number, potential: number) =>
      `Found ${count} prospect areas with estimated $${potential.toLocaleString()} untapped potential.`,
    trends: (direction: 'up' | 'down' | 'stable', pct: number) =>
      `Donations are ${direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'stable'} ${pct}% compared to last period.`,
  },
  comparison: {
    findSimilar: (count: number, refName: string) =>
      `Found ${count} entities similar to ${refName}.`,
    batch: (count: number) =>
      `Compared ${count} entities. View matrix for rankings.`,
    brief: (left: string, right: string) =>
      `Field brief generated for ${left} vs ${right}.`,
    resource: (entityName: string, score: number) =>
      `ROI score for ${entityName}: ${score}/100.`,
    exported: (format: string) =>
      `Comparison exported to ${format.toUpperCase()}.`,
  },
  report: {
    generating: (type: string, area: string) =>
      `Generating ${type} report for ${area}...`,
    complete: (type: string, area: string) =>
      `${type} report for ${area} is ready.`,
    preview: (sections: number) =>
      `Report preview ready with ${sections} sections.`,
  },
  error: {
    parse: (query: string, suggestions?: string[]) => {
      const base = `I couldn't understand "${query}".`;
      if (suggestions && suggestions.length > 0) {
        return `${base}\n\n**Try one of these instead:**\n${suggestions.map(s => `- "${s}"`).join('\n')}`;
      }
      return `${base}\n\n**Try something like:**\n- "Find swing precincts in Lansing"\n- "Show donor concentration"\n- "Plan a canvass for 5,000 doors"`;
    },
    noData: (entity: string, alternatives?: string[]) => {
      const base = `No data available for "${entity}".`;
      if (alternatives && alternatives.length > 0) {
        return `${base}\n\n**Similar entities you can try:**\n${alternatives.map(a => `- ${a}`).join('\n')}`;
      }
      return `${base}\n\n**What you can do:**\n- Check the spelling of the entity name\n- Try a broader search (e.g., county instead of city)\n- Use the map to select an area visually`;
    },
    execution: (action: string, reason?: string, recovery?: string) => {
      let message = `Failed to ${action}`;
      if (reason) {
        message += `: ${reason}`;
      }
      message += '.';
      if (recovery) {
        message += `\n\n**How to fix:** ${recovery}`;
      } else {
        message += `\n\n**What you can do:**\n- Check your internet connection\n- Try again in a moment\n- Try a simpler query first`;
      }
      return message;
    },
    lowConfidence: (query: string, topIntents: string[]) =>
      `I'm not certain what you're asking about "${query}".\n\n**Did you mean:**\n${topIntents.map(i => `- ${i}`).join('\n')}\n\nPlease rephrase or select an option.`,
    networkError: () =>
      `Network error - unable to reach the server.\n\n**What you can do:**\n- Check your internet connection\n- Wait a moment and try again\n- Try a simpler query that doesn't require external data`,
    timeout: (action: string) =>
      `The ${action} operation timed out.\n\n**What you can do:**\n- Try again with a smaller data set\n- Select fewer precincts or a smaller area\n- Break your request into smaller parts`,
  },
};

// ============================================================================
// Demographic Trends Types
// ============================================================================

/**
 * Historical demographic data structure (from Census ACS)
 */
export interface DemographicTrends {
  metadata: {
    vintages: string[];
    generated: string;
    source: string;
    geography: string;
    methodology?: string;
  };
  precincts: Record<string, Record<string, PrecinctDemographicSnapshot>>;
}

/**
 * Point-in-time demographic snapshot for a precinct
 */
export interface PrecinctDemographicSnapshot {
  population: number;
  median_age: number;
  median_income: number;
  college_pct: number;
  white_pct: number;
  black_pct: number;
  hispanic_pct: number;
  owner_pct: number;
  renter_pct: number;
}

/**
 * Calculated demographic change for a precinct
 */
export interface PrecinctDemographicChange {
  precinct: string;
  population_change: number;      // % change
  income_change: number;          // % change
  college_change: number;         // absolute change in percentage points
  owner_change: number;           // absolute change in percentage points
  diversity_change: number;       // change in diversity index
}

/**
 * Full demographic analysis result
 */
export interface DemographicAnalysis {
  changes: PrecinctDemographicChange[];
  summary: DemographicSummary;
  topGrowing: PrecinctDemographicChange[];
  topIncomeGrowth: PrecinctDemographicChange[];
  topEducationShift: PrecinctDemographicChange[];
}

/**
 * County/region-level demographic summary
 */
export interface DemographicSummary {
  totalPopulation: { start: number; end: number; change: number };
  medianIncome: { start: number; end: number; change: number };
  collegePct: { start: number; end: number; change: number };
  ownerPct: { start: number; end: number; change: number };
  diversityIndex: { start: number; end: number; change: number };
  growingPrecincts: number;
  decliningPrecincts: number;
}

// ============================================================================
// Sources Section Helper
// ============================================================================

/**
 * Standard data sources for political analysis
 * Used across all handlers to ensure consistent attribution
 */
export type StandardSourceKey = 'elections' | 'gis' | 'demographics' | 'fec' | 'tapestry';

/** Region-aware election line — avoids hardcoded Ingham/MI when deployment is PA or other. */
export function getStandardSourceLine(key: StandardSourceKey): string {
  const { summaryAreaName, state } = getPoliticalRegionEnv();
  switch (key) {
    case 'elections':
      return `[ELECTIONS] Precinct election results — ${summaryAreaName}, ${state} (2020–2024)`;
    case 'gis':
      return `[MICHIGAN_GIS] Precinct & district boundaries — Census / state GIS (vintage varies by layer)`;
    case 'demographics':
      return `[DEMOGRAPHICS] ACS Demographics — U.S. Census Bureau via Esri Business Analyst (2019–2023)`;
    case 'fec':
      return `[FEC] Federal Election Commission — Campaign finance data (2020–2024)`;
    case 'tapestry':
      return `[TAPESTRY] Esri Tapestry Segmentation — Lifestyle and demographic clusters`;
    default:
      return '';
  }
}

/**
 * Generate a sources section to append to AI responses
 * This format is parsed by UnifiedAIAssistant and shown as a compact link
 *
 * @param sourceKeys - Which sources to include (defaults to elections, gis, demographics)
 * @returns Formatted sources section string
 */
export function generateSourcesSection(
  sourceKeys: StandardSourceKey[] = ['elections', 'gis', 'demographics']
): string {
  const sources = sourceKeys
    .map((key) => getStandardSourceLine(key))
    .filter(Boolean)
    .map((source) => `- ${source}`)
    .join('\n');

  return `

📚 Sources:
${sources}
`;
}

/**
 * Append sources to a response string
 * Only adds if response doesn't already have sources
 */
export function appendSources(
  response: string,
  sourceKeys?: StandardSourceKey[]
): string {
  if (response.includes('📚 Sources') || response.includes('[SECTION:📚')) {
    return response;
  }
  return response + generateSourcesSection(sourceKeys);
}

// ============================================================================
// Collapsible Section Helpers
// ============================================================================

/**
 * Create a collapsible section for the UI
 * Format: [SECTION:icon:Title (count)]content[/SECTION]
 */
export function createCollapsibleSection(
  icon: string,
  title: string,
  content: string,
  count?: number
): string {
  const titleWithCount = count !== undefined ? `${title} (${count})` : title;
  return `[SECTION:${icon}:${titleWithCount}]${content}[/SECTION]`;
}

/**
 * Create a sources collapsible section
 */
export function createSourcesSection(
  sourceKeys: StandardSourceKey[] = ['elections', 'gis', 'demographics']
): string {
  const sources = sourceKeys
    .map((key) => getStandardSourceLine(key))
    .filter(Boolean)
    .map((source) => `- ${source}`)
    .join('\n');

  return createCollapsibleSection('📚', 'Sources', sources, sourceKeys.length);
}

/**
 * Create a precincts list collapsible section
 * Each precinct on its own line for easier parsing and clickability
 */
export function createPrecinctsSection(precincts: string[], showCount = 10): string {
  const displayed = precincts.slice(0, showCount);
  const remaining = precincts.length - showCount;

  // One precinct per line for easy parsing in the UI
  let content = displayed.join('\n');
  if (remaining > 0) {
    content += `\n*...and ${remaining} more*`;
  }

  return createCollapsibleSection('📍', 'Precincts', content, precincts.length);
}

/**
 * Append collapsible sources and optional precincts to a response
 */
export function appendCollapsibleSections(
  response: string,
  options: {
    sourceKeys?: StandardSourceKey[];
    precincts?: string[];
    maxPrecinctsShown?: number;
  } = {}
): string {
  let result = response;

  // Add precincts section if provided
  if (options.precincts && options.precincts.length > 0) {
    result += '\n\n' + createPrecinctsSection(options.precincts, options.maxPrecinctsShown || 10);
  }

  // Add sources section
  if (options.sourceKeys && !response.includes('[SECTION:📚')) {
    result += '\n\n' + createSourcesSection(options.sourceKeys);
  }

  return result;
}

// ============================================================================
// Enrichment Context Formatting
// ============================================================================

/**
 * Import type for enrichment context (avoid circular dependency)
 */
export interface EnrichmentContextLite {
  rag: {
    documents: Array<{ title: string; type: string; content: string }>;
    currentIntel: Array<{ type: string; title: string; source: string; published: string }>;
  };
  graph: {
    issues: Array<{ name: string; metadata?: { salience?: number; keywords?: string[] } }>;
    relationships: Array<{ type: string; sourceId: string; properties?: Record<string, unknown> }>;
    candidates: Array<{ incumbent?: { name: string; party: string } }>;
  };
  relevance: {
    shouldInclude: boolean;
    overallScore: number;
  };
}

/**
 * Format enrichment context into collapsible sections for AI responses
 * This standardizes how RAG + Knowledge Graph data appears across all handlers
 */
export function formatEnrichmentSections(
  context: EnrichmentContextLite | null | undefined,
  options: {
    includeIntel?: boolean;
    includeIssues?: boolean;
    includeEndorsements?: boolean;
    maxIntel?: number;
    maxIssues?: number;
    maxEndorsements?: number;
  } = {}
): string {
  if (!context || !context.relevance.shouldInclude) {
    return '';
  }

  const {
    includeIntel = true,
    includeIssues = true,
    includeEndorsements = true,
    maxIntel = 2,
    maxIssues = 3,
    maxEndorsements = 3,
  } = options;

  let sections = '';

  // Current Intelligence (news, polls, upcoming elections)
  if (includeIntel && context.rag.currentIntel.length > 0) {
    const intelContent = context.rag.currentIntel.slice(0, maxIntel).map(intel => {
      const typeLabel = intel.type === 'upcoming' ? '🗓️ Upcoming' :
        intel.type === 'poll' ? '📊 Poll' :
        intel.type === 'news' ? '📰 News' :
        intel.type === 'analysis' ? '📈 Analysis' : '📋 Info';
      return `**${typeLabel}**: ${intel.title}\n*${intel.source} — ${intel.published}*`;
    }).join('\n\n');

    sections += createCollapsibleSection('📰', 'Current Intelligence', intelContent, context.rag.currentIntel.length);
  }

  // Key Issues (from Knowledge Graph)
  if (includeIssues && context.graph.issues.length > 0) {
    const issuesContent = context.graph.issues.slice(0, maxIssues).map(issue => {
      const salience = issue.metadata?.salience || 50;
      const emoji = salience >= 70 ? '🔴' : salience >= 40 ? '🟡' : '🟢';
      const keywords = issue.metadata?.keywords?.slice(0, 3).join(', ') || '';
      return `${emoji} **${issue.name}**${keywords ? ` — ${keywords}` : ''}`;
    }).join('\n\n');

    sections += '\n\n' + createCollapsibleSection('🎯', 'Key Issues', issuesContent, context.graph.issues.length);
  }

  // Notable Endorsements (from Knowledge Graph relationships)
  if (includeEndorsements && context.graph.relationships.length > 0) {
    const endorsements = context.graph.relationships.filter(r => r.type === 'ENDORSED_BY');
    if (endorsements.length > 0) {
      const endorsementContent = endorsements.slice(0, maxEndorsements).map(e => {
        const endorserName = (e.properties?.['endorser_name'] as string) ||
          e.sourceId.replace(/^(organization|candidate):/, '').replace(/-/g, ' ');
        return `- ${endorserName}`;
      }).join('\n');

      sections += '\n\n' + createCollapsibleSection('🤝', 'Notable Endorsements', endorsementContent, endorsements.length);
    }
  }

  return sections;
}

/**
 * Quick enrichment helper - wraps the context service for handlers
 * Returns null if enrichment fails or is not relevant
 */
export async function getEnrichmentForQuery(
  query: string,
  options?: {
    districtType?: 'state_house' | 'state_senate' | 'congressional' | 'county';
    districtNumber?: string;
    precincts?: string[];
  }
): Promise<EnrichmentContextLite | null> {
  try {
    // Dynamic import to avoid circular dependencies
    const { enrich } = await import('@/lib/context/ContextEnrichmentService');
    const context = await enrich(query, {
      ...options,
      includeCurrentIntel: true,
      includeCandidates: true,
      includeIssues: true,
      relevanceThreshold: 0.2,
    });

    // Transform to lite format
    const lite: EnrichmentContextLite = {
      rag: {
        documents: context.rag.documents.map((d) => ({
          title: d.title,
          type: String(d.category || 'document'),
          content: d.content || '',
        })),
        currentIntel: context.rag.currentIntel.map((i) => ({
          type: i.type,
          title: i.title,
          source: i.source,
          published: i.published,
        })),
      },
      graph: {
        issues: context.graph.issues.map((issue) => ({
          name: issue.name,
          metadata: issue.metadata,
        })),
        relationships: context.graph.relationships.map((r) => ({
          type: r.type,
          sourceId: r.sourceId,
          properties: r.properties,
        })),
        candidates: context.graph.candidates.map((c) => ({
          incumbent: c.incumbent
            ? { name: c.incumbent.name, party: c.incumbent.party }
            : undefined,
        })),
      },
      relevance: {
        shouldInclude: context.relevance.shouldInclude,
        overallScore: context.relevance.overallScore,
      },
    };

    return lite;
  } catch (error) {
    console.warn('[getEnrichmentForQuery] Enrichment failed:', error);
    return null;
  }
}
