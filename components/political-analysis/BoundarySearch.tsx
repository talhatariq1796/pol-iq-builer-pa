/**
 * BoundarySearch Component
 *
 * Type-to-find search for boundary features within a selected layer.
 * Shows matching boundaries with political score previews.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Loader2,
  MapPin,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BoundaryLayerType } from '@/types/political';
import { BOUNDARY_LAYERS } from './BoundaryLayerPicker';

export interface BoundaryFeature {
  id: string;
  name: string;
  displayName: string;
  geometry: GeoJSON.Geometry;
  properties: Record<string, unknown>;
  // Political scores (if available)
  partisanLean?: number;
  swingPotential?: number;
  targetingPriority?: 'High' | 'Medium-High' | 'Medium' | 'Low';
}

interface BoundarySearchProps {
  layerType: BoundaryLayerType;
  features: BoundaryFeature[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onFeatureHover?: (feature: BoundaryFeature | null) => void;
  onFeatureClick?: (feature: BoundaryFeature) => void;
  multiSelect?: boolean;
  isLoading?: boolean;
  maxResults?: number;
}

export function BoundarySearch({
  layerType,
  features,
  selectedIds,
  onSelectionChange,
  onFeatureHover,
  onFeatureClick,
  multiSelect = false,
  isLoading = false,
  maxResults = 50,
}: BoundarySearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const layerConfig = BOUNDARY_LAYERS[layerType];

  // Filter features based on search query
  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) {
      return features.slice(0, maxResults);
    }

    const query = searchQuery.toLowerCase();
    return features
      .filter((f) =>
        f.name.toLowerCase().includes(query) ||
        f.displayName.toLowerCase().includes(query) ||
        f.id.toLowerCase().includes(query)
      )
      .slice(0, maxResults);
  }, [features, searchQuery, maxResults]);

  // Handle feature selection
  const handleSelect = useCallback((feature: BoundaryFeature) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(feature.id);
      if (isSelected) {
        onSelectionChange(selectedIds.filter((id) => id !== feature.id));
      } else {
        onSelectionChange([...selectedIds, feature.id]);
      }
    } else {
      onSelectionChange([feature.id]);
    }
    onFeatureClick?.(feature);
  }, [multiSelect, selectedIds, onSelectionChange, onFeatureClick]);

  // Handle hover
  const handleHover = useCallback((feature: BoundaryFeature | null) => {
    setHoveredId(feature?.id || null);
    onFeatureHover?.(feature);
  }, [onFeatureHover]);

  // Get partisan lean color
  const getPartisanColor = (lean: number | undefined): string => {
    if (lean === undefined) return 'bg-gray-200';
    if (lean >= 20) return 'bg-blue-600 text-white';
    if (lean >= 10) return 'bg-blue-400 text-white';
    if (lean >= 5) return 'bg-blue-200';
    if (lean > -5) return 'bg-gray-200';
    if (lean > -10) return 'bg-red-200';
    if (lean > -20) return 'bg-red-400 text-white';
    return 'bg-red-600 text-white';
  };

  // Get priority badge variant
  const getPriorityVariant = (priority: string | undefined): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (priority) {
      case 'High': return 'destructive';
      case 'Medium-High': return 'default';
      case 'Medium': return 'secondary';
      default: return 'outline';
    }
  };

  // Format partisan lean display
  const formatLean = (lean: number | undefined): string => {
    if (lean === undefined) return '—';
    const prefix = lean > 0 ? 'D+' : lean < 0 ? 'R+' : '';
    return `${prefix}${Math.abs(lean).toFixed(1)}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${layerConfig.pluralName.toLowerCase()}...`}
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
        <span>
          {isLoading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </span>
          ) : (
            <>
              Showing {filteredFeatures.length} of {features.length}{' '}
              {layerConfig.pluralName.toLowerCase()}
            </>
          )}
        </span>
        {selectedIds.length > 0 && (
          <span className="font-medium text-primary">
            {selectedIds.length} selected
          </span>
        )}
      </div>

      {/* Feature list */}
      <ScrollArea className="flex-1 -mx-1">
        <div className="space-y-1 px-1">
          {filteredFeatures.map((feature) => {
            const isSelected = selectedIds.includes(feature.id);
            const isHovered = hoveredId === feature.id;

            return (
              <div
                key={feature.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                  isSelected && 'bg-primary/10 border border-primary/20',
                  isHovered && !isSelected && 'bg-muted',
                  !isSelected && !isHovered && 'hover:bg-muted/50'
                )}
                onClick={() => handleSelect(feature)}
                onMouseEnter={() => handleHover(feature)}
                onMouseLeave={() => handleHover(null)}
              >
                {/* Selection indicator */}
                {multiSelect ? (
                  <Checkbox
                    checked={isSelected}
                    className="pointer-events-none"
                  />
                ) : (
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                )}

                {/* Feature info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">
                    {feature.displayName}
                  </div>
                  {feature.name !== feature.displayName && (
                    <div className="text-xs text-muted-foreground truncate">
                      {feature.name}
                    </div>
                  )}
                </div>

                {/* Political scores */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Partisan lean badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs px-1.5 py-0 h-5',
                      getPartisanColor(feature.partisanLean)
                    )}
                  >
                    {formatLean(feature.partisanLean)}
                  </Badge>

                  {/* Priority badge */}
                  {/* {feature.targetingPriority && (
                    <Badge
                      variant={getPriorityVariant(feature.targetingPriority)}
                      className="text-xs px-1.5 py-0 h-5"
                    >
                      {feature.targetingPriority}
                    </Badge>
                  )} */}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {filteredFeatures.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs">
                {searchQuery
                  ? `No ${layerConfig.pluralName.toLowerCase()} match "${searchQuery}"`
                  : `No ${layerConfig.pluralName.toLowerCase()} available`}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Selection actions */}
      {multiSelect && selectedIds.length > 0 && (
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange([])}
          >
            Clear selection
          </Button>
          {/* Select all — disabled: selects thousands of features and is easy to mis-click
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange(features.map(f => f.id))}
          >
            Select all ({features.length})
          </Button>
          */}
        </div>
      )}
    </div>
  );
}

export default BoundarySearch;
