/**
 * Type definitions for the Segmentation Tool
 *
 * Enables political operatives to filter and segment precincts
 * based on demographic, political, targeting, and engagement criteria.
 *
 * NOTE: This type system supports BOTH camelCase (used by components)
 * and snake_case (used by presets and engine matching). This dual support
 * enables seamless interop between UI components and data layer.
 */

// ============================================================================
// Utility Types
// ============================================================================

export type DensityType = 'urban' | 'suburban' | 'rural';

export type HousingType = 'owners' | 'renters';

export type TargetingStrategyType =
  | 'base_mobilization'
  | 'persuasion_target'
  | 'battleground'
  | 'low_priority';

export type PartyLeanType =
  | 'strong_dem'
  | 'lean_dem'
  | 'independent'
  | 'lean_rep'
  | 'strong_rep';

export type CompetitivenessType =
  | 'safe_d'
  | 'likely_d'
  | 'lean_d'
  | 'toss_up'
  | 'lean_r'
  | 'likely_r'
  | 'safe_r';

export type PoliticalOutlookType = 'liberal' | 'moderate' | 'conservative';

export type NewsPreferenceType =
  | 'cnn_msnbc'
  | 'fox_newsmax'
  | 'mixed'
  | 'social_first'
  | 'npr';

export type SocialMediaPlatformType = 'facebook' | 'youtube' | 'twitter' | 'instagram';

// ============================================================================
// Filter Types (Support both camelCase and snake_case)
// ============================================================================

/**
 * Demographic filters
 * - Components use: ageRange, incomeRange, educationLevel, density, housing, diversityRange
 * - Presets use: age_range, income_range, education_level, density_type, housing_type, min_diversity_index, max_diversity_index
 * - Engine uses: age_range.min_median_age, income_range.min_median_hhi, etc.
 */
export interface DemographicFilters {
  // Age - component style (camelCase)
  ageRange?: [number, number]; // [min, max] median age
  ageCohort?: 'young' | 'middle' | 'senior';

  // Age - preset/engine style (snake_case with nested objects)
  age_range?: {
    min_median_age?: number;
    max_median_age?: number;
  };
  age_cohort_emphasis?: 'young' | 'middle' | 'senior';

  // Income - component style (camelCase)
  incomeRange?: [number, number]; // [min, max] median HHI
  incomeLevel?: 'low' | 'middle' | 'upper_middle' | 'high';

  // Income - preset/engine style (snake_case)
  income_range?: {
    min_median_hhi?: number;
    max_median_hhi?: number;
  };
  income_level?: 'low' | 'middle' | 'upper_middle' | 'high';

  // Education - component style (camelCase)
  educationLevel?: 'high_school' | 'some_college' | 'bachelors' | 'graduate';
  minCollegePct?: number;

  // Education - preset/engine style (snake_case)
  education_level?: 'high_school' | 'some_college' | 'bachelors' | 'graduate';
  min_college_pct?: number;

  // Housing - component style (camelCase array)
  housing?: HousingType[]; // ['owners', 'renters']

  // Housing - preset/engine style (snake_case single value)
  housing_type?: 'owner' | 'renter' | 'mixed';
  housingType?: 'owner' | 'renter' | 'mixed'; // Alias
  min_homeowner_pct?: number;
  minHomeownerPct?: number; // Alias

  // Density - component style (camelCase array)
  density?: DensityType[]; // ['urban', 'suburban', 'rural']

  // Density - preset/engine style (snake_case single value)
  density_type?: DensityType;

  // Diversity - component style (camelCase range)
  diversityRange?: [number, number]; // [min, max] diversity index

  // Diversity - preset/engine style (snake_case separate min/max)
  min_diversity_index?: number;
  max_diversity_index?: number;
}

/**
 * Political filters
 * - Components use: partyLean, partisanLeanRange, competitiveness, politicalOutlook
 * - Presets use: party_lean, partisan_lean_range, competitiveness, outlook
 */
export interface PoliticalFilters {
  // Party Affiliation - component style (camelCase array)
  partyLean?: PartyLeanType[];

  // Party Affiliation - preset/engine style (snake_case single value)
  party_lean?: PartyLeanType;

