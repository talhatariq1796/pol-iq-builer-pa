/**
 * BivariateChoroplethLayer Component
 *
 * Visualizes TWO variables simultaneously using a 3x3 color matrix.
 * Perfect for answering questions like:
 * - "Where are low-turnout Democratic precincts?" (Partisan Lean × Turnout)
 * - "Which areas have both persuasion and GOTV opportunities?" (Persuasion × GOTV)
 *
 * Color matrix concept:
 *                    LOW VAR_Y    MED VAR_Y    HIGH VAR_Y
 * LOW VAR_X           corner1     middle1      corner2
 * MED VAR_X           middle4     center       middle2
 * HIGH VAR_X          corner3     middle3      corner4
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import { politicalDataService } from "@/lib/services/PoliticalDataService";

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

export type BivariateMetric =
  | "partisan_lean"
  | "turnout"
  | "gotv_priority"
  | "persuasion_opportunity"
  | "swing_potential"
  | "combined_score"
  | "median_income"
  | "college_pct";

export interface BivariateConfig {
  xMetric: BivariateMetric;
  yMetric: BivariateMetric;
  xLabel: string;
  yLabel: string;
}

interface BivariateChoroplethLayerProps {
  view: __esri.MapView;
  config: BivariateConfig;
  visible?: boolean;
  opacity?: number;
  onPrecinctClick?: (precinctName: string, attributes: any) => void;
  onPrecinctHover?: (precinctName: string | null, attributes?: any) => void;
  selectedPrecinctName?: string | null;
  /**
   * Optional URL for a custom GeoJSON boundaries file.
   * Use this to visualize user-uploaded boundary data.
   * Falls back to politicalDataService → local default if not provided or invalid.
   */
  boundariesUrl?: string | null;
}

// ============================================================================
// Color Schemes - 3x3 bivariate matrix
// ============================================================================

/**
 * Classic bivariate color scheme: Blue-Purple-Red
 * X-axis increases from left to right (e.g., partisan lean D to R)
 * Y-axis increases from bottom to top (e.g., low to high turnout)
 *
 * Matrix layout (indices):
 *   [6] [7] [8]   HIGH Y
 *   [3] [4] [5]   MED Y
 *   [0] [1] [2]   LOW Y
 *   LOW  MED HIGH X
 */
const BIVARIATE_COLORS = {
  // Blue (low X = D+) to Purple (mid) to Red (high X = R+)
  // Light (low Y) to Dark (high Y)
  // For partisan_lean: negative values = D+ (blue), positive values = R+ (red)
  blueRed: [
    // Row 0: LOW Y (bottom row)
    [228, 241, 254, 0.7], // [0] Low X (D+), Low Y - Very light blue
    [204, 204, 235, 0.7], // [1] Med X, Low Y - Light lavender
    [254, 224, 210, 0.7], // [2] High X (R+), Low Y - Very light red

    // Row 1: MED Y (middle row)
    [153, 206, 236, 0.75], // [3] Low X (D+), Med Y - Light blue
    [186, 153, 206, 0.75], // [4] Med X, Med Y - Medium purple
    [252, 174, 145, 0.75], // [5] High X (R+), Med Y - Light red

    // Row 2: HIGH Y (top row)
    [59, 130, 246, 0.85], // [6] Low X (D+), High Y - Blue
    [147, 51, 234, 0.85], // [7] Med X, High Y - Purple
    [239, 68, 68, 0.85], // [8] High X (R+), High Y - Red
  ] as [number, number, number, number][],

  // Green to Purple - for two positive metrics (e.g., GOTV × Persuasion)
  greenPurple: [
    // Row 0: LOW Y
    [237, 248, 233, 0.7], // [0] Very light green
    [226, 234, 246, 0.7], // [1] Light blue-gray
    [243, 232, 255, 0.7], // [2] Very light purple

    // Row 1: MED Y
    [161, 217, 155, 0.75], // [3] Light green
    [171, 190, 218, 0.75], // [4] Medium blue-gray
    [216, 180, 254, 0.75], // [5] Light purple

    // Row 2: HIGH Y
    [49, 163, 84, 0.85], // [6] Green
    [106, 117, 180, 0.85], // [7] Blue-purple
    [147, 51, 234, 0.85], // [8] Purple
  ] as [number, number, number, number][],

  // Yellow to Teal - for income × education type correlations
  yellowTeal: [
    // Row 0: LOW Y
    [255, 255, 229, 0.7], // [0] Very light yellow
    [237, 248, 251, 0.7], // [1] Very light cyan
    [224, 252, 252, 0.7], // [2] Light cyan

    // Row 1: MED Y
    [254, 227, 145, 0.75], // [3] Light yellow
    [178, 226, 226, 0.75], // [4] Medium cyan
    [102, 194, 164, 0.75], // [5] Teal

    // Row 2: HIGH Y
    [253, 174, 97, 0.85], // [6] Orange
    [65, 182, 196, 0.85], // [7] Cyan
    [34, 94, 168, 0.85], // [8] Dark teal
  ] as [number, number, number, number][],
};

