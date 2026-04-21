import imageManifest from '@/public/data/image-manifest.json';

export interface ImageConfig {
  useLocalImages?: boolean;
  localPath?: string;
  cdnBaseUrl?: string;
}

const DEFAULT_CONFIG: ImageConfig = {
  useLocalImages: false,
  localPath: '/re-images',
  cdnBaseUrl: process.env.NEXT_PUBLIC_BLOB_STORE_URL || ''
};

export class PropertyImageResolver {
  private config: ImageConfig;
  private manifest: Record<string, string>;

  constructor(config?: Partial<ImageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.manifest = imageManifest || {};
  }

  /**
   * Get image URL for a property
   * @param propertyId - The property ID (e.g., "10001562" or "9881197")
   * @param fallbackUrl - Optional fallback URL if image not found
   */
  getImageUrl(propertyId: string, fallbackUrl?: string): string {
    // Check if we have a CDN URL in the manifest
    if (!this.config.useLocalImages && this.manifest[propertyId]) {
      return this.manifest[propertyId];
    }

    // Try blob storage URL with Centris naming convention
    // The blob storage URL is: 
    // Images are stored in: property-images/CentrisNo_[ID]_01.jpg
    if (this.config.cdnBaseUrl && propertyId) {
      // Use the exact pattern that matches our local files and blob storage structure
      const imageFileName = `CentrisNo_${propertyId}_01.jpg`;
      const blobUrl = `${this.config.cdnBaseUrl}/property-images/${imageFileName}`;
      return blobUrl;
    }

    // Fall back to local image if configured
    if (this.config.useLocalImages && this.config.localPath) {
      return `${this.config.localPath}/CentrisNo_${propertyId}_01.jpg`;
    }

    // Use fallback URL or placeholder
    return fallbackUrl || '/images/property-placeholder.jpg';
  }

  /**
   * Get multiple image URLs for properties
   * @param propertyIds - Array of property IDs
   */
  getImageUrls(propertyIds: string[]): Record<string, string> {
    const urls: Record<string, string> = {};
    
    for (const id of propertyIds) {
      urls[id] = this.getImageUrl(id);
    }
    
    return urls;
  }

  /**
   * Check if image exists for a property
   * @param propertyId - The property ID
   */
  hasImage(propertyId: string): boolean {
    return !!this.manifest[propertyId];
  }

  /**
   * Get all available property IDs with images
   */
  getAvailablePropertyIds(): string[] {
    return Object.keys(this.manifest);
  }

  /**
   * Update configuration at runtime
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<ImageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ImageConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const propertyImageResolver = new PropertyImageResolver();

// Helper function for quick access
export function getPropertyImageUrl(propertyId: string, fallback?: string): string {
  return propertyImageResolver.getImageUrl(propertyId, fallback);
}

// React hook for using property images
export function usePropertyImage(propertyId: string | undefined): {
  imageUrl: string;
  hasImage: boolean;
  isLoading: boolean;
} {
  if (!propertyId) {
    return {
      imageUrl: '/images/property-placeholder.jpg',
      hasImage: false,
      isLoading: false
    };
  }

  const imageUrl = propertyImageResolver.getImageUrl(propertyId);
  const hasImage = propertyImageResolver.hasImage(propertyId);

  return {
    imageUrl,
    hasImage,
    isLoading: false // Can be extended to include actual loading state if needed
  };
}