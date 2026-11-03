import type { CharacterCardV2 } from './card';
import type { WorldActivationSettings } from './world-engine';
import type { WorldBook } from './world-info';

export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface GenParams {
  temperature: number;
  top_p: number;
  max_tokens: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ---- Resources ----

export interface CharacterSummary {
  id: number;
  name: string;
  description: string;
  tags: string[];
  avatar_color: string;
  /** Object URL of the avatar image, or null to draw the initial. */
  avatar_url: string | null;
  /** World book linked to this character (besides global books). */
  world_book_id: number | null;
  updated_at: string;
}

export interface CharacterDetail extends CharacterSummary {
  card: CharacterCardV2;
}

export interface ChatSummary {
  id: number;
  title: string;
  character_id: number;
  character_name: string;
  avatar_color: string;
  avatar_url: string | null;
  updated_at: string;
  last_message: string | null;
}

export interface MessageRecord {
  id: number;
  chat_id: number;
  parent_id: number | null;
  role: Exclude<Role, 'system'>;
  content: string;
  status: 'complete' | 'aborted' | 'error';
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
}

/** Per-chat author's note (作者備註): inserted N messages from the bottom, every `frequency` user turns. */
export interface AuthorNote {
  content: string;
  depth: number;
  /** 1 = every turn, N = every N-th user message, 0 = never. */
  frequency: number;
}

export const DEFAULT_AUTHOR_NOTE: AuthorNote = { content: '', depth: 4, frequency: 1 };

export interface ChatDetail extends ChatSummary {
  messages: MessageRecord[];
  author_note: AuthorNote;
  /** Budget report from the most recent generation in this session, if any. */
  last_prompt: PromptInfo | null;
}

export interface WorldBookSummary {
  id: number;
  name: string;
  description: string;
  global: boolean;
  entry_count: number;
  enabled_count: number;
  linked_characters: string[];
  updated_at: string;
}

export type { WorldBook };

export interface ModelProfile {
  id: number;
  name: string;
  provider: 'openrouter' | 'openai-compatible';
  base_url: string;
  model: string;
  /** Whether an API key has been entered in this browser. The key itself is never exposed to the UI. */
  key_present: boolean;
  params: GenParams;
  context_tokens: number;
}

export interface AppSettings {
  user_name: string;
  /** The user's own persona (用戶描述), sent after the character definition. */
  user_persona: string;
  system_prompt: string;
  /** World Info activation settings (總體參數), shared by all world books. */
  world: WorldActivationSettings;
}

export interface SettingsResponse {
  settings: AppSettings;
  profile: ModelProfile;
  usage_today: { requests: number; limit: number };
}

/** What went into the last prompt — shown as the budget meter in the chat header. */
export interface PromptInfo {
  tokens: number;
  budget: number;
  world_included: string[];
  /** Depth notes sent, e.g. "角色備註 @4". */
  notes: string[];
  world_dropped: number;
  history_dropped: number;
  examples_dropped: boolean;
  over_budget: boolean;
}

// ---- Stream events for one generation ----

export type StreamEvent =
  | { type: 'user_saved'; message: MessageRecord }
  | { type: 'prompt'; info: PromptInfo }
  | { type: 'delta'; text: string }
  | { type: 'done'; message: MessageRecord; usage: TokenUsage | null }
  | { type: 'error'; code: string; message: string; partial: MessageRecord | null };

export const DEFAULT_GEN_PARAMS: GenParams = {
  temperature: 0.9,
  top_p: 0.95,
  max_tokens: 600,
};

export const DEFAULT_CONTEXT_TOKENS = 8192;
