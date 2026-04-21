import { getSettingsManager } from '@/lib/settings';
import type { ResponseStyle, AITone } from '@/lib/settings/types';
import type { HandlerResult } from './handlers/types';

interface UserPreferences {
  responseStyle: ResponseStyle;
  tone: AITone;
  expertiseLevel: 'novice' | 'intermediate' | 'power_user';
  showMethodologyLinks: boolean;
  showConfidenceIndicators: boolean;
}

const SENSITIVE_TOPICS = {
  high: [
    /abortion|reproductive rights/i,
    /gun control|second amendment|firearms/i,
    /immigration|deportation|border/i,
    /racial|racism|discrimination/i,
    /lgbtq|transgender|same-sex/i,
  ],
  medium: [
    /partisan|democrat|republican|liberal|conservative/i,
    /swing|battleground|competitive/i,
    /flip|loss|defeat|win margin/i,
    /turnout drop|declining|losing/i,
  ],
  low: [
    /election|vote|voter/i,
    /precinct|district|ward/i,
    /campaign|candidate/i,
  ],
};

const INSIGHT_PATTERNS = [
  /this (?:means|suggests|indicates|shows)/i,
  /the key (?:takeaway|insight|finding)/i,
  /most importantly/i,
  /bottom line/i,
  /in practice/i,
  /for your campaign/i,
  /strategically/i,
  /actionable/i,
  /opportunity|risk|advantage/i,
];

const DATA_PATTERNS = [
  /^\d{1,3}(?:,\d{3})*\s+(?:voters|precincts|doors)/i,
  /\|\s*\d/,  // Table with numbers
  /^\s*-\s*\d/,  // List starting with number
  /^precinct\s+[A-Z0-9]/i,  // Precinct listings
];

const CLOSE_RACE_PATTERNS = [
  /margin.{0,20}(?:less than|under|within).{0,10}\d{1,2}%/i,
  /toss-?up|coin.?flip|razor.?thin/i,
  /too close to call/i,
  /within.{0,10}(?:margin of error|moe)/i,
  /competitive race/i,
];

const STRATEGIC_INSIGHTS: Record<string, (data: Record<string, unknown>) => string> = {
  /** SegmentationHandler already returns a full structured answer (criteria, counts, metrics). */
  segment_find: () => '',

  donor_concentration: (data) => {
    const topZip = data.topZip || 'identified areas';
    return `**Fundraising Insight:** Donor concentration highest in ${topZip}. Consider targeted outreach events in these zip codes.`;
  },

  canvass_plan: (data) => {
    const doors = Number(data.totalDoors) || 0;
    const volunteers = Number(data.volunteersNeeded) || 0;
    return `**Field Strategy:** ${doors.toLocaleString()} doors can be covered with ${volunteers} volunteers. Early canvassing in high-priority precincts maximizes voter contact before late deciders are locked in.`;
  },

  district_analysis: (data) => {
    const lean = Number(data.partisanLean) || 0;
    const swing = Number(data.swingPotential) || 0;
    if (Math.abs(lean) < 5 && swing > 60) {
      return `**Competitive District:** This district is winnable for either party. Turnout and persuasion will determine the outcome.`;
    } else if (lean > 10) {
      return `**Republican-Leaning:** Focus on base turnout and defensive messaging. Persuasion ROI is low here.`;
    } else if (lean < -10) {
      return `**Democratic-Leaning:** Focus on base turnout. This is a safe district for resource allocation.`;
    }
    return `**Strategic Assessment:** District competitiveness requires balanced turnout and persuasion investment.`;
  },

  scenario_turnout: (data) => {
    const change = Number(data.turnoutChange) || 0;
    const impact = String(data.voteImpact || 'unknown');
    return `**Scenario Impact:** A ${change > 0 ? '+' : ''}${change}% turnout shift would ${impact}. Plan accordingly.`;
  },

  election_trends: (data) => {
    const trend = data.trend || 'stable';
    return `**Trend Insight:** The ${trend} trend suggests focusing on ${trend === 'shifting' ? 'persuadable voters' : 'base mobilization'}.`;
  },

  /** Filter / map-layer queries already include structured results — do not prepend generic framing. */
  map_layer_change: () => '',

  default: () => {
    return `**Key Insight:** Review the data below to identify strategic opportunities for your campaign.`;
  },
};

