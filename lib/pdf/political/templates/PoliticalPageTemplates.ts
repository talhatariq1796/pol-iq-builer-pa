/**
 * Political Page Templates - Fixed Position Template System
 *
 * Page Dimensions: 210mm × 279.4mm (US Letter)
 * Safe Margins: 15mm all sides
 * Content Area: 180mm × 249.4mm
 * 2-Column Layout: 85mm per column, 10mm gutter
 *
 * This system ensures consistent PDF output by defining exact (x, y, width, height)
 * positions for every element. Content can change dynamically, but layout never shifts.
 *
 * @version 1.0.0
 * @lastUpdated 2025-12-10
 */

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
  type: 'bar' | 'line' | 'donut' | 'pie' | 'scatter' | 'horizontalBar' | 'stackedBar' | 'gauge';
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
  /** Image type/purpose */
  type: 'photo' | 'logo' | 'icon' | 'map' | 'chart';
  /** Aspect ratio constraint */
  aspectRatio?: number;
}

export interface TableTemplate {
  /** X position in mm */
  x: number;
  /** Y position in mm */
  y: number;
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
  /** Maximum rows */
  maxRows: number;
  /** Row height in mm */
  rowHeight: number;
  /** Column widths as percentages (must sum to 100) */
  columnWidths: number[];
  /** Header row height */
  headerHeight?: number;
}

export interface KPICardTemplate {
  /** X position in mm */
  x: number;
  /** Y position in mm */
  y: number;
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
  /** Card style */
  style?: 'filled' | 'outline' | 'gradient';
}

