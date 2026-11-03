// End-to-end smoke test: boots the real server against a fake OpenAI-compatible
// endpoint, then logs in, starts a chat and streams one reply.
// Usage: npm run test:smoke   (expects `npm run build` to have run first)
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MOCK_PORT = 9911;
const APP_PORT = 8799;
const BASE = `http://127.0.0.1:${APP_PORT}`;
let lastRequest = null;

const mock = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    lastRequest = { auth: req.headers.authorization, body: JSON.parse(body) };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const piece of ['歡迎', '來到', '酒館。']) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 42, completion_tokens: 3, total_tokens: 45 } })}\n\n`);
    res.end('data: [DONE]\n\n');
  });
});
await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));

const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: new URL('../server/', import.meta.url),
  env: {
    ...process.env,
    PORT: String(APP_PORT),
    APP_PASSWORD: 'smoke-pass',
    SESSION_SECRET: 'smoke-secret',
    OPENROUTER_API_KEY: 'sk-smoke',
    DATA_DIR: mkdtempSync(join(tmpdir(), 'tavern-smoke-')),
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
const stopServer = () => server.kill();

function fail(msg) {
  console.error(`✗ ${msg}`);
  stopServer();
  process.exit(1);
}
function assert(cond, msg) {
  if (!cond) fail(msg);
  console.log(`✓ ${msg}`);
}

let cookie = '';
async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

try {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${BASE}/api/auth/me`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const page = await fetch(`${BASE}/chat/1`);
  assert(page.ok && (await page.text()).includes('<div id="root">'), 'serves the web app with SPA fallback');

  assert((await api('GET', '/chats')).status === 401, 'API rejects unauthenticated requests');
  assert((await api('POST', '/auth/login', { password: 'nope' })).status === 401, 'wrong password rejected');
  const login = await api('POST', '/auth/login', { password: 'smoke-pass' });
  cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  assert(login.ok && cookie.startsWith('tavern_session='), 'login sets a session cookie');

  const settings = await (await api('GET', '/settings')).json();
  const profile = settings.profiles[0];
  assert(profile.key_present === true && !JSON.stringify(settings).includes('sk-smoke'), 'key is detected but never returned');

  const upd = await api('PUT', `/model-profiles/${profile.id}`, { base_url: `http://127.0.0.1:${MOCK_PORT}/v1` });
  assert(upd.ok, 'model profile can be updated');

  const characters = await (await api('GET', '/characters')).json();
  assert(characters.length === 1 && characters[0].name === '阿暖', 'sample character is seeded');

  const chat = await (await api('POST', '/chats', { character_id: characters[0].id })).json();
  assert(chat.messages.length === 1 && chat.messages[0].content.includes('旅人'), 'new chat starts with substituted greeting');

  const gen = await api('POST', `/chats/${chat.id}/generate`, { content: '你好，{{char}}！' });
  const events = (await gen.text())
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.slice(5)));
  const types = events.map((e) => e.type);
  assert(types[0] === 'user_saved' && types.at(-1) === 'done', `stream events in order (${types.join(',')})`);
  const text = events.filter((e) => e.type === 'delta').map((e) => e.text).join('');
  assert(text === '歡迎來到酒館。', 'deltas join into the full reply');

  assert(lastRequest.auth === 'Bearer sk-smoke', 'provider receives the key from env');
  const roles = lastRequest.body.messages.map((m) => m.role);
  assert(roles[0] === 'system' && roles.at(-1) === 'user', `prompt layers look right (${roles.join(',')})`);
  assert(lastRequest.body.messages.at(-1).content === '你好，阿暖！', 'variables substituted in the latest message');

  const saved = await (await api('GET', `/chats/${chat.id}`)).json();
  const last = saved.messages.at(-1);
  assert(saved.messages.length === 3 && last.content === '歡迎來到酒館。' && last.prompt_tokens === 42, 'reply and usage are saved');

  console.log('\nSmoke test passed.');
} catch (err) {
  fail(err instanceof Error ? err.stack : String(err));
}
stopServer();
mock.close();
process.exit(0);
