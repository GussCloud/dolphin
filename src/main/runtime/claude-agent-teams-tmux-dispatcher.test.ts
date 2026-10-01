import { existsSync } from 'node:fs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentTeamHostShell } from './claude-agent-teams-host-shell'
import { ClaudeAgentTeamsTmuxDispatcher } from './claude-agent-teams-tmux-dispatcher'
import type { AgentTeam, AgentTeamsTerminalApi } from './claude-agent-teams-types'

type SplitOpts = Parameters<AgentTeamsTerminalApi['splitTerminal']>[1]

const TEAMMATE_COMMAND =
  "cd 'C:\\repo' && env CLAUDECODE=1 TOKEN='s3cr3t' 'C:\\claude.exe' --agent-id a"

let scriptDir: string

beforeEach(async () => {
  scriptDir = await mkdtemp(join(tmpdir(), 'agent-teams-dispatcher-'))
})

afterEach(async () => {
  await rm(scriptDir, { recursive: true, force: true })
})

function makeTeam(hostShell: AgentTeamHostShell): AgentTeam {
  return {
    teamId: 'team-1',
    token: 'token',
    leaderPane: '%1',
    leaderHandle: 'leader-handle',
    sessionName: 'dolphin',
    windowIndex: '0',
    tmuxValue: '/tmp/dolphin-claude-agent-teams/team-1,0,1',
    baseEnv: {},
    hostShell,
    panes: new Map([['%1', { fakePaneId: '%1', handle: 'leader-handle', index: 0 }]]),
    paneOrder: ['%1'],
    nextPaneNumber: 2,
    mainVertical: null,
    previouslyFocusedPane: null
  }
}

function setup(hostShell: AgentTeamHostShell) {
  const team = makeTeam(hostShell)
  const splits: { handle: string; opts: SplitOpts }[] = []
  const api = {
    splitTerminal: vi.fn(async (handle: string, opts: SplitOpts) => {
      splits.push({ handle, opts })
      return {
        handle: `teammate-${splits.length}`,
        tabId: 'tab-1',
        paneRuntimeId: -1
      }
    }),
    resolveHostShell: vi.fn(() => hostShell),
    readTerminal: vi.fn(async (handle: string) => ({
      handle,
      status: 'running' as const,
      tail: ['out'],
      truncated: false,
      nextCursor: null
    })),
    sendTerminal: vi.fn(async (handle: string) => ({ handle, accepted: true, bytesWritten: 1 })),
    focusTerminal: vi.fn(async (handle: string) => ({ handle, tabId: 'tab-1', worktreeId: 'wt' })),
    closeTerminal: vi.fn(async (handle: string) => ({ handle, tabId: 'tab-1', ptyKilled: true })),
    showTerminal: vi.fn()
  } satisfies AgentTeamsTerminalApi
  const dispatcher = new ClaudeAgentTeamsTmuxDispatcher(scriptDir)
  const tmux = (command: string, ...args: string[]) =>
    dispatcher.dispatch(team, command, args, '%1', api)
  return { team, api, splits, dispatcher, tmux }
}

const splitHolding = ['-d', '-t', '%1', '-h', '-l', '70%', '-P', '-F', '#{pane_id}', '--', 'cat']

