/* eslint-disable @typescript-eslint/no-explicit-any */
import { RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../types';
import { extractFeatureId } from '../utils/spatialFilter';

export type DetailViewBuildOptions = {
  endpoint: string;
  drilldownKey?: string;
  limit?: number;
  targetVariable?: string;
};

const DEFAULT_LIMIT = 250;

export class GenericDetailViewBuilder {
  static tryBuild(rawResults: RawAnalysisResult, options: DetailViewBuildOptions): ProcessedAnalysisData | null {
    const records = Array.isArray(rawResults?.results) ? rawResults.results : [];
    if (records.length === 0) {
      return null;
    }

    const targetVariable = options.targetVariable || (rawResults as any)?.metadata?.targetVariable || (rawResults as any)?.model_info?.target_variable || 'value';

    const normalizedKey = options.drilldownKey ? String(options.drilldownKey).trim().toUpperCase() : undefined;
    const filtered = normalizedKey ? this.filterByDrilldownKey(records, normalizedKey) : records;
    const limited = filtered.slice(0, Math.min(filtered.length, options.limit ?? DEFAULT_LIMIT));

    if (limited.length === 0) {
      return null;
    }

    const detailRecords: GeographicDataPoint[] = limited
      .map((feature, index) => this.toGeographicDataPoint(feature, index, targetVariable))
      .filter((point): point is GeographicDataPoint => point !== null);

    if (detailRecords.length === 0) {
      return null;
    }

    const stats = this.calculateStatistics(detailRecords.map((record) => record.value));
    const label = this.normalizeEndpointLabel(options.endpoint);

    const summaryParts: string[] = [
      `**${label} Detail View:** ${detailRecords.length} records returned.${filtered.length > limited.length ? ` Showing first ${detailRecords.length}.` : ''}`
    ];
    if (normalizedKey) {
      summaryParts.push(`Filtered by key: ${normalizedKey}.`);
    }
    summaryParts.push('Includes raw attributes for record-level inspection.');

    return {
      type: label,
      records: detailRecords,
      totalRecords: detailRecords.length,
      summary: summaryParts.join(' '),
      featureImportance: [],
      statistics: stats,
      targetVariable,
      metadata: {
        detailSource: 'generic_detail_builder',
        drilldownKey: options.drilldownKey,
        viewMode: 'detail'
      },
      supportsDrilldown: false
    };
  }

  private static filterByDrilldownKey(records: any[], normalizedKey: string): any[] {
    const keyUpper = normalizedKey.toUpperCase();
    return records.filter((record) => {
      const props = this.extractProperties(record);
      const candidateValues: (string | null | undefined)[] = [
        extractFeatureId(record),
        props.market_identifier,
        props.marketIdentifier,
        props.market_id,
        props.area_id,
        props.areaId,
        props.id,
        props.ID,
        props.MARKET_ID,
        props.fsa_code,
        props.postal_code,
        props.postalCode,
        props.zip,
        props.ZIP,
        props.municipality,
        props.city,
        props.community,
        props.DESCRIPTION,
        props.area_name,
        props.name
      ];

      for (const value of candidateValues) {
        if (!value) continue;
        const candidate = String(value).trim().toUpperCase();
        if (!candidate) continue;
        if (candidate === keyUpper) return true;
        if (candidate.includes(keyUpper)) return true;
      }
      return false;
    });
  }

  private static toGeographicDataPoint(feature: any, index: number, targetVariable: string): GeographicDataPoint | null {
    const props = this.extractProperties(feature);
    const value = this.extractNumericValue(feature, props, targetVariable);
    const areaId = extractFeatureId(feature) || this.extractFirstString(props, ['market_identifier', 'area_id', 'id', 'ID', 'postal_code', 'fsa_code']) || `detail_${index}`;
    const areaName = this.extractFirstString(props, ['address', 'display_address', 'formatted_address', 'area_name', 'DESCRIPTION', 'name', 'municipality', 'city']) || `Record ${index + 1}`;

    const geometry = feature?.geometry && typeof feature.geometry === 'object' ? feature.geometry : undefined;
    const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates.slice(0, 2) as [number, number] : undefined;

    return {
      area_id: String(areaId),
      area_name: areaName,
      value,
      rank: index + 1,
      coordinates,
      geometry,
      properties: {
        ...props,
        detail_source: props?.detail_source || 'raw_record',
        target_variable: targetVariable
      },
      shapValues: {}
    };
  }

  private static extractProperties(feature: any): Record<string, any> {
    if (!feature || typeof feature !== 'object') {
      return {};
    }

    const level1 = (feature as any).properties ?? feature;
    if (level1 && typeof level1 === 'object' && (level1 as any).properties) {
      return { ...(level1 as any).properties };
    }

    return { ...level1 };
  }

  private static extractFirstString(props: Record<string, any>, keys: string[]): string | null {
    for (const key of keys) {
      const value = props[key];
      if (value === undefined || value === null) continue;
      const candidate = String(value).trim();
      if (candidate.length > 0) {
        return candidate;
      }
    }
    return null;
  }

  private static extractNumericValue(feature: any, props: Record<string, any>, targetVariable: string): number {
    const candidates = [
      props[targetVariable],
      props.strategic_score,
      props.brand_difference_score,
      props.competitive_score,
      props.market_score,
      props.demographic_score,
      props.trend_score,
      props.risk_score,
      props.score,
      props.value,
      feature?.value,
      feature?.score
    ];

    for (const candidate of candidates) {
      const numeric = Number(candidate);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    // Fallback: find first numeric property
    for (const value of Object.values(props)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    return 0;
  }

  private static calculateStatistics(values: number[]): AnalysisStatistics {
    const finiteValues = values.filter((value) => Number.isFinite(value));
    if (finiteValues.length === 0) {
      return {
        total: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        stdDev: 0
      };
    }

    const sorted = [...finiteValues].sort((a, b) => a - b);
    const total = sorted.length;
    const sum = sorted.reduce((acc, value) => acc + value, 0);
    const mean = sum / total;
    const median = total % 2 === 0 ? (sorted[total / 2 - 1] + sorted[total / 2]) / 2 : sorted[Math.floor(total / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const variance = sorted.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);

    return {
      total,
      mean,
      median,
      min,
      max,
      stdDev
    };
  }

  private static normalizeEndpointLabel(endpoint: string): string {
    if (!endpoint) return 'detail';
    const stripped = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return stripped.replace(/[-]/g, '_');
  }
}
