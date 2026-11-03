import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { emptyCardData, readCharacterNote, writeCharacterNote, type CharacterCardV2Data } from '@tavern/shared';
import { api, downloadFile } from '../api';
import { useCharacter, useCreateChat, useSaveCharacter, useSetAvatar, useSettings, useWorldBooks } from '../api/queries';
import { TextBlock } from '../components/character/TextBlock';
import { WritingAside } from '../components/character/WritingAside';
import { Avatar, AVATAR_COLORS } from '../components/common/Avatar';
import { FileButton } from '../components/common/files';
import { Button, ErrorNote, Field, Spinner } from '../components/common/ui';
import { t } from '../i18n/zh-TW';

type TextFields =
  | 'name' | 'description' | 'personality' | 'scenario' | 'first_mes' | 'mes_example'
  | 'system_prompt' | 'post_history_instructions' | 'creator' | 'creator_notes' | 'character_version';

type FormState = Pick<CharacterCardV2Data, TextFields> & { tags: string; alternate_greetings: string[]; note: string; noteDepth: string };

function toForm(d: CharacterCardV2Data): FormState {
  const note = readCharacterNote(d);
  return {
    name: d.name, description: d.description, personality: d.personality, scenario: d.scenario,
    first_mes: d.first_mes, mes_example: d.mes_example, system_prompt: d.system_prompt,
    post_history_instructions: d.post_history_instructions, creator: d.creator, creator_notes: d.creator_notes,
    character_version: d.character_version, tags: d.tags.join(', '), alternate_greetings: [...d.alternate_greetings],
    note: note.prompt, noteDepth: String(note.depth),
  };
}

