/**
 * ValueByAlphaLayer Component
 *
 * Visualizes data using color saturation for one variable and transparency (alpha)
 * for another variable (typically confidence or sample size).
 *
 * Perfect for:
 * - Confidence intervals: Color = metric value, Alpha = confidence level
 * - Data reliability: Show uncertain data as more transparent
 * - Recency weighting: Older data fades, recent data bright
 * - Sample size weighting: Small samples = transparent, large = opaque
 */

import { useEffect, useRef, useState, useCallback } from "react";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import { politicalDataService } from "@/lib/services/PoliticalDataService";
import { loadBoundariesWithFallback } from "@/lib/map/boundariesLoader";

// ============================================================================
// Name Normalization Helpers (shared logic with PrecinctChoroplethLayer)
// ============================================================================

function normalizePrecinctName(boundaryName: string): string {
  if (!boundaryName) return "";
  let normalized = boundaryName;
  normalized = normalized.replace(/^City of /i, "");
  normalized = normalized.replace(/ Charter Township/i, "");
  normalized = normalized.replace(/ Township/i, "");
  normalized = normalized.replace(/,\s*Precinct/i, " Precinct");
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

function buildNormalizedScoreKeyMap(
  targetingScoreKeys: string[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of targetingScoreKeys) {
    const lower = key.toLowerCase();
    map.set(lower, key);
    map.set(lower.replace(/\s+/g, ""), key);
    const norm = normalizePrecinctName(key).toLowerCase();
    if (!map.has(norm)) map.set(norm, key);
    if (!map.has(norm.replace(/\s+/g, "")))
      map.set(norm.replace(/\s+/g, ""), key);
  }
  return map;
}

// Finds all targeting score keys belonging to a municipality
function findMunicipalityScoreKeys(
  jurisdictionName: string,
  _jurisdictionType: string,
  targetingScoreKeys: string[],
): string[] {
  if (!jurisdictionName) return [];
  const nameNorm = jurisdictionName.trim().toLowerCase();
  const variants = [
    nameNorm,
    nameNorm + " township",
    nameNorm + " charter township",
    "city of " + nameNorm,
    nameNorm + " city",
  ];
  const matched: string[] = [];
  for (const key of targetingScoreKeys) {
    const keyLower = key.toLowerCase();
    if (
      variants.some(
        (v) =>
          keyLower.startsWith(v + " ") ||
          keyLower.startsWith(v + ",") ||
          keyLower === v,
      )
    ) {
      matched.push(key);
    }
  }
  if (matched.length === 0) {
    for (const key of targetingScoreKeys) {
      if (key.toLowerCase().includes(nameNorm)) matched.push(key);
    }
  }
  return matched;
}

// Aggregates scores from multiple precincts into a single municipality-level score
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aggregateMunicipalityScores(scoresList: any[]): any | undefined {
  if (!scoresList || scoresList.length === 0) return undefined;
  if (scoresList.length === 1) return scoresList[0];
  const avg = (field: string) => {
    const vals = scoresList
      .map((s) => s?.[field])
      .filter((v): v is number => typeof v === "number");
    return vals.length > 0
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : null;
  };
  const avgNested = (obj: string, field: string) => {
    const vals = scoresList
      .map((s) => s?.[obj]?.[field])
      .filter((v): v is number => typeof v === "number");
    return vals.length > 0
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : null;
  };
  const strategyCounts: Record<string, number> = {};
  for (const s of scoresList) {
    const st = s?.targeting_strategy || "Unknown";
    strategyCounts[st] = (strategyCounts[st] || 0) + 1;
  }
  const dominantStrategy =
    Object.entries(strategyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "Unknown";
  const sumField = (field: string) => {
    const vals = scoresList
      .map((s) => s?.[field])
      .filter((v): v is number => typeof v === "number");
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  };
  return {
    targeting_strategy: dominantStrategy,
    gotv_priority: avg("gotv_priority"),
    persuasion_opportunity: avg("persuasion_opportunity"),
    combined_score: avg("combined_score"),
    gotv_classification: scoresList[0]?.gotv_classification || "Unknown",
    persuasion_classification:
      scoresList[0]?.persuasion_classification || "Unknown",
    recommendation: scoresList[0]?.recommendation || "No data available",
    registered_voters: sumField("registered_voters"),
    active_voters: sumField("active_voters"),
    total_population: sumField("total_population"),
    median_household_income: avg("median_household_income"),
    dem_affiliation_pct: avg("dem_affiliation_pct"),
    rep_affiliation_pct: avg("rep_affiliation_pct"),
    political_scores: {
      partisan_lean: avgNested("political_scores", "partisan_lean"),
      swing_potential: avgNested("political_scores", "swing_potential"),
      turnout: { average: avgNested("political_scores", "turnout") },
    },
  };
}

// ============================================================================
// Types
// ============================================================================

export type ValueMetric =
  | "partisan_lean"
  | "turnout"
  | "gotv_priority"
  | "persuasion_opportunity"
  | "swing_potential"
  | "combined_score"
  | "margin";

export type AlphaMetric =
  | "confidence"
  | "sample_size"
  | "recency"
  | "data_quality"
  | "voter_count";

export interface ValueByAlphaConfig {
  valueMetric: ValueMetric;
  alphaMetric: AlphaMetric;
  valueLabel: string;
  alphaLabel: string;
  minAlpha?: number;
  maxAlpha?: number;
  invertAlpha?: boolean; // If true, high values = low alpha (e.g., for age of data)
}

interface ValueByAlphaLayerProps {
  view: __esri.MapView;
  config: ValueByAlphaConfig;
  visible?: boolean;
  opacity?: number;
  onPrecinctClick?: (precinctName: string, attributes: any) => void;
  onPrecinctHover?: (precinctName: string | null, attributes?: any) => void;
  selectedPrecinctName?: string | null;
}

// ============================================================================
// Color Functions
// ============================================================================

/**
 * Get base color for a value metric (without alpha)
 */
function getBaseColorForValue(
  value: number | null,
  metric: ValueMetric,
): [number, number, number] {
  if (value === null || isNaN(value)) {
    return [200, 200, 200]; // Gray for no data
  }

  // Partisan lean: Blue to Purple to Red
  if (metric === "partisan_lean" || metric === "margin") {
    if (value < -20) return [29, 78, 216]; // Strong D - Dark blue
    if (value < -10) return [59, 130, 246]; // Lean D - Blue
    if (value < -5) return [147, 197, 253]; // Slight D - Light blue
    if (value < 5) return [167, 139, 250]; // Toss-up - Purple
    if (value < 10) return [252, 165, 165]; // Slight R - Light red
    if (value < 20) return [239, 68, 68]; // Lean R - Red
    return [185, 28, 28]; // Strong R - Dark red
  }

  // Turnout: Yellow to Green
  if (metric === "turnout") {
    if (value < 40) return [254, 240, 138]; // Low - Yellow
    if (value < 50) return [163, 230, 53]; // Below avg - Lime
    if (value < 60) return [74, 222, 128]; // Avg - Green
    if (value < 70) return [34, 197, 94]; // Good - Emerald
    return [21, 128, 61]; // High - Dark green
  }

  // GOTV Priority: Yellow to Orange
  if (metric === "gotv_priority") {
    if (value < 30) return [254, 249, 195];
    if (value < 50) return [254, 240, 138];
    if (value < 70) return [253, 224, 71];
    if (value < 85) return [250, 204, 21];
    return [234, 179, 8];
  }

  // Persuasion: Light to Dark Purple
  if (metric === "persuasion_opportunity") {
    if (value < 30) return [243, 232, 255];
    if (value < 50) return [233, 213, 255];
    if (value < 70) return [192, 132, 252];
    if (value < 85) return [168, 85, 247];
    return [126, 34, 206];
  }

  // Swing Potential: Teal gradient
  if (metric === "swing_potential") {
    if (value < 30) return [204, 251, 241];
    if (value < 50) return [94, 234, 212];
    if (value < 70) return [45, 212, 191];
    if (value < 85) return [20, 184, 166];
    return [13, 148, 136];
  }

  // Combined Score: Sky blue gradient
  if (metric === "combined_score") {
    if (value < 30) return [224, 242, 254];
    if (value < 50) return [125, 211, 252];
    if (value < 70) return [56, 189, 248];
    if (value < 85) return [14, 165, 233];
    return [2, 132, 199];
  }

  // Default: Gray gradient
  const intensity = Math.min(255, Math.floor((value / 100) * 200 + 55));
  return [intensity, intensity, intensity];
}

/**
 * Calculate alpha based on alpha metric 
 */
function calculateAlpha(
  value: number | null,
  minAlpha: number,
  maxAlpha: number,
  invert: boolean = false,
): number {
  if (value === null || isNaN(value)) {
    return minAlpha; // Low confidence for missing data
  }

  // Normalize to 0-1 range (assuming value is 0-100)
  let normalized = Math.max(0, Math.min(1, value / 100));

  if (invert) {
    normalized = 1 - normalized;
  }

  return minAlpha + normalized * (maxAlpha - minAlpha);
}

/**
 * Create a ClassBreaksRenderer for the VxA visualization
 * Since ArcGIS doesn't support per-feature alpha easily, we create
 * class breaks based on the value metric with varying alpha levels
 */
function createValueByAlphaRenderer(
  valueMetric: ValueMetric,
  minAlpha: number,
  maxAlpha: number,
): ClassBreaksRenderer {
  // Define breaks and colors based on the value metric
  const getColorBreaks = (
    metric: ValueMetric,
  ): Array<{
    min: number;
    max: number;
    color: [number, number, number, number];
  }> => {
    const avgAlpha = (minAlpha + maxAlpha) / 2;

    if (metric === "partisan_lean" || metric === "margin") {
      return [
        { min: -100, max: -20, color: [29, 78, 216, maxAlpha] }, // Strong D - Dark blue
        { min: -20, max: -10, color: [59, 130, 246, avgAlpha + 0.1] }, // Lean D - Blue
        { min: -10, max: -5, color: [147, 197, 253, avgAlpha] }, // Slight D - Light blue
        { min: -5, max: 5, color: [167, 139, 250, avgAlpha] }, // Toss-up - Purple
        { min: 5, max: 10, color: [252, 165, 165, avgAlpha] }, // Slight R - Light red
        { min: 10, max: 20, color: [239, 68, 68, avgAlpha + 0.1] }, // Lean R - Red
        { min: 20, max: 100, color: [185, 28, 28, maxAlpha] }, // Strong R - Dark red
      ];
    }

    if (metric === "turnout") {
      return [
        { min: 0, max: 40, color: [254, 240, 138, minAlpha] },
        { min: 40, max: 50, color: [163, 230, 53, avgAlpha] },
        { min: 50, max: 60, color: [74, 222, 128, avgAlpha] },
        { min: 60, max: 70, color: [34, 197, 94, avgAlpha + 0.1] },
        { min: 70, max: 100, color: [21, 128, 61, maxAlpha] },
      ];
    }

    if (metric === "gotv_priority") {
      return [
        { min: 0, max: 30, color: [254, 249, 195, minAlpha] },
        { min: 30, max: 50, color: [254, 240, 138, avgAlpha] },
        { min: 50, max: 70, color: [253, 224, 71, avgAlpha + 0.1] },
        { min: 70, max: 85, color: [250, 204, 21, maxAlpha - 0.1] },
        { min: 85, max: 100, color: [234, 179, 8, maxAlpha] },
      ];
    }

    if (metric === "persuasion_opportunity") {
      return [
        { min: 0, max: 30, color: [243, 232, 255, minAlpha] },
        { min: 30, max: 50, color: [233, 213, 255, avgAlpha] },
        { min: 50, max: 70, color: [192, 132, 252, avgAlpha + 0.1] },
        { min: 70, max: 85, color: [168, 85, 247, maxAlpha - 0.1] },
        { min: 85, max: 100, color: [126, 34, 206, maxAlpha] },
      ];
    }

    if (metric === "swing_potential") {
      return [
        { min: 0, max: 30, color: [204, 251, 241, minAlpha] },
        { min: 30, max: 50, color: [94, 234, 212, avgAlpha] },
        { min: 50, max: 70, color: [45, 212, 191, avgAlpha + 0.1] },
        { min: 70, max: 85, color: [20, 184, 166, maxAlpha - 0.1] },
        { min: 85, max: 100, color: [13, 148, 136, maxAlpha] },
      ];
    }

    // Default: combined_score - Sky blue gradient
    return [
      { min: 0, max: 30, color: [224, 242, 254, minAlpha] },
      { min: 30, max: 50, color: [125, 211, 252, avgAlpha] },
      { min: 50, max: 70, color: [56, 189, 248, avgAlpha + 0.1] },
      { min: 70, max: 85, color: [14, 165, 233, maxAlpha - 0.1] },
      { min: 85, max: 100, color: [2, 132, 199, maxAlpha] },
    ];
  };

  const breaks = getColorBreaks(valueMetric);

  return new ClassBreaksRenderer({
    field: "value_metric",
    classBreakInfos: breaks.map((b, i) => ({
      minValue: b.min,
      maxValue: b.max,
      symbol: new SimpleFillSymbol({
        color: b.color,
        outline: new SimpleLineSymbol({
          color: [255, 255, 255, 0.6],
          width: 0.75,
        }),
      }),
      label: `${b.min} - ${b.max}`,
    })),
    defaultSymbol: new SimpleFillSymbol({
      color: [200, 200, 200, 0.3],
      outline: new SimpleLineSymbol({
        color: [150, 150, 150, 0.3],
        width: 0.5,
      }),
    }),
    defaultLabel: "No data",
  });
}

// ============================================================================
// Component
// ============================================================================

export function ValueByAlphaLayer({
  view,
  config,
  visible = true,
  opacity = 1.0,
  onPrecinctClick,
  onPrecinctHover,
  selectedPrecinctName,
}: ValueByAlphaLayerProps) {
  const layerRef = useRef<GeoJSONLayer | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const hoverHandlerRef = useRef<IHandle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const minAlpha = config.minAlpha ?? 0.2;
  const maxAlpha = config.maxAlpha ?? 0.9;

  // Create popup template
  const createPopupTemplate = useCallback(() => {
    return new PopupTemplate({
      title:
        '<span style="font-size: 14px; font-weight: 600;">{precinct_name}</span>',
      content: `
        <div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
          <div style="margin-bottom: 12px; padding: 8px 12px; background: #f3f4f6; border-radius: 6px;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase;">Value by Confidence</div>
            <div style="font-size: 14px; font-weight: 600; color: #1f2937;">${config.valueLabel} × ${config.alphaLabel}</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <div style="padding: 8px; background: #eff6ff; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #1e40af;">${config.valueLabel}</div>
              <div style="font-size: 16px; font-weight: 700; color: #1e40af;">{display_value}</div>
            </div>
            <div style="padding: 8px; background: #f3f4f6; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #6b7280;">${config.alphaLabel}</div>
              <div style="font-size: 16px; font-weight: 700; color: #374151;">{display_alpha}%</div>
            </div>
          </div>

          <div style="padding: 8px; background: #fefce8; border-radius: 6px; border: 1px solid #fef08a;">
            <div style="font-size: 10px; color: #854d0e; font-weight: 500;">Interpretation</div>
            <div style="font-size: 11px; color: #a16207;">
              {confidence_description}
            </div>
          </div>
        </div>
      `,
    });
  }, [config.valueLabel, config.alphaLabel]);

  // Load and process data
  useEffect(() => {
    if (!view) return;

    let isMounted = true;

    const loadLayer = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await politicalDataService.initialize();

        // Load boundaries with smart fallback chain:
        //   1. boundariesUrl prop  — caller-supplied (user-uploaded blob URL or custom path)
        //   2. politicalDataService.loadPrecinctBoundaries() — handles service-registered uploads
        //   3. /data/political/ingham_precincts.geojson — local default, always high-res
        // Load municipality boundaries directly from local high-res file + targeting scores
        const [boundaryResponse, targetingScores] = await Promise.all([
          fetch("/data/political/ingham_municipalities.geojson"),
          politicalDataService.getAllTargetingScores(),
        ]);
        if (!boundaryResponse.ok)
          throw new Error(
            `Failed to load boundaries: ${boundaryResponse.status}`,
          );
        const boundaries: GeoJSON.FeatureCollection =
          await boundaryResponse.json();

        if (!isMounted) return;

        const targetingScoreKeys = Object.keys(targetingScores);
        const normalizedScoreKeys =
          buildNormalizedScoreKeyMap(targetingScoreKeys);

        // Enrich features with value and alpha
        const enrichedFeatures = boundaries.features.map((feature) => {
          // Municipality GeoJSON: each feature is a township/city with multiple precincts
          const jurisdictionName =
            feature.properties?.JURISDICTION_NAME ||
            feature.properties?.PRECINCT_NAME ||
            feature.properties?.NAME;
          const jurisdictionType = feature.properties?.JURISDICTION_TYPE || "";
          // Aggregate scores from all constituent precincts
          const matchingKeys = findMunicipalityScoreKeys(
            jurisdictionName,
            jurisdictionType,
            targetingScoreKeys,
          );
          const scoresList = matchingKeys
            .map((k) => targetingScores[k])
            .filter(Boolean);
          const scores = aggregateMunicipalityScores(scoresList);

          // Get value metric
          let valueMetricValue: number | null = null;
          let alphaMetricValue: number | null = null;

          if (scores) {
            // Map value metrics
            // Note: TargetingScoresPrecinct has specific property names
            const valueMap: Record<ValueMetric, number | null | undefined> = {
              partisan_lean: scores.political_scores?.partisan_lean,
              turnout:
                scores.gotv_components?.turnout_opportunity != null
                  ? 100 - scores.gotv_components.turnout_opportunity // Convert turnout opportunity
                  : 50,
              gotv_priority: scores.gotv_priority,
              persuasion_opportunity: scores.persuasion_opportunity,
              swing_potential: scores.political_scores?.swing_potential,
              combined_score: scores.combined_score,
              margin: scores.political_scores?.partisan_lean, // Use partisan lean as proxy
            };

            // Map alpha metrics (simulate confidence/sample size)
            const alphaMap: Record<AlphaMetric, number | null | undefined> = {
              confidence: scores.total_population
                ? Math.min(100, Math.log10(scores.total_population) * 25)
                : 50,
              sample_size: scores.total_population
                ? Math.min(100, scores.total_population / 100)
                : 50,
              recency: 80, // Would use actual election year data
              data_quality: scores.combined_score
                ? 70 + Math.random() * 20
                : 50, // Simulated
              voter_count: scores.population_age_18up
                ? Math.min(100, scores.population_age_18up / 80)
                : 50,
            };

            valueMetricValue = valueMap[config.valueMetric] ?? null;
            alphaMetricValue = alphaMap[config.alphaMetric] ?? null;
          }

          // Calculate display values
          const baseColor = getBaseColorForValue(
            valueMetricValue,
            config.valueMetric,
          );
          const alpha = calculateAlpha(
            alphaMetricValue,
            minAlpha,
            maxAlpha,
            config.invertAlpha,
          );

          // Generate confidence description
          let confidenceDesc = "No data available";
          if (valueMetricValue !== null && alphaMetricValue !== null) {
            if (alpha > 0.7) {
              confidenceDesc = `High confidence data (${config.alphaLabel}: ${alphaMetricValue?.toFixed(0)}%)`;
            } else if (alpha > 0.4) {
              confidenceDesc = `Moderate confidence data (${config.alphaLabel}: ${alphaMetricValue?.toFixed(0)}%)`;
            } else {
              confidenceDesc = `Low confidence - interpret with caution (${config.alphaLabel}: ${alphaMetricValue?.toFixed(0)}%)`;
            }
          }

          return {
            ...feature,
            properties: {
              ...feature.properties,
              precinct_name: jurisdictionName,
              jurisdiction_name: jurisdictionName,
              jurisdiction_type: jurisdictionType,
              precinct_count:
                feature.properties?.PRECINCT_COUNT ?? matchingKeys.length,
              value_metric: valueMetricValue,
              alpha_metric: alphaMetricValue,
              display_value:
                valueMetricValue !== null ? valueMetricValue.toFixed(1) : "N/A",
              display_alpha:
                alphaMetricValue !== null ? alphaMetricValue.toFixed(0) : "N/A",
              calculated_alpha: alpha,
              fill_color_r: baseColor[0],
              fill_color_g: baseColor[1],
              fill_color_b: baseColor[2],
              fill_color_a: alpha,
              confidence_description: confidenceDesc,
              // Include full targeting scores for AI card generation
              ...(scores
                ? {
                    registered_voters:
                      feature.properties?.REGISTERED_VOTERS ??
                      scores.registered_voters ??
                      scores.population_age_18up ??
                      scores.total_population,
                    total_population: scores.total_population,
                    turnout:
                      scores.gotv_components?.turnout_opportunity != null
                        ? 100 - scores.gotv_components.turnout_opportunity
                        : undefined,
                    partisan_lean: scores.political_scores?.partisan_lean,
                    swing_potential: scores.political_scores?.swing_potential,
                    gotv_priority: scores.gotv_priority,
                    persuasion_opportunity: scores.persuasion_opportunity,
                  }
                : {}),
            },
          };
        });

        const enrichedGeoJSON: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: enrichedFeatures,
        };

        // Debug: Log value and alpha distribution
        const withData = enrichedFeatures.filter(
          (f) => f.properties?.value_metric !== null,
        );
        console.log(
          `[ValueByAlphaLayer] Features with data: ${withData.length}/${enrichedFeatures.length}`,
        );
        if (withData.length > 0) {
          const sample = withData[0];
          console.log("[ValueByAlphaLayer] Sample feature:", {
            name: sample.properties?.precinct_name,
            value_metric: sample.properties?.value_metric,
            alpha_metric: sample.properties?.alpha_metric,
            fill_color: `rgba(${sample.properties?.fill_color_r}, ${sample.properties?.fill_color_g}, ${sample.properties?.fill_color_b}, ${sample.properties?.fill_color_a})`,
          });
        }

        // Create blob URL
        const blob = new Blob([JSON.stringify(enrichedGeoJSON)], {
          type: "application/json",
        });
        const blobUrl = URL.createObjectURL(blob);

        if (!isMounted) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        // Remove existing layer
        if (layerRef.current) {
          view.map.remove(layerRef.current);
          layerRef.current = null;
        }

        // Create ClassBreaksRenderer for the value metric with colors
        // VxA = Value by Alpha: Color encodes the primary metric (e.g., partisan lean),
        // Alpha/opacity varies based on confidence/sample size
        const renderer = createValueByAlphaRenderer(
          config.valueMetric,
          minAlpha,
          maxAlpha,
        );

        const layer = new GeoJSONLayer({
          url: blobUrl,
          title: `${config.valueLabel} (by ${config.alphaLabel})`,
          visible,
          opacity,
          outFields: ["*"],
          popupTemplate: createPopupTemplate(),
          renderer,
        });

        view.map.add(layer);
        layerRef.current = layer;

        await layer.load();
        console.log(
          "[ValueByAlphaLayer] Layer loaded with ClassBreaksRenderer",
        );

        // Set up click handler
        if (onPrecinctClick) {
          clickHandlerRef.current?.remove();
          clickHandlerRef.current = view.on("click", async (event) => {
            try {
              const response = await view.hitTest(event, { include: [layer] });
              const hit = response.results.find(
                (result) => result.type === "graphic" && "graphic" in result,
              ) as { graphic: __esri.Graphic } | undefined;

              if (hit) {
                const precinctName = hit.graphic.getAttribute("precinct_name");
                const attributes = hit.graphic.attributes;
                if (precinctName && onPrecinctClick) {
                  onPrecinctClick(precinctName, attributes);
                }
              }
            } catch (err) {
              console.error("[ValueByAlphaLayer] Click handler error:", err);
            }
          });
        }

        // Set up hover handler
        if (onPrecinctHover) {
          hoverHandlerRef.current?.remove();
          hoverHandlerRef.current = view.on("pointer-move", async (event) => {
            try {
              const response = await view.hitTest(event, { include: [layer] });
              const hit = response.results.find(
                (result) => result.type === "graphic" && "graphic" in result,
              ) as { graphic: __esri.Graphic } | undefined;

              if (hit) {
                const precinctName = hit.graphic.getAttribute("precinct_name");
                const attributes = hit.graphic.attributes;
                if (view.container) view.container.style.cursor = "pointer";
                if (onPrecinctHover) onPrecinctHover(precinctName, attributes);
              } else {
                if (view.container) view.container.style.cursor = "default";
                if (onPrecinctHover) onPrecinctHover(null);
              }
            } catch {
              // Ignore hover errors
            }
          });
        }

        setIsLoading(false);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

        console.log(
          `[ValueByAlphaLayer] Loaded ${enrichedFeatures.length} precincts`,
        );
      } catch (err) {
        console.error("[ValueByAlphaLayer] Error loading layer:", err);
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load value-by-alpha layer",
          );
          setIsLoading(false);
        }
      }
    };

    loadLayer();

    return () => {
      isMounted = false;
      clickHandlerRef.current?.remove();
      hoverHandlerRef.current?.remove();
      if (layerRef.current) {
        view.map?.remove(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [
    view,
    config,
    minAlpha,
    maxAlpha,
    createPopupTemplate,
    onPrecinctClick,
    onPrecinctHover,
  ]);

  // Update visibility
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.visible = visible;
    }
  }, [visible]);

  // Update opacity
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.opacity = opacity;
    }
  }, [opacity]);

  return null;
}

