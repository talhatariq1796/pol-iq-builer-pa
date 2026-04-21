/**
 * Time-Series Data Processor
 * Handles temporal data standardization, aggregation, and analysis
 */

export interface TimeSeriesDataPoint {
  date: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface AggregatedData {
  period: string; // ISO date string
  count: number;
  sum: number;
  average: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
}

export interface SeasonalAdjustment {
  original: number;
  adjusted: number;
  seasonalFactor: number;
}

export interface YearOverYearComparison {
  currentPeriod: string;
  currentValue: number;
  priorYearValue: number;
  absoluteChange: number;
  percentChange: number;
}

export interface TrendAnalysis {
  slope: number;
  intercept: number;
  rSquared: number;
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: 'strong' | 'moderate' | 'weak';
}

export class TimeSeriesProcessor {
  /**
   * Standardize date fields from various formats
   */
  public standardizeDateField(
    data: Record<string, unknown>[],
    dateFields: string[] = ['date_bc', 'listing_date', 'sold_date', 'date']
  ): TimeSeriesDataPoint[] {
    const result: TimeSeriesDataPoint[] = [];

    for (const record of data) {
      // Find first valid date field
      let dateValue: Date | null = null;

      for (const field of dateFields) {
        const value = record[field];
        if (value) {
          dateValue = this.parseDate(value);
          if (dateValue) break;
        }
      }

      if (!dateValue) {
        continue; // Skip records without valid dates
      }

      // Extract numeric value (price, count, etc.)
      const value = this.extractNumericValue(record);
      if (value === null) continue;

      result.push({
        date: dateValue,
        value,
        metadata: record
      });
    }

    // Sort by date
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Aggregate data by month
   */
  public aggregateByMonth(
    data: TimeSeriesDataPoint[],
    valueField: string = 'value'
  ): AggregatedData[] {
    const monthlyGroups = this.groupByPeriod(data, 'month');
    return this.calculateAggregations(monthlyGroups);
  }

  /**
   * Aggregate data by quarter
   */
  public aggregateByQuarter(
    data: TimeSeriesDataPoint[],
    valueField: string = 'value'
  ): AggregatedData[] {
    const quarterlyGroups = this.groupByPeriod(data, 'quarter');
    return this.calculateAggregations(quarterlyGroups);
  }

  /**
   * Aggregate data by year
   */
  public aggregateByYear(
    data: TimeSeriesDataPoint[],
    valueField: string = 'value'
  ): AggregatedData[] {
    const yearlyGroups = this.groupByPeriod(data, 'year');
    return this.calculateAggregations(yearlyGroups);
  }

  /**
   * Calculate year-over-year comparisons
   */
  public calculateYearOverYear(
    data: TimeSeriesDataPoint[],
    periodType: 'month' | 'quarter' = 'month'
  ): YearOverYearComparison[] {
    const aggregated = periodType === 'month'
      ? this.aggregateByMonth(data)
      : this.aggregateByQuarter(data);

    const comparisons: YearOverYearComparison[] = [];

    for (const current of aggregated) {
      const currentDate = new Date(current.period);
      const priorYear = new Date(currentDate);
      priorYear.setFullYear(priorYear.getFullYear() - 1);

      const priorPeriodStr = this.formatPeriod(priorYear, periodType);
      const priorPeriod = aggregated.find(a => a.period === priorPeriodStr);

      if (priorPeriod) {
        const absoluteChange = current.average - priorPeriod.average;
        const percentChange = priorPeriod.average !== 0
          ? (absoluteChange / priorPeriod.average) * 100
          : 0;

        comparisons.push({
          currentPeriod: current.period,
          currentValue: current.average,
          priorYearValue: priorPeriod.average,
          absoluteChange,
          percentChange
        });
      }
    }

    return comparisons;
  }

  /**
   * Apply seasonal adjustment to data
   */
  public applySeasonalAdjustment(
    data: TimeSeriesDataPoint[],
    seasonalFactors?: Record<number, number>
  ): SeasonalAdjustment[] {
    // Calculate seasonal factors if not provided
    const factors = seasonalFactors || this.calculateSeasonalFactors(data);

    const adjustments: SeasonalAdjustment[] = [];

    for (const point of data) {
      const month = point.date.getMonth() + 1; // 1-12
      const seasonalFactor = factors[month] || 1.0;
      const adjusted = point.value / seasonalFactor;

      adjustments.push({
        original: point.value,
        adjusted,
        seasonalFactor
      });
    }

    return adjustments;
  }

  /**
   * Calculate seasonal factors from historical data
   */
  public calculateSeasonalFactors(
    data: TimeSeriesDataPoint[]
  ): Record<number, number> {
    // Group by month
    const monthlyData: Record<number, number[]> = {};

    for (const point of data) {
      const month = point.date.getMonth() + 1; // 1-12
      if (!monthlyData[month]) {
        monthlyData[month] = [];
      }
      monthlyData[month].push(point.value);
    }

    // Calculate average for each month
    const monthlyAverages: Record<number, number> = {};
    for (const month in monthlyData) {
      const values = monthlyData[month];
      monthlyAverages[month] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    // Calculate overall average
    const overallAverage = Object.values(monthlyAverages).reduce((a, b) => a + b, 0)
      / Object.keys(monthlyAverages).length;

    // Calculate seasonal factors (ratio to overall average)
    const seasonalFactors: Record<number, number> = {};
    for (const month in monthlyAverages) {
      seasonalFactors[month] = overallAverage > 0
        ? monthlyAverages[month] / overallAverage
        : 1.0;
    }

    // Fill in missing months with 1.0
    for (let month = 1; month <= 12; month++) {
      if (!seasonalFactors[month]) {
        seasonalFactors[month] = 1.0;
      }
    }

    return seasonalFactors;
  }

  /**
   * Analyze trend using linear regression
   */
  public analyzeTrend(data: TimeSeriesDataPoint[]): TrendAnalysis {
    if (data.length < 2) {
      return {
        slope: 0,
        intercept: 0,
        rSquared: 0,
        direction: 'stable',
        strength: 'weak'
      };
    }

    const n = data.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = data.map(d => d.value);

    // Calculate means
    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    // Calculate slope and intercept
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) * (xValues[i] - xMean);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Calculate R-squared
    let ssRes = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const predicted = slope * xValues[i] + intercept;
      ssRes += Math.pow(yValues[i] - predicted, 2);
      ssTot += Math.pow(yValues[i] - yMean, 2);
    }

    const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

    // Determine direction
    let direction: TrendAnalysis['direction'];
    if (Math.abs(slope) < yMean * 0.01) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    // Determine strength based on R-squared
    let strength: TrendAnalysis['strength'];
    if (rSquared > 0.7) {
      strength = 'strong';
    } else if (rSquared > 0.4) {
      strength = 'moderate';
    } else {
      strength = 'weak';
    }

    return {
      slope,
      intercept,
      rSquared,
      direction,
      strength
    };
  }

