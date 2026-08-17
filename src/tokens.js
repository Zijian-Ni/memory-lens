/**
 * Approximate token count for mixed CN/EN memory text.
 *
 * Method (stated so the number is auditable, not mystical):
 *   - each CJK ideograph / hiragana / katakana / hangul syllable = 1 token
 *   - remaining text is split on whitespace and punctuation; each piece = 1 token
 *
 * This is deliberately not a model tokenizer. It exists so inventory can
 * say "this pile is roughly N tokens" without calling a network or shipping
 * a 50 MB BPE table. Treat the figure as an order of magnitude.
 */

const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/u;

export const TOKEN_METHOD =
  'CJK characters count as 1; remaining text is split on whitespace/punctuation. Not a model tokenizer.';

export function estimateTokens(text) {
  const s = String(text ?? '');
  if (!s) return 0;
  let cjk = 0;
  let rest = '';
  for (const ch of s) {
    if (CJK_RE.test(ch)) cjk += 1;
    else rest += ch;
  }
  const latin = rest.split(/[\s\p{P}\p{S}]+/u).filter(Boolean).length;
  return cjk + latin;
}

export { CJK_RE };
