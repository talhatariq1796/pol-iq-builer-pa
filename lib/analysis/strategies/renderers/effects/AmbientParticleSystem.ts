/**
 * AmbientParticleSystem - Background particle effects for enhanced map atmosphere
 * 
 * Features:
 * - Subtle floating particles across the map
 * - Interactive response to data density
 * - Performance-optimized with LOD system
 * - Atmospheric enhancement without distraction
 * - Seamless integration with map navigation
 */

export interface AmbientParticle {
  id: string;
  x: number;
  y: number;
  vx: number; // Velocity X
  vy: number; // Velocity Y
  size: number;
  opacity: number;
  color: string;
  type: 'sparkle' | 'dot' | 'star' | 'cross';
  lifespan: number;
  age: number;
  active: boolean;
  pulsePhase: number;
  driftSpeed: number;
}

export interface AmbientParticleConfig {
  enabled: boolean;
  density: number;        // Particles per 1000 pixels
  maxParticles: number;   // Performance limit
  minSize: number;
  maxSize: number;
  speed: number;          // Base drift speed
  opacity: number;        // Base opacity (0-1)
  colors: string[];       // Available colors
  types: Array<'sparkle' | 'dot' | 'star' | 'cross'>;
  lifespan: number;       // Particle lifespan in ms
  fadeDistance: number;   // Distance to fade particles
  interactiveResponse: boolean; // React to data points
}

/**
 * AmbientParticleSystem creates atmospheric background particles
 */
export class AmbientParticleSystem {
  private mapView: __esri.MapView | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  private particles: AmbientParticle[] = [];
  private config: AmbientParticleConfig;
  private lastFrameTime = 0;
  private spawnTimer = 0;
  private dataPoints: Array<{ x: number; y: number; intensity: number }> = [];
  
  // Performance tracking
  private frameCount = 0;
  private performanceMode: 'high' | 'medium' | 'low' = 'high';

  constructor(config: Partial<AmbientParticleConfig> = {}) {
    this.config = {
      enabled: true,
      density: 0.5,
      maxParticles: 150,
      minSize: 1,
      maxSize: 3,
      speed: 0.3,
      opacity: 0.4,
      colors: ['#E3F2FD', '#F3E5F5', '#E8F5E8', '#FFF3E0', '#FCE4EC'],
      types: ['dot', 'sparkle', 'star'],
      lifespan: 15000,
      fadeDistance: 50,
      interactiveResponse: true,
      ...config
    };
  }

  /**
   * Initialize ambient particle system
   */
  initialize(mapView: __esri.MapView): void {
    this.mapView = mapView;
    this.createCanvas();
    this.setupEventListeners();
    this.startAnimation();
    console.log('[AmbientParticleSystem] Initialized with config:', this.config);
  }

  /**
   * Update data points that influence particle behavior
   */
  updateDataPoints(points: Array<{ geometry: any; attributes: any }>): void {
    if (!this.mapView || !this.config.interactiveResponse) return;

    this.dataPoints = points.map(point => {
      const screenPoint = this.mapView!.toScreen(point.geometry);
      return {
        x: screenPoint?.x || 0,
        y: screenPoint?.y || 0,
        intensity: (point.attributes.value || 0) / 100 // Normalize to 0-1
      };
    });
  }

