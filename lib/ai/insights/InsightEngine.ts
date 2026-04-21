/**
 * InsightEngine - Cross-Domain Correlation for Serendipitous Discoveries
 * Phase 13 Implementation
 *
 * Surfaces unexpected insights by cross-referencing:
 * - Donor data with GOTV precincts
 * - Tapestry segments with turnout patterns
 * - Demographics with swing behavior
 * - Geographic clustering patterns
 * - Cross-tool exploration connections
 */

import type {
  Insight,
  InsightCategory,
  InsightCheckConfig,
  InsightCheckResult,
  InsightConfidence,
  InsightDataPoint,
  InsightEngineConfig,
  InsightStorage,
  InsightTrigger,
  DonorGotvOverlapParams,
  TapestryTurnoutParams,
  DemographicSwingParams,
  GeographicClusterParams,
  CrossToolConnectionParams,
} from './types';

import { DEFAULT_INSIGHT_CONFIG } from './types';
import { INSIGHT_TEMPLATES } from './insightTemplates';

// ZIP-Precinct Crosswalk data structure
interface ZipPrecinctCrosswalk {
  metadata: {
    description: string;
    source: string;
    created: string;
    county: string;
    state: string;
  };
  zipToPrecincts: Record<string, {
    zipCode: string;
    name: string;
    primaryJurisdiction: string;
    precincts: string[];
    coverage: string;
    secondaryJurisdiction?: string;
  }>;
  precinctToZips: Record<string, string[]>;
  jurisdictionZips: Record<string, string[]>;
}

// Singleton instance
let insightEngineInstance: InsightEngine | null = null;

// Cached crosswalk data
let crosswalkData: ZipPrecinctCrosswalk | null = null;

/**
 * Get the InsightEngine singleton
 */
export function getInsightEngine(): InsightEngine {
  if (!insightEngineInstance) {
    insightEngineInstance = new InsightEngine();
  }
  return insightEngineInstance;
}

class InsightEngine {
  private config: InsightEngineConfig;
  private storage: InsightStorage;
  private readonly STORAGE_KEY = 'pol_insight_storage';
  private initialized: boolean = false;

  constructor(config?: Partial<InsightEngineConfig>) {
    this.config = { ...DEFAULT_INSIGHT_CONFIG, ...config };
    this.storage = this.loadStorage();
    // Preload crosswalk data asynchronously
    this.initialize();
  }

