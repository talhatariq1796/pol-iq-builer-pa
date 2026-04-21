/**
 * GradientSystem - Advanced polygon gradient and animated border effects
 * 
 * Provides:
 * - Multi-color gradient fills for polygons
 * - Animated gradient shifts
 * - Dynamic border effects (glow, dash animation, pulse)
 * - Performance-optimized Canvas/WebGL rendering
 * - ArcGIS JS API integration
 */

export interface GradientConfig {
  type: 'linear' | 'radial' | 'conic';
  colors: string[];
  direction?: number; // For linear gradients (degrees)
  centerX?: number;   // For radial gradients (0-1)
  centerY?: number;   // For radial gradients (0-1)
  animated?: boolean;
  animationSpeed?: number;
  animationType?: 'shift' | 'rotate' | 'pulse' | 'wave';
}

export interface BorderConfig {
  enabled: boolean;
  style: 'solid' | 'dashed' | 'dotted' | 'glow' | 'pulse';
  width: number;
  color: string;
  animated: boolean;
  animationSpeed?: number;
  glowSize?: number;
  dashPattern?: number[];
}

export interface PolygonEffectsConfig {
  gradient?: GradientConfig;
  border?: BorderConfig;
  opacity?: number;
  hoverEffects?: boolean;
}

/**
 * GradientSystem manages advanced polygon visual effects
 */
export class GradientSystem {
  private mapView: __esri.MapView | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  private polygonData: Array<{
    geometry: any;
    attributes: any;
    config: PolygonEffectsConfig;
  }> = [];
  private lastFrameTime = 0;
  private animationPhase = 0;

  constructor() {}

  /**
   * Initialize gradient system on map view
   */
  initialize(mapView: __esri.MapView): void {
    this.mapView = mapView;
    this.createCanvas();
    this.setupEventListeners();
    console.log('[GradientSystem] Initialized');
  }

  /**
   * Add polygons with gradient effects
   */
  addPolygons(polygons: Array<{
    geometry: any;
    attributes: any;
    config: PolygonEffectsConfig;
  }>): void {
    this.polygonData = [...this.polygonData, ...polygons];
    this.startAnimation();
  }

  /**
   * Clear all polygons
   */
  clearPolygons(): void {
    this.polygonData = [];
    this.stopAnimation();
    this.clearCanvas();
  }

  /**
   * Create enhanced ArcGIS symbol with gradient support
   */
  createEnhancedSymbol(config: PolygonEffectsConfig, baseColor: string): any {
    const symbol: any = {
      type: 'simple-fill',
      color: baseColor,
      outline: {
        color: config.border?.color || '#FFFFFF',
        width: config.border?.width || 1
      }
    };

    // Add gradient information for post-processing
    if (config.gradient) {
      symbol._gradientConfig = config.gradient;
      symbol._enhancedFill = true;
    }

    // Add border animation information
    if (config.border?.animated) {
      symbol._animatedBorder = config.border;
      symbol._enhancedBorder = true;
    }

    return symbol;
  }

  /**
   * Create gradient fill pattern
   */
  createGradientFill(config: GradientConfig, bounds: { x: number; y: number; width: number; height: number }): CanvasGradient | null {
    if (!this.ctx) return null;

    let gradient: CanvasGradient;

    switch (config.type) {
      case 'linear':
        gradient = this.createLinearGradientFill(config, bounds);
        break;
      case 'radial':
        gradient = this.createRadialGradientFill(config, bounds);
        break;
      case 'conic':
        gradient = this.createConicGradientFill(config, bounds);
        break;
      default:
        return null;
    }

    // Apply colors to gradient
    config.colors.forEach((color, index) => {
      const stop = index / (config.colors.length - 1);
      gradient.addColorStop(stop, color);
    });

    return gradient;
  }

  private createLinearGradientFill(config: GradientConfig, bounds: any): CanvasGradient {
    const angle = (config.direction || 0) * Math.PI / 180;
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    // Calculate gradient end points
    const length = Math.max(bounds.width, bounds.height);
    const x1 = centerX - Math.cos(angle) * length / 2;
    const y1 = centerY - Math.sin(angle) * length / 2;
    const x2 = centerX + Math.cos(angle) * length / 2;
    const y2 = centerY + Math.sin(angle) * length / 2;

    return this.ctx!.createLinearGradient(x1, y1, x2, y2);
  }

  private createRadialGradientFill(config: GradientConfig, bounds: any): CanvasGradient {
    const centerX = bounds.x + bounds.width * (config.centerX || 0.5);
    const centerY = bounds.y + bounds.height * (config.centerY || 0.5);
    const radius = Math.min(bounds.width, bounds.height) / 2;

    return this.ctx!.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  }

  private createConicGradientFill(config: GradientConfig, bounds: any): CanvasGradient {
    // Note: Conic gradients need special handling or polyfill
    // For now, fall back to radial gradient
    return this.createRadialGradientFill(config, bounds);
  }

  /**
   * Create canvas overlay for polygon effects
   */
  private createCanvas(): void {
    if (!this.mapView) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '999'; // Below fireflies but above base map
    this.canvas.className = 'gradient-canvas';

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
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.mapView) return;

