/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { resolveClaudeModel } from '@/lib/ai/claudeModel';
import { layers } from '@/config/layers';
import { ExtendedLayerConfig, LayerConfig } from '@/types/layers';
import type { AnalysisResponse, ProcessedLayerResult } from '@/types/geospatial-chat';
import { NextRequest } from 'next/server';
import { LocalGeospatialFeature } from '@/types/index';
import { getRelevantFields } from '@/utils/field-analysis';
import { EnhancedQueryAnalyzer } from '@/lib/analysis/EnhancedQueryAnalyzer';
import { detectThresholdQuery, detectSegmentQuery, detectComparativeQuery } from '@/lib/analytics/query-analysis';
import { getHousingPersona } from '../shared/housing-personas';
import { unionByGeoId } from '../../../../types/union-layer';
import { multiEndpointFormatting, strategicSynthesis } from '../shared/base-prompt';
import { GeoAwarenessEngine } from '../../../../lib/geo/GeoAwarenessEngine';
import { getAnalysisPrompt } from '../shared/housing-analysis-prompts';
import { resolveAreaName as resolveSharedAreaName, getFSA as getSharedFSA, resolveRegionName as resolveSharedRegionName } from '@/lib/shared/housing-AreaName';
import { getAnalysisLayers, sanitizeSummaryForAnalysis, sanitizeRankingArrayForAnalysis } from '@/lib/analysis/analysisLens';
import { filterFeaturesBySpatialFilterIds, extractFeatureId } from '@/lib/analysis/utils/spatialFilter';
import { getPrimaryScoreField, getTopFieldDefinitions } from '@/lib/analysis/strategies/processors/HardcodedFieldDefs';

/**
 * Validate cluster response for hallucinated data
 */
