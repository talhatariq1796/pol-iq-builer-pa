# Political Analysis Glossary

## Metrics

### Partisan Lean
A measure of how Democratic or Republican an area has voted historically. Expressed as a number from -100 to +100, where positive numbers indicate Democratic lean and negative numbers indicate Republican lean.

**Example**: A precinct with partisan lean of +25 means Democrats have outperformed Republicans by about 25 percentage points on average in recent elections.

### Swing Potential
A score from 0-100 indicating how likely an area is to change its voting patterns. High swing potential areas have shown volatility in past elections or have demographics associated with persuadable voters.

**Example**: A precinct with swing potential of 65 has shown significant vote swings between elections and may be receptive to persuasion efforts.

### GOTV Priority (Get-Out-The-Vote Priority)
A score from 0-100 indicating the value of voter turnout efforts in an area. High GOTV priority means there are many potential supporters who didn't vote in recent elections.

**Example**: A precinct with GOTV priority of 80 has many likely supporters with low turnout history - mobilizing these voters could significantly impact results.

### Persuasion Opportunity
A score from 0-100 indicating the concentration of persuadable or undecided voters. High persuasion opportunity areas have many moderates, independents, or ticket-splitters.

**Example**: A precinct with persuasion opportunity of 55 has a meaningful number of voters who might be convinced to support your candidate.

### Competitiveness
A classification of how close elections are in an area:
- **Safe D/R**: One party wins by 20+ points consistently
- **Likely D/R**: One party wins by 10-20 points
- **Lean D/R**: One party wins by 5-10 points
- **Tossup**: Margins under 5 points, truly competitive

### Targeting Strategy
The recommended approach for a precinct based on its scores:
- **Battleground**: Competitive area needing both GOTV and persuasion
- **Base Mobilization**: Friendly area where turnout is the priority
- **Persuasion Target**: Area with many persuadable voters to convince
- **Maintenance**: Safe area requiring minimal campaign resources

## Geographic Terms

### Precinct
The smallest voting unit. Each precinct has one polling place and typically contains 500-3,000 registered voters. Ingham County has 103 precincts.

### Jurisdiction
A city or township. Ingham County has 19 jurisdictions: 5 cities (Lansing, East Lansing, Mason, Leslie, Williamston) and 14 townships.

### Block Group
A Census geographic unit, smaller than a tract. Block groups contain 600-3,000 people and are the finest level at which most demographic data is available.

### H3 Hexagon
A uniform hexagonal grid cell used for visualization. H3 Level 7 cells are approximately 5 square kilometers each. Using hexagons eliminates visual bias from varying precinct sizes.

## Election Terms

### Margin
The difference in vote percentage between the top two candidates. A margin of +5 means the winner got 5 percentage points more than the runner-up.

### Turnout
The percentage of registered voters who cast ballots. A turnout of 72% means 72 out of 100 registered voters voted.

### Ticket-Splitting
When voters support candidates from different parties on the same ballot. High ticket-splitting indicates less partisan loyalty.

### General Election
The main election held in November. Includes federal, state, and local races.

### Midterm Election
A general election in a year without a presidential race (e.g., 2022). Typically has lower turnout than presidential years.

## Data Terms

### Interpolation
Estimating values for one geography (precincts) based on data from another geography (block groups). We use area-weighted interpolation, which assumes values are distributed proportionally to land area.

### Weighted Average
An average where some values count more than others. We weight recent elections more heavily than older ones, and weight by voter population when combining precincts.

### Estimate
A calculated value based on modeling or statistical methods, not a direct count. Demographic projections and party affiliation are estimates.

## Abbreviations

- **ACS**: American Community Survey (Census Bureau annual demographic survey)
- **CVAP**: Citizen Voting Age Population (citizens age 18+)
- **GOTV**: Get Out The Vote (turnout mobilization)
- **MSU**: Michigan State University
- **VAP**: Voting Age Population (all residents 18+, including non-citizens)
