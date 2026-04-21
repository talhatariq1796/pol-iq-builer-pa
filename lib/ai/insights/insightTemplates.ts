/**
 * Insight Templates for Serendipitous Discoveries
 * Phase 13 Implementation
 *
 * Templates for generating insight messages with "Did you know..." framing
 */

import type { InsightCategory, InsightTemplate } from './types';

/**
 * Templates for each insight category
 */
export const INSIGHT_TEMPLATES: Record<InsightCategory, InsightTemplate> = {
  donor_gotv_overlap: {
    category: 'donor_gotv_overlap',
    titleTemplate: '💡 Donor-GOTV Overlap Found',
    messageTemplate: `**Interesting finding**: {{count}} of your top GOTV precincts overlap with high-donor ZIP codes.

Your {{gotvCount}} GOTV priority precincts share geography with ZIP codes that contributed {{totalAmount}} in donations (top ZIPs: {{topZips}}).

**Opportunity**: You might combine canvassing with small-dollar fundraising asks. Voters in these areas have demonstrated both high turnout potential AND willingness to donate.`,
    shortMessageTemplate: 'Found {{count}} GOTV precincts in high-donor ZIPs',
    icon: '💰',
    suggestedActionTemplates: [
      {
        labelTemplate: 'Show overlap on map',
        actionTemplate: 'map:showChoropleth',
      },
      {
        labelTemplate: 'View donor details',
        actionTemplate: 'navigate:donors',
      },
      {
        labelTemplate: 'Plan combined canvass',
        actionTemplate: 'navigate:canvass',
      },
    ],
  },

  tapestry_turnout: {
    category: 'tapestry_turnout',
    titleTemplate: '📊 Unusual Turnout Pattern: {{segmentName}}',
    messageTemplate: `**Did you know?** The "{{segmentName}}" Tapestry segment has {{direction}} turnout than expected in {{electionType}} elections.

This segment averages {{avgTurnout}}% turnout vs the county average of {{countyAvg}}% — that's {{deviation}} standard deviations from the mean.

**Implication**: This demographic group behaves differently than typical voter models predict. Consider adjusting your targeting strategy for precincts with high "{{segmentName}}" concentration.`,
    shortMessageTemplate: '"{{segmentName}}" has {{direction}} turnout than expected',
    icon: '📈',
    suggestedActionTemplates: [
      {
        labelTemplate: 'Show segment precincts',
        actionTemplate: 'filter:tapestry',
      },
      {
        labelTemplate: 'Compare to similar segments',
        actionTemplate: 'What other Tapestry segments have unusual turnout patterns?',
      },
      {
        labelTemplate: 'View turnout heatmap',
        actionTemplate: 'map:showHeatmap',
      },
    ],
  },

  demographic_swing: {
    category: 'demographic_swing',
    titleTemplate: '🎯 Demographic-Swing Correlation: {{demographic}}',
    messageTemplate: `**Interesting correlation**: Swing potential is {{direction}} correlated with {{demographic}} in this area (r={{correlation}}).

This means {{implication}}.

**Strategic insight**: When prioritizing swing precincts, consider {{demographic}} as a key indicator. This correlation may help you identify persuadable voters more efficiently.`,
    shortMessageTemplate: 'Swing potential correlates with {{demographic}}',
    icon: '🔬',
    suggestedActionTemplates: [
      {
        labelTemplate: 'Show correlation map',
        actionTemplate: 'map:showChoropleth',
      },
      {
        labelTemplate: 'Create demographic segment',
        actionTemplate: 'navigate:segments',
      },
      {
        labelTemplate: 'Explain methodology',
        actionTemplate: 'How is swing potential calculated and what does this correlation mean?',
      },
    ],
  },

  geographic_cluster: {
    category: 'geographic_cluster',
    titleTemplate: '🗺️ Geographic Cluster: High {{metric}}',
    messageTemplate: `**Spatial pattern detected**: {{count}} precincts with high {{metric}} (avg {{avgValue}}) form a tight geographic cluster.

These precincts ({{precincts}}) are within canvassing distance of each other.

**Efficiency opportunity**: This cluster represents an optimal canvassing territory. You can reach all {{count}} high-value precincts without significant travel time between them.`,
    shortMessageTemplate: '{{count}} high-{{metric}} precincts cluster together',
    icon: '📍',
    suggestedActionTemplates: [
      {
        labelTemplate: 'Show cluster on map',
        actionTemplate: 'map:highlight',
      },
      {
        labelTemplate: 'Plan canvassing route',
        actionTemplate: 'navigate:canvass',
      },
      {
        labelTemplate: 'Analyze cluster demographics',
        actionTemplate: 'What do these clustered precincts have in common demographically?',
      },
    ],
  },

  temporal_anomaly: {
    category: 'temporal_anomaly',
    titleTemplate: '📅 Temporal Anomaly Detected',
    messageTemplate: `**Unusual pattern over time**: {{description}}

This suggests {{implication}}.

**Recommendation**: {{recommendation}}`,
    shortMessageTemplate: 'Unusual temporal pattern found',
    icon: '⏰',
    suggestedActionTemplates: [
      {
        labelTemplate: 'View temporal map',
        actionTemplate: 'map:temporal',
      },
      {
        labelTemplate: 'Compare elections',
        actionTemplate: 'navigate:compare',
      },
    ],
  },

  cross_tool_connection: {
    category: 'cross_tool_connection',
    titleTemplate: '🔗 Cross-Tool Connection: {{tool1}} ↔ {{tool2}}',
    messageTemplate: `**Pattern in your exploration**: {{count}} precincts you viewed in {{tool1}} also appeared in your {{tool2}} analysis.

Overlapping precincts: {{precincts}}

**This suggests**: These precincts may be strategic priorities worth deeper investigation. They're appearing across multiple analytical dimensions.`,
    shortMessageTemplate: '{{count}} precincts appear in multiple analyses',
    icon: '🔗',
    suggestedActionTemplates: [
      {
        labelTemplate: 'View overlapping precincts',
        actionTemplate: 'map:highlight',
      },
      {
        labelTemplate: 'Compare all dimensions',
        actionTemplate: 'navigate:compare',
      },
      {
        labelTemplate: 'Create priority segment',
        actionTemplate: 'navigate:segments',
      },
    ],
  },
};

