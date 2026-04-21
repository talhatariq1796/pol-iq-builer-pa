/**
 * Political Analysis Domain Types
 *
 * TypeScript definitions for the Political Landscape Analysis Platform
 * Supporting precinct-level and boundary-based analysis for Pennsylvania.
 */

// ============================================================================
// Core Political Enums
// ============================================================================

export type Party = 'DEM' | 'REP' | 'LIB' | 'GRN' | 'IND' | 'UST' | 'NLP' | 'OTHER';

export type CompetitivenessRating =
  | 'Safe D'
  | 'Likely D'
  | 'Lean D'
  | 'Tossup'
  | 'Lean R'
  | 'Likely R'
  | 'Safe R';

export type VolatilityRating = 'Stable' | 'Moderate' | 'Swing' | 'Highly Volatile';

export type TargetingPriority = 'High' | 'Medium-High' | 'Medium' | 'Low';

export type ElectionType = 'general' | 'primary' | 'special' | 'runoff';

export type OfficeType =
  | 'president'
  | 'governor'
  | 'us_senate'
  | 'us_house'
  | 'state_senate'
  | 'state_house'
  | 'county'
  | 'municipal'
  | 'ballot_measure';

export type GeographyLevel =
  | 'precinct'
  | 'block_group'
  | 'tract'
  | 'county'
  | 'congressional_district'
  | 'state_senate_district'
  | 'state_house_district';

// ============================================================================
// Election Data Types
// ============================================================================

export interface CandidateResult {
  name: string;
  party: Party;
  votes: number;
  percentage: number;
  incumbent?: boolean;
}

export interface RaceResult {
  office: OfficeType;
  district?: string;
  candidates: CandidateResult[];
  totalVotes: number;
  demVotes: number;
  repVotes: number;
  otherVotes: number;
  demPct: number;
  repPct: number;
  margin: number; // DEM - REP (positive = D win)
  winner: CandidateResult;
  winnerParty: Party;
  turnoutPct?: number;
}

export interface ElectionData {
  date: string; // ISO format: YYYY-MM-DD
  type: ElectionType;
  registeredVoters: number;
  ballotsCast: number;
  turnout: number;
  races: Record<OfficeType, RaceResult>;
}

export interface PrecinctElectionHistory {
  precinctId: string;
  precinctName: string;
  elections: Record<string, ElectionData>; // Key: election date
}

// ============================================================================
// Political Scoring Types
// ============================================================================

/**
 * Partisan Lean: -100 (Solid R) to +100 (Solid D)
 * Based on weighted average of DEM-REP margins across elections
 */
export interface PartisanLeanScore {
  value: number; // -100 to +100
  classification: CompetitivenessRating;
  electionsAnalyzed: number;
  confidence: number; // 0-1 based on data availability
}

/**
 * Swing Potential: 0 (Stable) to 100 (Highly Volatile)
 * Based on margin volatility and ticket splitting
 */
export interface SwingPotentialScore {
  value: number; // 0-100
  classification: VolatilityRating;
  components: {
    marginStdDev: number;
    avgElectionSwing: number;
    ticketSplitting: number;
  };
}

/**
 * Turnout Statistics
 */
export interface TurnoutStats {
  averageTurnout: number;
  presidentialAvg: number | null;
  midtermAvg: number | null;
  dropoff: number | null; // Presidential - Midterm
  trend: 'increasing' | 'decreasing' | 'stable';
  electionsAnalyzed: number;
}

/**
 * Combined Political Scores for a Precinct
 */
export interface PrecinctPoliticalScores {
  precinctId: string;
  precinctName: string;
  partisanLean: PartisanLeanScore;
  swingPotential: SwingPotentialScore;
  turnout: TurnoutStats;
  targetingPriority: TargetingPriority;
  lastUpdated: string;
}

// ============================================================================
// Demographic & Behavioral Types (from Business Analyst)
// ============================================================================

/**
 * Political Attitudes from BA (GfK MRI Survey data)
 *
 * NOTE: POLIDELIB, POLIDECON, POLIDEMOD not available in BA.
 * Use Political Outlook spectrum variables instead.
 */
