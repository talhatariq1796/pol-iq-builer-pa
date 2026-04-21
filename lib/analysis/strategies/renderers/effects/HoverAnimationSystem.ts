/**
 * HoverAnimationSystem - Interactive hover effects and animations
 * 
 * Features:
 * - Smooth scale transitions on hover
 * - Ripple effects emanating from cursor
 * - Color morphing and glow effects
 * - Dynamic shadows and elevation
 * - Performance-optimized interaction handling
 */

export interface HoverEffectConfig {
  enabled: boolean;
  scale: number;           // Scale multiplier on hover (1.2 = 20% larger)
  duration: number;        // Animation duration in milliseconds
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
  ripple: {
    enabled: boolean;
    color: string;
    maxRadius: number;
    duration: number;
    opacity: number;
  };
  glow: {
    enabled: boolean;
    color: string;
    size: number;
    intensity: number;
  };
  colorShift: {
    enabled: boolean;
    hoverColor: string;
    blendMode: 'multiply' | 'overlay' | 'screen' | 'lighten';
  };
  shadow: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

interface RippleEffect {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  color: string;
  startTime: number;
  duration: number;
  active: boolean;
}

interface HoverState {
  featureId: string;
  isHovered: boolean;
  hoverStartTime: number;
  originalScale: number;
  targetScale: number;
  currentScale: number;
  animationProgress: number;
}

/**
 * HoverAnimationSystem manages interactive hover effects for map features
 */
export class HoverAnimationSystem {
  private mapView: __esri.MapView | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  private config: HoverEffectConfig;
  
  private ripples: RippleEffect[] = [];
  private hoverStates: Map<string, HoverState> = new Map();
  private hoveredFeature: any = null;
  private lastFrameTime = 0;
  
  private hitTest: __esri.HitTestResult | null = null;

  constructor(config: Partial<HoverEffectConfig> = {}) {
    this.config = {
      enabled: true,
      scale: 1.3,
      duration: 300,
      easing: 'ease-out',
      ripple: {
        enabled: true,
        color: '#4A90E2',
        maxRadius: 50,
        duration: 800,
        opacity: 0.4
      },
      glow: {
        enabled: true,
        color: '#FFFFFF',
        size: 8,
        intensity: 0.6
      },
      colorShift: {
        enabled: true,
        hoverColor: '#FFD700',
        blendMode: 'overlay'
      },
      shadow: {
        enabled: true,
        color: '#000000',
        blur: 10,
        offsetX: 2,
        offsetY: 4
      },
      ...config
    };
  }

  /**
   * Initialize hover animation system
   */
  initialize(mapView: __esri.MapView): void {
    this.mapView = mapView;
    this.createCanvas();
    this.setupEventListeners();
    this.startAnimation();
    console.log('[HoverAnimationSystem] Initialized with config:', this.config);
  }

  /**
   * Create canvas overlay for hover effects
   */
  private createCanvas(): void {
    if (!this.mapView) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1001'; // Above other effect layers
    this.canvas.className = 'hover-animation-canvas';

    const mapContainer = this.mapView.container as HTMLElement;
    this.canvas.width = mapContainer.clientWidth;
    this.canvas.height = mapContainer.clientHeight;
    this.canvas.style.width = mapContainer.clientWidth + 'px';
    this.canvas.style.height = mapContainer.clientHeight + 'px';

    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
    }

    mapContainer.appendChild(this.canvas);
  }

  /**
   * Setup mouse and touch event listeners
   */
  private setupEventListeners(): void {
    if (!this.mapView) return;

    // Mouse move for hover detection
    this.mapView.on('pointer-move', (event) => {
      this.handlePointerMove(event);
    });

    // Click for ripple effects
    this.mapView.on('click', (event) => {
      this.handleClick(event);
    });

    // Map navigation updates
    this.mapView.watch('size', () => this.resizeCanvas());
    this.mapView.watch(['center', 'zoom', 'rotation'], () => {
      this.updateFeaturePositions();
    });
  }

