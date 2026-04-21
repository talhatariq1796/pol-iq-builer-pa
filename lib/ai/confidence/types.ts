/**
 * Types for Confidence Visualization & Citation Links
 * Phase 14 Enhanced Implementation
 *
 * Provides data confidence levels and clickable source citations
 */

// ============================================================================
// Confidence Levels
// ============================================================================

/**
 * Confidence level for a data point
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'estimate';

/**
 * Visual indicator for confidence level
 */
export const CONFIDENCE_INDICATORS: Record<ConfidenceLevel, {
  emoji: string;
  label: string;
  color: string;
  description: string;
}> = {
  high: {
    emoji: '🟢',
    label: 'High confidence',
    color: '#22c55e', // green-500
    description: 'Based on multiple data points from reliable sources',
  },
  medium: {
    emoji: '🟡',
    label: 'Medium confidence',
    color: '#eab308', // yellow-500
    description: 'Based on limited data or older sources',
  },
  low: {
    emoji: '🔴',
    label: 'Low confidence',
    color: '#ef4444', // red-500
    description: 'Limited data available, treat with caution',
  },
  estimate: {
    emoji: '⚠️',
    label: 'Estimate',
    color: '#f97316', // orange-500
    description: 'Modeled or interpolated from related data',
  },
};

/**
 * Factors that affect confidence scoring
 */
export interface ConfidenceFactors {
  dataRecency: number;           // Years since last update (0 = current)
  sampleSize: number;            // Number of data points (elections, surveys, etc.)
  sourceReliability: number;     // 0-1 score for source quality
  redistrictingStatus: 'stable' | 'recent' | 'new'; // Geographic stability
  dataCompleteness: number;      // 0-1 percentage of expected fields present
  methodologyTransparency: boolean; // Is calculation method documented?
}

/**
 * Confidence metadata for a metric
 */
export interface ConfidenceMetadata {
  level: ConfidenceLevel;
  score: number;                 // 0-100 numeric score
  factors: Partial<ConfidenceFactors>;
  explanation: string;           // Human-readable explanation
  range?: {                      // Confidence interval
    low: number;
    high: number;
    unit?: string;
  };
  lastUpdated?: Date;
  methodology?: string;          // Link to methodology doc
}

/**
 * Data point with confidence
 */
export interface ConfidentDataPoint<T = number> {
  value: T;
  confidence: ConfidenceMetadata;
  citations: CitationKey[];
}

// ============================================================================
// Citation System
// ============================================================================

/**
 * Citation key (matches RAG system)
 *
 * Categories:
 * - Data Sources: Primary data providers (elections, demographics, finance)
 * - Academic Research: Peer-reviewed studies and methodological papers
 * - Methodology: Platform-specific calculation methods
 * - Tool-Specific: Citations for specific analysis tools
 */
