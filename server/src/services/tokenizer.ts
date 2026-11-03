import { encode } from 'gpt-tokenizer';
import { MESSAGE_OVERHEAD, type ChatMessage, type TokenCounter } from '@tavern/shared';

export type { TokenCounter };

/**
 * An estimate: OpenRouter models use many tokenizers, so this is only for
 * budgeting. Actual usage reported by the provider is what gets stored.
 */
export const countTokens: TokenCounter = (text) => (text ? encode(text).length : 0);

export function countMessages(messages: ChatMessage[], counter: TokenCounter = countTokens): number {
  return messages.reduce((sum, m) => sum + counter(m.content) + MESSAGE_OVERHEAD, 0);
}
