import type { TokenUsage } from '@tavern/shared';
import { readSseData } from './sse';
import { ProviderError, type LLMProvider, type ProviderErrorCode, type StreamInput } from './types';

export interface OpenAICompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}

interface CompletionChunk {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: Partial<TokenUsage> | null;
  error?: { message?: string; code?: number | string };
}

function codeForStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return 'PROVIDER_AUTH';
  if (status === 402 || status === 429) return 'PROVIDER_RATE_LIMIT';
  if (status === 400 || status === 404 || status === 422) return 'PROVIDER_BAD_REQUEST';
  if (status >= 500) return 'PROVIDER_UNAVAILABLE';
  return 'PROVIDER_ERROR';
}

async function errorMessageFrom(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as CompletionChunk;
    if (body.error?.message) return body.error.message;
  } catch {
    // body was not JSON
  }
  return `HTTP ${res.status}`;
}

/** Baseline provider for any OpenAI Chat Completions–compatible endpoint. */
export class OpenAICompatibleProvider implements LLMProvider {
  private lastUsage: TokenUsage | null = null;

  constructor(private readonly opts: OpenAICompatibleOptions) {}

  usage(): TokenUsage | null {
    return this.lastUsage;
  }

  async *stream({ messages, params, signal }: StreamInput): AsyncGenerator<string> {
    this.lastUsage = null;
    const fetchFn = this.opts.fetchImpl ?? fetch;
    const url = `${this.opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    let res: Response;
    try {
      res = await fetchFn(url, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.opts.apiKey}`,
          ...this.opts.extraHeaders,
        },
        body: JSON.stringify({
          model: this.opts.model,
          messages,
          stream: true,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          stream_options: { include_usage: true },
          ...this.opts.extraBody,
        }),
      });
    } catch (err) {
      if (signal.aborted) throw err;
      throw new ProviderError('PROVIDER_NETWORK', '無法連線到模型服務');
    }

    if (!res.ok || !res.body) {
      throw new ProviderError(codeForStatus(res.status), await errorMessageFrom(res));
    }

    for await (const data of readSseData(res.body)) {
      if (data === '[DONE]') break;
      let chunk: CompletionChunk;
      try {
        chunk = JSON.parse(data) as CompletionChunk;
      } catch {
        continue; // tolerate keep-alive noise
      }
      if (chunk.error) {
        throw new ProviderError('PROVIDER_ERROR', chunk.error.message ?? '模型服務回傳錯誤');
      }
      if (chunk.usage && typeof chunk.usage.prompt_tokens === 'number') {
        const prompt = chunk.usage.prompt_tokens;
        const completion = chunk.usage.completion_tokens ?? 0;
        this.lastUsage = {
          prompt_tokens: prompt,
          completion_tokens: completion,
          total_tokens: chunk.usage.total_tokens ?? prompt + completion,
        };
      }
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) yield text;
    }
  }
}
