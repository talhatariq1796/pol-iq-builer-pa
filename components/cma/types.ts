export interface CMAProperty {
  id: any;
  address: any;
  price: any;
  bedrooms: any;
  bathrooms: any;
  squareFootage: any;
  square_footage: any;
  yearBuilt: any;
  year_built: any;
  property_type: any;
  status: any;
  st: any;
  date_bc: any;
  date_pp_acpt_expiration: any;
  cma_score: any;
  isRevenueProperty: any;
  propertyCategory: any;
  potential_gross_revenue: any;
  common_expenses: any;
  gross_income_multiplier: any;
  price_vs_assessment: any;
  latitude: any;
  longitude: any;
  [key: string]: any;
}

export interface CMAStats {
  average_price: number;
  median_price: number;
  price_per_sqft: number;
  average_dom: number;
  average_cma_score: number;
  total_properties: number;
  sold_properties: number;
  active_properties: number;
  standardDeviation?: number;
  min?: number;
  max?: number;
  count?: number;
  mean?: number;
  median?: number;
  soldCount?: number;
  activeCount?: number;
  [key: string]: any;
}

export interface CMAFilters {
  propertyType: any;
  selectedPropertyTypes: any;
  propertyCategory: any;
  priceRange: any;
  bedrooms: any;
  bathrooms: any;
  squareFootage: any;
  yearBuilt: any;
  listingStatus: any;
  dateRange: any;
  radius: any;
  [key: string]: any;
}

export interface AreaSelection {
  geometry?: GeoJSON.Geometry;
  properties?: Record<string, any>;
  name?: string;
  type?: string;
  [key: string]: any;
}

export function calculateTimeOnMarket(property: Partial<CMAProperty>): number | undefined {
  const startDate = parseDate(property.date_bc);
  const endDate = parseDate(property.date_pp_acpt_expiration) ?? new Date();

  if (!startDate) {
    return undefined;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) {
    return undefined;
  }

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
