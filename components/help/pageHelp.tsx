'use client';

/**
 * Page-specific help content for all tool pages
 */

import { HelpSection, HelpIcons, HelpContent, WorkflowTutorial } from './HelpDialog';

// =============================================================================
// Political AI Page Help
// =============================================================================
export const politicalAIHelp: HelpSection[] = [
  {
    id: 'what-is',
    title: 'What is the Political Analysis Assistant?',
    icon: HelpIcons.Question,
    content: (
      <HelpContent.Paragraph>
        The Political Analysis Assistant is your AI-powered partner for exploring electoral data
        in Ingham County, Michigan. Ask questions in natural language about precincts, demographics,
        voting patterns, and campaign strategy. The AI understands political context and can help
        you identify opportunities, analyze trends, and make data-driven decisions.
      </HelpContent.Paragraph>
    ),
  },
  {
    id: 'capabilities',
    title: 'What Can It Do?',
    icon: HelpIcons.List,
    content: (
      <HelpContent.BulletList
        items={[
          'Analyze precinct demographics and voting history',
          'Identify swing precincts and persuadable voters',
          'Calculate GOTV (Get Out The Vote) priorities',
          'Compare precincts and find similar areas',
          'Generate targeting scores and recommendations',
          'Visualize data on the interactive map',
          'Answer questions about candidates, elections, and issues',
        ]}
      />
    ),
  },
  {
    id: 'map-controls',
    title: 'Map Controls',
    icon: HelpIcons.Map,
    content: (
      <HelpContent.ControlsGrid
        controls={[
          { action: 'Click precinct', description: 'View details in sidebar' },
          { action: 'Draw polygon', description: 'Select custom area' },
          { action: 'Scroll wheel', description: 'Zoom in/out' },
          { action: 'Click + drag', description: 'Pan the map' },
          { action: 'Layer toggle', description: 'Change visualization' },
          { action: 'Legend click', description: 'Filter by category' },
        ]}
      />
    ),
  },
  {
    id: 'tips',
    title: 'Pro Tips',
    icon: HelpIcons.Lightbulb,
    content: (
      <HelpContent.TipList
        tips={[
          'Start with a precinct click to get context, then ask follow-up questions',
          'Use phrases like "show me" or "highlight" to trigger map visualizations',
          'Ask "why" questions to understand the reasoning behind scores',
          'Request comparisons: "How does this compare to neighboring precincts?"',
          'Save interesting findings by asking for a summary or report',
        ]}
      />
    ),
  },
  {
    id: 'ai-examples',
    title: 'Example Questions',
    icon: HelpIcons.Chat,
    content: (
      <HelpContent.AIExamples
        examples={[
          'What are the top swing precincts in East Lansing?',
          'Show me high GOTV priority areas on the map',
          'Why is Lansing Precinct 1 competitive?',
          'Compare the demographics of urban vs suburban precincts',
          'Which precincts have the most College Towns tapestry segment?',
        ]}
      />
    ),
  },
];

