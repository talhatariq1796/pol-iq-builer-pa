# PDF Assets

This directory contains assets optimized for PDF generation using `@react-pdf/renderer`.

## BHHS Logo

The BHHS logo has been converted from SVG to high-quality PNG (base64 encoded) for reliable PDF embedding.

### Files

- `bhhs-logo-base64.ts` - Base64 encoded PNG logo with metadata

### Usage Example

```typescript
import { Image } from '@react-pdf/renderer';
import { BHHS_LOGO_BASE64, BHHS_LOGO_ASPECT_RATIO } from '@/lib/pdf/assets/bhhs-logo-base64';

// In your PDF component
<Image
  src={BHHS_LOGO_BASE64}
  style={{
    width: 120,  // Set desired width
    height: 120 / BHHS_LOGO_ASPECT_RATIO  // Maintains aspect ratio
  }}
/>
```

### Logo Specifications

- **Format**: PNG with transparency
- **Resolution**: 1200 x 308 pixels
- **DPI**: 300 (print quality)
- **Size**: ~16.5 KB (base64 encoded)
- **Aspect Ratio**: 3.8961 (preserved from original SVG)

### Regenerating the Logo

If you need to regenerate the base64 logo from the SVG source:

```bash
npx tsx scripts/convert-logo-to-base64.ts
```

This will read from `public/BHHS-logo-4.svg` and update `lib/pdf/assets/bhhs-logo-base64.ts`.
