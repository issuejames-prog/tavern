import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { t } from '../../i18n/zh-TW';

type Variant = 'primary' | 'ghost' | 'quiet' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover shadow-[0_1px_0_rgb(0_0_0/0.06)]',
  ghost: 'border border-line bg-surface text-ink hover:bg-surface-2',
  quiet: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'border border-line text-danger hover:bg-danger-soft',
};

export function Button({
  variant = 'ghost',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`inline-flex size-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink ${className}`}
    >
      {children}
    </button>
  );
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft';

interface FieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  inputMode?: 'decimal' | 'numeric' | 'text';
}

export function Field({ label, hint, value, onChange, multiline, rows = 4, ...rest }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={rest.placeholder}
          className={`${inputClass} resize-y leading-relaxed`}
        />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} {...rest} />
      )}
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = t.common.loading }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-muted" role="status">
      <span className="size-2 animate-pulse rounded-full bg-accent" />
      {label}
    </div>
  );
}

export function EmptyState({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line px-6 py-12 text-center">
      {icon ?? <MugIcon className="size-10 text-muted/60" />}
      <p className="text-sm text-muted">{title}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button variant="quiet" onClick={onRetry} className="min-h-9 px-3">
          {t.common.retry}
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-wide text-ink">{title}</h1>
        {lead && <p className="mt-2 text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

/** In-page confirmation (avoids blocking native confirm()). Required before destructive actions. */
export function ConfirmDialog({
  open,
  message,
  confirmLabel = t.common.delete,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <p className="leading-relaxed">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export function MugIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M12 18h20v14a7 7 0 0 1-7 7h-6a7 7 0 0 1-7-7z" />
      <path d="M32 22h3a4.5 4.5 0 0 1 0 9h-3" />
      <path d="M17 12c0-2.5 2.5-2.5 2.5-5M24 12c0-2.5 2.5-2.5 2.5-5" />
    </svg>
  );
}
