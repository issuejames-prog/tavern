import {
  CardImportError,
  cardToJsonText,
  cardToPng,
  emptyCardData,
  normalizeCard,
  parseCardFile,
  parseWorldJson,
  worldToCharacterBook,
  type CharacterCardV2,
  type WorldBook,
} from '@tavern/shared';
import { t } from '../i18n/zh-TW';
import { avatarKey, deleteBlob, getBlob, putBlob } from './browser-db';
import { isImage, MAX_AVATAR_BYTES, placeholderPng, toPng } from './browser-images';
import {
  fileBytes,
  findCharacter,
  forgetAvatarUrl,
  nextId,
  now,
  persist,
  refreshAvatarUrl,
  safeFileName,
  state,
  toCharacterDetail,
  toWorldSummary,
} from './browser-store';
import { bytesBlob, randomColor, ready, requireName } from './browser-util';
import { newWorld } from './browser-worlds';
import { ApiRequestError, type CharacterInput, type TavernApi } from './types';

async function storeAvatar(characterId: number, image: Blob) {
  if (image.size > MAX_AVATAR_BYTES) throw new ApiRequestError('AVATAR_TOO_LARGE', t.transfer.errors.avatarTooLarge);
  await putBlob(avatarKey(characterId), image);
  await refreshAvatarUrl(characterId);
}

/** The card as it should be exported: linked world book written back as character_book (CLAUDE.md §4.2). */
function cardForExport(characterId: number): CharacterCardV2 {
  const c = findCharacter(characterId);
  const world = c.world_book_id ? state.worlds.find((w) => w.id === c.world_book_id) : undefined;
  if (!world) return c.card;
  return {
    ...c.card,
    data: { ...c.card.data, character_book: worldToCharacterBook(world), extensions: { ...c.card.data.extensions, world: world.name } },
  };
}

/** Adds a character (and its embedded world book, if any) to the library. */
export async function addCharacter(card: CharacterCardV2, image: Blob | null, color?: string) {
  let world: WorldBook | null = null;
  const embedded = parseWorldJson(card, t.worlds.embeddedName(card.data.name));
  if (embedded && embedded.entries.length > 0) {
    world = newWorld(embedded);
    state.worlds.unshift(world);
  }
  const c = {
    id: nextId(),
    card,
    avatar_color: color ?? randomColor(),
    has_avatar: Boolean(image),
    world_book_id: world?.id ?? null,
    updated_at: now(),
  };
  state.characters.unshift(c);
  if (image) await storeAvatar(c.id, image);
  await persist();
  return { character: toCharacterDetail(c), world: world ? toWorldSummary(world) : null };
}

export const characterApi: Pick<
  TavernApi,
  'listCharacters' | 'getCharacter' | 'createCharacter' | 'updateCharacter' | 'deleteCharacter' | 'importCharacter' | 'exportCharacter' | 'setAvatar'
> = {
  listCharacters: ready(async () =>
    [...state.characters]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((c) => {
        const { card: _card, ...summary } = toCharacterDetail(c);
        return summary;
      }),
  ),

  getCharacter: ready(async (id: number) => toCharacterDetail(findCharacter(id))),

  createCharacter: ready(async (input: CharacterInput) => {
    const card = normalizeCard({ spec: 'chara_card_v2', spec_version: '2.0', data: { ...emptyCardData(), ...input.data } });
    requireName(card.data.name);
    const c = {
      id: nextId(),
      card,
      avatar_color: input.avatar_color ?? randomColor(),
      has_avatar: false,
      world_book_id: input.world_book_id ?? null,
      updated_at: now(),
    };
    state.characters.unshift(c);
    await persist();
    return toCharacterDetail(c);
  }),

  updateCharacter: ready(async (id: number, input: CharacterInput) => {
    const c = findCharacter(id);
    requireName(input.data.name);
    // Merge so fields the editor doesn't know about survive (CLAUDE.md §4.2).
    c.card = { ...c.card, data: { ...c.card.data, ...input.data } };
    if (input.avatar_color) c.avatar_color = input.avatar_color;
    if (input.world_book_id !== undefined) c.world_book_id = input.world_book_id;
    c.updated_at = now();
    await persist();
    return toCharacterDetail(c);
  }),

  deleteCharacter: ready(async (id: number) => {
    const chatIds = new Set(state.chats.filter((c) => c.character_id === id).map((c) => c.id));
    state.characters = state.characters.filter((c) => c.id !== id);
    state.chats = state.chats.filter((c) => !chatIds.has(c.id));
    state.messages = state.messages.filter((m) => !chatIds.has(m.chat_id));
    forgetAvatarUrl(id);
    await deleteBlob(avatarKey(id));
    await persist();
  }),

  importCharacter: ready(async (file: File) => {
    let parsed;
    try {
      parsed = parseCardFile(file.name, await fileBytes(file));
    } catch (err) {
      const code = err instanceof CardImportError ? err.code : 'NOT_A_CARD';
      throw new ApiRequestError(code, t.transfer.errors[code]);
    }
    return addCharacter(parsed.card, parsed.image ? bytesBlob(parsed.image, 'image/png') : null);
  }),

  exportCharacter: ready(async (id: number, format: 'png' | 'json') => {
    const c = findCharacter(id);
    const card = cardForExport(id);
    if (format === 'json') {
      return { blob: new Blob([cardToJsonText(card)], { type: 'application/json' }), fileName: safeFileName(card.data.name, 'json') };
    }
    const stored = c.has_avatar ? await getBlob(avatarKey(id)) : null;
    const base = stored ? await toPng(stored) : await placeholderPng(card.data.name, c.avatar_color);
    const png = cardToPng(card, await fileBytes(base));
    return { blob: bytesBlob(png, 'image/png'), fileName: safeFileName(card.data.name, 'png') };
  }),

  setAvatar: ready(async (id: number, file: File | null) => {
    const c = findCharacter(id);
    if (file) {
      if (!isImage(file)) throw new ApiRequestError('NOT_IMAGE', t.transfer.errors.notImage);
      await storeAvatar(id, file);
      c.has_avatar = true;
    } else {
      await deleteBlob(avatarKey(id));
      forgetAvatarUrl(id);
      c.has_avatar = false;
    }
    c.updated_at = now();
    await persist();
    return toCharacterDetail(c);
  }),
};
