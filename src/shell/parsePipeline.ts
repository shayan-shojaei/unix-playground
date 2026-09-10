import type { Token } from './tokenize';

export interface Stage {
  name: string;
  args: string[];
}

export interface ParsedLine {
  stages: Stage[];
  redirect?: { mode: 'redirect' | 'append'; target: string };
  background: boolean;
}

// Structural split only — never throws. Tolerates trailing/incomplete
// operators (e.g. "echo hi |" or "echo hi >") by simply omitting that part.
export function splitPipeline(tokens: Token[]): ParsedLine {
  let working = tokens;
  let background = false;
  if (working.length > 0 && working[working.length - 1].type === 'background') {
    background = true;
    working = working.slice(0, -1);
  }

  let redirect: ParsedLine['redirect'];
  const redirectIdx = working.findIndex((t) => t.type === 'redirect' || t.type === 'append');
  if (redirectIdx !== -1) {
    const opToken = working[redirectIdx];
    const targetTokens = working.slice(redirectIdx + 1).filter((t) => t.type === 'word');
    const target = targetTokens[0]?.value ?? '';
    redirect = { mode: opToken.type as 'redirect' | 'append', target };
    working = working.slice(0, redirectIdx);
  }

  const stages: Stage[] = [];
  let current: Token[] = [];
  for (const t of working) {
    if (t.type === 'pipe') {
      stages.push(tokensToStage(current));
      current = [];
    } else {
      current.push(t);
    }
  }
  stages.push(tokensToStage(current));

  return { stages: stages.filter((s) => s.name !== ''), redirect, background };
}

function tokensToStage(tokens: Token[]): Stage {
  const words = tokens.filter((t) => t.type === 'word').map((t) => t.value);
  return { name: words[0] ?? '', args: words.slice(1) };
}
