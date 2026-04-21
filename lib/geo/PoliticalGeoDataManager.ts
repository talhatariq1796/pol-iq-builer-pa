/**
 * Political Geographic Data Manager
 *
 * Michigan (FIPS 26): Ingham County jurisdictions for legacy query routing.
 * Pennsylvania (FIPS 42): major cities only — statewide precinct naming uses crosswalk IDs elsewhere.
 */

import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

// Extended GeographicEntity with metadata for political context
export interface PoliticalGeographicEntity {
  name: string;
  type: 'country' | 'state' | 'metro' | 'county' | 'city' | 'township';
  aliases: string[];
  parentEntity?: string;
  childEntities?: string[];
  confidence: number;
  metadata?: {
    urbanRural?: 'urban' | 'suburban' | 'rural';
    precinctCount?: number;
    description?: string;
  };
}

export interface PoliticalGeographicDatabase {
  entities: Map<string, PoliticalGeographicEntity>;
  jurisdictionToPrecincts: Map<string, string[]>;
  precinctToJurisdiction: Map<string, string>;
  aliasMap: Map<string, string>;
  // Political-specific mappings
  jurisdictionAliases: Map<string, string[]>;
  regionalGroups: Map<string, string[]>;
}

export interface InghamJurisdiction {
  name: string;
  type: 'city' | 'township' | 'village';
  aliases: string[];
  precinctCount: number;
  precinctIds?: string[];
  // Political context
  urbanRural: 'urban' | 'suburban' | 'rural';
  description?: string;
}

export class PoliticalGeoDataManager {
  private static instance: PoliticalGeoDataManager | null = null;
  private database: PoliticalGeographicDatabase;

  private constructor() {
    this.database = {
      entities: new Map(),
      jurisdictionToPrecincts: new Map(),
      precinctToJurisdiction: new Map(),
      aliasMap: new Map(),
      jurisdictionAliases: new Map(),
      regionalGroups: new Map(),
    };
    this.initializeDatabase();
  }

  public static getInstance(): PoliticalGeoDataManager {
    if (!PoliticalGeoDataManager.instance) {
      PoliticalGeoDataManager.instance = new PoliticalGeoDataManager();
    }
    return PoliticalGeoDataManager.instance;
  }

  public getDatabase(): PoliticalGeographicDatabase {
    return this.database;
  }

  private initializeDatabase(): void {
    if (getPoliticalRegionEnv().stateFips === '42') {
      console.log('[PoliticalGeoDataManager] Initializing Pennsylvania reference places...');
      this.loadPennsylvaniaReferencePlaces();
      console.log(
        `[PoliticalGeoDataManager] Database initialized with ${this.database.entities.size} entities`
      );
      return;
    }

    console.log('[PoliticalGeoDataManager] Initializing Ingham County geographic database...');

    this.loadCounty();
    this.loadJurisdictions();
    this.loadRegionalGroups();

    console.log(
      `[PoliticalGeoDataManager] Database initialized with ${this.database.entities.size} entities`
    );
  }

  /** Minimal city list for NL query routing in PA-only deployments. */
  private loadPennsylvaniaReferencePlaces(): void {
    const { summaryAreaName } = getPoliticalRegionEnv();
    const state: PoliticalGeographicEntity = {
      name: 'Pennsylvania',
      type: 'state',
      aliases: ['PA', 'Penn', 'Commonwealth of Pennsylvania'],
      confidence: 1.0,
    };
    this.addEntity(state);

    const cities: Array<{
      name: string;
      aliases: string[];
      urbanRural: 'urban' | 'suburban' | 'rural';
      description: string;
    }> = [
      {
        name: 'Philadelphia',
        aliases: ['Philly'],
        urbanRural: 'urban',
        description: `Major city, ${summaryAreaName}`,
      },
      {
        name: 'Pittsburgh',
        aliases: ['Pitt'],
        urbanRural: 'urban',
        description: `Major city, ${summaryAreaName}`,
      },
      {
        name: 'Harrisburg',
        aliases: ['Harrisburg PA', 'Capital'],
        urbanRural: 'urban',
        description: `State capital, ${summaryAreaName}`,
      },
      {
        name: 'Allentown',
        aliases: [],
        urbanRural: 'suburban',
        description: `Lehigh Valley, ${summaryAreaName}`,
      },
      {
        name: 'Erie',
        aliases: [],
        urbanRural: 'urban',
        description: `Northwest PA, ${summaryAreaName}`,
      },
      {
        name: 'Reading',
        aliases: [],
        urbanRural: 'urban',
        description: `Southeast PA, ${summaryAreaName}`,
      },
    ];

    for (const c of cities) {
      this.addEntity({
        name: c.name,
        type: 'city',
        aliases: c.aliases,
        parentEntity: 'pennsylvania',
        confidence: 0.95,
        metadata: {
          urbanRural: c.urbanRural,
          description: c.description,
        },
      });
    }

    this.database.regionalGroups.set('southeast pa', ['philadelphia', 'reading']);
    this.database.regionalGroups.set('southwest pa', ['pittsburgh']);
    this.database.regionalGroups.set('capital region', ['harrisburg']);
  }

