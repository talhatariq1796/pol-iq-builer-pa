# Political Analysis Methodology

## Overview

This platform provides political landscape analysis for Ingham County, Michigan (Lansing metro area). Our methodology combines official election results with demographic data to help campaigns understand voter behavior and optimize outreach.

## Data Sources

### Election Results
- **Source**: Ingham County Clerk (official certified results)
- **Coverage**: 2020, 2022, and 2024 general elections
- **Level**: Precinct-level (103 precincts)
- **Metrics**: Vote totals, party percentages, margins, turnout rates

### Demographics
- **Source**: U.S. Census Bureau (American Community Survey 2019-2023)
- **Source**: Esri demographic estimates (current year)
- **Level**: Census block group, interpolated to precincts
- **Metrics**: Population, age, income, education, race/ethnicity

### Geographic Boundaries
- **Source**: Michigan Secretary of State / Michigan GIS Open Data
- **Coverage**: Voting precincts, townships, cities, legislative districts

## Key Metrics Explained

### Partisan Lean
A score from -100 to +100 indicating historical voting patterns:
- **Positive values** (e.g., +30): Democratic-leaning
- **Negative values** (e.g., -20): Republican-leaning
- **Near zero**: Competitive/swing area

Calculated as a weighted average across recent elections, with more recent elections weighted higher.

### Swing Potential
A score from 0 to 100 indicating how volatile or persuadable an area is:
- **High scores** (60+): Area has shown significant vote swings between elections
- **Low scores** (<30): Area votes consistently for one party

Factors include margin changes between elections and ticket-splitting behavior.

### GOTV Priority (Get-Out-The-Vote)
A score from 0 to 100 indicating the value of turnout mobilization:
- **High scores**: Many potential supporters who didn't vote in recent elections
- **Low scores**: Already high turnout or unfavorable partisan composition

### Persuasion Opportunity
A score from 0 to 100 indicating the concentration of persuadable voters:
- **High scores**: Many moderate, independent, or ticket-splitting voters
- **Low scores**: Strongly partisan area with few swing voters

### Targeting Strategy
Based on the above scores, each precinct is classified into one of four strategies:
- **Battleground**: Competitive area needing both turnout and persuasion efforts
- **Base Mobilization**: Friendly area where turnout is the priority
- **Persuasion Target**: Area with many persuadable voters
- **Maintenance**: Safe area requiring minimal resources

## Methodology Notes

### Area-Weighted Interpolation
When demographic data is only available at block group level (Census geography), we estimate precinct-level values by calculating what proportion of each precinct overlaps with each block group. This is a standard geographic interpolation technique.

### Weighting
- Recent elections are weighted more heavily than older ones
- Higher-profile races (Presidential, Governor) are weighted more than down-ballot races
- Voter counts are used to weight averages across precincts

## Limitations

1. **Party affiliation is estimated**: We don't have access to actual voter registration data. Party affiliation estimates come from consumer data models.

2. **Precinct boundaries change**: Redistricting can alter precinct boundaries between elections, which may affect historical comparisons.

3. **Turnout varies by election type**: Presidential years have higher turnout than midterms. Our scores account for this but users should consider election type when interpreting results.

4. **Local factors not captured**: Candidate quality, local issues, and campaign spending are not reflected in historical data.

5. **Estimates, not predictions**: These scores describe historical patterns and current demographics. They do not predict future election outcomes.

## Geographic Coverage

- **County**: Ingham County, Michigan
- **Major Cities**: Lansing (state capital), East Lansing (MSU)
- **Townships**: 14 townships including Meridian, Delhi, Alaiedon, etc.
- **Precincts**: 103 voting precincts
