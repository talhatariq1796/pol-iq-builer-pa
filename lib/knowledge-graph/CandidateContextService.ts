/**
 * CandidateContextService - Provides candidate and election context for analysis
 *
 * Used to enrich district analysis responses with:
 * - Current representatives
 * - Upcoming elections
 * - Candidate information
 * - Election history
 */

import { getKnowledgeGraph } from './KnowledgeGraph';
import { getGraphPopulator } from './GraphPopulator';
import { Entity, CandidateEntity, OfficeEntity } from './types';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

// Track if graph has been populated
let graphPopulated = false;

export interface CandidateContext {
  incumbent?: {
    name: string;
    party: 'DEM' | 'REP' | 'IND' | 'OTHER';
    biography?: string;
    election2024?: {
      votes?: number;
      percentage?: number;
      opponent?: string;
    };
  };
  office?: {
    name: string;
    level: 'federal' | 'state' | 'county' | 'local';
    district?: string;
    nextElection: string;
    termLength: number;
  };
  challengers?: Array<{
    name: string;
    party: 'DEM' | 'REP' | 'IND' | 'OTHER';
    status: string;
  }>;
}

export interface DistrictRepresentatives {
  federal: {
    senators: CandidateContext[];
    representative?: CandidateContext;
  };
  state: {
    senator?: CandidateContext;
    representative?: CandidateContext;
  };
}

/**
 * Ensure the knowledge graph is populated with seed data
 */
async function ensureGraphPopulated(): Promise<void> {
  if (graphPopulated) return;

  try {
    const populator = getGraphPopulator();
    const result = await populator.populate({ includePrecincts: false });
    console.log(`[CandidateContextService] Graph populated: ${result.entitiesAdded} entities, ${result.relationshipsAdded} relationships`);
    graphPopulated = true;
  } catch (error) {
    console.error('[CandidateContextService] Failed to populate graph:', error);
  }
}

/**
 * Get candidate context for a specific office
 */
function getCandidateContextFromEntity(
  candidate: Entity | undefined,
  office: Entity | undefined
): CandidateContext {
  const context: CandidateContext = {};

  if (candidate) {
    const meta = candidate.metadata as CandidateEntity['metadata'];
    context.incumbent = {
      name: candidate.name,
      party: meta?.party || 'OTHER',
      biography: meta?.biography,
    };

    if (meta?.election2024) {
      context.incumbent.election2024 = {
        votes: meta.election2024.votes,
        percentage: meta.election2024.percentage,
        opponent: meta.election2024.opponent,
      };
    }
  }

  if (office) {
    const meta = office.metadata as OfficeEntity['metadata'];
    context.office = {
      name: office.name,
      level: meta?.level || 'state',
      district: meta?.district,
      nextElection: meta?.nextElection || 'TBD',
      termLength: meta?.termLength || 2,
    };
  }

  return context;
}

/**
 * Get candidate context for a State House district
 */
export async function getStateHouseContext(districtNumber: string): Promise<CandidateContext> {
  await ensureGraphPopulated();

  const graph = getKnowledgeGraph();
  const officeId = `office:mi-house-${districtNumber}`;
  const office = graph.getEntity(officeId);

  if (!office) {
    return {
      office: {
        name: `Michigan State House District ${districtNumber}`,
        level: 'state',
        district: districtNumber,
        nextElection: '2026-11-03',
        termLength: 2,
      },
    };
  }

  const candidates = graph.getCandidatesForOffice(officeId);
  const incumbent = candidates.find(c =>
    (c.metadata as CandidateEntity['metadata'])?.status === 'incumbent' ||
    (c.metadata as CandidateEntity['metadata'])?.incumbentOf === officeId
  );

  return getCandidateContextFromEntity(incumbent, office);
}

/**
 * Get candidate context for a State Senate district
 */
