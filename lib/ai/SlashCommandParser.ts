import type { MapCommand } from '@/lib/ai-native/types';

export interface SlashCommandResult {
  handled: boolean;
  response?: string;
  mapCommands?: MapCommand[];
  suggestedActions?: Array<{
    id: string;
    label: string;
    action: string;
    icon?: string;
    metadata?: Record<string, unknown>;
  }>;
  navigation?: string;
  toolAction?: {
    type: string;
    payload: Record<string, unknown>;
  };
  clearChat?: boolean;
}

export interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  examples: string[];
  handler: (args: string) => SlashCommandResult;
}

// Metric name mappings
const METRIC_ALIASES: Record<string, string> = {
  // Targeting metrics
  swing: 'swing_potential',
  gotv: 'gotv_priority',
  persuasion: 'persuasion_opportunity',
  combined: 'combined_score',
  turnout: 'turnout',
  partisan: 'partisan_lean',
  lean: 'partisan_lean',

  // Full names
  swing_potential: 'swing_potential',
  gotv_priority: 'gotv_priority',
  persuasion_opportunity: 'persuasion_opportunity',
  combined_score: 'combined_score',
  partisan_lean: 'partisan_lean',
};

// Report type aliases
const REPORT_ALIASES: Record<string, string> = {
  exec: 'executive',
  executive: 'executive',
  summary: 'executive',
  target: 'targeting',
  targeting: 'targeting',
  brief: 'targeting',
  profile: 'profile',
  full: 'profile',
  compare: 'comparison',
  comparison: 'comparison',
  segment: 'segment',
  canvass: 'canvass',
  canvassing: 'canvass',
  field: 'canvass',
};

const COMMAND_HANDLERS: Record<string, (args: string) => SlashCommandResult> = {
  // Report commands
  report: handleReportCommand,
  pdf: handleReportCommand,

  // Visualization commands
  show: handleShowCommand,
  heatmap: handleHeatmapCommand,
  highlight: handleHighlightCommand,

  // Analysis commands
  find: handleFindCommand,
  compare: handleCompareCommand,
  analyze: handleAnalyzeCommand,

  // Export/history commands
  export: handleExportCommand,
  history: handleHistoryCommand,

  // Navigation commands
  segments: () => handleNavigateCommand('segments'),

  // Utility commands
  help: handleHelpCommand,
  clear: handleClearCommand,
  save: handleSaveCommand,
};

const SLASH_COMMANDS: Record<string, SlashCommand> = {
  report: {
    name: 'report',
    aliases: ['pdf'],
    description: 'Generate a report',
    usage: '/report [type]',
    examples: ['/report', '/report executive', '/report targeting'],
    handler: handleReportCommand,
  },
  show: {
    name: 'show',
    aliases: ['heatmap', 'map'],
    description: 'Change map visualization',
    usage: '/show [metric]',
    examples: ['/show swing', '/show gotv', '/show persuasion'],
    handler: handleShowCommand,
  },
  find: {
    name: 'find',
    aliases: ['search', 'filter'],
    description: 'Find precincts matching criteria',
    usage: '/find [criteria]',
    examples: ['/find swing > 70', '/find competitive', '/find high gotv'],
    handler: handleFindCommand,
  },
  compare: {
    name: 'compare',
    aliases: ['vs'],
    description: 'Compare two areas',
    usage: '/compare [area1] vs [area2]',
    examples: ['/compare East Lansing vs Meridian'],
    handler: handleCompareCommand,
  },
  export: {
    name: 'export',
    aliases: ['download'],
    description: 'Export data',
    usage: '/export [type]',
    examples: ['/export csv', '/export segment'],
    handler: handleExportCommand,
  },
  history: {
    name: 'history',
    aliases: ['recent'],
    description: 'View report history',
    usage: '/history',
    examples: ['/history'],
    handler: handleHistoryCommand,
  },
  highlight: {
    name: 'highlight',
    aliases: ['focus', 'goto'],
    description: 'Highlight area on map',
    usage: '/highlight [area]',
    examples: ['/highlight East Lansing', '/highlight Precinct 1'],
    handler: handleHighlightCommand,
  },
  analyze: {
    name: 'analyze',
    aliases: ['info', 'about'],
    description: 'Analyze an area',
    usage: '/analyze [area]',
    examples: ['/analyze', '/analyze Meridian Township'],
    handler: handleAnalyzeCommand,
  },
  save: {
    name: 'save',
    aliases: [],
    description: 'Save current segment',
    usage: '/save [name]',
    examples: ['/save High GOTV Targets'],
    handler: handleSaveCommand,
  },
  help: {
    name: 'help',
    aliases: ['?', 'commands'],
    description: 'Show available commands',
    usage: '/help',
    examples: ['/help'],
    handler: handleHelpCommand,
  },
  clear: {
    name: 'clear',
    aliases: ['reset'],
    description: 'Clear chat history',
    usage: '/clear',
    examples: ['/clear'],
    handler: handleClearCommand,
  },
};

