/**
 * Extract clickable entities from AI response text
 * Identifies precincts, municipalities, and ZIP codes for interactive clicking
 */

import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

function isPAPoliticalDeployment(): boolean {
  return getPoliticalRegionEnv().stateFips === '42';
}

// Known entity patterns
// Full precinct name patterns (matches actual data format)
const PRECINCT_FULL_PATTERN = /\b(City of (?:East Lansing|Lansing|Mason|Williamston),?\s+Precinct\s+\d{1,2})\b/gi;
const PRECINCT_TOWNSHIP_PATTERN = /\b((?:Meridian|Delhi|Lansing|Alaiedon|Aurelius|Bunker Hill|Ingham|Leroy|Leslie|Locke|Onondaga|Stockbridge|Vevay|Wheatfield|White Oak|Williamstown)\s+Township,?\s+Precinct\s+\d{1,2})\b/gi;
// Short name patterns (AI-friendly format)
const PRECINCT_SHORT_PATTERN = /\b((?:East Lansing|Lansing|Mason|Williamston|Meridian|Delhi|Alaiedon|Aurelius)\s+Precinct\s+\d{1,2})\b/gi;
// Legacy short code pattern
const PRECINCT_CODE_PATTERN = /\b([A-Z]{2,3}-\d{1,2})\b/g;  // EL-3, LAN-12, etc.

const MUNICIPALITY_PATTERN_MI =
  /\b(East Lansing|Lansing|Meridian Township|Delhi Township|Okemos|Haslett|Holt|Mason|Williamston|Leslie|Webberville|Stockbridge)\b/gi;
const MUNICIPALITY_PATTERN_PA =
  /\b(Philadelphia|Pittsburgh|Harrisburg|Allentown|Erie|Reading|Scranton|Lancaster|York|Chester|Bethlehem|State College|Altoona|Wilkes-Barre)\b/gi;
/** Pennsylvania precinct UNIQUE_ID style (county FIPS prefix used in crosswalk). */
const PA_PRECINCT_UNIQUE_PATTERN = /\b(\d{3}-\:-[^\n,;]{4,120})/g;
const ZIP_PATTERN_MI = /\b(48[0-9]{3}|49[0-9]{3})\b/g;
const ZIP_PATTERN_PA = /\b(1[5-9][0-9]{3})\b/g;

export interface EntityReference {
  text: string;
  type: 'precinct' | 'municipality' | 'zip';
  startIndex: number;
  endIndex: number;
}

