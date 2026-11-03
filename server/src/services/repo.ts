import { asc, desc, eq, sql } from 'drizzle-orm';
import type {
  AppSettings,
  CharacterDetail,
  CharacterSummary,
  ChatDetail,
  ChatSummary,
  MessageRecord,
  ModelProfile,
} from '@tavern/shared';
import { readSecret } from '../config/env';
import { db } from '../db/client';
import { characters, chats, messages, modelProfiles, settings } from '../db/schema';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_NAME } from '../db/seed';
import { notFound } from '../lib/errors';
import { parseStoredCard } from './character-card';

// Thin data-access helpers that map rows to the shared API types.

type CharacterRow = typeof characters.$inferSelect;
type ProfileRow = typeof modelProfiles.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

export function toCharacterDetail(row: CharacterRow): CharacterDetail {
  const card = parseStoredCard(row.card_json);
  return {
    id: row.id,
    name: row.name,
    description: card.data.description,
    tags: Array.isArray(card.data.tags) ? card.data.tags : [],
    avatar_color: row.avatar_color,
    updated_at: row.updated_at,
    card,
  };
}

export function toCharacterSummary(row: CharacterRow): CharacterSummary {
  const { card: _card, ...summary } = toCharacterDetail(row);
  return summary;
}

export function getCharacterRow(id: number): CharacterRow {
  const row = db.select().from(characters).where(eq(characters.id, id)).get();
  if (!row) throw notFound('角色');
  return row;
}

export function toProfile(row: ProfileRow): ModelProfile {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider === 'openai-compatible' ? 'openai-compatible' : 'openrouter',
    base_url: row.base_url,
    model: row.model,
    key_env: row.key_env,
    key_present: Boolean(readSecret(row.key_env)),
    params: { temperature: row.temperature, top_p: row.top_p, max_tokens: row.max_tokens },
    context_tokens: row.context_tokens,
    is_default: row.is_default,
  };
}

export function listProfiles(): ModelProfile[] {
  return db.select().from(modelProfiles).orderBy(asc(modelProfiles.id)).all().map(toProfile);
}

export function getDefaultProfile(preferredId?: number | null): ModelProfile {
  const rows = db.select().from(modelProfiles).all();
  const row =
    rows.find((r) => r.id === preferredId) ?? rows.find((r) => r.is_default) ?? rows[0];
  if (!row) throw notFound('模型設定');
  return toProfile(row);
}

export function getAppSettings(): AppSettings {
  const rows = db.select().from(settings).all();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    user_name: map.get('user_name') ?? DEFAULT_USER_NAME,
    system_prompt: map.get('system_prompt') ?? DEFAULT_SYSTEM_PROMPT,
  };
}

export function setAppSetting(key: keyof AppSettings, value: string) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export function toMessage(row: MessageRow): MessageRecord {
  return { ...row };
}

export function listChatSummaries(): ChatSummary[] {
  const lastMessage = sql<string | null>`(
    SELECT content FROM messages m WHERE m.chat_id = ${chats.id} ORDER BY m.id DESC LIMIT 1
  )`;
  return db
    .select({
      id: chats.id,
      title: chats.title,
      character_id: chats.character_id,
      character_name: characters.name,
      avatar_color: characters.avatar_color,
      updated_at: chats.updated_at,
      last_message: lastMessage,
    })
    .from(chats)
    .innerJoin(characters, eq(chats.character_id, characters.id))
    .orderBy(desc(chats.updated_at), desc(chats.id))
    .all();
}

export function getChatDetail(id: number): ChatDetail {
  const summary = listChatSummaries().find((c) => c.id === id);
  const row = db.select().from(chats).where(eq(chats.id, id)).get();
  if (!summary || !row) throw notFound('對話');
  const rows = db.select().from(messages).where(eq(messages.chat_id, id)).orderBy(asc(messages.id)).all();
  return { ...summary, model_profile_id: row.model_profile_id, messages: rows.map(toMessage) };
}

export function touchChat(id: number) {
  db.update(chats)
    .set({ updated_at: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
    .where(eq(chats.id, id))
    .run();
}
