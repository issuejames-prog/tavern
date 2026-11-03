import { describe, expect, it } from 'vitest';
import { DEFAULT_GEN_PARAMS } from '@tavern/shared';
import { OpenAICompatibleProvider } from './openai-compatible';
import { ProviderError } from './types';

function sseResponse(chunks: string[], init: ResponseInit = {}): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init });
}

const delta = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

function provider(fetchImpl: typeof fetch) {
  return new OpenAICompatibleProvider({ baseUrl: 'https://example.test/v1/', apiKey: 'k', model: 'm', fetchImpl });
}

async function collect(p: OpenAICompatibleProvider, signal = new AbortController().signal) {
  let out = '';
  for await (const t of p.stream({ messages: [{ role: 'user', content: 'hi' }], params: DEFAULT_GEN_PARAMS, signal })) {
    out += t;
  }
  return out;
}

describe('OpenAICompatibleProvider', () => {
  it('joins streamed deltas, even when split across network chunks, and reads usage', async () => {
    const usage = { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 };
    const raw = [
      ': OPENROUTER PROCESSING\n\n',
      delta('你好'),
      delta('，旅').slice(0, 20),
      delta('，旅').slice(20),
      delta('人'),
      `data: ${JSON.stringify({ choices: [], usage })}\n\n`,
      'data: [DONE]\n\n',
    ];
    let requestBody: Record<string, unknown> = {};
    const p = provider(async (url, init) => {
      expect(String(url)).toBe('https://example.test/v1/chat/completions');
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return sseResponse(raw);
    });
    expect(await collect(p)).toBe('你好，旅人');
    expect(p.usage()).toEqual(usage);
    expect(requestBody.stream).toBe(true);
    expect(requestBody.model).toBe('m');
  });

  it('maps HTTP errors to provider error codes', async () => {
    const p = provider(async () =>
      new Response(JSON.stringify({ error: { message: 'No auth credentials found' } }), { status: 401 }),
    );
    await expect(collect(p)).rejects.toMatchObject({ code: 'PROVIDER_AUTH', message: 'No auth credentials found' });
  });

  it('surfaces mid-stream errors after partial text', async () => {
    const p = provider(async () =>
      sseResponse([delta('部分'), `data: ${JSON.stringify({ error: { message: 'overloaded' } })}\n\n`]),
    );
    let received = '';
    const run = async () => {
      for await (const t of p.stream({
        messages: [],
        params: DEFAULT_GEN_PARAMS,
        signal: new AbortController().signal,
      })) {
        received += t;
      }
    };
    await expect(run()).rejects.toBeInstanceOf(ProviderError);
    expect(received).toBe('部分');
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const p = provider(async (_url, init) => {
      const signal = init?.signal as AbortSignal;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode(delta('一')));
          signal.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError')));
        },
      });
      return new Response(body, { status: 200 });
    });
    let received = '';
    const run = async () => {
      for await (const t of p.stream({ messages: [], params: DEFAULT_GEN_PARAMS, signal: controller.signal })) {
        received += t;
        controller.abort();
      }
    };
    await expect(run()).rejects.toThrow();
    expect(received).toBe('一');
  });
});
