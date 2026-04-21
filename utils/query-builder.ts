/* eslint-disable no-useless-escape */
import { 
  LayerConfig, 
  LayerField, 
  PointLayerConfig,
  IndexLayerConfig,
  LayerMetadata,
  BaseLayerConfig,
  LayerProcessingConfig,
  LayerCachingConfig,
  LayerPerformanceConfig,
  LayerSecurityConfig
} from '../types/layers';

import { layers } from '@/config/layers';

// Types for query building
export type QueryIntent = 
  | 'high' 
  | 'low' 
  | 'average' 
  | 'all' 
  | 'correlation'
  | 'cluster'
  | 'density'
  | 'temporal'
  | 'proximity'
  | 'aggregation'
  | 'overlay'
  | 'buffer'
  | 'network'
  | 'bivariate'
  | 'multivariate'
  | 'trends';
export type QueryOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL' | 'BETWEEN';

// Add type definitions
export type LayerType = 'point' | 'polygon' | 'polyline' | 'index';

// Make extended config properties optional
interface ExtendedConfig {
  processing?: LayerProcessingConfig;
  caching?: LayerCachingConfig;
  performance?: LayerPerformanceConfig;
  security?: LayerSecurityConfig;
}

interface QueryConfig {
  layerId: string;
  intent?: QueryIntent;
  limit?: number;
  whereClause?: string;
}

interface FieldRangeResult {
  min: number;
  max: number;
}

export class QueryBuilder {
  private readonly DEFAULT_LIMIT = 100;
  private readonly DEFAULT_THRESHOLD = 50;
  private layers: Record<string, LayerConfig>;

  constructor(layers: Record<string, LayerConfig>) {
    this.layers = layers;
  }

  /**
   * Type guard for point layers
   */
  private isPointLayer(layer: LayerConfig): boolean {
    return layer.type === 'point';
  }

  /**
   * Type guard for index layers
   */
  private isIndexLayer(layer: LayerConfig): boolean {
    return layer.type === 'index';
  }

  /**
   * Safe accessor for layer metadata
   */
  private getMetadata(layer: LayerConfig): LayerMetadata | undefined {
    return layer.metadata;
  }

  /**
   * Safe accessor for layer fields
   */
  private getFields(layer: LayerConfig): LayerField[] | undefined {
    return 'fields' in layer ? layer.fields : undefined;
  }

  /**
   * Safe accessor for layer renderer field
   */
  private getRendererField(layer: LayerConfig): string | undefined {
    return 'rendererField' in layer ? layer.rendererField : undefined;
  }

  /**
   * Get metadata tags for a layer
   */
  private getLayerTags(layer: LayerConfig): string[] {
    const metadata = this.getMetadata(layer);
    return metadata?.tags || [];
  }

  /**
   * Get geometry type for a layer
   */
  private getGeometryType(layer: LayerConfig): string | undefined {
    const metadata = this.getMetadata(layer);
    return metadata?.geometryType;
  }

  /**
   * Get value type for a layer
   */
  private getValueType(layer: LayerConfig): string | undefined {
    const metadata = this.getMetadata(layer);
    return metadata?.valueType;
  }

  /**
   * Builds a query based on configuration
   */
  public buildQuery(query: string, layerId: string): any {
    // Basic implementation - can be expanded based on needs
    return {
      where: "1=1",
      returnGeometry: true,
      outFields: ["*"]
    };
  }

  /**
   * Builds a field-specific query clause
   */
  public buildFieldQuery(
    layerId: string, 
    fieldName: string, 
    operator: QueryOperator, 
    value: any
  ): string {
    const layer = this.layers[layerId];
    if (!layer) {
      throw new Error(`Layer ${layerId} not found`);
    }

    // Validate field exists
    const field = layer.fields.find(f => f.name === fieldName);
    if (!field) {
      throw new Error(`Field ${fieldName} not found in layer ${layerId}`);
    }

    // Format value based on field type
    const formattedValue = this.formatValueForType(value, field.type);

    // Build clause with proper ArcGIS SQL formatting
    return this.buildClause(fieldName, operator, formattedValue);
  }

