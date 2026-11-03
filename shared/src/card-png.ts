// Character cards inside PNG files (SillyTavern format).
// A card is stored in a tEXt chunk: keyword "chara" (V2) or "ccv3" (V3),
// value = base64 of the UTF-8 JSON. No dependencies, works in browsers and Node.

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CARD_KEYWORDS = ['ccv3', 'chara'] as const; // preference order when reading

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && SIGNATURE.every((b, i) => bytes[i] === b);
}

interface Chunk {
  type: string;
  data: Uint8Array;
}

function readU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}

function writeU32(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

function chunks(bytes: Uint8Array): Chunk[] {
  if (!isPng(bytes)) throw new Error('NOT_PNG');
  const out: Chunk[] = [];
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const length = readU32(bytes, pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const end = pos + 12 + length;
    if (end > bytes.length) throw new Error('CORRUPT_PNG');
    out.push({ type, data: bytes.subarray(pos + 8, pos + 8 + length) });
    pos = end;
    if (type === 'IEND') break;
  }
  return out;
}

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([...type].map((c) => c.charCodeAt(0)));
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes);
  body.set(data, typeBytes.length);
  return concat([writeU32(data.length), body, writeU32(crc32(body))]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** tEXt payload: latin-1 keyword, NUL, latin-1 text. */
function parseText(data: Uint8Array): { keyword: string; text: string } | null {
  const nul = data.indexOf(0);
  if (nul < 1) return null;
  return {
    keyword: String.fromCharCode(...data.subarray(0, nul)),
    text: latin1(data.subarray(nul + 1)),
  };
}

function latin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
}

export function utf8ToBase64(text: string): string {
  return btoa(latin1(new TextEncoder().encode(text)));
}

export function base64ToUtf8(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Returns the raw card JSON object embedded in a PNG, or null if there is none. */
export function extractCardJson(png: Uint8Array): unknown | null {
  const texts = chunks(png)
    .filter((c) => c.type === 'tEXt')
    .map((c) => parseText(c.data))
    .filter((t): t is { keyword: string; text: string } => t !== null);
  for (const keyword of CARD_KEYWORDS) {
    const hit = texts.find((t) => t.keyword === keyword);
    if (hit) return JSON.parse(base64ToUtf8(hit.text));
  }
  return null;
}

/**
 * Writes the card into the PNG (replacing any existing card chunks).
 * Always writes "chara" for V2 readers; V3 cards also get "ccv3".
 */
export function embedCardJson(png: Uint8Array, card: { spec?: unknown }): Uint8Array {
  const json = JSON.stringify(card);
  const keywords = card.spec === 'chara_card_v3' ? ['chara', 'ccv3'] : ['chara'];
  const textChunks = keywords.map((k) => {
    const payload = new TextEncoder().encode(`${k}\0`);
    const value = new Uint8Array([...utf8ToBase64(json)].map((c) => c.charCodeAt(0)));
    return encodeChunk('tEXt', concat([payload, value]));
  });

  const parts: Uint8Array[] = [new Uint8Array(SIGNATURE)];
  for (const chunk of chunks(png)) {
    if (chunk.type === 'tEXt') {
      const t = parseText(chunk.data);
      if (t && (CARD_KEYWORDS as readonly string[]).includes(t.keyword)) continue;
    }
    if (chunk.type === 'IEND') parts.push(...textChunks);
    parts.push(encodeChunk(chunk.type, chunk.data));
  }
  return concat(parts);
}