// =============================================================================
// Segments Page Help
// =============================================================================
export const segmentsHelp: HelpSection[] = [
  {
    id: 'what-is',
    title: 'What is Voter Segmentation?',
    icon: HelpIcons.Question,
    content: (
      <HelpContent.Paragraph>
        Voter Segmentation helps you build targeted voter universes by filtering precincts
        based on demographics, voting behavior, and lifestyle characteristics. Create segments
        for GOTV campaigns, persuasion outreach, or donor prospecting by combining multiple
        criteria to find exactly the voters you need.
      </HelpContent.Paragraph>
    ),
  },
  {
    id: 'filters',
    title: 'Available Filters',
    icon: HelpIcons.Filter,
    content: (
      <HelpContent.BulletList
        items={[
          'Partisan Lean: Filter by Democratic/Republican lean (-100 to +100)',
          'Swing Potential: Target persuadable precincts (0-100 score)',
          'GOTV Priority: Focus on turnout opportunities (0-100 score)',
          'Tapestry Segments: Filter by ESRI lifestyle segments',
          'Demographics: Age, income, education, population density',
          'Geography: Cities, townships, or custom areas',
        ]}
      />
    ),
  },
  {
    id: 'presets',
    title: 'Quick Presets',
    icon: HelpIcons.List,
    content: (
      <HelpContent.Definitions
        items={[
          { term: 'GOTV Universe', definition: 'High-turnout-potential precincts with strong partisan lean' },
          { term: 'Persuasion Targets', definition: 'Swing precincts with moderate partisan lean' },
          { term: 'Base Mobilization', definition: 'Strong partisan precincts with lower turnout' },
          { term: 'Donor Prospects', definition: 'High-income areas with favorable demographics' },
        ]}
      />
    ),
  },
  {
    id: 'tips',
    title: 'Pro Tips',
    icon: HelpIcons.Lightbulb,
    content: (
      <HelpContent.TipList
        tips={[
          'Start with a preset and then customize the filters',
          'Use the AI to describe your target audience in plain language',
          'Save segments for reuse across canvassing and donor tools',
          'Export segments to CSV for use in other campaign tools',
          'Combine geographic and demographic filters for precision targeting',
        ]}
      />
    ),
  },
  {
    id: 'ai-examples',
    title: 'Ask the AI',
    icon: HelpIcons.Chat,
    content: (
      <HelpContent.AIExamples
        examples={[
          'Find precincts with high swing potential and college students',
          'Build a GOTV universe for East Lansing',
          'Which precincts have the most young professionals?',
          'Create a segment of suburban persuadable voters',
          'Show me areas with low turnout but strong Democratic lean',
        ]}
      />
    ),
  },
];

// =============================================================================
// Donors Page Help
// =============================================================================
export const donorsHelp: HelpSection[] = [
  {
    id: 'what-is',
    title: 'What is Donor Analysis?',
    icon: HelpIcons.Question,
    content: (
      <HelpContent.Paragraph>
        The Donor Analysis tool helps you understand political giving patterns in Ingham County
        using FEC data. Identify donor concentrations, analyze giving trends over time, and find
        high-potential areas for fundraising. The tool aggregates individual contributions by
        ZIP code to reveal geographic patterns while protecting donor privacy.
      </HelpContent.Paragraph>
    ),
  },
  {
    id: 'metrics',
    title: 'Key Metrics',
    icon: HelpIcons.Chart,
    content: (
      <HelpContent.Definitions
        items={[
          { term: 'Total Raised', definition: 'Sum of all contributions in the area' },
          { term: 'Donor Count', definition: 'Number of unique contributors' },
          { term: 'Average Gift', definition: 'Mean contribution amount' },
          { term: 'Donor Density', definition: 'Donors per 1,000 residents' },
          { term: 'Momentum', definition: 'Change in giving compared to prior period' },
        ]}
      />
    ),
  },
  {
    id: 'views',
    title: 'Analysis Views',
    icon: HelpIcons.List,
    content: (
      <HelpContent.BulletList
        items={[
          'Geographic: See donor concentration by ZIP code on the map',
          'Time Series: Track giving trends over months and years',
          'Occupation: Analyze which professions give the most',
          'Party Split: Compare Democratic vs Republican giving',
          'Top ZIPs: Ranked list of highest-giving areas',
        ]}
      />
    ),
  },
  {
    id: 'tips',
    title: 'Pro Tips',
    icon: HelpIcons.Lightbulb,
    content: (
      <HelpContent.TipList
        tips={[
          'Look for ZIP codes with high average gifts but low donor counts - untapped potential',
          'Use time series to identify giving spikes around elections',
          'Cross-reference donor ZIPs with your voter segments',
          'Check occupation data to tailor your fundraising messaging',
          'Export top donor areas for targeted direct mail campaigns',
        ]}
      />
    ),
  },
  {
    id: 'ai-examples',
    title: 'Ask the AI',
    icon: HelpIcons.Chat,
    content: (
      <HelpContent.AIExamples
        examples={[
          'Where are the highest-giving ZIP codes?',
          'Show donor concentration on the map',
          'How has giving changed since 2020?',
          'Which occupations give the most to Democrats?',
          'Find ZIP codes with high potential but low current giving',
        ]}
      />
    ),
  },
];

