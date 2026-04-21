/**
 * Chart Helpers Module
 * Reusable chart components and utilities for PDF visualization
 */

import { Element } from '../core/ElementRenderer';
import { ModernColorPalette } from '../design/ModernColorPalette';
import { TypographyStyles } from '../design/ModernTypography';
import { Spacing, Radius, LineWidth } from '../design/ModernTokens';
import { Bounds } from '../design/LayoutHelpers';

/**
 * Chart Scale Interface
 */
export interface ChartScale {
  scale: (value: number) => number;
  invert: (pixel: number) => number;
  min: number;
  max: number;
  range: number;
}

/**
 * Chart Axis Configuration
 */
export interface AxisConfig {
  bounds: Bounds;
  min: number;
  max: number;
  orientation: 'horizontal' | 'vertical';
  showGrid?: boolean;
  showLabels?: boolean;
  labelFormat?: (value: number) => string;
  tickCount?: number;
}

/**
 * Scatter Plot Configuration
 */
export interface ScatterPlotConfig {
  bounds: Bounds;
  data: Array<{ x: number; y: number; label?: string; type?: string }>;
  xAxis: { min: number; max: number; label?: string };
  yAxis: { min: number; max: number; label?: string };
  colorMap?: Record<string, string>;
  sizeMap?: Record<string, number>;
  showQuadrants?: boolean;
  quadrantLabels?: string[];
}

/**
 * Box Plot Configuration
 */
