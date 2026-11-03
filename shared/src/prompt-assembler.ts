import type { ChatMessage } from './api';
import type { CharacterCardV2Data } from './card';
import { MESSAGE_OVERHEAD, splitExamples, substituteVars, type TokenCounter } from './text';
import type { EntryPosition } from './world-info';

/*
 * Builds the prompt (CLAUDE.md §4.1). Guiding principle from the writing guides:
 * the lower something sits in the context, the stronger its effect on the next reply.
 *
 *   system: main prompt → [world: before_char] → description → personality → scenario → [world: after_char] → user persona
 *   system: example dialogue                                   (temporary: dropped first)
 *   chat history … latest user message                         (temporary: oldest dropped first)
 *     ↳ depth inserts counted from the bottom (0 = after the latest message):
 *         world @D entries, character note,
 *         [world: an_top] author's note [world: an_bottom]   ← last at its depth (strongest)
 *   system: post-history instructions                          (always last)
 */

export interface WorldSnippet {
  content: string;
  insertion_order: number;
  position: EntryPosition;
  /** Used when position is at_depth. */
  depth: number;
  /** Human-readable name for reports (entry title or first key). */
  label: string;
  /** Lower = more important; the highest rank is trimmed first. */
  rank: number;
}

export interface DepthNote {
  content: string;
  depth: number;
  /** Shown in the budget report, e.g. "作者備註". */
  label: string;
}

export interface AssembleInput {
  /** Global main prompt. A card's own system_prompt overrides it ({{original}} keeps it). */
  systemPrompt: string;
  card: CharacterCardV2Data;
  userName: string;
  /** The user's own persona description (用戶描述). */
  userPersona?: string;
  world: WorldSnippet[];
  /** Max tokens world entries may take in total. */
  worldBudget?: number;
  /** Chat history, oldest first, NOT including the latest user message. */
  history: ChatMessage[];
  latestUser: string;
  /** Character's note (card extensions.depth_prompt) — where the PList belongs. */
  characterNote?: DepthNote | null;
  /** Author's note for this chat. Its depth also anchors an_top / an_bottom world entries. */
  authorNote?: DepthNote | null;
  /** Total tokens the prompt may use (context window minus reserved output). */
  budget: number;
  countTokens: TokenCounter;
}

export interface AssembleResult {
  messages: ChatMessage[];
  tokens: number;
  report: {
    worldIncluded: number;
    worldDropped: number;
    /** Labels of the world entries actually sent. */
    worldLabels: string[];
    /** Depth notes actually sent, e.g. "角色備註 @4". */
    notes: string[];
    examplesIncluded: boolean;
    historyIncluded: number;
    historyDropped: number;
    /** The must-keep layers alone exceed the budget. */
    overBudget: boolean;
  };
}

export const DEFAULT_NOTE_DEPTH = 4;

function section(title: string, body: string): string {
  return body.trim() ? `[${title}]\n${body.trim()}` : '';
}

const byOrder = (a: WorldSnippet, b: WorldSnippet) => a.insertion_order - b.insertion_order;