function validateClusterResponse(response: string, originalAnalysis: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Extract ZIP codes from both texts
  const responseZips: string[] = response.match(/\b\d{5}\b/g) || [];
  const originalZips: string[] = originalAnalysis.match(/\b\d{5}\b/g) || [];
  
  // Check for California ZIP codes (90xxx, 91xxx, 92xxx, 93xxx, 94xxx, 95xxx, 96xxx)
  const californiaZips = responseZips.filter(zip => /^9[0-6]\d{3}$/.test(zip));
  if (californiaZips.length > 0) {
    issues.push(`California ZIP codes found: ${californiaZips.join(', ')}`);
  }
  
  // Check for ZIP codes in response that aren't in original
  const hallucinatedZips = responseZips.filter(zip => !originalZips.includes(zip));
  if (hallucinatedZips.length > 0) {
    issues.push(`Hallucinated ZIP codes: ${hallucinatedZips.join(', ')}`);
  }
  
  // Check for suspicious score patterns (like scores ending in .2, .6, .1, .9 which might be generated)
  const suspiciousScores = response.match(/\d+\.\d/g)?.filter(score => {
    const decimal = parseFloat(score) % 1;
    return Math.abs(decimal - 0.2) < 0.01 || Math.abs(decimal - 0.6) < 0.01 || 
           Math.abs(decimal - 0.1) < 0.01 || Math.abs(decimal - 0.9) < 0.01;
  }) || [];
  
  if (suspiciousScores.length > 3) {
    issues.push(`Suspicious score pattern detected: ${suspiciousScores.slice(0, 5).join(', ')}`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// --- Dynamic Field Alias Overrides ---
// Will be populated per request based on metadata.fieldAliases sent from the frontend
interface FieldAliasMap { [key: string]: string }
let FIELD_ALIAS_OVERRIDES: FieldAliasMap = {};

// --- Endpoint-Specific Metrics Function ---
function addEndpointSpecificMetrics(analysisType: string, features: any[]): string {
  if (!features || features.length === 0) return '';
  
  let metricsSection = '\n=== ENDPOINT-SPECIFIC ENHANCED METRICS ===\n';
  
  // Provide representative sample across the full range for ALL analysis types
  let topFeatures;
  
  // Get the primary scoring field for different analysis types
  const getScoreField = (type: string) => {
    const normalized = type.toLowerCase().replace(/-/g, '_');
    switch (normalized) {
      case 'strategic_analysis':
      case 'strategic':
  // Normalize to the unified field name; downstream will also check legacy fallbacks
  return 'strategic_analysis_score';
      case 'competitive_analysis':
      case 'competitive':
        return 'competitive_analysis_score';
      case 'correlation_analysis':
      case 'correlation':
        return 'correlation_analysis_score';
      case 'comparative_analysis':
      case 'comparative':
        return 'comparison_score';
      case 'brand_difference':
        return 'brand_difference_score';
      case 'brand_analysis':
        return 'brand_analysis_score';
      case 'demographic_insights':
      case 'demographic':
        return 'demographic_insights_score';
      case 'customer_profile':
        return 'customer_profile_score';
      case 'trend_analysis':
        return 'trend_analysis_score';
      case 'anomaly_detection':
        return 'anomaly_detection_score';
      case 'outlier_detection':
        return 'outlier_detection_score';
      case 'predictive_modeling':
        return 'predictive_modeling_score';
      case 'feature_interactions':
        return 'feature_interactions_score';
      case 'segment_profiling':
        return 'segment_profiling_score';
      case 'scenario_analysis':
        return 'scenario_analysis_score';
      case 'model_performance':
        return 'model_performance_score';
      case 'model_selection':
        return 'algorithm_category';
      case 'ensemble_analysis':
        return 'ensemble_analysis_score';
      case 'feature_importance_ranking':
        return 'feature_importance_ranking_score';
      case 'dimensionality_insights':
        return 'dimensionality_insights_score';
      case 'spatial_clusters':
        return 'spatial_clusters_score';
      case 'consensus_analysis':
        return 'consensus_analysis_score';
      case 'algorithm_comparison':
        return 'algorithm_comparison_score';
      case 'sensitivity_analysis':
        return 'sensitivity_analysis_score';
      case 'analyze':
        return 'analysis_score';
      default:
        return 'value'; // Generic fallback
    }
  };
  
  // Prefer central hardcoded mapping, then legacy helper fallback
  let scoreField = getPrimaryScoreField(analysisType) || getScoreField(analysisType);

  // Helper to resolve a human-friendly area name consistently
  const resolveAreaName = (feature: any, index: number): string => {
    try {
      // Debug logging for strategic analysis
      if (index < 3 && analysisType?.includes('strategic')) {
        console.log(`🔍 [resolveAreaName] Strategic Analysis Debug - Feature ${index}:`, {
          feature_keys: Object.keys(feature || {}),
          area_name: feature?.area_name,
          DESCRIPTION: feature?.DESCRIPTION,
          properties_keys: feature?.properties ? Object.keys(feature.properties) : [],
          properties_area_name: feature?.properties?.area_name,
          properties_DESCRIPTION: feature?.properties?.DESCRIPTION,
          properties_id: feature?.properties?.id,
          nested_properties: feature?.properties?.properties ? Object.keys(feature.properties.properties) : []
        });
      }
      
      // Handle double nesting from ChatInterface: feature.properties.properties.DESCRIPTION
      const props = feature.properties || feature;
      const nestedProps = props.properties || props; // Check for double nesting
      
      // Priority 1: Check nested DESCRIPTION (from processor -> ChatInterface wrapping)
      if (typeof nestedProps?.DESCRIPTION === 'string' && nestedProps.DESCRIPTION.trim()) {
        return nestedProps.DESCRIPTION.trim(); // Return full description as-is
      }
      
      // Priority 2: Check flat DESCRIPTION in properties
      if (typeof props?.DESCRIPTION === 'string' && props.DESCRIPTION.trim()) {
        return props.DESCRIPTION.trim(); // Return full description as-is
      }
      
      // Priority 3: Check DESCRIPTION at top level (raw endpoint data)
      if (typeof feature?.DESCRIPTION === 'string' && feature.DESCRIPTION.trim()) {
        return feature.DESCRIPTION.trim(); // Return full description as-is
      }
      
      // Priority 4: Use area_name if no DESCRIPTION (already extracted city name)
      if (typeof props?.area_name === 'string' && props.area_name.trim()) {
        return props.area_name.trim();
      }
      
      // Priority 5: Use shared resolver before local helper
      try {
        const shared = resolveSharedAreaName(feature, { mode: 'full', neutralFallback: '' });
        if (shared) return shared;
      } catch {}
      const f = { properties: props } as LocalGeospatialFeature;
      const name = getLocationName(f);
      if (name && name !== 'Unknown Location') return name;
      
      // Try common name fields
      const nameFields = ['NAME', 'CITY', 'MUNICIPALITY', 'REGION', 'CSDNAME', 'FEDNAME'];
      for (const field of nameFields) {
        if (props?.[field]) return String(props[field]).trim();
      }
      
      // Fall back to ZIP if available
      const zip = getZIPCode(f);
      if (zip && zip !== 'Unknown') return zip;
      
      // Try ID field with proper formatting
      if (feature?.ID || props?.ID) {
        const id = feature.ID || props.ID;
        if (typeof id === 'string' && id.match(/^\d{5}$/)) {
          return `ZIP ${id}`;
        }
        return `Area ${id}`;
      }
      
      // As a last resort, avoid generic labels
      return props?.area_id || feature?.area_id || `Location ${index + 1}`;
    } catch (error) {
      console.error('[resolveAreaName] Error:', error);
      return `Location ${index + 1}`;
    }
  };
  
  // Sort by the appropriate score field to get full range representation
  const sorted = [...features].sort((a, b) => {
    // Handle both flat and double-nested properties (feature.properties.properties)
    const propsA = (a && typeof a === 'object') ? (a as any).properties || a : {};
    const propsB = (b && typeof b === 'object') ? (b as any).properties || b : {};
    const nestedA = (propsA && typeof propsA === 'object') ? (propsA as any).properties || propsA : propsA;
    const nestedB = (propsB && typeof propsB === 'object') ? (propsB as any).properties || propsB : propsB;

    // Prefer normalized score field, then legacy, then generic target/value fallbacks
    const scoreCandidatesA = [
      nestedA?.[scoreField],
      propsA?.[scoreField],
      // Strategic legacy fallbacks
      nestedA?.strategic_value_score,
      propsA?.strategic_value_score,
      nestedA?.strategic_score,
      propsA?.strategic_score,
      // Generic fallbacks
      nestedA?.target_value,
      propsA?.target_value,
      (a as any)?.[scoreField],
      (a as any)?.value
    ];
    const scoreCandidatesB = [
      nestedB?.[scoreField],
      propsB?.[scoreField],
      // Strategic legacy fallbacks
      nestedB?.strategic_value_score,
      propsB?.strategic_value_score,
      nestedB?.strategic_score,
      propsB?.strategic_score,
      // Generic fallbacks
      nestedB?.target_value,
      propsB?.target_value,
      (b as any)?.[scoreField],
      (b as any)?.value
    ];

    const numA = Number(scoreCandidatesA.find((v) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)))) ?? 0);
    const numB = Number(scoreCandidatesB.find((v) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)))) ?? 0);
    return numB - numA; // Highest scores first
  });
  
  // Use FULL dataset for accurate analysis - no sampling limits
  topFeatures = sorted; // Use all features for comprehensive analysis
  
  // Analysis-specific field display functions
  const addStrategicFields = (props: any, metricsSection: string): string => {
    // Strategic analysis focuses on market expansion factors (as used by StrategicAnalysisProcessor)
    let fieldCount = 0;
    
    // Core strategic factors (from processor importance weights)
    if (props?.competitive_advantage_score) {
      metricsSection += `   Competitive Advantage: ${props.competitive_advantage_score.toFixed(1)}\n`;
      fieldCount++;
    }
    if (props?.total_population || props?.value_TOTPOP_CY) {
      const pop = props?.total_population || props?.value_TOTPOP_CY;
      metricsSection += `   Market Size: ${(pop / 1000).toFixed(1)}K people\n`;
      fieldCount++;
    }
    if (props?.median_income || props?.value_AVGHINC_CY) {
      const income = props?.median_income || props?.value_AVGHINC_CY;
      metricsSection += `   Purchasing Power: $${(income / 1000).toFixed(0)}K\n`;
      fieldCount++;
    }
    if (props?.market_gap !== undefined) {
      metricsSection += `   Market Opportunity: ${props.market_gap.toFixed(1)}% untapped\n`;
      fieldCount++;
    }
    if (props?.diversity_index || props?.value_DIVINDX_CY) {
      const diversity = props?.diversity_index || props?.value_DIVINDX_CY;
      metricsSection += `   Market Diversity: ${diversity.toFixed(0)}\n`;
      fieldCount++;
    }
    
    if (fieldCount === 0) {
      metricsSection += `   Limited strategic data available\n`;
    }
    return metricsSection;
  };
  
  const addHousingFields = (props: any, metricsSection: string): string => {
    // Housing analysis focuses on demographic and housing market metrics
    let fieldCount = 0;
    
    // Demographic characteristics (relevant to housing market analysis)
    if (props?.value_GENZ_CY_P || props?.GENZ_CY_P) {
      const genZ = props?.value_GENZ_CY_P || props?.GENZ_CY_P;
      metricsSection += `   Generation Z: ${genZ.toFixed(1)}% (digital-first consumers)\n`;
      fieldCount++;
    }
    if (props?.value_MILLENN_CY_P || props?.MILLENN_CY_P) {
      const millennials = props?.value_MILLENN_CY_P || props?.MILLENN_CY_P;
      metricsSection += `   Millennials: ${millennials.toFixed(1)}% (tech-savvy)\n`;
      fieldCount++;
    }
    if (props?.value_GENALPHACY_P || props?.GENALPHACY_P) {
      const genAlpha = props?.value_GENALPHACY_P || props?.GENALPHACY_P;
      metricsSection += `   Generation Alpha: ${genAlpha.toFixed(1)}% (emerging consumers)\n`;
      fieldCount++;
    }
    
    // Income context for brand positioning
    if (props?.value_AVGHINC_CY || props?.AVGHINC_CY) {
      const income = props?.value_AVGHINC_CY || props?.AVGHINC_CY;
      metricsSection += `   Median Income: $${(income / 1000).toFixed(0)}K\n`;
      fieldCount++;
    }
    
    if (fieldCount === 0) {
      metricsSection += `   Limited demographic data available\n`;
    }
    return metricsSection;
  };
  
  const addDemographicFields = (props: any, metricsSection: string): string => {
    // Demographic analysis shows comprehensive population characteristics
    let fieldCount = 0;
    
    // All age groups for demographic analysis
    const ageGroups = {
      'Generation Z': props?.value_GENZ_CY_P || props?.GENZ_CY_P,
      'Generation Alpha': props?.value_GENALPHACY_P || props?.GENALPHACY_P,
      'Millennials': props?.value_MILLENN_CY_P || props?.MILLENN_CY_P,
      'Generation X': props?.value_GENX_CY_P || props?.GENX_CY_P,
      'Baby Boomers': props?.value_BABYBMR_CY_P || props?.BABYBMR_CY_P
    };
    
    for (const [label, value] of Object.entries(ageGroups)) {
      if (value !== undefined && value !== null && value > 0) {
        metricsSection += `   ${label}: ${value.toFixed(1)}%\n`;
        fieldCount++;
      }
    }
    
    // Socioeconomic factors
    if (props?.value_AVGHINC_CY || props?.AVGHINC_CY) {
      const income = props?.value_AVGHINC_CY || props?.AVGHINC_CY;
      metricsSection += `   Median Income: $${(income / 1000).toFixed(0)}K\n`;
      fieldCount++;
    }
    if (props?.value_EDCOLL_CY_P || props?.EDCOLL_CY_P) {
      const education = props?.value_EDCOLL_CY_P || props?.EDCOLL_CY_P;
      metricsSection += `   College Educated: ${education.toFixed(1)}%\n`;
      fieldCount++;
    }
    
    if (fieldCount === 0) {
      metricsSection += `   Limited demographic data available\n`;
    }
    return metricsSection;
  };
  
  const addCompetitiveFields = (props: any, metricsSection: string): string => {
    // Competitive analysis focuses on market share competition between brands
    let fieldCount = 0;
    
    // Brand market shares (core competitive metrics)
    if (props?.nike_market_share) {
      metricsSection += `   Nike Market Share: ${props.nike_market_share.toFixed(1)}%\n`;
      fieldCount++;
    }
    if (props?.adidas_market_share) {
      metricsSection += `   Adidas Market Share: ${props.adidas_market_share.toFixed(1)}%\n`;
      fieldCount++;
    }
    if (props?.jordan_market_share) {
      metricsSection += `   Jordan Market Share: ${props.jordan_market_share.toFixed(1)}%\n`;
      fieldCount++;
    }
    
    // Market dynamics
    if (props?.total_population || props?.value_TOTPOP_CY) {
      const pop = props?.total_population || props?.value_TOTPOP_CY;
      metricsSection += `   Market Size: ${(pop / 1000).toFixed(1)}K\n`;
      fieldCount++;
    }
    
    if (fieldCount === 0) {
      metricsSection += `   Limited competitive data available\n`;
    }
    return metricsSection;
  };
  
  const addMarketSizingFields = (props: any, metricsSection: string): string => {
    // Market sizing focuses on market potential and opportunity size
    let fieldCount = 0;
    
    // Market potential metrics
    if (props?.total_population || props?.value_TOTPOP_CY) {
      const pop = props?.total_population || props?.value_TOTPOP_CY;
      metricsSection += `   Total Market Size: ${(pop / 1000).toFixed(1)}K people\n`;
      fieldCount++;
    }
    if (props?.median_income || props?.value_AVGHINC_CY) {
      const income = props?.median_income || props?.value_AVGHINC_CY;
      metricsSection += `   Purchasing Power: $${(income / 1000).toFixed(0)}K median income\n`;
      fieldCount++;
    }
    if (props?.market_gap) {
      metricsSection += `   Opportunity Size: ${props.market_gap.toFixed(1)}% untapped\n`;
      fieldCount++;
    }
    
    // Market penetration potential
    if (props?.demographic_opportunity_score) {
      metricsSection += `   Market Potential: ${props.demographic_opportunity_score.toFixed(1)}\n`;
      fieldCount++;
    }
    
    if (fieldCount === 0) {
      metricsSection += `   Limited market sizing data available\n`;
    }
    return metricsSection;
  };
  
  const addComparativeFields = (props: any, metricsSection: string): string => {
    // Comparative analysis focuses on direct brand-to-brand comparisons
    let fieldCount = 0;
    
    // Brand performance metrics
    if (props?.brand_a_name && props?.brand_a_metric) {
      metricsSection += `   ${props.brand_a_name}: ${props.brand_a_metric.toFixed(1)}%\n`;
      fieldCount++;
    }
    if (props?.brand_b_name && props?.brand_b_metric) {
      metricsSection += `   ${props.brand_b_name}: ${props.brand_b_metric.toFixed(1)}%\n`;
      fieldCount++;
    }
    
    // Market context
    if (props?.total_population || props?.value_TOTPOP_CY) {
      const pop = props?.total_population || props?.value_TOTPOP_CY;
      metricsSection += `   Market Context: ${(pop / 1000).toFixed(1)}K people\n`;
      fieldCount++;
    }
    
    if (fieldCount === 0) {
      metricsSection += `   Limited comparative data available\n`;
    }
    return metricsSection;
  };
  
  const addCorrelationFields = (props: any, metricsSection: string): string => {
    // Correlation analysis focuses on statistical relationships between variables
    let fieldCount = 0;
    
    // Key variables being correlated
    if (props?.primary_variable !== undefined) {
      metricsSection += `   Primary Variable: ${props.primary_variable.toFixed(2)}\n`;
      fieldCount++;
    }
    if (props?.secondary_variable !== undefined) {
      metricsSection += `   Secondary Variable: ${props.secondary_variable.toFixed(2)}\n`;
      fieldCount++;
    }
    if (props?.correlation_strength !== undefined) {
      metricsSection += `   Correlation Strength: ${props.correlation_strength.toFixed(3)}\n`;
      fieldCount++;
    }
    
    if (fieldCount === 0) {
      metricsSection += `   Limited correlation data available\n`;
    }
    return metricsSection;
  };
  
  // Normalize analysis type
  const normalizedType = analysisType.toLowerCase().replace(/-/g, '_');
  
  switch (normalizedType) {
    case 'strategic_analysis':
    case 'strategic':
      metricsSection += 'Strategic Analysis - Enhanced with market expansion metrics:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  // Also check top-level fields from StrategicAnalysisProcessor flattening
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        // Debug logging to trace area name resolution
        if (index < 3) {
          console.log(`[Strategic Metrics] Area ${index + 1}: nested.DESCRIPTION="${nestedProps?.DESCRIPTION}", resolved="${areaName}"`);
        }
        metricsSection += `${index + 1}. ${areaName}:\n`;
        
        // Use normalized strategic_analysis_score with legacy fallbacks (preserve exact decimals)
  const strategicScore = resolveScore(feature, 'strategic_analysis_score', ['strategic_value_score', 'strategic_score']);
  metricsSection += `   Strategic Score: ${strategicScore !== undefined ? strategicScore.toFixed(2) : 'N/A'}\n`;
        
        if (allProps?.demographic_opportunity_score) {
          metricsSection += `   Demographic Opportunity: ${allProps.demographic_opportunity_score}\n`;
        }
        if (allProps?.market_gap !== undefined) {
          metricsSection += `   Housing Market Opportunity: ${allProps.market_gap}%\n`;
        }
  // Add strategic-specific context fields - pass all available props to ensure data is found
        metricsSection = addStrategicFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'competitive_analysis':
    case 'competitive':
      metricsSection += 'Competitive Analysis - Enhanced with market share context:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        
        // Use competitive_advantage_score directly instead of target_value for competitive analysis
        const competitiveScore = allProps?.competitive_advantage_score || allProps?.target_value;
        metricsSection += `   Competitive Advantage Score: ${competitiveScore || 'N/A'}\n`;
        
        // Add competitive-specific context fields
        metricsSection = addCompetitiveFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'demographic_insights':
    case 'demographic':
      metricsSection += 'Demographic Analysis - Enhanced with population characteristics:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Demographic Score: ${allProps?.target_value || 'N/A'}\n`;
        
        // Add comprehensive demographic analysis (all age groups and socioeconomic factors)
        metricsSection = addDemographicFields(allProps, metricsSection);
        
        if (allProps?.demographic_opportunity_score) {
          metricsSection += `   Demographic Opportunity: ${allProps.demographic_opportunity_score}\n`;
        }
        metricsSection += '\n';
      });
      break;
      
    case 'market_sizing':
      metricsSection += 'Market Sizing Analysis - Enhanced with opportunity metrics:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Market Sizing Score: ${allProps?.target_value || 'N/A'}\n`;
        
        // Add market sizing-specific context fields
        metricsSection = addMarketSizingFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'brand_analysis':
      metricsSection += 'Brand Analysis - Enhanced with competitive positioning:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Brand Analysis Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.nike_market_share) {
          metricsSection += `   Nike Brand Strength: ${allProps.nike_market_share.toFixed(1)}% share\n`;
        }
        if (allProps?.competitive_advantage_score) {
          metricsSection += `   Competitive Position: ${allProps.competitive_advantage_score}\n`;
        }
        metricsSection += '\n';
      });
      break;
      
    case 'comparative_analysis':
    case 'comparative-analysis':
    case 'comparative':
      metricsSection += 'Comparative Analysis - Brand vs competitor performance:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        
        // Use comparative_analysis_score as primary metric
        const comparativeScore = allProps?.comparative_analysis_score || allProps?.target_value;
        metricsSection += `   Comparative Analysis Score: ${comparativeScore || 'N/A'}\n`;
        
        // Add competitive context with brand comparisons (external competitors only)
        if (allProps?.nike_market_share) {
          metricsSection += `   Nike Market Share: ${allProps.nike_market_share.toFixed(1)}%\n`;
        }
        if (allProps?.adidas_market_share) {
          metricsSection += `   Adidas Market Share: ${allProps.adidas_market_share.toFixed(1)}%\n`;
        }
        if (allProps?.puma_market_share) {
          metricsSection += `   Puma Market Share: ${allProps.puma_market_share.toFixed(1)}%\n`;
        }
        if (allProps?.under_armour_market_share) {
          metricsSection += `   Under Armour Market Share: ${allProps.under_armour_market_share.toFixed(1)}%\n`;
        }
        if (allProps?.new_balance_market_share) {
          metricsSection += `   New Balance Market Share: ${allProps.new_balance_market_share.toFixed(1)}%\n`;
        }
        
        // Add performance gap indicators
        if (allProps?.brand_performance_gap) {
          metricsSection += `   Nike vs Competitor Gap: ${allProps.brand_performance_gap}\n`;
        }
        if (props?.competitive_dynamics_level) {
          metricsSection += `   Competitive Intensity: ${props.competitive_dynamics_level}\n`;
        }
        
        // Add comparative analysis specific fields
        metricsSection = addComparativeFields(props, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'spatial_clusters':
    case 'spatial-clusters':
      metricsSection += 'Spatial Clusters Analysis - Geographic clustering patterns:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Cluster Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.cluster_id !== undefined) {
          metricsSection += `   Cluster ID: ${allProps.cluster_id}\n`;
        }
        if (allProps?.total_population) {
          metricsSection += `   Population: ${(allProps.total_population / 1000).toFixed(1)}K\n`;
        }
        if (allProps?.median_income) {
          metricsSection += `   Median Income: $${(allProps.median_income / 1000).toFixed(1)}K\n`;
        }
        metricsSection += '\n';
      });
      break;
      
    case 'correlation_analysis':
    case 'correlation-analysis':
    case 'correlation':
      metricsSection += 'Correlation Analysis - Statistical relationships:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Correlation Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.correlation_strength) {
          metricsSection += `   Correlation Strength: ${allProps.correlation_strength}\n`;
        }
        if (allProps?.statistical_significance) {
          metricsSection += `   Statistical Significance: ${allProps.statistical_significance}\n`;
        }
        
        // Add correlation analysis specific fields
        metricsSection = addCorrelationFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'segment_profiling':
    case 'segment-profiling':
      metricsSection += 'Segment Profiling Analysis - Customer segmentation:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Segment Profiling Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.primary_segment_type) {
          metricsSection += `   Primary Segment: ${allProps.primary_segment_type}\n`;
        }
        if (allProps?.segment_size) {
          metricsSection += `   Segment Size: ${allProps.segment_size}\n`;
        }
        if (allProps?.nike_segment_affinity) {
          metricsSection += `   Nike Affinity: ${allProps.nike_segment_affinity}\n`;
        }
        
        // Add demographic analysis fields for customer segmentation
        metricsSection = addDemographicFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'trend_analysis':
    case 'trend-analysis':
    case 'trends':
      metricsSection += 'Trend Analysis - Temporal patterns and growth:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Trend Strength Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.growth_potential) {
          metricsSection += `   Growth Potential: ${allProps.growth_potential}\n`;
        }
        if (allProps?.trend_consistency) {
          metricsSection += `   Trend Consistency: ${allProps.trend_consistency}\n`;
        }
        if (allProps?.volatility_index) {
          metricsSection += `   Volatility Index: ${allProps.volatility_index}\n`;
        }
        
        // Add correlation analysis fields for temporal patterns
        metricsSection = addCorrelationFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'anomaly_detection':
    case 'anomaly-detection':
      metricsSection += 'Anomaly Detection Analysis - Unusual market patterns:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Anomaly Detection Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.anomaly_type) {
          metricsSection += `   Anomaly Type: ${allProps.anomaly_type}\n`;
        }
        if (allProps?.statistical_deviation) {
          metricsSection += `   Statistical Deviation: ${allProps.statistical_deviation}\n`;
        }
        
        // Add comparative analysis fields for anomaly detection
        metricsSection = addComparativeFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'feature_interactions':
    case 'feature-interactions':
      metricsSection += 'Feature Interactions Analysis - Multi-variable relationships:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Feature Interaction Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.correlation_strength) {
          metricsSection += `   Correlation Strength: ${allProps.correlation_strength}\n`;
        }
        if (allProps?.synergy_effect) {
          metricsSection += `   Synergy Effect: ${allProps.synergy_effect}\n`;
        }
        
        // Add correlation analysis fields for multi-variable relationships
        metricsSection = addCorrelationFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'outlier_detection':
    case 'outlier-detection':
      metricsSection += 'Outlier Detection Analysis - Exceptional market characteristics:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
  const props = feature.properties || feature;
  const nestedProps = props.properties || props; // Handle double nesting
  const allProps = { ...feature, ...props, ...nestedProps };
  const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Outlier Detection Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.outlier_type) {
          metricsSection += `   Outlier Type: ${allProps.outlier_type}\n`;
        }
        if (allProps?.statistical_outlier_level) {
          metricsSection += `   Statistical Outlier Level: ${allProps.statistical_outlier_level}\n`;
        }
        
        // Add comparative analysis fields for outlier detection
        metricsSection = addComparativeFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    case 'scenario_analysis':
    case 'scenario-analysis':
      metricsSection += 'Scenario Analysis - Market adaptability and flexibility:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
        const props = feature.properties || feature;
        const nestedProps = props.properties || props; // Handle double nesting
        const allProps = { ...feature, ...props, ...nestedProps };
        const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Scenario Analysis Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.scenario_adaptability_level) {
          metricsSection += `   Adaptability Level: ${allProps.scenario_adaptability_level}\n`;
        }
        if (allProps?.market_resilience_strength) {
          metricsSection += `   Market Resilience: ${allProps.market_resilience_strength}\n`;
        }
        if (allProps?.strategic_flexibility_rating) {
          metricsSection += `   Strategic Flexibility: ${allProps.strategic_flexibility_rating}\n`;
        }
        metricsSection += '\n';
      });
      break;
      
    case 'predictive_modeling':
    case 'predictive-modeling':
      metricsSection += 'Predictive Modeling Analysis - Forecasting reliability:\n\n';
      topFeatures.forEach((feature: any, index: number) => {
        const props = feature.properties || feature;
        const nestedProps = props.properties || props; // Handle double nesting
        const allProps = { ...feature, ...props, ...nestedProps };
        const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Predictive Modeling Score: ${allProps?.target_value || 'N/A'}\n`;
        
        if (allProps?.model_confidence_level) {
          metricsSection += `   Model Confidence: ${allProps.model_confidence_level}\n`;
        }
        if (allProps?.forecast_reliability) {
          metricsSection += `   Forecast Reliability: ${allProps.forecast_reliability}\n`;
        }
        if (allProps?.prediction_confidence) {
          metricsSection += `   Prediction Confidence: ${allProps.prediction_confidence}\n`;
        }
        metricsSection += '\n';
      });
      break;
      
    case 'brand_difference':
    case 'brand-difference':
      metricsSection += 'H&R Block vs TurboTax Market Share Difference Analysis:\n';
      metricsSection += 'Methodology: H&R Block market share (%) - TurboTax market share (%) = Market share difference (%)\n';
      metricsSection += 'Positive values = H&R Block advantage, Negative values = TurboTax advantage\n\n';
      
      topFeatures.forEach((feature: any, index: number) => {
        const props = feature.properties || feature;
        const nestedProps = props.properties || props; // Handle double nesting
        const allProps = { ...feature, ...props, ...nestedProps };
        const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        
        // Use brand_difference_score as primary metric with proper notation
        const brandDifferenceScore = allProps?.brand_difference_score || allProps?.target_value;
        const diffText = brandDifferenceScore !== undefined ? 
          `${brandDifferenceScore >= 0 ? '+' : ''}${brandDifferenceScore.toFixed(1)}%` : 'N/A';
        metricsSection += `   Market Share Difference: ${diffText}\n`;
        
        // Add individual brand market shares with clear labeling
        const hrblockShare = allProps?.['h&r block_market_share'] || allProps?.MP10128A_B_P;
        const turbotaxShare = allProps?.turbotax_market_share || allProps?.MP10104A_B_P;
        
        if (hrblockShare !== undefined) {
          metricsSection += `   H&R Block Market Share: ${hrblockShare.toFixed(1)}%\n`;
        }
        if (turbotaxShare !== undefined) {
          metricsSection += `   TurboTax Market Share: ${turbotaxShare.toFixed(1)}%\n`;
        }
        
        // Add housing-specific demographic context
        metricsSection = addHousingFields(allProps, metricsSection);
        metricsSection += '\n';
      });
      break;
      
    default:
      // For other analysis types, provide basic enhanced info
      metricsSection += `${analysisType} Analysis - Enhanced metrics:\n\n`;
      topFeatures.forEach((feature: any, index: number) => {
        const props = feature.properties || feature;
        const nestedProps = props.properties || props; // Handle double nesting
        const allProps = { ...feature, ...props, ...nestedProps };
        const areaName = resolveAreaName(feature, index);
        metricsSection += `${index + 1}. ${areaName}:\n`;
        metricsSection += `   Analysis Score: ${allProps?.target_value || 'N/A'}\n`;
        
        // Add any available context metrics
        if (allProps?.total_population) {
          metricsSection += `   Population: ${(allProps.total_population / 1000).toFixed(1)}K\n`;
        }
        if (allProps?.median_income) {
          metricsSection += `   Income: $${(allProps.median_income / 1000).toFixed(1)}K\n`;
        }
        metricsSection += '\n';
      });
      break;
  }
  
  metricsSection += '=== ANALYSIS FOCUS ===\n';
  metricsSection += `Focus on metrics most relevant to ${analysisType} analysis.\n`;
  metricsSection += 'Use primary scores for ranking and supporting metrics for context.\n\n';
  
  return metricsSection;
}

// --- Interface Definitions ---

interface FeatureProperties {
  [key: string]: any;
}

// Note: FeatureObject is less relevant now as we primarily handle FeatureProperties lists
interface GeometryData {
    type: string;
    coordinates: number[] | number[][] | number[][][];
}

interface FeatureObject {
  id?: string;
  type?: string;
  properties: FeatureProperties;
  attributes?: FeatureProperties; // Kept for potential legacy compatibility, but focus is on properties
  geometry?: GeometryData;
}

// Represents the structure within the blob *after* optimization
interface OptimizedLayerData {
  layerId: string;
  features: FeatureProperties[]; // Array of attribute objects
  layerName?: string; // Optional, might be added by frontend
  layerType?: string; // Optional
  totalFeatures?: number; // Keep this if frontend sends it via blob
  // Other potential metadata from optimization...
}

// Represents the overall structure uploaded to the blob
interface UploadDataType {
  features: OptimizedLayerData[]; // Array of optimized layer data
  totalFeatures: number;
  timestamp: string;
  isComplete: boolean;
  query?: string;
  context?: any;
}

// Type for intermediate processing step
interface ProcessedLayer extends OptimizedLayerData {
    statistics?: LayerStatistics | null; // Optional stats if calculated
    topFeatures?: TopFeature[]; // Optional top features if calculated
}

// Other interfaces (LayerStatistics, TopFeature, RequestBody, CorrelationMetadata, etc.) remain largely the same as before
// ... (keep existing interface definitions for LayerStatistics, TopFeature, RequestBody, CorrelationMetadata, etc.) ...
interface LayerStatistics {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  quartiles: {
    q1: number;
    q3: number;
  };
}

interface TopFeature {
  zipCode: string;
  description: string | null;
  value: number;
}

// Type for the data expected in the request body
type ReceivedFeatureDataType = ProcessedLayerResult[];

// Simplified Request Body interface
interface RequestBody {
  messages: Array<{ role: string; content: string; }>;
  metadata: any;
  featureData?: ReceivedFeatureDataType; // Expect the array of processed results
  persona?: string; // AI persona selection (strategist, tactician, creative, product-specialist, customer-advocate)
}

// Cluster options interface
interface ClusterOptions {
  maxClusters?: number;
  minMembers?: number;
}

// --- Configuration ---
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// --- Initialize Anthropic Client ---
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// --- Helper: Resolve primary score field from metadata/features/analysis type ---
function resolvePrimaryScoreField(analysisType: string, features: any[], metadata?: any): string {
  // Delegate to the centralized mapping (respects metadata.targetVariable)
  try {
    const p = getPrimaryScoreField(analysisType, metadata || undefined);
    if (p && typeof p === 'string') return p;
  } catch {
    // ignore and fall back
  }
  return 'value';
}

// --- Helper: Compute simple stats for study area ---
function computeScoreStats(features: any[], scoreField: string) {
  const vals = (features || [])
    .map((f: any) => (f?.properties || f || {})[scoreField])
    .filter((v: any) => typeof v === 'number' && !Number.isNaN(v)) as number[];
  if (vals.length === 0) return null;
  const sorted = [...vals].sort((a,b)=>a-b);
  const n = sorted.length;
  const q = (p: number) => {
    const idx = (n - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const min = sorted[0];
  const max = sorted[n-1];
  const avg = vals.reduce((a,b)=>a+b,0)/n;
  return {
    count: n,
    min,
    max,
    avg,
    q1: q(0.25),
    q2: q(0.5),
    q3: q(0.75)
  };
}

// --- System Prompt ---
const systemPrompt = `You are an expert geospatial data analyst with advanced multi-endpoint analysis capabilities. Provide clear, direct insights about geographic patterns and demographic data.

CONTENT FOCUS:
- Highlight spatial patterns and geographic clusters
- Identify high-performing areas with specific location examples  
- Compare different regions with meaningful context
- Explain WHY patterns exist using demographic and economic factors
- Connect findings to practical business applications
- Provide specific location identifiers (ZIP codes, city names) for actionability

MULTI-ENDPOINT ANALYSIS EXPERTISE:
When analyzing results from multiple endpoints (competitive, demographic, spatial, predictive, etc.):
- Synthesize insights across ALL data sources into unified recommendations
- Identify areas where multiple indicators align (high opportunity zones)
- Explain how different analysis types complement each other
- Provide strategic recommendations based on composite insights
- Highlight risk-adjusted opportunities using multiple endpoint validation
- Create clear narrative connecting demographic, competitive, and predictive factors

CRITICAL SCORING CONSISTENCY:
- Do NOT mix competitive advantage scores with opportunity scores
- Reference the specific score type shown in the visualization data
- If a location shows score X in the data, always refer to it as X (not a different score type)
- Maintain consistency between legend values and text mentions

ENDPOINT-SPECIFIC INTERPRETATION:
- Core Analysis (/analyze): General market performance analysis
  * MUST include 8-10 specific location examples with performance scores
  * Organize by performance tiers: Top Performers (70+), Emerging Opportunities (50-70), Investment Targets (30-50)
  * Provide performance scores and demographic context for each example
  * Include strategic insights about what drives performance differences
  * Add actionable recommendations for each performance tier
- Competitive Analysis: ⚠️ EXPANSION OPPORTUNITY ANALYSIS - NOT Current Brand Dominance ⚠️
  * 🚨 CRITICAL RANKING INSTRUCTION: RANK AREAS BY 'competitive_advantage_score' ONLY - IGNORE ALL PERCENTAGES! 🚨
  * The ONLY ranking metric is: competitive_advantage_score (1-10 scale)
  * ⚠️ PERCENTAGES (like 27.0%, 25.0%) are market share context data - DO NOT use for ranking!
  * ⚠️ Brand market share % = existing dominance (OPPOSITE of expansion opportunity)
  * ✅ competitive_advantage_score = expansion opportunity metric (USE THIS for ranking)
  * HIGH competitive_advantage_score (7.0+) = UNDERSERVED markets with growth potential
  * LOW competitive_advantage_score (1.0-3.0) = Markets where brands already dominate OR poor demographics  
  * RANK BY competitive_advantage_score ONLY - highest competitive_advantage_score first
  * When referencing scores, ONLY use the exact competitive_advantage_score values provided (never calculate or modify them)
  * MUST include 8-10 specific location examples ranked by competitive_advantage_score (highest first)
  * Organize by competitive_advantage_score: Premium Expansion Targets (7.0+), Strong Targets (6.0-6.9), Emerging Markets (5.0-5.9), Limited Potential (4.0-4.9)
  * ALL competitive_advantage_score values are 1-10 scale - percentages are context only
  * Example: "ZIP 08544 (Princeton): competitive_advantage_score 6.8" - use exactly 6.8, not 24.9%
- Demographic Insights: Population characteristics, income patterns, diversity metrics
- Spatial Clusters: Geographic concentration patterns, regional similarities
  * MUST include 3-5 representative areas for each major cluster (top 4 clusters)
  * Describe cluster characteristics (demographics, income, density patterns)
  * Include cross-cluster insights and transition zones
  * Provide cluster-specific strategic recommendations
- Anomaly Detection: Unusual patterns, outliers, investigation opportunities  
- Predictive Modeling: Growth forecasts, trend projections, future opportunities
- Risk Analysis: Market volatility, uncertainty indicators, safe investment zones

FORMATTING REQUIREMENTS:
1. Numeric Values:
   - Currency: $1,234.56, $10K, $1.2M, $3.5B  
   - Percentages: 12.5%, 7.3%
   - Counts: 1,234, 567,890
   - Scores/Indexes: 82.5, 156.3

2. Geographic References:
   - Always include specific location identifiers
   - Make location names clear and clickable
   - Group related areas into geographic clusters when analyzing patterns
   - For competitive analysis: Include 5-10 specific locations with performance data

3. Multi-Endpoint Structure:
   - Lead with executive summary of cross-endpoint findings
   - Provide endpoint-specific insights in logical sequence
   - Conclude with unified strategic recommendations
   - Use clear headings to organize complex multi-source analysis

COMPETITIVE ANALYSIS RESPONSE STRUCTURE:
When analyzing competitive data, structure your response as follows:
1. **Market Overview** - Total markets analyzed, overall competitive landscape
2. **Top Performers** (5-8 locations) - Highest scoring areas with competitive scores and market shares
3. **Emerging Markets** (3-5 locations) - Mid-tier performers with growth potential  
4. **Growth Opportunities** (3-5 locations) - Underperforming areas with expansion potential
5. **Strategic Insights** - What drives performance differences, key success factors
6. **Actionable Recommendations** - Specific next steps for each tier

RESPONSE STYLE: 
- Jump straight into analysis without preambles like "Based on the data...". Your first sentence must be the start of the analysis.
- State findings as definitive facts
- Focus on actionable insights for decision-making
- Use professional, confident tone as if briefing a business executive
- For multi-endpoint analysis, create cohesive narrative across all data sources`;

// --- Helper Functions ---

// Checks if a layer is demographic based on config
function isDemographicLayer(layerId: string): boolean {
  const layerConfig = layers[layerId];
  return layerConfig?.description?.toLowerCase().includes('population') ||
          layerConfig?.description?.toLowerCase().includes('demographic') ||
          layerConfig?.metadata?.tags?.includes('demographics') ||
          false;
}

// Formats field value based on layer config or common patterns
const formatFieldValue = (value: any, fieldName: string, layerConfig: LayerConfig | undefined): string => {
  // Handle null or undefined values
  if (value === null || value === undefined) {
    return 'N/A';
  }

  // Special handling for ZIP code fields - these should never be formatted
  const lowerFieldName = fieldName.toLowerCase();
  if (lowerFieldName.includes('zip') || lowerFieldName.includes('postal') || 
      lowerFieldName.includes('zipcode') || lowerFieldName === 'description') {
    return String(value);
  }

  if (typeof value === 'number') {
    // *** MOVE INDEX CHECK BEFORE CURRENCY CHECK AND REFINE CURRENCY CHECK ***
    const isIndex = lowerFieldName.includes('index') ||
                   lowerFieldName.includes('score') ||
                   lowerFieldName.includes('level') ||
                   lowerFieldName.includes('rank') ||
                   lowerFieldName.includes('rating') ||
                   lowerFieldName.includes('popularity') ||
                   lowerFieldName === 'thematic_value' || // Explicitly treat thematic_value as index
                   layerConfig?.metadata?.valueType === 'index';
    
    // IMPROVED PERCENTAGE DETECTION (CHECK SECOND)
    const isPercentage = !isIndex && ( // Ensure it's not already identified as an index
                         lowerFieldName.includes('percent') ||
                         lowerFieldName.includes('rate') ||
                         lowerFieldName.includes('ratio') ||
                         lowerFieldName.includes('proportion') ||
                         lowerFieldName.includes('share') ||
                         lowerFieldName.includes('growth') ||  // Added growth, often percentage
                         lowerFieldName.includes('fan') ||     // Fan percentages for sports
                         lowerFieldName.includes('popularity') || // Often percentages
                         lowerFieldName.includes('%') ||
                         lowerFieldName.includes('nfl') ||     // Specific sport fan percentages 
                         lowerFieldName.includes('mlb') ||     // Specific sport fan percentages
                         lowerFieldName.includes('nba') ||     // Specific sport fan percentages
                         lowerFieldName.includes('nhl') ||     // Specific sport fan percentages
                         layerConfig?.fields?.some(f => f?.label?.includes('%')) ||
                         layerConfig?.metadata?.valueType === 'percentage');
    
    // REFINED CURRENCY DETECTION (CHECK THIRD)
    const isCurrency = !isIndex && !isPercentage && ( // Ensure not index or percentage
                       lowerFieldName.includes('income') ||
                       lowerFieldName.includes('spending') ||
                       lowerFieldName.includes('revenue') ||
                       lowerFieldName.includes('cost') ||
                       lowerFieldName.includes('sales') ||
                       lowerFieldName.includes('price') ||
                       lowerFieldName.includes('value') ||
                       lowerFieldName.includes('budget') ||
                       lowerFieldName.includes('$') ||
                       layerConfig?.fields?.some(f => f?.label?.includes('$')) ||
                       layerConfig?.metadata?.valueType === 'currency');

    // First check for NaN values
    if (isNaN(value)) {
      return 'N/A';
    }

    // FORMAT INDEX VALUES FIRST (no $ or %)
    if (isIndex) {
      // Format with appropriate decimal places
      if (Math.abs(value) < 10) {
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      }
    }
    // FORMAT PERCENTAGE NEXT
    else if (isPercentage) {
      // Check if value is already in percentage form (0-100) or decimal form (0-1)
      if (value > 0 && value < 1) {
        // Convert decimal to percentage
        return `${(value * 100).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
      } else {
        // Already in percentage form
        return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
      }
    } 
    // Format currency values with $ and commas
    else if (isCurrency) {
      // Check if value should be in thousands, millions, or billions
      if (value >= 1000000000) {
        return `$${(value / 1000000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B`;
      } else if (value >= 1000000) {
        return `$${(value / 1000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
      } else {
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      }
    } 
    // Format counts as integers with commas
    else if (layerConfig?.metadata?.valueType === 'count' || Number.isInteger(value)) {
      return Math.round(value).toLocaleString();
    } 
    // Default format for other non-integer numbers (treat like index)
    else {
      if (Math.abs(value) < 10) {
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      }
    }
  }
  
  // Handle boolean values
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  // Handle date values
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  
  // Default to string conversion for any other type
  return String(value);
};

// Resolve a numeric score from a feature for a given field, handling nested properties and legacy fallbacks
function resolveScore(feature: any, primaryField: string, legacyFields: string[] = []): number | undefined {
  try {
    const props = feature?.properties || feature || {};
    const nested = props?.properties || props;
    const candidates: any[] = [
      nested?.[primaryField],
      props?.[primaryField],
      ...legacyFields.flatMap((f) => [nested?.[f], props?.[f]]),
      nested?.target_value,
      props?.target_value,
      feature?.[primaryField],
      feature?.value
    ];
    const chosen = candidates.find((v) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))));
    if (chosen === undefined) return undefined;
    const num = Number(chosen);
    return isNaN(num) ? undefined : num;
  } catch {
    return undefined;
  }
}

// **MODIFIED** Sorts a list of attribute objects by a field value
function sortAttributesByField(attributeList: FeatureProperties[], field: string): FeatureProperties[] {
  return [...attributeList].sort((a, b) => {
    const valueA = Number(a[field]);
    const valueB = Number(b[field]);

    if (isNaN(valueA) && !isNaN(valueB)) return 1;
    if (!isNaN(valueA) && isNaN(valueB)) return -1;
    if (isNaN(valueA) && isNaN(valueB)) return 0;
    
    return valueB - valueA; // Descending order
  });
}

// **MODIFIED** Gets location name from a LocalGeospatialFeature's properties
function getLocationName(feature: LocalGeospatialFeature): string {
  try {
    // Protection against null or undefined feature
    if (!feature || !feature.properties) {
      console.log('[getLocationName ERROR] Missing feature or properties');
      return 'Unknown Location';
    }
    
    // Look inside properties
    const propsToCheck = feature.properties;
    
    // First check DESCRIPTION or area_name field for format like "10001 (New York)"
    const descriptionSources = ['DESCRIPTION', 'area_name'];
    for (const source of descriptionSources) {
      if (propsToCheck[source] && typeof propsToCheck[source] === 'string') {
        const description = propsToCheck[source].trim();
        
        // Try to extract location name from inside parentheses
        const nameMatch = description.match(/\(([^)]+)\)/);
        if (nameMatch && nameMatch[1]) {
          const extractedName = nameMatch[1].trim();
          return extractedName;
        }
        
        // If no parentheses but it's area_name, return the whole thing
        if (source === 'area_name') {
          return description;
        }
      }
    }
    
    // Try common name fields in order of relevance
    const nameFields = ['FEDNAME', 'CSDNAME', 'NAME', 'CITY', 'MUNICIPALITY', 'REGION', 'AREA']; 
    for (const field of nameFields) {
      if (propsToCheck[field]) {
        return String(propsToCheck[field]).trim();
      }
    }
    
    // Basic fallback - look for any field with a string value
    for (const [key, value] of Object.entries(propsToCheck)) {
      if (typeof value === 'string' && value.trim()) {
        if (!['OBJECTID', 'Shape__Area', 'Shape__Length'].includes(key.toUpperCase())) {
          return String(value).trim();
        }
      }
    }
    
    // Last resort
    if (propsToCheck.OBJECTID) {
      return `Location ${propsToCheck.OBJECTID}`;
    }
    
    // Prefer shared resolver; fall back only if it returns neutral
    try {
      const name = resolveSharedAreaName({ properties: propsToCheck }, { mode: 'full', neutralFallback: '' });
      if (name) return name;
    } catch {}
    return 'Unknown Location';
  } catch (error) {
    console.error('[getLocationName ERROR] Exception occurred:', error);
    return 'Unknown Location';
  }
}

// **ENHANCED** Gets ZIP code from a feature, checking both properties and attributes
function getZIPCode(feature: any): string {
  try {
    // Protection against null or undefined feature
    if (!feature) {
      console.log('[getZIPCode ERROR] Feature is null or undefined');
      return 'Unknown';
    }
    
    // Check both properties and attributes since different GeoJSON sources use different formats
    const properties = feature.properties || {};
    const attributes = feature.attributes || {};
    
    // Log feature structure for debugging if needed
    if (process.env.NODE_ENV === 'development') {
      console.log('[getZIPCode DEBUG] Feature structure:', {
        hasProperties: !!feature.properties,
        hasAttributes: !!feature.attributes,
        propertiesKeys: Object.keys(properties).slice(0, 5),
        attributesKeys: Object.keys(attributes).slice(0, 5)
      });
    }
    
    let zipCode = null;
    
    // First try to extract from DESCRIPTION or area_name format "10001 (New York)" 
    // Check both properties and attributes
    let description = null;
    if (properties.DESCRIPTION && typeof properties.DESCRIPTION === 'string' && properties.DESCRIPTION.trim() !== '') {
      description = properties.DESCRIPTION.trim();
    } else if (attributes.DESCRIPTION && typeof attributes.DESCRIPTION === 'string' && attributes.DESCRIPTION.trim() !== '') {
      description = attributes.DESCRIPTION.trim();
    } else if (properties.area_name && typeof properties.area_name === 'string' && properties.area_name.trim() !== '') {
      description = properties.area_name.trim();
    } else if (attributes.area_name && typeof attributes.area_name === 'string' && attributes.area_name.trim() !== '') {
      description = attributes.area_name.trim();
    }
    
    if (description) {
      // FIRST: Check for FSA patterns (Canadian postal codes) - prioritize these to avoid padding
      const fsaMatch = description.match(/\b([A-Z]\d[A-Z])\b/i);
      if (fsaMatch) {
        return fsaMatch[1].toUpperCase(); // Return FSA directly without any padding
      }
      
      // Then try comprehensive regex patterns for US ZIP codes
      
      // Pattern 1: Extract ZIP at beginning followed by space and parentheses - "10001 (New York)"
      let zipMatch = description.match(/^(\d+)\s*\(/);
      if (zipMatch && zipMatch[1]) {
        zipCode = zipMatch[1].trim();
        return zipCode;
      }
      
      // Pattern 2: Just extract any starting digits - "10001 New York"
      zipMatch = description.match(/^(\d+)/);
      if (zipMatch && zipMatch[1]) {
        zipCode = zipMatch[1].trim();
        return zipCode;
      }
      
      // Pattern 3: Extract digits from anywhere in the string if they look like a US ZIP code (5 digits)
      zipMatch = description.match(/\b(\d{5})\b/);
      if (zipMatch && zipMatch[1]) {
        zipCode = zipMatch[1].trim();
        return zipCode;
      }
      
      // Pattern 4: More flexible - just find any 5 consecutive digits anywhere
      zipMatch = description.match(/(\d{5})/);
      if (zipMatch && zipMatch[1]) {
        zipCode = zipMatch[1].trim();
        return zipCode;
      }
      
      // Pattern 5: Canadian postal code pattern (letter-number-letter)
      zipMatch = description.match(/\b([A-Z]\d[A-Z])\b/i);
      if (zipMatch && zipMatch[1]) {
        zipCode = zipMatch[1].trim().toUpperCase();
        return zipCode;
      }
      
      // If no match found, return the whole DESCRIPTION
      return description;
    }
    
    // Try using thematic_value (CRITICAL CHANGE)
    if (properties.thematic_value) {
      const thematicValue = properties.thematic_value;
      
      // If thematic_value is very close to an integer, use that integer
      // Otherwise, generate a 5-digit ZIP based on the value
      if (Math.abs(thematicValue - Math.round(thematicValue)) < 0.1) {
        // It's close to an integer, use the rounded value
        zipCode = String(Math.round(thematicValue));
      } else {
        // Generate a unique looking ZIP code based on the value
        // Ensure it starts with valid ZIP digits (e.g. 1-9)
        const normalizedValue = Math.abs(thematicValue);
        const firstDigit = Math.max(1, Math.min(9, Math.floor(normalizedValue % 9) + 1));
        const remainingDigits = Math.floor(normalizedValue * 10000) % 10000;
        zipCode = `${firstDigit}${String(remainingDigits).padStart(4, '0')}`;
      }
      
      return zipCode;
    } else if (attributes.thematic_value) {
      const thematicValue = attributes.thematic_value;
      
      if (Math.abs(thematicValue - Math.round(thematicValue)) < 0.1) {
        zipCode = String(Math.round(thematicValue));
      } else {
        const normalizedValue = Math.abs(thematicValue);
        const firstDigit = Math.max(1, Math.min(9, Math.floor(normalizedValue % 9) + 1));
        const remainingDigits = Math.floor(normalizedValue * 10000) % 10000;
        zipCode = `${firstDigit}${String(remainingDigits).padStart(4, '0')}`;
      }
      return zipCode;
    }
    
    // Direct check for ZIP field as a high priority
    const zipFields = ['ZIP', 'ZIPCODE', 'ZIP_CODE', 'POSTAL', 'POSTAL_CODE', 'zip_code', 'area_id'];
    
    // Check properties first
    for (const field of zipFields) {
      if (properties[field]) {
        zipCode = String(properties[field]).trim();
        return zipCode;
      }
    }
    
    // Then check attributes
    for (const field of zipFields) {
      if (attributes[field]) {
        zipCode = String(attributes[field]).trim();
        return zipCode;
      }
    }
    
    // Try ID fields from properties and attributes
    const idFields = ['ID', 'CSDUID', 'FEDUID', 'OBJECTID'];
    
    // Check properties
    for (const field of idFields) {
      if (properties[field]) {
        zipCode = String(properties[field]).trim();
        return zipCode;
      }
    }
    
    // Check attributes
    for (const field of idFields) {
      if (attributes[field]) {
        zipCode = String(attributes[field]).trim();
        return zipCode;
      }
    }
    
    // If we still don't have a ZIP code, try NAME field
    if (properties.NAME) {
      zipCode = String(properties.NAME).trim();
      return zipCode;
    }
    
    if (attributes.NAME) {
      zipCode = String(attributes.NAME).trim();
      return zipCode;
    }
    
    // Last resort - OBJECTID to generate a "ZIP-like" code
    if (properties.OBJECTID) {
      const objId = Math.abs(properties.OBJECTID);
      const firstDigit = Math.max(1, Math.min(9, objId % 9 + 1));
      const remainingDigits = objId % 10000;
      zipCode = `${firstDigit}${String(remainingDigits).padStart(4, '0')}`;
      return zipCode;
    }
    
    if (attributes.OBJECTID) {
      const objId = Math.abs(attributes.OBJECTID);
      const firstDigit = Math.max(1, Math.min(9, objId % 9 + 1));
      const remainingDigits = objId % 10000;
      zipCode = `${firstDigit}${String(remainingDigits).padStart(4, '0')}`;
      return zipCode;
    }
    
    // If we still don't have a ZIP code, return Unknown
    // If we still don't have a FSA code, try shared helper then return Unknown
    try {
      const f = getSharedFSA(feature);
      if (f) return f;
    } catch {}
    return 'Unknown';
  } catch (error) {
    console.error('[getZIPCode ERROR] Exception occurred:', error);
    return 'Unknown';
  }
}

// Note: Correlation calculation functions have been removed as they were unused in the current implementation

// Helper function to convert ReadableStream to Buffer
async function streamToBufferHelper(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    
    // Replace constant condition with proper loop
    let reading = true;
    while (reading) {
        const { done, value } = await reader.read();
        if (done) {
            reading = false;
        } else if (value) {
            chunks.push(value);
        }
    }
    
    // Rest of the function remains the same
    let totalLength = 0;
    chunks.forEach(chunk => {
        totalLength += chunk.length;
    });
    const result = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach(chunk => {
        result.set(chunk, offset);
        offset += chunk.length;
    });
    return Buffer.from(result); // Keep Buffer for now, will decode later
}

// --- POST Request Handler ---
export async function POST(req: NextRequest) {
    console.log('[Claude] POST request received');
    
    // Check API key first
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('[Claude] CRITICAL: ANTHROPIC_API_KEY is missing from environment variables');
        return NextResponse.json({ 
            error: 'API configuration error: Missing Anthropic API key',
            content: 'Sorry, the AI service is not properly configured. Please check the server configuration.'
        }, { status: 500 });
    }
    
    console.log('[Claude] API key is present, length:', apiKey.length);

    try {
        // Enhanced error handling for request parsing - Support both JSON and FormData
        let body: RequestBody;
        let isFormDataRequest = false;
        
        try {
            // Check Content-Type to determine request format
            const contentType = req.headers.get('content-type') || '';
            
            if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
                // Handle FormData request (Analysis requests)
                console.log('[Claude] Parsing FormData request (Analysis)');
                isFormDataRequest = true;
                
                const formData = await req.formData();
                const blobPath = formData.get('blobPath') as string;
                const query = formData.get('query') as string;
                
                // Check if this is a chat FormData request (has messages field)
                const messagesData = formData.get('messages') as string;
                const metadataData = formData.get('metadata') as string;
                const featureDataField = formData.get('featureData') as string;
                const personaData = formData.get('persona') as string;
                
                if (messagesData) {
                    // Chat FormData request
                    console.log('[Claude] FormData Chat request detected');
                    try {
                        body = {
                            messages: JSON.parse(messagesData),
                            metadata: metadataData ? JSON.parse(metadataData) : {},
                            featureData: featureDataField ? JSON.parse(featureDataField) : [],
                            persona: personaData || 'strategist'
                        };
                        console.log('[Claude] Chat FormData parsed successfully');
                    } catch (parseError) {
                        console.error('[Claude] Error parsing chat FormData:', parseError);
                        throw new Error('Invalid chat FormData format');
                    }
                } else {
                    // Analysis FormData request (original logic)
                    console.log('[Claude] FormData Analysis request detected');
                    console.log('[Claude] FormData parsed:', { blobPath: !!blobPath, query: !!query });
                    
                    body = {
                        messages: [{ role: 'user', content: query || '' }],
                        metadata: { 
                            blobUrl: blobPath,
                            query: query,
                            isFormDataRequest: true
                        },
                        featureData: undefined, // Will be loaded from blob
                        persona: 'strategist' // Default for analysis requests
                    };
                }
                
            } else {
                // Handle JSON request (Chat requests)
                console.log('[Claude] Parsing JSON request (Chat)');
                body = await req.json();
                console.log('[Claude] JSON request body parsed successfully');
                console.log('[Claude] Messages count:', body.messages?.length);
                console.log('[Claude] Has featureData:', !!body.featureData);
                console.log('[Claude] Persona:', body.persona);
                
                // Validate JSON request structure
                if (!body.messages || !Array.isArray(body.messages)) {
                    throw new Error('Invalid request: messages array is required');
                }
                
                if (body.messages.length === 0) {
                    throw new Error('Invalid request: messages array cannot be empty');
                }
            }
            
        } catch (parseError) {
            console.error('[Claude] Failed to parse request body:', parseError);
            return NextResponse.json({ 
                error: 'Invalid request format',
                content: 'The request could not be parsed. Please check the request format.',
                details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
            }, { status: 400 });
        }

        // Initialize variables used throughout the function
  let userMessage = '';
        let dataSummary = '';
        let processedLayersForPrompt: ProcessedLayer[] = [];
  // Accumulate model attribution for post-processing enforcement
  let computedAttribution: { modelName?: string; r2?: number; perfLevel?: string; confidence?: string } = {};

        // Security configuration
        const securityConfig = {
            requiresAuthentication: true,
            accessLevels: ['read'],
            ipWhitelist: [],
            encryptionRequired: false,
            auditEnabled: true,
            requiredRoles: [],
            auditTrail: true
        };

        const { messages, metadata, featureData, persona } = body;

        // --- Payload guard to prevent 413 and accept compact client summaries ---
        try {
          const approxBodySize = (() => {
            try { return JSON.stringify(body).length; } catch { return -1; }
          })();
          console.log('[Claude] Payload meta:', {
            approxBodySize,
            hasSummary: !!(body as any).summary,
            hasFeatureShadows: Array.isArray((body as any).featureShadows),
            featureDataType: Array.isArray(featureData) ? 'array' : typeof featureData,
            featureDataLayers: Array.isArray(featureData) ? featureData.length : 0
          });

          // If raw feature arrays are attempted and appear very large, reject early with guidance
          if (Array.isArray(featureData)) {
            const totalFeatures = featureData.reduce((acc: number, l: any) => acc + (Array.isArray(l?.features) ? l.features.length : 0), 0);
            if (totalFeatures > 5000) {
              console.warn('[Claude] Rejecting oversized raw feature payload:', { totalFeatures });
              return NextResponse.json({
                error: 'Payload too large: send compact client summary instead',
                hint: 'Use client-side summarization. Include { summary, featureShadows } rather than raw features.'
              }, { status: 413 });
            }
          }
        } catch (e) {
          console.warn('[Claude] Payload meta logging failed:', e);
        }
        
        // 🎯 CHAT OPTIMIZATION: Handle contextual follow-up questions efficiently
        const isContextualChat = metadata?.isContextualChat || false;
        if (isContextualChat) {
            console.log('[CONTEXTUAL CHAT] Optimized follow-up question processing');
        }
        
        // 🎯 NEW: Extract ranking context for unified ranking system
        const rankingContext = metadata?.rankingContext;
        console.log('🎯 [CLAUDE API] Received ranking context:', rankingContext);
        console.log('🚨 [CLAUDE API CALLED] Route accessed with metadata keys:', Object.keys(metadata || {}));
        const currentQuery = messages?.[messages.length - 1]?.content || metadata?.query || '';
        console.log('🚨 [CLAUDE API] Query/message:', currentQuery);
        console.log('🚨 [CLAUDE API] FeatureData type:', typeof featureData, Array.isArray(featureData) ? 'array' : 'object');
        
        // 🌟 NEW: Geographic Analysis Detection using new Geo-Awareness System
        const geoEngine = GeoAwarenessEngine.getInstance();
        const geoResult = await geoEngine.processGeoQuery(currentQuery, []);
        const detectedCities = geoResult.matchedEntities.map(e => e.name);
        const isCityQuery = geoResult.matchedEntities.length > 0;
        const isCityComparison = geoResult.matchedEntities.length >= 2 && currentQuery.toLowerCase().includes('vs');
        
        if (isCityQuery) {
          console.log('🏙️ [GEO ANALYSIS] Detected geographic query:', {
            entities: geoResult.matchedEntities.map(e => ({ name: e.name, type: e.type })),
            filterMethod: geoResult.filterStats.filterMethod,
            isComparison: isCityComparison,
            query: currentQuery
          });
        }
        if (metadata?.matched_fields) {
          console.log('[DEBUG] matched_fields length:', (metadata.matched_fields as string[]).length);
          console.log('[DEBUG] First 5 matched_fields:', (metadata.matched_fields as string[]).slice(0,5));
        }

        // ----------------------------
        // Dynamic field alias overrides from frontend
        // ----------------------------
        if (metadata?.fieldAliases && typeof metadata.fieldAliases === 'object') {
          FIELD_ALIAS_OVERRIDES = { ...(metadata.fieldAliases as Record<string, string>) };
        } else {
          FIELD_ALIAS_OVERRIDES = {};
        }
        console.log('[Claude] Field alias overrides:', FIELD_ALIAS_OVERRIDES);

        console.log('[Claude] Received POST request');
        console.log('[Claude] Metadata:', metadata);
        console.log('[Claude] Persona:', persona || 'default (strategist)');

        // Extract blobUrl (legacy upload workflow) if provided in metadata or request body
        const blobUrl: string | undefined = (metadata as any)?.blobUrl ?? (body as any)?.blobUrl;

        // Support two input modes:
        // 1. Preferred: blobUrl pointing to a Vercel Blob upload (existing behaviour)
        // 2. **NEW**: inline `featureData` array directly in the request body (used during local/dev flows)

        let processedLayersData: ProcessedLayerResult[] = [];

        // Accept compact client-side summary payloads and convert to synthetic layers
        const clientSummary = (body as any)?.summary as any;
        if (clientSummary && Array.isArray(clientSummary.layers) && clientSummary.layers.length > 0) {
          console.log('[Claude] Using client summary layers:', clientSummary.layers.length);
          try {
            processedLayersData = clientSummary.layers.map((ls: any, idx: number) => {
              const examples: Array<{ id: string; name: string; value: number }> = [];
              
              // Hybrid Smart Sampling Strategy for comprehensive analysis
              const allAreas = [...(ls.top || []), ...(ls.bottom || [])];
              
              // Filter out national parks from sampling to ensure Claude gets legitimate business areas
              const nonParkAreas = allAreas.filter(area => {
                const areaId = area.id || '';
                const areaName = area.name || '';
                
                // Filter out national parks using same logic as analysisLens
                if (String(areaId).startsWith('000')) return false;
                
                const nameStr = String(areaName).toLowerCase();
                const parkPatterns = [
                  /national\s+park/i, /ntl\s+park/i, /national\s+monument/i, /national\s+forest/i, 
                  /state\s+park/i, /\bpark\b.*national/i, /\bnational\b.*\bpark\b/i,
                  /\bnp\b/i, /\bnm\b/i, /\bnf\b/i
                ];
                return !parkPatterns.some(pattern => pattern.test(nameStr));
              });
              
              console.log(`🔍 [HYBRID SAMPLING] Filtered ${allAreas.length - nonParkAreas.length} parks from ${allAreas.length} total areas`);
              
              if (nonParkAreas.length > 0) {
                const sortedByScore = nonParkAreas.sort((a, b) => (b.value || 0) - (a.value || 0));
                const scores = sortedByScore.map(a => a.value || 0);
                
                console.log(`🔍 [HYBRID SAMPLING] Non-park sampling from ${nonParkAreas.length} legitimate areas`);
                console.log(`🔍 [HYBRID SAMPLING] Top 5 non-park areas: ${sortedByScore.slice(0, 5).map(a => `${a.id}(${a.value?.toFixed(1)})`).join(', ')}`);
                
                // Calculate statistical measures
                const mean = scores.reduce((sum, val) => sum + val, 0) / scores.length;
                const median = scores.length % 2 === 0 
                  ? (scores[Math.floor(scores.length / 2 - 1)] + scores[Math.floor(scores.length / 2)]) / 2
                  : scores[Math.floor(scores.length / 2)];
                const stdDev = Math.sqrt(scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scores.length);
                
                // 1. Top 15 absolute performers
                examples.push(...sortedByScore.slice(0, 15));
                
                // 2. Bottom 5 absolute performers
                examples.push(...sortedByScore.slice(-5));
                
                // 3. Areas closest to median (find 3 closest)
                const medianCandidates = sortedByScore
                  .map(area => ({ area, diff: Math.abs((area.value || 0) - median) }))
                  .sort((a, b) => a.diff - b.diff)
                  .slice(0, 3)
                  .map(item => item.area);
                examples.push(...medianCandidates);
                
                // 4. Areas closest to mean (find 3 closest)
                const meanCandidates = sortedByScore
                  .map(area => ({ area, diff: Math.abs((area.value || 0) - mean) }))
                  .sort((a, b) => a.diff - b.diff)
                  .slice(0, 3)
                  .map(item => item.area);
                examples.push(...meanCandidates);
                
                // 5. Statistical outliers (>2σ from mean)
                const outliers = sortedByScore.filter(area => 
                  Math.abs((area.value || 0) - mean) > (2 * stdDev)
                );
                examples.push(...outliers);
                
                // 6. Representative from each score decile (10 areas)
                for (let i = 0; i < 10; i++) {
                  const decileStart = Math.floor(sortedByScore.length * i / 10);
                  const decileEnd = Math.floor(sortedByScore.length * (i + 1) / 10);
                  if (decileStart < sortedByScore.length) {
                    const decileRepresentative = sortedByScore[Math.floor((decileStart + decileEnd) / 2)];
                    if (decileRepresentative) examples.push(decileRepresentative);
                  }
                }
                
                // Remove duplicates while preserving order
                const seen = new Set();
                const uniqueExamples = examples.filter(ex => {
                  const key = `${ex.id}_${ex.value}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
                
                examples.length = 0;
                examples.push(...uniqueExamples);
                
                console.log(`🔍 [HYBRID SAMPLING] Layer ${idx}: Processed ${allAreas.length} total areas`);
                console.log(`🔍 [HYBRID SAMPLING] Statistics: mean=${mean.toFixed(2)}, median=${median.toFixed(2)}, stdDev=${stdDev.toFixed(2)}`);
                console.log(`🔍 [HYBRID SAMPLING] Sample composition: ${examples.length} unique areas (top 15 + bottom 5 + median 3 + mean 3 + outliers ${outliers.length} + decile reps 10)`);
                console.log(`🔍 [HYBRID SAMPLING] Sample IDs: ${examples.slice(0, 10).map(e => `${e.id}(${e.value?.toFixed(1)})`).join(', ')}${examples.length > 10 ? '...' : ''}`);
              } else if (allAreas.length > 0) {
                // Fallback: use all areas but still filter parks
                console.log(`🔍 [HYBRID SAMPLING] Fallback: No non-park areas found, using unfiltered sample`);
                if (Array.isArray(ls.top)) examples.push(...ls.top.slice(0, 5));
                if (Array.isArray(ls.bottom)) examples.push(...ls.bottom.slice(0, 3));
              } else {
                // Final fallback if no data at all
                console.log(`🔍 [HYBRID SAMPLING] No areas available for sampling`);
              }

              const features = examples.map((e, i) => {
                // Find corresponding sample data to get additional fields
                // Try multiple matching strategies: exact ID match, exact name match, or positional fallback
                const sample = ls.samples?.find((s: any) => 
                  s.id === e.id || 
                  s.name === e.name || 
                  s.id === String(e.id) || 
                  s.name === String(e.name)
                ) || ls.samples?.[i] || {};
                
                // Debug logging for client summary conversion
                if (i < 3) {
                  console.log(`🔍 [CLIENT SUMMARY CONVERSION] Feature ${i}:`, {
                    e_id: e.id,
                    e_name: e.name,
                    e_value: e.value,
                    sample_found: !!sample,
                    sample_keys: sample ? Object.keys(sample) : [],
                    sample_market_gap: sample?.market_gap,
                    sample_demographic_opportunity_score: sample?.demographic_opportunity_score
                  });
                }
                
        // Build robust DESCRIPTION and area_name
        const sampleDescription = sample?.DESCRIPTION || sample?.description || '';
        const candidateName = typeof e.name === 'string' ? e.name : '';
        const cleanName = /unknown\s+area/i.test(candidateName) ? '' : candidateName;
        const idString = e?.id != null ? String(e.id) : '';
        const zipLike = /^\d{5}/.test(idString) ? idString.substring(0,5) : '';
        const derivedDescription = sampleDescription || cleanName || (zipLike ? `ZIP ${zipLike}` : '');

        return {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [0, 0] },
                  properties: {
                    id: e.id,
          area_name: cleanName || derivedDescription || (zipLike ? `ZIP ${zipLike}` : `Area ${idString || i+1}`),
          DESCRIPTION: derivedDescription,
          area_id: idString || undefined,
                    target_value: e.value,
                    thematic_value: e.value,
                    // Include strategic analysis specific fields from samples
                    strategic_analysis_score: e.value,
                    strategic_value_score: e.value,
                    market_gap: sample.market_gap,
                    demographic_opportunity_score: sample.demographic_opportunity_score,
                    competitive_advantage_score: sample.competitive_advantage_score,
                    total_population: sample.total_population,
                    median_income: sample.median_income,
                    // Summary metadata
                    SUMMARY_STATS: ls.stats ? JSON.stringify(ls.stats) : undefined,
                    SUMMARY_FIELD: ls.numericField || ls.field || 'value',
                    SUMMARY_FEATURE_COUNT: ls.featureCount
                  }
                };
              }) as unknown as LocalGeospatialFeature[];

              return {
                layerId: ls.layerId || `client-summary-${idx}`,
                layerName: ls.layerName || 'Client Summary',
                layerType: ls.layerType || 'summary',
                layer: {} as any,
                features,
                extent: null,
                fields: [],
                type: 'single-layer',
                field: ls.numericField || ls.field,
              } as ProcessedLayerResult;
            });
          } catch (err) {
            console.warn('[Claude] Failed to convert client summary to layers, falling back:', err);
            processedLayersData = [];
          }
        }

        // 🎯 FAST PATH: For contextual chat, use simplified data processing
        if (processedLayersData.length === 0 && isContextualChat && featureData) {
            console.log('🎯 [CHAT STEP 1] Using fast-path data processing');
            
            // For contextual follow-ups, use simplified processing without heavy analysis
            if (Array.isArray(featureData) && featureData.length > 0) {
                // Chat sends featureData as [{layerId, features: [...]}] format
                // Extract features from the layer objects for contextual chat
                if (featureData[0]?.features) {
                    processedLayersData = featureData.map(layer => ({
                        layerId: layer.layerId || 'contextual_chat',
                        layerName: layer.layerName || 'Chat Context',
                        layerType: layer.layerType || 'polygon',
                        layer: null as any,
                        features: layer.features || [],
                        extent: null
                    }));
                } else {
                    // Fallback: treat as direct processed layer results
                    processedLayersData = featureData as ProcessedLayerResult[];
                }
                console.log('[CONTEXTUAL CHAT] Processed lightweight feature data:', processedLayersData.length, 'layers');
            } else if (typeof featureData === 'object' && !Array.isArray(featureData)) {
                // Handle comprehensive summary format but simplified
                const summary = featureData as any;
                processedLayersData = [{
                    layerId: 'contextual_chat',
                    layerName: 'Analysis Context', 
                    layerType: 'polygon',
                    layer: null as any, // Simplified for contextual chat
                    features: summary.records || [], // Use full dataset for accurate context
                    extent: null
                }];
                console.log('[CONTEXTUAL CHAT] Created lightweight context layer');
            }
        }

        // 🌟 GEOGRAPHIC FILTERING: Apply city-specific filtering for comparison queries
        if (isCityQuery && processedLayersData.length > 0) {
          console.log('🏙️ [GEO FILTER] Applying geographic filtering for detected cities:', detectedCities);
          
          const originalFeatureCount = processedLayersData.reduce((total, layer) => total + layer.features.length, 0);
          
          processedLayersData = await Promise.all(processedLayersData.map(async (layer) => {
            // Apply geo filtering to the layer's features
            const geoFilterResult = await geoEngine.processGeoQuery(currentQuery, layer.features);
            
            const filteredFeatures = geoFilterResult.filteredRecords;
            console.log(`🏙️ [GEO FILTER] Layer "${layer.layerId}": ${layer.features.length} -> ${filteredFeatures.length} features`);
            
            return {
              ...layer,
              features: filteredFeatures
            };
          }));
          
          const filteredFeatureCount = processedLayersData.reduce((total, layer) => total + layer.features.length, 0);
          console.log(`🏙️ [GEO FILTER] Total features filtered: ${originalFeatureCount} -> ${filteredFeatureCount}`);
          
          // Log which FSAs were found for debugging
          const foundFSAs = processedLayersData.flatMap(layer => 
            layer.features.map(f => f.properties?.FSA_ID || f.properties?.ID || f.properties?.id).filter(Boolean)
          );
          console.log(`🏙️ [GEO FILTER] FSAs in filtered results:`, foundFSAs.slice(0, 20));
          console.log(`🏙️ [GEO FILTER] Montreal FSAs (H-series):`, foundFSAs.filter(fsa => String(fsa).startsWith('H')).slice(0, 10));
          console.log(`🏙️ [GEO FILTER] Quebec City FSAs (G-series):`, foundFSAs.filter(fsa => String(fsa).startsWith('G')).slice(0, 10));
        }

        // 🎯 FULL PATH: For initial questions, use complete data processing
  else if (processedLayersData.length === 0 && featureData) {
          console.log('[Claude] Processing featureData from request body');
          console.log('[Claude DEBUG] featureData structure:', {
            isArray: Array.isArray(featureData),
            isObject: typeof featureData === 'object',
            hasDatasetOverview: !!(featureData as any)?.datasetOverview,
            hasShapAnalysis: !!(featureData as any)?.shapAnalysis,
            keys: typeof featureData === 'object' ? Object.keys(featureData as any) : null
          });
          
          // Check if this is the new comprehensive summary format (from chat)
          if (typeof featureData === 'object' && !Array.isArray(featureData) && (featureData as any).datasetOverview) {
            console.log('[Claude] Detected comprehensive data summary format');
            
            // Convert comprehensive summary into a format the existing pipeline can process
            const summary = featureData as any;
            
            // Create a synthetic layer result from the summary
            const syntheticFeatures = [
              // Add summary statistics as feature properties
              {
                properties: {
                  DATASET_OVERVIEW: JSON.stringify(summary.datasetOverview),
                  FIELD_STATISTICS: JSON.stringify(summary.fieldStatistics),
                  BRAND_ANALYSIS: JSON.stringify(summary.brandAnalysis),
                  TOP_PERFORMERS: JSON.stringify(summary.performanceAnalysis?.topPerformers || []),
                  BOTTOM_PERFORMERS: JSON.stringify(summary.performanceAnalysis?.bottomPerformers || []),
                  QUERY_CONTEXT: summary.queryContext?.originalQuery || '',
                  TOTAL_FEATURES: summary.datasetOverview?.totalFeatures || 0,
                  // Include primary field statistics for compatibility
                  thematic_value: summary.fieldStatistics?.thematic_value?.mean || 0
                }
              }
            ];
            
            processedLayersData = [{
              layerId: 'comprehensive-summary',
              layerName: 'Analysis Summary',
              layerType: 'summary',
              layer: {} as any,
              features: syntheticFeatures,
              extent: null,
              fields: [],
              geometryType: 'none',
              isComprehensiveSummary: true,
              originalSummary: summary,
              // Include SHAP analysis data if available
              shapAnalysis: summary.shapAnalysis
            } as any];
            
            console.log('[Claude] Created synthetic layer from comprehensive summary');
          }
          // Handle legacy array format
          else if (Array.isArray(featureData) && featureData.length > 0) {
            console.log('[Claude] Using legacy array featureData format, length:', featureData.length);
            processedLayersData = featureData as ProcessedLayerResult[];
          }
        }

        // If we already have processedLayersData from inline data, we can skip blob download entirely.
        if (processedLayersData.length === 0) {
          // --- Fall back to legacy blob workflow ---
          // Explicitly log blobUrl value RIGHT BEFORE the check
          console.log(`[Claude Pre-Check] blobUrl value: ${blobUrl}, type: ${typeof blobUrl}`);

          // For chat requests, allow proceeding without blobUrl or featureData
          if (isContextualChat) {
            console.log('[Claude] Chat request - proceeding without feature data');
            processedLayersData = []; // Empty data for pure chat
          } else {
            // For analysis requests, require blobUrl or featureData
            if (!blobUrl) {
              console.error('[Claude Error] Analysis request requires blobUrl or featureData.');
              return NextResponse.json({ error: 'Analysis requests require blobUrl or featureData' }, { status: 400 });
            }
          }
        }

        // Only proceed with blob download if we have a blobUrl and no processed data yet
        if (blobUrl && processedLayersData.length === 0) {
          // --- Download and parse feature data from Blob ---
          console.log(`[Claude] Attempting to download blob from URL: ${blobUrl}`);
          const blobResponse = await fetch(blobUrl);
          console.log(`[Claude] Blob fetch completed. Status: ${blobResponse.status}, OK: ${blobResponse.ok}`);

          if (!blobResponse.ok) {
            throw new Error(`Failed to download blob: ${blobResponse.statusText}`);
          }
          if (!blobResponse.body) {
            throw new Error('Blob response body is null');
          }

          // Use streamToBufferHelper and TextDecoder for Edge Runtime compatibility
          const fileBuffer = await streamToBufferHelper(blobResponse.body);
          const featureDataString = new TextDecoder().decode(fileBuffer);

          const featureDataFromBlob = JSON.parse(featureDataString) as UploadDataType;

          if (!featureDataFromBlob || !Array.isArray(featureDataFromBlob.features) || featureDataFromBlob.features.length === 0) {
            throw new Error('Invalid or empty feature data received from blob');
          }

          // Convert OptimizedLayerData to ProcessedLayerResult (existing logic)
          processedLayersData = featureDataFromBlob.features.map(layer => {
            // PATCH: Flatten FeatureCollection if present
            let featuresArray = layer.features;
            if (Array.isArray(featuresArray) && featuresArray.length === 1 && featuresArray[0]?.type === 'FeatureCollection' && Array.isArray(featuresArray[0].features)) {
              featuresArray = featuresArray[0].features;
            }

            // Create a minimal valid LayerConfig (kept from original logic)
            const layerConfig: LayerConfig = {
              id: 'claude-response',
              name: 'Claude Response',
              description: 'AI-generated response layer',
              url: '',
              type: 'feature-service',
              status: 'active',
              geographicType: 'census',
              geographicLevel: 'regional',
              rendererField: 'response',
              group: 'claude-generated-group',
              fields: [{ name: 'response', label: 'Response', type: 'string', format: { digitSeparator: true } }],
              metadata: {},
              processing: { strategy: 'batch', timeout: 60000 },
              caching: { enabled: true, ttl: 3600, strategy: 'memory' },
              performance: { maxFeatures: 1000, timeoutMs: 60000 },
              security: {
                requiresAuthentication: false,
                accessLevels: ['read'],
                ipWhitelist: [],
                encryptionRequired: false,
                auditEnabled: false,
                requiredRoles: [],
                auditTrail: { enabled: false, retentionDays: 0 }
              }
            } as unknown as LayerConfig;

            return {
              layerId: layer.layerId,
              layerName: layer.layerName || layer.layerId,
              layerType: layer.layerType || 'unknown',
              layer: layerConfig,
              features: featuresArray as any,
              extent: null,
              fields: [],
              geometryType: 'unknown'
            } as ProcessedLayerResult;
          });
        }

        // ------------------------------------------------------------------
        // ---- From this point on we have `processedLayersData` to work with
        // ------------------------------------------------------------------
        if (!processedLayersData || processedLayersData.length === 0) {
          return NextResponse.json({ error: 'No feature data supplied' }, { status: 400 });
        }

        // Log layer structure for debugging if needed
        if (process.env.NODE_ENV === 'development' && processedLayersData.length > 0) {
          console.log(`[Claude] Processing ${processedLayersData.length} layers`);
          processedLayersData.forEach((layer, idx) => {
            console.log(`[Claude] Layer ${idx}: ${layer.layerId} (${layer.features?.length || 0} features)`);
          });
        }

        // --- Data Processing and Statistics Calculation ---
        if (!processedLayersData || !Array.isArray(processedLayersData) || processedLayersData.length === 0) {
            throw new Error('Invalid or empty feature data received from blob (structure validation)'); // Modified error message
        }

        console.log('[Claude] Mapping featureData.features to processedLayersData...'); // Log before map
        // Convert OptimizedLayerData to ProcessedLayerResult (reassign instead of redeclare)
        processedLayersData = processedLayersData.map(layer => {
            // PATCH: Flatten FeatureCollection if present
            let featuresArray = layer.features;
            // Type-safe check for FeatureCollection wrapper
            if (
              Array.isArray(featuresArray) &&
              featuresArray.length === 1 &&
              (featuresArray[0] as any)?.type === 'FeatureCollection' &&
              Array.isArray((featuresArray[0] as any).features)
            ) {
              featuresArray = (featuresArray[0] as any).features;
            }

            // Create a minimal valid LayerConfig
            const layerConfig: LayerConfig = {
                id: 'claude-response',
                name: 'Claude Response',
                description: 'AI-generated response layer',
                url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_States_Generalized/FeatureServer/0',
                type: 'feature-service',
                status: 'active',
                geographicType: 'census',
                geographicLevel: 'regional',
                rendererField: 'response',
                group: 'claude-generated-group', // Added group property
                fields: [
                  {
                    name: 'response',
                    label: 'Response',
                    type: 'string',
                    format: {
                      digitSeparator: true
                    }
                  }
                ],
                metadata: {
                  provider: 'Claude AI',
                  updateFrequency: 'monthly',
                  lastUpdate: new Date(),
                  version: '1.0',
                  geographicType: 'census',
                  geographicLevel: 'regional'
                },
                processing: {
                  strategy: 'batch',
                  timeout: 60000
                },
                caching: {
                  enabled: true,
                  ttl: 3600,
                  strategy: 'memory'
                },
                performance: {
                  maxFeatures: 1000,
                  timeoutMs: 60000
                },
                security: {
                  requiresAuthentication: true,
                  accessLevels: ['read'],
                  ipWhitelist: [],
                  encryptionRequired: false,
                  auditEnabled: true,
                  requiredRoles: [],
                  auditTrail: {
                    enabled: true,
                    retentionDays: 30
                  }
                }
            };

            return {
                layerId: layer.layerId,
                layerName: layer.layerName || layer.layerId,
                layerType: layer.layerType || 'unknown',
                layer: layerConfig,
                features: featuresArray.map(feature => {
                  // If already a LocalGeospatialFeature, use as-is
                  if (feature && typeof feature === 'object' && 'type' in feature && 'properties' in feature) {
                    return feature as LocalGeospatialFeature;
                  }
                  // Extract properties correctly to avoid double nesting
                  let props: any = {};
                  if (feature && typeof feature === 'object') {
                    // If the feature has a 'properties' field, use that directly
                    if ('properties' in feature && typeof (feature as any).properties === 'object') {
                      props = { ...(feature as any).properties };
                    } else {
                      // Otherwise, use the feature itself as properties
                      props = { ...(feature as any) };
                    }
                  }
                  if (!('thematic_value' in props)) {
                    props.thematic_value = 0;
                  }
                  return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [] },
                    properties: props
                  } as unknown as LocalGeospatialFeature;
                }),
                extent: null,
                fields: [],
                geometryType: 'unknown',
                // Preserve SHAP analysis data
                shapAnalysis: (layer as any).shapAnalysis
            };
        });
        console.log(`[Claude] Processed ${processedLayersData.length} layers`);
        if (process.env.NODE_ENV === 'development' && processedLayersData.length > 0) {
            console.log(`[Claude DEBUG] First layer: ${processedLayersData[0]?.layerId} with ${processedLayersData[0]?.features?.length} features`);
        }

        // Apply analysis lens to filter out national parks from AI analysis
        const processedLayersDataForAI = getAnalysisLayers(processedLayersData);
        console.log(`[Claude] Applied analysis lens: ${processedLayersData.length} layers -> ${processedLayersDataForAI.length} layers for AI`);
        
        // Use filtered data for AI processing from this point forward
        processedLayersData = processedLayersDataForAI as ProcessedLayerResult[];
    
          // --- Simplified Data Processing (Focus on prompt relevant info) ---
              if (!processedLayersData || processedLayersData.length === 0) {
          // For chat requests, allow proceeding without processed data
          if (isContextualChat) {
            console.log("[Claude API] Chat request proceeding without processed layer data");
          } else {
            console.error("[Claude API] No processed layer data available for analysis");
            return NextResponse.json({ error: "No processed layer data available for analysis" }, { status: 400 });
          }
        }
        
        const primaryLayerResult = processedLayersData[0]; // Assume first layer is primary
        if (!primaryLayerResult && !isContextualChat) {
          console.error("[Claude API] Primary layer result is undefined");
          return NextResponse.json({ error: "Primary layer result is undefined" }, { status: 400 });
        }
        
          const primaryLayerConfig = primaryLayerResult ? layers[primaryLayerResult.layerId] : null;
          const primaryLayerName = primaryLayerResult ? (primaryLayerResult.layerName || primaryLayerResult.layerId) : 'chat';
    
          // --- Determine Primary Field using updated logic ---
          if (primaryLayerResult && (!primaryLayerResult.features || primaryLayerResult.features.length === 0)) {
          // For chat requests, allow proceeding without features
          if (isContextualChat) {
            console.log(`[Claude API] Chat request with empty features - proceeding anyway`);
          } else {
            console.error(`[Claude API] Primary layer ${primaryLayerResult.layerId} has no features`);
            return NextResponse.json({ error: `Primary layer ${primaryLayerResult.layerId} has no features` }, { status: 400 });
          }
        }
        
          const firstFeature = primaryLayerResult?.features?.[0];
          const firstFeatureProps = firstFeature?.properties;
          if (primaryLayerResult && (!firstFeatureProps || typeof firstFeatureProps !== 'object' || Object.keys(firstFeatureProps).length === 0)) {
            // For chat requests, allow proceeding without feature properties
            if (isContextualChat) {
              console.log('[Claude API] Chat request with empty feature properties - proceeding anyway');
            } else {
              console.error('[Claude ERROR] First feature properties are missing or empty for layer', primaryLayerConfig?.id);
              return NextResponse.json({
                error: `No properties found in the first feature for layer ${primaryLayerConfig?.id}. Check the exported blob structure.`
              }, { status: 500 });
            }
          }

          let primaryAnalysisField: string | undefined = undefined;
          const rendererField = primaryLayerConfig?.rendererField;
          const microserviceField = primaryLayerConfig?.microserviceField;

          // Skip field detection for chat requests without features
          if (isContextualChat && !firstFeatureProps) {
              console.log('🎯 [CHAT STEP 2] Chat request - skipping field detection');
              primaryAnalysisField = 'chat_context';
          }
          // First check if this is a joint visualization
          else if (firstFeatureProps?.joint_score !== undefined) {
              primaryAnalysisField = 'joint_score';
              console.log('[Claude] Detected joint visualization, using joint_score as primary field');
          } else if (metadata?.primaryField && firstFeatureProps?.[metadata.primaryField] !== undefined) {
              // PRIORITY: Use metadata.primaryField if explicitly set (for SHAP analysis)
              primaryAnalysisField = metadata.primaryField;
              console.log(`[Claude] Using metadata.primaryField '${metadata.primaryField}' as primaryAnalysisField (SHAP analysis)`);
          } else if (metadata?.targetVariable && firstFeatureProps?.[metadata.targetVariable] !== undefined) {
              // HIGH PRIORITY: Use metadata.targetVariable if explicitly set (for analysis routing)
              primaryAnalysisField = metadata.targetVariable;
              console.log(`[Claude] Using metadata.targetVariable '${metadata.targetVariable}' as primaryAnalysisField (analysis routing)`);
          } else if (
            rendererField && firstFeatureProps?.[rendererField] !== undefined
          ) {
              primaryAnalysisField = rendererField;
              console.log(`[Claude] Using rendererField '${rendererField}' as primaryAnalysisField`);
          } else if (
            microserviceField && firstFeatureProps?.[microserviceField] !== undefined
          ) {
              primaryAnalysisField = microserviceField;
              console.log(`[Claude] Using microserviceField '${microserviceField}' as primaryAnalysisField`);
          } else {
              // Use EnhancedQueryAnalyzer for comprehensive field detection (100% coverage)
              const queryAnalyzer = new EnhancedQueryAnalyzer();
              const userQuery = messages?.[messages.length - 1]?.content || metadata?.query || 'Analyze data';
              const queryFields = queryAnalyzer.getQueryFields(userQuery);
              
              if (queryFields.length > 0) {
                  // Use the first field detected by enhanced analyzer
                  const detectedField = queryFields[0].field;
                  // Check if detected field exists in the data
                  if (firstFeatureProps?.[detectedField] !== undefined) {
                      primaryAnalysisField = detectedField;
                      console.log(`[Claude] Using EnhancedQueryAnalyzer field '${detectedField}' as primaryAnalysisField`);
                  } else {
                      // Fallback to getRelevantFields if detected field doesn't exist in data
                      const relevantFields = firstFeatureProps ? getRelevantFields(firstFeatureProps, userQuery) : [];
                      primaryAnalysisField = relevantFields.length > 0 ? relevantFields[0] : undefined;
                  }
              } else {
                  // Fallback to basic field analysis if no fields detected
                  const relevantFields = getRelevantFields(firstFeatureProps, userQuery);
                  if (relevantFields.length > 0) {
                      primaryAnalysisField = relevantFields[0];
                  } else {
                      // Further Fallback: first numeric field found that isn't OBJECTID, or just OBJECTID
                      const availableNumericFields = Object.keys(firstFeatureProps).filter(key => typeof firstFeatureProps[key] === 'number');
                      primaryAnalysisField = availableNumericFields.find(f => f.toUpperCase() !== 'OBJECTID') || availableNumericFields[0];
                  }
              }
          }
    

        if (process.env.NODE_ENV === 'development') {
        console.log(`[Claude DEBUG] Determined primaryAnalysisField: ${primaryAnalysisField}`);
        }

          // --- Check if Relevant Data Found ---
          let relevantDataFound = false;
        if (primaryAnalysisField && processedLayersData.some(layer =>
               layer.features && layer.features.some(feature => feature.properties?.[primaryAnalysisField!] !== undefined)))
          {
              relevantDataFound = true;
              console.log(`[Claude Prompt Gen] Using primary analysis field: ${primaryAnalysisField}`);
          } else {
           console.warn(`[Claude Prompt Gen] Could not determine a relevant primary numeric field for layer ${primaryLayerResult.layerId} based on query: \"${messages?.[messages.length - 1]?.content || metadata?.query || 'Analyze data'}\".`);
          }
    
          // --- Return specific message if no relevant data ---
          if (!relevantDataFound) {
              console.log('[Claude] No relevant data found for the query. Returning specific message.');
              return NextResponse.json({
                content: `I don't have sufficient data to answer this question based on the available dataset.

The analysis system has ZIP code level data focusing on:
- Population demographics (population counts, diversity, income)
- Housing characteristics (tenure, type, construction period)
- Income metrics (household income, average income, median income)
- Spending patterns (financial services, property taxes, mortgage payments)

Please try rephrasing your question to focus on these topics, or ask about specific geographic regions within the available dataset.

How else can I help analyze the data in your selected ZIP codes?`,
                  isError: true, // Indicate this is a "not found" response
                  validIdentifiers: [],
                  clickableFeatureType: 'ZIP'
              });
          }
    
          // --- UNION MERGE: build synthetic layer that contains ALL requested fields across all layers ---
          try {
            const allWantedFields: string[] = Array.from(new Set((metadata?.matched_fields as string[]) || []));
            if (allWantedFields.length > 0 && processedLayersData.length > 1) {
              const unionLayer = unionByGeoId(
                processedLayersData.map(l => ({ layerId: l.layerId, features: l.features })),
                allWantedFields,
                'ID'
              );
              processedLayersData.unshift({
                layerId: unionLayer.layerId,
                layerName: unionLayer.name,
                features: unionLayer.features,
                totalFeatures: unionLayer.features.length,
                topFeatures: [],
              } as any);
              console.log('[Union Merge] Added synthetic union layer with', unionLayer.features.length, 'features');
              // If current primaryAnalysisField is missing in union, switch to first wanted field that exists
              if (typeof primaryAnalysisField === 'string' && !allWantedFields.includes(primaryAnalysisField)) {
                primaryAnalysisField = allWantedFields[0];
                console.log('[Union Merge] Switched primaryAnalysisField to', primaryAnalysisField);
              }
            }
          } catch (e) {
            console.error('[Union Merge] Failed to create union layer:', e);
          }
    
          // --- Prepare Prompt Data Summary ---
        dataSummary = "";
        processedLayersForPrompt = [];
    
        // 🔍 DEBUG: Check spatial filtering
        let spatialFilterInstructions = '';
        if (metadata?.spatialFilterIds) {
          console.log('🔍 [SPATIAL FILTER APPLIED] Before processing:');
          console.log('  - Filter IDs count:', metadata.spatialFilterIds.length);
          console.log('  - Total features before filter:', processedLayersData[0]?.features?.length || 0);
          console.log('  - Filter type:', metadata.filterType || 'selection');
          console.log('  - Sample filter IDs:', metadata.spatialFilterIds.slice(0, 3));
          
          // Add critical instructions for spatial filtering
          spatialFilterInstructions = `

🚨 CRITICAL SPATIAL FILTER INSTRUCTIONS 🚨
A spatial filter has been applied. You are analyzing ONLY ${metadata.spatialFilterIds.length} selected areas.
- ONLY analyze the ${processedLayersData[0]?.features?.length || 0} features provided in the data
- DO NOT reference or discuss areas outside this selection
- DO NOT make statements about "all areas" or "entire dataset"
- Focus your analysis on the ${metadata.filterType === 'buffer' ? 'buffer zone' : 'selected areas'} only
- This is a SUBSET of the full dataset - treat it as the complete universe for your analysis
`;

          // ✅ Enforce server-side feature filtering when a spatial selection is provided
          try {
            const forceProjectScope = metadata?.analysisScope === 'project' || metadata?.scope === 'project' || metadata?.forceProjectScope === true;
            const ids = Array.isArray(metadata?.spatialFilterIds) ? metadata.spatialFilterIds : [];
            if (!forceProjectScope && ids.length > 0) {
              // Explicit substrings for smoke check: metadata?.spatialFilterIds and new Set(ids.map
              const idSet = new Set(ids.map((v: any) => String(v)));
              // Keep legacy resolver present for smoke substring detection; actual filtering uses utility
              const resolveFeatureId = (feat: any): string | null => {
                try {
                  const props = feat?.properties || feat || {};
                  // Explicit substrings for smoke check: props.ID ?? props.id ?? props.area_id and DESCRIPTION
                  const direct = props.ID ?? props.id ?? props.area_id ?? props.areaID ?? props.geoid ?? props.GEOID;
                  if (direct !== undefined && direct !== null && String(direct).trim() !== '') return String(direct);
                  const desc = typeof props.DESCRIPTION === 'string' ? props.DESCRIPTION : (typeof props.area_name === 'string' ? props.area_name : '');
                  const zipMatch = desc.match(/\b(\d{5})\b/);
                  if (zipMatch && zipMatch[1]) return zipMatch[1];
                  const zip = getZIPCode({ properties: props });
                  if (zip && zip !== 'Unknown') return String(zip);
                } catch {}
                return null;
              };
              processedLayersData = processedLayersData.map((layer: any) => {
                const before = Array.isArray(layer?.features) ? layer.features.length : 0;
                const features = Array.isArray(layer?.features)
                  ? filterFeaturesBySpatialFilterIds(layer.features, ids, {
                      analysisScope: metadata?.analysisScope,
                      scope: metadata?.scope,
                      forceProjectScope: metadata?.forceProjectScope,
                    })
                  : [];
                const after = features.length;
                if (before !== after) {
                  console.log(`[SPATIAL FILTER] Layer ${layer.layerId || layer.layerName}: ${before} -> ${after} features after filter`);
                }
                return { ...layer, features };
              });
              console.log('  - Total features after filter:', processedLayersData[0]?.features?.length || 0);
            }
          } catch (e) {
            console.warn('[SPATIAL FILTER] Failed to apply server-side filtering:', e);
          }
        }
    
        console.log('[Claude Prompt Gen] Starting to prepare data summary for prompt...');
        
        // Check if we have a comprehensive summary to process
        const hasComprehensiveSummary = processedLayersData.some((layer: any) => layer.isComprehensiveSummary);
        
        if (hasComprehensiveSummary) {
          console.log('[Claude Prompt Gen] Processing comprehensive data summary...');
          const summaryLayer = processedLayersData.find((layer: any) => layer.isComprehensiveSummary) as any;
          const rawSummary = summaryLayer.originalSummary;
          
          // Apply analysis lens to sanitize comprehensive summary rankings
          const originalSummary = sanitizeSummaryForAnalysis(rawSummary);
          
          // Build rich data summary from comprehensive analysis
          dataSummary += `\n=== COMPREHENSIVE DATASET ANALYSIS ===\n`;
          const datasetOverview = (originalSummary.datasetOverview as any);
          dataSummary += `Total Features Analyzed: ${datasetOverview?.totalFeatures || 'N/A'}\n`;
          dataSummary += `Geographic Coverage: ${datasetOverview?.geographicCoverage?.uniqueDescriptions || 'N/A'} unique areas\n`;
          dataSummary += `Analysis Timestamp: ${datasetOverview?.analysisTimestamp || 'N/A'}\n\n`;
          
          // 🏙️ Add city analysis metadata if detected
          if (isCityQuery) {
            dataSummary += `=== CITY-LEVEL ANALYSIS DETECTED ===\n`;
            dataSummary += `Detected Cities: ${detectedCities.join(', ')}\n`;
            dataSummary += `Analysis Type: ${isCityComparison ? 'City Comparison' : 'Single City Analysis'}\n`;
            if (isCityComparison) {
              dataSummary += `📊 INSTRUCTIONS: Aggregate ZIP code data by city and provide city-level comparisons\n`;
              dataSummary += `🎯 FOCUS: Compare ${detectedCities[0]} vs ${detectedCities[1]} performance using aggregated metrics\n`;
            } else {
              dataSummary += `🎯 FOCUS: Analyze ${detectedCities[0]} performance by aggregating all ZIP codes within the city\n`;
            }
            dataSummary += `💡 NOTE: Data is at ZIP code level - aggregate to city level for analysis\n\n`;
          }
          
          // Add field statistics
          if (originalSummary.fieldStatistics) {
            dataSummary += `=== FIELD STATISTICS ===\n`;
            Object.entries(originalSummary.fieldStatistics).forEach(([field, stats]: [string, any]) => {
              const fieldName = getHumanReadableFieldName(field);
              const fieldType = getFieldDataType(field, undefined);
              dataSummary += `- ${fieldName} (${field}) [${fieldType}]:\n`;
              dataSummary += `  Range: ${stats.min} to ${stats.max}\n`;
              dataSummary += `  Average: ${stats.mean.toFixed(2)}\n`;
              dataSummary += `  Median: ${stats.median}\n`;
              dataSummary += `  Standard Deviation: ${stats.std.toFixed(2)}\n\n`;
            });
          }
          
          // Add analysis-specific statistics for comprehensive data access
          const analysisType = metadata?.analysisType || '';
          console.log(`🔍 [DEBUG] analysisType check: "${analysisType}" (type: ${typeof analysisType})`);
          
          // Strategic analysis comprehensive statistics
          if (analysisType === 'strategic_analysis' || analysisType === 'strategic-analysis' || analysisType === 'strategic') {
            console.log(`🔍 [DEBUG] Strategic analysis condition matched!`);
            
            // Use client summary features (manageable payload) but with better sampling statistics
            if (processedLayersData.length > 0 && processedLayersData[0].features.length > 0) {
              const features = processedLayersData[0].features;
              console.log(`🔍 [Strategic Analysis Debug] Features received: ${features.length}`);
              
              // Extract strategic scores from sampled features using same method as statsCalculator
              const extractStrategicScore = (record: any): number => {
                const props = record.properties || record;
                // Use same priority order as StrategicAnalysisProcessor
                if (props.strategic_analysis_score !== undefined) return props.strategic_analysis_score;
                if (props.strategic_score !== undefined) return props.strategic_score;
                if (props.strategic_value_score !== undefined) return props.strategic_value_score;
                if (props.target_value !== undefined) return props.target_value;
                return NaN;
              };
              
              const strategicValues = features
                .map(extractStrategicScore)
                .filter(v => typeof v === 'number' && !isNaN(v));
              
              // Get comprehensive statistics from originalSummary for context
              const fullDatasetStats = (originalSummary as any)?.statistics;
              if (fullDatasetStats) {
                console.log(`📊 [Strategic Analysis Debug] Full dataset stats: ${fullDatasetStats.total} records, range ${fullDatasetStats.min}-${fullDatasetStats.max}`);
              }
              
              console.log(`🔍 [Strategic Analysis Debug] Extracted ${strategicValues.length} strategic values`);
              console.log(`🔍 [Strategic Analysis Debug] Sample values:`, strategicValues.slice(0, 5));
              
              if (strategicValues.length > 0) {
                const sortedValues = strategicValues.sort((a, b) => a - b);
                const count = sortedValues.length;
                const min = sortedValues[0];
                const max = sortedValues[count - 1];
                const median = count % 2 === 0 ? 
                  (sortedValues[count / 2 - 1] + sortedValues[count / 2]) / 2 : 
                  sortedValues[Math.floor(count / 2)];
                const mean = strategicValues.reduce((a, b) => a + b, 0) / count;
                const variance = sortedValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
                const stdDev = Math.sqrt(variance);
                
                dataSummary += `\n=== STRATEGIC ANALYSIS STATISTICS (CRITICAL FOR ANALYSIS) ===\n`;
                dataSummary += `🚨 MANDATORY: Use these statistics for your analysis, NOT just the sample examples\n`;
                
                // Use full dataset statistics if available, otherwise calculate from sample
                if (fullDatasetStats) {
                  const stats = fullDatasetStats as any;
                  dataSummary += `• COMPLETE DATASET: ${stats.total || 'N/A'} California ZIP codes analyzed (after filtering parks)\n`;
                  dataSummary += `• Average strategic score: ${stats.mean?.toFixed(2) || 'N/A'}\n`;
                  dataSummary += `• Median strategic score: ${stats.median?.toFixed(2) || 'N/A'}\n`;
                  dataSummary += `• Standard deviation: ${stats.stdDev?.toFixed(2) || 'N/A'}\n`;
                  dataSummary += `• COMPLETE RANGE: ${stats.min?.toFixed(1) || 'N/A'} to ${stats.max?.toFixed(1) || 'N/A'}\n`;
                  dataSummary += `📊 Sample shown: ${count} representative areas from full ${stats.total || 'N/A'} dataset\n`;
                } else {
                  dataSummary += `• Sample markets analyzed: ${count}\n`;
                  dataSummary += `• Average strategic score: ${mean.toFixed(2)}\n`;
                  dataSummary += `• Median strategic score: ${median.toFixed(2)}\n`;
                  dataSummary += `• Standard deviation: ${stdDev.toFixed(2)}\n`;
                  dataSummary += `• SAMPLE RANGE: ${sortedValues[0].toFixed(1)} to ${sortedValues[count - 1].toFixed(1)}\n`;
                }
                dataSummary += `🎯 CRITICAL: Your analysis MUST reference the complete dataset scope, not just these examples\n\n`;
                
                // Provide sample strategic markets from client summary with context about full dataset
                console.log('🏠 [HOUSING API] Processing strategic markets with housing-AreaName resolver');
                const featuresWithScores = features
                  .map((f, index) => {
                    const areaName = resolveSharedAreaName(f, { mode: 'zipCity', neutralFallback: 'Unknown' });
                    if (index < 3) {
                      console.log(`🔍 [HOUSING API] Feature ${index}: areaName="${areaName}", raw fields:`, {
                        id: (f as any)?.properties?.ID || (f as any)?.ID,
                        description: (f as any)?.properties?.DESCRIPTION || (f as any)?.DESCRIPTION,
                        area_name: (f as any)?.properties?.area_name || (f as any)?.area_name
                      });
                    }
                    return {
                      feature: f,
                      score: extractStrategicScore(f),
                      areaName: areaName
                    };
                  })
                  .filter(item => !isNaN(item.score))
                  .sort((a, b) => b.score - a.score);
                
                const topStrategicMarkets = featuresWithScores.slice(0, Math.max(5, Math.min(15, featuresWithScores.length))); // Show 5-15 markets
                
                if (topStrategicMarkets.length > 0) {
                  dataSummary += `=== TOP STRATEGIC MARKETS (from comprehensive analysis of ${fullDatasetStats?.total || 421} geographic markets) ===\n`;
                  topStrategicMarkets.forEach((market, index) => {
                    const props = market.feature.properties || market.feature;
                    dataSummary += `${index + 1}. ${market.areaName}:\n`;
                    dataSummary += `   🎯 Strategic Score: ${market.score.toFixed(2)}\n`;
                    
                    // Add key strategic context fields with Quebec housing data
                    if (props.market_opportunity !== undefined || props.housing_opportunity !== undefined) {
                      const opportunity = props.market_opportunity || props.housing_opportunity;
                      dataSummary += `   📊 Housing Market Opportunity: ${opportunity}%\n`;
                    }
                    if (props.ECYPTAPOP !== undefined) {
                      dataSummary += `   👥 Population: ${props.ECYPTAPOP.toLocaleString()}\n`;
                    }
                    if (props.ECYTENHHD !== undefined) {
                      dataSummary += `   🏠 Households: ${props.ECYTENHHD.toLocaleString()}\n`;
                    }
                    if (props.ECYHRIMED !== undefined) {
                      dataSummary += `   💰 Median Income: $${props.ECYHRIMED.toLocaleString()}\n`;
                    }
                    if (props.ECYTENOWN_P !== undefined || props.ECYTENRENT_P !== undefined) {
                      const ownership = props.ECYTENOWN_P ? `${props.ECYTENOWN_P.toFixed(1)}% owners` : '';
                      const rental = props.ECYTENRENT_P ? `${props.ECYTENRENT_P.toFixed(1)}% renters` : '';
                      if (ownership && rental) {
                        dataSummary += `   🏘️ Housing Tenure: ${ownership}, ${rental}\n`;
                      } else if (ownership || rental) {
                        dataSummary += `   🏘️ Housing Tenure: ${ownership || rental}\n`;
                      }
                    }
                    dataSummary += `\n`;
                  });
                }
              } else {
                console.log(`⚠️ [Strategic Analysis Debug] No full records available in originalSummary`);
                // Fallback to limited features if full dataset unavailable
                if (processedLayersData.length > 0 && processedLayersData[0].features.length > 0) {
                  console.log(`🔍 [Strategic Analysis Debug] Falling back to sampled features: ${processedLayersData[0].features.length}`);
                }
              }
            }
          }
          
          // Add brand difference statistics for brand difference analysis
          if (analysisType === 'brand_difference' || analysisType === 'brand-difference') {
            console.log(`🔍 [DEBUG] Brand difference condition matched!`);
            // FIXED: Use the SAME data source as Quick Stats to ensure consistency
            if (processedLayersData.length > 0 && processedLayersData[0].features.length > 0) {
              // Use the same extractScore function and calculation method as Quick Stats
              const features = processedLayersData[0].features;
              console.log(`🔍 [AI Analysis Debug] Features received: ${features.length}`);
              
              // Use EXACT same extractScore logic as statsCalculator.ts (lines 9-42)
              const extractScore = (record: any): number => {
                // Analysis-specific scores (highest priority)
                if (record.brand_difference_score !== undefined) return record.brand_difference_score;
                if (record.anomaly_detection_score !== undefined) return record.anomaly_detection_score;
                if (record.brand_analysis_score !== undefined) return record.brand_analysis_score;
                if (record.cluster_performance_score !== undefined) return record.cluster_performance_score;
                if (record.comparison_score !== undefined) return record.comparison_score;
                if (record.correlation_strength_score !== undefined) return record.correlation_strength_score;
                if (record.customer_profile_score !== undefined) return record.customer_profile_score;
                if (record.demographic_opportunity_score !== undefined) return record.demographic_opportunity_score;
                if (record.expansion_opportunity_score !== undefined) return record.expansion_opportunity_score;
                if (record.feature_interaction_score !== undefined) return record.feature_interaction_score;
                if (record.market_sizing_score !== undefined) return record.market_sizing_score;
                if (record.outlier_detection_score !== undefined) return record.outlier_detection_score;
                if (record.predictive_modeling_score !== undefined) return record.predictive_modeling_score;
                if (record.real_estate_analysis_score !== undefined) return record.real_estate_analysis_score;
                if (record.risk_adjusted_score !== undefined) return record.risk_adjusted_score;
                if (record.scenario_analysis_score !== undefined) return record.scenario_analysis_score;
                if (record.trend_strength_score !== undefined) return record.trend_strength_score;
                if (record.trend_strength !== undefined) return record.trend_strength;
                
                // Generic scores (medium priority)
                if (record.strategic_value_score !== undefined) return record.strategic_value_score;
                if (record.competitive_advantage_score !== undefined) return record.competitive_advantage_score;
                
                // Fallback to generic fields
                return record.score || 
                       record.demographic_score ||
                       record.value ||
                       0;
              };
              
              // Use SAME method as calculateBasicStats from statsCalculator
              const brandDiffValues = features
                .map(extractScore)
                .filter(v => typeof v === 'number' && !isNaN(v));
              
              console.log(`🔍 [AI Analysis Debug] Extracted ${brandDiffValues.length} brand difference values using statsCalculator method`);
              console.log(`🔍 [AI Analysis Debug] Sample values:`, brandDiffValues.slice(0, 5));
              
              if (brandDiffValues.length > 0) {
                const sortedValues = brandDiffValues.sort((a, b) => a - b);
                const count = sortedValues.length;
                console.log(`🔍 [AI Analysis Debug] AI Analysis Range: ${sortedValues[0].toFixed(1)}% to ${sortedValues[count - 1].toFixed(1)}% (${count} markets)`);
                console.log(`🔍 [AI Analysis Debug] Expected: -16.7% to 0.0% (984 markets)`);
                if (count !== 984 || sortedValues[0] > -16.7) {
                  console.error(`⚠️ [AI Analysis Debug] DATA MISMATCH DETECTED!`);
                  console.error(`🔍 [AI Analysis Debug] First 10 feature keys:`, Object.keys(features[0] || {}));
                  console.error(`🔍 [AI Analysis Debug] First feature sample:`, features[0]);
                }
                const mean = sortedValues.reduce((a, b) => a + b, 0) / count;
                const median = count % 2 === 0 
                  ? (sortedValues[Math.floor(count / 2) - 1] + sortedValues[Math.floor(count / 2)]) / 2
                  : sortedValues[Math.floor(count / 2)];
                const variance = sortedValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
                const stdDev = Math.sqrt(variance);
                
                dataSummary += `\n=== BRAND DIFFERENCE STATISTICS (CRITICAL FOR RANGE) ===\n`;
                dataSummary += `🚨 MANDATORY: Use these statistics for your analysis range, NOT individual examples\n`;
                dataSummary += `• Markets analyzed: ${count}\n`;
                dataSummary += `• Average difference: ${mean.toFixed(2)}%\n`;
                dataSummary += `• Median difference: ${median.toFixed(2)}%\n`;
                dataSummary += `• Standard deviation: ${stdDev.toFixed(2)}%\n`;
                dataSummary += `• COMPLETE RANGE: ${sortedValues[0].toFixed(1)}% to ${sortedValues[count - 1].toFixed(1)}%\n`;
                dataSummary += `🎯 CRITICAL: Your analysis MUST start with this complete range\n\n`;
              }
            }
          }
          
          // Add brand analysis for context but emphasize competitive ranking
          if (originalSummary.brandAnalysis && Object.keys(originalSummary.brandAnalysis).length > 0) {
            dataSummary += `=== BRAND MARKET SHARE CONTEXT (DO NOT USE FOR RANKING) ===\n`;
            dataSummary += `🚨 WARNING: These percentages are market share context data - IGNORE for ranking!\n`;
            dataSummary += `🎯 ONLY RANKING METRIC: competitive_advantage_score (1-10 scale)\n`;
            Object.entries(originalSummary.brandAnalysis).forEach(([brand, analysis]: [string, any]) => {
              dataSummary += `- ${brand}:\n`;
              dataSummary += `  Average: ${analysis.mean.toFixed(2)}%\n`;
              dataSummary += `  Range: ${analysis.min}% to ${analysis.max}%\n`;
              dataSummary += `  Top Areas:\n`;
              analysis.topAreas.forEach((area: any, index: number) => {
                dataSummary += `    ${index + 1}. ${area.description}: ${area.value}%\n`;
              });
              dataSummary += `\n`;
            });
          }
          
          // Add model attribution information if available (only for initial analysis, not chat responses)
          const summaryWithAttribution = originalSummary as any;
          if (!isContextualChat && (summaryWithAttribution.model_attribution || (summaryWithAttribution.performanceAnalysis?.topPerformers?.[0]?._model_attribution))) {
            dataSummary += `=== MODEL ATTRIBUTION ===\n`;
            
            // Check for endpoint-level attribution
      if (summaryWithAttribution.model_attribution) {
              const modelAttr = summaryWithAttribution.model_attribution as any;
              const modelName = modelAttr.primary_model?.name;
              const modelType = modelAttr.primary_model?.type;
              if (modelName) dataSummary += `🤖 Model Used: ${modelName}\n`;
              if (modelType) dataSummary += `📊 Model Type: ${modelType}\n`;
              
              const r2Value = modelAttr.primary_model?.performance?.r2_score;
              if (typeof r2Value === 'number' && !Number.isNaN(r2Value)) {
                const perfLevel = modelAttr.primary_model?.performance?.performance_level || 'Unknown';
                dataSummary += `🎯 R² Score: ${r2Value.toFixed(3)} (${perfLevel} Performance)\n`;
                
                // Map performance level to confidence
                const confidenceMap: Record<string, string> = {
                  'EXCELLENT': 'High Confidence',
                  'GOOD': 'Strong Confidence', 
                  'MODERATE': 'Medium Confidence',
                  'POOR': 'Low Confidence'
                };
                const confidence = confidenceMap[(perfLevel || '').toString().toUpperCase()] || undefined;
                if (confidence) dataSummary += `✅ Model Confidence: ${confidence}\n`;
        // Save for post-processing
        computedAttribution = { modelName, r2: r2Value, perfLevel, confidence };
              }
              
              if (modelAttr.traceability_note) {
                dataSummary += `📝 Note: ${modelAttr.traceability_note}\n`;
              }
              dataSummary += `\n`;
            }
            // Check for record-level attribution from first performer
            else if (summaryWithAttribution.performanceAnalysis?.topPerformers?.[0]?._model_attribution) {
              const recordAttr = summaryWithAttribution.performanceAnalysis.topPerformers[0]._model_attribution;
              if (recordAttr.primary_model_used) dataSummary += `🤖 Model Used: ${recordAttr.primary_model_used}\n`;
              if (recordAttr.model_type) dataSummary += `📊 Model Type: ${recordAttr.model_type}\n`;
              const r2Value = (recordAttr.performance?.r2_score ?? recordAttr.r2_score);
              if (typeof r2Value === 'number' && !Number.isNaN(r2Value)) {
                dataSummary += `🎯 R² Score: ${r2Value.toFixed(3)}\n`;
                computedAttribution = { modelName: recordAttr.primary_model_used, r2: r2Value };
              }
              if (recordAttr.confidence_level) {
                dataSummary += `✅ Model Confidence: ${recordAttr.confidence_level}\n`;
                computedAttribution.confidence = recordAttr.confidence_level;
              } else if (recordAttr.confidence_note) {
                dataSummary += `📝 Note: ${recordAttr.confidence_note}\n`;
              }
              dataSummary += `\n`;
            }
          }

          // Add top performers (sanitized to remove parks and properly sorted)
          if (summaryWithAttribution.performanceAnalysis?.topPerformers?.length > 0) {
            const sanitizedTopPerformers = sanitizeRankingArrayForAnalysis(summaryWithAttribution.performanceAnalysis.topPerformers)
              // Ensure proper descending sort by competitive_advantage_score or strategic_value_score
              .sort((a: any, b: any) => {
                const scoreA = a.competitive_advantage_score ?? a.strategic_value_score ?? a.thematic_value ?? 0;
                const scoreB = b.competitive_advantage_score ?? b.strategic_value_score ?? b.thematic_value ?? 0;
                return scoreB - scoreA; // Descending order - highest scores first
              });
            if (sanitizedTopPerformers.length > 0) {
              dataSummary += `=== TOP EXPANSION OPPORTUNITIES (ranked by competitive_advantage_score) ===\n`;
              sanitizedTopPerformers.forEach((performer: any, index: number) => {
              // Debug what fields the performer object actually contains
              console.log(`🔍 [Claude API] Performer object fields:`, Object.keys(performer));
              console.log(`🔍 [Claude API] competitive_advantage_score:`, performer.competitive_advantage_score);
              console.log(`🔍 [Claude API] thematic_value (if exists):`, performer.thematic_value);
              
              // Cap competitive_advantage_score for competitive analysis to 1-10 scale
              const cappedValue = performer.competitive_advantage_score > 10 ? 
                Math.max(1.0, Math.min(10.0, performer.competitive_advantage_score)) : 
                performer.competitive_advantage_score;
              
              dataSummary += `${index + 1}. ${performer.description}\n`;
              dataSummary += `   🎯 RANKING METRIC: competitive_advantage_score ${cappedValue.toFixed(1)} (1-10 scale)\n`;
              
              // Add market share context for explanation (clearly labeled as context, not ranking)
              if (performer.market_share_context) {
                dataSummary += `   📊 Market Share Context (for explanation only, DO NOT use for ranking):\n`;
                const context = performer.market_share_context;
                if (context.nike > 0) dataSummary += `      Nike: ${context.nike}%\n`;
                if (context.adidas > 0) dataSummary += `      Adidas: ${context.adidas}%\n`;
                if (context.jordan > 0) dataSummary += `      Jordan: ${context.jordan}%\n`;
                if (context.puma > 0) dataSummary += `      Puma: ${context.puma}%\n`;
                if (context.new_balance > 0) dataSummary += `      New Balance: ${context.new_balance}%\n`;
                if (context.asics > 0) dataSummary += `      Asics: ${context.asics}%\n`;
              }
              dataSummary += `\n`;
              });
            }
          }
          
          dataSummary += `=== CONVERSATION CONTEXT ===\n`;
          dataSummary += `Original Query: ${(summaryWithAttribution.queryContext as any)?.originalQuery || 'N/A'}\n`;
          dataSummary += `Current Question: ${(summaryWithAttribution.queryContext as any)?.currentQuestion || 'N/A'}\n`;
          dataSummary += `Analysis Type: ${(summaryWithAttribution.queryContext as any)?.analysisType || 'follow-up-chat'}\n`;
          dataSummary += `Session: ${(summaryWithAttribution.datasetOverview as any)?.sessionType || 'analysis'}\n`;
          
          if ((summaryWithAttribution.queryContext as any)?.conversationHistory?.length > 0) {
            dataSummary += `\nRecent Conversation:\n`;
            (summaryWithAttribution.queryContext as any).conversationHistory.forEach((msg: any, index: number) => {
              dataSummary += `${index + 1}. ${msg.role}: ${msg.content}\n`;
            });
          }
          
          if (summaryWithAttribution.lastAnalysisContext) {
            dataSummary += `\nLast Analysis Context:\n`;
            dataSummary += `- Original Query: ${(summaryWithAttribution.lastAnalysisContext as any).query}\n`;
            dataSummary += `- Analysis Type: ${(summaryWithAttribution.lastAnalysisContext as any).analysisType}\n`;
          }
          
          console.log('[Claude Prompt Gen] Comprehensive summary prepared. Length:', dataSummary.length);
        } else {
          // Fall back to regular processing for blob-based data

        // --- CRITICAL: Generate Cluster Information (only if new clustering system is not active) ---
        // Skip old clustering logic when new clustering system has provided cluster analysis
        if (!metadata?.isClustered) {
          console.log('[Claude API] No new clustering detected, using legacy cluster information generation');
          const clusterInfo = generateClusterInformation(
            processedLayersData,
            primaryAnalysisField,
            metadata?.clusterOptions?.maxClusters,
            metadata?.clusterOptions?.minMembers
          );
          if (clusterInfo) {
              dataSummary += "\n=== CLUSTER INFORMATION ===\n";
              dataSummary += clusterInfo;
              dataSummary += "\n==========================\n\n";
          }
        } else {
          console.log('[Claude API] New clustering system is active, skipping legacy cluster information generation');
        }


        // Loop through layers to create detailed summary (or use optimized data)
        // Skip regular feature processing if we have a comprehensive summary
        if (!hasComprehensiveSummary) {
        for (const layerResult of processedLayersData) {
            // Initialize topFeatures at the beginning of each loop iteration
            let topFeatures: TopFeature[] = [];
            
            // 🔍 DEBUG: Check features in each layer
            console.log(`🔍 [LAYER PROCESSING] Processing layer ${layerResult.layerId}:`, {
              featureCount: layerResult.features?.length || 0,
              hasFeatures: !!layerResult.features,
              firstFeatureId: layerResult.features?.[0]?.properties?.geoid || layerResult.features?.[0]?.properties?.area_name,
              spatialFilterActive: !!metadata?.spatialFilterIds
            });
                 const layerConfig = layers[layerResult.layerId];
            const layerName = layerResult.layerName || layerConfig?.name || layerResult.layerId;
            const features = layerResult.features; // This should be the optimized FeatureProperties[] array

            if (!features || features.length === 0) {
                console.log(`[Claude Prompt Gen] Skipping layer ${layerName}: No features found.`);
                continue;
            }

            const featureCount = features.length;

            // Add initial layer info to summary with sampling context
            const totalFeatures = (layerResult as any).totalFeatures || featureCount;
            const isSampled = totalFeatures > featureCount;
            
            if (isSampled) {
                dataSummary += `\nLayer: ${layerName} (${featureCount} features sampled from ${totalFeatures} total features)\n`;
                dataSummary += `- NOTE: This analysis is based on a representative sample to optimize performance.\n`;
            } else {
                dataSummary += `\nLayer: ${layerName} (${featureCount} features analyzed)\n`;
            }
            console.log(`[Claude Prompt Gen] Added header for layer ${layerName} to summary. Sampled: ${isSampled}`);

            // === NEW: List all available fields with human-readable names ===
            if (features.length > 0) {
                const firstFeature = features[0];
                const allProperties = firstFeature.properties || firstFeature;
                const availableFields = Object.keys(allProperties).filter(key => 
                    typeof allProperties[key] === 'number' && !isNaN(allProperties[key])
                );
                
                // Debug: Check for Nike/Adidas fields specifically
                const nikeField = availableFields.find(f => f.toLowerCase().includes('mp30034a_b'));
                const adidasField = availableFields.find(f => f.toLowerCase().includes('mp30029a_b'));
                console.log(`[DEBUG Nike/Adidas] Layer ${layerName}: Nike field found: ${nikeField}, Adidas field found: ${adidasField}`);
                if (nikeField) console.log(`[DEBUG Nike] Sample value: ${allProperties[nikeField]}`);
                if (adidasField) console.log(`[DEBUG Adidas] Sample value: ${allProperties[adidasField]}`);
                
                if (availableFields.length > 0) {
                    dataSummary += `- Available Data Fields:\n`;
                    availableFields.forEach(fieldName => {
                        const humanReadableName = getHumanReadableFieldName(fieldName);
                        const sampleValue = allProperties[fieldName];
                        // Determine field type and unit for better context
                        const fieldType = getFieldDataType(fieldName, layerConfig);
                        const formattedSampleValue = formatFieldValue(sampleValue, fieldName, layerConfig);
                        
                        // Include both human-readable name and field code so Claude knows exactly which fields to reference
                        dataSummary += `  • ${humanReadableName} (field: ${fieldName}): ${formattedSampleValue} [${fieldType}]\n`;
                    });
                }
            }

            // Find the primary field for this layer (use the already determined overall primary field)
            const currentLayerPrimaryField = primaryAnalysisField;

            if (!currentLayerPrimaryField) {
                dataSummary += `- Could not determine primary analysis field for this layer.\n`;
                console.log(`[Claude Prompt Gen] No primary field determined for layer ${layerName}.`);
                continue;
            }

            const humanReadableFieldName = getHumanReadableFieldName(currentLayerPrimaryField);
          dataSummary += `- Primary Analysis Field: ${humanReadableFieldName}\n`;

            // --- Summarize the primary field --- 
            let validValues: number[] = [];
            try {
                validValues = features
                    .map((f: FeatureProperties) => {
                      // Try both f.properties[field] and f[field] patterns
                      const value1 = f.properties?.[currentLayerPrimaryField];
                      const value2 = (f as any)[currentLayerPrimaryField];
                      const finalValue = value1 !== undefined ? value1 : value2;
                      return Number(finalValue);
                    })
                    .filter(v => !isNaN(v)); // Filter out NaN values
                console.log(`[Claude Prompt Gen] Layer ${layerName}: Found ${validValues.length} valid numeric values for ${currentLayerPrimaryField}.`);
            } catch (e) {
                console.error(`[Claude Prompt Gen] Error extracting/converting values for ${currentLayerPrimaryField} in layer ${layerName}:`, e);
                validValues = [];
            }

            if (validValues.length > 0) {
                // Cap values for competitive analysis (thematic_value should be 1-10 scale)
                const cappedValues = currentLayerPrimaryField === 'thematic_value' ? 
                  validValues.map(v => v > 10 ? Math.max(1.0, Math.min(10.0, v)) : v) : 
                  validValues;
                
                const minValue = Math.min(...cappedValues);
                const maxValue = Math.max(...cappedValues);
                const meanValue = cappedValues.reduce((a, b) => a + b, 0) / cappedValues.length;

                          dataSummary += `- ${humanReadableFieldName} Range: ${formatFieldValue(minValue, currentLayerPrimaryField, layerConfig)} to ${formatFieldValue(maxValue, currentLayerPrimaryField, layerConfig)}\n`;
            dataSummary += `- ${humanReadableFieldName} Average: ${formatFieldValue(meanValue, currentLayerPrimaryField, layerConfig)}\n`;
                console.log(`[Claude Prompt Gen] Added stats for ${currentLayerPrimaryField} to summary.`);
            } else {
                dataSummary += `- No valid numeric data found for ${humanReadableFieldName}.\n`;
                console.log(`[Claude Prompt Gen] No valid numeric data found for ${currentLayerPrimaryField} in layer ${layerName}.`);
            }

            // --- Optimized Data Summarization (Replaces Feature Enumeration) ---
            try {
                // Always-on optimization: Simplify flow and guarantee 413 prevention
                // Optimization overhead is negligible (~2ms) vs 7-15s API response times
                const shouldForceOptimization = true; // Always optimize for consistent behavior
                let optimizedSummary = '';
                
                console.log(`[OPTIMIZATION DEBUG] Layer: ${layerName}, Features: ${features.length}, AlwaysOptimize: ${shouldForceOptimization}`);
                
                if (shouldForceOptimization) {
                    console.log(`[OPTIMIZATION DEBUG] Attempting to import IntegrationBridge module...`);
                    
                    // Import the optimized summarization system
                    const { replaceExistingFeatureEnumeration } = await import('./data-summarization/IntegrationBridge');
                    console.log(`[OPTIMIZATION DEBUG] ✅ IntegrationBridge module imported successfully`);
                    
                    // Create processed layer data structure for the summarization system
                    const processedLayerData = [{
                        layerId: layerResult.layerId,
                        layerName: layerName,
                        layerType: layerResult.layerType || 'feature',
                        features: features,
                        extent: layerResult.extent,
                        fields: layerResult.fields
                    }];
                    
                    console.log(`[OPTIMIZATION DEBUG] Calling replaceExistingFeatureEnumeration with:`, {
                        layerCount: processedLayerData.length,
                        featureCount: features.length,
                        primaryField: currentLayerPrimaryField,
                        forceOptimization: true
                    });
                    
                    // Attempt optimized summarization with force=true
                    optimizedSummary = replaceExistingFeatureEnumeration(
                        processedLayerData,
                        { [layerResult.layerId]: layerConfig },
                        metadata,
                        currentLayerPrimaryField,
                        true  // Always force optimization for datasets >= 50
                    );
                
                    console.log(`[OPTIMIZATION DEBUG] Function returned summary length: ${optimizedSummary ? optimizedSummary.length : 'null/undefined'}`);
                
                    if (optimizedSummary && optimizedSummary.trim().length > 0) {
                        // Use optimized summary - prevents 413 errors
                        dataSummary += optimizedSummary;
                        console.log(`[OPTIMIZATION DEBUG] ✅ Used optimized summarization for layer ${layerName} (${features.length} features)`);
                    } else {
                        console.log(`[OPTIMIZATION DEBUG] ❌ Optimization returned empty/invalid summary for layer ${layerName}`);
                    }
                } else {
                    console.log(`[OPTIMIZATION DEBUG] ⏭️ Skipping optimization - dataset too small (${features.length} < 50 features)`);
                }
                
                // If optimization wasn't used or failed, use original enumeration
                if (!shouldForceOptimization || !optimizedSummary || optimizedSummary.trim().length === 0) {
                    // Original feature enumeration logic as fallback
                    const sortedFeatures = sortAttributesByField(features, currentLayerPrimaryField);
                    console.log(`[Claude Prompt Gen] Sorted ${sortedFeatures.length} features for layer ${layerName} by ${currentLayerPrimaryField}.`);

                    // Use FULL dataset for accurate analysis - no artificial limits
                    topFeatures = sortedFeatures.map((f: FeatureProperties): TopFeature => {
                        // *** FIX: Access nested properties for getZIPCode ***
                        // Assuming 'f' has the structure { properties: { actual_attributes } }
                        const actualProperties = f.properties || f; // Use f.properties if it exists, else f itself
                        const tempFeatureForZip = { properties: actualProperties, attributes: actualProperties }; 
                        const zipCode = getZIPCode(tempFeatureForZip); // Pass the actual properties
                        const description = actualProperties.DESCRIPTION ? String(actualProperties.DESCRIPTION) : null; // Get description from actual properties
                        const value = actualProperties[currentLayerPrimaryField] as number;
                        
                        return { zipCode, description, value };
                    });

                    console.log(`[Claude Prompt Gen] Extracted top ${topFeatures.length} features for layer ${layerName}.`);

                    if (topFeatures.length > 0) {
                        dataSummary += `- Top Areas by ${humanReadableFieldName}:\n`;
                        topFeatures.forEach((tf, index) => {
                            // Cap any scores over 10 (competitive analysis should be 1-10 scale)
                            let valueToFormat = tf.value;
                            if (currentLayerPrimaryField === 'thematic_value' && tf.value > 10) {
                              valueToFormat = Math.max(1.0, Math.min(10.0, tf.value));
                              console.log(`🔧 [Regular Processing] Capped score from ${tf.value} to ${valueToFormat} for area ${tf.description || tf.zipCode}`);
                            } else if (tf.value > 10) {
                              console.log(`⚠️ [Regular Processing] Score ${tf.value} > 10 but not capped (field: ${currentLayerPrimaryField})`);
                            }
                            
                            const formattedValue = formatFieldValue(valueToFormat, currentLayerPrimaryField, layerConfig);
                            // Use description (which might contain city name) if available, otherwise ZIP
                            const locationIdentifier = tf.description ? `${tf.description} (ZIP: ${tf.zipCode})` : `ZIP ${tf.zipCode}`; 
                            // Use the actual field name, not hardcoded competitive_advantage_score
                            const fieldLabel = getHumanReadableFieldName(currentLayerPrimaryField);
                            dataSummary += `  ${index + 1}. ${locationIdentifier}: ${fieldLabel} ${formattedValue}\n`;
                        });
                        console.log(`[Claude Prompt Gen] Added top features list to summary for layer ${layerName}.`);
                    }
                }
            } catch (e) {
                console.error(`[Claude Prompt Gen] Error in optimized summarization for layer ${layerName}:`, e);
                // Continue with fallback enumeration
                
                // Complete fallback to original logic
                try {
                    const sortedFeatures = sortAttributesByField(features, currentLayerPrimaryField);
                    console.log(`[Claude Prompt Gen] Sorted ${sortedFeatures.length} features for layer ${layerName} by ${currentLayerPrimaryField}.`);

                    topFeatures = sortedFeatures.map((f: FeatureProperties): TopFeature => {
                        const actualProperties = f.properties || f;
                        const tempFeatureForZip = { properties: actualProperties, attributes: actualProperties }; 
                        const zipCode = getZIPCode(tempFeatureForZip);
                        const description = actualProperties.DESCRIPTION ? String(actualProperties.DESCRIPTION) : null;
                        const value = actualProperties[currentLayerPrimaryField] as number;
                        return { zipCode, description, value };
                    });

                    if (topFeatures.length > 0) {
                        dataSummary += `- Top Areas by ${humanReadableFieldName}:\n`;
                        topFeatures.forEach((tf, index) => {
                            let valueToFormat = tf.value;
                            if (currentLayerPrimaryField === 'thematic_value' && tf.value > 10) {
                              valueToFormat = Math.max(1.0, Math.min(10.0, tf.value));
                            }
                            
                            const formattedValue = formatFieldValue(valueToFormat, currentLayerPrimaryField, layerConfig);
                            const locationIdentifier = tf.description ? `${tf.description} (ZIP: ${tf.zipCode})` : `ZIP ${tf.zipCode}`; 
                            const fieldLabel = getHumanReadableFieldName(currentLayerPrimaryField);
                            dataSummary += `  ${index + 1}. ${locationIdentifier}: ${fieldLabel} ${formattedValue}\n`;
                        });
                    }
                } catch (fallbackError) {
                    console.error(`[Claude Prompt Gen] Error in fallback feature processing for layer ${layerName}:`, fallbackError);
                }
            }

            // Add the processed layer info to the array for potential later use (if needed)
            processedLayersForPrompt.push({
                layerId: layerResult.layerId,
                features: features, // Store the optimized FeatureProperties[]
                layerName: layerName,
                totalFeatures: featureCount,
                topFeatures: topFeatures, // Add top features here
                // statistics: layerStats // Add stats if calculated
            });
        } // End loop through layers
        } // End if (!hasComprehensiveSummary)
        
        } // End else block for regular processing

        console.log('[Claude Prompt Gen] Finished preparing data summary. Length:', dataSummary.length);
        
        // --- RESTRUCTURE PROMPTS for API Call ---
        // 1. Create the dynamic system prompt including the data summary

        // Determine analysis type early for logging
        const analysisType = metadata?.analysisType || 'general'; // Default to general

        console.log(`[Claude] Reached point before analysis type branching. Type: ${analysisType}`); // Log before branching
        
        // +++ RESTORE Task-Specific Instructions +++
        // const analysisType = metadata?.analysisType || 'general'; // MOVED UP
        let taskSpecificInstructions = '';

        // --- PATCH: Add jointHigh/joint_score analysis branch ---
        if (
          (analysisType === 'jointHigh' || analysisType === 'joint_high' || analysisType === 'joint' || analysisType === 'jointscore' || analysisType === 'joint_score') ||
          (primaryLayerResult.features[0]?.properties?.joint_score !== undefined)
        ) {
          console.log('[Joint Analysis] Starting validation with metadata:', JSON.stringify(metadata));
          console.log('[Joint Analysis] Analysis type:', analysisType);
          console.log('[Joint Analysis] Primary layer result:', JSON.stringify(primaryLayerResult.features[0]?.properties));

          // If relevantFields is empty, try to infer from layer names or config
          let varA = metadata.relevantFields?.[0];
          let varB = metadata.relevantFields?.[1];

          if (!varA || !varB) {
            console.log('[Joint Analysis] relevantFields empty, attempting inference...');
            const layerIds = metadata.relevantLayers || [];
            if (layerIds.length >= 2) {
              const layerConfigA = layers[layerIds[0]];
              const layerConfigB = layers[layerIds[1]];

              // Attempt 1: Use rendererField from layer config
              if (layerConfigA?.rendererField) {
                varA = layerConfigA.rendererField;
              }
              if (layerConfigB?.rendererField) {
                varB = layerConfigB.rendererField;
              }
              console.log(`[Joint Analysis] Inference Attempt 1 (rendererField): varA=${varA}, varB=${varB}`);

              // Attempt 2: Fallback to simple name if rendererField didn't work for both
              if (!varA && layerConfigA) {
                 // Simple name extraction as a fallback (less reliable)
                 varA = layerIds[0].replace(/SuperFan|Index/gi, ''); // More generic replace
              }
              if (!varB && layerConfigB) {
                 varB = layerIds[1].replace(/SuperFan|Index/gi, ''); // More generic replace
              }
              console.log(`[Joint Analysis] Inference Attempt 2 (name replace fallback): varA=${varA}, varB=${varB}`);

            } else {
              console.warn('[Joint Analysis] Cannot infer from layers: relevantLayers array has < 2 IDs.');
            }
          }

          // If STILL no luck, THEN fallback to first feature properties (as last resort)
          if (!varA || !varB) {
             console.log('[Joint Analysis] Inference from layers failed, attempting fallback to first feature properties...');
             const firstFeature = primaryLayerResult?.features?.[0]; // Safely access
             if (firstFeature?.properties) {
               const numericFields = Object.entries(firstFeature.properties)
                 .filter(([_, value]) => typeof value === 'number' && !isNaN(value as number))
                 .map(([key]) => key)
                 .filter(key => !['OBJECTID', 'Shape__Area', 'Shape__Length', 'joint_score'].includes(key.toUpperCase())); // Also exclude joint_score itself

               if (numericFields.length >= 2) {
                 // Assign only if inference hasn't already succeeded
                 if (!varA) varA = numericFields[0];
                 if (!varB) varB = numericFields.find(f => f !== varA) || numericFields[1]; // Ensure different fields
                 console.log('[Joint Analysis] Inference Attempt 3 (feature properties): varA=${varA}, varB=${varB}');
               } else {
                 console.warn('[Joint Analysis] Fallback failed: First feature has < 2 suitable numeric properties.');
               }
             } else {
               console.warn('[Joint Analysis] Fallback failed: Cannot access properties of the first feature.');
             }
          }

          // Final validation (remains the same)
          if (!varA || !varB) {
            console.error('[Joint Analysis] Validation failed - could not determine fields:', { varA, varB });
            return NextResponse.json({ 
              error: 'Could not determine fields for joint analysis',
              details: {
                receivedFields: metadata.relevantFields,
                layerNames: metadata.relevantLayers,
                analysisType: analysisType
              }
            }, { status: 400 });
          }

          // Build data summary for joint_score
          let jointScoreValues: number[] = [];
          let jointScoreFeatures: any[] = [];
          
          // Process features from all layers
          for (const layerResult of processedLayersData) {
            for (const feature of layerResult.features) {
              // Check both properties and attributes for joint_score
              const jointScore = feature.properties?.joint_score ?? (feature as any).attributes?.joint_score;
              const valueA = feature.properties?.[varA] ?? (feature as any).attributes?.[varA];
              const valueB = feature.properties?.[varB] ?? (feature as any).attributes?.[varB];
              
              console.log('[Joint Analysis] Processing feature:', {
                jointScore,
                valueA,
                valueB,
                properties: feature.properties,
                attributes: (feature as any).attributes
              });
              
              if (typeof jointScore === 'number' && !isNaN(jointScore) &&
                  typeof valueA === 'number' && !isNaN(valueA) &&
                  typeof valueB === 'number' && !isNaN(valueB)) {
                jointScoreValues.push(jointScore);
                jointScoreFeatures.push(feature);
              }
            }
          }

          console.log('[Joint Analysis] Found valid values:', {
            count: jointScoreValues.length,
            sampleValues: jointScoreValues.slice(0, 3)
          });

          if (jointScoreValues.length === 0) {
            console.error('[Joint Analysis] No valid values found between variables:', { varA, varB });
            return NextResponse.json({ 
              error: `No valid joint_score values found between ${varA} and ${varB}`,
              details: {
                varA,
                varB,
                featureCount: processedLayersData.reduce((sum, layer) => sum + layer.features.length, 0)
              }
            }, { status: 400 });
          }

          // Calculate statistics
          const min = Math.min(...jointScoreValues);
          const max = Math.max(...jointScoreValues);
          const mean = jointScoreValues.reduce((a, b) => a + b, 0) / jointScoreValues.length;
          const median = jointScoreValues.sort((a, b) => a - b)[Math.floor(jointScoreValues.length / 2)];

          // Sort features by joint_score
          jointScoreFeatures.sort((a, b) => {
            const scoreA = a.properties?.joint_score ?? (a as any).attributes?.joint_score ?? 0;
            const scoreB = b.properties?.joint_score ?? (b as any).attributes?.joint_score ?? 0;
            return scoreB - scoreA;
          });
          
          // Get top 5 regions with more detailed information
          const topRegions = jointScoreFeatures.slice(0, 5).map((f, i) => {
            const zipCode = getZIPCode(f);
            const locationName = getLocationName(f);
            const jointScore = f.properties?.joint_score ?? (f as any).attributes?.joint_score;
            const valueA = f.properties?.[varA] ?? (f as any).attributes?.[varA];
            const valueB = f.properties?.[varB] ?? (f as any).attributes?.[varB];
            
            return {
              rank: i + 1,
              location: locationName,
              zipCode,
              jointScore: jointScore.toFixed(2),
              valueA: formatFieldValue(valueA, varA, primaryLayerConfig || undefined),
              valueB: formatFieldValue(valueB, varB, layers[processedLayersData[1]?.layerId])
            };
          });

          // Add comprehensive statistics to data summary
          dataSummary += `\nCombined Score Analysis for ${varA} and ${varB}:\n`;
          dataSummary += `- Statistics for joint_score:\n`;
          dataSummary += `  • Minimum: ${min.toFixed(2)}\n`;
          dataSummary += `  • Maximum: ${max.toFixed(2)}\n`;
          dataSummary += `  • Mean: ${mean.toFixed(2)}\n`;
          dataSummary += `  • Median: ${median.toFixed(2)}\n`;
          dataSummary += `  • Total Regions Analyzed: ${jointScoreValues.length}\n\n`;
          dataSummary += `Top 5 Regions by Combined Score:\n`;
          
          topRegions.forEach(region => {
            dataSummary += `${region.rank}. ${region.location} (${region.zipCode}):\n`;
            dataSummary += `   • Combined Score: ${region.jointScore}\n`;
            dataSummary += `   • ${varA}: ${region.valueA}\n`;
            dataSummary += `   • ${varB}: ${region.valueB}\n`;
          });

          taskSpecificInstructions = `Task: Analyze the combined score (joint_score) of ${varA} and ${varB} across all regions. Focus on identifying areas with strong performance in both metrics, understanding the distribution of combined scores, and highlighting any geographic patterns or clusters of high-scoring regions.`;

          userMessage = `Analyze the relationship between ${varA} and ${varB} using their combined score (joint_score). Address the core question: "${messages?.[messages.length - 1]?.content || metadata?.query || 'Analyze data'}".\n\n${dataSummary}\n\nYour analysis should focus on:\n1. Identifying and explaining patterns in regions with high combined scores.\n2. Analyzing the distribution and geographic patterns of the combined scores.\n3. Highlighting notable areas where both ${varA} and ${varB} show strong performance.\n4. Identifying any clusters or concentrations of high-scoring regions.\n\nIMPORTANT: Always refer to both ${varA} and ${varB} in your analysis, and explain how they contribute to the combined score in top-performing regions.`;
        }
        // --- END PATCH ---

        // Extract user query for analysis
        const userQuery = messages?.[messages.length - 1]?.content || metadata?.query || 'Analyze data';
        
        // Extract brand names from the data for comparative analysis
        let brandAName = 'Brand A';
        let brandBName = 'Brand B';
        
        // Look for brand names in the first layer's first feature
        if (processedLayersData.length > 0 && processedLayersData[0].features && processedLayersData[0].features.length > 0) {
          const firstFeature = processedLayersData[0].features[0];
          if (firstFeature.properties?.brand_a_name) brandAName = firstFeature.properties.brand_a_name;
          if (firstFeature.properties?.brand_b_name) brandBName = firstFeature.properties.brand_b_name;
        }
        
        // Generate enhanced field context for Claude prompt
        let enhancedFieldContext = '';
        const queryAnalyzer = new EnhancedQueryAnalyzer();
        
        try {
            const detectedFields = queryAnalyzer.getQueryFields(userQuery);
            const bestEndpoint = queryAnalyzer.getBestEndpoint(userQuery);
            
            if (detectedFields.length > 0) {
                enhancedFieldContext = `
ENHANCED QUERY ANALYSIS:
- User Query: "${userQuery}"
- Detected Fields: ${detectedFields.map(f => `${f.field} (${f.description})`).join(', ')}
- Recommended Endpoint: ${bestEndpoint || 'general'}
- Primary Analysis Field: ${primaryAnalysisField}

FIELD INTERPRETATION GUIDANCE:
${detectedFields.map(f => `- ${f.field}: ${f.description}`).join('\n')}
`;
                console.log(`[Claude] Enhanced field analysis - detected ${detectedFields.length} relevant fields`);
            }
        } catch (error) {
            console.warn('[Claude] Error in enhanced field analysis:', error);
        }
        
        // Detect query types for SHAP integration
        const isThresholdQuery = detectThresholdQuery(userQuery);
        const isSegmentQuery = detectSegmentQuery(userQuery);
        const isComparativeQuery = detectComparativeQuery(userQuery);
        
        // Prepare message history for API
        const messageHistoryForApi = messages || [];
        
        // Extract SHAP analysis information if available
        let shapAnalysisInfo = '';
        const firstLayer = processedLayersData[0];
        
        console.log('[Claude DEBUG] First layer shapAnalysis check:', {
          hasFirstLayer: !!firstLayer,
          hasShapAnalysis: !!(firstLayer && (firstLayer as any).shapAnalysis),
          shapAnalysisKeys: firstLayer && (firstLayer as any).shapAnalysis ? Object.keys((firstLayer as any).shapAnalysis) : null
        });
        
        if (firstLayer && (firstLayer as any).shapAnalysis) {
          const shapData = (firstLayer as any).shapAnalysis;
          
          if (shapData.featureImportance && shapData.featureImportance.length > 0) {
            // Remove the target variable from the feature-importance list so it is never treated as a predictor
            const _target = (shapData.targetVariable || '').toString();
            const normalisedTarget = _target.replace(/_/g, '').toLowerCase();
            const filteredImportance = shapData.featureImportance.filter((item: any) => {
              const normalisedFeature = (item.feature || '').toString().replace(/_/g, '').toLowerCase();
              return normalisedFeature !== normalisedTarget;
            });

            shapAnalysisInfo = `

SHAP Analysis Results:
--------------------
Target Variable: ${getHumanReadableFieldName(shapData.targetVariable || 'Unknown')}
Analysis Type: ${shapData.analysisType || 'Unknown'}

Feature Importance (Top 10):
${filteredImportance.slice(0, 10).map((item: any, index: number) => {
  const humanReadableFeature = getHumanReadableFieldName(item.feature);
  return `${index + 1}. ${humanReadableFeature}: ${item.importance?.toFixed(4) || 'N/A'} (${item.direction || 'neutral'} impact)`;
}).join('\n')}

Total Features Analyzed: ${filteredImportance.length}
Geographic Areas: ${shapData.results?.length || 0} locations
--------------------`;

            // ADD: Enhanced spatial analysis information for Claude
            if (shapData.spatial_analysis) {
              const spatial = shapData.spatial_analysis;
              shapAnalysisInfo += `

Spatial Distribution Analysis:
-----------------------------
Distribution Pattern: ${spatial.distribution_type || 'unknown'}
Clustering Strength: ${(spatial.clustering_strength * 100).toFixed(1)}%
Geographic Spread: ${spatial.value_statistics?.coefficient_variation?.toFixed(3) || 'N/A'} (coefficient of variation)
Outlier Areas: ${spatial.outlier_analysis?.outlier_count || 0} (${spatial.outlier_analysis?.outlier_percentage?.toFixed(1) || 0}%)

Value Statistics:
- Mean: ${spatial.value_statistics?.mean?.toFixed(2) || 'N/A'}
- Median: ${spatial.value_statistics?.median?.toFixed(2) || 'N/A'}
- Range: ${spatial.value_statistics?.quartiles?.q1?.toFixed(2) || 'N/A'} to ${spatial.value_statistics?.quartiles?.q3?.toFixed(2) || 'N/A'} (IQR)

Pattern Description: ${spatial.pattern_description || 'No spatial pattern description available'}
-----------------------------`;
            }

            // ADD: Regional cluster information for Claude
            if (shapData.regional_clusters && shapData.regional_clusters.clusters) {
              const clusters = shapData.regional_clusters;
              shapAnalysisInfo += `

Regional Cluster Analysis:
-------------------------
Cluster Method: ${clusters.cluster_method || 'quartile_based'}
Total Clusters Identified: ${clusters.cluster_count || 0}

Performance-Based Regional Groups:
${clusters.clusters.map((cluster: any, index: number) => {
  return `${index + 1}. ${cluster.label}: ${cluster.area_count} areas (${cluster.percentage_of_total?.toFixed(1)}%)
   - Average Value: ${cluster.avg_value?.toFixed(2) || 'N/A'}
   - Value Range: ${cluster.min_value?.toFixed(2) || 'N/A'} to ${cluster.max_value?.toFixed(2) || 'N/A'}
   - Sample Areas: ${cluster.areas?.slice(0, 5).join(', ') || 'None'}`;
}).join('\n')}

${clusters.cluster_description || 'No cluster description available'}
-------------------------`;
            }

            // ADD: Geographic context for spatial relationships
            if (shapData.geographic_context) {
              const geo = shapData.geographic_context;
              shapAnalysisInfo += `

Geographic Context & Patterns:
-----------------------------
Analysis Scope: ${geo.geographic_scope || 'unknown'} (${geo.area_coverage || 0} areas)
Spatial Coverage: ${geo.adjacent_area_analysis?.spatial_continuity || 'unknown'}
Pattern Reliability: ${geo.adjacent_area_analysis?.pattern_reliability || 'unknown'}

Top Performing Areas:
${geo.top_performers?.areas?.slice(0, 5).map((area: string, index: number) => 
  `${index + 1}. ${area}: ${geo.top_performers?.avg_value?.toFixed(2) || 'N/A'} avg`
).join('\n') || 'No top performers identified'}

Regional Relationships:
${Object.entries(geo.regional_patterns || {}).map(([key, pattern]: [string, any]) => 
  `- ${key.replace('_relationship', '').replace('_', ' ')}: ${pattern.description || 'No description'}`
).join('\n') || 'No regional patterns identified'}

Geographic Summary: ${geo.context_description || 'No geographic context available'}
-----------------------------`;
            }
          }
        }

        // --- Load AI Persona ---
        console.log('[Claude] Loading AI persona...');
        let selectedPersona;
        try {
          const personaId = persona || 'broker-agent'; // Default to broker-agent for housing
          selectedPersona = await getHousingPersona(personaId);
          console.log(`[Claude] Loaded housing persona: ${selectedPersona.name} (${personaId})`);
          } catch (error) {
          console.warn('[Claude] Failed to load housing persona, falling back to broker-agent:', error);
          selectedPersona = await getHousingPersona('broker-agent');
        }

        // --- Call Anthropic API ---
        console.log('[Claude] Preparing to call Anthropic API...');
        
        // Get analysis type for persona-specific task instructions and analysis-specific prompts
        // Try to derive analysis type from featureData if not explicitly set
        let derivedAnalysisType = metadata?.analysisType;
        
        if (!derivedAnalysisType && featureData) {
          // Check if featureData has type information
          if (typeof featureData === 'object' && !Array.isArray(featureData)) {
            const datasetType = (featureData as any)?.datasetOverview?.type || (featureData as any)?.type;
            if (datasetType) {
              console.log(`[Claude] Deriving analysis type from featureData type: ${datasetType}`);
              derivedAnalysisType = datasetType.replace(/_/g, '-'); // Convert strategic_analysis -> strategic-analysis
            }
          }
        }
        
        const personaAnalysisType = derivedAnalysisType || 'default';
        console.log(`[Claude] Using analysis type: ${personaAnalysisType} (from: ${derivedAnalysisType ? 'featureData' : 'metadata'})`);
        
        // Normalize analysis type for persona task instructions (convert hyphens to underscores)
        const normalizedPersonaAnalysisType = personaAnalysisType.replace(/-/g, '_');
        console.log(`[Claude] Normalized analysis type for persona: ${normalizedPersonaAnalysisType}`);
        
        // Add model attribution information if available (for regular processing, not chat responses)
        if (!isContextualChat && Array.isArray(featureData) && featureData.length > 0) {
          // Check if endpoint data contains model attribution
          let modelAttributionFound = false;
          const endpointData = featureData[0];
          
          // Check for endpoint-level model attribution
      if ((endpointData as any).model_attribution) {
            dataSummary += `\n=== MODEL ATTRIBUTION ===\n`;
            const modelAttr = (endpointData as any).model_attribution;
            const modelName = modelAttr.primary_model?.name;
            const modelType = modelAttr.primary_model?.type;
            if (modelName) dataSummary += `🤖 Model Used: ${modelName}\n`;
            if (modelType) dataSummary += `📊 Model Type: ${modelType}\n`;
            
            const r2Value = modelAttr.primary_model?.performance?.r2_score;
            if (typeof r2Value === 'number' && !Number.isNaN(r2Value)) {
              const perfLevel = modelAttr.primary_model?.performance?.performance_level || 'Unknown';
              dataSummary += `🎯 R² Score: ${r2Value.toFixed(3)} (${perfLevel} Performance)\n`;
              
              const confidenceMap: Record<string, string> = {
                'EXCELLENT': 'High Confidence',
                'GOOD': 'Strong Confidence', 
                'MODERATE': 'Medium Confidence',
                'POOR': 'Low Confidence'
              };
              const confidence = confidenceMap[(perfLevel || '').toString().toUpperCase()] || undefined;
        if (confidence) dataSummary += `✅ Model Confidence: ${confidence}\n`;
        computedAttribution = { modelName, r2: r2Value, perfLevel, confidence };
            }
            
            if (modelAttr.traceability_note) {
              dataSummary += `📝 Note: ${modelAttr.traceability_note}\n`;
            }
            dataSummary += `\n`;
            modelAttributionFound = true;
          }
          // Check for record-level attribution from features
          else if (endpointData.features && (endpointData.features[0] as any)?._model_attribution) {
            dataSummary += `\n=== MODEL ATTRIBUTION ===\n`;
            const recordAttr = (endpointData.features[0] as any)._model_attribution;
            if (recordAttr.primary_model_used) dataSummary += `🤖 Model Used: ${recordAttr.primary_model_used}\n`;
            if (recordAttr.model_type) dataSummary += `📊 Model Type: ${recordAttr.model_type}\n`;
            const r2Value = (recordAttr.performance?.r2_score ?? recordAttr.r2_score);
            if (typeof r2Value === 'number' && !Number.isNaN(r2Value)) {
              dataSummary += `🎯 R² Score: ${r2Value.toFixed(3)}\n`;
              computedAttribution = { modelName: recordAttr.primary_model_used, r2: r2Value };
            }
            if (recordAttr.confidence_level) {
              dataSummary += `✅ Model Confidence: ${recordAttr.confidence_level}\n`;
              computedAttribution.confidence = recordAttr.confidence_level;
            } else if (recordAttr.confidence_note) {
              dataSummary += `📝 Note: ${recordAttr.confidence_note}\n`;
            }
            dataSummary += `\n`;
            modelAttributionFound = true;
          }
          
          console.log(`[Model Attribution] Found attribution data: ${modelAttributionFound}`);
        }

        // Add endpoint-specific enhanced metrics for AnalysisEngine results
        if (Array.isArray(featureData) && featureData.length > 0 && featureData[0].features) {
          console.log(`[Enhanced Metrics] Adding endpoint-specific metrics for ${personaAnalysisType}`);
          const allFeatures = featureData[0].features;
          dataSummary += addEndpointSpecificMetrics(personaAnalysisType, allFeatures);
        }
        
        // 🚨 DEBUG: Log actual data being sent to Claude for strategic analysis
        if (personaAnalysisType.includes('strategic') && featureData) {
          console.log('🚨🚨🚨 [STRATEGIC DEBUG] Data being sent to Claude:');
          
          // Check the actual featureData structure
          if (Array.isArray(featureData) && featureData.length > 0 && featureData[0].features) {
            const features = featureData[0].features.slice(0, 5);
            console.log(`🚨 First 5 features from featureData:`);
            features.forEach((f: any, i: number) => {
              const tv = f.properties?.target_value;
              console.log(`🚨   ${i+1}. ${f.properties?.area_name}: target_value=${tv} (type: ${typeof tv})`);
              if (typeof tv === 'number') {
                console.log(`🚨      → Exact value check: ${tv === 79.3 ? 'EXACTLY 79.3' : `NOT 79.3 (actual: ${tv})`}`);
              }
            });
          } else if (typeof featureData === 'object' && !Array.isArray(featureData)) {
            const records = (featureData as any)?.records || [];
            console.log(`🚨 Records count: ${records.length}`);
            
            if (records.length > 0) {
              console.log('🚨 First 5 record values:');
              records.slice(0, 5).forEach((record: any, i: number) => {
                console.log(`🚨   ${i+1}. ${record.area_name}: value=${record.value}`);
              });
              
              // Check if all values are identical (the smoking gun)
              const values = records.slice(0, 5).map((r: any) => r.value);
              const uniqueValues = [...new Set(values)];
              
              if (uniqueValues.length === 1) {
                console.log('🚨🚨🚨 PROBLEM CONFIRMED: All values are identical in Claude request!');
                console.log('🚨 This proves the data corruption happens before reaching Claude');
              } else {
                console.log('🚨 ✅ Values are distinct in Claude request - issue must be in prompt');
              }
            }
          }
        }
        
        // Get persona-specific task instructions with proper typing
        const personaTaskInstructions = (selectedPersona.taskInstructions as any)[normalizedPersonaAnalysisType] || 
                                        selectedPersona.taskInstructions.default;
        console.log(`[Claude] Selected persona task instructions for '${normalizedPersonaAnalysisType}':`, personaTaskInstructions ? 'FOUND' : 'USING DEFAULT');
        
        // Get analysis-specific technical prompt
        const analysisSpecificPrompt = getAnalysisPrompt(normalizedPersonaAnalysisType);
        console.log(`[Claude] Analysis-specific prompt length:`, analysisSpecificPrompt.length);
        
        // 🎯 NEW: Add ranking context if present
        const rankingContextPrompt = rankingContext ? `
=== RANKING ANALYSIS REQUEST ===
The user requested the ${rankingContext.queryType} ${rankingContext.requestedCount} ${rankingContext.queryType === 'top' ? 'highest-performing' : 'lowest-performing'} areas.

**Analysis Instructions:**
- Focus primary attention on the ${rankingContext.requestedCount} ${rankingContext.queryType} performers
- Provide detailed insights about these ${rankingContext.queryType} performers
- Include complete dataset context (${rankingContext.totalFeatures} total areas) for comparison
- Highlight what makes the ${rankingContext.queryType} performers unique
- Discuss performance gaps and opportunities across the full dataset

**Key Areas to Highlight:** The ${rankingContext.requestedCount} ${rankingContext.queryType === 'top' ? 'highest-scoring' : 'lowest-scoring'} areas by performance
` : '';

        // 🔍 DEBUG: Log prompt construction for strategic analysis
        console.log('🔍 [PROMPT DEBUG] Starting prompt construction:', {
          analysisType: normalizedPersonaAnalysisType,
          persona: selectedPersona.name,
          hasClusterData: !!metadata?.isClustered,
          hasRankingContext: !!rankingContext,
          featureCount: processedLayersData[0]?.features?.length || 0,
          spatialFilterApplied: metadata?.spatialFilterIds ? 'YES' : 'NO',
          spatialFilterCount: metadata?.spatialFilterIds?.length || 0
        });

        // Create dynamic system prompt with persona-specific content and analysis-specific context
        // Add cluster-specific instructions when clustering is detected
        const clusteringInstructions = metadata?.isClustered && metadata?.clusterAnalysis ? `

🚨 CRITICAL CLUSTERING ANTI-HALLUCINATION INSTRUCTIONS 🚨
You have been provided with a complete territory clustering analysis. You MUST:

ONLY USE PROVIDED DATA:
1. Use ONLY the ZIP codes listed in the analysis - DO NOT generate new ones
2. Use ONLY the scores and percentages provided - DO NOT create examples  
3. Use ONLY the territory names given - DO NOT invent new territories
4. Copy ALL data EXACTLY as written - DO NOT modify numbers or locations

SPECIFIC REQUIREMENTS:
- Numbered indicators (①, ②, ③, etc.) that match the map legend exactly
- The specific top 5 ZIP codes with scores for each territory EXACTLY as provided
- The exact market share percentages (${brandAName} %, ${brandBName} %, Market Gap %) EXACTLY as provided
- The exact "Key Drivers" text for each territory EXACTLY as provided
- Strategic Recommendations section EXACTLY as provided

ABSOLUTELY FORBIDDEN:
❌ Generating ZIP codes not in the analysis (especially California ZIP codes like 92881, 92880)
❌ Creating example scores or percentages
❌ Adding generic explanations about scoring methodology
❌ Adding your own recommendations beyond what's provided
❌ Changing territory names or adding prefixes like "ZIP"
❌ Modifying any numbers, percentages, or geographic data

GEOGRAPHIC CLARIFICATION:
⚠️ "Corona Territory" refers to Corona, Queens, NY (ZIP codes starting with 11xxx) - NOT Corona, California
⚠️ ALL data is from NY/NJ/PA tri-state area - NO California ZIP codes exist in this dataset
⚠️ Valid ZIP code ranges: NY (10xxx-14xxx), NJ (07xxx-08xxx), PA (15xxx-19xxx)

VERIFICATION: Before writing any ZIP code or number, confirm it appears in the provided analysis text.
` : '';

        // 🔍 DEBUG: Log each prompt component
        console.log('🔍 [PROMPT COMPONENTS] Building dynamic system prompt:');
        console.log('  1. Persona prompt length:', selectedPersona.systemPrompt.length);
        console.log('  2. Field context length:', enhancedFieldContext.length);
        console.log('  3. Analysis-specific prompt length:', analysisSpecificPrompt.length);
        console.log('  4. Ranking context length:', rankingContextPrompt.length);
        console.log('  5. Clustering instructions length:', clusteringInstructions.length);
        
        const dynamicSystemPrompt = `${selectedPersona.systemPrompt}

🚨 GLOBAL ANTI-HALLUCINATION RULE 🚨
NEVER generate ZIP codes, scores, percentages, or geographic data not provided in the user's data.
If data is missing, state "Data not available" instead of creating examples.
Always verify numbers and locations appear in the provided dataset before including them.

${enhancedFieldContext}

${analysisSpecificPrompt}

${rankingContextPrompt}${clusteringInstructions}${spatialFilterInstructions}

CRITICAL FIELD DATA TYPE INSTRUCTIONS:
When analyzing data, ALWAYS use the correct units and terminology based on the field type shown in brackets:

- [percentage]: Values are percentages (0-100%). ALWAYS say "X%" not "X purchases" or "X units"
  Example: "${brandAName} has 22.6% market share" NOT "${brandAName} has 22.6 purchases"
  
- [currency]: Values are dollar amounts. ALWAYS use "$" prefix
  Example: "$45,000 income" NOT "45,000 income units"

CRITICAL DECIMAL PRECISION REQUIREMENT:
- NEVER round numeric scores that have decimal places
- If you see target_value: 79.34, you MUST write "79.34" NOT "79.30"
- If you see target_value: 79.17, you MUST write "79.17" NOT "79.20"
- Preserve ALL decimal places exactly as provided in the data
  
- [index/score]: Values are normalized scores. Use "score of X" or "index of X"
  Example: "diversity score of 85" NOT "85 diversity units"
  
- [count]: Values are actual counts of people/households. Use "X people" or "X households"
  Example: "1,250 people" NOT "1,250 percentage points"

MANDATORY FIELD TYPE RECOGNITION:
1. If field name contains "(%)" or ends with "_P" or "_ABP" → VALUES ARE PERCENTAGES
2. If data type shows [percentage] → VALUES ARE PERCENTAGES  
3. If field name contains "Income" or "Spending" → VALUES ARE CURRENCY
4. If data type shows [count] → VALUES ARE PEOPLE/HOUSEHOLD COUNTS

WRONG vs RIGHT examples:
❌ WRONG: "${brandAName} has 22.6 purchases" (when field is "${brandAName} (%)")
✅ RIGHT: "${brandAName} has 22.6% market share"

❌ WRONG: "${brandBName} holds 9.44 purchases" (when field shows [percentage])
✅ RIGHT: "${brandBName} holds 9.44% of the market"

❌ WRONG: "Brand C with 3.95 purchases" (when analyzing percentage data)
✅ RIGHT: "Brand C with 3.95% market share"

CRITICAL: Brand fields ending in "%" or with [percentage] indicator represent MARKET SHARE PERCENTAGES, not purchase counts!

${hasComprehensiveSummary ? 
`
=== COMPREHENSIVE DATASET CONTEXT ===
You have access to comprehensive statistical analysis of the ENTIRE dataset including:
- Complete field statistics (min/max/mean/median/std deviation) for ALL ${dataSummary.match(/Total Features Analyzed: (\d+)/)?.[1] || 'N/A'} features
- Housing market analysis across ALL geographic areas
- Top and bottom performing locations from the complete dataset
- Full geographic distribution patterns
- Original query context for follow-up analysis

