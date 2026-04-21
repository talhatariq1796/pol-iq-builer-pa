/**
 * KnowledgeGraph - Core graph storage and query engine
 *
 * In-memory graph database for political entity relationships.
 * Supports entity CRUD, relationship management, and graph traversal.
 */

import {
  Entity,
  EntityType,
  Relationship,
  RelationshipType,
  GraphQuery,
  GraphQueryResult,
  CandidateEntity,
  JurisdictionEntity,
  PrecinctEntity,
  IssueEntity,
  OfficeEntity,
} from './types';

export class KnowledgeGraph {
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();

  // Indexes for fast lookups
  private entitiesByType: Map<EntityType, Set<string>> = new Map();
  private entitiesByName: Map<string, Set<string>> = new Map(); // Lowercase name -> entity IDs
  private relationshipsBySource: Map<string, Set<string>> = new Map();
  private relationshipsByTarget: Map<string, Set<string>> = new Map();
  private relationshipsByType: Map<RelationshipType, Set<string>> = new Map();

  constructor() {
    // Initialize type indexes
    const entityTypes: EntityType[] = [
      'candidate', 'office', 'party', 'jurisdiction', 'precinct',
      'issue', 'organization', 'event', 'poll', 'election'
    ];
    entityTypes.forEach(type => this.entitiesByType.set(type, new Set()));

    const relationshipTypes: RelationshipType[] = [
      'RUNNING_FOR', 'MEMBER_OF', 'ENDORSED_BY', 'OPPOSES', 'SUPPORTS_ISSUE',
      'OPPOSES_ISSUE', 'REPRESENTS', 'CAMPAIGNED_IN', 'GOVERNS', 'INCUMBENT',
      'FORMER_HOLDER', 'CONTAINS', 'PART_OF', 'BORDERS', 'CONTESTED_IN',
      'PARTICIPATED_IN', 'WON', 'LOST', 'SALIENT_IN', 'ASSOCIATED_WITH',
      'MEASURES', 'SHOWS_LEADING', 'SUPPORTS', 'FUNDED_BY', 'AFFILIATED_WITH'
    ];
    relationshipTypes.forEach(type => this.relationshipsByType.set(type, new Set()));
  }

  // ============================================================================
  // Entity Operations
  // ============================================================================

  addEntity(entity: Entity): void {
    // Generate ID if not provided
    if (!entity.id) {
      entity.id = this.generateEntityId(entity.type, entity.name);
    }

    // Set timestamps
    const now = new Date().toISOString();
    entity.createdAt = entity.createdAt || now;
    entity.updatedAt = now;

    // Store entity
    this.entities.set(entity.id, entity);

    // Update indexes
    this.entitiesByType.get(entity.type)?.add(entity.id);
    this.indexEntityName(entity.id, entity.name);
    if (entity.aliases) {
      entity.aliases.forEach(alias => this.indexEntityName(entity.id, alias));
    }
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  updateEntity(id: string, updates: Partial<Entity>): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    // Remove old name index if name is changing
    if (updates.name && updates.name !== entity.name) {
      this.removeNameIndex(id, entity.name);
      this.indexEntityName(id, updates.name);
    }

    // Merge updates
    Object.assign(entity, updates, { updatedAt: new Date().toISOString() });
    return true;
  }

  removeEntity(id: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    // Remove from indexes
    this.entitiesByType.get(entity.type)?.delete(id);
    this.removeNameIndex(id, entity.name);
    entity.aliases?.forEach(alias => this.removeNameIndex(id, alias));

    // Remove associated relationships
    const relIds = [
      ...(this.relationshipsBySource.get(id) || []),
      ...(this.relationshipsByTarget.get(id) || [])
    ];
    relIds.forEach(relId => this.removeRelationship(relId));

    // Remove entity
    this.entities.delete(id);
    return true;
  }

  // ============================================================================
  // Relationship Operations
  // ============================================================================

  addRelationship(relationship: Relationship): void {
    // Generate ID if not provided
    if (!relationship.id) {
      relationship.id = this.generateRelationshipId(
        relationship.sourceId,
        relationship.type,
        relationship.targetId
      );
    }

    relationship.createdAt = relationship.createdAt || new Date().toISOString();

    // Store relationship
    this.relationships.set(relationship.id, relationship);

    // Update indexes
    if (!this.relationshipsBySource.has(relationship.sourceId)) {
      this.relationshipsBySource.set(relationship.sourceId, new Set());
    }
    this.relationshipsBySource.get(relationship.sourceId)!.add(relationship.id);

    if (!this.relationshipsByTarget.has(relationship.targetId)) {
      this.relationshipsByTarget.set(relationship.targetId, new Set());
    }
    this.relationshipsByTarget.get(relationship.targetId)!.add(relationship.id);

    this.relationshipsByType.get(relationship.type)?.add(relationship.id);
  }

