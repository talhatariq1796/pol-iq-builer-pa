/**
 * Page Height Constraints Configuration
 * Defines strict height limits for all PDF pages and sections to prevent overflow
 */

// A4 page dimensions (210mm x 297mm)
export const PAGE_DIMENSIONS = {
  WIDTH: 210,  // mm
  HEIGHT: 297, // mm
} as const;

// Global page constraints
export const GLOBAL_CONSTRAINTS = {
  HEADER_HEIGHT: 25,        // mm
  FOOTER_HEIGHT: 15,        // mm
  CONTENT_MAX_HEIGHT: 257,  // 297 - 25 - 15 (mm)
  WARNING_THRESHOLD: 250,   // Warn when approaching limit (mm)
  MARGIN_LEFT: 15,          // mm
  MARGIN_RIGHT: 15,         // mm
  MARGIN_TOP: 25,           // mm (includes header)
  MARGIN_BOTTOM: 15,        // mm (includes footer)
} as const;

// Calculate available content width
export const CONTENT_WIDTH = PAGE_DIMENSIONS.WIDTH - GLOBAL_CONSTRAINTS.MARGIN_LEFT - GLOBAL_CONSTRAINTS.MARGIN_RIGHT; // 180mm

/**
 * Page 1 - Cover Page
 * Layout: Hero section + Property summary + Key metrics
 */
export const PAGE1_CONSTRAINTS = {
  HERO_SECTION: {
    MAX_HEIGHT: 80,
    TITLE_MAX_LINES: 2,
    SUBTITLE_MAX_LINES: 2,
  },
  PROPERTY_SUMMARY: {
    MAX_HEIGHT: 70,
    ADDRESS_MAX_LINES: 2,
    DESCRIPTION_MAX_LINES: 3,
  },
  KEY_METRICS: {
    MAX_HEIGHT: 90,
    METRIC_LABEL_MAX_LINES: 1,
    METRIC_VALUE_MAX_LINES: 1,
  },
  FOOTER_BRANDING: {
    MAX_HEIGHT: 17,
  },
} as const;

/**
 * Page 2 - Market Overview
 * Layout: Charts + Market metrics + Statistics
 */
export const PAGE2_CONSTRAINTS = {
  HEADER: {
    MAX_HEIGHT: 30,
    TITLE_MAX_LINES: 1,
    SUBTITLE_MAX_LINES: 1,
  },
  PRICE_DISTRIBUTION_CHART: {
    MAX_HEIGHT: 80,
    TITLE_MAX_LINES: 1,
    LEGEND_MAX_LINES: 2,
  },
  MARKET_METRICS: {
    MAX_HEIGHT: 60,
    METRIC_LABEL_MAX_LINES: 1,
    METRIC_VALUE_MAX_LINES: 1,
    CHANGE_TEXT_MAX_LINES: 1,
  },
  PROPERTY_TYPE_CHART: {
    MAX_HEIGHT: 70,
    TITLE_MAX_LINES: 1,
    LABELS_MAX_LINES: 1,
  },
} as const;

/**
 * Page 3 - Comparable Properties
 * Layout: Comparable listings table + Map
 */
export const PAGE3_CONSTRAINTS = {
  HEADER: {
    MAX_HEIGHT: 25,
    TITLE_MAX_LINES: 1,
    SUBTITLE_MAX_LINES: 1,
  },
  COMPARABLE_TABLE: {
    MAX_HEIGHT: 120,
    ROW_HEIGHT: 20,
    MAX_ROWS: 6,
    ADDRESS_MAX_LINES: 1,
    FEATURES_MAX_LINES: 1,
  },
  MAP_SECTION: {
    MAX_HEIGHT: 95,
    CAPTION_MAX_LINES: 2,
  },
} as const;

/**
 * Page 4 - Demographics
 * Layout: Population charts + Demographic breakdown
 */
export const PAGE4_CONSTRAINTS = {
  HEADER: {
    MAX_HEIGHT: 25,
    TITLE_MAX_LINES: 1,
    SUBTITLE_MAX_LINES: 2,
  },
  POPULATION_CHART: {
    MAX_HEIGHT: 70,
    TITLE_MAX_LINES: 1,
    LEGEND_MAX_LINES: 2,
  },
  DEMOGRAPHIC_GRID: {
    MAX_HEIGHT: 80,
    METRIC_LABEL_MAX_LINES: 1,
    METRIC_VALUE_MAX_LINES: 1,
  },
  AGE_DISTRIBUTION: {
    MAX_HEIGHT: 65,
    TITLE_MAX_LINES: 1,
    LEGEND_MAX_LINES: 3,
  },
} as const;

/**
 * Page 5 - Economic Indicators
 * Layout: Income charts + Employment data + Economic metrics
 */
