/**
 * Modern Color Palette for CMA PDF Reports
 * BHHS Burgundy color scheme with brand consistency
 *
 * Primary: BHHS Burgundy (main brand color)
 * Accent Colors: Burgundy tints and variations
 * Semantic Colors: Green (positive), Red (negative), Amber (neutral)
 */

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export class ColorPalette {
  // BHHS Brand - Primary burgundy colors
  static readonly MAROON: RGBColor = { r: 103, g: 3, b: 56 };         // #670338 Base burgundy
  static readonly BURGUNDY: RGBColor = { r: 139, g: 21, b: 56 };      // #8B1538 Regular burgundy

  // Primary Accent Colors - Burgundy variations
  static readonly BURGUNDY_LIGHT: RGBColor = { r: 209, g: 160, b: 199 };   // #D1A0C7 Light burgundy
  static readonly BURGUNDY_MEDIUM: RGBColor = { r: 168, g: 102, b: 138 };  // #A8668A Medium burgundy
  static readonly BURGUNDY_LIGHTER: RGBColor = { r: 245, g: 230, b: 238 }; // #F5E6EE Lightest burgundy
  static readonly GOLD: RGBColor = { r: 200, g: 168, b: 130 };             // #C8A882 BHHS Gold

  // Chart/Data Visualization Colors (burgundy-based palette)
  static readonly CHART_COLORS: RGBColor[] = [
    { r: 209, g: 160, b: 199 },   // Light burgundy (primary)
    { r: 168, g: 102, b: 138 },   // Medium burgundy
    { r: 139, g: 21, b: 56 },     // Regular burgundy
    { r: 200, g: 168, b: 130 },   // Gold
    { r: 103, g: 3, b: 56 },      // Base burgundy
    { r: 77, g: 2, b: 41 },       // Dark burgundy
    { r: 168, g: 102, b: 138 },   // Medium burgundy (repeated for more options)
    { r: 209, g: 160, b: 199 },   // Light burgundy (repeated)
  ];

  // AI Insights - Burgundy gradient
  static readonly AI_PURPLE: RGBColor = { r: 139, g: 21, b: 56 };     // #8B1538 Burgundy
  static readonly AI_LIGHT: RGBColor = { r: 209, g: 160, b: 199 };    // #D1A0C7 Light burgundy

  // Semantic Colors
  static readonly SUCCESS: RGBColor = { r: 46, g: 204, b: 113 };      // #2ECC71 Green
  static readonly WARNING: RGBColor = { r: 243, g: 156, b: 18 };      // #F39C12 Amber
  static readonly DANGER: RGBColor = { r: 231, g: 76, b: 60 };        // #E74C3C Red
  static readonly INFO: RGBColor = { r: 168, g: 102, b: 138 };        // #A8668A Medium burgundy

  // Neutral Grays
  static readonly GRAY_DARK: RGBColor = { r: 52, g: 73, b: 94 };      // #34495E
  static readonly GRAY: RGBColor = { r: 127, g: 140, b: 141 };        // #7F8C8D
  static readonly GRAY_LIGHT: RGBColor = { r: 189, g: 195, b: 199 };  // #BDC3C7
  static readonly GRAY_LIGHTER: RGBColor = { r: 236, g: 240, b: 241 }; // #ECF0F1

  // Text Colors
  static readonly TEXT_PRIMARY: RGBColor = { r: 33, g: 33, b: 33 };   // #212121
  static readonly TEXT_SECONDARY: RGBColor = { r: 97, g: 97, b: 97 }; // #616161
  static readonly TEXT_LIGHT: RGBColor = { r: 158, g: 158, b: 158 };  // #9E9E9E
  static readonly TEXT_WHITE: RGBColor = { r: 255, g: 255, b: 255 };  // #FFFFFF

  // Background Colors
  static readonly BG_WHITE: RGBColor = { r: 255, g: 255, b: 255 };    // #FFFFFF
  static readonly BG_LIGHT: RGBColor = { r: 250, g: 250, b: 250 };    // #FAFAFA
  static readonly BG_GRAY: RGBColor = { r: 245, g: 245, b: 245 };     // #F5F5F5

  /**
   * Get gradient colors for backgrounds (light to dark)
   */
  static getGradient(baseColor: RGBColor, steps: number = 5): RGBColor[] {
    const gradient: RGBColor[] = [];
    for (let i = 0; i < steps; i++) {
      const factor = 1 - (i * 0.15); // Decrease intensity
      gradient.push({
        r: Math.round(baseColor.r * factor + 255 * (1 - factor)),
        g: Math.round(baseColor.g * factor + 255 * (1 - factor)),
        b: Math.round(baseColor.b * factor + 255 * (1 - factor)),
      });
    }
    return gradient;
  }

  /**
   * Get color with opacity (blended with white)
   */
  static withOpacity(color: RGBColor, opacity: number): RGBColor {
    return {
      r: Math.round(color.r * opacity + 255 * (1 - opacity)),
      g: Math.round(color.g * opacity + 255 * (1 - opacity)),
      b: Math.round(color.b * opacity + 255 * (1 - opacity)),
    };
  }

  /**
   * Get data visualization color by index
   */
  static getChartColor(index: number): RGBColor {
    return this.CHART_COLORS[index % this.CHART_COLORS.length];
  }

  /**
   * Get trend color (green for up, red for down)
   */
  static getTrendColor(value: number): RGBColor {
    if (value > 0) return this.SUCCESS;
    if (value < 0) return this.DANGER;
    return this.GRAY;
  }
}
