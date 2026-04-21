/**
 * useToolUrlParams - Hook for parsing and applying URL parameters on tool pages
 *
 * Part of Phase 9: Cross-Tool Deep Links
 * Enables navigation between tools with context preservation
 */

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ToolUrlParams {
  /** Precinct IDs to select/highlight */
  precincts?: string[];
  /** Saved segment name to load */
  segment?: string;
  /** ZIP codes to filter (for donor tool) */
  zips?: string[];
  /** Left comparison entity ID */
  left?: string;
  /** Right comparison entity ID */
  right?: string;
  /** Filter preset name */
  filter?: string;
  /** Map metric to display */
  metric?: string;
  /** View type for donor tool */
  view?: 'zip' | 'timeSeries' | 'occupations' | 'committees' | 'ies' | 'lapsed' | 'upgrade';
  /** Target precincts for canvassing (alias for precincts) */
  targetPrecincts?: string[];
  /** Operation type for canvassing */
  operation?: string;
  /** Canvassing turfs (comma-separated turf IDs) */
  turfs?: string[];
  /** Number of volunteers for canvassing */
  volunteers?: number;
  /** Year filter (for temporal visualization) */
  year?: number;
  /** Month filter (for time-series donor analysis) */
  month?: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing URL parameters on tool pages
 *
 * @returns Object with params, applyParams, and clearParams
 *
 * @example
 * ```tsx
 * const { params, applyParams, clearParams } = useToolUrlParams();
 *
 * // On mount, check for URL params
 * useEffect(() => {
 *   if (params.precincts) {
 *     selectPrecincts(params.precincts);
 *   }
 * }, [params.precincts]);
 *
 * // Update URL when state changes
 * const handleSelectionChange = (ids: string[]) => {
 *   applyParams({ precincts: ids });
 * };
 * ```
 */
export function useToolUrlParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // P1-17: Sync URL navigation back to ApplicationStateManager
  useEffect(() => {
    if (!pathname || typeof window === 'undefined') return;

    try {
      const { getStateManager } = require('@/lib/ai-native/ApplicationStateManager');
      const stateManager = getStateManager();

      // Extract tool from pathname
      const tool = extractToolFromPath(pathname);
      if (tool) {
        stateManager.setCurrentTool(tool);
      }
    } catch (error) {
      console.warn('[useToolUrlParams] Failed to sync with StateManager:', error);
    }
  }, [pathname]);

  // ============================================================================
  // Parse URL Parameters
  // ============================================================================

  const params: ToolUrlParams = useMemo(() => {
    const parsed: ToolUrlParams = {};

    // Parse precincts (comma-separated)
    const precinctsParam = searchParams?.get('precincts');
    if (precinctsParam) {
      parsed.precincts = precinctsParam.split(',').filter(Boolean);
    }

    // Parse segment name
    const segmentParam = searchParams?.get('segment');
    if (segmentParam) {
      parsed.segment = decodeURIComponent(segmentParam);
    }

    // Parse ZIP codes (comma-separated)
    const zipsParam = searchParams?.get('zips');
    if (zipsParam) {
      parsed.zips = zipsParam.split(',').filter(Boolean);
    }

    // Parse left entity ID
    const leftParam = searchParams?.get('left');
    if (leftParam) {
      parsed.left = decodeURIComponent(leftParam);
    }

    // Parse right entity ID
    const rightParam = searchParams?.get('right');
    if (rightParam) {
      parsed.right = decodeURIComponent(rightParam);
    }

    // Parse filter preset name
    const filterParam = searchParams?.get('filter');
    if (filterParam) {
      parsed.filter = decodeURIComponent(filterParam);
    }

    // Parse metric
    const metricParam = searchParams?.get('metric');
    if (metricParam) {
      parsed.metric = decodeURIComponent(metricParam);
    }

    // Parse view type
    const viewParam = searchParams?.get('view');
    if (viewParam && isValidView(viewParam)) {
      parsed.view = viewParam as ToolUrlParams['view'];
    }

    // Parse turfs (comma-separated) - P1-14
    const turfsParam = searchParams?.get('turfs');
    if (turfsParam) {
      parsed.turfs = turfsParam.split(',').filter(Boolean);
    }

    // Parse volunteers (number) - P1-14
    const volunteersParam = searchParams?.get('volunteers');
    if (volunteersParam) {
      const num = parseInt(volunteersParam, 10);
      if (!isNaN(num)) {
        parsed.volunteers = num;
      }
    }

    // Parse year (number) - P1-14
    const yearParam = searchParams?.get('year');
    if (yearParam) {
      const num = parseInt(yearParam, 10);
      if (!isNaN(num)) {
        parsed.year = num;
      }
    }

    // Parse month (number) - P1-14
    const monthParam = searchParams?.get('month');
    if (monthParam) {
      const num = parseInt(monthParam, 10);
      if (!isNaN(num)) {
        parsed.month = num;
      }
    }

    // P1-16: SessionStorage fallback - if no URL params, check sessionStorage
    if (Object.keys(parsed).length === 0 && typeof window !== 'undefined') {
      const storedParams = restoreParamsFromSession();
      if (storedParams) {
        return storedParams;
      }
    }

    return parsed;
  }, [searchParams]);

  // ============================================================================
  // Update URL Parameters
  // ============================================================================

  /**
   * Apply new URL parameters (merges with existing)
   */
  const applyParams = useCallback(
    (newParams: Partial<ToolUrlParams>) => {
      if (!pathname) return;

      const current = new URLSearchParams(searchParams?.toString() || '');

      // Update parameters
      Object.entries(newParams).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          // Remove param if value is undefined/null
          current.delete(key);
        } else if (Array.isArray(value)) {
          // Join arrays with commas
          if (value.length > 0) {
            current.set(key, value.join(','));
          } else {
            current.delete(key);
          }
        } else {
          // Set string values (URL encode)
          current.set(key, encodeURIComponent(String(value)));
        }
      });

      // Build new URL
      const newUrl = pathname ? `${pathname}?${current.toString()}` : `?${current.toString()}`;

      // P1-16: Persist to sessionStorage for restoration on next visit
      if (typeof window !== 'undefined') {
        storeParamsToSession(newParams, pathname);
      }

      // Update without reload
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  /**
   * Clear all URL parameters
   */
  const clearParams = useCallback(() => {
    if (pathname) {
      router.replace(pathname, { scroll: false });
    }
  }, [pathname, router]);

  /**
   * Clear specific parameters
   */
  const clearSpecificParams = useCallback(
    (keys: (keyof ToolUrlParams)[]) => {
      if (!pathname) return;

      const current = new URLSearchParams(searchParams?.toString() || '');

      keys.forEach(key => {
        current.delete(key);
      });

      const newUrl = current.toString()
        ? `${pathname}?${current.toString()}`
        : pathname;

      router.replace(newUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return {
    params,
    applyParams,
    clearParams,
    clearSpecificParams,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate view parameter
 */
function isValidView(view: string): boolean {
  const validViews = ['zip', 'timeSeries', 'occupations', 'committees', 'ies', 'lapsed', 'upgrade'];
  return validViews.includes(view);
}

/**
 * Check if params object is empty
 */
export function hasUrlParams(params: ToolUrlParams): boolean {
  return Object.keys(params).length > 0;
}

/**
 * Build a query string from params
 */
export function buildQueryString(params: Partial<ToolUrlParams>): string {
  const entries: string[] = [];

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value) && value.length > 0) {
        entries.push(`${key}=${value.join(',')}`);
      } else if (!Array.isArray(value)) {
        entries.push(`${key}=${encodeURIComponent(String(value))}`);
      }
    }
  });

  return entries.length > 0 ? `?${entries.join('&')}` : '';
}

