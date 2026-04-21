/**
 * Chart.js Server-Side Renderer
 *
 * NOTE: This module is DISABLED for Vercel compatibility.
 * @napi-rs/canvas requires native bindings that don't work in serverless.
 *
 * Charts must be provided via the chartImages config parameter.
 * This file exports a stub to prevent compilation errors.
 */

export class ChartJSRenderer {
  /**
   * Generate chart image (DISABLED - throws error)
   */
  static async generateChart(
    type: 'bar' | 'line' | 'donut',
    data: any,
    options: any
  ): Promise<string> {
    throw new Error(
      'Dynamic chart generation is disabled. ' +
      'Please provide pre-rendered chart images via chartImages config.'
    );
  }
}
