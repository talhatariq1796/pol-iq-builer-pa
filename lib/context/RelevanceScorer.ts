/**
 * RelevanceScorer - Calculates relevance scores for context items
 *
 * Determines which RAG documents and Knowledge Graph entities
 * are relevant to a given query, filtering out noise.
 */

import type { RAGDocument, CurrentIntelDocument } from '../rag';
import type { Entity, CandidateEntity, OfficeEntity, IssueEntity } from '../knowledge-graph/types';
import type { CandidateContext } from '../knowledge-graph/CandidateContextService';
import type { RelevanceFactors, ScoredItem, EnrichmentOptions } from './types';

/**
 * Calculate relevance score from factors
 */
export function calculateRelevanceScore(factors: RelevanceFactors): number {
  // Direct mention is highest priority
  if (factors.directMention) return 1.0;

  let score = 0;

  // District match is very important
  if (factors.districtMatch) score += 0.6;
  else if (factors.jurisdictionMatch) score += 0.4;

  // Type match indicates query intent alignment
  if (factors.typeMatch) score += 0.2;

  // Temporal relevance (recent/upcoming content)
  score += factors.temporalRelevance * 0.2;

  // Topic/keyword match
  score += factors.topicMatch * 0.2;

  return Math.min(score, 1.0);
}

/**
 * Check if query directly mentions a term
 */
function queryMentions(query: string, terms: string[]): boolean {
  const queryLower = query.toLowerCase();
  return terms.some(term => queryLower.includes(term.toLowerCase()));
}

/**
 * Calculate topic overlap between query and keywords
 */
function calculateTopicMatch(query: string, keywords: string[]): number {
  if (!keywords || keywords.length === 0) return 0;

  const queryWords = new Set(
    query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  );

  let matches = 0;
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    if (queryWords.has(keywordLower)) {
      matches++;
    } else {
      // Partial match
      for (const word of queryWords) {
        if (keywordLower.includes(word) || word.includes(keywordLower)) {
          matches += 0.5;
          break;
        }
      }
    }
  }

  return Math.min(matches / Math.max(keywords.length, 3), 1.0);
}

/**
 * Calculate temporal relevance based on date
 */
