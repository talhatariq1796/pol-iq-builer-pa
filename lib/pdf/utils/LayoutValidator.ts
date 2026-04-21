/**
 * Layout Validator Utility
 * Prevents content overflow and validates Y-position constraints
 *
 * Purpose:
 * - Validate elements fit within page boundaries
 * - Track column heights to prevent overflow
 * - Provide safe height calculations
 * - Warn about layout violations
 *
 * @example
 * ```typescript
 * // Before rendering a section
 * const maxHeight = LayoutValidator.getMaxSectionHeight(currentY);
 * const sectionHeight = Math.min(requestedHeight, maxHeight);
 *
 * // After creating elements
 * LayoutValidator.validateYPosition(currentY, sectionHeight, 'Page6BuilderV2');
 * ```
 */

import { CONTENT_AREA } from '../design/GridHelpers';
import { Spacing } from '../design/ModernTokens';

export class LayoutValidator {
  /**
   * Column height tracking for multi-column layouts
   */
  private static columnHeights: Map<string, number> = new Map();

  /**
   * Validate element fits within page bounds
   * Throws error if element would overflow page
   *
   * @param y - Current Y position
   * @param height - Element height in mm
   * @param pageName - Page identifier for error messages
   * @throws Error if element exceeds page boundaries
   */
  static validateYPosition(y: number, height: number, pageName: string): void {
    const maxY = CONTENT_AREA.y + CONTENT_AREA.height - Spacing.xl;
    const elementBottom = y + height;

    if (elementBottom > maxY) {
      const overflow = elementBottom - maxY;
      console.warn(`[${pageName}] Element overflow: ${overflow.toFixed(1)}mm beyond page boundary`);
      throw new Error(`${pageName}: Content exceeds page height by ${overflow.toFixed(1)}mm`);
    }
  }

  /**
   * Calculate safe maximum height for section
   * Returns remaining space from current Y to page bottom
   *
   * @param currentY - Current Y position
   * @returns Maximum safe height in mm (always >= 0)
   */
  static getMaxSectionHeight(currentY: number): number {
    const remainingHeight = CONTENT_AREA.y + CONTENT_AREA.height - currentY - Spacing['2xl'];
    return Math.max(0, remainingHeight);
  }

  /**
   * Calculate available height with custom bottom margin
   *
   * @param currentY - Current Y position
   * @param bottomMargin - Custom bottom margin (default: 2xl spacing)
   * @returns Available height in mm
   */
  static getAvailableHeight(currentY: number, bottomMargin: number = Spacing['2xl']): number {
    const remainingHeight = CONTENT_AREA.y + CONTENT_AREA.height - currentY - bottomMargin;
    return Math.max(0, remainingHeight);
  }

  /**
   * Track column height usage
   * Useful for multi-column layouts to ensure balance
   *
   * @param columnId - Unique column identifier (e.g., 'page6-left')
   * @param y - Current Y position
   * @param height - Height added to column
   */
  static trackColumnHeight(columnId: string, y: number, height: number): void {
    const currentHeight = this.columnHeights.get(columnId) || y;
    this.columnHeights.set(columnId, currentHeight + height);
  }

  /**
   * Get tracked column height
   *
   * @param columnId - Column identifier
   * @returns Current column height or 0 if not tracked
   */
  static getColumnHeight(columnId: string): number {
    return this.columnHeights.get(columnId) || 0;
  }

  /**
   * Reset column height tracking
   * Call at start of new page or when columns complete
   *
   * @param columnId - Optional specific column to reset, or all if not provided
   */
  static resetColumnHeight(columnId?: string): void {
    if (columnId) {
      this.columnHeights.delete(columnId);
    } else {
      this.columnHeights.clear();
    }
  }

  /**
   * Validate two-column balance
   * Warns if columns have significant height difference
   *
   * @param leftY - Left column bottom Y position
   * @param rightY - Right column bottom Y position
   * @param pageName - Page identifier for warnings
   * @param tolerance - Maximum acceptable difference in mm (default: 30mm)
   */
  static validateColumnBalance(
    leftY: number,
    rightY: number,
    pageName: string,
    tolerance: number = 30
  ): void {
    const diff = Math.abs(leftY - rightY);
    if (diff > tolerance) {
      console.warn(
        `[${pageName}] Column imbalance: ${diff.toFixed(1)}mm difference (left: ${leftY.toFixed(1)}mm, right: ${rightY.toFixed(1)}mm)`
      );
    }
  }

