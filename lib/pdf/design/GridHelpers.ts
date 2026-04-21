/**
 * Grid Helpers
 * Utilities for consistent 2-column layouts matching reference design
 */

import { Spacing } from './ModernTokens';

/**
 * Standard page dimensions for Letter size (8.5" x 11")
 * Dimensions in millimeters
 */
export const PAGE_DIMENSIONS = {
  width: 215.9,      // 8.5 inches
  height: 279.4,     // 11 inches
  margin: {
    top: 15,
    right: 15,
    bottom: 15,
    left: 15,
  },
} as const;

/**
 * Calculate usable content area
 */
export const CONTENT_AREA = {
  x: PAGE_DIMENSIONS.margin.left,
  y: PAGE_DIMENSIONS.margin.top,
  width: PAGE_DIMENSIONS.width - PAGE_DIMENSIONS.margin.left - PAGE_DIMENSIONS.margin.right,
  height: PAGE_DIMENSIONS.height - PAGE_DIMENSIONS.margin.top - PAGE_DIMENSIONS.margin.bottom,
} as const;

/**
 * 2-Column Grid Configuration
 * Standard layout for clean, readable content
 */
export const TWO_COLUMN_GRID = {
  gutter: Spacing.lg, // 16mm space between columns

  // Left column (slightly wider for primary content)
  left: {
    x: CONTENT_AREA.x,
    width: (CONTENT_AREA.width - Spacing.lg) * 0.55, // 55% width
  },

  // Right column
  right: {
    x: CONTENT_AREA.x + ((CONTENT_AREA.width - Spacing.lg) * 0.55) + Spacing.lg,
    width: (CONTENT_AREA.width - Spacing.lg) * 0.45, // 45% width
  },

  // Full width (for headers, footers)
  full: {
    x: CONTENT_AREA.x,
    width: CONTENT_AREA.width,
  },
} as const;

/**
 * Equal 2-Column Grid (50/50 split)
 */
export const EQUAL_TWO_COLUMN_GRID = {
  gutter: Spacing.lg,

  left: {
    x: CONTENT_AREA.x,
    width: (CONTENT_AREA.width - Spacing.lg) / 2,
  },

  right: {
    x: CONTENT_AREA.x + ((CONTENT_AREA.width - Spacing.lg) / 2) + Spacing.lg,
    width: (CONTENT_AREA.width - Spacing.lg) / 2,
  },

  full: {
    x: CONTENT_AREA.x,
    width: CONTENT_AREA.width,
  },
} as const;

/**
 * 3-Column Grid (for metric cards)
 */
export const THREE_COLUMN_GRID = {
  gutter: Spacing.md, // 10mm space between columns

  columns: [
    {
      x: CONTENT_AREA.x,
      width: (CONTENT_AREA.width - (Spacing.md * 2)) / 3,
    },
    {
      x: CONTENT_AREA.x + ((CONTENT_AREA.width - (Spacing.md * 2)) / 3) + Spacing.md,
      width: (CONTENT_AREA.width - (Spacing.md * 2)) / 3,
    },
    {
      x: CONTENT_AREA.x + (((CONTENT_AREA.width - (Spacing.md * 2)) / 3) + Spacing.md) * 2,
      width: (CONTENT_AREA.width - (Spacing.md * 2)) / 3,
    },
  ],
} as const;

/**
 * Helper to create bounds for a column section
 */
export function createColumnBounds(
  column: { x: number; width: number },
  y: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: column.x,
    y,
    width: column.width,
    height,
  };
}

/**
 * Helper to create full-width bounds
 */
export function createFullWidthBounds(
  y: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: CONTENT_AREA.x,
    y,
    width: CONTENT_AREA.width,
    height,
  };
}

/**
 * Vertical rhythm helper
 * Returns next Y position after an element
 */
export function getNextY(currentY: number, elementHeight: number, spacing: number = Spacing.lg): number {
  return currentY + elementHeight + spacing;
}

/**
 * Section divider helper
 * Creates a subtle horizontal line
 */
export function createSectionDivider(y: number): {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
} {
  return {
    type: 'line',
    x1: CONTENT_AREA.x,
    y1: y,
    x2: CONTENT_AREA.x + CONTENT_AREA.width,
    y2: y,
    width: 0.25, // Hairline
    color: '#EBEBEB',
  };
}
