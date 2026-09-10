import type { ShellState } from '../fs/types';
import { getNode, listDir, normalizeSegments, expandGlob } from '../fs/fsOps';

export interface CmdResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  stateUpdate?: Partial<ShellState>;
}

export interface CmdCtx {
  state: ShellState;
  args: string[];
  stdin: string;
}

export interface CmdSpec {
  pure: boolean; // false => mutates fs/state; gates live speculative preview
  run: (ctx: CmdCtx) => CmdResult;
}

function ok(stdout: string, stateUpdate?: Partial<ShellState>): CmdResult {
  return { stdout, stderr: '', exitCode: 0, stateUpdate };
}

function err(stderr: string, exitCode = 1): CmdResult {
  return { stdout: '', stderr, exitCode };
}

function readInputOrFile(ctx: CmdCtx, fileArg?: string): string | null {
  if (fileArg) {
    const segs = normalizeSegments(ctx.state.cwd, expandGlob(ctx.state.fs, ctx.state.cwd, fileArg)[0]);
    const node = getNode(ctx.state.fs, segs);
    if (!node || node.type !== 'file') return null;
    return node.content;
  }
  return ctx.stdin;
}

function splitFlags(args: string[]): { flags: Set<string>; positional: string[] } {
  const flags = new Set<string>();
  const positional: string[] = [];
  for (const a of args) {
    if (a.startsWith('-') && a.length > 1) flags.add(a);
    else positional.push(a);
  }
  return { flags, positional };
}

const linesOf = (s: string) => (s === '' ? [] : s.split('\n'));

