import type { SuggestedAction } from '@/components/ai-native/AIPoliticalSessionHost';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

// ============================================================================
// Type Definitions
// ============================================================================

export type FeatureType =
  | 'precinct'
  | 'hexagon'
  | 'zip'
  | 'municipality'
  | 'state_house'
  | 'state_senate';

export interface FeatureData {
  id: string;
  name: string;
  featureType: FeatureType;
  metrics: Record<string, number | string | undefined>;
  geometry?: GeoJSON.Geometry;
  raw?: Record<string, unknown>;
}

export interface FeatureSelectionResult {
  feature: FeatureData;
  cardTitle: string;
  cardSubtitle: string;
  primaryMetrics: MetricDisplay[];
  secondaryMetrics: MetricDisplay[];
  scoreBars: ScoreBar[];
  suggestedActions: SuggestedAction[];
  aiContext: string;
}

export interface MetricDisplay {
  label: string;
  value: string;
  icon?: string;
}

export interface ScoreBar {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

function detectFeatureType(properties: Record<string, unknown>): FeatureType {
  // Check for H3 hexagon (h3Index field)
  if (properties.h3Index || properties.h3_index) {
    return 'hexagon';
  }

  // Check for ZIP code
  if (properties.zip || properties.ZIP || properties.ZCTA5CE20) {
    return 'zip';
  }

  // Check for State House district
  if (properties.SLDUST || properties.district_type === 'state_house' ||
    (typeof properties.name === 'string' && properties.name.includes('House'))) {
    return 'state_house';
  }

  // Check for State Senate district
  if (properties.SLDLST || properties.district_type === 'state_senate' ||
    (typeof properties.name === 'string' && properties.name.includes('Senate'))) {
    return 'state_senate';
  }

  // Check for municipality
  if (properties.municipality || properties.muni_type ||
    properties.type === 'city' || properties.type === 'township') {
    return 'municipality';
  }

  // Default to precinct
  return 'precinct';
}

export function extractFeatureData(
  properties: Record<string, unknown>,
  featureType?: FeatureType
): FeatureData {
  const type = featureType || detectFeatureType(properties);

  switch (type) {
    case 'precinct':
      return extractPrecinctData(properties);
    case 'hexagon':
      return extractHexagonData(properties);
    case 'zip':
      return extractZipData(properties);
    case 'municipality':
      return extractMunicipalityData(properties);
    case 'state_house':
      return extractStateHouseData(properties);
    case 'state_senate':
      return extractStateSenateData(properties);
    default:
      return extractPrecinctData(properties);
  }
}

function extractPrecinctData(props: Record<string, unknown>): FeatureData {
  // Handle nested data structures (from UnifiedPrecinct)
  const demographics = props.demographics as Record<string, unknown> | undefined;
  const electoral = props.electoral as Record<string, unknown> | undefined;
  const targeting = props.targeting as Record<string, unknown> | undefined;

  return {
    id: String(props.precinct_id || props.id || props.name || 'unknown'),
    name: String(props.name || props.precinct_name || props.NAME || 'Unknown Precinct'),
    featureType: 'precinct',
    metrics: {
      // Check flat props first, then nested structures
      registered_voters: (props.registered_voters || demographics?.registeredVoters) as number | undefined,
      turnout: (props.turnout || props.avg_turnout || electoral?.avgTurnout) as number | undefined,
      partisan_lean: (props.partisan_lean || electoral?.partisanLean) as number | undefined,
      swing_potential: (props.swing_potential || electoral?.swingPotential || targeting?.swingPotential) as number | undefined,
      gotv_priority: (props.gotv_priority || targeting?.gotvPriority) as number | undefined,
      persuasion_opportunity: (props.persuasion_opportunity || targeting?.persuasionOpportunity) as number | undefined,
      municipality: props.municipality as string | undefined,
      targeting_strategy: (props.targeting_strategy || targeting?.strategy) as string | undefined,
    },
    raw: props,
  };
}

function extractHexagonData(props: Record<string, unknown>): FeatureData {
  const h3Index = String(props.h3Index || props.h3_index || 'unknown');
  const precinctCount = (props.precinct_count || props.precinctCount || 0) as number;

  return {
    id: h3Index,
    name: `Hexagon ${h3Index.substring(0, 8)}...`,
    featureType: 'hexagon',
    metrics: {
      precinctCount,
      voterCount: props.voter_count as number | undefined,
      avgSwingPotential: props.avg_swing_potential as number | undefined,
      avgPartisanLean: props.avg_partisan_lean as number | undefined,
      aggregatedMetric: props.value as number | undefined,
    },
    raw: props,
  };
}

function extractZipData(props: Record<string, unknown>): FeatureData {
  const zip = String(props.zip || props.ZIP || props.ZCTA5CE20 || 'unknown');

  return {
    id: zip,
    name: `ZIP ${zip}`,
    featureType: 'zip',
    metrics: {
      totalDonations: props.total_amount as number | undefined,
      donorCount: props.donor_count as number | undefined,
      avgDonation: props.avg_amount as number | undefined,
      topOccupation: props.top_occupation as string | undefined,
      partySplit: props.party_split as string | undefined,
    },
    raw: props,
  };
}

function extractMunicipalityData(props: Record<string, unknown>): FeatureData {
  return {
    id: String(props.id || props.muni_id || props.name || 'unknown'),
    name: String(props.name || props.NAME || 'Unknown Municipality'),
    featureType: 'municipality',
    metrics: {
      population: props.population as number | undefined,
      precinctCount: props.precinct_count as number | undefined,
      avgTurnout: props.avg_turnout as number | undefined,
      partisanLean: props.partisan_lean as number | undefined,
      swingPrecinctCount: props.swing_precinct_count as number | undefined,
      muniType: (props.type || props.muni_type) as string | undefined,
    },
    raw: props,
  };
}

function extractStateHouseData(props: Record<string, unknown>): FeatureData {
  const districtNum = props.district || props.SLDUST || props.district_number || 'unknown';

  return {
    id: String(districtNum),
    name: `State House District ${districtNum}`,
    featureType: 'state_house',
    metrics: {
      representative: (props.representative || props.incumbent) as string | undefined,
      party: props.party as string | undefined,
      margin: props.margin as number | undefined,
      precinctCount: props.precinct_count as number | undefined,
      registeredVoters: props.registered_voters as number | undefined,
      competitiveness: props.competitiveness as string | undefined,
      keySwingPrecincts: props.key_swing_precincts as number | undefined,
    },
    raw: props,
  };
}

function extractStateSenateData(props: Record<string, unknown>): FeatureData {
  const districtNum = props.district || props.SLDLST || props.district_number || 'unknown';

  return {
    id: String(districtNum),
    name: `State Senate District ${districtNum}`,
    featureType: 'state_senate',
    metrics: {
      senator: (props.senator || props.incumbent) as string | undefined,
      party: props.party as string | undefined,
      margin: props.margin as number | undefined,
      precinctCount: props.precinct_count as number | undefined,
      registeredVoters: props.registered_voters as number | undefined,
      competitiveness: props.competitiveness as string | undefined,
    },
    raw: props,
  };
}

// ============================================================================
// Selection Card Generation
// ============================================================================

/**
 * Format feature data for display in AI chat as a selection card
 */
export function formatFeatureForCard(feature: FeatureData): FeatureSelectionResult {
  switch (feature.featureType) {
    case 'precinct':
      return formatPrecinctCard(feature);
    case 'hexagon':
      return formatHexagonCard(feature);
    case 'zip':
      return formatZipCard(feature);
    case 'municipality':
      return formatMunicipalityCard(feature);
    case 'state_house':
      return formatStateHouseCard(feature);
    case 'state_senate':
      return formatStateSenateCard(feature);
    default:
      return formatPrecinctCard(feature);
  }
}

function formatPrecinctCard(feature: FeatureData): FeatureSelectionResult {
  const m = feature.metrics;
  const voters = m.registered_voters as number || 0;
  const turnout = m.turnout as number || 0;
  const lean = m.partisan_lean as number || 0;
  const leanLabel = lean >= 0 ? `D+${lean}` : `R+${Math.abs(lean)}`;

  return {
    feature,
    cardTitle: feature.name,
    cardSubtitle: m.municipality as string || getPoliticalRegionEnv().summaryAreaName,
    primaryMetrics: [
      { label: 'Voters', value: voters.toLocaleString(), icon: '👥' },
      { label: 'Turnout', value: `${turnout}%`, icon: '📊' },
      { label: 'Lean', value: leanLabel, icon: lean >= 0 ? '🔵' : '🔴' },
    ],
    secondaryMetrics: [
      { label: 'Strategy', value: m.targeting_strategy as string || 'Standard' },
    ],
    scoreBars: [
      { label: 'GOTV', value: m.gotv_priority as number || 0, maxValue: 100, color: '#f59e0b' },
      { label: 'Swing', value: m.swing_potential as number || 0, maxValue: 100, color: '#8b5cf6' },
      { label: 'Persuasion', value: m.persuasion_opportunity as number || 0, maxValue: 100, color: '#3b82f6' },
    ],
    suggestedActions: generatePrecinctActions(feature),
    aiContext: generatePrecinctContext(feature),
  };
}

function formatHexagonCard(feature: FeatureData): FeatureSelectionResult {
  const m = feature.metrics;

  return {
    feature,
    cardTitle: `Hexagon ${feature.id.substring(0, 12)}`,
    cardSubtitle: `Contains ${m.precinctCount || 0} precincts`,
    primaryMetrics: [
      { label: 'Precincts', value: String(m.precinctCount || 0), icon: '📍' },
      { label: 'Voters', value: `~${((m.voterCount as number || 0)).toLocaleString()}`, icon: '👥' },
    ],
    secondaryMetrics: [
      { label: 'Avg Swing', value: `${m.avgSwingPotential || 0}/100` },
      { label: 'Avg Lean', value: formatLean(m.avgPartisanLean as number || 0) },
    ],
    scoreBars: [],
    suggestedActions: generateHexagonActions(feature),
    aiContext: generateHexagonContext(feature),
  };
}

function formatZipCard(feature: FeatureData): FeatureSelectionResult {
  const m = feature.metrics;
  const total = m.totalDonations as number || 0;
  const count = m.donorCount as number || 0;
  const avg = m.avgDonation as number || 0;

  return {
    feature,
    cardTitle: `ZIP ${feature.id}`,
    cardSubtitle: 'Donor Analysis',
    primaryMetrics: [
      { label: 'Total', value: `$${total.toLocaleString()}`, icon: '💰' },
      { label: 'Donors', value: count.toLocaleString(), icon: '👥' },
      { label: 'Avg', value: `$${Math.round(avg)}`, icon: '📊' },
    ],
    secondaryMetrics: [
      { label: 'Top Occupation', value: m.topOccupation as string || 'N/A' },
      { label: 'Party Split', value: m.partySplit as string || 'N/A' },
    ],
    scoreBars: [],
    suggestedActions: generateZipActions(feature),
    aiContext: generateZipContext(feature),
  };
}

function formatMunicipalityCard(feature: FeatureData): FeatureSelectionResult {
  const m = feature.metrics;
  const pop = m.population as number || 0;
  const precincts = m.precinctCount as number || 0;
  const lean = m.partisanLean as number || 0;

  return {
    feature,
    cardTitle: feature.name,
    cardSubtitle: `${m.muniType || 'Municipality'}`,
    primaryMetrics: [
      { label: 'Population', value: pop.toLocaleString(), icon: '👥' },
      { label: 'Precincts', value: String(precincts), icon: '📍' },
      { label: 'Turnout', value: `${m.avgTurnout || 0}%`, icon: '📊' },
    ],
    secondaryMetrics: [
      { label: 'Lean', value: formatLean(lean) },
      { label: 'Swing Precincts', value: `${m.swingPrecinctCount || 0} of ${precincts}` },
    ],
    scoreBars: [],
    suggestedActions: generateMunicipalityActions(feature),
    aiContext: generateMunicipalityContext(feature),
  };
}

function formatStateHouseCard(feature: FeatureData): FeatureSelectionResult {
  const m = feature.metrics;
  const margin = m.margin as number || 0;

  return {
    feature,
    cardTitle: feature.name,
    cardSubtitle: m.representative ? `Rep: ${m.representative} (${m.party})` : 'District Overview',
    primaryMetrics: [
      { label: 'Margin', value: formatMargin(margin), icon: margin >= 0 ? '🔵' : '🔴' },
      { label: 'Precincts', value: String(m.precinctCount || 0), icon: '📍' },
      { label: 'Voters', value: ((m.registeredVoters as number) || 0).toLocaleString(), icon: '👥' },
    ],
    secondaryMetrics: [
      { label: 'Competitiveness', value: m.competitiveness as string || 'N/A' },
      { label: 'Key Swing', value: `${m.keySwingPrecincts || 0} precincts` },
    ],
    scoreBars: [],
    suggestedActions: generateDistrictActions(feature),
    aiContext: generateDistrictContext(feature),
  };
}

function formatStateSenateCard(feature: FeatureData): FeatureSelectionResult {
  const m = feature.metrics;
  const margin = m.margin as number || 0;

  return {
    feature,
    cardTitle: feature.name,
    cardSubtitle: m.senator ? `Sen: ${m.senator} (${m.party})` : 'District Overview',
    primaryMetrics: [
      { label: 'Margin', value: formatMargin(margin), icon: margin >= 0 ? '🔵' : '🔴' },
      { label: 'Precincts', value: String(m.precinctCount || 0), icon: '📍' },
      { label: 'Voters', value: ((m.registeredVoters as number) || 0).toLocaleString(), icon: '👥' },
    ],
    secondaryMetrics: [
      { label: 'Competitiveness', value: m.competitiveness as string || 'N/A' },
    ],
    scoreBars: [],
    suggestedActions: generateDistrictActions(feature),
    aiContext: generateDistrictContext(feature),
  };
}

// ============================================================================
// Suggested Actions by Feature Type
// ============================================================================

function generatePrecinctActions(feature: FeatureData): SuggestedAction[] {
  const m = feature.metrics;
  const actions: SuggestedAction[] = [
    {
      id: 'precinct-profile',
      label: 'Full Profile',
      action: `Show me the full profile for ${feature.name}`,
      icon: 'file-text',
    },
    {
      id: 'precinct-compare',
      label: 'Compare',
      action: `Compare ${feature.name} to similar precincts`,
      icon: 'layers',
    },
    {
      id: 'precinct-segment',
      label: 'Add to Segment',
      action: `Add ${feature.name} to my current segment`,
      icon: 'plus-circle',
    },
  ];

  // Context-aware actions based on metrics
  const swing = m.swing_potential as number || 0;
  const gotv = m.gotv_priority as number || 0;

  if (swing > 60) {
    actions.push({
      id: 'precinct-persuasion',
      label: 'Persuasion Strategy',
      action: `What's the best persuasion strategy for ${feature.name}?`,
      icon: 'target',
    });
  }

  if (gotv > 70) {
    actions.push({
      id: 'precinct-gotv',
      label: 'GOTV Plan',
      action: `Create a GOTV plan for ${feature.name}`,
      icon: 'users',
    });
  }

  // Check recent exploration for context
  const stateManager = getStateManager();
  const recentExplorations = stateManager.getRecentExplorations();
  if (recentExplorations.length > 0) {
    const lastExplored = recentExplorations[recentExplorations.length - 1];
    if (lastExplored.type === 'precinct' && lastExplored.id !== feature.id) {
      actions.push({
        id: 'precinct-compare-recent',
        label: `Compare to ${lastExplored.name}`,
        action: `Compare ${feature.name} to ${lastExplored.name}`,
        icon: 'git-compare',
      });
    }
  }

  return actions.slice(0, 5); // Limit to 5 actions
}

function generateHexagonActions(feature: FeatureData): SuggestedAction[] {
  return [
    {
      id: 'hex-precincts',
      label: 'Show Precincts',
      action: `Show all precincts in this hexagon area`,
      icon: 'map-pin',
    },
    {
      id: 'hex-analyze',
      label: 'Analyze Area',
      action: `Analyze the demographic profile of this hexagon area`,
      icon: 'bar-chart',
    },
    {
      id: 'hex-filter',
      label: 'Add to Filter',
      action: `Filter my segment to precincts in this area`,
      icon: 'filter',
    },
  ];
}

function generateZipActions(feature: FeatureData): SuggestedAction[] {
  return [
    {
      id: 'zip-donors',
      label: 'See Donors',
      action: `Show donor details for ZIP ${feature.id}`,
      icon: 'users',
    },
    {
      id: 'zip-prospects',
      label: 'Find Prospects',
      action: `Find prospect donors in ZIP ${feature.id}`,
      icon: 'search',
    },
    {
      id: 'zip-compare',
      label: 'Compare ZIPs',
      action: `Compare ZIP ${feature.id} to other high-performing ZIP codes`,
      icon: 'layers',
    },
    {
      id: 'zip-lapsed',
      label: 'Lapsed Analysis',
      action: `Show lapsed donors in ZIP ${feature.id}`,
      icon: 'clock',
    },
  ];
}

function generateMunicipalityActions(feature: FeatureData): SuggestedAction[] {
  return [
    {
      id: 'muni-profile',
      label: 'Full Profile',
      action: `Generate a full profile for ${feature.name}`,
      icon: 'file-text',
    },
    {
      id: 'muni-precincts',
      label: 'Show Precincts',
      action: `Show all precincts in ${feature.name}`,
      icon: 'map-pin',
    },
    {
      id: 'muni-compare',
      label: 'Compare',
      action: `Compare ${feature.name} to similar municipalities`,
      icon: 'layers',
    },
    {
      id: 'muni-canvass',
      label: 'Canvass Plan',
      action: `Create a canvassing plan for ${feature.name}`,
      icon: 'route',
    },
  ];
}

function generateDistrictActions(feature: FeatureData): SuggestedAction[] {
  const m = feature.metrics;
  const competitiveness = m.competitiveness as string || '';
  const isCompetitive = competitiveness.toLowerCase().includes('toss') ||
    competitiveness.toLowerCase().includes('lean');

  const actions: SuggestedAction[] = [
    {
      id: 'district-analysis',
      label: 'District Analysis',
      action: `Analyze ${feature.name} in detail`,
      icon: 'bar-chart',
    },
    {
      id: 'district-precincts',
      label: 'Show Precincts',
      action: `Show all precincts in ${feature.name}`,
      icon: 'map-pin',
    },
  ];

  if (isCompetitive) {
    actions.push({
      id: 'district-path',
      label: 'Path to Win',
      action: `What's the path to win ${feature.name}?`,
      icon: 'trending-up',
    });
  }

  actions.push({
    id: 'district-canvass',
    label: 'Canvass Plan',
    action: `Create a canvassing plan for ${feature.name}`,
    icon: 'route',
  });

  return actions;
}

// ============================================================================
// AI Context Generation
// ============================================================================

function generatePrecinctContext(feature: FeatureData): string {
  const m = feature.metrics;
  const swing = m.swing_potential as number || 0;
  const gotv = m.gotv_priority as number || 0;
  const lean = m.partisan_lean as number || 0;

  let context = `Selected ${feature.name}`;

  // Add strategic characterization
  if (swing > 70) {
    context += ` - a high-swing precinct`;
  } else if (gotv > 80) {
    context += ` - a high GOTV priority area`;
  } else if (Math.abs(lean) > 20) {
    context += lean > 0 ? ` - a safe Democratic precinct` : ` - a safe Republican precinct`;
  }

  // Add targeting strategy
  if (m.targeting_strategy) {
    context += ` with ${m.targeting_strategy} targeting strategy`;
  }

  return context;
}

function generateHexagonContext(feature: FeatureData): string {
  const m = feature.metrics;
  return `Selected hexagon area containing ${m.precinctCount || 0} precincts with ~${((m.voterCount as number) || 0).toLocaleString()} voters`;
}

function generateZipContext(feature: FeatureData): string {
  const m = feature.metrics;
  return `Selected ZIP ${feature.id} with $${((m.totalDonations as number) || 0).toLocaleString()} in donations from ${(m.donorCount as number) || 0} donors`;
}

function generateMunicipalityContext(feature: FeatureData): string {
  const m = feature.metrics;
  return `Selected ${feature.name} (${m.muniType || 'municipality'}) with ${(m.precinctCount as number) || 0} precincts and ${((m.population as number) || 0).toLocaleString()} population`;
}

function generateDistrictContext(feature: FeatureData): string {
  const m = feature.metrics;
  const margin = m.margin as number || 0;
  const marginStr = margin >= 0 ? `D+${margin}` : `R+${Math.abs(margin)}`;
  return `Selected ${feature.name} (${marginStr} margin, ${m.competitiveness || 'unknown competitiveness'})`;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatLean(lean: number): string {
  if (lean === 0) return 'Even';
  return lean > 0 ? `D+${lean}` : `R+${Math.abs(lean)}`;
}

function formatMargin(margin: number): string {
  if (margin === 0) return 'Even';
  return margin > 0 ? `D+${Math.abs(margin)}` : `R+${Math.abs(margin)}`;
}


export {
  formatLean,
  formatMargin,
};
