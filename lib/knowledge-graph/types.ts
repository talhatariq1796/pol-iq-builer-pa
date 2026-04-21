/**
 * Knowledge Graph Types
 *
 * Entity and relationship types for the political knowledge graph.
 * Enables queries like:
 * - "Which candidates are running in swing precincts?"
 * - "What issues matter most in East Lansing?"
 * - "Show connections between Haley Stevens and Oakland County"
 */

// ============================================================================
// Entity Types
// ============================================================================

export type EntityType =
  | 'candidate'
  | 'office'
  | 'party'
  | 'jurisdiction'
  | 'precinct'
  | 'issue'
  | 'organization'
  | 'event'
  | 'poll'
  | 'election';

export interface BaseEntity {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
  sources?: string[]; // Document IDs that reference this entity
  createdAt: string;
  updatedAt: string;
}

export interface CandidateEntity extends BaseEntity {
  type: 'candidate';
  metadata: {
    party: 'DEM' | 'REP' | 'IND' | 'OTHER';
    incumbentOf?: string; // Office ID
    runningFor?: string[]; // Office IDs
    previousOffices?: string[];
    status: 'declared' | 'exploring' | 'withdrawn' | 'incumbent' | 'former';
    electionYear?: number;
    notablePositions?: string[]; // Issue IDs
    endorsements?: string[]; // Organization/Candidate IDs
    // Extended fields for detailed candidate info
    termStart?: string;
    termEnd?: string;
    notSeekingReelection?: boolean;
    committees?: string[];
    biography?: string;
    election2024?: {
      votes?: number;
      percentage?: number;
      opponent?: string;
      opponentVotes?: number;
      opponentPercentage?: number;
    };
  };
}

export interface OfficeEntity extends BaseEntity {
  type: 'office';
  metadata: {
    level: 'federal' | 'state' | 'county' | 'local';
    officeType: 'executive' | 'legislative' | 'judicial';
    jurisdiction: string; // Jurisdiction ID
    district?: string;
    termLength: number;
    nextElection: string; // ISO date
    currentHolder?: string; // Candidate ID
  };
}

export interface PartyEntity extends BaseEntity {
  type: 'party';
  metadata: {
    abbreviation: string;
    color: string;
    ideology: 'left' | 'center-left' | 'center' | 'center-right' | 'right';
  };
}

export interface JurisdictionEntity extends BaseEntity {
  type: 'jurisdiction';
  metadata: {
    level: 'county' | 'city' | 'township' | 'village';
    parentJurisdiction?: string; // Jurisdiction ID
    population?: number;
    partisanLean?: number; // -100 to +100
    precinctCount?: number;
    density: 'urban' | 'suburban' | 'rural';
  };
}

export interface PrecinctEntity extends BaseEntity {
  type: 'precinct';
  metadata: {
    jurisdiction: string; // Jurisdiction ID
    partisanLean: number;
    swingPotential: number;
    gotvPriority: number;
    persuasionOpportunity: number;
    competitiveness: string;
    strategy: string;
    registeredVoters?: number;
  };
}

export interface IssueEntity extends BaseEntity {
  type: 'issue';
  metadata: {
    category: 'economic' | 'social' | 'foreign_policy' | 'environmental' | 'governance' | 'other';
    salience: number; // 0-100 importance score
    partisanValence?: number; // -100 (D-favoring) to +100 (R-favoring)
    keywords: string[];
  };
}

export interface OrganizationEntity extends BaseEntity {
  type: 'organization';
  metadata: {
    orgType: 'party_committee' | 'pac' | 'super_pac' | 'union' | 'advocacy' | 'media' | 'other';
    partisanLean?: 'D' | 'R' | 'nonpartisan' | 'bipartisan';
    scope: 'national' | 'state' | 'local';
  };
}

export interface EventEntity extends BaseEntity {
  type: 'event';
  metadata: {
    eventType: 'election' | 'primary' | 'debate' | 'rally' | 'fundraiser' | 'announcement';
    date: string; // ISO date
    jurisdiction?: string;
    participants?: string[]; // Candidate/Organization IDs
  };
}

export interface PollEntity extends BaseEntity {
  type: 'poll';
  metadata: {
    pollster: string;
    fieldDates: { start: string; end: string };
    sampleSize: number;
    marginOfError: number;
    race: string; // Office ID
    results: Array<{ candidateId: string; support: number }>;
    methodology?: string;
  };
}

