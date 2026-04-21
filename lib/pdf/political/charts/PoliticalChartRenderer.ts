/**
 * Political Chart Renderer
 *
 * Pure jsPDF implementation for rendering charts in political PDF reports.
 * Works on Vercel serverless - no canvas dependencies.
 *
 * Uses the Political Design Tokens for consistent styling.
 *
 * @version 1.0.0
 * @lastUpdated 2025-12-18
 */

import type jsPDF from 'jspdf';
import {
  CHART_COLORS,
  NEUTRAL_COLORS,
  TYPOGRAPHY,
} from '../design/PoliticalDesignTokens';

// ============================================================================
// Types
// ============================================================================

export interface BarChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface LineChartData {
  labels: string[];
  series: Array<{
    name: string;
    values: number[];
    color?: string;
  }>;
}

export interface DonutChartData {
  labels: string[];
  values: number[];
  colors?: string[];
  centerText?: string;
}

export interface StackedBarData {
  labels: string[];
  segments: Array<{
    name: string;
    values: number[];
    color: string;
  }>;
}

export interface ChartOptions {
  title?: string;
  showValues?: boolean;
  showLabels?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  valueFormat?: 'number' | 'percent' | 'currency';
  maxValue?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function formatValue(value: number, format: ChartOptions['valueFormat']): string {
  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'currency':
      return `$${value.toLocaleString()}`;
    default:
      return value.toLocaleString();
  }
}

// ============================================================================
// Political Chart Renderer Class
// ============================================================================

