/**
 * FeatureSelectionCard Component
 *
 * Displays map feature selections as cards in the AI chat interface.
 * Replaces traditional map popups with a conversational, AI-integrated experience.
 *
 * Part of Phase G: AI-Integrated Feature Selection
 * See docs/AI-CONTEXT-AWARENESS-PLAN.md for architecture details.
 */

'use client';

import React from 'react';
import type { FeatureSelectionResult } from '@/lib/ai/featureSelectionHandler';
import type { SuggestedAction } from './AIPoliticalSessionHost';

// ============================================================================
// Type Definitions
// ============================================================================

export interface FeatureSelectionCardProps {
  selection: FeatureSelectionResult;
  onAction: (action: SuggestedAction) => void;
  isLoading?: boolean;
}

// ============================================================================
// Score Bar Component
// ============================================================================

interface ScoreBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, value, maxValue, color }) => {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
  const filledBlocks = Math.round(percentage / 10);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-20">{label}:</span>
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-2.5 flex-1 rounded-sm transition-colors"
            style={{
              backgroundColor: i < filledBlocks ? color : '#e5e7eb',
            }}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right">{value}</span>
    </div>
  );
};

// ============================================================================
// Feature Icon Component
// ============================================================================

interface FeatureIconProps {
  featureType: string;
}

const FeatureIcon: React.FC<FeatureIconProps> = ({ featureType }) => {
  const iconMap: Record<string, React.ReactNode> = {
    precinct: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    hexagon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
    zip: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    municipality: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    state_house: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
    state_senate: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
  };

  return (
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#33a852] to-[#2d9944] flex items-center justify-center text-white">
      {iconMap[featureType] || iconMap.precinct}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const FeatureSelectionCard: React.FC<FeatureSelectionCardProps> = ({
  selection,
  onAction,
  isLoading = false,
}) => {
  const { feature, cardTitle, cardSubtitle, primaryMetrics, secondaryMetrics, scoreBars, suggestedActions } = selection;

  return (
    <div className="w-full bg-white border border-[#33a852]/30 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3 border-b border-[#33a852]/20">
        <div className="flex items-center gap-3">
          <FeatureIcon featureType={feature.featureType} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{cardTitle}</h3>
            <p className="text-xs text-gray-600">{cardSubtitle}</p>
          </div>
          <span className="text-xs text-[#33a852] font-medium px-2 py-0.5 bg-[#33a852]/10 rounded-full capitalize">
            {feature.featureType.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4">
          {primaryMetrics.map((metric, index) => (
            <div key={index} className="flex items-center gap-1.5 flex-1 min-w-0">
              {metric.icon && <span className="text-sm">{metric.icon}</span>}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-gray-900 truncate">{metric.value}</span>
                <span className="text-[10px] text-gray-500 truncate">{metric.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score Bars (for precincts) */}
      {scoreBars.length > 0 && (
        <div className="px-4 py-3 space-y-2 border-b border-gray-100">
          <div className="text-xs font-medium text-gray-700 mb-2">Targeting Scores:</div>
          {scoreBars.map((bar, index) => (
            <ScoreBar key={index} {...bar} />
          ))}
        </div>
      )}

      {/* Secondary Metrics */}
      {secondaryMetrics.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {secondaryMetrics.map((metric, index) => (
              <div key={index} className="text-xs">
                <span className="text-gray-500">{metric.label}:</span>{' '}
                <span className="text-gray-700 font-medium">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Actions */}
      {suggestedActions.length > 0 && (
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action) => (
              <button
                key={action.id}
                onClick={() => onAction(action)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium text-[#33a852] bg-[#33a852]/5 hover:bg-[#33a852]/10 border border-[#33a852]/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Compact Variant
// ============================================================================

export interface CompactFeatureCardProps {
  title: string;
  subtitle?: string;
  featureType: string;
  onClick?: () => void;
}

export const CompactFeatureCard: React.FC<CompactFeatureCardProps> = ({
  title,
  subtitle,
  featureType,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-white border border-gray-200 rounded-xl hover:border-[#33a852] hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2">
        <FeatureIcon featureType={featureType} />
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-gray-900 truncate">{title}</h4>
          {subtitle && <p className="text-[10px] text-gray-500 truncate">{subtitle}</p>}
        </div>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
};

// ============================================================================
// Loading Skeleton
// ============================================================================

export const FeatureSelectionCardSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden animate-pulse">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-200" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-32 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-12 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 bg-gray-200 rounded-lg w-24" />
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default FeatureSelectionCard;