// ============================================================================
// SessionStorage Utilities (P1-16)
// ============================================================================

const SESSION_STORAGE_KEY = 'pol_tool_url_params';
const SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours

interface StoredParams {
  params: ToolUrlParams;
  pathname: string;
  timestamp: number;
}

/**
 * Store URL params to sessionStorage with TTL
 */
function storeParamsToSession(params: Partial<ToolUrlParams>, pathname: string): void {
  try {
    const stored: StoredParams = {
      params: params as ToolUrlParams,
      pathname,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.warn('[useToolUrlParams] Failed to store params to session:', error);
  }
}

/**
 * Restore URL params from sessionStorage (with TTL check)
 */
function restoreParamsFromSession(): ToolUrlParams | null {
  try {
    const storedStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!storedStr) return null;

    const stored: StoredParams = JSON.parse(storedStr);

    // Check TTL (2 hour freshness)
    const age = Date.now() - stored.timestamp;
    if (age > SESSION_TTL) {
      // Expired, clear it
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    // Check pathname matches current pathname
    if (typeof window !== 'undefined' && stored.pathname !== window.location.pathname) {
      return null;
    }

    return stored.params;
  } catch (error) {
    console.warn('[useToolUrlParams] Failed to restore params from session:', error);
    return null;
  }
}

/**
 * Extract tool type from pathname
 */
function extractToolFromPath(pathname: string): 'political-ai' | 'segments' | 'donors' | 'canvass' | 'compare' | 'settings' | 'knowledge-graph' | null {
  const validTools = ['political-ai', 'segments', 'donors', 'canvass', 'compare', 'settings', 'knowledge-graph'];
  const cleanPath = pathname.startsWith('/') ? pathname.substring(1) : pathname;

  if (validTools.includes(cleanPath)) {
    return cleanPath as any;
  }

  return null;
}
