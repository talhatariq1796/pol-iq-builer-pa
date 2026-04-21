/**
 * Coordinate System Transformation Utilities
 * 
 * Handles conversion between different coordinate systems commonly used in GIS:
 * - WGS84 (EPSG:4326) - Standard longitude/latitude
 * - Web Mercator (EPSG:3857) - Projected coordinates used by web maps
 */

export interface CoordinateSystem {
  wkid: number;
  name: string;
  type: 'geographic' | 'projected';
}

export const COORDINATE_SYSTEMS = {
  WGS84: { wkid: 4326, name: 'WGS84', type: 'geographic' as const },
  WEB_MERCATOR: { wkid: 3857, name: 'Web Mercator', type: 'projected' as const }
};

/**
 * Detect coordinate system based on coordinate ranges
 */
export function detectCoordinateSystem(coordinates: number[]): CoordinateSystem {
  const [x, y] = coordinates;
  
  // Web Mercator coordinates are typically very large numbers
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    return COORDINATE_SYSTEMS.WEB_MERCATOR;
  }
  
  // WGS84 coordinates are in the range [-180, 180] for longitude, [-90, 90] for latitude
  if (x >= -180 && x <= 180 && y >= -90 && y <= 90) {
    return COORDINATE_SYSTEMS.WGS84;
  }
  
  // Default to Web Mercator for large numbers
  return COORDINATE_SYSTEMS.WEB_MERCATOR;
}

/**
 * Detect coordinate system from geometry bounds
 */
export function detectCoordinateSystemFromBounds(bounds: {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}): CoordinateSystem {
  const { xmin, ymin, xmax, ymax } = bounds;
  
  // Check if any coordinate is outside WGS84 range
  if (Math.abs(xmin) > 180 || Math.abs(xmax) > 180 || 
      Math.abs(ymin) > 90 || Math.abs(ymax) > 90) {
    return COORDINATE_SYSTEMS.WEB_MERCATOR;
  }
  
  return COORDINATE_SYSTEMS.WGS84;
}

/**
 * Convert Web Mercator coordinates to WGS84
 */
export function webMercatorToWGS84(x: number, y: number): [number, number] {
  const lon = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
  
  return [lon, lat];
}

/**
 * Convert WGS84 coordinates to Web Mercator
 */
export function wgs84ToWebMercator(lon: number, lat: number): [number, number] {
  const x = lon * 20037508.34 / 180;
  let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
  y = y * 20037508.34 / 180;
  
  return [x, y];
}

/**
 * Transform geometry coordinates between coordinate systems
 */
export function transformGeometry(geometry: any, targetSystem: CoordinateSystem): any {
  if (!geometry) return geometry;
  
  const sourceSystem = detectCoordinateSystemFromGeometry(geometry);
  
  // No transformation needed if already in target system
  if (sourceSystem.wkid === targetSystem.wkid) {
    console.log(`[CoordinateTransform] No transformation needed: already in ${targetSystem.name}`);
    return geometry;
  }
  
  console.log(`[CoordinateTransform] Transforming from ${sourceSystem.name} to ${targetSystem.name}`);
  
  const transformedGeometry = { ...geometry };
  
  // Handle GeoJSON format
  if (geometry.coordinates) {
    transformedGeometry.coordinates = transformCoordinatesArray(
      geometry.coordinates, 
      sourceSystem, 
      targetSystem
    );
  }
  
  // Handle ArcGIS format
  if (geometry.rings) {
    transformedGeometry.rings = geometry.rings.map((ring: number[][]) => 
      transformCoordinatesArray(ring, sourceSystem, targetSystem)
    );
  }
  
  if (geometry.paths) {
    transformedGeometry.paths = geometry.paths.map((path: number[][]) => 
      transformCoordinatesArray(path, sourceSystem, targetSystem)
    );
  }
  
  // Transform point coordinates
  if (geometry.x !== undefined && geometry.y !== undefined) {
    const [newX, newY] = transformCoordinate([geometry.x, geometry.y], sourceSystem, targetSystem);
    transformedGeometry.x = newX;
    transformedGeometry.y = newY;
  }
  
  // Transform extent if present
  if (geometry.extent) {
    const { xmin, ymin, xmax, ymax } = geometry.extent;
    const [newXmin, newYmin] = transformCoordinate([xmin, ymin], sourceSystem, targetSystem);
    const [newXmax, newYmax] = transformCoordinate([xmax, ymax], sourceSystem, targetSystem);
    
    transformedGeometry.extent = {
      ...geometry.extent,
      xmin: newXmin,
      ymin: newYmin,
      xmax: newXmax,
      ymax: newYmax,
      spatialReference: { wkid: targetSystem.wkid }
    };
  }
  
  return transformedGeometry;
}

/**
 * Detect coordinate system from geometry object
 */
