/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolveAreaName as resolveSharedAreaName, getZip as getSharedZip } from '@/lib/shared/AreaName';
import { getPrimaryScoreField } from '@/lib/analysis/strategies/processors/HardcodedFieldDefs';

// Local helper: robust ZIP extractor compatible with existing feature shapes
function getZIPCode(feature: any): string {
  try {
    if (!feature) return 'Unknown';
    const f = feature?.properties ? feature : { properties: feature };
    const props = f.properties || {};
    const direct = props.ZIP || props.Zip || props.zip || props.ZIPCODE || props.zip_code || props.ZipCode;
    if (direct && typeof direct === 'string') {
      const m = direct.match(/\b(\d{5})\b/);
      if (m) return m[1];
    } else if (typeof direct === 'number') {
      const s = String(direct).padStart(5, '0');
      return s;
    }
    const desc = typeof props.DESCRIPTION === 'string' ? props.DESCRIPTION : (typeof props.area_name === 'string' ? props.area_name : '');
    const zipMatch = desc.match(/\b(\d{5})\b/);
    if (zipMatch && zipMatch[1]) return zipMatch[1];
  } catch (e) {
    // Silent fail for ZIP extraction, fallback to shared util
  }
  try {
    // Fallback to shared util
    const z = getSharedZip(feature);
    if (z && z !== 'Unknown') return z;
  } catch (e) {
    // Silent fail for shared ZIP lookup
  }
  return 'Unknown';
}

// Resolve score field using endpoint mapping (no heuristics). Metadata targetVariable wins.
function resolvePrimaryScoreField(analysisType: string, features: any[], metadata?: any): string {
  // Delegate to central canonical mapping. getPrimaryScoreField respects metadata.targetVariable.
  try {
    const primary = getPrimaryScoreField(analysisType, metadata || undefined);
    if (primary && typeof primary === 'string' && primary.trim()) return primary;
  } catch {
    // fall through to a conservative fallback below
  }
  return 'value';
}

