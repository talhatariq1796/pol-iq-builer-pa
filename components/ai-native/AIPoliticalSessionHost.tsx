'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import { PoliticalDataService } from '@/lib/services/PoliticalDataService';
import type { PrecinctData } from '@/lib/segmentation/types';
import { parseIntent } from '@/lib/ai/intentParser';
import {
  handleOutputIntent,
  handleReportIntent,
  handleReportHistoryRequest,
  handleReportCustomization,
  type HandlerResult
} from '@/lib/ai/workflowHandlers';
import { processQuery } from '@/lib/ai-native/handlers';
import type { HandlerContext } from '@/lib/ai-native/handlers/types';
import { isSlashCommand, executeSlashCommand } from '@/lib/ai/SlashCommandParser';
import {
  getDistrictAnalysisInit,
  getDistrictAnalysisFollowUpActions,
  getSwingDetectionInit,
  getCanvassingInit,
  getVoterTargetingInit
} from './WorkflowInitializers';
import { getStateManager, type StateEvent } from '@/lib/ai-native/ApplicationStateManager';
import { notifyTourAIResponseComplete } from '@/lib/tour/tourActions';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';
import { stripActionDirectives } from '@/lib/ai/stripActionDirectives';
import { normalizeChatMarkdown } from '@/lib/ai/normalizeChatMarkdown';
import { getSuggestionEngine } from '@/lib/ai-native/SuggestionEngine';
import { CrossToolNavigator } from '@/lib/ai-native/navigation/CrossToolNavigator';
import { FeatureSelectionCard } from './FeatureSelectionCard';
import {
  extractFeatureData,
  formatFeatureForCard,
  type FeatureSelectionResult,
} from '@/lib/ai/featureSelectionHandler';
import { KnowledgeGraphViewer } from '@/components/knowledge-graph';
import type { Entity, Relationship } from '@/lib/knowledge-graph/types';
import { toast } from '@/hooks/use-toast';
import { ThinkingIndicator, detectQueryContext, type QueryContext } from './ThinkingIndicator';
import { ArrowLeftIcon } from 'lucide-react';


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

// Helper to add small icons to messages and clean up internal tags
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

  while ((match = sectionRegex.exec(content)) !== null) {
    const icon = match[1];
    const titleWithCount = match[2];
    const sectionContent = match[3].trim();

    // Extract count from title if present, e.g., "Precincts (40)"
    const countMatch = titleWithCount.match(/^(.+?)\s*\((\d+)\)$/);
    const title = countMatch ? countMatch[1] : titleWithCount;
    const count = countMatch ? parseInt(countMatch[2], 10) : undefined;

    sections.push({ icon, title, count, content: sectionContent });
    mainContent = mainContent.replace(match[0], '');
  }

  return { mainContent: mainContent.trim(), sections };
}

/**
 * Parse precinct IDs from content (comma or newline separated)
 */
function parsePrecinctsFromContent(content: string): string[] {
  return content
    .split(/[,\n]|(?:\s+and\s+)/i)
    .map((p) => p.trim().replace(/^\d+[.)]\s+/, '').trim())
    .filter((p) => p && !p.startsWith('*') && !p.startsWith('...'));
}

/**
 * Parse and format sources, removing category brackets
 * Format: [CATEGORY] Source Name — Provider (year)
 * Output: { name: string, provider: string, years?: string, url?: string }
 */
function parseSourceLine(line: string): { name: string; provider: string; years?: string } | null {
  // Remove leading "- " if present
  const cleaned = line.replace(/^-\s*/, '').trim();
  if (!cleaned) return null;

  // Remove [CATEGORY] prefix
  const withoutCategory = cleaned.replace(/^\[[^\]]+\]\s*/, '');

  // Parse "Source Name — Provider (years)"
  const match = withoutCategory.match(/^(.+?)\s*—\s*(.+?)(?:\s*\(([^)]+)\))?$/);
  if (match) {
    return {
      name: match[1].trim(),
      provider: match[2].trim(),
      years: match[3]?.trim(),
    };
  }

  // Fallback: just use the whole line
  return { name: withoutCategory, provider: '' };
}

/**
 * MessageContentWithSections - Renders message content with collapsible sections
 */