function parseSlashCommand(input: string): { command: string; args: string } | null {
  const trimmed = input.trim();

  if (!trimmed.startsWith('/')) {
    return null;
  }

  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) {
    return {
      command: trimmed.slice(1).toLowerCase(),
      args: '',
    };
  }

  return {
    command: trimmed.slice(1, spaceIndex).toLowerCase(),
    args: trimmed.slice(spaceIndex + 1).trim(),
  };
}

export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

export function executeSlashCommand(input: string): SlashCommandResult {
  const parsed = parseSlashCommand(input);

  if (!parsed) {
    return { handled: false };
  }

  const handler = COMMAND_HANDLERS[parsed.command];
  if (!handler) {
    // Check aliases
    for (const cmd of Object.values(SLASH_COMMANDS)) {
      if (cmd.aliases.includes(parsed.command)) {
        return cmd.handler(parsed.args);
      }
    }

    return {
      handled: true,
      response: `Unknown command: /${parsed.command}\n\nType **/help** to see available commands.`,
      suggestedActions: [
        { id: 'help', label: 'Show help', action: '/help', icon: 'help-circle' },
      ],
    };
  }

  return handler(parsed.args);
}

function handleReportCommand(args: string): SlashCommandResult {
  const reportType = args.toLowerCase().trim();

  if (!reportType) {
    // Show report options
    return {
      handled: true,
      response: `📋 **Report Generation**\n\nAvailable report types:\n\n` +
        `• **/report executive** - One-page overview\n` +
        `• **/report targeting** - Ranked precinct list\n` +
        `• **/report profile** - Full 7-page analysis\n` +
        `• **/report comparison** - Side-by-side comparison\n` +
        `• **/report segment** - Segment documentation\n` +
        `• **/report canvass** - Canvassing plan\n` +
        `Or just type **/report** and I'll suggest the best one based on your session.`,
      suggestedActions: [
        { id: 'exec', label: '📋 Executive Summary', action: 'report:executive', icon: 'file-text' },
        { id: 'target', label: '🎯 Targeting Brief', action: 'report:targeting', icon: 'target' },
        { id: 'profile', label: '📊 Political Profile', action: 'report:profile', icon: 'book-open' },
        { id: 'customize', label: '⚙️ Customize sections', action: 'customize report', icon: 'settings' },
      ],
    };
  }

  // Resolve report type alias
  const resolvedType = REPORT_ALIASES[reportType];

  if (!resolvedType) {
    return {
      handled: true,
      response: `Unknown report type: "${reportType}"\n\n` +
        `Available types: executive, targeting, profile, comparison, segment, canvass, donor`,
      suggestedActions: [
        { id: 'help', label: 'Show report help', action: '/report', icon: 'help-circle' },
      ],
    };
  }

  // Trigger report generation
  return {
    handled: true,
    response: `Generating ${resolvedType} report...`,
    suggestedActions: [
      { id: 'generate', label: `Generate ${resolvedType} report`, action: `report:${resolvedType}`, icon: 'file-text' },
    ],
  };
}

function handleShowCommand(args: string): SlashCommandResult {
  const metric = args.toLowerCase().trim();

  if (!metric) {
    return {
      handled: true,
      response: `🗺️ **Map Visualization**\n\nUsage: **/show [metric]**\n\n` +
        `Available metrics:\n` +
        `• **/show swing** - Swing potential\n` +
        `• **/show gotv** - GOTV priority\n` +
        `• **/show persuasion** - Persuasion opportunity\n` +
        `• **/show turnout** - Voter turnout\n` +
        `• **/show partisan** - Partisan lean\n` +
        `• **/show combined** - Combined targeting score`,
      suggestedActions: [
        { id: 'swing', label: 'Show swing', action: 'map:showHeatmap', icon: 'map', metadata: { metric: 'swing_potential' } },
        { id: 'gotv', label: 'Show GOTV', action: 'map:showHeatmap', icon: 'map', metadata: { metric: 'gotv_priority' } },
        { id: 'persuasion', label: 'Show persuasion', action: 'map:showHeatmap', icon: 'map', metadata: { metric: 'persuasion_opportunity' } },
      ],
    };
  }

  const resolvedMetric = METRIC_ALIASES[metric];

  if (!resolvedMetric) {
    return {
      handled: true,
      response: `Unknown metric: "${metric}"\n\nAvailable: swing, gotv, persuasion, turnout, partisan, combined`,
    };
  }

  return {
    handled: true,
    response: `Showing ${metric} on map...`,
    mapCommands: [{ type: 'showHeatmap', metric: resolvedMetric }],
  };
}

