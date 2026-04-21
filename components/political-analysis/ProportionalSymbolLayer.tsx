/**
 * ProportionalSymbolLayer Component
 *
 * Visualizes data using proportional symbols (circles/markers) where:
 * - SIZE encodes one variable (e.g., population, voter count, donation amount)
 * - COLOR encodes another variable (e.g., partisan lean, GOTV priority, turnout)
 *
 * Perfect for:
 * - Donor concentration maps (size = total donations, color = avg gift)
 * - Volunteer locations (size = capacity, color = availability)
 * - Canvassing efficiency (size = doors contacted, color = conversion rate)
 * - Population centers (size = voters, color = partisan lean)
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
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

export type ProportionalSizeMetric =
  | "total_population"
  | "registered_voters"
  | "total_donations"
  | "donor_count"
  | "canvass_doors"
  | "volunteer_count";

export type ProportionalColorMetric =
  | "partisan_lean"
  | "turnout"
  | "gotv_priority"
  | "persuasion_opportunity"
  | "avg_donation"
  | "contact_rate";

export interface ProportionalConfig {
  sizeMetric: ProportionalSizeMetric;
  colorMetric: ProportionalColorMetric;
  sizeLabel: string;
  colorLabel: string;
  minSize?: number;
  maxSize?: number;
}

interface ProportionalSymbolLayerProps {
  view: __esri.MapView;
  config: ProportionalConfig;
  data?: ProportionalDataPoint[];
  visible?: boolean;
  opacity?: number;
  onSymbolClick?: (id: string, attributes: any) => void;
  onSymbolHover?: (id: string | null, attributes?: any) => void;
  /**
   * Optional URL for a custom GeoJSON boundaries file.
   * Use this to visualize user-uploaded boundary data.
   * Falls back to politicalDataService → local default if not provided or invalid.
   */
  boundariesUrl?: string | null;
}

export interface ProportionalDataPoint {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  sizeValue: number;
  colorValue: number;
  attributes?: Record<string, any>;
}

// ============================================================================
// Color Scales
// ============================================================================

/**
 * Get color based on value and metric type
 */
function getColorForValue(
  value: number,
  metric: ProportionalColorMetric,
): [number, number, number, number] {
  // Partisan lean: Blue to Purple to Red
  if (metric === "partisan_lean") {
    if (value < -20) return [29, 78, 216, 1]; // Strong D - Dark blue
    if (value < -10) return [59, 130, 246, 1]; // Lean D - Blue
    if (value < -5) return [147, 197, 253, 1]; // Slight D - Light blue
    if (value < 5) return [167, 139, 250, 1]; // Toss-up - Purple
    if (value < 10) return [252, 165, 165, 1]; // Slight R - Light red
    if (value < 20) return [239, 68, 68, 1]; // Lean R - Red
    return [185, 28, 28, 1]; // Strong R - Dark red
  }

  // Turnout: Gray to Green
  if (metric === "turnout" || metric === "contact_rate") {
    if (value < 30) return [209, 213, 219, 1]; // Very low - Gray
    if (value < 45) return [254, 240, 138, 1]; // Low - Yellow
    if (value < 55) return [163, 230, 53, 1]; // Medium - Lime
    if (value < 65) return [74, 222, 128, 1]; // Good - Green
    if (value < 75) return [34, 197, 94, 1]; // High - Emerald
    return [21, 128, 61, 1]; // Very high - Dark green
  }

  // GOTV Priority: Yellow to Orange
  if (metric === "gotv_priority") {
    if (value < 20) return [254, 249, 195, 1]; // Low - Light yellow
    if (value < 40) return [254, 240, 138, 1]; // Medium-low
    if (value < 60) return [253, 224, 71, 1]; // Medium
    if (value < 80) return [250, 204, 21, 1]; // High
    return [234, 179, 8, 1]; // Very high - Gold
  }

  // Persuasion: Light purple to Dark purple
  if (metric === "persuasion_opportunity") {
    if (value < 20) return [243, 232, 255, 1]; // Low
    if (value < 40) return [233, 213, 255, 1];
    if (value < 60) return [216, 180, 254, 1];
    if (value < 80) return [168, 85, 247, 1];
    return [126, 34, 206, 1]; // Very high
  }

  // Avg donation: Light green to Dark green (money)
  if (metric === "avg_donation") {
    if (value < 50) return [220, 252, 231, 1];
    if (value < 100) return [187, 247, 208, 1];
    if (value < 250) return [134, 239, 172, 1];
    if (value < 500) return [74, 222, 128, 1];
    if (value < 1000) return [34, 197, 94, 1];
    return [22, 163, 74, 1];
  }

  // Default: Gray scale
  const intensity = Math.min(255, Math.floor((value / 100) * 200 + 55));
  return [intensity, intensity, intensity, 1];
}

