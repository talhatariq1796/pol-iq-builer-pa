'use client';

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { PoliticalFilters as PoliticalFiltersType } from '@/lib/segmentation/types';
import { useDebouncedCallback } from '@/lib/hooks/useDebounce';

interface PoliticalFiltersProps {
  filters: PoliticalFiltersType;
  onChange: (filters: PoliticalFiltersType) => void;
}

export function PoliticalFilters({ filters, onChange }: PoliticalFiltersProps) {
  // Local state for immediate UI feedback
  const [localPartisanLeanRange, setLocalPartisanLeanRange] = useState<[number, number]>(
    filters.partisanLeanRange || [-50, 50]
  );

  const updateFilter = <K extends keyof PoliticalFiltersType>(
    key: K,
    value: PoliticalFiltersType[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  // Debounced update for partisan lean slider
  const debouncedUpdatePartisanLean = useDebouncedCallback((value: [number, number]) => {
    updateFilter('partisanLeanRange', value);
  }, 300);

  const togglePartyLean = (lean: 'strong_dem' | 'lean_dem' | 'independent' | 'lean_rep' | 'strong_rep') => {
    const current = filters.partyLean || [];
    const updated = current.includes(lean)
      ? current.filter((l) => l !== lean)
      : [...current, lean];
    updateFilter('partyLean', updated.length > 0 ? updated : undefined);
  };

  const toggleCompetitiveness = (
    comp: 'safe_d' | 'likely_d' | 'lean_d' | 'toss_up' | 'lean_r' | 'likely_r' | 'safe_r'
  ) => {
    const current = filters.competitiveness || [];
    const updated = current.includes(comp)
      ? current.filter((c) => c !== comp)
      : [...current, comp];
    updateFilter('competitiveness', updated.length > 0 ? updated : undefined);
  };

  const formatPartisanLean = (value: number) => {
    if (value === 0) return '0 (Even)';
    const absValue = Math.abs(value);
    const party = value < 0 ? 'D' : 'R';
    return `${party}+${absValue}`;
  };

  return (
    <div className="space-y-6">
      {/* Party Lean */}
      <div className="space-y-3">
        <Label>Party Lean</Label>
        <div className="space-y-2">
          {[
            { value: 'strong_dem', label: 'Strong Democrat' },
            { value: 'lean_dem', label: 'Lean Democrat' },
            { value: 'independent', label: 'Independent' },
            { value: 'lean_rep', label: 'Lean Republican' },
            { value: 'strong_rep', label: 'Strong Republican' },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <Checkbox
                id={`party-${value}`}
                checked={filters.partyLean?.includes(value as any) ?? false}
                onCheckedChange={() => togglePartyLean(value as any)}
              />
              <label
                htmlFor={`party-${value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Partisan Lean Range */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Partisan Lean Score</Label>
          <span className="text-sm text-muted-foreground">
            {formatPartisanLean(localPartisanLeanRange[0])} to{' '}
            {formatPartisanLean(localPartisanLeanRange[1])}
          </span>
        </div>
        <div className="px-2">
          <Slider
            min={-50}
            max={50}
            step={5}
            value={localPartisanLeanRange}
            onValueChange={(value: number[]) => {
              const newRange = value as [number, number];
              setLocalPartisanLeanRange(newRange);
              debouncedUpdatePartisanLean(newRange);
            }}
            className="w-full"
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>D+50</span>
          <span>Even</span>
          <span>R+50</span>
        </div>
      </div>

      {/* Competitiveness */}
      <div className="space-y-3">
        <Label>Competitiveness</Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'safe_d', label: 'Safe D' },
            { value: 'likely_d', label: 'Likely D' },
            { value: 'lean_d', label: 'Lean D' },
            { value: 'toss_up', label: 'Toss-up' },
            { value: 'lean_r', label: 'Lean R' },
            { value: 'likely_r', label: 'Likely R' },
            { value: 'safe_r', label: 'Safe R' },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <Checkbox
                id={`comp-${value}`}
                checked={filters.competitiveness?.includes(value as any) ?? false}
                onCheckedChange={() => toggleCompetitiveness(value as any)}
              />
              <label
                htmlFor={`comp-${value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Political Outlook */}
      <div className="space-y-3">
        <Label>Political Outlook</Label>
        <RadioGroup
          value={filters.politicalOutlook || 'any'}
          onValueChange={(value: string) =>
            updateFilter('politicalOutlook', value === 'any' ? undefined : (value as PoliticalFiltersType['politicalOutlook']))
          }
        >
          {[
            { value: 'any', label: 'Any' },
            { value: 'liberal', label: 'Liberal' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'conservative', label: 'Conservative' },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <RadioGroupItem value={value} id={`outlook-${value}`} />
              <label
                htmlFor={`outlook-${value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {label}
              </label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
