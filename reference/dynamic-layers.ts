import { baseLayerConfigs } from '../config/layers';
import type { LayerConfig, VirtualLayer } from '../types/layers';
import { Extent } from '@arcgis/core/geometry';

/**
 * Enum defining all supported visualization types
 * This should be used instead of hardcoded strings throughout the application
 */
export enum VisualizationType {
  CHOROPLETH = 'choropleth',
  HEATMAP = 'heatmap',
  SCATTER = 'scatter',
  CLUSTER = 'cluster',
  CATEGORICAL = 'categorical',
  TRENDS = 'trends',
  CORRELATION = 'correlation',
  JOINT_HIGH = 'joint_high',
  PROPORTIONAL_SYMBOL = 'proportional_symbol',
  COMPARISON = 'comparison',
  TOP_N = 'top_n',
  HEXBIN = 'hexbin',
  BIVARIATE = 'bivariate',
  BUFFER = 'buffer',
  HOTSPOT = 'hotspot',
  NETWORK = 'network',
  MULTIVARIATE = 'multivariate',
  OUTLIER = 'outlier',
  SCENARIO = 'scenario',
  INTERACTION = 'interaction',
  BUBBLE = 'bubble',
  ISOLINE = 'isoline',
  FLOW = 'flow',
  TEMPORAL = 'temporal',
  COMPARATIVE = 'comparative',
  THRESHOLD = 'threshold',
  SEGMENT = 'segment',
  COMPARATIVE_ANALYSIS = 'comparative_analysis',
  CROSS_GEOGRAPHY_CORRELATION = 'cross_geography_correlation',
  DENSITY = 'density',
  TIME_SERIES = 'time_series',
  PROXIMITY = 'proximity',
  COMPOSITE = 'composite',
  OVERLAY = 'overlay',
  AGGREGATION = 'aggregation',
  SINGLE_LAYER = 'single_layer',
  POINT_LAYER = 'point_layer',
  DIFFERENCE = 'difference'
}

/**
 * Metadata describing each visualization type
 * Used for documentation, UI hints, and query matching
 */
export interface VisualizationTypeMetadata {
  label: string;
  description: string;
  requiresFields: number; // Number of fields required
  supportsGeometryTypes: string[]; // polygon, point, polyline
  supportsLayerTypes: string[]; // index, point, percentage, amount
  defaultSymbology: any;
  aiQueryPatterns: string[]; // Example patterns that map to this viz type
}

/**
 * Configuration for visualization types
 * Provides default settings and metadata for each type
 */
