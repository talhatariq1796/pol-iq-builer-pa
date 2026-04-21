'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeftRight,
  X,
  Loader2,
  Building2,
  MapPin,
  GitCompare,
  ArrowRight,
  Save,
} from 'lucide-react';

import { EntitySelector } from './EntitySelector';
import { ComparisonPane } from './ComparisonPane';
import { InsightsSummary } from './InsightsSummary';
import { ComparisonHistory } from './ComparisonHistory';
import { saveComparison, type SavedComparison } from '@/lib/comparison/ComparisonHistoryStore';

// NOTE: AIToolAssistant removed - UnifiedAIAssistant is now rendered at page level (app/compare/page.tsx)
// This prevents duplicate AI chat interfaces on the same page

import {
  BOUNDARY_TYPES,
  getBoundaryTypeInfo,
  type BoundaryType,
  type ComparisonResult,
  type EntityType,
} from '@/lib/comparison';

// Wave 6A: State Management for AI context sync
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { useToast } from '@/hooks/use-toast';
import { CrossToolNavigator } from '@/lib/ai-native/navigation/CrossToolNavigator';

interface ComparisonViewProps {
  className?: string;
}

export function ComparisonView({ className = '' }: ComparisonViewProps) {
  const searchParams = useSearchParams();

  // State
  const [selectedBoundaryType, setSelectedBoundaryType] = useState<BoundaryType>('municipalities');
  const [leftEntityId, setLeftEntityId] = useState<string | null>(null);
  const [rightEntityId, setRightEntityId] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Wave 6A: Toast for feedback
  const { toast } = useToast();

  // Wave 6A: Subscribe to ApplicationStateManager events
  useEffect(() => {
    const stateManager = getStateManager();

    const unsubscribe = stateManager.subscribe((state, event) => {
      switch (event.type) {
        case 'PRECINCT_SELECTED':
          // When user clicks a precinct on map, offer to add to comparison
          console.log('[ComparisonView] Precinct selected:', event.payload);
          break;

        case 'SEGMENT_CREATED':
          // When segment is created, could compare segment vs. other
          console.log('[ComparisonView] Segment created:', event.payload);
          break;

        case 'COMPARISON_ENTITY_SELECTED':
          // Another component selected an entity for comparison
          console.log('[ComparisonView] Entity selected for comparison:', event.payload);
          break;
      }
    });

    // Set current tool context
    stateManager.dispatch({
      type: 'TOOL_CHANGED',
      payload: { tool: 'compare' },
      timestamp: new Date(),
    });

    return () => unsubscribe();
  }, []);

  // Initialize from URL params
  useEffect(() => {
    if (!searchParams) return;

    const left = searchParams.get('left');
    const right = searchParams.get('right');
    const boundaryType = searchParams.get('boundaryType') as BoundaryType | null;

    if (boundaryType && getBoundaryTypeInfo(boundaryType)) {
      setSelectedBoundaryType(boundaryType);
    }
    if (left) setLeftEntityId(left);
    if (right) setRightEntityId(right);
  }, [searchParams]);

  // Update URL when selections change
  useEffect(() => {
    const params = new URLSearchParams();
    if (leftEntityId) params.set('left', leftEntityId);
    if (rightEntityId) params.set('right', rightEntityId);
    params.set('boundaryType', selectedBoundaryType);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [leftEntityId, rightEntityId, selectedBoundaryType]);

  // Load comparison when both entities are selected
  useEffect(() => {
    if (leftEntityId && rightEntityId) {
      loadComparison();
    } else {
      setComparisonResult(null);
    }
  }, [leftEntityId, rightEntityId, selectedBoundaryType]);

  const loadComparison = async () => {
    if (!leftEntityId || !rightEntityId) return;

    setIsLoading(true);
    setComparisonResult(null); // Clear previous results while loading

    try {
      const boundaryInfo = getBoundaryTypeInfo(selectedBoundaryType);
      if (!boundaryInfo) {
        throw new Error('Invalid boundary type');
      }

      const url = `/api/comparison?left=${encodeURIComponent(leftEntityId)}&right=${encodeURIComponent(rightEntityId)}&boundaryType=${selectedBoundaryType}`;

      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load comparison');
      }

      const data = await response.json();
      // Convert timestamp string back to Date
      data.timestamp = new Date(data.timestamp);
      setComparisonResult(data);

      // Wave 6A: Emit comparison loaded event
      const stateManager = getStateManager();
      stateManager.dispatch({
        type: 'COMPARISON_LOADED',
        payload: {
          leftEntityId,
          rightEntityId,
          boundaryType: selectedBoundaryType,
          insights: data.insights?.length || 0,
        },
        timestamp: new Date(),
      });

      // Log exploration for AI context
      stateManager.logExploration({
        tool: 'compare',
        action: 'comparison_loaded',
        result: `Compared ${leftEntityId} vs ${rightEntityId}`,
      });
    } catch (err) {
      console.error('Error loading comparison:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load comparison';
      toast({
        title: 'Comparison Failed',
        description: `Unable to compare selected entities: ${errorMessage}. Please check your selections and try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle entity selection
  const handleLeftSelect = useCallback((entityId: string) => {
    setLeftEntityId(entityId);

    // Wave 6A: Log entity selection
    const stateManager = getStateManager();
    stateManager.logExploration({
      tool: 'compare',
      action: 'left_entity_selected',
      metadata: { entityId },
    });
  }, []);

  const handleRightSelect = useCallback((entityId: string) => {
    setRightEntityId(entityId);

    // Wave 6A: Log entity selection
    const stateManager = getStateManager();
    stateManager.logExploration({
      tool: 'compare',
      action: 'right_entity_selected',
      metadata: { entityId },
    });
  }, []);

  // Swap entities
  const handleSwap = useCallback(() => {
    const tempLeft = leftEntityId;
    setLeftEntityId(rightEntityId);
    setRightEntityId(tempLeft);

    // Wave 6A: Log swap action
    const stateManager = getStateManager();
    stateManager.logExploration({
      tool: 'compare',
      action: 'entities_swapped',
      metadata: { left: rightEntityId, right: tempLeft },
    });
  }, [leftEntityId, rightEntityId]);

  // Clear comparison
  const handleClear = useCallback(() => {
    setLeftEntityId(null);
    setRightEntityId(null);
    setComparisonResult(null);

    // Wave 6A: Emit clear event
    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'COMPARISON_CLEARED',
      payload: {},
      timestamp: new Date(),
    });
  }, []);

  // Save current comparison
  const handleSaveComparison = useCallback(() => {
    const left = comparisonResult?.leftEntity;
    const right = comparisonResult?.rightEntity;

    if (!left || !right) {
      toast({
        title: 'Cannot Save',
        description: 'Please select both entities before saving.',
        variant: 'destructive',
      });
      return;
    }

    try {
      saveComparison(
        left.id,
        right.id,
        left.name,
        right.name,
        selectedBoundaryType
      );

      toast({
        title: 'Comparison Saved',
        description: `Saved comparison: ${left.name} vs ${right.name}`,
      });

      // Log save action for AI context
      const stateManager = getStateManager();
      stateManager.logExploration({
        tool: 'compare',
        action: 'comparison_saved',
        metadata: { leftId: left.id, rightId: right.id },
      });
    } catch (err) {
      console.error('Error saving comparison:', err);
      toast({
        title: 'Save Failed',
        description: 'Failed to save comparison. Please try again.',
        variant: 'destructive',
      });
    }
  }, [comparisonResult, selectedBoundaryType, toast]);

  // Load comparison from history
  const handleLoadComparison = useCallback((comparison: SavedComparison) => {
    // Switch boundary type if needed
    if (comparison.boundaryType !== selectedBoundaryType) {
      setSelectedBoundaryType(comparison.boundaryType as BoundaryType);
    }

    // Set entities
    setLeftEntityId(comparison.leftEntityId);
    setRightEntityId(comparison.rightEntityId);

    toast({
      title: 'Comparison Loaded',
      description: `Loading: ${comparison.leftEntityName} vs ${comparison.rightEntityName}`,
    });

    // Log load action for AI context
    const stateManager = getStateManager();
    stateManager.logExploration({
      tool: 'compare',
      action: 'comparison_loaded_from_history',
      metadata: { comparisonId: comparison.id },
    });
  }, [selectedBoundaryType, toast]);

  // Get current boundary type info
  const currentBoundaryInfo = useMemo(() => {
    return getBoundaryTypeInfo(selectedBoundaryType) || BOUNDARY_TYPES[0];
  }, [selectedBoundaryType]);

  const entityType: EntityType = currentBoundaryInfo.entityType;

  const leftEntity = comparisonResult?.leftEntity ?? null;
  const rightEntity = comparisonResult?.rightEntity ?? null;
  const insights = comparisonResult?.insights ?? [];

  // Handle boundary type change
  const handleBoundaryTypeChange = useCallback((boundaryType: BoundaryType) => {
    const boundaryInfo = getBoundaryTypeInfo(boundaryType);
    if (!boundaryInfo?.available) {
      return; // Don't allow selecting unavailable types
    }
    setSelectedBoundaryType(boundaryType);
    // Reset selections when switching boundary types
    setLeftEntityId(null);
    setRightEntityId(null);
    setComparisonResult(null);
  }, []);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header Controls */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 space-y-4">
        {/* Boundary Type Selector */}
        <div className="max-w-md mx-auto">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Boundary Type
          </label>
          <Select
            value={selectedBoundaryType}
            onValueChange={(value) => handleBoundaryTypeChange(value as BoundaryType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select boundary type" />
            </SelectTrigger>
            <SelectContent>
              {BOUNDARY_TYPES.map((boundaryType) => (
                <SelectItem
                  key={boundaryType.value}
                  value={boundaryType.value}
                  disabled={!boundaryType.available}
                  className={!boundaryType.available ? 'opacity-50' : ''}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                      {boundaryType.entityType === 'precinct' ? (
                        <MapPin className="h-3 w-3" />
                      ) : (
                        <Building2 className="h-3 w-3" />
                      )}
                      {boundaryType.label}
                    </span>
                    {!boundaryType.available && (
                      <span className="text-[10px] text-muted-foreground ml-2">
                        Coming soon
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {currentBoundaryInfo.description}
          </p>
        </div>

        {/* Entity Selectors */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center max-w-4xl mx-auto">
          <EntitySelector
            value={leftEntityId}
            onChange={handleLeftSelect}
            entityType={entityType}
            boundaryType={selectedBoundaryType}
            placeholder={`Select ${currentBoundaryInfo.label.toLowerCase().slice(0, -1)}...`}
          />

          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwap}
              disabled={!leftEntityId || !rightEntityId || isLoading}
              className="h-9 w-9"
              title="Swap entities"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              disabled={!leftEntityId && !rightEntityId}
              className="h-9 w-9"
              title="Clear comparison"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <EntitySelector
            value={rightEntityId}
            onChange={handleRightSelect}
            entityType={entityType}
            boundaryType={selectedBoundaryType}
            placeholder={`Select ${currentBoundaryInfo.label.toLowerCase().slice(0, -1)}...`}
          />
        </div>

        {/* Actions: Save & History */}
        {/* <div className="flex items-center justify-center gap-3 max-w-4xl mx-auto">
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveComparison}
            disabled={!comparisonResult?.leftEntity || !comparisonResult?.rightEntity || isLoading}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Comparison
          </Button>

          <ComparisonHistory
            onLoadComparison={handleLoadComparison}
            currentBoundaryType={selectedBoundaryType}
          />
        </div> */}

        {/* Status */}
        {isLoading && (
          <Alert className="max-w-2xl mx-auto">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Loading comparison data...</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Comparison Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {!leftEntityId && !rightEntityId ? (
          <Card className="max-w-2xl mx-auto mt-12">
            <div className="text-center py-12 px-6">
              <GitCompare className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
              <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">
                Compare Districts or Precincts
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Select two areas to compare their demographics, voting patterns, and targeting scores side by side.
              </p>

              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="p-2 rounded-full bg-muted">1</div>
                  <span>Select a {currentBoundaryInfo.label.toLowerCase().slice(0, -1)} above</span>
                  <ArrowRight className="h-4 w-4" />
                  <div className="p-2 rounded-full bg-muted">2</div>
                  <span>Select another to compare</span>
                </div>

                <p className="text-sm text-muted-foreground mt-4">
                  Or ask the AI: &quot;Compare East Lansing to Meridian Township&quot;
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Side-by-Side Comparison Panes */}
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {/* Left Pane */}
              {leftEntity ? (
                <ComparisonPane entity={leftEntity} side="left" />
              ) : (
                <Card className="flex items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400 min-h-[200px]">
                  <div>
                    {entityType === 'precinct' ? (
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    ) : (
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    )}
                    <p className="text-sm">Select left {currentBoundaryInfo.label.toLowerCase().slice(0, -1)}</p>
                  </div>
                </Card>
              )}

              {/* Right Pane */}
              {rightEntity ? (
                <ComparisonPane entity={rightEntity} side="right" />
              ) : (
                <Card className="flex items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400 min-h-[200px]">
                  <div>
                    {entityType === 'precinct' ? (
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    ) : (
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    )}
                    <p className="text-sm">Select right {currentBoundaryInfo.label.toLowerCase().slice(0, -1)}</p>
                  </div>
                </Card>
              )}
            </div>

            {/* Insights Summary */}
            {leftEntity && rightEntity && insights.length > 0 && (
              <InsightsSummary
                insights={insights}
                leftName={leftEntity.name}
                rightName={rightEntity.name}
              />
            )}
          </div>
        )}
      </div>

      {/* NOTE: AI Assistant removed - UnifiedAIAssistant is rendered at page level (app/compare/page.tsx) */}
    </div>
  );
}
