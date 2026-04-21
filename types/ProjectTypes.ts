// types/ProjectTypes.ts
import type { Point } from '@arcgis/core/geometry';

export type LayerVisibilityState = Record<string, 'visible' | 'hidden'>;

export interface MapState {
  center: number[];
  zoom: number;
  rotation: number;
}

export interface GraphicState {
  geometry: __esri.Geometry;
  symbol: __esri.Symbol;
  attributes?: Record<string, any>;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  map_state: MapState;
  graphics?: GraphicState[];
  layer_state: LayerVisibilityState;
}

export interface CreateProjectPayload {
  name: string;
  map_state: MapState;
  layer_state: LayerVisibilityState;
  graphics: GraphicState[];
  user_id: string;
}