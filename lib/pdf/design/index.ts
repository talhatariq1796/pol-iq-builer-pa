/**
 * PDF Design System - Modern Infographic Design
 *
 * Exports design tokens, color palettes, typography, and reusable components
 * for the modern infographic CMA report design.
 */

export { ModernColorPalette } from './ModernColorPalette';
export { ModernTypography } from './ModernTypography';
export { ModernComponents } from './ModernComponents';

// Design Tokens
export {
  ModernTokens,
  Spacing,
  Radius,
  Shadow,
  LineWidth,
  Opacity,
  ZIndex,
  IconSize,
  AvatarSize,
  ContainerWidth,
  CardHeight,
  Duration,
} from './ModernTokens';

// Style Props System
export {
  resolveSpacing,
  resolveRadius,
  resolveShadow,
  resolveLineWidth,
  resolveOpacity,
  resolveIconSize,
  mergeStyles,
  extractPadding,
  extractMargin,
  StylePresets,
} from './StyleProps';

// Layout Helpers
export {
  distributeHorizontal,
  stack,
  grid,
  center,
  alignHorizontal,
  alignVertical,
  inset,
  calculateStackHeight,
  calculateRowWidth,
  wrap,
  flex,
  position,
} from './LayoutHelpers';

// Re-export types
export type { ColorPalette } from './ModernColorPalette';
export type { Typography } from './ModernTypography';
export type {
  SpacingToken,
  RadiusToken,
  ShadowToken,
  LineWidthToken,
  OpacityToken,
  ZIndexToken,
  IconSizeToken,
  AvatarSizeToken,
  ContainerWidthToken,
  CardHeightToken,
  DurationToken,
} from './ModernTokens';
export type {
  StyleProps,
  TextStyleProps,
  LayoutStyleProps,
} from './StyleProps';
export type {
  Bounds,
  Position,
  Size,
} from './LayoutHelpers';
