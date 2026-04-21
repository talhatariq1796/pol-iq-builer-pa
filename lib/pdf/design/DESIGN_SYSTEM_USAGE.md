# PDF Design System Usage Guide

## Overview

The PDF design system provides three key layers for flexible, consistent PDF generation:

1. **Design Tokens** - Spacing, radius, shadows, and visual properties
2. **Style Props** - Optional style overrides for components
3. **Layout Helpers** - Common layout patterns (stack, grid, flex, distribute)

## 1. Design Tokens (`ModernTokens`)

### Spacing Scale

Use semantic spacing tokens instead of magic numbers:

```typescript
import { Spacing, ModernTokens } from '@/lib/pdf/design';

// ❌ Before: Magic numbers
const padding = 16;
const margin = 8;

// ✅ After: Semantic tokens
const padding = Spacing.md;     // 8mm
const margin = Spacing.sm;      // 4mm

// Alternative: Use the unified object
const padding = ModernTokens.spacing.md;
```

**Available spacing values:**
- `xs: 2mm` - Extra small, tight spacing
- `sm: 4mm` - Small, compact layouts
- `md: 8mm` - Medium, standard spacing
- `lg: 12mm` - Large, generous spacing
- `xl: 16mm` - Extra large, section separators
- `2xl: 24mm` - Major sections
- `3xl: 32mm` - Page sections

### Border Radius

```typescript
import { Radius } from '@/lib/pdf/design';

// Consistent rounding for cards, buttons, containers
const cardRadius = Radius.md;      // 4mm - standard cards
const heroRadius = Radius.xl;      // 8mm - large containers
const pillRadius = Radius.full;    // 999mm - fully rounded
```

**Available radius values:**
- `none: 0` - No rounding
- `sm: 2mm` - Subtle, badges
- `md: 4mm` - Standard cards
- `lg: 6mm` - Prominent cards
- `xl: 8mm` - Hero sections
- `2xl: 12mm` - Extra prominent
- `full: 999mm` - Pills, avatars

### Shadows

```typescript
import { Shadow } from '@/lib/pdf/design';

const cardShadow = Shadow.sm;  // 'rgba(0, 0, 0, 0.1)'
const modalShadow = Shadow.xl; // 'rgba(0, 0, 0, 0.25)'
```

## 2. Style Props System

### Basic Usage

```typescript
import { StyleProps, resolveSpacing, resolveRadius } from '@/lib/pdf/design';

interface CardConfig {
  bounds: Bounds;
  title: string;
  styleProps?: StyleProps;  // Optional style overrides
}

function createCard(config: CardConfig) {
  const padding = resolveSpacing(config.styleProps?.padding, 'md');
  const radius = resolveRadius(config.styleProps?.borderRadius, 'lg');

  return {
    type: 'card',
    padding,
    borderRadius: radius,
    // ... rest of component
  };
}

// Usage with style overrides
const card = createCard({
  bounds: { x: 10, y: 20, width: 100, height: 80 },
  title: 'My Card',
  styleProps: {
    padding: 'xl',        // Override default 'md'
    borderRadius: 'sm',   // Override default 'lg'
    shadow: 'md',
  }
});
```

### Style Presets

```typescript
import { StylePresets } from '@/lib/pdf/design';

// Pre-configured style combinations
const cardStyles = StylePresets.card;      // padding: md, borderRadius: lg, shadow: sm
const panelStyles = StylePresets.panel;    // padding: lg, borderRadius: xl, shadow: md
const compactStyles = StylePresets.compact; // padding: sm, gap: sm
```

### Extracting Spacing

```typescript
import { extractPadding, extractMargin } from '@/lib/pdf/design';

const style: StyleProps = {
  paddingX: 'lg',
  paddingY: 'sm',
};

const padding = extractPadding(style);
// { top: 4, right: 12, bottom: 4, left: 12 }
```

## 3. Layout Helpers

### Stack (Vertical Layout)

```typescript
import { stack } from '@/lib/pdf/design';

const elements = [element1, element2, element3];

const positioned = stack(
  elements,
  startY: 50,    // Starting Y position
  gap: 'md'      // Gap between elements (can be token or number)
);
```

### Distribute Horizontal

```typescript
import { distributeHorizontal } from '@/lib/pdf/design';

const cards = [card1, card2, card3];

const distributed = distributeHorizontal(
  cards,
  bounds: { x: 10, y: 20, width: 190, height: 80 },
  gap: 'lg'  // Space between cards
);
```

### Grid Layout

```typescript
import { grid } from '@/lib/pdf/design';

const items = [item1, item2, item3, item4, item5, item6];

const gridLayout = grid(
  items,
  bounds: { x: 10, y: 20, width: 190, height: 120 },
  {
    columns: 3,     // 3 columns
    rows: 2,        // 2 rows (optional, auto-calculated if omitted)
    gap: 'md',      // Gap for both X and Y
    // Or separate gaps:
    gapX: 'lg',
    gapY: 'sm',
  }
);
```

### Flex Layout

```typescript
import { flex } from '@/lib/pdf/design';

const elements = [el1, el2, el3];

const flexRow = flex(elements, bounds, {
  direction: 'row',
  justify: 'space-between',  // start, center, end, space-between, space-around
  align: 'center',           // start, center, end, stretch
  gap: 'md',
});

const flexColumn = flex(elements, bounds, {
  direction: 'column',
  justify: 'center',
  align: 'start',
  gap: 'sm',
});
```

