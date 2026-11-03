import type {
  AppSettings,
  CharacterCardV2Data,
  CharacterDetail,
  CharacterSummary,
  ChatDetail,
  ChatSummary,
  ModelProfile,
  SettingsResponse,
  StreamEvent,
} from '@tavern/shared';

export interface CharacterInput {
  data: Partial<CharacterCardV2Data>;
  avatar_color?: string;
}

export interface ProfileInput {
  name?: string;
  provider?: ModelProfile['provider'];
  base_url?: string;
  model?: string;
  key_env?: string;
  params?: Partial<ModelProfile['params']>;
  context_tokens?: number;
}

/**
 * Everything the UI needs from a backend. Two implementations:
 * the real HTTP server, and an in-browser demo used for the GitHub Pages preview.
 */
export interface TavernApi {
  readonly isDemo: boolean;
  me(): Promise<{ authenticated: boolean }>;
  login(password: string): Promise<void>;
  logout(): Promise<void>;

  listCharacters(): Promise<CharacterSummary[]>;
  getCharacter(id: number): Promise<CharacterDetail>;
  createCharacter(input: CharacterInput): Promise<CharacterDetail>;
  updateCharacter(id: number, input: CharacterInput): Promise<CharacterDetail>;
  deleteCharacter(id: number): Promise<void>;

  listChats(): Promise<ChatSummary[]>;
  getChat(id: number): Promise<ChatDetail>;
  createChat(characterId: number): Promise<ChatDetail>;
  deleteChat(id: number): Promise<void>;
  /** Streams one turn. Resolves when the stream ends (normally, by error, or by abort). */
  generate(chatId: number, content: string, onEvent: (e: StreamEvent) => void, signal: AbortSignal): Promise<void>;

  getSettings(): Promise<SettingsResponse>;
  updateSettings(input: Partial<AppSettings>): Promise<SettingsResponse>;
  updateProfile(id: number, input: ProfileInput): Promise<ModelProfile>;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