export interface PageTemplate {
  /** Page number */
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
  /** Table elements with exact positioning */
  tables?: {
    [tableId: string]: TableTemplate;
  };
  /** KPI card positions */
  kpiCards?: {
    [cardId: string]: KPICardTemplate;
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

// ============================================================================
// POLITICAL COLOR PALETTE
// ============================================================================

export const POLITICAL_COLORS = {
  // Party Colors
  democrat: '#2E5EAA',        // Blue
  democratLight: '#6B8FCC',   // Light blue
  democratDark: '#1E3D6B',    // Dark blue
  republican: '#C93135',      // Red
  republicanLight: '#E57578', // Light red
  republicanDark: '#8B1F22',  // Dark red
  independent: '#6B7280',     // Gray

  // Metric Colors
  swing: '#8B5CF6',           // Purple (swing potential)
  swingLight: '#C4B5FD',      // Light purple
  gotv: '#10B981',            // Green (GOTV priority)
  gotvLight: '#6EE7B7',       // Light green
  persuasion: '#F59E0B',      // Amber (persuasion opportunity)
  persuasionLight: '#FCD34D', // Light amber
  turnout: '#3B82F6',         // Blue (turnout)
  turnoutLight: '#93C5FD',    // Light blue

  // Competitiveness Scale (7 levels)
  safeD: '#1E40AF',           // Dark blue - Safe Democrat
  likelyD: '#3B82F6',         // Medium blue - Likely Democrat
  leanD: '#93C5FD',           // Light blue - Lean Democrat
  tossup: '#A855F7',          // Purple - Toss-up
  leanR: '#FCA5A5',           // Light red - Lean Republican
  likelyR: '#EF4444',         // Medium red - Likely Republican
  safeR: '#B91C1C',           // Dark red - Safe Republican

  // UI Colors
  primary: '#1E3A5F',         // Navy (headers)
  secondary: '#64748B',       // Slate (body text)
  accent: '#0EA5E9',          // Sky (highlights)
  background: '#F8FAFC',      // Light gray (page bg)
  cardBg: '#FFFFFF',          // White (card bg)
  border: '#E2E8F0',          // Light border

  // Text Colors
  textPrimary: '#1E293B',     // Near black
  textSecondary: '#64748B',   // Slate
  textMuted: '#94A3B8',       // Light slate
  white: '#FFFFFF',

  // Donor Analysis Colors
  donorPrimary: '#7C3AED',    // Purple (donor reports)
  donorSecondary: '#8B5CF6',  // Light purple
  donorAccent: '#A78BFA',     // Very light purple

  // Canvassing Colors
  canvassPrimary: '#059669',  // Emerald (canvassing reports)
  canvassSecondary: '#10B981', // Green

  // Segment Colors
  segmentPrimary: '#8B5CF6',  // Purple (segment reports)
  segmentSecondary: '#A78BFA', // Light purple
} as const;

// ============================================================================
// FONT SPECIFICATIONS
// ============================================================================

export const FONT_SPECS = {
  family: 'Helvetica',
  sizes: {
    caption: 8,      // Labels, footnotes
    body: 9,         // Body text
    subhead: 10,     // Subsections
    section: 12,     // Section headers
    heading: 14,     // Page titles
    title: 18,       // Report title
    hero: 24,        // Cover page main title
  },
  charWidth: {
    // Average character width in mm at each font size
    8: 0.48,
    9: 0.55,
    10: 0.60,
    12: 0.72,
    14: 0.84,
    18: 1.08,
    24: 1.44,
  },
  lineHeight: {
    // Line height in mm at each font size (font * 0.3528 * 1.4)
    8: 3.95,
    9: 4.44,
    10: 4.94,
    12: 5.93,
    14: 6.92,
    18: 8.90,
    24: 11.87,
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
 * Create a standard element template with auto-calculated constraints
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
    color: POLITICAL_COLORS.textPrimary,
    ...options,
  };
}

/**
 * Create a KPI card template
 */
function createKPICard(
  x: number,
  y: number,
  width: number = 42,
  height: number = 28,
  style: 'filled' | 'outline' | 'gradient' = 'filled'
): KPICardTemplate {
  return { x, y, width, height, style };
}

// ============================================================================
// KPI CARD GRID LAYOUT
// ============================================================================

export const KPI_GRID = {
  // 4-card grid (2x2)
  fourCards: {
    startY: 200,
    columns: 2,
    cardWidth: 85,
    cardHeight: 28,
    gapX: 10,
    gapY: 6,
  },
  // 2-row grid below header
  twoRowGrid: {
    startY: 48,
    columns: 4,
    cardWidth: 42,
    cardHeight: 22,
    gapX: 4,
    gapY: 6,
  },
} as const;

// ============================================================================
// PAGE 1: COVER PAGE
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
    mapThumbnail: {
      x: MARGINS.left,
      y: 90,
      width: CONTENT_AREA.width,  // 180mm
      height: 100,                // 100mm
      type: 'map',
      aspectRatio: 1.8,           // 180:100 = 1.8:1
    },
  },

  elements: {
    // Report date (top right)
    reportDate: createElement(
      150,
      20,
      45,
      5,
      FONT_SPECS.sizes.body,
      {
        align: 'right',
        color: POLITICAL_COLORS.textSecondary,
      }
    ),

    // Report title
    reportTitle: createElement(
      MARGINS.left,
      40,
      CONTENT_AREA.width,
      10,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        align: 'center',
        color: POLITICAL_COLORS.primary,
      }
    ),

