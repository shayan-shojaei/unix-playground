import type { CheckCtx, CheckSpec } from './types';
import { getNode, normalizeSegments } from '../fs/fsOps';
import { CHECK_REGISTRY } from './checkRegistry';

export function runCheck(spec: CheckSpec, ctx: CheckCtx): boolean {
  if (ctx.rawInput.trim() === '') return false;

  switch (spec.type) {
    case 'matchOutput':
      return !!ctx.result && ctx.result.exitCode === 0 && ctx.result.stdout.trim() === spec.expected.trim();

    case 'custom':
      return CHECK_REGISTRY[spec.id]?.(ctx) ?? false;

    case 'state':
      switch (spec.predicate) {
        case 'aliasEquals':
          return ctx.state.aliases[spec.name] === spec.value;
        case 'fileContains': {
          const node = getNode(ctx.state.fs, normalizeSegments(ctx.state.cwd, spec.path));
          return !!node && node.type === 'file' && node.content.includes(spec.substring);
        }
        case 'bgJobCount':
          return ctx.state.bgJobs.length >= spec.min;
        case 'bgJobDone':
          return ctx.state.bgJobs.some((j) => j.status === 'done');
        case 'commandRan':
          return ctx.parsed?.stages[0]?.name === spec.name;
        case 'historyLength':
          return ctx.state.history.length >= spec.min;
      }
  }
}
