import type { ConceptGroup, LessonInstance, CourseId } from './types';
import { COURSES } from './types';

const modules = import.meta.glob('./content/*/*.json', { eager: true }) as Record<string, { default: unknown }>;

function loadCourse(courseId: CourseId): LessonInstance[] {
  const index = modules[`./content/${courseId}/index.json`]?.default as string[] | undefined;
  if (!index) throw new Error(`missing curriculum index for course ${courseId}`);
  return index.flatMap((conceptFile) => {
    const path = `./content/${courseId}/${conceptFile}.json`;
    const group = modules[path]?.default as ConceptGroup | undefined;
    if (!group) throw new Error(`missing curriculum concept file: ${path}`);
    if (group.course !== courseId) throw new Error(`${path}: course "${group.course}" does not match directory "${courseId}"`);
    return group.exercises.map((exercise) => ({
      ...exercise,
      course: group.course,
      concept: group.concept,
      guide: group.guide,
    }));
  });
}

export const LESSONS_BY_COURSE: Record<CourseId, LessonInstance[]> = Object.fromEntries(
  COURSES.map((c) => [c.id, loadCourse(c.id)]),
) as Record<CourseId, LessonInstance[]>;
