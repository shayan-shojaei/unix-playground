import type { Fs, ShellState } from '../fs/types';
import type { ParsedLine } from '../shell/parsePipeline';
import type { ExecResult } from '../shell/execute';

export type CheckStatus = 'empty' | 'typing' | 'wrong-track' | 'close' | 'correct';

export interface CheckResult {
  status: CheckStatus;
  message?: string;
}

export interface CheckCtx {
  rawInput: string;
  parsed: ParsedLine | null;
  result: ExecResult | null;
  state: ShellState;
}

export interface Lesson {
  id: string;
  track: 1 | 2;
  concept: string;
  title: string;
  briefing: string;
  startFs: Fs;
  startCwd: string[];
  hints: string[];
  check: (ctx: CheckCtx) => CheckResult;
}

export interface TrackMeta {
  id: 1 | 2;
  title: string;
  description: string;
}

export const TRACKS: TrackMeta[] = [
  { id: 1, title: 'Text Tools', description: 'grep, pipes, awk, sort, uniq, sed, cut, redirects' },
  { id: 2, title: 'Shell Fundamentals', description: 'globbing, aliases, history, job control' },
];
