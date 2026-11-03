import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { WorldBookSummary } from '@tavern/shared';
import { api, downloadFile } from '../api';
import { useCreateWorldBook, useDeleteWorldBook, useImportWorldBook, useWorldBooks } from '../api/queries';
import { DropZone, FileButton, Notice } from '../components/common/files';
import { Button, ConfirmDialog, EmptyState, ErrorNote, PageHeader, Spinner } from '../components/common/ui';
import { t } from '../i18n/zh-TW';
import { relativeTime } from '../lib/format';

function BookIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-10 text-muted/60" aria-hidden>
      <path d="M10 8h20a8 8 0 0 1 8 8v24H18a8 8 0 0 1-8-8zM10 32a8 8 0 0 1 8-8h20" />
    </svg>
  );
}

export function WorldsPage() {
  const worlds = useWorldBooks();
  const create = useCreateWorldBook();
  const importBook = useImportWorldBook();
  const remove = useDeleteWorldBook();
  const navigate = useNavigate();
  const [pending, setPending] = useState<WorldBookSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const onFile = (file: File) => {
    setNotice(null);
    importBook.mutate(file, { onSuccess: (w) => setNotice(t.worlds.imported(w.name)) });
  };

  const exportBook = async (id: number) => {
    setExportError(null);
    try {
      downloadFile(await api.exportWorldBook(id));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <DropZone onFile={onFile} label={t.worlds.dropHere}>
      <div className="scroll-soft h-full overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
          <PageHeader
            title={t.worlds.title}
            lead={t.worlds.lead}
            actions={
              <>
                <FileButton accept=".json,application/json" onFile={onFile} disabled={importBook.isPending}>
                  {importBook.isPending ? t.common.importing : t.common.import}
                </FileButton>
                <Button
                  variant="primary"
                  disabled={create.isPending}
                  onClick={() => create.mutate(t.worlds.newName, { onSuccess: (w) => navigate(`/worlds/${w.id}`) })}
                >
                  ＋ {t.worlds.create}
                </Button>
              </>
            }
          />
          <p className="-mt-4 mb-8 text-xs leading-relaxed text-muted">{t.worlds.importHint}</p>

          {notice && <Notice message={notice} onClose={() => setNotice(null)} />}
          {importBook.error && <div className="mb-6"><ErrorNote message={importBook.error.message} /></div>}
          {exportError && <div className="mb-6"><ErrorNote message={exportError} /></div>}

          {worlds.isPending && <Spinner />}
          {worlds.error && <ErrorNote message={worlds.error.message} onRetry={() => void worlds.refetch()} />}
          {worlds.data?.length === 0 && <EmptyState title={t.worlds.empty} icon={<BookIcon />} />}

          <div className="grid gap-4 sm:grid-cols-2">
            {worlds.data?.map((w) => (
              <article key={w.id} className="flex flex-col rounded-lg border border-line bg-surface p-5">
                <div className="flex items-start gap-3">
                  <Link to={`/worlds/${w.id}`} className="min-w-0 flex-1 truncate font-serif text-lg font-semibold hover:text-accent">
                    {w.name}
                  </Link>
                  {w.global && <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">{t.worlds.global}</span>}
                </div>
                {w.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{w.description}</p>}
                <p className="mt-3 text-xs text-muted">{t.worlds.entries(w.entry_count, w.enabled_count)}</p>
                <p className="mt-1 truncate text-xs text-muted">
                  {w.linked_characters.length ? t.worlds.linked(w.linked_characters) : t.worlds.unlinked} · {relativeTime(w.updated_at)}
                </p>
                <div className="mt-5 flex gap-2">
                  <Link to={`/worlds/${w.id}`} className="flex-1">
                    <Button variant="ghost" className="w-full">{t.characters.edit}</Button>
                  </Link>
                  <Button variant="quiet" onClick={() => void exportBook(w.id)}>{t.common.export}</Button>
                  <Button variant="quiet" onClick={() => setPending(w)}>{t.common.delete}</Button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <ConfirmDialog
          open={pending !== null}
          message={pending ? t.worlds.deleteConfirm(pending.name) : ''}
          busy={remove.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => pending && remove.mutate(pending.id, { onSuccess: () => setPending(null) })}
        />
      </div>
    </DropZone>
  );
}
