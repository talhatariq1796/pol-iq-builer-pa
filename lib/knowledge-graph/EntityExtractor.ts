/**
 * EntityExtractor - Extract entities and relationships from political documents
 *
 * Uses pattern matching and NLP-like heuristics to identify:
 * - Candidates (people running for office)
 * - Offices (positions being contested)
 * - Jurisdictions (geographic areas)
 * - Issues (policy topics)
 * - Organizations (parties, PACs, etc.)
 * - Relationships between entities
 */

import {
  EntityType,
  RelationshipType,
  ExtractedEntity,
  ExtractedRelationship,
  ExtractionResult,
} from './types';

// ============================================================================
// Known Entities (Seed Data)
// ============================================================================

const KNOWN_CANDIDATES: Record<string, { party: string; office?: string }> = {
  'gretchen whitmer': { party: 'DEM', office: 'governor' },
  'whitmer': { party: 'DEM', office: 'governor' },
  'gary peters': { party: 'DEM', office: 'us_senate' },
  'peters': { party: 'DEM', office: 'us_senate' },
  'elissa slotkin': { party: 'DEM', office: 'us_senate' },
  'slotkin': { party: 'DEM', office: 'us_senate' },
  'mike rogers': { party: 'REP', office: 'us_senate' },
  'rogers': { party: 'REP' },
  'haley stevens': { party: 'DEM', office: 'us_house' },
  'stevens': { party: 'DEM' },
  'mallory mcmorrow': { party: 'DEM', office: 'state_senate' },
  'mcmorrow': { party: 'DEM' },
  'abdul el-sayed': { party: 'DEM' },
  'el-sayed': { party: 'DEM' },
  'garlin gilchrist': { party: 'DEM', office: 'lt_governor' },
  'gilchrist': { party: 'DEM' },
  'dana nessel': { party: 'DEM', office: 'attorney_general' },
  'nessel': { party: 'DEM' },
  'jocelyn benson': { party: 'DEM', office: 'secretary_of_state' },
  'benson': { party: 'DEM' },
  'donald trump': { party: 'REP', office: 'president' },
  'trump': { party: 'REP' },
  'kamala harris': { party: 'DEM', office: 'president' },
  'harris': { party: 'DEM' },
  'joe biden': { party: 'DEM', office: 'president' },
  'biden': { party: 'DEM' },
};

const KNOWN_OFFICES: Record<string, { level: string; type: string }> = {
  'president': { level: 'federal', type: 'executive' },
  'vice president': { level: 'federal', type: 'executive' },
  'u.s. senate': { level: 'federal', type: 'legislative' },
  'us senate': { level: 'federal', type: 'legislative' },
  'senate': { level: 'federal', type: 'legislative' },
  'u.s. house': { level: 'federal', type: 'legislative' },
  'us house': { level: 'federal', type: 'legislative' },
  'congress': { level: 'federal', type: 'legislative' },
  'congressional': { level: 'federal', type: 'legislative' },
  'governor': { level: 'state', type: 'executive' },
  'lt. governor': { level: 'state', type: 'executive' },
  'lieutenant governor': { level: 'state', type: 'executive' },
  'attorney general': { level: 'state', type: 'executive' },
  'secretary of state': { level: 'state', type: 'executive' },
  'state senate': { level: 'state', type: 'legislative' },
  'state house': { level: 'state', type: 'legislative' },
  'state representative': { level: 'state', type: 'legislative' },
  'state senator': { level: 'state', type: 'legislative' },
  'county commissioner': { level: 'county', type: 'legislative' },
  'county clerk': { level: 'county', type: 'executive' },
  'sheriff': { level: 'county', type: 'executive' },
  'mayor': { level: 'local', type: 'executive' },
  'city council': { level: 'local', type: 'legislative' },
};

const KNOWN_JURISDICTIONS: Record<string, { level: string; parent?: string }> = {
  'michigan': { level: 'state' },
  'mi': { level: 'state' },
  'ingham county': { level: 'county', parent: 'michigan' },
  'ingham': { level: 'county', parent: 'michigan' },
  'lansing': { level: 'city', parent: 'ingham county' },
  'east lansing': { level: 'city', parent: 'ingham county' },
  'mason': { level: 'city', parent: 'ingham county' },
  'meridian township': { level: 'township', parent: 'ingham county' },
  'meridian': { level: 'township', parent: 'ingham county' },
  'delhi township': { level: 'township', parent: 'ingham county' },
  'delhi': { level: 'township', parent: 'ingham county' },
  'williamston': { level: 'city', parent: 'ingham county' },
  'leslie': { level: 'city', parent: 'ingham county' },
  'oakland county': { level: 'county', parent: 'michigan' },
  'wayne county': { level: 'county', parent: 'michigan' },
  'detroit': { level: 'city', parent: 'wayne county' },
};

