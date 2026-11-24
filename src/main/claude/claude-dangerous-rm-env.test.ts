import { describe, expect, it } from 'vitest'
import { ClaudeAgentTeamsService } from '../runtime/claude-agent-teams-service'
import { withClaudeDangerousRmNoTimeoutEnv } from './claude-dangerous-rm-launch-env'
import {
  CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV as NO_TIMEOUT,
  forwardClaudeDangerousRmEnvToWsl,
  resolveClaudeDangerousRmNoTimeoutValue
} from './claude-dangerous-rm-prompt-env'

describe('resolveClaudeDangerousRmNoTimeoutValue', () => {
  it('defaults to 1 and forwards a value the user already set', () => {
    expect(resolveClaudeDangerousRmNoTimeoutValue({}, {})).toBe('1')
    expect(
      resolveClaudeDangerousRmNoTimeoutValue({ [NO_TIMEOUT]: '0' }, { [NO_TIMEOUT]: '1' })
    ).toBe('0')
    // Why explicit: an SSH host or teammate pane does not inherit this process's env.
    expect(resolveClaudeDangerousRmNoTimeoutValue({}, { [NO_TIMEOUT]: '0' })).toBe('0')
  })
})

describe('withClaudeDangerousRmNoTimeoutEnv', () => {
  it.each([
    [{ launchAgent: 'claude', command: undefined }],
    [{ launchAgent: 'claude-agent-teams', command: undefined }],
    [{ launchAgent: 'deepseek', command: undefined }],
    [{ launchAgent: 'deepseek-agent-teams', command: undefined }],
    [{ launchAgent: undefined, command: '/usr/bin/claude --agent-id a' }]
  ])('adds it for %j', (launch) => {
    expect(withClaudeDangerousRmNoTimeoutEnv({ A: 'b' }, launch, {})).toEqual({
      A: 'b',
      [NO_TIMEOUT]: '1'
    })
  })

  it('leaves non-Claude launches unchanged', () => {
    const env = { A: 'b' }
    expect(
      withClaudeDangerousRmNoTimeoutEnv(env, { launchAgent: 'codex', command: 'codex' }, {})
    ).toBe(env)
    expect(
      withClaudeDangerousRmNoTimeoutEnv(
        undefined,
        { launchAgent: undefined, command: undefined },
        {}
      )
    ).toBeUndefined()
  })

  it('does not override the user', () => {
    const launch = { launchAgent: 'claude', command: 'claude' }
    expect(withClaudeDangerousRmNoTimeoutEnv({ [NO_TIMEOUT]: '0' }, launch, {})).toEqual({
      [NO_TIMEOUT]: '0'
    })
    expect(withClaudeDangerousRmNoTimeoutEnv({}, launch, { [NO_TIMEOUT]: '0' })).toEqual({
      [NO_TIMEOUT]: '0'
    })
  })
})

describe('forwardClaudeDangerousRmEnvToWsl', () => {
  it('names the var in WSLENV only when set', () => {
    const env: Record<string, string | undefined> = { WSLENV: 'A', [NO_TIMEOUT]: '1' }
    forwardClaudeDangerousRmEnvToWsl(env)
    expect(env.WSLENV).toBe(`A:${NO_TIMEOUT}`)
    const unset: Record<string, string | undefined> = { WSLENV: 'A' }
    forwardClaudeDangerousRmEnvToWsl(unset)
    expect(unset.WSLENV).toBe('A')
  })
})

describe('Agent Teams teammate pane env', () => {
  const createTeam = (baseEnv: Record<string, string | undefined>) =>
    new ClaudeAgentTeamsService().createLaunchEnv({
      leaderHandle: 'leader-handle',
      baseEnv,
      shimDir: '/shim',
      shimBin: '/dolphin'
    })

  it('carries the no-timeout env to teammates, since Claude does not forward it to tmux panes', () => {
    const previous = process.env[NO_TIMEOUT]
    delete process.env[NO_TIMEOUT]
    try {
      const launch = createTeam({ PATH: '/usr/bin' })
      expect(launch.env[NO_TIMEOUT]).toBe('1')
      // The team env is each teammate pane's base env (paneEnv spreads team.baseEnv).
      expect(createTeam({ [NO_TIMEOUT]: '0' }).env[NO_TIMEOUT]).toBe('0')
      process.env[NO_TIMEOUT] = '0'
      expect(createTeam({}).env[NO_TIMEOUT]).toBe('0')
      delete process.env[NO_TIMEOUT]
    } finally {
      if (previous !== undefined) {
        process.env[NO_TIMEOUT] = previous
      }
    }
  })
})
