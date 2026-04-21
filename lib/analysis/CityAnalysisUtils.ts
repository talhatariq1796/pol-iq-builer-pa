/**
 * CityAnalysisUtils - Centralized city recognition and analysis functionality
 * 
 * Enables city-level analysis and comparisons across all endpoints by:
 * - Recognizing city names in queries
 * - Aggregating ZIP code data by city
 * - Providing city comparison capabilities
 * - Supporting city-specific filtering and analysis
 */

export interface CityRecord {
  cityName: string;
  state?: string;
  zipCodes: string[];
  totalRecords: number;
  aggregatedMetrics: Record<string, number>;
  topPerformingZips: any[];
  averageScores: Record<string, number>;
}

export interface CityComparison {
  city1: CityRecord;
  city2: CityRecord;
  differences: Record<string, number>;
  winner: string;
  comparisonSummary: string;
}

export interface CityAnalysisResult {
  isCityQuery: boolean;
  detectedCities: string[];
  isComparison: boolean;
  filteredData: any[];
  cityRecords: CityRecord[];
  comparison?: CityComparison;
}

/**
 * City name mappings and aliases for robust recognition
 */
export const CITY_MAPPINGS: Record<string, string[]> = {
  'New York': ['NYC', 'New York', 'New York City', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'],
  'Philadelphia': ['Philadelphia', 'Philly', 'PHL'],
  'Chicago': ['Chicago', 'Chi-town', 'CHI'],
  'Los Angeles': ['Los Angeles', 'LA', 'LAX'],
  'Boston': ['Boston', 'BOS'],
  'Miami': ['Miami', 'MIA'],
  'Seattle': ['Seattle', 'SEA'],
  'Denver': ['Denver', 'DEN'],
  'Atlanta': ['Atlanta', 'ATL'],
  'San Francisco': ['San Francisco', 'SF', 'SFO'],
  'Washington': ['Washington', 'DC', 'Washington DC', 'Washington D.C.'],
  'Dallas': ['Dallas', 'DFW'],
  'Houston': ['Houston', 'HOU'],
  'Phoenix': ['Phoenix', 'PHX'],
  'Detroit': ['Detroit', 'DET'],
  'Minneapolis': ['Minneapolis', 'MSP'],
  'Las Vegas': ['Las Vegas', 'Vegas', 'LAS'],
  'San Diego': ['San Diego', 'SD'],
  'Tampa': ['Tampa', 'TPA'],
  'Orlando': ['Orlando', 'ORL']
};

/**
 * Reverse mapping for quick city lookup
 */
export const CITY_ALIAS_MAP: Record<string, string> = {};
Object.entries(CITY_MAPPINGS).forEach(([city, aliases]) => {
  aliases.forEach(alias => {
    CITY_ALIAS_MAP[alias.toLowerCase()] = city;
  });
});

/**
 * CityAnalysisUtils - Main utility class
 */
export class CityAnalysisUtils {
  
  /**
   * Detect cities mentioned in a query
   */
  static detectCitiesInQuery(query: string): string[] {
    const queryLower = query.toLowerCase();
    const detectedCities: Set<string> = new Set();
    
    // Extract city names directly from the query without alias mapping
    // Look for common city names using word boundaries
    const commonCities = [
      'Brooklyn', 'Manhattan', 'Queens', 'Bronx', 'Staten Island',
      'Philadelphia', 'Chicago', 'Los Angeles', 'Boston', 'Miami',
      'Seattle', 'Denver', 'Atlanta', 'San Francisco', 'Washington',
      'Dallas', 'Houston', 'Phoenix', 'Detroit', 'Minneapolis',
      'Las Vegas', 'San Diego', 'Tampa', 'Orlando', 'New York'
    ];
    
    commonCities.forEach(city => {
      const cityRegex = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (cityRegex.test(query)) {
        detectedCities.add(city);
      }
    });
    
    return Array.from(detectedCities);
  }
  
  /**
   * Check if query is asking for city comparison
   */
  static isComparisonQuery(query: string): boolean {
    const comparisonWords = ['compare', 'vs', 'versus', 'against', 'between', 'differ'];
    const queryLower = query.toLowerCase();
    return comparisonWords.some(word => queryLower.includes(word));
  }
  
  /**
   * Filter data by city name with smart matching
   */
  static filterDataByCity(data: any[], cityName: string): any[] {
    // Define major city ZIP code prefixes to help disambiguate
    const cityZipPrefixes: Record<string, string[]> = {
      'Philadelphia': ['191'], // Philadelphia, PA
      'Brooklyn': ['112'], // Brooklyn, NY
      'Manhattan': ['100', '101'], // Manhattan, NY
      'Queens': ['110', '111', '113', '114', '116'], // Queens, NY
      'Bronx': ['104'], // Bronx, NY
      'Chicago': ['606'], // Chicago, IL
      'Los Angeles': ['900', '901', '902'], // Los Angeles, CA
      'Boston': ['021', '022'], // Boston, MA
    };
    
    return data.filter(record => {
      const description = record.DESCRIPTION || record.area_name || record.value_DESCRIPTION || '';
      const zipCode = record.ZIP_CODE || record.zip_code || '';
      
      // Extract ZIP from description if not in separate field
      const zipMatch = description.match(/^(\d{5})/);
      const extractedZip = zipMatch ? zipMatch[1] : zipCode;
      
      // For cities with known ZIP prefixes, use that for disambiguation
      const knownPrefixes = cityZipPrefixes[cityName];
      if (knownPrefixes && extractedZip) {
        return knownPrefixes.some(prefix => extractedZip.startsWith(prefix));
      }
      
      // For other cities, use exact parenthetical matching to avoid false positives
      // This matches "ZIP (CityName)" but not "ZIP (New CityName)" or "ZIP (CityName Heights)"
      const cityPattern = new RegExp(`\\(${cityName}\\)$`, 'i');
      return cityPattern.test(description);
    });
  }
  
  /**
   * Aggregate ZIP code data by city
   */
  static aggregateByCity(data: any[], cityName: string, targetField: string = 'value'): CityRecord {
    const cityData = this.filterDataByCity(data, cityName);
    
    if (cityData.length === 0) {
      return {
        cityName,
        zipCodes: [],
        totalRecords: 0,
        aggregatedMetrics: {},
        topPerformingZips: [],
        averageScores: {}
      };
    }
    
    // Calculate aggregated metrics
    const numericFields = this.getNumericFields(cityData[0]);
    const aggregatedMetrics: Record<string, number> = {};
    const averageScores: Record<string, number> = {};
    
    numericFields.forEach(field => {
      const values = cityData
        .map(record => record[field])
        .filter(val => typeof val === 'number' && !isNaN(val));
      
      if (values.length > 0) {
        aggregatedMetrics[field] = values.reduce((sum, val) => sum + val, 0);
        averageScores[field] = aggregatedMetrics[field] / values.length;
      }
    });
    
    // Get top performing ZIP codes
    const topPerformingZips = cityData
      .filter(record => typeof record[targetField] === 'number')
      .sort((a, b) => (b[targetField] || 0) - (a[targetField] || 0))
      .slice(0, 5)
      .map(record => ({
        zipCode: record.ZIP_CODE || record.ID,
        area_name: record.DESCRIPTION || record.area_name,
        value: record[targetField],
        rank: cityData.indexOf(record) + 1
      }));
    
    return {
      cityName,
      zipCodes: cityData.map(r => r.ZIP_CODE || r.ID).filter(Boolean),
      totalRecords: cityData.length,
      aggregatedMetrics,
      topPerformingZips,
      averageScores
    };
  }
  
  /**
   * Compare two cities
   */
  static compareCities(city1Data: CityRecord, city2Data: CityRecord, targetField: string = 'value'): CityComparison {
    const differences: Record<string, number> = {};
    
    // Calculate differences for all common metrics
    const commonFields = Object.keys(city1Data.averageScores).filter(field => 
      field in city2Data.averageScores
    );
    
    commonFields.forEach(field => {
      differences[field] = city1Data.averageScores[field] - city2Data.averageScores[field];
    });
    
    // Determine winner based on target field
    const targetDiff = differences[targetField] || 0;
    const winner = targetDiff > 0 ? city1Data.cityName : city2Data.cityName;
    
    // Create comparison summary
    const comparisonSummary = this.generateComparisonSummary(city1Data, city2Data, differences, targetField);
    
    return {
      city1: city1Data,
      city2: city2Data,
      differences,
      winner,
      comparisonSummary
    };
  }
  
  /**
   * Main analysis function - processes city queries
   */
  static analyzeQuery(query: string, data: any[], targetField: string = 'value'): CityAnalysisResult {
    const detectedCities = this.detectCitiesInQuery(query);
    const isCityQuery = detectedCities.length > 0;
    const isComparison = this.isComparisonQuery(query) && detectedCities.length >= 2;
    
    let filteredData: any[] = data;
    let cityRecords: CityRecord[] = [];
    let comparison: CityComparison | undefined;
    
    if (isCityQuery) {
      // If multiple cities detected, prepare for comparison
      if (detectedCities.length >= 2) {
        cityRecords = detectedCities.map(city => this.aggregateByCity(data, city, targetField));
        
        if (isComparison && cityRecords.length >= 2) {
          comparison = this.compareCities(cityRecords[0], cityRecords[1], targetField);
          // For comparison queries, show data from both cities
          filteredData = detectedCities.reduce((acc: any[], city) => {
            return acc.concat(this.filterDataByCity(data, city));
          }, []);
        }
      } else {
        // Single city analysis
        const cityName = detectedCities[0];
        filteredData = this.filterDataByCity(data, cityName);
        cityRecords = [this.aggregateByCity(data, cityName, targetField)];
      }
    }
    
    return {
      isCityQuery,
      detectedCities,
      isComparison,
      filteredData,
      cityRecords,
      comparison
    };
  }
  
  /**
   * Get numeric fields from a data record
   */
  private static getNumericFields(record: any): string[] {
    return Object.keys(record).filter(key => {
      const value = record[key];
      return typeof value === 'number' && !isNaN(value);
    });
  }
  
  /**
   * Generate human-readable comparison summary
   */
  private static generateComparisonSummary(
    city1: CityRecord, 
    city2: CityRecord, 
    differences: Record<string, number>,
    targetField: string
  ): string {
    const targetDiff = differences[targetField] || 0;
    const winner = targetDiff > 0 ? city1.cityName : city2.cityName;
    const loser = targetDiff > 0 ? city2.cityName : city1.cityName;
    const diffMagnitude = Math.abs(targetDiff);
    
    return `${winner} outperforms ${loser} by ${diffMagnitude.toFixed(2)} points in ${targetField}. ` +
           `${city1.cityName} has ${city1.totalRecords} ZIP codes analyzed, while ${city2.cityName} has ${city2.totalRecords} ZIP codes.`;
  }
  
  /**
   * Generate city analysis metadata for prompts
   */
  static generateCityMetadata(analysis: CityAnalysisResult): string {
    if (!analysis.isCityQuery) {
      return '';
    }
    
    let metadata = `\nCITY ANALYSIS DETECTED:\n`;
    metadata += `- Cities: ${analysis.detectedCities.join(', ')}\n`;
    metadata += `- Query Type: ${analysis.isComparison ? 'City Comparison' : 'Single City Analysis'}\n`;
    
    if (analysis.cityRecords.length > 0) {
      analysis.cityRecords.forEach(city => {
        metadata += `- ${city.cityName}: ${city.totalRecords} ZIP codes analyzed\n`;
      });
    }
    
    if (analysis.comparison) {
      metadata += `- Comparison Winner: ${analysis.comparison.winner}\n`;
      metadata += `- Summary: ${analysis.comparison.comparisonSummary}\n`;
    }
    
    return metadata;
  }
}

export default CityAnalysisUtils;