export const PAGE5_CONSTRAINTS = {
  HEADER: {
    MAX_HEIGHT: 25,
    TITLE_MAX_LINES: 1,
    SUBTITLE_MAX_LINES: 2,
  },
  INCOME_CHART: {
    MAX_HEIGHT: 70,
    TITLE_MAX_LINES: 1,
    LEGEND_MAX_LINES: 2,
  },
  ECONOMIC_METRICS: {
    MAX_HEIGHT: 75,
    METRIC_LABEL_MAX_LINES: 1,
    METRIC_VALUE_MAX_LINES: 1,
    DESCRIPTION_MAX_LINES: 2,
  },
  EMPLOYMENT_CHART: {
    MAX_HEIGHT: 65,
    TITLE_MAX_LINES: 1,
    LABELS_MAX_LINES: 1,
  },
} as const;

/**
 * Page 6 - Market Trends
 * Layout: Time series charts + Trend analysis
 */
export const PAGE6_CONSTRAINTS = {
  HEADER: {
    MAX_HEIGHT: 25,
    TITLE_MAX_LINES: 1,
    SUBTITLE_MAX_LINES: 2,
  },
  PRICE_TREND_CHART: {
    MAX_HEIGHT: 85,
    TITLE_MAX_LINES: 1,
    LEGEND_MAX_LINES: 2,
  },
  INVENTORY_METRICS: {
    MAX_HEIGHT: 60,
    METRIC_LABEL_MAX_LINES: 1,
    METRIC_VALUE_MAX_LINES: 1,
  },
  SEASONAL_CHART: {
    MAX_HEIGHT: 70,
    TITLE_MAX_LINES: 1,
    LEGEND_MAX_LINES: 2,
  },
} as const;

/**
 * Page 7 - AI Insights & Recommendations
 * Layout: AI analysis + Investment score + Recommendations
 */
export const PAGE7_CONSTRAINTS = {
  HEADER: {
    MAX_HEIGHT: 25,
    TITLE_MAX_LINES: 1,
    SUBTITLE_MAX_LINES: 2,
  },
  INVESTMENT_SCORE: {
    MAX_HEIGHT: 50,
    TITLE_MAX_LINES: 1,
    DESCRIPTION_MAX_LINES: 2,
  },
  AI_INSIGHTS: {
    MAX_HEIGHT: 80,
    SECTION_TITLE_MAX_LINES: 1,
    INSIGHT_TEXT_MAX_LINES: 4,
    MAX_INSIGHTS: 3,
  },
  RECOMMENDATIONS: {
    MAX_HEIGHT: 80,
    TITLE_MAX_LINES: 1,
    RECOMMENDATION_MAX_LINES: 3,
    MAX_RECOMMENDATIONS: 4,
  },
} as const;

/**
 * Helper function to validate section fits within page
 */
export function validateSectionHeight(
  sectionName: string,
  actualHeight: number,
  maxHeight: number,
  pageNumber: number
): boolean {
  if (actualHeight > maxHeight) {
    console.warn(
      `[Page ${pageNumber}] Section "${sectionName}" overflow: ` +
      `${actualHeight.toFixed(2)}mm exceeds max ${maxHeight}mm ` +
      `(overflow: ${(actualHeight - maxHeight).toFixed(2)}mm)`
    );
    return false;
  }
  return true;
}

/**
 * Helper function to calculate total page content height
 */
export function calculatePageHeight(sections: Array<{ name: string; height: number }>): {
  totalHeight: number;
  withinLimits: boolean;
  overflow: number;
} {
  const totalHeight = sections.reduce((sum, section) => sum + section.height, 0);
  const withinLimits = totalHeight <= GLOBAL_CONSTRAINTS.CONTENT_MAX_HEIGHT;
  const overflow = Math.max(0, totalHeight - GLOBAL_CONSTRAINTS.CONTENT_MAX_HEIGHT);

  if (!withinLimits) {
    console.warn(
      `[Page Height] Total content height ${totalHeight.toFixed(2)}mm exceeds ` +
      `max ${GLOBAL_CONSTRAINTS.CONTENT_MAX_HEIGHT}mm (overflow: ${overflow.toFixed(2)}mm)`
    );
    console.warn('Section breakdown:', sections.map(s => `  ${s.name}: ${s.height.toFixed(2)}mm`).join('\n'));
  }

  return { totalHeight, withinLimits, overflow };
}

/**
 * Helper to truncate text array to fit max lines
 */
export function truncateToMaxLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) {
    return lines;
  }

  const truncated = lines.slice(0, maxLines);
  // Add ellipsis to last line
  if (truncated.length > 0) {
    const lastLine = truncated[truncated.length - 1];
    truncated[truncated.length - 1] = lastLine.substring(0, Math.max(0, lastLine.length - 3)) + '...';
  }

  return truncated;
}
