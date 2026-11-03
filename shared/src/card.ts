// Character Card V2 (community format, SillyTavern-compatible).
// Unknown fields must survive import/export, hence the index signatures.

export interface CharacterBookEntry {
  keys: string[];
  secondary_keys?: string[];
  content: string;
  constant?: boolean;
  enabled: boolean;
  insertion_order: number;
  priority?: number;
  position?: 'before_char' | 'after_char';
  case_sensitive?: boolean;
  [key: string]: unknown;
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  entries: CharacterBookEntry[];
  [key: string]: unknown;
}

export interface CharacterCardV2Data {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  character_book?: CharacterBook;
  tags: string[];
  creator: string;
  creator_notes: string;
  character_version: string;
  extensions: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CharacterCardV2 {
  spec: 'chara_card_v2';
  spec_version: string;
  data: CharacterCardV2Data;
  [key: string]: unknown;
}

export function emptyCardData(name = ''): CharacterCardV2Data {
  return {
    name,
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    tags: [],
    creator: '',
    creator_notes: '',
    character_version: '1.0',
    extensions: {},
  };
}

/**
 * Accepts V2 cards and legacy V1 (flat) cards. Fills missing known fields
 * with defaults but keeps every unknown field as-is.
 */
export function normalizeCard(raw: unknown): CharacterCardV2 {
  if (!raw || typeof raw !== 'object') throw new Error('INVALID_CARD');
  const obj = raw as Record<string, unknown>;

  if (obj.spec === 'chara_card_v2' && obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>;
    if (typeof data.name !== 'string' || !data.name.trim()) throw new Error('INVALID_CARD');
    return {
      ...obj,
      spec: 'chara_card_v2',
      spec_version: typeof obj.spec_version === 'string' ? obj.spec_version : '2.0',
      data: { ...emptyCardData(), ...data } as CharacterCardV2Data,
    };
  }

  // V1: fields live at the top level.
  if (typeof obj.name === 'string' && obj.name.trim()) {
    return {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: { ...emptyCardData(), ...obj } as CharacterCardV2Data,
    };
  }
  throw new Error('INVALID_CARD');
}
