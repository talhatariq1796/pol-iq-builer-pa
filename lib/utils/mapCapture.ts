/**
 * Map Screenshot Utility
 * 
 * Captures area maps from ArcGIS MapView for PDF generation.
 * Uses MapView.takeScreenshot() API for high-quality map captures.
 */

export interface MapCaptureOptions {
  /**
   * Area/buffer to capture
   */
  extent?: __esri.Extent;
  
  /**
   * Center point (alternative to extent)
   */
  center?: __esri.Point | { lat: number; lng: number };
  
  /**
   * Radius in meters (used with center)
   */
  radius?: number;
  
  /**
   * Property location to mark (optional)
   */
  propertyMarker?: {
    lat: number;
    lng: number;
  };
  
  /**
   * Screenshot dimensions
   */
  width?: number;
  height?: number;
  
  /**
   * Quality (0-100)
   */
  quality?: number;
  
  /**
   * Format
   */
  format?: 'png' | 'jpg';
}

export interface MapCaptureResult {
  /**
   * Base64 data URL
   */
  dataUrl: string;
  
  /**
   * Image width
   */
  width: number;
  
  /**
   * Image height
   */
  height: number;
  
  /**
   * Extent captured
   */
  extent: __esri.Extent;
}

/**
 * Capture area map from MapView
 * 
 * @param mapView - ArcGIS MapView instance
 * @param options - Capture options
 * @returns Promise<MapCaptureResult> - Screenshot data
 */
