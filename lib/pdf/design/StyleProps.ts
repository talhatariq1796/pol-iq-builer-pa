/**
 * Style Props System
 * Optional style overrides for PDF components
 */

import { ModernColorPalette } from './ModernColorPalette';
import { TypographyStyles } from './ModernTypography';
import {
  Spacing,
  Radius,
  Shadow,
  LineWidth,
  Opacity,
  IconSize,
  SpacingToken,
  RadiusToken,
  ShadowToken,
  LineWidthToken,
  OpacityToken,
  IconSizeToken
} from './ModernTokens';

/**
 * Base Style Props
 * Common style properties that can be overridden
 */
export interface StyleProps {
  // Spacing
  padding?: number | SpacingToken;
  paddingX?: number | SpacingToken;
  paddingY?: number | SpacingToken;
  paddingTop?: number | SpacingToken;
  paddingRight?: number | SpacingToken;
  paddingBottom?: number | SpacingToken;
  paddingLeft?: number | SpacingToken;

  margin?: number | SpacingToken;
  marginX?: number | SpacingToken;
  marginY?: number | SpacingToken;
  marginTop?: number | SpacingToken;
  marginRight?: number | SpacingToken;
  marginBottom?: number | SpacingToken;
  marginLeft?: number | SpacingToken;

  gap?: number | SpacingToken;

  // Icon & Visual
  iconSize?: number | IconSizeToken;
  spacing?: number | SpacingToken;
  lineWidth?: number | LineWidthToken;

  // Borders & Corners
  borderRadius?: number | RadiusToken;
  borderTopLeftRadius?: number | RadiusToken;
  borderTopRightRadius?: number | RadiusToken;
  borderBottomLeftRadius?: number | RadiusToken;
  borderBottomRightRadius?: number | RadiusToken;

  borderWidth?: number | LineWidthToken;
  borderColor?: string;

  // Visual Effects
  shadow?: string | ShadowToken;
  opacity?: number | OpacityToken;

  // Colors
  backgroundColor?: string;
  color?: string;
}

/**
 * Text Style Props
 * Typography-specific overrides
 */
export interface TextStyleProps extends StyleProps {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';
}

/**
 * Layout Style Props
 * Positioning and sizing
 */
export interface LayoutStyleProps extends StyleProps {
  display?: 'block' | 'inline' | 'flex' | 'grid';
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;

  // Flexbox (for future use)
  flexDirection?: 'row' | 'column';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  flexWrap?: 'nowrap' | 'wrap';
  gap?: number | SpacingToken;
}

/**
 * Resolve style prop value
 * Converts token names to actual values
 */
export function resolveSpacing(value: number | SpacingToken | undefined, defaultValue: number = 0): number {
  if (value === undefined) return defaultValue;
  if (typeof value === 'number') {
    if (value < 0) console.warn(`Negative spacing value detected: ${value}`);
    return value;
  }
  const resolved = Spacing[value];
  if (resolved === undefined) {
    console.warn(`Invalid spacing token: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return resolved;
}

export function resolveRadius(value: number | RadiusToken | undefined, defaultValue: number = 0): number {
  if (value === undefined) return defaultValue;
  if (typeof value === 'number') {
    if (value < 0) console.warn(`Negative radius value detected: ${value}`);
    return value;
  }
  const resolved = Radius[value];
  if (resolved === undefined) {
    console.warn(`Invalid radius token: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return resolved;
}

export function resolveShadow(value: string | ShadowToken | undefined, defaultValue: string = Shadow.none): string {
  if (value === undefined) return defaultValue;
  if (value.startsWith('rgba(') || value.startsWith('rgb(')) return value;
  return Shadow[value as ShadowToken] ?? defaultValue;
}

export function resolveLineWidth(value: number | LineWidthToken | undefined, defaultValue: number = 0): number {
  if (value === undefined) return defaultValue;
  if (typeof value === 'number') {
    if (value < 0) console.warn(`Negative line width value detected: ${value}`);
    return value;
  }
  const resolved = LineWidth[value];
  if (resolved === undefined) {
    console.warn(`Invalid line width token: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return resolved;
}

export function resolveOpacity(value: number | OpacityToken | undefined, defaultValue: number = 1): number {
  if (value === undefined) return defaultValue;
  if (typeof value === 'number') {
    if (value < 0 || value > 1) console.warn(`Invalid opacity value (must be 0-1): ${value}`);
    return Math.max(0, Math.min(1, value));
  }
  const resolved = Opacity[value];
  if (resolved === undefined) {
    console.warn(`Invalid opacity token: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return resolved;
}

/**
 * Resolve icon size
 */
export function resolveIconSize(value: number | IconSizeToken | undefined, defaultValue: number = 16): number {
  if (value === undefined) return defaultValue;
  if (typeof value === 'number') {
    if (value < 0) console.warn(`Negative icon size value detected: ${value}`);
    return value;
  }
  const resolved = IconSize[value];
  if (resolved === undefined) {
    console.warn(`Invalid icon size token: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return resolved;
}

/**
 * Merge style props with defaults
 */
export function mergeStyles<T extends StyleProps>(defaults: T, overrides?: Partial<T>): T {
  if (!overrides) return defaults;

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Extract spacing from StyleProps
 */
export function extractPadding(style?: StyleProps): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (!style) return { top: 0, right: 0, bottom: 0, left: 0 };

  const base = resolveSpacing(style.padding, 0);
  const x = resolveSpacing(style.paddingX, base);
  const y = resolveSpacing(style.paddingY, base);

  return {
    top: resolveSpacing(style.paddingTop, y),
    right: resolveSpacing(style.paddingRight, x),
    bottom: resolveSpacing(style.paddingBottom, y),
    left: resolveSpacing(style.paddingLeft, x),
  };
}

export function extractMargin(style?: StyleProps): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (!style) return { top: 0, right: 0, bottom: 0, left: 0 };

  const base = resolveSpacing(style.margin, 0);
  const x = resolveSpacing(style.marginX, base);
  const y = resolveSpacing(style.marginY, base);

  return {
    top: resolveSpacing(style.marginTop, y),
    right: resolveSpacing(style.marginRight, x),
    bottom: resolveSpacing(style.marginBottom, y),
    left: resolveSpacing(style.marginLeft, x),
  };
}

/**
 * Default style presets
 */
export const StylePresets = {
  card: {
    padding: 'md' as SpacingToken,
    borderRadius: 'lg' as RadiusToken,
    shadow: 'sm' as ShadowToken,
    backgroundColor: ModernColorPalette.background.card,
    borderWidth: 'hairline' as LineWidthToken,
    borderColor: ModernColorPalette.border.light,
  },

  panel: {
    padding: 'lg' as SpacingToken,
    borderRadius: 'xl' as RadiusToken,
    shadow: 'md' as ShadowToken,
    backgroundColor: ModernColorPalette.background.card,
  },

  section: {
    marginBottom: 'xl' as SpacingToken,
  },

  compact: {
    padding: 'sm' as SpacingToken,
    gap: 'sm' as SpacingToken,
  },

  spacious: {
    padding: 'xl' as SpacingToken,
    gap: 'lg' as SpacingToken,
  },
} as const;
