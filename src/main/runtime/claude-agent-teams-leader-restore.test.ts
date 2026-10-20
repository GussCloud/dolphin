import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaudeAgentTeamsLeaderRegistry } from './claude-agent-teams-leader-registry'
import { ClaudeAgentTeamsService, type AgentTeamsTerminalApi } from './claude-agent-teams-service'

const PANE_KEY = 'tab-1:11111111-1111-4111-8111-111111111111'

let dir = ''
let registryPath = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dolphin-agent-teams-restore-'))
  registryPath = join(dir, 'claude-agent-teams-leaders.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function createRegistry(now: () => number = Date.now): ClaudeAgentTeamsLeaderRegistry {
  return new ClaudeAgentTeamsLeaderRegistry(() => registryPath, now)
}

function createApi(liveLeaderHandle: () => string | null): AgentTeamsTerminalApi {
  let splitCount = 0
  return {
    splitTerminal: vi.fn(async () => {
      splitCount += 1
      return { handle: `teammate-${splitCount}`, tabId: 'tab-1', paneRuntimeId: -1 }
    }),
    resolveLiveLeaderHandle: vi.fn(() => liveLeaderHandle()),
    resolveHostShell: vi.fn(() => 'default' as const),
    markTeammatePaneNotResumable: vi.fn(),
    readTerminal: vi.fn(),
    sendTerminal: vi.fn(),
    focusTerminal: vi.fn(),
    closeTerminal: vi.fn(),
    showTerminal: vi.fn()
  }
}

function launchLeader(service: ClaudeAgentTeamsService, options: { withPaneKey?: boolean } = {}) {
  return service.createLaunchEnv({
    leaderHandle: 'leader-before-restart',
    baseEnv: { PATH: '/usr/bin' },
    shimDir: '/tmp/dolphin-shim',
    shimBin: '/usr/bin/dolphin',
    hostShell: 'default',
    paneKey: options.withPaneKey === false ? undefined : PANE_KEY
  })
}

const SPLIT = ['split-window', '-t', '%1', '-h', '-P', '-F', '#{pane_id}']

describe('Claude agent team restore after a main-process restart', () => {
  it('re-admits the surviving leader and keeps issuing fresh pane ids', async () => {
    const before = new ClaudeAgentTeamsService('linux', createRegistry())
    const launch = launchLeader(before)
    const request = { teamId: launch.teamId, token: launch.token, envPane: '%1' }
    await expect(
      before.handleTmuxCompat(
        { ...request, argv: SPLIT },
        createApi(() => null)
      )
    ).resolves.toMatchObject({ stdout: '%2\n', exitCode: 0 })

    const after = new ClaudeAgentTeamsService('linux', createRegistry())
    const api = createApi(() => 'leader-after-restart')
    await expect(after.handleTmuxCompat({ ...request, argv: SPLIT }, api)).resolves.toMatchObject({
      stdout: '%3\n',
      exitCode: 0
    })
    expect(api.splitTerminal).toHaveBeenCalledWith(
      'leader-after-restart',
      expect.objectContaining({
        env: expect.objectContaining({ DOLPHIN_AGENT_TEAMS_TEAM_ID: launch.teamId })
      })
    )
    expect(api.resolveLiveLeaderHandle).toHaveBeenCalledWith(PANE_KEY)
  })

  it('refuses a caller without the persisted token', async () => {
    const launch = launchLeader(new ClaudeAgentTeamsService('linux', createRegistry()))
    const after = new ClaudeAgentTeamsService('linux', createRegistry())
    const api = createApi(() => 'leader-after-restart')

    await expect(
      after.handleTmuxCompat(
        { teamId: launch.teamId, token: 'wrong', envPane: '%1', argv: ['list-panes'] },
        api
      )
    ).resolves.toMatchObject({ exitCode: 1, stderr: 'tmux: stale or unauthorized agent team\n' })
    expect(api.resolveLiveLeaderHandle).not.toHaveBeenCalled()
  })

  it('keeps the record while the leader pane has not reattached yet', async () => {
    const launch = launchLeader(new ClaudeAgentTeamsService('linux', createRegistry()))
    const after = new ClaudeAgentTeamsService('linux', createRegistry())
    let liveHandle: string | null = null
    const api = createApi(() => liveHandle)
    const listPanes = {
      teamId: launch.teamId,
      token: launch.token,
      envPane: '%1',
      argv: ['list-panes', '-F', '#{pane_id}']
    }

    await expect(after.handleTmuxCompat(listPanes, api)).resolves.toMatchObject({ exitCode: 1 })
    liveHandle = 'leader-after-restart'
    await expect(after.handleTmuxCompat(listPanes, api)).resolves.toMatchObject({
      stdout: '%1\n',
      exitCode: 0
    })
  })

  it('forgets the team once its leader exits', () => {
    const service = new ClaudeAgentTeamsService('linux', createRegistry())
    const launch = launchLeader(service)
    expect(createRegistry().get(launch.teamId)).not.toBeNull()

    service.removeTeamForLeaderHandle('leader-before-restart')

    expect(createRegistry().get(launch.teamId)).toBeNull()
    expect(existsSync(registryPath)).toBe(false)
  })

  it('does not persist a leader without a pane key', () => {
    launchLeader(new ClaudeAgentTeamsService('linux', createRegistry()), { withPaneKey: false })
    expect(existsSync(registryPath)).toBe(false)
  })
})

describe('ClaudeAgentTeamsLeaderRegistry', () => {
  const leader = {
    teamId: 'team-a',
    token: 'secret',
    paneKey: PANE_KEY,
    env: { TMUX: '/tmp/x,0,1' },
    nextPaneNumber: 2
  }

  it('treats an unreadable file as empty', () => {
    writeFileSync(registryPath, '{not json')
    expect(createRegistry().get('team-a')).toBeNull()
  })

  it('drops records older than thirty days', () => {
    let now = 1_000
    const registry = createRegistry(() => now)
    registry.save(leader)
    now += 31 * 24 * 60 * 60 * 1000
    expect(registry.get('team-a')).toBeNull()
  })

  it('caps the file at the most recently saved leaders', () => {
    const registry = createRegistry()
    for (let index = 0; index < 70; index += 1) {
      registry.save({ ...leader, teamId: `team-${index}` })
    }
    const saved: unknown = JSON.parse(readFileSync(registryPath, 'utf-8'))
    expect(Array.isArray(saved) && saved.length).toBe(64)
    expect(registry.get('team-0')).toBeNull()
    expect(registry.get('team-69')).not.toBeNull()
  })
})