  /**
   * Calculate moving average
   */
  public calculateMovingAverage(
    data: TimeSeriesDataPoint[],
    windowSize: number = 3
  ): TimeSeriesDataPoint[] {
    if (windowSize < 1 || windowSize > data.length) {
      return data;
    }

    const result: TimeSeriesDataPoint[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, start + windowSize);
      const window = data.slice(start, end);

      const average = window.reduce((sum, point) => sum + point.value, 0) / window.length;

      result.push({
        date: data[i].date,
        value: average,
        metadata: data[i].metadata
      });
    }

    return result;
  }

  /**
   * Detect outliers using IQR method
   */
  public detectOutliers(
    data: TimeSeriesDataPoint[],
    multiplier: number = 1.5
  ): { outliers: TimeSeriesDataPoint[]; cleaned: TimeSeriesDataPoint[] } {
    const values = data.map(d => d.value).sort((a, b) => a - b);
    const q1Index = Math.floor(values.length * 0.25);
    const q3Index = Math.floor(values.length * 0.75);

    const q1 = values[q1Index];
    const q3 = values[q3Index];
    const iqr = q3 - q1;

    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;

    const outliers: TimeSeriesDataPoint[] = [];
    const cleaned: TimeSeriesDataPoint[] = [];

    for (const point of data) {
      if (point.value < lowerBound || point.value > upperBound) {
        outliers.push(point);
      } else {
        cleaned.push(point);
      }
    }

    return { outliers, cleaned };
  }

