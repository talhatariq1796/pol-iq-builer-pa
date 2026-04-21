/**
 * GeoJSON Utilities
 *
 * Utilities for converting GeoJSON to ArcGIS Graphics with MPIQ Green styling.
 */

import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';

// MPIQ Green color scheme
const MPIQ_GREEN = '#33a852';
const MPIQ_GREEN_RGB = [51, 168, 82];

/**
 * Convert GeoJSON FeatureCollection to ArcGIS Graphics
 */
export function geojsonToGraphics(
  featureCollection: GeoJSON.FeatureCollection
): __esri.Graphic[] {
  const graphics: __esri.Graphic[] = [];

  for (const feature of featureCollection.features) {
    const graphic = featureToGraphic(feature);
    if (graphic) {
      graphics.push(graphic);
    }
  }

  return graphics;
}

/**
 * Convert a single GeoJSON Feature to an ArcGIS Graphic
 */
function featureToGraphic(feature: GeoJSON.Feature): __esri.Graphic | null {
  if (!feature.geometry) {
    return null;
  }

  const geometry = convertGeometry(feature.geometry);
  if (!geometry) {
    return null;
  }

  const symbol = getSymbolForGeometry(feature.geometry) as any;
  const attributes = feature.properties || {};

  return new Graphic({
    geometry,
    symbol,
    attributes,
  });
}

/**
 * Convert GeoJSON Geometry to ArcGIS Geometry
 */
function convertGeometry(
  geojson: GeoJSON.Geometry
): __esri.Geometry | null {
  switch (geojson.type) {
    case 'Point':
      return convertPoint(geojson);

    case 'MultiPoint':
      // Convert to first point (could also create multiple graphics)
      if (geojson.coordinates.length > 0) {
        return new Point({
          longitude: geojson.coordinates[0][0],
          latitude: geojson.coordinates[0][1],
          spatialReference: { wkid: 4326 },
        });
      }
      return null;

    case 'LineString':
      return convertLineString(geojson);

    case 'MultiLineString':
      return convertMultiLineString(geojson);

    case 'Polygon':
      return convertPolygon(geojson);

    case 'MultiPolygon':
      return convertMultiPolygon(geojson);

    case 'GeometryCollection':
      // Handle first geometry in collection
      if (geojson.geometries.length > 0) {
        return convertGeometry(geojson.geometries[0]);
      }
      return null;

    default:
      console.warn('[geojsonUtils] Unsupported geometry type:', (geojson as any).type);
      return null;
  }
}

/**
 * Convert GeoJSON Point to ArcGIS Point
 */
function convertPoint(geojson: GeoJSON.Point): __esri.Point {
  return new Point({
    longitude: geojson.coordinates[0],
    latitude: geojson.coordinates[1],
    spatialReference: { wkid: 4326 },
  });
}

/**
 * Convert GeoJSON LineString to ArcGIS Polyline
 */
function convertLineString(geojson: GeoJSON.LineString): __esri.Polyline {
  return new Polyline({
    paths: [geojson.coordinates],
    spatialReference: { wkid: 4326 },
  });
}

/**
 * Convert GeoJSON MultiLineString to ArcGIS Polyline
 */
function convertMultiLineString(
  geojson: GeoJSON.MultiLineString
): __esri.Polyline {
  return new Polyline({
    paths: geojson.coordinates,
    spatialReference: { wkid: 4326 },
  });
}

/**
 * Convert GeoJSON Polygon to ArcGIS Polygon
 */
function convertPolygon(geojson: GeoJSON.Polygon): __esri.Polygon {
  return new Polygon({
    rings: geojson.coordinates,
    spatialReference: { wkid: 4326 },
  });
}

/**
 * Convert GeoJSON MultiPolygon to ArcGIS Polygon
 */
function convertMultiPolygon(geojson: GeoJSON.MultiPolygon): __esri.Polygon {
  // Flatten all rings from all polygons
  const allRings = geojson.coordinates.flat();
  return new Polygon({
    rings: allRings,
    spatialReference: { wkid: 4326 },
  });
}

/**
 * Get appropriate symbol for geometry type (MPIQ Green styling)
 */
function getSymbolForGeometry(geojson: GeoJSON.Geometry): __esri.Symbol {
  switch (geojson.type) {
    case 'Point':
    case 'MultiPoint':
      return new SimpleMarkerSymbol({
        color: MPIQ_GREEN_RGB.concat([255]) as [number, number, number, number],
        size: 8,
        outline: {
          color: [255, 255, 255, 255],
          width: 1,
        },
      });

    case 'LineString':
    case 'MultiLineString':
      return new SimpleLineSymbol({
        color: MPIQ_GREEN_RGB.concat([255]) as [number, number, number, number],
        width: 2,
      });

    case 'Polygon':
    case 'MultiPolygon':
      return new SimpleFillSymbol({
        color: MPIQ_GREEN_RGB.concat([51]) as [number, number, number, number], // 20% opacity (51/255)
        outline: {
          color: MPIQ_GREEN_RGB.concat([255]) as [number, number, number, number],
          width: 2,
        },
      });

    default:
      // Default to point symbol
      return new SimpleMarkerSymbol({
        color: MPIQ_GREEN_RGB.concat([255]) as [number, number, number, number],
        size: 8,
      });
  }
}
