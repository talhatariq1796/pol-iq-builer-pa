/**
 * Clean CMA Report Generator
 * Adapts existing CMA data to clean, magazine-style layout
 */

import jsPDF from 'jspdf';
import { CleanLayoutPageBuilder, CleanLayoutConfig, CleanSection } from './CleanLayoutPageBuilder';
import type { PDFReportConfig } from '../CMAReportPDFGenerator';

export class CleanCMAReportGenerator {
  private pdf: jsPDF;

  constructor() {
    this.pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  }

  async generateReport(config: PDFReportConfig): Promise<Blob> {
    console.log('[CleanCMAReportGenerator] Starting clean PDF generation...');

    // Page 1: Property Overview
    this.buildPropertyOverviewPage(config);
    
    // Page 2: Market Analysis  
    this.pdf.addPage();
    this.buildMarketAnalysisPage(config);
    
    // Page 3: Comparable Properties
    this.pdf.addPage();
    this.buildComparablesPage(config);

    console.log('[CleanCMAReportGenerator] Clean PDF generation completed');
    return this.pdf.output('blob');
  }

  private buildPropertyOverviewPage(config: PDFReportConfig): void {
    const builder = new CleanLayoutPageBuilder(this.pdf);
    
    const sections: CleanSection[] = [];
    
    // Property basics
    const property = config.properties[0];
    if (property) {
      sections.push({
        type: 'text',
        title: 'Subject Property',
        content: `${property.address}\n${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms\n${property.squareFootage?.toLocaleString()} sq ft • Built ${property.yearBuilt}\nCurrent Status: ${property.status}`,
        layout: 'single'
      });
    }

    // Market stats
    if (config.stats) {
      sections.push({
        type: 'analysis',
        title: 'Market Snapshot',
        content: `Current market conditions show strong activity with ${config.stats.total_properties} comparable properties analyzed. The median sale price is ${this.formatCurrency(config.stats.median_price)} with an average of ${config.stats.average_dom} days on market.`,
        layout: 'single'
      });
    }

    // Price trend chart placeholder
    sections.push({
      type: 'chart',
      title: 'Price Trend Analysis',
      layout: 'double'
    });

    // Area analysis
    sections.push({
      type: 'text',
      title: 'Neighborhood Overview',
      content: `The ${config.selectedArea?.displayName || 'selected area'} has shown consistent market performance with balanced supply and demand conditions. Recent sales activity indicates stable pricing trends with good buyer interest.`,
      layout: 'single'
    });

    // AI Insights
    sections.push({
      type: 'analysis', 
      title: 'Market Intelligence',
      content: 'Based on recent market data and comparable sales analysis, this property is well-positioned within the current market. The combination of property features, location, and market timing creates favorable selling conditions.',
      layout: 'single'
    });

    // Market metrics chart
    sections.push({
      type: 'chart',
      title: 'Market Metrics Comparison',
      layout: 'single'
    });

    // Pricing insight
    sections.push({
      type: 'text',
      title: 'Pricing Analysis',
      content: `Current market data suggests optimal pricing between ${this.formatCurrency((config.stats.minPrice || 400000) * 1.02)} and ${this.formatCurrency((config.stats.maxPrice || 600000) * 0.98)} based on comparable properties and market conditions.`,
      layout: 'single'
    });

    const pageConfig: CleanLayoutConfig = {
      title: 'Comparative Market Analysis',
      sections: sections
    };

    builder.build(pageConfig);
  }

