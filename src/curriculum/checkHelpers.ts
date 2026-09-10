import type { CheckCtx, CheckResult } from './types';

// Most lessons just want "does running this line produce the expected output" —
// no custom check function needed, just this + a string.
export function matchOutput(expectedOutput: string): (ctx: CheckCtx) => CheckResult {
  return ({ rawInput, result }) => {
    if (rawInput.trim() === '') return { status: 'empty' };
    if (!result) return { status: 'typing' };
    if (result.stdout.trim() === expectedOutput.trim()) return { status: 'correct' };
    if (result.exitCode !== 0) return { status: 'wrong-track', message: result.stderr };
    return { status: 'close' };
  };
}

// For lessons that check shell *state* (aliases, jobs) rather than output.
export function matchState(predicate: (ctx: CheckCtx) => boolean): (ctx: CheckCtx) => CheckResult {
  return (ctx) => {
    if (ctx.rawInput.trim() === '') return { status: 'empty' };
    if (predicate(ctx)) return { status: 'correct' };
    return ctx.result ? { status: 'close' } : { status: 'typing' };
  };
}