function detectCoordinateSystemFromGeometry(geometry: any): CoordinateSystem {
  // Check spatial reference if available
  if (geometry.spatialReference?.wkid) {
    if (geometry.spatialReference.wkid === 4326) {
      return COORDINATE_SYSTEMS.WGS84;
    }
    if (geometry.spatialReference.wkid === 3857 || geometry.spatialReference.wkid === 102100) {
      return COORDINATE_SYSTEMS.WEB_MERCATOR;
    }
  }
  
  // Check extent bounds
  if (geometry.extent) {
    return detectCoordinateSystemFromBounds(geometry.extent);
  }
  
  // Check coordinate values
  let testCoords: number[] | undefined;
  
  if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
    // Find the first coordinate pair in nested arrays
    testCoords = findFirstCoordinate(geometry.coordinates);
  } else if (geometry.rings && geometry.rings[0] && geometry.rings[0][0]) {
    testCoords = geometry.rings[0][0];
  } else if (geometry.paths && geometry.paths[0] && geometry.paths[0][0]) {
    testCoords = geometry.paths[0][0];
  } else if (geometry.x !== undefined && geometry.y !== undefined) {
    testCoords = [geometry.x, geometry.y];
  }
  
  if (testCoords && testCoords.length >= 2) {
    return detectCoordinateSystem(testCoords);
  }
  
  // Default to WGS84 if can't determine
  console.warn('[CoordinateTransform] Could not detect coordinate system, defaulting to WGS84');
  return COORDINATE_SYSTEMS.WGS84;
}

/**
 * Find the first coordinate pair in a nested array structure
 */
function findFirstCoordinate(coordinates: any): number[] | undefined {
  if (!Array.isArray(coordinates)) return undefined;
  
  // If this is a coordinate pair [x, y]
  if (coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return coordinates;
  }
  
  // If this is a nested array, recurse
  if (Array.isArray(coordinates[0])) {
    return findFirstCoordinate(coordinates[0]);
  }
  
  return undefined;
}

/**
 * Transform a coordinates array recursively
 */
function transformCoordinatesArray(coordinates: any, sourceSystem: CoordinateSystem, targetSystem: CoordinateSystem): any {
  if (!Array.isArray(coordinates)) return coordinates;
  
  // If this is a coordinate pair [x, y]
  if (coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return transformCoordinate(coordinates, sourceSystem, targetSystem);
  }
  
  // If this is a nested array, recurse
  return coordinates.map((item: any) => transformCoordinatesArray(item, sourceSystem, targetSystem));
}

/**
 * Transform a single coordinate pair
 */
function transformCoordinate(coordinate: number[], sourceSystem: CoordinateSystem, targetSystem: CoordinateSystem): number[] {
  const [x, y] = coordinate;
  
  if (sourceSystem.wkid === COORDINATE_SYSTEMS.WEB_MERCATOR.wkid && 
      targetSystem.wkid === COORDINATE_SYSTEMS.WGS84.wkid) {
    return webMercatorToWGS84(x, y);
  }
  
  if (sourceSystem.wkid === COORDINATE_SYSTEMS.WGS84.wkid && 
      targetSystem.wkid === COORDINATE_SYSTEMS.WEB_MERCATOR.wkid) {
    return wgs84ToWebMercator(x, y);
  }
  
  // No transformation needed or unsupported transformation
  return [x, y];
}

/**
 * Create bounds in WGS84 from any coordinate system
 */
export function createWGS84Bounds(geometry: any): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const wgs84Geometry = transformGeometry(geometry, COORDINATE_SYSTEMS.WGS84);
  
  let coordinates: number[][] = [];
  
  // Extract all coordinates from the geometry
  if (wgs84Geometry.coordinates) {
    coordinates = extractAllCoordinates(wgs84Geometry.coordinates);
  } else if (wgs84Geometry.rings) {
    coordinates = wgs84Geometry.rings.flat();
  } else if (wgs84Geometry.paths) {
    coordinates = wgs84Geometry.paths.flat();
  } else if (wgs84Geometry.x !== undefined && wgs84Geometry.y !== undefined) {
    coordinates = [[wgs84Geometry.x, wgs84Geometry.y]];
  }
  
  if (coordinates.length === 0) {
    console.warn('[CoordinateTransform] No coordinates found in geometry, using default bounds');
    return { minX: -180, maxX: 180, minY: -90, maxY: 90 };
  }
  
  const longitudes = coordinates.map(coord => coord[0]);
  const latitudes = coordinates.map(coord => coord[1]);
  
  return {
    minX: Math.min(...longitudes),
    maxX: Math.max(...longitudes),
    minY: Math.min(...latitudes),
    maxY: Math.max(...latitudes)
  };
}

/**
 * Extract all coordinate pairs from nested coordinate structure
 */
function extractAllCoordinates(coordinates: any): number[][] {
  if (!Array.isArray(coordinates)) return [];
  
  const result: number[][] = [];
  
  function extract(item: any) {
    if (!Array.isArray(item)) return;
    
    // If this is a coordinate pair [x, y]
    if (item.length >= 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
      result.push([item[0], item[1]]);
    } else {
      // Recurse into nested arrays
      item.forEach(extract);
    }
  }
  
  extract(coordinates);
  return result;
}