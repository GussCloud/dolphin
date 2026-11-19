import { describe, expect, it } from 'vitest'
import { composerLaunchPolicy } from './composer-launch-override'

describe('composerLaunchPolicy', () => {
  it('keeps an ordinary create on its usual route, env and trust dialog', () => {
    expect(composerLaunchPolicy(undefined)).toEqual({
      coordinatorEnv: false,
      pinTerminalTui: false,
      preAcceptFolderTrust: false
    })
  })

  it('gives a goal coordinator its env, the terminal TUI and pre-accepted trust', () => {
    expect(composerLaunchPolicy({ kind: 'autonomous-goal', prompt: 'p' })).toEqual({
      coordinatorEnv: true,
      pinTerminalTui: true,
      preAcceptFolderTrust: true
    })
  })

  it('gives a design agent the terminal TUI and trust, but no coordinator env', () => {
    expect(composerLaunchPolicy({ kind: 'design', prompt: 'p' })).toEqual({
      coordinatorEnv: false,
      pinTerminalTui: true,
      preAcceptFolderTrust: true
    })
  })
})
