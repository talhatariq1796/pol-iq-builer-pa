'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Filter components
import { DemographicFilters } from '@/components/segmentation/filters/DemographicFilters';
import { PoliticalFilters } from '@/components/segmentation/filters/PoliticalFilters';
import { TargetingFilters } from '@/components/segmentation/filters/TargetingFilters';
import { EngagementFilters } from '@/components/segmentation/filters/EngagementFilters';
import { ElectoralFilters } from '@/components/segmentation/filters/ElectoralFilters';
import { ElectionHistoryFilters } from '@/components/segmentation/filters/ElectionHistoryFilters';
import { TapestryFilters } from '@/components/segmentation/filters/TapestryFilters';

// Results and saved segments
import { SegmentResults } from '@/components/segmentation/SegmentResults';
import { SavedSegmentsList } from '@/components/segmentation/SavedSegmentsList';
import { ExportDialog } from '@/components/segmentation/ExportDialog';

// Core lib
import {
  SegmentEngine,
  segmentStore,
  getAllPresets,
  getPreset,
} from '@/lib/segmentation';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import type {
  SegmentFilters,
  SegmentResults as SegmentResultsType,
  SegmentDefinition,
  PrecinctData,
  DemographicFilters as DemographicFiltersType,
  PoliticalFilters as PoliticalFiltersType,
  TargetingFilters as TargetingFiltersType,
  EngagementFilters as EngagementFiltersType,
  ElectoralFilters as ElectoralFiltersType,
  ElectionHistoryFilters as ElectionHistoryFiltersType,
  TapestryFilters as TapestryFiltersType,
  ExtendedSegmentFilters,
} from '@/lib/segmentation/types';

// Icons
import { Download, Save, FolderOpen, Filter, Map, Trash2, Search, Target, Loader2, Undo, Redo } from 'lucide-react';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';

// Router for navigation
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// NOTE: AIToolAssistant removed - UnifiedAIAssistant is now rendered at page level (app/segments/page.tsx)
// This prevents duplicate AI chat interfaces on the same page

// State Management - Wave 6A: Component Sync
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import type { MapCommand } from '@/lib/ai-native/types';
import { useToast } from '@/hooks/use-toast';
import { CrossToolNavigator } from '@/lib/ai-native/navigation/CrossToolNavigator';

// Wave 4A: Undo/Redo
import { getFilterHistoryManager, type HistoryPosition } from '@/lib/segmentation/FilterHistoryManager';

interface SegmentBuilderProps {
  /** Optional preset ID to load on mount (from quick-start buttons) */
  initialPresetId?: string | null;
  /** Optional callback to sync map with segment results (auto-highlight precincts) */
  onMapCommand?: (command: MapCommand) => void;
}

/**
 * Main SegmentBuilder component
 * Orchestrates voter segmentation with filters, results, and persistence
 */