  /**
   * Create canvas for particle rendering
   */
  private createCanvas(): void {
    if (!this.mapView) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '998'; // Below other effects but above map
    this.canvas.className = 'ambient-particles-canvas';

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
   * Setup event listeners for map changes
   */
  private setupEventListeners(): void {
    if (!this.mapView) return;

    // Update canvas on resize
    this.mapView.watch('size', () => {
      this.resizeCanvas();
    });

    // Update particles on map navigation
    this.mapView.watch(['center', 'zoom'], () => {
      this.onMapNavigationChange();
    });
  }

  /**
   * Handle map navigation changes
   */
  private onMapNavigationChange(): void {
    // Adjust particle density based on zoom level
    if (this.mapView) {
      const zoom = this.mapView.zoom;
      const zoomFactor = Math.max(0.3, Math.min(1.0, zoom / 15));
      this.adjustParticleDensity(zoomFactor);
    }
  }

  /**
   * Adjust particle density based on performance and zoom
   */
  private adjustParticleDensity(factor: number): void {
    const targetCount = Math.floor(this.config.maxParticles * factor);
    
    if (this.particles.length > targetCount) {
      // Remove excess particles
      this.particles = this.particles
        .sort((a, b) => a.age - b.age) // Remove oldest first
        .slice(0, targetCount);
    }
  }

  /**
   * Start animation loop
   */
  private startAnimation(): void {
    if (this.animationId || !this.config.enabled) return;

    const animate = (timestamp: number) => {
      if (!this.config.enabled) {
        this.stopAnimation();
        return;
      }

      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      this.updatePerformanceMode();
      this.updateParticles(deltaTime);
      this.spawnParticles(deltaTime);
      this.renderParticles();

      this.frameCount++;
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
    this.clearCanvas();
  }

  /**
   * Update performance mode based on frame rate
   */
  private updatePerformanceMode(): void {
    if (this.frameCount % 60 === 0) { // Check every 60 frames
      // Simple performance detection - in production, use more sophisticated metrics
      const currentParticleCount = this.particles.filter(p => p.active).length;
      
      if (currentParticleCount > this.config.maxParticles * 0.8) {
        this.performanceMode = 'medium';
        if (currentParticleCount > this.config.maxParticles * 0.9) {
          this.performanceMode = 'low';
        }
      } else {
        this.performanceMode = 'high';
      }
    }
  }

  /**
   * Spawn new particles
   */
  private spawnParticles(deltaTime: number): void {
    if (!this.canvas) return;

    this.spawnTimer += deltaTime;
    
    const spawnRate = this.calculateSpawnRate();
    const spawnInterval = 1000 / spawnRate; // ms between spawns
    
    if (this.spawnTimer >= spawnInterval && this.particles.length < this.config.maxParticles) {
      this.createParticle();
      this.spawnTimer = 0;
    }
  }

  /**
   * Calculate particle spawn rate based on performance and configuration
   */
  private calculateSpawnRate(): number {
    const baseRate = this.config.density;
    
    // Adjust for performance mode
    const performanceMultiplier = {
      high: 1.0,
      medium: 0.7,
      low: 0.4
    }[this.performanceMode];

    // Adjust for canvas size
    const canvasArea = this.canvas ? this.canvas.width * this.canvas.height : 1000000;
    const sizeMultiplier = Math.sqrt(canvasArea / 1000000); // Normalize to 1000x1000

    return baseRate * performanceMultiplier * sizeMultiplier;
  }

  /**
   * Create new ambient particle
   */
  private createParticle(): void {
    if (!this.canvas) return;

    const particle: AmbientParticle = {
      id: `ambient_${Date.now()}_${Math.random()}`,
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      vx: (Math.random() - 0.5) * this.config.speed,
      vy: (Math.random() - 0.5) * this.config.speed,
      size: this.config.minSize + Math.random() * (this.config.maxSize - this.config.minSize),
      opacity: this.config.opacity * (0.5 + Math.random() * 0.5),
      color: this.config.colors[Math.floor(Math.random() * this.config.colors.length)],
      type: this.config.types[Math.floor(Math.random() * this.config.types.length)],
      lifespan: this.config.lifespan * (0.8 + Math.random() * 0.4),
      age: 0,
      active: true,
      pulsePhase: Math.random() * Math.PI * 2,
      driftSpeed: 0.8 + Math.random() * 0.4
    };

    // Influence particle behavior near data points
    if (this.config.interactiveResponse && this.dataPoints.length > 0) {
      this.applyDataPointInfluence(particle);
    }

    this.particles.push(particle);
  }

  /**
   * Apply data point influence to particle
   */
  private applyDataPointInfluence(particle: AmbientParticle): void {
    const nearbyDataPoints = this.dataPoints.filter(dp => {
      const distance = Math.sqrt(
        Math.pow(particle.x - dp.x, 2) + 
        Math.pow(particle.y - dp.y, 2)
      );
      return distance < 100; // Within 100 pixels
    });

    if (nearbyDataPoints.length > 0) {
      const avgIntensity = nearbyDataPoints.reduce((sum, dp) => sum + dp.intensity, 0) / nearbyDataPoints.length;
      
      // Enhance particle based on nearby data intensity
      particle.opacity *= 1 + avgIntensity * 0.5;
      particle.size *= 1 + avgIntensity * 0.3;
      
      // Add subtle drift toward high-intensity points
      const strongestPoint = nearbyDataPoints.reduce((max, dp) => dp.intensity > max.intensity ? dp : max);
      const direction = Math.atan2(strongestPoint.y - particle.y, strongestPoint.x - particle.x);
      particle.vx += Math.cos(direction) * avgIntensity * 0.1;
      particle.vy += Math.sin(direction) * avgIntensity * 0.1;
    }
  }

  /**
   * Update all particles
   */
  private updateParticles(deltaTime: number): void {
    this.particles.forEach(particle => {
      if (!particle.active) return;

      // Update age
      particle.age += deltaTime;

      // Update position
      particle.x += particle.vx * particle.driftSpeed;
      particle.y += particle.vy * particle.driftSpeed;

      // Update pulse phase
      particle.pulsePhase += 0.02;

      // Apply subtle pulse to opacity
      const pulse = (Math.sin(particle.pulsePhase) + 1) / 2;
      const baseOpacity = this.config.opacity * (0.5 + Math.random() * 0.5);

      // Fade based on age
      const ageRatio = particle.age / particle.lifespan;
      const ageFade = ageRatio < 0.2 ? ageRatio / 0.2 : // Fade in
                      ageRatio > 0.8 ? (1 - ageRatio) / 0.2 : // Fade out
                      1; // Full opacity

      particle.opacity = baseOpacity * ageFade * (0.8 + pulse * 0.2);

      // Check boundaries and wrap around
      if (this.canvas) {
        if (particle.x < -20) particle.x = this.canvas.width + 20;
        if (particle.x > this.canvas.width + 20) particle.x = -20;
        if (particle.y < -20) particle.y = this.canvas.height + 20;
        if (particle.y > this.canvas.height + 20) particle.y = -20;
      }

      // Deactivate old particles
      if (particle.age > particle.lifespan) {
        particle.active = false;
      }
    });

    // Remove inactive particles
    this.particles = this.particles.filter(p => p.active);
  }

  /**
   * Render all particles
   */
  private renderParticles(): void {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render particles with performance optimizations
    const skipRendering = this.performanceMode === 'low' && this.frameCount % 2 === 0;
    if (skipRendering) return;

    this.particles.forEach(particle => {
      if (particle.active && particle.opacity > 0.01) {
        this.renderParticle(particle);
      }
    });
  }

  /**
   * Render individual particle
   */
  private renderParticle(particle: AmbientParticle): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.globalAlpha = particle.opacity;
    this.ctx.fillStyle = particle.color;

    switch (particle.type) {
      case 'dot':
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.ctx.fill();
        break;

      case 'sparkle':
        this.renderSparkle(particle);
        break;

      case 'star':
        this.renderStar(particle);
        break;

      case 'cross':
        this.renderCross(particle);
        break;
    }

    this.ctx.restore();
  }

  /**
   * Render sparkle particle
   */
  private renderSparkle(particle: AmbientParticle): void {
    if (!this.ctx) return;

    const rays = 4;
    const innerRadius = particle.size * 0.3;
    const outerRadius = particle.size;

    this.ctx.beginPath();
    for (let i = 0; i < rays * 2; i++) {
      const angle = (i * Math.PI) / rays;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = particle.x + Math.cos(angle) * radius;
      const y = particle.y + Math.sin(angle) * radius;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Render star particle
   */
  private renderStar(particle: AmbientParticle): void {
    if (!this.ctx) return;

    const spikes = 5;
    const outerRadius = particle.size;
    const innerRadius = particle.size * 0.5;

    this.ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = particle.x + Math.cos(angle) * radius;
      const y = particle.y + Math.sin(angle) * radius;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Render cross particle
   */
  private renderCross(particle: AmbientParticle): void {
    if (!this.ctx) return;

    const size = particle.size;
    this.ctx.lineWidth = Math.max(1, size / 2);
    this.ctx.strokeStyle = particle.color;

    // Horizontal line
    this.ctx.beginPath();
    this.ctx.moveTo(particle.x - size, particle.y);
    this.ctx.lineTo(particle.x + size, particle.y);
    this.ctx.stroke();

    // Vertical line
    this.ctx.beginPath();
    this.ctx.moveTo(particle.x, particle.y - size);
    this.ctx.lineTo(particle.x, particle.y + size);
    this.ctx.stroke();
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
   * Clear canvas
   */
  private clearCanvas(): void {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AmbientParticleConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (!this.config.enabled) {
      this.stopAnimation();
    } else if (!this.animationId) {
      this.startAnimation();
    }
  }

  /**
   * Destroy ambient particle system
   */
  destroy(): void {
    this.stopAnimation();
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.dataPoints = [];
    this.mapView = null;
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    activeParticles: number;
    performanceMode: string;
    frameCount: number;
    isAnimating: boolean;
  } {
    return {
      activeParticles: this.particles.filter(p => p.active).length,
      performanceMode: this.performanceMode,
      frameCount: this.frameCount,
      isAnimating: this.animationId !== null
    };
  }
}