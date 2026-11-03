export const AVATAR_COLORS = ['sage', 'clay', 'sky', 'sand', 'plum'] as const;

export function Avatar({ name, color, src, size = 40 }: { name: string; color: string; src?: string | null; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="shrink-0 rounded-full border border-line object-cover object-top"
        style={{ width: size, height: size }}
      />
    );
  }
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
