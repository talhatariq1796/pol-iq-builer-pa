/**
 * Geo-Awareness Engine
 * 
 * Comprehensive geographic query processing and filtering system that works
 * reliably with any endpoint and data format. Provides intelligent geographic
 * entity recognition, hierarchy support, and efficient filtering.
 */

export interface GeographicEntity {
  name: string;
  type: 'country' | 'state' | 'metro' | 'county' | 'city' | 'borough' | 'neighborhood' | 'zipcode' |
        'airport' | 'train_station' | 'bus_terminal' | 'ferry_terminal' | 'port' |
        'university' | 'college' | 'school_district' |
        'hospital' | 'medical_center' | 'clinic' |
        'venue' | 'stadium' | 'arena' | 'theater' | 'museum' |
        'shopping_center' | 'business_district' | 'industrial_zone' | 'market' |
        'landmark' | 'park' | 'monument' | 'attraction' |
        'bridge' | 'tunnel' | 'highway_interchange' | 'transit_hub' |
        'river' | 'bay' | 'mountain' | 'beach' |
        'government_building' | 'capitol' | 'embassy';
  aliases: string[];
  parentEntity?: string;
  childEntities?: string[];
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zipCodes?: string[];
  confidence: number;
  address?: string;
  category?: string;
}

export interface GeoQuery {
  originalQuery: string;
  entities: GeographicEntity[];
  queryType: 'single_location' | 'comparison' | 'regional' | 'proximity' | 'non_geographic';
  spatialRelation?: 'within' | 'near' | 'contains' | 'intersects' | 'none';
  radius?: number | null; // in miles
}

export interface GeoFilterResult {
  filteredRecords: any[];
  matchedEntities: GeographicEntity[];
  filterStats: {
    totalRecords: number;
    matchedRecords: number;
    filterMethod: string;
    processingTimeMs: number;
  };
  fallbackUsed?: boolean;
  warnings?: string[];
}

/**
 * Main geo-awareness engine that provides reliable geographic filtering
 */
export class GeoAwarenessEngine {
  private static instance: GeoAwarenessEngine | null = null;
  
  // Geographic hierarchy and lookup maps
  private geographicHierarchy: Map<string, GeographicEntity> = new Map();
  private zipCodeToCity: Map<string, string> = new Map();
  private zipCodeToCounty: Map<string, string> = new Map();
  private zipCodeToMetro: Map<string, string> = new Map();
  private zipCodeToState: Map<string, string> = new Map();
  private aliasMap: Map<string, string> = new Map();
  
  // Field priority for different data sources
  private fieldPriorities = {
    zipCode: ['ZIP_CODE', 'FSA_ID', 'ID', 'geo_id', 'zipcode'],
    description: ['DESCRIPTION', 'area_name', 'value_DESCRIPTION', 'name'],
    city: ['city', 'admin2_name', 'admin4_name'],
    state: ['state', 'admin1_name'],
    coordinates: ['latitude', 'longitude', 'lat', 'lng', 'centroid']
  };

  private constructor() {
    // Defer initialization to avoid blocking on startup
    // Will initialize on first use
  }

  public static getInstance(): GeoAwarenessEngine {
    if (!GeoAwarenessEngine.instance) {
      GeoAwarenessEngine.instance = new GeoAwarenessEngine();
    }
    return GeoAwarenessEngine.instance;
  }

