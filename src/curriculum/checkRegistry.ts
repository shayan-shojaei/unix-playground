import type { CheckCtx } from './types';

// Escape hatch for a criterion the declarative CheckSpec vocabulary can't express.
// Empty today — every current exercise fits the declarative DSL in checkRunner.ts.
export const CHECK_REGISTRY: Record<string, (ctx: CheckCtx) => boolean> = {};
