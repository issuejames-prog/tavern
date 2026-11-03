import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { emptyEntry, ENTRY_POSITIONS, entryLabel, readEntry, type WorldBook, type WorldEntry } from '@tavern/shared';
import { useSaveWorldBook, useWorldBook } from '../api/queries';
import { GuidePanel } from '../components/common/GuidePanel';
import { Button, ConfirmDialog, ErrorNote, Field, Spinner } from '../components/common/ui';
import { EntryEditor } from '../components/world/EntryEditor';
import { t } from '../i18n/zh-TW';

/** Prompt order: position first (weak → strong), then insertion order (small → large). */
const promptOrder = (a: WorldEntry, b: WorldEntry) =>
  ENTRY_POSITIONS.indexOf(readEntry(a).position) - ENTRY_POSITIONS.indexOf(readEntry(b).position) ||
  a.insertion_order - b.insertion_order ||
  a.id - b.id;

function EntryTags({ e }: { e: WorldEntry }) {
  const o = readEntry(e);
  const L = t.worlds.entry;
  const tag = 'shrink-0 rounded bg-surface-2 px-1.5 text-[11px] text-muted';
  return (
    <>
      <span className={tag}>
        {L.positionTags[o.position]}
        {o.position === 'at_depth' ? o.depth : ''}·{e.insertion_order}
      </span>
      {o.status === 'constant' && <span className={tag}>{L.constantTag}</span>}
      {o.status === 'disabled' && <span className={tag}>{L.disabledTag}</span>}
      {o.probability < 100 && <span className={tag}>{L.probabilityTag(o.probability)}</span>}
    </>
  );
}

export function WorldEditPage() {
  const id = Number(useParams().id);
  const book = useWorldBook(id);
  const save = useSaveWorldBook();
  const [draft, setDraft] = useState<WorldBook | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<WorldEntry | null>(null);

  useEffect(() => {
    if (book.data && !dirty) {
      setDraft(book.data);
      setSelected((cur) => cur ?? [...book.data.entries].sort(promptOrder)[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.data]);

  const update = (next: WorldBook) => {
    setDraft(next);
    setDirty(true);
  };

  const filtered = useMemo(() => {
    if (!draft) return [];
    const q = query.trim().toLowerCase();
    const list = [...draft.entries].sort(promptOrder);
    if (!q) return list;
    return list.filter((e) => [entryLabel(e), ...e.keys, e.content].some((s) => s.toLowerCase().includes(q)));
  }, [draft, query]);

  if (book.isPending) return <div className="px-10"><Spinner /></div>;
  if (book.error || !draft) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <ErrorNote message={book.error?.message ?? t.common.loadError} onRetry={() => void book.refetch()} />
      </div>
    );
  }

  const E = t.worlds.edit;
  const current = draft.entries.find((e) => e.id === selected) ?? null;

  const addEntry = () => {
    const nextId = Math.max(0, ...draft.entries.map((e) => e.id)) + 1;
    update({ ...draft, entries: [...draft.entries, emptyEntry(nextId)] });
    setSelected(nextId);
    setQuery('');
  };

  const changeEntry = (entry: WorldEntry) => update({ ...draft, entries: draft.entries.map((e) => (e.id === entry.id ? entry : e)) });

  const submit = () =>
    save.mutate(draft, {
      onSuccess: (saved) => {
        setDraft(saved);
        setDirty(false);
      },
    });

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-bg/80 px-6 py-3 backdrop-blur md:px-8">
        <Link to="/worlds" className="text-sm text-muted hover:text-ink">{E.back}</Link>
        <h1 className="min-w-0 flex-1 truncate font-serif text-xl font-semibold">{draft.name || t.worlds.newName}</h1>
        {dirty && <span className="text-xs text-danger">{E.unsaved}</span>}
        {!dirty && save.isSuccess && <span className="text-xs text-accent">{t.common.saved}</span>}
        <Button variant="primary" onClick={submit} disabled={!dirty || save.isPending}>
          {save.isPending ? t.common.saving : t.common.save}
        </Button>
      </header>
      {save.error && <div className="px-6 pt-4 md:px-8"><ErrorNote message={save.error.message} /></div>}

      <div className="grid min-h-0 flex-1 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        {/* Left: book settings + entries in prompt order */}
        <aside className="scroll-soft min-h-0 overflow-y-auto border-b border-line p-5 md:border-b-0 md:border-r">
          <details className="mb-5 rounded-lg border border-line bg-surface" open={draft.entries.length === 0}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{E.settings}</summary>
            <div className="space-y-4 border-t border-line p-4">
              <Field label={E.name} value={draft.name} onChange={(v) => update({ ...draft, name: v })} />
              <Field label={E.description} value={draft.description} onChange={(v) => update({ ...draft, description: v })} multiline rows={3} />
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={draft.global} onChange={(e) => update({ ...draft, global: e.target.checked })} className="mt-0.5 size-5 accent-[var(--accent)]" />
                <span>
                  {E.globalLabel}
                  <span className="mt-1 block text-xs leading-relaxed text-muted">{E.globalHint}</span>
                </span>
              </label>
              <p className="text-xs leading-relaxed text-muted">
                {t.worlds.activationLink}{' '}
                <Link to="/settings" className="text-accent hover:underline">{t.nav.settings} →</Link>
              </p>
            </div>
          </details>

          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium tracking-widest text-muted">{E.entriesTitle}（{draft.entries.length}）</h2>
            <Button variant="quiet" className="min-h-9 px-3" onClick={addEntry}>{E.addEntry}</Button>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted">{E.sortHint}</p>
          {draft.entries.length > 3 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={E.search}
              aria-label={E.search}
              className="mb-3 min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
          )}
          {draft.entries.length === 0 && <p className="text-sm text-muted">{E.noEntries}</p>}
          <ul className="space-y-1">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelected(e.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${e.id === selected ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
                >
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${e.enabled === false ? 'text-muted' : ''}`}>
                    <span className={`min-w-0 flex-1 truncate ${e.enabled === false ? 'line-through' : ''}`}>{entryLabel(e)}</span>
                    <EntryTags e={e} />
                  </span>
                  <span className="block truncate text-xs text-muted">{e.keys.join(', ') || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Middle: the selected entry */}
        <section className="scroll-soft min-h-0 overflow-y-auto p-6 md:p-8">
          {current ? (
            <div className="mx-auto max-w-2xl">
              <EntryEditor key={current.id} entry={current} onChange={changeEntry} onDelete={() => setPendingDelete(current)} />
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted">{draft.entries.length ? E.selectEntry : E.noEntries}</p>
          )}
        </section>

        {/* Right: the guide (below the editor on narrower screens) */}
        <div className="scroll-soft min-h-0 overflow-y-auto border-t border-line p-5 md:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
          <GuidePanel title={t.worlds.guide.title} showLabel={t.worlds.guide.show} hideLabel={t.worlds.guide.hide} sections={t.worlds.guide.sections} />
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        message={pendingDelete ? E.deleteEntryConfirm(entryLabel(pendingDelete)) : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          update({ ...draft, entries: draft.entries.filter((e) => e.id !== pendingDelete.id) });
          setSelected(null);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
