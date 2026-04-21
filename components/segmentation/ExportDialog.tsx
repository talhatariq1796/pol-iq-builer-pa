'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, FileSpreadsheet, Phone, Target, Users } from 'lucide-react';
import type { SegmentResults, ExportFormat } from '@/lib/segmentation/types';
import { ExportManager } from '@/lib/segmentation/ExportManager';
import { useToast } from '@/hooks/use-toast';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: SegmentResults | null;
  segmentName?: string;
}

interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const EXPORT_FORMATS: ExportFormatOption[] = [
  {
    value: 'csv',
    label: 'CSV Spreadsheet',
    description: 'Standard CSV format for Excel or Google Sheets',
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
  {
    value: 'van',
    label: 'VAN Format',
    description: 'For import into VoteBuilder/VAN systems',
    icon: <Users className="h-5 w-5" />,
  },
  {
    value: 'phone_list',
    label: 'Phone Banking List',
    description: 'Prioritized list for phone banking with scripts',
    icon: <Phone className="h-5 w-5" />,
  },
  {
    value: 'digital_ads',
    label: 'Digital Ads (ZIP Level)',
    description: 'ZIP-aggregated data for Facebook/Google ads',
    icon: <Target className="h-5 w-5" />,
  },
];

export function ExportDialog({ open, onOpenChange, results, segmentName }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Phone list options
  const [phoneListSortBy, setPhoneListSortBy] = useState<'gotvPriority' | 'persuasion' | 'voterCount'>('gotvPriority');
  const [includeScripts, setIncludeScripts] = useState(true);

  // VAN options
  const [includeTargetingScores, setIncludeTargetingScores] = useState(true);
  const [includeDemographics, setIncludeDemographics] = useState(true);

  const handleExport = async () => {
    if (!results) return;

    setIsExporting(true);
    try {
      const exportManager = new ExportManager(results);

      // Build filename with extension
      const baseFilename = segmentName || `segment-export-${Date.now()}`;
      const extension = selectedFormat === 'json' ? 'json' : 'csv';
      const filename = `${baseFilename}.${extension}`;

      const options = {
        format: selectedFormat,
        filename,
        includeMetadata: true,
        // VAN options
        includeTargetingScores,
        includeDemographics,
        // Phone list options
        sortBy: phoneListSortBy,
        includeScripts,
      };

      // Export returns a Blob directly (and auto-downloads if filename provided)
      await exportManager.export(options);

      toast({
        title: 'Export successful',
        description: `Your ${selectedFormat.toUpperCase()} file has been downloaded.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description: 'Please try again or contact support if the issue persists.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!results) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Segment</DialogTitle>
          <DialogDescription>
            Export {results.precinctCount} precincts ({results.estimatedVoters.toLocaleString()} voters)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup
              value={selectedFormat}
              onValueChange={(value: string) => setSelectedFormat(value as ExportFormat)}
              className="grid grid-cols-1 gap-3"
            >
              {EXPORT_FORMATS.map((format) => (
                <div key={format.value} className="flex items-start space-x-3">
                  <RadioGroupItem
                    value={format.value}
                    id={`format-${format.value}`}
                    className="mt-1"
                  />
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-muted-foreground">{format.icon}</div>
                    <div>
                      <label
                        htmlFor={`format-${format.value}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {format.label}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {format.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Format-specific options */}
          {selectedFormat === 'van' && (
            <div className="space-y-3 pl-4 border-l-2 border-muted">
              <Label className="text-sm">VAN Export Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="van-targeting"
                    checked={includeTargetingScores}
                    onCheckedChange={(checked: boolean) => setIncludeTargetingScores(checked)}
                  />
                  <label htmlFor="van-targeting" className="text-sm cursor-pointer">
                    Include targeting scores (GOTV, Persuasion, Swing)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="van-demographics"
                    checked={includeDemographics}
                    onCheckedChange={(checked: boolean) => setIncludeDemographics(checked)}
                  />
                  <label htmlFor="van-demographics" className="text-sm cursor-pointer">
                    Include demographic data
                  </label>
                </div>
              </div>
            </div>
          )}

          {selectedFormat === 'phone_list' && (
            <div className="space-y-3 pl-4 border-l-2 border-muted">
              <Label className="text-sm">Phone List Options</Label>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Sort By</Label>
                  <Select
                    value={phoneListSortBy}
                    onValueChange={(value: string) => setPhoneListSortBy(value as 'gotvPriority' | 'persuasion' | 'voterCount')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gotvPriority">GOTV Priority (highest first)</SelectItem>
                      <SelectItem value="persuasion">Persuasion Score (highest first)</SelectItem>
                      <SelectItem value="voterCount">Voter Count (highest first)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="phone-scripts"
                    checked={includeScripts}
                    onCheckedChange={(checked: boolean) => setIncludeScripts(checked)}
                  />
                  <label htmlFor="phone-scripts" className="text-sm cursor-pointer">
                    Include talking points for each precinct
                  </label>
                </div>
              </div>
            </div>
          )}

          {selectedFormat === 'digital_ads' && (
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              <p className="text-xs text-muted-foreground">
                Data will be aggregated to ZIP code level for privacy compliance.
                Includes voter counts, demographics, and Tapestry segments.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
