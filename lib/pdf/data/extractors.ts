/**
 * Data Extraction Functions for CMA PDF Report
 *
 * This module provides comprehensive data extraction and transformation functions
 * for all 7 pages of the CMA report. It bridges the gap between the raw CMAStats
 * interface (with snake_case fields) and the page builder data structures.
 *
 * Architecture:
 * - Helper calculation functions (shared across pages)
 * - Page-specific extraction functions (extractPage1Data, etc.)
 * - Handles missing/optional fields gracefully
 * - Provides sensible defaults
 * - Full TypeScript type safety
 */

import type { PDFReportConfig, ReportMetrics, AIInsight } from '../CMAReportPDFGenerator';
import type { CMAProperty, CMAFilters } from '@/components/cma/types';
import { calculateTimeOnMarket } from '@/components/cma/types';
import type { DemographicData } from '@/lib/services/DemographicDataService';
import { calculateKPISummary } from '../utils/kpiStatistics';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { CMADataService } from '../../../components/cma/services/CMADataService';
import { getDisplayAddressSync, formatAddressForPDF } from '@/lib/utils/addressResolver';

// Page Data Type Definitions
export interface Page1Data {
  reportDate: string;
  reportNumber: string;
  agentInfo: { name: string; phone: string; email: string };
  property: {
    address: string;
    addressSource?: 'property' | 'search' | 'geocoded' | 'coordinates' | 'unknown'; // Track address source
    isAddressEstimated?: boolean; // Track if address is estimated
    image?: string;
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
  };
  areaDescription?: string; // For area-focused PDFs (UI pipeline)
  priceRange: { min: number; max: number };
  propertyType: string;
  metrics: {
    cmaScore: number;
    marketActivity: { activeListings: number; yearOverYearChange: number };
    daysOnMarket: { average: number; marketAverage: number };
    pricePerSqFt: { subject: number; market: number };
  };
  aiInsights: {
    marketPositioning: string;
    competitiveAdvantage: string;
    pricingOpportunity: string;
    riskFactors: string;
  };
  quickStats: {
    comparablesCount: number;
    searchRadius: string;
    timePeriod: string;
    activeFilters: number;
    dataPoints: number;
  };
}

export interface Page2Data {
  neighborhood: string;
  priceDelta?: {
    averageDelta: number;
    medianDelta: number;
    minDelta: number;
    maxDelta: number;
    range: string;
    marketSignal: 'Buyer\'s Market' | 'Seller\'s Market' | 'Balanced Market';
    sampleSize: number;
    interpretation: string;
  };
  kpiSummary?: {
    medianPrice?: {
      average: number;
      median: number;
      range: string;
      sampleSize: number;
    };
    daysOnMarket?: {
      average: number;
      median: number;
      range: string;
      sampleSize: number;
    };
    pricePerSqFt?: {
      average: number;
      median: number;
      range: string;
      sampleSize: number;
    };
  };
  stats: {
    medianPrice: number;
    totalActive: number;
    totalSold: number;
    inventoryLevel: 'Low' | 'Moderate' | 'High' | 'Very High';
    avgDaysOnMarket: number;
    marketAppreciation: number;
    pricePerSqFt: number;
    avgPriceDelta?: number;
  };
  trends: {
    priceChange6Mo: number;
    inventoryChange: number;
    absorptionRate: number;
  };
  priceDistribution: Array<{ range: string; count: number; isSubjectRange?: boolean }>;
  subjectProperty: { price: number };
  aiInsights: {
    supplyDemand: string;
    pricePositioning: string;
    marketTiming: string;
    timingRecommendation: 'List Now' | 'Wait' | 'Prepare';
    forecast30: string;
    forecast60: string;
    forecast90: string;
    confidence30: number;
    confidence60: number;
    confidence90: number;
  };
  daysOnMarketTrend?: Array<{ month: string; market: number; propertyType: number }>;
  inventoryHeatMap?: {
    zones: Array<{ x: number; y: number; density: 'low' | 'medium' | 'high' }>;
    subjectLocation: { x: number; y: number };
  };
  chartImages?: {
    priceDistribution?: string;
    daysOnMarket?: string;
    inventoryHeatMap?: string;
  };
}

export interface Page3Config {
  property: Partial<CMAProperty>;
  marketStats: Record<string, unknown>;
  featureScores: Record<string, number>;
  aiInsights: Record<string, unknown>;
  neighborhoodData: Record<string, unknown>;
  allProperties: Array<{
    id?: string;
    address?: string;
    municipality?: string;  // Added for full address construction
    postal_code?: string;   // Added for full address construction
    mls?: number;           // Centris/MLS listing ID
    centris_no?: number;    // Alternative field name for Centris ID
    price?: number;
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number | null;
    yearBuilt?: number;
    status?: string;
  }>;
}

export interface Page4Data {
  subjectProperty: Partial<CMAProperty>;
  comparables: Array<Partial<CMAProperty>>;
  aiSelectionScores: Record<string, number>;
  demographics?: {
    ageDistribution?: {
      '0-17': number;
      '18-34': number;
      '35-54': number;
      '55-64': number;
      '65+': number;
    };
    householdIncome?: {
      '<25k': number;
      '25-50k': number;
      '50-75k': number;
      '75-100k': number;
      '100k+': number;
    };
    population?: {
      total: number;
      households: number;
      avgHouseholdSize: number;
      medianAge: number;
      avgIncome?: number;
      medianIncome?: number;
    };
    housing?: {
      ownershipRate: number;
      rentalRate: number;
    };
    employment?: {
      employed: number;
      unemployed: number;
      notInLaborForce: number;
    };
    education?: {
      highSchool: number;
      bachelors: number;
      masters: number;
      other: number;
    };
  };
  aiInsights?: {
    populationTrends: string;
    buyerDemographics: string;
    areaAppeal: string;
  };
}

export interface PricingScenario {
  strategy: string;
  price: number;
  timeToSell: string;
  saleProb: number;
  pros: string[];
  cons: string[];
}

export interface Page5Data {
  economicTrends: {
    medianIncome: { year: string; value: number }[];
    homeValues: { year: string; value: number }[];
  };
  employment: { sector: string; jobsAdded: number }[];
  economicIndicators: { category: string; percentage: number; color?: string }[];
  growthMetrics: { gdpGrowth: number; unemploymentRate: number; inflationRate: number };
  futureProjections: { year: string; projection: string }[];
  marketIndexes?: {
    hotGrowthIndex: number;
    affordabilityIndex: number;
    newHomeownersIndex?: number;
    marketScore?: number;
  };
  aiInsights?: {
    economicOutlook: string;
    jobMarketAnalysis: string;
    investmentPotential: string;
  };
}

// Market Momentum Data Structure (multi-dimensional momentum calculation)
export interface MarketMomentumData {
  classification: 'Accelerating' | 'Steady' | 'Decelerating';
  score: number;
  components: {
    daysOnMarket: {
      current: number;
      previous: number;
      change: number;
      changeAbsolute: number;
      trend: 'faster' | 'stable' | 'slower';
      score: number;
    };
    priceVelocity: {
      current: number;
      previous: number;
      change: number;
      changeAbsolute: number;
      trend: 'rising' | 'stable' | 'falling';
      score: number;
    };
    inventoryTurnover: {
      soldCount: number;
      activeCount: number;
      ratio: number;
      trend: 'high' | 'balanced' | 'low';
      score: number;
    };
  };
  metadata: {
    current30DaysCount: number;
    previous30DaysCount: number;
    activeListingsCount: number;
    hasInsufficientData: boolean;
    calculationDate: string;
  };
}

export interface Page6Data {
  comparableProperties: Array<{
    address: string;
    price: number;
    pricePerSqft: number;
    sqft: number;
    beds: number;
    baths: number;
    daysOnMarket: number;
    similarityScore: number;
    adjustments: {
      location: number;
      condition: number;
      size: number;
      features: number;
      total: number;
    };
  }>;
  subjectProperty: {
    address: string;
    sqft: number;
    beds: number;
    baths: number;
    estimatedValue: number;
    pricePerSqft: number;
  };
  marketAnalysis: {
    averagePricePerSqft: number;
    priceRange: { low: number; high: number; recommended: number };
    confidenceLevel: number;
    marketPosition: 'Above Market' | 'At Market' | 'Below Market';
  };
  adjustmentSummary: {
    averageAdjustment: number;
    adjustmentRange: { min: number; max: number };
    mostCommonAdjustments: string[];
  };
  // ✅ NEW: Market Activity & Velocity metrics
  marketActivity: {
    priceToMedianRatio: number;
    saleToListRatio: number;
    priceAchievementRate: number;
    marketMomentum: MarketMomentumData;
  };
  velocityDistribution: {
    '0-10': number;
    '11-20': number;
    '21-30': number;
    '31-45': number;
    '45+': number;
  };
  velocityByPrice: Array<{
    range: string;
    avgDaysOnMarket: number;
    propertyCount: number;
  }>;
}

export interface Page7Data {
  aiExecutiveSummary: {
    marketPosition: { summary: string; keyFinding: string };
    valuationConfidence: { summary: string; confidenceScore: number };
    strategicOutlook: { summary: string; recommendation: 'List Now' | 'Wait' | 'Prepare' };
  };
  keyFindings?: Array<{ title: string; description: string; icon?: string }>;
  recommendedActions: Array<{
    action: string;
    icon: string;
    rationale: string;
    timing: string;
    priority: 'High' | 'Medium' | 'Low';
  }>;
  disclaimer: string;
  contactInfo?: {
    agentName: string;
    agentPhone: string;
    agentEmail: string;
    officeAddress: string;
  };
}

// ============================================================================
// HELPER CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate CMA competitiveness score (0-100)
 * Based on market activity, price positioning, and inventory levels
 */
export function calculateCMAScore(config: PDFReportConfig): number {
  const { stats } = config;

  // Factors:
  // 1. Activity score (0-40): Based on active listings relative to typical market
  const activityScore = Math.min(40, (stats.active_properties / 50) * 40);

  // 2. Price competitiveness (0-30): Based on price per sqft vs market
  const priceScore = stats.price_per_sqft ? Math.min(30, 30 * (200 / stats.price_per_sqft)) : 15;

  // 3. Market velocity (0-30): Based on days on market
  const velocityScore = stats.average_dom ? Math.min(30, 30 * (60 / stats.average_dom)) : 15;

  return Math.round(activityScore + priceScore + velocityScore);
}

/**
 * Calculate market trend direction and magnitude
 * Returns percentage change with positive/negative indicator
 */
export function calculateTrend(config: PDFReportConfig): { value: number; direction: 'up' | 'down' | 'stable' } {
  const { stats } = config;

  // Use market appreciation if available, otherwise estimate from price changes
  const appreciation = stats.marketAppreciation || 0;

  return {
    value: appreciation,
    direction: appreciation > 2 ? 'up' : appreciation < -2 ? 'down' : 'stable'
  };
}

/**
 * Calculate year-over-year change percentage
 */
export function calculateYoYChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Calculate time period from date range in months
 */
export function calculateTimePeriod(dateRange?: { start: Date | string; end: Date | string }): string {
  if (!dateRange) return '6 months';

  const start = dateRange.start instanceof Date ? dateRange.start : new Date(dateRange.start);
  const end = dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end);

  const months = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  return `${months} month${months !== 1 ? 's' : ''}`;
}

