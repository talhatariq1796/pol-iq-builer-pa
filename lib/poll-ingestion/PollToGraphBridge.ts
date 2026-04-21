/**
 * Poll To Graph Bridge
 *
 * Integrates polling data into the knowledge graph.
 * Creates poll entities and relationships to candidates, races, and geographies.
 *
 * Graph Relationships Created:
 * - Poll MEASURES Race (Office)
 * - Poll SHOWS_LEADING Candidate
 * - Candidate POLLED_AT Geography
 */

import { getKnowledgeGraph, KnowledgeGraph } from '../knowledge-graph';
import {
  PollEntity,
  CandidateEntity,
  OfficeEntity,
  Relationship,
  RelationshipType,
} from '../knowledge-graph/types';
import { Poll, PollAggregate, Party } from './types';

export class PollToGraphBridge {
  private graph: KnowledgeGraph;

  constructor(graph?: KnowledgeGraph) {
    this.graph = graph || getKnowledgeGraph();
  }

  /**
   * Add a single poll to the knowledge graph
   */
  addPoll(poll: Poll): string {
    // Create poll entity
    const pollEntity: PollEntity = {
      id: `poll:${poll.poll_id}`,
      type: 'poll',
      name: `${poll.pollster} ${poll.race_id} Poll (${poll.end_date})`,
      aliases: [poll.poll_id],
      metadata: {
        pollster: poll.pollster,
        fieldDates: {
          start: poll.start_date,
          end: poll.end_date,
        },
        sampleSize: poll.sample_size,
        marginOfError: poll.margin_of_error || 0,
        race: poll.race_id,
        results: poll.results.map((r) => ({
          candidateId: this.getCandidateId(r.candidate_name, r.party),
          support: r.percentage,
        })),
        methodology: poll.methodology,
      },
      sources: [poll.source_url || poll.source],
      createdAt: poll.ingested_at,
      updatedAt: poll.ingested_at,
    };

    this.graph.addEntity(pollEntity);

    // Ensure race (office) entity exists
    const raceId = this.ensureRaceEntity(poll);

    // Create MEASURES relationship (Poll -> Race)
    this.graph.addRelationship({
      id: `${pollEntity.id}--MEASURES--${raceId}`,
      type: 'MEASURES',
      sourceId: pollEntity.id,
      sourceType: 'poll',
      targetId: raceId,
      targetType: 'office',
      properties: {
        fieldEnd: poll.end_date,
        sampleSize: poll.sample_size,
      },
      createdAt: poll.ingested_at,
    });

    // Ensure candidate entities exist and create relationships
    for (const result of poll.results) {
      const candidateId = this.ensureCandidateEntity(result.candidate_name, result.party);

      // Create SHOWS_LEADING if this is the top candidate
      if (result.percentage === Math.max(...poll.results.map((r) => r.percentage))) {
        this.graph.addRelationship({
          id: `${pollEntity.id}--SHOWS_LEADING--${candidateId}`,
          type: 'SHOWS_LEADING',
          sourceId: pollEntity.id,
          sourceType: 'poll',
          targetId: candidateId,
          targetType: 'candidate',
          properties: {
            support: result.percentage,
            margin:
              result.percentage -
              (poll.results
                .filter((r) => r.candidate_name !== result.candidate_name)
                .map((r) => r.percentage)
                .sort((a, b) => b - a)[0] || 0),
          },
          createdAt: poll.ingested_at,
        });
      }

      // Ensure candidate is linked to race
      this.ensureCandidateRunningFor(candidateId, raceId);
    }

    return pollEntity.id;
  }

  /**
   * Add multiple polls to the graph
   */
  addPolls(polls: Poll[]): number {
    let added = 0;
    for (const poll of polls) {
      try {
        this.addPoll(poll);
        added++;
      } catch (error) {
        console.warn(`[PollToGraphBridge] Failed to add poll ${poll.poll_id}:`, error);
      }
    }
    console.log(`[PollToGraphBridge] Added ${added} polls to knowledge graph`);
    return added;
  }