export function SegmentBuilder({ initialPresetId, onMapCommand }: SegmentBuilderProps) {
  // Router for navigation
  const router = useRouter();
  const { toast } = useToast();

  // State: Filters (using ExtendedSegmentFilters for new filter types)
  const [filters, setFilters] = useState<ExtendedSegmentFilters>({});

  // State: Results
  const [results, setResults] = useState<SegmentResultsType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // State: Saved segments
  const [savedSegments, setSavedSegments] = useState<SegmentDefinition[]>([]);

  // State: UI
  const [activeTab, setActiveTab] = useState<string>('demographic');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [filterUpdatePending, setFilterUpdatePending] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState<string | null>(null);

  // Wave 4A: Undo/Redo state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyPosition, setHistoryPosition] = useState<HistoryPosition | null>(null);
  const historyManager = useRef(getFilterHistoryManager());

  // State: Save dialog
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [segmentDescription, setSegmentDescription] = useState('');

  // State: Confirmation dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogAction, setConfirmDialogAction] = useState<(() => void) | null>(null);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');

  // State: Export dialog
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // State: Engine and data
  const [engine, setEngine] = useState<SegmentEngine | null>(null);
  const [precincts, setPrecincts] = useState<PrecinctData[]>([]);

  // Wave 6A: Ref for debounce timer to fix race condition (Issue 6A.6)
  const queryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load precincts and initialize engine on mount
  useEffect(() => {
    loadPrecincts();
    loadSavedSegments();
  }, []);

  // Apply initial preset if provided (from quick-start buttons)
  useEffect(() => {
    if (initialPresetId && engine) {
      const preset = getPreset(initialPresetId);
      if (preset) {
        console.log('[SegmentBuilder] Applying initial preset:', preset.name);
        const convertedFilters = convertPresetToComponentFormat(preset.filters);
        setFilters(convertedFilters);
        setSelectedPreset(initialPresetId);
        toast({
          title: 'Preset Applied',
          description: `Loaded "${preset.name}" preset`,
        });
      }
    }
  }, [initialPresetId, engine, toast]);

  // Wave 6A: Subscribe to ApplicationStateManager events
  useEffect(() => {
    const stateManager = getStateManager();

    const unsubscribe = stateManager.subscribe((state, event) => {
      switch (event.type) {
        case 'PRECINCT_SELECTED':
          // When user clicks a precinct on map, offer to add it to segment
          console.log('[SegmentBuilder] Precinct selected from map:', event.payload);
          // Could auto-add to segment or show prompt
          break;

        case 'MAP_LAYER_CHANGED':
          // Suggest filters based on the visible metric
          console.log('[SegmentBuilder] Map layer changed:', event.payload);
          break;

        case 'SAVED_SEGMENT_UPDATED':
          // Refresh saved segments list
          loadSavedSegments();
          break;

        case 'SEGMENT_FILTER_CHANGED':
          // Another component changed filters - sync if needed
          // (Only if this component didn't trigger the change)
          break;
      }
    });

    // Set current tool context
    stateManager.dispatch({
      type: 'TOOL_CHANGED',
      payload: { tool: 'segments' },
      timestamp: new Date(),
    });

    return () => {
      unsubscribe();
      // Clear any pending timers on unmount
      if (queryTimerRef.current) {
        clearTimeout(queryTimerRef.current);
      }
    };
  }, []);

  // Wave 4A: Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Z (Mac) or Ctrl+Z (Windows) for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Check for Cmd+Shift+Z (Mac) or Ctrl+Shift+Z (Windows) for redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      // Also support Cmd+Y for redo (Windows convention)
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Wave 4A: Update history state after filter changes
  const updateHistoryState = useCallback(() => {
    setCanUndo(historyManager.current.canUndo());
    setCanRedo(historyManager.current.canRedo());
    setHistoryPosition(historyManager.current.getPositionInfo());
  }, []);

  // Wave 4A: Handle undo
  const handleUndo = useCallback(() => {
    const prevFilters = historyManager.current.undo();
    if (prevFilters) {
      setFilters(prevFilters);
      updateHistoryState();
    }
  }, [updateHistoryState]);

  // Wave 4A: Handle redo
  const handleRedo = useCallback(() => {
    const nextFilters = historyManager.current.redo();
    if (nextFilters) {
      setFilters(nextFilters);
      updateHistoryState();
    }
  }, [updateHistoryState]);

  /**
   * Load precinct data from PoliticalDataService (single source of truth)
   * Uses blob storage for consistent data across all components
   */
  const loadPrecincts = async () => {
    setIsLoading(true);
    try {
      // Use PoliticalDataService for single source of truth (blob storage)
      // The returned format matches what SegmentEngine expects internally
      const precinctData = await politicalDataService.getSegmentEnginePrecincts();
      // Note: We use 'any' here because SegmentEngine has its own internal PrecinctData type
      // that differs from the exported PrecinctData type in types.ts
      setPrecincts(precinctData as unknown as PrecinctData[]);
      setEngine(new SegmentEngine(precinctData as any));
      console.log(`[SegmentBuilder] Loaded ${precinctData.length} precincts from PoliticalDataService`);
    } catch (error) {
      console.error('Error loading precincts:', error);
      // S8-014: Show toast with error details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: 'Error loading precinct data',
        description: `Failed to load precincts: ${errorMessage}. Please check your connection and try refreshing the page.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load saved segments from localStorage
   */
  const loadSavedSegments = () => {
    const saved = segmentStore.getAll();
    setSavedSegments(saved);
  };

  /**
   * Execute segment query with current filters
   * Debounced for real-time updates
   * Wave 6A: Fixed race condition with proper timer cleanup
   */
  const executeQuery = useCallback(() => {
    if (!engine) return;

    setIsLoading(true);
    setFilterUpdatePending(true);

    // Wave 6A.6: Cancel any pending query to prevent race conditions
    if (queryTimerRef.current) {
      clearTimeout(queryTimerRef.current);
    }

    // Add small delay to debounce
    queryTimerRef.current = setTimeout(() => {
      try {
        const queryResults = engine.query(filters);
        setResults(queryResults);

        // Wave 6A.5: Emit state change so AI knows about segment results
        const stateManager = getStateManager();
        const filterCount = Object.keys(filters).filter(k => filters[k as keyof ExtendedSegmentFilters] !== undefined).length;

        stateManager.dispatch({
          type: 'SEGMENT_FILTER_CHANGED',
          payload: {
            filters: filters,
            filterCount: filterCount,
            matchingPrecincts: queryResults.matchingPrecincts?.map(p => p.precinctId) || [],
            matchCount: queryResults.precinctCount || 0,
            totalVoters: queryResults.estimatedVoters || 0,
          },
          timestamp: new Date(),
        });

        // Also log to exploration history for AI context
        stateManager.logExploration({
          tool: 'segments',
          action: 'applied filters',
          result: `${queryResults.precinctCount || 0} precincts matched`,
          metadata: {
            filterCount,
            matchCount: queryResults.precinctCount || 0,
            totalVoters: queryResults.estimatedVoters || 0,
          },
        });

        // P2 Fix: Auto-sync map to segment results - highlight matching precincts
        if (onMapCommand && queryResults.matchingPrecincts?.length > 0) {
          onMapCommand({
            type: 'highlight',
            ids: queryResults.matchingPrecincts.map(p => p.precinctId),
          });
        }
      } catch (error) {
        console.error('Error executing query:', error);
      } finally {
        setIsLoading(false);
        setFilterUpdatePending(false);
      }
    }, 300);
  }, [engine, filters]);

  /**
   * Memoized processing of query results
   * Wave 7/8: Performance optimization - only reprocess when results change
   */
  const processedResults = useMemo(() => {
    if (!results || !results.matchingPrecincts) return null;

    // Extract precinct IDs for quick lookup
    const precinctIds = results.matchingPrecincts.map(p => p.precinctId);

    // Calculate aggregate metrics from matching precincts
    const aggregates = results.matchingPrecincts.reduce((acc, precinct) => {
      acc.totalVoters += precinct.registeredVoters || 0;
      acc.totalSwingPotential += precinct.swingPotential || 0;
      acc.totalGotvPriority += precinct.gotvPriority || 0;
      acc.count += 1;
      return acc;
    }, { totalVoters: 0, totalSwingPotential: 0, totalGotvPriority: 0, count: 0 });

    return {
      ...results,
      precinctIds,
      aggregates: {
        ...aggregates,
        avgSwingPotential: aggregates.count > 0 ? aggregates.totalSwingPotential / aggregates.count : 0,
        avgGotvPriority: aggregates.count > 0 ? aggregates.totalGotvPriority / aggregates.count : 0,
      },
    };
  }, [results]);

  // Execute query when filters change
  useEffect(() => {
    if (engine && Object.keys(filters).length > 0) {
      executeQuery();
    }
  }, [filters, engine, executeQuery]);

  /**
   * Handle filter changes from child components
   * Wave 4A: Push changes to history for undo/redo
   */
  const handleDemographicChange = (demographic: DemographicFiltersType) => {
    setFilters((prev: ExtendedSegmentFilters) => {
      const newFilters = {
        ...prev,
        demographics: Object.keys(demographic).length > 0 ? demographic : undefined,
        demographic: Object.keys(demographic).length > 0 ? demographic : undefined,
      };
      // Push to history for undo/redo
      historyManager.current.push(newFilters);
      updateHistoryState();
      return newFilters;
    });
  };

  const handlePoliticalChange = (political: PoliticalFiltersType) => {
    setFilters((prev: ExtendedSegmentFilters) => {
      const newFilters = {
        ...prev,
        political: Object.keys(political).length > 0 ? political : undefined,
      };
      historyManager.current.push(newFilters);
      updateHistoryState();
      return newFilters;
    });
  };

  const handleTargetingChange = (targeting: TargetingFiltersType) => {
    setFilters((prev: ExtendedSegmentFilters) => {
      const newFilters = {
        ...prev,
        targeting: Object.keys(targeting).length > 0 ? targeting : undefined,
      };
      historyManager.current.push(newFilters);
      updateHistoryState();
      return newFilters;
    });
  };

  const handleEngagementChange = (engagement: EngagementFiltersType) => {
    setFilters((prev: ExtendedSegmentFilters) => {
      const newFilters = {
        ...prev,
        engagement: Object.keys(engagement).length > 0 ? engagement : undefined,
      };
      historyManager.current.push(newFilters);
      updateHistoryState();
      return newFilters;
    });
  };

  const handleElectoralChange = (electoral: ElectoralFiltersType) => {
    setFilters((prev: ExtendedSegmentFilters) => {
      const newFilters = {
        ...prev,
        electoral: Object.keys(electoral).length > 0 ? electoral : undefined,
      };
      historyManager.current.push(newFilters);
      updateHistoryState();
      return newFilters;
    });
  };

  const handleElectionHistoryChange = (electionHistory: ElectionHistoryFiltersType) => {
    setFilters((prev: ExtendedSegmentFilters) => {
      const newFilters = {
        ...prev,
        electionHistory: Object.keys(electionHistory).length > 0 ? electionHistory : undefined,
      };
      historyManager.current.push(newFilters);
      updateHistoryState();
      return newFilters;
    });
  };

  const handleTapestryChange = (tapestry: TapestryFiltersType) => {
    setFilters((prev: ExtendedSegmentFilters) => {
      const newFilters = {
        ...prev,
        tapestry: Object.keys(tapestry).length > 0 ? tapestry : undefined,
      };
      historyManager.current.push(newFilters);
      updateHistoryState();
      return newFilters;
    });
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    setFilters({});
    setResults(null);
    setSelectedPreset('');
  };

  /**
   * Load a preset segment
   * Converts preset format (snake_case with min/max) to component format (camelCase ranges)
   */
  const handleLoadPreset = (presetId: string) => {
    if (!presetId) {
      // Clear selection
      setSelectedPreset('');
      return;
    }

    const preset = getPreset(presetId);
    if (preset) {
      const convertedFilters = convertPresetToComponentFormat(preset.filters);
      console.log('[SegmentBuilder] Loading preset:', presetId, 'Converted filters:', convertedFilters);
      setFilters(convertedFilters);
      setSelectedPreset(presetId);
      setSegmentName('');
      setSegmentDescription('');
    }
  };

  /**
   * Convert preset filter format to component filter format
   * - Presets use: partisan_lean_range: { min, max }, min_persuasion, min_gotv_priority
   * - Components expect: partisanLeanRange: [min, max], persuasionRange: [min, max], gotvPriorityRange: [min, max]
   */
  const convertPresetToComponentFormat = (filters: SegmentFilters): SegmentFilters => {
    const converted: SegmentFilters = {};

    // Handle demographic filters (presets use 'demographic', SegmentEngine expects 'demographics')
    const demographicSource = filters.demographic || filters.demographics;
    if (demographicSource) {
      converted.demographics = {};

      // Convert age_range to ageRange
      if (demographicSource.age_range) {
        const min = demographicSource.age_range.min_median_age ?? 0;
        const max = demographicSource.age_range.max_median_age ?? 100;
        converted.demographics!.ageRange = [min, max];
      }

      // Convert income_range to incomeRange
      if (demographicSource.income_range) {
        const min = demographicSource.income_range.min_median_hhi ?? 0;
        const max = demographicSource.income_range.max_median_hhi ?? 200000;
        converted.demographics!.incomeRange = [min, max];
      }

      // Convert diversity min/max to diversityRange
      if (demographicSource.min_diversity_index !== undefined || demographicSource.max_diversity_index !== undefined) {
        const min = demographicSource.min_diversity_index ?? 0;
        const max = demographicSource.max_diversity_index ?? 100;
        converted.demographics!.diversityRange = [min, max];
      }

      // Copy other demographic filters that don't need conversion
      if (demographicSource) {
        Object.keys(demographicSource).forEach((key) => {
          if (!['age_range', 'income_range', 'min_diversity_index', 'max_diversity_index'].includes(key)) {
            // Handle density_type -> density array conversion
            if (key === 'density_type') {
              converted.demographics!.density = [demographicSource[key] as 'urban' | 'suburban' | 'rural'];
            } else if (key === 'income_level') {
              // Income level is handled separately, but we can keep it for compatibility
              (converted.demographics as any)[key] = (demographicSource as any)[key];
            } else if (key === 'min_college_pct') {
              converted.demographics!.minCollegePct = demographicSource.min_college_pct;
            } else {
              (converted.demographics as any)[key] = (demographicSource as any)[key];
            }
          }
        });
      }
    }

    // Handle political filters
    if (filters.political) {
      converted.political = {};

      // Convert partisan_lean_range to partisanLeanRange
      if (filters.political.partisan_lean_range) {
        const min = filters.political.partisan_lean_range.min ?? -50;
        const max = filters.political.partisan_lean_range.max ?? 50;
        converted.political.partisanLeanRange = [min, max];
        // Remove old format
        delete (converted.political as any).partisan_lean_range;
      }

      // Copy other political filters, converting preset format to component format
      Object.keys(filters.political).forEach((key) => {
        if (key !== 'partisan_lean_range') {
          // Convert 'outlook' (preset) to 'politicalOutlook' (component)
          if (key === 'outlook') {
            converted.political!.politicalOutlook = (filters.political as any)[key];
          } else {
            (converted.political as any)[key] = (filters.political as any)[key];
          }
        }
      });
    }

    // Handle targeting filters
    if (filters.targeting) {
      converted.targeting = {};

      // Convert min_gotv_priority/max to gotvPriorityRange
      if (filters.targeting.min_gotv_priority !== undefined || filters.targeting.max_gotv_priority !== undefined) {
        const min = filters.targeting.min_gotv_priority ?? 0;
        const max = filters.targeting.max_gotv_priority ?? 100;
        converted.targeting.gotvPriorityRange = [min, max];
        // Remove old format
        delete (converted.targeting as any).min_gotv_priority;
        delete (converted.targeting as any).max_gotv_priority;
      }

      // Convert min_persuasion/max to persuasionRange
      if (filters.targeting.min_persuasion !== undefined || filters.targeting.max_persuasion !== undefined) {
        const min = filters.targeting.min_persuasion ?? 0;
        const max = filters.targeting.max_persuasion ?? 100;
        converted.targeting.persuasionRange = [min, max];
        // Remove old format
        delete (converted.targeting as any).min_persuasion;
        delete (converted.targeting as any).max_persuasion;
      }

      // Convert min_swing_potential/max to swingPotentialRange
      if (filters.targeting.min_swing_potential !== undefined || filters.targeting.max_swing_potential !== undefined) {
        const min = filters.targeting.min_swing_potential ?? 0;
        const max = filters.targeting.max_swing_potential ?? 100;
        converted.targeting.swingPotentialRange = [min, max];
        // Remove old format
        delete (converted.targeting as any).min_swing_potential;
        delete (converted.targeting as any).max_swing_potential;
      }

      // Convert min_turnout/max to turnoutRange
      if (filters.targeting.min_turnout !== undefined || filters.targeting.max_turnout !== undefined) {
        const min = filters.targeting.min_turnout ?? 0;
        const max = filters.targeting.max_turnout ?? 100;
        converted.targeting.turnoutRange = [min, max];
        // Remove old format
        delete (converted.targeting as any).min_turnout;
        delete (converted.targeting as any).max_turnout;
      }

      // Copy other targeting filters (including targeting_strategy)
      Object.keys(filters.targeting).forEach((key) => {
        if (!['min_gotv_priority', 'max_gotv_priority', 'min_persuasion', 'max_persuasion',
          'min_swing_potential', 'max_swing_potential', 'min_turnout', 'max_turnout'].includes(key)) {
          (converted.targeting as any)[key] = (filters.targeting as any)[key];

          // SegmentEngine expects targeting_strategy at top level, so also set it there
          if (key === 'targeting_strategy') {
            (converted as any).targeting_strategy = (filters.targeting as any)[key];
            (converted as any).strategy = (filters.targeting as any)[key];
          }
        }
      });
    }

    // Handle engagement filters (mostly already compatible)
    if (filters.engagement) {
      converted.engagement = { ...filters.engagement };
    }

    return converted;
  };

  /**
   * Load a saved segment
   */
  const handleLoadSavedSegment = (segment: SegmentDefinition) => {
    setFilters(segment.filters);
    setSegmentName(segment.name);
    setSegmentDescription(segment.description || '');
    setSelectedPreset('');
  };

  /**
   * Save current segment
   */
  const handleSaveSegment = () => {
    if (!segmentName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a segment name',
        variant: 'destructive',
      });
      return;
    }

    // Check if name exists
    if (segmentStore.nameExists(segmentName)) {
      setConfirmDialogMessage(`A segment with the name "${segmentName}" already exists. Overwrite?`);
      setConfirmDialogAction(() => () => doSaveSegment());
      setConfirmDialogOpen(true);
      return;
    }

    doSaveSegment();
  };

  const doSaveSegment = () => {
    const segment: SegmentDefinition = {
      id: `custom-${Date.now()}`,
      name: segmentName,
      description: segmentDescription || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      filters,
      cachedResults: results || undefined,
    };

    try {
      segmentStore.save(segment);
      loadSavedSegments();
      setIsSaveDialogOpen(false);
      setSegmentName('');
      setSegmentDescription('');

      // Wave 6A.5: Emit SEGMENT_SAVED event for AI context
      const stateManager = getStateManager();
      stateManager.dispatch({
        type: 'SEGMENT_SAVED',
        payload: {
          segmentId: segment.id,
          segmentName: segment.name,
          matchingPrecincts: results?.matchingPrecincts?.map(p => p.precinctId) || [],
          precinctCount: results?.precinctCount || 0,
        },
        timestamp: new Date(),
      });

      // Log to exploration history
      stateManager.logExploration({
        tool: 'segments',
        action: 'saved segment',
        result: `Saved "${segment.name}" with ${results?.precinctCount || 0} precincts`,
        metadata: { segmentId: segment.id, segmentName: segment.name },
      });

      // Wave 6C: Show toast instead of alert (better UX)
      toast({
        title: 'Segment saved',
        description: `"${segment.name}" saved with ${results?.precinctCount || 0} precincts`,
        duration: 5000,
      });

      // Show "Recently saved" indicator for 5 seconds
      setRecentlySaved(segment.name);
      setTimeout(() => setRecentlySaved(null), 5000);
    } catch (error) {
      console.error('Error saving segment:', error);
      toast({
        title: 'Failed to save segment',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  /**
   * Delete a saved segment
   */
  const handleDeleteSegment = (id: string) => {
    setConfirmDialogMessage('Are you sure you want to delete this segment?');
    setConfirmDialogAction(() => () => {
      try {
        segmentStore.delete(id);
        loadSavedSegments();
        toast({
          title: 'Segment Deleted',
          description: 'The segment has been removed',
        });
      } catch (error) {
        console.error('Error deleting segment:', error);
        toast({
          title: 'Delete Failed',
          description: 'Failed to delete segment',
          variant: 'destructive',
        });
      }
    });
    setConfirmDialogOpen(true);
  };

  /**
   * Export results to CSV
   * Wave 6A: Added state emission and toast feedback
   */
  const handleExportCSV = () => {
    if (!results) return;

    try {
      const csv = segmentStore.exportToCSV(results);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `segment-${Date.now()}.csv`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Wave 6A.5: Log export to AI context
      const stateManager = getStateManager();
      stateManager.logExploration({
        tool: 'segments',
        action: 'exported segment',
        result: `Exported ${results.precinctCount} precincts to CSV`,
        metadata: { filename, precinctCount: results.precinctCount },
      });

      // Show success toast
      toast({
        title: 'Export complete',
        description: `Downloaded ${results.precinctCount} precincts as CSV`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: 'Export failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  /**
   * Show on map - Navigate to political-ai with segment context
   */
  const handleShowOnMap = () => {
    if (!results || results.precinctCount === 0) {
      return;
    }

    // Prepare precinct IDs for URL params
    const precinctIds = results.matchingPrecincts.map(p => p.precinctId);

    // Create URL params with segment data
    const params = new URLSearchParams({
      mode: 'segment',
      precinctIds: precinctIds.join(','),
      count: results.precinctCount.toString(),
    });

    // Navigate to political-ai with segment filter using context-preserving navigation
    CrossToolNavigator.navigateWithContext('political-ai', {
      precincts: precinctIds,
    });
  };

  // Preset options
  const presetOptions = useMemo(() => getAllPresets(), []);

  // Filter count
  const filterCount = useMemo(() => {
    let count = 0;
    if (filters.demographics || filters.demographic) count++;
    if (filters.political) count++;
    if (filters.targeting) count++;
    if (filters.engagement) count++;
    if (filters.electoral) count++;
    if (filters.electionHistory) count++;
    if (filters.tapestry) count++;
    return count;
  }, [filters]);

  return (
    <div className="w-full h-full flex gap-4 p-4 relative">
      {/* Left Panel: Filters */}
      <Card className="w-1/3 flex flex-col  p-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Voter Segmentation
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {/* Wave 4A: Undo/Redo buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Cmd+Z)"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo className="h-4 w-4" />
            </Button>
            {/* History position indicator */}
            {historyPosition && historyPosition.total > 1 && (
              <span className="text-xs text-muted-foreground px-1">
                {historyPosition.label}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              disabled={filterCount === 0}
            >
              <Trash2 className="h-4 w-4 " />
              Clear
            </Button>
          </div>

          {/* Preset Selector */}
          <div className="mt-4">
            <Label>Load Preset</Label>
            <Select value={selectedPreset} onValueChange={handleLoadPreset}>
              <SelectTrigger>
                <SelectValue placeholder="Select a preset..." />
              </SelectTrigger>
              <SelectContent>
                {presetOptions.map(preset => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto">
          {/* Filters Accordion */}
          <Accordion type="multiple" defaultValue={['demographic']} className="w-full">
            <AccordionItem value="demographic">
              <AccordionTrigger>
                Demographics
                {(filters.demographics || filters.demographic) && (
                  <span className="ml-2 text-xs text-muted-foreground">(active)</span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <DemographicFilters
                  filters={filters.demographics || filters.demographic || {}}
                  onChange={handleDemographicChange}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="political">
              <AccordionTrigger>
                Political Profile
                {filters.political && (
                  <span className="ml-2 text-xs text-muted-foreground">(active)</span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <PoliticalFilters
                  filters={filters.political || {}}
                  onChange={handlePoliticalChange}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="targeting">
              <AccordionTrigger>
                Targeting Scores
                {filters.targeting && (
                  <span className="ml-2 text-xs text-muted-foreground">(active)</span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <TargetingFilters
                  filters={filters.targeting || {}}
                  onChange={handleTargetingChange}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="engagement">
              <AccordionTrigger>
                Engagement
                {filters.engagement && (
                  <span className="ml-2 text-xs text-muted-foreground">(active)</span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <EngagementFilters
                  filters={filters.engagement || {}}
                  onChange={handleEngagementChange}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="electoral">
              <AccordionTrigger>
                Electoral Districts
                {filters.electoral && (
                  <span className="ml-2 text-xs text-muted-foreground">(active)</span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <ElectoralFilters
                  filters={filters.electoral || {}}
                  onChange={handleElectoralChange}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="electionHistory">
              <AccordionTrigger>
                Election History
                {filters.electionHistory && (
                  <span className="ml-2 text-xs text-muted-foreground">(active)</span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <ElectionHistoryFilters
                  filters={filters.electionHistory || {}}
                  onChange={handleElectionHistoryChange}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tapestry">
              <AccordionTrigger>
                Tapestry Segments
                {filters.tapestry && (
                  <span className="ml-2 text-xs text-muted-foreground">(active)</span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <TapestryFilters
                  filters={filters.tapestry || {}}
                  onChange={handleTapestryChange}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Action Buttons */}
          <div className="mt-6 space-y-2">
            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" disabled={filterCount === 0}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Segment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Segment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="segment-name">Segment Name *</Label>
                    <Input
                      id="segment-name"
                      value={segmentName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSegmentName(e.target.value)}
                      placeholder="e.g., Metro Swing Voters"
                    />
                  </div>
                  <div>
                    <Label htmlFor="segment-description">Description</Label>
                    <Input
                      id="segment-description"
                      value={segmentDescription}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSegmentDescription(e.target.value)}
                      placeholder="Optional description..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveSegment}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Recently Saved Indicator */}
            {recentlySaved && (
              <div className="flex items-center gap-2 text-sm text-[#33a852] animate-pulse">
                <Save className="h-4 w-4" />
                <span>Saved &quot;{recentlySaved}&quot;</span>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsExportDialogOpen(true)}
              disabled={!results || results.precinctCount === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export...
            </Button>

            {/* <Button
              variant="outline"
              className="w-full"
              onClick={handleShowOnMap}
              disabled={!results || results.precinctCount === 0}
            >
              <Map className="h-4 w-4 mr-2" />
              View on Map
            </Button> */}
          </div>
        </CardContent>
      </Card>

      {/* Right Panel: Results & Saved Segments */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Results */}
        <Card className="flex-1 relative">
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filter update loading overlay */}
            {filterUpdatePending && !isLoading && (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-[#33a852]" />
              </div>
            )}
            {isLoading ? (
              <div className="space-y-6">
                {/* Summary Cards Skeleton */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="rounded-lg shadow-md">
                      <CardHeader className="pb-3">
                        <Skeleton className="h-4 w-24" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-8 w-16 mb-2" />
                        <Skeleton className="h-3 w-20" />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Strategy Breakdown Skeleton */}
                <Card>
                  <CardHeader>
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-6 w-32" />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons Skeleton */}
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                </div>

                {/* Table Skeleton */}
                <Card>
                  <CardHeader>
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      {/* Table Header */}
                      <div className="flex gap-4 p-4 border-b">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      {/* Table Rows */}
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex gap-4 p-4 border-b last:border-b-0">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : results ? (
              results.precinctCount === 0 ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground font-medium">No precincts match your criteria</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your filters may be too restrictive. Try one of these recovery options:
                  </p>
                  <div className="mt-4 space-y-3 w-full max-w-md">
                    {/* Primary actions - most common fixes */}
                    <div className="flex gap-2 flex-wrap justify-center">
                      <Button variant="outline" size="sm" onClick={handleClearFilters}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear All Filters
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Broaden filters by resetting ranges to wider values
                          const broadenedFilters = { ...filters };
                          if (broadenedFilters.targeting) {
                            // Widen targeting ranges to 0-100
                            broadenedFilters.targeting = {
                              ...broadenedFilters.targeting,
                              swingPotentialRange: [0, 100],
                              gotvPriorityRange: [0, 100],
                              persuasionRange: [0, 100],
                              turnoutRange: [0, 100],
                            };
                          }
                          if (broadenedFilters.political) {
                            // Widen partisan lean to full range
                            broadenedFilters.political = {
                              ...broadenedFilters.political,
                              partisanLeanRange: [-50, 50],
                            };
                          }
                          if (broadenedFilters.demographic) {
                            // Widen demographic ranges
                            broadenedFilters.demographic = {
                              ...broadenedFilters.demographic,
                              ageRange: [0, 100],
                              incomeRange: [0, 200000],
                              diversityRange: [0, 100],
                            };
                          }
                          setFilters(broadenedFilters);
                          toast({
                            title: 'Filters Broadened',
                            description: 'Range filters widened to capture more precincts',
                          });
                        }}
                        className="text-[#33a852] border-[#33a852]/30 hover:bg-[#33a852]/10"
                      >
                        <Filter className="h-4 w-4 mr-1" />
                        Broaden Filters
                      </Button>
                    </div>

                    {/* Separator */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-muted-foreground">Or try a preset</span>
                      </div>
                    </div>

                    {/* Preset suggestions */}
                    <div className="flex gap-2 flex-wrap justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadPreset('preset-suburban-swing')}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Swing Voters
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadPreset('preset-base-mobilization')}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        GOTV Targets
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadPreset('preset-college-independents')}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        High Turnout Dems
                      </Button>
                    </div>

                    {/* Additional help */}
                    <div className="text-xs text-center text-muted-foreground pt-2">
                      <p>Need help? The AI assistant can suggest filters based on your goal.</p>
                      <Link
                        href="/political-ai"
                        className="text-[#33a852] hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        <Map className="h-3 w-3" />
                        Explore on map
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <SegmentResults
                  results={results}
                  onShowOnMap={handleShowOnMap}
                  onExportCSV={handleExportCSV}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Apply filters to see matching precincts</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Segments */}
        <Card className="h-64">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Saved Segments
              </div>
              <Link
                href="/settings"
                className="text-xs text-gray-500 hover:text-[#33a852] transition-colors flex items-center gap-1"
                onClick={() => {
                  // Store the category preference for Settings page
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('settings_active_category', 'savedSegments');
                  }
                }}
              >
                Manage →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto h-40">
            <SavedSegmentsList
              segments={savedSegments}
              onLoad={handleLoadSavedSegment}
              onDelete={handleDeleteSegment}
            />
          </CardContent>
        </Card>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        results={results}
        segmentName={segmentName}
      />

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDialogMessage}</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmDialogAction) {
                  confirmDialogAction();
                }
                setConfirmDialogOpen(false);
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NOTE: AI Assistant removed - UnifiedAIAssistant is rendered at page level (app/segments/page.tsx) */}
    </div>
  );
}