// =============================================================================
// Canvass Page Help
// =============================================================================
export const canvassHelp: HelpSection[] = [
  {
    id: 'what-is',
    title: 'What is the Canvassing Planner?',
    icon: HelpIcons.Question,
    content: (
      <HelpContent.Paragraph>
        The Canvassing Planner helps you build efficient door-knocking universes and optimize
        routes for your field team. Select target precincts, estimate doors and time requirements,
        and generate walk lists. The tool considers population density, geographic clustering,
        and targeting scores to maximize your canvassing ROI.
      </HelpContent.Paragraph>
    ),
  },
  {
    id: 'workflow',
    title: 'Planning Workflow',
    icon: HelpIcons.List,
    content: (
      <HelpContent.TipList
        tips={[
          'Select target precincts using segments or manual selection',
          'Review estimated doors and time requirements',
          'Optimize routes for geographic efficiency',
          'Assign turfs to canvassers',
          'Export walk lists with addresses and voter info',
        ]}
      />
    ),
  },
  {
    id: 'metrics',
    title: 'Canvassing Metrics',
    icon: HelpIcons.Chart,
    content: (
      <HelpContent.Definitions
        items={[
          { term: 'Doors/Hour', definition: 'Expected contact rate based on density (30-50 typical)' },
          { term: 'Contact Rate', definition: 'Percentage of successful door contacts (20-40%)' },
          { term: 'Turf Size', definition: 'Optimal doors per shift (40-50 recommended)' },
          { term: 'Walk Score', definition: 'Efficiency rating based on clustering' },
        ]}
      />
    ),
  },
  {
    id: 'tips',
    title: 'Pro Tips',
    icon: HelpIcons.Lightbulb,
    content: (
      <HelpContent.TipList
        tips={[
          'Start with high-priority precincts from your GOTV or persuasion segments',
          'Consider population density - urban areas have more doors/hour',
          'Cluster nearby precincts to minimize driving time',
          'Plan for 4-hour shifts with 40-50 doors each',
          'Use the AI to find optimal canvassing windows based on demographics',
        ]}
      />
    ),
  },
  {
    id: 'ai-examples',
    title: 'Ask the AI',
    icon: HelpIcons.Chat,
    content: (
      <HelpContent.AIExamples
        examples={[
          'Plan a canvassing route for East Lansing',
          'How many doors can we knock in 4 hours?',
          'Which precincts are most efficient for canvassing?',
          'Prioritize precincts by GOTV score',
          'Create turfs for 5 canvassers in Meridian Township',
        ]}
      />
    ),
  },
];

// =============================================================================
// Compare Page Help
// =============================================================================
export const compareHelp: HelpSection[] = [
  {
    id: 'what-is',
    title: 'What is the Comparison Tool?',
    icon: HelpIcons.Question,
    content: (
      <HelpContent.Paragraph>
        The Comparison Tool lets you analyze two precincts, jurisdictions, or segments
        side-by-side. Compare demographics, voting patterns, targeting scores, and other
        metrics to understand differences and similarities. Useful for benchmarking, finding
        similar areas, or understanding geographic variation.
      </HelpContent.Paragraph>
    ),
  },
  {
    id: 'compare-types',
    title: 'What Can You Compare?',
    icon: HelpIcons.Compare,
    content: (
      <HelpContent.BulletList
        items={[
          'Precincts: Individual voting precincts',
          'Jurisdictions: Cities, townships, or counties',
          'Segments: Saved voter segments',
          'Custom Areas: Drawn polygons or selections',
        ]}
      />
    ),
  },
  {
    id: 'metrics',
    title: 'Comparison Metrics',
    icon: HelpIcons.Chart,
    content: (
      <HelpContent.Definitions
        items={[
          { term: 'Demographics', definition: 'Population, age, income, education' },
          { term: 'Political', definition: 'Partisan lean, swing potential, turnout' },
          { term: 'Targeting', definition: 'GOTV priority, persuasion opportunity' },
          { term: 'Tapestry', definition: 'Lifestyle segment composition' },
        ]}
      />
    ),
  },
  {
    id: 'tips',
    title: 'Pro Tips',
    icon: HelpIcons.Lightbulb,
    content: (
      <HelpContent.TipList
        tips={[
          'Compare a target precinct to a successful past precinct to identify similarities',
          'Use "Find Similar" to discover precincts like your best performers',
          'Compare urban vs suburban precincts to tailor messaging',
          'Export comparisons for presentation to campaign stakeholders',
        ]}
      />
    ),
  },
  {
    id: 'ai-examples',
    title: 'Ask the AI',
    icon: HelpIcons.Chat,
    content: (
      <HelpContent.AIExamples
        examples={[
          'Compare East Lansing to Lansing precincts',
          'Find precincts similar to Meridian Township',
          'What makes suburban precincts different from urban ones?',
          'Compare my GOTV segment to my persuasion segment',
        ]}
      />
    ),
  },
];

