import type { ChatMessage, GenParams, ModelProfile, TokenUsage } from '@tavern/shared';
import { t } from '../i18n/zh-TW';

/*
 * Model adapter (CLAUDE.md §4.5): messages in, text stream out, usage reported.
 * OpenRouter allows direct browser calls (CORS), so the request goes straight
 * from this tab to the provider using the viewer's own key.
 */

/** Defaults for a fresh install. Provider specifics live only in this file (CLAUDE.md §5.2). */
export const DEFAULT_PROVIDER: Pick<ModelProfile, 'name' | 'provider' | 'base_url' | 'model'> = {
  name: 'OpenRouter',
  provider: 'openrouter',
  base_url: 'https://openrouter.ai/api/v1',
  model: 'deepseek/deepseek-chat-v3-0324',
};

/** Where users create a key (linked from the settings page). */
export const PROVIDER_KEYS_URL = 'https://openrouter.ai/keys';

export class BrowserLlmError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Chunk {
  choices?: { delta?: { content?: string | null } }[];
  usage?: Partial<TokenUsage> | null;
  error?: { message?: string };
}

function errorFor(status: number, detail: string): BrowserLlmError {
  if (status === 401 || status === 403) return new BrowserLlmError('PROVIDER_AUTH', t.browser.errors.auth);
  if (status === 402) return new BrowserLlmError('PROVIDER_CREDITS', t.browser.errors.credits);
  if (status === 429) return new BrowserLlmError('PROVIDER_RATE_LIMIT', t.browser.errors.rateLimit);
  if (status === 400 || status === 404) return new BrowserLlmError('PROVIDER_BAD_REQUEST', t.browser.errors.badRequest(detail));
  return new BrowserLlmError('PROVIDER_ERROR', t.browser.errors.generic(detail));
}

/** Yields text deltas; `onUsage` receives the final usage report if the provider sends one. */
export async function* streamCompletion(opts: {
  profile: ModelProfile;
  apiKey: string;
  messages: ChatMessage[];
  params: GenParams;
  signal: AbortSignal;
  onUsage: (usage: TokenUsage) => void;
}): AsyncGenerator<string> {
  const isOpenRouter = opts.profile.provider === 'openrouter';
  let res: Response;
  try {
    res = await fetch(`${opts.profile.base_url.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: opts.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
        ...(isOpenRouter ? { 'HTTP-Referer': location.origin, 'X-Title': 'Tavern' } : {}),
      },
      body: JSON.stringify({
        model: opts.profile.model,
        messages: opts.messages,
        stream: true,
        temperature: opts.params.temperature,
        top_p: opts.params.top_p,
        max_tokens: opts.params.max_tokens,
        ...(isOpenRouter ? { usage: { include: true } } : { stream_options: { include_usage: true } }),
      }),
    });
  } catch (err) {
    if (opts.signal.aborted) throw err;
    throw new BrowserLlmError('PROVIDER_NETWORK', t.browser.errors.network);
  }

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as Chunk | null;
    throw errorFor(res.status, body?.error?.message ?? `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue; // skips ": OPENROUTER PROCESSING" keep-alives
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      let chunk: Chunk;
      try {
        chunk = JSON.parse(data) as Chunk;
      } catch {
        continue;
      }
      if (chunk.error) throw new BrowserLlmError('PROVIDER_ERROR', t.browser.errors.generic(chunk.error.message ?? ''));
      if (chunk.usage && typeof chunk.usage.prompt_tokens === 'number') {
        const completion = chunk.usage.completion_tokens ?? 0;
        opts.onUsage({
          prompt_tokens: chunk.usage.prompt_tokens,
          completion_tokens: completion,
          total_tokens: chunk.usage.total_tokens ?? chunk.usage.prompt_tokens + completion,
        });
      }
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) yield text;
    }
  }
}
