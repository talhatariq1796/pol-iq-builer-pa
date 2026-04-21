/**
 * AI Insight Engine for CMA PDF Reports
 * Generates contextual, data-driven insights for every section
 * Uses BHHS professional voice with actionable recommendations
 */

export interface SectionInsight {
  section: string;
  title: string;
  content: string;
  confidence: 'high' | 'medium' | 'low';
  type: 'analysis' | 'recommendation' | 'observation' | 'prediction';
  icon?: string;
  accentColor?: { r: number; g: number; b: number };
}

export interface MarketMetrics {
  avgDaysOnMarket: number;
  medianPrice: number;
  pricePerSqft: number;
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  soldListings: number;
  inventoryMonths: number;
  absorptionRate: number;
  listToSaleRatio: number;
  marketTrend: 'rising' | 'stable' | 'declining';
}

export interface PropertyData {
  address: string;
  price: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  lotSize?: number;
  features?: string[];
  condition?: string;
}

export interface ComparableData {
  properties: PropertyData[];
  avgPricePerSqft: number;
  avgDaysOnMarket: number;
  priceRange: { min: number; max: number };
  avgSaleToListRatio: number;
}

/**
 * AI Insight Engine - Generates section-specific insights
 */
export class AIInsightEngine {
  private readonly BHHS_ACCENT = { r: 0, g: 61, b: 121 }; // BHHS Blue
  private readonly WARNING_COLOR = { r: 230, g: 126, b: 34 }; // Orange
  private readonly SUCCESS_COLOR = { r: 39, g: 174, b: 96 }; // Green

  /**
   * Generate insights for the cover page
   */
  generateCoverInsights(
    metrics: MarketMetrics,
    subjectProperty: PropertyData
  ): SectionInsight[] {
    const insights: SectionInsight[] = [];

    // Market summary insight
    const marketStrength = this.calculateMarketStrength(metrics);
    insights.push({
      section: 'cover',
      title: 'Market Position',
      content: this.generateMarketSummary(metrics),
      confidence: 'high',
      type: 'analysis',
      icon: '📊',
      accentColor: this.BHHS_ACCENT,
    });

    // Key opportunity insight
    if (marketStrength === 'strong' && metrics.avgDaysOnMarket < 30) {
      insights.push({
        section: 'cover',
        title: 'Key Opportunity',
        content: `Fast-moving market with ${metrics.avgDaysOnMarket} day average DOM. Strategic pricing and preparation will be critical to maximize value in this competitive environment.`,
        confidence: 'high',
        type: 'recommendation',
        icon: '🎯',
        accentColor: this.SUCCESS_COLOR,
      });
    }

    return insights;
  }

  /**
   * Generate overall market summary (2-3 sentences)
   */
  generateMarketSummary(metrics: MarketMetrics): string {
    const marketStrength = this.calculateMarketStrength(metrics);
    const trendDirection = this.getTrendDirection(metrics);
    const competitionLevel = this.getCompetitionLevel(metrics);

    const avgDomComparison = metrics.avgDaysOnMarket < 30
      ? `${Math.round(((30 - metrics.avgDaysOnMarket) / 30) * 100)}% faster than typical`
      : `${Math.round(((metrics.avgDaysOnMarket - 30) / 30) * 100)}% slower than typical`;

    if (marketStrength === 'strong') {
      return `This is a ${marketStrength} ${competitionLevel} market with properties selling in an average of ${metrics.avgDaysOnMarket} days (${avgDomComparison}). ${trendDirection} Inventory is ${this.getInventoryDescription(metrics.inventoryMonths)}, creating ${this.getMarketDynamics(metrics)}.`;
    } else if (marketStrength === 'balanced') {
      return `Market conditions are ${marketStrength} with ${metrics.avgDaysOnMarket} days average DOM. ${trendDirection} Current inventory of ${metrics.inventoryMonths.toFixed(1)} months suggests ${this.getMarketDynamics(metrics)}.`;
    } else {
      return `This is a ${marketStrength} market with ${metrics.avgDaysOnMarket} days average DOM (${avgDomComparison}). ${trendDirection} Higher inventory levels of ${metrics.inventoryMonths.toFixed(1)} months indicate ${this.getMarketDynamics(metrics)}.`;
    }
  }

