/* eslint-disable prefer-const */
import { AnalysisResult } from './types';
import { concepts, layers as layerConfigsObject } from '../../config/layers'; // Import concepts
import type { LayerConfig } from '../../types/layers'; // Import LayerConfig from types
import { ConceptMap } from './concept-map-utils';

// Define the type for the keys of layerConcepts explicitly
type ConceptKey = keyof typeof concepts; // Use the imported concepts directly

interface AnalysisContext {
  layerResults?: any[]; // Consider defining a stricter type later
  visualizationResult?: any; // Consider defining a stricter type later
}

// Define valid query types for type guards
const validQueryTypes: AnalysisResult['queryType'][] = [
  'unknown', 'correlation', 'distribution', 'topN', 'jointHigh', 'comparison', 'simple_display', 'choropleth', 'outlier', 'interaction', 'scenario'
];

// --- NEW: Enhanced QueryAnalysis interface ---
export interface QueryAnalysis {
  queryType: 'unknown' | 'correlation' | 'distribution' | 'topN' | 'jointHigh' | 'comparison' | 'simple_display' | 'choropleth' | 'outlier' | 'interaction' | 'scenario';
  entities: string[];
  intent: 'unknown' | 'trends' | 'correlation' | 'distribution' | 'information' | 'visualization_request' | 'ranking' | 'comparison' | 'location';
  confidence: number;
  layers: Array<{
    layerId: string;
    relevance: number;
    matchMethod: string;
    confidence: number;
    reasons: string[];
  }>;
  timeframe: string;
  searchType: 'web' | 'images' | 'news' | 'youtube' | 'shopping';
  relevantLayers: string[];
  explanation: string;
  refinements: string[];
  originalQueryType: 'unknown' | 'correlation' | 'distribution' | 'topN' | 'jointHigh' | 'comparison' | 'simple_display' | 'choropleth' | 'outlier' | 'interaction' | 'scenario';
  relevantFields?: string[];
  comparisonParty?: string;
  topN?: number;
  isCrossGeography?: boolean;
  trendsKeyword?: string;
  populationLookup?: Map<string, number>;
  reasoning?: string;
  metrics?: { r: number; pValue?: number };
  correlationMetrics?: { r: number; pValue?: number };
  thresholds?: Record<string, number>;
}

// --- NEW: Pattern-based query type detection ---
interface PatternRule {
  type: AnalysisResult['queryType'];
  patterns: RegExp[];
  keywords: string[];
  priority: number;
  confidence: number;
}

// Update the pattern rules to use correct types with enhanced patterns
const patternRules: PatternRule[] = [
  {
    type: 'outlier',
    patterns: [
      /\b(outlier|outliers|anomal|anomaly|anomalies|anomalous|unusual|strange|weird|different|abnormal|atypical|exceptional|irregular|deviant)\b/i,
      /\b(find|identify|show|locate)\b.*\b(unusual|strange|anomalous|outlier|different|abnormal|atypical|exceptional|irregular|deviant)\b/i
    ],
    keywords: ['outlier', 'outliers', 'anomaly', 'anomalies', 'anomalous', 'unusual', 'strange', 'weird', 'different', 'abnormal'],
    priority: 1,
    confidence: 0.9
  },
  {
    type: 'interaction',
    patterns: [
      /(?:interaction|combination|together|combined|synerg|amplif).*(?:effect|impact|influence)/i,
      /how.*(?:work|combine|interact).*together/i,
      /\b(amplify|amplifying|synergy|synergistic|combined effect|interaction effect|multiplicative)\b/i
    ],
    keywords: ['interaction', 'combination', 'together', 'combined', 'synergy', 'amplify', 'effect', 'impact'],
    priority: 2,
    confidence: 0.85
  },
  {
    type: 'scenario',
    patterns: [/(?:what if|if.*increase|if.*decrease|scenario|simulate)/i, /(?:what would happen|how would.*change|impact of)/i],
    keywords: ['what if', 'scenario', 'simulate', 'what would happen', 'impact of'],
    priority: 3,
    confidence: 0.8
  },
  {
    type: 'jointHigh',
    patterns: [
      /\b(find|show|identify|locate)\b.*\b(areas?|regions?|places?|locations?)\b.*\b(where|with)\b.*\b(both|two|2)\b.*\b(high|elevated|above average|significant)\b/i,
      /\b(areas?|regions?|places?|locations?)\b.*\b(both|two|2)\b.*\b(high|elevated|significant|above average)\b/i
    ],
    keywords: ['both high', 'joint high', 'areas with high', 'where both'],
    priority: 4,
    confidence: 0.8
  },
  {
    type: 'correlation',
    patterns: [
      /\b(correlat|relationship|connect|link|associat|related|pattern)\b/i,
      /how.*(?:relate|connect|influence|affect|impact)/i
    ],
    keywords: ['correlation', 'relationship', 'compare', 'versus', 'vs'],
    priority: 5,
    confidence: 0.75
  },
  {
    type: 'distribution',
    patterns: [
      /\b(distribut|spread|pattern|across|throughout|variation)\b/i,
      /\b(how.*distributed|where.*located|spatial pattern)\b/i
    ],
    keywords: ['distribution', 'spread', 'range', 'variation', 'trend', 'trending'],
    priority: 6,
    confidence: 0.7
  },
  {
    type: 'topN',
    patterns: [
      /\b(top|best|highest|most|greatest|maximum|largest|biggest)\b/i,
      /\b(rank|ranking|order|sort|list)\b/i
    ],
    keywords: ['top', 'highest', 'most'],
    priority: 7,
    confidence: 0.65
  },
  {
    type: 'simple_display',
    patterns: [
      /\b(show|display|view|see|what|where|find)\b/i
    ],
    keywords: ['show', 'display', 'visualize'],
    priority: 8,
    confidence: 0.5
  }
];

// --- NEW: Pattern-based query intent detection ---
export function determineQueryIntent(query: string): QueryAnalysis['intent'] {
  // Simple intent detection based on keywords
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('trend') || lowerQuery.includes('over time') || lowerQuery.includes('popularity')) {
    return 'trends';
  }
  
  if (lowerQuery.includes('compare') || lowerQuery.includes(' vs ') || 
      lowerQuery.includes('correlation') || lowerQuery.includes('relationship')) {
    return 'correlation';
  }
  
  if (lowerQuery.includes('distribution') || lowerQuery.includes('spread') || 
      lowerQuery.includes('concentration') || lowerQuery.includes('where')) {
    return 'distribution';
  }
  
  if (lowerQuery.includes('show') || lowerQuery.includes('display') || 
      lowerQuery.includes('visualize') || lowerQuery.includes('create')) {
    return 'visualization_request';
  }
  
  if (lowerQuery.includes('top') || lowerQuery.includes('highest') || 
      lowerQuery.includes('lowest') || lowerQuery.includes('ranking')) {
    return 'ranking';
  }
  
  // Default if nothing else matches
  return 'information';
}

// --- NEW: Type for the Inverted Index ---
type InvertedIndex = {
  [keyword: string]: string[]; // Map from lowercase keyword to array of layer IDs
};

