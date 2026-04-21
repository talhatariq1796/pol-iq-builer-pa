import html2canvas from 'html2canvas';

export interface ChartCaptureOptions {
  width?: number;
  height?: number;
  scale?: number; // For high DPI (use 2 for retina)
  backgroundColor?: string;
}

/**
 * Capture a chart element as base64 image
 * @param element - DOM element containing the chart
 * @param options - Capture options for quality/size
 * @returns Promise<string> - Base64 data URL
 */
export async function captureChartAsBase64(
  element: HTMLElement,
  options: ChartCaptureOptions = {}
): Promise<string> {
  try {
    const {
      width = 800,
      height = 600,
      scale = 2, // 2x for retina quality
      backgroundColor = '#ffffff'
    } = options;

    // Capture the element
    const canvas = await html2canvas(element, {
      scale,
      backgroundColor,
      logging: false,
      width,
      height,
    });

    // Convert to base64
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('[ChartCapture] Error capturing chart:', error);
    throw new Error('Failed to capture chart image');
  }
}

/**
 * Capture multiple charts at once
 */
export async function captureMultipleCharts(
  elements: Record<string, HTMLElement | null>,
  options?: ChartCaptureOptions
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  for (const [key, element] of Object.entries(elements)) {
    if (element) {
      try {
        results[key] = await captureChartAsBase64(element, options);
      } catch (error) {
        console.error(`[ChartCapture] Failed to capture ${key}:`, error);
        // Continue with other charts even if one fails
      }
    }
  }

  return results;
}
