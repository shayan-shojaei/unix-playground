# unix-playground

Interactive, terminal-in-the-browser trainer for Unix text tools and shell
fundamentals. One concept at a time: a right-side reference guide plus
2-4 graded exercises of increasing difficulty, typed into a simulated shell
— no real subprocess execution, everything runs against an in-memory
virtual filesystem and a hand-built shell interpreter.

## Stack

React 19 + TypeScript, Vite 8, `oxlint`. No backend, no router, no state
library — plain React state + `localStorage`. `npm run dev` / `npm run build`
(`tsc -b && vite build`) / `npm run lint`.

## Architecture

- `src/fs/` — in-memory virtual filesystem (`types.ts`, `fsOps.ts`)
- `src/shell/` — the shell interpreter: `tokenize.ts` → `parsePipeline.ts` →
  `execute.ts`, plus `commands.ts` (grep/sed/awk/cut/sort/uniq/wc/ls/cat/etc,
  pipes, redirects, aliases, background jobs). No `cd`/`mkdir`/`mv`/`cp`/`rm`
  — every exercise runs from `startCwd: []`. Only `cat`/`head`/`tail`/`grep`/
  `sed`/`awk`/`sort`/`uniq`/`cut` expand globs (via `readInputOrFile`); `ls`
  does **not** — it takes its argument literally.
- `src/curriculum/` — **lesson content lives here as JSON, not TypeScript**:
  - `types.ts` — `ConceptGroup`/`Exercise`/`Criterion`/`CheckSpec`/
    `ConceptGuide`/`FsSpec`/`LessonInstance` and the `COURSES` registry
    (every course, including its id/title/description, must be listed here
    even before its content directory exists — the landing page needs the
    full list up front)
  - `content/<course-id>/index.json` — an ordered array of concept filenames.
    **That order is the curriculum sequence** — there is no prerequisite
    graph or locking
  - `content/<course-id>/<concept>.json` — one `ConceptGroup` per file: a
    `guide` (the reference material) plus 2-4 `exercises`
  - `loadCurriculum.ts` — reads each course's `index.json`, loads the named
    concept files via `import.meta.glob`, flattens into `LessonInstance[]`
  - `checkRunner.ts` — interprets a declarative `CheckSpec` (`matchOutput`,
    or a `state` predicate: `aliasEquals`/`fileContains`/`bgJobCount`/
    `bgJobDone`/`commandRan`/`historyLength`) against a `CheckCtx`
  - `checkRegistry.ts` — named escape hatch for a `{ type: 'custom' }`
    check the declarative DSL can't express (empty today)
  - `fsSpec.ts` — converts a JSON `FsSpec` into the real `Fs` tree
- `src/lesson/` — `useLessonSession.ts` (per-exercise session state
  machine: scrollback, live speculative preview, criteria evaluation, hint
  escalation after 8s stuck), `LessonPanel.tsx` (task + criteria checklist +
  output-diff panel, center column), `GuidePanel.tsx` (concept reference:
  description/syntax/flags/examples, right column)
- `src/terminal/` — `Terminal.tsx`, `TerminalLine.tsx`, `highlight.ts` (live
  syntax highlighting of the input as you type)
- `src/curriculum/CurriculumSidebar.tsx` — always-visible per-course concept
  list with done/current/upcoming status, left column; clicking any lesson
  jumps straight to it, no completion-order restriction
- `src/curriculum/CourseLanding.tsx` — landing page listing every `COURSES`
  entry to pick from
- `src/curriculum/CourseSession.tsx` — owns one course's session: loads its
  `LESSONS_BY_COURSE`, tracks/persists progress, wires the sidebar +
  terminal + lesson/guide panels together
- `App.tsx` — top-level switch between `CourseLanding` and `CourseSession`
  based on the selected `CourseId`; progress is a
  `{completed: string[], currentId: string}` object per course in
  `localStorage` under `unix-playground:progress`

## The content shape

```ts
interface ConceptGroup {
  concept: string;     // sidebar label, e.g. "grep"
  course: string;       // a CourseId from the COURSES registry
  guide: ConceptGuide;  // description, syntax, flags[], examples[] — the teaching material
  exercises: Exercise[]; // 2-4, increasing difficulty
}

interface Exercise {
  id: string;            // stable, kebab-case, e.g. "t1-grep-2"
  title: string;
  task: string;           // 1-2 sentences: the concrete ask
  startFs: FsSpec;         // usually the track's shared fixture
  startCwd: string[];
  hints: string[];          // revealed one at a time, ~8s apart, while stuck
  criteria: Criterion[];    // 1-4 named sub-checks; ALL must pass to complete
  expectedOutput?: string;  // only when every criterion is matchOutput — drives the diff panel
}
```

## Curriculum design rules (load-bearing — read before editing lessons)

See `.claude/agents/lesson-curator.md` for the full, authoritative rule set
— it owns all curriculum content and is used PROACTIVELY after any edit to
`src/curriculum/content/**/*.json`. Summary:

1. **One new concept per group.** Exercises within a group may combine the
   group's own concept with anything taught in *earlier* groups (that's how
   a "put it together" final exercise works).
2. **The guide teaches, the task asks.** `guide.description` explains what
   and why; `exercise.task` just states the concrete ask.
3. **Order is the only prerequisite mechanism** — each course's
   `index.json`, verified by reading, not tooling.
4. **`concept` is a short sidebar label**, not a sentence.
5. **Reuse each course's existing fixture** — don't invent a new one per
   exercise.
6. **Every criterion must map to an existing `CheckSpec` variant** in
   `checkRunner.ts`; a `custom` check requires a real implementation in
   `checkRegistry.ts`, flagged explicitly.
7. **`id`s are stable** — localStorage progress keys; don't rename casually.

## Verification after any curriculum change

- `npm run build` (type-checks the JSON against `ConceptGroup`/`Exercise`)
- `npm run dev`, play through the affected course start to finish — confirm
  every exercise is actually completable with the shell interpreter as it
  exists today (check `src/shell/commands.ts` for supported commands/flags,
  and note the `ls`-doesn't-glob gap above, before writing a criterion that
  assumes different behavior)
