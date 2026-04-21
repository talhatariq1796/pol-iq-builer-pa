/**
 * Workflow Initialization Functions
 *
 * These functions initialize each workflow with appropriate map commands
 * and context-aware suggested actions.
 */

import type { MapCommand, SuggestedAction } from './AIPoliticalSessionHost';

export function getDistrictAnalysisInit(selectedPrecinct?: { precinctName: string } | null): {
  mapCommand: MapCommand;
  message: string;
  actions: SuggestedAction[];
} {
  return {
    mapCommand: {
      type: 'showChoropleth'
    },
    message:
      'The map shows Pennsylvania precinct-level data colored by targeting strategy. Click a precinct or use Select to choose boundaries, then try the suggested actions below.',
    actions: [
      {
        id: 'show-demographics',
        label: 'Show demographics for this district',
        action: selectedPrecinct
          ? `Show me demographics for ${selectedPrecinct.precinctName}`
          : 'Show me demographics for a selected area',
        icon: 'users'
      },
      {
        id: 'compare-areas',
        label: 'Compare to similar areas',
        action: selectedPrecinct
          ? `Compare ${selectedPrecinct.precinctName} to similar areas`
          : 'Show me areas I can compare',
        icon: 'layers'
      },
      {
        id: 'show-swing',
        label: 'Show swing areas',
        action: 'Show me swing areas with margin less than 5%',
        icon: 'filter'
      },
      {
        id: 'switch-to-hexagons',
        label: 'Show as H3 hexagon heatmap',
        action: 'map:showHeatmap',
        metadata: { metric: 'swing_potential' },
        icon: 'hexagon'
      }
    ]
  };
}

/**
 * Area Analysis follow-up chips (same as initial + report). Use after assistant turns
 * so users always see the four core actions plus PDF report.
 */
export function getDistrictAnalysisFollowUpActions(
  selectedPrecinct?: { precinctName: string } | null
): SuggestedAction[] {
  return [
    ...getDistrictAnalysisInit(selectedPrecinct).actions,
    {
      id: 'generate-report',
      label: 'Generate district profile report',
      action:
        'Generate a political profile PDF report for the selected area in Pennsylvania',
      icon: 'file-text',
    },
  ];
}

export function getSwingDetectionInit(): {
  mapCommand: MapCommand;
  message: string;
  actions: SuggestedAction[];
} {
  return {
    mapCommand: {
      type: 'showHeatmap',
      metric: 'partisan_lean'
    },
    message: 'The map now shows partisan lean - look for areas close to 0 (purple). These are the most competitive swing areas.',
    actions: [
      {
        id: 'find-swing-areas',
        label: 'Find areas with margin < 5%',
        action: 'Find areas with partisan lean between -5 and +5',
        icon: 'filter'
      },
      {
        id: 'competitive-races',
        label: 'List most competitive areas',
        action: 'List the top 10 most competitive areas',
        icon: 'trending-up'
      },
      {
        id: 'show-tossup',
        label: 'Show toss-up areas',
        action: 'Show me all toss-up areas',
        icon: 'target'
      },
      {
        id: 'switch-to-precincts',
        label: 'Show as precinct boundaries',
        action: 'map:showChoropleth',
        icon: 'map'
      }
    ]
  };
}

export function getCanvassingInit(selectedPrecinct?: { precinctName: string } | null): {
  mapCommand: MapCommand;
  message: string;
  actions: SuggestedAction[];
} {
  return {
    mapCommand: {
      type: 'showHeatmap',
      metric: 'gotv_priority'
    },
    message: 'The map now shows GOTV priority - darker orange areas have the highest value for door-knocking. I can help you identify high-value areas and estimate canvassing efficiency.',
    actions: [
      {
        id: 'high-priority-precincts',
        label: 'Show high-priority precincts',
        action: 'Show me precincts with GOTV priority above 70',
        icon: 'target'
      },
      {
        id: 'dense-areas',
        label: 'Find dense urban areas',
        action: 'Which precincts have the highest population density for efficient canvassing?',
        icon: 'users'
      },
      {
        id: 'estimate-efficiency',
        label: 'Estimate canvassing efficiency',
        action: selectedPrecinct
          ? `What is the canvassing efficiency for ${selectedPrecinct.precinctName}?`
          : 'Show me canvassing efficiency estimates',
        icon: 'clock'
      },
      {
        id: 'switch-to-precincts',
        label: 'Show as precinct boundaries',
        action: 'map:showChoropleth',
        icon: 'map'
      }
    ]
  };
}

export function getVoterTargetingInit(): {
  mapCommand: MapCommand;
  message: string;
  actions: SuggestedAction[];
} {
  return {
    mapCommand: {
      type: 'showHeatmap',
      metric: 'persuasion_opportunity'
    },
    message: 'The map now shows persuasion opportunity - darker purple areas have more persuadable voters. I can help you identify high-priority voters based on GOTV potential, persuasion opportunity, or combined targeting scores.',
    actions: [
      {
        id: 'persuadable-precincts',
        label: 'Find persuadable precincts',
        action: 'Show me precincts with persuasion opportunity above 60',
        icon: 'users'
      },
      {
        id: 'gotv-targets',
        label: 'Show GOTV priority areas',
        action: 'Show me areas with high GOTV priority',
        icon: 'map-pin'
      },
      {
        id: 'combined-targets',
        label: 'Find balanced targets',
        action: 'Which precincts score high on both GOTV and persuasion?',
        icon: 'target'
      },
      {
        id: 'switch-to-precincts',
        label: 'Show as precinct boundaries',
        action: 'map:showChoropleth',
        icon: 'map'
      }
    ]
  };
}
