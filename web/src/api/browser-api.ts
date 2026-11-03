import {
  assemblePrompt,
  DEFAULT_CONTEXT_TOKENS,
  DEFAULT_GEN_PARAMS,
  emptyCardData,
  estimateTokens,
  normalizeCard,
  substituteVars,
  type AppSettings,
  type CharacterCardV2,
  type CharacterDetail,
  type ChatDetail,
  type ChatSummary,
  type MessageRecord,
  type ModelProfile,
  type TokenUsage,
} from '@tavern/shared';
import { t } from '../i18n/zh-TW';
import { BrowserLlmError, streamCompletion } from './browser-llm';
import { SAMPLE_CARDS } from './sample-data';
import { ApiRequestError, type TavernApi } from './types';

/*
 * Browser mode (GitHub Pages build): the whole "server" runs in this tab.
 * Data lives in localStorage; the OpenRouter key is stored separately in this
 * browser only and is sent nowhere except the model provider.
 */

interface StoredCharacter {
  id: number;
  card: CharacterCardV2;
  avatar_color: string;
  updated_at: string;
}
interface StoredChat {
  id: number;
  title: string;
  character_id: number;
  updated_at: string;
}
interface BrowserState {
  version: 1;
  seq: number;
  characters: StoredCharacter[];
  chats: StoredChat[];
  messages: MessageRecord[];
  settings: AppSettings;
  profile: Omit<ModelProfile, 'key_present'>;
  usage: { day: string; requests: number };
}

const STATE_KEY = 'tavern-browser-v1';
const API_KEY_KEY = 'tavern-openrouter-key';
const DAILY_LIMIT = 300;

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function initialState(): BrowserState {
  return {
    version: 1,
    seq: 100,
    characters: SAMPLE_CARDS.map((s, i) => ({ id: i + 1, card: s.card, avatar_color: s.color, updated_at: now() })),
    chats: [],
    messages: [],
    settings: {
      user_name: '旅人',
      system_prompt:
        '你正在與{{user}}進行一場沒有壓力的角色扮演。請完全以{{char}}的身分、語氣與觀點回應，' +
        '描寫細節、保持角色一致，不要替{{user}}說話或決定{{user}}的行動。使用繁體中文。',
    },
    profile: {
      id: 1,
      name: 'OpenRouter',
      provider: 'openrouter',
      base_url: 'https://openrouter.ai/api/v1',
      model: 'deepseek/deepseek-chat-v3-0324',
      key_env: 'OPENROUTER_API_KEY',
      params: { ...DEFAULT_GEN_PARAMS },
      context_tokens: DEFAULT_CONTEXT_TOKENS,
      is_default: true,
    },
    usage: { day: today(), requests: 0 },
  };
}

// Every storage access is guarded: private windows and blocked storage throw.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function load(): BrowserState {
  const raw = readStorage(STATE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as BrowserState;
      if (parsed.version === 1) return parsed;
    } catch {
      // corrupted: start fresh rather than crash
    }
  }
  return initialState();
}

let state = load();
let memoryKey: string | null = null; // fallback when storage is unavailable

function persist() {
  if (!writeStorage(STATE_KEY, JSON.stringify(state))) {
    console.warn('[tavern] could not save to localStorage; data will be lost on reload');
  }
}

function getApiKey(): string | null {
  return readStorage(API_KEY_KEY) ?? memoryKey;
}
function setApiKey(key: string) {
  const trimmed = key.trim();
  memoryKey = trimmed || null;
  writeStorage(API_KEY_KEY, trimmed || null);
}

const nextId = () => ++state.seq;
const profile = (): ModelProfile => ({ ...state.profile, key_present: Boolean(getApiKey()) });

function findCharacter(id: number): StoredCharacter {
  const c = state.characters.find((x) => x.id === id);
  if (!c) throw new ApiRequestError('NOT_FOUND', '找不到角色', 404);
  return c;
}

function toDetail(c: StoredCharacter): CharacterDetail {
  return {
    id: c.id,
    name: c.card.data.name,
    description: c.card.data.description,
    tags: Array.isArray(c.card.data.tags) ? c.card.data.tags : [],
    avatar_color: c.avatar_color,
    updated_at: c.updated_at,
    card: c.card,
  };
}

function toSummary(chat: StoredChat): ChatSummary {
  const ch = findCharacter(chat.character_id);
  const last = state.messages.filter((m) => m.chat_id === chat.id).at(-1);
  return {
    id: chat.id,
    title: chat.title,
    character_id: chat.character_id,
    character_name: ch.card.data.name,
    avatar_color: ch.avatar_color,
    updated_at: chat.updated_at,
    last_message: last?.content ?? null,
  };
}

function chatDetail(id: number): ChatDetail {
  const chat = state.chats.find((c) => c.id === id);
  if (!chat) throw new ApiRequestError('NOT_FOUND', '找不到這段對話', 404);
  return { ...toSummary(chat), model_profile_id: 1, messages: state.messages.filter((m) => m.chat_id === id) };
}

