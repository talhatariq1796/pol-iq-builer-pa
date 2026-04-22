'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { SegmentBuilder } from '@/components/segmentation/SegmentBuilder';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import UnifiedAIAssistant from '@/components/ai-native/UnifiedAIAssistant';
import CollapsibleAIPanel from '@/components/ai-native/CollapsibleAIPanel';
import MapToggleButton from '@/components/map/MapToggleButton';
import { HelpDialog, segmentsHelp, segmentsTutorials } from '@/components/help';
import type { MapCommand } from '@/lib/ai-native/types';
import { useToolUrlParams } from '@/lib/ai-native/hooks/useToolUrlParams';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { segmentStore, getAllPresets } from '@/lib/segmentation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Users, TrendingUp, MapPin } from 'lucide-react';

// Quick-start preset mapping
const QUICK_START_PRESETS = {
  battleground: 'preset-suburban-swing',
  gotv: 'preset-base-mobilization',
  persuasion: 'preset-college-independents',
  donors: 'preset-high-value-donors',
} as const;
import { ErrorBoundary } from '@/components/common/error-boundary';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';

// Dynamic import to prevent SSR issues with ArcGIS/ResizeObserver
const SharedMapPanel = dynamic(
  () => import('@/components/map/SharedMapPanel'),
  { ssr: false }
);

interface PrecinctInfo {
  precinctId: string;
  precinctName: string;
  county: string;
  attributes?: Record<string, unknown>;
}