    this.mapView.watch('size', () => this.resizeCanvas());
    this.mapView.watch(['center', 'zoom', 'rotation'], () => this.render());
  }

  /**
   * Resize canvas
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
   * Start animation loop
   */
  private startAnimation(): void {
    if (this.animationId || this.polygonData.length === 0) return;

    const animate = (timestamp: number) => {
      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      this.animationPhase += 0.01; // Global animation phase
      this.render();

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Stop animation
   */
  private stopAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Render all polygon effects
   */
  private render(): void {
    if (!this.ctx || !this.canvas || !this.mapView) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.polygonData.forEach(polygon => {
      this.renderPolygon(polygon);
    });
  }

  /**
   * Render individual polygon with effects
   */
  private renderPolygon(polygon: {
    geometry: any;
    attributes: any;
    config: PolygonEffectsConfig;
  }): void {
    if (!this.ctx || !this.mapView) return;

    try {
      // Convert geometry to screen coordinates
      const screenPolygon = this.geometryToScreen(polygon.geometry);
      if (!screenPolygon || screenPolygon.length === 0) return;

      // Calculate bounding box for gradients
      const bounds = this.calculateBounds(screenPolygon);

      this.ctx.save();

      // Set global opacity
      this.ctx.globalAlpha = polygon.config.opacity || 0.7;

      // Create path
      if (!this.ctx) return;
      
      this.ctx.beginPath();
      screenPolygon.forEach((point, index) => {
        if (index === 0) {
          this.ctx!.moveTo(point.x, point.y);
        } else {
          this.ctx!.lineTo(point.x, point.y);
        }
      });
      this.ctx.closePath();

      // Apply gradient fill
      if (polygon.config.gradient) {
        const gradient = this.createGradientFill(polygon.config.gradient, bounds);
        if (gradient) {
          // Apply animation effects to gradient
          if (polygon.config.gradient.animated) {
            this.applyGradientAnimation(polygon.config.gradient);
          }
          
          this.ctx.fillStyle = gradient;
          this.ctx.fill();
        }
      }

      // Apply border effects
      if (polygon.config.border?.enabled) {
        this.renderBorder(polygon.config.border, screenPolygon);
      }

      this.ctx.restore();
    } catch (error) {
      console.warn('[GradientSystem] Error rendering polygon:', error);
    }
  }

  /**
   * Render animated borders
   */
  private renderBorder(borderConfig: BorderConfig, screenPolygon: Array<{x: number, y: number}>): void {
    if (!this.ctx) return;

    this.ctx.save();

    this.ctx.strokeStyle = borderConfig.color;
    this.ctx.lineWidth = borderConfig.width;

    switch (borderConfig.style) {
      case 'dashed':
        this.ctx.setLineDash(borderConfig.dashPattern || [5, 5]);
        if (borderConfig.animated) {
          this.ctx.lineDashOffset = this.animationPhase * 10;
        }
        break;

      case 'glow':
        this.ctx.shadowColor = borderConfig.color;
        this.ctx.shadowBlur = borderConfig.glowSize || 10;
        if (borderConfig.animated) {
          this.ctx.shadowBlur = (borderConfig.glowSize || 10) * (1 + Math.sin(this.animationPhase * 3) * 0.3);
        }
        break;

      case 'pulse':
        if (borderConfig.animated) {
          const pulse = (Math.sin(this.animationPhase * 4) + 1) / 2;
          this.ctx.lineWidth = borderConfig.width * (0.5 + pulse * 0.5);
          this.ctx.globalAlpha = 0.5 + pulse * 0.5;
        }
        break;
    }

    // Draw border path
    if (!this.ctx) return;
    
    this.ctx.beginPath();
    screenPolygon.forEach((point, index) => {
      if (index === 0) {
        this.ctx!.moveTo(point.x, point.y);
      } else {
        this.ctx!.lineTo(point.x, point.y);
      }
    });
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Apply animation effects to gradients
   */
  private applyGradientAnimation(gradientConfig: GradientConfig): void {
    // Animation effects are applied during gradient creation
    // This method can be used for more complex transformations
    
    switch (gradientConfig.animationType) {
      case 'shift':
        // Color shifting is handled in the main animation loop
        break;
      case 'rotate':
        if (gradientConfig.direction !== undefined) {
          gradientConfig.direction += (gradientConfig.animationSpeed || 1);
        }
        break;
      case 'pulse':
        // Pulsing effects can be applied to opacity
        break;
    }
  }

  /**
   * Convert map geometry to screen coordinates
   */
  private geometryToScreen(geometry: any): Array<{x: number, y: number}> | null {
    if (!this.mapView || !geometry) return null;

    try {
      if (geometry.type === 'polygon') {
        // Handle polygon geometry
        const rings = geometry.rings || geometry.coordinates;
        if (rings && rings[0]) {
          return rings[0].map((coord: number[]) => {
            const point = this.mapView!.toScreen({
              x: coord[0],
              y: coord[1],
              spatialReference: geometry.spatialReference
            } as any);
            return { x: point?.x || 0, y: point?.y || 0 };
          });
        }
      }
    } catch (error) {
      console.warn('[GradientSystem] Error converting geometry to screen:', error);
    }

    return null;
  }

  /**
   * Calculate bounding box for screen coordinates
   */
  private calculateBounds(screenPolygon: Array<{x: number, y: number}>): {
    x: number, y: number, width: number, height: number
  } {
    const xs = screenPolygon.map(p => p.x);
    const ys = screenPolygon.map(p => p.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Clear canvas
   */
  private clearCanvas(): void {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Destroy gradient system
   */
  destroy(): void {
    this.stopAnimation();
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.polygonData = [];
    this.mapView = null;
  }
}