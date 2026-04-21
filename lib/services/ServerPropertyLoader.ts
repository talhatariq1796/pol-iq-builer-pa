/**
 * Server-Side Property Data Loader
 *
 * Loads property data from Vercel Blob Storage for use in API routes.
 * This is a server-side alternative to PropertyDataService which is client-side.
 */

import { PropertyTypeClassifier } from '@/lib/analysis/PropertyTypeClassifier';
import { calculateTimeOnMarket, type CMAProperty } from '@/components/cma/types';

/**
 * Extract square footage from living_area_imperial string (e.g., "1,890 sqft")
 */
function extractSquareFootageFromImperial(livingAreaImperial?: string): number {
  if (!livingAreaImperial) return 0;

  const match = livingAreaImperial.match(/[\d,]+/);
  if (match) {
    const numStr = match[0].replace(/,/g, '');
    const num = parseInt(numStr, 10);
    return isNaN(num) ? 0 : num;
  }

  return 0;
}

/**
 * Extract sale price from property data, handling various field names and formats.
 * Returns 0 for rental properties (prices ending in "/m" for monthly) to exclude from CMA.
 *
 * Priority: price > sold_rented_price (if numeric) > original_sale_price > askedsold_price
 */
function extractSalePrice(props: Record<string, any>): { price: number; isRental: boolean } {
  // Check if sold_rented_price is a rental (string with "/m")
  const soldRentedPrice = props.sold_rented_price;
  if (typeof soldRentedPrice === 'string' && soldRentedPrice.includes('/m')) {
    // This is a rental property - monthly rent like "$3,800/m"
    return { price: 0, isRental: true };
  }

  // Try to extract numeric price from various fields
  const candidates = [
    props.price,
    props.sold_rented_price, // If numeric, this is a sale price
    props.original_sale_price,
    props.askedsold_price,
    props.asking_price,
    props.list_price,
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '') {
      continue;
    }

    // Handle numeric values
    if (typeof candidate === 'number' && !isNaN(candidate) && candidate > 0) {
      return { price: candidate, isRental: false };
    }

    // Handle string values (parse out numbers)
    if (typeof candidate === 'string') {
      // Skip rental prices
      if (candidate.includes('/m') || candidate.includes('/month')) {
        return { price: 0, isRental: true };
      }
      // Parse price like "$545,000" or "545000"
      const parsed = parseFloat(candidate.replace(/[$,]/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        return { price: parsed, isRental: false };
      }
    }
  }

  return { price: 0, isRental: false };
}

interface GeoJSONFeature {
  type: string;
  geometry?: {
    type: string;
    coordinates?: number[];
  };
  properties: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ServerPropertyData {
  id: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  year_built: number;
  property_type: string;
  pt: string;
  status: string;
  st: string;
  date_bc: string;
  date_pp_acpt_expiration: string;
  time_on_market: number;
  longitude: number;
  latitude: number;
  isRevenueProperty: boolean;
  isRentalProperty: boolean; // True if this is a rental (monthly rent) not a sale
  propertyCategory: 'residential' | 'revenue' | 'house' | 'condo';
  property_category?: string; // Original blob field (house, condo, revenue)
  sourcePropertyType?: string; // Specific type from data source (house/condo/multiplex)
  // Revenue-specific fields
  potential_gross_revenue?: number;
  common_expenses?: number;
  gross_income_multiplier?: number;
  price_vs_assessment?: number;
}

export class ServerPropertyLoader {
  private static properties: ServerPropertyData[] | null = null;
  private static isLoaded = false;

