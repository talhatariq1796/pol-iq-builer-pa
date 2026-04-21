/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DatasetMerger - Intelligent merging of multiple endpoint datasets
 * 
 * Combines data from multiple endpoints using different strategies:
 * 1. Overlay: Merge by location with all fields
 * 2. Comparison: Side-by-side endpoint results
 * 3. Sequential: Chain analysis results
 * 4. Correlation: Cross-endpoint relationship analysis
 */

import { RawAnalysisResult } from './types';

export interface MergedDataset {
  mergedRecords: any[];
  fieldMapping: Record<string, string[]>; // field -> source endpoints
  locationCoverage: {
    totalLocations: number;
    completeRecords: number; // records with data from all endpoints
    partialRecords: number;  // records with data from some endpoints
  };
  qualityMetrics: {
    dataCompleteness: number; // 0-1 score
    fieldOverlap: number;     // 0-1 score
    spatialCoverage: number;  // 0-1 score
  };
  mergeStrategy: string;
  sourceEndpoints: string[];
  processingStats: {
    recordsPerEndpoint: Record<string, number>;
    mergeTime: number;
    memoryUsage?: number;
  };
}

export interface MergeOptions {
  strategy: 'overlay' | 'comparison' | 'sequential' | 'correlation';
  locationField?: string; // Default: 'FSA_ID'
  includePartialRecords?: boolean; // Default: true
  priorityEndpoint?: string; // For conflict resolution
  fieldPrefixes?: boolean; // Add endpoint prefixes to avoid conflicts
  qualityThreshold?: number; // Minimum data quality required (0-1)
}

export class DatasetMerger {
  
  /**
   * Merge multiple endpoint results into unified dataset
   */
  async mergeDatasets(
    datasets: RawAnalysisResult[],
    options: MergeOptions = { strategy: 'overlay' }
  ): Promise<RawAnalysisResult> {
    const startTime = Date.now();
    
    console.log(`[DatasetMerger] Starting merge with strategy: ${options.strategy}`);
    
    try {
      // Set defaults
      const mergeOptions: Required<MergeOptions> = {
        strategy: options.strategy || 'overlay',
        locationField: options.locationField || 'FSA_ID',
        includePartialRecords: options.includePartialRecords ?? true,
        priorityEndpoint: options.priorityEndpoint || 'default',
        fieldPrefixes: options.fieldPrefixes ?? false,
        qualityThreshold: options.qualityThreshold || 0.5
      };

      // Prepare source data from datasets
      const sourceData = this.prepareSourceDataFromDatasets(datasets);
      
      // Execute merge based on strategy
      let mergedResult: MergedDataset;
      
      switch (mergeOptions.strategy) {
        case 'overlay':
          mergedResult = await this.mergeOverlay(sourceData, mergeOptions);
          break;
        case 'comparison':
          mergedResult = await this.mergeComparison(sourceData, mergeOptions);
          break;
        case 'sequential':
          mergedResult = await this.mergeSequential(sourceData, mergeOptions);
          break;
        case 'correlation':
          mergedResult = await this.mergeCorrelation(sourceData, mergeOptions);
          break;
        default:
          throw new Error(`Unknown merge strategy: ${mergeOptions.strategy}`);
      }

      // Add processing stats
      mergedResult.processingStats.mergeTime = Date.now() - startTime;
      
      // Validate merge quality
      const qualityCheck = this.validateMergeQuality(mergedResult, mergeOptions.qualityThreshold);
      if (!qualityCheck.valid) {
        console.warn(`[DatasetMerger] Merge quality below threshold:`, qualityCheck);
      }

      console.log(`[DatasetMerger] Merge completed:`, {
        strategy: mergeOptions.strategy,
        totalRecords: mergedResult.mergedRecords.length,
        completeness: mergedResult.qualityMetrics.dataCompleteness,
        mergeTime: mergedResult.processingStats.mergeTime
      });

      return {
        success: true,
        results: mergedResult.mergedRecords,
        model_info: { 
          target_variable: 'merged_data',
          feature_count: Object.keys(mergedResult.fieldMapping).length,
          merge_strategy: mergedResult.mergeStrategy
        },
        feature_importance: []
      } as unknown as RawAnalysisResult;

    } catch (error) {
      console.error(`[DatasetMerger] Merge failed:`, error);
      throw new Error(`Dataset merge failed: ${error}`);
    }
  }