export async function getStateSenateContext(districtNumber: string): Promise<CandidateContext> {
  await ensureGraphPopulated();

  const graph = getKnowledgeGraph();
  const officeId = `office:mi-senate-${districtNumber}`;
  const office = graph.getEntity(officeId);

  if (!office) {
    return {
      office: {
        name: `Michigan State Senate District ${districtNumber}`,
        level: 'state',
        district: districtNumber,
        nextElection: '2026-11-03',
        termLength: 4,
      },
    };
  }

  const candidates = graph.getCandidatesForOffice(officeId);
  const incumbent = candidates.find(c =>
    (c.metadata as CandidateEntity['metadata'])?.status === 'incumbent' ||
    (c.metadata as CandidateEntity['metadata'])?.incumbentOf === officeId
  );

  return getCandidateContextFromEntity(incumbent, office);
}

/**
 * Get candidate context for US House MI-07
 */
export async function getCongressionalContext(): Promise<CandidateContext> {
  await ensureGraphPopulated();

  const graph = getKnowledgeGraph();
  const officeId = 'office:us-house-mi-07';
  const office = graph.getEntity(officeId);
  const candidates = graph.getCandidatesForOffice(officeId);

  const incumbent = candidates.find(c =>
    (c.metadata as CandidateEntity['metadata'])?.status === 'incumbent' ||
    (c.metadata as CandidateEntity['metadata'])?.incumbentOf === officeId
  );

  const challengers = candidates.filter(c =>
    (c.metadata as CandidateEntity['metadata'])?.status !== 'incumbent' &&
    (c.metadata as CandidateEntity['metadata'])?.incumbentOf !== officeId
  );

  const context = getCandidateContextFromEntity(incumbent, office);

  if (challengers.length > 0) {
    context.challengers = challengers.map(c => ({
      name: c.name,
      party: (c.metadata as CandidateEntity['metadata'])?.party || 'OTHER',
      status: (c.metadata as CandidateEntity['metadata'])?.status || 'unknown',
    }));
  }

  return context;
}

/**
 * Get US Senate context for Michigan
 */
export async function getUSSenateContext(): Promise<CandidateContext[]> {
  await ensureGraphPopulated();

  const graph = getKnowledgeGraph();
  const contexts: CandidateContext[] = [];

  // Class I (Slotkin)
  const office1 = graph.getEntity('office:us-senate-mi-class1');
  const candidates1 = graph.getCandidatesForOffice('office:us-senate-mi-class1');
  const incumbent1 = candidates1.find(c =>
    (c.metadata as CandidateEntity['metadata'])?.status === 'incumbent'
  );
  contexts.push(getCandidateContextFromEntity(incumbent1, office1));

  // Class II (Peters)
  const office2 = graph.getEntity('office:us-senate-mi-class2');
  const candidates2 = graph.getCandidatesForOffice('office:us-senate-mi-class2');
  const incumbent2 = candidates2.find(c =>
    (c.metadata as CandidateEntity['metadata'])?.status === 'incumbent'
  );
  const context2 = getCandidateContextFromEntity(incumbent2, office2);

  // Add challengers for open seat
  const challengers = candidates2.filter(c =>
    (c.metadata as CandidateEntity['metadata'])?.status !== 'incumbent'
  );
  if (challengers.length > 0) {
    context2.challengers = challengers.map(c => ({
      name: c.name,
      party: (c.metadata as CandidateEntity['metadata'])?.party || 'OTHER',
      status: (c.metadata as CandidateEntity['metadata'])?.status || 'unknown',
    }));
  }
  contexts.push(context2);

  return contexts;
}

/**
 * Get all representatives covering Ingham County
 */
