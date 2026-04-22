/**
 * SuggestionEngine - Generates context-aware suggestions for the AI
 *
 * This engine analyzes the current application state and generates
 * relevant suggestions that the AI can present to the user.
 *
 * Part of Phase 2: Suggestion Intelligence
 * See docs/AI-CONTEXT-AWARENESS-PLAN.md for full architecture
 */

import {
  getStateManager,
  type ApplicationState,
  type SelectionHistoryEntry,
  type MapState,
  type MunicipalityData,
} from './ApplicationStateManager';
import type { PrecinctData } from '@/lib/segmentation/types';
import {
  getSpatialReasoningEngine,
  type SpatialAnalysis,
  type SpatialPrecinctInput,
  type SpatialSuggestion,
} from '@/lib/ai/spatial';
import {
  getInsightEngine,
  type Insight,
  type InsightTrigger,
  type InsightCheckResult,
  type InsightCategory,
  frameAsDiscovery,
  getFollowUpQuestions,
} from '@/lib/ai/insights';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

// ============================================================================
// Types
// ============================================================================

export interface SuggestedAction {
  id: string;
  label: string;
  description?: string;
  action: string;
  priority: number; // 0-100, higher = more relevant
  category: SuggestionCategory;
  metadata?: Record<string, unknown>;
  triggerReason?: string; // Why this suggestion is relevant
}

export type SuggestionCategory =
  | 'exploration'    // Navigate to areas, zoom, pan
  | 'analysis'       // Run analysis, view metrics
  | 'comparison'     // Compare entities
  | 'segmentation'   // Create or modify segments
  | 'canvassing'     // Plan field operations
  | 'donors'         // Donor analysis
  | 'reporting'      // Generate reports
  | 'workflow'       // Continue or start workflows
  | 'session';       // Session-related (continue, recap)

export interface AIMessage {
  acknowledgment: string;
  insight?: string;
  suggestions: SuggestedAction[];
}

export interface ProactiveTrigger {
  id: string;
  condition: (state: ApplicationState) => boolean;
  message: (state: ApplicationState) => string;
  suggestions: (state: ApplicationState) => SuggestedAction[];
  cooldownMs: number; // Minimum time between triggers
  priority: number;
  category?: ProactiveTriggerCategory; // For user preference grouping
}

// Phase 10: Proactive Message Preferences
export type ProactiveTriggerCategory =
  | 'idle-help'           // Help offers when user is idle
  | 'exploration-tips'    // Tips based on exploration patterns
  | 'workflow-suggestions'// Workflow continuation suggestions
  | 'output-prompts';     // Output/report generation prompts

export interface ProactivePreferences {
  dismissedTriggers: string[];     // Specific trigger IDs dismissed permanently
  disabledCategories: ProactiveTriggerCategory[]; // Entire categories disabled
  cooldownMultiplier: number;      // 1.0 = default, 2.0 = double cooldown, etc.
  lastUpdated: Date;
}

// ============================================================================
// SuggestionEngine
// ============================================================================

class SuggestionEngine {
  private static instance: SuggestionEngine;
  private lastSuggestions: Map<string, number> = new Map(); // suggestionId -> timestamp
  private lastProactiveTrigger: Map<string, number> = new Map(); // triggerId -> timestamp
  private suggestionCooldownMs = 60000; // 1 minute between same suggestions
  private proactivePreferences: ProactivePreferences;
  private readonly PREFERENCES_KEY = 'pol_proactive_preferences';
  private lastToolForCooldown: string | null = null; // P2-41: Track tool changes for cooldown reset

  // Ambient awareness tracking (Phase 12: Principle 15)
  private hoverHistory: Array<{ id: string; timestamp: number }> = [];
  private filterHistory: Array<{ filter: string; timestamp: number }> = [];
  private zoomWithoutSelectCount: number = 0;
  private lastSelectTimestamp: number = 0;
  private pendingSuggestion: SuggestedAction | null = null;

  // Wave 3: Enhanced pattern tracking
  private metricViewHistory: Array<{ metric: string; precinctId: string; timestamp: number }> = [];
  private backAndForthHistory: Array<{ precinctId: string; timestamp: number }> = [];
  private lastSuggestionTimestamp: number = 0;
  private readonly SUGGESTION_COOLDOWN_MS = 30000; // 30 seconds between suggestions

  private constructor() {
    this.proactivePreferences = this.loadPreferences();
  }

  static getInstance(): SuggestionEngine {
    if (!SuggestionEngine.instance) {
      SuggestionEngine.instance = new SuggestionEngine();
    }
    return SuggestionEngine.instance;
  }

  // ============================================================================
  // Main Suggestion Generation
  // ============================================================================

  /**
   * Generate contextual message when user selects a precinct
   */
  generatePrecinctSelectionMessage(precinct: PrecinctData): AIMessage {
    const state = getStateManager().getState();
    const suggestions = this.generatePrecinctSuggestions(precinct, state);

    // Build acknowledgment
    let acknowledgment = `I see you selected **${precinct.name || precinct.id}**`;

    // Add classification
    const classification = this.classifyPrecinct(precinct);
    if (classification) {
      acknowledgment += `, ${classification}`;
    }

    // Build insight
    let insight = this.generatePrecinctInsight(precinct, state);

    // Wave 5A: Issue #18 - Add narrative thread synthesis after significant exploration
    const stateManager = getStateManager();
    const explorationDepth = stateManager.getExplorationDepth();
    if (explorationDepth >= 30 && state.behavior.exploredPrecincts.size >= 5) {
      const narrative = this.synthesizeExplorationNarrative();
      if (narrative) {
        // Prepend narrative to insight
        insight = narrative + (insight ? `\n\n${insight}` : '');
      }
    }

    // P0-6: Check for serendipitous insights when exploration depth is sufficient
    if (explorationDepth >= 30 && state.behavior.exploredPrecincts.size >= 3) {
      // Pass just the trigger type - the method will get context from state manager
      this.checkForSerendipitousInsight('precinct_selection').catch(err => {
        console.warn('[SuggestionEngine] Failed to check serendipitous insight:', err);
      });
    }

    return {
      acknowledgment,
      insight,
      suggestions: this.prioritizeSuggestions(suggestions, state),
    };
  }

  /**
   * Generate contextual message when user selects a municipality
   */
  generateMunicipalitySelectionMessage(municipality: MunicipalityData): AIMessage {
    const state = getStateManager().getState();
    const suggestions = this.generateMunicipalitySuggestions(municipality, state);

    const regionLabel =
      getPoliticalRegionEnv().stateFips === '42' ? 'Pennsylvania' : 'Ingham County';
    const acknowledgment = `I see you selected **${municipality.name}**, a ${municipality.type || 'municipality'} in ${regionLabel}`;

    return {
      acknowledgment,
      suggestions: this.prioritizeSuggestions(suggestions, state),
    };
  }

  /**
   * Generate contextual message based on map view changes
   */
  generateMapViewMessage(mapState: MapState): AIMessage {
    const state = getStateManager().getState();
    const suggestions = this.generateMapViewSuggestions(mapState, state);

    const visibleCount = mapState.visiblePrecincts.length;
    let acknowledgment = `Viewing ${visibleCount} precincts`;

    if (mapState.activeLayer !== 'none' && mapState.activeMetric) {
      acknowledgment += ` with ${mapState.activeMetric.replace(/_/g, ' ')} ${mapState.activeLayer}`;
    }

    return {
      acknowledgment,
      suggestions: this.prioritizeSuggestions(suggestions, state),
    };
  }

  /**
   * Generate contextual message when analysis completes
   */
  generateAnalysisCompleteMessage(result: {
    precincts: PrecinctData[];
    aggregatedMetrics: Record<string, number>;
    areaName: string;
  }): AIMessage {
    const state = getStateManager().getState();
    const suggestions = this.generateAnalysisSuggestions(result, state);

    const acknowledgment = `Analysis complete for **${result.areaName}** (${result.precincts.length} precincts)`;

    // Build insight from metrics
    const insight = this.formatMetricsInsight(result.aggregatedMetrics);

    return {
      acknowledgment,
      insight,
      suggestions: this.prioritizeSuggestions(suggestions, state),
    };
  }

  /**
   * Generate welcome/session message
   */
  generateSessionMessage(): AIMessage {
    const stateManager = getStateManager();
    const state = stateManager.getState();
    const suggestions: SuggestedAction[] = [];

    let acknowledgment = "Ready to analyze political data.";
    let insight: string | undefined;

    // Check for returning user - use getResumeOptions for enhanced restoration (S7-003)
    if (state.temporal.returningUser && state.temporal.previousSessionContext) {
      const prev = state.temporal.previousSessionContext;
      const precinctsExplored = prev.lastViewedPrecincts.length;

      acknowledgment = "Good to see you again.";
      insight = `Last session you explored ${precinctsExplored} precinct${precinctsExplored !== 1 ? 's' : ''}`;

      if (prev.lastWorkflow) {
        insight += ` and were working on ${prev.lastWorkflow}`;
      }

      // S7-003: Use getResumeOptions which includes map commands for direct restoration
      const resumeOptions = stateManager.getResumeOptions();
      resumeOptions.forEach(option => {
        suggestions.push({
          id: option.id,
          label: option.label,
          description: option.description,
          action: option.action,
          priority: option.priority,
          category: 'session',
          metadata: {
            resumeContext: option.context,
            mapCommands: option.context.mapCommands,
          },
          triggerReason: option.description,
        });
      });
    } else {
      // New user - offer quick start options
      suggestions.push({
        id: 'explore-swing',
        label: 'Find swing precincts',
        description: 'Identify competitive areas',
        action: 'workflow_swing_detection',
        priority: 85,
        category: 'exploration',
      });

      suggestions.push({
        id: 'explore-gotv',
        label: 'GOTV targets',
        description: 'High-priority turnout areas',
        action: 'workflow_gotv_targeting',
        priority: 80,
        category: 'exploration',
      });

      suggestions.push({
        id: 'explore-donors',
        label: 'Analyze donors',
        description: 'FEC contribution data',
        action: 'navigate_donors',
        priority: 75,
        category: 'donors',
      });

      suggestions.push({
        id: 'explore-trends',
        label: 'View trends',
        description: 'Historical election & demographic shifts',
        action: 'Show me election and demographic trends',
        priority: 72,
        category: 'analysis',
      });

      suggestions.push({
        id: 'explore-map',
        label: 'Explore the map',
        description: 'Click precincts for details',
        action: 'dismiss',
        priority: 70,
        category: 'exploration',
      });
    }

    return {
      acknowledgment,
      insight,
      suggestions: this.prioritizeSuggestions(suggestions, state),
    };
  }

  // ============================================================================
  // Narrative Thread Synthesis (Wave 5A: Issue #18)
  // ============================================================================

