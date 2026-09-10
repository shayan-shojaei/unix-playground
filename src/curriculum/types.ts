import type { ShellState } from '../fs/types';
import type { ParsedLine } from '../shell/parsePipeline';
import type { ExecResult } from '../shell/execute';

export interface CheckCtx {
  rawInput: string;
  parsed: ParsedLine | null;
  result: ExecResult | null;
  state: ShellState;
}

// Declarative — lives in JSON. checkRunner.ts interprets these against a CheckCtx.
export type CheckSpec =
  | { type: 'matchOutput'; expected: string }
  | { type: 'state'; predicate: 'aliasEquals'; name: string; value: string }
  | { type: 'state'; predicate: 'fileContains'; path: string; substring: string }
  | { type: 'state'; predicate: 'bgJobCount'; min: number }
  | { type: 'state'; predicate: 'bgJobDone' }
  | { type: 'state'; predicate: 'commandRan'; name: string }
  | { type: 'state'; predicate: 'historyLength'; min: number }
  | { type: 'custom'; id: string };

export interface Criterion {
  id: string;
  label: string;
  check: CheckSpec;
}

// JSON-serializable mirror of fs/types.ts's dir()/file() tree.
export type FsSpec = Record<string, { content: string } | { children: FsSpec }>;

export interface ConceptGuide {
  concept: string;
  description: string;
  syntax: string;
  flags: { flag: string; desc: string }[];
  examples: { cmd: string; output: string; note?: string }[];
}

export interface Exercise {
  id: string;
  title: string;
  task: string;
  startFs: FsSpec;
  startCwd: string[];
  hints: string[];
  criteria: Criterion[];
  // Only set when every criterion is a matchOutput check — drives the diff panel.
  expectedOutput?: string;
}

export interface ConceptGroup {
  concept: string;
  track: 1 | 2;
  guide: ConceptGuide;
  exercises: Exercise[];
}

// Flattened, one per exercise, with its parent group's metadata folded in —
// the shape the rest of the app (sidebar, session, progress) consumes.
export interface LessonInstance extends Exercise {
  track: 1 | 2;
  concept: string;
  guide: ConceptGuide;
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