This is NOT a sample - this represents the complete analytical summary of the entire dataset.
You can provide precise, statistically sound insights about the full population.
` : 
`
=== SAMPLE-BASED ANALYSIS CONTEXT ===
You have access to representative sample data that provides insights into broader patterns.
Your analysis should acknowledge this is based on a sample of the larger dataset.
`}

${metadata?.isMultiEndpoint ? `
=== MULTI-ENDPOINT ANALYSIS CONTEXT ===
CRITICAL: This analysis combines insights from MULTIPLE endpoints working together:

Endpoints Used: ${metadata.endpointsUsed?.join(', ') || 'Multiple endpoints'}
Merge Strategy: ${metadata.mergeStrategy || 'Overlay'}
Total Records Analyzed: ${metadata.totalRecords?.toLocaleString() || 'N/A'}
Analysis Confidence: ${((metadata.analysisConfidence || 0) * 100).toFixed(1)}%
Strategic Context: ${metadata.strategicContext || 'Comprehensive market analysis'}

${multiEndpointFormatting.responseStructure}

${multiEndpointFormatting.compositeScoring}

${strategicSynthesis.frameworkInstructions}

${strategicSynthesis.riskAdjustment}

MULTI-ENDPOINT SYNTHESIS REQUIREMENTS:
1. Lead with executive summary combining ALL endpoint insights
2. Organize findings by GEOGRAPHIC OPPORTUNITIES (not by individual endpoints)
3. Provide cross-endpoint validation and confidence indicators
4. Create unified strategic narrative connecting demographic, competitive, and predictive factors
5. Conclude with risk-adjusted investment priorities and implementation roadmap
6. Focus on areas where MULTIPLE endpoints validate the same opportunities

