import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CharacterSummary } from '@tavern/shared';
import { useCharacters, useDeleteCharacter } from '../api/queries';
import { Avatar } from '../components/common/Avatar';
import { Button, ConfirmDialog, EmptyState, ErrorNote, PageHeader, Spinner } from '../components/common/ui';
import { t } from '../i18n/zh-TW';
import { plainPreview, relativeTime } from '../lib/format';

export function CharactersPage() {
  const characters = useCharacters();
  const remove = useDeleteCharacter();
  const [pending, setPending] = useState<CharacterSummary | null>(null);

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        <PageHeader
          title={t.characters.title}
          lead={t.characters.lead}
          actions={
            <Link to="/characters/new">
              <Button variant="primary">＋ {t.characters.create}</Button>
            </Link>
          }
        />
        <p className="-mt-4 mb-8 text-xs text-muted">{t.characters.importLater}</p>

        {characters.isPending && <Spinner />}
        {characters.error && <ErrorNote message={characters.error.message} onRetry={() => void characters.refetch()} />}
        {characters.data?.length === 0 && <EmptyState title={t.characters.empty} />}

        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {characters.data?.map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-5 py-4">
              <Avatar name={c.name} color={c.avatar_color} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <Link to={`/characters/${c.id}`} className="truncate font-serif text-lg font-semibold hover:text-accent">
                    {c.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{relativeTime(c.updated_at)}</span>
                </div>
                <p className="truncate text-sm text-muted">{plainPreview(c.description.replace(/\{\{char\}\}/gi, c.name), 70)}</p>
              </div>
              <Link to={`/characters/${c.id}`}>
                <Button variant="ghost" className="min-h-10">{t.characters.edit}</Button>
              </Link>
              <Button variant="quiet" className="min-h-10" onClick={() => setPending(c)}>
                {t.common.delete}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        open={pending !== null}
        message={pending ? t.characters.deleteConfirm(pending.name) : ''}
        busy={remove.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && remove.mutate(pending.id, { onSuccess: () => setPending(null) })}
      />
    </div>
  );
}
