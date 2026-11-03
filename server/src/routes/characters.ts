import { desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { emptyCardData, normalizeCard, type CharacterCardV2Data } from '@tavern/shared';
import { db } from '../db/client';
import { characters } from '../db/schema';
import { AppError, idParam, readJson, sendError } from '../lib/errors';
import { mergeCardData, parseStoredCard } from '../services/character-card';
import { getCharacterRow, toCharacterDetail, toCharacterSummary } from '../services/repo';

export const characterRoutes = new Hono();

const AVATAR_COLORS = ['sage', 'clay', 'sky', 'sand', 'plum'] as const;

const STRING_FIELDS = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'system_prompt',
  'post_history_instructions',
  'creator',
  'creator_notes',
  'character_version',
] as const;

/** Picks only known, well-typed editor fields; everything else in the card is left untouched. */
function pickCardPatch(raw: unknown): Partial<CharacterCardV2Data> {
  if (!raw || typeof raw !== 'object') return {};
  const src = raw as Record<string, unknown>;
  const patch: Partial<CharacterCardV2Data> = {};
  for (const key of STRING_FIELDS) {
    if (typeof src[key] === 'string') patch[key] = src[key];
  }
  for (const key of ['tags', 'alternate_greetings'] as const) {
    const value = src[key];
    if (Array.isArray(value)) patch[key] = value.filter((v): v is string => typeof v === 'string');
  }
  return patch;
}

function pickColor(raw: unknown): string | undefined {
  return AVATAR_COLORS.find((c) => c === raw);
}

characterRoutes.get('/', (c) => {
  const rows = db.select().from(characters).orderBy(desc(characters.updated_at)).all();
  return c.json(rows.map(toCharacterSummary));
});

characterRoutes.get('/:id', (c) => {
  try {
    return c.json(toCharacterDetail(getCharacterRow(idParam(c.req.param('id')))));
  } catch (err) {
    return sendError(c, err);
  }
});

characterRoutes.post('/', async (c) => {
  try {
    const body = await readJson(c);
    // Accept either editor fields ({ data }) or a whole card JSON ({ card }).
    const card = body.card
      ? normalizeCard(body.card)
      : normalizeCard({ spec: 'chara_card_v2', data: { ...emptyCardData(), ...pickCardPatch(body.data) } });
    if (!card.data.name.trim()) throw new AppError('NAME_REQUIRED', '角色需要一個名字');
    const color = pickColor(body.avatar_color) ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const row = db
      .insert(characters)
      .values({ name: card.data.name.trim(), card_json: JSON.stringify(card), avatar_color: color })
      .returning()
      .get();
    return c.json(toCharacterDetail(row), 201);
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_CARD') {
      return sendError(c, new AppError('INVALID_CARD', '角色卡格式不正確'));
    }
    return sendError(c, err);
  }
});

characterRoutes.put('/:id', async (c) => {
  try {
    const id = idParam(c.req.param('id'));
    const row = getCharacterRow(id);
    const body = await readJson(c);
    const patch = pickCardPatch(body.data);
    if (patch.name !== undefined && !patch.name.trim()) throw new AppError('NAME_REQUIRED', '角色需要一個名字');

    const card = mergeCardData(parseStoredCard(row.card_json), patch);
    const updated = db
      .update(characters)
      .set({
        name: card.data.name.trim(),
        card_json: JSON.stringify(card),
        avatar_color: pickColor(body.avatar_color) ?? row.avatar_color,
        updated_at: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      })
      .where(eq(characters.id, id))
      .returning()
      .get();
    return c.json(toCharacterDetail(updated));
  } catch (err) {
    return sendError(c, err);
  }
});

// The UI asks for confirmation first; chats of this character cascade.
characterRoutes.delete('/:id', (c) => {
  try {
    const id = idParam(c.req.param('id'));
    getCharacterRow(id);
    db.delete(characters).where(eq(characters.id, id)).run();
    return c.json({ ok: true });
  } catch (err) {
    return sendError(c, err);
  }
});
