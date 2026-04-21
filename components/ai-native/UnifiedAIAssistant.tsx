'use client';

/**
 * UnifiedAIAssistant - Unified AI chat component for all pages
 *
 * Part of Phase 2: Unified AI-First Architecture
 * Replaces both AIPoliticalSessionHost and AIToolAssistant
 * Works across all tool pages with context-aware behavior
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import {
  HelpCircle, X, Zap, Download, ExternalLink, FileText, MessageSquare,
  Target, TrendingUp, Users, GitCompare, Route, Map, MapPin,
  Save, Search, RefreshCw, DollarSign, MessageCircle, History,
  Filter, Settings, Plus, Info, Loader2, Sparkles
} from 'lucide-react';
import type { MapCommand } from '@/lib/ai-native/types';
import type { SelectedFeatureData } from '@/lib/ai-native/types/unified-state';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { getSuggestionEngine } from '@/lib/ai-native/SuggestionEngine';
import { getDefaultPoliticalJurisdictionLabel } from '@/lib/political/politicalRegionConfig';
import { parseIntent } from '@/lib/ai/intentParser';
import { stripActionDirectives } from '@/lib/ai/stripActionDirectives';
import { normalizeChatMarkdown } from '@/lib/ai/normalizeChatMarkdown';
import {
  handleReportHistoryRequest,
  handleReportCustomization,
  handleReportIntent,
  handleOutputIntent,
} from '@/lib/ai/workflowHandlers';
import { processQuery } from '@/lib/ai-native/handlers';
import { addReportToHistory, REPORT_TYPE_CONFIG, getRecentReports } from '@/lib/ai/ReportHistoryService';
import type { ToolType } from '@/lib/ai-native/types/unified-state';
import { CrossToolNavigator } from '@/lib/ai-native/navigation/CrossToolNavigator';
import { isSlashCommand, executeSlashCommand } from '@/lib/ai/SlashCommandParser';
import { segmentStore } from '@/lib/segmentation/SegmentStore';
import { getEntityCoordinates, extractNumberedEntities, type EntityReference } from '@/lib/ai/entityParser';
import { toast } from '@/hooks/use-toast';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

// Wave 4 Integrations
import { RecentSearches } from '@/components/ai-native/RecentSearches';
import { PerformanceIndicator, usePerformanceTracking } from '@/components/ai-native/PerformanceIndicator';
import { getSearchHistoryManager } from '@/lib/ai-native/SearchHistoryManager';
import { DepthIndicator } from '@/components/ai-native/DepthIndicator';
import { KeyboardShortcuts } from '@/components/help/KeyboardShortcuts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ThinkingIndicator, detectQueryContext, type QueryContext } from '@/components/ai-native/ThinkingIndicator';
import { notifyTourAIResponseComplete } from '@/lib/tour/tourActions';

// ============================================================================
// Type Definitions
// ============================================================================

// P1-25: Retry helper for failed API calls
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  retryDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      // If not a network error (4xx client errors), don't retry
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`[fetchWithRetry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries reached');
}

// Example questions by category
const EXAMPLE_QUESTIONS = {
  analysis: [
    "Find precincts with GOTV priority above 70",
    "What's the partisan lean of East Lansing?",
    "Show me swing precincts",
    "Which areas have the highest turnout?",
  ],
  visualization: [
    "Show a heatmap of turnout",
    "Compare Democratic vote share across precincts",
    "Highlight persuadable areas",
    "Show me competitive districts",
  ],
};

export interface ToolAction {
  type: 'applyFilter' | 'setDonorFilter' | 'createTurf' | 'setComparison' | 'navigate' | 'saveSegment' | 'exportCSV';
  payload: Record<string, unknown>;
}

export interface SuggestedAction {
  id: string;
  label: string;
  action: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: SuggestedAction[];
  confidence?: 'high' | 'medium' | 'low';
  isLoading?: boolean;
  isError?: boolean;
  isAcknowledgment?: boolean; // For instant feedback styling
  metadata?: {
    districtIds?: string[];
    workflow?: string;
    mapCommands?: MapCommand[];
    messageId?: string;
  };
}

interface PrecinctInfo {
  precinctId: string;
  precinctName: string;
  county: string;
  attributes?: Record<string, unknown>;
}

export interface UnifiedAIAssistantProps {
  /** Current tool context - determines greeting and suggested actions */
  toolContext: ToolType;
  /** Callback when AI issues a map command */
  onMapCommand?: (command: MapCommand) => void;
  /** Callback for tool-specific actions */
  onToolAction?: (action: ToolAction) => void;
  /** Current map state for AI awareness */
  mapState?: {
    activeLayer?: string;
    selectedMetric?: string;
    visibleFilters?: Record<string, unknown>;
    selectedBoundaries?: { type: string; ids: string[] };
  };
  /** Currently selected precinct */
  selectedPrecinct?: PrecinctInfo | null;
  /** Custom initial greeting (optional) */
  initialGreeting?: string;
  /** Called when map is ready */
  onMapReady?: () => void;
  /** Whether map is ready */
  isMapReady?: boolean;
  /** Programmatically trigger a query (set to trigger, component handles and clears) */
  triggerQuery?: string | null;
  /** Callback when triggered query is processed */
  onQueryProcessed?: () => void;
}

// ============================================================================
// Tool Configuration
// ============================================================================

interface ToolConfig {
  greeting: string;
  placeholder: string;
  suggestions: SuggestedAction[];
}

function getToolConfig(tool: ToolType): ToolConfig {
  switch (tool) {
    case 'political-ai':
      return {
        greeting: "Analyze precincts, districts, and voter targeting. Select a workflow or type a question.",
        placeholder: 'Ask about precincts, districts, or voter targeting...',
        suggestions: [
          {
            id: 'analyze-swing',
            label: 'Find swing precincts',
            action: `Find swing precincts in ${getDefaultPoliticalJurisdictionLabel()}`,
          },
          { id: 'show-gotv', label: 'Show GOTV priorities', action: 'map:showHeatmap', metadata: { metric: 'gotv_priority' } },
          { id: 'compare-areas', label: 'Compare areas', action: 'navigate:/compare' },
        ],
      };

    case 'segments':
      return {
        greeting: "Build voter segments by describing target voters or using filters to find matching precincts.",
        placeholder: 'Describe your target voters or filter criteria...',
        suggestions: [
          { id: 'high-turnout', label: 'High turnout precincts', action: 'Find precincts with turnout above 70%' },
          { id: 'persuadable', label: 'Persuadable voters', action: 'Find precincts with high persuasion opportunity' },
          { id: 'show-map', label: 'Show on map', action: 'map:showChoropleth' },
        ],
      };

    case 'compare':
      return {
        greeting: "Compare precincts, municipalities, or districts. Select two areas or search for similar ones.",
        placeholder: 'Ask to compare areas or find similar precincts...',
        suggestions: [
          { id: 'find-similar', label: 'Find similar areas', action: 'Find precincts similar to the selected one' },
          { id: 'compare-metrics', label: 'Compare key metrics', action: 'Compare key electoral metrics between selected areas' },
          { id: 'benchmark', label: 'Benchmark analysis', action: 'Benchmark selected area against county average' },
        ],
      };

    default:
      return {
        greeting: "Political analysis tools ready. Type a question or select an action.",
        placeholder: 'Ask me anything...',
        suggestions: [],
      };
  }
}

// Helper to enhance messages with icons and clean up internal tags
function enhanceMessage(content: string): string {
  return normalizeChatMarkdown(stripActionDirectives(content))
    // Remove citation tags like [DEMOGRAPHICS], [TARGETING], [ELECTIONS], etc.
    .replace(/\s*\[([A-Z_]+)\]\s*/g, ' ')
    // Collapse horizontal spaces only — never collapse newlines (breaks markdown headings)
    .replace(/[ \t]{2,}/g, ' ')
    // Add trend indicators
    .replace(/\b(increase|up|growth|gain|higher|rose)\b/gi, (match) => `${match} ↑`)
    .replace(/\b(decrease|down|decline|drop|lower|fell)\b/gi, (match) => `${match} ↓`)
    .replace(/\b(hot|trending|popular|momentum)\b/gi, (match) => `${match} 🔥`)
    .replace(/\b(fast|quick|rapid|instant)\b/gi, (match) => `${match} ⚡`);
}

// Helper to get action icon based on action type or icon name
function getActionIcon(action: string, iconName?: string): React.ReactNode {
  // If explicit icon name is provided, use it
  if (iconName) {
    const icons: Record<string, React.ReactNode> = {
      'target': <Target className="w-3 h-3" />,
      'trending-up': <TrendingUp className="w-3 h-3" />,
      'users': <Users className="w-3 h-3" />,
      'git-compare': <GitCompare className="w-3 h-3" />,
      'route': <Route className="w-3 h-3" />,
      'map': <Map className="w-3 h-3" />,
      'map-pin': <MapPin className="w-3 h-3" />,
      'download': <Download className="w-3 h-3" />,
      'save': <Save className="w-3 h-3" />,
      'file-text': <FileText className="w-3 h-3" />,
      'search': <Search className="w-3 h-3" />,
      'help-circle': <HelpCircle className="w-3 h-3" />,
      'refresh-cw': <RefreshCw className="w-3 h-3" />,
      'dollar-sign': <DollarSign className="w-3 h-3" />,
      'message-circle': <MessageCircle className="w-3 h-3" />,
      'history': <History className="w-3 h-3" />,
      'filter': <Filter className="w-3 h-3" />,
      'settings': <Settings className="w-3 h-3" />,
      'plus': <Plus className="w-3 h-3" />,
      'info': <Info className="w-3 h-3" />,
      'zap': <Zap className="w-3 h-3" />,
      'external-link': <ExternalLink className="w-3 h-3" />,
      'message-square': <MessageSquare className="w-3 h-3" />,
    };
    return icons[iconName] || <HelpCircle className="w-3 h-3" />;
  }

  // Fallback to action prefix detection
  if (action.startsWith('map:')) return <Zap className="w-3 h-3" />;
  if (action.startsWith('output:')) return <Download className="w-3 h-3" />;
  if (action.startsWith('navigate:')) return <ExternalLink className="w-3 h-3" />;
  if (action.startsWith('report:')) return <FileText className="w-3 h-3" />;
  return <MessageSquare className="w-3 h-3" />;
}

// Helper to get action button style based on action type (Issue #14)
function getActionStyle(action: string): string {
  if (action.startsWith('map:')) {
    return 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-500';
  }
  if (action.startsWith('output:')) {
    return 'border-green-500/30 bg-green-500/10 hover:bg-green-500/20 hover:border-green-500';
  }
  if (action.startsWith('navigate:')) {
    return 'border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500';
  }
  if (action.startsWith('filter:')) {
    return 'border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500';
  }
  // Default style for plain text actions
  return 'border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20 hover:border-gray-500';
}

/**
 * Component to render message content with clickable entities
 * Sources section is extracted and shown as a compact link that opens a dialog
 */
/**
 * CollapsibleSection - Renders a collapsible accordion section
 */
