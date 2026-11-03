import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { getConnInfo } from '@hono/node-server/conninfo';
import { env } from '../config/env';
import {
  checkPassword,
  createSessionToken,
  recordLoginFailure,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  tooManyLoginAttempts,
  verifySessionToken,
} from '../lib/auth';
import { AppError, readJson, sendError } from '../lib/errors';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  try {
    const ip = getConnInfo(c).remote.address ?? 'unknown';
    if (tooManyLoginAttempts(ip)) throw new AppError('TOO_MANY_ATTEMPTS', '嘗試太多次了，請一分鐘後再試', 429);

    const body = await readJson(c);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!checkPassword(password)) {
      recordLoginFailure(ip);
      throw new AppError('WRONG_PASSWORD', '密碼不正確', 401);
    }
    setCookie(c, SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: 'Lax',
      secure: env.cookieSecure,
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return c.json({ ok: true });
  } catch (err) {
    return sendError(c, err);
  }
});

authRoutes.post('/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', (c) => c.json({ authenticated: verifySessionToken(getCookie(c, SESSION_COOKIE)) }));
