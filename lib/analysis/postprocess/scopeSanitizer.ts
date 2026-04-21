/* eslint-disable @typescript-eslint/no-explicit-any */

// Local helpers duplicated to avoid tight coupling
function getZIPCode(feature: any): string {
  try {
    const f = feature?.properties ? feature : { properties: feature };
    const props = f.properties || {};
    const direct = props.ZIP || props.Zip || props.zip || props.ZIPCODE || props.zip_code || props.ZipCode;
    if (typeof direct === 'string') {
      const m = direct.match(/\b(\d{5})\b/);
      if (m) return m[1];
    } else if (typeof direct === 'number') {
      return String(direct).padStart(5, '0');
    }
    const desc = typeof props.DESCRIPTION === 'string' ? props.DESCRIPTION : (typeof props.area_name === 'string' ? props.area_name : '');
    const zipMatch = desc.match(/\b(\d{5})\b/);
    if (zipMatch && zipMatch[1]) return zipMatch[1];
  } catch (error) {
    console.warn('[scopeSanitizer] Failed to extract ZIP code:', error);
  }
  return 'Unknown';
}

function resolvePrimaryScoreField(analysisType: string, features: any[], metadata?: any): string {
  if (metadata?.targetVariable) return metadata.targetVariable;
  const typeDefaults: Record<string, string[]> = {
    strategic_analysis: ['strategic_analysis_score', 'strategic_score', 'strategic_value_score'],
    brand_difference: ['brand_difference_score', 'brand_difference_value'],
    competitive_analysis: ['competitive_advantage_score'],
    comparative_analysis: ['comparison_score', 'comparative_score'],
    demographic_insights: ['demographic_insights_score']
  };
  const candidates = [ ...(typeDefaults[analysisType] || []), 'target_value', 'score', 'value' ];
  const first = (features || []).find(f => !!(f?.properties || f));
  const props = first?.properties || first || {};
  for (const c of candidates) {
    const v = (props as any)[c];
    if (typeof v === 'number' && !Number.isNaN(v)) return c;
  }
  return candidates[0] || 'strategic_analysis_score';
}

function computeStats(features: any[], scoreField: string) {
  const vals = (features || [])
    .map((f: any) => (f?.properties || f || {})[scoreField])
    .filter((v: any) => typeof v === 'number' && !Number.isNaN(v)) as number[];
  if (!vals.length) return null;
  const n = vals.length;
  const avg = vals.reduce((a, b) => a + b, 0) / n;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const variance = vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  return { n, avg, min, max, stdDev };
}

function filterToStudyArea(allFeatures: any[], metadata?: any) {
  let candidate = allFeatures;
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
        } catch (error) {
          console.warn('[scopeSanitizer] Failed to resolve feature ID:', error);
        }
        return null;
      };
      const filtered = allFeatures.filter((f: any) => {
        const fid = resolveFeatureId(f);
        return fid ? idSet.has(fid) : false;
      });
      if (filtered.length > 0) candidate = filtered;
    }
  } catch (error) {
    console.warn('[scopeSanitizer] Failed to filter to study area:', error);
  }
  return candidate;
}

export function sanitizeNarrativeScope(
  finalContent: string,
  processedLayersData: any[] | undefined,
  metadata: any | undefined,
  analysisType: string
): string {
  try {
    const allFeatures = (processedLayersData || []).flatMap(layer => Array.isArray((layer as any)?.features) ? (layer as any).features : []);
    const totalCount = allFeatures.length;
    const studyFeatures = filterToStudyArea(allFeatures, metadata);
    const count = studyFeatures.length;
    // If we cannot detect any features at all, leave content unchanged
    if (totalCount === 0) return finalContent;

    const scoreField = resolvePrimaryScoreField(analysisType, studyFeatures, metadata);
    const stats = computeStats(studyFeatures, scoreField);

    // 1) Normalize the top "Analyzing ..." line to study area count (robust to leading markers/whitespace)
    // Matches lines like: "Analyzing 123 areas..." or "  > Analyzing 1,234 areas..."
    finalContent = finalContent.replace(/^[ \t>*-]*Analyzing\s+[\d,]+\s+areas\.{3}/gmi, (m: string) => {
      return m.replace(/[\d,]+/, String(count));
    });

    // 2) Fix or remove lines in Market Analysis Overview that conflict with study area
    // Replace "• #### markets analyzed" with correct count, remove population coverage and other fabricated metrics
    finalContent = finalContent
      .replace(/^[ \t]*•[ \t]*[\d,]+\s+markets?\s+analyzed.*$/gmi, `• Areas analyzed: ${count}/${totalCount}`)
      .replace(/^.*Population\s+coverage:.*\n?/gmi, '')
      .replace(/^[ \t]*•[ \t]*Average\s+performance:.*\n?/gmi, stats ? `• Average score: ${stats.avg.toFixed(2)}` + '\n' : '')
      .replace(/^[ \t]*•[ \t]*Performance\s+range:.*\n?/gmi, stats ? `• Range: ${stats.min.toFixed(2)} – ${stats.max.toFixed(2)}` + '\n' : '')
      .replace(/^[ \t]*•[ \t]*Market\s+consistency:.*\n?/gmi, stats ? `• Std dev: ${stats.stdDev.toFixed(2)}` + '\n' : '');

    // 3) Remove distribution/cluster sections that are likely global or AI-fabricated
    const removeBlocks = [
      /\*\*Distribution Analysis\*\*[\s\S]*?(?=\n\*\*|$)/gmi,
      /Score Distribution:[\s\S]*?(?=\n\*\*|$)/gmi,
      /^Quartiles:.*\n?/gmi,
      /^IQR:.*\n?/gmi,
      /^Outliers:.*\n?/gmi,
      /^Distribution shape:.*\n?/gmi,
      /\*\*Key Patterns\*\*[\s\S]*?(?=\n\*\*|$)/gmi,
      /Market Clusters:[\s\S]*?(?=\n\*\*|$)/gmi,
      /^Key Correlations:.*\n?/gmi
    ];
    for (const re of removeBlocks) {
      finalContent = finalContent.replace(re, '\n');
    }

    // 4) Light cleanup: collapse excessive blank lines
    finalContent = finalContent.replace(/\n{3,}/g, '\n\n');
    return finalContent;
  } catch (error) {
    console.warn('[scopeSanitizer] Failed to sanitize narrative scope:', error);
    return finalContent;
  }
}

export default sanitizeNarrativeScope;