  private loadCounty(): void {
    const county: PoliticalGeographicEntity = {
      name: 'Ingham County',
      type: 'county',
      aliases: ['Ingham', 'Ingham Co', 'Ingham Co.', 'Ingham County MI', 'Ingham Michigan'],
      parentEntity: 'michigan',
      confidence: 1.0,
    };

    this.addEntity(county);

    // Add state for context
    const state: PoliticalGeographicEntity = {
      name: 'Michigan',
      type: 'state',
      aliases: ['MI', 'Mich', 'Michigan State'],
      confidence: 1.0,
    };
    this.addEntity(state);
  }

  private loadJurisdictions(): void {
    // Ingham County jurisdictions (19 total) with political context
    const jurisdictions: InghamJurisdiction[] = [
      // Cities
      {
        name: 'Lansing',
        type: 'city',
        aliases: [
          'City of Lansing',
          'Lansing City',
          'LAN',
          'Capital City',
          'Michigan Capital',
          'State Capital',
        ],
        precinctCount: 36,
        urbanRural: 'urban',
        description: 'State capital, largest city in Ingham County, diverse urban population',
      },
      {
        name: 'East Lansing',
        type: 'city',
        aliases: ['City of East Lansing', 'East Lansing City', 'EL', 'E Lansing', 'MSU Area'],
        precinctCount: 16,
        urbanRural: 'urban',
        description: 'Home of Michigan State University, young educated population',
      },
      {
        name: 'Mason',
        type: 'city',
        aliases: ['City of Mason', 'Mason City', 'County Seat'],
        precinctCount: 2,
        urbanRural: 'suburban',
        description: 'County seat, historic downtown, suburban character',
      },
      {
        name: 'Leslie',
        type: 'city',
        aliases: ['City of Leslie', 'Leslie City'],
        precinctCount: 2,
        urbanRural: 'rural',
        description: 'Small city in southwest corner of county',
      },
      {
        name: 'Williamston',
        type: 'city',
        aliases: ['City of Williamston', 'Williamston City'],
        precinctCount: 1,
        urbanRural: 'suburban',
        description: 'Small city known for historic downtown and shops',
      },

      // Large Townships
      {
        name: 'Meridian',
        type: 'township',
        aliases: ['Meridian Township', 'Meridian Twp', 'Meridian Twp.', 'Okemos', 'Haslett'],
        precinctCount: 22,
        urbanRural: 'suburban',
        description: 'Affluent suburban township, includes Okemos and Haslett',
      },
      {
        name: 'Delhi',
        type: 'township',
        aliases: ['Delhi Township', 'Delhi Twp', 'Delhi Twp.', 'Holt'],
        precinctCount: 9,
        urbanRural: 'suburban',
        description: 'Suburban township south of Lansing, includes Holt',
      },

      // Smaller Townships
      {
        name: 'Alaiedon',
        type: 'township',
        aliases: ['Alaiedon Township', 'Alaiedon Twp', 'Alaiedon Twp.'],
        precinctCount: 2,
        urbanRural: 'rural',
        description: 'Rural township southeast of Mason',
      },
      {
        name: 'Aurelius',
        type: 'township',
        aliases: ['Aurelius Township', 'Aurelius Twp', 'Aurelius Twp.'],
        precinctCount: 2,
        urbanRural: 'rural',
        description: 'Rural township south of Mason',
      },
      {
        name: 'Bunker Hill',
        type: 'township',
        aliases: ['Bunker Hill Township', 'Bunker Hill Twp', 'Bunker Hill Twp.'],
        precinctCount: 1,
        urbanRural: 'rural',
        description: 'Rural township in southwest corner',
      },
      {
        name: 'Ingham',
        type: 'township',
        aliases: ['Ingham Township', 'Ingham Twp', 'Ingham Twp.'],
        precinctCount: 1,
        urbanRural: 'rural',
        description: 'Rural township east of Mason',
      },
      {
        name: 'Leroy',
        type: 'township',
        aliases: ['Leroy Township', 'Leroy Twp', 'Leroy Twp.'],
        precinctCount: 1,
        urbanRural: 'rural',
        description: 'Rural township in northeast corner',
      },
      {
        name: 'Locke',
        type: 'township',
        aliases: ['Locke Township', 'Locke Twp', 'Locke Twp.'],
        precinctCount: 1,
        urbanRural: 'rural',
        description: 'Rural township in north',
      },
      {
        name: 'Onondaga',
        type: 'township',
        aliases: ['Onondaga Township', 'Onondaga Twp', 'Onondaga Twp.'],
        precinctCount: 1,
        urbanRural: 'rural',
        description: 'Rural township in southwest',
      },
      {
        name: 'Stockbridge',
        type: 'township',
        aliases: ['Stockbridge Township', 'Stockbridge Twp', 'Stockbridge Twp.'],
        precinctCount: 1,
        urbanRural: 'rural',
        description: 'Rural township in southeast corner',
      },
      {
        name: 'Vevay',
        type: 'township',
        aliases: ['Vevay Township', 'Vevay Twp', 'Vevay Twp.'],
        precinctCount: 1,
        urbanRural: 'rural',
        description: 'Rural township south of Mason',
      },
      {
        name: 'Wheatfield',
        type: 'township',
        aliases: ['Wheatfield Township', 'Wheatfield Twp', 'Wheatfield Twp.'],
        precinctCount: 1,
        urbanRural: 'rural',
        description: 'Rural township in northwest',
      },
      {
        name: 'White Oak',
        type: 'township',
        aliases: ['White Oak Township', 'White Oak Twp', 'White Oak Twp.'],
        precinctCount: 1,
        urbanRural: 'rural',
        description: 'Rural township in west',
      },
      {
        name: 'Williamstown',
        type: 'township',
        aliases: ['Williamstown Township', 'Williamstown Twp', 'Williamstown Twp.'],
        precinctCount: 2,
        urbanRural: 'suburban',
        description: 'Township surrounding Williamston city',
      },
    ];

    jurisdictions.forEach((jurisdiction) => {
      const entity: PoliticalGeographicEntity = {
        name: jurisdiction.name,
        type: jurisdiction.type === 'city' ? 'city' : 'township',
        aliases: jurisdiction.aliases,
        parentEntity: 'ingham county',
        confidence: 1.0,
        metadata: {
          urbanRural: jurisdiction.urbanRural,
          precinctCount: jurisdiction.precinctCount,
          description: jurisdiction.description,
        },
      };

      this.addEntity(entity);

      // Store aliases for quick lookup
      this.database.jurisdictionAliases.set(
        jurisdiction.name.toLowerCase(),
        jurisdiction.aliases.map((a) => a.toLowerCase())
      );
    });
  }

