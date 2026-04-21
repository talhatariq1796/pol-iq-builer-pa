export namespace __esri {
    interface MapView {
      map: Map;
      popup: any;
      ui: any;
      when(): Promise<void>;
      destroy(): void;
      goTo(target: any, options?: any): Promise<void>;
    }
  
    interface Map {
      basemap: string;
      layers: Collection<Layer>;
      add(layer: Layer): void;
      remove(layer: Layer): void;
      findLayerById(id: string): Layer | null;
    }
  
    interface Layer {
      id: string;
      title: string;
      type: string;
      visible: boolean;
    }
  
    interface GraphicsLayer extends Layer {
      graphics: Collection<Graphic>;
      add(graphic: Graphic): void;
      addMany(graphics: Graphic[]): void;
      removeAll(): void;
    }
  
    interface Graphic {
      geometry: Geometry;
      symbol?: any;
      attributes?: any;
    }
  
    interface Geometry {
      type: string;
      spatialReference: SpatialReference;
    }
  
    interface Point extends Geometry {
      x: number;
      y: number;
    }
  
    interface Polygon extends Geometry {
      rings: number[][][];
    }
  
    interface SpatialReference {
      wkid: number;
    }
  
    interface Home {
      view: MapView;
      go(): Promise<void>;
    }
  
    interface LayerList {
      view: MapView;
      visible: boolean;
    }
  
    interface Bookmarks {
      view: MapView;
      visible: boolean;
    }
  
    interface Print {
      view: MapView;
      visible: boolean;
    }
  
    interface Collection<T> {
      length: number;
      add(item: T): void;
      forEach(callback: (item: T) => void): void;
      toArray(): T[];
      on(event: string, callback: () => void): Handle;
      removeAll(): void;
    }
  
    interface Handle {
      remove(): void;
    }
  
    interface Extent {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
      spatialReference?: SpatialReference;
    }
  }

export interface MapViewHit {
  type: string;
  mapPoint?: any;
  graphic?: {
    attributes?: {
      clusterId?: string;
    };
  };
}

export interface ViewClickEvent {
  mapPoint?: any;
}

export interface HitTestResult {
  results: MapViewHit[];
}