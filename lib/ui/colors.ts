/**
 * Political Analysis Platform - Color System
 *
 * Centralized color constants for consistent branding across the platform.
 * Based on MPIQ branding with political color coding.
 */

// ============================================================================
// Brand Colors
// ============================================================================

export const brand = {
  // Primary MPIQ Green
  mpiqGreen: '#33a852',
  mpiqGreenLight: '#e6f4ea',
  mpiqGreenDark: '#2d9944',

  // Gradients
  greenGradient: 'linear-gradient(135deg, #33a852 0%, #2d9944 100%)',
} as const;

// ============================================================================
// Political Colors
// ============================================================================

export const political = {
  // Democratic Blue
  demBlue: '#1e40af',        // Dark blue for text/primary
  demBlueMid: '#3b82f6',     // Medium blue for accents
  demBlueLight: '#dbeafe',   // Light blue for backgrounds
  demBlueVeryLight: '#eff6ff', // Very light for subtle highlights

  // Republican Red
  repRed: '#b91c1c',         // Dark red for text/primary
  repRedMid: '#ef4444',      // Medium red for accents
  repRedLight: '#fee2e2',    // Light red for backgrounds
  repRedVeryLight: '#fef2f2', // Very light for subtle highlights

  // Neutral/Independent
  neutral: '#6b7280',        // Gray for neutral/independent
  neutralLight: '#f3f4f6',   // Light gray background

  // Gradients
  demGradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
  repGradient: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
} as const;

// ============================================================================
// Semantic Colors
// ============================================================================

export const semantic = {
  // Success
  success: '#10b981',
  successLight: '#d1fae5',

  // Warning
  warning: '#f59e0b',
  warningLight: '#fef3c7',

  // Error
  error: '#dc2626',
  errorLight: '#fee2e2',

  // Info
  info: '#3b82f6',
  infoLight: '#dbeafe',
} as const;

// ============================================================================
// UI Colors
// ============================================================================

export const ui = {
  // Backgrounds
  bgPrimary: '#ffffff',
  bgSecondary: '#f9fafb',
  bgTertiary: '#f3f4f6',
  bgHover: '#f3f4f6',

  // Borders
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  borderDark: '#d1d5db',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textInverse: '#ffffff',

  // Shadows
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get partisan color based on lean value
 * @param lean - Partisan lean value (-100 to +100, negative = R, positive = D)
 * @param intensity - Color intensity: 'light', 'mid', 'dark'
 */
export function getPartisanColor(lean: number, intensity: 'light' | 'mid' | 'dark' = 'mid'): string {
  if (lean > 5) {
    // Democratic
    return intensity === 'dark'
      ? political.demBlue
      : intensity === 'mid'
      ? political.demBlueMid
      : political.demBlueLight;
  } else if (lean < -5) {
    // Republican
    return intensity === 'dark'
      ? political.repRed
      : intensity === 'mid'
      ? political.repRedMid
      : political.repRedLight;
  } else {
    // Neutral
    return intensity === 'dark'
      ? ui.textSecondary
      : intensity === 'mid'
      ? ui.textMuted
      : ui.bgTertiary;
  }
}

/**
 * Get color class name based on partisan lean
 * @param lean - Partisan lean value (-100 to +100)
 * @param variant - Style variant: 'bg', 'text', 'border'
 */
export function getPartisanColorClass(
  lean: number,
  variant: 'bg' | 'text' | 'border' = 'bg'
): string {
  const prefix = variant === 'bg' ? 'bg-' : variant === 'text' ? 'text-' : 'border-';

  if (lean >= 20) return `${prefix}blue-600 text-white`;
  if (lean >= 10) return `${prefix}blue-400 text-white`;
  if (lean >= 5) return `${prefix}blue-200`;
  if (lean > -5) return `${prefix}gray-200`;
  if (lean > -10) return `${prefix}red-200`;
  if (lean > -20) return `${prefix}red-400 text-white`;
  return `${prefix}red-600 text-white`;
}

/**
 * Get competitiveness color
 * @param competitiveness - Competitiveness classification
 */
export function getCompetitivenessColor(
  competitiveness: 'Safe D' | 'Likely D' | 'Lean D' | 'Tossup' | 'Lean R' | 'Likely R' | 'Safe R'
): string {
  switch (competitiveness) {
    case 'Safe D': return political.demBlue;
    case 'Likely D': return political.demBlueMid;
    case 'Lean D': return political.demBlueLight;
    case 'Tossup': return political.neutral;
    case 'Lean R': return political.repRedLight;
    case 'Likely R': return political.repRedMid;
    case 'Safe R': return political.repRed;
    default: return ui.textSecondary;
  }
}

/**
 * Get strategy badge color
 * @param strategy - Targeting strategy type
 */
export function getStrategyColor(strategy: string): string {
  switch (strategy) {
    case 'Battleground':
      return 'bg-purple-500 text-white';
    case 'Base Mobilization':
      return 'bg-blue-500 text-white';
    case 'Persuasion Target':
      return 'bg-amber-500 text-white';
    case 'Low Priority':
      return 'bg-gray-400 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

// ============================================================================
// Export All
// ============================================================================

export const colors = {
  brand,
  political,
  semantic,
  ui,
} as const;

export default colors;