export function enhanceResponse(
  result: HandlerResult,
  query: string,
  intent: string
): HandlerResult {
  if (!result.success || !result.response) {
    return result;
  }

  const preferences = getUserPreferences();
  let enhanced = result.response;

  enhanced = addSoWhatFraming(
    enhanced,
    intent,
    result.data as Record<string, unknown>
  );

  // Principle 10: Add emotional intelligence
  const sensitivity = detectPoliticalSensitivity(query, enhanced);
  const isCloseRace = detectCloseRace(enhanced);
  enhanced = addEmotionalIntelligence(enhanced, sensitivity, isCloseRace);

  // Principle 5: Adapt to user preferences (applied last to respect formatting)
  enhanced = adaptResponseLength(enhanced, preferences);

  return {
    ...result,
    response: enhanced,
    metadata: {
      // Preserve existing metadata fields
      handlerName: result.metadata?.handlerName || 'unknown',
      processingTimeMs: result.metadata?.processingTimeMs || 0,
      queryType: result.metadata?.queryType || 'unknown',
      matchedIntent: result.metadata?.matchedIntent || 'unknown',
      confidence: result.metadata?.confidence || 0,
      ...result.metadata,
      // Add enhancement metadata
      enhancementApplied: true,
      userPreferences: {
        responseStyle: preferences.responseStyle,
        expertiseLevel: preferences.expertiseLevel,
      },
      politicalSensitivity: sensitivity,
      hadCloseRaceContext: isCloseRace,
    },
  };
}

export function shouldEnhance(result: HandlerResult): boolean {
  // Always enhance successful responses
  return result.success && result.response.length > 50;
}

function getUserPreferences(): UserPreferences {
  try {
    const settings = getSettingsManager();
    const aiSettings = settings.get('ai');

    return {
      responseStyle: aiSettings.responseStyle || 'auto',
      tone: aiSettings.tone || 'professional',
      expertiseLevel: detectExpertiseLevel(),
      showMethodologyLinks: aiSettings.showMethodologyLinks ?? true,
      showConfidenceIndicators: aiSettings.showConfidenceIndicators ?? true,
    };
  } catch {
    // Default preferences during SSR or when settings unavailable
    return {
      responseStyle: 'auto',
      tone: 'professional',
      expertiseLevel: 'intermediate',
      showMethodologyLinks: true,
      showConfidenceIndicators: true,
    };
  }
}

