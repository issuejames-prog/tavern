import { useState, type FormEvent } from 'react';
import type { ModelProfile } from '@tavern/shared';
import { PROVIDER_KEYS_URL } from '../../api/browser-llm';
import { useUpdateProfile } from '../../api/queries';
import { t } from '../../i18n/zh-TW';
import { Button, ErrorNote, Field } from '../common/ui';

export function SaveRow({ pending, saved, error }: { pending: boolean; saved: boolean; error: Error | null }) {
  return (
    <div className="mt-6 space-y-3">
      {error && <ErrorNote message={error.message} />}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
        {saved && !pending && <span className="text-sm text-accent">{t.common.saved}</span>}
      </div>
    </div>
  );
}

export function KeyStatus({ present }: { present: boolean }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${present ? 'bg-accent-soft text-accent' : 'bg-danger-soft text-danger'}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {present ? t.browser.keySaved : t.browser.keyMissing}
    </p>
  );
}

/** The user's own OpenRouter key, kept only in this browser. */
export function KeyForm({ profile }: { profile: ModelProfile }) {
  const update = useUpdateProfile();
  const [key, setKey] = useState('');
  const [visible, setVisible] = useState(false);
  const save = (value: string) => update.mutate({ api_key: value }, { onSuccess: () => setKey('') });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (key.trim()) save(key);
      }}
      className="space-y-4"
    >
      <KeyStatus present={profile.key_present} />
      <div className="flex gap-2">
        <div className="flex-1">
          <Field
            label={t.browser.keyLabel}
            type={visible ? 'text' : 'password'}
            value={key}
            onChange={setKey}
            placeholder={profile.key_present ? '••••••••••••' : t.browser.keyPlaceholder}
          />
        </div>
        <Button variant="quiet" className="mt-7" onClick={() => setVisible((v) => !v)}>
          {visible ? t.browser.keyHide : t.browser.keyShow}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted">{t.browser.keyHint}</p>
      {update.error && <ErrorNote message={update.error.message} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={update.isPending || !key.trim()}>
          {t.common.save}
        </Button>
        {profile.key_present && (
          <Button variant="danger" onClick={() => save('')}>
            {t.browser.keyClear}
          </Button>
        )}
        <a href={PROVIDER_KEYS_URL} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
          {t.browser.keyGet} ↗
        </a>
      </div>
    </form>
  );
}

export function ModelForm({ profile }: { profile: ModelProfile }) {
  const update = useUpdateProfile();
  const [f, setF] = useState(() => ({
    provider: profile.provider,
    base_url: profile.base_url,
    model: profile.model,
    temperature: String(profile.params.temperature),
    top_p: String(profile.params.top_p),
    max_tokens: String(profile.params.max_tokens),
    context_tokens: String(profile.context_tokens),
  }));
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({
      provider: f.provider,
      base_url: f.base_url,
      model: f.model,
      params: { temperature: Number(f.temperature), top_p: Number(f.top_p), max_tokens: Number(f.max_tokens) },
      context_tokens: Number(f.context_tokens),
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" htmlFor="provider">{t.settings.provider}</label>
          <select
            id="provider"
            value={f.provider}
            onChange={(e) => set('provider')(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-accent focus:outline-none"
          >
            {(Object.keys(t.settings.providers) as ModelProfile['provider'][]).map((p) => (
              <option key={p} value={p}>{t.settings.providers[p]}</option>
            ))}
          </select>
        </div>
        <Field label={t.settings.baseUrl} value={f.base_url} onChange={set('base_url')} />
        <div className="sm:col-span-2">
          <Field label={t.settings.model} hint={t.settings.modelHint} value={f.model} onChange={set('model')} />
        </div>
        <Field label={t.settings.temperature} hint={t.settings.temperatureHint} value={f.temperature} onChange={set('temperature')} inputMode="decimal" />
        <Field label={t.settings.topP} value={f.top_p} onChange={set('top_p')} inputMode="decimal" />
        <Field label={t.settings.maxTokens} value={f.max_tokens} onChange={set('max_tokens')} inputMode="numeric" />
        <Field label={t.settings.contextTokens} hint={t.settings.contextHint} value={f.context_tokens} onChange={set('context_tokens')} inputMode="numeric" />
      </div>
      <SaveRow pending={update.isPending} saved={update.isSuccess} error={update.error} />
    </form>
  );
}
