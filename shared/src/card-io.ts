import { normalizeCard, type CharacterCardV2 } from './card';
import { embedCardJson, extractCardJson, isPng } from './card-png';

export interface ParsedCardFile {
  card: CharacterCardV2;
  /** The original PNG (used as the avatar and as the base for PNG re-export). */
  image: Uint8Array | null;
}

export class CardImportError extends Error {
  constructor(public readonly code: 'NOT_A_CARD' | 'NO_CARD_IN_PNG' | 'BAD_JSON' | 'UNSUPPORTED_FILE') {
    super(code);
  }
}

/** Reads a .png or .json character card. Unknown fields are preserved verbatim. */
export function parseCardFile(fileName: string, bytes: Uint8Array): ParsedCardFile {
  if (isPng(bytes)) {
    let raw: unknown;
    try {
      raw = extractCardJson(bytes);
    } catch {
      throw new CardImportError('NO_CARD_IN_PNG');
    }
    if (raw === null) throw new CardImportError('NO_CARD_IN_PNG');
    return { card: toCard(raw), image: bytes };
  }
  if (/\.json$/i.test(fileName) || bytes[0] === 0x7b /* { */) {
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new CardImportError('BAD_JSON');
    }
    return { card: toCard(raw), image: null };
  }
  throw new CardImportError('UNSUPPORTED_FILE');
}

function toCard(raw: unknown): CharacterCardV2 {
  try {
    return normalizeCard(raw);
  } catch {
    throw new CardImportError('NOT_A_CARD');
  }
}

export function cardToJsonText(card: CharacterCardV2): string {
  return JSON.stringify(card, null, 2);
}

export function cardToPng(card: CharacterCardV2, basePng: Uint8Array): Uint8Array {
  return embedCardJson(basePng, card);
}