  /**
   * Load all properties from Vercel Blob Storage
   */
  static async loadProperties(): Promise<ServerPropertyData[]> {
    // Validate cache - check for proper structure
    if (this.isLoaded && this.properties && this.properties.length > 0) {
      const firstProp = this.properties[0];
      // FORCE CACHE CLEAR: Check if status field exists and hasn't been overwritten
      // This forces a reload after fixing the ...props spread issue
      const hasValidStructure = firstProp.sourcePropertyType &&
                                (firstProp.st || firstProp.status);

      if (!hasValidStructure) {
        console.log(`[ServerPropertyLoader] Cache invalidated - missing required fields`);
        this.clearCache();
      } else {
        console.log(`[ServerPropertyLoader] Returning cached ${this.properties.length} properties`);
        return this.properties;
      }
    }

    try {
      // Load blob URL mappings from public directory
      const blobUrlsPath = process.cwd() + '/public/data/blob-urls.json';
      const fs = await import('fs/promises');
      const blobUrlsContent = await fs.readFile(blobUrlsPath, 'utf-8');
      const blobUrls = JSON.parse(blobUrlsContent);

      console.log('[ServerPropertyLoader] Loaded blob URLs:', {
        keys: Object.keys(blobUrls),
      });

      // Define property sources
      const propertyUrls = [
        { url: blobUrls.property_single_family_active, type: 'house_active' },
        { url: blobUrls.property_single_family_sold, type: 'house_sold' },
        { url: blobUrls.property_condos_active, type: 'condo_active' },
        { url: blobUrls.property_condos_sold, type: 'condo_sold' },
        { url: blobUrls.property_revenue_active, type: 'revenue_active' },
        { url: blobUrls.property_revenue_sold, type: 'revenue_sold' },
      ];

      const allFeatures: GeoJSONFeature[] = [];
      
      // Fetch all property types in parallel
      console.log('[ServerPropertyLoader] Fetching properties from blob storage...');
      await Promise.all(
        propertyUrls.map(async ({ url, type }) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              const geojsonData = await response.json();
              const features = geojsonData.features || [];
              console.log(`[ServerPropertyLoader] Loaded ${features.length} properties from ${type}`);

              // Tag features with source type (critical for property type filtering)
              const taggedFeatures = features.map((f: any) => ({
                ...f,
                _sourceType: type // house_active, condo_active, revenue_active, etc.
              }));

              allFeatures.push(...taggedFeatures);
            } else {
              console.warn(`[ServerPropertyLoader] Failed to load ${type}:`, response.status);
            }
          } catch (error) {
            console.warn(`[ServerPropertyLoader] Error loading ${type}:`, error);
          }
        })
      );

      if (allFeatures.length === 0) {
        throw new Error('No properties loaded from blob storage');
      }

      // Transform GeoJSON features to property data
      this.properties = this.transformGeoJSONProperties(allFeatures);
      this.isLoaded = true;

