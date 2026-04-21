/**
 * EffectsManager - Unified visual effects coordinator
 * 
 * Orchestrates all visual effects systems:
 * - FireflyEffect
 * - GradientSystem  
 * - HoverAnimationSystem
 * - AmbientParticleSystem
 * 
 * Provides centralized management, performance optimization,
 * and seamless integration with the visualization pipeline.
 */

import { FireflyEffect, FireflyEffectConfig } from './FireflyEffect';
import { GradientSystem, PolygonEffectsConfig } from './GradientSystem';
import { HoverAnimationSystem, HoverEffectConfig } from './HoverAnimationSystem';
import { AmbientParticleSystem, AmbientParticleConfig } from './AmbientParticleSystem';

export interface EffectsManagerConfig {
  enabled: boolean;
  performance: 'high' | 'medium' | 'low' | 'auto';
  fireflies: Partial<FireflyEffectConfig>;
  gradients: boolean;
  hover: Partial<HoverEffectConfig>;
  ambient: Partial<AmbientParticleConfig>;
  coordinateEffects: boolean; // Synchronize effects timing
}

export interface VisualizationEffects {
  fireflies?: any;
  gradients?: any;
  animations?: any;
  marketShareAnimation?: any;
  competitivePositioning?: any;
}

/**
 * EffectsManager coordinates all visual effects for map visualizations
 */
export class EffectsManager {
  private mapView: __esri.MapView | null = null;
  private config: EffectsManagerConfig;
  
  // Effect systems
  private fireflyEffect: FireflyEffect | null = null;
  private gradientSystem: GradientSystem | null = null;
  private hoverSystem: HoverAnimationSystem | null = null;
  private ambientSystem: AmbientParticleSystem | null = null;
  
  // State
  private initialized = false;
  private currentLayer: __esri.FeatureLayer | null = null;
  private effectsApplied = false;

  constructor(config: Partial<EffectsManagerConfig> = {}) {
    this.config = {
      enabled: true,
      performance: 'auto',
      fireflies: { enabled: true },
      gradients: true,
      hover: { enabled: true },
      ambient: { enabled: true, density: 0.3 },
      coordinateEffects: true,
      ...config
    };
  }

