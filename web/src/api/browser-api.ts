import {
  CardImportError,
  cardToJsonText,
  cardToPng,
  emptyCardData,
  normalizeCard,
  parseCardFile,
  parseWorldJson,
  substituteVars,
  worldToCharacterBook,
  worldToSillyTavern,
  DEFAULT_SCAN_DEPTH,
  DEFAULT_WORLD_TOKEN_BUDGET,
  type AppSettings,
  type CharacterCardV2,
  type WorldBook,
} from '@tavern/shared';
import { t } from '../i18n/zh-TW';
import { avatarKey, clearBlobs, deleteBlob, getBlob, putBlob, type BrowserState } from './browser-db';
import { DAILY_LIMIT, generate, lastPromptByChat } from './browser-chat';
import { isImage, MAX_AVATAR_BYTES, placeholderPng, toPng } from './browser-images';
import {
  currentProfile,
  ensureReady,
  fileBytes,
  findCharacter,
  findChat,
  findWorld,
  forgetAvatarUrl,
  addMessage,
  nextId,
  now,
  persist,
  refreshAvatarUrl,
  replaceState,
  safeFileName,
  setApiKey,
  state,
  toCharacterDetail,
  toChatSummary,
  toWorldSummary,
  usageToday,
} from './browser-store';
import { ApiRequestError, type CharacterInput, type ProfileInput, type TavernApi } from './types';

const AVATAR_COLORS = ['sage', 'clay', 'sky', 'sand', 'plum'];
const randomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
const BACKUP_FORMAT = 'tavern-backup';

/** Wraps every method so storage is loaded before any call. */
function ready<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    await ensureReady();
    return fn(...args);
  };
}

function requireName(name: string | undefined) {
  if (name !== undefined && !name.trim()) throw new ApiRequestError('NAME_REQUIRED', t.editor.nameRequired);
}

async function storeAvatar(characterId: number, image: Blob) {
  if (image.size > MAX_AVATAR_BYTES) throw new ApiRequestError('AVATAR_TOO_LARGE', t.transfer.errors.avatarTooLarge);
  await putBlob(avatarKey(characterId), image);
  await refreshAvatarUrl(characterId);
}

function newWorld(fields: Partial<WorldBook> & { name: string }): WorldBook {
  return {
    id: nextId(),
    description: '',
    scan_depth: DEFAULT_SCAN_DEPTH,
    token_budget: DEFAULT_WORLD_TOKEN_BUDGET,
    global: false,
    entries: [],
    extra: {},
    updated_at: now(),
    ...fields,
  };
}

/** The card as it should be exported: linked world book written back as character_book. */
function cardForExport(characterId: number): CharacterCardV2 {
  const c = findCharacter(characterId);
  const world = c.world_book_id ? state.worlds.find((w) => w.id === c.world_book_id) : undefined;
  if (!world) return c.card;
  return {
    ...c.card,
    data: {
      ...c.card.data,
      character_book: worldToCharacterBook(world),
      extensions: { ...c.card.data.extensions, world: world.name },
    },
  };
}

/** Decodes a base64 data URL without fetch() (the page's CSP only allows OpenRouter). */
function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new ApiRequestError('NOT_A_BACKUP', t.transfer.errors.notBackup);
  const bin = atob(match[2]!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}

function bytesBlob(bytes: Uint8Array, type: string): Blob {
  // Copy into a fresh ArrayBuffer-backed array so Blob accepts it in every TS lib version.
  return new Blob([new Uint8Array(bytes)], { type });
}

