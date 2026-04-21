
export function getRelevantFields(attributes: Record<string, any>, query: string): string[] {
  if (!attributes || !query) {
    return [];
  }

  const availableFields = Object.keys(attributes);
  const queryLower = query.toLowerCase();

  // Check for demographic-related fields
  if (queryLower.includes('demographic') ||
    queryLower.includes('population') ||
    queryLower.includes('income') ||
    queryLower.includes('age') ||
    queryLower.includes('education')) {
    const demographicFields = availableFields.filter(field => {
      const fieldLower = field.toLowerCase();
      return (
        fieldLower.includes('pop') ||
        fieldLower.includes('income') ||
        fieldLower.includes('age') ||
        fieldLower.includes('education') ||
        fieldLower.includes('demographic')
      );
    });

    if (demographicFields.length > 0) {
      console.log('[getRelevantFields] Found demographic fields:', demographicFields);
      return demographicFields;
    }
  }

  // Check for sports-related fields
  if (queryLower.includes('sports') ||
    queryLower.includes('fan') ||
    queryLower.includes('nhl') ||
    queryLower.includes('soccer') ||
    queryLower.includes('exercise')) {
    const fanFields = availableFields.filter(field => {
      const fieldLower = field.toLowerCase();
      return (
        fieldLower.includes('sports') ||
        fieldLower.includes('fan') ||
        fieldLower.includes('nhl') ||
        fieldLower.includes('soccer') ||
        fieldLower.includes('exercise')
      );
    });

    if (fanFields.length > 0) {
      console.log('[getRelevantFields] Found fan fields:', fanFields);
      return fanFields;
    }
  }

  // Default case: return all available fields
  console.log('[getRelevantFields] No specific fields found, returning all available fields');
  return availableFields;
} 