import {
  DEFAULT_CONTEXT_TOKENS,
  DEFAULT_GEN_PARAMS,
  emptyCardData,
  normalizeCard,
  type AppSettings,
  type CharacterCardV2,
  type CharacterDetail,
  type ChatDetail,
  type ChatSummary,
  type MessageRecord,
  type ModelProfile,
} from '@tavern/shared';
import { DEMO_CARDS } from './demo-data';
import { ApiRequestError, type TavernApi } from './types';

/*
 * In-browser stand-in for the server, used only by the GitHub Pages preview.
 * It never calls a model: replies are canned and streamed locally.
 */

interface DemoCharacter {
  id: number;
  card: CharacterCardV2;
  avatar_color: string;
  updated_at: string;
}
interface DemoChat {
  id: number;
  title: string;
  character_id: number;
  updated_at: string;
}
interface DemoState {
  seq: number;
  authed: boolean;
  characters: DemoCharacter[];
  chats: DemoChat[];
  messages: MessageRecord[];
  settings: AppSettings;
  profile: ModelProfile;
  requestsToday: number;
}

const STORAGE_KEY = 'tavern-demo-v1';
const now = () => new Date().toISOString();
const sub = (text: string, char: string, user: string) =>
  text.replace(/\{\{char\}\}/gi, char).replace(/\{\{user\}\}/gi, user);

function initialState(): DemoState {
  const s: DemoState = {
    seq: 100,
    authed: false,
    characters: DEMO_CARDS.map((d, i) => ({ id: i + 1, card: d.card, avatar_color: d.color, updated_at: now() })),
    chats: [],
    messages: [],
    settings: {
      user_name: '旅人',
      system_prompt: '你正在與{{user}}進行一場沒有壓力的角色扮演。請完全以{{char}}的身分回應，使用繁體中文。',
    },
    profile: {
      id: 1,
      name: 'OpenRouter',
      provider: 'openrouter',
      base_url: 'https://openrouter.ai/api/v1',
      model: 'deepseek/deepseek-chat-v3-0324',
      key_env: 'OPENROUTER_API_KEY',
      key_present: false,
      params: { ...DEFAULT_GEN_PARAMS },
      context_tokens: DEFAULT_CONTEXT_TOKENS,
      is_default: true,
    },
    requestsToday: 0,
  };
  return s;
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // storage unavailable (private mode, previews) — fall back to memory
  }
  return initialState();
}

let state = load();
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore: the demo still works in memory
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nextId = () => ++state.seq;

function findCharacter(id: number): DemoCharacter {
  const c = state.characters.find((x) => x.id === id);
  if (!c) throw new ApiRequestError('NOT_FOUND', '找不到角色', 404);
  return c;
}

function toDetail(c: DemoCharacter): CharacterDetail {
  return {
    id: c.id,
    name: c.card.data.name,
    description: c.card.data.description,
    tags: c.card.data.tags,
    avatar_color: c.avatar_color,
    updated_at: c.updated_at,
    card: c.card,
  };
}

