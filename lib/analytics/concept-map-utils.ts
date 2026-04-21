/* eslint-disable no-inner-declarations */
// import fs from 'fs';
// import path from 'path';

import conceptMap from '../../config/concept-map.json';

/**
 * Utilities for concept map creation and query matching
 */

// Type definitions for concept sub-elements
export interface ConceptSubtype {
  canonical: string;
  synonyms: string[];
  layers: string[];
}

// Main ConceptMap interface
export interface ConceptMap {
  [key: string]: {
    concept: string;
    canonical: string;  // Added canonical field
    subtype?: string;
    synonyms?: string[];
    layers?: string[];
    subtypes?: Record<string, ConceptSubtype>;  // Added subtypes field
  };
}

/**
 * Loads or creates a concept map from layer configurations
 */
export function loadConceptMap(): ConceptMap {
  // This is a placeholder that will be filled when integrating with the app
  return {};
}

/**
 * Match a query string against concepts in a concept map
 * @param query - The user query string
 * @param conceptMap - The concept map to match against
 * @returns Array of matches with relevance scores
 */
export function matchQueryToConcepts(query: string, conceptMap: ConceptMap): Array<{
  concept: string;
  subtype?: string;
  matchedTerm: string;
  layers: string[];
}> {
  const queryLower = query.toLowerCase();
  const matches: Array<{
    concept: string;
    subtype?: string;
    matchedTerm: string;
    layers: string[];
  }> = [];

  // Extract meaningful terms from the query
  const queryTokens = queryLower.match(/\b[a-z0-9']+\b/g) || [];
  
  // For each concept in the concept map
  for (const [layerId, conceptEntry] of Object.entries(conceptMap)) {
    if (!conceptEntry.concept) continue;
    
    // Check direct concept name match
    if (queryLower.includes(conceptEntry.concept.toLowerCase())) {
      matches.push({
        concept: conceptEntry.concept,
        subtype: conceptEntry.subtype,
        matchedTerm: conceptEntry.concept,
        layers: conceptEntry.layers || [layerId]
      });
      continue;
    }
    
    // Check synonym matches
    if (conceptEntry.synonyms && conceptEntry.synonyms.length > 0) {
      for (const synonym of conceptEntry.synonyms) {
        if (queryLower.includes(synonym.toLowerCase())) {
          matches.push({
            concept: conceptEntry.concept,
            subtype: conceptEntry.subtype,
            matchedTerm: synonym,
            layers: conceptEntry.layers || [layerId]
          });
          break;
        }
      }
    }
  }
  
  return matches;
}

// Type definitions for original concept map structure 
// Keeping for backwards compatibility
export interface Concept {
  canonical: string;
  synonyms: string[];
  subtypes: Record<string, ConceptSubtype>;
}

// Flatten all synonyms (including canonical) for fast matching
export function getAllSynonyms(conceptMap: ConceptMap): Record<string, {concept: string, subtype?: string}> {
  const synonymMap: Record<string, {concept: string, subtype?: string}> = {};
  for (const conceptKey in conceptMap) {
    const concept = conceptMap[conceptKey];

    // Use the canonical field if available, otherwise fall back to concept name
    const canonical = concept.canonical || concept.concept;
    
    // Concept-level synonyms - ensure we have arrays to spread
    const conceptSynonyms = concept.synonyms || [];
    [canonical, ...conceptSynonyms].forEach(syn => {
      if (syn) {  // Ensure the synonym is defined
        synonymMap[syn.toLowerCase()] = { concept: conceptKey };
      }
    });
    
    // Handle subtypes if present
    if (concept.subtypes) {
      // Recursively add all subtypes and their synonyms
      addSubtypesToSynonymMap(concept.subtypes, conceptKey);
    }
  }
  return synonymMap;
}

// Recursive helper to add subtypes to the synonym map
function addSubtypesToSynonymMap(subtypes: Record<string, ConceptSubtype>, conceptKey: string) {
  if (!subtypes) return;
  
  for (const subtypeKey in subtypes) {
    const subtype = subtypes[subtypeKey];
    if (subtype && subtype.canonical) {
      const subtypeSynonyms = subtype.synonyms || [];
      [subtype.canonical, ...subtypeSynonyms].forEach(syn => {
        if (syn) {  // Ensure the synonym is defined
          synonymMap[syn.toLowerCase()] = { concept: conceptKey, subtype: subtypeKey };
        }
      });
    }
    
    // Check for nested subtypes recursively
    if (subtype && (subtype as any).subtypes) {
      addSubtypesToSynonymMap((subtype as any).subtypes, conceptKey);
    }
  }
}

// Helper to recursively find a subtype by key in nested subtypes
function findSubtype(subtypes: Record<string, ConceptSubtype> | undefined, subtypeKey: string): ConceptSubtype | undefined {
  if (!subtypes) return undefined;
  if (subtypes[subtypeKey]) return subtypes[subtypeKey];
  
  for (const key in subtypes) {
    const subtype = subtypes[key];
    const nestedSubtypes = (subtype as any).subtypes;
    
    if (nestedSubtypes) {
      const found = findSubtype(nestedSubtypes, subtypeKey);
      if (found) return found;
    }
  }
  
  return undefined;
}

// Given a query, return matched concepts/subtypes and their layers
export function matchQueryToConceptsOld(query: string, conceptMap: ConceptMap) {
  const tokens = query.toLowerCase().match(/\b(\w+)\b/g) || [];
  const phrases = query.toLowerCase().split(/[,.;?!]/).map(s => s.trim());
  const synonymMap = getAllSynonyms(conceptMap);
  const matched: {concept: string, subtype?: string, layers: string[], matchedTerm: string, matchLength: number}[] = [];
  const seen = new Set<string>();

  // Helper for basic stemming (plural to singular)
  function stem(word: string) {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
    return word;
  }

  // Sort synonyms by length (desc) to prioritize longer matches
  const sortedSynonyms = Object.keys(synonymMap).sort((a, b) => b.length - a.length);

  // Try to match phrases first (for multi-word synonyms)
  for (const phrase of phrases) {
    for (const syn of sortedSynonyms) {
      if ((phrase.includes(syn) || phrase.includes(stem(syn))) && !seen.has(syn)) {
        const { concept, subtype } = synonymMap[syn];
        let layers: string[] = [];
        
        if (subtype && conceptMap[concept].subtypes) {
          const foundSubtype = findSubtype(conceptMap[concept].subtypes, subtype);
          layers = foundSubtype?.layers || [];
        } else if (conceptMap[concept].subtypes) {
          // Get layers from all subtypes
          layers = Object.values(conceptMap[concept].subtypes).flatMap(st => st.layers || []);
        } else {
          // Fallback to concept-level layers
          layers = conceptMap[concept].layers || [];
        }
        
        matched.push({ concept, subtype, layers, matchedTerm: syn, matchLength: syn.length });
        seen.add(syn);
      }
    }
  }
  
  // Then match individual tokens (with stemming)
  for (const token of tokens) {
    const tokenStem = stem(token);
    for (const syn of sortedSynonyms) {
      if ((token === syn || tokenStem === syn) && !seen.has(syn)) {
        const { concept, subtype } = synonymMap[syn];
        let layers: string[] = [];
        
        if (subtype && conceptMap[concept].subtypes) {
          const foundSubtype = findSubtype(conceptMap[concept].subtypes, subtype);
          layers = foundSubtype?.layers || [];
        } else if (conceptMap[concept].subtypes) {
          // Get layers from all subtypes
          layers = Object.values(conceptMap[concept].subtypes).flatMap(st => st.layers || []);
        } else {
          // Fallback to concept-level layers
          layers = conceptMap[concept].layers || [];
        }
        
        matched.push({ concept, subtype, layers, matchedTerm: syn, matchLength: syn.length });
        seen.add(syn);
      }
    }
  }
  
  // Prioritize longer matches (more specific) over shorter ones
  matched.sort((a, b) => b.matchLength - a.matchLength);
  // Remove matchLength from output for compatibility
  const cleanedMatches = matched.map(({matchLength, ...rest}) => rest);

  // --- DIVERSITY PRIORITIZATION LOGIC ---
  const hasDiversity = cleanedMatches.some(m => m.subtype === 'diversity');
  const hasRace = cleanedMatches.some(m => m.subtype === 'race');
  if (hasDiversity && hasRace) {
    // Remove the 'race' match if 'diversity' is present
    return cleanedMatches.filter(m => m.subtype !== 'race');
  }
  return cleanedMatches;
}

// Declare synonymMap for use in addSubtypesToSynonymMap
const synonymMap: Record<string, {concept: string, subtype?: string}> = {};
