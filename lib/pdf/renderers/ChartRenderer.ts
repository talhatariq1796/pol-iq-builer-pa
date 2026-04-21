import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';

/**
 * Professional chart rendering for CMA PDF reports
 * Renders charts server-side at 300 DPI using Chart.js
 */
export class ChartRenderer {
  private canvas: ChartJSNodeCanvas;

  // BHHS Brand Colors - Burgundy Variations (like reference uses blue variations)
  private readonly colors = {
    primary: '#D1A0C7',      // Light burgundy tint - primary charts
    secondary: '#A8668A',    // Medium burgundy - secondary series
    tertiary: '#8B1538',     // Regular burgundy - tertiary series
    accent1: '#670338',      // Base burgundy - accents only
    accent2: '#C8A882',      // Gold - complementary
    accent3: '#F5E6EE',      // Lightest burgundy - backgrounds
    success: '#5AA454',      // Green (positive)
    warning: '#F7A800',      // Amber (neutral)
    danger: '#C44E52',       // Red (negative)
    neutral: '#BDBDBD',      // Gray
  };

  constructor(width: number = 800, height: number = 600) {
    this.canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: 'white',
    });
  }

  /**
   * Render line chart (price trends, DOM trends)
   */
  async renderLineChart(
    labels: string[],
    datasets: Array<{
      label: string;
      data: number[];
      color?: string;
      borderWidth?: number;
    }>
  ): Promise<Buffer> {
    const configuration: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((ds, idx) => ({
          label: ds.label,
          data: ds.data,
          borderColor: ds.color || this.getColorByIndex(idx),
          backgroundColor: this.addAlpha(ds.color || this.getColorByIndex(idx), 0.2),  // Area fill with gradient
          borderWidth: ds.borderWidth || 2,  // Thinner lines (like reference)
          fill: true,  // Enable area chart fills
          tension: 0.4,  // Smooth curves
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#FFFFFF',
          pointBorderColor: ds.color || this.getColorByIndex(idx),
          pointBorderWidth: 2,
          pointHoverBackgroundColor: ds.color || this.getColorByIndex(idx),
          pointHoverBorderColor: '#FFFFFF',
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                size: 12,
                family: 'Arial',
                weight: 'bold',
              },
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#EBEBEB',  // Light grey grid
              lineWidth: 1,
            },
            ticks: {
              font: {
                size: 11,
                family: 'Arial',
              },
              padding: 8,
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 11,
                family: 'Arial',
              },
              padding: 8,
            },
          },
        },
      },
    };

    return await this.canvas.renderToBuffer(configuration);
  }

  /**
   * Render bar chart (seasonal patterns, price distribution)
   */
  async renderBarChart(
    labels: string[],
    data: number[],
    colors?: string[]
  ): Promise<Buffer> {
    const backgroundColor = colors || data.map((_, idx) => this.getColorByIndex(idx));

    const configuration: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Value',
          data,
          backgroundColor: backgroundColor.map(c => this.addAlpha(c, 0.9)),
          borderColor: backgroundColor,
          borderWidth: 0,
          borderRadius: 8,  // More rounded corners (like reference)
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#EBEBEB',  // Light grey grid
              lineWidth: 1,
            },
            ticks: {
              font: {
                size: 11,
                family: 'Arial',
              },
              padding: 8,
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 11,
                family: 'Arial',
                weight: 'bold',
              },
              padding: 8,
            },
          },
        },
      },
    };

    return await this.canvas.renderToBuffer(configuration);
  }

  /**
   * Render donut chart (property status distribution)
   */
  async renderDonutChart(
    labels: string[],
    data: number[],
    centerText?: { value: string; label: string }
  ): Promise<Buffer> {
    const backgroundColor = data.map((_, idx) => this.getColorByIndex(idx));

    const configuration: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColor.map(c => this.addAlpha(c, 0.9)),
          borderColor: '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              font: {
                size: 12,
                family: 'Arial',
                weight: 'bold',
              },
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle',
              generateLabels: (chart: any) => {
                const datasets = chart.data.datasets;
                return chart.data.labels?.map((label: any, i: number) => {
                  const value = datasets[0].data[i] as number;
                  const total = (datasets[0].data as number[]).reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return {
                    text: `${label} (${percentage}%)`,
                    fillStyle: backgroundColor[i],
                    hidden: false,
                    index: i,
                  };
                }) || [];
              },
            },
          },
        },
        cutout: '65%',
      } as any,
    };

    return await this.canvas.renderToBuffer(configuration);
  }

  /**
   * Render scatter plot (price vs features)
   */
  async renderScatterChart(
    datasets: Array<{
      label: string;
      data: Array<{ x: number; y: number }>;
      color?: string;
      size?: number;
    }>
  ): Promise<Buffer> {
    const configuration: ChartConfiguration = {
      type: 'scatter',
      data: {
        datasets: datasets.map((ds, idx) => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: ds.color || this.getColorByIndex(idx),
          borderColor: ds.color || this.getColorByIndex(idx),
          pointRadius: ds.size || 5,
          pointHoverRadius: ds.size ? ds.size + 2 : 7,
        })),
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#EBEBEB',  // Light grey grid
            },
          },
          x: {
            grid: {
              color: '#EBEBEB',  // Light grey grid
            },
          },
        },
      },
    };

    return await this.canvas.renderToBuffer(configuration);
  }

  /**
   * Helper: Get color by index from color palette
   * Uses burgundy variations (like reference uses blue variations)
   */
  private getColorByIndex(index: number): string {
    const colorArray = [
      this.colors.primary,    // Light burgundy tint
      this.colors.secondary,  // Medium burgundy
      this.colors.tertiary,   // Lighter burgundy tint
      this.colors.accent2,    // Gold complementary
      this.colors.neutral,    // Gray
      this.colors.accent1,    // Base burgundy (minimal use)
    ];
    return colorArray[index % colorArray.length];
  }

  /**
   * Helper: Add alpha transparency to hex color
   */
  private addAlpha(hex: string, alpha: number): string {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
