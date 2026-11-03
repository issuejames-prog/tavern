import type { CharacterCardV2Data } from './card';
import { DEFAULT_NOTE_DEPTH } from './prompt-assembler';
import { estimateTokens, type TokenCounter } from './text';

/*
 * Character-card writing helpers following the PLists + Ali:Chat guide (CLAUDE.md §4.2).
 * The character's note is SillyTavern's `extensions.depth_prompt`, so it exports with the card.
 */

export interface CharacterNote {
  prompt: string;
  depth: number;
}

export function readCharacterNote(data: CharacterCardV2Data): CharacterNote {
  const dp = (data.extensions?.depth_prompt ?? {}) as Record<string, unknown>;
  return {
    prompt: typeof dp.prompt === 'string' ? dp.prompt : '',
    depth: typeof dp.depth === 'number' && Number.isFinite(dp.depth) ? Math.max(0, Math.round(dp.depth)) : DEFAULT_NOTE_DEPTH,
  };
}

/** Returns new extensions with the note written; other depth_prompt fields (e.g. role) are kept. */
export function writeCharacterNote(data: CharacterCardV2Data, note: CharacterNote): Record<string, unknown> {
  const prev = (data.extensions?.depth_prompt ?? {}) as Record<string, unknown>;
  return {
    ...data.extensions,
    depth_prompt: { role: 'system', ...prev, prompt: note.prompt, depth: Math.max(0, Math.round(note.depth)) },
  };
}

/** A PList: one bracketed block of "category: traits;" pairs. */
const PLIST = /\[[^\[\]]*[:：][^\[\]]*\]/;
const DOUBLE_NEWLINE = /\n[ \t　]*\n/;
// {{user}}/你 followed shortly by an action verb — likely the character acting or speaking for the user.
const USER_ACTION =
  /(\{\{user\}\}|(?<![迷])你)[^，。！？、「」『』\n*]{0,4}(回應|回答|點了點頭|點頭|微笑|笑了|說道|說：|走向|伸手|接過|看向|看著|心想|感到|覺得|決定)/;

export type CardIssueCode =
  | 'DOUBLE_NEWLINE'
  | 'USER_ACTION'
  | 'NO_PLIST'
  | 'PLIST_NOT_LAST'
  | 'NO_FIRST_MES'
  | 'EXAMPLES_TEMPORARY'
  | 'PERMANENT_HEAVY';

export type CardField = 'name' | 'description' | 'first_mes' | 'mes_example' | 'character_note' | 'alternate_greetings';

export interface CardIssue {
  code: CardIssueCode;
  field: CardField;
  level: 'warn' | 'tip';
}

export interface CardTokenReport {
  /** Always in the prompt: description, personality, scenario, character note. */
  permanent: number;
  /** Pushed out as the chat grows: first message, example dialogue. */
  temporary: number;
}

export function cardTokens(data: CharacterCardV2Data, count: TokenCounter = estimateTokens): CardTokenReport {
  const note = readCharacterNote(data).prompt;
  return {
    permanent: count(data.description) + count(data.personality) + count(data.scenario) + count(note),
    temporary: count(data.first_mes) + count(data.mes_example),
  };
}

/**
 * Checks a card against the writing guide. Heuristic by nature — results are
 * suggestions shown next to the editor, never blockers.
 */
export function lintCard(data: CharacterCardV2Data, promptBudget: number, count: TokenCounter = estimateTokens): CardIssue[] {
  const issues: CardIssue[] = [];
  const note = readCharacterNote(data).prompt;

  // "切勿使用兩個換行符": models read blank lines as separators.
  const blankLineFields: [CardField, string][] = [
    ['first_mes', data.first_mes],
    ['description', data.description],
    ['mes_example', data.mes_example],
    ['alternate_greetings', data.alternate_greetings.join('\n')],
  ];
  for (const [field, text] of blankLineFields) {
    if (DOUBLE_NEWLINE.test(text)) issues.push({ code: 'DOUBLE_NEWLINE', field, level: 'warn' });
  }

  // The character must not describe or speak for the user.
  if (USER_ACTION.test(data.first_mes)) issues.push({ code: 'USER_ACTION', field: 'first_mes', level: 'warn' });
  const charLines = data.description
    .split('\n')
    .filter((l) => /^\s*(\{\{char\}\}|<BOT>|[^:：\s]{1,12}[:：])/i.test(l) && !/^\s*\{\{user\}\}/i.test(l))
    .join('\n');
  if (USER_ACTION.test(charLines)) issues.push({ code: 'USER_ACTION', field: 'description', level: 'warn' });

  // PList: best in the character note; otherwise at the very bottom of the description.
  const descHasPlist = PLIST.test(data.description);
  if (!descHasPlist && !PLIST.test(note)) issues.push({ code: 'NO_PLIST', field: 'character_note', level: 'tip' });
  if (descHasPlist && !PLIST.test(note)) {
    const after = data.description.slice(data.description.lastIndexOf(']') + 1).trim();
    if (after.length > 20) issues.push({ code: 'PLIST_NOT_LAST', field: 'description', level: 'tip' });
  }

  if (!data.first_mes.trim()) issues.push({ code: 'NO_FIRST_MES', field: 'first_mes', level: 'tip' });

  // Ali:Chat examples belong in the (permanent) description; mes_example gets pushed out.
  if (data.mes_example.trim() && !/\{\{char\}\}\s*[:：]/i.test(data.description)) {
    issues.push({ code: 'EXAMPLES_TEMPORARY', field: 'mes_example', level: 'tip' });
  }

  if (promptBudget > 0 && cardTokens(data, count).permanent > promptBudget * 0.3) {
    issues.push({ code: 'PERMANENT_HEAVY', field: 'description', level: 'warn' });
  }
  return issues;
}
