/**
 * GraphPopulator - Populate the knowledge graph with political data
 *
 * Loads from seed data file containing:
 * - Ingham County, Michigan political entities
 * - Federal candidates (US Senate, US House MI-07)
 * - State candidates (State Senate 21, 28; State House 73, 74, 75, 77)
 * - Offices, parties, jurisdictions, elections, and issues
 */

import { KnowledgeGraph, getKnowledgeGraph } from './KnowledgeGraph';
import {
  Entity,
  Relationship,
  EntityType,
  RelationshipType,
  PrecinctEntity,
} from './types';

interface SeedData {
  metadata: {
    version: string;
    created: string;
    description: string;
    coverage: Record<string, string[]>;
  };
  parties: Entity[];
  jurisdictions: Entity[];
  offices: Entity[];
  candidates: Entity[];
  elections: Entity[];
  issues: Entity[];
  relationships: Array<{
    sourceId: string;
    type: RelationshipType;
    targetId: string;
    properties?: Record<string, unknown>;
  }>;
}

interface PopulateOptions {
  includePrecincts?: boolean;
  seedDataUrl?: string;
}

// Cache for seed data
let cachedSeedData: SeedData | null = null;

export class GraphPopulator {
  private graph: KnowledgeGraph;
  private seedDataUrl: string;

  constructor(graph?: KnowledgeGraph, seedDataUrl?: string) {
    this.graph = graph || getKnowledgeGraph();
    this.seedDataUrl = seedDataUrl || '/data/political/knowledge-graph-seed.json';
  }

  /**
   * Populate the graph with seed data
   */
  async populate(options: PopulateOptions = {}): Promise<{
    entitiesAdded: number;
    relationshipsAdded: number;
  }> {
    const { includePrecincts = true } = options;

    let entitiesAdded = 0;
    let relationshipsAdded = 0;

    try {
      // Load seed data
      const seedData = await this.loadSeedData();

      if (!seedData) {
        console.warn('[GraphPopulator] No seed data available');
        return { entitiesAdded: 0, relationshipsAdded: 0 };
      }

      const now = new Date().toISOString();

      // Add parties
      for (const party of seedData.parties || []) {
        this.addEntityWithTimestamps(party, now);
        entitiesAdded++;
      }

      // Add jurisdictions
      for (const jurisdiction of seedData.jurisdictions || []) {
        this.addEntityWithTimestamps(jurisdiction, now);
        entitiesAdded++;
      }

      // Add offices
      for (const office of seedData.offices || []) {
        this.addEntityWithTimestamps(office, now);
        entitiesAdded++;
      }

      // Add candidates
      for (const candidate of seedData.candidates || []) {
        this.addEntityWithTimestamps(candidate, now);
        entitiesAdded++;
      }

      // Add elections
      for (const election of seedData.elections || []) {
        this.addEntityWithTimestamps(election, now);
        entitiesAdded++;
      }

      // Add issues
      for (const issue of seedData.issues || []) {
        this.addEntityWithTimestamps(issue, now);
        entitiesAdded++;
      }

      // Add relationships
      for (const rel of seedData.relationships || []) {
        const sourceEntity = this.graph.getEntity(rel.sourceId);
        const targetEntity = this.graph.getEntity(rel.targetId);

        if (sourceEntity && targetEntity) {
          const relationship: Relationship = {
            id: `${rel.sourceId}--${rel.type}--${rel.targetId}`,
            type: rel.type,
            sourceId: rel.sourceId,
            sourceType: sourceEntity.type,
            targetId: rel.targetId,
            targetType: targetEntity.type,
            properties: rel.properties,
            createdAt: now,
          };
          this.graph.addRelationship(relationship);
          relationshipsAdded++;
        }
      }

      // Add precincts if requested
      if (includePrecincts) {
        const precinctResult = await this.addPrecinctsFromService();
        entitiesAdded += precinctResult.entities;
        relationshipsAdded += precinctResult.relationships;
      }

      console.log(`[GraphPopulator] Added ${entitiesAdded} entities, ${relationshipsAdded} relationships`);

    } catch (error) {
      console.error('[GraphPopulator] Error populating graph:', error);
    }

    return { entitiesAdded, relationshipsAdded };
  }

