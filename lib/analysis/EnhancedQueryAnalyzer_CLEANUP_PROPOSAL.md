# EnhancedQueryAnalyzer Cleanup Proposal

## Current Problems
1. **Hardcoded for wrong project**: Contains H&R Block/TurboTax and athletic shoe brands instead of Red Bull
2. **603 lines of hardcoded mappings**: Massive, unmaintainable field mapping object
3. **Mixed domains**: Tax services mixed with athletic brands
4. **Unused SHAP fields**: 50+ SHAP explanatory fields never used
5. **Manual updates required**: Must edit file for each project migration

## Proposed Solution

### Option 1: Template-Based Configuration (Recommended)
```typescript
// lib/analysis/EnhancedQueryAnalyzer.ts
import { FieldMappingTemplate } from '../migration/templates/FieldMappingTemplate';

export class EnhancedQueryAnalyzer {
  private fieldMappings: Record<string, FieldMapping>;
  
  constructor(template?: FieldMappingTemplate) {
    // Load from template or use defaults
    this.fieldMappings = template?.fieldMappings || this.getDefaultMappings();
  }
  
  private getDefaultMappings(): Record<string, FieldMapping> {
    // Minimal essential mappings only
    return {
      // Core demographics
      population: {
        keywords: ['population', 'people'],
        fields: ['TOTPOP_CY'],
        description: 'Total population'
      },
      income: {
        keywords: ['income', 'earnings', 'wealth'],
        fields: ['MEDHINC_CY'],
        description: 'Median household income'
      },
      // Project-specific fields loaded from template
    };
  }
}
```

### Option 2: Configuration File
```typescript
// config/field-mappings.json
{
  "project": "red-bull-energy-drinks",
  "fieldMappings": {
    "redBull": {
      "keywords": ["red bull", "redbull", "energy drink"],
      "fields": ["MP12207A_B_P"],
      "description": "Red Bull brand usage"
    },
    "monster": {
      "keywords": ["monster", "monster energy"],
      "fields": ["MP12206A_B_P"],
      "description": "Monster Energy brand usage"
    }
  }
}

// Load in EnhancedQueryAnalyzer
import fieldMappings from '@/config/field-mappings.json';
```

### Option 3: Dynamic Field Discovery
```typescript
export class EnhancedQueryAnalyzer {
  private fieldMappings: Record<string, FieldMapping>;
  
  constructor(private dataSource?: DataSource) {
    this.fieldMappings = this.discoverFields();
  }
  
  private discoverFields(): Record<string, FieldMapping> {
    if (!this.dataSource) return this.getCoreFields();
    
    // Dynamically discover fields from data source
    const discovered = this.dataSource.getAvailableFields();
    return this.mapFieldsToKeywords(discovered);
  }
}
```

## Fields to Remove

### Remove ALL SHAP Fields (lines 418-602)
- 50+ unused SHAP explanatory fields
- Never referenced in production code
- Adds 184 lines of unnecessary complexity

### Remove Irrelevant Sport Fan Fields (lines 359-393)
- MLB, NBA, NFL, NASCAR, NHL, MLS fan fields
- Not relevant to current project
- 35 lines of unused mappings

### Remove Mixed Brand Fields
- Remove H&R Block and TurboTax references
- Remove athletic shoe brand fields (Jordan, Nike, Puma, etc.)
- Keep only if relevant to current project

### Remove Overly Specific Demographics
- Hispanic subgroup breakdowns (lines 144-169)
- Keep only essential demographic fields

## Essential Fields to Keep

### Core Demographics
- population, income, age
- Basic racial/ethnic categories (simplified)

### Geographic
- ZIP codes, location identifiers
- Essential geographic fields

### Project-Specific (from template)
- Current project brand fields
- Relevant market categories
- Industry-specific metrics

## Implementation Steps

1. **Create backup**: Save current version as `EnhancedQueryAnalyzer_LEGACY.ts`
2. **Extract core fields**: Create minimal base field set
3. **Implement template system**: Add template-based configuration
4. **Remove unused code**: Delete SHAP fields, sports fans, irrelevant brands
5. **Add to migration automation**: Include in migration template system
6. **Test thoroughly**: Ensure routing still works correctly

## Benefits

1. **Reduced from 1046 to ~200 lines**: 80% code reduction
2. **Automated configuration**: No more manual edits
3. **Project-specific**: Only relevant fields for current project
4. **Maintainable**: Clear separation of concerns
5. **Migration-ready**: Part of automated migration system

## Migration Command Integration

```bash
# Generate EnhancedQueryAnalyzer config from template
npm run generate-config --template red-bull-energy-drinks --include QueryAnalyzer

# Validate field mappings
npm run validate-field-mappings --template red-bull-energy-drinks

# Deploy with query analyzer config
npm run deploy-config --template red-bull-energy-drinks
```

## Testing Strategy

```typescript
// __tests__/enhanced-query-analyzer-cleanup.test.ts
describe('EnhancedQueryAnalyzer with Template', () => {
  it('should load Red Bull template correctly', () => {
    const template = loadTemplate('red-bull-energy-drinks');
    const analyzer = new EnhancedQueryAnalyzer(template);
    
    expect(analyzer.getBestEndpoint('Red Bull market share')).toBe('/brand-difference');
    expect(analyzer.getQueryFields('Monster Energy')).toContain('MP12206A_B_P');
  });
  
  it('should fall back to core fields without template', () => {
    const analyzer = new EnhancedQueryAnalyzer();
    expect(analyzer.getQueryFields('population')).toContain('TOTPOP_CY');
  });
});
```

## Summary

The EnhancedQueryAnalyzer needs a complete overhaul:
- Remove 600+ lines of hardcoded, project-specific mappings
- Implement template-based configuration system
- Integrate with migration automation
- Keep only essential, reusable field mappings
- Make it project-agnostic and maintainable

This will transform it from a maintenance burden into a flexible, automated component that adapts to each project through templates.