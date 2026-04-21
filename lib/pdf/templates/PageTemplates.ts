/**
 * Strict Template-Based PDF Layout System
 *
 * Page Dimensions: 210mm × 279.4mm (US Letter)
 * Safe Margins: 15mm all sides
 * Content Area: 180mm × 249.4mm
 * 2-Column Layout: 85mm per column, 10mm gutter
 *
 * Font Specifications:
 * - Font Family: Helvetica
 * - Sizes: 8pt (caption), 9pt (body), 10pt (subhead), 12pt (section), 14pt (heading)
 * - Average Character Width at 9pt: ~0.55mm
 * - Line Height Multiplier: 1.4
 *
 * Character Calculation Formula:
 * - Chars per line = floor(width_mm / char_width_mm)
 * - At 9pt: chars_per_line = floor(width_mm / 0.55)
 * - At 8pt: chars_per_line = floor(width_mm / 0.48)
 * - At 10pt: chars_per_line = floor(width_mm / 0.60)
 *
 * Line Height Calculation:
 * - Line height = font_size_pt × 0.3528 × 1.4 (mm)
 * - At 9pt: 4.44mm per line
 * - At 8pt: 3.95mm per line
 * - At 10pt: 4.94mm per line
 * 
 * @version 2.3.0 - KPI spacing fixes, double footer fix
 * @lastUpdated 2025-10-09
 */

// Template version for cache busting (increment on each change)
export const TEMPLATE_VERSION = '2.3.0';
export const TEMPLATE_LAST_UPDATED = '2025-10-09T20:45:00Z';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ElementTemplate {
  /** X position in mm from left edge */
  x: number;
  /** Y position in mm from top edge */
  y: number;
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
  /** Maximum characters allowed (calculated based on font size and width) */
  maxChars?: number;
  /** Maximum lines allowed (calculated based on height and line height) */
  maxLines?: number;
  /** Font size in points */
  fontSize: number;
  /** Font family name */
  font: string;
  /** Font weight */
  fontWeight?: 'normal' | 'bold';
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Text color in hex */
  color?: string;
}

export interface ChartTemplate {
  /** X position in mm */
  x: number;
  /** Y position in mm */
  y: number;
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
  /** Chart type */
  type: 'bar' | 'line' | 'donut' | 'pie' | 'scatter';
  /** Chart title (optional) */
  title?: string;
  /** Maximum data points to display */
  maxDataPoints?: number;
}

export interface ImageTemplate {
  /** X position in mm */
  x: number;
  /** Y position in mm */
  y: number;
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
  /** Image type/purpose - chart types added for aspect ratio handling */
  type: 'photo' | 'logo' | 'icon' | 'map' | 'chart' | 'line' | 'bar' | 'donut' | 'pie' | 'scatter' | 'gauge';
  /** Aspect ratio constraint */
  aspectRatio?: number;
}

