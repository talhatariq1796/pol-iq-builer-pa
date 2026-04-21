/**
 * Chart Annotations & Callouts System
 * 
 * Adds data insights, trend indicators, and contextual annotations to charts
 * in PDF reports. Works with both Chart.js rendered charts and jsPDF vector charts.
 */

import type jsPDF from 'jspdf';
import { BRAND_COLORS } from '../components/KPICard';

export interface ChartAnnotation {
  /** Type of annotation */
  type: 'callout' | 'trend' | 'highlight' | 'warning' | 'insight';
  
  /** Position on chart (percentage 0-100) */
  position: {
    x: number; // 0-100% from left
    y: number; // 0-100% from top
  };
  
  /** Annotation text */
  text: string;
  
  /** Optional icon */
  icon?: '📈' | '📉' | '⚡' | '⚠' | '💡' | '🎯' | '✓';
  
  /** Optional color override */
  color?: string;
  
  /** Show leader line to data point */
  showLeaderLine?: boolean;
}

export interface ChartCalloutOptions {
  /** Chart boundaries in mm */
  chartBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  /** Maximum callout width in mm */
  maxWidth?: number;
  
  /** Font size for callout text */
  fontSize?: number;
  
  /** Background color for callout box */
  backgroundColor?: string;
  
  /** Border color */
  borderColor?: string;
}

/**
 * Chart Annotation Renderer
 * Adds contextual insights and callouts to charts
 */
export class ChartAnnotationRenderer {
  constructor(private pdf: jsPDF) {}

  /**
   * Render a callout annotation on a chart
   * 
   * @param annotation - Annotation configuration
   * @param options - Rendering options including chart bounds
   */
  renderCallout(annotation: ChartAnnotation, options: ChartCalloutOptions): void {
    const { chartBounds, maxWidth = 40, fontSize = 7, backgroundColor, borderColor } = options;
    
    // Calculate absolute position from percentage
    const absX = chartBounds.x + (chartBounds.width * annotation.position.x / 100);
    const absY = chartBounds.y + (chartBounds.height * annotation.position.y / 100);

    // Get annotation styling based on type
    const style = this.getAnnotationStyle(annotation.type, annotation.color);

    // Draw leader line if requested
    if (annotation.showLeaderLine) {
      this.drawLeaderLine(absX, absY, style.color);
    }

    // Calculate callout box position (offset from data point)
    const calloutOffset = this.calculateCalloutOffset(
      annotation.position,
      chartBounds,
      maxWidth
    );
    const calloutX = absX + calloutOffset.x;
    const calloutY = absY + calloutOffset.y;

    // Render callout box
    this.renderCalloutBox(
      calloutX,
      calloutY,
      annotation.text,
      annotation.icon,
      {
        maxWidth,
        fontSize,
        backgroundColor: backgroundColor || style.backgroundColor,
        borderColor: borderColor || style.borderColor,
        textColor: style.textColor,
      }
    );
  }

  /**
   * Render multiple annotations on a chart
   */
  renderAnnotations(annotations: ChartAnnotation[], options: ChartCalloutOptions): void {
    annotations.forEach(annotation => {
      this.renderCallout(annotation, options);
    });
  }

  /**
   * Add trend indicator to chart
   * Shows trend direction and percentage change
   */
  renderTrendIndicator(
    chartBounds: { x: number; y: number; width: number; height: number },
    trendPercent: number,
    label?: string
  ): void {
    const isPositive = trendPercent >= 0;
    const icon = isPositive ? '📈' : '📉';
    const color = isPositive ? BRAND_COLORS.darkGray : BRAND_COLORS.burgundy;
    
    // Position at top-right of chart
    const x = chartBounds.x + chartBounds.width - 35;
    const y = chartBounds.y + 5;

    // Draw trend box
    this.pdf.setFillColor(color);
    this.pdf.roundedRect(x, y, 30, 8, 1.5, 1.5, 'F');

    // Draw trend text
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(8);
    this.pdf.setTextColor('#FFFFFF');
    const trendText = `${icon} ${isPositive ? '+' : ''}${trendPercent.toFixed(1)}%`;
    this.pdf.text(trendText, x + 15, y + 5.5, { align: 'center' });

    // Optional label below
    if (label) {
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(BRAND_COLORS.gray);
      this.pdf.text(label, x + 15, y + 11, { align: 'center' });
    }

    // Reset colors
    this.pdf.setTextColor(BRAND_COLORS.darkGray);
  }