  private loadRegionalGroups(): void {
    // Political/geographic groupings for aggregate analysis
    const groups = {
      urban: ['Lansing', 'East Lansing'],
      suburban: ['Meridian', 'Delhi', 'Mason', 'Williamston', 'Williamstown'],
      rural: [
        'Alaiedon',
        'Aurelius',
        'Bunker Hill',
        'Ingham',
        'Leroy',
        'Leslie',
        'Locke',
        'Onondaga',
        'Stockbridge',
        'Vevay',
        'Wheatfield',
        'White Oak',
      ],
      'lansing metro': ['Lansing', 'East Lansing', 'Meridian', 'Delhi'],
      'university area': ['East Lansing', 'Meridian'],
      'capital area': ['Lansing', 'Delhi'],
      'south county': ['Mason', 'Vevay', 'Aurelius', 'Alaiedon', 'Onondaga', 'Leslie'],
      'north county': ['Williamston', 'Williamstown', 'Locke', 'Leroy', 'Wheatfield'],
    };

    for (const [groupName, members] of Object.entries(groups)) {
      this.database.regionalGroups.set(
        groupName.toLowerCase(),
        members.map((m) => m.toLowerCase())
      );

      // Add regional group as entity
      const entity: PoliticalGeographicEntity = {
        name: groupName,
        type: 'metro', // Using metro for regional groups
        aliases: [],
        parentEntity: 'ingham county',
        childEntities: members.map((m) => m.toLowerCase()),
        confidence: 0.9,
      };
      this.addEntity(entity);
    }
  }

