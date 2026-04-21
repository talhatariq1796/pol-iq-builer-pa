import { LayerStylingConfig, StylingAnimation as IStylingAnimation } from '../types';

/**
 * StylingAnimation - Handles animated transitions between styling configurations
 * 
 * Provides:
 * - Smooth transitions between different styling states
 * - Configurable duration and easing
 * - Progress tracking and cancellation
 */
export class StylingAnimation implements IStylingAnimation {
  public from: LayerStylingConfig;
  public to: LayerStylingConfig;
  public duration: number;
  public easing: string;

  private animationId: number | null = null;
  private startTime: number = 0;
  private isRunning = false;

  constructor(from: LayerStylingConfig, to: LayerStylingConfig, duration: number, easing: string = 'ease-out') {
    this.from = from;
    this.to = to;
    this.duration = duration;
    this.easing = easing;
  }

  /**
   * Execute the animation on the specified layer
   */
  async execute(layer: __esri.FeatureLayer): Promise<void> {
    if (this.isRunning) {
      console.warn('[StylingAnimation] Animation already running');
      return;
    }

    this.isRunning = true;
    this.startTime = performance.now();

    return new Promise((resolve, reject) => {
      const animate = (currentTime: number) => {
        if (!this.isRunning) {
          resolve();
          return;
        }

        const elapsed = currentTime - this.startTime;
        const progress = Math.min(elapsed / this.duration, 1);
        const easedProgress = this.applyEasing(progress, this.easing);

        try {
          this.updateLayerStyle(layer, easedProgress);
        } catch (error) {
          this.isRunning = false;
          reject(error);
          return;
        }

        if (progress < 1) {
          this.animationId = requestAnimationFrame(animate);
        } else {
          this.isRunning = false;
          resolve();
        }
      };

      this.animationId = requestAnimationFrame(animate);
    });
  }

  /**
   * Cancel the current animation
   */
  cancel(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isRunning = false;
  }

  /**
   * Check if animation is currently running
   */
  isAnimating(): boolean {
    return this.isRunning;
  }

  /**
   * Update layer style based on animation progress
   */
  private updateLayerStyle(layer: __esri.FeatureLayer, progress: number): void {
    // Interpolate between from and to configurations
    const interpolatedConfig = this.interpolateConfig(this.from, this.to, progress);
    
    // Apply the interpolated configuration
    this.applyConfigToLayer(layer, interpolatedConfig);
  }

  /**
   * Interpolate between two styling configurations
   */
  private interpolateConfig(from: LayerStylingConfig, to: LayerStylingConfig, progress: number): LayerStylingConfig {
    const interpolated: LayerStylingConfig = {
      baseStyle: this.interpolateBaseStyle(from.baseStyle, to.baseStyle, progress),
      animations: from.animations, // Keep original animations
      performance: from.performance // Keep original performance settings
    };

    // Interpolate effects if they exist in both configurations
    if (from.fireflyEffects && to.fireflyEffects) {
      interpolated.fireflyEffects = this.interpolateFireflyEffects(from.fireflyEffects, to.fireflyEffects, progress);
    } else {
      interpolated.fireflyEffects = progress > 0.5 ? to.fireflyEffects : from.fireflyEffects;
    }

    if (from.gradientEffects && to.gradientEffects) {
      interpolated.gradientEffects = this.interpolateGradientEffects(from.gradientEffects, to.gradientEffects, progress);
    } else {
      interpolated.gradientEffects = progress > 0.5 ? to.gradientEffects : from.gradientEffects;
    }

    if (from.hoverEffects && to.hoverEffects) {
      interpolated.hoverEffects = this.interpolateHoverEffects(from.hoverEffects, to.hoverEffects, progress);
    } else {
      interpolated.hoverEffects = progress > 0.5 ? to.hoverEffects : from.hoverEffects;
    }

    return interpolated;
  }

  /**
   * Interpolate base style configuration
   */
  private interpolateBaseStyle(from: any, to: any, progress: number): any {
    return {
      color: this.interpolateColor(from.color, to.color, progress),
      size: this.interpolateNumber(from.size || 8, to.size || 8, progress),
      opacity: this.interpolateNumber(from.opacity || 1, to.opacity || 1, progress),
      outline: from.outline && to.outline ? {
        color: this.interpolateColor(from.outline.color, to.outline.color, progress),
        width: this.interpolateNumber(from.outline.width || 1, to.outline.width || 1, progress),
        style: progress > 0.5 ? to.outline.style : from.outline.style
      } : (progress > 0.5 ? to.outline : from.outline)
    };
  }

  /**
   * Interpolate firefly effects
   */
  private interpolateFireflyEffects(from: any, to: any, progress: number): any {
    return {
      enabled: progress > 0.5 ? to.enabled : from.enabled,
      intensity: this.interpolateNumber(from.intensity || 0.5, to.intensity || 0.5, progress),
      color: this.interpolateColor(from.color || '#ffd700', to.color || '#ffd700', progress),
      particleSize: this.interpolateNumber(from.particleSize || 3, to.particleSize || 3, progress),
      glowRadius: this.interpolateNumber(from.glowRadius || 6, to.glowRadius || 6, progress)
    };
  }

