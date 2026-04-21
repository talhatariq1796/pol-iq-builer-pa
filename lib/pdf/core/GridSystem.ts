/**
 * 12-Column Grid System for CMA PDF Layout
 * Provides consistent positioning and spacing across all pages
 *
 * Grid Specifications:
 * - 12 columns @ 15.83mm each
 * - 5mm gutters between columns
 * - 20 rows @ 12.85mm each
 * - 20mm page margins
 */
export class GridSystem {
  readonly columns = 12;
  readonly columnWidth = 15.83; // mm
  readonly gutterWidth = 5; // mm
  readonly rows = 20;
  readonly rowHeight = 12.85; // mm
  readonly pageMargin = 20; // mm

  /**
   * Get X coordinate for a column (1-indexed)
   * @param col - Column number (1-12)
   * @returns X coordinate in mm
   */
  getColumnX(col: number): number {
    if (col < 1 || col > this.columns) {
      throw new Error(`Column must be between 1 and ${this.columns}`);
    }
    return this.pageMargin + ((col - 1) * (this.columnWidth + this.gutterWidth));
  }

  /**
   * Get width for spanning multiple columns
   * @param spanCols - Number of columns to span
   * @returns Width in mm
   */
  getWidth(spanCols: number): number {
    if (spanCols < 1 || spanCols > this.columns) {
      throw new Error(`Span must be between 1 and ${this.columns}`);
    }
    return (spanCols * this.columnWidth) + ((spanCols - 1) * this.gutterWidth);
  }

  /**
   * Get Y coordinate for a row (1-indexed)
   * @param row - Row number (1-20)
   * @returns Y coordinate in mm
   */
  getRowY(row: number): number {
    if (row < 1 || row > this.rows) {
      throw new Error(`Row must be between 1 and ${this.rows}`);
    }
    return this.pageMargin + ((row - 1) * this.rowHeight);
  }

  /**
   * Get height for spanning multiple rows
   * @param spanRows - Number of rows to span
   * @returns Height in mm
   */
  getHeight(spanRows: number): number {
    if (spanRows < 1 || spanRows > this.rows) {
      throw new Error(`Row span must be between 1 and ${this.rows}`);
    }
    return spanRows * this.rowHeight;
  }

  /**
   * Get full content area width
   * @returns Total width of all 12 columns with gutters in mm
   */
  getContentWidth(): number {
    return this.getWidth(this.columns);
  }

  /**
   * Get full content area height
   * @returns Total height of all 20 rows in mm
   */
  getContentHeight(): number {
    return this.getHeight(this.rows);
  }
}
