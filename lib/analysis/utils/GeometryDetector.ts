/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProcessedAnalysisData } from '../types';

/**
 * GeometryDetector - Smart geometry type detection for visualization rendering
 * 
 * Analyzes data characteristics to determine whether features should be rendered
 * as points (properties, businesses) or polygons (geographic areas, ZIP codes)
 */
export class GeometryDetector {
  
  /**
   * Detect the appropriate geometry type for visualization
   */
  static detectGeometryType(data: ProcessedAnalysisData): 'point' | 'polygon' | 'line' | 'unknown' {
    if (!data.records || data.records.length === 0) {
      console.log('[GeometryDetector] 🔍 No records found, returning unknown');
      return 'unknown';
    }
    
    console.log('[GeometryDetector] 🔍 Analyzing', data.records.length, 'records for geometry type');
    
    // ENHANCED PROPERTY DATA DETECTION: Check if this is property/business point data
    const isPropertyData = this.isPropertyPointData(data);
    if (isPropertyData) {
      console.log('[GeometryDetector] 🎯 Detected PROPERTY DATA - using POINT geometry for business/property locations');
      return 'point';
    }

    // Check for ZIP code or area-based analysis (should use polygons)
    const isAreaAnalysis = this.isAreaBasedAnalysis(data);
    if (isAreaAnalysis) {
      console.log('[GeometryDetector] 🎯 Detected AREA ANALYSIS - using POLYGON geometry for geographic regions');
      return 'polygon';
    }
    
    // Check first few records for explicit geometry type
    for (let i = 0; i < Math.min(5, data.records.length); i++) {
      const record = data.records[i];
      
      // Check in properties for geometry info
      const geometry = (record.properties as any)?.geometry;
      if (geometry?.type) {
        const geometryType = (geometry.type as string).toLowerCase();
        console.log(`[GeometryDetector] 🔍 Found explicit geometry.type = ${geometryType}`);
        
        switch (geometryType) {
          case 'point':
          case 'multipoint':
            return 'point';
          case 'polygon':
          case 'multipolygon':
            return 'polygon';
          case 'linestring':
          case 'multilinestring':
            return 'line';
        }
      }
      
      // Check actual geometry field
      if ((record.geometry as any)?.type) {
        const geometryType = ((record.geometry as any).type as string).toLowerCase();
        console.log(`[GeometryDetector] 🔍 Found explicit main geometry.type = ${geometryType}`);
        
        switch (geometryType) {
          case 'point':
          case 'multipoint':
            return 'point';
          case 'polygon':
          case 'multipolygon':
            return 'polygon';
          case 'linestring':
          case 'multilinestring':
            return 'line';
        }
      }
      
      // If no explicit geometry, infer from coordinates
      if (record.coordinates && Array.isArray(record.coordinates)) {
        console.log('[GeometryDetector] 🔍 Found coordinates array, inferring POINT');
        return 'point';
      }
    }
    
    // Default to polygon for geographic analysis
    console.log('[GeometryDetector] 🔍 No geometry info found, defaulting to POLYGON');
    return 'polygon';
  }