  // Party affiliation percentages (snake_case only)
  min_dem_affiliation_pct?: number;
  min_rep_affiliation_pct?: number;
  min_independent_pct?: number;

  // Political Outlook - component style (camelCase)
  politicalOutlook?: PoliticalOutlookType;

  // Political Outlook - preset/engine style (snake_case)
  outlook?: PoliticalOutlookType;
  min_moderate_pct?: number;

  // Electoral Performance - component style (camelCase range)
  partisanLeanRange?: [number, number]; // [-100, +100]
  competitiveness?: CompetitivenessType[]; // array

  // Electoral Performance - preset/engine style (snake_case)
  partisan_lean_range?: {
    min?: number;
    max?: number;
  };
  // competitiveness is shared (works with both array and single value via array check)
}

/**
 * Targeting filters
 * - Components use: gotvPriorityRange, persuasionRange, swingPotentialRange, turnoutRange, strategy (array)
 * - Presets use: min_gotv_priority, max_gotv_priority, targeting_strategy (array)
 */
export interface TargetingFilters {
  // Scores - component style (camelCase ranges)
  gotvPriorityRange?: [number, number]; // 0-100
  persuasionRange?: [number, number]; // 0-100
  swingPotentialRange?: [number, number]; // 0-100
  turnoutRange?: [number, number]; // % turnout

  // Scores - preset/engine style (snake_case separate min/max)
  min_gotv_priority?: number;
  max_gotv_priority?: number;
  min_persuasion?: number;
  max_persuasion?: number;
  min_swing_potential?: number;
  max_swing_potential?: number;
  min_turnout?: number;
  max_turnout?: number;
  min_dropoff?: number; // Presidential-to-midterm drop

  // Strategy - component style (camelCase array with snake_case values)
  strategy?: TargetingStrategyType[]; // ['base_mobilization', 'persuasion_target', etc.]

  // Strategy - preset/engine style (snake_case array)
  targeting_strategy?: string[]; // Compatible with 'Base Mobilization' or 'base_mobilization'
}

/**
 * Engagement filters
 * - Components use: newsPreference, highDonorConcentration, highActivistConcentration, socialMedia, highSocialMedia
 * - Presets use: high_donor_concentration, news_preference, high_social_media
 */
export interface EngagementFilters {
  // Political engagement - component style (camelCase)
  highDonorConcentration?: boolean;
  highActivistConcentration?: boolean;

  // Political engagement - preset/engine style (snake_case)
  high_donor_concentration?: boolean;
  high_activist_concentration?: boolean;

  // Media consumption - component style (camelCase)
  newsPreference?: NewsPreferenceType;
  highSocialMedia?: boolean;
  socialMedia?: SocialMediaPlatformType[]; // ['facebook', 'youtube', etc.]

  // Media consumption - preset/engine style (snake_case)
  news_preference?: NewsPreferenceType;
  high_social_media?: boolean;

  // Platform-specific (both styles use same names)
  highFacebook?: boolean;
  highYouTube?: boolean;
  high_facebook?: boolean;
  high_youtube?: boolean;
}

/**
 * Combined segment filters
 * - Presets use: 'demographic', 'political', 'targeting', 'engagement'
 * - Components use: 'demographics', 'political', 'targeting', 'engagement'
 */
export interface SegmentFilters {
  // Component style (plural)
  demographics?: DemographicFilters;

  // Preset style (singular)
  demographic?: DemographicFilters;

  // Shared keys
  political?: PoliticalFilters;
  targeting?: TargetingFilters;
  engagement?: EngagementFilters;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Individual precinct match result
 */
export interface PrecinctMatch {
  precinctId: string;
  precinctName: string;
  jurisdiction: string; // Now a string (e.g., "Lansing City")
  registeredVoters: number;
  gotvPriority: number;
  persuasionOpportunity: number;
  swingPotential: number;
  targetingStrategy: string;
  partisanLean: number;
  matchScore: number; // How well it matches filters (0-100)
}

/**
 * Aggregate segment results
 */
export interface SegmentResults {
  matchingPrecincts: PrecinctMatch[];

