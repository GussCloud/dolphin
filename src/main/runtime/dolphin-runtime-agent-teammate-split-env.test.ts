import { describe, expect, it, vi } from 'vitest'
import { getDefaultWorkspaceSession } from '../../shared/constants'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'
import { teammatePaneSpawnOptions } from './claude-agent-teams-pane-layout'
import {
  DEEPSEEK_PROVIDER_ENV_KEY,
  DEEPSEEK_PROVIDER_ENV_VALUE
} from '../../shared/deepseek-claude-provider'
import type { AgentTeam, AgentTeamsTerminalApi } from './claude-agent-teams-types'
import {
  CLAUDE_API_ACCOUNT_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_VALUE
} from '../../shared/claude-api-provider'
import { DolphinRuntimeService } from './dolphin-runtime'

const REPO_ID = 'repo-1'
const WORKTREE_ID = `${REPO_ID}::/workspace`
const TAB_ID = 'tab-team'
const LEADER_LEAF_ID = '11111111-1111-4111-8111-111111111111'
const LEADER_PTY_ID = 'pty-leader'
const TEAMMATE_PTY_ID = 'pty-teammate'

function session(): WorkspaceSessionState {
  return {
    ...getDefaultWorkspaceSession(),
    tabsByWorktree: {
      [WORKTREE_ID]: [
        {
          id: TAB_ID,
          ptyId: LEADER_PTY_ID,
          worktreeId: WORKTREE_ID,
          title: 'Claude',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1
        }
      ]
    },
    terminalLayoutsByTabId: {
      [TAB_ID]: {
        root: { type: 'leaf', leafId: LEADER_LEAF_ID },
        activeLeafId: LEADER_LEAF_ID,
        expandedLeafId: null,
        ptyIdsByLeafId: { [LEADER_LEAF_ID]: LEADER_PTY_ID }
      }
    }
  }
}

function team(): AgentTeam {
  return {
    teamId: 'team-1',
    token: 'team-token',
    leaderPane: '%1',
    leaderHandle: 'unused',
    sessionName: 'dolphin',
    windowIndex: '0',
    tmuxValue: '/tmp/dolphin-claude-agent-teams/team-1,0,1',
    baseEnv: {
      TMUX: '/tmp/dolphin-claude-agent-teams/team-1,0,1',
      DOLPHIN_AGENT_TEAMS_TEAM_ID: 'team-1'
    },
    hostShell: 'default',
    panes: new Map([['%1', { fakePaneId: '%1', handle: null, index: 0 }]]),
    paneOrder: ['%1'],
    nextPaneNumber: 2,
    mainVertical: null,
    previouslyFocusedPane: null
  }
}

