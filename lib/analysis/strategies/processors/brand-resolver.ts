export interface BrandField {
  fieldName?: string;
  value?: number;
  brandName?: string;
  isTarget?: boolean;
  metricName?: string;
}

// Use 'unknown' for record shapes to avoid wide 'any' lint complaints.
export interface BrandResolver {
  // Return detected brand-like fields from a record
  detectBrandFields(record: unknown): BrandField[];

  // Optional helper to return a configured target brand name
  getTargetBrandName?(): string;

  // Optional helper to calculate a market gap or completeness metric for a record
  calculateMarketGap?(record: unknown): number;

  // Optional helper to return competitor brand fields
  getCompetitorBrands?(record: unknown): BrandField[];

  // Optional helper to resolve affinity or other brand metrics
  resolveAffinity?(record: unknown, brand?: string): number | null;
}

export default BrandResolver;