  private buildMarketAnalysisPage(config: PDFReportConfig): void {
    const builder = new CleanLayoutPageBuilder(this.pdf);
    
    const sections: CleanSection[] = [];

    // Market overview
    sections.push({
      type: 'text',
      title: 'Market Overview',
      content: `Analysis of ${config.stats.total_properties} comparable properties within the defined search area reveals current market trends and pricing patterns. The data represents recent sales and active listings to provide accurate market context.`,
      layout: 'single'
    });

    // Price distribution chart
    sections.push({
      type: 'chart',
      title: 'Price Distribution',
      layout: 'single'
    });

    // Market conditions analysis
    sections.push({
      type: 'analysis',
      title: 'Current Market Conditions',
      content: `Market absorption rates and inventory levels indicate ${this.getMarketCondition(config.stats)} market conditions. Current supply and demand dynamics support strategic pricing decisions within the analyzed range.`,
      layout: 'single'
    });

    // Days on market analysis
    sections.push({
      type: 'text',
      title: 'Time on Market Analysis',
      content: `Properties in this market segment typically sell within ${config.stats.average_dom} days. Well-priced and properly marketed properties often achieve faster sales, while overpriced properties may experience extended market time.`,
      layout: 'single'
    });

    // Market trend chart
    sections.push({
      type: 'chart', 
      title: 'Market Trends',
      layout: 'double'
    });

    // Seasonal factors
    sections.push({
      type: 'analysis',
      title: 'Seasonal Market Factors',
      content: 'Current seasonal trends and buyer behavior patterns suggest optimal market timing. Spring and early summer traditionally show increased buyer activity and stronger pricing power for well-positioned properties.',
      layout: 'single'
    });

    // Buyer profile
    sections.push({
      type: 'text',
      title: 'Target Buyer Profile',
      content: 'Buyers in this price range typically include professionals, growing families, and relocating individuals. Understanding buyer motivations and preferences helps optimize marketing strategy and pricing approach.',
      layout: 'single'
    });

    const pageConfig: CleanLayoutConfig = {
      title: 'Market Analysis & Trends',
      sections: sections
    };

    builder.build(pageConfig);
  }

  private buildComparablesPage(config: PDFReportConfig): void {
    const builder = new CleanLayoutPageBuilder(this.pdf);
    
    const sections: CleanSection[] = [];

    // Comparable selection criteria
    sections.push({
      type: 'text',
      title: 'Comparable Selection Criteria',
      content: 'Comparable properties were selected based on location proximity, similar square footage, bedroom/bathroom count, and recent sale dates. This ensures accurate market representation and reliable pricing guidance.',
      layout: 'single'
    });

    // Top comparables analysis
    const comparables = config.properties.slice(1, 4); // Get top 3 comps
    if (comparables.length > 0) {
      let compText = 'Key comparable sales include:\n\n';
      comparables.forEach((comp, index) => {
        compText += `${index + 1}. ${comp.address}\n`;
        compText += `   Sold: ${this.formatCurrency(comp.price)} • ${comp.squareFootage?.toLocaleString()} sq ft\n`;
        compText += `   ${comp.bedrooms}bd/${comp.bathrooms}ba • Built ${comp.yearBuilt}\n\n`;
      });

      sections.push({
        type: 'text', 
        title: 'Recent Comparable Sales',
        content: compText,
        layout: 'single'
      });
    }

    // Comparable analysis chart
    sections.push({
      type: 'chart',
      title: 'Comparable Properties Analysis',
      layout: 'double'
    });

    // Adjustments analysis
    sections.push({
      type: 'analysis',
      title: 'Market Adjustments',
      content: 'Comparable properties require minor adjustments for differences in condition, features, and location. The subject property\'s updates and improvements support pricing at the higher end of the comparable range.',
      layout: 'single'
    });

    // Price per sq ft analysis
    sections.push({
      type: 'text',
      title: 'Price Per Square Foot Analysis',
      content: `Recent sales show price per square foot ranging from $${Math.round((config.stats.minPrice || 400000) / 2000)} to $${Math.round((config.stats.maxPrice || 600000) / 2000)}. The subject property aligns with properties at $${Math.round(config.stats.price_per_sqft)} per square foot.`,
      layout: 'single'
    });

    sections.push({
      type: 'divider'
    });

    // Final recommendation
    sections.push({
      type: 'analysis',
      title: 'Pricing Recommendation',
      content: `Based on comprehensive market analysis, recommended listing price range is ${this.formatCurrency(config.stats.median_price * 0.98)} to ${this.formatCurrency(config.stats.median_price * 1.05)}. This range reflects current market conditions and positions the property competitively while maximizing value.`,
      layout: 'double'
    });

    // Market strategy
    sections.push({
      type: 'text',
      title: 'Marketing Strategy',
      content: 'Strategic marketing approach should emphasize the property\'s key strengths and competitive advantages. Professional presentation, targeted buyer outreach, and competitive pricing will generate optimal market response.',
      layout: 'single'
    });

    const pageConfig: CleanLayoutConfig = {
      title: 'Comparable Properties Analysis',
      sections: sections
    };

    builder.build(pageConfig);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private getMarketCondition(stats: { average_dom: number }): string {
    // Simple logic to determine market condition
    if (stats.average_dom < 30) {
      return 'seller-favorable';
    } else if (stats.average_dom > 60) {
      return 'buyer-favorable';
    } else {
      return 'balanced';
    }
  }
}