// --- Helper: Simple Singularization ---
function normalizeToken(token: string): string {
  // Lowercase, trim, and singularize (very basic: remove trailing 's' if >3 chars)
  token = token.toLowerCase().trim();
  if (token.length > 3 && token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

// --- NEW: Function to Build the Inverted Index ---
export function buildInvertedIndex(
  layers: Record<string, LayerConfig>, 
  conceptsData: typeof concepts // Use the actual type of the imported concepts
): InvertedIndex {
  // console.log("[buildInvertedIndex] Starting index build...");
  const index: { [keyword: string]: Set<string> } = {}; // Use Set internally for uniqueness

  // Helper to add a keyword-layerId pair to the index
  function addKeyword(keyword: string | undefined | null, layerId: string) {
    if (!keyword) return;
    keyword = normalizeToken(keyword); // <-- Normalize here
    // Basic stop word check + length check
    if (!keyword || keyword.length < 3 || ['the', 'and', 'for', 'with', 'more'].includes(keyword)) return; 

    if (!index[keyword]) {
      index[keyword] = new Set();
    }
    index[keyword].add(layerId);
    // console.log(`[buildInvertedIndex] Added keyword '${keyword}' for layer '${layerId}'`);
  }

  // 1. Create a map of concept terms for faster lookup
  const conceptTermMap: { [term: string]: ConceptKey[] } = {};
  for (const conceptKey in conceptsData) {
    const key = conceptKey as ConceptKey;
    conceptsData[key].terms.forEach(term => {
      const lowerTerm = term.toLowerCase();
      if (!conceptTermMap[lowerTerm]) {
        conceptTermMap[lowerTerm] = [];
      }
      conceptTermMap[lowerTerm].push(key);
    });
  }
   // console.log("[buildInvertedIndex] Concept term map created.");

  // 2. Iterate through layers to add keywords to the index
  // console.log(`[buildInvertedIndex] Processing ${Object.keys(layers).length} layers...`);
  for (const layerId in layers) {
    const config = layers[layerId];
    if (!config) continue;

    // Add keywords from layer ID
    addKeyword(layerId, layerId);

    // Add keywords from layer Name (split into words)
    config.name?.match(/\b(\w+)\b/g)?.forEach(word => addKeyword(word, layerId));

    // Add keywords from Tags
    config.metadata?.tags?.forEach(tag => {
       addKeyword(tag, layerId);
       // If a tag is also a concept term, add the concept name itself as a keyword too
       if (conceptTermMap[tag.toLowerCase()]) {
         conceptTermMap[tag.toLowerCase()].forEach(conceptName => addKeyword(String(conceptName), layerId));
       }
    });

    // Add keywords from associated Concept terms (if layer tags match any concept term)
    const layerTagsLower = config.metadata?.tags?.map(t => t.toLowerCase()) || [];
    const matchedConcepts = new Set<ConceptKey>();
    layerTagsLower.forEach(tag => {
        if (conceptTermMap[tag]) {
            conceptTermMap[tag].forEach(conceptName => matchedConcepts.add(conceptName));
        }
    });
    
    matchedConcepts.forEach(conceptName => {
        // Add the concept name itself
        addKeyword(String(conceptName), layerId);
        // Add all terms associated with that concept
        conceptsData[conceptName].terms.forEach(term => addKeyword(term, layerId));
    });

    // Add keywords from field names/aliases/labels (optional, can be noisy)
    // config.fields?.forEach(field => {
    //   addKeyword(field.name, layerId);
    //   addKeyword(field.alias, layerId);
    //   addKeyword(field.label, layerId);
    // });
     
    // Add renderer field
    addKeyword(config.rendererField, layerId);
  }

  // Convert Sets to Arrays for the final index structure
  const finalIndex: InvertedIndex = {};
  let keywordCount = 0;
  for (const keyword in index) {
    finalIndex[keyword] = Array.from(index[keyword]);
    keywordCount++;
  }

  // console.log(`[buildInvertedIndex] Index created successfully with ${keywordCount} keywords.`);
  // console.log("[buildInvertedIndex] Sample Index Entry (population):", finalIndex['population']); // Example log
  return finalIndex;
}

// --- NEW: Function to Analyze Query using the Inverted Index ---
export async function analyzeQueryWithIndex(
  query: string,
  index: InvertedIndex,
  layerConfigs: Record<string, LayerConfig>,
  initialScores: Record<string, number> = {} // Rename to avoid confusion
): Promise<AnalysisResult> {
  // console.log(`[analyzeQueryWithIndex] Received query: "${query}"`);
  const lowerQuery = query.toLowerCase();
  // More robust tokenization might be needed (e.g., handle punctuation, multi-word phrases)
  const queryTokens = lowerQuery.match(/\b(\w+)\b/g)?.filter(token => token.length >= 3) || []; 
  const normalizedTokens = queryTokens.map(token => normalizeToken(token)); // <-- Normalize tokens

  let matchedKeywordsCount = 0;

  // console.log(`[analyzeQueryWithIndex] Query Tokens: ${queryTokens.join(', ')}`);

  // Initialize scores at the start of the function
  const scores: Record<string, number> = { ...initialScores };
  const allowedQueryTypes: AnalysisResult['queryType'][] = [
    'unknown', 'correlation', 'distribution', 'comparison', 'choropleth', 'topN', 'jointHigh', 'simple_display', 'outlier', 'scenario', 'interaction'
  ];
  let safeQueryType: AnalysisResult['queryType'] = 'unknown';

  // Look up each normalized query token in the index
  normalizedTokens.forEach((token: string) => {
    if (index[token]) {
      // console.log(`[analyzeQueryWithIndex] Token '${token}' matched layers: ${index[token].join(', ')}`);
      matchedKeywordsCount++;
      index[token].forEach((layerId: string) => {
        // Basic scoring: +1 for each token match
        scores[layerId] = (scores[layerId] || 0) + 1; 
        
        // --- NEW: Boost score for exact name or tag match ---
        const config = layerConfigs[layerId];
        if (config) {
          // Check for exact match with layer name (normalized)
          const nameWords = config.name?.match(/\b(\w+)\b/g)?.map(normalizeToken) || [];
          const tagWords = config.metadata?.tags?.map(normalizeToken) || [];
          if (nameWords.includes(token) || tagWords.includes(token)) {
            scores[layerId] += 3; // Boost value (tweakable)
            // console.log(`[analyzeQueryWithIndex] BOOST: Token '${token}' is an exact match for layer '${layerId}' name or tag. Score boosted.`);
          }
        }
        // --- END BOOST ---
      });
    } else {
       // console.log(`[analyzeQueryWithIndex] Token '${token}' not found in index.`);
    }
  });

  if (Object.keys(scores).length === 0) {
    console.warn("[analyzeQueryWithIndex] No layers found matching any query tokens.");
    // Return default/empty analysis
    return {
      intent: 'information', // Default
      relevantLayers: [],
      queryType: 'unknown', // Default
      confidence: 0.1,
      explanation: "Could not identify relevant layers based on the query keywords and the index.",
      relevantFields: [],
      originalQueryType: determineQueryType(query), // Use original helper
      trendsKeyword: extractTrendsKeyword(query), // Use original helper
      entities: [], // Required by AnalysisResult
      layers: [], // Required by AnalysisResult
      timeframe: '', // Required by AnalysisResult
      searchType: 'web' as const // Required by AnalysisResult
    };
  }

  // Sort layers by score (descending)
  const sortedLayers = Object.entries(scores)
                           .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

  // console.log(`[analyzeQueryWithIndex] Layer Scores:`, sortedLayers);

  // --- Layer Selection Logic ---
  // Option A: Simple Top N (e.g., Top 2)
  // const topN = 2;
  // const selectedLayerIds = sortedLayers.slice(0, topN).map(([layerId]) => layerId);

  // Option B: Score Threshold + Max Layers
  const scoreThreshold = 1; // Minimum score to be considered
  const maxLayers = 3; // Max number of layers to return
  const filteredLayers = sortedLayers.filter(([, score]) => score >= scoreThreshold);
  
  // If multiple layers have the *same top score*, include them all (up to maxLayers)
  const topScore = filteredLayers.length > 0 ? filteredLayers[0][1] : 0;
  let selectedLayerIds = filteredLayers
      .filter(([, score]) => score === topScore) // Get all layers with the absolute top score
      .map(([layerId]) => layerId);
  
  // If fewer than maxLayers were selected based on top score alone, add the next best unique scores
  if (selectedLayerIds.length < maxLayers) {
      const remainingLayers = filteredLayers
          .filter(([, score]) => score < topScore) // Get layers below the top score
          .slice(0, maxLayers - selectedLayerIds.length) // Take enough to reach maxLayers
          .map(([layerId]) => layerId);
      selectedLayerIds.push(...remainingLayers);
  }
  
  selectedLayerIds = selectedLayerIds.slice(0, maxLayers); // Ensure we don't exceed maxLayers

  // console.log(`[analyzeQueryWithIndex] Selected Layers (Score >= ${scoreThreshold}, Max ${maxLayers}): ${selectedLayerIds.join(', ')}`);

  // --- Determine Final Intent/Type (using the *selected* layers) ---
  // Reuse existing helpers, but apply logic based on the outcome of the index search
  let finalIntent = determineQueryIntent(query); 
  let finalQueryType = determineQueryType(query);

  // Refine intent/type based on *selected* layers
  if (selectedLayerIds.length === 0) {
      finalIntent = 'information';
    finalQueryType = 'unknown';
  } else if (selectedLayerIds.length > 1) {
      finalIntent = 'comparison'; 
    if (finalQueryType === 'unknown' || finalQueryType === 'distribution') {
         if (lowerQuery.includes('correlation') || lowerQuery.includes('relationship') || lowerQuery.includes(' vs ')) {
             finalQueryType = 'correlation';
         } else {
        finalQueryType = 'distribution';
         }
      } 
  } else {
    if (finalQueryType === 'unknown') finalQueryType = 'distribution';
      if (finalIntent === 'comparison') finalIntent = 'information'; 
  }

  // --- Extract Fields & Confidence ---
  const finalRelevantFieldNames = new Set<string>();
  selectedLayerIds.forEach(id => {
     const config = layerConfigs[id];
     if(config?.rendererField) finalRelevantFieldNames.add(config.rendererField);
     // Maybe add primary display fields if defined?
     // config?.fields?.forEach(f => { if (f.isPrimaryDisplay) finalRelevantFieldNames.add(f.name); });
  });

  // Confidence Calculation (Example - needs refinement)
  // Factors: number of matched keywords, score of selected layers, specificity of keywords?
  const maxPossibleScore = queryTokens.length; // Simplistic max score
  const actualTopScore = sortedLayers.length > 0 ? sortedLayers[0][1] : 0;
  let confidence = 0.3; // Base confidence
  if (selectedLayerIds.length > 0 && maxPossibleScore > 0) {
      confidence += (matchedKeywordsCount / queryTokens.length) * 0.3; // % of query words matched
      confidence += (actualTopScore / maxPossibleScore) * 0.2; // How high was the top score relative to max possible
      confidence += Math.min(selectedLayerIds.length, 2) * 0.1; // Bonus for finding 1 or 2 layers
  }
  confidence = Math.min(confidence, 0.95); // Cap confidence

  const explanation = `Analyzed query using index. Found ${selectedLayerIds.length} relevant layer(s) based on keyword matches. Matched ${matchedKeywordsCount}/${queryTokens.length} query tokens. Top score: ${actualTopScore}.`;

  // console.log('[analyzeQueryWithIndex][Final Result]', {
  //   finalIntent: finalIntent,
  //   finalQueryType: finalQueryType,
  //   finalLayers: selectedLayerIds, 
  //   finalFields: Array.from(finalRelevantFieldNames), 
  //   finalConfidence: confidence,
  //   finalExplanation: explanation
  // });

  // When assigning queryType, ensure it's a valid value
  safeQueryType = allowedQueryTypes.includes(finalQueryType as AnalysisResult['queryType'])
    ? (finalQueryType as AnalysisResult['queryType'])
    : 'unknown';

  // --- Return Result ---
  const result: AnalysisResult = {
    intent: finalIntent as AnalysisResult['intent'],
    relevantLayers: selectedLayerIds,
    queryType: safeQueryType,
    confidence,
    explanation,
    relevantFields: Array.from(finalRelevantFieldNames),
    originalQueryType: determineQueryType(query),
    trendsKeyword: extractTrendsKeyword(query),
    comparisonParty: undefined,
    topN: undefined,
    entities: [], // Required by AnalysisResult
    layers: selectedLayerIds.map(id => ({
      layerId: id,
      relevance: scores[id] || 0,
      matchMethod: 'keyword',
      confidence: scores[id] || 0,
      reasons: []
    })),
    timeframe: '', // Required by AnalysisResult
    searchType: 'web' as const // Required by AnalysisResult
  };

  return result;
}

// Helper to extract brand names from query
function extractBrandKeywords(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const brands: string[] = [];
  
  // Regex to check for capitalized words (simplistic, might need refinement)
  // Ensures we are checking the original query casing later
  const capitalizedWordRegex = (term: string) => new RegExp(`\\b${term}\\b`); 

  // Use the imported 'concepts' directly
  const brandTerms = concepts.brands.terms; 

  brandTerms.forEach((term: string) => {
      // Check if term exists in the lowercased query first for efficiency
      if (lowerQuery.includes(term.toLowerCase())) {
        let isLikelyBrand = false;

        if (term.toLowerCase() === 'on') {
          // SPECIAL CASE for "On": Require it to be capitalized in the original query
          if (capitalizedWordRegex('On').test(query)) {
            // console.log(`[extractBrandKeywords] Found capitalized 'On' in query.`);
            isLikelyBrand = true;
          } else {
            // console.log(`[extractBrandKeywords] Found lowercase 'on', likely preposition, skipping.`);
          }
        } else {
          // GENERAL CASE: Check if the term is capitalized in the original query OR is multi-word OR is just a known brand > 2 chars
          // This favors capitalized matches but allows known multi-word or longer brands even if lowercase.
          if (capitalizedWordRegex(term).test(query) || term.includes(' ') || term.length > 2) {
             isLikelyBrand = true;
          } else {
             // console.log(`[extractBrandKeywords] Skipping likely common word: '${term}' (not capitalized, short, single word).`);
          }
        }

        if (isLikelyBrand && !brands.includes(term)) {
          // console.log(`[extractBrandKeywords] Adding likely brand: ${term}`);
          brands.push(term);
        }
      }
    });
    
  // Add common variations if needed (can be moved inside loop if preferred)
  if (brands.includes("Dick's Sporting Goods")) brands.push("Dicks Sporting Goods"); // Handle apostrophe variations

  // console.log(`[extractBrandKeywords] Final extracted brands: ${brands.join(', ')}`)
  return brands;
}

// Add new function to detect trends correlation queries
function isTrendsCorrelationQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const trendsKeywords = ['trend', 'trending', 'popularity', 'interest over time', 'search volume', 'google trends'];
  const correlationKeywords = ['correlation', 'relationship', 'compare', 'versus', ' vs ', 'between', 'relate', 'connection'];
  
  return trendsKeywords.some(trend => lowerQuery.includes(trend)) && 
         correlationKeywords.some(corr => lowerQuery.includes(corr));
}

// Main analysis function (OLD - Keep for reference or remove later)
export async function analyzeQuery(
  query: string,
  layerConfigs: { [key: string]: LayerConfig }, 
  context?: AnalysisContext
): Promise<AnalysisResult> {
  console.warn(`[analyzeQuery - Deprecated] This function is deprecated. Use analyzeQueryWithIndex instead.`);
  console.log(`[analyzeQuery] Received query: "${query}"`);
  
  const lowerQuery = query.toLowerCase();
  let explanation = `Analyzed query: "${query}". `;
  let confidence = 0.6; // Start lower, increase with matches
  let matchedThemes: string[] = []; // Track themes found
  let finalRelevantLayerIds = new Set<string>();
  let finalRelevantFieldNames = new Set<string>();
  const allowedQueryTypes: AnalysisResult['queryType'][] = [
    'unknown', 'correlation', 'distribution', 'comparison', 'choropleth', 'topN', 'jointHigh', 'simple_display'
  ];
  let safeQueryType: AnalysisResult['queryType'] = 'unknown';
  const scores: Record<string, number> = {}; // Initialize scores object

  console.log('[analyzeQuery] Running analysis...');

  // --- Concept-Based Analysis using Tags ---
  console.log('[analyzeQuery] Checking concepts via tags...');
  const foundConcepts: string[] = [];
  const conceptWeights: { [key: string]: number } = {};

  // Use the imported 'concepts' object 
  for (const conceptName in concepts) {
    // Explicitly ensure conceptName is treated as a string key
    const currentConceptName = String(conceptName) as keyof typeof concepts;
    const concept = concepts[currentConceptName];

    // Explicitly type 'term' in the find callback
    const matchedTerm = concept.terms.find((term: string) => lowerQuery.includes(term.toLowerCase()));

    if (matchedTerm) {
      // Use String() to avoid implicit symbol conversion in logs
      console.log(`[analyzeQuery] Query potentially related to concept: ${String(currentConceptName)} via terms: ${matchedTerm}`);
      
      // Standard concept matching: If the concept hasn't been found yet, add it.
      if (!foundConcepts.includes(String(currentConceptName))) { // Use String() for includes check
          console.log(`[analyzeQuery][Concept Match] Found concept: ${String(currentConceptName)}`); // Use String() for log
          foundConcepts.push(String(currentConceptName)); // Use String() for push
          conceptWeights[String(currentConceptName)] = concept.weight; // Use String() as key
      }
    }
  }

  // Layer Matching Logic (Example Refinement)
  let matchedConceptsToKeywords: Record<string, string[]> = {}; // Track which keywords matched which concept

  for (const key in concepts) {
    const conceptKey = key as ConceptKey; // Convert to string and assert type
    const concept = concepts[conceptKey];
    const matchingTerms = concept.terms.filter((term: string) => lowerQuery.includes(term.toLowerCase()));

    if (matchingTerms.length > 0) {
      console.log(`[analyzeQuery] Query potentially related to concept: ${String(conceptKey)} via terms: ${matchingTerms.join(', ')}`);
      matchedThemes.push(String(conceptKey));
      console.log(`[analyzeQuery][Concept Match] Found concept: ${String(conceptKey)}`);
      let foundMatchForConcept = false;
      matchedConceptsToKeywords[String(conceptKey)] = matchingTerms; // Store which terms matched

      // Find layers tagged with this concept's terms
      for (const layerId in layerConfigsObject) { // Use the imported object
        const config = layerConfigsObject[layerId];
        const tags = config.metadata?.tags?.map(t => t.toLowerCase()) || [];

        // Check if any concept term is present in the layer's tags
        const layerMatchesConceptTag = matchingTerms.some((term: string) => tags.includes(term.toLowerCase()));

        // Check if the query itself contains terms related to the layer name/ID
        const layerNameOrIdMatchesQuery = lowerQuery.split(/\s+|,|\band\b/).filter(word => word.trim().length > 2).some(qKeyword =>
             layerId.toLowerCase().includes(qKeyword) ||
             config.name.toLowerCase().includes(qKeyword)
        );

        // <<< MODIFIED Condition: Prioritize Concept Tag Match >>>
        if (layerMatchesConceptTag) {
          console.log(`[analyzeQuery][Layer Match - Concept Tag] Layer '${layerId}' matches concept '${String(conceptKey)}' via tag/term: ${matchingTerms.join(', ')}`);
          // Add layer and field if a tag matches
          finalRelevantLayerIds.add(layerId);
          if (config.rendererField) finalRelevantFieldNames.add(config.rendererField);

          // Boost confidence more if layer name/ID is also mentioned directly
          if (layerNameOrIdMatchesQuery) {
              console.log(`[analyzeQuery][Layer Match - Boost] Layer name/ID also mentioned in query.`);
              confidence += 0.15; // Higher boost for explicit mention + tag match
          } else {
              confidence += 0.05; // Basic boost for tag match only
          }
          foundMatchForConcept = true;
        } else if (layerNameOrIdMatchesQuery) {
           // Optional: Match if only name/ID mentioned but not tag? Add with lower confidence.
           console.log(`[analyzeQuery][Layer Match - Name Only] Layer '${layerId}' name/ID mentioned in query, but no tag match for concept '${String(conceptKey)}'}'. Adding with lower confidence.`);
           finalRelevantLayerIds.add(layerId);
           if (config.rendererField) finalRelevantFieldNames.add(config.rendererField);
           confidence += 0.02; // Very low boost for name match without tag context
           // Consider if this should set foundMatchForConcept = true; maybe not if we prioritize concepts?
        } else {
            // Log layers that match neither for this concept (can be verbose)
            // console.log(`[analyzeQuery][Layer Match - SKIPPED] Layer '${layerId}' does not match concept '${conceptKey}' via tags or name mention.`);
        }
      }
       if (!foundMatchForConcept) {
           console.log(`[analyzeQuery] Concept '${String(conceptKey)}' mentioned in query but no matching layer found via tags/name.`);
       }
    }
  }

  // --- Explicit Sales Proxy Rule ---
  const mentionsSales = concepts.spending.terms.some(term => lowerQuery.includes(term.toLowerCase()) && term !== 'spending'); // Check for buy/purchase etc.
  const mentionsHighLow = lowerQuery.includes('high') || lowerQuery.includes('low') || lowerQuery.includes('concentration');
  // Use the refined function which checks casing for "On"
  const mentionedBrands = extractBrandKeywords(query); 

  // Store layers added by proxy separately for refinement
  let proxyLayerIds = new Set<string>();
  let proxyFieldNames = new Set<string>();

  if ((mentionsSales || mentionsHighLow) && mentionedBrands.length > 0) {
      console.log(`[analyzeQuery][Sales Proxy] Entering proxy logic. mentionsSales=${mentionsSales}, mentionsHighLow=${mentionsHighLow}, brands=${mentionedBrands.join(', ')}`);
      console.log(`[analyzeQuery] Detected sales/concentration query for brands: ${mentionedBrands.join(', ')}. Applying proxy logic.`);
      matchedThemes.push('sales proxy');
      
      // Define relevant spending terms (excluding the generic 'spending')
      const spendingKeywords = concepts.spending.terms.filter(t => t !== 'spending');

      mentionedBrands.forEach(brand => {
          // --- NEW LOGIC: Search layers by tags --- 
          let foundProxyLayerForBrand = false;
     for (const layerId in layerConfigsObject) { // Use imported object
        const config = layerConfigsObject[layerId];
              const tags = config.metadata?.tags?.map(t => t.toLowerCase()) || [];
              
              // Check 1: Does the layer tag list contain the specific brand?
              const hasBrandTag = tags.includes(brand.toLowerCase());
              
              // Check 2: Does the layer tag list contain a relevant spending keyword?
              const hasSpendingTag = spendingKeywords.some(spendTerm => tags.includes(spendTerm.toLowerCase()));
              
              if (hasBrandTag && hasSpendingTag) {
                  console.log(`[analyzeQuery][Sales Proxy - Tag Match] Found potential proxy layer '${layerId}' for brand '${brand}' via tags.`);
                  proxyLayerIds.add(layerId); // Add layer identified via tags
                  console.log(`[analyzeQuery][Sales Proxy] Added layer ${layerId}. Attempting to add renderer field.`);
                  if (config.rendererField) {
                      proxyFieldNames.add(config.rendererField); // Add its field
                      console.log(`[analyzeQuery][Sales Proxy] Added field: ${config.rendererField}`);
                  }
                  confidence = Math.min(confidence + 0.15, 0.95); // Boost confidence for explicit rule match
                  foundProxyLayerForBrand = true;
                  // Optional: break if we only expect one proxy layer per brand?
                  // break; 
              }
          }
          if (!foundProxyLayerForBrand) {
            console.log(`[analyzeQuery][Sales Proxy - No Match] No layer found tagged with both brand '${brand}' and a spending term.`);
          }
          // --- REMOVED OLD LOGIC --- 
          /* ... */
      });
  }

  // --- Refine layers and fields based on explicit mentions ---
  console.log(`[analyzeQuery][Refinement] Starting layer/field refinement. Initial layers: ${[...finalRelevantLayerIds].join(', ')}. Proxy layers: ${[...proxyLayerIds].join(', ')}`);
  
  // Extract specific keywords/phrases (more robust extraction might be needed)
  // Example: "Asian population", "Nike sales" -> ['asian', 'population', 'nike', 'sales']
  const refinedQueryKeywordTokens = query.toLowerCase().match(/\b(\w+)\b/g) || [];
  // A set for faster lookups, based on the new variable name
  const refinedQueryKeywordSet = new Set(refinedQueryKeywordTokens); 
  // Add variations or synonyms if necessary
  if (refinedQueryKeywordSet.has('asian')) refinedQueryKeywordSet.add('asia');
  if (refinedQueryKeywordSet.has('nike')) refinedQueryKeywordSet.add('brand:nike'); // Example using concept prefix
  console.log(`[analyzeQuery][Refinement] Explicit keywords found in query: ${[...refinedQueryKeywordSet].join(', ')}`);
  
  const refinedLayerIds: string[] = [];
  const refinedFieldNames = new Set<string>(finalRelevantFieldNames); // Start with fields from proxy

  // Use 'let' to allow reassignment later
  let finalIntent = determineQueryIntent(query); // Initialize with basic intent
  let finalQueryType = determineQueryType(query); // Initialize with basic query type
  
  [...finalRelevantLayerIds].forEach(layerId => {
    const layerConfig = layerConfigsObject[layerId]; // Use imported object
    if (!layerConfig) return;

    const layerNameLower = layerConfig.name.toLowerCase();
    const layerTags = layerConfig.metadata?.tags || [];
    
    // Check if layer name or tags directly match keywords (using the new variable name)
    const nameMatches = refinedQueryKeywordTokens.some(kw => layerNameLower.includes(kw));
    const tagMatches = layerTags.some(tag => refinedQueryKeywordSet.has(tag.toLowerCase()));
    const conceptMatches = (matchedConceptsToKeywords[layerId] || []).some(concept => 
      refinedQueryKeywordSet.has(concept.toLowerCase()) || // Direct concept match
      (concept === 'brands' && refinedQueryKeywordTokens.some(kw => layerNameLower.includes(kw))) // Brand name in layer name
    );

    // --- Simplified Refinement Criteria --- 
    // Keep the layer if:
    // 1. It was added by the sales proxy OR
    // 2. Its tags directly match a query keyword OR
    // 3. Its name directly matches a query keyword.
    let keepLayer = false;
    if (proxyLayerIds.has(layerId)) {
        keepLayer = true;
        console.log(`[analyzeQuery][Refinement] Keeping layer ${layerId} (added by proxy).`);
    } else if (tagMatches) { 
        keepLayer = true;
        console.log(`[analyzeQuery][Refinement] Keeping layer ${layerId} (tag matches query keyword).`);
    } else if (nameMatches) {
        keepLayer = true;
        console.log(`[analyzeQuery][Refinement] Keeping layer ${layerId} (name matches query keyword).`);
    } else {
        // Optional: Could consider keeping based on conceptMatches here if needed, but might be too broad.
        console.log(`[analyzeQuery][Refinement] Discarding layer ${layerId} (no proxy/tag/name match with query keywords).`);
    }

    if (keepLayer && !refinedLayerIds.includes(layerId)) {
       refinedLayerIds.push(layerId);
       // Add relevant fields for kept layers
       if (layerConfig.rendererField) refinedFieldNames.add(layerConfig.rendererField);
       layerConfig.fields?.forEach(f => refinedFieldNames.add(f.name)); // Add all fields? Or just thematic?
    }
  });

  // Ensure proxy layers are included if they weren't already
  proxyLayerIds.forEach(proxyLayerId => {
    if (!refinedLayerIds.includes(proxyLayerId)) {
      refinedLayerIds.push(proxyLayerId);
      console.log(`[analyzeQuery][Refinement] Adding back missing proxy layer: ${proxyLayerId}`);
      // Add fields for proxy layer if needed
      const layerConfig = layerConfigsObject[proxyLayerId]; // Use imported object
      if (layerConfig?.rendererField) refinedFieldNames.add(layerConfig.rendererField);
    } else {
         console.log(`[analyzeQuery][Refinement] Proxy layer ${proxyLayerId} was already added explicitly.`);
    }
  });
  
  console.log(`[analyzeQuery][Refinement] Refined Layers: ${Array.from(finalRelevantLayerIds).join(', ')}. Refined Fields: ${Array.from(finalRelevantFieldNames).join(', ')}`);

  // --- Determine final Intent and Query Type based on refined layers and initial checks ---
  if (refinedLayerIds.length === 0) {
      console.warn('[analyzeQuery][Query Determination] No relevant layers found after refinement. Defaulting intent/type.');
      // Fallback or error handling needed? Maybe reset to distribution?
      finalQueryType = 'distribution'; 
      finalIntent = 'information'; 
  } else if (refinedLayerIds.length > 1) {
      // If multiple layers were found relevant, the intent is likely comparison.
      console.log(`[analyzeQuery][Query Determination] Multiple relevant layers (${refinedLayerIds.join(', ')}). Setting intent to 'comparison'.`);
      finalIntent = 'comparison';
      // However, DON'T automatically assume correlation unless explicitly requested.
      // Keep the original queryType unless it was something generic like 'unknown'.
      if (finalQueryType === 'unknown') {
          finalQueryType = 'distribution'; // Default to distribution for multiple layers if type unclear
          console.log(`[analyzeQuery][Query Determination] Original queryType was 'unknown', defaulting to 'distribution' for multiple layers.`);
      }
  } else {
      // Only one layer found, keep original intent/type unless it was generic
      if (finalQueryType === 'unknown') finalQueryType = 'distribution';
      if (finalIntent !== 'location') finalIntent = 'information'; // Default intent for single layer is info/distribution
  }

  // --- Final Explanation and Confidence ---
  if (refinedLayerIds.length > 0) { // Check finalRelevantLayerIds now
    explanation += `Identified relevant themes: ${[...new Set(matchedThemes)].join(', ')}. Refined to ${refinedLayerIds.length} relevant layer(s): ${refinedLayerIds.join(', ')}.`; // Use finalRelevantLayerIds
    confidence = Math.min(confidence, 0.95); // Cap confidence
  } else {
    explanation += "Could not identify specific layers matching the query's core themes based on available metadata and rules.";
    confidence = 0.4; // Lower confidence if no layers found
  }

  // --- Detect joint high intent: two variables, conjunction, high-ness, and NOT correlation language ---
  const conjunctionPattern = /\b(and|with|as well as|,)\b/;
  const highPattern = /(high|top|most|highest|peak|concentration)/;
  const correlationPattern = /(correlat|relationship|compare| vs |versus|between|relate|connection|association)/;
  const matchedSubtypes = refinedLayerIds.map(layerId => layerConfigsObject[layerId].metadata?.tags?.map(t => t.toLowerCase()) || []).flat().filter(Boolean);
  const uniqueSubtypes = new Set(matchedSubtypes);

  let queryType: AnalysisResult['queryType'] = 'unknown';

  // --- Detect joint high intent: two variables, conjunction, high-ness, and NOT correlation language ---
  if (
    uniqueSubtypes.size === 2 &&
    conjunctionPattern.test(lowerQuery) &&
    highPattern.test(lowerQuery) &&
    !correlationPattern.test(lowerQuery)
  ) {
    queryType = 'jointHigh';
  }
  // --- Detect correlation intent: two or more variables, conjunction, and correlation language ---
  else if (
    uniqueSubtypes.size >= 2 &&
    conjunctionPattern.test(lowerQuery) &&
    correlationPattern.test(lowerQuery)
  ) {
    queryType = 'correlation';
  } else if (isTrendsCorrelationQuery(query)) {
    queryType = 'correlation';
  } else {
    // Fallback: use keyword-based logic for distribution/trend/etc.
    if (/(correlat|relationship|compare| vs |versus|between|relate|connection|correlate)/.test(lowerQuery)) {
      queryType = 'correlation';
    } else if (/(trend|over time|popularity|interest over time)/.test(lowerQuery)) {
      queryType = 'distribution';
    } else if (/(distribution|concentration|density|pattern|spread|where|show me|display|map|highest|most|top|peak|maximum)/.test(lowerQuery)) {
      queryType = 'distribution';
    } else if (refinedLayerIds.length > 1) {
      // Fallback: if multiple layers matched, but no explicit correlation/comparison/trend, treat as distribution
      queryType = 'distribution';
    } else if (refinedLayerIds.length === 1) {
      queryType = 'distribution';
    }
  }

  // --- Step 2: Limit number of layers based on query type ---
  let maxLayers = 1;
  switch (queryType as AnalysisResult['queryType']) {
    case 'correlation':
    case 'jointHigh':
      maxLayers = 2;
      break;
    case 'distribution':
    case 'topN':
      maxLayers = 1;
      break;
    // Add other cases as needed
    default:
      maxLayers = 1;
  }
  // (If you want to support multi-layer distribution, change above to e.g. 3)

  const limitedLayerIds = refinedLayerIds.slice(0, maxLayers);

  // --- Step 3: If correlation, ensure two distinct concepts/layers are present ---
  if (queryType === 'correlation' && limitedLayerIds.length < 2) {
    // Not enough layers for correlation, fallback to single-layer distribution
    queryType = 'distribution';
    maxLayers = 1;
  }

  // --- Step 4: Explanation ---

  // --- Step 5: Return result ---
  const resultLimited: AnalysisResult = {
    intent: finalIntent as AnalysisResult['intent'],
    relevantLayers: limitedLayerIds,
    queryType: queryType,
    confidence: Math.min(0.7 + 0.1 * limitedLayerIds.length, 0.95),
    explanation,
    relevantFields: [], // Could be filled in with more metadata
    originalQueryType: validQueryTypes.includes(queryType) ? queryType : 'unknown',
    trendsKeyword: extractTrendsKeyword(query),
    comparisonParty: undefined,
    topN: undefined,
    entities: [], // Required by AnalysisResult
    layers: limitedLayerIds.map(id => ({
      layerId: id,
      relevance: scores[id] || 0,
      matchMethod: 'keyword',
      confidence: scores[id] || 0,
      reasons: []
    })),
    timeframe: '', // Required by AnalysisResult
    searchType: 'web' as const // Required by AnalysisResult
  };
  return resultLimited;
}

/**
 * Enhanced implementation of determineQueryType to return a valid QueryAnalysis['queryType']
 */
export function determineQueryType(query: string): AnalysisResult['queryType'] {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Apply pattern rules in priority order
  for (const rule of patternRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalizedQuery)) {
        return rule.type;
      }
    }
  }
  
  return 'unknown';
}

