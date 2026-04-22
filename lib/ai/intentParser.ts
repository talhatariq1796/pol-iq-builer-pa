import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

export interface ParsedIntent {
  type:
  | 'district_query'
  | 'district_analysis'  // Multi-level district analysis (e.g. pa-congress-07, State House 123)
  | 'comparison'
  | 'filter'
  | 'data_request'
  | 'donor_overview'
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
  | 'canvass_plan'      // Plan canvassing operations
  | 'canvass_optimize'  // Optimize canvassing routes
  | 'canvass_estimate'  // Estimate canvassing resources
  | 'canvass_analysis'  // Analyze canvassing performance
  | 'segment_create'    // Build/create a new voter segment
  | 'segment_find'      // List/find saved segments
  | 'segment_save'      // Save current segment
  | 'segment_compare'   // Compare multiple segments
  | 'output_request'  // Save, export, download requests
  | 'report_request'  // Generate/create report requests
  | 'report_history'  // View report history requests
  | 'spatial_query'   // Spatial/proximity queries (radius, drive-time, walk-time)
  | 'graph_query'     // Knowledge graph exploration
  | 'trend_query'     // Historical trend analysis (2020-2024 elections)
  | 'navigation'      // Map navigation (zoom to, fly to, center on)
  | 'general';
  entities: string[];
  filters?: {
    metric?: string;
    threshold?: number;
    operator?: 'less_than' | 'greater_than' | 'equals';
  };
  dataType?: string;
  comparisonEntities?: {
    left: string;
    right: string;
  };
  donorParams?: {
    minValue?: number;
    priority?: 'high' | 'medium' | 'low';
    zip?: string;
    minScore?: number;
    capacityTier?: string;
    candidate1?: string;
    candidate2?: string;
    race?: string;
    candidate?: string;
    party?: 'DEM' | 'REP';
    committee?: string;
  };
  // Multi-level district analysis parameters (canonical ids: pa-* or legacy mi-*)
  districtParams?: {
    congressional?: string;        // 'pa-congress-07' or 'mi-07'
    stateSenate?: string;          // 'pa-senate-21' or 'mi-senate-21'
    stateHouse?: string;           // 'pa-house-123' or 'mi-house-73'
    schoolDistrict?: string;       // slug matched against crosswalk
    countyCommissioner?: string;   // 'cc-district-5'
    districtLevel?: 'congressional' | 'state_senate' | 'state_house' | 'school' | 'county_commissioner';
  };
  // Output request parameters
  outputParams?: {
    requestType: 'save' | 'export' | 'download' | 'share';
    targetType?: 'analysis' | 'conversation' | 'segment' | 'report' | 'data' | 'map' | 'general';
  };
  // Report request parameters
  reportParams?: {
    requestType: 'generate' | 'preview' | 'customize';
    reportType?: 'executive' | 'targeting' | 'comparison' | 'segment' | 'canvass' | 'donor' | 'profile' | 'general';
    targetArea?: string;
    comparisonAreas?: [string, string];
  };
  // Spatial query parameters
  spatialParams?: {
    queryType: 'radius' | 'drivetime' | 'walktime';
    distance: number;
    unit: 'miles' | 'kilometers' | 'minutes';
    location: string;  // Address, landmark, or place name to geocode
    dataType: 'donors' | 'precincts' | 'voters' | 'all';
  };
  // Knowledge graph query parameters
  graphParams?: {
    queryType: 'overview' | 'explore' | 'path' | 'list' | 'search';
    entityName?: string;
    entityType?: string;
    sourceName?: string;
    targetName?: string;
    searchTerm?: string;
    maxDepth?: number;
  };
  // Segment query parameters
  segmentParams?: {
    intentType: 'segment_create' | 'segment_find' | 'segment_save' | 'segment_compare';
    filters?: Record<string, any>;  // Extracted filter criteria
    segmentName?: string;           // For save operations
    segmentIds?: string[];          // For compare operations
  };
  // Navigation request parameters (P0-6)
  navigationParams?: {
    location: string;
    metric?: string;
  };
}

export interface ExtractedDistrictEntities {
  congressional?: string;        // 'pa-congress-07' or 'mi-07'
  stateSenate?: string;
  stateHouse?: string;
  schoolDistrict?: string;
  countyCommissioner?: string;   // 'cc-district-5'
  districtLevel?: 'congressional' | 'state_senate' | 'state_house' | 'school' | 'county_commissioner';
}

