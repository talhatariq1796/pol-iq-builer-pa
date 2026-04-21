'use client';

/**
 * CollapsibleAIPanel - Wrapper for AI chat with collapse/expand functionality
 *
 * Part of Phase 2: Unified AI-First Architecture
 * Phase 10.1: Enhanced with responsive behavior and smooth transitions
 * Provides collapsible panel UI with localStorage persistence
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useIsMobile, useIsSmallScreen } from '@/lib/hooks/useMediaQuery';

interface CollapsibleAIPanelProps {
  /** Panel position */
  position?: 'left' | 'right';
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Width when expanded */
  expandedWidth?: string | number;
  /** Width when fully expanded (maximized) */
  fullExpandedWidth?: string | number;
  /** Children - the UnifiedAIAssistant component */
  children: React.ReactNode;
  /** Storage key for persistence */
  storageKey?: string;
  /** Show unread message indicator */
  hasUnread?: boolean;
  /** Callback when panel expands (for clearing unread state) */
  onExpandChange?: (expanded: boolean) => void;
  /** Allow full expansion to maximize view */
  allowFullExpand?: boolean;
}

export default function CollapsibleAIPanel({
  position = 'left',
  defaultCollapsed = false,
  expandedWidth = 400,
  fullExpandedWidth = '60%',
  children,
  storageKey = 'ai-panel-collapsed',
  hasUnread = false,
  onExpandChange,
  allowFullExpand = true,
}: CollapsibleAIPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const isMobile = useIsMobile();
  const isSmallScreen = useIsSmallScreen();

  // Touch gesture state for swipe-down on mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance for gesture to register (in pixels)
  const minSwipeDistance = 100;

  // Load collapsed state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsCollapsed(JSON.parse(stored));
      } else if (isMobile) {
        // Default to collapsed on mobile
        setIsCollapsed(true);
      }
    } catch (error) {
      console.error('[CollapsibleAIPanel] Failed to load state:', error);
    }
    setIsInitialized(true);
  }, [storageKey, isMobile]);

  // Save collapsed state to localStorage
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(isCollapsed));
    } catch (error) {
      console.error('[CollapsibleAIPanel] Failed to save state:', error);
    }
  }, [isCollapsed, storageKey, isInitialized]);

  // Handle toggle collapse/expand
  const handleToggle = useCallback(() => {
    setIsCollapsed((prev: boolean) => {
      const newCollapsed = !prev;
      // Notify parent when expanding (so they can clear unread)
      if (!newCollapsed && onExpandChange) {
        onExpandChange(true);
      }
      // Reset full expansion when collapsing
      if (newCollapsed) {
        setIsFullyExpanded(false);
      }
      return newCollapsed;
    });
  }, [onExpandChange]);

  // Handle toggle full expansion (maximize/minimize)
  const handleToggleFullExpand = useCallback(() => {
    setIsFullyExpanded((prev: boolean) => !prev);
  }, []);

  // Touch gesture handlers for swipe-down on mobile
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distance = touchEnd - touchStart;
    const isSwipeDown = distance > minSwipeDistance;

    if (isSwipeDown) {
      setIsCollapsed(true);
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, minSwipeDistance]);

  // Handle Android back button (popstate)
  useEffect(() => {
    if (!isMobile || isCollapsed) return;

    // Push a history state when panel opens
    window.history.pushState({ aiPanelOpen: true }, '');

    const handlePopState = (event: PopStateEvent) => {
      // When back is pressed, close the panel
      if (!event.state?.aiPanelOpen) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isMobile, isCollapsed]);

  // Handle Escape key to close panel
  useEffect(() => {
    if (isCollapsed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed]);

  // Compute width style based on expansion state
  const normalWidthStyle = typeof expandedWidth === 'number' ? `${expandedWidth}px` : expandedWidth;
  const fullWidthStyle = typeof fullExpandedWidth === 'number' ? `${fullExpandedWidth}px` : fullExpandedWidth;
  const widthStyle = isFullyExpanded ? fullWidthStyle : normalWidthStyle;

  // Position classes
  const positionClasses = position === 'left'
    ? 'left-0 border-r'
    : 'right-0 border-l';

  const toggleButtonPosition = position === 'left'
    ? 'right-0 translate-x-1/2'
    : 'left-0 -translate-x-1/2';

  // Don't render until we've loaded state from localStorage
  if (!isInitialized) {
    return null;
  }

  // Mobile-specific behavior: keep children mounted to preserve state
  // Use visibility/display to hide instead of conditionally rendering
  if (isMobile) {
    return (
      <>
        {/* Mobile collapsed state - floating button */}
        {isCollapsed && (
          <button
            onClick={handleToggle}
            className="fixed bottom-4 right-4 w-14 h-14 bg-gradient-to-br from-[#33a852] to-[#2d9944] text-white rounded-full shadow-lg flex items-center justify-center z-50 hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
            title="Open AI Assistant"
            aria-label="Open AI Assistant"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {/* Unread indicator */}
            {hasUnread && (
              <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-red-500 border-2 border-white animate-pulse" />
            )}
          </button>
        )}

        {/* Mobile expanded state - full-screen overlay
            Always render but hide when collapsed to preserve React state */}
        <div
          className={`fixed inset-0 z-50 bg-white flex flex-col transition-all duration-300 ${
            isCollapsed ? 'opacity-0 pointer-events-none translate-y-full' : 'opacity-100 translate-y-0'
          }`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-hidden={isCollapsed}
        >
          {/* Mobile header with close button and swipe indicator */}
          <div className="flex-shrink-0 flex flex-col border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50">
            {/* Swipe indicator bar */}
            <div className="w-full flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header content */}
            <div className="flex items-center justify-between px-4 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#33a852] to-[#2d9944] flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h2 className="font-semibold text-gray-900">AI Assistant</h2>
              </div>
              <button
                onClick={handleToggle}
                className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                aria-label="Close AI Assistant"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* AI Assistant content - always rendered to preserve state */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </>
    );
  }

  // Desktop/tablet behavior - side panel
  const responsiveWidth = isSmallScreen ? '100%' : widthStyle;

  return (
    <div
      className={`relative h-full flex-shrink-0 bg-white border-gray-200 transition-all duration-300 ease-in-out ${positionClasses}`}
      style={{ width: isCollapsed ? '40px' : responsiveWidth }}
    >
      {isCollapsed ? (
        // Collapsed state - thin bar
        <div className="w-full h-full flex flex-col items-center py-4">
          {/* Expand button */}
          <button
            onClick={handleToggle}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-[#33a852]/10 flex items-center justify-center transition-all duration-200 group"
            title="Show AI Assistant"
            aria-label="Expand AI panel"
          >
            <svg
              className="w-5 h-5 text-gray-500 group-hover:text-[#33a852] transition-colors duration-200 group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>

            {/* Unread indicator */}
            {hasUnread && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#33a852] animate-pulse" />
            )}
          </button>

          {/* Vertical label */}
          <span
            className="mt-4 text-xs font-medium text-gray-400 transition-colors duration-200"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            AI
          </span>
        </div>
      ) : (
        // Expanded state - full panel
        <div className="relative w-full h-full flex flex-col">
          {/* Control buttons container */}
          <div className={`absolute top-4 ${toggleButtonPosition} z-10 flex flex-col gap-2`}>
            {/* Collapse button */}
            <button
              onClick={handleToggle}
              className="w-6 h-6 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all duration-200 hover:scale-110"
              title="Hide AI Assistant"
              aria-label="Collapse AI panel"
            >
              <svg
                className={`w-3 h-3 text-gray-500 transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {position === 'left' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                )}
              </svg>
            </button>

            {/* Maximize/Minimize button */}
            {allowFullExpand && (
              <button
                onClick={handleToggleFullExpand}
                className="w-6 h-6 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all duration-200 hover:scale-110"
                title={isFullyExpanded ? "Minimize chat" : "Maximize chat"}
                aria-label={isFullyExpanded ? "Minimize AI panel" : "Maximize AI panel"}
              >
                {isFullyExpanded ? (
                  // Minimize icon (shrink arrows)
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v5m0-5h5m6 6l5 5m0 0v-5m0 5h-5" />
                  </svg>
                ) : (
                  // Maximize icon (expand arrows)
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {/* AI Assistant content with fade-in */}
          <div className={`flex-1 min-h-0 overflow-hidden transition-opacity duration-300 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
