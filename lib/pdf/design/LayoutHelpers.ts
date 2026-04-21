/**
 * Layout Helpers
 * Common layout patterns for PDF element positioning
 */

import { Element } from '../core/ElementRenderer';
import { Spacing, SpacingToken } from './ModernTokens';
import { resolveSpacing } from './StyleProps';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Distribute elements horizontally with equal spacing
 */
export function distributeHorizontal(
  elements: Element[],
  bounds: Bounds,
  gap: number | SpacingToken = 0
): Element[] {
  const gapValue = resolveSpacing(gap);
  const totalGap = gapValue * (elements.length - 1);
  const itemWidth = (bounds.width - totalGap) / elements.length;

  return elements.map((el, i) => ({
    ...el,
    x: bounds.x + (itemWidth + gapValue) * i,
    y: bounds.y,
    width: itemWidth,
  }));
}

/**
 * Distribute elements vertically (stack) with spacing
 */
export function stack(
  elements: Element[],
  startY: number,
  gap: number | SpacingToken = 0
): Element[] {
  const gapValue = resolveSpacing(gap);
  let currentY = startY;

  return elements.map((el) => {
    const positioned = {
      ...el,
      y: currentY,
    };
    currentY += (el.height || 0) + gapValue;
    return positioned;
  });
}

/**
 * Create a grid layout
 */
export function grid(
  elements: Element[],
  bounds: Bounds,
  config: {
    columns: number;
    rows?: number;
    gap?: number | SpacingToken;
    gapX?: number | SpacingToken;
    gapY?: number | SpacingToken;
  }
): Element[] {
  const gapX = resolveSpacing(config.gapX ?? config.gap ?? 0);
  const gapY = resolveSpacing(config.gapY ?? config.gap ?? 0);

  const rows = config.rows || Math.ceil(elements.length / config.columns);
  const cellWidth = (bounds.width - gapX * (config.columns - 1)) / config.columns;
  const cellHeight = (bounds.height - gapY * (rows - 1)) / rows;

  return elements.map((el, i) => {
    const col = i % config.columns;
    const row = Math.floor(i / config.columns);

    return {
      ...el,
      x: bounds.x + (cellWidth + gapX) * col,
      y: bounds.y + (cellHeight + gapY) * row,
      width: cellWidth,
      height: cellHeight,
    };
  });
}

/**
 * Center an element within bounds
 */
export function center(
  element: Element,
  bounds: Bounds,
  axis: 'both' | 'horizontal' | 'vertical' = 'both'
): Element {
  const result = { ...element };

  if (axis === 'both' || axis === 'horizontal') {
    result.x = bounds.x + (bounds.width - (element.width || 0)) / 2;
  }

  if (axis === 'both' || axis === 'vertical') {
    result.y = bounds.y + (bounds.height - (element.height || 0)) / 2;
  }

  return result;
}

/**
 * Align elements horizontally
 */
export function alignHorizontal(
  elements: Element[],
  alignment: 'left' | 'center' | 'right',
  containerX: number,
  containerWidth: number
): Element[] {
  return elements.map((el) => {
    let x = el.x || 0;

    switch (alignment) {
      case 'left':
        x = containerX;
        break;
      case 'center':
        x = containerX + (containerWidth - (el.width || 0)) / 2;
        break;
      case 'right':
        x = containerX + containerWidth - (el.width || 0);
        break;
    }

    return { ...el, x };
  });
}

/**
 * Align elements vertically
 */
export function alignVertical(
  elements: Element[],
  alignment: 'top' | 'middle' | 'bottom',
  containerY: number,
  containerHeight: number
): Element[] {
  return elements.map((el) => {
    let y = el.y || 0;

    switch (alignment) {
      case 'top':
        y = containerY;
        break;
      case 'middle':
        y = containerY + (containerHeight - (el.height || 0)) / 2;
        break;
      case 'bottom':
        y = containerY + containerHeight - (el.height || 0);
        break;
    }

    return { ...el, y };
  });
}

/**
 * Create padding/margin space around bounds
 */
export function inset(
  bounds: Bounds,
  padding: number | SpacingToken | {
    top?: number | SpacingToken;
    right?: number | SpacingToken;
    bottom?: number | SpacingToken;
    left?: number | SpacingToken;
  }
): Bounds {
  if (typeof padding === 'number' || typeof padding === 'string') {
    const p = resolveSpacing(padding);
    return {
      x: bounds.x + p,
      y: bounds.y + p,
      width: bounds.width - p * 2,
      height: bounds.height - p * 2,
    };
  }

  const top = resolveSpacing(padding.top ?? 0);
  const right = resolveSpacing(padding.right ?? 0);
  const bottom = resolveSpacing(padding.bottom ?? 0);
  const left = resolveSpacing(padding.left ?? 0);

  return {
    x: bounds.x + left,
    y: bounds.y + top,
    width: bounds.width - left - right,
    height: bounds.height - top - bottom,
  };
}

/**
 * Calculate total height of stacked elements
 */
export function calculateStackHeight(
  elements: Element[],
  gap: number | SpacingToken = 0
): number {
  const gapValue = resolveSpacing(gap);
  const totalGap = gapValue * Math.max(0, elements.length - 1);
  const totalHeight = elements.reduce((sum, el) => sum + (el.height || 0), 0);
  return totalHeight + totalGap;
}

/**
 * Calculate total width of horizontal elements
 */
