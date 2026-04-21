/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/**
 * Template-Based Rendering System
 *
 * Provides strict template-driven rendering with exact positioning,
 * text fitting, and chart placement within predefined bounds.
 *
 * Features:
 * - Exact template-based positioning
 * - Automatic text truncation and fitting
 * - Chart rendering at precise dimensions
 * - Validation and error handling
 */

import jsPDF from 'jspdf';
// ChartJSRenderer disabled - charts provided via chartImages config
// import { ChartJSRenderer } from '../renderers/ChartJSRenderer';
import {
  GLOBAL_CONSTRAINTS,
  validateSectionHeight,
  calculatePageHeight,
} from '../utils/PageHeightConstraints';

/**
 * Base template for all rendered elements
 */
export interface ElementTemplate {
  x: number;           // X position in mm
  y: number;           // Y position in mm
  width: number;       // Width in mm
  height: number;      // Height in mm
  fontSize?: number;   // Font size in pt
  maxChars?: number;   // Maximum characters per line
  maxLines?: number;   // Maximum number of lines
  lineHeight?: number; // Line height multiplier (default: 1.2)
  color?: string;      // Text color (hex)
  fontWeight?: 'normal' | 'bold'; // Font weight
  align?: TextAlign;   // Text alignment
  backgroundColor?: string; // Background color (hex) for highlighted text
  backgroundPadding?: number; // Padding around background in mm
}

/**
 * Chart template with specific type and styling
 */
export interface ChartTemplate extends ElementTemplate {
  type: 'bar' | 'line' | 'donut' | 'pie' | 'scatter';
  title?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
}

/**
 * Image template for photos, logos, icons, charts
 */
export interface ImageTemplate {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'photo' | 'logo' | 'icon' | 'map' | 'chart' | 'line' | 'bar' | 'donut' | 'pie' | 'scatter' | 'gauge';
  aspectRatio?: number;
}

/**
 * Page template containing all elements for a page
 */
export interface PageTemplate {
  pageNumber: number;
  pageHeight?: number;
  title?: string;
  elements: {
    [key: string]: ElementTemplate | ChartTemplate;
  };
  charts?: {
    [key: string]: ChartTemplate;
  };
  images?: {
    [key: string]: ImageTemplate;
  };
}

/**
 * Text alignment options
 */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * Template-based rendering options
 */
export interface RenderOptions {
  truncate?: boolean;
  align?: TextAlign;
  color?: string;
  fontWeight?: 'normal' | 'bold';
  backgroundColor?: string; // Hex color for background rectangle
  backgroundPadding?: number; // Padding around text in mm (default: 1)
}

/**
 * Chart data point for rendering
 */
export interface ChartDataPoint {
  label: string;
  value: number;
}

/**
 * Template-Based Renderer
 *
 * Renders content using strict template definitions with automatic
 * text fitting, truncation, and precise positioning.
 */
