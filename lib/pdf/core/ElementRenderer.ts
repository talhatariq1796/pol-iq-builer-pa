/**
 * Universal Element Renderer
 * Renders declarative element objects to jsPDF
 */

import jsPDF from 'jspdf';
import { ModernColorPalette, hexToRgb } from '../design/ModernColorPalette';
import { TypographyStyles } from '../design/ModernTypography';
import {
  truncateText,
  wrapTextToLines,
  fitTextToBox,
  measureTextWidth,
  smartTruncate,
  type TextFitResult,
} from '../utils/TextTruncationUtils';
import { renderIconToPdf } from '../utils/IconRendererStatic';

// Page height constraints (A4 format in mm)
export const PAGE_CONSTRAINTS = {
  TOTAL_HEIGHT: 297, // A4 height in mm
  HEADER_HEIGHT: 25,
  FOOTER_HEIGHT: 15,
  CONTENT_MAX_HEIGHT: 257, // 297 - 25 - 15
  WARNING_THRESHOLD: 250, // Warn when approaching limit
} as const;

export interface ElementBase {
  type: string;
  x?: number;
  y?: number;
}

export interface TextElement extends ElementBase {
  type: 'text';
  text: string;
  x: number;
  y: number;
  style?: any;
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  truncate?: boolean;
  smartTruncate?: boolean;
}

export interface RectElement extends ElementBase {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  borderRadius?: number;
}

export interface ContainerElement extends ElementBase {
  type: 'container';
  x: number;
  y: number;
  width: number;
  height: number;
  background?: string;
  borderRadius?: number;
  shadow?: string;
}

export interface TextBlockElement extends ElementBase {
  type: 'text-block';
  text: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  maxLines?: number;
  style?: any;
  color?: string;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  autoFit?: boolean;
  minFontSize?: number;
  truncate?: boolean;
}

export type Element = TextElement | RectElement | ContainerElement | TextBlockElement | any;

/**
 * Renders an array of declarative elements to jsPDF
 */