export interface PageTemplate {
  /** Page number (1-7) */
  pageNumber: number;
  /** Page title/description */
  title: string;
  /** Page height in mm (optional, defaults to 279.4) */
  pageHeight?: number;
  /** Text elements with exact positioning */
  elements: {
    [elementId: string]: ElementTemplate;
  };
  /** Chart elements with exact positioning */
  charts?: {
    [chartId: string]: ChartTemplate;
  };
  /** Image elements with exact positioning */
  images?: {
    [imageId: string]: ImageTemplate;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const PAGE_DIMENSIONS = {
  width: 210,      // mm
  height: 279.4,   // mm (US Letter)
} as const;

export const MARGINS = {
  top: 15,         // mm
  right: 15,       // mm
  bottom: 15,      // mm
  left: 15,        // mm
} as const;

export const CONTENT_AREA = {
  width: PAGE_DIMENSIONS.width - MARGINS.left - MARGINS.right,   // 180mm
  height: PAGE_DIMENSIONS.height - MARGINS.top - MARGINS.bottom, // 249.4mm
  x: MARGINS.left,     // 15mm
  y: MARGINS.top,      // 15mm
} as const;

export const COLUMN_LAYOUT = {
  columnWidth: 85,     // mm
  gutter: 10,          // mm
  leftColumn: {
    x: MARGINS.left,                                    // 15mm
    width: 85,                                          // mm
  },
  rightColumn: {
    x: MARGINS.left + 85 + 10,                         // 110mm
    width: 85,                                          // mm
  },
} as const;

export const FONT_SPECS = {
  family: 'Helvetica',
  sizes: {
    caption: 8,      // pt
    body: 9,         // pt
    subhead: 10,     // pt
    section: 12,     // pt
    heading: 14,     // pt
    title: 18,       // pt
  },
  charWidth: {
    // Average character width in mm at each font size
    8: 0.48,
    9: 0.55,
    10: 0.60,
    12: 0.72,
    14: 0.84,
    18: 1.08,
  },
  lineHeight: {
    // Line height in mm at each font size (font_size * 0.3528 * 1.4)
    8: 3.95,
    9: 4.44,
    10: 4.94,
    12: 5.93,
    14: 6.92,
    18: 8.90,
  },
} as const;

export const BRAND_COLORS = {
  primary: '#670338',      // Primary burgundy
  burgundy: '#670338',     // Alias for compatibility  
  dark1: '#8a375e',        // Monochromatic dark shade 1
  dark2: '#77294d',        // Monochromatic dark shade 2
  dark3: '#5d1f3d',        // Monochromatic dark shade 3
  dark4: '#49182d',        // Monochromatic dark shade 4
  gray: '#EAE9E9',         // Light gray
  mediumGray: '#9E9E9E',   // Medium gray
  darkGray: '#484247',     // Dark gray
  lightGray: '#D0D0D0',    // Very light gray
  white: '#FFFFFF',
  accent: '#8a375e',       // Use dark1 as accent
} as const;

// ============================================================================
// CHART SIZING STANDARDS
// ============================================================================

/**
 * Standard chart dimensions based on chart type and layout
 * - Line/Bar charts: Use full column or page width for trend visualization
 * - Donut charts: Proportional width with reasonable height (not forced square)
 */
export const CHART_STANDARDS = {
  // Full-width charts (single column spanning page)
  fullWidth: {
    width: CONTENT_AREA.width,  // 180mm
    heightTall: 100,             // Reduced from 125mm - for detailed line charts (less stretched)
    heightMedium: 80,            // For standard bar/line charts
    heightShort: 60,             // For compact visualizations
  },
  
  // Column-width charts (two-column layout)
  columnWidth: {
    width: COLUMN_LAYOUT.columnWidth,  // 85mm
    heightTall: 100,                    // Reduced from 125mm - for tall line charts (less stretched)
    heightMedium: 70,                   // For standard bar/donut charts
    heightStandard: 70,                 // NEW: Standard bar charts (was heightShort at 55mm - less squashed)
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate maximum characters for a given width and font size
 */
function calcMaxChars(widthMm: number, fontSize: number): number {
  const charWidth = FONT_SPECS.charWidth[fontSize as keyof typeof FONT_SPECS.charWidth] || 0.55;
  return Math.floor(widthMm / charWidth);
}

/**
 * Calculate maximum lines for a given height and font size
 */
function calcMaxLines(heightMm: number, fontSize: number): number {
  const lineHeight = FONT_SPECS.lineHeight[fontSize as keyof typeof FONT_SPECS.lineHeight] || 4.44;
  return Math.floor(heightMm / lineHeight);
}

/**
 * Create a standard element template
 */
function createElement(
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  options: Partial<ElementTemplate> = {}
): ElementTemplate {
  return {
    x,
    y,
    width,
    height,
    fontSize,
    font: FONT_SPECS.family,
    maxChars: calcMaxChars(width, fontSize),
    maxLines: calcMaxLines(height, fontSize),
    fontWeight: 'normal',
    align: 'left',
    color: BRAND_COLORS.darkGray,
    ...options,
  };
}

// ============================================================================
// PAGE 1: COVER PAGE WITH PROPERTY DETAILS
// ============================================================================

const PAGE_1_TEMPLATE: PageTemplate = {
  pageNumber: 1,
  title: 'Cover Page',

  images: {
    logo: {
      x: MARGINS.left,
      y: MARGINS.top,
      width: 50,
      height: 15,
      type: 'logo',
    },
    areaMap: {
      x: MARGINS.left,
      y: 75,  // PHASE 4.1: Moved from 40 to 75 (now BELOW title/location/date)
      width: CONTENT_AREA.width,
      height: 120, // Reduced from 135mm to give more space for AI text
      type: 'map',
      aspectRatio: 1.333, // 4:3 aspect ratio to match 800x600 screenshot
    },
  },

  elements: {
    // PHASE 4.1: Title/Location/Date moved ABOVE map (was below at y=185-210)
    
    // Report title
    reportTitle: createElement(
      MARGINS.left,
      40, // PHASE 4.1: Moved from 185 to 40 (now ABOVE map)
      CONTENT_AREA.width,
      10,
      FONT_SPECS.sizes.title,
      {
        fontWeight: 'bold',
        align: 'center',
        color: BRAND_COLORS.burgundy,
        // Width: 180mm, Font: 18pt
        // Max chars: floor(180 / 1.08) = 166 chars
        // Max lines: floor(10 / 8.90) = 1 line
      }
    ),

    // Area/Location name (replaces property address)
    // Increased height to 12mm to allow 2 lines for long addresses
    areaName: createElement(
      MARGINS.left,
      52, // PHASE 4.1: Moved from 200 to 52 (title ends at 50)
      CONTENT_AREA.width,
      12, // Increased from 8 to 12 for 2 lines
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        align: 'center',
        color: BRAND_COLORS.darkGray,
        // Width: 180mm, Font: 12pt
        // Max chars: floor(180 / 0.72) = 250 chars
        // Max lines: floor(12 / 5.93) = 2 lines
      }
    ),

    // Estimation note (shown below address when location is estimated)
    estimationNote: createElement(
      MARGINS.left,
      64, // Below areaName (52 + 12 = 64)
      CONTENT_AREA.width,
      4,
      FONT_SPECS.sizes.caption,
      {
        align: 'center',
        color: BRAND_COLORS.mediumGray,
        // Width: 180mm, Font: 8pt
        // Max chars: floor(180 / 0.48) = 375 chars
        // Max lines: 1
      }
    ),

    // Report date
    reportDate: createElement(
      MARGINS.left,
      69, // Moved from 62 to 69 to accommodate estimation note
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.body,
      {
        align: 'center',
        color: BRAND_COLORS.mediumGray,
        // Width: 180mm, Font: 9pt
        // Max chars: floor(180 / 0.55) = 327 chars
        // Max lines: floor(5 / 4.44) = 1 line
      }
    ),

    // AI Insights Section - Market Analysis
    // Map ends at 75+120=195, AI section starts at 200 (5mm spacing - reduced gap)
    aiInsightsTitle: createElement(
      MARGINS.left,
      200, // Map ends at 195, +5mm spacing (reduced from 10mm)
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
        // Width: 180mm, Font: 12pt
      }
    ),
    
    aiMarketPositioning: createElement(
      MARGINS.left,
      210, // Title ends at 208, +2mm spacing
      CONTENT_AREA.width,
      52, // Expanded to use available space - ~11-12 lines of text
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.darkGray,
        // Height: 52mm allows ~11-12 lines of 9pt text (4.44mm per line)
        // At ~70 chars/line, this supports 770-840 characters
        // Ends at 210+52=262mm, footer separator at 264.4mm (2.4mm gap)
      }
    ),
  },
};

// ============================================================================
// PAGE 2: MARKET STATISTICS
// ============================================================================

const PAGE_2_TEMPLATE: PageTemplate = {
  pageNumber: 2,
  title: 'Market Statistics',  // Removed emoji - was '📊 Market Statistics'

  elements: {
    // Page header - positioned below header separator line (y=25)
    pageTitle: createElement(
      MARGINS.left,
      35,  // Was MARGINS.top (15mm) - moved to 35mm to clear header
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
        // Width: 180mm, Font: 14pt
        // Max chars: floor(180 / 0.84) = 214 chars
      }
    ),

    // REMOVED: Section 1 & Section 2 elements (overlapped KPI cards at Y=35-87mm)
    // All this data is now displayed in visual KPI cards

    // Price Delta Analysis Section (if available)
    priceDeltaTitle: createElement(
      MARGINS.left,
      130,
      CONTENT_AREA.width,
      6,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),

    priceDeltaAverage: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      140,
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    priceDeltaAverageValue: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      145,
      COLUMN_LAYOUT.columnWidth,
      7,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    priceDeltaMedian: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      140,
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    priceDeltaMedianValue: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      145,
      COLUMN_LAYOUT.columnWidth,
      7,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    priceDeltaRange: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      155,
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    priceDeltaRangeValue: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      160,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.darkGray,
      }
    ),

    priceDeltaSignal: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      155,
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    priceDeltaSignalValue: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      160,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.body,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    priceDeltaInterpretation: createElement(
      MARGINS.left,
      168,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
        // Interpretation text (2 lines max)
      }
    ),

    // PHASE 5: Removed KPI Statistics Summary elements (kpiStatsTitle, kpiPriceLabel, etc.)
    // These were positioned at y=180-226, overlapping with charts (left chart ends at 190)
    // KPI data is already displayed in the visual KPI cards at y=35-87
    // Removing these eliminates the "illegible text overlapping kpi boxes" issue

    // AI Insights Section - Page 2 (Full Width)
    // Single text block: Full width, starts after chart
    aiSupplyDemandText: createElement(
      MARGINS.left,
      190,  // Chart ends at 185 (95+90), 5mm spacing
      CONTENT_AREA.width,  // Full width: 180mm (both columns)
      72,   // 190+72=262, almost to footer (264mm separator)
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.darkGray,
        // Full width: Market insights combining supply/demand and price positioning
        // Width: 180mm, allows ~16 lines of 9pt text (72mm / 4.44)
        // ~2880 characters with wrapping
      }
    ),

    // Removed aiMarketTimingText - would extend past footer (was at y=267)
    // Market timing insights incorporated into above columns

    // Chart title (Full Width - Single Chart)
    priceHistoryChartTitle: createElement(
      MARGINS.left,
      90,  // 5mm above chart at Y=95
      CONTENT_AREA.width,  // Full width title
      4,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
  },

  charts: {
    // Line chart: Full width across both columns
    priceHistoryChart: {
      x: MARGINS.left,
      y: 95,  // 5mm spacing after KPI cards (end at Y=87) and title at Y=90
      width: CONTENT_AREA.width,  // Full width: 180mm (both columns)
      height: 90,  // Increased height for better visualization
      type: 'line',
      title: '12-Month Price History',
      maxDataPoints: 12,
    },
  },
};

