/**
 * UploadedLayerRenderer Component
 *
 * Renders user-uploaded GeoJSON layers as ArcGIS GraphicsLayers.
 * Manages layer lifecycle and visibility.
 */

import { useEffect, useRef } from 'react';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import { geojsonToGraphics } from '@/lib/map/geojsonUtils';
import type { UploadedLayer } from './GeoFileUploader';

interface UploadedLayerRendererProps {
  view: __esri.MapView;
  layers: UploadedLayer[];
}

const UploadedLayerRenderer: React.FC<UploadedLayerRendererProps> = ({
  view,
  layers,
}) => {
  const layerMapRef = useRef<Map<string, __esri.GraphicsLayer>>(new Map());

  useEffect(() => {
    if (!view) return;

    const layerMap = layerMapRef.current;

    // Create or update layers
    layers.forEach(uploadedLayer => {
      let graphicsLayer = layerMap.get(uploadedLayer.id);

      if (!graphicsLayer) {
        // Create new GraphicsLayer
        graphicsLayer = new GraphicsLayer({
          id: uploadedLayer.id,
          title: uploadedLayer.name,
          listMode: 'hide', // Don't show in layer list widget
        });

        // Convert GeoJSON to graphics
        const graphics = geojsonToGraphics(uploadedLayer.geojson);
        graphicsLayer.addMany(graphics);

        // Add to map
        view.map.add(graphicsLayer);
        layerMap.set(uploadedLayer.id, graphicsLayer);

        console.log(
          `[UploadedLayerRenderer] Created layer "${uploadedLayer.name}" with ${graphics.length} features`
        );
      }

      // Update visibility
      graphicsLayer.visible = uploadedLayer.visible;
    });

    // Remove layers that are no longer in the list
    const currentLayerIds = new Set(layers.map(l => l.id));
    layerMap.forEach((graphicsLayer, layerId) => {
      if (!currentLayerIds.has(layerId)) {
        view.map.remove(graphicsLayer);
        layerMap.delete(layerId);
        console.log(`[UploadedLayerRenderer] Removed layer "${layerId}"`);
      }
    });

    // Cleanup on unmount
    return () => {
      layerMap.forEach(graphicsLayer => {
        view.map.remove(graphicsLayer);
      });
      layerMap.clear();
    };
  }, [view, layers]);

  return null; // This component only manages layers, no UI
};

export default UploadedLayerRenderer;
