'use client';

/**
 * MetricLabel Component
 *
 * Displays metric labels with helpful tooltips explaining what each metric measures.
 * Used across the application for political metrics, targeting scores, and demographic data.
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Metric definitions - centralized source of truth
export const METRIC_DEFINITIONS: Record<string, string> = {
  // Targeting Scores
  swing_potential: 'Likelihood of this area changing partisan outcome based on margin volatility, ticket-splitting, and demographic indicators. Higher scores indicate more competitive races.',
  gotv_priority: 'Value of turnout mobilization calculated as: Support Score × (1 - Turnout Rate) × Voter Count. Higher scores mean greater potential impact from get-out-the-vote efforts.',
  partisan_lean: 'Historical voting pattern from -100 (Strong R) to +100 (Strong D), based on weighted average of recent elections (2024: 50%, 2022: 30%, 2020: 20%).',
  persuasion_opportunity: 'Proportion of persuadable voters based on margin closeness and ticket-splitting history. Higher scores indicate more undecided voters.',
  persuasion_score: 'Proportion of persuadable voters based on margin closeness and ticket-splitting history. Higher scores indicate more undecided voters.',

  // Turnout & Participation
  turnout_rate: 'Percentage of eligible voters who cast ballots in recent elections. Higher turnout indicates stronger civic engagement.',
  avg_turnout: 'Average percentage of eligible voters who cast ballots across multiple recent elections.',
  estimated_turnout: 'Expected number of voters who will participate, based on historical turnout rates and registered voter counts.',

  // Competitiveness
  competitiveness: 'How close elections are based on partisan lean: Safe (<20pts spread), Likely (10-20pts), Lean (5-10pts), Toss-up (<5pts spread).',

  // Voter Metrics
  registered_voters: 'Number of citizens registered to vote in this area. This is the mobilization universe.',
  active_voters: 'Registered voters who have voted in at least one of the last 3 elections. More reliable targets for GOTV.',
  vap: 'Voting Age Population - total population aged 18 and older, including non-citizens and unregistered individuals.',

  // Targeting Indices
  persuasion_index: 'Composite score measuring persuadability: (Swing Potential × 0.6) + ((100 - |Partisan Lean|) × 0.4). Higher = more persuadable voters.',
  mobilization_index: 'Composite score measuring mobilization opportunity: (|Partisan Lean| × 0.5) + (Turnout Gap × 0.5). Higher = more GOTV potential.',

  // Strategy Classifications
  targeting_priority: 'Overall targeting value based on competitiveness, swing potential, and voter count. High priority areas get more resources.',
  targeting_strategy: 'Recommended campaign approach: Battleground (swing voters), Base Mobilization (turnout), Persuasion Target (undecideds), Maintenance (safe areas).',

  // Demographics (common)
  median_income: 'Median household income for residents in this area (from US Census American Community Survey).',
  median_age: 'Median age of residents in this area (from US Census data).',
  education_bachelors_pct: 'Percentage of adults (25+) with a bachelor\'s degree or higher.',
  population: 'Total population residing in this area (from most recent Census data).',

  // Donor Metrics
  total_amount: 'Total dollar amount contributed by all donors in this area across selected time period.',
  donor_count: 'Number of unique individual donors who have contributed.',
  avg_contribution: 'Average (mean) contribution amount per donor.',
  rfm_score: 'Recency-Frequency-Monetary score: composite metric measuring how recently, how often, and how much donors give.',
};

interface MetricLabelProps {
  /** Metric key to look up the definition */
  metric: string;
  /** The label text to display */
  children: React.ReactNode;
  /** Optional custom definition (overrides default) */
  definition?: string;
  /** Whether to show the help icon (default: true) */
  showIcon?: boolean;
  /** Additional CSS classes for the trigger span */
  className?: string;
}

/**
 * MetricLabel - A label with an optional help tooltip
 *
 * @example
 * <MetricLabel metric="swing_potential">Swing Potential</MetricLabel>
 *
 * @example
 * <MetricLabel metric="gotv_priority" showIcon={false}>GOTV</MetricLabel>
 */
export function MetricLabel({
  metric,
  children,
  definition,
  showIcon = true,
  className = ''
}: MetricLabelProps) {
  const tooltipText = definition || METRIC_DEFINITIONS[metric];

  // If no definition available, just return the label without tooltip
  if (!tooltipText) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
            {children}
            {showIcon && (
              <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left">
          <p className="text-sm leading-relaxed">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Alternative approach - Info icon that doesn't wrap the label
 * Useful when you want more control over layout
 *
 * @example
 * <div className="flex items-center gap-1">
 *   <span>Swing Potential</span>
 *   <MetricTooltip metric="swing_potential" />
 * </div>
 */
export function MetricTooltip({
  metric,
  definition,
  className = ''
}: {
  metric: string;
  definition?: string;
  className?: string;
}) {
  const tooltipText = definition || METRIC_DEFINITIONS[metric];

  if (!tooltipText) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center ${className}`}
            aria-label="More information"
          >
            <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left">
          <p className="text-sm leading-relaxed">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
