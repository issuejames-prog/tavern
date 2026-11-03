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
  WorldBook,
  WorldBookSummary,
} from '@tavern/shared';

export interface CharacterInput {
  data: Partial<CharacterCardV2Data>;
  avatar_color?: string;
  /** null unlinks; undefined leaves it unchanged. */
  world_book_id?: number | null;
}

export interface ProfileInput {
  provider?: ModelProfile['provider'];
  base_url?: string;
  model?: string;
  params?: Partial<ModelProfile['params']>;
  context_tokens?: number;
  /** The user's own key, kept in this browser. Empty string clears it. */
  api_key?: string;
}

export interface DownloadFile {
  blob: Blob;
  fileName: string;
}

export interface CharacterImportResult {
  character: CharacterDetail;
  /** A world book created from the card's embedded character_book, if it had one. */
  world: WorldBookSummary | null;
}

/**
 * Everything the UI needs. The whole app runs in the browser, so this is
 * implemented by browser-api.ts on top of IndexedDB; keeping it behind an
 * interface lets pages stay unaware of storage details.
 */
export interface TavernApi {
  listCharacters(): Promise<CharacterSummary[]>;
  getCharacter(id: number): Promise<CharacterDetail>;
  createCharacter(input: CharacterInput): Promise<CharacterDetail>;
  updateCharacter(id: number, input: CharacterInput): Promise<CharacterDetail>;
  deleteCharacter(id: number): Promise<void>;
  importCharacter(file: File): Promise<CharacterImportResult>;
  exportCharacter(id: number, format: 'png' | 'json'): Promise<DownloadFile>;
  setAvatar(id: number, file: File | null): Promise<CharacterDetail>;

  listChats(): Promise<ChatSummary[]>;
  getChat(id: number): Promise<ChatDetail>;
  createChat(characterId: number): Promise<ChatDetail>;
  deleteChat(id: number): Promise<void>;
  /** Streams one turn. Resolves when the stream ends (normally, by error, or by abort). */
  generate(chatId: number, content: string, onEvent: (e: StreamEvent) => void, signal: AbortSignal): Promise<void>;

  listWorldBooks(): Promise<WorldBookSummary[]>;
  getWorldBook(id: number): Promise<WorldBook>;
  createWorldBook(name: string): Promise<WorldBook>;
  saveWorldBook(book: WorldBook): Promise<WorldBook>;
  deleteWorldBook(id: number): Promise<void>;
  importWorldBook(file: File): Promise<WorldBook>;
  exportWorldBook(id: number): Promise<DownloadFile>;

  getSettings(): Promise<SettingsResponse>;
  updateSettings(input: Partial<AppSettings>): Promise<SettingsResponse>;
  updateProfile(input: ProfileInput): Promise<ModelProfile>;

  exportBackup(): Promise<DownloadFile>;
  /** Replaces ALL data in this browser with the backup. The UI must confirm first. */
  importBackup(file: File): Promise<void>;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
  }
}
