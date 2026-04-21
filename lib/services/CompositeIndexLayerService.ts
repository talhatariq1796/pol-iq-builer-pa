/**
 * Service for creating client-side composite index layers
 * These layers use calculated composite index data from the microservice
 */

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import { ACTIVE_COLOR_SCHEME } from '@/utils/renderer-standardization';

export interface CompositeIndexData {
  GEOID: string;
  HOT_GROWTH_INDEX: number;
  NEW_HOMEOWNER_INDEX: number;
  HOUSING_AFFORDABILITY_INDEX: number;
  geometry?: any; // GeoJSON geometry
}

export class CompositeIndexLayerService {
  private baseGeometryLayer: __esri.FeatureLayer;

  constructor(baseGeometryLayer: __esri.FeatureLayer) {
    this.baseGeometryLayer = baseGeometryLayer;
  }

  /**
   * Create a client-side FeatureLayer for a composite index
   */
  async createCompositeIndexLayer(
    indexName: 'HOT_GROWTH_INDEX' | 'NEW_HOMEOWNER_INDEX' | 'HOUSING_AFFORDABILITY_INDEX',
    layerTitle: string
  ): Promise<__esri.FeatureLayer> {

    try {
      console.log(`[CompositeIndexLayerService] Creating ${indexName} layer: ${layerTitle}`);

      // Fetch composite index data from microservice
      const indexData = await this.fetchCompositeIndexData();
      console.log(`[CompositeIndexLayerService] Got ${indexData.length} index records`);

      // Get geometry from base layer
      const geometryData = await this.fetchBaseLayerGeometry();
      console.log(`[CompositeIndexLayerService] Got ${geometryData.size} geometries from base layer`);

      // Create graphics combining index values with geometries
      const graphics = await this.createIndexGraphics(indexData, geometryData, indexName);
      console.log(`[CompositeIndexLayerService] Created ${graphics.length} graphics`);

      // Create the feature layer
      const featureLayer = new FeatureLayer({
        title: layerTitle,
        objectIdField: "OBJECTID",
        geometryType: "polygon",
        spatialReference: { wkid: 4326 },

        // Define the schema
        fields: [
          {
            name: "OBJECTID",
            type: "oid"
          },
          {
            name: "GEOID",
            type: "string",
            alias: "Geographic ID"
          },
          {
            name: indexName,
            type: "double",
            alias: this.getIndexDisplayName(indexName)
          }
        ],

        // Add the graphics as features
        source: graphics,

        // Configure renderer based on index values
        renderer: this.createIndexRenderer(indexName, indexData.map(d => d[indexName]))
      });

      console.log(`[CompositeIndexLayerService] Successfully created ${layerTitle} layer`);
      return featureLayer;
    } catch (error) {
      console.error(`[CompositeIndexLayerService] Error creating ${layerTitle} layer:`, error);
      throw error;
    }
  }

  /**
   * Fetch composite index data from microservice or local cache
   * DEPRECATED: This service is for Quebec real estate analysis and is not used in political platform
   */
  private async fetchCompositeIndexData(): Promise<CompositeIndexData[]> {
    console.warn('[CompositeIndexLayerService] DEPRECATED: This service is for Quebec real estate, not political analysis');
    console.log('[CompositeIndexLayerService] Using local fallback data...');
    return await this.fetchLocalCompositeData();
  }

  /**
   * Fallback method to get composite index data from local sources
   */
  private async fetchLocalCompositeData(): Promise<CompositeIndexData[]> {
    // This would parse the training_data.csv from the microservice
    // For now, return mock data structure
    return [
      { GEOID: 'G0A', HOT_GROWTH_INDEX: 75, NEW_HOMEOWNER_INDEX: 68, HOUSING_AFFORDABILITY_INDEX: 82 },
      { GEOID: 'G0C', HOT_GROWTH_INDEX: 45, NEW_HOMEOWNER_INDEX: 72, HOUSING_AFFORDABILITY_INDEX: 91 },
      // ... more data
    ];
  }

  /**
   * Get geometry data from the base housing layer
   */
  private async fetchBaseLayerGeometry(): Promise<Map<string, any>> {
    try {
      console.log('[CompositeIndexLayerService] Querying base layer for geometry data...');
      console.log('[CompositeIndexLayerService] Base layer info:', {
        title: this.baseGeometryLayer.title,
        url: this.baseGeometryLayer.url,
        loaded: this.baseGeometryLayer.loaded,
        type: this.baseGeometryLayer.type
      });

      // Ensure the layer is loaded
      if (!this.baseGeometryLayer.loaded) {
        console.log('[CompositeIndexLayerService] Loading base layer...');
        await this.baseGeometryLayer.load();
      }

      // Check available fields first
      const fields = this.baseGeometryLayer.fields?.map(f => f.name) || [];
      console.log('[CompositeIndexLayerService] Available fields:', fields);

      // Try different possible ID field names (prioritize ID for FSA data)
      const possibleIDFields = ['ID', 'FSA_ID', 'GEO_ID', 'GEOID', 'POSTAL_CODE', 'CODE'];
      const idField = possibleIDFields.find(field => fields.includes(field));

      if (!idField) {
        console.error('[CompositeIndexLayerService] No suitable ID field found in base layer. Available fields:', fields);
        throw new Error(`No suitable ID field found. Available fields: ${fields.join(', ')}`);
      }

      console.log(`[CompositeIndexLayerService] Using ${idField} as ID field`);

      const query = this.baseGeometryLayer.createQuery();
      query.where = "1=1";
      query.outFields = [idField];
      query.returnGeometry = true;

      const results = await this.baseGeometryLayer.queryFeatures(query);
      console.log(`[CompositeIndexLayerService] Query returned ${results.features.length} features`);

      const geometryMap = new Map<string, any>();
      results.features.forEach((feature, index) => {
        const id = feature.attributes[idField];
        if (id) {
          geometryMap.set(String(id), feature.geometry);
          if (index < 5) { // Log first 5 for debugging
            console.log(`[CompositeIndexLayerService] Feature ${index}: ${idField}=${id}, geometry=${!!feature.geometry}`);
          }
        } else {
          console.warn(`[CompositeIndexLayerService] Feature ${index} missing ${idField} attribute:`, feature.attributes);
        }
      });

      console.log(`[CompositeIndexLayerService] Created geometry map with ${geometryMap.size} entries`);

      if (geometryMap.size === 0) {
        throw new Error(`No features with valid ${idField} found in base layer`);
      }

      return geometryMap;
    } catch (error) {
      console.error('[CompositeIndexLayerService] Error fetching base layer geometry:', error);
      console.error('[CompositeIndexLayerService] Base layer details:', {
        title: this.baseGeometryLayer?.title,
        loaded: this.baseGeometryLayer?.loaded,
        url: this.baseGeometryLayer?.url,
        fieldsCount: this.baseGeometryLayer?.fields?.length
      });
      throw error;
    }
  }

