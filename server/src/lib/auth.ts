import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { env } from '../config/env';
import { errorBody } from './errors';

export const SESSION_COOKIE = 'tavern_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function sign(payload: string): string {
  return createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  // Compare HMACs so length differences don't leak through timing.
  return safeEqual(sign(`pw:${input}`), sign(`pw:${env.appPassword}`));
}

/** Token = "<expiresAtSeconds>.<signature>" — stateless, single user. */
export function createSessionToken(now = Date.now()): string {
  const expires = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  return `${expires}.${sign(`session:${expires}`)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expiresRaw, signature] = token.split('.');
  const expires = Number(expiresRaw);
  if (!signature || !Number.isFinite(expires) || expires * 1000 < now) return false;
  return safeEqual(signature, sign(`session:${expires}`));
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!verifySessionToken(getCookie(c, SESSION_COOKIE))) {
    return c.json(errorBody('UNAUTHORIZED', '請先登入'), 401);
  }
  await next();
};

// Naive in-memory throttle for the login endpoint: 5 failures per minute per IP.
const failures = new Map<string, number[]>();

export function tooManyLoginAttempts(ip: string, now = Date.now()): boolean {
  const recent = (failures.get(ip) ?? []).filter((t) => now - t < 60_000);
  failures.set(ip, recent);
  return recent.length >= 5;
}

export function recordLoginFailure(ip: string, now = Date.now()) {
  failures.set(ip, [...(failures.get(ip) ?? []), now]);
}