  /**
   * Highlight a specific data point on chart
   */
  renderDataPointHighlight(
    x: number,
    y: number,
    value: string,
    options?: {
      color?: string;
      icon?: string;
      size?: number;
    }
  ): void {
    const highlightColor = options?.color || BRAND_COLORS.burgundy;
    const size = options?.size || 4;

    // Draw highlight circle
    this.pdf.setFillColor(highlightColor);
    this.pdf.circle(x, y, size, 'F');

    // Draw white border
    this.pdf.setDrawColor('#FFFFFF');
    this.pdf.setLineWidth(1);
    this.pdf.circle(x, y, size, 'D');

    // Draw value label above point
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(highlightColor);
    const labelY = y - size - 3;
    
    if (options?.icon) {
      this.pdf.setFontSize(8);
      this.pdf.text(options.icon, x, labelY - 1, { align: 'center' });
      this.pdf.setFontSize(7);
      this.pdf.text(value, x, labelY + 3, { align: 'center' });
    } else {
      this.pdf.text(value, x, labelY, { align: 'center' });
    }

    // Reset
    this.pdf.setTextColor(BRAND_COLORS.darkGray);
    this.pdf.setDrawColor(BRAND_COLORS.darkGray);
  }

  /**
   * Add insight box next to chart
   * For key findings or recommendations
   */
  renderInsightBox(
    x: number,
    y: number,
    width: number,
    insight: string,
    icon?: string
  ): void {
    const padding = 3;
    const iconSize = 5;
    
    // Calculate height based on text
    this.pdf.setFontSize(8);
    const lines = this.pdf.splitTextToSize(insight, width - padding * 2 - (icon ? iconSize + 2 : 0));
    const height = padding * 2 + lines.length * 3;

    // Draw background box
    this.pdf.setFillColor('#FFF9E6'); // Light yellow background
    this.pdf.roundedRect(x, y, width, height, 1, 1, 'F');

    // Draw border
    this.pdf.setDrawColor(BRAND_COLORS.darkGray);
    this.pdf.setLineWidth(0.5);
    this.pdf.roundedRect(x, y, width, height, 1, 1, 'D');

    // Draw icon if provided
    let textX = x + padding;
    if (icon) {
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(BRAND_COLORS.burgundy);
      this.pdf.text(icon, x + padding, y + padding + 3);
      textX += iconSize + 2;
    }

    // Draw insight text
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(BRAND_COLORS.darkGray);
    this.pdf.text(lines, textX, y + padding + 3);

    // Reset
    this.pdf.setTextColor(BRAND_COLORS.darkGray);
    this.pdf.setDrawColor(BRAND_COLORS.darkGray);
  }

  /**
   * Get styling for annotation type
   */
  private getAnnotationStyle(type: ChartAnnotation['type'], customColor?: string): {
    color: string;
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  } {
    interface StyleConfig {
      color: string;
      backgroundColor: string;
      borderColor: string;
      textColor: string;
    }
    const styles: Record<ChartAnnotation['type'], StyleConfig> = {
      callout: {
        color: customColor || BRAND_COLORS.burgundy,
        backgroundColor: '#FFFFFF',
        borderColor: BRAND_COLORS.burgundy,
        textColor: BRAND_COLORS.darkGray,
      },
      trend: {
        color: customColor || BRAND_COLORS.dark1,
        backgroundColor: '#F0F0F0',
        borderColor: BRAND_COLORS.dark1,
        textColor: BRAND_COLORS.darkGray,
      },
      highlight: {
        color: customColor || BRAND_COLORS.dark2,
        backgroundColor: '#FFF9E6',
        borderColor: BRAND_COLORS.dark2,
        textColor: BRAND_COLORS.darkGray,
      },
      warning: {
        color: customColor || '#F7A800',
        backgroundColor: '#FFF3E0',
        borderColor: '#F7A800',
        textColor: '#E65100',
      },
      insight: {
        color: customColor || BRAND_COLORS.dark3,
        backgroundColor: '#F3E5F5',
        borderColor: BRAND_COLORS.dark3,
        textColor: BRAND_COLORS.darkGray,
      },
    };

    return styles[type];
  }

  /**
   * Draw leader line from data point to callout
   */
  private drawLeaderLine(x: number, y: number, color: string): void {
    this.pdf.setDrawColor(color);
    this.pdf.setLineWidth(0.5);
    
    // Draw short leader line (5mm at 45 degrees)
    const leaderLength = 5;
    const angle = -Math.PI / 4; // 45 degrees up-right
    const endX = x + leaderLength * Math.cos(angle);
    const endY = y + leaderLength * Math.sin(angle);
    
    this.pdf.line(x, y, endX, endY);
    
    // Reset
    this.pdf.setDrawColor(BRAND_COLORS.darkGray);
  }

  /**
   * Calculate callout offset based on position to avoid chart edges
   */
  private calculateCalloutOffset(
    position: { x: number; y: number },
    chartBounds: { x: number; y: number; width: number; height: number },
    calloutWidth: number
  ): { x: number; y: number } {
    // Default: place callout to the right and above data point
    let offsetX = 7;
    let offsetY = -10;

    // If too far right, place to the left
    if (position.x > 70) {
      offsetX = -(calloutWidth + 7);
    }

    // If too high, place below
    if (position.y < 30) {
      offsetY = 3;
    }

    return { x: offsetX, y: offsetY };
  }