/** The form merged onto the stored card, so unknown fields and extensions survive. */
function toCardData(base: CharacterCardV2Data, f: FormState): CharacterCardV2Data {
  const { tags, alternate_greetings, note, noteDepth, ...rest } = f;
  const data = { ...base, ...rest, tags: tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean), alternate_greetings };
  const depth = Number(noteDepth);
  return { ...data, extensions: writeCharacterNote(data, { prompt: note, depth: Number.isFinite(depth) ? depth : 4 }) };
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Collapsible({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="cursor-pointer list-none px-6 py-4 font-serif text-lg font-semibold">
        <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="space-y-5 border-t border-line p-6">
        {hint && <p className="-mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
        {children}
      </div>
    </details>
  );
}

const selectClass = 'min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-accent focus:outline-none';

export function CharacterEditPage() {
  const param = useParams().id;
  const id = param && param !== 'new' ? Number(param) : null;
  const character = useCharacter(id);
  const worlds = useWorldBooks();
  const settings = useSettings();
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

  const base = character.data?.card.data ?? emptyCardData();
  const liveData = useMemo(() => toCardData(base, form), [base, form]);
  const profile = settings.data?.profile;
  const promptBudget = profile ? profile.context_tokens - profile.params.max_tokens : 0;

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setGreeting = (i: number, value: string) =>
    setForm((f) => ({ ...f, alternate_greetings: f.alternate_greetings.map((g, j) => (j === i ? value : g)) }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setNameError(true);
    setNameError(false);
    const data = { ...liveData, alternate_greetings: liveData.alternate_greetings.filter((g) => g.trim()) };
    save.mutate(
      { id, input: { data, avatar_color: color, world_book_id: worldId } },
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

  const F = t.editor.fields;
  const S = t.editor.sections;
  const avatarUrl = character.data?.avatar_url ?? null;

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:px-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} className="min-w-0 space-y-6">
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

          <Section title={S.basic}>
            <Field label={F.name} hint={F.nameHint} value={form.name} onChange={set('name')} />
            {nameError && <p className="-mt-3 text-sm text-danger">{t.editor.nameRequired}</p>}
            {id !== null && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{F.avatarImage}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <FileButton accept="image/png,image/jpeg,image/webp,image/gif" onFile={(file) => setAvatar.mutate({ id, file })} disabled={setAvatar.isPending}>
                    {F.avatarUpload}
                  </FileButton>
                  {avatarUrl && (
                    <Button variant="quiet" onClick={() => setAvatar.mutate({ id, file: null })} disabled={setAvatar.isPending}>
                      {F.avatarRemove}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted">{F.avatarHint}</p>
                {setAvatar.error && <ErrorNote message={setAvatar.error.message} />}
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">{F.avatarColor}</p>
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
            <Field label={F.tags} hint={F.tagsHint} value={form.tags} onChange={set('tags')} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={F.creator} value={form.creator} onChange={set('creator')} />
              <Field label={F.version} value={form.character_version} onChange={set('character_version')} />
            </div>
          </Section>

          <Section title={S.description}>
            <TextBlock label={F.description} hint={F.descriptionHint} value={form.description} onChange={set('description')} rows={12} persistence="permanent" template={t.editor.templates.aliChat} />
          </Section>

          <Section title={S.note}>
            <TextBlock label={F.characterNote} hint={F.characterNoteHint} value={form.note} onChange={set('note')} rows={5} persistence="permanent" template={t.editor.templates.plist} placeholder={t.editor.templates.plist} />
            <div className="max-w-48">
              <Field label={F.characterNoteDepth} hint={F.characterNoteDepthHint} value={form.noteDepth} onChange={set('noteDepth')} inputMode="numeric" />
            </div>
          </Section>

          <Section title={S.greeting}>
            <TextBlock label={F.firstMes} hint={F.firstMesHint} value={form.first_mes} onChange={set('first_mes')} rows={8} persistence="temporary" />
            <div className="space-y-3">
              <p className="text-sm font-medium">{F.altGreetings}</p>
              {form.alternate_greetings.map((g, i) => (
                <div key={i} className="flex items-start gap-2">
                  <textarea
                    value={g}
                    rows={3}
                    onChange={(e) => setGreeting(i, e.target.value)}
                    aria-label={`${F.altGreetings} ${i + 1}`}
                    className="flex-1 resize-y rounded-lg border border-line bg-surface px-3 py-2.5 leading-relaxed text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                  />
                  <Button variant="quiet" className="min-h-10" onClick={() => setForm((f) => ({ ...f, alternate_greetings: f.alternate_greetings.filter((_, j) => j !== i) }))}>
                    {F.altGreetingRemove}
                  </Button>
                </div>
              ))}
              <Button variant="quiet" onClick={() => setForm((f) => ({ ...f, alternate_greetings: [...f.alternate_greetings, ''] }))}>
                {F.altGreetingAdd}
              </Button>
              <p className="text-xs leading-relaxed text-muted">{F.altGreetingsHint}</p>
            </div>
          </Section>

          <Section title={S.world}>
            <div className="space-y-1.5">
              <label htmlFor="world" className="block text-sm font-medium">{F.worldBook}</label>
              <select id="world" value={worldId ?? ''} onChange={(e) => setWorldId(e.target.value ? Number(e.target.value) : null)} className={selectClass}>
                <option value="">{t.common.none}</option>
                {worlds.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.global ? `（${t.worlds.global}）` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-relaxed text-muted">
                {F.worldBookHint}{' '}
                <Link to={worldId ? `/worlds/${worldId}` : '/worlds'} className="text-accent hover:underline">{F.worldBookManage} →</Link>
              </p>
            </div>
          </Section>

          <Collapsible title={S.more} hint={F.moreHint}>
            <TextBlock label={F.personality} value={form.personality} onChange={set('personality')} rows={2} persistence="permanent" />
            <TextBlock label={F.scenario} value={form.scenario} onChange={set('scenario')} rows={2} persistence="permanent" />
            <TextBlock label={F.mesExample} hint={F.mesExampleHint} value={form.mes_example} onChange={set('mes_example')} rows={5} persistence="temporary" />
          </Collapsible>

          <Collapsible title={S.advanced}>
            <TextBlock label={F.systemPrompt} hint={F.systemPromptHint} value={form.system_prompt} onChange={set('system_prompt')} rows={3} />
            <TextBlock label={F.postHistory} hint={F.postHistoryHint} value={form.post_history_instructions} onChange={set('post_history_instructions')} rows={3} />
            <TextBlock label={F.creatorNotes} value={form.creator_notes} onChange={set('creator_notes')} rows={3} />
          </Collapsible>

          {save.error && <ErrorNote message={save.error.message} />}

          <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface/95 p-3 backdrop-blur">
            <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? t.common.saving : t.common.save}</Button>
            {savedAt && !save.isPending && <span className="text-sm text-accent">{t.common.saved}</span>}
            {id !== null && (
              <Button variant="ghost" className="ml-auto" disabled={createChat.isPending} onClick={() => createChat.mutate(id, { onSuccess: (chat) => navigate(`/chat/${chat.id}`) })}>
                {t.editor.startChat}
              </Button>
            )}
          </div>
        </form>

        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto scroll-soft">
          <WritingAside data={liveData} promptBudget={promptBudget} />
        </div>
      </div>
    </div>
  );
}
