/**
 * PoliticalAnalysisPanel Component
 *
 * Main panel for political landscape analysis workflow.
 * Integrates area selection, analysis results, and report generation.
 * Designed to be used as a sidebar or panel component in the map application.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MapPin,
  BarChart3,
  FileText,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  Download,
  RefreshCw,
  ChevronRight,
  Target,
  Info,
  Zap,
  PieChart,
  Circle,
  Footprints,
  Car,
} from 'lucide-react';

import { PoliticalAreaSelector } from './PoliticalAreaSelector';
import { BOUNDARY_LAYERS } from './BoundaryLayerPicker';
import { QuickStartIQDialog } from './QuickStartIQDialog';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import {
  formatPaPrecinctLocation,
  isPaPrecinctAttributes,
} from '@/lib/political/paCountyFips';
import { formatPrecinctLocationFallback } from '@/lib/political/politicalRegionConfig';
import { loadBoundaryFeatureCollection } from '@/lib/map/geojsonMergeLoader';
import { Report } from '@/services/ReportsService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Polygon from '@arcgis/core/geometry/Polygon';
import Extent from '@arcgis/core/geometry/Extent';
import * as projection from '@arcgis/core/geometry/projection';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import type { PoliticalAreaSelection, PrecinctPoliticalScores, BoundaryLayerType } from '@/types/political';
import { MetricLabel } from '@/components/ui/metric-label';

interface TargetingScoreSummary {
  strategy_distribution: Record<string, number>;
  gotv_distribution: Record<string, number>;
  persuasion_distribution: Record<string, number>;
  score_stats: {
    gotv: { mean: number; median: number; min: number; max: number };
    persuasion: { mean: number; median: number; min: number; max: number };
    combined: { mean: number; median: number; min: number; max: number };
  };
}

/** PA targeting JSON: political_scores + top-level swing_potential (legacy MI uses political map only). */
function readTargetingPoliticalOverrides(targeting: unknown): {
  partisan_lean?: number;
  swing_potential?: number;
} {
  if (!targeting || typeof targeting !== 'object') return {};
  const t = targeting as Record<string, unknown>;
  const ps = t.political_scores as Record<string, unknown> | undefined;
  const pl = ps?.partisan_lean;
  const spTop = t.swing_potential;
  const spNested = ps?.swing_potential;
  const num = (x: unknown): number | undefined => {
    if (typeof x === 'number' && !Number.isNaN(x)) return x;
    if (x != null && x !== '') {
      const n = Number(x);
      if (!Number.isNaN(n)) return n;
    }
    return undefined;
  };
  return {
    partisan_lean: num(pl),
    swing_potential: num(spTop) ?? num(spNested),
  };
}

let precinctBoundariesCache: Promise<GeoJSON.FeatureCollection> | null = null;

function getPrecinctBoundaryLayer(): Promise<GeoJSON.FeatureCollection> {
  if (!precinctBoundariesCache) {
    precinctBoundariesCache = loadBoundaryFeatureCollection(BOUNDARY_LAYERS.precinct);
  }
  return precinctBoundariesCache;
}

/**
 * Combine precinct polygon(s) into one GeoJSON MultiPolygon (same idea as PoliticalAreaSelector).
 * Used so Esri Census infographics cover the **same** precincts as IQ totals (not the last map click only).
 */
/** PA and other layers use IDs like "041-:-SOUTH MIDDLETON PRECINCT 09"; boundaries may key NAME without the prefix. */
function expandPrecinctKeysForBoundaryMatch(keys: string[]): {
  wanted: Set<string>;
  wantedLower: Set<string>;
} {
  const wanted = new Set<string>();
  const wantedLower = new Set<string>();
  for (const raw of keys) {
    const k = raw.trim();
    if (!k) continue;
    wanted.add(k);
    wantedLower.add(k.toLowerCase());
    const sep = k.indexOf(':-');
    if (sep !== -1) {
      const suffix = k.slice(sep + 2).trim();
      if (suffix) {
        wanted.add(suffix);
        wantedLower.add(suffix.toLowerCase());
      }
    }
  }
  return { wanted, wantedLower };
}

async function buildMultiPolygonFromPrecinctKeys(
  precinctKeys: string[],
): Promise<GeoJSON.MultiPolygon | null> {
  if (precinctKeys.length === 0) return null;
  const boundaries = await getPrecinctBoundaryLayer();
  const { wanted, wantedLower } = expandPrecinctKeysForBoundaryMatch(precinctKeys);

  const polygons: GeoJSON.Polygon[] = [];

  for (const feature of boundaries.features) {
    const props = feature.properties as Record<string, unknown> | undefined;
    const key =
      props?.UNIQUE_ID != null && String(props.UNIQUE_ID) !== ''
        ? String(props.UNIQUE_ID)
        : props?.precinct_id != null && String(props.precinct_id) !== ''
          ? String(props.precinct_id)
          : props?.NAME != null && String(props.NAME) !== ''
            ? String(props.NAME)
            : '';
    if (!key) continue;
    const match =
      wanted.has(key) ||
      wantedLower.has(key.toLowerCase()) ||
      (props?.NAME != null && wantedLower.has(String(props.NAME).toLowerCase()));
    if (!match) continue;

    const g = feature.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      polygons.push(g as GeoJSON.Polygon);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of (g as GeoJSON.MultiPolygon).coordinates) {
        polygons.push({ type: 'Polygon', coordinates: poly });
      }
    }
  }

  if (polygons.length === 0) return null;
  return {
    type: 'MultiPolygon',
    coordinates: polygons.map((p) => p.coordinates),
  };
}

function resolvePartisanLeanForDisplay(
  political: PrecinctPoliticalScores | undefined,
  targeting: unknown,
): number {
  const p = political?.partisanLean?.value;
  if (p != null && !Number.isNaN(Number(p))) return Number(p);
  const o = readTargetingPoliticalOverrides(targeting);
  if (o.partisan_lean != null) return o.partisan_lean;
  return 0;
}

interface AreaAnalysisResult {
  // Area info
  areaName: string;
  selectionMethod: string;
  totalPrecincts: number;
  includedPrecincts: Array<{
    name: string;
    overlapRatio: number;
    registeredVoters: number;
    partisanLean: number;
  }>;

  // Aggregate metrics
  totalRegisteredVoters: number;
  estimatedTurnout: number;

  // Political scores (weighted by voters)
  weightedPartisanLean: number;
  weightedSwingPotential: number;
  dominantParty: 'D' | 'R' | 'Swing';

  // Classification
  classification: {
    competitiveness: 'Safe D' | 'Likely D' | 'Lean D' | 'Tossup' | 'Lean R' | 'Likely R' | 'Safe R';
    targetingPriority: 'High' | 'Medium-High' | 'Medium' | 'Low';
    persuasionIndex: number;
    mobilizationIndex: number;
  };

  // Targeting scores (new)
  targetingScores?: {
    avgGOTVPriority: number;
    avgPersuasionOpportunity: number;
    strategyDistribution: Record<string, number>;
  };

  // Historical data
  electionHistory?: {
    year: number;
    race: string;
    demVotes: number;
    repVotes: number;
    margin: number;
  }[];
}

interface SelectedPrecinctInfo {
  precinctId: string;
  precinctName: string;
  county: string;
  geometry?: any;
  attributes?: Record<string, any>;
}

// IQ Action types for sync with AI chat
export interface IQAction {
  type: 'quickstart' | 'area-analysis' | 'report-generated';
  action: string;
  /** Assigned in political-ai page per click — dedupes duplicate IQ handling in the AI host. */
  invocationId?: number;
  data?: {
    precinctNames?: string[];
    areaName?: string;
    analysisType?: string;
    result?: any;
    // QuickStartIQ predefined query data
    query?: string;
    category?: string;
    visualType?: string;
    metric?: string;
    queryId?: string;
  };
}

interface SelectedH3CellInfo {
  h3Index: string;
  precincts: string[];
  precinctCount: number;
  attributes: any;
}

interface PoliticalAnalysisPanelProps {
  view: __esri.MapView;
  onGenerateReport?: (selection: PoliticalAreaSelection, analysis: AreaAnalysisResult) => void;
  className?: string;
  selectedPrecinct?: SelectedPrecinctInfo | null;
  selectedH3Cell?: SelectedH3CellInfo | null;
  onClearSelection?: () => void;
  onBoundarySelectionChange?: (layerType: BoundaryLayerType | null, selectedIds: string[]) => void;
  enableAIMode?: boolean;
  onAreaAnalyzed?: (precinctNames: string[]) => void;
  onIQAction?: (action: IQAction) => void;
}

/**
 * Draw/buffer flows copy ArcGIS ring coordinates in the map's spatial reference (usually Web Mercator).
 */
function inferGeoJsonPlanarWkid(geometry: GeoJSON.Geometry): 4326 | 3857 {
  const nums: number[] = [];
  const walk = (g: GeoJSON.Geometry) => {
    if (g.type === 'Point') nums.push(...g.coordinates);
    else if (g.type === 'LineString') g.coordinates.forEach((c) => nums.push(c[0], c[1]));
    else if (g.type === 'Polygon') g.coordinates.forEach((ring) => ring.forEach((c) => nums.push(c[0], c[1])));
    else if (g.type === 'MultiPolygon') {
      g.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach((c) => nums.push(c[0], c[1]))));
    }
  };
  walk(geometry);
  const maxAbs = nums.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return maxAbs > 180 ? 3857 : 4326;
}

function isFiniteExtent(xmin: number, ymin: number, xmax: number, ymax: number): boolean {
  return (
    [xmin, ymin, xmax, ymax].every((n) => Number.isFinite(n)) &&
    xmin <= xmax &&
    ymin <= ymax
  );
}

/** GeoJSON rings → ArcGIS Polygon in the given planar WKID (4326 or 3857). */
function geoJsonToArcgisPolygonInSR(
  geometry: GeoJSON.Geometry,
  wkid: number,
): __esri.Polygon | null {
  try {
    if (geometry.type === 'Polygon') {
      const rings = geometry.coordinates as number[][][];
      if (!rings?.length) return null;
      return new Polygon({ rings, spatialReference: { wkid } });
    }
    if (geometry.type === 'MultiPolygon') {
      const polys = geometry.coordinates as number[][][][];
      const rings: number[][][] = [];
      for (const poly of polys) {
        for (const ring of poly) rings.push(ring);
      }
      if (rings.length === 0) return null;
      return new Polygon({ rings, spatialReference: { wkid } });
    }
    return null;
  } catch {
    return null;
  }
}

