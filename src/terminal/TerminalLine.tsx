import type { ScrollbackLine } from '../lesson/useLessonSession';

export default function TerminalLine({ line }: { line: ScrollbackLine }) {
  return (
    <div className="scrollback-entry">
      <div className="scrollback-cmd">
        <span className="prompt">{line.prompt}</span> {line.input}
      </div>
      {line.stdout && <pre className="scrollback-out">{line.stdout}</pre>}
      {line.stderr && <pre className="scrollback-err">{line.stderr}</pre>}
    </div>
  );
}
