/**
 * Context Enrichment Types
 *
 * Types for the unified context enrichment layer that provides
 * RAG documents and Knowledge Graph entities to all AI interactions.
 */

import type { RAGDocument, CurrentIntelDocument, DataFileCitation } from '../rag';
import type { Entity, Relationship, CandidateEntity, OfficeEntity, IssueEntity } from '../knowledge-graph/types';
import type { CandidateContext } from '../knowledge-graph/CandidateContextService';

/**
 * RAG content retrieved for a query
 */
export interface RAGContent {
  documents: RAGDocument[];
  currentIntel: CurrentIntelDocument[];
  citations: DataFileCitation[];
  formattedContext: string;
}

/**
 * Knowledge Graph content retrieved for a query
 */
export interface GraphContent {
  candidates: CandidateContext[];
  offices: OfficeEntity[];
  relationships: Relationship[];
  issues: IssueEntity[];
  entities: Entity[];
  formattedContext: string;
}

/**
 * Relevance metadata for retrieved content
 */
export interface RelevanceMetadata {
  ragScore: number;       // 0-1, how relevant RAG content is
  graphScore: number;     // 0-1, how relevant graph content is
  overallScore: number;   // Combined relevance score
  shouldInclude: boolean; // Whether to include in response
  reasons: string[];      // Why content was included/excluded
}

/**
 * Full enrichment context returned by the service
 */
export interface EnrichmentContext {
  rag: RAGContent;
  graph: GraphContent;
  relevance: RelevanceMetadata;
  formattedContext: string;  // Combined formatted context for AI prompts
  timestamp: string;
}

/**
 * Options for enrichment requests
 */
export interface EnrichmentOptions {
  // Query context
  intent?: string;
  jurisdiction?: string;
  districtType?: 'state_house' | 'state_senate' | 'congressional' | 'county';
  districtNumber?: string;
  precincts?: string[];
  candidates?: string[];
  topics?: string[];

  // Retrieval limits
  maxRagDocs?: number;
  maxIntelDocs?: number;
  maxGraphEntities?: number;

  // Content filters
  includeMethodology?: boolean;
  includeCurrentIntel?: boolean;
  includeCandidates?: boolean;
  includeIssues?: boolean;

  // Relevance threshold (0-1)
  relevanceThreshold?: number;
}

/**
 * Default enrichment options
 */
export const DEFAULT_ENRICHMENT_OPTIONS: Required<EnrichmentOptions> = {
  intent: '',
  jurisdiction: 'Pennsylvania',
  districtType: 'county',
  districtNumber: '',
  precincts: [],
  candidates: [],
  topics: [],
  maxRagDocs: 2,
  maxIntelDocs: 3,
  maxGraphEntities: 10,
  includeMethodology: false,
  includeCurrentIntel: true,
  includeCandidates: true,
  includeIssues: true,
  relevanceThreshold: 0.3,
};

/**
 * Relevance factors used for scoring
 */
export interface RelevanceFactors {
  directMention: boolean;      // Query mentions entity directly
  jurisdictionMatch: boolean;  // Entity is in queried jurisdiction
  districtMatch: boolean;      // Entity is for queried district
  temporalRelevance: number;   // 0-1 based on recency
  topicMatch: number;          // 0-1 based on keyword overlap
  typeMatch: boolean;          // Entity type matches query intent
}

/**
 * Scored item for relevance ranking
 */
export interface ScoredItem<T> {
  item: T;
  score: number;
  factors: RelevanceFactors;
}