function handleHeatmapCommand(args: string): SlashCommandResult {
  // Alias for /show
  return handleShowCommand(args);
}

function handleHighlightCommand(args: string): SlashCommandResult {
  const target = args.trim();

  if (!target) {
    return {
      handled: true,
      response: `🔍 **Highlight**\n\nUsage: **/highlight [precinct or area name]**\n\n` +
        `Examples:\n` +
        `• **/highlight East Lansing**\n` +
        `• **/highlight Meridian Township**\n` +
        `• **/highlight Precinct 1**`,
    };
  }

  return {
    handled: true,
    response: `Highlighting "${target}" on map...`,
    mapCommands: [
      { type: 'highlight', target },
      { type: 'flyTo', target },
    ],
  };
}

function handleFindCommand(args: string): SlashCommandResult {
  const criteria = args.trim();

  if (!criteria) {
    return {
      handled: true,
      response: `🔍 **Find Precincts**\n\nUsage: **/find [criteria]**\n\n` +
        `Examples:\n` +
        `• **/find swing > 70** - High swing potential\n` +
        `• **/find gotv > 80** - High GOTV priority\n` +
        `• **/find turnout < 50** - Low turnout areas\n` +
        `• **/find competitive** - Toss-up precincts\n` +
        `• **/find high persuasion** - Persuadable areas`,
      suggestedActions: [
        { id: 'swing', label: 'Find swing precincts', action: 'Find precincts with swing potential above 70', icon: 'search' },
        { id: 'gotv', label: 'Find GOTV targets', action: 'Find precincts with GOTV priority above 80', icon: 'search' },
        { id: 'competitive', label: 'Find competitive', action: 'Find competitive toss-up precincts', icon: 'search' },
      ],
    };
  }

  // Parse the criteria and convert to a natural language query
  // The AI will process this
  return {
    handled: true,
    response: `Searching for precincts matching: ${criteria}`,
    suggestedActions: [
      { id: 'search', label: 'Search', action: `Find precincts with ${criteria}`, icon: 'search' },
    ],
  };
}

function handleCompareCommand(args: string): SlashCommandResult {
  const input = args.trim();

  if (!input) {
    return {
      handled: true,
      response: `⚖️ **Compare Areas**\n\nUsage: **/compare [area1] vs [area2]**\n\n` +
        `Examples:\n` +
        `• **/compare East Lansing vs Meridian**\n` +
        `• **/compare Lansing vs Delhi Township**\n` +
        `• **/compare Precinct 1 vs Precinct 5**`,
      suggestedActions: [
        { id: 'nav', label: 'Go to comparison tool', action: 'navigate:/compare', icon: 'columns' },
      ],
    };
  }

  // Parse "X vs Y" or "X and Y"
  const vsMatch = input.match(/(.+?)\s+(?:vs\.?|versus|and|compared?\s+to)\s+(.+)/i);

  if (vsMatch) {
    const area1 = vsMatch[1].trim();
    const area2 = vsMatch[2].trim();

    return {
      handled: true,
      response: `Comparing ${area1} vs ${area2}...`,
      suggestedActions: [
        { id: 'compare', label: `Compare ${area1} vs ${area2}`, action: `Compare ${area1} versus ${area2}`, icon: 'columns' },
      ],
    };
  }

  return {
    handled: true,
    response: `Please specify two areas to compare.\n\nExample: **/compare East Lansing vs Meridian**`,
  };
}

function handleAnalyzeCommand(args: string): SlashCommandResult {
  const target = args.trim();

  if (target) {
    return {
      handled: true,
      response: `Analyzing ${target}...`,
      suggestedActions: [
        { id: 'analyze', label: `Analyze ${target}`, action: `Tell me about ${target}`, icon: 'bar-chart' },
      ],
    };
  }

  return {
    handled: true,
    response: `📊 **Analyze**\n\nAnalyzing currently selected area...\n\n` +
      `Tip: Click on a precinct on the map first, or specify an area:\n` +
      `**/analyze East Lansing**`,
    suggestedActions: [
      { id: 'analyze', label: 'Analyze selection', action: 'Analyze the selected precinct', icon: 'bar-chart' },
    ],
  };
}

