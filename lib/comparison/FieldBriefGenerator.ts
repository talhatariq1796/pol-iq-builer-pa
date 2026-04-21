/**
 * Field Brief Generator for Political Campaign Operations
 *
 * Generates structured briefings for field coordinators comparing two areas.
 * Includes executive summary, talking points, and practical field operations info.
 *
 * This is a non-AI version that uses demographic and political data to generate
 * tactical guidance for canvassers. AI integration will be added in Phase 5.
 */

import type { ComparisonEntity } from './types';
import type {
  FieldBrief,
  AreaProfiles,
  AreaProfile,
  KeyDifference,
  TalkingPoints,
  AreaTalkingPoints,
  VoterProfiles,
  VoterProfile,
  FieldOperations,
  FieldOpsInfo,
  BriefOptions,
  BriefFormat,
} from './types-brief';

const DEFAULT_OPTIONS: BriefOptions = {
  includeMap: false,
  includeVoterProfiles: true,
  includeTalkingPoints: true,
  includeFieldOps: true,
  briefingLength: 'standard',
  audience: 'canvassers',
  language: 'en',
};

export class FieldBriefGenerator {
  /**
   * Generate a complete field brief for two entities
   */
  async generateBrief(
    leftEntity: ComparisonEntity,
    rightEntity: ComparisonEntity,
    options: Partial<BriefOptions> = {}
  ): Promise<FieldBrief> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Generate all sections
    const [summary, profiles, talkingPoints, voterProfiles, fieldOps] = await Promise.all([
      this.generateSummary(leftEntity, rightEntity),
      this.buildAreaProfiles(leftEntity, rightEntity),
      opts.includeTalkingPoints ? this.generateTalkingPoints(leftEntity, rightEntity) : this.emptyTalkingPoints(leftEntity, rightEntity),
      opts.includeVoterProfiles ? this.buildVoterProfiles(leftEntity, rightEntity) : this.emptyVoterProfiles(leftEntity, rightEntity),
      opts.includeFieldOps ? this.buildFieldOperations(leftEntity, rightEntity) : this.emptyFieldOps(leftEntity, rightEntity),
    ]);