// Compute simple descriptive stats used for the Study Area Summary
function computeScoreStats(features: any[], scoreField: string) {
  const vals = (features || [])
    .map((f: any) => {
      const lvl1 = (f?.properties || f || {});
      const nested = (lvl1 as any)?.properties || lvl1;
      const v = (nested as any)?.[scoreField] ?? 
               (lvl1 as any)?.[scoreField] ?? 
               (nested as any)?.strategic_analysis_score ?? 
               (lvl1 as any)?.strategic_analysis_score ?? 
               (nested as any)?.value ?? 
               (lvl1 as any)?.value;
      return typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
    })
    .filter((v: any) => typeof v === 'number' && !Number.isNaN(v)) as number[];
  if (vals.length === 0) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  const q = (p: number) => {
    const idx = (n - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const min = sorted[0];
  const max = sorted[n - 1];
  const avg = vals.reduce((a, b) => a + b, 0) / n;
  return { count: n, min, max, avg, q1: q(0.25), q2: q(0.5), q3: q(0.75) };
}

// Main entry: injects a ranked, capped Top Strategic Markets list and a Study Area Summary.
export function injectTopStrategicMarkets(
  finalContent: string,
  processedLayersData: any[] | undefined,
  metadata: any | undefined,
  analysisType: string
): string {
  const listHeaderMatch = finalContent.match(/Top Strategic Markets:\s*(?:\n|\r\n)/i);
  if (!listHeaderMatch) return finalContent;

  const allFeatures = (processedLayersData || []).flatMap(layer => Array.isArray((layer as any)?.features) ? (layer as any).features : []);
  let candidateFeatures = allFeatures;
  // Apply study area selection filtering when spatialFilterIds provided
  try {
    const forceProjectScope = metadata?.analysisScope === 'project' || metadata?.scope === 'project' || metadata?.forceProjectScope === true;
    const ids = Array.isArray(metadata?.spatialFilterIds) ? (metadata?.spatialFilterIds as any[]) : [];
    if (!forceProjectScope && ids.length > 0) {
      const idSet = new Set(ids.map((v: any) => String(v)));
      const resolveFeatureId = (feat: any): string | null => {
        try {
          const props = feat?.properties || feat || {};
          const direct = props.ID ?? props.id ?? props.area_id ?? props.areaID ?? props.geoid ?? props.GEOID;
          if (direct !== undefined && direct !== null) return String(direct);
          const desc = typeof props.DESCRIPTION === 'string' ? props.DESCRIPTION : (typeof props.area_name === 'string' ? props.area_name : '');
          const zipMatch = desc.match(/\b(\d{5})\b/);
          if (zipMatch && zipMatch[1]) return zipMatch[1];
          const zip = getZIPCode({ properties: props });
          if (zip && zip !== 'Unknown') return String(zip);
        } catch (e) {
          // Silent fail for feature ID resolution
        }
        return null;
      };
      const filtered = allFeatures.filter((f: any) => {
        const fid = resolveFeatureId(f);
        return fid ? idSet.has(fid) : false;
      });
      if (filtered.length > 0) {
        candidateFeatures = filtered;
      }
    }
  } catch (e) {
    // Silent fail for feature filtering
  }

  const resolvedScoreField = resolvePrimaryScoreField(analysisType, candidateFeatures, metadata);
  // Prefer last-numeric-field convention used by some datasets: if the last numeric property
  // across features appears to be a numeric score, use it instead of the resolved canonical field.
  let scoreFieldForUse: string = resolvedScoreField;
  try {
    const detectLastNumericField = (features: any[]): string | null => {
      for (const feat of features) {
        const props = (feat?.properties || feat || {});
        const keys = Object.keys(props || {});
        const numericKeys = keys.filter(k => {
          const v = (props as any)[k];
          return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
        });
        if (numericKeys.length > 0) return numericKeys[numericKeys.length - 1];
      }
      return null;
    };
    const lastNumeric = detectLastNumericField(candidateFeatures);
    if (lastNumeric && lastNumeric !== resolvedScoreField) {
      const appearsNumeric = candidateFeatures.some(f => {
        const p = (f?.properties || f || {});
        const v = (p as any)[lastNumeric];
        return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
      });
      if (appearsNumeric) scoreFieldForUse = lastNumeric;
    }
  } catch (e) {
    // Silent fail for numeric field detection
  }
  // Helper formatters and pickers
  const toNum = (v: any): number | null => {
    const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
    return Number.isFinite(n) ? n : null;
  };
  const pickFirst = (obj: any, keys: string[]): any => {
    for (const k of keys) {
      const val = obj?.[k];
      if (val !== undefined && val !== null && val !== '') return val;
    }
    return undefined;
  };
  const fmtPct = (v: number | null | undefined): string => {
    if (v === null || v === undefined || Number.isNaN(v as any)) return 'Data not available';
    // If looks like a fraction, convert to percent
    const num = Number(v);
    const pct = num > 0 && num <= 1 ? num * 100 : num;
    return `${pct.toFixed(1)}%`;
  };
  const fmtInt = (v: number | null | undefined): string => {
    if (v === null || v === undefined || Number.isNaN(v as any)) return 'Data not available';
    return Math.round(Number(v)).toLocaleString();
  };
  const fmtMoney = (v: number | null | undefined): string => {
    if (v === null || v === undefined || Number.isNaN(v as any)) return 'Data not available';
    return `$${Math.round(Number(v)).toLocaleString()}`;
  };

  // Build ranked list with enriched per-item details
  let ranked = candidateFeatures
    .map((feat: any) => {
      const lvl1 = feat?.properties || feat || {};
      const nested = (lvl1 as any)?.properties || lvl1; // handle double nesting
      const score = Number(
        (nested as any)?.[scoreFieldForUse] ??
        (lvl1 as any)?.[scoreFieldForUse] ??
        (nested as any)?.strategic_analysis_score ??
        (lvl1 as any)?.strategic_analysis_score ??
        (nested as any)?.strategic_score ??
        (lvl1 as any)?.strategic_score ??
        (nested as any)?.strategic_value_score ??
        (lvl1 as any)?.strategic_value_score ??
        (nested as any)?.value ??
        (lvl1 as any)?.value ??
        (nested as any)?.target_value ??
        (lvl1 as any)?.target_value
      );
      const name = resolveSharedAreaName(feat, { mode: 'zipCity', neutralFallback: (lvl1 as any)?.area_name || (lvl1 as any)?.name || (lvl1 as any)?.area_id || '' });

      // Enrich: Market Gap, Brand Share, Demographics (check nested first, then lvl1)
      const marketGapRaw = pickFirst(nested, ['market_gap', 'opportunity_gap', 'market_gap_pct', 'gap_percent', 'gap']) ?? pickFirst(lvl1, ['market_gap', 'opportunity_gap', 'market_gap_pct', 'gap_percent', 'gap']);
      const brandShareRaw = pickFirst(nested, ['brand_share', 'target_brand_share', 'red_bull_share', 'brand_penetration', 'brand_share_pct']) ?? pickFirst(lvl1, ['brand_share', 'target_brand_share', 'red_bull_share', 'brand_penetration', 'brand_share_pct']);
      const populationRaw = pickFirst(nested, ['total_population', 'population', 'TOTPOP_CY', 'value_TOTPOP_CY']) ?? pickFirst(lvl1, ['total_population', 'population', 'TOTPOP_CY', 'value_TOTPOP_CY']);
      const incomeRaw = pickFirst(nested, ['median_income', 'AVGHINC_CY', 'value_AVGHINC_CY', 'household_income']) ?? pickFirst(lvl1, ['median_income', 'AVGHINC_CY', 'value_AVGHINC_CY', 'household_income']);

      const marketGap = marketGapRaw != null ? toNum(marketGapRaw) : null;
      const brandShare = brandShareRaw != null ? toNum(brandShareRaw) : null;
      const population = populationRaw != null ? toNum(populationRaw) : null;
      const income = incomeRaw != null ? toNum(incomeRaw) : null;

      return {
        name,
        score,
        details: {
          marketGap: marketGap,
          brandShare: brandShare,
          population: population,
          income: income
        }
      };
    })
    .filter((x: any) => x.name && !Number.isNaN(x.score))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, Math.min(10, candidateFeatures.length || 10));

  // Deduplicate by normalized name to avoid repeated entries (e.g., duplicate Oceanside ZIP)
  const seen = new Set<string>();
  ranked = ranked.filter(item => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (ranked.length >= 1) {
    const formatted = ranked.map((r: any, i: number) => {
      const bullets = [
        `   • Market Gap: ${fmtPct(r.details.marketGap)}`,
        `   • Brand Share: ${fmtPct(r.details.brandShare)}`,
        `   • Demographics: Pop ${fmtInt(r.details.population)}, Income ${fmtMoney(r.details.income)}`
      ].join('\n');
      return `${i + 1}. ${r.name} (Strategic Score: ${r.score.toFixed(2)})\n${bullets}`;
    }).join('\n');
  const stats = computeScoreStats(candidateFeatures, scoreFieldForUse);
    const total = allFeatures.length;
    const studyAreaBlock = stats ? `Study Area Summary:\n• Areas analyzed: ${stats.count}${total && total !== stats.count ? `/${total}` : ''}\n• Avg score: ${stats.avg.toFixed(2)}\n• Range: ${stats.min.toFixed(2)} – ${stats.max.toFixed(2)}\n• Quartiles: Q1 ${stats.q1.toFixed(2)}, Q2 ${stats.q2.toFixed(2)}, Q3 ${stats.q3.toFixed(2)}\n\n` : '';
    const sectionRegex = /Top Strategic Markets:\s*(?:\n|\r\n)[\s\S]*?(?=\n{2,}[A-Z][^\n]{0,60}:\s*\n|\n{2,}\*\*|$)/i;
    const replacement = `Top Strategic Markets:\n\n${studyAreaBlock}${formatted}\n\n`;
    if (sectionRegex.test(finalContent)) {
      return finalContent.replace(sectionRegex, replacement);
    }
    // Fallback to original minimal replacement
    return finalContent.replace(/(Top Strategic Markets:\s*)([\s\S]*?)(\n\n|$)/i, (_m: string, p1: string) => `${p1}\n${studyAreaBlock}${formatted}\n\n`);
  }
  return finalContent;
}

export default injectTopStrategicMarkets;
