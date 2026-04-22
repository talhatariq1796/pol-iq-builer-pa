/**
 * Political Map Container
 *
 * Main map component for political landscape analysis.
 * Integrates:
 * - Precinct choropleth layer (colored by targeting strategy)
 * - H3 heatmap layer (colored by selected metric)
 * - Political analysis panel
 * - Boundary selection tools
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import config from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import { getStateManager, type StateEvent } from '@/lib/ai-native/ApplicationStateManager';
import MapView from '@arcgis/core/views/MapView';
import Zoom from '@arcgis/core/widgets/Zoom';
import Extent from '@arcgis/core/geometry/Extent';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Color from '@arcgis/core/Color';
import { toast } from '@/hooks/use-toast';

import {
  PoliticalAnalysisPanel,
  PrecinctChoroplethLayer,
  PrecinctChoroplethLegend,
  H3HeatmapLayer,
  BoundaryMapLayer,
  BivariateChoroplethLayer,
  BivariateLegend,
  BIVARIATE_PRESETS,
  ProportionalSymbolLayer,
  ProportionalLegend,
  PROPORTIONAL_PRESETS,
  ValueByAlphaLayer,
  ValueByAlphaLegend,
  VALUE_BY_ALPHA_PRESETS,
} from '../political-analysis';
import NumberedMarkerLayer from './NumberedMarkerLayer';
import type { H3Metric, BivariateConfig, ProportionalConfig, ValueByAlphaConfig } from '../political-analysis';
import type { BoundaryLayerType } from '@/types/political';
import type { MapCommand } from '@/lib/ai-native/types';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { resolveHeatmapMetric } from '@/lib/map/heatmapMetrics';
import GeoFileUploader, { type UploadedLayer } from './GeoFileUploader';
import UploadedLayersPanel from './UploadedLayersPanel';
import UploadedLayerRenderer from './UploadedLayerRenderer';
import Polygon from '@arcgis/core/geometry/Polygon';
import { Clock, Play, Pause, ChevronLeft, ChevronRight, SkipBack, SkipForward } from 'lucide-react';

// Import widget styles for zoom control and other ArcGIS widgets
import '../../styles/widget-styles.css';

/** Must match `id` on GeoJSONLayer in PrecinctChoroplethLayer */
const PRECINCT_CHOROPLETH_LAYER_ID = 'pa-precinct-choropleth';

function isPrecinctChoroplethLayer(layer: __esri.Layer): boolean {
  if (layer.id === PRECINCT_CHOROPLETH_LAYER_ID) return true;
  const t = (layer as { title?: string }).title;
  if (typeof t !== 'string') return false;
  return (
    t === 'Precinct Boundaries' ||
    t === 'Precinct Targeting Strategies' ||
    t.startsWith('Election ')
  );
}

/** Prefer the PA precinct choropleth — not the first arbitrary GeoJSON layer on the map */
function getPrecinctChoroplethGeoJsonLayer(map: __esri.Map): __esri.GeoJSONLayer | undefined {
  const byId = map.findLayerById(PRECINCT_CHOROPLETH_LAYER_ID) as __esri.GeoJSONLayer | undefined;
  if (byId && byId.type === 'geojson') return byId;
  return map.allLayers.find(
    (layer: __esri.Layer) => layer.type === 'geojson' && isPrecinctChoroplethLayer(layer)
  ) as __esri.GeoJSONLayer | undefined;
}