export const visualizationTypesConfig: Record<VisualizationType, VisualizationTypeMetadata> = {
  [VisualizationType.CHOROPLETH]: {
    label: 'Choropleth Map',
    description: 'Shows values across geographic areas using color intensity',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'Blues',
      classes: 5,
      classification: 'quantile'
    },
    aiQueryPatterns: [
      'Show me {field} by {region}',
      'Display {field} across {regions}',
      'Visualize {field} distribution'
    ]
  },
  [VisualizationType.HEATMAP]: {
    label: 'Heat Map',
    description: 'Shows density of points using a heat gradient',
    requiresFields: 0,
    supportsGeometryTypes: ['point'],
    supportsLayerTypes: ['point'],
    defaultSymbology: {
      radius: 25,
      colorScheme: 'Reds'
    },
    aiQueryPatterns: [
      'Show density of {points}',
      'Heat map of {points}',
      'Where are {points} concentrated'
    ]
  },
  [VisualizationType.SCATTER]: {
    label: 'Scatter Plot',
    description: 'Shows points with optional size and color encoding',
    requiresFields: 1,
    supportsGeometryTypes: ['point'],
    supportsLayerTypes: ['point', 'index'],
    defaultSymbology: {
      size: 8,
      color: '#1f77b4',
      outlineWidth: 0.5,
      outlineColor: '#ffffff'
    },
    aiQueryPatterns: [
      'Plot {points} on the map',
      'Show locations of {points}',
      'Map all {points}'
    ]
  },
  [VisualizationType.CLUSTER]: {
    label: 'Cluster Map',
    description: 'Groups nearby points into clusters',
    requiresFields: 0,
    supportsGeometryTypes: ['point'],
    supportsLayerTypes: ['point'],
    defaultSymbology: {
      clusterRadius: 50,
      clusterMinSize: 10,
      clusterMaxSize: 25,
      colors: ['#1f77b4', '#ff7f0e', '#2ca02c']
    },
    aiQueryPatterns: [
      'Cluster {points} on the map',
      'Group {points} by location',
      'Show clusters of {points}'
    ]
  },
  [VisualizationType.CATEGORICAL]: {
    label: 'Categorical Map',
    description: 'Colors features based on categories',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon', 'point'],
    supportsLayerTypes: ['index', 'point'],
    defaultSymbology: {
      colorScheme: 'Category10',
      outlineWidth: 0.5,
      outlineColor: '#ffffff'
    },
    aiQueryPatterns: [
      'Show {field} by category',
      'Categorize {regions} by {field}',
      'Color {regions} by {field} type'
    ]
  },
  [VisualizationType.TRENDS]: {
    label: 'Trends Map',
    description: 'Shows temporal trends across geography',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'RdBu',
      classes: 7,
      classification: 'standard-deviation'
    },
    aiQueryPatterns: [
      'Show trends in {field}',
      'How has {field} changed over time',
      'Temporal patterns of {field}'
    ]
  },
  [VisualizationType.CORRELATION]: {
    label: 'Correlation Map',
    description: 'Shows the relationship between two variables',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'RdBu',
      classes: 5,
      classification: 'natural-breaks'
    },
    aiQueryPatterns: [
      'Compare {field1} with {field2}',
      'Relationship between {field1} and {field2}',
      'Correlation of {field1} and {field2}'
    ]
  },
  [VisualizationType.JOINT_HIGH]: {
    label: 'Joint High Analysis',
    description: 'Identifies areas where multiple indicators are high',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage'],
    defaultSymbology: {
      highColor: '#ff0000',
      midColor: '#ffff00',
      lowColor: '#ffffff',
      outlineColor: '#000000'
    },
    aiQueryPatterns: [
      'Where are both {field1} and {field2} high',
      'Areas with high {field1} and high {field2}',
      'Joint high values of {field1} and {field2}'
    ]
  },
  [VisualizationType.PROPORTIONAL_SYMBOL]: {
    label: 'Proportional Symbol',
    description: 'Shows values through symbol size',
    requiresFields: 1,
    supportsGeometryTypes: ['point', 'polygon'],
    supportsLayerTypes: ['index', 'feature-service'],
    defaultSymbology: {
      minSize: 5,
      maxSize: 50,
      color: '#1f77b4',
      shape: 'circle'
    },
    aiQueryPatterns: [
      'Show {field} with symbol size',
      'Proportional symbols of {field}',
      'Bubble map of {field}'
    ]
  },
  [VisualizationType.COMPARISON]: {
    label: 'Comparison Map',
    description: 'Compares values against a benchmark',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage'],
    defaultSymbology: {
      colorScheme: 'RdYlBu',
      classes: 5,
      classification: 'standard-deviation'
    },
    aiQueryPatterns: [
      'Compare {field1} to {field2}',
      'Difference between {field1} and {field2}',
      'How does {field1} compare to average'
    ]
  },
  [VisualizationType.OUTLIER]: {
    label: 'Outlier Detection',
    description: 'Identifies statistically unusual areas and explains what makes them outliers',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon', 'point'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      outlierColor: '#ff0000',
      normalColor: '#cccccc',
      highlightColor: '#ff6600',
      outlineColor: '#000000'
    },
    aiQueryPatterns: [
      'What areas are unusual outliers for {field}',
      'Show me anomalous regions with {field}',
      'Which areas stand out as different',
      'Find outliers in {field} data'
    ]
  },
  [VisualizationType.SCENARIO]: {
    label: 'Scenario Analysis',
    description: 'Models what-if scenarios and predicts impacts of changes',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon', 'point'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      baselineColor: '#cccccc',
      improvementColor: '#00ff00',
      declineColor: '#ff0000',
      outlineColor: '#000000'
    },
    aiQueryPatterns: [
      'What if {field} increased by {percent}%',
      'How would {field} change if {condition}',
      'Simulate {percent}% increase in {field}',
      'What would happen if {field} improved'
    ]
  },
  [VisualizationType.INTERACTION]: {
    label: 'Feature Interaction',
    description: 'Analyzes how variables work together and their combined effects',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      synergyColor: '#00ff00',
      antagonistColor: '#ff0000',
      neutralColor: '#ffff00',
      outlineColor: '#000000'
    },
    aiQueryPatterns: [
      'How do {field1} and {field2} work together',
      'What combinations of {field1} and {field2} amplify effects',
      'Interaction between {field1} and {field2}',
      'Combined effect of {field1} and {field2}'
    ]
  },
  [VisualizationType.BUBBLE]: {
    label: 'Bubble Map',
    description: 'Shows values through bubble size',
    requiresFields: 1,
    supportsGeometryTypes: ['point'],
    supportsLayerTypes: ['point'],
    defaultSymbology: {
      size: 8,
      color: '#1f77b4',
      outlineWidth: 0.5,
      outlineColor: '#ffffff'
    },
    aiQueryPatterns: [
      'Show {field} with bubble size',
      'Bubble map of {field}',
      'Bubble chart of {field}'
    ]
  },
  [VisualizationType.ISOLINE]: {
    label: 'Isoline Map',
    description: 'Shows values along lines',
    requiresFields: 1,
    supportsGeometryTypes: ['polyline'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'Blues',
      classes: 5,
      classification: 'quantile'
    },
    aiQueryPatterns: [
      'Show isolines of {field}',
      'Isoline map of {field}',
      'Isoline chart of {field}'
    ]
  },
  [VisualizationType.FLOW]: {
    label: 'Flow Map',
    description: 'Shows movement between areas',
    requiresFields: 1,
    supportsGeometryTypes: ['polyline'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'Blues',
      classes: 5,
      classification: 'quantile'
    },
    aiQueryPatterns: [
      'Show flow between {field}',
      'Flow map of {field}',
      'Flow chart of {field}'
    ]
  },
  [VisualizationType.TEMPORAL]: {
    label: 'Temporal Map',
    description: 'Shows values over time',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'RdBu',
      classes: 7,
      classification: 'standard-deviation'
    },
    aiQueryPatterns: [
      'Show trends in {field}',
      'How has {field} changed over time',
      'Temporal patterns of {field}'
    ]
  },
  [VisualizationType.COMPARATIVE]: {
    label: 'Comparative Map',
    description: 'Compares values between different groups or categories',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage'],
    defaultSymbology: {
      colorScheme: 'RdYlBu',
      classes: 5,
      classification: 'standard-deviation'
    },
    aiQueryPatterns: [
      'Compare {field1} to {field2}',
      'Difference between {field1} and {field2}',
      'How does {field1} compare to {field2}'
    ]
  },
  [VisualizationType.THRESHOLD]: {
    label: 'Threshold Analysis',
    description: 'Identifies critical thresholds and inflection points',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: {
        type: 'sequential',
        colors: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'],
        stops: [0, 0.25, 0.5, 0.75, 1.0]
      },
      symbolConfig: {
        type: 'simple-marker',
        style: 'circle',
        size: 8,
        outline: {
          color: [255, 255, 255, 0.8],
          width: 1
        }
      },
      legendConfig: {
        title: 'Threshold Impact',
        type: 'gradient',
        showLabels: true,
        precision: 2
      },
      queryPatterns: [
        'threshold analysis',
        'critical level',
        'inflection point',
        'at what level',
        'break point'
      ],
      useCases: [
        'Income thresholds for approval rates',
        'Critical population density levels',
        'Performance tipping points'
      ]
    },
    aiQueryPatterns: [
      'threshold analysis',
      'critical level',
      'inflection point',
      'at what level',
      'break point'
    ]
  },
  [VisualizationType.SEGMENT]: {
    label: 'Segment Profiling',
    description: 'Profiles and characterizes different segments',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: {
        type: 'categorical',
        colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'],
        stops: []
      },
      symbolConfig: {
        type: 'simple-marker',
        style: 'circle',
        size: 10,
        outline: {
          color: [255, 255, 255, 0.9],
          width: 2
        }
      },
      legendConfig: {
        title: 'Segment Profile',
        type: 'categorical',
        showLabels: true,
        showCounts: true
      },
      queryPatterns: [
        'segment profiling',
        'what characterizes',
        'profile of',
        'high performing',
        'segment characteristics'
      ],
      useCases: [
        'High vs low performing areas',
        'Customer segment profiles',
        'Demographic group characteristics'
      ]
    },
    aiQueryPatterns: [
      'segment profiling',
      'what characterizes',
      'profile of',
      'high performing',
      'segment characteristics'
    ]
  },
  [VisualizationType.COMPARATIVE_ANALYSIS]: {
    label: 'Comparative Analysis',
    description: 'Compares different groups or categories',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage'],
    defaultSymbology: {
      colorScheme: {
        type: 'diverging',
        colors: ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4'],
        stops: []
      },
      symbolConfig: {
        type: 'simple-marker',
        style: 'diamond',
        size: 9,
        outline: {
          color: [0, 0, 0, 0.7],
          width: 1.5
        }
      },
      legendConfig: {
        title: 'Group Comparison',
        type: 'categorical',
        showLabels: true,
        showPercentages: true
      },
      queryPatterns: [
        'comparative analysis',
        'compare groups',
        'urban vs rural',
        'difference between',
        'group comparison'
      ],
      useCases: [
        'Urban vs rural comparison',
        'Regional performance differences',
        'Demographic group comparisons'
      ]
    },
    aiQueryPatterns: [
      'comparative analysis',
      'compare groups',
      'urban vs rural',
      'difference between',
      'group comparison'
    ]
  },
  [VisualizationType.TOP_N]: {
    label: 'Top N Analysis',
    description: 'Shows the top performing areas by a specific metric',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'Oranges',
      classes: 5,
      classification: 'quantile'
    },
    aiQueryPatterns: [
      'top {n} areas by {field}',
      'highest {n} regions for {field}',
      'best performing {n} locations'
    ]
  },
  [VisualizationType.HEXBIN]: {
    label: 'Hexbin Map',
    description: 'Aggregates point data into hexagonal bins',
    requiresFields: 1,
    supportsGeometryTypes: ['point'],
    supportsLayerTypes: ['point'],
    defaultSymbology: {
      colorScheme: 'Blues',
      binSize: 50,
      aggregationType: 'count'
    },
    aiQueryPatterns: [
      'hexbin map of {points}',
      'aggregate {points} into hexagons',
      'hexagonal binning of {data}'
    ]
  },
  [VisualizationType.BIVARIATE]: {
    label: 'Bivariate Map',
    description: 'Shows the relationship between two variables using color mixing',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'bivariate',
      classes: 9,
      classification: 'quantile'
    },
    aiQueryPatterns: [
      'bivariate map of {field1} and {field2}',
      'two-variable map showing {field1} and {field2}',
      'combined visualization of {field1} and {field2}'
    ]
  },
  [VisualizationType.BUFFER]: {
    label: 'Buffer Analysis',
    description: 'Shows areas within a specified distance of features',
    requiresFields: 0,
    supportsGeometryTypes: ['point', 'polyline', 'polygon'],
    supportsLayerTypes: ['point', 'feature-service'],
    defaultSymbology: {
      bufferColor: '#0066cc',
      bufferOpacity: 0.3,
      outlineColor: '#003d7a'
    },
    aiQueryPatterns: [
      'areas within {distance} of {features}',
      'buffer around {features}',
      '{distance} mile radius from {features}'
    ]
  },
  [VisualizationType.HOTSPOT]: {
    label: 'Hotspot Analysis',
    description: 'Identifies statistically significant spatial clusters',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon', 'point'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      hotColor: '#ff0000',
      coldColor: '#0000ff',
      neutralColor: '#cccccc'
    },
    aiQueryPatterns: [
      'hotspots of {field}',
      'spatial clusters of {field}',
      'significant clusters in {field}'
    ]
  },
  [VisualizationType.NETWORK]: {
    label: 'Network Analysis',
    description: 'Shows connections and relationships between locations',
    requiresFields: 1,
    supportsGeometryTypes: ['polyline', 'point'],
    supportsLayerTypes: ['feature-service'],
    defaultSymbology: {
      nodeColor: '#0066cc',
      edgeColor: '#666666',
      nodeSize: 8
    },
    aiQueryPatterns: [
      'network of {connections}',
      'connections between {locations}',
      'relationship network of {features}'
    ]
  },
  [VisualizationType.MULTIVARIATE]: {
    label: 'Multivariate Analysis',
    description: 'Analyzes multiple variables simultaneously',
    requiresFields: 3,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'Spectral',
      classes: 7,
      classification: 'natural-breaks'
    },
    aiQueryPatterns: [
      'multivariate analysis of {fields}',
      'multiple variables {field1}, {field2}, {field3}',
      'combined analysis of several factors'
    ]
  },
  [VisualizationType.CROSS_GEOGRAPHY_CORRELATION]: {
    label: 'Cross-Geography Correlation',
    description: 'Shows correlations across different geographic levels',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage'],
    defaultSymbology: {
      colorScheme: 'RdBu',
      classes: 7,
      classification: 'standard-deviation'
    },
    aiQueryPatterns: [
      'correlation across {geography1} and {geography2}',
      'cross-geographic relationship between {field1} and {field2}'
    ]
  },
  [VisualizationType.DENSITY]: {
    label: 'Density Map',
    description: 'Shows the density distribution of features',
    requiresFields: 0,
    supportsGeometryTypes: ['point'],
    supportsLayerTypes: ['point'],
    defaultSymbology: {
      colorScheme: 'Reds',
      radius: 30,
      blur: 15
    },
    aiQueryPatterns: [
      'density of {points}',
      'concentration of {features}',
      'density distribution of {data}'
    ]
  },
  [VisualizationType.TIME_SERIES]: {
    label: 'Time Series Map',
    description: 'Shows changes over time',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'Viridis',
      classes: 5,
      classification: 'quantile'
    },
    aiQueryPatterns: [
      'time series of {field}',
      'changes in {field} over time',
      'temporal analysis of {field}'
    ]
  },
  [VisualizationType.PROXIMITY]: {
    label: 'Proximity Analysis',
    description: 'Analyzes spatial relationships and distances',
    requiresFields: 1,
    supportsGeometryTypes: ['point', 'polygon'],
    supportsLayerTypes: ['point', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'Purples',
      classes: 5,
      classification: 'natural-breaks'
    },
    aiQueryPatterns: [
      'proximity to {features}',
      'distance to {locations}',
      'near to {points}'
    ]
  },
  [VisualizationType.COMPOSITE]: {
    label: 'Composite Visualization',
    description: 'Combines multiple visualization techniques',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon', 'point'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'Set3',
      classes: 8,
      classification: 'quantile'
    },
    aiQueryPatterns: [
      'composite view of {fields}',
      'combined visualization',
      'multiple techniques for {data}'
    ]
  },
  [VisualizationType.OVERLAY]: {
    label: 'Overlay Analysis',
    description: 'Overlays multiple data layers for analysis',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['feature-service'],
    defaultSymbology: {
      colorScheme: 'Paired',
      opacity: 0.7,
      classes: 6
    },
    aiQueryPatterns: [
      'overlay {layer1} with {layer2}',
      'combine {data1} and {data2}',
      'layer {field1} over {field2}'
    ]
  },
  [VisualizationType.AGGREGATION]: {
    label: 'Aggregation Analysis',
    description: 'Aggregates data at different geographic levels',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service'],
    defaultSymbology: {
      colorScheme: 'YlOrRd',
      classes: 5,
      classification: 'quantile'
    },
    aiQueryPatterns: [
      'aggregate {field} by {geography}',
      'sum {field} by region',
      'total {field} by area'
    ]
  },
  [VisualizationType.SINGLE_LAYER]: {
    label: 'Single Layer Display',
    description: 'Displays a single data layer',
    requiresFields: 1,
    supportsGeometryTypes: ['polygon', 'point', 'polyline'],
    supportsLayerTypes: ['index', 'percentage', 'feature-service', 'point'],
    defaultSymbology: {
      colorScheme: 'Blues',
      classes: 5,
      classification: 'quantile'
    },
    aiQueryPatterns: [
      'show {field}',
      'display {layer}',
      'map {data}'
    ]
  },
  [VisualizationType.POINT_LAYER]: {
    label: 'Point Layer Display',
    description: 'Displays point data with styling',
    requiresFields: 1,
    supportsGeometryTypes: ['point'],
    supportsLayerTypes: ['point'],
    defaultSymbology: {
      color: '#0066cc',
      size: 8,
      outlineColor: '#ffffff'
    },
    aiQueryPatterns: [
      'show points for {field}',
      'display {points}',
      'map {point_data}'
    ]
  },
  [VisualizationType.DIFFERENCE]: {
    label: 'Difference Analysis',
    description: 'Shows the numerical difference between two datasets with bidirectional color coding',
    requiresFields: 2,
    supportsGeometryTypes: ['polygon'],
    supportsLayerTypes: ['percentage', 'amount', 'index'],
    defaultSymbology: {
      colorScheme: 'diverging',
      classes: 5,
      centerValue: 0
    },
    aiQueryPatterns: [
      '{field1} versus {field2}',
      'Where is {field1} higher than {field2}',
      'Compare {field1} and {field2}',
      'Difference between {field1} and {field2}',
      '{field1} vs {field2}',
      'Show me {field1} compared to {field2}'
    ]
  }
};

