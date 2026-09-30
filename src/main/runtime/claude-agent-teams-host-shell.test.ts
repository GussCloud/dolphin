import { describe, expect, it } from 'vitest'
import { WORKTREE_ID_SEPARATOR } from '../../shared/worktree/id'
import {
  canLaunchAgentTeamPanes,
  isWslAgentTeamLeader,
  resolveAgentTeamHostShell,
  type AgentTeamHostShell,
  type AgentTeamLeaderExecution
} from './claude-agent-teams-host-shell'

const nativeLeader: AgentTeamLeaderExecution = {
  connectionId: null,
  isWsl: false,
  wslDistro: null,
  worktreeId: `repo-1${WORKTREE_ID_SEPARATOR}C:\\src\\app`
}

describe('resolveAgentTeamHostShell', () => {
  it('keeps the default shell off Windows, even without a known leader PTY', () => {
    expect(resolveAgentTeamHostShell(nativeLeader, 'darwin')).toBe('default')
    expect(resolveAgentTeamHostShell(null, 'linux')).toBe('default')
  })

  it('uses Git Bash for a local native Windows leader', () => {
    expect(resolveAgentTeamHostShell(nativeLeader, 'win32')).toBe('native-windows-git-bash')
    expect(resolveAgentTeamHostShell({ ...nativeLeader, isWsl: null }, 'win32')).toBe(
      'native-windows-git-bash'
    )
  })

  it('keeps the default shell for WSL and SSH leaders on Windows', () => {
    expect(resolveAgentTeamHostShell({ ...nativeLeader, isWsl: true }, 'win32')).toBe('default')
    expect(resolveAgentTeamHostShell({ ...nativeLeader, wslDistro: 'Ubuntu' }, 'win32')).toBe(
      'default'
    )
    expect(
      resolveAgentTeamHostShell(
        {
          ...nativeLeader,
          isWsl: null,
          worktreeId: `repo-1${WORKTREE_ID_SEPARATOR}\\\\wsl.localhost\\Ubuntu\\home\\me\\app`
        },
        'win32'
      )
    ).toBe('default')
    expect(resolveAgentTeamHostShell({ ...nativeLeader, connectionId: 'ssh-1' }, 'win32')).toBe(
      'default'
    )
  })

  it('refuses to guess on Windows when the leader PTY is unknown', () => {
    expect(resolveAgentTeamHostShell(null, 'win32')).toBeNull()
  })
})

describe('canLaunchAgentTeamPanes', () => {
  const gitBash = () => 'C:\\Program Files\\Git\\bin\\bash.exe'
  const noGitBash = () => null

  it('needs an absolute shim CLI on every host', () => {
    expect(
      canLaunchAgentTeamPanes({
        hostShell: 'default',
        leaderIsWsl: false,
        shimBin: null,
        resolveGitBash: gitBash
      })
    ).toBe(false)
    expect(
      canLaunchAgentTeamPanes({
        hostShell: 'default',
        leaderIsWsl: false,
        shimBin: '/bin/dolphin',
        resolveGitBash: noGitBash
      })
    ).toBe(true)
  })

  it('needs Git Bash when the leader is or may be native Windows', () => {
    const hostShells: (AgentTeamHostShell | null)[] = ['native-windows-git-bash', null]
    for (const hostShell of hostShells) {
      const shimBin = 'C:\\dolphin.exe'
      const base = { hostShell, leaderIsWsl: false, shimBin }
      expect(canLaunchAgentTeamPanes({ ...base, resolveGitBash: noGitBash })).toBe(false)
      expect(canLaunchAgentTeamPanes({ ...base, resolveGitBash: gitBash })).toBe(true)
    }
  })

  it('launches WSL leaders without a Windows shim CLI or Git Bash', () => {
    expect(
      canLaunchAgentTeamPanes({
        hostShell: 'default',
        leaderIsWsl: true,
        shimBin: null,
        resolveGitBash: noGitBash
      })
    ).toBe(true)
  })
})

describe('isWslAgentTeamLeader', () => {
  it('recognizes WSL leaders by PTY or by a WSL worktree path, on Windows only', () => {
    expect(isWslAgentTeamLeader({ ...nativeLeader, isWsl: true }, 'win32')).toBe(true)
    expect(isWslAgentTeamLeader({ ...nativeLeader, wslDistro: 'Ubuntu' }, 'win32')).toBe(true)
    expect(
      isWslAgentTeamLeader(
        {
          ...nativeLeader,
          worktreeId: `repo-1${WORKTREE_ID_SEPARATOR}\\\\wsl.localhost\\Ubuntu\\home\\me\\app`
        },
        'win32'
      )
    ).toBe(true)
    expect(isWslAgentTeamLeader({ ...nativeLeader, isWsl: true }, 'linux')).toBe(false)
  })

  it('rejects native, SSH and unknown leaders', () => {
    expect(isWslAgentTeamLeader(nativeLeader, 'win32')).toBe(false)
    expect(
      isWslAgentTeamLeader({ ...nativeLeader, isWsl: true, connectionId: 'ssh-1' }, 'win32')
    ).toBe(false)
    expect(isWslAgentTeamLeader(null, 'win32')).toBe(false)
  })
})