export const browserApi: TavernApi = {
  // ---------- characters ----------
  listCharacters: ready(async () =>
    [...state.characters]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((c) => {
        const { card: _card, ...summary } = toCharacterDetail(c);
        return summary;
      }),
  ),

  getCharacter: ready(async (id: number) => toCharacterDetail(findCharacter(id))),

  createCharacter: ready(async (input: CharacterInput) => {
    const card = normalizeCard({ spec: 'chara_card_v2', spec_version: '2.0', data: { ...emptyCardData(), ...input.data } });
    requireName(card.data.name);
    const c = {
      id: nextId(),
      card,
      avatar_color: input.avatar_color ?? randomColor(),
      has_avatar: false,
      world_book_id: input.world_book_id ?? null,
      updated_at: now(),
    };
    state.characters.unshift(c);
    await persist();
    return toCharacterDetail(c);
  }),

  updateCharacter: ready(async (id: number, input: CharacterInput) => {
    const c = findCharacter(id);
    requireName(input.data.name);
    // Merge so fields the editor doesn't know about survive (CLAUDE.md §8.1).
    c.card = { ...c.card, data: { ...c.card.data, ...input.data } };
    if (input.avatar_color) c.avatar_color = input.avatar_color;
    if (input.world_book_id !== undefined) c.world_book_id = input.world_book_id;
    c.updated_at = now();
    await persist();
    return toCharacterDetail(c);
  }),

  deleteCharacter: ready(async (id: number) => {
    const chatIds = new Set(state.chats.filter((c) => c.character_id === id).map((c) => c.id));
    state.characters = state.characters.filter((c) => c.id !== id);
    state.chats = state.chats.filter((c) => !chatIds.has(c.id));
    state.messages = state.messages.filter((m) => !chatIds.has(m.chat_id));
    forgetAvatarUrl(id);
    await deleteBlob(avatarKey(id));
    await persist();
  }),

  importCharacter: ready(async (file: File) => {
    let parsed;
    try {
      parsed = parseCardFile(file.name, await fileBytes(file));
    } catch (err) {
      const code = err instanceof CardImportError ? err.code : 'NOT_A_CARD';
      throw new ApiRequestError(code, t.transfer.errors[code]);
    }
    const { card, image } = parsed;

    // An embedded character_book becomes a real world book, linked to the character.
    let world: WorldBook | null = null;
    const embedded = parseWorldJson(card, t.worlds.embeddedName(card.data.name));
    if (embedded && embedded.entries.length > 0) {
      world = newWorld(embedded);
      state.worlds.unshift(world);
    }

    const c = {
      id: nextId(),
      card,
      avatar_color: randomColor(),
      has_avatar: Boolean(image),
      world_book_id: world?.id ?? null,
      updated_at: now(),
    };
    state.characters.unshift(c);
    if (image) await storeAvatar(c.id, bytesBlob(image, 'image/png'));
    await persist();
    return { character: toCharacterDetail(c), world: world ? toWorldSummary(world) : null };
  }),

  exportCharacter: ready(async (id: number, format: 'png' | 'json') => {
    const c = findCharacter(id);
    const card = cardForExport(id);
    if (format === 'json') {
      return { blob: new Blob([cardToJsonText(card)], { type: 'application/json' }), fileName: safeFileName(card.data.name, 'json') };
    }
    const stored = c.has_avatar ? await getBlob(avatarKey(id)) : null;
    const base = stored ? await toPng(stored) : await placeholderPng(card.data.name, c.avatar_color);
    const png = cardToPng(card, await fileBytes(base));
    return { blob: bytesBlob(png, 'image/png'), fileName: safeFileName(card.data.name, 'png') };
  }),

  setAvatar: ready(async (id: number, file: File | null) => {
    const c = findCharacter(id);
    if (file) {
      if (!isImage(file)) throw new ApiRequestError('NOT_IMAGE', t.transfer.errors.notImage);
      await storeAvatar(id, file);
      c.has_avatar = true;
    } else {
      await deleteBlob(avatarKey(id));
      forgetAvatarUrl(id);
      c.has_avatar = false;
    }
    c.updated_at = now();
    await persist();
    return toCharacterDetail(c);
  }),

  // ---------- chats ----------
  listChats: ready(async () => [...state.chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(toChatSummary)),

  getChat: ready(async (id: number) => {
    const chat = findChat(id);
    return {
      ...toChatSummary(chat),
      messages: state.messages.filter((m) => m.chat_id === id),
      last_prompt: lastPromptByChat.get(id) ?? null,
    };
  }),

  createChat: ready(async (characterId: number) => {
    const ch = findCharacter(characterId);
    const date = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    const chat = { id: nextId(), title: `與${ch.card.data.name}的對話 · ${date}`, character_id: characterId, updated_at: now() };
    state.chats.push(chat);
    if (ch.card.data.first_mes.trim()) {
      addMessage(chat.id, 'assistant', substituteVars(ch.card.data.first_mes, { char: ch.card.data.name, user: state.settings.user_name }));
    }
    await persist();
    return { ...toChatSummary(chat), messages: state.messages.filter((m) => m.chat_id === chat.id), last_prompt: null };
  }),

  deleteChat: ready(async (id: number) => {
    state.chats = state.chats.filter((c) => c.id !== id);
    state.messages = state.messages.filter((m) => m.chat_id !== id);
    lastPromptByChat.delete(id);
    await persist();
  }),

  generate,

  // ---------- world books ----------
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
    if (i < 0) throw new ApiRequestError('NOT_FOUND', '找不到世界書', 404);
    const saved: WorldBook = {
      ...structuredClone(book),
      name: book.name.trim(),
      scan_depth: Math.max(1, Math.min(50, Math.round(book.scan_depth) || DEFAULT_SCAN_DEPTH)),
      token_budget: Math.max(0, Math.round(book.token_budget) || 0),
      updated_at: now(),
    };
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

  // ---------- settings ----------
  getSettings: ready(async () => ({
    settings: state.settings,
    profile: currentProfile(),
    usage_today: { requests: usageToday().requests, limit: DAILY_LIMIT },
  })),

  updateSettings: ready(async (input: Partial<AppSettings>) => {
    if (input.user_name !== undefined && !input.user_name.trim()) throw new ApiRequestError('BAD_VALUE', '暱稱不能是空的');
    state.settings = { ...state.settings, ...input };
    await persist();
    return { settings: state.settings, profile: currentProfile(), usage_today: { requests: usageToday().requests, limit: DAILY_LIMIT } };
  }),

  updateProfile: ready(async (input: ProfileInput) => {
    const { params, api_key, ...rest } = input;
    const next = { ...state.profile, ...rest, params: { ...state.profile.params, ...params } };
    if (!(next.params.temperature >= 0 && next.params.temperature <= 2)) throw new ApiRequestError('BAD_VALUE', '溫度需介於 0 到 2 之間');
    if (!(next.params.top_p > 0 && next.params.top_p <= 1)) throw new ApiRequestError('BAD_VALUE', 'Top P 需介於 0 到 1 之間');
    if (!(next.params.max_tokens >= 16)) throw new ApiRequestError('BAD_VALUE', '單次回覆上限至少要 16');
    if (next.params.max_tokens >= next.context_tokens) throw new ApiRequestError('BAD_VALUE', '單次回覆上限必須小於上下文長度');
    if (!/^https:\/\//.test(next.base_url)) throw new ApiRequestError('BAD_VALUE', 'API 位址必須以 https:// 開頭');
    if (!next.model.trim()) throw new ApiRequestError('BAD_VALUE', '模型 ID 不能是空的');
    state.profile = next;
    if (api_key !== undefined) setApiKey(api_key);
    await persist();
    return currentProfile();
  }),

  // ---------- backup ----------
  exportBackup: ready(async () => {
    // Avatars travel as data URLs; the API key is deliberately NOT included.
    const avatars: Record<string, string> = {};
    for (const c of state.characters.filter((x) => x.has_avatar)) {
      const blob = await getBlob(avatarKey(c.id));
      if (blob) {
        avatars[c.id] = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
      }
    }
    const payload = { format: BACKUP_FORMAT, version: 2, exported_at: now(), state, avatars };
    const date = new Date().toISOString().slice(0, 10);
    return { blob: new Blob([JSON.stringify(payload)], { type: 'application/json' }), fileName: `tavern-backup-${date}.json` };
  }),

  importBackup: ready(async (file: File) => {
    let payload: { format?: string; version?: number; state?: BrowserState; avatars?: Record<string, string> };
    try {
      payload = JSON.parse(new TextDecoder().decode(await fileBytes(file)));
    } catch {
      throw new ApiRequestError('BAD_JSON', t.transfer.errors.BAD_JSON);
    }
    const next = payload.state;
    if (payload.format !== BACKUP_FORMAT || !next || next.version !== 2 || !Array.isArray(next.characters)) {
      throw new ApiRequestError('NOT_A_BACKUP', t.transfer.errors.notBackup);
    }
    for (const c of state.characters) forgetAvatarUrl(c.id);
    await clearBlobs();
    replaceState(next);
    for (const [id, dataUrl] of Object.entries(payload.avatars ?? {})) {
      await putBlob(avatarKey(Number(id)), dataUrlToBlob(dataUrl));
      await refreshAvatarUrl(Number(id));
    }
    lastPromptByChat.clear();
    await persist();
  }),
};
