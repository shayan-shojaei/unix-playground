import { useEffect, useState } from 'react';
import { COURSES, type CourseId } from './types';
import { LESSONS_BY_COURSE } from './loadCurriculum';
import { loadAllProgress, saveAllProgress, type Progress } from './progress';
import { useLessonSession } from '../lesson/useLessonSession';
import Terminal from '../terminal/Terminal';
import LessonPanel from '../lesson/LessonPanel';
import GuidePanel from '../lesson/GuidePanel';
import CurriculumSidebar from './CurriculumSidebar';

interface CourseSessionProps {
  courseId: CourseId;
  onBack: () => void;
}

function loadCourseProgress(courseId: CourseId, lessons: { id: string }[]): Progress {
  const all = loadAllProgress();
  const existing = all[courseId];
  if (existing && Array.isArray(existing.completed) && lessons.some((l) => l.id === existing.currentId)) return existing;
  return { completed: [], currentId: lessons[0].id };
}

export default function CourseSession({ courseId, onBack }: CourseSessionProps) {
  const course = COURSES.find((c) => c.id === courseId)!;
  const lessons = LESSONS_BY_COURSE[courseId];
  const [progress, setProgress] = useState(() => loadCourseProgress(courseId, lessons));
  const lessonIdx = lessons.findIndex((l) => l.id === progress.currentId);
  const lesson = lessons[lessonIdx];
  const completedSet = new Set(progress.completed);

  const persist = (next: Progress) => {
    const all = loadAllProgress();
    saveAllProgress({ ...all, [courseId]: next });
    return next;
  };

  const advance = () => {
    setProgress((p) =>
      persist({
        completed: p.completed.includes(lesson.id) ? p.completed : [...p.completed, lesson.id],
        currentId: lessons[Math.min(lessonIdx + 1, lessons.length - 1)].id,
      }),
    );
  };

  const {
    state,
    input,
    setInput,
    scrollback,
    submit,
    criteria,
    statusClass,
    statusMessage,
    completed,
    hintIndex,
    pure,
    preview,
  } = useLessonSession(lesson);

  // Record completion the moment criteria pass, not just when the user moves
  // on — the last lesson in a course has no "next" button/Enter-advance to
  // hang this off of, so it would otherwise never make it into `completed`.
  useEffect(() => {
    if (!completed) return;
    setProgress((p) => {
      if (p.completed.includes(lesson.id)) return p;
      const next = { ...p, completed: [...p.completed, lesson.id] };
      const all = loadAllProgress();
      saveAllProgress({ ...all, [courseId]: next });
      return next;
    });
  }, [completed, lesson.id, courseId]);

  return (
    <div className="page">
      <CurriculumSidebar course={course} lessons={lessons} completed={completedSet} currentId={lesson.id} />
      <div className="session">
        <div className="session-titlebar">
          <button className="back-btn" onClick={onBack}>
            ← courses
          </button>
          <span className="session-path">~/unix-playground</span>
          <span className="session-progress">
            {course.title} · lesson {lessonIdx + 1}/{lessons.length}
          </span>
        </div>

        <LessonPanel
          lesson={lesson}
          criteria={criteria}
          statusMessage={statusMessage}
          completed={completed}
          hintIndex={hintIndex}
          hasNext={lessonIdx < lessons.length - 1}
          onNext={advance}
          preview={preview}
        />
        <Terminal
          state={state}
          input={input}
          setInput={setInput}
          onSubmit={submit}
          scrollback={scrollback}
          statusClass={statusClass}
          preview={preview}
          pure={pure}
          completed={completed}
          hasNext={lessonIdx < lessons.length - 1}
          onNext={advance}
        />
      </div>
      <GuidePanel guide={lesson.guide} />
    </div>
  );
}
