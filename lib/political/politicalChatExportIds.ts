/**
 * Deterministic precinct ID lists for political chat + CSV export (same logic as /api/political-chat).
 */
import { extractFilterCriteriaFromUserQuery } from '@/lib/ai-native/handlers/FilterHandler';
import { politicalQueryRouter, type ParsedPoliticalQuery } from '@/lib/analysis/PoliticalQueryRouter';
import {
  wantsCanvassingEfficiencyQuery,
  wantsElectionShiftQuery,
  wantsTurnoutTrendQuery,
} from '@/lib/political/politicalChatQueryFlags';
import { getPrecinctIdsForFilterCriteria } from '@/lib/political/resolveFilterCriteriaToPrecinctIds';
import {
  politicalDataService,
  type PrecinctRankingMetric,
} from '@/lib/services/PoliticalDataService';

function marginAtPrecinctYear(p: Record<string, unknown>, year: number): number | null {
  const elections = p.elections as Record<string, { margin?: number }> | undefined;
  const row = elections?.[String(year)];
  if (row && typeof row.margin === 'number' && !Number.isNaN(row.margin)) {
    return row.margin;
  }
  return null;
}

/**
 * Deterministic precinct ID list for the current NL query so CSV export can match the assistant's
 * filtered counts (not the full statewide file). Skips short "export only" follow-up messages.
 */
