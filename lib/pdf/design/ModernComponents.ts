/**
 * Modern UI Components for PDF Generation
 * Based on modern infographic design specification
 */

import { ModernColorPalette, getTrendColor, getScoreColor, withOpacity } from './ModernColorPalette';
import { TypographyStyles, formatCurrency, formatMetricNumber } from './ModernTypography';
import { Spacing, Radius, Shadow, LineWidth, IconSize } from './ModernTokens';
import type { StyleProps } from './StyleProps';
import { resolveSpacing } from './StyleProps';

/**
 * Component Configuration Types
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds extends Position, Size {}

/**
 * KPI Card Component
 * Displays a key performance indicator with icon, metric, and optional trend
 */
export interface KPICardConfig {
  bounds: Bounds;
  icon?: string;
  label: string;
  metric: string | number;
  trend?: number;  // Percentage change
  comparison?: string;  // Comparison text
  showGauge?: boolean;  // Show radial gauge
  gaugeValue?: number;  // 0-100 for gauge
  showTrendArrow?: boolean;
  showComparisonBar?: boolean;
  styleProps?: StyleProps;  // Additional style customization
}

export function createKPICard(config: KPICardConfig) {
  const { bounds, label, metric, trend, comparison, showGauge, gaugeValue, showTrendArrow, showComparisonBar, styleProps } = config;

  // Apply style props with defaults - Flat white cards with subtle borders (reference design)
  const padding = resolveSpacing(styleProps?.padding ?? Spacing.lg);
  const borderRadius = styleProps?.borderRadius ?? Radius.sm;
  const shadow = styleProps?.shadow ?? 'none'; // NO SHADOWS - flat design like reference
  const backgroundColor = styleProps?.backgroundColor ?? ModernColorPalette.background.card; // White cards
  const borderColor = styleProps?.borderColor ?? ModernColorPalette.border.subtle; // Subtle grey borders

  return {
    type: 'kpi-card',
    bounds,
    background: backgroundColor,
    borderColor,
    borderRadius,
    shadow,
    elements: [
      // Left accent bar (burgundy tint - used sparingly like reference uses blue accent)
      {
        type: 'rect',
        x: bounds.x,
        y: bounds.y,
        width: 3, // 3mm accent bar
        height: bounds.height,
        color: ModernColorPalette.chart.primary, // Light burgundy tint (like reference light blue)
        borderRadius: 0
      },
      // Label
      {
        type: 'text',
        text: label.toUpperCase(),
        x: bounds.x + padding,
        y: bounds.y + Spacing.lg + Spacing.md,
        style: TypographyStyles.label,
        color: ModernColorPalette.text.light,
      },
      // Metric
      {
        type: 'text',
        text: typeof metric === 'number' ? formatMetricNumber(metric) : metric,
        x: bounds.x + padding,
        y: bounds.y + Spacing['2xl'] + Spacing.lg + Spacing.sm,
        style: TypographyStyles.metric,
        color: ModernColorPalette.text.dark,
      },
      // Trend Arrow (if enabled)
      ...(showTrendArrow && trend !== undefined ? [{
        type: 'trend-arrow',
        x: bounds.x + bounds.width - (Spacing['2xl'] + Spacing.xl),
        y: bounds.y + Spacing.lg + Spacing.md,
        direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat',
        color: getTrendColor(trend),
        value: `${Math.abs(trend)}%`,
      }] : []),
      // Radial Gauge (if enabled)
      ...(showGauge && gaugeValue !== undefined ? [{
        type: 'radial-gauge',
        centerX: bounds.x + bounds.width - (Spacing['2xl'] + Spacing.xl),
        centerY: bounds.y + bounds.height - (Spacing['2xl'] + Spacing.xl),
        radius: Spacing['2xl'] + Spacing.sm,
        value: gaugeValue,
        color: ModernColorPalette.chart.primary,
        backgroundColor: ModernColorPalette.border.light,
      }] : []),
      // Comparison Text
      ...(comparison ? [{
        type: 'text',
        text: comparison,
        x: bounds.x + padding,
        y: bounds.y + bounds.height - Spacing.lg - Spacing.md,
        style: TypographyStyles.small,
        color: ModernColorPalette.text.light,
      }] : []),
      // Comparison Bar (if enabled)
      ...(showComparisonBar && trend !== undefined ? [{
        type: 'comparison-bar',
        x: bounds.x + padding,
        y: bounds.y + bounds.height - Spacing.lg,
        width: bounds.width - (padding * 2),
        height: Spacing.sm,
        value: Math.min(Math.abs(trend), 100),
        color: getTrendColor(trend),
        backgroundColor: ModernColorPalette.border.light,
      }] : []),
    ],
  };
}

