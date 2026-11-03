import type { WorldSnippet } from './prompt-assembler';
import type { TokenCounter } from './text';
import { entryLabel, type WorldBook, type WorldEntry } from './world-info';

/*
 * Decides which world entries go into the prompt (CLAUDE.md §4 step 3, §8.2).
 * Keywords use plain substring matching — no word splitting, so Chinese works.
 * A key written as /pattern/flags is treated as a regular expression.
 */

export interface TriggeredEntry {
  book: WorldBook;
  entry: WorldEntry;
  /** Why it fired, for debugging and the budget report. */
  reason: 'constant' | 'keyword';
}

function keyMatches(key: string, text: string, caseSensitive: boolean): boolean {
  const regex = /^\/(.+)\/([a-z]*)$/i.exec(key.trim());
  if (regex) {
    try {
      return new RegExp(regex[1]!, regex[2]!.replace('g', '')).test(text);
    } catch {
      return false; // a broken pattern simply never fires
    }
  }
  const needle = key.trim();
  if (!needle) return false;
  return caseSensitive ? text.includes(needle) : text.toLowerCase().includes(needle.toLowerCase());
}

function entryFires(entry: WorldEntry, text: string): boolean {
  const cs = entry.case_sensitive === true;
  if (!entry.keys.some((k) => keyMatches(k, text, cs))) return false;
  const secondary = entry.secondary_keys ?? [];
  // Secondary keys narrow a match: at least one must also appear.
  if (entry.selective !== false && secondary.length > 0) {
    return secondary.some((k) => keyMatches(k, text, cs));
  }
  return true;
}

/**
 * @param recentTexts chat texts oldest → newest, including the latest user message.
 */
export function scanWorldBooks(books: WorldBook[], recentTexts: string[]): TriggeredEntry[] {
  const out: TriggeredEntry[] = [];
  for (const book of books) {
    const depth = Math.max(1, Math.floor(book.scan_depth || 1));
    const window = recentTexts.slice(-depth).join('\n');
    for (const entry of book.entries) {
      if (entry.enabled === false || !entry.content.trim()) continue;
      if (entry.constant) out.push({ book, entry, reason: 'constant' });
      else if (entryFires(entry, window)) out.push({ book, entry, reason: 'keyword' });
    }
  }
  return out;
}

/** Higher priority first; ties go to the later insertion order (closer to the chat). */
export function byImportance(a: WorldEntry, b: WorldEntry): number {
  return (b.priority ?? 0) - (a.priority ?? 0) || b.insertion_order - a.insertion_order;
}

/**
 * Applies each book's own token_budget (keeping its most important entries)
 * and converts the survivors into assembler snippets.
 */
export function selectWorldSnippets(triggered: TriggeredEntry[], countTokens: TokenCounter): WorldSnippet[] {
  const perBook = new Map<number, TriggeredEntry[]>();
  for (const t of triggered) perBook.set(t.book.id, [...(perBook.get(t.book.id) ?? []), t]);

  const snippets: WorldSnippet[] = [];
  for (const list of perBook.values()) {
    const budget = list[0]!.book.token_budget;
    let spent = 0;
    for (const { entry } of [...list].sort((a, b) => byImportance(a.entry, b.entry))) {
      const cost = countTokens(entry.content) + 1;
      if (budget > 0 && spent + cost > budget) continue;
      spent += cost;
      snippets.push({
        content: entry.content,
        priority: entry.priority ?? 0,
        insertion_order: entry.insertion_order,
        position: entry.position === 'before_char' ? 'before_char' : 'after_char',
        label: entryLabel(entry),
      });
    }
  }
  return snippets;
}
