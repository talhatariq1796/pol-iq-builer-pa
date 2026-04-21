/**
 * FireflyEffect - Animated particle system for high-value data points
 * 
 * Creates magical firefly-like particles that:
 * - Orbit around important data points
 * - Pulse with golden glow effects
 * - Scale intensity based on data values
 * - Optimize performance with LOD system
 */

export interface FireflyParticle {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  orbitRadius: number;
  speed: number;
  size: number;
  opacity: number;
  color: string;
  pulsePhase: number;
  active: boolean;
}

export interface FireflyEffectConfig {
  enabled: boolean;
  intensity: number; // 0-1 scale
  color: string;
  particleSize: number;
  glowRadius: number;
  orbitSpeed: number;
  pulseSpeed: number;
  maxParticles: number;
  triggerThreshold: number;
  fadeDistance: number; // Distance at which effect fades
}

/**
 * FireflyEffect manages animated particles around high-value points
 */
export class FireflyEffect {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: FireflyParticle[] = [];
  private animationId: number | null = null;
  private mapView: __esri.MapView | null = null;
  private config: FireflyEffectConfig;
  private lastFrameTime = 0;
  private targetPoints: Array<{ x: number; y: number; value: number; screenX: number; screenY: number }> = [];

  constructor(config: Partial<FireflyEffectConfig> = {}) {
    this.config = {
      enabled: true,
      intensity: 0.7,
      color: '#FFD700',
      particleSize: 3,
      glowRadius: 6,
      orbitSpeed: 0.02,
      pulseSpeed: 0.05,
      maxParticles: 50,
      triggerThreshold: 75,
      fadeDistance: 100,
      ...config
    };
  }

  /**
   * Initialize firefly effect on map view
   */
  initialize(mapView: __esri.MapView): void {
    this.mapView = mapView;
    this.createCanvas();
    this.setupEventListeners();
    console.log('[FireflyEffect] Initialized with config:', this.config);
  }

  /**
   * Update target points that should have firefly effects
   */
  updateTargetPoints(points: Array<{ geometry: any; attributes: any }>): void {
    if (!this.mapView || !this.config.enabled) return;

    this.targetPoints = points
      .filter(point => point.attributes.value >= this.config.triggerThreshold)
      .map(point => {
        // Convert map coordinates to screen coordinates
        const screenPoint = this.mapView!.toScreen(point.geometry);
        return {
          x: point.geometry.x,
          y: point.geometry.y,
          value: point.attributes.value,
          screenX: screenPoint?.x || 0,
          screenY: screenPoint?.y || 0
        };
      });

    this.updateParticles();
    
    if (this.targetPoints.length > 0 && !this.animationId) {
      this.startAnimation();
    } else if (this.targetPoints.length === 0 && this.animationId) {
      this.stopAnimation();
    }
  }

  /**
   * Start firefly animation loop
   */
  private startAnimation(): void {
    if (this.animationId) return;

    const animate = (timestamp: number) => {
      if (!this.config.enabled) {
        this.stopAnimation();
        return;
      }

      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      this.updateParticlePositions(deltaTime);
      this.renderParticles();

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Stop firefly animation
   */
  private stopAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.clearCanvas();
  }

  /**
   * Create canvas overlay for particle rendering
   */
  private createCanvas(): void {
    if (!this.mapView) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1000';
    this.canvas.className = 'firefly-canvas';

    // Size canvas to match map view
    const mapContainer = this.mapView.container as HTMLElement;
    this.canvas.width = mapContainer.clientWidth;
    this.canvas.height = mapContainer.clientHeight;
    this.canvas.style.width = mapContainer.clientWidth + 'px';
    this.canvas.style.height = mapContainer.clientHeight + 'px';

    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      // Enable anti-aliasing for smooth particles
      this.ctx.imageSmoothingEnabled = true;
    }

    mapContainer.appendChild(this.canvas);
  }

