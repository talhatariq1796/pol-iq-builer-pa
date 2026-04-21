import { PopupTemplateConfig } from "../../types/layers";

// src/config/layers/types.ts
export interface LayerField {
    name: string;
    label: string;
    type: 'string' | 'number' | 'date';
    format?: string;
  }
  
  // export type GeographicLevel = 
  //   | 'Federal Electoral District' 
  //   | 'Census Subdivision' 
  //   | 'Forward Sortation Area'
  //   | 'Province' // Added Province just in case
  //   | 'Canada'; // Added Canada just in case

  export interface BaseLayerConfig {
    id: string;
    title: string;
    description: string;
    url: string;
    // geographicLevel?: GeographicLevel;
    linkField?: string;
    opacity?: number;
    popupTemplate?: PopupTemplateConfig;
    fields: LayerField[];
  }
  
  export interface IndexLayerConfig extends BaseLayerConfig {
    type: 'index';
    indexField: string;
    additionalFields?: LayerField[];
  }
  
  export interface PointLayerConfig extends BaseLayerConfig {
    type: 'point';
    symbolConfig: {
      color: number[];
      size?: number;
      outline?: {
        color: number[];
        width: number;
      };
    };
    fields: LayerField[];
  }
  
  // export type LayerConfig = IndexLayerConfig | PointLayerConfig;
  
  export interface LayerGroup {
    id: string;
    title: string;
    description?: string;
    // layers: LayerConfig[];
  }
  
  export interface ProjectLayerConfig {
    groups: LayerGroup[];
    defaultVisibility?: { [key: string]: boolean };
    defaultCollapsed?: { [key: string]: boolean };
  }