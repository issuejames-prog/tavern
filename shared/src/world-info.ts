import type { CharacterBook, CharacterBookEntry } from './card';

/*
 * World books (CLAUDE.md §4.3).
 * Entries keep the character_book shape. Options that the V2 spec has no field for
 * (insertion position beyond before/after, depth, probability, logic, recursion flags)
 * live in entry.extensions under the same keys SillyTavern uses when it embeds a
 * lorebook in a card — so files stay interchangeable in both directions.
 *
 * External formats:
 *   - character_book (embedded in cards; entries is an array)
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
  /** Applies to every chat (全局世界書); otherwise only to characters linked to it (角色世界書). */
  global: boolean;
  entries: WorldEntry[];
  /** Top-level fields from the imported file the app doesn't use (kept for export). */
  extra: Record<string, unknown>;
  updated_at: string;
}

/** Where an entry is inserted. Lower in the prompt = stronger influence. */
export type EntryPosition = 'before_char' | 'after_char' | 'an_top' | 'an_bottom' | 'at_depth';
/** Index = SillyTavern's numeric position (5/6, example-message positions, are preserved but treated as after_char). */
export const ENTRY_POSITIONS: EntryPosition[] = ['before_char', 'after_char', 'an_top', 'an_bottom', 'at_depth'];

export type EntryStatus = 'normal' | 'constant' | 'disabled';

/** How secondary keys combine with primary keys (SillyTavern selectiveLogic). */
export enum SelectiveLogic {
  AndAny = 0,
  NotAll = 1,
  NotAny = 2,
  AndAll = 3,
}

export interface EntryOptions {
  status: EntryStatus;
  position: EntryPosition;
  /** Only for at_depth: insert above the N-th message from the bottom. */
  depth: number;
  /** Trigger chance 0–100. */
  probability: number;
  logic: SelectiveLogic;
  /** Can't be activated by other entries' content. */
  excludeRecursion: boolean;
  /** This entry's content doesn't activate other entries. */
  preventRecursion: boolean;
}

export const DEFAULT_ENTRY_DEPTH = 4;

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
const asNumber = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const ext = (e: CharacterBookEntry): Record<string, unknown> =>
  e.extensions && typeof e.extensions === 'object' ? e.extensions : {};

export function readEntry(e: CharacterBookEntry): EntryOptions {
  const x = ext(e);
  const stPos = typeof x.position === 'number' ? x.position : null;
  const position: EntryPosition =
    stPos !== null && stPos >= 0 && stPos <= 4 ? ENTRY_POSITIONS[stPos]! : e.position === 'before_char' ? 'before_char' : 'after_char';
  return {
    status: e.enabled === false ? 'disabled' : e.constant ? 'constant' : 'normal',
    position,
    depth: Math.max(0, Math.round(asNumber(x.depth, DEFAULT_ENTRY_DEPTH))),
    probability: x.useProbability === false ? 100 : Math.min(100, Math.max(0, asNumber(x.probability, 100))),
    logic: [0, 1, 2, 3].includes(x.selectiveLogic as number) ? (x.selectiveLogic as SelectiveLogic) : SelectiveLogic.AndAny,
    excludeRecursion: x.exclude_recursion === true,
    preventRecursion: x.prevent_recursion === true,
  };
}

/** Writes options back in both the V2 fields and SillyTavern's extension keys. */
export function writeEntry<E extends CharacterBookEntry>(e: E, patch: Partial<EntryOptions>): E {
  const cur = { ...readEntry(e), ...patch };
  const x: Record<string, unknown> = { ...ext(e) };
  // Only touch the numeric position when it is being changed, so ST-only values (5/6) survive.
  if (patch.position !== undefined) x.position = ENTRY_POSITIONS.indexOf(cur.position);
  x.depth = cur.depth;
  x.probability = cur.probability;
  x.useProbability = cur.probability < 100;
  x.selectiveLogic = cur.logic;
  x.exclude_recursion = cur.excludeRecursion;
  x.prevent_recursion = cur.preventRecursion;
  return {
    ...e,
    enabled: cur.status !== 'disabled',
    constant: cur.status === 'constant',
    position: cur.position === 'before_char' ? 'before_char' : 'after_char',
    extensions: x,
  };
}

export function emptyEntry(id: number, order = 100): WorldEntry {
  return writeEntry(
    {
      id,
      comment: '',
      keys: [],
      secondary_keys: [],
      content: '',
      constant: false,
      selective: true,
      enabled: true,
      insertion_order: order,
      position: 'after_char',
      case_sensitive: false,
      extensions: {},
    },
    { position: 'after_char' },
  );
}

/** Fills defaults on a character_book entry, keeping every unknown field. */
function normalizeEntry(raw: Record<string, unknown>, id: number): WorldEntry {
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
    insertion_order: asNumber(raw.insertion_order, 100),
    position: raw.position === 'before_char' ? 'before_char' : 'after_char',
    case_sensitive: raw.case_sensitive === true,
    extensions: raw.extensions && typeof raw.extensions === 'object' ? (raw.extensions as Record<string, unknown>) : {},
  };
}