// Options for loading a layer
export interface LayerProviderOptions {
  filters?: any;
  outFields?: string[];
  returnGeometry?: boolean;
  spatialReference?: number;
}

// Options for visualization creation
export interface VisualizationOptions {
  type: VisualizationType;
  fields: string[];
  renderer?: any;
  labelField?: string;
  filter?: string;
  popupTemplate?: any;
  thresholds?: Record<string, number>;
  // Additional options specific to visualization types
  [key: string]: any;
}

export interface QueryOptions {
  outFields?: string[];
  returnGeometry?: boolean;
  spatialReference?: number;
  maxRecordCount?: number;
  orderByFields?: string[];
  resultOffset?: number;
  resultRecordCount?: number;
}

export interface LoadedLayer {
  layerId: string;
  layerName: string;
  esriLayer: any;
  features: any[];
  extent: any;
  layerType: string;
  metrics?: any;
}

export interface LayerField {
  name: string;
  alias: string;
  type: string;
  domain?: any;
  editable?: boolean;
  nullable?: boolean;
  defaultValue?: any;
}

// Dynamic layer provider interface
export interface LayerProvider {
  id: string;
  name: string;
  description: string;
  supportedVisualizationTypes: VisualizationType[];
  load: (options: LayerProviderOptions) => Promise<LoadedLayer>;
  getFields: () => Promise<LayerField[]>;
  executeQuery: (query: string, options?: QueryOptions) => Promise<any>;
  createVisualization: (type: VisualizationType, options: VisualizationOptions) => Promise<any>;
}

