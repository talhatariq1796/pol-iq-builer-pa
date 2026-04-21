'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Map, ArrowUpDown } from 'lucide-react';
import type { SegmentResults as SegmentResultsType } from '@/lib/segmentation/types';
import { MetricLabel } from '@/components/ui/metric-label';

interface SegmentResultsProps {
  results: SegmentResultsType;
  onShowOnMap?: () => void;
  onExportCSV?: () => void;
  /** Callback when user activates (Enter) on a precinct row */
  onPrecinctSelect?: (precinctId: string, precinctName: string) => void;
}

type SortField = 'name' | 'voters' | 'gotv' | 'persuasion';
type SortDirection = 'asc' | 'desc';

// Memoized row component to prevent unnecessary re-renders in large lists
const PrecinctRow = React.memo(function PrecinctRow({
  precinct,
  getStrategyColor,
  isSelected,
  onClick,
}: {
  precinct: SegmentResultsType['matchingPrecincts'][0];
  getStrategyColor: (strategy: string) => string;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  return (
    <TableRow
      key={precinct.precinctId}
      onClick={onClick}
      tabIndex={0}
      className={`cursor-pointer transition-colors focus:outline-none ${isSelected
        ? 'bg-[#33a852]/10 dark:bg-green-900/20 ring-2 ring-[#33a852] ring-inset'
        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }`}
      data-precinct-id={precinct.precinctId}
    >
      <TableCell className="font-medium">{precinct.precinctName}</TableCell>
      <TableCell className="text-muted-foreground">
        {precinct.jurisdiction}
      </TableCell>
      <TableCell className="text-right">
        {precinct.registeredVoters.toLocaleString()}
      </TableCell>
      <TableCell className="text-right">
        {precinct.gotvPriority.toFixed(0)}
      </TableCell>
      <TableCell className="text-right">
        {precinct.persuasionOpportunity.toFixed(0)}
      </TableCell>
      <TableCell>
        <Badge
          className={getStrategyColor(precinct.targetingStrategy)}
          variant="secondary"
        >
          {precinct.targetingStrategy}
        </Badge>
      </TableCell>
    </TableRow>
  );
});

export function SegmentResults({ results, onShowOnMap, onExportCSV, onPrecinctSelect }: SegmentResultsProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('voters');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedPrecincts = [...results.matchingPrecincts].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case 'name':
        aValue = a.precinctName;
        bValue = b.precinctName;
        break;
      case 'voters':
        aValue = a.registeredVoters;
        bValue = b.registeredVoters;
        break;
      case 'gotv':
        aValue = a.gotvPriority;
        bValue = b.gotvPriority;
        break;
      case 'persuasion':
        aValue = a.persuasionOpportunity;
        bValue = b.persuasionOpportunity;
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortDirection === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  // Calculate pagination
  const totalPages = Math.ceil(sortedPrecincts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPrecincts = sortedPrecincts.slice(startIndex, endIndex);

  // Keyboard navigation handler (works within current page)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const precinctCount = paginatedPrecincts.length;
    if (precinctCount === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev: number) => {
          const next = prev < precinctCount - 1 ? prev + 1 : 0;
          // Scroll selected row into view
          const row = tableContainerRef.current?.querySelector(
            `[data-precinct-id="${paginatedPrecincts[next]?.precinctId}"]`
          );
          row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev: number) => {
          const next = prev > 0 ? prev - 1 : precinctCount - 1;
          const row = tableContainerRef.current?.querySelector(
            `[data-precinct-id="${paginatedPrecincts[next]?.precinctId}"]`
          );
          row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < precinctCount) {
          e.preventDefault();
          const precinct = paginatedPrecincts[selectedIndex];
          if (onPrecinctSelect) {
            onPrecinctSelect(precinct.precinctId, precinct.precinctName);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSelectedIndex(-1);
        break;
      case 'Home':
        e.preventDefault();
        setSelectedIndex(0);
        const firstRow = tableContainerRef.current?.querySelector(
          `[data-precinct-id="${paginatedPrecincts[0]?.precinctId}"]`
        );
        firstRow?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        break;
      case 'End':
        e.preventDefault();
        setSelectedIndex(precinctCount - 1);
        const lastRow = tableContainerRef.current?.querySelector(
          `[data-precinct-id="${paginatedPrecincts[precinctCount - 1]?.precinctId}"]`
        );
        lastRow?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        break;
    }
  }, [paginatedPrecincts, selectedIndex, onPrecinctSelect]);

  // Reset selection when sort changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [sortField, sortDirection]);

  // Reset to page 1 when sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortDirection]);

  // Reset selection when page changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [currentPage]);

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'Base Mobilization':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'Persuasion Target':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
      case 'Battleground':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
      case 'Maintenance':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const formatPercentage = (value: number | undefined): number => {
    if (value === undefined) return 0;
    return value;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-lg shadow-md border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Matching Precincts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.precinctCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(
                (results.precinctCount / (results.matchingPrecincts.length || 1)) * 100
              ).toFixed(1)}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estimated Voters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {results.estimatedVoters.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              VAP: {results.estimatedVAP.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <MetricLabel metric="gotv_priority">Avg GOTV</MetricLabel>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.avgGOTV.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              <MetricLabel metric="persuasion_opportunity">Persuasion</MetricLabel>: {results.avgPersuasion.toFixed(0)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <MetricLabel metric="avg_turnout">Avg Turnout</MetricLabel>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.avgTurnout.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              <MetricLabel metric="partisan_lean">Lean</MetricLabel>: {results.avgPartisanLean > 0 ? 'R+' : 'D+'}
              {Math.abs(results.avgPartisanLean).toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Strategy Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Strategy Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(results.strategyBreakdown).map(([strategy, count]) => (
              <Badge key={strategy} className={getStrategyColor(strategy)} variant="secondary">
                {strategy}: {count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* <Button
          onClick={() => {
            if (onShowOnMap) {
              onShowOnMap();
            } else {
              // Fallback navigation if parent doesn't provide handler
              const precinctIds = results.matchingPrecincts.map(p => p.precinctId);
              const params = new URLSearchParams({
                mode: 'segment',
                precinctIds: precinctIds.join(','),
                count: results.precinctCount.toString(),
              });
              router.push(`/political-ai?${params.toString()}`);
            }
          }}
          variant="default"
          className="flex items-center gap-2"
        >
          <Map className="h-4 w-4" />
          View on Map
        </Button> */}
        <Button onClick={onExportCSV} variant="default" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Precinct Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Matching Precincts</CardTitle>
          {/* Keyboard navigation hint */}
          <p className="text-xs text-muted-foreground">
            Use ↑↓ to navigate, Enter to select
          </p>
        </CardHeader>
        <CardContent>
          <div
            ref={tableContainerRef}
            className="rounded-md border focus:outline-none focus:ring-2 focus:ring-[#33a852]"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            role="grid"
            aria-label="Matching precincts table"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Precinct
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort('voters')}
                      className="flex items-center gap-1 ml-auto hover:text-foreground"
                    >
                      Voters
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort('gotv')}
                      className="flex items-center gap-1 ml-auto hover:text-foreground"
                    >
                      <MetricLabel metric="gotv_priority">GOTV</MetricLabel>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort('persuasion')}
                      className="flex items-center gap-1 ml-auto hover:text-foreground"
                    >
                      <MetricLabel metric="persuasion_opportunity">Persuasion</MetricLabel>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Strategy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPrecincts.map((precinct, index) => (
                  <PrecinctRow
                    key={precinct.precinctId}
                    precinct={precinct}
                    getStrategyColor={getStrategyColor}
                    isSelected={index === selectedIndex}
                    onClick={() => {
                      setSelectedIndex(index);
                      if (onPrecinctSelect) {
                        onPrecinctSelect(precinct.precinctId, precinct.precinctName);
                      }
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, sortedPrecincts.length)} of {sortedPrecincts.length} precincts
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page: number) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first page, last page, current page, and pages around current
                      return (
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1
                      );
                    })
                    .map((page, index, array) => {
                      // Add ellipsis if there's a gap
                      const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                      return (
                        <React.Fragment key={page}>
                          {showEllipsisBefore && (
                            <span className="px-2 text-muted-foreground">...</span>
                          )}
                          <Button
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={currentPage === page ? 'pointer-events-none' : ''}
                          >
                            {page}
                          </Button>
                        </React.Fragment>
                      );
                    })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page: number) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
