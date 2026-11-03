import { eq } from 'drizzle-orm';
import { assemblePrompt, type ChatMessage, type MessageRecord, type StreamEvent, type TokenUsage } from '@tavern/shared';
import { env } from '../config/env';
import { db } from '../db/client';
import { chats, messages } from '../db/schema';
import { AppError } from '../lib/errors';
import { createProvider, ProviderError } from '../providers';
import { parseStoredCard } from './character-card';
import { getAppSettings, getCharacterRow, getChatDetail, getDefaultProfile, toMessage, touchChat } from './repo';
import { countTokens } from './tokenizer';
import { isOverDailyLimit, recordUsage } from './usage';

function insertMessage(values: typeof messages.$inferInsert): MessageRecord {
  const row = db.insert(messages).values(values).returning().get();
  return toMessage(row);
}

/**
 * One chat turn, following CLAUDE.md §4 step by step.
 * `emit` pushes SSE events; `signal` fires when the browser aborts.
 */
export async function generateReply(
  chatId: number,
  userText: string,
  emit: (event: StreamEvent) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  const chat = getChatDetail(chatId);
  const lastId = chat.messages.at(-1)?.id ?? null;

  // 1. Persist the user's message first so an API failure never loses it.
  const userMsg = insertMessage({ chat_id: chatId, parent_id: lastId, role: 'user', content: userText });
  touchChat(chatId);
  await emit({ type: 'user_saved', message: userMsg });

  let partial = '';
  const fail = async (code: string, message: string) => {
    let saved: MessageRecord | null = null;
    if (partial) {
      saved = insertMessage({
        chat_id: chatId,
        parent_id: userMsg.id,
        role: 'assistant',
        content: partial,
        status: 'error',
      });
    }
    await emit({ type: 'error', code, message, partial: saved });
  };

  if (isOverDailyLimit()) {
    return fail('DAILY_LIMIT', `今日生成次數已達上限（${env.dailyRequestLimit} 次），明天再來吧`);
  }

  // 2. Character + history
  const card = parseStoredCard(getCharacterRow(chat.character_id).card_json).data;
  const settings = getAppSettings();
  const profile = getDefaultProfile(chat.model_profile_id);
  const history: ChatMessage[] = chat.messages
    .filter((m) => m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));

  // 3–5. World scan arrives in stage 2; assemble + trim within budget.
  const assembled = assemblePrompt({
    systemPrompt: settings.system_prompt,
    card,
    userName: settings.user_name,
    world: [],
    history,
    latestUser: userText,
    budget: profile.context_tokens - profile.params.max_tokens,
    countTokens,
  });
  if (env.debugMode) {
    console.debug('[debug] prompt tokens≈%d report=%j', assembled.tokens, assembled.report);
    console.debug('[debug] prompt messages=%j', assembled.messages);
  }

  // 6. Stream through the provider adapter.
  let usage: TokenUsage | null = null;
  try {
    const provider = createProvider(profile);
    for await (const text of provider.stream({ messages: assembled.messages, params: profile.params, signal })) {
      partial += text;
      await emit({ type: 'delta', text });
    }
    usage = provider.usage();
  } catch (err) {
    if (signal.aborted) {
      // fall through to the aborted save below
    } else {
      recordUsage(null);
      if (err instanceof ProviderError || err instanceof AppError) return fail(err.code, err.message);
      console.error('[chat] generation failed:', err instanceof Error ? err.message : err);
      return fail('GENERATION_FAILED', '生成時發生錯誤，請稍後再試');
    }
  }
  recordUsage(usage);

  // 7. Save the reply; an aborted stream keeps whatever arrived.
  if (signal.aborted && !partial) return;
  const reply = insertMessage({
    chat_id: chatId,
    parent_id: userMsg.id,
    role: 'assistant',
    content: partial,
    status: signal.aborted ? 'aborted' : 'complete',
    prompt_tokens: usage?.prompt_tokens ?? assembled.tokens,
    completion_tokens: usage?.completion_tokens ?? null,
  });
  db.update(chats).set({ model_profile_id: profile.id }).where(eq(chats.id, chatId)).run();
  touchChat(chatId);
  if (!signal.aborted) await emit({ type: 'done', message: reply, usage });
}
