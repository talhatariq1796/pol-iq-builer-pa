/**
 * ContextEnrichmentService - Unified context enrichment for ALL AI interactions
 *
 * Combines RAG document retrieval and Knowledge Graph queries to provide
 * relevant, hyperlocal political intelligence to every AI response.
 */

import { getDocumentRetriever, type RAGDocument, type CurrentIntelDocument, type DataFileCitation } from '../rag';
import { getKnowledgeGraph, getGraphPopulator } from '../knowledge-graph';
import {
  getStateHouseContext,
  getStateSenateContext,
  getCongressionalContext,
  getUSSenateContext,
  getInghamCountyRepresentatives,
  formatCandidateContextForResponse,
  type CandidateContext,
} from '../knowledge-graph/CandidateContextService';
import type { Entity, Relationship, OfficeEntity, IssueEntity } from '../knowledge-graph/types';
import {
  scoreRAGDocument,
  scoreCurrentIntel,
  scoreCandidateContext,
  scoreIssue,
  filterByRelevance,
  getMaxRelevance,
  getRelevanceReasons,
} from './RelevanceScorer';
import type { ScoredItem } from './types';
import type {
  EnrichmentContext,
  EnrichmentOptions,
  RAGContent,
  GraphContent,
  RelevanceMetadata,
  DEFAULT_ENRICHMENT_OPTIONS,
} from './types';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

// Track initialization state
let initialized = false;

/**
 * Ensure services are initialized
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  try {
    // Initialize RAG retriever
    const retriever = getDocumentRetriever();
    await retriever.initialize();

    // Initialize Knowledge Graph (populates if needed)
    const populator = getGraphPopulator();
    await populator.populate({ includePrecincts: false });

    initialized = true;
    console.log('[ContextEnrichmentService] Initialized');
  } catch (error) {
    console.error('[ContextEnrichmentService] Initialization error:', error);
    // Continue anyway - services may partially work
    initialized = true;
  }
}

/**
 * Get candidate contexts based on options
 */
async function getCandidateContexts(options: EnrichmentOptions): Promise<CandidateContext[]> {
  const contexts: CandidateContext[] = [];

  try {
    // Knowledge-graph candidate rows are Michigan/Ingham-seeded; skip for Pennsylvania deployment.
    if (
      getPoliticalRegionEnv().stateFips !== '42' &&
      options.districtType &&
      options.districtNumber
    ) {
      switch (options.districtType) {
        case 'state_house':
          contexts.push(await getStateHouseContext(options.districtNumber));
          break;
        case 'state_senate':
          contexts.push(await getStateSenateContext(options.districtNumber));
          break;
        case 'congressional':
          contexts.push(await getCongressionalContext());
          break;
      }
    }

    // For county-level or general queries, inject MI knowledge-graph reps only (seed is Ingham-specific).
    if (
      getPoliticalRegionEnv().stateFips !== '42' &&
      (options.districtType === 'county' || !options.districtType)
    ) {
      const reps = await getInghamCountyRepresentatives();

      for (const senator of reps.federal.senators) {
        if (senator.incumbent) {
          contexts.push(senator);
        }
      }
      if (reps.federal.representative) {
        contexts.push(reps.federal.representative);
      }
    }
  } catch (error) {
    console.error('[ContextEnrichmentService] Error getting candidate contexts:', error);
  }

  return contexts;
}

/**
 * Get relevant issues from Knowledge Graph
 */
function getRelevantIssues(query: string, options: EnrichmentOptions): IssueEntity[] {
  try {
    const graph = getKnowledgeGraph();
    // Use query method to get issues by type
    const result = graph.query({ entityTypes: ['issue'], limit: 20 });
    const allIssues = result.entities as IssueEntity[];

    // Score and filter issues
    const scoredIssues = allIssues.map(issue => scoreIssue(issue, query, options));
    return filterByRelevance(scoredIssues, options.relevanceThreshold || 0.3, 5);
  } catch (error) {
    console.error('[ContextEnrichmentService] Error getting issues:', error);
    return [];
  }
}

/**
 * Get relevant relationships from Knowledge Graph
 */
function getRelevantRelationships(candidateContexts: CandidateContext[]): Relationship[] {
  try {
    const graph = getKnowledgeGraph();
    const relationships: Relationship[] = [];

    for (const context of candidateContexts) {
      if (context.incumbent) {
        // Find candidate entity by name
        const candidateName = context.incumbent.name.toLowerCase().replace(/\s+/g, '-');
        const candidateId = `candidate:${candidateName}`;

        // Get endorsements and other relationships
        const connections = graph.getConnections(candidateId);
        for (const conn of connections) {
          if (conn.relationship.type === 'ENDORSED_BY' ||
              conn.relationship.type === 'SUPPORTS' ||
              conn.relationship.type === 'MEMBER_OF') {
            relationships.push(conn.relationship);
          }
        }
      }
    }

    return relationships.slice(0, 10); // Limit to 10 relationships
  } catch (error) {
    console.error('[ContextEnrichmentService] Error getting relationships:', error);
    return [];
  }
}

