/**
 * Tool Orchestrator
 *
 * Central dispatcher that parses natural language queries and routes them
 * to the appropriate NLP handler. Provides the bridge between user queries
 * and the underlying tool engines.
 *
 * Workflow:
 * 1. Receive natural language query
 * 2. Parse to extract intent and entities
 * 3. Route to appropriate handler
 * 4. Return formatted response with map commands and suggested actions
 */

import type {
  ParsedQuery,
  QueryIntent,
  ExtractedEntities,
  HandlerResult,
  QueryPattern,
  NLPHandler,
  HandlerContext,
} from './types';
import { RESPONSE_TEMPLATES } from './types';

import { segmentationHandler } from './SegmentationHandler';
import { reportHandler } from './ReportHandler';
import { comparisonHandler } from './ComparisonHandler';
import { districtHandler } from './DistrictHandler';
import { graphHandler } from './GraphHandler';
import { spatialHandler } from './SpatialHandler';
import { filterHandler } from './FilterHandler';
import { navigationHandler } from './NavigationHandler';
import { trendHandler } from './TrendHandler';
import { generalHandler } from './GeneralHandler';
import { candidateHandler } from './CandidateHandler';
import { issueHandler } from './IssueHandler';
import { electionResultsHandler } from './ElectionResultsHandler';
import { dataExportHandler } from './DataExportHandler';
import { getPollHandler } from './PollHandler';
import { scenarioHandler } from './ScenarioHandler';
import { enhanceResponse, shouldEnhance } from '../ResponseEnhancer';

// Initialize poll handler
const pollHandler = getPollHandler();

// ============================================================================
// Query Parser
// ============================================================================

/**
 * Parses natural language queries into structured ParsedQuery objects
 */
export class QueryParser {
  private handlers: NLPHandler[];

  constructor(handlers: NLPHandler[]) {
    this.handlers = handlers;
  }

  // Enable detailed debug logging (set via DEBUG_QUERY_ROUTING env or code)
  private debugMode = typeof process !== 'undefined' && process.env.DEBUG_QUERY_ROUTING === 'true';

  /**
   * Parse a natural language query
   */
  parse(query: string): ParsedQuery {
    const normalizedQuery = query.trim().toLowerCase();
    let bestMatch: { intent: QueryIntent; confidence: number; handler?: string } = {
      intent: 'unknown',
      confidence: 0,
    };

    // Track all matches for debug logging
    const allMatches: Array<{ intent: QueryIntent; confidence: number; handler: string }> = [];

    // Check each handler's patterns
    for (const handler of this.handlers) {
      for (const pattern of handler.patterns) {
        const matchScore = this.scorePattern(normalizedQuery, pattern);

        if (matchScore > 0) {
          allMatches.push({
            intent: pattern.intent,
            confidence: matchScore,
            handler: handler.name,
          });
        }

        if (matchScore > bestMatch.confidence) {
          bestMatch = {
            intent: pattern.intent,
            confidence: matchScore,
            handler: handler.name,
          };
        }
      }
    }

    // Debug: Log top 5 matches if debug mode enabled
    if (this.debugMode && allMatches.length > 0) {
      const topMatches = allMatches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .map(m => `${m.intent}(${m.confidence.toFixed(3)})`);
      console.log(`[QueryParser] Top matches for "${normalizedQuery.substring(0, 50)}...": ${topMatches.join(', ')}`);
    }

    // Extract entities based on detected intent
    const entities = this.extractEntities(query, bestMatch.intent);

    return {
      originalQuery: query,
      intent: bestMatch.intent,
      entities,
      confidence: bestMatch.confidence,
    };
  }

  /**
   * Score how well a query matches a pattern
   */
  private scorePattern(query: string, pattern: QueryPattern): number {
    let score = 0;

    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(query)) {
        score += 0.5;
        break;
      }
    }

    // Check keywords
    const keywordMatches = pattern.keywords.filter((kw) =>
      query.includes(kw.toLowerCase())
    );
    score += (keywordMatches.length / pattern.keywords.length) * 0.5;

    // Apply priority weighting
    score *= pattern.priority / 10;

    return Math.min(score, 1);
  }

  /**
   * Extract entities based on intent
   */
  private extractEntities(query: string, intent: QueryIntent): ExtractedEntities {
    // Delegate to the appropriate handler for entity extraction
    for (const handler of this.handlers) {
      if (handler.canHandle({ originalQuery: query, intent, entities: {}, confidence: 1 })) {
        if ('extractEntities' in handler && typeof handler.extractEntities === 'function') {
          return (handler as any).extractEntities(query);
        }
      }
    }

    return {};
  }
}

