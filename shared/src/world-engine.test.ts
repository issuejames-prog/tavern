import { describe, expect, it } from 'vitest';
import stWorld from '../../tests/fixtures/sample-world-st.json';
import { estimateTokens } from './text';
import { DEFAULT_WORLD_SETTINGS, scanWorldBooks, selectWorldSnippets, worldBudget, type WorldActivationSettings } from './world-engine';
import {
  emptyEntry,
  migrateEntry,
  parseWorldJson,
  readEntry,
  SelectiveLogic,
  worldToCharacterBook,
  worldToSillyTavern,
  writeEntry,
  type EntryOptions,
  type WorldBook,
  type WorldEntry,
} from './world-info';

type EntrySpec = Partial<WorldEntry> & { opts?: Partial<EntryOptions> };

function book(entries: EntrySpec[], overrides: Partial<WorldBook> = {}): WorldBook {
  return {
    id: 1,
    name: 'test',
    description: '',
    global: false,
    entries: entries.map(({ opts, ...e }, i) => writeEntry({ ...emptyEntry(i + 1), content: `內容${i + 1}`, ...e }, opts ?? {})),
    extra: {},
    updated_at: '',
    ...overrides,
  };
}

const settings = (s: Partial<WorldActivationSettings> = {}) => ({ ...DEFAULT_WORLD_SETTINGS, recursive: false, ...s });
const fired = (books: WorldBook[], history: string[], latest: string, s: Partial<WorldActivationSettings> = {}, random = () => 0) =>
  scanWorldBooks(books, history, latest, settings(s), random).map((t) => t.entry.id);

describe('world engine: activation', () => {
  it('matches Chinese keywords by substring, without word splitting', () => {
    const b = book([{ keys: ['燈塔'] }, { keys: ['市集'] }]);
    expect(fired([b], [], '我想去看看那座燈塔守夜人')).toEqual([1]);
  });

  it('several keys can point at one entry (any one triggers)', () => {
    const b = book([{ keys: ['寶可夢', '神奇寶貝', '寵物小精靈'] }]);
    expect(fired([b], [], '你喜歡神奇寶貝嗎')).toEqual([1]);
  });

  it('is case-insensitive by default and respects case_sensitive', () => {
    const b = book([{ keys: ['Rose'] }, { keys: ['Rose'], case_sensitive: true }]);
    expect(fired([b], [], 'a rose in bloom')).toEqual([1]);
  });

  it('match whole words applies to Latin keys only', () => {
    const b = book([{ keys: ['dog'] }, { keys: ['燈'] }]);
    expect(fired([b], [], 'a hotdog under the 燈塔', { match_whole_words: true })).toEqual([2]);
    expect(fired([b], [], 'a hotdog under the 燈塔')).toEqual([1, 2]);
  });

  it('secondary-key logic: AND ANY, AND ALL, NOT ANY, NOT ALL', () => {
    const mk = (logic: SelectiveLogic) => book([{ keys: ['星球', '故鄉'], secondary_keys: ['小T', '兔子'], opts: { logic } }]);
    const text = { none: '回到故鄉的星球', one: '小T 想念故鄉', both: '小T 和兔子的故鄉' };
    expect([fired([mk(SelectiveLogic.AndAny)], [], text.none), fired([mk(SelectiveLogic.AndAny)], [], text.one)]).toEqual([[], [1]]);
    expect([fired([mk(SelectiveLogic.AndAll)], [], text.one), fired([mk(SelectiveLogic.AndAll)], [], text.both)]).toEqual([[], [1]]);
    expect([fired([mk(SelectiveLogic.NotAny)], [], text.none), fired([mk(SelectiveLogic.NotAny)], [], text.one)]).toEqual([[1], []]);
    expect([fired([mk(SelectiveLogic.NotAll)], [], text.one), fired([mk(SelectiveLogic.NotAll)], [], text.both)]).toEqual([[1], []]);
  });

  it('constant entries always fire; disabled entries never do', () => {
    const b = book([{ opts: { status: 'constant' } }, { keys: ['海怪'], opts: { status: 'disabled' } }, { keys: ['海怪'] }]);
    expect(fired([b], [], '海怪來了')).toEqual([1, 3]);
  });

  it('scan depth counts pairs: 1 = the new message + the latest reply', () => {
    const b = book([{ keys: ['燈塔'] }]);
    expect(fired([b], ['燈塔', '別的話題'], '還是別的', { scan_depth: 1 })).toEqual([]);
    expect(fired([b], ['別的話題', '燈塔'], '還是別的', { scan_depth: 1 })).toEqual([1]);
    expect(fired([b], ['燈塔', 'x', 'y'], 'z', { scan_depth: 2 })).toEqual([1]);
  });

  it('probability: rolls below the chance fire, others do not', () => {
    const b = book([{ keys: ['雨'], opts: { probability: 30 } }]);
    expect(fired([b], [], '下雨了', {}, () => 0.1)).toEqual([1]);
    expect(fired([b], [], '下雨了', {}, () => 0.5)).toEqual([]);
  });

  it('recursive scanning: one entry can activate another, respecting the recursion flags', () => {
    const b = book([
      { keys: ['貝西'], content: '貝西是一頭奶牛，和魯弗斯是朋友。' },
      { keys: ['魯弗斯'], content: '魯弗斯是一條狗。' },
      { keys: ['狗'], content: '狗會看家。', opts: { excludeRecursion: true } },
    ]);
    const all = scanWorldBooks([b], [], '我遇見了貝西', settings({ recursive: true }));
    expect(all.map((a) => [a.entry.id, a.reason])).toEqual([
      [1, 'keyword'],
      [2, 'recursive'],
    ]);
    expect(fired([b], [], '我遇見了貝西', { recursive: false })).toEqual([1]);
    const stopper = book([{ keys: ['貝西'], content: '和魯弗斯是朋友', opts: { preventRecursion: true } }, { keys: ['魯弗斯'] }]);
    expect(scanWorldBooks([stopper], [], '貝西', settings({ recursive: true })).map((a) => a.entry.id)).toEqual([1]);
  });
});

