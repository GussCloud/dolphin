import { describe, expect, it } from 'vitest'
import {
  formatClaudeAgentTeamsWslGuestEnv,
  WSL_AGENT_TEAMS_GUEST_ENV_KEYS
} from '../../shared/claude-agent-teams-wsl-guest-env'
import { buildWslAgentTeamsTmuxShim } from '../cli/wsl-agent-teams-guest-scripts'
import { ClaudeAgentTeamsService } from './claude-agent-teams-service'

const ENDPOINT = `\\\\.\\pipe\\dolphin-agent-teams-42-${'a'.repeat(32)}`

function launchEnv(
  platform: NodeJS.Platform,
  baseEnv: Record<string, string> = {},
  endpoint: string | null = ENDPOINT
): Record<string, string> {
  const service = new ClaudeAgentTeamsService(platform)
  service.setPipeEndpoint(endpoint)
  return service.createLaunchEnv({
    leaderHandle: 'leader',
    baseEnv: { PATH: '/usr/bin', ...baseEnv },
    shimDir: '/shim',
    shimBin: '/usr/bin/dolphin'
  }).env
}

describe('Agent Teams pipe endpoint in the team env', () => {
  it('is injected on Windows when the listener is up', () => {
    expect(launchEnv('win32').DOLPHIN_AGENT_TEAMS_ENDPOINT).toBe(ENDPOINT)
  })

  it('is omitted off Windows and when no listener is up', () => {
    expect(launchEnv('linux')).not.toHaveProperty('DOLPHIN_AGENT_TEAMS_ENDPOINT')
    expect(launchEnv('darwin')).not.toHaveProperty('DOLPHIN_AGENT_TEAMS_ENDPOINT')
    expect(launchEnv('win32', {}, null)).not.toHaveProperty('DOLPHIN_AGENT_TEAMS_ENDPOINT')
  })

  it('is omitted when the shim routes to a remote runtime', () => {
    expect(launchEnv('win32', { DOLPHIN_PAIRING_CODE: 'code' })).not.toHaveProperty(
      'DOLPHIN_AGENT_TEAMS_ENDPOINT'
    )
    expect(launchEnv('win32', { DOLPHIN_ENVIRONMENT: 'remote' })).not.toHaveProperty(
      'DOLPHIN_AGENT_TEAMS_ENDPOINT'
    )
  })

  it('never crosses into a WSL guest', () => {
    const env = launchEnv('win32')
    expect(WSL_AGENT_TEAMS_GUEST_ENV_KEYS).not.toContain('DOLPHIN_AGENT_TEAMS_ENDPOINT')
    expect(formatClaudeAgentTeamsWslGuestEnv(env)).not.toContain('DOLPHIN_AGENT_TEAMS_ENDPOINT')
    expect(buildWslAgentTeamsTmuxShim('dolphin')).not.toContain('DOLPHIN_AGENT_TEAMS_ENDPOINT')
  })
})