const CollapsibleSection: React.FC<{
  title: string;
  count?: number;
  icon?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, count, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {icon && <span>{icon}</span>}
          {title}
          {count !== undefined && (
            <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">{count}</span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 py-2 text-sm text-gray-600 bg-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Parse collapsible sections from content
 * Format: [SECTION:icon:Title]content[/SECTION]
 * Example: [SECTION:📍:Precincts (40)]...[/SECTION]
 */
function parseCollapsibleSections(content: string): { mainContent: string; sections: Array<{ icon: string; title: string; count?: number; content: string }> } {
  const sections: Array<{ icon: string; title: string; count?: number; content: string }> = [];
  let mainContent = content;

  // Match collapsible sections: [SECTION:icon:Title]content[/SECTION]
  const sectionRegex = /\[SECTION:([^:]+):([^\]]+)\]([\s\S]*?)\[\/SECTION\]/g;
  let match;

  // Debug: Check if content contains section markers
  const hasOpenTag = content.includes('[SECTION:');
  const hasCloseTag = content.includes('[/SECTION]');
  if (hasOpenTag || hasCloseTag) {
    console.log('[parseCollapsibleSections] Found markers:', { hasOpenTag, hasCloseTag, contentLength: content.length });
    // Log first occurrence position
    const openPos = content.indexOf('[SECTION:');
    const closePos = content.indexOf('[/SECTION]');
    console.log('[parseCollapsibleSections] Positions:', { openPos, closePos });
    // Log surrounding content
    if (openPos >= 0) {
      console.log('[parseCollapsibleSections] Around open tag:', content.substring(Math.max(0, openPos - 10), openPos + 50));
    }
  }

  while ((match = sectionRegex.exec(content)) !== null) {
    const icon = match[1];
    const titleWithCount = match[2];
    const sectionContent = match[3].trim();

    console.log('[parseCollapsibleSections] Matched section:', { icon, titleWithCount, contentPreview: sectionContent.substring(0, 50) });

    // Extract count from title if present, e.g., "Precincts (40)"
    const countMatch = titleWithCount.match(/^(.+?)\s*\((\d+)\)$/);
    const title = countMatch ? countMatch[1] : titleWithCount;
    const count = countMatch ? parseInt(countMatch[2], 10) : undefined;

    sections.push({ icon, title, count, content: sectionContent });
    mainContent = mainContent.replace(match[0], '');
  }

  if (hasOpenTag && sections.length === 0) {
    console.warn('[parseCollapsibleSections] Section markers found but regex did not match!');
    // Try to understand why - log character codes around the markers
    const openPos = content.indexOf('[SECTION:');
    if (openPos >= 0) {
      const sample = content.substring(openPos, openPos + 30);
      console.log('[parseCollapsibleSections] Character codes:', Array.from(sample).map(c => c.charCodeAt(0)));
    }
  }

  return { mainContent: mainContent.trim(), sections };
}

const MessageContentWithEntities: React.FC<{
  content: string;
  onEntityClick?: (entity: EntityReference) => void;
}> = ({ content, onEntityClick }) => {
  const { segmentTextWithEntities } = require('@/lib/ai/entityParser');

  // Parse collapsible sections first
  const { mainContent: contentAfterSections, sections } = parseCollapsibleSections(content);

  // DEBUG: Log parsing results
  React.useEffect(() => {
    if (content.includes('[SECTION:')) {
      console.log('[MessageContentWithEntities] Content has SECTION tags, parsed sections:', sections.length);
      if (sections.length === 0) {
        console.error('[MessageContentWithEntities] BUG: Section tags found but not parsed!');
        console.log('Content preview:', content.substring(0, 500));
      }
    }
  }, [content, sections.length]);

  // Check if content has complex markdown (headers, tables, code blocks)
  // Use the same strip + normalize pass as enhanceMessage so inline "##" is detected after fixes
  const markdownProbe = normalizeChatMarkdown(stripActionDirectives(contentAfterSections));
  const hasComplexMarkdown =
    /^#{1,6}\s/m.test(markdownProbe) ||
    /^\|.*\|/m.test(markdownProbe) ||
    markdownProbe.includes('```') ||
    /\n[-*]\s/.test(markdownProbe);

  const segments = hasComplexMarkdown ? [] : segmentTextWithEntities(contentAfterSections);

  return (
    <>
      {/* Main content */}
      <div className="text-sm leading-relaxed prose prose-sm max-w-none
        prose-headings:text-base prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:mt-4 prose-headings:mb-2
        prose-h2:text-lg prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-1
        prose-h3:text-base prose-h3:text-gray-800
        prose-p:text-sm prose-p:my-2 prose-p:leading-relaxed
        prose-li:text-sm prose-li:my-1
        prose-ul:my-2 prose-ol:my-2
        prose-strong:font-semibold prose-strong:text-gray-900
        prose-a:text-[#33a852] prose-a:underline
        prose-table:text-sm prose-th:bg-gray-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2
        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {hasComplexMarkdown ? (
          // Complex markdown: render as single block to preserve structure
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{enhanceMessage(contentAfterSections)}</ReactMarkdown>
        ) : (
          // Simple content: enable clickable entities
          segments.map((segment: any, idx: number) => {
            if (segment.type === 'entity' && segment.entity && onEntityClick) {
              return (
                <button
                  key={idx}
                  onClick={() => onEntityClick(segment.entity)}
                  className="inline-flex items-center px-2 py-1 text-[#33a852] bg-green-50 hover:bg-green-100 rounded-md font-medium cursor-pointer transition-colors min-h-[32px] min-w-[44px]"
                  title={`Click to view ${segment.entity.type}: ${segment.content}`}
                >
                  {segment.content}
                </button>
              );
            } else {
              // Use ReactMarkdown for formatting with GFM support
              return <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>{enhanceMessage(segment.content)}</ReactMarkdown>;
            }
          })
        )}
      </div>


      {/* Collapsible sections */}
      {sections.map((section, idx) => (
        <CollapsibleSection
          key={idx}
          title={section.title}
          count={section.count}
          icon={section.icon}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
            {section.content}
          </ReactMarkdown>
        </CollapsibleSection>
      ))}
    </>
  );
};

// ============================================================================
// Error Recovery Helpers (Issue #9)
// ============================================================================

/**
 * Categorize error types and provide context-aware recovery actions
 */
function getErrorRecovery(error: unknown, input: string): { message: string; actions: SuggestedAction[] } {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Network/API errors
  if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return {
      message: "I'm having trouble connecting to the server. This could be a temporary network issue.",
      actions: [
        { id: 'retry', label: 'Try Again', action: input, icon: 'refresh-cw' },
        { id: 'simplify', label: 'Simplify Query', action: 'help', icon: 'help-circle' },
      ],
    };
  }

  // Data not found errors
  if (errorMessage.includes('not found') || errorMessage.includes('no data') || errorMessage.includes('empty')) {
    return {
      message: "I couldn't find data matching your query. The area or entity might not exist in our database.",
      actions: [
        { id: 'browse', label: 'Browse Available Areas', action: 'Show me available precincts', icon: 'search' },
        { id: 'search', label: 'Search Precincts', action: 'Search for precincts in Lansing', icon: 'map-pin' },
      ],
    };
  }

  // Rate limit errors
  if (errorMessage.includes('rate') || errorMessage.includes('429') || errorMessage.includes('too many')) {
    return {
      message: "I'm processing too many requests right now. Please wait a moment and try again.",
      actions: [
        { id: 'wait', label: 'Wait and Retry', action: input, icon: 'refresh-cw' },
      ],
    };
  }

  // Parse/intent errors
  if (errorMessage.includes('parse') || errorMessage.includes('intent') || errorMessage.includes('understand')) {
    return {
      message: "I had trouble understanding your request. Try being more specific or use one of these options:",
      actions: [
        { id: 'examples', label: 'Show Examples', action: 'What can you help me with?', icon: 'help-circle' },
        { id: 'map-click', label: 'Click on Map Instead', action: 'Click on the map to select a precinct', icon: 'map' },
      ],
    };
  }

  // Default fallback
  return {
    message: "Something went wrong processing your request. Here are some things you can try:",
    actions: [
      { id: 'retry', label: 'Try Again', action: input, icon: 'refresh-cw' },
      { id: 'help', label: 'Get Help', action: 'What can you help me with?', icon: 'help-circle' },
      { id: 'examples', label: 'Show Examples', action: 'Show me example questions', icon: 'message-circle' },
    ],
  };
}

// ============================================================================
// Cross-Tool Awareness Helpers (Phase 2)
// ============================================================================

const TOOL_LABELS: Record<ToolType, string> = {
  'political-ai': 'Political Analysis',
  'segments': 'Voter Segmentation',
  'compare': 'Comparison Tool',
  'settings': 'Settings',
};

/**
 * Generate a context-aware greeting based on exploration history
 * Wave 6D.4: Enhanced with high-value finds, saved segments, and cross-tool serendipity
 */
function generateContextAwareGreeting(
  currentTool: ToolType,
  baseGreeting: string
): { greeting: string; additionalSuggestions: SuggestedAction[] } {
  try {
    const stateManager = getStateManager();
    const state = stateManager.getState();
    const metrics = stateManager.getExplorationMetrics();

    // Check if user came from another tool
    const history = state.explorationHistory;
    const previousToolEntry = history
      .slice()
      .reverse()
      .find(entry => entry.tool !== currentTool);

    let greeting = baseGreeting;
    const additionalSuggestions: SuggestedAction[] = [];

    // Wave 6D.4: Get high-value finds from exploration
    const highValuePrecincts = history
      .filter(e => e.metadata?.isHighValue || e.action === 'high_value_find')
      .flatMap(e => e.precinctIds || []);
    const hasHighValueFinds = highValuePrecincts.length > 0;

    // Wave 6D.4: Check for saved segments (on state.segmentation)
    const savedSegments = state.segmentation?.savedSegments || [];
    const recentSegment = savedSegments[savedSegments.length - 1];

    // Wave 6D.5: Cross-tool serendipity - check for donor-GOTV overlap
    // If came from another tool, acknowledge context
    if (previousToolEntry && previousToolEntry.tool) {
      const previousToolLabel = TOOL_LABELS[previousToolEntry.tool] || previousToolEntry.tool;

      // Get precincts from previous tool
      const previousPrecincts = history
        .filter(e => e.tool === previousToolEntry.tool && e.precinctIds?.length)
        .flatMap(e => e.precinctIds || []);

      if (previousPrecincts.length > 0) {
        const uniquePrecincts = [...new Set(previousPrecincts)];
        greeting = `I see you were working with ${previousToolLabel} `;
        greeting += uniquePrecincts.length === 1
          ? `on ${uniquePrecincts[0]}. `
          : `exploring ${uniquePrecincts.length} precincts. `;
        greeting += getCrossToolSuggestion(currentTool, previousToolEntry.tool, uniquePrecincts);

        // Add suggestion to continue with previous context
        if (currentTool === 'compare' && uniquePrecincts.length >= 2) {
          additionalSuggestions.push({
            id: 'continue-context',
            label: `Compare ${uniquePrecincts[0]} and ${uniquePrecincts[1]}`,
            action: `Compare ${uniquePrecincts[0]} to ${uniquePrecincts[1]}`
          });
        }
      }
    }

    // Wave 6D.4: Tool-specific intelligent greetings based on context
    if (!previousToolEntry) {
      switch (currentTool) {
        case 'segments':
          if (hasHighValueFinds) {
            greeting = `You've found ${highValuePrecincts.length} high-value precincts. Want to save them as a segment for targeting?`;
            additionalSuggestions.unshift({
              id: 'save-high-value',
              label: 'Save high-value precincts as segment',
              action: `Create segment from ${highValuePrecincts.slice(0, 3).join(', ')}${highValuePrecincts.length > 3 ? '...' : ''}`,
              icon: 'save'
            });
          } else if (metrics.precinctsViewed >= 3) {
            greeting = `You've explored ${metrics.precinctsViewed} precincts. Want to save them as a targeting segment?`;
          }
          break;

        case 'compare':
          if (metrics.precinctsViewed >= 2) {
            const recentPrecincts = history
              .filter(e => e.precinctIds?.length)
              .flatMap(e => e.precinctIds || [])
              .slice(-2);
            if (recentPrecincts.length >= 2) {
              greeting = `You've been exploring precincts. Want to compare ${recentPrecincts[0]} and ${recentPrecincts[1]}?`;
              additionalSuggestions.unshift({
                id: 'quick-compare',
                label: `Compare ${recentPrecincts[0]} vs ${recentPrecincts[1]}`,
                action: `Compare ${recentPrecincts[0]} to ${recentPrecincts[1]}`
              });
            }
          }
          break;
      }
    }

    // If returning user with session history
    if (metrics.precinctsViewed > 0 && !previousToolEntry && greeting === baseGreeting) {
      greeting += `\n\n📍 *This session: ${metrics.precinctsViewed} precincts explored`;
      if (metrics.filtersApplied > 0) {
        greeting += `, ${metrics.filtersApplied} filters applied`;
      }
      if (hasHighValueFinds) {
        greeting += `, ${highValuePrecincts.length} high-value finds`;
      }
      greeting += `.*`;
    }

    return { greeting, additionalSuggestions };
  } catch {
    // Return default if state manager unavailable
    return { greeting: baseGreeting, additionalSuggestions: [] };
  }
}

/**
 * Get tool-specific cross-tool suggestion text
 */
function getCrossToolSuggestion(
  currentTool: ToolType,
  previousTool: ToolType,
  precincts: string[]
): string {
  const precinctText = precincts.length === 1
    ? `that precinct`
    : `those ${precincts.length} precincts`;

  switch (currentTool) {
    case 'compare':
      return precincts.length >= 2
        ? `Ready to compare these areas? Pick any two to start.`
        : `Select another area to compare with ${precincts[0]}.`;
    case 'segments':
      return `You can build a segment starting with ${precinctText}.`;
    default:
      return baseGreetingForTool(currentTool);
  }
}

function baseGreetingForTool(tool: ToolType): string {
  return getToolConfig(tool).greeting;
}

// ============================================================================
// Main Component
// ============================================================================

export default function UnifiedAIAssistant({
  toolContext,
  onMapCommand,
  onToolAction,
  mapState,
  selectedPrecinct,
  initialGreeting,
  triggerQuery,
  onQueryProcessed,
}: UnifiedAIAssistantProps) {
  const router = useRouter();
  // Memoize config to prevent infinite render loops from object reference changes
  const config = React.useMemo(() => getToolConfig(toolContext), [toolContext]);

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queryContext, setQueryContext] = useState<QueryContext>('general');
  const [showExamples, setShowExamples] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionStartTime] = useState<number>(Date.now());
  const [isInitialized, setIsInitialized] = useState(false); // Track if messages have been initialized (Issue #8)

  // Issue #13: Keyboard shortcut hints visibility
  const [showShortcutHints, setShowShortcutHints] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem('shortcutHintsSeen');
  });

  // Issue #15: Recent queries tracking
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  // Save Segment Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [segmentToSave, setSegmentToSave] = useState<any>(null);

  // Selected map feature from FEATURE_SELECTED events
  const [selectedMapFeature, setSelectedMapFeature] = useState<SelectedFeatureData | null>(null);

  // Confirmation Modal State (Issue #13)
  interface ConfirmationModal {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    isDangerous?: boolean;  // Red styling for dangerous actions
  }
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModal | null>(null);

  // Issue #18: Keyboard shortcuts modal
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Issue #21: Report generation progress
  const [reportProgress, setReportProgress] = useState<{
    isGenerating: boolean;
    stage: string;
    percent: number;
  } | null>(null);

  // Wave 4: Recent Searches dropdown state
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const searchHistoryManager = useRef(getSearchHistoryManager());

  // Wave 4: Performance tracking
  const { metrics: perfMetrics, startTimer, endTimer, resetMetrics } = usePerformanceTracking();

  // Exploration depth tracking
  const [explorationDepth, setExplorationDepth] = useState(0);

  // Confirmation modal helpers
  const showConfirmation = useCallback((
    title: string,
    message: string,
    confirmLabel: string,
    onConfirm: () => void,
    isDangerous = false
  ) => {
    setConfirmationModal({
      isOpen: true,
      title,
      message,
      confirmLabel,
      onConfirm,
      isDangerous,
    });
  }, []);

  const closeConfirmation = useCallback(() => {
    setConfirmationModal(null);
  }, []);

  // Issue #8: Clear chat history
  const clearChatHistory = useCallback(() => {
    const storageKey = `pol_ai_messages_${toolContext}`;
    localStorage.removeItem(storageKey);

    // Reset to greeting message
    const baseGreeting = initialGreeting || config.greeting;
    const { greeting, additionalSuggestions } = generateContextAwareGreeting(toolContext, baseGreeting);
    const allSuggestions = [...additionalSuggestions, ...config.suggestions];

    setMessages([
      {
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
        actions: allSuggestions.slice(0, 5),
      },
    ]);

    toast({
      title: 'Chat history cleared',
      description: 'Your conversation history has been cleared.',
    });
  }, [toolContext, initialGreeting, config.greeting, config.suggestions]);

  // Issue #13: Hide keyboard shortcuts after 10 seconds on first visit
  useEffect(() => {
    if (showShortcutHints) {
      const timer = setTimeout(() => {
        localStorage.setItem('shortcutHintsSeen', 'true');
        setShowShortcutHints(false);
      }, 10000); // Hide after 10 seconds
      return () => clearTimeout(timer);
    }
  }, [showShortcutHints]);

  // Initialize with context-aware greeting message OR restore from localStorage (Phase 2 + S0-H1)
  useEffect(() => {
    // S0-H1: Try to restore messages from localStorage for cross-page persistence
    const storageKey = `pol_ai_messages_${toolContext}`;
    const savedMessages = localStorage.getItem(storageKey);

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // Validate and restore messages (limit to last 50 to prevent bloat)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const restoredMessages: Message[] = parsed.slice(-50).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
          setMessages(restoredMessages);
          setIsInitialized(true);
          console.log(`[UnifiedAIAssistant] Restored ${restoredMessages.length} messages for ${toolContext}`);
          return;
        }
      } catch (error) {
        console.warn('[UnifiedAIAssistant] Failed to restore messages:', error);
        localStorage.removeItem(storageKey);
      }
    }

    // No saved messages - generate context-aware greeting
    const baseGreeting = initialGreeting || config.greeting;
    const { greeting, additionalSuggestions } = generateContextAwareGreeting(toolContext, baseGreeting);

    // Combine default suggestions with context-aware ones
    const allSuggestions = [...additionalSuggestions, ...config.suggestions];

    setMessages([
      {
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
        actions: allSuggestions.slice(0, 5), // Limit to 5 suggestions
      },
    ]);
    setIsInitialized(true);

    // Register with state manager
    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'SESSION_STARTED',
      payload: { tool: toolContext },
      timestamp: new Date(),
    });

    // Log exploration
    stateManager.logExploration({
      tool: toolContext,
      action: 'session_started',
      metadata: { greeting },
    });

    // Subscribe to state events (P1-18)
    const featureUnsubscribe = stateManager.subscribe((state, event) => {
      if (event.type === 'FEATURE_SELECTED') {
        const featureData = state.featureSelection.currentFeature;
        setSelectedMapFeature(featureData);

        // Instant acknowledgment when feature is selected
        if (featureData) {
          console.log('[UnifiedAIAssistant] Feature selected:', featureData.name);

          // Check if last message is already an acknowledgment for this feature to prevent duplicates
          setMessages((prev: Message[]) => {
            const lastMessage = prev[prev.length - 1];
            const featureName = featureData.name || (featureData as any).precinctName || 'Feature';

            if (lastMessage?.isAcknowledgment && lastMessage.content.includes(featureName)) {
              return prev; // Don't duplicate
            }

            // Add instant acknowledgment message
            const acknowledgmentMessage: Message = {
              role: 'assistant',
              content: `📍 **${featureName}** selected. Analyzing...`,
              timestamp: new Date(),
              isAcknowledgment: true,
            };

            return [...prev, acknowledgmentMessage];
          });
        }
      } else if (event.type === 'TOOL_SWITCHED') {
        // Track tool switches for context awareness
        const newTool = event.payload.tool as string;
        console.log('[UnifiedAIAssistant] Tool switched to:', newTool);
        // Update context but don't spam with messages
      } else if (event.type === 'EXPLORATION_LOGGED') {
        // Track exploration depth for output suggestions
        console.log('[UnifiedAIAssistant] Exploration logged:', event.payload);
      } else if (event.type === 'SEGMENT_SAVED') {
        // Acknowledge segment saves
        const segmentName = event.payload.name as string;
        console.log('[UnifiedAIAssistant] Segment saved:', segmentName);
        toast({
          title: 'Segment Saved',
          description: `"${segmentName}" has been saved successfully`,
          duration: 3000,
        });
      } else if (event.type === 'TEMPORAL_MODE_CHANGED') {
        // Update context when viewing time-series data
        const mode = event.payload.mode as string;
        console.log('[UnifiedAIAssistant] Temporal mode changed to:', mode);
        // Update AI context for time-series aware responses
      }
    });

    // Cleanup subscription on unmount
    return () => {
      featureUnsubscribe();
    };
  }, [toolContext, initialGreeting, config.greeting, config.suggestions]);

  // Scroll to bottom on new messages
  useEffect(() => {
    // Use setTimeout to ensure DOM has updated before scrolling
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // S0-H1: Save messages to localStorage when they change (for cross-page persistence)
  useEffect(() => {
    // Skip during initialization to avoid overwriting with empty/greeting
    if (!isInitialized || messages.length === 0) return;

    const storageKey = `pol_ai_messages_${toolContext}`;
    // Filter out loading/error messages and limit to last 50
    const messagesToSave = messages
      .filter(m => !m.isLoading)
      .slice(-50)
      .map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        actions: m.actions,
        confidence: m.confidence,
        isAcknowledgment: m.isAcknowledgment,
        metadata: m.metadata,
      }));

    localStorage.setItem(storageKey, JSON.stringify(messagesToSave));
  }, [messages, toolContext, isInitialized]);

  // Handle programmatically triggered queries (for "Explore relationships" button, etc.)
  useEffect(() => {
    if (triggerQuery && isInitialized) {
      console.log('[UnifiedAIAssistant] Processing triggered query:', triggerQuery);
      handleUserInput(triggerQuery);
      if (onQueryProcessed) {
        onQueryProcessed();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerQuery, isInitialized]);

  // Handle precinct selection with INSTANT response (Issue #7)
  useEffect(() => {
    if (!selectedPrecinct) return;

    // INSTANT acknowledgment - show immediately (Issue #7)
    const loadingMessageId = `loading-${Date.now()}`;
    const instantMessage: Message = {
      role: 'assistant',
      content: `📍 **${selectedPrecinct.precinctName}** selected...`,
      timestamp: new Date(),
      isLoading: true,
      metadata: { messageId: loadingMessageId },
    };

    setMessages((prev: Message[]) => [...prev, instantMessage]);

    // Then generate full response asynchronously
    const generateFullResponse = async () => {
      const suggestionEngine = getSuggestionEngine();
      const aiMessage = suggestionEngine.generatePrecinctSelectionMessage(
        selectedPrecinct.attributes as any
      );

      const suggestions: SuggestedAction[] = aiMessage.suggestions.map(s => ({
        id: s.id,
        label: s.label,
        action: s.action,
        metadata: s.metadata,
      }));

      let content = aiMessage.acknowledgment;
      if (aiMessage.insight) {
        content += '\n\n' + aiMessage.insight;
      }
      content += '\n\n**What would you like to do next?**';

      // Replace loading message with full response
      setMessages((prev: Message[]) => {
        const withoutLoading = prev.filter(m => !m.isLoading || m.metadata?.messageId !== loadingMessageId);
        return [
          ...withoutLoading,
          {
            role: 'assistant',
            content,
            timestamp: new Date(),
            actions: suggestions,
            metadata: { workflow: 'precinct-selection' },
          },
        ];
      });

      // Log exploration
      const stateManager = getStateManager();
      stateManager.logExploration({
        tool: toolContext,
        action: 'precinct_selected',
        precinctIds: [selectedPrecinct.precinctId],
        metadata: { precinctName: selectedPrecinct.precinctName },
      });
    };

    generateFullResponse();
  }, [selectedPrecinct?.precinctId, toolContext]);

  // Handle entity click (from clickable entity names in messages)
  const handleEntityClick = useCallback(async (entity: EntityReference) => {
    const coords = getEntityCoordinates(entity);

    if (coords && onMapCommand) {
      // For municipalities, fly to the coordinates
      onMapCommand({
        type: 'flyTo',
        center: [coords.lng, coords.lat],
        zoom: 13,
      });
      toast({
        title: `📍 ${entity.text}`,
        description: 'Centered on map',
      });
    } else if (entity.type === 'precinct' && onMapCommand) {
      // Normalize precinct name to match data format
      // Convert "East Lansing Precinct 3" → "City of East Lansing, Precinct 3"
      // or "Meridian Township Precinct 1" → "Meridian Township, Precinct 1"
      let normalizedName = entity.text;

      // Add "City of" prefix for city precincts if missing
      if (/^(East Lansing|Lansing|Mason|Williamston)\s+Precinct\s+\d+/i.test(entity.text)) {
        const cityMatch = entity.text.match(/^(East Lansing|Lansing|Mason|Williamston)/i);
        if (cityMatch) {
          const precinctNum = entity.text.match(/Precinct\s+(\d+)/i)?.[1];
          normalizedName = `City of ${cityMatch[1]}, Precinct ${precinctNum}`;
        }
      }
      // Add comma for township precincts
      else if (/Township\s+Precinct/i.test(entity.text)) {
        normalizedName = entity.text.replace(/Township\s+Precinct/i, 'Township, Precinct');
      }

      // Try to get centroid from PoliticalDataService
      try {
        const centroid = await politicalDataService.getPrecinctCentroid(normalizedName);
        if (centroid) {
          // Fly to the centroid coordinates
          onMapCommand({
            type: 'flyTo',
            center: [centroid[0], centroid[1]],
            zoom: 14,
          });
          // Also highlight the precinct
          onMapCommand({
            type: 'highlight',
            target: [normalizedName],
          });
          toast({
            title: `📍 ${entity.text}`,
            description: 'Centered and highlighted on map',
          });
        } else {
          // Fallback: just send to map with the name
          onMapCommand({
            type: 'highlight',
            target: [entity.text],
          });
          onMapCommand({
            type: 'flyTo',
            target: normalizedName,
          });
        }
      } catch (error) {
        console.warn('[handleEntityClick] Error getting precinct centroid:', error);
        // Fallback: let the map try to find it
        onMapCommand({
          type: 'highlight',
          target: [entity.text],
        });
        onMapCommand({
          type: 'flyTo',
          target: entity.text,
        });
      }
    } else if (entity.type === 'zip' && onMapCommand) {
      // For ZIP codes, show donor data option
      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'assistant',
          content: `📍 Showing ZIP code ${entity.text}. Would you like to see donor data for this area?`,
          timestamp: new Date(),
          actions: [
            { id: 'donor-data', label: 'Show donor data', action: `Show donor data for ZIP ${entity.text}` },
            { id: 'demographics', label: 'Show demographics', action: `Show demographics for ZIP ${entity.text}` },
          ],
        },
      ]);
    }

    // Log the entity click
    const stateManager = getStateManager();
    stateManager.logExploration({
      tool: toolContext,
      action: 'entity_clicked',
      metadata: { entityType: entity.type, entityText: entity.text },
    });
  }, [onMapCommand, toolContext]);

  // ---------------------------------------------------------------------------
  // Exploration Depth Tracking - Update depth indicator
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const updateDepth = () => {
      const stateManager = getStateManager();
      const depth = stateManager.getExplorationDepth();
      setExplorationDepth(depth);
    };

    // Update on mount and subscribe to changes
    updateDepth();
    const interval = setInterval(updateDepth, 5000); // Update every 5s

    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------------------------
  // Idle Time Tracking - Update state manager with user activity (Phase 1)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const stateManager = getStateManager();

    // Update idle time every 5 seconds
    const idleInterval = setInterval(() => {
      stateManager.dispatch({
        type: 'USER_IDLE',
        payload: {},
        timestamp: new Date(),
      });
    }, 5000);

    // Reset idle on user interaction
    const resetIdle = () => {
      stateManager.dispatch({
        type: 'USER_ACTIVE',
        payload: {},
        timestamp: new Date(),
      });
    };

    // Listen for user activity
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('click', resetIdle);
    window.addEventListener('scroll', resetIdle);

    return () => {
      clearInterval(idleInterval);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('click', resetIdle);
      window.removeEventListener('scroll', resetIdle);
    };
  }, []);

  // Execute map command with toast notification (Issue #8)
  const executeMapCommand = useCallback((command: MapCommand) => {
    console.log('[UnifiedAIAssistant] Executing map command:', command);

    // Show toast feedback based on command type (Issue #8)
    const feedbackMessages: Record<string, string> = {
      'highlight': `Highlighting ${Array.isArray(command.target) ? command.target.length : 'selected'} precinct${Array.isArray(command.target) && command.target.length > 1 ? 's' : ''}`,
      'showHeatmap': `Showing ${command.metric || 'data'} heatmap`,
      'showChoropleth': `Displaying ${command.metric || 'metric'} choropleth`,
      'flyTo': `Navigating to location`,
      'fitBounds': `Adjusting map view`,
      'resetView': `Resetting map view`,
      'showBivariate': `Displaying bivariate visualization`,
      'showProportional': `Showing proportional symbols`,
      'showValueByAlpha': `Displaying value by transparency`,
      'showClusters': `Highlighting ${command.clusters?.length || 0} cluster${command.clusters?.length !== 1 ? 's' : ''}`,
      'showOptimizedRoute': `Displaying canvassing route`,
      'showBuffer': `Showing ${command.bufferDistance} ${command.bufferUnit || 'km'} buffer`,
      'showNumberedMarkers': `Showing ${command.numberedMarkers?.length || 0} numbered location${command.numberedMarkers?.length !== 1 ? 's' : ''}`,
      'clearHighlight': `Clearing highlights`,
      'clear': `Clearing map`,
    };

    const message = command.type ? (feedbackMessages[command.type] || `Executing: ${command.type}`) : 'Executing command';

    toast({
      title: message,
      duration: 4000,
      variant: 'default',
    });

    // Execute the actual command
    if (onMapCommand) {
      onMapCommand(command);
    }
  }, [onMapCommand]);

  // Handle user input
  const handleUserInput = useCallback(async (input: string) => {
    if (!input.trim()) return;

    // Wave 4: Start performance tracking
    resetMetrics();
    startTimer('aiQuery');

    // Issue #15: Track recent queries (legacy state)
    setRecentQueries((prev: string[]) => {
      const newQueries = [input, ...prev.filter(q => q !== input)].slice(0, 5);
      return newQueries;
    });

    // Wave 4: Add to persistent search history
    searchHistoryManager.current.add(input, toolContext);

    // Close recent searches dropdown
    setShowRecentSearches(false);

    const stateManager = getStateManager();

    // Check for slash commands first
    if (isSlashCommand(input)) {
      const cmdResult = executeSlashCommand(input);

      if (cmdResult.handled) {
        // Add user message
        setMessages((prev: Message[]) => [
          ...prev,
          { role: 'user', content: input, timestamp: new Date() },
        ]);

        // Handle clear command
        if (cmdResult.clearChat) {
          setMessages([{
            role: 'assistant',
            content: cmdResult.response || 'Chat cleared.',
            timestamp: new Date(),
          }]);
          return;
        }

        // Handle navigation
        if (cmdResult.navigation) {
          router.push(cmdResult.navigation);
        }

        // Execute map commands sequentially with small delays
        if (cmdResult.mapCommands && cmdResult.mapCommands.length > 0) {
          console.log(`[UnifiedAIAssistant] Executing ${cmdResult.mapCommands.length} slash command map commands`);
          cmdResult.mapCommands.forEach((cmd, index) => {
            setTimeout(() => {
              executeMapCommand(cmd);
            }, index * 150); // 150ms delay between commands
          });
        }

        // Handle tool actions
        if (cmdResult.toolAction && onToolAction) {
          onToolAction({
            type: cmdResult.toolAction.type as ToolAction['type'],
            payload: cmdResult.toolAction.payload,
          });
        }

        // Add assistant response
        setMessages((prev: Message[]) => [
          ...prev,
          {
            role: 'assistant',
            content: cmdResult.response || 'Command executed.',
            timestamp: new Date(),
            actions: cmdResult.suggestedActions,
            metadata: { mapCommands: cmdResult.mapCommands },
          },
        ]);

        return;
      }
    }

    // Track query
    stateManager.dispatch({
      type: 'USER_QUERY_SUBMITTED',
      payload: { query: input },
      timestamp: new Date(),
    });

    // Detect query context for contextual loading messages
    setQueryContext(detectQueryContext(input));

    // Add user message
    setMessages((prev: Message[]) => [
      ...prev,
      { role: 'user', content: input, timestamp: new Date() },
    ]);
    setIsProcessing(true);

    try {
      // Build context message
      let contextMessage = input;
      if (selectedMapFeature) {
        contextMessage = `[CONTEXT: User clicked ${selectedMapFeature.name} on map]\n\n${input}`;
      } else if (selectedPrecinct) {
        contextMessage = `[CONTEXT: Viewing ${selectedPrecinct.precinctName}]\n\n${input}`;
      } else if (mapState?.selectedBoundaries && mapState.selectedBoundaries.ids.length > 0) {
        contextMessage = `[CONTEXT: ${mapState.selectedBoundaries.ids.length} ${mapState.selectedBoundaries.type} selected]\n\n${input}`;
      }

      // Parse intent (for report/output context and escalation logic)
      const intent = parseIntent(contextMessage);

      // Define result type
      let result: { response: string; mapCommands?: MapCommand[]; suggestedActions?: SuggestedAction[] };

      // Special handling for report/output requests (need component context)
      if (intent.type === 'report_history') {
        result = await handleReportHistoryRequest();
      } else if (intent.type === 'report_request') {
        if (intent.reportParams?.requestType === 'customize') {
          result = await handleReportCustomization(intent.reportParams.reportType);
        } else {
          const explorationMetrics = stateManager.getExplorationMetrics();
          const reportContext: any = {
            precinctsExplored: explorationMetrics.precinctsViewed,
            hasActiveSegment: false,
            segmentPrecinctCount: 0,
            hasComparisonData: false,
            currentTool: toolContext,
            hasMapSelection: !!selectedPrecinct,
            selectedPrecinctNames: selectedPrecinct ? [selectedPrecinct.precinctName] : undefined,
          };
          result = await handleReportIntent(
            intent.reportParams || { requestType: 'generate' },
            reportContext
          );
        }
      } else if (intent.type === 'output_request') {
        if (intent.outputParams) {
          const explorationMetrics = stateManager.getExplorationMetrics();
          const outputContext = {
            precinctsExplored: explorationMetrics.precinctsViewed,
            hasActiveSegment: false,
            segmentPrecinctCount: 0,
            hasAnalysisResults: true,
            messageCount: messages.length,
            currentTool: toolContext,
            hasMapSelection: !!selectedPrecinct,
          };
          result = await handleOutputIntent(intent.outputParams, outputContext);
        } else {
          result = {
            response: "I can help you save or export your work. What would you like to do?",
            suggestedActions: config.suggestions,
          };
        }
      } else {
        // Route through ToolOrchestrator for all other intents
        console.log('[UnifiedAIAssistant] Routing through ToolOrchestrator:', { query: contextMessage.substring(0, 100) });
        const orchestratorResult = await processQuery(contextMessage);

        // Check if we should escalate to Claude for complex/analytical queries
        const isAnalyticalQuery = /\b(why|how|explain|analyze|what do you think|help me understand|tell me about|what's the difference|compare|strategy|recommend)\b/i.test(input);
        const isMultiPartQuery = (input.match(/\?/g) || []).length > 1 || /\b(and also|additionally|furthermore|also tell me)\b/i.test(input);
        const isOpinionQuery = /\b(should i|would you|do you think|best|worst|opinion|advice)\b/i.test(input);
        const isContextualQuery = /\b(earlier|before|we discussed|you mentioned|last time|previous)\b/i.test(input);
        const matchedIntent = orchestratorResult.metadata?.parsedIntent || orchestratorResult.metadata?.matchedIntent;
        const isUnknownIntent = matchedIntent === 'unknown' || !orchestratorResult.success;

        const shouldEscalateToClaude =
          isUnknownIntent ||
          input.length > 150 ||
          isAnalyticalQuery ||
          isMultiPartQuery ||
          isOpinionQuery ||
          isContextualQuery;

        if (shouldEscalateToClaude) {
          // Escalate to Claude for complex/unknown queries
          console.log('[UnifiedAIAssistant] Escalating to Claude:', {
            matchedIntent,
            inputLength: input.length,
            reasons: { isUnknownIntent, isAnalyticalQuery, isMultiPartQuery, isOpinionQuery, isContextualQuery }
          });

          try {
            const sessionContext = stateManager.getContextForAI();
            const recentMessages = messages.slice(-15);
            const formattedMessages = recentMessages.map((m, idx) => {
              let content = m.content;
              if (idx < recentMessages.length - 5 && m.metadata?.workflow) {
                content = `[${m.metadata.workflow}] ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
              }
              return { role: m.role, content };
            });
            formattedMessages.push({ role: 'user' as const, content: input });

            const behaviorState = stateManager.getBehaviorState();
            const userContext = {
              exploredPrecincts: Array.from(behaviorState.exploredPrecincts),
              currentTool: toolContext,
              recentQueries: behaviorState.queriesAsked.slice(-5),
              expertiseLevel: stateManager.getUserExpertiseLevel(),
              sessionDuration: Date.now() - sessionStartTime,
            };

            const claudeResponse = await fetchWithRetry('/api/political-chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: formattedMessages,
                context: sessionContext,
                currentQuery: input,
                includeData: true,
                userContext
              })
            });

            if (claudeResponse.ok) {
              const claudeData = await claudeResponse.json();
              result = {
                response: claudeData.content,
                mapCommands: claudeData.mapCommands || [],
                suggestedActions: config.suggestions,
              };
              console.log('[UnifiedAIAssistant] Claude response received successfully');
            } else {
              const errorText = await claudeResponse.text().catch(() => 'Unknown error');
              console.warn('[UnifiedAIAssistant] Claude escalation failed:', claudeResponse.status, errorText);
              toast({
                title: 'Connection Issue',
                description: `Failed to reach AI service (HTTP ${claudeResponse.status}). Please try again.`,
                variant: 'destructive',
              });
              result = {
                response: "I'm having trouble connecting to the AI service right now. Please try again in a moment.",
                suggestedActions: [
                  { id: 'retry', label: '🔄 Retry', action: input, icon: 'refresh-cw' },
                  ...config.suggestions.slice(0, 3),
                ],
              };
            }
          } catch (escalationError) {
            console.error('[UnifiedAIAssistant] Claude escalation error:', escalationError);
            const errorMessage = escalationError instanceof Error ? escalationError.message : 'Unknown error occurred';
            toast({
              title: 'Network Error',
              description: `Unable to process your request: ${errorMessage}. Please check your connection and try again.`,
              variant: 'destructive',
            });
            result = {
              response: "⚠️ I'm having trouble connecting to the AI service. This might be a temporary network issue.",
              suggestedActions: [
                { id: 'retry', label: '🔄 Retry', action: input, icon: 'refresh-cw' },
                ...config.suggestions.slice(0, 3),
              ],
            };
          }
        } else {
          // Use orchestrator result
          console.log('[UnifiedAIAssistant] Using ToolOrchestrator result:', { intent: matchedIntent, success: orchestratorResult.success });
          result = {
            response: orchestratorResult.response,
            mapCommands: orchestratorResult.mapCommands || [],
            suggestedActions: orchestratorResult.suggestedActions || config.suggestions,
          };
        }
      }

      // Add assistant response
      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          actions: result.suggestedActions,
          metadata: { mapCommands: result.mapCommands },
        },
      ]);

      // Execute map commands sequentially with small delays
      if (result.mapCommands && result.mapCommands.length > 0) {
        console.log(`[UnifiedAIAssistant] Executing ${result.mapCommands.length} map commands`);
        result.mapCommands.forEach((cmd: MapCommand, index: number) => {
          setTimeout(() => {
            executeMapCommand(cmd);
          }, index * 150); // 150ms delay between commands
        });
      }

      // Check for numbered entities in response and show markers
      const numberedEntities = extractNumberedEntities(result.response);
      if (numberedEntities.length > 0 && onMapCommand) {
        const markers = numberedEntities.map(({ number, entity }) => ({
          precinctId: entity.text,
          number,
          label: entity.text,
        }));

        onMapCommand({
          type: 'showNumberedMarkers',
          numberedMarkers: markers,
        });
      }

      // Log exploration
      stateManager.logExploration({
        tool: toolContext,
        action: 'query',
        result: result.response.substring(0, 100),
        metadata: { intent: intent.type },
      });

    } catch (error) {
      console.error('[UnifiedAIAssistant] Error processing query:', error);

      const recovery = getErrorRecovery(error, input);

      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'assistant',
          content: recovery.message,
          timestamp: new Date(),
          isError: true,
          actions: recovery.actions,
        },
      ]);
    } finally {
      setIsProcessing(false);
      // Wave 4: End performance tracking
      endTimer('aiQuery');
      // Notify tour that AI response is complete (enables Next button if tour is waiting)
      notifyTourAIResponseComplete();
    }
  }, [selectedPrecinct, selectedMapFeature, mapState, config.suggestions, executeMapCommand, toolContext, resetMetrics, startTimer, endTimer]);

  // ---------------------------------------------------------------------------
  // Keyboard Shortcuts (P3-2) - Must come after handleUserInput is defined
  // ---------------------------------------------------------------------------

  // Keep Cmd+Enter handler for submit (input-specific)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to submit (when input is focused)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        if (inputValue.trim()) {
          handleUserInput(inputValue);
          setInputValue('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputValue, handleUserInput]);

  // Handle action click
  const handleActionClick = useCallback(async (action: SuggestedAction) => {
    console.log('[UnifiedAIAssistant] handleActionClick called with:', action);

    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'SUGGESTION_ACCEPTED',
      payload: { suggestionId: action.id },
      timestamp: new Date(),
    });

    // Handle navigation with context
    if (action.action.startsWith('navigate:')) {
      // Parse the navigation command
      const navContext = CrossToolNavigator.parseNavigateCommand(action.action);

      if (navContext) {
        // Use CrossToolNavigator for context-aware navigation
        CrossToolNavigator.navigateWithContext(
          navContext.tool,
          navContext.params,
          true // preserve history
        );
      } else {
        // Fallback to simple navigation (for backward compatibility)
        const destination = action.action.replace('navigate:', '');
        router.push(destination);
      }

      if (onToolAction) {
        onToolAction({ type: 'navigate', payload: { destination: action.action } });
      }
      return;
    }

    // Handle map commands
    if (action.action.startsWith('map:')) {
      const [, commandType] = action.action.split(':');
      const command: MapCommand = {
        type: commandType as MapCommand['type'],
        ...action.metadata,
      };
      console.log('[UnifiedAIAssistant] Executing map command from button click:', command);
      executeMapCommand(command);

      // Add confirmation message
      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'assistant',
          content: `Executing map command: ${commandType}`,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // Handle tool actions
    if (action.action.startsWith('tool:')) {
      const [, actionType] = action.action.split(':');
      if (onToolAction) {
        onToolAction({
          type: actionType as ToolAction['type'],
          payload: action.metadata || {},
        });
      }
      return;
    }

    // Handle report actions (Phase B - Report Templates)
    if (action.action.startsWith('report:')) {
      const [, reportType] = action.action.split(':');
      await handleReportAction(reportType as 'executive' | 'targeting' | 'profile' | 'comparison' | 'segment', action.metadata || {});
      return;
    }

    // Handle output actions (Phase 8)
    if (action.action.startsWith('output:')) {
      const [, outputType] = action.action.split(':');
      await handleOutputAction(outputType as 'saveSegment' | 'exportCSV' | 'exportVAN' | 'generateReport' | 'planCanvass' | 'exportConversation', action.metadata || {});
      return;
    }

    // Handle comparison actions - prompt for second entity
    if (action.action === 'start_comparison' || action.action === 'compare_neighbors' || action.action === 'compare_municipalities') {
      const stateManager = getStateManager();
      const state = stateManager.getState();

      // Get the current selection or context
      const currentEntity = selectedPrecinct?.precinctName ||
        state.selection.selectedIds[0] ||
        action.metadata?.entityId;

      if (currentEntity) {
        // We have a first entity - ask for the second one
        setMessages((prev: Message[]) => [
          ...prev,
          {
            role: 'assistant',
            content: `You want to compare **${currentEntity}**. What would you like to compare it with?\n\nYou can:\n- Type an area name (e.g., "East Lansing", "Meridian Township")\n- Click another precinct on the map\n- Ask me to find similar areas`,
            timestamp: new Date(),
            actions: [
              { id: 'find-similar', label: `Find areas similar to ${currentEntity}`, action: `Find precincts similar to ${currentEntity}`, icon: 'search' },
              { id: 'suggest-comparison', label: 'Suggest a comparison', action: `What would be a good comparison for ${currentEntity}?`, icon: 'git-compare' },
            ],
          },
        ]);

        // Set a flag to expect comparison input
        stateManager.dispatch({
          type: 'COMPARISON_STARTED',
          payload: { firstEntity: currentEntity, waitingForSecond: true },
          timestamp: new Date(),
        });
      } else {
        // No current selection - ask user to select first
        setMessages((prev: Message[]) => [
          ...prev,
          {
            role: 'assistant',
            content: `To compare areas, first select a precinct or jurisdiction.\n\nYou can:\n- Click a precinct on the map\n- Type an area name (e.g., "Compare East Lansing to Lansing")\n- Ask me to compare specific areas`,
            timestamp: new Date(),
            actions: [
              { id: 'compare-example', label: 'Compare Lansing vs East Lansing', action: 'Compare Lansing to East Lansing', icon: 'git-compare' },
              { id: 'show-map', label: 'Show map to select', action: 'map:showChoropleth', icon: 'map' },
            ],
          },
        ]);
      }
      return;
    }

    // Handle compare_history action (compare recently explored precincts)
    if (action.action === 'compare_history') {
      const stateManager = getStateManager();
      const state = stateManager.getState();
      const recentPrecincts = state.explorationHistory
        .filter(h => h.action === 'precinct_selected' || h.action === 'precinct_viewed')
        .slice(-5)
        .map(h => h.metadata?.precinctId || h.metadata?.precinctName)
        .filter((id): id is string => typeof id === 'string');

      if (recentPrecincts.length >= 2) {
        // Compare the two most recent
        const first = recentPrecincts[recentPrecincts.length - 2];
        const second = recentPrecincts[recentPrecincts.length - 1];
        await handleUserInput(`Compare ${first} to ${second}`);
      } else {
        setMessages((prev: Message[]) => [
          ...prev,
          {
            role: 'assistant',
            content: 'You need to explore at least 2 precincts before comparing your exploration history. Click on precincts on the map or ask about specific areas first.',
            timestamp: new Date(),
          },
        ]);
      }
      return;
    }

    // Default: treat as user input
    await handleUserInput(action.action);
  }, [executeMapCommand, handleUserInput, onToolAction, router, selectedPrecinct]);

  // Handle save segment modal confirmation
  const handleSaveSegmentConfirm = useCallback(() => {
    if (!segmentName.trim() || !segmentToSave) return;

    const stateManager = getStateManager();
    const now = new Date().toISOString();
    const segmentId = `segment-${Date.now()}`;

    // Use SegmentStore for proper persistence
    segmentStore.save({
      id: segmentId,
      name: segmentName.trim(),
      description: `Saved from AI conversation on ${new Date().toLocaleDateString()}`,
      filters: segmentToSave.filters || {},
      cachedResults: {
        matchingPrecincts: segmentToSave.precinctIds || [],
        summary: { totalPrecincts: segmentToSave.precinctIds?.length || 0 }
      } as any,
      createdAt: now,
      updatedAt: now,
    });

    // Update state
    stateManager.dispatch({
      type: 'SEGMENT_SAVED',
      payload: { name: segmentName.trim() },
      timestamp: new Date(),
    });

    // Log exploration
    stateManager.logExploration({
      tool: toolContext,
      action: 'segment_saved',
      metadata: { segmentName: segmentName.trim(), precinctCount: segmentToSave.precinctIds?.length || 0 },
    });

    // Show success message
    setMessages((prev: Message[]) => [
      ...prev,
      {
        role: 'assistant',
        content: `✅ Saved segment "${segmentName.trim()}" with ${segmentToSave.precinctIds?.length || 0} precincts. View it in Settings → Saved Segments.`,
        timestamp: new Date(),
        actions: [
          { id: 'view-segments', label: 'View in Settings', action: 'navigate:/settings', icon: 'settings' },
          { id: 'continue', label: 'Continue exploring', action: 'What else can I analyze?', icon: 'search' }
        ],
      },
    ]);

    // Reset modal state
    setShowSaveModal(false);
    setSegmentToSave(null);
    setSegmentName('');
  }, [segmentName, segmentToSave, toolContext]);

  // Handle output actions
  const handleOutputAction = useCallback(async (
    outputType: 'saveSegment' | 'exportCSV' | 'exportVAN' | 'generateReport' | 'planCanvass' | 'exportConversation',
    metadata: Record<string, unknown>
  ) => {
    const stateManager = getStateManager();

    switch (outputType) {
      case 'saveSegment': {
        // Prepare segment data and show modal instead of prompt
        const state = stateManager.getState();

        setSegmentToSave({
          precinctIds: (metadata.precinctIds as string[]) || state.segmentation.matchingPrecincts || [],
          filters: state.segmentation.activeFilters || {},
        });
        setSegmentName(`Segment ${new Date().toLocaleDateString()}`);
        setShowSaveModal(true);

        // User feedback
        toast({
          title: 'Save Segment',
          description: 'Enter a name for your segment',
          duration: 2000,
        });
        return; // Don't save yet - wait for modal confirmation
      }

      case 'exportCSV': {
        // Show confirmation before export
        const state = stateManager.getState();
        const targetIds = (metadata.precinctIds as string[]) || state.segmentation.matchingPrecincts || [];
        const precinctCount = targetIds.length > 0 ? targetIds.length : 'all';

        showConfirmation(
          'Export Data',
          `This will download ${precinctCount} precinct${precinctCount !== 1 && precinctCount !== 'all' ? 's' : ''} as a CSV file. Continue?`,
          'Export',
          async () => {
            try {
              // Fetch real precinct data
              const response = await fetch('/api/segments?action=precincts');
              const data = await response.json();

              if (!data.success || !data.precincts) {
                throw new Error('Failed to fetch precinct data');
              }

              const allPrecincts = data.precincts;

              // Filter to matching precincts, or use all if none specified
              const precinctsToExport = targetIds.length > 0
                ? allPrecincts.filter((p: any) => targetIds.includes(p.id))
                : allPrecincts;

              // Build CSV with real data
              const headers = [
                'Precinct ID',
                'Precinct Name',
                'Jurisdiction',
                'Registered Voters',
                'Swing Potential',
                'GOTV Priority',
                'Persuasion Score',
                'Partisan Lean',
                'Turnout Rate'
              ];

              const rows = precinctsToExport.map((p: any) => [
                p.id,
                `"${p.name}"`,
                `"${p.jurisdiction}"`,
                p.demographics?.population18up || 0,
                Math.round(p.targeting?.swingPotential || p.electoral?.swingPotential || 0),
                Math.round(p.targeting?.gotvPriority || 0),
                Math.round(p.targeting?.persuasionOpportunity || 0),
                (p.electoral?.partisanLean || 0).toFixed(1),
                ((p.electoral?.avgTurnout || 0) * 100).toFixed(1) + '%'
              ].join(','));

              const csvContent = [headers.join(','), ...rows].join('\n');

              // Trigger download
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `ingham-precincts-${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
              URL.revokeObjectURL(url);

              // Log and confirm
              stateManager.logExploration({
                tool: toolContext,
                action: 'csv_exported',
                metadata: { precinctCount: precinctsToExport.length },
              });

              setMessages((prev: Message[]) => [
                ...prev,
                {
                  role: 'assistant',
                  content: `✅ Exported ${precinctsToExport.length} precincts to CSV with full targeting data.`,
                  timestamp: new Date(),
                },
              ]);
              closeConfirmation();
            } catch (error) {
              console.error('CSV export error:', error);
              setMessages((prev: Message[]) => [
                ...prev,
                {
                  role: 'assistant',
                  content: `❌ Failed to export CSV. Please try again.`,
                  timestamp: new Date(),
                },
              ]);
              closeConfirmation();
            }
          }
        );
        break;
      }

      case 'exportVAN': {
        // Show confirmation before export
        const state = stateManager.getState();
        const targetIds = (metadata.precinctIds as string[]) || state.segmentation.matchingPrecincts || [];
        const precinctCount = targetIds.length > 0 ? targetIds.length : 'all';

        showConfirmation(
          'Export VAN File',
          `This will download ${precinctCount} precinct${precinctCount !== 1 && precinctCount !== 'all' ? 's' : ''} in VAN-compatible format. Continue?`,
          'Export',
          async () => {
            try {
              // Fetch real precinct data
              const response = await fetch('/api/segments?action=precincts');
              const data = await response.json();

              if (!data.success || !data.precincts) {
                throw new Error('Failed to fetch precinct data');
              }

              const allPrecincts = data.precincts;

              // Filter to matching precincts
              const precinctsToExport = targetIds.length > 0
                ? allPrecincts.filter((p: any) => targetIds.includes(p.id))
                : allPrecincts;

              // Build VAN-compatible CSV
              const headers = [
                'PrecinctCode',
                'PrecinctName',
                'Jurisdiction',
                'EstimatedVoters',
                'SupportScore',
                'TurnoutScore',
                'PersuasionScore',
                'Priority',
                'ContactMethod',
                'Notes'
              ];

              const rows = precinctsToExport.map((p: any) => {
                // Convert partisan lean to support score (1-5 scale)
                // Negative lean = Democratic = lower support score number
                const lean = p.electoral?.partisanLean || 0;
                let supportScore: number;
                if (lean <= -15) supportScore = 1;      // Strong D
                else if (lean <= -5) supportScore = 2;  // Lean D
                else if (lean <= 5) supportScore = 3;   // Toss-up
                else if (lean <= 15) supportScore = 4;  // Lean R
                else supportScore = 5;                   // Strong R

                // Convert GOTV priority (0-100) to VAN turnout score (1-100)
                const turnoutScore = Math.round(p.targeting?.gotvPriority || 50);

                // Persuasion score (0-100)
                const persuasionScore = Math.round(p.targeting?.persuasionOpportunity || 50);

                // Priority based on combined score
                const matchScore = p.targeting?.combinedScore || 50;
                const priority = matchScore >= 80 ? 'High'
                  : matchScore >= 60 ? 'Medium'
                    : 'Low';

                // Determine contact method based on targeting strategy
                const strategy = p.targeting?.strategy || '';
                let contactMethod = 'Door';
                if (strategy.toLowerCase().includes('persuasion')) contactMethod = 'Door';
                else if (strategy.toLowerCase().includes('gotv')) contactMethod = 'Phone';
                else if (strategy.toLowerCase().includes('mail')) contactMethod = 'Mail';

                // Notes with targeting recommendation
                const swingPotential = Math.round(p.targeting?.swingPotential || 0);
                const notes = `Swing: ${swingPotential}, Strategy: ${strategy}`;

                return [
                  p.id,
                  `"${p.name}"`,
                  `"${p.jurisdiction}"`,
                  p.demographics?.population18up || 0,
                  supportScore,
                  turnoutScore,
                  persuasionScore,
                  priority,
                  contactMethod,
                  `"${notes}"`
                ].join(',');
              });

              const csvContent = [headers.join(','), ...rows].join('\n');

              // Trigger download
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `van-export-${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
              URL.revokeObjectURL(url);

              stateManager.logExploration({
                tool: toolContext,
                action: 'van_exported',
                metadata: { precinctCount: precinctsToExport.length },
              });

              setMessages((prev: Message[]) => [
                ...prev,
                {
                  role: 'assistant',
                  content: `✅ Exported ${precinctsToExport.length} precincts in VAN-compatible format.\n\n**Columns included:**\n- SupportScore (1-5 scale: 1=Strong D, 5=Strong R)\n- TurnoutScore (0-100 likelihood to vote)\n- PersuasionScore (0-100 persuadability)\n- Priority (High/Medium/Low based on combined score)\n- ContactMethod (Door/Phone/Mail recommendation)\n\n**Ready for import into VoteBuilder.**`,
                  timestamp: new Date(),
                },
              ]);
              closeConfirmation();
            } catch (error) {
              console.error('VAN export error:', error);
              setMessages((prev: Message[]) => [
                ...prev,
                {
                  role: 'assistant',
                  content: `❌ Failed to export VAN file. Please try again.`,
                  timestamp: new Date(),
                },
              ]);
              closeConfirmation();
            }
          }
        );
        break;
      }

      case 'generateReport': {
        const state = stateManager.getState();
        const metrics = stateManager.getExplorationMetrics();

        // Issue #21: Show detailed progress stages
        const generateWithProgress = async () => {
          try {
            // Stage 1: Gathering data
            setReportProgress({ isGenerating: true, stage: 'Gathering precinct data...', percent: 10 });
            await new Promise(resolve => setTimeout(resolve, 400));

            // Stage 2: Analyzing demographics
            setReportProgress({ isGenerating: true, stage: 'Analyzing demographics and electoral data...', percent: 35 });
            await new Promise(resolve => setTimeout(resolve, 500));

            // Stage 3: Calculating metrics
            setReportProgress({ isGenerating: true, stage: 'Calculating targeting scores and metrics...', percent: 60 });
            await new Promise(resolve => setTimeout(resolve, 400));

            // Stage 4: Generating visualizations
            setReportProgress({ isGenerating: true, stage: 'Generating visualizations and charts...', percent: 80 });
            await new Promise(resolve => setTimeout(resolve, 500));

            // Stage 5: Finalizing
            setReportProgress({ isGenerating: true, stage: 'Finalizing report...', percent: 95 });
            await new Promise(resolve => setTimeout(resolve, 300));

            // Navigate to report page with context
            if (onToolAction) {
              onToolAction({
                type: 'navigate',
                payload: {
                  destination: '/reports',
                  context: {
                    precincts: state.segmentation.matchingPrecincts,
                    explorationDepth: stateManager.getExplorationDepth(),
                    summary: stateManager.getExplorationSummary(),
                  },
                },
              });
            }

            // Log exploration
            stateManager.logExploration({
              tool: toolContext,
              action: 'report_generated',
              metadata: { depth: stateManager.getExplorationDepth(), precinctCount: metrics.precinctsViewed },
            });

            setReportProgress(null);

            setMessages((prev: Message[]) => [
              ...prev,
              {
                role: 'assistant',
                content: `✅ Report generated successfully! Analyzed ${metrics.precinctsViewed} precincts across ${metrics.toolsVisited.length} tools.`,
                timestamp: new Date(),
              },
            ]);
          } catch (error) {
            console.error('Report generation error:', error);
            setReportProgress(null);
            setMessages((prev: Message[]) => [
              ...prev,
              {
                role: 'assistant',
                content: `❌ Failed to generate report. Please try again.`,
                timestamp: new Date(),
                isError: true,
              },
            ]);
          }
        };

        generateWithProgress();
        break;
      }

      case 'exportConversation': {
        // Format conversation as text
        const conversationText = messages.map((msg) => {
          const timestamp = msg.timestamp.toLocaleString();
          const role = msg.role === 'user' ? 'You' : 'AI Assistant';
          return `[${timestamp}] ${role}:\n${msg.content}\n`;
        }).join('\n---\n\n');

        // Add header with context
        const header = [
          '# Political Analysis Conversation Export',
          `Exported: ${new Date().toLocaleString()}`,
          `Tool: ${toolContext}`,
          `Messages: ${messages.length}`,
          '',
          '---',
          '',
        ].join('\n');

        const fullContent = header + conversationText;

        // Trigger download
        const blob = new Blob([fullContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `conversation-${toolContext}-${Date.now()}.txt`;
        link.click();
        URL.revokeObjectURL(url);

        // Log exploration
        stateManager.logExploration({
          tool: toolContext,
          action: 'conversation_exported',
          metadata: { messageCount: messages.length },
        });

        setMessages((prev: Message[]) => [
          ...prev,
          {
            role: 'assistant',
            content: `✅ Conversation exported (${messages.length} messages). Check your downloads folder.`,
            timestamp: new Date(),
          },
        ]);
        break;
      }
    }
  }, [toolContext, onToolAction, messages, showConfirmation, closeConfirmation]);

  // Handle report generation actions
  const handleReportAction = useCallback(async (
    reportType: 'executive' | 'targeting' | 'profile' | 'comparison' | 'segment',
    metadata: Record<string, unknown>
  ) => {
    const stateManager = getStateManager();
    const state = stateManager.getState();

    // Get precincts from metadata or state
    const precinctNames = (metadata.precinctNames as string[]) ||
      state.segmentation.matchingPrecincts ||
      (selectedPrecinct ? [selectedPrecinct.precinctName] : []);

    if (precinctNames.length === 0) {
      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ No precincts selected. Please select precincts on the map or build a segment first.',
          timestamp: new Date(),
          actions: [
            { id: 'go-to-map', label: 'Go to Map', action: 'navigate:/political-ai' },
            { id: 'build-segment', label: 'Build Segment', action: 'navigate:/segments' },
          ],
        },
      ]);
      return;
    }

    // Get report config for emoji and label
    const reportConfig = REPORT_TYPE_CONFIG[reportType] || { emoji: '📄', label: reportType };

    // Show generating message with progress indicator
    const generatingMessageId = `generating-${Date.now()}`;
    setMessages((prev: Message[]) => [
      ...prev,
      {
        role: 'assistant',
        content: `${reportConfig.emoji} **Generating ${reportConfig.label}...**\n\n` +
          `⏳ Preparing ${precinctNames.length} precinct${precinctNames.length > 1 ? 's' : ''} for analysis...\n\n` +
          `_This may take a few seconds. Your report will download automatically when ready._`,
        timestamp: new Date(),
        metadata: { isGenerating: true, messageId: generatingMessageId },
      },
    ]);

    try {
      // Determine API endpoint based on report type
      let endpoint: string;
      let requestBody: Record<string, unknown>;

      switch (reportType) {
        case 'executive':
          endpoint = '/api/political-pdf/executive-summary';
          requestBody = {
            precinctNames,
            areaName: (metadata.areaName as string) || (precinctNames.length === 1 ? precinctNames[0] : `${precinctNames.length} Precincts`),
            areaDescription: metadata.areaDescription as string,
            quickAssessment: metadata.quickAssessment as string[],
            recommendation: metadata.recommendation as string,
          };
          break;

        case 'targeting':
          endpoint = '/api/political-pdf/targeting-brief';
          requestBody = {
            precinctNames,
            reportTitle: (metadata.reportTitle as string) || 'Targeting Brief',
            segmentName: (metadata.segmentName as string) || (state.segmentation.savedSegments?.[0]?.name),
            filterCriteria: metadata.filterCriteria as string[],
            sortBy: (metadata.sortBy as string) || 'combined',
            sortOrder: 'desc',
          };
          break;

        case 'profile':
          endpoint = '/api/political-pdf';
          requestBody = {
            precinctNames,
            areaName: (metadata.areaName as string) || (precinctNames.length === 1 ? precinctNames[0] : `${precinctNames.length} Precincts`),
          };
          break;

        case 'comparison':
          endpoint = '/api/political-pdf/comparison';
          // For comparison, we need two entities
          const entityA = (metadata.entityA as string) || (precinctNames[0] ?? '');
          const entityB = (metadata.entityB as string) || (precinctNames[1] ?? '');
          if (!entityA || !entityB) {
            setMessages((prev: Message[]) => [
              ...prev,
              {
                role: 'assistant',
                content: '⚠️ Comparison reports require two precincts. Please select two precincts to compare.',
                timestamp: new Date(),
                actions: [
                  { id: 'go-to-compare', label: 'Go to Compare Tool', action: 'navigate:/compare' },
                ],
              },
            ]);
            return;
          }
          requestBody = {
            entityA,
            entityB,
            comparisonTitle: (metadata.comparisonTitle as string) || `${entityA} vs ${entityB}`,
            comparisonPurpose: metadata.comparisonPurpose as string,
            keyDifferences: metadata.keyDifferences as string[],
            strategicImplications: metadata.strategicImplications as string[],
            recommendation: metadata.recommendation as string,
          };
          break;

        case 'segment':
          endpoint = '/api/political-pdf/segment';
          requestBody = {
            segmentName: (metadata.segmentName as string) || 'Custom Segment',
            precinctNames,
            segmentDescription: metadata.segmentDescription as string,
            filters: metadata.filters as Array<{ field: string; operator: string; value: unknown }>,
            createdBy: metadata.createdBy as string,
            recommendations: metadata.recommendations as string[],
          };
          break;

        default:
          // Unknown report type
          setMessages((prev: Message[]) => [
            ...prev,
            {
              role: 'assistant',
              content: `📋 Unknown report type: ${reportType}. Available reports: Executive Summary, Targeting Brief, Political Profile, Comparison, Segment, Canvassing Plan, and Donor Analysis.`,
              timestamp: new Date(),
              actions: [
                { id: 'exec-summary', label: 'Executive Summary', action: 'report:executive', metadata: { precinctNames } },
                { id: 'targeting-brief', label: 'Targeting Brief', action: 'report:targeting', metadata: { precinctNames } },
              ],
            },
          ]);
          return;
      }

      // Make API request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Get the PDF blob and trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `${reportType}-report-${Date.now()}.pdf`;

      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      // Add to report history
      addReportToHistory({
        reportType: reportType as 'executive' | 'targeting' | 'profile' | 'comparison' | 'segment',
        title: reportConfig.label,
        precinctCount: precinctNames.length,
        precinctNames,
        filename,
        metadata,
      });

      // Log exploration
      stateManager.logExploration({
        tool: toolContext,
        action: 'report_generated',
        metadata: { reportType, precinctCount: precinctNames.length },
      });

      // Get recent reports for suggestions
      const recentReports = getRecentReports(3);
      const recentReportActions = recentReports.length > 1 ? [{
        id: 'view-history',
        label: '📜 View report history',
        action: 'show me my recent reports',
      }] : [];

      // Success message with emoji
      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'assistant',
          content: `${reportConfig.emoji} **${reportConfig.label} Downloaded!**\n\n` +
            `✅ Your report is ready: \`${filename}\`\n\n` +
            `Check your downloads folder to view it.`,
          timestamp: new Date(),
          actions: [
            { id: 'another-report', label: '📑 Generate another report', action: 'generate a report' },
            { id: 'full-profile', label: '📊 Full Political Profile', action: 'report:profile', metadata: { precinctNames } },
            ...recentReportActions,
          ],
        },
      ]);

    } catch (error) {
      console.error('[Report Action] Error generating report:', error);
      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          timestamp: new Date(),
          actions: [
            { id: 'retry', label: 'Try again', action: `report:${reportType}`, metadata: { precinctNames } },
          ],
        },
      ]);
    }
  }, [toolContext, selectedPrecinct]);

  // Keyboard shortcuts integration (Wave 4 Agent 4C)
  useKeyboardShortcuts({
    onShowHelp: () => setShowShortcutsModal(true),
    onFocusInput: () => inputRef.current?.focus(),
    onSave: () => {
      // Trigger save segment if we have selection
      const stateManager = getStateManager();
      const state = stateManager.getState();
      if (state.selection.selectedIds.length > 0) {
        handleActionClick({
          id: 'save-segment',
          label: 'Save Segment',
          action: 'output:saveSegment'
        });
      }
    },
    onExport: () => {
      // Trigger export if we have selection
      const stateManager = getStateManager();
      const state = stateManager.getState();
      if (state.selection.selectedIds.length > 0) {
        handleActionClick({
          id: 'export-csv',
          label: 'Export CSV',
          action: 'output:exportCSV'
        });
      }
    },
    onToggleMap: () => {
      // Dispatch map toggle event
      if (onMapCommand) {
        onMapCommand({ action: 'toggleMap' });
      }
    }
  });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#33a852] to-[#2d9944] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
              <p className="text-xs text-[#33a852] capitalize">{toolContext.replace('-', ' ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Exploration Depth Indicator */}
            <DepthIndicator
              depth={explorationDepth}
            />
            {/* Issue #14: Export chat transcript button */}
            <button
              onClick={() => {
                const transcript = messages
                  .map(m => `${m.role === 'user' ? 'You' : 'AI Assistant'}: ${m.content}`)
                  .join('\n\n---\n\n');

                const header = `# Political Analysis Conversation\n\nTool: ${toolContext}\nDate: ${new Date().toLocaleDateString()}\nMessages: ${messages.length}\n\n---\n\n`;
                const fullContent = header + transcript;

                const blob = new Blob([fullContent], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat-${toolContext}-${new Date().toISOString().split('T')[0]}.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Export conversation"
              disabled={messages.length === 0}
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Selected Precinct Banner */}
      {selectedPrecinct && (
        <div className="flex-shrink-0 mx-4 mt-3 p-2 bg-gradient-to-r from-emerald-50 to-green-50 border border-[#33a852] rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#33a852] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-900">{selectedPrecinct.precinctName}</span>
                <span className="text-xs text-gray-500 ml-1">• {selectedPrecinct.county} County</span>
              </div>
            </div>
            <span className="text-xs text-[#33a852] font-medium">Selected</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
        {/* Empty state with example questions */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Sparkles className="h-12 w-12 text-[#33a852] mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              How can I help analyze voter data?
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-md">
              I can help you find target precincts, analyze demographics, plan canvassing routes, and identify donor opportunities.
            </p>
            <div className="w-full max-w-2xl space-y-4">
              {Object.entries(EXAMPLE_QUESTIONS).map(([category, questions]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 text-left">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {questions.map((question, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          handleUserInput(question);
                        }}
                        className="px-4 py-2.5 text-sm text-left text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-[#33a852] hover:bg-green-50 hover:text-[#2d9944] transition-all shadow-sm hover:shadow"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${message.role === 'user'
                ? 'bg-gradient-to-br from-[#33a852] to-[#2d9944] text-white'
                : message.isError
                  ? 'bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 text-gray-900 border-2 border-red-300'
                  : 'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900 border border-gray-200'
                }`}
            >
              {message.role === 'user' ? (
                <div className="text-xs leading-relaxed">
                  {message.content}
                </div>
              ) : message.isAcknowledgment ? (
                <div className="text-sm text-gray-600 italic animate-pulse">
                  <MessageContentWithEntities
                    content={message.content}
                    onEntityClick={handleEntityClick}
                  />
                </div>
              ) : (
                <>
                  <MessageContentWithEntities
                    content={message.content}
                    onEntityClick={handleEntityClick}
                  />
                  {/* Issue #16: Confidence indicators */}
                  {message.confidence && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${message.confidence === 'high' ? 'bg-green-100 text-green-700' :
                        message.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                        {message.confidence} confidence
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Action buttons */}
              {message.actions && message.actions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.actions.map(action => (
                    <button
                      key={action.id}
                      onClick={() => handleActionClick(action)}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-900 rounded-md border transition-all ${getActionStyle(action.action)}`}
                      disabled={isProcessing}
                    >
                      {/* Issue #17: Render action icons */}
                      {getActionIcon(action.action, action.icon)}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking indicator with contextual rotating messages */}
        {isProcessing && (
          <div className="flex justify-start mb-4">
            <ThinkingIndicator context={queryContext} />
          </div>
        )}

        {/* Issue #21: Report generation progress indicator */}
        {reportProgress && reportProgress.isGenerating && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-300 shadow-md max-w-[85%] sm:max-w-xs w-full">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600 animate-pulse" />
                  <span className="text-sm font-semibold text-blue-900">Generating Report</span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-700 font-medium">{reportProgress.stage}</span>
                    <span className="text-xs text-blue-600 font-bold">{reportProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${reportProgress.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
        {/* Issue #15: Recent queries */}
        {recentQueries.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-gray-500 mb-1.5 font-medium">Recent:</p>
            <div className="flex flex-wrap gap-1.5">
              {recentQueries.slice(0, 3).map((query, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputValue(query);
                    inputRef.current?.focus();
                  }}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded truncate max-w-[200px] transition-colors"
                  title={query}
                >
                  {query.slice(0, 40)}{query.length > 40 ? '...' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Issue #13: Keyboard shortcut hints (P3-2) - Hidden on mobile (touch devices) */}
        {showShortcutHints && (
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md hidden sm:block">
            <div className="flex items-center justify-between">
              <div className="text-xs text-blue-700 flex gap-3">
                <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-blue-300 font-mono">⌘K</kbd> focus</span>
                <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-blue-300 font-mono">⌘↵</kbd> send</span>
                <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-blue-300 font-mono">Esc</kbd> close</span>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem('shortcutHintsSeen', 'true');
                  setShowShortcutHints(false);
                }}
                className="text-blue-400 hover:text-blue-600"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <div className="relative">
          {/* Example questions dropdown */}
          {/* Wave 4: Recent Searches dropdown */}
          <RecentSearches
            isOpen={showRecentSearches}
            onSelect={(query) => {
              setInputValue(query);
              setShowRecentSearches(false);
              // Auto-submit the selected query
              handleUserInput(query);
            }}
            onClose={() => setShowRecentSearches(false)}
            tool={toolContext}
            position="above"
          />

          {showExamples && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg p-4 max-h-80 overflow-y-auto z-50">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-gray-900">Example Questions</h3>
                <button
                  onClick={() => setShowExamples(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                {Object.entries(EXAMPLE_QUESTIONS).map(([category, questions]) => (
                  <div key={category}>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                      {category}
                    </h4>
                    <div className="space-y-1">
                      {questions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setInputValue(q);
                            setShowExamples(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputValue.trim()) {
                handleUserInput(inputValue);
                setInputValue('');
              }
            }}
            className="flex items-center gap-2 w-full"
          >
            {/* <button
              type="button"
              onClick={() => setShowExamples(!showExamples)}
              className="px-3 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1 flex-shrink-0"
              title="Show example questions"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Examples</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRecentSearches(!showRecentSearches)}
              className="px-3 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1 flex-shrink-0"
              title="Recent searches"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button> */}
            <input
              ref={inputRef}
              name="input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => {
                // Show recent searches when input is focused and empty
                if (!inputValue.trim()) {
                  setShowRecentSearches(true);
                }
              }}
              placeholder={isProcessing ? "AI is thinking..." : config.placeholder}
              className={`flex-1 min-w-0 px-4 py-3 text-sm border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33a852] focus:border-[#33a852] transition-all min-h-[48px] ${isProcessing
                ? 'border-emerald-300 bg-emerald-50 cursor-not-allowed opacity-60'
                : 'border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
                }`}
              disabled={isProcessing}
            />
            <button
              type="submit"
              className="px-4 py-3 text-sm bg-gradient-to-r from-[#33a852] to-[#2d9944] text-white rounded-full hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md font-medium flex-shrink-0 min-h-[48px] whitespace-nowrap flex items-center gap-2"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <span>Send</span>
              )}
            </button>
            {/* Keyboard shortcuts button - hidden on mobile (no keyboard) */}
            <button
              type="button"
              onClick={() => setShowShortcutsModal(true)}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors flex-shrink-0 hidden sm:flex"
              title="Keyboard Shortcuts"
              aria-label="Show keyboard shortcuts"
            >
              <span className="text-sm font-medium">?</span>
            </button>
          </form>

          {/* Keyboard Shortcuts Hint */}
          <div className="mt-2 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Press <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">?</kbd> for shortcuts
            </p>
          </div>

          {/* Wave 4: Performance Indicator - shows after queries complete */}
          {(perfMetrics.aiQuery !== undefined) && (
            <div className="mt-2 flex justify-end">
              <PerformanceIndicator metrics={perfMetrics} compact />
            </div>
          )}
        </div>

        {/* Sticky Footer with Start Over - matches main page pattern */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <button
            onClick={clearChatHistory}
            className="text-xs text-gray-500 hover:text-[#33a852] transition-colors"
          >
            ← Start Over
          </button>
          <span className="text-xs text-gray-400">
            {messages.length > 1 ? `${messages.length - 1} messages` : ''}
          </span>
        </div>
      </div>

      {/* Save Segment Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Save Segment</h3>
            <input
              type="text"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && segmentName.trim()) {
                  e.preventDefault();
                  handleSaveSegmentConfirm();
                } else if (e.key === 'Escape') {
                  setShowSaveModal(false);
                  setSegmentToSave(null);
                }
              }}
              placeholder="Enter segment name"
              className="w-full border rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-[#33a852]"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSegmentToSave(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSegmentConfirm}
                disabled={!segmentName.trim()}
                className="px-4 py-2 bg-[#33a852] text-white rounded-md hover:bg-[#2d9944] disabled:opacity-50 disabled:cursor-not-allowed"
                data-save-segment-btn
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Issue #13) */}
      {confirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {confirmationModal.title}
            </h3>
            <p className="text-gray-600 mb-6">
              {confirmationModal.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeConfirmation}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmationModal.onConfirm}
                className={`px-4 py-2 rounded-lg transition-colors ${confirmationModal.isDangerous
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#33a852] hover:bg-[#2d9944] text-white'
                  }`}
              >
                {confirmationModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal (Issue #18) */}
      <KeyboardShortcuts
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
