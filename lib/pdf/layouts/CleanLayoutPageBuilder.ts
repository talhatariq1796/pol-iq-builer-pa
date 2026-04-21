/**
 * Clean Layout Page Builder
 * Produces clean, magazine-style layout with 2 columns and integrated charts
 * Based on modern infographic design principles
 */

import jsPDF from 'jspdf';
import { ElementRenderer, Element } from '../core/ElementRenderer';

/**
 * Clean Design System - Simplified
 */
const CleanDesign = {
  colors: {
    // Only use these colors - no solid fills!
    text: {
      heading: '#333333',     // Dark grey for headings
      body: '#555555',        // Medium grey for body text
      light: '#888888',       // Light grey for captions
    },
    accents: {
      primary: '#D1A0C7',     // Light burgundy for charts/accents
      secondary: '#E74C3C',   // Clean red for highlights
      success: '#27AE60',     // Clean green for positive
    },
    backgrounds: {
      page: '#FFFFFF',        // Pure white page
      subtle: '#FAFBFC',      // Very subtle grey sections
      chart: '#F8F9FA',       // Light grey chart backgrounds
    },
    lines: {
      border: '#E1E8ED',      // Light borders
      grid: '#F1F3F4',        // Grid lines
    }
  },
  
  typography: {
    // Only 3 font sizes to avoid "too many font sizes"
    title: { size: 16, weight: 'bold', font: 'helvetica' },      // Page titles
    heading: { size: 12, weight: 'bold', font: 'helvetica' },   // Section headings  
    body: { size: 9, weight: 'normal', font: 'helvetica' },     // All body text
  },
  
  spacing: {
    // Consistent spacing system
    xs: 2,    // 2mm
    sm: 4,    // 4mm
    md: 8,    // 8mm
    lg: 12,   // 12mm
    xl: 20,   // 20mm
  },
  
  layout: {
    // 2-column layout system
    pageWidth: 210,      // A4 width
    pageHeight: 297,     // A4 height
    margin: 15,          // 15mm margins
    columnGap: 10,       // 10mm gap between columns
    get columnWidth() {
      return (this.pageWidth - (this.margin * 2) - this.columnGap) / 2;
    }
  }
};

export interface CleanLayoutConfig {
  title: string;
  sections: CleanSection[];
}

export interface CleanSection {
  type: 'text' | 'chart' | 'analysis' | 'divider';
  title?: string;
  content?: string;
  chartData?: Record<string, unknown>;
  layout?: 'single' | 'double'; // single = 1 column, double = 2 columns
}

/**
 * Clean Layout Page Builder
 * Creates magazine-style flowing layout
 */
