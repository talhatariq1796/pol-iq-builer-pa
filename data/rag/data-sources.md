# Data Sources

This document details every data source used by the Political Landscape Analysis Platform, including the underlying providers that Esri aggregates.

## Primary Data Categories

| Category | Variables | Primary Provider | Original Source |
|----------|-----------|-----------------|-----------------|
| Election Results | Vote totals, margins, turnout | Ingham County Clerk | Official certified results |
| Precinct Boundaries | Geographic polygons | Michigan GIS Open Data | Secretary of State |
| Demographics | Population, income, education | Esri Business Analyst | U.S. Census Bureau ACS |
| Political Attitudes | Party affiliation, outlook | Esri Business Analyst | GfK MRI Survey |
| Lifestyle Segments | Tapestry classification | Esri Business Analyst | Esri proprietary model |
| Media Consumption | TV, radio, digital habits | Esri Business Analyst | GfK MRI + Nielsen |
| Campaign Finance | Individual contributions | FEC API | Federal Election Commission |

---

## Election Data

### Ingham County Clerk (Primary)
- **Website**: https://clerk.ingham.org/
- **Data**: Official certified election results
- **Coverage**: All elections in Ingham County
- **Geography**: Precinct-level vote totals
- **Update**: After each election (certified within 2 weeks)
- **License**: Public record
- **Variables**: Vote counts by candidate, total ballots cast, registered voters

### Michigan Secretary of State
- **Website**: https://mvic.sos.state.mi.us/
- **Data**: Statewide election results, voter registration statistics
- **Coverage**: All Michigan elections
- **License**: Public record

### Elections Available
| Election | Date | Races Included |
|----------|------|----------------|
| 2024 General | Nov 5, 2024 | Presidential, US Senate, US House, State House |
| 2022 General | Nov 8, 2022 | Governor, US Senate, State House |
| 2020 General | Nov 3, 2020 | Presidential, US Senate, US House, State House |

---

## Geographic Boundaries

### Michigan GIS Open Data
- **Website**: https://gis-michigan.opendata.arcgis.com/
- **Data**: Voting precinct boundaries, legislative districts
- **Format**: GeoJSON, Shapefile
- **License**: Public domain
- **Update**: After redistricting (approximately every 10 years)

### U.S. Census Bureau TIGER/Line
- **Website**: https://www.census.gov/geographies/mapping-files.html
- **Data**: Block group boundaries, county boundaries, congressional districts
- **License**: Public domain

---

## Demographic Data

We receive demographic data through **Esri Business Analyst**, which aggregates and models data from these original sources:

### Core Demographics

| Variable | Description | Original Source | Update |
|----------|-------------|-----------------|--------|
| Total Population | Current year estimate | Census Bureau ACS | Annual |
| CVAP | Citizen Voting Age Population | Census Bureau ACS + modeling | Annual |
| Median Age | Area median age | Census Bureau ACS | Annual |
| Median Income | Household median income | Census Bureau ACS | Annual |
| Education Levels | HS, College, Graduate % | Census Bureau ACS | Annual |
| Race/Ethnicity | White, Black, Hispanic, Asian % | Census Bureau ACS | Annual |
| Housing | Owner vs Renter %, Home values | Census Bureau ACS | Annual |

**Source Details**:
- **U.S. Census Bureau American Community Survey (ACS)**
  - 5-year estimates (2019-2023)
  - Sample survey of ~3.5 million households annually
  - Published at block group level (smallest unit)
  - Website: https://data.census.gov/

### Consumer Behavior & Psychographics

| Variable Category | Original Source | Methodology |
|-------------------|-----------------|-------------|
| Political Party Affiliation | GfK MRI Survey | Survey-based, modeled to geographies |
| Political Outlook (Liberal/Moderate/Conservative) | GfK MRI Survey | 5-point scale self-report |
| Political Engagement | GfK MRI Survey | Behavioral questions |
| Tapestry Segmentation | Esri proprietary | Clustering on 60+ variables |

**GfK MRI Survey of the American Consumer**:
- Sample size: ~25,000 adults annually
- Methodology: In-person and online interviews
- Coverage: National, modeled to local geographies by Esri
- Variables: 8,000+ consumer behaviors and attitudes
- Used by: Esri, Nielsen, major political consultants

### Political Attitude Variables

| Variable | Description | Source |
|----------|-------------|--------|
| POLAFFDEM | Democratic Party Affiliation % | GfK MRI Survey |
| POLAFFREP | Republican Party Affiliation % | GfK MRI Survey |
| POLAFFIND | Independent/Unaffiliated % | GfK MRI Survey |
| POLOLKVLIB | Very Liberal Outlook % | GfK MRI Survey |
| POLOLKSLIB | Somewhat Liberal Outlook % | GfK MRI Survey |
| POLOLKMID | Middle of the Road Outlook % | GfK MRI Survey |
| POLOLKSCON | Somewhat Conservative Outlook % | GfK MRI Survey |
| POLOLKVCON | Very Conservative Outlook % | GfK MRI Survey |

### Political Engagement Variables

| Variable | Description | Source |
|----------|-------------|--------|
| POLPODCAST | Listens to Political Podcasts % | GfK MRI Survey |
| POLCONTRIB | Contributed to Political Org % | GfK MRI Survey |
| POLCASHGIFT | Cash Gifts to Political Orgs % | GfK MRI Survey |
| POLWROTECALL | Wrote/Called a Politician % | GfK MRI Survey |
| SMFOLPOL | Follows Politicians on Social Media % | GfK MRI Survey |
| SMFOLPOLGRP | Follows Political Groups on Social Media % | GfK MRI Survey |

