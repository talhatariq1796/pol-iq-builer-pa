/**
 * Navigation NLP Handler
 *
 * Translates natural language navigation queries into page navigation actions.
 * Supports queries like:
 * - "Go to segments page"
 * - "Take me to settings"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES } from './types';

// ============================================================================
// Query Patterns
// ============================================================================

const NAVIGATION_PATTERNS: QueryPattern[] = [
  {
    intent: 'navigate_tool',
    patterns: [
      /(?:go\s+to|open|navigate\s+to|take\s+me\s+to|switch\s+to|show\s+me)\s+(?:the\s+)?(?:segments?|segmentation)/i,
      /(?:go\s+to|open|navigate\s+to|take\s+me\s+to|switch\s+to|show\s+me)\s+(?:the\s+)?(?:compar(?:e|ison))/i,
      /(?:go\s+to|open|navigate\s+to|take\s+me\s+to|switch\s+to|show\s+me)\s+(?:the\s+)?(?:main|political[\s-]?ai|ai\s+page|home)/i,
      /(?:segments?|segmentation)\s+(?:page|tool)/i,
      /(?:compar(?:e|ison))\s+(?:page|tool|view)/i,
    ],
    keywords: ['go to', 'open', 'navigate', 'switch', 'show', 'page', 'tool', 'segments', 'compare'],
    priority: 11,  // Higher than SegmentationHandler (10) to catch navigation intent first
  },
  {
    intent: 'navigate_settings',
    patterns: [
      /(?:go\s+to|open|navigate\s+to|take\s+me\s+to|show\s+me)\s+(?:the\s+)?settings?/i,
      /(?:go\s+to|open|navigate\s+to|take\s+me\s+to|show\s+me)\s+(?:the\s+)?preferences?/i,
      /(?:go\s+to|open|navigate\s+to|take\s+me\s+to|show\s+me)\s+(?:the\s+)?configuration?/i,
      /settings?\s+(?:page|menu)/i,
      /preferences?\s+(?:page|menu)/i,
    ],
    keywords: ['settings', 'preferences', 'configuration', 'options'],
    priority: 11,  // Higher than SegmentationHandler (10) to catch navigation intent first
  },
];

// ============================================================================
// Destination Mappings
// ============================================================================

interface Destination {
  path: string;
  name: string;
  description: string;
  keywords: string[];
}

const DESTINATIONS: Record<string, Destination> = {
  segments: {
    path: '/segments',
    name: 'Segmentation Tool',
    description: 'Create and manage voter segments with advanced filtering',
    keywords: ['segment', 'segmentation', 'filter', 'target', 'voters'],
  },
  compare: {
    path: '/compare',
    name: 'Comparison View',
    description: 'Side-by-side analysis of precincts and areas',
    keywords: ['compare', 'comparison', 'versus', 'vs', 'side by side'],
  },
  main: {
    path: '/political-ai',
    name: 'Political AI Assistant',
    description: 'Main AI-powered analysis interface with map',
    keywords: ['main', 'home', 'ai', 'assistant', 'political'],
  },
  settings: {
    path: '/settings',
    name: 'Settings',
    description: 'Configure application preferences and manage saved segments',
    keywords: ['settings', 'preferences', 'configuration', 'options'],
  },
};

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const DESTINATION_PATTERNS: Record<string, RegExp[]> = {
  segments: [
    /\b(segment(?:s|ation)?)\b/i,
    /\b(filter(?:ing)?|target(?:ing)?)\b/i,
  ],
  compare: [
    /\b(compar(?:e|ison)|versus|vs)\b/i,
    /\bside[\s-]?by[\s-]?side\b/i,
  ],
  main: [
    /\b(main|home|political[\s-]?ai)\b/i,
    /\b(ai\s+(?:page|assistant))\b/i,
  ],
  settings: [
    /\b(settings?|preferences?|configuration?)\b/i,
    /\b(options?|config)\b/i,
  ],
};

// ============================================================================
// Navigation Handler Class
// ============================================================================

export class NavigationHandler implements NLPHandler {
  name = 'NavigationHandler';
  patterns = NAVIGATION_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return query.intent === 'navigate_tool' || query.intent === 'navigate_settings';
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'navigate_tool':
          return await this.handleToolNavigation(query, startTime);

        case 'navigate_settings':
          return await this.handleSettingsNavigation(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown navigation intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('navigate'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleToolNavigation(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const destination = this.detectDestination(query.originalQuery);

    if (!destination) {
      return this.handleUnknownDestination(query, startTime);
    }

    const dest = DESTINATIONS[destination];
    const response = this.formatNavigationResponse(dest);

    return {
      success: true,
      response,
      mapCommands: [
        {
          action: `navigate:${destination}`,
          type: 'clear', // Clear map state when navigating
        },
      ],
      suggestedActions: this.getDestinationActions(destination),
      data: {
        destination: destination,
        path: dest.path,
      },
      metadata: this.buildMetadata('navigate_tool', startTime, query, destination),
    };
  }

  private async handleSettingsNavigation(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const dest = DESTINATIONS.settings;

    return {
      success: true,
      response: `Opening **${dest.name}**.\n\n${dest.description}`,
      mapCommands: [
        {
          action: 'navigate:settings',
          type: 'clear',
        },
      ],
      suggestedActions: [
        {
          id: 'view-segments',
          label: 'View Saved Segments',
          description: 'Manage your saved voter segments',
          action: 'Show my saved segments',
          icon: 'bookmark',
          priority: 1,
        },
        {
          id: 'data-sources',
          label: 'Data Sources',
          description: 'Configure data connections',
          action: 'Show data sources',
          icon: 'database',
          priority: 2,
        },
        {
          id: 'export-settings',
          label: 'Export Settings',
          description: 'Configure default export formats',
          action: 'Show export settings',
          icon: 'download',
          priority: 3,
        },
      ],
      data: {
        destination: 'settings',
        path: dest.path,
      },
      metadata: this.buildMetadata('navigate_settings', startTime, query, 'settings'),
    };
  }

  private handleUnknownDestination(
    query: ParsedQuery,
    startTime: number
  ): HandlerResult {
    const availablePages = Object.entries(DESTINATIONS)
      .filter(([key]) => key !== 'main')
      .map(([key, dest]) => `- **${dest.name}**: ${dest.description}`)
      .join('\n');

    return {
      success: false,
      response: `I couldn't determine which page you want to navigate to.\n\n**Available pages:**\n${availablePages}\n\nTry saying "Go to [page name]" or click a suggestion below.`,
      suggestedActions: [
        {
          id: 'nav-segments',
          label: 'Segmentation Tool',
          description: 'Create voter segments',
          action: 'Go to segments page',
          icon: 'filter',
          priority: 1,
        },
        {
          id: 'nav-compare',
          label: 'Comparison View',
          description: 'Compare precincts',
          action: 'Go to comparison tool',
          icon: 'git-compare',
          priority: 4,
        },
      ],
      metadata: this.buildMetadata('navigate_tool', startTime, query, 'unknown'),
    };
  }

  // --------------------------------------------------------------------------
  // Destination Detection
  // --------------------------------------------------------------------------

  private detectDestination(query: string): string | null {
    const queryLower = query.toLowerCase();

    // Try exact pattern matches first
    for (const [key, patterns] of Object.entries(DESTINATION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(queryLower)) {
          return key;
        }
      }
    }

    // Try keyword matching
    for (const [key, dest] of Object.entries(DESTINATIONS)) {
      for (const keyword of dest.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          return key;
        }
      }
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    const destination = this.detectDestination(query);
    if (destination) {
      // Store destination as metadata (not a standard entity type)
      (entities as any).destination = destination;
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Response Formatting
  // --------------------------------------------------------------------------

  private formatNavigationResponse(destination: Destination): string {
    return `Navigating to **${destination.name}**.\n\n${destination.description}`;
  }

  // --------------------------------------------------------------------------
  // Suggested Actions
  // --------------------------------------------------------------------------

  private getDestinationActions(destination: string): any[] {
    const actionMap: Record<string, any[]> = {
      segments: [
        {
          id: 'create-segment',
          label: 'Create New Segment',
          description: 'Build a voter targeting segment',
          action: 'Create a new segment',
          icon: 'plus-circle',
          priority: 1,
        },
        {
          id: 'view-saved',
          label: 'View Saved Segments',
          description: 'Load a previously saved segment',
          action: 'Show my saved segments',
          icon: 'bookmark',
          priority: 2,
        },
        {
          id: 'gotv-segment',
          label: 'Find GOTV Targets',
          description: 'High-priority turnout areas',
          action: 'Find high GOTV priority precincts',
          icon: 'target',
          priority: 3,
        },
      ],
      compare: [
        {
          id: 'add-entities',
          label: 'Add Entities',
          description: 'Select precincts to compare',
          action: 'Add entities to compare',
          icon: 'plus',
          priority: 1,
        },
        {
          id: 'find-similar',
          label: 'Find Similar',
          description: 'Find precincts like a reference',
          action: 'Find similar precincts',
          icon: 'copy',
          priority: 2,
        },
        {
          id: 'batch-compare',
          label: 'Batch Comparison',
          description: 'Compare multiple entities',
          action: 'Compare multiple precincts',
          icon: 'grid',
          priority: 3,
        },
      ],
      main: [
        {
          id: 'workflows',
          label: 'View Workflows',
          description: 'Common analysis workflows',
          action: 'Show me the workflows',
          icon: 'list',
          priority: 1,
        },
        {
          id: 'recent',
          label: 'Recent Analysis',
          description: 'Continue where you left off',
          action: 'Show my recent analysis',
          icon: 'clock',
          priority: 2,
        },
        {
          id: 'help',
          label: 'What can you do?',
          description: 'Learn about capabilities',
          action: 'What can you help me with?',
          icon: 'help-circle',
          priority: 3,
        },
      ],
    };

    return actionMap[destination] || [];
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery, destination: string): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'navigation',
      matchedIntent: intent,
      confidence: query.confidence,
      destination,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const navigationHandler = new NavigationHandler();

export default NavigationHandler;