export const COMMANDS: Record<string, CmdSpec> = {
  echo: {
    pure: true,
    run: (ctx) => ok(ctx.args.join(' ')),
  },

  cat: {
    pure: true,
    run: (ctx) => {
      if (ctx.args.length === 0) return ok(ctx.stdin);
      const contents = ctx.args.map((a) => {
        const segs = normalizeSegments(ctx.state.cwd, a);
        const node = getNode(ctx.state.fs, segs);
        return node && node.type === 'file' ? node.content : `cat: ${a}: No such file`;
      });
      return ok(contents.join('\n'));
    },
  },

  head: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const nFlag = [...flags].find((f) => f.startsWith('-n'));
      const count = nFlag ? parseInt(nFlag.slice(2), 10) || 10 : 10;
      const text = readInputOrFile(ctx, positional[0]);
      if (text === null) return err(`head: ${positional[0]}: No such file`);
      return ok(linesOf(text).slice(0, count).join('\n'));
    },
  },

  tail: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const nFlag = [...flags].find((f) => f.startsWith('-n'));
      const count = nFlag ? parseInt(nFlag.slice(2), 10) || 10 : 10;
      const text = readInputOrFile(ctx, positional[0]);
      if (text === null) return err(`tail: ${positional[0]}: No such file`);
      const all = linesOf(text);
      return ok(all.slice(Math.max(0, all.length - count)).join('\n'));
    },
  },

  wc: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const text = readInputOrFile(ctx, positional[0]);
      if (text === null) return err(`wc: ${positional[0]}: No such file`);
      const lines = text === '' ? 0 : linesOf(text).length;
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      const chars = text.length;
      if (flags.has('-l')) return ok(String(lines));
      if (flags.has('-w')) return ok(String(words));
      if (flags.has('-c')) return ok(String(chars));
      return ok(`${lines} ${words} ${chars}`);
    },
  },

  grep: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const pattern = positional[0] ?? '';
      const text = readInputOrFile(ctx, positional[1]);
      if (text === null) return err(`grep: ${positional[1]}: No such file`);
      let re: RegExp;
      try {
        re = new RegExp(pattern, flags.has('-i') ? 'i' : '');
      } catch {
        return err(`grep: invalid pattern`);
      }
      const matched = linesOf(text)
        .map((line, idx) => ({ line, idx }))
        .filter(({ line }) => (flags.has('-v') ? !re.test(line) : re.test(line)));
      if (flags.has('-c')) return ok(String(matched.length));
      const out = matched.map(({ line, idx }) => (flags.has('-n') ? `${idx + 1}:${line}` : line));
      return ok(out.join('\n'));
    },
  },

  sed: {
    pure: true,
    run: (ctx) => {
      const { positional } = splitFlags(ctx.args);
      const expr = positional[0] ?? '';
      const text = readInputOrFile(ctx, positional[1]);
      if (text === null) return err(`sed: ${positional[1]}: No such file`);
      const m = expr.match(/^s\/(.*)\/(.*)\/(g)?$/);
      if (!m) return err(`sed: unsupported expression (only s/pattern/replacement/[g] is supported)`);
      const [, pattern, replacement, global] = m;
      let re: RegExp;
      try {
        re = new RegExp(pattern, global ? 'g' : '');
      } catch {
        return err(`sed: invalid pattern`);
      }
      const out = linesOf(text).map((line) => line.replace(re, replacement));
      return ok(out.join('\n'));
    },
  },

  awk: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const fsFlag = [...flags].find((f) => f.startsWith('-F'));
      const sep = fsFlag ? fsFlag.slice(2) || ' ' : /\s+/;
      const script = positional.find((p) => p.startsWith('{')) ?? positional[positional.length - 1] ?? '';
      const fileArg = positional.find((p) => !p.startsWith('{'));
      const text = readInputOrFile(ctx, fileArg);
      if (text === null) return err(`awk: ${fileArg}: No such file`);
      const m = script.match(/^\{\s*print\s+(.*)\s*\}$/);
      if (!m) return err(`awk: only '{print $N}' style scripts are supported`);
      const fieldExprs = m[1].split(',').map((s) => s.trim());
      const out = linesOf(text).map((line) => {
        const fields = line.split(sep);
        return fieldExprs
          .map((expr) => {
            if (expr === '$0') return line;
            const idx = parseInt(expr.replace('$', ''), 10);
            return fields[idx - 1] ?? '';
          })
          .join(' ');
      });
      return ok(out.join('\n'));
    },
  },

  sort: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const text = readInputOrFile(ctx, positional[0]);
      if (text === null) return err(`sort: ${positional[0]}: No such file`);
      let lines = linesOf(text);
      if (flags.has('-n')) lines = [...lines].sort((a, b) => parseFloat(a) - parseFloat(b));
      else lines = [...lines].sort((a, b) => a.localeCompare(b));
      if (flags.has('-r')) lines.reverse();
      if (flags.has('-u')) lines = [...new Set(lines)];
      return ok(lines.join('\n'));
    },
  },

  uniq: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const text = readInputOrFile(ctx, positional[0]);
      if (text === null) return err(`uniq: ${positional[0]}: No such file`);
      const lines = linesOf(text);
      const out: { line: string; count: number }[] = [];
      for (const line of lines) {
        const last = out[out.length - 1];
        if (last && last.line === line) last.count++;
        else out.push({ line, count: 1 });
      }
      return ok(out.map((o) => (flags.has('-c') ? `${o.count} ${o.line}` : o.line)).join('\n'));
    },
  },

  cut: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const dFlag = [...flags].find((f) => f.startsWith('-d'));
      const fFlag = [...flags].find((f) => f.startsWith('-f'));
      const delim = dFlag ? dFlag.slice(2) : '\t';
      const fieldNum = fFlag ? parseInt(fFlag.slice(2), 10) : 1;
      const text = readInputOrFile(ctx, positional[0]);
      if (text === null) return err(`cut: ${positional[0]}: No such file`);
      const out = linesOf(text).map((line) => line.split(delim)[fieldNum - 1] ?? '');
      return ok(out.join('\n'));
    },
  },

  tr: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const [from, to] = positional;
      const text = ctx.stdin;
      if (flags.has('-d')) {
        const re = new RegExp(`[${from}]`, 'g');
        return ok(text.replace(re, ''));
      }
      if (!from || !to) return err('tr: usage: tr <from> <to>');
      let out = text;
      for (let i = 0; i < from.length; i++) out = out.split(from[i]).join(to[i] ?? to[to.length - 1]);
      return ok(out);
    },
  },

  xargs: {
    pure: true,
    run: (ctx) => {
      const tokens = ctx.stdin.split(/\s+/).filter(Boolean);
      const [cmdName, ...cmdArgs] = ctx.args.length > 0 ? ctx.args : ['echo'];
      const spec = COMMANDS[cmdName];
      if (!spec) return err(`xargs: ${cmdName}: command not found`);
      const outputs = tokens.map((t) => spec.run({ state: ctx.state, args: [...cmdArgs, t], stdin: '' }).stdout);
      return ok(outputs.join('\n'));
    },
  },

  alias: {
    pure: false,
    run: (ctx) => {
      if (ctx.args.length === 0) {
        const list = Object.entries(ctx.state.aliases).map(([k, v]) => `alias ${k}='${v}'`);
        return ok(list.join('\n'));
      }
      const joined = ctx.args.join(' ');
      const m = joined.match(/^(\w+)=(.*)$/);
      if (!m) return err('alias: usage: alias name=command');
      const [, name, value] = m;
      const unquoted = value.replace(/^['"]|['"]$/g, '');
      return ok('', { aliases: { ...ctx.state.aliases, [name]: unquoted } });
    },
  },

  history: {
    pure: true,
    run: (ctx) => ok(ctx.state.history.map((h, i) => `${i + 1}  ${h}`).join('\n')),
  },

  sleep: {
    pure: false,
    run: (ctx) => {
      const secs = parseInt(ctx.args[0], 10) || 3;
      // Foreground sleep in a synchronous fake shell "completes" instantly;
      // real waiting only happens when backgrounded (see execute.ts background handling).
      return ok(`slept ${secs}s`);
    },
  },

  jobs: {
    pure: true,
    run: (ctx) => {
      const list = ctx.state.bgJobs.map(
        (j) => `[${j.id}] ${j.status === 'running' ? 'Running' : j.status === 'stopped' ? 'Stopped' : 'Done'}    ${j.cmd}`,
      );
      return ok(list.join('\n'));
    },
  },

  fg: {
    pure: false,
    run: (ctx) => {
      const id = parseInt((ctx.args[0] ?? '').replace('%', ''), 10) || ctx.state.bgJobs[ctx.state.bgJobs.length - 1]?.id;
      const job = ctx.state.bgJobs.find((j) => j.id === id);
      if (!job) return err('fg: no such job');
      // Bringing to foreground fast-forwards it to completion (we have no real async work to wait on).
      const bgJobs = ctx.state.bgJobs.map((j) => (j.id === id ? { ...j, status: 'done' as const, ticksLeft: 0 } : j));
      return ok(`${job.cmd}\n[${id}]+ Done    ${job.cmd}`, { bgJobs });
    },
  },

  bg: {
    pure: false,
    run: (ctx) => {
      const id = parseInt((ctx.args[0] ?? '').replace('%', ''), 10) || ctx.state.bgJobs[ctx.state.bgJobs.length - 1]?.id;
      const job = ctx.state.bgJobs.find((j) => j.id === id);
      if (!job) return err('bg: no such job');
      const bgJobs = ctx.state.bgJobs.map((j) => (j.id === id ? { ...j, status: 'running' as const } : j));
      return ok(`[${id}]+ ${job.cmd} &`, { bgJobs });
    },
  },

  ls: {
    pure: true,
    run: (ctx) => {
      const target = ctx.args[0];
      const segs = normalizeSegments(ctx.state.cwd, target ?? '.');
      const names = listDir(ctx.state.fs, segs);
      if (names === null) return err(`ls: ${target ?? '.'}: No such directory`);
      return ok(names.join('  '));
    },
  },

  pwd: {
    pure: true,
    run: (ctx) => ok('/' + ctx.state.cwd.join('/')),
  },
};