export class TemplateRenderer {
  private pdf: jsPDF;
  private readonly PAGE_WIDTH = 210; // A4 width in mm
  private readonly PAGE_HEIGHT = 297; // A4 height in mm
  private currentPageSections: Array<{ name: string; height: number }> = [];

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
  }

  /**
   * Reset page section tracking (call at start of each page)
   */
  private resetPageTracking(): void {
    this.currentPageSections = [];
  }

  /**
   * Track a rendered section for height validation
   */
  private trackSection(name: string, height: number): void {
    this.currentPageSections.push({ name, height });
  }

  /**
   * Validate total page height doesn't exceed limits
   */
  private validatePageHeight(pageNumber: number): void {
    const result = calculatePageHeight(this.currentPageSections);

    if (!result.withinLimits) {
      console.error(
        `[TemplateRenderer] Page ${pageNumber} OVERFLOW: ` +
        `Total height ${result.totalHeight.toFixed(2)}mm exceeds ` +
        `limit ${GLOBAL_CONSTRAINTS.CONTENT_MAX_HEIGHT}mm ` +
        `(overflow: ${result.overflow.toFixed(2)}mm)`
      );
    } else if (result.totalHeight > GLOBAL_CONSTRAINTS.WARNING_THRESHOLD) {
      console.warn(
        `[TemplateRenderer] Page ${pageNumber} approaching limit: ` +
        `${result.totalHeight.toFixed(2)}mm / ${GLOBAL_CONSTRAINTS.CONTENT_MAX_HEIGHT}mm used`
      );
    }
  }

  /**
   * Render text exactly within template bounds
   *
   * @param elementTemplate - Template defining position and constraints
   * @param text - Text content to render
   * @param options - Rendering options (truncate, align, color, etc.)
   * @throws Error if text doesn't fit even after truncation
   */
  renderText(
    elementTemplate: ElementTemplate,
    text: string,
    options: RenderOptions = {}
  ): void {
    const {
      truncate = true,
      align = elementTemplate.align || 'left',
      color = elementTemplate.color || '#2C2C2C',
      fontWeight = elementTemplate.fontWeight || 'normal',
      backgroundColor = elementTemplate.backgroundColor,
      backgroundPadding = elementTemplate.backgroundPadding || 1,
    } = options;

    // Validate template is within page bounds
    this.validateBounds(elementTemplate);

    // Draw background rectangle if backgroundColor is provided
    if (backgroundColor) {
      // Convert hex color to RGB
      const rgb = this.hexToRgb(backgroundColor);
      this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      
      // Draw background with padding
      this.pdf.rect(
        elementTemplate.x - backgroundPadding,
        elementTemplate.y - backgroundPadding,
        elementTemplate.width + (backgroundPadding * 2),
        elementTemplate.height + (backgroundPadding * 2),
        'F'
      );
    }

    // Set font properties
    const fontSize = elementTemplate.fontSize || 10;
    this.pdf.setFontSize(fontSize);
    this.pdf.setFont('helvetica', fontWeight);
    this.pdf.setTextColor(color);

    // Calculate line height
    const lineHeight = (elementTemplate.lineHeight || 1.2) * fontSize * 0.352778; // pt to mm
    // Use ceil instead of floor to maximize available lines
    const maxLines = elementTemplate.maxLines || Math.ceil(elementTemplate.height / lineHeight);

    // Split text into lines
    const lines = this.fitTextToWidth(
      text,
      elementTemplate.width,
      elementTemplate.maxChars,
      truncate
    );

    // Check for overflow before truncation
    if (lines.length > maxLines) {
      const actualHeight = lines.length * lineHeight;
      console.warn(
        `[TemplateRenderer] Text overflow: ${lines.length} lines (${actualHeight.toFixed(2)}mm) ` +
        `exceeds ${maxLines} max lines (${elementTemplate.height.toFixed(2)}mm) at y=${elementTemplate.y}mm. ` +
        `${truncate ? 'Truncating...' : 'ERROR'}`
      );
    }

    // Truncate to max lines if needed
    let finalLines = lines.slice(0, maxLines);
    if (lines.length > maxLines && truncate) {
      // Add ellipsis to last line
      const lastLine = finalLines[finalLines.length - 1];
      finalLines[finalLines.length - 1] = this.truncateWithEllipsis(
        lastLine,
        elementTemplate.width
      );
    } else if (lines.length > maxLines && !truncate) {
      throw new Error(
        `Text exceeds maximum lines (${lines.length} > ${maxLines}) and truncation is disabled`
      );
    }

    // Render each line with alignment
    finalLines.forEach((line, index) => {
      const x = this.calculateAlignedX(
        elementTemplate.x,
        elementTemplate.width,
        line,
        align
      );
      const y = elementTemplate.y + (index * lineHeight) + (fontSize * 0.352778); // baseline offset

      this.pdf.text(line, x, y);
    });

    // Track rendered height
    const renderedHeight = finalLines.length * lineHeight;
    this.trackSection(`text@y${elementTemplate.y}`, renderedHeight);
  }

  /**
   * Render chart at exact template position
   *
   * @param chartTemplate - Template defining chart position and properties
   * @param chartData - Data points for the chart
   * @throws Error if chart dimensions are too small
   */
  async renderChart(
    chartTemplate: ChartTemplate,
    chartData: ChartDataPoint[]
  ): Promise<void> {
    // Validate template is within page bounds
    this.validateBounds(chartTemplate);

    // Validate chart dimensions for readability
    const MIN_CHART_WIDTH = 40; // mm
    const MIN_CHART_HEIGHT = 30; // mm

    if (chartTemplate.width < MIN_CHART_WIDTH || chartTemplate.height < MIN_CHART_HEIGHT) {
      console.warn(
        `Chart dimensions (${chartTemplate.width}x${chartTemplate.height}mm) may be too small for readability. ` +
        `Minimum recommended: ${MIN_CHART_WIDTH}x${MIN_CHART_HEIGHT}mm`
      );
    }

    // Convert mm to pixels for Chart.js (assuming 96 DPI)
    const widthPx = Math.round(chartTemplate.width * 3.7795275591);
    const heightPx = Math.round(chartTemplate.height * 3.7795275591);

    // Generate chart image
    const chartOptions = {
      width: widthPx,
      height: heightPx,
      title: chartTemplate.title,
      showLegend: chartTemplate.showLegend,
      showGrid: chartTemplate.showGrid,
      yAxisLabel: chartTemplate.yAxisLabel,
      xAxisLabel: chartTemplate.xAxisLabel,
    };

    // Chart generation disabled - charts must be provided via chartImages config
    // ChartJSRenderer requires @napi-rs/canvas which doesn't work on Vercel
    throw new Error(
      `Dynamic chart generation not available. ` +
      `Please provide pre-rendered chart images via chartImages config. ` +
      `Chart type: ${chartTemplate.type}, Position: ${chartTemplate.x},${chartTemplate.y}`
    );

    // This method should not be called - charts come from chartImages config
    // Original dynamic chart generation code has been disabled for Vercel compatibility
  }

  /**
   * Render image at specified template position
   * Supports base64 encoded images, URLs, and raw image data
   * 
   * @param imageTemplate - Template defining image position and properties
   * @param imageData - Base64 string, URL, or image data
   */
  renderImage(
    imageTemplate: ImageTemplate,
    imageData: string
  ): void {
    // Validate template is within page bounds
    this.validateBounds(imageTemplate);

    if (!imageData || imageData === '') {
      console.warn(`[TemplateRenderer] No image data provided for image at ${imageTemplate.x},${imageTemplate.y}`);
      // Draw placeholder for missing images (especially maps)
      this.drawImagePlaceholder(imageTemplate);
      return;
    }

    try {
      // Handle different image data formats
      let imageFormat = 'PNG';
      let imageSource = imageData;

      // Detect format from data
      if (imageData.startsWith('data:image/jpeg') || imageData.startsWith('data:image/jpg')) {
        imageFormat = 'JPEG';
        imageSource = imageData.split(',')[1] || imageData;
      } else if (imageData.startsWith('data:image/png')) {
        imageFormat = 'PNG';
        imageSource = imageData.split(',')[1] || imageData;
      } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        console.warn(`[TemplateRenderer] URL images not supported in PDF generation. Skipping image at ${imageTemplate.x},${imageTemplate.y}`);
        this.drawImagePlaceholder(imageTemplate);
        return;
      }

      // PHASE 1.2 (v3): Maintain original image aspect ratio when rendering
      // Get the actual image dimensions from the base64 data
      let finalX = imageTemplate.x;
      let finalY = imageTemplate.y;
      let finalWidth = imageTemplate.width;
      let finalHeight = imageTemplate.height;
      
      // For all images (especially charts), maintain aspect ratio
      try {
        // Get image properties from jsPDF
        const imgProps = this.pdf.getImageProperties(imageSource);
        const imageAspectRatio = imgProps.width / imgProps.height;
        const templateAspectRatio = imageTemplate.width / imageTemplate.height;
        
        // Fit image within template bounds while maintaining its aspect ratio
        if (imageAspectRatio > templateAspectRatio) {
          // Image is wider than template space - fit to width
          finalWidth = imageTemplate.width;
          finalHeight = imageTemplate.width / imageAspectRatio;
          // Center vertically within template space
          finalY = imageTemplate.y + (imageTemplate.height - finalHeight) / 2;
        } else {
          // Image is taller than template space - fit to height
          finalHeight = imageTemplate.height;
          finalWidth = imageTemplate.height * imageAspectRatio;
          // Center horizontally within template space
          finalX = imageTemplate.x + (imageTemplate.width - finalWidth) / 2;
        }
        
        console.log(`[TemplateRenderer] Image fitted: original ${imgProps.width}x${imgProps.height}px (${imageAspectRatio.toFixed(2)}:1) → ${finalWidth.toFixed(1)}x${finalHeight.toFixed(1)}mm in template ${imageTemplate.width}x${imageTemplate.height}mm`);
      } catch (error) {
        // If we can't get image properties, use template dimensions as-is
        console.warn(`[TemplateRenderer] Could not get image properties, using template dimensions:`, error);
      }

      // Add image to PDF with calculated dimensions
      this.pdf.addImage(
        imageSource,
        imageFormat,
        finalX,
        finalY,
        finalWidth,
        finalHeight,
        undefined, // alias
        'FAST' // compression
      );

      console.log(`[TemplateRenderer] Rendered ${imageTemplate.type || 'image'} at (${imageTemplate.x},${imageTemplate.y}), size: ${imageTemplate.width}x${imageTemplate.height}mm`);

    } catch (error) {
      console.error(`[TemplateRenderer] Failed to render image at ${imageTemplate.x},${imageTemplate.y}:`, error);
      // Draw placeholder rectangle to show where image should be
      this.drawImagePlaceholder(imageTemplate);
    }
  }

  /**
   * Draw a placeholder for missing images
   * Shows bordered box with descriptive text
   */
  private drawImagePlaceholder(imageTemplate: ImageTemplate): void {
    // Draw light gray background
    this.pdf.setFillColor(245, 245, 245);
    this.pdf.rect(imageTemplate.x, imageTemplate.y, imageTemplate.width, imageTemplate.height, 'F');
    
    // Draw border
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.setLineWidth(0.5);
    this.pdf.rect(imageTemplate.x, imageTemplate.y, imageTemplate.width, imageTemplate.height, 'S');
    
    // Add text label
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(10);
    this.pdf.setTextColor(150, 150, 150);
    
    const placeholderText = imageTemplate.type === 'map' 
      ? 'Area Map' 
      : imageTemplate.type === 'logo'
      ? 'Logo'
      : 'Image';
    
    const textWidth = this.pdf.getTextWidth(placeholderText);
    const centerX = imageTemplate.x + (imageTemplate.width - textWidth) / 2;
    const centerY = imageTemplate.y + imageTemplate.height / 2;
    
    this.pdf.text(placeholderText, centerX, centerY);
  }

  /**
   * Render entire page from template
   *
   * @param pageTemplate - Template defining all page elements
   * @param data - Data object with values for each template element
   */
  async renderPage(pageTemplate: PageTemplate, data: Record<string, any>): Promise<void> {
    // Reset tracking for new page
    this.resetPageTracking();

    console.log(`[TemplateRenderer] Rendering page ${pageTemplate.pageNumber}`);

    // Step 1: Render images first (backgrounds, photos, logos)
    if (pageTemplate.images) {
      console.log(`[TemplateRenderer] Rendering ${Object.keys(pageTemplate.images).length} images...`);
      for (const [key, imageTemplate] of Object.entries(pageTemplate.images)) {
        const imageData = data[key];
        if (imageData) {
          this.renderImage(imageTemplate, imageData);
        } else {
          console.warn(`[TemplateRenderer] No image data for: ${key}`);
        }
      }
    }

    // Step 2: Render charts (if any chart images are provided)
    if (pageTemplate.charts) {
      console.log(`[TemplateRenderer] Processing ${Object.keys(pageTemplate.charts).length} charts...`);
      // IMPORTANT: Iterate using template keys, not Object.entries which has unreliable order
      for (const key of Object.keys(pageTemplate.charts)) {
        const chartTemplate = pageTemplate.charts[key];
        const chartData = data[key];
        if (chartData) {
          // If chartData is a base64 image string, render it as an image
          if (typeof chartData === 'string' && (chartData.startsWith('data:image/') || chartData.length > 100)) {
            // Cast chartTemplate to ImageTemplate for rendering
            // PHASE 1.2 FIX: Pass through the original chart type so aspect ratio can be maintained
            const imageTemplate: ImageTemplate = {
              x: chartTemplate.x,
              y: chartTemplate.y,
              width: chartTemplate.width,
              height: chartTemplate.height,
              type: chartTemplate.type || 'chart' // Use original chart type (line, bar, donut, etc.)
            };
            this.renderImage(imageTemplate, chartData);
          } else {
            // Otherwise try the legacy chart rendering (will throw error about canvas)
            console.warn(`[TemplateRenderer] Chart '${key}' needs pre-rendered image. Skipping dynamic generation.`);
          }
        } else {
          console.warn(`[TemplateRenderer] No chart data for: ${key}`);
        }
      }
    }

    // Step 3: Render text elements (on top of images/charts)
    for (const [key, template] of Object.entries(pageTemplate.elements)) {
      const elementData = data[key];

      if (!elementData) {
        // Skip warning for optional elements
        if (!key.startsWith('ai') && !key.includes('Optional')) {
          console.warn(`[TemplateRenderer] No data provided for template element: ${key}`);
        }
        continue;
      }

      // Check if this is a chart template
      if (this.isChartTemplate(template)) {
        await this.renderChart(template as ChartTemplate, elementData);
      } else {
        // Check if elementData includes styling information (object with 'text' and 'style' properties)
        if (typeof elementData === 'object' && 'text' in elementData) {
          const { text, style } = elementData as { text: string; style?: RenderOptions };
          this.renderText(template, text, style || {});
        } else {
          // Render as plain text
          const text = typeof elementData === 'string' ? elementData : String(elementData);
          this.renderText(template, text);
        }
      }
    }

    // Validate total page height
    this.validatePageHeight(pageTemplate.pageNumber);
  }

  /**
   * Fit text to width by splitting into lines
   *
   * @param text - Text to fit
   * @param maxWidth - Maximum width in mm
   * @param maxChars - Maximum characters per line (optional)
   * @param truncate - Whether to truncate if text doesn't fit
   * @returns Array of text lines
   */
  private fitTextToWidth(
    text: string,
    maxWidth: number,
    maxChars?: number,
    truncate: boolean = true
  ): string[] {
    const lines: string[] = [];
    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = this.pdf.getTextWidth(testLine);

      // Check both width and character constraints
      const exceedsWidth = testWidth > maxWidth;
      const exceedsChars = maxChars && testLine.length > maxChars;

      if (exceedsWidth || exceedsChars) {
        if (!currentLine) {
          // Single word exceeds limits
          if (truncate) {
            lines.push(this.truncateWithEllipsis(word, maxWidth));
            currentLine = '';
          } else {
            throw new Error(`Word "${word}" exceeds maximum width and truncation is disabled`);
          }
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Truncate text with ellipsis to fit width
   *
   * @param text - Text to truncate
   * @param maxWidth - Maximum width in mm
   * @returns Truncated text with ellipsis
   */
  private truncateWithEllipsis(text: string, maxWidth: number): string {
    const ellipsis = '...';
    let truncated = text;

    while (this.pdf.getTextWidth(truncated + ellipsis) > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }

    return truncated + ellipsis;
  }

  /**
   * Calculate X position for aligned text
   *
   * @param baseX - Base X position from template
   * @param width - Width of text area
   * @param text - Text to align
   * @param align - Alignment type
   * @returns Calculated X position
   */
  private calculateAlignedX(
    baseX: number,
    width: number,
    text: string,
    align: TextAlign
  ): number {
    switch (align) {
      case 'center':
        return baseX + (width - this.pdf.getTextWidth(text)) / 2;
      case 'right':
        return baseX + width - this.pdf.getTextWidth(text);
      case 'left':
      default:
        return baseX;
    }
  }

  /**
   * Validate that element is within page bounds
   *
   * @param template - Element template to validate
   * @throws Error if element exceeds page bounds
   */
  private validateBounds(template: ElementTemplate): void {
    if (template.x < 0 || template.y < 0) {
      throw new Error(
        `Invalid template position: (${template.x}, ${template.y}). Coordinates must be positive.`
      );
    }

    if (template.x + template.width > this.PAGE_WIDTH) {
      throw new Error(
        `Template exceeds page width: x(${template.x}) + width(${template.width}) = ${template.x + template.width}mm > ${this.PAGE_WIDTH}mm`
      );
    }

    if (template.y + template.height > this.PAGE_HEIGHT) {
      throw new Error(
        `Template exceeds page height: y(${template.y}) + height(${template.height}) = ${template.y + template.height}mm > ${this.PAGE_HEIGHT}mm`
      );
    }
  }

  /**
   * Check if template is a chart template
   *
   * @param template - Template to check
   * @returns True if template is a ChartTemplate
   */
  private isChartTemplate(template: ElementTemplate | ChartTemplate): template is ChartTemplate {
    return 'type' in template && ['bar', 'line', 'donut'].includes((template as ChartTemplate).type);
  }

  /**
   * Convert hex color to RGB values
   *
   * @param hex - Hex color string (e.g., '#e8f5e9' or 'e8f5e9')
   * @returns RGB object with r, g, b values (0-255)
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remove # if present
    const cleanHex = hex.replace(/^#/, '');
    
    // Parse hex values
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    return { r, g, b };
  }
}
