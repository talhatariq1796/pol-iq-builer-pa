/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, DataProcessorStrategy, AnalysisOptions, ProcessingContext } from './types';
import { ConfigurationManager } from './ConfigurationManager';
import { ProcessingContextManager } from './ProcessingContextManager';
import { CityAnalysisUtils, CityAnalysisResult } from './CityAnalysisUtils';
import { GeoAwarenessEngine } from '../geo/GeoAwarenessEngine';
import { analysisFeatures } from './analysisLens';

// Import specialized processors
import { CoreAnalysisProcessor } from './strategies/processors/CoreAnalysisProcessor';
import { UnifiedCMAProcessor } from './strategies/processors/UnifiedCMAProcessor';
import { RealEstateCMAProcessor } from './strategies/processors/RealEstateCMAProcessor';
import { ClusterDataProcessor } from './strategies/processors/ClusterDataProcessor';
import { CompetitiveDataProcessor } from './strategies/processors/CompetitiveDataProcessor';
import { DemographicDataProcessor } from './strategies/processors/DemographicDataProcessor';
import { CorrelationAnalysisProcessor } from './strategies/processors/CorrelationAnalysisProcessor';
import { TrendAnalysisProcessor } from './strategies/processors/TrendAnalysisProcessor';
import { AnomalyDetectionProcessor } from './strategies/processors/AnomalyDetectionProcessor';
import { FeatureInteractionProcessor } from './strategies/processors/FeatureInteractionProcessor';
import { OutlierDetectionProcessor } from './strategies/processors/OutlierDetectionProcessor';
import { ComparativeAnalysisProcessor } from './strategies/processors/ComparativeAnalysisProcessor';
import { PredictiveModelingProcessor } from './strategies/processors/PredictiveModelingProcessor';
import { SegmentProfilingProcessor } from './strategies/processors/SegmentProfilingProcessor';
import { ScenarioAnalysisProcessor } from './strategies/processors/ScenarioAnalysisProcessor';
import { MarketSizingProcessor } from './strategies/processors/MarketSizingProcessor';
import { BrandAnalysisProcessor } from './strategies/processors/BrandAnalysisProcessor';
import { BrandDifferenceProcessor } from './strategies/processors/BrandDifferenceProcessor';
import { RealEstateAnalysisProcessor } from './strategies/processors/RealEstateAnalysisProcessor';
import { RiskDataProcessor } from './strategies/processors/RiskDataProcessor';
import { StrategicAnalysisProcessor } from './strategies/processors/StrategicAnalysisProcessor';
import { CustomerProfileProcessor } from './strategies/processors/CustomerProfileProcessor';
import { SensitivityAnalysisProcessor } from './strategies/processors/SensitivityAnalysisProcessor';
import { GenericDetailViewBuilder } from './detail/GenericDetailViewBuilder';
// DISABLED: Technical ML processors not relevant for real estate brokers
// import { ModelPerformanceProcessor } from './strategies/processors/ModelPerformanceProcessor';
// import { ModelSelectionProcessor } from './strategies/processors/ModelSelectionProcessor';
// import { EnsembleAnalysisProcessor } from './strategies/processors/EnsembleAnalysisProcessor';
// OPTIONAL: May be useful for real estate feature analysis
// import { FeatureImportanceRankingProcessor } from './strategies/processors/FeatureImportanceRankingProcessor';
// import { DimensionalityInsightsProcessor } from './strategies/processors/DimensionalityInsightsProcessor';
// ACTIVE: Keep spatial and consensus for real estate
import { SpatialClustersProcessor } from './strategies/processors/SpatialClustersProcessor';
import { ConsensusAnalysisProcessor } from './strategies/processors/ConsensusAnalysisProcessor';
// DISABLED: Algorithm comparison not relevant for brokers
// import { AlgorithmComparisonProcessor } from './strategies/processors/AlgorithmComparisonProcessor';
import { AnalyzeProcessor } from './strategies/processors/AnalyzeProcessor';

// Real Estate Specific Processors
import { MarketTrendAnalysisProcessor } from './strategies/processors/MarketTrendAnalysisProcessor';
import { PricePredictionProcessor } from './strategies/processors/PricePredictionProcessor';
import { RentalAnalysisProcessor } from './strategies/processors/RentalAnalysisProcessor';
import { InvestmentOpportunityProcessor } from './strategies/processors/InvestmentOpportunityProcessor';
import { CMAProcessor } from './strategies/processors/CMAProcessor';

/**
 * DataProcessor - Standardizes raw microservice data into consistent format
 * 
 * Now uses specialized processor strategies for each endpoint type,
 * providing enhanced data processing capabilities tailored to specific
 * analysis requirements.
 */
export class DataProcessor {
  private configManager: ConfigurationManager;
  private processors: Map<string, DataProcessorStrategy>;

