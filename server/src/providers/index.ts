import type { ModelProfile } from '@tavern/shared';
import { readSecret } from '../config/env';
import { AppError } from '../lib/errors';
import { OpenAICompatibleProvider } from './openai-compatible';
import { createOpenRouterProvider } from './openrouter';
import type { LLMProvider } from './types';

export type { LLMProvider } from './types';
export { ProviderError } from './types';

export function createProvider(profile: ModelProfile): LLMProvider {
  const apiKey = readSecret(profile.key_env);
  if (!apiKey) {
    throw new AppError(
      'MISSING_API_KEY',
      `伺服器沒有設定環境變數 ${profile.key_env}，請在 .env 填入後重新啟動`,
      500,
    );
  }
  switch (profile.provider) {
    case 'openrouter':
      return createOpenRouterProvider({ apiKey, model: profile.model, baseUrl: profile.base_url });
    case 'openai-compatible':
      return new OpenAICompatibleProvider({ apiKey, model: profile.model, baseUrl: profile.base_url });
  }
}
