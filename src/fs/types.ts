export interface FileNode {
  type: 'file';
  content: string;
}

export interface DirNode {
  type: 'dir';
  children: Record<string, FsNode>;
}

export type FsNode = FileNode | DirNode;
export type Fs = DirNode;

export interface BgJob {
  id: number;
  cmd: string;
  ticksLeft: number;
  status: 'running' | 'stopped' | 'done';
}

export interface ShellState {
  fs: Fs;
  cwd: string[];
  history: string[];
  aliases: Record<string, string>;
  env: Record<string, string>;
  lastExitCode: number;
  bgJobs: BgJob[];
  nextJobId: number;
}

export function dir(children: Record<string, FsNode> = {}): DirNode {
  return { type: 'dir', children };
}

export function file(content: string): FileNode {
  return { type: 'file', content };
}
