/**
 * Knowledge Graph API
 *
 * Endpoints:
 * - GET /api/knowledge-graph - Get graph stats or query entities
 * - POST /api/knowledge-graph - Query the graph
 * - PUT /api/knowledge-graph - Initialize/populate the graph
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getKnowledgeGraph,
  getGraphPopulator,
  GraphQuery,
  EntityType,
  RelationshipType,
} from '@/lib/knowledge-graph';

// Initialize flag
let graphInitialized = false;

/**
 * Ensure graph is initialized
 */
async function ensureGraphInitialized(): Promise<void> {
  if (graphInitialized) return;

  const graph = getKnowledgeGraph();
  const stats = graph.getStats();

  // If graph is empty, populate it
  if (stats.entityCount === 0) {
    console.log('[Knowledge Graph API] Initializing graph...');
    const populator = getGraphPopulator();
    await populator.populate({
      includePrecincts: true,
    });
    graphInitialized = true;
    console.log('[Knowledge Graph API] Graph initialized:', graph.getStats());
  } else {
    graphInitialized = true;
  }
}

/**
 * GET - Get graph stats or query entities by URL params
 */
export async function GET(req: NextRequest) {
  try {
    await ensureGraphInitialized();
    const graph = getKnowledgeGraph();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Return stats
    if (action === 'stats') {
      return NextResponse.json({
        success: true,
        stats: graph.getStats(),
      });
    }

    // Get all entities and relationships (for visualization)
    if (action === 'all') {
      const entities = graph.getAllEntities();
      const relationships = graph.getAllRelationships();
      return NextResponse.json({
        success: true,
        entities,
        relationships,
        stats: graph.getStats(),
      });
    }

    // Get specific entity
    if (action === 'entity') {
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json({ error: 'Entity ID required' }, { status: 400 });
      }
      const entity = graph.getEntity(id);
      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }

      // Get connections
      const connections = graph.getConnections(id);
      return NextResponse.json({
        success: true,
        entity,
        connections: connections.map(c => ({
          entity: c.entity,
          relationship: c.relationship.type,
          direction: c.direction,
        })),
      });
    }

    // Get candidates for office
    if (action === 'candidates') {
      const officeId = searchParams.get('office');
      if (!officeId) {
        return NextResponse.json({ error: 'Office ID required' }, { status: 400 });
      }
      const candidates = graph.getCandidatesForOffice(officeId);
      return NextResponse.json({
        success: true,
        candidates,
      });
    }

    // Find path between entities
    if (action === 'path') {
      const sourceId = searchParams.get('source');
      const targetId = searchParams.get('target');
      if (!sourceId || !targetId) {
        return NextResponse.json({ error: 'Source and target IDs required' }, { status: 400 });
      }
      const path = graph.findPath(sourceId, targetId);
      return NextResponse.json({
        success: true,
        path,
      });
    }

    // Search entities by name
    if (action === 'search') {
      const name = searchParams.get('name');
      const type = searchParams.get('type') as EntityType | undefined;

      const query: GraphQuery = {
        namePattern: name || undefined,
        entityTypes: type ? [type] : undefined,
        limit: 20,
      };

      const result = graph.query(query);
      return NextResponse.json({
        success: true,
        entities: result.entities,
        metadata: result.metadata,
      });
    }

    // Default: return stats
    return NextResponse.json({
      success: true,
      stats: graph.getStats(),
    });
  } catch (error) {
    console.error('[Knowledge Graph API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to query knowledge graph', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST - Advanced graph query
 */
export async function POST(req: NextRequest) {
  try {
    await ensureGraphInitialized();
    const graph = getKnowledgeGraph();

    const body = await req.json();
    const { query, action } = body;

    // Natural language query interpretation
    if (action === 'interpret') {
      const nlQuery = body.query as string;
      const interpretation = interpretNaturalLanguageQuery(nlQuery);
      const result = graph.query(interpretation);

      return NextResponse.json({
        success: true,
        interpretation,
        result: {
          entities: result.entities,
          relationships: result.relationships,
          metadata: result.metadata,
        },
      });
    }

    // Direct graph query
    if (query) {
      const graphQuery: GraphQuery = {
        entityTypes: query.entityTypes,
        entityIds: query.entityIds,
        namePattern: query.namePattern,
        relationshipTypes: query.relationshipTypes,
        direction: query.direction,
        maxDepth: query.maxDepth,
        filters: query.filters,
        limit: query.limit || 50,
        offset: query.offset,
      };

      const result = graph.query(graphQuery);
      return NextResponse.json({
        success: true,
        entities: result.entities,
        relationships: result.relationships,
        paths: result.paths,
        metadata: result.metadata,
      });
    }

    return NextResponse.json({ error: 'Query or action required' }, { status: 400 });
  } catch (error) {
    console.error('[Knowledge Graph API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to execute query', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PUT - Initialize or refresh the graph
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { refresh = false } = body;

    if (refresh) {
      // Clear and repopulate
      graphInitialized = false;
    }

    await ensureGraphInitialized();
    const graph = getKnowledgeGraph();

    return NextResponse.json({
      success: true,
      message: refresh ? 'Graph refreshed' : 'Graph initialized',
      stats: graph.getStats(),
    });
  } catch (error) {
    console.error('[Knowledge Graph API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize graph', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Interpret natural language query into GraphQuery
 */
function interpretNaturalLanguageQuery(nlQuery: string): GraphQuery {
  const queryLower = nlQuery.toLowerCase();
  const query: GraphQuery = { limit: 20 };

  // Detect entity types
  if (queryLower.includes('candidate') || queryLower.includes('running')) {
    query.entityTypes = ['candidate'];
  } else if (queryLower.includes('precinct')) {
    query.entityTypes = ['precinct'];
  } else if (queryLower.includes('jurisdiction') || queryLower.includes('city') || queryLower.includes('township')) {
    query.entityTypes = ['jurisdiction'];
  } else if (queryLower.includes('issue') || queryLower.includes('topic')) {
    query.entityTypes = ['issue'];
  } else if (queryLower.includes('election')) {
    query.entityTypes = ['election'];
  } else if (queryLower.includes('office') || queryLower.includes('position')) {
    query.entityTypes = ['office'];
  }

  // Detect relationship types
  if (queryLower.includes('running for') || queryLower.includes('candidate for')) {
    query.relationshipTypes = ['RUNNING_FOR'];
    query.direction = 'outgoing';
  } else if (queryLower.includes('endorsed') || queryLower.includes('supports')) {
    query.relationshipTypes = ['ENDORSED_BY', 'SUPPORTS'];
  } else if (queryLower.includes('in ') || queryLower.includes('within')) {
    query.relationshipTypes = ['PART_OF', 'CONTAINS'];
  }

  // Detect filters
  const partyMatch = queryLower.match(/\b(democrat|republican|dem|rep|gop)\b/);
  if (partyMatch) {
    const party = partyMatch[1].includes('dem') ? 'DEM' : 'REP';
    query.filters = [{ field: 'metadata.party', operator: 'eq', value: party }];
  }

  // Detect specific names
  const knownNames = [
    'haley stevens', 'mallory mcmorrow', 'mike rogers', 'abdul el-sayed',
    'gretchen whitmer', 'gary peters', 'dana nessel', 'jocelyn benson',
    'lansing', 'east lansing', 'meridian', 'delhi', 'mason',
  ];

  for (const name of knownNames) {
    if (queryLower.includes(name)) {
      query.namePattern = name;
      break;
    }
  }

  // Swing precincts
  if (queryLower.includes('swing') && query.entityTypes?.includes('precinct')) {
    query.filters = query.filters || [];
    query.filters.push({ field: 'metadata.swingPotential', operator: 'gt', value: 50 });
  }

  return query;
}
