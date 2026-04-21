/**
 * Two-Column Layout Helper for PDF Pages
 * 
 * Manages positioning of elements in a two-column layout system.
 * Left column for charts/visuals, right column for stats/metrics.
 */

export interface ColumnConfig {
  leftColumnX: number;
  rightColumnX: number;
  columnWidth: number;
  gutter: number;
  contentWidth: number;
}

export const DEFAULT_COLUMN_CONFIG: ColumnConfig = {
  leftColumnX: 15,      // mm from left margin
  rightColumnX: 110,    // mm from left margin (15 + 85 + 10)
  columnWidth: 85,      // mm width of each column
  gutter: 10,           // mm space between columns
  contentWidth: 180,    // mm total content width (85 + 10 + 85)
};

export class TwoColumnLayout {
  private leftY: number;
  private rightY: number;
  private config: ColumnConfig;

  constructor(startY: number, config: ColumnConfig = DEFAULT_COLUMN_CONFIG) {
    this.leftY = startY;
    this.rightY = startY;
    this.config = config;
  }

  /**
   * Add element to left column and get its position
   * @param height Height of the element in mm
   * @param spacing Additional spacing after element (default 5mm)
   * @returns Position object with x, y coordinates
   */
  addToLeft(height: number, spacing: number = 5): { x: number; y: number } {
    const pos = { 
      x: this.config.leftColumnX, 
      y: this.leftY 
    };
    this.leftY += height + spacing;
    return pos;
  }

  /**
   * Add element to right column and get its position
   * @param height Height of the element in mm
   * @param spacing Additional spacing after element (default 5mm)
   * @returns Position object with x, y coordinates
   */
  addToRight(height: number, spacing: number = 5): { x: number; y: number } {
    const pos = { 
      x: this.config.rightColumnX, 
      y: this.rightY 
    };
    this.rightY += height + spacing;
    return pos;
  }

  /**
   * Get current Y position of left column
   */
  getLeftY(): number {
    return this.leftY;
  }

  /**
   * Get current Y position of right column
   */
  getRightY(): number {
    return this.rightY;
  }

  /**
   * Set left column Y position (useful for manual adjustments)
   */
  setLeftY(y: number): void {
    this.leftY = y;
  }

  /**
   * Set right column Y position (useful for manual adjustments)
   */
  setRightY(y: number): void {
    this.rightY = y;
  }

  /**
   * Reset both columns to same Y position
   */
  resetBothTo(y: number): void {
    this.leftY = y;
    this.rightY = y;
  }

  /**
   * Get the column configuration
   */
  getConfig(): ColumnConfig {
    return { ...this.config };
  }

  /**
   * Get column width
   */
  getColumnWidth(): number {
    return this.config.columnWidth;
  }

  /**
   * Check if left column has space for element of given height
   * @param height Required height in mm
   * @param maxY Maximum Y position (e.g., footer start)
   */
  hasLeftSpace(height: number, maxY: number = 254): boolean {
    return this.leftY + height <= maxY;
  }

  /**
   * Check if right column has space for element of given height
   * @param height Required height in mm
   * @param maxY Maximum Y position (e.g., footer start)
   */
  hasRightSpace(height: number, maxY: number = 254): boolean {
    return this.rightY + height <= maxY;
  }

  /**
   * Get remaining space in left column
   * @param maxY Maximum Y position (default 254mm before footer)
   */
  getLeftRemainingSpace(maxY: number = 254): number {
    return Math.max(0, maxY - this.leftY);
  }

  /**
   * Get remaining space in right column
   * @param maxY Maximum Y position (default 254mm before footer)
   */
  getRightRemainingSpace(maxY: number = 254): number {
    return Math.max(0, maxY - this.rightY);
  }

  /**
   * Balance columns by setting shorter column to match taller column
   */
  balance(): void {
    const maxY = Math.max(this.leftY, this.rightY);
    this.leftY = maxY;
    this.rightY = maxY;
  }

  /**
   * Add element spanning both columns (full width)
   * @param height Height of the element in mm
   * @param spacing Additional spacing after element (default 5mm)
   * @returns Position object with x, y coordinates (uses left column x)
   */
  addFullWidth(height: number, spacing: number = 5): { x: number; y: number; width: number } {
    // Balance columns first to ensure alignment
    this.balance();
    
    const pos = {
      x: this.config.leftColumnX,
      y: this.leftY,
      width: this.config.contentWidth
    };
    
    // Move both columns down
    this.leftY += height + spacing;
    this.rightY += height + spacing;
    
    return pos;
  }
}
