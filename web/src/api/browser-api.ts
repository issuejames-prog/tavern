import { MAX_SCAN_DEPTH, substituteVars, type AppSettings, type AuthorNote, type WorldActivationSettings } from '@tavern/shared';
import { t } from '../i18n/zh-TW';
import { backupApi } from './browser-backup';
import { addCharacter, characterApi } from './browser-characters';
import { DAILY_LIMIT, generate, lastPromptByChat } from './browser-chat';
import {
  addMessage,
  currentProfile,
  findChat,
  newChat,
  persist,
  setApiKey,
  state,
  toChatSummary,
  usageToday,
} from './browser-store';
import { ready } from './browser-util';
import { worldApi } from './browser-worlds';
import { fantasyExample } from './sample-data';
import { ApiRequestError, type ProfileInput, type TavernApi } from './types';

/*
 * The app's whole "backend", running in the browser (CLAUDE.md §1, §4.6).
 * Characters, world books and backups live in their own modules; chats and settings here.
 */

const settingsResponse = () => ({
  settings: state.settings,
  profile: currentProfile(),
  usage_today: { requests: usageToday().requests, limit: DAILY_LIMIT },
});

function chatDetail(id: number) {
  const chat = findChat(id);
  return {
    ...toChatSummary(chat),
    author_note: chat.author_note,
    messages: state.messages.filter((m) => m.chat_id === id),
    last_prompt: lastPromptByChat.get(id) ?? null,
  };
}

const intIn = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;

function validateWorldSettings(w: WorldActivationSettings) {
  const E = t.data.errors;
  if (!intIn(w.scan_depth, 1, MAX_SCAN_DEPTH)) throw new ApiRequestError('BAD_VALUE', E.scanDepth(MAX_SCAN_DEPTH));
  if (!intIn(w.context_percent, 1, 100)) throw new ApiRequestError('BAD_VALUE', E.contextPercent);
  if (!intIn(w.budget_cap, 0, 1_000_000)) throw new ApiRequestError('BAD_VALUE', E.budgetCap);
}

export const browserApi: TavernApi = {
  ...characterApi,
  ...worldApi,
  ...backupApi,

  // ---------- chats ----------
  listChats: ready(async () => [...state.chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(toChatSummary)),

  getChat: ready(async (id: number) => chatDetail(id)),

  createChat: ready(async (characterId: number) => {
    const ch = state.characters.find((c) => c.id === characterId);
    if (!ch) throw new ApiRequestError('NOT_FOUND', t.data.notFound.character, 404);
    const date = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    const chat = newChat(characterId, t.data.chatTitle(ch.card.data.name, date));
    state.chats.push(chat);
    if (ch.card.data.first_mes.trim()) {
      addMessage(chat.id, 'assistant', substituteVars(ch.card.data.first_mes, { char: ch.card.data.name, user: state.settings.user_name }));
    }
    await persist();
    return chatDetail(chat.id);
  }),

  deleteChat: ready(async (id: number) => {
    state.chats = state.chats.filter((c) => c.id !== id);
    state.messages = state.messages.filter((m) => m.chat_id !== id);
    lastPromptByChat.delete(id);
    await persist();
  }),

  updateAuthorNote: ready(async (chatId: number, note: AuthorNote) => {
    const E = t.data.errors;
    if (!intIn(note.depth, 0, 100)) throw new ApiRequestError('BAD_VALUE', E.noteDepth);
    if (!intIn(note.frequency, 0, 100)) throw new ApiRequestError('BAD_VALUE', E.noteFrequency);
    findChat(chatId).author_note = { content: note.content, depth: note.depth, frequency: note.frequency };
    await persist();
    return chatDetail(chatId);
  }),

  generate,

  // ---------- settings ----------
  getSettings: ready(async () => settingsResponse()),

  updateSettings: ready(async (input: Partial<AppSettings>) => {
    if (input.user_name !== undefined && !input.user_name.trim()) throw new ApiRequestError('BAD_VALUE', t.data.errors.userName);
    if (input.world) validateWorldSettings(input.world);
    state.settings = { ...state.settings, ...input };
    await persist();
    return settingsResponse();
  }),

  updateProfile: ready(async (input: ProfileInput) => {
    const E = t.data.errors;
    const { params, api_key, ...rest } = input;
    const next = { ...state.profile, ...rest, params: { ...state.profile.params, ...params } };
    if (!(next.params.temperature >= 0 && next.params.temperature <= 2)) throw new ApiRequestError('BAD_VALUE', E.temperature);
    if (!(next.params.top_p > 0 && next.params.top_p <= 1)) throw new ApiRequestError('BAD_VALUE', E.topP);
    if (!(next.params.max_tokens >= 16)) throw new ApiRequestError('BAD_VALUE', E.maxTokensMin);
    if (next.params.max_tokens >= next.context_tokens) throw new ApiRequestError('BAD_VALUE', E.maxTokensContext);
    if (!/^https:\/\//.test(next.base_url)) throw new ApiRequestError('BAD_VALUE', E.baseUrl);
    if (!next.model.trim()) throw new ApiRequestError('BAD_VALUE', E.model);
    state.profile = next;
    if (api_key !== undefined) setApiKey(api_key);
    await persist();
    return currentProfile();
  }),

  // ---------- examples ----------
  addFantasyExample: ready(async () => {
    const ex = fantasyExample();
    // The card art ships with the site (same origin, allowed by the CSP); without it the initial is drawn.
    let image: Blob | null = null;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}examples/lisel.png`);
      if (res.ok) image = await res.blob();
    } catch {
      // offline or missing: fall back to the colour avatar
    }
    return addCharacter(ex.card, image, ex.color);
  }),
};