  /**
   * Detect if this is property/business point data that should be rendered as points
   */
  static isPropertyPointData(data: ProcessedAnalysisData): boolean {
    if (!data.records || data.records.length === 0) return false;

    // Check for property/business indicators in field names
    const sampleRecord = data.records[0];
    const allKeys = [
      ...Object.keys(sampleRecord),
      ...Object.keys(sampleRecord.properties || {})
    ].map(key => key.toLowerCase());

    // Property/business indicators
    const propertyIndicators = [
      'store', 'business', 'company', 'shop', 'retail', 'location',
      'address', 'property', 'building', 'establishment', 'venue',
      'franchise', 'branch', 'outlet', 'site', 'facility', 'poi'
    ];

    const hasPropertyIndicators = propertyIndicators.some(indicator =>
      allKeys.some(key => key.includes(indicator))
    );

    // Check if area names look like business names vs geographic areas
    const areaNames = data.records.slice(0, 10).map(r => r.area_name?.toLowerCase() || '');
    const businessNamePattern = /(store|shop|#\d+|inc\.|ltd\.|llc|corp|restaurant|cafe|center|plaza|branch|location|mall|hotel)/;
    const hasBusinessNames = areaNames.some(name => businessNamePattern.test(name));

    // Check for coordinates that suggest individual locations vs area centroids
    const hasPointCoordinates = data.records.some(record => 
      record.coordinates && 
      Array.isArray(record.coordinates) && 
      record.coordinates.length === 2 &&
      !record.area_name?.match(/^\d{5}$/) // Not a ZIP code
    );

    // Check for specific property data patterns (addresses, lat/lng fields)
    // BUT exclude if area names are clearly ZIP codes or geographic areas
    const hasAddressData = allKeys.some(key => 
      key.includes('address') || key.includes('street') || 
      key.includes('latitude') || key.includes('longitude') ||
      key.includes('lat') || key.includes('lng')
    );

    // Override check: If area names are ZIP codes, this is NOT property data
    const areaIsZipCodes = areaNames.some(name => /^\d{5}(-\d{4})?$/.test(name));
    const areaIsGeographic = areaNames.some(name => 
      /county|district|city|town|region|area|zone|neighborhood|tract|census|block|fsa/i.test(name)
    );

    // If we detect ZIP codes or geographic areas, don't treat as property data
    // even if there are address-like fields (could be centroids)
    if (areaIsZipCodes || areaIsGeographic) {
      console.log('[GeometryDetector] 🔍 isPropertyPointData analysis (OVERRIDE):', {
        hasPropertyIndicators,
        hasBusinessNames,
        hasPointCoordinates,
        hasAddressData,
        areaIsZipCodes,
        areaIsGeographic,
        sampleAreaNames: areaNames.slice(0, 3),
        result: false
      });
      return false;
    }

    console.log('[GeometryDetector] 🔍 isPropertyPointData analysis:', {
      hasPropertyIndicators,
      hasBusinessNames,
      hasPointCoordinates,
      hasAddressData,
      sampleAreaNames: areaNames.slice(0, 3),
      result: hasPropertyIndicators || hasBusinessNames || hasPointCoordinates || hasAddressData
    });

    return hasPropertyIndicators || hasBusinessNames || hasPointCoordinates || hasAddressData;
  }

  /**
   * Detect if this is area-based analysis (ZIP codes, census tracts, etc.) that should use polygons
   */
  static isAreaBasedAnalysis(data: ProcessedAnalysisData): boolean {
    if (!data.records || data.records.length === 0) return false;

    // Check if area names are ZIP codes, census tracts, or geographic regions
    const areaNames = data.records.slice(0, 10).map(r => r.area_name || '');
    
    // ZIP code pattern
    const isZipCodes = areaNames.some(name => /^\d{5}(-\d{4})?$/.test(name));
    
    // Census tract pattern
    const isCensusTracts = areaNames.some(name => /tract|census|block|fsa/i.test(name));
    
    // Geographic region patterns
    const isGeographicRegions = areaNames.some(name => 
      /county|district|city|town|region|area|zone|neighborhood|municipality|province|state/i.test(name)
    );

    // Check for clustered data (ZIP codes with cluster assignments)
    const isClusteredZipData = data.isClustered && 
      areaNames.some(name => /^\d{5}(-\d{4})?$/.test(name));

    // Check analysis type patterns that suggest area-based analysis
    const areaAnalysisTypes = ['demographic', 'strategic', 'market', 'competitive'];
    const isAreaAnalysisType = areaAnalysisTypes.some(type => 
      data.type?.includes(type) || data.type?.includes('analysis')
    );

    console.log('[GeometryDetector] 🔍 isAreaBasedAnalysis analysis:', {
      isZipCodes,
      isCensusTracts,
      isGeographicRegions,
      isClusteredZipData,
      isAreaAnalysisType,
      dataType: data.type,
      sampleAreaNames: areaNames.slice(0, 3),
      result: isZipCodes || isCensusTracts || isGeographicRegions || isClusteredZipData || isAreaAnalysisType
    });

    return isZipCodes || isCensusTracts || isGeographicRegions || isClusteredZipData || isAreaAnalysisType;
  }

  /**
   * Determine rendering strategy based on data characteristics
   */
  static determineRenderingStrategy(data: ProcessedAnalysisData): {
    geometryType: 'point' | 'polygon' | 'line' | 'unknown';
    renderingHints: {
      useGraduatedSymbols?: boolean;
      useClassBreaks?: boolean;
      emphasizeIndividualFeatures?: boolean;
      showAreaBoundaries?: boolean;
    };
  } {
    const geometryType = this.detectGeometryType(data);
    
    const renderingHints: any = {};
    
    if (geometryType === 'point') {
      renderingHints.useGraduatedSymbols = true;
      renderingHints.emphasizeIndividualFeatures = true;
      renderingHints.useClassBreaks = true;
    } else if (geometryType === 'polygon') {
      renderingHints.showAreaBoundaries = true;
      renderingHints.useClassBreaks = true;
      renderingHints.emphasizeIndividualFeatures = false;
    }
    
    return {
      geometryType,
      renderingHints
    };
  }
}