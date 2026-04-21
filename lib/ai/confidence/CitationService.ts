/**
 * CitationService - Parses and manages inline citations
 * Phase 14 Enhanced Implementation
 *
 * Converts inline citation markers like [ELECTIONS] into
 * clickable links with tooltips showing source metadata.
 */

import type {
  CitationKey,
  Citation,
  InlineCitation,
  CitedText,
} from './types';

import { CITATION_REGISTRY } from './types';

// Singleton instance
let citationServiceInstance: CitationService | null = null;

/**
 * Get the CitationService singleton
 */
export function getCitationService(): CitationService {
  if (!citationServiceInstance) {
    citationServiceInstance = new CitationService();
  }
  return citationServiceInstance;
}

/**
 * CitationService class
 */
class CitationService {
  // Pattern to match citation markers like [ELECTIONS], [SCORES], etc.
  private citationPattern = /\[([A-Z_]+)\]/g;

  // ============================================================================
  // Text Parsing
  // ============================================================================

  /**
   * Parse text to extract all citations
   */
  parseText(text: string): CitedText {
    const citations: InlineCitation[] = [];
    const uniqueCitations: Set<CitationKey> = new Set();

    let match;
    while ((match = this.citationPattern.exec(text)) !== null) {
      const key = match[1] as CitationKey;

      // Only include valid citation keys
      if (this.isValidCitationKey(key)) {
        citations.push({
          key,
          position: match.index,
          context: this.extractContext(text, match.index, 50),
        });
        uniqueCitations.add(key);
      }
    }

    // Reset regex state
    this.citationPattern.lastIndex = 0;

    return {
      rawText: text,
      parsedText: text, // UI layer will handle rendering
      citations,
      uniqueCitations: Array.from(uniqueCitations),
    };
  }

  /**
   * Check if a string is a valid citation key
   */
  isValidCitationKey(key: string): key is CitationKey {
    return key in CITATION_REGISTRY;
  }

  /**
   * Get citation metadata by key
   */
  getCitation(key: CitationKey): Citation {
    return CITATION_REGISTRY[key];
  }

  /**
   * Get all citations used in a text
   */
  getUniqueCitations(text: string): Citation[] {
    const { uniqueCitations } = this.parseText(text);
    return uniqueCitations.map((key) => this.getCitation(key));
  }

  // ============================================================================
  // Formatting for AI Responses
  // ============================================================================

  /**
   * Format a citation for display in AI response
   */
  formatCitationForAI(key: CitationKey, options?: { compact?: boolean }): string {
    const citation = this.getCitation(key);
    const compact = options?.compact ?? false;

    if (compact) {
      return `[${key}]`;
    }

    let result = `**[${key}]** ${citation.title}`;

    if (citation.source) {
      result += ` (${citation.source})`;
    }

    if (citation.vintage) {
      result += ` | ${citation.vintage}`;
    }

    return result;
  }

  /**
   * Generate a sources section for an AI response
   */
  generateSourcesSection(citationKeys: CitationKey[]): string {
    if (citationKeys.length === 0) return '';

    const lines: string[] = ['', '---', '**📚 Sources:**'];

    for (const key of citationKeys) {
      const citation = this.getCitation(key);
      let line = `- **${citation.displayKey}** ${citation.title}`;

      if (citation.source) {
        line += ` — _${citation.source}_`;
      }

      if (citation.url) {
        line += ` [↗](${citation.url})`;
      }

      if (citation.vintage) {
        line += ` (${citation.vintage})`;
      }

      lines.push(line);
    }

    return lines.join('\n');
  }

  /**
   * Add citations to an AI response based on content
   */
  addCitationsToResponse(
    response: string,
    citationsUsed: CitationKey[]
  ): string {
    // Don't add sources if none were used
    if (citationsUsed.length === 0) return response;

    // Check if response already has a sources section
    if (
      response.includes('**📚 Sources:**') ||
      response.includes('**Sources:**')
    ) {
      return response;
    }

    return response + this.generateSourcesSection(citationsUsed);
  }

  // ============================================================================
  // Citation Tooltips (for UI)
  // ============================================================================

