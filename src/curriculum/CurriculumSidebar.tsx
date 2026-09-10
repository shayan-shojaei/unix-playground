import type { LessonInstance, TrackMeta } from './types';

interface CurriculumSidebarProps {
  tracks: TrackMeta[];
  lessons: LessonInstance[];
  completed: Set<string>;
  currentId: string;
}

function groupByConcept(lessons: LessonInstance[]): { concept: string; lessons: LessonInstance[] }[] {
  const groups: { concept: string; lessons: LessonInstance[] }[] = [];
  for (const lesson of lessons) {
    const last = groups[groups.length - 1];
    if (last && last.concept === lesson.concept) last.lessons.push(lesson);
    else groups.push({ concept: lesson.concept, lessons: [lesson] });
  }
  return groups;
}

export default function CurriculumSidebar({ tracks, lessons, completed, currentId }: CurriculumSidebarProps) {
  return (
    <nav className="curriculum">
      {tracks.map((track) => {
        const trackLessons = lessons.filter((l) => l.track === track.id);
        const done = trackLessons.filter((l) => completed.has(l.id)).length;
        return (
          <div className="curriculum-track" key={track.id}>
            <p className="curriculum-track-title">{track.title}</p>
            <p className="curriculum-track-count">
              {done}/{trackLessons.length}
            </p>
            {groupByConcept(trackLessons).map((group) => (
              <div className="curriculum-group" key={group.lessons[0].id}>
                <p className="curriculum-group-title">{group.concept}</p>
                <ul className="curriculum-list">
                  {group.lessons.map((lesson) => {
                    const status = completed.has(lesson.id) ? 'done' : lesson.id === currentId ? 'current' : 'upcoming';
                    return (
                      <li className={`curriculum-item curriculum-${status}`} key={lesson.id}>
                        <span className="curriculum-dot" aria-hidden="true" />
                        {lesson.title}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
