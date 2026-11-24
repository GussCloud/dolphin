/**
 * The managed Claude hook answers a bypass-mode PermissionRequest from the workspace's
 * agentPermissionPolicy: allow when the policy covers the command, `{}` (ask the user) otherwise,
 * and Agent Teams teammate panes get the same team env, their own launch token and the answer.
 *
 * A fake `claude` stands in for the CLI: on PATH it makes the startup installer write the real
 * managed hook, and as the pane command it pipes Claude's hook payloads through that hook.
 */

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'
import { RuntimeClient } from '../../src/cli/runtime-client'
import type { RuntimeWorktreeCreateResult } from '../../src/shared/runtime-types'
import type { AgentPermissionPolicy } from '../../src/shared/agent-permission-policy'
import { BYPASS_PERMISSION_AUDIT_FILE_NAME } from '../../src/main/agent-hooks/bypass-permission-resolver'

const ALLOW_REPLY =
  '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'

const fakeCliDir = mkdtempSync(path.join(os.tmpdir(), 'dolphin-e2e-bypass-claude-'))
const fakeClaude = path.join(fakeCliDir, 'claude')
// Why its own dir: the launch plan only routes a command whose first token is `claude` or `…/claude`
// through the tmux shim, and the PATH `claude` above must stay the plain fake.
const teamLeaderDir = mkdtempSync(path.join(os.tmpdir(), 'dolphin-e2e-bypass-leader-'))
const fakeTeamLeader = path.join(teamLeaderDir, 'claude')
// The tmux shim needs an absolute Dolphin CLI; CI has none on PATH, so point it at the e2e build.
const shimCli = path.join(teamLeaderDir, 'dolphin-shim-cli')

// Env values are written as presence markers only, so no token reaches a file or a log.
const permissionRequest = (target: string): string =>
  `printf '{"session_id":"e2e","cwd":"%s","permission_mode":"bypassPermissions","hook_event_name":"PermissionRequest","tool_name":"Bash","tool_input":{"command":"rm -rf %s","description":"clean"},"permission_suggestions":[]}' "$PWD" "${target}"`
writeFileSync(
  fakeClaude,
  `#!/bin/sh
if [ "$1" = "--version" ]; then echo "2.1.323 (Claude Code)"; exit 0; fi
out="$DOLPHIN_E2E_OUT"
hook="$DOLPHIN_E2E_HOOK"
# Why wait: Dolphin binds the pane's launch token right after the spawn returns, and a hook posted
# before that is (correctly) left to the user. Real Claude never prompts within milliseconds.
i=0
while [ ! -f "$out.go" ] && [ $i -lt 300 ]; do sleep 0.1; i=$((i + 1)); done
{
  echo "NO_TIMEOUT=\${CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT-unset}"
  echo "LAUNCH_TOKEN=\${DOLPHIN_AGENT_LAUNCH_TOKEN:+set}"
  echo "TMUX_PANE=\${TMUX_PANE:+set}"
  echo "PANE=$DOLPHIN_PANE_KEY"
} > "$out.env"
printf '{"session_id":"e2e","hook_event_name":"UserPromptSubmit","prompt":"clean up","cwd":"%s"}' "$PWD" | /bin/sh "$hook" > "$out.prompt" 2>&1
${permissionRequest('$PWD')} | /bin/sh "$hook" > "$out.permission" 2>&1
${permissionRequest('$PWD/..')} | /bin/sh "$hook" > "$out.parent-permission" 2>&1
echo done > "$out.done"
exec sleep 600
`
)
// Plays Claude's Agent Teams leader: asks Dolphin's tmux shim for a teammate pane, then types the
// teammate command into it the way Claude does.
writeFileSync(
  fakeTeamLeader,
  `#!/bin/sh
out="$DOLPHIN_E2E_OUT"
pane=$(tmux split-window -t "$TMUX_PANE" -h -P -F '#{pane_id}' 2>"$out.split-err")
tmux send-keys -t "$pane" "cd '$PWD' && env DOLPHIN_E2E_OUT='$out' DOLPHIN_E2E_HOOK='$DOLPHIN_E2E_HOOK' '${fakeClaude}' --agent-id t1@team" Enter 2>>"$out.split-err"
exec sleep 600
`
)
writeFileSync(
  shimCli,
  `#!/bin/sh\nexec '${process.execPath}' '${path.join(process.cwd(), 'out', 'cli', 'index.js')}' "$@"\n`
)
chmodSync(fakeClaude, 0o755)
chmodSync(fakeTeamLeader, 0o755)
chmodSync(shimCli, 0o755)

