/**
 * Political Chat API
 *
 * Natural language interface for political data queries.
 * Supports queries like:
 * - "Compare Philadelphia vs Pittsburgh"
 * - "Which precincts have highest swing potential?"
 * - "What's the partisan lean in Allegheny County?"
 *
 * Includes RAG (Retrieval-Augmented Generation) for methodology
 * and data source documentation, with citation support.
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { politicalQueryRouter, ParsedPoliticalQuery } from '@/lib/analysis/PoliticalQueryRouter';
import {
  politicalDataService,
  type PrecinctRankingMetric,
} from '@/lib/services/PoliticalDataService';
import { getDocumentRetriever } from '@/lib/rag';
import { getKnowledgeGraph, getGraphPopulator, Entity, Relationship } from '@/lib/knowledge-graph';
import { enrich, formatForSystemPrompt as formatEnrichmentForSystemPrompt, type EnrichmentContext } from '@/lib/context';
import type { MapCommand } from '@/lib/ai-native/types';
import { resolveClaudeModel } from '@/lib/ai/claudeModel';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';
import {
  extractActionDirectives,
  stripActionDirectives,
} from '@/lib/ai/stripActionDirectives';
import type {
  IncomeBucketsPartisanLean,
  PrecinctCanvassingEfficiencyRank,
  PrecinctElectionShiftRank,
  PrecinctTurnoutTrendRank,
  TurnoutTrendExtremesResult,
} from '@/types/political';
import { collectDataPrecinctIdsForQuery } from '@/lib/political/politicalChatExportIds';
import {
  wantsCanvassingEfficiencyQuery,
  wantsElectionShiftQuery,
  wantsTurnoutTrendQuery,
} from '@/lib/political/politicalChatQueryFlags';

export const maxDuration = 120;
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/** Client-supplied geographic scope for NL chat (political-ai escalation). */
export interface ChatMapSelection {
  selectedPrecinctName?: string;
  /** PA: canonical map / targeting key (e.g. UNIQUE_ID `037-:-BLOOMSBURG WARD 02`) — use for unified data lookup when display name fails */
  selectedPrecinctMapKey?: string;
  /** Municipality / jurisdiction from precinct feature attributes (e.g. Jurisdiction_Name) */
  selectedPrecinctJurisdiction?: string;
  lastAnalysisAreaName?: string;
  lastAnalysisPrecinctNames?: string[];
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Ground Claude on the same modeled lean as IQbuilder (PA unified lean is Segment-signed in storage).
 * Optionally attach 2024 presidential row so the model can separate "modeled lean" vs "last election margin".
 */
async function formatSelectedPrecinctSnapshot(
  selectedLabel: string,
  jurisdictionHint?: string,
  mapKey?: string
): Promise<string | null> {
  try {
    await politicalDataService.initialize();
    const trimmedKey = mapKey?.trim();
    let u =
      trimmedKey && trimmedKey.length > 0
        ? await politicalDataService.getUnifiedPrecinct(trimmedKey)
        : null;
    if (!u && selectedLabel.trim()) {
      u = await politicalDataService.getUnifiedPrecinct(selectedLabel.trim());
    }
    if (!u) return null;
    const isPA = getPoliticalRegionEnv().stateFips === '42';
    const modeledLeanDisplay = isPA ? -u.electoral.partisanLean : u.electoral.partisanLean;
    const leanStr =
      modeledLeanDisplay >= 0
        ? `D+${modeledLeanDisplay.toFixed(1)}`
        : `R+${Math.abs(modeledLeanDisplay).toFixed(1)}`;

    let electionBlock = '';
    const data = await politicalDataService.getPrecinctDataFileFormat();
    const keys = Object.keys(data.precincts);
    const resolvedFromKey =
      trimmedKey && keys.includes(trimmedKey)
        ? trimmedKey
        : trimmedKey
          ? await politicalDataService.resolvePrecinctMapKey(trimmedKey)
          : null;
    const resolvedFromLabel = await politicalDataService.resolvePrecinctMapKey(selectedLabel);
    const canon =
      resolvedFromKey ||
      resolvedFromLabel ||
      keys.find((k) => {
        const pr = data.precincts[k];
        return pr.name?.toLowerCase() === selectedLabel.toLowerCase();
      }) ||
      keys.find((k) => {
        const pr = data.precincts[k];
        const nm = (pr.name || '').toLowerCase();
        return nm && selectedLabel.toLowerCase().includes(nm);
      });
    const pRow = canon ? data.precincts[canon] : undefined;
    const e24 = pRow?.elections?.['2024'];
    if (e24) {
      electionBlock = `\n- **2024 presidential (reported):** Dem ${e24.demPct.toFixed(1)}%, Rep ${e24.repPct.toFixed(1)}%, margin (Dem−Rep) **${e24.margin >= 0 ? '+' : ''}${e24.margin.toFixed(1)}** pp.`;
    }

    const rawTurnout = u.electoral.avgTurnout ?? 0;
    const turnoutPct = rawTurnout > 1 ? rawTurnout : rawTurnout * 100;
    const turnoutLine =
      turnoutPct > 0.05 && turnoutPct <= 100.5
        ? `\n- **Historical avg turnout** (2020–2024 presidential, reported): **${turnoutPct.toFixed(1)}%**`
        : '';

    return `## Selected precinct — authoritative metrics (use these; do not contradict)
**${u.name}** (${u.jurisdiction || jurisdictionHint || 'jurisdiction unknown'})
- **Modeled partisan lean** (IQbuilder / targeting scores; positive = Democratic): **${leanStr}**
- Swing: ${u.electoral.swingPotential}/100; GOTV: ${u.targeting.gotvPriority}/100; Persuasion: ${u.targeting.persuasionOpportunity}/100${turnoutLine}${electionBlock}

When the user asks for a "profile" or "lean", use **modeled lean** above for consistency with the analysis panel. If **2024 presidential** is listed, you may cite it as actual reported results; it can differ from modeled lean (different basis/year).`;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log('[Political Chat API] Endpoint called');

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const messages = body.messages;
    const includeData = body.includeData !== false;
    const context = typeof body.context === 'string' ? body.context : undefined;
    const currentQuery = typeof body.currentQuery === 'string' ? body.currentQuery : undefined;
    const userContext = body.userContext;
    const mapSelection = body.mapSelection as ChatMapSelection | undefined;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Log context if provided (Phase 3 - Claude Integration)
    if (context) {
      console.log('[Political Chat API] Session context provided:', {
        hasContext: !!context,
        contextLength: context?.length || 0,
      });
    }

    // Get the latest user message
    const latestMessage = messages[messages.length - 1];
    if (latestMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    const userQuery = latestMessage.content;
    console.log('[Political Chat API] User query:', userQuery);

    // Parse the query using PoliticalQueryRouter
    const routeResult = politicalQueryRouter.parseQuery(userQuery);
    console.log('[Political Chat API] Query parsed:', {
      type: routeResult.parsed.type,
      handler: routeResult.handler,
      locations: routeResult.parsed.locationNames,
      confidence: routeResult.parsed.confidence,
    });

    // Fetch relevant data based on parsed query (always attach college+precinct rankings when asked — low router confidence used to yield empty context and Claude denied we had data)
    const wantsCollegePrecinctContext =
      /\b(college|bachelor|educated|education\s+attainment)\b/i.test(userQuery) &&
      /\bprecincts?\b/i.test(userQuery);
    const wantsIncomeLeanBuckets =
      /\b(income|affluence|median\s+household|household\s+income)\b/i.test(userQuery) &&
      /\b(partisan|political\s+)?lean\b/i.test(userQuery);
    const wantsElectionShiftContext = wantsElectionShiftQuery(userQuery);
    const wantsTurnoutTrendContext = wantsTurnoutTrendQuery(userQuery);
    const wantsCanvassingEfficiencyContext = wantsCanvassingEfficiencyQuery(userQuery);
    let contextData = '';
    let dataPrecinctIds: string[] | undefined;

    const needsDataContext =
      routeResult.parsed.confidence > 0.4 ||
      wantsCollegePrecinctContext ||
      wantsIncomeLeanBuckets ||
      wantsElectionShiftContext ||
      wantsTurnoutTrendContext ||
      wantsCanvassingEfficiencyContext ||
      Boolean(mapSelection?.selectedPrecinctName || mapSelection?.selectedPrecinctMapKey);

    if (includeData) {
      const [ctx, exportIds] = await Promise.all([
        needsDataContext
          ? fetchDataForQuery(routeResult.parsed, mapSelection, userQuery)
          : Promise.resolve(''),
        collectDataPrecinctIdsForQuery(routeResult.parsed, userQuery),
      ]);
      contextData = ctx;
      if (exportIds && exportIds.length > 0) {
        dataPrecinctIds = exportIds;
      }
    }

    // Same IDs the client will export — keeps assistant counts aligned with CSV (no 810 vs 774 mismatch).
    if (dataPrecinctIds && dataPrecinctIds.length > 0) {
      const n = dataPrecinctIds.length;
      contextData += `

## Authoritative filter / export (single source of truth)
- **Precinct count for this query (CSV export uses exactly this list):** **${n}**
- When stating how many precincts match this filter, use **${n}** — do not round or estimate a different number.
- Registered-voter or population totals you cite should be **sums over these ${n} precincts** only when discussing this filter.`;
    }

    // Unified Context Enrichment: RAG + Knowledge Graph in one call
    let enrichmentContext: EnrichmentContext | null = null;
    let enrichmentPromptContext = '';
    try {
      // Determine enrichment options from parsed query
      const jurisdiction = routeResult.parsed.locationNames.length > 0
        ? routeResult.parsed.locationNames[0]
        : getPoliticalRegionEnv().summaryAreaName;

      enrichmentContext = await enrich(userQuery, {
        jurisdiction,
        includeMethodology: userQuery.toLowerCase().includes('how') || userQuery.toLowerCase().includes('why'),
        includeCurrentIntel: true,
        includeCandidates: true,
        includeIssues: true,
      });

      if (enrichmentContext.relevance.shouldInclude) {
        enrichmentPromptContext = formatEnrichmentForSystemPrompt(enrichmentContext);
        console.log('[Political Chat API] Unified enrichment:', {
          ragDocs: enrichmentContext.rag.documents.length,
          intel: enrichmentContext.rag.currentIntel.length,
          candidates: enrichmentContext.graph.candidates.length,
          relevance: enrichmentContext.relevance.overallScore.toFixed(2),
        });
      }
    } catch (enrichmentError) {
      console.warn('[Political Chat API] Unified enrichment failed:', enrichmentError);
      // Continue without enrichment context
    }

    // Legacy: Keep separate calls as fallback (can be removed once unified service is proven)
    let ragContext = '';
    let graphContext = '';
    if (!enrichmentPromptContext) {
      // Fallback to legacy RAG retrieval
      try {
        const retriever = getDocumentRetriever();
        const jurisdiction = routeResult.parsed.locationNames.length > 0
          ? routeResult.parsed.locationNames[0]
          : undefined;

        const retrievalResult = await retriever.retrieve(userQuery, {
          maxDocs: 2,
          maxIntel: 3,
          jurisdiction,
        });

        if (retrievalResult.documents.length > 0 || retrievalResult.currentIntel.length > 0) {
          ragContext = retriever.formatForSystemPrompt(retrievalResult);
        }
      } catch (ragError) {
        console.warn('[Political Chat API] Legacy RAG retrieval failed:', ragError);
      }

      // Fallback to legacy Knowledge Graph
      try {
        const graphResult = await getKnowledgeGraphContext(userQuery, routeResult.parsed);
        if (graphResult.context) {
          graphContext = graphResult.context;
        }
      } catch (graphError) {
        console.warn('[Political Chat API] Legacy Knowledge Graph failed:', graphError);
      }
    }

    const expertiseLevel = 'intermediate';

    // Build system prompt with political domain knowledge + enrichment context + Session context + Expertise context
    // Prefer unified enrichment, fall back to legacy if needed
    const contextToUse = enrichmentPromptContext || (ragContext + graphContext);
    const systemPrompt = buildPoliticalSystemPrompt(contextData, contextToUse, '', context, expertiseLevel);

    // Call Claude with political context
    const claudeMessages = messages.map((msg: ChatMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    console.log('[Political Chat API] Calling Claude...');
    const response = await anthropic.messages.create({
      model: resolveClaudeModel(),
      max_tokens: 2000,
      messages: claudeMessages,
      system: systemPrompt,
    });

    const content =
      response.content[0]?.type === 'text' ? response.content[0].text : 'No response generated';

    // Parse action directives from Claude response and convert to mapCommands
    const mapCommands = parseActionDirectivesToMapCommands(content, routeResult.parsed);
    const contentForClient = stripActionDirectives(content);

    console.log('[Political Chat API] Response generated successfully');
    return NextResponse.json({
      content: contentForClient,
      dataPrecinctIds,
      metadata: {
        queryType: routeResult.parsed.type,
        locations: routeResult.parsed.locationNames,
        metric: routeResult.parsed.metric,
        confidence: routeResult.parsed.confidence,
        handler: routeResult.handler,
        exportPrecinctCount: dataPrecinctIds?.length,
      },
      mapCommands,
      rag: {
        documents: enrichmentContext?.rag.documents.map(d => d.id) || [],
        currentIntel: enrichmentContext?.rag.currentIntel.map(d => d.id) || [],
        citations: enrichmentContext?.rag.citations.map(c => ({
          key: c.citation_key,
          description: c.description,
          source: c.source,
        })) || [],
      },
      graph: {
        entities: enrichmentContext?.graph.candidates.map(c => c.incumbent?.name || '').filter(Boolean) || [],
      },
      enrichment: {
        relevance: enrichmentContext?.relevance.overallScore || 0,
        included: enrichmentContext?.relevance.shouldInclude || false,
      },
    });
  } catch (error) {
    console.error('[Political Chat API] Error:', error);
    return NextResponse.json(
      {
        error: 'Chat API error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch relevant data based on parsed query.
 * Uses politicalDataService (state-scoped build: Pennsylvania precincts when FIPS 42 / PA deployment).
 */
async function fetchDataForQuery(
  parsed: ParsedPoliticalQuery,
  mapSelection?: ChatMapSelection,
  userQuery?: string
): Promise<string> {
  const dataParts: string[] = [];

  try {
    switch (parsed.type) {
      case 'comparison': {
        if (parsed.locationNames.length >= 2) {
          const comparison = await politicalDataService.compareJurisdictions(
            parsed.locationNames[0],
            parsed.locationNames[1]
          );
          if (comparison) {
            dataParts.push(formatComparison(comparison));
          }
        }
        break;
      }

      case 'ranking': {
        const precinctRankMetrics: PrecinctRankingMetric[] = [
          'partisan_lean',
          'swing_potential',
          'gotv_priority',
          'persuasion_opportunity',
          'turnout',
          'combined_score',
          'college_pct',
        ];
        let rankablePrecinctMetric: PrecinctRankingMetric =
          parsed.metric && precinctRankMetrics.includes(parsed.metric as PrecinctRankingMetric)
            ? (parsed.metric as PrecinctRankingMetric)
            : 'swing_potential';
        if (
          rankablePrecinctMetric === 'swing_potential' &&
          /\b(college|bachelor|educated|education\s+attainment)\b/i.test(parsed.originalQuery) &&
          /\bprecinct/i.test(parsed.originalQuery)
        ) {
          rankablePrecinctMetric = 'college_pct';
        }

        const jurisdictionRankMetrics = [
          'partisan_lean',
          'swing_potential',
          'gotv_priority',
          'persuasion_opportunity',
          'turnout',
        ] as const;
        const rankableJurisdictionMetric =
          parsed.metric && jurisdictionRankMetrics.includes(parsed.metric as (typeof jurisdictionRankMetrics)[number])
            ? (parsed.metric as (typeof jurisdictionRankMetrics)[number])
            : 'swing_potential';

        // "Areas" in a statewide ranking query means precinct-level rows (same as explicit "precincts")
        const wantsStatewidePrecincts =
          parsed.locationNames.length === 0 &&
          (/\bprecincts?\b/i.test(parsed.originalQuery) || /\bareas?\b/i.test(parsed.originalQuery));

        if (parsed.locationNames.length > 0) {
          const rankings = await politicalDataService.rankPrecinctsInJurisdiction(
            parsed.locationNames[0],
            rankablePrecinctMetric,
            parsed.ranking || 'highest',
            parsed.limit || 10
          );
          dataParts.push(formatPrecinctRankings(parsed.locationNames[0], rankings, parsed.metric));
        } else if (wantsStatewidePrecincts) {
          const rankings = await politicalDataService.rankPrecinctsStatewide(
            rankablePrecinctMetric,
            parsed.ranking || 'highest',
            parsed.limit || 15
          );
          dataParts.push(formatStatewidePrecinctRankings(rankings, parsed.metric));
        } else {
          const rankings = await politicalDataService.rankJurisdictionsByMetric(
            rankableJurisdictionMetric,
            parsed.ranking || 'highest',
            parsed.limit || 10
          );
          dataParts.push(formatJurisdictionRankings(rankings, parsed.metric));
        }
        break;
      }

      case 'profile': {
        if (parsed.locationNames.length > 0) {
          const profile = await politicalDataService.getJurisdictionAggregate(
            parsed.locationNames[0]
          );
          if (profile) {
            dataParts.push(formatJurisdictionProfile(profile));
          }
        }
        break;
      }

      case 'aggregation':
      case 'general': {
        // Provide general context
        if (parsed.locationNames.length > 0) {
          for (const location of parsed.locationNames.slice(0, 3)) {
            const profile = await politicalDataService.getJurisdictionAggregate(location);
            if (profile) {
              dataParts.push(formatJurisdictionProfile(profile));
            }
          }
        } else {
          // Provide county-level summary
          const summary = await politicalDataService.getCountySummary();
          dataParts.push(formatCountySummary(summary));
        }
        break;
      }
    }

    if (
      dataParts.length === 0 &&
      /\b(college|bachelor|educated|education\s+attainment)\b/i.test(parsed.originalQuery) &&
      /\bprecincts?\b/i.test(parsed.originalQuery)
    ) {
      const rankings = await politicalDataService.rankPrecinctsStatewide(
        'college_pct',
        'highest',
        15
      );
      dataParts.push(formatStatewidePrecinctRankings(rankings, 'college_pct'));
    }

    if (
      userQuery &&
      /\b(income|affluence|median\s+household|household\s+income)\b/i.test(userQuery) &&
      /\b(partisan|political\s+)?lean\b/i.test(userQuery) &&
      mapSelection
    ) {
      // Prefer current map selection over stale IQ last-analysis precinct lists
      if (mapSelection.selectedPrecinctName || mapSelection.selectedPrecinctMapKey) {
        const precinctLabel =
          mapSelection.selectedPrecinctMapKey || mapSelection.selectedPrecinctName || '';
        const jurisdictionHint =
          mapSelection.selectedPrecinctJurisdiction ||
          (await politicalDataService.getJurisdictionLabelForPrecinctKey(precinctLabel));
        if (jurisdictionHint) {
          const r =
            await politicalDataService.getPartisanLeanByIncomeBucketsForJurisdiction(jurisdictionHint);
          if (r) {
            dataParts.push(
              formatIncomeBucketsPartisanLean(r, {
                userFocusedPrecinct:
                  mapSelection.selectedPrecinctName || mapSelection.selectedPrecinctMapKey,
              })
            );
          }
        } else {
          const r = await politicalDataService.getPartisanLeanByIncomeBucketsForPrecinctNames(
            [precinctLabel],
            mapSelection.selectedPrecinctName || mapSelection.selectedPrecinctMapKey || precinctLabel
          );
          if (r) {
            dataParts.push(
              formatIncomeBucketsPartisanLean(r, { singlePrecinctOnly: true })
            );
          }
        }
      } else if (mapSelection.selectedPrecinctJurisdiction) {
        const r = await politicalDataService.getPartisanLeanByIncomeBucketsForJurisdiction(
          mapSelection.selectedPrecinctJurisdiction
        );
        if (r) dataParts.push(formatIncomeBucketsPartisanLean(r));
      } else if (mapSelection.lastAnalysisPrecinctNames && mapSelection.lastAnalysisPrecinctNames.length > 0) {
        const r = await politicalDataService.getPartisanLeanByIncomeBucketsForPrecinctNames(
          mapSelection.lastAnalysisPrecinctNames,
          mapSelection.lastAnalysisAreaName || 'Selected area'
        );
        if (r) dataParts.push(formatIncomeBucketsPartisanLean(r));
      }
    }

    if (userQuery && wantsElectionShiftQuery(userQuery)) {
      const top = await politicalDataService.getTopPrecinctsByMultiYearMarginSwing(15);
      if (top.length > 0) {
        dataParts.push(formatTopPrecinctsByMultiYearMarginSwing(top));
      }
    }

    if (userQuery && wantsTurnoutTrendQuery(userQuery)) {
      const trend = await politicalDataService.getTurnoutTrendExtremes(10);
      if (trend) {
        dataParts.push(formatTurnoutTrendExtremes(trend));
      }
    }

    if (userQuery && wantsCanvassingEfficiencyQuery(userQuery)) {
      const eff = await politicalDataService.getTopPrecinctsByCanvassingEfficiencyProxy(15);
      if (eff.length > 0) {
        dataParts.push(formatCanvassingEfficiencyPrecincts(eff));
      }
    }
  } catch (error) {
    console.error('[Political Chat API] Error fetching data:', error);
    dataParts.push('(Note: Some data could not be loaded)');
  }

  if (mapSelection?.selectedPrecinctName || mapSelection?.selectedPrecinctMapKey) {
    const snap = await formatSelectedPrecinctSnapshot(
      mapSelection.selectedPrecinctName || mapSelection.selectedPrecinctMapKey || '',
      mapSelection.selectedPrecinctJurisdiction,
      mapSelection.selectedPrecinctMapKey
    );
    if (snap) dataParts.push(snap);
  }

  return dataParts.join('\n\n');
}

function formatTopPrecinctsByMultiYearMarginSwing(rows: PrecinctElectionShiftRank[]): string {
  const area = getPoliticalRegionEnv().summaryAreaName;
  const lines = rows.map((r, i) => {
    const net = r.netMarginChange2020to2024;
    const netLabel =
      net > 0.5 ? 'toward Dem' : net < -0.5 ? 'toward Rep' : 'roughly even';
    return `${i + 1}. **${r.precinctName}** — cumulative |Δmargin| **${r.cumulativeAbsMarginSwing.toFixed(1)}** pp (margins 2020/2022/2024: ${r.margin2020}, ${r.margin2022}, ${r.margin2024}; net 2020→2024 ${net > 0 ? '+' : ''}${net.toFixed(1)} pp, ${netLabel})`;
  });
  return `## Precincts with largest partisan margin movement (2020 → 2022 → 2024) — ${area}

**Method:** President race Dem−Rep margin (percentage points). "Dramatic shift" here = **|margin₂₀₂₂−margin₂₀₂₀| + |margin₂₀₂₄−margin₂₀₂₂|**. Net column is margin₂₀₂₄ − margin₂₀₂₀ (positive = overall shift toward Democrats).

${lines.join('\n')}`;
}

function formatTurnoutTrendRow(r: PrecinctTurnoutTrendRank, i: number): string {
  const dir =
    r.netChange2020to2024 > 0.2
      ? 'higher turnout vs 2020'
      : r.netChange2020to2024 < -0.2
        ? 'lower turnout vs 2020'
        : 'roughly flat';
  return `${i + 1}. **${r.precinctName}** — 2020/2022/2024: ${r.turnout2020}% / ${r.turnout2022}% / ${r.turnout2024}% (net ${r.netChange2020to2024 > 0 ? '+' : ''}${r.netChange2020to2024.toFixed(1)} pp, ${dir})`;
}

function formatTurnoutTrendExtremes(t: TurnoutTrendExtremesResult): string {
  const area = getPoliticalRegionEnv().summaryAreaName;
  const { statewideMeanTurnout: m } = t;
  const incLines =
    t.largestIncreases.length > 0
      ? t.largestIncreases.map((r, i) => formatTurnoutTrendRow(r, i)).join('\n')
      : '_(No precincts with net increase 2020→2024 in this sample.)_';
  const decLines =
    t.largestDecreases.length > 0
      ? t.largestDecreases.map((r, i) => formatTurnoutTrendRow(r, i)).join('\n')
      : '_(No precincts with net decrease 2020→2024 in this sample.)_';
  return `## Turnout trends (2020 → 2022 → 2024) — ${area}

**Statewide mean turnout** (precincts with all three years): 2020 **${m.y2020}%**, 2022 **${m.y2022}%**, 2024 **${m.y2024}%**.

**Method:** Turnout from the election-history file (0–100%). "More / less than before" = **2024 minus 2020** (percentage points).

### Precincts with largest **increases** (2024 vs 2020)
${incLines}

### Precincts with largest **decreases** (2024 vs 2020)
${decLines}`;
}

function formatCanvassingEfficiencyPrecincts(rows: PrecinctCanvassingEfficiencyRank[]): string {
  const area = getPoliticalRegionEnv().summaryAreaName;
  const lines = rows.map((r, i) => {
    return `${i + 1}. **${r.precinctName}** — est. **${r.estimatedDoors.toLocaleString()}** doors / **${r.estimatedPersuadableVoters.toLocaleString()}** persuadable → **${r.doorsPerPersuadableVoter.toFixed(3)}** doors per persuadable voter | registered **${r.registeredVoters.toLocaleString()}**, persuasion score **${r.persuasionOpportunity}**/100`;
  });
  return `## Modeled canvassing efficiency (best = lowest doors per persuadable voter) — ${area}

**Data:** Registered voters and **persuasion_opportunity** from targeting scores. **Estimated doors** = registered ÷ 1.5 (same rule as canvassing reports). **Persuadable voters** = registered × (persuasion ÷ 100). This is **not** a household-level voter file — it is a **modeled** yield metric.

${lines.join('\n')}`;
}

/**
 * Format jurisdiction comparison for context
 */
function formatComparison(comparison: any): string {
  const j1 = comparison.jurisdiction1;
  const j2 = comparison.jurisdiction2;
  const diff = comparison.differences;

  return `## Jurisdiction Comparison: ${j1.jurisdictionName} vs ${j2.jurisdictionName}

### ${j1.jurisdictionName}
- Precincts: ${j1.precinctCount}
- Population: ${j1.totalPopulation.toLocaleString()}
- Partisan Lean: ${j1.scores.partisanLean > 0 ? 'D+' : 'R+'}${Math.abs(j1.scores.partisanLean).toFixed(1)}
- Swing Potential: ${j1.scores.swingPotential.toFixed(1)}
- GOTV Priority: ${j1.scores.gotvPriority.toFixed(1)}
- Avg Turnout: ${j1.scores.averageTurnout.toFixed(1)}%
- Dominant Strategy: ${j1.dominantStrategy}

### ${j2.jurisdictionName}
- Precincts: ${j2.precinctCount}
- Population: ${j2.totalPopulation.toLocaleString()}
- Partisan Lean: ${j2.scores.partisanLean > 0 ? 'D+' : 'R+'}${Math.abs(j2.scores.partisanLean).toFixed(1)}
- Swing Potential: ${j2.scores.swingPotential.toFixed(1)}
- GOTV Priority: ${j2.scores.gotvPriority.toFixed(1)}
- Avg Turnout: ${j2.scores.averageTurnout.toFixed(1)}%
- Dominant Strategy: ${j2.dominantStrategy}

### Differences
- Partisan Lean: ${diff.partisanLean > 0 ? '+' : ''}${diff.partisanLean.toFixed(1)} points
- Swing Potential: ${diff.swingPotential > 0 ? '+' : ''}${diff.swingPotential.toFixed(1)}
- Turnout: ${diff.turnout > 0 ? '+' : ''}${diff.turnout.toFixed(1)}%

### Summary
${comparison.summary}`;
}

/**
 * Format precinct rankings for context
 */
function formatPrecinctRankings(jurisdiction: string, rankings: any[], metric?: string): string {
  const metricLabel =
    metric === 'college_pct'
      ? '% with bachelor\'s degree or higher (modeled precinct estimate)'
      : metric?.replace('_', ' ') || 'swing potential';
  const lines = rankings.map(
    (r, i) =>
      `${i + 1}. ${r.precinctName}: ${r.value.toFixed(1)} (${r.competitiveness}, ${r.strategy})`
  );

  return `## Top Precincts in ${jurisdiction} by ${metricLabel}

${lines.join('\n')}`;
}

function formatStatewidePrecinctRankings(rankings: any[], metric?: string): string {
  const metricLabel =
    metric === 'college_pct'
      ? '% with bachelor\'s degree or higher (modeled precinct estimate)'
      : metric?.replace(/_/g, ' ') || 'swing potential';
  const area = getPoliticalRegionEnv().summaryAreaName;
  if (rankings.length === 0) {
    return `## Precinct rankings (${area})

No precinct scores matched this metric. Targeting or political score data may still be loading.`;
  }
  const lines = rankings.map(
    (r, i) =>
      `${i + 1}. ${r.precinctName}: ${r.value.toFixed(1)} (${r.competitiveness}, ${r.strategy})`
  );
  return `## Top Precincts (${area}) by ${metricLabel}

${lines.join('\n')}`;
}

/**
 * Format jurisdiction rankings for context
 */
function formatJurisdictionRankings(rankings: any[], metric?: string): string {
  const metricLabel =
    metric?.replace('_', ' ') || 'swing potential';
  const lines = rankings.map(
    (r, i) =>
      `${i + 1}. ${r.jurisdictionName}: ${r.value.toFixed(1)} (${r.precinctCount} precincts, ${r.dominantStrategy})`
  );

  const area = getPoliticalRegionEnv().summaryAreaName;
  return `## ${area} Jurisdictions Ranked by ${metricLabel}

${lines.join('\n')}`;
}

/**
 * Format jurisdiction profile for context
 */
function formatJurisdictionProfile(profile: any): string {
  const lean = profile.scores.partisanLean;
  const leanStr = lean > 0 ? `D+${lean.toFixed(1)}` : `R+${Math.abs(lean).toFixed(1)}`;

  return `## ${profile.jurisdictionName} Political Profile

### Overview
- Type: ${profile.precinctCount > 10 ? 'Major' : profile.precinctCount > 5 ? 'Medium' : 'Small'} jurisdiction
- Precincts: ${profile.precinctCount}
- Est. Population: ${profile.totalPopulation.toLocaleString()}

### Political Scores
- Partisan Lean: ${leanStr}
- Swing Potential: ${profile.scores.swingPotential.toFixed(1)}/100
- GOTV Priority: ${profile.scores.gotvPriority.toFixed(1)}/100
- Persuasion Opportunity: ${profile.scores.persuasionOpportunity.toFixed(1)}/100
- Average Turnout: ${profile.scores.averageTurnout.toFixed(1)}%

### Strategy Analysis
- Dominant Competitiveness: ${profile.dominantCompetitiveness}
- Recommended Strategy: ${profile.dominantStrategy}

### Party Affiliation (Estimated)
- Democratic: ${profile.demographics.demAffiliation.toFixed(1)}%
- Republican: ${profile.demographics.repAffiliation.toFixed(1)}%
- Independent: ${profile.demographics.indAffiliation.toFixed(1)}%`;
}

/**
 * Format county summary for context
 */
function formatCountySummary(summary: any): string {
  const area = getPoliticalRegionEnv().summaryAreaName;
  return `## ${area} Political Summary

- Total Precincts: ${summary.totalPrecincts}
- Overall Lean: ${summary.overallLean > 0 ? 'D+' : 'R+'}${Math.abs(summary.overallLean).toFixed(1)}
- Overall Turnout: ${summary.overallTurnout.toFixed(1)}%

### Score Ranges
- Partisan Lean: ${summary.scoreRanges.partisan_lean.min.toFixed(1)} to ${summary.scoreRanges.partisan_lean.max.toFixed(1)} (mean: ${summary.scoreRanges.partisan_lean.mean.toFixed(1)})
- Swing Potential: ${summary.scoreRanges.swing_potential.min.toFixed(1)} to ${summary.scoreRanges.swing_potential.max.toFixed(1)} (mean: ${summary.scoreRanges.swing_potential.mean.toFixed(1)})
- Turnout: ${summary.scoreRanges.turnout_avg.min.toFixed(1)}% to ${summary.scoreRanges.turnout_avg.max.toFixed(1)}% (mean: ${summary.scoreRanges.turnout_avg.mean.toFixed(1)}%)

### Jurisdictions
Use map and filter tools to explore municipalities and counties across Pennsylvania in this dataset.`;
}

function formatIncomeBucketsPartisanLean(
  data: IncomeBucketsPartisanLean,
  opts?: { userFocusedPrecinct?: string; singlePrecinctOnly?: boolean }
): string {
  const lines = data.buckets.map(
    (b) =>
      `- ${b.incomeBand}: ${b.leanDisplay} average partisan lean (${b.precinctCount} precincts; population-weight ≈ ${b.populationWeight.toLocaleString()})`
  );
  const methodNote =
    '**Method:** Each precinct has one modeled median household income. Income *bands* group **precincts** by that value (richer vs. poorer **precincts**), not individual households within a precinct.';
  let focusNote = '';
  if (opts?.userFocusedPrecinct) {
    focusNote = `The user selected precinct **${opts.userFocusedPrecinct}**; the table below covers **${data.areaLabel}** (all precincts in that jurisdiction), which is the correct scope for comparing partisan lean across income levels.`;
  }
  if (opts?.singlePrecinctOnly) {
    focusNote =
      'Only one precinct is in scope, so it appears in a single income band. Use an area analysis with multiple precincts or ask about a municipality for a multi-band comparison.';
  }
  return `## Partisan lean by modeled income band — ${data.areaLabel}

${methodNote}
${focusNote ? `\n${focusNote}\n` : ''}
Precincts with modeled partisan lean in this sample: ${data.totalPrecinctsInSample}

${lines.join('\n')}

Lean uses the same convention as jurisdiction profiles (positive = Democratic lean, D+).`;
}

/**
 * Get knowledge graph context for the query
 */
async function getKnowledgeGraphContext(
  query: string,
  parsed: ParsedPoliticalQuery
): Promise<{ context: string; entityIds: string[] }> {
  // Ensure graph is populated
  const graph = getKnowledgeGraph();
  const stats = graph.getStats();

  if (stats.entityCount === 0) {
    const populator = getGraphPopulator();
    await populator.populate({ includePrecincts: true });
  }

  const queryLower = query.toLowerCase();
  const entityIds: string[] = [];
  const contextParts: string[] = [];

  // Check for candidate-related queries
  if (
    queryLower.includes('candidate') ||
    queryLower.includes('running') ||
    queryLower.includes('2026') ||
    queryLower.includes('senate') ||
    queryLower.includes('governor')
  ) {
    // Get candidates for 2026 races
    const senateCandidates = graph.getCandidatesForOffice('office:mi-us-senate-class-1');
    if (senateCandidates.length > 0) {
      contextParts.push('## 2026 U.S. Senate Race Candidates');
      senateCandidates.forEach(c => {
        entityIds.push(c.id);
        const party = c.metadata.party === 'DEM' ? 'Democratic' : 'Republican';
        const status = c.metadata.status === 'declared' ? 'Declared' : c.metadata.status;
        contextParts.push(`- **${c.name}** (${party}) - ${status}`);
      });
    }

    // Check for specific candidate names
    const candidateNames = [
      'haley stevens', 'mallory mcmorrow', 'mike rogers', 'abdul el-sayed',
      'garlin gilchrist', 'dana nessel', 'jocelyn benson'
    ];
    for (const name of candidateNames) {
      if (queryLower.includes(name.split(' ')[0].toLowerCase()) ||
          queryLower.includes(name.split(' ').pop()?.toLowerCase() || '')) {
        const result = graph.query({ namePattern: name, entityTypes: ['candidate'], limit: 1 });
        if (result.entities.length > 0) {
          const candidate = result.entities[0] as Entity & { metadata: { party: string; status: string } };
          entityIds.push(candidate.id);

          // Get connections
          const connections = graph.getConnections(candidate.id);
          const offices = connections.filter(c => c.relationship.type === 'RUNNING_FOR');
          const party = connections.find(c => c.relationship.type === 'MEMBER_OF');

          contextParts.push(`\n## ${candidate.name}`);
          if (party) contextParts.push(`- Party: ${party.entity.name}`);
          if (offices.length > 0) {
            contextParts.push(`- Running for: ${offices.map(o => o.entity.name).join(', ')}`);
          }
          contextParts.push(`- Status: ${candidate.metadata?.status || 'Unknown'}`);
        }
      }
    }
  }

  // Check for jurisdiction-related queries
  if (parsed.locationNames.length > 0) {
    for (const location of parsed.locationNames.slice(0, 2)) {
      const jurisdictionId = `jurisdiction:${location.toLowerCase().replace(/\s+/g, '-')}`;
      const jurisdiction = graph.getEntity(jurisdictionId);

      if (jurisdiction && jurisdiction.type === 'jurisdiction') {
        entityIds.push(jurisdiction.id);
        const meta = (jurisdiction as any).metadata || {};

        // Get precincts in jurisdiction
        const precinctConnections = graph.query({
          relationshipTypes: ['PART_OF'],
          entityTypes: ['precinct'],
          filters: [{ field: 'metadata.jurisdiction', operator: 'eq', value: jurisdictionId }],
          limit: 5,
        });

        contextParts.push(`\n## ${jurisdiction.name} (Knowledge Graph)`);
        if (meta.partisanLean !== undefined) {
          const leanStr = meta.partisanLean > 0 ? `D+${meta.partisanLean}` : `R+${Math.abs(meta.partisanLean)}`;
          contextParts.push(`- Partisan Lean: ${leanStr}`);
        }
        if (meta.density) contextParts.push(`- Density: ${meta.density}`);
        if (precinctConnections.entities.length > 0) {
          contextParts.push(`- Sample precincts: ${precinctConnections.entities.slice(0, 3).map(e => e.name).join(', ')}`);
        }
      }
    }
  }

  // Check for election-related queries
  if (queryLower.includes('election') || queryLower.includes('primary') || queryLower.includes('november')) {
    const elections = graph.query({ entityTypes: ['election'], limit: 5 });
    if (elections.entities.length > 0) {
      contextParts.push('\n## Upcoming Elections');
      elections.entities.forEach(e => {
        entityIds.push(e.id);
        const meta = (e as any).metadata || {};
        contextParts.push(`- **${e.name}**: ${meta.date || 'Date TBD'} (${meta.electionType || 'general'})`);
      });
    }
  }

  return {
    context: contextParts.length > 0 ? contextParts.join('\n') : '',
    entityIds,
  };
}

/**
 * Parse ACTION directives from Claude response and convert to MapCommand objects
 */
function parseActionDirectivesToMapCommands(
  content: string,
  parsed: ParsedPoliticalQuery
): MapCommand[] {
  const mapCommands: MapCommand[] = [];

  const directives = extractActionDirectives(content);
  for (const { actionType, data: actionData } of directives) {
    // Convert ACTION directives to MapCommand format
    switch (actionType) {
      case 'showOnMap':
        if (actionData.precinctIds && Array.isArray(actionData.precinctIds)) {
          mapCommands.push({
            type: 'highlight',
            target: actionData.precinctIds as string[]
          });
        }
        break;

      case 'highlightEntity':
        if (actionData.entityId) {
          mapCommands.push({
            type: 'highlight',
            target: actionData.entityId as string
          });
        }
        break;

      case 'setComparison':
        if (actionData.left && actionData.right) {
          mapCommands.push({
            type: 'highlightComparison',
            leftEntityId: actionData.left as string,
            rightEntityId: actionData.right as string
          });
        }
        break;
    }
  }

  // If no ACTION directives found, infer map commands from query type and parsed data
  if (mapCommands.length === 0) {
    const queryLower = content.toLowerCase();

    // P2 Enhancement: Expanded visualization keyword detection
    const visualizationKeywords = ['show', 'display', 'visualize', 'map', 'highlight', 'where are', 'find', 'which precincts', 'which areas', 'target', 'identify'];
    const hasVisualizationIntent = visualizationKeywords.some(kw => queryLower.includes(kw));

    if (hasVisualizationIntent) {
      // P2 Enhancement: Check for combined metric queries (e.g., "high GOTV and persuasion")
      const hasSwing = queryLower.includes('swing') || parsed.metric === 'swing_potential' || queryLower.includes('competitive') || queryLower.includes('battleground');
      const hasGotv = queryLower.includes('gotv') || queryLower.includes('turnout') || queryLower.includes('mobiliz') || parsed.metric === 'gotv_priority';
      const hasPersuasion = queryLower.includes('persuasion') || queryLower.includes('persuadable') || parsed.metric === 'persuasion_opportunity';
      const hasPartisan = queryLower.includes('partisan') || queryLower.includes('lean') || queryLower.includes('democrat') || queryLower.includes('republican') || parsed.metric === 'partisan_lean';
      const hasCombined = queryLower.includes('combined') || queryLower.includes('overall') || queryLower.includes('targeting score');

      // Priority order: combined > specific metrics
      if (hasCombined) {
        mapCommands.push({ type: 'showHeatmap', metric: 'combined_score' });
      } else if (hasSwing && hasGotv) {
        // Both swing and GOTV mentioned - use bivariate
        mapCommands.push({ type: 'showBivariate', xMetric: 'swing_potential', yMetric: 'gotv_priority' });
      } else if (hasSwing && hasPersuasion) {
        mapCommands.push({ type: 'showBivariate', xMetric: 'swing_potential', yMetric: 'persuasion_opportunity' });
      } else if (hasGotv && hasPersuasion) {
        mapCommands.push({ type: 'showBivariate', xMetric: 'gotv_priority', yMetric: 'persuasion_opportunity' });
      } else if (hasSwing) {
        mapCommands.push({ type: 'showHeatmap', metric: 'swing_potential' });
      } else if (hasGotv) {
        mapCommands.push({ type: 'showHeatmap', metric: 'gotv_priority' });
      } else if (hasPersuasion) {
        mapCommands.push({ type: 'showHeatmap', metric: 'persuasion_opportunity' });
      } else if (hasPartisan) {
        mapCommands.push({ type: 'showChoropleth' });
      }
    }

    // P2 Enhancement: Navigation commands detection
    const navigationPatterns = [
      { pattern: /zoom\s+(?:to|in\s+on)\s+(.+?)(?:\.|$)/i, action: 'flyTo' },
      { pattern: /focus\s+on\s+(.+?)(?:\.|$)/i, action: 'flyTo' },
      { pattern: /center\s+(?:on|at)\s+(.+?)(?:\.|$)/i, action: 'flyTo' },
      { pattern: /fly\s+to\s+(.+?)(?:\.|$)/i, action: 'flyTo' },
    ];

    for (const { pattern, action } of navigationPatterns) {
      const match = content.match(pattern);
      if (match) {
        mapCommands.push({ type: action as 'flyTo', target: match[1].trim() });
        break;
      }
    }

    // Ranking queries should highlight top results
    if (parsed.type === 'ranking' && parsed.locationNames.length > 0) {
      mapCommands.push({ type: 'highlight', target: parsed.locationNames });
    }

    // Comparison queries should highlight both entities
    if (parsed.type === 'comparison' && parsed.locationNames.length >= 2) {
      mapCommands.push({
        type: 'highlightComparison',
        leftEntityId: parsed.locationNames[0],
        rightEntityId: parsed.locationNames[1]
      });
    }

    // P2 Enhancement: Also detect comparison language in general queries
    if (mapCommands.length === 0 && parsed.locationNames.length >= 2) {
      const comparisonPatterns = /\b(versus|vs\.?|compared to|difference between|how does.*compare)\b/i;
      if (comparisonPatterns.test(content)) {
        mapCommands.push({
          type: 'highlightComparison',
          leftEntityId: parsed.locationNames[0],
          rightEntityId: parsed.locationNames[1]
        });
      }
    }

    // Profile queries should highlight the location
    if (parsed.type === 'profile' && parsed.locationNames.length > 0) {
      mapCommands.push({ type: 'highlight', target: parsed.locationNames[0] });
    }

    // P2 Enhancement: Highlight any mentioned locations if no other command generated
    if (mapCommands.length === 0 && parsed.locationNames.length > 0) {
      mapCommands.push({ type: 'highlight', target: parsed.locationNames });
    }
  }

  return mapCommands;
}

/**
 * Build system prompt with political domain knowledge
 * Phase 3: Added sessionContext parameter for cross-session awareness
 * Phase 12: Added expertiseLevel parameter for expertise-aware responses
 */
function buildPoliticalSystemPrompt(
  contextData: string,
  ragContext: string = '',
  graphContext: string = '',
  sessionContext: string = '',
  expertiseLevel: 'novice' | 'intermediate' | 'power_user' = 'intermediate'
): string {
  const study = getPoliticalRegionEnv().summaryAreaName;
  const basePrompt = `You are a political analyst assistant for ${study} using Pennsylvania precinct-level data in this deployment. You help campaign strategists, political consultants, and canvassing coordinators understand the political landscape.

## Your Expertise
- Precinct-level political analysis
- Voter targeting strategies (GOTV, Persuasion)
- Demographic analysis for campaigns
- Electoral trends and swing potential
- Canvassing optimization

## Key Metrics You Understand
- **Partisan Lean**: signed scale **−100 (Solid R) to +100 (Solid D)** — **negative = Republican lean**, **positive = Democratic lean**. **Always** state lean as **R+X** or **D+X** (same as the analysis panel). **Never** show raw signed numbers like "Partisan Lean: −23.8" as the headline metric — that duplicates **R+23.8** and confuses users.
- **Swing Potential**: 0-100 score. Higher = more volatile/persuadable.
- **GOTV Priority**: 0-100 score. Higher = more value from turnout mobilization.
- **Persuasion Opportunity**: 0-100 score. Higher = more persuadable voters.
- **Turnout**: Historical average voter turnout percentage.
- **Precinct demographics (modeled)**: Each precinct includes **collegePct** — estimated % of adults 25+ with a bachelor\'s degree or higher (sourced from block-group / demographic allocation where available). **Do not** tell the user this data is unavailable when the Current Data Context lists college or education percentages; use those numbers and cite [DEMOGRAPHICS].

## Targeting Strategies
- **Battleground** (campaign strategy label): Often used for areas needing both mobilization and persuasion — **do not** conflate this with the **competitiveness bucket** filter "toss_up / toss-up" (modeled lean band), which is a separate dimension from swing-score cutoffs.
- **Base Mobilization**: Strong partisan areas needing turnout focus
- **Persuasion Target**: Areas with many persuadable voters
- **Maintenance**: Safe areas requiring minimal resources

## Pennsylvania Context
- Statewide precinct coverage with legislative and congressional districts from the app crosswalk (pa-house-*, pa-senate-*, pa-congress-NN)
- Major population centers include Philadelphia, Pittsburgh, Allentown, Erie, Reading, Scranton, Harrisburg, and others in loaded boundary data
- Urban, suburban, and rural variation is substantial; cite data for the specific geography the user asks about

## Response Guidelines
1. Be concise and actionable
2. Use data to support recommendations
3. Explain political implications clearly
4. Suggest next steps when appropriate
5. Be politically neutral - present facts, not opinions
6. When citing data, use source tags like [ELECTIONS], [DEMOGRAPHICS], [TARGETING]
7. When referencing current political news/events, use [NEWS], [POLL], [ANALYSIS], [OFFICIAL], or [UPCOMING]
8. If explaining methodology, reference the approach without exposing implementation details
9. NEVER start responses with greetings like "Welcome!", "Hello!", "Hi!", or "Great question!" - jump directly into the analysis
10. Format percentages correctly: use "52.3%" not "5230%" - never multiply by 100 twice
11. **Markdown structure:** Put each \`##\` or \`###\` heading on its own line with a blank line above it. Separate sections (intro, metrics, lists) with blank lines so the UI can render headings and lists correctly—never glue a heading onto the end of a sentence on the same line. **Do not** use Markdown **pipe tables** (\`|\` columns/rows)—they overflow the chat panel. Present comparable data as **numbered lists** or **bullet points** (one entity or metric group per line; bold labels are fine).
12. **"This area" and session scope**: If **Current Session Context** mentions selected precincts, IQ area analysis, recent selections, or highlighted areas, treat **"this area"** as that scope. Do **not** ask the user to select a region when the session already specifies geography.
13. **Non-empty data**: If **Current Data Context** shows a positive **Total Precincts** count or includes **Partisan lean by modeled income band**, do **not** claim zero precincts are loaded or that the dataset failed to initialize.
14. **Income bands vs. one precinct**: Modeled income–partisan analysis groups **precincts** by each precinct’s **one** median household income. It does **not** produce multiple income strata *inside* a single precinct. When the user selects one precinct, the context may show **that precinct’s jurisdiction** so bands compare richer vs. poorer **precincts** in the same area. **Never** say the platform lacks income-stratified lean data when **Partisan lean by modeled income band** is present in Current Data Context.
15. **Multi-year election shift**: If **Current Data Context** includes **Precincts with largest partisan margin movement (2020 → 2022 → 2024)**, you have precinct-level presidential margins and movement — **do not** claim this data is unavailable. Use those rows and cite [ELECTIONS].
16. **Turnout trends**: If **Current Data Context** includes **Turnout trends (2020 → 2022 → 2024)**, you have precinct-level turnout percentages and statewide means — **do not** claim historical turnout is missing or that mean turnout is 0% unless the table explicitly shows zeros. Use the increases/decreases lists and cite [ELECTIONS].
17. **Canvassing efficiency (modeled)**: If **Current Data Context** includes **Modeled canvassing efficiency**, you have precinct-level registered voters, persuasion opportunity, estimated doors, and a doors-per-persuadable-voter proxy from targeting scores — **do not** say voter file or address-level data is missing for this ranking. Walk through that ranked list (numbered or bullets, not a pipe table), cite [TARGETING], and explain that doors and persuadables are modeled estimates, not raw household counts.
18. **Selected precinct snapshot**: If **Current Data Context** includes **## Selected precinct — authoritative metrics**, that block is the source of truth for **modeled partisan lean**, swing/GOTV/persuasion scores, and any **2024 presidential (reported)** line. **Do not** say partisan lean or 2024 results are "not loaded", "not displayed", or missing when that section is present. If session text elsewhere omits lean but this block includes it, prefer this block.
19. **Partisan lean wording**: Session context may list partisan_lean as R+23.8 — that is the same quantity as a **−23.8** internal score (R+). Do not contradict; use **R+** / **D+** in prose.
20. **Turnout**: If **Current Data Context** includes **Historical avg turnout** for the selected precinct, you have modeled/reported turnout — **do not** say turnout is "not yet loaded" or unavailable for that precinct.
21. **Authoritative filter / export**: If **Current Data Context** includes **Authoritative filter / export**, use that **exact precinct count** when stating how many precincts match the filter — the downloadable CSV uses that same precinct list. Do not invent or substitute a different count.
22. **Competitiveness / toss-up / battleground language**: If the user asked for **toss-up**, **toss-up precincts**, **competitive areas**, or **battleground** in the sense of **close races**, and **Current Data Context** or **Filter Results** describes a **competitiveness** filter (e.g. modeled bucket \`toss_up\`) or listed precincts from that filter, describe **only what the app actually applied** (bucket + precinct count and any averages shown). **Do not** replace that with invented rules such as "swing potential 40–100", "partisan lean ±15", or bivariate GOTV+persuasion unless those **exact** thresholds or filter rows appear in **Current Data Context**. Toss-up bucket ≠ swing-score range — do not merge them in prose.
23. **Election timing**: Do **not** invent **"pre-primary mode"**, **day countdowns to an election**, or **calendar claims** unless that text appears explicitly in **Current Intelligence** / enrichment with a cited date. Prefer describing loaded data over speculative campaign timing.

## Current Intelligence Guidelines
When current intel is provided in the context:
- Integrate relevant recent news, polls, and analysis naturally into your responses
- Always cite the source type when referencing current events (e.g., "Recent polling shows... [POLL]")
- For upcoming elections, mention key candidates and dates when relevant [UPCOMING]
- Make connections between historical data and current political dynamics
- Note when information has a publication date to maintain temporal context

## UI ACTION DIRECTIVES

When your response should trigger a UI action (like applying filters, setting comparisons, or navigation), include an action directive at the END of your response in this exact format:

\`[ACTION:actionType:{"key":"value"}]\`

Available action types:

1. **setComparison** - Set comparison pane entities (Split Screen page)
   Example: User asks "compare Philadelphia to Pittsburgh"
   \`[ACTION:setComparison:{"left":"philadelphia","right":"pittsburgh"}]\`

2. **applyFilter** - Apply segment/donor filters
   \`[ACTION:applyFilter:{"filters":{"targeting":{"gotvPriorityRange":[70,100]}}}]\`

3. **navigateTo** - Navigate to a tab or page
   \`[ACTION:navigateTo:{"tab":"lapsed"}]\`

4. **showOnMap** - Highlight areas on the map
   \`[ACTION:showOnMap:{"precinctIds":["037-:-BEAVER","101-:-PHILADELPHIA-01"]}]\`

5. **highlightEntity** - Highlight a specific entity
   \`[ACTION:highlightEntity:{"entityId":"philadelphia"}]\`

IMPORTANT:
- Only include ONE action directive per response
- Place it at the very END of your response (after all text)
- Use exact JSON format with no extra spaces inside braces
- Only use action directives when the user clearly wants a UI change (comparison, filter, etc.)
- For general information questions, do NOT include action directives`;

  let fullPrompt = basePrompt;

  // Add RAG documentation context
  if (ragContext) {
    fullPrompt += `\n\n${ragContext}`;
  }

  // Add knowledge graph context
  if (graphContext) {
    fullPrompt += `

## Knowledge Graph Context
The following entities and relationships are relevant to the query:

${graphContext}

Use this information about candidates, offices, and jurisdictions when relevant.`;
  }

  // Add data context
  if (contextData) {
    fullPrompt += `

## Current Data Context
${contextData}

Use this data to inform your response. Reference specific numbers when helpful.`;
  }

  // Add session context (Phase 3 - Claude Integration)
  if (sessionContext) {
    fullPrompt += `

## Current Session Context
The user has been exploring the platform this session. Here's what they've done:

${sessionContext}

Use this context to:
- Reference precincts they've already explored
- Suggest comparisons with areas they've looked at
- Offer relevant next steps based on their exploration depth
- Acknowledge their journey and provide continuity

**Campaign context (if present above):** Session text may include **Campaign phase**, **Days until election**, and **Strategy** (e.g. hybrid = default GOTV+persuasion balance in settings). **Do not** lead every reply by repeating phase, day count, or strategy name unless the user asked about timing, calendar, or resource allocation tradeoffs. Answer the question directly; weave campaign timing in only when it changes the recommendation.`;
  }

  // Add user expertise context (Phase 12 - Expertise-Aware Responses)
  const expertiseGuidance = {
    novice: {
      level: 'novice',
      guidance: 'Explain terminology, provide context, suggest next steps. Avoid jargon. Use analogies and examples. Break down complex concepts into simple explanations.'
    },
    intermediate: {
      level: 'intermediate',
      guidance: 'Balance detail with efficiency. Assume familiarity with basic political concepts. Use standard terminology. Provide explanations for advanced concepts.'
    },
    power_user: {
      level: 'power_user',
      guidance: 'Be concise, use data shorthand, skip basic explanations. Assume deep expertise in political analysis. Use technical terminology freely. Focus on insights and actionable recommendations.'
    }
  };

  const expertise = expertiseGuidance[expertiseLevel];
  fullPrompt += `

## User Expertise Level
Level: ${expertise.level}
Guidance: ${expertise.guidance}

Tailor your response to match this expertise level:
- Novice: Explain concepts, define terms, provide step-by-step guidance
- Intermediate: Balance detail with conciseness, use standard terminology
- Power User: Be terse, use shorthand, focus on insights over explanations`;

  return fullPrompt;
}