/** Map layer stores `precinct_id` as PA UNIQUE_ID (e.g. 037-:-BLOOMSBURG WARD 02); AI lists may show display NAME only */
async function buildPaPrecinctWhereClause(rawLabel: string): Promise<string> {
  await politicalDataService.initialize();
  const trimmed = rawLabel.trim();
  const [canonicalKey, unified] = await Promise.all([
    politicalDataService.resolvePrecinctMapKey(trimmed),
    politicalDataService.getUnifiedPrecinct(trimmed),
  ]);
  const candidates = new Set<string>();
  if (trimmed) candidates.add(trimmed);
  if (canonicalKey) candidates.add(canonicalKey);
  if (unified?.id) candidates.add(unified.id);
  if (unified?.name) candidates.add(unified.name);
  const escapeSql = (s: string) => s.replace(/'/g, "''");
  const parts: string[] = [];
  for (const c of candidates) {
    const e = escapeSql(c);
    parts.push(`precinct_id = '${e}'`, `precinct_name = '${e}'`);
  }
  return parts.join(' OR ');
}

/**
 * Convert GeoJSON geometry to ArcGIS geometry
 */
function geojsonToArcGIS(geojson: GeoJSON.Geometry): __esri.Geometry | null {
  if (!geojson) return null;

  if (geojson.type === 'Polygon') {
    return new Polygon({
      rings: geojson.coordinates as number[][][],
      spatialReference: { wkid: 4326 },
    });
  } else if (geojson.type === 'MultiPolygon') {
    // For MultiPolygon, flatten all rings into a single polygon
    const allRings = (geojson.coordinates as number[][][][]).flat();
    return new Polygon({
      rings: allRings,
      spatialReference: { wkid: 4326 },
    });
  }

  console.warn('[geojsonToArcGIS] Unsupported geometry type:', geojson.type);
  return null;
}

// Ingham County bounds - centered properly on county centroid
// County center is approximately: [-84.38, 42.60] (slightly east of Lansing)
// Zoomed in tight for precinct visibility while covering the county
// Width: 0.40 degree (0.20 each side), Height: 0.18 degree (0.09 each side)
const PENSYLVANIA_EXTENT = {
  xmin: -80.52,
  ymin: 39.72,
  xmax: -74.69,
  ymax: 42.27,
  spatialReference: { wkid: 4326 },
};

// IQ Action types for sync with AI chat
export interface IQAction {
  type: 'quickstart' | 'area-analysis' | 'report-generated';
  action: string;
  invocationId?: number;
  data?: {
    precinctNames?: string[];
    areaName?: string;
    analysisType?: string;
    result?: any;
  };
}

interface PoliticalMapContainerProps {
  height?: number | string;
  basemap?: string;
  center?: [number, number];  // Deprecated: Use extent instead
  zoom?: number;              // Deprecated: Use extent instead
  onPrecinctSelect?: (precinctName: string) => void;
  onAreaAnalysis?: (precinctNames: string[]) => void;
  mapCommand?: MapCommand | null;
  onPrecinctSelected?: (precinct: any) => void;
  onMapReady?: (view?: __esri.MapView) => void;
  enableAIMode?: boolean;
  onIQAction?: (action: IQAction) => void;
  /** Hide the built-in analysis panel (when panel is rendered externally) */
  hideAnalysisPanel?: boolean;
}

interface MapState {
  view: __esri.MapView | null;
  isLoading: boolean;
  error: string | null;
  selectedPrecinct: string | null;
  selectedPrecincts: string[];
}

type LayerType = 'choropleth' | 'h3' | 'bivariate' | 'proportional' | 'valueByAlpha' | 'none';

const PoliticalMapContainer: React.FC<PoliticalMapContainerProps> = ({
  height = '100%',
  basemap = 'gray-vector',
  onPrecinctSelect,
  onAreaAnalysis,
  mapCommand,
  onPrecinctSelected,
  onMapReady,
  enableAIMode = false,
  onIQAction,
  hideAnalysisPanel = false,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mapState, setMapState] = useState<MapState>({
    view: null,
    isLoading: true,
    error: null,
    selectedPrecinct: null,
    selectedPrecincts: [],
  });

  // Layer visibility state - default to 'choropleth' to show precinct boundaries on load
  const [activeLayer, setActiveLayer] = useState<LayerType>('choropleth');
  const [h3Metric, setH3Metric] = useState<H3Metric>('partisan_lean');
  const [h3Opacity, setH3Opacity] = useState(0.6);       // Default 60% opacity
  const [choroplethOpacity, setChoroplethOpacity] = useState(0.6);  // Default 60% opacity
  const [showLabels, setShowLabels] = useState(true);

  // Multi-variable visualization state
  const [bivariateConfig, setBivariateConfig] = useState<BivariateConfig>(BIVARIATE_PRESETS.gotv_targets);
  const [proportionalConfig, setProportionalConfig] = useState<ProportionalConfig>(PROPORTIONAL_PRESETS.voter_population);
  const [valueByAlphaConfig, setValueByAlphaConfig] = useState<ValueByAlphaConfig>(VALUE_BY_ALPHA_PRESETS.partisan_confidence);

  // Analysis panel state - show legend by default since choropleth layer is active
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showLayerControls, setShowLayerControls] = useState(true);

  // Boundary selection state (from analysis panel)
  const [selectedBoundaryType, setSelectedBoundaryType] = useState<BoundaryLayerType | null>(null);
  const [selectedBoundaryIds, setSelectedBoundaryIds] = useState<string[]>([]);
  const [selectedPrecinctForPanel, setSelectedPrecinctForPanel] = useState<any>(null);
  const [selectedH3CellForPanel, setSelectedH3CellForPanel] = useState<any>(null);

  // Uploaded layers state
  const [uploadedLayers, setUploadedLayers] = useState<UploadedLayer[]>([]);
  const [showUploader, setShowUploader] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Basemap selection state
  const [currentBasemap, setCurrentBasemap] = useState(basemap);

  // Temporal/time-series state
  const [isTemporalMode, setIsTemporalMode] = useState(false);
  const [selectedElectionYear, setSelectedElectionYear] = useState<number>(2024);
  const [isPlaying, setIsPlaying] = useState(false);
  const [temporalMetric, setTemporalMetric] = useState<'margin' | 'turnout' | 'demPct'>('margin');
  const availableElectionYears = [2020, 2022, 2024];
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Segment view state (from URL parameters)
  const mode = searchParams?.get('mode');
  const precinctIdsParam = searchParams?.get('precinctIds');

  // Parse precinct IDs from URL
  const segmentPrecinctIds = useMemo(() => {
    if (mode === 'segment' && precinctIdsParam) {
      return precinctIdsParam.split(',').filter(id => id.trim());
    }
    return null;
  }, [mode, precinctIdsParam]);

  // Track if segment highlighting is in progress
  const [isHighlightingSegment, setIsHighlightingSegment] = useState(false);

  // Numbered markers state (synced with ApplicationStateManager for deduplication)
  const [numberedMarkers, setNumberedMarkers] = useState<Array<{
    precinctId: string;
    number: number;
    label?: string;
    coordinates?: [number, number];
  }>>([]);
  const [precinctCentroids, setPrecinctCentroids] = useState<Record<string, [number, number]>>({});

  // Subscribe to marker updates from ApplicationStateManager (Issue #17)
  useEffect(() => {
    const stateManager = getStateManager();

    const unsubscribe = stateManager.subscribe((state, event) => {
      if (event.type === 'NUMBERED_MARKERS_UPDATED' || event.type === 'NUMBERED_MARKERS_CLEARED') {
        // Update local marker state from central state
        const centralMarkers = stateManager.getNumberedMarkers();
        setNumberedMarkers(centralMarkers.map(m => ({
          precinctId: m.precinctId,
          number: m.number,
        })));
      }
    });

    return unsubscribe;
  }, []);

  // Initialize map
  const initializeMap = useCallback(async () => {
    if (!mapRef.current) return;

    try {
      setMapState((prev: MapState) => ({ ...prev, isLoading: true, error: null }));

      // Set ArcGIS API key for basemaps (required for JS API 4.20+)
      const apiKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_ARCGIS_API_KEY : undefined;
      if (apiKey && !config.apiKey) {
        config.apiKey = apiKey;
      }

      // Initialize data service
      await politicalDataService.initialize();

      // Load precinct boundaries and compute centroids
      try {
        const precinctBoundaries = await politicalDataService.loadPrecinctBoundaries();
        const centroids: Record<string, [number, number]> = {};

        precinctBoundaries.features.forEach((feature: any) => {
          const props = feature.properties || {};
          const precinctId = props.UNIQUE_ID || props.precinct_id || props.id || props.PRECINCT_ID;

          if (!precinctId || !feature.geometry) return;
          let ring: number[][];
          if (feature.geometry.type === 'Polygon') {
            ring = feature.geometry.coordinates[0];
          } else if (feature.geometry.type === 'MultiPolygon') {
            ring = feature.geometry.coordinates[0][0];
          } else return;

          if (ring && ring.length > 0) {
            let sumLng = 0;
            let sumLat = 0;
            let count = 0;

            for (const coord of ring) {
              sumLng += coord[0];
              sumLat += coord[1];
              count++;
            }

            centroids[precinctId] = [sumLng / count, sumLat / count];
          }
        });

        setPrecinctCentroids(centroids);
        console.log('[PoliticalMapContainer] Computed centroids for', Object.keys(centroids).length, 'precincts');
      } catch (error) {
        console.error('[PoliticalMapContainer] Error loading precinct centroids:', error);
      }

      // Create map
      const map = new Map({
        basemap: basemap as any,
      });

      // Create extent for Ingham County
      const extent = new Extent(PENSYLVANIA_EXTENT);

      // Create view with padding to account for asymmetric UI panels
      // Layout: Nav (56px) + Left AI panel (320px) = 376px left, Right panel = 400px
      // Difference is 24px, so we add slight left padding to visually center the map
      const view = new MapView({
        container: mapRef.current,
        map: map,
        extent: extent,  // Use extent instead of center/zoom to fit Ingham County
        padding: {
          left: 12,    // Half of panel difference (24px / 2) to center between panels
          right: 12    // Balanced padding for visual centering
        },
        constraints: {
          minZoom: 8,
          maxZoom: 18,
        },
        popup: {
          dockEnabled: true,
          dockOptions: {
            buttonEnabled: false,
            breakpoint: false,
            position: 'bottom-right',
          },
        },
      });

      await view.when();

      // Set highlight options to MPIQ green (matches precinct selection color)
      view.highlightOptions = {
        color: new Color([51, 168, 82, 0.3]),   // #33a852 with 30% opacity
        fillOpacity: 0.3,
        haloColor: new Color([51, 168, 82, 1]), // #33a852 solid
        haloOpacity: 1
      };

      // Add Zoom controls (bottom-right for better UX)
      const zoom = new Zoom({
        view: view
      });
      view.ui.add(zoom, {
        position: 'bottom-right',
        index: 0
      });

      // Log that zoom control was added
      console.log('[PoliticalMapContainer] Zoom widget added to bottom-right');

      setMapState((prev: MapState) => ({
        ...prev,
        view: view,
        isLoading: false,
      }));

      console.log('[PoliticalMapContainer] Map initialized');
    } catch (error) {
      console.error('[PoliticalMapContainer] Map initialization error:', error);
      setMapState((prev: MapState) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize map',
      }));
    }
  }, [basemap]);

  // Initialize map on mount
  useEffect(() => {
    // Use async IIFE to properly await initialization
    (async () => {
      await initializeMap();
    })();

    return () => {
      if (mapState.view) {
        mapState.view.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update basemap when currentBasemap changes
  useEffect(() => {
    if (mapState.view?.map) {
      mapState.view.map.basemap = currentBasemap as any;
      console.log('[PoliticalMapContainer] Basemap changed to:', currentBasemap);
    }
  }, [currentBasemap, mapState.view]);

  // Handle precinct selection from choropleth
  const handlePrecinctClick = useCallback(
    (precinctName: string, data: any) => {
      const precinctInfo = {
        precinctId: data?.id || precinctName,
        precinctName: precinctName,
        county: data?.county || 'Ingham',
        attributes: data,
      };

      setMapState((prev: MapState) => ({
        ...prev,
        selectedPrecinct: precinctName,
        selectedPrecincts: [precinctName],
      }));

      // Update panel state
      setSelectedPrecinctForPanel(precinctInfo);

      if (onPrecinctSelect) {
        onPrecinctSelect(precinctName);
      }

      console.log('[PoliticalMapContainer] Precinct selected:', precinctName, data);
    },
    [onPrecinctSelect]
  );

  // Handle H3 cell click - behaves like precinct click for AI integration
  const handleH3CellClick = useCallback((h3Index: string, data: any) => {
    console.log('[PoliticalMapContainer] H3 cell clicked:', h3Index, data);

    // Create a friendly display name for the H3 cell
    const h3DisplayName = `H3 Cell (${data?.precinct_count || 0} precincts)`;

    // Update panel state for H3 cell display
    setSelectedH3CellForPanel({
      h3Index,
      precincts: data?.precincts || [],
      precinctCount: data?.precinct_count || 0,
      attributes: data,
    });
    // Clear precinct selection when H3 cell is selected
    setSelectedPrecinctForPanel(null);

    // Update map state to reflect H3 selection (similar to precinct behavior)
    setMapState((prev: MapState) => ({
      ...prev,
      selectedPrecinct: h3DisplayName,
      selectedPrecincts: data?.precincts || [],
    }));

    // FEATURE_SELECTED is emitted from AIPoliticalSessionHost when `onPrecinctSelected` updates
    // parent state — avoid calling selectFeature here too or the chat shows duplicate cards.

    // Notify parent via original callback (if any)
    // H3 cells contain multiple precincts, so we pass the first precinct name if available
    if (onPrecinctSelect && data?.precincts && data.precincts.length > 0) {
      onPrecinctSelect(data.precincts[0]);
    }

    // Notify AI mode parent (same as precinct click behavior)
    // Format H3 cell data as a precinct-like object for consistent AI handling
    if (onPrecinctSelected) {
      const h3Info = {
        precinctId: h3Index,
        precinctName: h3DisplayName,
        county: 'Ingham',
        attributes: {
          ...data,
          featureType: 'hexagon',
          h3Index,
          precinct_count: data?.precinct_count,
          precincts: data?.precincts,
          // Include key metrics for AI analysis
          partisan_lean: data?.partisan_lean,
          gotv_priority: data?.gotv_priority,
          persuasion_opportunity: data?.persuasion_opportunity,
          combined_score: data?.combined_score,
          total_population: data?.total_population,
        },
      };
      onPrecinctSelected(h3Info);
    } else {
      const stateManager = getStateManager();
      stateManager.selectFeature({
        id: h3Index,
        name: h3DisplayName,
        featureType: 'hexagon',
        metrics: {
          h3Index,
          partisan_lean: data?.partisan_lean,
          gotv_priority: data?.gotv_priority,
          persuasion_opportunity: data?.persuasion_opportunity,
          combined_score: data?.combined_score,
          total_population: data?.total_population,
          precinct_count: data?.precinct_count,
          value: data?.value,
          metric: data?.metric || h3Metric,
        },
        raw: data,
      });
    }

    console.log('[PoliticalMapContainer] H3 cell selected for AI:', h3DisplayName, data);
  }, [h3Metric, onPrecinctSelect, onPrecinctSelected]);

  // Handle area analysis from panel
  const handleAreaAnalysis = useCallback(
    (precinctNames: string[]) => {
      setMapState((prev: MapState) => ({
        ...prev,
        selectedPrecincts: precinctNames,
      }));

      if (onAreaAnalysis) {
        onAreaAnalysis(precinctNames);
      }
    },
    [onAreaAnalysis]
  );

  // Toggle between layer types and auto-show/hide legend
  const handleLayerToggle = useCallback((layer: LayerType) => {
    setActiveLayer(layer);
    // Auto-show legend when a layer is active, hide when 'none'
    setShowLegend(layer !== 'none');

    // Dispatch to state manager for AI context awareness
    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'MAP_LAYER_CHANGED',
      payload: { layer: layer === 'none' ? 'none' : layer === 'h3' ? 'heatmap' : 'choropleth' },
      timestamp: new Date(),
    });
  }, []);

  // Handle boundary selection from analysis panel
  const handleBoundarySelectionChange = useCallback(async (layerType: BoundaryLayerType | null, selectedIds: string[]) => {
    console.log('[PoliticalMapContainer] handleBoundarySelectionChange:', { layerType, selectedIds });
    setSelectedBoundaryType(layerType);
    setSelectedBoundaryIds(selectedIds);

    // Dispatch to state manager for AI context awareness
    const stateManager = getStateManager();
    if (layerType && selectedIds.length > 0) {
      // Load boundary data to get precinct info
      let precinctIds: string[] = [];
      const aggregatedStats = {};

      try {
        // Get precinct IDs - for boundary selections, use the selected IDs directly
        // Note: For full spatial query (precincts within boundary), would need GIS operation
        if (layerType === 'precinct') {
          precinctIds = selectedIds;
        } else if (layerType === 'h3') {
          precinctIds = [];
        } else {
          // For other boundary types, load precincts and filter by name match if possible
          const precinctData = await politicalDataService.loadPrecinctBoundaries();
          precinctIds = precinctData.features
            .map((f: any) => f.properties?.precinct_id || f.properties?.id || f.properties?.name)
            .filter(Boolean) as string[];
        }
      } catch (error) {
        console.warn('[PoliticalMapContainer] Could not load boundary details:', error);
      }

      stateManager.dispatch({
        type: 'BOUNDARY_SELECTED',
        payload: {
          boundaryType: layerType,
          ids: selectedIds,
          precinctIds,
          stats: aggregatedStats,
        },
        timestamp: new Date(),
      });
    } else {
      stateManager.dispatch({
        type: 'BOUNDARY_DESELECTED',
        payload: {},
        timestamp: new Date(),
      });
    }
  }, [mapState.view]);

  // Toggle layer visibility
  const handleToggleLayerVisibility = useCallback((layerId: string) => {
    setUploadedLayers((prev: UploadedLayer[]) =>
      prev.map((layer: UploadedLayer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  }, []);

  // Remove layer
  const handleRemoveLayer = useCallback((layerId: string) => {
    setUploadedLayers((prev: UploadedLayer[]) => prev.filter((layer: UploadedLayer) => layer.id !== layerId));
  }, []);

  /**
   * Comparison highlight options for dual-entity highlighting
   */
  interface ComparisonOptions {
    leftId?: string;
    rightId?: string;
    leftColor?: number[];  // [r, g, b, a]
    rightColor?: number[]; // [r, g, b, a]
  }

  /**
   * Highlight segment precincts on the map
   * Creates a separate graphics layer with MPIQ green highlighting
   * Supports comparison mode with different colors for left/right entities
   */
  const highlightSegmentPrecincts = useCallback(async (
    precinctIds: string[],
    comparisonOptions?: ComparisonOptions
  ) => {
    if (!mapState.view) {
      console.log('[PoliticalMapContainer] Map not ready for segment highlighting');
      return;
    }

    console.log('[PoliticalMapContainer] Starting segment highlighting for', precinctIds.length, 'precincts');
    setIsHighlightingSegment(true);

    try {
      // Clear previous segment highlights
      const existingLayer = mapState.view.map.findLayerById('segment-highlights') as GraphicsLayer;
      if (existingLayer) {
        mapState.view.map.remove(existingLayer);
      }

      // Get precinct boundaries from service (returns GeoJSON FeatureCollection)
      console.log('[PoliticalMapContainer] Fetching precinct boundaries...');
      const precinctBoundaries = await politicalDataService.loadPrecinctBoundaries();
      console.log('[PoliticalMapContainer] Loaded', precinctBoundaries.features.length, 'precinct boundaries');

      // Create a new graphics layer for segment highlights
      const highlightLayer = new GraphicsLayer({
        id: 'segment-highlights',
        title: 'Segment Highlights',
        listMode: 'hide', // Don't show in layer list
      });

      const highlightedGeometries: __esri.Geometry[] = [];

      // Default color (MPIQ green)
      const defaultColor = [51, 168, 82, 0.3];
      const defaultOutline = [51, 168, 82, 1];

      // Find matching precincts and add highlight graphics
      // GeoJSON features have properties with precinct_id or name fields
      precinctIds.forEach(id => {
        const feature = precinctBoundaries.features.find(f => {
          const props = f.properties || {};
          return (
            props.UNIQUE_ID === id ||
            props.precinct_id === id ||
            props.id === id ||
            props.name === id ||
            props.precinct_name === id ||
            props.NAME === id
          );
        });

        if (feature && feature.geometry) {
          // Convert GeoJSON geometry to ArcGIS geometry
          const arcgisGeometry = geojsonToArcGIS(feature.geometry);

          // Determine color based on comparison options
          let fillColor = defaultColor;
          let outlineColor = defaultOutline;

          if (comparisonOptions) {
            if (id === comparisonOptions.leftId && comparisonOptions.leftColor) {
              fillColor = comparisonOptions.leftColor;
              outlineColor = [fillColor[0], fillColor[1], fillColor[2], 1];
            } else if (id === comparisonOptions.rightId && comparisonOptions.rightColor) {
              fillColor = comparisonOptions.rightColor;
              outlineColor = [fillColor[0], fillColor[1], fillColor[2], 1];
            }
          }

          const graphic = new Graphic({
            geometry: arcgisGeometry as any,
            symbol: {
              type: 'simple-fill',
              color: fillColor,
              outline: {
                color: outlineColor,
                width: 2,
              },
            } as any,
            attributes: {
              precinct_id: feature.properties?.precinct_id || feature.properties?.id || id,
              precinct_name: feature.properties?.name || feature.properties?.NAME || id,
            },
          });

          highlightLayer.add(graphic);
          if (arcgisGeometry) {
            highlightedGeometries.push(arcgisGeometry as __esri.Geometry);
          }
        } else {
          console.warn('[PoliticalMapContainer] Precinct not found for ID:', id);
        }
      });

      // Add layer to map
      mapState.view.map.add(highlightLayer);

      // Zoom to extent of highlighted precincts
      if (highlightedGeometries.length > 0) {
        // Calculate union of all geometries
        const allExtents = highlightedGeometries
          .map(g => (g as any).extent)
          .filter(Boolean);

        if (allExtents.length > 0) {
          let unionExtent = allExtents[0];
          for (let i = 1; i < allExtents.length; i++) {
            unionExtent = unionExtent.union(allExtents[i]);
          }

          // Expand extent by 20% and animate to it
          await mapState.view.goTo(unionExtent.expand(1.2), {
            duration: 1000,
            easing: 'ease-in-out',
          });
        }
      }

      console.log('[PoliticalMapContainer] Successfully highlighted', highlightedGeometries.length, 'precincts');
    } catch (error) {
      console.error('[PoliticalMapContainer] Error highlighting segment precincts:', error);
    } finally {
      setIsHighlightingSegment(false);
    }
  }, [mapState.view]);

  /**
   * Clear segment view and remove highlights
   */
  const clearSegmentView = useCallback(() => {
    if (!mapState.view) return;

    // Remove highlight layer
    const highlightLayer = mapState.view.map.findLayerById('segment-highlights');
    if (highlightLayer) {
      mapState.view.map.remove(highlightLayer);
    }

    // Navigate without segment params
    router.push('/political-ai');
  }, [mapState.view, router]);

  /**
   * Effect to highlight segment precincts when URL params change
   * Only runs after map is fully loaded (not in loading state)
   */
  useEffect(() => {
    if (segmentPrecinctIds && segmentPrecinctIds.length > 0 && mapState.view && !mapState.isLoading) {
      console.log('[PoliticalMapContainer] Map ready, triggering segment highlight');
      highlightSegmentPrecincts(segmentPrecinctIds);
    }
  }, [segmentPrecinctIds, mapState.view, mapState.isLoading, highlightSegmentPrecincts]);


  // Notify parent when map is ready (pass view for external panel use)
  useEffect(() => {
    if (!mapState.isLoading && mapState.view && onMapReady) {
      onMapReady(mapState.view);
    }
  }, [mapState.isLoading, mapState.view, onMapReady]);

  // Debug: Log when AI mode click handler is set up
  useEffect(() => {
    if (enableAIMode && mapState.view) {
      console.log('[PoliticalMapContainer] AI mode enabled, click handler ready. activeLayer:', activeLayer);
    }
  }, [enableAIMode, mapState.view, activeLayer]);

  // Temporal animation effect
  useEffect(() => {
    if (isPlaying && isTemporalMode) {
      animationRef.current = setInterval(() => {
        setSelectedElectionYear((prevYear: number) => {
          const currentIndex = availableElectionYears.indexOf(prevYear);
          const nextIndex = (currentIndex + 1) % availableElectionYears.length;
          return availableElectionYears[nextIndex];
        });
      }, 1500); // 1.5 seconds per year
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, isTemporalMode]);

  // Sync temporal state to ApplicationStateManager for AI context awareness (Phase 16)
  useEffect(() => {
    const stateManager = getStateManager();
    stateManager.setTemporalMode(isTemporalMode, selectedElectionYear);
  }, [isTemporalMode, selectedElectionYear]);

  // Temporal control handlers
  const handleTemporalToggle = useCallback(() => {
    setIsTemporalMode((prev: boolean) => {
      const newValue = !prev;
      if (prev) {
        // When turning off temporal mode, stop any animation
        setIsPlaying(false);
      }
      return newValue;
    });
  }, []);

  const handleTemporalPlayPause = useCallback(() => {
    setIsPlaying((prev: boolean) => !prev);
  }, []);

  const handleTemporalStepBack = useCallback(() => {
    setIsPlaying(false);
    setSelectedElectionYear((prevYear: number) => {
      const currentIndex = availableElectionYears.indexOf(prevYear);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : availableElectionYears.length - 1;
      return availableElectionYears[prevIndex];
    });
  }, []);

  const handleTemporalStepForward = useCallback(() => {
    setIsPlaying(false);
    setSelectedElectionYear((prevYear: number) => {
      const currentIndex = availableElectionYears.indexOf(prevYear);
      const nextIndex = (currentIndex + 1) % availableElectionYears.length;
      return availableElectionYears[nextIndex];
    });
  }, []);

  // Execute map commands from AI
  useEffect(() => {
    if (!mapCommand) {
      return;
    }
    if (!mapState.view) {
      console.warn('[PoliticalMapContainer] Map command received but view not ready:', mapCommand);
      return;
    }

    console.log('[PoliticalMapContainer] Executing map command:', mapCommand, 'activeLayer before:', activeLayer);

    // Handle action-based commands (alternative format)
    const commandType = mapCommand.type || (mapCommand.action as typeof mapCommand.type);
    if (!commandType) {
      console.warn('[PoliticalMapContainer] Map command has no type or action:', mapCommand);
      return;
    }

    // Helper to dispatch command execution events to state manager
    const dispatchCommandExecuted = (commandType: string, details?: Record<string, unknown>) => {
      const stateManager = getStateManager();
      const event: StateEvent = {
        type: 'MAP_COMMAND_EXECUTED',
        payload: { commandType, success: true, details },
        timestamp: new Date(),
      };
      stateManager.dispatch(event);
    };

    switch (commandType) {
      case 'zoom': {
        const zoomLevel = mapCommand.zoom || (mapCommand.data?.level as number) || 12;
        mapState.view.zoom = zoomLevel;
        dispatchCommandExecuted('zoom', { zoomLevel });
        break;
      }

      case 'flyTo': {
        // Known municipality coordinates for fallback (Ingham County)
        const MUNICIPALITY_COORDS: Record<string, [number, number]> = {
          'east lansing': [-84.4839, 42.7369],
          'lansing': [-84.5555, 42.7325],
          'meridian township': [-84.4233, 42.7197],
          'meridian': [-84.4233, 42.7197],
          'delhi township': [-84.6053, 42.6567],
          'delhi': [-84.6053, 42.6567],
          'okemos': [-84.4272, 42.7225],
          'haslett': [-84.4011, 42.7464],
          'holt': [-84.5153, 42.6406],
          'mason': [-84.4436, 42.5792],
          'williamston': [-84.2831, 42.6889],
          'leslie': [-84.4319, 42.4517],
          'webberville': [-84.1733, 42.6678],
          'stockbridge': [-84.1819, 42.4517],
          'dansville': [-84.3028, 42.5553],
          'ingham county': [-84.55, 42.60],
        };

        // Animate to a specific location
        if (mapCommand.center) {
          // Explicit center provided
          mapState.view.goTo({
            center: mapCommand.center,
            zoom: mapCommand.zoom || mapState.view.zoom,
          }).then(() => {
            dispatchCommandExecuted('flyTo', { center: mapCommand.center, zoom: mapCommand.zoom });
          }).catch((error: Error) => {
            console.error('[PoliticalMapContainer] Error flying to location:', error);
            // S8-003: Show toast notification on map command failure
            toast({
              title: 'Map Navigation Failed',
              description: 'Unable to navigate to the requested location. Please try again.',
              variant: 'destructive',
            });
          });
        } else if (mapCommand.target) {
          // Fly to precinct or municipality
          const targetName = Array.isArray(mapCommand.target) ? mapCommand.target[0] : mapCommand.target;

          // Defensive check: ensure targetName is valid
          if (!targetName || typeof targetName !== 'string' || targetName.trim().length === 0) {
            console.warn('[PoliticalMapContainer] Invalid flyTo target:', mapCommand.target);
            break;
          }

          const targetLower = targetName.toLowerCase().trim();

          // Check if target is a known municipality (use direct coordinates)
          const municipalityCoords = MUNICIPALITY_COORDS[targetLower];
          if (municipalityCoords) {
            console.log('[PoliticalMapContainer] Flying to municipality:', targetName, municipalityCoords);
            mapState.view.goTo({
              center: municipalityCoords,
              zoom: 12,
            }).then(() => {
              dispatchCommandExecuted('flyTo', { target: targetName, type: 'municipality' });
            }).catch((error: Error) => {
              console.error('[PoliticalMapContainer] Error flying to municipality:', error);
            });
            break;
          }

          // Otherwise, query for precinct feature (must use PA choropleth layer id / title — not first random GeoJSON)
          console.log('[PoliticalMapContainer] Querying precinct for flyTo (municipality not found):', targetName);
          setActiveLayer('choropleth');
          setShowLegend(true);

          const runFlyToPrecinct = async () => {
            const view = mapState.view;
            if (!view) return;

            let choroplethLayer = getPrecinctChoroplethGeoJsonLayer(view.map);
            let attempts = 0;
            while (!choroplethLayer && attempts < 45) {
              await new Promise((r) => setTimeout(r, 100));
              choroplethLayer = getPrecinctChoroplethGeoJsonLayer(view.map);
              attempts++;
            }
            if (!choroplethLayer) {
              console.warn('[PoliticalMapContainer] Choropleth layer not found for flyTo after wait');
              toast({
                title: 'Map not ready',
                description: 'Precinct boundaries layer is still loading. Switch to the Precincts map layer and try again.',
                variant: 'destructive',
              });
              return;
            }

            try {
              await choroplethLayer.load();
            } catch {
              /* layer may already be loaded */
            }

            const whereClause = await buildPaPrecinctWhereClause(targetName);
            console.log('[PoliticalMapContainer] flyTo precinct WHERE:', whereClause);

            const query = choroplethLayer.createQuery();
            query.where = whereClause;
            query.returnGeometry = true;
            query.outSpatialReference = view.spatialReference;

            try {
              const result = await choroplethLayer.queryFeatures(query);
              if (result.features.length > 0) {
                const feature = result.features[0];
                await view.goTo({
                  target: feature.geometry,
                  zoom: 13,
                });
                dispatchCommandExecuted('flyTo', { target: targetName });
                return;
              }

              const partialMatch = Object.entries(MUNICIPALITY_COORDS).find(
                ([name]) => targetLower.includes(name) || name.includes(targetLower)
              );
              if (partialMatch) {
                console.log('[PoliticalMapContainer] Using municipality fallback for:', targetName);
                await view.goTo({
                  center: partialMatch[1],
                  zoom: 12,
                });
                dispatchCommandExecuted('flyTo', { target: targetName, type: 'municipality-fallback' });
                return;
              }

              console.warn('[PoliticalMapContainer] Location not found for flyTo:', targetName);
              toast({
                title: 'Location Not Found',
                description: `Unable to locate "${targetName}" on the map.`,
                variant: 'destructive',
              });
            } catch (error: unknown) {
              console.error('[PoliticalMapContainer] Error querying precinct:', {
                target: targetName,
                error: error instanceof Error ? error.message : String(error),
              });
              toast({
                title: 'Map Query Failed',
                description: `Unable to find "${targetName}". Please try again.`,
                variant: 'destructive',
              });
            }
          };

          void runFlyToPrecinct();
        }
        break;
      }

      case 'highlight': {
        if (mapCommand.target === 'all') {
          // Highlight all precincts - handled by choropleth layer
          setActiveLayer('choropleth');
          setShowLegend(true);
          dispatchCommandExecuted('highlight', { target: 'all' });
        } else if (Array.isArray(mapCommand.target)) {
          // Highlight specific precincts
          setMapState((prev: MapState) => ({
            ...prev,
            selectedPrecincts: mapCommand.target as string[],
            selectedPrecinct: (mapCommand.target as string[])[0] || null,
          }));
          dispatchCommandExecuted('highlight', { precincts: mapCommand.target, count: mapCommand.target.length });
        } else if (typeof mapCommand.target === 'string') {
          // Highlight single precinct
          setMapState((prev: MapState) => ({
            ...prev,
            selectedPrecinct: mapCommand.target as string,
            selectedPrecincts: [mapCommand.target as string],
          }));
          dispatchCommandExecuted('highlight', { precinct: mapCommand.target });
        }
        break;
      }

      case 'clearHighlight': {
        // Clear highlighted precincts
        setMapState((prev: MapState) => ({
          ...prev,
          selectedPrecinct: null,
          selectedPrecincts: [],
        }));
        dispatchCommandExecuted('clearHighlight', {});
        break;
      }

      case 'showChoropleth': {
        // Switch to precinct choropleth layer
        setActiveLayer('choropleth');
        setShowLegend(true);
        dispatchCommandExecuted('showChoropleth', {});
        break;
      }

      case 'highlightComparison': {
        // Highlight two entities for comparison with different colors
        // Left entity = blue, Right entity = orange
        const leftId = mapCommand.leftEntityId;
        const rightId = mapCommand.rightEntityId;

        if (leftId || rightId) {
          // Use segment highlighting with custom colors for comparison
          const idsToHighlight: string[] = [];
          if (leftId) idsToHighlight.push(leftId);
          if (rightId) idsToHighlight.push(rightId);

          // Store comparison state for rendering with different colors
          setMapState((prev: MapState) => ({
            ...prev,
            selectedPrecincts: idsToHighlight,
            selectedPrecinct: leftId || rightId || null,
          }));

          // Trigger highlight with comparison data
          highlightSegmentPrecincts(idsToHighlight, {
            leftId,
            rightId,
            leftColor: [59, 130, 246, 0.4], // Blue for left
            rightColor: [249, 115, 22, 0.4], // Orange for right
          });

          // Show choropleth as base layer
          setActiveLayer('choropleth');
          setShowLegend(true);

          dispatchCommandExecuted('highlightComparison', { leftId, rightId });
        }
        break;
      }

      case 'showHeatmap': {
        // Switch to H3 heatmap with the specified metric
        console.log('[PoliticalMapContainer] showHeatmap command - setting activeLayer to h3, metric:', mapCommand.metric);
        setActiveLayer('h3');
        setShowLegend(true);

        // Use centralized metric resolution (handles aliases and validation)
        const h3MetricValue = resolveHeatmapMetric(mapCommand.metric);
        console.log('[PoliticalMapContainer] Setting h3Metric to:', h3MetricValue);
        setH3Metric(h3MetricValue);
        dispatchCommandExecuted('showHeatmap', { metric: h3MetricValue });
        break;
      }

      case 'showBivariate': {
        // Switch to bivariate choropleth
        console.log('[PoliticalMapContainer] showBivariate command:', mapCommand);

        // Validate required properties
        if (mapCommand.bivariatePreset && BIVARIATE_PRESETS[mapCommand.bivariatePreset]) {
          setActiveLayer('bivariate');
          setShowLegend(true);
          setBivariateConfig(BIVARIATE_PRESETS[mapCommand.bivariatePreset]);
          dispatchCommandExecuted('showBivariate', { preset: mapCommand.bivariatePreset });
        } else if (mapCommand.xMetric && mapCommand.yMetric) {
          setActiveLayer('bivariate');
          setShowLegend(true);
          setBivariateConfig({
            xMetric: mapCommand.xMetric as any,
            yMetric: mapCommand.yMetric as any,
            xLabel: mapCommand.xMetric.replace(/_/g, ' '),
            yLabel: mapCommand.yMetric.replace(/_/g, ' '),
          });
          dispatchCommandExecuted('showBivariate', { xMetric: mapCommand.xMetric, yMetric: mapCommand.yMetric });
        } else {
          console.warn('[PoliticalMapContainer] showBivariate requires bivariatePreset OR both xMetric and yMetric');
          return;
        }
        break;
      }

      case 'showProportional': {
        // Switch to proportional symbols
        console.log('[PoliticalMapContainer] showProportional command:', mapCommand);

        // Validate required properties
        if (mapCommand.proportionalPreset && PROPORTIONAL_PRESETS[mapCommand.proportionalPreset]) {
          setActiveLayer('proportional');
          setShowLegend(true);
          setProportionalConfig(PROPORTIONAL_PRESETS[mapCommand.proportionalPreset]);
          dispatchCommandExecuted('showProportional', { preset: mapCommand.proportionalPreset });
        } else if (mapCommand.sizeMetric && mapCommand.colorMetric) {
          setActiveLayer('proportional');
          setShowLegend(true);
          setProportionalConfig({
            sizeMetric: mapCommand.sizeMetric as any,
            colorMetric: mapCommand.colorMetric as any,
            sizeLabel: mapCommand.sizeMetric.replace(/_/g, ' '),
            colorLabel: mapCommand.colorMetric.replace(/_/g, ' '),
          });
          dispatchCommandExecuted('showProportional', { sizeMetric: mapCommand.sizeMetric, colorMetric: mapCommand.colorMetric });
        } else {
          console.warn('[PoliticalMapContainer] showProportional requires proportionalPreset OR both sizeMetric and colorMetric');
          return;
        }
        break;
      }

      case 'showValueByAlpha': {
        // Switch to value-by-alpha layer
        console.log('[PoliticalMapContainer] showValueByAlpha command:', mapCommand);

        // Validate required properties
        if (mapCommand.valueByAlphaPreset && VALUE_BY_ALPHA_PRESETS[mapCommand.valueByAlphaPreset]) {
          setActiveLayer('valueByAlpha');
          setShowLegend(true);
          setValueByAlphaConfig(VALUE_BY_ALPHA_PRESETS[mapCommand.valueByAlphaPreset]);
          dispatchCommandExecuted('showValueByAlpha', { preset: mapCommand.valueByAlphaPreset });
        } else if (mapCommand.metric && mapCommand.alphaMetric) {
          setActiveLayer('valueByAlpha');
          setShowLegend(true);
          setValueByAlphaConfig({
            valueMetric: mapCommand.metric as any,
            alphaMetric: mapCommand.alphaMetric as any,
            valueLabel: mapCommand.metric.replace(/_/g, ' '),
            alphaLabel: mapCommand.alphaMetric.replace(/_/g, ' '),
          });
          dispatchCommandExecuted('showValueByAlpha', { metric: mapCommand.metric, alphaMetric: mapCommand.alphaMetric });
        } else {
          console.warn('[PoliticalMapContainer] showValueByAlpha requires valueByAlphaPreset OR both metric and alphaMetric');
          return;
        }
        break;
      }

      case 'filter': {
        // Apply filter based on metric
        if (mapCommand.metric) {
          // Switch to H3 heatmap with the specified metric
          setActiveLayer('h3');
          setShowLegend(true);

          // Use centralized metric resolution (handles aliases and validation)
          const h3MetricValue = resolveHeatmapMetric(mapCommand.metric);
          setH3Metric(h3MetricValue);
          dispatchCommandExecuted('filter', { metric: h3MetricValue });
        }
        break;
      }

      case 'showNumberedMarkers': {
        // Show numbered markers for ranked lists from AI
        // Use central state manager to deduplicate (Issue #17)
        if (mapCommand.numberedMarkers && mapCommand.numberedMarkers.length > 0) {
          console.log('[PoliticalMapContainer] Showing', mapCommand.numberedMarkers.length, 'numbered markers');

          const stateManager = getStateManager();
          stateManager.setNumberedMarkers(mapCommand.numberedMarkers.map(m => ({
            precinctId: m.precinctId,
            number: m.number,
          })));

          // Optionally fly to the extent of all markers
          // Wait for centroids to be available to avoid race condition (P2-33)
          if (mapCommand.numberedMarkers.length > 0 && Object.keys(precinctCentroids).length > 0) {
            const firstMarker = mapCommand.numberedMarkers[0];
            const coords = firstMarker.coordinates || precinctCentroids[firstMarker.precinctId];
            if (coords) {
              mapState.view.goTo({
                center: coords,
                zoom: mapCommand.numberedMarkers.length === 1 ? 13 : 11,
              }).then(() => {
                dispatchCommandExecuted('showNumberedMarkers', { count: mapCommand.numberedMarkers!.length });
              }).catch((error: Error) => {
                console.error('[PoliticalMapContainer] Error flying to markers:', error);
                // S8-003: Show toast notification on map command failure
                toast({
                  title: 'Map Navigation Failed',
                  description: 'Unable to navigate to markers. They will still be displayed.',
                });
                dispatchCommandExecuted('showNumberedMarkers', { count: mapCommand.numberedMarkers!.length });
              });
            } else {
              console.warn('[PoliticalMapContainer] Centroid not found for marker:', firstMarker.precinctId);
              dispatchCommandExecuted('showNumberedMarkers', { count: mapCommand.numberedMarkers.length });
            }
          } else {
            // Centroids not loaded yet - just set markers without flying
            if (Object.keys(precinctCentroids).length === 0) {
              console.log('[PoliticalMapContainer] Centroids not loaded yet - markers will render when ready');
            }
            dispatchCommandExecuted('showNumberedMarkers', { count: mapCommand.numberedMarkers.length });
          }
        } else {
          // Clear numbered markers (use central state)
          const stateManager = getStateManager();
          stateManager.clearNumberedMarkers();
          dispatchCommandExecuted('showNumberedMarkers', { count: 0 });
        }
        break;
      }

      case 'showClusters': {
        // P2-36: Show spatial clusters of precincts
        if (mapCommand.clusters && mapCommand.clusters.length > 0) {
          console.log('[PoliticalMapContainer] showClusters command received with', mapCommand.clusters.length, 'clusters');

          // Cluster colors (distinct, high contrast)
          const clusterColors = [
            [51, 168, 82, 0.4],   // Green
            [66, 133, 244, 0.4], // Blue
            [234, 67, 53, 0.4],  // Red
            [251, 188, 5, 0.4],  // Yellow
            [156, 39, 176, 0.4], // Purple
            [0, 150, 136, 0.4],  // Teal
          ];

          // Import graphics layer dynamically
          Promise.all([
            import('@arcgis/core/layers/GraphicsLayer'),
            import('@arcgis/core/Graphic'),
            import('@arcgis/core/symbols/SimpleFillSymbol'),
            import('@arcgis/core/symbols/TextSymbol'),
            import('@arcgis/core/geometry/Point'),
          ]).then(([GraphicsLayerModule, GraphicModule, FillSymbolModule, TextSymbolModule, PointModule]) => {
            const GraphicsLayer = GraphicsLayerModule.default;
            const Graphic = GraphicModule.default;
            const SimpleFillSymbol = FillSymbolModule.default;
            const TextSymbol = TextSymbolModule.default;
            const Point = PointModule.default;

            // Remove existing cluster layer if present
            const existingLayer = mapState.view?.map.findLayerById('cluster-visualization');
            if (existingLayer) {
              mapState.view?.map.remove(existingLayer);
            }

            // Create new graphics layer for clusters
            const clusterLayer = new GraphicsLayer({ id: 'cluster-visualization', title: 'Cluster Visualization' });

            mapCommand.clusters!.forEach((cluster, index) => {
              const color = clusterColors[index % clusterColors.length];

              // For each precinct in the cluster, query its geometry
              cluster.precinctIds.forEach((precinctId: string) => {
                const choroplethLayer = mapState.view?.map
                  ? getPrecinctChoroplethGeoJsonLayer(mapState.view.map)
                  : undefined;

                if (choroplethLayer) {
                  void (async () => {
                    try {
                      await choroplethLayer.load();
                      const whereClause = await buildPaPrecinctWhereClause(precinctId);
                      const query = choroplethLayer.createQuery();
                      query.where = whereClause;
                      query.returnGeometry = true;

                      const result = await choroplethLayer.queryFeatures(query);
                      if (result.features.length > 0) {
                        const graphic = new Graphic({
                          geometry: result.features[0].geometry,
                          symbol: new SimpleFillSymbol({
                            color: color as any,
                            outline: { color: [color[0], color[1], color[2], 1], width: 2 },
                          }),
                          attributes: { clusterId: cluster.id, clusterName: cluster.name || `Cluster ${index + 1}` },
                        });
                        clusterLayer.add(graphic);
                      }
                    } catch {
                      /* ignore per-precinct cluster draw failures */
                    }
                  })();
                }
              });

              // Add cluster label at centroid (if provided)
              if (cluster.centroid) {
                const labelGraphic = new Graphic({
                  geometry: new Point({ longitude: cluster.centroid[0], latitude: cluster.centroid[1] }),
                  symbol: new TextSymbol({
                    text: cluster.name || `Cluster ${index + 1}`,
                    color: 'white',
                    haloColor: [color[0], color[1], color[2], 1],
                    haloSize: 2,
                    font: { size: 12, weight: 'bold' },
                  }),
                });
                clusterLayer.add(labelGraphic);
              }
            });

            mapState.view?.map.add(clusterLayer);
            dispatchCommandExecuted('showClusters', { clusterCount: mapCommand.clusters!.length });
          });
        } else {
          console.warn('[PoliticalMapContainer] showClusters command requires clusters array');
        }
        break;
      }

      case 'showBuffer': {
        // P2-37: Show radius/drivetime buffer around a point
        if (mapCommand.bufferCenter && mapCommand.bufferDistance) {
          const { bufferCenter, bufferDistance, bufferUnit = 'km', bufferType = 'radius' } = mapCommand;
          console.log(
            '[PoliticalMapContainer] showBuffer command received:',
            bufferDistance,
            bufferUnit,
            bufferType,
            'around',
            bufferCenter
          );

          // Import graphics layer and circle geometry dynamically
          Promise.all([
            import('@arcgis/core/layers/GraphicsLayer'),
            import('@arcgis/core/Graphic'),
            import('@arcgis/core/symbols/SimpleFillSymbol'),
            import('@arcgis/core/symbols/SimpleMarkerSymbol'),
            import('@arcgis/core/geometry/Point'),
            import('@arcgis/core/geometry/Circle'),
          ]).then(([GraphicsLayerModule, GraphicModule, FillSymbolModule, MarkerSymbolModule, PointModule, CircleModule]) => {
            const GraphicsLayer = GraphicsLayerModule.default;
            const Graphic = GraphicModule.default;
            const SimpleFillSymbol = FillSymbolModule.default;
            const SimpleMarkerSymbol = MarkerSymbolModule.default;
            const Point = PointModule.default;
            const Circle = CircleModule.default;

            // Remove existing buffer layer if present
            const existingLayer = mapState.view?.map.findLayerById('buffer-visualization');
            if (existingLayer) {
              mapState.view?.map.remove(existingLayer);
            }

            // Create new graphics layer for buffer
            const bufferLayer = new GraphicsLayer({ id: 'buffer-visualization', title: 'Buffer Visualization' });

            // Create center point
            const centerPoint = new Point({
              longitude: bufferCenter[0],
              latitude: bufferCenter[1],
            });

            // Add center point marker
            const centerGraphic = new Graphic({
              geometry: centerPoint,
              symbol: new SimpleMarkerSymbol({
                color: [51, 168, 82, 1],
                size: 12,
                outline: { color: 'white', width: 2 },
              }),
            });
            bufferLayer.add(centerGraphic);

            // Convert distance to meters for Circle geometry
            let distanceInMeters = bufferDistance;
            if (bufferUnit === 'km') {
              distanceInMeters = bufferDistance * 1000;
            } else if (bufferUnit === 'mi' || bufferUnit === 'miles') {
              distanceInMeters = bufferDistance * 1609.34;
            }

            // Create circle buffer
            const circle = new Circle({
              center: centerPoint,
              radius: distanceInMeters,
              radiusUnit: 'meters',
              geodesic: true,
            });

            // Add circle graphic
            const circleGraphic = new Graphic({
              geometry: circle,
              symbol: new SimpleFillSymbol({
                color: [51, 168, 82, 0.2],
                outline: { color: [51, 168, 82, 1], width: 2, style: 'dash' },
              }),
            });
            bufferLayer.add(circleGraphic);

            mapState.view?.map.add(bufferLayer);

            // Fly to show the buffer - use extent with padding for proper fit
            const bufferExtent = circle.extent;
            if (bufferExtent && mapState.view) {
              mapState.view.goTo(bufferExtent.expand(1.3), { animate: true, duration: 1000 })
                .then(() => {
                  dispatchCommandExecuted('showBuffer', {
                    center: bufferCenter,
                    distance: bufferDistance,
                    unit: bufferUnit,
                    type: bufferType
                  });
                })
                .catch((err: Error) => {
                  console.warn('[PoliticalMapContainer] Failed to zoom to buffer:', err);
                });
            }

            // Optionally highlight precincts within buffer
            // Query precincts that intersect with the buffer
            const choroplethLayer = mapState.view?.map
              ? getPrecinctChoroplethGeoJsonLayer(mapState.view.map)
              : undefined;

            if (choroplethLayer) {
              const query = choroplethLayer.createQuery();
              query.geometry = circle;
              query.spatialRelationship = 'intersects';
              query.returnGeometry = false;
              query.outFields = ['precinct_id', 'precinct_name'];

              choroplethLayer.queryFeatures(query).then((result: __esri.FeatureSet) => {
                if (result.features.length > 0) {
                  const precinctIds = result.features.map(f =>
                    f.attributes.precinct_id || f.attributes.precinct_name
                  ).filter(Boolean);
                  console.log(`[PoliticalMapContainer] Found ${precinctIds.length} precincts within buffer`);
                  // Update selected precincts
                  setMapState((prev: MapState) => ({
                    ...prev,
                    selectedPrecincts: precinctIds,
                  }));
                }
              });
            }
          });
        } else {
          console.warn('[PoliticalMapContainer] showBuffer command requires bufferCenter and bufferDistance');
        }
        break;
      }

      case 'clear': {
        // Clear all selections and reset to default view
        setMapState((prev: MapState) => ({
          ...prev,
          selectedPrecinct: null,
          selectedPrecincts: [],
        }));
        setActiveLayer('choropleth');
        setShowLegend(true);
        // Also clear numbered markers (use central state)
        const stateManager = getStateManager();
        stateManager.clearNumberedMarkers();
        // Clear all visualization layers
        const layersToRemove = [
          'cluster-visualization',
          'buffer-visualization',
          'route-visualization',
          'pulse-visualization',
        ];
        layersToRemove.forEach((layerId) => {
          const layer = mapState.view?.map.findLayerById(layerId);
          if (layer) mapState.view?.map.remove(layer);
        });
        dispatchCommandExecuted('clear', {});
        break;
      }

      case 'setExtent': {
        // Set map to specific geographic bounds
        if (mapCommand.extent) {
          const { xmin, ymin, xmax, ymax } = mapCommand.extent;
          console.log('[PoliticalMapContainer] setExtent command:', mapCommand.extent);

          // Import Extent dynamically
          import('@arcgis/core/geometry/Extent').then((ExtentModule) => {
            const extent = new ExtentModule.default({
              xmin,
              ymin,
              xmax,
              ymax,
              spatialReference: { wkid: 4326 }
            });

            mapState.view?.goTo(extent, { animate: true, duration: 1000 })
              .then(() => {
                dispatchCommandExecuted('setExtent', { extent: mapCommand.extent });
              })
              .catch((error: Error) => {
                console.error('[PoliticalMapContainer] Error setting extent:', error);
                // S8-003: Show toast notification on map command failure
                toast({
                  title: 'Map Zoom Failed',
                  description: 'Unable to zoom to the requested area. Please try again.',
                  variant: 'destructive',
                });
              });
          });
        } else {
          console.warn('[PoliticalMapContainer] setExtent command requires extent object');
        }
        break;
      }

      case 'showRoute': {
        // Display canvassing route with waypoints and connecting lines
        if (mapCommand.waypoints && mapCommand.waypoints.length > 0) {
          console.log('[PoliticalMapContainer] showRoute command with', mapCommand.waypoints.length, 'waypoints');

          // Convert waypoints to numbered markers for visualization
          const routeMarkers = mapCommand.waypoints.map((wp) => ({
            precinctId: wp.precinctId,
            number: wp.order,
            label: wp.label || `Stop ${wp.order}`,
          }));

          // Use existing numbered marker system
          const stateManager = getStateManager();
          stateManager.setNumberedMarkers(routeMarkers);

          // Draw connecting lines between waypoints
          if (mapCommand.waypoints.length > 1 && Object.keys(precinctCentroids).length > 0) {
            Promise.all([
              import('@arcgis/core/layers/GraphicsLayer'),
              import('@arcgis/core/Graphic'),
              import('@arcgis/core/geometry/Polyline'),
              import('@arcgis/core/symbols/SimpleLineSymbol'),
            ]).then(([GraphicsLayerModule, GraphicModule, PolylineModule, LineSymbolModule]) => {
              const GraphicsLayer = GraphicsLayerModule.default;
              const Graphic = GraphicModule.default;
              const Polyline = PolylineModule.default;
              const SimpleLineSymbol = LineSymbolModule.default;

              // Remove existing route layer
              const existingLayer = mapState.view?.map.findLayerById('route-visualization');
              if (existingLayer) {
                mapState.view?.map.remove(existingLayer);
              }

              // Create route layer
              const routeLayer = new GraphicsLayer({ id: 'route-visualization', title: 'Canvassing Route' });

              // Sort waypoints by order and build path
              const sortedWaypoints = [...mapCommand.waypoints!].sort((a, b) => a.order - b.order);
              const pathCoords: number[][] = [];

              sortedWaypoints.forEach(wp => {
                const coords = precinctCentroids[wp.precinctId];
                if (coords) {
                  pathCoords.push([coords[0], coords[1]]);
                }
              });

              if (pathCoords.length > 1) {
                const routeLine = new Polyline({
                  paths: [pathCoords],
                  spatialReference: { wkid: 4326 }
                });

                const lineSymbol = new SimpleLineSymbol({
                  color: [51, 168, 82, 0.8],
                  width: 3,
                  style: mapCommand.optimized ? 'solid' : 'dash'
                });

                const routeGraphic = new Graphic({
                  geometry: routeLine,
                  symbol: lineSymbol,
                  attributes: { type: 'route', optimized: mapCommand.optimized }
                });

                routeLayer.add(routeGraphic);
                mapState.view?.map.add(routeLayer);
              }
            });
          }

          // Fly to the first waypoint
          if (mapCommand.waypoints.length > 0 && Object.keys(precinctCentroids).length > 0) {
            const firstWaypoint = mapCommand.waypoints.find(w => w.order === 1) || mapCommand.waypoints[0];
            const coords = precinctCentroids[firstWaypoint.precinctId];
            if (coords) {
              mapState.view?.goTo({
                center: coords,
                zoom: 12,
              }).then(() => {
                dispatchCommandExecuted('showRoute', {
                  waypointCount: mapCommand.waypoints!.length,
                  optimized: mapCommand.optimized
                });
              }).catch((error: Error) => {
                console.error('[PoliticalMapContainer] Error flying to route:', error);
                // S8-003: Show toast notification on map command failure
                toast({
                  title: 'Map Navigation Failed',
                  description: 'Unable to navigate to route. Route will still be displayed.',
                });
              });
            }
          } else {
            dispatchCommandExecuted('showRoute', {
              waypointCount: mapCommand.waypoints.length,
              optimized: mapCommand.optimized
            });
          }
        } else {
          console.warn('[PoliticalMapContainer] showRoute command requires waypoints array');
        }
        break;
      }

      case 'showComparison': {
        // Side-by-side temporal comparison (e.g., 2020 vs 2024 partisan lean)
        if (mapCommand.leftMetric && mapCommand.rightMetric) {
          console.log('[PoliticalMapContainer] showComparison command:', mapCommand.leftMetric, 'vs', mapCommand.rightMetric);

          // For now, enable temporal mode and set to show the first metric
          // Full split-view would require significant UI changes
          setIsTemporalMode(true);
          setShowLegend(true);

          // If years are specified in the metrics, extract them
          const leftYear = mapCommand.leftMetric.match(/\d{4}/)?.[0];
          const rightYear = mapCommand.rightMetric.match(/\d{4}/)?.[0];

          if (leftYear) {
            setSelectedElectionYear(parseInt(leftYear));
          }

          dispatchCommandExecuted('showComparison', {
            leftMetric: mapCommand.leftMetric,
            rightMetric: mapCommand.rightMetric,
            splitDirection: mapCommand.splitDirection || 'vertical'
          });
        } else {
          console.warn('[PoliticalMapContainer] showComparison command requires leftMetric and rightMetric');
        }
        break;
      }

      case 'annotate': {
        // Add temporary map annotation
        if (mapCommand.location && mapCommand.label) {
          console.log('[PoliticalMapContainer] annotate command:', mapCommand.label, 'at', mapCommand.location);

          // Create a temporary graphic for the annotation
          Promise.all([
            import('@arcgis/core/Graphic'),
            import('@arcgis/core/geometry/Point'),
            import('@arcgis/core/symbols/TextSymbol'),
            import('@arcgis/core/symbols/SimpleMarkerSymbol')
          ]).then(([GraphicModule, PointModule, TextSymbolModule, MarkerModule]) => {
            const point = new PointModule.default({
              longitude: mapCommand.location![0],
              latitude: mapCommand.location![1],
              spatialReference: { wkid: 4326 }
            });

            // Create marker symbol based on icon type
            const iconColors: Record<string, string> = {
              'pin': '#e53e3e',
              'flag': '#3182ce',
              'star': '#d69e2e',
              'marker': '#33a852',
              'campaign-hq': '#805ad5',
              'polling-place': '#dd6b20'
            };
            const color = iconColors[mapCommand.icon || 'marker'] || '#33a852';

            const markerSymbol = new MarkerModule.default({
              color: color,
              size: 14,
              outline: { color: 'white', width: 2 }
            });

            const textSymbol = new TextSymbolModule.default({
              text: mapCommand.label!,
              color: '#1a202c',
              haloColor: 'white',
              haloSize: 2,
              yoffset: 12,
              font: { size: 12, weight: 'bold' }
            });

            // Add marker graphic
            const markerGraphic = new GraphicModule.default({
              geometry: point,
              symbol: markerSymbol,
              attributes: { type: 'annotation', temporary: mapCommand.temporary }
            });

            // Add text graphic
            const textGraphic = new GraphicModule.default({
              geometry: point,
              symbol: textSymbol,
              attributes: { type: 'annotation-label', temporary: mapCommand.temporary }
            });

            mapState.view?.graphics.addMany([markerGraphic, textGraphic]);

            // Auto-remove temporary annotations after 30 seconds
            if (mapCommand.temporary) {
              setTimeout(() => {
                mapState.view?.graphics.remove(markerGraphic);
                mapState.view?.graphics.remove(textGraphic);
              }, 30000);
            }

            // Fly to the annotation
            mapState.view?.goTo({ center: point, zoom: 13 }, { animate: true })
              .then(() => {
                dispatchCommandExecuted('annotate', {
                  label: mapCommand.label,
                  location: mapCommand.location,
                  temporary: mapCommand.temporary
                });
              });
          });
        } else {
          console.warn('[PoliticalMapContainer] annotate command requires location and label');
        }
        break;
      }

      case 'pulseFeature': {
        // Animate attention to specific area with pulse effect
        if (mapCommand.target) {
          const pulseTarget = Array.isArray(mapCommand.target) ? mapCommand.target[0] : mapCommand.target;
          const pulseDuration = mapCommand.duration || 3000;
          const pulseColor = mapCommand.color || '#33a852';

          console.log('[PoliticalMapContainer] pulseFeature command:', pulseTarget, 'duration:', pulseDuration);

          // First, highlight the precinct
          setMapState((prev: MapState) => ({
            ...prev,
            selectedPrecinct: pulseTarget,
            selectedPrecincts: [pulseTarget],
          }));

          // Query for the precinct geometry and create pulse animation
          const choroplethLayer = mapState.view?.map
            ? getPrecinctChoroplethGeoJsonLayer(mapState.view.map)
            : undefined;

          if (choroplethLayer) {
            void (async () => {
              try {
                await choroplethLayer.load();
                const whereClause = await buildPaPrecinctWhereClause(pulseTarget);
                const query = choroplethLayer.createQuery();
                query.where = whereClause;
                query.returnGeometry = true;

                const result = await choroplethLayer.queryFeatures(query);
                if (result.features.length === 0) return;

                const geometry = result.features[0].geometry;

                // Import graphics modules for pulse animation
                const [GraphicsLayerModule, GraphicModule, FillSymbolModule] = await Promise.all([
                  import('@arcgis/core/layers/GraphicsLayer'),
                  import('@arcgis/core/Graphic'),
                  import('@arcgis/core/symbols/SimpleFillSymbol'),
                ]);

                const GraphicsLayer = GraphicsLayerModule.default;
                const Graphic = GraphicModule.default;
                const SimpleFillSymbol = FillSymbolModule.default;

                // Remove existing pulse layer
                const existingLayer = mapState.view?.map.findLayerById('pulse-visualization');
                if (existingLayer) {
                  mapState.view?.map.remove(existingLayer);
                }

                // Create pulse layer
                const pulseLayer = new GraphicsLayer({ id: 'pulse-visualization', title: 'Pulse Effect' });

                // Parse color (supports hex or named colors)
                const hexToRgb = (hex: string): [number, number, number] => {
                  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                  return result
                    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
                    : [51, 168, 82]; // Default green
                };
                const rgb = hexToRgb(pulseColor);

                // Create pulse graphic
                const pulseGraphic = new Graphic({
                  geometry: geometry,
                  symbol: new SimpleFillSymbol({
                    color: [rgb[0], rgb[1], rgb[2], 0.4],
                    outline: { color: [rgb[0], rgb[1], rgb[2], 1], width: 3 }
                  })
                });

                pulseLayer.add(pulseGraphic);
                mapState.view?.map.add(pulseLayer);

                // Fly to the feature
                await mapState.view?.goTo({ target: geometry, zoom: 13 }, { animate: true });

                // Create pulsing effect by animating opacity
                let pulseCount = 0;
                const maxPulses = Math.floor(pulseDuration / 400);
                let increasing = false;

                const pulseInterval = setInterval(() => {
                  if (pulseCount >= maxPulses) {
                    clearInterval(pulseInterval);
                    // Remove pulse layer after animation
                    setTimeout(() => {
                      mapState.view?.map.remove(pulseLayer);
                    }, 500);
                    dispatchCommandExecuted('pulseFeature', { target: pulseTarget, duration: pulseDuration });
                    return;
                  }

                  // Toggle opacity for pulse effect
                  const opacity = increasing ? 0.6 : 0.2;
                  increasing = !increasing;

                  pulseGraphic.symbol = new SimpleFillSymbol({
                    color: [rgb[0], rgb[1], rgb[2], opacity],
                    outline: { color: [rgb[0], rgb[1], rgb[2], increasing ? 1 : 0.6], width: increasing ? 4 : 2 }
                  });

                  pulseCount++;
                }, 400);
              } catch (error: unknown) {
                console.error('[PoliticalMapContainer] Error querying precinct for pulse:', error);
                toast({
                  title: 'Map Animation Failed',
                  description: 'Unable to highlight the requested precinct.',
                  variant: 'destructive',
                });
              }
            })();
          }
        } else {
          console.warn('[PoliticalMapContainer] pulseFeature command requires target');
        }
        break;
      }

      case 'showTemporal': {
        // Enable temporal visualization mode with optional auto-play
        if (mapCommand.metric) {
          console.log('[PoliticalMapContainer] showTemporal command:', mapCommand.metric, 'years:', mapCommand.years);

          // Enable temporal mode
          setIsTemporalMode(true);
          setShowLegend(true);

          // Set to the first year if years are specified
          if (mapCommand.years && mapCommand.years.length > 0) {
            setSelectedElectionYear(mapCommand.years[0]);
          }

          // Auto-play animation if requested
          if (mapCommand.autoPlay && mapCommand.years && mapCommand.years.length > 1) {
            setIsPlaying(true);
          }

          dispatchCommandExecuted('showTemporal', {
            metric: mapCommand.metric,
            years: mapCommand.years,
            autoPlay: mapCommand.autoPlay
          });
        } else {
          console.warn('[PoliticalMapContainer] showTemporal command requires metric');
        }
        break;
      }

      case 'setExtent': {
        // Set map to specific geographic bounds
        if (mapCommand.extent) {
          const { xmin, ymin, xmax, ymax } = mapCommand.extent;
          console.log('[PoliticalMapContainer] setExtent command:', mapCommand.extent);

          import('@arcgis/core/geometry/Extent').then((ExtentModule) => {
            const Extent = ExtentModule.default;
            const extent = new Extent({
              xmin,
              ymin,
              xmax,
              ymax,
              spatialReference: { wkid: 4326 }
            });

            mapState.view?.goTo(extent, { animate: true })
              .then(() => {
                dispatchCommandExecuted('setExtent', { extent: mapCommand.extent });
              })
              .catch((error: Error) => {
                console.error('[PoliticalMapContainer] Error setting extent:', error);
                // S8-003: Show toast notification on map command failure
                toast({
                  title: 'Map Zoom Failed',
                  description: 'Unable to zoom to the requested area. Please try again.',
                  variant: 'destructive',
                });
              });
          });
        } else {
          console.warn('[PoliticalMapContainer] setExtent command requires extent object');
        }
        break;
      }

      default:
        console.warn('[PoliticalMapContainer] Unknown map command type:', mapCommand.type);
    }
  }, [mapCommand, mapState.view, precinctCentroids]);

  // Handle precinct selection for AI mode
  const handlePrecinctClickForAI = useCallback(
    (precinctName: string, data: any) => {
      const isPA =
        data?.STATEFP === '42' ||
        data?.STATEFP === 42 ||
        (typeof data?.UNIQUE_ID === 'string' && data.UNIQUE_ID.includes('-:-'));
      const precinctInfo = {
        precinctId: data?.precinct_id || data?.UNIQUE_ID || data?.id || precinctName,
        precinctName: data?.precinct_name || data?.NAME || precinctName,
        county: isPA ? 'Pennsylvania' : data?.county || 'Ingham',
        attributes: data,
      };

      // Internal state update
      setMapState((prev: MapState) => ({
        ...prev,
        selectedPrecinct: precinctName,
        selectedPrecincts: [precinctName],
      }));

      // Update panel state
      setSelectedPrecinctForPanel(precinctInfo);
      // Clear H3 selection when precinct is selected
      setSelectedH3CellForPanel(null);

      // Notify parent via original callback
      if (onPrecinctSelect) {
        onPrecinctSelect(precinctName);
      }

      // AI session host calls selectFeature once when selectedPrecinct updates — do not call
      // it here too or FEATURE_SELECTED fires twice and duplicate feature cards appear in chat.
      if (onPrecinctSelected) {
        onPrecinctSelected(precinctInfo);
      } else {
        const stateManager = getStateManager();
        stateManager.selectFeature({
          id: data?.precinct_id || data?.UNIQUE_ID || data?.id || precinctName,
          name: data?.precinct_name || data?.NAME || precinctName,
          featureType: 'precinct',
          metrics: {
            registered_voters: data?.registered_voters,
            turnout: data?.turnout,
            partisan_lean: data?.partisan_lean,
            swing_potential: data?.swing_potential,
            gotv_priority: data?.gotv_priority,
            persuasion_opportunity: data?.persuasion_opportunity,
            municipality: data?.municipality,
            targeting_strategy: data?.targeting_strategy,
          },
          raw: data,
        });
      }

      console.log('[PoliticalMapContainer] Precinct selected (Phase G):', precinctName, data);
    },
    [onPrecinctSelect, onPrecinctSelected]
  );

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setMapState((prev: MapState) => ({
      ...prev,
      selectedPrecinct: null,
      selectedPrecincts: [],
    }));
    setSelectedPrecinctForPanel(null);
    setSelectedH3CellForPanel(null);

    // Dispatch FEATURE_DESELECTED to state manager (Phase G)
    const stateManager = getStateManager();
    stateManager.deselectFeature();

    if (onPrecinctSelected) {
      onPrecinctSelected(null);
    }
  }, [onPrecinctSelected]);

  // Compute height style
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  if (mapState.error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50 text-red-700 p-4">
        <div className="text-center">
          <p className="font-semibold">Map Error</p>
          <p className="text-xs">{mapState.error}</p>
          <button
            onClick={() => {
              initializeMap().catch((err) => {
                console.error('[PoliticalMapContainer] Retry failed:', err);
              });
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="relative w-full h-full" style={{ height: heightStyle }}>
      {/* Map container */}
      <div ref={mapRef} className="absolute inset-0" />

      {/* Segment Info Banner */}
      {segmentPrecinctIds && segmentPrecinctIds.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg px-4 py-2 z-30 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#33a852]" />
          <span className="text-xs font-medium text-gray-700">
            Viewing segment: {segmentPrecinctIds.length} precinct{segmentPrecinctIds.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={clearSegmentView}
            className="text-gray-500 hover:text-gray-700 text-xs font-medium ml-2 px-2 py-0.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Clear segment view"
          >
            Clear
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {(mapState.isLoading || isHighlightingSegment) && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#33a852] mx-auto" />
            <p className="mt-4 text-gray-600 font-medium text-xs">
              {isHighlightingSegment ? 'Loading segment view...' : 'Loading political data...'}
            </p>
          </div>
        </div>
      )}

      {/* Precinct Choropleth Layer */}
      {mapState.view && activeLayer === 'choropleth' && (
        <PrecinctChoroplethLayer
          view={mapState.view}
          visible={true}
          opacity={choroplethOpacity}
          showLabels={showLabels}
          selectedPrecinctName={mapState.selectedPrecinct || undefined}
          onPrecinctClick={enableAIMode ? handlePrecinctClickForAI : handlePrecinctClick}
          enablePopup={!enableAIMode} // Phase G: Disable popups in AI mode, use FeatureSelectionCard instead
          temporalConfig={isTemporalMode ? {
            enabled: true,
            electionYear: selectedElectionYear,
            metric: temporalMetric,
          } : undefined}
        />
      )}

      {/* H3 Heatmap Layer */}
      {mapState.view && activeLayer === 'h3' && (
        <H3HeatmapLayer
          view={mapState.view}
          metric={h3Metric}
          visible={true}
          opacity={h3Opacity}
          onCellClick={handleH3CellClick}
        />
      )}


      {/* Uploaded Layers Renderer */}
      {mapState.view && uploadedLayers.length > 0 && (
        <UploadedLayerRenderer view={mapState.view} layers={uploadedLayers} />
      )}

      {/* Numbered Marker Layer - AI-coordinated markers for ranked lists */}
      {mapState.view && numberedMarkers.length > 0 && (
        <NumberedMarkerLayer
          view={mapState.view}
          markers={numberedMarkers}
          precinctCentroids={precinctCentroids}
          visible={true}
        />
      )}

      {/* Layer Toolbar - Top of Map (Two Rows) */}
      <div className="absolute top-0 left-0 right-0 z-20" data-tour="map-toolbar">
        {/* Row 1: Layer type selection and metric/preset selectors */}
        <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 px-3 py-1.5 flex items-center gap-3 text-xs">
          {/* Layer Type Toggle */}
          <div className="flex items-center gap-1" data-tour="layer-toggle">
            <span className="text-gray-500 font-medium">Layer:</span>
            <div className="flex bg-gray-100 rounded-md p-0.5">
              <button
                onClick={() => handleLayerToggle('choropleth')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeLayer === 'choropleth'
                  ? 'bg-[#33a852] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                  }`}
                title="Precinct boundaries colored by targeting strategy"
              >
                Precincts
              </button>
              <button
                onClick={() => handleLayerToggle('h3')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeLayer === 'h3'
                  ? 'bg-[#33a852] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                  }`}
                title="H3 hexagonal heatmap for uniform visualization"
              >
                H3 Hexagons
              </button>
              <button
                onClick={() => handleLayerToggle('none')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeLayer === 'none'
                  ? 'bg-gray-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                  }`}
                title="Hide all layers"
              >
                Off
              </button>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="h-5 w-px bg-gray-300" />

          {/* H3 Metric Selector - Only when H3 active */}
          {activeLayer === 'h3' && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Metric:</span>
                <select
                  value={h3Metric}
                  onChange={e => setH3Metric(e.target.value as H3Metric)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#33a852]"
                >
                  <option value="partisan_lean">Partisan Lean</option>
                  <option value="gotv_priority">GOTV Priority</option>
                  <option value="persuasion_opportunity">Persuasion</option>
                  <option value="combined_score">Combined</option>
                </select>
              </div>
              <div className="h-4 w-px bg-gray-300" />
            </>
          )}

          {/* Bivariate Preset Selector */}
          {activeLayer === 'bivariate' && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Preset:</span>
                <select
                  value={Object.keys(BIVARIATE_PRESETS).find(k =>
                    BIVARIATE_PRESETS[k].xMetric === bivariateConfig.xMetric &&
                    BIVARIATE_PRESETS[k].yMetric === bivariateConfig.yMetric
                  ) || 'gotv_targets'}
                  onChange={e => setBivariateConfig(BIVARIATE_PRESETS[e.target.value])}
                  className="px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="gotv_targets">GOTV Targets (Partisan × Turnout)</option>
                  <option value="persuasion_gotv">Persuasion × GOTV</option>
                  <option value="swing_turnout">Swing × Turnout</option>
                  <option value="income_education">Income × Education</option>
                </select>
              </div>
              <div className="h-4 w-px bg-gray-300" />
            </>
          )}

          {/* Proportional Preset Selector */}
          {activeLayer === 'proportional' && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Preset:</span>
                <select
                  value={Object.keys(PROPORTIONAL_PRESETS).find(k =>
                    PROPORTIONAL_PRESETS[k].sizeMetric === proportionalConfig.sizeMetric &&
                    PROPORTIONAL_PRESETS[k].colorMetric === proportionalConfig.colorMetric
                  ) || 'voter_population'}
                  onChange={e => setProportionalConfig(PROPORTIONAL_PRESETS[e.target.value])}
                  className="px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="voter_population">Voters × Partisan Lean</option>
                  <option value="gotv_population">Voters × GOTV Priority</option>
                  <option value="canvass_turnout">Doors × Contact Rate</option>
                  <option value="donor_concentration">Donations × Avg Gift</option>
                </select>
              </div>
              <div className="h-4 w-px bg-gray-300" />
            </>
          )}

          {/* Value-by-Alpha Preset Selector */}
          {activeLayer === 'valueByAlpha' && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Preset:</span>
                <select
                  value={Object.keys(VALUE_BY_ALPHA_PRESETS).find(k =>
                    VALUE_BY_ALPHA_PRESETS[k].valueMetric === valueByAlphaConfig.valueMetric &&
                    VALUE_BY_ALPHA_PRESETS[k].alphaMetric === valueByAlphaConfig.alphaMetric
                  ) || 'partisan_confidence'}
                  onChange={e => setValueByAlphaConfig(VALUE_BY_ALPHA_PRESETS[e.target.value])}
                  className="px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="partisan_confidence">Partisan × Confidence</option>
                  <option value="turnout_sample_size">Turnout × Sample Size</option>
                  <option value="gotv_data_quality">GOTV × Data Quality</option>
                  <option value="swing_voter_count">Swing × Voter Count</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Row 2: Controls (Opacity, Labels, Time, Boundaries, Upload) */}
        <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 px-3 py-1 flex items-center gap-3 text-xs">
          {/* Opacity Control */}
          {activeLayer !== 'none' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={activeLayer === 'h3' ? h3Opacity : choroplethOpacity}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (activeLayer === 'h3') {
                      setH3Opacity(val);
                    } else {
                      setChoroplethOpacity(val);
                    }
                  }}
                  className="w-16 h-1.5 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #33a852 0%, #33a852 ${(activeLayer === 'h3' ? h3Opacity : choroplethOpacity) * 100}%, #e5e7eb ${(activeLayer === 'h3' ? h3Opacity : choroplethOpacity) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <span className="text-gray-600 w-8">{Math.round((activeLayer === 'h3' ? h3Opacity : choroplethOpacity) * 100)}%</span>
                <style dangerouslySetInnerHTML={{
                  __html: `
                  input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #33a852;
                    border: 2px solid white;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                    cursor: pointer;
                  }
                  input[type="range"]::-moz-range-thumb {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #33a852;
                    border: 2px solid white;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                    cursor: pointer;
                  }
                ` }} />
              </div>
            </>
          )}

          {/* Labels toggle for choropleth */}
          {activeLayer === 'choropleth' && (
            <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer hover:text-gray-800">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={e => setShowLabels(e.target.checked)}
                className="rounded accent-[#33a852] w-3 h-3"
              />
              Labels
            </label>
          )}

          {/* Divider before Time */}
          <div className="h-4 w-px bg-gray-300" />

          {/* Temporal Mode Toggle & Controls */}
          {activeLayer !== 'none' && (
            <>
              {/* <button
                onClick={handleTemporalToggle}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${isTemporalMode
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
                title="Toggle time-series mode to show election data by year"
                data-tour="temporal-toggle"
              >
                <Clock className="w-3.5 h-3.5" />
                Time
              </button> */}

              {/* Temporal Controls - Only when temporal mode is active */}
              {isTemporalMode && (
                <>
                  <div className="h-4 w-px bg-gray-300" />

                  {/* Year Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Year:</span>
                    <select
                      value={selectedElectionYear}
                      onChange={(e) => {
                        setIsPlaying(false);
                        setSelectedElectionYear(parseInt(e.target.value));
                      }}
                      className="px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {availableElectionYears.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  {/* Metric Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Show:</span>
                    <select
                      value={temporalMetric}
                      onChange={(e) => setTemporalMetric(e.target.value as 'margin' | 'turnout' | 'demPct')}
                      className="px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="margin">Margin</option>
                      <option value="turnout">Turnout</option>
                      <option value="demPct">Dem %</option>
                    </select>
                  </div>

                  <div className="h-4 w-px bg-gray-300" />

                  {/* Playback Controls */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setSelectedElectionYear(availableElectionYears[0]);
                      }}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                      title="Go to start"
                    >
                      <SkipBack className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleTemporalStepBack}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                      title="Previous year"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleTemporalPlayPause}
                      className={`p-1 rounded ${isPlaying
                        ? 'bg-purple-500 text-white'
                        : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                      title={isPlaying ? 'Pause' : 'Play animation'}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={handleTemporalStepForward}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                      title="Next year"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setSelectedElectionYear(availableElectionYears[availableElectionYears.length - 1]);
                      }}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                      title="Go to end"
                    >
                      <SkipForward className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Timeline indicator */}
                  <div className="flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-full">
                    <span className="text-purple-700 font-medium">{selectedElectionYear}</span>
                    <span className="text-purple-500 text-[10px]">
                      {availableElectionYears.indexOf(selectedElectionYear) + 1}/{availableElectionYears.length}
                    </span>
                  </div>
                </>
              )}
            </>
          )}

          {/* Boundary Layer Badge */}
          {selectedBoundaryType && selectedBoundaryIds.length > 0 && (
            <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="text-emerald-700 capitalize">{selectedBoundaryType.replace('_', ' ')}</span>
              <span className="text-emerald-600">({selectedBoundaryIds.length})</span>
              <button
                onClick={() => handleBoundarySelectionChange(null, [])}
                className="ml-1 text-emerald-500 hover:text-emerald-700"
                title="Clear boundary selection"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Spacer to push right-side items */}
          <div className="flex-1" />

          {/* Uploaded Layers Badge */}
          {uploadedLayers.length > 0 && (
            <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full text-blue-700">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{uploadedLayers.length} layer{uploadedLayers.length > 1 ? 's' : ''}</span>
              <button
                onClick={() => setShowLayerControls(!showLayerControls)}
                className="ml-1 text-blue-500 hover:text-blue-700"
                title="Manage layers"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          )}

          {/* Basemap Selector */}
          <div className="flex items-center gap-1" data-tour="basemap-selector">
            <span className="text-gray-500 font-medium">Base:</span>
            <select
              value={currentBasemap}
              onChange={e => setCurrentBasemap(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#33a852]"
              title="Change basemap style"
            >
              <option value="gray-vector">Light Gray</option>
              <option value="dark-gray-vector">Dark Gray</option>
              <option value="streets-vector">Streets</option>
              <option value="topo-vector">Topographic</option>
              <option value="satellite">Satellite</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>

          {/* Divider before Upload */}
          {/* <div className="h-4 w-px bg-gray-300" /> */}

          {/* Upload Button */}
          {/* <button
            onClick={() => setShowUploader(!showUploader)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${showUploader
              ? 'bg-[#33a852] text-white'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
            title="Upload Data File"
            data-tour="upload-button"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload
          </button> */}
        </div>
      </div>

      {/* Upload Panel - Dropdown from toolbar (positioned below 2-row toolbar) */}
      {/* {showUploader && (
        <div className="absolute top-[72px] right-3 z-30 w-72">
          <div className="bg-white rounded-lg shadow-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-800">Upload Data File</h3>
              <button
                onClick={() => setShowUploader(false)}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <GeoFileUploader
              onLayerAdded={handleLayerAdded}
              onError={handleUploadError}
              maxFileSizeMB={10}
            />
            {uploadError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {uploadError}
              </div>
            )}
          </div>
        </div>
      )} */}

      {/* Uploaded Layers Panel - Dropdown from toolbar (positioned below 2-row toolbar) */}
      {uploadedLayers.length > 0 && showLayerControls && (
        <div className="absolute top-[72px] right-20 z-30">
          <UploadedLayersPanel
            layers={uploadedLayers}
            onToggleVisibility={handleToggleLayerVisibility}
            onRemoveLayer={handleRemoveLayer}
          />
        </div>
      )}

      {/* Legend - Bottom Left (only show when a layer is active) */}
      <div className="absolute bottom-4 left-4 z-20">
        {showLegend && activeLayer !== 'none' ? (
          <div className="bg-white rounded-xl shadow-lg">
            {/* Legend Header with Minimize Button */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-700">
                {activeLayer === 'choropleth' ? 'Target Strategies' :
                  activeLayer === 'bivariate' ? `${bivariateConfig.xLabel} × ${bivariateConfig.yLabel}` :
                    activeLayer === 'proportional' ? `${proportionalConfig.sizeLabel} × ${proportionalConfig.colorLabel}` :
                      activeLayer === 'valueByAlpha' ? `${valueByAlphaConfig.valueLabel} (by ${valueByAlphaConfig.alphaLabel})` :
                        h3Metric === 'partisan_lean' ? 'Partisan Lean' :
                          h3Metric === 'swing_potential' ? 'Swing Potential' :
                            h3Metric === 'gotv_priority' ? 'GOTV Priority' :
                              h3Metric === 'persuasion_opportunity' ? 'Persuasion Opportunity' :
                                'Combined Score'}
              </span>
              <button
                onClick={() => setShowLegend(false)}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                title="Minimize legend"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
            </div>
            {/* Legend Content */}
            <div className="p-3">
              {activeLayer === 'choropleth' && <PrecinctChoroplethLegend />}
              {activeLayer === 'h3' && (
                <div className="flex items-center gap-1 text-xs">
                  {h3Metric === 'partisan_lean' ? (
                    <>
                      <span className="text-red-600 font-medium">R +100</span>
                      <div
                        className="h-3 w-28"
                        style={{
                          background: 'linear-gradient(to right, #b91c1c, #f87171, #a855f7, #93c5fd, #1e40af)',
                        }}
                      />
                      <span className="text-blue-600 font-medium">D +100</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs">0</span>
                      <div
                        className="h-2.5 w-20"
                        style={{
                          background:
                            h3Metric === 'swing_potential'
                              ? 'linear-gradient(to right, #c084fc, #9333ea, #6b21a8)'
                              : h3Metric === 'gotv_priority'
                                ? 'linear-gradient(to right, #fef3c7, #f59e0b, #b45309)'
                                : h3Metric === 'persuasion_opportunity'
                                  ? 'linear-gradient(to right, #faf5ff, #a855f7, #6b21a8)'
                                  : 'linear-gradient(to right, #f0f9ff, #38bdf8, #0369a1)',
                        }}
                      />
                      <span>100</span>
                    </>
                  )}
                </div>
              )}
              {activeLayer === 'bivariate' && (
                <BivariateLegend config={bivariateConfig} />
              )}
              {activeLayer === 'proportional' && (
                <ProportionalLegend config={proportionalConfig} />
              )}
              {activeLayer === 'valueByAlpha' && (
                <ValueByAlphaLegend config={valueByAlphaConfig} />
              )}
            </div>
          </div>
        ) : (
          /* Minimized Legend Button */
          <button
            onClick={() => setShowLegend(true)}
            className="bg-white rounded-xl shadow-lg p-2 hover:bg-gray-50"
            title="Show legend"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
        )}
      </div>

      {/* Political Analysis Panel - Right Side (IQBuilder) - only show if not hidden */}
      {!hideAnalysisPanel && (
        <div className="absolute top-4 right-4 z-20">
          {analysisPanelOpen && mapState.view ? (
            <div className="w-[380px] bg-white rounded-xl shadow-xl flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
              {/* Minimize Button */}
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={() => setAnalysisPanelOpen(false)}
                  className="p-1 bg-white hover:bg-emerald-100 rounded-full shadow-sm text-gray-500 hover:text-gray-700 transition-colors"
                  title="Minimize panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
              </div>
              <PoliticalAnalysisPanel
                view={mapState.view}
                onAreaAnalyzed={handleAreaAnalysis}
                selectedPrecinct={selectedPrecinctForPanel}
                selectedH3Cell={selectedH3CellForPanel}
                onClearSelection={handleClearSelection}
                onBoundarySelectionChange={handleBoundarySelectionChange}
                enableAIMode={enableAIMode}
                onIQAction={onIQAction}
              />
            </div>
          ) : (
            <button
              onClick={() => setAnalysisPanelOpen(true)}
              className="bg-white rounded-xl shadow-lg p-2 hover:bg-gray-50"
              title="Show analysis panel"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PoliticalMapContainer;
