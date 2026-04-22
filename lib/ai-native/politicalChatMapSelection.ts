import type { ChatMapSelection } from '@/app/api/political-chat/route';

/** Minimal IQ last-analysis shape for map payload (avoids circular imports). */
type IqLastAnalysis = {
  areaName?: string;
  precincts?: Array<{ name?: string }>;
} | null;

type PrecinctLike = {
  precinctName: string;
  precinctId: string;
  attributes?: Record<string, unknown> | null;
} | null;

type CurrentFeatureLike = {
  id: string;
  name: string;
  raw?: Record<string, unknown>;
} | null;

/**
 * Build mapSelection for /api/political-chat so stale IQ area analysis does not override
 * the user's current map focus (precinct / hex / district card).
 */
export function buildPoliticalChatMapSelection(opts: {
  selectedPrecinct: PrecinctLike;
  currentFeature: CurrentFeatureLike;
  iqLastAnalysis: IqLastAnalysis;
}): ChatMapSelection | undefined {
  const attrs =
    opts.selectedPrecinct?.attributes ||
    (opts.currentFeature?.raw as Record<string, unknown> | undefined) ||
    {};
  const focusName = opts.selectedPrecinct?.precinctName || opts.currentFeature?.name;
  const focusKey = opts.selectedPrecinct?.precinctId || opts.currentFeature?.id;
  const hasExplicitMapFocus = Boolean(focusName || focusKey);

  if (!hasExplicitMapFocus && !opts.iqLastAnalysis?.areaName) {
    return undefined;
  }

  const jurisdiction =
    (attrs.Jurisdiction_Name as string | undefined) ||
    (attrs.MunicipalityName as string | undefined) ||
    (attrs.MUNICIPALITY as string | undefined) ||
    (attrs.municipality as string | undefined) ||
    undefined;

  return {
    selectedPrecinctName: focusName,
    selectedPrecinctMapKey: focusKey,
    selectedPrecinctJurisdiction: jurisdiction,
    ...(hasExplicitMapFocus
      ? {}
      : {
          lastAnalysisAreaName: opts.iqLastAnalysis?.areaName,
          lastAnalysisPrecinctNames: opts.iqLastAnalysis?.precincts
            ?.map((p) => p.name)
            .filter((n): n is string => Boolean(n)),
        }),
  };
}