      console.log(`[ServerPropertyLoader] Successfully loaded ${this.properties.length} total properties`);
      return this.properties;
    } catch (error) {
      console.error('[ServerPropertyLoader] Failed to load properties:', error);
      throw error;
    }
  }

  /**
   * Transform GeoJSON features to property data objects
   */
  private static transformGeoJSONProperties(features: GeoJSONFeature[]): ServerPropertyData[] {
    console.log(`[ServerPropertyLoader] Transforming ${features.length} GeoJSON features`);

    const transformed = features.map(feature => {
      const props = feature.properties;
      const coords = feature.geometry?.coordinates || [];

      // Extract sourcePropertyType from _sourceType tag
      const sourceType = (feature as any)._sourceType || '';
      let sourcePropertyType: string | undefined;

      if (sourceType.includes('revenue')) {
        sourcePropertyType = 'multiplex'; // Revenue properties default to multiplex
      } else if (sourceType.includes('house')) {
        sourcePropertyType = 'house';
      } else if (sourceType.includes('condo')) {
        sourcePropertyType = 'condo';
      }

      // Classify property type (revenue vs residential)
      // IMPORTANT: sourcePropertyType from blob file is the source of truth
      // If sourcePropertyType is 'house', it's ALWAYS residential (single-family homes)
      // If sourcePropertyType is 'condo', it's ALWAYS residential
      // Only 'multiplex' can be either revenue or residential based on PropertyTypeClassifier
      let classification;
      if (sourcePropertyType === 'house') {
        // Houses from house_active/house_sold blobs are ALWAYS residential
        classification = {
          isRevenueProperty: false,
          propertyCategory: 'residential' as const,
          confidence: 1.0,
          reason: 'Source type is house - always residential'
        };
      } else if (sourcePropertyType === 'condo') {
        // Condos from condo_active/condo_sold blobs are ALWAYS residential
        classification = {
          isRevenueProperty: false,
          propertyCategory: 'residential' as const,
          confidence: 1.0,
          reason: 'Source type is condo - always residential'
        };
      } else {
        // For multiplex and other types, use PropertyTypeClassifier
        classification = PropertyTypeClassifier.classify({
          potential_gross_revenue: props.potential_gross_revenue,
          common_expenses: props.common_expenses,
          gross_income_multiplier: props.gross_income_multiplier,
          price_vs_assessment: props.price_vs_assessment,
          property_type: props.property_type,
          pt: props.pt,
        });
      }

      // Calculate time on market
      const propertyForCalc = {
        date_bc: props.date_bc,
        date_pp_acpt_expiration: props.date_pp_acpt_expiration,
        st: props.st || props.status,
        status: props.status || props.st,
      };
      const timeOnMarket = calculateTimeOnMarket(propertyForCalc as CMAProperty) || 0;

      // Extract price with rental detection
      const { price: extractedPrice, isRental } = extractSalePrice(props);

      return {
        // IMPORTANT: Spread original props FIRST, then override with calculated values
        // This prevents props from overwriting our normalized fields
        ...props,
        // Override with calculated/normalized values (these take precedence)
        id: props.centris_no || props.mls_number || props.id || `prop_${Math.random()}`,
        address: props.address || 'Unknown Address',
        price: extractedPrice,
        isRentalProperty: isRental,
        bedrooms: parseInt(props.bedrooms || props.bedrooms_number || props.br || 0),
        bathrooms: parseFloat(props.bathrooms || props.bathrooms_number || props.ba || 0),
        square_footage: parseFloat(props.square_footage || props.sqft || props.building_area || 0) ||
                       extractSquareFootageFromImperial(props.living_area_imperial),
        year_built: parseInt(props.year_built || props.year || 0),
        property_type: props.property_type || props.pt || 'Unknown',
        pt: props.pt || props.property_type || 'Unknown',
        status: props.status || props.st || 'Unknown',
        st: props.st || props.status || 'Unknown',
        date_bc: props.date_bc || '',
        date_pp_acpt_expiration: props.date_pp_acpt_expiration || '',
        time_on_market: timeOnMarket,
        longitude: coords[0] || 0,
        latitude: coords[1] || 0,
        isRevenueProperty: classification.isRevenueProperty,
        // Use property_category from blob data if available, otherwise derive from revenue classification
        propertyCategory: props.property_category || (classification.isRevenueProperty ? 'revenue' : 'residential'),
        property_category: props.property_category, // Preserve original blob field
        sourcePropertyType: sourcePropertyType, // Specific type from data source
        // Revenue-specific fields
        potential_gross_revenue: props.potential_gross_revenue,
        common_expenses: props.common_expenses,
        gross_income_multiplier: props.gross_income_multiplier,
        price_vs_assessment: props.price_vs_assessment,
      } as ServerPropertyData;
    });

    // Verify sourcePropertyType distribution
    const typeCounts = transformed.reduce((acc, p) => {
      const type = p.sourcePropertyType || 'undefined';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Verify status distribution (DEBUG)
    const statusCounts = transformed.reduce((acc, p) => {
      const status = p.st || p.status || 'undefined';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count rental vs sale properties
    const rentalCount = transformed.filter(p => p.isRentalProperty).length;
    const saleCount = transformed.filter(p => !p.isRentalProperty).length;
    const zeroPriceCount = transformed.filter(p => p.price === 0 || p.price === null).length;

    console.log(`[ServerPropertyLoader] Transformed ${transformed.length} properties`, {
      revenueCount: transformed.filter(p => p.isRevenueProperty).length,
      residentialCount: transformed.filter(p => !p.isRevenueProperty).length,
      rentalCount: rentalCount,
      saleCount: saleCount,
      zeroPriceCount: zeroPriceCount,
      sourcePropertyTypeCounts: typeCounts,
      statusCounts: statusCounts,
      samplePrices: transformed.slice(0, 5).map(p => ({
        address: p.address?.slice(0, 30),
        price: p.price,
        isRental: p.isRentalProperty
      }))
    });

    return transformed;
  }

  /**
   * Clear cached properties (useful for testing)
   */
  static clearCache(): void {
    this.properties = null;
    this.isLoaded = false;
    console.log('[ServerPropertyLoader] Cache cleared');
  }
}