  // Summary counts
  totalPrecincts?: number; // Alias for precinctCount
  precinctCount: number;
  percentageOfTotal?: number; // % of all precincts

  // Voter estimates
  estimatedVoters: number;
  vap?: number; // Alias for estimatedVAP
  estimatedVAP: number;

  // Aggregate stats - component style (camelCase with 'average' prefix)
  averageGOTV?: number;
  averagePersuasion?: number;
  averageTurnout?: number;
  averagePartisanLean?: number;
  avgSwingPotential?: number;

  // Aggregate stats - engine style (snake_case with 'avg' prefix)
  avgGOTV: number;
  avgPersuasion: number;
  avgPartisanLean: number;
  avgTurnout: number;

  // Strategy breakdown
  strategyBreakdown: Record<string, number>;

  calculatedAt: string;
}

/**
 * Saved segment definition
 */
export interface SegmentDefinition {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;

  filters: SegmentFilters;

  // Cached results (recalculated on load)
  cachedResults?: SegmentResults;
}

/**
 * CSV export row format
 */
export interface SegmentExportRow {
  precinct_id: string;
  precinct_name: string;
  jurisdiction: string;
  registered_voters: number;
  gotv_priority: number;
  persuasion_opportunity: number;
  swing_potential: number;
  targeting_strategy: string;
  partisan_lean: number;
  match_score: number;
}

// ============================================================================
// Precinct data types (unified precinct / PoliticalDataService)
// ============================================================================

/**
 * Full precinct data structure
 */
export interface PrecinctData {
  id: string;
  name: string;
  jurisdiction: {
    id: string;
    name: string;
    type: 'city' | 'township';
  };

  // Demographics
  demographics: {
    total_population: number;
    population_age_18up: number;
    population18up: number; // Alias
    median_age: number;
    medianAge: number; // Alias
    median_household_income: number;
    medianHHI: number; // Alias
    diversity_index: number;
    diversityIndex: number; // Alias
    population_density: number;
    populationDensity: number; // Alias
    collegePct: number; // % with college degree
    homeownerPct: number; // % homeowners
  };

  // Housing
  housing: {
    owner_occupied: number;
    renter_occupied: number;
    total_units: number;
  };

  // Education (age 25+)
  education: {
    base_population: number;
    high_school_or_less: number;
    some_college: number;
    bachelors_degree: number;
    graduate_degree: number;
  };

  // Political data
  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
    liberalPct: number;
    moderatePct: number;
    conservativePct: number;
  };

  // Electoral data
  electoral: {
    partisan_lean: number; // -100 to +100
    partisanLean: number; // Alias
    swing_potential: number; // 0-100
    swingPotential: number; // Alias
    competitiveness: CompetitivenessType;
    avgTurnout: number; // average turnout %
    turnoutDropoff: number; // pres-to-midterm drop
  };

  // Targeting scores
  targeting: {
    gotv_priority: number;
    gotvPriority: number; // Alias
    persuasion_opportunity: number;
    persuasionOpportunity: number; // Alias
    combined_score: number;
    targeting_strategy: string;
    strategy: string; // Alias
  };

  // Turnout
  turnout: {
    average: number;
    presidential: number;
    midterm: number;
    dropoff: number;
  };

  // Engagement (optional)
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

  // Voters
  registered_voters: number;

  // Election history (from precinct data)
  elections?: Record<string, PrecinctElectionResult>;

  // Electoral district assignments (for Phase 1)
  districts?: PrecinctDistrictAssignments;
}

/**
 * Precinct-level election result for a single year
 */
export interface PrecinctElectionResult {
  demPct: number;
  repPct: number;
  margin: number;
  turnout: number;
  ballotsCast: number;
}

/**
 * Precinct's assignment to electoral districts (for Phase 1)
 */
export interface PrecinctDistrictAssignments {
  stateHouse?: string;        // e.g., "mi-house-71"
  stateSenate?: string;       // e.g., "mi-senate-23"
  congressional?: string;     // e.g., "mi-07"
  countyCommissioner?: string; // e.g., "cc-1"
  municipality?: string;      // e.g., "east-lansing"
  isSplit?: boolean;          // True if precinct spans multiple districts
  splitDetails?: {
    districtType: string;
    districts: string[];
    proportions: number[];    // Area-weighted proportions
  }[];
}

