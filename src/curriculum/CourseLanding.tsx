import { COURSES, type CourseId } from './types';
import { LESSONS_BY_COURSE } from './loadCurriculum';
import { loadAllProgress } from './progress';

interface CourseLandingProps {
  onSelect: (id: CourseId) => void;
}

export default function CourseLanding({ onSelect }: CourseLandingProps) {
  const allProgress = loadAllProgress();
  return (
    <div className="landing">
      <h1 className="landing-title">What do you want to learn today?</h1>
      <div className="landing-grid">
        {COURSES.map((course) => {
          const total = LESSONS_BY_COURSE[course.id].length;
          const done = allProgress[course.id]?.completed.length ?? 0;
          return (
            <button key={course.id} className="landing-card" onClick={() => onSelect(course.id)}>
              <p className="landing-card-title">{course.title}</p>
              <p className="landing-card-desc">{course.description}</p>
              <p className="landing-card-progress">
                {done}/{total} complete
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
