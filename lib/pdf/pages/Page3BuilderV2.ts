/**
 * Page 3 Builder V2 - Template-Based Implementation with Table
 * Uses table renderer for professional comparable properties display
 */

import jsPDF from 'jspdf';
import { TemplateRenderer } from '../core/TemplateRenderer';
import { PAGE_TEMPLATES, BRAND_COLORS, MARGINS } from '../templates/PageTemplates';
import type { Page3Config } from '../data/extractors';
import {
  renderTable,
  renderStatusBadge,
  renderPropertyThumbnail,
  type TableColumn
} from '../components/TableRenderer';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { formatPropertyAddress } from '@/lib/utils/addressFormatter';

export class Page3BuilderV2 {
  private renderer: TemplateRenderer;
  private template = PAGE_TEMPLATES[2];

  constructor(
    private pdf: jsPDF,
    private data: Page3Config,
    private propertyImages?: Record<string, string>,
    private propertyCategory?: 'residential' | 'revenue' | 'both'
  ) {
    this.renderer = new TemplateRenderer(pdf);
    
    // Debug logging for property images
    const imageKeys = Object.keys(propertyImages || {});
    console.log(`[Page3BuilderV2] Constructor - received ${imageKeys.length} property images`);
    if (imageKeys.length > 0) {
      console.log('[Page3BuilderV2] Image keys:', imageKeys);
      // Log first image preview
      const firstKey = imageKeys.find(k => !['logo', 'areaMap', 'map'].includes(k));
      if (firstKey && propertyImages?.[firstKey]) {
        console.log(`[Page3BuilderV2] Sample image [${firstKey}]:`, propertyImages[firstKey].substring(0, 60) + '...');
      }
    } else {
      console.warn('[Page3BuilderV2] ⚠️ No property images received (will show placeholders)');
    }
  }

  /**
   * Build complete Page 3 using template system with table
   * @returns Final Y position after rendering
   */
  public build(): number {
    // Render page header using template
    const headerData = this.mapHeaderData();
    this.renderPageHeader(headerData);

    // Render comparable properties table (starts after title at Y=30 and subtitle at Y=37)
    const tableY = 44;  // Moved from 40 to 44mm to accommodate repositioned header
    this.renderComparablesTable(tableY);

    // Render AI insights at bottom if available
    this.renderAIInsights();

    return this.template.pageHeight || 279.4;
  }

  /**
   * Render page header (title and subtitle)
   */
  private renderPageHeader(data: { title: string; subtitle: string }): void {
    // Page title - positioned to clear header separator (at Y=25mm)
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(12); // Standardized: was 14, now 12 for section headers
    this.pdf.setTextColor(BRAND_COLORS.burgundy);
    this.pdf.text(data.title, MARGINS.left, 30); // Moved from MARGINS.top + 5 (20mm) to 30mm

    // Subtitle
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(9);
    this.pdf.setTextColor(BRAND_COLORS.mediumGray);
    this.pdf.text(data.subtitle, MARGINS.left, 37); // Moved from MARGINS.top + 12 (27mm) to 37mm
  }

