import { VisualizationRendererStrategy, ProcessedAnalysisData, VisualizationResult, VisualizationConfig } from '../../types';

/**
 * Enhanced Animation Configuration
 */
export interface AnimationConfig {
  enabled: boolean;
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  delay: number;
  loop: boolean;
}

export interface VisualEffectsConfig {
  fireflies?: {
    enabled: boolean;
    intensity: number; // 0-1 scale
    color: string;
    size: number;
    speed: number;
  };
  gradients?: {
    enabled: boolean;
    type: 'radial' | 'linear' | 'conic';
    colors: string[];
    animated: boolean;
  };
  borders?: {
    enabled: boolean;
    style: 'solid' | 'dashed' | 'dotted' | 'glow';
    width: number;
    animated: boolean;
    color: string;
  };
  hover?: {
    enabled: boolean;
    scale: number;
    glow: boolean;
    ripple: boolean;
    colorShift: boolean;
  };
  particles?: {
    enabled: boolean;
    count: number;
    size: number;
    opacity: number;
    movement: 'float' | 'orbit' | 'trail';
  };
}

export interface EnhancedVisualizationConfig extends VisualizationConfig {
  visualEffects?: VisualEffectsConfig;
  animations?: {
    entrance?: AnimationConfig;
    idle?: AnimationConfig;
    hover?: AnimationConfig;
    exit?: AnimationConfig;
  };
}

/**
 * EnhancedRendererBase - Base class for visually enhanced renderers
 * 
 * Provides:
 * - Advanced visual effects (fireflies, gradients, animations)
 * - Enhanced ArcGIS renderer creation with visual variables
 * - Animation coordination system
 * - Performance optimization utilities
 */
export abstract class EnhancedRendererBase implements VisualizationRendererStrategy {
  