/**
 * Gradient Panel Component
 * Background panel with burgundy to gold gradient
 */
export interface GradientPanelConfig {
  bounds: Bounds;
  gradientType?: 'primary' | 'light' | 'success' | 'warning';
  borderRadius?: number;
  opacity?: number;
}

export function createGradientPanel(config: GradientPanelConfig) {
  const { bounds, gradientType = 'primary', borderRadius = Radius['2xl'], opacity = 1 } = config;

  const gradientMap = {
    primary: ModernColorPalette.gradients.primary,
    light: ModernColorPalette.gradients.lightAccent,
    success: ModernColorPalette.gradients.success,
    warning: ModernColorPalette.gradients.warning,
  };

  const gradient = gradientMap[gradientType];

  return {
    type: 'gradient-panel',
    bounds,
    gradient: {
      start: withOpacity(gradient.start, opacity),
      end: withOpacity(gradient.end, opacity),
      direction: 'diagonal',
    },
    borderRadius,
  };
}

/**
 * Progress Meter Component
 * Horizontal or vertical progress indicator
 */
export interface ProgressMeterConfig {
  bounds: Bounds;
  value: number;  // 0-100
  label?: string;
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
}

export function createProgressMeter(config: ProgressMeterConfig) {
  const {
    bounds,
    value,
    label,
    orientation = 'horizontal',
    color = ModernColorPalette.primary,
    backgroundColor = ModernColorPalette.border.light,
    showPercentage = true,
  } = config;

  const normalizedValue = Math.min(Math.max(value, 0), 100);

  return {
    type: 'progress-meter',
    bounds,
    orientation,
    elements: [
      // Background bar
      {
        type: 'rect',
        x: bounds.x,
        y: bounds.y,
        width: orientation === 'horizontal' ? bounds.width : bounds.height,
        height: orientation === 'horizontal' ? bounds.height : bounds.width,
        color: backgroundColor,
        borderRadius: Radius.full,
      },
      // Progress fill
      {
        type: 'rect',
        x: bounds.x,
        y: bounds.y,
        width: orientation === 'horizontal' ? (bounds.width * normalizedValue / 100) : bounds.height,
        height: orientation === 'horizontal' ? bounds.height : (bounds.width * normalizedValue / 100),
        color,
        borderRadius: Radius.full,
      },
      // Label
      ...(label ? [{
        type: 'text',
        text: label,
        x: bounds.x,
        y: bounds.y - Spacing.xl + Spacing.sm,
        style: TypographyStyles.small,
        color: ModernColorPalette.text.body,
      }] : []),
      // Percentage
      ...(showPercentage ? [{
        type: 'text',
        text: `${Math.round(normalizedValue)}%`,
        x: bounds.x + bounds.width + Spacing.md,
        y: bounds.y + (bounds.height / 2) + Spacing.xs + Spacing.sm,
        style: TypographyStyles.smallBold,
        color: ModernColorPalette.text.dark,
      }] : []),
    ],
  };
}

/**
 * Radial Gauge Component
 * Circular progress indicator
 */
export interface RadialGaugeConfig {
  center: Position;
  radius: number;
  value: number;  // 0-100
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showValue?: boolean;
}

export function createRadialGauge(config: RadialGaugeConfig) {
  const {
    center,
    radius,
    value,
    strokeWidth = Spacing.md,
    color = ModernColorPalette.primary,
    backgroundColor = ModernColorPalette.border.light,
    showValue = true,
  } = config;

  const normalizedValue = Math.min(Math.max(value, 0), 100);
  const angle = (normalizedValue / 100) * 360;

  return {
    type: 'radial-gauge',
    center,
    radius,
    elements: [
      // Background circle
      {
        type: 'arc',
        centerX: center.x,
        centerY: center.y,
        radius,
        startAngle: 0,
        endAngle: 360,
        strokeWidth,
        strokeColor: backgroundColor,
        fill: false,
      },
      // Progress arc
      {
        type: 'arc',
        centerX: center.x,
        centerY: center.y,
        radius,
        startAngle: -90,  // Start from top
        endAngle: -90 + angle,
        strokeWidth,
        strokeColor: color,
        fill: false,
      },
      // Value text
      ...(showValue ? [{
        type: 'text',
        text: `${Math.round(normalizedValue)}`,
        x: center.x,
        y: center.y + Spacing.sm + Spacing.xs,
        style: TypographyStyles.h3,
        color: ModernColorPalette.text.dark,
        align: 'center',
      }] : []),
    ],
  };
}

/**
 * Trend Arrow Component
 * Visual indicator for positive/negative trends
 */