  /**
   * Initialize effects manager on map view
   */
  async initialize(mapView: __esri.MapView): Promise<void> {
    if (this.initialized) {
      console.warn('[EffectsManager] Already initialized');
      return;
    }

    this.mapView = mapView;

    try {
      // Initialize effect systems based on configuration
      if (this.config.fireflies.enabled) {
        this.fireflyEffect = new FireflyEffect(this.config.fireflies);
        this.fireflyEffect.initialize(mapView);
      }

      if (this.config.gradients) {
        this.gradientSystem = new GradientSystem();
        this.gradientSystem.initialize(mapView);
      }

      if (this.config.hover.enabled) {
        this.hoverSystem = new HoverAnimationSystem(this.config.hover);
        this.hoverSystem.initialize(mapView);
      }

      if (this.config.ambient.enabled) {
        this.ambientSystem = new AmbientParticleSystem(this.config.ambient);
        this.ambientSystem.initialize(mapView);
      }

      this.initialized = true;
      console.log('[EffectsManager] Initialized successfully with performance mode:', this.config.performance);

    } catch (error) {
      console.error('[EffectsManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Apply effects to a visualization layer
   */
  async applyEffectsToLayer(
    layer: __esri.FeatureLayer, 
    visualizationResult: any
  ): Promise<void> {
    if (!this.initialized || !this.config.enabled) {
      console.log('[EffectsManager] Skipping effects - not initialized or disabled');
      return;
    }

    try {
      console.log('[EffectsManager] Applying effects to layer:', layer.title);

      this.currentLayer = layer;
      const effects = visualizationResult._enhancedEffects;

      // Wait for layer to load
      await layer.load();

      // Query features for effect processing
      const query = layer.createQuery();
      query.returnGeometry = true;
      query.outFields = ['*'];
      query.num = 1000; // Limit for performance
      
      const featureSet = await layer.queryFeatures(query);
      const features = featureSet.features;

      console.log(`[EffectsManager] Processing ${features.length} features for effects`);

      // Apply firefly effects to high-value points
      if (this.fireflyEffect && effects?.fireflies) {
        this.applyFireflyEffects(features, effects.fireflies);
      }

      // Apply gradient effects to polygons
      if (this.gradientSystem && effects?.gradients && visualizationResult.type === 'choropleth') {
        this.applyGradientEffects(features, effects.gradients);
      }

      // Update ambient system with data points
      if (this.ambientSystem) {
        this.updateAmbientSystem(features);
      }

      // Apply competitive positioning effects
      if (effects?.competitivePositioning) {
        this.applyCompetitivePositioning(features, effects.competitivePositioning);
      }

      // Apply market share animations
      if (effects?.marketShareAnimation) {
        this.applyMarketShareAnimations(features, effects.marketShareAnimation);
      }

      this.effectsApplied = true;
      console.log('[EffectsManager] Effects applied successfully');

    } catch (error) {
      console.error('[EffectsManager] Error applying effects:', error);
    }
  }

  /**
   * Apply firefly effects to high-value features
   */
  private applyFireflyEffects(features: __esri.Graphic[], fireflyConfig: any): void {
    if (!this.fireflyEffect || !fireflyConfig.enabled) return;

    // Convert features to points format expected by firefly system
    const points = features.map(feature => ({
      geometry: this.getFeatureCentroid(feature),
      attributes: feature.attributes
    }));

    this.fireflyEffect.updateTargetPoints(points);
    console.log(`[EffectsManager] Applied firefly effects to ${points.length} points`);
  }

  /**
   * Apply gradient effects to polygon features
   */
  private applyGradientEffects(features: __esri.Graphic[], gradientConfig: any): void {
    if (!this.gradientSystem) return;

    // Convert features to polygon format with gradient configuration
    const polygonData = features
      .filter(feature => feature.geometry && feature.geometry.type === 'polygon')
      .map(feature => ({
        geometry: feature.geometry,
        attributes: feature.attributes,
        config: {
          gradient: gradientConfig,
          opacity: 0.7,
          hoverEffects: true
        }
      }));

    if (polygonData.length > 0) {
      this.gradientSystem.addPolygons(polygonData);
      console.log(`[EffectsManager] Applied gradient effects to ${polygonData.length} polygons`);
    }
  }

  /**
   * Update ambient particle system with feature data
   */
  private updateAmbientSystem(features: __esri.Graphic[]): void {
    if (!this.ambientSystem) return;

    // Convert features to data points for ambient system
    const dataPoints = features.map(feature => ({
      geometry: this.getFeatureCentroid(feature),
      attributes: {
        ...feature.attributes,
        value: feature.attributes.value || feature.attributes.score || 0
      }
    }));

    this.ambientSystem.updateDataPoints(dataPoints);
    console.log(`[EffectsManager] Updated ambient system with ${dataPoints.length} data points`);
  }

  /**
   * Apply competitive positioning effects
   */
  private applyCompetitivePositioning(features: __esri.Graphic[], positioningConfig: any): void {
    if (!positioningConfig.enabled) return;

    console.log('[EffectsManager] Applied competitive positioning effects');
    // Competitive positioning effects are handled by the renderer
    // This method can be extended for additional positioning logic
  }

  /**
   * Apply market share animations
   */
  private applyMarketShareAnimations(features: __esri.Graphic[], animationConfig: any): void {
    if (!animationConfig.enabled) return;

    console.log('[EffectsManager] Applied market share animations');
    // Market share animations are handled by the renderer
    // This method can be extended for additional animation coordination
  }

  /**
   * Get centroid of a feature for point-based effects
   */
  private getFeatureCentroid(feature: __esri.Graphic): any {
    if (!feature.geometry) {
      return null;
    }
    
    if (feature.geometry.type === 'point') {
      return feature.geometry;
    } else if (feature.geometry.type === 'polygon') {
      // Use centroid from attributes if available, otherwise calculate
      const centroid = feature.attributes.centroid;
      if (centroid && centroid.coordinates) {
        return {
          type: 'point',
          x: centroid.coordinates[0],
          y: centroid.coordinates[1],
          spatialReference: feature.geometry.spatialReference
        };
      } else {
        // Calculate rough centroid from extent
        const extent = feature.geometry.extent;
        if (extent && extent.center) {
          return {
            type: 'point',
            x: extent.center.x,
            y: extent.center.y,
            spatialReference: feature.geometry.spatialReference
          };
        }
      }
    }
    return feature.geometry;
  }

  /**
   * Clear all effects
   */
  clearEffects(): void {
    if (this.fireflyEffect) {
      this.fireflyEffect.updateTargetPoints([]);
    }

    if (this.gradientSystem) {
      this.gradientSystem.clearPolygons();
    }

    if (this.ambientSystem) {
      this.ambientSystem.updateDataPoints([]);
    }

    this.currentLayer = null;
    this.effectsApplied = false;
    console.log('[EffectsManager] Effects cleared');
  }

  /**
   * Update effects configuration
   */
  updateConfig(newConfig: Partial<EffectsManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update individual effect systems
    if (this.fireflyEffect && newConfig.fireflies) {
      this.fireflyEffect.updateConfig(newConfig.fireflies);
    }

    if (this.hoverSystem && newConfig.hover) {
      this.hoverSystem.updateConfig(newConfig.hover);
    }

    if (this.ambientSystem && newConfig.ambient) {
      this.ambientSystem.updateConfig(newConfig.ambient);
    }

    console.log('[EffectsManager] Configuration updated');
  }

  /**
   * Get performance statistics from all effect systems
   */
  getPerformanceStats(): {
    fireflies?: any;
    hover?: any;
    ambient?: any;
    effectsApplied: boolean;
    initialized: boolean;
  } {
    return {
      fireflies: this.fireflyEffect?.getParticleCount(),
      hover: this.hoverSystem?.getStats(),
      ambient: this.ambientSystem?.getStats(),
      effectsApplied: this.effectsApplied,
      initialized: this.initialized
    };
  }

  /**
   * Destroy effects manager and cleanup resources
   */
  destroy(): void {
    if (this.fireflyEffect) {
      this.fireflyEffect.destroy();
      this.fireflyEffect = null;
    }

    if (this.gradientSystem) {
      this.gradientSystem.destroy();
      this.gradientSystem = null;
    }

    if (this.hoverSystem) {
      this.hoverSystem.destroy();
      this.hoverSystem = null;
    }

    if (this.ambientSystem) {
      this.ambientSystem.destroy();
      this.ambientSystem = null;
    }

    this.mapView = null;
    this.currentLayer = null;
    this.initialized = false;
    this.effectsApplied = false;

    console.log('[EffectsManager] Destroyed and cleaned up');
  }
}