type ParsedWorld = Omit<WorldBook, 'id' | 'updated_at' | 'global'>;

// ---------- character_book ----------

export function worldFromCharacterBook(book: CharacterBook, fallbackName: string): ParsedWorld {
  // scan_depth / token_budget / recursive_scanning are global settings in this app (§4.3); kept in `extra` for export.
  const { name, description, entries, ...extra } = book;
  return {
    name: typeof name === 'string' && name.trim() ? name : fallbackName,
    description: typeof description === 'string' ? description : '',
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
    entries: world.entries.map((e) => ({ ...e })),
  };
}

// ---------- SillyTavern World Info file ----------

// ST field → where it lives in our entry. Every other ST field is kept on the entry as-is.
const ST_CORE = ['uid', 'key', 'keysecondary', 'content', 'constant', 'disable', 'order', 'comment', 'selective', 'caseSensitive'] as const;
const ST_TO_EXT: Record<string, string> = {
  position: 'position',
  depth: 'depth',
  probability: 'probability',
  useProbability: 'useProbability',
  selectiveLogic: 'selectiveLogic',
  excludeRecursion: 'exclude_recursion',
  preventRecursion: 'prevent_recursion',
};

function fromStEntry(raw: Record<string, unknown>, fallbackId: number): WorldEntry {
  const rest: Record<string, unknown> = {};
  const extensions: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if ((ST_CORE as readonly string[]).includes(k)) continue;
    if (k in ST_TO_EXT) extensions[ST_TO_EXT[k]!] = v;
    else rest[k] = v;
  }
  return normalizeEntry(
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
      extensions,
    },
    asNumber(raw.uid, fallbackId),
  );
}

function toStEntry(e: WorldEntry): Record<string, unknown> {
  const { id, comment, keys, secondary_keys, content, constant, enabled, insertion_order, position, selective, case_sensitive, extensions, ...rest } = e;
  const x: Record<string, unknown> = { ...(extensions ?? {}) };
  const out: Record<string, unknown> = { ...rest };
  for (const [stKey, extKey] of Object.entries(ST_TO_EXT)) {
    if (extKey in x) {
      out[stKey] = x[extKey];
      delete x[extKey];
    }
  }
  return {
    ...out,
    extensions: x,
    uid: id,
    comment: comment ?? '',
    key: keys,
    keysecondary: secondary_keys ?? [],
    content,
    constant: constant === true,
    disable: !enabled,
    order: insertion_order,
    position: typeof out.position === 'number' ? out.position : position === 'before_char' ? 0 : 1,
    selective: selective !== false,
    caseSensitive: case_sensitive === true,
  };
}

export function worldToSillyTavern(world: WorldBook): Record<string, unknown> {
  return {
    ...world.extra,
    name: world.name,
    description: world.description,
    entries: Object.fromEntries(world.entries.map((e) => [String(e.id), toStEntry(e)])),
  };
}

/**
 * Accepts a SillyTavern World Info file, a bare character_book, or a whole
 * character card that embeds one. Returns null if nothing usable is found.
 */
export function parseWorldJson(raw: unknown, fallbackName: string): ParsedWorld | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const embedded = (obj.data as Record<string, unknown> | undefined)?.character_book;
  if (embedded && typeof embedded === 'object') return worldFromCharacterBook(embedded as CharacterBook, fallbackName);

  if (Array.isArray(obj.entries)) return worldFromCharacterBook(obj as unknown as CharacterBook, fallbackName);

  if (obj.entries && typeof obj.entries === 'object') {
    const { entries, name, description, ...extra } = obj;
    return {
      name: typeof name === 'string' && name.trim() ? name : fallbackName,
      description: typeof description === 'string' ? description : '',
      entries: Object.values(entries as Record<string, Record<string, unknown>>).map((e, i) => fromStEntry(e, i + 1)),
      extra,
    };
  }
  return null;
}

/** Upgrades entries saved by older app versions (st_position → position). */
export function migrateEntry(e: WorldEntry): WorldEntry {
  const x = { ...ext(e) };
  if (typeof x.st_position === 'number') {
    x.position = x.st_position;
    delete x.st_position;
  }
  // Older SillyTavern imports kept these ST fields at the top level.
  const out: Record<string, unknown> = { ...e };
  for (const [stKey, extKey] of Object.entries(ST_TO_EXT)) {
    if (stKey !== 'position' && stKey in out && !(extKey in x)) {
      x[extKey] = out[stKey];
      delete out[stKey];
    }
  }
  return { ...(out as WorldEntry), extensions: x };
}

/** A short name for lists and budget reports. */
export function entryLabel(e: CharacterBookEntry): string {
  return (typeof e.comment === 'string' && e.comment.trim()) || e.keys[0] || '（未命名條目）';
}
