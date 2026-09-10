import { useState } from 'react';
import { track1 } from './curriculum/track1';
import { track2 } from './curriculum/track2';
import { useLessonSession } from './lesson/useLessonSession';
import Terminal from './terminal/Terminal';
import LessonPanel from './lesson/LessonPanel';
import './styles/terminal.css';

const ALL_LESSONS = [...track1, ...track2];
const PROGRESS_KEY = 'unix-playground:lessonIdx';

function loadProgress(): number {
  try {
    const raw = Number(localStorage.getItem(PROGRESS_KEY));
    return Number.isInteger(raw) && raw >= 0 && raw < ALL_LESSONS.length ? raw : 0;
  } catch {
    return 0;
  }
}

export default function App() {
  const [lessonIdx, setLessonIdxRaw] = useState(loadProgress);
  const setLessonIdx = (update: (i: number) => number) =>
    setLessonIdxRaw((i) => {
      const next = update(i);
      try {
        localStorage.setItem(PROGRESS_KEY, String(next));
      } catch {
        // ponytail: best-effort persistence, ignore storage failures (private mode, quota, etc.)
      }
      return next;
    });
  const lesson = ALL_LESSONS[lessonIdx];
  const { state, input, setInput, scrollback, submit, check, completed, hintIndex, pure, preview } =
    useLessonSession(lesson);

  const statusClass = completed ? 'correct' : check.status;

  return (
    <div className="page">
      <div className="session">
        <div className="session-titlebar">
          <span className="session-path">~/unix-playground</span>
          <span className="session-progress">
            track {lesson.track} · lesson {lessonIdx + 1}/{ALL_LESSONS.length}
          </span>
        </div>

        <LessonPanel
          lesson={lesson}
          check={check}
          completed={completed}
          hintIndex={hintIndex}
          hasNext={lessonIdx < ALL_LESSONS.length - 1}
          onNext={() => setLessonIdx((i) => Math.min(i + 1, ALL_LESSONS.length - 1))}
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
          hasNext={lessonIdx < ALL_LESSONS.length - 1}
          onNext={() => setLessonIdx((i) => Math.min(i + 1, ALL_LESSONS.length - 1))}
        />
      </div>
    </div>
  );
}