function addMessage(
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

function usageToday() {
  if (state.usage.day !== today()) state.usage = { day: today(), requests: 0 };
  return state.usage;
}

export const browserApi: TavernApi = {
  mode: 'browser',

  // Single user, single browser: there is nothing to log in to.
  async me() {
    return { authenticated: true };
  },
  async login() {},
  async logout() {},

  async listCharacters() {
    return state.characters.map((c) => {
      const { card: _card, ...summary } = toDetail(c);
      return summary;
    });
  },
  async getCharacter(id) {
    return toDetail(findCharacter(id));
  },
  async createCharacter(input) {
    const card = normalizeCard({ spec: 'chara_card_v2', data: { ...emptyCardData(), ...input.data } });
    if (!card.data.name.trim()) throw new ApiRequestError('NAME_REQUIRED', t.editor.nameRequired, 400);
    const c: StoredCharacter = { id: nextId(), card, avatar_color: input.avatar_color ?? 'sage', updated_at: now() };
    state.characters.unshift(c);
    persist();
    return toDetail(c);
  },
  async updateCharacter(id, input) {
    const c = findCharacter(id);
    if (input.data.name !== undefined && !input.data.name.trim()) {
      throw new ApiRequestError('NAME_REQUIRED', t.editor.nameRequired, 400);
    }
    // Merge so fields the editor doesn't know about survive.
    c.card = { ...c.card, data: { ...c.card.data, ...input.data } };
    if (input.avatar_color) c.avatar_color = input.avatar_color;
    c.updated_at = now();
    persist();
    return toDetail(c);
  },
  async deleteCharacter(id) {
    const chatIds = new Set(state.chats.filter((c) => c.character_id === id).map((c) => c.id));
    state.characters = state.characters.filter((c) => c.id !== id);
    state.chats = state.chats.filter((c) => !chatIds.has(c.id));
    state.messages = state.messages.filter((m) => !chatIds.has(m.chat_id));
    persist();
  },

  async listChats() {
    return [...state.chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(toSummary);
  },
  async getChat(id) {
    return chatDetail(id);
  },
  async createChat(characterId) {
    const ch = findCharacter(characterId);
    const date = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    const chat: StoredChat = {
      id: nextId(),
      title: `與${ch.card.data.name}的對話 · ${date}`,
      character_id: characterId,
      updated_at: now(),
    };
    state.chats.push(chat);
    if (ch.card.data.first_mes.trim()) {
      addMessage(chat.id, 'assistant', substituteVars(ch.card.data.first_mes, { char: ch.card.data.name, user: state.settings.user_name }));
    }
    persist();
    return chatDetail(chat.id);
  },
  async deleteChat(id) {
    state.chats = state.chats.filter((c) => c.id !== id);
    state.messages = state.messages.filter((m) => m.chat_id !== id);
    persist();
  },

  // Mirrors server/src/services/chat-service.ts step by step (CLAUDE.md §4).
  async generate(chatId, content, onEvent, signal) {
    const chat = chatDetail(chatId);

    // 1. Save the user's message first so a failure never loses it.
    const userMsg = addMessage(chatId, 'user', content);
    persist();
    onEvent({ type: 'user_saved', message: userMsg });

    let partial = '';
    const fail = (code: string, message: string) => {
      const saved = partial ? addMessage(chatId, 'assistant', partial, { status: 'error' }) : null;
      persist();
      onEvent({ type: 'error', code, message, partial: saved });
    };

    const apiKey = getApiKey();
    if (!apiKey) return fail('MISSING_API_KEY', t.browser.errors.missingKey);
    if (usageToday().requests >= DAILY_LIMIT) return fail('DAILY_LIMIT', t.browser.errors.dailyLimit(DAILY_LIMIT));

    // 2–5. Character + history → assemble within budget.
    const card = findCharacter(chat.character_id).card.data;
    const p = profile();
    const assembled = assemblePrompt({
      systemPrompt: state.settings.system_prompt,
      card,
      userName: state.settings.user_name,
      world: [],
      history: chat.messages.filter((m) => m.content.trim()).map((m) => ({ role: m.role, content: m.content })),
      latestUser: content,
      budget: p.context_tokens - p.params.max_tokens,
      countTokens: estimateTokens,
    });

    // 6. Stream from the provider.
    let usage: TokenUsage | null = null;
    usageToday().requests += 1;
    try {
      for await (const text of streamCompletion({
        profile: p,
        apiKey,
        messages: assembled.messages,
        params: p.params,
        signal,
        onUsage: (u) => (usage = u),
      })) {
        partial += text;
        onEvent({ type: 'delta', text });
      }
    } catch (err) {
      if (!signal.aborted) {
        if (err instanceof BrowserLlmError) return fail(err.code, err.message);
        return fail('GENERATION_FAILED', t.browser.errors.generic(err instanceof Error ? err.message : ''));
      }
    }

    // 7. Save the reply; an aborted stream keeps whatever arrived.
    if (!partial) {
      persist();
      return;
    }
    const finalUsage = usage as TokenUsage | null;
    const reply = addMessage(chatId, 'assistant', partial, {
      status: signal.aborted ? 'aborted' : 'complete',
      prompt_tokens: finalUsage?.prompt_tokens ?? assembled.tokens,
      completion_tokens: finalUsage?.completion_tokens ?? null,
    });
    persist();
    if (!signal.aborted) onEvent({ type: 'done', message: reply, usage: finalUsage });
  },

  async getSettings() {
    return { settings: state.settings, profiles: [profile()], usage_today: { requests: usageToday().requests, limit: DAILY_LIMIT } };
  },
  async updateSettings(input) {
    if (input.user_name !== undefined && !input.user_name.trim()) {
      throw new ApiRequestError('BAD_VALUE', '暱稱不能是空的', 400);
    }
    state.settings = { ...state.settings, ...input };
    persist();
    return this.getSettings();
  },
  async updateProfile(_id, input) {
    const { params, api_key, ...rest } = input;
    const next = { ...state.profile, ...rest, params: { ...state.profile.params, ...params } };
    if (next.params.max_tokens >= next.context_tokens) {
      throw new ApiRequestError('BAD_VALUE', '單次輸出上限必須小於上下文長度', 400);
    }
    if (!/^https:\/\//.test(next.base_url)) throw new ApiRequestError('BAD_VALUE', 'API 位址必須以 https:// 開頭', 400);
    state.profile = next;
    if (api_key !== undefined) setApiKey(api_key);
    persist();
    return profile();
  },
};
