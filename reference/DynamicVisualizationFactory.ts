import { 
  layerRegistry, 
  VisualizationType, 
  LayerProviderFactory,
  VisualizationOptions,
  visualizationTypesConfig,
  LoadedLayer
} from './dynamic-layers';
import { Extent } from '@arcgis/core/geometry';

/**
 * Class responsible for creating visualizations dynamically based on analysis results
 * This factory bridges the gap between the geospatial-chat-interface and the layer registry system
 */
export class DynamicVisualizationFactory {
  private _mapView: __esri.MapView | null = null;
  private _initialized: boolean = false;
  private _visualizationLayers: Map<string, __esri.FeatureLayer> = new Map();

  constructor(mapView?: __esri.MapView) {
    if (mapView) {
      this._mapView = mapView;
      this._initialized = true;
    }
  }

  /**
   * Initialize the factory with a map view
   * This should be called before using the factory
   */
  async initialize(mapView: __esri.MapView): Promise<void> {
    this._mapView = mapView;
    
    // Initialize the layer registry if not already done
    try {
      // Add initial configurations that might be available in app state
      const existingConfigs = this._mapView.map.allLayers
        .filter(layer => layer.type === 'feature')
        .map(layer => {
          const featureLayer = layer as __esri.FeatureLayer;
          // Extract basic metadata from existing layers to populate registry
          return {
            id: featureLayer.id,
            name: featureLayer.title,
            url: featureLayer.url,
            geometryType: featureLayer.geometryType,
            // Additional properties could be extracted here
          };
        });
      
      // Log detected layers
      console.log('Detected existing layers:', existingConfigs.length);
      
      this._initialized = true;
    } catch (error) {
      console.error('Failed to initialize DynamicVisualizationFactory:', error);
      throw error;
    }
  }

  /**
   * Get a suggested visualization type based on the layer and query
   * This combines registry suggestions with additional heuristics
   */
  suggestVisualizationType(
    query: string, 
    layerId: string, 
    geometryType?: string, 
    numFields?: number
  ): VisualizationType {
    // Use registry to suggest visualization if available
    let vizType: VisualizationType | undefined;
    
    try {
      vizType = layerRegistry.suggestVisualizationType(query, layerId);
    } catch (error) {
      console.warn('Error getting visualization suggestion from registry:', error);
    }
    
    // Additional logic for more accurate suggestion based on query content
    if (numFields === 2 && (query.includes('correlation') || query.includes('relationship'))) {
      return VisualizationType.CORRELATION;
    }
    
    if (numFields === 2 && (query.includes('both high') || query.includes('hotspot'))) {
      return VisualizationType.JOINT_HIGH;
    }
    
    // Fallbacks based on geometry type and field count
    if (!vizType) {
      if (geometryType === 'point') {
        vizType = numFields && numFields > 0 
          ? VisualizationType.PROPORTIONAL_SYMBOL 
          : VisualizationType.SCATTER;
      } else {
        vizType = VisualizationType.CHOROPLETH;
      }
    }
    
    return vizType;
  }

  /**
   * Create a visualization layer based on the provided options
   * This is the main method that integrates with the handleVisualization function
   */
  async createVisualization(
    analysisType: string,
    layerId: string,
    options: Partial<VisualizationOptions>
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null; metrics?: any }> {
    if (!this._initialized || !this._mapView) {
      throw new Error('DynamicVisualizationFactory not initialized');
    }

    try {
      // Map analysis type to visualization type
      let visualizationType: VisualizationType;
      
      // Convert the analysis type to a visualization type
      switch (analysisType.toLowerCase()) {
        case 'correlation':
          visualizationType = VisualizationType.CORRELATION;
          break;
        case 'distribution':
        case 'thematic':
          visualizationType = VisualizationType.CHOROPLETH;
          break;
        case 'cluster':
          visualizationType = VisualizationType.CLUSTER;
          break;
        case 'joint_high':
        case 'joint-high':
          visualizationType = VisualizationType.JOINT_HIGH;
          break;
        case 'trends':
          visualizationType = VisualizationType.TRENDS;
          break;
        case 'categorical':
          visualizationType = VisualizationType.CATEGORICAL;
          break;
        case 'point_density':
        case 'heatmap':
          visualizationType = VisualizationType.HEATMAP;
          break;
        default:
          // Use suggestion based on layer properties and query
          visualizationType = this.suggestVisualizationType(
            options.query || '',
            layerId,
            (options as any).geometryType,
            options.fields?.length
          );
      }

      // Get layer config from registry
      const layerConfig = layerRegistry.getLayerConfig(layerId);

      // If we don't have this in registry yet, create a temporary provider
      const provider = layerConfig 
        ? LayerProviderFactory.createProvider(layerConfig.type || 'feature-service', layerConfig)
        : this._createTemporaryProvider(layerId, options);

      // Create full visualization options by merging defaults with provided options
      const fullOptions: VisualizationOptions = {
        type: visualizationType,
        fields: options.fields || [],
        ...visualizationTypesConfig[visualizationType].defaultSymbology,
        ...options
      };

      // Generate the visualization using the provider
      const result = await provider.createVisualization(visualizationType, fullOptions);
      
      // Save the layer for later reference
      if (result.esriLayer) {
        this._visualizationLayers.set(layerId, result.esriLayer);
      }

      return {
        layer: result.esriLayer,
        extent: result.extent || null,
        metrics: result.metrics
      };
    } catch (error) {
      console.error('Failed to create visualization:', error);
      return { layer: null, extent: null };
    }
  }