export function assemblePrompt(input: AssembleInput): AssembleResult {
  const { card, countTokens } = input;
  const vars = { char: card.name, user: input.userName };
  const sub = (t: string) => substituteVars(t, vars);
  const cost = (m: ChatMessage) => countTokens(m.content) + MESSAGE_OVERHEAD;
  const sys = (content: string): ChatMessage => ({ role: 'system', content });

  const basePrompt = card.system_prompt.trim()
    ? card.system_prompt.replace(/\{\{original\}\}/gi, input.systemPrompt)
    : input.systemPrompt;
  const latestMsg: ChatMessage = { role: 'user', content: sub(input.latestUser) };
  const postText = sub(card.post_history_instructions).trim();
  const examples = splitExamples(sub(card.mes_example));
  const charNote = input.characterNote?.content.trim() ? input.characterNote : null;
  const authorNote = input.authorNote?.content.trim() ? input.authorNote : null;
  const anDepth = Math.max(0, input.authorNote?.depth ?? DEFAULT_NOTE_DEPTH);

  // World entries: pre-trim to the world budget, least important out first.
  const worldBudget = input.worldBudget ?? Math.floor(input.budget * 0.25);
  let spent = 0;
  let world = [...input.world]
    .sort((a, b) => a.rank - b.rank)
    .filter((w) => {
      const c = countTokens(sub(w.content)) + 1;
      if (spent + c > worldBudget) return false;
      spent += c;
      return true;
    });

  let includeExamples = examples.length > 0;
  let history = input.history.map((m) => ({ ...m, content: sub(m.content) }));

  const inPosition = (pos: EntryPosition) => world.filter((w) => w.position === pos).sort(byOrder);
  const worldText = (pos: EntryPosition) => inPosition(pos).map((w) => sub(w.content).trim()).join('\n');

  const build = () => {
    const labels = (['before_char', 'after_char', 'at_depth', 'an_top', 'an_bottom'] as const).flatMap((p) =>
      inPosition(p).map((w) => w.label),
    );
    const systemText = [
      sub(basePrompt),
      section('世界資訊', worldText('before_char')),
      section(`${card.name} 的描述`, sub(card.description)),
      section(`${card.name} 的個性`, sub(card.personality)),
      section('情境', sub(card.scenario)),
      section('世界資訊', worldText('after_char')),
      section(`${input.userName} 的設定`, sub(input.userPersona ?? '')),
    ]
      .filter(Boolean)
      .join('\n\n');

    const chat = [...history, latestMsg];
    // Depth inserts; anything deeper than the chat goes to its top.
    const inserts = new Map<number, ChatMessage[]>();
    const put = (depth: number, content: string) => {
      const d = Math.min(Math.max(0, depth), chat.length);
      inserts.set(d, [...(inserts.get(d) ?? []), sys(content)]);
    };
    for (const w of inPosition('at_depth')) put(w.depth, sub(w.content).trim());
    if (charNote) put(charNote.depth, sub(charNote.content).trim());
    const anBlock = [worldText('an_top'), authorNote ? sub(authorNote.content).trim() : '', worldText('an_bottom')].filter(Boolean);
    if (anBlock.length) put(anDepth, anBlock.join('\n'));

    const messages: ChatMessage[] = [sys(systemText)];
    if (includeExamples) messages.push(sys(section('範例對話（僅供參考語氣，非實際發生）', examples.join('\n\n'))));
    for (let i = 0; i <= chat.length; i++) {
      messages.push(...(inserts.get(chat.length - i) ?? []));
      if (i < chat.length) messages.push(chat[i]!);
    }
    if (postText) messages.push(sys(postText));

    const notes = [
      ...(charNote ? [`${charNote.label} @${charNote.depth}`] : []),
      ...(authorNote ? [`${authorNote.label} @${anDepth}`] : []),
    ];
    return { messages, labels, notes };
  };
  const total = (msgs: ChatMessage[]) => msgs.reduce((s, m) => s + cost(m), 0);

  let built = build();
  let tokens = total(built.messages);
  const originalHistory = history.length;

  // Re-assemble after each cut so the count always matches what is sent.
  while (tokens > input.budget) {
    if (includeExamples) includeExamples = false;
    else if (history.length) history = history.slice(1);
    else if (world.length) world = world.slice(0, -1); // sorted by rank: drop the least important
    else break;
    built = build();
    tokens = total(built.messages);
  }

  return {
    messages: built.messages,
    tokens,
    report: {
      worldIncluded: world.length,
      worldDropped: input.world.length - world.length,
      worldLabels: built.labels,
      notes: built.notes,
      examplesIncluded: includeExamples,
      historyIncluded: history.length,
      historyDropped: originalHistory - history.length,
      overBudget: tokens > input.budget,
    },
  };
}
