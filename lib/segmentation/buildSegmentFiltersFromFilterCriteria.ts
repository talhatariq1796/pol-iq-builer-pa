/**
 * Shared: NLP filter criteria (FilterHandler) → SegmentEngine filters.
 * Used by workflow handleFilterRequest and political CSV export ID resolution.
 */
import type { SegmentFilters } from '@/lib/segmentation/types';

/** Map FilterHandler short metric keys to SegmentEngine / API names */
export function normalizeFilterMetric(metric: string | undefined): string | undefined {
  if (!metric) return undefined;
  const aliases: Record<string, string> = {
    gotv: 'gotv_priority',
    swing: 'swing_potential',
    persuasion: 'persuasion_opportunity',
    combined: 'combined_score',
  };
  return aliases[metric] ?? metric;
}

export function hasAnySegmentFilters(filters: SegmentFilters): boolean {
  return (
    (filters.political && Object.keys(filters.political).length > 0) ||
    (filters.targeting && Object.keys(filters.targeting).length > 0) ||
    (filters.demographics && Object.keys(filters.demographics).length > 0) ||
    (filters.demographic && Object.keys(filters.demographic).length > 0) ||
    (filters.electionHistory && Object.keys(filters.electionHistory).length > 0) ||
    (filters.engagement && Object.keys(filters.engagement).length > 0) ||
    false
  );
}

/**
 * Build SegmentFilters from FilterHandler criteria (same rules as handleFilterRequest).
 */
export function buildSegmentFiltersFromFilterCriteria(filterCriteria: any): SegmentFilters {
  const filters: SegmentFilters = {};

  if (
    filterCriteria.composite === 'gotv_high_turnout_low' ||
    (filterCriteria.metric === 'gotv_priority' &&
      filterCriteria.max_turnout != null &&
      typeof filterCriteria.max_turnout === 'number')
  ) {
    filters.targeting = {
      min_gotv_priority: filterCriteria.min_gotv_priority ?? filterCriteria.threshold ?? 60,
      max_turnout: filterCriteria.max_turnout,
    };
  } else if (filterCriteria.metric === 'swing_potential') {
    filters.targeting = {
      min_swing_potential: filterCriteria.threshold || 60,
    };
  } else if (filterCriteria.metric === 'margin') {
    if (
      filterCriteria.marginMode === 'presidential_margin' &&
      typeof filterCriteria.threshold === 'number'
    ) {
      const t = Math.min(50, Math.max(0, filterCriteria.threshold));
      filters.electionHistory = {
        presidentialMarginAbsLt: t,
      };
    } else {
      filters.political = {
        competitiveness: ['toss_up', 'lean_d', 'lean_r'],
      };
    }
  } else if (filterCriteria.metric === 'turnout') {
    filters.targeting = {
      min_turnout: filterCriteria.threshold || 60,
    };
  } else if (filterCriteria.metric === 'gotv_priority') {
    filters.targeting = {
      min_gotv_priority: filterCriteria.threshold ?? 50,
    };
  } else if (filterCriteria.metric === 'persuasion_opportunity') {
    filters.targeting = {
      min_persuasion: filterCriteria.threshold || 60,
    };
  } else if (filterCriteria.metric === 'partisan_lean') {
    const rng = filterCriteria.partisanLeanRange as [number, number] | undefined;
    if (
      Array.isArray(rng) &&
      rng.length === 2 &&
      typeof rng[0] === 'number' &&
      typeof rng[1] === 'number' &&
      !Number.isNaN(rng[0]) &&
      !Number.isNaN(rng[1])
    ) {
      const lo = Math.min(rng[0], rng[1]);
      const hi = Math.max(rng[0], rng[1]);
      filters.political = {
        partisanLeanRange: [lo, hi],
      };
    }
  }

  if (
    filterCriteria.competitiveness?.length &&
    (!filters.political || filterCriteria.metric === undefined)
  ) {
    filters.political = {
      ...(filters.political || {}),
      competitiveness: filterCriteria.competitiveness,
    };
  }

  return filters;
}
