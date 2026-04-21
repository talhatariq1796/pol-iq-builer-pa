/**
 * File Parser Utilities
 *
 * Utilities for parsing geographic data files (GeoJSON, CSV, Shapefile)
 * and converting them to GeoJSON FeatureCollections.
 */

import Papa from 'papaparse';
import shp from 'shpjs';

/**
 * Parse a GeoJSON file
 */
export async function parseGeoJSON(file: File): Promise<GeoJSON.FeatureCollection> {
  const text = await file.text();
  const parsedData = JSON.parse(text);

  // Normalize to FeatureCollection
  let featureCollection: GeoJSON.FeatureCollection;

  if (parsedData.type === 'FeatureCollection') {
    featureCollection = parsedData as GeoJSON.FeatureCollection;
  } else if (parsedData.type === 'Feature') {
    // Single feature - wrap in FeatureCollection
    featureCollection = {
      type: 'FeatureCollection',
      features: [parsedData as GeoJSON.Feature],
    };
  } else if (
    parsedData.type === 'Point' ||
    parsedData.type === 'LineString' ||
    parsedData.type === 'Polygon' ||
    parsedData.type === 'MultiPoint' ||
    parsedData.type === 'MultiLineString' ||
    parsedData.type === 'MultiPolygon' ||
    parsedData.type === 'GeometryCollection'
  ) {
    // Geometry only - wrap in Feature and FeatureCollection
    featureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: parsedData as GeoJSON.Geometry,
        },
      ],
    };
  } else {
    throw new Error('File is not valid GeoJSON');
  }

  // Validate that we have features
  if (!featureCollection.features || featureCollection.features.length === 0) {
    throw new Error('File contains no features');
  }

  return featureCollection;
}

/**
 * Parse a CSV file with coordinate columns
 * Auto-detects lat/lon columns by common names
 */
export async function parseCSV(file: File): Promise<GeoJSON.FeatureCollection> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          // Find lat/lon columns (case-insensitive)
          const headers = results.meta.fields || [];
          const latCol = headers.find(h =>
            ['lat', 'latitude', 'y'].includes(h.toLowerCase())
          );
          const lonCol = headers.find(h =>
            ['lon', 'lng', 'longitude', 'x'].includes(h.toLowerCase())
          );

          if (!latCol || !lonCol) {
            reject(
              new Error(
                'Could not find latitude/longitude columns. Expected columns named: lat/latitude/y and lon/lng/longitude/x'
              )
            );
            return;
          }

          // Convert rows to GeoJSON features
          const features: GeoJSON.Feature[] = [];
          for (const row of results.data as any[]) {
            const lat = parseFloat(row[latCol]);
            const lon = parseFloat(row[lonCol]);

            // Skip rows with invalid coordinates
            if (isNaN(lat) || isNaN(lon)) {
              continue;
            }

            // Validate coordinate ranges
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
              console.warn('Invalid coordinates found:', { lat, lon });
              continue;
            }

            features.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [lon, lat],
              },
              properties: { ...row },
            });
          }

          if (features.length === 0) {
            reject(new Error('No valid coordinate data found in CSV'));
            return;
          }

          resolve({
            type: 'FeatureCollection',
            features,
          });
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

/**
 * Parse a Shapefile (ZIP archive containing .shp, .dbf, .shx, etc.)
 */
export async function parseShapefile(file: File): Promise<GeoJSON.FeatureCollection> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const geojson = await shp(arrayBuffer);

    // shpjs can return array of FeatureCollections or a single one
    if (Array.isArray(geojson)) {
      // Merge all features from multiple FeatureCollections
      const allFeatures = geojson.flatMap(fc => {
        if (fc.type === 'FeatureCollection') {
          return fc.features;
        }
        return [];
      });

      if (allFeatures.length === 0) {
        throw new Error('Shapefile contains no features');
      }

      return {
        type: 'FeatureCollection',
        features: allFeatures,
      };
    }

    // Single FeatureCollection
    if (geojson.type === 'FeatureCollection') {
      if (!geojson.features || geojson.features.length === 0) {
        throw new Error('Shapefile contains no features');
      }
      return geojson;
    }

    throw new Error('Invalid Shapefile format');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Shapefile parsing error: ${error.message}`);
    }
    throw new Error('Failed to parse Shapefile');
  }
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSizeMB: number): void {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File exceeds ${maxSizeMB}MB limit`);
  }
}

/**
 * Validate feature count
 */
export function validateFeatureCount(
  featureCollection: GeoJSON.FeatureCollection,
  maxFeatures: number = 50000
): void {
  if (featureCollection.features.length > maxFeatures) {
    throw new Error(
      `File contains too many features (${featureCollection.features.length}). Maximum is ${maxFeatures}.`
    );
  }
}

/**
 * Get file type from extension
 */
export function getFileType(filename: string): 'geojson' | 'csv' | 'shapefile' | 'unknown' {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'geojson':
    case 'json':
      return 'geojson';
    case 'csv':
      return 'csv';
    case 'zip':
      return 'shapefile';
    default:
      return 'unknown';
  }
}