export interface ElectionEntity extends BaseEntity {
  type: 'election';
  metadata: {
    date: string;
    electionType: 'general' | 'primary' | 'special' | 'runoff';
    jurisdiction: string;
    offices: string[]; // Office IDs on ballot
    turnout?: number;
    results?: Record<string, { winner: string; margin: number }>;
  };
}

export type Entity =
  | CandidateEntity
  | OfficeEntity
  | PartyEntity
  | JurisdictionEntity
  | PrecinctEntity
  | IssueEntity
  | OrganizationEntity
  | EventEntity
  | PollEntity
  | ElectionEntity;

// ============================================================================
// Relationship Types
// ============================================================================

export type RelationshipType =
  // Candidate relationships
  | 'RUNNING_FOR' // Candidate -> Office
  | 'MEMBER_OF' // Candidate -> Party
  | 'ENDORSED_BY' // Candidate -> Organization/Candidate
  | 'OPPOSES' // Candidate -> Candidate
  | 'SUPPORTS_ISSUE' // Candidate -> Issue
  | 'OPPOSES_ISSUE' // Candidate -> Issue
  | 'REPRESENTS' // Candidate -> Jurisdiction
  | 'CAMPAIGNED_IN' // Candidate -> Jurisdiction/Precinct
  // Office relationships
  | 'GOVERNS' // Office -> Jurisdiction
  | 'INCUMBENT' // Candidate -> Office
  | 'FORMER_HOLDER' // Candidate -> Office
  // Geographic relationships
  | 'CONTAINS' // Jurisdiction -> Precinct/Jurisdiction
  | 'PART_OF' // Precinct -> Jurisdiction
  | 'BORDERS' // Jurisdiction -> Jurisdiction
  // Election relationships
  | 'CONTESTED_IN' // Office -> Election
  | 'PARTICIPATED_IN' // Candidate -> Election
  | 'WON' // Candidate -> Election (with office context)
  | 'LOST' // Candidate -> Election
  // Issue relationships
  | 'SALIENT_IN' // Issue -> Jurisdiction/Precinct
  | 'ASSOCIATED_WITH' // Issue -> Party
  // Poll relationships
  | 'MEASURES' // Poll -> Office/Election
  | 'SHOWS_LEADING' // Poll -> Candidate
  // Organization relationships
  | 'SUPPORTS' // Organization -> Candidate/Party
  | 'FUNDED_BY' // Candidate -> Organization
  | 'AFFILIATED_WITH'; // Organization -> Party

export interface Relationship {
  id: string;
  type: RelationshipType;
  sourceId: string;
  sourceType: EntityType;
  targetId: string;
  targetType: EntityType;
  properties?: Record<string, unknown>;
  weight?: number; // Relationship strength 0-1
  confidence?: number; // Extraction confidence 0-1
  sources?: string[]; // Document IDs
  validFrom?: string; // Temporal validity
  validTo?: string;
  createdAt: string;
}

// ============================================================================
// Query Types
// ============================================================================

export interface GraphQuery {
  // Find entities
  entityTypes?: EntityType[];
  entityIds?: string[];
  namePattern?: string; // Regex or fuzzy match

  // Traverse relationships
  relationshipTypes?: RelationshipType[];
  direction?: 'outgoing' | 'incoming' | 'both';
  maxDepth?: number;

  // Filter by properties
  filters?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
    value: unknown;
  }>;

  // Limit results
  limit?: number;
  offset?: number;
}

export interface GraphQueryResult {
  entities: Entity[];
  relationships: Relationship[];
  paths?: Array<{
    nodes: Entity[];
    edges: Relationship[];
  }>;
  metadata: {
    totalEntities: number;
    totalRelationships: number;
    queryTimeMs: number;
  };
}

// ============================================================================
// Entity Extraction Types
// ============================================================================

export interface ExtractedEntity {
  type: EntityType;
  name: string;
  aliases?: string[];
  confidence: number;
  sourceSpan?: { start: number; end: number };
  context?: string;
}

export interface ExtractedRelationship {
  type: RelationshipType;
  sourceName: string;
  sourceType: EntityType;
  targetName: string;
  targetType: EntityType;
  confidence: number;
  context?: string;
}

export interface ExtractionResult {
  documentId: string;
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  timestamp: string;
}
