import { useId } from 'react';
import { estimateTokens } from '@tavern/shared';
import { t } from '../../i18n/zh-TW';

/** A labelled textarea with a permanent/temporary tag, a live token count and an optional template button. */
export function TextBlock({
  label,
  hint,
  value,
  onChange,
  rows = 6,
  persistence,
  template,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  persistence?: 'permanent' | 'temporary';
  template?: string;
  placeholder?: string;
}) {
  const id = useId();
  const T = t.editor.tokens;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {persistence && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${persistence === 'permanent' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'}`}
          >
            {persistence === 'permanent' ? T.permanentTag : T.temporaryTag}
          </span>
        )}
        <span className="text-xs text-muted">{T.field(estimateTokens(value))}</span>
        {template && (
          <button
            type="button"
            onClick={() => onChange(value.trim() ? `${value.replace(/\s+$/, '')}\n${template}` : template)}
            className="ml-auto min-h-8 rounded-md px-2 text-xs text-accent hover:bg-accent-soft"
          >
            ＋ {t.editor.insertTemplate}
          </button>
        )}
      </div>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 leading-relaxed text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
      />
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}