test.use({ launchEnv: { PATH: `${fakeCliDir}${path.delimiter}${process.env.PATH ?? ''}` } })

test.afterAll(() => {
  rmSync(fakeCliDir, { recursive: true, force: true })
  rmSync(teamLeaderDir, { recursive: true, force: true })
})

test.skip(process.platform === 'win32', 'The Windows .cmd hook keeps today’s behavior')

type PaneRun = {
  worktreeId: string
  env: string
  promptReply: string
  permissionReply: string
  parentPermissionReply: string
  paneKey: string
}

type BypassHarness = {
  run: (
    label: string,
    policy: AgentPermissionPolicy | null,
    launch?: {
      agent: 'claude' | 'claude-agent-teams'
      command: string
      env?: Record<string, string>
    }
  ) => Promise<PaneRun>
  readPaneState: (paneKey: string) => Promise<string | null>
  readAudit: () => { worktreeId?: string; paneKey?: string; policyMode?: string }[]
}

function createSourceRepo(): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'dolphin-e2e-bypass-repo-'))
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

const readText = (file: string): string => readFileSync(file, 'utf8').trim()

async function createBypassHarness(
  electronApp: ElectronApplication,
  appPage: Page,
  registerCleanup: (cleanup: () => Promise<void>) => void
): Promise<BypassHarness> {
  const sourceRepo = createSourceRepo()
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'dolphin-e2e-bypass-out-'))
  const worktreePaths: string[] = []
  registerCleanup(async () => {
    for (const worktreePath of worktreePaths) {
      rmSync(worktreePath, { recursive: true, force: true })
    }
    rmSync(sourceRepo, { recursive: true, force: true })
    rmSync(outDir, { recursive: true, force: true })
  })
  await waitForSessionReady(appPage)
  const { userDataDir, appHome } = await electronApp.evaluate(({ app }) => ({
    userDataDir: app.getPath('userData'),
    appHome: process.env.HOME ?? ''
  }))
  const hookPath = path.join(appHome, '.dolphin', 'agent-hooks', 'claude-hook.sh')
  await expect
    .poll(() => existsSync(hookPath), {
      timeout: 30_000,
      message: 'The startup installer never wrote the managed Claude hook'
    })
    .toBe(true)

  const client = new RuntimeClient(userDataDir, 30_000, null, null)
  const added = await client.call<{ repo: { id: string } }>('repo.add', {
    path: sourceRepo,
    kind: 'git'
  })
  const repoId = added.result.repo.id

  const run: BypassHarness['run'] = async (
    label,
    policy,
    launch = { agent: 'claude', command: fakeClaude }
  ) => {
    const created = await client.call<RuntimeWorktreeCreateResult>('worktree.create', {
      repo: `id:${repoId}`,
      name: `bypass-${label}-${randomUUID().slice(0, 8)}`,
      noParent: true,
      activate: false
    })
    const worktreeId = created.result.worktree.id
    worktreePaths.push(created.result.worktree.path)
    if (policy) {
      await appPage.evaluate(
        ({ worktreeId, policy }) =>
          window.api.worktrees.updateMeta({
            worktreeId,
            updates: { agentPermissionPolicy: policy }
          }),
        { worktreeId, policy }
      )
    }
    const out = path.join(outDir, label)
    await client.call('terminal.create', {
      worktree: `id:${worktreeId}`,
      title: `fake claude ${label}`,
      command: launch.command,
      launchAgent: launch.agent,
      launchConfig: { agentCommand: launch.command, agentArgs: '', agentEnv: {} },
      env: { ...launch.env, DOLPHIN_E2E_OUT: out, DOLPHIN_E2E_HOOK: hookPath }
    })
    // terminal.create resolves after the spawn record holds the launch token.
    writeFileSync(`${out}.go`, '')
    // The tmux shim's stderr is the only trace of a failed teammate split, so surface it.
    const splitErr = (): string =>
      existsSync(`${out}.split-err`) ? readText(`${out}.split-err`) : '(no split attempted)'
    await expect
      .poll(() => existsSync(`${out}.done`), {
        timeout: 30_000,
        message: `The fake claude in the ${label} pane never finished its hook calls`
      })
      .toBe(true)
      .catch((error: unknown) => {
        throw new Error(`${String(error)}\ntmux shim stderr: ${splitErr()}`)
      })
    const env = readText(`${out}.env`)
    return {
      worktreeId,
      env,
      promptReply: readText(`${out}.prompt`),
      permissionReply: readText(`${out}.permission`),
      parentPermissionReply: readText(`${out}.parent-permission`),
      paneKey: /^PANE=(.*)$/m.exec(env)?.[1] ?? ''
    }
  }

  return {
    run,
    // Agent status has no per-pane DOM row in a background worktree; the store mirrors the hook server's.
    readPaneState: (paneKey) =>
      appPage.evaluate(
        (key) => window.__store?.getState().agentStatusByPaneKey?.[key]?.state ?? null,
        paneKey
      ),
    readAudit: () => {
      const auditPath = path.join(userDataDir, BYPASS_PERMISSION_AUDIT_FILE_NAME)
      return existsSync(auditPath)
        ? readFileSync(auditPath, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : []
    }
  }
}