    // Area name (hero text)
    areaName: createElement(
      MARGINS.left,
      55,
      CONTENT_AREA.width,
      15,
      FONT_SPECS.sizes.hero,
      {
        fontWeight: 'bold',
        align: 'center',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Area description
    areaDescription: createElement(
      MARGINS.left,
      72,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.subhead,
      {
        align: 'center',
        color: POLITICAL_COLORS.textSecondary,
      }
    ),

    // Selection method note
    selectionMethod: createElement(
      MARGINS.left,
      82,
      CONTENT_AREA.width,
      4,
      FONT_SPECS.sizes.caption,
      {
        align: 'center',
        color: POLITICAL_COLORS.textMuted,
      }
    ),
  },

  // KPI cards below map (2x2 grid starting at y=200)
  kpiCards: {
    partisanLean: createKPICard(MARGINS.left, 200, 85, 28),
    swingPotential: createKPICard(COLUMN_LAYOUT.rightColumn.x, 200, 85, 28),
    avgTurnout: createKPICard(MARGINS.left, 234, 85, 28),
    registeredVoters: createKPICard(COLUMN_LAYOUT.rightColumn.x, 234, 85, 28),
  },
};

// ============================================================================
// PAGE 2: POLITICAL OVERVIEW
// ============================================================================

const PAGE_2_TEMPLATE: PageTemplate = {
  pageNumber: 2,
  title: 'Political Overview',

  elements: {
    // Page header
    pageTitle: createElement(
      MARGINS.left,
      35,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.primary,
      }
    ),

    // Section: Partisan Lean
    partisanLeanTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      50,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Section: Swing Potential
    swingPotentialTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      50,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Section: Turnout Analysis
    turnoutTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      120,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Section: Targeting Priority
    targetingTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      120,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Key Takeaways Section
    takeawaysTitle: createElement(
      MARGINS.left,
      190,
      CONTENT_AREA.width,
      6,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.primary,
      }
    ),

    takeawaysList: createElement(
      MARGINS.left,
      200,
      CONTENT_AREA.width,
      55,
      FONT_SPECS.sizes.body,
      {
        color: POLITICAL_COLORS.textPrimary,
      }
    ),
  },

  // Metric cards with gauges
  kpiCards: {
    partisanLeanCard: createKPICard(COLUMN_LAYOUT.leftColumn.x, 58, 85, 55),
    swingPotentialCard: createKPICard(COLUMN_LAYOUT.rightColumn.x, 58, 85, 55),
    turnoutCard: createKPICard(COLUMN_LAYOUT.leftColumn.x, 128, 85, 55),
    targetingCard: createKPICard(COLUMN_LAYOUT.rightColumn.x, 128, 85, 55),
  },

  charts: {
    // Partisan lean gauge (inside card)
    partisanGauge: {
      x: COLUMN_LAYOUT.leftColumn.x + 10,
      y: 70,
      width: 65,
      height: 30,
      type: 'gauge',
    },
    // Swing potential gauge (inside card)
    swingGauge: {
      x: COLUMN_LAYOUT.rightColumn.x + 10,
      y: 70,
      width: 65,
      height: 30,
      type: 'gauge',
    },
  },
};

// ============================================================================
// PAGE 3: ELECTION HISTORY
// ============================================================================

