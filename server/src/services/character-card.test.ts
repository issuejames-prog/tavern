import { describe, expect, it } from 'vitest';
import { normalizeCard } from '@tavern/shared';
import { mergeCardData, splitExamples, substituteVars } from './character-card';

describe('character card helpers', () => {
  it('substitutes {{char}}/{{user}} in any case and legacy tokens', () => {
    expect(substituteVars('{{Char}} waves at {{USER}}. <BOT> & <USER>', { char: '阿暖', user: '旅人' })).toBe(
      '阿暖 waves at 旅人. 阿暖 & 旅人',
    );
  });

  it('keeps unknown fields through normalize + merge + JSON round trip', () => {
    const raw = {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      top_level_extra: { a: 1 },
      data: { name: 'Nova', extensions: { depth_prompt: { depth: 4 } }, some_tool_field: 'keep me' },
    };
    const merged = mergeCardData(normalizeCard(raw), { personality: 'calm' });
    const back = JSON.parse(JSON.stringify(merged)) as Record<string, unknown> & { data: Record<string, unknown> };
    expect(back.top_level_extra).toEqual({ a: 1 });
    expect(back.data.some_tool_field).toBe('keep me');
    expect(back.data.extensions).toEqual({ depth_prompt: { depth: 4 } });
    expect(back.data.personality).toBe('calm');
  });

  it('upgrades V1 flat cards', () => {
    const card = normalizeCard({ name: 'Old', description: 'd', char_persona: 'legacy' });
    expect(card.spec).toBe('chara_card_v2');
    expect(card.data.description).toBe('d');
    expect(card.data.char_persona).toBe('legacy');
  });

  it('splits example dialogue on <START>', () => {
    expect(splitExamples('<START>\na\n<start>\nb\n')).toEqual(['a', 'b']);
  });
});
