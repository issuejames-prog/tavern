import { t } from '../i18n/zh-TW';
import { ensureReady } from './browser-store';
import { ApiRequestError } from './types';

/** Wraps an API method so storage is loaded before it runs. */
export function ready<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    await ensureReady();
    return fn(...args);
  };
}

export function requireName(name: string | undefined) {
  if (name !== undefined && !name.trim()) throw new ApiRequestError('NAME_REQUIRED', t.data.errors.nameRequired);
}

export function bytesBlob(bytes: Uint8Array, type: string): Blob {
  // Copy into a fresh ArrayBuffer-backed array so Blob accepts it in every TS lib version.
  return new Blob([new Uint8Array(bytes)], { type });
}

export const AVATAR_COLORS = ['sage', 'clay', 'sky', 'sand', 'plum'] as const;
export const randomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
