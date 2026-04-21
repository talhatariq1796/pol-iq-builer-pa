/**
 * CrossToolNavigator - Handles navigation between tools with context preservation
 *
 * Part of Phase 9: Cross-Tool Deep Links
 * Enables AI to navigate between tools while maintaining user context
 */

import type { ToolUrlParams } from '../hooks/useToolUrlParams';
import { buildQueryString } from '../hooks/useToolUrlParams';

// ============================================================================
// Type Definitions
// ============================================================================

export type NavigableTool = 'segments' | 'compare' | 'political-ai';

export interface NavigationContext {
  tool: NavigableTool;
  params: ToolUrlParams;
  preserveHistory?: boolean;
}

// ============================================================================
// CrossToolNavigator Class
// ============================================================================

export class CrossToolNavigator {
  /**
   * Navigate to a tool with context parameters (enhanced with full context preservation - Wave 4B #10)
   *
   * @param targetTool - The tool to navigate to
   * @param params - URL parameters to pass
   * @param preserveHistory - Whether to preserve browser history (default: true)
   *
   * @example
   * ```ts
   * // Navigate to segments with precincts selected
   * CrossToolNavigator.navigateWithContext('segments', {
   *   precincts: ['P001', 'P002', 'P003'],
   *   metric: 'gotv_priority'
   * });
   *
   * // Navigate to comparison with entities
   * CrossToolNavigator.navigateWithContext('compare', {
   *   left: 'lansing',
   *   right: 'east-lansing'
   * });
   * ```
   */
  static navigateWithContext(
    targetTool: NavigableTool,
    params: ToolUrlParams,
    preserveHistory = true
  ): void {
    // Get current exploration state from StateManager
    const enhancedParams = { ...params };

    if (typeof window !== 'undefined') {
      try {
        const { getStateManager } = require('@/lib/ai-native/ApplicationStateManager');
        const stateManager = getStateManager();

        // Get current exploration state
        const exploredPrecincts = Array.from(stateManager.getState().behavior.exploredPrecincts || []) as string[];
        const currentTool = stateManager.getCurrentTool();

        // Add explored precincts if navigating to segments/canvass and not already provided
        if (['segments'].includes(targetTool) && !params.precincts && exploredPrecincts.length > 0) {
          enhancedParams.precincts = exploredPrecincts.slice(0, 10); // Limit to 10 most recent
        }

        // Add source context if not explicitly navigating from political-ai
        if (currentTool && currentTool !== 'political-ai') {
          // Store source tool in session storage for receiving page to access
          sessionStorage.setItem('pol_nav_source', currentTool);
          sessionStorage.setItem('pol_nav_precincts', JSON.stringify(exploredPrecincts.slice(0, 10)));
          // Add timestamp to track freshness (2 hour TTL)
          sessionStorage.setItem('pol_nav_timestamp', Date.now().toString());
        }

        // P2 Fix: Preserve map state across tool navigation
        const mapState = stateManager.getSharedMapState();
        if (mapState && mapState.layer !== 'none') {
          sessionStorage.setItem('pol_nav_mapState', JSON.stringify({
            layer: mapState.layer,
            metric: mapState.metric,
            highlights: mapState.highlights?.slice(0, 20) || [],
            center: mapState.center,
            zoom: mapState.zoom,
          }));
        }
      } catch (error) {
        console.warn('[CrossToolNavigator] Failed to enhance params with context:', error);
        // Continue with original params
      }
    }

    const url = this.buildUrl(targetTool, enhancedParams);

    if (typeof window !== 'undefined') {
      if (preserveHistory) {
        window.location.href = url;
      } else {
        window.location.replace(url);
      }
    }
  }

  /**
   * Build URL for a tool with parameters
   *
   * @param tool - The target tool
   * @param params - URL parameters
   * @returns Full URL path with query string
   *
   * @example
   * ```ts
   * const url = CrossToolNavigator.buildUrl('segments', {
   *   precincts: ['P001', 'P002'],
   *   segment: 'high-gotv'
   * });
   * // Returns: "/segments?precincts=P001,P002&segment=high-gotv"
   * ```
   */
  static buildUrl(tool: NavigableTool, params: ToolUrlParams): string {
    const basePath = this.getToolPath(tool);
    const queryString = buildQueryString(params);
    return `${basePath}${queryString}`;
  }

  /**
   * Parse a navigate command string
   *
   * Supports formats:
   * - "navigate:segments?precincts=P001,P002"
   * - "navigate:compare?left=lansing&right=east-lansing"
   *
   * @param command - Navigation command string
   * @returns Parsed tool and params, or null if invalid
   *
   * @example
   * ```ts
   * const result = CrossToolNavigator.parseNavigateCommand(
   *   'navigate:segments?precincts=P001,P002&metric=gotv_priority'
   * );
   * // Returns: { tool: 'segments', params: { precincts: ['P001', 'P002'], metric: 'gotv_priority' } }
   * ```
   */
  static parseNavigateCommand(command: string): NavigationContext | null {
    // Check if command starts with "navigate:"
    if (!command.startsWith('navigate:')) {
      return null;
    }

    // Remove "navigate:" prefix
    const urlPart = command.substring('navigate:'.length);

    // Split into path and query
    const [path, queryString] = urlPart.split('?');

    // Determine tool from path
    const tool = this.pathToTool(path);
    if (!tool) {
      return null;
    }

    // Parse query string if present
    const params = queryString ? this.parseQueryString(queryString) : {};

    return { tool, params };
  }

  /**
   * Get tool path from tool name
   */
  private static getToolPath(tool: NavigableTool): string {
    const paths: Record<NavigableTool, string> = {
      'segments': '/segments',
      'compare': '/compare',
      'political-ai': '/political-ai',
    };
    return paths[tool];
  }

