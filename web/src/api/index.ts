import { browserApi } from './browser-api';
import { httpApi } from './http-api';
import type { TavernApi } from './types';

// `npm run build:pages` builds with Vite mode "browser" for GitHub Pages, where there is no server.
export const IS_BROWSER = import.meta.env.MODE === 'browser';

export const api: TavernApi = IS_BROWSER ? browserApi : httpApi;

export { ApiRequestError } from './types';
export type { CharacterInput, ProfileInput } from './types';
