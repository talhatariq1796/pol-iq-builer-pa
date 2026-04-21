import jsPDF from 'jspdf';
import { CMAProperty } from '@/components/cma/types';
import { ModernColorPalette, hexToRgb } from '../design/ModernColorPalette';

/**
 * ComparablesTable Component for CMA PDF Reports
 *
 * Displays 5 most recently sold properties (or any 5 if active-only report)
 * with property images, key metrics, and price information.
 *
 * Follows the BHHS burgundy color palette design from ModernColorPalette
 * and matches the styling patterns from CMAReportPDFGenerator.
 */

export interface ComparablesTableConfig {
  comparableProperties: CMAProperty[];
  reportType: 'sold' | 'active' | 'both';
  x: number;
  y: number;
  width: number;
  propertyImages?: Record<string, string>; // propertyId -> base64 image
}

export class ComparablesTable {
  private pdf: jsPDF;
  private config: ComparablesTableConfig;
  private readonly ROW_HEIGHT = 35;
  private readonly HEADER_HEIGHT = 12;
  private readonly IMAGE_SIZE = 28;
  private readonly COLUMN_WIDTHS = {
    image: 32,
    address: 50,
    price: 28,
    dateOrDom: 25,
    bedBath: 22,
    sqft: 20,
    priceSqft: 23
  };

  constructor(pdf: jsPDF, config: ComparablesTableConfig) {
    this.pdf = pdf;
    this.config = config;
  }

  /**
   * Render the complete comparables table
   * @returns Height of the rendered table
   */
  render(): number {
    const { x, y, width, comparableProperties, reportType } = this.config;

    // Get top 5 properties (most recent if sold, or first 5 if active)
    const topProperties = this.getTopProperties(comparableProperties, reportType);

    if (topProperties.length === 0) {
      return this.renderEmptyState(x, y, width);
    }

    let currentY = y;

    // Render table header
    currentY = this.renderTableHeader(x, currentY, width, reportType);

    // Render each property row
    topProperties.forEach((property, index) => {
      currentY = this.renderPropertyRow(property, x, currentY, width, index);
    });

    return currentY - y; // Return total height
  }

  /**
   * Get top 5 properties based on report type
   */
  private getTopProperties(properties: CMAProperty[], reportType: 'sold' | 'active' | 'both'): CMAProperty[] {
    const filtered = reportType === 'both'
      ? properties
      : properties.filter(p => p.status === reportType);

    if (reportType === 'sold') {
      // For sold properties, get 5 most recent (assuming they're already sorted)
      return filtered.slice(0, 5);
    } else if (reportType === 'both') {
      // For both, get first 5 (mix of sold and active)
      return filtered.slice(0, 5);
    } else {
      // For active properties, just get first 5
      return filtered.slice(0, 5);
    }
  }

  /**
   * Render table header with column labels
   */
  private renderTableHeader(x: number, y: number, width: number, reportType: 'sold' | 'active' | 'both'): number {
    const { COLUMN_WIDTHS, HEADER_HEIGHT } = this;

    // Header background using burgundy
    const headerBg = hexToRgb(ModernColorPalette.chart.secondary);
    if (headerBg) this.pdf.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
    this.pdf.rect(x, y, width, HEADER_HEIGHT, 'F');

    // Header text (white)
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);

    let columnX = x + 2;

    // Column headers
    const headers = [
      { label: 'Image', width: COLUMN_WIDTHS.image },
      { label: 'Address', width: COLUMN_WIDTHS.address },
      { label: reportType === 'sold' ? 'Sale Price' : 'List Price', width: COLUMN_WIDTHS.price },
      { label: reportType === 'sold' ? 'Sale Date' : 'Days on Mkt', width: COLUMN_WIDTHS.dateOrDom },
      { label: 'Bed/Bath', width: COLUMN_WIDTHS.bedBath },
      { label: 'Sq Ft', width: COLUMN_WIDTHS.sqft },
      { label: '$/Sq Ft', width: COLUMN_WIDTHS.priceSqft }
    ];

    headers.forEach(header => {
      this.pdf.text(header.label, columnX, y + 8);
      columnX += header.width;
    });

