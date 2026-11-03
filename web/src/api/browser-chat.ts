import {
  assemblePrompt,
  estimateTokens,
  scanWorldBooks,
  selectWorldSnippets,
  type PromptInfo,
  type StreamEvent,
  type TokenUsage,
} from '@tavern/shared';
import { t } from '../i18n/zh-TW';
import { BrowserLlmError, streamCompletion } from './browser-llm';
import {
  addMessage,
  currentProfile,
  ensureReady,
  findCharacter,
  findChat,
  getApiKey,
  persist,
  state,
  usageToday,
} from './browser-store';

export const DAILY_LIMIT = 300;
// World entries may take at most this share of the prompt budget in total.
const WORLD_SHARE = 0.5;

/** Last budget report per chat, shown in the chat header (not persisted). */
export const lastPromptByChat = new Map<number, PromptInfo>();

/** One chat turn — the steps of CLAUDE.md §4, in order. */
export async function generate(
  chatId: number,
  content: string,
  onEvent: (e: StreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  await ensureReady();
  const chat = findChat(chatId);
  const history = state.messages.filter((m) => m.chat_id === chatId && m.content.trim());

  // 1. Save the user's message first so a failure never loses it.
  const userMsg = addMessage(chatId, 'user', content);
  await persist();
  onEvent({ type: 'user_saved', message: userMsg });

  let partial = '';
  const fail = async (code: string, message: string) => {
    const saved = partial ? addMessage(chatId, 'assistant', partial, { status: 'error' }) : null;
    await persist();
    onEvent({ type: 'error', code, message, partial: saved });
  };

  const apiKey = getApiKey();
  if (!apiKey) return fail('MISSING_API_KEY', t.browser.errors.missingKey);
  if (usageToday().requests >= DAILY_LIMIT) return fail('DAILY_LIMIT', t.browser.errors.dailyLimit(DAILY_LIMIT));

  // 2. Character + history.
  const character = findCharacter(chat.character_id);
  const card = character.card.data;
  const profile = currentProfile();
  const budget = profile.context_tokens - profile.params.max_tokens;

  // 3. World books: global ones plus the one linked to this character.
  const books = state.worlds.filter((w) => w.global || w.id === character.world_book_id);
  const recentTexts = [...history.map((m) => m.content), content];
  const world = selectWorldSnippets(scanWorldBooks(books, recentTexts), estimateTokens);

  // 4–5. Assemble within budget (the assembler re-assembles after each cut).
  const assembled = assemblePrompt({
    systemPrompt: state.settings.system_prompt,
    card,
    userName: state.settings.user_name,
    world,
    worldBudget: Math.floor(budget * WORLD_SHARE),
    history: history.map((m) => ({ role: m.role, content: m.content })),
    latestUser: content,
    budget,
    countTokens: estimateTokens,
  });
  const info: PromptInfo = {
    tokens: assembled.tokens,
    budget,
    world_included: assembled.report.worldLabels,
    world_dropped: assembled.report.worldDropped,
    history_dropped: assembled.report.historyDropped,
    examples_included: assembled.report.examplesIncluded,
    over_budget: assembled.report.overBudget,
  };
  lastPromptByChat.set(chatId, info);
  onEvent({ type: 'prompt', info });

  // 6. Stream from the provider.
  let usage: TokenUsage | null = null;
  usageToday().requests += 1;
  try {
    for await (const text of streamCompletion({
      profile,
      apiKey,
      messages: assembled.messages,
      params: profile.params,
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
    await persist();
    return;
  }
  const finalUsage = usage as TokenUsage | null;
  const reply = addMessage(chatId, 'assistant', partial, {
    status: signal.aborted ? 'aborted' : 'complete',
    prompt_tokens: finalUsage?.prompt_tokens ?? assembled.tokens,
    completion_tokens: finalUsage?.completion_tokens ?? null,
  });
  await persist();
  if (!signal.aborted) onEvent({ type: 'done', message: reply, usage: finalUsage });
}