  getRelationship(id: string): Relationship | undefined {
    return this.relationships.get(id);
  }

  removeRelationship(id: string): boolean {
    const rel = this.relationships.get(id);
    if (!rel) return false;

    // Remove from indexes
    this.relationshipsBySource.get(rel.sourceId)?.delete(id);
    this.relationshipsByTarget.get(rel.targetId)?.delete(id);
    this.relationshipsByType.get(rel.type)?.delete(id);

    // Remove relationship
    this.relationships.delete(id);
    return true;
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  query(q: GraphQuery): GraphQueryResult {
    const startTime = Date.now();
    let entityIds: Set<string> | null = null;

    // Filter by entity type
    if (q.entityTypes && q.entityTypes.length > 0) {
      entityIds = new Set<string>();
      q.entityTypes.forEach(type => {
        this.entitiesByType.get(type)?.forEach(id => entityIds!.add(id));
      });
    }

    // Filter by specific IDs
    if (q.entityIds && q.entityIds.length > 0) {
      const idSet = new Set(q.entityIds);
      if (entityIds) {
        entityIds = new Set([...entityIds].filter(id => idSet.has(id)));
      } else {
        entityIds = idSet;
      }
    }

    // Filter by name pattern
    if (q.namePattern) {
      const matches = this.findEntitiesByName(q.namePattern);
      if (entityIds) {
        entityIds = new Set([...entityIds].filter(id => matches.has(id)));
      } else {
        entityIds = matches;
      }
    }

    // If no entity filters, start with all entities
    if (!entityIds) {
      entityIds = new Set(this.entities.keys());
    }

    // Apply property filters
    if (q.filters && q.filters.length > 0) {
      entityIds = new Set(
        [...entityIds].filter(id => {
          const entity = this.entities.get(id);
          if (!entity) return false;
          return q.filters!.every(filter => this.matchesFilter(entity, filter));
        })
      );
    }

    // Get entities
    let entities = [...entityIds]
      .map(id => this.entities.get(id)!)
      .filter(Boolean);

    // Traverse relationships if requested
    let relationships: Relationship[] = [];
    if (q.relationshipTypes && q.relationshipTypes.length > 0) {
      const { traversedEntities, traversedRelationships } = this.traverseRelationships(
        entityIds,
        q.relationshipTypes,
        q.direction || 'both',
        q.maxDepth || 1
      );
      relationships = traversedRelationships;

      // Add traversed entities to results
      traversedEntities.forEach(id => {
        if (!entityIds!.has(id)) {
          const entity = this.entities.get(id);
          if (entity) entities.push(entity);
        }
      });
    }

    // Apply pagination
    const totalEntities = entities.length;
    if (q.offset) {
      entities = entities.slice(q.offset);
    }
    if (q.limit) {
      entities = entities.slice(0, q.limit);
    }

    return {
      entities,
      relationships,
      metadata: {
        totalEntities,
        totalRelationships: relationships.length,
        queryTimeMs: Date.now() - startTime,
      },
    };
  }

  // ============================================================================
  // Specialized Queries
  // ============================================================================

  /**
   * Find candidates running for a specific office
   */
  getCandidatesForOffice(officeId: string): CandidateEntity[] {
    const candidates: CandidateEntity[] = [];
    const relIds = this.relationshipsByTarget.get(officeId) || new Set();

    relIds.forEach(relId => {
      const rel = this.relationships.get(relId);
      if (rel && rel.type === 'RUNNING_FOR') {
        const candidate = this.entities.get(rel.sourceId);
        if (candidate && candidate.type === 'candidate') {
          candidates.push(candidate as CandidateEntity);
        }
      }
    });

    return candidates;
  }

  /**
   * Find all entities connected to a given entity
   */
  getConnections(entityId: string, relationshipTypes?: RelationshipType[]): {
    entity: Entity;
    relationship: Relationship;
    direction: 'outgoing' | 'incoming';
  }[] {
    const connections: {
      entity: Entity;
      relationship: Relationship;
      direction: 'outgoing' | 'incoming';
    }[] = [];

    // Outgoing relationships
    const outgoing = this.relationshipsBySource.get(entityId) || new Set();
    outgoing.forEach(relId => {
      const rel = this.relationships.get(relId);
      if (rel && (!relationshipTypes || relationshipTypes.includes(rel.type))) {
        const target = this.entities.get(rel.targetId);
        if (target) {
          connections.push({ entity: target, relationship: rel, direction: 'outgoing' });
        }
      }
    });

    // Incoming relationships
    const incoming = this.relationshipsByTarget.get(entityId) || new Set();
    incoming.forEach(relId => {
      const rel = this.relationships.get(relId);
      if (rel && (!relationshipTypes || relationshipTypes.includes(rel.type))) {
        const source = this.entities.get(rel.sourceId);
        if (source) {
          connections.push({ entity: source, relationship: rel, direction: 'incoming' });
        }
      }
    });

    return connections;
  }

  /**
   * Find issues salient in a jurisdiction or precinct
   */
  getIssuesForArea(areaId: string): IssueEntity[] {
    const issues: IssueEntity[] = [];
    const relIds = this.relationshipsByTarget.get(areaId) || new Set();

    relIds.forEach(relId => {
      const rel = this.relationships.get(relId);
      if (rel && rel.type === 'SALIENT_IN') {
        const issue = this.entities.get(rel.sourceId);
        if (issue && issue.type === 'issue') {
          issues.push(issue as IssueEntity);
        }
      }
    });

    return issues;
  }

  /**
   * Find precincts where a candidate has campaigned
   */
  getCampaignedPrecincts(candidateId: string): PrecinctEntity[] {
    const precincts: PrecinctEntity[] = [];
    const relIds = this.relationshipsBySource.get(candidateId) || new Set();

    relIds.forEach(relId => {
      const rel = this.relationships.get(relId);
      if (rel && rel.type === 'CAMPAIGNED_IN') {
        const target = this.entities.get(rel.targetId);
        if (target && target.type === 'precinct') {
          precincts.push(target as PrecinctEntity);
        }
      }
    });

    return precincts;
  }

  /**
   * Find shortest path between two entities
   */
  findPath(sourceId: string, targetId: string, maxDepth: number = 5): {
    nodes: Entity[];
    edges: Relationship[];
  } | null {
    if (sourceId === targetId) {
      const entity = this.entities.get(sourceId);
      return entity ? { nodes: [entity], edges: [] } : null;
    }

    // BFS for shortest path
    const visited = new Set<string>([sourceId]);
    const queue: Array<{ entityId: string; path: string[]; edges: string[] }> = [
      { entityId: sourceId, path: [sourceId], edges: [] }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length > maxDepth) continue;

      // Get all connected entities
      const connections = this.getConnections(current.entityId);

      for (const conn of connections) {
        if (conn.entity.id === targetId) {
          // Found the target
          const nodes = [...current.path, targetId].map(id => this.entities.get(id)!);
          const edges = [...current.edges, conn.relationship.id].map(id => this.relationships.get(id)!);
          return { nodes, edges };
        }

        if (!visited.has(conn.entity.id)) {
          visited.add(conn.entity.id);
          queue.push({
            entityId: conn.entity.id,
            path: [...current.path, conn.entity.id],
            edges: [...current.edges, conn.relationship.id],
          });
        }
      }
    }

    return null; // No path found
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getStats(): {
    entityCount: number;
    relationshipCount: number;
    entitiesByType: Record<string, number>;
    relationshipsByType: Record<string, number>;
  } {
    const entitiesByType: Record<string, number> = {};
    this.entitiesByType.forEach((ids, type) => {
      entitiesByType[type] = ids.size;
    });

    const relationshipsByType: Record<string, number> = {};
    this.relationshipsByType.forEach((ids, type) => {
      relationshipsByType[type] = ids.size;
    });

    return {
      entityCount: this.entities.size,
      relationshipCount: this.relationships.size,
      entitiesByType,
      relationshipsByType,
    };
  }

  /**
   * Get all relationships in the graph
   */
  getAllRelationships(): Relationship[] {
    return Array.from(this.relationships.values());
  }

  /**
   * Get all entities in the graph
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  toJSON(): { entities: Entity[]; relationships: Relationship[] } {
    return {
      entities: Array.from(this.entities.values()),
      relationships: Array.from(this.relationships.values()),
    };
  }

  fromJSON(data: { entities: Entity[]; relationships: Relationship[] }): void {
    // Clear existing data
    this.entities.clear();
    this.relationships.clear();
    this.entitiesByType.forEach(set => set.clear());
    this.entitiesByName.clear();
    this.relationshipsBySource.clear();
    this.relationshipsByTarget.clear();
    this.relationshipsByType.forEach(set => set.clear());

    // Load entities
    data.entities.forEach(entity => this.addEntity(entity));

    // Load relationships
    data.relationships.forEach(rel => this.addRelationship(rel));
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private generateEntityId(type: EntityType, name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    return `${type}:${slug}`;
  }

  private generateRelationshipId(sourceId: string, type: RelationshipType, targetId: string): string {
    return `${sourceId}--${type}--${targetId}`;
  }

  private indexEntityName(entityId: string, name: string): void {
    const key = name.toLowerCase();
    if (!this.entitiesByName.has(key)) {
      this.entitiesByName.set(key, new Set());
    }
    this.entitiesByName.get(key)!.add(entityId);
  }

  private removeNameIndex(entityId: string, name: string): void {
    const key = name.toLowerCase();
    this.entitiesByName.get(key)?.delete(entityId);
  }

  private findEntitiesByName(pattern: string): Set<string> {
    const matches = new Set<string>();
    const patternLower = pattern.toLowerCase();

    // Check for exact match first
    if (this.entitiesByName.has(patternLower)) {
      this.entitiesByName.get(patternLower)!.forEach(id => matches.add(id));
    }

    // Fuzzy match - check if pattern is substring
    this.entitiesByName.forEach((ids, name) => {
      if (name.includes(patternLower) || patternLower.includes(name)) {
        ids.forEach(id => matches.add(id));
      }
    });

    return matches;
  }

  private matchesFilter(
    entity: Entity,
    filter: { field: string; operator: string; value: unknown }
  ): boolean {
    // Navigate to the field value (supports nested paths like "metadata.party")
    const fieldPath = filter.field.split('.');
    let value: unknown = entity;
    for (const key of fieldPath) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return false;
      }
    }

    switch (filter.operator) {
      case 'eq': return value === filter.value;
      case 'ne': return value !== filter.value;
      case 'gt': return (value as number) > (filter.value as number);
      case 'lt': return (value as number) < (filter.value as number);
      case 'gte': return (value as number) >= (filter.value as number);
      case 'lte': return (value as number) <= (filter.value as number);
      case 'contains':
        return typeof value === 'string' && value.includes(filter.value as string);
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      default:
        return false;
    }
  }

  private traverseRelationships(
    startIds: Set<string>,
    relationshipTypes: RelationshipType[],
    direction: 'outgoing' | 'incoming' | 'both',
    maxDepth: number
  ): { traversedEntities: Set<string>; traversedRelationships: Relationship[] } {
    const traversedEntities = new Set<string>();
    const traversedRelationships: Relationship[] = [];
    const visitedRelationships = new Set<string>();

    let currentLevel = new Set(startIds);

    for (let depth = 0; depth < maxDepth && currentLevel.size > 0; depth++) {
      const nextLevel = new Set<string>();

      currentLevel.forEach(entityId => {
        // Outgoing
        if (direction === 'outgoing' || direction === 'both') {
          const outgoing = this.relationshipsBySource.get(entityId) || new Set();
          outgoing.forEach(relId => {
            if (visitedRelationships.has(relId)) return;
            const rel = this.relationships.get(relId);
            if (rel && relationshipTypes.includes(rel.type)) {
              visitedRelationships.add(relId);
              traversedRelationships.push(rel);
              traversedEntities.add(rel.targetId);
              nextLevel.add(rel.targetId);
            }
          });
        }

        // Incoming
        if (direction === 'incoming' || direction === 'both') {
          const incoming = this.relationshipsByTarget.get(entityId) || new Set();
          incoming.forEach(relId => {
            if (visitedRelationships.has(relId)) return;
            const rel = this.relationships.get(relId);
            if (rel && relationshipTypes.includes(rel.type)) {
              visitedRelationships.add(relId);
              traversedRelationships.push(rel);
              traversedEntities.add(rel.sourceId);
              nextLevel.add(rel.sourceId);
            }
          });
        }
      });

      currentLevel = nextLevel;
    }

    return { traversedEntities, traversedRelationships };
  }
}

// Singleton instance
let graphInstance: KnowledgeGraph | null = null;

export function getKnowledgeGraph(): KnowledgeGraph {
  if (!graphInstance) {
    graphInstance = new KnowledgeGraph();
  }
  return graphInstance;
}

export default KnowledgeGraph;