// Result of matching a query to layers
export interface LayerMatch {
  layerId: string;
  relevance: number;
  reasons: string[];
  field?: string;
  matchMethod?: 'ai' | 'rules';
  confidence?: number;
  visualizationMode?: string;
  threshold?: string;
  pointLayerId?: string;
  polygonLayerId?: string;
}

/**
 * Layer registry for dynamic configuration
 * Central registry for layer configurations and providers
 */
class LayerRegistry {
  private providers: Map<string, LayerProvider> = new Map();
  private layerConfigs: Map<string, LayerConfig> = new Map();
  
  // Register a layer provider
  registerProvider(provider: LayerProvider): void {
    this.providers.set(provider.id, provider);
  }
  
  // Get a provider by ID
  getProvider(id: string): LayerProvider | undefined {
    return this.providers.get(id);
  }
  
  // Register a layer config
  registerLayerConfig(id: string, config: LayerConfig): void {
    this.layerConfigs.set(id, config);
  }
  
  // Get a layer config by ID
  getLayerConfig(id: string): LayerConfig | undefined {
    return this.layerConfigs.get(id);
  }
  
  // Get all layer configs
  getAllLayerConfigs(): Map<string, LayerConfig> {
    return this.layerConfigs;
  }
  
  // Get all layer configs as array
  getLayerConfigsArray(): LayerConfig[] {
    return Array.from(this.layerConfigs.values());
  }
  