  /**
   * Initialize the engine by preloading crosswalk data
   * Called automatically in constructor, but can be called manually
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadCrosswalkData();
      this.initialized = true;
      if (this.config.debug) {
        console.log('[InsightEngine] Initialized with crosswalk data');
      }
    } catch (error) {
      console.warn('[InsightEngine] Failed to initialize crosswalk:', error);
      // Continue without crosswalk - will use legacy fallback
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * Check for insights based on current context
   */
  async checkForInsights(checkConfig: InsightCheckConfig): Promise<InsightCheckResult> {
    const startTime = Date.now();
    const insights: Insight[] = [];
    const checksPerformed: string[] = [];

    // Check minimum exploration depth
    if (
      checkConfig.minExplorationDepth &&
      checkConfig.minExplorationDepth < this.config.minExplorationDepth
    ) {
      return {
        hasInsight: false,
        insights: [],
        checksPerformed: ['skipped_low_exploration'],
        duration: Date.now() - startTime,
      };
    }

    // Check minimum time between insights
    if (this.storage.lastCheckAt) {
      const timeSinceLastCheck = Date.now() - new Date(this.storage.lastCheckAt).getTime();
      if (timeSinceLastCheck < this.config.minTimeBetweenInsights) {
        return {
          hasInsight: false,
          insights: [],
          checksPerformed: ['skipped_cooldown'],
          duration: Date.now() - startTime,
        };
      }
    }

    // Run enabled correlation checks
    for (const category of this.config.enabledCategories) {
      checksPerformed.push(category);

      try {
        const insight = await this.runCorrelationCheck(category, checkConfig);
        if (insight && !this.isDuplicate(insight)) {
          insights.push(insight);
          this.recordInsight(insight);
        }
      } catch (error) {
        if (this.config.debug) {
          console.error(`[InsightEngine] Error in ${category} check:`, error);
        }
      }
    }

    // Update last check time
    this.storage.lastCheckAt = new Date();
    this.saveStorage();

    return {
      hasInsight: insights.length > 0,
      insights,
      checksPerformed,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check for donor-GOTV overlap insight
   */
  checkDonorGotvOverlap(params: DonorGotvOverlapParams): Insight | null {
    const threshold = params.threshold ?? 50;

    // Get ZIP codes for GOTV precincts using precinct-to-ZIP mapping
    const gotvZips = new Set(this.getZipsForPrecincts(params.gotvPrecincts));

    // Count overlapping ZIPs and total donor amounts
    let overlapCount = 0;
    let totalDonorAmount = 0;
    const overlappingZips: Array<{ zip: string; amount: number }> = [];

    for (const donor of params.donorZips) {
      totalDonorAmount += donor.totalAmount;
      if (gotvZips.has(donor.zip)) {
        overlappingZips.push({ zip: donor.zip, amount: donor.totalAmount });
        overlapCount++;
      }
    }

    const overlapPercentage = (overlapCount / gotvZips.size) * 100;

    if (overlapPercentage >= threshold && overlappingZips.length >= 3) {
      const template = INSIGHT_TEMPLATES.donor_gotv_overlap;
      const topZips = overlappingZips
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      return this.buildInsight({
        category: 'donor_gotv_overlap',
        priority: 'high',
        confidence: 'medium',
        title: this.interpolate(template.titleTemplate, {
          count: overlappingZips.length,
        }),
        message: this.interpolate(template.messageTemplate, {
          count: overlappingZips.length,
          gotvCount: params.gotvPrecincts.length,
          topZips: topZips.map(z => z.zip).join(', '),
          totalAmount: this.formatCurrency(totalDonorAmount),
        }),
        shortMessage: this.interpolate(template.shortMessageTemplate, {
          count: overlappingZips.length,
        }),
        dataPoints: [
          {
            label: 'Overlapping ZIP codes',
            value: overlappingZips.length,
          },
          {
            label: 'GOTV precincts',
            value: params.gotvPrecincts.length,
          },
          {
            label: 'Total donor amount',
            value: this.formatCurrency(totalDonorAmount),
          },
        ],
        relatedZips: overlappingZips.map(z => z.zip),
        relatedPrecincts: params.gotvPrecincts.slice(0, 5),
        icon: template.icon,
        trigger: 'filter_applied',
      });
    }

    return null;
  }

  /**
   * Check for unusual tapestry-turnout patterns
   */
  checkTapestryTurnout(params: TapestryTurnoutParams): Insight | null {
    const deviationThreshold = params.deviationThreshold ?? 1.5;

    // Calculate turnout by tapestry segment
    const segmentTurnout = new Map<string, number[]>();

    for (const data of params.turnoutData) {
      if (!segmentTurnout.has(data.tapestryCode)) {
        segmentTurnout.set(data.tapestryCode, []);
      }
      segmentTurnout.get(data.tapestryCode)!.push(data.turnout);
    }

    // Calculate mean and std dev
    const allTurnouts = params.turnoutData.map(d => d.turnout);
    const mean = allTurnouts.reduce((a, b) => a + b, 0) / allTurnouts.length;
    const variance =
      allTurnouts.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / allTurnouts.length;
    const stdDev = Math.sqrt(variance);

    // Find outlier segments
    const outliers: Array<{
      code: string;
      name: string;
      avgTurnout: number;
      deviation: number;
    }> = [];

    for (const [code, turnouts] of segmentTurnout) {
      const segmentMean = turnouts.reduce((a, b) => a + b, 0) / turnouts.length;
      const deviation = (segmentMean - mean) / stdDev;

      if (Math.abs(deviation) >= deviationThreshold) {
        const segment = params.tapestrySegments.find(s => s.code === code);
        outliers.push({
          code,
          name: segment?.name || code,
          avgTurnout: segmentMean,
          deviation,
        });
      }
    }

    if (outliers.length > 0) {
      // Sort by absolute deviation
      outliers.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
      const topOutlier = outliers[0];

      const template = INSIGHT_TEMPLATES.tapestry_turnout;
      const direction = topOutlier.deviation > 0 ? 'higher' : 'lower';
      const electionLabel =
        params.electionType === 'presidential'
          ? 'presidential'
          : params.electionType === 'midterm'
            ? 'midterm'
            : 'primary';

      return this.buildInsight({
        category: 'tapestry_turnout',
        priority: 'medium',
        confidence: 'high',
        title: this.interpolate(template.titleTemplate, {
          segmentName: topOutlier.name,
        }),
        message: this.interpolate(template.messageTemplate, {
          segmentName: topOutlier.name,
          direction,
          deviation: Math.abs(topOutlier.deviation).toFixed(1),
          electionType: electionLabel,
          avgTurnout: (topOutlier.avgTurnout * 100).toFixed(1),
          countyAvg: (mean * 100).toFixed(1),
        }),
        shortMessage: this.interpolate(template.shortMessageTemplate, {
          segmentName: topOutlier.name,
          direction,
        }),
        dataPoints: [
          {
            label: `${topOutlier.name} turnout`,
            value: `${(topOutlier.avgTurnout * 100).toFixed(1)}%`,
          },
          {
            label: 'County average',
            value: `${(mean * 100).toFixed(1)}%`,
          },
          {
            label: 'Standard deviations',
            value: `${topOutlier.deviation > 0 ? '+' : ''}${topOutlier.deviation.toFixed(1)}σ`,
          },
        ],
        relatedSegments: outliers.map(o => o.code),
        icon: template.icon,
        trigger: 'filter_applied',
      });
    }

    return null;
  }

  /**
   * Check for demographic-swing correlations
   */
  checkDemographicSwing(params: DemographicSwingParams): Insight | null {
    const correlationThreshold = params.correlationThreshold ?? 0.6;

    // Calculate correlations for each demographic variable
    const swingScores = params.precincts.map(p => p.swingPotential);

    const correlations: Array<{
      variable: string;
      label: string;
      correlation: number;
    }> = [];

    // Check college education correlation
    const collegeValues = params.precincts
      .map(p => p.demographics.collegeEducated)
      .filter((v): v is number => v !== undefined);

    if (collegeValues.length >= 5) {
      const correlation = this.pearsonCorrelation(
        swingScores.slice(0, collegeValues.length),
        collegeValues
      );
      correlations.push({
        variable: 'collegeEducated',
        label: 'college education',
        correlation,
      });
    }

    // Check median age correlation
    const ageValues = params.precincts
      .map(p => p.demographics.medianAge)
      .filter((v): v is number => v !== undefined);

    if (ageValues.length >= 5) {
      const correlation = this.pearsonCorrelation(
        swingScores.slice(0, ageValues.length),
        ageValues
      );
      correlations.push({
        variable: 'medianAge',
        label: 'median age',
        correlation,
      });
    }

    // Check income correlation
    const incomeValues = params.precincts
      .map(p => p.demographics.medianIncome)
      .filter((v): v is number => v !== undefined);

    if (incomeValues.length >= 5) {
      const correlation = this.pearsonCorrelation(
        swingScores.slice(0, incomeValues.length),
        incomeValues
      );
      correlations.push({
        variable: 'medianIncome',
        label: 'median income',
        correlation,
      });
    }

    // Find strongest correlation
    const strongCorrelations = correlations.filter(
      c => Math.abs(c.correlation) >= correlationThreshold
    );

    if (strongCorrelations.length > 0) {
      strongCorrelations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
      const strongest = strongCorrelations[0];

      const template = INSIGHT_TEMPLATES.demographic_swing;
      const direction = strongest.correlation > 0 ? 'positively' : 'negatively';

      return this.buildInsight({
        category: 'demographic_swing',
        priority: 'medium',
        confidence: strongest.correlation > 0.7 ? 'high' : 'medium',
        title: this.interpolate(template.titleTemplate, {
          demographic: strongest.label,
        }),
        message: this.interpolate(template.messageTemplate, {
          demographic: strongest.label,
          direction,
          correlation: Math.abs(strongest.correlation).toFixed(2),
          implication:
            strongest.correlation > 0
              ? `higher ${strongest.label} correlates with higher swing potential`
              : `lower ${strongest.label} correlates with higher swing potential`,
        }),
        shortMessage: this.interpolate(template.shortMessageTemplate, {
          demographic: strongest.label,
        }),
        dataPoints: correlations.map(c => ({
          label: `${c.label} correlation`,
          value: c.correlation.toFixed(2),
        })),
        icon: template.icon,
        trigger: 'segment_created',
      });
    }

    return null;
  }

  /**
   * Check for geographic clusters
   */
  checkGeographicCluster(params: GeographicClusterParams): Insight | null {
    const clusterThreshold = params.clusterThreshold ?? 5; // km

    // Group precincts by proximity
    const clusters: Array<{
      precincts: typeof params.precincts;
      centroid: [number, number];
      avgMetric: number;
    }> = [];

    const unclustered = [...params.precincts];

    while (unclustered.length > 0) {
      const seed = unclustered.shift()!;
      const cluster = [seed];

      // Find nearby precincts
      for (let i = unclustered.length - 1; i >= 0; i--) {
        const distance = this.haversineDistance(seed.centroid, unclustered[i].centroid);
        if (distance <= clusterThreshold) {
          cluster.push(unclustered.splice(i, 1)[0]);
        }
      }

      if (cluster.length >= 3) {
        const avgLat = cluster.reduce((sum, p) => sum + p.centroid[1], 0) / cluster.length;
        const avgLng = cluster.reduce((sum, p) => sum + p.centroid[0], 0) / cluster.length;
        const avgMetric =
          cluster.reduce((sum, p) => sum + (p.metrics[params.metric] || 0), 0) /
          cluster.length;

        clusters.push({
          precincts: cluster,
          centroid: [avgLng, avgLat],
          avgMetric,
        });
      }
    }

    // Find significant clusters (high metric values)
    const significantClusters = clusters.filter(c => c.avgMetric > 70);

    if (significantClusters.length > 0) {
      const largest = significantClusters.sort(
        (a, b) => b.precincts.length - a.precincts.length
      )[0];

      const template = INSIGHT_TEMPLATES.geographic_cluster;

      return this.buildInsight({
        category: 'geographic_cluster',
        priority: 'medium',
        confidence: 'high',
        title: this.interpolate(template.titleTemplate, {
          metric: params.metric.replace(/_/g, ' '),
        }),
        message: this.interpolate(template.messageTemplate, {
          count: largest.precincts.length,
          metric: params.metric.replace(/_/g, ' '),
          avgValue: largest.avgMetric.toFixed(0),
          precincts: largest.precincts
            .slice(0, 3)
            .map(p => p.id)
            .join(', '),
        }),
        shortMessage: this.interpolate(template.shortMessageTemplate, {
          count: largest.precincts.length,
          metric: params.metric.replace(/_/g, ' '),
        }),
        dataPoints: [
          {
            label: 'Cluster size',
            value: largest.precincts.length,
            unit: 'precincts',
          },
          {
            label: `Average ${params.metric.replace(/_/g, ' ')}`,
            value: largest.avgMetric.toFixed(0),
          },
        ],
        relatedPrecincts: largest.precincts.map(p => p.id),
        icon: template.icon,
        trigger: 'exploration_milestone',
      });
    }

    return null;
  }

  /**
   * Check for cross-tool connections
   */
  checkCrossToolConnection(params: CrossToolConnectionParams): Insight | null {
    const minOverlap = params.minOverlap ?? 3;

    // Group exploration by tool
    const toolPrecincts = new Map<string, Set<string>>();

    for (const entry of params.explorationHistory) {
      if (!toolPrecincts.has(entry.tool)) {
        toolPrecincts.set(entry.tool, new Set());
      }
      for (const precinct of entry.precincts) {
        toolPrecincts.get(entry.tool)!.add(precinct);
      }
    }

    // Find overlaps between tools
    const tools = Array.from(toolPrecincts.keys());
    const connections: Array<{
      tool1: string;
      tool2: string;
      overlap: string[];
    }> = [];

    for (let i = 0; i < tools.length; i++) {
      for (let j = i + 1; j < tools.length; j++) {
        const set1 = toolPrecincts.get(tools[i])!;
        const set2 = toolPrecincts.get(tools[j])!;
        const overlap = Array.from(set1).filter(p => set2.has(p));

        if (overlap.length >= minOverlap) {
          connections.push({
            tool1: tools[i],
            tool2: tools[j],
            overlap,
          });
        }
      }
    }

    if (connections.length > 0) {
      const strongest = connections.sort((a, b) => b.overlap.length - a.overlap.length)[0];

      const template = INSIGHT_TEMPLATES.cross_tool_connection;
      const tool1Label = this.toolLabel(strongest.tool1);
      const tool2Label = this.toolLabel(strongest.tool2);

      return this.buildInsight({
        category: 'cross_tool_connection',
        priority: 'low',
        confidence: 'high',
        title: this.interpolate(template.titleTemplate, {
          tool1: tool1Label,
          tool2: tool2Label,
        }),
        message: this.interpolate(template.messageTemplate, {
          tool1: tool1Label,
          tool2: tool2Label,
          count: strongest.overlap.length,
          precincts: strongest.overlap.slice(0, 3).join(', '),
        }),
        shortMessage: this.interpolate(template.shortMessageTemplate, {
          count: strongest.overlap.length,
        }),
        dataPoints: [
          {
            label: 'Overlapping precincts',
            value: strongest.overlap.length,
          },
          {
            label: 'Tools connected',
            value: `${tool1Label} ↔ ${tool2Label}`,
          },
        ],
        relatedPrecincts: strongest.overlap,
        icon: template.icon,
        trigger: 'tool_navigation',
      });
    }

    return null;
  }

  /**
   * Load ZIP-precinct crosswalk data from the data file
   * @returns Crosswalk data or null if unavailable
   */
  private async loadCrosswalkData(): Promise<ZipPrecinctCrosswalk | null> {
    if (crosswalkData) return crosswalkData;

    try {
      // In browser context, fetch from public data
      if (typeof window !== 'undefined') {
        const response = await fetch('/data/political/zip-precinct-crosswalk.json');
        if (response.ok) {
          crosswalkData = await response.json();
          return crosswalkData;
        }
      }
    } catch (error) {
      console.warn('[InsightEngine] Failed to load crosswalk data:', error);
    }

    return null;
  }

  /**
   * Synchronous crosswalk lookup using cached data
   * Falls back to heuristics if crosswalk not loaded
   */
  private getCrosswalkSync(): ZipPrecinctCrosswalk | null {
    return crosswalkData;
  }

  /**
   * Map precincts to their overlapping ZIP codes
   * Uses crosswalk file when available, falls back to jurisdiction heuristics
   *
   * @param precinctIds - Array of precinct identifiers
   * @returns Array of ZIP codes that overlap with the precincts
   */
  getZipsForPrecincts(precinctIds: string[]): string[] {
    const crosswalk = this.getCrosswalkSync();
    const zipSet = new Set<string>();

    // If crosswalk is loaded, use it for direct lookups
    if (crosswalk) {
      for (const id of precinctIds) {
        // Normalize the precinct ID for lookup
        const normalizedId = id.toLowerCase().replace(/[_\s]+/g, '-');

        // Try direct lookup
        if (crosswalk.precinctToZips[normalizedId]) {
          crosswalk.precinctToZips[normalizedId].forEach(zip => zipSet.add(zip));
          continue;
        }

        // Try variations of the ID
        const variations = [
          normalizedId,
          normalizedId.replace(/-pct-/, '-'),
          normalizedId.replace(/pct/, 'pct-'),
        ];

        let found = false;
        for (const variation of variations) {
          for (const [precinctKey, zips] of Object.entries(crosswalk.precinctToZips)) {
            if (precinctKey === variation || precinctKey.includes(variation) || variation.includes(precinctKey)) {
              zips.forEach(zip => zipSet.add(zip));
              found = true;
              break;
            }
          }
          if (found) break;
        }

        // If still not found, try jurisdiction matching
        if (!found) {
          const matchedZips = this.matchByJurisdiction(id, crosswalk);
          matchedZips.forEach(zip => zipSet.add(zip));
        }
      }

      return Array.from(zipSet);
    }

    // Fallback: Use jurisdiction-based heuristics (legacy behavior)
    return this.getZipsForPrecinctsLegacy(precinctIds);
  }

  /**
   * Match precinct to ZIPs by jurisdiction name
   */
  private matchByJurisdiction(precinctId: string, crosswalk: ZipPrecinctCrosswalk): string[] {
    const idLower = precinctId.toLowerCase().replace(/[_\-\s]+/g, '');

    // Jurisdiction abbreviation patterns
    const jurisdictionPatterns: Record<string, string[]> = {
      'East Lansing': ['eastlansing', 'el-', 'elpct'],
      'Lansing': ['lansing', 'lan-', 'lanpct'],
      'Meridian Township': ['meridian', 'mer-', 'merpct'],
      'Delhi Township': ['delhi', 'del-', 'delpct'],
      'Williamston': ['williamston', 'wil-', 'wilpct'],
    };

    for (const [jurisdiction, patterns] of Object.entries(jurisdictionPatterns)) {
      for (const pattern of patterns) {
        if (idLower.includes(pattern.replace(/-/g, ''))) {
          return crosswalk.jurisdictionZips[jurisdiction] || [];
        }
      }
    }

    // Default: return central Lansing ZIPs for unmatched
    return ['48912', '48906'];
  }

  /**
   * Legacy ZIP lookup using hardcoded municipality mappings
   * Used as fallback when crosswalk file is not available
   */
  private getZipsForPrecinctsLegacy(precinctIds: string[]): string[] {
    const MUNICIPALITY_ZIPS: Record<string, string[]> = {
      'eastlansing': ['48823', '48824', '48825'],
      'lansing': ['48906', '48910', '48911', '48912', '48915', '48917', '48933'],
      'meridian': ['48864', '48840'],
      'delhi': ['48842', '48854'],
      'williamston': ['48895'],
      'haslett': ['48840'],
      'holt': ['48842'],
      'okemos': ['48864'],
    };

    const zipSet = new Set<string>();

    for (const id of precinctIds) {
      const idLower = id.toLowerCase().replace(/[_\-\s]+/g, '');
      let matched = false;

      for (const [municipality, zips] of Object.entries(MUNICIPALITY_ZIPS)) {
        const patterns = [
          municipality,
          municipality.substring(0, 3),
          municipality.substring(0, 2),
        ];

        // Special abbreviations
        if (municipality === 'eastlansing') patterns.push('el');
        if (municipality === 'meridian') patterns.push('mer');
        if (municipality === 'delhi') patterns.push('del');

        for (const pattern of patterns) {
          if (idLower.includes(pattern)) {
            zips.forEach(zip => zipSet.add(zip));
            matched = true;
            break;
          }
        }
        if (matched) break;
      }

      if (!matched) {
        zipSet.add('48912');
        zipSet.add('48906');
      }
    }

    return Array.from(zipSet);
  }

  /**
   * Check for donor-GOTV overlap using precinct-to-ZIP mapping
   *
   * @param precinctIds - Array of GOTV priority precincts
   * @returns Overlap analysis with insight message
   */
  async checkDonorGotvOverlapAsync(precinctIds: string[]): Promise<{
    hasOverlap: boolean;
    overlappingZips: string[];
    insight: string | null;
    totalAmount?: number;
  }> {
    const zips = this.getZipsForPrecincts(precinctIds);

    // Check if these ZIPs have significant donor activity
    try {
      const response = await fetch('/api/donors?zips=' + zips.join(','));
      if (!response.ok) {
        throw new Error(`Donor API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.totalAmount && data.totalAmount > 10000) {
        return {
          hasOverlap: true,
          overlappingZips: zips,
          totalAmount: data.totalAmount,
          insight: `These ${precinctIds.length} precincts overlap with ZIP codes that contributed $${data.totalAmount.toLocaleString()} - consider combining canvassing with donor outreach.`
        };
      }
    } catch (error) {
      if (this.config.debug) {
        console.warn('[InsightEngine] Failed to check donor overlap:', error);
      }
    }

    return {
      hasOverlap: false,
      overlappingZips: zips,
      insight: null
    };
  }

  /**
   * Dismiss an insight (user clicked "don't show again")
   */
  dismissInsight(insightId: string): void {
    const stored = this.storage.surfacedInsights.find(s => s.insightId === insightId);
    if (stored) {
      stored.dismissed = true;
      stored.dismissedAt = new Date();
      this.saveStorage();
    }
  }

  /**
   * Disable an entire insight category
   */
  disableCategory(category: InsightCategory): void {
    if (!this.storage.dismissedCategories.includes(category)) {
      this.storage.dismissedCategories.push(category);
      this.saveStorage();
    }
  }

  /**
   * Enable an insight category
   */
  enableCategory(category: InsightCategory): void {
    this.storage.dismissedCategories = this.storage.dismissedCategories.filter(
      c => c !== category
    );
    this.saveStorage();
  }

  /**
   * Record that user clicked on an insight
   */
  recordInsightClick(insightId: string): void {
    const stored = this.storage.surfacedInsights.find(s => s.insightId === insightId);
    if (stored) {
      stored.clicked = true;
      stored.clickedAt = new Date();
      this.storage.totalInsightsClicked++;
      this.saveStorage();
    }
  }

  /**
   * Get insight engagement stats
   */
  getEngagementStats(): {
    totalSurfaced: number;
    totalClicked: number;
    clickRate: number;
    dismissedCategories: InsightCategory[];
  } {
    return {
      totalSurfaced: this.storage.totalInsightsSurfaced,
      totalClicked: this.storage.totalInsightsClicked,
      clickRate:
        this.storage.totalInsightsSurfaced > 0
          ? this.storage.totalInsightsClicked / this.storage.totalInsightsSurfaced
          : 0,
      dismissedCategories: this.storage.dismissedCategories,
    };
  }

  /**
   * Reset insight storage (for testing or user request)
   */
  resetStorage(): void {
    this.storage = {
      surfacedInsights: [],
      dismissedCategories: [],
      lastCheckAt: null,
      totalInsightsSurfaced: 0,
      totalInsightsClicked: 0,
    };
    this.saveStorage();
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async runCorrelationCheck(
    category: InsightCategory,
    _config: InsightCheckConfig
  ): Promise<Insight | null> {
    // Skip dismissed categories
    if (this.storage.dismissedCategories.includes(category)) {
      return null;
    }

    // In a real implementation, each check would fetch its required data
    // For now, return null - the public check methods can be called directly
    // with the appropriate parameters

    if (this.config.debug) {
      console.log(`[InsightEngine] Would check ${category}`);
    }

    return null;
  }

  private buildInsight(params: {
    category: InsightCategory;
    priority: 'high' | 'medium' | 'low';
    confidence: InsightConfidence;
    title: string;
    message: string;
    shortMessage: string;
    dataPoints: InsightDataPoint[];
    relatedPrecincts?: string[];
    relatedZips?: string[];
    relatedSegments?: string[];
    icon: string;
    trigger: InsightTrigger;
  }): Insight {
    const template = INSIGHT_TEMPLATES[params.category];

    return {
      id: `insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      category: params.category,
      priority: params.priority,
      confidence: params.confidence,
      title: params.title,
      message: params.message,
      shortMessage: params.shortMessage,
      dataPoints: params.dataPoints,
      relatedPrecincts: params.relatedPrecincts,
      relatedZips: params.relatedZips,
      relatedSegments: params.relatedSegments,
      suggestedActions: template.suggestedActionTemplates.map((action, i) => ({
        id: `action_${i}`,
        label: action.labelTemplate,
        action: action.actionTemplate,
      })),
      discoveredAt: new Date(),
      triggerContext: {
        trigger: params.trigger,
      },
      icon: params.icon,
      highlight: params.priority === 'high',
    };
  }

  private isDuplicate(insight: Insight): boolean {
    const hash = this.hashInsight(insight);
    const windowMs = this.config.deduplicationWindowHours * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - windowMs);

    return this.storage.surfacedInsights.some(
      s => s.hash === hash && new Date(s.surfacedAt) > cutoff
    );
  }

  private hashInsight(insight: Insight): string {
    // Simple hash based on category and key data points
    const key = `${insight.category}:${insight.relatedPrecincts?.slice(0, 5).join(',')}:${insight.relatedZips?.slice(0, 5).join(',')}`;
    return this.simpleHash(key);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private recordInsight(insight: Insight): void {
    this.storage.surfacedInsights.push({
      insightId: insight.id,
      category: insight.category,
      hash: this.hashInsight(insight),
      surfacedAt: new Date(),
    });

    this.storage.totalInsightsSurfaced++;

    // Trim old insights
    if (this.storage.surfacedInsights.length > this.config.maxStoredInsights) {
      this.storage.surfacedInsights = this.storage.surfacedInsights.slice(
        -this.config.maxStoredInsights
      );
    }

    this.saveStorage();
  }

  private interpolate(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? `{{${key}}}`));
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private toolLabel(tool: string): string {
    const labels: Record<string, string> = {
      segments: 'Segmentation',
      donors: 'Donor Analysis',
      canvass: 'Canvassing',
      compare: 'Comparison',
      'political-ai': 'Map Explorer',
    };
    return labels[tool] || tool;
  }

  private haversineDistance(coord1: [number, number], coord2: [number, number]): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(coord2[1] - coord1[1]);
    const dLon = this.toRad(coord2[0] - coord1[0]);
    const lat1 = this.toRad(coord1[1]);
    const lat2 = this.toRad(coord2[1]);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;

    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumSqX += dx * dx;
      sumSqY += dy * dy;
    }

    const denominator = Math.sqrt(sumSqX) * Math.sqrt(sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private loadStorage(): InsightStorage {
    if (typeof window === 'undefined') {
      return this.defaultStorage();
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        if (parsed.lastCheckAt) {
          parsed.lastCheckAt = new Date(parsed.lastCheckAt);
        }
        parsed.surfacedInsights = parsed.surfacedInsights.map(
          (s: Record<string, unknown>) => ({
            ...s,
            surfacedAt: new Date(s.surfacedAt as string),
            dismissedAt: s.dismissedAt ? new Date(s.dismissedAt as string) : undefined,
            clickedAt: s.clickedAt ? new Date(s.clickedAt as string) : undefined,
          })
        );
        return parsed;
      }
    } catch (error) {
      console.error('[InsightEngine] Failed to load storage:', error);
    }

    return this.defaultStorage();
  }

  private defaultStorage(): InsightStorage {
    return {
      surfacedInsights: [],
      dismissedCategories: [],
      lastCheckAt: null,
      totalInsightsSurfaced: 0,
      totalInsightsClicked: 0,
    };
  }

  private saveStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.storage));
    } catch (error) {
      console.error('[InsightEngine] Failed to save storage:', error);
    }
  }
}