export async function collectDataPrecinctIdsForQuery(
  parsed: ParsedPoliticalQuery,
  userQuery: string,
): Promise<string[] | undefined> {
  const q = userQuery.trim();
  const ql = q.toLowerCase();

  if (
    /^(export|download|save)\b/i.test(q) &&
    q.length < 200 &&
    !/\b(show|find|list|which|where|margin|swing|lean|top\s+\d+)\b/i.test(ql)
  ) {
    return undefined;
  }

  try {
    await politicalDataService.initialize();

    // Modeled partisan lean band — same rule as FilterHandler + SegmentEngine (not presidential margin).
    const leanBetween =
      ql.match(
        /\bpartisan\s+lean\s+(?:between|from)\s+(-?\d+(?:\.\d+)?)\s+and\s+(?:\+)?(-?\d+(?:\.\d+)?)/i
      ) ||
      ql.match(
        /\b(?:between|from)\s+(-?\d+(?:\.\d+)?)\s+and\s+(?:\+)?(-?\d+(?:\.\d+)?)\s+partisan\s+lean\b/i
      );
    if (leanBetween) {
      const a = parseFloat(leanBetween[1]);
      const b = parseFloat(leanBetween[2]);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const ids = await politicalDataService.filterPrecincts({
        partisanLeanMin: lo,
        partisanLeanMax: hi,
      });
      if (ids.length > 0) {
        return ids;
      }
    }

    const leanPlusMinus = ql.match(
      /\bpartisan\s+lean\s+(?:within|of)\s*±\s*(\d+(?:\.\d+)?)\s*(?:points?)?\b/i
    );
    if (leanPlusMinus) {
      const t = Math.min(50, Math.abs(parseFloat(leanPlusMinus[1])));
      const ids = await politicalDataService.filterPrecincts({
        partisanLeanMin: -t,
        partisanLeanMax: t,
      });
      if (ids.length > 0) {
        return ids;
      }
    }

    const marginPctMatch =
      ql.match(/\bmargin\s*(?:less\s*than|under|<)\s*(\d+(?:\.\d+)?)\s*%?/i) ||
      ql.match(/\b(?:less|under)\s*than\s*(\d+(?:\.\d+)?)\s*%?\s*(?:margin|pp|points)?/i) ||
      ql.match(/\bwithin\s*(\d+(?:\.\d+)?)\s*%?\s*(?:of\s*(?:a\s*)?tie|margin)?/i);

    const asksSwingWithMargin =
      /\b(swing|competitive|toss|battle|narrow|close)\b/i.test(q) && /\bmargin\b/i.test(ql);

    if (marginPctMatch || asksSwingWithMargin) {
      const threshold = marginPctMatch ? Math.min(50, parseFloat(marginPctMatch[1])) : 5;
      const data = await politicalDataService.getPrecinctDataFileFormat();
      const ids: string[] = [];
      for (const [canonicalKey, raw] of Object.entries(data.precincts)) {
        const p = raw as Record<string, unknown>;
        const m = marginAtPrecinctYear(p, 2024) ?? marginAtPrecinctYear(p, 2020);
        if (m == null || Number.isNaN(m)) continue;
        if (Math.abs(m) < threshold) {
          ids.push(canonicalKey);
        }
      }
      if (ids.length > 0) {
        return ids;
      }
      const leanFallback = await politicalDataService.filterPrecincts({
        partisanLeanMin: -threshold,
        partisanLeanMax: threshold,
      });
      return leanFallback.length > 0 ? leanFallback : undefined;
    }

    if (parsed.type === 'ranking') {
      const precinctRankMetrics: PrecinctRankingMetric[] = [
        'partisan_lean',
        'swing_potential',
        'gotv_priority',
        'persuasion_opportunity',
        'turnout',
        'combined_score',
        'college_pct',
      ];
      let rankablePrecinctMetric: PrecinctRankingMetric =
        parsed.metric && precinctRankMetrics.includes(parsed.metric as PrecinctRankingMetric)
          ? (parsed.metric as PrecinctRankingMetric)
          : 'swing_potential';
      if (
        rankablePrecinctMetric === 'swing_potential' &&
        /\b(college|bachelor|educated|education\s+attainment)\b/i.test(parsed.originalQuery) &&
        /\bprecinct/i.test(parsed.originalQuery)
      ) {
        rankablePrecinctMetric = 'college_pct';
      }

      const wantsStatewidePrecincts =
        parsed.locationNames.length === 0 &&
        (/\bprecincts?\b/i.test(parsed.originalQuery) || /\bareas?\b/i.test(parsed.originalQuery));

      if (parsed.locationNames.length > 0) {
        const rankings = await politicalDataService.rankPrecinctsInJurisdiction(
          parsed.locationNames[0],
          rankablePrecinctMetric,
          parsed.ranking || 'highest',
          parsed.limit || 10,
        );
        return rankings.map((r) => r.precinctName);
      }
      if (wantsStatewidePrecincts) {
        const rankings = await politicalDataService.rankPrecinctsStatewide(
          rankablePrecinctMetric,
          parsed.ranking || 'highest',
          parsed.limit || 15,
        );
        return rankings.map((r) => r.precinctName);
      }
    }

    if (wantsElectionShiftQuery(q)) {
      const rows = await politicalDataService.getTopPrecinctsByMultiYearMarginSwing(15);
      if (rows.length > 0) {
        return rows.map((r) => r.precinctName);
      }
    }

    if (wantsTurnoutTrendQuery(q)) {
      const t = await politicalDataService.getTurnoutTrendExtremes(10);
      if (t) {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const r of [...t.largestIncreases, ...t.largestDecreases]) {
          if (!seen.has(r.precinctName)) {
            seen.add(r.precinctName);
            out.push(r.precinctName);
          }
        }
        if (out.length > 0) {
          return out;
        }
      }
    }

    if (wantsCanvassingEfficiencyQuery(q)) {
      const rows = await politicalDataService.getTopPrecinctsByCanvassingEfficiencyProxy(15);
      if (rows.length > 0) {
        return rows.map((r) => r.precinctName);
      }
    }

    const filterCriteria = extractFilterCriteriaFromUserQuery(userQuery);
    if (filterCriteria.metric || filterCriteria.density || filterCriteria.competitiveness) {
      const ids = await getPrecinctIdsForFilterCriteria(filterCriteria);
      if (ids.length > 0) {
        return ids;
      }
    }
  } catch (e) {
    console.warn('[politicalChatExportIds] collectDataPrecinctIdsForQuery failed:', e);
  }

  return undefined;
}

/** Server/client: parse + resolve IDs for a single user query string. */
export async function resolvePrecinctIdsForUserQuery(userQuery: string): Promise<string[]> {
  const routeResult = politicalQueryRouter.parseQuery(userQuery);
  const ids = await collectDataPrecinctIdsForQuery(routeResult.parsed, userQuery);
  return ids?.length ? ids : [];
}
