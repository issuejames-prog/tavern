import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, real, index, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

const timestamps = {
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

export const characters = sqliteTable('characters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  // The full card JSON, unknown fields included — this is the source of truth.
  card_json: text('card_json').notNull(),
  avatar_color: text('avatar_color').notNull().default('sage'),
  ...timestamps,
});

export const modelProfiles = sqliteTable('model_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  provider: text('provider').notNull().default('openrouter'),
  base_url: text('base_url').notNull(),
  model: text('model').notNull(),
  key_env: text('key_env').notNull(),
  temperature: real('temperature').notNull().default(0.9),
  top_p: real('top_p').notNull().default(0.95),
  max_tokens: integer('max_tokens').notNull().default(600),
  context_tokens: integer('context_tokens').notNull().default(8192),
  is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

export const chats = sqliteTable(
  'chats',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    character_id: integer('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    model_profile_id: integer('model_profile_id').references(() => modelProfiles.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [index('chats_updated_idx').on(t.updated_at)],
);

export const messages = sqliteTable(
  'messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    chat_id: integer('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    // Points at the previous message; enables regenerate/branching in stage 3.
    parent_id: integer('parent_id').references((): AnySQLiteColumn => messages.id, {
      onDelete: 'set null',
    }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    status: text('status', { enum: ['complete', 'aborted', 'error'] })
      .notNull()
      .default('complete'),
    prompt_tokens: integer('prompt_tokens'),
    completion_tokens: integer('completion_tokens'),
    created_at: timestamps.created_at,
  },
  (t) => [index('messages_chat_idx').on(t.chat_id, t.id)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// One row per model call; drives the daily safety limit.
export const usageLog = sqliteTable('usage_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  day: text('day').notNull(),
  prompt_tokens: integer('prompt_tokens'),
  completion_tokens: integer('completion_tokens'),
  created_at: timestamps.created_at,
});