  /**
   * Load seed data from JSON file
   */
  private async loadSeedData(): Promise<SeedData | null> {
    if (cachedSeedData) {
      return cachedSeedData;
    }

    try {
      // In browser context, fetch from URL
      if (typeof window !== 'undefined') {
        const response = await fetch(this.seedDataUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch seed data: ${response.statusText}`);
        }
        cachedSeedData = await response.json();
        return cachedSeedData;
      }

      // In Node.js context, read from file system
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public', this.seedDataUrl);
      const content = await fs.readFile(filePath, 'utf-8');
      cachedSeedData = JSON.parse(content);
      return cachedSeedData;

    } catch (error) {
      console.warn('[GraphPopulator] Could not load seed data:', error);
      return null;
    }
  }

  /**
   * Add entity with timestamps
   */
  private addEntityWithTimestamps(entity: Entity, now: string): void {
    const entityWithTimestamps = {
      ...entity,
      createdAt: entity.createdAt || now,
      updatedAt: entity.updatedAt || now,
    };
    this.graph.addEntity(entityWithTimestamps as Entity);
  }

  /**
   * Add precincts from PoliticalDataService
   */
  private async addPrecinctsFromService(): Promise<{ entities: number; relationships: number }> {
    let entities = 0;
    let relationships = 0;

    try {
      // Dynamically import to avoid circular dependencies
      const { politicalDataService } = await import('@/lib/services/PoliticalDataService');
      const precincts = await politicalDataService.getUnifiedPrecinctData();
      const now = new Date().toISOString();

      for (const [id, precinct] of Object.entries(precincts)) {
        const precinctEntity: PrecinctEntity = {
          id: `precinct:${id}`,
          type: 'precinct',
          name: precinct.name,
          metadata: {
            jurisdiction: this.findJurisdictionId(precinct.name),
            partisanLean: precinct.electoral?.partisanLean || 0,
            swingPotential: precinct.electoral?.swingPotential || 0,
            gotvPriority: precinct.targeting?.gotvPriority || 0,
            persuasionOpportunity: precinct.targeting?.persuasionOpportunity || 0,
            competitiveness: precinct.electoral?.competitiveness || 'unknown',
            strategy: precinct.targeting?.strategy || 'unknown',
            registeredVoters: precinct.demographics?.registeredVoters,
          },
          createdAt: now,
          updatedAt: now,
        };

        this.graph.addEntity(precinctEntity);
        entities++;

        // Add PART_OF relationship to jurisdiction
        if (precinctEntity.metadata.jurisdiction) {
          const rel: Relationship = {
            id: `${precinctEntity.id}--PART_OF--${precinctEntity.metadata.jurisdiction}`,
            type: 'PART_OF',
            sourceId: precinctEntity.id,
            sourceType: 'precinct',
            targetId: precinctEntity.metadata.jurisdiction,
            targetType: 'jurisdiction',
            createdAt: now,
          };
          this.graph.addRelationship(rel);
          relationships++;
        }

        // Link precincts to their State House district representatives
        const districtMatch = this.findStateHouseDistrict(precinct.name);
        if (districtMatch) {
          const rel: Relationship = {
            id: `${precinctEntity.id}--PART_OF--office:mi-house-${districtMatch}`,
            type: 'PART_OF',
            sourceId: precinctEntity.id,
            sourceType: 'precinct',
            targetId: `office:mi-house-${districtMatch}`,
            targetType: 'office',
            createdAt: now,
          };
          this.graph.addRelationship(rel);
          relationships++;
        }
      }
    } catch (error) {
      console.warn('[GraphPopulator] Could not load precinct data:', error);
    }

    return { entities, relationships };
  }

  /**
   * Find jurisdiction ID from precinct name
   */
  private findJurisdictionId(precinctName: string): string {
    const jurisdictionPatterns: Array<{ pattern: RegExp; id: string }> = [
      { pattern: /^lansing\s+(city\s+)?(\d|precinct)/i, id: 'jurisdiction:lansing' },
      { pattern: /^east\s+lansing/i, id: 'jurisdiction:east-lansing' },
      { pattern: /^meridian/i, id: 'jurisdiction:meridian-township' },
      { pattern: /^delhi/i, id: 'jurisdiction:delhi-township' },
      { pattern: /^mason\s+(city\s+)?(\d|precinct)/i, id: 'jurisdiction:mason' },
      { pattern: /^williamston/i, id: 'jurisdiction:williamston' },
      { pattern: /^leslie/i, id: 'jurisdiction:leslie' },
      { pattern: /^lansing\s+township/i, id: 'jurisdiction:lansing-township' },
      { pattern: /^alaiedon/i, id: 'jurisdiction:alaiedon-township' },
      { pattern: /^aurelius/i, id: 'jurisdiction:aurelius-township' },
      { pattern: /^bunker\s+hill/i, id: 'jurisdiction:bunker-hill-township' },
      { pattern: /^ingham\s+township/i, id: 'jurisdiction:ingham-township' },
      { pattern: /^leroy/i, id: 'jurisdiction:leroy-township' },
      { pattern: /^locke/i, id: 'jurisdiction:locke-township' },
      { pattern: /^onondaga/i, id: 'jurisdiction:onondaga-township' },
      { pattern: /^stockbridge/i, id: 'jurisdiction:stockbridge-township' },
      { pattern: /^vevay/i, id: 'jurisdiction:vevay-township' },
      { pattern: /^wheatfield/i, id: 'jurisdiction:wheatfield-township' },
      { pattern: /^white\s+oak/i, id: 'jurisdiction:white-oak-township' },
      { pattern: /^okemos/i, id: 'jurisdiction:meridian-township' },
      { pattern: /^haslett/i, id: 'jurisdiction:meridian-township' },
      { pattern: /^holt/i, id: 'jurisdiction:delhi-township' },
    ];

    for (const { pattern, id } of jurisdictionPatterns) {
      if (pattern.test(precinctName)) {
        return id;
      }
    }

    return 'jurisdiction:ingham-county';
  }

  /**
   * Find State House district for a precinct
   * Based on Ingham County precinct-to-district mapping
   */
  private findStateHouseDistrict(precinctName: string): string | null {
    const nameLower = precinctName.toLowerCase();

    // District 73: MSU campus, Okemos, Mason area
    if (nameLower.includes('okemos') ||
        nameLower.includes('haslett') ||
        nameLower.includes('mason') ||
        nameLower.includes('alaiedon') ||
        nameLower.includes('vevay') ||
        (nameLower.includes('meridian') && !nameLower.includes('east'))) {
      return '73';
    }

    // District 74: Parts of Lansing
    if ((nameLower.includes('lansing') && !nameLower.includes('east')) &&
        (nameLower.includes('city') || /lansing\s+\d/.test(nameLower))) {
      // Most Lansing city precincts are in 74 or 75
      return '74';
    }

    // District 75: Parts of Lansing, Lansing Township
    if (nameLower.includes('lansing township') ||
        nameLower.includes('lansing twp')) {
      return '75';
    }

    // District 77: East Lansing, parts of Lansing
    if (nameLower.includes('east lansing') ||
        nameLower.includes('e. lansing') ||
        nameLower.includes('el ')) {
      return '77';
    }

    // Default - need more precise mapping
    return null;
  }

  /**
   * Get candidate info for a district
   */
  getCandidatesForDistrict(districtType: string, districtNumber: string): {
    incumbent: Entity | undefined;
    challengers: Entity[];
    office: Entity | undefined;
  } {
    let officeId: string;

    switch (districtType.toLowerCase()) {
      case 'state_house':
      case 'state house':
      case 'house':
        officeId = `office:mi-house-${districtNumber}`;
        break;
      case 'state_senate':
      case 'state senate':
      case 'senate':
        officeId = `office:mi-senate-${districtNumber}`;
        break;
      case 'congressional':
      case 'congress':
      case 'us_house':
        officeId = `office:us-house-mi-${districtNumber.padStart(2, '0')}`;
        break;
      default:
        officeId = `office:${districtType}-${districtNumber}`;
    }

    const office = this.graph.getEntity(officeId);
    const candidates = this.graph.getCandidatesForOffice(officeId);

    // Find incumbent
    const incumbent = candidates.find(c =>
      c.metadata?.status === 'incumbent' ||
      c.metadata?.incumbentOf === officeId
    );

    // Find challengers
    const challengers = candidates.filter(c =>
      c.metadata?.status !== 'incumbent' &&
      c.metadata?.incumbentOf !== officeId
    );

    return { incumbent, challengers, office };
  }

  /**
   * Get all representatives for Ingham County
   */
  getInghamCountyRepresentatives(): Array<{
    office: Entity;
    representative: Entity | undefined;
    level: string;
  }> {
    const results: Array<{
      office: Entity;
      representative: Entity | undefined;
      level: string;
    }> = [];

    const officeIds = [
      { id: 'office:us-senate-mi-class1', level: 'Federal' },
      { id: 'office:us-senate-mi-class2', level: 'Federal' },
      { id: 'office:us-house-mi-07', level: 'Federal' },
      { id: 'office:mi-senate-21', level: 'State Senate' },
      { id: 'office:mi-senate-28', level: 'State Senate' },
      { id: 'office:mi-house-73', level: 'State House' },
      { id: 'office:mi-house-74', level: 'State House' },
      { id: 'office:mi-house-75', level: 'State House' },
      { id: 'office:mi-house-77', level: 'State House' },
    ];

    for (const { id, level } of officeIds) {
      const office = this.graph.getEntity(id);
      if (office) {
        const candidates = this.graph.getCandidatesForOffice(id);
        const representative = candidates.find(c =>
          c.metadata?.status === 'incumbent' ||
          c.metadata?.incumbentOf === id
        );
        results.push({ office, representative, level });
      }
    }

    return results;
  }
}

// Singleton instance
let populatorInstance: GraphPopulator | null = null;

export function getGraphPopulator(): GraphPopulator {
  if (!populatorInstance) {
    populatorInstance = new GraphPopulator();
  }
  return populatorInstance;
}

/**
 * Clear cached seed data (useful for testing)
 */
export function clearSeedDataCache(): void {
  cachedSeedData = null;
}

export default GraphPopulator;
