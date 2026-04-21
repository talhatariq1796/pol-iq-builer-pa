import type { FeatureLayer } from '@arcgis/core/layers/FeatureLayer';

declare global {
  interface Window {
    applianceLayer: FeatureLayer;
    demographicLayer: FeatureLayer;
    __themeTransitioning?: boolean;
  }
}