  private addEntity(entity: PoliticalGeographicEntity): void {
    const key = entity.name.toLowerCase();
    this.database.entities.set(key, entity);

    // Add aliases to the alias map
    entity.aliases.forEach((alias) => {
      this.database.aliasMap.set(alias.toLowerCase(), key);
    });
  }

  /**
   * Resolve a location name to a jurisdiction
   */
  public resolveLocation(query: string): PoliticalGeographicEntity | null {
    const normalized = query.toLowerCase().trim();

    // Direct match
    if (this.database.entities.has(normalized)) {
      return this.database.entities.get(normalized) || null;
    }

    // Alias match
    const aliasMatch = this.database.aliasMap.get(normalized);
    if (aliasMatch) {
      return this.database.entities.get(aliasMatch) || null;
    }

    // Fuzzy match - try partial matches
    for (const [entityName, entity] of this.database.entities) {
      if (
        entityName.includes(normalized) ||
        normalized.includes(entityName) ||
        entity.aliases.some((a) => a.toLowerCase().includes(normalized))
      ) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Get all jurisdictions in a regional group
   */
  public getRegionalGroup(groupName: string): string[] {
    return this.database.regionalGroups.get(groupName.toLowerCase()) || [];
  }

  /**
   * Get all jurisdiction names
   */
  public getAllJurisdictions(): string[] {
    const jurisdictions: string[] = [];
    for (const [, entity] of this.database.entities) {
      if (entity.type === 'city') {
        jurisdictions.push(entity.name);
      }
    }
    return jurisdictions;
  }

  /**
   * Check if a name is a valid jurisdiction
   */
  public isJurisdiction(name: string): boolean {
    return this.resolveLocation(name) !== null;
  }

  /**
   * Get urban/rural classification
   */
  public getUrbanRuralClass(jurisdictionName: string): 'urban' | 'suburban' | 'rural' | null {
    const entity = this.resolveLocation(jurisdictionName);
    if (entity && entity.metadata) {
      return entity.metadata.urbanRural as 'urban' | 'suburban' | 'rural';
    }
    return null;
  }

  /**
   * Find jurisdictions matching a pattern or description
   */
  public findJurisdictions(pattern: string): PoliticalGeographicEntity[] {
    const normalized = pattern.toLowerCase();
    const matches: PoliticalGeographicEntity[] = [];

    // Check regional groups
    const groupMembers = this.database.regionalGroups.get(normalized);
    if (groupMembers) {
      groupMembers.forEach((member) => {
        const entity = this.database.entities.get(member);
        if (entity) matches.push(entity);
      });
      return matches;
    }

    // Check entities
    for (const [, entity] of this.database.entities) {
      if (
        entity.name.toLowerCase().includes(normalized) ||
        entity.aliases.some((a) => a.toLowerCase().includes(normalized)) ||
        (entity.metadata?.description &&
          (entity.metadata.description as string).toLowerCase().includes(normalized))
      ) {
        matches.push(entity);
      }
    }

    return matches;
  }
}

// Export singleton instance
export const politicalGeoDataManager = PoliticalGeoDataManager.getInstance();