function SegmentsPageContent() {
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null);
  const [selectedPrecinct, setSelectedPrecinct] = useState<PrecinctInfo | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [initialPresetId, setInitialPresetId] = useState<string | null>(null);
  const { params } = useToolUrlParams();
  const stateManager = getStateManager();
  const breadcrumbs = useBreadcrumbs('segments');

  // Apply URL parameters on mount (enhanced with cross-tool context restoration - Wave 4B #10)
  useEffect(() => {
    // Set current tool
    stateManager.setCurrentTool('segments');

    // Check for cross-tool navigation context from session storage
    const navSource = sessionStorage.getItem('pol_nav_source');
    const navPrecincts = sessionStorage.getItem('pol_nav_precincts');
    const navTimestamp = sessionStorage.getItem('pol_nav_timestamp');

    let precinctsToHighlight: string[] = params.precincts || [];

    // Check if context is fresh (within last 2 hours)
    const isContextFresh = navTimestamp && (Date.now() - parseInt(navTimestamp)) < 2 * 60 * 60 * 1000;

    // If navigated from another tool and context is fresh, restore context
    if (navSource && navPrecincts && isContextFresh && precinctsToHighlight.length === 0) {
      try {
        const storedPrecincts = JSON.parse(navPrecincts);
        if (Array.isArray(storedPrecincts) && storedPrecincts.length > 0) {
          precinctsToHighlight = storedPrecincts;
          console.log(`[SegmentsPage] Restored ${precinctsToHighlight.length} precincts from ${navSource}`);

          // Clear context after successful restoration to prevent stale reuse
          sessionStorage.removeItem('pol_nav_source');
          sessionStorage.removeItem('pol_nav_precincts');
          sessionStorage.removeItem('pol_nav_timestamp');
        }
      } catch (error) {
        console.warn('[SegmentsPage] Failed to parse nav context:', error);
        // Clear corrupted context
        sessionStorage.removeItem('pol_nav_source');
        sessionStorage.removeItem('pol_nav_precincts');
        sessionStorage.removeItem('pol_nav_timestamp');
      }
    }

    // If precincts exist (from URL or session), highlight them on map
    if (precinctsToHighlight.length > 0) {
      setMapCommand({
        type: 'highlight',
        ids: precinctsToHighlight,
      });
      // Don't auto-show map - user must click "Show Map" button
      setHasInteracted(true); // User has context, hide empty state

      // Log exploration
      stateManager.logExploration({
        tool: 'segments',
        action: navSource ? 'cross_tool_navigation' : 'url_navigation',
        precinctIds: precinctsToHighlight,
        metadata: { source: navSource || 'url_params' },
      });
    }

    // P2 Fix: Restore map state from previous tool
    const { CrossToolNavigator } = require('@/lib/ai-native/navigation/CrossToolNavigator');
    const restoredMapState = CrossToolNavigator.restoreMapState();
    if (restoredMapState) {
      CrossToolNavigator.applyRestoredMapState(restoredMapState);
      // If there's a visualization to restore, queue it as a map command
      if (restoredMapState.layer === 'heatmap' && restoredMapState.metric) {
        setMapCommand({
          type: 'showHeatmap',
          metric: restoredMapState.metric,
        });
      } else if (restoredMapState.layer === 'choropleth') {
        setMapCommand({
          type: 'showChoropleth',
        });
      }
    }

    // If segment param exists, load saved segment
    if (params.segment) {
      const savedSegment = segmentStore.getById(params.segment);
      if (savedSegment) {
        // Store segment info in state manager for SegmentBuilder to pick up
        stateManager.dispatch({
          type: 'SEGMENT_LOADED',
          payload: {
            segmentId: savedSegment.id,
            segmentName: savedSegment.name,
            filters: savedSegment.filters,
            matchingPrecincts: savedSegment.cachedResults?.matchingPrecincts?.map(p => p.precinctId) || [],
          },
          timestamp: new Date(),
        });

        // If segment has cached results, queue highlight for when map is shown
        if (savedSegment.cachedResults?.matchingPrecincts?.length) {
          setMapCommand({
            type: 'highlight',
            ids: savedSegment.cachedResults.matchingPrecincts.map(p => p.precinctId),
          });
          // Don't auto-show map - user must click "Show Map" button
        }

        console.log('[SegmentsPage] Loaded segment:', savedSegment.name);
      } else {
        console.warn('[SegmentsPage] Segment not found:', params.segment);
      }
      setHasInteracted(true);
    }

    // If metric param exists, queue heatmap for when map is shown
    if (params.metric) {
      setMapCommand({
        type: 'showHeatmap',
        metric: params.metric,
      });
      // Don't auto-show map - user must click "Show Map" button
      setHasInteracted(true); // User has context, hide empty state
    }
  }, [params.precincts, params.segment, params.metric, stateManager]);

  const handleMapCommand = (command: MapCommand) => {
    setMapCommand(command);
    // Don't auto-show map - user must click "Show Map" button
    // Map commands will be queued and applied when map is shown
  };

  const handlePrecinctSelected = (precinct: PrecinctInfo | null) => {
    setSelectedPrecinct(precinct);
  };

  const handleQuickStart = (presetKey: keyof typeof QUICK_START_PRESETS) => {
    const presetId = QUICK_START_PRESETS[presetKey];
    setInitialPresetId(presetId);
    setHasInteracted(true);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-primary, #f8f8f8)' }}>
      {/* Help Dialog */}
      <HelpDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Voter Segmentation"
        subtitle="Build targeted voter universes"
        sections={segmentsHelp}
        tutorials={segmentsTutorials}
        footerText="Got it, let's build segments!"
        toolContext="segments"
      />

      {/* Navigation Sidebar */}
      <div className="w-14 h-full flex-shrink-0 relative z-50">
        <AppNavigation variant="sidebar" />
      </div>

      {/* AI Panel - Left Side */}
      <CollapsibleAIPanel
        position="left"
        defaultCollapsed={false}
        expandedWidth={400}
        storageKey="segments-ai-panel-collapsed"
      >
        <UnifiedAIAssistant
          toolContext="segments"
          onMapCommand={handleMapCommand}
          selectedPrecinct={selectedPrecinct}
        />
      </CollapsibleAIPanel>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="container mx-auto py-6 px-4">
          {/* <Breadcrumbs items={breadcrumbs} className="mb-4" /> */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Voter Segmentation</h1>
            <p className="text-muted-foreground">
              Build and save voter segments based on demographics, political profile, and targeting criteria
            </p>
          </div>

          {!hasInteracted ? (
            // Empty state with quick-start options
            <Card className="max-w-2xl mx-auto mt-12">
              <CardContent className="text-center py-12 px-6">
                <Target className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
                <h2 className="text-2xl font-semibold mb-3">Build Your First Voter Segment</h2>
                <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                  Create targeted voter universes based on demographics, political profile, and targeting criteria.
                  Start with a common segment or build your own from scratch.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                  <Button
                    variant="outline"
                    className="h-auto py-4 px-6 flex flex-col items-center gap-2"
                    onClick={() => handleQuickStart('battleground')}
                  >
                    <TrendingUp className="h-6 w-6" />
                    <div className="text-sm font-semibold">Battleground Precincts</div>
                    <div className="text-xs text-muted-foreground">Highly competitive areas</div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto py-4 px-6 flex flex-col items-center gap-2"
                    onClick={() => handleQuickStart('gotv')}
                  >
                    <Users className="h-6 w-6" />
                    <div className="text-sm font-semibold">GOTV Mobilization</div>
                    <div className="text-xs text-muted-foreground">Strong base, low turnout</div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto py-4 px-6 flex flex-col items-center gap-2"
                    onClick={() => handleQuickStart('persuasion')}
                  >
                    <MapPin className="h-6 w-6" />
                    <div className="text-sm font-semibold">Suburban Swing Voters</div>
                    <div className="text-xs text-muted-foreground">Moderate persuasion targets</div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto py-4 px-6 flex flex-col items-center gap-2"
                    onClick={() => handleQuickStart('donors')}
                  >
                    <Target className="h-6 w-6" />
                    <div className="text-sm font-semibold">High-Value Donor Areas</div>
                    <div className="text-xs text-muted-foreground">Affluent, engaged donors</div>
                  </Button>
                </div>

                <div className="mt-8 pt-6 border-t">
                  <p className="text-sm text-muted-foreground mb-3">
                    Or ask the AI assistant to help you find the right voters
                  </p>
                  <Button onClick={() => setHasInteracted(true)}>
                    Start Building Custom Segment
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Show the full SegmentBuilder (P2: Pass onMapCommand for auto-sync)
            <SegmentBuilder initialPresetId={initialPresetId} onMapCommand={handleMapCommand} />
          )}
        </div>
      </main>

      {/* Shared Map Panel - Right Side (Always rendered, controlled by collapsed state) */}
      {/* Wave 7: Increased width to 70% for better map usability as reference */}
      <SharedMapPanel
        mapCommand={mapCommand}
        onPrecinctSelected={handlePrecinctSelected}
        position="right"
        expandedWidth="70%"
        collapsed={!showMap}
        onToggle={() => setShowMap(!showMap)}
      />
    </div>
  );
}

export default function SegmentsPage() {
  return (
    <ErrorBoundary fallbackTitle="Segment Builder Error">
      <React.Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      }>
        <SegmentsPageContent />
      </React.Suspense>
    </ErrorBoundary>
  );
}