  /**
   * Setup event listeners for map interactions
   */
  private setupEventListeners(): void {
    if (!this.mapView) return;

    // Update canvas size on map resize
    this.mapView.watch('size', () => {
      this.resizeCanvas();
    });

    // Update particle positions on map navigation
    this.mapView.watch(['center', 'zoom', 'rotation'], () => {
      this.updateParticleScreenPositions();
    });
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
   * Update screen positions of particles when map moves
   */
  private updateParticleScreenPositions(): void {
    if (!this.mapView) return;

    // Update target point screen coordinates
    this.targetPoints.forEach(target => {
      const point = { x: target.x, y: target.y, spatialReference: this.mapView!.spatialReference };
      const screenPoint = this.mapView!.toScreen(point as any);
      target.screenX = screenPoint?.x || 0;
      target.screenY = screenPoint?.y || 0;
    });

    // Update particle target positions
    this.particles.forEach(particle => {
      const target = this.targetPoints.find(t => particle.id.includes(t.value.toString()));
      if (target) {
        particle.targetX = target.screenX;
        particle.targetY = target.screenY;
      }
    });
  }

  /**
   * Create and update particles for target points
   */
  private updateParticles(): void {
    // Remove particles for targets that no longer exist
    this.particles = this.particles.filter(particle => 
      this.targetPoints.some(target => particle.id.includes(target.value.toString()))
    );

    // Create new particles for new targets
    this.targetPoints.forEach(target => {
      const particleCount = Math.ceil(this.config.intensity * 8); // Max 8 particles per point
      const existingParticles = this.particles.filter(p => p.id.includes(target.value.toString()));
      
      if (existingParticles.length < particleCount) {
        const needed = particleCount - existingParticles.length;
        for (let i = 0; i < needed; i++) {
          this.particles.push(this.createParticle(target, existingParticles.length + i));
        }
      }
    });

    // Limit total particles for performance
    if (this.particles.length > this.config.maxParticles) {
      this.particles = this.particles.slice(0, this.config.maxParticles);
    }
  }

  /**
   * Create a new firefly particle
   */
  private createParticle(target: { screenX: number; screenY: number; value: number }, index: number): FireflyParticle {
    const orbitRadius = 15 + Math.random() * 25; // Orbit radius 15-40px
    const angle = (index / 8) * Math.PI * 2 + Math.random() * Math.PI; // Distribute around circle
    
    return {
      id: `firefly_${target.value}_${index}_${Date.now()}`,
      x: target.screenX + Math.cos(angle) * orbitRadius,
      y: target.screenY + Math.sin(angle) * orbitRadius,
      targetX: target.screenX,
      targetY: target.screenY,
      angle: angle,
      orbitRadius: orbitRadius,
      speed: this.config.orbitSpeed * (0.8 + Math.random() * 0.4), // Vary speed slightly
      size: this.config.particleSize * (0.7 + Math.random() * 0.6), // Vary size
      opacity: 0,
      color: this.config.color,
      pulsePhase: Math.random() * Math.PI * 2,
      active: true
    };
  }

  /**
   * Update particle positions and properties
   */
  private updateParticlePositions(deltaTime: number): void {
    this.particles.forEach(particle => {
      if (!particle.active) return;

      // Update orbit angle
      particle.angle += particle.speed;

      // Update position in orbit around target
      particle.x = particle.targetX + Math.cos(particle.angle) * particle.orbitRadius;
      particle.y = particle.targetY + Math.sin(particle.angle) * particle.orbitRadius;

      // Update pulse phase for glow effect
      particle.pulsePhase += this.config.pulseSpeed;

      // Calculate opacity based on pulse
      const pulse = (Math.sin(particle.pulsePhase) + 1) / 2; // 0-1 range
      particle.opacity = 0.3 + pulse * 0.7; // 0.3-1.0 range

      // Fade out particles that are off-screen
      const canvas = this.canvas;
      if (canvas) {
        const margin = this.config.fadeDistance;
        const fadeOut = particle.x < -margin || particle.x > canvas.width + margin ||
                       particle.y < -margin || particle.y > canvas.height + margin;
        
        if (fadeOut) {
          particle.opacity *= 0.95; // Gradual fade
          if (particle.opacity < 0.1) {
            particle.active = false;
          }
        }
      }
    });

    // Remove inactive particles
    this.particles = this.particles.filter(p => p.active);
  }

  /**
   * Render all particles to canvas
   */
  private renderParticles(): void {
    if (!this.ctx || !this.canvas) return;

    // Clear previous frame
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render each particle
    this.particles.forEach(particle => {
      this.renderParticle(particle);
    });
  }

  /**
   * Render individual particle with glow effect
   */
  private renderParticle(particle: FireflyParticle): void {
    if (!this.ctx) return;

    this.ctx.save();

    // Set global alpha for fade effects
    this.ctx.globalAlpha = particle.opacity;

    // Create radial gradient for glow effect
    const gradient = this.ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, this.config.glowRadius
    );
    
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(0.5, particle.color + '80'); // 50% transparency
    gradient.addColorStop(1, particle.color + '00');   // Fully transparent

    // Draw glow
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, this.config.glowRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw core particle
    this.ctx.fillStyle = particle.color;
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
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
  updateConfig(newConfig: Partial<FireflyEffectConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (!this.config.enabled) {
      this.stopAnimation();
    } else if (this.targetPoints.length > 0) {
      this.startAnimation();
    }
  }

  /**
   * Destroy effect and clean up resources
   */
  destroy(): void {
    this.stopAnimation();
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.targetPoints = [];
    this.mapView = null;
  }

  /**
   * Get current particle count (for debugging/monitoring)
   */
  getParticleCount(): number {
    return this.particles.filter(p => p.active).length;
  }
}