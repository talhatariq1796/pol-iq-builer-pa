'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Upload } from 'lucide-react';
import type { SegmentDefinition } from '@/lib/segmentation/types';

interface SavedSegmentsListProps {
  segments: SegmentDefinition[];
  onLoad: (segment: SegmentDefinition) => void;
  onDelete: (segmentId: string) => void;
}

export function SavedSegmentsList({ segments, onLoad, onDelete }: SavedSegmentsListProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getFilterSummary = (segment: SegmentDefinition): string[] => {
    const summary: string[] = [];

    // Demographic filters
    if (segment.filters.demographics?.ageRange) {
      const [min, max] = segment.filters.demographics.ageRange;
      summary.push(`Age ${min}-${max}`);
    }
    if (segment.filters.demographics?.incomeRange) {
      const [min, max] = segment.filters.demographics.incomeRange;
      summary.push(`Income $${(min / 1000).toFixed(0)}K-$${(max / 1000).toFixed(0)}K`);
    }
    if (segment.filters.demographics?.educationLevel) {
      summary.push(`Education: ${segment.filters.demographics.educationLevel}`);
    }
    if (segment.filters.demographics?.density?.length) {
      summary.push(`Density: ${segment.filters.demographics.density.join(', ')}`);
    }

    // Political filters
    if (segment.filters.political?.partyLean?.length) {
      summary.push(`Party: ${segment.filters.political.partyLean.length} types`);
    }
    if (segment.filters.political?.competitiveness?.length) {
      summary.push(`Comp: ${segment.filters.political.competitiveness.length} types`);
    }
    if (segment.filters.political?.partisanLeanRange) {
      const [min, max] = segment.filters.political.partisanLeanRange;
      summary.push(`Lean: ${min} to ${max}`);
    }

    // Targeting filters
    if (segment.filters.targeting?.gotvPriorityRange) {
      const [min, max] = segment.filters.targeting.gotvPriorityRange;
      summary.push(`GOTV: ${min}-${max}`);
    }
    if (segment.filters.targeting?.persuasionRange) {
      const [min, max] = segment.filters.targeting.persuasionRange;
      summary.push(`Persuasion: ${min}-${max}`);
    }
    if (segment.filters.targeting?.targeting_strategy?.length) {
      summary.push(`Strategy: ${segment.filters.targeting.targeting_strategy.length} types`);
    }
    if (segment.filters.targeting?.strategy?.length) {
      summary.push(`Strategy: ${segment.filters.targeting.strategy.length} types`);
    }

    // Engagement filters
    if (segment.filters.engagement?.newsPreference) {
      summary.push(`News: ${segment.filters.engagement.newsPreference}`);
    }
    if (segment.filters.engagement?.highFacebook) {
      summary.push('High Facebook');
    }
    if (segment.filters.engagement?.highYouTube) {
      summary.push('High YouTube');
    }
    if (segment.filters.engagement?.highSocialMedia) {
      summary.push('High Social Media');
    }

    return summary.slice(0, 5); // Limit to 5 items
  };

  if (segments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No saved segments yet</p>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Create and save a segment to see it here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {segments.map((segment) => {
        const filterSummary = getFilterSummary(segment);
        const precinctCount = segment.cachedResults?.precinctCount ?? 0;
        const voterCount = segment.cachedResults?.estimatedVoters ?? 0;

        return (
          <Card key={segment.id} className="hover:bg-accent/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{segment.name}</CardTitle>
                  {segment.description && (
                    <p className="text-sm text-muted-foreground mt-1">{segment.description}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onLoad(segment)}
                    className="flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(segment.id)}
                    className="flex items-center gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Stats */}
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="font-medium">{precinctCount}</span>
                    <span className="text-muted-foreground ml-1">precincts</span>
                  </div>
                  <div>
                    <span className="font-medium">{voterCount.toLocaleString()}</span>
                    <span className="text-muted-foreground ml-1">voters</span>
                  </div>
                  <div className="ml-auto text-muted-foreground">
                    {formatDate(segment.createdAt)}
                  </div>
                </div>

                {/* Filter Summary */}
                {filterSummary.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {filterSummary.map((item, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                    {getFilterSummary(segment).length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{getFilterSummary(segment).length - 5} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