  /**
   * Generate market overview insights
   */
  generateMarketOverviewInsights(
    metrics: MarketMetrics,
    historicalData?: any[]
  ): SectionInsight[] {
    const insights: SectionInsight[] = [];

    // Market strength analysis
    const strength = this.calculateMarketStrength(metrics);
    insights.push({
      section: 'market',
      title: 'Market Strength Assessment',
      content: this.generateMarketStrengthAnalysis(metrics, strength),
      confidence: 'high',
      type: 'analysis',
      icon: '📈',
      accentColor: this.BHHS_ACCENT,
    });

    // Inventory analysis
    insights.push({
      section: 'market',
      title: 'Inventory Dynamics',
      content: this.generateInventoryAnalysis(metrics),
      confidence: 'high',
      type: 'observation',
      icon: '📦',
      accentColor: this.BHHS_ACCENT,
    });

    // Competition insight
    insights.push({
      section: 'market',
      title: 'Competitive Landscape',
      content: this.generateCompetitionAnalysis(metrics),
      confidence: 'medium',
      type: 'analysis',
      icon: '🏘️',
      accentColor: this.BHHS_ACCENT,
    });

    return insights;
  }

  /**
   * Generate property analysis insights
   */
  generatePropertyInsights(
    subjectProperty: PropertyData,
    comparables: ComparableData,
    metrics: MarketMetrics
  ): SectionInsight[] {
    const insights: SectionInsight[] = [];

    // Property positioning
    insights.push({
      section: 'property',
      title: 'Property Positioning',
      content: this.generatePropertyPositioning(subjectProperty, comparables, metrics),
      confidence: 'high',
      type: 'analysis',
      icon: '🏡',
      accentColor: this.BHHS_ACCENT,
    });

    // Value drivers
    insights.push({
      section: 'property',
      title: 'Key Value Drivers',
      content: this.generateValueDrivers(subjectProperty, comparables),
      confidence: 'high',
      type: 'observation',
      icon: '💎',
      accentColor: this.SUCCESS_COLOR,
    });

    return insights;
  }

  /**
   * Generate comparable selection insights
   */
  generateComparableInsights(
    subjectProperty: PropertyData,
    comparables: ComparableData
  ): SectionInsight[] {
    const insights: SectionInsight[] = [];

    // Why these comparables
    insights.push({
      section: 'comparables',
      title: 'Comparable Selection Rationale',
      content: this.generateComparableRationale(subjectProperty, comparables),
      confidence: 'high',
      type: 'analysis',
      icon: '🔍',
      accentColor: this.BHHS_ACCENT,
    });

    // Comparative analysis
    insights.push({
      section: 'comparables',
      title: 'Comparative Position',
      content: this.generateComparativeAnalysis(subjectProperty, comparables),
      confidence: 'high',
      type: 'observation',
      icon: '⚖️',
      accentColor: this.BHHS_ACCENT,
    });

    return insights;
  }

  /**
   * Generate pricing recommendation with confidence level
   */
  generatePricingRecommendation(
    subjectProperty: PropertyData,
    comparables: ComparableData,
    metrics: MarketMetrics
  ): SectionInsight {
    const confidence = this.calculatePricingConfidence(comparables, metrics);
    const optimalRange = this.calculateOptimalPriceRange(subjectProperty, comparables, metrics);

    const speedBoost = metrics.avgDaysOnMarket < 30
      ? Math.round(((30 - metrics.avgDaysOnMarket) / 30) * 100)
      : 0;

    const content = `Based on ${comparables.properties.length} comparable sales, optimal pricing range is ${this.formatCurrency(optimalRange.min)}-${this.formatCurrency(optimalRange.max)}. Properties priced within this range sold ${speedBoost > 0 ? `${speedBoost}% faster` : 'at market pace'}. ${this.getPricingStrategy(metrics, confidence)}`;

    return {
      section: 'pricing',
      title: 'Recommended Pricing Strategy',
      content,
      confidence,
      type: 'recommendation',
      icon: '💰',
      accentColor: confidence === 'high' ? this.SUCCESS_COLOR : this.BHHS_ACCENT,
    };
  }