export type CitationKey =
  // === DATA SOURCES ===
  | 'ELECTIONS'           // Precinct election results (PA build in this app)
  | 'DEMOGRAPHICS'        // Census/ACS demographic data
  | 'PSYCHOGRAPHICS'      // GfK MRI political attitudes
  | 'TAPESTRY'            // Esri Tapestry segmentation
  | 'FEC'                 // Federal Election Commission data
  | 'MEDIA'               // Media consumption patterns
  | 'POLL'                // Polling data
  | 'UPCOMING'            // Upcoming elections
  | 'NEWS'                // News coverage
  | 'CENSUS_ACS'          // American Community Survey specifics
  | 'GFK_MRI'             // GfK MRI Survey methodology
  | 'MICHIGAN_GIS'        // Precinct/district boundary reference (legacy key name)
  | 'INGHAM_CLERK'        // Legacy key; treat as county-level election reporting
  | 'MICHIGAN_SOS'        // Legacy key; use state election authority for the deployment
  | 'ESRI_BA'             // Esri Business Analyst
  // === ACADEMIC RESEARCH ===
  | 'GERBER_GREEN'        // GOTV field experiments
  | 'KING_ECOLOGICAL'     // Ecological inference
  | 'TAPPIN_PERSUASION'   // Microtargeting effectiveness
  | 'ROGERS_TARGETING'    // Support/turnout scores
  | 'SOIFER_MAUP'         // Modifiable Areal Unit Problem
  | 'KENNY_PRECINCT'      // Precinct-to-census crosswalk
  | 'COPPOCK_PERSUASION'  // Campaign persuasion experiments
  | 'BONICA_DIME'         // Campaign finance ideology scoring
  | 'BHATTI_CANVASS'      // International canvassing evidence
  // === METHODOLOGY ===
  | 'SCORES'              // Political scoring model
  | 'TARGETING'           // Targeting scores calculation
  | 'AREA_WEIGHTING'      // Area-weighted interpolation
  | 'H3_METHODOLOGY'      // H3 hexagonal aggregation
  | 'CROSSWALK'           // Precinct-block group crosswalk
  | 'PARTISAN_LEAN'       // Partisan lean calculation
  | 'SWING_CALCULATION'   // Swing potential methodology
  | 'GOTV_FORMULA'        // GOTV priority formula
  | 'PERSUASION_CALC'     // Persuasion opportunity calculation
  // === TOOL-SPECIFIC ===
  | 'CANVASS_EFFICIENCY'  // Canvassing benchmarks
  | 'GOTV_EFFECTIVENESS'  // GOTV turnout lift research
  | 'PERSUASION_UNIVERSE' // Persuasion targeting
  | 'LOOKALIKE_MODEL'     // Similarity algorithm
  | 'SEGMENT_METHODOLOGY' // Segmentation approach
  | 'COMPARISON_METHOD'   // Comparison tool methodology
  | 'DONOR_ANALYSIS'      // Donor concentration analysis
  // === GENERAL ===
  | 'ANALYSIS'            // General political analysis
  | 'OFFICIAL'            // Official government reports
  | 'METHODOLOGY_DOC';    // Platform methodology document

/**
 * Full citation with metadata
 */
export interface Citation {
  key: CitationKey;
  displayKey: string;            // e.g., "[ELECTIONS]"
  title: string;                 // e.g., "Pennsylvania precinct results"
  description: string;           // What this source contains
  source: string;                // e.g., "County board of elections"
  url?: string;                  // Link to source
  lastUpdated?: Date;
  vintage?: string;              // e.g., "2020-2024"
  coverage?: string;             // e.g., "Precinct-level"
  methodology?: string;          // Link to methodology
  reliability: number;           // 0-1 score
}

/**
 * Citation registry - all available citations
 *
 * Organized by category:
 * 1. Data Sources - Primary data providers
 * 2. Academic Research - Peer-reviewed studies
 * 3. Methodology - Platform calculation methods
 * 4. Tool-Specific - Analysis tool documentation
 * 5. General - Catch-all categories
 */