export interface PoliticalAttitudes {
  // Political Outlook Spectrum (available in BA)
  veryLiberal: number; // POLOLKVLIB
  somewhatLiberal: number; // POLOLKSLIB (not POLOLKLEAN)
  middleOfRoad: number; // POLOLKMID - use as proxy for moderates
  somewhatConservative: number; // POLOLKSCON (not POLOLKCONS)
  veryConservative: number; // POLOLKVCON

  // Party Affiliation
  registeredDemocrat: number; // POLAFFDEM
  registeredRepublican: number; // POLAFFREP
  registeredIndependent: number; // POLAFFIND
  registeredOther?: number; // POLAFFOTH - may not be available

  // Likely Voters
  likelyVoters?: number; // POLLKELVOTE - check availability
}

/**
 * Political Engagement Metrics from BA
 *
 * NOTE: CIVICCLUB not available. Use VOLUNWORK, COMMPART as proxies.
 */
export interface PoliticalEngagement {
  politicalPodcastListeners: number; // POLPODCAST
  politicalContributors: number; // POLCONTRIB
  wroteCalledPolitician: number; // POLWROTECALL
  cashGiftsToPolitical: number; // POLCASHGIFT
  followsPoliticiansOnSocial: number; // SMFOLPOL
  followsPoliticalGroups: number; // SMFOLPOLGRP
  votedLastElection?: number; // POLVOTEDLST - check availability
  alwaysVotes?: number; // POLVOTEFRE1 - check availability

  // Civic engagement proxies (use instead of CIVICCLUB)
  volunteerWork?: number; // VOLUNWORK
  communityParticipation?: number; // COMMPART
  charitableDonations?: number; // CHARITYDON
  religiousAttendance?: number; // CHURCHATT
}

/**
 * Psychographic Segments from BA
 *
 * NOTE: TAPPOLBEH and MKTGRP not available.
 * Use LIFEMODECD and URBANCD instead of MKTGRP.
 * Work directly with Tapestry segment codes.
 */
export interface PsychographicProfile {
  // Tapestry Segmentation (67 segments)
  primarySegment: string; // TAPSEGNAM
  primarySegmentCode: string; // TAPSEGCD
  secondarySegment?: string;
  dominantSegmentPct?: number; // TSEGPCT - may need to calculate

  // LifeMode & Urbanization (use instead of MKTGRP)
  lifeModeCode?: string; // LIFEMODECD (14 groups)
  urbanizationCode?: 'U' | 'S' | 'R'; // URBANCD (Urban/Suburban/Rural)

  // Community Engagement
  communityInvolvement?: number;
  religiousAttendance?: number; // CHURCHATT
  unionMembership?: number;
}

/**
 * Media Consumption Profile from BA
 *
 * SIGNIFICANTLY EXPANDED - 5 categories with granular detail.
 * Major opportunity for campaign outreach targeting.
 */
export interface MediaConsumption {
  // TV Consumption (with network and time-slot detail)
  tv: {
    newsFrequency?: number; // Overall TV news watching frequency
    networks?: {
      abc?: number;
      cbs?: number;
      nbc?: number;
      cnn?: number;
      fox?: number;
      msnbc?: number;
    };
    timeSlots?: {
      morning?: number; // Morning news
      evening?: number; // Evening news
      lateNight?: number; // Late night
    };
    localNews?: number;
  };

  // Internet/Digital Consumption
  internet: {
    onlineNews?: number;
    newsWebsites?: number;
    videoStreaming?: number;
    podcastListening?: number;
    politicalPodcasts?: number; // POLPODCAST
  };

  // Print Media
  print: {
    dailyNewspaper?: number;
    sundayNewspaper?: number;
    magazinesByCategory?: Record<string, number>;
    localVsNational?: 'local' | 'national' | 'both';
  };

  // Radio
  radio: {
    newsRadio?: number;
    talkRadio?: number;
    nprPublicRadio?: number;
    formatPreferences?: string[];
  };

  // Social Media (with political engagement)
  socialMedia: {
    facebook?: number;
    twitter?: number; // Twitter/X
    instagram?: number;
    tiktok?: number;
    followsPoliticians?: number; // SMFOLPOL
    followsPoliticalGroups?: number; // SMFOLPOLGRP
    newsViaSocial?: number;
  };
}

/**
 * Media Outreach Recommendation (Model 7 output)
 */