  /**
   * Overlay Strategy: Merge all data by location
   */
  private async mergeOverlay(
    sourceData: Record<string, any[]>, 
    options: Required<MergeOptions>
  ): Promise<MergedDataset> {
    
    console.log(`[DatasetMerger] Executing overlay merge for ${Object.keys(sourceData).length} endpoints`);
    
    const locationMap = new Map<string, any>();
    const fieldMapping: Record<string, string[]> = {};
    const recordsPerEndpoint: Record<string, number> = {};

    // Merge all datasets by location
    for (const [endpoint, records] of Object.entries(sourceData)) {
      recordsPerEndpoint[endpoint] = records.length;
      
      for (const record of records) {
        const location = record[options.locationField];
        if (!location) continue;

        // Initialize location record if new
        if (!locationMap.has(location)) {
          locationMap.set(location, { [options.locationField]: location });
        }

        const mergedRecord = locationMap.get(location)!;

        // Merge fields from this endpoint
        for (const [field, value] of Object.entries(record)) {
          if (field === options.locationField) continue;

          const finalFieldName = options.fieldPrefixes ? 
            `${endpoint.replace('/', '')}_${field}` : field;

          // Track field sources
          if (!fieldMapping[finalFieldName]) {
            fieldMapping[finalFieldName] = [];
          }
          if (!fieldMapping[finalFieldName].includes(endpoint)) {
            fieldMapping[finalFieldName].push(endpoint);
          }

          // Handle field conflicts
          if (mergedRecord[finalFieldName] !== undefined && mergedRecord[finalFieldName] !== value) {
            // Resolve conflict based on priority endpoint
            if (endpoint === options.priorityEndpoint || !options.priorityEndpoint) {
              mergedRecord[finalFieldName] = value;
            }
          } else {
            mergedRecord[finalFieldName] = value;
          }
        }
      }
    }

    const mergedRecords = Array.from(locationMap.values());
    
    // Filter partial records if requested
    const filteredRecords = options.includePartialRecords ? 
      mergedRecords : 
      mergedRecords.filter(record => this.hasDataFromAllEndpoints(record, sourceData, fieldMapping));

    // Calculate metrics
    const qualityMetrics = this.calculateQualityMetrics(
      filteredRecords, 
      sourceData, 
      fieldMapping
    );

    const locationCoverage = this.calculateLocationCoverage(
      filteredRecords, 
      sourceData, 
      fieldMapping
    );

    return {
      mergedRecords: filteredRecords,
      fieldMapping,
      locationCoverage,
      qualityMetrics,
      mergeStrategy: 'overlay',
      sourceEndpoints: Object.keys(sourceData),
      processingStats: {
        recordsPerEndpoint,
        mergeTime: 0 // Will be set by caller
      }
    };
  }

  /**
   * Comparison Strategy: Side-by-side endpoint results
   */
  private async mergeComparison(
    sourceData: Record<string, any[]>, 
    options: Required<MergeOptions>
  ): Promise<MergedDataset> {
    
    console.log(`[DatasetMerger] Executing comparison merge`);
    
    const comparisonRecords: any[] = [];
    const fieldMapping: Record<string, string[]> = {};
    const recordsPerEndpoint: Record<string, number> = {};

    // Get all unique locations
    const allLocations = new Set<string>();
    for (const records of Object.values(sourceData)) {
      for (const record of records) {
        const location = record[options.locationField];
        if (location) allLocations.add(location);
      }
    }

    // Create comparison records
    for (const location of allLocations) {
      const comparisonRecord: any = { [options.locationField]: location };

      // Add data from each endpoint as separate field groups
      for (const [endpoint, records] of Object.entries(sourceData)) {
        recordsPerEndpoint[endpoint] = records.length;
        
        const locationRecord = records.find(r => r[options.locationField] === location);
        const endpointPrefix = endpoint.replace('/', '').replace('-', '_');

        if (locationRecord) {
          // Add all fields with endpoint prefix
          for (const [field, value] of Object.entries(locationRecord)) {
            if (field === options.locationField) continue;
            
            const comparisonField = `${endpointPrefix}_${field}`;
            comparisonRecord[comparisonField] = value;
            
            // Track field mapping
            if (!fieldMapping[comparisonField]) {
              fieldMapping[comparisonField] = [];
            }
            fieldMapping[comparisonField].push(endpoint);
          }
        } else {
          // Add null placeholders for missing data
          comparisonRecord[`${endpointPrefix}_data_available`] = false;
        }
      }

      comparisonRecords.push(comparisonRecord);
    }

    // Calculate metrics
    const qualityMetrics = this.calculateQualityMetrics(
      comparisonRecords, 
      sourceData, 
      fieldMapping
    );

    const locationCoverage = this.calculateLocationCoverage(
      comparisonRecords, 
      sourceData, 
      fieldMapping
    );

    return {
      mergedRecords: comparisonRecords,
      fieldMapping,
      locationCoverage,
      qualityMetrics,
      mergeStrategy: 'comparison',
      sourceEndpoints: Object.keys(sourceData),
      processingStats: {
        recordsPerEndpoint,
        mergeTime: 0
      }
    };
  }