// Metric configuration for thresholds
const METRIC_THRESHOLDS: Record<
  BivariateMetric,
  { low: number; high: number; diverging?: boolean }
> = {
  partisan_lean: { low: -10, high: 10, diverging: true }, // D+10 to R+10 is "medium"
  turnout: { low: 45, high: 65 },
  gotv_priority: { low: 40, high: 70 },
  persuasion_opportunity: { low: 40, high: 70 },
  swing_potential: { low: 30, high: 60 },
  combined_score: { low: 40, high: 70 },
  median_income: { low: 40000, high: 80000 },
  college_pct: { low: 20, high: 50 },
};

const METRIC_LABELS: Record<BivariateMetric, string> = {
  partisan_lean: "Partisan Lean",
  turnout: "Turnout",
  gotv_priority: "GOTV Priority",
  persuasion_opportunity: "Persuasion",
  swing_potential: "Swing Potential",
  combined_score: "Combined Score",
  median_income: "Median Income",
  college_pct: "College %",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the bivariate class (0-8) for a given pair of values
 */
function getBivariateClass(
  xValue: number | null,
  yValue: number | null,
  xMetric: BivariateMetric,
  yMetric: BivariateMetric,
): number {
  if (xValue === null || yValue === null || isNaN(xValue) || isNaN(yValue)) {
    return -1; // No data
  }

  const xThresholds = METRIC_THRESHOLDS[xMetric];
  const yThresholds = METRIC_THRESHOLDS[yMetric];

  // Calculate X class (0 = low, 1 = med, 2 = high)
  let xClass: number;
  if (xValue < xThresholds.low) {
    xClass = 0;
  } else if (xValue > xThresholds.high) {
    xClass = 2;
  } else {
    xClass = 1;
  }

  // Calculate Y class (0 = low, 1 = med, 2 = high)
  let yClass: number;
  if (yValue < yThresholds.low) {
    yClass = 0;
  } else if (yValue > yThresholds.high) {
    yClass = 2;
  } else {
    yClass = 1;
  }

  // Return combined class index: row * 3 + col
  return yClass * 3 + xClass;
}

/**
 * Select appropriate color scheme based on metrics
 */
function selectColorScheme(
  xMetric: BivariateMetric,
  yMetric: BivariateMetric,
): keyof typeof BIVARIATE_COLORS {
  // Use blue-red for partisan comparisons
  if (xMetric === "partisan_lean" || yMetric === "partisan_lean") {
    return "blueRed";
  }

  // Use green-purple for two targeting metrics
  if (
    (xMetric === "gotv_priority" || xMetric === "persuasion_opportunity") &&
    (yMetric === "gotv_priority" || yMetric === "persuasion_opportunity")
  ) {
    return "greenPurple";
  }

  // Use yellow-teal for demographic correlations
  if (
    xMetric === "median_income" ||
    xMetric === "college_pct" ||
    yMetric === "median_income" ||
    yMetric === "college_pct"
  ) {
    return "yellowTeal";
  }

  // Default to blue-red
  return "blueRed";
}

// ============================================================================
// Component
// ============================================================================

export function BivariateChoroplethLayer({
  view,
  config,
  visible = true,
  opacity = 0.8,
  onPrecinctClick,
  onPrecinctHover,
  selectedPrecinctName,
  boundariesUrl = null,
}: BivariateChoroplethLayerProps) {
  const layerRef = useRef<GeoJSONLayer | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const hoverHandlerRef = useRef<IHandle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colorScheme = useMemo(
    () => selectColorScheme(config.xMetric, config.yMetric),
    [config.xMetric, config.yMetric],
  );

  // Create renderer for bivariate classification
  const createRenderer = useCallback(() => {
    const colors = BIVARIATE_COLORS[colorScheme];

    const uniqueValueInfos = colors.map((color, index) => ({
      value: index.toString(),
      symbol: new SimpleFillSymbol({
        color: color,
        outline: new SimpleLineSymbol({
          color: [255, 255, 255, 0.6],
          width: 0.75,
        }),
      }),
      label: `Class ${index}`,
    }));

    // Add default for no data
    return new UniqueValueRenderer({
      field: "bivariate_class",
      defaultSymbol: new SimpleFillSymbol({
        color: [200, 200, 200, 0.4],
        outline: new SimpleLineSymbol({
          color: [150, 150, 150, 0.5],
          width: 0.5,
        }),
      }),
      defaultLabel: "No data",
      uniqueValueInfos,
    });
  }, [colorScheme]);

  // Create popup template
  const createPopupTemplate = useCallback(() => {
    const xLabel = METRIC_LABELS[config.xMetric];
    const yLabel = METRIC_LABELS[config.yMetric];

    return new PopupTemplate({
      title:
        '<span style="font-size: 14px; font-weight: 600;">{precinct_name}</span>',
      content: `
        <div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
          <div style="margin-bottom: 12px; padding: 8px 12px; background: #f3f4f6; border-radius: 6px;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Bivariate Analysis</div>
            <div style="font-size: 14px; font-weight: 600; color: #1f2937;">${xLabel} × ${yLabel}</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <div style="padding: 8px; background: #eff6ff; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #1e40af;">${xLabel}</div>
              <div style="font-size: 16px; font-weight: 700; color: #1e40af;">{${config.xMetric}}</div>
            </div>
            <div style="padding: 8px; background: #faf5ff; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #7c3aed;">${yLabel}</div>
              <div style="font-size: 16px; font-weight: 700; color: #7c3aed;">{${config.yMetric}}</div>
            </div>
          </div>

          <div style="padding: 8px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
            <div style="font-size: 10px; color: #166534; font-weight: 500;">Classification</div>
            <div style="font-size: 11px; color: #15803d;">{bivariate_description}</div>
          </div>
        </div>
      `,
    });
  }, [config.xMetric, config.yMetric]);

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

        // Enrich features with bivariate classification
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

          // Get metric values
          let xValue: number | null = null;
          let yValue: number | null = null;

          if (scores) {
            // Map metrics to score properties
            // Note: TargetingScoresPrecinct has slightly different property names
            const metricMap: Record<
              BivariateMetric,
              number | null | undefined
            > = {
              partisan_lean: scores.political_scores?.partisan_lean,
              turnout:
                scores.gotv_components?.turnout_opportunity != null
                  ? 100 - scores.gotv_components.turnout_opportunity // Convert turnout opportunity (higher = lower turnout)
                  : 50, // Default to 50% if not available
              gotv_priority: scores.gotv_priority,
              persuasion_opportunity: scores.persuasion_opportunity,
              swing_potential: scores.political_scores?.swing_potential,
              combined_score: scores.combined_score,
              median_income: scores.median_household_income,
              college_pct: scores.college_pct,
            };

            xValue = metricMap[config.xMetric] ?? null;
            yValue = metricMap[config.yMetric] ?? null;
          }

          const bivariateClass = getBivariateClass(
            xValue,
            yValue,
            config.xMetric,
            config.yMetric,
          );

          // Generate human-readable description
          let description = "No data available";
          if (bivariateClass >= 0) {
            const xLevel =
              bivariateClass % 3 === 0
                ? "Low"
                : bivariateClass % 3 === 1
                  ? "Medium"
                  : "High";
            const yLevel =
              Math.floor(bivariateClass / 3) === 0
                ? "Low"
                : Math.floor(bivariateClass / 3) === 1
                  ? "Medium"
                  : "High";
            description = `${xLevel} ${METRIC_LABELS[config.xMetric]}, ${yLevel} ${METRIC_LABELS[config.yMetric]}`;
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
              [config.xMetric]: xValue,
              [config.yMetric]: yValue,
              bivariate_class:
                bivariateClass >= 0 ? bivariateClass.toString() : null,
              bivariate_description: description,
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

        // Debug: Log bivariate classification distribution
        const classCounts: Record<string, number> = {};
        enrichedFeatures.forEach((f) => {
          const bc = f.properties?.bivariate_class || "null";
          classCounts[bc] = (classCounts[bc] || 0) + 1;
        });
        console.log(
          "[BivariateChoroplethLayer] Bivariate class distribution:",
          classCounts,
        );

        // Debug: Sample feature
        const sampleFeature = enrichedFeatures.find(
          (f) => f.properties?.bivariate_class !== null,
        );
        if (sampleFeature) {
          const props = sampleFeature.properties as Record<string, unknown>;
          console.log("[BivariateChoroplethLayer] Sample enriched feature:", {
            name: props?.precinct_name,
            xMetric: config.xMetric,
            xValue: props?.[config.xMetric],
            yMetric: config.yMetric,
            yValue: props?.[config.yMetric],
            bivariate_class: props?.bivariate_class,
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

        // Create layer
        const layer = new GeoJSONLayer({
          url: blobUrl,
          title: `Bivariate: ${METRIC_LABELS[config.xMetric]} × ${METRIC_LABELS[config.yMetric]}`,
          visible,
          opacity,
          outFields: ["*"],
          renderer: createRenderer(),
          popupTemplate: createPopupTemplate(),
        });

        view.map.add(layer);
        layerRef.current = layer;

        await layer.load();

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
              console.error(
                "[BivariateChoroplethLayer] Click handler error:",
                err,
              );
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
          `[BivariateChoroplethLayer] Loaded ${enrichedFeatures.length} precincts`,
        );
      } catch (err) {
        console.error("[BivariateChoroplethLayer] Error loading layer:", err);
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load bivariate layer",
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
    createRenderer,
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

interface BivariateLegendProps {
  config: BivariateConfig;
  className?: string;
}

export function BivariateLegend({
  config,
  className = "",
}: BivariateLegendProps) {
  const colorScheme = selectColorScheme(config.xMetric, config.yMetric);
  const colors = BIVARIATE_COLORS[colorScheme];
  const xLabel = config.xLabel || METRIC_LABELS[config.xMetric];
  const yLabel = config.yLabel || METRIC_LABELS[config.yMetric];

  return (
    <div className={`bg-white rounded-lg shadow-md p-3 ${className}`}>
      <h3 className="font-semibold text-xs mb-2 text-gray-800">
        {xLabel} × {yLabel}
      </h3>

      {/* 3x3 grid */}
      <div className="relative">
        {/* Y-axis label */}
        <div
          className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-gray-500 whitespace-nowrap"
          style={{ transformOrigin: "center" }}
        >
          {yLabel} →
        </div>

        {/* Grid */}
        <div className="ml-4 grid grid-cols-3 gap-0.5 w-20">
          {/* Row 2 (HIGH Y) - top row visually */}
          {[6, 7, 8].map((idx) => (
            <div
              key={idx}
              className="w-6 h-6 border border-white/50"
              style={{ backgroundColor: `rgba(${colors[idx].join(",")})` }}
              title={`Class ${idx}`}
            />
          ))}
          {/* Row 1 (MED Y) */}
          {[3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="w-6 h-6 border border-white/50"
              style={{ backgroundColor: `rgba(${colors[idx].join(",")})` }}
              title={`Class ${idx}`}
            />
          ))}
          {/* Row 0 (LOW Y) - bottom row visually */}
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="w-6 h-6 border border-white/50"
              style={{ backgroundColor: `rgba(${colors[idx].join(",")})` }}
              title={`Class ${idx}`}
            />
          ))}
        </div>

        {/* X-axis label */}
        <div className="ml-4 mt-1 text-[9px] text-gray-500 text-center w-20">
          {xLabel} →
        </div>
      </div>

      <p className="text-[10px] text-gray-500 mt-2">
        Shows relationship between two metrics
      </p>
    </div>
  );
}

// ============================================================================
// Preset Configurations
// ============================================================================

export const BIVARIATE_PRESETS: Record<string, BivariateConfig> = {
  gotv_targets: {
    xMetric: "partisan_lean",
    yMetric: "turnout",
    xLabel: "Dem Support",
    yLabel: "Turnout",
  },
  persuasion_gotv: {
    xMetric: "persuasion_opportunity",
    yMetric: "gotv_priority",
    xLabel: "Persuasion",
    yLabel: "GOTV Priority",
  },
  swing_turnout: {
    xMetric: "swing_potential",
    yMetric: "turnout",
    xLabel: "Swing Potential",
    yLabel: "Turnout",
  },
  income_education: {
    xMetric: "median_income",
    yMetric: "college_pct",
    xLabel: "Income",
    yLabel: "Education",
  },
};

export default BivariateChoroplethLayer;
