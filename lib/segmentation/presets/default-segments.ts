/**
 * Pre-built segment definitions for common voter targeting scenarios
 */

import type { SegmentDefinition } from '../types';

/**
 * Default segment presets
 */
export const defaultSegments: SegmentDefinition[] = [
  {
    id: 'preset-suburban-swing',
    name: 'Suburban Swing Voters',
    description: 'Moderate, college-educated suburban voters in competitive precincts - prime persuasion targets',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      demographic: {
        density_type: 'suburban',
        income_level: 'upper_middle',
        min_college_pct: 50,
      },
      political: {
        outlook: 'moderate',
        competitiveness: ['toss_up', 'lean_d', 'lean_r'],
      },
      targeting: {
        min_persuasion: 60,
        targeting_strategy: ['Persuasion Target', 'Battleground'],
      },
    },
  },
  {
    id: 'preset-base-mobilization',
    name: 'Base Mobilization Targets',
    description:
      'Strong Democratic areas with room for turnout improvement — GOTV focus (thresholds tuned for PA targeting score scale 0–~52, not legacy 0–100)',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      political: {
        party_lean: 'strong_dem',
        competitiveness: ['safe_d', 'likely_d'],
      },
      targeting: {
        min_gotv_priority: 35,
        max_turnout: 95,
        // PA build uses Maintenance / Persuasion Target / Battleground — not the label "Base Mobilization"
      },
    },
  },
  {
    id: 'preset-college-independents',
    name: 'College-Educated Independents',
    description:
      'High-education voters in competitive areas (min_independent_pct 18 matches PA-derived affiliation model; 25% excluded swing precincts)',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      demographic: {
        min_college_pct: 60,
      },
      political: {
        min_independent_pct: 18,
        competitiveness: ['toss_up', 'lean_d', 'lean_r'],
      },
      targeting: {
        min_persuasion: 50,
      },
    },
  },
  {
    id: 'preset-high-value-donors',
    name: 'High-Value Donor Concentration',
    description: 'Affluent areas with high political donor concentration',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      demographic: {
        income_level: 'high',
        min_college_pct: 70,
      },
      engagement: {
        high_donor_concentration: true,
      },
    },
  },
  {
    id: 'preset-digital-first',
    name: 'Digital-First Voters',
    description: 'Young, social media-engaged voters for digital campaigning',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      demographic: {
        age_cohort_emphasis: 'young',
        density_type: 'urban',
      },
      engagement: {
        high_social_media: true,
        news_preference: 'social_first',
      },
    },
  },
  {
    id: 'preset-rural-conservative',
    name: 'Rural Conservative Base',
    description:
      'Rural, conservative-leaning areas (min GOTV aligned with PA statewide targeting scale ~0–52)',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      demographic: {
        density_type: 'rural',
      },
      political: {
        outlook: 'conservative',
        party_lean: 'strong_rep',
      },
      targeting: {
        min_gotv_priority: 35,
      },
    },
  },
  {
    id: 'preset-battleground',
    name: 'True Battleground Precincts',
    description: 'Highly competitive precincts where every vote counts',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      political: {
        competitiveness: ['toss_up'],
        partisan_lean_range: {
          min: -5,
          max: 5,
        },
      },
      targeting: {
        min_swing_potential: 70,
        targeting_strategy: ['Battleground'],
      },
    },
  },
  {
    id: 'preset-young-urban-renters',
    name: 'Young Urban Renters',
    description: 'Dense urban areas with young renters - high persuasion potential',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      demographic: {
        age_cohort_emphasis: 'young',
        density_type: 'urban',
        housing_type: 'renter',
      },
      targeting: {
        min_persuasion: 50,
      },
    },
  },
  {
    id: 'preset-senior-homeowners',
    name: 'Senior Homeowner Communities',
    description: 'Older homeowners with high turnout rates',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      demographic: {
        age_cohort_emphasis: 'senior',
        housing_type: 'owner',
        min_homeowner_pct: 70,
      },
      targeting: {
        min_turnout: 65,
      },
    },
  },
  {
    id: 'preset-diverse-communities',
    name: 'Diverse Communities',
    description: 'High-diversity areas with mixed demographics',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    filters: {
      demographic: {
        min_diversity_index: 60,
      },
      political: {
        min_independent_pct: 20,
      },
    },
  },
];

/**
 * Get a preset by ID
 */
export function getPreset(id: string): SegmentDefinition | undefined {
  return defaultSegments.find(s => s.id === id);
}

/**
 * Get all presets
 */
export function getAllPresets(): SegmentDefinition[] {
  return defaultSegments;
}

/**
 * Check if an ID is a preset
 */
export function isPreset(id: string): boolean {
  return id.startsWith('preset-');
}
