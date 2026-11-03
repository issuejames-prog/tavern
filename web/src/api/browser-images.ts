// Canvas helpers for avatars: every exported card must be a PNG, but avatars
// may be JPEG/WebP or missing entirely.

const CARD_WIDTH = 400;
const CARD_HEIGHT = 600;
export const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG_ENCODE_FAILED'))), 'image/png'),
  );
}

/** Converts any browser-readable image to PNG (no-op for PNGs). */
export async function toPng(image: Blob): Promise<Blob> {
  if (image.type === 'image/png') return image;
  const bitmap = await createImageBitmap(image);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToPng(canvas);
}

/** A plain portrait card (avatar colour + initial) for characters without an image. */
export async function placeholderPng(name: string, colorName: string): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  const bg = css.getPropertyValue(`--avatar-${colorName}`).trim() || '#b5c7ab';
  const ink = css.getPropertyValue('--avatar-ink').trim() || '#3a352e';
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 200px ${css.getPropertyValue('--font-reading') || 'serif'}`;
  ctx.fillText(Array.from(name.trim())[0] ?? '?', CARD_WIDTH / 2, CARD_HEIGHT / 2);
  return canvasToPng(canvas);
}

export function isImage(file: Blob): boolean {
  return /^image\/(png|jpeg|webp|gif)$/.test(file.type);
}
