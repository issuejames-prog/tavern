import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../../i18n/zh-TW';
import { Button } from '../common/ui';

interface Props {
  streaming: boolean;
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
}

export function ChatComposer({ streaming, onSend, onStop }: Props) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with content up to ~8 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const submit = async () => {
    const content = text.trim();
    if (!content || streaming) return;
    setText('');
    const accepted = await onSend(content);
    // If the server never saved it, give the text back so nothing is lost.
    if (!accepted) setText((cur) => cur || content);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-lg border border-line bg-surface p-2 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] focus-within:border-accent">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t.chat.placeholder}
        className="max-h-[220px] min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 leading-relaxed text-ink placeholder:text-muted/70 focus:outline-none"
        aria-label={t.chat.placeholder}
      />
      {streaming ? (
        <Button variant="ghost" onClick={onStop}>
          <span className="size-2.5 rounded-[2px] bg-current" aria-hidden />
          {t.chat.stop}
        </Button>
      ) : (
        <Button variant="primary" onClick={() => void submit()} disabled={!text.trim()}>
          {t.chat.send}
        </Button>
      )}
    </div>
  );
}
