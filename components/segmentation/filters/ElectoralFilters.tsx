'use client';

import React, { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ElectoralFilters as ElectoralFiltersType } from '@/lib/segmentation/types';
import { formatPoliticalDistrictLabel } from '@/lib/political/formatPoliticalDistrictLabel';

interface ElectoralFiltersProps {
  filters: ElectoralFiltersType;
  onChange: (filters: ElectoralFiltersType) => void;
}

const PA_CROSSWALK_URL = '/data/political/pensylvania/precincts/pa_precinct_district_crosswalk.json';

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

/** Crosswalk slugs like `columbia-beaver` → readable label */
function formatMunicipalitySlug(slug: string): string {
  const parts = slug.split('-');
  if (parts.length < 2) return slug;
  const county = parts[0];
  const place = parts.slice(1).join(' ');
  return `${titleCaseWords(place)} (${titleCaseWords(county)} Co.)`;
}

interface PaDistrictLists {
  stateHouse: string[];
  stateSenate: string[];
  congressional: string[];
  municipalities: string[];
}

export function ElectoralFilters({ filters, onChange }: ElectoralFiltersProps) {
  const [paLists, setPaLists] = useState<PaDistrictLists | null>(null);
  const [paLoadError, setPaLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(PA_CROSSWALK_URL);
        if (!res.ok) {
          if (!cancelled) {
            setPaLoadError(true);
            setPaLists({ stateHouse: [], stateSenate: [], congressional: [], municipalities: [] });
          }
          return;
        }
        const data = await res.json();
        const precincts = data.precincts as Record<string, Record<string, string | null>> | undefined;
        if (!precincts) {
          if (!cancelled) {
            setPaLoadError(true);
            setPaLists({ stateHouse: [], stateSenate: [], congressional: [], municipalities: [] });
          }
          return;
        }
        const sh = new Set<string>();
        const ss = new Set<string>();
        const cd = new Set<string>();
        const mun = new Set<string>();
        for (const a of Object.values(precincts)) {
          if (a.stateHouse) sh.add(String(a.stateHouse));
          if (a.stateSenate) ss.add(String(a.stateSenate));
          if (a.congressional) cd.add(String(a.congressional));
          if (a.municipality) mun.add(String(a.municipality));
        }
        if (!cancelled) {
          setPaLists({
            stateHouse: [...sh].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
            stateSenate: [...ss].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
            congressional: [...cd].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
            municipalities: [...mun].sort((a, b) => a.localeCompare(b)),
          });
          setPaLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setPaLoadError(true);
          setPaLists({ stateHouse: [], stateSenate: [], congressional: [], municipalities: [] });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateFilter = <K extends keyof ElectoralFiltersType>(
    key: K,
    value: ElectoralFiltersType[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleStateHouseDistrict = (districtId: string) => {
    const current = filters.stateHouseDistricts || [];
    const updated = current.includes(districtId)
      ? current.filter((d) => d !== districtId)
      : [...current, districtId];
    updateFilter('stateHouseDistricts', updated.length > 0 ? updated : undefined);
  };

  const toggleStateSenateDistrict = (districtId: string) => {
    const current = filters.stateSenateDistricts || [];
    const updated = current.includes(districtId)
      ? current.filter((d) => d !== districtId)
      : [...current, districtId];
    updateFilter('stateSenateDistricts', updated.length > 0 ? updated : undefined);
  };

  const toggleCongressionalDistrict = (districtId: string) => {
    const current = filters.congressionalDistricts || [];
    const updated = current.includes(districtId)
      ? current.filter((d) => d !== districtId)
      : [...current, districtId];
    updateFilter('congressionalDistricts', updated.length > 0 ? updated : undefined);
  };

  const toggleMunicipality = (municipalityId: string) => {
    const current = filters.municipalities || [];
    const updated = current.includes(municipalityId)
      ? current.filter((m) => m !== municipalityId)
      : [...current, municipalityId];
    updateFilter('municipalities', updated.length > 0 ? updated : undefined);
  };

  const toggleMunicipalityType = (type: 'city' | 'township') => {
    const current = filters.municipalityTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    updateFilter('municipalityTypes', updated.length > 0 ? updated : undefined);
  };

  return (
    <div className="space-y-6">
      {paLoadError && (
        <p className="text-sm text-muted-foreground">
          Could not load Pennsylvania district lists. Place{' '}
          <code className="text-xs">pa_precinct_district_crosswalk.json</code> under public data paths.
        </p>
      )}

      {/* State House Districts */}
      <div className="space-y-3">
        <Label>State House Districts</Label>
        {!paLists ? (
          <p className="text-sm text-muted-foreground">Loading districts…</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {paLists.stateHouse.map((id) => (
              <div key={id} className="flex items-start space-x-2">
                <Checkbox
                  id={`state-house-${id}`}
                  checked={filters.stateHouseDistricts?.includes(id) ?? false}
                  onCheckedChange={() => toggleStateHouseDistrict(id)}
                />
                <label
                  htmlFor={`state-house-${id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {formatPoliticalDistrictLabel(id)}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* State Senate Districts */}
      <div className="space-y-3">
        <Label>State Senate Districts</Label>
        {!paLists ? (
          <p className="text-sm text-muted-foreground">Loading districts…</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {paLists.stateSenate.map((id) => (
              <div key={id} className="flex items-center space-x-2">
                <Checkbox
                  id={`state-senate-${id}`}
                  checked={filters.stateSenateDistricts?.includes(id) ?? false}
                  onCheckedChange={() => toggleStateSenateDistrict(id)}
                />
                <label
                  htmlFor={`state-senate-${id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {formatPoliticalDistrictLabel(id)}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Congressional Districts */}
      <div className="space-y-3">
        <Label>Congressional Districts</Label>
        {!paLists ? (
          <p className="text-sm text-muted-foreground">Loading districts…</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {paLists.congressional.map((id) => (
              <div key={id} className="flex items-center space-x-2">
                <Checkbox
                  id={`congressional-${id}`}
                  checked={filters.congressionalDistricts?.includes(id) ?? false}
                  onCheckedChange={() => toggleCongressionalDistrict(id)}
                />
                <label
                  htmlFor={`congressional-${id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {formatPoliticalDistrictLabel(id)}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Municipalities */}
      <div className="space-y-3">
        <Label>Municipalities</Label>
        {!paLists ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {paLists.municipalities.map((id) => (
              <div key={id} className="flex items-center space-x-2">
                <Checkbox
                  id={`municipality-${id}`}
                  checked={filters.municipalities?.includes(id) ?? false}
                  onCheckedChange={() => toggleMunicipality(id)}
                />
                <label
                  htmlFor={`municipality-${id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {formatMunicipalitySlug(id)}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Municipality Type Filter */}
      <div className="space-y-3">
        <Label>Municipality Type</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="municipality-type-city"
              checked={filters.municipalityTypes?.includes('city') ?? false}
              onCheckedChange={() => toggleMunicipalityType('city')}
            />
            <label
              htmlFor="municipality-type-city"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Cities Only
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="municipality-type-township"
              checked={filters.municipalityTypes?.includes('township') ?? false}
              onCheckedChange={() => toggleMunicipalityType('township')}
            />
            <label
              htmlFor="municipality-type-township"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Townships Only
            </label>
          </div>
        </div>
      </div>

      {/* Split Precinct Handling */}
      <div className="space-y-3">
        <Label>Split Precincts</Label>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Include precincts that span multiple districts
          </span>
          <Switch
            checked={filters.includeSplitPrecincts ?? true}
            onCheckedChange={(checked: boolean) => updateFilter('includeSplitPrecincts', checked)}
          />
        </div>
      </div>

      {/* Split Weight Method (only if split precincts included) */}
      {filters.includeSplitPrecincts !== false && (
        <div className="space-y-3">
          <Label>Split Precinct Weighting</Label>
          <RadioGroup
            value={filters.splitPrecinctWeight || 'full'}
            onValueChange={(value: 'full' | 'proportional') =>
              updateFilter('splitPrecinctWeight', value)
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="full" id="weight-full" />
              <label
                htmlFor="weight-full"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Full Weight
              </label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Count split precincts fully if they overlap with selected districts
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="proportional" id="weight-proportional" />
              <label
                htmlFor="weight-proportional"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Proportional Weight
              </label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Weight split precincts by the proportion of area in selected districts
            </p>
          </RadioGroup>
        </div>
      )}
    </div>
  );
}
