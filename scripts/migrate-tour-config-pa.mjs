/**
 * One-time migration: tourConfig.ts Michigan/Ingham demo copy → Pennsylvania.
 * Run: node scripts/migrate-tour-config-pa.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const p = path.join(root, 'lib/tour/tourConfig.ts');

let s = fs.readFileSync(p, 'utf8');

const PHILLY = [
  '101-:-PHILADELPHIA WARD 06 PRECINCT 13',
  '101-:-PHILADELPHIA WARD 06 PRECINCT 04',
  '101-:-PHILADELPHIA WARD 06 PRECINCT 06',
  '101-:-PHILADELPHIA WARD 09 PRECINCT 03',
];
const PHILLY_STR = PHILLY.map((x) => `'${x}'`).join(', ');

// Ordered replacements (some depend on earlier steps)
const steps = [
  // Theme comments
  [
    "| 'demo-scenario-senate'    // US Senate (statewide, Ingham County focus)",
    "| 'demo-scenario-senate'    // US Senate (statewide, Pennsylvania focus)",
  ],
  [
    "| 'demo-scenario-congress'  // US House MI-07 (competitive district)",
    "| 'demo-scenario-congress'  // US House PA-07-style competitive scenario",
  ],
  [
    "| 'demo-scenario'           // State House District 73 (Julie Brixie defense)",
    "| 'demo-scenario'           // State House District 171 (sample PA House scenario)",
  ],
  // Welcome map
  [
    'The map shows all 145+ precincts in Ingham County with targeting scores',
    'The map shows Pennsylvania precincts statewide with targeting scores',
  ],
  // Generic tour strings
  [
    'Compare Lansing vs East Lansing.',
    'Compare Philadelphia vs Pittsburgh.',
  ],
  [
    'Highlight East Lansing precincts.',
    'Highlight Philadelphia precincts.',
  ],
  [
    'Compare Lansing vs East Lansing" or "What makes Meridian Township different from Delhi Township?',
    'Compare Philadelphia vs Pittsburgh" or "What makes Reading different from Allentown?',
  ],
  [
    'Compare East Lansing with Meridian Township',
    'Compare Philadelphia with Pittsburgh',
  ],
  // Demo scenario header
  ['// DEMO SCENARIO TOUR - "Defend State House District 73"', '// DEMO SCENARIO TOUR - "State House District 171 (Pennsylvania)"'],
  [
    "* Story: You're a political consultant working on State House District 73\n * (MSU/Okemos/Mason area). Rep. Julie Brixie (D) holds this safe Democratic",
    "* Story: You're a political consultant working on State House District 171\n * (Southeast PA example). A Democratic incumbent holds this seat; the demo focuses on GOTV.",
  ],
  [
    '* Note: Ingham County State House Districts are 73, 74, 75, 76, and 77.\n * District 76 only partially covers Ingham County.',
    '* Note: Pennsylvania has 203 State House districts; district numbers in the crosswalk match official boundaries.',
  ],
  ['🎯 Demo: State House District 73 Strategy', '🎯 Demo: State House District 171 Strategy'],
  [
    "In this demo, you're a political consultant developing a field strategy for State House District 73 (MSU/Okemos/Mason area). Rep. Julie Brixie (D) holds this safe seat (D+32.8), but maximizing turnout here contributes to statewide Democratic margins.",
    "In this demo, you're developing a field strategy for State House District 171 (Pennsylvania). Maximizing turnout in your target districts contributes to statewide margins.",
  ],
  ['Watch as the AI analyzes District 73.', 'Watch as the AI analyzes District 171.'],
  [
    'Show me the political landscape of State House District 73',
    'Show me the political landscape of State House District 171',
  ],
  [
    "1. ✅ <strong>Discovery</strong> - Analyzed District 73\n2. ✅ <strong>Segmentation</strong> - Built persuasion & GOTV universes\n3. ✅ <strong>Comparison</strong> - Compared East Lansing vs Meridian\n4. ✅ <strong>Exports</strong> - Ready for deliverables",
    "1. ✅ <strong>Discovery</strong> - Analyzed District 171\n2. ✅ <strong>Segmentation</strong> - Built persuasion & GOTV universes\n3. ✅ <strong>Comparison</strong> - Compared Philadelphia vs Pittsburgh\n4. ✅ <strong>Exports</strong> - Ready for deliverables",
  ],
  [
    '<strong>For District 73, you identified:</strong>',
    '<strong>For District 171, you identified:</strong>',
  ],
];

for (const [a, b] of steps) {
  if (!s.includes(a)) {
    console.warn('WARN: pattern not found (skipped):', a.slice(0, 60) + '...');
  } else {
    s = s.split(a).join(b);
  }
}

// Global replaces
s = s.replace(/\bIngham County\b/g, 'Pennsylvania');
s = s.replace(/Ingham's/g, "Pennsylvania's");
s = s.replace(/\bMI-07\b/g, 'PA-07');
s = s.replace(/for Michigan\./g, 'for Pennsylvania.');
s = s.replace(/in Michigan\./g, 'in Pennsylvania.');
s = s.replace(/Michigan's suburban/g, "Pennsylvania's suburban");
s = s.replace(/outstate Michigan/g, 'rural and small-town Pennsylvania');
s = s.replace(
  /This analysis can be repeated for all 83 Michigan counties\. Focus on:[\s\S]*?<\/em>/,
  `This analysis applies statewide: compare Philadelphia, Pittsburgh, Harrisburg, and smaller metros using the same tools.\n\n<em>Use district and municipality layers to drill down.</em>`
);
s = s.replace(/Independent voice for Michigan/g, 'Independent voice for Pennsylvania');

// flyTo targets
s = s.replace(/target: 'East Lansing'/g, "target: 'Philadelphia'");
s = s.replace(/target: 'Lansing'/g, "target: 'Harrisburg'");
s = s.replace(/target: 'Meridian Township'/g, "target: 'Pittsburgh'");

// Precinct actions — use real PA UNIQUE_ID keys from targeting/crosswalk
s = s.replace(
  /precinctId: 'East Lansing 3'/g,
  "precinctId: '101-:-PHILADELPHIA WARD 06 PRECINCT 13'"
);
s = s.replace(
  /precinctId: 'East Lansing 1'/g,
  "precinctId: '101-:-PHILADELPHIA WARD 06 PRECINCT 04'"
);

// highlightPrecincts — replace known MI lists with Philly sample
s = s.replace(
  /\['Lansing 1-1', 'Lansing 1-3', 'Lansing 2-12', 'Lansing 3-23'\]/g,
  `[${PHILLY_STR}]`
);
s = s.replace(
  /\['East Lansing 1', 'East Lansing 3', 'East Lansing 4', 'East Lansing 6', 'East Lansing 7'\]/g,
  `[${PHILLY_STR}]`
);
s = s.replace(
  /\['East Lansing 1', 'East Lansing 3', 'Lansing 1-8', 'Lansing 1-9', 'Lansing 2-12'\]/g,
  `[${PHILLY_STR}]`
);
s = s.replace(
  /\['East Lansing 1', 'East Lansing 3', 'Lansing 1-4', 'Lansing 4-37'\]/g,
  `[${PHILLY_STR}]`
);
s = s.replace(
  /\['East Lansing 3'\]/g,
  `['101-:-PHILADELPHIA WARD 06 PRECINCT 13']`
);
s = s.replace(
  /\['Lansing 1-8', 'Lansing 1-9', 'Lansing 1-10', 'Lansing 2-12'\]/g,
  `[${PHILLY_STR}]`
);

// typeInChat — high-value user-visible queries
s = s.replace(
  /Compare East Lansing with Meridian Township - what are the key differences\?/g,
  'Compare Philadelphia with Pittsburgh — what are the key differences?'
);
s = s.replace(
  /Give me a political overview of Pennsylvania for a Democratic Senate campaign/g,
  'Give me a political overview of Pennsylvania for a Democratic Senate campaign'
);
s = s.replace(
  /Analyze PA-07 congressional district - show me the competitive breakdown in Pennsylvania/g,
  'Analyze PA-07 — show me the competitive precinct breakdown'
);
s = s.replace(
  /What are the key strategic opportunities in Pennsylvania for a Democratic campaign\?/g,
  'What are the key strategic opportunities in Pennsylvania for a Democratic campaign?'
);
s = s.replace(
  /Compare East Lansing voters with Delhi Township - what different approaches should we use\?/g,
  'Compare urban Philadelphia voters with suburban Allegheny County areas — what different approaches should we use?'
);
s = s.replace(
  /How should we allocate field resources between persuasion in suburbs and GOTV in Lansing for PA-07\?/g,
  'How should we allocate field resources between persuasion in suburbs and GOTV in Philadelphia for PA-07?'
);
s = s.replace(/Compare Lansing vs East Lansing/g, 'Compare Harrisburg vs Philadelphia');
s = s.replace(
  /Why is East Lansing more Democratic than Lansing\?/g,
  'Why do urban cores differ from inner suburbs in partisan lean?'
);
s = s.replace(/Compare East Lansing with Meridian Township/g, 'Compare Philadelphia with Pittsburgh');

// Titles / automated steps
s = s.replace(/🤖 Automated: Analyzing Pennsylvania/g, '🤖 Automated: Analyzing Pennsylvania');
s = s.replace(/Analyzing Ingham County/g, 'Analyzing Pennsylvania'); // if any left
s = s.replace(/🤖 Automated: Analyzing PA-07's Pennsylvania portion/g, "🤖 Automated: Analyzing PA-07");

// Remaining narrative cleanup — MSU / Barrett / Wayne County block handled above
s = s.replace(/Rep\. Tom Barrett \(R\) won by just 4\.8 points in 2024/g, 'This district is often competitive in federal races');
s = s.replace(/You're working for the Democratic challenger in Michigan's 7th/g, "You're working a competitive Pennsylvania congressional race");

fs.writeFileSync(p, s);
console.log('Updated', p);