  /**
   * Synthesize a narrative about exploration patterns when user has explored 5+ entities
   * Implements Principle 2: Continuous Narrative Thread
   * Returns null if not enough exploration history
   */
  synthesizeExplorationNarrative(): string | null {
    const state = getStateManager().getState();
    const history = state.explorationHistory;

    // Need at least 5 exploration entries
    if (history.length < 5) {
      return null;
    }

    // Extract patterns from recent exploration
    const recentHistory = history.slice(-10); // Last 10 explorations
    const precinctIds = recentHistory
      .filter(h => h.precinctIds && h.precinctIds.length > 0)
      .flatMap(h => h.precinctIds || []);

    if (precinctIds.length < 5) {
      return null;
    }

    // Analyze common characteristics across explored precincts
    const insights: string[] = [];

    // Pattern 1: Geographic clustering
    const jurisdictions = recentHistory
      .map(h => h.metadata?.jurisdiction as string)
      .filter(Boolean);
    const uniqueJurisdictions = [...new Set(jurisdictions)];

    if (uniqueJurisdictions.length === 1 && jurisdictions.length >= 3) {
      insights.push(`You've been focusing on **${uniqueJurisdictions[0]}** precincts`);
    } else if (uniqueJurisdictions.length >= 2 && uniqueJurisdictions.length <= 3) {
      insights.push(`You're exploring **${uniqueJurisdictions.join(', ')}** - comparing different areas`);
    }

    // Pattern 2: Metric focus
    const metricsViewed = recentHistory
      .filter(h => h.metadata?.metric)
      .map(h => h.metadata?.metric as string);
    const metricCounts = new Map<string, number>();
    metricsViewed.forEach(m => metricCounts.set(m, (metricCounts.get(m) || 0) + 1));

    const dominantMetric = Array.from(metricCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (dominantMetric && dominantMetric[1] >= 3) {
      const metricName = dominantMetric[0].replace(/_/g, ' ');
      insights.push(`repeatedly checking **${metricName}**`);
    }

    // Pattern 3: Tool focus
    const toolsUsed = recentHistory.map(h => h.tool);
    const uniqueTools = [...new Set(toolsUsed)];

    if (uniqueTools.length === 1 && uniqueTools[0] !== 'political-ai') {
      const toolName = this.getToolDisplayName(uniqueTools[0]);
      insights.push(`deep-diving in **${toolName}**`);
    } else if (uniqueTools.length >= 3) {
      insights.push(`using multiple tools for comprehensive analysis`);
    }

    // Pattern 4: Common Tapestry segments (if available)
    const tapestrySegments = recentHistory
      .map(h => h.metadata?.tapestrySegment as string)
      .filter(Boolean);
    const segmentCounts = new Map<string, number>();
    tapestrySegments.forEach(s => segmentCounts.set(s, (segmentCounts.get(s) || 0) + 1));

    const dominantSegment = Array.from(segmentCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (dominantSegment && dominantSegment[1] >= 3) {
      insights.push(`All share **'${dominantSegment[0]}'** Tapestry segment`);
    }

    // Pattern 5: Value type (GOTV vs Swing)
    const highGotvCount = recentHistory.filter(h => {
      const gotv = h.metadata?.gotvPriority as number | undefined;
      return gotv !== undefined && gotv > 70;
    }).length;

    const highSwingCount = recentHistory.filter(h => {
      const swing = h.metadata?.swingPotential as number | undefined;
      return swing !== undefined && swing > 70;
    }).length;

    if (highGotvCount >= 3 && highSwingCount < 2) {
      insights.push(`focusing on **base mobilization** (high GOTV targets)`);
    } else if (highSwingCount >= 3 && highGotvCount < 2) {
      insights.push(`hunting for **swing opportunities** (persuasion targets)`);
    } else if (highGotvCount >= 2 && highSwingCount >= 2) {
      insights.push(`looking at **dual-purpose targets** (both GOTV and persuasion)`);
    }

    if (insights.length === 0) {
      return null;
    }

    // Build narrative
    const narrative = `**Pattern Detected**: You've explored ${precinctIds.length} precincts — ${insights.join(', ')}. ` +
      `Consider ${this.suggestNextAction(insights)}`;

    return narrative;
  }

  /**
   * Helper: Get display name for tool
   */
  private getToolDisplayName(tool: string): string {
    const names: Record<string, string> = {
      'segments': 'Segment Builder',
      'donors': 'Donor Analysis',
      'canvass': 'Canvassing Planner',
      'compare': 'Comparison Tool',
      'political-ai': 'Main Map',
    };
    return names[tool] || tool;
  }

  /**
   * Helper: Suggest next action based on detected patterns
   */
  private suggestNextAction(patterns: string[]): string {
    const patternText = patterns.join(' ');

    if (patternText.includes('GOTV') || patternText.includes('mobilization')) {
      return 'creating a canvassing plan for these high-priority areas';
    }
    if (patternText.includes('swing') || patternText.includes('persuasion')) {
      return 'comparing these swing precincts to identify common persuasion angles';
    }
    if (patternText.includes('Tapestry')) {
      return 'exploring messaging strategies for this demographic segment';
    }
    if (patternText.includes('comparing different areas')) {
      return 'using the Comparison Tool for side-by-side analysis';
    }
    if (patternText.includes('deep-diving')) {
      return 'saving these results as a reusable segment';
    }

    return 'saving this work as a segment or generating a report';
  }

  // ============================================================================
  // Proactive Triggers
  // ============================================================================

  /**
   * Check for proactive message triggers
   * Respects user preferences for dismissed triggers and disabled categories
   */
  checkProactiveTriggers(): { trigger: ProactiveTrigger; message: string; suggestions: SuggestedAction[] } | null {
    const state = getStateManager().getState();
    const now = Date.now();

    // P2-41: Reset cooldown when tool changes
    if (this.lastToolForCooldown !== null && this.lastToolForCooldown !== state.currentTool) {
      // Tool changed - reset cooldowns to show fresh suggestions
      this.lastProactiveTrigger.clear();
      this.lastToolForCooldown = state.currentTool;
    } else if (this.lastToolForCooldown === null) {
      this.lastToolForCooldown = state.currentTool;
    }

    for (const trigger of this.getProactiveTriggers()) {
      // Check if trigger is dismissed
      if (this.isTriggerDismissed(trigger.id)) {
        continue;
      }

      // Check if category is disabled
      if (trigger.category && this.isCategoryDisabled(trigger.category)) {
        continue;
      }

      // Check cooldown (with user preference multiplier)
      const cooldown = trigger.cooldownMs * this.proactivePreferences.cooldownMultiplier;
      const lastTriggered = this.lastProactiveTrigger.get(trigger.id) || 0;
      if (now - lastTriggered < cooldown) {
        continue;
      }

      // Check condition
      if (trigger.condition(state)) {
        this.lastProactiveTrigger.set(trigger.id, now);
        return {
          trigger,
          message: trigger.message(state),
          suggestions: trigger.suggestions(state),
        };
      }
    }

    return null;
  }

  // ============================================================================
  // Proactive Preference Management (Phase 10)
  // ============================================================================

  /**
   * Dismiss a specific trigger permanently (won't show again)
   */
  dismissTrigger(triggerId: string): void {
    if (!this.proactivePreferences.dismissedTriggers.includes(triggerId)) {
      this.proactivePreferences.dismissedTriggers.push(triggerId);
      this.savePreferences();
    }
  }

  /**
   * Re-enable a previously dismissed trigger
   */
  undismissTrigger(triggerId: string): void {
    const index = this.proactivePreferences.dismissedTriggers.indexOf(triggerId);
    if (index !== -1) {
      this.proactivePreferences.dismissedTriggers.splice(index, 1);
      this.savePreferences();
    }
  }

  /**
   * Disable an entire category of proactive messages
   */
  disableCategory(category: ProactiveTriggerCategory): void {
    if (!this.proactivePreferences.disabledCategories.includes(category)) {
      this.proactivePreferences.disabledCategories.push(category);
      this.savePreferences();
    }
  }

  /**
   * Re-enable a previously disabled category
   */
  enableCategory(category: ProactiveTriggerCategory): void {
    const index = this.proactivePreferences.disabledCategories.indexOf(category);
    if (index !== -1) {
      this.proactivePreferences.disabledCategories.splice(index, 1);
      this.savePreferences();
    }
  }

  /**
   * Set cooldown multiplier (1.0 = default, 2.0 = slower, 0.5 = faster)
   */
  setCooldownMultiplier(multiplier: number): void {
    this.proactivePreferences.cooldownMultiplier = Math.max(0.5, Math.min(5.0, multiplier));
    this.savePreferences();
  }

  /**
   * Check if a specific trigger is dismissed
   */
  isTriggerDismissed(triggerId: string): boolean {
    return this.proactivePreferences.dismissedTriggers.includes(triggerId);
  }

  /**
   * Check if a category is disabled
   */
  isCategoryDisabled(category: ProactiveTriggerCategory): boolean {
    return this.proactivePreferences.disabledCategories.includes(category);
  }

  /**
   * Get current preferences (for UI display)
   */
  getProactivePreferences(): ProactivePreferences {
    return { ...this.proactivePreferences };
  }

  /**
   * Reset all preferences to default
   */
  resetPreferences(): void {
    this.proactivePreferences = this.getDefaultPreferences();
    this.savePreferences();
  }

  /**
   * Get available preference categories with descriptions
   */
  getPreferenceCategories(): Array<{
    category: ProactiveTriggerCategory;
    label: string;
    description: string;
    enabled: boolean;
  }> {
    return [
      {
        category: 'idle-help',
        label: 'Idle Help',
        description: 'Suggestions when you pause for a while',
        enabled: !this.isCategoryDisabled('idle-help'),
      },
      {
        category: 'exploration-tips',
        label: 'Exploration Tips',
        description: 'Tips based on your browsing patterns',
        enabled: !this.isCategoryDisabled('exploration-tips'),
      },
      {
        category: 'workflow-suggestions',
        label: 'Workflow Suggestions',
        description: 'Suggestions to continue or start workflows',
        enabled: !this.isCategoryDisabled('workflow-suggestions'),
      },
      {
        category: 'output-prompts',
        label: 'Output Prompts',
        description: 'Prompts to save, export, or generate reports',
        enabled: !this.isCategoryDisabled('output-prompts'),
      },
    ];
  }

  private getDefaultPreferences(): ProactivePreferences {
    return {
      dismissedTriggers: [],
      disabledCategories: [],
      cooldownMultiplier: 1.0,
      lastUpdated: new Date(),
    };
  }

  private loadPreferences(): ProactivePreferences {
    if (typeof window === 'undefined') {
      return this.getDefaultPreferences();
    }

    try {
      const stored = localStorage.getItem(this.PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ProactivePreferences;
        return {
          ...parsed,
          lastUpdated: new Date(parsed.lastUpdated),
        };
      }
    } catch (error) {
      console.error('[SuggestionEngine] Failed to load preferences:', error);
    }

    return this.getDefaultPreferences();
  }

  private savePreferences(): void {
    if (typeof window === 'undefined') return;

    try {
      this.proactivePreferences.lastUpdated = new Date();
      localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(this.proactivePreferences));
    } catch (error) {
      console.error('[SuggestionEngine] Failed to save preferences:', error);
    }
  }

  private getProactiveTriggers(): ProactiveTrigger[] {
    return [
      // Idle trigger #1 - 30 seconds - offer quick help
      {
        id: 'idle-help-30s',
        category: 'idle-help',
        condition: (state) => state.temporal.idleTime >= 30 && state.temporal.idleTime < 120,
        message: (state) => {
          if (state.selection.type !== 'none' && state.selection.selectedEntity) {
            return `I notice you're looking at ${(state.selection.selectedEntity as PrecinctData).name}. Need help with analysis?`;
          }
          return "Need help? Here are some things you can try:";
        },
        suggestions: (state) => {
          const suggestions: SuggestedAction[] = [];

          if (state.selection.type === 'precinct') {
            suggestions.push({
              id: 'idle-analyze',
              label: 'Analyze this precinct',
              action: 'analyze_selected',
              priority: 80,
              category: 'analysis',
            });
          } else {
            // No selection - offer exploration suggestions
            suggestions.push({
              id: 'swing-precincts',
              label: 'Find swing precincts',
              action: 'Show me the most competitive precincts',
              priority: 85,
              category: 'exploration',
            });
            suggestions.push({
              id: 'gotv-priorities',
              label: 'GOTV priorities',
              action: 'Which precincts have highest GOTV priority?',
              priority: 80,
              category: 'analysis',
            });
            suggestions.push({
              id: 'donor-analysis',
              label: 'Donor analysis',
              action: 'Where are donors concentrated?',
              priority: 75,
              category: 'analysis',
            });
          }

          // Add "Don't show again" option
          suggestions.push({
            id: 'dismiss-idle-help',
            label: "Don't show this again",
            action: 'dismiss_trigger:idle-help-30s',
            priority: 10,
            category: 'session',
          });

          return suggestions;
        },
        cooldownMs: 180000, // 3 minutes - only show once per idle session
        priority: 50,
      },

      // Idle trigger #2 - 2 minutes - more comprehensive help
      {
        id: 'idle-help-2min',
        category: 'idle-help',
        condition: (state) => state.temporal.idleTime >= 120,
        message: () => {
          return "I'm here to help you analyze electoral data. Would you like me to suggest some starting points based on your current view?";
        },
        suggestions: (state) => {
          const suggestions: SuggestedAction[] = [];

          // Context-aware suggestions based on what's on screen
          const pa = getPoliticalRegionEnv().stateFips === '42';
          suggestions.push({
            id: 'county-overview',
            label: pa ? 'State overview' : 'County overview',
            action: pa
              ? `Give me an overview of ${getPoliticalRegionEnv().summaryAreaName} politics`
              : 'Give me an overview of Ingham County politics',
            priority: 85,
            category: 'analysis',
          });
          suggestions.push({
            id: 'compare-areas',
            label: 'Compare areas',
            action: pa ? 'Compare Philadelphia to Pittsburgh' : 'Compare East Lansing to Lansing',
            priority: 80,
            category: 'comparison',
          });
          suggestions.push({
            id: 'show-examples',
            label: 'Show example questions',
            action: 'What are some example questions I can ask?',
            priority: 75,
            category: 'exploration',
          });

          // Add "Don't show again" option
          suggestions.push({
            id: 'dismiss-idle-help-2min',
            label: "Don't show this again",
            action: 'dismiss_trigger:idle-help-2min',
            priority: 10,
            category: 'session',
          });

          return suggestions;
        },
        cooldownMs: 300000, // 5 minutes - don't spam if user is intentionally idle
        priority: 45,
      },

      // Multiple selections trigger - offer segment creation
      // {
      //   id: 'multiple-selections',
      //   category: 'exploration-tips',
      //   condition: (state) => state.selection.selectionHistory.length >= 3,
      //   message: (state) => {
      //     const count = state.selection.selectionHistory.length;
      //     return `You've explored ${count} precincts. Want to create a segment from these?`;
      //   },
      //   suggestions: () => [
      //     {
      //       id: 'create-segment-from-history',
      //       label: 'Create segment from explored precincts',
      //       action: 'segment_from_history',
      //       priority: 85,
      //       category: 'segmentation',
      //     },
      //     {
      //       id: 'compare-explored',
      //       label: 'Compare explored precincts',
      //       action: 'compare_history',
      //       priority: 80,
      //       category: 'comparison',
      //     },
      //     {
      //       id: 'dismiss-multiple-selections',
      //       label: "Don't suggest this",
      //       action: 'dismiss_trigger:multiple-selections',
      //       priority: 10,
      //       category: 'session',
      //     },
      //   ],
      //   cooldownMs: 300000, // 5 minutes
      //   priority: 60,
      // },

      // Same area visited multiple times
      {
        id: 'repeated-area',
        category: 'exploration-tips',
        condition: (state) => {
          const history = state.selection.selectionHistory;
          if (history.length < 3) return false;

          // Check if same precinct selected more than once
          const counts = new Map<string, number>();
          history.forEach(h => counts.set(h.id, (counts.get(h.id) || 0) + 1));
          return Array.from(counts.values()).some(c => c >= 2);
        },
        message: (state) => {
          const history = state.selection.selectionHistory;
          const counts = new Map<string, number>();
          history.forEach(h => counts.set(h.id, (counts.get(h.id) || 0) + 1));

          const repeated = Array.from(counts.entries()).find(([, c]) => c >= 2);
          if (repeated) {
            const entry = history.find(h => h.id === repeated[0]);
            return `You keep coming back to ${entry?.name || 'this area'}. Want to dive deeper?`;
          }
          return "I notice you're focused on certain areas. Want a deeper analysis?";
        },
        suggestions: () => [
          {
            id: 'deep-dive',
            label: 'Deep dive analysis',
            action: 'analyze_detailed',
            priority: 85,
            category: 'analysis',
          },
          {
            id: 'find-similar',
            label: 'Find similar precincts',
            action: 'find_similar',
            priority: 80,
            category: 'exploration',
          },
          {
            id: 'dismiss-repeated-area',
            label: "Don't suggest this",
            action: 'dismiss_trigger:repeated-area',
            priority: 10,
            category: 'session',
          },
        ],
        cooldownMs: 180000, // 3 minutes
        priority: 70,
      },

      // Output prompt - deep exploration
      {
        id: 'deep-exploration-output',
        category: 'output-prompts',
        condition: (state) => {
          const stateManager = getStateManager();
          const depth = stateManager.getExplorationDepth();
          return depth >= 50 && state.behavior.exploredPrecincts.size >= 5;
        },
        message: () => {
          return "You've done substantial exploration. Ready to save your findings?";
        },
        suggestions: () => [
          {
            id: 'save-exploration',
            label: 'Save as segment',
            action: 'output:saveSegment',
            priority: 85,
            category: 'segmentation',
          },
          {
            id: 'generate-report',
            label: 'Generate report',
            action: 'output:generateReport',
            priority: 80,
            category: 'reporting',
          },
          {
            id: 'dismiss-output-prompt',
            label: "Don't suggest outputs",
            action: 'dismiss_category:output-prompts',
            priority: 10,
            category: 'session',
          },
        ],
        cooldownMs: 600000, // 10 minutes
        priority: 55,
      },
    ];
  }

  // ============================================================================
  // Suggestion Generators
  // ============================================================================

  private generatePrecinctSuggestions(precinct: PrecinctData, state: ApplicationState): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];
    const metrics = this.extractPrecinctMetrics(precinct);