/** Leader is a renderer leaf (normal agent tab) or a runtime-owned PTY; both must keep teammate env. */
function createHarness(
  leaderKind: 'renderer-leaf' | 'runtime-pty',
  teamEnv: Record<string, string> = {}
) {
  let current = session()
  const repo = {
    id: REPO_ID,
    path: '/workspace',
    displayName: 'repo',
    badgeColor: 'blue',
    addedAt: 1
  }
  const store = {
    getRepos: () => [repo],
    getRepo: (id: string) => (id === REPO_ID ? repo : undefined),
    getWorkspaceSession: () => current,
    setWorkspaceSession: (next: WorkspaceSessionState) => {
      current = next
    },
    persistPtyBinding: () => true
  }
  const spawn = vi.fn(
    async (_args: {
      env?: Record<string, string>
      envToDelete?: string[]
      launchAgent?: string
    }) => ({
      id: TEAMMATE_PTY_ID
    })
  )
  const rendererSplitTerminal = vi.fn()
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the runtime reads only the store members defined above.
  const runtime = new DolphinRuntimeService(store as never)
  Object.assign(runtime, {
    resolveTerminalWorkspaceLaunchScope: vi.fn(async () => ({
      id: WORKTREE_ID,
      path: '/workspace',
      connectionId: null,
      repo,
      folderWorkspace: null
    }))
  })
  runtime.setPtyController({
    spawn,
    write: () => true,
    kill: () => true,
    retireRejectedPty: vi.fn(),
    getForegroundProcess: async () => null
  })
  runtime.setNotifier(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a split only calls these two notifier members.
    {
      revealTerminalSession: vi.fn().mockRejectedValue(new Error('not mounted in test')),
      splitTerminal: rendererSplitTerminal
    } as never
  )
  const rendererLeaf = leaderKind === 'renderer-leaf'
  runtime.syncWindowGraph(1, {
    tabs: rendererLeaf
      ? [
          {
            tabId: TAB_ID,
            worktreeId: WORKTREE_ID,
            title: 'Claude',
            activeLeafId: LEADER_LEAF_ID,
            layout: { type: 'leaf', leafId: LEADER_LEAF_ID } as const
          }
        ]
      : [],
    leaves: rendererLeaf
      ? [
          {
            tabId: TAB_ID,
            worktreeId: WORKTREE_ID,
            leafId: LEADER_LEAF_ID,
            paneRuntimeId: 1,
            ptyId: LEADER_PTY_ID
          }
        ]
      : [],
    mobileSessionTabs: []
  })
  runtime.registerPty(LEADER_PTY_ID, WORKTREE_ID, null, { tabId: TAB_ID, leafId: LEADER_LEAF_ID })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: names only private runtime members this harness reads; each is initialized in the constructor.
  const internals = runtime as unknown as {
    issueHandle: (leaf: unknown) => string
    issuePtyHandle: (pty: unknown) => string
    leaves: Map<string, unknown>
    ptysById: Map<
      string,
      { connected: boolean; launchToken: string | null; launchAgent: string | null }
    >
    claudeAgentTeams: {
      handleTmuxCompat: (request: unknown, api: AgentTeamsTerminalApi) => Promise<unknown>
    }
  }
  const leaderHandle = rendererLeaf
    ? internals.issueHandle([...internals.leaves.values()][0])
    : internals.issuePtyHandle(internals.ptysById.get(LEADER_PTY_ID))
  /** Drives the runtime's real AgentTeamsTerminalApi adapter, as the shim's split-window does. */
  const splitTeammate = async (): Promise<void> => {
    const base = team()
    const agentTeam = { ...base, leaderHandle, baseEnv: { ...base.baseEnv, ...teamEnv } }
    internals.claudeAgentTeams.handleTmuxCompat = async (_request, api) => {
      await api.splitTerminal(leaderHandle, {
        direction: 'vertical',
        command: 'claude --agent-id a',
        ...teammatePaneSpawnOptions(agentTeam, 'default', '%2'),
        agentTeamLeaderHandle: leaderHandle,
        activate: false
      })
      return { stdout: '', exitCode: 0 }
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stubbed service above ignores the request.
    const request = { teamId: 'team-1', token: 'team-token', argv: [] } as never
    await runtime.handleAgentTeamsTmuxCompat(request).catch(() => undefined)
  }
  return { spawn, rendererSplitTerminal, splitTeammate, internals }
}

describe.each(['renderer-leaf', 'runtime-pty'] as const)(
  'Agent Teams teammate split from a %s leader',
  (leaderKind) => {
    it('spawns the teammate main-side with the team env and a launch token', async () => {
      const harness = createHarness(leaderKind)

      await harness.splitTeammate()

      expect(harness.rendererSplitTerminal).not.toHaveBeenCalled()
      expect(harness.spawn).toHaveBeenCalledTimes(1)
      const spawned = harness.spawn.mock.calls[0]![0]
      const env = spawned.env ?? {}
      expect(Object.keys(env)).toEqual(
        expect.arrayContaining([
          'TMUX',
          'TMUX_PANE',
          'DOLPHIN_AGENT_TEAMS_TEAM_ID',
          'DOLPHIN_AGENT_TEAMS_LEADER_PANE',
          'DOLPHIN_AGENT_LAUNCH_TOKEN'
        ])
      )
      expect(env.TMUX_PANE).toBe('%2')
      expect(spawned.envToDelete).toEqual(['TERM_PROGRAM'])
      // Why: the runtime spawn preflight adds CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT for Claude launch agents.
      expect(spawned.launchAgent).toBe('claude')
      const teammate = harness.internals.ptysById.get(TEAMMATE_PTY_ID)
      expect(teammate?.launchToken).toBe(env.DOLPHIN_AGENT_LAUNCH_TOKEN)
      expect(teammate?.launchAgent).toBe('claude')
    })
  }
)

describe('Agent Teams teammate split when the leader has no live PTY', () => {
  it('falls back to the renderer split and warns once instead of failing', async () => {
    const harness = createHarness('renderer-leaf')
    const leader = harness.internals.ptysById.get(LEADER_PTY_ID)
    if (leader) {
      leader.connected = false
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    void harness.splitTeammate()
    void harness.splitTeammate()

    await vi.waitFor(() => expect(harness.rendererSplitTerminal).toHaveBeenCalledTimes(2))
    expect(harness.spawn).not.toHaveBeenCalled()
    const reasons = warn.mock.calls.filter(([message]) =>
      String(message).includes('terminal_split_agent_teammate_requires_live_pty')
    )
    expect(reasons).toHaveLength(1)
    warn.mockRestore()
  })
})

describe('Agent Teams teammate launch agent', () => {
  it('labels a DeepSeek team teammate as deepseek, not claude', async () => {
    const harness = createHarness('renderer-leaf', {
      [DEEPSEEK_PROVIDER_ENV_KEY]: DEEPSEEK_PROVIDER_ENV_VALUE
    })

    await harness.splitTeammate()

    expect(harness.spawn.mock.calls[0]![0].launchAgent).toBe('deepseek')
    expect(harness.internals.ptysById.get(TEAMMATE_PTY_ID)?.launchAgent).toBe('deepseek')
  })

  it('labels an API-key team teammate as claude-api and gives it the team account, not a key', async () => {
    const harness = createHarness('renderer-leaf', {
      [CLAUDE_API_PROVIDER_ENV_KEY]: CLAUDE_API_PROVIDER_ENV_VALUE,
      [CLAUDE_API_ACCOUNT_ENV_KEY]: 'api1'
    })

    await harness.splitTeammate()

    const spawned = harness.spawn.mock.calls[0]![0]
    expect(spawned.launchAgent).toBe('claude-api')
    expect(spawned.env?.[CLAUDE_API_ACCOUNT_ENV_KEY]).toBe('api1')
    expect(spawned.env?.ANTHROPIC_API_KEY).toBeUndefined()
    expect(harness.internals.ptysById.get(TEAMMATE_PTY_ID)?.launchAgent).toBe('claude-api')
  })
})
