/**
 * Resolve FilterHandler-style criteria to precinct IDs using the same SegmentEngine path as /api/segments.
 */
import { SegmentEngine } from '@/lib/segmentation';
import {
  buildSegmentFiltersFromFilterCriteria,
  hasAnySegmentFilters,
  normalizeFilterMetric,
} from '@/lib/segmentation/buildSegmentFiltersFromFilterCriteria';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

export async function getPrecinctIdsForFilterCriteria(filterCriteria: any): Promise<string[]> {
  const fc = { ...filterCriteria };
  fc.metric = normalizeFilterMetric(fc.metric);
  const filters = buildSegmentFiltersFromFilterCriteria(fc);
  if (!hasAnySegmentFilters(filters)) {
    return [];
  }
  await politicalDataService.initialize();
  const precincts = await politicalDataService.getSegmentEnginePrecincts();
  const engine = new SegmentEngine(precincts as any);
  const results = engine.query(filters);
  return results.matchingPrecincts.map((p) => p.precinctId);
}
