import type { Lesson, CheckResult } from '../curriculum/types';

interface LessonPanelProps {
  lesson: Lesson;
  check: CheckResult;
  completed: boolean;
  hintIndex: number;
  onNext: () => void;
  hasNext: boolean;
}

export default function LessonPanel({ lesson, check, completed, hintIndex, onNext, hasNext }: LessonPanelProps) {
  return (
    <div className="brief">
      <p className="brief-line brief-title">
        <span className="gutter">#</span> {lesson.title}
      </p>
      {lesson.briefing.split(/(?<=[.!?])\s+(?=[A-Z])/).map((sentence, i) => (
        <p className="brief-line" key={i}>
          <span className="gutter">#</span> {sentence}
        </p>
      ))}

      {hintIndex >= 0 &&
        lesson.hints.slice(0, hintIndex + 1).map((h, i) => (
          <p className="brief-line brief-hint" key={i}>
            <span className="gutter">#</span> hint: {h}
          </p>
        ))}

      {check.message && !completed && (
        <p className="brief-line brief-warn">
          <span className="gutter">#</span> {check.message}
        </p>
      )}

      {completed && (
        <p className="brief-line brief-done">
          <span className="gutter">#</span> ✓ correct.{' '}
          {hasNext ? (
            <button className="next-btn" onClick={onNext}>
              next lesson →<span className="next-key">enter</span>
            </button>
          ) : (
            'track complete 🎉'
          )}
        </p>
      )}
    </div>
  );
}
