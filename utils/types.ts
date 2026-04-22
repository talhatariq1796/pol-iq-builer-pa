/**
 * Renderer utility types for createQuartileRenderer
 */
import type ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

export type ColorStop = [number, number, number];

export interface RendererConfig {
  layer: FeatureLayer;
  field: string;
  colorStops?: ColorStop[];
  isCurrency?: boolean;
  isCompositeIndex?: boolean;
  opacity?: number;
  customBreaks?: number[];
  filterField?: string;
  filterThreshold?: number;
}

export interface RendererResult {
  renderer: ClassBreaksRenderer;
  breaks: number[];
  statistics: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
}
