/**
 * Friendly precinct names mapping
 *
 * Provides human-readable names and local landmarks for precincts
 * to help users relate to geographic locations.
 */

interface PrecinctFriendlyData {
  friendlyName: string;
  landmarks: string[];
}

let friendlyNames: Record<string, PrecinctFriendlyData> | null = null;

/**
 * Load friendly names mapping from JSON file
 * Results are cached after first load
 */
export async function loadFriendlyNames(): Promise<Record<string, PrecinctFriendlyData>> {
  if (friendlyNames) return friendlyNames;

  try {
    const response = await fetch('/data/political/precinct-friendly-names.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    friendlyNames = await response.json();
    return friendlyNames || {};
  } catch (error) {
    console.warn('Could not load friendly precinct names:', error);
    return {};
  }
}

/**
 * Get display name for a precinct, combining official name with friendly name if available
 *
 * @param precinctId - Precinct identifier (e.g., "el-pct-1")
 * @param officialName - Official precinct name (e.g., "East Lansing Precinct 1")
 * @returns Combined display name (e.g., "East Lansing Precinct 1 (MSU North Campus)")
 */
export function getPrecinctDisplayName(precinctId: string, officialName: string): string {
  if (!friendlyNames || !friendlyNames[precinctId]) {
    return officialName;
  }
  return `${officialName} (${friendlyNames[precinctId].friendlyName})`;
}

/**
 * Get friendly name only (without official name)
 *
 * @param precinctId - Precinct identifier
 * @returns Friendly name or empty string if not available
 */
export function getPrecinctFriendlyName(precinctId: string): string {
  if (!friendlyNames || !friendlyNames[precinctId]) {
    return '';
  }
  return friendlyNames[precinctId].friendlyName;
}

/**
 * Get landmarks for a precinct
 *
 * @param precinctId - Precinct identifier
 * @returns Array of landmark names, or empty array if not available
 */
export function getPrecinctLandmarks(precinctId: string): string[] {
  if (!friendlyNames || !friendlyNames[precinctId]) {
    return [];
  }
  return friendlyNames[precinctId].landmarks;
}

/**
 * Get formatted landmarks string for display
 *
 * @param precinctId - Precinct identifier
 * @returns Comma-separated landmarks or empty string
 */
export function getPrecinctLandmarksString(precinctId: string): string {
  const landmarks = getPrecinctLandmarks(precinctId);
  return landmarks.length > 0 ? landmarks.join(', ') : '';
}

/**
 * Check if friendly data exists for a precinct
 *
 * @param precinctId - Precinct identifier
 * @returns True if friendly name and landmarks are available
 */
export function hasFriendlyData(precinctId: string): boolean {
  return friendlyNames !== null && precinctId in friendlyNames;
}

/**
 * Reset cache (useful for testing)
 */
export function resetCache(): void {
  friendlyNames = null;
}