    // Always offer comparison
    suggestions.push({
      id: 'compare-neighbors',
      label: 'Compare to neighbors',
      description: 'See how this precinct compares to adjacent areas',
      action: 'compare_neighbors',
      priority: 70,
      category: 'comparison',
      metadata: { precinctId: precinct.id },
    });

    // Find similar precincts
    suggestions.push({
      id: 'find-similar',
      label: 'Find similar precincts',
      description: 'Discover precincts with similar characteristics',
      action: 'find_similar',
      priority: 65,
      category: 'exploration',
      metadata: { precinctId: precinct.id },
    });

    // Context-specific suggestions based on precinct characteristics
    if (metrics.swing_potential && metrics.swing_potential > 60) {
      suggestions.push({
        id: 'persuasion-analysis',
        label: 'Analyze persuasion opportunity',
        description: `Swing potential: ${metrics.swing_potential}`,
        action: 'analyze_persuasion',
        priority: 85,
        category: 'analysis',
        metadata: { precinctId: precinct.id },
        triggerReason: 'High swing potential precinct',
      });
    }

    if (metrics.gotv_priority && metrics.gotv_priority > 70) {
      suggestions.push({
        id: 'gotv-plan',
        label: 'Create GOTV plan',
        description: `GOTV priority: ${metrics.gotv_priority}`,
        action: 'create_gotv_plan',
        priority: 80,
        category: 'canvassing',
        metadata: { precinctId: precinct.id },
        triggerReason: 'High GOTV priority precinct',
      });
    }

    if (metrics.registered_voters && metrics.registered_voters > 2000) {
      suggestions.push({
        id: 'create-turfs',
        label: 'Divide into canvassing turfs',
        description: `${metrics.registered_voters.toLocaleString()} registered voters`,
        action: 'create_turfs',
        priority: 70,
        category: 'canvassing',
        metadata: { precinctId: precinct.id },
        triggerReason: 'Large voter population',
      });
    }

    // If user has shown interest in donors
    if (state.behavior.suggestionsAccepted.some(s => s.includes('donor')) ||
      getStateManager().hasInterestIn('donors')) {
      suggestions.push({
        id: 'check-donors',
        label: 'Check donor activity in this area',
        action: 'analyze_local_donors',
        priority: 60,
        category: 'donors',
        metadata: { precinctId: precinct.id },
        triggerReason: 'Based on your interest in donor data',
      });
    }

    // Always offer report generation
    suggestions.push({
      id: 'generate-report',
      label: 'Generate detailed report',
      description: '7-page political profile',
      action: 'generate_report',
      priority: 55,
      category: 'reporting',
      metadata: { precinctId: precinct.id },
    });

