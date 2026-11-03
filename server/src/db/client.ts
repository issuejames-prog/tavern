import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { env } from '../config/env';
import * as schema from './schema';

const here = dirname(fileURLToPath(import.meta.url));

mkdirSync(env.dataDir, { recursive: true });
const sqlite = new Database(resolve(env.dataDir, 'app.sqlite'));
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;

/** Applies pending migrations; safe to run on every boot. */
export function runMigrations() {
  migrate(db, { migrationsFolder: resolve(here, 'migrations') });
}