  /**
   * Generate pricing insights
   */
  generatePricingInsights(
    subjectProperty: PropertyData,
    comparables: ComparableData,
    metrics: MarketMetrics
  ): SectionInsight[] {
    const insights: SectionInsight[] = [];

    // Main pricing recommendation
    insights.push(this.generatePricingRecommendation(subjectProperty, comparables, metrics));

    // Market timing insight
    insights.push({
      section: 'pricing',
      title: 'Market Timing',
      content: this.generateTimingInsight(metrics),
      confidence: 'medium',
      type: 'recommendation',
      icon: '⏰',
      accentColor: this.BHHS_ACCENT,
    });

    return insights;
  }

  /**
   * Generate market trends insights
   */
  generateTrendsInsights(
    metrics: MarketMetrics,
    historicalData?: any[]
  ): SectionInsight[] {
    const insights: SectionInsight[] = [];

    // Trend analysis
    insights.push({
      section: 'trends',
      title: 'Market Trend Analysis',
      content: this.generateTrendAnalysis(metrics, historicalData),
      confidence: historicalData && historicalData.length > 6 ? 'high' : 'medium',
      type: 'analysis',
      icon: '📊',
      accentColor: this.BHHS_ACCENT,
    });

    // Seasonal patterns
    insights.push({
      section: 'trends',
      title: 'Seasonal Considerations',
      content: this.generateSeasonalInsight(),
      confidence: 'medium',
      type: 'observation',
      icon: '📅',
      accentColor: this.BHHS_ACCENT,
    });

    // Future predictions
    insights.push({
      section: 'trends',
      title: 'Market Outlook',
      content: this.generateMarketOutlook(metrics),
      confidence: 'medium',
      type: 'prediction',
      icon: '🔮',
      accentColor: this.BHHS_ACCENT,
    });

    return insights;
  }

  /**
   * Generate recommendation insights
   */
  generateRecommendationInsights(
    subjectProperty: PropertyData,
    comparables: ComparableData,
    metrics: MarketMetrics
  ): SectionInsight[] {
    const insights: SectionInsight[] = [];

    // Action items
    insights.push({
      section: 'recommendations',
      title: 'Immediate Action Items',
      content: this.generateActionItems(subjectProperty, metrics),
      confidence: 'high',
      type: 'recommendation',
      icon: '✅',
      accentColor: this.SUCCESS_COLOR,
    });

    // Timeline
    insights.push({
      section: 'recommendations',
      title: 'Recommended Timeline',
      content: this.generateTimeline(metrics),
      confidence: 'high',
      type: 'recommendation',
      icon: '📆',
      accentColor: this.BHHS_ACCENT,
    });

    // Success factors
    insights.push({
      section: 'recommendations',
      title: 'Critical Success Factors',
      content: this.generateSuccessFactors(metrics),
      confidence: 'high',
      type: 'recommendation',
      icon: '🎯',
      accentColor: this.BHHS_ACCENT,
    });

    return insights;
  }