// ============================================================================
// PAGE 3: COMPARABLE PROPERTIES
// ============================================================================

const PAGE_3_TEMPLATE: PageTemplate = {
  pageNumber: 3,
  title: 'Comparable Properties',  // Removed emoji - was '🏘️ Comparable Properties'

  elements: {
    // Page header - positioned below header separator line (y=25)
    pageTitle: createElement(
      MARGINS.left,
      35,  // Was MARGINS.top (15mm) - moved to 35mm to clear header
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    pageSubtitle: createElement(
      MARGINS.left,
      48,  // Was 25mm - adjusted for new page title position
      CONTENT_AREA.width,
      10,
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.mediumGray,
        // Width: 180mm, Font: 9pt
        // Max chars: floor(180 / 0.55) = 327 chars
        // Max lines: floor(10 / 4.44) = 2 lines
      }
    ),

    // Comparable Property 1
    comp1Address: createElement(
      MARGINS.left,
      45,
      CONTENT_AREA.width * 0.6,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
        // Width: 108mm, Font: 10pt
        // Max chars: floor(108 / 0.60) = 180 chars
      }
    ),
    comp1Price: createElement(
      MARGINS.left + CONTENT_AREA.width * 0.65,
      45,
      CONTENT_AREA.width * 0.35,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        align: 'right',
        color: BRAND_COLORS.burgundy,
        // Width: 63mm, Font: 10pt
        // Max chars: floor(63 / 0.60) = 105 chars
      }
    ),
    comp1Details: createElement(
      MARGINS.left,
      52,
      CONTENT_AREA.width,
      9,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
        // Width: 180mm, Font: 8pt
        // Max chars: floor(180 / 0.48) = 375 chars
        // Max lines: floor(9 / 3.95) = 2 lines
        // Total: ~750 chars
      }
    ),

    // Comparable Property 2
    comp2Address: createElement(
      MARGINS.left,
      68,
      CONTENT_AREA.width * 0.6,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    comp2Price: createElement(
      MARGINS.left + CONTENT_AREA.width * 0.65,
      68,
      CONTENT_AREA.width * 0.35,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        align: 'right',
        color: BRAND_COLORS.burgundy,
      }
    ),
    comp2Details: createElement(
      MARGINS.left,
      75,
      CONTENT_AREA.width,
      9,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // Comparable Property 3
    comp3Address: createElement(
      MARGINS.left,
      91,
      CONTENT_AREA.width * 0.6,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    comp3Price: createElement(
      MARGINS.left + CONTENT_AREA.width * 0.65,
      91,
      CONTENT_AREA.width * 0.35,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        align: 'right',
        color: BRAND_COLORS.burgundy,
      }
    ),
    comp3Details: createElement(
      MARGINS.left,
      98,
      CONTENT_AREA.width,
      9,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // Comparable Property 4
    comp4Address: createElement(
      MARGINS.left,
      114,
      CONTENT_AREA.width * 0.6,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    comp4Price: createElement(
      MARGINS.left + CONTENT_AREA.width * 0.65,
      114,
      CONTENT_AREA.width * 0.35,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        align: 'right',
        color: BRAND_COLORS.burgundy,
      }
    ),
    comp4Details: createElement(
      MARGINS.left,
      121,
      CONTENT_AREA.width,
      9,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // Comparable Property 5
    comp5Address: createElement(
      MARGINS.left,
      137,
      CONTENT_AREA.width * 0.6,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    comp5Price: createElement(
      MARGINS.left + CONTENT_AREA.width * 0.65,
      137,
      CONTENT_AREA.width * 0.35,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        align: 'right',
        color: BRAND_COLORS.burgundy,
      }
    ),
    comp5Details: createElement(
      MARGINS.left,
      144,
      CONTENT_AREA.width,
      9,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // Comparison Summary
    summaryTitle: createElement(
      MARGINS.left,
      160,
      CONTENT_AREA.width,
      6,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    summaryText: createElement(
      MARGINS.left,
      168,
      CONTENT_AREA.width,
      18,
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.darkGray,
        // Width: 180mm, Font: 9pt
        // Max chars: floor(180 / 0.55) = 327 chars
        // Max lines: floor(18 / 4.44) = 4 lines
        // Total: ~1308 chars
      }
    ),

    // AI Insights - Page 3
    aiLocationAnalysis: createElement(
      MARGINS.left,
      255,
      CONTENT_AREA.width,
      20,
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.darkGray,
        // Height: 20mm allows ~5 lines (kept smaller since near bottom)
      }
    ),
  },

  images: {
    comparisonMap: {
      x: MARGINS.left,
      y: 190,
      width: CONTENT_AREA.width,
      height: 60,
      type: 'map',
    },
  },
};

// ============================================================================
// PAGE 4: DEMOGRAPHICS
// ============================================================================

const PAGE_4_TEMPLATE: PageTemplate = {
  pageNumber: 4,
  title: 'Demographics',  // Removed emoji - was '👥 Demographics'

  elements: {
    // Page header - positioned below header separator line (y=25)
    pageTitle: createElement(
      MARGINS.left,
      35,  // Was MARGINS.top (15mm) - moved to 35mm to clear header
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    // KPI cards: Y=35-87mm (2 rows: 35-57, 65-87)
    // Chart titles start at Y=100mm (with 13mm spacing after KPI cards)

    // Chart titles (2×2 Grid Layout - 4 real data charts)
    housingTenureChartTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      100,  // Top-left chart title
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    incomeComparisonChartTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      100,  // Top-right chart title
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    dwellingTypesChartTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      175,  // Bottom-left chart title
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    condoTenureChartTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      175,  // Bottom-right chart title
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    // Bottom-left: Age Distribution
    ageDistributionChartTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      175,  // Bottom-left chart title
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    // Bottom-right: Population & Households
    populationStatsChartTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      175,  // Bottom-right chart title
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
  },

  charts: {
    // Top-left: Housing Tenure (Donut - Owned vs Rented)
    housingTenureChart: {
      x: COLUMN_LAYOUT.leftColumn.x,
      y: 105,  // After title at 100mm
      width: CHART_STANDARDS.columnWidth.width,
      height: 65,  // Reduced height to fit 2 rows
      type: 'donut',
      title: 'Housing Tenure',
      maxDataPoints: 2,
    },

    // Top-right: Income Comparison (Bar - Median vs Average)
    incomeComparisonChart: {
      x: COLUMN_LAYOUT.rightColumn.x,
      y: 105,  // After title at 100mm
      width: CHART_STANDARDS.columnWidth.width,
      height: 65,  // Reduced height to fit 2 rows
      type: 'bar',
      title: 'Income Comparison',
      maxDataPoints: 2,
    },

    // Bottom-left: Dwelling Types (Donut - Condo vs Non-Condo)
    dwellingTypesChart: {
      x: COLUMN_LAYOUT.leftColumn.x,
      y: 180,  // After title at 175mm
      width: CHART_STANDARDS.columnWidth.width,
      height: 65,  // Reduced height to fit before footer
      type: 'donut',
      title: 'Dwelling Types',
      maxDataPoints: 2,
    },

    // Bottom-right: Condo Tenure (Bar - Owned vs Rented Condos)
    condoTenureChart: {
      x: COLUMN_LAYOUT.rightColumn.x,
      y: 180,  // After title at 175mm
      width: CHART_STANDARDS.columnWidth.width,
      height: 65,  // Reduced height to fit before footer (180+65=245, footer at 267)
      type: 'bar',
      title: 'Condo Ownership',
      maxDataPoints: 2,
    },

    // Bottom-left: Age Distribution (Bar - 6 age brackets)
    ageDistributionDemographicChart: {
      x: COLUMN_LAYOUT.leftColumn.x,
      y: 180,  // After title at 175mm
      width: CHART_STANDARDS.columnWidth.width,
      height: 65,  // Reduced height to fit before footer
      type: 'bar',
      title: 'Age Distribution',
      maxDataPoints: 6,
    },

    // Bottom-right: Population Stats (Bar - Population vs Households)
    populationStatsChart: {
      x: COLUMN_LAYOUT.rightColumn.x,
      y: 180,  // After title at 175mm
      width: CHART_STANDARDS.columnWidth.width,
      height: 65,  // Reduced height to fit before footer
      type: 'bar',
      title: 'Population & Households',
      maxDataPoints: 2,
    },
  },
};

// ============================================================================
// PAGE 5: ECONOMIC INDICATORS
// ============================================================================

const PAGE_5_TEMPLATE: PageTemplate = {
  pageNumber: 5,
  title: 'Market Indexes',  // Removed emoji - was '📈 Market Indexes'

  elements: {
    // Page header - positioned below header separator line (y=25)
    pageTitle: createElement(
      MARGINS.left,
      35,  // Was MARGINS.top (15mm) - moved to 35mm to clear header
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    // ============================================================================
    // PHASE 4.2: Removed employment section - simplified to 2×2 index grid
    // ============================================================================

    // ============================================================================
    // PHASE 4.2: Removed employment section - simplified to 2×2 index grid
    // ============================================================================

    // Market Indexes Section Title - REMOVED (no subtitle needed)
    // indexSectionTitle was here at y=48 - removed per user request

    // ============================================================================
    // 2×2 INDEX GRID LAYOUT
    // Row 1: Hot Growth Index (left) | Affordability Index (right)
    // Row 2: New Homeowners Index (left) | Market Score (right)
    // ============================================================================

    // ROW 1, COL 1: Hot Growth Index
    hotGrowthLabel: createElement(
      MARGINS.left,
      60,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.body,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    hotGrowthValue: createElement(
      MARGINS.left,
      67,
      COLUMN_LAYOUT.columnWidth,
      12,
      18,  // Large display value
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),
    hotGrowthDescription: createElement(
      MARGINS.left,
      82,
      COLUMN_LAYOUT.columnWidth,
      12,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // ROW 1, COL 2: Affordability Index
    affordabilityLabel: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      60,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.body,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    affordabilityValue: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      67,
      COLUMN_LAYOUT.columnWidth,
      12,
      18,  // Large display value
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),
    affordabilityDescription: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      82,
      COLUMN_LAYOUT.columnWidth,
      12,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // ROW 2, COL 1: New Homeowners Index
    newHomeownersLabel: createElement(
      MARGINS.left,
      100,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.body,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    newHomeownersValue: createElement(
      MARGINS.left,
      107,
      COLUMN_LAYOUT.columnWidth,
      12,
      18,  // Large display value
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),
    newHomeownersDescription: createElement(
      MARGINS.left,
      122,
      COLUMN_LAYOUT.columnWidth,
      12,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // ROW 2, COL 2: Market Score
    marketScoreLabel: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      100,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.body,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    marketScoreValue: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      107,
      COLUMN_LAYOUT.columnWidth,
      12,
      18,  // Large display value
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),
    marketScoreDescription: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      122,
      COLUMN_LAYOUT.columnWidth,
      12,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // ============================================================================
    // AI INSIGHTS SECTION - Expanded 2-column layout
    // Starts at y=140, much more space than before
    // ============================================================================

    // PHASE 4.2: Removed old industry/business sections - not needed
    // (industryTitle, industryDescription, businessGrowthTitle, 
    //  newBusinessesLabel/Value/Trend/Description, jobGrowthLabel/Value/Trend/Description)

    // PHASE 4.2: Removed duplicate "Second row of indexes" section
    // (newHomeownersLabel/Value/Description, marketScoreLabel/Value/Description)
    // These are now defined in the 2×2 grid layout above at y=100-134

    // AI Insights - Page 5 (2-Column Layout)
    // PHASE 4.2: Expanded to use ALL available space down to footer
    aiEconomicOutlookText: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      140,  // Starts right after index grid
      COLUMN_LAYOUT.columnWidth,
      124,  // MAXIMUM height to footer (ends at 264mm, footer at 264.4mm)
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.darkGray,
        // Left column: Market outlook & trends
        // Width: 85mm, allows ~28 lines of 9pt text (124mm / 4.44)
      }
    ),

    aiMarketAnalysisText: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      140,  // Starts right after index grid
      COLUMN_LAYOUT.columnWidth,
      124,  // MAXIMUM height to footer (ends at 264mm, footer at 264.4mm)
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.darkGray,
        // Right column: Investment & market insights
        // Width: 85mm, allows ~28 lines of 9pt text (124mm / 4.44)
      }
    ),

    // PHASE 4.2: Removed employment/job market fields - we don't have this data
  },

  images: {
    // Gauge Charts for Market Indexes (client-generated Chart.js)
    affordabilityGaugeChart: {
      x: MARGINS.left,
      y: 85,
      width: 40,
      height: 40,
      type: 'chart',
    },
    growthIndexGaugeChart: {
      x: COLUMN_LAYOUT.rightColumn.x,
      y: 85,
      width: 40,
      height: 40,
      type: 'chart',
    },
  },

  // PHASE 4.2: Removed charts section - no employment/industry data available
  // Previously had: industryDistributionChart, employmentTrendChart
};

// ============================================================================
// PAGE 6: MARKET TRENDS
// ============================================================================

const PAGE_6_TEMPLATE: PageTemplate = {
  pageNumber: 6,
  title: 'Market Trends',  // Removed emoji - was '💹 Market Trends'

  elements: {
    // Page header - positioned below header separator line (y=25)
    pageTitle: createElement(
      MARGINS.left,
      35,  // Was MARGINS.top (15mm) - moved to 35mm to clear header
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    // ============================================================================
    // PHASE 4.3: Reorganized KPI cards into clean 2×2 grid
    // ROW 1: Avg Price (left) | Median Price (right)
    // ROW 2: Days on Market (left) | Sale-to-Price Ratio (right)
    // ============================================================================

    // ROW 1, COL 1: Average Price
    avgPriceLabel: createElement(
      MARGINS.left,
      50, // Moved from 40 - consistent grid start
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    avgPriceValue: createElement(
      MARGINS.left,
      55, // Moved from 45
      COLUMN_LAYOUT.columnWidth,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),
    avgPriceChange: createElement(
      MARGINS.left,
      64, // Moved from 54
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // ROW 1, COL 2: Median Price
    medianPriceLabel: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      50, // Moved from 40 - aligned with avgPrice
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    medianPriceValue: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      55, // Moved from 45
      COLUMN_LAYOUT.columnWidth,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),
    medianPriceChange: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      64, // Moved from 54
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // ROW 2, COL 1: Days on Market
    daysOnMarketLabel: createElement(
      MARGINS.left,
      75, // Moved from 140 - second row of grid
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    daysOnMarketValue: createElement(
      MARGINS.left,
      80, // Moved from 145
      COLUMN_LAYOUT.columnWidth,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    daysOnMarketTrend: createElement(
      MARGINS.left,
      89, // Moved from 154
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // ROW 2, COL 2: Sale-to-Price Ratio
    saleToPriceRatioLabel: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      75, // Moved from 140 - aligned with daysOnMarket
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    saleToPriceRatioValue: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      80, // Moved from 145
      COLUMN_LAYOUT.columnWidth,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    // PHASE 4.3: Removed old section titles (priceTrendsTitle, velocityTitle)
    // KPIs now in unified 2×2 grid without section dividers

    // PHASE 4.3: Removed old section titles (priceTrendsTitle, velocityTitle)
    // KPIs now in unified 2×2 grid without section dividers

    // Chart Titles (2-Column Layout)
    // Positioned right before charts at y=100
    velocityDistributionChartTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      97,  // Right before chart at y=100
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    velocityByPriceChartTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      97,  // Same Y as velocity distribution title
      COLUMN_LAYOUT.columnWidth,
      4,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),

    // Market Insights
    // PHASE 4.3: Charts now end at 100+90=190, so start insights at 200
    insightsTitle: createElement(
      MARGINS.left,
      200,  // Moved from 210 to 200 (charts end at y=190)
      CONTENT_AREA.width,
      6,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),

    insightsText: createElement(
      MARGINS.left,
      210,  // Moved from 220 to 210 (title at 200 + 10mm spacing)
      CONTENT_AREA.width,
      50,   // Increased from 40 to 50mm to prevent paragraph truncation
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.mediumGray,
        maxLines: 15,  // Increased from 12 to 15 lines to allow more text
        // Width: 180mm, Font: 9pt
        // Max chars: floor(180 / 0.55) = 327 chars per line
        // Max lines: 15 lines (increased from 12)
        // Total: ~4900 chars (sufficient for full market insights paragraph)
      }
    ),
  },

  charts: {
    // Bar chart: Days on Market Distribution (Time buckets)
    // PHASE 4.3: Moved from y=65 to y=100 (after 2×2 KPI grid)
    velocityDistributionChart: {
      x: COLUMN_LAYOUT.leftColumn.x,
      y: 100, // After KPI grid ends at ~93mm
      width: CHART_STANDARDS.columnWidth.width,  // 85mm
      height: 90,  // 90mm tall bar chart
      type: 'bar',
      title: 'Days on Market Distribution',
    },

    // Bar chart: Velocity by Price Point (Price ranges with avg DOM)
    // PHASE 4.3: Moved from y=65 to y=100 (after 2×2 KPI grid)
    velocityByPriceChart: {
      x: COLUMN_LAYOUT.rightColumn.x,
      y: 100, // After KPI grid ends at ~93mm
      width: CHART_STANDARDS.columnWidth.width,  // 85mm
      height: 90,  // 90mm tall bar chart
      type: 'bar',
      title: 'Velocity by Price Point',
    },
  },
};

// ============================================================================
// PAGE 7: NEIGHBORHOOD INSIGHTS
// ============================================================================

const PAGE_7_TEMPLATE: PageTemplate = {
  pageNumber: 7,
  title: 'Neighborhood Insights',  // Removed emoji - was '🏘️ Neighborhood Insights'

  elements: {
    // Page header - positioned below header separator line (y=25)
    pageTitle: createElement(
      MARGINS.left,
      35,  // Was MARGINS.top (15mm) - moved to 35mm to clear header
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    // Lifestyle Section
    lifestyleTitle: createElement(
      MARGINS.left,
      48,  // Was 30mm - adjusted for new page title position
      CONTENT_AREA.width,
      6,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),

    lifestyleDescription: createElement(
      MARGINS.left,
      38,
      CONTENT_AREA.width,
      35,  // Increased from 22mm to 35mm to prevent truncation
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.darkGray,
        // Width: 180mm, Font: 9pt
        // Max chars: floor(180 / 0.55) = 327 chars
        // Max lines: floor(35 / 4.44) = 7 lines (was 4)
        // Total: ~2289 chars (was ~1308)
      }
    ),

    // Schools Section
    schoolsTitle: createElement(
      MARGINS.left,
      70,
      CONTENT_AREA.width,
      6,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),

    school1Name: createElement(
      MARGINS.left,
      80,
      COLUMN_LAYOUT.columnWidth * 1.5,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    school1Rating: createElement(
      MARGINS.left + COLUMN_LAYOUT.columnWidth * 1.6,
      80,
      30,
      5,
      FONT_SPECS.sizes.subhead,
      {
        align: 'right',
        color: BRAND_COLORS.burgundy,
      }
    ),
    school1Distance: createElement(
      MARGINS.left,
      86,
      CONTENT_AREA.width,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    school2Name: createElement(
      MARGINS.left,
      95,
      COLUMN_LAYOUT.columnWidth * 1.5,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    school2Rating: createElement(
      MARGINS.left + COLUMN_LAYOUT.columnWidth * 1.6,
      95,
      30,
      5,
      FONT_SPECS.sizes.subhead,
      {
        align: 'right',
        color: BRAND_COLORS.burgundy,
      }
    ),
    school2Distance: createElement(
      MARGINS.left,
      101,
      CONTENT_AREA.width,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    school3Name: createElement(
      MARGINS.left,
      110,
      COLUMN_LAYOUT.columnWidth * 1.5,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),
    school3Rating: createElement(
      MARGINS.left + COLUMN_LAYOUT.columnWidth * 1.6,
      110,
      30,
      5,
      FONT_SPECS.sizes.subhead,
      {
        align: 'right',
        color: BRAND_COLORS.burgundy,
      }
    ),
    school3Distance: createElement(
      MARGINS.left,
      116,
      CONTENT_AREA.width,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),

    // Transportation Section
    transportTitle: createElement(
      MARGINS.left,
      130,
      CONTENT_AREA.width,
      6,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),

    walkScoreLabel: createElement(
      MARGINS.left,
      140,
      COLUMN_LAYOUT.columnWidth / 2.5,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    walkScoreValue: createElement(
      MARGINS.left,
      145,
      COLUMN_LAYOUT.columnWidth / 2.5,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    transitScoreLabel: createElement(
      MARGINS.left + COLUMN_LAYOUT.columnWidth / 2.2,
      140,
      COLUMN_LAYOUT.columnWidth / 2.5,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    transitScoreValue: createElement(
      MARGINS.left + COLUMN_LAYOUT.columnWidth / 2.2,
      145,
      COLUMN_LAYOUT.columnWidth / 2.5,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    bikeScoreLabel: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      140,
      COLUMN_LAYOUT.columnWidth / 2.5,
      4,
      FONT_SPECS.sizes.caption,
      {
        color: BRAND_COLORS.mediumGray,
      }
    ),
    bikeScoreValue: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      145,
      COLUMN_LAYOUT.columnWidth / 2.5,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.burgundy,
      }
    ),

    // Amenities Section
    amenitiesTitle: createElement(
      MARGINS.left,
      165,
      CONTENT_AREA.width,
      6,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: BRAND_COLORS.darkGray,
      }
    ),

    amenitiesDescription: createElement(
      MARGINS.left,
      173,
      CONTENT_AREA.width,
      45,  // Increased from 35mm to 45mm to prevent truncation
      FONT_SPECS.sizes.body,
      {
        color: BRAND_COLORS.darkGray,
        // Width: 180mm, Font: 9pt
        // Max chars: floor(180 / 0.55) = 327 chars
        // Max lines: floor(45 / 4.44) = 10 lines (was 7)
        // Total: ~3270 chars (was ~2289)
      }
    ),

    // Footer
    reportFooter: createElement(
      MARGINS.left,
      PAGE_DIMENSIONS.height - MARGINS.bottom - 8,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.caption,
      {
        align: 'center',
        color: BRAND_COLORS.lightGray,
      }
    ),
  },

  images: {
    neighborhoodMap: {
      x: MARGINS.left,
      y: 210,
      width: CONTENT_AREA.width,
      height: 43,  // Was 50 - reduced to fit (210+43=253 < 254 footer)
      type: 'map',
    },
  },
};

// ============================================================================
// EXPORT ALL TEMPLATES
// ============================================================================

export const PAGE_TEMPLATES: ReadonlyArray<PageTemplate> = [
  PAGE_1_TEMPLATE,
  PAGE_2_TEMPLATE,
  PAGE_3_TEMPLATE,
  PAGE_4_TEMPLATE,
  PAGE_5_TEMPLATE,
  PAGE_6_TEMPLATE,
  PAGE_7_TEMPLATE,
] as const;

/**
 * Get template for a specific page number
 */
export function getPageTemplate(pageNumber: number): PageTemplate | undefined {
  return PAGE_TEMPLATES.find(template => template.pageNumber === pageNumber);
}

/**
 * Validate if text fits within element constraints
 */
export function validateTextFit(
  text: string,
  element: ElementTemplate
): { fits: boolean; overflow: number } {
  const textLength = text.length;
  const maxAllowed = (element.maxChars ?? 0) * (element.maxLines ?? 1);

  return {
    fits: textLength <= maxAllowed,
    overflow: Math.max(0, textLength - maxAllowed),
  };
}

/**
 * Truncate text to fit element constraints
 */
export function truncateToFit(
  text: string,
  element: ElementTemplate,
  ellipsis: boolean = true
): string {
  const maxChars = (element.maxChars ?? 0) * (element.maxLines ?? 1);

  if (text.length <= maxChars) {
    return text;
  }

  if (ellipsis) {
    return text.substring(0, maxChars - 3) + '...';
  }

  return text.substring(0, maxChars);
}

/**
 * Calculate actual rendered width of text in mm
 */
export function calculateTextWidth(
  text: string,
  fontSize: number
): number {
  const charWidth = FONT_SPECS.charWidth[fontSize as keyof typeof FONT_SPECS.charWidth] || 0.55;
  return text.length * charWidth;
}

/**
 * Calculate number of lines needed for text
 */
export function calculateLinesNeeded(
  text: string,
  element: ElementTemplate
): number {
  const charsPerLine = element.maxChars ?? 0;
  return Math.ceil(text.length / charsPerLine);
}

/**
 * Validate if chart fits within bounds
 */
export function validateChartBounds(chart: ChartTemplate): boolean {
  const maxX = chart.x + chart.width;
  const maxY = chart.y + chart.height;

  return (
    chart.x >= MARGINS.left &&
    chart.y >= MARGINS.top &&
    maxX <= PAGE_DIMENSIONS.width - MARGINS.right &&
    maxY <= PAGE_DIMENSIONS.height - MARGINS.bottom
  );
}

/**
 * Export all templates as JSON for debugging
 */
export function exportTemplatesAsJSON(): string {
  return JSON.stringify(PAGE_TEMPLATES, null, 2);
}
