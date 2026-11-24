import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { spawn } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getManagedScript } from '../claude/hook-script'
import type { AgentPermissionPolicy } from '../../shared/agent-permission-policy'
import { BYPASS_PERMISSION_ALLOW_REPLY } from './bypass-permission-decision'
import { AgentHookServer, _internals } from './server'
import {
  BYPASS_PERMISSION_AUDIT_FILE_NAME,
  createBypassPermissionResolver,
  type SpawnedLaunchLookup
} from './bypass-permission-resolver'
import { buildBody, PANE } from './server.test-fixtures'

vi.mock('../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../telemetry/cohort-classifier', () => ({
  getCohortAtEmit: vi.fn(() => ({ nth_repo_added: 2 }))
}))

beforeEach(() => {
  _internals.resetCachesForTests()
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

const LAUNCH_TOKEN = 'launch-token-1'
const PERMISSION_REQUEST = {
  session_id: 's',
  cwd: '/repo/app',
  permission_mode: 'bypassPermissions',
  hook_event_name: 'PermissionRequest',
  tool_name: 'Bash',
  tool_input: { command: 'rm -rf $BUILD', description: 'clean' }
}
const VARIABLE_TARGETS: AgentPermissionPolicy = { mode: 'catalog', categories: ['variable-target'] }

/** Runtime spawn records: pane key -> the worktree and launch token Dolphin minted at spawn. */
function fakeRuntime(
  spawnedWorktreeByPane: Record<string, string>,
  launchToken = LAUNCH_TOKEN
): SpawnedLaunchLookup {
  return {
    getSpawnedAgentLaunchForPaneKey: (paneKey) => {
      const worktreeId = spawnedWorktreeByPane[paneKey]
      return worktreeId ? { worktreeId, launchToken } : null
    }
  }
}

function readAudit(userDataPath: string): unknown[] {
  try {
    return readFileSync(join(userDataPath, BYPASS_PERMISSION_AUDIT_FILE_NAME), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line): unknown => JSON.parse(line))
  } catch {
    return []
  }
}

async function startServer(args: {
  policyByWorktree: Record<string, AgentPermissionPolicy>
  /** Dolphin's spawn record; absent means the runtime has none for the pane. */
  spawnedWorktreeByPane?: Record<string, string>
  /** What the pane's hook env claims as DOLPHIN_WORKTREE_ID on every post. */
  claimedWorktreeId?: string
  getWorktreeMeta?: (worktreeId: string) => { agentPermissionPolicy?: AgentPermissionPolicy }
  /** Token the posting process sends; defaults to the spawn-minted one. */
  postedLaunchToken?: string
}) {
  const lookups: string[] = []
  const userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-bypass-audit-'))
  const server = new AgentHookServer()
  server.setBypassPermissionResolver(
    createBypassPermissionResolver({
      getWorktreeMeta:
        args.getWorktreeMeta ??
        ((worktreeId) => {
          lookups.push(worktreeId)
          return { agentPermissionPolicy: args.policyByWorktree[worktreeId] }
        }),
      getRuntime: () => fakeRuntime(args.spawnedWorktreeByPane ?? { [PANE]: 'wt-1' }),
      userDataPath
    })
  )
  await server.start({ env: 'production' })
  const env = server.buildPtyEnv()
  const claimedWorktreeId = args.claimedWorktreeId ?? 'wt-1'
  const post = (
    payload: Record<string, unknown>,
    options: { relays?: boolean; launchToken?: string } = {}
  ) =>
    fetch(`http://127.0.0.1:${env.DOLPHIN_AGENT_HOOK_PORT}/hook/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dolphin-Agent-Hook-Token': env.DOLPHIN_AGENT_HOOK_TOKEN,
        ...(options.relays === false ? {} : { 'X-Dolphin-Agent-Hook-Decision-Reply': '1' })
      },
      body: JSON.stringify(
        buildBody(payload, {
          launchToken: options.launchToken ?? args.postedLaunchToken ?? LAUNCH_TOKEN,
          worktreeId: claimedWorktreeId
        })
      )
    })
  // An earlier event from the pane commits its launch token (and, for a forger, rewrites it).
  await post({ hook_event_name: 'SessionStart', source: 'startup' })
  await post({ hook_event_name: 'UserPromptSubmit', prompt: 'clean up' })
  return { server, post, lookups, env, audit: () => readAudit(userDataPath) }
}

function runManagedHook(env: Record<string, string>, input: string): Promise<string> {
  const script = join(mkdtempSync(join(tmpdir(), 'dolphin-bypass-hook-')), 'claude-hook.sh')
  writeFileSync(script, getManagedScript('posix'))
  chmodSync(script, 0o755)
  return new Promise((resolve) => {
    const child = spawn('/bin/sh', [script], { env: { PATH: process.env.PATH ?? '', ...env } })
    let stdout = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.on('close', () => resolve(stdout))
    child.stdin.end(input)
  })
}

const paneState = (server: AgentHookServer) =>
  server.getStatusSnapshot().find((row) => row.paneKey === PANE)?.state

describe('hook server bypass permission reply', () => {
  it('answers an allowed prompt with the allow JSON, keeps the pane working and audits it', async () => {
    const { server, post, audit, lookups } = await startServer({
      policyByWorktree: { 'wt-1': VARIABLE_TARGETS }
    })
    try {
      const res = await post(PERMISSION_REQUEST)
      expect(res.status).toBe(200)
      expect(await res.text()).toBe(BYPASS_PERMISSION_ALLOW_REPLY)
      expect(paneState(server)).toBe('working')
      expect(lookups).toEqual(['wt-1'])
      expect(audit()).toEqual([
        expect.objectContaining({
          src: 'main',
          event: 'bypass-permission-allowed',
          worktreeId: 'wt-1',
          paneKey: PANE,
          toolName: 'Bash',
          command: 'rm -rf $BUILD',
          categories: ['variable-target'],
          policyMode: 'catalog'
        })
      ])
    } finally {
      await server.stop()
    }
  })

  it('refuses a pane that claims another workspace than the one Dolphin spawned it for', async () => {
    // The pane was spawned for wt-plain (no policy) and rewrote DOLPHIN_WORKTREE_ID to wt-open.
    const { server, post, lookups, audit } = await startServer({
      policyByWorktree: { 'wt-open': { mode: 'approve-all' } },
      spawnedWorktreeByPane: { [PANE]: 'wt-plain' },
      claimedWorktreeId: 'wt-open'
    })
    try {
      expect((await post(PERMISSION_REQUEST)).status).toBe(204)
      expect(paneState(server)).toBe('waiting')
      expect(lookups).toEqual([])
      expect(audit()).toEqual([])
    } finally {
      await server.stop()
    }
  })

  it('approves `rm -rf .` for the real cwd after the realpath check', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dolphin-bypass-cwd-'))
    const { server, post, audit } = await startServer({
      policyByWorktree: { 'wt-1': { mode: 'catalog', categories: ['working-directory'] } }
    })
    try {
      const res = await post({ ...PERMISSION_REQUEST, cwd, tool_input: { command: 'rm -rf .' } })
      expect(res.status).toBe(200)
      expect(audit()).toEqual([expect.objectContaining({ categories: ['working-directory'] })])
      const missing = join(cwd, 'gone')
      expect(
        (await post({ ...PERMISSION_REQUEST, cwd: missing, tool_input: { command: 'rm -rf .' } }))
          .status
      ).toBe(204)
    } finally {
      await server.stop()
    }
  })

  it('refuses a process that forges another pane key with its own token', async () => {
    // A nested claude in pane A sets DOLPHIN_PANE_KEY=<B>; its SessionStart rewrites B's hook
    // commitment to its own token, so only the spawn-minted token tells it apart.
    const { server, post, lookups, audit } = await startServer({
      policyByWorktree: { 'wt-1': { mode: 'approve-all' } },
      postedLaunchToken: 'forged-token-from-pane-a'
    })
    try {
      expect((await post(PERMISSION_REQUEST)).status).toBe(204)
      expect(paneState(server)).toBe('waiting')
      expect(lookups).toEqual([])
      expect(audit()).toEqual([])
    } finally {
      await server.stop()
    }
  })

  it('refuses a pane Dolphin has no spawn record for', async () => {
    const { server, post } = await startServer({
      policyByWorktree: { 'wt-1': { mode: 'approve-all' } },
      spawnedWorktreeByPane: {}
    })
    try {
      expect((await post(PERMISSION_REQUEST)).status).toBe(204)
      expect(paneState(server)).toBe('waiting')
    } finally {
      await server.stop()
    }
  })

  it('refuses a post whose launch token is not the pane’s', async () => {
    const { server, post, lookups } = await startServer({
      policyByWorktree: { 'wt-1': { mode: 'approve-all' } }
    })
    try {
      expect((await post(PERMISSION_REQUEST, { launchToken: 'other' })).status).toBe(204)
      expect(lookups).toEqual([])
    } finally {
      await server.stop()
    }
  })

  it('keeps today’s reply when the policy does not cover the command', async () => {
    const { server, post, audit } = await startServer({
      policyByWorktree: { 'wt-1': { mode: 'catalog', categories: ['working-directory'] } }
    })
    try {
      expect((await post(PERMISSION_REQUEST)).status).toBe(204)
      expect(paneState(server)).toBe('waiting')
      expect(audit()).toEqual([])
    } finally {
      await server.stop()
    }
  })

  it('never decides for a hook that does not relay the answer', async () => {
    const { server, post } = await startServer({
      policyByWorktree: { 'wt-1': { mode: 'approve-all' } }
    })
    try {
      expect((await post(PERMISSION_REQUEST, { relays: false })).status).toBe(204)
      expect(paneState(server)).toBe('waiting')
    } finally {
      await server.stop()
    }
  })

  it('fails open to today’s reply when the policy lookup throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { server, post } = await startServer({
      policyByWorktree: {},
      getWorktreeMeta: () => {
        throw new Error('store unavailable')
      }
    })
    try {
      expect((await post(PERMISSION_REQUEST)).status).toBe(204)
      expect(paneState(server)).toBe('waiting')
    } finally {
      await server.stop()
    }
  })

  it.skipIf(process.platform === 'win32')(
    'the real managed hook prints the server answer to Claude',
    async () => {
      const { server, env } = await startServer({
        policyByWorktree: { 'wt-1': VARIABLE_TARGETS }
      })
      try {
        const stdout = await runManagedHook(
          {
            ...env,
            DOLPHIN_PANE_KEY: PANE,
            DOLPHIN_TAB_ID: 'tab-1',
            DOLPHIN_WORKTREE_ID: 'wt-1',
            DOLPHIN_AGENT_LAUNCH_TOKEN: LAUNCH_TOKEN,
            DOLPHIN_AGENT_HOOK_ENV: 'production'
          },
          JSON.stringify(PERMISSION_REQUEST)
        )
        expect(stdout).toBe(`${BYPASS_PERMISSION_ALLOW_REPLY}\n`)
        expect(paneState(server)).toBe('working')
      } finally {
        await server.stop()
      }
    }
  )
})
