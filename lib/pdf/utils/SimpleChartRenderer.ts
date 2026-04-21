/**
 * Simple Chart Renderer using pure jsPDF shapes
 * No canvas dependency - works on Vercel serverless
 *
 * Provides basic chart placeholders when client doesn't provide chart images
 */

import type jsPDF from 'jspdf';

export interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface ChartOptions {
  width: number;
  height: number;
  title?: string;
  showLabels?: boolean;
  showValues?: boolean;
}

/**
 * Simple Chart Renderer - Pure jsPDF Implementation
 */
export class SimpleChartRenderer {
  private pdf: jsPDF;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
  }

  /**
   * Draw a simple bar chart
   */
  drawBarChart(
    x: number,
    y: number,
    data: ChartData,
    options: ChartOptions
  ): void {
    const { width, height, title, showLabels = true, showValues = false } = options;
    const colors = data.colors || this.getDefaultColors(data.values.length);

    // Title
    if (title) {
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(33, 33, 33);
      this.pdf.text(title, x, y - 3);
      y += 2; // Adjust for title spacing
    }

    // Chart area background
    this.pdf.setFillColor(250, 250, 250);
    this.pdf.rect(x, y, width, height, 'F');

    // Calculate bar dimensions
    const barCount = data.values.length;
    const barSpacing = 4;
    const totalSpacing = barSpacing * (barCount + 1);
    const availableWidth = width - totalSpacing;
    const barWidth = availableWidth / barCount;
    const maxValue = Math.max(...data.values, 1); // Prevent division by zero

    // Draw bars
    data.values.forEach((value, index) => {
      const barHeight = (value / maxValue) * (height - 10); // Leave space for labels
      const barX = x + barSpacing + (barWidth + barSpacing) * index;
      const barY = y + height - barHeight - 5;

      // Draw bar
      const color = this.hexToRgb(colors[index % colors.length]);
      this.pdf.setFillColor(color.r, color.g, color.b);
      this.pdf.roundedRect(barX, barY, barWidth, barHeight, 1, 1, 'F');

      // Draw label
      if (showLabels && data.labels[index]) {
        this.pdf.setFontSize(7);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.setTextColor(117, 117, 117);
        const label = data.labels[index].substring(0, 8); // Truncate long labels
        this.pdf.text(label, barX + barWidth / 2, y + height + 3, { align: 'center' });
      }

      // Draw value
      if (showValues) {
        this.pdf.setFontSize(8);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setTextColor(33, 33, 33);
        this.pdf.text(String(value), barX + barWidth / 2, barY - 2, { align: 'center' });
      }
    });
  }

  /**
   * Draw a simple line chart
   */
  drawLineChart(
    x: number,
    y: number,
    data: ChartData,
    options: ChartOptions
  ): void {
    const { width, height, title } = options;
    const color = data.colors?.[0] || '#D1A0C7';

    // Title
    if (title) {
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(33, 33, 33);
      this.pdf.text(title, x, y - 3);
      y += 2;
    }

    // Chart area background
    this.pdf.setFillColor(250, 250, 250);
    this.pdf.rect(x, y, width, height, 'F');

    // Calculate points
    const pointCount = data.values.length;
    const pointSpacing = width / (pointCount - 1 || 1);
    const maxValue = Math.max(...data.values, 1);
    const minValue = Math.min(...data.values, 0);
    const valueRange = maxValue - minValue || 1;

    // Draw grid lines
    this.pdf.setDrawColor(235, 235, 235);
    this.pdf.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      const gridY = y + (height * i) / 4;
      this.pdf.line(x, gridY, x + width, gridY);
    }

    // Draw line
    const rgb = this.hexToRgb(color);
    this.pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
    this.pdf.setLineWidth(1.5);

    for (let i = 0; i < pointCount - 1; i++) {
      const x1 = x + pointSpacing * i;
      const y1 = y + height - ((data.values[i] - minValue) / valueRange) * height;
      const x2 = x + pointSpacing * (i + 1);
      const y2 = y + height - ((data.values[i + 1] - minValue) / valueRange) * height;

      this.pdf.line(x1, y1, x2, y2);
    }

    // Draw points
    this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    data.values.forEach((value, index) => {
      const px = x + pointSpacing * index;
      const py = y + height - ((value - minValue) / valueRange) * height;
      this.pdf.circle(px, py, 1.5, 'F');
    });
  }

  /**
   * Draw a simple donut chart
   */
  drawDonutChart(
    x: number,
    y: number,
    data: ChartData,
    options: ChartOptions
  ): void {
    const { width, height, title } = options;
    const colors = data.colors || this.getDefaultColors(data.values.length);
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    const innerRadius = radius * 0.6;

    // Title
    if (title) {
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(33, 33, 33);
      this.pdf.text(title, centerX, y - 3, { align: 'center' });
    }

    // Calculate total
    const total = data.values.reduce((sum, val) => sum + val, 0) || 1;
    let currentAngle = -90; // Start at top

    // Draw segments
    data.values.forEach((value, index) => {
      const percentage = value / total;
      const segmentAngle = percentage * 360;
      const color = this.hexToRgb(colors[index % colors.length]);

      // Draw outer arc (simplified as filled circle segment)
      this.pdf.setFillColor(color.r, color.g, color.b);
      this.drawPieSlice(centerX, centerY, radius, currentAngle, currentAngle + segmentAngle);

      currentAngle += segmentAngle;
    });

    // Draw inner circle (donut hole)
    this.pdf.setFillColor(255, 255, 255);
    this.pdf.circle(centerX, centerY, innerRadius, 'F');

    // Center text
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(103, 3, 56); // Burgundy
    this.pdf.text('100%', centerX, centerY + 1, { align: 'center' });
  }

  /**
   * Helper: Draw a pie slice
   */
  private drawPieSlice(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ): void {
    const steps = 20;
    const angleStep = (endAngle - startAngle) / steps;

    this.pdf.setLineWidth(0);

    for (let i = 0; i < steps; i++) {
      const angle1 = ((startAngle + angleStep * i) * Math.PI) / 180;
      const angle2 = ((startAngle + angleStep * (i + 1)) * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(angle1);
      const y1 = centerY + radius * Math.sin(angle1);
      const x2 = centerX + radius * Math.cos(angle2);
      const y2 = centerY + radius * Math.sin(angle2);

      this.pdf.triangle(centerX, centerY, x1, y1, x2, y2, 'F');
    }
  }

  /**
   * Helper: Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  /**
   * Get default burgundy color palette
   */
  private getDefaultColors(count: number): string[] {
    const palette = [
      '#D1A0C7', // Light burgundy
      '#A8668A', // Medium burgundy
      '#8B1538', // Regular burgundy
      '#670338', // Dark burgundy
      '#F5E6F1', // Pale burgundy
    ];

    // Repeat palette if needed
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(palette[i % palette.length]);
    }
    return colors;
  }
}
