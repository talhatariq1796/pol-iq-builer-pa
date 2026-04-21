'use client';

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import type { TargetingFilters as TargetingFiltersType } from '@/lib/segmentation/types';
import { useDebouncedCallback } from '@/lib/hooks/useDebounce';

interface TargetingFiltersProps {
  filters: TargetingFiltersType;
  onChange: (filters: TargetingFiltersType) => void;
}

export function TargetingFilters({ filters, onChange }: TargetingFiltersProps) {
  // Local state for immediate UI feedback
  const [localGotvPriorityRange, setLocalGotvPriorityRange] = useState<[number, number]>(
    filters.gotvPriorityRange || [0, 100]
  );
  const [localPersuasionRange, setLocalPersuasionRange] = useState<[number, number]>(
    filters.persuasionRange || [0, 100]
  );
  const [localSwingPotentialRange, setLocalSwingPotentialRange] = useState<[number, number]>(
    filters.swingPotentialRange || [0, 100]
  );
  const [localTurnoutRange, setLocalTurnoutRange] = useState<[number, number]>(
    filters.turnoutRange || [0, 100]
  );

  const updateFilter = <K extends keyof TargetingFiltersType>(
    key: K,
    value: TargetingFiltersType[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  // Debounced updates for sliders
  const debouncedUpdateGotvPriority = useDebouncedCallback((value: [number, number]) => {
    updateFilter('gotvPriorityRange', value);
  }, 300);

  const debouncedUpdatePersuasion = useDebouncedCallback((value: [number, number]) => {
    updateFilter('persuasionRange', value);
  }, 300);

  const debouncedUpdateSwingPotential = useDebouncedCallback((value: [number, number]) => {
    updateFilter('swingPotentialRange', value);
  }, 300);

  const debouncedUpdateTurnout = useDebouncedCallback((value: [number, number]) => {
    updateFilter('turnoutRange', value);
  }, 300);

  const toggleStrategy = (
    strategy: 'base_mobilization' | 'persuasion_target' | 'battleground' | 'low_priority'
  ) => {
    const current = filters.strategy || [];
    const updated = current.includes(strategy)
      ? current.filter((s) => s !== strategy)
      : [...current, strategy];
    updateFilter('strategy', updated.length > 0 ? updated : undefined);
  };

  return (
    <div className="space-y-6">
      {/* GOTV Priority */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>GOTV Priority</Label>
          <span className="text-sm text-muted-foreground">
            {localGotvPriorityRange[0]} - {localGotvPriorityRange[1]}
          </span>
        </div>
        <div className="px-2">
          <Slider
            min={0}
            max={100}
            step={5}
            value={localGotvPriorityRange}
            onValueChange={(value: number[]) => {
              const newRange = value as [number, number];
              setLocalGotvPriorityRange(newRange);
              debouncedUpdateGotvPriority(newRange);
            }}
            className="w-full"
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
        </div>
      </div>

      {/* Persuasion Opportunity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Persuasion Opportunity</Label>
          <span className="text-sm text-muted-foreground">
            {localPersuasionRange[0]} - {localPersuasionRange[1]}
          </span>
        </div>
        <div className="px-2">
          <Slider
            min={0}
            max={100}
            step={5}
            value={localPersuasionRange}
            onValueChange={(value: number[]) => {
              const newRange = value as [number, number];
              setLocalPersuasionRange(newRange);
              debouncedUpdatePersuasion(newRange);
            }}
            className="w-full"
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
        </div>
      </div>

      {/* Swing Potential */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Swing Potential</Label>
          <span className="text-sm text-muted-foreground">
            {localSwingPotentialRange[0]} - {localSwingPotentialRange[1]}
          </span>
        </div>
        <div className="px-2">
          <Slider
            min={0}
            max={100}
            step={5}
            value={localSwingPotentialRange}
            onValueChange={(value: number[]) => {
              const newRange = value as [number, number];
              setLocalSwingPotentialRange(newRange);
              debouncedUpdateSwingPotential(newRange);
            }}
            className="w-full"
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Stable</span>
          <span>Moderate</span>
          <span>Volatile</span>
        </div>
      </div>

      {/* Turnout Rate */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Turnout Rate (%)</Label>
          <span className="text-sm text-muted-foreground">
            {localTurnoutRange[0]}% - {localTurnoutRange[1]}%
          </span>
        </div>
        <div className="px-2">
          <Slider
            min={0}
            max={100}
            step={5}
            value={localTurnoutRange}
            onValueChange={(value: number[]) => {
              const newRange = value as [number, number];
              setLocalTurnoutRange(newRange);
              debouncedUpdateTurnout(newRange);
            }}
            className="w-full"
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Strategy Types */}
      <div className="space-y-3">
        <Label>Campaign Strategy</Label>
        <div className="space-y-2">
          {[
            { value: 'base_mobilization', label: 'Base Mobilization' },
            { value: 'persuasion_target', label: 'Persuasion Target' },
            { value: 'battleground', label: 'Battleground' },
            { value: 'low_priority', label: 'Low Priority' },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <Checkbox
                id={`strategy-${value}`}
                checked={filters.strategy?.includes(value as any) ?? false}
                onCheckedChange={() => toggleStrategy(value as any)}
              />
              <label
                htmlFor={`strategy-${value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
