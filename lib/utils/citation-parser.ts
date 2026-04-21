/**
 * Citation Parser and Renderer
 *
 * Parses citation tags like [ELECTIONS], [DEMOGRAPHICS], [METHODOLOGY]
 * from AI responses and provides display utilities.
 */

export interface ParsedCitation {
  key: string;
  description?: string;
  source?: string;
}

export interface CitationMap {
  [key: string]: {
    description: string;
    source: string;
  };
}

// Known citation keys and their meanings
export const CITATION_DEFINITIONS: CitationMap = {
  // Data source citations
  '[ELECTIONS]': {
    description: 'Precinct-level election results for 2020, 2022, 2024',
    source: 'Ingham County Clerk',
  },
  '[SCORES]': {
    description: 'Partisan lean and swing potential for each precinct',
    source: 'Calculated from election results',
  },
  '[TARGETING]': {
    description: 'GOTV Priority and Persuasion Opportunity scores',
    source: 'Calculated from demographics and election results',
  },
  '[DEMOGRAPHICS]': {
    description: 'Population, age, income, education by precinct',
    source: 'Census ACS and Esri estimates',
  },
  '[METHODOLOGY]': {
    description: 'Analysis methodology and score calculations',
    source: 'Platform documentation',
  },
  // Current intelligence citations
  '[POLL]': {
    description: 'Recent polling data with methodology',
    source: 'Michigan pollsters (Marist, EPIC-MRA, Glengariff)',
  },
  '[NEWS]': {
    description: 'News reporting from Michigan sources',
    source: 'MLive, Michigan Advance, Lansing State Journal, WKAR',
  },
  '[ANALYSIS]': {
    description: 'Expert political analysis and forecasts',
    source: 'Political analysts and platform analysis',
  },
  '[OFFICIAL]': {
    description: 'Official government source',
    source: 'Michigan SOS, Ingham County Clerk',
  },
  '[UPCOMING]': {
    description: 'Upcoming elections and candidate information',
    source: 'Ballotpedia, news sources, official filings',
  },
};

// Pattern to match citation tags like [ELECTIONS], [DEMOGRAPHICS], etc.
const CITATION_PATTERN = /\[([A-Z_]+)\]/g;

/**
 * Extract all citation tags from text
 */
export function extractCitations(text: string): string[] {
  const matches = text.match(CITATION_PATTERN);
  if (!matches) return [];

  // Unique citations
  return [...new Set(matches)];
}

/**
 * Parse citations with their definitions
 */
export function parseCitations(text: string, customMap?: CitationMap): ParsedCitation[] {
  const citationKeys = extractCitations(text);
  const definitions = { ...CITATION_DEFINITIONS, ...customMap };

  return citationKeys.map((key) => ({
    key,
    description: definitions[key]?.description,
    source: definitions[key]?.source,
  }));
}

/**
 * Check if text contains any citations
 */
export function hasCitations(text: string): boolean {
  return CITATION_PATTERN.test(text);
}

/**
 * Replace citation tags with styled HTML spans
 */
export function formatCitationsAsHtml(text: string): string {
  return text.replace(
    CITATION_PATTERN,
    '<span class="citation-tag inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 cursor-help" title="Click for source">[$1]</span>'
  );
}

/**
 * Split text into parts: regular text and citation elements
 * Returns array of strings (text) and citation objects
 */
export function splitTextAndCitations(
  text: string
): Array<string | { type: 'citation'; key: string }> {
  const parts: Array<string | { type: 'citation'; key: string }> = [];
  let lastIndex = 0;

  const regex = /\[([A-Z_]+)\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add citation
    parts.push({ type: 'citation', key: match[0] });

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Get tooltip content for a citation
 */
export function getCitationTooltip(key: string, customMap?: CitationMap): string {
  const definitions = { ...CITATION_DEFINITIONS, ...customMap };
  const def = definitions[key];

  if (!def) {
    return `Source: ${key.replace(/[\[\]]/g, '')}`;
  }

  return `${def.description}\nSource: ${def.source}`;
}
