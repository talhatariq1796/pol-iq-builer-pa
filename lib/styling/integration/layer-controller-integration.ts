import { EnhancedStylingManager } from '../enhanced-styling-manager';
import { getStylingPreset, createCustomPreset } from '../presets/styling-presets';
import { LayerStylingConfig, GlobalStylingConfig } from '../types';
import { LayerConfig, LayerGroup, ProjectLayerConfig, PointLayerConfig } from '../../../types/layers';

/**
 * LayerController Integration - Integrates Enhanced Styling with existing LayerController
 * 
 * Provides:
 * - Automatic styling application during layer creation
 * - Preset mapping based on layer configuration
 * - Integration with existing layer lifecycle
 * - Styling updates when layer configuration changes
 */
export class LayerControllerIntegration {
  private stylingManager: EnhancedStylingManager;
  private layerStylingMap: Map<string, LayerStylingConfig> = new Map();
  private globalConfig: GlobalStylingConfig;

  constructor(stylingManager: EnhancedStylingManager, globalConfig: GlobalStylingConfig) {
    this.stylingManager = stylingManager;
    this.globalConfig = globalConfig;
  }

  /**
   * Integrate with layer creation process
   * This should be called after a layer is created but before it's added to the map
   */
  async integrateLayerCreation(
    layer: __esri.FeatureLayer,
    layerConfig: LayerConfig,
    projectConfig: ProjectLayerConfig
  ): Promise<void> {
    try {
      // Determine appropriate styling configuration
      const stylingConfig = this.determineStylingConfig(layerConfig, projectConfig);
      
      // Store the styling configuration for this layer
      this.layerStylingMap.set(layer.id, stylingConfig);
      
      // Apply enhanced styling to the layer
      await this.stylingManager.applyStylingToLayer(layer, stylingConfig);
      
      console.log(`[LayerControllerIntegration] Enhanced styling applied to layer ${layer.id}`);
    } catch (error) {
      console.error(`[LayerControllerIntegration] Failed to apply styling to layer ${layer.id}:`, error);
      // Don't throw - we want layer creation to continue even if styling fails
    }
  }

  /**
   * Update styling when layer configuration changes
   */
  async updateLayerStyling(
    layerId: string,
    layerConfig: LayerConfig,
    projectConfig: ProjectLayerConfig
  ): Promise<void> {
    try {
      const layer = this.findLayerById(layerId);
      if (!layer) {
        console.warn(`[LayerControllerIntegration] Layer ${layerId} not found for styling update`);
        return;
      }

      // Determine new styling configuration
      const newStylingConfig = this.determineStylingConfig(layerConfig, projectConfig);
      
      // Update the stored configuration
      this.layerStylingMap.set(layerId, newStylingConfig);
      
      // Apply the new styling
      await this.stylingManager.updateLayerStyling(layerId, newStylingConfig);
      
      console.log(`[LayerControllerIntegration] Styling updated for layer ${layerId}`);
    } catch (error) {
      console.error(`[LayerControllerIntegration] Failed to update styling for layer ${layerId}:`, error);
    }
  }

  /**
   * Animate layer styling transition
   */
  async animateLayerStyling(
    layerId: string,
    targetPreset: string,
    duration: number = 1000
  ): Promise<void> {
    try {
      const targetConfig = getStylingPreset(targetPreset);
      await this.stylingManager.animateLayerTransition(layerId, targetConfig, duration);
      
      // Update stored configuration
      this.layerStylingMap.set(layerId, targetConfig);
      
      console.log(`[LayerControllerIntegration] Styling animation completed for layer ${layerId}`);
    } catch (error) {
      console.error(`[LayerControllerIntegration] Failed to animate styling for layer ${layerId}:`, error);
    }
  }

  /**
   * Remove layer from styling system
   */
  removeLayer(layerId: string): void {
    this.stylingManager.removeLayer(layerId);
    this.layerStylingMap.delete(layerId);
    console.log(`[LayerControllerIntegration] Layer ${layerId} removed from styling system`);
  }

  /**
   * Get current styling configuration for a layer
   */
  getLayerStylingConfig(layerId: string): LayerStylingConfig | undefined {
    return this.layerStylingMap.get(layerId);
  }