  /**
   * Main entry point - parse geographic query and filter data
   */
  public async processGeoQuery(
    query: string, 
    records: any[], 
    endpoint?: string
  ): Promise<GeoFilterResult> {
    const startTime = Date.now();
    
    // Initialize geographic data on first use
    if (this.geographicHierarchy.size === 0) {
      this.initializeGeographicData();
    }
    
    try {
      console.log('[GeoAwarenessEngine] Processing geo query:', query);
      
      // Step 1: Parse geographic entities from query
      const geoQuery = await this.parseGeographicQuery(query);
      
      if (geoQuery.entities.length === 0) {
        return {
          filteredRecords: records,
          matchedEntities: [],
          filterStats: {
            totalRecords: records.length,
            matchedRecords: records.length,
            filterMethod: 'no_filter',
            processingTimeMs: Date.now() - startTime
          }
        };
      }

      // Step 2: Apply geographic filtering
      const filterResult = await this.applyGeographicFilter(records, geoQuery);
      
      // Step 3: Enhance with processing metadata
      filterResult.filterStats.processingTimeMs = Date.now() - startTime;
      
      console.log('[GeoAwarenessEngine] Filtering complete:', {
        entities: geoQuery.entities.length,
        originalRecords: records.length,
        filteredRecords: filterResult.filteredRecords.length,
        method: filterResult.filterStats.filterMethod
      });

      return filterResult;
      
    } catch (error) {
      console.error('[GeoAwarenessEngine] Error processing geo query:', error);
      
      // Return original data on error to avoid breaking analysis
      return {
        filteredRecords: records,
        matchedEntities: [],
        filterStats: {
          totalRecords: records.length,
          matchedRecords: records.length,
          filterMethod: 'error_fallback',
          processingTimeMs: Date.now() - startTime
        },
        warnings: [`Geographic filtering failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Parse geographic entities from natural language query
   */
  private async parseGeographicQuery(query: string): Promise<GeoQuery> {
    const entities: GeographicEntity[] = [];
    const queryLower = query.toLowerCase();
    
    console.log(`🔍 [GEO DEBUG] Parsing query: "${query}"`);
    
    // STEP 1: Check for explicit geographic intent indicators
    const hasExplicitGeoIntent = this.hasExplicitGeographicIntent(queryLower);
    
    if (!hasExplicitGeoIntent) {
      console.log(`🚫 [GEO DEBUG] Query lacks explicit geographic intent - skipping geographic filtering`);
      return {
        originalQuery: query,
        entities: [],
        queryType: 'non_geographic',
        spatialRelation: 'none',
        radius: null
      };
    }
    
    // STEP 2: Only proceed with matching if we have clear geographic intent
    console.log(`✅ [GEO DEBUG] Query has explicit geographic intent - proceeding with matching`);
    
    // Method 1: Direct entity matching with hierarchy (most reliable)
    const directMatches = this.findDirectMatches(queryLower);
    console.log(`🔍 [GEO DEBUG] Direct matches:`, directMatches.map(e => ({ name: e.name, type: e.type })));
    console.log(`🔍 [GEO DEBUG] Direct match details:`, directMatches.map(e => ({ 
      name: e.name, 
      type: e.type, 
      parentEntity: e.parentEntity,
      zipCodesCount: e.zipCodes?.length || 0
    })));
    entities.push(...directMatches);
    
    // Method 2: ZIP code pattern matching (very reliable)
    const zipMatches = this.findZipCodeMatches(query);
    console.log(`🔍 [GEO DEBUG] ZIP matches:`, zipMatches.map(e => ({ name: e.name, type: e.type })));
    entities.push(...zipMatches);
    
    // Method 3: Regional pattern matching (reliable)
    const regionalMatches = this.findRegionalMatches(queryLower);
    console.log(`🔍 [GEO DEBUG] Regional matches:`, regionalMatches.map(e => ({ name: e.name, type: e.type })));
    entities.push(...regionalMatches);
    
    // Method 4: Fuzzy matching ONLY if we already have strong geographic intent and no matches yet
    if (entities.length === 0 && this.hasStrongGeographicSignals(queryLower)) {
      const fuzzyMatches = this.findFuzzyMatches(queryLower);
      console.log(`🔍 [GEO DEBUG] Fuzzy matches (with strong signals):`, fuzzyMatches.map(e => ({ name: e.name, type: e.type })));
      entities.push(...fuzzyMatches);
    } else if (entities.length === 0) {
      console.log(`🚫 [GEO DEBUG] No geographic entities found and no strong geographic signals - treating as non-geographic query`);
    }
    
    // Determine query type
    let queryType: GeoQuery['queryType'] = 'single_location';
    if (entities.length >= 2) {
      queryType = 'comparison';
    } else if (this.isRegionalQuery(queryLower)) {
      queryType = 'regional';
    } else if (this.isProximityQuery(queryLower)) {
      queryType = 'proximity';
    }
    
    return {
      originalQuery: query,
      entities: this.deduplicateEntities(entities),
      queryType,
      spatialRelation: this.determineSpatialRelation(queryLower),
      radius: this.extractRadius(query)
    };
  }

  /**
   * Apply geographic filtering using multiple strategies
   */
  private async applyGeographicFilter(
    records: any[], 
    geoQuery: GeoQuery
  ): Promise<GeoFilterResult> {
    
    // PRE-FILTER: Remove street names and business names before any geographic matching
    const geographicallyEligibleRecords = this.filterOutNonGeographicLocations(records);
    
    console.log(`[GeoAwarenessEngine] Pre-filtered records: ${records.length} -> ${geographicallyEligibleRecords.length} (removed street names/businesses)`);
    
    const strategies = [
      { method: 'zipcode_lookup', fn: this.filterByZipCode.bind(this) },
      { method: 'hierarchical', fn: this.filterByHierarchy.bind(this) },
      { method: 'description_pattern', fn: this.filterByDescriptionPattern.bind(this) },
      { method: 'field_scanning', fn: this.filterByFieldScanning.bind(this) },
      { method: 'fuzzy_matching', fn: this.filterByFuzzyMatching.bind(this) }
    ];

    let bestResult: GeoFilterResult | null = null;
    let fallbackUsed = false;

    for (const strategy of strategies) {
      try {
        const result = await strategy.fn(geographicallyEligibleRecords, geoQuery);
        
        // Use this result if it found matches or if we don't have a result yet
        if (!bestResult || result.filteredRecords.length > 0) {
          bestResult = {
            ...result,
            filterStats: {
              ...result.filterStats,
              totalRecords: records.length, // Use original count for stats
              filterMethod: strategy.method
            }
          };
          
          // Stop if we found good matches (>5% of total records or >10 records)
          const matchRate = result.filteredRecords.length / records.length;
          if (matchRate > 0.05 || result.filteredRecords.length >= 10) {
            break;
          }
        }
      } catch (error) {
        console.warn(`[GeoAwarenessEngine] Strategy ${strategy.method} failed:`, error);
        fallbackUsed = true;
      }
    }

    // Final fallback - return pre-filtered records if no strategy worked
    if (!bestResult || bestResult.filteredRecords.length === 0) {
      bestResult = {
        filteredRecords: geographicallyEligibleRecords,
        matchedEntities: geoQuery.entities,
        filterStats: {
          totalRecords: records.length, // Original count for stats
          matchedRecords: geographicallyEligibleRecords.length,
          filterMethod: 'no_matches_fallback',
          processingTimeMs: 0
        },
        fallbackUsed: true,
        warnings: ['No geographic matches found, showing pre-filtered data (street names excluded)']
      };
    }

    if (bestResult) {
      bestResult.fallbackUsed = fallbackUsed;
      return bestResult;
    }
    
    // This should never happen, but provide a safe fallback
    return {
      filteredRecords: records,
      matchedEntities: [],
      filterStats: {
        totalRecords: records.length,
        matchedRecords: records.length,
        filterMethod: 'error_fallback',
        processingTimeMs: 0
      },
      fallbackUsed: true,
      warnings: ['Unexpected error in filtering strategies']
    };
  }

  /**
   * Pre-filter to remove non-geographic locations (street names, businesses) before any matching
   * This ensures street names like "Philadelphia Street" or "Brooklyn Avenue" don't get matched
   */
  private filterOutNonGeographicLocations(records: any[]): any[] {
    const streetSuffixes = [
      'street', 'st', 'avenue', 'ave', 'road', 'rd', 'lane', 'ln', 'drive', 'dr',
      'boulevard', 'blvd', 'court', 'ct', 'place', 'pl', 'way', 'circle', 'cir',
      'square', 'sq', 'plaza', 'pkwy', 'parkway', 'terrace', 'ter', 'highway', 'hwy'
    ];
    
    const businessKeywords = [
      'restaurant', 'diner', 'cafe', 'bar', 'grill', 'pizza', 'wings', 'store',
      'shop', 'mall', 'center', 'hotel', 'motel', 'inn', 'club', 'gym', 'spa'
    ];

    return records.filter(record => {
      const areaName = (record.area_name || '').toLowerCase();
      const description = (record.DESCRIPTION || '').toLowerCase();
      const fullText = `${areaName} ${description}`.toLowerCase();

      // Check for street suffixes in the area name or description
      const hasStreetSuffix = streetSuffixes.some(suffix => {
        // Match street suffix as whole word or at end of phrase
        const streetPattern = new RegExp(`\\b${suffix}\\b|${suffix}$`, 'i');
        return streetPattern.test(fullText);
      });

      // Check for business names
      const isBusinessName = businessKeywords.some(keyword => {
        const businessPattern = new RegExp(`\\b${keyword}\\b`, 'i');
        return businessPattern.test(fullText);
      });

      // Keep record only if it's NOT a street name and NOT a business
      return !hasStreetSuffix && !isBusinessName;
    });
  }

  /**
   * Filter using geographic hierarchy (most reliable)
   */
  private async filterByHierarchy(
    records: any[], 
    geoQuery: GeoQuery
  ): Promise<GeoFilterResult> {
    
    const matchedRecords: any[] = [];
    const matchedEntities: GeographicEntity[] = [];

    for (const entity of geoQuery.entities) {
      // Get all child entities (e.g., if querying "New York", include all boroughs)
      const targetEntities = this.expandEntityHierarchy(entity);
      
      for (const record of records) {
        if (this.recordMatchesEntity(record, targetEntities)) {
          matchedRecords.push(record);
          if (!matchedEntities.find(e => e.name === entity.name)) {
            matchedEntities.push(entity);
          }
        }
      }
    }

    return {
      filteredRecords: this.deduplicateRecords(matchedRecords),
      matchedEntities,
      filterStats: {
        totalRecords: records.length,
        matchedRecords: matchedRecords.length,
        filterMethod: 'hierarchical',
        processingTimeMs: 0
      }
    };
  }

  /**
   * Filter by description field patterns (fallback for current format)
   */
  private async filterByDescriptionPattern(
    records: any[], 
    geoQuery: GeoQuery
  ): Promise<GeoFilterResult> {
    
    const matchedRecords: any[] = [];
    const matchedEntities: GeographicEntity[] = [];

    for (const entity of geoQuery.entities) {
      const patterns = this.createDescriptionPatterns(entity);
      
      for (const record of records) {
        const description = this.extractDescription(record);
        
        if (patterns.some(pattern => pattern.test(description))) {
          matchedRecords.push(record);
          if (!matchedEntities.find(e => e.name === entity.name)) {
            matchedEntities.push(entity);
          }
        }
      }
    }

    return {
      filteredRecords: this.deduplicateRecords(matchedRecords),
      matchedEntities,
      filterStats: {
        totalRecords: records.length,
        matchedRecords: matchedRecords.length,
        filterMethod: 'description_pattern',
        processingTimeMs: 0
      }
    };
  }

  /**
   * Filter by ZIP code lookup
   */
  private async filterByZipCode(
    records: any[], 
    geoQuery: GeoQuery
  ): Promise<GeoFilterResult> {
    
    const matchedRecords: any[] = [];
    const matchedEntities: GeographicEntity[] = [];

    // Build target ZIP codes from entities using Phase 1 multi-level mapping
    const targetZipCodes = new Set<string>();
    
    for (const entity of geoQuery.entities) {
      // For cities, only use their direct ZIP codes (not expanded regions)
      if (entity.type === 'city' || entity.type === 'borough' || entity.type === 'neighborhood') {
        entity.zipCodes?.forEach(zip => targetZipCodes.add(zip));
        console.log(`[GeoAwarenessEngine] Adding ${entity.zipCodes?.length || 0} ZIP codes for city: ${entity.name}`);
      }
      // Only expand ZIP codes for broader entities if no specific cities were mentioned
      else if (geoQuery.entities.every(e => e.type !== 'city' && e.type !== 'borough')) {
        // Phase 1: Multi-level ZIP code mapping for broader entities
        const entityName = entity.name.toLowerCase();
        
        // If this is a county, get all ZIP codes for that county
        if (entity.type === 'county') {
          for (const [zipCode, countyName] of this.zipCodeToCounty) {
            if (countyName === entityName) {
              targetZipCodes.add(zipCode);
            }
          }
        }
        
        // If this is a metro area, get all ZIP codes for that metro
        if (entity.type === 'metro') {
          for (const [zipCode, metroName] of this.zipCodeToMetro) {
            if (metroName === entityName) {
              targetZipCodes.add(zipCode);
            }
          }
        }
        
        // If this is a state, get all ZIP codes for that state
        if (entity.type === 'state') {
          for (const [zipCode, stateName] of this.zipCodeToState) {
            if (stateName === entityName) {
              targetZipCodes.add(zipCode);
            }
          }
        }
      }
    }
    
    console.log(`[GeoAwarenessEngine] Phase 1 ZIP filtering: Found ${targetZipCodes.size} target ZIP codes for entities:`, 
                geoQuery.entities.map(e => `${e.name} (${e.type})`));

    if (targetZipCodes.size === 0) {
      return {
        filteredRecords: [],
        matchedEntities: [],
        filterStats: {
          totalRecords: records.length,
          matchedRecords: 0,
          filterMethod: 'zipcode_lookup',
          processingTimeMs: 0
        }
      };
    }

    for (const record of records) {
      const zipCode = this.extractZipCode(record);
      
      if (zipCode && targetZipCodes.has(zipCode)) {
        matchedRecords.push(record);
      }
    }

    return {
      filteredRecords: matchedRecords,
      matchedEntities: geoQuery.entities,
      filterStats: {
        totalRecords: records.length,
        matchedRecords: matchedRecords.length,
        filterMethod: 'zipcode_lookup',
        processingTimeMs: 0
      }
    };
  }

  /**
   * Filter by scanning all available fields
   */
  private async filterByFieldScanning(
    records: any[], 
    geoQuery: GeoQuery
  ): Promise<GeoFilterResult> {
    
    const matchedRecords: any[] = [];
    const matchedEntities: GeographicEntity[] = [];

    for (const entity of geoQuery.entities) {
      const searchTerms = [entity.name, ...entity.aliases].map(term => term.toLowerCase());
      
      for (const record of records) {
        const recordText = this.extractAllTextFields(record).toLowerCase();
        
        if (searchTerms.some(term => recordText.includes(term))) {
          matchedRecords.push(record);
          if (!matchedEntities.find(e => e.name === entity.name)) {
            matchedEntities.push(entity);
          }
        }
      }
    }

    return {
      filteredRecords: this.deduplicateRecords(matchedRecords),
      matchedEntities,
      filterStats: {
        totalRecords: records.length,
        matchedRecords: matchedRecords.length,
        filterMethod: 'field_scanning',
        processingTimeMs: 0
      }
    };
  }

  /**
   * Filter using fuzzy string matching
   */
  private async filterByFuzzyMatching(
    records: any[], 
    geoQuery: GeoQuery
  ): Promise<GeoFilterResult> {
    
    const matchedRecords: any[] = [];
    const matchedEntities: GeographicEntity[] = [];

    for (const entity of geoQuery.entities) {
      for (const record of records) {
        if (this.fuzzyMatchRecord(record, entity)) {
          matchedRecords.push(record);
          if (!matchedEntities.find(e => e.name === entity.name)) {
            matchedEntities.push(entity);
          }
        }
      }
    }

    return {
      filteredRecords: this.deduplicateRecords(matchedRecords),
      matchedEntities,
      filterStats: {
        totalRecords: records.length,
        matchedRecords: matchedRecords.length,
        filterMethod: 'fuzzy_matching',
        processingTimeMs: 0
      }
    };
  }

  // === UTILITY METHODS ===

  private initializeGeographicData(): void {
    try {
      // Load geographic data from GeoDataManager
      const { GeoDataManager } = require('./GeoDataManager');
      const dataManager = GeoDataManager.getInstance();
      const database = dataManager.getDatabase();
      
      this.geographicHierarchy = database.entities;
      this.zipCodeToCity = database.zipCodeToCity;
      this.zipCodeToCounty = database.zipCodeToCounty;
      this.zipCodeToMetro = database.zipCodeToMetro;
      this.zipCodeToState = database.zipCodeToState;
      this.aliasMap = database.aliasMap;
      
      console.log('[GeoAwarenessEngine] Loaded Phase 1 multi-level geographic data:', {
        entities: this.geographicHierarchy.size,
        zipToCity: this.zipCodeToCity.size,
        zipToCounty: this.zipCodeToCounty.size,
        zipToMetro: this.zipCodeToMetro.size,
        zipToState: this.zipCodeToState.size,
        aliases: this.aliasMap.size
      });
    } catch (error) {
      console.error('[GeoAwarenessEngine] Failed to initialize geographic data:', error);
      // Initialize with empty maps to prevent crashes
      this.geographicHierarchy = new Map();
      this.zipCodeToCity = new Map();
      this.zipCodeToCounty = new Map();
      this.zipCodeToMetro = new Map();
      this.zipCodeToState = new Map();
      this.aliasMap = new Map();
    }
  }

  /**
   * Check if query has explicit geographic intent indicators
   */
  private hasExplicitGeographicIntent(query: string): boolean {
    const queryLower = query.toLowerCase();
    
    // Method 1: Check for explicit geographic prepositions
    const geoPrepositions = [
      /\bin\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)*)/,  // "in Brooklyn", "in New York"
      /\bfrom\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)*)/,  // "from Manhattan"
      /\bnear\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)*)/,  // "near Philadelphia"
      /\baround\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)*)/,  // "around Boston"
      /\bacross\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)*)/,  // "across New Jersey"
    ];
    
    // Method 2: Check for geographic comparison patterns (but exclude business markets)
    const geoComparisons = [
      /\bcompare.*\b(cities|states|regions|areas|locations)\b/i,
      /\b(cities|states|regions|areas|locations).*\bcompare\b/i,
      /\bbetween\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+and\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*/,  // "between NYC and LA"
      // Only include "markets" if it's explicitly geographic context
      /\bcompare.*\b(geographic|regional|local)\s+markets\b/i,
      /\bcompare.*\b(housing|real\s+estate)\s+markets\s+(in|across|between)\b/i,
    ];
    
    // Method 3: Check for explicit location codes
    const locationCodes = [
      /\bzip\s*code/i,
      /\bpostal\s*code/i,
      /\bfsa\b/i,  // Forward Sortation Area
      /\b\d{5}(-\d{4})?\b/,      // ZIP code pattern
      /\b[A-Z]\d[A-Z]\b/,        // FSA pattern (H1A, G2B, etc.)
    ];
    
    // Method 4: Dynamic check against geographic database entities
    const hasKnownGeographicEntity = this.queryContainsGeographicEntity(queryLower);
    
    // Method 5: Check for geographic analysis terms
    const geoAnalysisTerms = [
      /\bgeographic/i,
      /\bregional/i,
      /\bspatial/i,
      /\bdemographic/i
    ];
    
    // Method 6: Check for location-specific terms
    const locationTerms = [
      /\blocal/i,
      /\bneighborhood/i,
      /\bborough/i,
      /\bcounty/i,
      /\bstate\s+(by|comparison|analysis|trends)/i,
      /\bcity\s+(by|comparison|analysis|trends)/i,
      /\bmap\s+of/i,
      /\bshow\s+me\s+(where|locations|places)/i,
      /\bfind\s+(locations|places|areas)/i
    ];
    
    // Check for business/commercial context that should exclude geographic filtering
    const businessContextPatterns = [
      /\b(strategic|target|competitive|business|investment|financial)\s+markets?\b/i,
      /\b(market\s+)?(analysis|research|segmentation|opportunity|potential)\b/i,
      /\btop\s+\d*\s*(strategic|performing|profitable|investment)\s+\w*\s*markets?\b/i,
      /\bmarket\s+(share|size|penetration|expansion|opportunities?)\b/i,
      /\b(emerging|growth|niche|vertical|consumer)\s+markets?\b/i
    ];
    
    // If query has business context, require much stronger geographic indicators
    const hasBusinessContext = businessContextPatterns.some(pattern => pattern.test(query));
    
    const allPatterns = [
      ...geoPrepositions,
      ...geoComparisons, 
      ...locationCodes,
      ...geoAnalysisTerms,
      ...locationTerms
    ];
    
    const hasGeographicPatterns = allPatterns.some(pattern => pattern.test(query));
    
    // If business context detected, only allow geographic filtering with explicit geographic patterns
    if (hasBusinessContext) {
      console.log(`🚫 [GEO DEBUG] Business context detected - requiring explicit geographic indicators`);
      // For business queries, require explicit geographic prepositions or location codes
      const explicitGeoPatterns = [...geoPrepositions, ...locationCodes];
      const hasExplicitGeo = explicitGeoPatterns.some(pattern => pattern.test(query));
      console.log(`🚫 [GEO DEBUG] Explicit geographic patterns found: ${hasExplicitGeo}`);
      return hasExplicitGeo;
    }
    
    console.log(`✅ [GEO DEBUG] No business context - using standard geographic detection`);
    console.log(`✅ [GEO DEBUG] Geographic patterns: ${hasGeographicPatterns}, Known entities: ${hasKnownGeographicEntity}`);
    
    // Return true if query matches any pattern OR contains known geographic entities  
    return hasGeographicPatterns || hasKnownGeographicEntity;
  }

  /**
   * Dynamically check if query contains any geographic entities from the database
   */
  private queryContainsGeographicEntity(query: string): boolean {
    const queryWords = query.toLowerCase().split(/\s+/);
    
    // Check each word and phrase against our geographic entities
    for (const [entityName, entity] of this.geographicHierarchy) {
      // Check exact entity name
      if (query.includes(entityName)) {
        return true;
      }
      
      // Check aliases
      if (entity.aliases) {
        for (const alias of entity.aliases) {
          if (query.includes(alias.toLowerCase())) {
            return true;
          }
        }
      }
    }
    
    // Check multi-word phrases
    for (let i = 0; i < queryWords.length - 1; i++) {
      const twoWordPhrase = `${queryWords[i]} ${queryWords[i + 1]}`;
      if (this.geographicHierarchy.has(twoWordPhrase)) {
        return true;
      }
      
      // Check three-word phrases
      if (i < queryWords.length - 2) {
        const threeWordPhrase = `${queryWords[i]} ${queryWords[i + 1]} ${queryWords[i + 2]}`;
        if (this.geographicHierarchy.has(threeWordPhrase)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check for strong geographic signals that would justify fuzzy matching
   */
  private hasStrongGeographicSignals(query: string): boolean {
    const strongSignals = [
      // Multi-word location patterns (even if not in our database)
      /\b[A-Z][a-z]+\s+(City|County|Beach|Park|Valley|Heights|Hills|Lake|River)\b/,
      /\b(North|South|East|West|New|Old|Upper|Lower)\s+[A-Z][a-z]+\b/,
      
      // Common location suffixes
      /\b[A-Z][a-z]+\s*,\s*[A-Z]{2}\b/,  // "Brooklyn, NY"
      /\b[A-Z][a-z]+\s+(Avenue|Street|Road|Boulevard|Drive)\b/,
      
      // Regional indicators
      /\b(downtown|uptown|midtown|suburbs|metro|metropolitan)\b/i,
      /\b(northern|southern|eastern|western)\s+[a-z]+/i
    ];
    
    return strongSignals.some(pattern => pattern.test(query));
  }

  /**
   * Find direct matches in geographic hierarchy
   */
  private findDirectMatches(query: string): GeographicEntity[] {
    const allMatches: GeographicEntity[] = [];
    const queryLower = query.toLowerCase();
    
    // Look for multi-word matches first (more specific)
    const phrases = this.extractPhrases(query);
    for (const phrase of phrases) {
      const entity = this.geographicHierarchy.get(phrase.toLowerCase());
      if (entity) {
        allMatches.push(entity);
      }
    }
    
    // Look for alias matches - but require word boundaries to avoid partial matches
    for (const [alias, entityName] of this.aliasMap) {
      // Use word boundaries to avoid partial matches like "TR" matching in "Montreal"
      const aliasRegex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (aliasRegex.test(queryLower)) {
        const entity = this.geographicHierarchy.get(entityName);
        if (entity) {
          allMatches.push(entity);
        }
      }
    }
    
    // Look for single word matches (less specific) - but only for cities/specific entities
    const words = query.toLowerCase().split(/\s+/);
    for (const word of words) {
      const entity = this.geographicHierarchy.get(word);
      // Only include specific entities (cities, boroughs), not broad geographic entities like states
      if (entity && (entity.type === 'city' || entity.type === 'borough' || entity.type === 'neighborhood')) {
        allMatches.push(entity);
      }
    }
    
    // Remove duplicates and prioritize more specific matches
    const uniqueMatches = this.deduplicateAndPrioritizeMatches(allMatches, queryLower);
    
    return uniqueMatches;
  }

  /**
   * Remove duplicate matches and prioritize more specific ones
   */
  private deduplicateAndPrioritizeMatches(matches: GeographicEntity[], query: string): GeographicEntity[] {
    if (matches.length <= 1) return matches;
    
    // Remove exact duplicates
    const uniqueMatches = matches.filter((match, index, self) => 
      index === self.findIndex(m => m.name === match.name && m.type === match.type)
    );
    
    // For Quebec/Quebec City case, prioritize the more specific match
    const cityMatches = uniqueMatches.filter(m => m.type === 'city');
    const stateMatches = uniqueMatches.filter(m => m.type === 'state');
    
    // If we have both "Quebec City" (city) and "Quebec" (state), prefer the city
    if (cityMatches.some(m => m.name.toLowerCase().includes('quebec')) && 
        stateMatches.some(m => m.name.toLowerCase() === 'quebec')) {
      return uniqueMatches.filter(m => !(m.type === 'state' && m.name.toLowerCase() === 'quebec'));
    }
    
    return uniqueMatches;
  }

  /**
   * Find ZIP code patterns in query
   */
  private findZipCodeMatches(query: string): GeographicEntity[] {
    const matches: GeographicEntity[] = [];
    
    // Look for 5-digit ZIP codes
    const zipPattern = /\b\d{5}\b/g;
    const zipMatches = query.match(zipPattern);
    
    if (zipMatches) {
      for (const zip of zipMatches) {
        const cityName = this.zipCodeToCity.get(zip);
        if (cityName) {
          const entity = this.geographicHierarchy.get(cityName);
          if (entity) {
            matches.push(entity);
          }
        }
      }
    }
    
    return matches;
  }

  /**
   * Find regional matches (Northeast, West Coast, etc.)
   */
  private findRegionalMatches(query: string): GeographicEntity[] {
    const matches: GeographicEntity[] = [];
    const lowerQuery = query.toLowerCase();
    
    const regionalPatterns = [
      { pattern: /\b(northeast|northeastern|north east)\b/, region: 'northeastern united states' },
      { pattern: /\b(southeast|southeastern|south east)\b/, region: 'southeastern united states' },
      { pattern: /\b(midwest|midwestern|middle west)\b/, region: 'midwestern united states' },
      { pattern: /\b(southwest|southwestern|south west)\b/, region: 'southwestern united states' },
      { pattern: /\b(west coast|western)\b/, region: 'western united states' },
      { pattern: /\b(east coast|eastern)\b/, region: 'eastern united states' },
      { pattern: /\b(pacific northwest|pnw)\b/, region: 'pacific northwest' },
      { pattern: /\b(new england)\b/, region: 'new england' },
      { pattern: /\b(bay area|sf bay)\b/, region: 'bay area' },
      { pattern: /\b(silicon valley)\b/, region: 'silicon valley' },
      { pattern: /\b(los angeles metro|la metro|greater los angeles)\b/, region: 'los angeles metro' },
      { pattern: /\b(dallas fort worth|dfw|metroplex)\b/, region: 'dfw' },
      { pattern: /\b(south florida|sofla)\b/, region: 'south florida' },
      { pattern: /\b(tampa bay)\b/, region: 'tampa bay' }
    ];
    
    for (const { pattern, region } of regionalPatterns) {
      if (pattern.test(lowerQuery)) {
        // Create a regional entity
        const entity: GeographicEntity = {
          name: region,
          type: 'metro',
          aliases: [],
          confidence: 0.8
        };
        matches.push(entity);
      }
    }
    
    return matches;
  }

  /**
   * Find fuzzy matches for typos and variations
   */
  private findFuzzyMatches(query: string): GeographicEntity[] {
    const matches: GeographicEntity[] = [];
    const words = query.toLowerCase().split(/\s+/);
    
    // Check aliases first
    for (const word of words) {
      const canonical = this.aliasMap.get(word);
      if (canonical) {
        const entity = this.geographicHierarchy.get(canonical);
        if (entity) {
          matches.push(entity);
        }
      }
    }
    
    // Simple fuzzy matching using edit distance
    if (matches.length === 0) {
      for (const word of words) {
        if (word.length >= 4) { // Only fuzzy match longer words
          for (const [entityName, entity] of this.geographicHierarchy) {
            if (this.editDistance(word, entityName) <= 2) {
              matches.push(entity);
              break; // Only take first fuzzy match per word
            }
          }
        }
      }
    }
    
    return matches;
  }

  /**
   * Check if query is about a region
   */
  private isRegionalQuery(query: string): boolean {
    const regionalKeywords = [
      'region', 'area', 'coast', 'northeast', 'southeast', 'midwest', 
      'southwest', 'west coast', 'east coast', 'new england', 'pacific northwest'
    ];
    
    const lowerQuery = query.toLowerCase();
    return regionalKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Check if query is about proximity
   */
  private isProximityQuery(query: string): boolean {
    const proximityKeywords = ['near', 'around', 'close to', 'within', 'nearby', 'radius'];
    const lowerQuery = query.toLowerCase();
    return proximityKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Determine spatial relationship from query
   */
  private determineSpatialRelation(query: string): 'within' | 'near' | 'contains' | 'intersects' | undefined {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('within') || lowerQuery.includes('inside')) return 'within';
    if (lowerQuery.includes('near') || lowerQuery.includes('around') || lowerQuery.includes('close')) return 'near';
    if (lowerQuery.includes('contains') || lowerQuery.includes('including')) return 'contains';
    if (lowerQuery.includes('overlap') || lowerQuery.includes('intersect')) return 'intersects';
    
    return undefined;
  }

  /**
   * Extract radius from query
   */
  private extractRadius(query: string): number | undefined {
    // Look for patterns like "within 5 miles", "10 mile radius"
    const radiusPatterns = [
      /within\s+(\d+)\s+miles?/i,
      /(\d+)\s+miles?\s+radius/i,
      /(\d+)\s*mi\b/i
    ];
    
    for (const pattern of radiusPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    
    return undefined;
  }

  /**
   * Remove duplicate entities
   */
  private deduplicateEntities(entities: GeographicEntity[]): GeographicEntity[] {
    const seen = new Set<string>();
    const filtered = entities.filter(entity => {
      const key = entity.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    
    // Additional filtering: if we have both a city and its parent region, keep only the city
    // This prevents matching both "Montreal" city and "Montréal" region
    const cityNames = new Set(filtered.filter(e => e.type === 'city').map(e => e.name.toLowerCase()));
    
    return filtered.filter(entity => {
      // If this is a region/county and we have a city with a similar name, exclude the region
      if (entity.type === 'county' || entity.type === 'state') {
        const entityNameBase = entity.name.toLowerCase().replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a');
        for (const cityName of cityNames) {
          const cityNameBase = cityName.replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a');
          // If the city and region names are similar (e.g., "Montreal" and "Montréal"), keep only the city
          if (entityNameBase === cityNameBase || entityNameBase.includes(cityNameBase) || cityNameBase.includes(entityNameBase)) {
            console.log(`🔍 [GEO DEBUG] Excluding region "${entity.name}" because city "${cityName}" is already matched`);
            return false;
          }
        }
      }
      return true;
    });
  }

  /**
   * Expand entity to include child entities
   */
  private expandEntityHierarchy(entity: GeographicEntity): GeographicEntity[] {
    const expanded = [entity];
    
    if (entity.childEntities) {
      for (const childName of entity.childEntities) {
        const childEntity = this.geographicHierarchy.get(childName.toLowerCase());
        if (childEntity) {
          expanded.push(childEntity);
        }
      }
    }
    
    return expanded;
  }

  /**
   * Check if record matches any of the target entities
   */
  private recordMatchesEntity(record: any, entities: GeographicEntity[]): boolean {
    for (const entity of entities) {
      // Check ZIP code match
      const recordZip = this.extractZipCode(record);
      if (recordZip && entity.zipCodes?.includes(recordZip)) {
        return true;
      }
      
      // Check description match with validation
      const description = this.extractDescription(record);
      const patterns = this.createDescriptionPatterns(entity);
      if (patterns.some(pattern => pattern.test(description))) {
        // Additional validation for description matches
        if (this.isValidLocationMatch(description, entity.name, entity)) {
          return true;
        }
      }
      
      // Check all text fields with context validation (prevent false positives)
      const allText = this.extractAllTextFields(record);
      const searchTerms = [entity.name, ...entity.aliases];
      
      for (const term of searchTerms) {
        const termLower = term.toLowerCase();
        const allTextLower = allText.toLowerCase();
        
        if (allTextLower.includes(termLower)) {
          // Additional validation for common false positive cases
          if (this.isValidLocationMatch(allText, term, entity)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Validate if a location match is genuine and not a false positive - GENERALIZED
   */
  private isValidLocationMatch(text: string, locationName: string, entity: GeographicEntity): boolean {
    const textLower = text.toLowerCase();
    const locationLower = locationName.toLowerCase();
    
    // Get state information for this entity
    const stateInfo = this.getStateInfo(entity);
    const validStates = [...stateInfo.abbreviations, ...stateInfo.fullNames].map(s => s.toLowerCase());
    
    // Reject if it's clearly a street name or other geographic false positive
    const streetSuffixes = ['avenue', 'street', 'road', 'boulevard', 'drive', 'lane', 'way', 'court', 'place'];
    const rejectPatterns = streetSuffixes.map(suffix => 
      new RegExp(`\\b${locationLower}\\s+${suffix}\\b`, 'i')
    );
    
    // Also reject if it's the same city name in a different state or business name
    const otherStateAbbrevs = ['al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nm', 'nc', 'nd', 'oh', 'ok', 'or', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy'];
    const invalidStatePatterns = otherStateAbbrevs
      .filter(state => !validStates.includes(state))
      .map(state => new RegExp(`\\b${locationLower}\\s*,\\s*(${state})\\b`, 'i'));
    
    // Reject business/restaurant names that just happen to include city names
    const businessPatterns = [
      new RegExp(`\\b${locationLower}\\s+(restaurant|diner|cafe|bar|grill|wild wings|pizza|burger|wings)\\b`, 'i'),
      new RegExp(`\\b${locationLower}\\s+(hotel|motel|inn|lodge|resort)\\b`, 'i'),
      new RegExp(`\\b${locationLower}\\s+(mall|shopping|outlet|center|plaza)\\b`, 'i')
    ];
    
    // Check for obvious false positives
    if (rejectPatterns.some(pattern => pattern.test(textLower)) ||
        invalidStatePatterns.some(pattern => pattern.test(textLower)) ||
        businessPatterns.some(pattern => pattern.test(textLower))) {
      return false;
    }
    
    // Accept if it has proper state context
    const validStatePatterns = validStates.map(state => 
      new RegExp(`\\b${locationLower}\\s*,\\s*${state}\\b`, 'i')
    );
    
    if (validStatePatterns.some(pattern => pattern.test(textLower))) {
      return true;
    }
    
    // Accept if it appears with parenthetical or comma context indicating it's a place
    const contextPatterns = [
      new RegExp(`\\(${locationLower}\\)`, 'i'),  // (CityName)
      new RegExp(`,\\s*${locationLower}(?!\\s+(avenue|street|road))`, 'i'),  // ", CityName" but not street
      new RegExp(`\\b${locationLower}\\)`, 'i'),  // CityName)
    ];
    
    if (contextPatterns.some(pattern => pattern.test(textLower))) {
      return true;
    }
    
    // For cities/boroughs, also check for neighborhood context
    if (entity.type === 'city' || entity.type === 'borough') {
      const neighborhoodContext = this.hasNeighborhoodContext(textLower, locationLower);
      if (neighborhoodContext) {
        return true;
      }
    }
    
    // Default: reject ambiguous matches without clear geographic context
    return false;
  }
  
  /**
   * Check if text contains neighborhood context for a city
   */
  private hasNeighborhoodContext(text: string, cityName: string): boolean {
    // Common neighborhood indicators
    const neighborhoodWords = ['downtown', 'uptown', 'midtown', 'center city', 'old city', 'university city', 
                               'heights', 'village', 'district', 'neighborhood', 'area'];
    
    return neighborhoodWords.some(word => 
      text.includes(`${word} ${cityName}`) || 
      text.includes(`${cityName} ${word}`) ||
      text.includes(`${word}, ${cityName}`) ||
      text.includes(`${cityName}, ${word}`)
    );
  }

  /**
   * Remove duplicate records
   */
  private deduplicateRecords(records: any[]): any[] {
    const seen = new Set<string>();
    return records.filter(record => {
      const key = record.area_id || record.id || JSON.stringify(record);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Create regex patterns for description matching
   */
  private createDescriptionPatterns(entity: GeographicEntity): RegExp[] {
    const patterns: RegExp[] = [];
    
    // Context-aware patterns to prevent false positives - GENERALIZED for all tri-state locations
    // Priority 1: Exact location with state/qualifier patterns (most precise)
    if (entity.type === 'city' || entity.type === 'borough') {
      const entityName = this.escapeRegex(entity.name);
      
      // Determine appropriate state abbreviations based on parent entity
      const stateInfo = this.getStateInfo(entity);
      
      // Pattern like "CityName, ST" or "CityName, StateName"
      if (stateInfo.abbreviations.length > 0) {
        const abbrevPattern = stateInfo.abbreviations.join('|');
        patterns.push(new RegExp(`\\b${entityName}\\s*,\\s*(${abbrevPattern})\\b`, 'i'));
      }
      
      if (stateInfo.fullNames.length > 0) {
        const fullNamePattern = stateInfo.fullNames.join('|');
        patterns.push(new RegExp(`\\b${entityName}\\s*,\\s*(${fullNamePattern})\\b`, 'i'));
      }
      
      // Pattern like "(CityName)" in descriptions
      patterns.push(new RegExp(`\\(${entityName}\\)`, 'i'));
      patterns.push(new RegExp(`${entityName}\\)`, 'i'));
      
      // Generalized patterns for any city/borough to avoid street name false positives
      patterns.push(new RegExp(`\\b${entityName}(?!\\s+(Avenue|Street|Road|Boulevard|Drive|Lane|Way|Court|Place))\\b`, 'i'));
      patterns.push(new RegExp(`,\\s*${entityName}(?!\\s+(Avenue|Street|Road|Boulevard|Drive|Lane|Way|Court|Place))`, 'i'));
      
      // For cities with known area/metro patterns
      patterns.push(new RegExp(`\\b${entityName}\\s+(area|region|metro|metropolitan)\\b`, 'i'));
      
      // Add neighborhood/landmark patterns if this city has known sub-areas
      const neighborhoodPatterns = this.getNeighborhoodPatterns(entity);
      patterns.push(...neighborhoodPatterns);
    }
    
    // Priority 2: Context-validated patterns for other entity types
    if (patterns.length === 0) {
      // Only use word boundary patterns for entities that are less likely to have false positives
      if (entity.type === 'neighborhood' || entity.type === 'landmark' || entity.type === 'airport') {
        patterns.push(new RegExp(`\\b${this.escapeRegex(entity.name)}\\b`, 'i'));
        
        // Alias patterns
        entity.aliases.forEach(alias => {
          patterns.push(new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'i'));
        });
      } else {
        // For cities/boroughs without specific patterns, require stricter context
        patterns.push(new RegExp(`\\b${this.escapeRegex(entity.name)}\\s*,\\s*[A-Z]{2}\\b`, 'i'));  // "City, ST"
        patterns.push(new RegExp(`\\(${this.escapeRegex(entity.name)}\\)`, 'i'));  // "(City)"
      }
    }
    
    return patterns;
  }

  /**
   * Get state information for a geographic entity
   */
  private getStateInfo(entity: GeographicEntity): { abbreviations: string[], fullNames: string[] } {
    // Determine state based on parent entity or entity properties
    let state = '';
    
    if (entity.parentEntity) {
      const parentLower = entity.parentEntity.toLowerCase();
      if (parentLower === 'new york' || parentLower === 'new york city') {
        state = 'ny';
      } else if (parentLower === 'new jersey') {
        state = 'nj';
      } else if (parentLower === 'pennsylvania') {
        state = 'pa';
      }
    }
    
    // Also check if entity name contains state indicators
    const entityLower = entity.name.toLowerCase();
    if (!state) {
      // Try to infer from common naming patterns or ZIP codes
      if (entity.zipCodes && entity.zipCodes.length > 0) {
        const firstZip = entity.zipCodes[0];
        if (firstZip.startsWith('10') || firstZip.startsWith('11') || firstZip.startsWith('12') || 
            firstZip.startsWith('13') || firstZip.startsWith('14')) {
          state = 'ny';
        } else if (firstZip.startsWith('07') || firstZip.startsWith('08')) {
          state = 'nj';
        } else if (firstZip.startsWith('15') || firstZip.startsWith('16') || firstZip.startsWith('17') || 
                   firstZip.startsWith('18') || firstZip.startsWith('19')) {
          state = 'pa';
        }
      }
    }
    
    switch (state) {
      case 'ny':
        return {
          abbreviations: ['NY'],
          fullNames: ['New York']
        };
      case 'nj':
        return {
          abbreviations: ['NJ'],
          fullNames: ['New Jersey']
        };
      case 'pa':
        return {
          abbreviations: ['PA'],
          fullNames: ['Pennsylvania']
        };
      default:
        return {
          abbreviations: ['NY', 'NJ', 'PA'],
          fullNames: ['New York', 'New Jersey', 'Pennsylvania']
        };
    }
  }

  /**
   * Get neighborhood-specific patterns for major cities
   */
  private getNeighborhoodPatterns(entity: GeographicEntity): RegExp[] {
    const patterns: RegExp[] = [];
    const entityName = this.escapeRegex(entity.name);
    
    // Define known neighborhoods/landmarks for major cities
    const cityNeighborhoods: Record<string, string[]> = {
      'brooklyn': ['Heights', 'Park', 'Bridge', 'Navy Yard', 'Heights'],
      'manhattan': ['Midtown', 'Downtown', 'Uptown', 'Village', 'SoHo', 'TriBeCa'],
      'queens': ['Astoria', 'Flushing', 'Jamaica', 'Forest Hills'],
      'bronx': ['South', 'North', 'East', 'West'],
      'philadelphia': ['Center City', 'Old City', 'University City', 'Northern', 'South'],
      'newark': ['Downtown', 'North', 'South', 'East', 'West'],
      'jersey city': ['Downtown', 'Heights', 'Newport', 'Journal Square'],
      'pittsburgh': ['Downtown', 'Strip District', 'Shadyside', 'Squirrel Hill']
    };
    
    const neighborhoods = cityNeighborhoods[entity.name.toLowerCase()];
    if (neighborhoods) {
      neighborhoods.forEach(neighborhood => {
        patterns.push(new RegExp(`\\b${neighborhood}.*${entityName}\\b`, 'i'));
        patterns.push(new RegExp(`\\b${entityName}.*${neighborhood}\\b`, 'i'));
      });
    }
    
    return patterns;
  }

  /**
   * Extract description field from record
   */
  private extractDescription(record: any): string {
    for (const field of this.fieldPriorities.description) {
      if (record[field] && typeof record[field] === 'string') {
        return record[field];
      }
    }
    return '';
  }

  /**
   * Extract ZIP code from record
   */
  private extractZipCode(record: any): string | null {
    for (const field of this.fieldPriorities.zipCode) {
      if (record[field]) {
        const value = String(record[field]);
        
        // Match Quebec FSA codes first (3-character alphanumeric: H1A, G2B, etc.)
        const fsaMatch = value.match(/\b[A-Z]\d[A-Z]\b/);
        if (fsaMatch) {
          return fsaMatch[0];
        }
        
        // Fallback to 5-digit ZIP codes for US data
        const zipMatch = value.match(/\b\d{5}\b/);
        if (zipMatch) {
          return zipMatch[0];
        }
      }
    }
    return null;
  }

  /**
   * Extract all text fields from record
   */
  private extractAllTextFields(record: any): string {
    const textFields: string[] = [];
    
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        textFields.push(value);
      } else if (typeof value === 'number') {
        textFields.push(String(value));
      }
    }
    
    return textFields.join(' ');
  }

  /**
   * Fuzzy match record against entity
   */
  private fuzzyMatchRecord(record: any, entity: GeographicEntity): boolean {
    const allText = this.extractAllTextFields(record).toLowerCase();
    const searchTerms = [entity.name, ...entity.aliases].map(term => term.toLowerCase());
    
    for (const term of searchTerms) {
      // Check for partial matches with edit distance
      const words = allText.split(/\s+/);
      for (const word of words) {
        if (word.length >= 3 && term.length >= 3) {
          if (this.editDistance(word, term) <= Math.min(2, Math.floor(term.length / 3))) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  // === HELPER METHODS ===

  /**
   * Extract phrases from query (2-3 word combinations)
   */
  private extractPhrases(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const phrases: string[] = [];
    
    // 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }
    
    // 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    
    return phrases;
  }

  /**
   * Calculate edit distance between two strings
   */
  private editDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,    // deletion
            matrix[i][j - 1] + 1,    // insertion
            matrix[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }
    
    return matrix[a.length][b.length];
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}