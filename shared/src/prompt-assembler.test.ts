import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './api';
import { emptyCardData } from './card';
import { assemblePrompt, type AssembleInput, type WorldSnippet } from './prompt-assembler';

// 1 token per character keeps the budget math easy to reason about.
const charCounter = (t: string) => t.length;

function baseInput(overrides: Partial<AssembleInput> = {}): AssembleInput {
  return {
    systemPrompt: 'SYS {{char}}/{{user}}',
    card: {
      ...emptyCardData('Nova'),
      description: 'desc',
      personality: 'calm',
      scenario: 'bar',
      mes_example: '<START>\n{{user}}: hi\n{{char}}: hey',
      post_history_instructions: 'stay in character',
    },
    userName: 'Kai',
    world: [],
    history: [],
    latestUser: 'hello',
    budget: 100_000,
    countTokens: charCounter,
    ...overrides,
  };
}

const hist = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i): ChatMessage => ({
    role: i % 2 ? 'assistant' : 'user',
    content: `msg-${i}-${'x'.repeat(40)}`,
  }));

const snip = (content: string, extra: Partial<WorldSnippet> = {}): WorldSnippet => ({
  content,
  insertion_order: 100,
  position: 'after_char',
  depth: 4,
  label: content,
  rank: 1,
  ...extra,
});

describe('assemblePrompt', () => {
  it('orders layers: system+card(+world), examples, history, latest, post-history', () => {
    const { messages } = assemblePrompt(baseInput({ world: [snip('The moon is green')], history: hist(2) }));
    expect(messages.map((m) => m.role)).toEqual(['system', 'system', 'user', 'assistant', 'user', 'system']);
    expect(messages[0]!.content).toContain('SYS Nova/Kai');
    expect(messages[0]!.content).toContain('desc');
    expect(messages[1]!.content).toContain('Kai: hi');
    expect(messages.at(-2)!.content).toBe('hello');
    expect(messages.at(-1)!.content).toBe('stay in character');
  });

  it('places before_char entries above the description and after_char below it, by insertion order', () => {
    const sys = assemblePrompt(
      baseInput({
        world: [snip('AFTER-2', { insertion_order: 2 }), snip('BEFORE', { position: 'before_char' }), snip('AFTER-1', { insertion_order: 1 })],
      }),
    ).messages[0]!.content;
    expect(sys.indexOf('BEFORE')).toBeLessThan(sys.indexOf('desc'));
    expect(sys.indexOf('desc')).toBeLessThan(sys.indexOf('AFTER-1'));
    expect(sys.indexOf('AFTER-1')).toBeLessThan(sys.indexOf('AFTER-2'));
  });

  it('inserts notes and @D entries counted from the bottom; author note block is last at its depth', () => {
    const { messages, report } = assemblePrompt(
      baseInput({
        card: { ...emptyCardData('Nova') },
        history: hist(6),
        characterNote: { content: 'PLIST', depth: 4, label: '角色備註' },
        authorNote: { content: 'AN', depth: 2, label: '作者備註' },
        world: [snip('ATD', { position: 'at_depth', depth: 4 }), snip('TOP', { position: 'an_top' }), snip('BOTTOM', { position: 'an_bottom' })],
      }),
    );
    const contents = messages.map((m) => m.content);
    // chat = 6 history + latest = 7 messages; depth 4 → before the 4th from the bottom (msg-3)
    const idx3 = contents.findIndex((c) => c.startsWith('msg-3-'));
    expect(contents.slice(idx3 - 2, idx3)).toEqual(['ATD', 'PLIST']);
    const idx5 = contents.findIndex((c) => c.startsWith('msg-5-'));
    expect(contents[idx5 - 1]).toBe('TOP\nAN\nBOTTOM');
    expect(report.notes).toEqual(['角色備註 @4', '作者備註 @2']);
  });

  it('depth 0 puts the note after the latest message; notes deeper than the chat go to its top', () => {
    const shallow = assemblePrompt(baseInput({ card: emptyCardData('Nova'), authorNote: { content: 'AN', depth: 0, label: 'a' } }));
    expect(shallow.messages.at(-1)!.content).toBe('AN');
    const deep = assemblePrompt(baseInput({ card: emptyCardData('Nova'), characterNote: { content: 'CN', depth: 9, label: 'c' } }));
    expect(deep.messages[1]!.content).toBe('CN');
  });

  it('adds the user persona to the system message', () => {
    expect(assemblePrompt(baseInput({ userPersona: 'a wandering {{user}}' })).messages[0]!.content).toContain('a wandering Kai');
  });

  it('lets a card system_prompt override the global one, keeping {{original}}', () => {
    const input = baseInput();
    input.card.system_prompt = 'CARD + {{original}}';
    expect(assemblePrompt(input).messages[0]!.content).toContain('CARD + SYS Nova/Kai');
  });

  it('drops examples first, then the oldest history', () => {
    const full = assemblePrompt(baseInput({ history: hist(6) }));
    const exampleCost = full.messages[1]!.content.length + 4;
    const perHistory = full.messages[2]!.content.length + 4;
    const budget = full.tokens - exampleCost - perHistory * 2;

    const { messages, report, tokens } = assemblePrompt(baseInput({ history: hist(6), budget }));
    expect(report.examplesIncluded).toBe(false);
    expect(report.examplesDropped).toBe(true);
    expect(report.historyDropped).toBe(2);
    expect(tokens).toBeLessThanOrEqual(budget);
    expect(messages[1]!.content.startsWith('msg-2-')).toBe(true);
  });

  it('always keeps system, notes, latest user and post-history even when over budget', () => {
    const { messages, report } = assemblePrompt(
      baseInput({ history: hist(4), budget: 5, authorNote: { content: 'AN', depth: 1, label: 'a' } }),
    );
    expect(report.overBudget).toBe(true);
    expect(messages[0]!.role).toBe('system');
    expect(messages.map((m) => m.content)).toContain('AN');
    expect(messages.at(-2)!.content).toBe('hello');
    expect(messages.at(-1)!.content).toBe('stay in character');
    expect(report.historyIncluded).toBe(0);
  });

  it('keeps the most important world entries (lowest rank) within the world budget', () => {
    const { messages, report } = assemblePrompt(
      baseInput({ worldBudget: 30, world: [snip('LOW-rank-entry-xx', { rank: 9 }), snip('HIGH-rank-entry', { rank: 0 })] }),
    );
    expect(report.worldIncluded).toBe(1);
    expect(messages[0]!.content).toContain('HIGH');
    expect(messages[0]!.content).not.toContain('LOW');
  });

  it('substitutes variables in history and in the latest message', () => {
    const { messages } = assemblePrompt(
      baseInput({ history: [{ role: 'assistant', content: 'Hi {{user}}, I am {{char}}' }], latestUser: 'Hello {{char}}' }),
    );
    expect(messages.some((m) => m.content === 'Hi Kai, I am Nova')).toBe(true);
    expect(messages.at(-2)!.content).toBe('Hello Nova');
  });
});
