import { Link, useNavigate } from 'react-router-dom';
import { useCharacters, useChats, useCreateChat, useSettings } from '../api/queries';
import { Avatar } from '../components/common/Avatar';
import { Button, EmptyState, ErrorNote, MugIcon, Spinner } from '../components/common/ui';
import { t } from '../i18n/zh-TW';
import { plainPreview, relativeTime } from '../lib/format';

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return t.home.greeting.morning;
  if (h >= 11 && h < 16) return t.home.greeting.noon;
  if (h >= 16 && h < 21) return t.home.greeting.evening;
  return t.home.greeting.night;
}

export function HomePage() {
  const chats = useChats();
  const characters = useCharacters();
  const settings = useSettings();
  const createChat = useCreateChat();
  const navigate = useNavigate();

  const start = (characterId: number) =>
    createChat.mutate(characterId, { onSuccess: (chat) => navigate(`/chat/${chat.id}`) });

  const userName = settings.data?.settings.user_name;
  const needsKey = settings.data?.profile.key_present === false;

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        <header className="mb-12">
          <h1 className="font-serif text-4xl font-semibold tracking-wide">
            {greeting()}
            {userName ? `，${userName}` : ''}
          </h1>
          <p className="mt-3 text-lg text-muted">{t.home.lead}</p>
        </header>

        {needsKey && (
          <section className="rise mb-12 flex flex-wrap items-center gap-5 rounded-lg border border-accent/40 bg-accent-soft p-6">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface text-accent">
              <MugIcon className="size-8" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-lg font-semibold">{t.browser.welcomeTitle}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t.browser.welcomeBody}</p>
            </div>
            <Link to="/settings">
              <Button variant="primary">{t.browser.goToSettings}</Button>
            </Link>
          </section>
        )}

        {chats.data && chats.data.length > 0 && (
          <section className="mb-14">
            <h2 className="mb-4 text-sm font-medium tracking-widest text-muted">{t.home.continueTitle}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {chats.data.slice(0, 4).map((chat) => (
                <Link
                  key={chat.id}
                  to={`/chat/${chat.id}`}
                  className="group flex gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-accent/50 hover:bg-surface-2/60"
                >
                  <Avatar name={chat.character_name} color={chat.avatar_color} src={chat.avatar_url} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{chat.character_name}</span>
                      <span className="shrink-0 text-xs text-muted">{relativeTime(chat.updated_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{plainPreview(chat.last_message, 80)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-medium tracking-widest text-muted">{t.home.charactersTitle}</h2>
            <Link to="/characters" className="text-sm text-accent hover:underline">
              {t.home.viewAll}
            </Link>
          </div>

          {characters.isPending && <Spinner />}
          {characters.error && <ErrorNote message={characters.error.message} onRetry={() => void characters.refetch()} />}
          {createChat.error && <div className="mb-4"><ErrorNote message={createChat.error.message} /></div>}
          {characters.data?.length === 0 && (
            <EmptyState
              title={t.home.noCharacters}
              action={
                <Link to="/characters/new">
                  <Button variant="primary">{t.home.createFirst}</Button>
                </Link>
              }
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {characters.data?.map((c) => (
              <article key={c.id} className="flex flex-col rounded-lg border border-line bg-surface p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} color={c.avatar_color} src={c.avatar_url} size={48} />
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-lg font-semibold">{c.name}</h3>
                    <p className="truncate text-xs text-muted">{c.tags.join(' · ')}</p>
                  </div>
                </div>
                <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">
                  {plainPreview(c.description.replace(/\{\{char\}\}/gi, c.name), 90)}
                </p>
                <Button
                  variant="ghost"
                  className="mt-5 w-full"
                  disabled={createChat.isPending}
                  onClick={() => start(c.id)}
                >
                  {createChat.isPending && createChat.variables === c.id ? t.home.starting : t.home.startChat}
                </Button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
