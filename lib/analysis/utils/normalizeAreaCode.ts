// Utility to normalize area codes (ZIP or FSA) for US/Canada
export function normalizeAreaCode(input: string | number | undefined | null): string {
  if (!input) return '';
  let code = String(input).trim().toUpperCase();
  // US ZIP: 5 digits
  if (/^\d{5}$/.test(code)) return code;
  // Canadian FSA: 3 alphanumeric (A1A)
  if (/^[A-Z]\d[A-Z]$/.test(code)) return code;
  // Canadian FSA with space (A1A 1A1) → take first 3
  if (/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(code)) return code.slice(0, 3);
  // Remove non-alphanum, try again
  code = code.replace(/[^A-Z0-9]/g, '');
  if (/^\d{5}$/.test(code)) return code;
  if (/^[A-Z]\d[A-Z]$/.test(code)) return code;
  return code;
}
