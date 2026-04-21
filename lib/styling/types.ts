import { EffectsManagerConfig } from '../analysis/strategies/renderers/effects/EffectsManager';
import { FireflyEffectConfig } from '../analysis/strategies/renderers/effects/FireflyEffect';
import { PolygonEffectsConfig } from '../analysis/strategies/renderers/effects/GradientSystem';
import { HoverEffectConfig } from '../analysis/strategies/renderers/effects/HoverAnimationSystem';
import { AmbientParticleConfig } from '../analysis/strategies/renderers/effects/AmbientParticleSystem';

// Global configuration for the entire styling system
export interface GlobalStylingConfig {
  effects: EffectsManagerConfig;
  performance: PerformanceConfig;
  themes: ThemeConfig;
  defaults: DefaultStylingConfig;
}

// Performance configuration
export interface PerformanceConfig {
  adaptive: boolean;
  monitoring: boolean;
  thresholds: PerformanceThresholds;
  optimization: OptimizationConfig;
}

export interface PerformanceThresholds {
  maxFrameTime: number; // milliseconds (16.67 for 60fps)
  maxMemoryUsage: number; // bytes
  maxParticleCount: number;
  maxGradientComplexity: number;
}

export interface OptimizationConfig {
  autoOptimize: boolean;
  reduceParticles: boolean;
  simplifyGradients: boolean;
  disableComplexAnimations: boolean;
}

// Theme configuration
export interface ThemeConfig {
  default: string;
  available: string[];
  custom?: Record<string, CustomTheme>;
}

export interface CustomTheme {
  name: string;
  colors: ColorPalette;
  effects: EffectPreset;
  animations: AnimationPreset;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface EffectPreset {
  firefly: Partial<FireflyEffectConfig>;
  gradient: Partial<PolygonEffectsConfig>;
  hover: Partial<HoverEffectConfig>;
  ambient: Partial<AmbientParticleConfig>;
}

export interface AnimationPreset {
  entry: EntryAnimationConfig;
  continuous: ContinuousAnimationConfig;
  interaction: InteractionAnimationConfig;
}

// Default styling configuration
export interface DefaultStylingConfig {
  point: BaseStyleConfig;
  polygon: BaseStyleConfig;
  line: BaseStyleConfig;
}

// Layer-specific styling configuration
export interface LayerStylingConfig {
  // Base styling
  baseStyle: BaseStyleConfig;
  
  // Effects
  fireflyEffects?: FireflyEffectConfig;
  gradientEffects?: PolygonEffectsConfig;
  hoverEffects?: HoverEffectConfig;
  ambientEffects?: AmbientParticleConfig;
  
  // Visual effects
  visualEffects?: VisualEffectConfig;
  
  // Animation
  animations?: AnimationConfig;
  
