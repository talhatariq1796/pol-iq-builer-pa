'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import React from 'react';

const { Suspense } = React;
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight, BarChart3, Maximize2, Minimize2 } from 'lucide-react';
import { AIPoliticalSessionHost, MapCommand } from '@/components/ai-native/AIPoliticalSessionHost';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import { HelpDialog, politicalAIHelp, politicalAITutorials } from '@/components/help';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { registerTourCallbacks, unregisterTourCallbacks } from '@/lib/tour/tourActions';
import type { IQAction } from '@/components/political-analysis/PoliticalAnalysisPanel';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';

// Dynamic import to avoid SSR issues with ArcGIS map
const PoliticalMapContainer = dynamic(
  () => import('@/components/map/PoliticalMapContainer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#33a852] border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading map...</p>
        </div>
      </div>
    ),
  }
);

// Dynamic import for PoliticalAnalysisPanel
const PoliticalAnalysisPanel = dynamic(
  () => import('@/components/political-analysis/PoliticalAnalysisPanel').then(mod => ({ default: mod.PoliticalAnalysisPanel })),
  { ssr: false }
);

interface SelectedPrecinct {
  precinctId: string;
  precinctName: string;
  county: string;
  geometry?: any;
  attributes?: Record<string, any>;
}

/**
 * Loading state for map
 */
function MapLoadingState() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#33a852] border-r-transparent"></div>
        <p className="mt-2 text-gray-600">Loading map...</p>
      </div>
    </div>
  );
}

/**
 * AI-Native Political Analysis Page Content
 * Wrapped in Suspense to handle useSearchParams
 */