  /**
   * Generate tooltip content for a citation
   */
  generateTooltip(key: CitationKey): string {
    const citation = this.getCitation(key);
    const lines: string[] = [];

    lines.push(`**${citation.title}**`);

    if (citation.description) {
      lines.push(citation.description);
    }

    lines.push('');

    if (citation.source) {
      lines.push(`📍 Source: ${citation.source}`);
    }

    if (citation.vintage) {
      lines.push(`📅 Vintage: ${citation.vintage}`);
    }

    if (citation.coverage) {
      lines.push(`🗺️ Coverage: ${citation.coverage}`);
    }

    const reliabilityPct = Math.round(citation.reliability * 100);
    lines.push(`✅ Reliability: ${reliabilityPct}%`);

    if (citation.methodology) {
      lines.push(`📖 [View methodology](${citation.methodology})`);
    }

    if (citation.url) {
      lines.push(`🔗 [View source](${citation.url})`);
    }

    return lines.join('\n');
  }

  /**
   * Generate a short summary for inline display
   */
  generateShortSummary(key: CitationKey): string {
    const citation = this.getCitation(key);
    const parts: string[] = [citation.title];

    if (citation.vintage) {
      parts.push(`(${citation.vintage})`);
    }

    return parts.join(' ');
  }

  // ============================================================================
  // Automatic Citation Detection
  // ============================================================================

