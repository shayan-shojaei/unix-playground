import { useState } from 'react';
import { track1 } from './curriculum/track1';
import { track2 } from './curriculum/track2';
import { TRACKS } from './curriculum/types';
import { useLessonSession } from './lesson/useLessonSession';
import Terminal from './terminal/Terminal';
import LessonPanel from './lesson/LessonPanel';
import CurriculumSidebar from './curriculum/CurriculumSidebar';
import './styles/terminal.css';

const ALL_LESSONS = [...track1, ...track2];
const PROGRESS_KEY = 'unix-playground:progress';

interface Progress {
  completed: string[];
  currentId: string;
}

function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as Progress | null;
    if (raw && Array.isArray(raw.completed) && ALL_LESSONS.some((l) => l.id === raw.currentId)) return raw;
  } catch {
    // ponytail: best-effort persistence, ignore storage failures (private mode, quota, etc.)
  }
  return { completed: [], currentId: ALL_LESSONS[0].id };
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // ponytail: best-effort persistence, ignore storage failures (private mode, quota, etc.)
  }
}

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const lessonIdx = ALL_LESSONS.findIndex((l) => l.id === progress.currentId);
  const lesson = ALL_LESSONS[lessonIdx];
  const completedSet = new Set(progress.completed);

  const advance = () => {
    setProgress((p) => {
      const next: Progress = {
        completed: p.completed.includes(lesson.id) ? p.completed : [...p.completed, lesson.id],
        currentId: ALL_LESSONS[Math.min(lessonIdx + 1, ALL_LESSONS.length - 1)].id,
      };
      saveProgress(next);
      return next;
    });
  };

  const { state, input, setInput, scrollback, submit, check, completed, hintIndex, pure, preview } =
    useLessonSession(lesson);

  const statusClass = completed ? 'correct' : check.status;

  return (
    <div className="page">
      <CurriculumSidebar tracks={TRACKS} lessons={ALL_LESSONS} completed={completedSet} currentId={lesson.id} />
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
          onNext={advance}
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
          onNext={advance}
        />
      </div>
    </div>
  );
}
