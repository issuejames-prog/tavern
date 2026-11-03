import type { CharacterCardV2 } from './card';

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

export interface ApiError {
  error: { code: string; message: string };
}

// ---- Resources ----

export interface CharacterSummary {
  id: number;
  name: string;
  description: string;
  tags: string[];
  avatar_color: string;
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

export interface ChatDetail extends ChatSummary {
  messages: MessageRecord[];
  model_profile_id: number | null;
}

export interface ModelProfile {
  id: number;
  name: string;
  provider: 'openrouter' | 'openai-compatible';
  base_url: string;
  model: string;
  /** Name of the env var that holds the key. The key itself never leaves the server. */
  key_env: string;
  /** Whether that env var is actually set on the server. */
  key_present: boolean;
  params: GenParams;
  context_tokens: number;
  is_default: boolean;
}

export interface AppSettings {
  user_name: string;
  system_prompt: string;
}

export interface SettingsResponse {
  settings: AppSettings;
  profiles: ModelProfile[];
  usage_today: { requests: number; limit: number };
}

// ---- SSE events from POST /api/chats/:id/generate ----

export type StreamEvent =
  | { type: 'user_saved'; message: MessageRecord }
  | { type: 'delta'; text: string }
  | { type: 'done'; message: MessageRecord; usage: TokenUsage | null }
  | { type: 'error'; code: string; message: string; partial: MessageRecord | null };

export const DEFAULT_GEN_PARAMS: GenParams = {
  temperature: 0.9,
  top_p: 0.95,
  max_tokens: 600,
};

export const DEFAULT_CONTEXT_TOKENS = 8192;