export interface TrendArrowConfig {
  position: Position;
  direction: 'up' | 'down' | 'flat';
  size?: number;
  color?: string;
  value?: string;
}

export function createTrendArrow(config: TrendArrowConfig) {
  const { position, direction, size = IconSize.lg, color, value } = config;

  const arrowColor = color || (direction === 'up' ? ModernColorPalette.accent.success :
                                direction === 'down' ? ModernColorPalette.accent.error :
                                ModernColorPalette.accent.warning);

  return {
    type: 'trend-arrow',
    position,
    direction,
    size,
    color: arrowColor,
    elements: [
      // Arrow path (will be implemented in PDF renderer)
      {
        type: 'arrow',
        x: position.x,
        y: position.y,
        direction,
        size,
        color: arrowColor,
      },
      // Value text
      ...(value ? [{
        type: 'text',
        text: value,
        x: position.x + size + Spacing.sm + Spacing.xs,
        y: position.y + (size / 2),
        style: TypographyStyles.smallBold,
        color: arrowColor,
      }] : []),
    ],
  };
}

/**
 * Comparison Bar Component
 * Horizontal bar showing comparison between two values
 */
export interface ComparisonBarConfig {
  bounds: Bounds;
  subjectValue: number;
  compareValue: number;
  subjectLabel?: string;
  compareLabel?: string;
  color?: string;
  compareColor?: string;
}

export function createComparisonBar(config: ComparisonBarConfig) {
  const {
    bounds,
    subjectValue,
    compareValue,
    subjectLabel = 'Subject',
    compareLabel = 'Market',
    color = ModernColorPalette.primary,
    compareColor = ModernColorPalette.chart.tertiary,
  } = config;

  const labelWidth = Spacing['3xl'] + Spacing['3xl'] + Spacing.xl;
  const maxValue = Math.max(subjectValue, compareValue);
  const subjectWidth = (subjectValue / maxValue) * (bounds.width - labelWidth - Spacing.lg);
  const compareWidth = (compareValue / maxValue) * (bounds.width - labelWidth - Spacing.lg);

  const barHeight = Spacing.lg;
  const spacing = Spacing.md;

  return {
    type: 'comparison-bar',
    bounds,
    elements: [
      // Subject label
      {
        type: 'text',
        text: subjectLabel,
        x: bounds.x,
        y: bounds.y + Spacing.lg - Spacing.xs,
        style: TypographyStyles.small,
        color: ModernColorPalette.text.body,
      },
      // Subject bar
      {
        type: 'rect',
        x: bounds.x + labelWidth,
        y: bounds.y,
        width: subjectWidth,
        height: barHeight,
        color,
        borderRadius: Radius.sm,
      },
      // Subject value
      {
        type: 'text',
        text: formatMetricNumber(subjectValue),
        x: bounds.x + labelWidth + subjectWidth + Spacing.sm + Spacing.xs,
        y: bounds.y + Spacing.lg - Spacing.xs,
        style: TypographyStyles.smallBold,
        color: ModernColorPalette.text.dark,
      },
      // Compare label
      {
        type: 'text',
        text: compareLabel,
        x: bounds.x,
        y: bounds.y + barHeight + spacing + Spacing.lg - Spacing.xs,
        style: TypographyStyles.small,
        color: ModernColorPalette.text.body,
      },
      // Compare bar
      {
        type: 'rect',
        x: bounds.x + labelWidth,
        y: bounds.y + barHeight + spacing,
        width: compareWidth,
        height: barHeight,
        color: compareColor,
        borderRadius: Radius.sm,
      },
      // Compare value
      {
        type: 'text',
        text: formatMetricNumber(compareValue),
        x: bounds.x + labelWidth + compareWidth + Spacing.sm + Spacing.xs,
        y: bounds.y + barHeight + spacing + Spacing.lg - Spacing.xs,
        style: TypographyStyles.smallBold,
        color: ModernColorPalette.text.dark,
      },
    ],
  };
}

/**
 * Badge Component
 * Pill-shaped badge for labels and categories
 */
export interface BadgeConfig {
  position: Position;
  text: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'small' | 'medium' | 'large';
}

