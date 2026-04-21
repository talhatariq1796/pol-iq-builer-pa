// Layer configuration with preserved structure
// Auto-generated on 2025-08-24T13:11:08.482988
// This file maintains compatibility with existing system components

// Housing Market Analysis Layers (2025)
import { LayerConfig } from '../types/layers';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { layers as housingLayersRaw } from './layers_housing_2025';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const housingLayers = housingLayersRaw as any as { [key: string]: LayerConfig };

export type LayerType = 'index' | 'point' | 'percentage' | 'amount';
export type AccessLevel = 'read' | 'write' | 'admin';

export const concepts = {
  population: {
    terms: [
      'population',
      'people',
      'residents',
      'inhabitants',
      'demographics',
      'age',
      'gender',
      'household',
      'family',
      'diversity',
      'cultural groups'
    ],
    weight: 10,
  },
  income: {
    terms: [
      'income',
      'earnings',
      'salary',
      'wage',
      'affluence',
      'wealth',
      'disposable'
    ],
    weight: 25,
  },
  race: {
    terms: [
      'race',
      'ethnicity',
      'diverse',
      'diversity',
      'racial',
      'white',
      'black',
      'asian',
      'american indian',
      'pacific islander',
      'hispanic'
    ],
    weight: 20,
  },
  spending: {
    terms: [
      'spending',
      'purchase',
      'bought',
      'shopped',
      'consumer',
      'expense',
      'shopping'
    ],
    weight: 25,
  },
  sports: {
    terms: [
      'sports',
      'athletic',
      'exercise',
      'fan',
      'participation',
      'NBA',
      'NFL',
      'MLB',
      'NHL',
      'soccer',
      'running',
      'jogging',
      'yoga',
      'weight lifting'
    ],
    weight: 20,
  },
  brands: {
    terms: [
      'brand',
      'Nike',
      'Adidas',
      'Jordan',
      'Converse',
      'Reebok',
      'Puma',
      'New Balance',
      'Asics',
      'Skechers',
      'Alo',
      'Lululemon',
      'On'
    ],
    weight: 25,
  },
  retail: {
    terms: [
      'retail',
      'store',
      'shop',
      'Dick\'s Sporting Goods',
      'retail store'
    ],
    weight: 15,
  },
  clothing: {
    terms: [
      'clothing',
      'apparel',
      'wear',
      'workout wear',
      'athletic wear',
      'shoes',
      'footwear',
      'sneakers'
    ],
    weight: 20,
  },
  household: {
    terms: [
      'household',
      'family',
      'home',
      'housing',
      'residence'
    ],
    weight: 15,
  },
  trends: {
    terms: [
      'trends',
      'google',
      'search',
      'interest',
      'popularity',
      'search volume',
      'search data',
      'search analytics',
      'trending',
      'search patterns',
      'consumer interest',
      'market attention',
      'brand awareness',
      'search interest',
      'online demand',
      'consumer demand',
      'brand popularity',
      'search frequency',
      'search trends',
      'search queries',
      'google search',
      'search index'
    ],
    weight: 20,
  },
  geographic: {
    terms: [
      'ZIP',
      'DMA',
      'local',
      'regional',
      'area',
      'location',
      'zone',
      'region'
    ],
    weight: 15,
  },
};

// Helper function to ensure each layer has a DESCRIPTION field
const ensureLayerHasDescriptionField = (layerConfig: LayerConfig): LayerConfig => {
  // Clone the layer config
  const updatedConfig = { ...layerConfig };
  
  // Check if fields array exists
  if (!updatedConfig.fields) {
    updatedConfig.fields = [];
  }
  
  // Check if DESCRIPTION field already exists
  const hasDescription = updatedConfig.fields.some(field => field.name === 'DESCRIPTION');
  
  // If DESCRIPTION field doesn't exist, add it
  if (!hasDescription) {
    updatedConfig.fields.push({
      name: 'DESCRIPTION',
      type: 'string',
      alias: 'ZIP Code',
      label: 'ZIP Code'
    });
  }
  
  return updatedConfig;
};

// Helper function to update renderer field to use percentage field when available
const updateRendererFieldForPercentage = (layerConfig: LayerConfig): LayerConfig => {
  const updatedConfig = { ...layerConfig };
  
  // Check if this layer has percentage fields
  const percentageField = updatedConfig.fields?.find(field => 
    field.name.endsWith('_P') && field.type === 'double'
  );
  
  // If a percentage field exists, use it as the renderer field
  if (percentageField) {
    updatedConfig.rendererField = percentageField.name;
  }
  
  return updatedConfig;
};