  private readonly specializedDetailEndpoints = new Set<string>(['/strategic-analysis']);

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
    this.processors = new Map();
    this.initializeProcessors();
  }

  /**
   * Process raw results with geographic analysis support
   */
  async processResultsWithGeographicAnalysis(
    rawResults: RawAnalysisResult, 
    endpoint: string, 
    query: string = '',
    spatialFilterIds?: string[],  // NEW parameter
    options?: AnalysisOptions
  ): Promise<ProcessedAnalysisData & { geoAnalysis?: any }> {
    let filteredRawResults = rawResults;
    let spatialFilterApplied = false;
    let geoResult: any = null;
    
    // Check if this is project-wide analysis - skip spatial filtering
    const isProjectScope = options?.analysisScope === 'project' || 
                          options?.scope === 'project' || 
                          options?.forceProjectScope === true;
    
    if (isProjectScope) {
      console.log('[DataProcessor] Project scope detected - skipping spatial filtering');
    }
    
    // Apply spatial filtering FIRST if feature IDs provided AND not project scope
    if (spatialFilterIds && !isProjectScope) {
      // If spatialFilterIds is an empty array, it means spatial filtering was attempted but found no features
      if (spatialFilterIds.length === 0) {
        console.log('[DataProcessor] Spatial filtering found no features - returning empty result');
        const emptyRawResult = { success: true, results: [] };
        const emptyProcessedData = await this.processResults(emptyRawResult, endpoint, query, options);
        return {
          ...emptyProcessedData,
          metadata: {
            ...emptyProcessedData.metadata,
            spatialFilterApplied: true,
            spatialFilterCount: 0,
            noFeaturesInSelection: true
          }
        };
      }
      
      // Apply spatial filtering with the provided feature IDs
      console.log(`[DataProcessor] Applying spatial filter: ${spatialFilterIds.length} allowed features`);
      console.log('[DataProcessor] Spatial filter IDs sample:', spatialFilterIds.slice(0, 5));
      
      // Import IDFieldMapper
      const { IDFieldMapper } = await import('@/lib/spatial/IDFieldMapper');
      
      const idSet = new Set(spatialFilterIds.map(id => String(id)));
      const originalCount = rawResults.results?.length || 0;
      
      // Debug: Check what IDs we have in the data
      const sampleRecord = rawResults.results?.[0];
      if (sampleRecord) {
        const extractedId = IDFieldMapper.extractId(sampleRecord);
        console.log('[DataProcessor] Sample data record IDs:', {
          ID: (sampleRecord as any).ID,
          OBJECTID: (sampleRecord as any).OBJECTID,
          DESCRIPTION: (sampleRecord as any).DESCRIPTION,
          extractedId: extractedId,
          allKeys: Object.keys(sampleRecord as any).filter(k => k.toLowerCase().includes('id') || k.includes('DESCRIPTION'))
        });
      }
      
      // Use IDFieldMapper for flexible ID extraction
      filteredRawResults = {
        ...rawResults,
        results: rawResults.results?.filter(record => {
          const recordId = IDFieldMapper.extractId(record);
          if (!recordId) {
            console.warn('[DataProcessor] Record has no identifiable ID:', Object.keys(record as any).slice(0, 10));
            return false;
          }
          const matches = idSet.has(recordId);
          if (originalCount < 10) { // Debug for small datasets
            console.log(`[DataProcessor] ID check: recordId=${recordId}, matches=${matches}`);
          }
          return matches;
        }) || []
      };
      
      const filteredCount = filteredRawResults.results?.length || 0;
      spatialFilterApplied = true;
      
      console.log(`[DataProcessor] Spatial filter applied:`, {
        originalRecords: originalCount,
        filteredRecords: filteredCount,
        retainedPercentage: originalCount > 0 ? `${(filteredCount / originalCount * 100).toFixed(1)}%` : '0%',
        matchedIds: filteredCount
      });
      
      // Warn if very few matches
      if (filteredCount === 0) {
        console.error('[DataProcessor] No records matched spatial filter!');
      } else if (filteredCount < spatialFilterIds.length * 0.5) {
        console.warn(`[DataProcessor] Low match rate: ${filteredCount}/${spatialFilterIds.length} IDs matched`);
      }
    }
    
    // Apply geographic filtering for queries with explicit geographic content
    // This ensures queries like "show me high income areas in Montreal" work properly
    if (query && query.trim().length > 2) {
      try {
        const geoEngine = GeoAwarenessEngine.getInstance();
        const geoPreFilter = await geoEngine.processGeoQuery(query, rawResults.results || [], endpoint);
        
        if (geoPreFilter.matchedEntities.length > 0 && geoPreFilter.filteredRecords.length > 0) {
          console.log(`🌍 [DataProcessor] Geographic pre-filtering detected for query: "${query}"`);
          console.log(`🌍 [DataProcessor] Geographic entities:`, geoPreFilter.matchedEntities.map(e => ({ name: e.name, type: e.type })));
          console.log(`🌍 [DataProcessor] Records filtered: ${rawResults.results?.length || 0} -> ${geoPreFilter.filteredRecords.length}`);
          
          // DEBUG: Log actual area codes in filtered data
          const areaCodes = geoPreFilter.filteredRecords.map((r: any) => r.ID || r.area_name || r.zipcode || r.id).filter(Boolean).slice(0, 20);
          console.log(`🔍 [DataProcessor] First 20 area codes in filtered data:`, areaCodes);
          
          // DEBUG: Check which cities these area codes belong to
          const cityGroups = geoPreFilter.filteredRecords.reduce((acc: any, r: any) => {
            const areaCode = r.area_name || r.zipcode || r.ID;
            const city = r.city || 'Unknown';
            if (!acc[city]) acc[city] = [];
            acc[city].push(areaCode);
            return acc;
          }, {} as Record<string, string[]>);
          
          console.log(`🔍 [DataProcessor] Area codes grouped by city:`, Object.keys(cityGroups).map(city => ({
            city,
            count: cityGroups[city].length,
            sampleAreaCodes: cityGroups[city].slice(0, 5)
          })));
          
          filteredRawResults = {
            ...rawResults,
            results: geoPreFilter.filteredRecords
          };
          geoResult = geoPreFilter; // Store for metadata
        }
      } catch (error) {
        console.error('[DataProcessor] Geographic pre-filtering failed, using original data:', error);
      }
    }
    
    const processedData = await this.processResults(filteredRawResults, endpoint, query, options);
    
    // If we already did geo-filtering, return with that metadata
    if (geoResult) {
      return {
        ...processedData,
        geoAnalysis: {
          entities: geoResult.matchedEntities,
          filterStats: geoResult.filterStats,
          warnings: geoResult.warnings,
          fallbackUsed: geoResult.fallbackUsed
        }
      };
    }
    
    // No additional post-processing needed since geo-filtering was done pre-processing
    if (false) {
      try {
        // This block is disabled - geo-filtering now happens before data processing
      } catch (error) {
        console.warn('[DataProcessor] Geographic analysis failed, falling back to legacy city analysis:', error);
        
        // Fallback to legacy city analysis
        const cityAnalysis = CityAnalysisUtils.analyzeQuery(query, processedData.records, processedData.targetVariable);
        
        if (cityAnalysis.isCityQuery) {
          console.log(`[DataProcessor] Legacy city analysis fallback:`, {
            cities: cityAnalysis.detectedCities,
            isComparison: cityAnalysis.isComparison,
            filteredRecords: cityAnalysis.filteredData.length
          });
          
          if (cityAnalysis.filteredData.length > 0 && cityAnalysis.filteredData.length < processedData.records.length) {
            processedData.records = cityAnalysis.filteredData;
            console.log(`[DataProcessor] 🔄 Fallback: Filtered data to ${cityAnalysis.filteredData.length} city-specific records`);
          }
          
          return { 
            ...processedData, 
            geoAnalysis: {
              legacyFallback: true,
              cityAnalysis
            }
          };
        }
      }
    }
    
    // Add spatial filter metadata to result
    if (spatialFilterApplied) {
      processedData.metadata = {
        ...processedData.metadata,
        spatialFilterApplied: true,
        spatialFilterCount: spatialFilterIds?.length || 0
      };
    }
    
    return processedData;
  }

  /**
   * Process raw results with city analysis support (legacy method for backward compatibility)
   */
  async processResultsWithCityAnalysis(rawResults: RawAnalysisResult, endpoint: string, query: string = ''): Promise<ProcessedAnalysisData & { cityAnalysis?: CityAnalysisResult }> {
    // This method is kept for backward compatibility, but now calls the new geographic analysis
    const processedData = await this.processResults(rawResults, endpoint);
    
    if (query) {
      const cityAnalysis = CityAnalysisUtils.analyzeQuery(query, processedData.records, processedData.targetVariable);
      
      if (cityAnalysis.isCityQuery) {
        console.log(`[DataProcessor] Legacy city analysis (consider upgrading to processResultsWithGeographicAnalysis):`, {
          cities: cityAnalysis.detectedCities,
          isComparison: cityAnalysis.isComparison,
          filteredRecords: cityAnalysis.filteredData.length
        });
        
        // Update processed data with city-filtered results if applicable
        if (cityAnalysis.filteredData.length > 0 && cityAnalysis.filteredData.length < processedData.records.length) {
          processedData.records = cityAnalysis.filteredData;
          console.log(`[DataProcessor] Filtered data to ${cityAnalysis.filteredData.length} city-specific records`);
        }
        
        return { ...processedData, cityAnalysis };
      }
    }
    
    return processedData;
  }

  /**
   * Process raw results into standardized format using endpoint-specific processors
   */
  async processResults(
    rawResults: RawAnalysisResult, 
    endpoint: string, 
    query?: string, 
    options?: AnalysisOptions
  ): Promise<ProcessedAnalysisData> {
    
    console.log(`🔥 [DataProcessor] processResults called for endpoint: ${endpoint}, query: "${query || 'NO QUERY'}"`);
    console.log(`🔥 [DataProcessor] Raw data structure:`, {
      success: rawResults?.success,
      resultsLength: rawResults?.results?.length,
      firstRecordKeys: rawResults?.results?.[0] ? Object.keys(rawResults.results[0]).slice(0, 10) : []
    });

    const baseContext: ProcessingContext = { query, endpoint, analysisOptions: options };

    if ((options?.viewMode ?? 'aggregate') === 'detail' && !this.specializedDetailEndpoints.has(endpoint)) {
      const detailResult = GenericDetailViewBuilder.tryBuild(rawResults, {
        endpoint,
        drilldownKey: options?.drilldownKey,
        limit: options?.sampleSize ?? options?.sample_size,
        targetVariable: options?.targetVariable ?? options?.target_variable
      });

      if (detailResult) {
        this.attachProcessingMetadata(detailResult, baseContext);
        return detailResult;
      }
    }
    
    try {
      // Get the appropriate processor for this endpoint
      const processor = this.getProcessorForEndpoint(endpoint);
      
      console.log(`🔥 [DataProcessor] Using processor: ${processor.constructor.name} for endpoint: ${endpoint}`);
      
      
      // CRITICAL DEBUG: Show first record to confirm data structure
      if (rawResults.results && rawResults.results.length > 0) {
        const firstRecord = rawResults.results[0];
      }
      
      // FORCE competitive analysis to always use CompetitiveDataProcessor
      if (endpoint === '/competitive-analysis') {
      }
      
      // Validate raw data first
      const validationResult = processor.validate(rawResults);
      
      if (!validationResult) {
        console.warn(`⚠️ [DataProcessor] VALIDATION FAILED for ${endpoint} using ${processor.constructor.name}, trying fallback processor`);
        
        // Try fallback to StrategicAnalysisProcessor for query-based analysis
        if (endpoint !== '/strategic-analysis' && query && query.trim()) {
          console.log(`🔄 [DataProcessor] Attempting fallback to StrategicAnalysisProcessor for query: "${query}"`);
          const fallbackProcessor = this.processors.get('/strategic-analysis');
          if (fallbackProcessor && fallbackProcessor.validate(rawResults)) {
            console.log(`✅ [DataProcessor] Fallback validation successful, using StrategicAnalysisProcessor`);
            return this.processWithFallbackProcessor(fallbackProcessor, rawResults, '/strategic-analysis', query, options);
          }
        }
        
        // If fallback also fails, use the original error
        console.error(`🚨🚨🚨 [DataProcessor] VALIDATION FAILED for ${endpoint} using ${processor.constructor.name} 🚨🚨🚨`);
        throw new Error(`Data validation failed for ${endpoint}. The ${processor.constructor.name} processor could not validate the data structure. This endpoint requires specific data fields.`);
      }

      // Process the data with specialized processor  
      let processedData: ProcessedAnalysisData;
      let contextForMetadata: ProcessingContext = baseContext;

      if (endpoint === '/brand-difference' && query) {
        const extractedBrands = this.extractBrandsFromQuery(query);
        contextForMetadata = { ...baseContext, extractedBrands };
        console.log(`🔥 [DataProcessor] Brand-difference context created:`, { query, extractedBrands });
        processedData = await this.executeProcessorWithContext(processor, rawResults, contextForMetadata);
      } else if ((endpoint === '/comparative-market-analysis' || endpoint === 'comparative_market_analysis') && options?.geometry) {
        // For CMA analysis, pass geometry and filters directly to the processor
        console.log(`🔥 [DataProcessor] 🔍 DETAILED GEOMETRY TRACE - CMA analysis with geometry and filters:`, {
          hasGeometry: !!options.geometry,
          geometryType: options.geometry?.type,
          geometryExtent: options.geometry?.extent ? {
            xmin: options.geometry.extent.xmin,
            ymin: options.geometry.extent.ymin,
            xmax: options.geometry.extent.xmax,
            ymax: options.geometry.extent.ymax
          } : null,
          hasFilters: !!options.filters,
          endpoint,
          rawResultsHasResults: !!rawResults.results,
          rawResultsLength: rawResults.results?.length || 0,
          processorType: processor.constructor.name
        });
        
        // 🔍 CRITICAL DEBUG: Check if rawResults already contains the 4178 properties
        console.log('🔍 [DataProcessor] CRITICAL TRACE - Raw data before processor:', {
          rawResultsLength: rawResults.results?.length || 0,
          isAlreadyUnfiltered: (rawResults.results?.length || 0) > 1000,
          expectedIfFiltered: '< 500 records',
          actualCount: rawResults.results?.length || 0,
          status: (rawResults.results?.length || 0) > 1000 ? '❌ DATA ALREADY UNFILTERED' : '✅ DATA LOOKS FILTERED',
          sampleIDs: rawResults.results?.slice(0, 5)?.map((r: any) => r.ID || r.area_id || r.id) || []
        });
        
        const cmaRawData: RawAnalysisResult = {
          ...rawResults,
          geometry: options.geometry,
          filters: options.filters
        };
        console.log(`🔥 [DataProcessor] 🔍 DETAILED GEOMETRY TRACE - Passing to RealEstateCMAProcessor:`, {
          hasGeometry: !!cmaRawData.geometry,
          geometryType: (cmaRawData.geometry as any)?.type,
          hasFilters: !!cmaRawData.filters,
          cmaRawDataKeys: Object.keys(cmaRawData),
          willProcessorFilterSpatially: 'TBD - depends on RealEstateCMAProcessor implementation'
        });
        processedData = await this.executeProcessorWithContext(processor, cmaRawData, baseContext);
        contextForMetadata = baseContext;
      } else {
        // CRITICAL FIX: Pass geometry and filters to ALL processors, not just CMA
        // This ensures spatial filtering works for all analysis endpoints that support it
        const enhancedRawResults: RawAnalysisResult = {
          ...rawResults,
          geometry: options?.geometry,
          filters: options?.filters
        };
        console.log(`🔥 [DataProcessor] 🔍 DETAILED GEOMETRY TRACE - Passing geometry to ${processor.constructor.name}:`, {
          hasGeometry: !!enhancedRawResults.geometry,
          geometryType: (enhancedRawResults.geometry as any)?.type,
          hasFilters: !!enhancedRawResults.filters,
          endpoint,
          processorName: processor.constructor.name
        });
        processedData = await this.executeProcessorWithContext(processor, enhancedRawResults, baseContext);
        contextForMetadata = baseContext;
      }

  this.attachProcessingMetadata(processedData, contextForMetadata);
      
      // Override targetVariable with ConfigurationManager setting
      const scoreConfig = this.configManager.getScoreConfig(endpoint);
      if (scoreConfig) {
        processedData.targetVariable = scoreConfig.targetVariable;
        console.log(`🚨🚨🚨 [DataProcessor] Set targetVariable from ConfigurationManager: ${scoreConfig.targetVariable} 🚨🚨🚨`);
      }
      
      console.log(`🔥 [DataProcessor] processedData type:`, typeof processedData);
      console.log(`🔥 [DataProcessor] processedData keys:`, processedData ? Object.keys(processedData) : 'null/undefined');
      console.log(`🔥 [DataProcessor] processedData.records type:`, typeof processedData?.records);
      console.log(`🔥 [DataProcessor] processedData.records is array:`, Array.isArray(processedData?.records));
      
      // 🔍 CRITICAL DEBUG: Final processed data analysis
      console.log('🔍 [DataProcessor] FINAL PROCESSED DATA TRACE:', {
        processedRecordsLength: processedData.records.length,
        processorUsed: processor.constructor.name,
        endpoint,
        spatialFilteringResult: {
          expectedIfFiltered: '< 500 records for specific area',
          actualRecordsProcessed: processedData.records.length,
          indicatesFiltering: processedData.records.length < 500,
          indicatesNoFiltering: processedData.records.length > 1000,
          status: processedData.records.length > 1000 ? '❌ NO SPATIAL FILTERING' : 
                  processedData.records.length < 500 ? '✅ SPATIAL FILTERING WORKED' : 
                  '⚠️ PARTIAL FILTERING'
        },
        sampleProcessedRecords: processedData.records.slice(0, 3).map(r => ({
          area_id: r.area_id,
          area_name: r.area_name,
          value: r.value,
          coordinates: r.coordinates
        }))
      });
      
      console.log(`[DataProcessor] Successfully processed ${processedData.records.length} records using ${endpoint} processor`);
      console.log(`🔥 [DataProcessor] First processed record value:`, processedData.records[0]?.value);
      console.log(`🔥 [DataProcessor] First processed record properties:`, processedData.records[0]?.properties);
      
      return processedData;
      
    } catch (error) {
      console.error(`[DataProcessor] Error processing ${endpoint}:`, error);
      
      // No fallback - throw explicit error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to process ${endpoint} data: ${errorMessage}`);
    }
  }

  /**
   * Get available processor types
   */
  getAvailableProcessors(): string[] {
    return Array.from(this.processors.keys());
  }

  /**
   * Validate if a processor exists for an endpoint
   */
  hasProcessorForEndpoint(endpoint: string): boolean {
    return this.processors.has(endpoint) || this.processors.has('default');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async executeProcessorWithContext(
    processor: DataProcessorStrategy,
    rawData: RawAnalysisResult,
    context: ProcessingContext
  ): Promise<ProcessedAnalysisData> {
    const contextManager = ProcessingContextManager.getInstance();
    const previousContext = contextManager.getContext();
    contextManager.setContext(context);

    try {
      const result = processor.process(rawData, context);
      return result instanceof Promise ? await result : result;
    } finally {
      if (previousContext) {
        contextManager.setContext(previousContext);
      } else {
        contextManager.setContext(null);
      }
    }
  }

  private attachProcessingMetadata(processedData: ProcessedAnalysisData, context: ProcessingContext): void {
    if (!processedData) return;

    const appliedFilters = this.buildAppliedFilterSnapshot(context.analysisOptions);
    const metadata = { ...(processedData.metadata ?? {}) } as Record<string, unknown>;
    const existingAppliedFilters = ((metadata as any).appliedFilters ?? {}) as Record<string, unknown>;

    if (appliedFilters) {
      (metadata as any).appliedFilters = {
        ...existingAppliedFilters,
        ...appliedFilters
      };
    }

    if (context.analysisOptions?.drilldownKey) {
      metadata['drilldownKey'] = context.analysisOptions.drilldownKey;
    }

    if (context.analysisOptions?.viewMode) {
      metadata['viewMode'] = context.analysisOptions.viewMode;
    }

    const spatialFilterIds = context.analysisOptions?.spatialFilterIds;
    if (Array.isArray(spatialFilterIds) && spatialFilterIds.length > 0) {
      if (metadata['spatialFilterApplied'] === undefined) {
        metadata['spatialFilterApplied'] = true;
      }
      if (metadata['spatialFilterCount'] === undefined) {
        metadata['spatialFilterCount'] = spatialFilterIds.length;
      }
    }

    processedData.metadata = metadata as ProcessedAnalysisData['metadata'];

    const isDetailMode = (context.analysisOptions?.viewMode ?? 'aggregate') === 'detail';

    if (isDetailMode) {
      processedData.supportsDrilldown = false;
    } else {
      if (processedData.supportsDrilldown === undefined) {
        processedData.supportsDrilldown = true;
      }

      if (!processedData.drilldownDescriptor) {
        processedData.drilldownDescriptor = {
          mode: 'table',
          keyField: 'area_id',
          title: 'View detailed records',
          description: 'Switch to record-level detail using the same filters.'
        };
      }
    }
  }

  private buildAppliedFilterSnapshot(options?: AnalysisOptions): Record<string, unknown> | undefined {
    if (!options) return undefined;

    const snapshot: Record<string, unknown> = {};

    if (Array.isArray(options.spatialFilterIds) && options.spatialFilterIds.length > 0) {
      snapshot.spatialFilterIds = options.spatialFilterIds;
    }
    if (options.spatialFilterMethod) {
      snapshot.spatialFilterMethod = options.spatialFilterMethod;
    }
    if (options.spatialFilterGeometry) {
      snapshot.spatialFilterGeometry = options.spatialFilterGeometry;
    }
    if (options.fieldFilters && typeof options.fieldFilters === 'object' && Object.keys(options.fieldFilters).length > 0) {
      snapshot.fieldFilters = options.fieldFilters;
    }
    if (options.filters && typeof options.filters === 'object' && Object.keys(options.filters).length > 0) {
      snapshot.filters = options.filters;
    }
    if (options.persona) {
      snapshot.persona = options.persona;
    }
    if (options.geometry) {
      snapshot.geometry = options.geometry;
    }

    return Object.keys(snapshot).length > 0 ? snapshot : undefined;
  }

  private initializeProcessors(): void {
    // Register specialized processors for specific endpoints
    this.processors.set('/analyze', new CoreAnalysisProcessor());
    this.processors.set('/spatial-clusters', new ClusterDataProcessor());
    this.processors.set('/competitive-analysis', new CompetitiveDataProcessor());
    this.processors.set('/demographic-insights', new DemographicDataProcessor());
    this.processors.set('/trend-analysis', new TrendAnalysisProcessor());
    this.processors.set('/anomaly-detection', new AnomalyDetectionProcessor());
    this.processors.set('/risk-analysis', new RiskDataProcessor());
    
    // Register the same processors for related endpoints
    this.processors.set('/correlation-analysis', new CorrelationAnalysisProcessor());
    this.processors.set('/threshold-analysis', new CoreAnalysisProcessor());
    this.processors.set('/feature-interactions', new FeatureInteractionProcessor());
    this.processors.set('/outlier-detection', new OutlierDetectionProcessor());
    this.processors.set('/comparative-analysis', new ComparativeAnalysisProcessor());
    this.processors.set('/predictive-modeling', new PredictiveModelingProcessor());
    this.processors.set('/segment-profiling', new SegmentProfilingProcessor());
    this.processors.set('/scenario-analysis', new ScenarioAnalysisProcessor());
    this.processors.set('/strategic-analysis', new StrategicAnalysisProcessor()); // Use dedicated StrategicAnalysisProcessor
    this.processors.set('/market-sizing', new MarketSizingProcessor());
    this.processors.set('/customer-profile', new CustomerProfileProcessor()); // Customer profile analysis processor
    this.processors.set('/brand-analysis', new BrandAnalysisProcessor());
    this.processors.set('/brand-difference', new BrandDifferenceProcessor()); // Brand market share difference analysis
    this.processors.set('/real-estate-analysis', new RealEstateAnalysisProcessor());
    
    // Register CMA processor for both endpoint formats (production)
    // FIXED: Use RealEstateCMAProcessor for spatial filtering support
    this.processors.set('comparative_market_analysis', new RealEstateCMAProcessor());
    this.processors.set('/comparative-market-analysis', new RealEstateCMAProcessor());
    // Keep other processors as backup
    this.processors.set('comparative_market_analysis_unified', new UnifiedCMAProcessor());
    this.processors.set('comparative_market_analysis_generic', new CMAProcessor());
    
    // Register the 10 new processors for previously missing endpoints
    this.processors.set('/sensitivity-analysis', new SensitivityAnalysisProcessor());
    // DISABLED: Technical ML processors not relevant for real estate brokers
    // this.processors.set('/model-performance', new ModelPerformanceProcessor());
    // this.processors.set('/model-selection', new ModelSelectionProcessor());
    // this.processors.set('/ensemble-analysis', new EnsembleAnalysisProcessor());
    // OPTIONAL: May be useful for real estate feature analysis
    // this.processors.set('/feature-importance-ranking', new FeatureImportanceRankingProcessor());
    // this.processors.set('/dimensionality-insights', new DimensionalityInsightsProcessor());
    // ACTIVE: Keep spatial and consensus for real estate
    this.processors.set('/spatial-clusters', new SpatialClustersProcessor());
    this.processors.set('/consensus-analysis', new ConsensusAnalysisProcessor());
    // DISABLED: Algorithm comparison not relevant for brokers
    // this.processors.set('/algorithm-comparison', new AlgorithmComparisonProcessor());
    // Override the existing /analyze processor with the new dedicated one
    this.processors.set('/analyze', new AnalyzeProcessor());
    
    // CRITICAL FIX: Register missing real estate specific processors
    this.processors.set('/market-trend-analysis', new MarketTrendAnalysisProcessor());
    this.processors.set('/price-prediction-analysis', new PricePredictionProcessor());
    this.processors.set('/rental-market-analysis', new RentalAnalysisProcessor());
    this.processors.set('/investment-opportunities', new InvestmentOpportunityProcessor());
    
    // Additional real estate endpoints that might be missing
    this.processors.set('/gentrification-analysis', new DemographicDataProcessor()); // Gentrification is demographic-based
    this.processors.set('/affordability-analysis', new DemographicDataProcessor()); // Affordability analysis
    this.processors.set('/neighborhood-quality-analysis', new DemographicDataProcessor()); // Quality analysis
    this.processors.set('/development-potential-analysis', new StrategicAnalysisProcessor()); // Development analysis
    this.processors.set('/growth-potential-analysis', new StrategicAnalysisProcessor()); // Growth analysis
    this.processors.set('/market-saturation-analysis', new StrategicAnalysisProcessor()); // Market saturation should use strategic analysis
    this.processors.set('/market-liquidity-analysis', new StrategicAnalysisProcessor()); // Liquidity analysis
    
    // All real estate endpoints now have dedicated processors!
    // this.processors.set('/penetration-optimization', new OptimizationDataProcessor());
    
    // Default processor for unspecified endpoints
    this.processors.set('default', new CoreAnalysisProcessor());
    
    console.log(`[DataProcessor] Initialized ${this.processors.size} specialized processors`);
  }

  /**
   * Detect if this is a geographic comparative query
   */
  private isGeographicComparativeQuery(query: string = '', endpoint: string): boolean {
    if (endpoint !== '/comparative-analysis') return false;
    if (!query || query.trim().length < 3) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Check for comparative + geographic patterns
    const hasComparative = lowerQuery.includes('compare') || lowerQuery.includes('between') || 
                           lowerQuery.includes('vs') || lowerQuery.includes('versus');
    
    const hasGeographic = /\b(brooklyn|philadelphia|manhattan|queens|bronx|newark|jersey city|pittsburgh)\b/i.test(query) ||
                         /\b(new york|pennsylvania|new jersey)\b/i.test(query) ||
                         /\bbetween\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+and\s+[A-Z][a-z]+/i.test(query);
    
    return hasComparative && hasGeographic;
  }

  private getProcessorForEndpoint(endpoint: string): DataProcessorStrategy {
    
    // SPECIFIC FIX: Only force CompetitiveDataProcessor for competitive analysis endpoints
    if (endpoint.includes('competitive') || endpoint === '/competitive-analysis') {
      const competitiveProcessor = this.processors.get('/competitive-analysis')!;
      return competitiveProcessor;
    }
    
    // Try to get specific processor for endpoint
    if (this.processors.has(endpoint)) {
      const processor = this.processors.get(endpoint)!;
      return processor;
    }
    
    // Fallback to default processor
    return this.processors.get('default')!;
  }

  /**
   * Process data with fallback processor when main processor validation fails
   */
  private async processWithFallbackProcessor(
    processor: DataProcessorStrategy,
    rawResults: RawAnalysisResult,
    endpoint: string,
    query?: string,
    options?: AnalysisOptions
  ): Promise<ProcessedAnalysisData> {
    const baseContext: ProcessingContext = { query, endpoint, analysisOptions: options };
    let processedData: ProcessedAnalysisData;
    let contextForMetadata: ProcessingContext = baseContext;

    if (endpoint === '/brand-difference' && query) {
      const extractedBrands = this.extractBrandsFromQuery(query);
      contextForMetadata = { ...baseContext, extractedBrands };
      console.log(`🔥 [DataProcessor] Fallback brand-difference context created:`, { query, extractedBrands });
      processedData = await this.executeProcessorWithContext(processor, rawResults, contextForMetadata);
    } else if (endpoint === 'comparative_market_analysis' && options?.geometry) {
      // For CMA analysis, pass geometry and filters directly to the processor
      console.log(`🔥 [DataProcessor] Fallback CMA analysis with geometry and filters`);
      const cmaRawData: RawAnalysisResult = {
        ...rawResults,
        geometry: options.geometry,
        filters: options.filters
      };
      processedData = await this.executeProcessorWithContext(processor, cmaRawData, baseContext);
      contextForMetadata = baseContext;
    } else {
      // CRITICAL FIX: Pass geometry and filters to fallback processors too
      const enhancedRawResults: RawAnalysisResult = {
        ...rawResults,
        geometry: options?.geometry,
        filters: options?.filters
      };
      console.log(`🔥 [DataProcessor] Fallback processor also receiving geometry:`, {
        hasGeometry: !!enhancedRawResults.geometry,
        processorName: processor.constructor.name
      });
      processedData = await this.executeProcessorWithContext(processor, enhancedRawResults, baseContext);
      contextForMetadata = baseContext;
    }

    this.attachProcessingMetadata(processedData, contextForMetadata);

    // Override targetVariable with ConfigurationManager setting
    const scoreConfig = this.configManager.getScoreConfig(endpoint);
    if (scoreConfig) {
      processedData.targetVariable = scoreConfig.targetVariable;
      console.log(`🔄 [DataProcessor] Fallback set targetVariable from ConfigurationManager: ${scoreConfig.targetVariable}`);
    }

    console.log(`[DataProcessor] Fallback processing successful: ${processedData.records.length} records using ${processor.constructor.name}`);
    return processedData;
  }

  private async processFallbackData(rawResults: RawAnalysisResult, endpoint: string): Promise<ProcessedAnalysisData> {
    // Use default processor for fallback processing
    const defaultProcessor = this.processors.get('default')!;
    
    try {
      const result = defaultProcessor.process(rawResults);
      return result instanceof Promise ? await result : result;
    } catch (error) {
      console.error(`[DataProcessor] Fallback processing also failed for ${endpoint}:`, error);
      return this.createFallbackData(rawResults, endpoint);
    }
  }

  private createFallbackData(rawResults: RawAnalysisResult, endpoint: string): ProcessedAnalysisData {
    // Create minimal valid data structure when all processing fails
    return {
      type: endpoint.replace('/', ''),
      records: [],
      summary: rawResults.summary || 'Analysis completed with limited data processing',
      featureImportance: rawResults.feature_importance || [],
      statistics: {
        total: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        stdDev: 0
      },
      targetVariable: rawResults.model_info?.target_variable || 'unknown'
    };
  }

  /**
   * Extract brand names from query for brand-difference analysis
   */
  private extractBrandsFromQuery(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    
    // Tax service brands for brand difference analysis
    const taxBrands = ['turbotax', 'turbo tax', 'h&r block', 'hrblock', 'hr block'];
    
    // Athletic shoe brands (legacy support)
    const athleticBrands = ['nike', 'adidas', 'puma', 'underarmour', 'newbalance', 'skechers', 'jordan', 'converse', 'vans', 'reebok'];
    
    // Combine both lists
    const allBrands = [...taxBrands, ...athleticBrands];
    
    const foundBrands: Array<{brand: string, position: number}> = [];
    
    // Find brands and their positions in the query
    for (const brand of allBrands) {
      const position = lowerQuery.indexOf(brand);
      if (position !== -1) {
        // Normalize the brand name
        let normalizedBrand = brand;
        if (brand.includes('turbo')) {
          normalizedBrand = 'turbotax';
        } else if (brand.includes('h&r') || brand.includes('hr')) {
          normalizedBrand = 'h&r block';
        }
        
        // Only add if not already found
        if (!foundBrands.some(f => f.brand === normalizedBrand)) {
          foundBrands.push({ brand: normalizedBrand, position });
        }
      }
    }
    
    // Sort by position in query and return just the brand names
    const orderedBrands = foundBrands
      .sort((a, b) => a.position - b.position)
      .map(f => f.brand);
    
    console.log(`[DataProcessor] Extracted brands from query "${query}":`, orderedBrands);
    return orderedBrands;
  }
}