function PoliticalAIContent() {
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null);
  const [selectedPrecinct, setSelectedPrecinct] = useState<SelectedPrecinct | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [leftPanelMaximized, setLeftPanelMaximized] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [iqAction, setIQAction] = useState<IQAction | null>(null);
  const iqInvocationSeqRef = useRef(0);
  const [mapView, setMapView] = useState<__esri.MapView | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  /**
   * Handle commands from AI session to control the map
   * Examples:
   * - { type: 'zoom', payload: { level: 12 } }
   * - { type: 'center', payload: { lat: 42.7325, lon: -84.5555 } }
   * - { type: 'highlight', payload: { precinctId: 'INGHAM_P001' } }
   * - { type: 'filter', payload: { swingPotential: { min: 60 } } }
   */
  const handleMapCommand = useCallback((command: MapCommand) => {
    console.log('[PoliticalAIPage] Received map command from AI:', command);
    setMapCommand(command);
    // Clear command after a brief delay to allow map to process
    setTimeout(() => setMapCommand(null), 500); // Increased from 100ms to 500ms
  }, []);

  /**
   * Handle precinct selection from map
   * Passes selected precinct data back to AI session for context-aware responses
   */
  const handlePrecinctSelected = useCallback((precinct: SelectedPrecinct | null) => {
    console.log('[PoliticalAIPage] Precinct selected from map:', precinct);
    setSelectedPrecinct(precinct);
  }, []);

  /**
   * Handle map ready state
   * Used to enable AI commands that require the map to be fully loaded
   */
  const handleMapReady = useCallback((view?: __esri.MapView) => {
    setIsMapReady(true);
    if (view) {
      setMapView(view);
    }
  }, []);

  /**
   * Handle area analysis from IQBuilder
   */
  const handleAreaAnalyzed = useCallback((precinctNames: string[]) => {
    console.log('[PoliticalAIPage] Area analyzed:', precinctNames.length, 'precincts');
  }, []);

  /**
   * Handle clear selection from IQBuilder
   */
  const handleClearSelection = useCallback(() => {
    setSelectedPrecinct(null);
  }, []);

  /**
   * Handle IQ actions from IQBuilder panel
   * These trigger AI context updates and auto-expand AI panel if collapsed
   */
  const handleIQAction = useCallback((action: IQAction) => {
    console.log('[PoliticalAIPage] IQ action from IQBuilder:', action);
    const invocationId = ++iqInvocationSeqRef.current;
    setIQAction({ ...action, invocationId });
    // Auto-expand AI panel when IQ action is triggered
    if (leftPanelCollapsed) {
      setLeftPanelCollapsed(false);
    }
    // Clear after processing
    setTimeout(() => setIQAction(null), 500);
  }, [leftPanelCollapsed]);

  // Store the AI session state setter for tour control
  const aiSessionStateRef = useRef<((state: 'welcome' | 'active' | 'loading') => void) | null>(null);

  /**
   * Handle session state changes from AIPoliticalSessionHost
   * Stores the setter function so tours can control AI panel state
   */
  const handleSessionStateChange = useCallback((
    _state: 'welcome' | 'active' | 'loading',
    setSessionState: (state: 'welcome' | 'active' | 'loading') => void
  ) => {
    aiSessionStateRef.current = setSessionState;
  }, []);

  /**
   * Register tour callbacks so guided tours can control page state
   * This allows tour steps to expand/collapse panels, switch AI modes,
   * send map commands, submit AI queries, and simulate precinct selection.
   */
  useEffect(() => {
    registerTourCallbacks({
      // Panel state
      setLeftPanelCollapsed,
      setRightPanelCollapsed,

      // AI session state
      setSessionState: (state: 'welcome' | 'active' | 'loading') => {
        if (aiSessionStateRef.current) {
          aiSessionStateRef.current(state);
        }
      },
      focusChatInput: () => {
        const input = document.querySelector('[data-tour="ai-chat-panel"] input[name="input"]') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      },

      // Map commands - use the existing handleMapCommand
      sendMapCommand: handleMapCommand,

      // Note: typeInChatInput is now handled directly in tourActions.ts
      // with animated typewriter effect

      // Scroll chat to bottom
      scrollChatToBottom: () => {
        const messagesEnd = document.querySelector('[data-tour="ai-chat-panel"] .messages-end');
        if (messagesEnd) {
          messagesEnd.scrollIntoView({ behavior: 'smooth' });
        }
      },

      // Feature selection - simulate clicking a precinct for tour
      // Loads REAL precinct data so the AI can show proper feature card
      selectPrecinctById: async (precinctId: string) => {
        console.log('[Tour] Selecting precinct:', precinctId);
        try {
          // Load real precinct data from PoliticalDataService
          const precinctData = await politicalDataService.getUnifiedPrecinct(precinctId);
          if (precinctData) {
            // Map UnifiedPrecinct nested structure to flat attributes
            setSelectedPrecinct({
              precinctId: precinctData.id,
              precinctName: precinctData.name,
              county: 'Pennsylvania',
              attributes: {
                registered_voters: precinctData.demographics?.registeredVoters,
                swing_potential: precinctData.electoral?.swingPotential,
                gotv_priority: precinctData.targeting?.gotvPriority,
                persuasion_opportunity: precinctData.targeting?.persuasionOpportunity,
                partisan_lean: precinctData.electoral?.partisanLean,
                avg_turnout: precinctData.electoral?.avgTurnout,
                // Include full nested data for AI context
                demographics: precinctData.demographics,
                electoral: precinctData.electoral,
                targeting: precinctData.targeting,
                political: precinctData.political,
              },
            });
            // Also highlight on map
            handleMapCommand({
              type: 'highlight',
              target: [precinctData.name],
            });
          } else {
            console.warn('[Tour] Precinct not found:', precinctId);
            // Fallback to basic info
            setSelectedPrecinct({
              precinctId,
              precinctName: precinctId,
              county: 'Pennsylvania',
            });
          }
        } catch (error) {
          console.error('[Tour] Error loading precinct data:', error);
          setSelectedPrecinct({
            precinctId,
            precinctName: precinctId,
            county: 'Pennsylvania',
          });
        }
      },
      showFeatureCardForPrecinct: async (precinctId: string) => {
        console.log('[Tour] Showing feature card for precinct:', precinctId);
        try {
          // Load real precinct data from PoliticalDataService
          const precinctData = await politicalDataService.getUnifiedPrecinct(precinctId);
          const stateManager = getStateManager();

          if (precinctData) {
            // Dispatch FEATURE_SELECTED event to show the FeatureCard
            // This is the proper way to trigger the FeatureCard display
            stateManager.dispatch({
              type: 'FEATURE_SELECTED',
              payload: {
                precinctId: precinctData.id,
                precinctName: precinctData.name,
                precinct: {
                  id: precinctData.id,
                  name: precinctData.name,
                  registered_voters: precinctData.demographics?.registeredVoters,
                  swing_potential: precinctData.electoral?.swingPotential,
                  gotv_priority: precinctData.targeting?.gotvPriority,
                  persuasion_opportunity: precinctData.targeting?.persuasionOpportunity,
                  partisan_lean: precinctData.electoral?.partisanLean,
                  avg_turnout: precinctData.electoral?.avgTurnout,
                },
                metrics: {
                  swing_potential: precinctData.electoral?.swingPotential,
                  gotv_priority: precinctData.targeting?.gotvPriority,
                  persuasion_opportunity: precinctData.targeting?.persuasionOpportunity,
                  partisan_lean: precinctData.electoral?.partisanLean,
                },
              },
              timestamp: new Date(),
            });
            console.log('[Tour] FEATURE_SELECTED event dispatched for:', precinctData.name);
          } else {
            console.warn('[Tour] Precinct not found:', precinctId);
            // Dispatch with basic info as fallback
            stateManager.dispatch({
              type: 'FEATURE_SELECTED',
              payload: {
                precinctId,
                precinctName: precinctId,
                precinct: { id: precinctId, name: precinctId },
                metrics: {},
              },
              timestamp: new Date(),
            });
          }
        } catch (error) {
          console.error('[Tour] Error loading precinct data:', error);
          // Don't set selectedPrecinct on error - let the error be visible
        }
      },
    });

    return () => {
      unregisterTourCallbacks();
    };
  }, [handleMapCommand]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-primary, #f8f8f8)' }}>
      {/* Help Dialog */}
      <HelpDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Political Analysis Assistant"
        subtitle="AI-powered electoral analysis"
        sections={politicalAIHelp}
        tutorials={politicalAITutorials}
        footerText="Got it, let's analyze!"
        toolContext="political-ai"
      />

      {/* Navigation Sidebar */}
      <div className="w-14 h-full flex-shrink-0 relative z-50">
        <AppNavigation variant="sidebar" />
      </div>

      {/* Left Panel - AI Conversation Interface */}
      <div
        className={`flex-shrink-0 overflow-hidden flex flex-col shadow-lg transition-all duration-300 ${leftPanelCollapsed ? 'w-10' : leftPanelMaximized ? 'w-[calc(100%-420px)]' : 'w-80'
          }`}
        style={{
          backgroundColor: 'var(--theme-bg-secondary, #ffffff)',
          borderRight: '1px solid var(--theme-border, #e0e0e0)'
        }}
        data-tour="ai-chat-panel"
      >
        {leftPanelCollapsed ? (
          <button
            onClick={() => setLeftPanelCollapsed(false)}
            className="h-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            title="Expand AI panel"
            aria-label="Expand AI panel"
          >
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        ) : (
          <div className="relative h-full flex flex-col">
            {/* Panel control buttons */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
              <button
                onClick={() => setLeftPanelMaximized(!leftPanelMaximized)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title={leftPanelMaximized ? "Restore AI panel" : "Maximize AI panel"}
                aria-label={leftPanelMaximized ? "Restore AI panel" : "Maximize AI panel"}
              >
                {leftPanelMaximized ? (
                  <Minimize2 className="w-4 h-4 text-gray-500" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-gray-500" />
                )}
              </button>
              <button
                onClick={() => {
                  setLeftPanelCollapsed(true);
                  setLeftPanelMaximized(false);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Collapse AI panel"
                aria-label="Collapse AI panel"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <AIPoliticalSessionHost
              onMapCommand={handleMapCommand}
              selectedPrecinct={selectedPrecinct}
              isMapReady={isMapReady}
              iqAction={iqAction}
              onSessionStateChange={handleSessionStateChange}
            />
          </div>
        )}
      </div>

      {/* Center - Political Map */}
      <div className="flex-1 relative" data-tour="map-container">
        <PoliticalMapContainer
          mapCommand={mapCommand}
          onPrecinctSelected={handlePrecinctSelected}
          onMapReady={handleMapReady}
          enableAIMode={true}
          height="100%"
          onIQAction={handleIQAction}
          hideAnalysisPanel={true}
        />
      </div>

      {/* Right Panel - IQBuilder / Analysis Panel */}
      <div
        className={`flex-shrink-0 overflow-hidden flex flex-col shadow-lg transition-all duration-300 ${rightPanelCollapsed ? 'w-10' : 'w-[400px]'
          }`}
        style={{
          backgroundColor: 'var(--theme-bg-secondary, #ffffff)',
          borderLeft: '1px solid var(--theme-border, #e0e0e0)'
        }}
        data-tour="analysis-panel"
      >
        {rightPanelCollapsed ? (
          <button
            onClick={() => setRightPanelCollapsed(false)}
            className="h-full flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
            title="Expand analysis panel"
            aria-label="Expand analysis panel"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500" />
            <BarChart3 className="w-5 h-5 text-gray-500" />
            <span
              className="text-xs font-medium text-gray-500"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              ANALYSIS
            </span>
          </button>
        ) : (
          <div className="relative h-full flex flex-col">
            <button
              onClick={() => setRightPanelCollapsed(true)}
              className="absolute top-3 right-2 z-10 p-1 hover:bg-gray-100 rounded transition-colors"
              title="Collapse analysis panel"
              aria-label="Collapse analysis panel"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
            {mapView ? (
              <PoliticalAnalysisPanel
                view={mapView}
                selectedPrecinct={selectedPrecinct}
                onClearSelection={handleClearSelection}
                onAreaAnalyzed={handleAreaAnalyzed}
                enableAIMode={true}
                onIQAction={handleIQAction}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Waiting for map...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AI-Native Political Analysis Page
 *
 * Provides an AI-first experience for political analysis with:
 * - Left panel: AI conversation interface for natural language queries
 * - Right panel: Interactive political map that responds to AI commands
 *
 * This is separate from the traditional /political GIS-first route.
 *
 * Supports URL parameters:
 * - ?mode=segment&precinctIds=id1,id2,... - Highlights segment precincts on map
 */
export default function PoliticalAIPage() {
  return (
    <ErrorBoundary fallbackTitle="Political Analysis Error">
      <Suspense fallback={<MapLoadingState />}>
        <PoliticalAIContent />
      </Suspense>
    </ErrorBoundary>
  );
}
