import type { LessonInstance, CourseMeta } from './types';

interface CurriculumSidebarProps {
  course: CourseMeta;
  lessons: LessonInstance[];
  completed: Set<string>;
  currentId: string;
  onSelect: (id: string) => void;
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

export default function CurriculumSidebar({ course, lessons, completed, currentId, onSelect }: CurriculumSidebarProps) {
  const done = lessons.filter((l) => completed.has(l.id)).length;
  return (
    <nav className="curriculum">
      <div className="curriculum-course">
        <p className="curriculum-course-title">{course.title}</p>
        <p className="curriculum-course-count">
          {done}/{lessons.length}
        </p>
        {groupByConcept(lessons).map((group) => (
          <div className="curriculum-group" key={group.lessons[0].id}>
            <p className="curriculum-group-title">{group.concept}</p>
            <ul className="curriculum-list">
              {group.lessons.map((lesson) => {
                const status = completed.has(lesson.id) ? 'done' : lesson.id === currentId ? 'current' : 'upcoming';
                return (
                  <li className={`curriculum-item curriculum-${status}`} key={lesson.id}>
                    <button type="button" className="curriculum-item-button" onClick={() => onSelect(lesson.id)}>
                      <span className="curriculum-dot" aria-hidden="true" />
                      {lesson.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
