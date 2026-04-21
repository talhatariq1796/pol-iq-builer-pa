'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Lightbulb,
  TrendingUp,
  Users,
  Target,
  AlertCircle,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface InsightsSummaryProps {
  insights: string[];
  leftName: string;
  rightName: string;
  onGenerateFullAnalysis?: () => void;
}

export function InsightsSummary({
  insights,
  leftName,
  rightName,
  onGenerateFullAnalysis,
}: InsightsSummaryProps) {
  // Get icon for insight type based on content
  const getInsightIcon = (insight: string): React.ReactNode => {
    const lowerInsight = insight.toLowerCase();
    if (lowerInsight.includes('demographic') || lowerInsight.includes('population')) {
      return <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
    if (lowerInsight.includes('targeting') || lowerInsight.includes('strategy')) {
      return <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    }
    if (lowerInsight.includes('swing') || lowerInsight.includes('competitive')) {
      return <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
    }
    if (lowerInsight.includes('caution') || lowerInsight.includes('note')) {
      return <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    }
    return <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />;
  };

  // Highlight entity names in bold
  const formatInsightText = (text: string): React.ReactNode => {
    const parts = text.split(new RegExp(`(${leftName}|${rightName})`, 'gi'));
    return parts.map((part, idx) => {
      if (part.toLowerCase() === leftName.toLowerCase()) {
        return (
          <strong key={idx} className="font-semibold text-blue-700 dark:text-blue-300">
            {part}
          </strong>
        );
      }
      if (part.toLowerCase() === rightName.toLowerCase()) {
        return (
          <strong key={idx} className="font-semibold text-red-700 dark:text-red-300">
            {part}
          </strong>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  if (insights.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No insights available. Select two entities to compare and see strategic insights.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Strategic Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Insights List */}
        <div className="space-y-2">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="shrink-0 mt-0.5">{getInsightIcon(insight)}</div>
              <p className="text-sm leading-relaxed flex-1">{formatInsightText(insight)}</p>
            </div>
          ))}
        </div>

        {/* Optional: Full Analysis Button */}
        {onGenerateFullAnalysis && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={onGenerateFullAnalysis}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Full AI Analysis
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        )}

        {/* Disclaimer */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Insights are based on demographic, electoral, and targeting data. Use in conjunction with
            on-the-ground intelligence for best results.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
