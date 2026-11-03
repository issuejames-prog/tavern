import type { AppSettings, CharacterCardV2, MessageRecord, ModelProfile, WorldBook } from '@tavern/shared';

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
  updated_at: string;
}
export interface BrowserState {
  version: 2;
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

/** Older shapes → current shape. */
function upgrade(raw: unknown): BrowserState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown> & { version?: number };
  if (s.version === 2) return s as unknown as BrowserState;
  if (s.version === 1) {
    const v1 = s as unknown as Omit<BrowserState, 'version' | 'worlds' | 'characters'> & {
      characters: Omit<StoredCharacter, 'has_avatar' | 'world_book_id'>[];
    };
    return {
      ...v1,
      version: 2,
      worlds: [],
      characters: v1.characters.map((c) => ({ ...c, has_avatar: false, world_book_id: null })),
    };
  }
  return null;
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
