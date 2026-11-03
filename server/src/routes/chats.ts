import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { StreamEvent } from '@tavern/shared';
import { db } from '../db/client';
import { chats, messages } from '../db/schema';
import { AppError, idParam, readJson, sendError } from '../lib/errors';
import { parseStoredCard, substituteVars } from '../services/character-card';
import { generateReply } from '../services/chat-service';
import { getAppSettings, getCharacterRow, getChatDetail, getDefaultProfile, listChatSummaries } from '../services/repo';

export const chatRoutes = new Hono();

const MAX_MESSAGE_LENGTH = 20_000;

chatRoutes.get('/', (c) => c.json(listChatSummaries()));

chatRoutes.get('/:id', (c) => {
  try {
    return c.json(getChatDetail(idParam(c.req.param('id'))));
  } catch (err) {
    return sendError(c, err);
  }
});

chatRoutes.post('/', async (c) => {
  try {
    const body = await readJson(c);
    const characterId = idParam(String(body.character_id ?? ''));
    const row = getCharacterRow(characterId);
    const card = parseStoredCard(row.card_json).data;
    const { user_name } = getAppSettings();

    const date = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    const chat = db
      .insert(chats)
      .values({ title: `與${card.name}的對話 · ${date}`, character_id: characterId, model_profile_id: getDefaultProfile().id })
      .returning()
      .get();

    // The greeting becomes the first assistant message, so it is part of the history.
    if (card.first_mes.trim()) {
      db.insert(messages)
        .values({
          chat_id: chat.id,
          role: 'assistant',
          content: substituteVars(card.first_mes, { char: card.name, user: user_name }),
        })
        .run();
    }
    return c.json(getChatDetail(chat.id), 201);
  } catch (err) {
    return sendError(c, err);
  }
});

chatRoutes.delete('/:id', (c) => {
  try {
    const id = idParam(c.req.param('id'));
    getChatDetail(id);
    db.delete(chats).where(eq(chats.id, id)).run();
    return c.json({ ok: true });
  } catch (err) {
    return sendError(c, err);
  }
});

chatRoutes.post('/:id/generate', async (c) => {
  let chatId: number;
  let content: string;
  try {
    chatId = idParam(c.req.param('id'));
    getChatDetail(chatId);
    const body = await readJson(c);
    content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) throw new AppError('EMPTY_MESSAGE', '訊息不能是空的');
    if (content.length > MAX_MESSAGE_LENGTH) throw new AppError('MESSAGE_TOO_LONG', '訊息太長了');
  } catch (err) {
    return sendError(c, err);
  }

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());
    const emit = (event: StreamEvent) => stream.writeSSE({ data: JSON.stringify(event) });
    try {
      await generateReply(chatId, content, emit, controller.signal);
    } catch (err) {
      console.error('[chat] stream failed:', err instanceof Error ? err.message : err);
      await emit({ type: 'error', code: 'INTERNAL', message: '伺服器發生未預期的錯誤', partial: null });
    }
  });
});
