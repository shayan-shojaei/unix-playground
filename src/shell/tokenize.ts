export type TokenType = 'word' | 'pipe' | 'redirect' | 'append' | 'background';

export interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS: Record<string, TokenType> = {
  '|': 'pipe',
  '>>': 'append',
  '>': 'redirect',
  '&': 'background',
};

// Tolerant: never throws on unterminated quotes or trailing operators — required
// so per-keystroke re-parsing of partial input is always safe.
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if (ch === '>' && input[i + 1] === '>') {
      tokens.push({ type: 'append', value: '>>' });
      i += 2;
      continue;
    }
    if (ch === '|' || ch === '>' || ch === '&') {
      tokens.push({ type: OPERATORS[ch], value: ch });
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let word = '';
      while (j < n && input[j] !== quote) {
        word += input[j];
        j++;
      }
      // Unterminated quote is fine — take whatever was typed so far.
      tokens.push({ type: 'word', value: word });
      i = j < n ? j + 1 : j;
      continue;
    }
    let word = '';
    while (i < n && !/[\s|>&]/.test(input[i])) {
      word += input[i];
      i++;
    }
    tokens.push({ type: 'word', value: word });
  }

  return tokens;
}