  /**
   * Convert path to tool name
   */
  private static pathToTool(path: string): NavigableTool | null {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;

    const validTools: NavigableTool[] = ['segments', 'compare', 'political-ai'];

    if (validTools.includes(cleanPath as NavigableTool)) {
      return cleanPath as NavigableTool;
    }

    return null;
  }

  /**
   * Parse query string into ToolUrlParams
   */
  private static parseQueryString(queryString: string): ToolUrlParams {
    const params: ToolUrlParams = {};
    const urlParams = new URLSearchParams(queryString);

    // Parse each parameter
    urlParams.forEach((value, key) => {
      switch (key) {
        case 'precincts':
        case 'zips':
        case 'turfs': // P1-14
          // Parse comma-separated arrays
          params[key] = value.split(',').filter(Boolean);
          break;

        case 'segment':
        case 'left':
        case 'right':
        case 'filter':
        case 'metric':
          // Parse string values
          params[key] = decodeURIComponent(value);
          break;

        case 'view':
          // Parse view with validation
          if (this.isValidView(value)) {
            params.view = value as ToolUrlParams['view'];
          }
          break;

        case 'volunteers': // P1-14
        case 'year':       // P1-14
        case 'month':      // P1-14
          // Parse numeric values
          {
            const num = parseInt(value, 10);
            if (!isNaN(num)) {
              params[key] = num;
            }
          }
          break;

        default:
          // Unknown parameter - ignore
          break;
      }
    });

    return params;
  }

  /**
   * Validate view parameter
   */
  private static isValidView(view: string): boolean {
    const validViews = ['zip', 'timeSeries', 'occupations', 'committees', 'ies', 'lapsed', 'upgrade'];
    return validViews.includes(view);
  }

  /**
   * Generate "Continue in [Tool]" suggestions based on current context
   *
   * @param currentTool - The current tool the user is on
   * @param context - Current context data
   * @returns Array of suggested navigation actions
   *
   * @example
   * ```ts
   * const suggestions = CrossToolNavigator.generateContinueInSuggestions('segments', {
   *   matchingPrecincts: ['P001', 'P002'],
   *   segmentName: 'high-gotv'
   * });
   * // Returns suggestions to continue in segments
   * ```
   */
  static generateContinueInSuggestions(
    currentTool: NavigableTool,
    context: Record<string, unknown>
  ): Array<{ label: string; action: string; metadata?: Record<string, unknown> }> {
    const suggestions: Array<{ label: string; action: string; metadata?: Record<string, unknown> }> = [];

    switch (currentTool) {
      case 'compare':
        if (context.leftEntity && context.rightEntity) {
          suggestions.push({
            label: 'View on Full Map',
            action: 'navigate:political-ai',
            metadata: { tool: 'political-ai' }
          });
        }
        break;

      default:
        break;
    }

    return suggestions;
  }

  /**
   * Restore map state from session storage (called on tool page mount)
   * P2 Fix: Preserve map state across tool navigation
   *
   * @returns Saved map state or null if not available/expired
   */
  static restoreMapState(): {
    layer: 'choropleth' | 'heatmap' | 'none';
    metric: string | null;
    highlights: string[];
    center?: [number, number];
    zoom?: number;
  } | null {
    if (typeof window === 'undefined') return null;

    try {
      const timestamp = sessionStorage.getItem('pol_nav_timestamp');
      if (!timestamp) return null;

      // Check if context is fresh (2 hour TTL)
      const navTime = parseInt(timestamp, 10);
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      if (Date.now() - navTime > TWO_HOURS) {
        // Context expired, clean up
        sessionStorage.removeItem('pol_nav_mapState');
        return null;
      }

      const mapStateJson = sessionStorage.getItem('pol_nav_mapState');
      if (!mapStateJson) return null;

      const mapState = JSON.parse(mapStateJson);

      // Clean up after reading (one-time use)
      sessionStorage.removeItem('pol_nav_mapState');

      return mapState;
    } catch (error) {
      console.warn('[CrossToolNavigator] Failed to restore map state:', error);
      return null;
    }
  }

  /**
   * Apply restored map state to ApplicationStateManager
   * Call this after restoreMapState() returns non-null
   */
  static applyRestoredMapState(mapState: {
    layer: 'choropleth' | 'heatmap' | 'none';
    metric: string | null;
    highlights: string[];
    center?: [number, number];
    zoom?: number;
  }): void {
    if (typeof window === 'undefined') return;

    try {
      const { getStateManager } = require('@/lib/ai-native/ApplicationStateManager');
      const stateManager = getStateManager();

      stateManager.updateSharedMapState({
        layer: mapState.layer,
        metric: mapState.metric,
        highlights: mapState.highlights || [],
        center: mapState.center,
        zoom: mapState.zoom,
      });

      console.log('[CrossToolNavigator] Restored map state:', {
        layer: mapState.layer,
        metric: mapState.metric,
        highlightCount: mapState.highlights?.length || 0,
      });
    } catch (error) {
      console.warn('[CrossToolNavigator] Failed to apply map state:', error);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Navigate to segments page with precincts
 */
export function navigateToSegments(precincts: string[], segmentName?: string): void {
  CrossToolNavigator.navigateWithContext('segments', {
    precincts,
    segment: segmentName,
  });
}

/**
 * Navigate to comparison page with entities
 */
export function navigateToComparison(leftId: string, rightId: string): void {
  CrossToolNavigator.navigateWithContext('compare', {
    left: leftId,
    right: rightId,
  });
}
