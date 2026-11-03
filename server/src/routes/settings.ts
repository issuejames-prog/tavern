import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { SettingsResponse } from '@tavern/shared';
import { env } from '../config/env';
import { db } from '../db/client';
import { modelProfiles } from '../db/schema';
import { AppError, idParam, readJson, sendError } from '../lib/errors';
import { getAppSettings, listProfiles, setAppSetting, toProfile } from '../services/repo';
import { requestsToday } from '../services/usage';

export const settingsRoutes = new Hono();

function snapshot(): SettingsResponse {
  return {
    settings: getAppSettings(),
    profiles: listProfiles(),
    usage_today: { requests: requestsToday(), limit: env.dailyRequestLimit },
  };
}

function num(raw: unknown, min: number, max: number, label: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new AppError('BAD_VALUE', `${label}需介於 ${min} 到 ${max} 之間`);
  }
  return n;
}

function str(raw: unknown, label: string, pattern?: RegExp): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !raw.trim()) throw new AppError('BAD_VALUE', `${label}不能是空的`);
  if (pattern && !pattern.test(raw.trim())) throw new AppError('BAD_VALUE', `${label}格式不正確`);
  return raw.trim();
}

settingsRoutes.get('/settings', (c) => c.json(snapshot()));

settingsRoutes.put('/settings', async (c) => {
  try {
    const body = await readJson(c);
    const userName = str(body.user_name, '暱稱');
    if (userName !== undefined) setAppSetting('user_name', userName);
    if (typeof body.system_prompt === 'string') setAppSetting('system_prompt', body.system_prompt);
    return c.json(snapshot());
  } catch (err) {
    return sendError(c, err);
  }
});

settingsRoutes.put('/model-profiles/:id', async (c) => {
  try {
    const id = idParam(c.req.param('id'));
    const body = await readJson(c);
    const params = (body.params && typeof body.params === 'object' ? body.params : {}) as Record<string, unknown>;
    const provider = body.provider === undefined ? undefined : body.provider === 'openai-compatible' ? 'openai-compatible' : 'openrouter';

    const patch = {
      name: str(body.name, '名稱'),
      provider,
      base_url: str(body.base_url, 'API 位址', /^https?:\/\//),
      model: str(body.model, '模型 ID'),
      // Only the NAME of the env var is stored; the key never reaches the database.
      key_env: str(body.key_env, '金鑰環境變數', /^[A-Z][A-Z0-9_]*_API_KEY$/),
      temperature: num(params.temperature, 0, 2, '溫度'),
      top_p: num(params.top_p, 0, 1, 'Top P'),
      max_tokens: num(params.max_tokens, 16, 8192, '單次輸出上限'),
      context_tokens: num(body.context_tokens, 1024, 1_000_000, '上下文長度'),
    };
    const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));

    const current = db.select().from(modelProfiles).where(eq(modelProfiles.id, id)).get();
    if (!current) throw new AppError('NOT_FOUND', '找不到模型設定', 404);
    if ((patch.max_tokens ?? current.max_tokens) >= (patch.context_tokens ?? current.context_tokens)) {
      throw new AppError('BAD_VALUE', '單次輸出上限必須小於上下文長度');
    }

    const row = db
      .update(modelProfiles)
      .set({ ...set, updated_at: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
      .where(eq(modelProfiles.id, id))
      .returning()
      .get();
    if (!row) throw new AppError('NOT_FOUND', '找不到模型設定', 404);
    return c.json(toProfile(row));
  } catch (err) {
    return sendError(c, err);
  }
});