  /**
   * Handle pointer move for hover detection
   */
  private async handlePointerMove(event: __esri.ViewPointerMoveEvent): Promise<void> {
    if (!this.config.enabled || !this.mapView) return;

    try {
      // Perform hit test to find features under cursor
      const hitTest = await this.mapView.hitTest(event, {
        include: this.mapView.graphics
      });

      const newHoveredFeature = hitTest.results.find(result => result.type === 'graphic')?.graphic;

      // Check if hover state changed
      if (newHoveredFeature !== this.hoveredFeature) {
        // End hover on previous feature
        if (this.hoveredFeature) {
          this.endHover(this.hoveredFeature);
        }

        // Start hover on new feature
        if (newHoveredFeature) {
          this.startHover(newHoveredFeature, event.x, event.y);
        }

        this.hoveredFeature = newHoveredFeature;
      }
    } catch (error) {
      // Hit test can fail, ignore silently
    }
  }

  /**
   * Handle click for ripple effects
   */
  private handleClick(event: __esri.ViewClickEvent): void {
    if (!this.config.enabled || !this.config.ripple.enabled) return;

    this.createRipple(event.x, event.y);
  }

  /**
   * Start hover animation on feature
   */
  private startHover(feature: __esri.Graphic, x: number, y: number): void {
    const featureId = this.getFeatureId(feature);
    
    const hoverState: HoverState = {
      featureId,
      isHovered: true,
      hoverStartTime: Date.now(),
      originalScale: 1,
      targetScale: this.config.scale,
      currentScale: 1,
      animationProgress: 0
    };

    this.hoverStates.set(featureId, hoverState);

    // Create ripple effect if enabled
    if (this.config.ripple.enabled) {
      this.createRipple(x, y);
    }

    // Apply immediate visual changes to the feature
    this.applyHoverStyle(feature, true);
  }

  /**
   * End hover animation on feature
   */
  private endHover(feature: __esri.Graphic): void {
    const featureId = this.getFeatureId(feature);
    const hoverState = this.hoverStates.get(featureId);

    if (hoverState) {
      hoverState.isHovered = false;
      hoverState.targetScale = hoverState.originalScale;
      
      // Remove hover style
      this.applyHoverStyle(feature, false);
      
      // Keep in map for scale animation to complete
      setTimeout(() => {
        this.hoverStates.delete(featureId);
      }, this.config.duration);
    }
  }

  /**
   * Apply visual hover style to feature
   */
  private applyHoverStyle(feature: __esri.Graphic, isHover: boolean): void {
    if (!feature.symbol) return;

    try {
      const symbol = feature.symbol.clone();
      
      // Apply color shift
      if (this.config.colorShift.enabled && isHover) {
        if (symbol.color) {
          symbol.color = this.config.colorShift.hoverColor;
        }
      }

      // Apply glow effect through outline
      if (this.config.glow.enabled && isHover) {
        if ('outline' in symbol && symbol.outline) {
          (symbol as any).outline.color = this.config.glow.color;
          (symbol as any).outline.width = ((symbol as any).outline.width || 1) + this.config.glow.size;
        }
      }

      feature.symbol = symbol;
    } catch (error) {
      console.warn('[HoverAnimationSystem] Error applying hover style:', error);
    }
  }

  /**
   * Create ripple effect at coordinates
   */
  private createRipple(x: number, y: number): void {
    const ripple: RippleEffect = {
      id: `ripple_${Date.now()}_${Math.random()}`,
      x,
      y,
      radius: 0,
      maxRadius: this.config.ripple.maxRadius,
      opacity: this.config.ripple.opacity,
      color: this.config.ripple.color,
      startTime: Date.now(),
      duration: this.config.ripple.duration,
      active: true
    };

    this.ripples.push(ripple);
  }