export class ElementRenderer {
  private pdf: jsPDF;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
  }

  /**
   * Render all elements in array
   */
  renderElements(elements: Element[]): void {
    if (!elements || !Array.isArray(elements)) {
      console.warn('[ElementRenderer] Invalid elements array:', elements);
      return;
    }

    elements.forEach((element, index) => {
      try {
        this.renderElement(element);
      } catch (error) {
        console.error(`[ElementRenderer] Error rendering element ${index}:`, error, element);
        // Continue rendering other elements
      }
    });
  }

  /**
   * Render a single element
   */
  private renderElement(element: Element): void {
    // Skip null or undefined elements
    if (!element) return;

    switch (element.type) {
      case 'text':
        this.renderText(element as TextElement);
        break;
      case 'rect':
        this.renderRect(element as RectElement);
        break;
      case 'container':
        this.renderContainer(element as ContainerElement);
        break;
      case 'text-block':
        this.renderTextBlock(element as TextBlockElement);
        break;
      case 'background':
        this.renderBackground(element);
        break;
      case 'image':
        this.renderImage(element);
        break;
      case 'line':
        this.renderLine(element);
        break;
      case 'circle':
        this.renderCircle(element);
        break;
      case 'icon':
        this.renderIcon(element);
        break;
      case 'arrow':
        this.renderArrow(element);
        break;
      case 'arc':
        this.renderArc(element);
        break;
      case 'radial-gauge':
        this.renderRadialGauge(element);
        break;
      case 'icon-grid':
        this.renderIconGrid(element);
        break;
      case 'comparison-bar':
        this.renderComparisonBar(element);
        break;
      case 'trend-arrow':
        this.renderTrendArrow(element);
        break;
      case 'kpi-card':
      case 'section-header':
      case 'gradient-panel':
      case 'progress-meter':
      case 'badge':
        // ModernComponents - render as nested elements
        this.renderModernComponent(element);
        break;
      default:
        console.warn(`[ElementRenderer] Unknown element type: ${element.type}`);
    }
  }

  /**
   * Render ModernComponents which are composite elements
   */
  private renderModernComponent(component: any): void {
    // ModernComponents typically have a 'children' or nested structure
    // For now, render basic fallback - can be enhanced per component type
    if (component.bounds) {
      const { x, y, width, height } = component.bounds;

      // Render background if present
      // Skip null, transparent colors, and RGBA colors with 0 alpha
      if (component.background && component.background !== 'transparent') {
        const rgbColor = hexToRgb(component.background);
        if (rgbColor !== null) {
          const [r, g, b] = rgbColor;
          this.pdf.setFillColor(r, g, b);
          if (component.borderRadius) {
            this.pdf.roundedRect(x, y, width, height, component.borderRadius, component.borderRadius, 'F');
          } else {
            this.pdf.rect(x, y, width, height, 'F');
          }
        }
      }

      // Render gradient if present
      // Skip null, transparent colors, and RGBA colors with 0 alpha
      if (component.gradient && component.gradient.start) {
        // Simple gradient approximation with transparency
        const rgbColor = hexToRgb(component.gradient.start);
        if (rgbColor !== null) {
          const [r, g, b] = rgbColor;
          this.pdf.setFillColor(r, g, b);
          if (component.borderRadius) {
            this.pdf.roundedRect(x, y, width, height, component.borderRadius, component.borderRadius, 'F');
          } else {
            this.pdf.rect(x, y, width, height, 'F');
          }
        }
      }

      // Render border if present (critical for white cards with subtle borders)
      // Skip null, transparent colors, and RGBA colors with 0 alpha
      if (component.borderColor && component.borderColor !== 'transparent') {
        const borderRgb = hexToRgb(component.borderColor);
        if (borderRgb !== null) {
          const [r, g, b] = borderRgb;
          this.pdf.setDrawColor(r, g, b);
          this.pdf.setLineWidth(0.5); // Subtle 0.5mm border
          if (component.borderRadius) {
            this.pdf.roundedRect(x, y, width, height, component.borderRadius, component.borderRadius, 'S');
          } else {
            this.pdf.rect(x, y, width, height, 'S');
          }
        }
      }
    }

    // Render any nested elements
    if (component.elements && Array.isArray(component.elements)) {
      this.renderElements(component.elements);
    }
  }

  private renderText(element: TextElement): void {
    const { text, x, y, style, color, align, maxWidth, truncate, smartTruncate: useSmartTruncate } = element;

    // Apply style with proper font weight mapping
    const fontName = style ? this.normalizeFontName(style.font || 'helvetica') : 'helvetica';
    const fontStyle = style ? this.normalizeFontWeight(style.weight || 'normal') : 'normal';
    const fontSize = style?.fontSize || 10;

    this.pdf.setFont(fontName, fontStyle);
    this.pdf.setFontSize(fontSize);

    // Apply color with null safety - skip transparent colors
    if (color && color !== 'transparent') {
      const rgbColor = hexToRgb(color);
      if (rgbColor !== null) {
        const [r, g, b] = rgbColor;
        this.pdf.setTextColor(r, g, b);
      }
    }

    // Truncate text if needed
    let displayText = text;
    if (maxWidth && (truncate || useSmartTruncate)) {
      if (useSmartTruncate) {
        displayText = smartTruncate(this.pdf, text, maxWidth, fontSize, fontName, fontStyle);
      } else {
        displayText = truncateText(this.pdf, text, maxWidth, fontSize, fontName, fontStyle);
      }
    }

    // Render text with alignment
    const options: any = {};
    if (align) {
      options.align = align;
    }

    this.pdf.text(displayText, x, y, options);
  }

  /**
   * Normalize font names to valid jsPDF fonts
   */
  private normalizeFontName(font: string): string {
    const fontMap: Record<string, string> = {
      'inter': 'helvetica',
      'system-ui': 'helvetica',
      'sans-serif': 'helvetica',
      'serif': 'times',
      'monospace': 'courier',
    };
    return fontMap[font.toLowerCase()] || 'helvetica';
  }

  /**
   * Normalize font weights to valid jsPDF font styles
   */
  private normalizeFontWeight(weight: string | number): string {
    // Convert numeric weights to style names
    if (typeof weight === 'number') {
      if (weight >= 700) return 'bold';
      if (weight >= 600) return 'bold';
      if (weight >= 500) return 'normal';
      if (weight >= 300) return 'normal';
      return 'normal';
    }

    // Map weight names
    const weightMap: Record<string, string> = {
      'thin': 'normal',
      'light': 'normal',
      'regular': 'normal',
      'medium': 'normal',
      'semibold': 'bold',
      'bold': 'bold',
      'extrabold': 'bold',
      'black': 'bold',
      'italic': 'italic',
      'bolditalic': 'bolditalic',
    };

    return weightMap[weight.toLowerCase()] || 'normal';
  }

  private renderRect(element: RectElement): void {
    const { x, y, width, height, color, borderRadius } = element;

    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (color && color !== 'transparent') {
      const rgbColor = hexToRgb(color);
      if (rgbColor !== null) {
        const [r, g, b] = rgbColor;
        this.pdf.setFillColor(r, g, b);

        if (borderRadius) {
          this.pdf.roundedRect(x, y, width, height, borderRadius, borderRadius, 'F');
        } else {
          this.pdf.rect(x, y, width, height, 'F');
        }
      }
    }
  }

  private renderContainer(element: ContainerElement): void {
    const { x, y, width, height, background, borderRadius } = element;

    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (background && background !== 'transparent') {
      const rgbColor = hexToRgb(background);
      if (rgbColor !== null) {
        const [r, g, b] = rgbColor;
        this.pdf.setFillColor(r, g, b);

        if (borderRadius) {
          this.pdf.roundedRect(x, y, width, height, borderRadius, borderRadius, 'F');
        } else {
          this.pdf.rect(x, y, width, height, 'F');
        }
      }
    }
  }

  private renderTextBlock(element: TextBlockElement): void {
    const {
      text,
      x,
      y,
      width,
      height,
      style,
      color,
      lineHeight = 1.5,
      maxLines,
      align = 'left',
      autoFit = false,
      minFontSize = 6,
      truncate = true,
    } = element;

    // Apply style with proper font mapping
    const fontName = style ? this.normalizeFontName(style.font || 'helvetica') : 'helvetica';
    const fontStyle = style ? this.normalizeFontWeight(style.weight || 'normal') : 'normal';
    let fontSize = style?.fontSize || 10;

    // Auto-fit text to box if requested
    if (autoFit && height) {
      const fitResult = fitTextToBox(
        this.pdf,
        text,
        width,
        height,
        fontSize,
        minFontSize,
        fontSize,
        fontName,
        fontStyle,
        lineHeight
      );

      fontSize = fitResult.fontSize;
      this.pdf.setFont(fontName, fontStyle);
      this.pdf.setFontSize(fontSize);

      // Apply color with null safety
      if (color && color !== 'transparent') {
        const rgbColor = hexToRgb(color);
        if (rgbColor !== null) {
          const [r, g, b] = rgbColor;
          this.pdf.setTextColor(r, g, b);
        }
      }

      // Render fitted lines
      const spacing = fontSize * lineHeight;
      fitResult.lines?.forEach((line: string, index: number) => {
        const lineY = y + (index * spacing);
        this.renderAlignedLine(line, x, lineY, width, align);
      });

      // Check for overflow
      const totalHeight = (fitResult.lines?.length || 0) * spacing;
      if (height && totalHeight > height) {
        console.warn(`[ElementRenderer] Text overflow detected at y=${y}: content height ${totalHeight.toFixed(2)}mm exceeds max height ${height}mm`);
      }

      return;
    }

    // Standard rendering with truncation
    this.pdf.setFont(fontName, fontStyle);
    this.pdf.setFontSize(fontSize);

    // Apply color with null safety
    if (color && color !== 'transparent') {
      const rgbColor = hexToRgb(color);
      if (rgbColor !== null) {
        const [r, g, b] = rgbColor;
        this.pdf.setTextColor(r, g, b);
      }
    }

    // Wrap text using truncation utilities if truncate is enabled
    let linesToRender: string[];
    if (truncate && maxLines) {
      linesToRender = wrapTextToLines(
        this.pdf,
        text,
        width,
        maxLines,
        fontSize,
        fontName,
        fontStyle
      );
    } else {
      // Use jsPDF's built-in wrapping
      const wrappedText = this.pdf.splitTextToSize(text, width);
      const linesArray = Array.isArray(wrappedText) ? wrappedText : [wrappedText];
      linesToRender = maxLines ? linesArray.slice(0, maxLines) : linesArray;

      // Add manual ellipsis if truncated
      if (maxLines && linesArray.length > maxLines && truncate) {
        const lastLine = linesToRender[linesToRender.length - 1];
        linesToRender[linesToRender.length - 1] = lastLine.substring(0, lastLine.length - 3) + '...';
      }
    }

    // Calculate line spacing
    const spacing = fontSize * lineHeight;

    // Check for overflow before rendering
    const calculatedHeight = linesToRender.length * spacing;
    if (height && calculatedHeight > height) {
      console.warn(`[ElementRenderer] Text block overflow at y=${y}: ${linesToRender.length} lines (${calculatedHeight.toFixed(2)}mm) exceeds max height ${height}mm`);

      // Force truncate to fit within height
      const maxLinesForHeight = Math.floor(height / spacing);
      if (maxLinesForHeight > 0 && linesToRender.length > maxLinesForHeight) {
        linesToRender = linesToRender.slice(0, maxLinesForHeight);
        const lastLine = linesToRender[linesToRender.length - 1];
        linesToRender[linesToRender.length - 1] = lastLine.substring(0, Math.max(0, lastLine.length - 3)) + '...';
      }
    }

    // Check if content will overflow page
    const contentEndY = y + calculatedHeight;
    if (contentEndY > PAGE_CONSTRAINTS.WARNING_THRESHOLD) {
      console.warn(`[ElementRenderer] Page overflow warning: content extends to y=${contentEndY.toFixed(2)}mm (page limit: ${PAGE_CONSTRAINTS.TOTAL_HEIGHT}mm)`);
    }

    // Render each line with proper alignment
    linesToRender.forEach((line: string, index: number) => {
      const lineY = y + (index * spacing);
      this.renderAlignedLine(line, x, lineY, width, align);
    });
  }

  /**
   * Helper method to render a line with proper alignment
   */
  private renderAlignedLine(
    line: string,
    x: number,
    y: number,
    width: number,
    align: 'left' | 'center' | 'right'
  ): void {
    if (align === 'center') {
      const textWidth = this.pdf.getTextWidth(line);
      this.pdf.text(line, x + (width / 2) - (textWidth / 2), y);
    } else if (align === 'right') {
      const textWidth = this.pdf.getTextWidth(line);
      this.pdf.text(line, x + width - textWidth, y);
    } else {
      this.pdf.text(line, x, y);
    }
  }

  private renderBackground(element: any): void {
    if (element.sections) {
      element.sections.forEach((section: any) => {
        // Skip null, transparent colors, and RGBA colors with 0 alpha
        if (section.color && section.color !== 'transparent') {
          const rgbColor = hexToRgb(section.color);
          if (rgbColor !== null) {
            const [r, g, b] = rgbColor;
            this.pdf.setFillColor(r, g, b);
            this.pdf.rect(section.x, section.y, section.width, section.height, 'F');
          }
        }
      });
    }
  }

  private renderImage(element: any): void {
    if (element.src) {
      try {
        // Skip invalid images (SVG data URIs, corrupt Base64, etc.)
        if (!element.src || element.src.trim() === '') {
          this.renderImagePlaceholder(element.x, element.y, element.width, element.height, 'Image');
          return;
        }

        // Skip SVG data URIs (jsPDF doesn't support them) - render placeholder instead
        if (element.src.includes('data:image/svg+xml')) {
          this.renderImagePlaceholder(element.x, element.y, element.width, element.height, 'Icon');
          return;
        }

        this.pdf.addImage(
          element.src,
          'PNG',
          element.x,
          element.y,
          element.width,
          element.height
        );
      } catch (error) {
        // Don't log errors - too verbose for icon failures
        // Render a placeholder box instead
        this.renderImagePlaceholder(element.x, element.y, element.width, element.height, 'Image');
      }
    } else {
      // No image source - render placeholder
      this.renderImagePlaceholder(element.x, element.y, element.width, element.height, 'Image');
    }
  }

  /**
   * Render a styled placeholder for missing images
   */
  private renderImagePlaceholder(x: number, y: number, width: number, height: number, label: string): void {
    // Light gray background
    const bgColor = hexToRgb(ModernColorPalette.background.subtle);
    if (bgColor !== null) {
      const [r, g, b] = bgColor;
      this.pdf.setFillColor(r, g, b);
      this.pdf.roundedRect(x, y, width, height, 4, 4, 'F');
    }

    // Border
    const borderColor = hexToRgb(ModernColorPalette.border.light);
    if (borderColor !== null) {
      const [br, bg, bb] = borderColor;
      this.pdf.setDrawColor(br, bg, bb);
      this.pdf.setLineWidth(0.5);
      this.pdf.roundedRect(x, y, width, height, 4, 4, 'S');
    }

    // Icon/Label
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(10);
    const textColor = hexToRgb(ModernColorPalette.text.light);
    if (textColor !== null) {
      const [tr, tg, tb] = textColor;
      this.pdf.setTextColor(tr, tg, tb);

      const text = `[${label}]`;
      const textWidth = this.pdf.getTextWidth(text);
      this.pdf.text(text, x + (width / 2) - (textWidth / 2), y + (height / 2));
    }
  }

  private renderLine(element: any): void {
    const strokeColor = element.strokeColor || ModernColorPalette.border.medium;
    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (strokeColor && strokeColor !== 'transparent') {
      const rgbColor = hexToRgb(strokeColor);
      if (rgbColor !== null) {
        const [r, g, b] = rgbColor;
        this.pdf.setDrawColor(r, g, b);
        this.pdf.setLineWidth(element.strokeWidth || 1);

        // Note: jsPDF doesn't have setLineDash in stable version
        // Dashed lines would require custom implementation or upgrade

        this.pdf.line(element.x1, element.y1, element.x2, element.y2);
      }
    }
  }

  private renderCircle(element: any): void {
    const circleColor = element.color || ModernColorPalette.primary;
    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (circleColor && circleColor !== 'transparent') {
      const rgbColor = hexToRgb(circleColor);
      if (rgbColor !== null) {
        const [r, g, b] = rgbColor;
        this.pdf.setFillColor(r, g, b);
        this.pdf.circle(element.centerX, element.centerY, element.radius, 'F');
      }
    }
  }

  private renderIcon(element: any): void {
    const iconColor = element.color || ModernColorPalette.primary;

    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (!iconColor || iconColor === 'transparent') {
      return;
    }

    const size = element.size || 12;
    const x = element.x;
    const y = element.y;

    // Render static PNG icon
    if (element.name) {
      try {
        renderIconToPdf(this.pdf, element.name, x, y, size);
        return;
      } catch (error) {
        console.warn(`[ElementRenderer] Failed to render icon ${element.name}, using fallback:`, error);
        // Fall through to geometric fallback
      }
    }

    // No icon name or icon failed - render default circle fallback
    const rgbColor = hexToRgb(iconColor);
    if (rgbColor === null) {
      return;
    }

    const [r, g, b] = rgbColor;

    // Render actual geometric shapes based on icon type (legacy fallback)
    this.pdf.setFillColor(r, g, b);
    this.pdf.setDrawColor(r, g, b);
    this.pdf.setLineWidth(0.5);

    switch (element.name) {
      // Chart icons - rectangles/bars
      case 'chart-bar':
      case 'chart':
        // Three bars of different heights
        this.pdf.rect(x - size/3, y - size/3, size/4, size/2, 'F');
        this.pdf.rect(x - size/12, y - size/2, size/4, size/1.5, 'F');
        this.pdf.rect(x + size/6, y - size/4, size/4, size/3, 'F');
        break;

      // Line chart - line with dots
      case 'chart-line':
        // Draw line segments
        this.pdf.line(x - size/2, y, x - size/4, y - size/4);
        this.pdf.line(x - size/4, y - size/4, x, y + size/6);
        this.pdf.line(x, y + size/6, x + size/4, y - size/3);
        // Draw dots at points
        this.pdf.circle(x - size/2, y, size/12, 'F');
        this.pdf.circle(x - size/4, y - size/4, size/12, 'F');
        this.pdf.circle(x, y + size/6, size/12, 'F');
        this.pdf.circle(x + size/4, y - size/3, size/12, 'F');
        break;

      // Pie chart - circle with segments
      case 'chart-pie':
        this.pdf.circle(x, y, size/2.5, 'S');
        this.pdf.line(x, y, x + size/2.5, y);
        this.pdf.line(x, y, x, y - size/2.5);
        break;

      // Home icon - house shape
      case 'home':
      case 'home-analytics':
        // Roof (triangle)
        this.pdf.triangle(x, y - size/2, x - size/2.5, y, x + size/2.5, y, 'F');
        // House body (rectangle)
        this.pdf.rect(x - size/3, y, size * 0.66, size/2, 'F');
        break;

      // Location - pin shape
      case 'location':
      case 'map-pin':
        // Circle top
        this.pdf.circle(x, y - size/4, size/3, 'F');
        // Triangle bottom (pin point)
        this.pdf.triangle(x, y + size/3, x - size/4, y, x + size/4, y, 'F');
        break;

      // Dollar sign
      case 'dollar':
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setFontSize(size * 1.2);
        this.pdf.setTextColor(r, g, b);
        this.pdf.text('$', x, y);
        break;

      // Percent sign
      case 'percent':
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setFontSize(size * 1.2);
        this.pdf.setTextColor(r, g, b);
        this.pdf.text('%', x, y);
        break;

      // Calendar - grid
      case 'calendar':
        this.pdf.rect(x - size/2.5, y - size/2.5, size * 0.8, size * 0.8, 'S');
        this.pdf.line(x - size/2.5, y - size/5, x + size/3, y - size/5);
        this.pdf.line(x - size/6, y - size/2.5, x - size/6, y - size/5);
        this.pdf.line(x + size/6, y - size/2.5, x + size/6, y - size/5);
        break;

      // User/person - simple silhouette
      case 'user':
      case 'users':
        // Head
        this.pdf.circle(x, y - size/3, size/5, 'F');
        // Body (ellipse approximation)
        this.pdf.ellipse(x, y + size/6, size/2.5, size/3, 'F');
        break;

      // School - building
      case 'school':
        // Building
        this.pdf.rect(x - size/2.5, y - size/3, size * 0.8, size * 0.7, 'S');
        // Roof triangle
        this.pdf.triangle(x, y - size/1.8, x - size/2, y - size/3, x + size/2, y - size/3, 'S');
        // Door
        this.pdf.rect(x - size/8, y + size/6, size/4, size/4, 'F');
        break;

      // Trending up - arrow up
      case 'trending':
      case 'trending-up':
        // Arrow shaft
        this.pdf.line(x - size/2, y + size/3, x + size/3, y - size/2);
        // Arrow head
        this.pdf.triangle(x + size/3, y - size/2, x + size/6, y - size/4, x + size/3, y - size/6, 'F');
        break;

      // Shield - protection icon
      case 'shield':
      case 'shield-check':
        // Shield shape (pentagon)
        this.pdf.line(x - size/2.5, y - size/2, x + size/2.5, y - size/2);
        this.pdf.line(x + size/2.5, y - size/2, x + size/2.5, y + size/6);
        this.pdf.line(x + size/2.5, y + size/6, x, y + size/2);
        this.pdf.line(x, y + size/2, x - size/2.5, y + size/6);
        this.pdf.line(x - size/2.5, y + size/6, x - size/2.5, y - size/2);
        break;

      // Check/clipboard - checkmark
      case 'check-circle':
      case 'clipboard-check':
        this.pdf.circle(x, y, size/2.5, 'S');
        // Simple checkmark
        this.pdf.line(x - size/4, y, x - size/8, y + size/4);
        this.pdf.line(x - size/8, y + size/4, x + size/3, y - size/3);
        break;

      // Lightbulb - idea
      case 'lightbulb':
        // Bulb
        this.pdf.circle(x, y - size/6, size/3, 'S');
        // Base
        this.pdf.rect(x - size/6, y + size/8, size/3, size/5, 'F');
        break;

      // Alert triangle
      case 'alert-triangle':
        this.pdf.triangle(x, y - size/2, x - size/2.5, y + size/2, x + size/2.5, y + size/2, 'S');
        // Exclamation mark
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setFontSize(size);
        this.pdf.setTextColor(r, g, b);
        this.pdf.text('!', x, y + size/4);
        break;

      // Info - circle with i
      case 'info':
        this.pdf.circle(x, y, size/2.5, 'S');
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setFontSize(size);
        this.pdf.setTextColor(r, g, b);
        this.pdf.text('i', x, y + size/6);
        break;

      // Star
      case 'star':
      case 'sparkles':
        // Simple 4-point star
        this.pdf.line(x, y - size/2, x, y + size/2);
        this.pdf.line(x - size/2, y, x + size/2, y);
        this.pdf.line(x - size/3, y - size/3, x + size/3, y + size/3);
        this.pdf.line(x - size/3, y + size/3, x + size/3, y - size/3);
        break;

      // Walk - person walking
      case 'walk':
        // Simple stick figure in walking pose
        this.pdf.circle(x - size/6, y - size/2, size/6, 'F');
        this.pdf.line(x - size/6, y - size/3, x - size/6, y + size/6);
        this.pdf.line(x - size/6, y - size/6, x + size/6, y - size/4);
        this.pdf.line(x - size/6, y + size/6, x - size/3, y + size/2);
        this.pdf.line(x - size/6, y + size/6, x + size/6, y + size/3);
        break;

      // Eye - view/visibility
      case 'eye':
        // Eye outline
        this.pdf.ellipse(x, y, size/2, size/3.5, 'S');
        // Pupil
        this.pdf.circle(x, y, size/8, 'F');
        break;

      // Compass - navigation
      case 'compass':
        this.pdf.circle(x, y, size/2.5, 'S');
        // North arrow
        this.pdf.triangle(x, y - size/3, x - size/8, y + size/8, x + size/8, y + size/8, 'F');
        break;

      // Default - simple circle
      case 'circle':
      default:
        this.pdf.circle(x, y, size/3, 'F');
        break;
    }
  }

  private renderArrow(element: any): void {
    const symbols: Record<string, string> = {
      'up': '↑',
      'down': '↓',
      'flat': '→',
    };

    const arrow = symbols[element.direction] || '→';
    this.pdf.setFontSize(element.size || 14);
    const arrowColor = element.color || ModernColorPalette.primary;
    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (arrowColor && arrowColor !== 'transparent') {
      const rgbColor = hexToRgb(arrowColor);
      if (rgbColor !== null) {
        const [r, g, b] = rgbColor;
        this.pdf.setTextColor(r, g, b);
        this.pdf.text(arrow, element.x, element.y);
      }
    }
  }

  private renderArc(element: any): void {
    // Simplified arc rendering - draw as circle segment
    const strokeColor = element.strokeColor || ModernColorPalette.primary;
    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (strokeColor && strokeColor !== 'transparent') {
      const rgbColor = hexToRgb(strokeColor);
      if (rgbColor !== null) {
        const [r, g, b] = rgbColor;
        this.pdf.setDrawColor(r, g, b);
        this.pdf.setLineWidth(element.strokeWidth || 2);

        // For now, just draw a simple circle as fallback
        // Full arc implementation would require path drawing
        this.pdf.circle(element.centerX, element.centerY, element.radius, 'S');
      }
    }
  }

  /**
   * Render radial gauge (circular progress indicator)
   */
  private renderRadialGauge(element: any): void {
    const { center, radius, startAngle = 0, endAngle = 360, value, maxValue = 100, color, backgroundColor, label } = element;

    if (!center || !radius) return;

    // Handle both object {x, y} and array [x, y] formats for center
    const cx = typeof center === 'object' && 'x' in center ? center.x : center[0];
    const cy = typeof center === 'object' && 'y' in center ? center.y : center[1];
    const percentage = maxValue > 0 ? (value / maxValue) : 0;
    const arcEnd = startAngle + (endAngle - startAngle) * percentage;

    // Draw background arc
    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (backgroundColor && backgroundColor !== 'transparent') {
      const bgColor = hexToRgb(backgroundColor);
      if (bgColor !== null) {
        const [r, g, b] = bgColor;
        this.pdf.setDrawColor(r, g, b);
        this.pdf.setLineWidth(radius * 0.15);
        this.drawArc(cx, cy, radius, startAngle, endAngle);
      }
    }

    // Draw value arc
    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (color && color !== 'transparent' && percentage > 0) {
      const fgColor = hexToRgb(color);
      if (fgColor !== null) {
        const [r, g, b] = fgColor;
        this.pdf.setDrawColor(r, g, b);
        this.pdf.setLineWidth(radius * 0.2);
        this.drawArc(cx, cy, radius, startAngle, arcEnd);
      }
    }

    // Draw center label if provided
    if (label) {
      const labelColorValue = element.labelColor || color || '#333333';
      // Skip null, transparent colors, and RGBA colors with 0 alpha
      if (labelColorValue && labelColorValue !== 'transparent') {
        const labelColor = hexToRgb(labelColorValue);
        if (labelColor !== null) {
          const [r, g, b] = labelColor;
          this.pdf.setTextColor(r, g, b);
          this.pdf.setFontSize(radius * 0.4);
          this.pdf.text(label, cx, cy, { align: 'center', baseline: 'middle' });
        }
      }
    }

    // Render nested elements if any
    if (element.elements && Array.isArray(element.elements)) {
      this.renderElements(element.elements);
    }
  }

  /**
   * Helper to draw arc (partial circle)
   */
  private drawArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): void {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const segments = Math.max(8, Math.ceil(Math.abs(endAngle - startAngle) / 15));

    for (let i = 0; i <= segments; i++) {
      const angle = startRad + (endRad - startRad) * (i / segments);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      if (i === 0) {
        this.pdf.line(cx, cy, x, y); // Move to start
      } else {
        const prevAngle = startRad + (endRad - startRad) * ((i - 1) / segments);
        const prevX = cx + radius * Math.cos(prevAngle);
        const prevY = cy + radius * Math.sin(prevAngle);
        this.pdf.line(prevX, prevY, x, y);
      }
    }
  }

  /**
   * Render icon grid layout
   */
  private renderIconGrid(element: any): void {
    const { bounds, items, columns = 3, spacing = 5 } = element;

    if (!bounds || !items || !Array.isArray(items)) {
      // Fallback: render nested elements
      if (element.elements && Array.isArray(element.elements)) {
        this.renderElements(element.elements);
      }
      return;
    }

    const { x, y, width } = bounds;
    const itemWidth = (width - (columns - 1) * spacing) / columns;

    items.forEach((item: any, index: number) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const itemX = x + col * (itemWidth + spacing);
      const itemY = y + row * (itemWidth + spacing);

      // Render item icon/text
      if (item.icon) {
        this.renderIcon({ ...item, x: itemX, y: itemY, size: itemWidth * 0.6 });
      }
      if (item.label) {
        const labelColorValue = item.color || '#666666';
        // Skip null, transparent colors, and RGBA colors with 0 alpha
        if (labelColorValue && labelColorValue !== 'transparent') {
          const labelColor = hexToRgb(labelColorValue);
          if (labelColor !== null) {
            const [r, g, b] = labelColor;
            this.pdf.setTextColor(r, g, b);
            this.pdf.setFontSize(8);
            this.pdf.text(item.label, itemX + itemWidth / 2, itemY + itemWidth, { align: 'center' });
          }
        }
      }
    });

    // Render nested elements
    if (element.elements && Array.isArray(element.elements)) {
      this.renderElements(element.elements);
    }
  }

  /**
   * Render comparison bar (horizontal bar with segments)
   */
  private renderComparisonBar(element: any): void {
    const { bounds, value, maxValue = 100, color, backgroundColor, label, valueLabel } = element;

    if (!bounds) {
      // Fallback: render nested elements
      if (element.elements && Array.isArray(element.elements)) {
        this.renderElements(element.elements);
      }
      return;
    }

    const { x, y, width, height = 8 } = bounds;
    const percentage = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;

    // Draw background bar
    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (backgroundColor && backgroundColor !== 'transparent') {
      const bgColor = hexToRgb(backgroundColor);
      if (bgColor !== null) {
        const [r, g, b] = bgColor;
        this.pdf.setFillColor(r, g, b);
        this.pdf.roundedRect(x, y, width, height, 2, 2, 'F');
      }
    }

    // Draw value bar
    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (color && color !== 'transparent' && percentage > 0) {
      const fgColor = hexToRgb(color);
      if (fgColor !== null) {
        const [r, g, b] = fgColor;
        this.pdf.setFillColor(r, g, b);
        const valueWidth = width * percentage;
        this.pdf.roundedRect(x, y, valueWidth, height, 2, 2, 'F');
      }
    }

    // Draw labels
    if (label) {
      const labelColorValue = element.labelColor || '#333333';
      // Skip null, transparent colors, and RGBA colors with 0 alpha
      if (labelColorValue && labelColorValue !== 'transparent') {
        const labelColor = hexToRgb(labelColorValue);
        if (labelColor !== null) {
          const [r, g, b] = labelColor;
          this.pdf.setTextColor(r, g, b);
          this.pdf.setFontSize(9);
          this.pdf.text(label, x, y - 2);
        }
      }
    }

    if (valueLabel) {
      const valueLabelColorValue = element.labelColor || '#666666';
      // Skip null, transparent colors, and RGBA colors with 0 alpha
      if (valueLabelColorValue && valueLabelColorValue !== 'transparent') {
        const valueLabelColor = hexToRgb(valueLabelColorValue);
        if (valueLabelColor !== null) {
          const [r, g, b] = valueLabelColor;
          this.pdf.setTextColor(r, g, b);
          this.pdf.setFontSize(8);
          this.pdf.text(valueLabel, x + width, y + height / 2, { align: 'right', baseline: 'middle' });
        }
      }
    }

    // Render nested elements
    if (element.elements && Array.isArray(element.elements)) {
      this.renderElements(element.elements);
    }
  }

  /**
   * Render trend arrow (directional indicator)
   */
  private renderTrendArrow(element: any): void {
    const { x, y, direction = 'up', color, size = 5, label } = element;

    if (!x || !y) {
      // Fallback: render nested elements
      if (element.elements && Array.isArray(element.elements)) {
        this.renderElements(element.elements);
      }
      return;
    }

    const trendColor = color || '#5AA454';
    // Skip null, transparent colors, and RGBA colors with 0 alpha
    if (!trendColor || trendColor === 'transparent') {
      // Fallback: render nested elements
      if (element.elements && Array.isArray(element.elements)) {
        this.renderElements(element.elements);
      }
      return;
    }

    const arrowColor = hexToRgb(trendColor);
    if (arrowColor === null) {
      // Fallback: render nested elements
      if (element.elements && Array.isArray(element.elements)) {
        this.renderElements(element.elements);
      }
      return;
    }

    const [r, g, b] = arrowColor;
    this.pdf.setFillColor(r, g, b);
    this.pdf.setDrawColor(r, g, b);

    // Draw triangle arrow
    if (direction === 'up') {
      this.pdf.triangle(x, y - size, x - size, y + size, x + size, y + size, 'F');
    } else if (direction === 'down') {
      this.pdf.triangle(x, y + size, x - size, y - size, x + size, y - size, 'F');
    } else if (direction === 'right') {
      this.pdf.triangle(x + size, y, x - size, y - size, x - size, y + size, 'F');
    } else if (direction === 'left') {
      this.pdf.triangle(x - size, y, x + size, y - size, x + size, y + size, 'F');
    }

    // Draw label if provided
    if (label) {
      this.pdf.setTextColor(r, g, b);
      this.pdf.setFontSize(9);
      this.pdf.text(label, x + size * 2, y, { baseline: 'middle' });
    }

    // Render nested elements
    if (element.elements && Array.isArray(element.elements)) {
      this.renderElements(element.elements);
    }
  }
}