  /**
   * Add poll aggregate summary to the graph
   * Stores aggregate data in entity's generic metadata field
   */
  addAggregate(aggregate: PollAggregate): void {
    // Update race entity with aggregate data
    const raceId = `office:${aggregate.race_id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const race = this.graph.getEntity(raceId);

    if (race && race.type === 'office') {
      // Store poll average in the base entity metadata (generic Record<string, unknown>)
      const updatedEntity = {
        ...race,
        updatedAt: new Date().toISOString(),
      };

      // Add poll aggregate to sources array as a reference
      if (!updatedEntity.sources) {
        updatedEntity.sources = [];
      }
      updatedEntity.sources.push(`poll-aggregate:${aggregate.race_id}`);

      this.graph.updateEntity(raceId, updatedEntity);
    }
  }

  /**
   * Get poll entities for a specific race
   */
  getPollsForRace(raceId: string): PollEntity[] {
    const officeId = `office:${raceId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const polls: PollEntity[] = [];

    const result = this.graph.query({
      entityTypes: ['poll'],
      relationshipTypes: ['MEASURES'],
    });

    for (const entity of result.entities) {
      if (entity.type === 'poll') {
        const poll = entity as PollEntity;
        if (poll.metadata.race === raceId) {
          polls.push(poll);
        }
      }
    }

    return polls;
  }

  /**
   * Get candidates being polled in a race
   */
  getCandidatesPolled(raceId: string): CandidateEntity[] {
    const officeId = `office:${raceId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return this.graph.getCandidatesForOffice(officeId);
  }

  /**
   * Get polling leader for a race
   */
  getPollingLeader(raceId: string): { candidate: CandidateEntity; margin: number } | null {
    const polls = this.getPollsForRace(raceId);
    if (polls.length === 0) return null;

    // Get most recent poll
    const latestPoll = polls.sort((a, b) => {
      const dateA = new Date(a.metadata.fieldDates.end).getTime();
      const dateB = new Date(b.metadata.fieldDates.end).getTime();
      return dateB - dateA;
    })[0];

    // Find SHOWS_LEADING relationship
    const connections = this.graph.getConnections(latestPoll.id, ['SHOWS_LEADING']);
    if (connections.length === 0) return null;

    const leadingRel = connections[0];
    const candidate = this.graph.getEntity(leadingRel.entity.id);

    if (candidate && candidate.type === 'candidate') {
      return {
        candidate: candidate as CandidateEntity,
        margin: (leadingRel.relationship.properties?.margin as number) || 0,
      };
    }

    return null;
  }

  /**
   * Ensure race entity exists in graph
   */
  private ensureRaceEntity(poll: Poll): string {
    const raceId = `office:${poll.race_id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    if (!this.graph.getEntity(raceId)) {
      // Parse race type from race_id (e.g., "MI-GOV-2026" -> governor)
      const parts = poll.race_id.split('-');
      const raceTypeCode = parts[1] || '';
      const year = parts[2] || new Date().getFullYear().toString();

      const officeType = this.mapRaceType(raceTypeCode);
      const level = this.mapLevel(raceTypeCode);

      const office: OfficeEntity = {
        id: raceId,
        type: 'office',
        name: `${poll.geography} ${officeType} ${year}`,
        metadata: {
          level,
          officeType: this.mapOfficeType(raceTypeCode),
          jurisdiction: poll.geography,
          termLength: this.getTermLength(raceTypeCode),
          nextElection: `${year}-11-03`, // Approximate
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.graph.addEntity(office);
    }

    return raceId;
  }

  /**
   * Ensure candidate entity exists in graph
   */
  private ensureCandidateEntity(name: string, party: Party): string {
    const candidateId = this.getCandidateId(name, party);

    if (!this.graph.getEntity(candidateId)) {
      const candidate: CandidateEntity = {
        id: candidateId,
        type: 'candidate',
        name,
        aliases: [name.toLowerCase()],
        metadata: {
          party: this.mapPartyToGraph(party),
          status: 'declared',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.graph.addEntity(candidate);
    }

    return candidateId;
  }

  /**
   * Ensure candidate has RUNNING_FOR relationship to race
   */
  private ensureCandidateRunningFor(candidateId: string, raceId: string): void {
    const relId = `${candidateId}--RUNNING_FOR--${raceId}`;

    if (!this.graph.getRelationship(relId)) {
      this.graph.addRelationship({
        id: relId,
        type: 'RUNNING_FOR',
        sourceId: candidateId,
        sourceType: 'candidate',
        targetId: raceId,
        targetType: 'office',
        createdAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Generate candidate ID
   */
  private getCandidateId(name: string, party: Party): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `candidate:${slug}`;
  }

  /**
   * Map poll party to graph party format
   */
  private mapPartyToGraph(party: Party): 'DEM' | 'REP' | 'IND' | 'OTHER' {
    switch (party) {
      case 'DEM':
        return 'DEM';
      case 'REP':
        return 'REP';
      case 'IND':
        return 'IND';
      default:
        return 'OTHER';
    }
  }

  /**
   * Map race type code to office name
   */
  private mapRaceType(code: string): string {
    const mapping: Record<string, string> = {
      PRES: 'President',
      SEN: 'Senator',
      GOV: 'Governor',
      HOUSE: 'Representative',
      STSEN: 'State Senator',
      STHOUSE: 'State Representative',
      APPROVAL: 'Approval Rating',
    };
    return mapping[code] || code;
  }

  /**
   * Map race type code to level
   */
  private mapLevel(code: string): 'federal' | 'state' | 'county' | 'local' {
    if (['PRES', 'SEN', 'HOUSE'].includes(code)) return 'federal';
    if (['GOV', 'STSEN', 'STHOUSE'].includes(code)) return 'state';
    return 'local';
  }

  /**
   * Map race type to office type
   */
  private mapOfficeType(code: string): 'executive' | 'legislative' | 'judicial' {
    if (['PRES', 'GOV'].includes(code)) return 'executive';
    return 'legislative';
  }

  /**
   * Get term length for office type
   */
  private getTermLength(code: string): number {
    const terms: Record<string, number> = {
      PRES: 4,
      SEN: 6,
      GOV: 4,
      HOUSE: 2,
      STSEN: 4,
      STHOUSE: 2,
    };
    return terms[code] || 4;
  }
}

// Singleton instance
let bridgeInstance: PollToGraphBridge | null = null;

export function getPollToGraphBridge(): PollToGraphBridge {
  if (!bridgeInstance) {
    bridgeInstance = new PollToGraphBridge();
  }
  return bridgeInstance;
}
