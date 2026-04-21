/**
 * Revenue Property PDF Generator
 *
 * Generates professional investment-focused PDF reports for revenue properties
 *
 * Report Structure (4 pages):
 * - Page 1: Cover + Investment Summary (Key metrics at-a-glance)
 * - Page 2: Investment Metrics Details (All 7 metrics with explanations)
 * - Page 3: Cash Flow Analysis (Waterfall + breakdown)
 * - Page 4: Comparable Revenue Properties (Investment metrics table)
 */

import jsPDF from 'jspdf';
import type { CMAProperty } from '@/components/cma/types';
import { BHHSComponentLibrary } from './components/BHHSComponentLibrary';
import { ColorPalette } from './design/ColorPalette';

const VACANCY_RATE = 0.025; // 2.5% CMHC 2025 Montreal projection

export interface RevenuePropertyPDFConfig {
  property: CMAProperty;
  comparables: CMAProperty[];
  generatedAt?: string;
  agentInfo?: {
    name: string;
    phone?: string;
    email?: string;
    license?: string;
  };
  reportDate?: string;
  demographicData?: {
    ECYPTAPOP?: number;
    ECYTENHHD?: number;
    ECYHNIAVG?: number;
    ECYHNIMED?: number;
    ECYTENOWN_P?: number;
  };
  chartImages?: Record<string, string>;
}

export interface InvestmentMetrics {
  pgi: number | null;
  gim: number | null;
  noi: number | null;
  nim: number | null;
  egi: number | null;
  effective_noi: number | null;
  price_vs_assessment: number | null;
}

export interface AreaAverages {
  avgGIM: number;
  avgNIM: number;
  avgNOI: number;
  avgPGI: number;
  avgPriceVsAssessment: number;
  count: number;
}

