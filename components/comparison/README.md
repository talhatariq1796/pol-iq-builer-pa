# Split Screen Comparison Tool

Side-by-side comparison UI for analyzing two precincts or jurisdictions in the Political Landscape Analysis platform.

## Components

### ComparisonView (Main Container)
The orchestrating component that manages the entire comparison workflow.

**Features:**
- Entity type toggle (Jurisdictions | Precincts | vs Average)
- Dual entity selectors with search
- Swap and clear controls
- URL query param sync for deep linking
- Automatic data loading and insights generation

**Usage:**
```tsx
import { ComparisonView } from '@/components/comparison';

export default function ComparisonPage() {
  return (
    <div className="h-screen">
      <ComparisonView />
    </div>
  );
}
```

**URL Parameters:**
- `?left=precinct-name&right=precinct-name&type=precincts`
- Example: `?left=Lansing%20Ward%201&right=Lansing%20Ward%202&type=precincts`

---

### ComparisonPane
One side of the split-screen comparison showing detailed entity metrics.

**Props:**
- `entity: ComparisonEntity` - The entity data to display
- `side: 'left' | 'right'` - Which side (affects accent color)

**Sections:**
- Demographics (population, voters, income, education, race/ethnicity)
- Political Profile (partisan lean, swing potential, competitiveness)
- Electoral Performance (recent election results, vote shares, margins)
- Targeting Scores (GOTV, persuasion, recommended strategy)
- Election History (last 3 election cycles)

All sections are collapsible using shadcn Accordion.

---

### EntitySelector
Searchable dropdown for selecting precincts or jurisdictions.

**Props:**
- `value: string | null` - Selected entity ID
- `onChange: (entityId: string, entity: EntitySearchResult) => void` - Selection callback
- `entityType: 'precinct' | 'jurisdiction'` - Type filter
- `placeholder?: string` - Placeholder text
- `side?: 'left' | 'right'` - Side indicator (affects check mark color)

**Features:**
- Real-time search filtering
- Shows partisan lean and voter count
- Keyboard navigation support
- Uses shadcn Popover + Command pattern

**Data Sources:**
- Precincts: `/data/processed/precinct_political_scores.json`
- Jurisdictions: Hardcoded list (TODO: load from API)

---

### MetricRow
Single metric comparison row with difference indicators.

**Props:**
- `metricName: string` - Display name
- `leftValue: number` - Left entity value
- `rightValue: number` - Right entity value
- `difference: number` - Calculated difference (left - right)
- `percentDiff: number` - Percentage difference
- `isSignificant: boolean` - Whether difference is significant
- `direction: 'left-higher' | 'right-higher' | 'equal'` - Direction indicator
- `formatType: 'number' | 'currency' | 'percent' | 'points'` - Value formatting

**Visual Features:**
- Arrow indicators (↑/↓/≈)
- Color coding (green/red/yellow) based on significance
- Bar visualization for 0-100 scores
- Difference badge with percentage

---

### InsightsSummary
AI-generated strategic insights from the comparison.

**Props:**
- `insights: string[]` - List of insight statements
- `leftName: string` - Left entity name (for highlighting)
- `rightName: string` - Right entity name (for highlighting)
- `onGenerateFullAnalysis?: () => void` - Optional callback for full AI analysis

**Features:**
- Auto-detects insight type and shows appropriate icon
- Highlights entity names in bold with side-specific colors
- Optional "Generate Full AI Analysis" button
- Disclaimer text

---

## Types

All types are defined in `/lib/comparison/types.ts`:

### ComparisonEntity
Complete entity data structure with:
- Identity (id, name, type)
- Demographics (population, voters, income, education, race/ethnicity)
- Political Profile (partisan lean, swing potential, competitiveness, turnout)
- Electoral Performance (vote shares, margins, total votes)
- Targeting Scores (GOTV, persuasion, strategy, canvassing efficiency)
- Election History (last 3 cycles)

### MetricDifference
Represents the difference between two metric values:
- Metric name and values
- Absolute and percentage difference
- Significance flag
- Direction and format type

### EntitySearchResult
Lightweight search result for entity selector:
- Basic identity (id, name, type)
- Parent name (for hierarchical display)
- Key metrics (partisan lean, registered voters)

---

## Styling

All components use:
- **Tailwind CSS** for styling
- **shadcn/ui** components (Button, Card, Popover, Accordion, Badge, etc.)
- **Dark mode** compatible (uses `dark:` variants)
- **Responsive design** - stacks vertically on mobile

**Accent Colors:**
- Left side: Blue (`blue-600`, `blue-400`)
- Right side: Red (`red-600`, `red-400`)

---

## Data Flow

1. User selects entity type (jurisdictions/precincts)
2. User selects two entities via EntitySelector
3. ComparisonView loads data from JSON files:
   - `/data/processed/precinct_political_scores.json`
   - `/data/processed/precinct_targeting_scores.json`
   - `/data/processed/precinct_election_history.json`
4. ComparisonView builds ComparisonEntity objects
5. Insights are auto-generated based on key differences
6. ComparisonPane components display detailed metrics
7. InsightsSummary shows strategic takeaways

---

## Future Enhancements

- [ ] Compare to county/district average
- [ ] Export comparison as PDF report
- [ ] Save comparison to favorites/bookmarks
- [ ] AI-powered full analysis generation
- [ ] Historical trend comparison (multi-cycle)
- [ ] Demographic crosswalk for precinct-level data
- [ ] Real jurisdiction data (currently placeholder)
- [ ] Interactive charts (election trends, demographic pyramids)

---

## Example Usage Scenarios

### Scenario 1: Precinct-to-Precinct Comparison
**Use Case:** Campaign manager wants to compare two precincts to allocate canvassing resources.

**Workflow:**
1. Select "Precincts" tab
2. Search and select "Lansing Ward 1 Precinct 1"
3. Search and select "Lansing Ward 2 Precinct 3"
4. Review insights: "Lansing Ward 1 has higher GOTV priority..."
5. Use swap button to flip comparison if needed

### Scenario 2: Jurisdiction-to-Jurisdiction Comparison
**Use Case:** Party strategist comparing two cities for resource allocation.

**Workflow:**
1. Select "Jurisdictions" tab
2. Select "City of Lansing"
3. Select "City of East Lansing"
4. Review demographic and targeting differences
5. Generate PDF report (future feature)

### Scenario 3: Deep Linking
**Use Case:** Share specific comparison with team members.

**Workflow:**
1. Make comparison in UI
2. Copy URL: `?left=precinct1&right=precinct2&type=precincts`
3. Share link - opens with same comparison loaded

---

## File Structure

```
components/comparison/
├── MetricRow.tsx            # Single metric comparison row
├── ComparisonPane.tsx       # One side of split screen
├── EntitySelector.tsx       # Searchable entity dropdown
├── InsightsSummary.tsx      # AI insights display
├── ComparisonView.tsx       # Main orchestrating component
├── index.ts                 # Exports
└── README.md                # This file

lib/comparison/
└── types.ts                 # TypeScript type definitions
```

---

**Created:** 2025-12-01
**Platform:** Political Landscape Analysis (Pennsylvania)