// ============================================================================
// Phase 1: Electoral Filtering Types
// ============================================================================

/**
 * Electoral district filtering options
 */
export interface ElectoralFilters {
  // District filtering
  congressionalDistricts?: string[];      // ['MI-07']
  stateSenateDistricts?: string[];        // ['MI-23', 'MI-24']
  stateHouseDistricts?: string[];         // ['MI-71', 'MI-72', 'MI-73']
  countyDistricts?: string[];             // ['CC-1', 'CC-2']

  // Municipal filtering
  municipalities?: string[];              // ['Lansing City', 'East Lansing City']
  municipalityTypes?: ('city' | 'township')[];

  // Split precinct handling
  includeSplitPrecincts?: boolean;        // Include precincts that span districts
  splitPrecinctWeight?: 'full' | 'proportional'; // How to count split precincts
}

/**
 * Electoral district data structure
 */
export interface ElectoralDistrict {
  id: string;
  name: string;
  level: 'federal' | 'state_senate' | 'state_house' | 'county' | 'local';
  representative?: string;
  party?: 'D' | 'R' | 'I';
  population?: number;
  precinctCount?: number;
  partisanLean?: number;
  competitiveness?: CompetitivenessType;
  precinctIds?: string[];               // Precincts in this district
}

/**
 * Precinct-to-district crosswalk entry
 */
export interface DistrictCrosswalk {
  precinctId: string;
  stateHouse?: string;
  stateSenate?: string;
  congressional?: string;
  countyCommissioner?: string;
  municipality?: string;
  municipalityType?: 'city' | 'township';
  isSplit?: boolean;
  splitWeights?: Record<string, number>; // district_id -> weight (0-1)
}

// ============================================================================
// Phase 2: Election History Types
// ============================================================================

/**
 * Election history filtering options
 */
export interface ElectionHistoryFilters {
  // Race selection
  races?: {
    year: 2020 | 2022 | 2024;
    office: 'president' | 'us_senate' | 'governor' | 'state_house' | 'state_senate' | 'county';
    level?: 'federal' | 'state' | 'county' | 'local';
  }[];

  // Vote share filtering
  minDemVoteShare?: number;              // % (e.g., 55)
  maxDemVoteShare?: number;              // % (e.g., 65)
  minRepVoteShare?: number;
  maxRepVoteShare?: number;

  // Margin filtering
  marginRange?: [number, number];        // Point spread: [-10, +10] for competitive

  // Turnout filtering
  minTurnout?: number;                   // % turnout in specific race
  maxTurnout?: number;
  turnoutDropoff?: {                     // Presidential to midterm drop
    min?: number;
    max?: number;
  };

  // Ticket-splitting detection
  splitTicket?: {
    topRace: { year: number; office: string };
    bottomRace: { year: number; office: string };
    maxCorrelation?: number;             // < 0.9 indicates splitting
  };

  // Trend analysis
  trend?: {
    startYear: 2020 | 2022;
    endYear: 2022 | 2024;
    minMarginShift?: number;             // Shifted toward Dems by X points
    maxMarginShift?: number;
  };
}

/**
 * Full election result record for a precinct
 */
export interface ElectionResultRecord {
  precinctId: string;
  year: number;
  office: string;
  totalVotes: number;
  turnoutRate: number;

  results: Array<{
    party: 'D' | 'R' | 'I' | 'L' | 'G' | 'other';
    candidate: string;
    votes: number;
    voteSharePct: number;
    rank: number;
  }>;

  margin: number;                        // Winner margin in points
  winner: string;
}

/**
 * Election data file structure
 */
export interface ElectionDataFile {
  year: number;
  county: string;
  races: Array<{
    office: string;
    level: 'federal' | 'state' | 'county' | 'local';
    candidates: Array<{
      name: string;
      party: 'D' | 'R' | 'I' | 'L' | 'G' | 'other';
    }>;
    precinctResults: ElectionResultRecord[];
  }>;
  metadata: {
    source: string;
    lastUpdated: string;
  };
}