export async function captureAreaMap(
  mapView: __esri.MapView,
  options: MapCaptureOptions = {}
): Promise<MapCaptureResult> {
  const {
    extent,
    center,
    radius = 1000,
    propertyMarker,
    width = 1800,
    height = 1200,
    quality = 95,
    format = 'png'
  } = options;

  console.log('[MapCapture] Starting area map capture...', {
    hasExtent: !!extent,
    hasCenter: !!center,
    radius,
    dimensions: `${width}x${height}`
  });

  // Store original view state for restoration
  const originalExtent = mapView.extent?.clone();

  try {
    // Create temporary graphics layer for markers if needed
    let tempGraphicsLayer: __esri.GraphicsLayer | null = null;
    
    if (propertyMarker) {
      console.log('[MapCapture] Adding property marker...');
      // Dynamically import graphics modules
      const [GraphicsLayer, Graphic, SimpleMarkerSymbol, Point] = await Promise.all([
        import('@arcgis/core/layers/GraphicsLayer'),
        import('@arcgis/core/Graphic'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol'),
        import('@arcgis/core/geometry/Point')
      ]);

      tempGraphicsLayer = new GraphicsLayer.default({
        id: 'temp-map-capture-graphics',
        listMode: 'hide'
      });

      const markerGraphic = new Graphic.default({
        geometry: new Point.default({
          latitude: propertyMarker.lat,
          longitude: propertyMarker.lng
        }),
        symbol: new SimpleMarkerSymbol.default({
          color: [102, 13, 57, 0.9], // BHHS burgundy
          size: 14,
          outline: {
            color: [255, 255, 255, 1],
            width: 2
          }
        })
      });

      tempGraphicsLayer.graphics.add(markerGraphic);
      mapView.map.add(tempGraphicsLayer);
    }

    // Calculate target extent
    let targetExtent: __esri.Extent;

    if (extent) {
      targetExtent = extent;
    } else if (center) {
      console.log('[MapCapture] Calculating extent from center and radius...');
      
      // Import geometry modules
      const [Point, geometryEngine] = await Promise.all([
        import('@arcgis/core/geometry/Point'),
        import('@arcgis/core/geometry/geometryEngine')
      ]);

      // Convert center to Point if needed
      const centerPoint = 'lat' in center
        ? new Point.default({
            latitude: center.lat,
            longitude: center.lng
          })
        : center;

      // Create buffer around center
      const buffer = geometryEngine.geodesicBuffer(
        centerPoint,
        radius,
        'meters'
      ) as __esri.Polygon;

      if (!buffer?.extent) {
        throw new Error('Failed to calculate extent from center and radius');
      }

      targetExtent = buffer.extent;
    } else {
      // Use current view extent
      targetExtent = mapView.extent;
    }

    console.log('[MapCapture] Target extent:', {
      xmin: targetExtent.xmin,
      ymin: targetExtent.ymin,
      xmax: targetExtent.xmax,
      ymax: targetExtent.ymax
    });

    // Navigate to target extent
    await mapView.goTo(targetExtent, {
      duration: 0, // Instant
      animate: false
    });

    // Wait for view to settle
    await new Promise(resolve => setTimeout(resolve, 100));

    // Take screenshot
    console.log('[MapCapture] Taking screenshot...');
    const screenshot = await mapView.takeScreenshot({
      width,
      height,
      quality,
      format
    });

    console.log('[MapCapture] Screenshot captured successfully', {
      dataUrl: screenshot.dataUrl.substring(0, 50) + '...',
      width: screenshot.data.width,
      height: screenshot.data.height
    });

    // Clean up temporary graphics
    if (tempGraphicsLayer) {
      mapView.map.remove(tempGraphicsLayer);
      tempGraphicsLayer.destroy();
    }

    // Restore original view state
    if (originalExtent) {
      await mapView.goTo(originalExtent, {
        duration: 0,
        animate: false
      });
    }

    return {
      dataUrl: screenshot.dataUrl,
      width: screenshot.data.width,
      height: screenshot.data.height,
      extent: targetExtent
    };

  } catch (error) {
    console.error('[MapCapture] Error capturing map:', error);
    
    // Try to restore original state
    if (originalExtent) {
      try {
        await mapView.goTo(originalExtent, { duration: 0, animate: false });
      } catch (restoreError) {
        console.error('[MapCapture] Error restoring view state:', restoreError);
      }
    }
    
    throw error;
  }
}

/**
 * Generate area map for selected area (UI pipeline)
 * 
 * @param mapView - ArcGIS MapView
 * @param selectedArea - Area selection config
 * @returns Promise<string> - Base64 data URL
 */
export async function generateAreaMapForPDF(
  mapView: __esri.MapView,
  selectedArea?: {
    type: 'circle' | 'polygon' | 'rectangle';
    center?: { lat: number; lng: number };
    radius?: number;
    geometry?: __esri.Geometry;
  }
): Promise<string> {
  if (!selectedArea) {
    console.warn('[MapCapture] No selected area provided, using current view');
    const result = await captureAreaMap(mapView);
    return result.dataUrl;
  }

  const captureOptions: MapCaptureOptions = {
    width: 1800,
    height: 1200,
    quality: 95,
    format: 'png'
  };

  if (selectedArea.type === 'circle' && selectedArea.center && selectedArea.radius) {
    captureOptions.center = selectedArea.center;
    captureOptions.radius = selectedArea.radius;
  } else if (selectedArea.geometry?.extent) {
    captureOptions.extent = selectedArea.geometry.extent;
  }

  const result = await captureAreaMap(mapView, captureOptions);
  return result.dataUrl;
}

/**
 * Generate map with property marker (Popup pipeline)
 * 
 * @param mapView - ArcGIS MapView
 * @param property - Property location
 * @param bufferRadius - Buffer radius in meters (default 1000m)
 * @returns Promise<string> - Base64 data URL
 */
export async function generatePropertyMapForPDF(
  mapView: __esri.MapView,
  property: {
    latitude: number;
    longitude: number;
  },
  bufferRadius: number = 1000
): Promise<string> {
  const result = await captureAreaMap(mapView, {
    center: { lat: property.latitude, lng: property.longitude },
    radius: bufferRadius,
    propertyMarker: { lat: property.latitude, lng: property.longitude },
    width: 1800,
    height: 1200,
    quality: 95,
    format: 'png'
  });

  return result.dataUrl;
}