function toSummary(chat: DemoChat): ChatSummary {
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

function addMessage(chatId: number, role: MessageRecord['role'], content: string, status: MessageRecord['status'] = 'complete') {
  const prev = state.messages.filter((m) => m.chat_id === chatId).at(-1);
  const msg: MessageRecord = {
    id: nextId(),
    chat_id: chatId,
    parent_id: prev?.id ?? null,
    role,
    content,
    status,
    prompt_tokens: null,
    completion_tokens: null,
    created_at: now(),
  };
  state.messages.push(msg);
  const chat = state.chats.find((c) => c.id === chatId);
  if (chat) chat.updated_at = now();
  return msg;
}

function requireAuth() {
  if (!state.authed) throw new ApiRequestError('UNAUTHORIZED', '請先登入', 401);
}

function cannedReply(chatId: number, userText: string): string {
  const chat = state.chats.find((c) => c.id === chatId)!;
  const ch = findCharacter(chat.character_id);
  const demo = DEMO_CARDS.find((d) => d.card.data.name === ch.card.data.name);
  const pool = demo?.replies ?? [
    '*{{char}}認真地聽著，點了點頭。*\n\n「「{{quote}}」……嗯，我記下了。再多說一些吧。」',
  ];
  // Count only previous replies (the greeting isn't one), so each chat starts at the first canned line.
  const turn = state.messages.filter((m) => m.chat_id === chatId && m.role === 'user').length - 1;
  const quote = userText.length > 18 ? `${userText.slice(0, 18)}…` : userText;
  return sub(pool[turn % pool.length]!, ch.card.data.name, state.settings.user_name).replace('{{quote}}', quote);
}

export const demoApi: TavernApi = {
  isDemo: true,
  async me() {
    return { authenticated: state.authed };
  },
  async login(password) {
    await delay(350);
    if (!password.trim()) throw new ApiRequestError('WRONG_PASSWORD', '隨便輸入一點文字就能進來喔', 401);
    state.authed = true;
    persist();
  },
  async logout() {
    state.authed = false;
    persist();
  },

  async listCharacters() {
    requireAuth();
    return state.characters.map((c) => {
      const { card: _card, ...summary } = toDetail(c);
      return summary;
    });
  },
  async getCharacter(id) {
    requireAuth();
    return toDetail(findCharacter(id));
  },
  async createCharacter(input) {
    requireAuth();
    const card = normalizeCard({ spec: 'chara_card_v2', data: { ...emptyCardData(), ...input.data } });
    const c: DemoCharacter = { id: nextId(), card, avatar_color: input.avatar_color ?? 'sage', updated_at: now() };
    state.characters.unshift(c);
    persist();
    return toDetail(c);
  },
  async updateCharacter(id, input) {
    requireAuth();
    const c = findCharacter(id);
    c.card = { ...c.card, data: { ...c.card.data, ...input.data } };
    if (input.avatar_color) c.avatar_color = input.avatar_color;
    c.updated_at = now();
    persist();
    return toDetail(c);
  },
  async deleteCharacter(id) {
    requireAuth();
    const chatIds = new Set(state.chats.filter((c) => c.character_id === id).map((c) => c.id));
    state.characters = state.characters.filter((c) => c.id !== id);
    state.chats = state.chats.filter((c) => !chatIds.has(c.id));
    state.messages = state.messages.filter((m) => !chatIds.has(m.chat_id));
    persist();
  },

  async listChats() {
    requireAuth();
    return [...state.chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(toSummary);
  },
  async getChat(id) {
    requireAuth();
    return chatDetail(id);
  },
  async createChat(characterId) {
    requireAuth();
    const ch = findCharacter(characterId);
    const date = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    const chat: DemoChat = { id: nextId(), title: `與${ch.card.data.name}的對話 · ${date}`, character_id: characterId, updated_at: now() };
    state.chats.push(chat);
    if (ch.card.data.first_mes) {
      addMessage(chat.id, 'assistant', sub(ch.card.data.first_mes, ch.card.data.name, state.settings.user_name));
    }
    persist();
    return chatDetail(chat.id);
  },
  async deleteChat(id) {
    requireAuth();
    state.chats = state.chats.filter((c) => c.id !== id);
    state.messages = state.messages.filter((m) => m.chat_id !== id);
    persist();
  },

  async generate(chatId, content, onEvent, signal) {
    requireAuth();
    chatDetail(chatId);
    const userMsg = addMessage(chatId, 'user', content);
    persist();
    onEvent({ type: 'user_saved', message: userMsg });

    const reply = cannedReply(chatId, content);
    let partial = '';
    await delay(500);
    // Stream by small grapheme-ish chunks for a natural typing feel.
    for (const ch of Array.from(reply)) {
      if (signal.aborted) break;
      partial += ch;
      onEvent({ type: 'delta', text: ch });
      await delay(/[，。！？…」\n]/.test(ch) ? 90 : 22);
    }
    state.requestsToday += 1;
    if (!partial) return;
    const msg = addMessage(chatId, 'assistant', partial, signal.aborted ? 'aborted' : 'complete');
    msg.completion_tokens = partial.length;
    persist();
    if (!signal.aborted) onEvent({ type: 'done', message: msg, usage: null });
  },

  async getSettings() {
    requireAuth();
    return {
      settings: state.settings,
      profiles: [state.profile],
      usage_today: { requests: state.requestsToday, limit: 300 },
    };
  },
  async updateSettings(input) {
    requireAuth();
    state.settings = { ...state.settings, ...input };
    persist();
    return this.getSettings();
  },
  async updateProfile(_id, input) {
    requireAuth();
    const { params, ...rest } = input;
    state.profile = { ...state.profile, ...rest, params: { ...state.profile.params, ...params } };
    persist();
    return state.profile;
  },
};
