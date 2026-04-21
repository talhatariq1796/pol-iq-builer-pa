'use client';

import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { ElectionHistoryFilters as ElectionHistoryFiltersType } from '@/lib/segmentation/types';
import { useDebouncedCallback } from '@/lib/hooks/useDebounce';

interface ElectionHistoryFiltersProps {
  filters: ElectionHistoryFiltersType;
  onChange: (filters: ElectionHistoryFiltersType) => void;
}

export function ElectionHistoryFilters({ filters, onChange }: ElectionHistoryFiltersProps) {
  // Local state for immediate UI feedback
  const [localMinDemVoteShare, setLocalMinDemVoteShare] = useState(filters.minDemVoteShare ?? 0);
  const [localMaxDemVoteShare, setLocalMaxDemVoteShare] = useState(filters.maxDemVoteShare ?? 100);
  const [localMinRepVoteShare, setLocalMinRepVoteShare] = useState(filters.minRepVoteShare ?? 0);
  const [localMaxRepVoteShare, setLocalMaxRepVoteShare] = useState(filters.maxRepVoteShare ?? 100);
  const [localMarginRange, setLocalMarginRange] = useState<[number, number]>(filters.marginRange ?? [-50, 50]);
  const [localMinTurnout, setLocalMinTurnout] = useState(filters.minTurnout ?? 0);
  const [localMaxTurnout, setLocalMaxTurnout] = useState(filters.maxTurnout ?? 100);
  const [localTurnoutDropoffMin, setLocalTurnoutDropoffMin] = useState(filters.turnoutDropoff?.min ?? 0);
  const [localTurnoutDropoffMax, setLocalTurnoutDropoffMax] = useState(filters.turnoutDropoff?.max ?? 50);
  const [localMinMarginShift, setLocalMinMarginShift] = useState(filters.trend?.minMarginShift ?? -20);
  const [localMaxMarginShift, setLocalMaxMarginShift] = useState(filters.trend?.maxMarginShift);

  const updateFilter = <K extends keyof ElectionHistoryFiltersType>(
    key: K,
    value: ElectionHistoryFiltersType[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  // Debounced updates for all sliders
  const debouncedUpdateMinDemVoteShare = useDebouncedCallback((value: number) => {
    updateFilter('minDemVoteShare', value);
  }, 300);

  const debouncedUpdateMaxDemVoteShare = useDebouncedCallback((value: number) => {
    updateFilter('maxDemVoteShare', value);
  }, 300);

  const debouncedUpdateMinRepVoteShare = useDebouncedCallback((value: number) => {
    updateFilter('minRepVoteShare', value);
  }, 300);

  const debouncedUpdateMaxRepVoteShare = useDebouncedCallback((value: number) => {
    updateFilter('maxRepVoteShare', value);
  }, 300);

  const debouncedUpdateMarginRange = useDebouncedCallback((value: [number, number]) => {
    updateFilter('marginRange', value);
  }, 300);

  const debouncedUpdateMinTurnout = useDebouncedCallback((value: number) => {
    updateFilter('minTurnout', value);
  }, 300);

  const debouncedUpdateMaxTurnout = useDebouncedCallback((value: number) => {
    updateFilter('maxTurnout', value);
  }, 300);

  const debouncedUpdateTurnoutDropoffMin = useDebouncedCallback((value: number) => {
    updateFilter('turnoutDropoff', { ...filters.turnoutDropoff, min: value });
  }, 300);

  const debouncedUpdateTurnoutDropoffMax = useDebouncedCallback((value: number) => {
    updateFilter('turnoutDropoff', { ...filters.turnoutDropoff, max: value });
  }, 300);

  const debouncedUpdateMinMarginShift = useDebouncedCallback((value: number) => {
    updateFilter('trend', { ...filters.trend!, minMarginShift: value });
  }, 300);

  const debouncedUpdateMaxMarginShift = useDebouncedCallback((value: number) => {
    updateFilter('trend', { ...filters.trend!, maxMarginShift: value });
  }, 300);

  // Quick filter presets
  const applyQuickFilter = (preset: string) => {
    switch (preset) {
      case 'high_dem':
        onChange({
          ...filters,
          minDemVoteShare: 55,
          maxDemVoteShare: 100,
        });
        break;
      case 'competitive':
        onChange({
          ...filters,
          marginRange: [-10, 10],
        });
        break;
      case 'low_turnout':
        onChange({
          ...filters,
          minTurnout: 0,
          maxTurnout: 60,
        });
        break;
      case 'trending_dem':
        onChange({
          ...filters,
          trend: {
            startYear: 2020,
            endYear: 2024,
            minMarginShift: 5,
          },
        });
        break;
    }
  };

  // Format percentage for display
  const formatPct = (value: number) => `${value}%`;

  // Format margin for display
  const formatMargin = (value: number) => {
    if (value === 0) return 'Even';
    const direction = value > 0 ? 'D' : 'R';
    const magnitude = Math.abs(value);
    if (magnitude >= 20) return `Strong ${direction}`;
    if (magnitude >= 10) return `Likely ${direction}`;
    if (magnitude >= 5) return `Lean ${direction}`;
    return 'Toss-up';
  };

  return (
    <div className="space-y-6">
      {/* Quick Filters */}
      <div className="space-y-3">
        <Label>Quick Filters</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter('high_dem')}
          >
            High D Support (55%+)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter('competitive')}
          >
            Competitive (&lt;10pt)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter('low_turnout')}
          >
            Low Turnout (&lt;60%)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter('trending_dem')}
          >
            Trending D (+5pt)
          </Button>
        </div>
      </div>

      {/* Democratic Vote Share */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Democratic Vote Share</Label>
          <span className="text-sm text-muted-foreground">
            {formatPct(filters.minDemVoteShare ?? 0)} - {formatPct(filters.maxDemVoteShare ?? 100)}
          </span>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Minimum</div>
          <Slider
            value={[filters.minDemVoteShare ?? 0]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value: number[]) => updateFilter('minDemVoteShare', value[0])}
          />
          <div className="text-xs text-muted-foreground mt-3">Maximum</div>
          <Slider
            value={[filters.maxDemVoteShare ?? 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value: number[]) => updateFilter('maxDemVoteShare', value[0])}
          />
        </div>
      </div>

      {/* Republican Vote Share */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Republican Vote Share</Label>
          <span className="text-sm text-muted-foreground">
            {formatPct(filters.minRepVoteShare ?? 0)} - {formatPct(filters.maxRepVoteShare ?? 100)}
          </span>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Minimum</div>
          <Slider
            value={[filters.minRepVoteShare ?? 0]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value: number[]) => updateFilter('minRepVoteShare', value[0])}
          />
          <div className="text-xs text-muted-foreground mt-3">Maximum</div>
          <Slider
            value={[filters.maxRepVoteShare ?? 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value: number[]) => updateFilter('maxRepVoteShare', value[0])}
          />
        </div>
      </div>

      {/* Margin Filter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Margin of Victory</Label>
          <span className="text-sm text-muted-foreground">
            {formatMargin(filters.marginRange?.[0] ?? -50)} to {formatMargin(filters.marginRange?.[1] ?? 50)}
          </span>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Negative = R wins, Positive = D wins
          </div>
          <Slider
            value={filters.marginRange ?? [-50, 50]}
            min={-50}
            max={50}
            step={1}
            onValueChange={(value: number[]) => updateFilter('marginRange', value as [number, number])}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Strong R</span>
            <span>Toss-up</span>
            <span>Strong D</span>
          </div>
        </div>
      </div>

      {/* Turnout Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Turnout Range</Label>
          <span className="text-sm text-muted-foreground">
            {formatPct(filters.minTurnout ?? 0)} - {formatPct(filters.maxTurnout ?? 100)}
          </span>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Minimum</div>
          <Slider
            value={[filters.minTurnout ?? 0]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value: number[]) => updateFilter('minTurnout', value[0])}
          />
          <div className="text-xs text-muted-foreground mt-3">Maximum</div>
          <Slider
            value={[filters.maxTurnout ?? 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value: number[]) => updateFilter('maxTurnout', value[0])}
          />
        </div>
      </div>

      {/* Turnout Dropoff */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Turnout Dropoff (Presidential to Midterm)</Label>
          {filters.turnoutDropoff && (
            <span className="text-sm text-muted-foreground">
              {formatPct(filters.turnoutDropoff.min ?? 0)} - {formatPct(filters.turnoutDropoff.max ?? 50)}
            </span>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Minimum Dropoff</div>
          <Slider
            value={[filters.turnoutDropoff?.min ?? 0]}
            min={0}
            max={50}
            step={1}
            onValueChange={(value: number[]) =>
              updateFilter('turnoutDropoff', {
                ...filters.turnoutDropoff,
                min: value[0],
              })
            }
          />
          <div className="text-xs text-muted-foreground mt-3">Maximum Dropoff</div>
          <Slider
            value={[filters.turnoutDropoff?.max ?? 50]}
            min={0}
            max={50}
            step={1}
            onValueChange={(value: number[]) =>
              updateFilter('turnoutDropoff', {
                ...filters.turnoutDropoff,
                max: value[0],
              })
            }
          />
        </div>
      </div>

      {/* Trend Analysis */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Trend Analysis</Label>
          <Switch
            checked={filters.trend !== undefined}
            onCheckedChange={(checked: boolean) => {
              if (checked) {
                updateFilter('trend', {
                  startYear: 2020,
                  endYear: 2024,
                });
              } else {
                updateFilter('trend', undefined);
              }
            }}
          />
        </div>

        {filters.trend && (
          <div className="space-y-4 pl-4 border-l-2 border-muted">
            {/* Year Selection */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Start Year</div>
              <Tabs
                value={filters.trend.startYear.toString()}
                onValueChange={(value: string) =>
                  updateFilter('trend', {
                    ...filters.trend!,
                    startYear: parseInt(value) as 2020 | 2022,
                  })
                }
              >
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="2020">2020</TabsTrigger>
                  <TabsTrigger value="2022">2022</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">End Year</div>
              <Tabs
                value={filters.trend.endYear.toString()}
                onValueChange={(value: string) =>
                  updateFilter('trend', {
                    ...filters.trend!,
                    endYear: parseInt(value) as 2022 | 2024,
                  })
                }
              >
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="2022">2022</TabsTrigger>
                  <TabsTrigger value="2024">2024</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Margin Shift */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Margin Shift Toward Democrats</div>
                <span className="text-sm text-muted-foreground">
                  {filters.trend.minMarginShift !== undefined
                    ? `+${filters.trend.minMarginShift}pt`
                    : 'Any'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                Minimum shift (positive = toward D, negative = toward R)
              </div>
              <Slider
                value={[filters.trend.minMarginShift ?? -20]}
                min={-20}
                max={20}
                step={1}
                onValueChange={(value: number[]) =>
                  updateFilter('trend', {
                    ...filters.trend!,
                    minMarginShift: value[0],
                  })
                }
              />
            </div>

            {filters.trend.maxMarginShift !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Maximum Shift</div>
                  <span className="text-sm text-muted-foreground">
                    {filters.trend.maxMarginShift > 0 ? '+' : ''}
                    {filters.trend.maxMarginShift}pt
                  </span>
                </div>
                <Slider
                  value={[filters.trend.maxMarginShift]}
                  min={-20}
                  max={20}
                  step={1}
                  onValueChange={(value: number[]) =>
                    updateFilter('trend', {
                      ...filters.trend!,
                      maxMarginShift: value[0],
                    })
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear All Filters */}
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => onChange({})}
      >
        Clear All Election History Filters
      </Button>
    </div>
  );
}
