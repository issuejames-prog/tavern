import type { ReactNode } from 'react';
import { useSettings } from '../api/queries';
import { ErrorNote, PageHeader, Spinner } from '../components/common/ui';
import { BackupSection, ProfileSettings, WorldSettingsForm } from '../components/settings/DataForms';
import { KeyForm, ModelForm } from '../components/settings/ModelForms';
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

export function SettingsPage() {
  const settings = useSettings();
  const { theme, setTheme, readingSerif, setReadingSerif } = useUiStore();
  const data = settings.data;

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12 md:px-10">
        <PageHeader title={t.settings.title} lead={t.settings.lead} />
        {settings.isPending && <Spinner />}
        {settings.error && <ErrorNote message={settings.error.message} onRetry={() => void settings.refetch()} />}

        {data && (
          <>
            <Card title={t.settings.sections.key}>
              <KeyForm profile={data.profile} />
            </Card>
            <Card title={t.settings.sections.profile}>
              <ProfileSettings settings={data.settings} />
            </Card>
            <Card title={t.settings.sections.model}>
              <ModelForm profile={data.profile} />
            </Card>
            <Card title={t.settings.sections.world}>
              <WorldSettingsForm settings={data.settings} />
            </Card>
            <Card title={t.settings.sections.usage}>
              <p className="text-muted">{t.settings.usageText(data.usage_today.requests, data.usage_today.limit)}</p>
            </Card>
            <Card title={t.settings.backup.title}>
              <BackupSection />
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
          <p className="mt-6 text-xs leading-relaxed text-muted">{t.browser.dataNote}</p>
        </Card>
      </div>
    </div>
  );
}