  abstract supportsType(type: string): boolean;
  abstract render(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult;

  // ============================================================================
  // ENHANCED RENDERER CREATION
  // ============================================================================

  /**
   * Create enhanced ArcGIS renderer with visual effects
   */
  protected createEnhancedRenderer(
    baseRenderer: any, 
    data: ProcessedAnalysisData, 
    config: EnhancedVisualizationConfig
  ): any {
    
    const enhancedRenderer = { ...baseRenderer };
    
    // 🔥 CRITICAL FIX: Don't add visual variables to class-breaks renderers
    // Visual variables override class-breaks and cause grey visualization
    if (baseRenderer.type === 'class-breaks') {
      console.log('[EnhancedRendererBase] 🚫 SKIPPING visual variables for class-breaks renderer to prevent conflicts');
      // Remove any existing visual variables that might conflict
      if (baseRenderer.visualVariables) {
        console.log('[EnhancedRendererBase] 🗑️ Removing conflicting visual variables from class-breaks renderer');
        delete enhancedRenderer.visualVariables;
      }
    } else {
      // Add visual variables for animations, but preserve existing dual-variable setup
      if (!baseRenderer.visualVariables || baseRenderer.visualVariables.length === 0) {
        // Only add animation visual variables if no existing visual variables
        const visualVariables = this.createVisualVariables(data, config);
        if (visualVariables.length > 0) {
          enhancedRenderer.visualVariables = visualVariables;
        }
      } else {
        // Preserve existing visual variables (e.g., dual-variable setup)
        console.log('[EnhancedRendererBase] Preserving existing visual variables for dual-variable renderer');
        enhancedRenderer.visualVariables = baseRenderer.visualVariables;
      }
    }

    // Add custom properties for post-processing effects
    enhancedRenderer._enhancedEffects = {
      config: config.visualEffects,
      animations: config.animations,
      dataExtent: this.calculateDataExtent(data),
      enableFireflies: config.visualEffects?.fireflies?.enabled ?? false,
      enableGradients: config.visualEffects?.gradients?.enabled ?? false,
      enableParticles: config.visualEffects?.particles?.enabled ?? false
    };

    return enhancedRenderer;
  }

  /**
   * Create visual variables for dynamic styling
   */
  private createVisualVariables(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): any[] {
    const visualVariables: any[] = [];
    
    // Size variable for pulsing animations
    if (config.visualEffects?.hover?.scale || config.animations?.idle?.enabled) {
      visualVariables.push(this.createSizeVariable(data, config));
    }

    // Opacity variable for breathing effects
    if (config.animations?.idle?.enabled) {
      visualVariables.push(this.createOpacityVariable(data, config));
    }

    // Color variable for gradient effects
    if (config.visualEffects?.gradients?.enabled) {
      visualVariables.push(this.createColorVariable(data, config));
    }

    return visualVariables;
  }

  /**
   * Create size visual variable for animations
   */
  private createSizeVariable(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): any {
    const values = data.records.map(r => r.value).filter(v => !isNaN(v));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    const baseSize = config.symbolSize || 12;
    const sizeRange = config.visualEffects?.hover?.scale || 1.5;
    
    return {
      type: 'size',
      field: 'value',
      valueExpression: null,
      stops: [
        { value: minValue, size: baseSize },
        { value: maxValue, size: baseSize * sizeRange }
      ],
      _animationType: 'pulse',
      _animationDuration: config.animations?.idle?.duration || 2000
    };
  }

  /**
   * Create opacity visual variable for breathing effects
   */
  private createOpacityVariable(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): any {
    return {
      type: 'opacity',
      field: 'value',
      stops: [
        { value: 0, opacity: 0.3 },
        { value: 100, opacity: 0.9 }
      ],
      _animationType: 'breathe',
      _animationDuration: config.animations?.idle?.duration || 3000
    };
  }

  /**
   * Create color visual variable for gradients
   */
  private createColorVariable(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): any {
    const values = data.records.map(r => r.value).filter(v => !isNaN(v));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    const colors = config.visualEffects?.gradients?.colors || [
      '#2166ac', '#4393c3', '#92c5de', '#d1e5f0',
      '#fdbf6f', '#ff7f00', '#d73027'
    ];

    return {
      type: 'color',
      field: 'value',
      stops: colors.map((color, index) => ({
        value: minValue + (maxValue - minValue) * (index / (colors.length - 1)),
        color: color
      })),
      _animationType: config.visualEffects?.gradients?.animated ? 'shift' : 'static',
      _animationDuration: 5000
    };
  }

  // ============================================================================
  // FIREFLY EFFECT SYSTEM
  // ============================================================================

  /**
   * Create firefly effect configuration for points
   */
  protected createFireflyEffect(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): any {
    if (!config.visualEffects?.fireflies?.enabled) {
      return null;
    }

    const fireflyConfig = config.visualEffects.fireflies;
    const highValueThreshold = this.calculateHighValueThreshold(data);
    
    return {
      type: 'firefly',
      intensity: fireflyConfig.intensity,
      color: fireflyConfig.color || '#FFD700',
      size: fireflyConfig.size || 3,
      speed: fireflyConfig.speed || 1,
      triggerField: 'value',
      triggerThreshold: highValueThreshold,
      particleCount: Math.ceil(fireflyConfig.intensity * 20),
      animationDuration: 2000,
      glowRadius: 6
    };
  }

  /**
   * Calculate threshold for high-value firefly triggering
   */
  private calculateHighValueThreshold(data: ProcessedAnalysisData): number {
    const values = data.records.map(r => r.value).filter(v => !isNaN(v));
    if (values.length === 0) return 50;
    
    // Use 75th percentile as threshold
    const sorted = [...values].sort((a, b) => a - b);
    const p75Index = Math.floor(sorted.length * 0.75);
    return sorted[p75Index] || 50;
  }

  // ============================================================================
  // GRADIENT SYSTEM
  // ============================================================================

  /**
   * Create polygon gradient fill effects
   */
  protected createGradientFill(config: EnhancedVisualizationConfig, baseColor: string): any {
    if (!config.visualEffects?.gradients?.enabled) {
      return baseColor;
    }

    const gradientConfig = config.visualEffects.gradients;
    
    switch (gradientConfig.type) {
      case 'radial':
        return this.createRadialGradient(gradientConfig, baseColor);
      case 'linear':
        return this.createLinearGradient(gradientConfig, baseColor);
      case 'conic':
        return this.createConicGradient(gradientConfig, baseColor);
      default:
        return baseColor;
    }
  }

  private createRadialGradient(config: any, baseColor: string): any {
    return {
      type: 'gradient',
      gradient: {
        type: 'radial',
        stops: [
          { offset: 0, color: this.lightenColor(baseColor, 0.3) },
          { offset: 0.5, color: baseColor },
          { offset: 1, color: this.darkenColor(baseColor, 0.2) }
        ]
      },
      animated: config.animated,
      _animationType: 'rotate',
      _animationDuration: 8000
    };
  }

  private createLinearGradient(config: any, baseColor: string): any {
    const colors = config.colors || [baseColor];
    return {
      type: 'gradient',
      gradient: {
        type: 'linear',
        angle: 45,
        stops: colors.map((color: string, index: number) => ({
          offset: index / (colors.length - 1),
          color: color
        }))
      },
      animated: config.animated
    };
  }

  private createConicGradient(config: any, baseColor: string): any {
    return {
      type: 'gradient',
      gradient: {
        type: 'conic',
        stops: [
          { offset: 0, color: baseColor },
          { offset: 0.25, color: this.lightenColor(baseColor, 0.2) },
          { offset: 0.5, color: this.darkenColor(baseColor, 0.1) },
          { offset: 0.75, color: this.lightenColor(baseColor, 0.1) },
          { offset: 1, color: baseColor }
        ]
      },
      animated: config.animated,
      _animationType: 'spin',
      _animationDuration: 12000
    };
  }

  // ============================================================================
  // ENHANCED POPUP TEMPLATES
  // ============================================================================

  /**
   * Create enhanced popup template with animations
   */
  protected createEnhancedPopupTemplate(
    data: ProcessedAnalysisData, 
    config: EnhancedVisualizationConfig
  ): any {
    const baseTemplate = this.createBasePopupTemplate(data, config);
    
    // Add animation classes for popup appearance
    return {
      ...baseTemplate,
      content: [
        {
          type: 'text',
          text: '<div class="enhanced-popup-content">'
        },
        ...baseTemplate.content,
        {
          type: 'text',
          text: '</div>'
        }
      ],
      _enhancedAnimations: {
        entrance: 'slideInUp',
        duration: 300,
        easing: 'ease-out'
      }
    };
  }

  /**
   * Create base popup template
   */
  private createBasePopupTemplate(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): any {
    const popupFields = config.popupFields || ['area_name', 'value'];
    
    return {
      title: '{' + (config.labelField || 'area_name') + '}',
      content: [
        {
          type: 'fields',
          fieldInfos: popupFields.map(field => ({
            fieldName: field,
            label: this.formatFieldLabel(field),
            format: this.getFieldFormat(field)
          }))
        }
      ]
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Calculate data extent for normalization
   */
  private calculateDataExtent(data: ProcessedAnalysisData): { min: number; max: number } {
    const values = data.records.map(r => r.value).filter(v => !isNaN(v));
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  /**
   * Lighten a color by a percentage
   */
  private lightenColor(color: string, amount: number): string {
    // Simple implementation - in production, use a proper color manipulation library
    return color; // Placeholder
  }

  /**
   * Darken a color by a percentage
   */
  private darkenColor(color: string, amount: number): string {
    // Simple implementation - in production, use a proper color manipulation library
    return color; // Placeholder
  }

  /**
   * Format field labels for display
   */
  private formatFieldLabel(fieldName: string): string {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get format configuration for field types
   */
  private getFieldFormat(fieldName: string): any {
    if (fieldName.includes('value') || fieldName.includes('score')) {
      return { places: 2, digitSeparator: true };
    }
    if (fieldName.includes('percent') || fieldName.includes('rate')) {
      return { places: 1, digitSeparator: true };
    }
    return null;
  }
}