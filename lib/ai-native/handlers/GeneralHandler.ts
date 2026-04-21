/**
 * General NLP Handler
 *
 * Handles general help, fallback, and error recovery queries.
 * This handler acts as the last resort when no specific tool handler matches.
 *
 * Supports queries like:
 * - "Help", "What can you do?"
 * - "Show me examples"
 * - "Try again", "Retry"
 * - "What went wrong?"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, getEnrichmentForQuery, formatEnrichmentSections } from './types';
import { handleDataRequest, handleOutputIntent } from '@/lib/ai/workflowHandlers';

// ============================================================================
// Query Patterns
// ============================================================================

const GENERAL_PATTERNS: QueryPattern[] = [
  {
    intent: 'help_general',
    patterns: [
      /^(help|assistance|guide)$/i,
      /what\s+can\s+you\s+do/i,
      /how\s+do(?:es)?\s+(?:this|it)\s+work/i,
      /show\s+(?:me\s+)?capabilities/i,
      /what\s+are\s+(?:my\s+)?options/i,
      /get(?:ting)?\s+started/i,
    ],
    keywords: ['help', 'guide', 'capabilities', 'options', 'started'],
    priority: 2,
  },
  {
    intent: 'help_tool',
    patterns: [
      /how\s+(?:do\s+i|to)\s+use\s+(\w+)/i,
      /help\s+with\s+(\w+)/i,
      /explain\s+(\w+)/i,
      /what\s+is\s+(\w+)/i,
      /how\s+does\s+(\w+)\s+work/i,
    ],
    keywords: ['how', 'use', 'explain', 'what is', 'work'],
    priority: 3,
  },
  {
    intent: 'help_example',
    patterns: [
      /show\s+(?:me\s+)?examples?/i,
      /give\s+(?:me\s+)?examples?/i,
      /sample\s+queries/i,
      /example\s+(?:questions?|queries)/i,
      /what\s+can\s+i\s+ask/i,
    ],
    keywords: ['example', 'sample', 'queries', 'questions'],
    priority: 3,
  },
  {
    intent: 'retry_operation',
    patterns: [
      /^try\s+again$/i,
      /^retry$/i,
      /one\s+more\s+time/i,
      /do\s+(?:it|that)\s+again/i,
      /repeat/i,
    ],
    keywords: ['retry', 'again', 'repeat'],
    priority: 5,
  },
  {
    intent: 'error_explain',
    patterns: [
      /what\s+(?:went\s+)?wrong/i,
      /why\s+(?:did\s+)?(?:it|that)\s+fail/i,
      /what\s+happened/i,
      /explain\s+(?:the\s+)?error/i,
    ],
    keywords: ['wrong', 'fail', 'error', 'happened'],
    priority: 5,
  },
  // County overview patterns
  {
    intent: 'county_overview',
    patterns: [
      /(?:give\s+(?:me\s+)?)?(?:an\s+)?overview\s+(?:of\s+)?(?:ingham\s+)?county/i,
      /summary\s+(?:of\s+)?(?:the\s+)?(?:political\s+)?(?:landscape|county)/i,
      /(?:ingham\s+)?county\s+(?:at\s+a\s+)?glance/i,
      /(?:what|show\s+me)\s+(?:is\s+)?(?:the\s+)?(?:ingham\s+)?county\s+(?:like|overview|summary)/i,
      /political\s+landscape\s+(?:of\s+)?(?:ingham\s+)?(?:county)?/i,
      /county\s+(?:profile|summary|overview)/i,
    ],
    keywords: ['overview', 'summary', 'county', 'landscape', 'glance', 'ingham'],
    priority: 7,
  },
  {
    intent: 'unknown',
    patterns: [/.*/], // Matches everything as fallback
    keywords: [],
    priority: 1,
  },
];

// ============================================================================
// Tool Examples & Descriptions
// ============================================================================

interface ToolInfo {
  name: string;
  description: string;
  examples: string[];
  capabilities: string[];
}

