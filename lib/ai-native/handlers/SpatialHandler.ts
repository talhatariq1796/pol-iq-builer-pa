/**
 * Spatial Query NLP Handler
 *
 * Translates natural language spatial queries into map visualizations.
 * Supports queries like:
 * - "What's near East Lansing?"
 * - "Show nearby precincts"
 * - "Highlight these areas on the map"
 * - "Switch to heatmap view"
 * - "Zoom to Lansing"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, getEnrichmentForQuery, formatEnrichmentSections } from './types';
import type { MapCommand } from '@/lib/ai-native/types';
import { getDefaultPoliticalJurisdictionLabel } from '@/lib/political/politicalRegionConfig';

// ============================================================================
// Query Patterns
// ============================================================================

const SPATIAL_PATTERNS: QueryPattern[] = [
  {
    intent: 'spatial_query',
    patterns: [
      /what'?s?\s+near(?:by)?/i,
      /show\s+(?:me\s+)?(?:what'?s?\s+)?near(?:by)?/i,
      /in\s+(?:the\s+)?(?:area|vicinity|region)/i,
      /(?:within|around)\s+\d+\s*(?:mile|km|mi)/i,
      /surrounding\s+(?:area|precincts)/i,
      /close\s+to/i,
      /adjacent\s+to/i,
      /(?:find|show|get)\s+(?:\w+\s+)?near\s+/i, // "find precincts near X", "show areas near X"
      /precincts?\s+near\s+/i, // "precincts near Lansing"
    ],
    keywords: ['near', 'nearby', 'around', 'area', 'vicinity', 'surrounding', 'close', 'adjacent'],
    priority: 8,
  },
  {
    intent: 'map_click',
    patterns: [
      /clicked?\s+(?:on\s+)?(?:the\s+)?(?:precinct|area|district)/i,
      /selected?\s+(?:the\s+)?(?:precinct|area)/i,
      /tell\s+me\s+about\s+(?:this|that)\s+(?:precinct|area)/i,
      /what\s+is\s+(?:this|that)\s+(?:precinct|area)/i,
    ],
    keywords: ['clicked', 'selected', 'tell', 'about', 'this', 'that'],
    priority: 7,
  },
  {
    intent: 'map_selection',
    patterns: [
      /selected?\s+area/i,
      /drew\s+(?:a\s+)?(?:boundary|area|shape)/i,
      /made\s+(?:a\s+)?selection/i,
      /these\s+precincts/i,
      /analyze\s+(?:this|the)\s+(?:area|selection)/i,
    ],
    keywords: ['selected', 'drew', 'boundary', 'area', 'analyze', 'selection'],
    priority: 7,
  },
  {
    intent: 'map_zoom',
    patterns: [
      /zoom\s+(?:in\s+)?(?:to|on)/i,
      /center\s+(?:the\s+map\s+)?on/i,
      /focus\s+on/i,
      /fly\s+to/i,
      /go\s+to/i,
      /navigate\s+to/i,
    ],
    keywords: ['zoom', 'center', 'focus', 'fly', 'go', 'navigate'],
    priority: 6,
  },
  {
    intent: 'map_highlight',
    patterns: [
      /highlight\s+(?:these\s+)?precincts?/i,
      /show\s+(?:me\s+)?(?:these\s+)?(?:precincts?|areas?)\s+on\s+(?:the\s+)?map/i,
      /mark\s+(?:these\s+)?precincts?/i,
      /emphasize\s+(?:these\s+)?(?:precincts?|areas?)/i,
    ],
    keywords: ['highlight', 'show', 'mark', 'emphasize', 'map'],
    priority: 6,
  },
  {
    intent: 'map_layer_change',
    patterns: [
      /(?:switch|change)\s+(?:to\s+)?(?:heatmap|choropleth)/i,
      /show\s+(?:a\s+)?(?:heatmap|choropleth)/i,
      /visualize\s+(?:as\s+)?(?:heatmap|choropleth)/i,
      /display\s+(?:as\s+)?(?:heatmap|choropleth)/i,
      /turn\s+on\s+(?:heatmap|choropleth)/i,
    ],
    keywords: ['switch', 'change', 'heatmap', 'choropleth', 'visualize', 'display', 'layer'],
    priority: 7,
  },
];

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const LOCATION_PATTERNS = [
  /\b(lansing|east\s+lansing|meridian|delhi|williamston|mason|okemos|haslett)\b/i,
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:precinct|district|township|city)/i,
];

const DISTANCE_PATTERNS = [
  /(?:within|around)\s+(\d+(?:\.\d+)?)\s*(mile|km|mi|miles|kilometers)/i,
];

const METRIC_PATTERNS: Record<string, RegExp> = {
  swing_potential: /\b(swing|competitive|battleground)\b/i,
  gotv_priority: /\b(gotv|get.?out.?the.?vote|turnout|mobiliz)/i,
  persuasion_opportunity: /\b(persuad|persuasion|undecided)\b/i,
  partisan_lean: /\b(partisan|lean|democratic|republican|d\+|r\+)/i,
  combined_score: /\b(combined|overall|composite|target)/i,
  turnout: /\b(turnout|participation|voting.?rate)/i,
};

const VISUALIZATION_PATTERNS = {
  heatmap: /\b(heatmap|heat.?map|density|h3)\b/i,
  choropleth: /\b(choropleth|boundary|precinct.?map|fill|color.?coded)/i,
  bivariate: /\b(bivariate|two.?metric|dual)\b/i,
  proportional: /\b(proportional|bubble|circle|size)\b/i,
};

// ============================================================================
// Spatial Handler Class
// ============================================================================

export class SpatialHandler implements NLPHandler {
  name = 'SpatialHandler';
  patterns = SPATIAL_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    // Note: map_layer_change is handled by FilterHandler specifically
    return (
      query.intent === 'spatial_query' ||
      query.intent === 'map_click' ||
      query.intent === 'map_selection' ||
      query.intent === 'map_zoom' ||
      query.intent === 'map_highlight'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'spatial_query':
          return await this.handleSpatialQuery(query, startTime);

        case 'map_click':
          return await this.handleMapClick(query, startTime);

        case 'map_selection':
          return await this.handleMapSelection(query, startTime);

        case 'map_zoom':
          return await this.handleMapZoom(query, startTime);

        case 'map_highlight':
          return await this.handleMapHighlight(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown spatial intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process spatial query'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleSpatialQuery(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Extract location and distance
    const location = entities.jurisdictions?.[0] || getDefaultPoliticalJurisdictionLabel();
    const distance = this.extractDistance(query.originalQuery);

    let response = `Analyzing areas near **${location}**`;
    if (distance) {
      response += ` within **${distance.value} ${distance.unit}**`;
    }
    response += '.\n\n';

    // If no specific location, provide context-aware help
    if (!entities.jurisdictions || entities.jurisdictions.length === 0) {
      response +=
        '💡 *Tip: Specify a location for more precise results, like "What\'s near Pittsburgh?" or "Show precincts within 5 miles of Harrisburg"*\n\n';
    }

    response += 'Use the map to:\n';
    response += '- Click any precinct to see details\n';
    response += '- Draw a custom area to analyze multiple precincts\n';
    response += '- Switch to heatmap view to see patterns\n';

    const mapCommands: MapCommand[] = [];

    // If location specified, zoom to it
    if (entities.jurisdictions && entities.jurisdictions.length > 0) {
      mapCommands.push({
        type: 'flyTo',
        target: entities.jurisdictions[0],
      });
    }

    // Show buffer if distance specified
    if (distance && entities.jurisdictions && entities.jurisdictions.length > 0) {
      mapCommands.push({
        type: 'showBuffer',
        target: entities.jurisdictions[0],
        data: {
          radiusMiles: distance.unit === 'km' ? distance.value * 0.621371 : distance.value,
        },
      });
    }

    // Get enrichment context (RAG + Knowledge Graph)
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      mapCommands,
      suggestedActions: [
        {
          id: 'show-nearby',
          label: 'Show nearby precincts',
          description: 'Highlight precincts in this area',
          action: 'map:showChoropleth',
          priority: 1,
        },
        {
          id: 'analyze-demographics',
          label: 'Analyze demographics',
          description: 'See demographic breakdown',
          action: 'Show demographic analysis for this area',
          priority: 2,
        },
        {
          id: 'heatmap-view',
          label: 'Switch to heatmap',
          description: 'See patterns across the area',
          action: 'map:showHeatmap',
          metadata: { metric: 'swing_potential' },
          priority: 3,
        },
      ],
      metadata: this.buildMetadata('spatial_query', startTime, query),
    };
  }

  private async handleMapClick(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const precinct = entities.precincts?.[0] || entities.jurisdictions?.[0] || 'this precinct';

    const response = `You've selected **${precinct}**.\n\n` +
      `I'll show you:\n` +
      `- Electoral performance and partisan lean\n` +
      `- Demographics and voter profile\n` +
      `- Targeting scores (GOTV, Persuasion, Swing)\n` +
      `What would you like to explore?`;

    const mapCommands: MapCommand[] = [];

    // Highlight the clicked precinct
    if (entities.precincts && entities.precincts.length > 0) {
      mapCommands.push({
        type: 'highlight',
        target: entities.precincts,
      });
    }

    // Get enrichment context (RAG + Knowledge Graph)
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      mapCommands,
      suggestedActions: [
        {
          id: 'see-details',
          label: 'See full demographics',
          description: 'Detailed demographic breakdown',
          action: `Tell me more about ${precinct}`,
          priority: 1,
        },
        {
          id: 'find-similar',
          label: 'Find similar precincts',
          description: 'Precincts with similar characteristics',
          action: `Find precincts similar to ${precinct}`,
          priority: 2,
        },
      ],
      metadata: this.buildMetadata('map_click', startTime, query),
    };
  }

  private async handleMapSelection(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const areaName = entities.jurisdictions?.[0] || 'selected area';

    const response = `Analyzing **${areaName}**.\n\n` +
      `This area includes multiple precincts. I can help you:\n` +
      `- See aggregate voter statistics\n` +
      `- Identify targeting priorities\n` +
      `- Generate a comprehensive report\n\n` +
      `What would you like to know?`;

    const mapCommands: MapCommand[] = [
      {
        type: 'showChoropleth',
      },
    ];

    // Get enrichment context (RAG + Knowledge Graph)
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      mapCommands,
      suggestedActions: [
        {
          id: 'spatial-analysis',
          label: 'Analyze spatial patterns',
          description: 'See geographic clusters and efficiency',
          action: 'Analyze spatial patterns in this area',
          priority: 1,
        },
        {
          id: 'create-segment',
          label: 'Save as segment',
          description: 'Save these precincts for later',
          action: 'output:saveSegment',
          priority: 2,
        },
        {
          id: 'generate-report',
          label: 'Generate report',
          description: 'Comprehensive analysis PDF',
          action: 'output:generateReport',
          priority: 4,
        },
      ],
      metadata: this.buildMetadata('map_selection', startTime, query),
    };
  }

  private async handleMapZoom(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const location = entities.jurisdictions?.[0] || entities.precincts?.[0];

    if (!location) {
      return {
        success: false,
        response: 'Please specify a location to zoom to (e.g., "Zoom to East Lansing" or "Center on Mason").',
        suggestedActions: [
          {
            id: 'zoom-lansing',
            label: 'Zoom to Lansing',
            action: 'map:flyTo',
            metadata: { target: 'Lansing' },
            priority: 1,
          },
          {
            id: 'zoom-county',
            label: 'View full county',
            action: 'map:flyTo',
            metadata: { target: 'Ingham County' },
            priority: 2,
          },
        ],
        metadata: this.buildMetadata('map_zoom', startTime, query),
      };
    }

    const response = `Navigating to **${location}**...`;

    const mapCommands: MapCommand[] = [
      {
        type: 'flyTo',
        target: location,
      },
    ];

    return {
      success: true,
      response,
      mapCommands,
      suggestedActions: [
        {
          id: 'show-details',
          label: 'Show details',
          description: 'See precinct information',
          action: `Tell me about ${location}`,
          priority: 1,
        },
        {
          id: 'nearby-analysis',
          label: 'Analyze nearby areas',
          description: 'Explore surrounding precincts',
          action: `What's near ${location}?`,
          priority: 2,
        },
      ],
      metadata: this.buildMetadata('map_zoom', startTime, query),
    };
  }

  private async handleMapHighlight(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const precincts = entities.precincts || [];

    if (precincts.length === 0) {
      return {
        success: false,
        response: 'Please specify which precincts to highlight (e.g., "Highlight East Lansing P1 and P2").',
        suggestedActions: [
          {
            id: 'select-map',
            label: 'Select on map',
            description: 'Click precincts to highlight them',
            action: 'Click on the map to select precincts',
            priority: 1,
          },
          {
            id: 'filter-highlight',
            label: 'Highlight by filter',
            description: 'Highlight precincts matching criteria',
            action: 'Find precincts with high GOTV priority',
            priority: 2,
          },
        ],
        metadata: this.buildMetadata('map_highlight', startTime, query),
      };
    }

    const response = `Highlighting **${precincts.length} precinct${precincts.length > 1 ? 's' : ''}** on the map.`;

    const mapCommands: MapCommand[] = [
      {
        type: 'highlight',
        target: precincts,
      },
    ];

    return {
      success: true,
      response,
      mapCommands,
      suggestedActions: [
        {
          id: 'compare-highlighted',
          label: 'Compare highlighted',
          description: 'See side-by-side comparison',
          action: 'navigate:compare',
          metadata: { precincts },
          priority: 1,
        },
        {
          id: 'spatial-analysis',
          label: 'Analyze spatial patterns',
          description: 'Geographic clustering analysis',
          action: 'Analyze spatial patterns for these precincts',
          priority: 2,
        },
      ],
      metadata: this.buildMetadata('map_highlight', startTime, query),
    };
  }

  private async handleLayerChange(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const visualizationType = this.extractVisualizationType(query.originalQuery);
    const metric = this.extractMetric(query.originalQuery);

    if (!visualizationType) {
      return {
        success: false,
        response: 'Please specify a visualization type (e.g., "Show heatmap" or "Switch to choropleth").',
        suggestedActions: [
          {
            id: 'heatmap-swing',
            label: 'Swing heatmap',
            description: 'Show swing potential heatmap',
            action: 'map:showHeatmap',
            metadata: { metric: 'swing_potential' },
            priority: 1,
          },
          {
            id: 'heatmap-gotv',
            label: 'GOTV heatmap',
            description: 'Show GOTV priority heatmap',
            action: 'map:showHeatmap',
            metadata: { metric: 'gotv_priority' },
            priority: 2,
          },
          {
            id: 'choropleth',
            label: 'Precinct boundaries',
            description: 'Show choropleth map',
            action: 'map:showChoropleth',
            priority: 3,
          },
        ],
        metadata: this.buildMetadata('map_layer_change', startTime, query),
      };
    }

    let response = `Switching to **${visualizationType}** view`;
    if (metric) {
      response += ` showing **${this.formatMetricName(metric)}**`;
    }
    response += '.';

    const mapCommands: MapCommand[] = [];

    switch (visualizationType) {
      case 'heatmap':
        mapCommands.push({
          type: 'showHeatmap',
          metric: metric || 'swing_potential',
        });
        break;
      case 'choropleth':
        mapCommands.push({
          type: 'showChoropleth',
        });
        break;
      case 'bivariate':
        mapCommands.push({
          type: 'showBivariate',
          xMetric: 'swing_potential',
          yMetric: metric || 'gotv_priority',
        });
        break;
      case 'proportional':
        mapCommands.push({
          type: 'showProportional',
          sizeMetric: metric || 'estimatedVoters',
        });
        break;
    }

    return {
      success: true,
      response,
      mapCommands,
      suggestedActions: [
        {
          id: 'change-metric',
          label: 'Change metric',
          description: 'Visualize a different metric',
          action: 'What metrics can I visualize?',
          priority: 1,
        },
        {
          id: 'explain-patterns',
          label: 'Explain patterns',
          description: 'What do these patterns mean?',
          action: 'Explain the patterns I\'m seeing',
          priority: 2,
        },
        {
          id: 'filter-high',
          label: 'Filter high values',
          description: 'Find top-scoring areas',
          action: `Find precincts with high ${metric || 'swing potential'}`,
          priority: 3,
        },
      ],
      metadata: this.buildMetadata('map_layer_change', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract locations
    const jurisdictions: string[] = [];
    for (const pattern of LOCATION_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        jurisdictions.push(match[1].trim());
      }
    }
    if (jurisdictions.length > 0) {
      entities.jurisdictions = jurisdictions;
    }

    // Extract metric if mentioned
    const metric = this.extractMetric(query);
    if (metric) {
      entities.scoreThresholds = { [metric]: {} };
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Extraction Helpers
  // --------------------------------------------------------------------------

  private extractDistance(query: string): { value: number; unit: string } | null {
    for (const pattern of DISTANCE_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase().includes('km') ? 'km' : 'miles';
        return { value, unit };
      }
    }
    return null;
  }

  private extractMetric(query: string): string | null {
    for (const [metric, pattern] of Object.entries(METRIC_PATTERNS)) {
      if (pattern.test(query)) {
        return metric;
      }
    }
    return null;
  }

  private extractVisualizationType(query: string): 'heatmap' | 'choropleth' | 'bivariate' | 'proportional' | null {
    for (const [type, pattern] of Object.entries(VISUALIZATION_PATTERNS)) {
      if (pattern.test(query)) {
        return type as 'heatmap' | 'choropleth' | 'bivariate' | 'proportional';
      }
    }
    return null;
  }

  private formatMetricName(metric: string): string {
    const names: Record<string, string> = {
      swing_potential: 'Swing Potential',
      gotv_priority: 'GOTV Priority',
      persuasion_opportunity: 'Persuasion Opportunity',
      partisan_lean: 'Partisan Lean',
      combined_score: 'Combined Score',
      turnout: 'Turnout',
    };
    return names[metric] || metric;
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
      queryType: 'spatial',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const spatialHandler = new SpatialHandler();

export default SpatialHandler;
