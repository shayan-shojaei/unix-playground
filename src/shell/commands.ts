import type { ShellState, MediaMeta, FsNode } from '../fs/types';
import { getNode, listDir, normalizeSegments, expandGlob, setNode } from '../fs/fsOps';

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

// Turns a glob-style pattern (only '*' is special) into an anchored RegExp.
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('*')
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

function formatMediaSummary(meta: MediaMeta): string {
  const h = Math.floor(meta.durationSec / 3600);
  const m = Math.floor((meta.durationSec % 3600) / 60);
  const s = meta.durationSec % 60;
  const ts = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  return `${meta.codec}, ${meta.bitrateKbps}kbps${meta.resolution ? `, ${meta.resolution}` : ''}, ${ts}`;
}

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

  // Supports one or more -e expr (or a single bare expr with no -e), each either:
  //   s/pattern/replacement/[gi]   — substitute, optionally global and/or case-insensitive
  //   Nd or N,Md                   — delete line N (or range N..M)
  //   Np or N,Mp                   — mark line N (or range) for printing (paired with -n)
  sed: {
    pure: true,
    run: (ctx) => {
      const exprs: string[] = [];
      let suppressAuto = false;
      let file: string | undefined;
      let sawExplicitE = false;
      for (let i = 0; i < ctx.args.length; i++) {
        const a = ctx.args[i];
        if (a === '-n') suppressAuto = true;
        else if (a === '-e') {
          exprs.push(ctx.args[++i] ?? '');
          sawExplicitE = true;
        } else if (!sawExplicitE && exprs.length === 0) exprs.push(a);
        else file = a;
      }
      const text = readInputOrFile(ctx, file);
      if (text === null) return err(`sed: ${file}: No such file`);

      const records = linesOf(text).map((content, i) => ({ n: i + 1, content, keep: true, forcePrint: false }));

      for (const expr of exprs) {
        const sub = expr.match(/^s\/(.*)\/(.*)\/([gi]{0,2})$/);
        if (sub) {
          const [, pattern, replacement, flagsRaw] = sub;
          let re: RegExp;
          try {
            re = new RegExp(pattern, flagsRaw);
          } catch {
            return err(`sed: invalid pattern`);
          }
          for (const r of records) if (r.keep) r.content = r.content.replace(re, replacement);
          continue;
        }
        const del = expr.match(/^(\d+)(?:,(\d+))?d$/);
        if (del) {
          const start = parseInt(del[1], 10);
          const end = del[2] ? parseInt(del[2], 10) : start;
          for (const r of records) if (r.n >= start && r.n <= end) r.keep = false;
          continue;
        }
        const pr = expr.match(/^(\d+)(?:,(\d+))?p$/);
        if (pr) {
          const start = parseInt(pr[1], 10);
          const end = pr[2] ? parseInt(pr[2], 10) : start;
          for (const r of records) if (r.n >= start && r.n <= end) r.forcePrint = true;
          continue;
        }
        return err(`sed: unsupported expression: ${expr}`);
      }

      const out = records.filter((r) => r.keep && (!suppressAuto || r.forcePrint)).map((r) => r.content);
      return ok(out.join('\n'));
    },
  },

  // Supports {print ...} with $N/$0/NR/NF, an optional leading /regex/ pattern
  // gating the block, and an optional BEGIN{print "literal"} run once up front.
  awk: {
    pure: true,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const fsFlag = [...flags].find((f) => f.startsWith('-F'));
      const sep = fsFlag ? fsFlag.slice(2) || ' ' : /\s+/;
      const isScriptLike = (p: string) => p.startsWith('{') || p.startsWith('BEGIN') || p.startsWith('/');
      const script = positional.find(isScriptLike) ?? positional[positional.length - 1] ?? '';
      const fileArg = positional.find((p) => !isScriptLike(p));
      const text = readInputOrFile(ctx, fileArg);
      if (text === null) return err(`awk: ${fileArg}: No such file`);

      let rest = script;
      let beginText: string | undefined;
      const beginMatch = rest.match(/^BEGIN\s*\{\s*print\s+"((?:[^"\\]|\\.)*)"\s*\}\s*/);
      if (beginMatch) {
        beginText = beginMatch[1];
        rest = rest.slice(beginMatch[0].length);
      }

      let patternRe: RegExp | undefined;
      let mainBlock = rest;
      const patMatch = rest.match(/^\/(.*)\/\s*(\{.*\})$/);
      if (patMatch) {
        try {
          patternRe = new RegExp(patMatch[1]);
        } catch {
          return err('awk: invalid pattern');
        }
        mainBlock = patMatch[2];
      }

      const printMatch = mainBlock.match(/^\{\s*print\s+(.*)\s*\}$/);
      if (!beginText && !printMatch) {
        return err(`awk: only '{print $N}' style scripts are supported, optionally with a BEGIN block or a leading /regex/`);
      }

      const out: string[] = [];
      if (beginText !== undefined) out.push(beginText);

      if (printMatch) {
        const fieldExprs = printMatch[1].split(',').map((s) => s.trim());
        linesOf(text).forEach((line, idx) => {
          if (patternRe && !patternRe.test(line)) return;
          const fields = line.split(sep);
          out.push(
            fieldExprs
              .map((expr) => {
                if (expr === '$0') return line;
                if (expr === 'NR') return String(idx + 1);
                if (expr === 'NF') return String(fields.length);
                const idxNum = parseInt(expr.replace('$', ''), 10);
                return fields[idxNum - 1] ?? '';
              })
              .join(' '),
          );
        });
      }
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

  // Formatted output: %s and %d are substituted left-to-right from the
  // trailing args, and a literal \n in the format string becomes a newline.
  // Unlike real printf, the format string is NOT re-cycled over extra args.
  printf: {
    pure: true,
    run: (ctx) => {
      const [format, ...rest] = ctx.args;
      if (!format) return err('printf: usage: printf <format> [args...]');
      let argIdx = 0;
      const out = format.replace(/%s|%d|\\n/g, (m) => {
        if (m === '\\n') return '\n';
        const val = rest[argIdx++] ?? '';
        return m === '%d' ? String(parseInt(val, 10) || 0) : val;
      });
      return ok(out);
    },
  },

  // Simplified line-set diff: lines present in file1 but not file2 print as
  // "< line", lines present in file2 but not file1 print as "> line" — no
  // hunk headers, and (unlike real diff) exit code is always 0.
  diff: {
    pure: true,
    run: (ctx) => {
      const { positional } = splitFlags(ctx.args);
      const [fileA, fileB] = positional;
      const textA = readInputOrFile(ctx, fileA);
      if (textA === null) return err(`diff: ${fileA}: No such file`);
      const textB = readInputOrFile(ctx, fileB);
      if (textB === null) return err(`diff: ${fileB}: No such file`);
      const linesA = linesOf(textA);
      const linesB = linesOf(textB);

      const remainingB = new Map<string, number>();
      for (const l of linesB) remainingB.set(l, (remainingB.get(l) ?? 0) + 1);
      const onlyA = linesA.filter((l) => {
        const c = remainingB.get(l) ?? 0;
        if (c > 0) {
          remainingB.set(l, c - 1);
          return false;
        }
        return true;
      });

      const remainingA = new Map<string, number>();
      for (const l of linesA) remainingA.set(l, (remainingA.get(l) ?? 0) + 1);
      const onlyB = linesB.filter((l) => {
        const c = remainingA.get(l) ?? 0;
        if (c > 0) {
          remainingA.set(l, c - 1);
          return false;
        }
        return true;
      });

      const out = [...onlyA.map((l) => `< ${l}`), ...onlyB.map((l) => `> ${l}`)];
      return ok(out.join('\n'));
    },
  },

  // Writes stdin to a file (appending with -a instead of overwriting) AND
  // passes it through unchanged as stdout, so it can sit mid-pipeline.
  tee: {
    pure: false,
    run: (ctx) => {
      const { flags, positional } = splitFlags(ctx.args);
      const target = positional[0];
      if (!target) return err('tee: usage: tee [-a] <file>');
      const segs = normalizeSegments(ctx.state.cwd, target);
      const text = ctx.stdin;
      const fs = setNode(ctx.state.fs, segs, (existing) => {
        const prior = flags.has('-a') && existing?.type === 'file' ? existing.content : '';
        const sep = prior && text ? '\n' : '';
        return { type: 'file', content: prior + sep + text };
      });
      return ok(text, { fs });
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

  // find [path] [-name pattern] [-type f|d] — recursively lists path's
  // contents (path itself included, like real find), optionally filtered.
  find: {
    pure: true,
    run: (ctx) => {
      let startPath: string | undefined;
      let namePattern: string | undefined;
      let typeFilter: string | undefined;
      for (let i = 0; i < ctx.args.length; i++) {
        const a = ctx.args[i];
        if (a === '-name') namePattern = ctx.args[++i];
        else if (a === '-type') typeFilter = ctx.args[++i];
        else if (!a.startsWith('-')) startPath = a;
      }
      const base = startPath ?? '.';
      const startNode = getNode(ctx.state.fs, normalizeSegments(ctx.state.cwd, base));
      if (!startNode) return err(`find: ${base}: No such file or directory`);
      const nameRe = namePattern ? globToRegExp(namePattern) : undefined;

      const matches = (node: FsNode, name: string) => {
        const nameOk = !nameRe || nameRe.test(name);
        const typeOk = !typeFilter || (typeFilter === 'f' ? node.type === 'file' : typeFilter === 'd' ? node.type === 'dir' : true);
        return nameOk && typeOk;
      };

      const results: string[] = [];
      const walk = (node: FsNode, path: string, name: string) => {
        if (matches(node, name)) results.push(path);
        if (node.type === 'dir') {
          for (const key of Object.keys(node.children).sort()) walk(node.children[key], `${path}/${key}`, key);
        }
      };
      walk(startNode, base, base.split('/').pop() ?? base);
      return ok(results.join('\n'));
    },
  },

  ffmpeg: {
    pure: false,
    run: (ctx) => {
      // Fixed pattern: ffmpeg -i <input> [-b:a <N>k] [-vf scale=<W>:<H>] [-ss <sec>] [-t <sec>] <output>
      let input: string | undefined;
      let output: string | undefined;
      let bitrateKbps: number | undefined;
      let resolution: string | undefined;
      let startSec: number | undefined;
      let clipSec: number | undefined;
      for (let i = 0; i < ctx.args.length; i++) {
        const a = ctx.args[i];
        if (a === '-i') input = ctx.args[++i];
        else if (a === '-b:a') bitrateKbps = parseInt(ctx.args[++i] ?? '', 10) || undefined;
        else if (a === '-ss') startSec = parseInt(ctx.args[++i] ?? '', 10) || undefined;
        else if (a === '-t') clipSec = parseInt(ctx.args[++i] ?? '', 10) || undefined;
        else if (a === '-vf') {
          const m = (ctx.args[++i] ?? '').match(/^scale=(\d+):(\d+)$/);
          if (m) resolution = `${m[1]}x${m[2]}`;
        } else if (!a.startsWith('-')) output = a;
      }
      if (!input) return err('ffmpeg: missing -i input file');
      if (!output) return err('ffmpeg: missing output file');

      const inNode = getNode(ctx.state.fs, normalizeSegments(ctx.state.cwd, input));
      if (!inNode || inNode.type !== 'file' || !inNode.meta) return err(`ffmpeg: ${input}: not a media file`);

      const codecByExt: Record<string, { codec: string; kind: MediaMeta['kind'] }> = {
        mp3: { codec: 'mp3', kind: 'audio' },
        wav: { codec: 'pcm', kind: 'audio' },
        aac: { codec: 'aac', kind: 'audio' },
        mp4: { codec: 'h264', kind: 'video' },
        mov: { codec: 'h264', kind: 'video' },
        webm: { codec: 'vp9', kind: 'video' },
      };
      const ext = output.slice(output.lastIndexOf('.') + 1).toLowerCase();
      const target = codecByExt[ext];
      if (!target) return err(`ffmpeg: unsupported output format: .${ext}`);

      const afterStart = Math.max(0, inNode.meta.durationSec - (startSec ?? 0));
      const durationSec = clipSec !== undefined ? Math.min(clipSec, afterStart) : afterStart;

      const meta: MediaMeta = {
        kind: target.kind,
        durationSec,
        codec: target.codec,
        bitrateKbps: bitrateKbps ?? inNode.meta.bitrateKbps,
        resolution: target.kind === 'video' ? (resolution ?? inNode.meta.resolution) : undefined,
      };
      const summary = formatMediaSummary(meta);

      const fs = setNode(ctx.state.fs, normalizeSegments(ctx.state.cwd, output), () => ({
        type: 'file',
        content: summary,
        meta,
      }));
      return ok(`ffmpeg: wrote ${output} (${summary})`, { fs });
    },
  },

  // ffprobe <file> — prints the same summary line ffmpeg computes, read
  // directly off the file's media metadata (works on source files too).
  ffprobe: {
    pure: true,
    run: (ctx) => {
      const target = ctx.args[0];
      if (!target) return err('ffprobe: missing input file');
      const node = getNode(ctx.state.fs, normalizeSegments(ctx.state.cwd, target));
      if (!node || node.type !== 'file' || !node.meta) return err(`ffprobe: ${target}: not a media file`);
      return ok(formatMediaSummary(node.meta));
    },
  },
};
