/**
 * Poll To RAG Bridge
 *
 * Generates RAG-friendly documents from polling data for AI context.
 * Creates markdown documents that can be indexed and retrieved for
 * natural language responses about polling.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { Poll, PollAggregate, TrendDirection } from './types';
import { CurrentIntelDocument } from '../rag/DocumentRetriever';

export class PollToRAGBridge {
  private readonly outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || path.join(process.cwd(), 'data', 'rag', 'current-intel', 'polls');
  }

  /**
   * Generate a RAG document from a poll aggregate
   */
  generateAggregateDocument(aggregate: PollAggregate): CurrentIntelDocument {
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 7); // Aggregates valid for 7 days

    return {
      id: `poll-agg-${aggregate.race_id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      path: `data/rag/current-intel/polls/${aggregate.race_id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-aggregate.md`,
      type: 'poll',
      title: `${aggregate.race_name} Polling Average`,
      source: 'Poll Aggregation System',
      published: aggregate.last_updated,
      expires: expiresDate.toISOString(),
      relevance: ['polling', 'elections', aggregate.race_id.split('-')[1]?.toLowerCase() || 'race'],
      jurisdictions: [aggregate.geography],
      keywords: this.extractKeywords(aggregate),
      priority: 1,
    };
  }

  /**
   * Generate markdown content for a poll aggregate
   */
  generateAggregateContent(aggregate: PollAggregate): string {
    const trendText = this.getTrendText(aggregate);
    const competitivenessText = this.getCompetitivenessText(aggregate.margin);

    let content = `---
type: poll-aggregate
race_id: ${aggregate.race_id}
race_name: ${aggregate.race_name}
geography: ${aggregate.geography}
last_updated: ${aggregate.last_updated}
poll_count: ${aggregate.poll_count}
---

# ${aggregate.race_name} Polling Average

**Current Leader:** ${aggregate.leader} (+${aggregate.margin.toFixed(1)})

**Competitiveness:** ${competitivenessText}

## Candidate Standings

| Candidate | Party | Average | Range | Polls |
|-----------|-------|---------|-------|-------|
`;

    for (const candidate of aggregate.candidates) {
      const partyLabel = this.getPartyLabel(candidate.party);
      content += `| ${candidate.name} | ${partyLabel} | ${candidate.average.toFixed(1)}% | ${candidate.low.toFixed(1)}-${candidate.high.toFixed(1)}% | ${candidate.poll_count} |\n`;
    }

    content += `
## Polling Trend

${trendText}

- **7-Day Margin:** ${aggregate.margin_7d_ago !== undefined ? `${aggregate.margin_7d_ago > 0 ? '+' : ''}${aggregate.margin_7d_ago.toFixed(1)}` : 'N/A'}
- **30-Day Margin:** ${aggregate.margin_30d_ago !== undefined ? `${aggregate.margin_30d_ago > 0 ? '+' : ''}${aggregate.margin_30d_ago.toFixed(1)}` : 'N/A'}
- **Trend Magnitude:** ${aggregate.trend_magnitude !== undefined ? aggregate.trend_magnitude.toFixed(1) + ' points' : 'Stable'}

## Methodology

- **Polls Included:** ${aggregate.poll_count}
- **Polls Last 30 Days:** ${aggregate.polls_last_30d}
- **Average Sample Size:** ${aggregate.avg_sample_size.toLocaleString()}
- **Weighted N:** ${aggregate.weighted_n.toLocaleString()}

*Polling average uses FiveThirtyEight-style weighting based on recency, sample size, pollster rating, methodology, and population type.*
`;

    return content;
  }

  /**
   * Generate a RAG document from a single poll
   */
  generatePollDocument(poll: Poll): CurrentIntelDocument {
    const expiresDate = new Date(poll.end_date);
    expiresDate.setDate(expiresDate.getDate() + 30); // Individual polls valid for 30 days

    return {
      id: `poll-${poll.poll_id.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}`,
      path: `data/rag/current-intel/polls/${poll.poll_id.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}.md`,
      type: 'poll',
      title: `${poll.pollster}: ${poll.race_id} (${poll.end_date})`,
      source: poll.pollster,
      published: poll.end_date,
      expires: expiresDate.toISOString(),
      relevance: ['polling', poll.race_type],
      jurisdictions: [poll.geography],
      keywords: [
        poll.pollster.toLowerCase(),
        poll.race_type,
        poll.geography.toLowerCase(),
        ...poll.results.map((r) => r.candidate_name.toLowerCase()),
      ],
      priority: 2,
    };
  }

  /**
   * Generate markdown content for a single poll
   */
  generatePollContent(poll: Poll): string {
    const leader = poll.results[0];
    const margin = poll.results.length > 1
      ? (poll.results[0].percentage - poll.results[1].percentage).toFixed(1)
      : 'N/A';

    let content = `---
type: poll
poll_id: ${poll.poll_id}
source: ${poll.source}
pollster: ${poll.pollster}
race_id: ${poll.race_id}
geography: ${poll.geography}
end_date: ${poll.end_date}
sample_size: ${poll.sample_size}
methodology: ${poll.methodology}
population: ${poll.population}
---

# ${poll.pollster}: ${poll.geography} ${this.formatRaceType(poll.race_type)}

**Field Dates:** ${poll.start_date} to ${poll.end_date}
**Sample:** ${poll.sample_size.toLocaleString()} ${this.formatPopulation(poll.population)}
**Methodology:** ${this.formatMethodology(poll.methodology)}
${poll.pollster_rating ? `**Pollster Rating:** ${poll.pollster_rating}` : ''}

## Results

`;

    for (const result of poll.results) {
      const partyLabel = this.getPartyLabel(result.party);
      const incumbentBadge = result.is_incumbent ? ' (I)' : '';
      content += `- **${result.candidate_name}${incumbentBadge}** (${partyLabel}): ${result.percentage.toFixed(1)}%\n`;
    }

    content += `
**Margin:** ${leader.candidate_name} +${margin}

*Source: ${poll.source_url || poll.source}*
`;

    return content;
  }

  /**
   * Save aggregate documents to disk
   */
  async saveAggregates(aggregates: Map<string, PollAggregate>): Promise<number> {
    // Ensure directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    let saved = 0;
    for (const [raceId, aggregate] of aggregates) {
      try {
        const content = this.generateAggregateContent(aggregate);
        const filename = `${raceId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-aggregate.md`;
        const filepath = path.join(this.outputDir, filename);
        await fs.writeFile(filepath, content, 'utf-8');
        saved++;
      } catch (error) {
        console.warn(`[PollToRAGBridge] Failed to save aggregate ${raceId}:`, error);
      }
    }

    console.log(`[PollToRAGBridge] Saved ${saved} aggregate documents`);
    return saved;
  }

  /**
   * Save recent polls to disk (for individual poll context)
   */
  async saveRecentPolls(polls: Poll[], maxPolls: number = 20): Promise<number> {
    await fs.mkdir(this.outputDir, { recursive: true });

    // Sort by date and take most recent
    const sorted = [...polls]
      .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())
      .slice(0, maxPolls);

    let saved = 0;
    for (const poll of sorted) {
      try {
        const content = this.generatePollContent(poll);
        const filename = `${poll.poll_id.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}.md`;
        const filepath = path.join(this.outputDir, filename);
        await fs.writeFile(filepath, content, 'utf-8');
        saved++;
      } catch (error) {
        console.warn(`[PollToRAGBridge] Failed to save poll ${poll.poll_id}:`, error);
      }
    }

    console.log(`[PollToRAGBridge] Saved ${saved} poll documents`);
    return saved;
  }

  /**
   * Update the intel-index.json with new poll documents
   */
  async updateIntelIndex(aggregates: Map<string, PollAggregate>): Promise<void> {
    const intelIndexPath = path.join(process.cwd(), 'data', 'rag', 'current-intel', 'intel-index.json');

    try {
      // Load existing index
      let intelIndex: {
        _metadata: Record<string, string>;
        sources: Array<Record<string, string>>;
        documents: CurrentIntelDocument[];
        citation_keys: Record<string, { description: string; color_scheme: string }>;
      };

      try {
        const existing = await fs.readFile(intelIndexPath, 'utf-8');
        intelIndex = JSON.parse(existing);
      } catch {
        // Create new index if doesn't exist
        intelIndex = {
          _metadata: {
            description: 'Current political intelligence index',
            version: '1.0',
            last_updated: new Date().toISOString(),
            update_frequency: 'daily',
            notes: 'Auto-generated poll aggregates',
          },
          sources: [],
          documents: [],
          citation_keys: {
            '[POLL]': { description: 'Recent polling data', color_scheme: 'purple' },
          },
        };
      }

      // Remove old poll documents
      intelIndex.documents = intelIndex.documents.filter((d) => d.type !== 'poll');

      // Add new poll aggregate documents
      for (const [_, aggregate] of aggregates) {
        const doc = this.generateAggregateDocument(aggregate);
        intelIndex.documents.push(doc);
      }

      // Update metadata
      intelIndex._metadata.last_updated = new Date().toISOString();

      // Save index
      await fs.writeFile(intelIndexPath, JSON.stringify(intelIndex, null, 2), 'utf-8');
      console.log(`[PollToRAGBridge] Updated intel index with ${aggregates.size} poll aggregates`);
    } catch (error) {
      console.error('[PollToRAGBridge] Failed to update intel index:', error);
    }
  }

  /**
   * Generate summary document for AI context
   */
  generateSummaryContext(aggregates: Map<string, PollAggregate>): string {
    if (aggregates.size === 0) {
      return 'No current polling data available.';
    }

    let summary = '## Current Polling Summary\n\n';

    // Group by geography
    const byGeo = new Map<string, PollAggregate[]>();
    for (const [_, agg] of aggregates) {
      const geo = agg.geography;
      if (!byGeo.has(geo)) {
        byGeo.set(geo, []);
      }
      byGeo.get(geo)!.push(agg);
    }

    for (const [geo, aggs] of byGeo) {
      summary += `### ${geo}\n\n`;

      for (const agg of aggs.sort((a, b) => a.race_name.localeCompare(b.race_name))) {
        const competitiveness = this.getCompetitivenessText(agg.margin);
        summary += `- **${agg.race_name}:** ${agg.leader} +${agg.margin.toFixed(1)} (${competitiveness})\n`;
      }

      summary += '\n';
    }

    return summary;
  }

  // Helper methods

  private extractKeywords(aggregate: PollAggregate): string[] {
    const keywords: string[] = [
      'polling',
      'poll',
      'average',
      aggregate.geography.toLowerCase(),
    ];

    // Add race type
    const raceType = aggregate.race_id.split('-')[1]?.toLowerCase();
    if (raceType) {
      keywords.push(raceType);
      if (raceType === 'gov') keywords.push('governor');
      if (raceType === 'sen') keywords.push('senate', 'senator');
      if (raceType === 'pres') keywords.push('president', 'presidential');
    }

    // Add candidate names
    for (const candidate of aggregate.candidates) {
      keywords.push(candidate.name.toLowerCase());
      // Add last name
      const parts = candidate.name.split(' ');
      if (parts.length > 1) {
        keywords.push(parts[parts.length - 1].toLowerCase());
      }
    }

    return [...new Set(keywords)];
  }

  private getTrendText(aggregate: PollAggregate): string {
    const direction = aggregate.trend_direction;
    const magnitude = aggregate.trend_magnitude;

    if (!direction || direction === 'stable') {
      return 'The race has been **stable** with no significant movement in recent weeks.';
    }

    const movementText = magnitude !== undefined
      ? ` by approximately ${magnitude.toFixed(1)} points`
      : '';

    if (direction === 'dem_gaining') {
      return `Democrats are **gaining ground**${movementText} in recent polls.`;
    }

    if (direction === 'rep_gaining') {
      return `Republicans are **gaining ground**${movementText} in recent polls.`;
    }

    return 'Trend direction is unclear.';
  }

  private getCompetitivenessText(margin: number): string {
    const absMargin = Math.abs(margin);

    if (absMargin < 3) return 'Toss-up';
    if (absMargin < 5) return 'Lean';
    if (absMargin < 10) return 'Likely';
    return 'Safe';
  }

  private getPartyLabel(party: string): string {
    const labels: Record<string, string> = {
      DEM: 'D',
      REP: 'R',
      IND: 'I',
      LIB: 'L',
      GRN: 'G',
      other: 'O',
    };
    return labels[party] || party;
  }

  private formatRaceType(raceType: string): string {
    const labels: Record<string, string> = {
      president: 'Presidential',
      senate: 'Senate',
      governor: 'Governor',
      house: 'House',
      state_senate: 'State Senate',
      state_house: 'State House',
      approval: 'Approval',
    };
    return labels[raceType] || raceType;
  }

  private formatMethodology(methodology: string): string {
    const labels: Record<string, string> = {
      live_phone: 'Live Phone',
      online: 'Online Panel',
      ivr: 'Automated (IVR)',
      mixed: 'Mixed Mode',
      unknown: 'Unknown',
    };
    return labels[methodology] || methodology;
  }

  private formatPopulation(population: string): string {
    const labels: Record<string, string> = {
      lv: 'Likely Voters',
      rv: 'Registered Voters',
      a: 'Adults',
    };
    return labels[population] || population;
  }
}

// Singleton instance
let bridgeInstance: PollToRAGBridge | null = null;

export function getPollToRAGBridge(): PollToRAGBridge {
  if (!bridgeInstance) {
    bridgeInstance = new PollToRAGBridge();
  }
  return bridgeInstance;
}