  /**
   * Sequential Strategy: Chain analysis results
   */
  private async mergeSequential(
    sourceData: Record<string, any[]>, 
    options: Required<MergeOptions>
  ): Promise<MergedDataset> {
    
    console.log(`[DatasetMerger] Executing sequential merge`);
    
    const endpoints = Object.keys(sourceData);
    let currentData = sourceData[endpoints[0]] || [];
    const fieldMapping: Record<string, string[]> = {};
    const recordsPerEndpoint: Record<string, number> = {};

    // Process endpoints sequentially
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      const endpointData = sourceData[endpoint];
      recordsPerEndpoint[endpoint] = endpointData.length;

      if (i === 0) {
        // First endpoint becomes base
        currentData = [...endpointData];
        
        // Initialize field mapping
        for (const record of endpointData) {
          for (const field of Object.keys(record)) {
            if (!fieldMapping[field]) fieldMapping[field] = [];
            if (!fieldMapping[field].includes(endpoint)) {
              fieldMapping[field].push(endpoint);
            }
          }
        }
      } else {
        // Subsequent endpoints enhance/filter the data
        currentData = this.applySequentialTransformation(
          currentData, 
          endpointData, 
          endpoint, 
          fieldMapping,
          options
        );
      }
    }

    // Calculate metrics
    const qualityMetrics = this.calculateQualityMetrics(
      currentData, 
      sourceData, 
      fieldMapping
    );

    const locationCoverage = this.calculateLocationCoverage(
      currentData, 
      sourceData, 
      fieldMapping
    );

