import type { ShellState, MediaMeta } from '../fs/types';
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
export type FsSpec = Record<string, { content: string; meta?: MediaMeta } | { children: FsSpec }>;

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
  course: string;
  guide: ConceptGuide;
  exercises: Exercise[];
}

// Flattened, one per exercise, with its parent group's metadata folded in —
// the shape the rest of the app (sidebar, session, progress) consumes.
export interface LessonInstance extends Exercise {
  course: string;
  concept: string;
  guide: ConceptGuide;
}

export interface CourseMeta {
  id: string;
  title: string;
  description: string;
}

// Every course must be listed here, even before its content directory
// exists — the landing page needs the full list up front.
export const COURSES = [
  { id: 'text-tools', title: 'Text Tools', description: 'grep, pipes, awk, sort, uniq, sed, cut, redirects' },
  { id: 'shell-fundamentals', title: 'Shell Fundamentals', description: 'globbing, aliases, history, job control' },
  { id: 'ffmpeg', title: 'FFMPEG', description: 'convert, resize, and inspect media files from the command line' },
] as const satisfies CourseMeta[];

export type CourseId = (typeof COURSES)[number]['id'];