/**
 * Get "Did you know..." style framing for an insight
 */
export function frameAsDiscovery(insight: { title: string; message: string }): string {
  const prefixes = [
    '💡 Did you know?',
    '🔍 Interesting finding:',
    '✨ Discovery:',
    '📊 Pattern detected:',
    '🎯 Strategic insight:',
  ];

  // Use a deterministic prefix based on message hash
  const hash = insight.message.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const prefix = prefixes[hash % prefixes.length];

  return `${prefix}\n\n${insight.message}`;
}

/**
 * Get suggested follow-up questions for an insight category
 */
export function getFollowUpQuestions(category: InsightCategory): string[] {
  const questions: Record<InsightCategory, string[]> = {
    donor_gotv_overlap: [
      'What are the top donor occupations in these ZIP codes?',
      'How does donor concentration compare to volunteer recruitment potential?',
      'Are there any donor deserts near these GOTV precincts?',
    ],
    tapestry_turnout: [
      'What other Tapestry segments have unusual turnout patterns?',
      'How does this segment vote (partisan lean)?',
      'Where else in the county is this segment concentrated?',
    ],
    demographic_swing: [
      'Which precincts have the highest concentration of this demographic?',
      'How has this demographic shifted over recent elections?',
      'What Tapestry segments align with this demographic profile?',
    ],
    geographic_cluster: [
      'What demographics do these clustered precincts share?',
      'Are there similar clusters elsewhere in the county?',
      'What would a canvassing route through this cluster look like?',
    ],
    temporal_anomaly: [
      'What events coincided with this shift?',
      'How does this compare to statewide trends?',
      'Which precincts drove this change?',
    ],
    cross_tool_connection: [
      'What makes these precincts appear in both analyses?',
      'Should I prioritize these cross-referenced precincts?',
      'Are there other precincts with similar profiles?',
    ],
  };

  return questions[category] || [];
}

/**
 * Get actionable recommendations for an insight
 */
export function getActionableRecommendations(
  category: InsightCategory
): Array<{ action: string; impact: 'high' | 'medium' | 'low'; effort: 'high' | 'medium' | 'low' }> {
  const recommendations: Record<InsightCategory, ReturnType<typeof getActionableRecommendations>> = {
    donor_gotv_overlap: [
      { action: 'Add fundraising ask to canvass script', impact: 'high', effort: 'low' },
      { action: 'Schedule donor house parties in overlap areas', impact: 'high', effort: 'medium' },
      { action: 'Create targeted digital ads for these ZIPs', impact: 'medium', effort: 'low' },
    ],
    tapestry_turnout: [
      { action: 'Adjust turnout model weights for this segment', impact: 'high', effort: 'medium' },
      { action: 'Research segment-specific messaging', impact: 'medium', effort: 'medium' },
      { action: 'A/B test GOTV approaches in high-concentration precincts', impact: 'high', effort: 'high' },
    ],
    demographic_swing: [
      { action: 'Prioritize persuasion outreach to this demographic', impact: 'high', effort: 'medium' },
      { action: 'Develop demographic-specific messaging', impact: 'medium', effort: 'medium' },
      { action: 'Survey this demographic for issue priorities', impact: 'medium', effort: 'high' },
    ],
    geographic_cluster: [
      { action: 'Create dedicated canvass turf for this cluster', impact: 'high', effort: 'low' },
      { action: 'Schedule cluster-specific canvass launch', impact: 'medium', effort: 'low' },
      { action: 'Identify local volunteer captains in cluster', impact: 'medium', effort: 'medium' },
    ],
    temporal_anomaly: [
      { action: 'Research historical context of the shift', impact: 'low', effort: 'low' },
      { action: 'Monitor for continued trend', impact: 'medium', effort: 'low' },
      { action: 'Adjust future projections based on trend', impact: 'high', effort: 'medium' },
    ],
    cross_tool_connection: [
      { action: 'Create a "priority" segment from overlapping precincts', impact: 'high', effort: 'low' },
      { action: 'Assign top canvassers to these precincts', impact: 'high', effort: 'low' },
      { action: 'Conduct deep-dive analysis on common characteristics', impact: 'medium', effort: 'medium' },
    ],
  };

  return recommendations[category] || [];
}

export default INSIGHT_TEMPLATES;