// === AUTO-GENERATED LAYER CONFIGURATIONS ===
export const baseLayerConfigs: LayerConfig[] = [
  {
    id: 'Unknown_Service_layer_0',
    name: '2030 Diversity Index',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/0',
    group: 'general',
    description: 'Business Analyst Layer: 2030 Diversity Index',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'DIVINDX_FY',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "DIVINDX_FY",
            "type": "double",
            "alias": "2030 Diversity Index (Esri)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_1',
    name: '2025 Make Sure I Exercise Regularly 4-Agr C',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/1',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Make Sure I Exercise Regularly 4-Agr C',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP28646A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP28646A_B",
            "type": "double",
            "alias": "2025 Make Sure I Exercise Regularly: 4-Agree Completely"
      },
      {
            "name": "MP28646A_B_P",
            "type": "double",
            "alias": "2025 Make Sure I Exercise Regularly: 4-Agree Completely (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_2',
    name: '2025 Seek Info on Nutrition Healthy Diet 4-',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/2',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Seek Info on Nutrition Healthy Diet 4-',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP28591A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP28591A_B",
            "type": "double",
            "alias": "2025 Actively Seek Info on Nutrition/Healthy Diet: 4-Agree Completely"
      },
      {
            "name": "MP28591A_B_P",
            "type": "double",
            "alias": "2025 Actively Seek Info on Nutrition/Healthy Diet: 4-Agree Completely (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_3',
    name: '2025 Buy Foods Specifically Labeled Sugar-F',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/3',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Buy Foods Specifically Labeled Sugar-F',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP14029A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP14029A_B",
            "type": "double",
            "alias": "2025 Buy Foods Specifically Labeled as Sugar-Free"
      },
      {
            "name": "MP14029A_B_P",
            "type": "double",
            "alias": "2025 Buy Foods Specifically Labeled as Sugar-Free (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_4',
    name: '2025 Shopped at Trader Joe`s Grocery Store',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/4',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Shopped at Trader Joe`s Grocery Store',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP13019A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP13019A_B",
            "type": "double",
            "alias": "2025 Shopped at Trader Joe`s Grocery Store Last 6 Mo"
      },
      {
            "name": "MP13019A_B_P",
            "type": "double",
            "alias": "2025 Shopped at Trader Joe`s Grocery Store Last 6 Mo (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_5',
    name: '2025 Shopped at Costco Warehouse Club Store',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/5',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Shopped at Costco Warehouse Club Store',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP13026A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP13026A_B",
            "type": "double",
            "alias": "2025 Shopped at Costco Warehouse or Club Store Last 6 Mo"
      },
      {
            "name": "MP13026A_B_P",
            "type": "double",
            "alias": "2025 Shopped at Costco Warehouse or Club Store Last 6 Mo (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_6',
    name: '2025 Shopped at Target Grocery Store 6 Mo',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/6',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Shopped at Target Grocery Store 6 Mo',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP13029A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP13029A_B",
            "type": "double",
            "alias": "2025 Shopped at Target Grocery Store Last 6 Mo"
      },
      {
            "name": "MP13029A_B_P",
            "type": "double",
            "alias": "2025 Shopped at Target Grocery Store Last 6 Mo (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_7',
    name: '2025 Shopped at Whole Foods Market Grocery',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/7',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Shopped at Whole Foods Market Grocery',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP13023A_B_P',
    status: 'active',
    geographicType: 'dma',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP13023A_B",
            "type": "double",
            "alias": "2025 Shopped at Whole Foods Market Grocery Store Last 6 Mo"
      },
      {
            "name": "MP13023A_B_P",
            "type": "double",
            "alias": "2025 Shopped at Whole Foods Market Grocery Store Last 6 Mo (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "dma",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_8',
    name: '2025 Drank Red Bull',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/8',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Drank Red Bull',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP12207A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP12207A_B",
            "type": "double",
            "alias": "2025 Drank Red Bull Energy Drink Last 6 Mo"
      },
      {
            "name": "MP12207A_B_P",
            "type": "double",
            "alias": "2025 Drank Red Bull Energy Drink Last 6 Mo (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_9',
    name: '2025 Drank 5-Hour',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/9',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Drank 5-Hour',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP12205A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP12205A_B",
            "type": "double",
            "alias": "2025 Drank 5-Hour Energy Drink Last 6 Mo"
      },
      {
            "name": "MP12205A_B_P",
            "type": "double",
            "alias": "2025 Drank 5-Hour Energy Drink Last 6 Mo (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_10',
    name: '2025 Drank Monster',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/10',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Drank Monster',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP12206A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP12206A_B",
            "type": "double",
            "alias": "2025 Drank Monster Energy Drink Last 6 Mo"
      },
      {
            "name": "MP12206A_B_P",
            "type": "double",
            "alias": "2025 Drank Monster Energy Drink Last 6 Mo (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_11',
    name: '2025 Drank Energy Drink',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/11',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Drank Energy Drink',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP12097A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP12097A_B",
            "type": "double",
            "alias": "2025 Drank Energy Drink Last 6 Mo"
      },
      {
            "name": "MP12097A_B_P",
            "type": "double",
            "alias": "2025 Drank Energy Drink Last 6 Mo (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_12',
    name: '2024 Drank Energy Drink 6 Mo ( )',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/12',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Drank Energy Drink 6 Mo ( )',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP12097A_B_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP12097A_B",
            "type": "double",
            "alias": "2024 Drank Energy Drink Last 6 Mo"
      },
      {
            "name": "MP12097A_B_P",
            "type": "double",
            "alias": "2024 Drank Energy Drink Last 6 Mo (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_13',
    name: '2024 Drank Monster Energy Drink 6 Mo (Index',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/13',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Drank Monster Energy Drink 6 Mo (Index',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP12206A_B',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP12206A_B",
            "type": "double",
            "alias": "2024 Drank Monster Energy Drink Last 6 Mo"
      },
      {
            "name": "MP12206A_B_I",
            "type": "double",
            "alias": "2024 Drank Monster Energy Drink Last 6 Mo (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_14',
    name: '2024 Drank 5-Hour Energy Drink 6 Mo (Index)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/14',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Drank 5-Hour Energy Drink 6 Mo (Index)',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP12205A_B',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP12205A_B",
            "type": "double",
            "alias": "2024 Drank 5-Hour Energy Drink Last 6 Mo"
      },
      {
            "name": "MP12205A_B_I",
            "type": "double",
            "alias": "2024 Drank 5-Hour Energy Drink Last 6 Mo (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_15',
    name: '2024 Drank Red Bull Energy Drink 6 Mo (Index)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/15',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Drank Red Bull Energy Drink 6 Mo (Index)',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP12207A_B',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP12207A_B",
            "type": "double",
            "alias": "2024 Drank Red Bull Energy Drink Last 6 Mo"
      },
      {
            "name": "MP12207A_B_I",
            "type": "double",
            "alias": "2024 Drank Red Bull Energy Drink Last 6 Mo (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_16',
    name: '2024 Shopped at Trader Joe`s Grocery Store',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/16',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Shopped at Trader Joe`s Grocery Store',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP13019A_B',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP13019A_B",
            "type": "double",
            "alias": "2024 Shopped at Trader Joe`s Grocery Store Last 6 Mo"
      },
      {
            "name": "MP13019A_B_I",
            "type": "double",
            "alias": "2024 Shopped at Trader Joe`s Grocery Store Last 6 Mo (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_17',
    name: '2024 Shopped at Target Grocery Store 6 Mo',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/17',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Shopped at Target Grocery Store 6 Mo',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP13029A_B',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP13029A_B",
            "type": "double",
            "alias": "2024 Shopped at Target Grocery Store Last 6 Mo"
      },
      {
            "name": "MP13029A_B_I",
            "type": "double",
            "alias": "2024 Shopped at Target Grocery Store Last 6 Mo (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_18',
    name: '2024 Shopped at Whole Foods Market Grocery',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/18',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Shopped at Whole Foods Market Grocery',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP13023A_B',
    status: 'active',
    geographicType: 'dma',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP13023A_B",
            "type": "double",
            "alias": "2024 Shopped at Whole Foods Market Grocery Store Last 6 Mo"
      },
      {
            "name": "MP13023A_B_I",
            "type": "double",
            "alias": "2024 Shopped at Whole Foods Market Grocery Store Last 6 Mo (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "dma",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_19',
    name: '2024 Shopped at Costco Warehouse Club Store',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/19',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Shopped at Costco Warehouse Club Store',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP13026A_B',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP13026A_B",
            "type": "double",
            "alias": "2024 Shopped at Costco Warehouse or Club Store Last 6 Mo"
      },
      {
            "name": "MP13026A_B_I",
            "type": "double",
            "alias": "2024 Shopped at Costco Warehouse or Club Store Last 6 Mo (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_20',
    name: '2024 Buy Foods Specifically Labeled Sugar-Free',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/20',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Buy Foods Specifically Labeled Sugar-Free',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP14029A_B',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP14029A_B",
            "type": "double",
            "alias": "2024 Buy Foods Specifically Labeled as Sugar-Free"
      },
      {
            "name": "MP14029A_B_I",
            "type": "double",
            "alias": "2024 Buy Foods Specifically Labeled as Sugar-Free (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_21',
    name: '2024 Seek Info on Nutrition Healthy Diet',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/21',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Seek Info on Nutrition Healthy Diet',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP28591A_B',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP28591A_B",
            "type": "double",
            "alias": "2024 Actively Seek Info on Nutrition/Healthy Diet: 4-Agree Completely"
      },
      {
            "name": "MP28591A_B_I",
            "type": "double",
            "alias": "2024 Actively Seek Info on Nutrition/Healthy Diet: 4-Agree Completely (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_22',
    name: '2024 Make Sure I Exercise Regularly 4-Agr',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/22',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Make Sure I Exercise Regularly 4-Agr',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MP28646A_B',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MP28646A_B",
            "type": "double",
            "alias": "2024 Make Sure I Exercise Regularly: 4-Agree Completely"
      },
      {
            "name": "MP28646A_B_I",
            "type": "double",
            "alias": "2024 Make Sure I Exercise Regularly: 4-Agree Completely (Index)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_23',
    name: '2024 Diversity Index',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/23',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Diversity Index',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'DIVINDX_CY',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "DIVINDX_CY",
            "type": "double",
            "alias": "2024 Diversity Index (Esri)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_24',
    name: '2024 Total Population',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/24',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Total Population',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'TOTPOP_CY',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "TOTPOP_CY",
            "type": "double",
            "alias": "2024 Total Population (Esri)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_25',
    name: '2024 Median Age',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/25',
    group: 'general',
    description: 'Business Analyst Layer: 2024 Median Age',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MEDAGE_CY',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MEDAGE_CY",
            "type": "double",
            "alias": "2024 Median Age (Esri)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "Internal"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_26',
    name: '2025 Generation Z Pop',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/26',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Generation Z Pop',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'GENZ_CY_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "GENZ_CY",
            "type": "double",
            "alias": "2025 Generation Z Population (Born 1999 to 2016) (Esri)"
      },
      {
            "name": "GENZ_CY_P",
            "type": "double",
            "alias": "2025 Generation Z Population (Born 1999 to 2016) (Esri) (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_27',
    name: '2025 Generation Alpha Pop ( )',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/27',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Generation Alpha Pop ( )',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'GENALPHACY_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "GENALPHACY",
            "type": "double",
            "alias": "2025 Generation Alpha Population (Born 2017 or Later) (Esri)"
      },
      {
            "name": "GENALPHACY_P",
            "type": "double",
            "alias": "2025 Generation Alpha Population (Born 2017 or Later) (Esri) (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_28',
    name: '2030 Generation Alpha Pop',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/28',
    group: 'general',
    description: 'Business Analyst Layer: 2030 Generation Alpha Pop',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'GENALPHAFY_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "GENALPHAFY",
            "type": "double",
            "alias": "2030 Generation Alpha Population (Born 2017 or Later) (Esri)"
      },
      {
            "name": "GENALPHAFY_P",
            "type": "double",
            "alias": "2030 Generation Alpha Population (Born 2017 or Later) (Esri) (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_29',
    name: '2030 Generation Z Pop',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/29',
    group: 'general',
    description: 'Business Analyst Layer: 2030 Generation Z Pop',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'GENZ_FY_P',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "GENZ_FY",
            "type": "double",
            "alias": "2030 Generation Z Population (Born 1999 to 2016) (Esri)"
      },
      {
            "name": "GENZ_FY_P",
            "type": "double",
            "alias": "2030 Generation Z Population (Born 1999 to 2016) (Esri) (%)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_30',
    name: '2030 Median Age',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/30',
    group: 'general',
    description: 'Business Analyst Layer: 2030 Median Age',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MEDAGE_FY',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MEDAGE_FY",
            "type": "double",
            "alias": "2030 Median Age (Esri)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_31',
    name: '2025 Median Household Income',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/31',
    group: 'general',
    description: 'Business Analyst Layer: 2025 Median Household Income',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'MEDHINC_CY',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MEDHINC_CY",
            "type": "double",
            "alias": "2025 Median Household Income (Esri)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_32',
    name: '2030 Median Household Income',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/32',
    group: 'general',
    description: 'Business Analyst Layer: 2030 Median Household Income',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'MEDHINC_FY',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "MEDHINC_FY",
            "type": "double",
            "alias": "2030 Median Household Income (Esri)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_33',
    name: '2030 Total Population',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/33',
    group: 'general',
    description: 'Business Analyst Layer: 2030 Total Population',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'TOTPOP_FY',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "TOTPOP_FY",
            "type": "double",
            "alias": "2030 Total Population (Esri)"
      },
      {
            "name": "thematic_value",
            "type": "double",
            "alias": "thematic_value"
      },
      {
            "name": "Shape__Area",
            "type": "double",
            "alias": "Shape__Area"
      },
      {
            "name": "Shape__Length",
            "type": "double",
            "alias": "Shape__Length"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_34',
    name: 'target',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/34',
    group: 'general',
    description: 'Business Analyst Layer: target',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ESRI_PID',
    symbolConfig: {
      color: [198, 2, 2, 0.8],
      size: 12,
      outline: {
        color: [255, 255, 255, 1],
        width: 1
      },
      shape: 'square'
    },
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "CONAME",
            "type": "string",
            "alias": "Company/Business Name"
      },
      {
            "name": "ADDR",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "CITY",
            "type": "string",
            "alias": "City"
      },
      {
            "name": "STATE_NAME",
            "type": "string",
            "alias": "State Name"
      },
      {
            "name": "STATE",
            "type": "string",
            "alias": "State Abbreviation"
      },
      {
            "name": "ZIP",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ZIP4",
            "type": "string",
            "alias": "ZIP+4 Extension"
      },
      {
            "name": "NAICS",
            "type": "string",
            "alias": "Primary NAICS"
      },
      {
            "name": "NAICS_ALL",
            "type": "string",
            "alias": "All NAICS Codes"
      },
      {
            "name": "SIC",
            "type": "string",
            "alias": "Primary SIC"
      },
      {
            "name": "SIC_ALL",
            "type": "string",
            "alias": "All SIC Codes"
      },
      {
            "name": "INDUSTRY_DESC",
            "type": "string",
            "alias": "Industry Description"
      },
      {
            "name": "AFFILIATE",
            "type": "string",
            "alias": "Affiliated Orgs"
      },
      {
            "name": "BRAND",
            "type": "string",
            "alias": "Brands"
      },
      {
            "name": "HQNAME",
            "type": "string",
            "alias": "Headquarters Name"
      },
      {
            "name": "LOC_CONF",
            "type": "string",
            "alias": "Location Confidence"
      },
      {
            "name": "PLACETYPE",
            "type": "string",
            "alias": "Business Category"
      },
      {
            "name": "SQFOOTAGE",
            "type": "string",
            "alias": "Square Footage"
      },
      {
            "name": "MIN_SQFT",
            "type": "integer",
            "alias": "Square Foot Minimum"
      },
      {
            "name": "MAX_SQFT",
            "type": "integer",
            "alias": "Square Foot Maximum"
      },
      {
            "name": "EMPNUM",
            "type": "integer",
            "alias": "Employee Count"
      },
      {
            "name": "SALESVOL",
            "type": "double",
            "alias": "Sales Volume"
      },
      {
            "name": "SOURCE",
            "type": "string",
            "alias": "Source"
      },
      {
            "name": "ESRI_PID",
            "type": "string",
            "alias": "Esri PID"
      },
      {
            "name": "DESC_",
            "type": "string",
            "alias": "Description"
      },
      {
            "name": "LATITUDE",
            "type": "double",
            "alias": "Latitude"
      },
      {
            "name": "LONGITUDE",
            "type": "double",
            "alias": "Longitude"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_35',
    name: 'whole foods',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/35',
    group: 'general',
    description: 'Business Analyst Layer: whole foods',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ESRI_PID',
    symbolConfig: {
      color: [3, 107, 68, 0.8],
      size: 12,
      outline: {
        color: [255, 255, 255, 1],
        width: 1
      },
      shape: 'square'
    },
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "CONAME",
            "type": "string",
            "alias": "Company/Business Name"
      },
      {
            "name": "ADDR",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "CITY",
            "type": "string",
            "alias": "City"
      },
      {
            "name": "STATE_NAME",
            "type": "string",
            "alias": "State Name"
      },
      {
            "name": "STATE",
            "type": "string",
            "alias": "State Abbreviation"
      },
      {
            "name": "ZIP",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ZIP4",
            "type": "string",
            "alias": "ZIP+4 Extension"
      },
      {
            "name": "NAICS",
            "type": "string",
            "alias": "Primary NAICS"
      },
      {
            "name": "NAICS_ALL",
            "type": "string",
            "alias": "All NAICS Codes"
      },
      {
            "name": "SIC",
            "type": "string",
            "alias": "Primary SIC"
      },
      {
            "name": "SIC_ALL",
            "type": "string",
            "alias": "All SIC Codes"
      },
      {
            "name": "INDUSTRY_DESC",
            "type": "string",
            "alias": "Industry Description"
      },
      {
            "name": "AFFILIATE",
            "type": "string",
            "alias": "Affiliated Orgs"
      },
      {
            "name": "BRAND",
            "type": "string",
            "alias": "Brands"
      },
      {
            "name": "HQNAME",
            "type": "string",
            "alias": "Headquarters Name"
      },
      {
            "name": "LOC_CONF",
            "type": "string",
            "alias": "Location Confidence"
      },
      {
            "name": "PLACETYPE",
            "type": "string",
            "alias": "Business Category"
      },
      {
            "name": "SQFOOTAGE",
            "type": "string",
            "alias": "Square Footage"
      },
      {
            "name": "MIN_SQFT",
            "type": "integer",
            "alias": "Square Foot Minimum"
      },
      {
            "name": "MAX_SQFT",
            "type": "integer",
            "alias": "Square Foot Maximum"
      },
      {
            "name": "EMPNUM",
            "type": "integer",
            "alias": "Employee Count"
      },
      {
            "name": "SALESVOL",
            "type": "double",
            "alias": "Sales Volume"
      },
      {
            "name": "SOURCE",
            "type": "string",
            "alias": "Source"
      },
      {
            "name": "ESRI_PID",
            "type": "string",
            "alias": "Esri PID"
      },
      {
            "name": "DESC_",
            "type": "string",
            "alias": "Description"
      },
      {
            "name": "LATITUDE",
            "type": "double",
            "alias": "Latitude"
      },
      {
            "name": "LONGITUDE",
            "type": "double",
            "alias": "Longitude"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_36',
    name: 'trader joes',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/36',
    group: 'general',
    description: 'Business Analyst Layer: trader joes',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ESRI_PID',
    symbolConfig: {
      color: [247, 117, 0, 0.8],
      size: 12,
      outline: {
        color: [255, 255, 255, 1],
        width: 1
      },
      shape: 'square'
    },
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "CONAME",
            "type": "string",
            "alias": "Company/Business Name"
      },
      {
            "name": "ADDR",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "CITY",
            "type": "string",
            "alias": "City"
      },
      {
            "name": "STATE_NAME",
            "type": "string",
            "alias": "State Name"
      },
      {
            "name": "STATE",
            "type": "string",
            "alias": "State Abbreviation"
      },
      {
            "name": "ZIP",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ZIP4",
            "type": "string",
            "alias": "ZIP+4 Extension"
      },
      {
            "name": "NAICS",
            "type": "string",
            "alias": "Primary NAICS"
      },
      {
            "name": "NAICS_ALL",
            "type": "string",
            "alias": "All NAICS Codes"
      },
      {
            "name": "SIC",
            "type": "string",
            "alias": "Primary SIC"
      },
      {
            "name": "SIC_ALL",
            "type": "string",
            "alias": "All SIC Codes"
      },
      {
            "name": "INDUSTRY_DESC",
            "type": "string",
            "alias": "Industry Description"
      },
      {
            "name": "AFFILIATE",
            "type": "string",
            "alias": "Affiliated Orgs"
      },
      {
            "name": "BRAND",
            "type": "string",
            "alias": "Brands"
      },
      {
            "name": "HQNAME",
            "type": "string",
            "alias": "Headquarters Name"
      },
      {
            "name": "LOC_CONF",
            "type": "string",
            "alias": "Location Confidence"
      },
      {
            "name": "PLACETYPE",
            "type": "string",
            "alias": "Business Category"
      },
      {
            "name": "SQFOOTAGE",
            "type": "string",
            "alias": "Square Footage"
      },
      {
            "name": "MIN_SQFT",
            "type": "integer",
            "alias": "Square Foot Minimum"
      },
      {
            "name": "MAX_SQFT",
            "type": "integer",
            "alias": "Square Foot Maximum"
      },
      {
            "name": "EMPNUM",
            "type": "integer",
            "alias": "Employee Count"
      },
      {
            "name": "SALESVOL",
            "type": "double",
            "alias": "Sales Volume"
      },
      {
            "name": "SOURCE",
            "type": "string",
            "alias": "Source"
      },
      {
            "name": "ESRI_PID",
            "type": "string",
            "alias": "Esri PID"
      },
      {
            "name": "DESC_",
            "type": "string",
            "alias": "Description"
      },
      {
            "name": "LATITUDE",
            "type": "double",
            "alias": "Latitude"
      },
      {
            "name": "LONGITUDE",
            "type": "double",
            "alias": "Longitude"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  },
  {
    id: 'Unknown_Service_layer_37',
    name: 'costco',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__09db2071715949f6/FeatureServer/37',
    group: 'general',
    description: 'Business Analyst Layer: costco',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ESRI_PID',
    symbolConfig: {
      color: [23, 92, 166, 0.8],
      size: 12,
      outline: {
        color: [255, 255, 255, 1],
        width: 1
      },
      shape: 'square'
    },
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "CONAME",
            "type": "string",
            "alias": "Company/Business Name"
      },
      {
            "name": "ADDR",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "CITY",
            "type": "string",
            "alias": "City"
      },
      {
            "name": "STATE_NAME",
            "type": "string",
            "alias": "State Name"
      },
      {
            "name": "STATE",
            "type": "string",
            "alias": "State Abbreviation"
      },
      {
            "name": "ZIP",
            "type": "string",
            "alias": "ZIP Code"
      },
      {
            "name": "ZIP4",
            "type": "string",
            "alias": "ZIP+4 Extension"
      },
      {
            "name": "NAICS",
            "type": "string",
            "alias": "Primary NAICS"
      },
      {
            "name": "NAICS_ALL",
            "type": "string",
            "alias": "All NAICS Codes"
      },
      {
            "name": "SIC",
            "type": "string",
            "alias": "Primary SIC"
      },
      {
            "name": "SIC_ALL",
            "type": "string",
            "alias": "All SIC Codes"
      },
      {
            "name": "INDUSTRY_DESC",
            "type": "string",
            "alias": "Industry Description"
      },
      {
            "name": "AFFILIATE",
            "type": "string",
            "alias": "Affiliated Orgs"
      },
      {
            "name": "BRAND",
            "type": "string",
            "alias": "Brands"
      },
      {
            "name": "HQNAME",
            "type": "string",
            "alias": "Headquarters Name"
      },
      {
            "name": "LOC_CONF",
            "type": "string",
            "alias": "Location Confidence"
      },
      {
            "name": "PLACETYPE",
            "type": "string",
            "alias": "Business Category"
      },
      {
            "name": "SQFOOTAGE",
            "type": "string",
            "alias": "Square Footage"
      },
      {
            "name": "MIN_SQFT",
            "type": "integer",
            "alias": "Square Foot Minimum"
      },
      {
            "name": "MAX_SQFT",
            "type": "integer",
            "alias": "Square Foot Maximum"
      },
      {
            "name": "EMPNUM",
            "type": "integer",
            "alias": "Employee Count"
      },
      {
            "name": "SALESVOL",
            "type": "double",
            "alias": "Sales Volume"
      },
      {
            "name": "SOURCE",
            "type": "string",
            "alias": "Source"
      },
      {
            "name": "ESRI_PID",
            "type": "string",
            "alias": "Esri PID"
      },
      {
            "name": "DESC_",
            "type": "string",
            "alias": "Description"
      },
      {
            "name": "LATITUDE",
            "type": "double",
            "alias": "Latitude"
      },
      {
            "name": "LONGITUDE",
            "type": "double",
            "alias": "Longitude"
      },
      {
            "name": "CreationDate",
            "type": "date",
            "alias": "CreationDate"
      },
      {
            "name": "Creator",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EditDate",
            "type": "date",
            "alias": "EditDate"
      },
      {
            "name": "Editor",
            "type": "string",
            "alias": "Editor"
      },
    ],
    metadata: {
      "provider": "ArcGIS FeatureServer",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["business-analyst", "demographics"],
      "sourceSystems": ["ArcGIS Online"],
      "geographicType": "postal",
      "geographicLevel": "local"
    },
    processing: {
      "cacheable": true,
      "timeout": 30000,
      "retries": 2
    },
    caching: {
      "enabled": true,
      "ttl": 3600,
      "strategy": "memory"
    },
    performance: {
      "timeoutMs": 30000
    },
    security: {
      "accessLevels": [
            "read"
      ]
    },
    analysis: {
      "availableOperations": [
            "query"
      ]
    }
  }
];

