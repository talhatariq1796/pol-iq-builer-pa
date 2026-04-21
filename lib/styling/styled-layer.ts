import { 
  LayerStylingConfig, 
  StylingAnimation, 
  StyledLayer as IStyledLayer 
} from './types';
import { StylingAnimation as StylingAnimationClass } from './animations/styling-animation';

/**
 * StyledLayer - Wrapper for ArcGIS FeatureLayer with enhanced styling capabilities
 * 
 * Provides:
 * - Styling configuration management
 * - Dynamic styling updates
 * - Animated transitions between styles
 * - Effect management and cleanup
 */
export class StyledLayer implements IStyledLayer {
  public id: string;
  public layer: __esri.FeatureLayer;
  public config: LayerStylingConfig;
  public effects: Map<string, any> = new Map();
  
  private animationInProgress = false;
  private cleanupFunctions: (() => void)[] = [];

  constructor(layer: __esri.FeatureLayer, config: LayerStylingConfig) {
    this.id = layer.id || `styled-layer-${Date.now()}`;
    this.layer = layer;
    this.config = config;
  }

  /**
   * Update styling configuration and reapply to layer
   */
  async updateStyling(newConfig: Partial<LayerStylingConfig>): Promise<void> {
    if (this.animationInProgress) {
      console.warn('[StyledLayer] Animation in progress, update ignored');
      return;
    }

    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    try {
      await this.reapplyStyling();
      console.log(`[StyledLayer] Styling updated for layer ${this.id}`);
    } catch (error) {
      // Revert on error
      this.config = oldConfig;
      console.error(`[StyledLayer] Failed to update styling for layer ${this.id}:`, error);
      throw error;
    }
  }

  /**
   * Animate transition between current and target styling configurations
   */
  async animateTransition(targetConfig: LayerStylingConfig, duration: number): Promise<void> {
    if (this.animationInProgress) {
      console.warn('[StyledLayer] Animation already in progress');
      return;
    }

    this.animationInProgress = true;

    try {
      const animation = new StylingAnimationClass(this.config, targetConfig, duration);
      await animation.execute(this.layer);
      
      this.config = targetConfig;
      console.log(`[StyledLayer] Animation completed for layer ${this.id}`);
    } catch (error) {
      console.error(`[StyledLayer] Animation failed for layer ${this.id}:`, error);
      throw error;
    } finally {
      this.animationInProgress = false;
    }
  }

  /**
   * Get current styling configuration
   */
  getStylingConfig(): LayerStylingConfig {
    return { ...this.config };
  }

  /**
   * Add an effect to this layer
   */
  addEffect(effectId: string, effect: any): void {
    this.effects.set(effectId, effect);
  }

  /**
   * Remove an effect from this layer
   */
  removeEffect(effectId: string): void {
    const effect = this.effects.get(effectId);
    if (effect && effect.cleanup) {
      effect.cleanup();
    }
    this.effects.delete(effectId);
  }

  /**
   * Get an effect by ID
   */
  getEffect(effectId: string): any {
    return this.effects.get(effectId);
  }

  /**
   * Check if an effect is active
   */
  hasEffect(effectId: string): boolean {
    return this.effects.has(effectId);
  }

  /**
   * Add a cleanup function to be called when the layer is destroyed
   */
  addCleanupFunction(cleanup: () => void): void {
    this.cleanupFunctions.push(cleanup);
  }