    // Reset colors
    const textPrimary = hexToRgb(ModernColorPalette.text.dark);
    if (textPrimary) this.pdf.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);

    return y + HEADER_HEIGHT;
  }

  /**
   * Render a single property row
   */
  private renderPropertyRow(
    property: CMAProperty,
    x: number,
    y: number,
    width: number,
    index: number
  ): number {
    const { ROW_HEIGHT, COLUMN_WIDTHS } = this;

    // Alternating row background
    if (index % 2 === 0) {
      const bgLight = hexToRgb(ModernColorPalette.background.subtle);
      if (bgLight) this.pdf.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
      this.pdf.rect(x, y, width, ROW_HEIGHT, 'F');
    }

    // Row border
    const borderGray = hexToRgb(ModernColorPalette.border.light);
    if (borderGray) this.pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    this.pdf.setLineWidth(0.2);
    this.pdf.rect(x, y, width, ROW_HEIGHT, 'S');

    let columnX = x + 2;

    // 1. Property Image
    columnX = this.renderPropertyImage(property, columnX, y);

    // 2. Address
    columnX = this.renderAddress(property.address, columnX, y);

    // 3. Price
    columnX = this.renderPrice(property.price, columnX, y);

    // 4. Date or Days on Market
    columnX = this.renderDateOrDom(property, columnX, y);

    // 5. Bed/Bath
    columnX = this.renderBedBath(property, columnX, y);

    // 6. Square Footage
    columnX = this.renderSquareFootage(property, columnX, y);

    // 7. Price per Sq Ft
    this.renderPricePerSqFt(property, columnX, y);

    return y + ROW_HEIGHT;
  }

  /**
   * Render property image or placeholder
   */
  private renderPropertyImage(property: CMAProperty, x: number, y: number): number {
    const { IMAGE_SIZE, COLUMN_WIDTHS } = this;
    const imageY = y + (this.ROW_HEIGHT - IMAGE_SIZE) / 2;

    // Check for actual property image
    const propertyImage = this.config.propertyImages?.[property.id];

    if (propertyImage) {
      try {
        // Render actual property image
        this.pdf.addImage(propertyImage, 'JPEG', x, imageY, IMAGE_SIZE, IMAGE_SIZE);

        // Add subtle border
        const borderGray = hexToRgb(ModernColorPalette.border.light);
        if (borderGray) this.pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        this.pdf.setLineWidth(0.3);
        this.pdf.rect(x, imageY, IMAGE_SIZE, IMAGE_SIZE, 'S');
      } catch (error) {
        // Fallback to placeholder if image fails
        this.renderImagePlaceholder(x, imageY);
      }
    } else {
      // No image available, render placeholder
      this.renderImagePlaceholder(x, imageY);
    }

    return x + COLUMN_WIDTHS.image;
  }

  /**
   * Render placeholder for missing images
   */
  private renderImagePlaceholder(x: number, y: number): void {
    const { IMAGE_SIZE } = this;

    // Light gray background
    const bgGray = hexToRgb(ModernColorPalette.background.accent);
    if (bgGray) this.pdf.setFillColor(bgGray[0], bgGray[1], bgGray[2]);
    this.pdf.rect(x, y, IMAGE_SIZE, IMAGE_SIZE, 'F');

    // Border
    const borderGray = hexToRgb(ModernColorPalette.border.light);
    if (borderGray) this.pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    this.pdf.setLineWidth(0.3);
    this.pdf.rect(x, y, IMAGE_SIZE, IMAGE_SIZE, 'S');

    // House icon (simple geometric shape)
    const iconColor = hexToRgb(ModernColorPalette.text.light);
    if (iconColor) {
      this.pdf.setDrawColor(iconColor[0], iconColor[1], iconColor[2]);
      this.pdf.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
    }

    const centerX = x + IMAGE_SIZE / 2;
    const centerY = y + IMAGE_SIZE / 2;
    const iconSize = IMAGE_SIZE * 0.4;

    // Simple house icon - rectangle with triangle roof
    this.pdf.rect(centerX - iconSize/2, centerY, iconSize, iconSize * 0.6, 'F');
    this.pdf.triangle(
      centerX - iconSize/2, centerY,
      centerX + iconSize/2, centerY,
      centerX, centerY - iconSize/2,
      'F'
    );
  }

  /**
   * Render property address
   */
  private renderAddress(address: string, x: number, y: number): number {
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    const textPrimary = hexToRgb(ModernColorPalette.text.dark);
    if (textPrimary) this.pdf.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);

    // Truncate address if too long
    const maxWidth = this.COLUMN_WIDTHS.address - 4;
    const truncatedAddress = this.truncateText(address, maxWidth);

    // Split into two lines if needed
    const addressLines = this.wrapText(truncatedAddress, maxWidth);
    const lines = addressLines.split('\n').slice(0, 2); // Max 2 lines

    lines.forEach((line, index) => {
      this.pdf.text(line, x, y + 14 + (index * 4));
    });

    return x + this.COLUMN_WIDTHS.address;
  }

  /**
   * Render property price
   */
  private renderPrice(price: number, x: number, y: number): number {
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    const priceColor = hexToRgb(ModernColorPalette.chart.primary);
    if (priceColor) this.pdf.setTextColor(priceColor[0], priceColor[1], priceColor[2]);

    const priceText = `$${this.formatNumber(price)}`;
    this.pdf.text(priceText, x, y + 18);

    return x + this.COLUMN_WIDTHS.price;
  }

  /**
   * Render sale date or days on market
   */
  private renderDateOrDom(property: CMAProperty, x: number, y: number): number {
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    const textSecondary = hexToRgb(ModernColorPalette.text.body);
    if (textSecondary) this.pdf.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);

    let displayText: string;

    if (this.config.reportType === 'sold') {
      // For sold properties, show sale date (mock data for now)
      // In real implementation, this would come from property data
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - Math.floor(Math.random() * 180));
      displayText = mockDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    } else {
      // For active properties, show days on market (mock data)
      const daysOnMarket = Math.floor(Math.random() * 120) + 1;
      displayText = `${daysOnMarket} days`;
    }

    this.pdf.text(displayText, x, y + 18);

    return x + this.COLUMN_WIDTHS.dateOrDom;
  }

  /**
   * Render bedrooms/bathrooms
   */
  private renderBedBath(property: CMAProperty, x: number, y: number): number {
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    const textPrimary = hexToRgb(ModernColorPalette.text.dark);
    if (textPrimary) this.pdf.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);

    const bedBathText = `${property.bedrooms}bd / ${property.bathrooms}ba`;
    this.pdf.text(bedBathText, x, y + 18);

    return x + this.COLUMN_WIDTHS.bedBath;
  }

  /**
   * Render square footage
   */
  private renderSquareFootage(property: CMAProperty, x: number, y: number): number {
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    const textPrimary = hexToRgb(ModernColorPalette.text.dark);
    if (textPrimary) this.pdf.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);

    const sqftText = this.formatNumber(property.squareFootage);
    this.pdf.text(sqftText, x, y + 18);

    return x + this.COLUMN_WIDTHS.sqft;
  }

  /**
   * Render price per square foot
   */
  private renderPricePerSqFt(property: CMAProperty, x: number, y: number): number {
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    const emphasisColor = hexToRgb(ModernColorPalette.chart.tertiary);
    if (emphasisColor) this.pdf.setTextColor(emphasisColor[0], emphasisColor[1], emphasisColor[2]);

    const pricePerSqFt = Math.round(property.price / property.squareFootage);
    const priceText = `$${this.formatNumber(pricePerSqFt)}`;
    this.pdf.text(priceText, x, y + 18);

    return x + this.COLUMN_WIDTHS.priceSqft;
  }

  /**
   * Render empty state when no properties available
   */
  private renderEmptyState(x: number, y: number, width: number): number {
    const height = 50;

    // Background
    const bgLight = hexToRgb(ModernColorPalette.background.subtle);
    if (bgLight) this.pdf.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    this.pdf.roundedRect(x, y, width, height, 4, 4, 'F');

    // Border
    const borderGray = hexToRgb(ModernColorPalette.border.light);
    if (borderGray) this.pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    this.pdf.setLineWidth(0.5);
    this.pdf.roundedRect(x, y, width, height, 4, 4, 'S');

    // Message
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'italic');
    const textLight = hexToRgb(ModernColorPalette.text.light);
    if (textLight) this.pdf.setTextColor(textLight[0], textLight[1], textLight[2]);
    this.pdf.text('No comparable properties available for this report type.', x + width / 2 - 60, y + height / 2);

    return height;
  }

  /**
   * Utility: Format number with commas
   */
  private formatNumber(num: number): string {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  /**
   * Utility: Truncate text to fit width
   */
  private truncateText(text: string, maxWidth: number): string {
    const textWidth = this.pdf.getTextWidth(text);
    if (textWidth <= maxWidth) return text;

    let truncated = text;
    while (this.pdf.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }

  /**
   * Utility: Wrap text to multiple lines
   */
  private wrapText(text: string, maxWidth: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const textWidth = this.pdf.getTextWidth(testLine);

      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }
}

/**
 * Convenience function to render comparables table
 * @param pdf jsPDF instance
 * @param config Table configuration
 * @returns Height of the rendered table
 */
export function renderComparablesTable(
  pdf: jsPDF,
  config: ComparablesTableConfig
): number {
  const table = new ComparablesTable(pdf, config);
  return table.render();
}