describe('world engine: budget', () => {
  it('ranks constant > keyword > recursive, then higher insertion order first', () => {
    const b = book([
      { keys: ['島'], content: '關鍵字低順序', insertion_order: 10, comment: 'kw-low' },
      { keys: ['島'], content: '關鍵字高順序', insertion_order: 90, comment: 'kw-high' },
      { content: '常駐條目', insertion_order: 1, comment: 'const', opts: { status: 'constant' } },
    ]);
    const { snippets, dropped } = selectWorldSnippets(scanWorldBooks([b], [], '島', settings()), estimateTokens, 14);
    expect(snippets.map((s) => s.label)).toEqual(['const', 'kw-high']);
    expect(dropped).toBe(1);
  });

  it('budget = context % of the prompt budget, capped by budget_cap', () => {
    expect(worldBudget({ ...DEFAULT_WORLD_SETTINGS, context_percent: 25 }, 8000)).toBe(2000);
    expect(worldBudget({ ...DEFAULT_WORLD_SETTINGS, context_percent: 25, budget_cap: 500 }, 8000)).toBe(500);
  });
});

describe('world book formats', () => {
  it('imports a SillyTavern World Info file, mapping fields into the shared model', () => {
    const w = parseWorldJson(stWorld, 'fallback')!;
    expect(w.name).toBe('星落群島');
    expect(w.extra.x_file_field).toBe('keep');
    const [overview, market, disabled] = w.entries;
    expect(overview).toMatchObject({ id: 0, keys: ['星落', '群島'], position: 'before_char', insertion_order: 100, enabled: true });
    expect(readEntry(market!)).toMatchObject({ position: 'at_depth', depth: 2, probability: 100 });
    expect(overview!.group).toBe('');
    expect(readEntry(disabled!).status).toBe('disabled');
  });

  it('round-trips SillyTavern format without losing fields', () => {
    const w = { ...parseWorldJson(stWorld, 'x')!, id: 9, global: false, updated_at: '' };
    const out = worldToSillyTavern(w) as unknown as typeof stWorld;
    expect(out.entries['0']).toMatchObject(stWorld.entries['0']);
    expect(out.entries['1']).toMatchObject(stWorld.entries['1']);
    expect(out.entries['2']).toMatchObject(stWorld.entries['2']);
    expect(out.x_file_field).toBe('keep');
  });

  it('converts to an embedded character_book with extended options in extensions', () => {
    const w = { ...parseWorldJson(stWorld, 'x')!, id: 9, global: false, updated_at: '' };
    const cb = worldToCharacterBook(w);
    expect(cb.entries).toHaveLength(3);
    expect(cb.entries[1]).toMatchObject({ keys: ['市集'], position: 'after_char', extensions: { position: 4, depth: 2 } });
  });

  it('writeEntry keeps V2 fields and SillyTavern extensions in sync', () => {
    const e = writeEntry(emptyEntry(1), { position: 'an_bottom', status: 'constant', probability: 40 });
    expect(e).toMatchObject({ constant: true, enabled: true, position: 'after_char' });
    expect(e.extensions).toMatchObject({ position: 3, probability: 40, useProbability: true });
    expect(readEntry(e)).toMatchObject({ position: 'an_bottom', status: 'constant', probability: 40 });
  });

  it('migrates entries saved by the previous app version', () => {
    const old = { ...emptyEntry(1), extensions: { st_position: 4 }, depth: 2, probability: 50 } as WorldEntry;
    const m = migrateEntry(old);
    expect(readEntry(m)).toMatchObject({ position: 'at_depth', depth: 2, probability: 50 });
    expect('depth' in m).toBe(false);
  });
});