export async function getInghamCountyRepresentatives(): Promise<DistrictRepresentatives> {
  if (getPoliticalRegionEnv().stateFips === '42') {
    return {
      federal: { senators: [], representative: undefined },
      state: { senator: undefined, representative: undefined },
    };
  }

  await ensureGraphPopulated();

  const senateContexts = await getUSSenateContext();
  const congressContext = await getCongressionalContext();

  // State House districts covering Ingham County
  const houseContexts: Record<string, CandidateContext> = {};
  for (const district of ['73', '74', '75', '77']) {
    houseContexts[district] = await getStateHouseContext(district);
  }

  // State Senate districts covering Ingham County
  const stateSenateContexts: Record<string, CandidateContext> = {};
  for (const district of ['21', '28']) {
    stateSenateContexts[district] = await getStateSenateContext(district);
  }

  return {
    federal: {
      senators: senateContexts,
      representative: congressContext,
    },
    state: {
      senator: stateSenateContexts['21'], // Primary district for Ingham
      representative: houseContexts['73'], // Example district
    },
  };
}

/**
 * Format candidate context as markdown for AI responses
 */
export function formatCandidateContextForResponse(context: CandidateContext): string {
  const parts: string[] = [];

  if (context.office) {
    parts.push(`**${context.office.name}**`);
    parts.push(`- Next Election: ${context.office.nextElection}`);
    parts.push(`- Term Length: ${context.office.termLength} years`);
  }

  if (context.incumbent) {
    const party = context.incumbent.party === 'DEM' ? 'D' : context.incumbent.party === 'REP' ? 'R' : context.incumbent.party;
    parts.push(`- Current Holder: ${context.incumbent.name} (${party})`);

    if (context.incumbent.election2024) {
      const e = context.incumbent.election2024;
      if (e.percentage) {
        parts.push(`- 2024 Result: Won with ${e.percentage.toFixed(1)}%${e.opponent ? ` vs ${e.opponent}` : ''}`);
      }
    }
  }

  if (context.challengers && context.challengers.length > 0) {
    parts.push('- Known Challengers:');
    for (const c of context.challengers) {
      const party = c.party === 'DEM' ? 'D' : c.party === 'REP' ? 'R' : c.party;
      parts.push(`  - ${c.name} (${party}) - ${c.status}`);
    }
  }

  return parts.join('\n');
}

/**
 * Get district analysis enrichment text
 */
export async function getDistrictAnalysisEnrichment(
  districtType: 'state_house' | 'state_senate' | 'congressional' | 'county',
  districtNumber?: string
): Promise<string> {
  let context: CandidateContext;

  switch (districtType) {
    case 'state_house':
      if (!districtNumber) return '';
      context = await getStateHouseContext(districtNumber);
      break;
    case 'state_senate':
      if (!districtNumber) return '';
      context = await getStateSenateContext(districtNumber);
      break;
    case 'congressional':
      context = await getCongressionalContext();
      break;
    case 'county':
    default:
      if (getPoliticalRegionEnv().stateFips === '42') {
        return (
          '### Current elected officials\n' +
          'Statewide incumbent lists are not loaded in this Pennsylvania deployment. Use district-level analysis (State House / Senate / Congressional) for legislator context.'
        );
      }
      const reps = await getInghamCountyRepresentatives();
      const parts: string[] = ['### Current Elected Officials'];

      parts.push('\n**Federal:**');
      for (const senator of reps.federal.senators) {
        if (senator.incumbent) {
          parts.push(`- US Senate: ${senator.incumbent.name} (${senator.incumbent.party === 'DEM' ? 'D' : 'R'})`);
        }
      }
      if (reps.federal.representative?.incumbent) {
        parts.push(`- US House MI-07: ${reps.federal.representative.incumbent.name} (${reps.federal.representative.incumbent.party === 'DEM' ? 'D' : 'R'})`);
      }

      return parts.join('\n');
  }

  return formatCandidateContextForResponse(context);
}

export default {
  getStateHouseContext,
  getStateSenateContext,
  getCongressionalContext,
  getUSSenateContext,
  getInghamCountyRepresentatives,
  formatCandidateContextForResponse,
  getDistrictAnalysisEnrichment,
};
