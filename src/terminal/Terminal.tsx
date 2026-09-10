import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { highlight } from './highlight';
import { listDir } from '../fs/fsOps';
import { COMMANDS } from '../shell/commands';
import type { ShellState } from '../fs/types';
import type { ScrollbackLine } from '../lesson/useLessonSession';
import { promptFor } from '../lesson/useLessonSession';
import TerminalLine from './TerminalLine';

interface TerminalProps {
  state: ShellState;
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  scrollback: ScrollbackLine[];
  statusClass: string;
  preview: { stdout: string; stderr: string } | null;
  pure: boolean;
  completed: boolean;
  hasNext: boolean;
  onNext: () => void;
}

export default function Terminal({
  state,
  input,
  setInput,
  onSubmit,
  scrollback,
  statusClass,
  preview,
  pure,
  completed,
  hasNext,
  onNext,
}: TerminalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [historyPos, setHistoryPos] = useState<number | null>(null);
  const [reverseSearch, setReverseSearch] = useState<string | null>(null);

  const spans = useMemo(() => highlight(input), [input]);

  function syncScroll() {
    if (inputRef.current && overlayRef.current) overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (reverseSearch !== null) {
      if (e.key === 'Enter') {
        const match = [...state.history].reverse().find((h) => h.includes(reverseSearch));
        if (match) setInput(match);
        setReverseSearch(null);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setReverseSearch(null);
        e.preventDefault();
      }
      return;
    }

    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      setReverseSearch('');
      return;
    }
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      inputRef.current?.setSelectionRange(0, 0);
      return;
    }
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      const len = input.length;
      inputRef.current?.setSelectionRange(len, len);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const pos = historyPos === null ? state.history.length - 1 : Math.max(0, historyPos - 1);
      setHistoryPos(pos);
      setInput(state.history[pos] ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPos === null) return;
      const pos = historyPos + 1;
      if (pos >= state.history.length) {
        setHistoryPos(null);
        setInput('');
      } else {
        setHistoryPos(pos);
        setInput(state.history[pos]);
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const words = input.split(' ');
      const last = words[words.length - 1] ?? '';
      const candidates =
        words.length <= 1
          ? Object.keys(COMMANDS).filter((c) => c.startsWith(last))
          : (listDir(state.fs, state.cwd) ?? []).filter((n) => n.startsWith(last));
      if (candidates.length === 1) {
        words[words.length - 1] = candidates[0];
        setInput(words.join(' '));
      } else if (candidates.length > 1) {
        const prefix = commonPrefix(candidates);
        if (prefix.length > last.length) {
          words[words.length - 1] = prefix;
          setInput(words.join(' '));
        }
      }
      return;
    }
    if (e.key === 'Enter') {
      // Ctrl/Cmd+Enter advances regardless of what's typed; plain Enter always
      // runs the input as a command — even after completion — so solving a
      // lesson doesn't hijack Enter from someone still poking at the shell.
      if ((e.ctrlKey || e.metaKey) && completed && hasNext) {
        e.preventDefault();
        onNext();
        return;
      }
      setHistoryPos(null);
      onSubmit();
    }
  }

  return (
    <div className="terminal" onClick={() => inputRef.current?.focus()}>
      <div className="terminal-scrollback">
        {scrollback.map((line, i) => (
          <TerminalLine key={i} line={line} />
        ))}
      </div>

      <div className={`terminal-inputline status-${statusClass}`}>
        <span className="prompt">{reverseSearch !== null ? `(reverse-i-search)'${reverseSearch}':` : promptFor(state)}</span>
        <div className="input-wrap">
          <div className="overlay" ref={overlayRef} aria-hidden="true">
            {spans.map((s, i) => (
              <span key={i} className={s.className}>
                {s.text}
              </span>
            ))}
            <span className="caret-space">&nbsp;</span>
          </div>
          <input
            ref={inputRef}
            className="real-input"
            value={reverseSearch !== null ? reverseSearch : input}
            onChange={(e) => (reverseSearch !== null ? setReverseSearch(e.target.value) : setInput(e.target.value))}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            spellCheck={false}
            autoFocus
          />
        </div>
      </div>

      {(preview || !pure) && input.trim() !== '' && (
        <div className="preview-pane">
          {pure ? (
            preview && (preview.stdout || preview.stderr) ? (
              <pre className={preview.stderr ? 'preview-err' : 'preview-out'}>{preview.stderr || preview.stdout}</pre>
            ) : (
              <span className="preview-hint">…</span>
            )
          ) : (
            <span className="preview-hint">this changes files — press Enter to run</span>
          )}
        </div>
      )}
    </div>
  );
}

function commonPrefix(strs: string[]): string {
  let prefix = strs[0];
  for (const s of strs.slice(1)) {
    while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
