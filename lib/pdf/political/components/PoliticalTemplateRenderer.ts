/**
 * Political Template Renderer
 *
 * Template-based rendering system for political PDF reports.
 * Renders content using strict template definitions with automatic
 * text fitting, truncation, and precise positioning.
 *
 * Features:
 * - Exact template-based positioning
 * - Automatic text truncation and fitting
 * - Image/chart placement at precise dimensions
 * - KPI card grid rendering
 * - Table rendering
 *
 * @version 1.0.0
 * @lastUpdated 2025-12-10
 */

import jsPDF from 'jspdf';
import {
  type ElementTemplate,
  type ChartTemplate,
  type ImageTemplate,
  type TableTemplate,
  type KPICardTemplate,
  type PageTemplate,
  PAGE_DIMENSIONS,
  MARGINS,
  CONTENT_AREA,
  POLITICAL_COLORS,
  FONT_SPECS,
} from '../templates/PoliticalPageTemplates';
import { hexToRGB, formatDate } from '../utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TextAlign = 'left' | 'center' | 'right';

export interface RenderOptions {
  /** Truncate text to fit */
  truncate?: boolean;
  /** Text alignment */
  align?: TextAlign;
  /** Text color (hex) */
  color?: string;
  /** Font weight */
  fontWeight?: 'normal' | 'bold';
  /** Background color for highlighted text */
  backgroundColor?: string;
  /** Padding around background in mm */
  backgroundPadding?: number;
}

export interface PageData {
  /** Text content keyed by element ID */
  text: Record<string, string>;
  /** Image data (base64) keyed by image ID */
  images?: Record<string, string>;
  /** Chart data keyed by chart ID */
  charts?: Record<string, ChartDataPoint[]>;
  /** KPI card data keyed by card ID */
  kpiCards?: Record<string, KPICardData>;
  /** Table data keyed by table ID */
  tables?: Record<string, any[]>;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface KPICardData {
  label: string;
  value: string;
  trend?: string;
  backgroundColor?: string;
  textColor?: string;
  showScoreBar?: boolean;
  score?: number;
}

// ============================================================================
// POLITICAL TEMPLATE RENDERER CLASS
// ============================================================================

export class PoliticalTemplateRenderer {
  private pdf: jsPDF;
  private readonly PAGE_WIDTH = PAGE_DIMENSIONS.width;
  private readonly PAGE_HEIGHT = PAGE_DIMENSIONS.height;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
  }

  // --------------------------------------------------------------------------
  // VALIDATION
  // --------------------------------------------------------------------------

  /**
   * Validate element bounds are within page area
   */
  private validateBounds(template: { x: number; y: number; width: number; height: number }): void {
    const endX = template.x + template.width;
    const endY = template.y + template.height;

    if (template.x < 0 || template.y < 0) {
      console.warn(`[PoliticalTemplateRenderer] Element starts at negative position: (${template.x}, ${template.y})`);
    }

    if (endX > this.PAGE_WIDTH) {
      console.warn(`[PoliticalTemplateRenderer] Element extends beyond page width: ${endX}mm > ${this.PAGE_WIDTH}mm`);
    }

    if (endY > this.PAGE_HEIGHT) {
      console.warn(`[PoliticalTemplateRenderer] Element extends beyond page height: ${endY}mm > ${this.PAGE_HEIGHT}mm`);
    }
  }

  // --------------------------------------------------------------------------
  // TEXT RENDERING
  // --------------------------------------------------------------------------

  /**
   * Render text exactly within template bounds
   */
  renderText(
    elementTemplate: ElementTemplate,
    text: string,
    options: RenderOptions = {}
  ): void {
    if (!text) return;

    const {
      truncate = true,
      align = elementTemplate.align || 'left',
      color = elementTemplate.color || POLITICAL_COLORS.textPrimary,
      fontWeight = elementTemplate.fontWeight || 'normal',
      backgroundColor,
      backgroundPadding = 1,
    } = options;

    // Validate bounds
    this.validateBounds(elementTemplate);

    // Draw background if specified
    if (backgroundColor) {
      const rgb = hexToRGB(backgroundColor);
      this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      this.pdf.rect(
        elementTemplate.x - backgroundPadding,
        elementTemplate.y - backgroundPadding,
        elementTemplate.width + backgroundPadding * 2,
        elementTemplate.height + backgroundPadding * 2,
        'F'
      );
    }

    // Set font properties
    const fontSize = elementTemplate.fontSize || FONT_SPECS.sizes.body;
    this.pdf.setFontSize(fontSize);
    this.pdf.setFont(FONT_SPECS.family, fontWeight);

    const rgb = hexToRGB(color);
    this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);

