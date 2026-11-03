import { describe, expect, it } from 'vitest';
import { emptyCardData, type CharacterCardV2Data } from './card';
import { cardTokens, lintCard, readCharacterNote, writeCharacterNote } from './card-writing';

const card = (patch: Partial<CharacterCardV2Data>): CharacterCardV2Data => ({ ...emptyCardData('莉瑟爾'), ...patch });
const codes = (d: CharacterCardV2Data) => lintCard(d, 7000).map((i) => `${i.code}:${i.field}`);

const ALI_CHAT = '{{user}}：生平簡介？\n{{char}}：「我當過騎士。」她聳聳肩。';
const PLIST = '[莉瑟爾的性格：沉默，可靠；標籤：奇幻]';

describe('character note (depth_prompt)', () => {
  it('reads defaults and writes SillyTavern-compatible depth_prompt, keeping other fields', () => {
    const d = card({ extensions: { depth_prompt: { role: 'user' }, other: 1 } });
    expect(readCharacterNote(d)).toEqual({ prompt: '', depth: 4 });
    const ext = writeCharacterNote(d, { prompt: PLIST, depth: 4 });
    expect(ext).toEqual({ other: 1, depth_prompt: { role: 'user', prompt: PLIST, depth: 4 } });
  });
});

describe('lintCard', () => {
  it('a card written per the guide has no warnings', () => {
    const d = card({
      description: ALI_CHAT,
      first_mes: '*莉瑟爾把劍靠在吧台邊。*「坐吧，旅人。」',
      extensions: { depth_prompt: { prompt: PLIST, depth: 4 } },
    });
    expect(codes(d)).toEqual([]);
  });

  it('flags blank lines and acting for the user', () => {
    const d = card({ description: ALI_CHAT + '\n' + PLIST, first_mes: '她揮手。\n\n你點了點頭，跟著她走。' });
    expect(codes(d)).toEqual(['DOUBLE_NEWLINE:first_mes', 'USER_ACTION:first_mes']);
  });

  it('suggests a PList, and keeping it last in the description', () => {
    expect(codes(card({ description: ALI_CHAT, first_mes: 'x' }))).toEqual(['NO_PLIST:character_note']);
    expect(codes(card({ description: `${PLIST}\n${ALI_CHAT}`, first_mes: 'x' }))).toEqual(['PLIST_NOT_LAST:description']);
  });

  it('points out that mes_example is temporary when the description has no Ali:Chat', () => {
    const d = card({ description: PLIST, mes_example: '<START>\n{{char}}：嗨', first_mes: 'x' });
    expect(codes(d)).toEqual(['EXAMPLES_TEMPORARY:mes_example']);
  });

  it('counts permanent vs temporary tokens', () => {
    const t = cardTokens(card({ description: '一二三', first_mes: '四五', extensions: { depth_prompt: { prompt: '六', depth: 4 } } }));
    expect(t).toEqual({ permanent: 4, temporary: 2 });
  });
});
