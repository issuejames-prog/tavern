// Pure text helpers shared by the server and the browser mode.

export type TokenCounter = (text: string) => number;

// Per-message framing overhead in the chat format (role markers etc.).
export const MESSAGE_OVERHEAD = 4;

/**
 * Replaces {{char}} / {{user}} (any case) plus the legacy <BOT> / <USER> tokens
 * that older community cards still use.
 */
export function substituteVars(text: string, vars: { char: string; user: string }): string {
  if (!text) return text;
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, vars.char)
    .replace(/\{\{\s*user\s*\}\}/gi, vars.user)
    .replace(/<BOT>/g, vars.char)
    .replace(/<USER>/g, vars.user);
}

/** Splits `mes_example` into dialogue blocks separated by <START>. */
export function splitExamples(mesExample: string): string[] {
  return mesExample
    .split(/<START>/i)
    .map((block) => block.trim())
    .filter(Boolean);
}

/**
 * Dependency-free token estimate for the browser (no tokenizer download):
 * CJK characters ≈ 1 token each, other text ≈ 4 characters per token.
 * Deliberately a little generous so budgets err on the safe side.
 */
export const estimateTokens: TokenCounter = (text) => {
  if (!text) return 0;
  const cjk = text.match(/[　-鿿가-힯＀-￯]/g)?.length ?? 0;
  return cjk + Math.ceil((text.length - cjk) / 3.5);
};