### Center Element

```typescript
import { center } from '@/lib/pdf/design';

const centered = center(
  element,
  bounds: { x: 0, y: 0, width: 210, height: 297 },
  axis: 'both'  // 'both' | 'horizontal' | 'vertical'
);
```

### Alignment

```typescript
import { alignHorizontal, alignVertical } from '@/lib/pdf/design';

// Horizontal alignment
const aligned = alignHorizontal(
  elements,
  alignment: 'center',  // 'left' | 'center' | 'right'
  containerX: 10,
  containerWidth: 190
);

// Vertical alignment
const aligned = alignVertical(
  elements,
  alignment: 'middle',  // 'top' | 'middle' | 'bottom'
  containerY: 20,
  containerHeight: 100
);
```

### Inset (Padding)

```typescript
import { inset } from '@/lib/pdf/design';

// Uniform padding
const inner = inset(
  bounds: { x: 10, y: 20, width: 190, height: 100 },
  padding: 'lg'  // 12mm on all sides
);
// Result: { x: 22, y: 32, width: 166, height: 76 }

// Custom padding per side
const inner = inset(bounds, {
  top: 'sm',
  right: 'lg',
  bottom: 'md',
  left: 'xl',
});
```

### Calculate Heights/Widths

```typescript
import { calculateStackHeight, calculateRowWidth } from '@/lib/pdf/design';

const totalHeight = calculateStackHeight(elements, gap: 'md');
const totalWidth = calculateRowWidth(elements, gap: 'lg');
```

## Complete Example

```typescript
import {
  Spacing,
  Radius,
  Shadow,
  StyleProps,
  stack,
  distributeHorizontal,
  inset,
  ModernColorPalette,
  TypographyStyles,
} from '@/lib/pdf/design';

function buildPage(pdf: jsPDF, data: PageData) {
  // Define page bounds with padding
  const pageBounds = { x: 0, y: 0, width: 210, height: 297 };
  const contentBounds = inset(pageBounds, 'xl'); // 16mm padding

  // Create header elements
  const headerElements = [
    { type: 'text', text: 'Page Title', style: TypographyStyles.h1 },
    { type: 'text', text: 'Subtitle', style: TypographyStyles.body },
  ];

  // Stack header vertically
  const header = stack(headerElements, contentBounds.y, 'sm');

  // Create KPI cards
  const kpiCards = [
    createKPICard({ label: 'Metric 1', value: '$100K' }),
    createKPICard({ label: 'Metric 2', value: '25%' }),
    createKPICard({ label: 'Metric 3', value: '150' }),
  ];

  // Distribute cards horizontally
  const cards = distributeHorizontal(
    kpiCards,
    { x: contentBounds.x, y: 50, width: contentBounds.width, height: 80 },
    Spacing.lg
  );

  return [...header, ...cards];
}

function createKPICard(config: { label: string; value: string }) {
  return {
    type: 'card',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    shadow: Shadow.sm,
    backgroundColor: ModernColorPalette.background.white,
    elements: [
      {
        type: 'text',
        text: config.label,
        style: TypographyStyles.label,
        color: ModernColorPalette.text.muted,
      },
      {
        type: 'text',
        text: config.value,
        style: TypographyStyles.h2,
        color: ModernColorPalette.text.dark,
      },
    ],
  };
}
```

## Best Practices

### ✅ DO

- Use semantic tokens (`Spacing.md`) instead of magic numbers (`16`)
- Provide token or number for flexibility: `gap: number | SpacingToken`
- Use layout helpers to reduce manual positioning code
- Use `StyleProps` for optional component overrides
- Use `inset()` for padding instead of manual calculations

### ❌ DON'T

- Don't hardcode spacing values: ❌ `const padding = 8`
- Don't manually calculate distributions: ❌ `x: baseX + (width + gap) * i`
- Don't repeat positioning logic: Use helpers
- Don't skip type annotations: Use `Bounds`, `Position`, `Size`

## Migration Example

### Before (Manual Positioning)

```typescript
// ❌ Repetitive, error-prone
const card1X = grid.getColumnX(1);
const card2X = grid.getColumnX(4);
const card3X = grid.getColumnX(7);
const card1 = { x: card1X, y: 50, width: 60, height: 80 };
const card2 = { x: card2X, y: 50, width: 60, height: 80 };
const card3 = { x: card3X, y: 50, width: 60, height: 80 };
```

### After (Layout Helpers)

```typescript
// ✅ Clean, declarative
const cards = distributeHorizontal(
  [card1, card2, card3],
  { x: grid.getColumnX(1), y: 50, width: grid.getWidth(12), height: 80 },
  'lg'
);
```

## Type Reference

```typescript
// Bounds for positioning and sizing
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Position for coordinates
interface Position {
  x: number;
  y: number;
}

// Size for dimensions
interface Size {
  width: number;
  height: number;
}

// Style props for overrides
interface StyleProps {
  padding?: number | SpacingToken;
  margin?: number | SpacingToken;
  borderRadius?: number | RadiusToken;
  shadow?: string | ShadowToken;
  backgroundColor?: string;
  color?: string;
  // ... more props
}
```
