/**
 * QuickStartIQ Dialog
 *
 * A dialog with predefined queries organized by category to help users
 * understand what they can ask the AI assistant. Each query triggers
 * different analysis and map visualization.
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Target,
  Users,
  TrendingUp,
  Map,
  BarChart3,
  Megaphone,
  ChevronRight,
  Sparkles,
  Layers,
  ScatterChart,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PredefinedQuery {
  id: string;
  label: string;
  query: string;
  description: string;
  expectedVisual:
  | 'heatmap'
  | 'choropleth'
  | 'highlights'
  | 'chart'
  | 'bivariate'      // Two-variable choropleth
  | 'scatter'        // Scatter plot correlation
  | 'proportional'   // Sized/colored symbols
  | 'valueByAlpha';  // Confidence-weighted display
  metric?: string;
  // For multi-variable visualizations
  xMetric?: string;
  yMetric?: string;
  sizeMetric?: string;
  colorMetric?: string;
}

interface QueryCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  queries: PredefinedQuery[];
}

interface QuickStartIQDialogProps {
  onQuerySelect: (
    query: string,
    metadata?: { category: string; visualType: string; metric?: string; queryId?: string }
  ) => void;
  disabled?: boolean;
  hasSelection?: boolean;
}

// ============================================================================
// Predefined Queries by Category
// ============================================================================

const QUERY_CATEGORIES: QueryCategory[] = [
  {
    id: 'targeting',
    name: 'Targeting',
    icon: <Target className="h-4 w-4" />,
    description: 'Find high-value areas for campaign focus',
    queries: [
      {
        id: 'swing-areas',
        label: 'Find Swing Areas',
        query: 'Show me the top swing precincts in this area with the highest persuasion potential',
        description: 'Identifies areas with volatile voting patterns and persuadable voters',
        expectedVisual: 'heatmap',
        metric: 'swing_potential',
      },
      {
        id: 'battleground-precincts',
        label: 'Battleground Precincts',
        query: 'Which precincts are true battlegrounds with margins under 5 points?',
        description: 'Highlights ultra-competitive precincts where small shifts matter',
        expectedVisual: 'choropleth',
        metric: 'partisan_lean',
      },
      {
        id: 'combined-priority',
        label: 'Combined Priority Score',
        query: 'Rank precincts by combined targeting priority considering swing, turnout, and population',
        description: 'Composite score balancing multiple targeting factors',
        expectedVisual: 'heatmap',
        metric: 'combined_score',
      },
    ],
  },
  {
    id: 'gotv',
    name: 'GOTV',
    icon: <Users className="h-4 w-4" />,
    description: 'Get-out-the-vote mobilization',
    queries: [
      {
        id: 'gotv-priority',
        label: 'GOTV Priority Areas',
        query:
          'Where should we focus GOTV? Show precincts with GOTV priority at least 60 and average turnout under 58% — high mobilization upside where participation is still low.',
        description: 'High GOTV opportunity with below-average turnout (classic knock-and-drag targets)',
        expectedVisual: 'heatmap',
        metric: 'gotv_priority',
      },
      {
        id: 'turnout-dropoff',
        label: 'Midterm Dropoff',
        query: 'Show me precincts with the biggest turnout dropoff between presidential and midterm elections',
        description: 'Identifies areas losing voters in non-presidential years',
        expectedVisual: 'choropleth',
        metric: 'turnout',
      },
      {
        id: 'base-mobilization',
        label: 'Base Mobilization',
        query: 'Find friendly precincts with room for turnout improvement among our base voters',
        description: 'Safe areas where turnout gains come from supporters',
        expectedVisual: 'highlights',
      },
    ],
  },
  {
    id: 'persuasion',
    name: 'Persuasion',
    icon: <Megaphone className="h-4 w-4" />,
    description: 'Voter persuasion opportunities',
    queries: [
      {
        id: 'persuasion-targets',
        label: 'Persuasion Opportunities',
        query:
          'Which precincts have the highest persuasion opportunity scores? Show precincts with persuasion opportunity at least 65 (strong persuadable-voter modeling).',
        description: 'High persuasion-opportunity scores — IDs, mail, and volunteer persuasion programs',
        expectedVisual: 'heatmap',
        metric: 'persuasion_opportunity',
      },
      {
        id: 'crossover-areas',
        label: 'Crossover Potential',
        query:
          'Find precincts with swing potential at least 40 and persuasion opportunity at least 55 — areas where ticket-splitting and crossover voting are most plausible.',
        description: 'Swing + persuasion combined (proxy for crossover-prone turf)',
        expectedVisual: 'choropleth',
        metric: 'swing_potential',
      },
      {
        id: 'soft-support',
        label: 'Soft Support Areas',
        query:
          'Show competitive precincts that are not safe seats: lean Democratic, lean Republican, or toss-up only (exclude safe D and safe R).',
        description: 'Tight margins — reinforcement and turnout, not base-only messaging',
        expectedVisual: 'highlights',
        metric: 'partisan_lean',
      },
    ],
  },
  {
    id: 'demographics',
    name: 'Demographics',
    icon: <BarChart3 className="h-4 w-4" />,
    description: 'Voter demographic analysis',
    queries: [
      {
        id: 'college-educated',
        label: 'College-Educated Areas',
        query:
          'Show precincts with the highest concentration of college-educated voters (rank by modeled % with a bachelor’s degree or higher)',
        description: 'Uses precinct education estimates — results ordered by college %',
        expectedVisual: 'choropleth',
      },
      {
        id: 'young-voters',
        label: 'Young Voter Hubs',
        query: 'Where are the concentrations of voters under 35?',
        description: 'Identifies areas with younger voter demographics',
        expectedVisual: 'heatmap',
      },
      {
        id: 'income-analysis',
        label: 'Income Distribution',
        query: 'Compare political lean across different income levels in this area',
        description: 'Analyzes how income correlates with voting patterns',
        expectedVisual: 'chart',
      },
    ],
  },
  {
    id: 'trends',
    name: 'Trends',
    icon: <TrendingUp className="h-4 w-4" />,
    description: 'Historical voting trends',
    queries: [
      {
        id: 'shifting-areas',
        label: 'Shifting Precincts',
        query: 'Which precincts have shifted most dramatically over the last 3 elections?',
        description: 'Tracks partisan shift trends over time',
        expectedVisual: 'choropleth',
      },
      {
        id: 'turnout-trends',
        label: 'Turnout Trends',
        query: 'Show me turnout trends - which areas are voting more or less than before?',
        description: 'Tracks participation changes across elections',
        expectedVisual: 'chart',
      },
      {
        id: 'margin-changes',
        label: 'Margin Changes',
        query: 'Where have margins tightened or widened since 2020?',
        description: 'Identifies precincts becoming more or less competitive',
        expectedVisual: 'choropleth',
      },
    ],
  },
  {
    id: 'strategy',
    name: 'Strategy',
    icon: <Map className="h-4 w-4" />,
    description: 'Strategic campaign insights',
    queries: [
      {
        id: 'resource-allocation',
        label: 'Resource Allocation',
        query: 'If I have limited resources, which 5 precincts should I prioritize and why?',
        description: 'Optimized targeting recommendations with rationale',
        expectedVisual: 'highlights',
      },
      {
        id: 'opponent-territory',
        label: 'Opponent Territory',
        query: 'Show me their strongest precincts - where should we avoid spending resources?',
        description: 'Identifies areas to deprioritize',
        expectedVisual: 'choropleth',
      },
      {
        id: 'efficiency-score',
        label: 'Canvassing Efficiency',
        query: 'Rank precincts by canvassing efficiency - doors per persuadable voter',
        description: 'Optimizes field operations based on density and persuadability',
        expectedVisual: 'heatmap',
      },
    ],
  },
  // {
  //   id: 'multivar',
  //   name: 'Multi-Var',
  //   icon: <Layers className="h-4 w-4" />,
  //   description: 'Advanced multi-variable visualizations',
  //   queries: [
  //     {
  //       id: 'gotv-persuasion-bivariate',
  //       label: 'GOTV vs Persuasion Matrix',
  //       query: 'Show me a bivariate map comparing GOTV priority against persuasion opportunity to find areas high in both',
  //       description: 'Two-variable choropleth showing where both metrics are high (purple = sweet spot)',
  //       expectedVisual: 'bivariate',
  //       xMetric: 'gotv_priority',
  //       yMetric: 'persuasion_opportunity',
  //     },
  //     {
  //       id: 'swing-turnout-scatter',
  //       label: 'Swing vs Turnout Correlation',
  //       query: 'Create a scatter plot showing the relationship between swing potential and voter turnout across precincts',
  //       description: 'Reveals whether swing areas have high or low participation',
  //       expectedVisual: 'scatter',
  //       xMetric: 'swing_potential',
  //       yMetric: 'turnout',
  //     },
  //     {
  //       id: 'voter-population-proportional',
  //       label: 'Voter Density Map',
  //       query: 'Show proportional symbols where size is registered voters and color is partisan lean',
  //       description: 'Sized bubbles reveal where voter concentrations are and which way they lean',
  //       expectedVisual: 'proportional',
  //       sizeMetric: 'registered_voters',
  //       colorMetric: 'partisan_lean',
  //     },
  //   ],
  // },
  // {
  //   id: 'correlations',
  //   name: 'Correlate',
  //   icon: <ScatterChart className="h-4 w-4" />,
  //   description: 'Explore relationships between variables',
  //   queries: [
  //     {
  //       id: 'income-education-bivariate',
  //       label: 'Income × Education',
  //       query: 'Show a bivariate map of median income versus college education levels',
  //       description: 'Reveals socioeconomic patterns: wealthy+educated, working class, etc.',
  //       expectedVisual: 'bivariate',
  //       xMetric: 'median_income',
  //       yMetric: 'college_pct',
  //     },
  //     {
  //       id: 'partisan-confidence',
  //       label: 'Partisan Lean by Confidence',
  //       query: 'Show partisan lean with transparency based on sample size so I can see where estimates are reliable',
  //       description: 'Value-by-alpha: saturated colors where data is solid, faded where uncertain',
  //       expectedVisual: 'valueByAlpha',
  //       metric: 'partisan_lean',
  //     },
  //     {
  //       id: 'donor-concentration',
  //       label: 'Donor Concentration Analysis',
  //       query: 'Show donor concentration with bubble size for total donations and color for average donation size',
  //       description: 'Identifies both volume and engagement level of donors',
  //       expectedVisual: 'proportional',
  //       sizeMetric: 'donor_total',
  //       colorMetric: 'avg_donation',
  //     },
  //   ],
  // },
];

// ============================================================================
// Component
// ============================================================================

export function QuickStartIQDialog({
  onQuerySelect,
  disabled = false,
  hasSelection = false,
}: QuickStartIQDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('targeting');

  const handleQuerySelect = (query: PredefinedQuery, category: QueryCategory) => {
    onQuerySelect(query.query, {
      category: category.id,
      visualType: query.expectedVisual,
      metric: query.metric,
      queryId: query.id,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          disabled={disabled || !hasSelection}
          className={`
            flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl
            font-bold text-sm transition-all duration-200
            ${hasSelection
              ? 'bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-[#33a852] text-gray-900 shadow-md hover:shadow-lg cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            }
          `}
          title={hasSelection ? 'Open QuickStart queries' : 'Select an area first'}
        >
          {/* Map pin icon matching IQBuilder branding */}
          <img src="/mpiq_pin2.png" alt="" className="h-4 w-4" />
          <span>quickstart<span className="text-[#33a852] font-black">IQ</span></span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {/* Map pin icon matching IQBuilder branding */}
            <img src="/mpiq_pin2.png" alt="" className="h-6 w-6" />
            <span>quickstart<span className="text-[#33a852] font-black">IQ</span></span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Select a predefined query to analyze your selected area. Each query provides different insights and map visualizations.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeCategory}
          onValueChange={setActiveCategory}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto p-1 bg-gray-100/80 gap-0.5">
            {QUERY_CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="flex flex-col items-center gap-0.5 py-1.5 px-1 text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <span className="text-amber-600">{cat.icon}</span>
                <span className="font-medium truncate w-full text-center">{cat.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {QUERY_CATEGORIES.map((category) => (
              <TabsContent
                key={category.id}
                value={category.id}
                className="mt-0 space-y-3"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-amber-600">{category.icon}</span>
                  <span className="font-semibold text-gray-900">{category.name}</span>
                  <span className="text-xs text-gray-500">- {category.description}</span>
                </div>

                <div className="space-y-2">
                  {category.queries.map((query) => (
                    <button
                      key={query.id}
                      onClick={() => handleQuerySelect(query, category)}
                      className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 group-hover:text-amber-700">
                              {query.label}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 bg-gray-50 text-gray-500"
                            >
                              {query.expectedVisual}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{query.description}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Sparkles className="h-3 w-3" />
                            <span className="italic">&quot;{query.query}&quot;</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-amber-500 mt-1 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>
            ))}
          </div>
        </Tabs>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Tip: You can also type your own questions in the AI chat
          </p>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QuickStartIQDialog;
