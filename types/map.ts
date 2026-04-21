import { __esri } from './esri';

export interface MapView extends __esri.MapView {
  id: string;
  name: string;
  extent: __esri.Extent;
  rotation: number;
  zoom: number;
  map: __esri.Map;
  popup: {
    visible: boolean;
  };
  watch(property: string, callback: () => void): __esri.Handle;
  removeAll(): void;
  syncConfig?: {
    enabled: boolean;
    syncExtent: boolean;
    syncRotation: boolean;
    syncZoom: boolean;
    syncLayers: boolean;
    syncTime: boolean;
    syncSelection: boolean;
    syncPopups: boolean;
  };
} 