function calculateTemporalRelevance(dateStr: string | undefined, type: 'past' | 'future'): number {
  if (!dateStr) return 0.5; // Unknown date gets middle score

  const date = new Date(dateStr);
  const now = new Date();
  const daysDiff = Math.abs((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (type === 'past') {
    // Recent past is more relevant
    if (daysDiff < 7) return 1.0;
    if (daysDiff < 30) return 0.8;
    if (daysDiff < 90) return 0.6;
    if (daysDiff < 180) return 0.4;
    return 0.2;
  } else {
    // Near future is more relevant
    if (daysDiff < 30) return 1.0;
    if (daysDiff < 90) return 0.8;
    if (daysDiff < 180) return 0.6;
    if (daysDiff < 365) return 0.4;
    return 0.2;
  }
}

/**
 * Score a RAG document for relevance
 */
export function scoreRAGDocument(
  doc: RAGDocument,
  query: string,
  options: EnrichmentOptions
): ScoredItem<RAGDocument> {
  const factors: RelevanceFactors = {
    directMention: queryMentions(query, [doc.title, ...doc.keywords]),
    jurisdictionMatch: options.jurisdiction
      ? doc.keywords.some(k => k.toLowerCase().includes(options.jurisdiction!.toLowerCase()))
      : false,
    districtMatch: options.districtNumber
      ? doc.keywords.some(k => k.includes(options.districtNumber!))
      : false,
    temporalRelevance: 0.5, // Static docs have neutral temporal relevance
    topicMatch: calculateTopicMatch(query, doc.keywords),
    typeMatch: doc.category === 'methodology'
      ? (options.includeMethodology || false)
      : true,
  };

  return {
    item: doc,
    score: calculateRelevanceScore(factors),
    factors,
  };
}

/**
 * Score a current intel document for relevance
 */
export function scoreCurrentIntel(
  doc: CurrentIntelDocument,
  query: string,
  options: EnrichmentOptions
): ScoredItem<CurrentIntelDocument> {
  const factors: RelevanceFactors = {
    directMention: queryMentions(query, [doc.title, ...doc.keywords]),
    jurisdictionMatch: options.jurisdiction
      ? doc.jurisdictions.some(j => j.toLowerCase().includes(options.jurisdiction!.toLowerCase()))
      : false,
    districtMatch: options.districtNumber
      ? doc.keywords.some(k => k.includes(options.districtNumber!)) ||
        doc.jurisdictions.some(j => j.includes(options.districtNumber!))
      : false,
    temporalRelevance: doc.type === 'upcoming'
      ? calculateTemporalRelevance(doc.published, 'future')
      : calculateTemporalRelevance(doc.published, 'past'),
    topicMatch: calculateTopicMatch(query, [...doc.keywords, ...doc.relevance]),
    typeMatch: true,
  };

  return {
    item: doc,
    score: calculateRelevanceScore(factors),
    factors,
  };
}

/**
 * Score a candidate context for relevance
 */
export function scoreCandidateContext(
  context: CandidateContext,
  query: string,
  options: EnrichmentOptions
): ScoredItem<CandidateContext> {
  const candidateName = context.incumbent?.name || '';
  const officeName = context.office?.name || '';
  const district = context.office?.district || '';

  const factors: RelevanceFactors = {
    directMention: queryMentions(query, [candidateName, officeName]),
    jurisdictionMatch: options.jurisdiction
      ? officeName.toLowerCase().includes('michigan') ||
        officeName.toLowerCase().includes('ingham')
      : false,
    districtMatch: options.districtNumber
      ? district === options.districtNumber
      : false,
    temporalRelevance: context.office?.nextElection
      ? calculateTemporalRelevance(context.office.nextElection, 'future')
      : 0.5,
    topicMatch: calculateTopicMatch(query, [candidateName, officeName]),
    typeMatch: options.includeCandidates !== false,
  };

  // Boost if district type matches
  if (options.districtType && context.office?.level) {
    const levelMatches =
      (options.districtType === 'state_house' && context.office.level === 'state') ||
      (options.districtType === 'state_senate' && context.office.level === 'state') ||
      (options.districtType === 'congressional' && context.office.level === 'federal') ||
      (options.districtType === 'county' && context.office.level === 'county');
    if (levelMatches) {
      factors.typeMatch = true;
    }
  }

  return {
    item: context,
    score: calculateRelevanceScore(factors),
    factors,
  };
}

/**
 * Score an issue entity for relevance
 */
export function scoreIssue(
  issue: IssueEntity,
  query: string,
  options: EnrichmentOptions
): ScoredItem<IssueEntity> {
  const factors: RelevanceFactors = {
    directMention: queryMentions(query, [issue.name, ...(issue.metadata.keywords || [])]),
    jurisdictionMatch: true, // Issues are generally jurisdiction-agnostic
    districtMatch: false,
    temporalRelevance: 0.5,
    topicMatch: calculateTopicMatch(query, issue.metadata.keywords || []),
    typeMatch: options.includeIssues !== false,
  };

  return {
    item: issue,
    score: calculateRelevanceScore(factors),
    factors,
  };
}

/**
 * Score a generic entity for relevance
 */
export function scoreEntity(
  entity: Entity,
  query: string,
  options: EnrichmentOptions
): ScoredItem<Entity> {
  const factors: RelevanceFactors = {
    directMention: queryMentions(query, [entity.name, ...(entity.aliases || [])]),
    jurisdictionMatch: true,
    districtMatch: false,
    temporalRelevance: 0.5,
    topicMatch: 0,
    typeMatch: true,
  };

  return {
    item: entity,
    score: calculateRelevanceScore(factors),
    factors,
  };
}

/**
 * Filter and sort items by relevance threshold
 */
export function filterByRelevance<T>(
  scoredItems: ScoredItem<T>[],
  threshold: number,
  maxItems: number
): T[] {
  return scoredItems
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map(s => s.item);
}

/**
 * Get the highest relevance score from a set of scored items
 */
export function getMaxRelevance<T>(scoredItems: ScoredItem<T>[]): number {
  if (scoredItems.length === 0) return 0;
  return Math.max(...scoredItems.map(s => s.score));
}

/**
 * Get reasons for inclusion/exclusion
 */
export function getRelevanceReasons(factors: RelevanceFactors, score: number, threshold: number): string[] {
  const reasons: string[] = [];

  if (score < threshold) {
    reasons.push(`Score ${score.toFixed(2)} below threshold ${threshold}`);
    return reasons;
  }

  if (factors.directMention) {
    reasons.push('Directly mentioned in query');
  }
  if (factors.districtMatch) {
    reasons.push('Matches queried district');
  } else if (factors.jurisdictionMatch) {
    reasons.push('Matches queried jurisdiction');
  }
  if (factors.temporalRelevance > 0.7) {
    reasons.push('Temporally relevant (recent/upcoming)');
  }
  if (factors.topicMatch > 0.5) {
    reasons.push('Topic keywords match');
  }

  return reasons;
}
