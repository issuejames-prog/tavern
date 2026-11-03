import { encode } from 'gpt-tokenizer';
import type { ChatMessage } from '@tavern/shared';

export type TokenCounter = (text: string) => number;

// Per-message framing overhead in the chat format (role markers etc.).
export const MESSAGE_OVERHEAD = 4;

/**
 * An estimate: OpenRouter models use many tokenizers, so this is only for
 * budgeting. Actual usage reported by the provider is what gets stored.
 */
export const countTokens: TokenCounter = (text) => (text ? encode(text).length : 0);

export function countMessages(messages: ChatMessage[], counter: TokenCounter = countTokens): number {
  return messages.reduce((sum, m) => sum + counter(m.content) + MESSAGE_OVERHEAD, 0);
}