  // Find layers matching criteria
  findLayers(criteria: Partial<LayerConfig>): LayerConfig[] {
    return this.getLayerConfigsArray().filter(config => {
      return Object.entries(criteria).every(([key, value]) => {
        return config[key as keyof LayerConfig] === value;
      });
    });
  }
  
  // Find layer best matching a query using semantic matching
  async findLayerForQuery(query: string): Promise<LayerMatch[]> {
    try {
      // This would be implemented with existing layer matching logic
      // For now, return a placeholder implementation
      const matches: LayerMatch[] = [];
      
      // Simple keyword matching - would be replaced with actual implementation
      const layerConfigs = this.getLayerConfigsArray();
      for (const config of layerConfigs) {
        // Check if any tags or name match keywords in query
        const configName = config.name?.toLowerCase() || '';
        const configDesc = config.description?.toLowerCase() || '';
        const configTags = config.metadata?.tags?.map((t: string) => t.toLowerCase()) || [];
        
        const queryLower = query.toLowerCase();
        const nameMatch = configName && queryLower.includes(configName);
        const descMatch = configDesc && configDesc.split(' ').some(word => 
          queryLower.includes(word) && word.length > 3);
        const tagMatch = configTags.some((tag: string) => 
          queryLower.includes(tag));
        
        if (nameMatch || descMatch || tagMatch) {
          matches.push({
            layerId: String(config.id),
            relevance: nameMatch ? 0.9 : (tagMatch ? 0.7 : 0.5),
            reasons: [
              nameMatch ? `Name match: ${configName}` : '',
              tagMatch ? `Tag match in: ${configTags.join(', ')}` : '',
              descMatch ? 'Description match' : ''
            ].filter(Boolean),
            matchMethod: 'rules',
            confidence: nameMatch ? 0.9 : (tagMatch ? 0.7 : 0.5)
          });
        }
      }
      
      return matches.sort((a, b) => b.relevance - a.relevance);
    } catch (error) {
      console.error('Error in findLayerForQuery:', error);
      return []; // Return empty array on error
    }
  }
  
