import { browserApi } from './browser-api';
import type { DownloadFile, TavernApi } from './types';

// The whole app runs in the browser (GitHub Pages); see docs/decisions/2026-11-03-html-only.md.
export const api: TavernApi = browserApi;

/** Saves a file produced by an export call. */
export function downloadFile({ blob, fileName }: DownloadFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { ApiRequestError } from './types';
export type { CharacterInput, ProfileInput } from './types';
