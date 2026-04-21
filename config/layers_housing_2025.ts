// Layer configuration with preserved structure
// Auto-generated on 2025-09-02T08:05:48.310476
// This file maintains compatibility with existing system components

import { LayerConfig } from '../types/layers';
import blobUrls from '../public/data/blob-urls.json';

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
export const baseLayerConfigs: any[] = [
  {
    id: 'active_house_properties',
    name: 'Active Houses',
    type: 'geojson',
    url: blobUrls.property_single_family_active,
    group: 'properties',
    description: 'Active single-family house listings from Centris MLS data with ML scores',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "id",
            "type": "integer",
            "alias": "Property ID"
      },
      {
            "name": "mls_number",
            "type": "integer",
            "alias": "MLS Number"
      },
      {
            "name": "address",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "municipality",
            "type": "string",
            "alias": "Municipality"
      },
      {
            "name": "postal_code",
            "type": "string",
            "alias": "Postal Code"
      },
      {
            "name": "fsa_code",
            "type": "string",
            "alias": "FSA Code"
      },
      {
            "name": "bedrooms",
            "type": "integer",
            "alias": "Bedrooms"
      },
      {
            "name": "bathrooms",
            "type": "double",
            "alias": "Bathrooms"
      },
      {
            "name": "askedsold_price",
            "type": "double",
            "alias": "Asked Price"
      }
    ]
  },
  {
    id: 'sold_house_properties',
    name: 'Sold Houses',
    type: 'geojson',
    url: blobUrls.property_single_family_sold,
    group: 'properties',
    description: 'Sold Houses from Centris MLS data with ML scores',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    definitionExpression: "property_category = 'house' AND sold_rented_price != ''",
    fields: [
      {
            "name": "id",
            "type": "integer",
            "alias": "Property ID"
      },
      {
            "name": "mls_number",
            "type": "integer",
            "alias": "MLS Number"
      },
      {
            "name": "address",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "municipality",
            "type": "string",
            "alias": "Municipality"
      },
      {
            "name": "postal_code",
            "type": "string",
            "alias": "Postal Code"
      },
      {
            "name": "fsa_code",
            "type": "string",
            "alias": "FSA Code"
      },
      {
            "name": "bedrooms",
            "type": "integer",
            "alias": "Bedrooms"
      },
      {
            "name": "bathrooms",
            "type": "double",
            "alias": "Bathrooms"
      },
      {
            "name": "sold_rented_price",
            "type": "double",
            "alias": "Sold Price"
      }
    ]
  },
  {
    id: 'active_condo_properties',
    name: 'Active Condos',
    type: 'geojson',
    url: blobUrls.property_condos_active,
    group: 'properties',
    description: 'Active Condos from Centris MLS data with ML scores',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    definitionExpression: "property_category = 'condo' AND sold_rented_price = ''",
    fields: [
      {
            "name": "id",
            "type": "integer",
            "alias": "Property ID"
      },
      {
            "name": "mls_number",
            "type": "integer",
            "alias": "MLS Number"
      },
      {
            "name": "address",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "municipality",
            "type": "string",
            "alias": "Municipality"
      },
      {
            "name": "postal_code",
            "type": "string",
            "alias": "Postal Code"
      },
      {
            "name": "fsa_code",
            "type": "string",
            "alias": "FSA Code"
      },
      {
            "name": "bedrooms",
            "type": "integer",
            "alias": "Bedrooms"
      },
      {
            "name": "bathrooms",
            "type": "double",
            "alias": "Bathrooms"
      },
      {
            "name": "askedsold_price",
            "type": "double",
            "alias": "Asked Price"
      }
    ]
  },
  {
    id: 'sold_condo_properties',
    name: 'Sold Condos',
    type: 'geojson',
    url: blobUrls.property_condos_sold,
    group: 'properties',
    description: 'Sold Condos from Centris MLS data with ML scores',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    definitionExpression: "property_category = 'condo' AND sold_rented_price != ''",
    fields: [
      {
            "name": "id",
            "type": "integer",
            "alias": "Property ID"
      },
      {
            "name": "mls_number",
            "type": "integer",
            "alias": "MLS Number"
      },
      {
            "name": "address",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "municipality",
            "type": "string",
            "alias": "Municipality"
      },
      {
            "name": "postal_code",
            "type": "string",
            "alias": "Postal Code"
      },
      {
            "name": "fsa_code",
            "type": "string",
            "alias": "FSA Code"
      },
      {
            "name": "bedrooms",
            "type": "integer",
            "alias": "Bedrooms"
      },
      {
            "name": "bathrooms",
            "type": "double",
            "alias": "Bathrooms"
      },
      {
            "name": "sold_rented_price",
            "type": "double",
            "alias": "Sold Price"
      }
    ]
  },
  {
    id: 'active_revenue_properties',
    name: 'Active Revenue Properties',
    type: 'geojson',
    url: blobUrls.property_revenue_active,
    group: 'properties',
    description: 'Active Revenue Properties from Centris MLS data with ML scores',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    definitionExpression: "property_category = 'revenue' AND sold_rented_price = ''",
    fields: [
      {
            "name": "id",
            "type": "integer",
            "alias": "Property ID"
      },
      {
            "name": "mls_number",
            "type": "integer",
            "alias": "MLS Number"
      },
      {
            "name": "address",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "municipality",
            "type": "string",
            "alias": "Municipality"
      },
      {
            "name": "postal_code",
            "type": "string",
            "alias": "Postal Code"
      },
      {
            "name": "fsa_code",
            "type": "string",
            "alias": "FSA Code"
      },
      {
            "name": "askedsold_price",
            "type": "double",
            "alias": "Asked Price"
      },
      {
            "name": "gross_income_multiplier",
            "type": "string",
            "alias": "Gross Income Multiplier"
      },
      {
            "name": "potential_gross_revenue",
            "type": "string",
            "alias": "Potential Gross Revenue"
      }
    ]
  },
  {
    id: 'sold_revenue_properties',
    name: 'Sold Revenue Properties',
    type: 'geojson',
    url: blobUrls.property_revenue_sold,
    group: 'properties',
    description: 'Sold Revenue Properties from Centris MLS data with ML scores',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'price_prediction_score',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    definitionExpression: "property_category = 'revenue' AND sold_rented_price != ''",
    fields: [
      {
            "name": "id",
            "type": "integer",
            "alias": "Property ID"
      },
      {
            "name": "mls_number",
            "type": "integer",
            "alias": "MLS Number"
      },
      {
            "name": "address",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "municipality",
            "type": "string",
            "alias": "Municipality"
      },
      {
            "name": "postal_code",
            "type": "string",
            "alias": "Postal Code"
      },
      {
            "name": "fsa_code",
            "type": "string",
            "alias": "FSA Code"
      },
      {
            "name": "sold_rented_price",
            "type": "double",
            "alias": "Sold Price"
      },
      {
            "name": "gross_income_multiplier",
            "type": "string",
            "alias": "Gross Income Multiplier"
      },
      {
            "name": "potential_gross_revenue",
            "type": "string",
            "alias": "Potential Gross Revenue"
      }
    ]
  },
  {
    id: 'active_properties_layer',
    name: 'Active Properties (Legacy)',
    type: 'geojson',
    url: '""',
    group: 'properties',
    description: 'Active property listings from Centris MLS data (Legacy - Hidden)',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'asked_price',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    definitionExpression: 'is_sold = 0',
    fields: [
      {
            "name": "id",
            "type": "integer",
            "alias": "Property ID"
      },
      {
            "name": "mls_number",
            "type": "integer",
            "alias": "MLS Number"
      },
      {
            "name": "address",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "municipality",
            "type": "string",
            "alias": "Municipality"
      },
      {
            "name": "postal_code",
            "type": "string",
            "alias": "Postal Code"
      },
      {
            "name": "fsa_code",
            "type": "string",
            "alias": "FSA Code"
      },
      {
            "name": "bedrooms",
            "type": "integer",
            "alias": "Bedrooms"
      },
      {
            "name": "bathrooms",
            "type": "double",
            "alias": "Bathrooms"
      },
      {
            "name": "lot_area",
            "type": "double",
            "alias": "Lot Area (sq ft)"
      },
      {
            "name": "living_area",
            "type": "double",
            "alias": "Living Area (sq ft)"
      },
      {
            "name": "asked_price",
            "type": "integer",
            "alias": "Asked Price"
      },
      {
            "name": "price_per_sqft",
            "type": "double",
            "alias": "Price per Sq Ft"
      },
      {
            "name": "property_type",
            "type": "string",
            "alias": "Property Type"
      },
      {
            "name": "is_sold",
            "type": "integer",
            "alias": "Is Sold (0=Active, 1=Sold)"
      },
      {
            "name": "has_basement",
            "type": "integer",
            "alias": "Has Basement"
      },
      {
            "name": "has_garage",
            "type": "integer",
            "alias": "Has Garage"
      },
      {
            "name": "has_parking",
            "type": "integer",
            "alias": "Has Parking"
      },
    ],
    metadata: {
      "provider": "Vercel Blob Storage",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["real-estate", "active-properties", "centris"],
      "sourceSystems": ["Centris MLS"],
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
    id: 'sold_properties_layer',
    name: 'Sold Properties (Legacy)',
    type: 'geojson',
    url: '""',
    group: 'properties',
    description: 'Sold property listings from Centris MLS data (Legacy - Hidden)',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'asked_price',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'local',
    definitionExpression: 'is_sold = 1',
    fields: [
      {
            "name": "id",
            "type": "integer",
            "alias": "Property ID"
      },
      {
            "name": "mls_number",
            "type": "integer",
            "alias": "MLS Number"
      },
      {
            "name": "address",
            "type": "string",
            "alias": "Address"
      },
      {
            "name": "municipality",
            "type": "string",
            "alias": "Municipality"
      },
      {
            "name": "postal_code",
            "type": "string",
            "alias": "Postal Code"
      },
      {
            "name": "fsa_code",
            "type": "string",
            "alias": "FSA Code"
      },
      {
            "name": "bedrooms",
            "type": "integer",
            "alias": "Bedrooms"
      },
      {
            "name": "bathrooms",
            "type": "double",
            "alias": "Bathrooms"
      },
      {
            "name": "lot_area",
            "type": "double",
            "alias": "Lot Area (sq ft)"
      },
      {
            "name": "living_area",
            "type": "double",
            "alias": "Living Area (sq ft)"
      },
      {
            "name": "asked_price",
            "type": "integer",
            "alias": "Asked Price"
      },
      {
            "name": "price_per_sqft",
            "type": "double",
            "alias": "Price per Sq Ft"
      },
      {
            "name": "property_type",
            "type": "string",
            "alias": "Property Type"
      },
      {
            "name": "is_sold",
            "type": "integer",
            "alias": "Is Sold (0=Active, 1=Sold)"
      },
      {
            "name": "has_basement",
            "type": "integer",
            "alias": "Has Basement"
      },
      {
            "name": "has_garage",
            "type": "integer",
            "alias": "Has Garage"
      },
      {
            "name": "has_parking",
            "type": "integer",
            "alias": "Has Parking"
      },
    ],
    metadata: {
      "provider": "Vercel Blob Storage",
      "updateFrequency": "daily",
      "version": "1.0",
      "tags": ["real-estate", "sold-properties", "centris"],
      "sourceSystems": ["Centris MLS"],
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
    name: 'My location buffers',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/1',
    group: 'general',
    description: 'Business Analyst Buffers Layer',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'Shape__Area',
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
            "name": "RELID",
            "type": "string",
            "alias": "Related Feature ID"
      },
      {
            "name": "RING",
            "type": "integer",
            "alias": "Ring"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "Description"
      },
      {
            "name": "SYMBOL",
            "type": "string",
            "alias": "Symbol"
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
    name: 'My polygons',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/2',
    group: 'general',
    description: 'Business Analyst Polygons Layer',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'Shape__Area',
    status: 'inactive',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "NAME",
            "type": "string",
            "alias": "Name"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "Description"
      },
      {
            "name": "CREATED",
            "type": "date",
            "alias": "Created"
      },
      {
            "name": "MODIFIED",
            "type": "date",
            "alias": "Modified"
      },
      {
            "name": "CREATOR",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EDITOR",
            "type": "string",
            "alias": "Editor"
      },
      {
            "name": "REGION",
            "type": "string",
            "alias": "Region Code"
      },
      {
            "name": "FLAGS",
            "type": "integer",
            "alias": "Custom Flags"
      },
      {
            "name": "SYMBOL",
            "type": "string",
            "alias": "Symbol"
      },
      {
            "name": "SITE_METADATA",
            "type": "string",
            "alias": "Site Metadata"
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
    name: 'My geographies',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/3',
    group: 'general',
    description: 'Business Analyst Geographies Layer',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'Shape__Area',
    status: 'inactive',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: [
      {
            "name": "OBJECTID",
            "type": "oid",
            "alias": "Object ID"
      },
      {
            "name": "NAME",
            "type": "string",
            "alias": "Name"
      },
      {
            "name": "DESCRIPTION",
            "type": "string",
            "alias": "Description"
      },
      {
            "name": "CREATED",
            "type": "date",
            "alias": "Created"
      },
      {
            "name": "MODIFIED",
            "type": "date",
            "alias": "Modified"
      },
      {
            "name": "CREATOR",
            "type": "string",
            "alias": "Creator"
      },
      {
            "name": "EDITOR",
            "type": "string",
            "alias": "Editor"
      },
      {
            "name": "REGION",
            "type": "string",
            "alias": "Region Code"
      },
      {
            "name": "FLAGS",
            "type": "integer",
            "alias": "Custom Flags"
      },
      {
            "name": "GEOID",
            "type": "string",
            "alias": "Geography ID"
      },
      {
            "name": "GEONAME",
            "type": "string",
            "alias": "Geography Name"
      },
      {
            "name": "GEOLEVEL",
            "type": "string",
            "alias": "Geography Level ID"
      },
      {
            "name": "HIERARCHY",
            "type": "string",
            "alias": "Geography Hierarchy"
      },
      {
            "name": "SYMBOL",
            "type": "string",
            "alias": "Symbol"
      },
      {
            "name": "SITE_METADATA",
            "type": "string",
            "alias": "Site Metadata"
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
    name: 'Total Population',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/7',
    group: 'demographics',
    description: 'Business Analyst Layer: Total Population',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYPTAPOP',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYPTAPOP",
            "type": "double",
            "alias": "2024 Total Population"
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
    id: 'Unknown_Service_layer_8',
    name: 'Tenure Total HHs',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/8',
    group: 'housing',
    description: 'Business Analyst Layer: 2024 Tenure Total HHs',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYTENHHD',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYTENHHD",
            "type": "double",
            "alias": "2024 Tenure: Total Households"
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
    name: '2029 Tenure Total HHs',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/9',
    group: 'hidden',
    description: 'Business Analyst Layer: 2029 Tenure Total HHs',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P5YTENHHD',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P5YTENHHD",
            "type": "double",
            "alias": "2029 Tenure: Total Households"
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
    name: '2034 Tenure Total HHs',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/10',
    group: 'hidden',
    description: 'Business Analyst Layer: 2034 Tenure Total HHs',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P0YTENHHD',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P0YTENHHD",
            "type": "double",
            "alias": "2034 Tenure: Total Households"
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
    name: 'Tenure Owned',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/11',
    group: 'housing',
    description: 'Business Analyst Layer: 2024 Tenure Owned',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYTENOWN_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYTENOWN",
            "type": "double",
            "alias": "2024 Tenure: Owned"
      },
      {
            "name": "ECYTENOWN_P",
            "type": "double",
            "alias": "2024 Tenure: Owned (%)"
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
    name: '2029 Tenure Owned',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/12',
    group: 'hidden',
    description: 'Business Analyst Layer: 2029 Tenure Owned',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P5YTENOWN_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P5YTENOWN",
            "type": "double",
            "alias": "2029 Tenure: Owned"
      },
      {
            "name": "P5YTENOWN_P",
            "type": "double",
            "alias": "2029 Tenure: Owned (%)"
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
    id: 'Unknown_Service_layer_13',
    name: '2034 Tenure Owned',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/13',
    group: 'hidden',
    description: 'Business Analyst Layer: 2034 Tenure Owned',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P0YTENOWN_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P0YTENOWN",
            "type": "double",
            "alias": "2034 Tenure: Owned"
      },
      {
            "name": "P0YTENOWN_P",
            "type": "double",
            "alias": "2034 Tenure: Owned (%)"
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
    id: 'Unknown_Service_layer_14',
    name: 'Tenure Rented',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/14',
    group: 'housing',
    description: 'Business Analyst Layer: 2024 Tenure Rented',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYTENRENT_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYTENRENT",
            "type": "double",
            "alias": "2024 Tenure: Rented"
      },
      {
            "name": "ECYTENRENT_P",
            "type": "double",
            "alias": "2024 Tenure: Rented (%)"
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
    id: 'Unknown_Service_layer_15',
    name: '2029 Tenure Rented',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/15',
    group: 'hidden',
    description: 'Business Analyst Layer: 2029 Tenure Rented',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P5YTENRENT_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P5YTENRENT",
            "type": "double",
            "alias": "2029 Tenure: Rented"
      },
      {
            "name": "P5YTENRENT_P",
            "type": "double",
            "alias": "2029 Tenure: Rented (%)"
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
    id: 'Unknown_Service_layer_16',
    name: '2034 Tenure Rented',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/16',
    group: 'hidden',
    description: 'Business Analyst Layer: 2034 Tenure Rented',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P0YTENRENT_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P0YTENRENT",
            "type": "double",
            "alias": "2034 Tenure: Rented"
      },
      {
            "name": "P0YTENRENT_P",
            "type": "double",
            "alias": "2034 Tenure: Rented (%)"
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
    id: 'Unknown_Service_layer_17',
    name: 'Condo Stat-In Condo',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/17',
    group: 'housing',
    description: 'Business Analyst Layer: 2024 Condo Stat-In Condo',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYCDOCO_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYCDOCO",
            "type": "double",
            "alias": "2024 Condominium Status - In Condo"
      },
      {
            "name": "ECYCDOCO_P",
            "type": "double",
            "alias": "2024 Condominium Status - In Condo (%)"
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
    id: 'Unknown_Service_layer_18',
    name: 'Condo Stat-In Condo Owned',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/18',
    group: 'housing',
    description: 'Business Analyst Layer: 2024 Condo Stat-In Condo Owned',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYCDOOWCO_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYCDOOWCO",
            "type": "double",
            "alias": "2024 Condominium Status - In Condo: Owned"
      },
      {
            "name": "ECYCDOOWCO_P",
            "type": "double",
            "alias": "2024 Condominium Status - In Condo: Owned (%)"
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
    id: 'Unknown_Service_layer_19',
    name: 'Condo Stat-In Condo Rented',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/19',
    group: 'housing',
    description: 'Business Analyst Layer: 2024 Condo Stat-In Condo Rented',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYCDORECO_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYCDORECO",
            "type": "double",
            "alias": "2024 Condominium Status - In Condo: Rented"
      },
      {
            "name": "ECYCDORECO_P",
            "type": "double",
            "alias": "2024 Condominium Status - In Condo: Rented (%)"
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
    id: 'Unknown_Service_layer_20',
    name: 'Maintainers - 15 to 24',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/20',
    group: 'housing',
    description: 'Business Analyst Layer: 2024 Maintainers - 15 to 24',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYMTN1524_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYMTN1524",
            "type": "double",
            "alias": "2024 Maintainers - 15 to 24"
      },
      {
            "name": "ECYMTN1524_P",
            "type": "double",
            "alias": "2024 Maintainers - 15 to 24 (%)"
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
    id: 'Unknown_Service_layer_21',
    name: 'Maintainers - 25 to 34',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/21',
    group: 'housing',
    description: 'Business Analyst Layer: 2024 Maintainers - 25 to 34',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYMTN2534_P',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYMTN2534",
            "type": "double",
            "alias": "2024 Maintainers - 25 to 34"
      },
      {
            "name": "ECYMTN2534_P",
            "type": "double",
            "alias": "2024 Maintainers - 25 to 34 (%)"
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
    id: 'Unknown_Service_layer_22',
    name: '2024 Household Average Income (Current Year)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/22',
    group: 'demographics',
    description: 'Business Analyst Layer: 2024 HH Inc Average Curr',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYHNIAVG',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYHNIAVG",
            "type": "double",
            "alias": "2024 Household Average Income (Current Year $)"
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
    id: 'Unknown_Service_layer_23',
    name: '2029 Household Average Income (Current Year)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/23',
    group: 'hidden',
    description: 'Business Analyst Layer: 2029 HH Inc Average Curr',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P5YHNIAVG',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P5YHNIAVG",
            "type": "double",
            "alias": "2029 Household Average Income (Current Year $)"
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
    id: 'Unknown_Service_layer_24',
    name: '2024 Household Median Income (Current Year)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/24',
    group: 'demographics',
    description: 'Business Analyst Layer: 2024 HH Inc Median Curr',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYHNIMED',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYHNIMED",
            "type": "double",
            "alias": "2024 Household Median Income (Current Year $)"
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
    id: 'Unknown_Service_layer_25',
    name: '2029 Household Median Income (Current Year)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/25',
    group: 'hidden',
    description: 'Business Analyst Layer: 2029 HH Inc Median Curr',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P5YHNIMED',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P5YHNIMED",
            "type": "double",
            "alias": "2029 Household Median Income (Current Year $)"
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
    id: 'Unknown_Service_layer_26',
    name: '2024 Household Aggregate Income (Current Year)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/26',
    group: 'demographics',
    description: 'Business Analyst Layer: 2024 HH Inc Aggregate Curr',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYHNIAGG',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYHNIAGG",
            "type": "double",
            "alias": "2024 Household Aggregate Income (Current Year $)"
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
    name: '2029 Household Aggregate Income (Current Year)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/27',
    group: 'hidden',
    description: 'Business Analyst Layer: 2029 HH Inc Aggregate Curr',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P5YHNIAGG',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P5YHNIAGG",
            "type": "double",
            "alias": "2029 Household Aggregate Income (Current Year $)"
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
    name: '2024 Household Average Income (Conservative)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/28',
    group: 'demographics',
    description: 'Business Analyst Layer: 2024 HH Inc Average Cons',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYHRIAVG',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYHRIAVG",
            "type": "double",
            "alias": "2024 Household Average Income (Const Year 2016 $)"
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
    name: '2029 Household Average Income (Conservative)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/29',
    group: 'hidden',
    description: 'Business Analyst Layer: 2029 HH Inc Average Cons',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P5YHRIAVG',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P5YHRIAVG",
            "type": "double",
            "alias": "2029 Household Average Income (Const Year 2016 $)"
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
    name: '2024 Household Median Income (Conservative)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/30',
    group: 'demographics',
    description: 'Business Analyst Layer: 2024 HH Inc Median Cons',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYHRIMED',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYHRIMED",
            "type": "double",
            "alias": "2024 Household Median Income (Const Year 2016 $)"
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
    name: '2029 Household Median Income (Conservative)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/31',
    group: 'hidden',
    description: 'Business Analyst Layer: 2029 HH Inc Median Cons',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P5YHRIMED',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P5YHRIMED",
            "type": "double",
            "alias": "2029 Household Median Income (Const Year 2016 $)"
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
    name: '2024 Household Aggregate Income (Conservative)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/32',
    group: 'demographics',
    description: 'Business Analyst Layer: 2024 HH Inc Aggregate Cons',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'ECYHRIAGG',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "ECYHRIAGG",
            "type": "double",
            "alias": "2024 Household Aggregate Income (Const Year 2016 $)"
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
    name: '2029 Household Aggregate Income (Conservative)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/33',
    group: 'hidden',
    description: 'Business Analyst Layer: 2029 HH Inc Aggregate Cons',
    isVisible: false,
    isPrimary: false,
    skipLayerList: true,
    rendererField: 'P5YHRIAGG',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "P5YHRIAGG",
            "type": "double",
            "alias": "2029 Household Aggregate Income (Const Year 2016 $)"
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
    name: 'HHs Exp Tot CurCons FinTrfr (Avg)',
    type: 'feature-service',
    url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_BH_QC_layers/FeatureServer/34',
    group: 'demographics',
    description: 'Business Analyst Layer: 2024 HHs Exp Tot CurCons FinTrfr (Avg)',
    isVisible: false,
    isPrimary: false,
    skipLayerList: false,
    rendererField: 'HSTE001',
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
            "alias": "Forward Sortation Area"
      },
      {
            "name": "ID",
            "type": "string",
            "alias": "ID"
      },
      {
            "name": "HSTE001",
            "type": "double",
            "alias": "2024 Total Current Consumption, Financial Transfer Household Expense"
      },
      {
            "name": "HSTE001_A",
            "type": "double",
            "alias": "2024 Total Current Consumption, Financial Transfer Household Expense (Avg)"
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
  }
];

// === COMPOSITE INDEX LAYERS ===
// These layers are created client-side using calculated composite index data
export const compositeIndexLayerConfigs: LayerConfig[] = [
  {
    id: 'hot_growth_index_layer',
    name: 'Hot Growth Index',
    type: 'client-side-composite',
    url: 'composite-index://HOT_GROWTH_INDEX',
    group: 'indexes',
    description: 'Composite index identifying areas with high growth potential based on population growth, new construction, and economic indicators',
    isVisible: false,
    isPrimary: true,
    skipLayerList: false,
    rendererField: 'HOT_GROWTH_INDEX',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'regional',
    metadata: {
      provider: 'MPIQ AI Chat - Composite Index Calculator',
      updateFrequency: 'daily',
      tags: ['composite-index', 'housing', 'growth', 'calculated'],
      geometryType: 'polygon',
      valueType: 'index',
      coverage: {
        spatial: 'Quebec Province',
        temporal: 'Current'
      },
      geographicType: 'postal',
      geographicLevel: 'regional'
    },
    fields: [
      {
        name: "OBJECTID",
        type: "oid",
        alias: "Object ID"
      },
      {
        name: "GEOID",
        type: "string", 
        alias: "Geographic ID"
      },
      {
        name: "HOT_GROWTH_INDEX",
        type: "double",
        alias: "Hot Growth Score"
      }
    ],
    clientSideConfig: {
      indexField: 'HOT_GROWTH_INDEX',
      displayName: 'Hot Growth Score',
      baseGeometryLayer: 'Unknown_Service_layer_1', // Reference to housing layer with geometry
      colorScheme: 'firefly',
      legendTitle: 'Growth Potential'
    },
    processing: {
      strategy: 'ai'
    },
    caching: {
      strategy: 'memory',
      ttl: 3600
    },
    performance: {
      maxFeatures: 10000,
      clustering: false
    },
    security: {
      accessLevel: 'read'
    }
  },
  {
    id: 'new_homeowner_index_layer', 
    name: 'New Homeowner Index',
    type: 'client-side-composite',
    url: 'composite-index://NEW_HOMEOWNER_INDEX',
    group: 'indexes',
    description: 'Composite index identifying areas with high potential for new homeowner market based on demographics, income trends, and housing patterns',
    isVisible: false,
    isPrimary: true,
    skipLayerList: false,
    rendererField: 'NEW_HOMEOWNER_INDEX',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'regional',
    metadata: {
      provider: 'MPIQ AI Chat - Composite Index Calculator',
      updateFrequency: 'daily',
      tags: ['composite-index', 'housing', 'homeowner', 'calculated'],
      geometryType: 'polygon',
      valueType: 'index',
      coverage: {
        spatial: 'Quebec Province',
        temporal: 'Current'
      },
      geographicType: 'postal',
      geographicLevel: 'regional'
    },
    fields: [
      {
        name: "OBJECTID",
        type: "oid",
        alias: "Object ID"
      },
      {
        name: "GEOID", 
        type: "string",
        alias: "Geographic ID"
      },
      {
        name: "NEW_HOMEOWNER_INDEX",
        type: "double", 
        alias: "New Homeowner Score"
      }
    ],
    clientSideConfig: {
      indexField: 'NEW_HOMEOWNER_INDEX',
      displayName: 'New Homeowner Score',
      baseGeometryLayer: 'Unknown_Service_layer_1',
      colorScheme: 'firefly', 
      legendTitle: 'Homeowner Opportunity'
    },
    processing: {
      strategy: 'ai'
    },
    caching: {
      strategy: 'memory',
      ttl: 3600
    },
    performance: {
      maxFeatures: 10000,
      clustering: false
    },
    security: {
      accessLevel: 'read'
    }
  },
  {
    id: 'housing_affordability_index_layer',
    name: 'Affordability Index',
    type: 'client-side-composite',
    url: 'composite-index://HOUSING_AFFORDABILITY_INDEX', 
    group: 'indexes',
    description: 'Composite index showing housing affordability relative to income levels, cost burden, and market conditions',
    isVisible: false,
    isPrimary: true,
    skipLayerList: false,
    rendererField: 'HOUSING_AFFORDABILITY_INDEX',
    status: 'active',
    geographicType: 'postal',
    geographicLevel: 'regional',
    metadata: {
      provider: 'MPIQ AI Chat - Composite Index Calculator',
      updateFrequency: 'daily',
      tags: ['composite-index', 'housing', 'affordability', 'calculated'],
      geometryType: 'polygon',
      valueType: 'index',
      coverage: {
        spatial: 'Quebec Province',
        temporal: 'Current'
      },
      geographicType: 'postal',
      geographicLevel: 'regional'
    },
    fields: [
      {
        name: "OBJECTID",
        type: "oid",
        alias: "Object ID" 
      },
      {
        name: "GEOID",
        type: "string",
        alias: "Geographic ID"
      },
      {
        name: "HOUSING_AFFORDABILITY_INDEX",
        type: "double",
        alias: "Affordability Score"
      }
    ],
    clientSideConfig: {
      indexField: 'HOUSING_AFFORDABILITY_INDEX',
      displayName: 'Affordability Score',
      baseGeometryLayer: 'Unknown_Service_layer_1',
      colorScheme: 'firefly',
      legendTitle: 'Housing Affordability'
    },
    processing: {
      strategy: 'ai'
    },
    caching: {
      strategy: 'memory',
      ttl: 3600
    },
    performance: {
      maxFeatures: 10000,
      clustering: false
    },
    security: {
      accessLevel: 'read'
    }
  }
];

// Combine all layer configurations  
export const allLayerConfigs: any[] = [...baseLayerConfigs, ...compositeIndexLayerConfigs];

// Apply helper functions to all configurations (excluding composite index layers which have special handling)
export const layerConfigs: any[] = [
  ...baseLayerConfigs.map(ensureLayerHasDescriptionField).map(updateRendererFieldForPercentage),
  ...compositeIndexLayerConfigs // These are already properly configured
];

// Group layers by category for easier management
export const layerGroups = {
  'properties': {
    displayName: 'Properties',
    description: 'Real estate property listings from Centris MLS',
    layerCount: 2,
    confidence: 1.00,
    layers: [
      'active_properties_layer',
      'sold_properties_layer'
    ]
  },
  'group_p': {
    displayName: 'P',
    description: 'Layers with P prefix pattern',
    layerCount: 12,
    confidence: 1.00,
    layers: [
      'Unknown_Service_layer_9',
    'Unknown_Service_layer_10',
    'Unknown_Service_layer_12',
    'Unknown_Service_layer_13',
    'Unknown_Service_layer_15',
    'Unknown_Service_layer_16',
    'Unknown_Service_layer_23',
    'Unknown_Service_layer_25',
    'Unknown_Service_layer_27',
    'Unknown_Service_layer_29',
    'Unknown_Service_layer_31',
    'Unknown_Service_layer_33'
    ]
  },
  'group_percentage_data': {
    displayName: 'Percentage Metrics',
    description: 'Percentage-based metrics and rates',
    layerCount: 5,
    confidence: 1.00,
    layers: [
      'Unknown_Service_layer_11',
    'Unknown_Service_layer_14',
    'Unknown_Service_layer_17',
    'Unknown_Service_layer_18',
    'Unknown_Service_layer_19'
    ]
  },
  'group_ecymtn': {
    displayName: 'Ecymtn',
    description: 'Layers with ECYMTN prefix pattern',
    layerCount: 2,
    confidence: 1.00,
    layers: [
      'Unknown_Service_layer_20',
    'Unknown_Service_layer_21'
    ]
  },
  'group_metadata': {
    displayName: 'Metadata',
    description: 'Layers related to metadata',
    layerCount: 2,
    confidence: 0.90,
    layers: [
    'Unknown_Service_layer_2',
    'Unknown_Service_layer_3'
    ]
  },
  'group_general': {
    displayName: 'General',
    description: 'General data layers',
    layerCount: 10,
    confidence: 0.20,
    layers: [
      'Unknown_Service_layer_1',
    'Unknown_Service_layer_7',
    'Unknown_Service_layer_8',
    'Unknown_Service_layer_22',
    'Unknown_Service_layer_24',
    'Unknown_Service_layer_26',
    'Unknown_Service_layer_28',
    'Unknown_Service_layer_30',
    'Unknown_Service_layer_32',
    'Unknown_Service_layer_34'
    ]
  },
  
  'housing': {
    displayName: 'Housing',
    description: 'Housing-related data layers including tenure, condo status, and maintainers',
    layerCount: 7,
    confidence: 1.00,
    layers: []
  },
  'demographics': {
    displayName: 'Demographics',
    description: 'Demographic and income-related data layers',
    layerCount: 7,
    confidence: 1.00,
    layers: []
  },
  'indexes': {
    displayName: 'Indexes',
    description: 'Calculated composite indexes for housing market analysis',
    layerCount: 3,
    confidence: 1.00,
    layers: [
      'hot_growth_index_layer',
      'new_homeowner_index_layer', 
      'housing_affordability_index_layer'
    ]
  },
  'hidden': {
    displayName: 'Hidden',
    description: 'Hidden layers not shown in layer list',
    layerCount: 12,
    confidence: 1.00,
    layers: []
  },
  'composite-indexes': {
    displayName: 'Composite Indexes',
    description: 'Calculated composite indexes for housing market analysis',
    layerCount: 3,
    confidence: 1.00,
    layers: [
      'hot_growth_index_layer',
      'new_homeowner_index_layer', 
      'housing_affordability_index_layer'
    ]
  }

};

// Export individual layers for direct access
export const layers: { [key: string]: any } = layerConfigs.reduce((acc, layer) => {
  acc[layer.id] = layer;
  return acc;
}, {} as { [key: string]: any });

// Export layer count for monitoring
export const layerCount = layerConfigs.length;

// Export generation metadata
export const generationMetadata = {
  generatedAt: '2025-09-02T08:05:48.310476',
  layerCount: 32,
  groupCount: 1,
  automationVersion: '1.0.0'
};
