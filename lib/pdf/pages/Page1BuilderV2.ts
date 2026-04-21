/**
 * Page 1 Builder V2 - Template-Based Implement      // AI Insights - area-focused analysis (expanded to use all available space)
      aiInsightsTitle: 'Market Analysis',
      aiMarketPositioning: (this.data.aiInsights?.marketPositioning || 
                          'Market analysis insights will appear here based on comparable properties and current market conditions in the selected area.').slice(0, 850),
    };
 * Uses strict template system instead of dynamic positioning
 */

import jsPDF from 'jspdf';
import { TemplateRenderer } from '../core/TemplateRenderer';
import { PAGE_TEMPLATES } from '../templates/PageTemplates';
import { BHHS_LOGO_LARGE_BASE64 } from '../assets/bhhs-logo-large-base64';
import type { Page1Data } from '../data/extractors';

export class Page1BuilderV2 {
  private renderer: TemplateRenderer;
  private template = PAGE_TEMPLATES[0];

  constructor(
    pdf: jsPDF,
    private data: Page1Data,
    private propertyImages?: Record<string, string>,
    private propertyCategory?: 'residential' | 'revenue' | 'both'
  ) {
    this.renderer = new TemplateRenderer(pdf);
  }

  /**
   * Build complete Page 1 using template system
   * @returns Final Y position after rendering
   */
  public build(): number {
    // Map Page1Data to template element keys
    const templateData = this.mapDataToTemplate();
    this.renderer.renderPage(this.template, templateData);
    return this.template.pageHeight || 279.4;
  }

  /**
   * Map Page1Data structure to template element IDs
   */
  private mapDataToTemplate(): Record<string, any> {
    return {
      // Report title
      reportTitle: `COMPARATIVE MARKET ANALYSIS`,

      // Area/Location name - use resolved address from addressResolver
      // This implements 3-source priority: property > search > geocoded > fallback
      // Address is displayed without "(Estimated location)" - that's shown separately
      areaName: this.data.property.address || 'Location not specified',

      // Estimation note - shown below address when location is estimated
      // Only rendered if address source is 'geocoded' or 'coordinates'
      estimationNote: this.data.property.isAddressEstimated ? '(Estimated location)' : '',

      // Report date
      reportDate: this.data.reportDate || new Date().toLocaleDateString(),

      // Images - use high-resolution base64 BHHS logo (788x180px, no pixelation)
      // Don't include logo in header - template handles it separately
      // areaMap: Use BHHS logo in place of property/map image
      areaMap: BHHS_LOGO_LARGE_BASE64,

      // AI Insights - area-focused analysis (COMMENTED OUT - may re-enable later)
      // aiInsightsTitle: 'Market Analysis',
      // aiMarketPositioning: (this.data.aiInsights?.marketPositioning ||
      //                     'Market analysis insights will appear here based on comparable properties and current market conditions in the selected area.').slice(0, 650),
    };
  }
}
