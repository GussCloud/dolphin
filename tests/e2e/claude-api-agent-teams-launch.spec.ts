/**
 * An Agent Teams leader launched as `claude-api-agent-teams` gets a team whose env names its API
 * account, and the teammate pane the tmux shim creates runs on that account's profile and key.
 * Fake `claude` scripts stand in for the CLI and record only presence and equality of values.
 */

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'
import { RuntimeClient } from '../../src/cli/runtime-client'
import type { RuntimeWorktreeCreateResult } from '../../src/shared/runtime-types'

// A fake key: the scripts only report whether the env value equals it.
const FAKE_KEY = 'sk-ant-test-fake-claude-api-teams'

const scriptsDir = mkdtempSync(path.join(os.tmpdir(), 'dolphin-e2e-api-teams-'))
// Why its own dir: the launch plan routes only a command whose first token is `…/claude`.
const leaderDir = mkdtempSync(path.join(os.tmpdir(), 'dolphin-e2e-api-teams-leader-'))
const fakeTeammate = path.join(scriptsDir, 'claude')
const fakeLeader = path.join(leaderDir, 'claude')
// The tmux shim needs an absolute Dolphin CLI; point it at the e2e build.
const shimCli = path.join(leaderDir, 'dolphin-shim-cli')

const reportEnv = (file: string): string => `{
  echo "TEAM=\${DOLPHIN_AGENT_TEAMS_TEAM_ID:+set}"
  echo "TMUX_PANE=\${TMUX_PANE:+set}"
  echo "PROVIDER=$DOLPHIN_CLAUDE_PROVIDER"
  echo "ACCOUNT=$DOLPHIN_CLAUDE_API_ACCOUNT"
  echo "CONFIG_DIR=$CLAUDE_CONFIG_DIR"
  if [ "$ANTHROPIC_API_KEY" = "${FAKE_KEY}" ]; then echo "KEY=match"; else echo "KEY=other"; fi
} > "${file}"`

writeFileSync(
  fakeTeammate,
  `#!/bin/sh
${reportEnv('$DOLPHIN_E2E_OUT.teammate')}
exec sleep 600
`
)
// Plays Claude's Agent Teams leader: records its env, then asks the tmux shim for a teammate pane.
writeFileSync(
  fakeLeader,
  `#!/bin/sh
out="$DOLPHIN_E2E_OUT"
${reportEnv('$out.leader')}
pane=$(tmux split-window -t "$TMUX_PANE" -h -P -F '#{pane_id}' 2>"$out.split-err")
tmux send-keys -t "$pane" "cd '$PWD' && env DOLPHIN_E2E_OUT='$out' '${fakeTeammate}' --agent-id t1@team" Enter 2>>"$out.split-err"
exec sleep 600
`
)
writeFileSync(
  shimCli,
  `#!/bin/sh\nexec '${process.execPath}' '${path.join(process.cwd(), 'out', 'cli', 'index.js')}' "$@"\n`
)
chmodSync(fakeTeammate, 0o755)
chmodSync(fakeLeader, 0o755)
chmodSync(shimCli, 0o755)

test.afterAll(() => {
  rmSync(scriptsDir, { recursive: true, force: true })
  rmSync(leaderDir, { recursive: true, force: true })
})

test.skip(process.platform === 'win32', 'The fake claude CLI is a POSIX script')

function createSourceRepo(): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'dolphin-e2e-api-teams-repo-'))
  const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: repo, stdio: 'ignore' })
  }
  git('init', '-b', 'main')
  git('config', 'user.email', 'e2e@example.invalid')
  git('config', 'user.name', 'e2e')
  writeFileSync(path.join(repo, 'README.md'), 'x\n')
  git('add', '.')
  git('commit', '-m', 'init')
  return repo
}

function readReport(file: string): Record<string, string> | null {
  if (!existsSync(file)) {
    return null
  }
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const at = line.indexOf('=')
        return [line.slice(0, at), line.slice(at + 1)]
      })
  )
}

test('an API-key Agent Teams leader and its teammate run on the API account', async ({
  electronApp,
  appPage,
  registerPostElectronShutdownCleanup
}) => {
  const sourceRepo = createSourceRepo()
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'dolphin-e2e-api-teams-out-'))
  const worktreePaths: string[] = []
  registerPostElectronShutdownCleanup(async () => {
    for (const worktreePath of worktreePaths) {
      rmSync(worktreePath, { recursive: true, force: true })
    }
    rmSync(sourceRepo, { recursive: true, force: true })
    rmSync(outDir, { recursive: true, force: true })
  })
  await waitForSessionReady(appPage)
  if (process.platform === 'linux') {
    // Why: Linux CI has no keyring; this test-only switch gives safeStorage an in-memory key.
    await electronApp.evaluate(({ safeStorage }) => safeStorage.setUsePlainTextEncryption(true))
  }
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const state = await appPage.evaluate(
    (apiKey) =>
      window.api.claudeAccounts.addApiKeyAccount({
        label: 'Team API',
        apiKey,
        copyFromAccountId: null
      }),
    FAKE_KEY
  )
  const accountId = state.accounts.find((entry) => entry.authMethod === 'api-key')?.id
  expect(accountId).toBeTruthy()

  const client = new RuntimeClient(userData, 30_000, null, null)
  const added = await client.call<{ repo: { id: string } }>('repo.add', {
    path: sourceRepo,
    kind: 'git'
  })
  const created = await client.call<RuntimeWorktreeCreateResult>('worktree.create', {
    repo: `id:${added.result.repo.id}`,
    name: `api-teams-${randomUUID().slice(0, 8)}`,
    noParent: true,
    activate: false
  })
  worktreePaths.push(created.result.worktree.path)
  const out = path.join(outDir, 'run')
  await client.call('terminal.create', {
    worktree: `id:${created.result.worktree.id}`,
    title: 'fake api teams leader',
    command: `${fakeLeader} --teammate-mode auto`,
    launchAgent: 'claude-api-agent-teams',
    launchConfig: {
      agentCommand: `${fakeLeader} --teammate-mode auto`,
      agentArgs: '',
      agentEnv: {}
    },
    env: { DOLPHIN_AGENT_TEAMS_SHIM_BIN: shimCli, DOLPHIN_E2E_OUT: out }
  })

  const expected = {
    PROVIDER: 'anthropic-api',
    ACCOUNT: accountId,
    CONFIG_DIR: path.join(userData, 'claude-accounts', accountId!, 'config'),
    KEY: 'match'
  }
  await expect
    .poll(() => readReport(`${out}.leader`), { timeout: 30_000 })
    .toEqual({ TEAM: 'set', TMUX_PANE: 'set', ...expected })
  const splitErr = (): string =>
    existsSync(`${out}.split-err`) ? readFileSync(`${out}.split-err`, 'utf8') : ''
  await expect
    .poll(() => readReport(`${out}.teammate`), {
      timeout: 30_000,
      message: `The teammate pane never started; tmux shim stderr: ${splitErr()}`
    })
    .toEqual({ TEAM: 'set', TMUX_PANE: 'set', ...expected })
})
