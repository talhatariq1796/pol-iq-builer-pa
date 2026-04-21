/**
 * Tests for Statistical Foundation Generator
 */

import {
  createStatisticalFoundation,
  extractNumericValues,
  calculateStatistics,
  analyzeDistribution,
  analyzeGeographicCoverage
} from '../StatisticalFoundation';

// Mock feature data for testing
const mockFeatures = [
  { properties: { competitive_analysis_score: 8.5, DESCRIPTION: 'Miami Beach, FL', STATE: 'FL' } },
  { properties: { competitive_analysis_score: 7.2, DESCRIPTION: 'Aventura, FL', STATE: 'FL' } },
  { properties: { competitive_analysis_score: 6.8, DESCRIPTION: 'Coral Gables, FL', STATE: 'FL' } },
  { properties: { competitive_analysis_score: 5.1, DESCRIPTION: 'Downtown Miami, FL', STATE: 'FL' } },
  { properties: { competitive_analysis_score: 4.3, DESCRIPTION: 'Kendall, FL', STATE: 'FL' } },
  { properties: { competitive_analysis_score: 3.9, DESCRIPTION: 'Homestead, FL', STATE: 'FL' } },
  { properties: { competitive_analysis_score: 2.7, DESCRIPTION: 'Rural County, TX', STATE: 'TX' } },
  { properties: { competitive_analysis_score: 2.1, DESCRIPTION: 'Small Town, TX', STATE: 'TX' } },
];

describe('StatisticalFoundation', () => {
  
  describe('extractNumericValues', () => {
    it('should extract numeric values from features', () => {
      const values = extractNumericValues(mockFeatures, 'competitive_analysis_score');
      expect(values).toEqual([8.5, 7.2, 6.8, 5.1, 4.3, 3.9, 2.7, 2.1]);
    });
    
    it('should handle missing fields gracefully', () => {
      const values = extractNumericValues(mockFeatures, 'nonexistent_field');
      expect(values).toEqual([]);
    });
    
    it('should filter out non-numeric values', () => {
      const featuresWithInvalidData = [
        { properties: { score: 5.5 } },
        { properties: { score: 'invalid' } },
        { properties: { score: null } },
        { properties: { score: 3.2 } }
      ];
      const values = extractNumericValues(featuresWithInvalidData, 'score');
      expect(values).toEqual([5.5, 3.2]);
    });
  });
  
  describe('calculateStatistics', () => {
    it('should calculate correct statistics', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = calculateStatistics(values);
      
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(10);
      expect(stats.mean).toBe(5.5);
      expect(stats.median).toBe(5.5);
      expect(stats.count).toBe(10);
      expect(stats.standardDeviation).toBeCloseTo(2.87, 1);
    });
    
    it('should handle empty array', () => {
      const stats = calculateStatistics([]);
      expect(stats.count).toBe(0);
      expect(stats.mean).toBe(0);
    });
    
    it('should handle single value', () => {
      const stats = calculateStatistics([5.0]);
      expect(stats.min).toBe(5.0);
      expect(stats.max).toBe(5.0);
      expect(stats.mean).toBe(5.0);
      expect(stats.median).toBe(5.0);
      expect(stats.standardDeviation).toBe(0);
    });
  });
  
  describe('analyzeDistribution', () => {
    it('should identify normal distribution', () => {
      // Approximately normal distribution
      const values = [4, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 8];
      const distribution = analyzeDistribution(values);
      expect(distribution.type).toBe('normal');
    });
    
    it('should identify skewed distribution', () => {
      // Right-skewed distribution
      const values = [1, 1, 1, 2, 2, 3, 8, 9, 10];
      const distribution = analyzeDistribution(values);
      expect(distribution.type).toBe('skewed');
      expect(distribution.skewness).toBeDefined();
    });
    
    it('should handle insufficient data', () => {
      const distribution = analyzeDistribution([1, 2]);
      expect(distribution.type).toBe('uniform');
    });
  });
  
  describe('analyzeGeographicCoverage', () => {
    it('should analyze geographic coverage correctly', () => {
      const coverage = analyzeGeographicCoverage(mockFeatures);
      
      expect(coverage.totalRegions).toBe(8);
      expect(coverage.uniqueStates).toBe(2); // FL and TX
      expect(coverage.hasDescriptions).toBe(true);
      expect(coverage.coverageType).toBe('Limited Regional'); // < 100 features
    });
    
    it('should handle features without geographic info', () => {
      const featuresNoGeo = [
        { properties: { score: 5.5 } },
        { properties: { score: 3.2 } }
      ];
      const coverage = analyzeGeographicCoverage(featuresNoGeo);
      
      expect(coverage.totalRegions).toBe(2);
      expect(coverage.uniqueStates).toBeUndefined();
      expect(coverage.hasDescriptions).toBe(false);
    });
  });
  
  describe('createStatisticalFoundation', () => {
    it('should create comprehensive statistical summary', () => {
      const summary = createStatisticalFoundation(
        mockFeatures, 
        'competitive_analysis_score', 
        'Test Layer'
      );
      
      expect(summary).toContain('TEST LAYER STATISTICAL FOUNDATION');
      expect(summary).toContain('8 total features analyzed');
      expect(summary).toContain('Range: 2.10 to 8.50');
      expect(summary).toContain('Mean:');
      expect(summary).toContain('Median:');
      expect(summary).toContain('Standard Deviation:');
      expect(summary).toContain('Geographic Coverage:');
      expect(summary).toContain('States Covered: 2');
    });
    
    it('should handle empty feature array', () => {
      const summary = createStatisticalFoundation([], 'score', 'Empty Layer');
      expect(summary).toContain('No data available for analysis');
    });
    
    it('should handle invalid field name', () => {
      const summary = createStatisticalFoundation(
        mockFeatures, 
        'nonexistent_field', 
        'Invalid Field'
      );
      expect(summary).toContain('No valid numeric data found');
    });
  });
  
});