export interface MediaOutreachRecommendation {
  recommendedMix: Array<{
    channel: 'tv' | 'digital' | 'print' | 'radio' | 'social';
    subChannel?: string; // e.g., 'FOX evening', 'Facebook'
    weight: number; // 0-100, budget allocation weight
    rationale: string;
  }>;
  topNetworks: string[];
  bestTimeSlots: string[];
  socialStrategy: string[];
  budgetAllocation: Record<string, number>;
}

/**
 * Demographics Summary
 *
 * Now includes 2025 (current) and 2030 (projected) data for key metrics.
 */
export interface DemographicSummary {
  // Population (current and projected)
  totalPopulation: number; // TOTPOP_CY
  totalPopulationProjected?: number; // TOTPOP_FY (2030)
  votingAgePopulation: number; // VAP_CY (18+)
  votingAgePopulationProjected?: number; // VAP_FY (2030)
  citizenVotingAgePop?: number; // CVAP_CY - PRIMARY for eligible voters
  registeredVoters: number;

  // Age
  medianAge: number; // MEDAGE_CY
  medianAgeProjected?: number; // MEDAGE_FY (2030)

  // Income
  medianHouseholdIncome: number; // MEDHINC
  avgHouseholdIncome?: number; // AVGHINC
  unemploymentRate?: number; // UNEMRT

  // Education
  educationBachelorsPlus: number; // BACHDEG + GRADDEG

  // Housing
  ownerOccupied: number; // OWNER
  renterOccupied: number; // RENTER
  medianHomeValue?: number; // MEDVAL
  medianRent?: number; // MEDRENT

  // Mobility (split by tenure type - ACS 2023)
  recentlyMovedOwners?: number; // MOVEDPCT_OWN
  recentlyMovedRenters?: number; // MOVEDPCT_RENT
  workFromHome?: number; // WRKATHOME (ACS data)

  // Diversity
  diversityIndex?: number; // DIVINDX (0-100 scale)

  // Classification
  urbanRural: 'urban' | 'suburban' | 'rural'; // Based on URBANCD
  populationDensity?: number; // POPDENS_CY
}

// ============================================================================
// Crosswalk & Multi-Resolution Types
// ============================================================================

/**
 * Precinct to Block Group Crosswalk Entry
 * Used for areal interpolation of demographic data
 */
export interface CrosswalkEntry {
  precinctId: string;
  precinctName: string;
  blockGroupGeoid: string; // 12-digit Census GEOID
  overlapRatio: number; // 0-1, proportion of BG area in precinct
  precinctArea?: number; // Square meters
  overlapArea?: number; // Square meters
}

/**
 * Multi-Resolution Analysis Unit
 * Combines precinct election data with interpolated block group demographics
 */
export interface AnalysisUnit {
  // Geography
  precinctId: string;
  precinctName: string;
  centroid: [number, number]; // [lng, lat]
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon;

  // Election-Based Scores
  politicalScores: PrecinctPoliticalScores;

  // Interpolated Demographics (from block groups via crosswalk)
  demographics: DemographicSummary;
  politicalAttitudes: PoliticalAttitudes;
  engagement: PoliticalEngagement;
  psychographics: PsychographicProfile;
  mediaConsumption?: MediaConsumption; // NEW: Expanded media data

  // Derived Scores (ML model outputs)
  derivedScores: {
    turnoutPropensity: number; // 0-100
    gotvPriority: number; // 0-100
    persuadability: number; // 0-100
    outcomeConfidence: number; // 0-1
  };

  // NEW: Media Outreach Recommendation (Model 7)
  mediaOutreach?: MediaOutreachRecommendation;
}

// ============================================================================
// Report & Visualization Types
// ============================================================================

/**
 * Political Analysis Area Selection
 * Matches CMA AreaSelection pattern with political-specific metadata
 */
export interface PoliticalAreaSelection {
  geometry: GeoJSON.Geometry;
  method: 'click-buffer' | 'draw' | 'search' | 'boundary-select' | 'click-select';
  displayName: string;
  metadata: {
    area?: number; // Square meters
    centroid?: [number, number]; // [lng, lat]
    source: string;
    // Buffer-specific
    bufferType?: 'radius' | 'drivetime' | 'walktime';
    bufferValue?: number;
    bufferUnit?: string;
    // Boundary-specific
    boundaryType?: BoundaryLayerType;
    boundaryIds?: string[]; // For multi-select
    boundaryNames?: string[];
    /** Census INTPTLON/INTPTLAT per selected feature when polygon coords are unusable (e.g. PA block groups). */
    boundaryCentroids?: [number, number][];
  };
}

