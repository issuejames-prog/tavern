import { useEffect, useId, useState } from 'react';
import { estimateTokens, type WorldEntry } from '@tavern/shared';
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
  const L = t.worlds.entry;
  return (
    <div className="space-y-5">
      <Field label={L.comment} hint={L.commentHint} value={entry.comment ?? ''} onChange={(v) => set('comment', v)} />
      <KeysField label={L.keys} hint={L.keysHint} value={entry.keys} onChange={(v) => set('keys', v)} resetKey={entry.id} />
      <KeysField
        label={L.secondaryKeys}
        hint={L.secondaryKeysHint}
        value={entry.secondary_keys ?? []}
        onChange={(v) => set('secondary_keys', v)}
        resetKey={entry.id}
      />
      <div>
        <Field label={L.content} hint={L.contentHint} value={entry.content} onChange={(v) => set('content', v)} multiline rows={8} />
        <p className="mt-1 text-right text-xs text-muted">{L.tokens(estimateTokens(entry.content))}</p>
      </div>

      <div className="grid gap-x-6 sm:grid-cols-2">
        <Toggle label={L.enabled} checked={entry.enabled !== false} onChange={(v) => set('enabled', v)} />
        <Toggle label={L.constant} checked={entry.constant === true} onChange={(v) => set('constant', v)} />
        <Toggle label={L.caseSensitive} checked={entry.case_sensitive === true} onChange={(v) => set('case_sensitive', v)} />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <NumberField label={L.priority} hint={L.priorityHint} value={entry.priority ?? 0} onChange={(n) => set('priority', n)} />
        <NumberField label={L.order} hint={L.orderHint} value={entry.insertion_order} onChange={(n) => set('insertion_order', n)} />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" htmlFor={`pos-${entry.id}`}>{L.position}</label>
          <select
            id={`pos-${entry.id}`}
            value={entry.position === 'before_char' ? 'before_char' : 'after_char'}
            onChange={(e) => set('position', e.target.value as 'before_char' | 'after_char')}
            className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-accent focus:outline-none"
          >
            <option value="before_char">{L.positions.before_char}</option>
            <option value="after_char">{L.positions.after_char}</option>
          </select>
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <Button variant="danger" onClick={onDelete}>{t.worlds.edit.deleteEntry}</Button>
      </div>
    </div>
  );
}
