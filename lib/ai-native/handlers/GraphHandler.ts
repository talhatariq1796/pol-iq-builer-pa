/**
 * Graph NLP Handler
 *
 * Translates natural language knowledge graph queries into graph operations.
 * Supports queries like:
 * - "Show knowledge graph"
 * - "Explore connections for Slotkin"
 * - "What connects Gary Peters to East Lansing?"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, getEnrichmentForQuery, formatEnrichmentSections } from './types';
import {
  handleGraphQuery,
  handleGraphExploration,
  handleFindPath,
} from '@/lib/ai/workflowHandlers';

// ============================================================================
// Query Patterns
// ============================================================================

const GRAPH_PATTERNS: QueryPattern[] = [
  {
    intent: 'graph_query',
    patterns: [
      /show\s+(?:me\s+)?(?:the\s+)?knowledge\s+graph/i,
      /what(?:'s|\s+is)\s+in\s+the\s+(?:knowledge\s+)?graph/i,
      /graph\s+overview/i,
      /knowledge\s+graph\s+stats/i,
      /show\s+(?:me\s+)?(?:the\s+)?graph/i,
      /view\s+knowledge\s+graph/i,
      /list\s+(?:all\s+)?(?:entities|relationships)/i,
    ],
    keywords: ['graph', 'knowledge', 'overview', 'stats', 'entities', 'relationships'],
    priority: 10,
  },
  {
    intent: 'graph_explore',
    patterns: [
      /explore\s+(?:connections?\s+(?:for|of)\s+)?(.+)/i,
      // Removed overly broad "show me" pattern - was catching non-graph queries
      /show\s+(?:me\s+)?(?:the\s+)?(?:connections?|relationships?)\s+(?:for|of)\s+(.+)/i,
      /what\s+(?:is|are)\s+(.+?)\s+connected\s+to/i,
      /(?:connections?|relationships?)\s+(?:for|of)\s+(.+)/i,
      /show\s+(?:me\s+)?(?:the\s+)?node\s+(?:for\s+)?(.+)/i,
      /node\s+details?\s+(?:for\s+)?(.+)/i,
      /who\s+is\s+(.+?)\s+connected\s+to/i,
    ],
    keywords: ['explore', 'connections', 'relationships', 'connected', 'node', 'details'],
    priority: 9,
  },
  {
    intent: 'graph_explore',
    patterns: [
      /what\s+connects\s+(.+?)\s+(?:to|and)\s+(.+)/i,
      /(?:find\s+)?path\s+(?:from\s+)?(.+?)\s+to\s+(.+)/i,
      /how\s+(?:is|are)\s+(.+?)\s+(?:connected\s+to|related\s+to)\s+(.+)/i,
      /relationship\s+between\s+(.+?)\s+and\s+(.+)/i,
    ],
    keywords: ['connects', 'path', 'between', 'related'],
    priority: 10,
  },
];

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const ENTITY_NAME_PATTERN = /(?:for|of|to)\s+(.+?)(?:\s+and|\s+to|$)/i;
const PATH_PATTERN = /(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\s|$)/i;

// ============================================================================
// Graph Handler Class
// ============================================================================

export class GraphHandler implements NLPHandler {
  name = 'GraphHandler';
  patterns = GRAPH_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'graph_query' ||
      query.intent === 'graph_explore'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'graph_query':
          return await this.handleGraphQueryIntent(query, startTime);

        case 'graph_explore':
          return await this.handleGraphExploreIntent(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown graph intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('query knowledge graph'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleGraphQueryIntent(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    try {
      // Check if this is a general overview request
      if (
        /overview|stats|what.*in.*graph/i.test(query.originalQuery) ||
        query.originalQuery.toLowerCase().includes('show graph')
      ) {
        const result = await handleGraphQuery({
          queryType: 'overview',
        });

        // Get enrichment context (RAG + Knowledge Graph)
        const enrichment = await getEnrichmentForQuery(query.originalQuery);
        const enrichmentSections = formatEnrichmentSections(enrichment);

        return {
          ...result,
          response: result.response + enrichmentSections,
          success: true,
          metadata: this.buildMetadata('graph_overview', startTime, query),
        };
      }

      // Default to intro message
      const result = await handleGraphQuery();

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections = formatEnrichmentSections(enrichment);

      return {
        ...result,
        response: result.response + enrichmentSections,
        success: true,
        metadata: this.buildMetadata('graph_intro', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load knowledge graph data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleGraphExploreIntent(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    try {
      // Check if this is a path query (connecting two entities)
      const pathMatch = query.originalQuery.match(PATH_PATTERN);
      if (pathMatch) {
        const sourceName = pathMatch[1].trim();
        const targetName = pathMatch[2].trim();

        const result = await handleFindPath({
          sourceName,
          targetName,
          maxDepth: 5,
        });

        // Get enrichment context (RAG + Knowledge Graph)
        const enrichmentPath = await getEnrichmentForQuery(query.originalQuery);
        const enrichmentPathSections = formatEnrichmentSections(enrichmentPath);

        return {
          ...result,
          response: result.response + enrichmentPathSections,
          success: true,
          metadata: this.buildMetadata('graph_path', startTime, query),
        };
      }

      // Extract entity name from query
      const entities = this.extractEntities(query.originalQuery);
      const entityName = entities.candidates?.[0] || this.extractEntityName(query.originalQuery);

      if (!entityName) {
        return {
          success: false,
          response: 'Please specify an entity to explore. For example: "Explore connections for Slotkin"',
          suggestedActions: [
            {
              id: 'graph-overview',
              label: 'Show graph overview',
              action: 'Show me the knowledge graph overview',
              icon: 'share-2',
            },
            {
              id: 'list-candidates',
              label: 'List candidates',
              action: 'List all candidates',
              icon: 'users',
            },
          ],
        };
      }

      // Call handleGraphExploration
      const result = await handleGraphExploration({
        entityName,
        maxDepth: 2,
      });

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections = formatEnrichmentSections(enrichment);

      return {
        ...result,
        response: result.response + enrichmentSections,
        success: true,
        metadata: this.buildMetadata('graph_explore', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to explore knowledge graph connections. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract candidate names (common patterns)
    const candidatePatterns = [
      /slotkin/i,
      /rogers/i,
      /gary\s+peters/i,
      /debbie\s+stabenow/i,
      /trump/i,
      /biden/i,
      /harris/i,
    ];

    const candidates: string[] = [];
    for (const pattern of candidatePatterns) {
      const match = query.match(pattern);
      if (match) {
        candidates.push(match[0]);
      }
    }

    if (candidates.length > 0) {
      entities.candidates = candidates;
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private extractEntityName(query: string): string | null {
    // Try to extract entity name from common patterns
    const patterns = [
      /(?:for|of)\s+(.+?)(?:\s*$|\s+connections?|\s+relationships?)/i,
      /explore\s+(.+?)(?:\s*$|\s+connections?)/i,
      /show\s+(?:me\s+)?(.+?)(?:\s*$|\s+connections?|\s+relationships?)/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'graph',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const graphHandler = new GraphHandler();

export default GraphHandler;