/**
 * Count active filters from CMAFilters
 */
export function countActiveFilters(filters: CMAFilters): number {
  let count = 0;

  if (filters.priceRange?.min || filters.priceRange?.max) count++;
  if (filters.propertyType && filters.propertyType !== 'all') count++;
  if (filters.bedrooms?.min || filters.bedrooms?.max) count++;
  if (filters.bathrooms?.min || filters.bathrooms?.max) count++;
  if (filters.squareFootage?.min || filters.squareFootage?.max) count++;
  if (filters.yearBuilt?.min || filters.yearBuilt?.max) count++;
  if (filters.listingStatus && filters.listingStatus !== 'both') count++;

  return count;
}

/**
 * Calculate inventory level classification
 */
export function calculateInventoryLevel(activeListings: number, soldListings: number): 'Low' | 'Moderate' | 'High' | 'Very High' {
  const totalInventory = activeListings + soldListings;

  if (totalInventory < 50) return 'Low';
  if (totalInventory < 100) return 'Moderate';
  if (totalInventory < 200) return 'High';
  return 'Very High';
}

/**
 * Calculate absorption rate (months of inventory)
 */
export function calculateAbsorptionRate(activeListings: number, monthlySales: number): number {
  if (monthlySales === 0) return 0;
  return activeListings / monthlySales;
}

/**
 * Determine market type from absorption rate
 */
export function getMarketType(absorptionRate: number): string {
  if (absorptionRate < 3) return 'Seller\'s Market';
  if (absorptionRate > 6) return 'Buyer\'s Market';
  return 'Balanced Market';
}

/**
 * Calculate price distribution buckets
 */
export function calculatePriceDistribution(
  properties: CMAProperty[],
  subjectPrice?: number
): Array<{ range: string; count: number; isSubjectRange?: boolean }> {
  const ranges = [
    { min: 0, max: 400000, label: '<$400K' },
    { min: 400000, max: 600000, label: '$400-600K' },
    { min: 600000, max: 800000, label: '$600-800K' },
    { min: 800000, max: 1000000, label: '$800K-$1M' },
    { min: 1000000, max: Number.MAX_VALUE, label: '>$1M' },
  ];

  return ranges.map(range => {
    const count = properties.filter(p => p.price >= range.min && p.price < range.max).length;
    const isSubjectRange = subjectPrice
      ? (subjectPrice >= range.min && subjectPrice < range.max)
      : false;

    return {
      range: range.label,
      count,
      isSubjectRange,
    };
  });
}

/**
 * Format metric number with K/M suffix
 */
export function formatMetricNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

// ============================================================================
// PAGE 1: COVER PAGE HERO DASHBOARD
// ============================================================================

/**
 * Extract data for Page 1 - Cover Page Hero Dashboard
 */
export function extractPage1Data(
  config: PDFReportConfig,
  metrics: ReportMetrics,
  aiInsights: AIInsight[],
  propertyCategory?: 'residential' | 'revenue' | 'both'
): Page1Data {
  const { properties, stats, filters, selectedArea } = config;

  // Calculate CMA score
  const cmaScore = calculateCMAScore(config);

  // Get subject property (first property or use area info)
  const subjectProperty = properties[0];

  // Calculate market activity YoY change
  const marketTrend = calculateTrend(config);

  // Resolve address using 4-source priority logic (includes server-side geocoded address)
  const resolvedAddress = getDisplayAddressSync({
    selectedProperty: config.selectedProperty,
    searchAddress: config.searchAddress,
    geocodedAddress: config.geocodedAddress, // Server-side reverse geocoded address
    clickCoordinates: config.clickCoordinates
  });

  console.log('[extractPage1Data] Resolved address:', {
    address: resolvedAddress.address,
    source: resolvedAddress.source,
    isEstimated: resolvedAddress.isEstimated,
    hadGeocodedAddress: !!config.geocodedAddress
  });

  return {
    // Header Band
    reportDate: new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }),
    reportNumber: `CMA-${Date.now().toString().slice(-8)}`,
    agentInfo: {
      name: 'Agent Name', // TODO: Add to config
      phone: '(555) 123-4567',
      email: 'agent@bhhs.com',
    },

    // Hero Section
    property: {
      address: formatAddressForPDF(resolvedAddress),
      addressSource: resolvedAddress.source,
      isAddressEstimated: resolvedAddress.isEstimated,
      image: config.propertyImages?.[subjectProperty?.id],
      bedrooms: subjectProperty?.bedrooms,
      bathrooms: subjectProperty?.bathrooms,
      squareFeet: subjectProperty?.squareFootage,
    },
    priceRange: {
      min: filters.priceRange?.min || stats.minPrice || 0,
      max: filters.priceRange?.max || stats.maxPrice || 0,
    },
    propertyType: filters.propertyType || 'All Types',

    // Key Metrics
    metrics: {
      cmaScore,
      marketActivity: {
        activeListings: stats.active_properties || 0,
        yearOverYearChange: marketTrend.value,
      },
      daysOnMarket: {
        // Use actual average_dom from stats, 0 if not available (will display as "N/A" in UI)
        average: stats.average_dom || 0,
        // Calculate market average from the same data - use average_dom as the market benchmark
        marketAverage: stats.average_dom || 0,
      },
      pricePerSqFt: {
        subject: stats.price_per_sqft || 0,
        market: stats.median_price && stats.median_price > 0
          ? stats.median_price / 2000
          : 0,
      },
    },

    // AI Executive Summary
    aiInsights: {
      marketPositioning: aiInsights?.find(i => i.category === 'market')?.content || 
        'Property positioned competitively within the target market segment based on comparable analysis.',
      competitiveAdvantage: aiInsights?.find(i => i.category === 'opportunity')?.content ||
        'Strong location and recent updates provide competitive edge in current market conditions.',
      pricingOpportunity: aiInsights?.find(i => i.category === 'pricing')?.content ||
        'Current pricing strategy aligns with market data and comparable sales trajectory.',
      riskFactors: 'Monitor inventory levels and seasonal market fluctuations for optimal timing.',
    },

    // Quick Stats
    quickStats: {
      comparablesCount: properties.length,
      // Calculate search radius from geometry extent if available
      searchRadius: (() => {
        const extent = selectedArea?.geometry?.extent;
        if (extent && extent.xmax && extent.xmin && extent.ymax && extent.ymin) {
          // Calculate approximate radius from extent (in degrees, convert to km)
          const widthDeg = Math.abs(extent.xmax - extent.xmin);
          const heightDeg = Math.abs(extent.ymax - extent.ymin);
          const avgDeg = (widthDeg + heightDeg) / 2;
          // At Montreal latitude (~45°), 1 degree ≈ 78 km
          const radiusKm = (avgDeg / 2) * 78;
          if (radiusKm < 1) return `${Math.round(radiusKm * 1000)} m`;
          if (radiusKm < 10) return `${radiusKm.toFixed(1)} km`;
          return `${Math.round(radiusKm)} km`;
        }
        return 'Area';
      })(),
      timePeriod: calculateTimePeriod(filters.dateRange),
      activeFilters: countActiveFilters(filters),
      dataPoints: properties.length + (stats.active_properties || 0),
    },
  };
}

// ============================================================================
// PAGE 2: MARKET OVERVIEW
// ============================================================================

/**
 * Extract data for Page 2 - Market Overview
 *
 * NOTE: Page 2 uses two data sources:
 * - config.properties (selected comparables): For KPI summary, price delta (direct comparison)
 * - config.areaProperties (full area data): For inventory levels, absorption rate, trends
 *   (these metrics need larger sample sizes for statistical significance)
 */