  /**
   * Suggest citations based on content keywords
   *
   * Expanded to include:
   * - Academic research citations for methodological claims
   * - Specific data source citations
   * - Tool-specific methodology citations
   */
  suggestCitations(content: string): CitationKey[] {
    const suggestions: Set<CitationKey> = new Set();
    const lowerContent = content.toLowerCase();

    // Keyword mappings - organized by category
    const keywordMap: Record<string, CitationKey[]> = {
      // === ELECTION DATA ===
      // Region-specific clerk lines come from [ELECTIONS] in CITATION_REGISTRY; do not auto-tag Ingham for generic "precinct"/"election".
      election: ['ELECTIONS'],
      'election result': ['ELECTIONS'],
      vote: ['ELECTIONS'],
      turnout: ['ELECTIONS', 'GOTV_EFFECTIVENESS'],
      ballot: ['ELECTIONS'],
      precinct: ['ELECTIONS', 'MICHIGAN_GIS', 'KENNY_PRECINCT'],
      '2024': ['ELECTIONS'],
      '2022': ['ELECTIONS'],
      '2020': ['ELECTIONS'],

      // === PARTISAN & SCORING ===
      partisan: ['SCORES', 'PARTISAN_LEAN', 'ELECTIONS'],
      'partisan lean': ['PARTISAN_LEAN', 'SCORES'],
      swing: ['SCORES', 'SWING_CALCULATION'],
      'swing potential': ['SWING_CALCULATION', 'SCORES'],
      lean: ['PARTISAN_LEAN', 'SCORES'],
      competitive: ['SCORES', 'ELECTIONS'],
      'toss-up': ['SCORES'],
      'toss up': ['SCORES'],
      margin: ['ELECTIONS', 'SCORES'],

      // === GOTV & CANVASSING ===
      gotv: ['TARGETING', 'GOTV_FORMULA', 'GOTV_EFFECTIVENESS', 'GERBER_GREEN'],
      'get out the vote': ['GOTV_FORMULA', 'GOTV_EFFECTIVENESS', 'GERBER_GREEN'],
      mobiliz: ['GOTV_EFFECTIVENESS', 'GERBER_GREEN'],
      canvass: ['CANVASS_EFFICIENCY', 'GOTV_EFFECTIVENESS', 'BHATTI_CANVASS'],
      'door-knocking': ['CANVASS_EFFICIENCY', 'GERBER_GREEN'],
      'door knocking': ['CANVASS_EFFICIENCY', 'GERBER_GREEN'],
      'doors per hour': ['CANVASS_EFFICIENCY'],
      turf: ['CANVASS_EFFICIENCY'],
      'field experiment': ['GERBER_GREEN', 'BHATTI_CANVASS'],
      '6-8 point': ['GERBER_GREEN'],

      // === PERSUASION ===
      persuasion: ['TARGETING', 'PERSUASION_CALC', 'PERSUASION_UNIVERSE', 'TAPPIN_PERSUASION'],
      persuadab: ['PERSUASION_UNIVERSE', 'TAPPIN_PERSUASION'],
      microtarget: ['TAPPIN_PERSUASION', 'ROGERS_TARGETING'],
      '70%': ['TAPPIN_PERSUASION'],
      'support score': ['ROGERS_TARGETING', 'PERSUASION_UNIVERSE'],

      // === TARGETING ===
      target: ['TARGETING', 'ROGERS_TARGETING'],
      'targeting score': ['TARGETING', 'ROGERS_TARGETING'],
      universe: ['PERSUASION_UNIVERSE', 'SEGMENT_METHODOLOGY'],
      priorit: ['TARGETING', 'GOTV_FORMULA'],

      // === DEMOGRAPHICS ===
      demographic: ['DEMOGRAPHICS', 'CENSUS_ACS'],
      population: ['DEMOGRAPHICS', 'CENSUS_ACS'],
      income: ['DEMOGRAPHICS', 'CENSUS_ACS'],
      'median income': ['CENSUS_ACS'],
      education: ['DEMOGRAPHICS', 'CENSUS_ACS'],
      'college educated': ['CENSUS_ACS'],
      age: ['DEMOGRAPHICS', 'CENSUS_ACS'],
      'median age': ['CENSUS_ACS'],
      race: ['DEMOGRAPHICS', 'CENSUS_ACS'],
      ethnicity: ['DEMOGRAPHICS', 'CENSUS_ACS'],
      census: ['CENSUS_ACS', 'DEMOGRAPHICS'],
      'block group': ['CENSUS_ACS', 'CROSSWALK', 'AREA_WEIGHTING'],
      acs: ['CENSUS_ACS'],

      // === TAPESTRY & PSYCHOGRAPHICS ===
      tapestry: ['TAPESTRY', 'ESRI_BA'],
      'lifemode': ['TAPESTRY'],
      'life mode': ['TAPESTRY'],
      'college towns': ['TAPESTRY'],
      'rustbelt': ['TAPESTRY'],
      segment: ['TAPESTRY', 'SEGMENT_METHODOLOGY'],
      lifestyle: ['TAPESTRY', 'ESRI_BA'],
      psychographic: ['PSYCHOGRAPHICS', 'GFK_MRI'],
      attitude: ['PSYCHOGRAPHICS', 'GFK_MRI'],
      'political outlook': ['PSYCHOGRAPHICS', 'GFK_MRI'],
      'party affiliation': ['PSYCHOGRAPHICS', 'GFK_MRI'],
      esri: ['ESRI_BA', 'TAPESTRY'],
      'business analyst': ['ESRI_BA'],

      // === DONOR & FEC ===
      donor: ['FEC', 'DONOR_ANALYSIS', 'BONICA_DIME'],
      contribution: ['FEC', 'DONOR_ANALYSIS'],
      fundrais: ['FEC', 'DONOR_ANALYSIS'],
      fec: ['FEC'],
      'campaign finance': ['FEC', 'BONICA_DIME'],
      dime: ['BONICA_DIME'],
      'ideology score': ['BONICA_DIME'],
      cfscore: ['BONICA_DIME'],
      'zip code': ['FEC', 'DONOR_ANALYSIS'],

      // === MEDIA ===
      media: ['MEDIA', 'GFK_MRI'],
      television: ['MEDIA', 'GFK_MRI'],
      tv: ['MEDIA', 'GFK_MRI'],
      radio: ['MEDIA', 'GFK_MRI'],
      'social media': ['MEDIA', 'GFK_MRI'],
      facebook: ['MEDIA'],
      twitter: ['MEDIA'],
      nielsen: ['MEDIA', 'GFK_MRI'],

      // === POLLING ===
      poll: ['POLL'],
      survey: ['POLL', 'GFK_MRI'],
      opinion: ['POLL'],
      '538': ['POLL'],
      fivethirtyeight: ['POLL'],

      // === UPCOMING ELECTIONS ===
      upcoming: ['UPCOMING', 'MICHIGAN_SOS'],
      deadline: ['UPCOMING', 'MICHIGAN_SOS'],
      candidate: ['UPCOMING'],
      filing: ['UPCOMING', 'MICHIGAN_SOS'],
      'secretary of state': ['MICHIGAN_SOS', 'UPCOMING'],

      // === NEWS ===
      news: ['NEWS'],
      article: ['NEWS'],
      report: ['NEWS', 'OFFICIAL'],

      // === METHODOLOGY ===
      methodology: ['METHODOLOGY_DOC', 'SCORES'],
      'area-weighted': ['AREA_WEIGHTING', 'CROSSWALK'],
      'area weighted': ['AREA_WEIGHTING', 'CROSSWALK'],
      interpolat: ['AREA_WEIGHTING', 'CROSSWALK'],
      crosswalk: ['CROSSWALK', 'KENNY_PRECINCT'],
      hexagon: ['H3_METHODOLOGY'],
      h3: ['H3_METHODOLOGY'],
      heatmap: ['H3_METHODOLOGY'],
      'uniform grid': ['H3_METHODOLOGY'],

      // === ACADEMIC RESEARCH ===
      'gerber': ['GERBER_GREEN'],
      'green': ['GERBER_GREEN'],
      research: ['METHODOLOGY_DOC'],
      study: ['METHODOLOGY_DOC'],
      academic: ['METHODOLOGY_DOC'],
      'ecological inference': ['KING_ECOLOGICAL'],
      'aggregate data': ['KING_ECOLOGICAL', 'SOIFER_MAUP'],
      maup: ['SOIFER_MAUP'],
      'modifiable areal': ['SOIFER_MAUP'],

      // === COMPARISON & LOOKALIKE ===
      compare: ['COMPARISON_METHOD'],
      comparison: ['COMPARISON_METHOD'],
      similar: ['LOOKALIKE_MODEL', 'COMPARISON_METHOD'],
      lookalike: ['LOOKALIKE_MODEL'],
      'find similar': ['LOOKALIKE_MODEL'],

      // === MICHIGAN SPECIFIC ===
      michigan: ['MICHIGAN_GIS', 'MICHIGAN_SOS'],
      ingham: ['INGHAM_CLERK', 'ELECTIONS'],
      lansing: ['INGHAM_CLERK', 'ELECTIONS'],
      'east lansing': ['INGHAM_CLERK', 'ELECTIONS'],

      // === OFFICIAL ===
      official: ['OFFICIAL', 'INGHAM_CLERK', 'MICHIGAN_SOS'],
      certified: ['INGHAM_CLERK', 'OFFICIAL'],
      government: ['OFFICIAL'],
    };

    for (const [keyword, keys] of Object.entries(keywordMap)) {
      if (lowerContent.includes(keyword)) {
        for (const key of keys) {
          suggestions.add(key);
        }
      }
    }

    return Array.from(suggestions);
  }