  /**
   * Interpolate gradient effects
   */
  private interpolateGradientEffects(from: any, to: any, progress: number): any {
    return {
      gradient: from.gradient && to.gradient ? {
        type: progress > 0.5 ? to.gradient.type : from.gradient.type,
        colors: this.interpolateColorArray(from.gradient.colors || [], to.gradient.colors || [], progress),
        direction: this.interpolateNumber(from.gradient.direction || 0, to.gradient.direction || 0, progress),
        animated: progress > 0.5 ? to.gradient.animated : from.gradient.animated
      } : (progress > 0.5 ? to.gradient : from.gradient)
    };
  }

  /**
   * Interpolate hover effects
   */
  private interpolateHoverEffects(from: any, to: any, progress: number): any {
    return {
      enabled: progress > 0.5 ? to.enabled : from.enabled,
      scale: this.interpolateNumber(from.scale || 1, to.scale || 1, progress),
      duration: this.interpolateNumber(from.duration || 300, to.duration || 300, progress),
      glow: from.glow && to.glow ? {
        enabled: progress > 0.5 ? to.glow.enabled : from.glow.enabled,
        color: this.interpolateColor(from.glow.color || '#ffffff', to.glow.color || '#ffffff', progress),
        size: this.interpolateNumber(from.glow.size || 8, to.glow.size || 8, progress)
      } : (progress > 0.5 ? to.glow : from.glow)
    };
  }

  /**
   * Interpolate between two numbers
   */
  private interpolateNumber(from: number, to: number, progress: number): number {
    return from + (to - from) * progress;
  }

  /**
   * Interpolate between two colors
   */
  private interpolateColor(from: string, to: string, progress: number): string {
    // Simple color interpolation - in a full implementation, this would handle different color formats
    if (progress < 0.5) {
      return from;
    } else {
      return to;
    }
  }

  /**
   * Interpolate between two color arrays
   */
  private interpolateColorArray(from: string[], to: string[], progress: number): string[] {
    if (from.length === 0 && to.length === 0) return [];
    if (from.length === 0) return to;
    if (to.length === 0) return from;

    const maxLength = Math.max(from.length, to.length);
    const result: string[] = [];

    for (let i = 0; i < maxLength; i++) {
      const fromColor = from[i] || from[0] || '#3388ff';
      const toColor = to[i] || to[0] || '#3388ff';
      result.push(this.interpolateColor(fromColor, toColor, progress));
    }

    return result;
  }

  /**
   * Apply easing function to progress value
   */
  private applyEasing(progress: number, easing: string): number {
    switch (easing) {
      case 'linear':
        return progress;
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - (1 - progress) * (1 - progress);
      case 'ease-in-out':
        return progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      case 'bounce':
        return this.bounceEasing(progress);
      default:
        return progress;
    }
  }

  /**
   * Bounce easing function
   */
  private bounceEasing(progress: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (progress < 1 / d1) {
      return n1 * progress * progress;
    } else if (progress < 2 / d1) {
      return n1 * (progress -= 1.5 / d1) * progress + 0.75;
    } else if (progress < 2.5 / d1) {
      return n1 * (progress -= 2.25 / d1) * progress + 0.9375;
    } else {
      return n1 * (progress -= 2.625 / d1) * progress + 0.984375;
    }
  }

  /**
   * Apply configuration to layer
   */
  private applyConfigToLayer(layer: __esri.FeatureLayer, config: LayerStylingConfig): void {
    // Update renderer based on base style
    const renderer = this.createRendererFromConfig(config);
    if (renderer) {
      layer.renderer = renderer;
    }

    // Update visual effects
    if (config.visualEffects) {
      layer.effect = this.createVisualEffectString(config.visualEffects);
    }
  }

  /**
   * Create renderer from configuration
   */
  private createRendererFromConfig(config: LayerStylingConfig): __esri.Renderer | null {
    const { baseStyle } = config;
    
    // This is a simplified implementation
    // In a full implementation, this would create the appropriate renderer
    return null;
  }

  /**
   * Create visual effect string
   */
  private createVisualEffectString(visualEffects: any): string {
    const effects: string[] = [];

    if (visualEffects.bloom?.enabled) {
      effects.push(`bloom(${visualEffects.bloom.intensity}, ${visualEffects.bloom.radius}px, ${visualEffects.bloom.threshold})`);
    }

    if (visualEffects.glow?.enabled) {
      effects.push(`glow(${visualEffects.glow.color}, ${visualEffects.glow.size}px, ${visualEffects.glow.intensity})`);
    }

    return effects.join(' ');
  }
} 