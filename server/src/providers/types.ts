import type { ChatMessage, GenParams, TokenUsage } from '@tavern/shared';

export interface StreamInput {
  messages: ChatMessage[];
  params: GenParams;
  signal: AbortSignal;
}

/**
 * The only contract the rest of the server relies on:
 * messages in, text chunks out, usage reported afterwards.
 */
export interface LLMProvider {
  stream(input: StreamInput): AsyncIterable<string>;
  usage(): TokenUsage | null;
}

export type ProviderErrorCode =
  | 'PROVIDER_AUTH'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_BAD_REQUEST'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_NETWORK'
  | 'PROVIDER_ERROR';

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
  }
}