test.describe('Claude bypass permission policy', () => {
  test('answers a bypass PermissionRequest from each workspace policy', async ({
    electronApp,
    appPage,
    registerPostElectronShutdownCleanup
  }) => {
    const harness = await createBypassHarness(
      electronApp,
      appPage,
      registerPostElectronShutdownCleanup
    )

    const approveAll = await harness.run('approve-all', { mode: 'approve-all' })
    expect(approveAll.env).toContain('NO_TIMEOUT=1')
    expect(approveAll.env).toContain('LAUNCH_TOKEN=set')
    expect(approveAll.promptReply).toBe('{}')
    expect(approveAll.permissionReply).toBe(ALLOW_REPLY)
    expect(approveAll.parentPermissionReply).toBe(ALLOW_REPLY)
    await expect.poll(() => harness.readPaneState(approveAll.paneKey)).toBe('working')

    const noPolicy = await harness.run('no-policy', null)
    expect(noPolicy.env).toContain('NO_TIMEOUT=1')
    expect(noPolicy.permissionReply).toBe('{}')
    expect(noPolicy.parentPermissionReply).toBe('{}')
    await expect.poll(() => harness.readPaneState(noPolicy.paneKey)).toBe('waiting')

    const catalog = await harness.run('catalog', {
      mode: 'catalog',
      categories: ['working-directory']
    })
    expect(catalog.permissionReply).toBe(ALLOW_REPLY)
    // `<cwd>/..` is outside the working-directory shape, so it goes to the user.
    expect(catalog.parentPermissionReply).toBe('{}')
    await expect.poll(() => harness.readPaneState(catalog.paneKey)).toBe('waiting')

    // Every approval is audited; a reply sent to the user is not.
    const auditedModes = (worktreeId: string): (string | undefined)[] =>
      harness
        .readAudit()
        .filter((entry) => entry.worktreeId === worktreeId)
        .map((entry) => entry.policyMode)
    await expect
      .poll(() => ({
        approveAll: auditedModes(approveAll.worktreeId),
        catalog: auditedModes(catalog.worktreeId),
        noPolicy: auditedModes(noPolicy.worktreeId)
      }))
      .toEqual({ approveAll: ['approve-all', 'approve-all'], catalog: ['catalog'], noPolicy: [] })
  })

  test('a teammate pane from the tmux shim gets the team env and the policy answer', async ({
    electronApp,
    appPage,
    registerPostElectronShutdownCleanup
  }) => {
    const harness = await createBypassHarness(
      electronApp,
      appPage,
      registerPostElectronShutdownCleanup
    )

    const teammate = await harness.run(
      'teammate',
      { mode: 'approve-all' },
      {
        agent: 'claude-agent-teams',
        command: `${fakeTeamLeader} --teammate-mode auto`,
        env: { DOLPHIN_AGENT_TEAMS_SHIM_BIN: shimCli }
      }
    )
    expect(teammate.env).toContain('TMUX_PANE=set')
    expect(teammate.env).toContain('NO_TIMEOUT=1')
    expect(teammate.env).toContain('LAUNCH_TOKEN=set')
    expect(teammate.permissionReply).toBe(ALLOW_REPLY)
    await expect.poll(() => harness.readPaneState(teammate.paneKey)).toBe('working')
    await expect
      .poll(() => harness.readAudit().some((entry) => entry.paneKey === teammate.paneKey))
      .toBe(true)
  })
})
