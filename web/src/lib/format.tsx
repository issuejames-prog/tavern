import type { ReactNode } from 'react';
import { t } from '../i18n/zh-TW';

/** Renders role-play text: *actions* become soft italics, everything else stays verbatim. */
export function renderRoleplay(text: string): ReactNode[] {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return parts.map((part, i) =>
    part.length > 2 && part.startsWith('*') && part.endsWith('*') ? <em key={i}>{part.slice(1, -1)}</em> : part,
  );
}

export function relativeTime(iso: string): string {
  const then = new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
  const diff = Math.max(0, Date.now() - then) / 1000;
  if (diff < 60) return t.time.justNow;
  if (diff < 3600) return t.time.minutes(Math.floor(diff / 60));
  if (diff < 86400) return t.time.hours(Math.floor(diff / 3600));
  if (diff < 86400 * 7) return t.time.days(Math.floor(diff / 86400));
  return new Date(then).toLocaleDateString('zh-TW');
}

export function plainPreview(text: string | null, max = 60): string {
  if (!text) return '';
  const flat = text.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