  /**
   * Render comparable properties as a professional table
   */
  private renderComparablesTable(startY: number): void {
    const properties = this.prepareTableData();
    const isRevenue = this.propertyCategory === 'revenue';

    // Define table columns - different columns for revenue vs residential
    const columns: TableColumn[] = [
      {
        key: 'image',
        header: 'Photo',
        width: 22,
        align: 'center',
        renderCell: (pdf, value, x, y, width, height) => {
          renderPropertyThumbnail(pdf, value as string | undefined, x, y, width, height);
        },
      },
      {
        key: 'address',
        header: 'Address',
        width: 48,
        align: 'left',
        renderCell: (pdf, value, x, y, width, height) => {
          // Custom renderer for addresses to enable text wrapping
          const address = String(value || '');
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor('#333333');

          // Split text to fit within column width with padding
          const maxWidth = width - 4; // 2mm padding on each side
          const lines = pdf.splitTextToSize(address, maxWidth);

          // Calculate vertical centering for wrapped text
          const lineHeight = 3; // 3mm line height
          const totalHeight = lines.length * lineHeight;
          const startY = y + (height - totalHeight) / 2 + 2;

          // Render each line
          lines.forEach((line: string, index: number) => {
            pdf.text(line, x + 2, startY + index * lineHeight);
          });
        },
      },
      {
        key: 'centrisId',
        header: 'Centris ID',
        width: 20,
        align: 'center',
      },
      {
        key: 'status',
        header: 'Status',
        width: 18,
        align: 'center',
        renderCell: (pdf, value, x, y, width, height) => {
          renderStatusBadge(pdf, value as string, x, y, width, height);
        },
      },
      // Conditional columns based on property category
      ...(isRevenue ? [
        // Revenue property columns
        {
          key: 'gross_income_multiplier',
          header: 'GIM',
          width: 18,
          align: 'right',
          format: (value: unknown) => value ? Number(value).toFixed(2) + 'x' : 'N/A',
        },
        {
          key: 'potential_gross_revenue',
          header: 'PGI',
          width: 24,
          align: 'right',
          format: (value: unknown) => value ? formatCurrency(value as number) : 'N/A',
        },
      ] as TableColumn[] : [
        // Residential property columns
        {
          key: 'bedsBaths',
          header: 'Beds/Baths',
          width: 22,
          align: 'center',
        },
        {
          key: 'sqft',
          header: 'Sq.Ft.',
          width: 20,
          align: 'right',
          format: (value: unknown) => formatNumber(value as number),
        },
      ] as TableColumn[]),
      {
        key: 'price',
        header: 'Price',
        width: 30,
        align: 'right',
        format: (value: unknown) => formatCurrency(value as number),
      },
    ];

    // Render table
    renderTable(this.pdf, properties, {
      x: MARGINS.left,
      y: startY,
      columns,
      rowHeight: 20, // Increased to 20mm to accommodate multi-line addresses
      headerHeight: 10,
      fontSize: 8,
      headerFontSize: 9,
      alternateRowColor: true,
      showBorders: true,
      maxRows: 10, // Show top 10 comparables
    });
  }