  /**
   * Determine appropriate styling configuration based on layer config
   */
  private determineStylingConfig(
    layerConfig: LayerConfig, 
    projectConfig: ProjectLayerConfig
  ): LayerStylingConfig {
    // Start with default preset
    let presetName = 'default';
    
    // Determine preset based on layer type and metadata
    if (layerConfig.type === 'point') {
      presetName = this.getPointLayerPreset(layerConfig);
    } else if (layerConfig.type === 'index' || layerConfig.type === 'percentage') {
      presetName = this.getPolygonLayerPreset(layerConfig);
    } else {
      presetName = this.getGenericLayerPreset(layerConfig);
    }

    // Get base preset
    const baseConfig = getStylingPreset(presetName);
    
    // Apply layer-specific customizations
    const customizedConfig = this.customizeStylingForLayer(baseConfig, layerConfig, projectConfig);
    
    return customizedConfig;
  }

  /**
   * Get appropriate preset for point layers
   */
  private getPointLayerPreset(layerConfig: LayerConfig): string {
    // Check for specific layer IDs or metadata that indicate special styling
    if (layerConfig.id.includes('hotspot') || layerConfig.id.includes('cluster')) {
      return 'hotspot';
    }
    
    if (layerConfig.id.includes('outlier')) {
      return 'outlier';
    }
    
    // Check metadata tags
    const tags = layerConfig.metadata?.tags || [];
    if (tags.includes('premium') || tags.includes('important')) {
      return 'premium';
    }
    
    // Default for point layers
    return 'default';
  }

  /**
   * Get appropriate preset for polygon layers
   */
  private getPolygonLayerPreset(layerConfig: LayerConfig): string {
    // Check for specific analysis types
    if (layerConfig.id.includes('correlation') || layerConfig.id.includes('correlate')) {
      return 'correlation';
    }
    
    if (layerConfig.id.includes('trend') || layerConfig.id.includes('temporal')) {
      return 'trend';
    }
    
    if (layerConfig.id.includes('cluster')) {
      return 'cluster';
    }
    
    if (layerConfig.id.includes('comparison') || layerConfig.id.includes('compare')) {
      return 'comparison';
    }
    
    // Check metadata tags
    const tags = layerConfig.metadata?.tags || [];
    if (tags.includes('correlation')) {
      return 'correlation';
    }
    
    if (tags.includes('trend')) {
      return 'trend';
    }
    
    if (tags.includes('cluster')) {
      return 'cluster';
    }
    
    // Default for polygon layers
    return 'default';
  }

  /**
   * Get appropriate preset for generic layers
   */
  private getGenericLayerPreset(layerConfig: LayerConfig): string {
    // Check for special layer types
    if (layerConfig.id.includes('premium') || layerConfig.isPrimary) {
      return 'premium';
    }
    
    // Check metadata tags
    const tags = layerConfig.metadata?.tags || [];
    if (tags.includes('premium') || tags.includes('important')) {
      return 'premium';
    }
    
    // Default
    return 'default';
  }

  /**
   * Customize styling configuration for specific layer
   */
  private customizeStylingForLayer(
    baseConfig: LayerStylingConfig,
    layerConfig: LayerConfig,
    projectConfig: ProjectLayerConfig
  ): LayerStylingConfig {
    const customizations: Partial<LayerStylingConfig> = {};

    // Apply symbol configuration if available (only for point layers)
    if (layerConfig.type === 'point' && 'symbolConfig' in layerConfig && layerConfig.symbolConfig) {
      const pointConfig = layerConfig as PointLayerConfig;
      customizations.baseStyle = {
        ...baseConfig.baseStyle,
        color: pointConfig.symbolConfig.color ? `rgba(${pointConfig.symbolConfig.color.join(',')})` : baseConfig.baseStyle.color,
        size: pointConfig.symbolConfig.size || baseConfig.baseStyle.size,
        opacity: pointConfig.symbolConfig.opacity || baseConfig.baseStyle.opacity,
        outline: pointConfig.symbolConfig.outline ? {
          color: `rgba(${pointConfig.symbolConfig.outline.color.join(',')})`,
          width: pointConfig.symbolConfig.outline.width,
          style: 'solid'
        } : baseConfig.baseStyle.outline
      };
    }

    // Apply primary layer enhancements
    if (layerConfig.isPrimary) {
      customizations.fireflyEffects = {
        enabled: true,
        intensity: 0.8,
        color: '#ffd700',
        particleSize: 4,
        glowRadius: 8,
        orbitSpeed: 0.03,
        pulseSpeed: 0.06,
        maxParticles: 75,
        triggerThreshold: 60,
        fadeDistance: 120
      };
      
      customizations.animations = {
        ...baseConfig.animations,
        entry: {
          type: 'bounce',
          duration: 800,
          easing: 'ease-out'
        }
      };
    }

    // Apply group-based customizations
    const group = this.findLayerGroup(layerConfig, projectConfig);
    if (group) {
      customizations.baseStyle = {
        ...customizations.baseStyle,
        color: this.getGroupColor(group) || customizations.baseStyle?.color || baseConfig.baseStyle.color
      };
    }

    // Merge customizations with base config
    return createCustomPreset('default', customizations);
  }

