/**
 * Address Resolution Utility
 *
 * Implements 4-source priority logic for CMA PDF cover page address display:
 * 1. Selected property address (from property popup)
 * 2. Search input address (from search bar)
 * 3. Server-side geocoded address (from /api/cma-pdf route)
 * 4. Client-side reverse geocoded address (from map click - async only)
 * 5. Fallback: coordinates or "Location not specified"
 */

import * as locator from '@arcgis/core/rest/locator';
import Point from '@arcgis/core/geometry/Point';

export interface AddressContext {
  selectedProperty?: __esri.Graphic;
  searchAddress?: string;
  clickCoordinates?: { lat: number; lng: number };
  geocodedAddress?: string; // Server-side reverse geocoded address
}

export interface ResolvedAddress {
  address: string;
  isEstimated: boolean;
  source: 'property' | 'search' | 'geocoded' | 'coordinates' | 'unknown';
}

/**
 * Resolve display address using 3-source priority logic
 *
 * @param context - Context containing property, search, and coordinate data
 * @returns Resolved address with estimation indicator
 */
export async function getDisplayAddress(
  context: AddressContext
): Promise<ResolvedAddress> {
  // Priority 1: Selected property address
  if (context.selectedProperty?.attributes?.address) {
    const address = context.selectedProperty.attributes.address as string;
    console.log('[AddressResolver] Using property address:', address);
    return {
      address,
      isEstimated: false,
      source: 'property'
    };
  }

  // Priority 2: Search input address
  if (context.searchAddress && context.searchAddress.trim()) {
    console.log('[AddressResolver] Using search address:', context.searchAddress);
    return {
      address: context.searchAddress.trim(),
      isEstimated: false,
      source: 'search'
    };
  }

  // Priority 3: Reverse geocode from click coordinates
  if (context.clickCoordinates) {
    console.log('[AddressResolver] Attempting reverse geocode for coordinates:', context.clickCoordinates);
    try {
      const url = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      const location = new Point({
        latitude: context.clickCoordinates.lat,
        longitude: context.clickCoordinates.lng
      });

      const result = await locator.locationToAddress(url, { location });

      if (result?.address) {
        const address = `Near ${result.address}`;
        console.log('[AddressResolver] Reverse geocode successful:', address);
        return {
          address,
          isEstimated: true,
          source: 'geocoded'
        };
      }
    } catch (error) {
      console.warn('[AddressResolver] Reverse geocode failed:', error);
      // Fall through to coordinates fallback
    }

    // Fallback to coordinates if geocoding fails
    const coordsDisplay = `Location: ${context.clickCoordinates.lat.toFixed(4)}, ${context.clickCoordinates.lng.toFixed(4)}`;
    console.log('[AddressResolver] Using coordinates fallback:', coordsDisplay);
    return {
      address: coordsDisplay,
      isEstimated: true,
      source: 'coordinates'
    };
  }

  // Final fallback: no location specified
  console.warn('[AddressResolver] No address sources available, using fallback');
  return {
    address: 'Location not specified',
    isEstimated: true,
    source: 'unknown'
  };
}

/**
 * Get display address synchronously (for cases where async isn't possible)
 * Now includes server-provided geocoded address as priority 3
 *
 * @param context - Context containing property, search, and geocoded address data
 * @returns Resolved address with estimation indicator
 */
export function getDisplayAddressSync(
  context: AddressContext
): ResolvedAddress {
  // Priority 1: Selected property address
  if (context.selectedProperty?.attributes?.address) {
    const address = context.selectedProperty.attributes.address as string;
    return {
      address,
      isEstimated: false,
      source: 'property'
    };
  }

  // Priority 2: Search input address
  if (context.searchAddress && context.searchAddress.trim()) {
    return {
      address: context.searchAddress.trim(),
      isEstimated: false,
      source: 'search'
    };
  }

  // Priority 3: Server-side geocoded address (from /api/cma-pdf route)
  if (context.geocodedAddress && context.geocodedAddress.trim()) {
    return {
      address: `Near ${context.geocodedAddress.trim()}`,
      isEstimated: true,
      source: 'geocoded'
    };
  }

  // Priority 4: Click coordinates (display as fallback)
  if (context.clickCoordinates) {
    const coordsDisplay = `Location: ${context.clickCoordinates.lat.toFixed(4)}, ${context.clickCoordinates.lng.toFixed(4)}`;
    return {
      address: coordsDisplay,
      isEstimated: true,
      source: 'coordinates'
    };
  }

  // Fallback
  return {
    address: 'Location not specified',
    isEstimated: true,
    source: 'unknown'
  };
}

/**
 * Format address for PDF display with estimation indicator
 * Returns address without newlines - the "(Estimated location)" note
 * is handled separately by the PDF template system
 *
 * @param resolved - Resolved address object
 * @returns Formatted string for PDF display (single line, may be long)
 */
export function formatAddressForPDF(resolved: ResolvedAddress): string {
  // Don't add newlines - PDF template handles multi-line display
  // The estimation note is shown via isAddressEstimated flag in Page1Data
  return resolved.address;
}

/**
 * Get estimation suffix for PDF display (separate from address)
 * Used by PDF template to show "(Estimated location)" on a separate line
 *
 * @param resolved - Resolved address object
 * @returns Estimation note string or empty string
 */
export function getEstimationNote(resolved: ResolvedAddress): string {
  return resolved.isEstimated ? '(Estimated location)' : '';
}
