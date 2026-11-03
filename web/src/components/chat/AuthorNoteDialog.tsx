import { useEffect, useRef, useState } from 'react';
import type { AuthorNote } from '@tavern/shared';
import { useUpdateAuthorNote } from '../../api/queries';
import { t } from '../../i18n/zh-TW';
import { Button, ErrorNote, Field } from '../common/ui';

/** Edits this chat's author's note (inserted N messages from the bottom). */
export function AuthorNoteDialog({ chatId, note, open, onClose }: { chatId: number; note: AuthorNote; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const update = useUpdateAuthorNote(chatId);
  const [content, setContent] = useState(note.content);
  const [depth, setDepth] = useState(String(note.depth));
  const [frequency, setFrequency] = useState(String(note.frequency));
  const A = t.chat.authorNote;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setContent(note.content);
      setDepth(String(note.depth));
      setFrequency(String(note.frequency));
      update.reset();
      d.showModal();
    }
    if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/30 backdrop:backdrop-blur-[2px]"
    >
      <form
        className="space-y-5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ content, depth: Number(depth), frequency: Number(frequency) }, { onSuccess: onClose });
        }}
      >
        <div>
          <h2 className="font-serif text-lg font-semibold">{A.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{A.lead}</p>
        </div>
        <Field label={A.content} value={content} onChange={setContent} multiline rows={5} placeholder={A.contentPlaceholder} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={A.depth} hint={A.depthHint} value={depth} onChange={setDepth} inputMode="numeric" />
          <Field label={A.frequency} hint={A.frequencyHint} value={frequency} onChange={setFrequency} inputMode="numeric" />
        </div>
        {update.error && <ErrorNote message={update.error.message} />}
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" variant="primary" disabled={update.isPending}>{t.common.save}</Button>
        </div>
      </form>
    </dialog>
  );
}
