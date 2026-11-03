import { demoApi } from './demo-api';
import { httpApi } from './http-api';
import type { TavernApi } from './types';

export const IS_DEMO = import.meta.env.MODE === 'demo';

// The demo build (GitHub Pages) has no server, so it swaps in the local stand-in.
export const api: TavernApi = IS_DEMO ? demoApi : httpApi;

export { ApiRequestError } from './types';
export type { CharacterInput, ProfileInput } from './types';
