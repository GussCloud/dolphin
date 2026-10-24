import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { test as base, expect } from './helpers/dolphin-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { buildAutonomousCoordinatorLaunchPrompt } from '../../src/shared/autonomous-coordinator-prompt'
import { AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT } from '../../src/shared/autonomous-goal-types'
import {
  buildFakeAgentCommandOverride,
  FAKE_AGENT_WINDOWS_SHELL
} from './helpers/fake-agent-command-override'

const OBJECTIVE = 'Read the docs folder and implement what it specifies'
const fakeCliDir = mkdtempSync(path.join(os.tmpdir(), 'dolphin-e2e-autonomous-goal-'))
const argvLog = path.join(fakeCliDir, 'claude-launches.jsonl')

// Records every invocation (detection probes included), then idles like a TUI.
const fakeClaudeSource = `
const args = process.argv.slice(2)
require('node:fs').appendFileSync(${JSON.stringify(argvLog)}, JSON.stringify({ argv: args, cwd: process.cwd() }) + '\\n')
if (args[0] === '--version') { console.log('2.1.309 (Claude Code)'); process.exit(0) }
process.stdout.write('E2E_CLAUDE_STARTED\\n')
setInterval(() => {}, 60_000)
`

const launchSchema = z.object({ argv: z.array(z.string()), cwd: z.string() })
type Launch = z.infer<typeof launchSchema>

function readLaunches(): Launch[] {
  if (!existsSync(argvLog)) {
    return []
  }
  return readFileSync(argvLog, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => launchSchema.parse(JSON.parse(line)))
}

function coordinatorLaunch(): Launch | undefined {
  return readLaunches().find((launch) => launch.argv[0] !== '--version')
}

const fakeClaudePath = path.join(fakeCliDir, process.platform === 'win32' ? 'claude.cmd' : 'claude')
if (process.platform === 'win32') {
  writeFileSync(path.join(fakeCliDir, 'fake-claude.js'), fakeClaudeSource)
  writeFileSync(fakeClaudePath, `@echo off\r\nnode "%~dp0\\fake-claude.js" %*\r\n`)
} else {
  writeFileSync(fakeClaudePath, `#!/usr/bin/env node\n${fakeClaudeSource}`)
  chmodSync(fakeClaudePath, 0o755)
}
// Why an override and not only PATH: a real claude earlier on the login shell's PATH would win.
const fakeClaudeCommand = buildFakeAgentCommandOverride(fakeClaudePath)

const test = base.extend({
  launchEnv: [{ PATH: `${fakeCliDir}${path.delimiter}${process.env.PATH ?? ''}` }, { option: true }]
})

test.afterAll(() => {
  rmSync(fakeCliDir, { recursive: true, force: true })
})

test('autonomous work launches the coordinator with its goal prompt in a new worktree', async ({
  appPage
}) => {
  await waitForSessionReady(appPage)
  await waitForActiveWorktree(appPage)
  await appPage.evaluate(
    async ({ command, windowsShell }) => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      await store.getState().updateSettings({
        defaultTuiAgent: 'claude',
        disabledTuiAgents: [],
        agentCmdOverrides: { claude: command },
        terminalWindowsShell: windowsShell
      })
      store.getState().openModal('new-workspace-composer', { prefilledName: 'autonomous-goal' })
    },
    { command: fakeClaudeCommand, windowsShell: FAKE_AGENT_WINDOWS_SHELL }
  )

  const composer = appPage.getByRole('dialog', { name: /Create (workspace|worktree)/i })
  await expect(composer).toBeVisible({ timeout: 15_000 })
  await composer.getByRole('switch', { name: 'Autonomous work' }).click()
  await composer.getByPlaceholder(/Read the docs folder/).fill(OBJECTIVE)
  const create = composer.getByRole('button', { name: /Create (workspace|worktree)/i })
  await expect(create).toBeEnabled({ timeout: 15_000 })
  await create.click()
  await expect(composer).toBeHidden({ timeout: 20_000 })

  await expect
    .poll(() => coordinatorLaunch() !== undefined, {
      timeout: 30_000,
      message: 'the coordinator CLI never started'
    })
    .toBe(true)
  const launch = coordinatorLaunch()!
  // Why exact: on Windows a shell that splits or strips the prompt still leaves a substring behind.
  expect(launch.argv.at(-1)).toBe(
    buildAutonomousCoordinatorLaunchPrompt({
      objective: OBJECTIVE,
      agent: 'claude',
      workerAgent: 'claude',
      maxConcurrent: AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT
    })
  )
  expect(path.basename(launch.cwd)).toContain('autonomous-goal')
})
