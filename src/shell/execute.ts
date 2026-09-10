import type { ShellState } from '../fs/types';
import { setNode, normalizeSegments } from '../fs/fsOps';
import { tokenize } from './tokenize';
import { splitPipeline, type ParsedLine } from './parsePipeline';
import { COMMANDS } from './commands';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  nextState: ShellState;
}

export function parseLine(raw: string): { parsed: ParsedLine; unknown: string[] } {
  const parsed = splitPipeline(tokenize(raw));
  const unknown = parsed.stages.filter((s) => !resolveCommandName(s.name)).map((s) => s.name);
  return { parsed, unknown };
}

function resolveCommandName(name: string): string | null {
  return COMMANDS[name] ? name : null;
}

export function isPipelinePure(parsed: ParsedLine): boolean {
  if (parsed.redirect || parsed.background) return false;
  return parsed.stages.every((s) => {
    const alias = s.name;
    const spec = COMMANDS[alias];
    return !!spec && spec.pure;
  });
}

// Runs the full pipeline against `state`. Pure and side-effect-free w.r.t. its
// input (returns a new state) — safe to call speculatively against a clone.
export function runPipeline(state: ShellState, parsed: ParsedLine, rawInput: string): ExecResult {
  let stdin = '';
  let stateAcc = state;
  let stderr = '';
  let exitCode = 0;

  if (parsed.stages.length === 0) {
    return { stdout: '', stderr: '', exitCode: 0, nextState: state };
  }

  if (parsed.background) {
    const job = {
      id: state.nextJobId,
      cmd: rawInput,
      ticksLeft: parsed.stages[0].name === 'sleep' ? parseInt(parsed.stages[0].args[0], 10) || 3 : 1,
      status: 'running' as const,
    };
    const nextState: ShellState = { ...state, bgJobs: [...state.bgJobs, job], nextJobId: state.nextJobId + 1 };
    return { stdout: `[${job.id}] running in background`, stderr: '', exitCode: 0, nextState };
  }

  for (const stage of parsed.stages) {
    const spec = COMMANDS[stage.name];
    if (!spec) {
      stderr = `${stage.name}: command not found`;
      exitCode = 127;
      stdin = '';
      break;
    }
    const result = spec.run({ state: stateAcc, args: stage.args, stdin });
    stdin = result.stdout;
    stderr = result.stderr;
    exitCode = result.exitCode;
    if (result.stateUpdate) stateAcc = { ...stateAcc, ...result.stateUpdate };
    if (exitCode !== 0) break;
  }

  let stdout = stdin;

  if (parsed.redirect && exitCode === 0) {
    const segs = normalizeSegments(stateAcc.cwd, parsed.redirect.target);
    stateAcc = {
      ...stateAcc,
      fs: setNode(stateAcc.fs, segs, (existing) => {
        const prior = parsed.redirect!.mode === 'append' && existing?.type === 'file' ? existing.content : '';
        const sep = prior && stdout ? '\n' : '';
        return { type: 'file', content: prior + sep + stdout };
      }),
    };
    stdout = '';
  }

  return { stdout, stderr, exitCode, nextState: stateAcc };
}
