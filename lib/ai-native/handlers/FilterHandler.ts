/**
 * Filter NLP Handler
 *
 * Translates natural language filter queries into map filter commands.
 * Supports queries like:
 * - "Show precincts with GOTV above 70"
 * - "Filter by swing potential"
 * - "Show only suburban areas"
 * - "Hide low-turnout precincts"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES } from './types';
import { handleFilterRequest } from '@/lib/ai/workflowHandlers';

// ============================================================================
// Query Patterns
// ============================================================================

const FILTER_PATTERNS: QueryPattern[] = [
  {
    intent: 'map_layer_change',
    patterns: [
      /filter\s+by\s+/i,
      /show\s+only\s+/i,
      /hide\s+/i,
      /precincts\s+with\s+/i,
      /precincts\s+where\s+/i,
      /areas\s+with\s+/i,
      /display\s+/i,
    ],
    keywords: ['filter', 'show', 'hide', 'only', 'with', 'where', 'display'],
    priority: 9,
  },
];

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const METRIC_PATTERNS: Record<string, RegExp> = {
  gotv: /\b(gotv|get\s*out\s*the\s*vote|turnout\s*priority)\b/i,
  persuasion: /\b(persuasion|persuadable|swing\s*voters)\b/i,
  swing: /\b(swing\s*potential|competitive|battleground)\b/i,
  turnout: /\b(turnout|voter\s*participation)\b/i,
  partisan_lean: /\b(partisan\s*lean|party\s*lean|dem|rep|democratic|republican)\b/i,
  combined: /\b(combined|overall|total\s*score)\b/i,
};

const DENSITY_PATTERNS: Record<string, RegExp> = {
  urban: /\b(urban|city|downtown|metro)\b/i,
  suburban: /\b(suburban|suburbs|outer)\b/i,
  rural: /\b(rural|country|farmland)\b/i,
};

const COMPARISON_PATTERNS = {
  above: /\b(above|greater\s*than|over|more\s*than|>\s*)\s*(\d+)/i,
  below: /\b(below|less\s*than|under|fewer\s*than|<\s*)\s*(\d+)/i,
  equals: /\b(equals?|exactly|=\s*)\s*(\d+)/i,
  between: /\bbetween\s+(\d+)\s+and\s+(\d+)/i,
};

const COMPETITIVENESS_PATTERNS: Record<string, RegExp> = {
  safe_d: /\b(safe\s*d|safely\s*democratic)\b/i,
  likely_d: /\b(likely\s*d|lean\s*democratic)\b/i,
  lean_d: /\b(lean\s*d)\b/i,
  // Do not use bare "swing" — it matches "swing areas" and overrides margin/lean queries
  toss_up: /\b(toss.?up|competitive|battleground)\b/i,
  lean_r: /\b(lean\s*r)\b/i,
  likely_r: /\b(likely\s*r|lean\s*republican)\b/i,
  safe_r: /\b(safe\s*r|safely\s*republican)\b/i,
};

// ============================================================================
// Filter Handler Class
// ============================================================================

export class FilterHandler implements NLPHandler {
  name = 'FilterHandler';
  patterns = FILTER_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return query.intent === 'map_layer_change';
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      return await this.handleFilterQuery(query, startTime);
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('apply filters'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleFilterQuery(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract filter criteria
    const criteria = this.extractFilterCriteria(query.originalQuery);

    if (!criteria.metric && !criteria.density && !criteria.competitiveness) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
        suggestedActions: [
          {
            id: 'show-metrics',
            label: 'Show Available Metrics',
            description: 'See all filterable metrics',
            action: 'What metrics can I filter by?',
            priority: 1,
          },
          {
            id: 'example-filter',
            label: 'Example Filter',
            description: 'Show GOTV priority > 70',
            action: 'Show precincts with GOTV above 70',
            priority: 2,
          },
        ],
        metadata: this.buildMetadata('map_layer_change', startTime, query),
      };
    }

    // Execute filter via workflowHandlers
    const result = await handleFilterRequest(criteria);

    // Add metadata and ensure success is set
    return {
      ...result,
      success: true,
      metadata: this.buildMetadata('map_layer_change', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  /** Used by political CSV export ID resolution — must stay aligned with handleFilterRequest. */
  extractFilterCriteria(query: string): any {
    const criteria: any = {};

    // GOTV mobilization + lower turnout — phrasing often uses "high potential" not "high GOTV"
    if (
      /\b(gotv|get\s*out\s*the\s*vote|gotv\s+efforts)\b/i.test(query) &&
      /(?:lower|low)\s*↓?\s*turnout|turnout.*(?:lower|low|below|under)/i.test(query)
    ) {
      criteria.composite = 'gotv_high_turnout_low';
      criteria.metric = 'gotv_priority';
      criteria.min_gotv_priority = /\bhigh\s+potential\b/i.test(query) ? 65 : 60;
      criteria.max_turnout = 58;
      return criteria;
    }

    // Persuadable / persuasion-opportunity lists (aligns Filter path with segment scoring)
    if (
      /\b(persuadable|persuasion\s+opportunity)\b/i.test(query) ||
      (/\bhighest\b/i.test(query) && /\b(persuad|persuasion)\b/i.test(query)) ||
      (/\bwhich\s+precincts\b/i.test(query) &&
        /\bconcentration\b/i.test(query) &&
        /\bpersuad/i.test(query))
    ) {
      criteria.metric = 'persuasion_opportunity';
      criteria.threshold = /\bhighest\b/i.test(query) ? 70 : 65;
      criteria.operator = '>=';
      return criteria;
    }

    // Modeled partisan lean on −100..+100 (SegmentEngine), distinct from presidential vote margin
    const leanBetween =
      query.match(
        /\bpartisan\s+lean\s+(?:between|from)\s+(-?\d+(?:\.\d+)?)\s+and\s+(?:\+)?(-?\d+(?:\.\d+)?)/i
      ) ||
      query.match(
        /\b(?:between|from)\s+(-?\d+(?:\.\d+)?)\s+and\s+(?:\+)?(-?\d+(?:\.\d+)?)\s+partisan\s+lean\b/i
      );
    if (leanBetween) {
      const a = parseFloat(leanBetween[1]);
      const b = parseFloat(leanBetween[2]);
      criteria.metric = 'partisan_lean';
      criteria.partisanLeanRange = [Math.min(a, b), Math.max(a, b)];
      return criteria;
    }

    const leanPlusMinus = query.match(
      /\bpartisan\s+lean\s+(?:within|of)\s*±\s*(\d+(?:\.\d+)?)\s*(?:points?)?\b/i
    );
    if (leanPlusMinus) {
      const t = Math.min(50, Math.abs(parseFloat(leanPlusMinus[1])));
      criteria.metric = 'partisan_lean';
      criteria.partisanLeanRange = [-t, t];
      return criteria;
    }

    // "Margin less than 5%" → presidential |Dem−Rep| margin (2024/2020), aligned with chat CSV export
    const marginLt =
      query.match(/\bmargin\s+(?:less than|under|below)\s*(\d+(?:\.\d+)?)\s*%?/i) ||
      query.match(/\b(?:less than|under)\s*(\d+(?:\.\d+)?)\s*%?\s*margin\b/i);
    if (marginLt) {
      criteria.metric = 'margin';
      criteria.threshold = parseFloat(marginLt[1]);
      criteria.operator = 'less_than';
      criteria.marginMode = 'presidential_margin';
    }

    // Extract metric
    for (const [metric, pattern] of Object.entries(METRIC_PATTERNS)) {
      if (pattern.test(query)) {
        criteria.metric = metric;
        break;
      }
    }

    // Extract density
    for (const [density, pattern] of Object.entries(DENSITY_PATTERNS)) {
      if (pattern.test(query)) {
        if (!criteria.density) criteria.density = [];
        criteria.density.push(density);
      }
    }

    // Extract competitiveness (skip if we already resolved a tight-margin partisan-lean query)
    if (!criteria.marginMode) {
      for (const [comp, pattern] of Object.entries(COMPETITIVENESS_PATTERNS)) {
        if (pattern.test(query)) {
          if (!criteria.competitiveness) criteria.competitiveness = [];
          criteria.competitiveness.push(comp);
        }
      }
    }

    // Extract threshold
    const aboveMatch = query.match(COMPARISON_PATTERNS.above);
    if (aboveMatch) {
      criteria.threshold = parseInt(aboveMatch[2]);
      criteria.operator = '>=';
    }

    const belowMatch = query.match(COMPARISON_PATTERNS.below);
    if (belowMatch) {
      criteria.threshold = parseInt(belowMatch[2]);
      criteria.operator = '<=';
    }

    const equalsMatch = query.match(COMPARISON_PATTERNS.equals);
    if (equalsMatch) {
      criteria.threshold = parseInt(equalsMatch[2]);
      criteria.operator = '=';
    }

    const betweenMatch = query.match(COMPARISON_PATTERNS.between);
    if (betweenMatch) {
      criteria.minThreshold = parseInt(betweenMatch[1]);
      criteria.maxThreshold = parseInt(betweenMatch[2]);
      criteria.operator = 'between';
    }

    // Detect "high" or "low" modifiers
    // GOTV scores often cluster well below 70 statewide; 70 here yields 0 matches. Use 50 for implicit
    // "high GOTV" (aligns with VAN-style tiers / presets that use lower floors than 70).
    if (/\bhigh\b/i.test(query) && !criteria.threshold) {
      criteria.threshold = criteria.metric === 'gotv' ? 50 : 70;
      criteria.operator = '>=';
    }

    if (/\blow\b/i.test(query) && !criteria.threshold) {
      criteria.threshold = 40;
      criteria.operator = '<=';
    }

    const metricAliases: Record<string, string> = {
      gotv: 'gotv_priority',
      swing: 'swing_potential',
      persuasion: 'persuasion_opportunity',
      combined: 'combined_score',
    };
    if (criteria.metric && metricAliases[criteria.metric]) {
      criteria.metric = metricAliases[criteria.metric];
    }

    return criteria;
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(
    intent: string,
    startTime: number,
    query: ParsedQuery
  ): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'filter',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const filterHandler = new FilterHandler();

/** Same criteria object as the map filter / segment query path (for export ID resolution). */
export function extractFilterCriteriaFromUserQuery(query: string): any {
  return filterHandler.extractFilterCriteria(query);
}

export default FilterHandler;
