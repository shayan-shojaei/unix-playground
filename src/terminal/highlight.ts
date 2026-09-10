import { tokenize } from '../shell/tokenize';
import { COMMANDS } from '../shell/commands';

export interface HighlightSpan {
  text: string;
  className: string;
}

// Re-tokenizes the raw string (cheap: single lines) and maps each piece to a
// CSS class, preserving original spacing so rendered width matches the input exactly.
export function highlight(raw: string): HighlightSpan[] {
  const tokens = tokenize(raw);
  let cursor = 0;
  const spans: HighlightSpan[] = [];
  let firstWordSeen = false;

  for (const t of tokens) {
    const idx = raw.indexOf(t.value, cursor);
    const start = idx === -1 ? cursor : idx;
    if (start > cursor) spans.push({ text: raw.slice(cursor, start), className: 'tok-space' });

    let className = 'tok-word';
    if (t.type === 'pipe' || t.type === 'redirect' || t.type === 'append' || t.type === 'background') {
      className = 'tok-op';
      if (t.type === 'pipe') firstWordSeen = false;
    } else if (t.type === 'word') {
      if (!firstWordSeen) {
        className = COMMANDS[t.value] ? 'tok-cmd' : t.value === '' ? 'tok-word' : 'tok-unknown';
        firstWordSeen = true;
      } else if (t.value.startsWith('-')) {
        className = 'tok-flag';
      } else {
        className = 'tok-arg';
      }
    }
    spans.push({ text: t.value, className });
    cursor = start + t.value.length;
  }
  if (cursor < raw.length) spans.push({ text: raw.slice(cursor), className: 'tok-space' });
  return spans;
}
