import { useState, type ReactNode } from 'react';

/** A quiet, collapsible reference panel shown beside an editor. */
export function GuidePanel({
  title,
  showLabel,
  hideLabel,
  sections,
  children,
  defaultOpen = true,
}: {
  title: string;
  showLabel: string;
  hideLabel: string;
  sections: readonly { title: string; body: string }[];
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <aside className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-serif text-base font-semibold">{title}</h2>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-h-9 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-ink">
          {open ? hideLabel : showLabel}
        </button>
      </div>
      {children}
      {open && (
        <ol className="space-y-4 px-4 py-4">
          {sections.map((s, i) => (
            <li key={s.title}>
              <p className="mb-1 text-sm font-medium">
                <span className="mr-1.5 text-accent">{i + 1}.</span>
                {s.title}
              </p>
              <p className="text-[13px] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