  /**
   * Create a temporary provider for a layer not in the registry
   * This allows working with layers dynamically without prior configuration
   */
  private _createTemporaryProvider(layerId: string, options: any) {
    // Find layer in the map
    const mapLayer = this._mapView?.map.findLayerById(layerId) as __esri.FeatureLayer;
    
    if (!mapLayer) {
      throw new Error(`Layer ${layerId} not found in map`);
    }
    
    // Create temporary config based on the existing layer
    const tempConfig = {
      id: layerId,
      name: mapLayer.title || layerId,
      description: mapLayer.title || '',
      type: 'feature-service', // Use a consistent type value
      url: mapLayer.url,
      geometryType: mapLayer.geometryType,
      // Additional layer properties to help with visualization
      fields: mapLayer.fields?.map(f => ({
        name: f.name,
        alias: f.alias,
        type: f.type
      }))
    };
    
    return LayerProviderFactory.createProvider('feature-service', tempConfig);
  }

  /**
   * Get a previously created visualization layer
   */
  getVisualizationLayer(layerId: string): __esri.FeatureLayer | null {
    return this._visualizationLayers.get(layerId) || null;
  }

  /**
   * Update an existing visualization with new options
   */
  async updateVisualization(
    layerId: string,
    newOptions: Partial<VisualizationOptions>
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    const layer = this._visualizationLayers.get(layerId);
    
    if (!layer) {
      console.warn(`Layer ${layerId} not found in visualization layers`);
      return { layer: null, extent: null };
    }
    
    try {
      // Implementation would update the existing layer's renderer, etc.
      // For now, just return the existing layer
      return { 
        layer, 
        extent: layer.fullExtent || null
      };
    } catch (error) {
      console.error('Failed to update visualization:', error);
      return { layer, extent: null };
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this._visualizationLayers.clear();
    this._mapView = null;
    this._initialized = false;
  }
}

/**
 * Helper to convert between visualization types and analysis types
 */
export function mapAnalysisTypeToVisualization(analysisType: string): VisualizationType {
  switch (analysisType.toLowerCase()) {
    case 'correlation':
      return VisualizationType.CORRELATION;
    case 'distribution':
    case 'thematic':
      return VisualizationType.CHOROPLETH;
    case 'cluster':
      return VisualizationType.CLUSTER;
    case 'joint_high':
    case 'joint-high':
      return VisualizationType.JOINT_HIGH;
    case 'trends':
      return VisualizationType.TRENDS;
    case 'categorical':
      return VisualizationType.CATEGORICAL;
    case 'point_density':
    case 'heatmap':
      return VisualizationType.HEATMAP;
    default:
      return VisualizationType.CHOROPLETH;
  }
}

/**
 * Create adapter function to convert between visualization systems
 * This helps with backward compatibility
 */
export function createCompatibilityAdapter(factory: DynamicVisualizationFactory) {
  return {
    createVisualization: async (
      analysisType: string,
      layerId: string,
      options: any
    ) => {
      // Map to new options format if needed
      const mappedOptions: Partial<VisualizationOptions> = {
        ...options,
        type: mapAnalysisTypeToVisualization(analysisType),
        fields: options.fields || [],
        query: options.query || ''
      };
      
      return factory.createVisualization(analysisType, layerId, mappedOptions);
    }
  };
} 