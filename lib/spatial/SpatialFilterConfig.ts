import { layers, SPATIAL_REFERENCE_LAYER_ID } from '@/config/layers';

export class SpatialFilterConfig {
  /**
   * Get the reference layer ID for spatial queries
   * This layer should contain all geographic features (ZIP codes, areas, etc.)
   */
  static getReferenceLayerId(): string {
    // Option 1: Use configured spatial reference layer
    if (SPATIAL_REFERENCE_LAYER_ID) {
      // Validate that the configured layer actually exists
      if (layers[SPATIAL_REFERENCE_LAYER_ID]) {
        console.log('[SpatialFilterConfig] Using configured spatial reference layer:', SPATIAL_REFERENCE_LAYER_ID);
        return SPATIAL_REFERENCE_LAYER_ID;
      } else {
        console.warn('[SpatialFilterConfig] Configured spatial reference layer not found:', SPATIAL_REFERENCE_LAYER_ID);
        console.warn('[SpatialFilterConfig] Available layers:', Object.keys(layers).slice(0, 10));
      }
    }
    
    // Option 2: Find layer marked as spatial reference (future enhancement)
    // const referenceLayer = Object.values(layers).find(layer => 
    //   layer.isSpatialReference || layer.hasCompleteGeometry
    // );
    // if (referenceLayer) {
    //   return referenceLayer.id;
    // }
    
    // Option 3: Use first available layer as fallback
    const firstLayer = Object.values(layers)[0];
    if (firstLayer) {
      console.warn('[SpatialFilterConfig] No reference layer configured, using first available:', firstLayer.id);
      return firstLayer.id;
    }
    
    throw new Error('No spatial reference layer available');
  }
  
  /**
   * Get the layer configuration for spatial queries
   */
  static getReferenceLayerConfig(): any | null {
    const layerId = this.getReferenceLayerId();
    return layers[layerId] || null;
  }
  
  /**
   * Validate that a layer can be used for spatial queries
   */
  static validateReferenceLayer(layerId: string): boolean {
    const layer = layers[layerId];
    if (!layer) return false;
    
    // Check if layer has required properties
    return !!(layer.url && layer.type === 'feature-service');
  }
}