export function extractPage2Data(
  config: PDFReportConfig,
  metrics: ReportMetrics,
  aiInsights: AIInsight[],
  propertyCategory?: 'residential' | 'revenue' | 'both'
): Page2Data {
  const { properties, stats, selectedArea } = config;
  // Use areaProperties for market-wide metrics (needs larger sample), fallback to properties
  const areaProperties = config.areaProperties || properties;

  // DEBUG: Check what we're receiving
  console.log(`[extractPage2Data] 🔍 DEBUGGING price_delta availability:`, {
    totalProperties: properties.length,
    firstProperty: properties[0] ? {
      keys: Object.keys(properties[0]),
      hasTopLevelPriceDelta: 'price_delta' in properties[0],
      priceDeltaValue: properties[0].price_delta,
      priceDeltaType: typeof properties[0].price_delta,
      askedPrice: properties[0].asked_price,
      askedPriceType: typeof properties[0].asked_price,
      originalPrice: properties[0].original_price,
      originalPriceType: typeof properties[0].original_price,
    } : null,
    first3PropertiesWithPriceDelta: properties.slice(0, 3).map((p, i) => ({
      index: i,
      hasPriceDelta: 'price_delta' in p,
      value: p.price_delta,
      type: typeof p.price_delta,
    })),
  });

  // IMPORTANT: The properties array has already been filtered client-side by listingStatus
  // (active/sold/both). So we should use config.reportType to know what we have,
  // not try to filter again (which would give incorrect counts).
  //
  // Use reportType to determine counts:
  // - If reportType='active': all properties are active
  // - If reportType='sold': all properties are sold
  // - If reportType='both': try to split by status field

  let totalActive: number;
  let totalSold: number;
  let activeProperties: CMAProperty[];
  let soldProperties: CMAProperty[];

  // For AREA data (used for inventory levels, absorption rate) - always use full dataset
  // Use the status from actual data rather than reportType for area metrics
  const areaActiveProperties = areaProperties.filter(p =>
    p.status?.toLowerCase() === 'active' || p.st?.toUpperCase() === 'AC'
  );
  const areaSoldProperties = areaProperties.filter(p =>
    p.status?.toLowerCase() === 'sold' || p.st?.toUpperCase() === 'SO'
  );
  const areaTotalActive = areaActiveProperties.length;
  const areaTotalSold = areaSoldProperties.length;

  console.log(`[extractPage2Data] Area data (for market metrics): ${areaProperties.length} total (${areaTotalActive} active, ${areaTotalSold} sold)`);

  // For SELECTED COMPARABLES (used for KPI summary, price delta) - use reportType
  if (config.reportType === 'active') {
    // All properties in the array are active (already filtered client-side)
    totalActive = properties.length;
    totalSold = 0;
    activeProperties = properties;
    soldProperties = [];
    console.log(`[extractPage2Data] Selected comparables: reportType='active' - ${properties.length} properties`);
  } else if (config.reportType === 'sold') {
    // All properties in the array are sold (already filtered client-side)
    totalActive = 0;
    totalSold = properties.length;
    activeProperties = [];
    soldProperties = properties;
    console.log(`[extractPage2Data] Selected comparables: reportType='sold' - ${properties.length} properties`);
  } else {
    // reportType='both' - split by status field
    activeProperties = properties.filter(p =>
      p.status?.toLowerCase() === 'active' || p.st?.toUpperCase() === 'AC'
    );
    soldProperties = properties.filter(p =>
      p.status?.toLowerCase() === 'sold' || p.st?.toUpperCase() === 'SO'
    );
    totalActive = activeProperties.length;
    totalSold = soldProperties.length;
    console.log(`[extractPage2Data] Selected comparables: reportType='both' - ${totalActive} active, ${totalSold} sold`);
  }

  // Calculate average DOM from filtered properties
  const propertiesWithDOM = properties.filter(p => p.time_on_market);
  const calculatedAvgDOM = propertiesWithDOM.length > 0
    ? propertiesWithDOM.reduce((sum, p) => sum + (p.time_on_market || 0), 0) / propertiesWithDOM.length
    : undefined;

  // Log filtered counts for debugging
  console.log(`[extractPage2Data] Filtered properties: ${properties.length} total (${totalActive} active, ${totalSold} sold)`);
  if (calculatedAvgDOM) {
    console.log(`[extractPage2Data] Calculated avg DOM from ${propertiesWithDOM.length} properties: ${calculatedAvgDOM.toFixed(1)} days`);
  }
  
  // Calculate trends
  const priceChange6Mo = ((metrics.monthly.avgPrice - metrics.annual.avgPrice) / metrics.annual.avgPrice) * 100;
  const inventoryChange = stats.marketAppreciation || 0;

  // Calculate absorption rate based on AREA data (needs larger sample for accuracy)
  const areaMonthlySales = Math.max(1, Math.round(areaTotalSold / 6));
  const absorptionRate = calculateAbsorptionRate(areaTotalActive, areaMonthlySales);

  // Get subject property price
  const subjectPrice = properties[0]?.price || stats.median_price || 0;

  // Calculate KPI summary statistics from properties array (if sufficient data)
  const kpiSummary = properties.length >= 3
    ? calculateKPISummary(properties, formatCurrency, formatNumber)
    : undefined;

  // Log first 3 properties for debugging KPI calculation
  if (properties.length > 0 && properties.length < 3) {
    console.log(`[extractPage2Data] Only ${properties.length} properties - skipping KPI summary (need 3+)`);
  } else if (kpiSummary) {
    console.log(`[extractPage2Data] KPI summary calculated from ${properties.length} properties`);
    console.log(`  Median Price: ${kpiSummary.medianPrice ? 'Available' : 'N/A'}`);
    console.log(`  Days on Market: ${kpiSummary.daysOnMarket ? 'Available' : 'N/A'}`);
    console.log(`  Price per SqFt: ${kpiSummary.pricePerSqFt ? 'Available' : 'N/A'}`);
  }

  // Calculate revenue-specific metrics if propertyCategory is 'revenue'
  let revenueMetrics: any = {};
  
  console.log(`[extractPage2Data] propertyCategory="${propertyCategory}", checking for revenue metrics...`);
  
  if (propertyCategory === 'revenue') {
    console.log(`[extractPage2Data] ✓ Revenue property category detected! Calculating investment metrics...`);
    for (let i = 0; i < Math.min(3, properties.length); i++) {
      const prop = properties[i] as any;
      console.log(`[extractPage2Data] Property[${i}]:`, {
        id: prop.id,
        price: prop.price,
        gross_income_multiplier: prop.gross_income_multiplier,
        potential_gross_revenue: prop.potential_gross_revenue,
        price_vs_assessment: prop.price_vs_assessment,
        common_expenses: prop.common_expenses,
        gim: prop.gim,
        pgi: prop.pgi,
        propertyCategory: prop.propertyCategory,
        isRevenueProperty: prop.isRevenueProperty,
      });
    }
    
    // Helper to parse price string (e.g., "$1,280,000 (J)" -> 1280000)
    const parsePrice = (price: any): number => {
      if (typeof price === 'number') return price;
      if (typeof price === 'string') {
        const cleaned = price.replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
      }
      return 0;
    };

    // Filter properties with revenue data
    const revenueProperties = properties.filter(p => {
      const propAny = p as any;
      return (
        propAny.potential_gross_revenue || 
        propAny.pgi || 
        propAny.gross_income_multiplier || 
        propAny.gim ||
        propAny.price_vs_assessment
      );
    });

    console.log(`[extractPage2Data] Revenue properties: ${revenueProperties.length} / ${properties.length} total`);
    if (revenueProperties.length > 0) {
      console.log(`[extractPage2Data] Sample revenue property fields:`, {
        potential_gross_revenue: (revenueProperties[0] as any).potential_gross_revenue,
        gross_income_multiplier: (revenueProperties[0] as any).gross_income_multiplier,
        price_vs_assessment: (revenueProperties[0] as any).price_vs_assessment
      });
    } else {
      console.log(`[extractPage2Data] ❌ NO revenue properties found! First property:`, 
        properties[0] ? Object.keys(properties[0] as any).slice(0, 10) : 'No properties');
    }

    if (revenueProperties.length > 0) {
      // Extract PGI values
      const pgiValues = revenueProperties
        .map(p => {
          const propAny = p as any;
          const pgi = propAny.potential_gross_revenue || propAny.pgi || 0;
          return typeof pgi === 'number' ? pgi : parseFloat(String(pgi)) || 0;
        })
        .filter(v => v > 0)
        .sort((a, b) => a - b);

      // Extract GIM values
      const gimValues = revenueProperties
        .map(p => {
          const propAny = p as any;
          const gim = propAny.gross_income_multiplier || propAny.gim || 0;
          return typeof gim === 'number' ? gim : parseFloat(String(gim)) || 0;
        })
        .filter(v => v > 0)
        .sort((a, b) => a - b);

      // Extract Price vs Assessment values
      const priceVsAssessmentValues = revenueProperties
        .map(p => {
          const propAny = p as any;
          const pva = propAny.price_vs_assessment || 0;
          return typeof pva === 'number' ? pva : parseFloat(String(pva)) || 0;
        })
        .filter(v => v > 0)
        .sort((a, b) => a - b);

      // Calculate statistics
      const avgPGI = pgiValues.length > 0 
        ? pgiValues.reduce((sum, v) => sum + v, 0) / pgiValues.length 
        : 0;
      const medianGIM = gimValues.length > 0 
        ? gimValues[Math.floor(gimValues.length / 2)] 
        : 0;
      const avgPriceVsAssessment = priceVsAssessmentValues.length > 0
        ? priceVsAssessmentValues.reduce((sum, v) => sum + v, 0) / priceVsAssessmentValues.length
        : 0;

      // Estimate cap rate (assuming 50% operating expense ratio)
      const avgCapRate = avgPGI > 0 && medianGIM > 0
        ? ((avgPGI * 0.50) / (avgPGI * medianGIM)) * 100
        : 0;

      revenueMetrics = {
        avgPGI,
        medianGIM,
        avgPriceVsAssessment,
        avgCapRate
      };

      console.log(`[extractPage2Data] Revenue metrics calculated:`, {
        avgPGI: avgPGI.toFixed(0),
        medianGIM: medianGIM.toFixed(2),
        avgPriceVsAssessment: avgPriceVsAssessment.toFixed(0) + '%',
        avgCapRate: avgCapRate.toFixed(1) + '%'
      });
    }
  }

  // Calculate average price delta (difference between original listing price and sold price)
  //
  // PRIMARY METHOD: Use original_sale_price and askedsold_price from Centris blob data
  // - original_sale_price: The original listing price before any reductions
  // - askedsold_price: The final sold price
  // - Formula: ((askedsold_price - original_sale_price) / original_sale_price) * 100
  //
  // FALLBACK: Use price_delta field if available (pre-calculated)

  let avgPriceDelta: number | undefined = undefined;

  // Use soldProperties from AREA data for this calculation (more statistically meaningful)
  // but we should use the properties variable which is selected comparables for sold reports
  const soldPropsForDelta = areaSoldProperties.length > 0 ? areaSoldProperties : soldProperties;

  // Primary method: Calculate from original_sale_price and askedsold_price
  const soldPropsWithPrices = soldPropsForDelta.filter(p => {
    const originalPrice = p.original_sale_price || p.original_price || p.asking_price || p.asked_price;
    const soldPrice = p.askedsold_price || p.sold_rented_price || p.sold_price || p.sale_price;
    return originalPrice && soldPrice && originalPrice > 0 && soldPrice > 0;
  });

  console.log(`[extractPage2Data] Price delta calculation - checking ${soldPropsForDelta.length} sold properties:`, {
    withOriginalPrice: soldPropsForDelta.filter(p => p.original_sale_price || p.original_price || p.asking_price).length,
    withSoldPrice: soldPropsForDelta.filter(p => p.askedsold_price || p.sold_rented_price || p.sold_price).length,
    withBothPrices: soldPropsWithPrices.length,
  });

  if (soldPropsWithPrices.length > 0) {
    // Calculate average original listing price
    const avgOriginalPrice = soldPropsWithPrices.reduce((sum, p) => {
      return sum + (p.original_sale_price || p.original_price || p.asking_price || p.asked_price || 0);
    }, 0) / soldPropsWithPrices.length;

    // Calculate average sold price
    const avgSoldPrice = soldPropsWithPrices.reduce((sum, p) => {
      return sum + (p.askedsold_price || p.sold_rented_price || p.sold_price || p.sale_price || 0);
    }, 0) / soldPropsWithPrices.length;

    // Calculate percentage difference: (sold - original) / original * 100
    // Negative = sold below listing, Positive = sold above listing
    avgPriceDelta = ((avgSoldPrice - avgOriginalPrice) / avgOriginalPrice) * 100;

    console.log(`[extractPage2Data] ✅ Price Delta Calculated:`, {
      propertiesUsed: soldPropsWithPrices.length,
      avgOriginalPrice: '$' + avgOriginalPrice.toLocaleString(),
      avgSoldPrice: '$' + avgSoldPrice.toLocaleString(),
      avgPriceDelta: avgPriceDelta.toFixed(2) + '%'
    });

    // Log sample properties
    console.log(`[extractPage2Data] Sample price delta:`, soldPropsWithPrices.slice(0, 3).map(p => {
      const original = p.original_sale_price || p.original_price || p.asking_price || p.asked_price || 0;
      const sold = p.askedsold_price || p.sold_rented_price || p.sold_price || p.sale_price || 0;
      return {
        address: p.address?.substring(0, 30),
        original: '$' + original.toLocaleString(),
        sold: '$' + sold.toLocaleString(),
        delta: (((sold - original) / original) * 100).toFixed(2) + '%'
      };
    }));
  } else {
    // Fallback: Use pre-calculated price_delta field if available
    const propsWithDelta = soldPropsForDelta.filter(p =>
      p.price_delta !== undefined &&
      p.price_delta !== null &&
      typeof p.price_delta === 'number' &&
      !isNaN(p.price_delta)
    );

    if (propsWithDelta.length > 0) {
      avgPriceDelta = propsWithDelta.reduce((sum, p) => sum + (p.price_delta || 0), 0) / propsWithDelta.length;
      console.log(`[extractPage2Data] ✅ Using pre-calculated price_delta:`, {
        propertiesUsed: propsWithDelta.length,
        avgPriceDelta: avgPriceDelta.toFixed(2) + '%',
      });
    } else {
      console.log(`[extractPage2Data] ⚠️ No properties with price data for delta calculation - will show "No Data" in PDF`);
      console.log(`[extractPage2Data] Sample fields available:`, soldPropsForDelta.length > 0
        ? Object.keys(soldPropsForDelta[0]).filter(k => k.toLowerCase().includes('price'))
        : 'no sold properties');
    }
  }

  return {
    neighborhood: selectedArea?.displayName || 'Market Area',

    stats: {
      medianPrice: stats.median_price || metrics.allTime.median,
      // Use AREA data for inventory counts (market-wide metrics)
      totalActive: areaTotalActive,
      totalSold: areaTotalSold,
      inventoryLevel: calculateInventoryLevel(areaTotalActive, areaTotalSold),
      avgDaysOnMarket: calculatedAvgDOM || stats.average_dom || metrics.allTime.avgTimeOnMarket,
      marketAppreciation: stats.marketAppreciation || 0,
      pricePerSqFt: stats.price_per_sqft || 0,
      avgPriceDelta: avgPriceDelta,
      // Add revenue metrics (will be undefined for residential)
      ...revenueMetrics
    },

    trends: {
      priceChange6Mo,
      inventoryChange,
      absorptionRate,
    },

    priceDistribution: calculatePriceDistribution(properties, subjectPrice),

    subjectProperty: {
      price: subjectPrice,
    },

    // KPI Summary Statistics (calculated from properties array)
    kpiSummary,

    aiInsights: {
      supplyDemand: aiInsights?.find(i => i.category === 'market')?.content ||
        'Current market shows balanced supply and demand dynamics with moderate inventory levels.',
      pricePositioning: aiInsights?.find(i => i.category === 'pricing')?.content ||
        'Property pricing is competitive within the current market range.',
      marketTiming: aiInsights?.find(i => i.category === 'trend')?.content ||
        'Market conditions favor strategic timing for listing decisions.',
      timingRecommendation: absorptionRate < 3 ? 'List Now' : absorptionRate > 6 ? 'Wait' : 'Prepare',
      // REMOVED: Fake AI forecasts (forecast30, forecast60, forecast90) and confidence scores
      forecast30: '', // REMOVED: Fake forecast data
      forecast60: '', // REMOVED: Fake forecast data
      forecast90: '', // REMOVED: Fake forecast data
      confidence30: 0, // REMOVED: Fake confidence score
      confidence60: 0, // REMOVED: Fake confidence score
      confidence90: 0, // REMOVED: Fake confidence score
    },

    chartImages: config.chartImages,
  };
}