export type BoundaryLayerType =
  | 'precinct'
  | 'h3'
  | 'zip-code'
  | 'block-group'
  | 'census-tract'
  | 'state-house'
  | 'state-senate'
  | 'congressional'
  | 'municipality'
  | 'township'
  | 'school-district';

// Note: 'county-commission' is not in BoundaryLayerType; add when PA county commission GeoJSON exists.

/**
 * Reference layers that provide context but are not used in analysis
 */
export type ReferencLayerType =
  | 'university-campus'  // Reference campus boundary for student-population context
  | 'military-base'      // Future: transient population considerations
  | 'major-employer';    // Future: large employers / commute patterns

export interface BoundaryLayerConfig {
  type: BoundaryLayerType;
  displayName: string;
  pluralName: string;
  source: string;
  idField: string;
  nameField: string;
  /** Primary URL: single GeoJSON FeatureCollection, or a merge manifest (see geojsonMergeLoader). */
  dataPath: string;
  /**
   * When set, each URL is fetched (supports manifests) and features are concatenated in order.
   * Use for explicit multi-part layers; otherwise use dataPath only.
   */
  dataPaths?: string[];
  color: string;
  hasData?: boolean;
}

export interface ReferenceLayerConfig {
  type: ReferencLayerType;
  displayName: string;
  source: string;
  dataPath: string;
  color: string;
  fillOpacity: number;
  description: string;  // Tooltip/legend text explaining what this layer shows
}

/**
 * Political Profile Report Data
 * 8-page PDF report for ANY selected area (not just precincts)
 */
export interface PoliticalProfileReport {
  // Page 1: Cover
  cover: {
    areaName: string; // Can be precinct name, custom area, or search result
    areaDescription?: string; // e.g., "1 km radius around 123 Main St"
    county: string;
    state: string;
    reportDate: string;
    mapThumbnail?: string;
    selectionMethod: PoliticalAreaSelection['method'];
  };

  // Page 2: Political Overview
  politicalOverview: {
    partisanLean: PartisanLeanScore;
    swingPotential: SwingPotentialScore;
    turnout: TurnoutStats;
    targetingPriority: TargetingPriority;
    keyTakeaways: string[];
  };

  // Page 3: Election History
  electionHistory: {
    elections: Array<{
      date: string;
      type: ElectionType;
      keyRaces: RaceResult[];
      turnout: number;
    }>;
    trendChart: ChartData;
  };

  // Page 4: Demographics
  demographics: {
    summary: DemographicSummary;
    ageDistribution: ChartData;
    incomeDistribution: ChartData;
    educationBreakdown: ChartData;
  };

  // Page 5: Political Attitudes
  politicalAttitudes: {
    attitudes: PoliticalAttitudes;
    ideologySpectrum: ChartData;
    partyRegistration: ChartData;
  };

  // Page 6: Engagement & Psychographics
  engagementProfile: {
    engagement: PoliticalEngagement;
    psychographics: PsychographicProfile;
    engagementChart: ChartData;
  };

  // Page 7: Media Consumption & Outreach (NEW - leverages expanded BA data)
  mediaProfile: {
    consumption: MediaConsumption;
    topChannels: Array<{ channel: string; index: number }>;
    tvNetworkBreakdown: ChartData;
    socialMediaUsage: ChartData;
    outreachRecommendation?: MediaOutreachRecommendation;
  };

  // Page 8: AI Analysis & Recommendations
  aiAnalysis: {
    summary: string;
    keyInsights: string[];
    recommendations: string[];
    comparablePrecinctsChart: ChartData;
  };
}

/**
 * Chart Data for Visualizations
 */
export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'donut' | 'scatter' | 'area';
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
    backgroundColor?: string;
  }>;
  options?: {
    showLegend?: boolean;
    showLabels?: boolean;
    stacked?: boolean;
  };
}

// ============================================================================
// Map Layer Types
// ============================================================================

/**
 * Political Map Layer Configuration
 */
