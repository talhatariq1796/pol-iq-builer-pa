/**
 * Strip `[ACTION:actionType:{...}]` machine directives from assistant text.
 * JSON payloads may contain `]` (e.g. arrays) — must not use a naive regex.
 */

const ACTION_PREFIX = '[ACTION:';

export interface ParsedActionDirective {
  actionType: string;
  /** Raw JSON object string including braces */
  jsonStr: string;
  /** Parsed payload when JSON is valid */
  data: Record<string, unknown>;
}

/**
 * Extract all ACTION directives with brace-balanced JSON parsing.
 */
export function extractActionDirectives(text: string): ParsedActionDirective[] {
  const out: ParsedActionDirective[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf(ACTION_PREFIX, i);
    if (start === -1) break;

    const afterPrefix = start + ACTION_PREFIX.length;
    const sep = text.indexOf(':', afterPrefix);
    if (sep === -1) break;

    const actionType = text.slice(afterPrefix, sep);
    const jsonStart = sep + 1;
    if (text[jsonStart] !== '{') {
      i = start + 1;
      continue;
    }

    let depth = 0;
    let j = jsonStart;
    for (; j < text.length; j++) {
      const c = text[j];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    if (depth !== 0) break;

    if (text[j] !== ']') {
      i = start + 1;
      continue;
    }

    const jsonStr = text.slice(jsonStart, j);
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      data = {};
    }
    out.push({ actionType, jsonStr, data });
    i = j + 1;
  }
  return out;
}

/**
 * Remove all `[ACTION:...]` blocks from text for user-facing display.
 */
export function stripActionDirectives(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf(ACTION_PREFIX, i);
    if (start === -1) {
      result += text.slice(i);
      break;
    }
    result += text.slice(i, start);

    const afterPrefix = start + ACTION_PREFIX.length;
    const sep = text.indexOf(':', afterPrefix);
    if (sep === -1) {
      result += text.slice(start);
      break;
    }

    const jsonStart = sep + 1;
    if (text[jsonStart] !== '{') {
      result += text[start];
      i = start + 1;
      continue;
    }

    let depth = 0;
    let j = jsonStart;
    for (; j < text.length; j++) {
      const c = text[j];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    if (depth !== 0) {
      result += text.slice(start);
      break;
    }
    if (text[j] === ']') {
      i = j + 1;
    } else {
      result += text.slice(start);
      break;
    }
  }

  return result.replace(/\n{3,}/g, '\n\n').trimEnd();
}