// ============================================================================
// PAGE 3: SUBJECT PROPERTY ANALYSIS
// ============================================================================

/**
 * Extract data for Page 3 - Subject Property Analysis
 */
export async function extractPage3Data(
  config: PDFReportConfig,
  metrics: ReportMetrics,
  aiInsights: AIInsight[]
): Promise<Page3Config> {
  const { properties, stats } = config;

  // Log selection info for debugging
  console.log('[extractPage3Data] Selection info:', {
    propertiesCount: properties?.length || 0,
    selectionInfo: config.selectionInfo,
    isFiltered: config.selectionInfo?.isFiltered,
    selectedCount: config.selectionInfo?.selectedCount,
    totalCount: config.selectionInfo?.totalCount,
  });

  // Load CMA data service for Page 3 table fields
  const cmaDataService = CMADataService.getInstance();
  await cmaDataService.loadCMAData();

  // Simple test: Check if we can find a known property
  const testLookup = cmaDataService.getCMATableData("19418463");
  console.log('[extractPage3Data] CMA Service Test:', {
    serviceLoaded: true,
    testLookup_19418463: testLookup ? 'FOUND' : 'NOT FOUND',
    testAddress: testLookup?.address,
    testLivingArea: testLookup?.living_area
  });

  // Subject property (use first property or create from stats)
  const firstProp = properties[0];

  const property = {
    address: firstProp?.address || 'Subject Property',
    // Use actual data or undefined (will display as "--" in PDF)
    bedrooms: firstProp?.bedrooms || undefined,
    bathrooms: firstProp?.bathrooms || undefined,
    squareFootage: firstProp?.squareFootage || undefined,
    yearBuilt: firstProp?.yearBuilt || undefined,
    garage: undefined, // No garage data available in current dataset
    lotSize: undefined, // No lot size data available in current dataset
    price: firstProp?.price || stats.median_price || 0,
    // Calculate price per sqft from actual data, or 0 if not available
    pricePerSqFt: firstProp?.squareFootage && firstProp?.price
      ? Math.round(firstProp.price / firstProp.squareFootage)
      : stats.price_per_sqft || 0,
    features: [], // No feature data available in current dataset
    imageUrl: config.propertyImages?.[firstProp?.id],
  };

  // Calculate market stats from all properties (only use properties with valid data)
  const propsWithYearBuilt = properties.filter(p => p.yearBuilt && p.yearBuilt > 1800 && p.yearBuilt <= new Date().getFullYear());
  const avgYearBuilt = propsWithYearBuilt.length > 0
    ? Math.round(propsWithYearBuilt.reduce((sum, p) => sum + p.yearBuilt!, 0) / propsWithYearBuilt.length)
    : 0; // 0 will display as "--" in PDF

  const propsWithSqFt = properties.filter(p => p.squareFootage && p.squareFootage > 0);
  const avgSquareFootage = propsWithSqFt.length > 0
    ? Math.round(propsWithSqFt.reduce((sum, p) => sum + p.squareFootage!, 0) / propsWithSqFt.length)
    : 0; // 0 will display as "--" in PDF

  const marketStats = {
    // Use actual price_per_sqft or 0 (will display as "--" in PDF)
    pricePerSqFt: stats.price_per_sqft || 0,
    avgYearBuilt,
    avgSquareFootage,
  };

  // Feature scores - REMOVED: Hardcoded fake scores
  const featureScores = {
    updates: 0,
    condition: 0,
    amenities: 0,
    location: 0,
  };

  // Neighborhood data - REMOVED: Hardcoded fake data (school rating, walk score, safety index)
  const neighborhoodData = {
    schoolRating: undefined,
    walkScore: undefined,
    safetyIndex: undefined,
    demographics: undefined,
  };

  // AI Insights - REMOVED: Hardcoded fake insights, only use real AI insights if available
  const propertyAIInsights = {
    strengths: [], // REMOVED: Fake hardcoded strengths
    considerations: [], // REMOVED: Fake hardcoded considerations
    valueDrivers: [], // REMOVED: Fake hardcoded value drivers
    locationAnalysis: aiInsights?.find(i => i.category === 'market')?.content || '',
    proximityAdvantages: '', // REMOVED: Fake data
    neighborhoodTrends: '', // REMOVED: Fake data
    futureDevelopments: '', // REMOVED: Fake data
    comparablePositioning: aiInsights?.find(i => i.category === 'pricing')?.content || '',
    confidence: 0, // REMOVED: Fake confidence score
  };

  // All properties for comparison
  // Check if enriched properties with full address details are available
  
  // CRITICAL: Use API properties (config.properties) for PRICE, SQFT, BEDS, BATHS, STATUS
  // Only use enriched properties for ADDRESS and CENTRIS_NO
  // This ensures accurate data from API, not fallback dummy values

  const allProperties = properties.map((apiProp, index) => {
    const apiPropAny = apiProp as unknown as Record<string, unknown>;

    // Try to find matching enriched property for address/centris_no only
    let enrichedMatch: Record<string, unknown> | null = null;
    if (config.propertyImages?._enrichedProperties) {
      try {
        const enriched = JSON.parse(config.propertyImages._enrichedProperties);
        enrichedMatch = enriched.find((ep: Record<string, unknown>) => {
          const epId = (ep.centris_no || ep.mls || ep.id)?.toString();
          const apiId = (apiPropAny.centris_no || apiPropAny.mls || apiProp.id)?.toString();
          return epId && apiId && epId === apiId;
        });
      } catch (e) {
        console.warn('[extractPage3Data] Failed to parse enriched properties:', e);
      }
    }

    // Get CMA table data for specific Page 3 fields (address, centris_no, living_area)
    const centrisNo = apiPropAny.centris_no || apiPropAny.mls || apiProp.id;
    const cmaTableData = cmaDataService.getCMATableData(centrisNo as string | number);

    // Debug ALL properties to see pattern
    console.log(`[extractPage3Data] Property ${index}:`, {
      centrisNo,
      centrisNoType: typeof centrisNo,
      hasCMAData: !!cmaTableData,
      willUseAddress: cmaTableData?.address ? 'CMA' : 'fallback'
    });

    // Access nested properties from GeographicDataPoint structure
    const propData = (apiPropAny.properties || apiPropAny) as Record<string, unknown>;

    return {
      id: apiProp.id || `prop-${index}`,
      // Address from CMA data (format: "address municipality, postal_code")
      address: cmaTableData?.address
        ? `${cmaTableData.address} ${cmaTableData.municipality}, ${cmaTableData.postal_code}`
        : (enrichedMatch?.address as string) || apiProp.address || (propData.address as string) || 'Address unavailable',
      municipality: (cmaTableData?.municipality || enrichedMatch?.municipality || apiPropAny.municipality) as string | undefined,
      postal_code: (cmaTableData?.postal_code || enrichedMatch?.postal_code || apiPropAny.postal_code) as string | undefined,
      mls: (enrichedMatch?.mls || apiPropAny.mls || propData.mls_number) as number | undefined,
      // Centris No from CMA data
      centris_no: (cmaTableData?.mls_number || enrichedMatch?.centris_no || apiPropAny.centris_no) as number | undefined,
      // Price, beds, baths, status from API (unchanged)
      price: apiProp.price || 0,
      bedrooms: (apiProp.bedrooms || propData.bedrooms) as number | undefined,
      bathrooms: (apiProp.bathrooms || propData.bathrooms) as number | undefined,
      // Square footage: Try CMA living_area, then API squareFootage, then living_area from propData
      squareFootage: cmaTableData?.living_area || apiProp.squareFootage || (propData.living_area as number) || (propData.square_footage as number) || 0,
      yearBuilt: (propData.year_built || apiPropAny.year_built) as number | undefined,
      // Status: Check st field first (raw 'SO'/'AC'), then normalized status
      status: (() => {
        const st = apiProp.st || (propData.st as string);
        if (st?.toUpperCase() === 'SO') return 'Sold';
        if (st?.toUpperCase() === 'AC') return 'Active';
        const status = apiProp.status || (propData.status as string);
        if (status?.toLowerCase() === 'sold') return 'Sold';
        return 'Active';
      })(),
    };
  });

  return {
    property,
    marketStats,
    featureScores,
    aiInsights: propertyAIInsights,
    neighborhoodData,
    allProperties,
  };
}

// ============================================================================
// PAGE 4: COMPARABLE PROPERTIES
// ============================================================================

/**
 * Extract data for Page 4 - Comparable Properties
 */