  // Performance
  performance?: LayerPerformanceConfig;
}

// Base style configuration
export interface BaseStyleConfig {
  color: string | ColorConfig;
  size?: number;
  opacity?: number;
  outline?: OutlineConfig;
  fill?: FillConfig;
}

export interface ColorConfig {
  type: 'solid' | 'gradient' | 'data-driven';
  value: string | string[];
  field?: string;
  scale?: 'linear' | 'log' | 'quantile';
  domain?: [number, number];
  range?: string[];
}

export interface OutlineConfig {
  color: string;
  width: number;
  style?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
}

export interface FillConfig {
  type: 'solid' | 'gradient' | 'pattern';
  color?: string;
  gradient?: GradientConfig;
  pattern?: PatternConfig;
}

export interface GradientConfig {
  type: 'linear' | 'radial' | 'conic';
  colors: string[];
  stops?: number[];
  direction?: number;
  centerX?: number;
  centerY?: number;
}

export interface PatternConfig {
  type: 'dots' | 'lines' | 'crosshatch' | 'custom';
  color: string;
  size: number;
  spacing: number;
}

// Visual effects configuration
export interface VisualEffectConfig {
  bloom?: BloomConfig;
  glow?: GlowConfig;
  shadow?: ShadowConfig;
  blur?: BlurConfig;
}

export interface BloomConfig {
  enabled: boolean;
  intensity: number;
  radius: number;
  threshold: number;
}

export interface GlowConfig {
  enabled: boolean;
  color: string;
  size: number;
  intensity: number;
  blur: number;
}

export interface ShadowConfig {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface BlurConfig {
  enabled: boolean;
  radius: number;
  quality: 'low' | 'medium' | 'high';
}

// Animation configuration
export interface AnimationConfig {
  entry?: EntryAnimationConfig;
  continuous?: ContinuousAnimationConfig;
  interaction?: InteractionAnimationConfig;
}

export interface EntryAnimationConfig {
  type: 'fade-in' | 'scale-up' | 'slide-in' | 'bounce' | 'rotate-in';
  duration: number;
  delay?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
}

export interface ContinuousAnimationConfig {
  pulse?: PulseConfig;
  rotation?: RotationConfig;
  wave?: WaveConfig;
  glow?: GlowAnimationConfig;
}

export interface PulseConfig {
  enabled: boolean;
  duration: number;
  scale: number;
  easing?: string;
}

export interface RotationConfig {
  enabled: boolean;
  speed: number; // degrees per second
  direction: 'clockwise' | 'counterclockwise';
}

export interface WaveConfig {
  enabled: boolean;
  duration: number;
  amplitude: number;
  frequency: number;
}

export interface GlowAnimationConfig {
  enabled: boolean;
  duration: number;
  intensity: number;
  color: string;
}

export interface InteractionAnimationConfig {
  hover?: HoverAnimationConfig;
  click?: ClickAnimationConfig;
  selection?: SelectionAnimationConfig;
}

export interface HoverAnimationConfig {
  enabled: boolean;
  scale: number;
  duration: number;
  easing?: string;
}

export interface ClickAnimationConfig {
  enabled: boolean;
  ripple: boolean;
  scale: number;
  duration: number;
}

export interface SelectionAnimationConfig {
  enabled: boolean;
  highlight: boolean;
  glow: boolean;
  duration: number;
}

// Layer performance configuration
export interface LayerPerformanceConfig {
  maxParticles?: number;
  maxGradientStops?: number;
  animationQuality?: 'low' | 'medium' | 'high';
  enableOptimizations?: boolean;
}

// Performance metrics
export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  totalTime?: number;
  frameCount: number;
  memoryUsage: number;
  renderTime: number;
  averageFrameTime?: number;
}

// Optimization recommendations
export interface OptimizationRecommendation {
  optimize: boolean;
  reason: string;
  recommendations?: string[];
}

// Optimization strategies
export interface OptimizationStrategy {
  name: string;
  description: string;
  apply: (config: LayerStylingConfig) => LayerStylingConfig;
  priority: number;
}

// Styling animation for transitions
export interface StylingAnimation {
  from: LayerStylingConfig;
  to: LayerStylingConfig;
  duration: number;
  easing?: string;
  execute: (layer: __esri.FeatureLayer) => Promise<void>;
}

// Timeline animation for complex sequences
export interface TimelineAnimation {
  id: string;
  duration: number;
  getEvents: () => AnimationEvent[];
}

export interface AnimationEvent {
  time: number;
  type: string;
  execute: () => void;
  data?: any;
}

// Effect composition
export interface Effect {
  id: string;
  name: string;
  apply: (layer: __esri.FeatureLayer, config: LayerStylingConfig) => Promise<void>;
  cleanup?: () => void;
}

// Styled layer interface
export interface StyledLayer {
  id: string;
  layer: __esri.FeatureLayer;
  config: LayerStylingConfig;
  effects: Map<string, any>;
  updateStyling: (config: Partial<LayerStylingConfig>) => Promise<void>;
  animateTransition: (targetConfig: LayerStylingConfig, duration: number) => Promise<void>;
  getStylingConfig: () => LayerStylingConfig;
}

// Analysis result styling
export interface AnalysisResult {
  type: string;
  confidence: number;
  significance: number;
  data: any;
  metadata?: Record<string, any>;
}

// Analysis-specific styling configuration
export interface AnalysisStylingConfig {
  type: string;
  baseConfig: LayerStylingConfig;
  enhancements: Partial<LayerStylingConfig>;
  conditions: StylingCondition[];
}

export interface StylingCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between';
  value: number | string | [number, number];
  styling: Partial<LayerStylingConfig>;
} 