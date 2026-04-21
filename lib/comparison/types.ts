/**
 * Type definitions for the Split Screen Comparison Tool
 *
 * Supports comparing two jurisdictions or precincts side-by-side
 * to identify strategic differences and targeting opportunities.
 */

export type EntityType = 'precinct' | 'jurisdiction';

/**
 * Boundary types for split screen comparison
 */
export type BoundaryType =
  | 'precincts'
  | 'municipalities'
  | 'state_house'
  | 'state_senate'
  | 'congressional'
  | 'school_districts'
  | 'county'
  | 'zip_codes';

/**
 * Boundary type metadata
 */
export interface BoundaryTypeInfo {
  value: BoundaryType;
  label: string;
  description: string;
  entityType: EntityType;
  available: boolean;
  dataSource?: string;
}

export type CompetitivenessLevel =
  | 'safe_d'
  | 'likely_d'
  | 'lean_d'
  | 'tossup'
  | 'lean_r'
  | 'likely_r'
  | 'safe_r';

export type TargetingStrategy =
  | 'Battleground'
  | 'Base Mobilization'
  | 'Persuasion Target'
  | 'Low Priority';

/**
 * Raw precinct record shape (PoliticalDataService / unified precinct JSON).
 */
export interface PrecinctRawData {
  id: string;
  name: string;
  jurisdiction: string;
  jurisdictionType: 'city' | 'township';

  demographics: {
    totalPopulation: number;
    population18up: number;
    medianAge: number;
    medianHHI: number;
    collegePct: number;
    homeownerPct: number;
    diversityIndex: number;
    populationDensity: number;
  };

  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
    liberalPct: number;
    moderatePct: number;
    conservativePct: number;
  };

  electoral: {
    partisanLean: number;
    swingPotential: number;
    competitiveness: CompetitivenessLevel;
    avgTurnout: number;
    turnoutDropoff: number;
  };

  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    strategy: string;
  };

  elections: {
    [year: string]: {
      demPct: number;
      repPct: number;
      margin: number;
      turnout: number;
      ballotsCast: number;
    };
  };

  engagement?: {
    cnnMsnbcPct: number;
    foxNewsmaxPct: number;
    nprPct: number;
    socialMediaPct: number;
    politicalDonorPct: number;
  };
}

/**
 * Jurisdiction entry in a precinct data file (city/township + precinct ids).
 */
export interface JurisdictionEntry {
  id: string;
  name: string;
  type: 'city' | 'township';
  precinctIds: string[];
}

/**
 * Full data file structure
 */
export interface PrecinctDataFile {
  metadata: {
    county: string;
    state: string;
    created: string;
    precinctCount: number;
    dataYear: number;
    description?: string;
    sources?: string[];
  };
  jurisdictions: JurisdictionEntry[];
  precincts: Record<string, PrecinctRawData>;
}

/**
 * Municipality data structure (cities and townships)
 */
export interface MunicipalityRawData {
  id: string;
  name: string;
  type: 'city' | 'township';
  population: number;
  precinctCount: number;
  partisanLean: number;
  swingPotential: number;
  gotvPriority: number;
  persuasionOpportunity: number;
  avgTurnout: number;
  dominantStrategy: string;
  density: 'urban' | 'suburban' | 'rural';
}

export interface MunicipalityDataFile {
  municipalities: MunicipalityRawData[];
  metadata: {
    county: string;
    state: string;
    totalMunicipalities: number;
    totalPopulation: number;
    avgTurnout: number;
    overallPartisanLean: number;
    dataSource: string;
    lastUpdated: string;
  };
}

/**
 * State House district data structure
 */
export interface StateHouseRawData {
  id: string;
  name: string;
  representative: string;
  party: 'D' | 'R' | 'I';
  population: number;
  precinctCount: number;
  partisanLean: number;
  swingPotential: number;
  gotvPriority: number;
  persuasionOpportunity: number;
  avgTurnout: number;
  competitiveness: string;
  lastElectionMargin: number;
  lastElectionYear: number;
  coverage: string;
  dominantStrategy: string;
  keyDemographics: {
    medianAge: number;
    medianIncome: number;
    bachelorsPct: number;
    density: string;
  };
}

export interface StateHouseDataFile {
  districts: StateHouseRawData[];
  metadata: {
    county: string;
    state: string;
    chamber: string;
    totalDistricts: number;
    totalPopulation: number;
    avgTurnout: number;
    overallPartisanLean: number;
    competitiveDistricts: number;
    dataSource: string;
    lastElectionCycle: number;
    nextElectionCycle: number;
    lastUpdated: string;
    notes?: string;
  };
}

/**
 * Entity being compared (precinct or jurisdiction)
 */
export interface ComparisonEntity {
  id: string;
  name: string;
  type: EntityType;
  parentJurisdiction?: string;

  demographics: {
    totalPopulation: number;
    registeredVoters: number;
    medianAge: number;
    medianIncome: number;
    collegePct: number;
    homeownerPct: number;
    diversityIndex: number;
    populationDensity: number;
  };

  politicalProfile: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
    partisanLean: number;
    swingPotential: number;
    competitiveness: CompetitivenessLevel;
    dominantParty: 'D' | 'R' | 'Swing';
    avgTurnoutRate: number;
  };

  electoral: {
    lastElectionYear: number;
    demVoteShare: number;
    repVoteShare: number;
    marginOfVictory: number;
    totalVotesCast: number;
  };

  targetingScores: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    recommendedStrategy: TargetingStrategy;
    canvassingEfficiency: number;
  };

  electionHistory: Array<{
    year: number;
    demPct: number;
    repPct: number;
    margin: number;
    turnout: number;
    ballotsCast: number;
  }>;
}

/**
 * Difference between two metric values
 */
export interface MetricDifference {
  metricName: string;
  leftValue: number;
  rightValue: number;
  difference: number;
  percentDiff: number;
  isSignificant: boolean;
  direction: 'left-higher' | 'right-higher' | 'equal';
  formatType: 'number' | 'currency' | 'percent' | 'points';
}

/**
 * Complete comparison result
 */
export interface ComparisonResult {
  leftEntity: ComparisonEntity;
  rightEntity: ComparisonEntity;

  differences: {
    demographics: MetricDifference[];
    politicalProfile: MetricDifference[];
    electoral: MetricDifference[];
    targeting: MetricDifference[];
  };

  insights: string[];

  comparisonType: 'precinct-to-precinct' | 'jurisdiction-to-jurisdiction' | 'mixed' | 'cross-boundary';
  timestamp: Date;
}

/**
 * Cross-boundary comparison options
 */
export interface CrossBoundaryComparisonOptions {
  leftBoundaryType: BoundaryType;
  rightBoundaryType: BoundaryType;
  leftDataSource?: string;
  rightDataSource?: string;
}

/**
 * Similar entity result from cross-boundary search
 */
export interface SimilarEntityResult {
  entity: ComparisonEntity;
  similarityScore: number;
  matchingFactors: string[];
  boundaryType: BoundaryType;
}

/**
 * Search result for entity selector
 */
export interface EntitySearchResult {
  id: string;
  name: string;
  type: EntityType;
  parentName?: string;
  partisanLean: number;
  population: number;
}