/**
 * Format RAG content for AI prompt
 */
function formatRAGContent(
  documents: RAGDocument[],
  currentIntel: CurrentIntelDocument[],
  citations: DataFileCitation[]
): string {
  const parts: string[] = [];

  // Add current intel first (most actionable)
  if (currentIntel.length > 0) {
    parts.push('### Current Political Intelligence\n');
    for (const intel of currentIntel) {
      const typeLabel = intel.type === 'upcoming' ? '[UPCOMING]' :
                       intel.type === 'poll' ? '[POLL]' :
                       intel.type === 'news' ? '[NEWS]' :
                       intel.type === 'analysis' ? '[ANALYSIS]' : '[INFO]';
      parts.push(`**${typeLabel} ${intel.title}**`);
      parts.push(`*Source: ${intel.source} | ${intel.published}*\n`);
    }
  }

  // Add methodology/reference docs if present
  if (documents.length > 0) {
    parts.push('\n### Reference Information\n');
    for (const doc of documents) {
      parts.push(`**${doc.title}**: ${doc.description}`);
    }
  }

  return parts.join('\n');
}

/**
 * Format graph content for AI prompt
 */
function formatGraphContent(
  candidates: CandidateContext[],
  issues: IssueEntity[],
  relationships: Relationship[]
): string {
  const parts: string[] = [];

  // Add candidate context
  if (candidates.length > 0) {
    parts.push('### Current Representatives\n');
    for (const context of candidates) {
      parts.push(formatCandidateContextForResponse(context));
      parts.push('');
    }
  }

  // Add key issues if relevant
  if (issues.length > 0) {
    parts.push('\n### Key Political Issues\n');
    for (const issue of issues) {
      const salience = issue.metadata.salience || 0;
      const salienceLabel = salience > 70 ? 'High' : salience > 40 ? 'Medium' : 'Low';
      parts.push(`- **${issue.name}** (${salienceLabel} salience)`);
    }
  }

  return parts.join('\n');
}

/**
 * Main enrichment function - call this from handlers
 */
export async function enrich(
  query: string,
  options: Partial<EnrichmentOptions> = {}
): Promise<EnrichmentContext> {
  await ensureInitialized();

  // Merge with defaults
  const opts: EnrichmentOptions = {
    intent: '',
    jurisdiction: getPoliticalRegionEnv().summaryAreaName,
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
    ...options,
  };

  // ===== RAG Retrieval =====
  let ragDocuments: RAGDocument[] = [];
  let currentIntel: CurrentIntelDocument[] = [];
  let citations: DataFileCitation[] = [];
  let ragScoredDocs: ScoredItem<RAGDocument>[] = [];
  let ragScoredIntel: ScoredItem<CurrentIntelDocument>[] = [];

  try {
    const retriever = getDocumentRetriever();
    const retrievalResult = await retriever.retrieve(query, {
      maxDocs: opts.maxRagDocs,
      maxIntel: opts.maxIntelDocs,
      jurisdiction: opts.jurisdiction,
    });

    // Score and filter RAG documents
    ragScoredDocs = retrievalResult.documents.map(doc => scoreRAGDocument(doc, query, opts));
    ragDocuments = filterByRelevance(ragScoredDocs, opts.relevanceThreshold!, opts.maxRagDocs!);

    // Score and filter current intel
    ragScoredIntel = retrievalResult.currentIntel.map(intel => scoreCurrentIntel(intel, query, opts));
    currentIntel = filterByRelevance(ragScoredIntel, opts.relevanceThreshold!, opts.maxIntelDocs!);

    citations = retrievalResult.citations;
  } catch (error) {
    console.error('[ContextEnrichmentService] RAG retrieval error:', error);
  }

  // ===== Knowledge Graph =====
  let candidateContexts: CandidateContext[] = [];
  let issues: IssueEntity[] = [];
  let relationships: Relationship[] = [];
  let offices: OfficeEntity[] = [];
  let graphScoredCandidates: ScoredItem<CandidateContext>[] = [];

  try {
    // Get candidate contexts
    const allCandidates = await getCandidateContexts(opts);
    graphScoredCandidates = allCandidates.map(c => scoreCandidateContext(c, query, opts));
    candidateContexts = filterByRelevance(graphScoredCandidates, opts.relevanceThreshold!, opts.maxGraphEntities!);

    // Get issues
    if (opts.includeIssues) {
      issues = getRelevantIssues(query, opts);
    }

    // Get relationships for included candidates
    relationships = getRelevantRelationships(candidateContexts);

    // Get office entities for included candidates
    const graph = getKnowledgeGraph();
    for (const context of candidateContexts) {
      if (context.office) {
        const officeId = `office:mi-${opts.districtType === 'state_house' ? 'house' : opts.districtType === 'state_senate' ? 'senate' : 'house'}-${context.office.district}`;
        const office = graph.getEntity(officeId) as OfficeEntity | undefined;
        if (office) {
          offices.push(office);
        }
      }
    }
  } catch (error) {
    console.error('[ContextEnrichmentService] Knowledge Graph error:', error);
  }

  // ===== Calculate Relevance =====
  const ragScore = Math.max(
    getMaxRelevance(ragScoredDocs),
    getMaxRelevance(ragScoredIntel)
  );
  const graphScore = getMaxRelevance(graphScoredCandidates);
  const overallScore = Math.max(ragScore, graphScore);
  const shouldInclude = overallScore >= opts.relevanceThreshold!;

  const reasons: string[] = [];
  if (ragDocuments.length > 0) reasons.push(`${ragDocuments.length} relevant documents`);
  if (currentIntel.length > 0) reasons.push(`${currentIntel.length} current intel items`);
  if (candidateContexts.length > 0) reasons.push(`${candidateContexts.length} candidate contexts`);
  if (issues.length > 0) reasons.push(`${issues.length} relevant issues`);
  if (reasons.length === 0) reasons.push('No relevant context found');

  // ===== Format Context =====
  const ragFormatted = formatRAGContent(ragDocuments, currentIntel, citations);
  const graphFormatted = formatGraphContent(candidateContexts, issues, relationships);

  const formattedContext = [
    ragFormatted,
    graphFormatted,
  ].filter(Boolean).join('\n\n---\n\n');

  // ===== Build Result =====
  const result: EnrichmentContext = {
    rag: {
      documents: ragDocuments,
      currentIntel,
      citations,
      formattedContext: ragFormatted,
    },
    graph: {
      candidates: candidateContexts,
      offices,
      relationships,
      issues,
      entities: [],
      formattedContext: graphFormatted,
    },
    relevance: {
      ragScore,
      graphScore,
      overallScore,
      shouldInclude,
      reasons,
    },
    formattedContext: shouldInclude ? formattedContext : '',
    timestamp: new Date().toISOString(),
  };

  console.log('[ContextEnrichmentService] Enrichment complete:', {
    ragDocs: ragDocuments.length,
    currentIntel: currentIntel.length,
    candidates: candidateContexts.length,
    issues: issues.length,
    relevance: overallScore.toFixed(2),
    shouldInclude,
  });

  return result;
}

