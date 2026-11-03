import { t } from '../i18n/zh-TW';
import { lastPromptByChat } from './browser-chat';
import { avatarKey, clearBlobs, getBlob, putBlob, STATE_VERSION, upgrade } from './browser-db';
import { fileBytes, forgetAvatarUrl, now, persist, refreshAvatarUrl, replaceState, state } from './browser-store';
import { ready } from './browser-util';
import { ApiRequestError, type TavernApi } from './types';

const BACKUP_FORMAT = 'tavern-backup';

/** Decodes a base64 data URL without fetch() (the page's CSP only allows OpenRouter). */
function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new ApiRequestError('NOT_A_BACKUP', t.transfer.errors.notBackup);
  const bin = atob(match[2]!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export const backupApi: Pick<TavernApi, 'exportBackup' | 'importBackup'> = {
  exportBackup: ready(async () => {
    // Avatars travel as data URLs; the API key is deliberately NOT included (CLAUDE.md §4.6).
    const avatars: Record<string, string> = {};
    for (const c of state.characters.filter((x) => x.has_avatar)) {
      const blob = await getBlob(avatarKey(c.id));
      if (blob) avatars[c.id] = await blobToDataUrl(blob);
    }
    const payload = { format: BACKUP_FORMAT, version: STATE_VERSION, exported_at: now(), state, avatars };
    const date = new Date().toISOString().slice(0, 10);
    return { blob: new Blob([JSON.stringify(payload)], { type: 'application/json' }), fileName: `tavern-backup-${date}.json` };
  }),

  importBackup: ready(async (file: File) => {
    let payload: { format?: string; state?: unknown; avatars?: Record<string, string> };
    try {
      payload = JSON.parse(new TextDecoder().decode(await fileBytes(file)));
    } catch {
      throw new ApiRequestError('BAD_JSON', t.transfer.errors.BAD_JSON);
    }
    // Older backups are upgraded exactly like stored data.
    const next = payload.format === BACKUP_FORMAT ? upgrade(payload.state) : null;
    if (!next || !Array.isArray(next.characters)) throw new ApiRequestError('NOT_A_BACKUP', t.transfer.errors.notBackup);

    for (const c of state.characters) forgetAvatarUrl(c.id);
    await clearBlobs();
    replaceState(next);
    for (const [id, dataUrl] of Object.entries(payload.avatars ?? {})) {
      await putBlob(avatarKey(Number(id)), dataUrlToBlob(dataUrl));
      await refreshAvatarUrl(Number(id));
    }
    lastPromptByChat.clear();
    await persist();
  }),
};