  /**
   * Render the actual callout box with text
   */
  private renderCalloutBox(
    x: number,
    y: number,
    text: string,
    icon: string | undefined,
    options: {
      maxWidth: number;
      fontSize: number;
      backgroundColor: string;
      borderColor: string;
      textColor: string;
    }
  ): void {
    const padding = 2;
    const iconWidth = icon ? 5 : 0;
    const iconGap = icon ? 2 : 0;

    // Split text to fit width
    this.pdf.setFontSize(options.fontSize);
    const textWidth = options.maxWidth - padding * 2 - iconWidth - iconGap;
    const lines = this.pdf.splitTextToSize(text, textWidth);
    const lineHeight = options.fontSize * 0.4;
    const boxHeight = padding * 2 + lines.length * lineHeight;

    // Draw box background
    this.pdf.setFillColor(options.backgroundColor);
    this.pdf.roundedRect(x, y, options.maxWidth, boxHeight, 1, 1, 'F');

    // Draw border
    this.pdf.setDrawColor(options.borderColor);
    this.pdf.setLineWidth(0.5);
    this.pdf.roundedRect(x, y, options.maxWidth, boxHeight, 1, 1, 'D');

    // Draw icon if provided
    let textX = x + padding;
    if (icon) {
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(options.fontSize + 1);
      this.pdf.setTextColor(options.borderColor);
      this.pdf.text(icon, x + padding, y + padding + lineHeight);
      textX += iconWidth + iconGap;
    }

    // Draw text
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(options.fontSize);
    this.pdf.setTextColor(options.textColor);
    lines.forEach((line: string, index: number) => {
      this.pdf.text(line, textX, y + padding + lineHeight * (index + 1));
    });

    // Reset
    this.pdf.setTextColor(BRAND_COLORS.darkGray);
    this.pdf.setDrawColor(BRAND_COLORS.darkGray);
  }
}

/**
 * Helper: Generate common annotations for market data
 */
export class MarketAnnotationHelper {
  /**
   * Generate annotations for price trend chart
   */
  static priceTrendAnnotations(
    priceData: number[],
    labels: string[]
  ): ChartAnnotation[] {
    const annotations: ChartAnnotation[] = [];
    
    // Find peak price
    const maxPrice = Math.max(...priceData);
    const maxIndex = priceData.indexOf(maxPrice);
    const maxPercent = (maxIndex / (priceData.length - 1)) * 100;
    
    annotations.push({
      type: 'highlight',
      position: { x: maxPercent, y: 10 },
      text: `Peak: ${labels[maxIndex]}`,
      icon: '🎯',
      showLeaderLine: true,
    });

    // Find biggest increase
    let maxIncrease = 0;
    let increaseIndex = 0;
    for (let i = 1; i < priceData.length; i++) {
      const increase = priceData[i] - priceData[i - 1];
      if (increase > maxIncrease) {
        maxIncrease = increase;
        increaseIndex = i;
      }
    }

    if (maxIncrease > 0) {
      const increasePercent = (increaseIndex / (priceData.length - 1)) * 100;
      annotations.push({
        type: 'trend',
        position: { x: increasePercent, y: 50 },
        text: `Largest gain`,
        icon: '📈',
        showLeaderLine: false,
      });
    }

    // Overall trend
    const overallChange = ((priceData[priceData.length - 1] - priceData[0]) / priceData[0]) * 100;
    annotations.push({
      type: 'insight',
      position: { x: 85, y: 85 },
      text: `${overallChange > 0 ? '+' : ''}${overallChange.toFixed(1)}% overall`,
      icon: '💡',
      showLeaderLine: false,
    });

    return annotations;
  }

  /**
   * Generate annotations for inventory chart
   */
  static inventoryAnnotations(
    inventoryData: number[],
    labels: string[]
  ): ChartAnnotation[] {
    const annotations: ChartAnnotation[] = [];
    
    // Find lowest inventory (seller's market)
    const minInventory = Math.min(...inventoryData);
    const minIndex = inventoryData.indexOf(minInventory);
    const minPercent = (minIndex / (inventoryData.length - 1)) * 100;
    
    if (minInventory < 50) { // Low inventory threshold
      annotations.push({
        type: 'warning',
        position: { x: minPercent, y: 15 },
        text: `Lowest: ${labels[minIndex]}`,
        icon: '⚡',
        showLeaderLine: true,
      });
    }

    return annotations;
  }

  /**
   * Generate annotations for days on market chart
   */
  static daysOnMarketAnnotations(
    domData: number[]
  ): ChartAnnotation[] {
    const annotations: ChartAnnotation[] = [];
    
    // Check if DOM is trending down (hot market)
    const recentTrend = domData.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const earlierTrend = domData.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const trendChange = ((recentTrend - earlierTrend) / earlierTrend) * 100;

    if (trendChange < -10) { // Significant decrease in DOM
      annotations.push({
        type: 'trend',
        position: { x: 75, y: 20 },
        text: 'Hot market: Properties selling faster',
        icon: '⚡',
        showLeaderLine: false,
      });
    } else if (trendChange > 10) { // Significant increase in DOM
      annotations.push({
        type: 'warning',
        position: { x: 75, y: 20 },
        text: 'Cooling market: Longer selling times',
        icon: '⚠',
        showLeaderLine: false,
      });
    }

    return annotations;
  }
}