export interface PoliticalLayerConfig {
  id: string;
  name: string;
  type: 'precinct' | 'district' | 'demographic';
  source: 'geojson' | 'feature-service' | 'tile';
  url: string;
  visible: boolean;
  opacity: number;
  renderer: PoliticalRenderer;
  popupTemplate: PoliticalPopupTemplate;
  labelConfig?: LabelConfig;
}

/**
 * Political-specific Renderer
 */
export interface PoliticalRenderer {
  type: 'partisan-lean' | 'swing-potential' | 'turnout' | 'custom';
  field: string;
  colorRamp?: {
    type: 'diverging' | 'sequential';
    colors: string[];
    breakpoints?: number[];
  };
  classBreaks?: Array<{
    minValue: number;
    maxValue: number;
    color: string;
    label: string;
  }>;
}

/**
 * Political Popup Template
 */
export interface PoliticalPopupTemplate {
  title: string;
  fields: Array<{
    field: string;
    label: string;
    format?: 'number' | 'percent' | 'currency' | 'text';
    decimals?: number;
  }>;
  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
  }>;
}

export interface LabelConfig {
  field: string;
  fontSize: number;
  color: string;
  haloColor: string;
  haloSize: number;
  minScale?: number;
  maxScale?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PoliticalDataResponse {
  success: boolean;
  data: {
    precincts: Record<string, AnalysisUnit>;
    summary: {
      totalPrecincts: number;
      avgPartisanLean: number;
      avgSwingPotential: number;
      avgTurnout: number;
      distribution: {
        lean: Record<CompetitivenessRating, number>;
        swing: Record<VolatilityRating, number>;
        priority: Record<TargetingPriority, number>;
      };
    };
    metadata: {
      lastUpdated: string;
      dataVersion: string;
      county: string;
      state: string;
    };
  };
  error?: string;
}

export interface PrecinctSearchResult {
  precinctId: string;
  precinctName: string;
  partisanLean: number;
  swingPotential: number;
  targetingPriority: TargetingPriority;
  centroid: [number, number];
}

// ============================================================================
// Filter & Query Types
// ============================================================================

export interface PoliticalFilters {
  // Partisan Lean Range
  partisanLeanMin?: number;
  partisanLeanMax?: number;

  // Swing Potential Range
  swingPotentialMin?: number;
  swingPotentialMax?: number;

  // Turnout Range
  turnoutMin?: number;
  turnoutMax?: number;

  // Categorical Filters
  competitiveness?: CompetitivenessRating[];
  volatility?: VolatilityRating[];
  targetingPriority?: TargetingPriority[];

  // Geographic Filters
  municipalities?: string[];
  districts?: {
    congressional?: string[];
    stateSenate?: string[];
    stateHouse?: string[];
  };