function handleExportCommand(args: string): SlashCommandResult {
  const exportType = args.toLowerCase().trim();

  if (!exportType || exportType === 'help') {
    return {
      handled: true,
      response: `📥 **Export Data**\n\nUsage: **/export [type]**\n\n` +
        `Available exports:\n` +
        `• **/export csv** - Export precincts to CSV\n` +
        `• **/export segment** - Export current segment\n` +
        `• **/export conversation** - Export chat transcript`,
      suggestedActions: [
        { id: 'csv', label: 'Export to CSV', action: 'output:exportCSV', icon: 'file-spreadsheet' },
        { id: 'segment', label: 'Export segment', action: 'output:saveSegment', icon: 'bookmark' },
      ],
    };
  }

  const exportActions: Record<string, string> = {
    csv: 'output:exportCSV',
    precincts: 'output:exportCSV',
    segment: 'output:saveSegment',
    conversation: 'output:exportConversation',
    chat: 'output:exportConversation',
  };

  const action = exportActions[exportType];

  if (!action) {
    return {
      handled: true,
      response: `Unknown export type: "${exportType}"\n\nAvailable: csv, segment, conversation`,
    };
  }

  return {
    handled: true,
    response: `Exporting ${exportType}...`,
    suggestedActions: [
      { id: 'export', label: `Export ${exportType}`, action, icon: 'download' },
    ],
  };
}

function handleHistoryCommand(_args: string): SlashCommandResult {
  return {
    handled: true,
    response: `Loading report history...`,
    suggestedActions: [
      { id: 'history', label: 'Show report history', action: 'show my report history', icon: 'clock' },
    ],
  };
}

function handleNavigateCommand(tool: string): SlashCommandResult {
  const destinations: Record<string, { path: string; label: string }> = {
    segments: { path: '/segments', label: 'Segment Builder' },
    compare: { path: '/compare', label: 'Comparison Tool' },
    'political-ai': { path: '/political-ai', label: 'Political Map' },
  };

  const dest = destinations[tool];

  if (!dest) {
    return {
      handled: true,
      response: `Unknown destination: ${tool}`,
    };
  }

  return {
    handled: true,
    response: `Navigating to ${dest.label}...`,
    navigation: dest.path,
  };
}

function handleHelpCommand(_args: string): SlashCommandResult {
  return {
    handled: true,
    response: `📚 **Slash Commands**\n\n` +
      `**Reports**\n` +
      `• **/report [type]** - Generate a report (executive, targeting, profile, etc.)\n` +
      `• **/history** - View recent reports\n\n` +
      `**Map & Visualization**\n` +
      `• **/show [metric]** - Show metric on map (swing, gotv, persuasion, turnout)\n` +
      `• **/highlight [area]** - Highlight area on map\n\n` +
      `**Analysis**\n` +
      `• **/find [criteria]** - Find precincts (e.g., /find swing > 70)\n` +
      `• **/compare [A] vs [B]** - Compare two areas\n` +
      `• **/analyze** - Analyze selected area\n\n` +
      `**Export & Save**\n` +
      `• **/export [type]** - Export data (csv, segment, conversation)\n` +
      `• **/save [name]** - Save current segment\n\n` +
      `**Utility**\n` +
      `• **/help** - Show this help\n` +
      `• **/clear** - Clear chat history`,
    suggestedActions: [
      { id: 'report', label: 'Generate report', action: '/report', icon: 'file-text' },
      { id: 'find', label: 'Find precincts', action: '/find', icon: 'search' },
      { id: 'show', label: 'Show on map', action: '/show', icon: 'map' },
    ],
  };
}

function handleClearCommand(_args: string): SlashCommandResult {
  return {
    handled: true,
    response: `Chat history cleared.`,
    clearChat: true,
  };
}

function handleSaveCommand(args: string): SlashCommandResult {
  const name = args.trim();

  if (!name) {
    return {
      handled: true,
      response: `💾 **Save Segment**\n\nUsage: **/save [segment name]**\n\n` +
        `Example: **/save High GOTV Targets**\n\n` +
        `This will save the current filtered precincts as a reusable segment.`,
    };
  }

  return {
    handled: true,
    response: `Saving segment as "${name}"...`,
    toolAction: {
      type: 'saveSegment',
      payload: { name },
    },
  };
}
