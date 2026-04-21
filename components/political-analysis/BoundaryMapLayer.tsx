/**
 * BoundaryMapLayer Component
 *
 * Manages boundary layer visualization on the ArcGIS map.
 * Handles loading, rendering, and highlighting of boundary features.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import Graphic from '@arcgis/core/Graphic';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';

import { BOUNDARY_LAYERS } from './BoundaryLayerPicker';
import type { BoundaryLayerType } from '@/types/political';
import {
  boundaryLayerUsesMergedBlobUrl,
  loadBoundaryFeatureCollection,
} from '@/lib/map/geojsonMergeLoader';

interface BoundaryMapLayerProps {
  view: __esri.MapView;
  layerType: BoundaryLayerType | null;
  selectedIds?: string[];
  highlightedId?: string | null;
  onFeatureClick?: (featureId: string) => void;
  onFeatureHover?: (featureId: string | null) => void;
  showPoliticalScores?: boolean;
  visible?: boolean;
}

export function BoundaryMapLayer({
  view,
  layerType,
  selectedIds = [],
  highlightedId = null,
  onFeatureClick,
  onFeatureHover,
  showPoliticalScores = false,
  visible = true,
}: BoundaryMapLayerProps) {
  const layerRef = useRef<GeoJSONLayer | null>(null);
  const highlightRef = useRef<__esri.Handle | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const hoverHandlerRef = useRef<IHandle | null>(null);
  const mergedBlobUrlRef = useRef<string | null>(null);
  const [isLayerReady, setIsLayerReady] = useState(false);

  // Create renderer for the boundary layer
  const createRenderer = useCallback(
    (config: (typeof BOUNDARY_LAYERS)[BoundaryLayerType]) => {
      if (showPoliticalScores && layerType === 'precinct') {
        // Use unique value renderer for partisan lean visualization
        return new UniqueValueRenderer({
          field: 'classification',
          defaultSymbol: new SimpleFillSymbol({
            color: [128, 128, 128, 0.3],
            outline: new SimpleLineSymbol({
              color: [128, 128, 128],
              width: 1,
            }),
          }),
          uniqueValueInfos: [
            {
              value: 'Safe D',
              symbol: new SimpleFillSymbol({
                color: [37, 99, 235, 0.5], // Blue
                outline: new SimpleLineSymbol({ color: [37, 99, 235], width: 1 }),
              }),
            },
            {
              value: 'Likely D',
              symbol: new SimpleFillSymbol({
                color: [96, 165, 250, 0.5],
                outline: new SimpleLineSymbol({ color: [96, 165, 250], width: 1 }),
              }),
            },
            {
              value: 'Lean D',
              symbol: new SimpleFillSymbol({
                color: [191, 219, 254, 0.5],
                outline: new SimpleLineSymbol({ color: [147, 197, 253], width: 1 }),
              }),
            },
            {
              value: 'Tossup',
              symbol: new SimpleFillSymbol({
                color: [156, 163, 175, 0.5],
                outline: new SimpleLineSymbol({ color: [107, 114, 128], width: 1 }),
              }),
            },
            {
              value: 'Lean R',
              symbol: new SimpleFillSymbol({
                color: [254, 202, 202, 0.5],
                outline: new SimpleLineSymbol({ color: [252, 165, 165], width: 1 }),
              }),
            },
            {
              value: 'Likely R',
              symbol: new SimpleFillSymbol({
                color: [248, 113, 113, 0.5],
                outline: new SimpleLineSymbol({ color: [248, 113, 113], width: 1 }),
              }),
            },
            {
              value: 'Safe R',
              symbol: new SimpleFillSymbol({
                color: [239, 68, 68, 0.5], // Red
                outline: new SimpleLineSymbol({ color: [239, 68, 68], width: 1 }),
              }),
            },
          ],
        });
      }

      // Default simple renderer
      const color = hexToRgba(config.color, 0.3);
      const outlineColor = hexToRgba(config.color, 1);

      return new SimpleRenderer({
        symbol: new SimpleFillSymbol({
          color,
          outline: new SimpleLineSymbol({
            color: outlineColor,
            width: 1,
          }),
        }),
      });
    },
    [layerType, showPoliticalScores]
  );

  // Load and add layer when type changes (single URL or merged multi-part / manifest → blob URL)
  useEffect(() => {
    const disposeHandlers = () => {
      clickHandlerRef.current?.remove();
      clickHandlerRef.current = null;
      hoverHandlerRef.current?.remove();
      hoverHandlerRef.current = null;
    };

    const removeLayerAndBlob = () => {
      disposeHandlers();
      if (layerRef.current && view?.map) {
        view.map.remove(layerRef.current);
        layerRef.current = null;
      }
      if (mergedBlobUrlRef.current) {
        URL.revokeObjectURL(mergedBlobUrlRef.current);
        mergedBlobUrlRef.current = null;
      }
      setIsLayerReady(false);
    };

    if (!view || !layerType) {
      removeLayerAndBlob();
      return;
    }

    const config = BOUNDARY_LAYERS[layerType];
    removeLayerAndBlob();

    let cancelled = false;

    (async () => {
      let layerUrl: string;
      try {
        if (boundaryLayerUsesMergedBlobUrl(config)) {
          const fc = await loadBoundaryFeatureCollection(config);
          if (cancelled) return;
          const blob = new Blob([JSON.stringify(fc)], {
            type: 'application/geo+json',
          });
          mergedBlobUrlRef.current = URL.createObjectURL(blob);
          layerUrl = mergedBlobUrlRef.current;
        } else {
          layerUrl = config.dataPath;
        }
      } catch (err) {
        console.warn('[BoundaryMapLayer] Failed to resolve GeoJSON URL:', err);
        return;
      }

      if (cancelled) {
        if (mergedBlobUrlRef.current) {
          URL.revokeObjectURL(mergedBlobUrlRef.current);
          mergedBlobUrlRef.current = null;
        }
        return;
      }

      const layer = new GeoJSONLayer({
        url: layerUrl,
        title: config.pluralName,
        visible,
        outFields: ['*'],
        renderer: createRenderer(config),
        popupEnabled: false,
      });

      view.map.add(layer);
      layerRef.current = layer;

      try {
        await layer.load();
        if (cancelled) return;
        console.log('[BoundaryMapLayer] Layer loaded:', layerType);
        setIsLayerReady(true);
      } catch (err) {
        console.warn('[BoundaryMapLayer] Error loading layer:', err);
        return;
      }

      if (cancelled) return;

      if (onFeatureClick) {
        clickHandlerRef.current = view.on('click', async (event) => {
          const response = await view.hitTest(event);
          const hit = response.results.find(
            (result) => 'graphic' in result && result.graphic.layer === layer
          ) as { graphic: __esri.Graphic } | undefined;

          if (hit) {
            const id = hit.graphic.getAttribute(config.idField);
            if (id) {
              onFeatureClick(String(id));
            }
          }
        });
      }

      if (onFeatureHover) {
        hoverHandlerRef.current = view.on('pointer-move', async (event) => {
          const response = await view.hitTest(event);
          const hit = response.results.find(
            (result) => 'graphic' in result && result.graphic.layer === layer
          ) as { graphic: __esri.Graphic } | undefined;

          if (hit) {
            const id = hit.graphic.getAttribute(config.idField);
            onFeatureHover(id ? String(id) : null);
          } else {
            onFeatureHover(null);
          }
        });
      }
    })();

    return () => {
      cancelled = true;
      removeLayerAndBlob();
    };
  }, [view, layerType, visible, createRenderer, onFeatureClick, onFeatureHover]);

  // Update visibility
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.visible = visible;
    }
  }, [visible]);

  // Handle selection highlighting
  useEffect(() => {
    if (!view || !layerRef.current || !layerType || !isLayerReady) {
      console.log('[BoundaryMapLayer] Highlight effect - waiting for layer:', {
        hasView: !!view,
        hasLayer: !!layerRef.current,
        layerType,
        isLayerReady
      });
      return;
    }

    const config = BOUNDARY_LAYERS[layerType];
    const layer = layerRef.current;

    console.log('[BoundaryMapLayer] Highlight effect triggered:', {
      layerType,
      selectedIds,
      idField: config.idField,
      isLayerReady,
    });

    // Clear existing highlight graphics (only those we added)
    const highlightGraphics = view.graphics.filter((g) => g.attributes?.isHighlight);
    view.graphics.removeMany(highlightGraphics.toArray());

    if (selectedIds.length === 0) {
      console.log('[BoundaryMapLayer] No selectedIds, skipping highlight');
      return;
    }

    // Query and highlight selected features
    const queryAndHighlight = async () => {
      try {
        const query = layer.createQuery();
        query.where = `${config.idField} IN (${selectedIds.map((id) => `'${id}'`).join(',')})`;
        query.outFields = ['*'];
        query.returnGeometry = true;

        console.log('[BoundaryMapLayer] Query where clause:', query.where);

        const result = await layer.queryFeatures(query);

        console.log('[BoundaryMapLayer] Query returned', result.features.length, 'features');

        // Add highlight graphics with MPIQ green
        result.features.forEach((feature) => {
          const highlightGraphic = new Graphic({
            geometry: feature.geometry,
            symbol: new SimpleFillSymbol({
              color: [51, 168, 82, 0.3], // MPIQ green 30% opacity for better visibility
              outline: new SimpleLineSymbol({
                color: [51, 168, 82], // MPIQ green
                width: 3,
              }),
            }),
            attributes: { isHighlight: true },
          });
          view.graphics.add(highlightGraphic);
        });

        // If features found, zoom to them
        if (result.features.length > 0 && result.features[0].geometry?.extent) {
          const extent = result.features[0].geometry.extent.clone();
          result.features.forEach((f) => {
            if (f.geometry?.extent) {
              extent.union(f.geometry.extent);
            }
          });
          // Add padding around the extent
          const expandedExtent = extent.expand(1.2);
          view.goTo(expandedExtent, { duration: 300 }).catch(() => {
            // Ignore animation errors
          });
        }
      } catch (err) {
        console.warn('Error highlighting features:', err);
      }
    };

    queryAndHighlight();
  }, [view, layerType, selectedIds, isLayerReady]);

  // Handle hover highlighting
  useEffect(() => {
    if (!view || !layerRef.current || !layerType || !highlightedId) return;

    // This could be enhanced with a highlight handle from the layer view
    // For now, we rely on cursor changes and the selection highlighting

  }, [view, layerType, highlightedId]);

  return null; // This is a non-visual component
}

/**
 * Convert hex color to RGBA array
 */
function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      alpha,
    ];
  }
  return [128, 128, 128, alpha]; // Default gray
}

export default BoundaryMapLayer;