  // Demographic Filters
  urbanRural?: ('urban' | 'suburban' | 'rural')[];
  medianIncomeMin?: number;
  medianIncomeMax?: number;
}

export interface PoliticalQueryParams {
  filters: PoliticalFilters;
  sortBy?: keyof PrecinctPoliticalScores | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeGeometry?: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export type PrecinctScoreField =
  | 'partisan_lean'
  | 'swing_potential'
  | 'turnout_avg'
  | 'gotv_priority'
  | 'persuadability';

export interface ScoreRange {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
}

export interface CountySummary {
  name: string;
  state: string;
  fips: string;
  totalPrecincts: number;
  totalRegisteredVoters: number;
  overallLean: number;
  overallTurnout: number;
  scoreRanges: Record<PrecinctScoreField, ScoreRange>;
}

/** Population-weighted partisan lean by modeled median household income band (precinct-level). */
export interface IncomeBucketsPartisanLean {
  areaLabel: string;
  totalPrecinctsInSample: number;
  buckets: Array<{
    incomeBand: string;
    precinctCount: number;
    populationWeight: number;
    avgPartisanLean: number;
    leanDisplay: string;
  }>;
}

/** Presidential (or top-ticket) margin movement across 2020 / 2022 / 2024 where available. */
export interface PrecinctElectionShiftRank {
  precinctName: string;
  margin2020: number;
  margin2022: number;
  margin2024: number;
  /** Sum of absolute year-over-year margin changes (percentage points). */
  cumulativeAbsMarginSwing: number;
  /** Net Dem−Rep margin change from 2020 to 2024 (positive = toward Dem). */
  netMarginChange2020to2024: number;
}

export interface PrecinctTurnoutTrendRank {
  precinctName: string;
  turnout2020: number;
  turnout2022: number;
  turnout2024: number;
  /** Net change in turnout (percentage points), 2024 vs 2020 — positive = higher participation in 2024. */
  netChange2020to2024: number;
  cumulativeAbsTurnoutSwing: number;
}

export interface TurnoutTrendExtremesResult {
  largestIncreases: PrecinctTurnoutTrendRank[];
  largestDecreases: PrecinctTurnoutTrendRank[];
  /** Mean turnout % by election year (precincts with all three years). */
  statewideMeanTurnout: { y2020: number; y2022: number; y2024: number };
}

/**
 * Modeled canvassing yield: doors estimated from registered voters (≈1.5 voters/door),
 * persuadable pool from persuasion_opportunity × registered voters.
 */
export interface PrecinctCanvassingEfficiencyRank {
  precinctName: string;
  registeredVoters: number;
  estimatedDoors: number;
  persuasionOpportunity: number;
  estimatedPersuadableVoters: number;
  /** Lower = fewer estimated doors per modeled persuadable (better yield under linear assumptions). */
  doorsPerPersuadableVoter: number;
}

// ============================================================================
// Unified Precinct Data Types (Data Consolidation)
// ============================================================================

/**
 * UnifiedPrecinct: Single source of truth for precinct data
 *
 * Merges data from:
 * - targeting_scores (103 precincts): GOTV, persuasion, demographics
 * - political_scores (120 precincts): partisan lean, swing potential
 * - precinct_boundaries (GeoJSON): geometry data
 *
 * This type replaces the inconsistent sample data that was causing
 * partisan lean to show different values (R+22.94 vs R+16 vs D+34.3).
 */
export interface UnifiedPrecinct {
  // Core identifiers
  id: string;
  name: string;
  jurisdiction: string;

  // Demographics (from targeting scores / BA data)
  demographics: {
    totalPopulation: number;
    population18up: number;
    registeredVoters?: number;  // From election data
    medianAge?: number;         // Median age (from targeting/BA data)
    medianHHI: number;
    collegePct: number;
    homeownerPct?: number;      // Owner-occupied % (from targeting/BA data)
    diversityIndex: number;
    populationDensity?: number; // Per sq mi or sq km (for urban/suburban/rural)
  };

  // Political affiliation (from targeting scores / BA data)
  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
    liberalPct: number;
    moderatePct: number;
    conservativePct: number;
  };

  // Electoral scores (from political scores)
  electoral: {
    partisanLean: number;         // -100 (R) to +100 (D)
    swingPotential: number;       // 0-100
    avgTurnout: number;           // 0-100
    competitiveness: string;      // 'Safe D', 'Lean R', 'Tossup', etc.
    volatility: string;           // 'Stable', 'Moderate', 'Swing', 'Highly Volatile'
  };

  // Targeting scores (from targeting scores)
  targeting: {
    gotvPriority: number;         // 0-100
    persuasionOpportunity: number; // 0-100
    combinedScore: number;        // 0-100
    strategy: string;             // 'Base Mobilization', 'Persuasion', etc.
    priority: number;             // 1-10
    recommendation: string;       // Full text recommendation
    /** PA targeting export: e.g. "Low Priority" / "Medium" — used for campaign strategy filter */
    gotvClassification?: string;
  };

  // Components (for detailed analysis)
  gotvComponents?: {
    supportStrength: number;
    turnoutOpportunity: number;
    voterPoolWeight: number;
  };

  persuasionComponents?: {
    marginCloseness: number;
    swingFactor: number;
    moderateFactor: number;
    independentFactor: number;
    lowEngagement: number;
  };

  // Engagement / media (from targeting scores / BA data, for segment filters)
  engagement?: {
    politicalDonorPct: number;
    activistPct: number;
    cnnMsnbcPct: number;
    foxNewsmaxPct: number;
    nprPct: number;
    socialMediaPct: number;
    facebookPct: number;
    youtubePct: number;
  };

  // Tapestry segment (when available from data source; used for segment filters)
  tapestryCode?: string;
  tapestrySegment?: string;
}
