import { describe, expect, it } from 'vitest';
import { estimateTokens, splitExamples, substituteVars } from './text';

describe('text helpers', () => {
  it('estimates CJK at about one token per character', () => {
    expect(estimateTokens('慢慢來的酒館')).toBe(6);
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('hello world!!')).toBe(4);
  });

  it('substitutes variables and splits examples', () => {
    expect(substituteVars('{{char}}/{{user}}', { char: 'A', user: 'B' })).toBe('A/B');
    expect(splitExamples('<START>\na\n<START>\nb')).toEqual(['a', 'b']);
  });
});