    // Calculate line metrics
    const lineHeight = FONT_SPECS.lineHeight[fontSize as keyof typeof FONT_SPECS.lineHeight] || fontSize * 0.5;
    const maxLines = elementTemplate.maxLines || Math.ceil(elementTemplate.height / lineHeight);

    // Split text into lines
    const lines = this.fitTextToWidth(text, elementTemplate.width, truncate);

    // Truncate to max lines
    let finalLines = lines.slice(0, maxLines);
    if (lines.length > maxLines && truncate) {
      // Add ellipsis to last line
      finalLines[finalLines.length - 1] = this.truncateWithEllipsis(
        finalLines[finalLines.length - 1],
        elementTemplate.width
      );
    }

    // Render each line
    finalLines.forEach((line, index) => {
      const x = this.calculateAlignedX(elementTemplate.x, elementTemplate.width, line, align);
      const y = elementTemplate.y + index * lineHeight + fontSize * 0.35; // Baseline offset

      this.pdf.text(line, x, y);
    });

    // Reset text color
    this.pdf.setTextColor(0, 0, 0);
  }

  /**
   * Fit text to width, splitting into lines
   */
  private fitTextToWidth(text: string, widthMm: number, truncate: boolean): string[] {
    // Use jsPDF's built-in text splitting
    const lines = this.pdf.splitTextToSize(text, widthMm);
    return lines;
  }

  /**
   * Truncate text with ellipsis to fit width
   */
  private truncateWithEllipsis(text: string, widthMm: number): string {
    const ellipsis = '…';
    let truncated = text;

    // Check if text fits
    const textWidth = this.pdf.getTextWidth(text);
    if (textWidth <= widthMm) {
      return text;
    }

    // Binary search for fitting length
    let low = 0;
    let high = text.length;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      const testText = text.substring(0, mid) + ellipsis;
      const testWidth = this.pdf.getTextWidth(testText);

      if (testWidth <= widthMm) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    truncated = text.substring(0, low) + ellipsis;
    return truncated;
  }

  /**
   * Calculate X position for text alignment
   */
  private calculateAlignedX(
    startX: number,
    width: number,
    text: string,
    align: TextAlign
  ): number {
    if (align === 'center') {
      const textWidth = this.pdf.getTextWidth(text);
      return startX + (width - textWidth) / 2;
    } else if (align === 'right') {
      const textWidth = this.pdf.getTextWidth(text);
      return startX + width - textWidth;
    }
    return startX;
  }

  // --------------------------------------------------------------------------
  // BULLET LIST RENDERING
  // --------------------------------------------------------------------------

  /**
   * Render a bullet list within template bounds
   */
  renderBulletList(
    elementTemplate: ElementTemplate,
    items: string[],
    options: RenderOptions = {}
  ): void {
    if (!items || items.length === 0) return;

    const {
      color = elementTemplate.color || POLITICAL_COLORS.textPrimary,
      fontWeight = elementTemplate.fontWeight || 'normal',
    } = options;

    const fontSize = elementTemplate.fontSize || FONT_SPECS.sizes.body;
    const lineHeight = FONT_SPECS.lineHeight[fontSize as keyof typeof FONT_SPECS.lineHeight] || fontSize * 0.5;
    const bulletIndent = 4; // mm
    const bulletChar = '•';

    this.pdf.setFontSize(fontSize);
    this.pdf.setFont(FONT_SPECS.family, fontWeight);

    const rgb = hexToRGB(color);
    this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);

    let currentY = elementTemplate.y + fontSize * 0.35;
    const maxY = elementTemplate.y + elementTemplate.height;

    for (const item of items) {
      if (currentY > maxY - lineHeight) break;

      // Draw bullet
      this.pdf.text(bulletChar, elementTemplate.x, currentY);

      // Draw text (may wrap)
      const textLines = this.pdf.splitTextToSize(item, elementTemplate.width - bulletIndent - 2);

      for (const line of textLines) {
        if (currentY > maxY - lineHeight) break;
        this.pdf.text(line, elementTemplate.x + bulletIndent, currentY);
        currentY += lineHeight;
      }
    }

    // Reset text color
    this.pdf.setTextColor(0, 0, 0);
  }

  // --------------------------------------------------------------------------
  // IMAGE RENDERING
  // --------------------------------------------------------------------------

  /**
   * Render image at exact template position
   */
  renderImage(
    imageTemplate: ImageTemplate,
    imageData: string,
    format: 'PNG' | 'JPEG' = 'PNG'
  ): void {
    if (!imageData) return;

    this.validateBounds(imageTemplate);

    try {
      this.pdf.addImage(
        imageData,
        format,
        imageTemplate.x,
        imageTemplate.y,
        imageTemplate.width,
        imageTemplate.height
      );
    } catch (error) {
      console.error(`[PoliticalTemplateRenderer] Failed to render image:`, error);
    }
  }

  // --------------------------------------------------------------------------
  // RECTANGLE AND SHAPE RENDERING
  // --------------------------------------------------------------------------

  /**
   * Draw a filled rectangle
   */
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: string,
    borderColor?: string,
    borderWidth: number = 0.2
  ): void {
    const fillRGB = hexToRGB(fillColor);
    this.pdf.setFillColor(fillRGB.r, fillRGB.g, fillRGB.b);
    this.pdf.rect(x, y, width, height, 'F');

    if (borderColor) {
      const borderRGB = hexToRGB(borderColor);
      this.pdf.setDrawColor(borderRGB.r, borderRGB.g, borderRGB.b);
      this.pdf.setLineWidth(borderWidth);
      this.pdf.rect(x, y, width, height, 'S');
    }
  }

  /**
   * Draw a horizontal line
   */
  drawLine(x1: number, y1: number, x2: number, y2: number, color: string = POLITICAL_COLORS.border, width: number = 0.3): void {
    const rgb = hexToRGB(color);
    this.pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
    this.pdf.setLineWidth(width);
    this.pdf.line(x1, y1, x2, y2);
  }

  // --------------------------------------------------------------------------
  // SCORE BAR RENDERING
  // --------------------------------------------------------------------------

  /**
   * Render a horizontal score bar (0-100)
   */
  renderScoreBar(
    x: number,
    y: number,
    width: number,
    height: number,
    score: number,
    fillColor: string = POLITICAL_COLORS.accent,
    bgColor: string = POLITICAL_COLORS.border
  ): void {
    // Background bar
    const bgRGB = hexToRGB(bgColor);
    this.pdf.setFillColor(bgRGB.r, bgRGB.g, bgRGB.b);
    this.pdf.rect(x, y, width, height, 'F');

    // Score fill
    const fillRGB = hexToRGB(fillColor);
    this.pdf.setFillColor(fillRGB.r, fillRGB.g, fillRGB.b);
    const fillWidth = Math.max(0, Math.min(100, score)) / 100 * width;
    this.pdf.rect(x, y, fillWidth, height, 'F');
  }

  /**
   * Render a partisan lean bar (D to R spectrum)
   */
  renderPartisanBar(
    x: number,
    y: number,
    width: number,
    height: number,
    lean: number // -100 to +100
  ): void {
    const centerX = x + width / 2;

    // Background gradient simulation (D side, center, R side)
    const segmentWidth = width / 3;

    // Democrat side (left)
    const dRGB = hexToRGB(POLITICAL_COLORS.democrat);
    this.pdf.setFillColor(dRGB.r, dRGB.g, dRGB.b);
    this.pdf.rect(x, y, segmentWidth, height, 'F');

    // Toss-up center
    const cRGB = hexToRGB(POLITICAL_COLORS.tossup);
    this.pdf.setFillColor(cRGB.r, cRGB.g, cRGB.b);
    this.pdf.rect(x + segmentWidth, y, segmentWidth, height, 'F');

    // Republican side (right)
    const rRGB = hexToRGB(POLITICAL_COLORS.republican);
    this.pdf.setFillColor(rRGB.r, rRGB.g, rRGB.b);
    this.pdf.rect(x + segmentWidth * 2, y, segmentWidth, height, 'F');

    // Position marker
    const normalizedLean = (lean + 100) / 200; // 0 to 1
    const markerX = x + normalizedLean * width;

    // Draw marker (triangle)
    this.pdf.setFillColor(255, 255, 255);
    this.pdf.triangle(
      markerX, y,
      markerX - 2, y - 3,
      markerX + 2, y - 3,
      'F'
    );
  }

  // --------------------------------------------------------------------------
  // HEADER AND FOOTER
  // --------------------------------------------------------------------------

  /**
   * Render standard page header
   */
  renderPageHeader(
    pageNumber: number,
    pageTitle: string,
    showLogo: boolean = true,
    logoData?: string
  ): void {
    // Header separator line
    this.drawLine(MARGINS.left, 25, PAGE_DIMENSIONS.width - MARGINS.right, 25);

    // Logo (if provided)
    if (showLogo && logoData) {
      this.pdf.addImage(logoData, 'PNG', MARGINS.left, MARGINS.top, 40, 12);
    }

    // Page number (top right)
    this.pdf.setFontSize(8);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    const rgb = hexToRGB(POLITICAL_COLORS.textMuted);
    this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    this.pdf.text(`Page ${pageNumber}`, PAGE_DIMENSIONS.width - MARGINS.right, MARGINS.top + 4, { align: 'right' });

    // Reset
    this.pdf.setTextColor(0, 0, 0);
  }

  /**
   * Render standard page footer
   */
  renderPageFooter(reportName: string = 'Political Analysis Report'): void {
    const footerY = PAGE_DIMENSIONS.height - MARGINS.bottom + 5;

    // Footer separator line
    this.drawLine(MARGINS.left, footerY - 3, PAGE_DIMENSIONS.width - MARGINS.right, footerY - 3);

    // Footer text
    this.pdf.setFontSize(7);
    this.pdf.setFont(FONT_SPECS.family, 'normal');
    const rgb = hexToRGB(POLITICAL_COLORS.textMuted);
    this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);

    // Left: Report name
    this.pdf.text(reportName, MARGINS.left, footerY);

    // Center: Generated date
    const date = formatDate(undefined, 'medium');
    this.pdf.text(`Generated ${date}`, PAGE_DIMENSIONS.width / 2, footerY, { align: 'center' });

    // Right: Platform name
    this.pdf.text('Political Analysis Platform', PAGE_DIMENSIONS.width - MARGINS.right, footerY, { align: 'right' });

    // Reset
    this.pdf.setTextColor(0, 0, 0);
  }

  // --------------------------------------------------------------------------
  // FULL PAGE RENDERING
  // --------------------------------------------------------------------------

  /**
   * Render a complete page from template and data
   */
  renderPage(template: PageTemplate, data: PageData): void {
    // Render text elements
    for (const [elementId, elementTemplate] of Object.entries(template.elements)) {
      const text = data.text[elementId];
      if (text) {
        this.renderText(elementTemplate, text);
      }
    }

    // Render images
    if (template.images && data.images) {
      for (const [imageId, imageTemplate] of Object.entries(template.images)) {
        const imageData = data.images[imageId];
        if (imageData) {
          this.renderImage(imageTemplate, imageData);
        }
      }
    }

    // Note: KPI cards and tables should be rendered using their respective components
    // (PoliticalKPICard and PoliticalTableRenderer) as they have complex logic
  }

  // --------------------------------------------------------------------------
  // UTILITY METHODS
  // --------------------------------------------------------------------------

  /**
   * Get the jsPDF instance
   */
  getPdf(): jsPDF {
    return this.pdf;
  }

  /**
   * Add a new page
   */
  addPage(): void {
    this.pdf.addPage();
  }

  /**
   * Save PDF and return as blob
   */
  async save(): Promise<Blob> {
    return this.pdf.output('blob');
  }

  /**
   * Save PDF and return as data URL
   */
  saveAsDataUrl(): string {
    return this.pdf.output('dataurlstring');
  }
}

/**
 * Create a new PoliticalTemplateRenderer instance
 */
export function createPoliticalRenderer(): PoliticalTemplateRenderer {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAGE_DIMENSIONS.width, PAGE_DIMENSIONS.height],
  });

  return new PoliticalTemplateRenderer(pdf);
}