// =============================================================================
// Knowledge Graph Page Help (refactored from inline)
// =============================================================================
export const knowledgeGraphHelp: HelpSection[] = [
  {
    id: 'what-is',
    title: 'What is the Knowledge Graph?',
    icon: HelpIcons.Question,
    content: (
      <HelpContent.Paragraph>
        The Knowledge Graph is an interactive visualization of political entities and their relationships
        in Ingham County, Michigan. It shows how candidates, offices, parties, jurisdictions, and elections
        are connected, helping you understand the political landscape at a glance.
      </HelpContent.Paragraph>
    ),
  },
  {
    id: 'entity-types',
    title: 'Entity Types (Nodes)',
    icon: HelpIcons.Graph,
    content: (
      <HelpContent.ColorLegend
        items={[
          { color: 'bg-blue-500', label: 'Candidates', description: 'Politicians running' },
          { color: 'bg-purple-500', label: 'Offices', description: 'Elected positions' },
          { color: 'bg-red-500', label: 'Parties', description: 'Political parties' },
          { color: 'bg-green-500', label: 'Jurisdictions', description: 'Geographic areas' },
          { color: 'bg-orange-500', label: 'Elections', description: 'Voting events' },
          { color: 'bg-yellow-500', label: 'Issues', description: 'Policy topics' },
        ]}
      />
    ),
  },
  {
    id: 'relationships',
    title: 'Relationship Types (Edges)',
    icon: HelpIcons.Arrow,
    content: (
      <HelpContent.Definitions
        items={[
          { term: 'MEMBER_OF', definition: 'Candidate belongs to a party' },
          { term: 'RUNNING_FOR', definition: 'Candidate is running for an office' },
          { term: 'INCUMBENT', definition: 'Candidate currently holds an office' },
          { term: 'PART_OF', definition: 'Jurisdiction is within another jurisdiction' },
          { term: 'CONTESTED_IN', definition: 'Office is being contested in an election' },
        ]}
      />
    ),
  },
  {
    id: 'controls',
    title: 'Graph Controls',
    icon: HelpIcons.Controls,
    content: (
      <HelpContent.ControlsGrid
        controls={[
          { action: 'Click node', description: 'Select and view details' },
          { action: 'Drag node', description: 'Reposition in graph' },
          { action: 'Scroll wheel', description: 'Zoom in/out' },
          { action: 'Drag background', description: 'Pan the view' },
          { action: 'Hover node', description: 'See entity tooltip' },
          { action: 'Double-click', description: 'Center on node' },
        ]}
      />
    ),
  },
  {
    id: 'tips',
    title: 'Pro Tips',
    icon: HelpIcons.Lightbulb,
    content: (
      <HelpContent.TipList
        tips={[
          'Use the AI chat to ask questions like "Who is running for Governor?"',
          'Look for clusters - tightly connected nodes often share political alignment',
          'Follow edges from a candidate to see their office and party',
          'Drag nodes apart to untangle dense areas',
          'Click "Refresh" to reset the graph layout',
        ]}
      />
    ),
  },
  {
    id: 'ai-examples',
    title: 'Using the AI Assistant',
    icon: HelpIcons.Chat,
    content: (
      <HelpContent.AIExamples
        examples={[
          'Who are the candidates for US Senate?',
          'What jurisdictions are in Ingham County?',
          'Tell me about Gretchen Whitmer',
          'What elections are coming up in 2026?',
          'How is East Lansing connected to state government?',
        ]}
      />
    ),
  },
];

// =============================================================================
// WORKFLOW TUTORIALS - Interactive walkthroughs per page
// =============================================================================

