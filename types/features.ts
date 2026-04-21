export interface GeospatialFeature {
  id: string;
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: Record<string, any>;
  weight?: number;
  
  // Additional fields added during processing
  area_name?: string;        // Area name like "11368 (Corona)" or "Brooklyn" 
  cluster_id?: number;       // Cluster ID for clustered analyses (0, 1, 2, etc.)
  cluster_name?: string;     // Cluster name like "Corona Territory"
} 