  /**
   * Start animation loop
   */
  private startAnimation(): void {
    if (this.animationId) return;

    const animate = (timestamp: number) => {
      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      this.updateAnimations(deltaTime);
      this.renderEffects();

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Update all animations
   */
  private updateAnimations(deltaTime: number): void {
    this.updateHoverAnimations();
    this.updateRipples();
  }

  /**
   * Update hover scale animations
   */
  private updateHoverAnimations(): void {
    const currentTime = Date.now();

    this.hoverStates.forEach((hoverState, featureId) => {
      const elapsed = currentTime - hoverState.hoverStartTime;
      const progress = Math.min(elapsed / this.config.duration, 1);
      
      // Apply easing function
      const easedProgress = this.applyEasing(progress, this.config.easing);
      
      // Calculate current scale
      const scaleDiff = hoverState.targetScale - hoverState.originalScale;
      hoverState.currentScale = hoverState.originalScale + (scaleDiff * easedProgress);
      hoverState.animationProgress = progress;
    });
  }

  /**
   * Update ripple animations
   */
  private updateRipples(): void {
    const currentTime = Date.now();

    this.ripples.forEach(ripple => {
      const elapsed = currentTime - ripple.startTime;
      const progress = elapsed / ripple.duration;

      if (progress >= 1) {
        ripple.active = false;
      } else {
        ripple.radius = ripple.maxRadius * progress;
        ripple.opacity = this.config.ripple.opacity * (1 - progress);
      }
    });

    // Remove inactive ripples
    this.ripples = this.ripples.filter(ripple => ripple.active);
  }

  /**
   * Apply easing function to animation progress
   */
  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - Math.pow(1 - t, 2);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'bounce':
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * t * t * t - c1 * t * t;
      default:
        return t;
    }
  }

  /**
   * Render all hover effects
   */
  private renderEffects(): void {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render ripple effects
    this.ripples.forEach(ripple => this.renderRipple(ripple));
    
    // Render shadow effects for hovered features
    this.renderShadows();
  }

  /**
   * Render ripple effect
   */
  private renderRipple(ripple: RippleEffect): void {
    if (!this.ctx) return;

    this.ctx.save();
    
    this.ctx.globalAlpha = ripple.opacity;
    this.ctx.strokeStyle = ripple.color;
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  /**
   * Render shadow effects for hovered features
   */
  private renderShadows(): void {
    if (!this.config.shadow.enabled || !this.ctx) return;

    this.hoverStates.forEach((hoverState, featureId) => {
      if (hoverState.isHovered && hoverState.currentScale > 1) {
        // Shadow rendering would require feature geometry
        // This is a placeholder for shadow implementation
      }
    });
  }

  /**
   * Get unique identifier for feature
   */
  private getFeatureId(feature: __esri.Graphic): string {
    return feature.attributes?.OBJECTID?.toString() || 
           feature.attributes?.id?.toString() || 
           (feature as any).uid || 
           `feature_${Date.now()}`;
  }

  /**
   * Resize canvas to match map view
   */
  private resizeCanvas(): void {
    if (!this.canvas || !this.mapView) return;

    const mapContainer = this.mapView.container as HTMLElement;
    this.canvas.width = mapContainer.clientWidth;
    this.canvas.height = mapContainer.clientHeight;
    this.canvas.style.width = mapContainer.clientWidth + 'px';
    this.canvas.style.height = mapContainer.clientHeight + 'px';
  }

  /**
   * Update feature positions when map changes
   */
  private updateFeaturePositions(): void {
    // Clear hover states that are no longer valid
    if (this.hoveredFeature) {
      // Re-validate hovered feature position
      // This would require more complex geometry tracking
    }
  }

  /**
   * Update hover effect configuration
   */
  updateConfig(newConfig: Partial<HoverEffectConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Stop animation and clean up
   */
  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.ripples = [];
    this.hoverStates.clear();
    this.hoveredFeature = null;
    this.mapView = null;
  }

  /**
   * Get current animation stats (for debugging)
   */
  getStats(): {
    activeHovers: number;
    activeRipples: number;
    isAnimating: boolean;
  } {
    return {
      activeHovers: this.hoverStates.size,
      activeRipples: this.ripples.length,
      isAnimating: this.animationId !== null
    };
  }
}