function detectExpertiseLevel(): 'novice' | 'intermediate' | 'power_user' {
  try {
    // Check if we have expertise tracking from ApplicationStateManager
    if (typeof window !== 'undefined') {
      const storedExpertise = localStorage.getItem('pol_user_expertise');
      if (storedExpertise) {
        const data = JSON.parse(storedExpertise);
        if (data.level) return data.level;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 'intermediate'; // Default assumption
}

function adaptResponseLength(
  response: string,
  preferences: UserPreferences
): string {
  const style = preferences.responseStyle === 'auto'
    ? getAutoStyle(preferences.expertiseLevel)
    : preferences.responseStyle;

  if (style === 'concise') {
    return createConciseVersion(response);
  } else if (style === 'detailed') {
    return response; // Keep full response
  }

  // Auto - return as-is, already optimized by expertise detection
  return response;
}

function getAutoStyle(expertise: string): ResponseStyle {
  switch (expertise) {
    case 'power_user':
      return 'concise';
    case 'novice':
      return 'detailed';
    default:
      return 'detailed'; // Default to detailed for intermediate
  }
}

function createConciseVersion(response: string): string {
  const lines = response.split('\n');
  const conciseLines: string[] = [];

  let inTable = false;
  let skipExplanation = false;

  for (const line of lines) {
    // Always keep headers
    if (line.startsWith('**') && line.endsWith('**')) {
      conciseLines.push(line);
      skipExplanation = false;
      continue;
    }

    // Always keep tables
    if (line.includes('|')) {
      inTable = true;
      conciseLines.push(line);
      continue;
    } else if (inTable && line.trim() === '') {
      inTable = false;
    }

    // Always keep bullet points with data
    if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
      if (/\d|%|\$/.test(line)) {
        conciseLines.push(line);
      }
      continue;
    }

    // Skip explanatory paragraphs (long lines without data)
    if (line.length > 100 && !/\d|%|\$/.test(line)) {
      skipExplanation = true;
      continue;
    }

    // Keep lines with specific data
    if (/\d{1,3}(?:,\d{3})*|\d+%|\$\d+/.test(line)) {
      conciseLines.push(line);
      continue;
    }

    // Keep empty lines for formatting
    if (line.trim() === '' && conciseLines.length > 0) {
      const lastLine = conciseLines[conciseLines.length - 1];
      if (lastLine.trim() !== '') {
        conciseLines.push(line);
      }
    }
  }

  // Ensure we don't return empty response
  if (conciseLines.length < 3) {
    return response;
  }

  return conciseLines.join('\n').trim();
}

function detectPoliticalSensitivity(
  query: string,
  response: string
): 'low' | 'medium' | 'high' {
  const combined = `${query} ${response}`.toLowerCase();

  for (const pattern of SENSITIVE_TOPICS.high) {
    if (pattern.test(combined)) return 'high';
  }

  for (const pattern of SENSITIVE_TOPICS.medium) {
    if (pattern.test(combined)) return 'medium';
  }

  return 'low';
}

function detectCloseRace(response: string): boolean {
  return CLOSE_RACE_PATTERNS.some(pattern => pattern.test(response));
}

function addEmotionalIntelligence(
  response: string,
  sensitivity: 'low' | 'medium' | 'high',
  isCloseRace: boolean
): string {
  let enhanced = response;

  // For high sensitivity topics, add balanced framing note
  if (sensitivity === 'high') {
    // Check if response already has a disclaimer
    if (!/note:|disclaimer:|important:/i.test(response)) {
      enhanced = response + '\n\n*Analysis provided for informational purposes. Political outcomes depend on many factors beyond current data.*';
    }
  }

  // For close races, add uncertainty acknowledgment
  if (isCloseRace && !/uncertain|unpredictable|volatile/i.test(response)) {
    enhanced = enhanced.replace(
      /(\*\*(?:Win Margin|Competitive Status|Race Rating)[^*]*\*\*[^*\n]*)/gi,
      '$1 *(outcomes in close races can shift significantly with turnout and late-deciding voters)*'
    );
  }

  // Ensure partisan balance in competitive district discussions
  if (sensitivity === 'medium' && /partisan lean/i.test(response)) {
    // Check for one-sided framing
    const demMentions = (response.match(/democrat|dem\+|d\+|blue/gi) || []).length;
    const repMentions = (response.match(/republican|rep\+|r\+|red/gi) || []).length;

    // If heavily skewed one way, add balancing context
    if (Math.abs(demMentions - repMentions) > 3) {
      enhanced = enhanced + '\n\n*Both parties have opportunities in this area depending on candidate quality, turnout, and campaign strategy.*';
    }
  }

  return enhanced;
}

function analyzeInsightDataRatio(response: string): number {
  const lines = response.split('\n').slice(0, 5); // Check first 5 lines
  const firstContentLine = lines.find(l => l.trim().length > 10);

  if (!firstContentLine) return 0.5;

  // Check if first line is data-heavy
  const isDataFirst = DATA_PATTERNS.some(p => p.test(firstContentLine));
  const isInsightFirst = INSIGHT_PATTERNS.some(p => p.test(firstContentLine));

  if (isInsightFirst) return 0; // All insight
  if (isDataFirst) return 1; // All data

  return 0.5; // Mixed
}

function addSoWhatFraming(
  response: string,
  intent: string,
  data?: Record<string, unknown>
): string {
  // Check if response already leads with insight
  const ratio = analyzeInsightDataRatio(response);

  if (ratio < 0.5) {
    // Already has good insight framing
    return response;
  }

  // Generate strategic insight based on intent
  const insightGenerator = STRATEGIC_INSIGHTS[intent] || STRATEGIC_INSIGHTS.default;
  const insight = insightGenerator(data || {});

  // Only prepend insight if it's not empty (skip error messages)
  if (!insight || insight.trim() === '') {
    return response;
  }

  // Prepend insight to response
  return `${insight}\n\n${response}`;
}