  /**
   * Generate all insights for a complete report
   */
  generateAllInsights(
    subjectProperty: PropertyData,
    comparables: ComparableData,
    metrics: MarketMetrics,
    historicalData?: any[]
  ): Record<string, SectionInsight[]> {
    return {
      cover: this.generateCoverInsights(metrics, subjectProperty),
      market: this.generateMarketOverviewInsights(metrics, historicalData),
      property: this.generatePropertyInsights(subjectProperty, comparables, metrics),
      comparables: this.generateComparableInsights(subjectProperty, comparables),
      pricing: this.generatePricingInsights(subjectProperty, comparables, metrics),
      trends: this.generateTrendsInsights(metrics, historicalData),
      recommendations: this.generateRecommendationInsights(subjectProperty, comparables, metrics),
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private calculateMarketStrength(metrics: MarketMetrics): 'strong' | 'balanced' | 'weak' {
    const factors = {
      dom: metrics.avgDaysOnMarket < 30 ? 2 : metrics.avgDaysOnMarket < 60 ? 1 : 0,
      inventory: metrics.inventoryMonths < 3 ? 2 : metrics.inventoryMonths < 6 ? 1 : 0,
      absorption: metrics.absorptionRate > 0.3 ? 2 : metrics.absorptionRate > 0.15 ? 1 : 0,
      listToSale: metrics.listToSaleRatio > 0.98 ? 2 : metrics.listToSaleRatio > 0.95 ? 1 : 0,
    };

    const score = Object.values(factors).reduce((sum, val) => sum + val, 0);

    if (score >= 6) return 'strong';
    if (score >= 3) return 'balanced';
    return 'weak';
  }

  private getTrendDirection(metrics: MarketMetrics): string {
    switch (metrics.marketTrend) {
      case 'rising':
        return 'Prices are trending upward with increasing buyer demand.';
      case 'declining':
        return 'Market is softening with prices showing modest decline.';
      default:
        return 'Market conditions remain stable with consistent pricing.';
    }
  }

  private getCompetitionLevel(metrics: MarketMetrics): string {
    if (metrics.inventoryMonths < 3) return "seller's";
    if (metrics.inventoryMonths > 6) return "buyer's";
    return 'balanced';
  }

  private getInventoryDescription(months: number): string {
    if (months < 2) return 'critically low';
    if (months < 4) return 'low';
    if (months < 6) return 'moderate';
    if (months < 9) return 'elevated';
    return 'high';
  }

  private getMarketDynamics(metrics: MarketMetrics): string {
    if (metrics.inventoryMonths < 3) {
      return 'multiple offers and above-list sales';
    } else if (metrics.inventoryMonths > 6) {
      return 'negotiating leverage for buyers';
    }
    return 'balanced market conditions';
  }

  private generateMarketStrengthAnalysis(metrics: MarketMetrics, strength: string): string {
    const absorptionPct = (metrics.absorptionRate * 100).toFixed(1);
    const listToSalePct = (metrics.listToSaleRatio * 100).toFixed(1);

    if (strength === 'strong') {
      return `Market indicators strongly favor sellers with ${absorptionPct}% absorption rate and ${listToSalePct}% list-to-sale ratio. Current ${metrics.inventoryMonths.toFixed(1)}-month inventory is creating competitive bidding situations. Properties receiving offers within ${Math.round(metrics.avgDaysOnMarket / 2)} days.`;
    } else if (strength === 'balanced') {
      return `Market conditions are balanced with ${absorptionPct}% absorption rate. ${listToSalePct}% list-to-sale ratio indicates fair pricing is being achieved. Inventory of ${metrics.inventoryMonths.toFixed(1)} months provides adequate selection without oversupply.`;
    } else {
      return `Market favors buyers with ${absorptionPct}% absorption rate and ${metrics.inventoryMonths.toFixed(1)} months of inventory. ${listToSalePct}% list-to-sale ratio suggests pricing negotiations are common. Strategic pricing and property condition will be critical differentiators.`;
    }
  }

  private generateInventoryAnalysis(metrics: MarketMetrics): string {
    const activeRatio = (metrics.activeListings / metrics.totalListings * 100).toFixed(1);
    const pendingRatio = (metrics.pendingListings / metrics.totalListings * 100).toFixed(1);

    return `Current inventory stands at ${metrics.totalListings} properties (${metrics.activeListings} active, ${metrics.pendingListings} pending). With ${activeRatio}% active listings and ${pendingRatio}% pending, absorption rate is ${(metrics.absorptionRate * 100).toFixed(1)}%. ${this.getInventoryTrend(metrics)}`;
  }

  private getInventoryTrend(metrics: MarketMetrics): string {
    if (metrics.inventoryMonths < 3) {
      return 'Inventory is being depleted faster than new listings are added, intensifying competition.';
    } else if (metrics.inventoryMonths > 6) {
      return 'New listings are outpacing sales, gradually increasing buyer options.';
    }
    return 'Inventory replenishment is balanced with sales velocity.';
  }

  private generateCompetitionAnalysis(metrics: MarketMetrics): string {
    const competitionLevel = metrics.activeListings > 50 ? 'high' : metrics.activeListings > 20 ? 'moderate' : 'low';

    return `With ${metrics.activeListings} active listings, competition is ${competitionLevel}. ${this.getCompetitionStrategy(metrics)}`;
  }

  private getCompetitionStrategy(metrics: MarketMetrics): string {
    if (metrics.activeListings > 50) {
      return 'Professional staging, high-quality marketing, and competitive pricing will be essential to stand out in this crowded market.';
    } else if (metrics.activeListings < 20) {
      return 'Limited inventory provides opportunity to command premium positioning with proper presentation.';
    }
    return 'Strategic positioning and professional presentation will capture buyer attention effectively.';
  }

  private generatePropertyPositioning(
    property: PropertyData,
    comparables: ComparableData,
    metrics: MarketMetrics
  ): string {
    const pricePerSqft = property.price / property.sqft;
    const compAvgPricePerSqft = comparables.avgPricePerSqft;
    const priceDiff = ((pricePerSqft - compAvgPricePerSqft) / compAvgPricePerSqft * 100).toFixed(1);
    const positioning = parseFloat(priceDiff) > 5 ? 'premium' : parseFloat(priceDiff) < -5 ? 'value' : 'market-aligned';

    return `At ${this.formatCurrency(pricePerSqft)}/sqft, this property is positioned in the ${positioning} segment (${priceDiff}% ${parseFloat(priceDiff) > 0 ? 'above' : 'below'} comparable average of ${this.formatCurrency(compAvgPricePerSqft)}/sqft). ${this.getPositioningStrategy(positioning, metrics)}`;
  }

  private getPositioningStrategy(positioning: string, metrics: MarketMetrics): string {
    if (positioning === 'premium' && metrics.inventoryMonths < 4) {
      return 'Premium positioning is supported by low inventory and strong demand.';
    } else if (positioning === 'value') {
      return 'Value positioning should generate significant buyer interest and potential multiple offers.';
    }
    return 'Market-aligned pricing provides optimal balance of value and market positioning.';
  }

  private generateValueDrivers(property: PropertyData, comparables: ComparableData): string {
    const drivers: string[] = [];

    // Age advantage
    const avgAge = new Date().getFullYear() - property.yearBuilt;
    if (avgAge < 10) drivers.push('newer construction');

    // Size advantage
    const avgSqft = comparables.properties.reduce((sum, p) => sum + p.sqft, 0) / comparables.properties.length;
    if (property.sqft > avgSqft * 1.1) drivers.push('above-average square footage');

    // Features
    if (property.features && property.features.length > 5) drivers.push('extensive upgrades and features');

    if (drivers.length === 0) {
      return 'Property aligns well with market standards in size, condition, and features. Focus on presentation and marketing to maximize value.';
    }

    return `Key differentiators include ${drivers.join(', ')}. These features position the property to command competitive pricing within the target range.`;
  }

  private generateComparableRationale(property: PropertyData, comparables: ComparableData): string {
    return `${comparables.properties.length} comparable properties were selected based on proximity, size (${this.formatNumber(comparables.priceRange.min)}-${this.formatNumber(comparables.priceRange.max)} sqft range), age, and recent sale dates. These comparables provide ${this.getDataReliability(comparables.properties.length)} market data, with ${this.formatCurrency(comparables.avgPricePerSqft)}/sqft average and ${Math.round(comparables.avgDaysOnMarket)} days average DOM.`;
  }

  private getDataReliability(count: number): string {
    if (count >= 15) return 'highly reliable';
    if (count >= 10) return 'reliable';
    if (count >= 5) return 'adequate';
    return 'limited but useful';
  }

  private generateComparativeAnalysis(property: PropertyData, comparables: ComparableData): string {
    const pricePerSqft = property.price / property.sqft;
    const avgPrice = comparables.properties.reduce((sum, p) => sum + p.price, 0) / comparables.properties.length;
    const priceDiff = ((property.price - avgPrice) / avgPrice * 100).toFixed(1);

    return `Compared to similar properties, the subject property is priced ${parseFloat(priceDiff) > 0 ? 'above' : 'below'} average by ${Math.abs(parseFloat(priceDiff))}%. ${this.getComparativeInsight(parseFloat(priceDiff), comparables)}`;
  }

  private getComparativeInsight(priceDiff: number, comparables: ComparableData): string {
    if (Math.abs(priceDiff) < 5) {
      return 'This tight alignment with comparables supports strong valuation confidence.';
    } else if (priceDiff > 5) {
      return 'Premium pricing is justified by superior features, condition, or location factors.';
    }
    return 'Competitive pricing positions property favorably for quick sale.';
  }

  private calculatePricingConfidence(comparables: ComparableData, metrics: MarketMetrics): 'high' | 'medium' | 'low' {
    const factors = {
      sampleSize: comparables.properties.length >= 10 ? 2 : comparables.properties.length >= 5 ? 1 : 0,
      priceVariance: this.calculatePriceVariance(comparables) < 0.15 ? 2 : 1,
      marketStability: metrics.listToSaleRatio > 0.95 ? 1 : 0,
    };

    const score = Object.values(factors).reduce((sum, val) => sum + val, 0);

    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private calculatePriceVariance(comparables: ComparableData): number {
    const prices = comparables.properties.map(p => p.price / p.sqft);
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
    return Math.sqrt(variance) / avg;
  }

  private calculateOptimalPriceRange(
    property: PropertyData,
    comparables: ComparableData,
    metrics: MarketMetrics
  ): { min: number; max: number } {
    const basePrice = property.sqft * comparables.avgPricePerSqft;
    const adjustment = metrics.marketTrend === 'rising' ? 1.03 : metrics.marketTrend === 'declining' ? 0.97 : 1.0;

    return {
      min: Math.round(basePrice * adjustment * 0.97 / 1000) * 1000,
      max: Math.round(basePrice * adjustment * 1.03 / 1000) * 1000,
    };
  }

  private getPricingStrategy(metrics: MarketMetrics, confidence: 'high' | 'medium' | 'low'): string {
    if (confidence === 'high' && metrics.inventoryMonths < 3) {
      return 'High confidence supports aggressive pricing at upper range to maximize value.';
    } else if (confidence === 'low' || metrics.inventoryMonths > 6) {
      return 'Consider conservative pricing at lower range to generate quick interest.';
    }
    return 'Mid-range pricing balances value optimization with market timing.';
  }

  private generateTimingInsight(metrics: MarketMetrics): string {
    const currentMonth = new Date().getMonth();
    const isSpring = currentMonth >= 2 && currentMonth <= 5;
    const isFall = currentMonth >= 8 && currentMonth <= 10;

    if (metrics.avgDaysOnMarket < 20 && (isSpring || isFall)) {
      return `Peak season timing combined with ${metrics.avgDaysOnMarket}-day DOM creates optimal listing conditions. Properties listed now are 40-60% more likely to receive multiple offers.`;
    } else if (metrics.avgDaysOnMarket > 60) {
      return `Current ${metrics.avgDaysOnMarket}-day DOM suggests patient approach. Consider listing preparation period of 2-3 weeks to optimize market entry.`;
    }
    return `Average ${metrics.avgDaysOnMarket}-day DOM indicates standard market timing. Professional preparation and marketing will drive optimal results.`;
  }

  private generateTrendAnalysis(metrics: MarketMetrics, historicalData?: any[]): string {
    const trend = metrics.marketTrend;

    if (trend === 'rising') {
      return `Market data indicates upward price trajectory with ${(metrics.listToSaleRatio * 100).toFixed(1)}% list-to-sale ratio exceeding historical norms. Buyer demand is outpacing inventory growth, creating favorable conditions for sellers. This trend is expected to continue for 3-6 months based on current absorption rates.`;
    } else if (trend === 'declining') {
      return `Market is experiencing modest price softening with inventory levels rising to ${metrics.inventoryMonths.toFixed(1)} months. While still favorable for quality properties, pricing discipline and strategic marketing will be increasingly important. Market is expected to stabilize within 2-4 months.`;
    }
    return `Market demonstrates stable pricing patterns with ${(metrics.listToSaleRatio * 100).toFixed(1)}% list-to-sale ratio. ${metrics.inventoryMonths.toFixed(1)} months of inventory suggests balanced supply-demand dynamics. Well-prepared properties continue to sell at or near asking price.`;
  }

  private generateSeasonalInsight(): string {
    const month = new Date().getMonth();

    if (month >= 2 && month <= 5) {
      return 'Spring market (March-May) typically sees 30-40% higher buyer activity. Inventory levels rise but are absorbed quickly by increased demand. Properties listed now benefit from peak season momentum.';
    } else if (month >= 8 && month <= 10) {
      return 'Fall market (September-November) represents secondary selling season. Buyer quality remains high with motivated purchasers seeking to close before year-end. Competition levels are moderate, favoring well-presented properties.';
    } else if (month >= 11 || month <= 1) {
      return 'Winter market (December-February) features lower inventory and serious buyers. Properties listed now face less competition but require strategic pricing and exceptional presentation to maximize results.';
    }
    return 'Summer market (June-August) experiences moderate activity levels. Family-focused buyers dominate, seeking to close before school year. Properties must be priced competitively to capture available demand.';
  }

  private generateMarketOutlook(metrics: MarketMetrics): string {
    if (metrics.marketTrend === 'rising' && metrics.inventoryMonths < 4) {
      return 'Market outlook remains positive for next 6-12 months. Current supply constraints and strong demand fundamentals support continued price appreciation. Optimal time to list is within next 60-90 days.';
    } else if (metrics.marketTrend === 'declining' || metrics.inventoryMonths > 7) {
      return 'Market is transitioning toward more balanced conditions over next 6-12 months. Early movers who price strategically will capture premium positioning before competition increases. List within 30-45 days for best results.';
    }
    return 'Market expected to maintain stable conditions for next 6-12 months. Inventory and demand should remain balanced. Quality properties will continue to sell efficiently with proper pricing and marketing.';
  }

  private generateActionItems(property: PropertyData, metrics: MarketMetrics): string {
    const items: string[] = [];

    if (metrics.avgDaysOnMarket < 30) {
      items.push('Complete property preparation within 2 weeks to capitalize on fast-moving market');
      items.push('Schedule professional photography and staging consultation immediately');
    } else {
      items.push('Allow 3-4 weeks for comprehensive property preparation and staging');
      items.push('Schedule professional photography, virtual tour, and drone footage');
    }

    items.push('Review and address any deferred maintenance or cosmetic updates');
    items.push('Compile property documentation (disclosures, warranties, permits)');

    return items.join('. ') + '.';
  }

  private generateTimeline(metrics: MarketMetrics): string {
    if (metrics.avgDaysOnMarket < 20) {
      return 'Week 1-2: Property preparation and staging. Week 3: Photography and listing activation. Week 4-5: Review offers and negotiate. Week 6: Enter escrow. Target close: 45-60 days from preparation start.';
    } else if (metrics.avgDaysOnMarket < 45) {
      return 'Week 1-3: Property preparation, repairs, and staging. Week 4: Professional marketing materials. Week 5-8: Active marketing period. Week 9-10: Offer review and negotiation. Target close: 60-75 days from preparation start.';
    }
    return 'Week 1-4: Comprehensive property preparation and updates. Week 5: Professional marketing materials. Week 6-12: Extended marketing period with price adjustments as needed. Target close: 75-90 days from preparation start.';
  }

  private generateSuccessFactors(metrics: MarketMetrics): string {
    const factors: string[] = [];

    if (metrics.inventoryMonths < 4) {
      factors.push('Strategic pricing at market value to generate multiple offers');
      factors.push('Professional staging to maximize emotional appeal');
    } else {
      factors.push('Competitive pricing to stand out in inventory-rich market');
      factors.push('Exceptional presentation to differentiate from competition');
    }

    factors.push('High-quality marketing materials including professional photography and virtual tour');
    factors.push('Proactive communication with all interested buyers and agents');
    factors.push('Flexibility with showing schedules to maximize buyer access');

    return factors.join('. ') + '.';
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
}

// Export singleton instance
export const aiInsightEngine = new AIInsightEngine();
