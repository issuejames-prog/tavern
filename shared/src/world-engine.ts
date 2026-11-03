import type { WorldSnippet } from './prompt-assembler';
import type { TokenCounter } from './text';
import { entryLabel, readEntry, SelectiveLogic, type WorldBook, type WorldEntry } from './world-info';

/*
 * Decides which world entries go into the prompt (CLAUDE.md §4.1 step 3, §4.3).
 * Keywords use substring matching — no word splitting, so Chinese works.
 * A key written as /pattern/flags is a regular expression.
 */

/** Global "activation settings" (總體參數) — they apply to every world book. */
export interface WorldActivationSettings {
  /** Message pairs scanned: 1 = your new message + the character's latest reply. */
  scan_depth: number;
  /** World entries may use at most this % of the prompt budget. */
  context_percent: number;
  /** Absolute token cap for world entries; 0 = no cap. */
  budget_cap: number;
  /** Activated entries' content can activate other entries. */
  recursive: boolean;
  /** Latin-script keys must match whole words (hotdog doesn't trigger "dog"). */
  match_whole_words: boolean;
}

export const DEFAULT_WORLD_SETTINGS: WorldActivationSettings = {
  scan_depth: 2,
  context_percent: 25,
  budget_cap: 0,
  recursive: true,
  match_whole_words: false,
};

export const MAX_SCAN_DEPTH = 10;
const MAX_RECURSION_PASSES = 3;

export type ActivationReason = 'constant' | 'keyword' | 'recursive';

export interface ActivatedEntry {
  book: WorldBook;
  entry: WorldEntry;
  reason: ActivationReason;
}

const HAN = /\p{Script=Han}/u;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function keyMatches(key: string, text: string, caseSensitive: boolean, wholeWords: boolean): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  const regex = /^\/(.+)\/([a-z]*)$/i.exec(trimmed);
  if (regex) {
    try {
      return new RegExp(regex[1]!, regex[2]!.replace('g', '')).test(text);
    } catch {
      return false; // a broken pattern simply never fires
    }
  }
  // Whole-word matching only makes sense for space-separated scripts; CJK keys always use substring.
  if (wholeWords && !HAN.test(trimmed)) {
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(trimmed)}(?![\\p{L}\\p{N}_])`, caseSensitive ? 'u' : 'iu').test(text);
  }
  return caseSensitive ? text.includes(trimmed) : text.toLowerCase().includes(trimmed.toLowerCase());
}

/** Primary keys: any one matches. Secondary keys: combined by the entry's logic (AND/NOT). */
export function entryMatches(entry: WorldEntry, text: string, wholeWords = false): boolean {
  const cs = entry.case_sensitive === true;
  const hit = (k: string) => keyMatches(k, text, cs, wholeWords);
  if (!entry.keys.some(hit)) return false;
  const secondary = entry.secondary_keys ?? [];
  if (entry.selective === false || secondary.length === 0) return true;
  const hits = secondary.filter(hit).length;
  switch (readEntry(entry).logic) {
    case SelectiveLogic.AndAny:
      return hits > 0;
    case SelectiveLogic.AndAll:
      return hits === secondary.length;
    case SelectiveLogic.NotAny:
      return hits === 0;
    case SelectiveLogic.NotAll:
      return hits < secondary.length;
  }
}

/**
 * @param history earlier chat texts, oldest → newest
 * @param latest the message just sent
 * @param random injectable for tests (probability rolls)
 */
export function scanWorldBooks(
  books: WorldBook[],
  history: string[],
  latest: string,
  settings: WorldActivationSettings = DEFAULT_WORLD_SETTINGS,
  random: () => number = Math.random,
): ActivatedEntry[] {
  // Depth N = N pairs: the new message plus the 2N−1 messages before it.
  const depth = Math.min(MAX_SCAN_DEPTH, Math.max(1, Math.floor(settings.scan_depth || 1)));
  const window = [...history.slice(-(depth * 2 - 1)), latest].join('\n');

  const active: ActivatedEntry[] = [];
  const seen = new Set<WorldEntry>();
  const rolls = (entry: WorldEntry) => {
    const p = readEntry(entry).probability;
    return p >= 100 || random() * 100 < p;
  };
  const activate = (book: WorldBook, entry: WorldEntry, reason: ActivationReason) => {
    seen.add(entry);
    if (rolls(entry)) active.push({ book, entry, reason });
  };

  const candidates = books.flatMap((book) =>
    book.entries.filter((e) => readEntry(e).status !== 'disabled' && e.content.trim()).map((entry) => ({ book, entry })),
  );

  for (const { book, entry } of candidates) {
    if (readEntry(entry).status === 'constant') activate(book, entry, 'constant');
    else if (entryMatches(entry, window, settings.match_whole_words)) activate(book, entry, 'keyword');
  }

  // Recursive scanning: activated content can activate more entries ("世界書激活世界書").
  if (settings.recursive) {
    let source = active.filter((a) => !readEntry(a.entry).preventRecursion);
    for (let pass = 0; pass < MAX_RECURSION_PASSES && source.length; pass++) {
      const text = source.map((a) => a.entry.content).join('\n');
      const before = active.length;
      for (const { book, entry } of candidates) {
        if (seen.has(entry) || readEntry(entry).excludeRecursion) continue;
        if (entryMatches(entry, text, settings.match_whole_words)) activate(book, entry, 'recursive');
      }
      source = active.slice(before).filter((a) => !readEntry(a.entry).preventRecursion);
    }
  }
  return active;
}

const REASON_RANK: Record<ActivationReason, number> = { constant: 0, keyword: 1, recursive: 2 };

/**
 * Budget priority from the guide: constant > directly mentioned > recursive,
 * then higher insertion order first. Lower rank = kept longer.
 */
export function rankOf(a: ActivatedEntry): number {
  return REASON_RANK[a.reason] * 1_000_000 - a.entry.insertion_order;
}

/** Applies the world budget and converts survivors into assembler snippets. */
export function selectWorldSnippets(
  activated: ActivatedEntry[],
  countTokens: TokenCounter,
  budget: number,
): { snippets: WorldSnippet[]; dropped: number } {
  const snippets: WorldSnippet[] = [];
  let spent = 0;
  let dropped = 0;
  for (const a of [...activated].sort((x, y) => rankOf(x) - rankOf(y))) {
    const cost = countTokens(a.entry.content) + 1;
    if (budget > 0 && spent + cost > budget) {
      dropped++;
      continue;
    }
    spent += cost;
    const opts = readEntry(a.entry);
    snippets.push({
      content: a.entry.content,
      insertion_order: a.entry.insertion_order,
      position: opts.position,
      depth: opts.depth,
      label: entryLabel(a.entry),
      rank: rankOf(a),
    });
  }
  return { snippets, dropped };
}

/** Token budget for world entries from the global settings. */
export function worldBudget(settings: WorldActivationSettings, promptBudget: number): number {
  const byPercent = Math.floor((promptBudget * Math.min(100, Math.max(1, settings.context_percent))) / 100);
  return settings.budget_cap > 0 ? Math.min(byPercent, settings.budget_cap) : byPercent;
}