    return {
      mergedRecords: currentData,
      fieldMapping,
      locationCoverage,
      qualityMetrics,
      mergeStrategy: 'sequential',
      sourceEndpoints: endpoints,
      processingStats: {
        recordsPerEndpoint,
        mergeTime: 0
      }
    };
  }

  /**
   * Correlation Strategy: Cross-endpoint relationship analysis
   */
  private async mergeCorrelation(
    sourceData: Record<string, any[]>, 
    options: Required<MergeOptions>
  ): Promise<MergedDataset> {
    
    console.log(`[DatasetMerger] Executing correlation merge`);
    
    // First do overlay merge to get base data
    const overlayResult = await this.mergeOverlay(sourceData, options);
    
    // Then add correlation fields
    const correlationRecords = overlayResult.mergedRecords.map(record => {
      const correlationFields = this.calculateCorrelationFields(record, sourceData);
      return { ...record, ...correlationFields };
    });

    // Update field mapping with correlation fields
    const enhancedFieldMapping = { ...overlayResult.fieldMapping };
    for (const record of correlationRecords) {
      for (const field of Object.keys(record)) {
        if (field.startsWith('correlation_') || field.startsWith('cross_endpoint_')) {
          enhancedFieldMapping[field] = Object.keys(sourceData);
        }
      }
    }

    return {
      ...overlayResult,
      mergedRecords: correlationRecords,
      fieldMapping: enhancedFieldMapping,
      mergeStrategy: 'correlation'
    };
  }

  /**
   * Helper methods
   */
  private prepareSourceDataFromDatasets(datasets: RawAnalysisResult[]): Record<string, any[]> {
    const sourceData: Record<string, any[]> = {};
    
    datasets.forEach((dataset, index) => {
      const endpointName = `dataset_${index}`;
      sourceData[endpointName] = dataset.results || [];
    });
    
    return sourceData;
  }

  private hasDataFromAllEndpoints(
    record: any, 
    sourceData: Record<string, any[]>, 
    fieldMapping: Record<string, string[]>
  ): boolean {
    const endpointCount = Object.keys(sourceData).length;
    const fieldsFromEndpoints = new Set<string>();
    
    for (const [field, value] of Object.entries(record)) {
      if (value !== null && value !== undefined && fieldMapping[field]) {
        fieldMapping[field].forEach(endpoint => fieldsFromEndpoints.add(endpoint));
      }
    }
    
    return fieldsFromEndpoints.size >= endpointCount;
  }

  private calculateQualityMetrics(
    records: any[], 
    sourceData: Record<string, any[]>, 
    fieldMapping: Record<string, string[]>
  ) {
    if (records.length === 0) {
      return { dataCompleteness: 0, fieldOverlap: 0, spatialCoverage: 0 };
    }

    // Data completeness: average non-null fields per record
    const totalFields = Object.keys(fieldMapping).length;
    const avgCompleteness = records.reduce((sum, record) => {
      const nonNullFields = Object.values(record).filter(v => v !== null && v !== undefined).length;
      return sum + (nonNullFields / totalFields);
    }, 0) / records.length;

    // Field overlap: fields covered by multiple endpoints
    const multiEndpointFields = Object.values(fieldMapping).filter(endpoints => endpoints.length > 1).length;
    const fieldOverlap = totalFields > 0 ? multiEndpointFields / totalFields : 0;

    // Spatial coverage: percentage of locations with data
    const totalPossibleLocations = Math.max(...Object.values(sourceData).map(data => data.length));
    const spatialCoverage = totalPossibleLocations > 0 ? records.length / totalPossibleLocations : 0;

    return {
      dataCompleteness: avgCompleteness,
      fieldOverlap,
      spatialCoverage: Math.min(spatialCoverage, 1.0)
    };
  }

  private calculateLocationCoverage(
    records: any[], 
    sourceData: Record<string, any[]>, 
    fieldMapping: Record<string, string[]>
  ) {
    const completeRecords = records.filter(record => 
      this.hasDataFromAllEndpoints(record, sourceData, fieldMapping)
    ).length;

    return {
      totalLocations: records.length,
      completeRecords,
      partialRecords: records.length - completeRecords
    };
  }

  private applySequentialTransformation(
    currentData: any[], 
    newData: any[], 
    endpoint: string, 
    fieldMapping: Record<string, string[]>,
    options: Required<MergeOptions>
  ): any[] {
    // Create lookup for new data
    const newDataMap = new Map(newData.map(record => [record[options.locationField], record]));
    
    // Transform current data based on new data
    return currentData.map(record => {
      const location = record[options.locationField];
      const newRecord = newDataMap.get(location);
      
      if (newRecord) {
        // Merge new fields
        const merged = { ...record };
        for (const [field, value] of Object.entries(newRecord)) {
          if (field !== options.locationField) {
            const prefixedField = options.fieldPrefixes ? `${endpoint.replace('/', '')}_${field}` : field;
            merged[prefixedField] = value;
            
            // Update field mapping
            if (!fieldMapping[prefixedField]) fieldMapping[prefixedField] = [];
            if (!fieldMapping[prefixedField].includes(endpoint)) {
              fieldMapping[prefixedField].push(endpoint);
            }
          }
        }
        return merged;
      }
      
      return record;
    });
  }

  private calculateCorrelationFields(record: any, sourceData: Record<string, any[]>): any {
    const correlationFields: any = {};
    
    // Example correlation calculations
    const nike = record.value_Nike_preference || 0;
    const adidas = record.value_Adidas_preference || 0;
    const income = record.AVGHINC_CY || 0;
    const population = record.TOTPOP_CY || 0;

    correlationFields.correlation_brand_competition = Math.abs(nike - adidas);
    correlationFields.correlation_income_preference = (income / 100000) * Math.max(nike, adidas);
    correlationFields.cross_endpoint_market_potential = (population / 10000) * correlationFields.correlation_brand_competition;
    
    return correlationFields;
  }

  private validateMergeQuality(
    result: MergedDataset, 
    threshold: number
  ): { valid: boolean; reason?: string } {
    if (result.qualityMetrics.dataCompleteness < threshold) {
      return { 
        valid: false, 
        reason: `Data completeness ${result.qualityMetrics.dataCompleteness.toFixed(2)} below threshold ${threshold}` 
      };
    }
    
    if (result.mergedRecords.length === 0) {
      return { valid: false, reason: 'No records in merged dataset' };
    }
    
    return { valid: true };
  }
} 