function extractEntities(text: string): EntityReference[] {
  const entities: EntityReference[] = [];
  const pa = isPAPoliticalDeployment();

  // Extract precincts - check all patterns from most specific to least
  let match;

  if (pa) {
    const paUnique = new RegExp(PA_PRECINCT_UNIQUE_PATTERN.source, 'g');
    while ((match = paUnique.exec(text)) !== null) {
      const t = match[1].trim();
      if (t.length >= 6) {
        entities.push({
          text: t,
          type: 'precinct',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }
  }

  if (!pa) {
    const fullRegex = new RegExp(PRECINCT_FULL_PATTERN.source, 'gi');
    while ((match = fullRegex.exec(text)) !== null) {
      entities.push({
        text: match[1],
        type: 'precinct',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    const townshipRegex = new RegExp(PRECINCT_TOWNSHIP_PATTERN.source, 'gi');
    while ((match = townshipRegex.exec(text)) !== null) {
      entities.push({
        text: match[1],
        type: 'precinct',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    const shortRegex = new RegExp(PRECINCT_SHORT_PATTERN.source, 'gi');
    while ((match = shortRegex.exec(text)) !== null) {
      entities.push({
        text: match[1],
        type: 'precinct',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    const codeRegex = new RegExp(PRECINCT_CODE_PATTERN.source, 'g');
    while ((match = codeRegex.exec(text)) !== null) {
      entities.push({
        text: match[1],
        type: 'precinct',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  // Extract municipalities
  const municipalityRegex = new RegExp(
    pa ? MUNICIPALITY_PATTERN_PA.source : MUNICIPALITY_PATTERN_MI.source,
    'gi',
  );
  while ((match = municipalityRegex.exec(text)) !== null) {
    entities.push({
      text: match[1],
      type: 'municipality',
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  // Extract ZIPs
  const zipRegex = new RegExp(pa ? ZIP_PATTERN_PA.source : ZIP_PATTERN_MI.source, 'g');
  while ((match = zipRegex.exec(text)) !== null) {
    entities.push({
      text: match[1],
      type: 'zip',
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  // Sort by position and dedupe overlapping entities (prefer longer matches)
  return entities
    .sort((a, b) => {
      // First sort by start position
      if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
      // For same start position, prefer longer matches
      return b.endIndex - a.endIndex;
    })
    .filter((e, i, arr) => i === 0 || e.startIndex >= arr[i - 1].endIndex);
}

// Municipality coordinates (Ingham + major PA cities for PA deployment)
const MUNICIPALITIES: Record<string, { lat: number; lng: number }> = {
  'east lansing': { lat: 42.7369, lng: -84.4839 },
  'lansing': { lat: 42.7325, lng: -84.5555 },
  'meridian township': { lat: 42.7197, lng: -84.4233 },
  'delhi township': { lat: 42.6567, lng: -84.6053 },
  'okemos': { lat: 42.7225, lng: -84.4272 },
  'haslett': { lat: 42.7464, lng: -84.4011 },
  'holt': { lat: 42.6406, lng: -84.5153 },
  'mason': { lat: 42.5792, lng: -84.4436 },
  'williamston': { lat: 42.6889, lng: -84.2831 },
  'leslie': { lat: 42.4514, lng: -84.4283 },
  'webberville': { lat: 42.6678, lng: -84.1744 },
  'stockbridge': { lat: 42.4514, lng: -84.1808 },
  philadelphia: { lat: 39.9526, lng: -75.1652 },
  pittsburgh: { lat: 40.4406, lng: -79.9959 },
  harrisburg: { lat: 40.2732, lng: -76.8867 },
  allentown: { lat: 40.6023, lng: -75.4772 },
  erie: { lat: 42.1292, lng: -80.0851 },
  reading: { lat: 40.3356, lng: -75.9269 },
  scranton: { lat: 41.4089, lng: -75.6649 },
  lancaster: { lat: 40.0379, lng: -76.3055 },
  york: { lat: 39.9626, lng: -76.7277 },
  chester: { lat: 39.8496, lng: -75.3557 },
  bethlehem: { lat: 40.6259, lng: -75.3705 },
  'state college': { lat: 40.7934, lng: -77.86 },
  altoona: { lat: 40.5187, lng: -78.3947 },
  'wilkes-barre': { lat: 41.2459, lng: -75.8813 },
  'alaiedon township': { lat: 42.6506, lng: -84.3511 },
  'aurelius township': { lat: 42.6139, lng: -84.5056 },
  'bunker hill township': { lat: 42.4311, lng: -84.4156 },
  'ingham township': { lat: 42.4789, lng: -84.3278 },
  'lansing township': { lat: 42.7689, lng: -84.5347 },
  'leroy township': { lat: 42.4847, lng: -84.4844 },
  'leslie township': { lat: 42.4619, lng: -84.3750 },
  'locke township': { lat: 42.5394, lng: -84.2306 },
  'onondaga township': { lat: 42.4567, lng: -84.5528 },
  'stockbridge township': { lat: 42.4175, lng: -84.1953 },
  'vevay township': { lat: 42.5258, lng: -84.3456 },
  'wheatfield township': { lat: 42.5328, lng: -84.4528 },
  'white oak township': { lat: 42.4311, lng: -84.2653 },
  'williamstown township': { lat: 42.6639, lng: -84.2178 },
};

export function getEntityCoordinates(entity: EntityReference): { lat: number; lng: number } | null {
  if (entity.type === 'municipality') {
    return MUNICIPALITIES[entity.text.toLowerCase()] || null;
  }

  // For precincts/ZIPs, would need to look up from data
  // Return null for now - can be enhanced to use PoliticalDataService
  return null;
}

export function extractNumberedEntities(text: string): Array<{
  number: number;
  entity: EntityReference;
}> {
  const results: Array<{ number: number; entity: EntityReference }> = [];

  // Pattern for numbered precinct references (full names)
  const fullPrecinctPattern = /(\d+)\.\s+\*?\*?(City of [^,]+,?\s+Precinct\s+\d{1,2}|[A-Za-z]+\s+Township,?\s+Precinct\s+\d{1,2}|[A-Za-z]+\s+Precinct\s+\d{1,2})\*?\*?/gi;

  // Pattern for numbered short codes
  const codePattern = /(\d+)\.\s+\*?\*?([A-Z]{2,3}-\d{1,2})\*?\*?/g;

  // Pattern for numbered municipalities
  const municipalityPattern = /(\d+)\.\s+\*?\*?(East Lansing|Lansing|Meridian Township|Delhi Township|Okemos|Haslett|Holt|Mason|Williamston|Leslie|Webberville|Stockbridge)\*?\*?/gi;

  let match;

  // Extract full precinct names
  while ((match = fullPrecinctPattern.exec(text)) !== null) {
    results.push({
      number: parseInt(match[1], 10),
      entity: {
        text: match[2],
        type: 'precinct',
        startIndex: match.index,
        endIndex: match.index + match[0].length
      }
    });
  }

  // Extract short codes
  while ((match = codePattern.exec(text)) !== null) {
    results.push({
      number: parseInt(match[1], 10),
      entity: {
        text: match[2],
        type: 'precinct',
        startIndex: match.index,
        endIndex: match.index + match[0].length
      }
    });
  }

  // Extract municipalities
  while ((match = municipalityPattern.exec(text)) !== null) {
    // Skip if it's part of a precinct name (avoid double-matching "East Lansing Precinct 3")
    const nextChars = text.slice(match.index + match[0].length, match.index + match[0].length + 15);
    if (/\s*Precinct/i.test(nextChars)) continue;

    results.push({
      number: parseInt(match[1], 10),
      entity: {
        text: match[2],
        type: 'municipality',
        startIndex: match.index,
        endIndex: match.index + match[0].length
      }
    });
  }

  // Dedupe by number (prefer first match)
  const seen = new Set<number>();
  return results.filter(r => {
    if (seen.has(r.number)) return false;
    seen.add(r.number);
    return true;
  });
}

interface TextSegment {
  type: 'text' | 'entity';
  content: string;
  entity?: EntityReference;
}

export function segmentTextWithEntities(text: string): TextSegment[] {
  const entities = extractEntities(text);
  if (entities.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  entities.forEach(entity => {
    // Add text before entity
    if (entity.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, entity.startIndex)
      });
    }

    // Add entity
    segments.push({
      type: 'entity',
      content: entity.text,
      entity
    });

    lastIndex = entity.endIndex;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  return segments;
}
