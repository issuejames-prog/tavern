// Character Card V2 (community format, SillyTavern-compatible).
// Unknown fields must survive import/export, hence the index signatures.

export interface CharacterBookEntry {
  id?: number;
  /** Editor-facing title; not sent to the model. */
  comment?: string;
  keys: string[];
  secondary_keys?: string[];
  content: string;
  constant?: boolean;
  enabled: boolean;
  insertion_order: number;
  priority?: number;
  position?: 'before_char' | 'after_char';
  case_sensitive?: boolean;
  /** When false, secondary_keys are ignored (SillyTavern semantics). */
  selective?: boolean;
  extensions?: Record<string, unknown>;
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
  /** V3 cards are kept as V3 so re-exports don't lose their identity. */
  spec: 'chara_card_v2' | 'chara_card_v3';
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

  if ((obj.spec === 'chara_card_v2' || obj.spec === 'chara_card_v3') && obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>;
    if (typeof data.name !== 'string' || !data.name.trim()) throw new Error('INVALID_CARD');
    const merged = { ...emptyCardData(), ...data } as CharacterCardV2Data;
    // Repair the few fields the app relies on without touching anything else.
    for (const key of ['description', 'personality', 'scenario', 'first_mes', 'mes_example', 'system_prompt', 'post_history_instructions', 'creator', 'creator_notes'] as const) {
      if (typeof merged[key] !== 'string') merged[key] = '';
    }
    merged.tags = stringArray(merged.tags);
    merged.alternate_greetings = stringArray(merged.alternate_greetings);
    if (!merged.extensions || typeof merged.extensions !== 'object') merged.extensions = {};
    return {
      ...obj,
      spec: obj.spec,
      spec_version: typeof obj.spec_version === 'string' ? obj.spec_version : obj.spec === 'chara_card_v3' ? '3.0' : '2.0',
      data: merged,
    };
  }

  // V1: fields live at the top level (old cards use `char_name`-less flat JSON).
  if (typeof obj.name === 'string' && obj.name.trim()) {
    return normalizeCard({ spec: 'chara_card_v2', spec_version: '2.0', data: obj });
  }
  throw new Error('INVALID_CARD');
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
