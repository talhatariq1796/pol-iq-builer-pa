'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { EngagementFilters as EngagementFiltersType, NewsPreferenceType } from '@/lib/segmentation/types';

interface EngagementFiltersProps {
  filters: EngagementFiltersType;
  onChange: (filters: EngagementFiltersType) => void;
}

export function EngagementFilters({ filters, onChange }: EngagementFiltersProps) {
  const updateFilter = <K extends keyof EngagementFiltersType>(
    key: K,
    value: EngagementFiltersType[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* News Preference */}
      <div className="space-y-3">
        <Label>News Preference</Label>
        <RadioGroup
          value={filters.newsPreference || 'any'}
          onValueChange={(value: string) =>
            updateFilter('newsPreference', value === 'any' ? undefined : (value as NewsPreferenceType))
          }
        >
          {[
            { value: 'any', label: 'Any' },
            { value: 'cnn_msnbc', label: 'CNN/MSNBC' },
            { value: 'fox_newsmax', label: 'Fox/Newsmax' },
            { value: 'npr', label: 'NPR' },
            { value: 'social_first', label: 'Social Media First' },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <RadioGroupItem value={value} id={`news-${value}`} />
              <label
                htmlFor={`news-${value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {label}
              </label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Donor Concentration */}
      <div className="space-y-3">
        <Label>Political Engagement</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="high-donor"
              checked={filters.highDonorConcentration ?? false}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                updateFilter('highDonorConcentration', checked === true ? true : undefined)
              }
            />
            <label
              htmlFor="high-donor"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              High Donor Concentration
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="high-activist"
              checked={filters.highActivistConcentration ?? false}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                updateFilter('highActivistConcentration', checked === true ? true : undefined)
              }
            />
            <label
              htmlFor="high-activist"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              High Activist Concentration
            </label>
          </div>
        </div>
      </div>

      {/* Social Media Usage */}
      <div className="space-y-3">
        <Label>Social Media Usage</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="high-social-media"
              checked={filters.highSocialMedia ?? false}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                updateFilter('highSocialMedia', checked === true ? true : undefined)
              }
            />
            <label
              htmlFor="high-social-media"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              High Social Media Usage
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="high-facebook"
              checked={filters.highFacebook ?? false}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                updateFilter('highFacebook', checked === true ? true : undefined)
              }
            />
            <label
              htmlFor="high-facebook"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              High Facebook Usage
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="high-youtube"
              checked={filters.highYouTube ?? false}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                updateFilter('highYouTube', checked === true ? true : undefined)
              }
            />
            <label
              htmlFor="high-youtube"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              High YouTube Usage
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