const PAGE_3_TEMPLATE: PageTemplate = {
  pageNumber: 3,
  title: 'Election History',

  elements: {
    // Page header
    pageTitle: createElement(
      MARGINS.left,
      35,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.primary,
      }
    ),

    // Table section title
    tableTitle: createElement(
      MARGINS.left,
      48,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Trend chart title
    trendChartTitle: createElement(
      MARGINS.left,
      125,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Turnout chart title
    turnoutChartTitle: createElement(
      MARGINS.left,
      205,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),
  },

  tables: {
    // Historical results table
    resultsTable: {
      x: MARGINS.left,
      y: 55,
      width: CONTENT_AREA.width,
      height: 65,  // Increased to 65mm for more rows
      maxRows: 8,
      rowHeight: 8,  // Increased from 7mm to 8mm for better readability
      headerHeight: 8,
      // Year | Type | Office | Dem% | Rep% | Margin
      columnWidths: [12, 15, 28, 15, 15, 15],  // Sum = 100%
    },
  },

  charts: {
    // Partisan trend line chart (2016-2024)
    partisanTrendChart: {
      x: MARGINS.left,
      y: 133,
      width: CONTENT_AREA.width,
      height: 65,
      type: 'line',
      title: 'Partisan Trend (2016-2024)',
      maxDataPoints: 9,  // 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024
    },

    // Turnout bar chart
    turnoutChart: {
      x: MARGINS.left,
      y: 213,
      width: CONTENT_AREA.width,
      height: 45,
      type: 'bar',
      title: 'Turnout by Election Year',
      maxDataPoints: 5,
    },
  },
};

// ============================================================================
// PAGE 4: DEMOGRAPHICS
// ============================================================================

const PAGE_4_TEMPLATE: PageTemplate = {
  pageNumber: 4,
  title: 'Demographics',

  elements: {
    // Page header
    pageTitle: createElement(
      MARGINS.left,
      35,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.primary,
      }
    ),

    // Chart section titles
    ageChartTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      95,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    incomeChartTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      95,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    educationChartTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      180,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    housingChartTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      180,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.caption,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),
  },

  // Top row: 4 KPI cards for population stats
  kpiCards: {
    population: createKPICard(MARGINS.left, 48, 42, 22),
    votingAge: createKPICard(MARGINS.left + 46, 48, 42, 22),
    registered: createKPICard(MARGINS.left + 92, 48, 42, 22),
    medianIncome: createKPICard(MARGINS.left + 138, 48, 42, 22),

    // Secondary row
    medianAge: createKPICard(MARGINS.left, 74, 42, 18),
    collegePct: createKPICard(MARGINS.left + 46, 74, 42, 18),
    ownerOccupied: createKPICard(MARGINS.left + 92, 74, 42, 18),
    medianHomeValue: createKPICard(MARGINS.left + 138, 74, 42, 18),
  },

  charts: {
    // Age distribution (left column)
    ageDistribution: {
      x: COLUMN_LAYOUT.leftColumn.x,
      y: 102,
      width: COLUMN_LAYOUT.columnWidth,
      height: 70,
      type: 'bar',
      title: 'Age Distribution',
    },

    // Income distribution (right column)
    incomeDistribution: {
      x: COLUMN_LAYOUT.rightColumn.x,
      y: 102,
      width: COLUMN_LAYOUT.columnWidth,
      height: 70,
      type: 'bar',
      title: 'Household Income',
    },

    // Education levels (left column)
    educationLevels: {
      x: COLUMN_LAYOUT.leftColumn.x,
      y: 187,
      width: COLUMN_LAYOUT.columnWidth,
      height: 65,
      type: 'horizontalBar',
      title: 'Education Levels',
    },

    // Housing tenure (right column)
    housingTenure: {
      x: COLUMN_LAYOUT.rightColumn.x,
      y: 187,
      width: COLUMN_LAYOUT.columnWidth,
      height: 65,
      type: 'donut',
      title: 'Owner vs Renter',
    },
  },
};

// ============================================================================
// PAGE 5: POLITICAL ATTITUDES
// ============================================================================

