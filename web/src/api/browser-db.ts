import {
  DEFAULT_AUTHOR_NOTE,
  DEFAULT_WORLD_SETTINGS,
  migrateEntry,
  type AppSettings,
  type AuthorNote,
  type CharacterCardV2,
  type MessageRecord,
  type ModelProfile,
  type WorldBook,
} from '@tavern/shared';

/*
 * Persistence for the whole app: one IndexedDB database in this browser.
 *   store "state" → a single record holding all characters, chats, messages, world books, settings
 *   store "blobs" → avatar images, keyed "avatar:<characterId>"
 * IndexedDB (unlike localStorage's ~5 MB) has room for PNG cards.
 */

export interface StoredCharacter {
  id: number;
  card: CharacterCardV2;
  avatar_color: string;
  has_avatar: boolean;
  world_book_id: number | null;
  updated_at: string;
}
export interface StoredChat {
  id: number;
  title: string;
  character_id: number;
  author_note: AuthorNote;
  updated_at: string;
}
export const STATE_VERSION = 3;

export interface BrowserState {
  version: 3;
  seq: number;
  characters: StoredCharacter[];
  chats: StoredChat[];
  messages: MessageRecord[];
  worlds: WorldBook[];
  settings: AppSettings;
  profile: Omit<ModelProfile, 'key_present'>;
  usage: { day: string; requests: number };
}

const DB_NAME = 'tavern';
const STATE_KEY = 'main';
// Stage-one data lived in localStorage; it is migrated once, then removed.
const LEGACY_STORAGE_KEY = 'tavern-browser-v1';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('state');
        req.result.createObjectStore('blobs');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null); // IndexedDB unavailable (some private modes): run in memory
    }
  });
  return dbPromise;
}

function request<T>(store: 'state' | 'blobs', mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db) return resolve(undefined);
        const tx = db.transaction(store, mode);
        const req = run(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export async function isPersistent(): Promise<boolean> {
  return (await openDb()) !== null;
}

/**
 * Older shapes → current shape (CLAUDE.md §4.6). Each step only adds or moves
 * fields, so nothing the user wrote is lost.
 *   v1 (stage 1, localStorage) → v2: world books, avatars, character ↔ world link
 *   v2 → v3: per-chat author's note, user persona, global world activation settings;
 *            entry options move into SillyTavern-style extensions
 */
export function upgrade(raw: unknown): BrowserState | null {
  if (!raw || typeof raw !== 'object') return null;
  let s = raw as Record<string, unknown> & { version?: number };

  if (s.version === 1) {
    const v1 = s as { characters?: Record<string, unknown>[] };
    s = {
      ...s,
      version: 2,
      worlds: [],
      characters: (v1.characters ?? []).map((c) => ({ ...c, has_avatar: false, world_book_id: null })),
    };
  }
  if (s.version === 2) {
    const v2 = s as {
      chats?: Record<string, unknown>[];
      settings?: Record<string, unknown>;
      worlds?: (Record<string, unknown> & { entries?: WorldBook['entries'] })[];
    };
    s = {
      ...s,
      version: 3,
      chats: (v2.chats ?? []).map((c) => ({ author_note: { ...DEFAULT_AUTHOR_NOTE }, ...c })),
      settings: { user_persona: '', world: { ...DEFAULT_WORLD_SETTINGS }, ...v2.settings },
      worlds: (v2.worlds ?? []).map(({ scan_depth, token_budget, extra, entries, ...w }) => ({
        ...w,
        // Per-book values are now global settings; keep the originals for export.
        extra: { ...(extra as Record<string, unknown> | undefined), scan_depth, token_budget },
        entries: (entries ?? []).map(migrateEntry),
      })),
    };
  }
  return s.version === STATE_VERSION ? (s as unknown as BrowserState) : null;
}

export async function loadState(): Promise<BrowserState | null> {
  const stored = upgrade(await request<unknown>('state', 'readonly', (s) => s.get(STATE_KEY)).catch(() => undefined));
  if (stored) return stored;

  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const migrated = legacy ? upgrade(JSON.parse(legacy)) : null;
    if (migrated) {
      await saveState(migrated);
      if (await isPersistent()) localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch {
    // unreadable legacy data: start fresh
  }
  return null;
}

// Writes are chained so a slow write can never overwrite a newer one.
let writeChain: Promise<unknown> = Promise.resolve();
export function saveState(state: BrowserState): Promise<void> {
  const snapshot = structuredClone(state);
  writeChain = writeChain
    .then(() => request('state', 'readwrite', (s) => s.put(snapshot, STATE_KEY)))
    .catch((err) => console.warn('[tavern] failed to save data', err));
  return writeChain.then(() => undefined);
}

export const avatarKey = (characterId: number) => `avatar:${characterId}`;

export async function getBlob(key: string): Promise<Blob | null> {
  return (await request<Blob>('blobs', 'readonly', (s) => s.get(key)).catch(() => undefined)) ?? null;
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  await request('blobs', 'readwrite', (s) => s.put(blob, key));
}

export async function deleteBlob(key: string): Promise<void> {
  await request('blobs', 'readwrite', (s) => s.delete(key));
}

export async function clearBlobs(): Promise<void> {
  await request('blobs', 'readwrite', (s) => s.clear());
}
