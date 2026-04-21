/**
 * Color Utility Functions for PDF Generation
 *
 * Centralized color manipulation utilities used across all PDF generators.
 * Eliminates duplication of hexToRgb and related functions.
 *
 * @version 1.0.0
 */

/**
 * RGB color tuple type
 */
export type RGBTuple = [number, number, number];

/**
 * RGB color object type
 */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Convert hex color to RGB tuple [r, g, b]
 * @param hex Hex color string (with or without #)
 * @returns RGB tuple [r, g, b], defaults to [0, 0, 0] if invalid
 */
export function hexToRgb(hex: string): RGBTuple {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

/**
 * Convert hex color to RGB object { r, g, b }
 * @param hex Hex color string (with or without #)
 * @returns RGB object, defaults to { r: 0, g: 0, b: 0 } if invalid
 */
export function hexToRGB(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB values to hex string
 * @param r Red value (0-255)
 * @param g Green value (0-255)
 * @param b Blue value (0-255)
 * @returns Hex color string with # prefix
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Darken a hex color by a percentage
 * @param hex Hex color string
 * @param percent Percentage to darken (0-100)
 * @returns Darkened hex color string
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRGB(hex);
  const factor = 1 - percent / 100;
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);
  return rgbToHex(r, g, b);
}

/**
 * Lighten a hex color by a percentage
 * @param hex Hex color string
 * @param percent Percentage to lighten (0-100)
 * @returns Lightened hex color string
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRGB(hex);
  const factor = percent / 100;
  const r = Math.round(rgb.r + (255 - rgb.r) * factor);
  const g = Math.round(rgb.g + (255 - rgb.g) * factor);
  const b = Math.round(rgb.b + (255 - rgb.b) * factor);
  return rgbToHex(r, g, b);
}

/**
 * Check if a color is "dark" (for determining text contrast)
 * @param hex Hex color string
 * @returns true if the color is dark
 */
export function isColorDark(hex: string): boolean {
  const rgb = hexToRGB(hex);
  // Using relative luminance formula
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.5;
}

/**
 * Get contrasting text color (white or black) for a given background
 * @param bgHex Background hex color
 * @returns '#FFFFFF' for dark backgrounds, '#000000' for light backgrounds
 */
export function getContrastingTextColor(bgHex: string): string {
  return isColorDark(bgHex) ? '#FFFFFF' : '#000000';
}