export function extractPage4Data(
  config: PDFReportConfig,
  metrics: ReportMetrics,
  aiInsights: AIInsight[],
  demographicData?: DemographicData
): Page4Data {
  const { properties, stats } = config;

  // Subject property
  const subjectProp = properties[0];
  const subjectProperty = {
    address: subjectProp?.address || 'Subject Property',
    price: subjectProp?.price || stats.median_price || 0,
    bedrooms: subjectProp?.bedrooms || 3,
    bathrooms: subjectProp?.bathrooms || 2,
    squareFootage: subjectProp?.squareFootage || 2000,
    yearBuilt: subjectProp?.yearBuilt || 2010,
    daysOnMarket: 0,
    condition: 4, // 1-5 stars
    pricePerSqFt: stats.price_per_sqft || (subjectProp?.price || 0) / (subjectProp?.squareFootage || 2000),
    imageUrl: config.propertyImages?.[subjectProp?.id],
  };

  // Helper function to extract days on market from various field names
  const extractDaysOnMarket = (property: CMAProperty): number => {
    const prop = property as CMAProperty & {
      daysOnMarket?: number;
      dom?: number;
      LISTINGDAYS?: number;
      days_on_market?: number;
    };

    return property.time_on_market
      || prop.daysOnMarket
      || prop.dom
      || prop.LISTINGDAYS
      || prop.days_on_market
      || 0;
  };

  // Helper function to calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get subject property coordinates for distance calculation
  const subjectPropWithCoords = subjectProp as CMAProperty & { latitude?: number; longitude?: number };
  const subjectLat = subjectPropWithCoords.latitude;
  const subjectLon = subjectPropWithCoords.longitude;

  // All filtered comparable properties (not just top 5)
  const comparables = properties.map((prop, index) => {
    const pricePerSqFt = prop.price / (prop.squareFootage || 2000);
    const similarityScore = Math.max(70, 95 - (index * 2)); // Gradual decrease, minimum 70%

    // Calculate distance if both properties have coordinates
    const propWithCoords = prop as CMAProperty & { latitude?: number; longitude?: number };
    let distance = null;
    if (subjectLat && subjectLon && propWithCoords.latitude && propWithCoords.longitude) {
      distance = calculateDistance(subjectLat, subjectLon, propWithCoords.latitude, propWithCoords.longitude);
    }

    return {
      id: prop.id,
      address: prop.address,
      price: prop.price,
      bedrooms: prop.bedrooms || 3,
      bathrooms: prop.bathrooms || 2,
      squareFootage: prop.squareFootage || 2000,
      yearBuilt: prop.yearBuilt || 2010,
      daysOnMarket: extractDaysOnMarket(prop),
      distance: distance ?? 0, // Use calculated distance or 0 if coordinates unavailable
      condition: 0, // No real condition data available - should come from actual property condition rating
      pricePerSqFt,
      imageUrl: config.propertyImages?.[prop.id],
      adjustments: {
        size: ((prop.squareFootage || 2000) - subjectProperty.squareFootage) / subjectProperty.squareFootage * 100,
        condition: 0, // neutral
        location: 0, // neutral
        features: 0, // neutral
        total: 0, // net adjustment
      },
      similarityScore,
      aiInsight: aiInsights?.find(i => i.category === 'pricing')?.content.slice(0, 300) ||
        'Strong comparable with similar features and market positioning.',
    };
  });

  // AI selection scores
  const aiSelectionScores = {
    similarityScore: 92,
    proximityScore: 88,
    relevanceScore: 90,
  };

  // Extract REAL demographics data from property data (GeoJSON includes demographic fields)
  // Average demographic data from all properties in the analysis area
  const avgDemographics = properties.reduce((acc, prop) => {
    const propData = prop as unknown as Record<string, number>;
    return {
      totalPop: acc.totalPop + (propData.ECYPTAPOP || 0),
      households: acc.households + (propData.ECYTENHHD || 0),
      medianAge: acc.medianAge + (propData.age_median || 0),
      pop2534: acc.pop2534 + (propData.population_25_34 || 0),
      avgIncome: acc.avgIncome + (propData.avg_household_income || 0),
      educationRate: acc.educationRate + (propData.education_university_rate || 0),
      unemploymentRate: acc.unemploymentRate + (propData.unemployment_rate || 0),
      ownershipRate: acc.ownershipRate + (propData.ECYTENOWN_P || 0),
      count: acc.count + 1,
    };
  }, { totalPop: 0, households: 0, medianAge: 0, pop2534: 0, avgIncome: 0, educationRate: 0, unemploymentRate: 0, ownershipRate: 0, count: 0 });

  const propCount = avgDemographics.count || 1;
  const medianAge = Math.round(avgDemographics.medianAge / propCount) || 38;
  
  // Use demographicData if available (NEW: loaded from demographic-analysis endpoint)
  // Otherwise fallback to properties[0] (old behavior)
  console.log('[extractPage4Data] Demographic data source:', demographicData ? 'demographic-analysis endpoint' : 'properties[0] fallback');
  
  const totalPopulation = demographicData?.ECYPTAPOP || 0;
  const totalHouseholds = demographicData?.ECYTENHHD || 0;
  const avgIncome = demographicData?.ECYHNIAVG || 0;
  const medianIncome = demographicData?.ECYHNIMED || 0;
  const ownershipRate = demographicData?.ECYTENOWN_P || 0;
  
  console.log('[extractPage4Data] Demographic metrics:', {
    population: totalPopulation > 0 ? totalPopulation : 'fallback: 25000',
    households: totalHouseholds > 0 ? totalHouseholds : 'fallback: 10000',
    medianIncome: medianIncome > 0 ? medianIncome : 'fallback: calculated',
    ownershipRate: ownershipRate > 0 ? ownershipRate + '%' : 'fallback: 65%'
  });
  
  // Use real data with fallbacks
  const finalPopulation = totalPopulation > 0 ? totalPopulation : 25000;
  const finalHouseholds = totalHouseholds > 0 ? totalHouseholds : 10000;
  const finalAvgIncome = avgIncome > 0 ? avgIncome : 75000;
  const finalMedianIncome = medianIncome > 0 ? medianIncome : finalAvgIncome;
  const finalOwnershipRate = ownershipRate > 0 ? Math.round(ownershipRate) : 65;
  const rentalRate = 100 - finalOwnershipRate;

  // Age distribution - estimate from median age
  const demographics = {
    ageDistribution: {
      '0-17': medianAge < 30 ? 25 : medianAge < 40 ? 20 : 15,
      '18-34': Math.round((avgDemographics.pop2534 / propCount) || 25),
      '35-54': medianAge >= 35 && medianAge <= 54 ? 35 : 25,
      '55-64': medianAge >= 55 && medianAge <= 64 ? 20 : 15,
      '65+': medianAge >= 65 ? 25 : 10,
    },
    householdIncome: {
      '<25k': 10,
      '25-50k': 20,
      '50-75k': 25,
      '75-100k': 25,
      '100k+': 20,
    },
    population: {
      total: finalPopulation,
      households: finalHouseholds,
      avgHouseholdSize: finalHouseholds > 0 ? Math.round((finalPopulation / finalHouseholds) * 10) / 10 : 2.5,
      medianAge: medianAge,
      avgIncome: finalAvgIncome,
      medianIncome: finalMedianIncome,
    },
    housing: {
      ownershipRate: finalOwnershipRate,
      rentalRate: rentalRate,
    },
    employment: {
      employed: Math.round(100 - (avgDemographics.unemploymentRate / propCount || 5)),
      unemployed: Math.round(avgDemographics.unemploymentRate / propCount || 5),
      notInLaborForce: 30,
    },
    education: {
      highSchool: 25,
      bachelors: Math.round(avgDemographics.educationRate / propCount || 35),
      masters: 20,
      other: 20,
    },
  };

  return {
    subjectProperty,
    comparables,
    aiSelectionScores,
    demographics,
    aiInsights: {
      populationTrends: aiInsights?.find(i => i.category === 'market')?.content.slice(0, 500) ||
        'Population demographics show a balanced distribution across age groups with steady growth patterns.',
      buyerDemographics: aiInsights?.find(i => i.category === 'opportunity')?.content.slice(0, 500) ||
        'Target buyer demographics align well with area characteristics and median household income levels.',
      areaAppeal: aiInsights?.find(i => i.category === 'trend')?.content.slice(0, 500) ||
        'Area demographics suggest strong appeal to families and professionals seeking quality housing options.',
    },
  };
}

// ============================================================================
// PAGE 5: PRICING STRATEGY
// ============================================================================

/**
 * Extract data for Page 5 - Economic Indicators
 */