export class PoliticalChartRenderer {
  private pdf: jsPDF;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
  }

  // --------------------------------------------------------------------------
  // Horizontal Bar Chart (for demographics, engagement metrics)
  // --------------------------------------------------------------------------

  drawHorizontalBarChart(
    x: number,
    y: number,
    width: number,
    height: number,
    data: BarChartData,
    options: ChartOptions = {}
  ): void {
    const { title, showValues = true, valueFormat = 'percent' } = options;
    const colors = data.colors || [CHART_COLORS.series[0]];

    let currentY = y;

    // Title
    if (title) {
      this.pdf.setFontSize(TYPOGRAPHY.sizes.sm);
      this.pdf.setFont(TYPOGRAPHY.family, 'bold');
      const rgb = hexToRgb(NEUTRAL_COLORS.textPrimary);
      this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      this.pdf.text(title, x, currentY);
      currentY += 6;
    }

    const barCount = data.values.length;
    const barHeight = Math.min(6, (height - (title ? 6 : 0)) / barCount - 2);
    const labelWidth = 35;
    const barMaxWidth = width - labelWidth - 20;
    const maxValue = options.maxValue || Math.max(...data.values, 1);

    for (let i = 0; i < barCount; i++) {
      const value = data.values[i];
      const label = data.labels[i];
      const color = colors[i % colors.length];

      // Label
      this.pdf.setFontSize(TYPOGRAPHY.sizes.xs);
      this.pdf.setFont(TYPOGRAPHY.family, 'normal');
      const labelRgb = hexToRgb(NEUTRAL_COLORS.textSecondary);
      this.pdf.setTextColor(labelRgb.r, labelRgb.g, labelRgb.b);
      this.pdf.text(label.substring(0, 15), x, currentY + barHeight / 2 + 1);

      // Background bar (track)
      const trackRgb = hexToRgb(NEUTRAL_COLORS.muted);
      this.pdf.setFillColor(trackRgb.r, trackRgb.g, trackRgb.b);
      this.pdf.roundedRect(x + labelWidth, currentY, barMaxWidth, barHeight, 1, 1, 'F');

      // Value bar
      const barWidth = (value / maxValue) * barMaxWidth;
      if (barWidth > 0) {
        const barRgb = hexToRgb(color);
        this.pdf.setFillColor(barRgb.r, barRgb.g, barRgb.b);
        this.pdf.roundedRect(x + labelWidth, currentY, barWidth, barHeight, 1, 1, 'F');
      }

      // Value text
      if (showValues) {
        this.pdf.setFontSize(TYPOGRAPHY.sizes.xs);
        const valueRgb = hexToRgb(NEUTRAL_COLORS.textPrimary);
        this.pdf.setTextColor(valueRgb.r, valueRgb.g, valueRgb.b);
        this.pdf.text(
          formatValue(value, valueFormat),
          x + labelWidth + barMaxWidth + 2,
          currentY + barHeight / 2 + 1
        );
      }

      currentY += barHeight + 3;
    }
  }

  // --------------------------------------------------------------------------
  // Vertical Bar Chart (for election trends, turnout by year)
  // --------------------------------------------------------------------------

  drawVerticalBarChart(
    x: number,
    y: number,
    width: number,
    height: number,
    data: BarChartData,
    options: ChartOptions = {}
  ): void {
    const { title, showValues = true, showLabels = true, valueFormat = 'number' } = options;
    const colors = data.colors || CHART_COLORS.series;

    let currentY = y;
    let chartHeight = height;

    // Title
    if (title) {
      this.pdf.setFontSize(TYPOGRAPHY.sizes.sm);
      this.pdf.setFont(TYPOGRAPHY.family, 'bold');
      const rgb = hexToRgb(NEUTRAL_COLORS.textPrimary);
      this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      this.pdf.text(title, x, currentY);
      currentY += 8;
      chartHeight -= 8;
    }

    const barCount = data.values.length;
    const barSpacing = 3;
    const availableWidth = width - (barSpacing * (barCount + 1));
    const barWidth = availableWidth / barCount;
    const maxValue = options.maxValue || Math.max(...data.values, 1);
    const labelHeight = showLabels ? 10 : 0;
    const valueHeight = showValues ? 6 : 0;
    const barMaxHeight = chartHeight - labelHeight - valueHeight;

    // Chart background
    const bgRgb = hexToRgb(NEUTRAL_COLORS.background);
    this.pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
    this.pdf.rect(x, currentY, width, barMaxHeight, 'F');

    // Grid lines
    const gridRgb = hexToRgb(NEUTRAL_COLORS.border);
    this.pdf.setDrawColor(gridRgb.r, gridRgb.g, gridRgb.b);
    this.pdf.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      const gridY = currentY + (barMaxHeight * i) / 4;
      this.pdf.line(x, gridY, x + width, gridY);
    }

    // Bars
    for (let i = 0; i < barCount; i++) {
      const value = data.values[i];
      const color = colors[i % colors.length];
      const barHeight = (value / maxValue) * barMaxHeight;
      const barX = x + barSpacing + (barWidth + barSpacing) * i;
      const barY = currentY + barMaxHeight - barHeight;

      // Draw bar
      const barRgb = hexToRgb(color);
      this.pdf.setFillColor(barRgb.r, barRgb.g, barRgb.b);
      this.pdf.roundedRect(barX, barY, barWidth, barHeight, 1, 1, 'F');

      // Value above bar
      if (showValues && barHeight > 0) {
        this.pdf.setFontSize(TYPOGRAPHY.sizes.xs);
        this.pdf.setFont(TYPOGRAPHY.family, 'bold');
        const valRgb = hexToRgb(NEUTRAL_COLORS.textPrimary);
        this.pdf.setTextColor(valRgb.r, valRgb.g, valRgb.b);
        this.pdf.text(
          formatValue(value, valueFormat),
          barX + barWidth / 2,
          barY - 2,
          { align: 'center' }
        );
      }

      // Label below
      if (showLabels) {
        this.pdf.setFontSize(TYPOGRAPHY.sizes.xs);
        this.pdf.setFont(TYPOGRAPHY.family, 'normal');
        const lblRgb = hexToRgb(NEUTRAL_COLORS.textSecondary);
        this.pdf.setTextColor(lblRgb.r, lblRgb.g, lblRgb.b);
        const label = data.labels[i].substring(0, 6);
        this.pdf.text(label, barX + barWidth / 2, currentY + barMaxHeight + 6, { align: 'center' });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Line Chart (for trends over time)
  // --------------------------------------------------------------------------

  drawLineChart(
    x: number,
    y: number,
    width: number,
    height: number,
    data: LineChartData,
    options: ChartOptions = {}
  ): void {
    const { title, showLegend = true, showGrid = true } = options;

    let currentY = y;
    let chartHeight = height;

    // Title
    if (title) {
      this.pdf.setFontSize(TYPOGRAPHY.sizes.sm);
      this.pdf.setFont(TYPOGRAPHY.family, 'bold');
      const rgb = hexToRgb(NEUTRAL_COLORS.textPrimary);
      this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      this.pdf.text(title, x, currentY);
      currentY += 8;
      chartHeight -= 8;
    }

    // Legend
    if (showLegend && data.series.length > 1) {
      this.pdf.setFontSize(TYPOGRAPHY.sizes.xs);
      let legendX = x;
      for (const series of data.series) {
        const color = series.color || CHART_COLORS.series[0];
        const rgb = hexToRgb(color);
        this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        this.pdf.circle(legendX + 2, currentY - 1, 1.5, 'F');
        this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);
        this.pdf.text(series.name, legendX + 6, currentY);
        legendX += this.pdf.getTextWidth(series.name) + 15;
      }
      currentY += 6;
      chartHeight -= 6;
    }

    const labelHeight = 10;
    const chartAreaHeight = chartHeight - labelHeight;
    const pointCount = data.labels.length;

    if (pointCount < 2) return;

    // Find min/max across all series
    let minValue = Infinity;
    let maxValue = -Infinity;
    for (const series of data.series) {
      minValue = Math.min(minValue, ...series.values);
      maxValue = Math.max(maxValue, ...series.values);
    }
    const valueRange = maxValue - minValue || 1;

    // Chart background
    const bgRgb = hexToRgb(NEUTRAL_COLORS.background);
    this.pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
    this.pdf.rect(x, currentY, width, chartAreaHeight, 'F');

    // Grid
    if (showGrid) {
      const gridRgb = hexToRgb(NEUTRAL_COLORS.border);
      this.pdf.setDrawColor(gridRgb.r, gridRgb.g, gridRgb.b);
      this.pdf.setLineWidth(0.2);
      for (let i = 0; i <= 4; i++) {
        const gridY = currentY + (chartAreaHeight * i) / 4;
        this.pdf.line(x, gridY, x + width, gridY);
      }
    }

    const pointSpacing = width / (pointCount - 1);

    // Draw each series
    for (let s = 0; s < data.series.length; s++) {
      const series = data.series[s];
      const color = series.color || CHART_COLORS.series[s % CHART_COLORS.series.length];
      const rgb = hexToRgb(color);

      // Line
      this.pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
      this.pdf.setLineWidth(1.5);

      for (let i = 0; i < pointCount - 1; i++) {
        const x1 = x + pointSpacing * i;
        const y1 = currentY + chartAreaHeight - ((series.values[i] - minValue) / valueRange) * chartAreaHeight;
        const x2 = x + pointSpacing * (i + 1);
        const y2 = currentY + chartAreaHeight - ((series.values[i + 1] - minValue) / valueRange) * chartAreaHeight;
        this.pdf.line(x1, y1, x2, y2);
      }

      // Points
      this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      for (let i = 0; i < pointCount; i++) {
        const px = x + pointSpacing * i;
        const py = currentY + chartAreaHeight - ((series.values[i] - minValue) / valueRange) * chartAreaHeight;
        this.pdf.circle(px, py, 1.5, 'F');
      }
    }

    // X-axis labels
    this.pdf.setFontSize(TYPOGRAPHY.sizes.xs);
    const lblRgb = hexToRgb(NEUTRAL_COLORS.textSecondary);
    this.pdf.setTextColor(lblRgb.r, lblRgb.g, lblRgb.b);
    for (let i = 0; i < pointCount; i++) {
      const labelX = x + pointSpacing * i;
      this.pdf.text(data.labels[i], labelX, currentY + chartAreaHeight + 6, { align: 'center' });
    }
  }

  // --------------------------------------------------------------------------
  // Donut Chart (for party registration, proportions)
  // --------------------------------------------------------------------------

  drawDonutChart(
    x: number,
    y: number,
    width: number,
    height: number,
    data: DonutChartData,
    options: ChartOptions = {}
  ): void {
    const { title, showLegend = true } = options;
    const colors = data.colors || CHART_COLORS.series;

    let currentY = y;

    // Title
    if (title) {
      this.pdf.setFontSize(TYPOGRAPHY.sizes.sm);
      this.pdf.setFont(TYPOGRAPHY.family, 'bold');
      const rgb = hexToRgb(NEUTRAL_COLORS.textPrimary);
      this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      this.pdf.text(title, x + width / 2, currentY, { align: 'center' });
      currentY += 8;
    }

    const centerX = x + width / 2;
    const centerY = currentY + (height - (title ? 8 : 0) - (showLegend ? 25 : 0)) / 2;
    const radius = Math.min(width, height - (title ? 8 : 0) - (showLegend ? 25 : 0)) / 2 - 5;
    const innerRadius = radius * 0.55;

    const total = data.values.reduce((sum, val) => sum + val, 0) || 1;
    let currentAngle = -90;

    // Draw segments
    for (let i = 0; i < data.values.length; i++) {
      const value = data.values[i];
      const percentage = value / total;
      const segmentAngle = percentage * 360;
      const color = colors[i % colors.length];
      const rgb = hexToRgb(color);

      this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      this.drawPieSlice(centerX, centerY, radius, currentAngle, currentAngle + segmentAngle);
      currentAngle += segmentAngle;
    }

    // Inner circle (donut hole)
    const whiteRgb = hexToRgb(NEUTRAL_COLORS.white);
    this.pdf.setFillColor(whiteRgb.r, whiteRgb.g, whiteRgb.b);
    this.pdf.circle(centerX, centerY, innerRadius, 'F');

    // Center text
    if (data.centerText) {
      this.pdf.setFontSize(TYPOGRAPHY.sizes.lg);
      this.pdf.setFont(TYPOGRAPHY.family, 'bold');
      const txtRgb = hexToRgb(NEUTRAL_COLORS.textPrimary);
      this.pdf.setTextColor(txtRgb.r, txtRgb.g, txtRgb.b);
      this.pdf.text(data.centerText, centerX, centerY + 3, { align: 'center' });
    }

    // Legend below
    if (showLegend) {
      this.pdf.setFontSize(TYPOGRAPHY.sizes.xs);
      let legendY = currentY + height - (title ? 8 : 0) - 20;
      const itemsPerRow = 2;
      const itemWidth = width / itemsPerRow;

      for (let i = 0; i < data.labels.length; i++) {
        const col = i % itemsPerRow;
        const row = Math.floor(i / itemsPerRow);
        const legendX = x + col * itemWidth;
        const itemY = legendY + row * 8;

        const color = colors[i % colors.length];
        const rgb = hexToRgb(color);
        const pct = ((data.values[i] / total) * 100).toFixed(1);

        this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        this.pdf.circle(legendX + 3, itemY - 1, 2, 'F');

        this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);
        this.pdf.text(`${data.labels[i].substring(0, 10)}: ${pct}%`, legendX + 8, itemY);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Stacked Horizontal Bar (for ideology spectrum)
  // --------------------------------------------------------------------------

  drawStackedHorizontalBar(
    x: number,
    y: number,
    width: number,
    height: number,
    data: StackedBarData,
    options: ChartOptions = {}
  ): void {
    const { title, showLegend = true } = options;

    let currentY = y;

    // Title
    if (title) {
      this.pdf.setFontSize(TYPOGRAPHY.sizes.sm);
      this.pdf.setFont(TYPOGRAPHY.family, 'bold');
      const rgb = hexToRgb(NEUTRAL_COLORS.textPrimary);
      this.pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      this.pdf.text(title, x, currentY);
      currentY += 6;
    }

    const barHeight = 16;

    // For each row (label)
    for (let row = 0; row < data.labels.length; row++) {
      // Calculate total for this row
      let rowTotal = 0;
      for (const seg of data.segments) {
        rowTotal += seg.values[row] || 0;
      }

      if (rowTotal === 0) continue;

      let currentX = x;

      // Draw each segment
      for (const seg of data.segments) {
        const value = seg.values[row] || 0;
        const segWidth = (value / rowTotal) * width;

        if (segWidth > 0) {
          const rgb = hexToRgb(seg.color);
          this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
          this.pdf.rect(currentX, currentY, segWidth, barHeight, 'F');

          // Show percentage if segment is wide enough
          if (segWidth > 15) {
            const pct = ((value / rowTotal) * 100).toFixed(0);
            this.pdf.setFontSize(TYPOGRAPHY.sizes.xs);
            this.pdf.setFont(TYPOGRAPHY.family, 'bold');
            this.pdf.setTextColor(255, 255, 255);
            this.pdf.text(`${pct}%`, currentX + segWidth / 2, currentY + barHeight / 2 + 2, { align: 'center' });
          }

          currentX += segWidth;
        }
      }

      currentY += barHeight + 4;
    }

    // Legend
    if (showLegend) {
      currentY += 4;
      this.pdf.setFontSize(TYPOGRAPHY.sizes.xs);
      let legendX = x;

      for (const seg of data.segments) {
        const rgb = hexToRgb(seg.color);
        this.pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        this.pdf.circle(legendX + 2, currentY, 1.5, 'F');

        const txtRgb = hexToRgb(NEUTRAL_COLORS.textSecondary);
        this.pdf.setTextColor(txtRgb.r, txtRgb.g, txtRgb.b);
        this.pdf.text(seg.name, legendX + 6, currentY + 1);
        legendX += this.pdf.getTextWidth(seg.name) + 14;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Partisan Lean Line Chart (specific for election trends)
  // --------------------------------------------------------------------------

  drawPartisanTrendChart(
    x: number,
    y: number,
    width: number,
    height: number,
    elections: Array<{ year: number; demPct: number; repPct: number }>
  ): void {
    if (elections.length === 0) {
      this.drawEmptyChartMessage(x, y, width, height, 'No election data available');
      return;
    }

    const sortedElections = [...elections].sort((a, b) => a.year - b.year);

    this.drawLineChart(x, y, width, height, {
      labels: sortedElections.map(e => e.year.toString()),
      series: [
        {
          name: 'Democrat',
          values: sortedElections.map(e => e.demPct),
          color: CHART_COLORS.democrat,
        },
        {
          name: 'Republican',
          values: sortedElections.map(e => e.repPct),
          color: CHART_COLORS.republican,
        },
      ],
    }, {
      showLegend: true,
      showGrid: true,
    });
  }

  // --------------------------------------------------------------------------
  // Turnout Trend Chart (bar chart by year)
  // --------------------------------------------------------------------------

  drawTurnoutTrendChart(
    x: number,
    y: number,
    width: number,
    height: number,
    elections: Array<{ year: number; turnout: number; type: string }>
  ): void {
    if (elections.length === 0) {
      this.drawEmptyChartMessage(x, y, width, height, 'No turnout data available');
      return;
    }

    const sortedElections = [...elections].sort((a, b) => a.year - b.year);

    // Color by election type
    const colors = sortedElections.map(e => {
      if (e.type === 'Presidential' || e.type === 'General') return CHART_COLORS.turnout;
      if (e.type === 'Midterm') return CHART_COLORS.persuasion;
      return CHART_COLORS.gotv;
    });

    this.drawVerticalBarChart(x, y, width, height, {
      labels: sortedElections.map(e => e.year.toString()),
      values: sortedElections.map(e => e.turnout),
      colors,
    }, {
      showValues: true,
      showLabels: true,
      valueFormat: 'percent',
      maxValue: 100,
    });
  }

  // --------------------------------------------------------------------------
  // Income Distribution Chart
  // --------------------------------------------------------------------------

  drawIncomeDistribution(
    x: number,
    y: number,
    width: number,
    height: number,
    incomeData: Record<string, number>
  ): void {
    const entries = Object.entries(incomeData);

    this.drawHorizontalBarChart(x, y, width, height, {
      labels: entries.map(([label]) => label),
      values: entries.map(([, value]) => value),
      colors: entries.map((_, i) => CHART_COLORS.series[i % CHART_COLORS.series.length]),
    }, {
      showValues: true,
      valueFormat: 'percent',
      maxValue: 100,
    });
  }

  // --------------------------------------------------------------------------
  // Party Registration Donut
  // --------------------------------------------------------------------------

  drawPartyRegistrationChart(
    x: number,
    y: number,
    width: number,
    height: number,
    registration: { democrat: number; republican: number; independent: number; other: number }
  ): void {
    const total = registration.democrat + registration.republican + registration.independent + registration.other;

    this.drawDonutChart(x, y, width, height, {
      labels: ['Democrat', 'Republican', 'Independent', 'Other'],
      values: [registration.democrat, registration.republican, registration.independent, registration.other],
      colors: [CHART_COLORS.democrat, CHART_COLORS.republican, CHART_COLORS.tossup, NEUTRAL_COLORS.textMuted],
      centerText: `${total.toFixed(0)}%`,
    }, {
      showLegend: true,
    });
  }

  // --------------------------------------------------------------------------
  // Ideology Spectrum (stacked bar)
  // --------------------------------------------------------------------------

  drawIdeologySpectrumChart(
    x: number,
    y: number,
    width: number,
    height: number,
    ideology: {
      veryLiberal: number;
      somewhatLiberal: number;
      moderate: number;
      somewhatConservative: number;
      veryConservative: number;
    }
  ): void {
    this.drawStackedHorizontalBar(x, y, width, height, {
      labels: ['Ideology'],
      segments: [
        { name: 'Very Liberal', values: [ideology.veryLiberal], color: CHART_COLORS.safeD },
        { name: 'Lean Liberal', values: [ideology.somewhatLiberal], color: CHART_COLORS.likelyD },
        { name: 'Moderate', values: [ideology.moderate], color: CHART_COLORS.tossup },
        { name: 'Lean Cons.', values: [ideology.somewhatConservative], color: CHART_COLORS.likelyR },
        { name: 'Very Cons.', values: [ideology.veryConservative], color: CHART_COLORS.safeR },
      ],
    }, {
      showLegend: true,
    });
  }

  // --------------------------------------------------------------------------
  // Housing Tenure Chart
  // --------------------------------------------------------------------------

  drawHousingTenureChart(
    x: number,
    y: number,
    width: number,
    height: number,
    ownerOccupied: number
  ): void {
    const renterOccupied = 100 - ownerOccupied;

    this.drawDonutChart(x, y, width, height, {
      labels: ['Owner', 'Renter'],
      values: [ownerOccupied, renterOccupied],
      colors: [CHART_COLORS.gotv, CHART_COLORS.persuasion],
      centerText: `${ownerOccupied.toFixed(0)}%`,
    }, {
      title: '',
      showLegend: true,
    });
  }

  // --------------------------------------------------------------------------
  // Empty Chart Message
  // --------------------------------------------------------------------------

  private drawEmptyChartMessage(
    x: number,
    y: number,
    width: number,
    height: number,
    message: string
  ): void {
    // Background
    const bgRgb = hexToRgb(NEUTRAL_COLORS.muted);
    this.pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
    this.pdf.roundedRect(x, y, width, height, 2, 2, 'F');

    // Border
    const borderRgb = hexToRgb(NEUTRAL_COLORS.border);
    this.pdf.setDrawColor(borderRgb.r, borderRgb.g, borderRgb.b);
    this.pdf.setLineWidth(0.5);
    this.pdf.roundedRect(x, y, width, height, 2, 2, 'S');

    // Message
    this.pdf.setFontSize(TYPOGRAPHY.sizes.sm);
    this.pdf.setFont(TYPOGRAPHY.family, 'normal');
    const txtRgb = hexToRgb(NEUTRAL_COLORS.textMuted);
    this.pdf.setTextColor(txtRgb.r, txtRgb.g, txtRgb.b);
    this.pdf.text(message, x + width / 2, y + height / 2, { align: 'center' });
  }

  // --------------------------------------------------------------------------
  // Helper: Draw pie slice using triangles
  // --------------------------------------------------------------------------

  private drawPieSlice(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ): void {
    const steps = Math.max(10, Math.ceil(Math.abs(endAngle - startAngle) / 5));
    const angleStep = (endAngle - startAngle) / steps;

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
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPoliticalChartRenderer(pdf: jsPDF): PoliticalChartRenderer {
  return new PoliticalChartRenderer(pdf);
}