// ============================================================================
// Phase 3: Export Types
// ============================================================================

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'pdf' | 'van' | 'mail_merge' | 'phone_list' | 'digital_ads' | 'json';

/**
 * Export options configuration
 */
export interface ExportOptions {
  format: ExportFormat;

  // PDF options
  includeMap?: boolean;
  includeDemographics?: boolean;
  includeRecommendations?: boolean;
  includeElectoralBreakdown?: boolean;
  includeTapestryAnalysis?: boolean;

  // Phone list options
  phoneType?: 'best' | 'cell' | 'all';
  priorityOrder?: 'gotv' | 'persuasion' | 'combined';

  // Digital ads options
  aggregationLevel?: 'zip' | 'zip4' | 'municipality';

  // General options
  filename?: string;
  includeMetadata?: boolean;
}

/**
 * VAN export row format
 */
export interface VANExportRow {
  VoterVANID?: string;
  FirstName?: string;
  LastName?: string;
  Address?: string;
  City: string;
  State: string;
  Zip: string;
  Phone?: string;
  Email?: string;
  Precinct: string;
  PrecinctName: string;
  Score_GOTV: number;
  Score_Persuasion: number;
  Score_Swing: number;
  TargetingStrategy: string;
}

/**
 * Mail merge export row format
 */
export interface MailMergeExportRow {
  PrecinctId: string;
  PrecinctName: string;
  Jurisdiction: string;
  City: string;
  State: string;
  ZipCode: string;
  RegisteredVoters: number;
  TargetingStrategy: string;
  Segment: string;
}

/**
 * Phone list export row format
 */
export interface PhoneListExportRow {
  PrecinctId: string;
  PrecinctName: string;
  Jurisdiction: string;
  RegisteredVoters: number;
  Priority: number;
  Script: string;
  Strategy: string;
  Notes: string;
}

/**
 * Digital ads export row format (ZIP-level aggregation)
 */
export interface DigitalAdsExportRow {
  ZipCode: string;
  TargetVoters: number;
  AvgAge: number;
  MedianIncome: number;
  TapestrySegments: string;
  TargetingStrategy: string;
  PrecinctCount: number;
}

// ============================================================================
// Phase 4: Tapestry Segmentation Types
// ============================================================================

/**
 * Tapestry filtering options
 */
export interface TapestryFilters {
  // Segment-level filtering
  tapestrySegments?: string[];           // ['14B', '3A', '5D'] - segment codes

  // LifeMode group filtering
  lifeModeGroups?: number[];             // [1, 2, 3] - Affluent Estates, Upscale Avenues, etc.

  // Characteristic filtering
  urbanization?: ('urban' | 'suburban' | 'exurban' | 'rural')[];
  lifestage?: ('young_singles' | 'young_families' | 'middle_age' | 'empty_nesters' | 'seniors')[];
  affluence?: ('high' | 'upper_middle' | 'middle' | 'modest' | 'low')[];

  // Political correlation
  expectedPartisanLean?: 'strong_dem' | 'lean_dem' | 'toss_up' | 'lean_rep' | 'strong_rep';

  // Diversity
  minTapestryDiversity?: number;         // 1.0 = single segment, higher = more mix
}

/**
 * Tapestry segment definition (from ESRI)
 */
export interface TapestrySegment {
  code: string;                          // '14B'
  name: string;                          // 'College Towns'
  lifeModeGroup: number;                 // 14 (Scholars and Patriots)
  lifeModeGroupName: string;             // 'Scholars and Patriots'

  // Characteristics
  urbanization: 'urban' | 'suburban' | 'exurban' | 'rural';
  lifestage: string;
  affluence: 'high' | 'upper_middle' | 'middle' | 'modest' | 'low';

  // Demographics
  medianAge: number;
  medianIncome: number;
  collegePct: number;

  // Political profile (estimated)
  expectedPartisanLean: number;          // -100 to +100
  expectedTurnout: number;               // % in presidential

  // Engagement
  donorPropensity: 'high' | 'medium' | 'low';
  mediaPreference: string[];             // ['digital', 'npr', 'streaming']

