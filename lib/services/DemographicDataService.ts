/**
 * DemographicDataService - Loads area-level demographic data
 * 
 * Demographic data is stored in a separate blob storage endpoint
 * (demographic-analysis.json) and contains census/Esri data like:
 * - Population (ECYPTAPOP)
 * - Households (ECYTENHHD)
 * - Median Income (ECYHNIMED)
 * - Average Income (ECYHNIAVG)
 * - Homeownership Rate (ECYTENOWN_P)
 * - Rental Rate (ECYTENRENT_P)
 */

export interface DemographicData {
  // Population
  ECYPTAPOP?: number; // Total population
  ECYTENHHD?: number; // Total households
  
  // Income
  ECYHNIMED?: number; // Median household income
  ECYHNIAVG?: number; // Average household income
  
  // Housing Tenure
  ECYTENOWN_P?: number; // Homeownership rate (%)
  ECYTENRENT_P?: number; // Rental rate (%)
  
  // Additional demographic fields
  age_median?: number;
  population_25_34?: number;
  avg_household_income?: number;
  education_university_rate?: number;
  unemployment_rate?: number;
  homeownership_rate?: number;
  
  // Condo-specific
  ECYCDOCO_P?: number; // Condo percentage
  ECYCDOOWCO_P?: number; // Owned condos
  ECYCDORECO_P?: number; // Rented condos
  
  // Tenure trends (historical)
  P5YTENOWN_P?: number; // Ownership 5 years ago
  P0YTENOWN_P?: number; // Ownership 10 years ago
  
  // Market indexes
  HOUSING_AFFORDABILITY_INDEX?: number;
  HOT_GROWTH_INDEX?: number;
}

export class DemographicDataService {
  private static instance: DemographicDataService;
  private cache: Map<string, DemographicData> = new Map();

  private constructor() {}

  static getInstance(): DemographicDataService {
    if (!DemographicDataService.instance) {
      DemographicDataService.instance = new DemographicDataService();
    }
    return DemographicDataService.instance;
  }

  /**
   * Load demographic data for a specific area
   * Uses blob storage URL from blob-urls.json
   */
  async loadDemographicData(areaGeometry?: __esri.Geometry): Promise<DemographicData | null> {
    try {
      // Check cache first
      const cacheKey = areaGeometry ? JSON.stringify(areaGeometry.extent) : 'default';
      if (this.cache.has(cacheKey)) {
        console.log('[DemographicDataService] Using cached demographic data');
        return this.cache.get(cacheKey)!;
      }

      // Load blob URLs configuration with timeout
      const blobUrlsController = new AbortController();
      const blobUrlsTimeout = setTimeout(() => blobUrlsController.abort(), 5000); // 5s timeout
      
      const blobUrlsResponse = await fetch('/data/blob-urls.json', {
        signal: blobUrlsController.signal
      });
      clearTimeout(blobUrlsTimeout);
      
      if (!blobUrlsResponse.ok) {
        throw new Error('Failed to load blob URLs configuration');
      }
      const blobUrls = await blobUrlsResponse.json();
      
      const demographicUrl = blobUrls['demographic-analysis'];
      if (!demographicUrl) {
        console.warn('[DemographicDataService] No demographic-analysis URL in blob-urls.json');
        return null;
      }

      console.log('[DemographicDataService] Loading demographic data from blob storage...');
      
      // Load demographic data from blob storage with timeout
      const dataController = new AbortController();
      const dataTimeout = setTimeout(() => dataController.abort(), 10000); // 10s timeout
      
      const response = await fetch(demographicUrl, {
        signal: dataController.signal
      });
      clearTimeout(dataTimeout);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch demographic data: ${response.statusText}`);
      }

      const data = await response.json();
      
      // For now, use first feature's properties as area-level data
      // In the future, could implement spatial filtering based on areaGeometry
      if (data.features && data.features.length > 0) {
        const demographicData = data.features[0].properties as DemographicData;
        
        console.log('[DemographicDataService] Demographic data loaded:', {
          population: demographicData.ECYPTAPOP,
          households: demographicData.ECYTENHHD,
          medianIncome: demographicData.ECYHNIMED,
          ownershipRate: demographicData.ECYTENOWN_P
        });

        // Cache the result
        this.cache.set(cacheKey, demographicData);
        
        return demographicData;
      }

      console.warn('[DemographicDataService] No features found in demographic data');
      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[DemographicDataService] Request timeout - demographic data loading aborted');
      } else {
        console.error('[DemographicDataService] Error loading demographic data:', error);
      }
      return null;
    }
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
