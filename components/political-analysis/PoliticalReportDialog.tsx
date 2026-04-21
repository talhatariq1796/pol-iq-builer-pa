/**
 * PoliticalReportDialog Component
 *
 * Dialog for generating and downloading Political Profile PDF reports.
 * Shows generation progress and handles PDF download.
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  MapPin,
  Users,
  BarChart3,
  Clock,
} from 'lucide-react';

import type { PoliticalAreaSelection } from '@/types/political';

interface AnalysisResultSummary {
  areaName: string;
  totalPrecincts: number;
  totalVoters: number;
  partisanLean: number;
  competitiveness: string;
  targetingPriority: string;
}

interface PoliticalReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selection: PoliticalAreaSelection | null;
  analysisSummary: AnalysisResultSummary | null;
  onGenerate?: () => Promise<Blob>;
}

type GenerationStep = 'idle' | 'preparing' | 'generating' | 'complete' | 'error';

export function PoliticalReportDialog({
  isOpen,
  onClose,
  selection,
  analysisSummary,
  onGenerate,
}: PoliticalReportDialogProps) {
  const [step, setStep] = useState<GenerationStep>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setProgress(0);
      setError(null);
      setPdfBlob(null);
    }
  }, [isOpen]);

  // Format partisan lean
  const formatLean = (lean: number): string => {
    const prefix = lean > 0 ? 'D+' : lean < 0 ? 'R+' : '';
    return `${prefix}${Math.abs(lean).toFixed(1)}`;
  };

  // Get lean color class
  const getLeanColorClass = (lean: number): string => {
    if (lean >= 10) return 'bg-blue-500 text-white';
    if (lean > 0) return 'bg-blue-200';
    if (lean > -10) return 'bg-red-200';
    return 'bg-red-500 text-white';
  };

  // Handle generate button click
  const handleGenerate = useCallback(async () => {
    if (!selection || !analysisSummary) return;

    setStep('preparing');
    setProgress(10);
    setError(null);

    try {
      // Simulate preparation
      await new Promise((resolve) => setTimeout(resolve, 500));
      setProgress(30);
      setStep('generating');

      // Generate PDF
      if (onGenerate) {
        const blob = await onGenerate();
        setPdfBlob(blob);
        setProgress(100);
        setStep('complete');
      } else {
        // If no generate function provided, create a placeholder
        setProgress(100);
        setStep('complete');
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      setStep('error');
    }
  }, [selection, analysisSummary, onGenerate]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (!pdfBlob || !analysisSummary) return;

    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Political_Profile_${analysisSummary.areaName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [pdfBlob, analysisSummary]);

  if (!selection || !analysisSummary) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Political Profile Report
          </DialogTitle>
          <DialogDescription>
            Create a comprehensive PDF report for the selected area.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Area Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{analysisSummary.areaName}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span>{analysisSummary.totalVoters.toLocaleString()} voters</span>
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3 text-muted-foreground" />
                <span>{analysisSummary.totalPrecincts} precincts</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getLeanColorClass(analysisSummary.partisanLean)}>
                {formatLean(analysisSummary.partisanLean)}
              </Badge>
              <Badge variant="secondary">{analysisSummary.competitiveness}</Badge>
              <Badge
                variant={
                  analysisSummary.targetingPriority === 'High'
                    ? 'destructive'
                    : analysisSummary.targetingPriority === 'Medium-High'
                    ? 'default'
                    : 'secondary'
                }
              >
                {analysisSummary.targetingPriority}
              </Badge>
            </div>
          </div>

          {/* Report Contents */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Report includes:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Area overview with voter demographics
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Partisan lean analysis and visualization
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Historical election results (2020-2024)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Precinct-level political breakdown
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Targeting and outreach recommendations
              </li>
            </ul>
          </div>

          {/* Progress */}
          {(step === 'preparing' || step === 'generating') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {step === 'preparing' ? 'Preparing data...' : 'Generating PDF...'}
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Success */}
          {step === 'complete' && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Report generated successfully! Click download to save.
              </AlertDescription>
            </Alert>
          )}

          {/* Error */}
          {step === 'error' && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {step === 'complete' ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={step === 'preparing' || step === 'generating'}
            >
              {step === 'preparing' || step === 'generating' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PoliticalReportDialog;