const PAGE_5_TEMPLATE: PageTemplate = {
  pageNumber: 5,
  title: 'Political Attitudes',

  elements: {
    // Page header
    pageTitle: createElement(
      MARGINS.left,
      35,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.primary,
      }
    ),

    // Ideology section title
    ideologyTitle: createElement(
      MARGINS.left,
      48,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Ideology spectrum labels (below chart)
    ideologyLabels: createElement(
      MARGINS.left,
      88,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.caption,
      {
        align: 'center',
        color: POLITICAL_COLORS.textSecondary,
      }
    ),

    // Party registration title
    partyRegTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      105,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Voter engagement title
    engagementTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      105,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Key political issues section
    issuesTitle: createElement(
      MARGINS.left,
      195,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    issuesList: createElement(
      MARGINS.left,
      203,
      CONTENT_AREA.width,
      50,
      FONT_SPECS.sizes.body,
      {
        color: POLITICAL_COLORS.textPrimary,
      }
    ),
  },

  charts: {
    // Ideology spectrum (full width stacked bar)
    ideologySpectrum: {
      x: MARGINS.left,
      y: 56,
      width: CONTENT_AREA.width,
      height: 28,
      type: 'stackedBar',
      title: 'Ideological Distribution',
    },

    // Party registration donut
    partyRegistration: {
      x: COLUMN_LAYOUT.leftColumn.x,
      y: 113,
      width: COLUMN_LAYOUT.columnWidth,
      height: 75,
      type: 'donut',
      title: 'Party Registration',
    },

    // Voter engagement bars
    voterEngagement: {
      x: COLUMN_LAYOUT.rightColumn.x,
      y: 113,
      width: COLUMN_LAYOUT.columnWidth,
      height: 75,
      type: 'horizontalBar',
      title: 'Voter Engagement',
    },
  },
};

// ============================================================================
// PAGE 6: ENGAGEMENT PROFILE
// ============================================================================

const PAGE_6_TEMPLATE: PageTemplate = {
  pageNumber: 6,
  title: 'Engagement Profile',

  elements: {
    // Page header
    pageTitle: createElement(
      MARGINS.left,
      35,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.primary,
      }
    ),

    // Engagement metrics title
    engagementMetricsTitle: createElement(
      MARGINS.left,
      48,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Tapestry segments title
    tapestryTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      130,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Primary segment name
    primarySegment: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      140,
      COLUMN_LAYOUT.columnWidth,
      8,
      FONT_SPECS.sizes.section,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.primary,
      }
    ),

    // Segment characteristics
    segmentCharacteristics: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      150,
      COLUMN_LAYOUT.columnWidth,
      40,
      FONT_SPECS.sizes.body,
      {
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Secondary segment
    secondarySegment: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      195,
      COLUMN_LAYOUT.columnWidth,
      15,
      FONT_SPECS.sizes.body,
      {
        color: POLITICAL_COLORS.textSecondary,
      }
    ),

    // Media consumption title
    mediaTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      130,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Community involvement row
    communityTitle: createElement(
      MARGINS.left,
      220,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    communityStats: createElement(
      MARGINS.left,
      228,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.body,
      {
        color: POLITICAL_COLORS.textPrimary,
      }
    ),
  },

  charts: {
    // Political engagement horizontal bars (full width)
    engagementBars: {
      x: MARGINS.left,
      y: 56,
      width: CONTENT_AREA.width,
      height: 68,
      type: 'horizontalBar',
      title: 'Political Engagement Activities',
    },

    // Media consumption bars
    mediaConsumption: {
      x: COLUMN_LAYOUT.rightColumn.x,
      y: 138,
      width: COLUMN_LAYOUT.columnWidth,
      height: 70,
      type: 'bar',
      title: 'Media Consumption',
    },
  },

  // Market momentum KPI cards (from API data)
  kpiCards: {
    timeOnMarket: createKPICard(MARGINS.left, 240, 42, 18),
    marketVelocity: createKPICard(MARGINS.left + 46, 240, 42, 18),
    inventoryLevel: createKPICard(MARGINS.left + 92, 240, 42, 18),
    demandIndex: createKPICard(MARGINS.left + 138, 240, 42, 18),
  },
};

// ============================================================================
// PAGE 7: AI ANALYSIS & RECOMMENDATIONS
// ============================================================================

