/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import Graphic from "@arcgis/core/Graphic";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Polygon from "@arcgis/core/geometry/Polygon";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import Polyline from "@arcgis/core/geometry/Polyline";

// Constants
const PREVIEW_LINE_STYLE = "dash";
const PREVIEW_LINE_WIDTH = 2;

// Point symbol configuration
const POINT_SYMBOL = new SimpleMarkerSymbol({
  color: [37, 99, 235], // Blue color
  size: 12,
  outline: {
    color: [255, 255, 255], // White outline
    width: 2
  },
  style: "circle"  // Explicitly set style
});

const POLYGON_VERTEX_SYMBOL = new SimpleMarkerSymbol({
  color: [22, 163, 74], // Green color
  size: 8,
  outline: {
    color: [255, 255, 255],
    width: 2
  },
  style: "circle"
});

const POLYGON_LINE_SYMBOL = new SimpleLineSymbol({
  color: [22, 163, 74],
  width: 2,
  style: "solid"
});


const DEFAULT_STYLE = {
  pointColor: [37, 99, 235] as [number, number, number],
  polygonColor: [22, 163, 74] as [number, number, number],
  previewColor: [128, 128, 128] as [number, number, number],
  handleColor: [0, 0, 0] as [number, number, number],
  lineWidth: 2,
  fillOpacity: 0.3
};


// Types
export type DrawMode = 'point' | 'polygon' | 'click' | null;

interface UseDrawingOptions {
  onGeometryCreated?: (geometry: __esri.Geometry) => void;
  onDrawingStarted?: () => void;
  onDrawingCanceled?: () => void;
  onValidationError?: (error: string) => void;
  style?: Partial<typeof DEFAULT_STYLE>;
  graphicsLayer?: __esri.GraphicsLayer;
}

interface UseDrawingProps extends UseDrawingOptions {
  view: __esri.MapView;
  setDrawMode?: (mode: DrawMode | null) => void;
  setIsDrawing?: (isDrawing: boolean) => void;
  setTargetGeometry?: (geometry: __esri.Geometry | null) => void;
}

interface DrawingState {
  mode: DrawMode;
  isModifying: boolean;
  selectedGeometry: __esri.Geometry | null;
  modificationHandles: __esri.Graphic[];
}

const initialDrawingState: DrawingState = {
  mode: null,
  isModifying: false,
  selectedGeometry: null,
  modificationHandles: []
};

