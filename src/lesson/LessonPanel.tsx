import type { LessonInstance } from '../curriculum/types';
import type { CriterionResult } from './useLessonSession';

interface LessonPanelProps {
  lesson: LessonInstance;
  criteria: CriterionResult[];
  statusMessage?: string;
  completed: boolean;
  hintIndex: number;
  onNext: () => void;
  hasNext: boolean;
  preview: { stdout: string; stderr: string } | null;
}

export default function LessonPanel({
  lesson,
  criteria,
  statusMessage,
  completed,
  hintIndex,
  onNext,
  hasNext,
  preview,
}: LessonPanelProps) {
  return (
    <div className="brief">
      <p className="brief-line brief-title">
        <span className="gutter">#</span> {lesson.title}
      </p>
      <p className="brief-line">
        <span className="gutter">#</span> {lesson.task}
      </p>

      <ul className="criteria-list">
        {criteria.map((c) => (
          <li key={c.id} className={`criteria-item ${c.passed ? 'criteria-passed' : ''}`}>
            <span className="criteria-check" aria-hidden="true">
              {c.passed ? '✓' : '○'}
            </span>
            {c.label}
          </li>
        ))}
      </ul>

      {lesson.expectedOutput !== undefined && (
        <div className="diff-panel">
          <div className="diff-col">
            <p className="diff-label">your output</p>
            <pre className="diff-body">{preview ? preview.stdout || preview.stderr || ' ' : '…'}</pre>
          </div>
          <div className="diff-col">
            <p className="diff-label">expected output</p>
            <pre className="diff-body diff-expected">{lesson.expectedOutput}</pre>
          </div>
        </div>
      )}

      {hintIndex >= 0 &&
        lesson.hints.slice(0, hintIndex + 1).map((h, i) => (
          <p className="brief-line brief-hint" key={i}>
            <span className="gutter">#</span> hint: {h}
          </p>
        ))}

      {statusMessage && !completed && (
        <p className="brief-line brief-warn">
          <span className="gutter">#</span> {statusMessage}
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
