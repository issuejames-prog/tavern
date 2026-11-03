import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { t } from '../../i18n/zh-TW';
import { Button } from './ui';

/** A button that opens the file chooser. */
export function FileButton({
  accept,
  onFile,
  children,
  variant = 'ghost',
  disabled,
}: {
  accept: string;
  onFile: (file: File) => void;
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger';
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // allow picking the same file again
          if (file) onFile(file);
        }}
      />
    </>
  );
}

/** Wraps a page so files can be dropped anywhere on it. */
export function DropZone({ onFile, label, children }: { onFile: (file: File) => void; label: string; children: ReactNode }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    <div
      className="relative h-full"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        depth.current += 1;
        setOver(true);
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent-soft backdrop-blur-[1px]">
          <p className="rounded-lg bg-surface px-5 py-3 font-medium text-ink">{label}</p>
        </div>
      )}
    </div>
  );
}

/** A dismissible success line shown after imports and saves. */
export function Notice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="rise mb-6 flex items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-ink" role="status">
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onClose} className="rounded px-2 text-muted hover:text-ink" aria-label={t.common.cancel}>
        ✕
      </button>
    </div>
  );
}
