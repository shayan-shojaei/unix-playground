import type { Lesson } from './types';
import { dir, file } from '../fs/types';
import { matchOutput, matchState } from './checkHelpers';

const sharedFs = () =>
  dir({
    'report.txt': file('quarterly numbers'),
    'report.csv': file('quarterly numbers csv'),
    'notes.md': file('meeting notes'),
    'build.sh': file('#!/bin/sh\necho building'),
  });

export const track2: Lesson[] = [
  {
    id: 't2-intro',
    track: 2,
    title: 'Shell power-ups',
    briefing:
      "Track 2 assumes you already know cd, ls, pwd, mkdir, mv, cp, rm, cat, and the pipes/text-tools from Track 1. This track is about working faster: aliases, globbing, job control, and keyboard shortcuts. Let's start with globbing — list every file ending in .txt using a wildcard.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ["'*' matches any run of characters", 'Try: ls *.txt'],
    check: matchOutput('report.txt'),
  },
  {
    id: 't2-alias',
    track: 2,
    title: 'Define an alias',
    briefing: "alias name=command creates a shortcut. Define an alias called 'll' for 'ls'.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ["alias <name>=<command>", "Try: alias ll=ls"],
    check: matchState(({ state }) => state.aliases['ll'] === 'ls'),
  },
  {
    id: 't2-history',
    track: 2,
    title: 'Reuse history',
    briefing: "The history command lists everything you've run. Run 'history' now to see your session so far.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ['Just run: history'],
    check: ({ rawInput, parsed }) => {
      if (rawInput.trim() === '') return { status: 'empty' };
      if (parsed && parsed.stages[0]?.name === 'history') return { status: 'correct' };
      return { status: 'typing' };
    },
  },
  {
    id: 't2-background',
    track: 2,
    title: 'Background a job',
    briefing:
      "Appending & runs a command in the background and immediately gives you back the prompt. Start 'sleep 5' in the background.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ['Add & after the command', 'Try: sleep 5 &'],
    check: matchState(({ state }) => state.bgJobs.length > 0),
  },
  {
    id: 't2-jobs',
    track: 2,
    title: 'Check on background jobs',
    briefing: "jobs lists everything running in the background. Run it now.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ['Just run: jobs'],
    check: ({ rawInput, parsed }) => {
      if (rawInput.trim() === '') return { status: 'empty' };
      if (parsed && parsed.stages[0]?.name === 'jobs') return { status: 'correct' };
      return { status: 'typing' };
    },
  },
  {
    id: 't2-fg',
    track: 2,
    title: 'Bring a job to the foreground',
    briefing:
      "fg %<id> brings a background job to the foreground and waits for it to finish. Start a job with 'sleep 5 &', then bring it back with 'fg %1'.",
    startFs: sharedFs(),
    startCwd: [],
    hints: ['First: sleep 5 &', 'Then: fg %1'],
    check: matchState(({ state }) => state.bgJobs.some((j) => j.status === 'done')),
  },
];