// Apply helper functions to all configurations
export const layerConfigs: LayerConfig[] = baseLayerConfigs
  .map(ensureLayerHasDescriptionField)
  .map(updateRendererFieldForPercentage);

// Group layers by category for easier management
export const layerGroups = {
  'group_energy_drinks': {
    displayName: 'Energy Drinks',
    description: 'Energy drink consumption and brand preferences',
    layerCount: 4,
    confidence: 1.00,
    layers: [
      'Unknown_Service_layer_8',  // Red Bull
      'Unknown_Service_layer_9',  // 5-Hour Energy
      'Unknown_Service_layer_10', // Monster Energy  
      'Unknown_Service_layer_11'  // All Energy Drinks
    ]
  },
  'group_consumer_behavior': {
    displayName: 'Consumer Behavior',
    description: 'Food and beverage consumption patterns',
    layerCount: 18,
    confidence: 1.00,
    layers: [
      'Unknown_Service_layer_1',
      'Unknown_Service_layer_2',
      'Unknown_Service_layer_3',
      'Unknown_Service_layer_4',
      'Unknown_Service_layer_5',
      'Unknown_Service_layer_6',
      'Unknown_Service_layer_7',
      'Unknown_Service_layer_12',
      'Unknown_Service_layer_13',
      'Unknown_Service_layer_14',
      'Unknown_Service_layer_15',
      'Unknown_Service_layer_16',
      'Unknown_Service_layer_17',
      'Unknown_Service_layer_18',
      'Unknown_Service_layer_19',
      'Unknown_Service_layer_20',
      'Unknown_Service_layer_21',
      'Unknown_Service_layer_22'
    ]
  },
  'group_demographics': {
    displayName: 'Demographics',
    description: 'Population and demographic characteristics',
    layerCount: 8,
    confidence: 1.00,
    layers: [
      'Unknown_Service_layer_23', // Generation data
      'Unknown_Service_layer_24',
      'Unknown_Service_layer_25', 
      'Unknown_Service_layer_31',
      'Unknown_Service_layer_0',  // Population data
      'Unknown_Service_layer_30',
      'Unknown_Service_layer_32',
      'Unknown_Service_layer_33'
    ]
  },
  'group_market_metrics': {
    displayName: 'Market Metrics',
    description: 'Market size and performance indicators',
    layerCount: 4,
    confidence: 0.95,
    layers: [
      'Unknown_Service_layer_26',
      'Unknown_Service_layer_27',
      'Unknown_Service_layer_28',
      'Unknown_Service_layer_29'
    ]
  },
  'group_geographic_data': {
    displayName: 'Geographic Data',
    description: 'ZIP code and location-based information',
    layerCount: 4,
    confidence: 1.00,
    layers: [
      'Unknown_Service_layer_34',
      'Unknown_Service_layer_35',
      'Unknown_Service_layer_36',
      'Unknown_Service_layer_37'
    ]
  },

};

