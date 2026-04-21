/**
 * Context Enrichment Module
 *
 * Provides unified context enrichment for all AI interactions,
 * combining RAG documents and Knowledge Graph entities.
 */

export {
  enrich,
  enrichDistrictAnalysis,
  enrichFilterQuery,
  enrichComparison,
  formatForResponse,
  formatForSystemPrompt,
} from './ContextEnrichmentService';

export type {
  EnrichmentContext,
  EnrichmentOptions,
  RAGContent,
  GraphContent,
  RelevanceMetadata,
  RelevanceFactors,
  ScoredItem,
} from './types';

export {
  calculateRelevanceScore,
  scoreRAGDocument,
  scoreCurrentIntel,
  scoreCandidateContext,
  scoreIssue,
  filterByRelevance,
  getMaxRelevance,
} from './RelevanceScorer';