const KNOWN_PARTIES: Record<string, { full: string; abbreviation: string }> = {
  'democrat': { full: 'Democratic Party', abbreviation: 'DEM' },
  'democratic': { full: 'Democratic Party', abbreviation: 'DEM' },
  'democrats': { full: 'Democratic Party', abbreviation: 'DEM' },
  'republican': { full: 'Republican Party', abbreviation: 'REP' },
  'republicans': { full: 'Republican Party', abbreviation: 'REP' },
  'gop': { full: 'Republican Party', abbreviation: 'REP' },
  'libertarian': { full: 'Libertarian Party', abbreviation: 'LIB' },
  'green': { full: 'Green Party', abbreviation: 'GRN' },
  'independent': { full: 'Independent', abbreviation: 'IND' },
};

const ISSUE_KEYWORDS: Record<string, { category: string; keywords: string[] }> = {
  'abortion': { category: 'social', keywords: ['abortion', 'reproductive rights', 'pro-choice', 'pro-life', 'roe'] },
  'economy': { category: 'economic', keywords: ['economy', 'jobs', 'unemployment', 'inflation', 'wages'] },
  'healthcare': { category: 'social', keywords: ['healthcare', 'health care', 'medicare', 'medicaid', 'insurance'] },
  'education': { category: 'social', keywords: ['education', 'schools', 'teachers', 'college', 'student'] },
  'climate': { category: 'environmental', keywords: ['climate', 'environment', 'green', 'renewable', 'emissions'] },
  'immigration': { category: 'social', keywords: ['immigration', 'border', 'migrants', 'asylum'] },
  'crime': { category: 'social', keywords: ['crime', 'police', 'safety', 'law enforcement'] },
  'taxes': { category: 'economic', keywords: ['taxes', 'tax cuts', 'taxation'] },
  'voting': { category: 'governance', keywords: ['voting', 'election', 'ballot', 'voter'] },
  'guns': { category: 'social', keywords: ['guns', 'gun control', 'second amendment', 'firearms'] },
};

// ============================================================================
// Extraction Patterns
// ============================================================================

// Patterns to identify candidates
const CANDIDATE_PATTERNS = [
  /(?:candidate|running|seeks?|announced|declared|exploring)\s+(?:for\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is\s+)?(?:running|candidate|declared|announced)/gi,
  /(?:Sen\.|Rep\.|Gov\.|Lt\.\s*Gov\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
];

// Patterns to identify relationships
const RELATIONSHIP_PATTERNS: Array<{
  pattern: RegExp;
  type: RelationshipType;
  sourceType: EntityType;
  targetType: EntityType;
}> = [
  {
    pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is\s+)?running\s+for\s+(.+?)(?:\.|,|$)/gi,
    type: 'RUNNING_FOR',
    sourceType: 'candidate',
    targetType: 'office',
  },
  {
    pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:endorsed|supports)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    type: 'ENDORSED_BY',
    sourceType: 'candidate',
    targetType: 'candidate',
  },
  {
    pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+represents?\s+(.+?)(?:\.|,|$)/gi,
    type: 'REPRESENTS',
    sourceType: 'candidate',
    targetType: 'jurisdiction',
  },
  {
    pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+campaigned\s+in\s+(.+?)(?:\.|,|$)/gi,
    type: 'CAMPAIGNED_IN',
    sourceType: 'candidate',
    targetType: 'jurisdiction',
  },
];

// ============================================================================
// EntityExtractor Class
// ============================================================================

