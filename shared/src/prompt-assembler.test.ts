import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './api';
import { emptyCardData } from './card';
import { assemblePrompt, type AssembleInput } from './prompt-assembler';

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

describe('assemblePrompt', () => {
  it('orders layers: system+card, world, examples, history, latest, post-history', () => {
    const { messages } = assemblePrompt(
      baseInput({
        world: [{ content: 'The moon is green', priority: 1, insertion_order: 0 }],
        history: hist(2),
      }),
    );
    expect(messages.map((m) => m.role)).toEqual(['system', 'system', 'system', 'user', 'assistant', 'user', 'system']);
    expect(messages[0]!.content).toContain('SYS Nova/Kai');
    expect(messages[0]!.content).toContain('desc');
    expect(messages[1]!.content).toContain('The moon is green');
    expect(messages[2]!.content).toContain('Kai: hi');
    expect(messages.at(-2)!.content).toBe('hello');
    expect(messages.at(-1)!.content).toBe('stay in character');
  });

  it('lets a card system_prompt override the global one, keeping {{original}}', () => {
    const input = baseInput();
    input.card.system_prompt = 'CARD + {{original}}';
    expect(assemblePrompt(input).messages[0]!.content).toContain('CARD + SYS Nova/Kai');
  });

  it('drops examples first, then the oldest history', () => {
    const full = assemblePrompt(baseInput({ history: hist(6) }));
    // Budget that fits everything except examples and two history messages.
    const exampleCost = full.messages[1]!.content.length + 4;
    const perHistory = full.messages[2]!.content.length + 4;
    const budget = full.tokens - exampleCost - perHistory * 2;

    const { messages, report, tokens } = assemblePrompt(baseInput({ history: hist(6), budget }));
    expect(report.examplesIncluded).toBe(false);
    expect(report.historyDropped).toBe(2);
    expect(tokens).toBeLessThanOrEqual(budget);
    // Oldest dropped: the first remaining history message is msg-2.
    expect(messages[1]!.content.startsWith('msg-2-')).toBe(true);
  });

  it('always keeps system, latest user and post-history even when over budget', () => {
    const { messages, report } = assemblePrompt(baseInput({ history: hist(4), budget: 5 }));
    expect(report.overBudget).toBe(true);
    expect(messages[0]!.role).toBe('system');
    expect(messages.at(-2)!.content).toBe('hello');
    expect(messages.at(-1)!.content).toBe('stay in character');
    expect(report.historyIncluded).toBe(0);
  });

  it('keeps higher-priority world entries within the world budget', () => {
    const { messages, report } = assemblePrompt(
      baseInput({
        worldBudget: 30,
        world: [
          { content: 'LOW-priority-entry', priority: 1, insertion_order: 0 },
          { content: 'HIGH-priority-entry', priority: 9, insertion_order: 1 },
        ],
      }),
    );
    expect(report.worldIncluded).toBe(1);
    expect(messages[1]!.content).toContain('HIGH');
    expect(messages[1]!.content).not.toContain('LOW');
  });

  it('substitutes variables in history too', () => {
    const { messages } = assemblePrompt(
      baseInput({ history: [{ role: 'assistant', content: 'Hi {{user}}, I am {{char}}' }] }),
    );
    expect(messages.some((m) => m.content === 'Hi Kai, I am Nova')).toBe(true);
  });

  it('substitutes variables in the latest user message', () => {
    const { messages } = assemblePrompt(baseInput({ latestUser: 'Hello {{char}}, it is {{user}}' }));
    expect(messages.at(-2)!.content).toBe('Hello Nova, it is Kai');
  });
});