  /**
   * Warn if element would overflow (without throwing)
   * Useful for non-critical overflow detection
   *
   * @param y - Current Y position
   * @param height - Element height
   * @param pageName - Page identifier
   * @returns True if would overflow
   */
  static warnIfOverflow(y: number, height: number, pageName: string): boolean {
    const maxY = CONTENT_AREA.y + CONTENT_AREA.height - Spacing.xl;
    const elementBottom = y + height;

    if (elementBottom > maxY) {
      const overflow = elementBottom - maxY;
      console.warn(`[${pageName}] Potential overflow: ${overflow.toFixed(1)}mm beyond page boundary`);
      return true;
    }
    return false;
  }

  /**
   * Calculate proportional height adjustments to fit page
   * Scales section heights down if total exceeds available space
   *
   * @param sections - Array of sections with requested heights
   * @param currentY - Current Y position
   * @returns Adjusted heights that fit within page
   *
   * @example
   * ```typescript
   * const adjusted = LayoutValidator.adjustHeightsToFit([
   *   { name: 'features', requestedHeight: 80, minHeight: 60 },
   *   { name: 'charts', requestedHeight: 90, minHeight: 70 },
   *   { name: 'analysis', requestedHeight: 80, minHeight: 65 }
   * ], currentY);
   * ```
   */
  static adjustHeightsToFit(
    sections: Array<{ name: string; requestedHeight: number; minHeight: number }>,
    currentY: number
  ): Array<{ name: string; actualHeight: number }> {
    const totalRequested = sections.reduce((sum, s) => sum + s.requestedHeight, 0);
    const availableHeight = this.getMaxSectionHeight(currentY);

    if (totalRequested <= availableHeight) {
      return sections.map(s => ({ name: s.name, actualHeight: s.requestedHeight }));
    }

    // Scale down proportionally
    const scaleFactor = availableHeight / totalRequested;
    return sections.map(s => ({
      name: s.name,
      actualHeight: Math.max(s.minHeight, s.requestedHeight * scaleFactor)
    }));
  }

  /**
   * Truncate text lines to fit maximum height
   *
   * @param lines - Array of text lines
   * @param lineHeight - Height per line in mm
   * @param maxHeight - Maximum total height in mm
   * @returns Truncated lines array
   */
  static truncateTextToHeight(
    lines: string[],
    lineHeight: number,
    maxHeight: number
  ): string[] {
    const maxLines = Math.floor(maxHeight / lineHeight);
    return lines.slice(0, maxLines);
  }

  /**
   * Validate entire page layout before rendering
   * Comprehensive check for common layout issues
   *
   * @param pageName - Page identifier
   * @param totalHeight - Total content height
   * @param currentY - Starting Y position
   * @returns Validation result with warnings
   */
  static validatePageLayout(
    pageName: string,
    totalHeight: number,
    currentY: number = CONTENT_AREA.y
  ): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const maxHeight = CONTENT_AREA.height - Spacing['2xl'];
    const finalY = currentY + totalHeight;
    const maxY = CONTENT_AREA.y + CONTENT_AREA.height - Spacing.xl;

    if (totalHeight > maxHeight) {
      warnings.push(`Total content height (${totalHeight.toFixed(1)}mm) exceeds safe area (${maxHeight.toFixed(1)}mm)`);
    }

    if (finalY > maxY) {
      const overflow = finalY - maxY;
      warnings.push(`Content would overflow by ${overflow.toFixed(1)}mm`);
    }

    if (currentY < CONTENT_AREA.y) {
      warnings.push(`Starting Y position (${currentY.toFixed(1)}mm) is above content area`);
    }

    const valid = warnings.length === 0;
    if (!valid) {
      console.warn(`[${pageName}] Layout validation failed:`, warnings);
    }

    return { valid, warnings };
  }
}