    return suggestions;
  }

  private generateMunicipalitySuggestions(municipality: MunicipalityData, state: ApplicationState): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];

    suggestions.push({
      id: 'view-precincts',
      label: 'View all precincts',
      description: `See precincts within ${municipality.name}`,
      action: 'filter_by_municipality',
      priority: 80,
      category: 'exploration',
      metadata: { municipalityId: municipality.id },
    });

    suggestions.push({
      id: 'municipality-report',
      label: 'Generate municipality report',
      action: 'generate_report',
      priority: 75,
      category: 'reporting',
      metadata: { municipalityId: municipality.id },
    });

    suggestions.push({
      id: 'compare-municipalities',
      label: 'Compare to other municipalities',
      action: 'compare_municipalities',
      priority: 70,
      category: 'comparison',
      metadata: { municipalityId: municipality.id },
    });

    suggestions.push({
      id: 'municipality-canvassing',
      label: 'Plan canvassing operation',
      description: 'Create turfs for entire municipality',
      action: 'plan_canvassing',
      priority: 65,
      category: 'canvassing',
      metadata: { municipalityId: municipality.id },
    });

    return suggestions;
  }

  private generateMapViewSuggestions(mapState: MapState, state: ApplicationState): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];

    // If showing heatmap, offer to identify top areas
    if (mapState.activeLayer === 'heatmap' && mapState.activeMetric) {
      suggestions.push({
        id: 'top-areas',
        label: `Show top 5 ${mapState.activeMetric.replace(/_/g, ' ')} areas`,
        action: 'show_top_areas',
        priority: 85,
        category: 'exploration',
        metadata: { metric: mapState.activeMetric, count: 5 },
      });
    }

    // Offer different visualization if currently using one
    if (mapState.activeLayer !== 'none') {
      const alternateLayer = mapState.activeLayer === 'heatmap' ? 'choropleth' : 'heatmap';
      suggestions.push({
        id: 'switch-visualization',
        label: `Switch to ${alternateLayer}`,
        action: alternateLayer === 'heatmap' ? 'map:showHeatmap' : 'map:showChoropleth',
        priority: 60,
        category: 'exploration',
        metadata: alternateLayer === 'heatmap' ? { metric: mapState.activeMetric || 'swing_potential' } : {},
      });
    }

    // If many precincts visible, offer filtering
    if (mapState.visiblePrecincts.length > 20) {
      suggestions.push({
        id: 'filter-view',
        label: 'Filter visible precincts',
        description: 'Narrow down by criteria',
        action: 'open_segment_builder',
        priority: 65,
        category: 'segmentation',
      });
    }

    // If zoomed in, offer area analysis
    if (mapState.zoom >= 12) {
      suggestions.push({
        id: 'analyze-view',
        label: 'Analyze visible area',
        action: 'analyze_visible',
        priority: 70,
        category: 'analysis',
      });
    }

    return suggestions;
  }

  private generateAnalysisSuggestions(result: {
    precincts: PrecinctData[];
    aggregatedMetrics: Record<string, number>;
    areaName: string;
  }, state: ApplicationState): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];
    const { precincts, aggregatedMetrics } = result;

    // Always offer report
    suggestions.push({
      id: 'analysis-report',
      label: 'Generate full report',
      description: '7-page PDF with detailed analysis',
      action: 'generate_report',
      priority: 85,
      category: 'reporting',
      metadata: { precincts: precincts.map(p => p.id) },
    });

    // If high swing potential, emphasize persuasion
    if (aggregatedMetrics.avg_swing_potential && aggregatedMetrics.avg_swing_potential > 60) {
      suggestions.push({
        id: 'persuasion-strategy',
        label: 'Develop persuasion strategy',
        description: `Average swing: ${aggregatedMetrics.avg_swing_potential.toFixed(0)}`,
        action: 'analyze_persuasion',
        priority: 80,
        category: 'analysis',
        triggerReason: 'High average swing potential',
      });
    }

    // If high GOTV priority, offer canvassing
    if (aggregatedMetrics.avg_gotv_priority && aggregatedMetrics.avg_gotv_priority > 70) {
      suggestions.push({
        id: 'plan-gotv-canvass',
        label: 'Plan GOTV canvassing',
        description: `${precincts.length} high-priority precincts`,
        action: 'plan_canvassing',
        priority: 80,
        category: 'canvassing',
        triggerReason: 'High GOTV priority area',
      });
    }

    // Save as segment
    if (precincts.length > 1) {
      suggestions.push({
        id: 'save-segment',
        label: 'Save as segment',
        description: 'Reuse this selection later',
        action: 'save_segment',
        priority: 70,
        category: 'segmentation',
        metadata: { precincts: precincts.map(p => p.id) },
      });
    }

    // Compare to another area
    suggestions.push({
      id: 'compare-area',
      label: 'Compare to another area',
      action: 'start_comparison',
      priority: 65,
      category: 'comparison',
    });

    // Export data
    suggestions.push({
      id: 'export-data',
      label: 'Export data',
      description: 'CSV, VAN format, or walk list',
      action: 'export_data',
      priority: 55,
      category: 'reporting',
      metadata: { precincts: precincts.map(p => p.id) },
    });

    return suggestions;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private classifyPrecinct(precinct: PrecinctData): string | null {
    const metrics = this.extractPrecinctMetrics(precinct);

    const classifications: string[] = [];

    if (metrics.swing_potential && metrics.swing_potential > 70) {
      classifications.push('a high-swing precinct');
    } else if (metrics.swing_potential && metrics.swing_potential < 30) {
      classifications.push('a safe precinct');
    }

    if (metrics.gotv_priority && metrics.gotv_priority > 80) {
      classifications.push('a top GOTV target');
    }

    if (metrics.partisan_lean !== undefined) {
      if (metrics.partisan_lean > 15) {
        classifications.push('leaning Republican');
      } else if (metrics.partisan_lean < -15) {
        classifications.push('leaning Democratic');
      } else if (Math.abs(metrics.partisan_lean) <= 5) {
        classifications.push('highly competitive');
      }
    }

    return classifications.length > 0 ? classifications.join(', ') : null;
  }

  private generatePrecinctInsight(precinct: PrecinctData, state: ApplicationState): string | undefined {
    const metrics = this.extractPrecinctMetrics(precinct);
    const insights: string[] = [];

    // 1. Vote math calculations - "Only X votes from flipping"
    if (metrics.partisan_lean !== undefined && metrics.registered_voters !== undefined && metrics.turnout_rate !== undefined) {
      const votesNeeded = this.calculateVotesNeeded(metrics.partisan_lean, metrics.registered_voters, metrics.turnout_rate);
      if (votesNeeded !== null && votesNeeded < 500) {
        insights.push(`**Only ${Math.round(votesNeeded)} votes from flipping** - margin is razor-thin with current turnout.`);
      }
    }

    // 2. Strategic targeting assessment with vote math
    if (metrics.swing_potential !== undefined && metrics.gotv_priority !== undefined) {
      if (metrics.swing_potential > 70 && metrics.gotv_priority > 70) {
        // Double-target with ROI context
        const additionalVotes = this.calculateTurnoutBoost(metrics.registered_voters || 0, metrics.turnout_rate || 0.5);
        insights.push(`This is a rare **double-target** precinct - high on both swing potential (${metrics.swing_potential}) and GOTV priority (${metrics.gotv_priority}). Boosting turnout 8 points could yield ~${Math.round(additionalVotes)} additional votes. Worth extra resources.`);
      } else if (metrics.swing_potential > 70) {
        insights.push(`**High swing potential (${metrics.swing_potential}/100)** - This precinct is highly competitive. With ${metrics.registered_voters?.toLocaleString() || 'unknown'} voters, targeted persuasion could flip the outcome.`);
      } else if (metrics.gotv_priority > 70) {
        insights.push(`**Top GOTV target (${metrics.gotv_priority}/100)** - Base mobilization here could significantly impact turnout. Current turnout: ${((metrics.turnout_rate || 0) * 100).toFixed(0)}%.`);
      } else if (metrics.swing_potential < 30 && metrics.gotv_priority < 30) {
        // Low-value precinct - business decision
        insights.push(`**Low ROI precinct** - Safe with ${Math.abs(metrics.partisan_lean || 0).toFixed(0)}pt lean and low swing/GOTV scores. Better to focus resources elsewhere.`);
      }
    }

    // 3. Tapestry context with campaign messaging insights
    const tapestrySegment = (precinct as unknown as { tapestry?: { dominant_segment?: string } })?.tapestry?.dominant_segment;
    if (tapestrySegment) {
      const tapestryInsight = this.getTapestryInsight(tapestrySegment);
      insights.push(tapestryInsight);
    }

    // 4. Comparative context - percentile rankings
    const comparativeContext = this.getComparativeContext(metrics, state);
    if (comparativeContext) {
      insights.push(comparativeContext);
    }

    // 5. Campaign phase relevance
    const phaseRelevance = this.getCampaignPhaseRelevance(metrics);
    if (phaseRelevance) {
      insights.push(phaseRelevance);
    }

    // 6. Check if user has explored similar precincts
    const similarExplored = this.findSimilarExplored(precinct, state);
    if (similarExplored.length > 0) {
      const exampleName = similarExplored[0].name || similarExplored[0].id;
      insights.push(`Similar to ${similarExplored.length} other precincts you've explored (like ${exampleName}).`);
    }

    return insights.length > 0 ? insights.join('\n\n') : undefined;
  }

  /**
   * Calculate votes needed to flip a precinct
   * Returns null if not flippable or calculations not possible
   */
  private calculateVotesNeeded(partisanLean: number, registeredVoters: number, turnoutRate: number): number | null {
    // Only calculate for competitive precincts (within 10 points)
    if (Math.abs(partisanLean) > 10) return null;

    const expectedVotes = registeredVoters * turnoutRate;
    const currentMarginPct = Math.abs(partisanLean) / 100;
    const votesNeeded = (expectedVotes * currentMarginPct) / 2; // Need to flip half the margin + 1

    return votesNeeded > 0 ? votesNeeded : null;
  }

  /**
   * Calculate additional votes from turnout boost
   */
  private calculateTurnoutBoost(registeredVoters: number, currentTurnout: number, boostPoints: number = 0.08): number {
    const currentVotes = registeredVoters * currentTurnout;
    const boostedVotes = registeredVoters * (currentTurnout + boostPoints);
    return boostedVotes - currentVotes;
  }

  /**
   * Get Tapestry segment insight with campaign messaging context
   */
  private getTapestryInsight(segmentName: string): string {
    // Map common Tapestry segments to campaign insights
    const tapestryMapping: Record<string, string> = {
      'College Towns': '**College Towns** segment - responds to education policy, high mobility means door-knocking less effective. Focus on campus and digital outreach.',
      'Urban Chic': '**Urban Chic** segment - young professionals, progressive issues, tech-savvy. High digital engagement, lower door-knocking efficiency.',
      'Laptops and Lattes': '**Laptops and Lattes** segment - educated urbanites, policy depth matters. Strong online engagement, attend town halls.',
      'Soccer Moms': '**Soccer Moms** segment - family issues priority (education, safety). Best reached through school networks and youth sports.',
      'Rustbelt Traditions': '**Rustbelt Traditions** segment - blue-collar heritage, economic issues priority. Traditional media, union halls effective.',
      'Comfortable Empty Nesters': '**Comfortable Empty Nesters** segment - older suburbs, healthcare and retirement issues. High turnout propensity, traditional outreach works.',
      'Modest Income Homes': '**Modest Income Homes** segment - economic issues critical, kitchen-table concerns. Personal contact highly effective.',
    };

    // Return specific insight if we have it, otherwise generic
    return tapestryMapping[segmentName] || `Dominant Tapestry segment: **${segmentName}**`;
  }

  /**
   * Get comparative context - how does this precinct rank?
   */
  private getComparativeContext(metrics: Record<string, number | undefined>, state: ApplicationState): string | null {
    // This would ideally compare against all precincts in the dataset
    // For now, use thresholds to approximate percentile rankings
    const parts: string[] = [];

    if (metrics.swing_potential !== undefined) {
      if (metrics.swing_potential > 85) {
        parts.push('**Top 5% of county for swing potential**');
      } else if (metrics.swing_potential > 75) {
        parts.push('Top 15% for swing potential');
      }
    }

    if (metrics.gotv_priority !== undefined) {
      if (metrics.gotv_priority > 85) {
        parts.push('**Top 5% GOTV priority county-wide**');
      } else if (metrics.gotv_priority > 75) {
        parts.push('Top 15% GOTV priority');
      }
    }

    if (metrics.turnout_rate !== undefined) {
      const countyAvg = 0.65; // Approximate county average
      const diff = ((metrics.turnout_rate - countyAvg) * 100).toFixed(0);
      if (Math.abs(metrics.turnout_rate - countyAvg) > 0.1) {
        const direction = metrics.turnout_rate > countyAvg ? 'above' : 'below';
        parts.push(`Turnout ${Math.abs(Number(diff))}pts ${direction} county average`);
      }
    }

    return parts.length > 0 ? parts.join(' | ') : null;
  }

  /**
   * Get campaign phase relevance
   * Early: demographics, mid: persuasion, late: GOTV
   */
  private getCampaignPhaseRelevance(metrics: Record<string, number | undefined>): string | null {
    // Infer phase from current date (simplified - would be better to have campaign config)
    const now = new Date();
    const month = now.getMonth(); // 0-11

    // Assuming November general election
    // Sep-Oct: GOTV phase
    // Jul-Aug: Persuasion phase
    // Before Jul: Early phase

    let phase: 'early' | 'persuasion' | 'gotv';
    if (month >= 8) {
      phase = 'gotv'; // Sep onwards
    } else if (month >= 6) {
      phase = 'persuasion'; // Jul-Aug
    } else {
      phase = 'early';
    }

    switch (phase) {
      case 'early':
        // Focus on demographics and audience
        if (metrics.registered_voters !== undefined && metrics.registered_voters > 2000) {
          return `**Early campaign phase**: Large precinct (${metrics.registered_voters.toLocaleString()} voters) - good for building volunteer base and testing messages.`;
        }
        return null;

      case 'persuasion':
        // Focus on swing potential
        if (metrics.swing_potential !== undefined && metrics.swing_potential > 60) {
          const persuadableCount = Math.round((metrics.registered_voters || 1000) * 0.15 * (metrics.swing_potential / 100));
          return `**Persuasion phase**: High swing potential means ~${persuadableCount.toLocaleString()} persuadable voters here. Time for direct mail, phone banks, door-knocking.`;
        }
        return null;

      case 'gotv':
        // Focus on turnout
        if (metrics.gotv_priority !== undefined && metrics.gotv_priority > 60) {
          const potentialVotes = this.calculateTurnoutBoost(metrics.registered_voters || 1000, metrics.turnout_rate || 0.5);
          return `**GOTV phase**: High priority for turnout - could add ${Math.round(potentialVotes)} votes with 8pt turnout boost. Focus all resources here.`;
        }
        return null;

      default:
        return null;
    }
  }

  private extractPrecinctMetrics(precinct: PrecinctData): Record<string, number | undefined> {
    // Extract metrics from the structured PrecinctData type
    // Also handle raw data objects that may come from API with flat properties
    const rawPrecinct = precinct as unknown as Record<string, unknown>;

    return {
      swing_potential: precinct.electoral?.swing_potential ?? rawPrecinct.swing_potential as number | undefined,
      gotv_priority: precinct.targeting?.gotv_priority ?? rawPrecinct.gotv_priority as number | undefined,
      persuasion_opportunity: precinct.targeting?.persuasion_opportunity ?? rawPrecinct.persuasion_opportunity as number | undefined,
      partisan_lean: (() => {
        const e = precinct.electoral as { partisanLean?: number; partisan_lean?: number } | undefined;
        const v = e?.partisanLean ?? e?.partisan_lean ?? (rawPrecinct.partisan_lean as number | undefined);
        if (v == null || Number.isNaN(Number(v))) return undefined;
        // PA stores Segment-style lean in unified data; insights use display convention (positive = Dem).
        if (getPoliticalRegionEnv().stateFips === '42') return -Number(v);
        return Number(v);
      })(),
      registered_voters: precinct.demographics?.total_population ?? rawPrecinct.registered_voters as number | undefined,
      // turnout may come as turnout_rate (0-1) or turnout (0-100 percentage from political_scores)
      // Normalize to 0-1 rate format if it's a percentage (>1)
      turnout_rate: (() => {
        const rate = precinct.turnout?.average ?? rawPrecinct.turnout_rate as number | undefined ?? (rawPrecinct.turnout as number | undefined);
        if (rate === undefined || rate === null) return undefined;
        // If value is > 1, it's already a percentage (0-100), convert to rate (0-1)
        return rate > 1 ? rate / 100 : rate;
      })(),
    };
  }

  private formatMetricsInsight(metrics: Record<string, number>): string {
    const parts: string[] = [];

    if (metrics.avg_swing_potential !== undefined) {
      parts.push(`Avg swing potential: **${metrics.avg_swing_potential.toFixed(0)}**/100`);
    }
    if (metrics.avg_gotv_priority !== undefined) {
      parts.push(`Avg GOTV priority: **${metrics.avg_gotv_priority.toFixed(0)}**/100`);
    }
    if (metrics.total_registered_voters !== undefined) {
      parts.push(`Total registered voters: **${metrics.total_registered_voters.toLocaleString()}**`);
    }
    if (metrics.avg_turnout !== undefined) {
      parts.push(`Avg turnout: **${(metrics.avg_turnout * 100).toFixed(1)}%**`);
    }

    return parts.join(' | ');
  }

  private findSimilarExplored(precinct: PrecinctData, state: ApplicationState): SelectionHistoryEntry[] {
    const metrics = this.extractPrecinctMetrics(precinct);
    const history = state.selection.selectionHistory;

    return history.filter(h => {
      if (h.id === precinct.id) return false;
      if (!h.metrics) return false;

      // Check similarity (within 15 points on key metrics)
      const swingDiff = Math.abs((h.metrics.swing_potential || 0) - (metrics.swing_potential || 0));
      const gotvDiff = Math.abs((h.metrics.gotv_priority || 0) - (metrics.gotv_priority || 0));

      return swingDiff < 15 && gotvDiff < 15;
    });
  }

  private prioritizeSuggestions(suggestions: SuggestedAction[], state: ApplicationState): SuggestedAction[] {
    const now = Date.now();
    const stateManager = getStateManager();
    const activeLayer = stateManager.getActiveMapLayer();

    // Filter out suggestions for visualizations already active
    const filtered = suggestions.filter(s => {
      // If suggestion is to show a map layer, check if it's already active
      if (s.action?.startsWith('map:show')) {
        const actionParts = s.action.split(':');
        if (actionParts.length >= 2) {
          const layerType = actionParts[1]; // e.g., 'showHeatmap' -> 'heatmap'
          const suggestedMetric = s.metadata?.metric as string | undefined;

          // Extract layer type from action (e.g., 'showHeatmap' -> 'heatmap')
          const extractedLayerType = layerType.replace('show', '').toLowerCase();

          // Check if already showing this visualization
          if (stateManager.isVisualizationActive(extractedLayerType, suggestedMetric)) {
            return false; // Filter out - already showing this
          }
        }
      }
      return true;
    });

    // P1-15: Infer expertise level from behavior metrics
    // Power user: many actions & accepted suggestions; Novice: few interactions
    const actionCount = state.behavior.actionsThisSession.length;
    const acceptedCount = state.behavior.suggestionsAccepted.length;
    const exploredCount = state.behavior.exploredPrecincts.size;
    const expertiseLevel = (actionCount > 20 || acceptedCount > 5 || exploredCount > 10) ? 'power' :
      (actionCount > 5 || exploredCount > 3) ? 'intermediate' : 'novice';

    // Adjust priorities based on user behavior
    const adjusted = filtered.map(s => {
      let priority = s.priority;

      // P1-15: Adjust based on expertise level
      if (expertiseLevel === 'power') {
        // Power users prefer action-focused suggestions
        if (s.category === 'workflow' || s.category === 'canvassing' || s.category === 'reporting') {
          priority += 10;
        }
        // Less interested in exploration tips
        if (s.category === 'exploration' && s.description) {
          priority -= 5;
        }
      } else if (expertiseLevel === 'novice') {
        // Novices prefer exploration and analysis help
        if (s.category === 'exploration' || s.category === 'analysis') {
          priority += 10;
        }
        // Show more descriptive suggestions
        if (s.description) {
          priority += 5;
        }
      }
      // 'intermediate' gets default priorities

      // Boost if user has shown interest in this category
      if (this.userInterestedInCategory(s.category, state)) {
        priority += 10;
      }

      // Reduce if recently suggested and ignored
      const lastShown = this.lastSuggestions.get(s.id);
      if (lastShown && now - lastShown < this.suggestionCooldownMs) {
        if (state.behavior.suggestionsIgnored.includes(s.id)) {
          priority -= 20;
        }
      }

      // Boost if previously accepted similar suggestions
      if (state.behavior.suggestionsAccepted.some(acc => acc.startsWith(s.category))) {
        priority += 5;
      }

      return { ...s, priority: Math.max(0, Math.min(100, priority)) };
    });

    // P1-15: Adjust number of suggestions based on expertise
    const maxSuggestions = expertiseLevel === 'power' ? 3 : expertiseLevel === 'novice' ? 5 : 4;

    // Sort by priority and take top suggestions
    return adjusted
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxSuggestions)
      .map(s => {
        this.lastSuggestions.set(s.id, now);
        return s;
      });
  }

  private userInterestedInCategory(category: SuggestionCategory, state: ApplicationState): boolean {
    const categoryInterests: Record<SuggestionCategory, string[]> = {
      exploration: ['swing', 'gotv'],
      analysis: ['swing', 'gotv', 'persuasion'],
      comparison: [],
      segmentation: [],
      canvassing: ['canvassing'],
      donors: ['donors'],
      reporting: [],
      workflow: [],
      session: [],
    };

    const interests = categoryInterests[category] || [];
    return interests.some(interest => getStateManager().hasInterestIn(interest));
  }

  // ============================================================================
  // Output Suggestion Generation (Phase 8)
  // ============================================================================

  /**
   * Generate output-driven suggestions based on exploration depth
   * Returns empty array if not enough exploration has occurred
   */
  generateOutputSuggestions(state: ApplicationState): SuggestedAction[] {
    const stateManager = getStateManager();
    const metrics = stateManager.getExplorationMetrics();
    const depth = stateManager.getExplorationDepth();
    const suggestions: SuggestedAction[] = [];

    // Threshold 1: 5+ precincts explored → Suggest saving as segment
    if (metrics.precinctsViewed >= 5 && state.currentTool === 'segments') {
      suggestions.push({
        id: 'output-save-segment',
        label: 'Save this segment',
        description: `${metrics.precinctsViewed} precincts match your criteria`,
        action: 'output:saveSegment',
        priority: 85,
        category: 'segmentation',
        triggerReason: `You've explored ${metrics.precinctsViewed} precincts - save them as a reusable segment`,
        metadata: {
          precinctCount: metrics.precinctsViewed,
          filters: state.segmentation.activeFilters,
        },
      });
    }

    // Threshold 2: Filters applied + results < 20 → Suggest export
    if (metrics.filtersApplied > 0 && state.segmentation.matchCount > 0 && state.segmentation.matchCount < 20) {
      suggestions.push({
        id: 'output-export-csv',
        label: 'Export to CSV',
        description: `${state.segmentation.matchCount} precincts ready for export`,
        action: 'output:exportCSV',
        priority: 80,
        category: 'reporting',
        triggerReason: 'Your filtered results are a manageable size for export',
        metadata: {
          matchCount: state.segmentation.matchCount,
          precinctIds: state.segmentation.matchingPrecincts,
        },
      });
    }

    // Threshold 3: High-value area found → Suggest canvassing plan
    if (metrics.highValueFound && metrics.precinctsViewed >= 3) {
      suggestions.push({
        id: 'output-plan-canvass',
        label: 'Plan canvassing operation',
        description: 'High-priority targets identified',
        action: 'output:planCanvass',
        priority: 90,
        category: 'canvassing',
        triggerReason: "You've found high-value swing or GOTV precincts - create a field plan",
        metadata: {
          precinctCount: metrics.precinctsViewed,
          targetType: 'high-value',
        },
      });
    }

    // Threshold 4: Deep exploration (depth >= 50) → Suggest comprehensive report
    if (depth >= 50 && metrics.precinctsViewed >= 3) {
      suggestions.push({
        id: 'output-generate-report',
        label: 'Generate comprehensive report',
        description: `${depth}/100 exploration depth`,
        action: 'output:generateReport',
        priority: 75,
        category: 'reporting',
        triggerReason: `You've done substantial exploration (${depth}/100 depth) - generate a full analysis report`,
        metadata: {
          depth,
          precinctsViewed: metrics.precinctsViewed,
          toolsUsed: metrics.toolsVisited,
        },
      });
    }

    // Threshold 5: Comparisons made → Suggest saving comparison results
    if (metrics.comparisonsMade >= 2 && state.comparison.similarityResults.length > 0) {
      suggestions.push({
        id: 'output-save-comparison',
        label: 'Export comparison results',
        description: `${metrics.comparisonsMade} comparisons made`,
        action: 'output:exportCSV',
        priority: 70,
        category: 'reporting',
        triggerReason: 'Multiple comparisons completed - export the findings',
        metadata: {
          comparisonCount: metrics.comparisonsMade,
          results: state.comparison.similarityResults,
        },
      });
    }

    // Threshold 6: Multiple tools used + session > 5 min → Suggest summary report
    if (metrics.toolsVisited.length >= 3 && metrics.sessionDuration >= 5) {
      suggestions.push({
        id: 'output-session-summary',
        label: 'Create session summary',
        description: `${metrics.toolsVisited.length} tools used, ${metrics.sessionDuration} min session`,
        action: 'output:generateReport',
        priority: 65,
        category: 'reporting',
        triggerReason: 'Cross-tool analysis detected - generate a summary of your findings',
        metadata: {
          toolsUsed: metrics.toolsVisited,
          sessionDuration: metrics.sessionDuration,
          summary: stateManager.getExplorationSummary(),
        },
      });
    }

    // Sort by priority and return top 3
    return suggestions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  }

  // ============================================================================
  // Spatial Reasoning Integration (Principle 16)
  // ============================================================================

  /**
   * Analyze spatial characteristics of selected precincts
   * Returns clustering, outliers, efficiency analysis, and suggestions
   */
  analyzeSpatialSelection(precincts: PrecinctData[]): SpatialAnalysis | null {
    if (precincts.length < 2) {
      return null;
    }

    // Convert to spatial input format
    const spatialInputs: SpatialPrecinctInput[] = precincts.map(p => {
      const jurisdiction = typeof p.jurisdiction === 'string'
        ? p.jurisdiction
        : (p.jurisdiction?.name || 'Unknown');

      // P2-42: Improved door estimates with confidence indicator
      let estimatedDoors: number;
      let estimateQuality: 'high' | 'medium' | 'low' = 'low';

      if (p.registered_voters && p.registered_voters > 0) {
        // Use registered voters with density-based multiplier
        const density = this.inferDensity(p);
        let multiplier = 0.4; // Base: 40% of voters = doors

        if (density === 'urban') {
          multiplier = 0.35; // More apartments, fewer single-family homes
        } else if (density === 'rural') {
          multiplier = 0.45; // More single-family homes
        }

        estimatedDoors = Math.round(p.registered_voters * multiplier);
        estimateQuality = 'high'; // We have actual voter data
      } else if (p.demographics?.total_population && p.demographics.total_population > 0) {
        // Fallback to population estimate
        // Assume ~2.5 people per household
        estimatedDoors = Math.round(p.demographics.total_population / 2.5);
        estimateQuality = 'medium';
      } else {
        // Worst case - use jurisdiction average
        estimatedDoors = 50; // Default fallback
        estimateQuality = 'low';
      }

      return {
        precinctId: p.id || p.name,
        precinctName: p.name,
        jurisdiction,
        centroid: this.getPrecinctCentroid(p.id || p.name, jurisdiction),
        estimatedDoors,
        density: this.inferDensity(p),
        gotvPriority: p.targeting?.gotvPriority || p.targeting?.gotv_priority || 50,
        persuasionOpportunity: p.targeting?.persuasionOpportunity || p.targeting?.persuasion_opportunity || 50,
        swingPotential: p.electoral?.swingPotential || p.electoral?.swing_potential || 50,
        // Store estimate quality in metadata (if spatial engine supports it)
        metadata: {
          estimateQuality,
          hasVoterData: !!p.registered_voters,
          hasPopulationData: !!p.demographics?.total_population,
        },
      };
    });

    const engine = getSpatialReasoningEngine();
    return engine.analyze(spatialInputs);
  }

  /**
   * Generate AI message with spatial insights
   */
  generateSpatialInsightMessage(precincts: PrecinctData[]): AIMessage | null {
    const analysis = this.analyzeSpatialSelection(precincts);
    if (!analysis) {
      return null;
    }

    const { summary, suggestions: spatialSuggestions, clusters, outliers } = analysis;

    // Build acknowledgment
    const acknowledgment = `**Spatial Analysis**: ${summary.quickStats.totalDoors.toLocaleString()} doors across ${precincts.length} precincts`;

    // Build insight from summary
    const insightParts: string[] = [];
    insightParts.push(summary.clusterDescription);
    if (summary.outlierDescription) {
      insightParts.push(summary.outlierDescription);
    }
    insightParts.push(summary.efficiencyDescription);
    const insight = insightParts.join(' ');

    // Convert spatial suggestions to action suggestions
    const suggestions = this.convertSpatialSuggestions(spatialSuggestions, analysis);

    // Add map visualization suggestions
    if (clusters.length >= 2) {
      suggestions.push({
        id: 'show-clusters',
        label: 'Show clusters on map',
        action: 'map:showClusters',
        priority: 85,
        category: 'exploration',
        metadata: { clusters: clusters.map(c => ({ id: c.id, precinctIds: c.precinctIds })) },
        triggerReason: `${clusters.length} geographic clusters detected`,
      });
    }

    if (precincts.length >= 3) {
      suggestions.push({
        id: 'show-optimized-route',
        label: 'Show optimized route',
        action: 'map:showOptimizedRoute',
        priority: 80,
        category: 'canvassing',
        metadata: { precinctIds: precincts.map(p => p.id || p.name) },
        triggerReason: 'Visualize the most efficient canvassing path',
      });
    }

    return {
      acknowledgment,
      insight,
      suggestions: this.prioritizeSuggestions(suggestions, getStateManager().getState()),
    };
  }

  /**
   * Convert spatial suggestions to AI action suggestions
   */
  private convertSpatialSuggestions(
    spatialSuggestions: SpatialSuggestion[],
    analysis: SpatialAnalysis
  ): SuggestedAction[] {
    return spatialSuggestions.slice(0, 5).map(s => {
      let action: string;
      let category: SuggestionCategory;

      switch (s.type) {
        case 'drop_outlier':
          action = `spatial:removePrecincts:${JSON.stringify(s.action.precinctIds)}`;
          category = 'segmentation';
          break;
        case 'add_connector':
        case 'add_nearby':
          action = `spatial:addPrecincts:${JSON.stringify(s.action.precinctIds)}`;
          category = 'segmentation';
          break;
        case 'split_clusters':
          action = `spatial:splitClusters:${JSON.stringify(s.action.clusterIds)}`;
          category = 'canvassing';
          break;
        case 'merge_clusters':
          action = `spatial:mergeClusters:${JSON.stringify(s.action.clusterIds)}`;
          category = 'canvassing';
          break;
        case 'reorder_route':
          action = 'map:showOptimizedRoute';
          category = 'canvassing';
          break;
        default:
          action = 'dismiss';
          category = 'exploration';
      }

      // Calculate priority based on impact
      const impactScore = Math.abs(s.impact.efficiencyChange) + Math.abs(s.impact.doorsChange / 10);
      const priorityMap = { high: 90, medium: 70, low: 50 };
      const basePriority = priorityMap[s.priority];
      const priority = Math.min(100, basePriority + impactScore);

      return {
        id: s.id,
        label: s.title,
        description: s.description,
        action,
        priority,
        category,
        metadata: {
          impactEfficiency: s.impact.efficiencyChange,
          impactDoors: s.impact.doorsChange,
          impactTime: s.impact.timeChange,
          suggestionType: s.type,
        },
        triggerReason: s.description,
      };
    });
  }

  /**
   * Get approximate centroid for a precinct based on jurisdiction
   * Uses jurisdiction-level approximate centers with small offsets for variation
   */
  private getPrecinctCentroid(precinctId: string, jurisdiction: string): [number, number] {
    const JURISDICTION_CENTERS: Record<string, [number, number]> = {
      'East Lansing': [-84.4839, 42.7369],
      Lansing: [-84.5555, 42.7337],
      'Meridian Township': [-84.41, 42.71],
      'Delhi Township': [-84.58, 42.65],
      Williamston: [-84.283, 42.689],
      Philadelphia: [-75.1652, 39.9526],
      Pittsburgh: [-79.9959, 40.4406],
      Harrisburg: [-76.8867, 40.2732],
      Allentown: [-75.4772, 40.6023],
      Erie: [-80.0851, 42.1292],
      Reading: [-75.9269, 40.3356],
      Scranton: [-75.6649, 41.4089],
      Lancaster: [-76.3055, 40.0379],
      York: [-76.7277, 39.9626],
      Chester: [-75.3557, 39.8496],
      Bethlehem: [-75.3705, 40.6259],
      Unknown:
        getPoliticalRegionEnv().stateFips === '42' ? [-77.1945, 41.2033] : [-84.55, 42.73],
    };

    // Get base center
    const baseCenter = JURISDICTION_CENTERS[jurisdiction] || JURISDICTION_CENTERS['Unknown'];

    // Add small offset based on precinct ID hash for variation
    const hash = precinctId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const offsetLng = ((hash % 100) - 50) / 5000; // ± 0.01 degrees
    const offsetLat = (((hash * 7) % 100) - 50) / 5000;

    return [baseCenter[0] + offsetLng, baseCenter[1] + offsetLat];
  }

  /**
   * Infer density type from precinct data
   */
  private inferDensity(precinct: PrecinctData): 'urban' | 'suburban' | 'rural' {
    // Use population density if available
    const popDensity = precinct.demographics?.populationDensity || precinct.demographics?.population_density || 0;
    if (popDensity > 3000) {
      return 'urban';
    }
    if (popDensity > 1000) {
      return 'suburban';
    }
    if (popDensity > 0) {
      return 'rural';
    }

    // Infer from registered voters and name indicators
    const voters = precinct.registered_voters || 0;
    const name = (precinct.name || '').toLowerCase();

    // Urban indicators
    if (name.includes('lansing') && !name.includes('township')) {
      return 'urban';
    }
    if (
      name.includes('philadelphia') ||
      name.includes('pittsburgh') ||
      name.includes('harrisburg') ||
      name.includes('reading') ||
      name.includes('erie') ||
      name.includes('allentown') ||
      name.includes('scranton')
    ) {
      return 'urban';
    }
    if (voters > 3000) {
      return 'urban';
    }

    // Rural indicators
    if (name.includes('township') || name.includes('twp')) {
      if (voters < 1500) {
        return 'rural';
      }
    }

    // Default to suburban
    return 'suburban';
  }

  /**
   * Check if spatial analysis should be triggered
   * Call this when selection changes
   */
  shouldTriggerSpatialAnalysis(selectedCount: number): boolean {
    // Trigger when 3+ precincts selected
    return selectedCount >= 3;
  }

  /**
   * Get formatted spatial insight for AI context
   */
  getSpatialContextForAI(precincts: PrecinctData[]): string | null {
    const analysis = this.analyzeSpatialSelection(precincts);
    if (!analysis) {
      return null;
    }

    const { summary, clusters, outliers, efficiency } = analysis;
    const parts: string[] = [
      '## SPATIAL ANALYSIS OF CURRENT SELECTION',
      '',
      `**Precincts**: ${analysis.inputPrecincts}`,
      `**Clusters**: ${clusters.length}`,
      `**Outliers**: ${outliers.length}`,
      `**Total Doors**: ${summary.quickStats.totalDoors.toLocaleString()}`,
      `**Estimated Hours**: ${summary.quickStats.estimatedHours.toFixed(1)}`,
      `**Efficiency**: ${summary.quickStats.doorsPerHour.toFixed(1)} doors/hour`,
      '',
    ];

    if (summary.quickStats.potentialImprovement > 5) {
      parts.push(`**Potential Improvement**: +${summary.quickStats.potentialImprovement.toFixed(0)}% efficiency if optimized`);
      parts.push('');
    }

    // Add cluster details
    if (clusters.length > 0) {
      parts.push('### Clusters');
      for (const cluster of clusters) {
        parts.push(`- **${cluster.name}**: ${cluster.metrics.totalPrecincts} precincts, ${cluster.metrics.totalDoors} doors, ${cluster.metrics.estimatedHours.toFixed(1)}h`);
      }
      parts.push('');
    }

    // Add outlier details
    if (outliers.length > 0) {
      parts.push('### Outliers');
      for (const outlier of outliers) {
        const action = outlier.impactAnalysis.recommendation === 'drop' ? '(consider dropping)' : '(worth keeping)';
        parts.push(`- **${outlier.precinctName}**: ${outlier.reason} ${action}`);
      }
      parts.push('');
    }

    // Add top suggestion
    if (summary.topRecommendation) {
      parts.push(`### Top Recommendation`);
      parts.push(summary.topRecommendation);
    }

    return parts.join('\n');
  }

  // ============================================================================
  // Serendipitous Discoveries (Phase 13)
  // ============================================================================

  /**
   * Check for serendipitous insights based on current context
   * Call this after significant user actions (selection, filter, navigation)
   */
  async checkForSerendipitousInsight(trigger: InsightTrigger): Promise<InsightCheckResult> {
    const stateManager = getStateManager();
    const explorationDepth = stateManager.getExplorationDepth();

    const insightEngine = getInsightEngine();
    return insightEngine.checkForInsights({
      trigger,
      minExplorationDepth: explorationDepth,
    });
  }

  /**
   * Check for donor-GOTV overlap insight
   * Call when user views GOTV precincts or donor data
   */
  checkDonorGotvInsight(
    gotvPrecincts: string[],
    donorData: Array<{ zip: string; totalAmount: number; donorCount: number }>
  ): Insight | null {
    const insightEngine = getInsightEngine();
    return insightEngine.checkDonorGotvOverlap({
      gotvPrecincts,
      donorZips: donorData,
    });
  }

  /**
   * Check for tapestry-turnout pattern insight
   * Call when user applies tapestry filter or views turnout data
   */
  checkTapestryTurnoutInsight(
    tapestrySegments: Array<{ code: string; name: string; precinctCount: number }>,
    turnoutData: Array<{ precinctId: string; tapestryCode: string; turnout: number }>,
    electionType: 'presidential' | 'midterm' | 'primary' = 'presidential'
  ): Insight | null {
    const insightEngine = getInsightEngine();
    return insightEngine.checkTapestryTurnout({
      tapestrySegments,
      turnoutData,
      electionType,
    });
  }

  /**
   * Check for demographic-swing correlation insight
   * Call when user explores swing precincts with demographic data visible
   */
  checkDemographicSwingInsight(
    precincts: Array<{
      id: string;
      swingPotential: number;
      demographics: {
        collegeEducated?: number;
        medianAge?: number;
        medianIncome?: number;
        urbanDensity?: number;
      };
    }>
  ): Insight | null {
    const insightEngine = getInsightEngine();
    return insightEngine.checkDemographicSwing({ precincts });
  }

  /**
   * Check for geographic cluster insight
   * Call when user has multiple precincts selected
   */
  checkGeographicClusterInsight(
    precincts: Array<{
      id: string;
      centroid: [number, number];
      metrics: Record<string, number>;
    }>,
    metric: string = 'gotv_priority'
  ): Insight | null {
    const insightEngine = getInsightEngine();
    return insightEngine.checkGeographicCluster({
      precincts,
      metric,
    });
  }

  /**
   * Check for cross-tool connection insight
   * Call when user navigates between tools
   */
  checkCrossToolConnectionInsight(): Insight | null {
    const stateManager = getStateManager();
    const state = stateManager.getState();

    // Build exploration history from state
    const explorationHistory = state.explorationHistory.map(entry => ({
      tool: entry.tool,
      precincts: entry.precinctIds || [],
      filters: (entry.metadata as Record<string, unknown>) || {},
      timestamp: new Date(entry.timestamp),
    }));

    if (explorationHistory.length < 2) {
      return null;
    }

    const insightEngine = getInsightEngine();
    return insightEngine.checkCrossToolConnection({ explorationHistory });
  }

  /**
   * Generate AI message for a serendipitous insight
   */
  generateInsightMessage(insight: Insight): AIMessage {
    // Use framing helper for "Did you know..." style
    const framedMessage = frameAsDiscovery({
      title: insight.title,
      message: insight.message,
    });

    // Convert insight actions to suggested actions
    const suggestions: SuggestedAction[] = insight.suggestedActions.map((action, index) => ({
      id: action.id || `insight-action-${index}`,
      label: action.label,
      action: action.action,
      priority: 85 - index * 10, // Decreasing priority
      category: this.mapInsightCategoryToSuggestion(insight.category),
      metadata: action.metadata,
      triggerReason: insight.shortMessage,
    }));

    // Add follow-up questions as suggestions
    const followUps = getFollowUpQuestions(insight.category);
    if (followUps.length > 0) {
      suggestions.push({
        id: 'insight-followup',
        label: 'Tell me more',
        description: followUps[0],
        action: followUps[0],
        priority: 60,
        category: 'analysis',
        triggerReason: 'Follow-up question for deeper insight',
      });
    }

    // Add dismiss option
    suggestions.push({
      id: `dismiss-insight-${insight.category}`,
      label: "Don't show insights like this",
      action: `dismiss_insight_category:${insight.category}`,
      priority: 10,
      category: 'session',
    });

    return {
      acknowledgment: insight.title,
      insight: framedMessage,
      suggestions: suggestions.slice(0, 4), // Max 4 suggestions
    };
  }

  /**
   * Dismiss an insight category (user doesn't want to see this type)
   */
  dismissInsightCategory(category: string): void {
    const insightEngine = getInsightEngine();
    insightEngine.disableCategory(category as InsightCategory);
  }

  /**
   * Record that user engaged with an insight
   */
  recordInsightEngagement(insightId: string): void {
    const insightEngine = getInsightEngine();
    insightEngine.recordInsightClick(insightId);
  }

  /**
   * Get insight engagement stats for analytics
   */
  getInsightEngagementStats() {
    const insightEngine = getInsightEngine();
    return insightEngine.getEngagementStats();
  }

  /**
   * Map insight category to suggestion category
   */
  private mapInsightCategoryToSuggestion(insightCategory: InsightCategory): SuggestionCategory {
    const mapping: Record<InsightCategory, SuggestionCategory> = {
      donor_gotv_overlap: 'donors',
      tapestry_turnout: 'analysis',
      demographic_swing: 'analysis',
      geographic_cluster: 'exploration',
      temporal_anomaly: 'analysis',
      cross_tool_connection: 'workflow',
    };
    return mapping[insightCategory] || 'exploration';
  }

  // ============================================================================
  // Ambient Awareness Tracking (Phase 12: Principle 15)
  // ============================================================================

  /**
   * Track when user hovers on a precinct
   * Detects pattern: 3+ unique hovers without click suggests comparison
   */
  trackHover(precinctId: string): void {
    const now = Date.now();

    // Clean old hovers (older than 30 seconds)
    this.hoverHistory = this.hoverHistory.filter(h => now - h.timestamp < 30000);

    // Add new hover
    this.hoverHistory.push({ id: precinctId, timestamp: now });

    // Check for pattern: 3+ unique hovers without click (and no selection in last 10 seconds)
    const uniqueHovers = new Set(this.hoverHistory.map(h => h.id));
    if (uniqueHovers.size >= 3 && now - this.lastSelectTimestamp > 10000) {
      this.suggestComparison(Array.from(uniqueHovers).slice(0, 3));
    }
  }

  /**
   * Track when user applies a filter
   * Detects pattern: Same filter applied 2+ times suggests saving as segment
   */
  trackFilterApply(filterKey: string, filterValue: unknown): void {
    const filterSignature = `${filterKey}:${JSON.stringify(filterValue)}`;
    const now = Date.now();

    // Clean old filters (older than 2 minutes)
    this.filterHistory = this.filterHistory.filter(f => now - f.timestamp < 120000);

    // Check if same filter applied before
    const sameFilterCount = this.filterHistory.filter(f => f.filter === filterSignature).length;

    this.filterHistory.push({ filter: filterSignature, timestamp: now });

    // If filter applied 2+ times, suggest saving as segment
    if (sameFilterCount >= 1) {
      this.pendingSuggestion = {
        id: 'save-filter',
        label: 'Save this filter as a segment',
        action: 'output:saveSegment',
        priority: 75,
        category: 'segmentation',
        metadata: { reason: "You've used this filter combination multiple times" },
        triggerReason: "You've used this filter combination multiple times",
      };
    }
  }

  /**
   * Track zoom/pan without selection
   * Detects pattern: 3+ zooms without selecting suggests help
   */
  trackMapInteraction(type: 'zoom' | 'pan'): void {
    this.zoomWithoutSelectCount++;

    // If user zooms/pans 3+ times without selecting, offer help
    if (this.zoomWithoutSelectCount >= 3) {
      this.pendingSuggestion = {
        id: 'zoom-help',
        label: 'Need help finding precincts?',
        action: 'Show me example questions for exploring the map',
        priority: 60,
        category: 'exploration',
        triggerReason: 'You seem to be exploring the map - let me help',
      };
    }
  }

  /**
   * Track selection - resets zoom counter and clears hover history
   */
  trackSelection(precinctId: string): void {
    this.lastSelectTimestamp = Date.now();
    this.zoomWithoutSelectCount = 0;
    this.hoverHistory = []; // Clear hover history on actual selection
  }

  /**
   * Get any pending suggestion from pattern detection
   * Returns null if no suggestion is pending
   */
  getPendingSuggestion(): SuggestedAction | null {
    const suggestion = this.pendingSuggestion;
    this.pendingSuggestion = null; // Clear after returning
    return suggestion;
  }

  /**
   * Suggest comparison based on hover pattern
   */
  private suggestComparison(precinctIds: string[]): void {
    this.pendingSuggestion = {
      id: 'hover-compare',
      label: `Compare ${precinctIds.length} precincts you're exploring`,
      action: `Compare ${precinctIds.join(' and ')}`,
      priority: 80,
      category: 'comparison',
      triggerReason: "You've been hovering over multiple precincts - want to compare them?",
    };
  }

  // ============================================================================
  // Wave 3: Enhanced Pattern Detection
  // ============================================================================

  /**
   * Track metric view - detects when user views same metric repeatedly
   * If user views same metric 3+ times on different precincts, suggest segment creation
   */
  trackMetricView(metric: string, precinctId: string): void {
    const now = Date.now();

    // Clean old entries (older than 5 minutes)
    this.metricViewHistory = this.metricViewHistory.filter(
      entry => now - entry.timestamp < 300000
    );

    // Add new entry
    this.metricViewHistory.push({ metric, precinctId, timestamp: now });

    // Check for repeated metric pattern
    const metricViews = this.metricViewHistory.filter(entry => entry.metric === metric);
    const uniquePrecincts = new Set(metricViews.map(entry => entry.precinctId));

    if (metricViews.length >= 3 && uniquePrecincts.size >= 3) {
      // User has viewed this metric on 3+ different precincts
      if (this.canShowSuggestion()) {
        this.pendingSuggestion = {
          id: 'metric-segment-suggest',
          label: `Create segment filtered by ${metric.replace(/_/g, ' ')}`,
          action: `Create a segment of precincts filtered by ${metric.replace(/_/g, ' ')}`,
          priority: 75,
          category: 'segmentation',
          triggerReason: `You've been exploring ${metric.replace(/_/g, ' ')} across multiple precincts`,
        };
        this.lastSuggestionTimestamp = now;
      }
    }
  }

  /**
   * Track back-and-forth navigation between precincts
   * If user alternates between 2 precincts 3+ times, suggest comparison
   */
  trackBackAndForth(precinctId: string): void {
    const now = Date.now();

    // Clean old entries (older than 2 minutes)
    this.backAndForthHistory = this.backAndForthHistory.filter(
      entry => now - entry.timestamp < 120000
    );

    // Add new entry
    this.backAndForthHistory.push({ precinctId, timestamp: now });

    // Check for back-and-forth pattern (at least 4 entries with 2 unique precincts alternating)
    if (this.backAndForthHistory.length >= 4) {
      const recent = this.backAndForthHistory.slice(-6);
      const uniquePrecincts = [...new Set(recent.map(e => e.precinctId))];

      if (uniquePrecincts.length === 2) {
        // Check if they're alternating
        let alternations = 0;
        for (let i = 1; i < recent.length; i++) {
          if (recent[i].precinctId !== recent[i - 1].precinctId) {
            alternations++;
          }
        }

        if (alternations >= 3 && this.canShowSuggestion()) {
          this.pendingSuggestion = {
            id: 'backforth-compare-suggest',
            label: `Compare ${uniquePrecincts[0]} and ${uniquePrecincts[1]}`,
            action: `Compare ${uniquePrecincts.join(' and ')}`,
            priority: 90,
            category: 'comparison',
            triggerReason: "You're switching between these two precincts - want a side-by-side comparison?",
          };
          this.lastSuggestionTimestamp = now;
          // Clear history to prevent immediate re-trigger
          this.backAndForthHistory = [];
        }
      }
    }
  }

  /**
   * Track long hover without click
   * Called when hover duration exceeds threshold (e.g., 2 seconds)
   */
  trackLongHover(precinctId: string, durationMs: number): void {
    if (durationMs >= 2000 && this.canShowSuggestion()) {
      const now = Date.now();
      this.pendingSuggestion = {
        id: 'longhover-help',
        label: `Learn more about ${precinctId}`,
        action: `Tell me about ${precinctId}`,
        priority: 60,
        category: 'exploration',
        triggerReason: 'Click to select, or ask me for quick info about this precinct',
      };
      this.lastSuggestionTimestamp = now;
    }
  }

  /**
   * Check if enough time has passed since last suggestion
   * Prevents suggestion spam
   */
  private canShowSuggestion(): boolean {
    const now = Date.now();
    return now - this.lastSuggestionTimestamp > this.SUGGESTION_COOLDOWN_MS;
  }

  /**
   * Get exploration depth to adjust suggestion urgency
   */
  getExplorationDepthFactor(): number {
    try {
      const stateManager = getStateManager();
      const depth = stateManager.getExplorationDepth();
      // Return factor 0.5 to 1.5 based on depth
      // Lower depth = more helpful suggestions, higher depth = less intrusive
      return depth < 30 ? 1.5 : depth < 60 ? 1.0 : 0.7;
    } catch {
      return 1.0;
    }
  }
}

