/**
 * Geographic Data Manager - Quebec Province Edition
 * 
 * Manages geographic data for Quebec Province, Canada.
 * Optimized for the Housing Market Analysis project's specific geographic scope.
 */

export interface GeographicDatabase {
  entities: Map<string, GeographicEntity>;
  zipCodeToCity: Map<string, string>;
  zipCodeToCounty: Map<string, string>;
  zipCodeToMetro: Map<string, string>;
  zipCodeToState: Map<string, string>;
  aliasMap: Map<string, string>;
  stateAbbreviations: Map<string, string>;
  regionalGroups: Map<string, string[]>;
}

import { GeographicEntity } from './GeoAwarenessEngine';

export class GeoDataManager {
  private static instance: GeoDataManager | null = null;
  private database: GeographicDatabase;

  private constructor() {
    this.database = {
      entities: new Map(),
      zipCodeToCity: new Map(),
      zipCodeToCounty: new Map(),
      zipCodeToMetro: new Map(),
      zipCodeToState: new Map(),
      aliasMap: new Map(),
      stateAbbreviations: new Map(),
      regionalGroups: new Map()
    };
    this.initializeDatabase();
  }

  public static getInstance(): GeoDataManager {
    if (!GeoDataManager.instance) {
      GeoDataManager.instance = new GeoDataManager();
    }
    return GeoDataManager.instance;
  }

  public getDatabase(): GeographicDatabase {
    return this.database;
  }

  private initializeDatabase(): void {
    console.log('[GeoDataManager] Initializing comprehensive Quebec Province geographic database...');
    
    // Core geographic entities
    this.loadProvinces();
    this.loadQuebecRegions();
    this.loadQuebecCities();
    this.loadQuebecMetros();
    this.aggregateFSAForHigherLevels();
    
    console.log(`[GeoDataManager] Comprehensive Quebec Province database initialized with ${this.database.entities.size} entities`);
  }

  private loadProvinces(): void {
    // Project covers Quebec Province only
    const provinces = [
      { name: 'Quebec', abbr: 'QC', aliases: ['QC', 'QUE', 'Québec', 'Province de Québec', 'La Belle Province'] }
    ];

    provinces.forEach(province => {
      const entity: GeographicEntity = {
        name: province.name,
        type: 'state',
        aliases: [province.abbr, ...province.aliases],
        confidence: 1.0
      };

      this.addEntity(entity);
      this.database.stateAbbreviations.set(province.abbr.toLowerCase(), province.name.toLowerCase());
    });
  }

  private loadQuebecRegions(): void {
    const qcRegions = [
      {
        name: 'Montréal',
        aliases: ['Montreal Region', 'Grand Montréal', 'Greater Montreal'],
        cities: ['Montreal', 'Laval', 'Longueuil', 'Terrebonne', 'Brossard', 'Saint-Jean-sur-Richelieu', 'Dollard-Des Ormeaux', 'Repentigny', 'Saint-Jérôme', 'Mirabel']
      },
      {
        name: 'Capitale-Nationale',
        aliases: ['Quebec City Region', 'National Capital Region', 'Région de Québec'],
        cities: ['Quebec City', 'Lévis', 'Sainte-Foy', 'Beauport', 'Charlesbourg', 'Ancienne-Lorette', 'Saint-Augustin-de-Desmaures']
      },
      {
        name: 'Outaouais',
        aliases: ['Outaouais Region', 'National Capital Region (Quebec)'],
        cities: ['Gatineau', 'Hull', 'Aylmer', 'Buckingham', 'Masson-Angers']
      },
      {
        name: 'Laurentides',
        aliases: ['Laurentians', 'The Laurentians'],
        cities: ['Saint-Jérôme', 'Mirabel', 'Boisbriand', 'Sainte-Thérèse', 'Blainville', 'Rosemère', 'Saint-Eustache', 'Deux-Montagnes']
      },
      {
        name: 'Montérégie',
        aliases: ['Montérégie Region', 'South Shore'],
        cities: ['Longueuil', 'Saint-Jean-sur-Richelieu', 'Brossard', 'Châteauguay', 'Granby', 'Saint-Hyacinthe', 'Sorel-Tracy', 'Valleyfield']
      },
      {
        name: 'Lanaudière',
        aliases: ['Lanaudière Region'],
        cities: ['Terrebonne', 'Repentigny', 'Mascouche', 'Joliette', 'L\'Assomption', 'Berthierville']
      },
      {
        name: 'Saguenay–Lac-Saint-Jean',
        aliases: ['Saguenay', 'Lac-Saint-Jean', 'SLSJ'],
        cities: ['Saguenay', 'Chicoutimi', 'Jonquière', 'Alma', 'Dolbeau-Mistassini']
      },
      {
        name: 'Nord-du-Québec',
        aliases: ['Northern Quebec', 'Nord-du-Québec Region'],
        cities: ['Chibougamau', 'Lebel-sur-Quévillon', 'Matagami']
      },
      {
        name: 'Estrie',
        aliases: ['Eastern Townships', 'Cantons-de-l\'Est'],
        cities: ['Sherbrooke', 'Magog', 'Granby', 'Drummondville', 'Victoriaville']
      },
      {
        name: 'Centre-du-Québec',
        aliases: ['Central Quebec', 'Centre-du-Québec Region'],
        cities: ['Drummondville', 'Victoriaville', 'Bécancour']
      },
      {
        name: 'Abitibi-Témiscamingue',
        aliases: ['Abitibi', 'Témiscamingue'],
        cities: ['Rouyn-Noranda', 'Val-d\'Or', 'Amos']
      },
      {
        name: 'Bas-Saint-Laurent',
        aliases: ['Lower St. Lawrence', 'BSL'],
        cities: ['Rimouski', 'Rivière-du-Loup', 'Matane']
      },
      {
        name: 'Mauricie',
        aliases: ['Mauricie Region'],
        cities: ['Trois-Rivières', 'Shawinigan', 'Grand-Mère']
      }
    ];

    qcRegions.forEach(region => {
      const entity: GeographicEntity = {
        name: region.name,
        type: 'county',
        aliases: region.aliases,
        parentEntity: 'quebec',
        childEntities: region.cities.map(city => city.toLowerCase()),
        confidence: 1.0
      };

      this.addEntity(entity);
    });
  }

