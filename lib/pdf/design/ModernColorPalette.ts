/**
 * BHHS Modern Color Palette
 * Based on modern infographic design specification
 *
 * Design Principles (from reference):
 * - Light grey backgrounds (#F7F8FA, #EBEBEB) for visual calm
 * - PRIMARY COLOR used sparingly (small accents, borders, NOT solid fills)
 * - Clean borders and subtle gradients instead of solid fills
 * - Relative colors derived from primary (lighter tints, darker shades)
 * - Generous white space with subtle shadows
 *
 * Color Strategy:
 * - Reference uses light blue as primary → we use BHHS burgundy #670338
 * - Reference uses tints of blue → we use tints of burgundy
 * - Same LAYOUT principles, different COLOR values
 */

export const ModernColorPalette = {
  // Updated Brand Colors
  primary: '#670338',      // Deep Burgundy (primary brand color)
  secondary: '#DDD70F',    // Bright Yellow (vibrant accent)
  tertiary: '#0BB95F',     // Fresh Green (success/positive indicator)
  quaternary: '#999AFC',   // Soft Purple (info/highlight)
  neutral: '#EAE9E9',      // Light Grey (backgrounds and subtle elements)

  // Primary Color Tints (derived from burgundy)
  primaryTints: {
    lightest: '#F5E6EE',   // 95% lighter - very subtle backgrounds
    lighter: '#8B1538',    // Regular burgundy - subtle accents, chart fills
    light: '#D1A0C7',      // 60% lighter - borders, hover states
    medium: '#A8668A',     // 40% lighter - medium accents
    base: '#670338',       // Base burgundy - small accents only, strong emphasis
    dark: '#4D0229',       // 20% darker - emphasis, text on light backgrounds
    darkest: '#33011B',    // 40% darker - strong contrast, headers
  },

  // Background Colors (PRIMARY USAGE - like reference: flat, no depth)
  background: {
    page: '#FAFAFA',       // Page background (flat light grey - matches reference)
    card: '#FFFFFF',       // Card/panel backgrounds (pure white - no shadows)
    subtle: '#EAE9E9',     // Subtle section backgrounds (neutral grey)
    accent: '#F7F8FA',     // Accent backgrounds (slight grey tint)
    dark: '#1A1A1A',       // Dark backgrounds (rare use)
    burgundyLight: '#F5E6EE', // Light burgundy background for branded sections
    yellowLight: '#FFFCE5', // Light yellow background for highlights
    greenLight: '#E8F9F0',  // Light green background for success states
    purpleLight: '#F3F3FE', // Light purple background for info sections
  },

  // Text Colors (simplified per Phase 3)
  text: {
    dark: '#333333',       // Headings (softer than pure black)
    body: '#666666',       // Body text (lighter for better readability)
    light: '#999999',      // Secondary text
    subtle: '#BBBBBB',     // Tertiary/subtle text (lighter)
    white: '#FFFFFF',      // Text on dark backgrounds
  },

  // Accent Colors (for indicators and trends)
  accent: {
    success: '#0BB95F',    // Positive indicators (fresh green)
    warning: '#DDD70F',    // Neutral/attention (bright yellow)
    error: '#C44E52',      // Negative indicators (red)
    info: '#999AFC',       // Information/highlights (soft purple)
  },

  // Chart Colors (vibrant multi-color palette for better data differentiation)
  chart: {
    primary: '#670338',    // Primary data series (deep burgundy)
    secondary: '#DDD70F',  // Secondary data series (bright yellow)
    tertiary: '#0BB95F',   // Tertiary data series (fresh green)
    quaternary: '#999AFC', // Fourth series (soft purple)
    accent: '#EAE9E9',     // Accent/neutral (light grey)
    background: '#FAFAFA', // Chart background fills (very light grey)
    grid: '#EAE9E9',       // Grid lines (neutral grey)
    axis: '#666666',       // Axis labels (medium grey for better readability)
  },

  // Gradient Definitions (like reference - subtle, using primary tints)
  gradients: {
    // Background gradients (grey to white - matches reference)
    subtle: {
      start: '#F7F8FA',    // Light grey
      end: '#FFFFFF',      // White
    },
    lightAccent: {
      start: '#EBEBEB',    // Subtle grey
      end: '#FFFFFF',      // White
    },
    // Primary gradients (burgundy tints - like reference uses blue tints)
    primary: {
      start: '#D1A0C7',    // Light burgundy tint
      end: 'rgba(209, 160, 199, 0.1)',  // To transparent
    },
    primarySubtle: {
      start: '#F5E6EE',    // Lightest burgundy tint
      end: '#FFFFFF',      // White
    },
    // Secondary gradient (gold)
    secondary: {
      start: '#C8A882',    // Gold
      end: 'rgba(200, 168, 130, 0.1)',
    },
    // Status indicator gradients
    success: {
      start: '#5AA454',
      end: 'rgba(90, 164, 84, 0.1)',
    },
    warning: {
      start: '#F7A800',
      end: 'rgba(247, 168, 0, 0.1)',
    },
    error: {
      start: '#C44E52',
      end: 'rgba(196, 78, 82, 0.1)',
    },
  },

  // Overlay Colors
  overlay: {
    dark: 'rgba(0, 0, 0, 0.5)',
    light: 'rgba(255, 255, 255, 0.95)',
    subtle: 'rgba(247, 248, 250, 0.9)',
    burgundy: 'rgba(209, 160, 199, 0.1)',  // Light burgundy overlay
  },

  // Border Colors (like reference - subtle, with vibrant accents)
  border: {
    subtle: '#EAE9E9',     // Very light borders (neutral grey)
    light: '#CCCCCC',      // Light borders
    medium: '#999999',     // Medium borders
    dark: '#808080',       // Dark borders
    primary: '#670338',    // Deep burgundy for strong accents
    yellow: '#DDD70F',     // Yellow accent borders
    green: '#0BB95F',      // Green accent borders
    purple: '#999AFC',     // Purple accent borders
  },

  // Shadow Colors (SUBTLE)
  shadow: {
    subtle: 'rgba(0, 0, 0, 0.05)',   // Very light shadow
    light: 'rgba(0, 0, 0, 0.08)',    // Light shadow
    medium: 'rgba(0, 0, 0, 0.12)',   // Medium shadow
    strong: 'rgba(0, 0, 0, 0.15)',   // Stronger shadow (rare use)
  },

  // AI Section Colors (using lightest primary tints - like reference)
  ai: {
    background: '#F5E6EE',   // Lightest burgundy tint
    text: '#670338',         // Base burgundy
    border: '#D1A0C7',       // Light burgundy tint
    accent: '#8B1538',       // Regular burgundy
  },

  // Status Indicators
  status: {
    active: '#D1A0C7',       // Light burgundy tint for active
    pending: '#999999',      // Grey for pending
    complete: '#5AA454',     // Green for complete
    attention: '#F7A800',    // Amber for attention
  },
} as const;

