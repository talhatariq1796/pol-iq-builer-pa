'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  BarChart3,
  Vote,
  Target,
  TrendingUp,
  MapPin,
  DollarSign,
  GraduationCap,
  Building2,
} from 'lucide-react';
import type { ComparisonEntity } from '@/lib/comparison/types';

interface ComparisonPaneProps {
  entity: ComparisonEntity;
  side: 'left' | 'right';
}

export function ComparisonPane({ entity, side }: ComparisonPaneProps) {
  // Get partisan lean color
  const getLeanColor = (lean: number): string => {
    if (lean >= 20) return 'bg-blue-600 text-white';
    if (lean >= 10) return 'bg-blue-400 text-white';
    if (lean >= 5) return 'bg-blue-200 text-blue-900';
    if (lean > -5) return 'bg-gray-200 text-gray-900';
    if (lean > -10) return 'bg-red-200 text-red-900';
    if (lean > -20) return 'bg-red-400 text-white';
    return 'bg-red-600 text-white';
  };

  // Format partisan lean
  const formatLean = (lean: number): string => {
    if (Math.abs(lean) < 1) return 'Even';
    const prefix = lean > 0 ? 'D+' : 'R+';
    return `${prefix}${Math.abs(lean).toFixed(0)}`;
  };

  // Get strategy badge variant
  const getStrategyVariant = (
    strategy: string
  ): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (strategy === 'Battleground') return 'destructive';
    if (strategy === 'Base Mobilization') return 'default';
    if (strategy === 'Persuasion Target') return 'secondary';
    return 'outline';
  };

  // Side-specific styling
  const borderColor = side === 'left' ? 'border-blue-500' : 'border-red-500';
  const EntityIcon = entity.type === 'jurisdiction' ? Building2 : MapPin;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className={`pb-3 border-b-4 ${borderColor}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base font-bold leading-tight">{entity.name}</CardTitle>
            {entity.parentJurisdiction && (
              <p className="text-xs text-muted-foreground mt-1">{entity.parentJurisdiction}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs capitalize">
                {entity.type}
              </Badge>
              <Badge className={getLeanColor(entity.politicalProfile.partisanLean)}>
                {formatLean(entity.politicalProfile.partisanLean)}
              </Badge>
            </div>
          </div>
          <EntityIcon className={`h-5 w-5 shrink-0 ${side === 'left' ? 'text-blue-600' : 'text-red-600'}`} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-[400px]">
          <Accordion type="multiple" defaultValue={['demographics', 'political', 'targeting']} className="w-full">
            {/* Demographics Section */}
            <AccordionItem value="demographics" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Demographics</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 pt-1">
                <div className="space-y-2 text-sm">
                  <MetricDisplay
                    icon={<Users className="h-3 w-3" />}
                    label="Population"
                    value={Math.round(entity.demographics.totalPopulation).toLocaleString()}
                  />
                  <MetricDisplay
                    icon={<Vote className="h-3 w-3" />}
                    label="Registered Voters"
                    value={Math.round(entity.demographics.registeredVoters).toLocaleString()}
                  />
                  <MetricDisplay
                    icon={<Users className="h-3 w-3" />}
                    label="Median Age"
                    value={`${entity.demographics.medianAge.toFixed(1)} years`}
                  />
                  <MetricDisplay
                    icon={<DollarSign className="h-3 w-3" />}
                    label="Median Income"
                    value={`$${entity.demographics.medianIncome.toLocaleString()}`}
                  />
                  <MetricDisplay
                    icon={<GraduationCap className="h-3 w-3" />}
                    label="College %"
                    value={`${entity.demographics.collegePct.toFixed(1)}%`}
                  />
                  <MetricDisplay
                    label="Homeowner %"
                    value={`${entity.demographics.homeownerPct.toFixed(1)}%`}
                  />
                  <MetricDisplay
                    label="Diversity Index"
                    value={entity.demographics.diversityIndex.toFixed(1)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Political Profile Section */}
            <AccordionItem value="political" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm font-medium">Political Profile</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 pt-1">
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Partisan Lean</span>
                      <span className="font-semibold">{formatLean(entity.politicalProfile.partisanLean)}</span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden shadow-sm">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-purple-400 to-blue-600" />
                      <div
                        className="absolute w-4 h-4 bg-white border-2 border-gray-800 rounded-full shadow-lg -top-0.5 transition-all"
                        style={{
                          left: `calc(${Math.min(Math.max((entity.politicalProfile.partisanLean + 50), 2), 98)}% - 8px)`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>R+50</span>
                      <span>Even</span>
                      <span>D+50</span>
                    </div>
                  </div>
                  <MetricDisplay
                    label="Swing Potential"
                    value={`${entity.politicalProfile.swingPotential.toFixed(0)}/100`}
                  />
                  <MetricDisplay
                    label="Competitiveness"
                    value={entity.politicalProfile.competitiveness.replace('_', ' ')}
                    badge
                  />
                  <MetricDisplay
                    label="Dominant Party"
                    value={entity.politicalProfile.dominantParty === 'D' ? 'Democratic' : entity.politicalProfile.dominantParty === 'R' ? 'Republican' : 'Swing'}
                  />
                  <MetricDisplay
                    label="Avg Turnout"
                    value={`${entity.politicalProfile.avgTurnoutRate.toFixed(1)}%`}
                  />
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-muted-foreground font-medium">Party Affiliation</span>
                    <div className="space-y-1 mt-1">
                      <MetricDisplay label="Democratic" value={`${entity.politicalProfile.demAffiliationPct.toFixed(1)}%`} />
                      <MetricDisplay label="Republican" value={`${entity.politicalProfile.repAffiliationPct.toFixed(1)}%`} />
                      <MetricDisplay label="Independent" value={`${entity.politicalProfile.independentPct.toFixed(1)}%`} />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Electoral Performance Section */}
            <AccordionItem value="electoral" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-2">
                  <Vote className="h-4 w-4" />
                  <span className="text-sm font-medium">Electoral Performance</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 pt-1">
                <div className="space-y-2 text-sm">
                  <MetricDisplay
                    label="Last Election"
                    value={entity.electoral.lastElectionYear.toString()}
                  />
                  <MetricDisplay
                    label="Dem Vote Share"
                    value={`${entity.electoral.demVoteShare.toFixed(1)}%`}
                  />
                  <MetricDisplay
                    label="Rep Vote Share"
                    value={`${entity.electoral.repVoteShare.toFixed(1)}%`}
                  />
                  <MetricDisplay
                    label="Margin"
                    value={`${entity.electoral.marginOfVictory > 0 ? '+' : ''}${entity.electoral.marginOfVictory.toFixed(1)} pts`}
                  />
                  <MetricDisplay
                    label="Total Votes"
                    value={Math.round(entity.electoral.totalVotesCast).toLocaleString()}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Targeting Scores Section */}
            <AccordionItem value="targeting" className="border-b">
              <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="text-sm font-medium">Targeting Scores</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 pt-1">
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">GOTV Priority</span>
                      <span className="font-semibold">{entity.targetingScores.gotvPriority.toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full"
                        style={{ width: `${entity.targetingScores.gotvPriority}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Persuasion Opportunity</span>
                      <span className="font-semibold">{entity.targetingScores.persuasionOpportunity.toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full"
                        style={{ width: `${entity.targetingScores.persuasionOpportunity}%` }}
                      />
                    </div>
                  </div>
                  <MetricDisplay
                    label="Combined Score"
                    value={entity.targetingScores.combinedScore.toFixed(0)}
                  />
                  <MetricDisplay
                    label="Strategy"
                    value={entity.targetingScores.recommendedStrategy}
                    badge
                    badgeVariant={getStrategyVariant(entity.targetingScores.recommendedStrategy)}
                  />
                  <MetricDisplay
                    label="Canvassing"
                    value={`${entity.targetingScores.canvassingEfficiency} doors/hr`}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Election History Section */}
            <AccordionItem value="history" className="border-b-0">
              <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Election History</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 pt-1">
                <div className="space-y-2">
                  {entity.electionHistory.map((election, idx) => (
                    <div
                      key={`${election.year}-${idx}`}
                      className="bg-muted/30 rounded-lg p-2 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{election.year}</span>
                        <Badge
                          variant="outline"
                          className={election.margin > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}
                        >
                          {election.margin > 0 ? 'D' : 'R'} +{Math.abs(election.margin).toFixed(1)}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>D: {election.demPct.toFixed(1)}%</span>
                        <span>R: {election.repPct.toFixed(1)}%</span>
                        <span>TO: {election.turnout.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                  {entity.electionHistory.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No historical data available
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Helper component for displaying individual metrics
interface MetricDisplayProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  badge?: boolean;
  badgeVariant?: 'default' | 'destructive' | 'secondary' | 'outline';
}

function MetricDisplay({ icon, label, value, badge, badgeVariant = 'secondary' }: MetricDisplayProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </span>
      {badge ? (
        <Badge variant={badgeVariant} className="text-xs capitalize">
          {value}
        </Badge>
      ) : (
        <span className="font-medium">{value}</span>
      )}
    </div>
  );
}