  // Suggest visualization type based on query and selected layer
  suggestVisualizationType(query: string, layerId: string): VisualizationType {
    const layerConfig = this.getLayerConfig(layerId);
    if (!layerConfig) {
      return VisualizationType.CHOROPLETH; // Default if no config
    }

    // Example: Simple keyword matching for visualization types
    const queryLower = query.toLowerCase();
    for (const [vizType, metadata] of Object.entries(visualizationTypesConfig)) {
      if (metadata.aiQueryPatterns.some(pattern => queryLower.includes(pattern.split(' ')[0]))) {
        // Basic check, more sophisticated NLP would be needed here
        // Also check if layer supports this visualization type
        if (layerConfig.analysis?.supportedVisualizationTypes?.includes(vizType as VisualizationType)) {
          return vizType as VisualizationType;
        }
      }
    }
    
    // Additional specific checks
    if (queryLower.includes('compare') || queryLower.includes('relationship') || 
        queryLower.includes('correlation')) {
      return VisualizationType.CORRELATION;
    }
    
    if (queryLower.includes('trend') || queryLower.includes('change over time')) {
      return VisualizationType.TRENDS;
    }
    
    if (queryLower.includes('both high') || queryLower.includes('joint')) {
      return VisualizationType.JOINT_HIGH;
    }
    
    if (queryLower.includes('heat') || queryLower.includes('density')) {
      return VisualizationType.HEATMAP;
    }
    
    if (queryLower.includes('cluster') || queryLower.includes('group')) {
      return VisualizationType.CLUSTER;
    }
    
    if (queryLower.includes('category') || queryLower.includes('type')) {
      return VisualizationType.CATEGORICAL;
    }
    
    // Default based on geometry type
    const geometryType = layerConfig.geometryType;
    if (geometryType?.toLowerCase() === 'point') {
      return VisualizationType.SCATTER;
    }
    
    // Default fallback
    return VisualizationType.CHOROPLETH;
  }
  
