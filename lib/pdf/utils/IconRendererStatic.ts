/**
 * Static Icon Renderer
 * Loads pre-converted PNG icons from embedded base64 data
 *
 * This replaces filesystem access with embedded base64 data for
 * Vercel serverless compatibility.
 */

import type jsPDF from 'jspdf';
import { ICON_BASE64_LIBRARY, getAvailableIconNames } from '../assets/icons-base64';

/**
 * Load pre-converted PNG icon from embedded base64
 * @param iconName - Name of the icon (e.g., 'house', 'barChart')
 * @param size - Size in pixels (32, 48, 64, 96, 128)
 * @returns PNG data URI
 */
export function loadPngIcon(iconName: string, size: number = 96): string {
  const sizeKey = String(size) as '32' | '48' | '64' | '96' | '128';

  const iconData = ICON_BASE64_LIBRARY[iconName];
  if (!iconData) {
    throw new Error(`Icon '${iconName}' not found in library`);
  }

  const dataUri = iconData[sizeKey];
  if (!dataUri) {
    throw new Error(`Icon '${iconName}' does not have size ${size}px`);
  }

  return dataUri;
}

/**
 * Render icon to PDF
 * @param pdf - jsPDF instance
 * @param iconName - Name of the icon
 * @param x - X coordinate in mm
 * @param y - Y coordinate in mm
 * @param size - Size in mm (will be converted to nearest pixel size)
 */
export function renderIconToPdf(
  pdf: jsPDF,
  iconName: string,
  x: number,
  y: number,
  size: number
): void {
  try {
    // Convert mm to pixels (assuming 96 DPI)
    const mmToPx = 3.78; // 96 DPI / 25.4 mm/inch
    const sizeInPixels = Math.round(size * mmToPx);

    // Find nearest available size
    const availableSizes = [32, 48, 64, 96, 128];
    const nearestSize = availableSizes.reduce((prev, curr) =>
      Math.abs(curr - sizeInPixels) < Math.abs(prev - sizeInPixels) ? curr : prev
    );

    // Load PNG from base64
    const pngDataUri = loadPngIcon(iconName, nearestSize);

    // Add to PDF
    pdf.addImage(pngDataUri, 'PNG', x, y, size, size);
  } catch (error) {
    console.error(`[IconRendererStatic] Failed to render icon ${iconName}:`, error);
    // Render fallback geometric shape
    renderFallbackIcon(pdf, x, y, size);
  }
}

/**
 * Render fallback geometric icon when PNG fails
 */
function renderFallbackIcon(
  pdf: jsPDF,
  x: number,
  y: number,
  size: number
): void {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 3;

  pdf.setFillColor(139, 21, 56); // Burgundy
  pdf.circle(centerX, centerY, radius, 'F');
}

/**
 * Preload icons (no-op for base64 - already embedded)
 * @param iconNames - List of icon names (ignored)
 * @param size - Size to preload (ignored)
 */
export function preloadIcons(iconNames: string[], size: number = 96): void {
  console.log(`[IconRendererStatic] Icons already embedded (${iconNames.length} icons)`);
  // No-op: icons are already in memory as base64
}

/**
 * Get list of available icon names
 */
export function getAvailableIcons(): string[] {
  return getAvailableIconNames();
}

/**
 * Check if icon cache is populated (always true for base64)
 */
export function areIconsPreloaded(): boolean {
  return true;
}

/**
 * Clear icon cache (no-op for base64)
 */
export function clearIconCache(): void {
  // No-op: icons are embedded in code
}
