import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runProcess } from './child-process/run-process'
import { removeTreeSync } from './windows-transient-lock-removal'
import { buildAutonomousCoordinatorLaunchPrompt } from './autonomous-coordinator-prompt'
import { buildAgentStartupPlan } from './tui-agent-startup'
import { quoteStartupArg, type AgentStartupShell } from './tui-agent-startup-shell'

/**
 * The coordinator's prompt is typed into the terminal's shell as an argv argument. Windows
 * PowerShell 5.1 strips embedded double quotes on native calls and cmd.exe ends a command at a
 * newline, which is how the first autonomous goals launched Claude with no usable prompt. This
 * runs the real launch line through both shells into a native program and an npm-style `.cmd`.
 *
 * Runs only on win32; skipped elsewhere.
 */
const describeOnWindows = process.platform === 'win32' ? describe : describe.skip

const SYSTEM_ROOT = process.env.SystemRoot ?? 'C:\\Windows'
const SHELLS: { shell: AgentStartupShell; run: (line: string) => Promise<string> }[] = [
  {
    shell: 'powershell',
    run: async (line) =>
      (
        await runProcess({
          program: join(SYSTEM_ROOT, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
          args: ['-NoProfile', '-NonInteractive', '-Command', line],
          timeoutMs: 60_000
        })
      ).stdout
  },
  {
    shell: 'cmd',
    run: async (line) =>
      (
        await runProcess({
          program: join(SYSTEM_ROOT, 'System32', 'cmd.exe'),
          args: ['/d', '/s', '/c', `"${line}"`],
          windowsVerbatimArguments: true,
          timeoutMs: 60_000
        })
      ).stdout
  }
]

describeOnWindows('autonomous coordinator launch through Windows shells', () => {
  let dir: string
  let script: string
  let shim: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'dolphin-goal-launch-'))
    script = join(dir, 'echoargs.js')
    shim = join(dir, 'echoargs.cmd')
    writeFileSync(script, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')
    writeFileSync(shim, '@echo off\r\nnode "%~dp0echoargs.js" %*\r\n')
  })

  afterAll(() => {
    removeTreeSync(dir)
  })

  const prompt = buildAutonomousCoordinatorLaunchPrompt({
    objective: 'Analise "docs/" & siga <passo> | 100% \'pronto\'\nlinha 2 ✓',
    agent: 'claude',
    workerAgent: 'claude-agent-teams',
    maxConcurrent: 2
  })

  for (const { shell, run } of SHELLS) {
    const targets: [string, () => string][] = [
      [
        'a native program',
        () => [process.execPath, script].map((arg) => quoteStartupArg(arg, shell)).join(' ')
      ],
      ['an npm-style .cmd shim', () => quoteStartupArg(shim, shell)]
    ]
    for (const [target, command] of targets) {
      it(`delivers the prompt as one exact argument via ${shell} to ${target}`, async () => {
        const override = shell === 'powershell' ? `& ${command()}` : command()
        const plan = buildAgentStartupPlan({
          agent: 'claude',
          prompt,
          cmdOverrides: { claude: override },
          platform: 'win32',
          shell,
          isRemote: false
        })
        expect(plan).not.toBeNull()
        expect(JSON.parse(await run(plan!.launchCommand))).toEqual([prompt])
      })
    }
  }
})