  // Load layer configuration from external source 
  async loadConfigFromSource(source: string): Promise<void> {
    try {
      // This would fetch from API, file, database, etc.
      const configs = await fetch(source).then(res => res.json());
      
      configs.forEach((config: LayerConfig) => {
        this.registerLayerConfig(config.id.toString(), config);
      });
    } catch (error) {
      console.error('Failed to load layer configurations from source:', source, error);
    }
  }
  
  // Initialize with existing layer configs
  initializeWithExistingConfigs(layerConfigs: Record<string, LayerConfig>): void {
    Object.entries(layerConfigs).forEach(([id, config]) => {
      this.registerLayerConfig(id, config);
    });
    console.log(`Initialized registry with ${this.layerConfigs.size} layer configurations`);
  }
}

// Create singleton instance
export const layerRegistry = new LayerRegistry();

// Function to initialize the registry with configs
export async function initializeLayerRegistry(existingConfigs?: Record<string, LayerConfig>, configSource?: string): Promise<void> {
  // If existing configs provided, load them
  if (existingConfigs) {
    layerRegistry.initializeWithExistingConfigs(existingConfigs);
  }
  
  // If config source provided, load from there
  if (configSource) {
    await layerRegistry.loadConfigFromSource(configSource);
  }
  
  // If neither provided, load from baseLayerConfigs imported from config/layers
  if (!existingConfigs && !configSource) {
    const configsAsRecord: Record<string, LayerConfig> = {};
    if (baseLayerConfigs && Array.isArray(baseLayerConfigs)) {
      baseLayerConfigs.forEach(config => {
        if (config && config.id != null) { // Check config and id are not null/undefined
          configsAsRecord[String(config.id)] = config;
        }
      });
    }
    layerRegistry.initializeWithExistingConfigs(configsAsRecord);
  }
}

