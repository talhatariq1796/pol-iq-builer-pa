'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ComparisonPageClient } from './ComparisonPageClient';
import { AppNavigation } from '@/components/navigation';
import UnifiedAIAssistant from '@/components/ai-native/UnifiedAIAssistant';
import CollapsibleAIPanel from '@/components/ai-native/CollapsibleAIPanel';
import MapToggleButton from '@/components/map/MapToggleButton';
import { HelpDialog, compareHelp, compareTutorials } from '@/components/help';
import type { MapCommand } from '@/lib/ai-native/types';
import { useToolUrlParams } from '@/lib/ai-native/hooks/useToolUrlParams';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { ErrorBoundary } from '@/components/common/error-boundary';

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

function ComparisonLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-600 dark:text-gray-400 text-sm">Loading comparison tool...</p>
      </div>
    </div>
  );
}

function ComparePageContent() {
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null);
  const [selectedPrecinct, setSelectedPrecinct] = useState<PrecinctInfo | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { params } = useToolUrlParams();
  const stateManager = getStateManager();

  // Apply URL parameters on mount
  useEffect(() => {
    // Set current tool
    stateManager.setCurrentTool('compare');

    // If left and right params exist, set comparison entities
    if (params.left && params.right) {
      stateManager.updateToolContext('compare', {
        leftEntity: {
          type: 'precinct',
          id: params.left,
          name: params.left,
        },
        rightEntity: {
          type: 'precinct',
          id: params.right,
          name: params.right,
        },
      });

      // Show comparison highlight on map with different colors
      setMapCommand({
        type: 'highlightComparison',
        leftEntityId: params.left,
        rightEntityId: params.right,
      });
      setShowMap(true);

      // Log exploration - viewing comparison from URL
      stateManager.logExploration({
        tool: 'compare',
        action: 'view_comparison_results',
        result: `Viewing ${params.left} vs ${params.right}`,
        metadata: {
          left: params.left,
          right: params.right,
          source: 'url_params',
        },
      });

      console.log('[ComparePage] Setting comparison:', params.left, 'vs', params.right);
    }
  }, [params.left, params.right, stateManager]);

  const handleMapCommand = (command: MapCommand) => {
    setMapCommand(command);
    // Auto-show map when AI issues a comparison command
    if (!showMap && (command.type === 'highlightComparison' || command.leftEntityId || command.rightEntityId)) {
      setShowMap(true);
    }
  };

  const handlePrecinctSelected = (precinct: PrecinctInfo | null) => {
    setSelectedPrecinct(precinct);
  };

  return (
    <div className="fixed inset-0 flex bg-gray-50 dark:bg-gray-900">
      {/* Help Dialog */}
      <HelpDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Comparison Tool"
        subtitle="Side-by-side analysis"
        sections={compareHelp}
        tutorials={compareTutorials}
        footerText="Got it, let's compare!"
        toolContext="compare"
      />

      {/* Left Sidebar Navigation */}
      <div className="w-14 h-full flex-shrink-0 relative z-50">
        <AppNavigation variant="sidebar" />
      </div>

      {/* Collapsible AI Panel */}
      <CollapsibleAIPanel defaultCollapsed={false}>
        <UnifiedAIAssistant
          toolContext="compare"
          onMapCommand={handleMapCommand}
          selectedPrecinct={selectedPrecinct}
        />
      </CollapsibleAIPanel>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Split Screen Comparison
              </h1>
              <p className="text-muted-foreground">
                Compare precincts, municipalities, and districts side-by-side
              </p>
            </div>
          </div>
        </header>

        {/* Comparison View */}
        <main className="flex-1 overflow-auto">
          <React.Suspense fallback={<ComparisonLoading />}>
            <ComparisonPageClient />
          </React.Suspense>
        </main>
      </div>

      {/* Map Panel - Right Side (hidden by default, shows both entities) */}
      {/* Wave 7: Increased width to 60% for better map usability as reference */}
      {showMap && (
        <SharedMapPanel
          mapCommand={mapCommand}
          onPrecinctSelected={handlePrecinctSelected}
          position="right"
          expandedWidth="60%"
          defaultCollapsed={false}
        />
      )}

      {/* Map Toggle Button */}
      <MapToggleButton
        isMapVisible={showMap}
        onToggle={() => setShowMap(!showMap)}
        position="bottom-right"
        hasActiveVisualization={mapCommand !== null && (mapCommand.leftEntityId !== undefined || mapCommand.rightEntityId !== undefined)}
      />
    </div>
  );
}

export default function ComparePage() {
  return (
    <ErrorBoundary fallbackTitle="Comparison Tool Error">
      <React.Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      }>
        <ComparePageContent />
      </React.Suspense>
    </ErrorBoundary>
  );
}