export function extractTrendsKeyword(query: string): string | undefined {
  const trendMatch = query.match(/trends?s?\s+(?:for|in|of)\s+([^,.]+)/i); // Made 's' optional
  return trendMatch ? trendMatch[1].trim() : undefined;
}

// --- Concept Map Driven Query Analysis ---
import { loadConceptMap, matchQueryToConcepts } from './concept-map-utils';

/**
 * Analyze a query using the concept map for robust, extensible mapping.
 * Returns relevant layers, variables, and inferred intent/type.
 *
 * @param query - The user query string
 * @param conceptMap - The concept map for matching
 */
export async function analyzeQueryWithConceptMap(
  query: string,
  conceptMap: ConceptMap,
  context?: string
): Promise<QueryAnalysis> {
  // --- CONTEXT-AWARE LOGIC: Use context to resolve ambiguous queries ---
  let contextUsed = false;
  let originalQuery = query;
  if (context && typeof context === 'string' && context.trim().length > 0) {
    // Simple pronoun resolution: replace 'it', 'that', 'those', 'the previous', etc. with last mentioned entity/layer from context
    // Example context: "User asked about population by county. System showed layer 'countyPopulation'."
    // Try to extract last mentioned layer/entity from context
    const lastLayerMatch = context.match(/layer ['"]([\w-]+)['"]/i) || context.match(/about ([\w\s]+)\./i);
    let lastEntity = lastLayerMatch ? lastLayerMatch[1] : undefined;
    // Fallback: look for last quoted or capitalized word
    if (!lastEntity) {
      const quoted = context.match(/['"]([\w\s]+)['"]/g);
      if (quoted && quoted.length > 0) {
        lastEntity = quoted[quoted.length - 1].replace(/['"]/g, '');
      }
    }
    // If query contains pronouns and we have a last entity, replace them
    if (lastEntity) {
      const pronounPattern = /\b(it|that|those|the previous|the last one|the above)\b/gi;
      if (pronounPattern.test(query)) {
        query = query.replace(pronounPattern, lastEntity);
        contextUsed = true;
      }
    }
    // If query is very short or vague, and context has a clear last entity, append it
    if (query.trim().length < 6 && lastEntity) {
      query = `${query} ${lastEntity}`.trim();
      contextUsed = true;
    }
    // If query is a follow-up like "now by city", prepend last entity
    if (/^now\b|^by\b|^compare\b|^show\b|^and\b|^also\b|^then\b/i.test(query) && lastEntity) {
      query = `${lastEntity} ${query}`.trim();
      contextUsed = true;
    }
    // Optionally, add more sophisticated context parsing here
  }
  if (contextUsed) {
    console.log('[analyzeQueryWithConceptMap][context-aware] Updated query using context:', originalQuery, '=>', query);
  }
  const queryLower = query.toLowerCase();
  const initialQueryType = determineQueryType(query);
  const matchedLayers: Array<{
    layerId: string;
    relevance: number;
    matchMethod: string;
    confidence: number;
    reasons: string[];
    totalScore: number;
    matchedConcepts: Set<string>;
  }> = [];

  const queryTokens = new Set(queryLower.match(/\b[a-z0-9']+\b/g) || []);

  // Find entity mentions in the query
  function findEntityMentions(queryLower: string): string[] {
    const entities: string[] = [];
    const words = queryLower.split(/\s+/);
    
    for (const word of words) {
      if (word.length > 2 && !['the', 'and', 'for', 'with', 'show', 'me', 'what', 'where', 'when', 'how', 'why'].includes(word)) {
        entities.push(word);
      }
    }
    
    return entities;
  }

  for (const layerId in conceptMap) {
    const conceptEntry = conceptMap[layerId];
    if (!conceptEntry || !conceptEntry.concept) continue;

    let score = 0;
    const reasons: string[] = [];
    const uniqueMatchedConcepts = new Set<string>();

    const checkAndScore = (term: string, weight: number, reasonPrefix: string) => {
      const termPattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (queryLower.match(termPattern)) {
        score += weight;
        reasons.push(`${reasonPrefix}: ${term}`);
        uniqueMatchedConcepts.add(conceptEntry.concept);
        return true;
      }
      return false;
    };

    checkAndScore(conceptEntry.concept.toLowerCase(), 3, "Matched concept name");

    conceptEntry.synonyms?.forEach(synonym => {
      checkAndScore(synonym.toLowerCase(), 2, "Matched synonym");
    });

    if (score > 0) {
      matchedLayers.push({
        layerId: layerId,
        relevance: Math.min(100, score * 10),
        matchMethod: "concept_match",
        confidence: Math.min(1, score / 5),
        reasons: reasons,
        totalScore: score,
        matchedConcepts: uniqueMatchedConcepts
      });
    }
  }

  matchedLayers.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return b.matchedConcepts.size - a.matchedConcepts.size;
  });

  let finalRelevantLayers: string[] = [];
  let finalRelevantFields: string[] = [];
  let finalExplanation = "Could not identify specific layers from the query.";
  
  // Ensure initialQueryType is compatible with QueryAnalysis['queryType']
  const compatibleQueryTypes: QueryAnalysis['queryType'][] = [
    'unknown', 'correlation', 'distribution', 'topN', 'jointHigh', 'comparison', 'simple_display', 'choropleth'
  ];
  let finalQueryType: QueryAnalysis['queryType'] = compatibleQueryTypes.includes(initialQueryType as any)
    ? initialQueryType as QueryAnalysis['queryType']
    : 'unknown';
    
  let finalIntent: QueryAnalysis['intent'] = determineQueryIntent(query);
  let entities = findEntityMentions(queryLower);

  if (initialQueryType === 'correlation') {
    console.log('[analyzeQueryWithConceptMap] Processing CORRELATION type.');
    if (matchedLayers.length >= 1) {
      const layerA = matchedLayers[0];
      let layerB = null;

      if (matchedLayers.length >= 2) {
        for (let i = 1; i < matchedLayers.length; i++) {
          if (matchedLayers[i].layerId !== layerA.layerId) {
            layerB = matchedLayers[i];
            break;
          }
        }
      }

      if (layerA && layerB) {
        finalRelevantLayers = [layerA.layerId, layerB.layerId];
        const fieldA = layerConfigsObject[layerA.layerId]?.rendererField || 'thematic_value';
        const fieldB = layerConfigsObject[layerB.layerId]?.rendererField || 'thematic_value';
        finalRelevantFields = [fieldA, fieldB];
        finalExplanation = `Analyzing correlation between '${conceptMap[layerA.layerId]?.concept || layerA.layerId}' (field: ${fieldA}) and '${conceptMap[layerB.layerId]?.concept || layerB.layerId}' (field: ${fieldB}).`;
        console.log(`[analyzeQueryWithConceptMap] Correlation layers: ${layerA.layerId} (${fieldA}) & ${layerB.layerId} (${fieldB})`);
      } else {
        console.log('[analyzeQueryWithConceptMap] Correlation fallback: Could not find two distinct layers.');
        finalQueryType = 'distribution';
        if (layerA) {
          finalRelevantLayers = [layerA.layerId];
          finalRelevantFields = [layerConfigsObject[layerA.layerId]?.rendererField || 'thematic_value'];
          finalExplanation = `Could not identify a second distinct concept for correlation with '${conceptMap[layerA.layerId]?.concept || layerA.layerId}'. Displaying distribution for the identified concept.`;
        } else {
          finalRelevantLayers = [];
          finalRelevantFields = [];
          finalExplanation = "Could not identify any relevant concepts for correlation. Please try rephrasing.";
        }
      }
    } else {
      console.log('[analyzeQueryWithConceptMap] Correlation fallback: No layers matched the query.');
      finalQueryType = 'distribution';
      finalRelevantLayers = [];
      finalRelevantFields = [];
      finalExplanation = "Could not identify any relevant concepts for correlation. Please try rephrasing.";
    }
    finalIntent = 'comparison';
  } else if (initialQueryType === 'distribution') {
    console.log('[analyzeQueryWithConceptMap] Processing DISTRIBUTION type.');
    const keywordForTrend = extractTrendsKeyword(query);
    finalRelevantLayers = ['googleTrends'];
    finalRelevantFields = keywordForTrend ? [`NORMALIZED_SCORE_${keywordForTrend}`] : ['NORMALIZED_SCORE_Default'];
    finalExplanation = `Analyzing trends for keyword: ${keywordForTrend || 'unknown'}`;
    if (!keywordForTrend) console.warn("[analyzeQueryWithConceptMap] Could not extract keyword for trend query:", query);
  } else {
    console.log('[analyzeQueryWithConceptMap] Processing GENERAL/DISTRIBUTION type.');
    if (matchedLayers.length > 0) {
      // PATCH: For multi-metric queries, include all layers with confidence >= 0.3
      const confidenceThreshold = 0.3;
      finalRelevantLayers = matchedLayers.filter(l => l.confidence >= confidenceThreshold).map(l => l.layerId);
      finalRelevantFields = finalRelevantLayers.map(lid => layerConfigsObject[lid]?.rendererField || 'thematic_value');
      if (finalRelevantLayers.length === 1) {
        finalExplanation = `Identified layer '${conceptMap[finalRelevantLayers[0]]?.concept || finalRelevantLayers[0]}' (using field '${finalRelevantFields[0]}') from the query.`;
      } else if (finalRelevantLayers.length > 1) {
        finalExplanation = `Identified layers: ${finalRelevantLayers.map((lid, i) => `'${conceptMap[lid]?.concept || lid}' (field '${finalRelevantFields[i]}')`).join(', ')} from the query.`;
        finalQueryType = 'correlation'; // Map multivariate to correlation type
        finalIntent = 'comparison';
      }
      // Debug log for patch
      console.log('[analyzeQueryWithConceptMap][PATCHED] Multi-metric relevantLayers:', finalRelevantLayers, 'relevantFields:', finalRelevantFields);
    } else {
      finalRelevantLayers = [];
      finalRelevantFields = [];
    }
  }

  if (finalRelevantLayers.length === 0 && initialQueryType !== 'distribution') {
    finalRelevantFields = [];
    finalExplanation = "Could not map query concepts to known data layers.";
  }

  const analysisResult: QueryAnalysis = {
    queryType: finalQueryType,
    entities: entities,
    intent: finalIntent,
    confidence: matchedLayers.length > 0 ? Math.min(1, matchedLayers[0].totalScore / 5) : 0.1,
    layers: matchedLayers.map(l => ({
      layerId: l.layerId,
      relevance: l.relevance,
      matchMethod: l.matchMethod,
      confidence: l.confidence,
      reasons: l.reasons
    })),
    timeframe: "all",
    searchType: 'web',
    relevantLayers: finalRelevantLayers,
    explanation: (finalRelevantLayers.length > 0 || initialQueryType === 'distribution') ? finalExplanation : "Could not map query concepts to known data layers.",
    refinements: [],
    relevantFields: finalRelevantFields,
    originalQueryType: compatibleQueryTypes.includes(initialQueryType as any) ? initialQueryType as QueryAnalysis['queryType'] : 'unknown',
    trendsKeyword: finalQueryType === 'distribution' ? extractTrendsKeyword(query) : undefined,
  };
  return analysisResult;
}

/**
 * Example usage for the new concept map-driven analysis:
 *
 * import { analyzeQueryWithConceptMap } from './query-analysis';
 *
 * const result = await analyzeQueryWithConceptMap('Display regions with high interest in NFL and MLB');
 * console.log(result);
 *
 * // result.relevantLayers will contain the correct layers (e.g., nflSuperFan, mlbSuperFan)
 * // result.queryType will be 'correlation' if multiple distinct interests are found
 *
 * To integrate, replace calls to analyzeQueryWithIndex/analyzeQuery with analyzeQueryWithConceptMap.
 */

// --- NEW: Conversion function between AnalysisResult and QueryAnalysis ---
export function convertAnalysisResultToQueryAnalysis(
  analysisResult: AnalysisResult
): QueryAnalysis {
  let queryType: QueryAnalysis['queryType'];
  let intent: QueryAnalysis['intent'];

  // Map queryType to the QueryAnalysis format
  switch (analysisResult.queryType) {
    case 'unknown':
      queryType = 'unknown';
      break;
    case 'comparison':
      queryType = 'comparison';
      break;
    case 'distribution':
      queryType = 'distribution';
      break;
    case 'correlation':
      queryType = 'correlation';
      break;
    case 'topN':
      queryType = 'topN';
      break;
    case 'jointHigh':
      queryType = 'jointHigh';
      break;
    case 'simple_display':
      queryType = 'simple_display';
      break;
    case 'choropleth':
      queryType = 'choropleth';
      break;
    default:
      queryType = 'unknown';
  }

  // Map intent to the QueryAnalysis format
  switch (analysisResult.intent) {
    case 'information':
      intent = 'information';
      break;
    case 'comparison':
      intent = 'comparison';
      break;
    case 'trends':
      intent = 'trends';
      break;
    case 'distribution':
      intent = 'distribution';
      break;
    case 'correlation':
      intent = 'correlation';
      break;
    case 'ranking':
      intent = 'ranking';
      break;
    case 'location':
      intent = 'location';
      break;
    case 'visualization_request':
      intent = 'visualization_request';
      break;
    default:
      intent = 'unknown';
  }

  // Type guard for originalQueryType
  const safeOriginalQueryType = validQueryTypes.includes(analysisResult.originalQueryType as any)
    ? analysisResult.originalQueryType as QueryAnalysis['queryType']
    : 'unknown';

  return {
    queryType,
    intent,
    entities: analysisResult.entities || [],
    confidence: analysisResult.confidence,
    layers: analysisResult.layers || [],
    timeframe: analysisResult.timeframe || '',
    searchType: analysisResult.searchType || 'web',
    relevantLayers: analysisResult.relevantLayers || [],
    explanation: analysisResult.explanation || '',
    refinements: [],
    relevantFields: analysisResult.relevantFields,
    comparisonParty: analysisResult.comparisonParty,
    topN: analysisResult.topN,
    isCrossGeography: analysisResult.isCrossGeography,
    originalQueryType: safeOriginalQueryType,
    trendsKeyword: analysisResult.trendsKeyword,
    populationLookup: analysisResult.populationLookup,
    reasoning: analysisResult.reasoning,
    metrics: analysisResult.metrics,
    correlationMetrics: analysisResult.correlationMetrics,
    thresholds: analysisResult.thresholds
  };
}

// --- NEW: Conversion function between QueryAnalysis and AnalysisResult ---
export function convertQueryAnalysisToAnalysisResult(
  queryAnalysis: QueryAnalysis
): AnalysisResult {
  // Ensure originalQueryType is always a valid AnalysisResult['queryType']
  const validQueryTypes: AnalysisResult['queryType'][] = [
    'unknown', 'correlation', 'distribution', 'topN', 'jointHigh', 'comparison', 'simple_display', 'choropleth'
  ];
  const safeOriginalQueryType = validQueryTypes.includes(queryAnalysis.originalQueryType as any)
    ? queryAnalysis.originalQueryType as AnalysisResult['queryType']
    : 'unknown';

  const result: AnalysisResult = {
    queryType: queryAnalysis.queryType,
    entities: queryAnalysis.entities,
    intent: queryAnalysis.intent as AnalysisResult['intent'],
    confidence: queryAnalysis.confidence,
    layers: queryAnalysis.layers,
    timeframe: queryAnalysis.timeframe,
    searchType: queryAnalysis.searchType,
    relevantLayers: queryAnalysis.relevantLayers,
    explanation: queryAnalysis.explanation,
    relevantFields: queryAnalysis.relevantFields,
    comparisonParty: queryAnalysis.comparisonParty,
    topN: queryAnalysis.topN,
    isCrossGeography: queryAnalysis.isCrossGeography,
    originalQueryType: safeOriginalQueryType,
    trendsKeyword: queryAnalysis.trendsKeyword,
    populationLookup: queryAnalysis.populationLookup,
    reasoning: queryAnalysis.reasoning,
    metrics: queryAnalysis.metrics,
    correlationMetrics: queryAnalysis.correlationMetrics,
    thresholds: queryAnalysis.thresholds
  };

  return result;
}

export function detectScenarioQuery(query: string): boolean {
  const scenarioPatterns = [
    /(?:what if|if.*increase|if.*decrease|scenario|simulate)/i,
    /(?:impact of|effect of).*(?:changing|increasing|decreasing|improving)/i,
    /(?:would happen|happen if|result if)/i,
    /(?:increase|decrease|improve|reduce).*by.*(?:%|percent|points)/i
  ];
  
  return scenarioPatterns.some(pattern => pattern.test(query));
}

export function detectThresholdQuery(query: string): boolean {
  const thresholdPatterns = [
    /(?:at what|what level|what point|threshold|cutoff|minimum|maximum)/i,
    /(?:above|below|over|under).*(?:level|point|threshold|value)/i,
    /(?:break.*point|tipping point|inflection|critical.*level)/i,
    /(?:income level|threshold.*level|minimum.*required)/i,
    /(?:rates? increase|approval.*increase|performance.*improve)/i
  ];
  
  return thresholdPatterns.some(pattern => pattern.test(query));
}

export function detectSegmentQuery(query: string): boolean {
  const segmentPatterns = [
    /(?:what characterizes|characteristics of|profile of|what makes)/i,
    /(?:high.*performing|low.*performing|top.*performing|bottom.*performing)/i,
    /(?:successful|unsuccessful|high.*achieving|underperforming)/i,
    /(?:segment|group|category|type).*(?:profile|characteristics|features)/i,
    /(?:distinguish|differentiate|unique.*about|special.*about)/i
  ];
  
  return segmentPatterns.some(pattern => pattern.test(query));
}

export function detectComparativeQuery(query: string): boolean {
  const comparativePatterns = [
    /(?:compare|comparison|versus|vs\.?|against)/i,
    /(?:urban.*rural|rural.*urban|city.*suburb|suburb.*city)/i,
    /(?:difference.*between|differ.*from|how.*different)/i,
    /(?:group.*vs.*group|category.*vs.*category)/i,
    /(?:north.*south|east.*west|coastal.*inland)/i,
    /(?:high.*income.*low.*income|rich.*poor|wealthy.*disadvantaged)/i
  ];
  
  return comparativePatterns.some(pattern => pattern.test(query));
}