/**
 * Default data processor - handles basic data standardization
 * Used as fallback when no specialized processor is available
 */
class DefaultDataProcessor implements DataProcessorStrategy {
  validate(rawData: RawAnalysisResult): boolean {
    return rawData && typeof rawData === 'object' && rawData.success !== undefined;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    if (!rawData.success) {
      throw new Error(rawData.error || 'Analysis failed');
    }

    const records = (rawData.results || []).map((record: any, index: number) => ({
      area_id: record.area_id || record.id || `area_${index}`,
      area_name: record.area_name || record.name || `Area ${index + 1}`,
      value: typeof record.value === 'number' ? record.value : 
             typeof record.score === 'number' ? record.score : 0,
      rank: record.rank || index + 1,
      category: record.category || 'default',
      coordinates: record.coordinates || [0, 0],
      properties: this.extractProperties(record),
      shapValues: record.shap_values || {}
    }));

    // Calculate basic statistics
    const values = records.map(r => r.value).filter(v => !isNaN(v));
    const statistics = this.calculateStatistics(values);

    return {
      type: 'default_analysis',
      records,
      summary: rawData.summary || `Processed ${records.length} records using default processor`,
      featureImportance: rawData.feature_importance || [],
      statistics,
      targetVariable: rawData.model_info?.target_variable || 'value'
    };
  }