  private loadQuebecCities(): void {
    const qcCities = [
      // Major Quebec cities with FSA codes (Forward Sortation Areas - Canadian equivalent of ZIP codes)
      {
        name: 'Montreal',
        aliases: ['Montréal', 'MTL', 'Ville de Montréal'],
        parentRegion: 'montréal',
        // Only FSAs within Montreal city limits (not including Laval, Longueuil, etc.)
        fsaCodes: [
          // H1x: Eastern Montreal (Anjou, Saint-Léonard, Montreal-Nord, Rivière-des-Prairies)
          'H1A', 'H1B', 'H1C', 'H1E', 'H1G', 'H1H', 'H1J', 'H1K', 'H1L', 'H1M',
          'H1N', 'H1P', 'H1R', 'H1S', 'H1T', 'H1V', 'H1W', 'H1X', 'H1Y', 'H1Z',
          // H2x: Central Montreal (Plateau, Mile End, Downtown, Old Montreal, Rosemont)
          'H2A', 'H2B', 'H2C', 'H2E', 'H2G', 'H2H', 'H2J', 'H2K', 'H2L', 'H2M',
          'H2N', 'H2P', 'H2R', 'H2S', 'H2T', 'H2V', 'H2W', 'H2X', 'H2Y', 'H2Z',
          // H3x: Central-West Montreal (CDN, Westmount, NDG, Mount Royal)
          'H3A', 'H3B', 'H3C', 'H3E', 'H3G', 'H3H', 'H3J', 'H3K', 'H3L', 'H3M',
          'H3N', 'H3P', 'H3R', 'H3S', 'H3T', 'H3V', 'H3W', 'H3X', 'H3Y', 'H3Z',
          // H4x: West-Central Montreal (Côte-Saint-Luc, Hampstead, Montreal West, TMR)
          'H4A', 'H4B', 'H4C', 'H4E', 'H4G', 'H4H', 'H4J', 'H4K', 'H4L', 'H4M',
          'H4N', 'H4P', 'H4R', 'H4S', 'H4T', 'H4V', 'H4W', 'H4X', 'H4Y', 'H4Z',
          // H8x: Southwest Montreal (LaSalle, Verdun, Sud-Ouest)
          'H8N', 'H8P', 'H8R', 'H8S', 'H8T', 'H8Y', 'H8Z',
          // H9x: West Island (Pierrefonds, Roxboro, Île-Bizard, DDO, Pointe-Claire, Beaconsfield)
          'H9A', 'H9B', 'H9C', 'H9E', 'H9G', 'H9H', 'H9J', 'H9K', 'H9P', 'H9R', 'H9S', 'H9W', 'H9X'
        ]
      },
      {
        name: 'Quebec City',
        aliases: ['Québec', 'Ville de Québec', 'QC City', 'La Capitale'],
        parentRegion: 'capitale-nationale',
        // Only FSAs within Quebec City limits (not including Lévis or rural areas)
        fsaCodes: [
          // G1x: Central Quebec City (Old Quebec, Saint-Roch, Limoilou, Saint-Sauveur, etc.)
          'G1A', 'G1B', 'G1C', 'G1E', 'G1G', 'G1H', 'G1J', 'G1K', 'G1L', 'G1M',
          'G1N', 'G1P', 'G1R', 'G1S', 'G1T', 'G1V', 'G1W', 'G1X', 'G1Y',
          // G2x: Quebec City neighborhoods (Beauport, Charlesbourg, etc.)
          'G2A', 'G2B', 'G2C', 'G2E', 'G2G', 'G2J', 'G2K', 'G2L', 'G2M', 'G2N',
          // G3x: Quebec City west (Sainte-Foy, Sillery, Cap-Rouge)
          'G3A', 'G3B', 'G3C', 'G3E', 'G3G', 'G3H', 'G3J', 'G3K'
          // Note: G6x removed as those are Lévis FSAs (separate city across the river)
        ]
      },
      {
        name: 'Laval',
        aliases: ['Ville de Laval', 'Île Jésus'],
        parentRegion: 'montréal',
        fsaCodes: ['H7A', 'H7B', 'H7C', 'H7E', 'H7G', 'H7H', 'H7J', 'H7K', 'H7L', 'H7M',
                   'H7N', 'H7P', 'H7R', 'H7S', 'H7T', 'H7V', 'H7W', 'H7X', 'H7Y']
      },
      {
        name: 'Gatineau',
        aliases: ['Hull', 'Aylmer', 'Buckingham', 'Masson-Angers'],
        parentRegion: 'outaouais',
        fsaCodes: ['J8A', 'J8B', 'J8C', 'J8E', 'J8G', 'J8H', 'J8L', 'J8M',
                   'J8N', 'J8P', 'J8R', 'J8T', 'J8V', 'J8X', 'J8Y', 'J8Z',
                   'J9A', 'J9B', 'J9E', 'J9H', 'J9J', 'J9L', 'J9P', 'J9T', 'J9V', 'J9X', 'J9Y', 'J9Z']
      },
      {
        name: 'Longueuil',
        aliases: ['Ville de Longueuil', 'South Shore'],
        parentRegion: 'montérégie',
        fsaCodes: ['J4B', 'J4G', 'J4H', 'J4J', 'J4K', 'J4L', 'J4M', 'J4N', 'J4P', 'J4R', 'J4S',
                   'J4T', 'J4V', 'J4W', 'J4X', 'J4Y', 'J4Z']
      },
      {
        name: 'Sherbrooke',
        aliases: ['Ville de Sherbrooke'],
        parentRegion: 'estrie',
        fsaCodes: ['J1A', 'J1C', 'J1E', 'J1G', 'J1H', 'J1J', 'J1K', 'J1L', 'J1M', 'J1N', 'J1R', 'J1S', 'J1T', 'J1X', 'J1Z']
      },
      {
        name: 'Lévis',
        aliases: ['Ville de Lévis'],
        parentRegion: 'capitale-nationale',
        // Lévis is across the river from Quebec City
        fsaCodes: ['G6V', 'G6W', 'G6X', 'G6Y', 'G6Z', 'G7A']
      },
      {
        name: 'Trois-Rivières',
        aliases: ['Ville de Trois-Rivières', 'TR'],
        parentRegion: 'mauricie',
        fsaCodes: ['G8A', 'G8B', 'G8C', 'G8E', 'G8G', 'G8H', 'G8J', 'G8K', 'G8L', 'G8M',
                   'G8N', 'G8P', 'G8T', 'G8V', 'G8W', 'G8Y', 'G8Z',
                   'G9A', 'G9B', 'G9C', 'G9H', 'G9N', 'G9P', 'G9R', 'G9T', 'G9X']
      },
      {
        name: 'Terrebonne',
        aliases: ['Ville de Terrebonne'],
        parentRegion: 'lanaudière',
        fsaCodes: ['J6E', 'J6J', 'J6K', 'J6N', 'J6R', 'J6S', 'J6T', 'J6V', 'J6W', 'J6X', 'J6Y', 'J6Z', 'J7M']
      },
      {
        name: 'Saint-Jean-sur-Richelieu',
        aliases: ['Saint-Jean', 'SJSR'],
        parentRegion: 'montérégie',
        fsaCodes: ['J2W', 'J2X', 'J2Y', 'J3A', 'J3B']
      },
      {
        name: 'Repentigny',
        aliases: ['Ville de Repentigny'],
        parentRegion: 'lanaudière',
        fsaCodes: ['J5Y', 'J5Z', 'J6A']
      },
      {
        name: 'Brossard',
        aliases: ['Ville de Brossard'],
        parentRegion: 'montérégie',
        fsaCodes: ['J4B', 'J4W', 'J4X', 'J4Y', 'J4Z']
      },
      {
        name: 'Saguenay',
        aliases: ['Ville de Saguenay', 'Chicoutimi', 'Jonquière'],
        parentRegion: 'saguenay–lac-saint-jean',
        fsaCodes: ['G7A', 'G7B', 'G7G', 'G7H', 'G7J', 'G7K', 'G7N', 'G7P', 'G7S', 'G7T', 'G7X', 'G7Y', 'G7Z']
      },
      {
        name: 'Rural Quebec Areas',
        aliases: ['Quebec Rural', 'Rural Areas'],
        parentRegion: 'quebec',
        // G0x codes are rural areas throughout Quebec, not specific to any city
        fsaCodes: ['G0A', 'G0C', 'G0E', 'G0G', 'G0H', 'G0J', 'G0K', 'G0L', 'G0M', 'G0N', 'G0P', 'G0R', 'G0S', 'G0T', 'G0V', 'G0W', 'G0X', 'G0Y', 'G0Z']
      },
      {
        name: 'Quebec Eastern Townships',
        aliases: ['Estrie', 'Cantons-de-l\'Est'],
        parentRegion: 'estrie',
        fsaCodes: ['J0A', 'J0B', 'J0C', 'J0E', 'J0G', 'J0H', 'J0J', 'J0K', 'J0L', 'J0M', 'J0N', 'J0P', 'J0R', 'J0S', 'J0T', 'J0V', 'J0W', 'J0X', 'J0Y', 'J0Z']
      },
      {
        name: 'Drummondville',
        aliases: ['Ville de Drummondville'],
        parentRegion: 'centre-du-québec',
        fsaCodes: ['J2A', 'J2B', 'J2C', 'J2E', 'J2G', 'J2H', 'J2J', 'J2K', 'J2L', 'J2M', 'J2N', 'J2R', 'J2S', 'J2T']
      },
      {
        name: 'Granby',
        aliases: ['Ville de Granby'],
        parentRegion: 'montérégie',
        fsaCodes: ['J2G', 'J2H', 'J2J']
      },
      {
        name: 'Sorel-Tracy',
        aliases: ['Ville de Sorel-Tracy'],
        parentRegion: 'montérégie',
        fsaCodes: ['J3P', 'J3R']
      },
      {
        name: 'Victoriaville',
        aliases: ['Ville de Victoriaville'],
        parentRegion: 'centre-du-québec',
        fsaCodes: ['G6P', 'G6S']
      },
      {
        name: 'Rimouski',
        aliases: ['Ville de Rimouski'],
        parentRegion: 'bas-saint-laurent',
        fsaCodes: ['G5L', 'G5M', 'G5N']
      },
      {
        name: 'Rouyn-Noranda',
        aliases: ['Ville de Rouyn-Noranda'],
        parentRegion: 'abitibi-témiscamingue',
        fsaCodes: ['J9X', 'J9Y', 'J9Z']
      },
      {
        name: 'Val-d\'Or',
        aliases: ['Ville de Val-d\'Or'],
        parentRegion: 'abitibi-témiscamingue',
        fsaCodes: ['J9P']
      },
      {
        name: 'Quebec Central',
        aliases: ['Central Quebec', 'Centre-du-Québec'],
        parentRegion: 'centre-du-québec',
        fsaCodes: ['G3A', 'G3B', 'G3C', 'G3E', 'G3G', 'G3H', 'G3J', 'G3K', 'G3L', 'G3M', 'G3N', 'G3S', 'G3Z',
                   'G4A', 'G4R', 'G4S', 'G4T', 'G4V', 'G4W', 'G4X', 'G4Z',
                   'G5A', 'G5B', 'G5C', 'G5H', 'G5J', 'G5R', 'G5T', 'G5V', 'G5X', 'G5Y', 'G5Z']
      },
      {
        name: 'Lanaudière Region',
        aliases: ['Lanaudière', 'Joliette Region'],
        parentRegion: 'lanaudière',
        fsaCodes: ['J5A', 'J5B', 'J5C', 'J5J', 'J5K', 'J5L', 'J5M', 'J5N', 'J5R', 'J5T', 'J5V', 'J5W', 'J5X', 'J6A']
      },
      {
        name: 'Laurentides Region',
        aliases: ['Laurentides', 'Laurentians'],
        parentRegion: 'laurentides',
        fsaCodes: ['J7A', 'J7B', 'J7C', 'J7E', 'J7G', 'J7H', 'J7J', 'J7K', 'J7L', 'J7N', 'J7P', 'J7R', 'J7T', 'J7V', 'J7W', 'J7X', 'J7Y', 'J7Z']
      },
      {
        name: 'Montérégie Region',
        aliases: ['Montérégie', 'South Shore'],
        parentRegion: 'montérégie',
        fsaCodes: ['J3E', 'J3G', 'J3H', 'J3L', 'J3M', 'J3N', 'J3T', 'J3V', 'J3X', 'J3Y', 'J3Z']
      }
    ];

    qcCities.forEach(city => {
      const entity: GeographicEntity = {
        name: city.name,
        type: 'city',
        aliases: city.aliases,
        parentEntity: city.parentRegion,
        zipCodes: city.fsaCodes,
        confidence: 1.0
      };

      this.addEntity(entity);
      
      // Map each FSA to this city
      city.fsaCodes.forEach(fsa => {
        this.database.zipCodeToCity.set(fsa, city.name.toLowerCase());
        this.database.zipCodeToState.set(fsa, 'quebec');
        if (city.parentRegion) {
          this.database.zipCodeToCounty.set(fsa, city.parentRegion.toLowerCase());
        }
      });
    });
  }