/**
 * Helper function to create linear gradients for PDF rendering
 */
export function createLinearGradient(
  gradient: { start: string; end: string },
  direction: 'horizontal' | 'vertical' | 'diagonal' = 'horizontal'
): { type: 'linear'; colors: string[]; direction: string } {
  return {
    type: 'linear',
    colors: [gradient.start, gradient.end],
    direction,
  };
}

/**
 * Helper function to create radial gradients for PDF rendering
 */
export function createRadialGradient(
  gradient: { start: string; end: string },
  centerX: number,
  centerY: number,
  radius: number
): { type: 'radial'; colors: string[]; center: [number, number]; radius: number } {
  return {
    type: 'radial',
    colors: [gradient.start, gradient.end],
    center: [centerX, centerY],
    radius,
  };
}

/**
 * Get conditional color based on value trend
 */
export function getTrendColor(value: number, threshold = 0): string {
  if (value > threshold) {
    return ModernColorPalette.accent.success; // Green for positive
  } else if (value < -threshold) {
    return ModernColorPalette.accent.error; // Red for negative
  } else {
    return ModernColorPalette.accent.warning; // Amber for neutral
  }
}

/**
 * Get color based on performance score (0-100)
 */
export function getScoreColor(score: number): string {
  if (score >= 75) {
    return ModernColorPalette.accent.success;
  } else if (score >= 50) {
    return ModernColorPalette.accent.warning;
  } else {
    return ModernColorPalette.accent.error;
  }
}

/**
 * Get color with opacity
 */
export function withOpacity(color: string, opacity: number): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

/**
 * Convert hex color to RGB array for jsPDF
 * @param hex - Hex color string (e.g., '#670338' or '670338'), rgba string, or 'transparent'
 * @returns RGB array [r, g, b] where each value is 0-255, or null for transparent colors
 */
export function hexToRgb(hex: string): [number, number, number] | null {
  // Handle transparent keyword - return null to signal "don't render"
  if (hex === 'transparent' || hex === 'none') {
    return null;
  }

  // Handle rgba() format with transparency check
  if (hex.startsWith('rgba(') || hex.startsWith('rgb(')) {
    const match = hex.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/);
    if (match) {
      // Check alpha channel - if 0, treat as transparent
      const alpha = match[4] ? parseFloat(match[4]) : 1;
      if (alpha === 0) {
        return null;
      }
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }
  }

  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Support 8-digit hex (RGBA format: #RRGGBBAA)
  if (/^[0-9A-Fa-f]{8}$/.test(cleanHex)) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    const a = parseInt(cleanHex.slice(6, 8), 16) / 255; // Convert alpha to 0-1 range

    // If alpha is 0, treat as transparent
    if (a === 0) {
      return null;
    }

    // Note: jsPDF doesn't support alpha well, so we just use RGB
    return [r, g, b];
  }

  // Validate 6-digit hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    console.warn(`[hexToRgb] Invalid hex color: ${hex}, using fallback subtle grey`);
    // Return subtle grey instead of black for better fallback appearance
    return [235, 235, 235]; // #EBEBEB
  }

  // Parse hex values
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  return [r, g, b];
}

export type ColorPalette = typeof ModernColorPalette;