  /**
   * Clean up all effects and resources
   */
  cleanup(): void {
    // Clean up all effects
    this.effects.forEach((effect, effectId) => {
      if (effect && effect.cleanup) {
        try {
          effect.cleanup();
        } catch (error) {
          console.warn(`[StyledLayer] Error cleaning up effect ${effectId}:`, error);
        }
      }
    });
    this.effects.clear();

    // Run cleanup functions
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('[StyledLayer] Error in cleanup function:', error);
      }
    });
    this.cleanupFunctions = [];

    console.log(`[StyledLayer] Cleanup completed for layer ${this.id}`);
  }

  /**
   * Check if animation is currently in progress
   */
  isAnimating(): boolean {
    return this.animationInProgress;
  }

  /**
   * Get layer geometry type
   */
  getGeometryType(): 'point' | 'polygon' | 'polyline' | 'multipoint' | undefined {
    return this.layer.geometryType as any;
  }

  /**
   * Get layer feature count
   */
  async getFeatureCount(): Promise<number> {
    try {
      const query = this.layer.createQuery();
      (query as any).returnCountOnly = true;
      const result = await this.layer.queryFeatures(query);
      return result.features.length;
    } catch (error) {
      console.warn(`[StyledLayer] Could not get feature count for layer ${this.id}:`, error);
      return 0;
    }
  }

  /**
   * Get layer extent
   */
  async getExtent(): Promise<__esri.Extent | null> {
    try {
      const query = this.layer.createQuery();
      query.returnGeometry = false;
      const result = await this.layer.queryFeatures(query);
      
      if (result.features.length === 0) {
        return null;
      }

      // Calculate extent from features
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      result.features.forEach(feature => {
        if (feature.geometry) {
          const extent = feature.geometry.extent;
          if (extent) {
            minX = Math.min(minX, extent.xmin);
            minY = Math.min(minY, extent.ymin);
            maxX = Math.max(maxX, extent.xmax);
            maxY = Math.max(maxY, extent.ymax);
          }
        }
      });

      if (minX === Infinity) {
        return null;
      }

      return {
        xmin: minX,
        ymin: minY,
        xmax: maxX,
        ymax: maxY,
        spatialReference: this.layer.spatialReference
      } as __esri.Extent;
    } catch (error) {
      console.warn(`[StyledLayer] Could not get extent for layer ${this.id}:`, error);
      return null;
    }
  }

  /**
   * Reapply styling with current configuration
   */
  private async reapplyStyling(): Promise<void> {
    // Create enhanced renderer
    const renderer = await this.createEnhancedRenderer();
    this.layer.renderer = renderer;

    // Apply visual effects
    if (this.config.visualEffects) {
      this.layer.effect = this.createVisualEffect();
    }

    // Apply entry animations if configured
    if (this.config.animations?.entry) {
      await this.applyEntryAnimation();
    }
  }

  /**
   * Create enhanced renderer based on styling configuration
   */
  private async createEnhancedRenderer(): Promise<__esri.Renderer> {
    const { baseStyle } = this.config;
    const geometryType = this.getGeometryType();

    if (geometryType === 'point') {
      return this.createPointRenderer(baseStyle);
    } else if (geometryType === 'polygon') {
      return this.createPolygonRenderer(baseStyle);
    } else if (geometryType === 'polyline') {
      return this.createPolylineRenderer(baseStyle);
    } else {
      // Default renderer
      return this.createDefaultRenderer(baseStyle);
    }
  }

  /**
   * Create point renderer
   */
  private createPointRenderer(baseStyle: any): __esri.Renderer {
    const SimpleMarkerSymbol = require('@arcgis/core/symbols/SimpleMarkerSymbol').default;
    const SimpleRenderer = require('@arcgis/core/renderers/SimpleRenderer').default;

    const symbol = new SimpleMarkerSymbol({
      size: baseStyle.size || 8,
      color: this.parseColor(baseStyle.color),
      outline: baseStyle.outline ? {
        color: baseStyle.outline.color,
        width: baseStyle.outline.width,
        style: baseStyle.outline.style || 'solid'
      } : undefined,
      style: 'circle'
    });

    return new SimpleRenderer({ symbol });
  }

  /**
   * Create polygon renderer
   */
  private createPolygonRenderer(baseStyle: any): __esri.Renderer {
    const SimpleFillSymbol = require('@arcgis/core/symbols/SimpleFillSymbol').default;
    const SimpleRenderer = require('@arcgis/core/renderers/SimpleRenderer').default;

    const symbol = new SimpleFillSymbol({
      color: this.parseColor(baseStyle.color),
      outline: baseStyle.outline ? {
        color: baseStyle.outline.color,
        width: baseStyle.outline.width,
        style: baseStyle.outline.style || 'solid'
      } : undefined
    });

    return new SimpleRenderer({ symbol });
  }

  /**
   * Create polyline renderer
   */
  private createPolylineRenderer(baseStyle: any): __esri.Renderer {
    const SimpleLineSymbol = require('@arcgis/core/symbols/SimpleLineSymbol').default;
    const SimpleRenderer = require('@arcgis/core/renderers/SimpleRenderer').default;

    const symbol = new SimpleLineSymbol({
      color: this.parseColor(baseStyle.color),
      width: baseStyle.size || 2,
      style: 'solid'
    });

    return new SimpleRenderer({ symbol });
  }

  /**
   * Create default renderer
   */
  private createDefaultRenderer(baseStyle: any): __esri.Renderer {
    const SimpleRenderer = require('@arcgis/core/renderers/SimpleRenderer').default;
    
    return new SimpleRenderer({
      symbol: {
        type: 'simple-fill',
        color: this.parseColor(baseStyle.color),
        outline: {
          color: [255, 255, 255, 0.5],
          width: 1
        }
      }
    });
  }

  /**
   * Create visual effect string for ArcGIS layer
   */
  private createVisualEffect(): string {
    const effects: string[] = [];

    if (this.config.visualEffects?.bloom?.enabled) {
      effects.push(`bloom(${this.config.visualEffects.bloom.intensity}, ${this.config.visualEffects.bloom.radius}px, ${this.config.visualEffects.bloom.threshold})`);
    }

    if (this.config.visualEffects?.glow?.enabled) {
      effects.push(`glow(${this.config.visualEffects.glow.color}, ${this.config.visualEffects.glow.size}px, ${this.config.visualEffects.glow.intensity})`);
    }

    if (this.config.visualEffects?.shadow?.enabled) {
      effects.push(`drop-shadow(${this.config.visualEffects.shadow.offsetX}px ${this.config.visualEffects.shadow.offsetY}px ${this.config.visualEffects.shadow.blur}px ${this.config.visualEffects.shadow.color})`);
    }

    return effects.join(' ');
  }

  /**
   * Apply entry animation
   */
  private async applyEntryAnimation(): Promise<void> {
    const entryConfig = this.config.animations?.entry;
    if (!entryConfig) return;

    // For now, we'll use CSS transitions
    // In a full implementation, this would use the animation system
    const element = (this.layer as any).container;
    if (element) {
      element.style.transition = `all ${entryConfig.duration}ms ${entryConfig.easing || 'ease-out'}`;
      
      // Apply initial state based on animation type
      switch (entryConfig.type) {
        case 'fade-in':
          element.style.opacity = '0';
          break;
        case 'scale-up':
          element.style.transform = 'scale(0)';
          break;
        case 'slide-in':
          element.style.transform = 'translateY(20px)';
          element.style.opacity = '0';
          break;
      }

      // Trigger animation
      setTimeout(() => {
        element.style.opacity = '1';
        element.style.transform = 'scale(1) translateY(0)';
      }, entryConfig.delay || 0);
    }
  }

  /**
   * Parse color configuration to ArcGIS color format
   */
  private parseColor(color: string | any): any {
    if (typeof color === 'string') {
      return color;
    } else if (color && typeof color === 'object') {
      if (color.type === 'solid') {
        return color.value;
      } else if (color.type === 'gradient') {
        // Handle gradient colors
        return color.value[0] || '#3388ff';
      } else {
        // Default for data-driven colors
        return color.value || '#3388ff';
      }
    }
    return '#3388ff'; // Default color
  }
} 