  /**
   * Prepare table data from properties
   */
  private prepareTableData(): Array<{
    image: string | undefined;
    address: string;
    centrisId: string;
    status: string;
    bedsBaths?: string;
    sqft?: number | string;
    gross_income_multiplier?: number | string;
    potential_gross_revenue?: number | string;
    price: number;
  }> {
    // Try to get enriched properties with full address data
    let enrichedProps: any[] | null = null;
    if (this.propertyImages && '_enrichedProperties' in this.propertyImages) {
      try {
        enrichedProps = JSON.parse((this.propertyImages as any)._enrichedProperties);
        console.log('[Page3BuilderV2] Using enriched properties for full addresses');
        console.log('[Page3BuilderV2] Sample enriched property:', enrichedProps?.[0]);
      } catch (e) {
        console.warn('[Page3BuilderV2] Failed to parse enriched properties:', e);
      }
    }

    // CRITICAL: Use the EXACT properties passed from user selection (no re-sorting)
    // These are the properties the user explicitly selected in CMAComparablesTable
    // Only limit to 10 if more than 10 were passed (shouldn't happen with selection UI limit)
    const selectedProperties = [...this.data.allProperties].slice(0, 10);

    // Log the exact property IDs to verify we're showing what user selected
    console.log(`[Page3BuilderV2] Preparing table with ${selectedProperties.length} properties (received ${this.data.allProperties.length})`);
    console.log('[Page3BuilderV2] Property IDs in table:', selectedProperties.map((p: any) => p.centris_no || p.mls || p.id));

    return selectedProperties.map((prop, index) => {
      const propAny = prop as any; // Cast to access extended fields not in simplified type

      // Try to find matching enriched property for full address
      const enrichedProp = enrichedProps?.find((ep: any) => {
        const epId = (ep.centris_no || ep.mls || ep.id)?.toString();
        const propId = (propAny.centris_no || propAny.mls || prop.id)?.toString();
        return epId && propId && epId === propId;
      });

      // Get centris_no for image lookup (same key used when storing images in CMAReport.tsx)
      const centrisNo = propAny.centris_no || propAny.mls || prop.id;

      // Try all possible keys in priority order
      const possibleKeys = [
        centrisNo?.toString(), // Primary: centris_no used in CMAReport.tsx:234
        prop.id?.toString(), // Secondary: property.id used in CMAReport.tsx:236
        `comp${index + 1}`, // Tertiary: comp pattern used in CMAReport.tsx:238
        `property${index}` // Quaternary: property pattern used in CMAReport.tsx:239
      ].filter((k): k is string => Boolean(k));

      let propertyImage: string | undefined;
      let matchedKey: string | undefined;
      for (const key of possibleKeys) {
        if (this.propertyImages && this.propertyImages[key]) {
          propertyImage = this.propertyImages[key];
          matchedKey = key;
          break;
        }
      }

      // Debug logging for first 3 properties
      if (index < 3) {
        console.log(`[Page3BuilderV2] Property ${index}:`, {
          centrisNo: centrisNo?.toString(),
          propId: prop.id,
          possibleKeys,
          matchedKey,
          hasImage: !!propertyImage
        });
      }

      // If no image found, propertyImage remains undefined
      // TableRenderer will show placeholder in renderPropertyThumbnail

      // Format address with unit number support (for condos/apartments)
      const baseAddress = prop.address || propAny.municipality || 'Address unavailable';
      const fullAddress = formatPropertyAddress({
        address: baseAddress,
        propertyType: propAny.property_type || propAny.pt,
        unit_number: propAny.unit_number,
        suite_number: propAny.suite_number,
        apt_number: propAny.apartment
      });

      // Extract Centris/MLS ID - prefer enriched property data
      const centrisId = enrichedProp?.mls?.toString() ||
                       enrichedProp?.centris_no?.toString() ||
                       propAny.mls?.toString() ||
                       propAny.centris_no?.toString() ||
                       prop.id ||
                       'N/A';

      return {
        image: propertyImage,
        address: fullAddress,
        centrisId: centrisId,
        status: prop.status || 'Active',
        // Residential fields
        bedsBaths: `${prop.bedrooms || 'N/A'} / ${prop.bathrooms || 'N/A'}`,
        sqft: prop.squareFootage && prop.squareFootage > 0 ? prop.squareFootage : 'N/A',
        // Revenue fields - use actual field names from blob storage
        gross_income_multiplier: propAny.gross_income_multiplier || propAny.gim,
        potential_gross_revenue: propAny.potential_gross_revenue || propAny.pgi,
        price: prop.price || 0,
      };
    });
  }

  /**
   * Map header data for page title and subtitle
   */
  private mapHeaderData(): { title: string; subtitle: string } {
    const count = this.data.allProperties.length;
    const neighborhood = this.data.neighborhoodData?.name || 'the area';

    // Dynamic text based on count: "5 selected comparable properties" or "10 comparable properties"
    const subtitle = count === 1
      ? `1 comparable property in ${neighborhood}`
      : `${count} comparable properties in ${neighborhood} selected for analysis`;

    return {
      title: 'Comparable Properties',
      subtitle,
    };
  }

  /**
   * Render AI insights at bottom of page
   */
  private renderAIInsights(): void {
    const insightsY = 200; // Position AI insights near bottom

    if (this.data.aiInsights?.valueComparison) {
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setFontSize(12); // Standardized: was 10, now 12 for section headers
      this.pdf.setTextColor(BRAND_COLORS.darkGray);
      this.pdf.text('Market Insights', MARGINS.left, insightsY);

      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(9); // Standardized: was 8, now 9 for body text
      this.pdf.setTextColor(BRAND_COLORS.mediumGray);
      
      // Truncate AI insight to 400 chars to prevent overflow
      const valueComparison = this.data.aiInsights.valueComparison as string;
      const truncatedInsight = valueComparison.slice(0, 400);
      const insightText = this.pdf.splitTextToSize(
        truncatedInsight,
        180
      );
      this.pdf.text(insightText, MARGINS.left, insightsY + 6);
    }
  }
}
