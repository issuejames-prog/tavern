import {
  DEFAULT_CONTEXT_TOKENS,
  DEFAULT_GEN_PARAMS,
  type CharacterDetail,
  type ChatSummary,
  type MessageRecord,
  type ModelProfile,
  type WorldBook,
  type WorldBookSummary,
} from '@tavern/shared';
import { avatarKey, getBlob, loadState, saveState, type BrowserState, type StoredCharacter, type StoredChat } from './browser-db';
import { SAMPLE_CARDS } from './sample-data';
import { ApiRequestError } from './types';

// In-memory working copy of the database plus small helpers shared by the API modules.

export const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

export const DEFAULT_SYSTEM_PROMPT =
  '你正在與{{user}}進行一場沒有壓力的角色扮演。請完全以{{char}}的身分、語氣與觀點回應，' +
  '描寫細節、保持角色一致，不要替{{user}}說話或決定{{user}}的行動。使用繁體中文。';

export function initialState(): BrowserState {
  return {
    version: 2,
    seq: 100,
    characters: SAMPLE_CARDS.map((s, i) => ({
      id: i + 1,
      card: s.card,
      avatar_color: s.color,
      has_avatar: false,
      world_book_id: null,
      updated_at: now(),
    })),
    chats: [],
    messages: [],
    worlds: [],
    settings: { user_name: '旅人', system_prompt: DEFAULT_SYSTEM_PROMPT },
    profile: {
      id: 1,
      name: 'OpenRouter',
      provider: 'openrouter',
      base_url: 'https://openrouter.ai/api/v1',
      model: 'deepseek/deepseek-chat-v3-0324',
      params: { ...DEFAULT_GEN_PARAMS },
      context_tokens: DEFAULT_CONTEXT_TOKENS,
    },
    usage: { day: today(), requests: 0 },
  };
}

export let state: BrowserState = initialState();
const avatarUrls = new Map<number, string>();

let ready: Promise<void> | null = null;
/** Every API call awaits this first: loads IndexedDB (and migrates old data) once. */
export function ensureReady(): Promise<void> {
  ready ??= (async () => {
    state = (await loadState()) ?? initialState();
    await Promise.all(state.characters.filter((c) => c.has_avatar).map((c) => refreshAvatarUrl(c.id)));
  })();
  return ready;
}

export function replaceState(next: BrowserState) {
  state = next;
}

export function persist(): Promise<void> {
  return saveState(state);
}

export const nextId = () => ++state.seq;

// ---------- API key (kept apart from app data so backups never contain it) ----------

const API_KEY_KEY = 'tavern-openrouter-key';
let memoryKey: string | null = null;

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_KEY) ?? memoryKey;
  } catch {
    return memoryKey;
  }
}

export function setApiKey(key: string) {
  const trimmed = key.trim();
  memoryKey = trimmed || null;
  try {
    if (trimmed) localStorage.setItem(API_KEY_KEY, trimmed);
    else localStorage.removeItem(API_KEY_KEY);
  } catch {
    // storage blocked: the key lives in memory for this tab only
  }
}

export const currentProfile = (): ModelProfile => ({ ...state.profile, key_present: Boolean(getApiKey()) });

// ---------- avatars ----------

export async function refreshAvatarUrl(characterId: number): Promise<void> {
  const old = avatarUrls.get(characterId);
  if (old) URL.revokeObjectURL(old);
  avatarUrls.delete(characterId);
  const blob = await getBlob(avatarKey(characterId));
  if (blob) avatarUrls.set(characterId, URL.createObjectURL(blob));
}

export function forgetAvatarUrl(characterId: number) {
  const old = avatarUrls.get(characterId);
  if (old) URL.revokeObjectURL(old);
  avatarUrls.delete(characterId);
}

// ---------- lookups and mapping to API types ----------

export function findCharacter(id: number): StoredCharacter {
  const c = state.characters.find((x) => x.id === id);
  if (!c) throw new ApiRequestError('NOT_FOUND', '找不到角色', 404);
  return c;
}

export function findWorld(id: number): WorldBook {
  const w = state.worlds.find((x) => x.id === id);
  if (!w) throw new ApiRequestError('NOT_FOUND', '找不到世界書', 404);
  return w;
}

export function findChat(id: number): StoredChat {
  const chat = state.chats.find((c) => c.id === id);
  if (!chat) throw new ApiRequestError('NOT_FOUND', '找不到這段對話', 404);
  return chat;
}

export function toCharacterDetail(c: StoredCharacter): CharacterDetail {
  return {
    id: c.id,
    name: c.card.data.name,
    description: c.card.data.description,
    tags: c.card.data.tags,
    avatar_color: c.avatar_color,
    avatar_url: avatarUrls.get(c.id) ?? null,
    world_book_id: c.world_book_id,
    updated_at: c.updated_at,
    card: c.card,
  };
}

export function toChatSummary(chat: StoredChat): ChatSummary {
  const ch = findCharacter(chat.character_id);
  const last = state.messages.filter((m) => m.chat_id === chat.id).at(-1);
  return {
    id: chat.id,
    title: chat.title,
    character_id: chat.character_id,
    character_name: ch.card.data.name,
    avatar_color: ch.avatar_color,
    avatar_url: avatarUrls.get(ch.id) ?? null,
    updated_at: chat.updated_at,
    last_message: last?.content ?? null,
  };
}

export function toWorldSummary(w: WorldBook): WorldBookSummary {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    global: w.global,
    entry_count: w.entries.length,
    enabled_count: w.entries.filter((e) => e.enabled !== false).length,
    linked_characters: state.characters.filter((c) => c.world_book_id === w.id).map((c) => c.card.data.name),
    updated_at: w.updated_at,
  };
}

export function addMessage(
  chatId: number,
  role: MessageRecord['role'],
  content: string,
  extra: Partial<Pick<MessageRecord, 'status' | 'prompt_tokens' | 'completion_tokens'>> = {},
): MessageRecord {
  const prev = state.messages.filter((m) => m.chat_id === chatId).at(-1);
  const msg: MessageRecord = {
    id: nextId(),
    chat_id: chatId,
    parent_id: prev?.id ?? null,
    role,
    content,
    status: extra.status ?? 'complete',
    prompt_tokens: extra.prompt_tokens ?? null,
    completion_tokens: extra.completion_tokens ?? null,
    created_at: now(),
  };
  state.messages.push(msg);
  const chat = state.chats.find((c) => c.id === chatId);
  if (chat) chat.updated_at = now();
  return msg;
}

export function usageToday() {
  if (state.usage.day !== today()) state.usage = { day: today(), requests: 0 };
  return state.usage;
}

/** Reads a File into bytes (works in every current browser). */
export async function fileBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Turns arbitrary text into a safe download file name. */
export function safeFileName(name: string, ext: string): string {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim() || 'tavern';
  return `${base}.${ext}`;
}
