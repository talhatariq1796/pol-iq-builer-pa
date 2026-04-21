/**
 * Property Image Loader for PDF Generation
 *
 * Handles loading property images from Vercel Blob Storage with property type awareness.
 * Supports different folder structures for single-family, condos, and revenue properties.
 */

export interface PropertyImageConfig {
  centris_no: number;
  propertyCategory?: 'residential' | 'revenue';
  propertyType?: string;
  sourcePropertyType?: string;
  pt?: string;
}

/**
 * Determine the folder path for a property based on its type
 *
 * @param property Property with type information
 * @returns Folder name in blob storage ('single-family', 'condos', or 'revenue')
 */
export function getPropertyImageFolder(property: PropertyImageConfig): string {
  // Check if it's a revenue property
  if (property.propertyCategory === 'revenue') {
    return 'revenue';
  }

  // Check sourcePropertyType (most reliable)
  if (property.sourcePropertyType) {
    if (property.sourcePropertyType === 'condo' || property.sourcePropertyType === 'townhouse') {
      return 'condos';
    }
    if (property.sourcePropertyType === 'house') {
      return 'single-family';
    }
    // Revenue types
    if (['duplex', 'multiplex', 'commercial'].includes(property.sourcePropertyType)) {
      return 'revenue';
    }
  }

  // Fallback to propertyType
  if (property.propertyType) {
    const type = property.propertyType.toLowerCase();
    if (type.includes('condo') || type.includes('apartment') || type.includes('townhouse')) {
      return 'condos';
    }
    if (type.includes('duplex') || type.includes('multiplex') || type.includes('commercial')) {
      return 'revenue';
    }
  }

  // Fallback to pt field (property type code from Centris)
  if (property.pt) {
    const pt = property.pt.toString().toUpperCase();

    // Condo/Apartment types
    if (['APT', 'HOU', 'LS', 'CO', 'TH'].includes(pt)) {
      return 'condos';
    }

    // Revenue property types
    if (['2X', '3X', '4X', '5X', 'DP', 'MP', 'CM', 'OTH'].includes(pt)) {
      return 'revenue';
    }

    // House types (default)
    if (['SF', 'BUN', 'SL', 'CT', '1HS', '2HS', 'MH'].includes(pt)) {
      return 'single-family';
    }
  }

  // Default to single-family if no type information available
  return 'single-family';
}

/**
 * Generate property image URL for Vercel Blob Storage
 *
 * Tries multiple URL formats:
 * 1. New structure: /real-estate-images/{type}/images/{centris_no}_1.jpg
 * 2. Old structure: /property-images/CentrisNo_{centris_no}_01.jpg
 *
 * @param property Property with centris_no and type information
 * @param imageNumber Image number (1-5 typically)
 * @returns Array of possible image URLs to try
 */
export function getPropertyImageURLs(
  property: PropertyImageConfig,
  imageNumber: number = 1
): string[] {
  const baseURL = process.env.NEXT_PUBLIC_BLOB_STORE_URL ||
                  '';
  const centrisNo = property.centris_no;

  if (!centrisNo || centrisNo === 0) {
    return [];
  }

  const folder = getPropertyImageFolder(property);

  // Return array of URLs to try in priority order
  return [
    // PRIMARY: Flat structure with CentrisNo prefix (ACTUAL blob storage structure)
    `${baseURL}/property-images/CentrisNo_${centrisNo}_${imageNumber.toString().padStart(2, '0')}.jpg`,

    // FALLBACK: Property-type-aware folders (not currently used in blob storage)
    `${baseURL}/real-estate-images/${folder}/images/${centrisNo}_${imageNumber}.jpg`,

    // FALLBACK: Alternative flat structure (no CentrisNo prefix)
    `${baseURL}/property-images/${centrisNo}_${imageNumber}.jpg`,
  ];
}

