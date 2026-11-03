import { describe, expect, it } from 'vitest';
import fixture from '../../tests/fixtures/sample-card-v2.json';
import { normalizeCard } from './card';
import { cardToJsonText, cardToPng, parseCardFile } from './card-io';
import { extractCardJson, isPng } from './card-png';

// 1×1 transparent PNG, built in-test so no binary fixture is needed.
const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0),
);
const enc = (s: string) => new TextEncoder().encode(s);

describe('character card import/export', () => {
  it('JSON round trip keeps the card identical, unknown fields included', () => {
    const { card, image } = parseCardFile('card.json', enc(JSON.stringify(fixture)));
    expect(image).toBeNull();
    const again = parseCardFile('again.json', enc(cardToJsonText(card))).card;
    expect(again).toEqual(card);
    expect(again.x_top_level_tool_field).toEqual({ keep: true });
    expect(again.data.x_data_tool_field).toBe('keep me too');
    expect(again.data.extensions).toEqual(fixture.data.extensions);
    expect(again.data.character_book?.entries[0]?.x_entry_field).toBe('keep');
  });

  it('PNG round trip: embed, re-read, still a valid PNG, content unchanged (Chinese included)', () => {
    const card = normalizeCard(fixture);
    const png = cardToPng(card, TINY_PNG);
    expect(isPng(png)).toBe(true);
    const parsed = parseCardFile('card.png', png);
    expect(parsed.card).toEqual(card);
    expect(parsed.card.data.name).toBe('霧島');
    expect(parsed.image).toBe(png);
  });

  it('re-exporting replaces the old card chunk instead of stacking a second one', () => {
    const first = cardToPng(normalizeCard(fixture), TINY_PNG);
    const edited = normalizeCard({ ...fixture, data: { ...fixture.data, name: '霧島・改' } });
    const second = cardToPng(edited, first);
    expect((extractCardJson(second) as { data: { name: string } }).data.name).toBe('霧島・改');
    const text = new TextDecoder('latin1').decode(second);
    expect(text.split('tEXtchara').length - 1).toBe(1);
  });

  it('V3 cards keep their spec and get both chara and ccv3 chunks', () => {
    const v3 = normalizeCard({ ...fixture, spec: 'chara_card_v3', spec_version: '3.0' });
    const png = cardToPng(v3, TINY_PNG);
    const text = new TextDecoder('latin1').decode(png);
    expect(text).toContain('tEXtchara');
    expect(text).toContain('tEXtccv3');
    expect(parseCardFile('v3.png', png).card.spec).toBe('chara_card_v3');
  });

  it('rejects a PNG without a card and a JSON that is not a card', () => {
    expect(() => parseCardFile('plain.png', TINY_PNG)).toThrow('NO_CARD_IN_PNG');
    expect(() => parseCardFile('x.json', enc('{"hello":1}'))).toThrow('NOT_A_CARD');
    expect(() => parseCardFile('x.json', enc('{oops'))).toThrow('BAD_JSON');
  });

  it('upgrades V1 flat cards and repairs malformed core fields', () => {
    const card = normalizeCard({ name: 'Old', description: 'd', char_persona: 'legacy', tags: 'not-an-array' });
    expect(card.spec).toBe('chara_card_v2');
    expect(card.data.char_persona).toBe('legacy');
    expect(card.data.tags).toEqual([]);
  });
});
