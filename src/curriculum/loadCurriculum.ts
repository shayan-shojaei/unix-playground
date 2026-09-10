import type { ConceptGroup, LessonInstance } from './types';

const modules = import.meta.glob('./content/track*/*.json', { eager: true }) as Record<string, { default: unknown }>;

function loadTrack(track: 1 | 2): LessonInstance[] {
  const index = modules[`./content/track${track}/index.json`]?.default as string[] | undefined;
  if (!index) throw new Error(`missing curriculum index for track ${track}`);
  return index.flatMap((conceptFile) => {
    const path = `./content/track${track}/${conceptFile}.json`;
    const group = modules[path]?.default as ConceptGroup | undefined;
    if (!group) throw new Error(`missing curriculum concept file: ${path}`);
    return group.exercises.map((exercise) => ({
      ...exercise,
      track: group.track,
      concept: group.concept,
      guide: group.guide,
    }));
  });
}

export const ALL_LESSONS: LessonInstance[] = [...loadTrack(1), ...loadTrack(2)];