  /**
   * Gets valid range for a numeric field
   */
  public async getFieldRange(layerId: string, fieldName: string): Promise<FieldRangeResult> {
    const layer = this.layers[layerId];
    if (!layer) {
      throw new Error(`Layer ${layerId} not found`);
    }

    // Create statistics query
    const query = {
      f: 'json',
      where: '1=1',
      returnGeometry: false,
      outStatistics: JSON.stringify([
        {
          statisticType: 'min',
          onStatisticField: fieldName,
          outStatisticFieldName: 'min_value'
        },
        {
          statisticType: 'max',
          onStatisticField: fieldName,
          outStatisticFieldName: 'max_value'
        }
      ])
    };

    try {
      const params = new URLSearchParams({
        ...query,
        returnGeometry: query.returnGeometry.toString()
      });
      const response = await fetch(`${layer.url}/query?${params}`);
      const data = await response.json();

      if (data.features?.[0]?.attributes) {
        return {
          min: data.features[0].attributes.min_value,
          max: data.features[0].attributes.max_value
        };
      }

      throw new Error('Invalid statistics response');
    } catch (error) {
      console.error('Error getting field range:', error);
      return { min: 0, max: 200 }; // Safe fallback
    }
  }

  /**
   * Extracts numeric limit from question text
   */
  public parseLimit(question: string): number {
    const matches = question.match(/(?:top|highest|best)\s+(\d+)/i);
    if (matches && matches[1]) {
      const count = parseInt(matches[1], 10);
      return Math.min(Math.max(count, 1), 50); // Min 1, Max 50
    }
    return this.DEFAULT_LIMIT;
  }

  /**
   * Enhanced isLocationQuery to use layer metadata
   */
  public isLocationQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const locationKeywords = new Set<string>();
    
    // Build keywords from layer metadata
    Object.values(this.layers).forEach(layer => {
      const metadata = this.getMetadata(layer);
      if (metadata) {
        // Add terms from geometry type
        if (metadata.geometryType === 'point') {
          locationKeywords.add('location');
          locationKeywords.add('place');
          locationKeywords.add('site');
        }

        // Add terms from tags
        metadata.tags?.forEach(tag => {
          if (tag.includes('location') || tag.includes('place') || tag.includes('site')) {
            tag.toLowerCase().split(/[\s-]+/).forEach(term => locationKeywords.add(term));
          }
        });
      }
    });

    // Add common location query terms
    const commonLocationTerms = [
      'where is', 'where are',
      'find',
      'show me where',
      'location', 'locations',
      'place', 'places',
      'site', 'sites'
    ];
    commonLocationTerms.forEach(term => locationKeywords.add(term));
    
