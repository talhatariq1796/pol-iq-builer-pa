'use client';

/**
 * MapToggleButton - Floating button to show/hide map
 *
 * Part of Phase 3: Unified AI-First Architecture
 * Phase 10.1: Enhanced with responsive behavior and better mobile prominence
 * Fixed position button for toggling map visibility on any page
 */

import React from 'react';
import { useIsMobile, useIsSmallScreen } from '@/lib/hooks/useMediaQuery';

interface MapToggleButtonProps {
  /** Whether map is currently visible */
  isMapVisible: boolean;
  /** Toggle visibility callback */
  onToggle: () => void;
  /** Position on screen */
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  /** Show indicator when map has active visualization */
  hasActiveVisualization?: boolean;
  /** Custom label */
  label?: string;
}

export default function MapToggleButton({
  isMapVisible,
  onToggle,
  position = 'bottom-right',
  hasActiveVisualization = false,
  label,
}: MapToggleButtonProps) {
  const isMobile = useIsMobile();
  const isSmallScreen = useIsSmallScreen();

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-left': 'bottom-4 left-4',
  }[position];

  // Mobile-specific styles
  const mobileStyles = isMobile
    ? 'px-4 py-4 shadow-2xl border-2'
    : 'px-4 py-3 shadow-lg border';

  const iconSize = isSmallScreen ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <button
      onClick={onToggle}
      className={`fixed ${positionClasses} z-40 flex items-center gap-2 ${mobileStyles} bg-white rounded-xl border-gray-200 hover:shadow-xl hover:border-[#33a852] transition-all duration-200 group active:scale-95`}
      title={isMapVisible ? 'Hide Map' : 'Show Map'}
      aria-label={isMapVisible ? 'Hide map panel' : 'Show map panel'}
    >
      {/* Map icon or X icon */}
      <div className="relative">
        {isMapVisible ? (
          <svg
            className={`${iconSize} text-gray-600 group-hover:text-[#33a852] transition-all duration-200 group-hover:scale-110`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className={`${iconSize} text-gray-600 group-hover:text-[#33a852] transition-all duration-200 group-hover:scale-110`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        )}

        {/* Active visualization indicator */}
        {hasActiveVisualization && !isMapVisible && (
          <div className={`absolute -top-1 -right-1 rounded-full bg-[#33a852] animate-pulse ${
            isSmallScreen ? 'w-4 h-4' : 'w-3 h-3'
          }`} />
        )}
      </div>

      {/* Label - hidden on small screens only */}
      <span className={`text-sm font-medium text-gray-700 group-hover:text-[#33a852] transition-colors ${
        isSmallScreen ? 'hidden' : 'sm:block'
      }`}>
        {label || (isMapVisible ? 'Hide Map' : 'Show Map')}
      </span>
    </button>
  );
}