  /**
   * Interpolate missing data points
   */
  public interpolateMissing(
    data: TimeSeriesDataPoint[],
    frequency: 'daily' | 'monthly' = 'monthly'
  ): TimeSeriesDataPoint[] {
    if (data.length < 2) return data;

    const sorted = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
    const result: TimeSeriesDataPoint[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];

      // Check for gap
      const expectedNext = new Date(previous.date);
      if (frequency === 'monthly') {
        expectedNext.setMonth(expectedNext.getMonth() + 1);
      } else {
        expectedNext.setDate(expectedNext.getDate() + 1);
      }

      // Fill gaps with linear interpolation
      while (expectedNext < current.date) {
        const ratio = (expectedNext.getTime() - previous.date.getTime()) /
                     (current.date.getTime() - previous.date.getTime());
        const interpolatedValue = previous.value + (current.value - previous.value) * ratio;

        result.push({
          date: new Date(expectedNext),
          value: interpolatedValue,
          metadata: { interpolated: true }
        });

        if (frequency === 'monthly') {
          expectedNext.setMonth(expectedNext.getMonth() + 1);
        } else {
          expectedNext.setDate(expectedNext.getDate() + 1);
        }
      }

      result.push(current);
    }

    return result;
  }

  // Helper methods

  private parseDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  private extractNumericValue(record: Record<string, unknown>): number | null {
    // Try common numeric fields
    const numericFields = [
      'value', 'price', 'amount', 'count', 'sold_price',
      'list_price', 'close_price', 'avg_price', 'median_price'
    ];

    for (const field of numericFields) {
      const value = record[field];
      if (typeof value === 'number' && !isNaN(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return null;
  }

  private groupByPeriod(
    data: TimeSeriesDataPoint[],
    periodType: 'month' | 'quarter' | 'year'
  ): Map<string, TimeSeriesDataPoint[]> {
    const groups = new Map<string, TimeSeriesDataPoint[]>();

    for (const point of data) {
      const periodKey = this.formatPeriod(point.date, periodType);

      if (!groups.has(periodKey)) {
        groups.set(periodKey, []);
      }
      groups.get(periodKey)!.push(point);
    }

    return groups;
  }

  private formatPeriod(
    date: Date,
    periodType: 'month' | 'quarter' | 'year'
  ): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (periodType === 'year') {
      return `${year}`;
    } else if (periodType === 'quarter') {
      const quarter = Math.ceil(month / 3);
      return `${year}-Q${quarter}`;
    } else {
      return `${year}-${month.toString().padStart(2, '0')}`;
    }
  }

  private calculateAggregations(
    groups: Map<string, TimeSeriesDataPoint[]>
  ): AggregatedData[] {
    const result: AggregatedData[] = [];

    for (const [period, points] of groups.entries()) {
      const values = points.map(p => p.value);
      const sortedValues = [...values].sort((a, b) => a - b);

      const sum = values.reduce((a, b) => a + b, 0);
      const average = sum / values.length;
      const median = this.calculateMedian(sortedValues);
      const min = sortedValues[0];
      const max = sortedValues[sortedValues.length - 1];
      const stdDev = this.calculateStdDev(values, average);

      result.push({
        period,
        count: points.length,
        sum,
        average,
        median,
        min,
        max,
        stdDev
      });
    }

    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  private calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);

    if (sortedValues.length % 2 === 0) {
      return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    } else {
      return sortedValues[mid];
    }
  }

  private calculateStdDev(values: number[], mean: number): number {
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}
