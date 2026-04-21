'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';

export interface PerformanceMetrics {
  /** AI query response time in ms */
  aiQuery?: number;
  /** Data fetch time in ms */
  dataFetch?: number;
  /** Component render time in ms */
  render?: number;
  /** Total request count */
  requestCount?: number;
}

interface PerformanceIndicatorProps {
  /** Performance metrics to display */
  metrics: PerformanceMetrics;
  /** Whether to show the indicator */
  show?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Performance Indicator Component
 *
 * Displays query performance metrics in a subtle footer bar.
 * Shows warning styling for slow queries (>1000ms).
 */
export function PerformanceIndicator({
  metrics,
  show = true,
  compact = false,
}: PerformanceIndicatorProps) {
  // Don't show if disabled or no metrics
  if (!show || Object.keys(metrics).length === 0) {
    return null;
  }

  // Check for slow metrics (>1000ms)
  const hasSlowMetrics = Object.values(metrics).some(
    val => typeof val === 'number' && val > 1000
  );

  // Format milliseconds with appropriate precision
  const formatMs = (ms: number | undefined): string => {
    if (ms === undefined) return '';
    if (ms < 10) return `${ms.toFixed(1)}ms`;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Get status color
  const getStatusColor = (ms: number | undefined): string => {
    if (ms === undefined) return 'text-gray-400';
    if (ms < 300) return 'text-green-500 dark:text-green-400';
    if (ms < 1000) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-red-500 dark:text-red-400';
  };

  if (compact) {
    // Compact mode: just show total time
    const totalTime = (metrics.aiQuery || 0) + (metrics.dataFetch || 0);
    return (
      <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
        <Activity className="h-3 w-3" />
        <span className={`font-mono ${getStatusColor(totalTime)}`}>
          {formatMs(totalTime)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-1.5 text-xs rounded-md transition-colors ${
        hasSlowMetrics
          ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
          : 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'
      }`}
    >
      {hasSlowMetrics ? (
        <AlertTriangle className="h-3 w-3 text-yellow-500" />
      ) : (
        <Activity className="h-3 w-3" />
      )}

      {metrics.aiQuery !== undefined && (
        <div className="flex items-center gap-1">
          <span className="text-gray-400 dark:text-gray-500">AI:</span>
          <span className={`font-mono ${getStatusColor(metrics.aiQuery)}`}>
            {formatMs(metrics.aiQuery)}
          </span>
        </div>
      )}

      {metrics.dataFetch !== undefined && (
        <div className="flex items-center gap-1">
          <span className="text-gray-400 dark:text-gray-500">Data:</span>
          <span className={`font-mono ${getStatusColor(metrics.dataFetch)}`}>
            {formatMs(metrics.dataFetch)}
          </span>
        </div>
      )}

      {metrics.render !== undefined && (
        <div className="flex items-center gap-1">
          <span className="text-gray-400 dark:text-gray-500">Render:</span>
          <span className={`font-mono ${getStatusColor(metrics.render)}`}>
            {formatMs(metrics.render)}
          </span>
        </div>
      )}

      {metrics.requestCount !== undefined && metrics.requestCount > 0 && (
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <span className="text-gray-400 dark:text-gray-500">Requests:</span>
          <span className="font-mono">{metrics.requestCount}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Performance tracking hook
 * Use this to track timing in components
 */
export function usePerformanceTracking() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const startTimes = useRef<Record<string, number>>({});

  const startTimer = useCallback((key: keyof PerformanceMetrics) => {
    startTimes.current[key] = performance.now();
  }, []);

  const endTimer = useCallback((key: keyof PerformanceMetrics) => {
    const startTime = startTimes.current[key];
    if (startTime) {
      const elapsed = performance.now() - startTime;
      setMetrics((prev: PerformanceMetrics) => ({
        ...prev,
        [key]: elapsed,
      }));
      delete startTimes.current[key];
    }
  }, []);

  const resetMetrics = useCallback(() => {
    setMetrics({});
    startTimes.current = {};
  }, []);

  const incrementRequestCount = useCallback(() => {
    setMetrics((prev: PerformanceMetrics) => ({
      ...prev,
      requestCount: (prev.requestCount || 0) + 1,
    }));
  }, []);

  return {
    metrics,
    startTimer,
    endTimer,
    resetMetrics,
    incrementRequestCount,
  };
}
