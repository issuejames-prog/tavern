import { describe, expect, it } from 'vitest';
import stWorld from '../../tests/fixtures/sample-world-st.json';
import { estimateTokens } from './text';
import { scanWorldBooks, selectWorldSnippets } from './world-engine';
import { emptyEntry, parseWorldJson, worldToCharacterBook, worldToSillyTavern, type WorldBook, type WorldEntry } from './world-info';

function book(entries: Partial<WorldEntry>[], overrides: Partial<WorldBook> = {}): WorldBook {
  return {
    id: 1,
    name: 'test',
    description: '',
    scan_depth: 2,
    token_budget: 0,
    global: false,
    entries: entries.map((e, i) => ({ ...emptyEntry(i + 1), content: `內容${i + 1}`, ...e })),
    extra: {},
    updated_at: '',
    ...overrides,
  };
}

const fired = (books: WorldBook[], texts: string[]) => scanWorldBooks(books, texts).map((t) => t.entry.id);

describe('world engine', () => {
  it('matches Chinese keywords by substring, without word splitting', () => {
    const b = book([{ keys: ['燈塔'] }, { keys: ['市集'] }]);
    expect(fired([b], ['我想去看看那座燈塔守夜人'])).toEqual([1]);
  });

  it('is case-insensitive by default and respects case_sensitive', () => {
    const b = book([{ keys: ['Dragon'] }, { keys: ['Dragon'], case_sensitive: true }]);
    expect(fired([b], ['a dragon appears'])).toEqual([1]);
  });

  it('requires a secondary key as well when secondary_keys is set', () => {
    const b = book([{ keys: ['市集'], secondary_keys: ['晚上', '夜晚'] }]);
    expect(fired([b], ['市集在哪裡？'])).toEqual([]);
    expect(fired([b], ['晚上的市集在哪裡？'])).toEqual([1]);
    // selective: false ignores secondary keys (SillyTavern semantics)
    const loose = book([{ keys: ['市集'], secondary_keys: ['晚上'], selective: false }]);
    expect(fired([loose], ['市集在哪裡？'])).toEqual([1]);
  });

  it('always includes constant entries and never includes disabled ones', () => {
    const b = book([{ constant: true }, { keys: ['海怪'], enabled: false }, { keys: ['海怪'] }]);
    expect(fired([b], ['海怪來了'])).toEqual([1, 3]);
  });

  it('only scans the last scan_depth messages', () => {
    const b = book([{ keys: ['燈塔'] }], { scan_depth: 2 });
    expect(fired([b], ['燈塔', '別的話題', '還是別的'])).toEqual([]);
    expect(fired([b], ['別的話題', '燈塔', '還是別的'])).toEqual([1]);
  });

  it('supports /regex/ keys and ignores broken patterns', () => {
    const b = book([{ keys: ['/第[一二三]島/'] }, { keys: ['/([/'] }]);
    expect(fired([b], ['我們到了第二島'])).toEqual([1]);
  });

  it('keeps higher-priority entries when the book budget is tight', () => {
    const b = book(
      [
        { keys: ['島'], content: '低優先度的長長內容'.repeat(3), priority: 1, comment: 'low' },
        { keys: ['島'], content: '高優先度內容', priority: 9, comment: 'high' },
      ],
      { token_budget: 12 },
    );
    const snippets = selectWorldSnippets(scanWorldBooks([b], ['島']), estimateTokens);
    expect(snippets.map((s) => s.label)).toEqual(['high']);
  });
});

describe('world book formats', () => {
  it('imports a SillyTavern World Info file, mapping fields and keeping unknown ones', () => {
    const w = parseWorldJson(stWorld, 'fallback')!;
    expect(w.name).toBe('星落群島');
    expect(w.extra.x_file_field).toBe('keep');
    const [overview, market, disabled] = w.entries;
    expect(overview).toMatchObject({ id: 0, keys: ['星落', '群島'], position: 'before_char', insertion_order: 100, enabled: true });
    expect(market).toMatchObject({ secondary_keys: ['夜晚', '晚上'], probability: 100, depth: 2 });
    expect(market!.extensions).toEqual({ st_position: 4 });
    expect(disabled!.enabled).toBe(false);
  });

  it('round-trips SillyTavern format without losing fields', () => {
    const w = { ...parseWorldJson(stWorld, 'x')!, id: 9, global: false, updated_at: '' };
    const out = worldToSillyTavern(w) as unknown as typeof stWorld;
    expect(out.entries['1']).toMatchObject(stWorld.entries['1']);
    expect(out.entries['0']).toMatchObject(stWorld.entries['0']);
    expect(out.entries['2']).toMatchObject(stWorld.entries['2']);
    expect(out.x_file_field).toBe('keep');
  });

  it('converts to an embedded character_book with entries intact', () => {
    const w = { ...parseWorldJson(stWorld, 'x')!, id: 9, global: false, updated_at: '' };
    const cb = worldToCharacterBook(w);
    expect(cb.entries).toHaveLength(3);
    expect(cb.entries[1]).toMatchObject({ keys: ['市集'], content: '只有晚上才開的市集，攤販用貝殼交易。' });
  });
});