// Import blob URLs for property layers
import blobUrlsRaw from '../public/data/blob-urls.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const blobUrls = blobUrlsRaw as any;

/* eslint-disable @typescript-eslint/no-explicit-any */
// Property Layers (Real Estate QC 2025)
const propertyLayers: { [key: string]: LayerConfig } = {
  'active_house_properties': {
    id: 'active_house_properties',
    name: 'Active Houses',
    type: 'geojson' as any,
    url: blobUrls.property_single_family_active,
    group: 'properties',
    description: 'Active single-family house listings',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active' as any,
    geographicType: 'postal' as any,
    geographicLevel: 'local' as any,
    fields: [] as any,
  } as any,
  'sold_house_properties': {
    id: 'sold_house_properties',
    name: 'Sold Houses',
    type: 'geojson' as any,
    url: blobUrls.property_single_family_sold,
    group: 'properties',
    description: 'Sold single-family house listings',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active' as any,
    geographicType: 'postal' as any,
    geographicLevel: 'local' as any,
    fields: [] as any,
  } as any,
  'active_condo_properties': {
    id: 'active_condo_properties',
    name: 'Active Condos',
    type: 'geojson' as any,
    url: blobUrls.property_condos_active,
    group: 'properties',
    description: 'Active condominium listings',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active' as any,
    geographicType: 'postal' as any,
    geographicLevel: 'local' as any,
    fields: [] as any,
  } as any,
  'sold_condo_properties': {
    id: 'sold_condo_properties',
    name: 'Sold Condos',
    type: 'geojson' as any,
    url: blobUrls.property_condos_sold,
    group: 'properties',
    description: 'Sold condominium listings',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active' as any,
    geographicType: 'postal' as any,
    geographicLevel: 'local' as any,
    fields: [] as any,
  } as any,
  'active_revenue_properties': {
    id: 'active_revenue_properties',
    name: 'Active Revenue Properties',
    type: 'geojson' as any,
    url: blobUrls.property_revenue_active,
    group: 'properties',
    description: 'Active revenue/investment property listings',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'revenue_score',
    status: 'active' as any,
    geographicType: 'postal' as any,
    geographicLevel: 'local' as any,
    fields: [] as any,
  } as any,
  'sold_revenue_properties': {
    id: 'sold_revenue_properties',
    name: 'Sold Revenue Properties',
    type: 'geojson' as any,
    url: blobUrls.property_revenue_sold,
    group: 'properties',
    description: 'Sold revenue/investment property listings',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'revenue_score',
    status: 'active' as any,
    geographicType: 'postal' as any,
    geographicLevel: 'local' as any,
    fields: [] as any,
  } as any,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// Merge property layers with housing layers
export const layers: { [key: string]: LayerConfig } = {
  ...housingLayers,
  ...propertyLayers,
};

// Export layer count for monitoring
export const layerCount = layerConfigs.length;

// Export generation metadata
export const generationMetadata = {
  generatedAt: '2025-08-24T13:11:08.482988',
  layerCount: 38,
  groupCount: 5,
  automationVersion: '1.0.0',
  lastGroupUpdate: '2025-08-24T22:00:00.000Z',
  projectDomain: 'Red Bull Energy Drinks'
};

// Utility function to get layer configuration by ID
export function getLayerConfigById(layerId: string): LayerConfig | undefined {
  return layers[layerId];
}

// Spatial reference layer ID (using a layer that exists in the housing layers configuration)
export const SPATIAL_REFERENCE_LAYER_ID = (() => {
  // First, try to find a layer that exists in the actual imported housing layers
  const housingLayerIds = Object.keys(housingLayers);
  
  // Look for a suitable feature-service layer for spatial queries
  const suitableLayer = housingLayerIds.find(id => {
    const layer = housingLayers[id];
    return layer && layer.type === 'feature-service' && layer.url;
  });
  
  if (suitableLayer) {
    return suitableLayer;
  }
  
  // Fallback: use first available layer
  return housingLayerIds[0];
})();