/**
 * Calculate symbol size based on value
 */
function getSizeForValue(
  value: number,
  minValue: number,
  maxValue: number,
  minSize: number = 8,
  maxSize: number = 40,
): number {
  if (maxValue === minValue) return (minSize + maxSize) / 2;

  // Use square root scaling for better visual perception of area
  const normalizedValue = (value - minValue) / (maxValue - minValue);
  const sqrtValue = Math.sqrt(normalizedValue);
  return minSize + sqrtValue * (maxSize - minSize);
}

// ============================================================================
// Component
// ============================================================================

export function ProportionalSymbolLayer({
  view,
  config,
  data,
  visible = true,
  opacity = 0.9,
  onSymbolClick,
  onSymbolHover,
  boundariesUrl = null,
}: ProportionalSymbolLayerProps) {
  const layerRef = useRef<GraphicsLayer | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const hoverHandlerRef = useRef<IHandle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate min/max for size scaling
  const sizeRange = useMemo(() => {
    if (!data || data.length === 0) return { min: 0, max: 100 };
    const values = data.map((d) => d.sizeValue);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [data]);

  // Create the layer
  useEffect(() => {
    if (!view) return;

    let isMounted = true;

    const createLayer = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use provided data or load from precinct centroids
        let pointData: ProportionalDataPoint[] | undefined = data;

        if (!pointData) {
          // Load precinct data and create centroids.
          // Load municipality boundaries directly from local high-res file + targeting scores
          await politicalDataService.initialize();
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

          const targetingScoreKeys = Object.keys(targetingScores);
          const normalizedScoreKeys =
            buildNormalizedScoreKeyMap(targetingScoreKeys);

          const mappedPoints = boundaries.features.map((feature) => {
            // Municipality GeoJSON: each feature is a township/city with multiple precincts
            const jurisdictionName =
              feature.properties?.JURISDICTION_NAME ||
              feature.properties?.PRECINCT_NAME ||
              feature.properties?.NAME;
            const jurisdictionType =
              feature.properties?.JURISDICTION_TYPE || "";
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

            if (!scores || !feature.geometry) return null;

            // Calculate centroid from polygon
            let centroid: [number, number];
            if (feature.geometry.type === "Polygon") {
              const coords = feature.geometry.coordinates[0];
              const sumLng = coords.reduce((sum, c) => sum + c[0], 0);
              const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
              centroid = [sumLng / coords.length, sumLat / coords.length];
            } else if (feature.geometry.type === "MultiPolygon") {
              const coords = feature.geometry.coordinates[0][0];
              const sumLng = coords.reduce((sum, c) => sum + c[0], 0);
              const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
              centroid = [sumLng / coords.length, sumLat / coords.length];
            } else {
              return null;
            }

            // Map metrics to values — use municipality-level GeoJSON voter data for accuracy
            const muniRegisteredVoters =
              feature.properties?.REGISTERED_VOTERS ||
              scores.population_age_18up ||
              scores.total_population ||
              0;
            const sizeMap: Record<ProportionalSizeMetric, number> = {
              total_population: scores.total_population || 0,
              registered_voters: muniRegisteredVoters,
              total_donations: 0, // Would need donor data
              donor_count: 0,
              canvass_doors: scores.total_population
                ? Math.floor(scores.total_population * 0.4)
                : 0,
              volunteer_count: 0,
            };

            const colorMap: Record<ProportionalColorMetric, number> = {
              partisan_lean: scores.political_scores?.partisan_lean ?? 0,
              turnout:
                scores.gotv_components?.turnout_opportunity != null
                  ? 100 - scores.gotv_components.turnout_opportunity // Convert turnout opportunity
                  : 50,
              gotv_priority: scores.gotv_priority ?? 50,
              persuasion_opportunity: scores.persuasion_opportunity ?? 50,
              avg_donation: 0,
              contact_rate: 25, // Default contact rate
            };

            return {
              id: jurisdictionName,
              name: jurisdictionName,
              longitude: centroid[0],
              latitude: centroid[1],
              sizeValue: sizeMap[config.sizeMetric],
              colorValue: colorMap[config.colorMetric],
              attributes: {
                ...scores,
                precinct_name: jurisdictionName,
                jurisdiction_name: jurisdictionName,
                jurisdiction_type: feature.properties?.JURISDICTION_TYPE || "",
                precinct_ids: (feature.properties?.PRECINCT_IDS || []).join(
                  ", ",
                ),
                precinct_count:
                  feature.properties?.PRECINCT_COUNT ?? matchingKeys.length,
                // Include flat targeting scores for AI card generation
                registered_voters: muniRegisteredVoters,
                active_voters:
                  feature.properties?.ACTIVE_VOTERS || scores.active_voters,
                total_population: scores.total_population,
                turnout:
                  scores.gotv_components?.turnout_opportunity != null
                    ? 100 - scores.gotv_components.turnout_opportunity
                    : undefined,
                partisan_lean: scores.political_scores?.partisan_lean,
                swing_potential: scores.political_scores?.swing_potential,
                gotv_priority: scores.gotv_priority,
                persuasion_opportunity: scores.persuasion_opportunity,
              },
            } as ProportionalDataPoint;
          });

          pointData = mappedPoints.filter(
            (d): d is ProportionalDataPoint => d !== null,
          );
        }

        if (!isMounted) return;

        // Remove existing layer
        if (layerRef.current) {
          view.map.remove(layerRef.current);
          layerRef.current = null;
        }

        // Create graphics layer
        const layer = new GraphicsLayer({
          id: "proportional-symbols",
          title: `${config.sizeLabel} × ${config.colorLabel}`,
          listMode: "show",
        });

        // Recalculate size range with actual data
        const actualSizeRange = {
          min: Math.min(...pointData.map((d) => d.sizeValue)),
          max: Math.max(...pointData.map((d) => d.sizeValue)),
        };

        // Add graphics for each point
        pointData.forEach((point) => {
          const size = getSizeForValue(
            point.sizeValue,
            actualSizeRange.min,
            actualSizeRange.max,
            config.minSize || 8,
            config.maxSize || 40,
          );

          const color = getColorForValue(point.colorValue, config.colorMetric);

          const graphic = new Graphic({
            geometry: new Point({
              longitude: point.longitude,
              latitude: point.latitude,
              spatialReference: { wkid: 4326 },
            }),
            symbol: new SimpleMarkerSymbol({
              style: "circle",
              color: color,
              size: size,
              outline: {
                color: [255, 255, 255, 0.8],
                width: 1,
              },
            }),
            attributes: {
              id: point.id,
              name: point.name,
              sizeValue: point.sizeValue,
              colorValue: point.colorValue,
              ...point.attributes,
            },
            popupTemplate: new PopupTemplate({
              title: point.name,
              content: `
                <div style="font-family: Inter, system-ui, sans-serif; font-size: 13px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <div style="padding: 8px; background: #f3f4f6; border-radius: 6px; text-align: center;">
                      <div style="font-size: 10px; color: #6b7280;">${config.sizeLabel}</div>
                      <div style="font-size: 16px; font-weight: 700;">${point.sizeValue.toLocaleString()}</div>
                    </div>
                    <div style="padding: 8px; background: #f3f4f6; border-radius: 6px; text-align: center;">
                      <div style="font-size: 10px; color: #6b7280;">${config.colorLabel}</div>
                      <div style="font-size: 16px; font-weight: 700;">${typeof point.colorValue === "number" ? point.colorValue.toFixed(1) : point.colorValue}</div>
                    </div>
                  </div>
                </div>
              `,
            }),
          });

          layer.add(graphic);
        });

        layer.visible = visible;
        layer.opacity = opacity;

        view.map.add(layer);
        layerRef.current = layer;

        // Set up click handler
        if (onSymbolClick) {
          clickHandlerRef.current?.remove();
          clickHandlerRef.current = view.on("click", async (event) => {
            try {
              const response = await view.hitTest(event, { include: [layer] });
              const hit = response.results.find(
                (result) => result.type === "graphic" && "graphic" in result,
              ) as { graphic: __esri.Graphic } | undefined;

              if (hit) {
                const id = hit.graphic.getAttribute("id");
                const attributes = hit.graphic.attributes;
                if (id && onSymbolClick) {
                  onSymbolClick(id, attributes);
                }
              }
            } catch (err) {
              console.error(
                "[ProportionalSymbolLayer] Click handler error:",
                err,
              );
            }
          });
        }

        // Set up hover handler
        if (onSymbolHover) {
          hoverHandlerRef.current?.remove();
          hoverHandlerRef.current = view.on("pointer-move", async (event) => {
            try {
              const response = await view.hitTest(event, { include: [layer] });
              const hit = response.results.find(
                (result) => result.type === "graphic" && "graphic" in result,
              ) as { graphic: __esri.Graphic } | undefined;

              if (hit) {
                const id = hit.graphic.getAttribute("id");
                const attributes = hit.graphic.attributes;
                if (view.container) view.container.style.cursor = "pointer";
                if (onSymbolHover) onSymbolHover(id, attributes);
              } else {
                if (view.container) view.container.style.cursor = "default";
                if (onSymbolHover) onSymbolHover(null);
              }
            } catch {
              // Ignore hover errors
            }
          });
        }

        setIsLoading(false);
        console.log(
          `[ProportionalSymbolLayer] Created ${pointData.length} symbols`,
        );
      } catch (err) {
        console.error("[ProportionalSymbolLayer] Error creating layer:", err);
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to create proportional symbols",
          );
          setIsLoading(false);
        }
      }
    };

    createLayer();

    return () => {
      isMounted = false;
      clickHandlerRef.current?.remove();
      hoverHandlerRef.current?.remove();
      if (layerRef.current) {
        view.map?.remove(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [view, config, data, visible, opacity, onSymbolClick, onSymbolHover]);

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

interface ProportionalLegendProps {
  config: ProportionalConfig;
  sizeRange?: { min: number; max: number };
  className?: string;
}

export function ProportionalLegend({
  config,
  sizeRange,
  className = "",
}: ProportionalLegendProps) {
  const minSize = config.minSize || 8;
  const maxSize = config.maxSize || 40;

  return (
    <div className={`bg-white rounded-lg shadow-md p-3 ${className}`}>
      <h3 className="font-semibold text-xs mb-2 text-gray-800">
        {config.sizeLabel} × {config.colorLabel}
      </h3>

      {/* Size legend */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 mb-1">
          Size: {config.sizeLabel}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col items-center">
            <div
              className="rounded-full bg-gray-400"
              style={{ width: minSize, height: minSize }}
            />
            <span className="text-[9px] text-gray-500 mt-0.5">
              {sizeRange?.min?.toLocaleString() || "Low"}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="rounded-full bg-gray-400"
              style={{
                width: (minSize + maxSize) / 2,
                height: (minSize + maxSize) / 2,
              }}
            />
            <span className="text-[9px] text-gray-500 mt-0.5">Med</span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="rounded-full bg-gray-400"
              style={{ width: maxSize, height: maxSize }}
            />
            <span className="text-[9px] text-gray-500 mt-0.5">
              {sizeRange?.max?.toLocaleString() || "High"}
            </span>
          </div>
        </div>
      </div>

      {/* Color legend */}
      <div>
        <div className="text-[10px] text-gray-500 mb-1">
          Color: {config.colorLabel}
        </div>
        {config.colorMetric === "partisan_lean" ? (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-blue-600">D+</span>
            <div
              className="h-2 flex-1 rounded"
              style={{
                background:
                  "linear-gradient(to right, #1e40af, #3b82f6, #a78bfa, #ef4444, #b91c1c)",
              }}
            />
            <span className="text-[9px] text-red-600">R+</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[9px]">Low</span>
            <div
              className="h-2 flex-1 rounded"
              style={{
                background:
                  config.colorMetric === "turnout" ||
                  config.colorMetric === "contact_rate"
                    ? "linear-gradient(to right, #d1d5db, #fef08a, #4ade80, #16a34a)"
                    : config.colorMetric === "gotv_priority"
                      ? "linear-gradient(to right, #fef9c3, #facc15, #eab308)"
                      : config.colorMetric === "persuasion_opportunity"
                        ? "linear-gradient(to right, #f3e8ff, #c084fc, #7e22ce)"
                        : "linear-gradient(to right, #dcfce7, #4ade80, #16a34a)",
              }}
            />
            <span className="text-[9px]">High</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Preset Configurations
// ============================================================================

export const PROPORTIONAL_PRESETS: Record<string, ProportionalConfig> = {
  voter_population: {
    sizeMetric: "registered_voters",
    colorMetric: "partisan_lean",
    sizeLabel: "Voters",
    colorLabel: "Partisan Lean",
    minSize: 10,
    maxSize: 50,
  },
  gotv_population: {
    sizeMetric: "registered_voters",
    colorMetric: "gotv_priority",
    sizeLabel: "Voters",
    colorLabel: "GOTV Priority",
    minSize: 10,
    maxSize: 50,
  },
  canvass_turnout: {
    sizeMetric: "canvass_doors",
    colorMetric: "contact_rate",
    sizeLabel: "Doors",
    colorLabel: "Contact Rate",
    minSize: 8,
    maxSize: 40,
  },
  // Donor visualization presets
  donor_concentration: {
    sizeMetric: "total_donations",
    colorMetric: "avg_donation",
    sizeLabel: "Total $",
    colorLabel: "Avg Gift",
    minSize: 12,
    maxSize: 60,
  },
  donor_count: {
    sizeMetric: "donor_count",
    colorMetric: "avg_donation",
    sizeLabel: "Donors",
    colorLabel: "Avg Gift",
    minSize: 10,
    maxSize: 50,
  },
  donor_prospects: {
    sizeMetric: "total_donations",
    colorMetric: "partisan_lean",
    sizeLabel: "Total $",
    colorLabel: "Partisan Lean",
    minSize: 12,
    maxSize: 60,
  },
};

export default ProportionalSymbolLayer;
