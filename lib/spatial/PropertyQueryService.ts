/**
 * PropertyQueryService - Handles querying properties within buffer areas
 */

import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import Graphic from '@arcgis/core/Graphic';
import { SimpleMarkerSymbol, SimpleFillSymbol } from '@arcgis/core/symbols';

export interface PropertyQueryOptions {
  bufferGeometry: __esri.Geometry;
  propertyLayerUrl?: string;
  maxResults?: number;
  outFields?: string[];
}

export interface PropertyQueryResult {
  properties: __esri.Graphic[];
  count: number;
  layer?: FeatureLayer;
}

export class PropertyQueryService {
  private static instance: PropertyQueryService;
  private propertyLayer: FeatureLayer | null = null;

  private constructor() {}

  public static getInstance(): PropertyQueryService {
    if (!PropertyQueryService.instance) {
      PropertyQueryService.instance = new PropertyQueryService();
    }
    return PropertyQueryService.instance;
  }

  /**
   * Query properties within a buffer geometry
   */
  public async queryPropertiesInBuffer(options: PropertyQueryOptions): Promise<PropertyQueryResult> {
    const {
      bufferGeometry,
      propertyLayerUrl = '""', // Default to Vercel Blob (same as map layers)
      maxResults = 100,
      outFields = ['*']
    } = options;

    try {
      // Initialize property layer if not already done
      if (!this.propertyLayer) {
        await this.initializePropertyLayer(propertyLayerUrl);
      }

      if (!this.propertyLayer) {
        throw new Error('Failed to initialize property layer');
      }

      // Create spatial query
      const query = new Query({
        geometry: bufferGeometry,
        spatialRelationship: 'intersects',
        outFields: outFields,
        returnGeometry: true,
        num: maxResults,
        where: '1=1' // Query all features within geometry
      });

      // Execute query
      const featureSet = await this.propertyLayer.queryFeatures(query);
      
      console.log(`[PropertyQueryService] Found ${featureSet.features.length} properties in buffer`);

      // Apply property visualization
      const visualizedProperties = featureSet.features.map(feature => {
        // Clone the feature to avoid modifying the original
        const clonedFeature = feature.clone();
        
        // Apply property symbol
        clonedFeature.symbol = new SimpleMarkerSymbol({
          style: 'circle',
          color: [255, 165, 0, 0.8], // Orange color for selected properties
          size: 8,
          outline: {
            color: [255, 255, 255, 1],
            width: 2
          }
        });

        return clonedFeature;
      });

      return {
        properties: visualizedProperties,
        count: visualizedProperties.length,
        layer: this.propertyLayer
      };

    } catch (error) {
      console.error('[PropertyQueryService] Error querying properties:', error);
      throw error;
    }
  }

  /**
   * Initialize the property layer for querying
   */
  private async initializePropertyLayer(layerUrl: string): Promise<void> {
    try {
      // Check if URL is an API endpoint or a direct ArcGIS service
      if (layerUrl.startsWith('/api/')) {
        // For API endpoints, we'll need to fetch the data and create a temporary layer
        const response = await fetch(layerUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch property data: ${response.statusText}`);
        }

        const geojsonData = await response.json();
        
        // Create a feature layer from GeoJSON data  
        const GeoJSONLayer = (await import('@arcgis/core/layers/GeoJSONLayer')).default;
        
        // For GeoJSONLayer, we need to create a blob URL from the data
        const blob = new Blob([JSON.stringify(geojsonData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        this.propertyLayer = new GeoJSONLayer({
          url: url,
          spatialReference: { wkid: 4326 },
          fields: this.createPropertyFields(),
          outFields: ['*'],
          popupEnabled: false // We handle popups separately
        }) as unknown as FeatureLayer;

      } else {
        // For direct ArcGIS service URLs
        this.propertyLayer = new FeatureLayer({
          url: layerUrl,
          outFields: ['*'],
          popupEnabled: false
        });
      }

      console.log('[PropertyQueryService] Property layer initialized successfully');

    } catch (error) {
      console.error('[PropertyQueryService] Failed to initialize property layer:', error);
      throw error;
    }
  }

  /**
   * Create field definitions for property data
   */
  private createPropertyFields() {
    return [
      { name: 'OBJECTID', type: 'oid' as const },
      { name: 'address', type: 'string' as const },
      { name: 'price', type: 'double' as const },
      { name: 'bedrooms_number', type: 'integer' as const },
      { name: 'bathrooms_number', type: 'double' as const },
      { name: 'property_type', type: 'string' as const },
      { name: 'year_built', type: 'integer' as const },
      { name: 'living_area', type: 'double' as const },
      { name: 'lot_size', type: 'string' as const },
      { name: 'status', type: 'string' as const },
      { name: 'centris_no', type: 'string' as const },
      { name: 'municipalityborough', type: 'string' as const },
      { name: 'postal_code', type: 'string' as const },
      { name: 'mls_number', type: 'string' as const },
      { name: 'listing_agent', type: 'string' as const },
      { name: 'days_on_market', type: 'integer' as const }
    ];
  }

  /**
   * Add properties to the map view
   */
  public async addPropertiesToMap(
    view: __esri.MapView, 
    properties: __esri.Graphic[], 
    replaceExisting: boolean = true
  ): Promise<__esri.GraphicsLayer> {
    const GraphicsLayer = (await import('@arcgis/core/layers/GraphicsLayer')).default;

    // Find existing property layer or create new one
    let propertyGraphicsLayer = view.map.layers.find(layer => 
      layer.id === 'buffer-properties-layer'
    ) as __esri.GraphicsLayer;

    if (propertyGraphicsLayer && replaceExisting) {
      propertyGraphicsLayer.removeAll();
    } else if (!propertyGraphicsLayer) {
      propertyGraphicsLayer = new GraphicsLayer({
        id: 'buffer-properties-layer',
        title: 'Selected Properties',
        listMode: 'hide' // Hide from layer list
      });
      view.map.add(propertyGraphicsLayer);
    }

    // Add properties to the layer
    propertyGraphicsLayer.addMany(properties);

    console.log(`[PropertyQueryService] Added ${properties.length} properties to map`);

    return propertyGraphicsLayer;
  }

  /**
   * Clear properties from the map
   */
  public clearPropertiesFromMap(view: __esri.MapView): void {
    const propertyLayer = view.map.layers.find(layer => 
      layer.id === 'buffer-properties-layer'
    ) as __esri.GraphicsLayer;

    if (propertyLayer) {
      propertyLayer.removeAll();
    }
  }

  /**
   * Create a summary of queried properties
   */
  public createPropertySummary(properties: __esri.Graphic[]): {
    totalCount: number;
    priceRange: { min: number; max: number; average: number };
    propertyTypes: Record<string, number>;
    statusDistribution: Record<string, number>;
  } {
    const prices = properties
      .map(p => p.attributes?.price || p.attributes?.askedsold_price)
      .filter(price => price && !isNaN(price))
      .map(price => Number(price));

    const propertyTypes: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};

    properties.forEach(property => {
      const type = property.attributes?.property_type || 'Unknown';
      const status = property.attributes?.status || property.attributes?.st || 'Unknown';

      propertyTypes[type] = (propertyTypes[type] || 0) + 1;
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
    });

    return {
      totalCount: properties.length,
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
        average: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
      },
      propertyTypes,
      statusDistribution
    };
  }
}

export default PropertyQueryService;