export interface BoxPlotConfig {
  bounds: Bounds;
  data: number[];
  min: number;
  max: number;
  median: number;
  q1?: number;
  q3?: number;
  highlightRange?: { min: number; max: number };
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Bar Chart Configuration
 */
export interface BarChartConfig {
  bounds: Bounds;
  data: Array<{ label: string; value: number; color?: string }>;
  orientation?: 'horizontal' | 'vertical';
  showValues?: boolean;
  showLabels?: boolean;
  maxValue?: number;
}

/**
 * Create a linear scale for mapping data to pixels
 */
export function createLinearScale(
  dataMin: number,
  dataMax: number,
  pixelMin: number,
  pixelMax: number
): ChartScale {
  const dataRange = dataMax - dataMin;
  const pixelRange = pixelMax - pixelMin;

  return {
    scale: (value: number): number => {
      if (dataRange === 0) return pixelMin;
      return pixelMin + ((value - dataMin) / dataRange) * pixelRange;
    },
    invert: (pixel: number): number => {
      if (pixelRange === 0) return dataMin;
      return dataMin + ((pixel - pixelMin) / pixelRange) * dataRange;
    },
    min: dataMin,
    max: dataMax,
    range: dataRange,
  };
}

/**
 * Create chart axes elements
 */
export function createAxisElements(config: AxisConfig): Element[] {
  const elements: Element[] = [];
  const { bounds, min, max, orientation, showGrid = false, showLabels = false, tickCount = 5 } = config;

  if (orientation === 'horizontal') {
    // Horizontal axis (X-axis)
    elements.push({
      type: 'line',
      x1: bounds.x,
      y1: bounds.y + bounds.height,
      x2: bounds.x + bounds.width,
      y2: bounds.y + bounds.height,
      strokeColor: ModernColorPalette.border.medium,
      strokeWidth: LineWidth.thin,
    });

    if (showGrid || showLabels) {
      const scale = createLinearScale(min, max, bounds.x, bounds.x + bounds.width);
      const step = (max - min) / (tickCount - 1);

      for (let i = 0; i < tickCount; i++) {
        const value = min + i * step;
        const x = scale.scale(value);

        // Grid line
        if (showGrid) {
          elements.push({
            type: 'line',
            x1: x,
            y1: bounds.y,
            x2: x,
            y2: bounds.y + bounds.height,
            strokeColor: ModernColorPalette.border.light,
            strokeWidth: LineWidth.hairline,
            dashed: true,
          });
        }

        // Tick label
        if (showLabels && config.labelFormat) {
          elements.push({
            type: 'text',
            text: config.labelFormat(value),
            x,
            y: bounds.y + bounds.height + 4,
            style: { ...TypographyStyles.small, fontSize: 7 },
            color: ModernColorPalette.text.light,
            align: 'center',
          });
        }
      }
    }
  } else {
    // Vertical axis (Y-axis)
    elements.push({
      type: 'line',
      x1: bounds.x,
      y1: bounds.y,
      x2: bounds.x,
      y2: bounds.y + bounds.height,
      strokeColor: ModernColorPalette.border.medium,
      strokeWidth: LineWidth.thin,
    });

    if (showGrid || showLabels) {
      const scale = createLinearScale(max, min, bounds.y, bounds.y + bounds.height); // Inverted for Y
      const step = (max - min) / (tickCount - 1);

      for (let i = 0; i < tickCount; i++) {
        const value = min + i * step;
        const y = scale.scale(value);

        // Grid line
        if (showGrid) {
          elements.push({
            type: 'line',
            x1: bounds.x,
            y1: y,
            x2: bounds.x + bounds.width,
            y2: y,
            strokeColor: ModernColorPalette.border.light,
            strokeWidth: LineWidth.hairline,
            dashed: true,
          });
        }

        // Tick label
        if (showLabels && config.labelFormat) {
          elements.push({
            type: 'text',
            text: config.labelFormat(value),
            x: bounds.x - 3,
            y: y + 1,
            style: { ...TypographyStyles.small, fontSize: 7 },
            color: ModernColorPalette.text.light,
            align: 'right',
          });
        }
      }
    }
  }

  return elements;
}

/**
 * Create scatter plot elements
 */
export function createScatterPlotElements(config: ScatterPlotConfig): Element[] {
  const elements: Element[] = [];
  const { bounds, data, xAxis, yAxis, colorMap, sizeMap, showQuadrants, quadrantLabels } = config;

  try {
    // Create scales
    const xScale = createLinearScale(xAxis.min, xAxis.max, bounds.x, bounds.x + bounds.width);
    const yScale = createLinearScale(yAxis.max, yAxis.min, bounds.y, bounds.y + bounds.height); // Inverted Y

    // Draw axes
    elements.push(
      ...createAxisElements({
        bounds,
        min: xAxis.min,
        max: xAxis.max,
        orientation: 'horizontal',
        showGrid: false,
      }),
      ...createAxisElements({
        bounds,
        min: yAxis.min,
        max: yAxis.max,
        orientation: 'vertical',
        showGrid: false,
      })
    );

    // Draw quadrants if enabled
    if (showQuadrants) {
      const midX = bounds.x + bounds.width / 2;
      const midY = bounds.y + bounds.height / 2;

      elements.push(
        {
          type: 'line',
          x1: midX,
          y1: bounds.y,
          x2: midX,
          y2: bounds.y + bounds.height,
          strokeColor: ModernColorPalette.border.light,
          strokeWidth: LineWidth.hairline,
          dashed: true,
        },
        {
          type: 'line',
          x1: bounds.x,
          y1: midY,
          x2: bounds.x + bounds.width,
          y2: midY,
          strokeColor: ModernColorPalette.border.light,
          strokeWidth: LineWidth.hairline,
          dashed: true,
        }
      );

      // Quadrant labels
      if (quadrantLabels && quadrantLabels.length === 4) {
        const labelStyle = { ...TypographyStyles.small, fontSize: 7 };
        elements.push(
          {
            type: 'text',
            text: quadrantLabels[0],
            x: midX - bounds.width / 4,
            y: bounds.y + 4,
            style: labelStyle,
            color: ModernColorPalette.text.light,
            align: 'center',
          },
          {
            type: 'text',
            text: quadrantLabels[1],
            x: midX + bounds.width / 4,
            y: bounds.y + 4,
            style: labelStyle,
            color: ModernColorPalette.text.light,
            align: 'center',
          },
          {
            type: 'text',
            text: quadrantLabels[2],
            x: midX - bounds.width / 4,
            y: bounds.y + bounds.height - 2,
            style: labelStyle,
            color: ModernColorPalette.text.light,
            align: 'center',
          },
          {
            type: 'text',
            text: quadrantLabels[3],
            x: midX + bounds.width / 4,
            y: bounds.y + bounds.height - 2,
            style: labelStyle,
            color: ModernColorPalette.text.light,
            align: 'center',
          }
        );
      }
    }

    // Plot data points
    data.forEach((point) => {
      const x = xScale.scale(point.x);
      const y = yScale.scale(point.y);

      const color = (point.type && colorMap?.[point.type]) || ModernColorPalette.chart.primary;
      const size = (point.type && sizeMap?.[point.type]) || 2;

      elements.push({
        type: 'circle',
        centerX: x,
        centerY: y,
        radius: size,
        color,
      });

      // Add label if provided
      if (point.label) {
        elements.push({
          type: 'text',
          text: point.label,
          x,
          y: y - size - 2,
          style: { ...TypographyStyles.small, fontSize: 7 },
          color,
          align: 'center',
        });
      }
    });

    // Axis labels
    if (xAxis.label) {
      elements.push({
        type: 'text',
        text: xAxis.label,
        x: bounds.x + bounds.width - 10,
        y: bounds.y + bounds.height + 4,
        style: { ...TypographyStyles.small, fontSize: 8 },
        color: ModernColorPalette.text.body,
      });
    }

    if (yAxis.label) {
      // Note: Y-axis label rotation would require custom rendering
      elements.push({
        type: 'text',
        text: yAxis.label,
        x: bounds.x - 3,
        y: bounds.y + 4,
        style: { ...TypographyStyles.small, fontSize: 8 },
        color: ModernColorPalette.text.body,
      });
    }
  } catch (error) {
    console.error('[ChartHelpers] Error creating scatter plot:', error);
    elements.push({
      type: 'text',
      text: 'Chart data unavailable',
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      style: TypographyStyles.small,
      color: ModernColorPalette.text.light,
      align: 'center',
    });
  }

  return elements;
}

/**
 * Create box plot elements
 */
export function createBoxPlotElements(config: BoxPlotConfig): Element[] {
  const elements: Element[] = [];
  const { bounds, data, min, max, median, q1, q3, highlightRange, orientation = 'horizontal' } = config;

  try {
    const dataMin = Math.min(...data, min);
    const dataMax = Math.max(...data, max);

    if (orientation === 'horizontal') {
      const scale = createLinearScale(dataMin, dataMax, bounds.x, bounds.x + bounds.width);
      const baselineY = bounds.y + bounds.height / 2;

      // Draw baseline
      elements.push({
        type: 'line',
        x1: bounds.x,
        y1: baselineY,
        x2: bounds.x + bounds.width,
        y2: baselineY,
        strokeColor: ModernColorPalette.border.light,
        strokeWidth: LineWidth.thin,
      });

      // Draw data points (scatter)
      data.forEach((value) => {
        const x = scale.scale(value);
        const y = baselineY + (Math.random() - 0.5) * 10; // Random jitter

        elements.push({
          type: 'circle',
          centerX: x,
          centerY: y,
          radius: 1.5,
          color: ModernColorPalette.chart.secondary,
        });
      });

      // Draw highlight range if provided
      if (highlightRange) {
        const rangeMinX = scale.scale(highlightRange.min);
        const rangeMaxX = scale.scale(highlightRange.max);
        const rangeWidth = rangeMaxX - rangeMinX;

        elements.push({
          type: 'rect',
          x: rangeMinX,
          y: baselineY - 7.5,
          width: rangeWidth,
          height: 15,
          color: ModernColorPalette.chart.primary,
          opacity: 0.3,
        });
      }

      // Draw median line
      const medianX = scale.scale(median);
      elements.push({
        type: 'line',
        x1: medianX,
        y1: baselineY - 12,
        x2: medianX,
        y2: baselineY + 12,
        strokeColor: ModernColorPalette.text.light,
        strokeWidth: LineWidth.thin,
        dashed: true,
      });

      // Draw quartiles if provided
      if (q1 !== undefined && q3 !== undefined) {
        const q1X = scale.scale(q1);
        const q3X = scale.scale(q3);

        elements.push(
          {
            type: 'line',
            x1: q1X,
            y1: baselineY - 8,
            x2: q1X,
            y2: baselineY + 8,
            strokeColor: ModernColorPalette.border.medium,
            strokeWidth: LineWidth.thin,
          },
          {
            type: 'line',
            x1: q3X,
            y1: baselineY - 8,
            x2: q3X,
            y2: baselineY + 8,
            strokeColor: ModernColorPalette.border.medium,
            strokeWidth: LineWidth.thin,
          }
        );
      }
    }
    // Vertical orientation can be added similarly if needed
  } catch (error) {
    console.error('[ChartHelpers] Error creating box plot:', error);
    elements.push({
      type: 'text',
      text: 'Chart data unavailable',
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      style: TypographyStyles.small,
      color: ModernColorPalette.text.light,
      align: 'center',
    });
  }

  return elements;
}

/**
 * Create bar chart elements
 */
export function createBarChartElements(config: BarChartConfig): Element[] {
  const elements: Element[] = [];
  const {
    bounds,
    data,
    orientation = 'vertical',
    showValues = true,
    showLabels = true,
    maxValue,
  } = config;

  try {
    const max = maxValue || Math.max(...data.map((d) => d.value));

    if (orientation === 'vertical') {
      const barWidth = bounds.width / data.length;
      const padding = barWidth * 0.2;

      data.forEach((item, index) => {
        const x = bounds.x + index * barWidth + padding / 2;
        const height = (item.value / max) * bounds.height;
        const y = bounds.y + bounds.height - height;

        // Bar
        elements.push({
          type: 'rect',
          x,
          y,
          width: barWidth - padding,
          height,
          color: item.color || ModernColorPalette.chart.primary,
          borderRadius: Radius.sm,
        });

        // Value label
        if (showValues) {
          elements.push({
            type: 'text',
            text: String(item.value),
            x: x + (barWidth - padding) / 2,
            y: y - 2,
            style: TypographyStyles.small,
            color: ModernColorPalette.text.dark,
            align: 'center',
          });
        }

        // Category label
        if (showLabels) {
          elements.push({
            type: 'text',
            text: item.label,
            x: x + (barWidth - padding) / 2,
            y: bounds.y + bounds.height + 4,
            style: { ...TypographyStyles.small, fontSize: 7 },
            color: ModernColorPalette.text.light,
            align: 'center',
          });
        }
      });
    } else {
      // Horizontal bars
      const barHeight = bounds.height / data.length;
      const padding = barHeight * 0.2;

      data.forEach((item, index) => {
        const y = bounds.y + index * barHeight + padding / 2;
        const width = (item.value / max) * bounds.width;

        // Bar
        elements.push({
          type: 'rect',
          x: bounds.x,
          y,
          width,
          height: barHeight - padding,
          color: item.color || ModernColorPalette.chart.primary,
          borderRadius: Radius.sm,
        });

        // Value label
        if (showValues) {
          elements.push({
            type: 'text',
            text: String(item.value),
            x: bounds.x + width + 2,
            y: y + (barHeight - padding) / 2 + 1,
            style: TypographyStyles.small,
            color: ModernColorPalette.text.dark,
          });
        }

        // Category label
        if (showLabels) {
          elements.push({
            type: 'text',
            text: item.label,
            x: bounds.x - 3,
            y: y + (barHeight - padding) / 2 + 1,
            style: TypographyStyles.small,
            color: ModernColorPalette.text.light,
            align: 'right',
          });
        }
      });
    }
  } catch (error) {
    console.error('[ChartHelpers] Error creating bar chart:', error);
    elements.push({
      type: 'text',
      text: 'Chart data unavailable',
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      style: TypographyStyles.small,
      color: ModernColorPalette.text.light,
      align: 'center',
    });
  }

  return elements;
}

/**
 * Validate chart data and provide fallback
 */
export function validateChartData<T>(data: T[], fallbackValue: T): T[] {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('[ChartHelpers] Invalid chart data, using fallback');
    return [fallbackValue];
  }
  return data.filter((item) => item !== null && item !== undefined);
}

/**
 * Safe min/max calculation with fallback
 */
export function safeMinMax(values: number[], fallback: { min: number; max: number }): { min: number; max: number } {
  if (!values || values.length === 0) {
    console.warn('[ChartHelpers] Empty values array, using fallback');
    return fallback;
  }

  const filtered = values.filter((v) => typeof v === 'number' && !isNaN(v));

  if (filtered.length === 0) {
    console.warn('[ChartHelpers] No valid numeric values, using fallback');
    return fallback;
  }

  return {
    min: Math.min(...filtered),
    max: Math.max(...filtered),
  };
}

/**
 * Export all helpers
 */
export const ChartHelpers = {
  createLinearScale,
  createAxisElements,
  createScatterPlotElements,
  createBoxPlotElements,
  createBarChartElements,
  validateChartData,
  safeMinMax,
};

export default ChartHelpers;