  private loadQuebecMetros(): void {
    const qcMetros = [
      {
        name: 'Greater Montreal',
        aliases: ['Grand Montréal', 'Montreal Metropolitan Area', 'CMA Montreal'],
        cities: ['montreal', 'laval', 'longueuil', 'terrebonne', 'brossard', 'saint-jean-sur-richelieu', 
                 'repentigny', 'dollard-des ormeaux', 'saint-jérôme', 'mirabel']
      },
      {
        name: 'Quebec City Metropolitan Area',
        aliases: ['Communauté métropolitaine de Québec', 'CMA Quebec City'],
        cities: ['quebec city', 'lévis', 'sainte-foy', 'beauport', 'charlesbourg']
      },
      {
        name: 'Gatineau-Ottawa Metro',
        aliases: ['National Capital Region', 'NCR', 'Région de la capitale nationale'],
        cities: ['gatineau', 'hull', 'aylmer', 'buckingham']
      }
    ];

    qcMetros.forEach(metro => {
      const entity: GeographicEntity = {
        name: metro.name,
        type: 'metro',
        aliases: metro.aliases,
        parentEntity: 'quebec',
        childEntities: metro.cities,
        confidence: 1.0
      };

      this.addEntity(entity);
      
      // Map metro to FSA codes through its cities
      metro.cities.forEach(cityName => {
        const cityEntity = this.database.entities.get(cityName);
        if (cityEntity && cityEntity.zipCodes) {
          cityEntity.zipCodes.forEach(fsa => {
            this.database.zipCodeToMetro.set(fsa, metro.name.toLowerCase());
          });
        }
      });
    });
  }

  private aggregateFSAForHigherLevels(): void {
    // Aggregate FSA codes from cities to regions (counties)
    for (const [fsa, cityName] of this.database.zipCodeToCity) {
      const city = this.database.entities.get(cityName);
      if (city && city.parentEntity) {
        const region = this.database.entities.get(city.parentEntity);
        if (region) {
          if (!region.zipCodes) {
            region.zipCodes = [];
          }
          if (!region.zipCodes.includes(fsa)) {
            region.zipCodes.push(fsa);
          }
        }
      }
    }

    console.log('[GeoDataManager] FSA aggregation complete for Quebec regions');
  }

  private addEntity(entity: GeographicEntity): void {
    const key = entity.name.toLowerCase();
    this.database.entities.set(key, entity);
    
    // Add aliases to the alias map
    entity.aliases.forEach(alias => {
      this.database.aliasMap.set(alias.toLowerCase(), key);
    });
    
    console.log(`[GeoDataManager] Added entity: ${entity.name} (${entity.type}) with ${entity.aliases.length} aliases`);
  }
}