const PAGE_7_TEMPLATE: PageTemplate = {
  pageNumber: 7,
  title: 'AI Analysis & Recommendations',

  elements: {
    // Page header
    pageTitle: createElement(
      MARGINS.left,
      35,
      CONTENT_AREA.width,
      8,
      FONT_SPECS.sizes.heading,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.primary,
      }
    ),

    // Executive summary section
    summaryTitle: createElement(
      MARGINS.left,
      48,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    summaryText: createElement(
      MARGINS.left,
      55,
      CONTENT_AREA.width,
      45,
      FONT_SPECS.sizes.body,
      {
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Key insights title
    insightsTitle: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      105,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Key insights list
    insightsList: createElement(
      COLUMN_LAYOUT.leftColumn.x,
      113,
      COLUMN_LAYOUT.columnWidth,
      50,
      FONT_SPECS.sizes.body,
      {
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Recommendations title
    recommendationsTitle: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      105,
      COLUMN_LAYOUT.columnWidth,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Recommendations list
    recommendationsList: createElement(
      COLUMN_LAYOUT.rightColumn.x,
      113,
      COLUMN_LAYOUT.columnWidth,
      50,
      FONT_SPECS.sizes.body,
      {
        color: POLITICAL_COLORS.textPrimary,
      }
    ),

    // Similar precincts section title
    similarTitle: createElement(
      MARGINS.left,
      170,
      CONTENT_AREA.width,
      5,
      FONT_SPECS.sizes.subhead,
      {
        fontWeight: 'bold',
        color: POLITICAL_COLORS.textPrimary,
      }
    ),
  },

  tables: {
    // Similar precincts table
    similarTable: {
      x: MARGINS.left,
      y: 178,
      width: CONTENT_AREA.width,
      height: 40,
      maxRows: 5,
      rowHeight: 7,
      headerHeight: 7,
      // Name | Lean | Swing | GOTV | Similarity
      columnWidths: [35, 15, 15, 15, 20],
    },
  },
};

// ============================================================================
// EXPORT ALL TEMPLATES
// ============================================================================

export const POLITICAL_PAGE_TEMPLATES: Record<number, PageTemplate> = {
  1: PAGE_1_TEMPLATE,
  2: PAGE_2_TEMPLATE,
  3: PAGE_3_TEMPLATE,
  4: PAGE_4_TEMPLATE,
  5: PAGE_5_TEMPLATE,
  6: PAGE_6_TEMPLATE,
  7: PAGE_7_TEMPLATE,
};

/**
 * Get template for a specific page
 */
export function getPageTemplate(pageNumber: number): PageTemplate | undefined {
  return POLITICAL_PAGE_TEMPLATES[pageNumber];
}

/**
 * Get all templates as array
 */
export function getAllPageTemplates(): PageTemplate[] {
  return Object.values(POLITICAL_PAGE_TEMPLATES);
}

/**
 * Get color for partisan lean value
 * @param lean Partisan lean value (-100 to +100, negative = Democrat, positive = Republican)
 */
export function getPartisanColor(lean: number): string {
  if (lean < -15) return POLITICAL_COLORS.safeD;
  if (lean < -8) return POLITICAL_COLORS.likelyD;
  if (lean < -3) return POLITICAL_COLORS.leanD;
  if (lean <= 3) return POLITICAL_COLORS.tossup;
  if (lean <= 8) return POLITICAL_COLORS.leanR;
  if (lean <= 15) return POLITICAL_COLORS.likelyR;
  return POLITICAL_COLORS.safeR;
}

/**
 * Format partisan lean as display string
 * @param lean Partisan lean value
 */
export function formatPartisanLean(lean: number): string {
  if (lean === 0) return 'EVEN';
  const party = lean < 0 ? 'D' : 'R';
  const value = Math.abs(lean).toFixed(1);
  return `${party}+${value}`;
}

/**
 * Get competitiveness classification
 */
export function getCompetitivenessLabel(lean: number): string {
  const absLean = Math.abs(lean);
  const party = lean < 0 ? 'Democrat' : lean > 0 ? 'Republican' : 'Toss-up';

  if (absLean < 3) return 'Toss-up';
  if (absLean < 8) return `Lean ${party}`;
  if (absLean < 15) return `Likely ${party}`;
  return `Safe ${party}`;
}

/**
 * Get color for metric score (0-100)
 */
export function getScoreColor(score: number, metric: 'swing' | 'gotv' | 'persuasion' | 'turnout'): string {
  const colors = {
    swing: POLITICAL_COLORS.swing,
    gotv: POLITICAL_COLORS.gotv,
    persuasion: POLITICAL_COLORS.persuasion,
    turnout: POLITICAL_COLORS.turnout,
  };
  return colors[metric] || POLITICAL_COLORS.accent;
}

/**
 * Get priority label from score
 */
export function getPriorityLabel(score: number): string {
  if (score >= 80) return 'TOP PRIORITY';
  if (score >= 70) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  if (score >= 50) return 'LOW';
  return 'MINIMAL';
}
