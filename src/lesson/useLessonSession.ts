import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShellState } from '../fs/types';
import type { Lesson, CheckResult } from '../curriculum/types';
import { tokenize } from '../shell/tokenize';
import { splitPipeline, type ParsedLine } from '../shell/parsePipeline';
import { runPipeline, isPipelinePure, type ExecResult } from '../shell/execute';

export interface ScrollbackLine {
  prompt: string;
  input: string;
  stdout: string;
  stderr: string;
}

function freshState(lesson: Lesson): ShellState {
  return {
    fs: lesson.startFs,
    cwd: lesson.startCwd,
    history: [],
    aliases: {},
    env: {},
    lastExitCode: 0,
    bgJobs: [],
    nextJobId: 1,
  };
}

export function useLessonSession(lesson: Lesson) {
  const [state, setState] = useState<ShellState>(() => freshState(lesson));
  const [input, setInput] = useState('');
  const [scrollback, setScrollback] = useState<ScrollbackLine[]>([]);
  const [completed, setCompleted] = useState(false);
  const [hintIndex, setHintIndex] = useState(-1);
  const amberSinceRef = useRef<number | null>(null);

  // Reset session when the lesson changes.
  useEffect(() => {
    setState(freshState(lesson));
    setInput('');
    setScrollback([]);
    setCompleted(false);
    setHintIndex(-1);
    amberSinceRef.current = null;
  }, [lesson]);

  // Tick background jobs forward once a second (the one deliberately-async piece).
  useEffect(() => {
    const timer = setInterval(() => {
      setState((s) => {
        if (s.bgJobs.every((j) => j.status !== 'running')) return s;
        return {
          ...s,
          bgJobs: s.bgJobs.map((j) =>
            j.status === 'running'
              ? j.ticksLeft <= 1
                ? { ...j, ticksLeft: 0, status: 'done' as const }
                : { ...j, ticksLeft: j.ticksLeft - 1 }
              : j,
          ),
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const parsed: ParsedLine = useMemo(() => splitPipeline(tokenize(input)), [input]);
  const pure = useMemo(() => isPipelinePure(parsed), [parsed]);

  const speculativeResult: ExecResult | null = useMemo(() => {
    if (parsed.stages.length === 0 || parsed.stages.some((s) => s.name === '')) return null;
    if (!pure) return null;
    try {
      return runPipeline(state, parsed, input);
    } catch {
      return null;
    }
  }, [state, parsed, pure, input]);

  const check: CheckResult = useMemo(() => {
    if (completed) return { status: 'correct' };
    return lesson.check({ rawInput: input, parsed, result: speculativeResult, state });
  }, [lesson, input, parsed, speculativeResult, state, completed]);

  // Escalate a hint after a few seconds stuck in a non-empty, non-correct state.
  useEffect(() => {
    if (check.status === 'close' || check.status === 'wrong-track') {
      if (amberSinceRef.current === null) amberSinceRef.current = Date.now();
      const elapsed = Date.now() - amberSinceRef.current;
      const nextHint = Math.min(hintIndex + 1, lesson.hints.length - 1);
      if (elapsed > 8000 && nextHint > hintIndex) {
        const t = setTimeout(() => setHintIndex(nextHint), 8000 - elapsed);
        return () => clearTimeout(t);
      }
    } else {
      amberSinceRef.current = null;
    }
  }, [check.status, hintIndex, lesson.hints.length]);

  const submit = useCallback(() => {
    if (input.trim() === '') return;
    const runParsed = splitPipeline(tokenize(input));
    let result: ExecResult;
    try {
      result = runPipeline(state, runParsed, input);
    } catch {
      result = { stdout: '', stderr: 'error', exitCode: 1, nextState: state };
    }
    const nextState: ShellState = { ...result.nextState, history: [...state.history, input] };
    setState(nextState);
    setScrollback((sb) => [...sb, { prompt: promptFor(state), input, stdout: result.stdout, stderr: result.stderr }]);
    const finalCheck = lesson.check({ rawInput: input, parsed: runParsed, result, state: nextState });
    if (finalCheck.status === 'correct') setCompleted(true);
    setInput('');
  }, [input, state, lesson]);

  return {
    state,
    input,
    setInput,
    scrollback,
    submit,
    check,
    completed,
    hints: lesson.hints,
    hintIndex,
    pure,
    preview: speculativeResult,
  };
}

export function promptFor(state: ShellState): string {
  return '/' + state.cwd.join('/') + ' $';
}
