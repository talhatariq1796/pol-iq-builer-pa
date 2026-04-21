/**
 * BHHS Brand Constants - Single Source of Truth
 * Berkshire Hathaway HomeServices Official Branding Guidelines
 *
 * OFFICIAL BRAND COLORS:
 * - Primary Blue: #00AEFF (cyan blue)
 * - Dark Blue: #004274
 * - White: #FFFFFF
 * - Black: #000000
 */

export const BHHSBrandColors = {
  // Official Primary Colors
  primaryBlue: '#00AEFF',     // Cyan blue (main brand color)
  darkBlue: '#004274',        // Dark blue (secondary brand color)
  white: '#FFFFFF',
  black: '#000000',

  // Derived Colors for UI
  primaryBlueLight: '#33BBFF', // Lighter shade for hover states
  primaryBlueDark: '#0099DD',  // Darker shade for pressed states
  darkBlueLight: '#005A9E',    // Lighter dark blue

  // Background Variations
  primaryBlueAlpha10: 'rgba(0, 174, 255, 0.1)',
  primaryBlueAlpha20: 'rgba(0, 174, 255, 0.2)',
  primaryBlueAlpha30: 'rgba(0, 174, 255, 0.3)',
  darkBlueAlpha10: 'rgba(0, 66, 116, 0.1)',
  darkBlueAlpha20: 'rgba(0, 66, 116, 0.2)',

  // RGB Values for PDF Generation
  rgb: {
    primaryBlue: { r: 0, g: 174, b: 255 },
    darkBlue: { r: 0, g: 66, b: 116 },
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
  },

  // Status Colors (using BHHS blue tones)
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#00AEFF',
} as const;

export const BHHSTypography = {
  // Font Families
  primary: 'Montserrat',
  secondary: 'system-ui',
  fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

  // Font Sizes
  fontSize: {
    xs: 10,
    sm: 11,
    base: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    h6: 14,
    h5: 16,
    h4: 18,
    h3: 20,
    h2: 24,
    h1: 28,
    display: 32,
  },

  // Font Weights
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
} as const;

export const BHHSSpacing = {
  // Base spacing units
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,

  // Page layout
  pageMargin: 20,
  contentPadding: 16,
  cardPadding: 20,
  sectionGap: 24,
} as const;

export const BHHSLayout = {
  // Page dimensions (for PDF)
  page: {
    margin: 20,
    headerHeight: 40,
    footerHeight: 30,
    contentWidth: 170, // A4 width minus margins
  },

  // Border radius
  borderRadius: {
    sm: 3,
    md: 6,
    lg: 8,
    xl: 12,
    full: 9999,
  },

  // Shadows
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
} as const;

export const BHHSGradients = {
  // Brand gradients using official colors
  primary: `linear-gradient(to right, ${BHHSBrandColors.primaryBlue}, ${BHHSBrandColors.darkBlue})`,
  primaryVertical: `linear-gradient(to bottom, ${BHHSBrandColors.primaryBlue}, ${BHHSBrandColors.darkBlue})`,
  primaryLight: `linear-gradient(to right, ${BHHSBrandColors.primaryBlueLight}, ${BHHSBrandColors.primaryBlue})`,

  // CSS class compatible
  cssClasses: {
    primary: 'from-[#00AEFF] to-[#004274]',
    primaryLight: 'from-[#33BBFF] to-[#00AEFF]',
    darkToLight: 'from-[#004274] to-[#00AEFF]',
  },
} as const;

// Helper functions for color manipulation
export const BHHSColorHelpers = {
  /**
   * Convert hex color to RGB object
   */
  hexToRgb: (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  },

  /**
   * Add alpha to hex color
   */
  hexWithAlpha: (hex: string, alpha: number): string => {
    const rgb = BHHSColorHelpers.hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  },
};

// Export default object for convenience
export const BHHSBranding = {
  colors: BHHSBrandColors,
  typography: BHHSTypography,
  spacing: BHHSSpacing,
  layout: BHHSLayout,
  gradients: BHHSGradients,
  helpers: BHHSColorHelpers,
} as const;

export default BHHSBranding;