    return {
      summary,
      profiles,
      talkingPoints,
      voterProfiles,
      fieldOps,
      metadata: {
        generated: new Date(),
        comparison: {
          left: leftEntity.name,
          right: rightEntity.name,
        },
      },
    };
  }

  /**
   * Export brief to various formats
   */
  exportBrief(brief: FieldBrief, format: BriefFormat): string {
    switch (format) {
      case 'markdown':
        return this.toMarkdown(brief);
      case 'text':
        return this.toPlainText(brief);
      case 'html':
        return this.toHTML(brief);
      case 'pdf':
        throw new Error('PDF export requires ComparisonReportGenerator');
      default:
        return this.toMarkdown(brief);
    }
  }

  // =====================================================================
  // SECTION GENERATORS
  // =====================================================================

  /**
   * Generate executive summary comparing two areas
   */
  private async generateSummary(left: ComparisonEntity, right: ComparisonEntity): Promise<string> {
    // Determine which is more competitive
    const leftCompetitive = Math.abs(left.politicalProfile.partisanLean) < 10;
    const rightCompetitive = Math.abs(right.politicalProfile.partisanLean) < 10;

    let competitiveAnalysis = '';
    if (leftCompetitive && !rightCompetitive) {
      competitiveAnalysis = `${left.name} is the more competitive area with a partisan lean of ${this.formatLean(left.politicalProfile.partisanLean)}, making it a priority for persuasion efforts.`;
    } else if (!leftCompetitive && rightCompetitive) {
      competitiveAnalysis = `${right.name} is the more competitive area with a partisan lean of ${this.formatLean(right.politicalProfile.partisanLean)}, making it a priority for persuasion efforts.`;
    } else if (leftCompetitive && rightCompetitive) {
      competitiveAnalysis = `Both areas are competitive swing territory, requiring balanced persuasion and mobilization strategies.`;
    } else {
      competitiveAnalysis = `Neither area is highly competitive. Focus on base mobilization in ${left.politicalProfile.partisanLean > 0 ? left.name : right.name} (${this.formatLean(left.politicalProfile.partisanLean > 0 ? left.politicalProfile.partisanLean : right.politicalProfile.partisanLean)}).`;
    }

    // Demographic differences
    const incomeDiff = Math.abs(left.demographics.medianIncome - right.demographics.medianIncome);
    const eduDiff = Math.abs(left.demographics.collegePct - right.demographics.collegePct);

    let demographicAnalysis = '';
    if (incomeDiff > 15000) {
      const higher = left.demographics.medianIncome > right.demographics.medianIncome ? left.name : right.name;
      const lower = left.demographics.medianIncome > right.demographics.medianIncome ? right.name : left.name;
      demographicAnalysis = `${higher} has significantly higher median income ($${Math.round(Math.max(left.demographics.medianIncome, right.demographics.medianIncome) / 1000)}K vs $${Math.round(Math.min(left.demographics.medianIncome, right.demographics.medianIncome) / 1000)}K), suggesting different economic messaging strategies.`;
    } else if (eduDiff > 15) {
      const higher = left.demographics.collegePct > right.demographics.collegePct ? left.name : right.name;
      demographicAnalysis = `${higher} has a more college-educated population (${Math.round(Math.max(left.demographics.collegePct, right.demographics.collegePct))}% vs ${Math.round(Math.min(left.demographics.collegePct, right.demographics.collegePct))}%), which may influence message sophistication and policy focus.`;
    } else {
      demographicAnalysis = `Both areas have similar demographic profiles, allowing for consistent messaging across both territories.`;
    }

    // Strategy recommendations
    const leftStrategy = left.targetingScores.recommendedStrategy;
    const rightStrategy = right.targetingScores.recommendedStrategy;

    let strategyAnalysis = '';
    if (leftStrategy === rightStrategy) {
      strategyAnalysis = `Both areas recommend a ${leftStrategy.toLowerCase()} approach. Coordinate efforts across both territories.`;
    } else {
      strategyAnalysis = `${left.name} requires ${leftStrategy.toLowerCase()} while ${right.name} needs ${rightStrategy.toLowerCase()}. Tailor volunteer scripts accordingly.`;
    }

    return [competitiveAnalysis, demographicAnalysis, strategyAnalysis].join(' ');
  }

  /**
   * Build area profiles
   */
  private buildAreaProfiles(left: ComparisonEntity, right: ComparisonEntity): AreaProfiles {
    const leftProfile = this.buildSingleProfile(left);
    const rightProfile = this.buildSingleProfile(right);

    const keyDifferences = this.identifyKeyDifferences(left, right);

    return {
      left: leftProfile,
      right: rightProfile,
      keyDifferences,
    };
  }

  /**
   * Build single area profile
   */
  private buildSingleProfile(entity: ComparisonEntity): AreaProfile {
    return {
      name: entity.name,
      partisanLean: this.formatLean(entity.politicalProfile.partisanLean),
      population: entity.demographics.totalPopulation,
      medianIncome: entity.demographics.medianIncome,
      collegePct: entity.demographics.collegePct,
      strategy: entity.targetingScores.recommendedStrategy,
      competitiveness: entity.politicalProfile.competitiveness,
    };
  }

  /**
   * Identify key differences between areas
   */
  private identifyKeyDifferences(left: ComparisonEntity, right: ComparisonEntity): KeyDifference[] {
    const differences: KeyDifference[] = [];

    // Partisan lean
    if (Math.abs(left.politicalProfile.partisanLean - right.politicalProfile.partisanLean) > 10) {
      differences.push({
        metric: 'Partisan Lean',
        leftValue: this.formatLean(left.politicalProfile.partisanLean),
        rightValue: this.formatLean(right.politicalProfile.partisanLean),
        implication: 'Adjust persuasion vs mobilization balance',
      });
    }

    // Income
    if (Math.abs(left.demographics.medianIncome - right.demographics.medianIncome) > 15000) {
      differences.push({
        metric: 'Median Income',
        leftValue: `$${Math.round(left.demographics.medianIncome / 1000)}K`,
        rightValue: `$${Math.round(right.demographics.medianIncome / 1000)}K`,
        implication: 'Economic messaging should differ',
      });
    }

    // Education
    if (Math.abs(left.demographics.collegePct - right.demographics.collegePct) > 15) {
      differences.push({
        metric: 'College Education',
        leftValue: `${Math.round(left.demographics.collegePct)}%`,
        rightValue: `${Math.round(right.demographics.collegePct)}%`,
        implication: 'Education policy focus differs',
      });
    }

    // Strategy
    if (left.targetingScores.recommendedStrategy !== right.targetingScores.recommendedStrategy) {
      differences.push({
        metric: 'Strategy',
        leftValue: left.targetingScores.recommendedStrategy,
        rightValue: right.targetingScores.recommendedStrategy,
        implication: 'Different script and approach needed',
      });
    }

    return differences;
  }

  /**
   * Generate talking points for both areas
   */
  private generateTalkingPoints(left: ComparisonEntity, right: ComparisonEntity): TalkingPoints {
    return {
      left: this.generateAreaTalkingPoints(left),
      right: this.generateAreaTalkingPoints(right),
    };
  }

  /**
   * Generate talking points for one area
   */
  private generateAreaTalkingPoints(entity: ComparisonEntity): AreaTalkingPoints {
    const isSwing = Math.abs(entity.politicalProfile.partisanLean) < 10;
    const isHighIncome = entity.demographics.medianIncome > 70000;
    const isCollegeEducated = entity.demographics.collegePct > 45;
    const isUrban = entity.demographics.populationDensity > 2000;

    // Determine top issues based on demographics
    const topIssues: string[] = [];

    if (isHighIncome) {
      topIssues.push('Property tax policies and local investment');
    } else {
      topIssues.push('Cost of living and economic opportunity');
    }

    if (isCollegeEducated) {
      topIssues.push('Education funding and school quality');
      topIssues.push('Climate and environmental policies');
    } else {
      topIssues.push('Job creation and workforce development');
      topIssues.push('Infrastructure and transportation');
    }

    if (isUrban) {
      topIssues.push('Public safety and community services');
    } else {
      topIssues.push('Rural broadband and agricultural support');
    }

    // Determine avoid topics
    const avoidTopics: string[] = [];
    if (entity.politicalProfile.partisanLean > 15) {
      avoidTopics.push('Avoid divisive national partisan issues');
    } else if (entity.politicalProfile.partisanLean < -15) {
      avoidTopics.push('Focus on local issues rather than national politics');
    } else {
      avoidTopics.push('Avoid strongly partisan framing');
    }

    // Key messages based on strategy
    const keyMessages: string[] = [];
    switch (entity.targetingScores.recommendedStrategy) {
      case 'Battleground':
        keyMessages.push('Emphasize bipartisan accomplishments');
        keyMessages.push('Focus on results, not party labels');
        keyMessages.push('Ask about their priorities');
        break;
      case 'Base Mobilization':
        keyMessages.push('Energize with party achievements');
        keyMessages.push('Emphasize importance of turnout');
        keyMessages.push('Share voting plan information');
        break;
      case 'Persuasion Target':
        keyMessages.push('Lead with shared values');
        keyMessages.push('Listen more than you talk');
        keyMessages.push('Find common ground first');
        break;
      default:
        keyMessages.push('Gather information about concerns');
        keyMessages.push('Leave a positive impression');
        keyMessages.push('Collect contact information');
    }

    // Connection points
    const connectionPoints: string[] = [
      'Ask about their connection to the neighborhood',
      'Reference local events or concerns',
    ];
    if (isCollegeEducated) {
      connectionPoints.push('Discuss policy details if they engage');
    } else {
      connectionPoints.push('Focus on practical impacts, not policy details');
    }

    return {
      areaName: entity.name,
      topIssues: topIssues.slice(0, 3),
      avoidTopics: avoidTopics.slice(0, 2),
      keyMessages: keyMessages.slice(0, 3),
      connectionPoints: connectionPoints.slice(0, 3),
    };
  }

  /**
   * Build voter profiles for both areas
   */
  private buildVoterProfiles(left: ComparisonEntity, right: ComparisonEntity): VoterProfiles {
    return {
      left: this.buildSingleVoterProfile(left),
      right: this.buildSingleVoterProfile(right),
    };
  }

  /**
   * Build voter profile for one area (based on demographics, not Tapestry for now)
   */
  private buildSingleVoterProfile(entity: ComparisonEntity): VoterProfile {
    const isHighIncome = entity.demographics.medianIncome > 70000;
    const isCollegeEducated = entity.demographics.collegePct > 45;
    const isUrban = entity.demographics.populationDensity > 2000;
    const isYoung = entity.demographics.medianAge < 35;
    const isOlder = entity.demographics.medianAge > 50;

    // Generate segment name based on characteristics
    let dominantSegment = '';
    if (isHighIncome && isCollegeEducated && isUrban) {
      dominantSegment = 'Urban Professionals';
    } else if (isHighIncome && isCollegeEducated && !isUrban) {
      dominantSegment = 'Suburban Achievers';
    } else if (!isHighIncome && isUrban) {
      dominantSegment = 'Urban Working Class';
    } else if (isOlder && !isUrban) {
      dominantSegment = 'Rural Traditionalists';
    } else if (isYoung && isUrban) {
      dominantSegment = 'Young Urban Renters';
    } else {
      dominantSegment = 'Middle America Mix';
    }

    // Lifestyle description
    let lifestyleDescription = '';
    if (isHighIncome && isCollegeEducated) {
      lifestyleDescription = 'Career-focused professionals with active lifestyles, engaged in community activities, and interested in quality of life issues.';
    } else if (isUrban && !isHighIncome) {
      lifestyleDescription = 'Hardworking residents focused on making ends meet, community-oriented, and concerned about neighborhood safety and opportunity.';
    } else if (isOlder) {
      lifestyleDescription = 'Established residents with deep community ties, focused on stability, property values, and traditional values.';
    } else {
      lifestyleDescription = 'Diverse mix of families and individuals at various life stages, concerned about practical local issues.';
    }

    // Typical occupations
    const typicalOccupations: string[] = [];
    if (isHighIncome && isCollegeEducated) {
      typicalOccupations.push('Management', 'Healthcare', 'Technology', 'Education');
    } else if (isCollegeEducated) {
      typicalOccupations.push('Teachers', 'Nurses', 'Government employees', 'Small business owners');
    } else {
      typicalOccupations.push('Service industry', 'Manufacturing', 'Retail', 'Trades');
    }

    // Media habits
    const mediaHabits: string[] = [];
    if (isYoung) {
      mediaHabits.push('Social media (Instagram, TikTok)', 'Streaming services', 'Digital news');
    } else if (isCollegeEducated) {
      mediaHabits.push('NPR/PBS', 'Online news sites', 'Podcasts');
    } else {
      mediaHabits.push('Local TV news', 'Facebook', 'Local newspaper');
    }

    // Values and priorities
    const valuesAndPriorities: string[] = [];
    if (entity.politicalProfile.partisanLean > 10) {
      valuesAndPriorities.push('Community investment', 'Education', 'Healthcare access');
    } else if (entity.politicalProfile.partisanLean < -10) {
      valuesAndPriorities.push('Economic freedom', 'Public safety', 'Traditional values');
    } else {
      valuesAndPriorities.push('Practical solutions', 'Fiscal responsibility', 'Local control');
    }

    return {
      areaName: entity.name,
      dominantSegment,
      lifestyleDescription,
      typicalOccupations: typicalOccupations.slice(0, 4),
      mediaHabits: mediaHabits.slice(0, 3),
      valuesAndPriorities: valuesAndPriorities.slice(0, 3),
    };
  }

  /**
   * Build field operations info
   */
  private buildFieldOperations(left: ComparisonEntity, right: ComparisonEntity): FieldOperations {
    return {
      left: this.buildSingleFieldOps(left),
      right: this.buildSingleFieldOps(right),
    };
  }

  /**
   * Build field ops info for one area
   */
  private buildSingleFieldOps(entity: ComparisonEntity): FieldOpsInfo {
    const isUrban = entity.demographics.populationDensity > 2000;
    const isSuburban = entity.demographics.populationDensity > 500 && entity.demographics.populationDensity <= 2000;

    let density: 'urban' | 'suburban' | 'rural';
    if (isUrban) {
      density = 'urban';
    } else if (isSuburban) {
      density = 'suburban';
    } else {
      density = 'rural';
    }

    const bestTimes: string[] = [];
    if (isUrban) {
      bestTimes.push('Weekday evenings 5-8pm', 'Saturday 10am-4pm');
    } else {
      bestTimes.push('Saturday 10am-5pm', 'Sunday 1-5pm', 'Weekday evenings 4-7pm');
    }

    let parkingNotes = '';
    if (isUrban) {
      parkingNotes = 'Street parking may be limited. Consider public transit or carpooling. Look for public lots near starting points.';
    } else if (isSuburban) {
      parkingNotes = 'Residential street parking usually available. Be mindful of homeowner preferences.';
    } else {
      parkingNotes = 'Distances between homes may be significant. Plan efficient driving routes between walk lists.';
    }

    const safetyNotes = 'Always canvass in pairs. Stay aware of surroundings. Have phone charged and location sharing on.';

    return {
      areaName: entity.name,
      doorsPerHour: entity.targetingScores.canvassingEfficiency,
      bestTimes,
      density,
      parkingNotes,
      safetyNotes,
    };
  }

  // =====================================================================
  // EXPORT FORMATTERS
  // =====================================================================

  /**
   * Convert brief to Markdown format
   */
  private toMarkdown(brief: FieldBrief): string {
    const lines: string[] = [];

    lines.push(`# Field Brief: ${brief.metadata.comparison.left} vs ${brief.metadata.comparison.right}`);
    lines.push(`*Generated: ${brief.metadata.generated.toLocaleDateString()}*`);
    lines.push('');

    lines.push('## Executive Summary');
    lines.push(brief.summary);
    lines.push('');

    lines.push('## Area Profiles');
    lines.push('');
    lines.push('| Metric | ' + brief.profiles.left.name + ' | ' + brief.profiles.right.name + ' |');
    lines.push('|--------|--------|--------|');
    lines.push(`| Partisan Lean | ${brief.profiles.left.partisanLean} | ${brief.profiles.right.partisanLean} |`);
    lines.push(`| Population | ${brief.profiles.left.population.toLocaleString()} | ${brief.profiles.right.population.toLocaleString()} |`);
    lines.push(`| Median Income | $${Math.round(brief.profiles.left.medianIncome / 1000)}K | $${Math.round(brief.profiles.right.medianIncome / 1000)}K |`);
    lines.push(`| College % | ${Math.round(brief.profiles.left.collegePct)}% | ${Math.round(brief.profiles.right.collegePct)}% |`);
    lines.push(`| Strategy | ${brief.profiles.left.strategy} | ${brief.profiles.right.strategy} |`);
    lines.push('');

    if (brief.profiles.keyDifferences.length > 0) {
      lines.push('### Key Differences');
      for (const diff of brief.profiles.keyDifferences) {
        lines.push(`- **${diff.metric}**: ${diff.leftValue} vs ${diff.rightValue} - *${diff.implication}*`);
      }
      lines.push('');
    }

    lines.push('## Talking Points');
    lines.push('');
    lines.push(`### ${brief.talkingPoints.left.areaName}`);
    lines.push('**Top Issues:**');
    for (const issue of brief.talkingPoints.left.topIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
    lines.push('**Key Messages:**');
    for (const msg of brief.talkingPoints.left.keyMessages) {
      lines.push(`- ${msg}`);
    }
    lines.push('');

    lines.push(`### ${brief.talkingPoints.right.areaName}`);
    lines.push('**Top Issues:**');
    for (const issue of brief.talkingPoints.right.topIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
    lines.push('**Key Messages:**');
    for (const msg of brief.talkingPoints.right.keyMessages) {
      lines.push(`- ${msg}`);
    }
    lines.push('');

    lines.push('## Voter Profiles');
    lines.push('');
    lines.push(`### ${brief.voterProfiles.left.areaName}`);
    lines.push(`**${brief.voterProfiles.left.dominantSegment}**`);
    lines.push(brief.voterProfiles.left.lifestyleDescription);
    lines.push('');
    lines.push('**Typical Occupations:** ' + brief.voterProfiles.left.typicalOccupations.join(', '));
    lines.push('**Media Habits:** ' + brief.voterProfiles.left.mediaHabits.join(', '));
    lines.push('');

    lines.push(`### ${brief.voterProfiles.right.areaName}`);
    lines.push(`**${brief.voterProfiles.right.dominantSegment}**`);
    lines.push(brief.voterProfiles.right.lifestyleDescription);
    lines.push('');
    lines.push('**Typical Occupations:** ' + brief.voterProfiles.right.typicalOccupations.join(', '));
    lines.push('**Media Habits:** ' + brief.voterProfiles.right.mediaHabits.join(', '));
    lines.push('');

    lines.push('## Field Operations');
    lines.push('');
    lines.push(`### ${brief.fieldOps.left.areaName}`);
    lines.push(`- **Doors/Hour**: ${brief.fieldOps.left.doorsPerHour}`);
    lines.push(`- **Best Times**: ${brief.fieldOps.left.bestTimes.join(', ')}`);
    lines.push(`- **Parking**: ${brief.fieldOps.left.parkingNotes}`);
    lines.push('');

    lines.push(`### ${brief.fieldOps.right.areaName}`);
    lines.push(`- **Doors/Hour**: ${brief.fieldOps.right.doorsPerHour}`);
    lines.push(`- **Best Times**: ${brief.fieldOps.right.bestTimes.join(', ')}`);
    lines.push(`- **Parking**: ${brief.fieldOps.right.parkingNotes}`);

    return lines.join('\n');
  }

  /**
   * Convert brief to plain text
   */
  private toPlainText(brief: FieldBrief): string {
    return this.toMarkdown(brief)
      .replace(/#+\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\|/g, ' | ')
      .replace(/-{3,}/g, '---');
  }

  /**
   * Convert brief to HTML
   */
  private toHTML(brief: FieldBrief): string {
    // Simple HTML conversion
    const markdown = this.toMarkdown(brief);
    return `<!DOCTYPE html>
<html>
<head>
  <title>Field Brief: ${brief.metadata.comparison.left} vs ${brief.metadata.comparison.right}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    h1 { color: #333; }
    h2 { color: #555; border-bottom: 1px solid #ddd; }
    h3 { color: #666; }
  </style>
</head>
<body>
  <h1>Field Brief: ${brief.metadata.comparison.left} vs ${brief.metadata.comparison.right}</h1>
  <p><em>Generated: ${brief.metadata.generated.toLocaleDateString()}</em></p>
  <h2>Executive Summary</h2>
  <p>${brief.summary}</p>
  <!-- Additional HTML content would be generated here -->
</body>
</html>`;
  }

  // =====================================================================
  // HELPER METHODS
  // =====================================================================

  /**
   * Format partisan lean as human-readable string
   */
  private formatLean(lean: number): string {
    if (lean > 0) {
      return `D+${Math.round(lean)}`;
    } else if (lean < 0) {
      return `R+${Math.round(Math.abs(lean))}`;
    } else {
      return 'Even';
    }
  }

  /**
   * Empty talking points when not included
   */
  private emptyTalkingPoints(left: ComparisonEntity, right: ComparisonEntity): TalkingPoints {
    return {
      left: { areaName: left.name, topIssues: [], avoidTopics: [], keyMessages: [], connectionPoints: [] },
      right: { areaName: right.name, topIssues: [], avoidTopics: [], keyMessages: [], connectionPoints: [] },
    };
  }

  /**
   * Empty voter profiles when not included
   */
  private emptyVoterProfiles(left: ComparisonEntity, right: ComparisonEntity): VoterProfiles {
    return {
      left: { areaName: left.name, dominantSegment: '', lifestyleDescription: '', typicalOccupations: [], mediaHabits: [], valuesAndPriorities: [] },
      right: { areaName: right.name, dominantSegment: '', lifestyleDescription: '', typicalOccupations: [], mediaHabits: [], valuesAndPriorities: [] },
    };
  }

  /**
   * Empty field ops when not included
   */
  private emptyFieldOps(left: ComparisonEntity, right: ComparisonEntity): FieldOperations {
    return {
      left: { areaName: left.name, doorsPerHour: 0, bestTimes: [], density: 'suburban', parkingNotes: '', safetyNotes: '' },
      right: { areaName: right.name, doorsPerHour: 0, bestTimes: [], density: 'suburban', parkingNotes: '', safetyNotes: '' },
    };
  }
}
