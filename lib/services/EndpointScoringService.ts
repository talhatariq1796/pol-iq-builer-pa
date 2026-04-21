import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Point from "@arcgis/core/geometry/Point";

// Market Intelligence Dataset URL (hosted on Vercel blob storage - Energy project)
const MARKET_INTELLIGENCE_DATASET_URL = '""';

interface EndpointData {
  overall_score?: number;
  confidence_score?: number;
  recommendation?: string;
  aggregation_info?: {
    source_count: number;
    aggregation_method: string;
    total_population: number;
    confidence_adjustment: number;
  };
  demographic_breakdown?: string | Record<string, unknown>;
  feature_importance?: Array<{
    feature_name?: string;
    name?: string;
    importance_score?: number;
    importance?: number;
    rank?: number;
  }>;
  population?: number;
  total_population?: number;
  households?: number;
  total_households?: number;
  median_income?: number;
  median_age?: number;
  average_household_size?: number;
  score?: number;
  confidence?: number;
  summary?: string;
  description?: string;
  coordinates?: [number, number];
  longitude?: number;
  latitude?: number;
  lng?: number;
  lat?: number;
  [key: string]: unknown;
}

interface EndpointConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'single-score' | 'hybrid' | 'detailed-breakdown';
  color: string;
  primaryScoreField?: string;
  detailFields?: string[];
}

// Endpoint configuration matching the implementation plan
export const ENDPOINT_CONFIGS: EndpointConfig[] = [
  {
    id: 'strategic-analysis',
    name: 'Strategic Analysis',
    description: 'Overall strategic positioning and market opportunity',
    icon: 'target',
    type: 'single-score',
    color: 'green',
    primaryScoreField: 'strategic_score'
  },
  {
    id: 'brand-difference',
    name: 'Brand Differentiation',
    description: 'Unique positioning and competitive advantage',
    icon: 'zap',
    type: 'single-score',
    color: 'red',
    primaryScoreField: 'brand_difference_score'
  },
  {
    id: 'competitive-analysis',
    name: 'Competitive Analysis',
    description: 'Market competition and positioning strength',
    icon: 'shield',
    type: 'single-score',
    color: 'red',
    primaryScoreField: 'competitive_score'
  },
  {
    id: 'trend-analysis',
    name: 'Trend Analysis',
    description: 'Market trends and future opportunities',
    icon: 'trending-up',
    type: 'single-score',
    color: 'green',
    primaryScoreField: 'trend_score'
  },
  {
    id: 'predictive-modeling',
    name: 'Predictive Modeling',
    description: 'Future performance predictions',
    icon: 'bar-chart-3',
    type: 'single-score',
    color: 'gray',
    primaryScoreField: 'prediction_score'
  },
  {
    id: 'customer-profile',
    name: 'Customer Profile',
    description: 'Target customer characteristics and behavior',
    icon: 'users',
    type: 'hybrid',
    color: 'gray',
    primaryScoreField: 'thematic_value',
    detailFields: ['demographic_breakdown', 'spending_patterns']
  },
  {
    id: 'scenario-analysis',
    name: 'Resilience Analysis',
    description: 'Risk assessment and scenario planning',
    icon: 'shield',
    type: 'hybrid',
    color: 'red',
    primaryScoreField: 'scenario_score',
    detailFields: ['stress_test_results', 'risk_factors', 'recovery_metrics']
  },
  {
    id: 'demographic-insights',
    name: 'Demographic Insights',
    description: 'Population and demographic characteristics',
    icon: 'users',
    type: 'detailed-breakdown',
    color: 'black',
    primaryScoreField: 'demographic_insights_score',
    detailFields: ['age_groups', 'income_brackets']
  },
  {
    id: 'feature-importance-ranking',
    name: 'Feature Importance',
    description: 'Key factors driving performance',
    icon: 'bar-chart-3',
    type: 'detailed-breakdown',
    color: 'gray',
    primaryScoreField: 'importance_score',
    detailFields: ['feature_importance']
  },
  {
    id: 'dimensionality-insights',
    name: 'Dimensionality Insights',
    description: 'Data structure and complexity analysis',
    icon: 'target',
    type: 'detailed-breakdown',
    color: 'green',
    primaryScoreField: 'dimensionality_insights_score',
    detailFields: ['variance_explained', 'reduction_benefits', 'performance_metrics']
  }
];