const TOOL_INFO: Record<string, ToolInfo> = {
  segmentation: {
    name: 'Segmentation',
    description: 'Build voter segments by filtering precincts on demographics, partisan lean, and targeting scores.',
    examples: [
      'Find high-GOTV precincts',
      'Show swing districts with college-educated voters',
      'Find precincts like East Lansing',
    ],
    capabilities: [
      'Filter by demographics (age, income, education)',
      'Filter by political metrics (partisan lean, swing potential)',
      'Filter by targeting scores (GOTV, persuasion)',
      'Save and export segments',
    ],
  },
  comparison: {
    name: 'Comparison',
    description: 'Compare jurisdictions side-by-side to identify resource allocation priorities.',
    examples: [
      'Compare Lansing vs East Lansing',
      'Find precincts similar to Meridian Township',
      'Which precincts have best ROI?',
    ],
    capabilities: [
      'Side-by-side comparison of demographics and scores',
      'Find similar entities based on multiple criteria',
      'Resource allocation recommendations',
      'Generate comparison reports',
    ],
  },
  canvassing: {
    name: 'Canvassing',
    description: 'Plan door-to-door operations with optimized turf assignments and staffing estimates.',
    examples: [
      'Create a canvass plan for high-GOTV precincts',
      'How many volunteers do I need for 5000 doors?',
      'Optimize routes for East Lansing',
    ],
    capabilities: [
      'Estimate doors, turfs, and volunteer needs',
      'Route optimization',
      'Export walk lists for VAN/PDI',
      'Track canvassing progress',
    ],
  },
  donor: {
    name: 'Donor Analysis',
    description: 'Analyze FEC donor data to identify fundraising opportunities and trends.',
    examples: [
      'Where are donors concentrated?',
      'Show me prospect areas',
      'Which ZIPs have lapsed donors?',
    ],
    capabilities: [
      'Donor concentration by ZIP code',
      'Prospect identification',
      'Lapsed donor analysis',
      'Giving trends over time',
    ],
  },
  reports: {
    name: 'Reports',
    description: 'Generate professional PDF reports for political profiles, comparisons, and campaign briefs.',
    examples: [
      'Generate a political profile for East Lansing',
      'Create a comparison report for Lansing vs Mason',
      'Build a campaign briefing for swing precincts',
    ],
    capabilities: [
      'Political profile reports (7 pages)',
      'Comparison reports',
      'Campaign briefings',
      'Canvassing and donor reports',
    ],
  },
  map: {
    name: 'Map Visualization',
    description: 'Interactive map with choropleth layers, heatmaps, and custom selections.',
    examples: [
      'Show swing potential heatmap',
      'Highlight high-GOTV precincts',
      'Zoom to East Lansing',
    ],
    capabilities: [
      'Choropleth maps (precincts colored by metric)',
      'H3 hexagonal heatmaps',
      'Click precincts for details',
      'Draw custom areas',
    ],
  },
  trends: {
    name: 'Trends Analysis',
    description: 'Analyze historical trends in elections, turnout, demographics, and donations over time.',
    examples: [
      'How has turnout changed over time?',
      'Show demographic trends in Ingham County',
      'Which precincts are shifting Republican?',
      'Show areas at risk of flipping',
    ],
    capabilities: [
      'Election trends (2020-2024)',
      'Turnout patterns over time',
      'Partisan shift analysis',
      'Flip risk identification',
      'Demographic changes (population, income, education)',
      'Donor giving trends',
    ],
  },
};

const GENERAL_CAPABILITIES = [
  'Analyze precincts and jurisdictions',
  'Build voter segments with custom filters',
  'Compare areas side-by-side',
  'Plan canvassing operations',
  'Identify donor opportunities',
  'Generate professional reports',
  'Visualize data on interactive maps',
  'Export to CSV, PDF, VAN format',
];

// ============================================================================
// General Handler Class
// ============================================================================

export class GeneralHandler implements NLPHandler {
  name = 'GeneralHandler';
  patterns = GENERAL_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    // This handler is the last resort - handles help, retry, error, and unknown
    return [
      'help_general',
      'help_tool',
      'help_example',
      'retry_operation',
      'error_explain',
      'county_overview',
      'unknown',
    ].includes(query.intent);
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'help_general':
          return this.handleGeneralHelp(query, startTime);

