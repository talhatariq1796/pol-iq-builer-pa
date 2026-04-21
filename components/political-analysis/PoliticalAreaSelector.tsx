/**
 * PoliticalAreaSelector Component
 *
 * Main orchestrator for political analysis area selection.
 * Supports 4 selection methods matching CMA workflow:
 * 1. Click on Map + Buffer
 * 2. Draw on Map
 * 3. Search Address
 * 4. Select from Boundaries
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  MapPin,
  Pencil,
  Search,
  Layers,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Target,
  Car,
  PersonStanding,
  Circle as CircleIcon,
  Zap,
  MousePointer2,
} from 'lucide-react';

import { BoundaryLayerPicker, BOUNDARY_LAYERS } from './BoundaryLayerPicker';
import { BoundarySearch, BoundaryFeature } from './BoundarySearch';
import { LocationSearch, LocationResult } from '@/components/common/location-search';
import { useDrawing } from '@/hooks/useDrawing';
import type { Feature as GeoJSONFeature } from 'geojson';
import type { BoundaryLayerType, PoliticalAreaSelection } from '@/types/political';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { loadBoundaryFeatureCollection } from '@/lib/map/geojsonMergeLoader';

// ArcGIS imports for buffer creation
import Circle from '@arcgis/core/geometry/Circle';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import * as serviceArea from '@arcgis/core/rest/serviceArea';
import ServiceAreaParameters from '@arcgis/core/rest/support/ServiceAreaParameters';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';

type SelectionMethod = 'click-select' | 'click-buffer' | 'draw' | 'search' | 'boundary-select';
type BufferType = 'radius' | 'drivetime' | 'walktime';

interface PoliticalAreaSelectorProps {
  view: __esri.MapView;
  onAreaSelected: (selection: PoliticalAreaSelection) => void;
  onSelectionStarted?: () => void;
  onSelectionCanceled?: () => void;
  defaultMethod?: SelectionMethod;
  onBoundarySelectionChange?: (layerType: BoundaryLayerType | null, selectedIds: string[]) => void;
}

// Selection method configurations
const SELECTION_METHODS: Array<{
  id: SelectionMethod;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
    {
      id: 'click-select',
      label: 'Select',
      icon: <MousePointer2 className="h-3.5 w-3.5 shrink-0" />,
      description: 'Click areas on the map to select/multi-select them',
    },
    {
      id: 'click-buffer',
      label: 'Buffer',
      icon: <Target className="h-3.5 w-3.5 shrink-0" />,
      description: 'Click a point and create a radius or drive-time buffer',
    },
    {
      id: 'draw',
      label: 'Draw',
      icon: <Pencil className="h-3.5 w-3.5 shrink-0" />,
      description: 'Draw a custom polygon on the map',
    },
    {
      id: 'search',
      label: 'Search',
      icon: <Search className="h-3.5 w-3.5 shrink-0" />,
      description: 'Search for an address and create a buffer around it',
    },
    // {
    //   id: 'boundary-select',
    //   label: 'Boundaries',
    //   icon: <Layers className="h-3.5 w-3.5 shrink-0" />,
    //   description: 'Select from precincts, ZIP codes, or other boundaries',
    // },
  ];

// Buffer presets (miles for US users)
const RADIUS_OPTIONS = [
  { value: '0.5', label: '0.5 mi' },
  { value: '1', label: '1 mi' },
  { value: '2', label: '2 mi' },
  { value: '5', label: '5 mi' },
  { value: '10', label: '10 mi' },
];

const TIME_OPTIONS = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '20', label: '20 min' },
  { value: '30', label: '30 min' },
];

export function PoliticalAreaSelector({
  view,
  onAreaSelected,
  onSelectionStarted,
  onSelectionCanceled,
  defaultMethod = 'click-select',
  onBoundarySelectionChange,
}: PoliticalAreaSelectorProps) {
  // Selection state
  const [activeMethod, setActiveMethod] = useState<SelectionMethod>(defaultMethod);
  const [isSelecting, setIsSelecting] = useState(false);
  // When defaultMethod is click-select, enable click mode on mount so precincts load immediately
  const [clickSelectMode, setClickSelectMode] = useState(defaultMethod === 'click-select');
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingBuffer, setIsGeneratingBuffer] = useState(false);

  // Click/Search buffer state
  const [clickedPoint, setClickedPoint] = useState<__esri.Point | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<LocationResult | null>(null);
  const [bufferType, setBufferType] = useState<BufferType>('radius');
  const [bufferValue, setBufferValue] = useState('1');
  const [bufferGeometry, setBufferGeometry] = useState<__esri.Geometry | null>(null);

  // Draw state
  const [drawnGeometry, setDrawnGeometry] = useState<__esri.Geometry | null>(null);

  // Click-select: selected Pennsylvania precinct UNIQUE_IDs (matches unified / targeting keys).
  const [selectedPrecinctNames, setSelectedPrecinctNames] = useState<string[]>([]);
  const [selectedPrecinctFeatures, setSelectedPrecinctFeatures] = useState<BoundaryFeature[]>([]);
  /** H3 res-7 cell indices when the heatmap layer is clicked (parallel to precinct click-select). */
  const [selectedH3Indices, setSelectedH3Indices] = useState<string[]>([]);
  const [h3ClickFeatures, setH3ClickFeatures] = useState<BoundaryFeature[]>([]);
  const [clickSelectEventHandle, setClickSelectEventHandle] = useState<__esri.WatchHandle | null>(null);

  // Boundary selection state - default to null to prevent layer showing on load
  const [boundaryType, setBoundaryType] = useState<BoundaryLayerType | null>(null);
  const [boundaryFeatures, setBoundaryFeatures] = useState<BoundaryFeature[]>([]);
  const [selectedBoundaryIds, setSelectedBoundaryIds] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(true);  // Default to multi-select for checkbox behavior
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(false);

  // Use drawing hook
  const {
    startDrawing,
    cancelDrawing,
    resetDrawing,
    targetGeometry,
    empty: noDrawnGeometry,
  } = useDrawing({
    view,
    onGeometryCreated: (geometry) => {
      console.log('[PoliticalAreaSelector] Geometry created:', geometry?.type);
      if (activeMethod === 'draw') {
        setDrawnGeometry(geometry);
      } else if (activeMethod === 'click-buffer') {
        if (geometry.type === 'point') {
          setClickedPoint(geometry as __esri.Point);
        }
      }
    },
    onDrawingStarted: () => {
      setIsSelecting(true);
      onSelectionStarted?.();
    },
    onDrawingCanceled: () => {
      setIsSelecting(false);
      onSelectionCanceled?.();
    },
  });

  // Load boundary features when type changes
  useEffect(() => {
    if (activeMethod === 'boundary-select' && boundaryType) {
      loadBoundaryFeatures(boundaryType);
    }
  }, [activeMethod, boundaryType]);

  // Notify parent of boundary selection changes
  useEffect(() => {
    if (activeMethod === 'boundary-select' && onBoundarySelectionChange) {
      console.log('[PoliticalAreaSelector] Notifying boundary selection change:', {
        boundaryType,
        selectedBoundaryIds,
      });
      onBoundarySelectionChange(boundaryType, selectedBoundaryIds);
    }
  }, [activeMethod, boundaryType, selectedBoundaryIds, onBoundarySelectionChange]);

  // Auto-activate tools when switching tabs
  useEffect(() => {
    // Only auto-activate if we're not already in a selection state
    if (isSelecting) return;

    switch (activeMethod) {
      case 'click-select':
        // Auto-enable click-select mode
        setClickSelectMode(true);
        if (onBoundarySelectionChange) {
          if (selectedH3Indices.length > 0) {
            onBoundarySelectionChange('h3', selectedH3Indices);
          } else {
            onBoundarySelectionChange('precinct', selectedPrecinctNames);
          }
        }
        break;
      case 'click-buffer':
        // Auto-activate click mode when switching to Click+Buffer tab
        setClickedPoint(null);
        setBufferGeometry(null);
        startDrawing('point');
        break;
      case 'draw':
        // Auto-activate draw mode when switching to Draw tab
        setDrawnGeometry(null);
        startDrawing('polygon');
        break;
      case 'search':
        // For Search tab, focus the search input after a short delay
        // to ensure the tab content has rendered
        setTimeout(() => {
          const searchInput = document.querySelector(
            '[placeholder="Enter address, city, or place..."]'
          ) as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
        }, 100);
        break;
      // boundary-select: User must explicitly select a boundary type from dropdown
      // No auto-activation to keep map clean on initial load
    }
  }, [activeMethod, isSelecting, startDrawing, onBoundarySelectionChange, selectedPrecinctNames, selectedH3Indices]);

  // Click-select mode: Listen for map clicks on precinct layer
  useEffect(() => {
    if (!view || activeMethod !== 'click-select' || !clickSelectMode) {
      // Cleanup event listener when not in click-select mode
      if (clickSelectEventHandle) {
        clickSelectEventHandle.remove();
        setClickSelectEventHandle(null);
      }
      return;
    }

    // Load precincts data for click-select using PoliticalDataService (single source of truth)
    // Merges unified precinct data (scores) with GeoJSON boundaries (geometry)
    const loadPrecincts = async () => {
      try {
        // Use PA boundary config (same as Boundaries tab) so geometry always has UNIQUE_ID.
        // politicalDataService.loadPrecinctBoundaries() may still resolve legacy blob URLs.
        const [unifiedPrecincts, boundaries] = await Promise.all([
          politicalDataService.getUnifiedPrecinctData(),
          loadBoundaryFeatureCollection(BOUNDARY_LAYERS.precinct),
        ]);

        const unifiedByKey = new Map<
          string,
          (typeof unifiedPrecincts)[string]
        >();
        for (const [key, p] of Object.entries(unifiedPrecincts)) {
          unifiedByKey.set(key, p);
          const pid = p.id != null ? String(p.id) : '';
          if (pid !== '' && pid !== key) {
            unifiedByKey.set(pid, p);
          }
        }

        // Pennsylvania precinct boundaries: key geometry by UNIQUE_ID (matches targeting / unified data).
        const featuresList: Array<{ name: string; geometry: GeoJSON.Geometry }> = [];
        for (const feature of boundaries.features ?? []) {
          const id = feature.properties?.UNIQUE_ID;
          if (id != null && id !== '' && feature.geometry) {
            const key = String(id);
            featuresList.push({ name: key, geometry: feature.geometry });
          }
        }

        const features: BoundaryFeature[] = featuresList
          .map(({ name, geometry }) => {
            const precinct = unifiedByKey.get(name);
            if (!precinct) return null;
            return {
              id: precinct.id,
              name: name,
              displayName: precinct.name,
              geometry,
              properties: {
                demographics: precinct.demographics,
                political: precinct.political,
                electoral: precinct.electoral,
                targeting: precinct.targeting,
              },
              partisanLean: precinct.electoral.partisanLean,
              swingPotential: precinct.electoral.swingPotential,
            };
          })
          .filter((f): f is BoundaryFeature => f != null);

        setBoundaryFeatures(features);
        console.log(
          `[PoliticalAreaSelector] Loaded ${features.length} precincts with geometry (PA ${BOUNDARY_LAYERS.precinct.dataPath}; ${Object.keys(unifiedPrecincts).length} unified, ${boundaries.features?.length ?? 0} boundary features)`,
        );

        try {
          const h3Fc = await politicalDataService.loadH3GeoJSON();
          const h3Feats: BoundaryFeature[] = (h3Fc.features || [])
            .map((f: GeoJSONFeature) => {
              const hid = f.properties && String((f.properties as Record<string, unknown>).h3_index ?? '');
              if (!hid || !f.geometry) return null;
              const p = f.properties as Record<string, unknown>;
              return {
                id: hid,
                name: hid,
                displayName: `H3 ${hid.length > 12 ? `${hid.slice(0, 10)}…` : hid}`,
                geometry: f.geometry,
                properties: p,
                partisanLean: typeof p.partisan_lean === 'number' ? p.partisan_lean : undefined,
                swingPotential: typeof p.swing_potential === 'number' ? p.swing_potential : undefined,
              } as BoundaryFeature;
            })
            .filter((f): f is BoundaryFeature => f != null);
          setH3ClickFeatures(h3Feats);
          console.log(`[PoliticalAreaSelector] Loaded ${h3Feats.length} H3 cells for click-select`);
        } catch (h3Err) {
          console.warn('[PoliticalAreaSelector] Could not load H3 GeoJSON for click-select:', h3Err);
          setH3ClickFeatures([]);
        }
      } catch (e) {
        console.warn('[PoliticalAreaSelector] Could not load precincts for click-select:', e);
      }
    };
    loadPrecincts();

    // Set up click handler - hitTest on the view to detect precinct features
    const handle = view.on('click', async (event) => {
      try {
        // Hit test to find clicked features (precinct GeoJSON, H3 GeoJSON, feature layers)
        const hitResponse = await view.hitTest(event, {
          include: view.map.allLayers.filter(layer =>
            layer.title?.toLowerCase().includes('precinct') ||
            layer.title?.toLowerCase().includes('h3') ||
            layer.type === 'feature' ||
            layer.type === 'geojson'
          ).toArray()
        });

        if (!hitResponse.results || hitResponse.results.length === 0) {
          return;
        }

        const getAttrs = (r: { graphic?: __esri.Graphic }) =>
          r.graphic?.attributes as Record<string, unknown> | undefined;

        const h3Hit = hitResponse.results.find((result: { graphic?: __esri.Graphic }) => {
          const a = getAttrs(result);
          return a?.h3_index != null && String(a.h3_index) !== '';
        });

        if (h3Hit) {
          const attrs = getAttrs(h3Hit);
          const h3Id = attrs ? String(attrs.h3_index) : '';
          if (h3Id) {
            setSelectedPrecinctNames([]);
            setSelectedH3Indices((prev: string[]) => {
              if (prev.includes(h3Id)) {
                return prev.filter((n) => n !== h3Id);
              }
              return [...prev, h3Id];
            });
            console.log('[PoliticalAreaSelector] Click-select toggled H3 cell:', h3Id);
          }
          return;
        }

        const precinctResult = hitResponse.results.find((result: { graphic?: __esri.Graphic }) => {
          const attrs = getAttrs(result);
          return attrs?.UNIQUE_ID || attrs?.precinct_name || attrs?.NAME;
        });

        if (precinctResult) {
          const attrs = getAttrs(precinctResult);
          if (!attrs) return;
          const precinctId =
            attrs.UNIQUE_ID != null && attrs.UNIQUE_ID !== ''
              ? String(attrs.UNIQUE_ID)
              : attrs.precinct_name != null && attrs.precinct_name !== ''
                ? String(attrs.precinct_name)
                : attrs.NAME != null && attrs.NAME !== ''
                  ? String(attrs.NAME)
                  : null;

          if (precinctId) {
            setSelectedH3Indices([]);
            setSelectedPrecinctNames((prev: string[]) => {
              if (prev.includes(precinctId)) {
                return prev.filter((n) => n !== precinctId);
              }
              return [...prev, precinctId];
            });

            console.log('[PoliticalAreaSelector] Click-select toggled precinct:', precinctId);
          }
        }
      } catch (e) {
        console.warn('[PoliticalAreaSelector] Hit test error:', e);
      }
    });

    setClickSelectEventHandle(handle);

    return () => {
      handle.remove();
    };
  }, [view, activeMethod, clickSelectMode]);

  // Notify parent when click-select selection changes (precinct or H3 hex)
  useEffect(() => {
    if (activeMethod !== 'click-select' || !onBoundarySelectionChange) {
      return;
    }
    if (selectedH3Indices.length > 0) {
      onBoundarySelectionChange('h3', selectedH3Indices);
    } else {
      onBoundarySelectionChange('precinct', selectedPrecinctNames);
    }
  }, [activeMethod, selectedPrecinctNames, selectedH3Indices, onBoundarySelectionChange]);

  // Load boundary layer GeoJSON and transform to features
  const loadBoundaryFeatures = async (type: BoundaryLayerType) => {
    setIsLoadingBoundaries(true);
    setError(null);
    setBoundaryFeatures([]);

    try {
      const config = BOUNDARY_LAYERS[type];
      let geojson: GeoJSON.FeatureCollection;
      try {
        geojson = await loadBoundaryFeatureCollection(config);
      } catch {
        const hint =
          config.dataPaths?.length && config.dataPaths.length > 0
            ? config.dataPaths.join(', ')
            : config.dataPath;
        console.info(`${config.pluralName} data not yet available: ${hint}`);
        setError(`${config.pluralName} data not yet available for this area`);
        setBoundaryFeatures([]);
        setIsLoadingBoundaries(false);
        return;
      }

      // Load political scores for precincts using PoliticalDataService (single source of truth)
      let scores: Record<string, any> = {};
      let scoreByPrecinctId = new Map<string, (typeof scores)[string]>();
      if (type === 'precinct') {
        try {
          const unifiedPrecincts = await politicalDataService.getUnifiedPrecinctData();
          // Transform to match expected structure
          scores = Object.fromEntries(
            Object.entries(unifiedPrecincts).map(([name, p]) => [
              name,
              {
                electoral: {
                  partisanLean: p.electoral.partisanLean,
                  swingPotential: p.electoral.swingPotential,
                  competitiveness: p.electoral.competitiveness,
                },
                targeting: {
                  gotvPriority: p.targeting.gotvPriority,
                  persuasionOpportunity: p.targeting.persuasionOpportunity,
                  strategy: p.targeting.strategy,
                },
                demographics: p.demographics,
              },
            ])
          );
          scoreByPrecinctId = new Map(Object.entries(scores));
          for (const [k, row] of Object.entries(scores)) {
            const u = unifiedPrecincts[k];
            if (u?.id && String(u.id) !== k) {
              scoreByPrecinctId.set(String(u.id), row);
            }
          }
          console.log(`[PoliticalAreaSelector] Loaded scores for ${Object.keys(scores).length} precincts`);
        } catch (e) {
          console.warn('Could not load political scores:', e);
        }
      }

      // Transform GeoJSON features
      const features: BoundaryFeature[] = (geojson.features || []).map((f: any) => {
        const id = String(f.properties[config.idField] || f.id || Math.random());
        const name = String(f.properties[config.nameField] || id);

        // Get scores for this feature (precincts only)
        const featureScores =
          type === 'precinct'
            ? scoreByPrecinctId.get(id) || {}
            : {};

        // Extract political metrics from precinct data structure
        const partisanLean = featureScores.electoral?.partisanLean;
        const swingPotential = featureScores.electoral?.swingPotential;

        // Map GOTV priority to targeting priority category
        let targetingPriority: 'High' | 'Medium-High' | 'Medium' | 'Low' | undefined;
        if (featureScores.targeting?.gotvPriority !== undefined) {
          const priority = featureScores.targeting.gotvPriority;
          if (priority >= 75) targetingPriority = 'High';
          else if (priority >= 60) targetingPriority = 'Medium-High';
          else if (priority >= 40) targetingPriority = 'Medium';
          else targetingPriority = 'Low';
        }

        return {
          id,
          name,
          displayName: name,
          geometry: f.geometry,
          properties: f.properties,
          partisanLean,
          swingPotential,
          targetingPriority,
        };
      });

      // Sort by name
      features.sort((a, b) => a.displayName.localeCompare(b.displayName));

      setBoundaryFeatures(features);
    } catch (err) {
      console.error('Error loading boundaries:', err);
      setError(`Failed to load ${BOUNDARY_LAYERS[type].pluralName.toLowerCase()}`);
    } finally {
      setIsLoadingBoundaries(false);
    }
  };

  // Handle boundary selection change
  const handleBoundarySelectionChange = useCallback((ids: string[]) => {
    setSelectedBoundaryIds(ids);
  }, []);

  // Handle boundary feature hover (highlight on map)
  const handleBoundaryHover = useCallback(
    (feature: BoundaryFeature | null) => {
      if (!view || !feature) return;
      // Could add highlight logic here
    },
    [view]
  );

  // Handle boundary feature click (zoom to feature)
  const handleBoundaryClick = useCallback(
    (feature: BoundaryFeature) => {
      if (!view || !feature.geometry) return;

      // Zoom to feature extent
      try {
        const coords = feature.geometry.type === 'Polygon'
          ? (feature.geometry as GeoJSON.Polygon).coordinates[0]
          : feature.geometry.type === 'MultiPolygon'
            ? (feature.geometry as GeoJSON.MultiPolygon).coordinates[0][0]
            : null;

        if (coords) {
          const xs = coords.map((c) => c[0]);
          const ys = coords.map((c) => c[1]);
          const extent = {
            xmin: Math.min(...xs),
            ymin: Math.min(...ys),
            xmax: Math.max(...xs),
            ymax: Math.max(...ys),
            spatialReference: { wkid: 4326 },
          };
          view.goTo(extent, { duration: 500 });
        }
      } catch (e) {
        console.warn('Could not zoom to feature:', e);
      }
    },
    [view]
  );

  // Handle click on map for click-buffer method
  const handleStartClickMode = useCallback(() => {
    setClickedPoint(null);
    setBufferGeometry(null);
    startDrawing('point');
  }, [startDrawing]);

  // Handle draw polygon
  const handleStartDrawPolygon = useCallback(() => {
    setDrawnGeometry(null);
    startDrawing('polygon');
  }, [startDrawing]);

  // Handle location search selection
  const handleLocationSelected = useCallback(
    async (location: LocationResult) => {
      setSearchedLocation(location);
      setBufferGeometry(null);

      // Create point from location
      const point = new Point({
        longitude: location.longitude,
        latitude: location.latitude,
        spatialReference: { wkid: 4326 },
      });

      // Project to map's spatial reference if needed
      if (view && point.spatialReference.wkid !== view.spatialReference.wkid) {
        const projection = await import('@arcgis/core/geometry/projection');
        await projection.load();
        const projected = projection.project(point, view.spatialReference) as Point;
        setClickedPoint(projected);
      } else {
        setClickedPoint(point);
      }

      // Add marker to map
      if (view) {
        view.graphics.removeAll();
        const pointGraphic = new Graphic({
          geometry: point,
          symbol: {
            type: 'simple-marker',
            color: [99, 102, 241], // Indigo
            outline: { color: [255, 255, 255], width: 2 },
            size: 12,
          } as any,
        });
        view.graphics.add(pointGraphic);

        // Zoom to location
        await view.goTo({
          target: point,
          zoom: 14,
        });
      }
    },
    [view]
  );

  // Generate buffer around clicked/searched point
  const generateBuffer = useCallback(async () => {
    if (!clickedPoint || !view) return;

    setIsGeneratingBuffer(true);
    setError(null);

    try {
      if (bufferType === 'radius') {
        // Create circular buffer (convert miles to meters: 1 mi = 1609.34 m)
        const radiusInMeters = parseFloat(bufferValue) * 1609.34;
        const circle = new Circle({
          center: clickedPoint,
          radius: radiusInMeters,
          radiusUnit: 'meters',
          spatialReference: view.spatialReference,
        });

        setBufferGeometry(circle);

        // Add buffer graphic to map
        view.graphics.removeAll();
        const bufferGraphic = new Graphic({
          geometry: circle,
          symbol: {
            type: 'simple-fill',
            color: [99, 102, 241, 0.2],
            outline: { color: [99, 102, 241], width: 2 },
          } as any,
        });
        const pointGraphic = new Graphic({
          geometry: clickedPoint,
          symbol: {
            type: 'simple-marker',
            color: [99, 102, 241],
            outline: { color: [255, 255, 255], width: 2 },
            size: 10,
          } as any,
        });
        view.graphics.addMany([bufferGraphic, pointGraphic]);

        // Zoom and center map on the buffer area
        if (circle.extent) {
          await view.goTo(circle.extent.expand(1.3), { duration: 500 });
        }
      } else {
        // Generate drive/walk time service area
        const serviceAreaUrl =
          'https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea';

        const featureSet = new FeatureSet({
          features: [new Graphic({ geometry: clickedPoint })],
        });

        const params = new ServiceAreaParameters({
          facilities: featureSet,
          defaultBreaks: [parseFloat(bufferValue)],
          travelDirection: 'from-facility',
          outSpatialReference: view.spatialReference,
          trimOuterPolygon: true,
          // travelMode requires TravelModeProperties object, not string - use default for now
          travelMode: undefined,
        });

        const response = await serviceArea.solve(serviceAreaUrl, params);

        if (response.serviceAreaPolygons?.features?.[0]?.geometry) {
          const saGeometry = response.serviceAreaPolygons.features[0].geometry;
          setBufferGeometry(saGeometry);

          // Add to map
          view.graphics.removeAll();
          const bufferGraphic = new Graphic({
            geometry: saGeometry,
            symbol: {
              type: 'simple-fill',
              color: [99, 102, 241, 0.2],
              outline: { color: [99, 102, 241], width: 2 },
            } as any,
          });
          const pointGraphic = new Graphic({
            geometry: clickedPoint,
            symbol: {
              type: 'simple-marker',
              color: [99, 102, 241],
              outline: { color: [255, 255, 255], width: 2 },
              size: 10,
            } as any,
          });
          view.graphics.addMany([bufferGraphic, pointGraphic]);

          // Zoom and center map on the service area
          if (saGeometry.extent) {
            await view.goTo(saGeometry.extent.expand(1.3), { duration: 500 });
          }
        } else {
          throw new Error('No service area generated');
        }
      }
    } catch (err) {
      console.error('Error generating buffer:', err);
      setError('Failed to generate buffer. Try using radius instead.');
    } finally {
      setIsGeneratingBuffer(false);
    }
  }, [clickedPoint, bufferType, bufferValue, view]);

  // Create area selection from selected boundaries
  const createBoundarySelection = useCallback((): PoliticalAreaSelection | null => {
    if (!boundaryType || selectedBoundaryIds.length === 0) return null;

    const selectedFeatures = boundaryFeatures.filter((f) =>
      selectedBoundaryIds.includes(f.id)
    );

    if (selectedFeatures.length === 0) return null;

    // Combine geometries if multiple selected
    let combinedGeometry: GeoJSON.Geometry;
    if (selectedFeatures.length === 1) {
      combinedGeometry = selectedFeatures[0].geometry;
    } else {
      // Union multiple geometries
      // For GeoJSON, we'll create a GeometryCollection or MultiPolygon
      const polygons: GeoJSON.Polygon[] = [];
      for (const feature of selectedFeatures) {
        if (feature.geometry.type === 'Polygon') {
          polygons.push(feature.geometry as GeoJSON.Polygon);
        } else if (feature.geometry.type === 'MultiPolygon') {
          for (const poly of (feature.geometry as GeoJSON.MultiPolygon).coordinates) {
            polygons.push({ type: 'Polygon', coordinates: poly });
          }
        }
      }
      combinedGeometry = {
        type: 'MultiPolygon',
        coordinates: polygons.map((p) => p.coordinates),
      } as GeoJSON.MultiPolygon;
    }

    // Generate display name
    let displayName: string;
    if (selectedFeatures.length === 1) {
      displayName = selectedFeatures[0].displayName;
    } else {
      displayName = `${selectedFeatures.length} ${BOUNDARY_LAYERS[boundaryType].pluralName}`;
    }

    return {
      geometry: combinedGeometry,
      method: 'boundary-select',
      displayName,
      metadata: {
        source: 'boundary-select',
        boundaryType,
        boundaryIds: selectedBoundaryIds,
        boundaryNames: selectedFeatures.map((f) => f.displayName),
      },
    };
  }, [boundaryType, selectedBoundaryIds, boundaryFeatures]);

  // Create selection from click-buffer or search
  const createBufferSelection = useCallback(async (): Promise<PoliticalAreaSelection | null> => {
    if (!bufferGeometry || !clickedPoint) return null;

    // Convert ArcGIS geometry to GeoJSON (project to WGS84 — buffer/draw use map SR, often 3857)
    const geojsonGeometry = await geometryToGeoJSON(bufferGeometry);
    if (!geojsonGeometry) return null;

    const displayName =
      bufferType === 'radius'
        ? `${bufferValue} mi radius`
        : bufferType === 'drivetime'
          ? `${bufferValue} min drive`
          : `${bufferValue} min walk`;

    return {
      geometry: geojsonGeometry,
      method: activeMethod === 'search' ? 'search' : 'click-buffer',
      displayName: searchedLocation?.address || displayName,
      metadata: {
        source: activeMethod,
        bufferType,
        bufferValue: parseFloat(bufferValue),
        bufferUnit: bufferType === 'radius' ? 'miles' : 'minutes',
        centroid: [clickedPoint.longitude ?? 0, clickedPoint.latitude ?? 0],
      },
    };
  }, [bufferGeometry, clickedPoint, bufferType, bufferValue, activeMethod, searchedLocation]);

  // Create selection from drawn geometry
  const createDrawSelection = useCallback(async (): Promise<PoliticalAreaSelection | null> => {
    if (!drawnGeometry) return null;

    const geojsonGeometry = await geometryToGeoJSON(drawnGeometry);
    if (!geojsonGeometry) return null;

    // Calculate area for display name
    const areaInSqKm = geometryEngine.geodesicArea(drawnGeometry as any, 'square-kilometers');
    const displayName = areaInSqKm > 0 ? `${areaInSqKm.toFixed(2)} km² area` : 'Drawn area';

    return {
      geometry: geojsonGeometry,
      method: 'draw',
      displayName,
      metadata: {
        source: 'draw',
        area: areaInSqKm,
      },
    };
  }, [drawnGeometry]);

  // Create selection from click-select precincts or H3 hex cells
  const createClickSelectSelection = useCallback((): PoliticalAreaSelection | null => {
    if (selectedH3Indices.length > 0) {
      const selectedSet = new Set(selectedH3Indices);
      const selectedFeatures = h3ClickFeatures.filter(
        (f) => selectedSet.has(f.name) || selectedSet.has(f.id),
      );

      if (selectedFeatures.length === 0) {
        console.warn('[PoliticalAreaSelector] No H3 features for indices:', selectedH3Indices);
        return null;
      }

      let combinedGeometry: GeoJSON.Geometry;
      if (selectedFeatures.length === 1 && selectedFeatures[0].geometry) {
        combinedGeometry = selectedFeatures[0].geometry;
      } else {
        const polygons: GeoJSON.Polygon[] = [];
        for (const feature of selectedFeatures) {
          if (!feature.geometry) continue;
          if (feature.geometry.type === 'Polygon') {
            polygons.push(feature.geometry as GeoJSON.Polygon);
          } else if (feature.geometry.type === 'MultiPolygon') {
            for (const poly of (feature.geometry as GeoJSON.MultiPolygon).coordinates) {
              polygons.push({ type: 'Polygon', coordinates: poly });
            }
          }
        }
        combinedGeometry = {
          type: 'MultiPolygon',
          coordinates: polygons.map((p) => p.coordinates),
        } as GeoJSON.MultiPolygon;
      }

      const displayName =
        selectedH3Indices.length === 1
          ? `H3 cell ${selectedH3Indices[0].slice(0, 10)}…`
          : `${selectedH3Indices.length} H3 cells`;

      return {
        geometry: combinedGeometry,
        method: 'click-select' as PoliticalAreaSelection['method'],
        displayName,
        metadata: {
          source: 'click-select',
          boundaryType: 'h3',
          boundaryIds: selectedH3Indices,
          boundaryNames: selectedH3Indices,
        },
      };
    }

    if (selectedPrecinctNames.length === 0) return null;

    const selectedSet = new Set(selectedPrecinctNames);
    const selectedFeatures = boundaryFeatures.filter(
      (f) => selectedSet.has(f.name) || selectedSet.has(f.id),
    );

    if (selectedFeatures.length === 0) {
      console.warn('[PoliticalAreaSelector] No features found for selected precincts:', selectedPrecinctNames);
      console.warn('[PoliticalAreaSelector] Available features:', boundaryFeatures.slice(0, 5).map(f => ({ id: f.id, name: f.name })));
      return null;
    }

    // Combine geometries if multiple selected
    let combinedGeometry: GeoJSON.Geometry;
    if (selectedFeatures.length === 1 && selectedFeatures[0].geometry) {
      combinedGeometry = selectedFeatures[0].geometry;
    } else {
      // Union multiple geometries
      const polygons: GeoJSON.Polygon[] = [];
      for (const feature of selectedFeatures) {
        if (!feature.geometry) continue;
        if (feature.geometry.type === 'Polygon') {
          polygons.push(feature.geometry as GeoJSON.Polygon);
        } else if (feature.geometry.type === 'MultiPolygon') {
          for (const poly of (feature.geometry as GeoJSON.MultiPolygon).coordinates) {
            polygons.push({ type: 'Polygon', coordinates: poly });
          }
        }
      }
      combinedGeometry = {
        type: 'MultiPolygon',
        coordinates: polygons.map((p) => p.coordinates),
      } as GeoJSON.MultiPolygon;
    }

    // Generate display name
    const displayName = selectedPrecinctNames.length === 1
      ? selectedPrecinctNames[0]
      : `${selectedPrecinctNames.length} Precincts`;

    return {
      geometry: combinedGeometry,
      method: 'click-select' as PoliticalAreaSelection['method'],
      displayName,
      metadata: {
        source: 'click-select',
        boundaryType: 'precinct',
        boundaryIds: selectedPrecinctNames,
        boundaryNames: selectedPrecinctNames,
      },
    };
  }, [selectedPrecinctNames, selectedH3Indices, boundaryFeatures, h3ClickFeatures]);

  // Handle analyze button click
  const handleAnalyze = useCallback(async () => {
    console.log('[PoliticalAreaSelector] Analyze button clicked, method:', activeMethod);
    let selection: PoliticalAreaSelection | null = null;

    switch (activeMethod) {
      case 'click-select':
        console.log('[PoliticalAreaSelector] Creating click-select selection, precincts:', selectedPrecinctNames.length);
        selection = createClickSelectSelection();
        break;
      case 'boundary-select':
        console.log('[PoliticalAreaSelector] Creating boundary selection, boundaries:', selectedBoundaryIds.length);
        selection = createBoundarySelection();
        break;
      case 'click-buffer':
      case 'search':
        console.log('[PoliticalAreaSelector] Creating buffer selection, hasBuffer:', !!bufferGeometry);
        selection = await createBufferSelection();
        break;
      case 'draw':
        console.log('[PoliticalAreaSelector] Creating draw selection, hasGeometry:', !!drawnGeometry);
        selection = await createDrawSelection();
        break;
    }

    if (selection) {
      console.log('[PoliticalAreaSelector] Selection created successfully:', selection.displayName);
      onAreaSelected(selection);
    } else {
      console.warn('[PoliticalAreaSelector] Failed to create selection - selection is null');
    }
  }, [
    activeMethod,
    selectedPrecinctNames.length,
    selectedH3Indices.length,
    selectedBoundaryIds.length,
    bufferGeometry,
    drawnGeometry,
    createClickSelectSelection,
    createBoundarySelection,
    createBufferSelection,
    createDrawSelection,
    onAreaSelected,
  ]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSelectedBoundaryIds([]);
    setSelectedPrecinctNames([]);
    setSelectedH3Indices([]);
    setClickSelectMode(false);
    setClickedPoint(null);
    setSearchedLocation(null);
    setBufferGeometry(null);
    setDrawnGeometry(null);
    setIsSelecting(false);
    cancelDrawing();
    view?.graphics.removeAll();
    // Notify parent about selection being cleared
    if (onBoundarySelectionChange && (activeMethod === 'boundary-select' || activeMethod === 'click-select')) {
      onBoundarySelectionChange(null, []);
    }
    onSelectionCanceled?.();
  }, [cancelDrawing, view, onSelectionCanceled, onBoundarySelectionChange, activeMethod]);

  // Check if selection is valid
  const isSelectionValid = (() => {
    switch (activeMethod) {
      case 'click-select':
        return selectedPrecinctNames.length > 0 || selectedH3Indices.length > 0;
      case 'boundary-select':
        return selectedBoundaryIds.length > 0;
      case 'click-buffer':
      case 'search':
        return !!bufferGeometry;
      case 'draw':
        return !!drawnGeometry;
      default:
        return false;
    }
  })();

  // Get current buffer options
  const bufferOptions = bufferType === 'radius' ? RADIUS_OPTIONS : TIME_OPTIONS;

  return (
    <div className="w-full space-y-4">

      {/* Method selection tabs */}
      <Tabs
        value={activeMethod}
        onValueChange={(v) => {
          setActiveMethod(v as SelectionMethod);
          // Reset state when changing methods
          handleCancel();
        }}
      >
        <TabsList className="grid grid-cols-4 w-full h-9">
          {SELECTION_METHODS.map((method) => (
            <TabsTrigger
              key={method.id}
              value={method.id}
              className="flex flex-row items-center justify-center gap-1 px-1 text-xs whitespace-nowrap"
            >
              {method.icon}
              <span className="hidden sm:inline leading-none">{method.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Click-Select tab (direct map click to select precincts) */}
        <TabsContent value="click-select" className="mt-4 space-y-4">
          <div className="text-center py-4">
            <MousePointer2 className="h-8 w-8 mx-auto mb-2 text-[#33a852]" />
            <p className="text-xs text-muted-foreground mb-2">
              Click areas on the map to select them
            </p>
            <p className="text-xs text-muted-foreground">
              Click again to deselect
            </p>
          </div>

          {selectedH3Indices.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">
                  {selectedH3Indices.length} H3 cell{selectedH3Indices.length !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedH3Indices([])}
                  className="text-xs h-7 px-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
                {selectedH3Indices.map((hid) => (
                  <div
                    key={hid}
                    className="flex items-center justify-between text-xs bg-violet-50 rounded px-2 py-1"
                  >
                    <span className="truncate font-mono text-[10px]">{hid}</span>
                    <button
                      onClick={() => setSelectedH3Indices((prev: string[]) => prev.filter((n) => n !== hid))}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPrecinctNames.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">
                  {selectedPrecinctNames.length} precinct{selectedPrecinctNames.length !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPrecinctNames([])}
                  className="text-xs h-7 px-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
                {selectedPrecinctNames.map((name) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1"
                  >
                    <span className="truncate">{name}</span>
                    <button
                      onClick={() => setSelectedPrecinctNames((prev: string[]) => prev.filter(n => n !== name))}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Click + Buffer tab */}
        <TabsContent value="click-buffer" className="mt-4 space-y-4">
          {!clickedPoint ? (
            <div className="text-center py-6">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-xs text-muted-foreground mb-4">
                Click on the map to place a point
              </p>
              <Button onClick={handleStartClickMode} variant="outline" className="text-xs">
                <Target className="h-4 w-4 mr-2" />
                Start Clicking
              </Button>
            </div>
          ) : (
            <>
              {/* Buffer type selector */}
              {/* <div className="space-y-2">
                <Label className="text-xs font-medium">Buffer Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={bufferType === 'radius' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBufferType('radius')}
                    className="flex items-center gap-1"
                  >
                    <CircleIcon className="h-3 w-3" />
                    Radius
                  </Button>
                  <Button
                    variant={bufferType === 'drivetime' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBufferType('drivetime')}
                    className="flex items-center gap-1"
                  >
                    <Car className="h-3 w-3" />
                    Drive
                  </Button>
                  <Button
                    variant={bufferType === 'walktime' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBufferType('walktime')}
                    className="flex items-center gap-1"
                  >
                    <PersonStanding className="h-3 w-3" />
                    Walk
                  </Button>
                </div>
              </div> */}

              {/* Buffer value selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {bufferType === 'radius' ? 'Distance' : 'Time'}
                </Label>
                <div className="flex gap-2">
                  <Select value={bufferValue} onValueChange={setBufferValue}>
                    <SelectTrigger className="flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {bufferOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={generateBuffer}
                    disabled={isGeneratingBuffer}
                    className="shrink-0 text-xs"
                  >
                    {isGeneratingBuffer ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Apply'
                    )}
                  </Button>
                </div>
              </div>

              {/* Reset button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setClickedPoint(null);
                  setBufferGeometry(null);
                  view?.graphics.removeAll();
                }}
                className="w-full text-xs"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Point
              </Button>
            </>
          )}
        </TabsContent>

        {/* Draw tab */}
        <TabsContent value="draw" className="mt-4 space-y-4">
          {!drawnGeometry ? (
            <div className="text-center py-6">
              <Pencil className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-xs text-muted-foreground mb-4">
                Draw a polygon on the map
              </p>
              <Button onClick={handleStartDrawPolygon} variant="outline" className="text-xs">
                <Pencil className="h-4 w-4 mr-2" />
                Draw Polygon
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Double-click to complete
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  Polygon drawn successfully
                </AlertDescription>
              </Alert>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDrawnGeometry(null);
                  resetDrawing();
                  view?.graphics.removeAll();
                }}
                className="w-full text-xs"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Drawing
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Search tab */}
        <TabsContent value="search" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Search Location</Label>
            <LocationSearch
              onLocationSelected={handleLocationSelected}
              placeholder="Enter address, city, or place..."
              className="w-full text-xs"
            />
          </div>

          {clickedPoint && (
            <>
              {searchedLocation && (
                <Alert>
                  <MapPin className="h-4 w-4" />
                  <AlertDescription className="text-xs truncate">
                    {searchedLocation.address}
                  </AlertDescription>
                </Alert>
              )}

              {/* Buffer type selector */}
              {/* <div className="space-y-2">
                <Label className="text-xs font-medium">Buffer Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={bufferType === 'radius' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBufferType('radius')}
                    className="flex items-center gap-1"
                  >
                    <CircleIcon className="h-3 w-3" />
                    Radius
                  </Button>
                  <Button
                    variant={bufferType === 'drivetime' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBufferType('drivetime')}
                    className="flex items-center gap-1"
                  >
                    <Car className="h-3 w-3" />
                    Drive
                  </Button>
                  <Button
                    variant={bufferType === 'walktime' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBufferType('walktime')}
                    className="flex items-center gap-1"
                  >
                    <PersonStanding className="h-3 w-3" />
                    Walk
                  </Button>
                </div>
              </div> */}

              {/* Buffer value selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {bufferType === 'radius' ? 'Distance' : 'Time'}
                </Label>
                <div className="flex gap-2">
                  <Select value={bufferValue} onValueChange={setBufferValue}>
                    <SelectTrigger className="flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {bufferOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={generateBuffer}
                    disabled={isGeneratingBuffer}
                    className="shrink-0 text-xs"
                  >
                    {isGeneratingBuffer ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Apply'
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* Boundary selection tab */}
        <TabsContent value="boundary-select" className="mt-4 space-y-4">
          {/* Layer picker */}
          <BoundaryLayerPicker
            value={boundaryType}
            onChange={setBoundaryType}
            disabled={isLoadingBoundaries}
          />

          {/* Multi-select toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="multi-select" className="text-xs">
              Multi-select (combine boundaries)
            </Label>
            <Switch
              id="multi-select"
              checked={multiSelect}
              onCheckedChange={(checked: boolean) => {
                setMultiSelect(checked);
                if (!checked && selectedBoundaryIds.length > 1) {
                  setSelectedBoundaryIds([selectedBoundaryIds[0]]);
                }
              }}
            />
          </div>

          {/* Boundary search/list */}
          {boundaryType && (
            <div className="h-[300px] border rounded-md p-3">
              <BoundarySearch
                layerType={boundaryType}
                features={boundaryFeatures}
                selectedIds={selectedBoundaryIds}
                onSelectionChange={handleBoundarySelectionChange}
                onFeatureHover={handleBoundaryHover}
                onFeatureClick={handleBoundaryClick}
                multiSelect={multiSelect}
                isLoading={isLoadingBoundaries}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Info/Error message */}
      {error && (
        <Alert>
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xs text-muted-foreground">{error}</AlertDescription>
        </Alert>
      )}

      {/* Selection summary */}
      {isSelectionValid && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            {activeMethod === 'boundary-select' && (
              <>
                Selected: {selectedBoundaryIds.length}{' '}
                {selectedBoundaryIds.length === 1
                  ? BOUNDARY_LAYERS[boundaryType!].displayName.toLowerCase()
                  : BOUNDARY_LAYERS[boundaryType!].pluralName.toLowerCase()}
              </>
            )}
            {(activeMethod === 'click-buffer' || activeMethod === 'search') && (
              <>
                Buffer: {bufferValue}{' '}
                {bufferType === 'radius'
                  ? 'mi radius'
                  : bufferType === 'drivetime'
                    ? 'min drive'
                    : 'min walk'}
              </>
            )}
            {activeMethod === 'draw' && <>Area selected</>}
          </AlertDescription>
        </Alert>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="flex-1 border-[#33a852]/30 text-gray-700 hover:bg-emerald-50 hover:border-[#33a852]"
          onClick={handleCancel}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          className="flex-1 bg-[#33a852] hover:bg-[#2d9944] text-white"
          onClick={handleAnalyze}
          disabled={!isSelectionValid}
        >
          {isSelectionValid ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Analyze Area
            </>
          ) : (
            'Select an Area'
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Convert ArcGIS geometry to GeoJSON in WGS84 (EPSG:4326).
 * Map sketch/buffer geometries use the view spatial reference (often Web Mercator 3857).
 * GeoEnrichment CreateReport expects geographic coordinates when spatialReference is 4326.
 */
async function geometryToGeoJSON(geometry: __esri.Geometry): Promise<GeoJSON.Geometry | null> {
  try {
    const projection = await import('@arcgis/core/geometry/projection');
    const SpatialReference = (await import('@arcgis/core/geometry/SpatialReference')).default;
    await projection.load();

    const sr = geometry.spatialReference;
    const wkid = sr?.wkid ?? sr?.latestWkid;
    let g: __esri.Geometry = geometry;
    if (wkid != null && wkid !== 4326) {
      g = projection.project(geometry, new SpatialReference({ wkid: 4326 })) as __esri.Geometry;
    }

    if (g.type === 'polygon') {
      const polygon = g as __esri.Polygon;
      // Esri: first ring exterior, rest holes — one GeoJSON Polygon, not MultiPolygon per ring
      const coordinates = polygon.rings.map((ring) =>
        ring.map((coord) => [coord[0], coord[1]] as [number, number]),
      );
      return {
        type: 'Polygon',
        coordinates,
      };
    }
    if (g.type === 'point') {
      const point = g as __esri.Point;
      return {
        type: 'Point',
        coordinates: [point.longitude ?? 0, point.latitude ?? 0],
      };
    }
    if ((g as any).type === 'circle' && (g as any).rings?.length) {
      const circle = g as any;
      const coordinates = circle.rings.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[0], coord[1]] as [number, number]),
      );
      return {
        type: 'Polygon',
        coordinates,
      };
    }
    return null;
  } catch (e) {
    console.error('Error converting geometry to GeoJSON:', e);
    return null;
  }
}

export default PoliticalAreaSelector;