/**
 * Load property image with fallback logic
 *
 * Tries multiple URL formats and image numbers until one succeeds.
 * Returns null if no image is found.
 *
 * @param property Property with centris_no and type information
 * @param maxImageNumber Maximum image number to try (default: 5)
 * @param timeoutMs Request timeout in milliseconds (default: 3000)
 * @returns Base64-encoded image data URL or null if not found
 */
export async function loadPropertyImage(
  property: PropertyImageConfig,
  maxImageNumber: number = 5,
  timeoutMs: number = 3000
): Promise<string | null> {
  if (!property.centris_no || property.centris_no === 0) {
    console.warn('[loadPropertyImage] Invalid centris_no:', property.centris_no);
    return null;
  }

  // Try image numbers 1 through maxImageNumber
  for (let imageNum = 1; imageNum <= maxImageNumber; imageNum++) {
    const urls = getPropertyImageURLs(property, imageNum);

    // Try each URL format
    for (const url of urls) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Image fetch timeout')), timeoutMs)
        );

        // Fetch image with HEAD request (faster than GET)
        const response = await Promise.race([
          fetch(url, {
            method: 'HEAD',
            mode: 'cors',
            cache: 'force-cache', // Use cache for performance
          }),
          timeoutPromise
        ]);

        if (response.ok) {
          // Found valid image, now fetch full image data
          const imageResponse = await Promise.race([
            fetch(url, {
              mode: 'cors',
              cache: 'force-cache',
              headers: { 'Accept': 'image/*' }
            }),
            timeoutPromise
          ]);

          if (!imageResponse.ok) {
            continue; // Try next URL
          }

          // Convert to base64
          const blob = await Promise.race([
            imageResponse.blob(),
            timeoutPromise
          ]);

          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(blob);

            // Add timeout for FileReader
            setTimeout(() => reject(new Error('FileReader timeout')), timeoutMs);
          });

          // Validate base64 format
          if (base64 && base64.startsWith('data:image')) {
            console.log(`[loadPropertyImage] ✅ Loaded image: centris_no=${property.centris_no}, url=${url}`);
            return base64;
          }
        }
      } catch (error) {
        // Silently continue to next URL/image number
        continue;
      }
    }
  }

  // No image found after trying all URLs and image numbers
  console.warn(`[loadPropertyImage] ⚠️ No image found for centris_no=${property.centris_no}`);
  return null;
}

/**
 * Load multiple property images in parallel
 *
 * @param properties Array of properties to load images for
 * @param maxImages Maximum number of images to load (default: 10)
 * @param maxImageNumber Maximum image number per property (default: 5)
 * @returns Record of centris_no to base64 image data
 */
export async function loadPropertyImages(
  properties: PropertyImageConfig[],
  maxImages: number = 10,
  maxImageNumber: number = 5
): Promise<Record<string, string>> {
  const propertyImages: Record<string, string> = {};

  // Filter properties with valid centris_no and limit to maxImages
  const validProperties = properties
    .filter(p => p.centris_no && p.centris_no !== 0)
    .slice(0, maxImages);

  console.log(`[loadPropertyImages] Loading images for ${validProperties.length} properties`);

  // Load images in parallel
  const imagePromises = validProperties.map(async (property) => {
    const image = await loadPropertyImage(property, maxImageNumber);
    if (image) {
      propertyImages[property.centris_no.toString()] = image;
    }
  });

  await Promise.allSettled(imagePromises);

  const successCount = Object.keys(propertyImages).length;
  console.log(`[loadPropertyImages] ✅ Loaded ${successCount}/${validProperties.length} images`);

  return propertyImages;
}

/**
 * Get placeholder image data URL for missing property images
 * Returns a simple gray rectangle with "No Image" text
 */
export function getPlaceholderImage(): string {
  // Simple SVG placeholder (gray rectangle with text)
  const svg = `<svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="150" fill="#e0e0e0"/>
    <text x="50%" y="50%" text-anchor="middle" dy=".3em"
          font-family="Arial, sans-serif" font-size="14" fill="#666">
      No Image Available
    </text>
  </svg>`;

  // Convert SVG to base64 data URL
  const base64 = btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
}