export class EntityExtractor {
  /**
   * Extract entities and relationships from a document
   */
  extract(documentId: string, content: string): ExtractionResult {
    const entities: ExtractedEntity[] = [];
    const relationships: ExtractedRelationship[] = [];
    const contentLower = content.toLowerCase();

    // Extract known candidates
    this.extractKnownCandidates(content, contentLower, entities);

    // Extract known offices
    this.extractKnownOffices(content, contentLower, entities);

    // Extract known jurisdictions
    this.extractKnownJurisdictions(content, contentLower, entities);

    // Extract known parties
    this.extractKnownParties(content, contentLower, entities);

    // Extract issues
    this.extractIssues(content, contentLower, entities);

    // Extract elections/events from dates
    this.extractElections(content, entities);

    // Extract relationships
    this.extractRelationships(content, relationships);

    // Deduplicate entities
    const uniqueEntities = this.deduplicateEntities(entities);

    return {
      documentId,
      entities: uniqueEntities,
      relationships,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract known candidates from text
   */
  private extractKnownCandidates(
    content: string,
    contentLower: string,
    entities: ExtractedEntity[]
  ): void {
    for (const [name, info] of Object.entries(KNOWN_CANDIDATES)) {
      const index = contentLower.indexOf(name);
      if (index !== -1) {
        entities.push({
          type: 'candidate',
          name: this.capitalizeWords(name),
          confidence: name.includes(' ') ? 0.9 : 0.7, // Full names have higher confidence
          sourceSpan: { start: index, end: index + name.length },
          context: content.substring(Math.max(0, index - 50), Math.min(content.length, index + name.length + 50)),
        });
      }
    }
  }

  /**
   * Extract known offices from text
   */
  private extractKnownOffices(
    content: string,
    contentLower: string,
    entities: ExtractedEntity[]
  ): void {
    for (const [name, info] of Object.entries(KNOWN_OFFICES)) {
      const index = contentLower.indexOf(name);
      if (index !== -1) {
        entities.push({
          type: 'office',
          name: this.capitalizeWords(name),
          confidence: 0.85,
          sourceSpan: { start: index, end: index + name.length },
        });
      }
    }
  }

  /**
   * Extract known jurisdictions from text
   */
  private extractKnownJurisdictions(
    content: string,
    contentLower: string,
    entities: ExtractedEntity[]
  ): void {
    for (const [name, info] of Object.entries(KNOWN_JURISDICTIONS)) {
      const index = contentLower.indexOf(name);
      if (index !== -1) {
        entities.push({
          type: 'jurisdiction',
          name: this.capitalizeWords(name),
          confidence: 0.9,
          sourceSpan: { start: index, end: index + name.length },
        });
      }
    }
  }

  /**
   * Extract known parties from text
   */
  private extractKnownParties(
    content: string,
    contentLower: string,
    entities: ExtractedEntity[]
  ): void {
    for (const [name, info] of Object.entries(KNOWN_PARTIES)) {
      const regex = new RegExp(`\\b${name}\\b`, 'gi');
      let match;
      while ((match = regex.exec(contentLower)) !== null) {
        entities.push({
          type: 'party',
          name: info.full,
          aliases: [info.abbreviation],
          confidence: 0.95,
          sourceSpan: { start: match.index, end: match.index + match[0].length },
        });
        break; // Only add once per party
      }
    }
  }

  /**
   * Extract issues based on keywords
   */
  private extractIssues(
    content: string,
    contentLower: string,
    entities: ExtractedEntity[]
  ): void {
    for (const [issueName, info] of Object.entries(ISSUE_KEYWORDS)) {
      for (const keyword of info.keywords) {
        if (contentLower.includes(keyword)) {
          entities.push({
            type: 'issue',
            name: this.capitalizeWords(issueName),
            confidence: 0.7,
            context: keyword,
          });
          break; // Only add issue once
        }
      }
    }
  }

  /**
   * Extract elections from dates in text
   */
  private extractElections(content: string, entities: ExtractedEntity[]): void {
    // Match election-related dates
    const datePatterns = [
      /(?:election|primary|general|voting)\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})/gi,
      /(\w+\s+\d{1,2},?\s+\d{4})\s+(?:election|primary|general)/gi,
      /(November\s+\d{1,2},?\s+202[4-9])/gi, // General elections
      /(August\s+\d{1,2},?\s+202[4-9])/gi, // Primary elections
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const dateStr = match[1];
        entities.push({
          type: 'election',
          name: `Election ${dateStr}`,
          confidence: 0.8,
          context: content.substring(Math.max(0, match.index - 30), Math.min(content.length, match.index + 50)),
        });
      }
    }
  }

  /**
   * Extract relationships using patterns
   */
  private extractRelationships(content: string, relationships: ExtractedRelationship[]): void {
    for (const { pattern, type, sourceType, targetType } of RELATIONSHIP_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        if (match[1] && match[2]) {
          relationships.push({
            type,
            sourceName: match[1].trim(),
            sourceType,
            targetName: match[2].trim(),
            targetType,
            confidence: 0.7,
            context: match[0],
          });
        }
      }
    }

    // Extract party memberships
    for (const [candidateName, info] of Object.entries(KNOWN_CANDIDATES)) {
      if (content.toLowerCase().includes(candidateName)) {
        const partyInfo = Object.entries(KNOWN_PARTIES).find(
          ([, p]) => p.abbreviation === info.party
        );
        if (partyInfo) {
          relationships.push({
            type: 'MEMBER_OF',
            sourceName: this.capitalizeWords(candidateName),
            sourceType: 'candidate',
            targetName: partyInfo[1].full,
            targetType: 'party',
            confidence: 0.95,
          });
        }
      }
    }
  }

  /**
   * Deduplicate entities by name and type
   */
  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Map<string, ExtractedEntity>();

    for (const entity of entities) {
      const key = `${entity.type}:${entity.name.toLowerCase()}`;
      const existing = seen.get(key);

      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Capitalize first letter of each word
   */
  private capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }
}

// Singleton instance
let extractorInstance: EntityExtractor | null = null;

export function getEntityExtractor(): EntityExtractor {
  if (!extractorInstance) {
    extractorInstance = new EntityExtractor();
  }
  return extractorInstance;
}

export default EntityExtractor;
