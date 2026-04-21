import { VisualizationType } from './dynamic-layers';

export interface VisualizationMapping {
  queryType: string;
  visualizationTypes: VisualizationType[];
  description: string;
  exampleQueries: string[];
  requiredFields: number;
  supportedGeometryTypes: string[];
  defaultOptions: {
    opacity: number;
    showLegend: boolean;
    showLabels: boolean;
    clusteringEnabled: boolean;
  };
}

export const visualizationMappings: VisualizationMapping[] = [
  {
    queryType: 'correlation',
    visualizationTypes: [
      VisualizationType.CORRELATION,
      VisualizationType.BIVARIATE,
      VisualizationType.MULTIVARIATE,
      VisualizationType.CROSS_GEOGRAPHY_CORRELATION
    ],
    description: 'Analyzes relationships between multiple variables',
    exampleQueries: [
      'How does income level correlate with conversion rates?',
      'Show me the relationship between education and mortgage approvals',
      'What is the correlation between population density and housing prices?'
    ],
    requiredFields: 2,
    supportedGeometryTypes: ['polygon', 'point'],
    defaultOptions: {
      opacity: 0.8,
      showLegend: true,
      showLabels: true,
      clusteringEnabled: false
    }
  },
  {
    queryType: 'distribution',
    visualizationTypes: [
      VisualizationType.CHOROPLETH,
      VisualizationType.HEATMAP,
      VisualizationType.HEXBIN,
      VisualizationType.DENSITY,
      VisualizationType.CLUSTER
    ],
    description: 'Shows patterns and distributions of data across geographic areas',
    exampleQueries: [
      'Show me the distribution of high-income areas',
      'Where are the hotspots of mortgage applications?',
      'Display the density of first-time homebuyers'
    ],
    requiredFields: 1,
    supportedGeometryTypes: ['polygon', 'point'],
    defaultOptions: {
      opacity: 0.7,
      showLegend: true,
      showLabels: false,
      clusteringEnabled: true
    }
  },
  {
    queryType: 'ranking',
    visualizationTypes: [
      VisualizationType.TOP_N,
      VisualizationType.COMPARISON,
      VisualizationType.PROPORTIONAL_SYMBOL
    ],
    description: 'Compares values or identifies top/bottom performing areas',
    exampleQueries: [
      'Which areas have the highest conversion rates?',
      'Show me the top 10 performing branches',
      'Compare mortgage approval rates across regions'
    ],
    requiredFields: 1,
    supportedGeometryTypes: ['polygon', 'point'],
    defaultOptions: {
      opacity: 0.9,
      showLegend: true,
      showLabels: true,
      clusteringEnabled: false
    }
  },
  {
    queryType: 'temporal',
    visualizationTypes: [
      VisualizationType.TRENDS,
      VisualizationType.TIME_SERIES
    ],
    description: 'Analyzes changes and patterns over time',
    exampleQueries: [
      'How have conversion rates changed over time?',
      'Show me the trend in mortgage applications',
      'Display monthly approval rate changes'
    ],
    requiredFields: 2,
    supportedGeometryTypes: ['polygon', 'point'],
    defaultOptions: {
      opacity: 0.8,
      showLegend: true,
      showLabels: true,
      clusteringEnabled: false
    }
  },
  {
    queryType: 'spatial',
    visualizationTypes: [
      VisualizationType.BUFFER,
      VisualizationType.PROXIMITY,
      VisualizationType.NETWORK,
      VisualizationType.FLOW
    ],
    description: 'Analyzes spatial relationships and patterns',
    exampleQueries: [
      'Show me areas within 5km of high-performing branches',
      'What is the proximity to major highways?',
      'Display the network of mortgage applications'
    ],
    requiredFields: 2,
    supportedGeometryTypes: ['polygon', 'point', 'polyline'],
    defaultOptions: {
      opacity: 0.7,
      showLegend: true,
      showLabels: false,
      clusteringEnabled: true
    }
  },
  {
    queryType: 'composite',
    visualizationTypes: [
      VisualizationType.COMPOSITE,
      VisualizationType.OVERLAY,
      VisualizationType.AGGREGATION
    ],
    description: 'Combines multiple analysis types for complex insights',
    exampleQueries: [
      'Show me high-income areas with good conversion rates near major highways',
      'Display areas with both high education and high mortgage approvals',
      'Combine population density with income levels'
    ],
    requiredFields: 3,
    supportedGeometryTypes: ['polygon', 'point'],
    defaultOptions: {
      opacity: 0.8,
      showLegend: true,
      showLabels: true,
      clusteringEnabled: false
    }
  },
  {
    queryType: 'joint_high',
    visualizationTypes: [
      VisualizationType.JOINT_HIGH,
      VisualizationType.HOTSPOT
    ],
    description: 'Identifies areas meeting multiple high-value criteria',
    exampleQueries: [
      'Show areas where both income and education are above average',
      'Find regions with high population and high conversion rates',
      'Display areas with both high income and high mortgage approvals'
    ],
    requiredFields: 2,
    supportedGeometryTypes: ['polygon', 'point'],
    defaultOptions: {
      opacity: 0.8,
      showLegend: true,
      showLabels: true,
      clusteringEnabled: false
    }
  },
  {
    queryType: 'difference',
    visualizationTypes: [
      VisualizationType.DIFFERENCE
    ],
    description: 'Shows the numerical difference between two datasets with bidirectional color coding',
    exampleQueries: [
      'Where is Nike spending higher than Adidas?',
      'Show me Nike versus New Balance market share differences',
      'Where does Jordan outperform Converse?',
      'Compare Nike vs Puma - show me the differences',
      'Where is Adidas stronger than Nike?'
    ],
    requiredFields: 2,
    supportedGeometryTypes: ['polygon'],
    defaultOptions: {
      opacity: 0.8,
      showLegend: true,
      showLabels: true,
      clusteringEnabled: false
    }
  },
  {
    queryType: 'single_layer',
    visualizationTypes: [
      VisualizationType.SINGLE_LAYER,
      VisualizationType.POINT_LAYER,
      VisualizationType.CATEGORICAL
    ],
    description: 'Analyzes a single metric or category',
    exampleQueries: [
      'Show me the conversion rates across all areas',
      'Display mortgage application counts',
      'Show income levels by region'
    ],
    requiredFields: 1,
    supportedGeometryTypes: ['polygon', 'point'],
    defaultOptions: {
      opacity: 0.9,
      showLegend: true,
      showLabels: false,
      clusteringEnabled: true
    }
  }
]; 