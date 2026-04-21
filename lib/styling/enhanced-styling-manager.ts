import { EffectsManager } from '../analysis/strategies/renderers/effects/EffectsManager';
import { StyledLayer } from './styled-layer';
import { 
  GlobalStylingConfig, 
  LayerStylingConfig, 
  StyledLayer as IStyledLayer 
} from './types';
import { STANDARD_OPACITY } from '@/utils/renderer-standardization';

/**
 * EnhancedStylingManager - Central orchestrator for the enhanced styling system
 * 
 * Provides:
 * - Unified styling interface for all layers
 * - Integration with existing effects systems
 * - Performance optimization and monitoring
 * - Layer lifecycle management
 */
export class EnhancedStylingManager {
  private effectsManager: EffectsManager;
  private layerRegistry: Map<string, StyledLayer> = new Map();
  private globalConfig: GlobalStylingConfig;
  private mapView: __esri.MapView | null = null;
  private initialized = false;

  constructor(config: GlobalStylingConfig) {
    this.globalConfig = config;
    this.effectsManager = new EffectsManager(config.effects);
  }

  /**
   * Initialize the styling manager with a map view
   */
  async initialize(mapView: __esri.MapView): Promise<void> {
    if (this.initialized) {
      console.warn('[EnhancedStylingManager] Already initialized');
      return;
    }

    this.mapView = mapView;
    
    try {
      await this.effectsManager.initialize(mapView);
      this.setupLayerListeners();
      this.initialized = true;
      console.log('[EnhancedStylingManager] Initialized successfully');
    } catch (error) {
      console.error('[EnhancedStylingManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Apply enhanced styling to a layer
   */
  async applyStylingToLayer(
    layer: __esri.FeatureLayer, 
    stylingConfig: LayerStylingConfig
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('[EnhancedStylingManager] Not initialized. Call initialize() first.');
    }

    try {
      // Create styled layer wrapper
      const styledLayer = new StyledLayer(layer, stylingConfig);
      this.layerRegistry.set(layer.id, styledLayer);

      // Check if layer already has a sophisticated renderer (AI visualization)
      const hasSophisticatedRenderer = this.hasSophisticatedRenderer(layer);
      
      if (hasSophisticatedRenderer) {
        console.log(`[EnhancedStylingManager] Layer ${layer.id} has sophisticated renderer, preserving it and applying effects only`);
        
        // Apply effects only (preserve existing renderer)
        await this.applyEffectsToLayer(layer, stylingConfig);
        
        // Setup interactions
        this.setupLayerInteractions(layer, stylingConfig);
      } else {
        // Apply full enhanced styling (including renderer creation)
        await this.applyBaseStyling(layer, stylingConfig);
        await this.applyEffectsToLayer(layer, stylingConfig);
        this.setupLayerInteractions(layer, stylingConfig);
      }

      console.log(`[EnhancedStylingManager] Styling applied to layer ${layer.id}`);
    } catch (error) {
      console.error(`[EnhancedStylingManager] Failed to apply styling to layer ${layer.id}:`, error);
      throw error;
    }
  }

  /**
   * Update styling for an existing layer
   */
  async updateLayerStyling(layerId: string, newConfig: Partial<LayerStylingConfig>): Promise<void> {
    const styledLayer = this.layerRegistry.get(layerId);
    if (!styledLayer) {
      throw new Error(`[EnhancedStylingManager] Layer ${layerId} not found`);
    }

    await styledLayer.updateStyling(newConfig);
  }

  /**
   * Animate transition for a layer
   */
  async animateLayerTransition(
    layerId: string, 
    targetConfig: LayerStylingConfig, 
    duration: number
  ): Promise<void> {
    const styledLayer = this.layerRegistry.get(layerId);
    if (!styledLayer) {
      throw new Error(`[EnhancedStylingManager] Layer ${layerId} not found`);
    }

    await styledLayer.animateTransition(targetConfig, duration);
  }

  /**
   * Get styled layer by ID
   */
  getStyledLayer(layerId: string): StyledLayer | undefined {
    return this.layerRegistry.get(layerId);
  }

  /**
   * Get all styled layers
   */
  getAllStyledLayers(): StyledLayer[] {
    return Array.from(this.layerRegistry.values());
  }

  /**
   * Remove a layer from the styling system
   */
  removeLayer(layerId: string): void {
    const styledLayer = this.layerRegistry.get(layerId);
    if (styledLayer) {
      styledLayer.cleanup();
      this.layerRegistry.delete(layerId);
      console.log(`[EnhancedStylingManager] Layer ${layerId} removed`);
    }
  }

  /**
   * Get layer configuration
   */
  getLayerConfig(layerId: string): LayerStylingConfig | undefined {
    const styledLayer = this.layerRegistry.get(layerId);
    return styledLayer?.getStylingConfig();
  }

  /**
   * Update global configuration
   */
  updateGlobalConfig(newConfig: Partial<GlobalStylingConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...newConfig };
    
    // Update effects manager configuration
    if (newConfig.effects) {
      this.effectsManager.updateConfig(newConfig.effects);
    }

    console.log('[EnhancedStylingManager] Global configuration updated');
  }

  /**
   * Check if a layer has a sophisticated renderer (AI visualization)
   */
  private hasSophisticatedRenderer(layer: __esri.FeatureLayer): boolean {
    if (!layer.renderer) return false;
    
    // Check for AI visualization renderer types
    const rendererType = layer.renderer.type;
    const hasClassBreaks = rendererType === 'class-breaks' && (layer.renderer as any).classBreakInfos?.length > 0;
    const hasVisualVariables = (layer.renderer as any).visualVariables?.length > 0;
    const hasEnhancedFlags = (layer.renderer as any)._polygonMode || (layer.renderer as any)._visualEffects;
    
    return hasClassBreaks || hasVisualVariables || hasEnhancedFlags;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): any {
    const stats = {
      totalLayers: this.layerRegistry.size,
      effectsStats: this.effectsManager.getPerformanceStats(),
      layers: Array.from(this.layerRegistry.entries()).map(([id, layer]) => ({
        id,
        isAnimating: layer.isAnimating(),
        featureCount: 0 // Would be populated in a full implementation
      }))
    };

    return stats;
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    // Clean up all styled layers
    this.layerRegistry.forEach((styledLayer, layerId) => {
      styledLayer.cleanup();
    });
    this.layerRegistry.clear();

    // Clean up effects manager
    this.effectsManager.destroy();

    this.initialized = false;
    console.log('[EnhancedStylingManager] Destroyed');
  }

  /**
   * Apply base styling to layer
   */
  private async applyBaseStyling(layer: __esri.FeatureLayer, config: LayerStylingConfig): Promise<void> {
    const renderer = await this.createEnhancedRenderer(layer, config);
    layer.renderer = renderer;

    // Apply visual effects
    if (config.visualEffects) {
      layer.effect = this.createVisualEffect(config.visualEffects);
    }
  }

  /**
   * Apply effects to layer based on configuration
   */
  private async applyEffectsToLayer(layer: __esri.FeatureLayer, config: LayerStylingConfig): Promise<void> {
    // Create visualization result object with enhanced effects
    const visualizationResult = {
      type: layer.geometryType === 'point' ? 'point' : 'choropleth',
      _enhancedEffects: {
        fireflies: config.fireflyEffects,
        gradients: config.gradientEffects,
        hover: config.hoverEffects,
        ambient: config.ambientEffects
      }
    };

    // Apply effects using the EffectsManager's public API
    await this.effectsManager.applyEffectsToLayer(layer, visualizationResult);
  }

  /**
   * Setup layer interactions
   */
  private setupLayerInteractions(layer: __esri.FeatureLayer, config: LayerStylingConfig): void {
    // Note: Event handling will be implemented in a future phase
    // For now, we focus on the core styling functionality
    console.log(`[EnhancedStylingManager] Layer interactions setup for ${layer.id}`);
  }

  /**
   * Handle layer hover events
   */
  private handleLayerHover(event: any, isHover: boolean): void {
    const feature = event.graphic;
    if (!feature) return;

    const styledLayer = this.findLayerByFeature(feature);
    if (!styledLayer) return;

    // Apply hover styling
    this.applyHoverStyle(feature, isHover);
  }

  /**
   * Handle layer click events
   */
  private handleLayerClick(event: any): void {
    const feature = event.graphic;
    if (!feature) return;

    const styledLayer = this.findLayerByFeature(feature);
    if (!styledLayer) return;

    // Apply click animation
    this.applyClickAnimation(feature);
  }

  /**
   * Find styled layer by feature
   */
  private findLayerByFeature(feature: __esri.Graphic): StyledLayer | undefined {
    // This is a simplified implementation
    // In a full implementation, this would track feature-to-layer mapping
    return Array.from(this.layerRegistry.values()).find(layer => 
      layer.layer === feature.layer
    );
  }

  /**
   * Apply hover style to feature
   */
  private applyHoverStyle(feature: __esri.Graphic, isHover: boolean): void {
    // This would apply hover styling to the feature
    // Implementation depends on the specific styling requirements
  }

  /**
   * Apply click animation to feature
   */
  private applyClickAnimation(feature: __esri.Graphic): void {
    // This would apply click animation to the feature
    // Implementation depends on the specific animation requirements
  }

  /**
   * Create enhanced renderer based on styling configuration
   */
  private async createEnhancedRenderer(layer: __esri.FeatureLayer, config: LayerStylingConfig): Promise<__esri.Renderer> {
    const { baseStyle } = config;
    const geometryType = layer.geometryType;

    // Check if we should create a data-driven renderer
    if (baseStyle.color && typeof baseStyle.color === 'object' && baseStyle.color.type === 'data-driven' && baseStyle.color.field) {
      return this.createDataDrivenRenderer(layer, baseStyle.color);
    }

    // Fall back to simple renderers
    if (geometryType === 'point') {
      return this.createPointRenderer(baseStyle);
    } else if (geometryType === 'polygon') {
      return this.createPolygonRenderer(baseStyle);
    } else if (geometryType === 'polyline') {
      return this.createPolylineRenderer(baseStyle);
    } else {
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
   * Create data-driven renderer (quartile-based)
   */
  private async createDataDrivenRenderer(layer: __esri.FeatureLayer, colorConfig: any): Promise<__esri.Renderer> {
    const { createQuartileRenderer } = await import('@/utils/createQuartileRenderer');
    
    try {
      console.log(`[EnhancedStyling] Creating data-driven renderer for layer ${layer.title} with field: ${colorConfig.field}`);
      
      const rendererResult = await createQuartileRenderer({
        layer,
        field: colorConfig.field,
        isCompositeIndex: false,
        opacity: STANDARD_OPACITY,
        outlineWidth: 0.5,
        outlineColor: [128, 128, 128]
      });

      if (rendererResult?.renderer) {
        console.log(`✅ Data-driven renderer created for layer ${layer.title}`);
        return rendererResult.renderer;
      } else {
        console.warn(`⚠️ No renderer returned for layer ${layer.title}, falling back to simple renderer`);
        return this.createDefaultRenderer({ color: colorConfig.value || '#666666' });
      }
    } catch (error) {
      console.error(`❌ Error creating data-driven renderer for layer ${layer.title}:`, error);
      return this.createDefaultRenderer({ color: colorConfig.value || '#666666' });
    }
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
   * Create visual effect string
   */
  private createVisualEffect(visualEffects: any): string {
    const effects: string[] = [];

    if (visualEffects.bloom?.enabled) {
      effects.push(`bloom(${visualEffects.bloom.intensity}, ${visualEffects.bloom.radius}px, ${visualEffects.bloom.threshold})`);
    }

    if (visualEffects.glow?.enabled) {
      effects.push(`glow(${visualEffects.glow.color}, ${visualEffects.glow.size}px, ${visualEffects.glow.intensity})`);
    }

    if (visualEffects.shadow?.enabled) {
      effects.push(`drop-shadow(${visualEffects.shadow.offsetX}px ${visualEffects.shadow.offsetY}px ${visualEffects.shadow.blur}px ${visualEffects.shadow.color})`);
    }

    return effects.join(' ');
  }

  /**
   * Get layer features
   */
  private async getLayerFeatures(layer: __esri.FeatureLayer): Promise<__esri.Graphic[]> {
    try {
      const query = layer.createQuery();
      const result = await layer.queryFeatures(query);
      return result.features;
    } catch (error) {
      console.warn(`[EnhancedStylingManager] Could not get features for layer ${layer.id}:`, error);
      return [];
    }
  }

  /**
   * Parse color configuration
   */
  private parseColor(color: string | any): any {
    if (typeof color === 'string') {
      return color;
    } else if (color && typeof color === 'object') {
      if (color.type === 'solid') {
        return color.value;
      } else if (color.type === 'gradient') {
        return color.value[0] || '#3388ff';
      } else {
        return color.value || '#3388ff';
      }
    }
    return '#3388ff';
  }

  /**
   * Setup layer listeners
   */
  private setupLayerListeners(): void {
    // Note: Layer event listeners will be implemented in a future phase
    // For now, we focus on the core styling functionality
    console.log('[EnhancedStylingManager] Layer listeners setup completed');
  }
} 