export function parseIntent(query: string): ParsedIntent {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/);

  // ============================================================================
  // OUTPUT/SAVE/EXPORT INTENT DETECTION (HIGHEST PRIORITY)
  // ============================================================================
  const outputIntent = detectOutputIntent(lower);
  if (outputIntent) {
    return {
      type: 'output_request',
      entities: [],
      outputParams: outputIntent,
    };
  }

  // ============================================================================
  // KNOWLEDGE GRAPH INTENT DETECTION
  // ============================================================================
  const graphIntent = detectGraphIntent(lower);
  if (graphIntent) {
    return {
      type: 'graph_query',
      entities: [],
      graphParams: graphIntent,
    };
  }

  // ============================================================================
  // TREND/HISTORICAL ANALYSIS DETECTION
  // ============================================================================
  const trendPatterns = [
    'trend',
    'historical',
    'history',
    'since 2020',
    'since 2022',
    'over time',
    'how has',
    'how have',
    'changed',
    'changing',
    'shift',
    'shifting',
    'flip',
    'flipped',
    'volatility',
    'volatile',
    'unstable',
    'momentum',
    'trajectory',
  ];

  if (trendPatterns.some(p => lower.includes(p))) {
    // Extract precinct names if mentioned
    const entities = extractPrecinctNames(query);
    return {
      type: 'trend_query',
      entities,
    };
  }

  // ============================================================================
  // REPORT HISTORY INTENT DETECTION
  // ============================================================================
  const reportHistoryPatterns = [
    'report history',
    'recent reports',
    'my reports',
    'past reports',
    'previous reports',
    'show me my reports',
    'what reports have i generated',
    'list reports',
    'generated reports',
  ];

  if (reportHistoryPatterns.some(p => lower.includes(p))) {
    return {
      type: 'report_history',
      entities: [],
    };
  }

  // ============================================================================
  // REPORT CUSTOMIZATION INTENT DETECTION
  // ============================================================================
  const reportCustomizePatterns = [
    'customize report',
    'customize sections',
    'choose sections',
    'select sections',
    'change sections',
    'modify sections',
    'report sections',
    'what sections',
    'which sections',
    'include in report',
    'exclude from report',
  ];

  if (reportCustomizePatterns.some(p => lower.includes(p))) {
    // Detect which report type they want to customize
    const reportType = detectReportTypeFromQuery(lower);
    return {
      type: 'report_request',
      entities: [],
      reportParams: {
        requestType: 'customize',
        reportType: reportType,
      },
    };
  }

  // ============================================================================
  // REPORT GENERATION INTENT DETECTION
  // ============================================================================
  const reportIntent = detectReportIntent(lower, query);
  if (reportIntent) {
    return {
      type: 'report_request',
      entities: reportIntent.targetArea ? [reportIntent.targetArea] : [],
      reportParams: reportIntent,
    };
  }

  // ============================================================================
  // SPATIAL/PROXIMITY QUERY DETECTION
  // ============================================================================
  const spatialIntent = detectSpatialIntent(lower, query);
  if (spatialIntent) {
    return {
      type: 'spatial_query',
      entities: [spatialIntent.location],
      spatialParams: spatialIntent,
    };
  }

  // ============================================================================
  // NAVIGATION INTENT DETECTION (P0-6)
  // Handles: "zoom to Lansing", "fly to MSU", "show median age in East Lansing"
  // ============================================================================
  const navigationIntent = detectNavigationIntent(lower, query);
  if (navigationIntent) {
    return {
      type: 'navigation',
      entities: [navigationIntent.location],
      navigationParams: navigationIntent,
    };
  }

  // ============================================================================
  // DONOR INTENT DETECTION (BEFORE COMPARISON)
  // ============================================================================
  const donorKeywords = [
    'donor',
    'donation',
    'fundrais',
    'contribution',
    'lapsed',
    'upgrade',
    'pac',
    'super pac',
    'independent expenditure',
    'outside money'
  ];

  const hasDonorContext = donorKeywords.some(keyword => lower.includes(keyword));

  // DONOR: Lapsed donors
  if (
    hasDonorContext &&
    (lower.includes('lapsed') ||
      lower.includes('stopped giving') ||
      lower.includes('haven\'t given') ||
      lower.includes('who stopped'))
  ) {
    if (lower.includes('cluster') || lower.includes('where are')) {
      return {
        type: 'donor_lapsed_clusters',
        entities: extractZipCodes(query),
        donorParams: extractDonorParams(query)
      };
    }
    return {
      type: 'donor_lapsed',
      entities: extractZipCodes(query),
      donorParams: extractDonorParams(query)
    };
  }

  // DONOR: Upgrade prospects
  if (
    hasDonorContext &&
    (lower.includes('upgrade') ||
      lower.includes('can give more') ||
      lower.includes('higher capacity') ||
      lower.includes('major donor'))
  ) {
    if (lower.includes('top') || lower.includes('best')) {
      return {
        type: 'donor_upgrade_top',
        entities: extractZipCodes(query),
        donorParams: extractDonorParams(query)
      };
    }
    return {
      type: 'donor_upgrade',
      entities: extractZipCodes(query),
      donorParams: extractDonorParams(query)
    };
  }

  // DONOR: Independent Expenditures
  if (
    lower.includes('independent expenditure') ||
    lower.includes('outside money') ||
    lower.includes('super pac') ||
    lower.includes('dark money') ||
    (lower.includes('who') && lower.includes('spending') && hasDonorContext)
  ) {
    if (lower.includes('spending against') || lower.includes('opposing')) {
      return {
        type: 'donor_ie_spending',
        entities: extractCandidateNames(query),
        donorParams: extractDonorParams(query)
      };
    }
    return {
      type: 'donor_ie',
      entities: extractCandidateNames(query),
      donorParams: extractDonorParams(query)
    };
  }

  // DONOR: Committee/PAC
  if (
    (lower.includes('pac') || lower.includes('committee')) &&
    !lower.includes('super pac') &&
    hasDonorContext
  ) {
    return {
      type: 'donor_committee',
      entities: extractCandidateNames(query),
      donorParams: extractDonorParams(query)
    };
  }

  // DONOR: Comparison (fundraising head-to-head)
  if (
    hasDonorContext &&
    (lower.includes('compare') ||
      lower.includes('versus') ||
      lower.includes(' vs ') ||
      lower.includes('against'))
  ) {
    const candidates = extractCandidateNames(query);
    return {
      type: 'donor_comparison',
      entities: candidates,
      donorParams: {
        candidate1: candidates[0],
        candidate2: candidates[1]
      }
    };
  }

  // DONOR: By candidate
  if (
    hasDonorContext &&
    (lower.includes('for') || lower.includes('to')) &&
    !lower.includes('compare')
  ) {
    const candidates = extractCandidateNames(query);
    if (candidates.length > 0) {
      return {
        type: 'donor_by_candidate',
        entities: candidates,
        donorParams: {
          candidate: candidates[0]
        }
      };
    }
  }

  // DONOR: Geographic/Overview
  if (
    hasDonorContext &&
    (lower.includes('where') ||
      lower.includes('geographic') ||
      lower.includes('concentration') ||
      lower.includes('how\'s our') ||
      lower.includes('how are we'))
  ) {
    return {
      type: 'donor_geographic',
      entities: extractZipCodes(query),
      donorParams: extractDonorParams(query)
    };
  }


  // ============================================================================
  // CANVASSING INTENT DETECTION
  // ============================================================================
  const canvassingKeywords = [
    'canvass',
    'door',
    'knock',
    'volunteer',
    'turf',
    'walk list',
    'route',
    'field operation'
  ];

  const hasCanvassingContext = canvassingKeywords.some(keyword => lower.includes(keyword));

  // CANVASSING: Estimate resources
  if (
    hasCanvassingContext &&
    (lower.includes('how many') ||
      lower.includes('estimate') ||
      lower.includes('doors') ||
      lower.includes('volunteers needed'))
  ) {
    return {
      type: 'canvass_estimate',
      entities: extractPrecinctNames(query)
    };
  }

  // CANVASSING: Optimize routes
  if (
    hasCanvassingContext &&
    (lower.includes('optimize') ||
      lower.includes('best route') ||
      lower.includes('efficient'))
  ) {
    return {
      type: 'canvass_optimize',
      entities: extractPrecinctNames(query)
    };
  }

  // CANVASSING: Analyze performance
  if (
    hasCanvassingContext &&
    (lower.includes('analysis') ||
      lower.includes('performance') ||
      lower.includes('results'))
  ) {
    return {
      type: 'canvass_analysis',
      entities: extractPrecinctNames(query)
    };
  }

  // CANVASSING: Plan operations (catch-all)
  if (hasCanvassingContext) {
    return {
      type: 'canvass_plan',
      entities: extractPrecinctNames(query)
    };
  }

  // ============================================================================
  // SEGMENT INTENT DETECTION
  // Detect queries about building, finding, saving, or comparing voter segments
  // ============================================================================
  const segmentIntent = detectSegmentIntent(lower, query);
  if (segmentIntent) {
    return segmentIntent;
  }

  // ============================================================================
  // COMPARISON DETECTION
  // ============================================================================
  if (
    lower.includes('compare') ||
    lower.includes('versus') ||
    lower.includes(' vs ') ||
    lower.includes('difference between')
  ) {
    const entities = extractComparisonEntities(query);
    return {
      type: 'comparison',
      entities,
      comparisonEntities: entities.length === 2 ? {
        left: entities[0],
        right: entities[1]
      } : undefined
    };
  }

  // ============================================================================
  // MULTI-LEVEL DISTRICT ANALYSIS DETECTION (Priority before filter!)
  // Handles: "Show State House 73", "Analyze MI-07", "What's in Senate District 21?"
  // Moved BEFORE filter detection to prevent "show me State House 73" being caught as filter
  // ============================================================================
  const districtEntities = extractDistrictEntities(query);
  const hasDistrictEntity = districtEntities.congressional ||
    districtEntities.stateSenate ||
    districtEntities.stateHouse ||
    districtEntities.schoolDistrict ||
    districtEntities.countyCommissioner;

  if (hasDistrictEntity) {
    // Determine the district ID for entities list
    const districtId =
      districtEntities.congressional ||
      districtEntities.stateSenate ||
      districtEntities.stateHouse ||
      districtEntities.schoolDistrict ||
      districtEntities.countyCommissioner;

    return {
      type: 'district_analysis',
      entities: districtId ? [districtId] : [],
      districtParams: districtEntities
    };
  }

  // ============================================================================
  // FILTER/SEARCH DETECTION
  // ============================================================================
  const filterKeywords = [
    'show me',
    'find',
    'filter',
    'search for',
    'list',
    'precincts with',
    'areas with',
    'districts with',
    // Wave 7: Added targeting metric keywords to catch more filter queries
    'which precincts',
    'where are the',
    'high gotv',
    'high persuasion',
    'high swing',
    'score high',
    'gotv priority',
    'persuasion opportunity',
    'swing potential',
    'targeting score',
    'combined score'
  ];

  if (filterKeywords.some(keyword => lower.includes(keyword))) {
    const filters = extractFilterCriteria(query);
    return {
      type: 'filter',
      entities: extractPrecinctNames(query),
      filters
    };
  }

  // Wave 7: Also detect queries that mention targeting metrics with "and" for bivariate queries
  const targetingMetrics = ['gotv', 'persuasion', 'swing', 'targeting'];
  const hasTargetingMetric = targetingMetrics.some(m => lower.includes(m));
  const hasQuantityQuestion = /\b(which|where|what|how many)\b/.test(lower);
  const hasPrecinctReference = lower.includes('precinct') || lower.includes('area') || lower.includes('district');

  if (hasTargetingMetric && hasQuantityQuestion && hasPrecinctReference) {
    const filters = extractFilterCriteria(query);
    return {
      type: 'filter',
      entities: extractPrecinctNames(query),
      filters
    };
  }

  // ============================================================================
  // DISTRICT/PRECINCT QUERY DETECTION (General)
  // Note: Multi-level district analysis (State House, Senate, Congressional) is handled
  // earlier in the function, before filter detection.
  // ============================================================================
  const districtKeywords = [
    'tell me about',
    'what is',
    'what are',
    'show',
    'analyze',
    'precinct',
    'district',
    'ward',
    'township'
  ];

  if (districtKeywords.some(keyword => lower.includes(keyword))) {
    const entities = extractPrecinctNames(query);
    if (entities.length > 0) {
      return {
        type: 'district_query',
        entities
      };
    }
  }

  // ============================================================================
  // DATA REQUEST DETECTION
  // ============================================================================
  const dataKeywords = [
    'demographics',
    'population',
    'income',
    'education',
    'turnout',
    'results',
    'voters',
    'donors',
    'how many',
    'what percentage'
  ];

  if (dataKeywords.some(keyword => lower.includes(keyword))) {
    return {
      type: 'data_request',
      entities: extractPrecinctNames(query),
      dataType: detectDataType(query)
    };
  }

  // ============================================================================
  // DEFAULT: GENERAL
  // ============================================================================
  return {
    type: 'general',
    entities: []
  };
}