export function createBadge(config: BadgeConfig) {
  const { position, text, variant = 'primary', size = 'medium' } = config;

  const colorMap = {
    primary: ModernColorPalette.primary,
    success: ModernColorPalette.accent.success,
    warning: ModernColorPalette.accent.warning,
    error: ModernColorPalette.accent.error,
    neutral: ModernColorPalette.text.light,
  };

  const sizeMap = {
    small: { fontSize: Spacing.md, padding: Spacing.sm + Spacing.xs, height: Spacing.xl + Spacing.xs },
    medium: { fontSize: Spacing.lg - Spacing.xs, padding: Spacing.lg - Spacing.xs, height: Spacing['2xl'] },
    large: { fontSize: Spacing.lg, padding: Spacing.lg + Spacing.xs, height: Spacing['3xl'] },
  };

  const badgeColor = colorMap[variant];
  const badgeSize = sizeMap[size];

  // Estimate text width (rough approximation)
  const textWidth = text.length * (badgeSize.fontSize * 0.6);
  const badgeWidth = textWidth + (badgeSize.padding * 2);

  return {
    type: 'badge',
    position,
    elements: [
      // Badge background
      {
        type: 'rect',
        x: position.x,
        y: position.y,
        width: badgeWidth,
        height: badgeSize.height,
        color: badgeColor,
        borderRadius: Radius.full,
      },
      // Badge text
      {
        type: 'text',
        text: text.toUpperCase(),
        x: position.x + badgeSize.padding,
        y: position.y + (badgeSize.height / 2) + (badgeSize.fontSize / 3),
        style: {
          ...TypographyStyles.small,
          fontSize: badgeSize.fontSize,
        },
        color: ModernColorPalette.text.white,
      },
    ],
  };
}

/**
 * Section Header Component
 * Page section header with icon
 */
export interface SectionHeaderConfig {
  position: Position;
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  styleProps?: StyleProps;  // Additional style customization
}

export function createSectionHeader(config: SectionHeaderConfig) {
  const {
    position,
    title,
    subtitle,
    icon,
    iconColor = ModernColorPalette.primary,
    styleProps,
  } = config;

  // Apply style props with defaults
  const iconSize = styleProps?.iconSize ?? IconSize.xl;
  const spacing = resolveSpacing(styleProps?.spacing ?? Spacing['3xl']);

  return {
    type: 'section-header',
    position,
    elements: [
      // Icon (if provided)
      ...(icon ? [{
        type: 'icon',
        name: icon,
        x: position.x,
        y: position.y,
        size: iconSize,
        color: iconColor,
      }] : []),
      // Title
      {
        type: 'text',
        text: title,
        x: position.x + (icon ? spacing : 0),
        y: position.y + resolveSpacing(Spacing.lg) + resolveSpacing(Spacing.md),
        style: TypographyStyles.h1,
        color: ModernColorPalette.text.dark,
      },
      // Subtitle (if provided)
      ...(subtitle ? [{
        type: 'text',
        text: subtitle,
        x: position.x + (icon ? spacing : 0),
        y: position.y + Spacing['3xl'] + Spacing['2xl'] - Spacing.sm,
        style: TypographyStyles.body,
        color: ModernColorPalette.text.light,
      }] : []),
    ],
  };
}

/**
 * Icon Grid Component
 * Grid layout for icon + label pairs
 */
export interface IconGridItem {
  icon: string;
  label: string;
  value: string | number;
}

export interface IconGridConfig {
  bounds: Bounds;
  items: IconGridItem[];
  columns?: number;
  iconSize?: number;
  spacing?: number;
}

export function createIconGrid(config: IconGridConfig) {
  const { bounds, items, columns = 2, iconSize = IconSize.lg, spacing = Spacing.lg + Spacing.md } = config;

  const columnWidth = (bounds.width - (spacing * (columns - 1))) / columns;
  const rowHeight = Spacing['3xl'] + Spacing['2xl'] - Spacing.xs;
  const elements: any[] = [];

  items.forEach((item, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = bounds.x + (col * (columnWidth + spacing));
    const y = bounds.y + (row * rowHeight);

    elements.push(
      // Icon
      {
        type: 'icon',
        name: item.icon,
        x,
        y,
        size: iconSize,
        color: ModernColorPalette.chart.primary,
      },
      // Label
      {
        type: 'text',
        text: item.label,
        x: x + iconSize + Spacing.lg - Spacing.xs,
        y: y + Spacing.md,
        style: TypographyStyles.small,
        color: ModernColorPalette.text.light,
      },
      // Value
      {
        type: 'text',
        text: typeof item.value === 'number' ? formatMetricNumber(item.value) : item.value,
        x: x + iconSize + Spacing.lg - Spacing.xs,
        y: y + Spacing['2xl'],
        style: TypographyStyles.bodyBold,
        color: ModernColorPalette.text.dark,
      }
    );
  });

  return {
    type: 'icon-grid',
    bounds,
    columns,
    elements,
  };
}

/**
 * Export all component creators
 */
export const ModernComponents = {
  createKPICard,
  createGradientPanel,
  createProgressMeter,
  createRadialGauge,
  createTrendArrow,
  createComparisonBar,
  createBadge,
  createSectionHeader,
  createIconGrid,
};

export default ModernComponents;
