import { describe, expect, it } from 'vitest'
import { DEEPSEEK_PROVIDER_ENV_KEY } from '../../../../shared/deepseek-claude-provider'
import { isClaudeLaunchCommand, isManagedClaudeAuthLaunch } from './fresh-spawn-routing'

const MARKED_ENV = { [DEEPSEEK_PROVIDER_ENV_KEY]: 'deepseek' }

// The expression both preflights used before DeepSeek existed.
function legacyIsClaudeLaunch(args: {
  command: string | undefined
  connectionId: string | null | undefined
  preAdoptedStablePane: boolean
}): boolean {
  return !args.preAdoptedStablePane && !args.connectionId && isClaudeLaunchCommand(args.command)
}

const COMMANDS = [
  'claude',
  'claude --teammate-mode auto',
  "cd '/repo' && env CLAUDECODE=1 '/usr/bin/claude' --agent-id a",
  'C:\\Users\\me\\.local\\bin\\claude.exe --resume abc',
  'dolphin claude-teams',
  'codex',
  undefined
]

describe('isManagedClaudeAuthLaunch', () => {
  it('matches the legacy gate for every non-DeepSeek launch', () => {
    for (const command of COMMANDS) {
      for (const launchAgent of [undefined, 'claude', 'claude-agent-teams', 'codex']) {
        for (const connectionId of [null, undefined, 'ssh-1']) {
          for (const preAdoptedStablePane of [false, true]) {
            for (const env of [undefined, {}, { ANTHROPIC_API_KEY: 'sk' }]) {
              expect(
                isManagedClaudeAuthLaunch({
                  command,
                  launchAgent,
                  env,
                  connectionId,
                  preAdoptedStablePane
                })
              ).toBe(legacyIsClaudeLaunch({ command, connectionId, preAdoptedStablePane }))
            }
          }
        }
      }
    }
  })

  it('still gates a real Claude launch', () => {
    expect(
      isManagedClaudeAuthLaunch({
        command: 'claude',
        launchAgent: 'claude',
        env: {},
        connectionId: null,
        preAdoptedStablePane: false
      })
    ).toBe(true)
  })

  it('exempts DeepSeek launches and marked teammate panes', () => {
    for (const launchAgent of ['deepseek', 'deepseek-agent-teams']) {
      expect(
        isManagedClaudeAuthLaunch({
          command: 'claude --teammate-mode auto',
          launchAgent,
          env: {},
          connectionId: null,
          preAdoptedStablePane: false
        })
      ).toBe(false)
    }
    expect(
      isManagedClaudeAuthLaunch({
        command: "cd '/repo' && env CLAUDECODE=1 '/usr/bin/claude' --agent-id a",
        launchAgent: undefined,
        env: MARKED_ENV,
        connectionId: null,
        preAdoptedStablePane: false
      })
    ).toBe(false)
  })
})
