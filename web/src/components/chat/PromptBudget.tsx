import type { PromptInfo } from '@tavern/shared';
import { t } from '../../i18n/zh-TW';

/** Compact budget meter for the chat header; click to see what was sent and what was trimmed. */
export function PromptBudget({ info }: { info: PromptInfo }) {
  const ratio = Math.min(1, info.tokens / Math.max(1, info.budget));
  const lines = t.chat.budgetLines;
  return (
    <details className="group relative">
      <summary
        className={`flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-xs transition-colors hover:bg-surface-2 ${info.over_budget ? 'text-danger' : 'text-muted'}`}
      >
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <span className={`block h-full rounded-full ${info.over_budget ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${ratio * 100}%` }} />
        </span>
        <span>{t.chat.budget(info.tokens, info.budget)}</span>
        {info.world_included.length > 0 && <span className="hidden lg:inline">· {t.chat.budgetWorld(info.world_included.length)}</span>}
      </summary>
      <div className="rise absolute right-0 z-30 mt-2 w-80 rounded-lg border border-line bg-surface p-4 text-sm shadow-[0_12px_40px_-12px_rgb(0_0_0/0.25)]">
        <p className="mb-3 font-medium">{t.chat.budgetTitle}</p>
        <p className="mb-1 text-xs text-muted">{lines.world}</p>
        {info.world_included.length ? (
          <ul className="mb-3 flex flex-wrap gap-1.5">
            {info.world_included.map((label, i) => (
              <li key={`${label}-${i}`} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-ink">
                {label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-xs text-muted">{lines.worldNone}</p>
        )}
        <ul className="space-y-1 text-xs text-muted">
          {info.world_dropped > 0 && <li>· {lines.worldDropped(info.world_dropped)}</li>}
          {info.history_dropped > 0 && <li>· {lines.historyDropped(info.history_dropped)}</li>}
          {!info.examples_included && <li>· {lines.examplesDropped}</li>}
          {info.over_budget && <li className="text-danger">· {lines.overBudget}</li>}
        </ul>
      </div>
    </details>
  );
}
