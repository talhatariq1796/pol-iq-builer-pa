'use client';

/**
 * SharedMapPanel - Collapsible map panel for tool pages
 *
 * Part of Phase 3: Unified AI-First Architecture
 * Phase 10.1: Enhanced with loading states, transitions, and responsive behavior
 * Wraps PoliticalMapContainer with collapse/expand functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import PoliticalMapContainer from './PoliticalMapContainer';
import MapLoadingSkeleton from '@/components/common/map-loading-skeleton';
import type { MapCommand } from '@/lib/ai-native/types';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { useIsMobile, useIsSmallScreen } from '@/lib/hooks/useMediaQuery';

interface PrecinctInfo {
  precinctId: string;
  precinctName: string;
  county: string;
  attributes?: Record<string, unknown>;
}

interface SharedMapPanelProps {
  /** Map command to execute (from AI or tool actions) */
  mapCommand?: MapCommand | null;
  /** Callback when user selects a precinct */
  onPrecinctSelected?: (precinct: PrecinctInfo | null) => void;
  /** Whether panel is collapsed (controlled) */
  collapsed?: boolean;
  /** Toggle collapse callback (controlled) */
  onToggle?: () => void;
  /** Width when expanded */
  expandedWidth?: string | number;
  /** Panel position */
  position?: 'left' | 'right';
  /** Show layer controls */
  showLayerControls?: boolean;
  /** Show analysis panel inside map */
  showAnalysisPanel?: boolean;
  /** Called when map is ready */
  onMapReady?: () => void;
  /** Default collapsed state (uncontrolled) */
  defaultCollapsed?: boolean;
}

