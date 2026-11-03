import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = resolve(here, '../../..');

// Node >= 21.7 can load .env natively, so no dotenv dependency is needed.
const envFile = resolve(ROOT_DIR, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  appPassword: required('APP_PASSWORD'),
  sessionSecret: required('SESSION_SECRET'),
  port: int('PORT', 8787),
  dailyRequestLimit: int('DAILY_REQUEST_LIMIT', 300),
  debugMode: process.env.DEBUG_MODE === '1',
  // Only enable behind HTTPS (Caddy / Tunnel); plain-http localhost would drop the cookie.
  cookieSecure: process.env.COOKIE_SECURE === '1',
  dataDir: resolve(ROOT_DIR, process.env.DATA_DIR ?? 'data'),
  webDist: resolve(ROOT_DIR, 'web/dist'),
};

/** Reads a provider key by env var name. Keys are only ever touched here and in providers. */
export function readSecret(envName: string): string | undefined {
  // Restrict to conventional names so a profile can't be pointed at e.g. SESSION_SECRET.
  if (!/^[A-Z][A-Z0-9_]*_API_KEY$/.test(envName)) return undefined;
  return process.env[envName] || undefined;
}
