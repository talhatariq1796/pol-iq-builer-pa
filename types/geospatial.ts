export interface LocalGeospatialFeature {
  id?: string;
  type: 'Feature';
  properties: {
    thematic_value: number;
    [key: string]: any;
  };
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  } | null;
}

export type Extent = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  spatialReference?: {
    wkid: number;
  };
}; 