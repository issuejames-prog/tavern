import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { ModelProfile } from '@tavern/shared';
import { IS_BROWSER } from '../api';
import { useSettings, useUpdateProfile, useUpdateSettings } from '../api/queries';
import { Button, ErrorNote, Field, PageHeader, Spinner } from '../components/common/ui';
import { t } from '../i18n/zh-TW';
import { useUiStore, type ThemeChoice } from '../stores/ui-store';

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="mb-5 font-serif text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SaveRow({ pending, saved, error }: { pending: boolean; saved: boolean; error: Error | null }) {
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

function KeyStatus({ present, label }: { present: boolean; label: string }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${present ? 'bg-accent-soft text-accent' : 'bg-danger-soft text-danger'}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </p>
  );
}

/** Browser mode: the viewer's own OpenRouter key, kept only in this browser. */
function BrowserKeyForm({ profile }: { profile: ModelProfile }) {
  const update = useUpdateProfile();
  const [key, setKey] = useState('');
  const [visible, setVisible] = useState(false);

  const save = (value: string) => update.mutate({ id: profile.id, input: { api_key: value } }, { onSuccess: () => setKey('') });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (key.trim()) save(key);
      }}
      className="space-y-4"
    >
      <KeyStatus present={profile.key_present} label={profile.key_present ? t.browser.keySaved : t.browser.keyMissing} />
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
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
          {t.browser.keyGet} ↗
        </a>
      </div>
    </form>
  );
}

function ProfileForm({ profile }: { profile: ModelProfile }) {
  const update = useUpdateProfile();
  const [f, setF] = useState(() => ({
    provider: profile.provider,
    base_url: profile.base_url,
    model: profile.model,
    key_env: profile.key_env,
    temperature: String(profile.params.temperature),
    top_p: String(profile.params.top_p),
    max_tokens: String(profile.params.max_tokens),
    context_tokens: String(profile.context_tokens),
  }));
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({
      id: profile.id,
      input: {
        provider: f.provider,
        base_url: f.base_url,
        model: f.model,
        key_env: f.key_env,
        params: { temperature: Number(f.temperature), top_p: Number(f.top_p), max_tokens: Number(f.max_tokens) },
        context_tokens: Number(f.context_tokens),
      },
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
        {!IS_BROWSER && (
          <div className="space-y-2 sm:col-span-2">
            <Field label={t.settings.keyEnv} hint={t.settings.keyEnvHint} value={f.key_env} onChange={set('key_env')} />
            <KeyStatus present={profile.key_present} label={profile.key_present ? t.settings.keyPresent : t.settings.keyMissing} />
          </div>
        )}
        <Field label={t.settings.temperature} hint={t.settings.temperatureHint} value={f.temperature} onChange={set('temperature')} inputMode="decimal" />
        <Field label={t.settings.topP} value={f.top_p} onChange={set('top_p')} inputMode="decimal" />
        <Field label={t.settings.maxTokens} value={f.max_tokens} onChange={set('max_tokens')} inputMode="numeric" />
        <Field label={t.settings.contextTokens} hint={t.settings.contextHint} value={f.context_tokens} onChange={set('context_tokens')} inputMode="numeric" />
      </div>
      <SaveRow pending={update.isPending} saved={update.isSuccess} error={update.error} />
    </form>
  );
}

function ProfileSettings({ userName, systemPrompt }: { userName: string; systemPrompt: string }) {
  const update = useUpdateSettings();
  const [name, setName] = useState(userName);
  const [prompt, setPrompt] = useState(systemPrompt);
  useEffect(() => setName(userName), [userName]);
  useEffect(() => setPrompt(systemPrompt), [systemPrompt]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ user_name: name, system_prompt: prompt });
      }}
      className="space-y-5"
    >
      <Field label={t.settings.userName} hint={t.settings.userNameHint} value={name} onChange={setName} />
      <Field label={t.settings.systemPrompt} hint={t.settings.systemPromptHint} value={prompt} onChange={setPrompt} multiline rows={5} />
      <SaveRow pending={update.isPending} saved={update.isSuccess} error={update.error} />
    </form>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  const { theme, setTheme, readingSerif, setReadingSerif } = useUiStore();
  const profile = settings.data?.profiles[0];

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12 md:px-10">
        <PageHeader title={t.settings.title} lead={t.settings.lead} />
        {settings.isPending && <Spinner />}
        {settings.error && <ErrorNote message={settings.error.message} onRetry={() => void settings.refetch()} />}

        {settings.data && (
          <>
            {IS_BROWSER && profile && (
              <Card title={t.browser.keyLabel}>
                <BrowserKeyForm profile={profile} />
              </Card>
            )}
            <Card title={t.settings.sections.profile}>
              <ProfileSettings userName={settings.data.settings.user_name} systemPrompt={settings.data.settings.system_prompt} />
            </Card>
            {profile && (
              <Card title={t.settings.sections.model}>
                <ProfileForm key={profile.id} profile={profile} />
              </Card>
            )}
            <Card title={t.settings.sections.usage}>
              <p className="text-muted">{t.settings.usageText(settings.data.usage_today.requests, settings.data.usage_today.limit)}</p>
              {IS_BROWSER && <p className="mt-3 text-xs leading-relaxed text-muted">{t.browser.dataNote}</p>}
            </Card>
          </>
        )}

        <Card title={t.settings.sections.appearance}>
          <p className="mb-2 text-sm font-medium">{t.settings.theme}</p>
          <div className="inline-flex rounded-lg border border-line bg-bg p-1">
            {(['system', 'light', 'dark'] as ThemeChoice[]).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={theme === choice}
                onClick={() => setTheme(choice)}
                className={`min-h-10 rounded-md px-4 text-sm transition-colors ${theme === choice ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                {t.theme[choice]}
              </button>
            ))}
          </div>
          <label className="mt-6 flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={readingSerif}
              onChange={(e) => setReadingSerif(e.target.checked)}
              className="size-5 accent-[var(--accent)]"
            />
            <span className="text-sm">{t.settings.readingSerif}</span>
          </label>
        </Card>
      </div>
    </div>
  );
}
