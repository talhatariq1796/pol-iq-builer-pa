/**
 * Header and Footer Builder
 * 
 * Provides consistent headers and footers across all PDF pages
 * with logo, report title, page numbers, and branding
 */

import jsPDF from 'jspdf';
import { BHHS_LOGO_BASE64 } from '../assets/bhhs-logo.base64';

export interface HeaderFooterOptions {
  showHeader?: boolean;
  showFooter?: boolean;
  showLogo?: boolean;
  reportTitle?: string;
  areaName?: string;
  companyInfo?: string;
}

export class HeaderFooterBuilder {
  private pdf: jsPDF;
  private readonly PAGE_WIDTH = 210; // mm
  private readonly PAGE_HEIGHT = 279.4; // mm
  
  // Brand colors
  private readonly BRAND_BURGUNDY = '#670338';
  private readonly BRAND_GRAY = '#484247';
  private readonly BRAND_LIGHT_GRAY = '#E0E0E0';

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
  }

  /**
   * Render header on current page
   */
  renderHeader(
    pageNumber: number,
    options: HeaderFooterOptions = {}
  ): void {
    const {
      showHeader = true,
      showLogo = true,
      reportTitle = 'Comparative Market Analysis'
      // REMOVED: areaName parameter - no longer used in header
    } = options;

    if (!showHeader) return;

    // Save current state
    const currentFont = this.pdf.getFont();
    const currentFontSize = this.pdf.getFontSize();

    try {
      // Logo (if page 1 or showLogo is true)
      if (showLogo && BHHS_LOGO_BASE64) {
        try {
          this.pdf.addImage(
            BHHS_LOGO_BASE64.split(',')[1] || BHHS_LOGO_BASE64,
            'PNG',
            15, // x
            10, // y
            40, // width
            12, // height
            undefined,
            'FAST'
          );
        } catch (error) {
          console.warn('[HeaderFooter] Failed to render logo:', error);
        }
      }

      // Report title (right side of header, or centered if no logo)
      // REMOVED: Area name from header - was redundant and cluttering layout
      // Only show "Comparative Market Analysis" without area details
      const titleX = showLogo ? 60 : 15;
      const titleWidth = showLogo ? 135 : 180;
      
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(this.BRAND_BURGUNDY);
      
      // Simplified: Only show report title, not area name
      const titleText = reportTitle;
      const titleTextWidth = this.pdf.getTextWidth(titleText);
      const titleXCentered = titleX + (titleWidth - titleTextWidth) / 2;
      
      this.pdf.text(titleText, titleXCentered, 18);

      // Header separator line
      this.pdf.setDrawColor(this.BRAND_LIGHT_GRAY);
      this.pdf.setLineWidth(0.5);
      this.pdf.line(15, 25, 195, 25);

    } finally {
      // Restore state
      this.pdf.setFont(currentFont.fontName, currentFont.fontStyle);
      this.pdf.setFontSize(currentFontSize);
    }
  }

  /**
   * Render footer on current page
   */
  renderFooter(
    pageNumber: number,
    totalPages: number,
    options: HeaderFooterOptions = {}
  ): void {
    const {
      showFooter = true,
      companyInfo = 'Berkshire Hathaway HomeServices'
    } = options;

    if (!showFooter) return;

    // Save current state
    const currentFont = this.pdf.getFont();
    const currentFontSize = this.pdf.getFontSize();

    try {
      const footerY = this.PAGE_HEIGHT - 10; // 10mm from bottom

      // Footer separator line
      this.pdf.setDrawColor(this.BRAND_LIGHT_GRAY);
      this.pdf.setLineWidth(0.5);
      this.pdf.line(15, footerY - 5, 195, footerY - 5);

      // Company info (left side)
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(this.BRAND_GRAY);
      this.pdf.text(companyInfo, 15, footerY);

      // Page number (right side)
      const pageText = `Page ${pageNumber} of ${totalPages}`;
      const pageTextWidth = this.pdf.getTextWidth(pageText);
      this.pdf.text(pageText, 195 - pageTextWidth, footerY);

      // Generation date (center)
      const dateText = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const dateTextWidth = this.pdf.getTextWidth(dateText);
      this.pdf.text(dateText, 105 - dateTextWidth / 2, footerY);

    } finally {
      // Restore state
      this.pdf.setFont(currentFont.fontName, currentFont.fontStyle);
      this.pdf.setFontSize(currentFontSize);
    }
  }

  /**
   * Render both header and footer
   */
  renderHeaderAndFooter(
    pageNumber: number,
    totalPages: number,
    options: HeaderFooterOptions = {}
  ): void {
    this.renderHeader(pageNumber, options);
    this.renderFooter(pageNumber, totalPages, options);
  }

  /**
   * Calculate safe content area after headers/footers
   * Returns { topY, bottomY, height }
   */
  static getContentArea(): { topY: number; bottomY: number; height: number } {
    return {
      topY: 30,  // After header (25mm separator + 5mm spacing)
      bottomY: 254, // Before footer (footer at 269.4mm - 15mm margin)
      height: 224   // Available height for content
    };
  }
}
