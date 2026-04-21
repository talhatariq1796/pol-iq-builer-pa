'use client';

/**
 * MapLoadingSkeleton - Loading skeleton for map panels
 *
 * Part of Phase 10.1: UI Polish
 * Shows while map is initializing
 */

import React from 'react';

interface MapLoadingSkeletonProps {
  /** Height of the skeleton */
  height?: string | number;
}

export default function MapLoadingSkeleton({ height = '100%' }: MapLoadingSkeletonProps) {
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className="relative w-full bg-gray-50 animate-pulse overflow-hidden"
      style={{ height: heightStyle }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0">
        <svg className="w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="gray" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Center loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4">
          {/* Spinner */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#33a852] rounded-full animate-spin" />
          </div>

          {/* Loading text */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-600">Loading map...</div>
            <div className="flex items-center justify-center gap-1">
              <div className="w-2 h-2 bg-[#33a852] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-[#33a852] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-[#33a852] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Mock controls (skeleton) */}
      <div className="absolute top-4 left-4 space-y-2">
        <div className="w-32 h-8 bg-gray-200 rounded-md" />
        <div className="w-24 h-8 bg-gray-200 rounded-md" />
      </div>

      <div className="absolute top-4 right-4 space-y-2">
        <div className="w-10 h-10 bg-gray-200 rounded-md" />
        <div className="w-10 h-10 bg-gray-200 rounded-md" />
      </div>
    </div>
  );
}

// Add shimmer animation to global CSS or inline style
// This would typically go in globals.css:
// @keyframes shimmer {
//   100% { transform: translateX(100%); }
// }