export function useDrawing({
  view,
  onGeometryCreated,
  onDrawingStarted,
  onDrawingCanceled,
  onValidationError,
  style = {},
  graphicsLayer: externalGraphicsLayer
}: UseDrawingProps) {
  // Refs for managing drawing state and graphics
  const clickHandlerRef = useRef<IHandle | null>(null);
  const moveHandlerRef = useRef<IHandle | null>(null);
  const pointsRef = useRef<__esri.Point[]>([]);
  const previewLineRef = useRef<__esri.Graphic | null>(null);
  const snapPointRef = useRef<__esri.Point | null>(null);
  const selectedFeaturesRef = useRef<__esri.Graphic[]>([]);
  const vertexGraphicsRef = useRef<__esri.Graphic[]>([]);
  const lineGraphicsRef = useRef<__esri.Graphic[]>([]);
  const pointGraphicsRef = useRef<__esri.Graphic[]>([]);
  const dblClickHandlerRef = useRef<((event: MouseEvent) => void) | null>(null);

  // Callback refs to manage external callbacks
  const callbacksRef = useRef({
    onGeometryCreated,
    onDrawingStarted,
    onDrawingCanceled,
    onValidationError
  });

  // State management
  const [drawingState, setDrawingState] = useState<DrawingState>(initialDrawingState);
  const [hasHitFeature, setHasHitFeature] = useState(false);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [activePoints, setActivePoints] = useState<__esri.Graphic[]>([]);
  const [targetGeometry, setTargetGeometry] = useState<__esri.Geometry | null>(null);
  const [highlightHandles, setHighlightHandles] = useState<__esri.Handle[]>([]);

  // Memoize style options
  const mergedStyle = useMemo(() => ({
    ...DEFAULT_STYLE,
    ...style
  }), [style]);

  // Update external callbacks when they change
  useEffect(() => {
    callbacksRef.current = {
      onGeometryCreated,
      onDrawingStarted,
      onDrawingCanceled,
      onValidationError
    };
  }, [onGeometryCreated, onDrawingStarted, onDrawingCanceled, onValidationError]);

  // Cursor management
  const updateCursor = useCallback((mode: DrawMode) => {
    if (!view || !view.container) return;
    
    switch (mode) {
      case 'point':
      case 'polygon':
        view.container.style.cursor = 'crosshair';
        break;
      case 'click':
        view.container.style.cursor = 'pointer';
        break;
      default:
        view.container.style.cursor = 'default';
    }
  }, [view]);

  const resetCursor = useCallback(() => {
    if (view && view.container) {
      view.container.style.cursor = 'default';
    }
  }, [view]);

  // Graphics layer management - Use view.graphics directly like infographics
  const getGraphicsLayer = useCallback(() => {
    if (externalGraphicsLayer) {
        console.log('Using external graphics layer');
        return externalGraphicsLayer;
    }
    
    // Use view.graphics directly instead of creating a separate layer
    if (view?.graphics) {
        console.log('Using view.graphics directly');
        return view.graphics;
    }
    
    console.warn('View or view.graphics is null');
    return null;
}, [view, externalGraphicsLayer]);

  // Combine selected geometries
  const combineSelectedGeometries = useCallback(() => {
    if (selectedFeaturesRef.current.length === 0) return null;
    
    const geometries = selectedFeaturesRef.current.map(f => f.geometry);
    if (geometries.length === 1) return geometries[0];
    
    let unionGeometry = geometryEngine.union(geometries as any);
    
    if (!geometryEngine.isSimple(unionGeometry)) {
      const buffered = geometryEngine.buffer(unionGeometry, 0, "meters");
      unionGeometry = Array.isArray(buffered) ? buffered[0] : buffered;
      
      if (!geometryEngine.isSimple(unionGeometry)) {
        unionGeometry = geometryEngine.simplify(unionGeometry);
      }
    }
    
    return unionGeometry;
  }, []);

  // First declare all handlers
  const handlePolygonCreation = useCallback((mapPoint: __esri.Point) => {
    const graphics = getGraphicsLayer();
    if (!graphics) return;

    const pointToAdd = snapPointRef.current || mapPoint;
    pointsRef.current.push(pointToAdd);
    
    const vertexGraphic = new Graphic({
      geometry: pointToAdd,
      symbol: POLYGON_VERTEX_SYMBOL
    });

    // Add graphics to view.graphics
    graphics.add(vertexGraphic);
    vertexGraphicsRef.current.push(vertexGraphic);

    if (pointsRef.current.length > 1) {
      const lineGraphic = new Graphic({
        geometry: new Polyline({
          paths: [[
            [pointsRef.current[pointsRef.current.length - 2].x, pointsRef.current[pointsRef.current.length - 2].y],
            [pointToAdd.x, pointToAdd.y]
          ]],
          spatialReference: view?.spatialReference
        }),
        symbol: POLYGON_LINE_SYMBOL
      });

      graphics.add(lineGraphic);
      lineGraphicsRef.current.push(lineGraphic);
    }
  }, [view, getGraphicsLayer]);

  // Then define setupPolygonDrawing and other functions that use it
  const setupPolygonDrawing = useCallback(() => {
    if (!view) return;

    
    // Click handler for vertices
    clickHandlerRef.current = view.on("click", (event: __esri.ViewClickEvent) => {
      event.stopPropagation();
      handlePolygonCreation(event.mapPoint);
    });

    // Move handler for preview line
    const moveHandler = view.on('pointer-move', (event) => {
      event.stopPropagation();
      const mapPoint = view.toMap({ x: event.x, y: event.y });
      if (mapPoint && pointsRef.current.length > 0) {
        if (previewLineRef.current) {
          getGraphicsLayer()?.remove(previewLineRef.current);
        }
        const lastPoint = pointsRef.current[pointsRef.current.length - 1];
        previewLineRef.current = new Graphic({
          geometry: new Polyline({
            paths: [[[lastPoint.x, lastPoint.y], [mapPoint.x, mapPoint.y]]],
            spatialReference: view.spatialReference
          }),
          symbol: new SimpleLineSymbol({
            color: mergedStyle.previewColor,
            width: PREVIEW_LINE_WIDTH,
            style: PREVIEW_LINE_STYLE
          })
        });
        getGraphicsLayer()?.add(previewLineRef.current);
      }
    });

    // Double-click handler for polygon completion
    const handleDoubleClick = (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      
      if (pointsRef.current.length < 3) return;

      // Remove all handlers
      moveHandlerRef.current?.remove();
      moveHandlerRef.current = null;
      clickHandlerRef.current?.remove();
      clickHandlerRef.current = null;
      
      // Remove preview line
      if (previewLineRef.current) {
        getGraphicsLayer()?.remove(previewLineRef.current);
        previewLineRef.current = null;
      }
      
      const points = [...pointsRef.current];
      if (!points[0].equals(points[points.length - 1])) {
        points.push(points[0]);
      }
      
      const polygon = new Polygon({
        rings: [points.map(point => [point.x, point.y])],
        spatialReference: view.spatialReference
      });

      const graphics = getGraphicsLayer();
      if (!graphics) return;

      // Clear existing graphics
      graphics.removeAll();

      // Create and add polygon graphic
      const polygonGraphic = new Graphic({
        geometry: polygon,
        symbol: new SimpleFillSymbol({
          color: [...mergedStyle.polygonColor, mergedStyle.fillOpacity],
          outline: {
            color: mergedStyle.polygonColor,
            width: mergedStyle.lineWidth
          }
        }),
        attributes: { type: 'polygon' }
      });

      graphics.add(polygonGraphic);

      // Update state
      setTargetGeometry(polygon);
      callbacksRef.current.onGeometryCreated?.(polygon);
    };

    // Remove any existing double-click handler
    if (dblClickHandlerRef.current && view.container) {
      view.container.removeEventListener('dblclick', dblClickHandlerRef.current);
    }

    // Store and add the new handler
    dblClickHandlerRef.current = handleDoubleClick;
    if (view.container) {
      view.container.addEventListener('dblclick', dblClickHandlerRef.current);
    }
        
    // Update move handler cleanup
    moveHandlerRef.current = {
      remove: () => {
        moveHandler?.remove();
        if (previewLineRef.current) {
          getGraphicsLayer()?.remove(previewLineRef.current);
          previewLineRef.current = null;
        }
        // Also clean up double-click handler
        if (dblClickHandlerRef.current && view?.container) {
          view.container.removeEventListener('dblclick', dblClickHandlerRef.current);
          dblClickHandlerRef.current = null;
        }
      }
    };
  }, [view, getGraphicsLayer, mergedStyle, handlePolygonCreation]);

  // Point creation handler
  const handlePointCreation = useCallback((mapPoint: __esri.Point) => {
    const graphics = getGraphicsLayer();
    
    if (!graphics) {
        console.warn('Graphics collection is null in handlePointCreation');
        return;
    }

    const pointGraphic = new Graphic({
        geometry: mapPoint,
        symbol: POINT_SYMBOL
    });

    graphics.add(pointGraphic);

    setTargetGeometry(mapPoint);
    callbacksRef.current.onGeometryCreated?.(mapPoint);
}, [getGraphicsLayer]);

const handleFeatureSelection = useCallback(async (mapPoint: __esri.Point, event?: __esri.ViewClickEvent) => {
  if (!view) return;

  try {
    const graphics = getGraphicsLayer();
    if (!graphics) return;
    
    console.log('Graphics collection available:', !!graphics);
    
    const screenPoint = view.toScreen(mapPoint);
    if (!screenPoint) return;
    
    const response = await view.hitTest({
      x: screenPoint.x,
      y: screenPoint.y
    });

    const hitFeatures = response.results
      .filter(result => 'graphic' in result)
      .map(result => (result as { graphic: __esri.Graphic }).graphic)
      .filter(graphic => 
        graphic.geometry && 
        graphic.layer?.type === 'feature'
      );

    console.log('Hit features:', hitFeatures.length);

    if (hitFeatures.length > 0) {
      const hitFeature = hitFeatures[0];
      if (!hitFeature.geometry) return;
      
      const isAlreadySelected = selectedFeaturesRef.current.some(
        g => g.geometry && geometryEngine.equals(g.geometry as any, hitFeature.geometry as any)
      );
      
      if (event?.native?.shiftKey) {
        // Remove from selection if already selected
        selectedFeaturesRef.current = selectedFeaturesRef.current.filter(
          g => !g.geometry || !geometryEngine.equals(g.geometry as any, hitFeature.geometry as any)
        );
        // Remove corresponding graphic from the graphics collection
        const graphicsCollection = 'toArray' in graphics ? graphics : graphics.graphics;
        const graphicsToRemove = graphicsCollection.toArray().filter((g: __esri.Graphic) => 
            g.attributes?.id === 'selectionGraphic' && 
            !!g.geometry && geometryEngine.equals(g.geometry as any, hitFeature.geometry as any)
        );
        graphicsCollection.removeMany(graphicsToRemove);

      } else {
        // If not already selected, add new selection
        if (!isAlreadySelected) {
          let selectionSymbol;
          const selectionColor = [147, 51, 234]; // Purple
          const selectionOutlineColor = [255, 255, 255]; // White for points for contrast

          if (hitFeature.geometry.type === "polygon") {
            selectionSymbol = new SimpleFillSymbol({
              color: [...selectionColor, 0.3], // Purple, semi-transparent
              outline: {
                color: selectionColor,
                width: 2
              }
            });
          } else if (hitFeature.geometry.type === "polyline") {
            selectionSymbol = new SimpleLineSymbol({
              color: selectionColor,
              width: 2.5 // Slightly thicker
            });
          } else if (hitFeature.geometry.type === "point") {
            selectionSymbol = new SimpleMarkerSymbol({
              color: selectionColor,
              size: 10,
              outline: {
                color: selectionOutlineColor, // White outline for points
                width: 1.5
              },
              style: "circle"
            });
          } else {
            console.warn("Unsupported geometry type for selection:", hitFeature.geometry.type);
            // Fallback to a small red dot if geometry type is unknown/unsupported
            selectionSymbol = new SimpleMarkerSymbol({ color: [255,0,0], size: 5, style: "circle"}); 
          }

          if (selectionSymbol) { // Ensure a symbol was created
            const selectionGraphic = new Graphic({
              geometry: hitFeature.geometry,
              symbol: selectionSymbol,
              attributes: { id: 'selectionGraphic' } 
            });
            
            graphics.add(selectionGraphic);
            selectedFeaturesRef.current.push(selectionGraphic); 
            console.log('Added selection graphic for', hitFeature.geometry.type, '; selectedFeaturesRef count:', selectedFeaturesRef.current.length);
          }
        } else {
          console.log('Feature already selected, not adding duplicate.');
        }
      }

      // Update states
      setHasHitFeature(selectedFeaturesRef.current.length > 0);
      
      // Combine geometries if multiple selections exist
      if (selectedFeaturesRef.current.length > 0) {
        const combinedGeometry = combineSelectedGeometries();
        setTargetGeometry(combinedGeometry as any);
      } else {
        setTargetGeometry(null);
      }
    }
  } catch (error) {
    console.error('Error during feature selection:', error);
  }
}, [view, getGraphicsLayer, combineSelectedGeometries]);

  // Only define startDrawing after handlers are assigned
  const startDrawing = useCallback((mode: DrawMode) => {
    if (!view || !mode) return;

    const isChangingModes = drawingState.mode !== mode;
    
    // Only cleanup if we're changing modes, and preserve graphics when appropriate
    if (isChangingModes) {
            
        cleanup();
    }
    
    // Update drawing state
    setDrawingState((prev: DrawingState) => ({
        ...prev,
        mode,
        isModifying: false,
        selectedGeometry: null,
        modificationHandles: []
    }));

    // Get graphics collection
    const graphics = getGraphicsLayer();
    console.log('Graphics available for drawing:', !!graphics);

    // Update cursor and polygon drawing state
    updateCursor(mode);
    setIsDrawingPolygon(mode === 'polygon');

    // Set up event handlers based on mode
    if (mode === 'point') {
      graphics?.removeAll();
      selectedFeaturesRef.current = [];
      setActivePoints([]);
      
      clickHandlerRef.current = view.on("click", (event: __esri.ViewClickEvent) => {
        event.stopPropagation();
        
        console.log('[Click Event] Point selected at coordinates:', 
          `X: ${event.mapPoint.x}, Y: ${event.mapPoint.y}, WKID: ${event.mapPoint.spatialReference?.wkid}`);
        
        handlePointCreation(event.mapPoint);
      });
    } else if (mode === 'polygon') {
      setupPolygonDrawing();
    } else if (mode === 'click') {
      graphics?.removeAll();
      pointGraphicsRef.current = [];
      vertexGraphicsRef.current = [];
      lineGraphicsRef.current = [];
      setActivePoints([]);
      
      clickHandlerRef.current = view.on("click", (event: __esri.ViewClickEvent) => {
        event.stopPropagation();
        handleFeatureSelection(event.mapPoint, event);
      });
    }

    // Trigger drawing started callback
    callbacksRef.current.onDrawingStarted?.();
  }, [view, getGraphicsLayer, updateCursor, 
      handlePointCreation, handleFeatureSelection]);

  // Cleanup method
  const cleanup = useCallback(() => {
    // Remove handlers
    if (moveHandlerRef.current) {
      moveHandlerRef.current.remove();
      moveHandlerRef.current = null;
    }
    if (clickHandlerRef.current) {
      clickHandlerRef.current.remove();
      clickHandlerRef.current = null;
    }
    if (dblClickHandlerRef.current && view?.container) {
      view.container.removeEventListener('dblclick', dblClickHandlerRef.current);
      dblClickHandlerRef.current = null;
    }

    // Clear preview graphics
    if (previewLineRef.current) {
      getGraphicsLayer()?.remove(previewLineRef.current);
      previewLineRef.current = null;
    }

    // Reset state
    pointsRef.current = [];
    selectedFeaturesRef.current = [];
    setDrawingState(initialDrawingState);
    setHasHitFeature(false);
    setIsDrawingPolygon(false);
    setTargetGeometry(null);
    
    resetCursor();
  }, [view, getGraphicsLayer, resetCursor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        cleanup();
    };
}, [cleanup]);

const resetDrawing = useCallback(() => {
  // First do regular cleanup
  cleanup();
  
  // Then clear all graphics
  const graphics = getGraphicsLayer();
  if (graphics) {
    graphics.removeAll();
  }
}, [cleanup, getGraphicsLayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Return hook methods and state
  return {
    startDrawing,
    cancelDrawing: cleanup,
    resetDrawing,
    completeSelection: () => {
      const combinedGeometry = combineSelectedGeometries();
      if (combinedGeometry) {
        callbacksRef.current.onGeometryCreated?.(combinedGeometry);
      }
    },
    drawingState: drawingState.mode,
    targetGeometry,
    empty: !targetGeometry,
    hasHitFeature,
    hasSelectedFeatures: drawingState.mode === 'click' && hasHitFeature,
    isDrawingPolygon,
    selectedFeatureCount: selectedFeaturesRef.current.length,
    getGraphicsLayer
  };
}