    return Array.from(locationKeywords).some(keyword => lower.includes(keyword));
  }

  /**
   * Enhanced isAreaQuery to use layer metadata
   */
  public isAreaQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const areaKeywords = new Set<string>();
    
    // Build keywords from layer metadata
    Object.values(this.layers).forEach(layer => {
      const metadata = this.getMetadata(layer);
      if (metadata) {
        // Add terms from geometry type
        if (metadata.geometryType === 'polygon') {
          areaKeywords.add('area');
          areaKeywords.add('region');
          areaKeywords.add('zone');
        }

        // Add terms from value type
        if (metadata.valueType) {
          areaKeywords.add(metadata.valueType);
        }

        // Add terms from tags
        metadata.tags?.forEach(tag => {
          if (tag.includes('area') || tag.includes('region') || tag.includes('zone')) {
            tag.toLowerCase().split(/[\s-]+/).forEach(term => areaKeywords.add(term));
          }
        });
      }
    });

    // Add common area query terms
    const commonAreaTerms = [
      'index',
      'rate',
      'level',
      'score',
      'value',
      'areas with',
      'regions with',
      'zones with'
    ];
    commonAreaTerms.forEach(term => areaKeywords.add(term));
    
    return Array.from(areaKeywords).some(keyword => lower.includes(keyword));
  }

  /**
   * Detects if the query is looking for correlations between variables
   */
  public isCorrelationQuery(question: string): boolean {
    const lower = question.toLowerCase();
    
    // First check if this is a simple display/distribution query
    if (/^(?:show|display|visualize|map)\s+(?:the\s+)?(?:me\s+)?.*(?:pattern|distribution)/i.test(lower)) {
      return false;
    }
    
    const correlationKeywords = [
      'correlation',
      'relationship between',
      'versus',
      'vs.',
      'compared to',
      'compare with',
      'increases with',
      'decreases with',
      'affects',
      'impact on',
      'influence on',
      'associated with'
    ];
    
    // Check for explicit correlation keywords
    const hasCorrelationKeyword = correlationKeywords.some(keyword => lower.includes(keyword));
    
    // Check for "A vs B" or "between A and B" patterns
    const hasComparisonPattern = 
      /\b\w+\s+(?:vs\.?|versus)\s+\w+\b/i.test(lower) ||
      /\b(?:between|relating)\s+\w+\s+and\s+\w+\b/i.test(lower);
    
    return hasCorrelationKeyword || hasComparisonPattern;
  }

  /**
   * Detects if the query is looking for clusters or patterns
   */
  public isClusterQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const clusterKeywords = [
      'cluster',
      'clusters',
      'grouping',
      'groupings',
      'concentration',
      'concentrations',
      'pattern',
      'patterns',
      'hotspot',
      'hotspots',
      'cold spot',
      'cold spots',
      'grouped',
      'similar areas',
      'similar regions'
    ];
    
    return clusterKeywords.some((keyword: string) => lower.includes(keyword));
  }

  /**
   * Detects if the query is looking for density analysis
   */
  public isDensityQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const densityKeywords = [
      'density',
      'concentration',
      'per square mile',
      'per capita',
      'distribution',
      'spread',
      'dispersed',
      'concentrated',
      'per person',
      'per household',
      'intensity'
    ];
    
    return densityKeywords.some((keyword: string) => lower.includes(keyword));
  }

  /**
   * Detects if the query involves temporal/change analysis
   */
  public isTemporalQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const temporalKeywords = [
      'change',
      'over time',
      'trend',
      'growth',
      'decline',
      'historical',
      'since',
      'between years',
      'year over year',
      'annual',
      'monthly',
      'seasonal',
      'previous',
      'past',
      'future'
    ];
    
    // Check for temporal keywords
    const hasTemporalKeyword = temporalKeywords.some((keyword: string) => lower.includes(keyword));
    
    // Check for year patterns (e.g., "2010", "2010-2020")
    const hasYearPattern = /\b(19|20)\d{2}(-|(to)|\s+vs\.?\s+)?(19|20)\d{2}\b/.test(lower);
    
    return hasTemporalKeyword || hasYearPattern;
  }

  /**
   * Detects if the query involves proximity/distance analysis
   */
  public isProximityQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const proximityKeywords = [
      'near',
      'within',
      'distance',
      'radius',
      'closest',
      'nearest',
      'furthest',
      'farthest',
      'adjacent',
      'surrounding',
      'proximity',
      'miles from',
      'kilometers from',
      'meters from',
      'close to',
      'far from'
    ];
    
    // Check for proximity keywords
    const hasProximityKeyword = proximityKeywords.some((keyword: string) => lower.includes(keyword));
    
    // Check for distance patterns (e.g., "5 miles", "10 km")
    const hasDistancePattern = /\b\d+\s*(mile|km|kilometer|meter)s?\b/i.test(lower);
    
    return hasProximityKeyword || hasDistancePattern;
  }

  /**
   * Detects if the query is looking for aggregated/summarized data by area
   */
  public isAggregationQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const aggregationKeywords = [
      'total',
      'sum',
      'average by',
      'grouped by',
      'summarize by',
      'aggregate',
      'aggregated',
      'summary by',
      'breakdown by',
      'distribution across',
      'per region',
      'by zip code',
      'by county',
      'by area',
      'by district'
    ];
    
    // Check for aggregation keywords
    const hasAggregationKeyword = aggregationKeywords.some((keyword: string) => lower.includes(keyword));
    
    // Check for aggregation patterns (e.g., "total X by Y")
    const hasAggregationPattern = /\b(total|sum|average|mean)\s+\w+\s+by\s+\w+\b/i.test(lower);
    
    return hasAggregationKeyword || hasAggregationPattern;
  }

  /**
   * Detects if the query is looking for overlay/intersection analysis
   */
  public isOverlayQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const overlayKeywords = [
      'overlap',
      'overlapping',
      'intersect',
      'intersection',
      'both',
      'combined',
      'where both exist',
      'areas with both',
      'regions with both',
      'coincide',
      'concurrent',
      'shared areas',
      'common areas',
      'overlap between'
    ];
    
    // Check for overlay keywords
    const hasOverlayKeyword = overlayKeywords.some((keyword: string) => lower.includes(keyword));
    
    // Check for "both A and B" patterns
    const hasBothPattern = /\b(areas?|regions?|zones?)\s+with\s+both\s+\w+\s+and\s+\w+\b/i.test(lower);
    
    return hasOverlayKeyword || hasBothPattern;
  }

  /**
   * Detects if the query is looking for buffer/zone analysis
   */
  public isBufferQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const bufferKeywords = [
      'buffer zone',
      'buffer area',
      'catchment area',
      'service area',
      'coverage zone',
      'trade area',
      'influence area',
      'surrounding area',
      'coverage radius',
      'service radius',
      'market area',
      'capture zone'
    ];
    
    // Check for buffer keywords
    const hasBufferKeyword = bufferKeywords.some((keyword: string) => lower.includes(keyword));
    
    // Check for buffer patterns (e.g., "X-mile zone around Y")
    const hasBufferPattern = /\b\d+\s*(mile|km|kilometer|meter)s?\s+(zone|area|radius)\s+around\b/i.test(lower);
    
    return hasBufferKeyword || hasBufferPattern;
  }

  /**
   * Detects if the query involves network analysis
   */
  public isNetworkQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const networkKeywords = [
      'route',
      'path',
      'accessibility',
      'connected',
      'reachable',
      'network',
      'travel time',
      'drive time',
      'walking distance',
      'connectivity',
      'shortest path',
      'optimal route',
      'navigation',
      'travel distance',
      'service coverage'
    ];
    
    // Check for network keywords
    const hasNetworkKeyword = networkKeywords.some((keyword: string) => lower.includes(keyword));
    
    // Check for time/distance patterns (e.g., "15 minute drive", "30 min walk")
    const hasTimePattern = /\b\d+\s*(minute|hour)s?\s+(drive|walk|travel|trip)\b/i.test(lower);
    
    return hasNetworkKeyword || hasTimePattern;
  }

  /**
   * Detects if the query is looking for bivariate relationships
   */
  public isBivariateQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const bivariateKeywords = [
      'bivariate',
      'two variables',
      'dual variable',
      'combined analysis',
      'simultaneous analysis',
      'joint distribution',
      'cross analysis',
      'relationship between',
      'intersection of',
      'both variables',
      'together with',
      'in relation to',
      'mapped against',
      'plotted against',
      'matrix of'
    ];
    
    // Check for bivariate keywords
    const hasBivariateKeyword = bivariateKeywords.some((keyword: string) => lower.includes(keyword));
    
    // Check for patterns indicating two variables being analyzed together
    const hasTwoVariablePattern = /\b(map|show|display|analyze|analyse|compare)\s+\w+\s+(and|vs\.?|versus|with|against)\s+\w+\s+(together|simultaneously|jointly|combined)\b/i.test(lower);
    
    return hasBivariateKeyword || hasTwoVariablePattern;
  }

  /**
   * Detects if the query is looking for multivariate relationships
   */
  public isMultivariateQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const multivariateKeywords = [
      'multivariate',
      'multiple variables',
      'multiple factors',
      'multiple indicators',
      'several variables',
      'many variables',
      'combined factors',
      'multiple dimensions',
      'multi-dimensional',
      'multiple characteristics',
      'multiple metrics',
      'multiple measures',
      'multiple attributes',
      'complex relationship',
      'interrelated factors'
    ];
    
    // Check for multivariate keywords
    const hasMultivariateKeyword = multivariateKeywords.some((keyword: string) => lower.includes(keyword));
    
    // Check for patterns indicating multiple variables
    const hasMultipleVariablePattern = /\b(analyze|compare|show|map|visualize)\s+\w+,\s+\w+(?:\s*,\s*\w+){1,}\s+together\b/i.test(lower);
    
    // Check for enumeration of three or more variables
    const hasEnumerationPattern = /\b(between|among|across)\s+\w+,\s+\w+(?:\s*,\s*\w+){1,}\b/i.test(lower);
    
    return hasMultivariateKeyword || hasMultipleVariablePattern || hasEnumerationPattern;
  }

  /**
   * Detects if the query is looking for trends analysis
   */
  public isTrendsQuery(question: string): boolean {
    const lower = question.toLowerCase();
    const trendsKeywords = [
      'trend',
      'trending',
      'popularity',
      'interest over time',
      'search volume',
      'google trends',
      'search interest',
      'search trends',
      'trend analysis',
      'trending topics',
      'trending searches',
      'search popularity',
      'search volume trends',
      'interest trends'
    ];
    
    // Check for trends keywords
    const hasTrendsKeyword = trendsKeywords.some((keyword: string) => lower.includes(keyword));
    
    // Check for patterns indicating trends analysis
    const hasTrendsPattern = /\b(show|display|visualize|map)\s+(?:the\s+)?(?:search\s+)?trends?\s+(?:for|of|in)\s+(\w+)/i.test(lower);
    
    return hasTrendsKeyword || hasTrendsPattern;
  }

  /**
   * Detects query intent from question text
   */
  public parseIntent(question: string): QueryIntent {
    const lower = question.toLowerCase();
    
    // Check for specialized analysis types first
    if (this.isTrendsQuery(lower)) {
      return 'trends';
    }
    if (this.isMultivariateQuery(lower)) {
      return 'multivariate';
    }
    if (this.isBivariateQuery(lower)) {
      return 'bivariate';
    }
    if (this.isCorrelationQuery(lower)) {
      return 'correlation';
    }
    if (this.isClusterQuery(lower)) {
      return 'cluster';
    }
    if (this.isDensityQuery(lower)) {
      return 'density';
    }
    if (this.isTemporalQuery(lower)) {
      return 'temporal';
    }
    if (this.isProximityQuery(lower)) {
      return 'proximity';
    }
    if (this.isAggregationQuery(lower)) {
      return 'aggregation';
    }
    if (this.isOverlayQuery(lower)) {
      return 'overlay';
    }
    if (this.isBufferQuery(lower)) {
      return 'buffer';
    }
    if (this.isNetworkQuery(lower)) {
      return 'network';
    }
    
    // Then check if this is a location query
    if (this.isLocationQuery(lower)) {
      // For location queries, default to 'all' unless explicitly filtered
      if (lower.includes('high') || lower.includes('top') || lower.includes('best')) {
        return 'high';
      }
      if (lower.includes('low') || lower.includes('bottom') || lower.includes('worst')) {
        return 'low';
      }
      return 'all';
    }
    
    // For area-based queries, use standard intent detection
    if (lower.includes('high') || lower.includes('top') || lower.includes('best')) {
      return 'high';
    }
    if (lower.includes('low') || lower.includes('bottom') || lower.includes('worst')) {
      return 'low';
    }
    if (lower.includes('average') || lower.includes('median') || lower.includes('middle')) {
      return 'average';
    }
    return 'all';
  }

  private buildIntentClause(field: string, intent: QueryIntent): string {
    switch (intent) {
      case 'high':
        return this.buildClause(field, '>=', this.DEFAULT_THRESHOLD);
      case 'low':
        return this.buildClause(field, '<', this.DEFAULT_THRESHOLD);
      case 'average':
        return this.buildClause(field, 'BETWEEN', [
          this.DEFAULT_THRESHOLD - 10, 
          this.DEFAULT_THRESHOLD + 10
        ]);
      default:
        return '1=1';
    }
  }

  private buildClause(field: string, operator: QueryOperator, value: any): string {
    // Handle special operators
    switch (operator) {
      case 'IS NULL':
      case 'IS NOT NULL':
        return `"${field}" ${operator}`;
      case 'BETWEEN':
        if (Array.isArray(value) && value.length === 2) {
          return `"${field}" BETWEEN ${value[0]} AND ${value[1]}`;
        }
        throw new Error('BETWEEN operator requires array of two values');
      case 'IN':
        if (Array.isArray(value)) {
          const values = value.map((v: any) => this.formatValueForType(v, typeof v));
          return `"${field}" IN (${values.join(', ')})`;
        }
        throw new Error('IN operator requires array of values');
      default:
        return `"${field}" ${operator} ${value}`;
    }
  }

  private addFieldValidation(clause: string, field: string): string {
    return clause === '1=1' ? 
      `"${field}" IS NOT NULL` : 
      `(${clause}) AND "${field}" IS NOT NULL`;
  }

  private formatValueForType(value: any, type: string): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    switch (type.toLowerCase()) {
      case 'string':
      case 'text':
        return `'${value.toString().replace(/'/g, "''")}'`; // Escape single quotes
      case 'number':
      case 'integer':
      case 'double':
      case 'float':
        return isNaN(Number(value)) ? 'NULL' : value.toString();
      case 'date':
      case 'datetime':
        if (value instanceof Date) {
          return `timestamp '${value.toISOString()}'`;
        }
        return `timestamp '${value}'`;
      case 'boolean':
        return value ? '1' : '0';
      default:
        console.warn(`Unknown type ${type}, treating as string`);
        return `'${value.toString().replace(/'/g, "''")}'`;
    }
  }

  // Add method to identify 3D visualization queries
  is3DVisualizationQuery(question: string): boolean {
    const keywords = [
      '3d',
      'three dimensional',
      'height represents',
      'height shows',
      'cylinders',
      'cubes',
      'spheres',
      'cones'
    ];

    const dimensionKeywords = [
      'height',
      'width',
      'size',
      'color',
      'represents',
      'shows'
    ];

    // Check if the question contains 3D visualization keywords
    const has3DKeyword = keywords.some((keyword: string) => 
      question.toLowerCase().includes(keyword.toLowerCase())
    );

    // Check if the question mentions multiple dimensions
    const dimensionCount = dimensionKeywords.reduce((count: number, keyword: string) => 
      count + (question.toLowerCase().match(new RegExp(keyword, 'g')) || []).length, 0
    );

    return has3DKeyword || dimensionCount >= 3;
  }

  // Add method to extract 3D visualization parameters
  extract3DVisualizationParams(question: string): {
    symbolType?: '3d-cylinder' | '3d-cube' | '3d-cone' | '3d-sphere';
    heightField?: string;
    colorField?: string;
    sizeField?: string;
  } {
    const symbolTypes = {
      'cylinder': '3d-cylinder',
      'cube': '3d-cube',
      'cone': '3d-cone',
      'sphere': '3d-sphere'
    } as const;

    // Default to cylinder if no specific type mentioned
    let symbolType: '3d-cylinder' | '3d-cube' | '3d-cone' | '3d-sphere' = '3d-cylinder';

    // Determine symbol type from question
    for (const [keyword, type] of Object.entries(symbolTypes)) {
      if (question.toLowerCase().includes(keyword)) {
        symbolType = type;
        break;
      }
    }

    // Field mappings for common terms to actual field names
    const fieldMappings: Record<string, string> = {
      'diversity index': 'DIVINDX_CY',
      'diversity': 'DIVINDX_CY',
      'organic food consumption': 'MP12001H_B_I',
      'organic food': 'MP12001H_B_I',
      'high school enrollment': 'ACSPUBGRD9_P',
      'high school': 'ACSPUBGRD9_P',
      'school enrollment': 'ACSPUBGRD9_P'
    };

    // Extract field mappings from question using more flexible patterns
    const heightPatterns = [
      /height (?:represents|shows|indicates|displays|based on|using) (?:the )?([^,\.]+)/i,
      /([^,\.]+) determines (?:the )?height/i,
      /([^,\.]+) for height/i,
      /height of (?:the )?([^,\.]+)/i
    ];

    const colorPatterns = [
      /color (?:represents|shows|indicates|displays|based on|using) (?:the )?([^,\.]+)/i,
      /([^,\.]+) determines (?:the )?color/i,
      /([^,\.]+) for color/i,
      /color(?:ed)? by (?:the )?([^,\.]+)/i
    ];

    const sizePatterns = [
      /(?:width|size) (?:represents|shows|indicates|displays|based on|using) (?:the )?([^,\.]+)/i,
      /([^,\.]+) determines (?:the )?(?:width|size)/i,
      /([^,\.]+) for (?:width|size)/i,
      /(?:width|size) of (?:the )?([^,\.]+)/i
    ];

    // Try each pattern until we find a match
    const findField = (patterns: RegExp[]): string | undefined => {
      for (const pattern of patterns) {
        const match = question.match(pattern);
        if (match) {
          // Clean up the field name
          const rawField = match[1].trim().toLowerCase();
          
          // Try exact match first
          if (fieldMappings[rawField]) {
            return fieldMappings[rawField];
          }
          
          // Try partial matches
          for (const [term, fieldName] of Object.entries(fieldMappings)) {
            if (rawField.includes(term) || term.includes(rawField)) {
              return fieldName;
            }
          }
        }
      }
      return undefined;
    };

    const heightField = findField(heightPatterns);
    const colorField = findField(colorPatterns);
    const sizeField = findField(sizePatterns);

    console.log('Extracted 3D parameters:', {
      originalQuestion: question,
      heightField,
      colorField,
      sizeField,
      symbolType
    });

    return {
      symbolType,
      heightField,
      colorField,
      sizeField
    };
  }

  // Helper to normalize field names
  private normalizeFieldName(fieldName: string): string {
    const fieldMappings: Record<string, string> = {
      'diversity index': 'DIV_IDX',
      'organic food consumption': 'ORG_FOOD',
      'high school enrollment': 'HS_ENR',
      // Add more mappings as needed
    };

    const normalized = fieldName.toLowerCase();
    return fieldMappings[normalized] || normalized;
  }

  /**
   * Get relevant fields for a layer based on query context
   */
  public getRelevantFields(layerId: string, queryContext: {
    isLocation?: boolean;
    isArea?: boolean;
    isDemographic?: boolean;
    isRetail?: boolean;
  }): string[] {
    const layer = this.layers[layerId];
    const fields = this.getFields(layer);
    if (!layer || !fields) return [];

    const relevantFields = new Set<string>();

    // Add renderer field if available
    const rendererField = this.getRendererField(layer);
    if (rendererField) {
      relevantFields.add(rendererField);
    }

    // Add fields based on metadata
    const metadata = this.getMetadata(layer);
    if (metadata) {
      // Add fields based on value type
      if (metadata.valueType) {
        fields.forEach(field => {
          if (field.name.toLowerCase().includes(metadata.valueType!)) {
            relevantFields.add(field.name);
          }
        });
      }

      // Add fields based on tags
      metadata.tags?.forEach(tag => {
        fields.forEach(field => {
          if (field.name.toLowerCase().includes(tag.toLowerCase())) {
            relevantFields.add(field.name);
          }
        });
      });
    }

    // Add fields based on query context
    fields.forEach(field => {
      const fieldLower = field.name.toLowerCase();
      const labelLower = field.label?.toLowerCase() || '';

      if (queryContext.isLocation && this.getGeometryType(layer) === 'point') {
        if (fieldLower.includes('address') || fieldLower.includes('location')) {
          relevantFields.add(field.name);
        }
      }

      if (queryContext.isArea && this.getGeometryType(layer) === 'polygon') {
        if (fieldLower.includes('index') || fieldLower.includes('rate')) {
          relevantFields.add(field.name);
        }
      }

      if (queryContext.isDemographic) {
        // Updated check: Look for specific known demographic fields from FED_data
        const knownDemographicFields = [
          'ECYHTYHHD', // Households
          'ECYVISVM',  // Visible Minority Population (Count)
          'ECYVISVM_P',// Visible Minority Population (%)
          'ECYHNIMED', // Median Household Income
          'ECYPTAMED', // Median Age
          'ECYACTER',  // Employment Rate
          'ECYEDAUD',  // Bachelor Degree Pop (Count)
          'ECYEDAUD_P' // Bachelor Degree Pop (%)
          // Add other relevant ECY fields if necessary
        ];
        // Also keep the income check as it's general
        if (knownDemographicFields.includes(field.name) || fieldLower.includes('income')) {
          relevantFields.add(field.name);
        }
      }

      if (queryContext.isRetail) {
        if (fieldLower.includes('sales') || labelLower.includes('store')) {
          relevantFields.add(field.name);
        }
      }
    });

    return Array.from(relevantFields);
  }
}