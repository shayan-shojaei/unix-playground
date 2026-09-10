import type { CourseId } from './types';

export const PROGRESS_KEY = 'unix-playground:progress:v2';

export interface Progress {
  completed: string[];
  currentId: string;
}

export type ProgressByCourse = Partial<Record<CourseId, Progress>>;

export function loadAllProgress(): ProgressByCourse {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as ProgressByCourse | null;
    return raw ?? {};
  } catch {
    // ponytail: best-effort persistence, ignore storage failures (private mode, quota, etc.)
    return {};
  }
}

export function saveAllProgress(p: ProgressByCourse) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // ponytail: best-effort persistence, ignore storage failures (private mode, quota, etc.)
  }
}