export function calculateRowWidth(
  elements: Element[],
  gap: number | SpacingToken = 0
): number {
  const gapValue = resolveSpacing(gap);
  const totalGap = gapValue * Math.max(0, elements.length - 1);
  const totalWidth = elements.reduce((sum, el) => sum + (el.width || 0), 0);
  return totalWidth + totalGap;
}

/**
 * Wrap elements into multiple rows
 */
export function wrap(
  elements: Element[],
  bounds: Bounds,
  config: {
    gap?: number | SpacingToken;
    gapX?: number | SpacingToken;
    gapY?: number | SpacingToken;
    align?: 'left' | 'center' | 'right';
  } = {}
): Element[] {
  const gapX = resolveSpacing(config.gapX ?? config.gap ?? 0);
  const gapY = resolveSpacing(config.gapY ?? config.gap ?? 0);

  const rows: Element[][] = [];
  let currentRow: Element[] = [];
  let currentRowWidth = 0;

  // Group elements into rows
  elements.forEach((el) => {
    const elWidth = el.width || 0;

    if (currentRowWidth + elWidth + (currentRow.length > 0 ? gapX : 0) <= bounds.width) {
      currentRow.push(el);
      currentRowWidth += elWidth + (currentRow.length > 1 ? gapX : 0);
    } else {
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [el];
      currentRowWidth = elWidth;
    }
  });

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Position elements
  let currentY = bounds.y;
  const positioned: Element[] = [];

  rows.forEach((row) => {
    const rowWidth = calculateRowWidth(row, gapX);
    let currentX = bounds.x;

    // Apply horizontal alignment
    if (config.align === 'center') {
      currentX += (bounds.width - rowWidth) / 2;
    } else if (config.align === 'right') {
      currentX += bounds.width - rowWidth;
    }

    // Position row elements
    row.forEach((el) => {
      positioned.push({
        ...el,
        x: currentX,
        y: currentY,
      });
      currentX += (el.width || 0) + gapX;
    });

    // Move to next row
    const maxHeight = Math.max(...row.map(el => el.height || 0));
    currentY += maxHeight + gapY;
  });

  return positioned;
}

/**
 * Create a flexbox-like layout
 */
export function flex(
  elements: Element[],
  bounds: Bounds,
  config: {
    direction?: 'row' | 'column';
    justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
    align?: 'start' | 'center' | 'end' | 'stretch';
    gap?: number | SpacingToken;
  } = {}
): Element[] {
  const direction = config.direction || 'row';
  const justify = config.justify || 'start';
  const align = config.align || 'stretch';
  const gapValue = resolveSpacing(config.gap ?? 0);

  if (direction === 'row') {
    return flexRow(elements, bounds, justify, align, gapValue);
  } else {
    return flexColumn(elements, bounds, justify, align, gapValue);
  }
}

function flexRow(
  elements: Element[],
  bounds: Bounds,
  justify: string,
  align: string,
  gap: number
): Element[] {
  const totalWidth = calculateRowWidth(elements, gap);
  let startX = bounds.x;

  // Calculate start position based on justify
  switch (justify) {
    case 'center':
      startX += (bounds.width - totalWidth) / 2;
      break;
    case 'end':
      startX += bounds.width - totalWidth;
      break;
    case 'space-between':
    case 'space-around':
    case 'space-evenly':
      // Will be handled per-element
      break;
  }

  let currentX = startX;
  const spaceBetween = justify === 'space-between' && elements.length > 1
    ? (bounds.width - elements.reduce((sum, el) => sum + (el.width || 0), 0)) / (elements.length - 1)
    : 0;

  return elements.map((el, i) => {
    const y = align === 'center'
      ? bounds.y + (bounds.height - (el.height || 0)) / 2
      : align === 'end'
      ? bounds.y + bounds.height - (el.height || 0)
      : bounds.y;

    const x = justify === 'space-between'
      ? bounds.x + i * (bounds.width / (elements.length - 1 || 1))
      : currentX;

    currentX += (el.width || 0) + (justify === 'space-between' ? 0 : gap);

    return { ...el, x, y };
  });
}

function flexColumn(
  elements: Element[],
  bounds: Bounds,
  justify: string,
  align: string,
  gap: number
): Element[] {
  const totalHeight = calculateStackHeight(elements, gap);
  let startY = bounds.y;

  // Calculate start position based on justify
  switch (justify) {
    case 'center':
      startY += (bounds.height - totalHeight) / 2;
      break;
    case 'end':
      startY += bounds.height - totalHeight;
      break;
  }

  let currentY = startY;

  return elements.map((el) => {
    const x = align === 'center'
      ? bounds.x + (bounds.width - (el.width || 0)) / 2
      : align === 'end'
      ? bounds.x + bounds.width - (el.width || 0)
      : bounds.x;

    const result = { ...el, x, y: currentY };
    currentY += (el.height || 0) + gap;
    return result;
  });
}

/**
 * Absolute positioning helper
 */
export function position(
  element: Element,
  pos: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  },
  container: Bounds
): Element {
  const result = { ...element };

  if (pos.left !== undefined) {
    result.x = container.x + pos.left;
  } else if (pos.right !== undefined) {
    result.x = container.x + container.width - (element.width || 0) - pos.right;
  }

  if (pos.top !== undefined) {
    result.y = container.y + pos.top;
  } else if (pos.bottom !== undefined) {
    result.y = container.y + container.height - (element.height || 0) - pos.bottom;
  }

  return result;
}