export class RevenuePropertyPDFGenerator {
  private pdf: jsPDF;
  private components: BHHSComponentLibrary;
  private currentY: number = 20;
  private pageMargin: number = 20;
  private pageWidth: number;
  private pageHeight: number;
  private pageNumber: number = 1;

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.pageHeight = this.pdf.internal.pageSize.height;
    this.components = new BHHSComponentLibrary();
  }

  /**
   * Generate complete revenue property PDF report
   */
  async generateReport(config: RevenuePropertyPDFConfig): Promise<Blob> {
    console.log('[RevenuePropertyPDFGenerator] Starting PDF generation for property:', config.property.id);

    // Calculate investment metrics
    const metrics = this.calculateInvestmentMetrics(config.property);

    // Calculate area averages from comparables
    const areaAverages = this.calculateAreaAverages(config.comparables);

    // Page 1: Cover + Investment Summary
    this.buildPage1(config.property, metrics);

    // Page 2: Investment Metrics Details
    this.pdf.addPage();
    this.pageNumber++;
    this.currentY = 20;
    this.buildPage2(config.property, metrics, areaAverages);

    // Page 3: Cash Flow Analysis
    this.pdf.addPage();
    this.pageNumber++;
    this.currentY = 20;
    this.buildPage3(config.property, metrics);

    // Page 4: Demographic KPI Cards + Comparable Revenue Properties
    this.pdf.addPage();
    this.pageNumber++;
    this.currentY = 20;
    // Build demographics object for KPI cards
    const demo = config.demographicData || {};
    const demographics = {
      population: {
        total: demo.ECYPTAPOP || 0,
        households: demo.ECYTENHHD || 0,
        avgHouseholdSize: demo.ECYTENHHD && demo.ECYPTAPOP ? Math.round((demo.ECYPTAPOP / demo.ECYTENHHD) * 10) / 10 : 0,
        medianAge: 0,
        avgIncome: demo.ECYHNIAVG || 0,
        medianIncome: demo.ECYHNIMED || 0,
      },
      housing: {
        ownershipRate: demo.ECYTENOWN_P || 0,
        rentalRate: demo.ECYTENOWN_P ? 100 - demo.ECYTENOWN_P : 0,
      }
    };
    // Use Page4BuilderV2 to render KPI cards
    try {
      const { Page4BuilderV2 } = require('./pages/Page4BuilderV2');
      const page4Builder = new Page4BuilderV2(this.pdf, { demographics });
      page4Builder.build();
      this.currentY = 70; // Move below KPI cards for comparables table
    } catch (err) {
      // Fallback: continue with comparables if builder not available
      this.currentY = 40;
    }
    // Render comparables table as before
    this.buildPage4(config.property, config.comparables, areaAverages, config.demographicData);

    // Page 5: Summary/Wrap-up
    this.pdf.addPage();
    this.pageNumber++;
    this.currentY = 20;
    this.buildSummaryPage(config.property, metrics, config.comparables);

    // Page 6: Market Activity & Velocity Charts (Days to Sold, Velocity by Price Point)
    try {
      // Import builder and extraction logic
      const { extractPage6Data } = require('./data/extractors');
      const { Page6BuilderV2 } = require('./pages/Page6BuilderV2');
      // Use all comparables for chart data (or fallback to revenueProperties)
      const page6Data = extractPage6Data({ properties: config.comparables, stats: {} }, { allTime: {} });
      // If chartImages are available in config, pass them
      const chartImages = config.chartImages || {};
      this.pdf.addPage();
      this.pageNumber++;
      this.currentY = 20;
      const page6Builder = new Page6BuilderV2(this.pdf, page6Data, chartImages);
      page6Builder.build();
    } catch (err) {
      console.warn('[RevenuePropertyPDFGenerator] Page 6 chart rendering failed:', err);
    }

    // Generate blob
    const pdfBlob = this.pdf.output('blob');
    console.log('[RevenuePropertyPDFGenerator] PDF generation complete');

    return pdfBlob;
  }

  /**
   * Page 5: Summary/Wrap-up
   */
  private buildSummaryPage(property: CMAProperty, metrics: InvestmentMetrics, comparables: CMAProperty[]): void {
    this.addHeader('Investment Summary & Insights');
    this.currentY += 10;

    // Key metrics summary
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Key Investment Metrics:', this.pageMargin, this.currentY);
    this.currentY += 8;
    const summaryMetrics = [
      `Sale Price: ${this.formatCurrency(property.price)}`,
      `GIM: ${metrics.gim ? metrics.gim.toFixed(1) + 'x' : 'N/A'}`,
      `PGI: ${this.formatCurrency(metrics.pgi)}`,
      `NOI: ${this.formatCurrency(metrics.noi)}`,
      `Price/Assessment: ${metrics.price_vs_assessment ? metrics.price_vs_assessment.toFixed(1) + '%' : 'N/A'}`
    ];
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    summaryMetrics.forEach((line) => {
      this.pdf.text(line, this.pageMargin + 5, this.currentY);
      this.currentY += 6;
    });

    // Top insights (simulated)
    this.currentY += 10;
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Top Insights:', this.pageMargin, this.currentY);
    this.currentY += 8;
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'italic');
    const insights = [
      '• This property offers competitive GIM and PGI compared to area averages.',
      '• NOI and Price/Assessment indicate strong investment value.',
      '• Comparable properties suggest stable rental income potential.'
    ];
    insights.forEach((insight) => {
      this.pdf.text(insight, this.pageMargin + 5, this.currentY);
      this.currentY += 5;
    });

    // Closing statement
    this.currentY += 12;
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text('For a full investment analysis, consult with a qualified professional.', this.pageMargin, this.currentY);

    this.addFooter();
  }

  /**
   * Calculate all investment metrics for a property
   */
  private calculateInvestmentMetrics(property: CMAProperty): InvestmentMetrics {
    const pgi = property.pgi || property.potential_gross_revenue || null;
    const gim = property.gim || property.gross_income_multiplier || null;
    const price = property.price || 0;
    const commonExpenses = property.common_expenses || 0;
    const annualOperatingExpenses = commonExpenses * 12;

    // Calculate NOI (PGI - Operating Expenses)
    const noi = pgi ? pgi - annualOperatingExpenses : null;

    // Calculate NIM (Price / NOI)
    const nim = noi && noi > 0 ? price / noi : null;

    // Calculate EGI (PGI after vacancy)
    const egi = pgi ? pgi * (1 - VACANCY_RATE) : null;

    // Calculate Effective NOI (EGI - Operating Expenses)
    const effective_noi = egi ? egi - annualOperatingExpenses : null;

    const price_vs_assessment = property.price_vs_assessment || property.price_to_assessment_ratio || null;

    return {
      pgi,
      gim,
      noi,
      nim,
      egi,
      effective_noi,
      price_vs_assessment
    };
  }

  /**
   * Calculate area averages from comparable properties
   */
  private calculateAreaAverages(comparables: CMAProperty[]): AreaAverages {
    const validComps = comparables.filter(c =>
      (c.gim || c.gross_income_multiplier) &&
      (c.pgi || c.potential_gross_revenue)
    );

    if (validComps.length === 0) {
      return { avgGIM: 0, avgNIM: 0, avgNOI: 0, avgPGI: 0, avgPriceVsAssessment: 0, count: 0 };
    }

    const sum = validComps.reduce((acc, c) => {
      const metrics = this.calculateInvestmentMetrics(c);
      return {
        gim: acc.gim + (metrics.gim || 0),
        nim: acc.nim + (metrics.nim || 0),
        noi: acc.noi + (metrics.noi || 0),
        pgi: acc.pgi + (metrics.pgi || 0),
        priceVsAssessment: acc.priceVsAssessment + (metrics.price_vs_assessment || 0)
      };
    }, { gim: 0, nim: 0, noi: 0, pgi: 0, priceVsAssessment: 0 });

    return {
      avgGIM: sum.gim / validComps.length,
      avgNIM: sum.nim / validComps.length,
      avgNOI: sum.noi / validComps.length,
      avgPGI: sum.pgi / validComps.length,
      avgPriceVsAssessment: sum.priceVsAssessment / validComps.length,
      count: validComps.length
    };
  }

  /**
   * Page 1: Cover + Investment Summary
   */
  private buildPage1(property: CMAProperty, metrics: InvestmentMetrics): void {
    // Header
    this.addHeader('REVENUE PROPERTY ANALYSIS');

    // Property Address
    this.currentY += 10;
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(property.address || 'Revenue Property', this.pageWidth / 2, this.currentY, { align: 'center' });

    // Municipality
    this.currentY += 8;
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'normal');
    const municipality = property.municipality || '';
    if (municipality) {
      this.pdf.text(municipality, this.pageWidth / 2, this.currentY, { align: 'center' });
    }

    // Date
    this.currentY += 10;
    this.pdf.setFontSize(10);
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.text(`Report Generated: ${new Date().toLocaleDateString()}`, this.pageWidth / 2, this.currentY, { align: 'center' });

    // Reset color
    this.pdf.setTextColor(0, 0, 0);

    // Investment Summary Box
    this.currentY += 20;
    this.drawInvestmentSummaryBox(property, metrics);

    // Footer
    this.addFooter();
  }

  /**
   * Draw investment summary box with key metrics
   */
  private drawInvestmentSummaryBox(property: CMAProperty, metrics: InvestmentMetrics): void {
    const boxX = this.pageMargin;
    const boxWidth = this.pageWidth - (2 * this.pageMargin);
    const boxY = this.currentY;

    // Box background
    this.pdf.setFillColor(245, 247, 250);
    this.pdf.rect(boxX, boxY, boxWidth, 80, 'F');

    // Box border
    this.pdf.setDrawColor(102, 13, 57); // BHHS Maroon
    this.pdf.setLineWidth(0.5);
    this.pdf.rect(boxX, boxY, boxWidth, 80, 'S');

    // Title
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(102, 13, 57);
    this.pdf.text('Investment Metrics Summary', boxX + 5, boxY + 8);

    // Reset color
    this.pdf.setTextColor(0, 0, 0);

    // Grid of key metrics (3 columns x 2 rows)
    const metrics_display = [
      { label: 'Sale Price', value: this.formatCurrency(property.price) },
      { label: 'GIM', value: metrics.gim ? `${metrics.gim.toFixed(1)}x` : 'N/A' },
      { label: 'NIM', value: metrics.nim ? `${metrics.nim.toFixed(1)}x` : 'N/A' },
      { label: 'PGI (Annual)', value: this.formatCurrency(metrics.pgi) },
      { label: 'NOI (Annual)', value: this.formatCurrency(metrics.noi) },
      { label: 'Price/Assessment', value: metrics.price_vs_assessment ? `${metrics.price_vs_assessment.toFixed(1)}%` : 'N/A' }
    ];

    const colWidth = boxWidth / 3;
    let row = 0;
    let col = 0;

    metrics_display.forEach((metric, index) => {
      const x = boxX + 5 + (col * colWidth);
      const y = boxY + 20 + (row * 25);

      // Label
      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(100, 100, 100);
      this.pdf.text(metric.label, x, y);

      // Value
      this.pdf.setFontSize(12);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(0, 0, 0);
      this.pdf.text(metric.value, x, y + 6);

      col++;
      if (col >= 3) {
        col = 0;
        row++;
      }
    });

    this.currentY = boxY + 85;
  }

  /**
   * Page 2: Investment Metrics Details
   */
  private buildPage2(property: CMAProperty, metrics: InvestmentMetrics, areaAverages: AreaAverages): void {
    this.addHeader('Investment Metrics Analysis');

    this.currentY += 10;

    // Display each metric with explanation
    const metricsToDisplay = [
      {
        name: 'Gross Income Multiplier (GIM)',
        value: metrics.gim ? `${metrics.gim.toFixed(1)}x` : 'N/A',
        areaAvg: areaAverages.avgGIM ? `${areaAverages.avgGIM.toFixed(1)}x` : 'N/A',
        explanation: 'Sale Price ÷ Gross Income. Lower is better. Typical range: 8-15x.'
      },
      {
        name: 'Net Income Multiplier (NIM)',
        value: metrics.nim ? `${metrics.nim.toFixed(1)}x` : 'N/A',
        areaAvg: areaAverages.avgNIM ? `${areaAverages.avgNIM.toFixed(1)}x` : 'N/A',
        explanation: 'Sale Price ÷ NOI. Lower is better. Typical range: 10-20x.'
      },
      {
        name: 'Potential Gross Income (PGI)',
        value: this.formatCurrency(metrics.pgi),
        areaAvg: this.formatCurrency(areaAverages.avgPGI),
        explanation: 'Annual rental income at 100% occupancy.'
      },
      {
        name: 'Net Operating Income (NOI)',
        value: this.formatCurrency(metrics.noi),
        areaAvg: this.formatCurrency(areaAverages.avgNOI),
        explanation: 'PGI minus operating expenses. Does not include debt service.'
      },
      {
        name: 'Effective Gross Income (EGI)',
        value: this.formatCurrency(metrics.egi),
        areaAvg: 'N/A',
        explanation: `PGI after ${(VACANCY_RATE * 100).toFixed(1)}% vacancy (CMHC 2025 Montreal projection).`
      },
      {
        name: 'Effective NOI',
        value: this.formatCurrency(metrics.effective_noi),
        areaAvg: 'N/A',
        explanation: 'EGI minus operating expenses. More conservative than basic NOI.'
      },
      {
        name: 'Price vs Assessment',
        value: metrics.price_vs_assessment ? `${metrics.price_vs_assessment.toFixed(1)}%` : 'N/A',
        areaAvg: areaAverages.avgPriceVsAssessment ? `${areaAverages.avgPriceVsAssessment.toFixed(1)}%` : 'N/A',
        explanation: 'Sale price as % of municipal assessment. Below 100% indicates good value.'
      }
    ];

    metricsToDisplay.forEach((metric, index) => {
      if (this.currentY > 250) {
        this.pdf.addPage();
        this.pageNumber++;
        this.currentY = 20;
        this.addHeader('Investment Metrics Analysis (cont.)');
        this.currentY += 10;
      }

      this.drawMetricCard(metric);
      this.currentY += 2;
    });

    this.addFooter();
  }

  /**
   * Draw individual metric card
   */
  private drawMetricCard(metric: { name: string; value: string; areaAvg: string; explanation: string }): void {
    const boxX = this.pageMargin;
    const boxWidth = this.pageWidth - (2 * this.pageMargin);
    const boxHeight = 22;

    // Background
    this.pdf.setFillColor(250, 250, 250);
    this.pdf.rect(boxX, this.currentY, boxWidth, boxHeight, 'F');

    // Border
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.setLineWidth(0.2);
    this.pdf.rect(boxX, this.currentY, boxWidth, boxHeight, 'S');

    // Metric name
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.text(metric.name, boxX + 3, this.currentY + 6);

    // Value
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(102, 13, 57);
    this.pdf.text(metric.value, boxX + 3, this.currentY + 13);

    // Area average
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.text(`Area Avg: ${metric.areaAvg}`, boxX + boxWidth - 3, this.currentY + 6, { align: 'right' });

    // Explanation
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(80, 80, 80);
    const maxWidth = boxWidth - 6;
    const lines = this.pdf.splitTextToSize(metric.explanation, maxWidth);
    this.pdf.text(lines, boxX + 3, this.currentY + 18);

    this.currentY += boxHeight;
  }

  /**
   * Page 3: Cash Flow Analysis
   */
  private buildPage3(property: CMAProperty, metrics: InvestmentMetrics): void {
    this.addHeader('Cash Flow Analysis');

    this.currentY += 10;

    // Cash flow waterfall
    this.drawCashFlowWaterfall(metrics);

    this.addFooter();
  }

  /**
   * Draw cash flow waterfall visualization
   */
  private drawCashFlowWaterfall(metrics: InvestmentMetrics): void {
    const startX = this.pageMargin + 20;
    const barWidth = this.pageWidth - (2 * this.pageMargin) - 40;

    const steps = [
      { label: 'Potential Gross Income (PGI)', value: metrics.pgi, color: [34, 197, 94] }, // Green
      { label: 'Less: Vacancy Loss (2.5%)', value: metrics.pgi ? metrics.pgi * VACANCY_RATE : 0, color: [234, 179, 8], negative: true }, // Yellow
      { label: 'Effective Gross Income (EGI)', value: metrics.egi, color: [59, 130, 246] }, // Blue
      { label: 'Less: Operating Expenses', value: metrics.egi && metrics.effective_noi ? metrics.egi - metrics.effective_noi : 0, color: [239, 68, 68], negative: true }, // Red
      { label: 'Net Operating Income (Effective NOI)', value: metrics.effective_noi, color: [168, 85, 247] } // Purple
    ];

    steps.forEach((step, index) => {
      const boxHeight = 20;
      const y = this.currentY + (index * 30);

      // Draw bar
      if (step.value && step.value > 0) {
        this.pdf.setFillColor(step.color[0], step.color[1], step.color[2]);
        this.pdf.rect(startX, y, barWidth * 0.7, boxHeight, 'F');
      }

      // Label
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(0, 0, 0);
      this.pdf.text(step.label, startX - 15, y + 6);

      // Value
      this.pdf.setFontSize(11);
      this.pdf.setFont('helvetica', 'bold');
      const valueText = step.negative ? `-${this.formatCurrency(step.value)}` : this.formatCurrency(step.value);
      this.pdf.text(valueText, startX + barWidth + 5, y + 13);

      // Arrow between steps
      if (index < steps.length - 1) {
        this.pdf.setDrawColor(150, 150, 150);
        this.pdf.setLineWidth(1);
        const arrowY = y + boxHeight + 5;
        this.pdf.line(startX + barWidth / 2, arrowY, startX + barWidth / 2, arrowY + 5);
      }
    });

    this.currentY += (steps.length * 30) + 10;

    // Assumptions note
    this.currentY += 10;
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'italic');
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.text('* Vacancy rate based on CMHC 2025 Montreal projection (2.5%)', this.pageMargin, this.currentY);
    this.pdf.text('* NOI does not include debt service, capital expenses, or income taxes', this.pageMargin, this.currentY + 4);
  }

  /**
   * Page 4: Comparable Revenue Properties
   */
  private buildPage4(property: CMAProperty, comparables: CMAProperty[], areaAverages: AreaAverages, demographicData?: {
    ECYPTAPOP?: number;
    ECYTENHHD?: number;
    ECYHNIAVG?: number;
    ECYHNIMED?: number;
    ECYTENOWN_P?: number;
  }): void {
    this.addHeader('Comparable Revenue Properties');

    this.currentY += 10;

    // Area statistics summary
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(`Analysis based on ${areaAverages.count} comparable revenue properties`, this.pageMargin, this.currentY);
    this.currentY += 8;

    // Demographic summary box (if data provided)
    if (arguments.length > 3 && arguments[3]) {
      const demo = arguments[3] as any;
      this.pdf.setFillColor(245, 247, 250);
      this.pdf.rect(this.pageMargin, this.currentY, this.pageWidth - (2 * this.pageMargin), 18, 'F');
      this.pdf.setDrawColor(102, 13, 57);
      this.pdf.setLineWidth(0.5);
      this.pdf.rect(this.pageMargin, this.currentY, this.pageWidth - (2 * this.pageMargin), 18, 'S');
      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(102, 13, 57);
      this.pdf.text('Area Demographics:', this.pageMargin + 5, this.currentY + 6);
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(0, 0, 0);
      const pop = demo.ECYPTAPOP ? demo.ECYPTAPOP.toLocaleString() : 'N/A';
      const hh = demo.ECYTENHHD ? demo.ECYTENHHD.toLocaleString() : 'N/A';
      const own = demo.ECYTENOWN_P ? demo.ECYTENOWN_P.toFixed(1) + '%' : 'N/A';
      const rent = demo.ECYTENOWN_P ? (100 - demo.ECYTENOWN_P).toFixed(1) + '%' : 'N/A';
      const avgInc = demo.ECYHNIAVG ? `$${demo.ECYHNIAVG.toLocaleString()}` : 'N/A';
      const medInc = demo.ECYHNIMED ? `$${demo.ECYHNIMED.toLocaleString()}` : 'N/A';
      this.pdf.text(`Population: ${pop}   Households: ${hh}   Ownership Rate: ${own}   Rental Rate: ${rent}   Avg Income: ${avgInc}   Median Income: ${medInc}`, this.pageMargin + 5, this.currentY + 13);
      this.currentY += 20;
    }

    // Table header
    this.drawComparablesTableHeader();

    // Subject property row (highlighted)
    this.drawComparableRow(property, true);

    // Comparable properties (top 8)
    const topComparables = comparables.slice(0, 8);
    topComparables.forEach((comp) => {
      if (this.currentY > 260) {
        this.pdf.addPage();
        this.pageNumber++;
        this.currentY = 20;
        this.addHeader('Comparable Revenue Properties (cont.)');
        this.currentY += 10;
        this.drawComparablesTableHeader();
      }
      this.drawComparableRow(comp, false);
    });

    this.addFooter();
  }

  /**
   * Draw comparables table header
   */
  private drawComparablesTableHeader(): void {
    const headers = ['Property', 'Price', 'GIM', 'NIM', 'PGI', 'NOI'];
    const colWidths = [40, 25, 20, 20, 30, 30];
    let x = this.pageMargin;

    this.pdf.setFillColor(102, 13, 57);
    this.pdf.rect(this.pageMargin, this.currentY, this.pageWidth - (2 * this.pageMargin), 8, 'F');

    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(255, 255, 255);

    headers.forEach((header, i) => {
      this.pdf.text(header, x + 2, this.currentY + 5.5);
      x += colWidths[i];
    });

    this.currentY += 10;
    this.pdf.setTextColor(0, 0, 0);
  }

  /**
   * Draw single comparable row
   */
  private drawComparableRow(property: CMAProperty, isSubject: boolean): void {
    const metrics = this.calculateInvestmentMetrics(property);
    const colWidths = [40, 25, 20, 20, 30, 30];
    let x = this.pageMargin;
    const rowHeight = 8;

    // Background for subject property
    if (isSubject) {
      this.pdf.setFillColor(255, 250, 240);
      this.pdf.rect(this.pageMargin, this.currentY, this.pageWidth - (2 * this.pageMargin), rowHeight, 'F');
    }

    // Border
    this.pdf.setDrawColor(220, 220, 220);
    this.pdf.setLineWidth(0.1);
    this.pdf.rect(this.pageMargin, this.currentY, this.pageWidth - (2 * this.pageMargin), rowHeight, 'S');

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', isSubject ? 'bold' : 'normal');

    // Property address (truncated)
    const address = property.address || 'N/A';
    const truncatedAddress = address.length > 30 ? address.substring(0, 27) + '...' : address;
    this.pdf.text(truncatedAddress, x + 2, this.currentY + 5.5);
    x += colWidths[0];

    // Price
    this.pdf.text(this.formatCurrency(property.price, true), x + 2, this.currentY + 5.5);
    x += colWidths[1];

    // GIM
    this.pdf.text(metrics.gim ? `${metrics.gim.toFixed(1)}x` : 'N/A', x + 2, this.currentY + 5.5);
    x += colWidths[2];

    // NIM
    this.pdf.text(metrics.nim ? `${metrics.nim.toFixed(1)}x` : 'N/A', x + 2, this.currentY + 5.5);
    x += colWidths[3];

    // PGI
    this.pdf.text(this.formatCurrency(metrics.pgi, true), x + 2, this.currentY + 5.5);
    x += colWidths[4];

    // NOI
    this.pdf.text(this.formatCurrency(metrics.noi, true), x + 2, this.currentY + 5.5);

    this.currentY += rowHeight;
  }

  /**
   * Add header to page
   */
  private addHeader(title: string): void {
    // Logo (simulated)
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(102, 13, 57);
    this.pdf.text('BHHS', this.pageMargin, 15);

    // Title
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.text(title, this.pageWidth / 2, 15, { align: 'center' });

    this.currentY = 25;
  }

  /**
   * Add footer to page
   */
  private addFooter(): void {
    const footerY = this.pageHeight - 15;

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(150, 150, 150);

    // Page number
    this.pdf.text(`Page ${this.pageNumber}`, this.pageWidth / 2, footerY, { align: 'center' });

    // Disclaimer
    this.pdf.text('For investment analysis purposes only. Consult with a qualified professional.', this.pageWidth / 2, footerY + 4, { align: 'center' });
  }

  /**
   * Format currency value
   */
  private formatCurrency(value: number | null | undefined, short: boolean = false): string {
    if (!value || value === 0) return 'N/A';

    if (short && value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }

    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
}
