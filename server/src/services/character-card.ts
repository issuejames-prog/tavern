import { normalizeCard, type CharacterCardV2, type CharacterCardV2Data } from '@tavern/shared';

/**
 * Replaces {{char}} / {{user}} (any case) plus the legacy <BOT> / <USER> tokens
 * that older community cards still use.
 */
export function substituteVars(text: string, vars: { char: string; user: string }): string {
  if (!text) return text;
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, vars.char)
    .replace(/\{\{\s*user\s*\}\}/gi, vars.user)
    .replace(/<BOT>/g, vars.char)
    .replace(/<USER>/g, vars.user);
}

/** Parses stored card JSON. Unknown fields are preserved by normalizeCard. */
export function parseStoredCard(json: string): CharacterCardV2 {
  return normalizeCard(JSON.parse(json));
}

/**
 * Merges edits into an existing card without dropping fields the editor
 * doesn't know about (extensions, character_book, third-party keys…).
 */
export function mergeCardData(
  existing: CharacterCardV2,
  patch: Partial<CharacterCardV2Data>,
): CharacterCardV2 {
  return { ...existing, data: { ...existing.data, ...patch } };
}

/** Splits `mes_example` into dialogue blocks separated by <START>. */
export function splitExamples(mesExample: string): string[] {
  return mesExample
    .split(/<START>/i)
    .map((block) => block.trim())
    .filter(Boolean);
}
