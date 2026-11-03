import { count, eq } from 'drizzle-orm';
import type { TokenUsage } from '@tavern/shared';
import { env } from '../config/env';
import { db } from '../db/client';
import { usageLog } from '../db/schema';

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function requestsToday(): number {
  const row = db.select({ n: count() }).from(usageLog).where(eq(usageLog.day, today())).get();
  return row?.n ?? 0;
}

/** Safety valve against runaway bills (CLAUDE.md §10). 0 means unlimited. */
export function isOverDailyLimit(): boolean {
  return env.dailyRequestLimit > 0 && requestsToday() >= env.dailyRequestLimit;
}

export function recordUsage(usage: TokenUsage | null) {
  db.insert(usageLog)
    .values({
      day: today(),
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
    })
    .run();
}
