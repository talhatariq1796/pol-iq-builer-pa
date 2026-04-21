import Query from "@arcgis/core/rest/support/Query";
import { layers, getLayerConfigById } from '@/config/layers';

export interface SpatialFilterOptions {
  spatialRelationship?: "intersects" | "contains" | "within";
  useCache?: boolean;
  includeAttributes?: string[];
}

export class SpatialFilterService {
  private static cache = new Map<string, string[]>();

  /**
   * Get the reference FeatureService URL for spatial filtering from current project config
   */
  private static getReferenceServiceUrl(): string {
    // Find a feature service layer from current project configuration
    // Since all HRB layers are polygon-based ZIP boundaries, any feature service will work
    const layerEntries = Object.entries(layers);
    const featureServiceLayer = layerEntries.find(([_, config]) => 
      config.url && config.type === 'feature-service'
    );
    
    if (!featureServiceLayer) {
      console.warn('[SpatialFilter] No feature service layer found in project config');
      throw new Error('No feature service layers available in project configuration for spatial filtering');
    }
    
    console.log(`[SpatialFilter] Using reference layer: ${featureServiceLayer[0]} -> ${featureServiceLayer[1].url}`);
    return featureServiceLayer[1].url;
  }

  /**
   * Query area IDs from the reference FeatureService using spatial geometry
   */
  static async queryAreaIdsByGeometry(
    geometry: __esri.Geometry,
    options: SpatialFilterOptions = {}
  ): Promise<string[]> {
    const {
      spatialRelationship = "intersects",
      useCache = true
    } = options;

    // Validate input geometry
    if (!this.validateGeometry(geometry)) {
      console.error('[SpatialFilter] Invalid geometry provided:', {
        type: geometry?.type,
        hasExtent: !!(geometry as any)?.extent,
        spatialReference: geometry?.spatialReference?.wkid
      });
      throw new Error('Invalid geometry for spatial filtering');
    }

    // For circle geometries (created by buffer operations), use 'intersects' relationship
    const actualSpatialRelationship = (geometry as any).type === 'circle' || geometry.type === 'polygon' 
      ? 'intersects' 
      : spatialRelationship;

    // Get reference service URL dynamically
    const serviceUrl = this.getReferenceServiceUrl();
    
    // Check cache
    const cacheKey = `reference-${JSON.stringify(geometry.toJSON())}-${actualSpatialRelationship}`;
    if (useCache && this.cache.has(cacheKey)) {
      console.log('[SpatialFilter] Using cached area IDs');
      return this.cache.get(cacheKey)!;
    }

    console.log('[SpatialFilter] Querying area IDs from reference service:', serviceUrl);
    console.log('[SpatialFilter] Query geometry details:', {
      type: geometry.type,
      spatialReference: geometry.spatialReference?.wkid,
      actualSpatialRelationship,
      geometryJSON: JSON.stringify(geometry.toJSON()).substring(0, 200) + '...'
    });

    try {
      // Build query URL
      const queryUrl = `${serviceUrl}/query`;
      
      // Use POST for spatial queries to avoid URL length limits
      const postData = new FormData();
      postData.append('where', '1=1');
      postData.append('outFields', 'ID,OBJECTID'); // Request both ID fields
      postData.append('returnGeometry', 'false');
      postData.append('spatialRel', this.getEsriSpatialRelationship(actualSpatialRelationship));
      // Handle different geometry types properly
      let geometryParam = geometry.toJSON();
      
      // For circle geometries, convert to polygon for ArcGIS REST API
      if ((geometry as any).type === 'circle') {
        try {
          const geometryEngine = await import('@arcgis/core/geometry/geometryEngine');
          const polygon = (geometryEngine as any).buffer(geometry as any, 0, 'meters') as __esri.Polygon;
          geometryParam = polygon.toJSON();
          console.log('[SpatialFilter] Converted circle to polygon for spatial query');
        } catch (error) {
          console.warn('[SpatialFilter] Failed to convert circle to polygon, using original geometry:', error);
        }
      }
      
      postData.append('geometry', JSON.stringify(geometryParam));
      postData.append('geometryType', this.getEsriGeometryType((geometry as any).type === 'circle' ? 'polygon' : geometry.type));
      postData.append('inSR', geometry.spatialReference?.wkid?.toString() || '4326');
      postData.append('outSR', geometry.spatialReference?.wkid?.toString() || '4326'); // Ensure consistent spatial reference
      postData.append('f', 'json');

      const response = await fetch(queryUrl, {
        method: 'POST',
        body: postData
      });
      
      if (!response.ok) {
        throw new Error(`Spatial query failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[SpatialFilter] ArcGIS response:', {
        success: !result.error,
        error: result.error,
        featureCount: result.features?.length || 0,
        responseKeys: Object.keys(result)
      });
      
      if (result.error) {
        throw new Error(`ArcGIS query error: ${JSON.stringify(result.error)}`);
      }

      // Extract IDs with better fallback logic
      const areaIds = result.features?.map((f: any) => {
        // Try ID first, then OBJECTID as fallback
        const id = f.attributes?.ID || f.attributes?.OBJECTID;
        return id ? String(id) : null;
      }).filter(Boolean) || [];
      
      console.log(`[SpatialFilter] Found ${areaIds.length} area IDs in spatial selection:`, areaIds.slice(0, 10));
      
      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, areaIds);
      }
      
      return areaIds;
      
    } catch (error) {
      console.error('[SpatialFilter] Error querying area IDs:', error);
      throw error;
    }
  }

  /**
   * Convert ArcGIS JS API geometry type to Esri REST geometry type
   */
  private static getEsriGeometryType(geometryType: string): string {
    const typeMap: Record<string, string> = {
      'point': 'esriGeometryPoint',
      'polyline': 'esriGeometryPolyline', 
      'polygon': 'esriGeometryPolygon',
      'extent': 'esriGeometryEnvelope',
      'circle': 'esriGeometryPolygon' // Treat circles as polygons for REST API
    };
    return typeMap[geometryType] || 'esriGeometryPolygon';
  }

  /**
   * Convert spatial relationship to Esri REST API format
   */
  private static getEsriSpatialRelationship(relationship: string): string {
    const relationshipMap: Record<string, string> = {
      'intersects': 'esriSpatialRelIntersects',
      'contains': 'esriSpatialRelContains',
      'within': 'esriSpatialRelWithin',
      'touches': 'esriSpatialRelTouches',
      'crosses': 'esriSpatialRelCrosses',
      'overlaps': 'esriSpatialRelOverlaps'
    };
    return relationshipMap[relationship] || 'esriSpatialRelIntersects';
  }

  /**
   * Validate geometry before spatial operations
   */
  private static validateGeometry(geometry: __esri.Geometry): boolean {
    if (!geometry || !geometry.type) {
      return false;
    }

    // Check for valid spatial reference
    if (!geometry.spatialReference?.wkid) {
      console.warn('[SpatialFilter] Geometry missing spatial reference, defaulting to 4326');
    }

    // Check geometry-specific validation
    switch ((geometry as any).type) {
      case 'circle':
        const circle = geometry as any;
        return !!(circle.center && circle.radius > 0);
      case 'polygon':
        const polygon = geometry as __esri.Polygon;
        return !!(polygon.rings && polygon.rings.length > 0);
      case 'point':
        const point = geometry as __esri.Point;
        return !!(point.x !== undefined && point.y !== undefined);
      default:
        return true;
    }
  }

  /**
   * Query feature IDs within a given geometry
   */
  static async queryFeaturesByGeometry(
    view: __esri.MapView,
    geometry: __esri.Geometry,
    layerId: string,
    options: SpatialFilterOptions = {}
  ): Promise<string[]> {
    const {
      spatialRelationship = "intersects",
      useCache = true,
      includeAttributes = []
    } = options;

    // Check cache
    const cacheKey = `${layerId}-${JSON.stringify(geometry.toJSON())}-${spatialRelationship}`;
    if (useCache && this.cache.has(cacheKey)) {
      console.log('[SpatialFilter] Using cached results');
      return this.cache.get(cacheKey)!;
    }

    // Find the layer - try multiple strategies
    let layer = view.map.layers.find(l => l.id === layerId) as __esri.FeatureLayer;
    
    if (!layer) {
      // Strategy 1: Check if it's in the layers config
      const layerConfig = Object.values(layers).find(l => l.id === layerId);
      if (!layerConfig) {
        const availableLayerIds = Object.keys(layers);
        console.warn(`[SpatialFilter] Layer ${layerId} not found in map or config`);
        console.warn(`[SpatialFilter] Available layer IDs:`, availableLayerIds.slice(0, 10));
        console.warn(`[SpatialFilter] Total available layers: ${availableLayerIds.length}`);
        
        // Try to suggest a similar layer
        const similarLayer = availableLayerIds.find(id => 
          id.includes('Unknown_Service') && layers[id].type === 'feature-service'
        );
        
        if (similarLayer) {
          console.warn(`[SpatialFilter] Suggested alternative layer: ${similarLayer}`);
        }
        
        throw new Error(`Layer ${layerId} not found. Available layers: ${availableLayerIds.slice(0, 5).join(', ')}...`);
      }
      
      // Strategy 2: Create a temporary feature layer for the query
      console.log('[SpatialFilter] Creating temporary layer for spatial query:', layerId);
      const FeatureLayer = (await import("@arcgis/core/layers/FeatureLayer")).default;
      layer = new FeatureLayer({
        url: layerConfig.url,
        outFields: ["*"]
      });
      
      // Wait for layer to load
      await layer.load();
    }

    // Ensure layer is fully loaded and has spatial reference info
    await layer.when();
    
    // Get layer's spatial reference
    const layerSpatialRef = layer.spatialReference || layer.fullExtent?.spatialReference;
    
    console.log('[SpatialFilter] Spatial reference info:', {
      queryGeometrySR: geometry.spatialReference?.wkid,
      layerSR: layerSpatialRef?.wkid,
      viewSR: view.spatialReference?.wkid
    });

    // Transform geometry to layer's spatial reference if needed
    let queryGeometry = geometry;
    if (layerSpatialRef && geometry.spatialReference?.wkid !== layerSpatialRef.wkid) {
      try {
        const projectionModule = await import('@arcgis/core/geometry/projection');
        // @ts-ignore - ArcGIS module import structure
        const projection = projectionModule.default || projectionModule;
        await projection.load();
        
        console.log(`[SpatialFilter] Projecting geometry from WKID ${geometry.spatialReference?.wkid} to ${layerSpatialRef.wkid}`);
        const projectedResult = projection.project(geometry as any, layerSpatialRef) as __esri.Geometry;
        
        if (projectedResult) {
          queryGeometry = projectedResult;
        } else {
          console.warn('[SpatialFilter] Geometry projection failed, using original geometry');
        }
      } catch (projectionError) {
        console.warn('[SpatialFilter] Projection error, using original geometry:', projectionError);
      }
    }

    // Create spatial query
    const query = layer.createQuery();
    query.geometry = queryGeometry;
    query.spatialRelationship = spatialRelationship as any;
    
    // For HRB data, we need to get the actual ZIP code IDs, not OBJECTIDs
    // Try to get ID field that matches endpoint data
    const idFields = ['ID', 'id', 'GEOID', 'ZIP_CODE', 'ZIP', layer.objectIdField];
    query.outFields = [...idFields, ...includeAttributes];
    query.returnGeometry = false;
    query.num = 5000; // Handle large selections

    console.log('[SpatialFilter] Executing spatial query:', {
      layerId,
      geometryType: queryGeometry.type,
      spatialRelationship,
      outFields: query.outFields,
      geometryExtent: queryGeometry.extent ? {
        xmin: queryGeometry.extent.xmin,
        ymin: queryGeometry.extent.ymin, 
        xmax: queryGeometry.extent.xmax,
        ymax: queryGeometry.extent.ymax
      } : null,
      projectionApplied: queryGeometry !== geometry
    });

    // Execute query
    const result = await layer.queryFeatures(query);
    
    // Try to extract the correct ID that matches endpoint data
    const featureIds = result.features.map(f => {
      const attrs = f.attributes;
      
      // Priority order: ID (ZIP code) > GEOID > OBJECTID
      const id = attrs.ID || attrs.id || attrs.GEOID || attrs.ZIP_CODE || attrs.ZIP || attrs[layer.objectIdField];
      
      // Log first few features to debug ID mapping
      if (result.features.indexOf(f) < 3) {
        console.log(`[SpatialFilter] Feature ${result.features.indexOf(f)} attributes:`, {
          ID: attrs.ID,
          GEOID: attrs.GEOID, 
          ZIP_CODE: attrs.ZIP_CODE,
          ZIP: attrs.ZIP,
          OBJECTID: attrs[layer.objectIdField],
          selectedId: id
        });
      }
      
      return String(id);
    });

    console.log(`[SpatialFilter] Found ${featureIds.length} features`);
    console.log(`[SpatialFilter] Sample feature IDs:`, featureIds.slice(0, 5));
    
    // If no features found, try a broader search for debugging
    if (featureIds.length === 0) {
      console.warn('[SpatialFilter] No features found, attempting diagnostic query...');
      
      try {
        // Try getting all features to check if layer has data
        const allFeaturesQuery = layer.createQuery();
        allFeaturesQuery.where = "1=1";
        allFeaturesQuery.returnGeometry = true; // Get geometry to check extent
        allFeaturesQuery.num = 3;
        const allResult = await layer.queryFeatures(allFeaturesQuery);
        
        console.log(`[SpatialFilter] Layer has ${allResult.features.length} sample features available`);
        
        // Log some sample feature locations for comparison
        if (allResult.features.length > 0) {
          const sampleGeometry = allResult.features[0].geometry;
          if (sampleGeometry?.extent) {
            console.log('[SpatialFilter] Sample feature extent:', {
              xmin: sampleGeometry.extent.xmin,
              ymin: sampleGeometry.extent.ymin,
              xmax: sampleGeometry.extent.xmax,
              ymax: sampleGeometry.extent.ymax
            });
          }
          
          // Get layer's full extent for context
          if (layer.fullExtent) {
            console.log('[SpatialFilter] Layer full extent:', {
              xmin: layer.fullExtent.xmin,
              ymin: layer.fullExtent.ymin,
              xmax: layer.fullExtent.xmax,
              ymax: layer.fullExtent.ymax
            });
          }
        }
        
        // TEST: Try querying with a known good extent within the layer coverage
        console.log('[SpatialFilter] Testing spatial query with known good extent...');
        const testExtent = await import('@arcgis/core/geometry/Extent');
        const testExtentGeometry = new testExtent.default({
          xmin: -9100000, // Within sample feature area
          ymin: 3510000,
          xmax: -9095000,
          ymax: 3520000,
          spatialReference: { wkid: 102100 }
        });
        
        const testQuery = layer.createQuery();
        testQuery.geometry = testExtentGeometry;
        testQuery.spatialRelationship = "intersects";
        testQuery.outFields = [layer.objectIdField];
        testQuery.returnGeometry = false;
        testQuery.num = 10;
        
        const testResult = await layer.queryFeatures(testQuery);
        console.log(`[SpatialFilter] Known good extent test found ${testResult.features.length} features`);
        
        // Try a larger extent query
        if (queryGeometry.extent) {
          console.log('[SpatialFilter] Original query extent:', {
            xmin: queryGeometry.extent.xmin,
            ymin: queryGeometry.extent.ymin,
            xmax: queryGeometry.extent.xmax,
            ymax: queryGeometry.extent.ymax
          });
          
          const expandedExtent = queryGeometry.extent.expand(10); // Expand by 10x
          const expandedQuery = layer.createQuery();
          expandedQuery.geometry = expandedExtent;
          expandedQuery.spatialRelationship = "intersects";
          expandedQuery.outFields = [layer.objectIdField];
          expandedQuery.returnGeometry = false;
          expandedQuery.num = 100;
          
          const expandedResult = await layer.queryFeatures(expandedQuery);
          console.log(`[SpatialFilter] Expanded extent (10x) found ${expandedResult.features.length} features`);
        }
      } catch (diagnosticError) {
        console.error('[SpatialFilter] Diagnostic query failed:', diagnosticError);
      }
    }

    // Cache results
    if (useCache) {
      this.cache.set(cacheKey, featureIds);
    }

    return featureIds;
  }

  /**
   * Clear the cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  static getCacheSize(): number {
    return this.cache.size;
  }
}