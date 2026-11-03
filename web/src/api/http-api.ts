import type { ApiError, StreamEvent } from '@tavern/shared';
import { t } from '../i18n/zh-TW';
import { ApiRequestError, type TavernApi } from './types';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError('NETWORK', t.errors.network, 0);
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    throw new ApiRequestError(err?.code ?? 'HTTP_ERROR', err?.message ?? t.errors.unknown, res.status);
  }
  return data as T;
}

/** Reads `data:` payloads from a fetch body (EventSource can't POST). */
async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) yield JSON.parse(data) as StreamEvent;
    }
  }
}

export const httpApi: TavernApi = {
  isDemo: false,
  me: () => request('GET', '/auth/me'),
  login: async (password) => {
    await request('POST', '/auth/login', { password });
  },
  logout: async () => {
    await request('POST', '/auth/logout');
  },

  listCharacters: () => request('GET', '/characters'),
  getCharacter: (id) => request('GET', `/characters/${id}`),
  createCharacter: (input) => request('POST', '/characters', input),
  updateCharacter: (id, input) => request('PUT', `/characters/${id}`, input),
  deleteCharacter: async (id) => {
    await request('DELETE', `/characters/${id}`);
  },

  listChats: () => request('GET', '/chats'),
  getChat: (id) => request('GET', `/chats/${id}`),
  createChat: (characterId) => request('POST', '/chats', { character_id: characterId }),
  deleteChat: async (id) => {
    await request('DELETE', `/chats/${id}`);
  },

  async generate(chatId, content, onEvent, signal) {
    let res: Response;
    try {
      res = await fetch(`/api/chats/${chatId}/generate`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) return;
      throw err instanceof Error ? new ApiRequestError('NETWORK', t.errors.network, 0) : err;
    }
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => null)) as ApiError | null;
      throw new ApiRequestError(data?.error.code ?? 'HTTP_ERROR', data?.error.message ?? t.errors.unknown, res.status);
    }
    try {
      for await (const event of sseEvents(res.body)) onEvent(event);
    } catch (err) {
      if (!signal.aborted) throw err;
    }
  },

  getSettings: () => request('GET', '/settings'),
  updateSettings: (input) => request('PUT', '/settings', input),
  updateProfile: (id, input) => request('PUT', `/model-profiles/${id}`, input),
};
