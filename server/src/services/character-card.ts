import { normalizeCard, type CharacterCardV2, type CharacterCardV2Data } from '@tavern/shared';

export { splitExamples, substituteVars } from '@tavern/shared';

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
