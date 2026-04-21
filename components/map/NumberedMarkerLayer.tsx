'use client';

import { useEffect, useRef } from 'react';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Point from '@arcgis/core/geometry/Point';

interface NumberedMarker {
  precinctId: string;
  number: number;
  label?: string;
  coordinates?: [number, number];
}

interface NumberedMarkerLayerProps {
  view: __esri.MapView;
  markers: NumberedMarker[];
  /** Precinct centroids lookup - maps precinct ID to [lng, lat] */
  precinctCentroids: Record<string, [number, number]>;
  visible?: boolean;
}


const NumberedMarkerLayer = ({
  view,
  markers,
  precinctCentroids,
  visible = true,
}: NumberedMarkerLayerProps) => {
  const layerRef = useRef<GraphicsLayer | null>(null);

  useEffect(() => {
    if (!view || !visible || markers.length === 0) {
      // Remove layer if not visible or no markers
      if (layerRef.current && view.map) {
        view.map.remove(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    // Create or reuse graphics layer
    let layer = layerRef.current;
    if (!layer) {
      layer = new GraphicsLayer({
        id: 'numbered-markers',
        title: 'Numbered Markers',
        listMode: 'hide', // Don't show in layer list
      });
      view.map.add(layer);
      layerRef.current = layer;
    }

    // Clear existing graphics
    layer.removeAll();

    // Create marker graphics
    markers.forEach(marker => {
      // Get coordinates from explicit coords or precinct centroid lookup
      const coords = marker.coordinates || precinctCentroids[marker.precinctId];

      if (!coords) {
        console.warn('[NumberedMarkerLayer] No coordinates found for precinct:', marker.precinctId);
        return;
      }

      // Create point geometry
      const point = new Point({
        longitude: coords[0],
        latitude: coords[1],
        spatialReference: { wkid: 4326 },
      });

      // Create text symbol for the number
      const textSymbol = {
        type: 'text',
        color: 'white',
        text: marker.number.toString(),
        font: {
          size: 14,
          weight: 'bold',
          family: 'Arial',
        },
        haloColor: '#33a852', // MPIQ green
        haloSize: 12,
      } as any;

      // Create graphic
      const graphic = new Graphic({
        geometry: point,
        symbol: textSymbol,
        attributes: {
          precinctId: marker.precinctId,
          number: marker.number,
          label: marker.label,
        },
      });

      layer.add(graphic);
    });

    console.log('[NumberedMarkerLayer] Added', markers.length, 'numbered markers');

    // Cleanup on unmount
    return () => {
      if (layerRef.current && view.map) {
        view.map.remove(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [view, markers, precinctCentroids, visible]);

  return null; // No UI rendered - just map layer manipulation
}

export default NumberedMarkerLayer;
