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
  title: string;
  briefing: string;
  startFs: Fs;
  startCwd: string[];
  hints: string[];
  check: (ctx: CheckCtx) => CheckResult;
}
