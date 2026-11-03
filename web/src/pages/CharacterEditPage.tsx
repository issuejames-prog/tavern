import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { emptyCardData, type CharacterCardV2Data } from '@tavern/shared';
import { api, downloadFile } from '../api';
import { useCharacter, useCreateChat, useSaveCharacter, useSetAvatar, useWorldBooks } from '../api/queries';
import { Avatar, AVATAR_COLORS } from '../components/common/Avatar';
import { FileButton } from '../components/common/files';
import { Button, ErrorNote, Field, Spinner } from '../components/common/ui';
import { t } from '../i18n/zh-TW';

type TextFields =
  | 'name'
  | 'description'
  | 'personality'
  | 'scenario'
  | 'first_mes'
  | 'mes_example'
  | 'system_prompt'
  | 'post_history_instructions'
  | 'creator'
  | 'creator_notes'
  | 'character_version';

type FormState = Pick<CharacterCardV2Data, TextFields> & { tags: string; alternate_greetings: string[] };

function toForm(d: CharacterCardV2Data): FormState {
  return {
    name: d.name,
    description: d.description,
    personality: d.personality,
    scenario: d.scenario,
    first_mes: d.first_mes,
    mes_example: d.mes_example,
    system_prompt: d.system_prompt,
    post_history_instructions: d.post_history_instructions,
    creator: d.creator,
    creator_notes: d.creator_notes,
    character_version: d.character_version,
    tags: d.tags.join(', '),
    alternate_greetings: [...d.alternate_greetings],
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="mb-5 font-serif text-lg font-semibold">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

const selectClass = 'min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-accent focus:outline-none';

export function CharacterEditPage() {
  const param = useParams().id;
  const id = param && param !== 'new' ? Number(param) : null;
  const character = useCharacter(id);
  const worlds = useWorldBooks();
  const save = useSaveCharacter();
  const setAvatar = useSetAvatar();
  const createChat = useCreateChat();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(() => toForm(emptyCardData()));
  const [color, setColor] = useState<string>('sage');
  const [worldId, setWorldId] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [nameError, setNameError] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (character.data) {
      setForm(toForm(character.data.card.data));
      setColor(character.data.avatar_color);
      setWorldId(character.data.world_book_id);
    }
  }, [character.data]);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setGreeting = (i: number, value: string) =>
    setForm((f) => ({ ...f, alternate_greetings: f.alternate_greetings.map((g, j) => (j === i ? value : g)) }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setNameError(true);
    setNameError(false);
    const { tags, alternate_greetings, ...rest } = form;
    save.mutate(
      {
        id,
        input: {
          data: {
            ...rest,
            tags: tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
            alternate_greetings: alternate_greetings.filter((g) => g.trim()),
          },
          avatar_color: color,
          world_book_id: worldId,
        },
      },
      {
        onSuccess: (detail) => {
          setSavedAt(Date.now());
          if (id === null) navigate(`/characters/${detail.id}`, { replace: true });
        },
      },
    );
  };

  const exportAs = async (format: 'png' | 'json') => {
    if (id === null) return;
    setExportError(null);
    try {
      downloadFile(await api.exportCharacter(id, format));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  };

  if (id !== null && character.isPending) return <div className="px-10"><Spinner /></div>;
  if (id !== null && character.error) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <ErrorNote message={character.error.message} onRetry={() => void character.refetch()} />
      </div>
    );
  }

  const avatarUrl = character.data?.avatar_url ?? null;

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 px-6 py-12 md:px-10">
        <Link to="/characters" className="text-sm text-muted hover:text-ink">← {t.characters.title}</Link>
        <header className="flex flex-wrap items-center gap-4">
          <Avatar name={form.name || '?'} color={color} src={avatarUrl} size={64} />
          <h1 className="min-w-0 flex-1 font-serif text-3xl font-semibold tracking-wide">
            {id === null ? t.editor.newTitle : t.editor.editTitle(form.name)}
          </h1>
          {id !== null && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => void exportAs('png')}>{t.characters.exportPng}</Button>
              <Button variant="quiet" onClick={() => void exportAs('json')}>{t.characters.exportJson}</Button>
            </div>
          )}
        </header>
        {id !== null && <p className="-mt-3 text-xs text-muted">{t.editor.unsavedNote}</p>}
        {exportError && <ErrorNote message={exportError} />}

        <Section title={t.editor.sections.basic}>
          <Field label={t.editor.fields.name} value={form.name} onChange={set('name')} />
          {nameError && <p className="-mt-3 text-sm text-danger">{t.editor.nameRequired}</p>}

          {id !== null && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t.editor.fields.avatarImage}</p>
              <div className="flex flex-wrap items-center gap-2">
                <FileButton accept="image/png,image/jpeg,image/webp,image/gif" onFile={(file) => setAvatar.mutate({ id, file })} disabled={setAvatar.isPending}>
                  {t.editor.fields.avatarUpload}
                </FileButton>
                {avatarUrl && (
                  <Button variant="quiet" onClick={() => setAvatar.mutate({ id, file: null })} disabled={setAvatar.isPending}>
                    {t.editor.fields.avatarRemove}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted">{t.editor.fields.avatarHint}</p>
              {setAvatar.error && <ErrorNote message={setAvatar.error.message} />}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">{t.editor.fields.avatarColor}</p>
            <div className="flex gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={`size-11 rounded-full border-2 transition-transform ${color === c ? 'scale-105 border-accent' : 'border-transparent'}`}
                  style={{ background: `var(--avatar-${c})` }}
                />
              ))}
            </div>
          </div>
          <Field label={t.editor.fields.description} hint={t.editor.fields.descriptionHint} value={form.description} onChange={set('description')} multiline rows={5} />
          <Field label={t.editor.fields.tags} hint={t.editor.fields.tagsHint} value={form.tags} onChange={set('tags')} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.editor.fields.creator} value={form.creator} onChange={set('creator')} />
            <Field label={t.editor.fields.version} value={form.character_version} onChange={set('character_version')} />
          </div>
        </Section>

        <Section title={t.editor.sections.persona}>
          <Field label={t.editor.fields.personality} value={form.personality} onChange={set('personality')} multiline rows={3} />
          <Field label={t.editor.fields.scenario} value={form.scenario} onChange={set('scenario')} multiline rows={3} />
        </Section>

        <Section title={t.editor.sections.dialogue}>
          <Field label={t.editor.fields.firstMes} hint={t.editor.fields.firstMesHint} value={form.first_mes} onChange={set('first_mes')} multiline rows={5} />
          <div className="space-y-3">
            <p className="text-sm font-medium">{t.editor.fields.altGreetings}</p>
            {form.alternate_greetings.map((g, i) => (
              <div key={i} className="flex items-start gap-2">
                <textarea
                  value={g}
                  rows={3}
                  onChange={(e) => setGreeting(i, e.target.value)}
                  aria-label={`${t.editor.fields.altGreetings} ${i + 1}`}
                  className="flex-1 resize-y rounded-lg border border-line bg-surface px-3 py-2.5 leading-relaxed text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                />
                <Button
                  variant="quiet"
                  className="min-h-10"
                  onClick={() => setForm((f) => ({ ...f, alternate_greetings: f.alternate_greetings.filter((_, j) => j !== i) }))}
                >
                  {t.editor.fields.altGreetingRemove}
                </Button>
              </div>
            ))}
            <Button variant="quiet" onClick={() => setForm((f) => ({ ...f, alternate_greetings: [...f.alternate_greetings, ''] }))}>
              {t.editor.fields.altGreetingAdd}
            </Button>
            <p className="text-xs leading-relaxed text-muted">{t.editor.fields.altGreetingsHint}</p>
          </div>
          <Field label={t.editor.fields.mesExample} hint={t.editor.fields.mesExampleHint} value={form.mes_example} onChange={set('mes_example')} multiline rows={5} />
        </Section>

        <Section title={t.editor.sections.world}>
          <div className="space-y-1.5">
            <label htmlFor="world" className="block text-sm font-medium">{t.editor.fields.worldBook}</label>
            <select
              id="world"
              value={worldId ?? ''}
              onChange={(e) => setWorldId(e.target.value ? Number(e.target.value) : null)}
              className={selectClass}
            >
              <option value="">{t.common.none}</option>
              {worlds.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.global ? `（${t.worlds.global}）` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-muted">
              {t.editor.fields.worldBookHint}{' '}
              <Link to={worldId ? `/worlds/${worldId}` : '/worlds'} className="text-accent hover:underline">
                {t.editor.fields.worldBookManage} →
              </Link>
            </p>
          </div>
        </Section>

        <Section title={t.editor.sections.advanced}>
          <Field label={t.editor.fields.systemPrompt} hint={t.editor.fields.systemPromptHint} value={form.system_prompt} onChange={set('system_prompt')} multiline rows={3} />
          <Field label={t.editor.fields.postHistory} hint={t.editor.fields.postHistoryHint} value={form.post_history_instructions} onChange={set('post_history_instructions')} multiline rows={3} />
          <Field label={t.editor.fields.creatorNotes} value={form.creator_notes} onChange={set('creator_notes')} multiline rows={2} />
        </Section>

        {save.error && <ErrorNote message={save.error.message} />}

        <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface/95 p-3 backdrop-blur">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? t.common.saving : t.common.save}
          </Button>
          {savedAt && !save.isPending && <span className="text-sm text-accent">{t.common.saved}</span>}
          {id !== null && (
            <Button
              variant="ghost"
              className="ml-auto"
              disabled={createChat.isPending}
              onClick={() => createChat.mutate(id, { onSuccess: (chat) => navigate(`/chat/${chat.id}`) })}
            >
              {t.editor.startChat}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