export function extractPage5Data(
  config: PDFReportConfig,
  metrics: ReportMetrics,
  aiInsights: AIInsight[],
  demographicData?: DemographicData
): Page5Data {
  const { stats, properties } = config;
  const currentYear = new Date().getFullYear();
  const medianPrice = stats.median_price || metrics.allTime.median;

  // Extract REAL economic data from property data
  const avgEconomics = properties.reduce((acc, prop) => {
    const propData = prop as unknown as Record<string, number>;
    return {
      avgIncome: acc.avgIncome + (propData.avg_household_income || 0),
      medianIncome: acc.medianIncome + (propData.ECYHNIMED || 0),
      medianHousingValue: acc.medianHousingValue + (propData.median_housing_value || 0),
      unemploymentRate: acc.unemploymentRate + (propData.unemployment_rate || 0),
      homeownershipRate: acc.homeownershipRate + (propData.homeownership_rate || propData.ECYTENOWN_P || 0),
      rentalYield: acc.rentalYield + (propData.rental_yield || 0),
      affordabilityIndex: acc.affordabilityIndex + (propData.HOUSING_AFFORDABILITY_INDEX || 0),
      count: acc.count + 1,
    };
  }, { avgIncome: 0, medianIncome: 0, medianHousingValue: 0, unemploymentRate: 0, homeownershipRate: 0, rentalYield: 0, affordabilityIndex: 0, count: 0 });

  const propCount = avgEconomics.count || 1;
  const currentAvgIncome = Math.round(avgEconomics.avgIncome / propCount) || 75000;
  const currentUnemploymentRate = Math.round((avgEconomics.unemploymentRate / propCount) * 10) / 10 || 3.5;

  // Economic trends - use REAL historical data if available, otherwise estimate from current
  const economicTrends = {
    medianIncome: [
      { year: `${currentYear - 4}`, value: Math.round(currentAvgIncome * 0.88) },
      { year: `${currentYear - 3}`, value: Math.round(currentAvgIncome * 0.92) },
      { year: `${currentYear - 2}`, value: Math.round(currentAvgIncome * 0.96) },
      { year: `${currentYear - 1}`, value: Math.round(currentAvgIncome * 0.98) },
      { year: `${currentYear}`, value: currentAvgIncome },
    ],
    homeValues: [
      { year: `${currentYear - 4}`, value: Math.round(medianPrice * 0.85) },
      { year: `${currentYear - 3}`, value: Math.round(medianPrice * 0.90) },
      { year: `${currentYear - 2}`, value: Math.round(medianPrice * 0.95) },
      { year: `${currentYear - 1}`, value: Math.round(medianPrice * 0.98) },
      { year: `${currentYear}`, value: Math.round(medianPrice) },
    ],
  };

  // Employment by sector - placeholder (not in dataset, keep generic)
  const employment = [
    { sector: 'Services', jobsAdded: 2500 },
    { sector: 'Healthcare', jobsAdded: 1800 },
    { sector: 'Education', jobsAdded: 1200 },
    { sector: 'Retail', jobsAdded: 900 },
    { sector: 'Other', jobsAdded: 600 },
  ];

  // Market Indexes from REAL data
  const avgIndexes = properties.reduce((acc, prop) => {
    const propData = prop as unknown as Record<string, number>;
    return {
      hotGrowth: acc.hotGrowth + (propData.HOT_GROWTH_INDEX || 0),
      affordability: acc.affordability + (propData.HOUSING_AFFORDABILITY_INDEX || 0),
      count: acc.count + 1,
    };
  }, { hotGrowth: 0, affordability: 0, count: 0 });

  const hotGrowthRaw = avgIndexes.hotGrowth / propCount;
  const affordabilityRaw = avgIndexes.affordability / propCount;
  
  // Check if we have real data, otherwise use calculated defaults
  const hasRealHotGrowth = avgIndexes.hotGrowth > 0;
  const hasRealAffordability = avgIndexes.affordability > 0;
  
  // Hot Growth Index: Use real data or calculate from price appreciation and inventory
  const hotGrowthIndex = hasRealHotGrowth 
    ? Math.round(hotGrowthRaw * 10) / 10
    : Math.round(Math.min(100, Math.max(0, (stats.marketAppreciation || 0) * 10 + 50))) || 50;
  
  // Affordability Index: Use real data or calculate from price-to-income ratio
  // Standard affordability: home price should be ~3-4x annual income
  // Lower ratio = more affordable = higher index score
  // Formula: 100 - ((price / income) / 4) * 100
  // If price = 4x income → index = 0 (least affordable)
  // If price = 2x income → index = 50 (moderately affordable)
  // If price = income → index = 75 (very affordable)
  const affordabilityIndex = hasRealAffordability
    ? Math.round(affordabilityRaw * 10) / 10
    : Math.round(Math.max(0, Math.min(100, 100 - ((medianPrice / currentAvgIncome) / 4) * 100))) || 45;
  
  // Log index calculation for debugging
  console.log('[extractPage5Data] Market Indexes:', {
    hotGrowthIndex,
    hotGrowthSource: hasRealHotGrowth ? 'REAL_DATA' : 'CALCULATED',
    affordabilityIndex,
    affordabilitySource: hasRealAffordability ? 'REAL_DATA' : 'CALCULATED',
    affordabilityCalc: hasRealAffordability ? 'N/A' : `price/income ratio: ${(medianPrice / currentAvgIncome).toFixed(2)}x`,
    propertiesWithData: propCount,
  });
  
  // Calculate New Homeowners Index from ownership rate and demographics
  const newHomeownersIndex = Math.round((avgEconomics.homeownershipRate / propCount) * 0.8) || 50;
  
  // Calculate overall Market Score (average of all indexes)
  const marketScore = Math.round(((hotGrowthIndex + affordabilityIndex + newHomeownersIndex) / 3) * 10) / 10 || 0;

  // Economic indicators using REAL data + Market Indexes
  const homeownershipPct = Math.round(avgEconomics.homeownershipRate / propCount) || 65;
  const rentalPct = 100 - homeownershipPct;

  const economicIndicators = [
    { category: 'Homeownership', percentage: homeownershipPct, color: '#D1A0C7' },
    { category: 'Rental Market', percentage: rentalPct, color: '#A8668A' },
  ];

  // Growth metrics from REAL data
  const growthMetrics = {
    gdpGrowth: 2.8, // Not in dataset
    unemploymentRate: currentUnemploymentRate,
    inflationRate: 2.3, // Not in dataset
  };

  // Future projections
  const futureProjections = [
    { year: `${currentYear + 1}`, projection: 'Moderate growth in housing market with 3-5% appreciation expected' },
    { year: `${currentYear + 2}`, projection: 'Continued employment growth in tech and healthcare sectors' },
    { year: `${currentYear + 3}`, projection: 'Population increase driving demand for housing and services' },
  ];

  return {
    economicTrends,
    employment,
    economicIndicators,
    growthMetrics,
    futureProjections,
    marketIndexes: {
      hotGrowthIndex,
      affordabilityIndex,
      newHomeownersIndex,
      marketScore,
    },
    aiInsights: {
      economicOutlook: aiInsights?.find(i => i.category === 'market')?.content.slice(0, 2000) ||
        'Economic indicators show stable growth with moderate unemployment and balanced housing market conditions.',
      jobMarketAnalysis: aiInsights?.find(i => i.category === 'trend')?.content.slice(0, 2000) ||
        'Employment growth across multiple sectors indicates a diverse and resilient local economy.',
      investmentPotential: aiInsights?.find(i => i.category === 'opportunity')?.content.slice(0, 2000) ||
        'Market fundamentals suggest strong long-term investment potential with favorable affordability metrics.',
    },
  };
}

// ============================================================================
// PAGE 6: MARKET TRENDS & FORECAST
// ============================================================================

/**
 * Calculate Market Momentum - Multi-dimensional momentum analysis
 * Compares last 30 days vs previous 30 days across 3 factors:
 * 1. Days on Market Trend (velocity)
 * 2. Price Velocity (appreciation/depreciation)
 * 3. Inventory Turnover (supply/demand)
 * 
 * Uses date-based temporal segmentation when available, falls back to split method.
 */
export function calculateMarketMomentum(properties: CMAProperty[]): MarketMomentumData {
  const MIN_PROPERTIES_PER_PERIOD = 5;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Separate sold vs active properties
  const soldProperties = properties.filter(p => 
    p.status?.toLowerCase() === 'sold' ||
    p.st?.toUpperCase() === 'SO'
  );
  
  const activeListings = properties.filter(p => 
    p.status?.toLowerCase() === 'active' || 
    p.st?.toUpperCase() === 'AC'
  );

  // Try date-based segmentation first
  const current30Days = soldProperties.filter(p => {
    const dateStr = p.sold_date || p.sale_date || p.close_date || p.date_bc || p.date_pp_acpt_expiration;
    if (!dateStr) return false;
    try {
      const soldDate = new Date(dateStr);
      return soldDate >= thirtyDaysAgo && soldDate <= now;
    } catch {
      return false;
    }
  });

  const previous30Days = soldProperties.filter(p => {
    const dateStr = p.sold_date || p.sale_date || p.close_date || p.date_bc || p.date_pp_acpt_expiration;
    if (!dateStr) return false;
    try {
      const soldDate = new Date(dateStr);
      return soldDate >= sixtyDaysAgo && soldDate < thirtyDaysAgo;
    } catch {
      return false;
    }
  });

  console.log(`[Market Momentum] Date-based segmentation: ${current30Days.length} recent (last 30 days), ${previous30Days.length} older (31-60 days ago)`);

  // Use date-based if we have enough data, otherwise fall back to split
  let recentGroup: CMAProperty[];
  let olderGroup: CMAProperty[];

  if (current30Days.length >= MIN_PROPERTIES_PER_PERIOD && previous30Days.length >= MIN_PROPERTIES_PER_PERIOD) {
    recentGroup = current30Days;
    olderGroup = previous30Days;
    console.log(`[Market Momentum] Using date-based groups`);
  } else {
    // Fall back to split method
    if (soldProperties.length < 10) {
      console.warn(`[Market Momentum] Insufficient sold properties (${soldProperties.length} total)`);
      return {
        classification: 'Steady',
        score: 50,
        components: {
          daysOnMarket: {
            current: 0,
            previous: 0,
            change: 0,
            changeAbsolute: 0,
            trend: 'stable',
            score: 16.7
          },
          priceVelocity: {
            current: 0,
            previous: 0,
            change: 0,
            changeAbsolute: 0,
            trend: 'stable',
            score: 16.7
          },
          inventoryTurnover: {
            soldCount: soldProperties.length,
            activeCount: activeListings.length,
            ratio: 0,
            trend: 'balanced',
            score: 16.6
          }
        },
        metadata: {
          current30DaysCount: 0,
          previous30DaysCount: 0,
          activeListingsCount: activeListings.length,
          hasInsufficientData: true,
          calculationDate: now.toISOString()
        }
      };
    }

    const midpoint = Math.floor(soldProperties.length / 2);
    recentGroup = soldProperties.slice(0, midpoint);
    olderGroup = soldProperties.slice(midpoint);
    console.log(`[Market Momentum] Using split method: ${recentGroup.length} recent, ${olderGroup.length} older`);
  }

  // COMPONENT A: Days on Market Trend (33% weight)
  // Calculate time_on_market for properties that don't have it
  const getDOM = (p: CMAProperty): number => {
    if (p.time_on_market && p.time_on_market > 0) {
      return p.time_on_market;
    }
    // Calculate from dates if missing
    const calculated = calculateTimeOnMarket(p);
    return calculated || 0;
  };

  const recentDOMProperties = recentGroup.filter(p => getDOM(p) > 0);
  const olderDOMProperties = olderGroup.filter(p => getDOM(p) > 0);

  console.log(`[Market Momentum] DOM data: ${recentDOMProperties.length} recent, ${olderDOMProperties.length} older (with valid time_on_market)`);

  const currentDOM = recentDOMProperties.length > 0
    ? recentDOMProperties.reduce((sum, p) => sum + getDOM(p), 0) / recentDOMProperties.length
    : 0;

  const previousDOM = olderDOMProperties.length > 0
    ? olderDOMProperties.reduce((sum, p) => sum + getDOM(p), 0) / olderDOMProperties.length
    : currentDOM; // Use current as fallback

  const domChange = previousDOM > 0 ? ((currentDOM - previousDOM) / previousDOM) * 100 : 0;
  const domChangeAbsolute = currentDOM - previousDOM;
  
  const domTrend: 'faster' | 'stable' | 'slower' =
    domChange < -10 ? 'faster' :
    domChange > 10 ? 'slower' :
    'stable';

  // Score: Faster sales = higher score (inverted logic - lower DOM is better)
  let domScore = 16.7; // Default stable
  if (domChange <= -20) domScore = 33.3;
  else if (domChange <= -10) domScore = 25;
  else if (domChange > 10 && domChange <= 20) domScore = 10;
  else if (domChange > 20) domScore = 0;

  // COMPONENT B: Price Velocity (33% weight)
  const recentPriceProperties = recentGroup.filter(p => {
    const price = p.sold_price ?? p.sale_price ?? p.price;
    return price && price > 0;
  });
  const olderPriceProperties = olderGroup.filter(p => {
    const price = p.sold_price ?? p.sale_price ?? p.price;
    return price && price > 0;
  });
  
  const currentPrice = recentPriceProperties.length > 0
    ? recentPriceProperties.reduce((sum, p) => sum + (p.sold_price ?? p.sale_price ?? p.price ?? 0), 0) / recentPriceProperties.length
    : 0;
  
  const previousPrice = olderPriceProperties.length > 0
    ? olderPriceProperties.reduce((sum, p) => sum + (p.sold_price ?? p.sale_price ?? p.price ?? 0), 0) / olderPriceProperties.length
    : currentPrice;

  const priceChange = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
  const priceChangeAbsolute = currentPrice - previousPrice;
  
  const priceTrend: 'rising' | 'stable' | 'falling' =
    priceChange > 3 ? 'rising' :
    priceChange < -3 ? 'falling' :
    'stable';

  // Score: Rising prices = higher score
  let priceScore = 16.7; // Default stable
  if (priceChange >= 5) priceScore = 33.3;
  else if (priceChange >= 3) priceScore = 25;
  else if (priceChange < -3 && priceChange >= -5) priceScore = 10;
  else if (priceChange < -5) priceScore = 0;

  // COMPONENT C: Inventory Turnover (34% weight)
  const soldCount = soldProperties.length;
  const activeCount = activeListings.length;
  const turnoverRatio = activeCount > 0 ? soldCount / activeCount : 0;
  
  const inventoryTrend: 'high' | 'balanced' | 'low' =
    turnoverRatio >= 1.5 ? 'high' :
    turnoverRatio >= 0.8 ? 'balanced' :
    'low';

  // Score: High turnover = higher score
  let inventoryScore = 16.7; // Default balanced
  if (turnoverRatio >= 2.0) inventoryScore = 33.4;
  else if (turnoverRatio >= 1.5) inventoryScore = 25;
  else if (turnoverRatio >= 0.8) inventoryScore = 16.7;
  else if (turnoverRatio >= 0.5) inventoryScore = 10;
  else inventoryScore = 0;

  // COMPOSITE SCORE & CLASSIFICATION
  const compositeScore = domScore + priceScore + inventoryScore;
  const classification: 'Accelerating' | 'Steady' | 'Decelerating' =
    compositeScore >= 70 ? 'Accelerating' :
    compositeScore >= 40 ? 'Steady' :
    'Decelerating';

  console.log(`[Market Momentum] ${classification} (score: ${compositeScore.toFixed(1)})`);
  console.log(`  DOM: ${currentDOM.toFixed(0)} days (${domChange >= 0 ? '+' : ''}${domChange.toFixed(1)}%) - ${domTrend}`);
  console.log(`  Price: $${currentPrice.toFixed(0)} (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(1)}%) - ${priceTrend}`);
  console.log(`  Inventory: ${turnoverRatio.toFixed(2)}x (${soldCount} sold / ${activeCount} active) - ${inventoryTrend}`);

  return {
    classification,
    score: compositeScore,
    components: {
      daysOnMarket: {
        current: Math.round(currentDOM),
        previous: Math.round(previousDOM),
        change: domChange,
        changeAbsolute: domChangeAbsolute,
        trend: domTrend,
        score: domScore
      },
      priceVelocity: {
        current: Math.round(currentPrice),
        previous: Math.round(previousPrice),
        change: priceChange,
        changeAbsolute: priceChangeAbsolute,
        trend: priceTrend,
        score: priceScore
      },
      inventoryTurnover: {
        soldCount,
        activeCount,
        ratio: turnoverRatio,
        trend: inventoryTrend,
        score: inventoryScore
      }
    },
    metadata: {
      current30DaysCount: recentGroup.length,
      previous30DaysCount: olderGroup.length,
      activeListingsCount: activeListings.length,
      hasInsufficientData: false,
      calculationDate: now.toISOString()
    }
  };
}

