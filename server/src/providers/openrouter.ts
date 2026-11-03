import { OpenAICompatibleProvider } from './openai-compatible';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter speaks the OpenAI format; the differences live here only:
 * attribution headers and its own usage-accounting flag.
 */
export function createOpenRouterProvider(opts: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  return new OpenAICompatibleProvider({
    baseUrl: opts.baseUrl || OPENROUTER_BASE_URL,
    apiKey: opts.apiKey,
    model: opts.model,
    fetchImpl: opts.fetchImpl,
    extraHeaders: {
      'HTTP-Referer': 'https://github.com/issuejames-prog/tavern',
      'X-Title': 'Tavern',
    },
    extraBody: { usage: { include: true } },
  });
}