### Media Consumption Variables

| Category | Original Source | Notes |
|----------|-----------------|-------|
| TV News Viewership (by network) | GfK MRI + Nielsen | ABC, CBS, NBC, CNN, FOX, MSNBC |
| Print/Newspaper Readership | GfK MRI Survey | Daily, Sunday, local vs national |
| Radio Listening | GfK MRI + Arbitron | Talk radio, NPR, format preferences |
| Online News Consumption | GfK MRI Survey | News sites, streaming, podcasts |
| Social Media Usage | GfK MRI Survey | Platform-specific (Facebook, Twitter, etc.) |

---

## Campaign Finance Data

### Federal Election Commission (FEC)
- **Website**: https://www.fec.gov/
- **API**: https://api.open.fec.gov/
- **Data**: Individual contributions to federal candidates and committees
- **Coverage**: All federal campaign contributions over $200
- **Geography**: By contributor ZIP code
- **Update**: Ongoing (filings processed within days)
- **License**: Public record

**Variables Collected**:
| Field | Description |
|-------|-------------|
| Contributor Name | Individual donor name |
| City, State, ZIP | Contributor location |
| Employer/Occupation | Self-reported |
| Committee ID/Name | Receiving committee |
| Candidate Name/Party | If applicable |
| Amount | Contribution amount |
| Date | Transaction date |
| Transaction Type | Contribution type code |

**Data Coverage**:
- Current: 2023-2024 election cycle
- Committees: ActBlue, WinRed, candidate committees, PACs
- Geography: All ZIP codes in study area

---

## Tapestry Segmentation

### Esri Tapestry Segmentation
- **Source**: Esri proprietary model
- **Methodology**: Statistical clustering on 60+ demographic, socioeconomic, and behavioral variables
- **Segments**: 67 unique lifestyle segments
- **Update**: Annual refresh

**Underlying Data Sources**:
- U.S. Census Bureau (demographics)
- GfK MRI Survey (consumer behavior)
- Experian consumer data (spending patterns)
- U.S. Bureau of Labor Statistics (employment)

---

## Calculated Scores

The following scores are **calculated by our platform** from the source data above:

| Score | Inputs | Methodology |
|-------|--------|-------------|
| Partisan Lean | Election results (2020, 2022, 2024) | Weighted average: 2024 (50%) + 2022 (30%) + 2020 (20%) |
| Swing Potential | Election margin volatility | Standard deviation across elections |
| GOTV Priority | Partisan lean + turnout gap + voter pool | Composite score formula |
| Persuasion Opportunity | Moderate outlook % + margin closeness | Demographic + electoral factors |
| Competitiveness | Partisan lean thresholds | Safe/Likely/Lean/Toss-up classification |

---

## Data Vintage & Update Schedule

| Data Type | Source | Current Vintage | Update Frequency |
|-----------|--------|-----------------|------------------|
| Election Results | Ingham County Clerk | November 2024 | After each election |
| Precinct Boundaries | Michigan GIS | 2024 | After redistricting |
| Demographics (Census) | ACS via Esri BA | 2019-2023 5-year | Annual (September) |
| Demographics (Esri) | Business Analyst | 2025 estimates | Annual |
| Political Attitudes | GfK MRI via Esri | 2024 | Annual |
| Tapestry Segments | Esri | 2025 | Annual |
| Campaign Finance | FEC API | Dec 2023 - Present | Ongoing |

---

## Data Quality Notes

### Margins of Error
- **ACS data**: All survey-based data has margins of error, typically ±5-15% at block group level
- **Political attitudes**: Modeled from national survey to local areas; uncertainty increases for small populations
- **Tapestry**: Statistical model based on dominant characteristics; individual variation within segments

### Processing Notes
- **Precinct-to-Block-Group**: Demographics are interpolated using area-weighted averages (introduces estimation uncertainty)
- **Party Affiliation**: Estimates from consumer surveys, not actual voter registration
- **Campaign Finance**: Limited to contributions over $200 (smaller donors not captured)

---

## Privacy Protections

- No individual voter data is used or displayed
- All data is aggregated at precinct level (typically 500-3,000 voters)
- Campaign finance shows ZIP-level aggregates, not individual donors
- Party affiliation estimates are modeled from consumer data, not voter registration

---

## Source URLs

| Source | URL |
|--------|-----|
| Ingham County Clerk | https://clerk.ingham.org/ |
| Michigan GIS Open Data | https://gis-michigan.opendata.arcgis.com/ |
| U.S. Census Bureau | https://data.census.gov/ |
| Census TIGER/Line | https://www.census.gov/geographies/mapping-files.html |
| Esri Business Analyst | https://www.esri.com/en-us/arcgis/products/arcgis-business-analyst |
| Federal Election Commission | https://www.fec.gov/ |
| FEC API | https://api.open.fec.gov/ |
| GfK MRI | https://www.gfk.com/products/mri-simmons |

---

## Licensing

| Source | License Type | Cost | Restrictions |
|--------|-------------|------|--------------|
| U.S. Census Bureau | Public domain | Free | None |
| Michigan GIS Open Data | Open data | Free | Attribution |
| Ingham County Clerk | Public record | Free | None |
| Esri Business Analyst | Commercial | Subscription | Terms of use |
| Federal Election Commission | Public record | Free | None |
