export const AVATAR_COLORS = ['sage', 'clay', 'sky', 'sand', 'plum'] as const;

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const safe = (AVATAR_COLORS as readonly string[]).includes(color) ? color : 'sage';
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-serif font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `var(--avatar-${safe})`,
        color: 'var(--avatar-ink)',
      }}
    >
      {Array.from(name.trim())[0] ?? '?'}
    </span>
  );
}
