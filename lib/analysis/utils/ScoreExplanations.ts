/**
 * ScoreExplanations - Plain-language explanations for analysis scores
 * 
 * Provides user-friendly explanations of how different analysis scores
 * are calculated, avoiding technical formulas in favor of clear language.
 */

export interface ScoreExplanation {
  title: string;
  whatItMeasures: string;
  howCalculated: string[];
  whyItMatters: string;
  scoreRanges?: Array<{
    range: string;
    meaning: string;
  }>;
}

export const SCORE_EXPLANATIONS: Record<string, ScoreExplanation> = {
  competitive_advantage: {
    title: "🏆 Understanding Competitive Advantage Scores (1-10 scale)",
    whatItMeasures: "How well-positioned Nike is to succeed in each market compared to competitors, especially Adidas. Higher scores indicate markets where Nike has the strongest advantages for growth and expansion.",
    howCalculated: [
      "**Market Position (worth up to 4 points):** How much stronger Nike's market share is compared to Adidas, plus how well Nike's brand characteristics match what drives success in that area",
      "**Market Fit (worth up to 3.5 points):** How well the local demographics align with Nike's core customer base - people aged 16-35 with household incomes between $35K-$150K tend to be Nike's strongest markets", 
      "**Competitive Environment (worth up to 2.5 points):** How fragmented the market is and whether there's room for Nike to grow without intense competition"
    ],
    whyItMatters: "Markets with scores of 7+ are prime expansion targets, while scores below 4 suggest either strong competition or poor demographic fit.",
    scoreRanges: [
      { range: "8.0-10.0", meaning: "Exceptional opportunity - ideal for major investment" },
      { range: "6.0-7.9", meaning: "Strong opportunity - good expansion targets" },
      { range: "4.0-5.9", meaning: "Moderate opportunity - consider with caution" },
      { range: "1.0-3.9", meaning: "Limited opportunity - focus elsewhere" }
    ]
  },

  strategic_value: {
    title: "🎯 Understanding Strategic Value Scores (0-100 scale)",
    whatItMeasures: "How strategically important each market is for Nike's long-term growth, considering market size, growth potential, and strategic positioning opportunities.",
    howCalculated: [
      "**Market Size & Growth (40% weight):** Population size, income levels, and economic growth indicators that suggest market potential",
      "**Demographic Alignment (30% weight):** How well the local population matches Nike's target customer profile and brand positioning",
      "**Strategic Positioning (20% weight):** Competitive landscape, market maturity, and opportunities for Nike to establish market leadership",
      "**Market Access (10% weight):** Infrastructure, distribution channels, and operational feasibility for Nike expansion"
    ],
    whyItMatters: "High strategic value markets (70+) represent the best long-term investment opportunities, while lower scores suggest markets that may not align with Nike's strategic priorities.",
    scoreRanges: [
      { range: "80-100", meaning: "Highest strategic priority - critical for growth strategy" },
      { range: "60-79", meaning: "High strategic value - strong investment case" },
      { range: "40-59", meaning: "Moderate strategic value - selective investment" },
      { range: "0-39", meaning: "Low strategic priority - limited investment" }
    ]
  },

  demographic_opportunity: {
    title: "👥 Understanding Demographic Opportunity Scores (0-100 scale)",
    whatItMeasures: "How well each market's population characteristics align with Nike's ideal customer base and brand positioning.",
    howCalculated: [
      "**Age Demographics (35% weight):** Concentration of Nike's core age groups (16-35 primary, 36-50 secondary)",
      "**Income Alignment (30% weight):** Household income distribution matching Nike's sweet spot ($35K-$150K)",
      "**Lifestyle Factors (25% weight):** Activity levels, sports participation, and fitness culture indicators",
      "**Brand Affinity (10% weight):** Existing brand awareness and preference indicators in similar demographics"
    ],
    whyItMatters: "Markets with scores above 80 have demographics that naturally align with Nike's brand, while scores below 40 may require different marketing approaches or product positioning."
  },

  trend_strength: {
    title: "📈 Understanding Trend Strength Scores (0-100 scale)",
    whatItMeasures: "How strong the positive market trends are in each area, indicating momentum for Nike's business growth.",
    howCalculated: [
      "**Economic Trends (40% weight):** Income growth, employment trends, and economic indicators showing market momentum",
      "**Demographic Trends (30% weight):** Population growth, age distribution changes, and migration patterns",
      "**Market Trends (20% weight):** Sports participation, fitness culture growth, and athletic wear adoption",
      "**Infrastructure Trends (10% weight):** Retail development, digital connectivity, and market accessibility improvements"
    ],
    whyItMatters: "High trend strength (60+) indicates markets with positive momentum where Nike can ride the wave of growth, while low scores suggest stagnant or declining conditions."
  }
};

/**
 * Generate a plain-language score explanation for analysis summaries
 */
export function generateScoreExplanation(scoreType: string, customTitle?: string): string {
  const explanation = SCORE_EXPLANATIONS[scoreType];
  if (!explanation) {
    return `**${customTitle || 'Analysis Scores'}:** This analysis uses calculated scores to rank and compare different markets based on multiple factors.`;
  }

  let summary = `**${explanation.title}**

**What This Score Measures:** ${explanation.whatItMeasures}

**How We Calculate It:** The score combines several key factors:
${explanation.howCalculated.map(factor => `• ${factor}`).join('\n')}

**Why This Matters:** ${explanation.whyItMatters}`;

  if (explanation.scoreRanges) {
    summary += `

**Score Interpretation:**
${explanation.scoreRanges.map(range => `• **${range.range}:** ${range.meaning}`).join('\n')}`;
  }

  return summary + '\n\n';
}

/**
 * Get score explanation for any analysis type
 */
export function getScoreExplanationForAnalysis(analysisType: string, scoreField: string): string {
  // Map analysis types to score explanations
  const typeMapping: Record<string, string> = {
    'competitive_analysis': 'competitive_advantage',
    'analyze': 'strategic_value',
    'demographic_insights': 'demographic_opportunity',
    'trend_analysis': 'trend_strength'
  };

  const scoreType = typeMapping[analysisType] || 'strategic_value';
  return generateScoreExplanation(scoreType);
}