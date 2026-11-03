import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { emptyCardData, type CharacterCardV2Data } from '@tavern/shared';
import { useCharacter, useCreateChat, useSaveCharacter } from '../api/queries';
import { Avatar, AVATAR_COLORS } from '../components/common/Avatar';
import { Button, ErrorNote, Field, Spinner } from '../components/common/ui';
import { t } from '../i18n/zh-TW';

type FormState = Pick<
  CharacterCardV2Data,
  'name' | 'description' | 'personality' | 'scenario' | 'first_mes' | 'mes_example' | 'system_prompt' | 'post_history_instructions' | 'creator_notes'
> & { tags: string };

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
    creator_notes: d.creator_notes,
    tags: d.tags.join(', '),
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

export function CharacterEditPage() {
  const param = useParams().id;
  const id = param && param !== 'new' ? Number(param) : null;
  const character = useCharacter(id);
  const save = useSaveCharacter();
  const createChat = useCreateChat();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(() => toForm(emptyCardData()));
  const [color, setColor] = useState<string>('sage');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (character.data) {
      setForm(toForm(character.data.card.data));
      setColor(character.data.avatar_color);
    }
  }, [character.data]);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setNameError(true);
    setNameError(false);
    const { tags, ...rest } = form;
    save.mutate(
      {
        id,
        input: {
          data: { ...rest, tags: tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean) },
          avatar_color: color,
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

  if (id !== null && character.isPending) return <div className="px-10"><Spinner /></div>;
  if (id !== null && character.error) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <ErrorNote message={character.error.message} onRetry={() => void character.refetch()} />
      </div>
    );
  }

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 px-6 py-12 md:px-10">
        <Link to="/characters" className="text-sm text-muted hover:text-ink">← {t.characters.title}</Link>
        <header className="flex items-center gap-4">
          <Avatar name={form.name || '?'} color={color} size={56} />
          <h1 className="font-serif text-3xl font-semibold tracking-wide">
            {id === null ? t.editor.newTitle : t.editor.editTitle(form.name)}
          </h1>
        </header>

        <Section title={t.editor.sections.basic}>
          <Field label={t.editor.fields.name} value={form.name} onChange={set('name')} />
          {nameError && <p className="-mt-3 text-sm text-danger">{t.editor.nameRequired}</p>}
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
        </Section>

        <Section title={t.editor.sections.persona}>
          <Field label={t.editor.fields.personality} value={form.personality} onChange={set('personality')} multiline rows={3} />
          <Field label={t.editor.fields.scenario} value={form.scenario} onChange={set('scenario')} multiline rows={3} />
        </Section>

        <Section title={t.editor.sections.dialogue}>
          <Field label={t.editor.fields.firstMes} hint={t.editor.fields.firstMesHint} value={form.first_mes} onChange={set('first_mes')} multiline rows={5} />
          <Field label={t.editor.fields.mesExample} hint={t.editor.fields.mesExampleHint} value={form.mes_example} onChange={set('mes_example')} multiline rows={5} />
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
