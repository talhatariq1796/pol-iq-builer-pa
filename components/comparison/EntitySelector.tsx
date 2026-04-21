'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronsUpDown, MapPin, Building2, Search, Loader2 } from 'lucide-react';
import type { EntityType, BoundaryType } from '@/lib/comparison/types';

interface EntityOption {
  id: string;
  name: string;
  jurisdiction?: string;
  partisanLean: number;
  population: number;
  type?: string;
  precinctCount?: number;
}

interface EntitySelectorProps {
  value: string | null;
  onChange: (entityId: string) => void;
  entityType: EntityType;
  boundaryType: BoundaryType;
  placeholder?: string;
}

/** Server-capped list page size for precinct + municipality pickers (PA). */
const LIST_PAGE_LIMIT = 80;

export function EntitySelector({
  value,
  onChange,
  entityType,
  boundaryType,
  placeholder = 'Select an entity...',
}: EntitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [filteredEntities, setFilteredEntities] = useState<EntityOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);
  const [listMeta, setListMeta] = useState<{ truncated: boolean; total: number } | null>(null);

  /** Precinct, municipalities, and legislative districts: server search + cap (PA-scale lists). */
  const largeListMode = useMemo((): 'precincts' | 'municipalities' | 'districts' | null => {
    if (boundaryType === 'precincts' && entityType === 'precinct') return 'precincts';
    if (boundaryType === 'municipalities' && entityType === 'jurisdiction') return 'municipalities';
    if (
      (boundaryType === 'state_house' ||
        boundaryType === 'state_senate' ||
        boundaryType === 'congressional' ||
        boundaryType === 'school_districts' ||
        boundaryType === 'county' ||
        boundaryType === 'zip_codes') &&
      entityType === 'jurisdiction'
    ) {
      return 'districts';
    }
    return null;
  }, [boundaryType, entityType]);

  const skipDebounceNextFetch = useRef(false);

  // When popover opens, next fetch runs immediately (no 280ms wait)
  useEffect(() => {
    if (open && largeListMode) {
      skipDebounceNextFetch.current = true;
    }
  }, [open, largeListMode]);

  // Small lists: load full dataset once (jurisdictions for legacy flows, etc.)
  useEffect(() => {
    if (largeListMode) return;

    const loadEntities = async () => {
      setIsLoading(true);
      try {
        let listType: string;
        if (boundaryType === 'precincts') {
          listType = 'precincts';
        } else if (boundaryType === 'municipalities') {
          listType = 'municipalities';
        } else {
          listType = 'jurisdictions';
        }

        const response = await fetch(`/api/comparison?list=${listType}&boundaryType=${boundaryType}`);

        if (!response.ok) throw new Error(`Failed to load ${listType}`);
        const data = await response.json();

        if (entityType === 'precinct') {
          const precinctList: EntityOption[] = (data.precincts || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            jurisdiction: p.jurisdiction,
            partisanLean: p.partisanLean,
            population: p.population,
          }));
          setEntities(precinctList);
          setFilteredEntities(precinctList);

          if (value) {
            const found = precinctList.find((e) => e.id === value);
            if (found) setSelectedEntity(found);
          }
        } else {
          let jurisdictionList: EntityOption[] = [];

          if (data.jurisdictions) {
            jurisdictionList = data.jurisdictions.map((j: any) => ({
              id: j.id,
              name: j.name,
              type: j.type,
              precinctCount: j.precinctCount,
              partisanLean: 0,
              population: 0,
            }));
          } else if (data.municipalities) {
            jurisdictionList = data.municipalities.map((m: any) => ({
              id: m.id,
              name: m.name,
              type: m.type,
              precinctCount: m.precinctCount ?? 0,
              partisanLean: m.partisanLean,
              population: m.population,
            }));
          } else if (data.districts) {
            jurisdictionList = data.districts.map((d: any) => ({
              id: d.id,
              name: d.name,
              type: 'state_house',
              precinctCount: d.precinctCount || 0,
              partisanLean: d.partisanLean,
              population: d.population,
            }));
          }

          setEntities(jurisdictionList);
          setFilteredEntities(jurisdictionList);

          if (value) {
            const found = jurisdictionList.find((e) => e.id === value);
            if (found) setSelectedEntity(found);
          }
        }
      } catch (error) {
        console.error('Error loading entities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntities();
  }, [entityType, boundaryType, value, largeListMode]);

  // Large lists: resolve label for controlled value without loading full dataset
  useEffect(() => {
    if (!largeListMode) return;

    if (!value) {
      setSelectedEntity(null);
      return;
    }

    const ac = new AbortController();
    (async () => {
      try {
        const listParam =
          largeListMode === 'precincts'
            ? 'precincts'
            : largeListMode === 'municipalities'
              ? 'municipalities'
              : boundaryType;
        const r = await fetch(
          `/api/comparison?list=${listParam}&boundaryType=${encodeURIComponent(boundaryType)}&id=${encodeURIComponent(value)}`,
          { signal: ac.signal }
        );
        if (!r.ok) return;
        const data = await r.json();
        if (largeListMode === 'precincts') {
          const p = data.precincts?.[0];
          if (p) {
            setSelectedEntity({
              id: p.id,
              name: p.name,
              jurisdiction: p.jurisdiction,
              partisanLean: p.partisanLean,
              population: p.population,
            });
          }
        } else if (largeListMode === 'municipalities') {
          const m = data.municipalities?.[0];
          if (m) {
            setSelectedEntity({
              id: m.id,
              name: m.name,
              type: m.type,
              precinctCount: m.precinctCount ?? 0,
              partisanLean: m.partisanLean,
              population: m.population,
            });
          }
        } else {
          const d = data.districts?.[0];
          if (d) {
            setSelectedEntity({
              id: d.id,
              name: d.name,
              type: boundaryType,
              precinctCount: d.precinctCount ?? 0,
              partisanLean: d.partisanLean,
              population: d.population,
            });
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') console.error(e);
      }
    })();

    return () => ac.abort();
  }, [value, boundaryType, largeListMode]);

  // Large precinct / municipality: server-side search + capped list (only while popover open)
  useEffect(() => {
    if (!largeListMode || !open) return;

    const ac = new AbortController();
    const delay = skipDebounceNextFetch.current ? 0 : 280;
    skipDebounceNextFetch.current = false;

    const t = window.setTimeout(() => {
      (async () => {
        setIsLoading(true);
        try {
          const listParam =
            largeListMode === 'precincts'
              ? 'precincts'
              : largeListMode === 'municipalities'
                ? 'municipalities'
                : boundaryType;
          const params = new URLSearchParams({
            list: listParam,
            boundaryType,
            limit: String(LIST_PAGE_LIMIT),
          });
          const q = searchQuery.trim();
          if (q) params.set('q', q);

          const r = await fetch(`/api/comparison?${params.toString()}`, { signal: ac.signal });
          if (!r.ok) throw new Error(`Failed to load ${listParam}`);
          const data = await r.json();

          let list: EntityOption[];
          if (largeListMode === 'precincts') {
            list = (data.precincts || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              jurisdiction: p.jurisdiction,
              partisanLean: p.partisanLean,
              population: p.population,
            }));
          } else if (largeListMode === 'municipalities') {
            list = (data.municipalities || []).map((m: any) => ({
              id: m.id,
              name: m.name,
              type: m.type,
              precinctCount: m.precinctCount ?? 0,
              partisanLean: m.partisanLean,
              population: m.population,
            }));
          } else {
            list = (data.districts || []).map((d: any) => ({
              id: d.id,
              name: d.name,
              type: boundaryType,
              precinctCount: d.precinctCount ?? 0,
              partisanLean: d.partisanLean,
              population: d.population,
            }));
          }
          setEntities(list);
          setFilteredEntities(list);
          setListMeta({
            truncated: Boolean(data.truncated),
            total: typeof data.total === 'number' ? data.total : list.length,
          });
        } catch (e) {
          if ((e as Error).name !== 'AbortError') console.error(e);
        } finally {
          setIsLoading(false);
        }
      })();
    }, delay);

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [open, searchQuery, boundaryType, largeListMode]);

  // Client filter only for small lists
  useEffect(() => {
    if (largeListMode) return;

    if (!searchQuery.trim()) {
      setFilteredEntities(entities);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = entities.filter(
      (entity) =>
        entity.name.toLowerCase().includes(query) ||
        entity.jurisdiction?.toLowerCase().includes(query)
    );
    setFilteredEntities(filtered);
  }, [searchQuery, entities, largeListMode]);

  const handleSelect = useCallback(
    (entity: EntityOption) => {
      setSelectedEntity(entity);
      onChange(entity.id);
      setOpen(false);
      setSearchQuery('');
    },
    [onChange]
  );

  const getLeanColor = (lean: number): string => {
    if (lean >= 10) return 'text-blue-600 dark:text-blue-400';
    if (lean <= -10) return 'text-red-600 dark:text-red-400';
    return 'text-purple-600 dark:text-purple-400';
  };

  const formatLean = (lean: number): string => {
    if (Math.abs(lean) < 1) return 'Even';
    const prefix = lean > 0 ? 'D+' : 'R+';
    return `${prefix}${Math.abs(lean).toFixed(0)}`;
  };

  const EntityIcon = entityType === 'precinct' ? MapPin : Building2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between h-11 ${!selectedEntity ? 'text-muted-foreground' : ''}`}
        >
          <div className="flex items-center gap-2 truncate">
            <EntityIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {selectedEntity ? selectedEntity.name : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder={
                largeListMode === 'precincts'
                  ? 'Search by name, ID, or municipality…'
                  : largeListMode === 'municipalities'
                    ? 'Search municipality name or ID…'
                    : largeListMode === 'districts'
                      ? 'Search district name or ID…'
                      : `Search ${entityType}s...`
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {largeListMode && listMeta && (
            <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b bg-muted/30">
              {(() => {
                const kind =
                  largeListMode === 'precincts'
                    ? 'precincts'
                    : largeListMode === 'municipalities'
                      ? 'municipalities'
                      : 'districts';
                return searchQuery.trim()
                  ? listMeta.truncated
                    ? `Showing ${Math.min(LIST_PAGE_LIMIT, filteredEntities.length)} of ${listMeta.total} matches — refine search`
                    : `${listMeta.total} match${listMeta.total === 1 ? '' : 'es'}`
                  : listMeta.truncated
                    ? `First ${LIST_PAGE_LIMIT} ${kind} (A–Z). Type to search all ${listMeta.total.toLocaleString()}.`
                    : `${listMeta.total.toLocaleString()} ${kind}`;
              })()}
            </div>
          )}

          <ScrollArea className="h-[280px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No {entityType}s found
              </div>
            ) : (
              <div className="p-1">
                {filteredEntities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => handleSelect(entity)}
                    className={`w-full flex items-center justify-between px-2 py-2 text-sm rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
                      value === entity.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <EntityIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="font-medium truncate">{entity.name}</div>
                        {entity.jurisdiction && (
                          <div className="text-xs text-muted-foreground truncate">
                            {entity.jurisdiction}
                          </div>
                        )}
                        {entity.type && entityType !== 'precinct' && (
                          <div className="text-xs text-muted-foreground capitalize">
                            {String(entity.type).replace(/_/g, ' ')}
                            {entity.precinctCount && entity.precinctCount > 0 && ` • ${entity.precinctCount} precincts`}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {entityType === 'precinct' ? (
                            <>
                              <Badge
                                variant="outline"
                                className={`text-xs ${getLeanColor(entity.partisanLean)}`}
                              >
                                {formatLean(entity.partisanLean)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {entity.population.toLocaleString()} pop
                              </span>
                            </>
                          ) : (
                            <>
                              {entity.partisanLean !== 0 && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getLeanColor(entity.partisanLean)}`}
                                >
                                  {formatLean(entity.partisanLean)}
                                </Badge>
                              )}
                              {entity.population > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {entity.population.toLocaleString()} pop
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {value === entity.id && (
                        <Check className="h-4 w-4 shrink-0 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
