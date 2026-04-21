/**
 * Poll Ingestion Types
 *
 * Data structures for political polling data ingestion, normalization,
 * aggregation, and integration with the knowledge graph and RAG system.
 */

// ============================================================================
// Core Poll Types
// ============================================================================

/**
 * Individual poll record
 */
export interface Poll {
  // Identification
  poll_id: string;
  source: PollSource;

  // Pollster Info
  pollster: string;
  pollster_rating?: PollsterRating;
  sponsor?: string;

  // Race Scope
  race_type: RaceType;
  race_id: string; // e.g., "MI-GOV-2026", "MI-SEN-2026"
  geography: string; // "Michigan", "MI-07", etc.
  geography_fips?: string;

  // Methodology
  methodology: PollMethodology;
  population: PollPopulation;
  sample_size: number;
  margin_of_error?: number;

  // Dates
  start_date: string; // ISO date
  end_date: string; // ISO date
  release_date?: string;

  // Results
  results: PollResult[];

  // Metadata
  source_url?: string;
  ingested_at: string;
}

/**
 * Raw poll data before normalization
 */
export interface RawPoll {
  source: PollSource;
  pollster: string;
  pollster_rating?: string;
  sponsor?: string;

  race_type?: string;
  geography: string;

  methodology?: string;
  population?: string;
  sample_size?: number;
  margin_of_error?: number;

  start_date?: string;
  end_date: string;

  results: RawPollResult[];

  source_url?: string;
  raw_data?: unknown;
}

export interface RawPollResult {
  candidate_name: string;
  party?: string;
  percentage: number;
}

export interface PollResult {
  candidate_name: string;
  party: Party;
  percentage: number;
  is_incumbent?: boolean;
}

// ============================================================================
// Aggregate Types
// ============================================================================

/**
 * Aggregated polling average for a race
 */
export interface PollAggregate {
  race_id: string;
  race_name: string;
  geography: string;
  last_updated: string;

  // Current Average
  candidates: CandidateAverage[];
  leader: string;
  margin: number; // Positive = first candidate leads

  // Trend (if enough data)
  margin_7d_ago?: number;
  margin_30d_ago?: number;
  trend_direction?: TrendDirection;
  trend_magnitude?: number;

  // Confidence Metrics
  poll_count: number;
  polls_last_30d: number;
  avg_sample_size: number;
  weighted_n: number;
}

export interface CandidateAverage {
  name: string;
  party: Party;
  average: number;
  high: number;
  low: number;
  poll_count: number;
}

export type TrendDirection = 'dem_gaining' | 'rep_gaining' | 'stable';

// ============================================================================
// Enums and Constants
// ============================================================================

export type PollSource = 'votehub' | 'civicapi' | 'fivethirtyeight' | 'rcp' | 'manual';

export type RaceType =
  | 'president'
  | 'senate'
  | 'governor'
  | 'house'
  | 'state_senate'
  | 'state_house'
  | 'approval';

export type PollMethodology = 'live_phone' | 'online' | 'ivr' | 'mixed' | 'unknown';

export type PollPopulation = 'lv' | 'rv' | 'a'; // Likely voters, registered, adults

export type Party = 'DEM' | 'REP' | 'IND' | 'LIB' | 'GRN' | 'other';

export type PollsterRating = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'F';

// ============================================================================
// Source Adapter Interface
// ============================================================================

export interface FetchOptions {
  state?: string;
  race_type?: RaceType;
  start_date?: string;
  end_date?: string;
}

export interface PollSourceAdapter {
  name: PollSource;
  fetchPolls(options: FetchOptions): Promise<RawPoll[]>;
}

// ============================================================================
// Store Types
// ============================================================================

export interface PollStoreData {
  metadata: {
    last_updated: string;
    poll_count: number;
    sources: PollSource[];
  };
  polls: Poll[];
  aggregates: Record<string, PollAggregate>;
}

// ============================================================================
// Known Entities for Normalization
// ============================================================================

export const KNOWN_CANDIDATES: Record<string, { fullName: string; party: Party }> = {
  // Michigan statewide
  whitmer: { fullName: 'Gretchen Whitmer', party: 'DEM' },
  'gretchen whitmer': { fullName: 'Gretchen Whitmer', party: 'DEM' },
  dixon: { fullName: 'Tudor Dixon', party: 'REP' },
  'tudor dixon': { fullName: 'Tudor Dixon', party: 'REP' },
  slotkin: { fullName: 'Elissa Slotkin', party: 'DEM' },
  'elissa slotkin': { fullName: 'Elissa Slotkin', party: 'DEM' },
  rogers: { fullName: 'Mike Rogers', party: 'REP' },
  'mike rogers': { fullName: 'Mike Rogers', party: 'REP' },
  peters: { fullName: 'Gary Peters', party: 'DEM' },
  'gary peters': { fullName: 'Gary Peters', party: 'DEM' },
  james: { fullName: 'John James', party: 'REP' },
  'john james': { fullName: 'John James', party: 'REP' },

  // National
  biden: { fullName: 'Joe Biden', party: 'DEM' },
  'joe biden': { fullName: 'Joe Biden', party: 'DEM' },
  trump: { fullName: 'Donald Trump', party: 'REP' },
  'donald trump': { fullName: 'Donald Trump', party: 'REP' },
  harris: { fullName: 'Kamala Harris', party: 'DEM' },
  'kamala harris': { fullName: 'Kamala Harris', party: 'DEM' },
};

export const RACE_TYPE_MAPPING: Record<string, RaceType> = {
  president: 'president',
  presidential: 'president',
  senate: 'senate',
  'u.s. senate': 'senate',
  'us senate': 'senate',
  governor: 'governor',
  gubernatorial: 'governor',
  house: 'house',
  'u.s. house': 'house',
  'us house': 'house',
  congressional: 'house',
  'state senate': 'state_senate',
  'state house': 'state_house',
  approval: 'approval',
};

export const METHODOLOGY_MAPPING: Record<string, PollMethodology> = {
  'live phone': 'live_phone',
  'live telephone': 'live_phone',
  phone: 'live_phone',
  online: 'online',
  'online panel': 'online',
  web: 'online',
  ivr: 'ivr',
  'automated phone': 'ivr',
  mixed: 'mixed',
  'mixed mode': 'mixed',
  hybrid: 'mixed',
};

export const POPULATION_MAPPING: Record<string, PollPopulation> = {
  lv: 'lv',
  'likely voters': 'lv',
  'likely voter': 'lv',
  rv: 'rv',
  'registered voters': 'rv',
  'registered voter': 'rv',
  a: 'a',
  adults: 'a',
  'all adults': 'a',
};