function geojsonBBox(
  geometry: GeoJSON.Geometry,
): { xmin: number; ymin: number; xmax: number; ymax: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  const walk = (g: GeoJSON.Geometry) => {
    if (g.type === 'Point') {
      xs.push(g.coordinates[0]);
      ys.push(g.coordinates[1]);
    } else if (g.type === 'LineString') {
      g.coordinates.forEach((c) => {
        xs.push(c[0]);
        ys.push(c[1]);
      });
    } else if (g.type === 'Polygon') {
      g.coordinates.forEach((ring) =>
        ring.forEach((c) => {
          xs.push(c[0]);
          ys.push(c[1]);
        }),
      );
    } else if (g.type === 'MultiPolygon') {
      g.coordinates.forEach((poly) =>
        poly.forEach((ring) =>
          ring.forEach((c) => {
            xs.push(c[0]);
            ys.push(c[1]);
          }),
        ),
      );
    }
  };
  walk(geometry);
  if (xs.length === 0) return null;
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  if (!isFiniteExtent(xmin, ymin, xmax, ymax)) return null;
  return { xmin, ymin, xmax, ymax };
}

function bboxesOverlap(
  a: { xmin: number; ymin: number; xmax: number; ymax: number },
  b: { xmin: number; ymin: number; xmax: number; ymax: number },
): boolean {
  return !(a.xmax < b.xmin || a.xmin > b.xmax || a.ymax < b.ymin || a.ymin > b.ymax);
}

async function selectionGeometryToPolygon4326(
  geometry: GeoJSON.Geometry,
): Promise<__esri.Polygon | null> {
  const wkid = inferGeoJsonPlanarWkid(geometry);
  const local = geoJsonToArcgisPolygonInSR(geometry, wkid);
  if (!local) return null;
  await projection.load();
  const out = projection.project(local, { wkid: 4326 }) as __esri.Polygon | null;
  return out ?? null;
}

/** Project selection into the map SR and zoom; avoids mis-tagged 4326 extents that blank the view. */
async function goToSelectionGeometry(
  mapView: __esri.MapView,
  geometry: GeoJSON.Geometry,
): Promise<void> {
  try {
    const wkid = inferGeoJsonPlanarWkid(geometry);
    const local = geoJsonToArcgisPolygonInSR(geometry, wkid);
    if (!local) return;
    await projection.load();
    const projected = projection.project(local, mapView.spatialReference) as __esri.Polygon | null;
    const ext = projected?.extent;
    if (!ext || !isFiniteExtent(ext.xmin, ext.ymin, ext.xmax, ext.ymax)) return;
    if (!Number.isFinite(ext.width) || !Number.isFinite(ext.height) || ext.width <= 0 || ext.height <= 0) {
      return;
    }
    await mapView.goTo(ext.expand(1.3), { duration: 500 });
  } catch (e) {
    console.warn('[goToSelectionGeometry] Zoom skipped:', e);
  }
}

/** PA block group / census tract files ship broken polygon coords; Census internal points are valid WGS84. */
async function goToBoundaryCentroids(
  mapView: __esri.MapView,
  points: [number, number][],
): Promise<void> {
  if (points.length === 0) return;
  try {
    await projection.load();
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    const ymin = Math.min(...ys);
    const ymax = Math.max(...ys);
    const pad = 0.02;
    const extent4326 = new Extent({
      xmin: xmin - pad,
      ymin: ymin - pad,
      xmax: xmax + pad,
      ymax: ymax + pad,
      spatialReference: { wkid: 4326 },
    });
    const projected = projection.project(extent4326, mapView.spatialReference) as __esri.Extent | null;
    if (!projected?.width || !projected?.height) return;
    await mapView.goTo(projected.expand(1.2), { duration: 500 });
  } catch (e) {
    console.warn('[goToBoundaryCentroids] Zoom skipped:', e);
  }
}

