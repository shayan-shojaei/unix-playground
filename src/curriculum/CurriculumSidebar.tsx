import type { Lesson, TrackMeta } from './types';

interface CurriculumSidebarProps {
  tracks: TrackMeta[];
  lessons: Lesson[];
  completed: Set<string>;
  currentId: string;
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
            <ul className="curriculum-list">
              {trackLessons.map((lesson) => {
                const status = completed.has(lesson.id) ? 'done' : lesson.id === currentId ? 'current' : 'upcoming';
                return (
                  <li className={`curriculum-item curriculum-${status}`} key={lesson.id}>
                    <span className="curriculum-dot" aria-hidden="true" />
                    {lesson.concept}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