  // Issue priorities (top 3)
  topIssues: string[];

  // Description for UI
  description?: string;
}

/**
 * Precinct's Tapestry assignment
 */
export interface PrecinctTapestry {
  precinctId: string;
  dominantSegment: string;               // '14B'
  dominantPct: number;                   // 65% of precinct
  secondarySegment?: string;             // '3A'
  secondaryPct?: number;                 // 20% of precinct
  diversityScore: number;                // 1.0 = homogeneous, higher = mixed
  allSegments?: Array<{
    code: string;
    pct: number;
  }>;
}

// ============================================================================
// Phase 5: Lookalike Modeling Types
// ============================================================================

/**
 * Lookalike profile source definition
 */
export interface LookalikeProfile {
  // Source definition
  sourcePrecinct?: string;               // Single precinct as reference
  sourcePrecincts?: string[];            // Multiple precincts (average profile)
  sourceSegment?: SegmentResults;        // From saved segment

  // Manual profile (alternative to source)
  manualProfile?: {
    demographics?: {
      medianAge?: number;
      medianIncome?: number;
      collegePct?: number;
      homeownerPct?: number;
      density?: DensityType;
    };
    political?: {
      partisanLean?: number;
      demAffiliationPct?: number;
      competitiveness?: CompetitivenessType;
    };
    tapestry?: string;
  };

  // Similarity settings
  algorithm: 'euclidean' | 'cosine' | 'mahalanobis';
  featureWeights?: {
    demographics?: number;               // Default 30%
    political?: number;                  // Default 25%
    electoral?: number;                  // Default 20%
    tapestry?: number;                   // Default 15%
    engagement?: number;                 // Default 10%
  };

  // Filtering
  minSimilarityScore?: number;           // 0-100 (e.g., 75+)
  maxResults?: number;                   // Top N matches
  excludeSources?: boolean;              // Exclude reference precincts

  // Geographic constraints
  withinMunicipality?: string;
  withinDistrict?: string;
  maxDistance?: number;                  // Miles from reference
}

/**
 * Lookalike match result
 */
export interface LookalikeMatch {
  precinctId: string;
  precinctName: string;
  jurisdiction: string;
  similarityScore: number;               // 0-100

  // Feature-level similarity
  demographicSimilarity: number;
  politicalSimilarity: number;
  electoralSimilarity: number;
  tapestrySimilarity: number;
  engagementSimilarity: number;

  // Key differences (for explainability)
  topDifferences: Array<{
    feature: string;
    referenceValue: number;
    matchValue: number;
    difference: number;
    direction: 'higher' | 'lower';
  }>;
}

/**
 * Lookalike results summary
 */
export interface LookalikeResults {
  matches: LookalikeMatch[];
  referenceProfile: {
    name: string;
    precinctCount: number;
    avgAge: number;
    avgIncome: number;
    avgPartisanLean: number;
  };
  avgSimilarityScore: number;
  algorithm: string;
  featureWeights: Record<string, number>;
  computedAt: string;
}

// ============================================================================
// Phase 6: Segment Comparison Types
// ============================================================================

/**
 * Segment comparison configuration
 */
export interface SegmentComparisonConfig {
  segments: string[];                    // IDs of 2-4 saved segments to compare

  // Analysis options
  showOverlap?: boolean;                 // Show Venn diagram
  showDifferences?: boolean;             // Highlight key differences
  statisticalTest?: boolean;             // Run t-tests for significance

  // Display options
  sortBy?: 'voters' | 'gotv' | 'persuasion' | 'overlap';
}

/**
 * Segment summary for comparison
 */
export interface SegmentSummary {
  id: string;
  name: string;
  precinctCount: number;
  voterCount: number;
  avgGOTV: number;
  avgPersuasion: number;
  avgPartisanLean: number;
  avgTurnout: number;
  precinctIds: string[];
  strategyBreakdown: Record<string, number>;
}

/**
 * Overlap between two segments
 */
export interface SegmentOverlap {
  segmentA: string;
  segmentB: string;
  sharedPrecincts: string[];
  sharedVoters: number;
  overlapPct: number;                    // % of smaller segment
}

/**
 * Statistical difference between segments
 */