export const CITATION_REGISTRY: Record<CitationKey, Citation> = {
  // ==========================================================================
  // DATA SOURCES
  // ==========================================================================

  ELECTIONS: {
    key: 'ELECTIONS',
    displayKey: '[ELECTIONS]',
    title: 'Pennsylvania Precinct Election History',
    description: 'Precinct-level general election results (2020, 2022, 2024) in the loaded PA dataset',
    source: 'Compiled PA precinct results (application data pipeline)',
    url: 'https://www.vote.pa.gov/',
    vintage: '2020-2024',
    coverage: 'Pennsylvania precincts in deployment',
    reliability: 0.95,
  },

  DEMOGRAPHICS: {
    key: 'DEMOGRAPHICS',
    displayKey: '[DEMOGRAPHICS]',
    title: 'Demographic Data',
    description: 'Population, age, income, education by precinct',
    source: 'U.S. Census Bureau ACS via Esri Business Analyst',
    url: 'https://www.census.gov/programs-surveys/acs',
    vintage: '2019-2023 5-year estimates',
    coverage: 'Block group level, interpolated to precincts',
    reliability: 0.90,
  },

  PSYCHOGRAPHICS: {
    key: 'PSYCHOGRAPHICS',
    displayKey: '[PSYCHOGRAPHICS]',
    title: 'Political Attitudes',
    description: 'Party affiliation estimates, political outlook, civic engagement',
    source: 'GfK MRI Survey via Esri Business Analyst',
    url: 'https://www.gfk.com/products/gfk-mri',
    vintage: '2023-2024',
    coverage: 'Modeled to block group level',
    reliability: 0.70,
  },

  TAPESTRY: {
    key: 'TAPESTRY',
    displayKey: '[TAPESTRY]',
    title: 'Tapestry Segmentation',
    description: 'Esri Tapestry lifestyle segmentation (67 segments in 14 LifeMode groups)',
    source: 'Esri proprietary model using Census, MRI, Experian, BLS data',
    url: 'https://www.esri.com/en-us/arcgis/products/tapestry-segmentation',
    vintage: '2023',
    coverage: 'Block group level',
    reliability: 0.75,
  },

  FEC: {
    key: 'FEC',
    displayKey: '[FEC]',
    title: 'FEC Campaign Finance Data',
    description: 'Individual campaign contributions >$200 to federal candidates',
    source: 'Federal Election Commission',
    url: 'https://www.fec.gov/data/',
    vintage: '2019-2024',
    coverage: 'ZIP code level',
    reliability: 0.95,
  },

  MEDIA: {
    key: 'MEDIA',
    displayKey: '[MEDIA]',
    title: 'Media Consumption Patterns',
    description: 'TV, radio, digital, print, and social media consumption',
    source: 'GfK MRI Survey + Nielsen via Esri Business Analyst',
    vintage: '2023',
    reliability: 0.70,
  },

  POLL: {
    key: 'POLL',
    displayKey: '[POLL]',
    title: 'Polling Data',
    description: 'Public opinion polls for Pennsylvania and federal races (when ingested)',
    source: 'Various polling organizations',
    reliability: 0.60,
  },

  UPCOMING: {
    key: 'UPCOMING',
    displayKey: '[UPCOMING]',
    title: 'Upcoming Elections',
    description: 'Scheduled elections, candidates, filing deadlines',
    source: 'Pennsylvania Department of State',
    url: 'https://www.vote.pa.gov/',
    reliability: 0.95,
  },

  NEWS: {
    key: 'NEWS',
    displayKey: '[NEWS]',
    title: 'News Coverage',
    description: 'Recent news articles about Pennsylvania politics',
    source: 'Various news sources',
    reliability: 0.65,
  },

  CENSUS_ACS: {
    key: 'CENSUS_ACS',
    displayKey: '[CENSUS_ACS]',
    title: 'American Community Survey',
    description: '5-year demographic estimates at block group level',
    source: 'U.S. Census Bureau',
    url: 'https://www.census.gov/programs-surveys/acs',
    vintage: '2019-2023',
    coverage: 'Block group (smallest published geography)',
    methodology: 'https://www.census.gov/programs-surveys/acs/methodology.html',
    reliability: 0.92,
  },

  GFK_MRI: {
    key: 'GFK_MRI',
    displayKey: '[GFK_MRI]',
    title: 'GfK MRI Survey of the American Consumer',
    description: '~25,000 adults annually surveyed on political attitudes and media habits',
    source: 'GfK MRI (modeled to geographies by Esri)',
    url: 'https://www.gfk.com/products/gfk-mri',
    vintage: '2023-2024',
    coverage: 'National sample, modeled to local areas',
    reliability: 0.70,
  },

  MICHIGAN_GIS: {
    key: 'MICHIGAN_GIS',
    displayKey: '[MICHIGAN_GIS]',
    title: 'Precinct & District Boundaries',
    description: 'Pennsylvania precinct and legislative/congressional layers loaded by the app (legacy citation key)',
    source: 'PA LUSE / Census / DCED layers (see repository data readme)',
    url: 'https://www.census.gov/geographies/mapping-files.html',
    vintage: '2024–2026 (layer-dependent)',
    coverage: 'Pennsylvania (deployment)',
    reliability: 0.95,
  },

  INGHAM_CLERK: {
    key: 'INGHAM_CLERK',
    displayKey: '[INGHAM_CLERK]',
    title: 'County Election Reporting',
    description: 'Certified precinct results are typically published by county boards of elections',
    source: 'County boards of elections (Pennsylvania)',
    url: 'https://www.vote.pa.gov/',
    vintage: 'Varies',
    coverage: 'Pennsylvania counties',
    reliability: 0.95,
  },

  MICHIGAN_SOS: {
    key: 'MICHIGAN_SOS',
    displayKey: '[MICHIGAN_SOS]',
    title: 'State Election Authority',
    description: 'Voter registration, election calendars, and official state election information',
    source: 'Pennsylvania Department of State',
    url: 'https://www.vote.pa.gov/',
    reliability: 0.95,
  },

  ESRI_BA: {
    key: 'ESRI_BA',
    displayKey: '[ESRI_BA]',
    title: 'Esri Business Analyst',
    description: 'Comprehensive demographic enrichment platform',
    source: 'Esri (aggregates Census, GfK MRI, Experian, BLS)',
    url: 'https://www.esri.com/en-us/arcgis/products/arcgis-business-analyst',
    vintage: '2023-2024',
    reliability: 0.85,
  },

  // ==========================================================================
  // ACADEMIC RESEARCH
  // ==========================================================================

  GERBER_GREEN: {
    key: 'GERBER_GREEN',
    displayKey: '[GERBER_GREEN]',
    title: 'Gerber & Green GOTV Experiments',
    description: 'Field experiments showing personal canvassing raises turnout 6-8 points',
    source: 'Gerber & Green, PNAS 1999; APSR 2000',
    url: 'https://www.pnas.org/doi/10.1073/pnas.96.19.10939',
    vintage: '1999-2000',
    methodology: 'Randomized field experiments in New Haven, CT',
    reliability: 0.90,
  },

  KING_ECOLOGICAL: {
    key: 'KING_ECOLOGICAL',
    displayKey: '[KING_ECOLOGICAL]',
    title: 'King Ecological Inference',
    description: 'Methodology for drawing individual conclusions from aggregate data',
    source: 'Gary King, Princeton University Press 1997',
    url: 'https://gking.harvard.edu/eicamera/kinroot.html',
    vintage: '1997',
    methodology: 'Winner of Gosnell Prize for best methodological work',
    reliability: 0.85,
  },

  TAPPIN_PERSUASION: {
    key: 'TAPPIN_PERSUASION',
    displayKey: '[TAPPIN_PERSUASION]',
    title: 'Tappin et al. Microtargeting Study',
    description: 'Found microtargeting outperforms untargeted messaging by 70%+',
    source: 'Tappin et al., PNAS 2023',
    url: 'https://www.pnas.org/doi/10.1073/pnas.2216261120',
    vintage: '2023',
    reliability: 0.88,
  },

  ROGERS_TARGETING: {
    key: 'ROGERS_TARGETING',
    displayKey: '[ROGERS_TARGETING]',
    title: 'Rogers & Aida Political Targeting',
    description: 'Framework for support, turnout, and responsiveness scores',
    source: 'Rogers & Aida, Harvard Kennedy School',
    url: 'https://scholar.harvard.edu/files/todd_rogers/files/political_campaigns_and_big_data_0.pdf',
    vintage: '2014',
    reliability: 0.85,
  },

  SOIFER_MAUP: {
    key: 'SOIFER_MAUP',
    displayKey: '[SOIFER_MAUP]',
    title: 'Soifer MAUP Analysis',
    description: 'Modifiable Areal Unit Problem in political science',
    source: 'Soifer, Political Analysis 2025',
    url: 'https://www.cambridge.org/core/journals/political-analysis/article/modifiable-areal-unit-problem-in-political-science/00960110D72C627020C8C7CD42B054E5',
    vintage: '2025',
    reliability: 0.90,
  },

  KENNY_PRECINCT: {
    key: 'KENNY_PRECINCT',
    displayKey: '[KENNY_PRECINCT]',
    title: 'Kenny et al. Precinct-Census Crosswalk',
    description: 'Dataset of US precinct votes allocated to Census geographies',
    source: 'Kenny et al., Nature Scientific Data 2025',
    url: 'https://www.nature.com/articles/s41597-025-05140-3',
    vintage: '2025',
    reliability: 0.92,
  },

  COPPOCK_PERSUASION: {
    key: 'COPPOCK_PERSUASION',
    displayKey: '[COPPOCK_PERSUASION]',
    title: 'Coppock et al. Campaign Experiments',
    description: 'Analysis of thousands of campaign persuasion experiments',
    source: 'Coppock, Hill & Vavreck, APSR 2024',
    url: 'https://www.cambridge.org/core/journals/american-political-science-review/article/how-experiments-help-campaigns-persuade-voters-evidence-from-a-large-archive-of-campaigns-own-experiments/FF5BE6ED1553475F8321F7C4209357F7',
    vintage: '2024',
    reliability: 0.88,
  },

  BONICA_DIME: {
    key: 'BONICA_DIME',
    displayKey: '[BONICA_DIME]',
    title: 'Stanford DIME Database',
    description: '850M+ campaign contributions with ideology scores (CFscores)',
    source: 'Bonica, Stanford SSDL',
    url: 'https://data.stanford.edu/dime',
    vintage: '1979-2024',
    reliability: 0.85,
  },

  BHATTI_CANVASS: {
    key: 'BHATTI_CANVASS',
    displayKey: '[BHATTI_CANVASS]',
    title: 'Bhatti et al. Swedish Canvassing Study',
    description: 'International evidence on canvassing effectiveness (+3.6 pts)',
    source: 'Bhatti et al., Electoral Studies 2016',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0261379416302748',
    vintage: '2016',
    reliability: 0.85,
  },

  // ==========================================================================
  // METHODOLOGY
  // ==========================================================================

  SCORES: {
    key: 'SCORES',
    displayKey: '[SCORES]',
    title: 'Political Scoring Model',
    description: 'Partisan lean and swing potential calculations',
    source: 'Platform methodology',
    methodology: '/docs/METHODOLOGY.md#5-voter-targeting-model',
    vintage: 'Updated with each election',
    reliability: 0.85,
  },

  TARGETING: {
    key: 'TARGETING',
    displayKey: '[TARGETING]',
    title: 'Targeting Scores',
    description: 'GOTV Priority and Persuasion Opportunity composite scores',
    source: 'Calculated from demographics and election results',
    methodology: '/docs/METHODOLOGY.md#51-score-definitions',
    reliability: 0.80,
  },

  AREA_WEIGHTING: {
    key: 'AREA_WEIGHTING',
    displayKey: '[AREA_WEIGHTING]',
    title: 'Area-Weighted Interpolation',
    description: 'Method for estimating precinct demographics from block groups',
    source: 'Comber & Zeng, Geography Compass 2019',
    url: 'https://compass.onlinelibrary.wiley.com/doi/full/10.1111/gec3.12465',
    methodology: '/docs/METHODOLOGY.md#33-precinct-to-block-group-crosswalk',
    reliability: 0.80,
  },

  H3_METHODOLOGY: {
    key: 'H3_METHODOLOGY',
    displayKey: '[H3_METHODOLOGY]',
    title: 'H3 Hexagonal Aggregation',
    description: 'Uber H3 Level 7 (~5.16 km²) for uniform heatmap visualization',
    source: 'Uber Engineering',
    url: 'https://h3geo.org/docs/core-library/restable/',
    methodology: '/docs/METHODOLOGY.md#4-multi-resolution-analysis-framework',
    reliability: 0.90,
  },

  CROSSWALK: {
    key: 'CROSSWALK',
    displayKey: '[CROSSWALK]',
    title: 'Precinct-Block Group Crosswalk',
    description: 'Spatial join linking precincts to Census block groups',
    source: 'Platform methodology',
    methodology: '/docs/METHODOLOGY.md#33-precinct-to-block-group-crosswalk',
    reliability: 0.82,
  },

  PARTISAN_LEAN: {
    key: 'PARTISAN_LEAN',
    displayKey: '[PARTISAN_LEAN]',
    title: 'Partisan Lean Calculation',
    description: 'Weighted average: 2024 (50%) + 2022 (30%) + 2020 (20%)',
    source: 'Platform methodology',
    methodology: '/docs/METHODOLOGY.md#partisan-lean-score',
    vintage: 'Updated per election',
    reliability: 0.88,
  },

  SWING_CALCULATION: {
    key: 'SWING_CALCULATION',
    displayKey: '[SWING_CALCULATION]',
    title: 'Swing Potential Methodology',
    description: 'Based on margin volatility, ticket-splitting, suburban density',
    source: 'Platform methodology',
    methodology: '/docs/METHODOLOGY.md#swing-potential-score-0-100',
    reliability: 0.80,
  },

  GOTV_FORMULA: {
    key: 'GOTV_FORMULA',
    displayKey: '[GOTV_FORMULA]',
    title: 'GOTV Priority Formula',
    description: 'Support_Score × (1 - Turnout_Rate) × Voter_Count_Factor',
    source: 'Platform methodology based on Rogers & Aida framework',
    methodology: '/docs/METHODOLOGY.md#gotv-priority-score-0-100',
    reliability: 0.82,
  },

  PERSUASION_CALC: {
    key: 'PERSUASION_CALC',
    displayKey: '[PERSUASION_CALC]',
    title: 'Persuasion Opportunity Calculation',
    description: 'Based on margin closeness, ticket-splitting, moderate demographics',
    source: 'Platform methodology',
    methodology: '/docs/METHODOLOGY.md#persuasion-opportunity-score-0-100',
    reliability: 0.78,
  },

  // ==========================================================================
  // TOOL-SPECIFIC
  // ==========================================================================

  CANVASS_EFFICIENCY: {
    key: 'CANVASS_EFFICIENCY',
    displayKey: '[CANVASS_EFFICIENCY]',
    title: 'Canvassing Efficiency Benchmarks',
    description: '30-50 doors/hour depending on density; optimal turf: 40-50 doors',
    source: 'Minnesota DFL Field Guide; IAFF Canvassing Guide',
    url: 'https://dflvan.freshdesk.com/support/solutions/articles/48001155890-turf-cutting-how-to-best-practices',
    reliability: 0.85,
  },

  GOTV_EFFECTIVENESS: {
    key: 'GOTV_EFFECTIVENESS',
    displayKey: '[GOTV_EFFECTIVENESS]',
    title: 'GOTV Effectiveness Research',
    description: 'Personal canvassing raises turnout 6-8 points among contacted voters',
    source: 'Gerber & Green meta-analysis; Yale ISPS Field Experiments Initiative',
    url: 'https://isps.yale.edu/research/field-experiments-initiative/lessons-from-gotv-experiments',
    reliability: 0.88,
  },

  PERSUASION_UNIVERSE: {
    key: 'PERSUASION_UNIVERSE',
    displayKey: '[PERSUASION_UNIVERSE]',
    title: 'Persuasion Universe Methodology',
    description: 'Target voters with support scores 30-70 (not strong partisans)',
    source: 'Ragtag Helpdesk Campaign Guide',
    url: 'https://helpdesk.ragtag.org/hc/en-us/articles/360016010232-How-to-Analyze-the-Voter-File',
    reliability: 0.80,
  },

  LOOKALIKE_MODEL: {
    key: 'LOOKALIKE_MODEL',
    displayKey: '[LOOKALIKE_MODEL]',
    title: 'Lookalike Modeling Algorithm',
    description: 'Euclidean/cosine similarity on normalized demographic + political features',
    source: 'Platform methodology',
    methodology: '/docs/METHODOLOGY.md#844-lookalike-modeling',
    reliability: 0.78,
  },

  SEGMENT_METHODOLOGY: {
    key: 'SEGMENT_METHODOLOGY',
    displayKey: '[SEGMENT_METHODOLOGY]',
    title: 'Segmentation Tool Methodology',
    description: 'Multi-filter architecture for voter universe building',
    source: 'Platform methodology',
    methodology: '/docs/METHODOLOGY.md#84-segmentation-methodology',
    reliability: 0.85,
  },

  COMPARISON_METHOD: {
    key: 'COMPARISON_METHOD',
    displayKey: '[COMPARISON_METHOD]',
    title: 'Comparison Tool Methodology',
    description: 'Side-by-side metric comparison with demographic similarity scoring',
    source: 'Platform methodology',
    methodology: '/docs/METHODOLOGY.md#63-comparable-precinct-algorithm',
    reliability: 0.82,
  },

  DONOR_ANALYSIS: {
    key: 'DONOR_ANALYSIS',
    displayKey: '[DONOR_ANALYSIS]',
    title: 'Donor Concentration Analysis',
    description: 'ZIP-level aggregation of FEC contributions with temporal trends',
    source: 'Platform methodology using FEC bulk data',
    methodology: '/docs/METHODOLOGY.md#donor-concentration-tool',
    reliability: 0.90,
  },

  // ==========================================================================
  // GENERAL
  // ==========================================================================

  ANALYSIS: {
    key: 'ANALYSIS',
    displayKey: '[ANALYSIS]',
    title: 'Political Analysis',
    description: 'Expert analysis and commentary on electoral dynamics',
    source: 'Political analysts and organizations',
    reliability: 0.70,
  },

  OFFICIAL: {
    key: 'OFFICIAL',
    displayKey: '[OFFICIAL]',
    title: 'Official Reports',
    description: 'Official government reports and regulatory filings',
    source: 'Government agencies',
    reliability: 0.90,
  },

  METHODOLOGY_DOC: {
    key: 'METHODOLOGY_DOC',
    displayKey: '[METHODOLOGY_DOC]',
    title: 'Platform Methodology Document',
    description: 'Complete documentation of data sources, calculations, and academic references',
    source: 'Platform documentation',
    methodology: '/docs/METHODOLOGY.md',
    reliability: 0.95,
  },
};