describe('Git Bash teams (native Windows)', () => {
  it('keeps the cat holding pane pending and spawns once on respawn-pane', async () => {
    const { team, api, splits, tmux } = setup('native-windows-git-bash')

    await expect(tmux('split-window', ...splitHolding)).resolves.toBe('%2\n')
    expect(api.splitTerminal).not.toHaveBeenCalled()
    await expect(tmux('list-panes', '-F', '#{pane_id}')).resolves.toBe('%1\n%2\n')

    await tmux('respawn-pane', '-k', '-t', '%2', '--', TEAMMATE_COMMAND)

    expect(api.closeTerminal).not.toHaveBeenCalled()
    expect(splits).toHaveLength(1)
    expect(splits[0]!.handle).toBe('leader-handle')
    expect(splits[0]!.opts).toMatchObject({ direction: 'vertical', shellOverride: 'git-bash' })
    expect(splits[0]!.opts.env).not.toHaveProperty('MSYS2_ARG_CONV_EXCL')
    expect(splits[0]!.opts.env).not.toHaveProperty('MSYS_NO_PATHCONV')
    expect(team.panes.get('%2')?.handle).toBe('teammate-1')
  })

  it('runs a short source line as a launch arg instead of the secret-bearing command', async () => {
    const { splits, tmux } = setup('native-windows-git-bash')
    await tmux('split-window', ...splitHolding)
    await tmux('respawn-pane', '-k', '-t', '%2', '--', TEAMMATE_COMMAND)

    const sourceLine = splits[0]!.opts.command!
    expect(sourceLine).toMatch(/^\. '\/.+\.sh'$/)
    expect(sourceLine).not.toContain('s3cr3t')
    // Why the command stays set: a host that drops the option types it instead.
    expect(splits[0]!.opts.gitBashStartupCommandInArgs).toBe(true)
    expect(await readdir(scriptDir)).toHaveLength(1)
  })

  it('deletes the script when the pane is killed before it ran', async () => {
    const { team, api, dispatcher, tmux } = setup('native-windows-git-bash')
    await tmux('split-window', ...splitHolding)
    await tmux('respawn-pane', '-k', '-t', '%2', '--', TEAMMATE_COMMAND)
    await tmux('split-window', ...splitHolding)
    await tmux('respawn-pane', '-k', '-t', '%3', '--', TEAMMATE_COMMAND)
    const [first, second] = ['%2', '%3'].map((id) => team.panes.get(id)!.commandScriptPath!)

    await tmux('kill-pane', '-t', '%2')
    expect(api.closeTerminal).toHaveBeenCalledWith('teammate-1')
    expect(existsSync(first!)).toBe(false)
    expect(existsSync(second!)).toBe(true)

    await dispatcher.releaseTeam(team)
    expect(await readdir(scriptDir)).toEqual([])
  })

  it('removes the script and the pane when the spawn fails', async () => {
    const { team, api, tmux } = setup('native-windows-git-bash')
    await tmux('split-window', ...splitHolding)
    api.splitTerminal.mockRejectedValueOnce(new Error('terminal_split_source_not_found'))

    await expect(tmux('respawn-pane', '-k', '-t', '%2', '--', 'claude')).rejects.toThrow()

    expect(team.panes.has('%2')).toBe(false)
    expect(await readdir(scriptDir)).toEqual([])
  })

  it('answers pane commands for a pending pane without touching a terminal', async () => {
    const { team, api, tmux } = setup('native-windows-git-bash')
    await tmux('split-window', ...splitHolding)

    await expect(tmux('capture-pane', '-p', '-t', '%2')).resolves.toBe('\n')
    await expect(tmux('send-keys', '-t', '%2', 'hello', 'Enter')).resolves.toBe('')
    await expect(tmux('select-pane', '-t', '%2')).resolves.toBe('')
    await expect(tmux('display-message', '-t', '%2', '-p', '#{pane_id}')).resolves.toBe('%2\n')
    await expect(tmux('kill-pane', '-t', '%2')).resolves.toBe('')

    expect(api.readTerminal).not.toHaveBeenCalled()
    expect(api.sendTerminal).not.toHaveBeenCalled()
    expect(api.focusTerminal).not.toHaveBeenCalled()
    expect(api.closeTerminal).not.toHaveBeenCalled()
    expect(team.paneOrder).toEqual(['%1'])
  })

  it('stacks later teammates in the main-vertical column', async () => {
    const { splits, tmux } = setup('native-windows-git-bash')
    await tmux('split-window', ...splitHolding)
    await tmux('respawn-pane', '-k', '-t', '%2', '--', 'claude --agent-id a')
    await tmux('select-layout', '-t', '%1', 'main-vertical')
    await tmux('split-window', ...splitHolding)
    await tmux('respawn-pane', '-k', '-t', '%3', '--', 'claude --agent-id b')

    expect(splits.map(({ handle, opts }) => [handle, opts.direction])).toEqual([
      ['leader-handle', 'vertical'],
      ['teammate-1', 'horizontal']
    ])
  })

  it('splits from the nearest spawned ancestor when the origin is still pending', async () => {
    const { splits, tmux } = setup('native-windows-git-bash')
    await tmux('split-window', ...splitHolding)
    await tmux('split-window', ...splitHolding)
    await tmux('respawn-pane', '-k', '-t', '%3', '--', 'claude --agent-id b')

    expect(splits.map(({ handle, opts }) => [handle, opts.direction])).toEqual([
      ['leader-handle', 'vertical']
    ])
  })

  it('spawns a split-window that carries a real command right away', async () => {
    const { splits, tmux } = setup('native-windows-git-bash')
    await tmux('split-window', '-t', '%1', '-h', '-P', '-F', '#{pane_id}', '--', 'claude')

    expect(splits).toHaveLength(1)
    expect(splits[0]!.opts.gitBashStartupCommandInArgs).toBe(true)
  })
})

describe('default host shell teams', () => {
  it('keeps the placeholder split and respawns with the command typed as-is', async () => {
    const { api, splits, tmux } = setup('default')
    await tmux('split-window', ...splitHolding)
    await tmux('respawn-pane', '-k', '-t', '%2', '--', 'claude --agent-id a')

    expect(api.closeTerminal).toHaveBeenCalledWith('teammate-1')
    expect(splits.map(({ handle, opts }) => [handle, opts.command])).toEqual([
      ['leader-handle', 'cat'],
      ['leader-handle', 'claude --agent-id a']
    ])
    expect(splits[1]!.opts).not.toHaveProperty('shellOverride')
    expect(splits[1]!.opts).not.toHaveProperty('gitBashStartupCommandInArgs')
    expect(await readdir(scriptDir)).toEqual([])
  })
})