// ============================================================================
// Tool Orchestrator
// ============================================================================

export class ToolOrchestrator {
  private static instance: ToolOrchestrator;

  private handlers: NLPHandler[];
  private parser: QueryParser;

  private constructor() {
    // Register all handlers
    // Order matters: more specific handlers first, generalHandler last as fallback
    this.handlers = [
      // Domain-specific handlers (high priority)
      segmentationHandler,
      reportHandler,
      comparisonHandler,
      districtHandler,

      // New domain handlers
      candidateHandler,
      issueHandler,
      electionResultsHandler,
      dataExportHandler,

      // Analysis & visualization handlers
      graphHandler,
      spatialHandler,
      filterHandler,
      trendHandler,
      pollHandler,

      // Scenario modeling handler (GAP 4 fix)
      scenarioHandler,

      // Navigation handler
      navigationHandler,

      // Fallback handler (must be last)
      generalHandler,
    ];

    this.parser = new QueryParser(this.handlers);
  }

  static getInstance(): ToolOrchestrator {
    if (!ToolOrchestrator.instance) {
      ToolOrchestrator.instance = new ToolOrchestrator();
    }
    return ToolOrchestrator.instance;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Process a natural language query with optional context
   * GAP 1 Fix: Context enables handlers to provide state-aware responses
   */
  async process(query: string, context?: HandlerContext): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      // Parse the query
      const parsed = this.parser.parse(query);

      // Log for debugging - show detailed query routing
      console.log('[ToolOrchestrator] Query routing:', {
        query: query.substring(0, 80) + (query.length > 80 ? '...' : ''),
        matchedIntent: parsed.intent,
        confidence: parsed.confidence.toFixed(3),
        entityCount: Object.keys(parsed.entities).length,
        hasContext: !!context,
      });

      // Check confidence threshold - GAP 5: surface confidence to user
      if (parsed.confidence < 0.2) {
        return this.handleLowConfidence(query, parsed);
      }

      // Find and execute handler
      const handler = this.findHandler(parsed);

      if (!handler) {
        return this.handleNoHandler(query, parsed);
      }

      // Execute handler with context (GAP 1 fix)
      let result = await handler.handle(parsed, context);

      // Principles 5, 10, 14: Enhance response with adaptive communication,
      // emotional intelligence, and "so what" framing
      if (shouldEnhance(result)) {
        result = enhanceResponse(result, query, parsed.intent);
      }

      // Add orchestrator metadata with confidence info (GAP 5)
      result.metadata = {
        handlerName: result.metadata?.handlerName || handler.name,
        processingTimeMs: result.metadata?.processingTimeMs || 0,
        queryType: result.metadata?.queryType || 'unknown',
        matchedIntent: result.metadata?.matchedIntent || parsed.intent,
        confidence: result.metadata?.confidence || parsed.confidence,
        orchestratorTime: Date.now() - startTime,
        parsedIntent: parsed.intent,
        parsedConfidence: parsed.confidence,
        contextProvided: !!context,
      };

      // GAP 5: Add confidence indicator to response if moderately uncertain
      const skipConfidenceNote =
        parsed.intent === 'segment_find' ||
        parsed.intent === 'segment_create' ||
        parsed.intent === 'map_layer_change';
      if (
        !skipConfidenceNote &&
        parsed.confidence < 0.6 &&
        parsed.confidence >= 0.2 &&
        result.success
      ) {
        const confidenceNote =
          parsed.confidence < 0.4
            ? `\n\n*Note: I'm ${Math.round(parsed.confidence * 100)}% confident this is what you meant. Let me know if you'd like something different.*`
            : '';
        result.response = result.response + confidenceNote;
      }

      return result;
    } catch (error) {
      console.error('[ToolOrchestrator] Error:', error);

      // GAP 2: Use enhanced error templates with recovery suggestions
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution(
          'process your request',
          errorMessage,
          'Try rephrasing your question or use one of the suggested actions below.'
        ),
        error: errorMessage,
        suggestedActions: this.getDefaultActions(),
      };
    }
  }

  /**
   * Check if query can be handled by any tool
   */
  canHandle(query: string): boolean {
    const parsed = this.parser.parse(query);
    return parsed.intent !== 'unknown' && parsed.confidence >= 0.2;
  }

  /**
   * Get available handlers
   */
  getHandlers(): string[] {
    return this.handlers.map((h) => h.name);
  }

  /**
   * Get supported intents
   */
  getSupportedIntents(): QueryIntent[] {
    const intents = new Set<QueryIntent>();

    for (const handler of this.handlers) {
      for (const pattern of handler.patterns) {
        intents.add(pattern.intent);
      }
    }

    return Array.from(intents);
  }

  // --------------------------------------------------------------------------
  // Handler Management
  // --------------------------------------------------------------------------

  /**
   * Register a new handler
   */
  registerHandler(handler: NLPHandler): void {
    this.handlers.push(handler);
    this.parser = new QueryParser(this.handlers);
  }

  /**
   * Find handler for parsed query
   */
  private findHandler(parsed: ParsedQuery): NLPHandler | null {
    for (const handler of this.handlers) {
      if (handler.canHandle(parsed)) {
        return handler;
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Fallback Handling
  // --------------------------------------------------------------------------

  private handleLowConfidence(query: string, parsed: ParsedQuery): HandlerResult {
    const suggestions = this.generateQuerySuggestions(query);

    return {
      success: true,
      response: [
        `I'm not quite sure what you're asking. Here are some things I can help with:`,
        '',
        '**Segmentation:**',
        '- "Find suburban swing precincts"',
        '- "Build a segment of high GOTV areas"',
        '',
        '**Districts:**',
        '- "Analyze State House District 73"',
        '- "Compare districts 73 and 74"',
        '- "What precincts are in Senate 21?"',
        '',
        '**Trends:**',
        '- "Show turnout trends since 2020"',
        '- "How has partisan lean changed?"',
        '- "Which districts might flip?"',
        '',
        '**Reports:**',
        '- "Generate a profile for East Lansing"',
        '- "Create a campaign briefing"',
      ].join('\n'),
      suggestedActions: suggestions,
      metadata: {
        handlerName: 'ToolOrchestrator',
        processingTimeMs: 0,
        queryType: 'fallback',
        matchedIntent: 'unknown',
        confidence: parsed.confidence,
      },
    };
  }

  private handleNoHandler(query: string, parsed: ParsedQuery): HandlerResult {
    return {
      success: false,
      response: `I understood you want to "${parsed.intent.replace(/_/g, ' ')}" but that capability isn't fully implemented yet. Try one of the suggested actions instead.`,
      suggestedActions: this.getDefaultActions(),
      error: `No handler for intent: ${parsed.intent}`,
    };
  }

  private generateQuerySuggestions(query: string): any[] {
    // Suggest based on keywords in query
    const suggestions: any[] = [];

    if (/precinct|area|target|find/i.test(query)) {
      suggestions.push({
        id: 'try-segment',
        label: 'Find Target Precincts',
        description: 'Search for precincts matching criteria',
        action: 'segment_find',
        priority: 1,
      });
    }

    if (/report|profile|pdf|document/i.test(query)) {
      suggestions.push({
        id: 'try-report',
        label: 'Generate Report',
        description: 'Create analysis report',
        action: 'report_generate',
        priority: 1,
      });
    }

    if (/district|house|senate|congressional/i.test(query)) {
      suggestions.push({
        id: 'try-district',
        label: 'Analyze District',
        description: 'View district details',
        action: 'district_analysis',
        priority: 1,
      });
    }

    if (/trend|history|over time|change|flip/i.test(query)) {
      suggestions.push({
        id: 'try-trends',
        label: 'View Trends',
        description: 'Analyze historical patterns',
        action: 'election_trends',
        priority: 1,
      });
    }

    // Always include some defaults
    if (suggestions.length === 0) {
      return this.getDefaultActions();
    }

    return suggestions.slice(0, 4);
  }

  private getDefaultActions(): any[] {
    return [
      {
        id: 'find-targets',
        label: 'Find Target Precincts',
        description: 'Identify high-priority areas',
        action: 'segment_find',
        priority: 1,
      },
      {
        id: 'generate-report',
        label: 'Generate Report',
        description: 'Create analysis document',
        action: 'report_generate',
        priority: 4,
      },
    ];
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Process a query using the singleton orchestrator
 * Accepts optional context for state-aware responses (GAP 1 fix)
 */
export async function processQuery(query: string, context?: HandlerContext): Promise<HandlerResult> {
  return ToolOrchestrator.getInstance().process(query, context);
}

/**
 * Check if a query can be handled
 */
export function canHandleQuery(query: string): boolean {
  return ToolOrchestrator.getInstance().canHandle(query);
}

// ============================================================================
// Singleton Export
// ============================================================================

export const toolOrchestrator = ToolOrchestrator.getInstance();

export default ToolOrchestrator;