/**
 * Inline citation in text
 */
export interface InlineCitation {
  key: CitationKey;
  position: number;              // Character position in text
  context?: string;              // Surrounding text for tooltip
}

/**
 * Parsed text with citations
 */
export interface CitedText {
  rawText: string;
  parsedText: string;            // Text with citation markers
  citations: InlineCitation[];
  uniqueCitations: CitationKey[];
}

// ============================================================================
// Precinct-Level Confidence
// ============================================================================

/**
 * Confidence assessment for a precinct's data
 */
export interface PrecinctConfidence {
  precinctId: string;
  overall: ConfidenceLevel;
  overallScore: number;
  metrics: {
    partisanLean?: ConfidenceMetadata;
    swingPotential?: ConfidenceMetadata;
    gotvPriority?: ConfidenceMetadata;
    persuasionOpportunity?: ConfidenceMetadata;
    turnout?: ConfidenceMetadata;
    demographics?: ConfidenceMetadata;
  };
  warnings: string[];            // Specific data quality warnings
  lastAssessed: Date;
}

/**
 * Redistricting impact on confidence
 */
export interface RedistrictingImpact {
  precinctId: string;
  status: 'stable' | 'modified' | 'new';
  previousPrecincts?: string[];  // Precincts that merged into this one
  overlapPercentage?: number;    // How much of old precinct is in new
  confidenceAdjustment: number;  // Multiplier for confidence (e.g., 0.7 for new)
  explanation: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Confidence engine configuration
 */
export interface ConfidenceEngineConfig {
  // Weights for confidence factors
  weights: {
    dataRecency: number;         // Default: 0.25
    sampleSize: number;          // Default: 0.25
    sourceReliability: number;   // Default: 0.20
    redistrictingStatus: number; // Default: 0.15
    dataCompleteness: number;    // Default: 0.15
  };

  // Thresholds for confidence levels
  thresholds: {
    high: number;                // Default: 80
    medium: number;              // Default: 60
    low: number;                 // Default: 40
  };

  // Recency decay (how much confidence drops per year)
  recencyDecayPerYear: number;   // Default: 10

  // Sample size expectations
  minSampleSizeForHigh: number;  // Default: 3 (elections)
  minSampleSizeForMedium: number; // Default: 2

  // Debug mode
  debug: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceEngineConfig = {
  weights: {
    dataRecency: 0.25,
    sampleSize: 0.25,
    sourceReliability: 0.20,
    redistrictingStatus: 0.15,
    dataCompleteness: 0.15,
  },
  thresholds: {
    high: 80,
    medium: 60,
    low: 40,
  },
  recencyDecayPerYear: 10,
  minSampleSizeForHigh: 3,
  minSampleSizeForMedium: 2,
  debug: false,
};