  /**
   * Create graphics combining index data with geometries
   */
  private async createIndexGraphics(
    indexData: CompositeIndexData[],
    geometryMap: Map<string, any>,
    indexField: string
  ): Promise<__esri.Graphic[]> {

    const graphics: __esri.Graphic[] = [];

    indexData.forEach((data, index) => {
      const geometry = geometryMap.get(data.GEOID);
      if (geometry) {
        const graphic = new Graphic({
          geometry: geometry,
          attributes: {
            OBJECTID: index + 1,
            GEOID: data.GEOID,
            [indexField]: data[indexField as keyof CompositeIndexData]
          }
        });

        graphics.push(graphic);
      }
    });

    return graphics;
  }

  /**
   * Create appropriate renderer for composite index values
   */
  private createIndexRenderer(indexName: string, values: number[]): __esri.Renderer {
    // Calculate quartile breaks
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const q2 = sortedValues[Math.floor(sortedValues.length * 0.5)];
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];

    return new ClassBreaksRenderer({
      field: indexName,
      classBreakInfos: [
        {
          minValue: 0,
          maxValue: q1,
          symbol: new SimpleFillSymbol({
            color: [
              parseInt(ACTIVE_COLOR_SCHEME[0].slice(1, 3), 16),
              parseInt(ACTIVE_COLOR_SCHEME[0].slice(3, 5), 16),
              parseInt(ACTIVE_COLOR_SCHEME[0].slice(5, 7), 16),
              0.7
            ],
            outline: { color: [0, 0, 0, 0.3], width: 0.5 }
          }),
          label: `Low (${0} - ${q1.toFixed(1)})`
        },
        {
          minValue: q1,
          maxValue: q2,
          symbol: new SimpleFillSymbol({
            color: [
              parseInt(ACTIVE_COLOR_SCHEME[1].slice(1, 3), 16),
              parseInt(ACTIVE_COLOR_SCHEME[1].slice(3, 5), 16),
              parseInt(ACTIVE_COLOR_SCHEME[1].slice(5, 7), 16),
              0.7
            ],
            outline: { color: [0, 0, 0, 0.3], width: 0.5 }
          }),
          label: `Medium-Low (${q1.toFixed(1)} - ${q2.toFixed(1)})`
        },
        {
          minValue: q2,
          maxValue: q3,
          symbol: new SimpleFillSymbol({
            color: [
              parseInt(ACTIVE_COLOR_SCHEME[2].slice(1, 3), 16),
              parseInt(ACTIVE_COLOR_SCHEME[2].slice(3, 5), 16),
              parseInt(ACTIVE_COLOR_SCHEME[2].slice(5, 7), 16),
              0.7
            ],
            outline: { color: [0, 0, 0, 0.3], width: 0.5 }
          }),
          label: `Medium-High (${q2.toFixed(1)} - ${q3.toFixed(1)})`
        },
        {
          minValue: q3,
          maxValue: 100,
          symbol: new SimpleFillSymbol({
            color: [
              parseInt(ACTIVE_COLOR_SCHEME[3].slice(1, 3), 16),
              parseInt(ACTIVE_COLOR_SCHEME[3].slice(3, 5), 16),
              parseInt(ACTIVE_COLOR_SCHEME[3].slice(5, 7), 16),
              0.7
            ],
            outline: { color: [0, 0, 0, 0.3], width: 0.5 }
          }),
          label: `High (${q3.toFixed(1)} - 100)`
        }
      ]
    });
  }

  /**
   * Get display name for index
   */
  private getIndexDisplayName(indexName: string): string {
    const displayNames: Record<string, string> = {
      'HOT_GROWTH_INDEX': 'Hot Growth Score',
      'NEW_HOMEOWNER_INDEX': 'New Homeowner Score',
      'HOUSING_AFFORDABILITY_INDEX': 'Housing Affordability Score'
    };

    return displayNames[indexName] || indexName;
  }

  /**
   * Create all composite index layers
   */
  async createAllCompositeIndexLayers(): Promise<__esri.FeatureLayer[]> {
    const layers = await Promise.all([
      this.createCompositeIndexLayer('HOT_GROWTH_INDEX', 'Hot Growth Index'),
      this.createCompositeIndexLayer('NEW_HOMEOWNER_INDEX', 'New Homeowner Index'),
      this.createCompositeIndexLayer('HOUSING_AFFORDABILITY_INDEX', 'Affordability Index')
    ]);

    return layers;
  }
}