const MessageContentWithSections: React.FC<{
  content: string;
  onMapCommand?: (command: MapCommand) => void;
}> = ({ content, onMapCommand }) => {
  // Parse collapsible sections
  const { mainContent, sections } = parseCollapsibleSections(content);

  // Handler for precinct clicks — resolve AI display labels to map UNIQUE_IDs (PA targeting keys)
  const handlePrecinctClick = async (rawLabel: string) => {
    if (!onMapCommand) return;
    const svc = PoliticalDataService.getInstance();
    const mapKey = await svc.resolvePrecinctMapKey(rawLabel);
    if (!mapKey) {
      toast({
        title: 'Could not open precinct',
        description: `No map match for "${rawLabel.trim()}". Try selecting the precinct on the map.`,
        variant: 'destructive',
      });
      return;
    }
    onMapCommand({ type: 'highlight', target: [mapKey] });
    onMapCommand({ type: 'flyTo', target: mapKey });
  };

  // Render section content based on type
  const renderSectionContent = (section: { icon: string; title: string; content: string }) => {
    // Precincts section - render as clickable list
    if (section.title === 'Precincts' || section.icon === '📍') {
      const precincts = parsePrecinctsFromContent(section.content);
      return (
        <div className="space-y-1">
          {precincts.map((precinct, i) => (
            <button
              key={i}
              onClick={() => handlePrecinctClick(precinct)}
              className="block w-full text-left px-2 py-1 text-sm text-[#33a852] hover:bg-green-50 rounded transition-colors"
              title={`View ${precinct} on map`}
            >
              📍 {precinct}
            </button>
          ))}
        </div>
      );
    }

    // Sources section - render as formatted list without category brackets
    if (section.title === 'Sources' || section.icon === '📚') {
      const lines = section.content.split('\n').filter(l => l.trim());
      const sources = lines.map(parseSourceLine).filter(Boolean);

      return (
        <div className="space-y-2">
          {sources.map((source, i) => source && (
            <div key={i} className="text-sm">
              <span className="font-medium text-gray-800">{source.name}</span>
              {source.provider && (
                <span className="text-gray-500"> — {source.provider}</span>
              )}
              {source.years && (
                <span className="text-gray-400 text-xs ml-1">({source.years})</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Default: render as markdown
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-sm max-w-none dark:prose-invert [&_h2]:mt-4 [&_h3]:mt-3 [&_p]:my-2"
      >
        {enhanceMessage(section.content)}
      </ReactMarkdown>
    );
  };

  return (
    <>
      {/* Main content */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-sm max-w-none dark:prose-invert [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:my-2 [&_li]:my-0.5"
      >
        {enhanceMessage(mainContent)}
      </ReactMarkdown>

      {/* Collapsible sections */}
      {sections.map((section, idx) => (
        <CollapsibleSection
          key={idx}
          title={section.title}
          count={section.count}
          icon={section.icon}
        >
          {renderSectionContent(section)}
        </CollapsibleSection>
      ))}
    </>
  );
};

export interface MapCommand {
  type: 'zoom' | 'highlight' | 'filter' | 'clear' | 'flyTo' | 'showHeatmap' | 'showChoropleth' | 'clearHighlight' | 'showBivariate' | 'showProportional' | 'showValueByAlpha' | 'showClusters' | 'showOptimizedRoute' | 'showBuffer' | 'showNumberedMarkers' | 'setExtent' | 'showRoute' | 'showComparison' | 'annotate' | 'pulseFeature' | 'showTemporal' | 'highlightComparison';
  target?: string | string[];
  metric?: string;
  center?: [number, number];
  zoomLevel?: number;
  zoom?: number;
  data?: Record<string, unknown>;
  // Multi-variable visualization options
  xMetric?: string;
  yMetric?: string;
  sizeMetric?: string;
  colorMetric?: string;
  alphaMetric?: string;
  bivariatePreset?: 'gotv_targets' | 'persuasion_gotv' | 'swing_turnout' | 'income_education';
  proportionalPreset?: 'voter_population' | 'gotv_population' | 'canvass_turnout' | 'donor_concentration';
  valueByAlphaPreset?: 'partisan_confidence' | 'turnout_sample_size' | 'gotv_data_quality' | 'swing_voter_count';
  // Spatial reasoning options (Principle 16)
  clusters?: Array<{
    id: string;
    precinctIds: string[];
    color?: string;
    name?: string;
    centroid?: [number, number];
  }>;
  routePrecinctIds?: string[];
  routeMetadata?: {
    totalDoors?: number;
    totalHours?: number;
    doorsPerHour?: number;
  };
  bufferCenter?: [number, number]; // [lng, lat]
  bufferDistance?: number;
  // Numbered markers for AI-coordinated responses
  numberedMarkers?: Array<{
    precinctId: string;
    number: number;
    label?: string;
    coordinates?: [number, number];
  }>;
  bufferUnit?: 'km' | 'miles' | 'mi' | 'minutes';
  bufferType?: 'radius' | 'drivetime' | 'walktime';
  // New enhanced commands (Wave 7)
  extent?: { xmin: number; ymin: number; xmax: number; ymax: number };
  waypoints?: Array<{ precinctId: string; order: number; label?: string }>;
  optimized?: boolean;
  leftMetric?: string;
  rightMetric?: string;
  splitDirection?: 'vertical' | 'horizontal';
  location?: [number, number];
  label?: string;
  icon?: 'pin' | 'flag' | 'star' | 'marker' | 'campaign-hq' | 'polling-place';
  temporary?: boolean;
  duration?: number;
  color?: string;
  years?: number[];
  autoPlay?: boolean;
  // Comparison view
  leftEntityId?: string;
  rightEntityId?: string;
}

export interface SuggestedAction {
  id: string;
  label: string;
  action: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  /** Optional description for more context */
  description?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: SuggestedAction[];
  isLoading?: boolean;
  /** Feature card data - renders as FeatureSelectionCard instead of markdown */
  featureCard?: FeatureSelectionResult;
  metadata?: {
    districtIds?: string[];
    workflow?: string;
    mapCommands?: MapCommand[];
    showGraph?: boolean;
    graphEntities?: Entity[];
    graphRelationships?: Relationship[];
    messageId?: string;
    isFeatureCard?: boolean;
    hasPreviousSession?: boolean;
  };
}

// IQ Action types for sync with IQBuilder panel
export interface IQAction {
  type: 'quickstart' | 'area-analysis' | 'report-generated';
  action: string;
  /** Set by political-ai page per click — dedupes duplicate effect runs (welcome→active re-render, Strict Mode). */
  invocationId?: number;
  data?: {
    precinctNames?: string[];
    areaName?: string;
    analysisType?: string;
    result?: any;
    // QuickStartIQ predefined query data
    query?: string;
    category?: string;
    visualType?: string;
    metric?: string;
    queryId?: string;
  };
}

export interface AIPoliticalSessionHostProps {
  onMapCommand?: (command: MapCommand) => void;
  initialGreeting?: string;
  selectedPrecinct?: {
    precinctId: string;
    precinctName: string;
    county: string;
    attributes?: Record<string, any>;
  } | null;
  isMapReady?: boolean;
  mapState?: {
    activeLayer?: string;
    selectedMetric?: string;
    visibleFilters?: Record<string, any>;
    selectedBoundaries?: {
      type: string;
      ids: string[];
    };
  };
  iqAction?: IQAction | null;
  /** Skip workflow selection cards and go directly to active chat state */
  skipWorkflowSelection?: boolean;
  /** Callback when session state changes or to expose setSessionState for external control (e.g., guided tours) */
  onSessionStateChange?: (state: 'welcome' | 'active' | 'loading', setSessionState: (state: 'welcome' | 'active' | 'loading') => void) => void;
}

type SessionState = 'welcome' | 'active' | 'loading';

interface WorkflowSelection {
  id: string;
  name: string;
  description: string;
  initialPrompt?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export const AIPoliticalSessionHost: React.FC<AIPoliticalSessionHostProps> = ({
  onMapCommand,
  selectedPrecinct,
  mapState,
  iqAction,
  skipWorkflowSelection = false,
  onSessionStateChange,
}) => {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>(skipWorkflowSelection ? 'active' : 'welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowSelection | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queryContext, setQueryContext] = useState<QueryContext>('general');

  // Feature Selection State (Phase G)
  const [currentFeatureCard, setCurrentFeatureCard] = useState<FeatureSelectionResult | null>(null);

  // Welcome message state (P0-4)
  const [welcomeShown, setWelcomeShown] = useState(false);

  // Knowledge Graph State (Phase 16)
  const [showGraphPanel, setShowGraphPanel] = useState(false);
  const [graphEntities, setGraphEntities] = useState<Entity[]>([]);
  const [graphRelationships, setGraphRelationships] = useState<Relationship[]>([]);

  // Services
  const dataServiceRef = useRef<PoliticalDataService | null>(null);
  const conversationHistoryRef = useRef<Message[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** Last QuickStart IQ invocation processed (paired with `invocationId` from page). */
  const lastProcessedIQInvocationRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // Session State Callback for Tour Control
  // ---------------------------------------------------------------------------

  // Call session state callback when state changes, exposing the setter for tour control
  useEffect(() => {
    if (onSessionStateChange) {
      onSessionStateChange(sessionState, setSessionState);
    }
  }, [sessionState, onSessionStateChange]);

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Initialize data service
    if (!dataServiceRef.current) {
      dataServiceRef.current = PoliticalDataService.getInstance();
    }

    // Sync conversation history
    conversationHistoryRef.current = messages;
  }, [messages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Use setTimeout to ensure DOM has updated before scrolling
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // Generate context-aware welcome message on mount + GAP 6: Cross-session memory
  useEffect(() => {
    const suggestionEngine = getSuggestionEngine();
    const sessionMessage = suggestionEngine.generateSessionMessage();

    // Dispatch session start event
    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'SESSION_STARTED',
      payload: {},
      timestamp: new Date(),
    });

    // GAP 6 Fix: Restore previous session and increment session count
    stateManager.restoreSession();

    // Store the welcome message for rendering in welcome screen
    // The welcome screen now uses workflow cards instead of a chat message
    console.log('[AIPoliticalSessionHost] Session initialized with context:', sessionMessage);

    // GAP 6 Fix: Save session on page unload
    const handleBeforeUnload = () => {
      stateManager.saveSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also save on unmount
      stateManager.saveSession();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Welcome Message with Example Questions (P0-4) + GAP 6: Cross-session resume
  // Show welcome when user enters active state without a workflow
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Only show if: active state, no messages yet, not already shown, no workflow selected
    if (sessionState !== 'active' || messages.length > 0 || welcomeShown || currentWorkflow) return;

    // GAP 6 Fix: Check for previous session to offer resume
    const stateManager = getStateManager();
    const previousSession = stateManager.getPreviousSessionSummary();

    let welcomeContent = `**Pennsylvania — Electoral Analysis**

Available actions:
- Find swing areas and competitive targets
- Analyze voter demographics and Tapestry segments (where loaded)
- Plan canvassing routes
- Compare areas and identify patterns
- Generate targeting reports`;

    // Prepend previous session info if available
    if (previousSession?.available) {
      welcomeContent = `${previousSession.summary}\n\n${welcomeContent}`;
    }

    const actions: SuggestedAction[] = [];

    // Add resume action if previous session exists
    if (previousSession?.resumeContext) {
      actions.push({
        id: 'resume',
        label: 'Resume previous session',
        action: 'resume:previous',
        icon: 'refresh-cw',
        metadata: { resumeContext: previousSession.resumeContext },
      });
    }

    // Add standard actions
    actions.push(
      { id: 'swing', label: 'Find swing areas', action: 'Show me the most competitive swing areas', icon: 'target' },
      { id: 'gotv', label: 'GOTV priorities', action: 'Which areas should we prioritize for GOTV?', icon: 'trending-up' },
      { id: 'demographics', label: 'Explore demographics', action: 'Show me areas with young voters', icon: 'users' },
      { id: 'harrisburg', label: 'Explore Harrisburg', action: 'Zoom to Harrisburg and show me the political landscape', icon: 'map-pin' }
    );

    // Only add compare if we don't have resume (to keep action count manageable)
    if (!previousSession?.resumeContext) {
      actions.push({ id: 'compare', label: 'Compare areas', action: 'Compare Philadelphia to Pittsburgh', icon: 'git-compare' });
    }

    const welcomeMessage: Message = {
      role: 'assistant',
      content: welcomeContent,
      timestamp: new Date(),
      actions,
      metadata: { workflow: 'welcome', hasPreviousSession: previousSession?.available }
    };

    setMessages([welcomeMessage]);
    setWelcomeShown(true);
    console.log('[AIPoliticalSessionHost] Welcome message with examples shown (P0-4)');
  }, [sessionState, messages.length, welcomeShown, currentWorkflow]);

  // ---------------------------------------------------------------------------
  // Feature Selection Listener (Phase G)
  // Listen for FEATURE_SELECTED events from the state manager
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const stateManager = getStateManager();

    const handleStateChange = (_state: any, event: StateEvent) => {
      if (event.type === 'FEATURE_SELECTED') {
        // Extract feature data and format for card display
        // Check both payload.feature (from selectFeature) and payload.precinct (from tour)
        const feature = event.payload.feature || event.payload.precinct as any;
        const payloadMetrics = event.payload.metrics || {};

        if (feature) {
          // Determine feature type
          const featureType = feature.featureType || 'precinct';

          // Build raw data from feature properties for extraction
          const rawData = feature.raw || feature || {};

          const featureData = extractFeatureData(rawData, featureType);

          // Override ID, name, type
          featureData.id = feature.id || event.payload.precinctId || featureData.id;
          featureData.name = feature.name || event.payload.precinctName || featureData.name;
          featureData.featureType = featureType;

          // Merge all metrics sources (extracted metrics take priority)
          featureData.metrics = { ...payloadMetrics, ...feature.metrics, ...featureData.metrics };

          const cardResult = formatFeatureForCard(featureData);

          // Add feature card as a message in the conversation (stays in position)
          const featureCardMessageId = `feature-card-${Date.now()}`;
          setMessages((prev: Message[]) => [
            ...prev,
            {
              role: 'assistant' as const,
              content: '', // Content is rendered via featureCard prop
              timestamp: new Date(),
              featureCard: cardResult,
              metadata: {
                isFeatureCard: true,
                messageId: featureCardMessageId
              },
            }
          ]);
          setCurrentFeatureCard(cardResult); // Keep for backward compat / clearing

          // Transition to active state if needed
          if (sessionState === 'welcome') {
            setSessionState('active');
          }

          console.log('[AIPoliticalSessionHost] Feature selected (Phase G):', cardResult);
        }
      } else if (event.type === 'FEATURE_DESELECTED') {
        // Remove feature card messages from conversation
        setMessages((prev: Message[]) => prev.filter(m => !m.metadata?.isFeatureCard));
        setCurrentFeatureCard(null);
        console.log('[AIPoliticalSessionHost] Feature deselected');
      }
    };

    const unsubscribe = stateManager.subscribe(handleStateChange);
    return () => unsubscribe();
  }, [sessionState]);

  // Handle selectedPrecinct changes - show FeatureSelectionCard only (no duplicate text)
  // Track last processed precinct to prevent duplicate processing
  const lastProcessedPrecinctRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedPrecinct) return;

    // Prevent duplicate processing when sessionState changes
    if (lastProcessedPrecinctRef.current === selectedPrecinct.precinctId) {
      return;
    }
    lastProcessedPrecinctRef.current = selectedPrecinct.precinctId;

    console.log('[AIPoliticalSessionHost] selectedPrecinct changed:', selectedPrecinct);

    // Transition to active state if in welcome
    if (sessionState === 'welcome') {
      setSessionState('active');
    }

    // Dispatch to state manager and show feature card
    const stateManager = getStateManager();

    // Build metrics object
    const metrics = {
      swing_potential: selectedPrecinct.attributes?.swing_potential,
      gotv_priority: selectedPrecinct.attributes?.gotv_priority,
      persuasion_opportunity: selectedPrecinct.attributes?.persuasion_opportunity,
      partisan_lean: selectedPrecinct.attributes?.partisan_lean,
    };

    stateManager.dispatch({
      type: 'PRECINCT_SELECTED',
      payload: {
        precinctId: selectedPrecinct.precinctId,
        precinctName: selectedPrecinct.precinctName,
        precinct: selectedPrecinct.attributes as PrecinctData,
        metrics,
      },
      timestamp: new Date(),
    });

    // Dispatch FEATURE_SELECTED to trigger FeatureSelectionCard (Phase G)
    // This is the only UI response - no duplicate text message needed
    stateManager.selectFeature({
      id: selectedPrecinct.precinctId,
      name: selectedPrecinct.precinctName,
      featureType: 'precinct',
      metrics,
      raw: selectedPrecinct.attributes as Record<string, unknown>,
    });

    // Highlight selected precinct on map
    if (onMapCommand) {
      onMapCommand({ type: 'highlight', target: [selectedPrecinct.precinctId] });
    }
  }, [selectedPrecinct?.precinctId, sessionState]);

  // ---------------------------------------------------------------------------
  // IQ Action Handler - responds to actions from IQBuilder panel
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!iqAction) {
      lastProcessedIQInvocationRef.current = null;
      return;
    }

    console.log('[AIPoliticalSessionHost] Processing IQ action:', iqAction);

    // Handle predefined queries from QuickStartIQ dialog
    if (iqAction.type === 'quickstart' && iqAction.action === 'predefined-query' && iqAction.data?.query) {
      const inv = iqAction.invocationId;
      if (inv != null && lastProcessedIQInvocationRef.current === inv) {
        return;
      }
      if (inv != null) {
        lastProcessedIQInvocationRef.current = inv;
      }

      // Add the query as a user message and process it through the AI
      const userQuery = iqAction.data.query;
      console.log('[AIPoliticalSessionHost] Processing QuickStartIQ query:', userQuery);

      // Add user message showing what was asked
      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'user' as const,
          content: userQuery,
          timestamp: new Date(),
          metadata: { source: 'quickstart-iq', category: iqAction.data?.category }
        }
      ]);

      // Functional update avoids stale state; do not put sessionState in effect deps — that re-ran this
      // effect while iqAction was still set (duplicate user message + duplicate AI response).
      setSessionState((s: SessionState) => (s === 'welcome' ? 'active' : s));

      // Process the query through the AI (use handleSend equivalent)
      // We'll trigger this via a small delay to let the UI update
      setTimeout(() => {
        processQuickStartQuery(userQuery, iqAction.data?.visualType, iqAction.data?.metric);
      }, 100);

      return;
    }

    // Map IQ action to AI response (legacy handlers)
    let aiMessage = '';
    let mapCommand: MapCommand | null = null;

    switch (iqAction.type) {
      case 'quickstart':
        switch (iqAction.action) {
          case 'swing-analysis':
            aiMessage = "I'll analyze the top swing areas in Ingham County. These are areas where elections have been competitive and voter behavior is most likely to shift between parties.\n\n**Analyzing swing potential across all areas...**";
            mapCommand = { type: 'showHeatmap', metric: 'swing_potential' };
            break;
          case 'gotv-analysis':
            aiMessage = "I'll identify areas with the highest GOTV (Get Out The Vote) priority. These are areas where turnout mobilization can have the biggest impact.\n\n**Loading GOTV priority scores...**";
            mapCommand = { type: 'showHeatmap', metric: 'gotv_priority' };
            break;
          case 'battleground-analysis':
            aiMessage = "I'll show the battleground areas - places where both parties have won recent elections and the outcome is highly unpredictable.\n\n**Highlighting battleground areas...**";
            mapCommand = { type: 'showChoropleth' };
            break;
          case 'persuasion-analysis':
            aiMessage = "I'll identify areas with the highest persuasion opportunity - places with many persuadable voters who may be influenced by campaign outreach.\n\n**Loading persuasion opportunity scores...**";
            mapCommand = { type: 'showHeatmap', metric: 'persuasion_opportunity' };
            break;
          default:
            aiMessage = `Processing ${iqAction.data?.analysisType || 'analysis'}...`;
        }
        break;

      case 'area-analysis':
        aiMessage = `Analyzing ${iqAction.data?.areaName || 'selected area'} with ${iqAction.data?.precinctNames?.length || 0} areas...`;
        break;

      case 'report-generated':
        aiMessage = `Political Profile Report generated for ${iqAction.data?.areaName || 'selected area'}. The PDF has been downloaded.`;
        break;

      default:
        aiMessage = 'Processing IQBuilder action...';
    }

    // Add the AI response message
    setMessages((prev: Message[]) => [
      ...prev,
      {
        role: 'assistant' as const,
        content: aiMessage,
        timestamp: new Date(),
        metadata: { workflow: 'iq-sync' }
      }
    ]);

    // Execute map command if applicable
    if (mapCommand && onMapCommand) {
      console.log('[AIPoliticalSessionHost] Executing IQ-triggered map command:', mapCommand);
      onMapCommand(mapCommand);
    }

    setSessionState((s: SessionState) => (s === 'welcome' ? 'active' : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- processQuickStartQuery is declared below; sessionState omitted to prevent duplicate runs
  }, [iqAction, onMapCommand]);

  // ---------------------------------------------------------------------------
  // Proactive Intelligence - Check triggers periodically
  // ---------------------------------------------------------------------------

  // Track last proactive message time to prevent spam
  const lastProactiveRef = useRef<number>(0);

  useEffect(() => {
    // Don't run during initial load, welcome state, or when processing
    if (sessionState === 'welcome' || isProcessing) return;

    // Re-enabled with improved context filtering (P0-2 fix)
    // Only trigger proactive suggestions when user has been active and exploring
    const checkProactive = () => {
      // Prevent proactive messages within 60 seconds of each other (increased from 30)
      const now = Date.now();
      if (now - lastProactiveRef.current < 60000) return;

      try {
        const stateManager = getStateManager();
        const suggestionEngine = getSuggestionEngine();

        // Additional context checks to prevent irrelevant suggestions:
        // 1. User must have selected at least one precinct this session
        // 2. User must have sent at least 2 messages (not just browsing)
        // 3. Check exploration depth - only suggest when user has explored meaningfully
        const explorationDepth = stateManager.getExplorationDepth();
        const messageCount = messages.filter(m => m.role === 'user').length;

        if (explorationDepth < 20 || messageCount < 2) {
          return; // Not enough context yet
        }

        const trigger = suggestionEngine.checkProactiveTriggers();

        if (trigger) {
          lastProactiveRef.current = now;

          // Convert suggestions to our action format
          const actions: SuggestedAction[] = trigger.suggestions.map(s => ({
            id: s.id,
            label: s.label,
            action: s.action,
            description: s.description,
          }));

          // Add proactive message with subtle styling indicator
          setMessages((prev: Message[]) => [...prev, {
            role: 'assistant' as const,
            content: `💡 ${trigger.message}`,
            timestamp: new Date(),
            actions,
            metadata: { workflow: 'proactive', isProactive: true }
          }]);

          console.log('[AIPoliticalSessionHost] Proactive message triggered:', trigger.trigger.id);
        }
      } catch (error) {
        // Silently handle errors - proactive suggestions are non-critical
        console.warn('[AIPoliticalSessionHost] Proactive check failed:', error);
      }
    };

    // Check every 15 seconds (slowed from 10 for less intrusion)
    const interval = setInterval(checkProactive, 15000);

    return () => clearInterval(interval);
  }, [sessionState, isProcessing, messages]);

  // ---------------------------------------------------------------------------
  // Idle Time Tracking - Update state manager with user activity
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

  // ---------------------------------------------------------------------------
  // Message Management - MUST be defined before workflow functions that use them
  // ---------------------------------------------------------------------------

  const addUserMessage = useCallback((content: string) => {
    const message: Message = {
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages((prev: Message[]) => [...prev, message]);
    return message;
  }, []);

  const addAssistantMessage = useCallback(
    (content: string, actions?: SuggestedAction[], metadata?: Message['metadata']) => {
      const message: Message = {
        role: 'assistant',
        content,
        timestamp: new Date(),
        actions,
        metadata
      };

      setMessages((prev: Message[]) => [...prev, message]);
      return message;
    },
    []
  );

  const addSystemMessage = useCallback((content: string) => {
    addAssistantMessage(content);
  }, [addAssistantMessage]);

  // ---------------------------------------------------------------------------
  // Map Command Execution - MUST be defined before processWorkflowInitialization
  // ---------------------------------------------------------------------------

  const executeMapCommand = useCallback((command: MapCommand) => {
    console.log('[AIPoliticalSessionHost] Executing map command:', command);

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

    const message = feedbackMessages[command.type] || `Executing: ${command.type}`;

    toast({
      title: message,
      duration: 2000,
      variant: 'default',
    });

    // Execute the actual command
    if (onMapCommand) {
      console.log('[AIPoliticalSessionHost] Calling onMapCommand callback');
      onMapCommand(command);
    } else {
      console.warn('[AIPoliticalSessionHost] No onMapCommand callback provided!');
    }
  }, [onMapCommand]);

  // ---------------------------------------------------------------------------
  // Workflow Initialization - uses executeMapCommand, addAssistantMessage, addSystemMessage
  // ---------------------------------------------------------------------------

  const processWorkflowInitialization = useCallback(async (workflow: WorkflowSelection) => {
    console.log('[AIPoliticalSessionHost] processWorkflowInitialization for:', workflow.id);
    setIsProcessing(true);

    try {
      let init;
      // Load relevant data based on workflow type
      switch (workflow.id) {
        case 'district-analysis':
          init = getDistrictAnalysisInit(selectedPrecinct);
          break;
        case 'swing-detection':
          init = getSwingDetectionInit();
          break;
        case 'canvassing':
          init = getCanvassingInit(selectedPrecinct);
          break;
        case 'voter-targeting':
          init = getVoterTargetingInit();
          break;
        default:
          console.warn('[AIPoliticalSessionHost] Unknown workflow:', workflow.id);
          return;
      }

      console.log('[AIPoliticalSessionHost] Got init for workflow:', workflow.id, 'mapCommand:', init.mapCommand);

      // Execute map command BEFORE adding message
      if (init.mapCommand) {
        console.log('[AIPoliticalSessionHost] Calling executeMapCommand with:', init.mapCommand);
        executeMapCommand(init.mapCommand);
      }

      // Add the assistant message with suggested actions
      addAssistantMessage(init.message, init.actions);
    } catch (error) {
      console.error('Workflow initialization error:', error);
      addSystemMessage('There was an error initializing the workflow. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPrecinct, executeMapCommand, addAssistantMessage, addSystemMessage]);

  // ---------------------------------------------------------------------------
  // Workflow Selection Handler - uses processWorkflowInitialization
  // ---------------------------------------------------------------------------

  const handleWorkflowSelect = useCallback(async (workflow: WorkflowSelection) => {
    console.log('[AIPoliticalSessionHost] handleWorkflowSelect called for:', workflow.id);
    setSessionState('loading');
    setCurrentWorkflow(workflow);
    setSessionState('active');

    // Process workflow initialization which will add the initial message with actions
    await processWorkflowInitialization(workflow);
  }, [processWorkflowInitialization]);

  // ---------------------------------------------------------------------------
  // User Input Processing
  // ---------------------------------------------------------------------------

  const handleUserInput = useCallback(async (input: string) => {
    if (!input.trim()) return;

    // Check for slash commands first
    if (isSlashCommand(input)) {
      const cmdResult = executeSlashCommand(input);

      if (cmdResult.handled) {
        // Add user message
        addUserMessage(input);

        // Handle clear command
        if (cmdResult.clearChat) {
          setMessages([{
            id: `msg-${Date.now()}`,
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

        // Execute map commands (supports both 'type' and 'action' properties)
        if (cmdResult.mapCommands) {
          cmdResult.mapCommands.forEach(cmd => {
            if (cmd.type || cmd.action) {
              executeMapCommand(cmd as MapCommand);
            }
          });
        }

        // Add assistant response
        addAssistantMessage(
          cmdResult.response || 'Command executed.',
          cmdResult.suggestedActions?.map(a => ({
            id: a.id,
            label: a.label,
            action: a.action,
            icon: a.icon,
            type: 'action' as const,
          })),
          { mapCommands: cmdResult.mapCommands as MapCommand[] | undefined }
        );

        return;
      }
    }

    // Dispatch to state manager for context tracking
    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'USER_QUERY_SUBMITTED',
      payload: { query: input },
      timestamp: new Date(),
    });

    // Add user message
    addUserMessage(input);
    setIsProcessing(true);
    setQueryContext(detectQueryContext(input));

    try {
      // Process the input
      const response = await processUserInput(input);

      // Add assistant response
      addAssistantMessage(
        response.content,
        response.actions,
        response.metadata
      );

      // Execute any map commands
      if (response.metadata?.mapCommands) {
        response.metadata.mapCommands.forEach(cmd => executeMapCommand(cmd));
      }
    } catch (error) {
      console.error('Error processing user input:', error);
      // GAP 3 Fix: Provide specific error context and recovery suggestions
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('timeout');

      if (isNetworkError) {
        addSystemMessage(
          '**Network Error**\n\n' +
          'Unable to process your request due to a connection issue.\n\n' +
          '**What you can do:**\n' +
          '- Check your internet connection\n' +
          '- Wait a moment and try again\n' +
          '- Try a simpler query'
        );
      } else {
        addSystemMessage(
          '**Processing Error**\n\n' +
          `Unable to process: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"\n\n` +
          '**What you can do:**\n' +
          '- Try rephrasing your question\n' +
          '- Be more specific about what you need\n' +
          '- Use one of the suggested actions below'
        );
      }
    } finally {
      setIsProcessing(false);
      // Notify tour that AI response is complete (enables Next button if tour is waiting)
      notifyTourAIResponseComplete();
    }
  }, [addUserMessage, addAssistantMessage, addSystemMessage]);

  // ---------------------------------------------------------------------------
  // Keyboard Shortcuts (P3-2) - Must come after handleUserInput is defined
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Escape to blur input
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        e.preventDefault();
        inputRef.current?.blur();
      }

      // Cmd/Ctrl + Enter to submit (when input is focused)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        const input = inputRef.current;
        if (input?.value.trim()) {
          handleUserInput(input.value);
          input.value = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUserInput]);

  /**
   * Process QuickStartIQ predefined queries
   * Similar to handleUserInput but with additional visual type hints
   */
  const processQuickStartQuery = useCallback(async (query: string, visualType?: string, presetMetric?: string) => {
    if (!query.trim()) return;

    console.log('[AIPoliticalSessionHost] Processing QuickStartIQ query:', query, 'visualType:', visualType, 'presetMetric:', presetMetric);
    setIsProcessing(true);
    setQueryContext(detectQueryContext(query));

    try {
      // Process through the normal pipeline
      const response = await processUserInput(query);

      // Add assistant response
      addAssistantMessage(
        response.content,
        response.actions,
        response.metadata
      );

      // Execute any map commands from the AI response
      if (response.metadata?.mapCommands) {
        response.metadata.mapCommands.forEach(cmd => executeMapCommand(cmd));
      }

      // If visualType hint was provided and no map commands were generated,
      // trigger an appropriate default visualization
      if (visualType && (!response.metadata?.mapCommands || response.metadata.mapCommands.length === 0)) {
        let fallbackCommand: MapCommand | null = null;

        switch (visualType) {
          case 'heatmap':
            fallbackCommand = {
              type: 'showHeatmap',
              metric: (presetMetric as any) || 'combined_score',
            };
            break;
          case 'choropleth':
            fallbackCommand = { type: 'showChoropleth', metric: 'partisan_lean' };
            break;
          case 'bivariate':
            fallbackCommand = { type: 'showBivariate', xMetric: 'gotv_priority', yMetric: 'persuasion_opportunity' };
            break;
          case 'scatter':
            // Scatter plots are shown in chart panel, not map
            break;
          case 'proportional':
            fallbackCommand = { type: 'showProportional', sizeMetric: 'registered_voters', colorMetric: 'partisan_lean' };
            break;
          case 'valueByAlpha':
            fallbackCommand = { type: 'showValueByAlpha', metric: 'partisan_lean' };
            break;
        }

        if (fallbackCommand) {
          console.log('[AIPoliticalSessionHost] Applying fallback visualization:', fallbackCommand);
          executeMapCommand(fallbackCommand);
        }
      }
    } catch (error) {
      console.error('[AIPoliticalSessionHost] Error processing QuickStartIQ query:', error);
      // GAP 3 Fix: Provide specific error context for QuickStart queries
      addSystemMessage(
        '**Quick Analysis Error**\n\n' +
        `Unable to run quick analysis for "${query.substring(0, 40)}..."\n\n` +
        '**What you can do:**\n' +
        '- Try a different analysis option\n' +
        '- Type your own custom query\n' +
        '- Select an area on the map first'
      );
    } finally {
      setIsProcessing(false);
    }
  }, [addAssistantMessage, addSystemMessage, executeMapCommand]);

  // GAP 1 Fix: Build HandlerContext from ApplicationStateManager
  const buildHandlerContext = useCallback((): HandlerContext => {
    const stateManager = getStateManager();
    const state = stateManager.getState();
    const metrics = stateManager.getExplorationMetrics();

    return {
      currentTool: state.currentTool,
      map: {
        center: state.sharedMapState.center,
        zoom: state.sharedMapState.zoom,
        activeLayer: state.sharedMapState.layer,
        activeMetric: state.sharedMapState.metric,
        highlightedFeatures: state.sharedMapState.highlights,
        visiblePrecincts: state.sharedMapState.visiblePrecincts,
      },
      selection: {
        type: state.selection.type,
        selectedIds: state.selection.selectedIds,
        selectedEntityName: state.selection.selectedEntity?.name || null,
      },
      segmentation: {
        activeFilters: (state.segmentation.activeFilters as Record<string, unknown>) || {},
        matchingPrecincts: state.segmentation.matchingPrecincts,
        savedSegmentName: state.segmentation.currentSegmentName || null,
      },
      recentMessages: messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content.substring(0, 500),
        timestamp: m.timestamp,
      })),
      exploration: {
        precinctsViewed: metrics.precinctsViewed,
        filtersApplied: metrics.filtersApplied,
        toolsVisited: metrics.toolsVisited,
        explorationDepth: stateManager.getExplorationDepth(),
      },
      temporal: {
        selectedElectionYear: state.sharedMapState.selectedElectionYear?.toString() || null,
        isTemporalMode: state.sharedMapState.isTemporalMode || false,
      },
    };
  }, [messages]);

  const processUserInput = async (input: string): Promise<{
    content: string;
    actions?: SuggestedAction[];
    metadata?: Message['metadata'];
  }> => {
    // Build map context for AI awareness
    let contextMessage = input;
    if (selectedPrecinct) {
      contextMessage = `[MAP CONTEXT: Currently viewing ${selectedPrecinct.precinctName}]\n\n${input}`;
    } else if (mapState?.selectedBoundaries && mapState.selectedBoundaries.ids.length > 0) {
      contextMessage = `[MAP CONTEXT: ${mapState.selectedBoundaries.ids.length} ${mapState.selectedBoundaries.type} selected]\n\n${input}`;
    } else if (mapState?.activeLayer && mapState.activeLayer !== 'none') {
      contextMessage = `[MAP CONTEXT: Viewing ${mapState.activeLayer} layer${mapState.selectedMetric ? ` - ${mapState.selectedMetric}` : ''}]\n\n${input}`;
    }

    // Parse intent from the user's words only — MAP CONTEXT prefixes confuse keyword routing (e.g. layer names with "swing", "history") and trigger Claude with generic UI advice.
    const intent = parseIntent(input);

    let result: HandlerResult;

    // Special handling for report/output requests (need component context)
    if (intent.type === 'output_request') {
      const outputStateManager = getStateManager();
      const outputAppState = outputStateManager.getState();
      const outputMetrics = outputStateManager.getExplorationMetrics();

      const outputContext: any = {
        precinctsExplored: outputMetrics.precinctsViewed,
        hasActiveSegment: outputAppState.segmentation.matchingPrecincts.length > 0,
        segmentPrecinctCount: outputAppState.segmentation.matchingPrecincts.length,
        hasAnalysisResults: outputAppState.iqBuilder.hasAnalysisResult,
        messageCount: messages.length,
        currentTool: 'political-ai',
        hasMapSelection: !!(selectedPrecinct || (mapState?.selectedBoundaries?.ids?.length ?? 0) > 0),
      };

      result = await handleOutputIntent(
        intent.outputParams || { requestType: 'save' },
        outputContext
      );
    } else if (intent.type === 'report_history') {
      result = await handleReportHistoryRequest();
    } else if (intent.type === 'report_request') {
      if (intent.reportParams?.requestType === 'customize') {
        result = await handleReportCustomization(intent.reportParams.reportType);
      } else {
        const reportStateManager = getStateManager();
        const reportAppState = reportStateManager.getState();
        const reportMetrics = reportStateManager.getExplorationMetrics();

        const selectedPrecinctNames: string[] = [];
        if (selectedPrecinct) {
          selectedPrecinctNames.push(selectedPrecinct.precinctName);
        }
        if (mapState?.selectedBoundaries?.ids) {
          selectedPrecinctNames.push(...mapState.selectedBoundaries.ids);
        }

        const hasComparison = !!(reportAppState.comparison.leftEntity && reportAppState.comparison.rightEntity);

        const reportContext: any = {
          precinctsExplored: reportMetrics.precinctsViewed,
          hasActiveSegment: reportAppState.segmentation.matchingPrecincts.length > 0,
          segmentPrecinctCount: reportAppState.segmentation.matchingPrecincts.length,
          hasComparisonData: hasComparison,
          comparisonEntities: hasComparison
            ? [reportAppState.comparison.leftEntity!.name, reportAppState.comparison.rightEntity!.name]
            : undefined,
          currentTool: 'political-ai',
          hasMapSelection: !!(selectedPrecinct || (mapState?.selectedBoundaries?.ids?.length ?? 0) > 0),
          selectedPrecinctNames: selectedPrecinctNames.length > 0 ? selectedPrecinctNames : undefined,
        };

        result = await handleReportIntent(
          intent.reportParams || { requestType: 'generate' },
          reportContext
        );
      }
    } else {
      // Route through ToolOrchestrator for all other intents
      // GAP 1 Fix: Pass full context to enable state-aware responses
      const handlerContext = buildHandlerContext();
      console.log('[AIPoliticalSessionHost] Routing through ToolOrchestrator:', { query: input.substring(0, 100), hasContext: true });
      const orchestratorResult = await processQuery(input, handlerContext);

      // Check if we should escalate to Claude for complex/analytical queries
      const isAnalyticalQuery = /\b(why|how|explain|analyze|what do you think|help me understand|tell me about|what's the difference|compare|strategy|recommend)\b/i.test(input);
      const isMultiPartQuery = (input.match(/\?/g) || []).length > 1 || /\b(and also|additionally|furthermore|also tell me)\b/i.test(input);
      const isOpinionQuery = /\b(should i|would you|do you think|best|worst|opinion|advice)\b/i.test(input);
      const isContextualQuery = /\b(earlier|before|we discussed|you mentioned|last time|previous)\b/i.test(input);
      const matchedIntent = orchestratorResult.metadata?.parsedIntent || orchestratorResult.metadata?.matchedIntent;
      const isUnknownIntent = matchedIntent === 'unknown' || !orchestratorResult.success;
      const toolHandledWell =
        orchestratorResult.success &&
        matchedIntent &&
        matchedIntent !== 'unknown' &&
        ['segment_find', 'segment_create', 'map_layer_change', 'filter'].includes(String(matchedIntent));

      const shouldEscalateToClaude =
        !toolHandledWell &&
        (isUnknownIntent ||
          input.length > 150 ||
          isAnalyticalQuery ||
          isMultiPartQuery ||
          isOpinionQuery ||
          isContextualQuery);

      if (shouldEscalateToClaude) {
        console.log('[AIPoliticalSessionHost] Escalating to Claude:', {
          matchedIntent,
          inputLength: input.length,
          reasons: { isUnknownIntent, isAnalyticalQuery, isMultiPartQuery, isOpinionQuery, isContextualQuery }
        });

        try {
          const escalationStateManager = getStateManager();
          const sessionContext = escalationStateManager.getContextForAI();
          const iq = escalationStateManager.getState().iqBuilder.lastAnalysis;
          const attrs = selectedPrecinct?.attributes || {};
          const mapSelection = {
            selectedPrecinctName: selectedPrecinct?.precinctName,
            selectedPrecinctJurisdiction:
              (attrs.Jurisdiction_Name as string | undefined) ||
              (attrs.MunicipalityName as string | undefined) ||
              (attrs.MUNICIPALITY as string | undefined) ||
              (attrs.municipality as string | undefined) ||
              undefined,
            lastAnalysisAreaName: iq?.areaName,
            lastAnalysisPrecinctNames: iq?.precincts
              ?.map((p) => p.name)
              .filter((n): n is string => Boolean(n)),
          };

          const recentMessages = messages.slice(-15);
          const formattedMessages = recentMessages.map((m, idx) => {
            let content = m.content;
            if (idx < recentMessages.length - 5 && m.metadata?.workflow) {
              content = `[${m.metadata.workflow}] ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
            }
            return { role: m.role, content };
          });
          formattedMessages.push({ role: 'user' as const, content: input });

          const claudeResponse = await fetchWithRetry('/api/political-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: formattedMessages,
              context: sessionContext,
              currentQuery: input,
              includeData: true,
              mapSelection,
            })
          });

          if (claudeResponse.ok) {
            const claudeData = await claudeResponse.json();

            // Parse Claude's response for map-related content and generate map commands
            const generatedMapCommands: MapCommand[] = [];
            const responseText = claudeData.content.toLowerCase();

            if (responseText.includes('east lansing') || responseText.includes('msu')) {
              generatedMapCommands.push({ type: 'flyTo', center: [-84.48, 42.74], zoomLevel: 13 });
            } else if (responseText.includes('lansing') || responseText.includes('downtown')) {
              generatedMapCommands.push({ type: 'flyTo', center: [-84.55, 42.73], zoomLevel: 12 });
            } else if (responseText.includes('meridian')) {
              generatedMapCommands.push({ type: 'flyTo', center: [-84.43, 42.73], zoomLevel: 12 });
            }

            if (responseText.includes('swing') && responseText.includes('precinct')) {
              generatedMapCommands.push({ type: 'showHeatmap', metric: 'swing_potential' });
            } else if (responseText.includes('gotv') || responseText.includes('turnout')) {
              generatedMapCommands.push({ type: 'showHeatmap', metric: 'gotv_priority' });
            } else if (responseText.includes('persuasion') || responseText.includes('persuadable')) {
              generatedMapCommands.push({ type: 'showHeatmap', metric: 'persuasion_opportunity' });
            } else if (responseText.includes('partisan lean') || responseText.includes('voting pattern')) {
              generatedMapCommands.push({ type: 'showChoropleth', metric: 'partisan_lean' });
            }

            const precinctPattern = /\b([A-Z]{2,4}-\d+)\b/g;
            const precinctMatches = claudeData.content.match(precinctPattern);
            if (precinctMatches && precinctMatches.length > 0) {
              generatedMapCommands.push({ type: 'highlight', target: precinctMatches });
            }

            result = {
              response: claudeData.content,
              suggestedActions: generateContextualActions(),
              mapCommands: generatedMapCommands.length > 0 ? generatedMapCommands : undefined
            };
            console.log('[AIPoliticalSessionHost] Claude response received successfully');
          } else {
            console.warn('[AIPoliticalSessionHost] Claude escalation failed, using fallback');
            result = {
              response: 'I\'m not sure I understood that. Could you rephrase your question?',
              suggestedActions: generateContextualActions()
            };
          }
        } catch (escalationError) {
          console.error('[AIPoliticalSessionHost] Claude escalation error:', escalationError);
          result = {
            response: '⚠️ I\'m having trouble connecting to the AI service. This might be a temporary network issue.',
            suggestedActions: [
              { id: 'retry', label: '🔄 Retry', action: input, icon: 'refresh-cw' },
              ...generateContextualActions().slice(0, 3),
            ]
          };
        }
      } else {
        // Use orchestrator result
        console.log('[AIPoliticalSessionHost] Using ToolOrchestrator result:', { intent: matchedIntent, success: orchestratorResult.success });
        // Filter mapCommands to only include those with valid type or action
        const validMapCommands = orchestratorResult.mapCommands?.filter(
          (cmd): cmd is MapCommand => cmd.type !== undefined || cmd.action !== undefined
        );
        result = {
          response: orchestratorResult.response,
          suggestedActions: orchestratorResult.suggestedActions || generateContextualActions(),
          mapCommands: validMapCommands,
          metadata: orchestratorResult.metadata,
        };

        // If result has graph data, update the graph state
        if (result.metadata?.showGraph && result.metadata.entities) {
          setGraphEntities(result.metadata.entities);
          setGraphRelationships(result.metadata.relationships || []);
          setShowGraphPanel(true);
        }
      }
    }

    return {
      content: result.response,
      actions: result.suggestedActions,
      metadata: {
        mapCommands: result.mapCommands,
        showGraph: result.metadata?.showGraph,
        graphEntities: result.metadata?.entities,
        graphRelationships: result.metadata?.relationships,
      }
    };
  };

  // ---------------------------------------------------------------------------
  // Intent Analysis & Handlers
  // ---------------------------------------------------------------------------
  // Note: Intent parsing and handling now done by real handlers in @/lib/ai/

  // ---------------------------------------------------------------------------
  // Helper Functions
  // ---------------------------------------------------------------------------

  const generateContextualActions = useCallback((): SuggestedAction[] => {
    if (!currentWorkflow) {
      return [];
    }

    // Generate actions based on current workflow type
    switch (currentWorkflow.id) {
      case 'district-analysis':
        return getDistrictAnalysisFollowUpActions(selectedPrecinct);

      case 'swing-detection':
        return [
          {
            id: 'find-swing-areas',
            label: 'Find areas with margin < 5%',
            action: 'Find areas with margin less than 5%',
            icon: 'filter'
          },
          {
            id: 'swing-heatmap',
            label: 'Show swing potential heatmap',
            action: 'Show swing potential heatmap',
            icon: 'map'
          },
          {
            id: 'competitive-races',
            label: 'List most competitive races',
            action: 'List most competitive races',
            icon: 'trending-up'
          }
        ];

      case 'canvassing':
        return [
          {
            id: 'optimal-route',
            label: 'Generate optimal route',
            action: 'Generate optimal route',
            icon: 'route'
          },
          {
            id: 'high-priority-doors',
            label: 'Show high-priority doors',
            action: 'Show high-priority doors',
            icon: 'target'
          },
          {
            id: 'estimate-time',
            label: 'Estimate doors per hour',
            action: 'Estimate doors per hour',
            icon: 'clock'
          }
        ];

      case 'voter-targeting':
        return [
          {
            id: 'persuadable-voters',
            label: 'Find persuadable voters',
            action: 'Find persuadable voters',
            icon: 'users'
          },
          {
            id: 'gotv-priority',
            label: 'Show GOTV priority map',
            action: 'Show GOTV priority map',
            icon: 'map-pin'
          },
          {
            id: 'build-target-list',
            label: 'Build target list',
            action: 'Build target list',
            icon: 'list'
          }
        ];

      default:
        return [
          {
            id: 'help',
            label: 'Show help',
            action: 'system:help',
            icon: 'help-circle'
          }
        ];
    }
  }, [currentWorkflow, selectedPrecinct]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  const handleActionClick = useCallback(async (action: SuggestedAction) => {
    console.log('[AIPoliticalSessionHost] handleActionClick called with:', action);

    // Legacy "Navigate to /segments" — do not send through chat (map context breaks parsing / flyTo)
    const legacyNav = action.action.match(/^Navigate to\s+(\/[\w\-/]*)\s*$/i);
    if (legacyNav) {
      const path = legacyNav[1];
      const sm = getStateManager();
      const ids = sm.getState().segmentation.matchingPrecincts;
      if (path === '/segments' && ids?.length) {
        router.push(`/segments?precincts=${encodeURIComponent(ids.join(','))}`);
      } else {
        router.push(path);
      }
      addAssistantMessage(
        path === '/segments' ? 'Opening the segment builder with your precinct list…' : `Opening ${path}…`
      );
      return;
    }

    // Cross-tool: navigate:tool?params (split(':') must not break query string)
    if (action.action.startsWith('navigate:')) {
      const nav = CrossToolNavigator.parseNavigateCommand(action.action);
      if (nav) {
        CrossToolNavigator.navigateWithContext(nav.tool, nav.params, true);
        addAssistantMessage(
          nav.tool === 'segments' ? 'Opening the segment builder…' : `Opening ${nav.tool}…`
        );
        return;
      }
    }

    // Track suggestion acceptance for learning
    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'SUGGESTION_ACCEPTED',
      payload: { suggestionId: action.id },
      timestamp: new Date(),
    });

    // S7-003: Check if this is a resume action with map commands
    if (action.action.startsWith('resume:') && action.metadata?.mapCommands) {
      const mapCommands = action.metadata.mapCommands as MapCommand[];
      console.log('[AIPoliticalSessionHost] Resume action detected with map commands:', mapCommands);

      // Execute map commands FIRST to restore visual state
      mapCommands.forEach(cmd => {
        executeMapCommand(cmd);
      });

      // Get resume context
      const resumeContext = action.metadata.resumeContext as any;
      const precincts = resumeContext?.precincts || [];

      // Add acknowledgment message
      let message = `Restored your previous session`;
      if (precincts.length > 0) {
        const precinctList = precincts.slice(0, 3).join(', ');
        message += ` with ${precincts.length} precinct${precincts.length !== 1 ? 's' : ''}: ${precinctList}`;
        if (precincts.length > 3) {
          message += ` and ${precincts.length - 3} more`;
        }
      }
      message += '. What would you like to do next?';

      addAssistantMessage(message, generateContextualActions());
      return;
    }

    // SuggestionEngine plain tokens → NL or output:* (reuses colon handlers below)
    const nlOnlyShortcuts: Record<string, string> = {
      analyze_persuasion:
        'Develop a persuasion strategy for the selected area using Pennsylvania precinct persuasion opportunity and swing data.',
      analyze_visible:
        'Analyze the precincts currently visible on the map in Pennsylvania',
      start_comparison:
        'I want to compare this area to another area in Pennsylvania. Suggest a good comparison.',
    };
    const nl = nlOnlyShortcuts[action.action];
    if (nl) {
      await handleUserInput(nl);
      return;
    }

    const outputShortcuts: Record<string, string> = {
      generate_report: 'output:generateReport',
      save_segment: 'output:saveSegment',
      plan_canvassing: 'output:planCanvass',
      export_data: 'output:exportCSV',
    };
    const mapped = outputShortcuts[action.action];
    const effectiveAction = mapped ? { ...action, action: mapped } : action;

    // Check if action contains a colon (old format like 'map:select')
    if (effectiveAction.action.includes(':')) {
      const [category, operation] = effectiveAction.action.split(':');
      console.log('[AIPoliticalSessionHost] Action category:', category, 'operation:', operation);

      switch (category) {
        case 'map':
          handleMapAction(operation, effectiveAction.metadata);
          break;
        case 'filter':
          handleFilterAction(operation, effectiveAction.metadata);
          break;
        case 'analyze':
          handleAnalyzeAction(operation, effectiveAction.metadata);
          break;
        case 'canvassing':
          handleCanvassingAction(operation, effectiveAction.metadata);
          break;
        case 'output':
          handleOutputAction(operation, effectiveAction.metadata);
          break;
        case 'navigate':
          handleNavigateAction(operation, effectiveAction.metadata);
          break;
        case 'report':
          handleReportAction(operation, effectiveAction.metadata);
          break;
        case 'query':
          handleQueryAction(operation, effectiveAction.metadata);
          break;
        case 'temporal':
          handleTemporalAction(operation, effectiveAction.metadata);
          break;
        case 'workflow':
          handleWorkflowAction(operation, effectiveAction.metadata);
          break;
        case 'input':
          handleInputAction(operation, effectiveAction.metadata);
          break;
        case 'system':
          // Handle system actions (like help)
          if (operation === 'help') {
            addAssistantMessage(
              'I can help you with political analysis. Ask me about areas, demographics, swing potential, canvassing routes, or voter targeting.',
              generateContextualActions()
            );
          }
          break;
        default:
          console.warn('Unknown action category:', category);
      }
    } else {
      // New format: action is the message to send
      await handleUserInput(effectiveAction.action);
    }
  }, [handleUserInput, addAssistantMessage, generateContextualActions, executeMapCommand]);

  const handleMapAction = (operation: string, metadata?: Record<string, unknown>) => {
    console.log('[AIPoliticalSessionHost] handleMapAction called:', { operation, metadata });
    const command: MapCommand = {
      type: operation as MapCommand['type'],
      ...metadata, // Spread metadata so properties like 'metric' are at top level
      data: metadata
    };
    console.log('[AIPoliticalSessionHost] Executing map command:', command);
    executeMapCommand(command);
  };

  const handleFilterAction = (operation: string, metadata?: Record<string, unknown>) => {
    // Apply filter to map
    const command: MapCommand = {
      type: 'filter',
      metric: operation,
      data: metadata
    };
    executeMapCommand(command);
  };

  const handleAnalyzeAction = async (operation: string, metadata?: Record<string, unknown>) => {
    setIsProcessing(true);
    console.log('[AIPoliticalSessionHost] handleAnalyzeAction:', { operation, metadata });

    try {
      const stateManager = getStateManager();
      const state = stateManager.getState();

      switch (operation) {
        case 'explain-score':
        case 'explain': {
          // Explain the scoring methodology for current selection
          const precinctName = (metadata?.precinctName as string) ||
            state.featureSelection.currentFeature?.name;
          if (precinctName) {
            await handleUserInput(`Explain the targeting scores for ${precinctName}`);
          } else {
            addAssistantMessage(
              'Select a precinct on the map to explain its targeting scores.',
              [{ id: 'select', label: 'Select a precinct', action: 'Click on a precinct on the map' }]
            );
          }
          break;
        }

        case 'find-similar': {
          const precinctName = (metadata?.precinctName as string) ||
            state.featureSelection.currentFeature?.name;
          if (precinctName) {
            await handleUserInput(`Find precincts similar to ${precinctName}`);
          } else {
            addAssistantMessage(
              'Select a precinct first, then I can find similar areas.',
              [{ id: 'swing', label: 'Find swing precincts', action: 'Find high swing potential precincts' }]
            );
          }
          break;
        }

        case 'whatif-turnout': {
          const targetArea = (metadata?.areaName as string) ||
            state.featureSelection.currentFeature?.name ||
            'Ingham County';
          await handleUserInput(`What if turnout increases by 5% in ${targetArea}?`);
          break;
        }

        case 'election-history': {
          const precinctName = (metadata?.precinctName as string) ||
            state.featureSelection.currentFeature?.name;
          if (precinctName) {
            await handleUserInput(`Show election history for ${precinctName}`);
          } else {
            await handleUserInput('Show election trends across Ingham County');
          }
          break;
        }

        case 'show-trends':
        case 'trends': {
          const metric = (metadata?.metric as string) || 'partisan_lean';
          await handleUserInput(`Show ${metric.replace('_', ' ')} trends over time`);
          break;
        }

        case 'demographics': {
          const areaName = (metadata?.areaName as string) ||
            state.featureSelection.currentFeature?.name;
          if (areaName) {
            await handleUserInput(`Show demographics for ${areaName}`);
          } else {
            await handleUserInput('Show demographic breakdown of Ingham County');
          }
          break;
        }

        case 'rank-precincts': {
          const metric = (metadata?.metric as string) || 'swing_potential';
          const count = (metadata?.count as number) || 10;
          await handleUserInput(`Show top ${count} precincts by ${metric.replace('_', ' ')}`);
          break;
        }

        case 'precinct':
        case 'deep-dive': {
          const precinctName = (metadata?.precinctName as string) ||
            state.featureSelection.currentFeature?.name;
          if (precinctName) {
            await handleUserInput(`Give me a detailed analysis of ${precinctName}`);
          } else {
            addAssistantMessage(
              'Select a precinct on the map for detailed analysis.',
              [{ id: 'map', label: 'View map', action: 'map:showChoropleth' }]
            );
          }
          break;
        }

        case 'demographic-political': {
          await handleUserInput('Analyze the relationship between demographics and political lean');
          break;
        }

        case 'strategy-explanation': {
          await handleUserInput('Explain the targeting strategy methodology');
          break;
        }

        case 'jurisdiction-precincts': {
          const jurisdiction = (metadata?.jurisdiction as string);
          if (jurisdiction) {
            await handleUserInput(`Show all precincts in ${jurisdiction}`);
          } else {
            addAssistantMessage(
              'Which jurisdiction would you like to analyze?',
              [
                { id: 'lansing', label: 'Lansing', action: 'Show precincts in Lansing' },
                { id: 'el', label: 'East Lansing', action: 'Show precincts in East Lansing' },
                { id: 'meridian', label: 'Meridian Township', action: 'Show precincts in Meridian Township' },
              ]
            );
          }
          break;
        }

        default:
          // Fallback: treat the operation as a query
          await handleUserInput(`Analyze ${operation.replace(/-/g, ' ')}`);
      }
    } catch (error) {
      console.error('[AIPoliticalSessionHost] Analyze action error:', error);
      addAssistantMessage('Error performing analysis. Please try again.');
    }

    setIsProcessing(false);
  };

  const handleCanvassingAction = async (operation: string, metadata?: Record<string, unknown>) => {
    setIsProcessing(true);
    console.log('[AIPoliticalSessionHost] handleCanvassingAction:', { operation, metadata });

    try {
      switch (operation) {
        case 'createUniverse':
        case 'create': {
          // Get segment data from state or metadata
          const stateManager = getStateManager();
          const state = stateManager.getState();
          const precinctIds = (metadata?.precinctIds as string[]) ||
            state.segmentation.matchingPrecincts || [];

          if (precinctIds.length === 0) {
            addAssistantMessage(
              'No precincts selected for canvassing. Please select or filter precincts first.',
              [
                { id: 'segment', label: 'Go to Segments', action: 'Navigate to /segments' },
                { id: 'filter', label: 'Filter precincts', action: 'Show me high GOTV precincts' },
              ]
            );
          } else {
            // Create canvassing universe
            const universeName = (metadata?.name as string) || `Canvass ${new Date().toLocaleDateString()}`;
            const doors = precinctIds.length * 250; // Estimate 250 doors per precinct

            addAssistantMessage(
              `**Canvassing Universe Created:**\n\n` +
              `- **Name:** ${universeName}\n` +
              `- **Precincts:** ${precinctIds.length}\n` +
              `- **Estimated Doors:** ${doors.toLocaleString()}\n` +
              `- **Turfs:** ${Math.ceil(doors / 200)} (at 200 doors/turf)\n\n` +
              `Ready to generate walk lists and turf assignments.`,
              [
                { id: 'export', label: 'Export Walk List', action: 'output:exportVAN', metadata: { precinctIds } },
                { id: 'view', label: 'View on Map', action: 'map:highlight', metadata: { target: precinctIds } },
              ]
            );

            // Highlight precincts on map
            executeMapCommand({
              type: 'highlight',
              target: precinctIds,
            });
          }
          break;
        }

        case 'generateTurfs':
        case 'generate_turfs': {
          const stateManager = getStateManager();
          const state = stateManager.getState();
          const precinctIds = (metadata?.precinctIds as string[]) ||
            state.segmentation.matchingPrecincts || [];

          const turfCount = Math.ceil((precinctIds.length * 250) / 200);

          addAssistantMessage(
            `**Generated ${turfCount} Turfs:**\n\n` +
            `Each turf contains approximately 200 doors for efficient canvassing.\n\n` +
            `| Turf | Precincts | Est. Doors |\n` +
            `|------|-----------|------------|\n` +
            `${Array.from({ length: Math.min(turfCount, 5) }, (_, i) =>
              `| Turf ${i + 1} | ${Math.ceil(precinctIds.length / turfCount)} | ~200 |`
            ).join('\n')}\n` +
            (turfCount > 5 ? `\n*...and ${turfCount - 5} more turfs*` : ''),
            [
              { id: 'export', label: 'Export Walk Lists', action: 'output:exportVAN', metadata: { precinctIds } },
              { id: 'assign', label: 'Assign Volunteers', action: 'canvassing:assignVolunteers' },
            ]
          );
          break;
        }

        case 'exportWalklist':
        case 'export_walklist': {
          // Redirect to export handler
          await handleOutputAction('exportVAN', metadata);
          return;
        }

        case 'assignVolunteers': {
          addAssistantMessage(
            '**Volunteer Assignment:**\n\n' +
            'To assign volunteers to turfs, you can:\n' +
            '1. Export walk lists for manual assignment\n' +
            '2. Use VAN/VoteBuilder for volunteer management\n' +
            '3. Set up turf assignments in your campaign CRM\n\n' +
            '*Tip: Match volunteer experience to turf difficulty - assign experienced canvassers to persuasion turfs.*',
            [
              { id: 'export', label: 'Export for VAN', action: 'output:exportVAN' },
            ]
          );
          break;
        }
      }
    } catch (error) {
      console.error('[AIPoliticalSessionHost] Canvassing action error:', error);
      addAssistantMessage('Error processing canvassing action. Please try again.');
    }

    setIsProcessing(false);
  };

  const handleOutputAction = async (operation: string, metadata?: Record<string, unknown>) => {
    setIsProcessing(true);
    console.log('[AIPoliticalSessionHost] handleOutputAction:', { operation, metadata });

    const stateManager = getStateManager();
    const state = stateManager.getState();

    try {
      switch (operation) {
        case 'exportSegments':
        case 'exportCSV':
        case 'exportPrecincts': {
          // Fetch real precinct data
          const response = await fetch('/api/segments?action=precincts');
          const data = await response.json();

          if (!data.success || !data.precincts) {
            addAssistantMessage('Failed to fetch precinct data. Please try again.');
            break;
          }

          const targetIds = (metadata?.precinctIds as string[]) ||
            state.segmentation.matchingPrecincts || [];
          const allPrecincts = data.precincts;

          // Filter to matching precincts, or use all if none specified
          const precinctsToExport = targetIds.length > 0
            ? allPrecincts.filter((p: any) => targetIds.includes(p.id))
            : allPrecincts;

          // Build CSV
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
          link.download = `${getPoliticalRegionEnv().state.replace(/\s+/g, '-').toLowerCase()}-precincts-${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          URL.revokeObjectURL(url);

          addAssistantMessage(
            `✅ Exported ${precinctsToExport.length} precincts to CSV with targeting scores.`,
            [
              { id: 'analyze', label: 'Continue analysis', action: 'What else can I analyze?' },
            ]
          );

          toast({
            title: 'Export Complete',
            description: `Downloaded ${precinctsToExport.length} precincts`,
          });
          break;
        }

        case 'exportVoterFile': {
          // Similar to exportCSV but with more fields
          const response = await fetch('/api/segments?action=precincts');
          const data = await response.json();

          if (!data.success || !data.precincts) {
            addAssistantMessage('Failed to fetch voter file data. Please try again.');
            break;
          }

          const allPrecincts = data.precincts;

          const headers = [
            'Precinct ID', 'Precinct Name', 'Jurisdiction', 'Congressional', 'State Senate', 'State House',
            'Registered Voters', 'Partisan Lean', 'Swing Potential', 'GOTV Priority', 'Persuasion Score',
            'Avg Turnout', 'Density'
          ];

          const rows = allPrecincts.map((p: any) => [
            p.id,
            `"${p.name}"`,
            `"${p.jurisdiction}"`,
            p.districts?.congressional || '',
            p.districts?.stateSenate || '',
            p.districts?.stateHouse || '',
            p.demographics?.population18up || 0,
            (p.electoral?.partisanLean || 0).toFixed(1),
            Math.round(p.targeting?.swingPotential || 0),
            Math.round(p.targeting?.gotvPriority || 0),
            Math.round(p.targeting?.persuasionOpportunity || 0),
            ((p.electoral?.avgTurnout || 0) * 100).toFixed(1) + '%',
            p.demographics?.density || 'Unknown'
          ].join(','));

          const csvContent = [headers.join(','), ...rows].join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${getPoliticalRegionEnv().state.replace(/\s+/g, '-').toLowerCase()}-voter-file-${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          URL.revokeObjectURL(url);

          addAssistantMessage(
            `✅ Exported full voter file with ${allPrecincts.length} precincts and district assignments.`
          );

          toast({
            title: 'Voter File Exported',
            description: `Downloaded ${allPrecincts.length} precincts`,
          });
          break;
        }

        case 'exportVAN': {
          // VAN-compatible format
          const response = await fetch('/api/segments?action=precincts');
          const data = await response.json();

          if (!data.success || !data.precincts) {
            addAssistantMessage('Failed to fetch data for VAN export. Please try again.');
            break;
          }

          const targetIds = (metadata?.precinctIds as string[]) ||
            state.segmentation.matchingPrecincts || [];
          const allPrecincts = data.precincts;

          const precinctsToExport = targetIds.length > 0
            ? allPrecincts.filter((p: any) => targetIds.includes(p.id))
            : allPrecincts;

          // VAN format headers
          const headers = [
            'VanID', 'PrecinctName', 'County', 'TargetScore', 'Priority', 'Notes'
          ];

          const rows = precinctsToExport.map((p: any, i: number) => [
            `VAN${String(i + 1).padStart(6, '0')}`,
            `"${p.name}"`,
            getPoliticalRegionEnv().county !== 'Statewide'
              ? getPoliticalRegionEnv().county
              : getPoliticalRegionEnv().state,
            Math.round((p.targeting?.gotvPriority || 0) + (p.targeting?.swingPotential || 0)),
            p.targeting?.gotvPriority >= 70 ? 'HIGH' : p.targeting?.gotvPriority >= 50 ? 'MEDIUM' : 'LOW',
            `"${p.jurisdiction}"`
          ].join(','));

          const csvContent = [headers.join(','), ...rows].join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${getPoliticalRegionEnv().state.replace(/\s+/g, '-').toLowerCase()}-van-export-${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          URL.revokeObjectURL(url);

          addAssistantMessage(
            `✅ Exported ${precinctsToExport.length} precincts in VAN-compatible format.\n\n` +
            `*Import this file into VAN/VoteBuilder for walk list generation.*`,
            [
              { id: 'van-help', label: 'VAN Import Instructions', action: 'How do I import into VAN?' },
            ]
          );

          toast({
            title: 'VAN Export Complete',
            description: `Downloaded ${precinctsToExport.length} precincts for VAN`,
          });
          break;
        }

        case 'exportDonors': {
          // Donor data export
          try {
            const response = await fetch('/data/donors/zip-aggregates.json');
            const donorData = await response.json();

            if (!donorData || !donorData.zips) {
              addAssistantMessage('No donor data available for export.');
              break;
            }

            const headers = ['ZIP Code', 'City', 'Total Amount', 'Donor Count', 'Avg Contribution'];
            const rows = Object.entries(donorData.zips).map(([zip, data]: [string, any]) => [
              zip,
              `"${data.city || 'Unknown'}"`,
              data.totalAmount || 0,
              data.donorCount || 0,
              data.avgContribution || 0
            ].join(','));

            const csvContent = [headers.join(','), ...rows].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${getPoliticalRegionEnv().state.replace(/\s+/g, '-').toLowerCase()}-donors-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);

            addAssistantMessage(`✅ Exported donor data by ZIP code.`);

            toast({
              title: 'Donor Export Complete',
              description: 'Downloaded FEC donor aggregates',
            });
          } catch (error) {
            addAssistantMessage('Unable to export donor data. Data may not be available.');
          }
          break;
        }

        case 'generateReport':
        case 'report': {
          // Navigate to report generation
          addAssistantMessage(
            '**Generate Report:**\n\n' +
            'I can generate several types of PDF reports:\n\n' +
            '- **Political Profile** - Comprehensive 7-page analysis\n' +
            '- **Executive Summary** - 1-page overview\n' +
            '- **Targeting Brief** - Voter targeting recommendations\n' +
            '- **Comparison Report** - Compare multiple areas\n\n' +
            'Which report would you like?',
            [
              { id: 'profile', label: 'Political Profile', action: 'Generate a political profile report' },
              { id: 'exec', label: 'Executive Summary', action: 'Generate an executive summary' },
              { id: 'targeting', label: 'Targeting Brief', action: 'Generate a targeting brief' },
            ]
          );
          break;
        }

        case 'saveSegment': {
          const precinctIds = (metadata?.precinctIds as string[]) ||
            state.segmentation.matchingPrecincts || [];

          if (precinctIds.length === 0) {
            addAssistantMessage(
              'No precincts to save as a segment. Please select or filter precincts first.',
              [
                { id: 'filter', label: 'Filter precincts', action: 'Show me swing precincts' },
              ]
            );
          } else {
            // Generate segment name
            const segmentName = `Segment ${new Date().toLocaleDateString()}`;
            const segmentId = `segment-${Date.now()}`;

            // Save to segment store (simplified - in production use SegmentStore)
            try {
              localStorage.setItem(`saved-segment-${segmentId}`, JSON.stringify({
                id: segmentId,
                name: segmentName,
                precinctIds,
                createdAt: new Date().toISOString(),
              }));

              addAssistantMessage(
                `✅ Saved segment "${segmentName}" with ${precinctIds.length} precincts.\n\n` +
                `View saved segments in Settings.`,
                [
                  { id: 'settings', label: 'View Segments', action: 'Navigate to /settings' },
                  { id: 'export', label: 'Export Segment', action: 'output:exportCSV', metadata: { precinctIds } },
                ]
              );

              toast({
                title: 'Segment Saved',
                description: `${precinctIds.length} precincts saved as "${segmentName}"`,
              });
            } catch (error) {
              addAssistantMessage('Failed to save segment. Please try again.');
            }
          }
          break;
        }

        case 'planCanvass': {
          // Redirect to canvassing action
          await handleCanvassingAction('createUniverse', metadata);
          return;
        }

        case 'exportConversation': {
          // Export chat history
          const conversationText = messages.map(m =>
            `[${m.role.toUpperCase()}] ${m.content}`
          ).join('\n\n---\n\n');

          const blob = new Blob([conversationText], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `political-ai-conversation-${new Date().toISOString().split('T')[0]}.txt`;
          link.click();
          URL.revokeObjectURL(url);

          addAssistantMessage('✅ Exported conversation to text file.');

          toast({
            title: 'Conversation Exported',
            description: 'Downloaded chat history',
          });
          break;
        }

        default:
          addAssistantMessage(
            `Export type "${operation}" is not yet implemented.`,
            [
              { id: 'csv', label: 'Export as CSV', action: 'output:exportCSV' },
              { id: 'van', label: 'Export for VAN', action: 'output:exportVAN' },
            ]
          );
      }
    } catch (error) {
      console.error('[AIPoliticalSessionHost] Output action error:', error);
      addAssistantMessage('Error processing export. Please try again.');
    }

    setIsProcessing(false);
  };

  // Handle navigation actions
  const handleNavigateAction = (operation: string, metadata?: Record<string, unknown>) => {
    console.log('[AIPoliticalSessionHost] handleNavigateAction:', { operation, metadata });

    // Map operation names to routes
    const routeMap: Record<string, string> = {
      'compare': '/compare',
      'settings': '/settings',
      'segments': '/segments',
      'political': '/political',
      'political-ai': '/political-ai',
    };

    const opBase = operation.split('?')[0];
    const querySuffix = operation.includes('?') ? operation.slice(operation.indexOf('?')) : '';
    const basePath = routeMap[opBase] ?? `/${opBase}`;
    router.push(querySuffix ? `${basePath}${querySuffix}` : basePath);

    addAssistantMessage(
      `Navigating to ${opBase}...`,
      [{ id: 'back', label: 'Go back', action: 'navigate:political-ai' }]
    );
  };

  // Handle report generation actions
  const handleReportAction = async (operation: string, metadata?: Record<string, unknown>) => {
    setIsProcessing(true);
    console.log('[AIPoliticalSessionHost] handleReportAction:', { operation, metadata });

    const stateManager = getStateManager();
    const state = stateManager.getState();

    // Get precincts from metadata or state
    const precinctNames = (metadata?.precinctNames as string[]) ||
      state.segmentation.matchingPrecincts ||
      (state.featureSelection.currentFeature ? [state.featureSelection.currentFeature.name] : []);

    if (precinctNames.length === 0 && operation !== 'donor') {
      addAssistantMessage(
        '⚠️ No precincts selected. Please select precincts on the map or build a segment first.',
        [
          { id: 'select', label: 'Select on map', action: 'map:showChoropleth' },
          { id: 'segment', label: 'Build segment', action: 'Find high swing precincts' },
        ]
      );
      setIsProcessing(false);
      return;
    }

    try {
      let endpoint: string;
      let requestBody: Record<string, unknown>;

      switch (operation) {
        case 'executive':
          endpoint = '/api/political-pdf/executive-summary';
          requestBody = {
            precinctNames,
            areaName: (metadata?.areaName as string) || (precinctNames.length === 1 ? precinctNames[0] : `${precinctNames.length} Precincts`),
          };
          break;

        case 'targeting':
          endpoint = '/api/political-pdf/targeting-brief';
          requestBody = {
            precinctNames,
            reportTitle: (metadata?.reportTitle as string) || 'Targeting Brief',
            sortBy: 'combined',
          };
          break;

        case 'profile':
          endpoint = '/api/political-pdf';
          requestBody = {
            precinctNames,
            areaName: (metadata?.areaName as string) || (precinctNames.length === 1 ? precinctNames[0] : `${precinctNames.length} Precincts`),
          };
          break;

        case 'comparison':
          endpoint = '/api/political-pdf/comparison';
          const entityA = precinctNames[0] || '';
          const entityB = precinctNames[1] || '';
          if (!entityA || !entityB) {
            addAssistantMessage(
              '⚠️ Comparison reports require two precincts. Please select two areas to compare.',
              [{ id: 'compare', label: 'Go to Compare', action: 'navigate:compare' }]
            );
            setIsProcessing(false);
            return;
          }
          requestBody = { entityA, entityB };
          break;

        case 'canvassing':
          endpoint = '/api/political-pdf/canvassing';
          requestBody = {
            precinctNames,
            reportTitle: 'Canvassing Plan',
          };
          break;

        case 'donor':
          endpoint = '/api/political-pdf/donor';
          requestBody = {
            areaName: (metadata?.areaName as string) || 'Ingham County',
          };
          break;

        default:
          // Default to profile report
          endpoint = '/api/political-pdf';
          requestBody = { precinctNames };
      }

      addAssistantMessage(`📄 **Generating ${operation} report...**\n\n_This may take a few seconds._`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Report generation failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${operation}-report-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      addAssistantMessage(
        `✅ **${operation.charAt(0).toUpperCase() + operation.slice(1)} Report** downloaded successfully!`,
        [
          { id: 'another', label: 'Generate another report', action: 'What reports can you generate?' },
        ]
      );

      toast({
        title: 'Report Generated',
        description: `${operation} report downloaded`,
      });

    } catch (error) {
      console.error('[AIPoliticalSessionHost] Report generation error:', error);
      addAssistantMessage(
        `❌ Failed to generate ${operation} report. Please try again.`,
        [{ id: 'retry', label: 'Try again', action: `report:${operation}` }]
      );
    }

    setIsProcessing(false);
  };

  // Handle query actions (for polls, etc.)
  const handleQueryAction = async (operation: string, metadata?: Record<string, unknown>) => {
    setIsProcessing(true);
    console.log('[AIPoliticalSessionHost] handleQueryAction:', { operation, metadata });

    try {
      switch (operation) {
        case 'poll_refresh':
          await handleUserInput('Show me the latest polling data');
          break;
        case 'poll_current':
          await handleUserInput('What are the current poll numbers?');
          break;
        case 'poll_competitive':
          await handleUserInput('Which races are most competitive based on polls?');
          break;
        default:
          await handleUserInput(`Query ${operation.replace('_', ' ')}`);
      }
    } catch (error) {
      console.error('[AIPoliticalSessionHost] Query action error:', error);
      addAssistantMessage('Error processing query. Please try again.');
    }

    setIsProcessing(false);
  };

  // Handle temporal/animation actions
  const handleTemporalAction = (operation: string, metadata?: Record<string, unknown>) => {
    console.log('[AIPoliticalSessionHost] handleTemporalAction:', { operation, metadata });

    switch (operation) {
      case 'enable':
        executeMapCommand({ type: 'showTemporal', data: { action: 'enable' } });
        addAssistantMessage(
          '⏱️ **Temporal mode enabled.** You can now view election data across different years.',
          [
            { id: 'animate', label: 'Play animation', action: 'temporal:animate' },
            { id: 'compare', label: 'Compare elections', action: 'Compare 2020 vs 2024 elections' },
          ]
        );
        break;

      case 'animate':
        executeMapCommand({ type: 'showTemporal', data: { action: 'animate' } });
        addAssistantMessage('▶️ Playing election year animation...');
        break;

      case 'momentum':
        executeMapCommand({ type: 'showHeatmap', metric: 'partisan_lean' });
        addAssistantMessage(
          '📈 **Showing political momentum** - areas where partisan lean has shifted over recent elections.',
          [{ id: 'trends', label: 'See trend details', action: 'Show partisan trends' }]
        );
        break;

      default:
        executeMapCommand({ type: 'showTemporal', data: { action: operation } });
        addAssistantMessage(`Temporal action: ${operation}`);
    }
  };

  // Handle workflow actions
  const handleWorkflowAction = async (operation: string, metadata?: Record<string, unknown>) => {
    console.log('[AIPoliticalSessionHost] handleWorkflowAction:', { operation, metadata });

    switch (operation) {
      case 'find-targets':
        // Start the target finding workflow
        handleWorkflowSelect({
          id: 'voter-targeting',
          name: 'Voter Targeting',
          description: 'Find and prioritize target voters',
        });
        break;

      case 'start':
        // Generic workflow start - check metadata for workflow type
        const workflowType = (metadata?.workflowType as string) || 'district-analysis';
        handleWorkflowSelect({
          id: workflowType,
          name: workflowType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `${workflowType} workflow`,
        });
        break;

      default:
        // Treat as a query about workflows
        await handleUserInput(`Start ${operation.replace(/-/g, ' ')} workflow`);
    }
  };

  // Handle input focus actions
  const handleInputAction = (operation: string, _metadata?: Record<string, unknown>) => {
    console.log('[AIPoliticalSessionHost] handleInputAction:', { operation });

    switch (operation) {
      case 'focus':
        // Focus the chat input using the ref
        inputRef.current?.focus();
        break;

      case 'clear':
        // Clear the input using the ref
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        break;

      default:
        console.log('[AIPoliticalSessionHost] Unknown input action:', operation);
    }
  };

  const resetSession = useCallback(() => {
    setMessages([]);
    setCurrentWorkflow(null);
    setCurrentFeatureCard(null);
    setSessionState('welcome');
    executeMapCommand({ type: 'clear' });
  }, [executeMapCommand]);

  // Handle feature card action click (Phase G)
  const handleFeatureCardAction = useCallback(async (action: SuggestedAction) => {
    // Track suggestion acceptance for learning
    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'SUGGESTION_ACCEPTED',
      payload: { suggestionId: action.id },
      timestamp: new Date(),
    });

    // Clear the feature card after action (remove from messages too)
    setMessages((prev: Message[]) => prev.filter(m => !m.metadata?.isFeatureCard));
    setCurrentFeatureCard(null);

    // Process the action through normal user input flow
    await handleUserInput(action.action);
  }, [handleUserInput]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="ai-political-session-host h-full flex flex-col">
      {/* Change Workflow button - S1A-010 fix */}
      {currentWorkflow && sessionState === 'active' && (
        <button
          onClick={() => {
            setSessionState('welcome');
            setCurrentWorkflow(null);
            setMessages([]);
            setCurrentFeatureCard(null);
          }}
          className="text-xs text-gray-500 hover:text-gray-700 bg-gray-50 px-2 py-3 rounded transition-colors flex items-center gap-1"
          title="Return to workflow selection"
        >
          <ArrowLeftIcon className="w-3 h-3" />
          Change workflow
        </button>
      )}
      {/* Persistent Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#33a852] to-[#2d9944] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Political Assistant</h2>
              {currentWorkflow && (
                <p className="text-xs text-[#33a852]">{currentWorkflow.name}</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Session state will determine which child components render */}
      {sessionState === 'welcome' && (
        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          {/* P0-5 Fix: Show FeatureCard even in welcome state when user clicks map */}
          {currentFeatureCard ? (
            <div className="w-full max-w-md mx-auto">
              <FeatureSelectionCard
                selection={currentFeatureCard}
                onAction={handleFeatureCardAction}
                isLoading={isProcessing}
              />
              <p className="text-xs text-gray-400 text-center mt-2">
                Take action on this selection or click elsewhere to dismiss
              </p>
            </div>
          ) : (
            <div className="text-center max-w-2xl">
              <p className="text-xs text-gray-600 mb-6">Select a workflow to get started:</p>

              <div className="grid grid-cols-1 gap-3 mt-8 max-w-md mx-auto">
                {/* District Analysis */}
                <button
                  onClick={() => handleWorkflowSelect({
                    id: 'district-analysis',
                    name: 'Area Analysis',
                    description: 'Analyze areas and demographics'
                  })}
                  className="p-3 rounded-xl bg-white hover:shadow-md hover:border-[#33a852] transition-all text-left border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#33a852]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-xs text-gray-900">Area Analysis</h3>
                      <p className="text-xs text-gray-600 mt-0.5">Analyze areas and demographics</p>
                    </div>
                  </div>
                </button>

                {/* Swing Areas */}
                <button
                  onClick={() => handleWorkflowSelect({
                    id: 'swing-detection',
                    name: 'Swing Area Detection',
                    description: 'Identify competitive swing areas'
                  })}
                  className="p-3 rounded-xl bg-white hover:shadow-md hover:border-[#33a852] transition-all text-left border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#33a852]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-xs text-gray-900">Swing Areas</h3>
                      <p className="text-xs text-gray-600 mt-0.5">Identify competitive swing areas</p>
                    </div>
                  </div>
                </button>

                {/* Voter Targeting */}
                <button
                  onClick={() => handleWorkflowSelect({
                    id: 'voter-targeting',
                    name: 'Voter Targeting',
                    description: 'Identify high-priority voter segments'
                  })}
                  className="p-3 rounded-xl bg-white hover:shadow-md hover:border-[#33a852] transition-all text-left border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#33a852]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-xs text-gray-900">Voter Targeting</h3>
                      <p className="text-xs text-gray-600 mt-0.5">Identify high-priority voter segments</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {sessionState === 'active' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Fallback: Selected Precinct Indicator (legacy) - only shows if no feature card */}
          {!currentFeatureCard && selectedPrecinct && (
            <div className="flex-shrink-0 mx-4 mt-3 p-2 bg-gradient-to-r from-emerald-50 to-green-50 border border-[#33a852] rounded-lg shadow-sm">
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
                <span className="text-xs text-[#33a852] font-medium">Map Selection</span>
              </div>
            </div>
          )}

          {/* Knowledge Graph Panel (Phase 16) */}
          {showGraphPanel && graphEntities.length > 0 && (
            <div className="flex-shrink-0 mx-4 mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔗</span>
                  <span className="text-xs font-medium text-gray-700">Knowledge Graph</span>
                  <span className="text-xs text-gray-500">({graphEntities.length} entities, {graphRelationships.length} relationships)</span>
                </div>
                <button
                  onClick={() => setShowGraphPanel(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close graph"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <KnowledgeGraphViewer
                entities={graphEntities}
                relationships={graphRelationships}
                height={300}
                showLabels={true}
                showLegend={true}
                onNodeSelect={(entity) => {
                  console.log('[KnowledgeGraph] Node selected:', entity);
                }}
                onExploreRequest={(entityId, query) => {
                  handleUserInput(query);
                }}
              />
            </div>
          )}

          {/* Conversation Area - with custom scrollbar */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 relative z-0">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Feature Card Message - render as FeatureSelectionCard */}
                {message.featureCard ? (
                  <div className="max-w-[90%]">
                    <FeatureSelectionCard
                      selection={message.featureCard}
                      onAction={handleFeatureCardAction}
                      isLoading={isProcessing}
                    />
                    <p className="text-xs text-gray-400 text-center mt-1">
                      Click elsewhere on map to dismiss
                    </p>
                  </div>
                ) : (
                  <div
                    className={`max-w-full rounded-2xl p-4 shadow-sm ${message.role === 'user'
                      ? 'bg-gradient-to-br from-[#33a852] to-[#2d9944] text-white'
                      : 'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900 border border-gray-200'
                      }`}
                  >
                    {/* Wave 7: Improved prose styling for better readability */}
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none
                      prose-headings:text-sm prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:mt-3 prose-headings:mb-2
                      prose-p:text-sm prose-p:my-2 prose-p:leading-relaxed
                      prose-li:text-sm prose-li:my-1
                      prose-ul:my-2 prose-ol:my-2
                      prose-strong:font-semibold prose-strong:text-gray-900
                      prose-a:text-[#33a852] prose-a:underline
                      [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <MessageContentWithSections content={message.content} onMapCommand={onMapCommand} />
                    </div>

                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.actions.map(action => (
                          <button
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className="block w-full text-left px-3 py-2 text-xs bg-gradient-to-br from-slate-50 to-gray-100 text-gray-900 rounded-md border border-gray-200 hover:from-gray-100 hover:to-gray-150 hover:border-[#33a852] transition-all"
                            disabled={isProcessing}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Feature cards are now rendered inline as messages above */}

            {/* Contextual thinking indicator with rotating messages */}
            {isProcessing && (
              <ThinkingIndicator context={queryContext} />
            )}

            {/* Auto-scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Fixed Footer with Input and Start Over */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white overflow-hidden">
            {/* Input Area */}
            <div className="p-4 max-w-full">
              {/* Keyboard shortcut hint (P3-2) */}
              <div className="mb-2 text-center">
                <span className="text-xs text-gray-400">Press ⌘K to focus • ⌘↵ to send • Enter &quot;/help&quot; for commands</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const textarea = (e.target as HTMLFormElement).elements.namedItem('input') as HTMLTextAreaElement;
                  if (textarea.value.trim()) {
                    handleUserInput(textarea.value);
                    textarea.value = '';
                  }
                }}
                className="flex gap-2 w-full items-end"
              >
                <textarea
                  ref={inputRef}
                  name="input"
                  placeholder="Ask me anything..."
                  rows={3}
                  className="flex-1 min-w-0 px-4 py-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33a852] focus:border-[#33a852] transition-all resize-none"
                  disabled={isProcessing}
                  onKeyDown={(e) => {
                    // Submit on Enter (without Shift)
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const form = e.currentTarget.closest('form');
                      if (form) {
                        form.requestSubmit();
                      }
                    }
                  }}
                />
                <button
                  type="submit"
                  className="px-4 py-3 text-sm bg-gradient-to-r from-[#33a852] to-[#2d9944] text-white rounded-xl hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md font-medium flex-shrink-0 min-h-[48px] whitespace-nowrap"
                  disabled={isProcessing}
                >
                  Send
                </button>
              </form>
            </div>

            {/* Sticky Footer with Start Over */}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <button
                onClick={resetSession}
                className="text-xs text-gray-500 hover:text-[#33a852] transition-colors"
              >
                ← Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      {sessionState === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-[#33a852] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-xs text-gray-600">Loading workflow...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Default export
export default AIPoliticalSessionHost;
