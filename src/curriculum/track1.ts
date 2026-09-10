import type { Lesson } from './types';
import { dir, file } from '../fs/types';
import { matchOutput } from './checkHelpers';

const sharedFs = () =>
  dir({
    'access.log': file(
      [
        '200 GET /home',
        '404 GET /missing',
        '200 GET /about',
        '500 GET /api/users',
        '200 GET /home',
        '404 GET /old-page',
      ].join('\n'),
    ),
    'users.csv': file(['id,name,role', '1,ada,admin', '2,grace,user', '3,alan,admin'].join('\n')),
  });

export const track1: Lesson[] = [
  {
    id: 't1-grep',
    track: 1,
    title: 'Filter lines with grep',
    briefing:
      "This track assumes you're already comfortable with cd, ls, pwd, mkdir, mv, cp, rm, cat — we're building on top of that. First up: grep filters lines matching a pattern. Print every line in access.log containing '404'.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ["Use grep 'pattern' file", "Try: grep 404 access.log"],
    check: matchOutput('404 GET /missing\n404 GET /old-page'),
  },
  {
    id: 't1-pipe-wc',
    track: 1,
    title: 'Pipe into wc',
    briefing:
      "Pipes (|) send one command's output into the next command's input. Count how many lines contain '200' using grep piped into wc -l.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ['grep produces lines, wc -l counts them', 'Try: grep 200 access.log | wc -l'],
    check: matchOutput('3'),
  },
  {
    id: 't1-sort-uniq',
    track: 1,
    title: 'sort + uniq -c',
    briefing:
      "uniq only collapses ADJACENT duplicate lines, so you sort first. Extract just the status codes (first field) from access.log, then find how many times each status appears, sorted with counts.",
    startFs: sharedFs(),
    startCwd: [],
    hints: [
      "awk '{print $1}' pulls the first field",
      'Try: awk \'{print $1}\' access.log | sort | uniq -c',
    ],
    check: matchOutput('3 200\n2 404\n1 500'),
  },
  {
    id: 't1-sed',
    track: 1,
    title: 'sed substitution',
    briefing: "sed 's/pattern/replacement/' rewrites matching text. Replace every '200' with 'OK' in access.log.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ["sed 's/from/to/g' replaces every occurrence", "Try: sed 's/200/OK/g' access.log"],
    check: matchOutput(
      ['OK GET /home', '404 GET /missing', 'OK GET /about', '500 GET /api/users', 'OK GET /home', '404 GET /old-page'].join(
        '\n',
      ),
    ),
  },
  {
    id: 't1-cut',
    track: 1,
    title: 'cut a CSV field',
    briefing: "cut -d',' -f2 pulls the 2nd comma-separated field from every line. Print just the names from users.csv.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ["cut -d'<delimiter>' -f<field number>", "Try: cut -d',' -f2 users.csv"],
    check: matchOutput('name\nada\ngrace\nalan'),
  },
  {
    id: 't1-redirect',
    track: 1,
    title: 'Redirect output to a file',
    briefing:
      "> writes a command's output into a file (overwriting it), >> appends. Save every admin row from users.csv into a new file called admins.csv.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ['grep admin users.csv > admins.csv', 'Redirects are impure — this one runs on Enter, not live-previewed'],
    check: ({ rawInput, state }) => {
      if (rawInput.trim() === '') return { status: 'empty' };
      const node = state.fs.children['admins.csv'];
      if (node && node.type === 'file' && node.content.includes('admin')) return { status: 'correct' };
      return { status: 'typing' };
    },
  },
];