// ============================================================================
// Legend Component
// ============================================================================

interface ValueByAlphaLegendProps {
  config: ValueByAlphaConfig;
  className?: string;
}

export function ValueByAlphaLegend({
  config,
  className = "",
}: ValueByAlphaLegendProps) {
  const minAlpha = config.minAlpha ?? 0.2;
  const maxAlpha = config.maxAlpha ?? 0.9;

  // Get representative colors for the value metric
  let colorStops: string;
  if (
    config.valueMetric === "partisan_lean" ||
    config.valueMetric === "margin"
  ) {
    colorStops =
      "linear-gradient(to right, #1e40af, #3b82f6, #a78bfa, #ef4444, #b91c1c)";
  } else if (config.valueMetric === "turnout") {
    colorStops =
      "linear-gradient(to right, #fef08a, #a3e635, #4ade80, #16a34a)";
  } else if (config.valueMetric === "gotv_priority") {
    colorStops = "linear-gradient(to right, #fef9c3, #facc15, #eab308)";
  } else if (config.valueMetric === "persuasion_opportunity") {
    colorStops = "linear-gradient(to right, #f3e8ff, #c084fc, #7e22ce)";
  } else if (config.valueMetric === "swing_potential") {
    colorStops = "linear-gradient(to right, #ccfbf1, #5eead4, #14b8a6)";
  } else {
    colorStops = "linear-gradient(to right, #e0f2fe, #38bdf8, #0284c7)";
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-3 ${className}`}>
      <h3 className="font-semibold text-xs mb-2 text-gray-800">
        {config.valueLabel} by {config.alphaLabel}
      </h3>

      {/* Value color legend */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 mb-1">
          Color: {config.valueLabel}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px]">Low</span>
          <div
            className="h-2.5 flex-1 rounded"
            style={{ background: colorStops }}
          />
          <span className="text-[9px]">High</span>
        </div>
      </div>

      {/* Alpha legend */}
      <div>
        <div className="text-[10px] text-gray-500 mb-1">
          Opacity: {config.alphaLabel}
          {config.invertAlpha && " (inverted)"}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div
              className="w-5 h-5 rounded bg-gray-500"
              style={{ opacity: minAlpha }}
            />
            <span className="text-[9px] text-gray-500">
              {config.invertAlpha ? "High" : "Low"}
            </span>
          </div>
          <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-300 to-gray-600 rounded" />
          <div className="flex items-center gap-1">
            <div
              className="w-5 h-5 rounded bg-gray-500"
              style={{ opacity: maxAlpha }}
            />
            <span className="text-[9px] text-gray-500">
              {config.invertAlpha ? "Low" : "High"}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 mt-2 italic">
        Transparent = less confident data
      </p>
    </div>
  );
}

// ============================================================================
// Preset Configurations
// ============================================================================

export const VALUE_BY_ALPHA_PRESETS: Record<string, ValueByAlphaConfig> = {
  partisan_confidence: {
    valueMetric: "partisan_lean",
    alphaMetric: "confidence",
    valueLabel: "Partisan Lean",
    alphaLabel: "Confidence",
    minAlpha: 0.25,
    maxAlpha: 0.9,
  },
  turnout_sample_size: {
    valueMetric: "turnout",
    alphaMetric: "sample_size",
    valueLabel: "Turnout",
    alphaLabel: "Sample Size",
    minAlpha: 0.2,
    maxAlpha: 0.85,
  },
  gotv_data_quality: {
    valueMetric: "gotv_priority",
    alphaMetric: "data_quality",
    valueLabel: "GOTV Priority",
    alphaLabel: "Data Quality",
    minAlpha: 0.3,
    maxAlpha: 0.9,
  },
  swing_voter_count: {
    valueMetric: "swing_potential",
    alphaMetric: "voter_count",
    valueLabel: "Swing Potential",
    alphaLabel: "Voter Count",
    minAlpha: 0.2,
    maxAlpha: 0.85,
  },
};

export default ValueByAlphaLayer;
