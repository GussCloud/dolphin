import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const ORCHESTRATION_HEAVY_JOB_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['orchestration', 'exec'],
    summary: 'Run a heavy command (build, full tests, e2e, packaging) through the host-wide queue',
    usage: 'dolphin orchestration exec [--max-wait-ms <n>] [--json] -- <command> [args...]',
    allowedFlags: [...GLOBAL_FLAGS, 'max-wait-ms'],
    trailingCommand: true,
    notes: [
      'Runs the command in the current directory once this host has a free slot for the repository (one at a time by default); waiting blocks without output.',
      'Prints the exit code, a short tail and the full log path; exits with the command code.',
      'No shell: pass `-- bash -c "a && b"` for compound commands.',
      'Exit 75: the queue stayed busy past --max-wait-ms (default 480000) and nothing ran; retry, in the background or with a longer timeout. From SSH or WSL terminals it is refused and nothing runs; run the command directly.',
      'A host without the queue runs the command directly with a warning.'
    ],
    examples: ['dolphin orchestration exec -- pnpm build']
  }
]
