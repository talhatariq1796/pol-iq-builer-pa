export type ColorStop = [number, number, number] | [number, number, number, number];

export interface RendererConfig {
  layer: __esri.FeatureLayer;
  field: string;
  colorStops?: ColorStop[];
  isCurrency?: boolean;
  isCompositeIndex?: boolean;
  opacity?: number;
  customBreaks?: number[];
  filterField?: string;
  filterThreshold?: number;
  outlineWidth?: number;
  outlineColor?: number[];
}

export type RendererResult = {
  renderer: __esri.ClassBreaksRenderer;
  breaks: number[];
  statistics: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
} | null;