  private extractProperties(record: any): Record<string, any> {
    const internalFields = new Set([
      'area_id', 'id', 'area_name', 'name', 'value', 'score', 
      'coordinates', 'shap_values', 'rank', 'category'
    ]);
    
    const properties: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(record)) {
      if (!internalFields.has(key)) {
        properties[key] = value;
      }
    }
    
    return properties;
  }

  private calculateStatistics(values: number[]) {
    if (values.length === 0) {
      return {
        total: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        stdDev: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const total = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / total;
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    const median = total % 2 === 0 
      ? (sorted[total / 2 - 1] + sorted[total / 2]) / 2
      : sorted[Math.floor(total / 2)];

    return {
      total,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev
    };
  }
}

/**
 * Legacy function name for filtering national parks
 * Now delegates to the centralized analysis lens
 * 
 * @deprecated Use analysisFeatures() directly from analysisLens.ts
 */
export function filterNationalParksFromAnalysis(records: any[]): any[] {
  return analysisFeatures(records);
}

/**
 * Alternative legacy name
 * @deprecated Use analysisFeatures() directly from analysisLens.ts
 */
export function excludeParksFromAnalysis(records: any[]): any[] {
  return analysisFeatures(records);
}

/**
 * Process analysis data with filtering
 * @deprecated Use analysisFeatures() directly from analysisLens.ts
 */
export function processAnalysisData(data: any[]): any[] {
  return analysisFeatures(data);
} 