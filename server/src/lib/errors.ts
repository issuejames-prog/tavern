import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiError } from '@tavern/shared';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: ContentfulStatusCode = 400,
  ) {
    super(message);
  }
}

export function errorBody(code: string, message: string): ApiError {
  return { error: { code, message } };
}

export function sendError(c: Context, err: unknown) {
  if (err instanceof AppError) return c.json(errorBody(err.code, err.message), err.status);
  // Never echo internal error details: they may contain prompt text or secrets.
  console.error('[server] unexpected error:', err instanceof Error ? err.message : err);
  return c.json(errorBody('INTERNAL', '伺服器發生未預期的錯誤'), 500);
}

export function notFound(what: string): AppError {
  return new AppError('NOT_FOUND', `找不到${what}`, 404);
}

/** Parses a positive integer route param or throws 400. */
export function idParam(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new AppError('BAD_ID', '無效的編號');
  return n;
}

export async function readJson(c: Context): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await c.req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new AppError('BAD_JSON', '請求內容不是有效的 JSON 物件');
}
