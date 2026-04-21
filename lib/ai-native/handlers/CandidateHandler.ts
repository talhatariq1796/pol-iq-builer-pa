import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, getEnrichmentForQuery, formatEnrichmentSections } from './types';
import { isPAPoliticalRegion } from '@/lib/political/formatPoliticalDistrictLabel';

const CANDIDATE_PATTERNS: QueryPattern[] = [
  {
    intent: 'candidate_profile',
    patterns: [
      /tell\s+(?:me\s+)?about\s+(slotkin|rogers|trump|biden|harris|peters|stabenow)/i,
      /who\s+is\s+(slotkin|rogers|trump|biden|harris|peters|stabenow)/i,
      /(slotkin|rogers|trump|biden|harris|peters|stabenow)\s+profile/i,
      /(?:show|view)\s+(?:me\s+)?(slotkin|rogers|trump|biden|harris|peters|stabenow)/i,
      /(?:candidate\s+)?profile\s+(?:for\s+)?(slotkin|rogers|trump|biden|harris|peters|stabenow)/i,
    ],
    keywords: ['slotkin', 'rogers', 'trump', 'biden', 'harris', 'peters', 'stabenow', 'profile', 'about', 'who is'],
    priority: 10,
  },
  {
    intent: 'candidate_race',
    patterns: [
      /who(?:'?s|\s+is)\s+running\s+(?:in|for)\s+(?:state\s+house|house\s+district|hd)\s*[-\s]?(\d+)/i,
      /(?:state\s+house|house\s+district|hd)\s*[-\s]?(\d+)\s+(?:race|candidates?)/i,
      /candidates?\s+(?:in|for)\s+(?:state\s+house|senate|congressional|mi-?\d+)/i,
      /who(?:'?s|\s+is)\s+running\s+(?:in|for)\s+(?:senate|congress)/i,
      /(?:show|list)\s+(?:all\s+)?candidates?\s+(?:in|for)/i,
    ],
    keywords: ['running', 'race', 'candidates', 'state house', 'senate', 'congress', 'district'],
    priority: 9,
  },
  {
    intent: 'candidate_competitive',
    patterns: [
      /(?:what|which)\s+(?:are\s+)?(?:the\s+)?competitive\s+races?/i,
      /competitive\s+(?:races?|elections?|districts?)/i,
      /toss.?up\s+races?/i,
      /close\s+races?/i,
      /battleground\s+(?:races?|districts?)/i,
      /(?:show|find)\s+(?:me\s+)?(?:the\s+)?(?:most\s+)?competitive/i,
    ],
    keywords: ['competitive', 'close', 'toss-up', 'battleground', 'races'],
    priority: 8,
  },
  {
    intent: 'candidate_fundraising',
    patterns: [
      /candidate\s+fundraising/i,
      /(?:show|compare)\s+(?:candidate\s+)?(?:fundraising|money\s+raised)/i,
      /who(?:'?s|\s+has)\s+raised\s+(?:the\s+)?most/i,
      /fundraising\s+(?:comparison|totals?|summary)/i,
      /campaign\s+(?:finance|money)/i,
    ],
    keywords: ['fundraising', 'raised', 'money', 'campaign', 'finance'],
    priority: 8,
  },
  {
    intent: 'candidate_endorsements',
    patterns: [
      /(?:who|which\s+groups?)\s+(?:has\s+)?endorsed\s+(slotkin|rogers)/i,
      /(slotkin|rogers)\s+endorsements?/i,
      /endorsements?\s+(?:for\s+)?(slotkin|rogers)/i,
      /(?:show|list)\s+endorsements?/i,
    ],
    keywords: ['endorsed', 'endorsement', 'endorsements', 'groups', 'support'],
    priority: 8,
  },
];

interface CandidateInfo {
  name: string;
  party: 'D' | 'R';
  office: string;
  district?: string;
  incumbent: boolean;
  endorsements: string[];
  keyIssues: string[];
  fundraising?: {
    raised: number;
    cashOnHand: number;
  };
  lastUpdated?: string; // ISO date when data was last verified
}

const CANDIDATES: Record<string, CandidateInfo> = {
  slotkin: {
    name: 'Elissa Slotkin',
    party: 'D',
    office: 'U.S. Senate',
    incumbent: true, // Won 2024 election
    endorsements: ['UAW', 'Michigan AFL-CIO', 'Emily\'s List', 'End Citizens United'],
    keyIssues: ['Healthcare', 'National Security', 'Reproductive Rights', 'Economy'],
    fundraising: { raised: 22500000, cashOnHand: 8200000 },
    lastUpdated: '2024-11-06',
  },
  rogers: {
    name: 'Mike Rogers',
    party: 'R',
    office: 'U.S. Senate',
    incumbent: false,
    endorsements: ['Right to Life of Michigan', 'NRA', 'Michigan Chamber of Commerce'],
    keyIssues: ['Border Security', 'Economy', 'Crime', 'Energy'],
    fundraising: { raised: 12800000, cashOnHand: 3100000 },
    lastUpdated: '2024-11-06',
  },
  peters: {
    name: 'Gary Peters',
    party: 'D',
    office: 'U.S. Senate',
    district: 'Michigan',
    incumbent: true,
    endorsements: ['Michigan AFL-CIO', 'Sierra Club', 'Planned Parenthood'],
    keyIssues: ['Manufacturing', 'Veterans', 'Great Lakes', 'Infrastructure'],
    fundraising: { raised: 18000000, cashOnHand: 5500000 },
    lastUpdated: '2024-11-06',
  },
  stabenow: {
    name: 'Debbie Stabenow',
    party: 'D',
    office: 'U.S. Senate (Retired)',
    district: 'Michigan',
    incumbent: false, // Retired 2024
    endorsements: ['Michigan Farm Bureau', 'UAW', 'AFSCME'],
    keyIssues: ['Agriculture', 'Mental Health', 'Great Lakes', 'Trade'],
    fundraising: { raised: 15000000, cashOnHand: 4200000 },
    lastUpdated: '2024-11-06',
  },
};

async function getCandidateData(candidateKey: string): Promise<CandidateInfo | null> {
  // TODO: Integrate with FEC API for live fundraising data
  // TODO: Integrate with Knowledge Graph for endorsements
  // For now, return local data
  return CANDIDATES[candidateKey] || null;
}

export class CandidateHandler implements NLPHandler {
  name = 'CandidateHandler';
  patterns = CANDIDATE_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'candidate_profile' ||
      query.intent === 'candidate_race' ||
      query.intent === 'candidate_competitive' ||
      query.intent === 'candidate_fundraising' ||
      query.intent === 'candidate_endorsements'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    if (isPAPoliticalRegion()) {
      return this.paDeploymentCandidateResponse();
    }

    try {
      switch (query.intent) {
        case 'candidate_profile':
          return await this.handleProfile(query, startTime);

        case 'candidate_race':
          return await this.handleRace(query, startTime);

        case 'candidate_competitive':
          return await this.handleCompetitive(query, startTime);

        case 'candidate_fundraising':
          return await this.handleFundraising(query, startTime);

        case 'candidate_endorsements':
          return await this.handleEndorsements(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown candidate intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process candidate query'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Pennsylvania deployment: skip legacy Michigan demo candidate tables; steer users to precinct analytics.
   */
  private paDeploymentCandidateResponse(): HandlerResult {
    return {
      success: true,
      response: [
        '**Pennsylvania workspace**',
        '',
        'Candidate bios and sample race tables in this module were written for a legacy Michigan demo. This app’s map and metrics use **Pennsylvania precinct data**.',
        '',
        'Ask about **precincts, districts (PA House / Senate / Congress), swing potential, GOTV, persuasion, or demographics**.',
        '',
        'For official filings and candidate lists, use the [Pennsylvania Department of State](https://www.dos.pa.gov) and [FEC](https://www.fec.gov).',
      ].join('\n'),
      suggestedActions: [
        {
          id: 'pa-swing',
          label: 'Top swing precincts',
          action: 'Which Pennsylvania precincts have the highest swing potential?',
          priority: 1,
        },
        {
          id: 'pa-competitive',
          label: 'Competitive lean',
          action: 'Show areas with partisan lean between -5 and +5 in Pennsylvania',
          priority: 2,
        },
        {
          id: 'pa-hd',
          label: 'State House example',
          action: 'Show State House 171 in Pennsylvania',
          priority: 3,
        },
      ],
    };
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleProfile(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract candidate name from query
    const candidatePattern = /(slotkin|rogers|trump|biden|harris|peters|stabenow)/i;
    const match = query.originalQuery.match(candidatePattern);
    const candidateKey = match?.[1]?.toLowerCase();

    // Get candidate data from configured sources
    const candidate = candidateKey ? await getCandidateData(candidateKey) : null;

    if (!candidateKey || !candidate) {
      return {
        success: false,
        response: 'Please specify a candidate. Available: Slotkin, Rogers, Peters, Stabenow.',
        suggestedActions: [
          { id: 'slotkin', label: 'Elissa Slotkin', action: 'Tell me about Slotkin', priority: 1 },
          { id: 'rogers', label: 'Mike Rogers', action: 'Tell me about Rogers', priority: 2 },
        ],
        error: 'Candidate not specified',
      };
    }

    // Get enrichment
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    const response = [
      `**${candidate.name}** (${candidate.party === 'D' ? 'Democrat' : 'Republican'})`,
      '',
      `**Office:** ${candidate.office}${candidate.district ? ` - ${candidate.district}` : ''}`,
      `**Status:** ${candidate.incumbent ? 'Incumbent' : 'Challenger'}`,
      '',
      `**Key Issues:**`,
      ...candidate.keyIssues.map(issue => `- ${issue}`),
      '',
      `**Notable Endorsements:**`,
      ...candidate.endorsements.slice(0, 4).map(e => `- ${e}`),
      '',
      candidate.fundraising ? `**Fundraising:** $${(candidate.fundraising.raised / 1000000).toFixed(1)}M raised, $${(candidate.fundraising.cashOnHand / 1000000).toFixed(1)}M cash on hand` : '',
      '',
      `*Data as of ${candidate.lastUpdated || '2024'}. For real-time FEC data, check [fec.gov](https://www.fec.gov).*`,
    ].filter(Boolean).join('\n');

    return {
      success: true,
      response: response + enrichmentSections,
      suggestedActions: [
        {
          id: 'compare-opponent',
          label: 'Compare to Opponent',
          action: `Compare ${candidate.name} fundraising`,
          priority: 1,
        },
        {
          id: 'show-donors',
          label: 'View Donors',
          action: `Show donors for ${candidateKey}`,
          priority: 2,
        },
        {
          id: 'endorsements',
          label: 'Full Endorsements',
          action: `Show ${candidateKey} endorsements`,
          priority: 3,
        },
      ],
      data: candidate,
      metadata: this.buildMetadata('candidate_profile', startTime, query),
    };
  }

  private async handleRace(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract district from query
    const districtPattern = /(?:state\s+house|house\s+district|hd)\s*[-\s]?(\d+)/i;
    const match = query.originalQuery.match(districtPattern);
    const districtNum = match?.[1];

    // Check for senate/congressional races
    const isSenate = /senate/i.test(query.originalQuery);
    const isCongress = /congress|mi-?\d+/i.test(query.originalQuery);

    let response: string;
    let candidates: CandidateInfo[] = [];

    if (isSenate) {
      candidates = [CANDIDATES.slotkin, CANDIDATES.rogers];
      response = [
        '**2024 Michigan U.S. Senate Race:**',
        '',
        '**Democratic Candidate:**',
        `- ${CANDIDATES.slotkin.name} (Former U.S. Representative)`,
        `  Raised: $${(CANDIDATES.slotkin.fundraising!.raised / 1000000).toFixed(1)}M`,
        '',
        '**Republican Candidate:**',
        `- ${CANDIDATES.rogers.name} (Former U.S. Representative)`,
        `  Raised: $${(CANDIDATES.rogers.fundraising!.raised / 1000000).toFixed(1)}M`,
        '',
        '**Race Rating:** Toss-up / Lean D',
      ].join('\n');
    } else if (districtNum) {
      response = [
        `**State House District ${districtNum} Race:**`,
        '',
        '*Candidate data for state legislative races is being loaded from the Knowledge Graph.*',
        '',
        'For now, you can explore:',
        `- District ${districtNum} voter composition`,
        `- Historical election results`,
        `- Demographic breakdown`,
      ].join('\n');
    } else {
      response = [
        '**Key 2024 Races in Ingham County:**',
        '',
        '**U.S. Senate:** Slotkin (D) vs Rogers (R) - Toss-up',
        '**MI-07 Congress:** Curtis Hertel (D) vs Tom Barrett (R) - Lean D',
        '',
        '**State House Districts:**',
        '- HD-73: Democratic incumbent',
        '- HD-74: Democratic incumbent',
        '- HD-75: Democratic incumbent',
        '- HD-77: Democratic incumbent',
        '',
        '*Ask about a specific race for more details.*',
      ].join('\n');
    }

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'senate-race',
          label: 'Senate Race Details',
          action: 'Tell me about the Senate race',
          priority: 1,
        },
        {
          id: 'fundraising',
          label: 'Fundraising Comparison',
          action: 'Compare candidate fundraising',
          priority: 2,
        },
      ],
      data: { candidates, districtNum },
      metadata: this.buildMetadata('candidate_race', startTime, query),
    };
  }

  private async handleCompetitive(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = [
      '**Competitive Races in Ingham County Area:**',
      '',
      '**Federal:**',
      '| Race | Candidates | Rating |',
      '|------|------------|--------|',
      '| U.S. Senate | Slotkin (D) vs Rogers (R) | Toss-up |',
      '| MI-07 | Hertel (D) vs Barrett (R) | Lean D |',
      '',
      '**State Senate:**',
      '| District | Incumbent | Rating |',
      '|----------|-----------|--------|',
      '| SD-21 | Sarah Anthony (D) | Safe D |',
      '| SD-28 | Sam Singh (D) | Safe D |',
      '',
      '**State House:**',
      '| District | Incumbent | Rating |',
      '|----------|-----------|--------|',
      '| HD-73 | Julie Brixie (D) | Safe D |',
      '| HD-74 | Kara Hope (D) | Likely D |',
      '| HD-75 | Penelope Tsernoglou (D) | Safe D |',
      '| HD-77 | Emily Dievendorf (D) | Likely D |',
      '',
      '*Ingham County is predominantly Democratic. Most competitive races are at federal level.*',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'senate-details',
          label: 'Senate Race Details',
          action: 'Tell me about the Senate race',
          priority: 1,
        },
        {
          id: 'swing-precincts',
          label: 'Find Swing Precincts',
          action: 'Find swing precincts',
          priority: 2,
        },
      ],
      metadata: this.buildMetadata('candidate_competitive', startTime, query),
    };
  }

  private async handleFundraising(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = [
      '**2024 Candidate Fundraising Summary:**',
      '',
      '| Candidate | Office | Raised | Cash on Hand |',
      '|-----------|--------|--------|--------------|',
      `| ${CANDIDATES.slotkin.name} | Senate | $${(CANDIDATES.slotkin.fundraising!.raised / 1000000).toFixed(1)}M | $${(CANDIDATES.slotkin.fundraising!.cashOnHand / 1000000).toFixed(1)}M |`,
      `| ${CANDIDATES.rogers.name} | Senate | $${(CANDIDATES.rogers.fundraising!.raised / 1000000).toFixed(1)}M | $${(CANDIDATES.rogers.fundraising!.cashOnHand / 1000000).toFixed(1)}M |`,
      `| ${CANDIDATES.peters.name} | Senate (Inc) | $${(CANDIDATES.peters.fundraising!.raised / 1000000).toFixed(1)}M | $${(CANDIDATES.peters.fundraising!.cashOnHand / 1000000).toFixed(1)}M |`,
      '',
      '**Key Takeaways:**',
      `- Slotkin leads Rogers by $${((CANDIDATES.slotkin.fundraising!.raised - CANDIDATES.rogers.fundraising!.raised) / 1000000).toFixed(1)}M in total raised`,
      '- Democratic candidates have significant cash advantage',
      '',
      '*Data from FEC filings through Q3 2024*',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'donor-concentration',
          label: 'View Donor Map',
          action: 'Where are donors concentrated?',
          priority: 1,
        },
        {
          id: 'ie-spending',
          label: 'Outside Money',
          action: 'Show independent expenditures',
          priority: 2,
        },
      ],
      metadata: this.buildMetadata('candidate_fundraising', startTime, query),
    };
  }

  private async handleEndorsements(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract candidate
    const candidatePattern = /(slotkin|rogers)/i;
    const match = query.originalQuery.match(candidatePattern);
    const candidateKey = match?.[1]?.toLowerCase() || 'slotkin';
    const candidate = await getCandidateData(candidateKey);

    if (!candidate) {
      return {
        success: false,
        response: `No data found for ${candidateKey}.`,
        error: 'Candidate not found',
      };
    }

    const response = [
      `**${candidate.name} Endorsements:**`,
      '',
      '**Labor:**',
      ...candidate.endorsements.filter(e => /AFL|UAW|AFSCME|Union/i.test(e)).map(e => `- ${e}`),
      '',
      '**Advocacy Groups:**',
      ...candidate.endorsements.filter(e => !/AFL|UAW|AFSCME|Union/i.test(e)).map(e => `- ${e}`),
      '',
      `*${candidate.party === 'D' ? 'Democratic' : 'Republican'} candidate has strong ${candidate.party === 'D' ? 'labor and progressive' : 'conservative and business'} backing.*`,
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'opponent-endorsements',
          label: 'Opponent Endorsements',
          action: `Show ${candidateKey === 'slotkin' ? 'Rogers' : 'Slotkin'} endorsements`,
          priority: 1,
        },
        {
          id: 'profile',
          label: 'Full Profile',
          action: `Tell me about ${candidateKey}`,
          priority: 2,
        },
      ],
      data: candidate,
      metadata: this.buildMetadata('candidate_endorsements', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract candidate names
    const candidatePattern = /(slotkin|rogers|trump|biden|harris|peters|stabenow)/gi;
    const matches = query.match(candidatePattern);
    if (matches) {
      entities.candidates = matches.map(m => m.toLowerCase());
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'candidate',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

export const candidateHandler = new CandidateHandler();

export default CandidateHandler;