export interface StatisticalDifference {
  feature: string;
  segments: string[];
  values: number[];
  pValue: number;
  effectSize: number;
  isSignificant: boolean;
  interpretation: string;
}

/**
 * Full comparison results
 */
export interface ComparisonResults {
  segments: SegmentSummary[];

  // Overlap analysis
  overlaps: SegmentOverlap[];

  // Statistical comparison
  significantDifferences: StatisticalDifference[];

  // Set operations results
  union: PrecinctMatch[];                // All precincts in any segment
  intersection: PrecinctMatch[];         // Precincts in all segments
  uniqueToEach: Record<string, PrecinctMatch[]>; // Unique to each segment

  computedAt: string;
}

// ============================================================================
// Donor Cross-Reference Types (Phase 8)
// ============================================================================

/**
 * Donor cross-reference filters
 */
export interface DonorCrossReferenceFilters {
  // Donor concentration
  minDonorCount?: number;                // At least X donors in precinct
  minTotalRaised?: number;               // At least $X raised
  avgDonationRange?: [number, number];   // Average gift size

  // Donor density
  minDonorPct?: number;                  // Donors per 1000 voters
  donorDensity?: 'high' | 'medium' | 'low' | 'none';

  // Recency
  recentDonors?: boolean;                // Donated in current cycle
  lapsedDonors?: boolean;                // Donated previously, not recently

  // Capacity
  hasUpgradePotential?: boolean;         // Donors giving below capacity
  majorDonorPresence?: boolean;          // Has $500+ donors

  // RFM segmentation
  rfmSegments?: string[];                // ['Champions', 'Loyal Customers', etc.]
}

/**
 * Precinct donor profile
 */
export interface PrecinctDonorProfile {
  precinctId: string;

  // Donor counts
  totalDonors: number;
  activeDonors: number;                  // Current cycle
  lapsedDonors: number;                  // Previous cycles only

  // Financial metrics
  totalRaised: number;
  avgDonation: number;
  medianDonation: number;
  maxDonation: number;

  // Density
  donorsPerThousandVoters: number;
  donorPenetration: number;              // % of voters who are donors

  // RFM distribution
  rfmBreakdown: Record<string, number>;  // Segment → count

  // Capacity
  estimatedCapacity: number;             // Total capacity - total given
  upgradeProspects: number;              // Count of upgrade prospects
}

// ============================================================================
// Extended SegmentFilters (Updated with new filter types)
// ============================================================================

/**
 * Extended segment filters with all new filter categories
 */
export interface ExtendedSegmentFilters extends SegmentFilters {
  /** When set, sort matches by modeled % with bachelor's+ (college) descending — "highest concentration" queries */
  sortByCollegePctDesc?: boolean;

  // Phase 1: Electoral filtering
  electoral?: ElectoralFilters;

  // Phase 2: Election history filtering
  electionHistory?: ElectionHistoryFilters;

  // Phase 4: Tapestry filtering
  tapestry?: TapestryFilters;

  // Phase 8: Donor cross-reference filtering
  donorCrossRef?: DonorCrossReferenceFilters;
}

/**
 * Extended segment results with new data categories
 */
export interface ExtendedSegmentResults extends SegmentResults {
  // Electoral breakdown
  electoralBreakdown?: {
    stateHouse: Record<string, number>;  // district_id -> precinct count
    stateSenate: Record<string, number>;
    congressional: Record<string, number>;
    municipalities: Record<string, number>;
  };

  // Election history summary
  electionSummary?: {
    avg2024DemPct: number;
    avg2022DemPct: number;
    avg2020DemPct: number;
    avgMarginShift: number;              // 2020 to 2024
    splitTicketPrecincts: number;
  };

  // Tapestry breakdown
  tapestryBreakdown?: {
    dominantSegments: Array<{
      code: string;
      name: string;
      precinctCount: number;
      voterCount: number;
    }>;
    lifeModeDistribution: Record<string, number>;
  };

  // Donor summary
  donorSummary?: {
    totalDonors: number;
    totalRaised: number;
    avgDonorDensity: number;
    topDonorPrecincts: string[];
  };
}
