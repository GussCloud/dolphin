import { describe, expect, it } from 'vitest'
import { pickRemoteCliEnv } from './remote-cli-env'

describe('pickRemoteCliEnv', () => {
  it('forwards SSH Dolphin terminal and worktree context for remote CLI calls', () => {
    expect(
      pickRemoteCliEnv({
        DOLPHIN_TERMINAL_HANDLE: 'term_ssh',
        DOLPHIN_WORKTREE_ID: 'repo::remote',
        DOLPHIN_PANE_KEY: 'pane-1',
        DOLPHIN_AGENT_LAUNCH_TOKEN: 'launch-secret',
        DOLPHIN_WORKSPACE_ID: 'workspace-1',
        DOLPHIN_USER_DATA_PATH: '/tmp/dolphin',
        PATH: '/usr/bin',
        SECRET_TOKEN: 'nope'
      })
    ).toEqual({
      DOLPHIN_TERMINAL_HANDLE: 'term_ssh',
      DOLPHIN_WORKTREE_ID: 'repo::remote',
      DOLPHIN_PANE_KEY: 'pane-1',
      DOLPHIN_AGENT_LAUNCH_TOKEN: 'launch-secret',
      DOLPHIN_WORKSPACE_ID: 'workspace-1',
      DOLPHIN_USER_DATA_PATH: '/tmp/dolphin',
      PATH: '/usr/bin'
    })
  })
})
