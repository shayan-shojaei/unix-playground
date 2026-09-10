import type { Fs, FsNode, DirNode } from './types';

export function normalizeSegments(cwd: string[], arg: string): string[] {
  const parts = arg.split('/');
  let segs = arg.startsWith('/') ? [] : [...cwd];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') segs = segs.slice(0, -1);
    else segs.push(part);
  }
  return segs;
}

export function getNode(fs: Fs, segs: string[]): FsNode | null {
  let node: FsNode = fs;
  for (const seg of segs) {
    if (node.type !== 'dir') return null;
    const next: FsNode | undefined = node.children[seg];
    if (!next) return null;
    node = next;
  }
  return node;
}

export function getDir(fs: Fs, segs: string[]): DirNode | null {
  const node = getNode(fs, segs);
  return node && node.type === 'dir' ? node : null;
}

export function listDir(fs: Fs, segs: string[]): string[] | null {
  const node = getDir(fs, segs);
  return node ? Object.keys(node.children).sort() : null;
}

export function pathString(segs: string[]): string {
  return '/' + segs.join('/');
}

// Immutable set: returns a new Fs tree with node at segs replaced/created by updater(existingNode | undefined).
export function setNode(
  fs: Fs,
  segs: string[],
  updater: (existing: FsNode | undefined) => FsNode,
): Fs {
  if (segs.length === 0) {
    const updated = updater(fs);
    if (updated.type !== 'dir') throw new Error('cannot replace root with a file');
    return updated;
  }
  const [head, ...rest] = segs;
  const child = fs.children[head];
  if (rest.length === 0) {
    return { ...fs, children: { ...fs.children, [head]: updater(child) } };
  }
  const childDir: DirNode = child && child.type === 'dir' ? child : { type: 'dir', children: {} };
  return { ...fs, children: { ...fs.children, [head]: setNode(childDir, rest, updater) } };
}

export function removeNode(fs: Fs, segs: string[]): Fs {
  if (segs.length === 0) return fs;
  const [head, ...rest] = segs;
  const child = fs.children[head];
  if (!child) return fs;
  if (rest.length === 0) {
    const { [head]: _removed, ...remaining } = fs.children;
    return { ...fs, children: remaining };
  }
  if (child.type !== 'dir') return fs;
  return { ...fs, children: { ...fs.children, [head]: removeNode(child, rest) } };
}

// Glob: '*' -> any run of chars, '?' -> single char. No path-segment awareness needed (single-segment globs only).
export function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export function expandGlob(fs: Fs, cwd: string[], pattern: string): string[] {
  if (!/[*?]/.test(pattern)) return [pattern];
  const names = listDir(fs, cwd) ?? [];
  const re = globToRegex(pattern);
  const matches = names.filter((n) => re.test(n));
  return matches.length > 0 ? matches : [pattern];
}
