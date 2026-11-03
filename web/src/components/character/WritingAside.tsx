import { cardTokens, lintCard, type CharacterCardV2Data } from '@tavern/shared';
import { t } from '../../i18n/zh-TW';
import { GuidePanel } from '../common/GuidePanel';

/** Live writing checks + the card-writing guide, shown beside the character editor. */
export function WritingAside({ data, promptBudget }: { data: CharacterCardV2Data; promptBudget: number }) {
  const issues = lintCard(data, promptBudget);
  const tokens = cardTokens(data);
  const L = t.editor.lint;
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-surface p-4" aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-serif text-base font-semibold">{L.title}</h2>
          <span className="text-xs text-muted">
            {t.editor.tokens.permanent(tokens.permanent)} · {t.editor.tokens.temporary(tokens.temporary)}
          </span>
        </div>
        {issues.length === 0 ? (
          <p className="text-sm text-accent">✓ {L.clean}</p>
        ) : (
          <ul className="space-y-2">
            {issues.map((i) => (
              <li
                key={`${i.code}-${i.field}`}
                className={`rounded-md px-3 py-2 text-[13px] leading-relaxed ${i.level === 'warn' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-ink'}`}
              >
                {L[i.code]}
              </li>
            ))}
          </ul>
        )}
      </section>
      <GuidePanel title={t.editor.guide.title} showLabel={t.editor.guide.show} hideLabel={t.editor.guide.hide} sections={t.editor.guide.sections} />
    </div>
  );
}
