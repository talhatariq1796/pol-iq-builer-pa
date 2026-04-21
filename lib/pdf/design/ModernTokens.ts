/**
 * Modern Design Tokens
 * Consistent spacing, sizing, and visual properties for PDF generation
 */

/**
 * Spacing Scale (in millimeters)
 * Used for margins, padding, gaps between elements
 * Increased for better white space and readability
 */
export const Spacing = {
  none: 0,
  xs: 3,    // Extra small: tight spacing (was 2)
  sm: 6,    // Small: compact layouts (was 4)
  md: 10,   // Medium: standard spacing (was 8)
  lg: 16,   // Large: generous spacing (was 12)
  xl: 24,   // Extra large: section separators (was 16)
  '2xl': 32, // 2X large: major sections (was 24)
  '3xl': 48, // 3X large: page sections (was 32)
} as const;

/**
 * Border Radius Scale (in millimeters)
 * Consistent rounding for cards, buttons, containers
 */
export const Radius = {
  none: 0,
  sm: 2,    // Subtle: badges, small elements
  md: 4,    // Standard: cards, inputs
  lg: 6,    // Prominent: feature cards
  xl: 8,    // Hero: large containers
  '2xl': 12, // Extra prominent: hero sections
  full: 999, // Fully rounded: pills, avatars
} as const;

/**
 * Shadow Definitions
 * Depth and elevation for visual hierarchy
 */
export const Shadow = {
  none: 'rgba(0, 0, 0, 0)',
  xs: 'rgba(0, 0, 0, 0.05)',   // Subtle elevation
  sm: 'rgba(0, 0, 0, 0.1)',    // Standard cards
  md: 'rgba(0, 0, 0, 0.15)',   // Elevated elements
  lg: 'rgba(0, 0, 0, 0.2)',    // Prominent features
  xl: 'rgba(0, 0, 0, 0.25)',   // Maximum elevation
} as const;

/**
 * Line Width Scale (in millimeters)
 * Consistent stroke widths for borders, lines, dividers
 */
export const LineWidth = {
  none: 0,
  hairline: 0.25,  // Subtle dividers
  thin: 0.5,       // Standard borders
  base: 1,         // Default lines
  thick: 1.5,      // Emphasis
  bold: 2,         // Strong emphasis
} as const;

/**
 * Opacity Scale
 * Consistent transparency levels
 */
export const Opacity = {
  transparent: 0,
  subtle: 0.05,
  light: 0.1,
  medium: 0.5,
  strong: 0.75,
  opaque: 1,
} as const;

/**
 * Z-Index Layering
 * Control visual stacking order
 */
export const ZIndex = {
  background: -1,
  base: 0,
  content: 1,
  overlay: 2,
  modal: 3,
  tooltip: 4,
  top: 5,
} as const;

/**
 * Icon Sizes (in millimeters)
 * Consistent icon dimensions
 */
export const IconSize = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
} as const;

/**
 * Avatar/Image Sizes (in millimeters)
 */
export const AvatarSize = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
  '2xl': 96,
} as const;

/**
 * Container Max Widths (in millimeters)
 * Standard content container sizes
 */
export const ContainerWidth = {
  sm: 150,   // Narrow content
  md: 180,   // Standard content
  lg: 200,   // Wide content
  xl: 210,   // Full page width (A4: 210mm)
  full: 297, // A4 height used as width (landscape)
} as const;

/**
 * Card Height Scale (in millimeters)
 * Consistent card heights for different layouts
 */
export const CardHeight = {
  compact: 40,
  standard: 50,
  comfortable: 60,
  spacious: 80,
} as const;

/**
 * Transition Durations (not used in PDF, but for future animations)
 */
export const Duration = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

/**
 * Combined Design Tokens
 * Export as single object for convenience
 */
export const ModernTokens = {
  spacing: Spacing,
  radius: Radius,
  shadow: Shadow,
  lineWidth: LineWidth,
  opacity: Opacity,
  zIndex: ZIndex,
  iconSize: IconSize,
  avatarSize: AvatarSize,
  containerWidth: ContainerWidth,
  cardHeight: CardHeight,
  duration: Duration,
} as const;

/**
 * Type exports for TypeScript
 */
export type SpacingToken = keyof typeof Spacing;
export type RadiusToken = keyof typeof Radius;
export type ShadowToken = keyof typeof Shadow;
export type LineWidthToken = keyof typeof LineWidth;
export type OpacityToken = keyof typeof Opacity;
export type ZIndexToken = keyof typeof ZIndex;
export type IconSizeToken = keyof typeof IconSize;
export type AvatarSizeToken = keyof typeof AvatarSize;
export type ContainerWidthToken = keyof typeof ContainerWidth;
export type CardHeightToken = keyof typeof CardHeight;
export type DurationToken = keyof typeof Duration;
