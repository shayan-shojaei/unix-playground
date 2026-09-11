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

// A #lesson-id in the URL (a deep link, or a page reload) wins over stored
// progress's currentId — that's the whole point of putting it in the hash.
function initialProgress(courseId: CourseId, lessons: { id: string }[]): Progress {
  const stored = loadCourseProgress(courseId, lessons);
  const hashId = decodeURIComponent(window.location.hash.slice(1));
  if (hashId && lessons.some((l) => l.id === hashId)) return { ...stored, currentId: hashId };
  return stored;
}

export default function CourseSession({ courseId, onBack }: CourseSessionProps) {
  const course = COURSES.find((c) => c.id === courseId)!;
  const lessons = LESSONS_BY_COURSE[courseId];
  const [progress, setProgress] = useState(() => initialProgress(courseId, lessons));
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

  // No restrictions: any lesson in the sidebar (done, current, or upcoming)
  // is selectable directly, without touching completion state.
  const jumpTo = (id: string) => {
    setProgress((p) => persist({ ...p, currentId: id }));
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

  // Keep the URL's #lesson-id in sync so the current exercise is
  // bookmarkable/shareable — replaceState, not pushState, so jumping
  // between exercises doesn't spam the browser history.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.hash = encodeURIComponent(lesson.id);
    window.history.replaceState(null, '', url);
  }, [lesson.id]);

  return (
    <div className="page">
      <CurriculumSidebar course={course} lessons={lessons} completed={completedSet} currentId={lesson.id} onSelect={jumpTo} />
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
