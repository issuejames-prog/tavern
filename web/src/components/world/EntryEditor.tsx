import { useEffect, useId, useState, type ReactNode } from 'react';
import { ENTRY_POSITIONS, estimateTokens, readEntry, writeEntry, type EntryOptions, type EntryStatus, type SelectiveLogic, type WorldEntry } from '@tavern/shared';
import { t } from '../../i18n/zh-TW';
import { Button, Field } from '../common/ui';

const splitKeys = (text: string) =>
  text
    .split(/[,，\n]/)
    .map((k) => k.trim())
    .filter(Boolean);

/** Comma-separated keyword input that keeps the raw text while typing (so trailing commas don't vanish). */
function KeysField({ label, hint, value, onChange, resetKey }: { label: string; hint: string; value: string[]; onChange: (keys: string[]) => void; resetKey: number }) {
  const [text, setText] = useState(value.join(', '));
  // Re-sync only when switching to another entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setText(value.join(', ')), [resetKey]);
  return (
    <Field
      label={label}
      hint={hint}
      value={text}
      onChange={(v) => {
        setText(v);
        onChange(splitKeys(v));
      }}
    />
  );
}

function NumberField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (n: number) => void }) {
  return (
    <Field
      label={label}
      hint={hint}
      value={String(value)}
      inputMode="numeric"
      onChange={(v) => {
        const n = Number(v);
        if (v.trim() === '' || Number.isFinite(n)) onChange(v.trim() === '' ? 0 : n);
      }}
    />
  );
}

function Select({ label, hint, value, onChange, children }: { label: string; hint?: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-accent focus:outline-none"
      >
        {children}
      </select>
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

export function EntryEditor({ entry, onChange, onDelete }: { entry: WorldEntry; onChange: (e: WorldEntry) => void; onDelete: () => void }) {
  const set = <K extends keyof WorldEntry>(key: K, value: WorldEntry[K]) => onChange({ ...entry, [key]: value });
  const setOpt = (patch: Partial<EntryOptions>) => onChange(writeEntry(entry, patch));
  const o = readEntry(entry);
  const L = t.worlds.entry;
  const hasSecondary = (entry.secondary_keys ?? []).length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={L.comment} hint={L.commentHint} value={entry.comment ?? ''} onChange={(v) => set('comment', v)} />
        <Select label={L.status} value={o.status} onChange={(v) => setOpt({ status: v as EntryStatus })}>
          {(Object.keys(L.statuses) as EntryStatus[]).map((s) => (
            <option key={s} value={s}>{L.statuses[s]}</option>
          ))}
        </Select>
      </div>

      <KeysField label={L.keys} hint={L.keysHint} value={entry.keys} onChange={(v) => set('keys', v)} resetKey={entry.id} />

      <div className="grid gap-5 sm:grid-cols-2">
        <KeysField label={L.secondaryKeys} hint={L.secondaryKeysHint} value={entry.secondary_keys ?? []} onChange={(v) => set('secondary_keys', v)} resetKey={entry.id} />
        <Select label={L.logic} value={String(o.logic)} onChange={(v) => setOpt({ logic: Number(v) as SelectiveLogic })}>
          {[0, 3, 2, 1].map((n) => (
            <option key={n} value={n} disabled={!hasSecondary && n !== o.logic}>{L.logics[n]}</option>
          ))}
        </Select>
      </div>

      <div>
        <Field label={L.content} hint={L.contentHint} value={entry.content} onChange={(v) => set('content', v)} multiline rows={8} />
        <p className="mt-1 text-right text-xs text-muted">{L.tokens(estimateTokens(entry.content))}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_120px]">
        <Select label={L.position} hint={L.positionHint} value={o.position} onChange={(v) => setOpt({ position: v as EntryOptions['position'] })}>
          {ENTRY_POSITIONS.map((p) => (
            <option key={p} value={p}>{L.positions[p]}</option>
          ))}
        </Select>
        {o.position === 'at_depth' && <NumberField label={L.depth} hint={L.depthHint} value={o.depth} onChange={(n) => setOpt({ depth: Math.max(0, Math.round(n)) })} />}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={L.order} hint={L.orderHint} value={entry.insertion_order} onChange={(n) => set('insertion_order', n)} />
        <NumberField label={L.probability} hint={L.probabilityHint} value={o.probability} onChange={(n) => setOpt({ probability: Math.min(100, Math.max(0, Math.round(n))) })} />
      </div>

      <div className="space-y-1 rounded-lg border border-line p-4">
        <Toggle label={L.caseSensitive} checked={entry.case_sensitive === true} onChange={(v) => set('case_sensitive', v)} />
        <Toggle label={L.excludeRecursion} checked={o.excludeRecursion} onChange={(v) => setOpt({ excludeRecursion: v })} />
        <Toggle label={L.preventRecursion} checked={o.preventRecursion} onChange={(v) => setOpt({ preventRecursion: v })} />
        <p className="pt-1 text-xs leading-relaxed text-muted">{L.recursionHint}</p>
      </div>

      <div className="border-t border-line pt-4">
        <Button variant="danger" onClick={onDelete}>{t.worlds.edit.deleteEntry}</Button>
      </div>
    </div>
  );
}
