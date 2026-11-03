import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './config/env';
import { runMigrations } from './db/client';
import { seedDefaults } from './db/seed';
import { requireAuth } from './lib/auth';
import { errorBody, sendError } from './lib/errors';
import { authRoutes } from './routes/auth';
import { characterRoutes } from './routes/characters';
import { chatRoutes } from './routes/chats';
import { settingsRoutes } from './routes/settings';

runMigrations();
seedDefaults();

const app = new Hono();
app.use('*', secureHeaders());

const api = new Hono();
api.route('/auth', authRoutes);
api.use('*', requireAuth);
api.route('/characters', characterRoutes);
api.route('/chats', chatRoutes);
api.route('/', settingsRoutes);
api.notFound((c) => c.json(errorBody('NOT_FOUND', '找不到這個 API'), 404));
api.onError((err, c) => sendError(c, err));
app.route('/api', api);

// In production the server also hosts the built web app (single process, single port).
if (existsSync(env.webDist)) {
  const indexHtml = readFileSync(resolve(env.webDist, 'index.html'), 'utf8');
  app.use('/*', serveStatic({ root: relative(process.cwd(), env.webDist) }));
  app.get('*', (c) => c.html(indexHtml)); // SPA fallback for client-side routes
}

serve({ fetch: app.fetch, port: env.port, hostname: process.env.HOST ?? '127.0.0.1' }, (info) => {
  console.log(`🍺 Tavern server listening on http://${info.address}:${info.port}`);
});
