import type { ChatMessage } from './api';
import type { CharacterCardV2Data } from './card';
import { MESSAGE_OVERHEAD, splitExamples, substituteVars, type TokenCounter } from './text';

export interface WorldSnippet {
  content: string;
  priority: number;
  insertion_order: number;
}

export interface AssembleInput {
  /** Global system prompt from settings. A card's own system_prompt overrides it ({{original}} keeps it). */
  systemPrompt: string;
  card: CharacterCardV2Data;
  userName: string;
  /** Already-triggered world entries (stage 2 fills this; stage 1 passes []). */
  world: WorldSnippet[];
  /** Max tokens world entries may take on their own. */
  worldBudget?: number;
  /** Chat history, oldest first, NOT including the latest user message. */
  history: ChatMessage[];
  latestUser: string;
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
    examplesIncluded: boolean;
    historyIncluded: number;
    historyDropped: number;
    /** The must-keep layers alone exceed the budget. */
    overBudget: boolean;
  };
}

function section(title: string, body: string): string {
  return body.trim() ? `[${title}]\n${body.trim()}` : '';
}

/**
 * Builds the message list in the fixed order from CLAUDE.md §4:
 * system+card → world → examples → history → latest user → post-history instructions.
 * When over budget it drops, in order: examples, oldest history, lowest-priority world entries.
 */
export function assemblePrompt(input: AssembleInput): AssembleResult {
  const { card, countTokens } = input;
  const vars = { char: card.name, user: input.userName };
  const sub = (t: string) => substituteVars(t, vars);
  const cost = (m: ChatMessage) => countTokens(m.content) + MESSAGE_OVERHEAD;

  // ---- Layer 1: system + card (must keep) ----
  const basePrompt = card.system_prompt.trim()
    ? card.system_prompt.replace(/\{\{original\}\}/gi, input.systemPrompt)
    : input.systemPrompt;
  const systemText = [
    sub(basePrompt),
    section(`${card.name} 的描述`, sub(card.description)),
    section(`${card.name} 的個性`, sub(card.personality)),
    section('情境', sub(card.scenario)),
  ]
    .filter(Boolean)
    .join('\n\n');
  const systemMsg: ChatMessage = { role: 'system', content: systemText };

  // ---- Layer 5 & 6: latest user + post-history (must keep) ----
  const latestMsg: ChatMessage = { role: 'user', content: sub(input.latestUser) };
  const postText = sub(card.post_history_instructions).trim();
  const postMsg: ChatMessage | null = postText ? { role: 'system', content: postText } : null;

  // ---- Layer 2: world entries, capped by their own budget, by priority ----
  const worldBudget = input.worldBudget ?? Math.floor(input.budget * 0.25);
  const byPriority = [...input.world].sort(
    (a, b) => b.priority - a.priority || a.insertion_order - b.insertion_order,
  );
  let world: WorldSnippet[] = [];
  let worldSpent = 0;
  for (const entry of byPriority) {
    const c = countTokens(sub(entry.content)) + 1;
    if (worldSpent + c > worldBudget) continue;
    world.push(entry);
    worldSpent += c;
  }

  // ---- Layer 3: examples ----
  const examples = splitExamples(sub(card.mes_example));
  let includeExamples = examples.length > 0;

  // ---- Layer 4: history ----
  let history = input.history.map((m) => ({ ...m, content: sub(m.content) }));

  const build = (): ChatMessage[] => {
    const out: ChatMessage[] = [systemMsg];
    if (world.length) {
      const text = [...world]
        .sort((a, b) => a.insertion_order - b.insertion_order)
        .map((w) => sub(w.content).trim())
        .join('\n');
      out.push({ role: 'system', content: section('世界資訊', text) });
    }
    if (includeExamples) {
      out.push({ role: 'system', content: section('範例對話（僅供參考語氣，非實際發生）', examples.join('\n\n')) });
    }
    out.push(...history, latestMsg);
    if (postMsg) out.push(postMsg);
    return out;
  };
  const total = (msgs: ChatMessage[]) => msgs.reduce((s, m) => s + cost(m), 0);

  let messages = build();
  let tokens = total(messages);
  const originalHistory = history.length;

  // Re-assemble after each cut, so the count always matches what is sent.
  while (tokens > input.budget) {
    if (includeExamples) includeExamples = false;
    else if (history.length) history = history.slice(1);
    else if (world.length) {
      const lowest = [...world].sort(
        (a, b) => a.priority - b.priority || b.insertion_order - a.insertion_order,
      )[0];
      world = world.filter((w) => w !== lowest);
    } else break;
    messages = build();
    tokens = total(messages);
  }

  return {
    messages,
    tokens,
    report: {
      worldIncluded: world.length,
      worldDropped: input.world.length - world.length,
      examplesIncluded: includeExamples,
      historyIncluded: history.length,
      historyDropped: originalHistory - history.length,
      overBudget: tokens > input.budget,
    },
  };
}