export function fuzzyMatchPrecinct(query: string, precinctNames: string[]): string | null {
  const lower = query.toLowerCase();

  // Exact match
  for (const name of precinctNames) {
    if (lower.includes(name.toLowerCase())) {
      return name;
    }
  }

  // Partial match (match if query contains majority of words from name)
  for (const name of precinctNames) {
    const nameWords = name.toLowerCase().split(/\s+/);
    const matchedWords = nameWords.filter(word => lower.includes(word));

    if (matchedWords.length >= Math.ceil(nameWords.length / 2)) {
      return name;
    }
  }

  return null;
}

function slugifySchoolPhrase(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract all district entities from query (Pennsylvania when POLITICAL_STATE_FIPS=42).
 */
function extractDistrictEntities(query: string): ExtractedDistrictEntities {
  if (getPoliticalRegionEnv().stateFips === '42') {
    return extractDistrictEntitiesPA(query);
  }
  return extractDistrictEntitiesMI(query);
}

function extractDistrictEntitiesPA(query: string): ExtractedDistrictEntities {
  const result: ExtractedDistrictEntities = {};
  const lower = query.toLowerCase();

  const congressionalPatterns = [
    /\bpa[-\s]?0?(\d{1,2})\b/i,
    /\bpennsylvania\s+(\d{1,2})(?:th|st|nd|rd)?\s+congressional\b/i,
    /\bpennsylvania\s+(\d{1,2})(?:th|st|nd|rd)?\s+congressional\s+district\b/i,
    /\b(\d{1,2})(?:th|st|nd|rd)?\s+congressional\b/i,
    /\bcongressional\s+district\s+(\d{1,2})\b/i,
    /\bcd[-\s]?0?(\d{1,2})\b/i,
    /\bus\s+house\s+district\s+(\d{1,2})\b/i,
  ];

  for (const pattern of congressionalPatterns) {
    const match = query.match(pattern);
    if (match) {
      const num = match[1].padStart(2, '0');
      result.congressional = `pa-congress-${num}`;
      result.districtLevel = 'congressional';
      break;
    }
  }

  const stateSenatePatterns = [
    /\b(?:pa|pennsylvania)\s+senate\s+(\d{1,3})\b/i,
    /\b(?:state\s+)?senate\s+district\s+(\d{1,3})\b/i,
    /\bsd[-\s]?(\d{1,3})\b/i,
    /\bstate\s+senate\s+(\d{1,3})\b/i,
    /\b(\d{1,3})(?:th|st|nd|rd)?\s+state\s+senate\b/i,
    /\bsen(?:ate)?\.?\s+dist(?:rict)?\.?\s+(\d{1,3})\b/i,
  ];

  for (const pattern of stateSenatePatterns) {
    const match = query.match(pattern);
    if (match) {
      result.stateSenate = `pa-senate-${match[1]}`;
      result.districtLevel = 'state_senate';
      break;
    }
  }

  const stateHousePatterns = [
    /\b(?:pa|pennsylvania)\s+house\s+(\d{1,3})\b/i,
    /\b(?:state\s+)?house\s+district\s+(\d{1,3})\b/i,
    /\bhd[-\s]?(\d{1,3})\b/i,
    /\bstate\s+house\s+(\d{1,3})\b/i,
    /\b(\d{1,3})(?:th|st|nd|rd)?\s+(?:state\s+)?house\b/i,
    /\brep(?:resentative)?\.?\s+dist(?:rict)?\.?\s+(\d{1,3})\b/i,
  ];

  for (const pattern of stateHousePatterns) {
    const match = query.match(pattern);
    if (match) {
      result.stateHouse = `pa-house-${match[1]}`;
      result.districtLevel = 'state_house';
      break;
    }
  }

  const schoolPatterns = [
    /\b(.+?)\s+(?:public\s+)?school(?:s)?\s+(?:district|bond|millage|board)/i,
    /\b(.+?)\s+(?:community\s+)?school(?:s)?(?:\s+bond|\s+millage|\s+board)?/i,
    /\bschool\s+district\s+(?:for\s+)?(.+)/i,
  ];

  for (const pattern of schoolPatterns) {
    const match = query.match(pattern);
    if (match) {
      const slug = slugifySchoolPhrase(match[1]);
      if (slug.length >= 2) {
        result.schoolDistrict = slug;
        result.districtLevel = 'school';
        break;
      }
    }
  }

  const commissionerPatterns = [
    /\bcommissioner\s+district\s+(\d{1,2})\b/i,
    /\bcounty\s+commissioner\s+(\d{1,2})\b/i,
    /\bcc[-\s]?district\s+(\d{1,2})\b/i,
    /\bcc[-\s]?(\d{1,2})\b/i,
    /\b(\d{1,2})(?:th|st|nd|rd)?\s+commissioner\b/i,
  ];

  for (const pattern of commissionerPatterns) {
    const match = query.match(pattern);
    if (match) {
      result.countyCommissioner = `cc-district-${match[1]}`;
      result.districtLevel = 'county_commissioner';
      break;
    }
  }

  return result;
}

/** Legacy Michigan / non-PA FIPS extraction. */
function extractDistrictEntitiesMI(query: string): ExtractedDistrictEntities {
  const result: ExtractedDistrictEntities = {};
  const lower = query.toLowerCase();

  const congressionalPatterns = [
    /\bmi[-\s]?0?(\d{1,2})\b/i,
    /\bmichigan\s+(\d{1,2})(?:th|st|nd|rd)?\b/i,
    /\b(\d{1,2})(?:th|st|nd|rd)?\s+congressional\b/i,
    /\bcongressional\s+district\s+(\d{1,2})\b/i,
    /\bcd[-\s]?0?(\d{1,2})\b/i,
    /\bus\s+house\s+district\s+(\d{1,2})\b/i,
  ];

  for (const pattern of congressionalPatterns) {
    const match = query.match(pattern);
    if (match) {
      const num = match[1].padStart(2, '0');
      result.congressional = `mi-${num}`;
      result.districtLevel = 'congressional';
      break;
    }
  }

  const stateSenatePatterns = [
    /\b(?:state\s+)?senate\s+district\s+(\d{1,2})\b/i,
    /\bsd[-\s]?(\d{1,2})\b/i,
    /\b(?:mi|michigan)\s+senate\s+(\d{1,2})\b/i,
    /\bstate\s+senate\s+(\d{1,2})\b/i,
    /\b(\d{1,2})(?:th|st|nd|rd)?\s+state\s+senate\b/i,
    /\bsen(?:ate)?\.?\s+dist(?:rict)?\.?\s+(\d{1,2})\b/i,
  ];

  for (const pattern of stateSenatePatterns) {
    const match = query.match(pattern);
    if (match) {
      result.stateSenate = `mi-senate-${match[1]}`;
      result.districtLevel = 'state_senate';
      break;
    }
  }

  const stateHousePatterns = [
    /\b(?:state\s+)?house\s+district\s+(\d{1,3})\b/i,
    /\bhd[-\s]?(\d{1,3})\b/i,
    /\bstate\s+house\s+(\d{1,3})\b/i,
    /\b(?:mi|michigan)\s+house\s+(\d{1,3})\b/i,
    /\b(\d{1,3})(?:th|st|nd|rd)?\s+(?:state\s+)?house\b/i,
    /\brep(?:resentative)?\.?\s+dist(?:rict)?\.?\s+(\d{1,3})\b/i,
  ];

  for (const pattern of stateHousePatterns) {
    const match = query.match(pattern);
    if (match) {
      result.stateHouse = `mi-house-${match[1]}`;
      result.districtLevel = 'state_house';
      break;
    }
  }

  const knownSchoolDistricts: Record<string, string> = {
    'mason': 'mason-public-schools-ingham',
    'mason public': 'mason-public-schools-ingham',
    'lansing': 'lansing-public-school-district',
    'lansing public': 'lansing-public-school-district',
    'lansing school': 'lansing-public-school-district',
    'east lansing': 'east-lansing-public-schools',
    'east lansing public': 'east-lansing-public-schools',
    'okemos': 'okemos-public-schools',
    'okemos public': 'okemos-public-schools',
    'haslett': 'haslett-public-schools',
    'haslett public': 'haslett-public-schools',
    'williamston': 'williamston-community-schools',
    'williamston community': 'williamston-community-schools',
    'holt': 'holt-public-schools',
    'holt public': 'holt-public-schools',
    'leslie': 'leslie-public-schools',
    'leslie public': 'leslie-public-schools',
    'stockbridge': 'stockbridge-community-schools',
    'dansville': 'dansville-schools',
    'webberville': 'webberville-community-schools',
    'waverly': 'waverly-community-schools',
    'eaton rapids': 'eaton-rapids-public-schools',
  };

  const schoolPatterns = [
    /\b(.+?)\s+(?:public\s+)?school(?:s)?\s+(?:district|bond|millage|board)/i,
    /\b(.+?)\s+(?:community\s+)?school(?:s)?(?:\s+bond|\s+millage|\s+board)?/i,
    /\bschool\s+district\s+(?:for\s+)?(.+)/i,
  ];

  for (const pattern of schoolPatterns) {
    const match = query.match(pattern);
    if (match) {
      const schoolName = match[1].toLowerCase().trim();
      for (const [key, value] of Object.entries(knownSchoolDistricts)) {
        if (schoolName.includes(key) || key.includes(schoolName)) {
          result.schoolDistrict = value;
          result.districtLevel = 'school';
          break;
        }
      }
      if (result.schoolDistrict) break;
    }
  }

  if (!result.schoolDistrict) {
    for (const [key, value] of Object.entries(knownSchoolDistricts)) {
      if (lower.includes(key) && (lower.includes('school') || lower.includes('bond') || lower.includes('millage'))) {
        result.schoolDistrict = value;
        result.districtLevel = 'school';
        break;
      }
    }
  }

  const commissionerPatterns = [
    /\bcommissioner\s+district\s+(\d{1,2})\b/i,
    /\bcounty\s+commissioner\s+(\d{1,2})\b/i,
    /\bcc[-\s]?district\s+(\d{1,2})\b/i,
    /\bcc[-\s]?(\d{1,2})\b/i,
    /\b(\d{1,2})(?:th|st|nd|rd)?\s+commissioner\b/i,
  ];

  for (const pattern of commissionerPatterns) {
    const match = query.match(pattern);
    if (match) {
      result.countyCommissioner = `cc-district-${match[1]}`;
      result.districtLevel = 'county_commissioner';
      break;
    }
  }

  return result;
}

/**
 * Extract precinct/jurisdiction names from query
 */
function extractPrecinctNames(query: string): string[] {
  const entities: string[] = [];

  const jurisdictions =
    getPoliticalRegionEnv().stateFips === '42'
      ? [
          'Philadelphia',
          'Pittsburgh',
          'Harrisburg',
          'Allentown',
          'Erie',
          'Reading',
          'Scranton',
          'Bethlehem',
          'Lancaster',
          'York',
          'Chester',
          'Allegheny County',
          'Montgomery County',
          'Bucks County',
          'Delaware County',
        ]
      : [
          'East Lansing',
          'Lansing',
          'Meridian Township',
          'Delhi Township',
          'Williamston',
          'Mason',
          'Leslie',
          'Haslett',
          'Okemos',
          'Holt',
          'Webberville',
          'Stockbridge',
          'Dansville',
        ];

  jurisdictions.forEach(jurisdiction => {
    if (query.toLowerCase().includes(jurisdiction.toLowerCase())) {
      entities.push(jurisdiction);
    }
  });

  // Extract district entities using the new comprehensive function
  const districtEntities = extractDistrictEntities(query);

  // Add district entities to the list if found
  if (districtEntities.congressional) {
    entities.push(districtEntities.congressional);
  }
  if (districtEntities.stateSenate) {
    entities.push(districtEntities.stateSenate);
  }
  if (districtEntities.stateHouse) {
    entities.push(districtEntities.stateHouse);
  }
  if (districtEntities.schoolDistrict) {
    entities.push(districtEntities.schoolDistrict);
  }
  if (districtEntities.countyCommissioner) {
    entities.push(districtEntities.countyCommissioner);
  }

  // Match precinct patterns: "Precinct 1", "Ward 2", etc.
  const precinctPattern = /(?:precinct|ward)\s+(\d+)/gi;
  let match;
  while ((match = precinctPattern.exec(query)) !== null) {
    entities.push(match[0]);
  }

  return entities;
}

/**
 * Extract comparison entities (left vs right)
 */
function extractComparisonEntities(query: string): string[] {
  const entities: string[] = [];

  // Try to split on comparison keywords
  const splitPatterns = [
    / versus /i,
    / vs\.? /i,
    / and /i,
    / to /i,
    / compare /i
  ];

  let parts: string[] = [query];
  for (const pattern of splitPatterns) {
    if (pattern.test(query)) {
      parts = query.split(pattern);
      break;
    }
  }

  // Extract from each part
  parts.forEach(part => {
    const names = extractPrecinctNames(part);
    entities.push(...names);
  });

  return entities.slice(0, 2); // Only return first two
}

/**
 * Extract filter criteria from query
 */
function extractFilterCriteria(query: string): ParsedIntent['filters'] {
  const lower = query.toLowerCase();
  const filters: ParsedIntent['filters'] = {};

  // Detect metric
  if (lower.includes('swing')) {
    filters.metric = 'swing_potential';
  } else if (lower.includes('margin')) {
    filters.metric = 'margin';
  } else if (lower.includes('turnout')) {
    filters.metric = 'turnout';
  } else if (lower.includes('gotv')) {
    filters.metric = 'gotv_priority';
  } else if (lower.includes('persuasion')) {
    filters.metric = 'persuasion_opportunity';
  } else if (lower.includes('competitive')) {
    filters.metric = 'competitiveness';
  }

  // Detect threshold and operator
  const numberPattern = /(\d+(?:\.\d+)?)\s*(%|percent)?/i;
  const match = numberPattern.exec(query);

  if (match) {
    filters.threshold = parseFloat(match[1]);

    // Detect operator
    if (lower.includes('less than') || lower.includes('below') || lower.includes('<')) {
      filters.operator = 'less_than';
    } else if (lower.includes('greater than') || lower.includes('above') || lower.includes('>')) {
      filters.operator = 'greater_than';
    } else if (lower.includes('equals') || lower.includes('exactly') || lower.includes('=')) {
      filters.operator = 'equals';
    }
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

/**
 * Detect the type of data being requested
 */
function detectDataType(query: string): string | undefined {
  const lower = query.toLowerCase();

  if (lower.includes('demographics') || lower.includes('population') || lower.includes('age')) {
    return 'demographics';
  }
  if (lower.includes('election') || lower.includes('results') || lower.includes('votes')) {
    return 'elections';
  }
  if (lower.includes('donor') || lower.includes('contribution')) {
    return 'donors';
  }
  if (lower.includes('turnout')) {
    return 'turnout';
  }
  if (lower.includes('targeting') || lower.includes('gotv') || lower.includes('persuasion')) {
    return 'targeting';
  }

  return undefined;
}

/**
 * Extract ZIP codes from query
 */
function extractZipCodes(query: string): string[] {
  const zipPattern = /\b(\d{5})\b/g;
  const matches = query.match(zipPattern);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Extract candidate names from query
 * Known MI-07 candidates: Slotkin, Rogers, Kildee, etc.
 */
function extractCandidateNames(query: string): string[] {
  const candidates: string[] = [];
  const lower = query.toLowerCase();

  // Known MI candidates
  const knownCandidates = [
    'Slotkin',
    'Rogers',
    'Kildee',
    'McClain',
    'Scholten',
    'Bergman',
    'Moolenaar',
    'Walberg',
    'Dingell',
    'Stevens',
    'Thanedar',
    'Tlaib',
    'Trump',
    'Harris',
    'Biden'
  ];

  knownCandidates.forEach(name => {
    if (lower.includes(name.toLowerCase())) {
      candidates.push(name);
    }
  });

  return candidates;
}

/**
 * Extract donor-specific parameters from query
 */
function extractDonorParams(query: string): ParsedIntent['donorParams'] {
  const lower = query.toLowerCase();
  const params: ParsedIntent['donorParams'] = {};

  // Extract minimum value
  const valuePattern = /\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\+?/;
  const valueMatch = query.match(valuePattern);
  if (valueMatch) {
    params.minValue = parseFloat(valueMatch[1].replace(/,/g, ''));
  }

  // Extract priority
  if (lower.includes('high priority') || lower.includes('high-value')) {
    params.priority = 'high';
  } else if (lower.includes('medium priority')) {
    params.priority = 'medium';
  } else if (lower.includes('low priority')) {
    params.priority = 'low';
  }

  // Extract minimum score
  const scorePattern = /score\s+(?:above|over|>=?)\s+(\d+)/i;
  const scoreMatch = query.match(scorePattern);
  if (scoreMatch) {
    params.minScore = parseInt(scoreMatch[1]);
  }

  // Extract party
  if (lower.includes('democrat') || lower.includes('dem ')) {
    params.party = 'DEM';
  } else if (lower.includes('republican') || lower.includes('rep ') || lower.includes('gop')) {
    params.party = 'REP';
  }

  // Extract race
  const racePattern = /(?:mi-|michigan\s+)(\d+)/i;
  const raceMatch = query.match(racePattern);
  if (raceMatch) {
    params.race = `MI-${raceMatch[1].padStart(2, '0')}`;
  }

  return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * Detect save/export/download intent and what the user wants to output
 */
function detectOutputIntent(lower: string): ParsedIntent['outputParams'] | null {
  // Request type detection patterns
  const savePatterns = [
    'save this',
    'save my',
    'save the',
    'keep this',
    'store this',
    'remember this',
  ];

  const exportPatterns = [
    'export this',
    'export my',
    'export the',
    'export to',
    'get me a csv',
    'give me a csv',
    'as csv',
    'to csv',
    'as excel',
    'to excel',
    'as spreadsheet',
  ];

  const downloadPatterns = [
    'download this',
    'download my',
    'download the',
    'can i download',
    'let me download',
    'i want to download',
  ];

  const sharePatterns = [
    'share this',
    'share my',
    'share the',
    'send this',
    'email this',
  ];

  // Determine request type
  let requestType: 'save' | 'export' | 'download' | 'share' | null = null;

  if (savePatterns.some(p => lower.includes(p))) {
    requestType = 'save';
  } else if (exportPatterns.some(p => lower.includes(p))) {
    requestType = 'export';
  } else if (downloadPatterns.some(p => lower.includes(p))) {
    requestType = 'download';
  } else if (sharePatterns.some(p => lower.includes(p))) {
    requestType = 'share';
  }

  // If no request type detected, check for more general patterns
  if (!requestType) {
    // Check for single word + context patterns
    if (
      (lower.includes('save') || lower.includes('export') || lower.includes('download')) &&
      (lower.includes('analysis') || lower.includes('conversation') || lower.includes('chat') ||
        lower.includes('data') || lower.includes('results') || lower.includes('segment') ||
        lower.includes('report') || lower.includes('work') || lower.includes('progress'))
    ) {
      if (lower.includes('save')) requestType = 'save';
      else if (lower.includes('export')) requestType = 'export';
      else if (lower.includes('download')) requestType = 'download';
    }
  }

  // Return null if no output intent detected
  if (!requestType) {
    return null;
  }

  // Determine what the user wants to output
  let targetType: 'analysis' | 'conversation' | 'segment' | 'report' | 'data' | 'map' | 'general' = 'general';

  // Analysis/results
  if (
    lower.includes('analysis') ||
    lower.includes('results') ||
    lower.includes('findings') ||
    lower.includes('insights')
  ) {
    targetType = 'analysis';
  }
  // Conversation/chat
  else if (
    lower.includes('conversation') ||
    lower.includes('chat') ||
    lower.includes('discussion') ||
    lower.includes('transcript')
  ) {
    targetType = 'conversation';
  }
  // Segment — do **not** use the word "precincts" alone (conflicts with "export these precincts to CSV")
  else if (
    lower.includes('segment') ||
    lower.includes('selection') ||
    /\bfiltered\b/.test(lower)
  ) {
    targetType = 'segment';
  }
  // Report/PDF
  else if (
    lower.includes('report') ||
    lower.includes('pdf') ||
    lower.includes('document')
  ) {
    targetType = 'report';
  }
  // Data/CSV
  else if (
    lower.includes('data') ||
    lower.includes('csv') ||
    lower.includes('excel') ||
    lower.includes('spreadsheet')
  ) {
    targetType = 'data';
  }
  // Map
  else if (
    lower.includes('map') ||
    lower.includes('visualization') ||
    lower.includes('view')
  ) {
    targetType = 'map';
  }

  return {
    requestType,
    targetType,
  };
}

/**
 * Detect segment-related intents (create, find, save, compare segments)
 */
function detectSegmentIntent(lower: string, originalQuery: string): ParsedIntent | null {
  // Segment creation patterns - "build a segment", "target voters", "find voters who..."
  const createPatterns = [
    'build a segment',
    'build segment',
    'create a segment',
    'create segment',
    'make a segment',
    'target voters',
    'find voters who',
    'find voters with',
    'identify voters',
    'build a universe',
    'create a universe',
    'segment voters',
    'voter segment',
    'build a targeting',
    'create targeting'
  ];

  // Segment listing/finding patterns - "show my segments", "list segments"
  const findPatterns = [
    'my segments',
    'my saved segments',
    'saved segments',
    'list segments',
    'show segments',
    'view segments',
    'all segments',
    'which segments',
    'what segments'
  ];

  // Segment save patterns - "save this segment", "save as segment"
  const savePatterns = [
    'save this segment',
    'save segment',
    'save the segment',
    'save as segment',
    'save these precincts',
    'save this selection'
  ];

  // Segment comparison patterns - "compare segments", "compare my segments"
  const comparePatterns = [
    'compare segments',
    'compare my segments',
    'compare the segments',
    'segment comparison',
    'compare universes'
  ];

  // Check for segment_save first (most specific)
  if (savePatterns.some(p => lower.includes(p))) {
    // Try to extract segment name if provided
    const nameMatch = originalQuery.match(/save\s+(?:this\s+)?segment\s+(?:as\s+)?["']?([^"'\n]+?)["']?(?:\s|$)/i);
    return {
      type: 'segment_save',
      entities: [],
      segmentParams: {
        intentType: 'segment_save',
        segmentName: nameMatch ? nameMatch[1].trim() : undefined
      }
    };
  }

  // Check for segment_compare
  if (comparePatterns.some(p => lower.includes(p))) {
    return {
      type: 'segment_compare',
      entities: [],
      segmentParams: {
        intentType: 'segment_compare'
      }
    };
  }

  // Check for segment_find
  if (findPatterns.some(p => lower.includes(p))) {
    return {
      type: 'segment_find',
      entities: [],
      segmentParams: {
        intentType: 'segment_find'
      }
    };
  }

  // Check for segment_create - extract filter hints if possible
  if (createPatterns.some(p => lower.includes(p))) {
    const filters: Record<string, any> = {};

    // Try to extract GOTV threshold
    const gotvMatch = lower.match(/gotv\s*(?:score|priority)?\s*(?:above|over|>|greater than)\s*(\d+)/);
    if (gotvMatch) {
      filters.gotvPriority = { min: parseInt(gotvMatch[1]) };
    }

    // Try to extract persuasion threshold
    const persuasionMatch = lower.match(/persuasion\s*(?:score|opportunity)?\s*(?:above|over|>|greater than)\s*(\d+)/);
    if (persuasionMatch) {
      filters.persuasionOpportunity = { min: parseInt(persuasionMatch[1]) };
    }

    // Try to extract swing threshold
    const swingMatch = lower.match(/swing\s*(?:score|potential)?\s*(?:above|over|>|greater than)\s*(\d+)/);
    if (swingMatch) {
      filters.swingPotential = { min: parseInt(swingMatch[1]) };
    }

    // Try to extract partisan lean
    const leanMatch = lower.match(/lean\s*(?:more than|above|over|>)?\s*(d|r)\+?(\d+)/i);
    if (leanMatch) {
      const party = leanMatch[1].toLowerCase();
      const value = parseInt(leanMatch[2]);
      filters.partisanLean = party === 'd' ? { max: -value } : { min: value };
    }

    return {
      type: 'segment_create',
      entities: [],
      segmentParams: {
        intentType: 'segment_create',
        filters: Object.keys(filters).length > 0 ? filters : undefined
      }
    };
  }

  return null;
}

/**
 * Detect report generation intent and extract report type
 */
function detectReportIntent(lower: string, originalQuery: string): ParsedIntent['reportParams'] | null {
  // Report generation patterns
  const generatePatterns = [
    'generate a report',
    'generate report',
    'create a report',
    'create report',
    'make a report',
    'make report',
    'build a report',
    'give me a report',
    'i need a report',
    'can i get a report',
    'i want a report',
    'produce a report',
    'prepare a report',
  ];

  // PDF/document patterns
  const pdfPatterns = [
    'generate a pdf',
    'generate pdf',
    'create a pdf',
    'create pdf',
    'make a pdf',
    'pdf for',
    'pdf of',
    'document for',
    'document of',
  ];

  // Briefing/summary patterns
  const briefingPatterns = [
    'briefing for',
    'briefing on',
    'summary for',
    'summary of',
    'overview for',
    'overview of',
    'executive summary',
    'quick summary',
    'one pager',
    'one-pager',
  ];

  // Check for generate intent
  let requestType: 'generate' | 'preview' | 'customize' = 'generate';
  let hasReportIntent = false;

  if (generatePatterns.some(p => lower.includes(p))) {
    hasReportIntent = true;
  } else if (pdfPatterns.some(p => lower.includes(p))) {
    hasReportIntent = true;
  } else if (briefingPatterns.some(p => lower.includes(p))) {
    hasReportIntent = true;
  }

  // Check for preview intent
  if (
    lower.includes('preview') ||
    lower.includes('what would') ||
    lower.includes('what will') ||
    lower.includes('show me what')
  ) {
    if (lower.includes('report') || lower.includes('pdf')) {
      hasReportIntent = true;
      requestType = 'preview';
    }
  }

  // Check for customize intent
  if (
    lower.includes('customize') ||
    lower.includes('change sections') ||
    lower.includes('modify report')
  ) {
    hasReportIntent = true;
    requestType = 'customize';
  }

  // Additional patterns that imply report generation
  if (!hasReportIntent) {
    // "I need something to give my team" / "something for my field team"
    if (
      (lower.includes('something') || lower.includes('document') || lower.includes('material')) &&
      (lower.includes('team') || lower.includes('volunteers') || lower.includes('staff') || lower.includes('leadership'))
    ) {
      hasReportIntent = true;
    }

    // "print this" / "printable version"
    if (lower.includes('print') && (lower.includes('this') || lower.includes('version'))) {
      hasReportIntent = true;
    }
  }

  if (!hasReportIntent) {
    return null;
  }

  // Detect report type
  type ReportType = 'executive' | 'targeting' | 'comparison' | 'segment' | 'canvass' | 'donor' | 'profile' | 'general';
  let reportType: ReportType = 'general';

  // Executive/Quick summary
  if (
    lower.includes('executive') ||
    lower.includes('quick') ||
    lower.includes('one page') ||
    lower.includes('one-page') ||
    lower.includes('1 page') ||
    lower.includes('brief summary')
  ) {
    reportType = 'executive';
  }
  // Targeting/Priority
  else if (
    lower.includes('targeting') ||
    lower.includes('priority') ||
    lower.includes('ranked') ||
    lower.includes('top precincts') ||
    lower.includes('priority list')
  ) {
    reportType = 'targeting';
  }
  // Comparison
  else if (
    lower.includes('comparison') ||
    lower.includes('compare') ||
    lower.includes(' vs ') ||
    lower.includes('versus') ||
    lower.includes('side by side') ||
    lower.includes('side-by-side')
  ) {
    reportType = 'comparison';
  }
  // Segment
  else if (
    lower.includes('segment') ||
    lower.includes('filtered') ||
    lower.includes('my selection') ||
    lower.includes('these precincts')
  ) {
    reportType = 'segment';
  }
  // Canvassing
  else if (
    lower.includes('canvass') ||
    lower.includes('field') ||
    lower.includes('walk list') ||
    lower.includes('turf') ||
    lower.includes('door') ||
    lower.includes('volunteer')
  ) {
    reportType = 'canvass';
  }
  // Donor
  else if (
    lower.includes('donor') ||
    lower.includes('fundrais') ||
    lower.includes('contribution') ||
    lower.includes('giving')
  ) {
    reportType = 'donor';
  }
  // Full profile
  else if (
    lower.includes('full') ||
    lower.includes('comprehensive') ||
    lower.includes('detailed') ||
    lower.includes('complete') ||
    lower.includes('political profile') ||
    lower.includes('7 page') ||
    lower.includes('7-page')
  ) {
    reportType = 'profile';
  }

  // Extract target area if mentioned
  let targetArea: string | undefined;
  const areaPatterns = [
    /(?:for|of|on|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /\b(lansing|east\s+lansing|meridian|delhi|williamston|mason|okemos)\b/i,
  ];

  for (const pattern of areaPatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      targetArea = match[1].trim();
      break;
    }
  }

  // Extract comparison areas if comparison report
  let comparisonAreas: [string, string] | undefined;
  if (reportType === 'comparison') {
    const compMatch = originalQuery.match(/(\w+(?:\s+\w+)?)\s+(?:vs|versus|compared\s+to|and)\s+(\w+(?:\s+\w+)?)/i);
    if (compMatch) {
      comparisonAreas = [compMatch[1].trim(), compMatch[2].trim()];
    }
  }

  return {
    requestType,
    reportType,
    targetArea,
    comparisonAreas,
  };
}

/**
 * Detect spatial/proximity query intent
 * Handles patterns like:
 * - "donors within 5 miles of MSU"
 * - "precincts within 10 minute drive of the capitol"
 * - "show voters in a 15 min walk from 123 Main St"
 * - "canvassing area 2 miles around Lansing City Hall"
 */
function detectSpatialIntent(lower: string, originalQuery: string): ParsedIntent['spatialParams'] | null {
  // ============================================================================
  // RADIUS PATTERNS (miles, km)
  // ============================================================================
  const radiusPatterns = [
    // "within X miles of [location]"
    /within\s+(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|km)\s+(?:of|from)\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "X mile radius of/around [location]"
    /(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|km)\s*(?:radius)?\s*(?:of|around|from)\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "in a X mile radius around [location]"
    /in\s+a?\s*(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|km)\s*radius\s*(?:of|around|from)?\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "[data] X miles from [location]"
    /(?:donors?|precincts?|voters?|canvass\w*)\s+(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|km)\s+(?:from|of|around)\s+(.+?)(?:\?|$|,|\.|;)/i,
  ];

  for (const pattern of radiusPatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      const distance = parseFloat(match[1]);
      const unitRaw = match[2].toLowerCase();
      const location = match[3].trim();

      // Normalize unit
      const unit: 'miles' | 'kilometers' =
        unitRaw.startsWith('k') ? 'kilometers' : 'miles';

      // Detect data type from query context
      const dataType = detectSpatialDataType(lower);

      return {
        queryType: 'radius',
        distance,
        unit,
        location,
        dataType,
      };
    }
  }

  // ============================================================================
  // DRIVE TIME PATTERNS (minutes)
  // ============================================================================
  const driveTimePatterns = [
    // "within X minute drive of [location]"
    /within\s+(?:a\s+)?(\d+)\s*(?:minute|min)\s*drive\s+(?:of|from|to)\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "X minute drive from [location]"
    /(\d+)\s*(?:minute|min)\s*(?:drive|driving)\s+(?:time\s+)?(?:of|from|to|around)\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "X min drive of [location]"
    /(\d+)\s*min\s*drive\s+(?:of|from|to)\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "can drive to in X minutes from [location]"
    /(?:can\s+)?drive\s+(?:to\s+)?in\s+(\d+)\s*(?:minutes?|min)\s+(?:from|of)\s+(.+?)(?:\?|$|,|\.|;)/i,
  ];

  for (const pattern of driveTimePatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      const distance = parseInt(match[1], 10);
      const location = match[2].trim();
      const dataType = detectSpatialDataType(lower);

      return {
        queryType: 'drivetime',
        distance,
        unit: 'minutes',
        location,
        dataType,
      };
    }
  }

  // ============================================================================
  // WALK TIME PATTERNS (minutes)
  // ============================================================================
  const walkTimePatterns = [
    // "within X minute walk of [location]"
    /within\s+(?:a\s+)?(\d+)\s*(?:minute|min)\s*walk\s+(?:of|from|to)\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "X minute walk from [location]"
    /(\d+)\s*(?:minute|min)\s*(?:walk|walking)\s+(?:time\s+)?(?:of|from|to|around)\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "walkable in X minutes from [location]"
    /walkable\s+in\s+(\d+)\s*(?:minutes?|min)\s+(?:from|of)\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "X min walk of [location]"
    /(\d+)\s*min\s*walk\s+(?:of|from|to)\s+(.+?)(?:\?|$|,|\.|;)/i,
  ];

  for (const pattern of walkTimePatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      const distance = parseInt(match[1], 10);
      const location = match[2].trim();
      const dataType = detectSpatialDataType(lower);

      return {
        queryType: 'walktime',
        distance,
        unit: 'minutes',
        location,
        dataType,
      };
    }
  }

  // ============================================================================
  // GENERIC "NEAR" PATTERNS (default to 5 mile radius)
  // ============================================================================
  const nearPatterns = [
    // "donors near [location]"
    /(?:donors?|precincts?|voters?)\s+near\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "near [location]" with data context
    /(?:show|find|get|list)\s+(?:me\s+)?(?:donors?|precincts?|voters?)\s+(?:close\s+to|near|around)\s+(.+?)(?:\?|$|,|\.|;)/i,
  ];

  for (const pattern of nearPatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      const location = match[1].trim();
      const dataType = detectSpatialDataType(lower);

      return {
        queryType: 'radius',
        distance: 5, // Default 5 miles for "near"
        unit: 'miles',
        location,
        dataType,
      };
    }
  }

  return null;
}

/**
 * Detect what type of data the user is asking about in spatial query
 */
function detectSpatialDataType(lower: string): 'donors' | 'precincts' | 'voters' | 'all' {
  if (lower.includes('donor') || lower.includes('contribut') || lower.includes('fundrais')) {
    return 'donors';
  }
  if (lower.includes('precinct') || lower.includes('district') || lower.includes('ward')) {
    return 'precincts';
  }
  if (lower.includes('voter') || lower.includes('canvass') || lower.includes('gotv')) {
    return 'voters';
  }
  // Default to 'all' if no specific data type mentioned
  return 'all';
}

/**
 * Detect report type from query for customization
 */
function detectReportTypeFromQuery(lower: string): 'executive' | 'targeting' | 'comparison' | 'segment' | 'canvass' | 'donor' | 'profile' | 'general' {
  if (lower.includes('executive') || lower.includes('summary')) {
    return 'executive';
  }
  if (lower.includes('targeting') || lower.includes('priority')) {
    return 'targeting';
  }
  if (lower.includes('comparison') || lower.includes('compare')) {
    return 'comparison';
  }
  if (lower.includes('segment')) {
    return 'segment';
  }
  if (lower.includes('canvass') || lower.includes('field') || lower.includes('turf')) {
    return 'canvass';
  }
  if (lower.includes('donor') || lower.includes('fundrais')) {
    return 'donor';
  }
  if (lower.includes('profile') || lower.includes('full') || lower.includes('comprehensive')) {
    return 'profile';
  }
  return 'general';
}

/**
 * Detect knowledge graph query intent
 * Handles patterns like:
 * - "show me the knowledge graph"
 * - "what's in the knowledge graph"
 * - "show relationships for [entity]"
 * - "how is [entity1] connected to [entity2]"
 * - "list all candidates"
 */
function detectGraphIntent(lower: string): ParsedIntent['graphParams'] | null {
  // ============================================================================
  // OVERVIEW PATTERNS
  // ============================================================================
  const overviewPatterns = [
    /(?:show|display|view|open)\s+(?:the\s+)?knowledge\s*graph/i,
    /what(?:'s| is)\s+in\s+the\s+(?:knowledge\s+)?graph/i,
    /knowledge\s*graph\s+(?:overview|summary|stats|statistics)/i,
    /graph\s+overview/i,
    /show\s+(?:me\s+)?(?:all\s+)?entities/i,
    /what\s+entities\s+(?:do\s+you\s+have|are\s+there)/i,
  ];

  for (const pattern of overviewPatterns) {
    if (pattern.test(lower)) {
      return { queryType: 'overview' };
    }
  }

  // ============================================================================
  // PATH/CONNECTION PATTERNS
  // ============================================================================
  // "how is X connected to Y"
  const pathMatch1 = lower.match(/how\s+is\s+(.+?)\s+connected\s+to\s+(.+?)(?:\?|$)/i);
  if (pathMatch1) {
    return {
      queryType: 'path',
      sourceName: pathMatch1[1].trim(),
      targetName: pathMatch1[2].trim(),
    };
  }

  // "connection between X and Y"
  const pathMatch2 = lower.match(/connection(?:s)?\s+between\s+(.+?)\s+and\s+(.+?)(?:\?|$)/i);
  if (pathMatch2) {
    return {
      queryType: 'path',
      sourceName: pathMatch2[1].trim(),
      targetName: pathMatch2[2].trim(),
    };
  }

  // "path from X to Y"
  const pathMatch3 = lower.match(/path\s+from\s+(.+?)\s+to\s+(.+?)(?:\?|$)/i);
  if (pathMatch3) {
    return {
      queryType: 'path',
      sourceName: pathMatch3[1].trim(),
      targetName: pathMatch3[2].trim(),
    };
  }

  // ============================================================================
  // EXPLORE ENTITY PATTERNS
  // ============================================================================
  // "show relationships for X"
  const exploreMatch1 = lower.match(/(?:show|display|view)\s+(?:me\s+)?relationships?\s+for\s+(.+?)(?:\?|$)/i);
  if (exploreMatch1) {
    return {
      queryType: 'explore',
      entityName: exploreMatch1[1].trim(),
    };
  }

  // "explore X" (in graph context)
  const exploreMatch2 = lower.match(/explore\s+(.+?)\s+(?:in\s+(?:the\s+)?graph|relationships?)(?:\?|$)/i);
  if (exploreMatch2) {
    return {
      queryType: 'explore',
      entityName: exploreMatch2[1].trim(),
    };
  }

  // "what is connected to X"
  const exploreMatch3 = lower.match(/what(?:'s| is)\s+connected\s+to\s+(.+?)(?:\?|$)/i);
  if (exploreMatch3) {
    return {
      queryType: 'explore',
      entityName: exploreMatch3[1].trim(),
    };
  }

  // "who/what is related to X"
  const exploreMatch4 = lower.match(/(?:who|what)\s+is\s+related\s+to\s+(.+?)(?:\?|$)/i);
  if (exploreMatch4) {
    return {
      queryType: 'explore',
      entityName: exploreMatch4[1].trim(),
    };
  }

  // ============================================================================
  // SEARCH ENTITY PATTERNS
  // ============================================================================
  // "search for X" / "find entities related to X"
  // IMPORTANT: Exclude filter-like queries (precincts with, voters with, etc.)
  // These should be handled by the filter/segment handlers, not graph search
  const isFilterQuery = /(?:precincts?|voters?|areas?|districts?)\s+(?:with|where|that|having)/i.test(lower) ||
    /(?:swing|gotv|turnout|lean|education|income|age)\s*(?:>|<|over|under|above|below)/i.test(lower);

  const searchMatch1 = lower.match(/(?:search|find)\s+(?:for\s+)?(?:entities\s+)?(?:related\s+to\s+)?(.+?)(?:\s+in\s+(?:the\s+)?graph)?(?:\?|$)/i);
  if (searchMatch1 && !lower.includes('similar') && !lower.includes('connected') && !isFilterQuery) {
    return {
      queryType: 'search' as const,
      searchTerm: searchMatch1[1].trim(),
    };
  }

  // ============================================================================
  // LIST ENTITY TYPE PATTERNS
  // ============================================================================
  const entityTypes = [
    'candidate', 'candidates',
    'office', 'offices',
    'party', 'parties',
    'jurisdiction', 'jurisdictions',
    'precinct', 'precincts',
    'issue', 'issues',
    'organization', 'organizations',
    'event', 'events',
    'poll', 'polls',
    'election', 'elections',
  ];

  // "list all candidates" / "show me the offices"
  const listMatch = lower.match(/(?:list|show|display|get)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(candidate|office|part(?:y|ies)|jurisdiction|precinct|issue|organization|event|poll|election)s?(?:\s+in\s+(?:the\s+)?graph)?/i);
  if (listMatch) {
    const typeRaw = listMatch[1].toLowerCase();
    // Normalize plural/singular
    let entityType = typeRaw;
    if (typeRaw === 'parties') entityType = 'party';
    else if (typeRaw.endsWith('s')) entityType = typeRaw.slice(0, -1);

    return {
      queryType: 'list',
      entityType,
    };
  }

  // "what candidates are there"
  const whatListMatch = lower.match(/what\s+(candidate|office|part(?:y|ies)|jurisdiction|precinct|issue|organization|event|poll|election)s?\s+(?:are\s+there|do\s+you\s+have|exist)/i);
  if (whatListMatch) {
    const typeRaw = whatListMatch[1].toLowerCase();
    let entityType = typeRaw;
    if (typeRaw === 'parties') entityType = 'party';
    else if (typeRaw.endsWith('s')) entityType = typeRaw.slice(0, -1);

    return {
      queryType: 'list',
      entityType,
    };
  }

  return null;
}

/**
 * Detect navigation intent (P0-6)
 * Handles patterns like:
 * - "zoom to Lansing"
 * - "fly to MSU"
 * - "center on East Lansing"
 * - "show median age in East Lansing"
 * - "go to the Capitol"
 */
function detectNavigationIntent(lower: string, originalQuery: string): ParsedIntent['navigationParams'] | null {
  // ============================================================================
  // NAVIGATION PATTERNS (zoom, fly, go, center, navigate)
  // ============================================================================
  const navigationPatterns = [
    // "zoom to [location]"
    /(?:zoom|go|navigate|fly|center|focus)(?:\s+(?:to|on|at))?\s+(.+?)(?:\?|$|,|\.|;)/i,
    // "take me to [location]"
    /(?:take me to|bring me to)\s+(.+?)(?:\?|$|,|\.|;)/i,
  ];

  for (const pattern of navigationPatterns) {
    const match = originalQuery.match(pattern);
    if (match) {
      const location = match[1].trim();

      // Filter out common false positives (very short matches or pure articles)
      if (location.length < 2) continue;
      if (/^(the|a|an|some|any|all)$/i.test(location)) continue;

      // Check if this might be a filter request instead (avoid false positives)
      if (lower.includes('filter') || lower.includes('segment') || lower.includes('target')) {
        continue;
      }

      return {
        location: location,
        metric: undefined,
      };
    }
  }

  // ============================================================================
  // "SHOW [metric] IN [location]" PATTERNS
  // ============================================================================
  const showInPattern = /(?:show|display)(?:\s+me)?\s+(.+?)\s+(?:in|at|for|around)\s+(.+?)(?:\?|$|,|\.|;)/i;
  const showInMatch = originalQuery.match(showInPattern);

  if (showInMatch) {
    const metric = showInMatch[1].trim();
    const location = showInMatch[2].trim();

    // Known metrics that indicate navigation + visualization
    const knownMetrics = [
      'median age', 'age', 'income', 'median income',
      'population', 'turnout', 'swing', 'swing potential',
      'partisan lean', 'gotv', 'gotv priority', 'demographics',
      'voter density', 'registered voters'
    ];

    const isMetric = knownMetrics.some(m => metric.toLowerCase().includes(m));

    if (isMetric && location.length > 1) {
      return {
        location: location,
        metric: metric,
      };
    }
  }

  return null;
}
