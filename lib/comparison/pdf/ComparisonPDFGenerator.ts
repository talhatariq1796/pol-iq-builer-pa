/**
 * PDF Generation for Comparison Reports
 *
 * Uses jsPDF to generate formatted comparison reports with insights and ROI analysis.
 */

import { jsPDF } from 'jspdf';
import type {
  ComparisonResult,
  FieldBrief,
  EntityResourceAnalysis,
} from '@/lib/comparison';

interface PDFGenerationData {
  comparison: ComparisonResult;
  brief: FieldBrief | null;
  roiAnalysis: {
    left: EntityResourceAnalysis;
    right: EntityResourceAnalysis;
  } | null;
  metadata: {
    generatedAt: string;
    reportType: string;
    leftEntityName: string;
    rightEntityName: string;
    boundaryType: string;
    options?: any;
  };
}

export class ComparisonPDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private currentY: number;
  private lineHeight: number;

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.currentY = this.margin;
    this.lineHeight = 7;
  }

  /**
   * Generate PDF buffer from comparison data
   */
  async generatePDF(data: PDFGenerationData): Promise<Buffer> {
    this.addHeader(data.metadata);
    this.addOverview(data.comparison);
    this.addComparison(data.comparison);

    if (data.comparison.insights && data.comparison.insights.length > 0) {
      this.checkPageBreak();
      this.addInsights(data.comparison.insights);
    }

    if (data.roiAnalysis) {
      this.checkPageBreak();
      this.addROIAnalysis(data.roiAnalysis);
    }

    if (data.brief) {
      this.checkPageBreak();
      this.addFieldBrief(data.brief);
    }

    this.addFooter(data.metadata.generatedAt);

    // Return as buffer
    const pdfOutput = this.doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
  }

  /**
   * Add report header
   */
  private addHeader(metadata: PDFGenerationData['metadata']): void {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Comparison Report', this.margin, this.currentY);
    this.currentY += 10;

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(
      `${metadata.leftEntityName} vs ${metadata.rightEntityName}`,
      this.margin,
      this.currentY
    );
    this.currentY += 8;

    this.doc.setFontSize(10);
    this.doc.setTextColor(100);
    this.doc.text(
      `Generated: ${new Date(metadata.generatedAt).toLocaleString()}`,
      this.margin,
      this.currentY
    );
    this.currentY += 10;

    // Reset color
    this.doc.setTextColor(0);
  }

  /**
   * Add overview section
   */
  private addOverview(comparison: ComparisonResult): void {
    this.addSectionTitle('Overview');

    const { leftEntity, rightEntity } = comparison;

    // Left entity summary
    this.addText(`${leftEntity.name}:`, true);
    this.addText(`  Population: ${this.formatNumber(leftEntity.demographics.totalPopulation)}`);
    this.addText(`  Registered Voters: ${this.formatNumber(leftEntity.demographics.registeredVoters)}`);
    this.addText(`  Partisan Lean: ${this.formatScore(leftEntity.politicalProfile.partisanLean)}`);
    this.currentY += 3;

    // Right entity summary
    this.addText(`${rightEntity.name}:`, true);
    this.addText(`  Population: ${this.formatNumber(rightEntity.demographics.totalPopulation)}`);
    this.addText(`  Registered Voters: ${this.formatNumber(rightEntity.demographics.registeredVoters)}`);
    this.addText(`  Partisan Lean: ${this.formatScore(rightEntity.politicalProfile.partisanLean)}`);
    this.currentY += 5;
  }

  /**
   * Add detailed comparison
   */
  private addComparison(comparison: ComparisonResult): void {
    this.addSectionTitle('Key Metrics Comparison');

    const metrics = [
      { label: 'Population', left: comparison.leftEntity.demographics.totalPopulation, right: comparison.rightEntity.demographics.totalPopulation },
      { label: 'Registered Voters', left: comparison.leftEntity.demographics.registeredVoters, right: comparison.rightEntity.demographics.registeredVoters },
      { label: 'Median Age', left: comparison.leftEntity.demographics.medianAge, right: comparison.rightEntity.demographics.medianAge },
      { label: 'Median Income', left: comparison.leftEntity.demographics.medianIncome, right: comparison.rightEntity.demographics.medianIncome },
      { label: 'Partisan Lean', left: comparison.leftEntity.politicalProfile.partisanLean, right: comparison.rightEntity.politicalProfile.partisanLean },
      { label: 'Swing Potential', left: comparison.leftEntity.politicalProfile.swingPotential, right: comparison.rightEntity.politicalProfile.swingPotential },
      { label: 'GOTV Priority', left: comparison.leftEntity.targetingScores.gotvPriority, right: comparison.rightEntity.targetingScores.gotvPriority },
      { label: 'Turnout Rate', left: comparison.leftEntity.politicalProfile.avgTurnoutRate, right: comparison.rightEntity.politicalProfile.avgTurnoutRate, isPercent: true },
    ];

    const colWidth = 60;
    const col1X = this.margin + 10;
    const col2X = col1X + colWidth;
    const col3X = col2X + colWidth;

    // Table header
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Metric', col1X, this.currentY);
    this.doc.text(comparison.leftEntity.name, col2X, this.currentY);
    this.doc.text(comparison.rightEntity.name, col3X, this.currentY);
    this.currentY += 7;

    // Table rows
    this.doc.setFont('helvetica', 'normal');
    metrics.forEach((metric) => {
      this.doc.text(metric.label, col1X, this.currentY);

      const leftValue = metric.isPercent
        ? `${metric.left.toFixed(1)}%`
        : this.formatNumber(metric.left);
      const rightValue = metric.isPercent
        ? `${metric.right.toFixed(1)}%`
        : this.formatNumber(metric.right);

      this.doc.text(leftValue, col2X, this.currentY);
      this.doc.text(rightValue, col3X, this.currentY);
      this.currentY += 6;
    });

    this.currentY += 5;
  }

  /**
   * Add insights section
   */
  private addInsights(insights: string[]): void {
    this.addSectionTitle('Key Insights');

    insights.forEach((insight, index) => {
      this.checkPageBreak();
      this.doc.setFont('helvetica', 'normal');

      // Bullet point
      this.doc.text(`${index + 1}.`, this.margin, this.currentY);

      // Wrap text
      const textLines = this.doc.splitTextToSize(insight, this.pageWidth - this.margin * 2 - 10);
      textLines.forEach((line: string) => {
        this.checkPageBreak();
        this.doc.text(line, this.margin + 8, this.currentY);
        this.currentY += this.lineHeight;
      });

      this.currentY += 2;
    });

    this.currentY += 5;
  }

  /**
   * Add ROI analysis
   */
  private addROIAnalysis(roiAnalysis: { left: EntityResourceAnalysis; right: EntityResourceAnalysis }): void {
    this.addSectionTitle('Resource Allocation Analysis');

    const { left, right } = roiAnalysis;

    // Left entity ROI
    this.addText(`${left.entity.name}:`, true);
    this.addText(`  ROI Score: ${left.roiScore.totalScore.toFixed(1)}/100`);
    this.addText(`  Recommendation: ${left.roiScore.recommendation}`);
    this.addText(`  Recommended Channel: ${left.recommendedChannel}`);
    this.addText(`  Est. Persuadable Voters: ${this.formatNumber(left.estimatedPersuadableVoters)}`);
    this.addText(`  Cost Per 1000 Voters: $${left.projections.costFor1000Voters.toFixed(2)}`);
    this.currentY += 3;

    // Right entity ROI
    this.addText(`${right.entity.name}:`, true);
    this.addText(`  ROI Score: ${right.roiScore.totalScore.toFixed(1)}/100`);
    this.addText(`  Recommendation: ${right.roiScore.recommendation}`);
    this.addText(`  Recommended Channel: ${right.recommendedChannel}`);
    this.addText(`  Est. Persuadable Voters: ${this.formatNumber(right.estimatedPersuadableVoters)}`);
    this.addText(`  Cost Per 1000 Voters: $${right.projections.costFor1000Voters.toFixed(2)}`);
    this.currentY += 5;
  }

  /**
   * Add field brief section
   */
  private addFieldBrief(brief: FieldBrief): void {
    this.addSectionTitle('Field Briefing');

    if (brief.summary) {
      this.addText('Executive Summary:', true);
      const summaryLines = this.doc.splitTextToSize(brief.summary, this.pageWidth - this.margin * 2 - 5);
      summaryLines.forEach((line: string) => {
        this.checkPageBreak();
        this.doc.text(line, this.margin + 5, this.currentY);
        this.currentY += this.lineHeight;
      });
      this.currentY += 3;
    }

    if (brief.talkingPoints && brief.talkingPoints.left && brief.talkingPoints.left.keyMessages.length > 0) {
      this.addText(`Key Messages (${brief.talkingPoints.left.areaName}):`, true);
      brief.talkingPoints.left.keyMessages.forEach((point, index) => {
        this.checkPageBreak();
        this.doc.text(`${index + 1}.`, this.margin + 5, this.currentY);
        const pointLines = this.doc.splitTextToSize(point, this.pageWidth - this.margin * 2 - 10);
        pointLines.forEach((line: string) => {
          this.checkPageBreak();
          this.doc.text(line, this.margin + 13, this.currentY);
          this.currentY += this.lineHeight;
        });
      });
      this.currentY += 3;
    }

    if (brief.talkingPoints && brief.talkingPoints.right && brief.talkingPoints.right.keyMessages.length > 0) {
      this.addText(`Key Messages (${brief.talkingPoints.right.areaName}):`, true);
      brief.talkingPoints.right.keyMessages.forEach((point, index) => {
        this.checkPageBreak();
        this.doc.text(`${index + 1}.`, this.margin + 5, this.currentY);
        const pointLines = this.doc.splitTextToSize(point, this.pageWidth - this.margin * 2 - 10);
        pointLines.forEach((line: string) => {
          this.checkPageBreak();
          this.doc.text(line, this.margin + 13, this.currentY);
          this.currentY += this.lineHeight;
        });
      });
    }
  }

  /**
   * Add footer with generation timestamp
   */
  private addFooter(generatedAt: string): void {
    const footerY = this.pageHeight - 15;
    this.doc.setFontSize(8);
    this.doc.setTextColor(150);
    this.doc.text(
      `Generated by Political Landscape Platform - ${new Date(generatedAt).toLocaleString()}`,
      this.pageWidth / 2,
      footerY,
      { align: 'center' }
    );
  }

  /**
   * Helper: Add section title
   */
  private addSectionTitle(title: string): void {
    this.checkPageBreak(15);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 10;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
  }

  /**
   * Helper: Add text with optional bold
   */
  private addText(text: string, bold = false): void {
    this.checkPageBreak();
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.text(text, this.margin, this.currentY);
    this.currentY += this.lineHeight;
  }

  /**
   * Helper: Check if page break is needed
   */
  private checkPageBreak(minSpace = 10): void {
    if (this.currentY + minSpace > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  /**
   * Helper: Format number with commas
   */
  private formatNumber(num: number): string {
    return Math.round(num).toLocaleString();
  }

  /**
   * Helper: Format score with sign
   */
  private formatScore(score: number): string {
    return score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  }
}
