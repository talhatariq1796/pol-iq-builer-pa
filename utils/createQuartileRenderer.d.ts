import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';

declare module '@/utils/createQuartileRenderer' {
    export function createQuartileRenderer(
      layer: FeatureLayer,
      field: string
    ): Promise<ClassBreaksRenderer | null>;
  }