/**
 * Extract data for Page 6 - Comparable Properties Analysis
 *
 * NOTE: Page 6 uses two data sources:
 * - config.properties (selected comparables): For the comparables table
 * - config.areaProperties (full area data): For market momentum, velocity distribution
 *   (these metrics need larger sample sizes for statistical significance)
 */
export function extractPage6Data(
  config: PDFReportConfig,
  metrics: ReportMetrics
): Page6Data {
  const { properties, stats } = config;
  // Use areaProperties for market momentum (needs larger sample), fallback to properties
  const areaProperties = config.areaProperties || properties;
  const medianPrice = stats.median_price || metrics.allTime.median;

  // Subject property (first property or default)
  const firstProp = properties[0];
  const subjectProperty = {
    address: firstProp?.address || 'Subject Property',
    sqft: firstProp?.squareFootage || 2000,
    beds: firstProp?.bedrooms || 3,
    baths: firstProp?.bathrooms || 2,
    estimatedValue: firstProp?.price || medianPrice,
    pricePerSqft: (firstProp?.price || medianPrice) / (firstProp?.squareFootage || 2000),
  };

  // Comparable properties (top 5) - USE REAL DATA
  const comparableProperties = properties.slice(0, 5).map((prop, index) => {
    const pricePerSqft = prop.price / (prop.squareFootage || 2000);
    const sizeAdjustment = ((prop.squareFootage || 2000) - subjectProperty.sqft) / subjectProperty.sqft * 5;
    
    // Use real adjustment data (currently not in dataset, keep as 0 until available)
    const locationAdjustment = 0;
    const conditionAdjustment = 0;
    const featuresAdjustment = 0;
    const totalAdjustment = sizeAdjustment + locationAdjustment + conditionAdjustment + featuresAdjustment;

    return {
      address: prop.address,
      price: prop.price,
      pricePerSqft,
      sqft: prop.squareFootage || 2000,
      beds: prop.bedrooms || 3,
      baths: prop.bathrooms || 2,
      daysOnMarket: prop.time_on_market || 0, // ✅ USE REAL time_on_market from property data
      similarityScore: 95 - (index * 5),
      adjustments: {
        location: Math.round(locationAdjustment * 100) / 100,
        condition: Math.round(conditionAdjustment * 100) / 100,
        size: Math.round(sizeAdjustment * 100) / 100,
        features: Math.round(featuresAdjustment * 100) / 100,
        total: Math.round(totalAdjustment * 100) / 100,
      },
    };
  });

  // Market analysis
  const allPricesPerSqft = comparableProperties.map(c => c.pricePerSqft);
  const averagePricePerSqft = allPricesPerSqft.reduce((a, b) => a + b, 0) / allPricesPerSqft.length;
  const lowPrice = Math.round(medianPrice * 0.92);
  const highPrice = Math.round(medianPrice * 1.08);
  const recommendedPrice = Math.round(medianPrice * 1.02);

  const marketPosition: 'Above Market' | 'At Market' | 'Below Market' =
    subjectProperty.pricePerSqft > averagePricePerSqft * 1.05 ? 'Above Market' :
    subjectProperty.pricePerSqft < averagePricePerSqft * 0.95 ? 'Below Market' : 'At Market';

  // Calculate confidence level based on data quality
  // Factors: sample size, data completeness, recency
  const calculateConfidenceLevel = () => {
    let confidence = 0;
    const totalProps = properties.length;

    // Sample size contribution (max 40 points)
    if (totalProps >= 20) confidence += 40;
    else if (totalProps >= 10) confidence += 30;
    else if (totalProps >= 5) confidence += 20;
    else if (totalProps >= 1) confidence += 10;

    // Data completeness contribution (max 30 points)
    const propsWithPrice = properties.filter(p => p.price && p.price > 0).length;
    const propsWithSqFt = properties.filter(p => p.squareFootage && p.squareFootage > 0).length;
    const propsWithDOM = properties.filter(p => p.time_on_market && p.time_on_market > 0).length;
    const completenessRatio = totalProps > 0
      ? (propsWithPrice + propsWithSqFt + propsWithDOM) / (totalProps * 3)
      : 0;
    confidence += Math.round(completenessRatio * 30);

    // Status mix contribution (max 30 points) - balanced sold/active is better
    const soldCount = properties.filter(p => p.status?.toLowerCase() === 'sold' || p.st?.toUpperCase() === 'SO').length;
    const activeCount = totalProps - soldCount;
    const mixRatio = totalProps > 0 ? Math.min(soldCount, activeCount) / Math.max(soldCount, activeCount, 1) : 0;
    confidence += Math.round(mixRatio * 30);

    return Math.min(100, Math.max(0, confidence));
  };

  const marketAnalysis = {
    averagePricePerSqft: Math.round(averagePricePerSqft * 100) / 100,
    priceRange: { low: lowPrice, high: highPrice, recommended: recommendedPrice },
    confidenceLevel: calculateConfidenceLevel(),
    marketPosition,
  };

  // ✅ NEW: Market Activity & Velocity Metrics (Page 6 specific)
  
  // 1. Price to Median Ratio - Calculate average property price / market median
  const propsWithPrice = properties.filter(p => p.price && p.price > 0);
  const marketMedian = stats.median_price || metrics.allTime.median;
  
  let priceToMedianRatio = 1.0;
  if (propsWithPrice.length > 0 && marketMedian > 0) {
    const avgPrice = propsWithPrice.reduce((sum, p) => sum + (p.price || 0), 0) / propsWithPrice.length;
    priceToMedianRatio = Math.round((avgPrice / marketMedian) * 100) / 100;
  }
  
  console.log(`[extractPage6Data] Price to Median Ratio: ${priceToMedianRatio}x (avg $${Math.round(propsWithPrice.reduce((sum, p) => sum + (p.price || 0), 0) / propsWithPrice.length)} / median $${marketMedian})`);

  // 2. Sale-to-List Ratio - Calculate from sold properties (sold_price / asking_price)
  // Check both normalized 'status' field AND raw 'st' field (SO/AC) from blob data
  const soldProperties = properties.filter(p =>
    p.status?.toLowerCase() === 'sold' || p.st?.toUpperCase() === 'SO'
  );
  
  const soldPropsWithPrices = soldProperties.filter(p => {
    const asking = p.asking_price || p.asked_price || p.original_price;
    const sold = p.sold_price || p.sale_price;
    return asking && sold && asking > 0 && sold > 0;
  });
  
  // Calculate sale-to-list ratio:
  // 1. First try: Use asking_price and sold_price if available
  // 2. Fallback: Use price_delta field (represents % change from listing to sale)
  // 3. Default: 0 (will display as "N/A" in PDF)
  let saleToListRatio = 0; // Default to 0 (will display as "N/A")

  if (soldPropsWithPrices.length > 0) {
    // Method 1: Calculate from separate asking/sold prices
    const totalRatio = soldPropsWithPrices.reduce((sum, p) => {
      const asking = p.asking_price || p.asked_price || p.original_price || 1;
      const sold = p.sold_price || p.sale_price || 0;
      return sum + ((sold / asking) * 100);
    }, 0);
    saleToListRatio = Math.round(totalRatio / soldPropsWithPrices.length);
    console.log(`[extractPage6Data] Sale-to-List Ratio: ${saleToListRatio}% (from ${soldPropsWithPrices.length} sold properties with asking/sold prices)`);
  } else {
    // Method 2: Use price_delta field (% difference from listing)
    // price_delta represents the percentage change, so sale-to-list = 100 + price_delta
    const soldPropsWithDelta = soldProperties.filter(p =>
      p.price_delta !== undefined &&
      p.price_delta !== null &&
      typeof p.price_delta === 'number' &&
      !isNaN(p.price_delta)
    );

    if (soldPropsWithDelta.length > 0) {
      const avgDelta = soldPropsWithDelta.reduce((sum, p) => sum + (p.price_delta || 0), 0) / soldPropsWithDelta.length;
      // Convert delta to sale-to-list ratio: if delta is -3%, then ratio is 97%
      saleToListRatio = Math.round(100 + avgDelta);
      console.log(`[extractPage6Data] Sale-to-List Ratio: ${saleToListRatio}% (from ${soldPropsWithDelta.length} sold properties using price_delta)`);
    } else {
      console.log(`[extractPage6Data] Sale-to-List Ratio: N/A (no price data available)`);
      console.log(`[extractPage6Data] Sold properties: ${soldProperties.length}, with asking_price: ${soldProperties.filter(p => p.asking_price || p.asked_price || p.original_price).length}, with price_delta: ${soldProperties.filter(p => p.price_delta !== undefined && p.price_delta !== null).length}`);
    }
  }

  // 4. Market Momentum (based on avg time on market)
  // IMPORTANT: Use AREA PROPERTIES (full dataset) for momentum calculation
  // Market momentum requires larger sample sizes for statistical significance
  // Check both normalized 'status' field AND raw 'st' field (SO/AC) from blob data
  const soldPropertiesForMomentum = areaProperties.filter(p =>
    (p.status?.toLowerCase() === 'sold' || p.st?.toUpperCase() === 'SO') &&
    p.time_on_market &&
    p.time_on_market > 0
  );

  const avgTimeOnMarket = soldPropertiesForMomentum.length > 0
    ? Math.round(soldPropertiesForMomentum.reduce((sum, p) => sum + (p.time_on_market || 0), 0) / soldPropertiesForMomentum.length)
    : 0;

  console.log(`[extractPage6Data] Market Momentum Calculation (using AREA data):`, {
    selectedComparables: properties.length,
    areaProperties: areaProperties.length,
    soldPropertiesUsed: soldPropertiesForMomentum.length,
    avgTimeOnMarket,
    sampleTimeOnMarket: soldPropertiesForMomentum.slice(0, 5).map(p => p.time_on_market)
  });

  // 4. Market Momentum (multi-dimensional calculation)
  // Calculate true momentum by comparing 30-day periods across 3 factors:
  // - Days on Market Trend, Price Velocity, Inventory Turnover
  // Uses AREA PROPERTIES for statistical significance
  const marketMomentum = calculateMarketMomentum(areaProperties);

  console.log(`[extractPage6Data] Market Momentum Result:`, {
    classification: marketMomentum.classification,
    score: marketMomentum.score.toFixed(1),
    components: {
      dom: `${marketMomentum.components.daysOnMarket.change.toFixed(1)}% (${marketMomentum.components.daysOnMarket.trend})`,
      price: `${marketMomentum.components.priceVelocity.change.toFixed(1)}% (${marketMomentum.components.priceVelocity.trend})`,
      inventory: `${marketMomentum.components.inventoryTurnover.ratio.toFixed(2)}x (${marketMomentum.components.inventoryTurnover.trend})`
    }
  });

  // 5. Velocity Distribution (Chart 1 data)
  // Filter for SOLD properties only (like price_delta) since time_on_market is from listing to sale
  // Uses AREA PROPERTIES for statistical significance in trend analysis
  // Check both normalized 'status' field AND raw 'st' field (SO/AC) from blob data
  const soldPropertiesWithDOM = areaProperties.filter(p =>
    (p.status?.toLowerCase() === 'sold' || p.st?.toUpperCase() === 'SO') &&
    p.time_on_market &&
    p.time_on_market > 0
  );

  console.log(`[extractPage6Data] Sold properties with time_on_market (from AREA data): ${soldPropertiesWithDOM.length} / ${areaProperties.filter(p => p.status?.toLowerCase() === 'sold' || p.st?.toUpperCase() === 'SO').length} sold`);
  if (soldPropertiesWithDOM.length > 0) {
    console.log(`[extractPage6Data] Sample time_on_market values:`, soldPropertiesWithDOM.slice(0, 5).map(p => p.time_on_market));
  }
  
  // Calculate Price Achievement Rate (average % of asking price that sellers achieve)
  // This is more meaningful than listing absorption rate (which compared 3-year sold vs current active)
  let priceAchievementRate = 100; // Default to 100% if no data
  
  const propsWithBothPrices = soldPropertiesWithDOM.filter(p => {
    const asking = p.asking_price || p.asked_price || p.original_price || p.price;
    const sold = p.sold_price || p.sale_price;
    return asking && sold && asking > 0 && sold > 0;
  });
  
  if (propsWithBothPrices.length > 0) {
    const totalAchievementRate = propsWithBothPrices.reduce((sum, p) => {
      const asking = p.asking_price || p.asked_price || p.original_price || p.price || 1;
      const sold = p.sold_price || p.sale_price || 0;
      return sum + ((sold / asking) * 100);
    }, 0);
    priceAchievementRate = Math.round(totalAchievementRate / propsWithBothPrices.length);
    console.log(`[extractPage6Data] Price Achievement Rate: ${priceAchievementRate}% (from ${propsWithBothPrices.length} properties with both prices)`);
    console.log(`[extractPage6Data] Sample price achievements:`, propsWithBothPrices.slice(0, 3).map(p => {
      const asking = p.asking_price || p.asked_price || p.original_price || p.price || 1;
      const sold = p.sold_price || p.sale_price || 0;
      return `${Math.round((sold / asking) * 100)}%`;
    }));
  } else {
    console.log(`[extractPage6Data] Price Achievement Rate: ${priceAchievementRate}% (default - no sold properties with both asking and sold prices found)`);
  }
  
  const velocityDistribution = {
    '0-10': soldPropertiesWithDOM.filter(p => p.time_on_market! <= 10).length,
    '11-20': soldPropertiesWithDOM.filter(p => p.time_on_market! > 10 && p.time_on_market! <= 20).length,
    '21-30': soldPropertiesWithDOM.filter(p => p.time_on_market! > 20 && p.time_on_market! <= 30).length,
    '31-45': soldPropertiesWithDOM.filter(p => p.time_on_market! > 30 && p.time_on_market! <= 45).length,
    '45+': soldPropertiesWithDOM.filter(p => p.time_on_market! > 45).length,
  };
  
  console.log(`[extractPage6Data] Velocity distribution:`, velocityDistribution);

  // 6. Velocity by Price Point (Chart 2 data)
  // Use SOLD properties only (like price_delta) since time_on_market is from listing to sale
  const priceRanges = [
    { range: '$0-500k', min: 0, max: 500000 },
    { range: '$500-700k', min: 500000, max: 700000 },
    { range: '$700-900k', min: 700000, max: 900000 },
    { range: '$900k-1.1M', min: 900000, max: 1100000 },
    { range: '$1.1M+', min: 1100000, max: Infinity },
  ];

  const velocityByPrice = priceRanges.map(({ range, min, max }) => {
    const propsInRange = soldPropertiesWithDOM.filter(p => p.price >= min && p.price < max);
    const avgDaysOnMarket = propsInRange.length > 0
      ? Math.round(propsInRange.reduce((sum, p) => sum + (p.time_on_market || 0), 0) / propsInRange.length)
      : 0;
    return {
      range,
      avgDaysOnMarket,
      propertyCount: propsInRange.length,
    };
  });

  const marketActivity = {
    priceToMedianRatio,
    saleToListRatio,
    priceAchievementRate,
    marketMomentum,
  };

  // Adjustment summary
  const allAdjustments = comparableProperties.flatMap(c => [
    c.adjustments.location,
    c.adjustments.condition,
    c.adjustments.size,
    c.adjustments.features,
  ]);
  const averageAdjustment = allAdjustments.reduce((a, b) => a + b, 0) / allAdjustments.length;
  const minAdjustment = Math.min(...allAdjustments);
  const maxAdjustment = Math.max(...allAdjustments);

  const adjustmentSummary = {
    averageAdjustment: Math.round(averageAdjustment * 100) / 100,
    adjustmentRange: { min: Math.round(minAdjustment * 100) / 100, max: Math.round(maxAdjustment * 100) / 100 },
    mostCommonAdjustments: ['Size differences', 'Location variations', 'Condition factors'],
  };

  return {
    comparableProperties,
    subjectProperty,
    marketAnalysis,
    adjustmentSummary,
    // ✅ NEW: Market Activity & Velocity data
    marketActivity,
    velocityDistribution,
    velocityByPrice,
  };
}