// Factory for creating layer providers
export class LayerProviderFactory {
  static createProvider(type: string, config: any): LayerProvider {
    switch (type) {
      case 'feature-service':
        return new FeatureServiceProvider(config);
      case 'geojson':
        return new GeoJSONProvider(config);
      case 'virtual':
        return new VirtualLayerProvider(config);
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }
}

// Provider implementation for Feature Services
class FeatureServiceProvider implements LayerProvider {
  id: string;
  name: string;
  description: string;
  supportedVisualizationTypes: VisualizationType[];
  config: any;
  
  constructor(config: any) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.description = config.description || '';
    this.supportedVisualizationTypes = config.supportedVisualizationTypes || Object.values(VisualizationType);
    this.config = config;
  }
  
  async load(options: LayerProviderOptions): Promise<LoadedLayer> {
    // Implementation using the existing executeQuery logic
    // This would be connected to the actual executeQuery in the component
    return {
      layerId: this.id,
      layerName: this.name,
      esriLayer: null, // This would be populated with actual layer
      features: [],
      extent: null,
      layerType: 'feature'
    };
  }
  
  async getFields(): Promise<LayerField[]> {
    // This would be implemented using existing field fetching logic
    return [];
  }
  
  async executeQuery(query: string, options?: QueryOptions): Promise<any> {
    // This would be implemented using existing query execution logic
    return {};
  }
  
  async createVisualization(type: VisualizationType, options: VisualizationOptions): Promise<any> {
    // This would be implemented using visualization creation logic
    return {
      layerId: this.id,
      esriLayer: null, // This would be the actual visualization layer
      extent: null,
      features: []
    };
  }
}

// Provider implementation for GeoJSON
class GeoJSONProvider implements LayerProvider {
  id: string;
  name: string;
  description: string;
  supportedVisualizationTypes: VisualizationType[];
  config: any;
  
  constructor(config: any) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.description = config.description || '';
    this.supportedVisualizationTypes = config.supportedVisualizationTypes || Object.values(VisualizationType);
    this.config = config;
  }
  
  async load(options: LayerProviderOptions): Promise<LoadedLayer> {
    return {
      layerId: this.id,
      layerName: this.name,
      esriLayer: null,
      features: [],
      extent: null,
      layerType: 'geojson'
    };
  }
  
  async getFields(): Promise<LayerField[]> {
    return [];
  }
  
  async executeQuery(query: string, options?: QueryOptions): Promise<any> {
    return {};
  }
  
  async createVisualization(type: VisualizationType, options: VisualizationOptions): Promise<any> {
    return {
      layerId: this.id,
      esriLayer: null,
      extent: null,
      features: []
    };
  }
}

// Provider implementation for Virtual Layers
class VirtualLayerProvider implements LayerProvider {
  id: string;
  name: string;
  description: string;
  supportedVisualizationTypes: VisualizationType[];
  config: any;
  virtualLayers: VirtualLayer[];
  
  constructor(config: any) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.description = config.description || '';
    this.supportedVisualizationTypes = config.supportedVisualizationTypes || Object.values(VisualizationType);
    this.config = config;
    this.virtualLayers = config.virtualLayers || [];
  }
  
  async load(options: LayerProviderOptions): Promise<LoadedLayer> {
    return {
      layerId: this.id,
      layerName: this.name,
      esriLayer: null,
      features: [],
      extent: null,
      layerType: 'virtual'
    };
  }
  
  async getFields(): Promise<LayerField[]> {
    return [];
  }
  
  async executeQuery(query: string, options?: QueryOptions): Promise<any> {
    return {};
  }
  
  async createVisualization(type: VisualizationType, options: VisualizationOptions): Promise<any> {
    return {
      layerId: this.id,
      esriLayer: null,
      extent: null,
      features: []
    };
  }
} 