class EndpointScoringService {
  public readonly ENDPOINT_CONFIGS = ENDPOINT_CONFIGS;
  private cache: Map<string, EndpointData> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Load and filter endpoint data based on geometry
   */
  async loadEndpointData(geometry: __esri.Geometry): Promise<{ [key: string]: EndpointData }> {
    console.log('[EndpointScoringService] Loading endpoint data for geometry:', geometry.type);
    
    const results: { [key: string]: EndpointData } = {};
    
    // Load data from all configured endpoints
    const loadPromises = ENDPOINT_CONFIGS.map(async (config) => {
      try {
        const data = await this.loadSingleEndpoint(config.id, geometry);
        return [config.id, data];
      } catch (error) {
        console.warn(`[EndpointScoringService] Failed to load ${config.id}:`, error);
        return [config.id, this.getDefaultEndpointData(config)];
      }
    });

    const loadedData = await Promise.all(loadPromises);
    loadedData.forEach(([id, data]) => {
      results[id as string] = data as EndpointData;
    });

    console.log('[EndpointScoringService] Loaded data for endpoints:', Object.keys(results));
    return results;
  }

  /**
   * Load data from the combined market intelligence dataset
   */
  private async loadSingleEndpoint(endpointId: string, geometry: __esri.Geometry): Promise<EndpointData> {
    const cacheKey = `${endpointId}-${this.getGeometryHash(geometry)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey) && this.isCacheValid(cacheKey)) {
      console.log(`[EndpointScoringService] Using cached data for ${endpointId}`);
      return this.cache.get(cacheKey)!;
    }

    // Load from combined market intelligence dataset
    console.log(`[EndpointScoringService] Loading market intelligence data for ${endpointId}`);
    const response = await fetch(MARKET_INTELLIGENCE_DATASET_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    
    // Filter data based on geometry (spatial filtering)
    const filteredData = await this.spatialFilter(rawData, geometry);
    
    // Extract scores relevant to this endpoint
    const processedData = this.processMarketIntelligenceData(filteredData, endpointId);
    
    // Cache the result
    this.cache.set(cacheKey, processedData);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
    
    return processedData;
  }

  /**
   * Perform spatial filtering based on geometry
   */
  private async spatialFilter(data: any, geometry: __esri.Geometry): Promise<any[]> {
    // Handle the combined dataset structure
    let records: any[] = [];
    
    if (data.results && Array.isArray(data.results)) {
      records = data.results;
    } else if (Array.isArray(data)) {
      records = data;
    } else {
      console.warn('[EndpointScoringService] Unexpected data structure:', typeof data);
      return [];
    }
    
    console.log(`[EndpointScoringService] Filtering ${records.length} records by geometry`);
    
    // Filter records based on geometry intersection
    const filteredRecords = records.filter(record => this.isWithinGeometry(record, geometry));
    
    console.log(`[EndpointScoringService] Found ${filteredRecords.length} records within geometry`);
    
    return filteredRecords;
  }

  /**
   * Process market intelligence data for a specific endpoint type
   */
  private processMarketIntelligenceData(filteredRecords: any[], endpointId: string): EndpointData {
    console.log(`[EndpointScoringService] Processing ${filteredRecords.length} records for ${endpointId}`);
    
    if (filteredRecords.length === 0) {
      console.warn(`[EndpointScoringService] No data found for ${endpointId}`);
      const config = ENDPOINT_CONFIGS.find(c => c.id === endpointId);
      return this.getDefaultEndpointData(config || {
        id: endpointId,
        name: endpointId,
        description: 'Unknown endpoint',
        icon: 'help-circle',
        type: 'single-score',
        color: 'gray'
      });
    }
    
    // Find the endpoint configuration
    const config = ENDPOINT_CONFIGS.find(c => c.id === endpointId);
    const scoreField = config?.primaryScoreField || 'strategic_score';
    
    // If single record, extract data directly
    if (filteredRecords.length === 1) {
      const record = filteredRecords[0];
      return this.extractEndpointDataFromRecord(record, scoreField);
    }
    
    // Multiple records - aggregate scores and demographics
    console.log(`[EndpointScoringService] Aggregating ${filteredRecords.length} records for ${endpointId}`);
    return this.aggregateMarketIntelligenceRecords(filteredRecords, scoreField);
  }

  /**
   * Extract endpoint data from a single market intelligence record
   */
  private extractEndpointDataFromRecord(record: any, scoreField: string): EndpointData {
    return {
      overall_score: record[scoreField] || 0,
      confidence_score: record.overall_confidence || 85,
      
      // Demographics
      population: record.TOTPOP_CY || 0,
      total_population: record.TOTPOP_CY || 0,
      households: record.TOTPOP_CY ? Math.round(record.TOTPOP_CY / 2.5) : 0,
      median_income: record.MEDHINC_CY || 0,
      median_age: record.MEDAGE_CY || 0,
      
      // Feature importance data
      feature_importance: record.feature_importance || [],
      
      // Location data
      coordinates: record.center_point || [0, 0],
      
      // Aggregation info
      aggregation_info: {
        source_count: 1,
        aggregation_method: 'single_record',
        total_population: record.TOTPOP_CY || 0,
        confidence_adjustment: 1.0
      },
      
      description: record.DESCRIPTION || 'Unknown Area'
    };
  }

  /**
   * Aggregate multiple market intelligence records
   */
  private aggregateMarketIntelligenceRecords(records: any[], scoreField: string): EndpointData {
    const validScores = records
      .map(r => r[scoreField])
      .filter(score => typeof score === 'number' && score > 0);
    
    const totalPopulation = records.reduce((sum, r) => sum + (r.TOTPOP_CY || 0), 0);
    const avgScore = validScores.length > 0 
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length 
      : 0;
    
    // Population-weighted demographics
    const avgIncome = this.calculatePopulationWeightedAverage(
      records, 'MEDHINC_CY', 'TOTPOP_CY'
    );
    const avgAge = this.calculatePopulationWeightedAverage(
      records, 'MEDAGE_CY', 'TOTPOP_CY'
    );
    
    // Calculate confidence based on data completeness
    const confidence = Math.min(95, 60 + (validScores.length / records.length) * 35);
    
    return {
      overall_score: Math.round(avgScore),
      confidence_score: Math.round(confidence),
      
      population: totalPopulation,
      total_population: totalPopulation,
      households: totalPopulation ? Math.round(totalPopulation / 2.5) : 0,
      median_income: Math.round(avgIncome),
      median_age: Math.round(avgAge),
      
      // Combined feature importance
      feature_importance: this.combineFeatureImportance(records),
      
      // Centroid coordinates
      coordinates: this.calculateCentroid(records),
      
      aggregation_info: {
        source_count: records.length,
        aggregation_method: 'population_weighted',
        total_population: totalPopulation,
        confidence_adjustment: validScores.length / records.length
      },
      
      description: `Aggregated data from ${records.length} areas`
    };
  }

  /**
   * Calculate population-weighted average for demographic fields
   */
  private calculatePopulationWeightedAverage(
    records: any[], 
    valueField: string, 
    weightField: string
  ): number {
    let totalWeightedValue = 0;
    let totalWeight = 0;
    
    for (const record of records) {
      const value = record[valueField];
      const weight = record[weightField];
      
      if (typeof value === 'number' && typeof weight === 'number' && weight > 0) {
        totalWeightedValue += value * weight;
        totalWeight += weight;
      }
    }
    
    return totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
  }

  /**
   * Combine feature importance data from multiple records
   */
  private combineFeatureImportance(records: any[]): Array<{feature_name?: string; name?: string; importance_score?: number; importance?: number; rank?: number}> {
    const featureMap = new Map<string, {total: number; count: number}>();
    
    for (const record of records) {
      if (Array.isArray(record.feature_importance)) {
        for (const feature of record.feature_importance) {
          const name = feature.feature_name || feature.name || 'unknown';
          const importance = feature.importance_score || feature.importance || 0;
          
          if (!featureMap.has(name)) {
            featureMap.set(name, {total: 0, count: 0});
          }
          
          const existing = featureMap.get(name)!;
          existing.total += importance;
          existing.count += 1;
        }
      }
    }
    
    // Convert to array and sort by average importance
    return Array.from(featureMap.entries())
      .map(([name, data]) => ({
        feature_name: name,
        importance_score: data.total / data.count,
        rank: 0 // Will be set after sorting
      }))
      .sort((a, b) => (b.importance_score || 0) - (a.importance_score || 0))
      .map((item, index) => ({...item, rank: index + 1}));
  }

  /**
   * Calculate centroid from multiple records
   */
  private calculateCentroid(records: any[]): [number, number] {
    const validCoords = records
      .map(r => r.center_point)
      .filter(coords => Array.isArray(coords) && coords.length === 2 && 
                       typeof coords[0] === 'number' && typeof coords[1] === 'number');
    
    if (validCoords.length === 0) return [0, 0];
    
    const sumLng = validCoords.reduce((sum, coord) => sum + coord[0], 0);
    const sumLat = validCoords.reduce((sum, coord) => sum + coord[1], 0);
    
    return [sumLng / validCoords.length, sumLat / validCoords.length];
  }

  /**
   * Aggregate multiple data points when study area contains multiple features
   */
  private aggregateMultipleDataPoints(dataPoints: EndpointData[]): EndpointData {
    if (dataPoints.length === 0) return {};
    if (dataPoints.length === 1) return dataPoints[0];

    console.log(`[EndpointScoringService] Aggregating ${dataPoints.length} data points`);

    // Initialize aggregated result with the first item's structure
    const aggregated = { ...dataPoints[0] };
    
    // Fields that should be averaged
    const averageFields = [
      'strategic_score', 'brand_difference_score', 'competitive_score', 'trend_score', 'prediction_score',
      'thematic_value', 'scenario_score', 'demographic_insights_score', 'importance_score', 
      'dimensionality_insights_score', 'overall_score', 'confidence_score'
    ];

    // Fields that should be summed
    const sumFields = ['population', 'total_population', 'households', 'total_households'];

    // Fields that should use weighted averages (by population if available)
    const weightedFields = ['median_income', 'median_age', 'average_household_size'];

    // Calculate averages for score fields
    averageFields.forEach(field => {
      const values = dataPoints
        .map(item => item[field])
        .filter(val => typeof val === 'number' && !isNaN(val));
      
      if (values.length > 0) {
        const total = values.reduce((sum, val) => (sum as number) + (val as number), 0) as number;
        aggregated[field] = Math.round(total / values.length * 100) / 100;
      }
    });

    // Calculate sums for population fields
    sumFields.forEach(field => {
      const values = dataPoints
        .map(item => item[field])
        .filter(val => typeof val === 'number' && !isNaN(val));
      
      if (values.length > 0) {
        aggregated[field] = values.reduce((sum, val) => (sum as number) + (val as number), 0);
      }
    });

    // Calculate weighted averages for demographic fields
    const totalPopulation = dataPoints.reduce((sum, item) => {
      const pop = item.population || item.total_population || 1;
      return sum + (typeof pop === 'number' ? pop : 1);
    }, 0);

    weightedFields.forEach(field => {
      let weightedSum = 0;
      let totalWeight = 0;

      dataPoints.forEach(item => {
        const value = item[field];
        const weight = item.population || item.total_population || 1;
        
        if (typeof value === 'number' && !isNaN(value) && typeof weight === 'number') {
          weightedSum += value * weight;
          totalWeight += weight;
        }
      });

      if (totalWeight > 0) {
        aggregated[field] = Math.round(weightedSum / totalWeight * 100) / 100;
      }
    });

    // Aggregate array fields (like feature importance)
    if (dataPoints[0].feature_importance && Array.isArray(dataPoints[0].feature_importance)) {
      aggregated.feature_importance = this.aggregateFeatureImportance(
        dataPoints.map(item => item.feature_importance).filter((arr): arr is NonNullable<EndpointData['feature_importance']> => Boolean(arr))
      );
    }

    // Update metadata to reflect aggregation
    aggregated.aggregation_info = {
      source_count: dataPoints.length,
      aggregation_method: 'weighted_by_population',
      total_population: totalPopulation,
      confidence_adjustment: Math.max(0.7, 1 - (dataPoints.length * 0.05)) // Slight confidence penalty for aggregation
    };

    // Adjust confidence score based on aggregation
    if (aggregated.confidence_score && aggregated.aggregation_info.confidence_adjustment) {
      aggregated.confidence_score = Math.round(
        aggregated.confidence_score * aggregated.aggregation_info.confidence_adjustment
      );
    }

    console.log(`[EndpointScoringService] Aggregation complete. Original points: ${dataPoints.length}, Final scores sample:`, {
      overall_score: aggregated.overall_score,
      confidence_score: aggregated.confidence_score,
      total_population: aggregated.aggregation_info?.total_population
    });

    return aggregated;
  }

  /**
   * Aggregate feature importance arrays from multiple data points
   */
  private aggregateFeatureImportance(importanceArrays: NonNullable<EndpointData['feature_importance']>[]): NonNullable<EndpointData['feature_importance']> {
    if (importanceArrays.length === 0) return [];
    if (importanceArrays.length === 1) return importanceArrays[0];

    // Combine all features and average their importance scores
    const featureMap = new Map<string, { totalImportance: number, count: number }>();

    importanceArrays.forEach(features => {
      features.forEach(feature => {
        const name = feature.feature_name || feature.name;
        const importance = feature.importance_score || feature.importance || 0;
        
        if (name) {
          const existing = featureMap.get(name) || { totalImportance: 0, count: 0 };
          featureMap.set(name, {
            totalImportance: existing.totalImportance + importance,
            count: existing.count + 1
          });
        }
      });
    });

    // Convert back to array format and sort by average importance
    const aggregatedFeatures = Array.from(featureMap.entries())
      .map(([name, data]) => ({
        feature_name: name,
        importance_score: Math.round(data.totalImportance / data.count * 10000) / 10000, // 4 decimal precision
        rank: 0 // Will be set after sorting
      }))
      .sort((a, b) => b.importance_score - a.importance_score);

    // Set ranks
    aggregatedFeatures.forEach((feature, index) => {
      feature.rank = index + 1;
    });

    return aggregatedFeatures;
  }

  /**
   * Check if a data point is within the given geometry
   */
  private isWithinGeometry(dataPoint: EndpointData, geometry: __esri.Geometry): boolean {
    // Extract coordinates from data point (this would vary based on data structure)
    let longitude: number | undefined;
    let latitude: number | undefined;
    
    const coords = dataPoint.coordinates as [number, number] | undefined;
    if (coords) {
      [longitude, latitude] = coords;
    } else if (typeof dataPoint.longitude === 'number' && typeof dataPoint.latitude === 'number') {
      longitude = dataPoint.longitude;
      latitude = dataPoint.latitude;
    } else if (typeof dataPoint.lng === 'number' && typeof dataPoint.lat === 'number') {
      longitude = dataPoint.lng as number;
      latitude = dataPoint.lat as number;
    } else {
      // If no coordinates available, include the point
      return true;
    }

    try {
      if (longitude === undefined || latitude === undefined) {
        return true; // Include if we can't determine location
      }
      
      const point = new Point({
        longitude,
        latitude,
        spatialReference: { wkid: 4326 }
      });

      // Convert geometry to the same spatial reference if needed
      if (geometry.spatialReference?.wkid !== 4326) {
        // In a real implementation, you would project the geometry
        console.warn('[EndpointScoringService] Spatial reference mismatch - skipping spatial filter');
        return true;
      }

      // Perform contains test - cast geometry to appropriate type
      if (geometry.type === 'polygon') {
        return geometryEngine.contains(geometry as __esri.Polygon, point);
      } else if (geometry.type === 'extent') {
        return geometryEngine.contains(geometry as __esri.Extent, point);
      } else {
        // For other geometry types, use intersects as fallback
        return geometryEngine.intersects(geometry as any, point);
      }
    } catch (error) {
      console.warn('[EndpointScoringService] Error in spatial filtering:', error);
      // If spatial filtering fails, include the point
      return true;
    }
  }

  /**
   * Process raw endpoint data into standardized format
   */
  private processEndpointData(rawData: EndpointData, endpointId: string): EndpointData {
    const config = ENDPOINT_CONFIGS.find(c => c.id === endpointId);
    if (!config) {
      return this.getDefaultEndpointData({ id: endpointId } as EndpointConfig);
    }

    // Extract the primary score based on configuration
    let overall_score = 0;
    let confidence_score = 50; // Default confidence
    let recommendation = 'Analysis completed';

    if (config.primaryScoreField && rawData[config.primaryScoreField] !== undefined) {
      const scoreValue = rawData[config.primaryScoreField];
      if (typeof scoreValue === 'number') {
        overall_score = Math.round(scoreValue);
      }
    } else if (rawData.overall_score !== undefined && typeof rawData.overall_score === 'number') {
      overall_score = Math.round(rawData.overall_score);
    } else if (rawData.score !== undefined && typeof rawData.score === 'number') {
      overall_score = Math.round(rawData.score);
    } else {
      // Generate a mock score for testing
      overall_score = Math.round(Math.random() * 40 + 60); // 60-100 range
    }

    // Extract confidence if available
    if (rawData.confidence_score !== undefined && typeof rawData.confidence_score === 'number') {
      confidence_score = Math.round(rawData.confidence_score);
    } else if (rawData.confidence !== undefined && typeof rawData.confidence === 'number') {
      confidence_score = Math.round(rawData.confidence * 100); // Convert from 0-1 to 0-100
    }

    // Extract recommendation
    if (rawData.recommendation && typeof rawData.recommendation === 'string') {
      recommendation = rawData.recommendation;
    } else if (rawData.summary && typeof rawData.summary === 'string') {
      recommendation = rawData.summary;
    } else if (rawData.description && typeof rawData.description === 'string') {
      recommendation = rawData.description;
    }

    // Include all original data for detailed breakdowns
    return {
      overall_score,
      confidence_score,
      recommendation,
      ...rawData // Include all original fields for detail views
    };
  }

  /**
   * Get default data for an endpoint when loading fails
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getDefaultEndpointData(_config: EndpointConfig): EndpointData {
    return {
      overall_score: 0,
      confidence_score: 0,
      recommendation: 'Data not available - please check endpoint configuration'
    };
  }

  /**
   * Generate a simple hash for geometry to use in caching
   */
  private getGeometryHash(geometry: __esri.Geometry): string {
    // Simple hash based on geometry type and extent
    const extent = geometry.extent;
    if (extent) {
      return `${geometry.type}-${Math.round(extent.xmin)}-${Math.round(extent.ymin)}-${Math.round(extent.xmax)}-${Math.round(extent.ymax)}`;
    }
    return `${geometry.type}-${Date.now()}`;
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    return expiry !== undefined && Date.now() < expiry;
  }

  /**
   * Clear expired cache entries
   */
  public clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now >= expiry) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  /**
   * Get endpoint configuration by ID
   */
  public getEndpointConfig(endpointId: string): EndpointConfig | undefined {
    return ENDPOINT_CONFIGS.find(config => config.id === endpointId);
  }

  /**
   * Calculate composite score from all endpoint data
   */
  public calculateCompositeScore(endpointData: { [key: string]: EndpointData }): number {
    const scores = Object.values(endpointData)
      .map(data => data.overall_score || 0)
      .filter(score => score > 0);
    
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }
}

// Export singleton instance
export const endpointScoringService = new EndpointScoringService();
export default endpointScoringService;