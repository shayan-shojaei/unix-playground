// Replays each exercise's known-good solution command(s) through the real
// shell interpreter and asserts every criterion actually passes — the only
// way to confirm expectedOutput/fileContains strings are correct without
// hand-tracing dozens of exercises. Solutions live in
// src/curriculum/content/<course>/solutions.json ({ exerciseId: command }),
// never in the shipped Exercise type or in hints (which must not give the
// answer away). A solution may be a single command string, or an array of
// command strings run in sequence (state accumulates across them, matching
// how a real session's scrollback works) — only the LAST command's
// result/state is checked against the criteria, exactly like submit() does.
//
// Run with: node scripts/verify-curriculum.mjs
import { createServer } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });

try {
  const { LESSONS_BY_COURSE } = await server.ssrLoadModule('/src/curriculum/loadCurriculum.ts');
  const { fromFsSpec } = await server.ssrLoadModule('/src/curriculum/fsSpec.ts');
  const { parseLine, runPipeline } = await server.ssrLoadModule('/src/shell/execute.ts');
  const { runCheck } = await server.ssrLoadModule('/src/curriculum/checkRunner.ts');

  let failures = 0;
  let missingSolutions = 0;
  let checked = 0;

  for (const [courseId, lessons] of Object.entries(LESSONS_BY_COURSE)) {
    const solutionsPath = path.join(root, 'src/curriculum/content', courseId, 'solutions.json');
    const solutions = existsSync(solutionsPath) ? JSON.parse(readFileSync(solutionsPath, 'utf8')) : {};

    for (const lesson of lessons) {
      const solution = solutions[lesson.id];
      if (!solution) {
        missingSolutions++;
        console.warn(`[missing solution] ${courseId}/${lesson.id}`);
        continue;
      }
      checked++;

      const commands = Array.isArray(solution) ? solution : [solution];
      let state = {
        fs: fromFsSpec(lesson.startFs),
        cwd: lesson.startCwd,
        history: [],
        aliases: {},
        env: {},
        lastExitCode: 0,
        bgJobs: [],
        nextJobId: 1,
      };
      let parsed, result, threw;
      for (const command of commands) {
        ({ parsed } = parseLine(command));
        try {
          result = runPipeline(state, parsed, command);
        } catch (e) {
          threw = e;
          break;
        }
        state = { ...result.nextState, history: [...state.history, command] };
      }
      if (threw) {
        failures++;
        console.error(`[FAIL] ${courseId}/${lesson.id}: solution threw: ${threw.message}\n  commands: ${commands.join(' ; ')}`);
        continue;
      }

      const ctx = { rawInput: commands[commands.length - 1], parsed, result, state };
      const results = lesson.criteria.map((c) => ({ id: c.id, passed: runCheck(c.check, ctx) }));
      const failed = results.filter((r) => !r.passed);
      if (failed.length > 0) {
        failures++;
        console.error(
          `[FAIL] ${courseId}/${lesson.id}: criteria failed: ${failed.map((f) => f.id).join(', ')}\n` +
            `  commands: ${commands.join(' ; ')}\n` +
            `  stdout: ${JSON.stringify(result.stdout)}\n` +
            `  stderr: ${JSON.stringify(result.stderr)}`,
        );
      }
    }
  }

  console.log(`\n${checked} exercise(s) checked, ${failures} failure(s), ${missingSolutions} missing solution(s).`);
  if (failures > 0) process.exitCode = 1;
} finally {
  await server.close();
}