export default function SharedMapPanel({
  mapCommand,
  onPrecinctSelected,
  collapsed: controlledCollapsed,
  onToggle,
  expandedWidth = '75%', // Default to 75% for better usability (was 50%)
  position = 'right',
  showAnalysisPanel = false,
  onMapReady,
  defaultCollapsed = true,
}: SharedMapPanelProps) {
  // Internal collapsed state for uncontrolled mode
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();
  const isSmallScreen = useIsSmallScreen();

  // Command queue to handle commands received before map is ready or while processing
  const [pendingCommands, setPendingCommands] = useState<MapCommand[]>([]);
  const [activeCommand, setActiveCommand] = useState<MapCommand | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine if controlled or uncontrolled
  const isControlled = controlledCollapsed !== undefined;
  const isCollapsed = isControlled ? controlledCollapsed : internalCollapsed;

  // Auto-collapse on mobile by default
  useEffect(() => {
    if (isMobile && !isControlled && !internalCollapsed) {
      setInternalCollapsed(true);
    }
  }, [isMobile, isControlled, internalCollapsed]);

  // Process command queue sequentially to prevent race conditions
  const processCommandQueue = useCallback(async () => {
    if (isProcessing || !isMapReady || pendingCommands.length === 0) {
      return;
    }

    setIsProcessing(true);

    // Process commands sequentially
    while (pendingCommands.length > 0) {
      const command = pendingCommands[0];
      console.log('[SharedMapPanel] Processing command from queue:', command.action || command.type);

      setActiveCommand(command);

      // Wait for command to be processed (500ms per command)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Remove processed command
      setPendingCommands((prev: MapCommand[]) => prev.slice(1));
    }

    setIsProcessing(false);
    setActiveCommand(null);
  }, [isProcessing, isMapReady, pendingCommands]);

  // Queue commands if map not ready or if currently processing
  useEffect(() => {
    if (!mapCommand) return;

    if (!isMapReady || isProcessing) {
      // Queue the command to execute when ready
      setPendingCommands((prev: MapCommand[]) => {
        // Avoid duplicate commands
        const isDuplicate = prev.some(cmd =>
          (cmd.type === mapCommand.type || cmd.action === mapCommand.action) &&
          JSON.stringify(cmd.ids) === JSON.stringify(mapCommand.ids) &&
          JSON.stringify(cmd.center) === JSON.stringify(mapCommand.center)
        );

        if (isDuplicate) {
          console.log('[SharedMapPanel] Skipping duplicate command:', mapCommand.action || mapCommand.type);
          return prev;
        }

        console.log('[SharedMapPanel] Queued command:', mapCommand.action || mapCommand.type);
        return [...prev, mapCommand];
      });
    } else {
      // Map is ready and not processing - add to queue for sequential processing
      setPendingCommands((prev: MapCommand[]) => [...prev, mapCommand]);
      console.log('[SharedMapPanel] Added command to queue:', mapCommand.action || mapCommand.type);
    }
  }, [mapCommand, isMapReady, isProcessing]);

  // Start processing queue when conditions are met
  useEffect(() => {
    if (isMapReady && !isProcessing && pendingCommands.length > 0) {
      console.log('[SharedMapPanel] Starting command queue processing, queue size:', pendingCommands.length);
      processCommandQueue();
    }
  }, [isMapReady, isProcessing, pendingCommands, processCommandQueue]);

  // Handle toggle
  const handleToggle = useCallback(() => {
    if (isControlled && onToggle) {
      onToggle();
    } else {
      setInternalCollapsed((prev: boolean) => !prev);
    }
  }, [isControlled, onToggle]);

  // Handle map ready
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    // Delay to allow smooth fade-in
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
    onMapReady?.();
  }, [onMapReady]);

  // Handle precinct selection and sync with state manager
  const handlePrecinctSelected = useCallback((precinct: PrecinctInfo | null) => {
    const stateManager = getStateManager();

    if (precinct) {
      stateManager.dispatch({
        type: 'PRECINCT_SELECTED',
        payload: {
          precinctId: precinct.precinctId,
          precinctName: precinct.precinctName,
          precinct: precinct.attributes,
        },
        timestamp: new Date(),
      });
    } else {
      stateManager.dispatch({
        type: 'PRECINCT_DESELECTED',
        payload: {},
        timestamp: new Date(),
      });
    }

    onPrecinctSelected?.(precinct);
  }, [onPrecinctSelected]);

  // Sync map state with ApplicationStateManager
  useEffect(() => {
    if (!isMapReady) return;

    const stateManager = getStateManager();
    const unsubscribe = stateManager.subscribe((state, event) => {
      // React to shared map state updates from other components
      if (event.type === 'SHARED_MAP_UPDATED') {
        // Map container will handle this via mapCommand prop
      }
    });

    return unsubscribe;
  }, [isMapReady]);

  // Compute width style
  const widthStyle = typeof expandedWidth === 'number' ? `${expandedWidth}px` : expandedWidth;

  // Use activeCommand from queue (null if not processing)
  const commandToExecute = activeCommand;

  // Position classes
  const positionClasses = position === 'left'
    ? 'left-0 border-r'
    : 'right-0 border-l';

  // Responsive width - full screen on small devices
  const responsiveWidth = isSmallScreen && !isCollapsed ? '100vw' : isMobile && !isCollapsed ? '90%' : widthStyle;

  return (
    <div
      className={`fixed top-0 ${positionClasses} h-full bg-white shadow-xl z-30 transition-all duration-300 ease-in-out ${isSmallScreen && !isCollapsed ? 'left-0 right-0' : ''
        }`}
      style={{ width: isCollapsed ? '40px' : responsiveWidth }}
    >
      {isCollapsed ? (
        // Collapsed state - thin bar
        <button
          onClick={handleToggle}
          className="w-full h-full flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-all duration-200 group"
          title="Show Map"
          aria-label="Expand map panel"
        >
          {/* Map icon */}
          <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#33a852]/10 flex items-center justify-center transition-all duration-200">
            <svg
              className="w-5 h-5 text-gray-500 group-hover:text-[#33a852] transition-all duration-200 group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>

          {/* Vertical text */}
          <span
            className="text-xs font-medium text-gray-500 group-hover:text-[#33a852] transition-colors duration-200"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            MAP
          </span>

          {/* Ready indicator */}
          {isMapReady && !isLoading && (
            <div className="absolute bottom-4 w-2 h-2 rounded-full bg-[#33a852] animate-pulse" />
          )}
        </button>
      ) : (
        // Expanded state - full map
        <div className="relative w-full h-full">
          {/* Collapse button */}
          <button
            onClick={handleToggle}
            className={`absolute top-4 ${position === 'left' ? 'right-4' : 'left-4'} ${isSmallScreen ? 'right-4' : ''
              } z-40 w-8 h-8 rounded-lg bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-all duration-200 hover:scale-110`}
            title="Hide Map"
            aria-label="Collapse map panel"
          >
            <svg
              className={`w-4 h-4 text-gray-600 transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}
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

          {/* Loading skeleton */}
          {isLoading && (
            <div className="absolute inset-0 z-30">
              <MapLoadingSkeleton height="100%" />
            </div>
          )}

          {/* Map container with fade-in */}
          <div className={`w-full h-full transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            <PoliticalMapContainer
              height="100%"
              mapCommand={commandToExecute}
              onPrecinctSelected={handlePrecinctSelected}
              onMapReady={handleMapReady}
              enableAIMode={true}
              hideAnalysisPanel={!showAnalysisPanel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
