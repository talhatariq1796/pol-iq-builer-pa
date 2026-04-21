'use client';

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DemographicFilters as DemographicFiltersType } from '@/lib/segmentation/types';
import { useDebouncedCallback } from '@/lib/hooks/useDebounce';

interface DemographicFiltersProps {
  filters: DemographicFiltersType;
  onChange: (filters: DemographicFiltersType) => void;
}

export function DemographicFilters({ filters, onChange }: DemographicFiltersProps) {
  // Local state for immediate UI feedback
  const [localAgeRange, setLocalAgeRange] = useState<[number, number]>(filters.ageRange || [18, 80]);
  const [localIncomeRange, setLocalIncomeRange] = useState<[number, number]>(
    filters.incomeRange || [20000, 150000]
  );
  const [localDiversityRange, setLocalDiversityRange] = useState<[number, number]>(
    filters.diversityRange || [0, 100]
  );

  const updateFilter = <K extends keyof DemographicFiltersType>(
    key: K,
    value: DemographicFiltersType[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  // Debounced updates for sliders
  const debouncedUpdateAgeRange = useDebouncedCallback((value: [number, number]) => {
    updateFilter('ageRange', value);
  }, 300);

  const debouncedUpdateIncomeRange = useDebouncedCallback((value: [number, number]) => {
    updateFilter('incomeRange', value);
  }, 300);

  const debouncedUpdateDiversityRange = useDebouncedCallback((value: [number, number]) => {
    updateFilter('diversityRange', value);
  }, 300);

  const toggleDensity = (density: 'urban' | 'suburban' | 'rural') => {
    const current = filters.density || [];
    const updated = current.includes(density)
      ? current.filter((d) => d !== density)
      : [...current, density];
    updateFilter('density', updated.length > 0 ? updated : undefined);
  };

  const toggleHousing = (housing: 'owners' | 'renters') => {
    const current = filters.housing || [];
    const updated = current.includes(housing)
      ? current.filter((h) => h !== housing)
      : [...current, housing];
    updateFilter('housing', updated.length > 0 ? updated : undefined);
  };

  return (
    <div className="space-y-6">
      {/* Age Range */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Age Range</Label>
          <span className="text-sm text-muted-foreground">
            {localAgeRange[0]} - {localAgeRange[1]} years
          </span>
        </div>
        <div className="px-2">
          <Slider
            min={18}
            max={80}
            step={1}
            value={localAgeRange}
            onValueChange={(value: number[]) => {
              const newRange = value as [number, number];
              setLocalAgeRange(newRange);
              debouncedUpdateAgeRange(newRange);
            }}
            className="w-full"
          />
        </div>
      </div>

      {/* Income Range */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Median Income</Label>
          <span className="text-sm text-muted-foreground">
            ${(localIncomeRange[0] / 1000).toFixed(0)}K - $
            {(localIncomeRange[1] / 1000).toFixed(0)}K
          </span>
        </div>
        <div className="px-2">
          <Slider
            min={20000}
            max={150000}
            step={5000}
            value={localIncomeRange}
            onValueChange={(value: number[]) => {
              const newRange = value as [number, number];
              setLocalIncomeRange(newRange);
              debouncedUpdateIncomeRange(newRange);
            }}
            className="w-full"
          />
        </div>
      </div>

      {/* Education Level */}
      <div className="space-y-3">
        <Label>Education Level</Label>
        <Select
          value={filters.educationLevel || 'any'}
          onValueChange={(value: string) =>
            updateFilter('educationLevel', value === 'any' ? undefined : (value as DemographicFiltersType['educationLevel']))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select education level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="high_school">High School</SelectItem>
            <SelectItem value="some_college">Some College</SelectItem>
            <SelectItem value="bachelors">Bachelors&apos;s+</SelectItem>
            <SelectItem value="graduate">Graduate+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Density */}
      <div className="space-y-3">
        <Label>Area Density</Label>
        <div className="space-y-2">
          {(['urban', 'suburban', 'rural'] as const).map((density) => (
            <div key={density} className="flex items-center space-x-2">
              <Checkbox
                id={`density-${density}`}
                checked={filters.density?.includes(density) ?? false}
                onCheckedChange={() => toggleDensity(density)}
              />
              <label
                htmlFor={`density-${density}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
              >
                {density}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Housing */}
      <div className="space-y-3">
        <Label>Housing Type</Label>
        <div className="space-y-2">
          {(['owners', 'renters'] as const).map((housing) => (
            <div key={housing} className="flex items-center space-x-2">
              <Checkbox
                id={`housing-${housing}`}
                checked={filters.housing?.includes(housing) ?? false}
                onCheckedChange={() => toggleHousing(housing)}
              />
              <label
                htmlFor={`housing-${housing}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
              >
                {housing}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Diversity Index */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Diversity Index</Label>
          <span className="text-sm text-muted-foreground">
            {localDiversityRange[0]} - {localDiversityRange[1]}
          </span>
        </div>
        <div className="px-2">
          <Slider
            min={0}
            max={100}
            step={5}
            value={localDiversityRange}
            onValueChange={(value: number[]) => {
              const newRange = value as [number, number];
              setLocalDiversityRange(newRange);
              debouncedUpdateDiversityRange(newRange);
            }}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