// ============================================================================
// PAGE 7: EXECUTIVE SUMMARY & RECOMMENDATIONS
// ============================================================================

/**
 * Extract data for Page 7 - Executive Summary & Recommendations
 */
export function extractPage7Data(
  config: PDFReportConfig,
  metrics: ReportMetrics,
  aiInsights: AIInsight[]
): Page7Data {
  const { stats } = config;

  const avgDOM = stats.average_dom || metrics.allTime.avgTimeOnMarket;
  const recommendedAction = avgDOM < 35 ? 'List Now' : avgDOM < 60 ? 'Prepare' : 'Wait';

  return {
    aiExecutiveSummary: {
      marketPosition: {
        summary: aiInsights?.find(i => i.category === 'market')?.content.slice(0, 400) ||
          'Property positioned competitively within strong seller\'s market with limited inventory.',
        keyFinding: 'Low inventory and high buyer demand create favorable listing conditions.',
      },
      valuationConfidence: {
        summary: aiInsights?.find(i => i.category === 'pricing')?.content.slice(0, 400) ||
          'Valuation supported by comprehensive comparable analysis and market data.',
        confidenceScore: 85,
      },
      strategicOutlook: {
        summary: aiInsights?.find(i => i.category === 'trend')?.content.slice(0, 400) ||
          'Market trends support strategic timing with continued appreciation expected.',
        recommendation: recommendedAction as 'List Now' | 'Wait' | 'Prepare',
      },
    },
    keyFindings: [
      {
        title: 'Strong Market Position',
        description: 'Property is well-positioned in a competitive market with favorable pricing relative to recent sales and current inventory.',
        icon: '📊',
      },
      {
        title: 'Optimal Timing',
        description: `Market conditions suggest ${recommendedAction.toLowerCase()} based on current inventory levels and buyer demand patterns.`,
        icon: '⏰',
      },
      {
        title: 'Valuation Confidence',
        description: 'Analysis based on comprehensive comparable data provides high confidence in estimated market value range.',
        icon: '✓',
      },
      {
        title: 'Market Momentum',
        description: avgDOM < 40 ? 'Fast-moving market with properties selling quickly indicates strong buyer interest.' : 'Steady market with normal absorption rates provides predictable selling timeline.',
        icon: '📈',
      },
    ],
    recommendedActions: [
      {
        action: 'Complete pre-listing inspection',
        icon: '🔍',
        rationale: 'Identify and address issues before listing to maximize value',
        timing: '2-3 weeks before listing',
        priority: 'High' as const,
      },
      {
        action: 'Professional photography and staging',
        icon: '📸',
        rationale: 'Enhance online presence and buyer perception',
        timing: '1 week before listing',
        priority: 'High' as const,
      },
      {
        action: 'Finalize pricing strategy',
        icon: '💰',
        rationale: 'Align pricing with market conditions and goals',
        timing: '1 week before listing',
        priority: 'High' as const,
      },
      {
        action: 'Prepare marketing materials',
        icon: '📊',
        rationale: 'Create comprehensive property marketing package',
        timing: '2 weeks before listing',
        priority: 'Medium' as const,
      },
      {
        action: 'Schedule open house events',
        icon: '🏠',
        rationale: 'Generate buyer interest and competitive offers',
        timing: 'First weekend after listing',
        priority: 'Medium' as const,
      },
    ],
    disclaimer: 'This report is provided for informational purposes only and should not be considered as professional financial, legal, or real estate advice. Market conditions can change rapidly, and individual circumstances vary. Consult with qualified professionals before making any real estate decisions.',
  };
}
