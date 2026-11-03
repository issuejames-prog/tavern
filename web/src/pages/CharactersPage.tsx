import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CharacterSummary } from '@tavern/shared';
import { api, downloadFile } from '../api';
import { useCharacters, useDeleteCharacter, useImportCharacter, useWorldBooks } from '../api/queries';
import { Avatar } from '../components/common/Avatar';
import { DropZone, FileButton, Notice } from '../components/common/files';
import { Button, ConfirmDialog, EmptyState, ErrorNote, PageHeader, Spinner } from '../components/common/ui';
import { t } from '../i18n/zh-TW';
import { plainPreview, relativeTime } from '../lib/format';

const CARD_FILES = '.png,.json,image/png,application/json';

export function CharactersPage() {
  const characters = useCharacters();
  const worlds = useWorldBooks();
  const remove = useDeleteCharacter();
  const importCard = useImportCharacter();
  const [pending, setPending] = useState<CharacterSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const worldName = (id: number | null) => worlds.data?.find((w) => w.id === id)?.name;

  const onFile = (file: File) => {
    setNotice(null);
    importCard.mutate(file, {
      onSuccess: ({ character, world }) =>
        setNotice(world ? t.characters.importedWithWorld(character.name, world.name) : t.characters.imported(character.name)),
    });
  };

  const exportAs = async (id: number, format: 'png' | 'json') => {
    setExportError(null);
    try {
      downloadFile(await api.exportCharacter(id, format));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <DropZone onFile={onFile} label={t.characters.dropHere}>
      <div className="scroll-soft h-full overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
          <PageHeader
            title={t.characters.title}
            lead={t.characters.lead}
            actions={
              <>
                <FileButton accept={CARD_FILES} onFile={onFile} disabled={importCard.isPending}>
                  {importCard.isPending ? t.common.importing : t.common.import}
                </FileButton>
                <Link to="/characters/new">
                  <Button variant="primary">＋ {t.characters.create}</Button>
                </Link>
              </>
            }
          />
          <p className="-mt-4 mb-8 text-xs leading-relaxed text-muted">{t.characters.importHint}</p>

          {notice && <Notice message={notice} onClose={() => setNotice(null)} />}
          {importCard.error && <div className="mb-6"><ErrorNote message={importCard.error.message} /></div>}
          {exportError && <div className="mb-6"><ErrorNote message={exportError} /></div>}

          {characters.isPending && <Spinner />}
          {characters.error && <ErrorNote message={characters.error.message} onRetry={() => void characters.refetch()} />}
          {characters.data?.length === 0 && <EmptyState title={t.characters.empty} />}

          {!!characters.data?.length && (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {characters.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <Avatar name={c.name} color={c.avatar_color} src={c.avatar_url} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <Link to={`/characters/${c.id}`} className="truncate font-serif text-lg font-semibold hover:text-accent">
                        {c.name}
                      </Link>
                      <span className="shrink-0 text-xs text-muted">{relativeTime(c.updated_at)}</span>
                    </div>
                    <p className="truncate text-sm text-muted">{plainPreview(c.description.replace(/\{\{char\}\}/gi, c.name), 70)}</p>
                    {worldName(c.world_book_id) && (
                      <p className="mt-1 text-xs text-accent">{t.characters.linkedWorld(worldName(c.world_book_id)!)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Link to={`/characters/${c.id}`}>
                      <Button variant="ghost" className="min-h-10">{t.characters.edit}</Button>
                    </Link>
                    <details className="relative">
                      <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-ink">
                        {t.common.export} ▾
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_12px_30px_-12px_rgb(0_0_0/0.25)]">
                        <button type="button" className="block w-full px-4 py-2.5 text-left text-sm hover:bg-surface-2" onClick={() => void exportAs(c.id, 'png')}>
                          {t.characters.exportPng}
                        </button>
                        <button type="button" className="block w-full px-4 py-2.5 text-left text-sm hover:bg-surface-2" onClick={() => void exportAs(c.id, 'json')}>
                          {t.characters.exportJson}
                        </button>
                      </div>
                    </details>
                    <Button variant="quiet" className="min-h-10" onClick={() => setPending(c)}>
                      {t.common.delete}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ConfirmDialog
          open={pending !== null}
          message={pending ? t.characters.deleteConfirm(pending.name) : ''}
          busy={remove.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => pending && remove.mutate(pending.id, { onSuccess: () => setPending(null) })}
        />
      </div>
    </DropZone>
  );
}