export class CleanLayoutPageBuilder {
  private pdf: jsPDF;
  private renderer: ElementRenderer;
  private currentY: number;
  private currentColumn: 1 | 2;
  private leftColumnY: number;
  private rightColumnY: number;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
    this.renderer = new ElementRenderer(pdf);
    this.currentY = CleanDesign.layout.margin;
    this.currentColumn = 1;
    this.leftColumnY = CleanDesign.layout.margin;
    this.rightColumnY = CleanDesign.layout.margin;
  }

  build(config: CleanLayoutConfig): number {
    const elements: Element[] = [];
    
    // Page title - full width
    elements.push(...this.createPageTitle(config.title));
    
    // Process sections in flowing layout
    for (const section of config.sections) {
      elements.push(...this.createSection(section));
    }
    
    this.renderer.renderElements(elements);
    return Math.max(this.leftColumnY, this.rightColumnY);
  }

  private createPageTitle(title: string): Element[] {
    const y = this.currentY;
    const elements: Element[] = [];
    
    // Simple title - no boxes or backgrounds
    elements.push({
      type: 'text',
      text: title,
      x: CleanDesign.layout.margin,
      y: y + CleanDesign.typography.title.size,
      style: {
        font: CleanDesign.typography.title.font,
        fontSize: CleanDesign.typography.title.size,
        weight: CleanDesign.typography.title.weight
      },
      color: CleanDesign.colors.text.heading
    });
    
    // Subtle line under title
    elements.push({
      type: 'line',
      x1: CleanDesign.layout.margin,
      y1: y + CleanDesign.typography.title.size + CleanDesign.spacing.sm,
      x2: CleanDesign.layout.pageWidth - CleanDesign.layout.margin,
      y2: y + CleanDesign.typography.title.size + CleanDesign.spacing.sm,
      strokeColor: CleanDesign.colors.lines.border,
      strokeWidth: 0.5
    });
    
    this.currentY = y + CleanDesign.typography.title.size + CleanDesign.spacing.lg;
    this.leftColumnY = this.currentY;
    this.rightColumnY = this.currentY;
    
    return elements;
  }

  private createSection(section: CleanSection): Element[] {
    const elements: Element[] = [];
    
    switch (section.type) {
      case 'text':
        elements.push(...this.createTextSection(section));
        break;
      case 'analysis':
        elements.push(...this.createAnalysisSection(section));
        break;
      case 'chart':
        elements.push(...this.createChartSection(section));
        break;
      case 'divider':
        elements.push(...this.createDivider());
        break;
    }
    
    return elements;
  }

  private createTextSection(section: CleanSection): Element[] {
    const elements: Element[] = [];
    const columnWidth = CleanDesign.layout.columnWidth;
    
    // Determine which column to use
    const useColumn = this.getNextColumn(section.layout);
    const x = useColumn === 1 
      ? CleanDesign.layout.margin 
      : CleanDesign.layout.margin + columnWidth + CleanDesign.layout.columnGap;
    
    const startY = useColumn === 1 ? this.leftColumnY : this.rightColumnY;
    let y = startY;
    
    // Section heading (if provided)
    if (section.title) {
      elements.push({
        type: 'text',
        text: section.title,
        x: x,
        y: y + CleanDesign.typography.heading.size,
        style: {
          font: CleanDesign.typography.heading.font,
          fontSize: CleanDesign.typography.heading.size,
          weight: CleanDesign.typography.heading.weight
        },
        color: CleanDesign.colors.text.heading
      });
      y += CleanDesign.typography.heading.size + CleanDesign.spacing.sm;
    }
    
    // Body text
    if (section.content) {
      const textLines = this.wrapText(section.content, columnWidth);
      const lineHeight = CleanDesign.typography.body.size * 1.4;
      
      textLines.forEach((line, index) => {
        elements.push({
          type: 'text',
          text: line,
          x: x,
          y: y + CleanDesign.typography.body.size + (index * lineHeight),
          style: {
            font: CleanDesign.typography.body.font,
            fontSize: CleanDesign.typography.body.size,
            weight: CleanDesign.typography.body.weight
          },
          color: CleanDesign.colors.text.body
        });
      });
      
      y += (textLines.length * lineHeight) + CleanDesign.spacing.md;
    }
    
    // Update column position
    if (useColumn === 1) {
      this.leftColumnY = y;
    } else {
      this.rightColumnY = y;
    }
    
    return elements;
  }

  private createAnalysisSection(section: CleanSection): Element[] {
    const elements: Element[] = [];
    
    // AI Analysis - subtle highlight, not solid box
    const columnWidth = CleanDesign.layout.columnWidth;
    const useColumn = this.getNextColumn(section.layout);
    const x = useColumn === 1 
      ? CleanDesign.layout.margin 
      : CleanDesign.layout.margin + columnWidth + CleanDesign.layout.columnGap;
    
    const startY = useColumn === 1 ? this.leftColumnY : this.rightColumnY;
    let y = startY;
    
    // Subtle background (very light)
    const textLines = this.wrapText(section.content || '', columnWidth - CleanDesign.spacing.md);
    const sectionHeight = (textLines.length * CleanDesign.typography.body.size * 1.4) + CleanDesign.spacing.md;
    
    elements.push({
      type: 'rect',
      x: x - CleanDesign.spacing.xs,
      y: y - CleanDesign.spacing.xs,
      width: columnWidth + (CleanDesign.spacing.xs * 2),
      height: sectionHeight,
      color: CleanDesign.colors.backgrounds.subtle
    });
    
    // Left border accent (thin line)
    elements.push({
      type: 'rect',
      x: x - CleanDesign.spacing.xs,
      y: y - CleanDesign.spacing.xs,
      width: 2,
      height: sectionHeight,
      color: CleanDesign.colors.accents.primary
    });
    
    // Analysis text
    if (section.title) {
      elements.push({
        type: 'text',
        text: section.title,
        x: x,
        y: y + CleanDesign.typography.heading.size,
        style: {
          font: CleanDesign.typography.heading.font,
          fontSize: CleanDesign.typography.heading.size,
          weight: CleanDesign.typography.heading.weight
        },
        color: CleanDesign.colors.text.heading
      });
      y += CleanDesign.typography.heading.size + CleanDesign.spacing.sm;
    }
    
    textLines.forEach((line, index) => {
      const lineHeight = CleanDesign.typography.body.size * 1.4;
      elements.push({
        type: 'text',
        text: line,
        x: x,
        y: y + CleanDesign.typography.body.size + (index * lineHeight),
        style: {
          font: CleanDesign.typography.body.font,
          fontSize: CleanDesign.typography.body.size,
          weight: CleanDesign.typography.body.weight
        },
        color: CleanDesign.colors.text.body
      });
    });
    
    const finalY = y + (textLines.length * CleanDesign.typography.body.size * 1.4) + CleanDesign.spacing.md;
    
    // Update column position
    if (useColumn === 1) {
      this.leftColumnY = finalY;
    } else {
      this.rightColumnY = finalY;
    }
    
    return elements;
  }

  private createChartSection(section: CleanSection): Element[] {
    const elements: Element[] = [];
    
    // Simple placeholder for chart (would integrate with your chart system)
    const useFullWidth = section.layout === 'double';
    const width = useFullWidth 
      ? (CleanDesign.layout.pageWidth - (CleanDesign.layout.margin * 2))
      : CleanDesign.layout.columnWidth;
    
    const x = useFullWidth 
      ? CleanDesign.layout.margin 
      : (this.getNextColumn(section.layout) === 1 
          ? CleanDesign.layout.margin 
          : CleanDesign.layout.margin + CleanDesign.layout.columnWidth + CleanDesign.layout.columnGap);
    
    const y = useFullWidth 
      ? Math.max(this.leftColumnY, this.rightColumnY) 
      : (this.getNextColumn(section.layout) === 1 ? this.leftColumnY : this.rightColumnY);
    
    const chartHeight = 60; // 60mm chart height
    
    // Chart background (very subtle)
    elements.push({
      type: 'rect',
      x: x,
      y: y,
      width: width,
      height: chartHeight,
      color: CleanDesign.colors.backgrounds.chart
    });
    
    // Chart title
    if (section.title) {
      elements.push({
        type: 'text',
        text: section.title,
        x: x + CleanDesign.spacing.sm,
        y: y + CleanDesign.spacing.sm + CleanDesign.typography.heading.size,
        style: {
          font: CleanDesign.typography.heading.font,
          fontSize: CleanDesign.typography.heading.size,
          weight: CleanDesign.typography.heading.weight
        },
        color: CleanDesign.colors.text.heading
      });
    }
    
    // Placeholder chart content (integrate with your ChartHelpers)
    elements.push({
      type: 'text',
      text: '[Chart: ' + (section.title || 'Untitled') + ']',
      x: x + width/2,
      y: y + chartHeight/2,
      style: {
        font: CleanDesign.typography.body.font,
        fontSize: CleanDesign.typography.body.size,
        weight: CleanDesign.typography.body.weight
      },
      color: CleanDesign.colors.text.light,
      align: 'center'
    });
    
    const finalY = y + chartHeight + CleanDesign.spacing.md;
    
    // Update positions
    if (useFullWidth) {
      this.leftColumnY = finalY;
      this.rightColumnY = finalY;
    } else if (this.getNextColumn(section.layout) === 1) {
      this.leftColumnY = finalY;
    } else {
      this.rightColumnY = finalY;
    }
    
    return elements;
  }

  private createDivider(): Element[] {
    const y = Math.max(this.leftColumnY, this.rightColumnY) + CleanDesign.spacing.md;
    
    const elements: Element[] = [{
      type: 'line',
      x1: CleanDesign.layout.margin,
      y1: y,
      x2: CleanDesign.layout.pageWidth - CleanDesign.layout.margin,
      y2: y,
      strokeColor: CleanDesign.colors.lines.border,
      strokeWidth: 0.5
    }];
    
    this.leftColumnY = y + CleanDesign.spacing.md;
    this.rightColumnY = y + CleanDesign.spacing.md;
    
    return elements;
  }

  private getNextColumn(layout?: 'single' | 'double'): 1 | 2 {
    if (layout === 'double') {
      return 1; // Full width content goes in "column 1" position
    }
    
    // Use the shorter column
    return this.leftColumnY <= this.rightColumnY ? 1 : 2;
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    // Rough character width estimation
    const charWidth = CleanDesign.typography.body.size * 0.6;
    const maxCharsPerLine = Math.floor(maxWidth / charWidth);
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }
}