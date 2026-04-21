/**
 * Font Registration for @react-pdf/renderer
 * Loads Montserrat font family for BHHS branding
 *
 * DISABLED: @react-pdf/renderer is not installed
 */

// DISABLED: @react-pdf/renderer is not installed
// Font import removed - not using react-pdf/renderer

/**
 * Register Montserrat font family
 * Using Google Fonts CDN for font files
 *
 * DISABLED: @react-pdf/renderer is not installed
 */
export function registerFonts() {
  // DISABLED: @react-pdf/renderer is not installed
  // Use Helvetica (built-in to react-pdf) instead of external fonts
  // This avoids CORS and 404 issues while maintaining clean, professional appearance
  /*
  Font.register({
    family: 'Montserrat',
    fonts: [
      {
        src: 'Helvetica',
        fontWeight: 400,
      },
      {
        src: 'Helvetica-Bold',
        fontWeight: 500,
      },
      {
        src: 'Helvetica-Bold',
        fontWeight: 600,
      },
    ],
  });
  */
}

// Auto-register fonts when module is imported
// DISABLED: @react-pdf/renderer is not installed
// registerFonts();
