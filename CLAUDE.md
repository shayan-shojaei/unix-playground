# unix-playground

Interactive, terminal-in-the-browser trainer for Unix text tools and shell
fundamentals. One lesson at a time: a short briefing, then a graded exercise
typed into a simulated shell — no real subprocess execution, everything runs
against an in-memory virtual filesystem and a hand-built shell interpreter.

## Stack

React 19 + TypeScript, Vite 8, `oxlint`. No backend, no router, no state
library — plain React state + `localStorage`. `npm run dev` / `npm run build`
(`tsc -b && vite build`) / `npm run lint`.

## Architecture

- `src/fs/` — in-memory virtual filesystem (`types.ts`, `fsOps.ts`)
- `src/shell/` — the shell interpreter: `tokenize.ts` → `parsePipeline.ts` →
  `execute.ts`, plus `commands.ts` (grep/sed/awk/cut/sort/uniq/wc/ls/cat/etc,
  pipes, redirects, aliases, background jobs)
- `src/curriculum/` — **all lesson content lives here as TypeScript, not
  JSON/markdown**:
  - `types.ts` — the `Lesson` interface and `TRACKS` metadata (track id,
    title, description)
  - `checkHelpers.ts` — `matchOutput(expected)` and `matchState(predicate)`,
    the two generic ways a lesson grades input; write a bespoke inline
    `check` function only when neither fits
  - `track1.ts` ("Text Tools"), `track2.ts` ("Shell Fundamentals") — flat
    arrays of `Lesson` objects. **Array order is the curriculum sequence** —
    there is no prerequisite graph or locking, just linear order
- `src/lesson/` — `useLessonSession.ts` (per-lesson session state machine:
  scrollback, live speculative preview, hint escalation after 8s stuck),
  `LessonPanel.tsx` (renders `briefing` as `#`-prefixed comment lines)
- `src/terminal/` — `Terminal.tsx`, `TerminalLine.tsx`, `highlight.ts` (live
  syntax highlighting of the input as you type)
- `src/curriculum/CurriculumSidebar.tsx` — always-visible per-track concept
  list with done/current/upcoming status
- `App.tsx` — wires curriculum + sidebar + lesson session together;
  progress is a `{completed: string[], currentId: string}` object in
  `localStorage` under `unix-playground:progress`

## The `Lesson` shape

```ts
interface Lesson {
  id: string;          // stable, kebab-case, prefixed by track (e.g. "t1-awk")
  track: 1 | 2;
  concept: string;      // short label shown in the sidebar (e.g. "awk", "pipes")
  title: string;
  briefing: string;     // 2-4 sentences: teach the concept, then state the task
  startFs: Fs;           // usually the track's shared fixture, via a helper like sharedFs()
  startCwd: string[];
  hints: string[];       // revealed one at a time, ~8s apart, while stuck
  check: (ctx: CheckCtx) => CheckResult;
}
```

## Curriculum design rules (load-bearing — read before editing lessons)

1. **One new concept per lesson.** Never introduce a command for the first
   time inside a pipeline that also uses another not-yet-taught command.
   Teach `awk` alone, `sort` alone, `uniq -c` alone, *then* a "put it
   together" lesson that chains them.
2. **Briefing = short lesson, not just an instruction.** 2-4 sentences:
   explain what the command does and why (the "uniq only collapses ADJACENT
   duplicates, so you sort first" pattern), then state the concrete task.
   Don't just say "do X" — say why X works.
3. **Order is the only prerequisite mechanism.** There's no `requires` field
   or locking. If a lesson depends on a concept, that concept's lesson must
   come earlier in the same track's array — verify by reading, not by
   tooling.
4. **`concept` must be a short, sidebar-friendly label** — a command or
   feature name (`grep`, `pipes`, `job control`), not a sentence.
5. **Reuse `sharedFs()` fixtures** already defined at the top of each track
   file unless a lesson genuinely needs different files — don't spawn a new
   fixture per lesson.
6. **Prefer `matchOutput`/`matchState`** from `checkHelpers.ts` over a
   bespoke `check` function. Only hand-write one when checking filesystem
   side effects (see `t1-redirect`) or something neither helper covers.
7. **`id`s are stable identifiers** used as localStorage keys for progress —
   don't rename an existing lesson's `id` without a reason; renaming loses
   any in-progress user's completion record for that lesson (there's no
   migration).

## Verification after any curriculum change

- `npm run build` (type-checks the `Lesson` objects)
- `npm run dev`, play through the affected track start to finish — confirm
  every exercise is actually completable with the shell interpreter as it
  exists today (check `src/shell/commands.ts` for supported commands/flags
  before writing a check that assumes a command exists)