// Export singleton accessor
export const getSuggestionEngine = () => SuggestionEngine.getInstance();

// ============================================================================
// Convenience Exports for Ambient Awareness Tracking
// ============================================================================

/**
 * Track hover event on a precinct
 */
export function trackHover(precinctId: string): void {
  getSuggestionEngine().trackHover(precinctId);
}

/**
 * Track filter application
 */
export function trackFilterApply(key: string, value: unknown): void {
  getSuggestionEngine().trackFilterApply(key, value);
}

/**
 * Track map interaction (zoom or pan)
 */
export function trackMapInteraction(type: 'zoom' | 'pan'): void {
  getSuggestionEngine().trackMapInteraction(type);
}

/**
 * Track precinct selection
 */
export function trackSelection(precinctId: string): void {
  getSuggestionEngine().trackSelection(precinctId);
}

/**
 * Get any pending suggestion from pattern detection
 */
export function getPendingSuggestion(): SuggestedAction | null {
  return getSuggestionEngine().getPendingSuggestion();
}

// Wave 3: Enhanced pattern tracking exports

/**
 * Track metric view for pattern detection
 */
export function trackMetricView(metric: string, precinctId: string): void {
  getSuggestionEngine().trackMetricView(metric, precinctId);
}

/**
 * Track back-and-forth navigation between precincts
 */
export function trackBackAndForth(precinctId: string): void {
  getSuggestionEngine().trackBackAndForth(precinctId);
}

/**
 * Track long hover without click
 */
export function trackLongHover(precinctId: string, durationMs: number): void {
  getSuggestionEngine().trackLongHover(precinctId, durationMs);
}

/**
 * Get exploration depth factor for suggestion urgency
 */
export function getExplorationDepthFactor(): number {
  return getSuggestionEngine().getExplorationDepthFactor();
}

export default SuggestionEngine;