export function PoliticalAnalysisPanel({
  view,
  onGenerateReport,
  className = '',
  selectedPrecinct,
  selectedH3Cell,
  onClearSelection,
  onBoundarySelectionChange,
  onIQAction,
}: PoliticalAnalysisPanelProps) {
  // State
  const [activeTab, setActiveTab] = useState<'select' | 'results' | 'report' | 'infographics'>('select');
  const [selectedArea, setSelectedArea] = useState<PoliticalAreaSelection | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AreaAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetingSummary, setTargetingSummary] = useState<TargetingScoreSummary | null>(null);
  const [precinctDetails, setPrecinctDetails] = useState<any | null>(null);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);

  // PDF generation progress tracking
  const [pdfProgress, setPdfProgress] = useState<{
    stage: string;
    percent: number;
  } | null>(null);

  // Infographics state
  const [infographicReports, setInfographicReports] = useState<Report[]>([]);
  const [selectedInfographicTemplate, setSelectedInfographicTemplate] = useState<string | null>(null);
  const [infographicSearchQuery, setInfographicSearchQuery] = useState('');
  const [infographicCategory, setInfographicCategory] = useState('All');
  const [bufferType, setBufferType] = useState<'none' | 'radius' | 'drive' | 'walk'>('none');
  const [bufferValue, setBufferValue] = useState<number>(1);
  const [infographicLoading, setInfographicLoading] = useState(false);
  const [infographicError, setInfographicError] = useState<string | null>(null);
  const [generatedInfographicHtml, setGeneratedInfographicHtml] = useState<string | null>(null);
  const [infographicDialogOpen, setInfographicDialogOpen] = useState(false);

  // Report page selection (all pages enabled by default)
  const [selectedPages, setSelectedPages] = useState<Record<number, boolean>>({
    1: true, // Cover
    2: true, // Political Overview
    3: true, // Election History
    4: true, // Demographics
    5: true, // Political Attitudes
    6: true, // Engagement & Psychographics
    7: true, // AI Analysis
  });

  const pageDescriptions: Record<number, string> = {
    1: 'Cover - Area summary, key metrics',
    2: 'Political Overview - Partisan lean, swing potential',
    3: 'Election History - Recent results, trends',
    4: 'Demographics - Population, age, income',
    5: 'Political Attitudes - Ideology, party registration',
    6: 'Engagement - Activism, media consumption',
    7: 'AI Analysis - Insights, recommendations',
  };

  // Load precinct details when selection changes (map attributes + unified service for gaps)
  useEffect(() => {
    if (!selectedPrecinct) {
      setPrecinctDetails(null);
      return;
    }

    const attrs = selectedPrecinct.attributes || {};
    const pa = isPaPrecinctAttributes(attrs);
    const unifiedKey =
      (attrs.precinct_id as string | undefined) ||
      (attrs.UNIQUE_ID as string | undefined) ||
      selectedPrecinct.precinctId;

    let cancelled = false;

    (async () => {
      let unified: Awaited<
        ReturnType<typeof politicalDataService.getUnifiedPrecinct>
      > = null;
      if (unifiedKey) {
        try {
          unified = await politicalDataService.getUnifiedPrecinct(String(unifiedKey));
        } catch {
          // ignore
        }
      }
      if (cancelled) return;

      const leanAttr = attrs.partisan_lean;
      const swingAttr = attrs.swing_potential;
      // PA unified `electoral.partisanLean` is stored in SegmentEngine convention (negative ≈ Dem);
      // map/choropleth `partisan_lean` is raw targeting (positive ≈ Dem). formatLean() expects D+ / R+.
      const unifiedLeanRaw = unified?.electoral?.partisanLean;
      const leanFromUnified =
        unifiedLeanRaw != null && !Number.isNaN(Number(unifiedLeanRaw))
          ? pa
            ? -Number(unifiedLeanRaw)
            : Number(unifiedLeanRaw)
          : null;
      const leanNum =
        leanAttr != null && leanAttr !== ''
          ? Number(leanAttr)
          : leanFromUnified;
      const swingNum =
        swingAttr != null && swingAttr !== ''
          ? Number(swingAttr)
          : unified?.electoral?.swingPotential;

      const registeredVoters = Number(
        attrs.Registered_Voters ??
        attrs.registered_voters ??
        unified?.demographics?.registeredVoters ??
        0,
      );
      const population = Number(
        attrs.total_population ?? unified?.demographics?.totalPopulation ?? 0,
      );

      console.log('[PoliticalAnalysisPanel] Precinct card:', {
        displayName: selectedPrecinct.precinctName,
        unifiedKey,
        pa,
        leanNum,
        swingNum,
      });

      setPrecinctDetails({
        name:
          (attrs.precinct_name as string) ||
          (attrs.NAME as string) ||
          selectedPrecinct.precinctName,
        locationLine: pa
          ? formatPaPrecinctLocation(attrs)
          : formatPrecinctLocationFallback(selectedPrecinct.county),
        partisanLean:
          leanNum != null && !Number.isNaN(leanNum) ? leanNum : null,
        swingPotential:
          swingNum != null && !Number.isNaN(swingNum) ? swingNum : null,
        registeredVoters,
        gotvPriority: Number(
          attrs.gotv_priority ?? unified?.targeting?.gotvPriority ?? 0,
        ),
        persuasionOpportunity: Number(
          attrs.persuasion_opportunity ??
          unified?.targeting?.persuasionOpportunity ??
          0,
        ),
        targetingStrategy:
          (attrs.targeting_strategy as string) ||
          unified?.targeting?.strategy ||
          'Unknown',
        population,
        combinedScore: Number(attrs.combined_score ?? 0),
        gotvClassification:
          (attrs.gotv_classification as string) || 'Unknown',
        persuasionClassification:
          (attrs.persuasion_classification as string) || 'Unknown',
        recommendation:
          (attrs.recommendation as string) || 'No data available',
        medianIncome: Number(attrs.median_income ?? 0),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPrecinct]);

  // Load county-wide targeting summary on mount
  useEffect(() => {
    const loadTargetingSummary = async () => {
      try {
        const summary = await politicalDataService.getTargetingScoresSummary();
        if (summary) {
          setTargetingSummary(summary);
        }
      } catch (err) {
        console.error('Error loading targeting summary:', err);
      }
    };
    loadTargetingSummary();
  }, []);

  // Whitelist of allowed infographic templates (define here for use in useEffect)
  const ALLOWED_INFOGRAPHIC_TEMPLATES_LIST = [
    'Community Summary (Esri 2025)',
    'Employment Overview (Esri 2025)',
    'State of the Community (Esri 2025)',
    'Tapestry Demographic Summary (Esri 2025)',
  ];

  // Load infographic reports directly from ArcGIS (bypasses ReportsService which excludes Esri 2025)
  useEffect(() => {
    const loadInfographicReports = async () => {
      try {
        console.log('[PoliticalAnalysisPanel] Loading infographic reports directly from ArcGIS...');

        const token = (process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '').trim();
        if (!token) {
          const msg =
            'Missing NEXT_PUBLIC_ARCGIS_API_KEY in environment. Add it to .env.local and restart the dev server.';
          console.error(`[PoliticalAnalysisPanel] ${msg}`);
          setInfographicError(msg);
          return;
        }

        const tokenQ = encodeURIComponent(token);

        const thumbnailUrlForItem = (item: {
          id: string;
          thumbnail?: string;
        }): string => {
          const t = item.thumbnail?.trim();
          if (t?.startsWith('http')) return t;
          if (t) {
            return `https://www.arcgis.com/sharing/rest/content/items/${item.id}/info/${t}?token=${tokenQ}`;
          }
          return `https://www.arcgis.com/sharing/rest/content/items/${item.id}/info/thumbnail/thumbnail.png?token=${tokenQ}`;
        };

        // Fetch all Synapse54 Report Templates with pagination
        const allItems: Array<{ id: string; title: string; thumbnail?: string; snippet?: string }> = [];
        let start = 1;
        let hasMore = true;

        while (hasMore && allItems.length < 300) {
          const url = `https://www.arcgis.com/sharing/rest/search?q=owner:Synapse54 AND type:"Report Template"&f=pjson&token=${tokenQ}&num=100&start=${start}&sortField=title&sortOrder=asc`;

          const response = await fetch(url);
          if (!response.ok) break;

          const data = await response.json();
          if (!data.results || !Array.isArray(data.results)) break;

          allItems.push(...data.results);
          hasMore = data.results.length === 100 && data.nextStart;
          start = data.nextStart || start + 100;
        }

        console.log(`[PoliticalAnalysisPanel] Fetched ${allItems.length} total templates`);

        // Filter to only allowed templates
        const filteredReports = allItems
          .filter(item => ALLOWED_INFOGRAPHIC_TEMPLATES_LIST.includes(item.title || ''))
          .map(item => ({
            id: item.id,
            title: item.title || 'Untitled',
            description: item.snippet || 'Census demographic infographic',
            thumbnail: thumbnailUrlForItem(item),
            categories: ['Census', 'Demographics'],
          }));

        setInfographicReports(filteredReports);
        console.log('[PoliticalAnalysisPanel] Loaded whitelisted infographic reports:', filteredReports.map(r => r.title));
      } catch (err) {
        console.error('[PoliticalAnalysisPanel] Error loading infographic reports:', err);
      }
    };
    loadInfographicReports();
  }, []);

  // Get available infographic categories
  const infographicCategories = useMemo(() => {
    const categories = new Set<string>();
    infographicReports.forEach(report => {
      (report.categories || ['Other']).forEach(cat => categories.add(cat));
    });
    return ['All', ...Array.from(categories).sort()];
  }, [infographicReports]);

  // Filter infographic reports (already pre-filtered at fetch, but apply search/category filters)
  const filteredInfographicReports = useMemo(() => {
    return infographicReports
      .filter(report =>
        (infographicCategory === 'All' || (report.categories || []).includes(infographicCategory)) &&
        report.title.toLowerCase().includes(infographicSearchQuery.toLowerCase())
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [infographicReports, infographicCategory, infographicSearchQuery]);

  // Generate infographic report
  const generateInfographic = useCallback(async () => {
    if (!selectedInfographicTemplate || !view) {
      setInfographicError('Please select a template and ensure an area is selected');
      return;
    }

    const locationLabel =
      analysisResult?.areaName ??
      selectedArea?.displayName ??
      selectedPrecinct?.precinctName ??
      'Selected area';

    // Prefer geometries for **all precincts** in the IQ result so Census matches Results totals.
    // 1) Use the same combined MultiPolygon the map built on Analyze (avoids ID mismatch with boundary files).
    // 2) Else rebuild from boundary GeoJSON using precinct keys from analysis / selection metadata.
    // GeoEnrichment CreateReport often applies Infographic templates to the **first** study area only when
    // multiple studyAreas are sent — so we send **one** multipart polygon (all outer rings) below.
    let effectiveGeoJson: GeoJSON.Geometry | null = null;
    const selectionMulti =
      selectedArea?.geometry?.type === 'MultiPolygon'
        ? (selectedArea.geometry as GeoJSON.MultiPolygon)
        : null;

    // Same GeoJSON the map combined when you picked multiple precincts — best match to IQ voter totals.
    if (
      selectionMulti &&
      selectionMulti.coordinates.length > 1 &&
      selectedArea?.metadata?.boundaryType === 'precinct'
    ) {
      effectiveGeoJson = selectionMulti;
    }

    if (!effectiveGeoJson && analysisResult && analysisResult.includedPrecincts.length > 0) {
      const keys = analysisResult.includedPrecincts.map((p) => p.name).filter(Boolean);
      if (keys.length > 0) {
        effectiveGeoJson = await buildMultiPolygonFromPrecinctKeys(keys);
      }
    }

    if (!effectiveGeoJson && selectedArea?.metadata?.boundaryNames?.length) {
      const keys = selectedArea.metadata.boundaryNames.filter(Boolean);
      if (keys.length > 0) {
        effectiveGeoJson = await buildMultiPolygonFromPrecinctKeys(keys);
      }
    }

    if (!effectiveGeoJson && selectedArea?.geometry) {
      effectiveGeoJson = selectedArea.geometry;
    }

    // Get ArcGIS geometry from GeoJSON or map graphic
    let geometry: __esri.Geometry | null = null;

    if (effectiveGeoJson) {
      const Point = (await import('@arcgis/core/geometry/Point')).default;
      const Polygon = (await import('@arcgis/core/geometry/Polygon')).default;

      if (effectiveGeoJson.type === 'Point') {
        const pt = effectiveGeoJson as GeoJSON.Point;
        geometry = new Point({
          longitude: pt.coordinates[0],
          latitude: pt.coordinates[1],
          spatialReference: { wkid: 4326 },
        });
      } else if (effectiveGeoJson.type === 'Polygon') {
        const poly = effectiveGeoJson as GeoJSON.Polygon;
        geometry = new Polygon({
          rings: poly.coordinates,
          spatialReference: { wkid: 4326 },
        });
      } else if (effectiveGeoJson.type === 'MultiPolygon') {
        const multi = effectiveGeoJson as GeoJSON.MultiPolygon;
        geometry = new Polygon({
          rings: multi.coordinates.flat(1) as number[][][],
          spatialReference: { wkid: 4326 },
        });
      }
    } else if (selectedPrecinct?.geometry) {
      geometry = selectedPrecinct.geometry;
    }

    if (!geometry) {
      setInfographicError('No geometry available. Please select an area first.');
      return;
    }

    setInfographicLoading(true);
    setInfographicError(null);
    setGeneratedInfographicHtml(null);

    try {
      if (!(process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '').trim()) {
        throw new Error(
          'Missing NEXT_PUBLIC_ARCGIS_API_KEY. Add it to .env.local and restart the dev server.',
        );
      }

      // Build study area(s) for GeoEnrichment CreateReport.
      // Polygons must use plain geometry + optional attributes — not areaType "StandardGeography"
      // (that type requires IntersectingGeographies). See Esri CreateReport polygon example.
      let studyAreas: any[];

      if (effectiveGeoJson?.type === 'MultiPolygon') {
        const multi = effectiveGeoJson as GeoJSON.MultiPolygon;
        // Single study area with one multipart polygon so Esri aggregates ACS across all rings (precincts).
        // Multiple studyAreas[] entries often yield Infographic stats for the first polygon only.
        const rings = multi.coordinates.flat(1) as number[][][];
        studyAreas = [
          {
            geometry: {
              rings,
              spatialReference: { wkid: 4326 },
            },
            attributes: { id: '1', name: locationLabel },
          },
        ];
      } else if (geometry.type === 'point' && bufferType !== 'none') {
        const point = geometry as __esri.Point;
        const base = {
          geometry: {
            x: point.longitude,
            y: point.latitude,
            spatialReference: { wkid: 4326 },
          },
        };
        if (bufferType === 'radius') {
          studyAreas = [
            {
              ...base,
              areaType: 'RingBuffer',
              bufferUnits: 'esriMiles',
              bufferRadii: [bufferValue],
            },
          ];
        } else if (bufferType === 'drive') {
          studyAreas = [
            {
              ...base,
              areaType: 'DriveTimeBuffer',
              bufferUnits: 'esriDriveTimeUnitsMinutes',
              bufferRadii: [bufferValue],
            },
          ];
        } else if (bufferType === 'walk') {
          studyAreas = [
            {
              ...base,
              areaType: 'WalkTimeBuffer',
              bufferUnits: 'esriWalkTimeUnitsMinutes',
              bufferRadii: [bufferValue],
            },
          ];
        } else {
          studyAreas = [
            {
              ...base,
              areaType: 'RingBuffer',
              bufferUnits: 'esriMiles',
              bufferRadii: [bufferValue],
            },
          ];
        }
      } else if (geometry.type === 'polygon') {
        const polygon = geometry as __esri.Polygon;
        studyAreas = [
          {
            geometry: {
              rings: polygon.rings,
              spatialReference: { wkid: 4326 },
            },
            attributes: { id: '1', name: locationLabel },
          },
        ];
      } else {
        const point = geometry as __esri.Point;
        studyAreas = [
          {
            geometry: {
              x: point.longitude,
              y: point.latitude,
              spatialReference: { wkid: 4326 },
            },
            areaType: 'RingBuffer',
            bufferUnits: 'esriMiles',
            bufferRadii: [1],
            attributes: { id: '1', name: locationLabel },
          },
        ];
      }

      console.log('[PoliticalAnalysisPanel] Generating infographic with:', {
        template: selectedInfographicTemplate,
        studyAreas,
        bufferType,
        bufferValue,
      });

      const response = await fetch('/api/arcgis/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyAreas,
          reportTemplate: selectedInfographicTemplate,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.details || data.error || 'Failed to generate infographic');
      }

      setGeneratedInfographicHtml(data.reportHtml);
      setInfographicDialogOpen(true);
      console.log('[PoliticalAnalysisPanel] Infographic generated successfully');

    } catch (err) {
      console.error('[PoliticalAnalysisPanel] Infographic generation error:', err);
      setInfographicError(err instanceof Error ? err.message : 'Failed to generate infographic');
    } finally {
      setInfographicLoading(false);
    }
  }, [selectedInfographicTemplate, view, selectedArea, selectedPrecinct, analysisResult, bufferType, bufferValue]);

  /**
   * Generate AI-powered insights based on analysis results
   * Produces strategic recommendations for campaign planning
   */
  const generateAIInsights = useCallback((result: AreaAnalysisResult): string[] => {
    const insights: string[] = [];
    const lean = result.weightedPartisanLean;
    const swing = result.weightedSwingPotential;
    const gotv = result.targetingScores?.avgGOTVPriority || 0;
    const persuasion = result.targetingScores?.avgPersuasionOpportunity || 0;
    const voters = result.totalRegisteredVoters;
    const turnout = result.estimatedTurnout;

    if (result.totalPrecincts === 0 || voters === 0) {
      insights.push(
        'No precincts intersect your buffer or drawn shape. Enlarge the buffer, redraw over Pennsylvania, or use the Select tab to choose precincts.',
      );
      return insights;
    }

    // Partisan lean insight
    if (Math.abs(lean) < 5) {
      if (Math.abs(lean) < 0.05) {
        insights.push(
          'This area is highly competitive with an essentially even partisan lean. Expect tight margins in upcoming elections — every vote matters here.',
        );
      } else {
        const leanLabel =
          lean > 0
            ? `D+${lean.toFixed(1)}`
            : lean < 0
              ? `R+${Math.abs(lean).toFixed(1)}`
              : 'even';
        insights.push(
          `This area is highly competitive with a lean of ${leanLabel}. Expect tight margins in upcoming elections — every vote matters here.`,
        );
      }
    } else if (lean > 15) {
      insights.push(`Strong Democratic territory (D+${lean.toFixed(1)}). Focus on turnout operations rather than persuasion. Base mobilization is key.`);
    } else if (lean < -15) {
      insights.push(`Strong Republican territory (R+${Math.abs(lean).toFixed(1)}). Resources may be better deployed in competitive areas unless defending incumbents.`);
    } else if (lean > 5) {
      insights.push(`Democratic-leaning area (D+${lean.toFixed(1)}) with persuasion opportunity. Target moderate voters while maintaining base turnout.`);
    } else {
      insights.push(`Republican-leaning area (R+${Math.abs(lean).toFixed(1)}). Consider targeted outreach to swing voters and crossover appeal.`);
    }

    // Swing potential insight
    if (swing > 60) {
      insights.push(`High swing potential (${swing.toFixed(0)}%) indicates significant electoral volatility. Historical patterns show this area can shift dramatically between elections.`);
    } else if (swing > 40) {
      insights.push(`Moderate swing potential (${swing.toFixed(0)}%). Monitor closely for shifting voter sentiment.`);
    }

    // GOTV vs Persuasion strategy
    if (gotv > persuasion + 15) {
      insights.push(`GOTV priority is significantly higher than persuasion opportunity (${gotv.toFixed(0)} vs ${persuasion.toFixed(0)}). Invest in turnout operations: voter registration, early vote outreach, and election day mobilization.`);
    } else if (persuasion > gotv + 15) {
      insights.push(`Persuasion opportunity exceeds GOTV priority (${persuasion.toFixed(0)} vs ${gotv.toFixed(0)}). Focus messaging resources here: direct mail, digital ads, and canvassing conversations.`);
    } else {
      insights.push(`Balanced targeting scores suggest a hybrid approach: combine voter contact programs with turnout infrastructure for maximum impact.`);
    }

    // Voter population insight
    const turnoutRate = turnout / voters * 100;
    if (voters > 50000) {
      insights.push(`Large voter population (${voters.toLocaleString()} registered) requires significant resource allocation. Consider staging multiple canvass launches and satellite offices.`);
    }
    if (turnoutRate < 60) {
      insights.push(`Projected turnout of ${turnoutRate.toFixed(0)}% suggests room for mobilization gains. Aggressive early vote programs could yield significant returns.`);
    }

    // Strategy distribution insight
    const strategies = result.targetingScores?.strategyDistribution || {};
    const topStrategy = Object.entries(strategies).sort(([, a], [, b]) => b - a)[0];
    if (topStrategy && result.totalPrecincts > 0) {
      const [strategy, count] = topStrategy;
      const percentage = ((count / result.totalPrecincts) * 100).toFixed(0);
      insights.push(`${percentage}% of precincts recommend "${strategy}" strategy. This should inform your overall campaign approach for this area.`);
    }

    return insights;
  }, []);

  // Handle area selection
  const handleAreaSelected = useCallback(async (selection: PoliticalAreaSelection) => {
    console.log('[PoliticalAnalysisPanel] Area selected:', selection.displayName);
    setSelectedArea(selection);
    setError(null);
    setAnalysisResult(null); // Clear previous results
    setIsAnalyzing(true);
    setActiveTab('results');

    // Zoom map (block group / census tract polygons in PA data are invalid; use Census internal points)
    if (view && selection.geometry) {
      try {
        const cents = selection.metadata.boundaryCentroids;
        const bt = selection.metadata.boundaryType;
        if (
          selection.method === 'boundary-select' &&
          (bt === 'block-group' || bt === 'census-tract') &&
          Array.isArray(cents) &&
          cents.length > 0
        ) {
          await goToBoundaryCentroids(view, cents);
        } else {
          await goToSelectionGeometry(view, selection.geometry);
        }
      } catch (zoomError) {
        console.warn('[PoliticalAnalysisPanel] Could not zoom to selection:', zoomError);
      }
    }

    try {
      // Analyze the selected area
      const result = await analyzeArea(selection);
      setAnalysisResult(result);

      // Generate AI-powered strategic insights
      const insights = generateAIInsights(result);
      setAiInsights(insights);

      // Dispatch analysis completion to state manager for AI context awareness
      getStateManager().dispatch({
        type: 'ANALYSIS_COMPLETED',
        payload: {
          result: {
            areaName: result.areaName,
            precincts: result.includedPrecincts,
            aggregatedMetrics: {
              avg_swing_potential: result.weightedSwingPotential,
              total_registered_voters: result.totalRegisteredVoters,
              avg_turnout:
                result.totalRegisteredVoters > 0
                  ? result.estimatedTurnout / result.totalRegisteredVoters
                  : 0,
            },
            timestamp: new Date(),
          }
        },
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('Error analyzing area:', err);
      setError('Failed to analyze selected area');
      setAnalysisResult(null);
      setAiInsights(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [view, generateAIInsights]);

  /**
   * Analyze the selected area
   *
   * Performs comprehensive political analysis on the selected area:
   * 1. Loads precinct-level data from PoliticalDataService
   * 2. Determines which precincts are included based on selection method
   * 3. Calculates voter-weighted aggregate metrics:
   *    - Partisan lean (D/R/Swing classification)
   *    - Swing potential (volatility)
   *    - GOTV priority (mobilization opportunity)
   *    - Persuasion opportunity (swing voter targeting)
   * 4. Generates targeting strategy recommendations
   */
  const analyzeArea = async (selection: PoliticalAreaSelection): Promise<AreaAnalysisResult> => {
    // Initialize service
    await politicalDataService.initialize();

    // Load precinct scores using the service
    const allPrecinctScores = await politicalDataService.getAllPrecinctScores();
    const allTargetingScores = await politicalDataService.getAllTargetingScores();

    // Precinct pick lists only: names are UNIQUE_IDs. ZIP/tract/etc. must use spatial ∩ precincts.
    const isPrecinctIdListSelection =
      (selection.method === 'boundary-select' || selection.method === 'click-select') &&
      selection.metadata.boundaryType === 'precinct' &&
      Array.isArray(selection.metadata.boundaryNames) &&
      selection.metadata.boundaryNames.length > 0;

    if (isPrecinctIdListSelection) {
      const includedPrecincts = selection.metadata.boundaryNames!.map((name) => {
        const scores =
          allPrecinctScores.get(name) ??
          Array.from(allPrecinctScores.values()).find((s) => s.precinctName === name);
        const targeting = allTargetingScores[name] as unknown as Record<string, unknown> | undefined;

        return {
          name,
          overlapRatio: 1,
          registeredVoters:
            Number(targeting?.registered_voters) ||
            Number(targeting?.active_voters) ||
            0,
          partisanLean: resolvePartisanLeanForDisplay(scores, targeting),
        };
      });

      const scoresRecord: Record<string, any> = {};
      allPrecinctScores.forEach((scores, name) => {
        scoresRecord[name] = {
          partisan_lean: scores.partisanLean.value,
          swing_potential: scores.swingPotential.value,
          turnout: scores.turnout,
          classification: {
            competitiveness: scores.partisanLean.classification,
            volatility: scores.swingPotential.classification,
            targeting_priority: scores.targetingPriority,
          },
        };
      });

      return calculateAggregateMetrics(selection, includedPrecincts, scoresRecord, allTargetingScores);
    }

    // For other methods (draw, click-buffer, search): real polygon ∩ precinct (WGS84 file data)
    const boundaries = await loadBoundaryFeatureCollection(BOUNDARY_LAYERS.precinct);

    const selectionPoly4326 = await selectionGeometryToPolygon4326(selection.geometry);
    if (!selectionPoly4326) {
      throw new Error('Could not build selection geometry for spatial filter');
    }

    const ext4326 = selectionPoly4326.extent;
    const selBbox =
      ext4326 &&
        isFiniteExtent(ext4326.xmin, ext4326.ymin, ext4326.xmax, ext4326.ymax)
        ? {
          xmin: ext4326.xmin,
          ymin: ext4326.ymin,
          xmax: ext4326.xmax,
          ymax: ext4326.ymax,
        }
        : null;
    const intersectingPrecincts: Array<{
      name: string;
      overlapRatio: number;
      registeredVoters: number;
      partisanLean: number;
    }> = [];

    for (const feature of boundaries.features) {
      const g = feature.geometry;
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;

      const props = feature.properties as Record<string, unknown> | undefined;
      const precinctKey =
        props?.UNIQUE_ID != null && String(props.UNIQUE_ID) !== ''
          ? String(props.UNIQUE_ID)
          : props?.precinct_id != null && String(props.precinct_id) !== ''
            ? String(props.precinct_id)
            : props?.NAME != null && String(props.NAME) !== ''
              ? String(props.NAME)
              : '';
      if (!precinctKey) continue;

      if (selBbox) {
        const precBbox = geojsonBBox(g);
        if (!precBbox || !bboxesOverlap(selBbox, precBbox)) continue;
      }

      const precinctPoly = geoJsonToArcgisPolygonInSR(g, 4326);
      if (!precinctPoly) continue;

      let hits = false;
      try {
        hits = geometryEngine.intersects(selectionPoly4326, precinctPoly);
      } catch {
        continue;
      }
      if (!hits) continue;

      const scores =
        allPrecinctScores.get(precinctKey) ??
        Array.from(allPrecinctScores.values()).find((s) => s.precinctName === precinctKey);
      const targeting = allTargetingScores[precinctKey];

      intersectingPrecincts.push({
        name: precinctKey,
        overlapRatio: 1,
        registeredVoters:
          Number(targeting?.registered_voters) ||
          Number(targeting?.active_voters) ||
          0,
        partisanLean: resolvePartisanLeanForDisplay(scores, targeting),
      });
    }

    // Convert Map to Record for compatibility
    const scoresRecord: Record<string, any> = {};
    allPrecinctScores.forEach((scores, name) => {
      scoresRecord[name] = {
        partisan_lean: scores.partisanLean.value,
        swing_potential: scores.swingPotential.value,
        turnout: scores.turnout,
        classification: {
          competitiveness: scores.partisanLean.classification,
          volatility: scores.swingPotential.classification,
          targeting_priority: scores.targetingPriority,
        },
      };
    });

    return calculateAggregateMetrics(selection, intersectingPrecincts, scoresRecord, allTargetingScores);
  };

  // Calculate aggregate metrics from included precincts
  const calculateAggregateMetrics = (
    selection: PoliticalAreaSelection,
    includedPrecincts: Array<{
      name: string;
      overlapRatio: number;
      registeredVoters: number;
      partisanLean: number;
    }>,
    allScores: Record<string, any>,
    targetingScores: Record<string, any>
  ): AreaAnalysisResult => {
    // Calculate weighted metrics
    let totalVoters = 0;
    let totalActiveVoters = 0;
    let weightedLean = 0;
    let weightedSwing = 0;
    let weightedGOTV = 0;
    let weightedPersuasion = 0;
    let weightedTurnout = 0;
    const strategyCount: Record<string, number> = {};

    for (const precinct of includedPrecincts) {
      const voters = precinct.registeredVoters * precinct.overlapRatio;
      const scores = allScores[precinct.name] || {};
      const targeting = targetingScores[precinct.name] || {};

      totalVoters += voters;
      totalActiveVoters +=
        (Number(targeting.active_voters) || voters) * precinct.overlapRatio;

      const tp = readTargetingPoliticalOverrides(targeting);
      const leanValue =
        scores.partisan_lean ??
        scores.partisanLean?.value ??
        tp.partisan_lean ??
        0;
      const swingValue =
        scores.swing_potential ??
        scores.swingPotential?.value ??
        tp.swing_potential ??
        0;
      const turnoutValue = scores.turnout?.average ?? scores.turnout?.averageTurnout ?? 65;

      weightedLean += leanValue * voters;
      weightedSwing += swingValue * voters;
      weightedTurnout += turnoutValue * voters;
      weightedGOTV += (Number(targeting.gotv_priority) || 0) * voters;
      weightedPersuasion += (Number(targeting.persuasion_opportunity) || 0) * voters;

      // Count targeting strategies
      const strategy = String(targeting.targeting_strategy || 'Unknown');
      strategyCount[strategy] = (strategyCount[strategy] || 0) + 1;
    }

    const avgLean = totalVoters > 0 ? weightedLean / totalVoters : 0;
    const avgSwing = totalVoters > 0 ? weightedSwing / totalVoters : 0;
    const avgGOTV = totalVoters > 0 ? weightedGOTV / totalVoters : 0;
    const avgPersuasion = totalVoters > 0 ? weightedPersuasion / totalVoters : 0;
    const avgTurnout = totalVoters > 0 ? weightedTurnout / totalVoters : 65;

    // Determine dominant party
    const dominantParty: 'D' | 'R' | 'Swing' =
      avgLean > 5 ? 'D' : avgLean < -5 ? 'R' : 'Swing';

    // Determine competitiveness based on partisan lean
    let competitiveness: AreaAnalysisResult['classification']['competitiveness'];
    if (avgLean >= 20) competitiveness = 'Safe D';
    else if (avgLean >= 10) competitiveness = 'Likely D';
    else if (avgLean >= 5) competitiveness = 'Lean D';
    else if (avgLean > -5) competitiveness = 'Tossup';
    else if (avgLean > -10) competitiveness = 'Lean R';
    else if (avgLean > -20) competitiveness = 'Likely R';
    else competitiveness = 'Safe R';

    // Determine targeting priority based on multiple factors
    let targetingPriority: AreaAnalysisResult['classification']['targetingPriority'];
    const isCompetitive = Math.abs(avgLean) < 10;
    const isHighSwing = avgSwing >= 60;
    const isModerateSwing = avgSwing >= 40;

    if (isCompetitive && isHighSwing) {
      targetingPriority = 'High';
    } else if (isCompetitive || (isModerateSwing && Math.abs(avgLean) < 15)) {
      targetingPriority = 'Medium-High';
    } else if (isModerateSwing || Math.abs(avgLean) < 20) {
      targetingPriority = 'Medium';
    } else {
      targetingPriority = 'Low';
    }

    // Calculate persuasion and mobilization indices
    // Persuasion Index: Higher for swing areas with moderate lean
    const persuasionIndex = Math.round(
      avgSwing * 0.6 + (100 - Math.abs(avgLean)) * 0.4
    );

    // Mobilization Index: Higher for aligned areas with lower turnout
    const turnoutGap = Math.max(0, 75 - avgTurnout);
    const alignment = Math.abs(avgLean);
    const mobilizationIndex = Math.round(
      alignment * 0.5 + turnoutGap * 0.5
    );

    // Estimate turnout based on historical average
    const estimatedTurnout = Math.round(totalVoters * (avgTurnout / 100));

    return {
      areaName: selection.displayName,
      selectionMethod: selection.method,
      totalPrecincts: includedPrecincts.length,
      includedPrecincts,
      totalRegisteredVoters: Math.round(totalVoters),
      estimatedTurnout,
      weightedPartisanLean: Math.round(avgLean * 10) / 10,
      weightedSwingPotential: Math.round(avgSwing * 10) / 10,
      dominantParty,
      classification: {
        competitiveness,
        targetingPriority,
        persuasionIndex: Math.min(100, Math.max(0, persuasionIndex)),
        mobilizationIndex: Math.min(100, Math.max(0, mobilizationIndex)),
      },
      targetingScores: {
        avgGOTVPriority: Math.round(avgGOTV * 10) / 10,
        avgPersuasionOpportunity: Math.round(avgPersuasion * 10) / 10,
        strategyDistribution: strategyCount,
      },
    };
  };

  // Capture map thumbnail from the current view
  const captureMapThumbnail = useCallback(async (): Promise<string | undefined> => {
    if (!view) return undefined;

    try {
      // Use ArcGIS MapView takeScreenshot method
      const screenshot = await view.takeScreenshot({
        format: 'png',
        width: 400,
        height: 300,
        quality: 80,
      });

      // Return base64 data URL
      return screenshot.dataUrl;
    } catch (err) {
      console.warn('[PoliticalAnalysisPanel] Could not capture map thumbnail:', err);
      return undefined;
    }
  }, [view]);

  // Handle report generation with progress tracking
  const handleGenerateReport = useCallback(async () => {
    if (!selectedArea || !analysisResult) return;

    try {
      setIsAnalyzing(true);
      setError(null);
      setPdfProgress({ stage: 'Preparing data...', percent: 10 });

      // Extract precinct names from the analysis result
      const precinctNames = analysisResult.includedPrecincts.map(p => p.name);

      // Capture map thumbnail
      setPdfProgress({ stage: 'Capturing map thumbnail...', percent: 20 });
      console.log('[PoliticalAnalysisPanel] Capturing map thumbnail...');
      const mapThumbnail = await captureMapThumbnail();

      // Get selected page numbers
      const pagesToInclude = Object.entries(selectedPages)
        .filter(([_, enabled]) => enabled)
        .map(([page]) => parseInt(page));

      // Prepare request body
      setPdfProgress({ stage: 'Sending to server...', percent: 30 });
      const requestBody = {
        precinctNames,
        areaName: analysisResult.areaName,
        areaDescription: selectedArea.displayName !== analysisResult.areaName ? selectedArea.displayName : undefined,
        areaSelection: selectedArea,
        includeH3: false,
        mapThumbnail,
        selectedPages: pagesToInclude, // New: pass page selection to API
      };

      console.log('[PoliticalAnalysisPanel] Generating PDF for precincts:', precinctNames, 'with map thumbnail:', !!mapThumbnail, 'pages:', pagesToInclude);

      // Call API endpoint
      setPdfProgress({ stage: 'Generating PDF pages...', percent: 50 });
      const response = await fetch('/api/political-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Download the PDF
      setPdfProgress({ stage: 'Downloading PDF...', percent: 90 });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Political_Profile_${analysisResult.areaName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setPdfProgress({ stage: 'Complete!', percent: 100 });
      console.log('[PoliticalAnalysisPanel] PDF downloaded successfully');

      // Call optional callback
      if (onGenerateReport) {
        onGenerateReport(selectedArea, analysisResult);
      }

      // Reset progress after a short delay
      setTimeout(() => setPdfProgress(null), 1500);
    } catch (err) {
      console.error('[PoliticalAnalysisPanel] Error generating PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
      setPdfProgress(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedArea, analysisResult, onGenerateReport, selectedPages, captureMapThumbnail]);

  // Reset to selection view
  const handleReset = useCallback(() => {
    setSelectedArea(null);
    setAnalysisResult(null);
    setError(null);
    setActiveTab('select');
    view?.graphics.removeAll();
  }, [view]);

  // Get partisan lean color
  const getLeanColor = (lean: number): string => {
    if (lean >= 20) return 'bg-blue-600 text-white';
    if (lean >= 10) return 'bg-blue-400 text-white';
    if (lean >= 5) return 'bg-blue-200';
    if (lean > -5) return 'bg-gray-200';
    if (lean > -10) return 'bg-red-200';
    if (lean > -20) return 'bg-red-400 text-white';
    return 'bg-red-600 text-white';
  };

  // Format partisan lean
  const formatLean = (lean: number): string => {
    const prefix = lean > 0 ? 'D+' : lean < 0 ? 'R+' : '';
    return `${prefix}${Math.abs(lean).toFixed(1)}`;
  };

  // Get GOTV priority classification
  const getGOTVClassification = (score: number): string => {
    if (score >= 75) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    if (score >= 20) return 'Low';
    return 'Minimal';
  };

  // Get persuasion opportunity classification
  const getPersuasionClassification = (score: number): string => {
    if (score >= 75) return 'Excellent';
    if (score >= 60) return 'Strong';
    if (score >= 40) return 'Moderate';
    if (score >= 20) return 'Limited';
    return 'Minimal';
  };

  // Get targeting strategy badge color
  const getStrategyBadgeVariant = (strategy: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (strategy === 'Battleground') return 'destructive';
    if (strategy === 'Base Mobilization') return 'default';
    if (strategy === 'Persuasion Target') return 'secondary';
    return 'outline';
  };

  // Get targeting strategy color class
  const getStrategyColor = (strategy: string): string => {
    if (strategy === 'Battleground') return 'bg-red-500 text-white';
    if (strategy === 'Base Mobilization') return 'bg-blue-500 text-white';
    if (strategy === 'Persuasion Target') return 'bg-purple-500 text-white';
    return 'bg-gray-500 text-white';
  };

  // Strategy tooltips with explanations
  const STRATEGY_TOOLTIPS: Record<string, string> = {
    'Battleground': 'Highly competitive precincts where both GOTV and persuasion efforts are critical. Target swing voters and maximize turnout.',
    'Base Mobilization': 'Strong partisan lean with potential turnout gains. Focus on getting your base to the polls rather than persuasion.',
    'Persuasion Target': 'Significant persuadable voter population. Focus messaging on undecided voters and soft partisans.',
    'Maintenance': 'Safe territory requiring minimal resources. Maintain presence but prioritize other areas.',
    'Low Priority': 'Limited opportunity for impact. Deprioritize unless part of broader regional strategy.',
    'Unknown': 'Insufficient data to determine optimal strategy. Consider gathering more local intelligence.',
  };

  // Get strategy tooltip text
  const getStrategyTooltip = (strategy: string): string => {
    return STRATEGY_TOOLTIPS[strategy] || STRATEGY_TOOLTIPS['Unknown'];
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`w-full h-full flex flex-col ${className}`}>
        {/* IQBuilder Header - pr-10 to avoid overlap with collapse button */}
        <div className="flex items-center gap-2 px-4 pr-10 py-3 border-b border-gray-100">
          <Image src="/mpiq_pin2.png" alt="IQ" width={20} height={20} />
          <div className="flex text-sm font-bold">
            <span className="text-[#33a852]">IQ</span>
            <span className="text-gray-900 -ml-px">builder</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              const newTab = v as typeof activeTab;
              setActiveTab(newTab);
              // Dispatch to state manager for AI context awareness
              getStateManager().dispatch({
                type: 'IQBUILDER_TAB_CHANGED',
                payload: { tab: newTab },
                timestamp: new Date(),
              });
            }}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="mx-4 mt-4 grid grid-cols-4 shrink-0">
              <TabsTrigger value="select" className="text-xs px-2 flex items-center gap-1 ">
                <MapPin className="size-4 mb-1" />
                Select
              </TabsTrigger>
              <TabsTrigger
                value="results"
                disabled={!analysisResult}
                className="text-xs px-2 flex items-center gap-1 "
              >
                <BarChart3 className="size-4 mb-1" />
                Results
              </TabsTrigger>
              <TabsTrigger
                value="report"
                disabled={!analysisResult}
                className="text-xs px-2 flex items-center gap-1 "
              >
                <FileText className="size-4 mb-1" />
                Report
              </TabsTrigger>
              <TabsTrigger
                value="infographics"
                className="text-xs px-2 flex items-center gap-1 "
              >
                <PieChart className="size-4 mb-1" />
                Census
              </TabsTrigger>
            </TabsList>

            {/* Selection Tab */}
            <TabsContent value="select" className="flex-1 overflow-auto p-4 m-0">

              {/* QuickStartIQ Button - Opens dialog with predefined queries */}
              <div className="mb-4">
                <QuickStartIQDialog
                  hasSelection={!!(selectedArea || selectedPrecinct || selectedH3Cell)}
                  onQuerySelect={(query, metadata) => {
                    console.log('[QuickStartIQ] Query selected:', query, metadata);
                    onIQAction?.({
                      type: 'quickstart',
                      action: 'predefined-query',
                      data: {
                        query,
                        category: metadata?.category,
                        visualType: metadata?.visualType,
                        metric: metadata?.metric,
                        queryId: metadata?.queryId,
                      }
                    });
                  }}
                />
                {!(selectedArea || selectedPrecinct || selectedH3Cell) && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Select an area below to enable QuickStartIQ
                  </p>
                )}
              </div>

              {/* Selected Precinct Card */}
              {selectedPrecinct && precinctDetails && (
                <div className="mb-4 bg-gradient-to-br from-emerald-50 to-white border-2 border-[#33a852] rounded-xl p-4 space-y-3 shadow-md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-3 w-3 text-[#33a852]" />
                        <h3 className="font-semibold text-xs text-gray-900">Selected Precinct</h3>
                      </div>
                      <p className="text-xs font-medium text-gray-900">{precinctDetails.name}</p>
                      <p className="text-xs text-gray-700">{precinctDetails.locationLine}</p>
                    </div>
                    {onClearSelection && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearSelection}
                        className="h-7 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-emerald-100"
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/80 rounded-lg p-2 border border-emerald-100 shadow-sm">
                      <span className="text-[#33a852] font-medium block mb-1">
                        <MetricLabel metric="partisan_lean">Partisan Lean</MetricLabel>
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          precinctDetails.partisanLean != null
                            ? getLeanColor(precinctDetails.partisanLean)
                            : 'bg-gray-100 text-gray-600'
                        }
                      >
                        {precinctDetails.partisanLean != null
                          ? formatLean(precinctDetails.partisanLean)
                          : 'N/A'}
                      </Badge>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-emerald-100 shadow-sm">
                      <span className="text-[#33a852] font-medium block mb-1">
                        <MetricLabel metric="swing_potential">Swing Potential</MetricLabel>
                      </span>
                      <span className="font-bold text-gray-900">
                        {precinctDetails.swingPotential != null
                          ? `${precinctDetails.swingPotential.toFixed(0)}/100`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-emerald-100 shadow-sm">
                      <span className="text-[#33a852] font-medium block mb-1">Voters</span>
                      <span className="font-bold text-gray-900">{precinctDetails.registeredVoters.toLocaleString()}</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-emerald-100 shadow-sm">
                      <span className="text-[#33a852] font-medium block mb-1">Population</span>
                      <span className="font-bold text-gray-900">
                        {precinctDetails.population > 0
                          ? precinctDetails.population.toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-emerald-200">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium">
                          <MetricLabel metric="gotv_priority">GOTV Priority</MetricLabel>
                        </span>
                        <span className="font-bold text-[#33a852]">{precinctDetails.gotvPriority.toFixed(0)}</span>
                      </div>
                      <Progress value={precinctDetails.gotvPriority} className="h-1.5 [&>div]:bg-[#33a852]" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium">
                          <MetricLabel metric="persuasion_opportunity">Persuasion</MetricLabel>
                        </span>
                        <span className="font-bold text-[#33a852]">{precinctDetails.persuasionOpportunity.toFixed(0)}</span>
                      </div>
                      <Progress value={precinctDetails.persuasionOpportunity} className="h-1.5 [&>div]:bg-[#33a852]" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-200">
                    <span className="text-xs text-gray-700 font-medium block mb-1">Strategy</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          className={`text-xs cursor-help ${getStrategyColor(precinctDetails.targetingStrategy)}`}
                        >
                          {precinctDetails.targetingStrategy}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>{getStrategyTooltip(precinctDetails.targetingStrategy)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}

              {/* Selected H3 Cell Card */}
              {selectedH3Cell && (
                <div className="mb-4 bg-gradient-to-br from-blue-50 to-white border-2 border-blue-500 rounded-xl p-4 space-y-3 shadow-md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="h-3 w-3 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.18l6.27 3.48v6.68L12 17.82l-6.27-3.48V7.66L12 4.18z" />
                        </svg>
                        <h3 className="font-semibold text-xs text-gray-900">Selected H3 Cell</h3>
                      </div>
                      <p className="text-xs font-mono text-gray-700 truncate">{selectedH3Cell.h3Index}</p>
                      <p className="text-xs text-gray-600">{selectedH3Cell.precinctCount} precinct{selectedH3Cell.precinctCount !== 1 ? 's' : ''}</p>
                    </div>
                    {onClearSelection && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearSelection}
                        className="h-7 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-blue-100"
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100 shadow-sm">
                      <span className="text-blue-600 font-medium block mb-1">
                        <MetricLabel metric="partisan_lean">Partisan Lean</MetricLabel>
                      </span>
                      <Badge
                        variant="outline"
                        className={getLeanColor(selectedH3Cell.attributes?.partisan_lean || 0)}
                      >
                        {formatLean(selectedH3Cell.attributes?.partisan_lean || 0)}
                      </Badge>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100 shadow-sm">
                      <span className="text-blue-600 font-medium block mb-1">
                        <MetricLabel metric="swing_potential">Swing Potential</MetricLabel>
                      </span>
                      <span className="font-bold text-gray-900">{(selectedH3Cell.attributes?.swing_potential || 0).toFixed(0)}/100</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100 shadow-sm">
                      <span className="text-blue-600 font-medium block mb-1">Population</span>
                      <span className="font-bold text-gray-900">{Math.round(selectedH3Cell.attributes?.total_population || 0).toLocaleString()}</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100 shadow-sm">
                      <span className="text-blue-600 font-medium block mb-1">Combined Score</span>
                      <span className="font-bold text-gray-900">{(selectedH3Cell.attributes?.combined_score || 0).toFixed(0)}/100</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-blue-200">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium">
                          <MetricLabel metric="gotv_priority">GOTV Priority</MetricLabel>
                        </span>
                        <span className="font-bold text-blue-600">{(selectedH3Cell.attributes?.gotv_priority || 0).toFixed(0)}</span>
                      </div>
                      <Progress value={selectedH3Cell.attributes?.gotv_priority || 0} className="h-1.5 [&>div]:bg-blue-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium">
                          <MetricLabel metric="persuasion_opportunity">Persuasion</MetricLabel>
                        </span>
                        <span className="font-bold text-blue-600">{(selectedH3Cell.attributes?.persuasion_opportunity || 0).toFixed(0)}</span>
                      </div>
                      <Progress value={selectedH3Cell.attributes?.persuasion_opportunity || 0} className="h-1.5 [&>div]:bg-blue-600" />
                    </div>
                  </div>

                  {/* Precincts in cell */}
                  {selectedH3Cell.precincts && selectedH3Cell.precincts.length > 0 && (
                    <div className="pt-2 border-t border-blue-200">
                      <span className="text-xs text-gray-700 font-medium block mb-1">Precincts</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedH3Cell.precincts.slice(0, 3).map((precinct: string) => (
                          <Badge key={precinct} variant="secondary" className="text-xs">
                            {precinct.length > 25 ? precinct.slice(0, 25) + '...' : precinct}
                          </Badge>
                        ))}
                        {selectedH3Cell.precincts.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{selectedH3Cell.precincts.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <PoliticalAreaSelector
                view={view}
                onAreaSelected={handleAreaSelected}
                onSelectionCanceled={handleReset}
                onBoundarySelectionChange={onBoundarySelectionChange}
              />
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="flex-1 overflow-hidden p-0 m-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {isAnalyzing && (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-xs text-muted-foreground">Analyzing area...</p>
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{error}</AlertDescription>
                    </Alert>
                  )}

                  {analysisResult && !isAnalyzing && (
                    <>
                      {/* Area Summary */}
                      <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-4 border-l-4 border-[#33a852] shadow-sm">
                        <h3 className="font-semibold text-xs mb-2 flex items-center gap-2 text-gray-900">
                          <MapPin className="h-3 w-3 text-[#33a852]" />
                          {analysisResult.areaName}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-600">Precincts:</span>
                            <span className="ml-1 font-medium text-gray-900">{analysisResult.totalPrecincts}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Voters:</span>
                            <span className="ml-1 font-medium text-gray-900">
                              {analysisResult.totalRegisteredVoters.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AI Strategic Insights */}
                      {aiInsights && aiInsights.length > 0 && (
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200 shadow-sm">
                          <h4 className="text-xs font-semibold flex items-center gap-2 text-purple-900 mb-3">
                            <Zap className="h-3.5 w-3.5 text-purple-600" />
                            Strategic Insights
                          </h4>
                          <div className="space-y-2">
                            {aiInsights.map((insight, idx) => (
                              <div key={idx} className="flex gap-2 text-xs text-gray-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                                <p className="leading-relaxed">{insight}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Political Lean */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium flex items-center gap-2">
                          <BarChart3 className="h-3 w-3 text-[#33a852]" />
                          Political Profile
                        </h4>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={getLeanColor(analysisResult.weightedPartisanLean)}
                          >
                            {formatLean(analysisResult.weightedPartisanLean)}
                          </Badge>
                          <Badge variant="secondary">
                            {analysisResult.classification.competitiveness}
                          </Badge>
                        </div>

                        {/* Partisan lean bar */}
                        <div className="relative h-3 bg-gradient-to-r from-red-500 via-gray-300 to-blue-500 rounded-full">
                          <div
                            className="absolute w-3 h-3 bg-white border-2 border-gray-800 rounded-full transform -translate-y-0"
                            style={{
                              left: `${Math.min(Math.max((analysisResult.weightedPartisanLean + 50) / 100 * 100, 2), 98)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>R+50</span>
                          <span>Even</span>
                          <span>D+50</span>
                        </div>
                      </div>

                      {/* Targeting Metrics */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium flex items-center gap-2">
                          <TrendingUp className="h-3 w-3 text-[#33a852]" />
                          Targeting Metrics
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <MetricLabel metric="swing_potential">Swing Potential</MetricLabel>
                              <span className="font-medium text-[#33a852]">
                                {analysisResult.weightedSwingPotential.toFixed(0)}%
                              </span>
                            </div>
                            <Progress value={analysisResult.weightedSwingPotential} className="h-2 [&>div]:bg-[#33a852]" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <MetricLabel metric="persuasion_index">Persuasion Index</MetricLabel>
                              <span className="font-medium text-[#33a852]">
                                {analysisResult.classification.persuasionIndex}
                              </span>
                            </div>
                            <Progress
                              value={analysisResult.classification.persuasionIndex}
                              className="h-2 [&>div]:bg-[#33a852]"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <MetricLabel metric="mobilization_index">Mobilization Index</MetricLabel>
                              <span className="font-medium text-[#33a852]">
                                {analysisResult.classification.mobilizationIndex}
                              </span>
                            </div>
                            <Progress
                              value={analysisResult.classification.mobilizationIndex}
                              className="h-2 [&>div]:bg-[#33a852]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Priority Badge */}
                      <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-4 border border-emerald-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-900">
                            <MetricLabel metric="targeting_priority">Targeting Priority</MetricLabel>
                          </span>
                          <Badge
                            className={
                              analysisResult.classification.targetingPriority === 'High'
                                ? 'bg-red-600 text-white'
                                : analysisResult.classification.targetingPriority === 'Medium-High'
                                  ? 'bg-[#33a852] text-white'
                                  : 'bg-gray-500 text-white'
                            }
                          >
                            {analysisResult.classification.targetingPriority}
                          </Badge>
                        </div>
                      </div>

                      {/* Targeting Scores Section */}
                      {analysisResult.targetingScores && (
                        <div className="space-y-2 border-t pt-4">
                          <h4 className="text-xs font-medium flex items-center gap-2">
                            <Target className="h-3 w-3 text-[#33a852]" />
                            Voter Targeting Scores
                          </h4>

                          {/* GOTV Priority */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-medium">
                                <MetricLabel metric="gotv_priority">GOTV Priority</MetricLabel>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#33a852]">
                                  {analysisResult.targetingScores.avgGOTVPriority.toFixed(0)}
                                </span>
                                <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                                  {getGOTVClassification(analysisResult.targetingScores.avgGOTVPriority)}
                                </Badge>
                              </div>
                            </div>
                            <Progress
                              value={analysisResult.targetingScores.avgGOTVPriority}
                              className="h-2 [&>div]:bg-[#33a852]"
                            />
                            <p className="text-xs text-muted-foreground">
                              Mobilization potential for existing supporters
                            </p>
                          </div>

                          {/* Persuasion Opportunity */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-medium">
                                <MetricLabel metric="persuasion_opportunity">Persuasion Opportunity</MetricLabel>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#33a852]">
                                  {analysisResult.targetingScores.avgPersuasionOpportunity.toFixed(0)}
                                </span>
                                <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                                  {getPersuasionClassification(analysisResult.targetingScores.avgPersuasionOpportunity)}
                                </Badge>
                              </div>
                            </div>
                            <Progress
                              value={analysisResult.targetingScores.avgPersuasionOpportunity}
                              className="h-2 [&>div]:bg-[#33a852]"
                            />
                            <p className="text-xs text-muted-foreground">
                              Likelihood of influencing undecided voters
                            </p>
                          </div>

                          {/* Strategy Distribution */}
                          {Object.keys(analysisResult.targetingScores.strategyDistribution).length > 0 && (
                            <div className="space-y-2 pt-2">
                              <div className="text-xs font-medium">Recommended Strategies</div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(analysisResult.targetingScores.strategyDistribution)
                                  .sort(([, a], [, b]) => b - a)
                                  .map(([strategy, count]) => (
                                    <Tooltip key={strategy}>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant={getStrategyBadgeVariant(strategy)}
                                          className="text-xs cursor-help"
                                        >
                                          {strategy} ({count})
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <p>{getStrategyTooltip(strategy)}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Full-dataset strategy mix (counts from targeting JSON → %) */}
                      {targetingSummary && (() => {
                        const stratEntries = Object.entries(
                          targetingSummary.strategy_distribution,
                        );
                        const stratTotal = stratEntries.reduce(
                          (s, [, c]) => s + Number(c),
                          0,
                        );
                        return (
                          <div className="space-y-2 border-t pt-4">
                            <h4 className="text-xs font-medium flex items-center gap-2">
                              <Info className="h-3 w-3 text-[#33a852]" />
                              Statewide strategy mix (full dataset)
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {stratEntries
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 4)
                                .map(([strategy, count]) => {
                                  const pct =
                                    stratTotal > 0
                                      ? (Number(count) / stratTotal) * 100
                                      : 0;
                                  return (
                                    <Tooltip key={strategy}>
                                      <TooltipTrigger asChild>
                                        <div
                                          className="bg-muted/30 rounded-lg p-2 space-y-1 cursor-help hover:bg-muted/50 transition-colors"
                                        >
                                          <div className="flex items-center gap-1">
                                            <div className={`w-2 h-2 rounded-full ${getStrategyColor(strategy)}`} />
                                            <span className="text-xs font-medium truncate">{strategy}</span>
                                          </div>
                                          <div className="text-xs font-bold">
                                            {pct.toFixed(1)}%
                                          </div>
                                          <div className="text-[10px] text-muted-foreground">
                                            {Number(count).toLocaleString()} precincts
                                          </div>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <p>
                                          {getStrategyTooltip(strategy)} ({Number(count).toLocaleString()}{' '}
                                          precincts, {pct.toFixed(1)}% of dataset.)
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-2">
                              Dataset avg GOTV: {targetingSummary.score_stats.gotv.mean.toFixed(0)} |
                              Persuasion: {targetingSummary.score_stats.persuasion.mean.toFixed(0)}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Included Precincts */}
                      {analysisResult.includedPrecincts.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium flex items-center gap-2">
                            <Users className="h-3 w-3 text-[#33a852]" />
                            Included Precincts ({analysisResult.includedPrecincts.length})
                          </h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {analysisResult.includedPrecincts.slice(0, 10).map((precinct) => (
                              <div
                                key={precinct.name}
                                className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded"
                              >
                                <span className="truncate flex-1">{precinct.name}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-muted-foreground">
                                    {precinct.registeredVoters.toLocaleString()} voters
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getLeanColor(precinct.partisanLean)}`}
                                  >
                                    {formatLean(precinct.partisanLean)}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                            {analysisResult.includedPrecincts.length > 10 && (
                              <p className="text-xs text-muted-foreground text-center py-1">
                                +{analysisResult.includedPrecincts.length - 10} more precincts
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>

              {/* Action buttons */}
              {analysisResult && !isAnalyzing && (
                <div className="p-4 border-t flex gap-2 bg-gradient-to-r from-gray-50 to-white">
                  <Button variant="outline" size="sm" onClick={handleReset} className="flex-1 border-[#33a852] text-[#33a852] hover:bg-emerald-50">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    New Selection
                  </Button>
                  <Button size="sm" onClick={() => setActiveTab('report')} className="flex-1 bg-[#33a852] hover:bg-[#2d9944] text-white text-xs">
                    <ChevronRight className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Report Tab */}
            <TabsContent value="report" className="flex-1 overflow-auto p-4 m-0">
              {analysisResult && (
                <div className="space-y-4">
                  {/* InfographIQ Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-bold text-gray-900">Infograph<span className="text-purple-600">IQ</span></span>
                  </div>

                  {/* Status Alert */}
                  {!isAnalyzing && !error && !pdfProgress && (
                    <Alert>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-xs">
                        Ready to generate Political Profile Report for{' '}
                        <strong>{analysisResult.areaName}</strong>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Progress Tracking */}
                  {pdfProgress && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-xs font-medium text-blue-800">{pdfProgress.stage}</span>
                      </div>
                      <Progress value={pdfProgress.percent} className="h-2" />
                      <span className="text-xs text-blue-600">{pdfProgress.percent}%</span>
                    </div>
                  )}

                  {/* Error State */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Page Selection */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-xs">Report Pages</h4>
                      <span className="text-xs text-muted-foreground">
                        {Object.values(selectedPages).filter(Boolean).length} of 7 selected
                      </span>
                    </div>
                    <ul className="text-xs space-y-2">
                      {Object.entries(pageDescriptions).map(([pageNum, description]) => {
                        const page = parseInt(pageNum);
                        const isEnabled = selectedPages[page];
                        return (
                          <li key={page} className="flex items-stretch gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedPages((prev: Record<number, boolean>) => ({
                                ...prev,
                                [page]: !prev[page]
                              }))}
                              className={`flex w-full items-center gap-2 rounded p-1.5 text-left leading-snug transition-colors ${isEnabled
                                ? 'bg-green-50 text-green-800 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              disabled={isAnalyzing}
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:size-3">
                                <CheckCircle className={isEnabled ? 'text-green-600' : 'text-gray-300'} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <strong>Page {page}:</strong> {description.split(' - ')[1]}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs text-muted-foreground italic">
                      Click to toggle pages. Cover page is always recommended.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#33a852] text-[#33a852] hover:bg-emerald-50"
                      onClick={() => setActiveTab('results')}
                      disabled={isAnalyzing}
                    >
                      Back to Results
                    </Button>
                    <Button
                      className="flex-1 bg-[#33a852] hover:bg-[#2d9944] text-white text-xs [&_svg]:size-4"
                      onClick={handleGenerateReport}
                      disabled={isAnalyzing || Object.values(selectedPages).every(v => !v)}
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="shrink-0 animate-spin" aria-hidden />
                          <span className="leading-none">Generating...</span>
                        </>
                      ) : (
                        <>
                          <Download className="shrink-0" aria-hidden />
                          <span className="leading-none">
                            Generate PDF ({Object.values(selectedPages).filter(Boolean).length} pages)
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Infographics Tab */}
            <TabsContent value="infographics" className="flex-1 overflow-auto p-4 m-0">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <PieChart className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-gray-900">Census <span className="text-blue-600">Infographics</span></span>
                </div>

                {/* Current Selection Status */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-3 w-3 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">Current Selection</span>
                  </div>
                  {selectedArea || selectedPrecinct ? (
                    <p className="text-xs text-gray-600">
                      {selectedArea?.displayName || selectedPrecinct?.precinctName || 'Selected area'}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600">
                      No area selected. Go to the Select tab to choose an area.
                    </p>
                  )}
                </div>

                {/* Buffer Options (shown for point selections) */}
                {(selectedArea?.geometry?.type === 'Point' || (!selectedArea && selectedPrecinct)) && (
                  <div className="bg-blue-50 rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Circle className="h-3 w-3 text-blue-600" />
                      <span className="text-xs font-medium text-blue-800">Buffer Options</span>
                    </div>
                    <RadioGroup
                      value={bufferType}
                      onValueChange={(v: string) => setBufferType(v as typeof bufferType)}
                      className="grid grid-cols-2 gap-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="none" id="buffer-none" />
                        <Label htmlFor="buffer-none" className="text-xs">No Buffer</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="radius" id="buffer-radius" />
                        <Label htmlFor="buffer-radius" className="text-xs flex items-center gap-1">
                          <Circle className="h-3 w-3" /> Radius
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="drive" id="buffer-drive" />
                        <Label htmlFor="buffer-drive" className="text-xs flex items-center gap-1">
                          <Car className="h-3 w-3" /> Drive Time
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="walk" id="buffer-walk" />
                        <Label htmlFor="buffer-walk" className="text-xs flex items-center gap-1">
                          <Footprints className="h-3 w-3" /> Walk Time
                        </Label>
                      </div>
                    </RadioGroup>

                    {bufferType !== 'none' && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={bufferValue}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBufferValue(Number(e.target.value))}
                          className="w-20 h-8 text-xs"
                          min={1}
                          max={bufferType === 'radius' ? 50 : 60}
                        />
                        <span className="text-xs text-gray-600">
                          {bufferType === 'radius' ? 'miles' : 'minutes'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Template Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Select Template</span>
                    <span className="text-xs text-gray-500">{filteredInfographicReports.length} available</span>
                  </div>

                  {/* Search and Filter
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search templates..."
                      value={infographicSearchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfographicSearchQuery(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <select
                      value={infographicCategory}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInfographicCategory(e.target.value)}
                      className="h-8 text-xs px-2 border rounded-md bg-white"
                    >
                      {infographicCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div> */}

                  {/* Template Grid */}
                  <ScrollArea className="h-[280px] border rounded-lg">
                    <div className="grid grid-cols-2 gap-2 p-2">
                      {filteredInfographicReports.map(report => (
                        <button
                          key={report.id}
                          onClick={() => setSelectedInfographicTemplate(report.id)}
                          className={`p-2 rounded-lg border text-left transition-all ${selectedInfographicTemplate === report.id
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          {report.thumbnail && (
                            <div className="h-16 mb-2 rounded overflow-hidden bg-gray-100">
                              <img
                                src={report.thumbnail}
                                alt={report.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <p className="text-xs font-medium text-gray-900 line-clamp-2" title={report.title}>
                            {report.title}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {report.categories?.slice(0, 2).map(cat => (
                              <span key={cat} className="text-[10px] px-1 py-0.5 bg-gray-100 rounded text-gray-600">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                      {filteredInfographicReports.length === 0 && (
                        <div className="col-span-2 py-8 text-center text-gray-500 text-xs">
                          {infographicReports.length === 0 ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Loading templates...</span>
                            </div>
                          ) : (
                            'No templates match your search'
                          )}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Error Display */}
                {infographicError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{infographicError}</AlertDescription>
                  </Alert>
                )}

                {/* Generate Button */}
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={generateInfographic}
                  disabled={!selectedInfographicTemplate || infographicLoading || (!selectedArea && !selectedPrecinct)}
                >
                  {infographicLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <PieChart className="h-4 w-4 mr-2" />
                      Generate Infographic
                    </>
                  )}
                </Button>

                {!selectedInfographicTemplate && (
                  <p className="text-xs text-gray-500 text-center">
                    Select a template above to generate an infographic
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Infographic Viewer Dialog */}
          <Dialog open={infographicDialogOpen} onOpenChange={setInfographicDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-600" />
                  Census Infographic
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-auto min-h-0">
                {generatedInfographicHtml ? (
                  <iframe
                    srcDoc={generatedInfographicHtml}
                    title="Infographic Report"
                    className="w-full h-full min-h-[600px] border-0"
                  />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
                <Button variant="outline" onClick={() => setInfographicDialogOpen(false)}>
                  Close
                </Button>
                {generatedInfographicHtml && (
                  <Button
                    onClick={() => {
                      const blob = new Blob([generatedInfographicHtml], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default PoliticalAnalysisPanel;
