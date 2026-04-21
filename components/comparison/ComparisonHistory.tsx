'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, ChevronDown, Trash2, GitCompare, Building2, MapPin } from 'lucide-react';
import {
  getComparisonHistory,
  deleteComparison,
  clearComparisonHistory,
  type SavedComparison,
} from '@/lib/comparison/ComparisonHistoryStore';
import { formatDistanceToNow } from 'date-fns';

interface ComparisonHistoryProps {
  onLoadComparison: (comparison: SavedComparison) => void;
  currentBoundaryType?: string;
}

export function ComparisonHistory({
  onLoadComparison,
  currentBoundaryType,
}: ComparisonHistoryProps) {
  const [history, setHistory] = useState<SavedComparison[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [comparisonToDelete, setComparisonToDelete] = useState<string | null>(null);

  // Load history on mount and when isOpen changes
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = () => {
    const stored = getComparisonHistory();
    setHistory(stored);
  };

  const handleDelete = (id: string) => {
    setComparisonToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (comparisonToDelete) {
      deleteComparison(comparisonToDelete);
      loadHistory();
      setComparisonToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleClearAll = () => {
    clearComparisonHistory();
    loadHistory();
  };

  const handleLoad = (comparison: SavedComparison) => {
    onLoadComparison(comparison);
    setIsOpen(false);
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const getBoundaryIcon = (boundaryType: string) => {
    if (boundaryType.includes('precinct')) {
      return <MapPin className="h-3 w-3" />;
    }
    return <Building2 className="h-3 w-3" />;
  };

  const getBoundaryLabel = (boundaryType: string) => {
    const labels: Record<string, string> = {
      precincts: 'Precincts',
      municipalities: 'Municipalities',
      state_house: 'State House Districts',
      state_senate: 'State Senate Districts',
      congressional: 'Congressional Districts',
      school_districts: 'School Districts',
      county: 'Counties',
      zip_codes: 'ZIP Codes',
    };
    return labels[boundaryType] || boundaryType;
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Clock className="h-4 w-4" />
            <span>History ({history.length})</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          <Card className="p-4">
            {history.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <GitCompare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No saved comparisons yet</p>
                <p className="text-xs mt-1">
                  Use the &quot;Save Comparison&quot; button to save your comparisons
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Saved Comparisons</h3>
                  {history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-xs h-7"
                    >
                      Clear All
                    </Button>
                  )}
                </div>

                <ScrollArea className="h-[300px] pr-3">
                  <div className="space-y-2">
                    {history.map((item, index) => (
                      <div key={item.id}>
                        {index > 0 && <Separator className="my-2" />}
                        <div className="flex items-start gap-3 group">
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => handleLoad(item)}
                              className="w-full text-left hover:bg-accent/50 rounded-md p-2 transition-colors"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {getBoundaryIcon(item.boundaryType)}
                                <span className="text-xs text-muted-foreground">
                                  {getBoundaryLabel(item.boundaryType)}
                                </span>
                              </div>
                              <div className="text-sm font-medium truncate">
                                {item.leftEntityName}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 my-1">
                                <span>vs</span>
                              </div>
                              <div className="text-sm font-medium truncate">
                                {item.rightEntityName}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatTimeAgo(item.savedAt)}
                              </div>
                            </button>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comparison</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this saved comparison? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
