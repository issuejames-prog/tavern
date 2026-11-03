import type { CharacterBook, CharacterBookEntry } from './card';

/*
 * World books, in the character_book entry shape (CLAUDE.md §8.2).
 * Two external formats are supported:
 *   - character_book (embedded in character cards; entries is an array)
 *   - SillyTavern World Info files (entries is an object keyed by uid, different field names)
 * Unknown fields always survive import → edit → export.
 */

export interface WorldEntry extends CharacterBookEntry {
  id: number;
}

export interface WorldBook {
  id: number;
  name: string;
  description: string;
  /** How many recent messages are scanned for keywords. */
  scan_depth: number;
  /** Max tokens this book may add to one prompt. */
  token_budget: number;
  /** Applies to every chat, not only characters linked to it. */
  global: boolean;
  entries: WorldEntry[];
  /** Top-level fields from the imported file that the app doesn't use. */
  extra: Record<string, unknown>;
  updated_at: string;
}

export const DEFAULT_SCAN_DEPTH = 4;
export const DEFAULT_WORLD_TOKEN_BUDGET = 1024;

export function emptyEntry(id: number, order = 100): WorldEntry {
  return {
    id,
    comment: '',
    keys: [],
    secondary_keys: [],
    content: '',
    constant: false,
    selective: true,
    enabled: true,
    insertion_order: order,
    priority: 10,
    position: 'after_char',
    case_sensitive: false,
    extensions: {},
  };
}

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
const asNumber = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

// ---------- character_book ----------

/** Fills defaults on a character_book entry, keeping every unknown field. */
function normalizeEntry(raw: Record<string, unknown>, id: number): WorldEntry {
  const base = emptyEntry(id);
  return {
    ...raw,
    id,
    comment: typeof raw.comment === 'string' ? raw.comment : typeof raw.name === 'string' ? raw.name : '',
    keys: asStrings(raw.keys),
    secondary_keys: asStrings(raw.secondary_keys),
    content: typeof raw.content === 'string' ? raw.content : '',
    constant: raw.constant === true,
    selective: raw.selective !== false,
    enabled: raw.enabled !== false,
    insertion_order: asNumber(raw.insertion_order, base.insertion_order),
    priority: asNumber(raw.priority, base.priority ?? 10),
    position: raw.position === 'before_char' ? 'before_char' : 'after_char',
    case_sensitive: raw.case_sensitive === true,
    extensions: raw.extensions && typeof raw.extensions === 'object' ? (raw.extensions as Record<string, unknown>) : {},
  };
}

export function worldFromCharacterBook(book: CharacterBook, fallbackName: string): Omit<WorldBook, 'id' | 'updated_at' | 'global'> {
  const { name, description, scan_depth, token_budget, entries, ...extra } = book;
  return {
    name: typeof name === 'string' && name.trim() ? name : fallbackName,
    description: typeof description === 'string' ? description : '',
    scan_depth: asNumber(scan_depth, DEFAULT_SCAN_DEPTH),
    token_budget: asNumber(token_budget, DEFAULT_WORLD_TOKEN_BUDGET),
    entries: (Array.isArray(entries) ? entries : []).map((e, i) =>
      normalizeEntry(e as Record<string, unknown>, asNumber((e as { id?: unknown }).id, i + 1)),
    ),
    extra,
  };
}

export function worldToCharacterBook(world: WorldBook): CharacterBook {
  return {
    ...world.extra,
    name: world.name,
    description: world.description,
    scan_depth: world.scan_depth,
    token_budget: world.token_budget,
    entries: world.entries.map((e) => ({ ...e })),
  };
}

// ---------- SillyTavern World Info file ----------

// ST field name → character_book field name. Everything else is kept as-is on the entry.
const ST_FIELDS = ['uid', 'key', 'keysecondary', 'content', 'constant', 'disable', 'order', 'position', 'comment', 'selective', 'caseSensitive'] as const;

function fromStEntry(raw: Record<string, unknown>, fallbackId: number): WorldEntry {
  const rest = Object.fromEntries(Object.entries(raw).filter(([k]) => !(ST_FIELDS as readonly string[]).includes(k)));
  const id = asNumber(raw.uid, fallbackId);
  const entry = normalizeEntry(
    {
      ...rest,
      comment: raw.comment,
      keys: raw.key,
      secondary_keys: raw.keysecondary,
      content: raw.content,
      constant: raw.constant,
      enabled: raw.disable !== true,
      insertion_order: raw.order,
      position: raw.position === 0 ? 'before_char' : 'after_char',
      selective: raw.selective,
      case_sensitive: raw.caseSensitive,
    },
    id,
  );
  // ST positions beyond before/after (e.g. at-depth) are kept so export restores them.
  if (typeof raw.position === 'number' && raw.position > 1) {
    entry.extensions = { ...entry.extensions, st_position: raw.position };
  }
  return entry;
}

function toStEntry(e: WorldEntry): Record<string, unknown> {
  const { id, comment, keys, secondary_keys, content, constant, enabled, insertion_order, position, selective, case_sensitive, ...rest } = e;
  const extensions = { ...(rest.extensions as Record<string, unknown> | undefined) };
  const stPosition = typeof extensions.st_position === 'number' ? extensions.st_position : null;
  delete extensions.st_position;
  return {
    ...rest,
    extensions,
    uid: id,
    comment: comment ?? '',
    key: keys,
    keysecondary: secondary_keys ?? [],
    content,
    constant: constant === true,
    disable: !enabled,
    order: insertion_order,
    position: stPosition ?? (position === 'before_char' ? 0 : 1),
    selective: selective !== false,
    caseSensitive: case_sensitive === true,
  };
}

export function worldToSillyTavern(world: WorldBook): Record<string, unknown> {
  return {
    ...world.extra,
    name: world.name,
    description: world.description,
    scan_depth: world.scan_depth,
    token_budget: world.token_budget,
    entries: Object.fromEntries(world.entries.map((e) => [String(e.id), toStEntry(e)])),
  };
}

/**
 * Accepts a SillyTavern World Info file, a bare character_book, or a whole
 * character card that embeds one. Returns null if nothing usable is found.
 */
export function parseWorldJson(raw: unknown, fallbackName: string): Omit<WorldBook, 'id' | 'updated_at' | 'global'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const embedded = (obj.data as Record<string, unknown> | undefined)?.character_book;
  if (embedded && typeof embedded === 'object') return worldFromCharacterBook(embedded as CharacterBook, fallbackName);

  if (Array.isArray(obj.entries)) return worldFromCharacterBook(obj as unknown as CharacterBook, fallbackName);

  if (obj.entries && typeof obj.entries === 'object') {
    const { entries, name, description, scan_depth, token_budget, ...extra } = obj;
    const list = Object.values(entries as Record<string, Record<string, unknown>>).map((e, i) => fromStEntry(e, i + 1));
    return {
      name: typeof name === 'string' && name.trim() ? name : fallbackName,
      description: typeof description === 'string' ? description : '',
      scan_depth: asNumber(scan_depth, DEFAULT_SCAN_DEPTH),
      token_budget: asNumber(token_budget, DEFAULT_WORLD_TOKEN_BUDGET),
      entries: list,
      extra,
    };
  }
  return null;
}

/** A short name for lists and budget reports. */
export function entryLabel(e: CharacterBookEntry): string {
  return (typeof e.comment === 'string' && e.comment.trim()) || e.keys[0] || '（未命名條目）';
}