        case 'help_tool':
          return this.handleToolHelp(query, startTime);

        case 'help_example':
          return this.handleExamples(query, startTime);

        case 'retry_operation':
          return this.handleRetry(query, startTime);

        case 'error_explain':
          return this.handleErrorExplain(query, startTime);

        case 'county_overview':
          return await this.handleCountyOverview(query, startTime);

        case 'unknown':
          return this.handleUnknown(query, startTime);

        default:
          // Should never reach here, but handle gracefully
          return this.handleUnknown(query, startTime);
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process your request'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleGeneralHelp(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = this.formatGeneralHelp();

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'view-segmentation',
          label: 'Try Segmentation',
          description: 'Build voter segments',
          action: 'Show me example segmentation queries',
          priority: 1,
        },
        {
          id: 'view-comparison',
          label: 'Try Comparison',
          description: 'Compare jurisdictions',
          action: 'Show me example comparison queries',
          priority: 2,
        },
        {
          id: 'view-canvassing',
          label: 'Try Canvassing',
          description: 'Plan field operations',
          action: 'Show me example canvassing queries',
          priority: 3,
        },
        {
          id: 'view-examples',
          label: 'Show All Examples',
          description: 'See example queries for all tools',
          action: 'Show me examples',
          priority: 4,
        },
      ],
      metadata: this.buildMetadata('help_general', startTime, query),
    };
  }

  private async handleToolHelp(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const toolName = this.extractToolName(query.originalQuery);

    if (!toolName || !TOOL_INFO[toolName]) {
      // Tool not recognized, show general help
      return this.handleGeneralHelp(query, startTime);
    }

    const tool = TOOL_INFO[toolName];
    const response = this.formatToolHelp(tool);

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'try-example-1',
          label: `Try: "${tool.examples[0]}"`,
          description: 'Run first example',
          action: tool.examples[0],
          priority: 1,
        },
        {
          id: 'try-example-2',
          label: `Try: "${tool.examples[1]}"`,
          description: 'Run second example',
          action: tool.examples[1],
          priority: 2,
        },
        {
          id: 'see-all-examples',
          label: 'Show All Examples',
          description: 'View all example queries',
          action: 'Show me examples',
          priority: 3,
        },
      ],
      metadata: this.buildMetadata('help_tool', startTime, query),
    };
  }

  private async handleExamples(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = this.formatExamples();

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'try-segment',
          label: 'Find High-GOTV Precincts',
          description: 'Example segmentation query',
          action: 'Find high-GOTV precincts',
          priority: 1,
        },
        {
          id: 'try-compare',
          label: 'Compare Lansing vs East Lansing',
          description: 'Example comparison query',
          action: 'Compare Lansing vs East Lansing',
          priority: 2,
        },
        {
          id: 'try-canvass',
          label: 'Plan Canvass for Swing Districts',
          description: 'Example canvassing query',
          action: 'Create canvass plan for swing precincts',
          priority: 3,
        },
        {
          id: 'try-donor',
          label: 'Show Donor Concentration',
          description: 'Example donor query',
          action: 'Where are donors concentrated?',
          priority: 4,
        },
      ],
      metadata: this.buildMetadata('help_example', startTime, query),
    };
  }

  private async handleRetry(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // For retry, we'd need context of the last operation
    // Since we don't have that here, provide guidance
    const response = [
      '**Retry Operation**',
      '',
      'To retry your last action, please:',
      '',
      '1. Rephrase your query with more specific criteria',
      '2. Check that you\'ve selected the correct area or precinct',
      '3. Verify filter values are in valid ranges',
      '',
      'Or try one of these common operations:',
      '- "Find high-GOTV precincts"',
      '- "Compare Lansing vs East Lansing"',
      '- "Show donor concentration"',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'help-general',
          label: 'Show Help',
          description: 'View all capabilities',
          action: 'Help',
          priority: 1,
        },
        {
          id: 'show-examples',
          label: 'Show Examples',
          description: 'View example queries',
          action: 'Show me examples',
          priority: 2,
        },
      ],
      metadata: this.buildMetadata('retry_operation', startTime, query),
    };
  }

  private async handleErrorExplain(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Generic error explanation - specific errors would be handled by their respective handlers
    const response = [
      '**Common Issues & Solutions**',
      '',
      '**No results found:**',
      '- Try broadening your filter criteria',
      '- Check that location names are spelled correctly',
      '- Verify score ranges are reasonable (0-100)',
      '',
      '**Can\'t understand query:**',
      '- Be specific: "Find precincts with GOTV > 80"',
      '- Use recognized terms: partisan lean, swing potential, GOTV',
      '- Try example queries: "Show me examples"',
      '',
      '**Map not responding:**',
      '- Click directly on precincts for details',
      '- Use area selector tabs (Click, Draw, Search, Boundary)',
      '- Check that map controls are visible',
      '',
      'Need more help? Try "Help" or "Show me examples"',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'general-help',
          label: 'General Help',
          description: 'Show all capabilities',
          action: 'Help',
          priority: 1,
        },
        {
          id: 'examples',
          label: 'Show Examples',
          description: 'View example queries',
          action: 'Show me examples',
          priority: 2,
        },
      ],
      metadata: this.buildMetadata('error_explain', startTime, query),
    };
  }

  private async handleUnknown(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Check if this looks like a data request or output request
    const lowerQuery = query.originalQuery.toLowerCase();

    // Data request patterns
    if (
      lowerQuery.includes('show') ||
      lowerQuery.includes('get') ||
      lowerQuery.includes('what') ||
      lowerQuery.includes('demographics') ||
      lowerQuery.includes('data')
    ) {
      // Try to route to data handler
      try {
        const dataIntent = this.inferDataIntent(query.originalQuery);
        if (dataIntent) {
          const result = await handleDataRequest(dataIntent.dataType, dataIntent.entity);
          return {
            success: true,
            response: result.response,
            mapCommands: result.mapCommands,
            suggestedActions: result.suggestedActions,
            metadata: this.buildMetadata('data_request', startTime, query),
          };
        }
      } catch (error) {
        // Fall through to unknown response
      }
    }

    // Output request patterns
    if (
      lowerQuery.includes('save') ||
      lowerQuery.includes('export') ||
      lowerQuery.includes('download') ||
      lowerQuery.includes('share')
    ) {
      // Try to route to output handler
      try {
        const outputIntent = this.inferOutputIntent(query.originalQuery);
        if (outputIntent) {
          const result = await handleOutputIntent(
            { requestType: outputIntent.requestType, targetType: outputIntent.targetType },
            {
              precinctsExplored: 0,
              hasActiveSegment: false,
              segmentPrecinctCount: 0,
              hasAnalysisResults: false,
              messageCount: 0,
              currentTool: 'general',
              hasMapSelection: false,
            }
          );
          return {
            success: true,
            response: result.response,
            mapCommands: result.mapCommands,
            suggestedActions: result.suggestedActions,
            metadata: this.buildMetadata('output_request', startTime, query),
          };
        }
      } catch (error) {
        // Fall through to unknown response
      }
    }

    // Fallback: unknown query
    const response = [
      `I couldn't understand "${query.originalQuery}".`,
      '',
      '**Here\'s what I can do:**',
      '',
      ...GENERAL_CAPABILITIES.map((cap) => `• ${cap}`),
      '',
      'Try rephrasing your query or ask "Show me examples" for sample queries.',
    ].join('\n');

    return {
      success: false,
      response,
      suggestedActions: [
        {
          id: 'show-examples',
          label: 'Show Examples',
          description: 'View example queries',
          action: 'Show me examples',
          priority: 1,
        },
        {
          id: 'general-help',
          label: 'Help',
          description: 'View all capabilities',
          action: 'Help',
          priority: 2,
        },
      ],
      metadata: this.buildMetadata('unknown', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract tool name for help queries
    const toolMatch = query.match(/(?:help\s+with|explain|how\s+to\s+use)\s+(\w+)/i);
    if (toolMatch) {
      const toolName = toolMatch[1].toLowerCase();
      // Store as generic string - not a specific entity type
      (entities as any).toolName = toolName;
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private extractToolName(query: string): string | null {
    const lowerQuery = query.toLowerCase();

    // Check for tool keywords
    if (lowerQuery.includes('segment')) return 'segmentation';
    if (lowerQuery.includes('compar')) return 'comparison';
    if (lowerQuery.includes('canvass')) return 'canvassing';
    if (lowerQuery.includes('donor')) return 'donor';
    if (lowerQuery.includes('report')) return 'reports';
    if (lowerQuery.includes('map')) return 'map';

    return null;
  }

  private inferDataIntent(
    query: string
  ): { dataType: string; entity?: string } | null {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('demographic')) {
      const entityMatch = query.match(/(?:for|of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      return {
        dataType: 'demographics',
        entity: entityMatch ? entityMatch[1] : undefined,
      };
    }

    if (lowerQuery.includes('precinct')) {
      return { dataType: 'precincts' };
    }

    if (lowerQuery.includes('score') || lowerQuery.includes('targeting')) {
      return { dataType: 'scores' };
    }

    return null;
  }

  private inferOutputIntent(
    query: string
  ): { requestType: 'save' | 'export' | 'download' | 'share'; targetType?: string } | null {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('save')) {
      return { requestType: 'save', targetType: 'segment' };
    }

    if (lowerQuery.includes('export')) {
      const csvMatch = lowerQuery.includes('csv');
      const pdfMatch = lowerQuery.includes('pdf');
      return {
        requestType: 'export',
        targetType: csvMatch ? 'csv' : pdfMatch ? 'pdf' : undefined,
      };
    }

    if (lowerQuery.includes('download')) {
      return { requestType: 'download' };
    }

    if (lowerQuery.includes('share')) {
      return { requestType: 'share' };
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Response Formatting
  // --------------------------------------------------------------------------

  private formatGeneralHelp(): string {
    const lines = [
      '**Political Analysis Assistant**',
      '',
      'I can help you analyze precincts, build voter segments, plan operations, and generate reports.',
      '',
      '**Key Capabilities:**',
      '',
    ];

    GENERAL_CAPABILITIES.forEach((cap) => {
      lines.push(`• ${cap}`);
    });

    lines.push('');
    lines.push('**Tools:**');
    lines.push('');

    Object.values(TOOL_INFO).forEach((tool) => {
      lines.push(`**${tool.name}** - ${tool.description}`);
    });

    lines.push('');
    lines.push('💡 *Ask "Show me examples" to see sample queries for each tool.*');

    return lines.join('\n');
  }

  private formatToolHelp(tool: ToolInfo): string {
    const lines = [
      `**${tool.name} Tool**`,
      '',
      tool.description,
      '',
      '**What You Can Do:**',
      '',
    ];

    tool.capabilities.forEach((cap) => {
      lines.push(`• ${cap}`);
    });

    lines.push('');
    lines.push('**Example Queries:**');
    lines.push('');

    tool.examples.forEach((ex, i) => {
      lines.push(`${i + 1}. "${ex}"`);
    });

    lines.push('');
    lines.push('💡 *Click any example above to try it.*');

    return lines.join('\n');
  }

  private formatExamples(): string {
    const lines = [
      '**Example Queries by Tool**',
      '',
    ];

    Object.values(TOOL_INFO).forEach((tool) => {
      lines.push(`**${tool.name}**`);
      tool.examples.forEach((ex) => {
        lines.push(`• "${ex}"`);
      });
      lines.push('');
    });

    lines.push('💡 *Click any example to run it, or type your own query.*');

    return lines.join('\n');
  }

  // --------------------------------------------------------------------------
  // County Overview Handler
  // --------------------------------------------------------------------------

  private async handleCountyOverview(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    try {
      // Import politicalDataService
      const { politicalDataService } = await import('@/lib/services/PoliticalDataService');

      // Get all precincts
      const allPrecincts = await politicalDataService.getSegmentEnginePrecincts();

      // Calculate county-level statistics
      const totalVoters = allPrecincts.reduce((sum: number, p: any) => sum + (p.registeredVoters || 0), 0);
      const avgLean = allPrecincts.reduce((sum: number, p: any) => sum + (p.partisanLean || 0), 0) / allPrecincts.length;
      const avgSwing = allPrecincts.reduce((sum: number, p: any) => sum + (p.swingPotential || 0), 0) / allPrecincts.length;
      const avgGOTV = allPrecincts.reduce((sum: number, p: any) => sum + (p.gotvPriority || 0), 0) / allPrecincts.length;
      const avgTurnout = allPrecincts.reduce((sum: number, p: any) => sum + (p.avgTurnout || 0), 0) / allPrecincts.length;

      // Count by density
      const densityCounts = allPrecincts.reduce((acc: Record<string, number>, p: any) => {
        const d = p.density || 'unknown';
        acc[d] = (acc[d] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Find top precincts by various metrics
      const topSwing = [...allPrecincts].sort((a: any, b: any) => (b.swingPotential || 0) - (a.swingPotential || 0)).slice(0, 3);
      const topGOTV = [...allPrecincts].sort((a: any, b: any) => (b.gotvPriority || 0) - (a.gotvPriority || 0)).slice(0, 3);

      const response = [
        '**Ingham County Political Overview**',
        '',
        '**At a Glance:**',
        `- Total Precincts: ${allPrecincts.length}`,
        `- Total Registered Voters: ${totalVoters.toLocaleString()}`,
        `- Average Partisan Lean: ${avgLean > 0 ? 'R+' : 'D+'}${Math.abs(avgLean).toFixed(1)}`,
        `- Average Swing Potential: ${avgSwing.toFixed(0)}/100`,
        `- Average Turnout: ${avgTurnout.toFixed(1)}%`,
        '',
        '**Density Breakdown:**',
        `- Urban: ${densityCounts['urban'] || 0} precincts`,
        `- Suburban: ${densityCounts['suburban'] || 0} precincts`,
        `- Rural: ${densityCounts['rural'] || 0} precincts`,
        '',
        '**Districts:**',
        '- Congressional: MI-07 (entire county)',
        '- State Senate: 21, 28',
        '- State House: 73, 74, 75, 77',
        '',
        '**Top Swing Precincts:**',
        ...topSwing.map((p: any, i: number) => `${i + 1}. ${p.precinctName}: ${p.swingPotential?.toFixed(0)}/100`),
        '',
        '**Top GOTV Priorities:**',
        ...topGOTV.map((p: any, i: number) => `${i + 1}. ${p.precinctName}: ${p.gotvPriority?.toFixed(0)}/100`),
      ].join('\n');

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery, {
        districtType: 'county',
      });
      const enrichmentSections = formatEnrichmentSections(enrichment);

      return {
        success: true,
        response: response + enrichmentSections,
        mapCommands: [
          {
            action: 'showChoropleth',
            metric: 'partisan_lean',
          },
          {
            action: 'fitBounds',
            target: 'county',
          },
        ],
        suggestedActions: [
          {
            id: 'show-districts',
            label: 'View Districts',
            action: 'Show all state house districts',
            priority: 1,
          },
          {
            id: 'find-swing',
            label: 'Find Swing Precincts',
            action: 'Find swing precincts',
            priority: 2,
          },
          {
            id: 'show-gotv-heatmap',
            label: 'GOTV Heatmap',
            action: 'map:showHeatmap',
            metadata: { metric: 'gotv_priority' },
            priority: 3,
          },
          {
            id: 'donor-overview',
            label: 'Donor Overview',
            action: 'Where are donors concentrated?',
            priority: 4,
          },
        ],
        data: {
          totalPrecincts: allPrecincts.length,
          totalVoters,
          avgLean,
          avgSwing,
          avgGOTV,
          avgTurnout,
          densityCounts,
        },
        metadata: this.buildMetadata('county_overview', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load county overview data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'general',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const generalHandler = new GeneralHandler();

export default GeneralHandler;