/**
 * Political AI Page Tutorials
 * Main analysis page - full set of workflow tours
 */
export const politicalAITutorials: WorkflowTutorial[] = [
  {
    theme: 'workflow-find-swing',
    label: 'Find Swing Precincts',
    description: 'Identify competitive areas for persuasion campaigns',
  },
  {
    theme: 'workflow-analyze-precinct',
    label: 'Analyze a Precinct',
    description: 'Deep-dive into any precinct\'s data',
  },
  {
    theme: 'workflow-build-gotv',
    label: 'Build a GOTV Universe',
    description: 'Create a turnout targeting list',
  },
];

/**
 * Segments Page Tutorials
 */
export const segmentsTutorials: WorkflowTutorial[] = [
  {
    theme: 'workflow-build-gotv',
    label: 'Build a GOTV Universe',
    description: 'Create a targeted turnout segment',
  },
  {
    theme: 'workflow-find-swing',
    label: 'Find Persuadable Voters',
    description: 'Target swing precincts for persuasion',
  },
];


/**
 * Compare Page Tutorials
 */
export const compareTutorials: WorkflowTutorial[] = [
  {
    theme: 'workflow-compare-areas',
    label: 'Compare Two Areas',
    description: 'Side-by-side jurisdiction comparison',
  },
];

/**
 * Knowledge Graph Page Tutorials
 */
export const knowledgeGraphTutorials: WorkflowTutorial[] = [
  // Knowledge graph is more exploratory - fewer structured workflows
  // Users typically just browse the graph
];

// =============================================================================
// CROSS-TOOL WORKFLOW TUTORIALS
// These demonstrate navigation between tools with context preservation
// =============================================================================

/**
 * Cross-Tool Tutorials - Available on main political-ai page
 * Demonstrates workflows that span multiple tools
 */
export const crossToolTutorials: WorkflowTutorial[] = [
  {
    theme: 'cross-tool-full-workflow',
    label: 'Full Campaign Workflow',
    description: 'Complete workflow: Analyze → Segment → Canvass → Report',
  },
];

/**
 * Cross-Tool Help Section - Explains cross-tool navigation
 */
export const crossToolHelp: HelpSection[] = [
  {
    id: 'cross-tool',
    title: 'Working Across Tools',
    icon: HelpIcons.Arrow,
    content: (
      <HelpContent.Paragraph>
        Your analysis context travels with you as you navigate between tools. When you identify
        interesting precincts or build a segment, that selection can be carried to other tools
        like Canvassing, Donors, or Comparison. Look for &quot;Continue in...&quot; buttons or ask the
        AI to take your selection to another tool.
      </HelpContent.Paragraph>
    ),
  },
  {
    id: 'context-preservation',
    title: 'Context Preservation',
    icon: HelpIcons.List,
    content: (
      <HelpContent.BulletList
        items={[
          'Map state (zoom, center, layers) is preserved when navigating',
          'Selected precincts carry forward to new tools',
          'Saved segments can be loaded in any tool',
          'AI remembers your exploration history across tools',
          'Deep links let you share specific views with colleagues',
        ]}
      />
    ),
  },
  {
    id: 'cross-tool-workflows',
    title: 'Common Multi-Tool Workflows',
    icon: HelpIcons.Chart,
    content: (
      <HelpContent.Definitions
        items={[
          { term: 'GOTV Campaign', definition: 'Segments → Canvassing → Route Export' },
          { term: 'Fundraising', definition: 'Donors → Segments → Targeted Outreach' },
          { term: 'Opposition Research', definition: 'Knowledge Graph → Comparison → Report' },
          { term: 'Field Planning', definition: 'Analysis → Segments → Canvassing' },
        ]}
      />
    ),
  },
  {
    id: 'cross-tool-tips',
    title: 'Pro Tips',
    icon: HelpIcons.Lightbulb,
    content: (
      <HelpContent.TipList
        tips={[
          'Save segments early - they can be reused across all tools',
          'Use the AI command "Continue this in Canvassing" to transfer context',
          'The navigation sidebar shows which tools have active selections',
          'Bookmark URLs to save specific views with all context',
          'Export reports to capture multi-tool analysis findings',
        ]}
      />
    ),
  },
];