  /**
   * Automatically add citations to text where appropriate
   */
  autoAddCitations(text: string): string {
    // Already has citations? Return as-is
    if (this.citationPattern.test(text)) {
      this.citationPattern.lastIndex = 0;
      return text;
    }

    const suggestions = this.suggestCitations(text);

    // If no suggestions, return as-is
    if (suggestions.length === 0) return text;

    // Add citations at the end
    const citationStr = suggestions.map((k) => `[${k}]`).join(' ');
    return `${text} ${citationStr}`;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractContext(
    text: string,
    position: number,
    windowSize: number
  ): string {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.slice(start, end);
  }

  /**
   * Get all available citations
   */
  getAllCitations(): Citation[] {
    return Object.values(CITATION_REGISTRY);
  }

  /**
   * Get citations by reliability threshold
   */
  getCitationsByReliability(minReliability: number): Citation[] {
    return this.getAllCitations().filter(
      (c) => c.reliability >= minReliability
    );
  }

  /**
   * Get citation URL (for direct linking)
   */
  getCitationUrl(key: CitationKey): string | undefined {
    return this.getCitation(key).url;
  }

  /**
   * Format reliability as a label
   */
  formatReliability(reliability: number): string {
    if (reliability >= 0.9) return 'Very High';
    if (reliability >= 0.8) return 'High';
    if (reliability >= 0.7) return 'Medium';
    if (reliability >= 0.6) return 'Moderate';
    return 'Low';
  }
}

export default CitationService;
