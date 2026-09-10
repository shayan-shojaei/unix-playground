import { dir, file, type Fs, type FsNode } from '../fs/types';
import type { FsSpec } from './types';

export function fromFsSpec(spec: FsSpec): Fs {
  const children: Record<string, FsNode> = {};
  for (const [name, entry] of Object.entries(spec)) {
    children[name] = 'content' in entry ? file(entry.content) : fromFsSpec(entry.children);
  }
  return dir(children);
}
