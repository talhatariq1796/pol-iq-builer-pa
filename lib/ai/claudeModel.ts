/**
 * Central Claude model ids for API calls.
 * @see https://docs.anthropic.com/en/docs/about-claude/models
 */
export const CLAUDE_MODEL_DEFAULT = 'claude-haiku-4-5-20251001';
export const CLAUDE_MODEL_ALIAS = 'claude-haiku-4-5';

/** Primary model: `CLAUDE_MODEL` env or Haiku 4.5 snapshot. */
export function resolveClaudeModel(): string {
  return process.env.CLAUDE_MODEL?.trim() || CLAUDE_MODEL_DEFAULT;
}

/**
 * Alternate id when the primary fails (e.g. model_not_found).
 * Cycles snapshot ↔ alias; custom env values fall back to the default snapshot.
 */
export function resolveClaudeRetryModel(triedModel: string): string {
  if (triedModel === CLAUDE_MODEL_DEFAULT) return CLAUDE_MODEL_ALIAS;
  if (triedModel === CLAUDE_MODEL_ALIAS) return CLAUDE_MODEL_DEFAULT;
  return CLAUDE_MODEL_DEFAULT;
}