/**
 * Quick enrichment for district analysis
 */
export async function enrichDistrictAnalysis(
  districtType: 'state_house' | 'state_senate' | 'congressional' | 'county',
  districtNumber?: string
): Promise<EnrichmentContext> {
  const query = districtNumber
    ? `${districtType.replace('_', ' ')} district ${districtNumber}`
    : districtType;

  return enrich(query, {
    districtType,
    districtNumber,
    includeCandidates: true,
    includeCurrentIntel: true,
    includeIssues: true,
    relevanceThreshold: 0.2, // Lower threshold for direct district queries
  });
}

/**
 * Quick enrichment for filter/segment queries
 * @param options.includeCurrentIntel - Set false for pure competitiveness-bucket filters so election-calendar intel does not steer the model toward invented "pre-primary" narratives unrelated to the segment.
 */
export async function enrichFilterQuery(
  query: string,
  precincts: string[],
  options?: { includeCurrentIntel?: boolean }
): Promise<EnrichmentContext> {
  return enrich(query, {
    precincts,
    includeCandidates: false, // Less relevant for filter queries
    includeCurrentIntel: options?.includeCurrentIntel ?? true,
    includeIssues: true,
    includeMethodology: query.toLowerCase().includes('how') || query.toLowerCase().includes('why'),
    relevanceThreshold: 0.4, // Higher threshold - only very relevant content
  });
}

/**
 * Quick enrichment for comparison queries
 */
export async function enrichComparison(
  query: string,
  entityA: string,
  entityB: string
): Promise<EnrichmentContext> {
  return enrich(`${query} comparing ${entityA} and ${entityB}`, {
    includeCandidates: true,
    includeCurrentIntel: true,
    includeIssues: true,
    relevanceThreshold: 0.3,
  });
}

/**
 * Format enrichment context for inclusion in AI response
 * Used by workflowHandlers to weave context into responses
 */
export function formatForResponse(context: EnrichmentContext): string {
  if (!context.relevance.shouldInclude) {
    return '';
  }

  return context.formattedContext;
}

/**
 * Format enrichment context for system prompt
 * Used by Claude API for full context injection
 */
export function formatForSystemPrompt(context: EnrichmentContext): string {
  if (!context.relevance.shouldInclude) {
    return '';
  }

  return `
## Contextual Intelligence

The following information is relevant to the user's query. Use it to provide accurate, well-informed responses.

${context.formattedContext}

## Citation Instructions

When referencing this information, use inline citations:
- [NEWS] for news items
- [POLL] for polling data
- [UPCOMING] for upcoming elections
- [ANALYSIS] for analysis pieces
`;
}

// Export singleton functions
export default {
  enrich,
  enrichDistrictAnalysis,
  enrichFilterQuery,
  enrichComparison,
  formatForResponse,
  formatForSystemPrompt,
};