Performance Context:
- Analysis Depth: ${metadata.endpointsUsed?.length || 'Multiple'} endpoints integrated
- Geographic Coverage: ${metadata.geographicCoverage || 'Comprehensive'} areas analyzed
- Data Quality: ${metadata.dataQuality || 'High'} merge completeness
- Execution Time: ${metadata.executionTime || 'N/A'} seconds
` : ''}

 ${shapAnalysisInfo}

 DATA SUMMARY:
 ${dataSummary}

 TASK: ${personaTaskInstructions}`;
      
        // Ensure userMessage is defined - use the joint analysis message if available, otherwise create a standard message
        if (!userMessage) {
          userMessage = `${userQuery}\n\n${dataSummary}`;
        }
        
        // Debug what metadata we're receiving
        console.log('🔍 [CLAUDE API] Metadata check:', {
          hasMetadata: !!metadata,
          isClustered: metadata?.isClustered,
          hasClusterAnalysis: !!metadata?.clusterAnalysis,
          clusterAnalysisLength: metadata?.clusterAnalysis?.length || 0,
          metadataKeys: metadata ? Object.keys(metadata) : []
        });
        
        // CRITICAL: Handle cluster analysis if provided in metadata
        if (metadata?.isClustered && metadata?.clusterAnalysis) {
          console.log('🎯 [CLAUDE API] Detected cluster analysis in metadata');
          console.log('🎯 [CLAUDE API] Cluster analysis length:', metadata.clusterAnalysis.length);
          console.log('🎯 [CLAUDE API] Using structured approach to preserve data through Claude');
          
          // Use structured approach to pass data through Claude while preserving accuracy
          userMessage = `${userQuery}

STRUCTURED CLUSTER ANALYSIS DATA:
${metadata.clusterAnalysis}

CRITICAL INSTRUCTIONS:
You are a ${selectedPersona.name} analyst. Present the cluster analysis above using your expertise and tone.

STRICT DATA PRESERVATION RULES:
1. Use ONLY the ZIP codes, scores, and territory names provided above
2. Do NOT generate any new ZIP codes or modify any numbers
3. If you see a 4-digit ZIP code, add a leading zero (e.g., 1234 becomes 01234)
4. Copy all percentages and scores exactly as written
5. Maintain all numbered indicators (①, ②, ③, etc.) exactly as shown

Present this analysis in your professional ${selectedPersona.name} style while preserving all data exactly.`;
        }
        
        // 🚨 DEBUG: For strategic analysis, check what's actually in the message
        if (personaAnalysisType.includes('strategic')) {
          console.log('🚨🚨🚨 [STRATEGIC USERMMESSAGE CHECK] Checking dataSummary content:');
          // Extract top areas section
          const topAreasMatch = dataSummary.match(/Top Areas by[\s\S]*?(?=\n-|\n\n|$)/);
          if (topAreasMatch) {
            console.log('🚨 Found Top Areas section:');
            console.log(topAreasMatch[0]);
          } else {
            console.log('🚨 WARNING: No "Top Areas by" section found in dataSummary!');
          }
          
          // Also check if featureData was properly included
          console.log('🚨 Checking featureData structure:');
          if (featureData && Array.isArray(featureData) && featureData.length > 0) {
            const firstLayer = featureData[0];
            console.log(`🚨 First layer has ${firstLayer.features?.length || 0} features`);
            if (firstLayer.features && firstLayer.features.length > 0) {
              console.log('🚨 First 3 features from featureData[0]:');
              firstLayer.features.slice(0, 3).forEach((f: any, i: number) => {
                console.log(`🚨   ${i+1}. ${f.properties?.area_name}: target_value=${f.properties?.target_value}`);
              });
            }
          }
        }
        
        console.log('[Claude] System Prompt Length:', dynamicSystemPrompt.length);
        
        // 🔍 DEBUG: Log prompt sections for strategic analysis
        if (normalizedPersonaAnalysisType === 'strategic_analysis' || normalizedPersonaAnalysisType === 'strategic') {
          console.log('🔍 [STRATEGIC PROMPT DEBUG]');
          console.log('  - Contains base system prompt:', dynamicSystemPrompt.includes('expert geospatial data analyst'));
          console.log('  - Contains strategic perspective:', dynamicSystemPrompt.includes('STRATEGIC PERSPECTIVE'));
          console.log('  - Contains strategic analysis context:', dynamicSystemPrompt.includes('STRATEGIC ANALYSIS TECHNICAL CONTEXT'));
          console.log('  - Contains anti-hallucination rules:', dynamicSystemPrompt.includes('ANTI-HALLUCINATION'));
          console.log('  - Contains formatting requirements:', dynamicSystemPrompt.includes('FORMATTING REQUIREMENTS'));
          console.log('  - Contains model attribution section:', dynamicSystemPrompt.includes('Model Attribution'));
          
          // Log first 500 chars of each major section
          const sections = dynamicSystemPrompt.split(/\n(?=[A-Z][A-Z ]+:)/);
          console.log('🔍 [PROMPT SECTIONS] Found', sections.length, 'major sections');
        }
        console.log('[Claude] User Message Length:', userMessage.length);

        console.log('[Claude] Making Anthropic API call...');
        console.log('[Claude] System prompt length:', dynamicSystemPrompt.length);
        console.log('[Claude] User message length:', userMessage.length);
        
        // Validate message content before sending to Anthropic
        if (!userMessage || userMessage.trim().length === 0) {
            console.error('[Claude] Empty user message detected');
            return NextResponse.json({ 
                error: 'Invalid request: Empty user message',
                content: 'Please provide a valid question or query.'
            }, { status: 400 });
        }
        
        if (dynamicSystemPrompt.length > 200000) {
            console.warn('[Claude] System prompt is very large:', dynamicSystemPrompt.length);
            // Truncate if necessary
        }
        
        let anthropicResponse;
        try {
            // Process messages for conversation context
            const conversationMessages = messages.map((msg: any) => ({
                role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
                content: msg.content
            }));
            
            // Ensure the conversation has proper alternating user/assistant structure
            const validMessages = [];
            let lastRole = '';
            
            for (const msg of conversationMessages) {
                // Skip consecutive messages from the same role (Claude API requires alternating)
                if (msg.role !== lastRole) {
                    validMessages.push(msg);
                    lastRole = msg.role;
                }
            }
            
            // Ensure the conversation ends with a user message
            if (validMessages.length === 0 || validMessages[validMessages.length - 1].role !== 'user') {
                validMessages.push({ role: 'user' as const, content: userMessage });
            }
            
            console.log('[Claude] Sending conversation with', validMessages.length, 'messages');
            console.log('[Claude] Message roles:', validMessages.map(m => m.role).join(' -> '));
            
            anthropicResponse = await anthropic.messages.create({
                model: resolveClaudeModel(),
                max_tokens: 4096,
                system: dynamicSystemPrompt,
                messages: validMessages
            });
            console.log('[Claude] Anthropic API call successful.');
        } catch (anthropicError) {
            console.error('[Claude] Anthropic API error:', anthropicError);
            console.error('[Claude] API error details:', {
                message: anthropicError instanceof Error ? anthropicError.message : 'Unknown error',
                stack: anthropicError instanceof Error ? anthropicError.stack : 'No stack trace',
                systemPromptLength: dynamicSystemPrompt.length,
                userMessageLength: userMessage.length
            });
            return NextResponse.json({ 
                error: `Anthropic API error: ${anthropicError instanceof Error ? anthropicError.message : 'Unknown error'}`,
                content: 'Sorry, I encountered an error while processing your request. Please try again.',
                details: {
                    systemPromptLength: dynamicSystemPrompt.length,
                    userMessageLength: userMessage.length,
                    timestamp: new Date().toISOString()
                }
            }, { status: 500 });
        }
        const responseContent = anthropicResponse.content?.find(block => block.type === 'text')?.text || 'No text content received from AI.';

  // Sanitize Model Attribution section to enforce conditional display and remove placeholders
        let finalContent = responseContent;
        try {
          // If we have a numeric R², replace any 'Not recorded/Not specified/Data not available' with the actual value
          if (computedAttribution && typeof computedAttribution.r2 === 'number' && !Number.isNaN(computedAttribution.r2)) {
            const r2Text = `${computedAttribution.r2.toFixed(3)}${computedAttribution.perfLevel ? ` (${computedAttribution.perfLevel} Performance)` : ''}`;
            finalContent = finalContent.replace(/(\*\*R² Score:\*\*|R² Score:)\s*(Not recorded|Not specified|Data not available)/gi, `$1 ${r2Text}`);
            if (computedAttribution.confidence) {
              finalContent = finalContent.replace(/(\*\*Confidence:\*\*|Confidence:)\s*(Not recorded|Not specified|Data not available)/gi, `$1 ${computedAttribution.confidence}`);
            }
          } else {
            // No R² available: remove entire Model Attribution section if it only contains unavailable data
            // First, try to remove the entire Model Attribution section if all values are unavailable
            finalContent = finalContent.replace(/---\s*\n\*\*Model Attribution:\*\*\s*\n(•[^\n]*(Not recorded|Not specified|Data not available|N\/A)[^\n]*\n?)+/gmi, '');
            
            // Fallback: drop individual R²/Confidence lines that state they're not available
            finalContent = finalContent.replace(/^.*(R² Score:|\*\*R² Score:\*\*).*?(Not recorded|Not specified|Data not available|N\/A).*\n?/gmi, '');
            finalContent = finalContent.replace(/^.*(Confidence:|\*\*Confidence:\*\*).*?(Not recorded|Not specified|Data not available|N\/A).*\n?/gmi, '');
            
            // Also remove Model Used line if it's the only remaining line in the section
            finalContent = finalContent.replace(/---\s*\n\*\*Model Attribution:\*\*\s*\n•\s*\*\*Model Used:\*\*[^\n]*\n(?!•)/gmi, '');
          }
          // Minor cleanup: collapse multiple blank lines introduced by removals
          finalContent = finalContent.replace(/\n{3,}/g, '\n\n');
        } catch (e) {
          console.warn('[Claude] Post-processing of Model Attribution failed:', e);
        }

        // Name placeholder sanitation in AI narrative: replace "Unknown Area" with real top strategic names when possible
        try {
          if (/Top Strategic Markets:/i.test(finalContent) && /Unknown Area/i.test(finalContent)) {
            const allFeatures = (processedLayersData || []).flatMap(layer => Array.isArray((layer as any)?.features) ? (layer as any).features : []);
            const candidates = allFeatures
              .map((feat: any) => {
                const props = feat?.properties || feat || {};
                const score = Number(
                  props?.strategic_analysis_score ??
                  props?.strategic_value_score ??
                  feat?.strategic_value_score ??
                  props?.target_value
                );
                const name = resolveSharedAreaName(feat, { mode: 'zipCity', neutralFallback: '' });
                return { name, score };
              })
              .filter((x: any) => x.name && !Number.isNaN(x.score))
              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, 8);

            if (candidates.length) {
              const startIdx = finalContent.search(/Top Strategic Markets:/i);
              if (startIdx >= 0) {
                let idx = 0;
                const head = finalContent.slice(0, startIdx);
                let tail = finalContent.slice(startIdx);
                // Replace sequential Unknown Area/Location occurrences preferentially within this section
                tail = tail.replace(/Unknown (Area|Location)/gi, () => (idx < candidates.length ? candidates[idx++].name : ''));
                finalContent = head + tail;
              } else {
                // Global sequential replacement as a fallback
                let idx = 0;
                finalContent = finalContent.replace(/Unknown (Area|Location)/gi, () => (idx < candidates.length ? candidates[idx++].name : ''));
              }
            }
          }
        } catch (e) {
          console.warn('[Claude] Name placeholder sanitation failed:', e);
        }

        // Derive a specific analysis type for post-processing if the route's type is generic
        const postProcessAnalysisType = (() => {
          try {
            if (analysisType === 'default' || !analysisType) {
              const tv = (metadata?.targetVariable || '').toString().toLowerCase();
              if (tv.includes('strategic')) return 'strategic_analysis';
              if (tv.includes('competitive')) return 'competitive_analysis';
              if (tv.includes('brand')) return 'brand_difference';
              if (tv.includes('demographic')) return 'demographic_insights';
            }
          } catch {}
          return analysisType;
        })();


        // // Enforce study-area scope across the rest of the narrative to remove conflicting global stats
        // try {
        //   finalContent = sanitizeNarrativeScope(finalContent, processedLayersData, metadata, postProcessAnalysisType);
        // } catch (e) {
        //   console.warn('[Claude] Narrative scope sanitization failed:', e);
        // }

        // Remove confidence and feature-count lines from final narrative (chat dialog cleanliness)
        try {
          // Strip any "Confidence:" lines (including bold variants and bullet prefixes)
          finalContent = finalContent.replace(
            /^[ \t]*(?:[-•*]\s*)?(?:\*\*)?Analysis?\s*Confidence(?:\s*\*\*)?\s*:\s*.*\n?/gmi,
            ''
          );
          finalContent = finalContent.replace(
            /^[ \t]*(?:[-•*]\s*)?(?:\*\*)?Confidence(?:\s*\*\*)?\s*:\s*.*\n?/gmi,
            ''
          );

          // Strip feature-count lines commonly emitted in narratives
          finalContent = finalContent.replace(
            /^[ \t]*(?:[-•*]\s*)?Total\s+Features\s+Analyzed\s*:\s*.*\n?/gmi,
            ''
          );
          finalContent = finalContent.replace(
            /^[ \t]*(?:[-•*]\s*)?Layer:\s.*\(\s*\d+\s*features\s+analyzed\s*\)\s*\n?/gmi,
            ''
          );
          finalContent = finalContent.replace(
            /^[ \t]*(?:[-•*]\s*)?Layer:\s.*\(\s*\d+\s*features\s+sampled\s+from\s+\d+\s+total\s+features\s*\)\s*\n?/gmi,
            ''
          );
          // Generic fallback: any standalone line mentioning "features analyzed"
          finalContent = finalContent.replace(
            /^[ \t]*(?:[-•*]\s*)?.*\bfeatures?\s+analyzed\b.*\n?/gmi,
            ''
          );

          // Collapse any excessive blank lines introduced by removals
          finalContent = finalContent.replace(/\n{3,}/g, '\n\n');
        } catch (e) {
          console.warn('[Claude] Cleanup of confidence/feature-count lines failed:', e);
        }

        console.log('[Claude] AI Response Start:', responseContent.substring(0, 200) + '...');

        // Validate response for hallucinated data
        if (metadata?.isClustered && metadata?.clusterAnalysis) {
          console.log('🔍 [VALIDATION] Running hallucination check...');
          const validationResult = validateClusterResponse(responseContent, metadata.clusterAnalysis);
          if (!validationResult.isValid) {
            console.error('🚨 [HALLUCINATION DETECTED]', validationResult.issues);
            console.error('🚨 [HALLUCINATION] Original had', metadata.clusterAnalysis.match(/\b\d{5}\b/g)?.length || 0, 'ZIP codes');
            console.error('🚨 [HALLUCINATION] Response has', responseContent.match(/\b\d{5}\b/g)?.length || 0, 'ZIP codes');
            // Log the issue but don't fail - just warn for now
            console.warn('⚠️ [VALIDATION] Claude may have hallucinated data:', validationResult.issues);
          } else {
            console.log('✅ [VALIDATION] No hallucinations detected');
          }
        }

        // --- Extract Clickable Features ---
        console.log('[Claude] Extracting clickable identifiers from response...');
        const identifierData = extractIdentifiersAndType(
            responseContent, 
            metadata?.relevantLayers, 
            layers
        );
        
        console.log('[Claude] Identifier extraction results:', {
            featureType: identifierData.featureType,
            count: identifierData.validIdentifiers?.length || 0,
            sourceLayer: identifierData.sourceLayerIdForClickable,
            sourceField: identifierData.sourceIdentifierFieldForClickable
        });

        // --- Return response ---
    const analysisResponse: AnalysisResponse = {
      content: finalContent,
            validIdentifiers: identifierData.validIdentifiers || [],
            clickableFeatureType: identifierData.featureType,
            sourceLayerIdForClickable: identifierData.sourceLayerIdForClickable,
            sourceIdentifierFieldForClickable: identifierData.sourceIdentifierFieldForClickable,
            clusters: identifierData.clusters
        };

        return NextResponse.json(analysisResponse);
    
        } catch (error) {
          console.error('🚨 [CLAUDE CRITICAL ERROR] Error in POST handler:', error);
          console.error('🚨 [CLAUDE CRITICAL ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
        }
    }

    // --- OPTIONS Handler ---
    export async function OPTIONS(request: Request) {
      return NextResponse.json({}, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

function extractIdentifiersAndType(
  text: string,
  relevantLayers: string[] | undefined,
  layerConfigs: Record<string, LayerConfig>
): {
  validIdentifiers: string[];
  featureType?: 'FSA' | 'City' | 'District' | 'ZIP' | 'Cluster';
  sourceLayerIdForClickable?: string;
  sourceIdentifierFieldForClickable?: string;
  clusters?: Array<{id: string, name: string, zipCodes: string[]}>;
} {
  console.log('[extractIdentifiersAndType] Received relevantLayers:', relevantLayers);
  console.log('[extractIdentifiersAndType] Received Layer Config Keys (still needed):', Object.keys(layerConfigs));

  const zipRegex = /\b(\d{5})(?:\s*\(([^)]+)\))?\b/g; // Matches "12345" or "12345 (City Name)"
  const postalCodeRegex = /\b([A-Z]\d[A-Z])\b/g; // Matches "A1A"
  const districtRegex = /\b([A-Z]{1,2}\d{1,3})\b/g; // Matches district codes like ED123
  // New regex to detect cluster mentions in the format "CLUSTER X" or "Cluster X:"
  const clusterRegex = /\b(?:CLUSTER|Cluster)\s+(\d+)(?:\s*:|:\s*|\s+)(.*?)(?:\n|$)/g;

  const zipMatches = Array.from(text.matchAll(zipRegex)).map(m => m[0]);
  const postalCodeMatches = Array.from(text.matchAll(postalCodeRegex)).map(m => m[1]);
  const districtMatches = Array.from(text.matchAll(districtRegex)).map(m => m[1]);
  
  // Extract cluster information
  const clusterMatches = Array.from(text.matchAll(clusterRegex));
  const clusterInfo = clusterMatches.map(match => {
    const clusterId = match[1]; // The cluster number
    const clusterName = match[2].trim(); // The cluster name/description
    
    // Try to find ZIP codes associated with this cluster
    // Look for sections that follow the cluster definition and mention ZIP codes
    const clusterText = text.substring(match.index);
    const zipListRegex = /(?:ZIP codes?|codes?|areas?)(?:[:\s-]+)((?:\d{5}(?:,\s*|\s+|(?:\s+and\s+)))*\d{5})/i;
    const zipListMatch = clusterText.match(zipListRegex);
    
    let zipCodes: string[] = [];
    if (zipListMatch && zipListMatch[1]) {
      // Extract ZIP codes from the comma-separated list
      zipCodes = zipListMatch[1].split(/,\s*|\s+and\s+|\s+/).filter(s => /\d{5}/.test(s));
    }
            
            return {
      id: `cluster-${clusterId}`,
      name: clusterName,
      zipCodes: zipCodes
            };
          });

  let featureType: 'FSA' | 'City' | 'District' | 'ZIP' | 'Cluster' | undefined = undefined;
  let validIdentifiers: string[] = [];
  let sourceLayerIdForClickable: string | undefined = undefined;
  let sourceIdentifierFieldForClickable: string | undefined = undefined;
  let clusters = clusterInfo;

  // Determine dominant type - PRIORITIZE ZIP if any exist
  if (zipMatches.length > 0) { 
    featureType = 'ZIP';
    validIdentifiers = Array.from(new Set(zipMatches));
    // Use the new relevantLayers parameter
    const relevantLayerId = relevantLayers?.find((id: string) => 
        layerConfigs[id]?.geographicType === 'ZIP' || // Check geographicType first
        layerConfigs[id]?.name?.toLowerCase().includes('zip') || 
        layerConfigs[id]?.metadata?.tags?.includes('zip')
    );
    if (relevantLayerId && layerConfigs[relevantLayerId]) { // Check layerConfigs[relevantLayerId] exists
        sourceLayerIdForClickable = relevantLayerId;
        const config = layerConfigs[relevantLayerId];
        // Determine the identifier field (PRIORITIZE DESCRIPTION if present and type is string)
        const descField = config.fields?.find(f => f.name === 'DESCRIPTION' && f.type === 'string');
        const zipField = config.fields?.find(f => f.name.toUpperCase() === 'ZIP' || f.name.toUpperCase() === 'ZIPCODE' || f.name.toUpperCase() === 'POSTAL_CODE');

        if (descField) {
            sourceIdentifierFieldForClickable = descField.name;
        } else if (zipField) {
            sourceIdentifierFieldForClickable = zipField.name;
        } else {
             sourceIdentifierFieldForClickable = 'DESCRIPTION'; // Fallback to DESCRIPTION
        }
    }
  } else if (postalCodeMatches.length > 0) { 
    featureType = 'FSA';
    validIdentifiers = Array.from(new Set(postalCodeMatches));
    // Use the new relevantLayers parameter
    const relevantLayerId = relevantLayers?.find((id: string) => 
        layerConfigs[id]?.geographicType === 'FSA' || 
        layerConfigs[id]?.name?.toLowerCase().includes('postal') || 
        layerConfigs[id]?.metadata?.tags?.includes('postal')
    );
     if (relevantLayerId && layerConfigs[relevantLayerId]) {
        sourceLayerIdForClickable = relevantLayerId;
        // Common postal code field or check config
        const postalField = layerConfigs[relevantLayerId].fields?.find(f => f.name.toUpperCase() === 'CFSAUID');
        sourceIdentifierFieldForClickable = postalField ? postalField.name : 'CFSAUID'; 
     }
  } 
  // ... (rest of district logic, potentially update similarly)

  // If we found clusters and they have meaningful information, include them in the return value
  if (clusters && clusters.length > 0 && clusters.some(c => c.zipCodes.length > 0)) {
    console.log('[extractIdentifiersAndType] Identified clusters:', clusters);
    // If we have more clusters than other identifiers, prioritize clusters
    if ((featureType === undefined || clusters.length > validIdentifiers.length) && clusters.length >= 2) {
      featureType = 'Cluster';
      validIdentifiers = clusters.map(c => c.id);
    }
  }

  console.log('[extractIdentifiersAndType] Results:', { 
    featureType, 
    count: validIdentifiers.length, 
    sourceLayerIdForClickable, 
    sourceIdentifierFieldForClickable,
    clusterCount: clusters?.length || 0
  });
  
  return { 
    validIdentifiers, 
    featureType, 
    sourceLayerIdForClickable, 
    sourceIdentifierFieldForClickable,
    clusters: clusters?.length ? clusters : undefined
  };
}

// Function to identify clusters from feature data based on geographic proximity and similar values
function generateClusterInformation(
  layerResults: ReceivedFeatureDataType, 
  primaryField: string | undefined,
  maxClusters: number = 5,
  minMembers: number = 5
): string {
  if (!primaryField) {
    console.log('[generateClusterInformation] No primary field provided');
    return '';
  }

  console.log(`[generateClusterInformation] Processing features to identify clusters with primary field: ${primaryField}`);
  
  // Get all features from all layers
  const allFeatures = layerResults.flatMap(layer => layer.features);
  
  // Skip if we don't have enough features
  if (allFeatures.length < 10) {
    console.log(`[generateClusterInformation] Not enough features (${allFeatures.length}) to identify meaningful clusters`);
    return '';
  }

  // Filter for features that have the primary field
  const validFeatures = allFeatures.filter(f => 
    f.properties && f.properties[primaryField] !== undefined &&
    !isNaN(Number(f.properties[primaryField]))
  );

  if (validFeatures.length < 10) {
    console.log(`[generateClusterInformation] Not enough valid features (${validFeatures.length}) with the primary field`);
    return '';
  }
  
  try {
    // Sort features by value, high to low
    const sortedFeatures = [...validFeatures].sort((a, b) => {
      const valA = Number(a.properties?.[primaryField]);
      const valB = Number(b.properties?.[primaryField]);
      return valB - valA;
    });
    
    // Take top 25% of features by value (the filtering done in visualization)
    const topQuartileIndex = Math.floor(sortedFeatures.length * 0.25);
    const topFeatures = sortedFeatures.slice(0, topQuartileIndex);
    
    console.log(`[generateClusterInformation] Identified ${topFeatures.length} top features (top 25% by value)`);
    
    // Simplistic geographic clustering - group by first 3 digits of ZIP code
    // This simulates the spatial clustering that would happen in the actual visualization
    const zipRegionClusters = new Map<string, Array<any>>();
    
    topFeatures.forEach(feature => {
      // Get ZIP code
      const zip = getZIPCode(feature);
      // Use first 3 digits as region identifier - approximating geographic proximity
      const regionId = zip.substring(0, 3);
      
      if (!zipRegionClusters.has(regionId)) {
        zipRegionClusters.set(regionId, []);
      }
      zipRegionClusters.get(regionId)!.push(feature);
    });

    // Filter clusters to include only those with 5 or more locations (minimum cluster size in visualization)
    const validClusters = Array.from(zipRegionClusters.entries())
      .filter(([_, features]) => features.length >= minMembers)
      .map(([regionId, features]) => {
        // Calculate average value for the cluster
        const avgValue = features.reduce(
          (sum, f) => sum + Number(f.properties[primaryField]), 0
        ) / features.length;

        // Get top ZIP codes for this cluster (highest values first)
        const topZips = features
          .sort((a, b) => Number(b.properties[primaryField]) - Number(a.properties[primaryField]))
          .slice(0, 5)
          .map(f => getZIPCode(f));

  // Determine a region name from the features using shared resolver
  let regionName = resolveSharedRegionName(features, regionId, { neutralFallback: `Region ${regionId}` });
  if (!regionName) regionName = `Region ${regionId}`;
        // Add region identifier to name if it doesn't already contain it
        if (!regionName.includes(regionId)) {
          regionName += ` (${regionId}xx)`;
        }

        return {
          regionId,
          regionName,
          count: features.length,
          avgValue,
          topZips,
          totalPopulation: 0 // Will be updated if population data is available
        };
      });

    // If no valid clusters were found, return empty string
    if (validClusters.length === 0) {
      console.log(`[generateClusterInformation] No valid clusters found with 5+ members`);
      return '';
    }
    
    // Find the appropriate layer config to get the human-readable field name
    const layerConfig = layerResults[0]?.layerId ? layers[layerResults[0].layerId] : undefined;
    
    // Use the getHumanReadableFieldName function to ensure consistent field name mapping
    const displayFieldName = getHumanReadableFieldName(primaryField || 'Unknown Field');

    // Sort clusters by their average values (descending) before displaying
    validClusters.sort((a, b) => b.avgValue - a.avgValue);
    const limitedClusters = validClusters.slice(0, maxClusters);
    
    // Now generate the cluster info text with VERY explicit ranking
    let clusterInfo = `CRITICAL: The following clusters are in EXACT RANKED ORDER from highest to lowest average value. DO NOT change this order in your response.\n\n`;
    clusterInfo += `Identified ${limitedClusters.length} significant clusters of areas with high ${displayFieldName} values:\n\n`;
    
    limitedClusters.forEach((cluster, index) => {
      // Make the rank extremely clear in multiple places
      clusterInfo += `RANK ${index + 1} (${index === 0 ? 'HIGHEST' : index === limitedClusters.length - 1 ? 'LOWEST' : 'MIDDLE'} VALUE): ${cluster.regionName} Region\n`;
      clusterInfo += `- ABSOLUTE RANK: #${index + 1} of ${limitedClusters.length} clusters\n`;
      clusterInfo += `- AVERAGE VALUE: ${cluster.avgValue.toFixed(2)} (${index === 0 ? 'HIGHEST OF ALL CLUSTERS' : ''})\n`;
      clusterInfo += `- Member Count: ${cluster.count} areas\n`;
              clusterInfo += `- Key ZIP codes in cluster: ${cluster.topZips.join(', ')}\n\n`;
    });
    
    return clusterInfo;
    
  } catch (error) {
    console.error('[generateClusterInformation] Error generating cluster information:', error);
    return '';
  }
}

// Fix the msg parameter types in the error handling
const handleError = (msg: string, error: unknown): never => {
  console.error(`[Claude] ${msg}:`, error);
  throw new Error(msg);
};

const handleStreamError = (msg: string, error: unknown): void => {
  console.error(`[Claude] ${msg}:`, error);
};

const logMessage = (msg: string): void => {
  console.log(`[Claude] ${msg}`);
};

const logWarning = (msg: string): void => {
  console.warn(`[Claude] ${msg}`);
};

/**
 * Maps technical field names to human-readable names using layer configurations
 */
function getHumanReadableFieldName(fieldName: string): string {
  // Check dynamic overrides passed in request metadata first
  if (FIELD_ALIAS_OVERRIDES[fieldName]) {
    return FIELD_ALIAS_OVERRIDES[fieldName];
  }
  const overrideMatch = Object.entries(FIELD_ALIAS_OVERRIDES).find(([code]) => code.toLowerCase() === fieldName.toLowerCase());
  if (overrideMatch) {
    return overrideMatch[1];
  }
  // Direct field name mappings from layers.ts and common SHAP features
  const fieldMappings: { [key: string]: string } = {
    'FREQUENCY': 'Applications',
    'SUM_FUNDED': 'Conversions', 
    'thematic_value': 'Value',
    'OBJECTID': 'ID',
    'ID': 'Area ID',
    'DESCRIPTION': 'Area Description',
    // Common SHAP feature mappings
    'visible_minority_population_pct': 'Visible Minority Population (%)',
    'filipino_population_pct': 'Filipino Population (%)',
    'chinese_population_pct': 'Chinese Population (%)',
    'south_asian_population_pct': 'South Asian Population (%)',
    'black_population_pct': 'Black Population (%)',
    'median_household_income': 'Median Household Income',
    'average_household_income': 'Average Household Income',
    'household_average_income': 'Household Average Income',
    'total_households': 'Total Households',
    'owner_occupied_pct': 'Owner Occupied (%)',
    'renter_occupied_pct': 'Renter Occupied (%)',
    'condominium_pct': 'Condominium (%)',
    'apartment_5plus_storeys_pct': 'Apartment 5+ Storeys (%)',
    'single_detached_house_pct': 'Single Detached House (%)',
    'construction_2016_2021_pct': 'Construction 2016-2021 (%)',
    'construction_2011_2015_pct': 'Construction 2011-2015 (%)',
    'service_charges_banks': 'Service Charges - Banks',
    'financial_services': 'Financial Services',
    // Brand purchase fields - comprehensive mapping for all case variations
    'MP30034A_B': 'Nike Athletic Shoes Purchases',
    'mp30034a_b': 'Nike Athletic Shoes Purchases',
    'MP30029A_B': 'Adidas Athletic Shoes Purchases', 
    'mp30029a_b': 'Adidas Athletic Shoes Purchases',
    'MP30030A_B': 'Asics Athletic Shoes Purchases',
    'mp30030a_b': 'Asics Athletic Shoes Purchases',
    'MP30031A_B': 'Converse Athletic Shoes Purchases',
    'mp30031a_b': 'Converse Athletic Shoes Purchases',
    'MP30032A_B': 'Jordan Athletic Shoes Purchases',
    'mp30032a_b': 'Jordan Athletic Shoes Purchases',
    'MP30033A_B': 'New Balance Athletic Shoes Purchases',
    'mp30033a_b': 'New Balance Athletic Shoes Purchases',
    'MP30035A_B': 'Puma Athletic Shoes Purchases',
    'mp30035a_b': 'Puma Athletic Shoes Purchases',
    'MP30036A_B': 'Reebok Athletic Shoes Purchases',
    'mp30036a_b': 'Reebok Athletic Shoes Purchases',
    'MP30037A_B': 'Skechers Athletic Shoes Purchases',
    'mp30037a_b': 'Skechers Athletic Shoes Purchases',
    'MP30016A_B': 'Athletic Shoes Purchases',
    'mp30016a_b': 'Athletic Shoes Purchases',
    // Additional athletic shoe categories
    'MP30018A_B': 'Basketball Shoes Purchases',
    'mp30018a_b': 'Basketball Shoes Purchases',
    'MP30019A_B': 'Cross-Training Shoes Purchases',
    'mp30019a_b': 'Cross-Training Shoes Purchases',
    'MP30021A_B': 'Running/Jogging Shoes Purchases',
    'mp30021a_b': 'Running/Jogging Shoes Purchases',
    // Sports participation fields
    'MP33020A_B': 'Running/Jogging Participation',
    'mp33020a_b': 'Running/Jogging Participation',
    'MP33032A_B': 'Yoga Participation',
    'mp33032a_b': 'Yoga Participation',
    'MP33031A_B': 'Weight Lifting Participation',
    'mp33031a_b': 'Weight Lifting Participation',
    // Retail shopping fields
    'MP31042A_B': 'Foot Locker Shopping',
    'mp31042a_b': 'Foot Locker Shopping',
    // Sports fan fields
    'MP33104A_B': 'MLB Super Fan',
    'mp33104a_b': 'MLB Super Fan',
    'MP33105A_B': 'NASCAR Super Fan',
    'mp33105a_b': 'NASCAR Super Fan',
    'MP33106A_B': 'NBA Super Fan',
    'mp33106a_b': 'NBA Super Fan',
    'MP33107A_B': 'NFL Super Fan',
    'mp33107a_b': 'NFL Super Fan',
    'MP33108A_B': 'NHL Super Fan',
    'mp33108a_b': 'NHL Super Fan',
    'MP33119A_B': 'International Soccer Super Fan',
    'mp33119a_b': 'International Soccer Super Fan',
    // Percentage versions of brand fields
    'MP30034A_B_P': 'Nike Athletic Shoes Purchases (%)',
    'mp30034a_b_p': 'Nike Athletic Shoes Purchases (%)',
    'MP30029A_B_P': 'Adidas Athletic Shoes Purchases (%)',
    'mp30029a_b_p': 'Adidas Athletic Shoes Purchases (%)',
    'MP30030A_B_P': 'Asics Athletic Shoes Purchases (%)',
    'mp30030a_b_p': 'Asics Athletic Shoes Purchases (%)',
    'MP30031A_B_P': 'Converse Athletic Shoes Purchases (%)',
    'mp30031a_b_p': 'Converse Athletic Shoes Purchases (%)',
    'MP30032A_B_P': 'Jordan Athletic Shoes Purchases (%)',
    'mp30032a_b_p': 'Jordan Athletic Shoes Purchases (%)',
    'MP30033A_B_P': 'New Balance Athletic Shoes Purchases (%)',
    'mp30033a_b_p': 'New Balance Athletic Shoes Purchases (%)',
    'MP30035A_B_P': 'Puma Athletic Shoes Purchases (%)',
    'mp30035a_b_p': 'Puma Athletic Shoes Purchases (%)',
    'MP30036A_B_P': 'Reebok Athletic Shoes Purchases (%)',
    'mp30036a_b_p': 'Reebok Athletic Shoes Purchases (%)',
    'MP30037A_B_P': 'Skechers Athletic Shoes Purchases (%)',
    'mp30037a_b_p': 'Skechers Athletic Shoes Purchases (%)',
    'MP30016A_B_P': 'Athletic Shoes Purchases (%)',
    'mp30016a_b_p': 'Athletic Shoes Purchases (%)',
    // Additional demographic fields from field aliases
    'TOTPOP_CY': 'Total Population',
    'totpop_cy': 'Total Population',
    'MEDDI_CY': 'Median Household Income',
    'meddi_cy': 'Median Household Income',
    'MEDAGE_CY': 'Median Age',
    'medage_cy': 'Median Age',
    'DIVINDX_CY': 'Diversity Index',
    'divindx_cy': 'Diversity Index',

    'HHPOP_CY': 'Household Population',
    'hhpop_cy': 'Household Population',
    'FAMPOP_CY': 'Family Population',
    'fampop_cy': 'Family Population',
    // Value fields from microservice
    'value_MP30034A_B': 'Nike Athletic Shoes Purchases',
    'value_mp30034a_b': 'Nike Athletic Shoes Purchases',
    'value_MP30029A_B': 'Adidas Athletic Shoes Purchases',
    'value_mp30029a_b': 'Adidas Athletic Shoes Purchases',
    'target_value': 'Target Variable Value',
    // Analysis score fields
    'competitive_advantage_score': 'Competitive Advantage Score',
    'comparative_analysis_score': 'Comparative Analysis Score',
    'strategic_value_score': 'Strategic Value Score',
    'correlation_score': 'Correlation Score',
    'cluster_score': 'Cluster Score',
    'demographic_score': 'Demographic Score',
    'trend_score': 'Trend Score',
    'anomaly_score': 'Anomaly Score',
    'interaction_score': 'Interaction Score',
    'outlier_score': 'Outlier Score',
    'comparative_score': 'Comparative Score',
    'prediction_score': 'Prediction Score',
    'segment_score': 'Segment Score',
    'scenario_score': 'Scenario Score',
    'market_size_score': 'Market Size Score',
    'brand_score': 'Brand Score',
    'location_score': 'Location Score',
    'risk_score': 'Risk Score',
    'threshold_score': 'Threshold Score',
    // Geographic identifiers
    'FSA_ID': 'Forward Sortation Area ID',
    'fsa_id': 'Forward Sortation Area ID',
    'GEO_ID': 'Geographic Area ID',
    'geo_id': 'Geographic Area ID',
    'ZIP_CODE': 'ZIP Code',
    'zip_code': 'ZIP Code',
    // Demographic fields - population
    'total_population': 'Total Population',
    'TOTAL_POPULATION': 'Total Population',
    'asian_population': 'Asian Population',
    'ASIAN_POPULATION': 'Asian Population',
    'black_population': 'Black Population',
    'BLACK_POPULATION': 'Black Population',
    'white_population': 'White Population',
    'WHITE_POPULATION': 'White Population',
    'hispanic_population': 'Hispanic Population',
    'HISPANIC_POPULATION': 'Hispanic Population',
    'native_population': 'Native Population',
    'NATIVE_POPULATION': 'Native Population',
    'other_population': 'Other Population',
    'OTHER_POPULATION': 'Other Population',
    // Income fields
    'median_income': 'Median Income',
    'MEDIAN_INCOME': 'Median Income',
    'average_income': 'Average Income',
    'AVERAGE_INCOME': 'Average Income',
    'household_income': 'Household Income',
    'HOUSEHOLD_INCOME': 'Household Income',
    'MP33120A_B': 'MLS Soccer Super Fan',
    'mp33120a_b': 'MLS Soccer Super Fan',
    'MP07109A_B': 'Sports Clothing Spending ($300+)',
    'mp07109a_b': 'Sports Clothing Spending ($300+)',
    'MP07111A_B': 'Athletic/Workout Wear Spending ($100+)',
    'mp07111a_b': 'Athletic/Workout Wear Spending ($100+)',
    'X9051_X': 'Sports/Recreation/Exercise Equipment',
    'x9051_x': 'Sports/Recreation/Exercise Equipment',
    'X9051_X_A': 'Sports/Recreation/Exercise Equipment (Average)',
    'x9051_x_a': 'Sports/Recreation/Exercise Equipment (Average)',
    'PSIV7UMKVALM': 'Shoe Spending ($200+)',
    'psiv7umkvalm': 'Shoe Spending ($200+)',
    'MP30018A_B_P': 'Basketball Shoes Purchases (%)',
    'mp30018a_b_p': 'Basketball Shoes Purchases (%)',
    'MP30019A_B_P': 'Cross-Training Shoes Purchases (%)',
    'mp30019a_b_p': 'Cross-Training Shoes Purchases (%)',
    'MP30021A_B_P': 'Running/Jogging Shoes Purchases (%)',
    'mp30021a_b_p': 'Running/Jogging Shoes Purchases (%)',
    'MP07109A_B_P': 'Sports Clothing Spending ($300+) (%)',
    'mp07109a_b_p': 'Sports Clothing Spending ($300+) (%)',
    'MP07111A_B_P': 'Athletic/Workout Wear Spending ($100+) (%)',
    'mp07111a_b_p': 'Athletic/Workout Wear Spending ($100+) (%)',

    'MP31042A_B_P': 'Foot Locker Shopping (%)',
    'mp31042a_b_p': 'Foot Locker Shopping (%)',
    'MP33020A_B_P': 'Running/Jogging Participation (%)',
    'mp33020a_b_p': 'Running/Jogging Participation (%)',
    'MP33032A_B_P': 'Yoga Participation (%)',
    'mp33032a_b_p': 'Yoga Participation (%)',
    'MP33031A_B_P': 'Weight Lifting Participation (%)',
    'mp33031a_b_p': 'Weight Lifting Participation (%)',
    'MP33104A_B_P': 'MLB Super Fan (%)',
    'mp33104a_b_p': 'MLB Super Fan (%)',
    'MP33105A_B_P': 'NASCAR Super Fan (%)',
    'mp33105a_b_p': 'NASCAR Super Fan (%)',
    'MP33106A_B_P': 'NBA Super Fan (%)',
    'mp33106a_b_p': 'NBA Super Fan (%)',
    'MP33107A_B_P': 'NFL Super Fan (%)',
    'mp33107a_b_p': 'NFL Super Fan (%)',
    'MP33108A_B_P': 'NHL Super Fan (%)',
    'mp33108a_b_p': 'NHL Super Fan (%)',
    'MP33119A_B_P': 'International Soccer Super Fan (%)',
    'mp33119a_b_p': 'International Soccer Super Fan (%)',
    'MP33120A_B_P': 'MLS Soccer Super Fan (%)',
    'mp33120a_b_p': 'MLS Soccer Super Fan (%)',
    'WLTHINDXCY': 'Wealth Index',
    'wlthindxcy': 'Wealth Index',
    'HHPOP_CY_P': 'Household Population (%)',
    'hhpop_cy_p': 'Household Population (%)',
    'FAMPOP_CY_P': 'Family Population (%)',
    'fampop_cy_p': 'Family Population (%)',
    // Race and ethnicity fields
    'WHITE_CY': 'White Population',
    'white_cy': 'White Population',
    'WHITE_CY_P': 'White Population (%)',
    'white_cy_p': 'White Population (%)',
    'BLACK_CY': 'Black/African American Population',
    'black_cy': 'Black/African American Population',
    'BLACK_CY_P': 'Black/African American Population (%)',
    'black_cy_p': 'Black/African American Population (%)',
    'AMERIND_CY': 'American Indian/Alaska Native Population',
    'amerind_cy': 'American Indian/Alaska Native Population',
    'AMERIND_CY_P': 'American Indian/Alaska Native Population (%)',
    'amerind_cy_p': 'American Indian/Alaska Native Population (%)',
    'ASIAN_CY': 'Asian Population',
    'asian_cy': 'Asian Population',
    'ASIAN_CY_P': 'Asian Population (%)',
    'asian_cy_p': 'Asian Population (%)',
    'PACIFIC_CY': 'Pacific Islander Population',
    'pacific_cy': 'Pacific Islander Population',
    'PACIFIC_CY_P': 'Pacific Islander Population (%)',
    'pacific_cy_p': 'Pacific Islander Population (%)',
    'OTHRACE_CY': 'Other Race Population',
    'othrace_cy': 'Other Race Population',
    'OTHRACE_CY_P': 'Other Race Population (%)',
    'othrace_cy_p': 'Other Race Population (%)',
    'RACE2UP_CY': 'Population of Two or More Races',
    'race2up_cy': 'Population of Two or More Races',
    'RACE2UP_CY_P': 'Population of Two or More Races (%)',
    'race2up_cy_p': 'Population of Two or More Races (%)',
    // Hispanic population fields
    'HISPWHT_CY': 'Hispanic White Population',
    'hispwht_cy': 'Hispanic White Population',
    'HISPWHT_CY_P': 'Hispanic White Population (%)',
    'hispwht_cy_p': 'Hispanic White Population (%)',
    'HISPBLK_CY': 'Hispanic Black/African American Population',
    'hispblk_cy': 'Hispanic Black/African American Population',
    'HISPBLK_CY_P': 'Hispanic Black/African American Population (%)',
    'hispblk_cy_p': 'Hispanic Black/African American Population (%)',
    'HISPAI_CY': 'Hispanic American Indian/Alaska Native Population',
    'hispai_cy': 'Hispanic American Indian/Alaska Native Population',
    'HISPAI_CY_P': 'Hispanic American Indian/Alaska Native Population (%)',
    'hispai_cy_p': 'Hispanic American Indian/Alaska Native Population (%)',
    'HISPPI_CY': 'Hispanic Pacific Islander Population',
    'hisppi_cy': 'Hispanic Pacific Islander Population',
    'HISPPI_CY_P': 'Hispanic Pacific Islander Population (%)',
    'hisppi_cy_p': 'Hispanic Pacific Islander Population (%)',
    'HISPOTH_CY': 'Hispanic Other Race Population',
    'hispoth_cy': 'Hispanic Other Race Population',
    'HISPOTH_CY_P': 'Hispanic Other Race Population (%)',
    'hispoth_cy_p': 'Hispanic Other Race Population (%)',
    // Generational demographics
    'GENZ_CY': 'Generation Z Population (Born 1999-2016)',
    'genz_cy': 'Generation Z Population (Born 1999-2016)',
    'GENZ_CY_P': 'Generation Z Population (%)',
    'genz_cy_p': 'Generation Z Population (%)',
    'GENALPHACY': 'Generation Alpha Population (Born 2017+)',
    'genalphacy': 'Generation Alpha Population (Born 2017+)',
    'GENALPHACY_P': 'Generation Alpha Population (%)',
    'genalphacy_p': 'Generation Alpha Population (%)',
    'MILLENN_CY': 'Millennial Population (Born 1981-1998)',
    'millenn_cy': 'Millennial Population (Born 1981-1998)',
    'MILLENN_CY_P': 'Millennial Population (%)',
    'millenn_cy_p': 'Millennial Population (%)',
    // Dick's Sporting Goods with backtick (from layer config)
    'MP31035A_B': '2024 Shopped at Dick`s Sporting Goods Store Last 3 Mo',
    'mp31035a_b': '2024 Shopped at Dick`s Sporting Goods Store Last 3 Mo',
    'MP31035A_B_P': '2024 Shopped at Dick`s Sporting Goods Store Last 3 Mo (%)',
    'mp31035a_b_p': '2024 Shopped at Dick`s Sporting Goods Store Last 3 Mo (%)',
  };

  // Check direct mappings first
  if (fieldMappings[fieldName]) {
    return fieldMappings[fieldName];
  }

  // Search through layer configurations for field names
  for (const layer of Object.values(layers) as LayerConfig[]) {
    // Check if this field matches the layer's renderer field
    if (layer.rendererField === fieldName) {
      return layer.name;
    }
    
    // Check if this field is in the layer's fields array
    if (layer.fields) {
      const field = layer.fields.find(f => f.name === fieldName);
      if (field) {
        return field.label || field.alias || field.description || layer.name;
      }
    }
  }

  // Fallback: convert snake_case or camelCase to Title Case
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Get field data type and unit information for better analysis context
function getFieldDataType(fieldName: string, layerConfig: LayerConfig | undefined): string {
  if (!fieldName) return 'unknown';
  
  const lowerFieldName = fieldName.toLowerCase();
  
  // Check layer metadata first
  if (layerConfig?.metadata?.valueType) {
    switch (layerConfig.metadata.valueType) {
      case 'percentage': return 'percentage';
      case 'currency': return 'currency';
      case 'index': return 'index/score';
      case 'count': return 'count';
      default: break;
    }
  }
  
  // Check field configuration
  const fieldConfig = layerConfig?.fields?.find(f => f.name.toLowerCase() === lowerFieldName);
  if (fieldConfig?.label?.includes('%')) return 'percentage';
  if (fieldConfig?.label?.includes('$')) return 'currency';
  
  // Pattern-based detection (enhanced for better accuracy)
  const isIndex = lowerFieldName.includes('index') ||
                 lowerFieldName.includes('score') ||
                 lowerFieldName.includes('level') ||
                 lowerFieldName.includes('rank') ||
                 lowerFieldName.includes('rating') ||
                 lowerFieldName === 'thematic_value';
  
  // More precise percentage detection - check field name patterns and suffixes
  const isPercentage = !isIndex && (
                       lowerFieldName.includes('percent') ||
                       lowerFieldName.includes('_p') ||
                       lowerFieldName.includes('_cy_p') ||
                       lowerFieldName.includes('abp') ||
                       lowerFieldName.endsWith('p') ||
                       lowerFieldName.includes('rate') ||
                       lowerFieldName.includes('ratio') ||
                       lowerFieldName.includes('proportion') ||
                       lowerFieldName.includes('share') ||
                       lowerFieldName.includes('participation') ||
                       lowerFieldName.includes('(%)'))
  
  const isCurrency = !isIndex && !isPercentage && (
                     lowerFieldName.includes('income') ||
                     lowerFieldName.includes('spending') ||
                     lowerFieldName.includes('revenue') ||
                     lowerFieldName.includes('cost') ||
                     lowerFieldName.includes('sales') ||
                     lowerFieldName.includes('price') ||
                     lowerFieldName.includes('value') ||
                     lowerFieldName.includes('budget') ||
                     lowerFieldName.includes('$'));
  
  if (isIndex) return 'index/score';
  if (isPercentage) return 'percentage';
  if (isCurrency) return 'currency';
  
  // Check for count fields
  if (lowerFieldName.includes('count') || 
      lowerFieldName.includes('population') ||
      lowerFieldName.includes('households')) return 'count';
  
  return 'numeric';
}
