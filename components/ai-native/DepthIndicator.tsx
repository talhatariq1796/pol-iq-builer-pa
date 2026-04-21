'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Target, FileText, TrendingUp, Check } from 'lucide-react';

interface DepthIndicatorProps {
  depth: number; // 0-100
  className?: string;
  onMilestoneUnlock?: (milestone: { threshold: number; label: string; unlocked: string }) => void;
}

const DEPTH_MILESTONES = [
  {
    threshold: 30,
    label: 'Save Segments',
    icon: Target,
    unlocked: 'segment saving',
    description: 'Save your exploration as a reusable segment'
  },
  {
    threshold: 60,
    label: 'Comparisons',
    icon: TrendingUp,
    unlocked: 'comparison analysis',
    description: 'Compare precincts side-by-side'
  },
  {
    threshold: 80,
    label: 'Full Reports',
    icon: FileText,
    unlocked: 'report generation',
    description: 'Generate comprehensive analysis reports'
  },
];

export function DepthIndicator({ depth, className = '', onMilestoneUnlock }: DepthIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<number | null>(null);
  const previousDepthRef = useRef(depth);


  // Find unlocked milestones
  const unlockedMilestones = DEPTH_MILESTONES.filter(m => depth >= m.threshold);

  // Detect milestone crossings
  useEffect(() => {
    const prevDepth = previousDepthRef.current;

    for (const milestone of DEPTH_MILESTONES) {
      if (prevDepth < milestone.threshold && depth >= milestone.threshold) {
        // Milestone just unlocked
        setRecentlyUnlocked(milestone.threshold);
        onMilestoneUnlock?.(milestone);

        // Clear the animation after 2 seconds
        setTimeout(() => setRecentlyUnlocked(null), 2000);
        break;
      }
    }

    previousDepthRef.current = depth;
  }, [depth, onMilestoneUnlock]);

  return (
    <div
      className={`relative flex items-center gap-3 ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Exploration Depth: {Math.round(depth)}%
          </div>
          <div className="space-y-2">
            {DEPTH_MILESTONES.map((milestone) => {
              const Icon = milestone.icon;
              const isUnlocked = depth >= milestone.threshold;
              return (
                <div
                  key={milestone.threshold}
                  className={`flex items-start gap-2 text-xs ${isUnlocked ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
                    }`}
                >
                  <div className={`mt-0.5 ${isUnlocked ? 'text-[#33a852]' : ''}`}>
                    {isUnlocked ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="font-medium">{milestone.label}</span>
                    <span className="text-gray-400 ml-1">({milestone.threshold}%)</span>
                    <p className="text-gray-500 dark:text-gray-400">{milestone.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
