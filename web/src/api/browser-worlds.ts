import { parseWorldJson, worldToSillyTavern, type WorldBook } from '@tavern/shared';
import { t } from '../i18n/zh-TW';
import { fileBytes, findWorld, nextId, now, persist, safeFileName, state, toWorldSummary } from './browser-store';
import { ready, requireName } from './browser-util';
import { ApiRequestError, type TavernApi } from './types';

export function newWorld(fields: Partial<WorldBook> & { name: string }): WorldBook {
  return { id: nextId(), description: '', global: false, entries: [], extra: {}, updated_at: now(), ...fields };
}

export const worldApi: Pick<
  TavernApi,
  'listWorldBooks' | 'getWorldBook' | 'createWorldBook' | 'saveWorldBook' | 'deleteWorldBook' | 'importWorldBook' | 'exportWorldBook'
> = {
  listWorldBooks: ready(async () => [...state.worlds].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(toWorldSummary)),

  getWorldBook: ready(async (id: number) => structuredClone(findWorld(id))),

  createWorldBook: ready(async (name: string) => {
    requireName(name);
    const w = newWorld({ name: name.trim() });
    state.worlds.unshift(w);
    await persist();
    return structuredClone(w);
  }),

  saveWorldBook: ready(async (book: WorldBook) => {
    requireName(book.name);
    const i = state.worlds.findIndex((w) => w.id === book.id);
    if (i < 0) throw new ApiRequestError('NOT_FOUND', t.data.notFound.world, 404);
    const saved: WorldBook = { ...structuredClone(book), name: book.name.trim(), updated_at: now() };
    state.worlds[i] = saved;
    await persist();
    return structuredClone(saved);
  }),

  deleteWorldBook: ready(async (id: number) => {
    state.worlds = state.worlds.filter((w) => w.id !== id);
    for (const c of state.characters) if (c.world_book_id === id) c.world_book_id = null;
    await persist();
  }),

  importWorldBook: ready(async (file: File) => {
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(await fileBytes(file)));
    } catch {
      throw new ApiRequestError('BAD_JSON', t.transfer.errors.BAD_JSON);
    }
    const parsed = parseWorldJson(raw, file.name.replace(/\.json$/i, ''));
    if (!parsed) throw new ApiRequestError('NOT_A_WORLD', t.transfer.errors.notWorld);
    const w = newWorld(parsed);
    state.worlds.unshift(w);
    await persist();
    return structuredClone(w);
  }),

  exportWorldBook: ready(async (id: number) => {
    const w = findWorld(id);
    const text = JSON.stringify(worldToSillyTavern(w), null, 2);
    return { blob: new Blob([text], { type: 'application/json' }), fileName: safeFileName(w.name, 'json') };
  }),
};