  /**
   * Find the group that contains this layer
   */
  private findLayerGroup(layerConfig: LayerConfig, projectConfig: ProjectLayerConfig): LayerGroup | undefined {
    return projectConfig.groups.find(group => 
      group.layers?.some(layer => layer.id === layerConfig.id)
    );
  }

  /**
   * Get color for a group (could be extended to use group metadata)
   */
  private getGroupColor(group: LayerGroup): string | undefined {
    // This could be extended to use group metadata or predefined color schemes
    const groupColors: Record<string, string> = {
      'demographics': '#3498db',
      'economics': '#e74c3c',
      'health': '#2ecc71',
      'education': '#f39c12',
      'transportation': '#9b59b6',
      'environment': '#1abc9c'
    };
    
    return groupColors[group.id.toLowerCase()];
  }

  /**
   * Find layer by ID in the map
   */
  private findLayerById(layerId: string): __esri.FeatureLayer | undefined {
    // This would need to be implemented based on how you access the map view
    // For now, we'll rely on the styling manager to handle this
    return undefined;
  }

  /**
   * Get all styled layers
   */
  getAllStyledLayers(): Array<{ layerId: string; config: LayerStylingConfig }> {
    return Array.from(this.layerStylingMap.entries()).map(([layerId, config]) => ({
      layerId,
      config
    }));
  }

  /**
   * Get styling statistics
   */
  getStylingStats(): {
    totalLayers: number;
    presetUsage: Record<string, number>;
    effectsUsage: Record<string, number>;
  } {
    const presetUsage: Record<string, number> = {};
    const effectsUsage: Record<string, number> = {};

    this.layerStylingMap.forEach(config => {
      // Count preset usage (this would need to be tracked separately)
      // For now, we'll count effects usage
      if (config.fireflyEffects?.enabled) {
        effectsUsage.firefly = (effectsUsage.firefly || 0) + 1;
      }
      if (config.gradientEffects) {
        effectsUsage.gradient = (effectsUsage.gradient || 0) + 1;
      }
      if (config.hoverEffects?.enabled) {
        effectsUsage.hover = (effectsUsage.hover || 0) + 1;
      }
      if (config.ambientEffects?.enabled) {
        effectsUsage.ambient = (effectsUsage.ambient || 0) + 1;
      }
    });

    return {
      totalLayers: this.layerStylingMap.size,
      presetUsage,
      effectsUsage
    };
  }
}

/**
 * Integration helper functions
 */

/**
 * Create integration instance with default configuration
 */
export function createLayerControllerIntegration(
  stylingManager: EnhancedStylingManager,
  globalConfig?: Partial<GlobalStylingConfig>
): LayerControllerIntegration {
  const defaultConfig: GlobalStylingConfig = {
    effects: {
      enabled: true,
      performance: 'auto',
      fireflies: { enabled: true, intensity: 0.7 },
      gradients: true,
      hover: { enabled: true, scale: 1.2 },
      ambient: { enabled: true, density: 0.3 },
      coordinateEffects: true
    },
    performance: {
      adaptive: true,
      monitoring: false, // Disabled as per user preference
      thresholds: {
        maxFrameTime: 16.67,
        maxMemoryUsage: 100 * 1024 * 1024,
        maxParticleCount: 1000,
        maxGradientComplexity: 5
      },
      optimization: {
        autoOptimize: true,
        reduceParticles: true,
        simplifyGradients: true,
        disableComplexAnimations: false
      }
    },
    themes: {
      default: 'default',
      available: ['default', 'premium', 'correlation', 'hotspot', 'cluster']
    },
    defaults: {
      point: { color: '#3388ff', opacity: 0.8 },
      polygon: { color: '#3388ff', opacity: 0.8 },
      line: { color: '#3388ff', opacity: 0.8 }
    }
  };

  const finalConfig = { ...defaultConfig, ...globalConfig };
  return new LayerControllerIntegration(stylingManager, finalConfig);
}

/**
 * Hook for integrating with React components
 */
export function useLayerControllerIntegration(
  stylingManager: EnhancedStylingManager,
  globalConfig?: Partial<GlobalStylingConfig>
): LayerControllerIntegration {
  // This would be implemented as a React hook if needed
  return createLayerControllerIntegration(stylingManager, globalConfig);
} 