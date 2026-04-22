export type PropertyCategory = 'residential' | 'revenue';

type PropertyRecord = {
  properties?: any;
  propertyCategory?: string;
  property_category?: string;
  sourcePropertyType?: string;
  property_type?: string;
  pt?: string;
  [key: string]: any;
};

export function filterPropertiesByType<T extends PropertyRecord>(
  records: T[],
  selectedPropertyTypes: string[],
  allowedCategory?: PropertyCategory,
): T[] {
  const selected = new Set(selectedPropertyTypes.map((type) => type.toLowerCase()));

  return records.filter((record) => {
    if (allowedCategory && getPropertyCategory(record) !== allowedCategory) {
      return false;
    }

    if (selected.size === 0) {
      return true;
    }

    const type = getPropertyType(record);
    return selected.has(type);
  });
}

function getPropertyCategory(record: PropertyRecord): PropertyCategory {
  const rawCategory =
    record.propertyCategory ??
    record.property_category ??
    record.properties?.propertyCategory ??
    record.properties?.property_category;

  return String(rawCategory).toLowerCase() === 'revenue' ? 'revenue' : 'residential';
}

function getPropertyType(record: PropertyRecord): string {
  const rawType =
    record.sourcePropertyType ??
    record.property_type ??
    record.pt ??
    record.properties?.sourcePropertyType ??
    record.properties?.property_type ??
    record.properties?.pt ??
    '';

  const normalized = String(rawType).toLowerCase();
  if (normalized.includes('condo') || normalized.includes('apartment')) return 'condo';
  if (normalized.includes('revenue') || normalized.includes('multi')) return 'commercial';
  if (normalized.includes('duplex')) return 'duplex';
  if (normalized.includes('town')) return 'townhouse';
  return normalized || 'house';
}
