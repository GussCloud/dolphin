import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEEPSEEK_PROVIDER_ENV_KEY } from '../../shared/deepseek-claude-provider'
import { ClaudeAgentTeamsLeaderRegistry } from './claude-agent-teams-leader-registry'
import { ClaudeAgentTeamsService } from './claude-agent-teams-service'
import { buildClaudeAgentTeamsLaunchPlan } from './claude-agent-teams-shim-env'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

const leaderEnv = {
  PATH: '/usr/bin',
  ANTHROPIC_AUTH_TOKEN: 'sk-secret',
  [DEEPSEEK_PROVIDER_ENV_KEY]: 'deepseek'
}

function createTeam(deepSeekProvider: boolean | undefined): {
  env: Record<string, string>
  registryText: string
} {
  const dir = mkdtempSync(join(tmpdir(), 'agent-teams-deepseek-'))
  tempDirs.push(dir)
  const registryPath = join(dir, 'leaders.json')
  const service = new ClaudeAgentTeamsService(
    'linux',
    new ClaudeAgentTeamsLeaderRegistry(() => registryPath)
  )
  const launch = service.createLaunchEnv({
    leaderHandle: 'leader',
    baseEnv: leaderEnv,
    shimDir: '/shim',
    shimBin: '/usr/bin/dolphin',
    paneKey: 'tab-1:leaf-1',
    ...(deepSeekProvider === undefined ? {} : { deepSeekProvider })
  })
  return { env: launch.env, registryText: readFileSync(registryPath, 'utf8') }
}

describe('Agent Teams DeepSeek provider marker', () => {
  it('marks a DeepSeek team so teammate panes resolve the DeepSeek env at spawn', () => {
    const { env, registryText } = createTeam(true)
    expect(env[DEEPSEEK_PROVIDER_ENV_KEY]).toBe('deepseek')
    expect(JSON.parse(registryText)[0].env[DEEPSEEK_PROVIDER_ENV_KEY]).toBe('deepseek')
  })

  it('never copies the API key into the team env or the persisted registry', () => {
    const { env, registryText } = createTeam(true)
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(registryText).not.toContain('sk-secret')
  })

  it('leaves Claude teams unmarked even when the leader env carries a stray marker', () => {
    for (const flag of [undefined, false]) {
      const { env } = createTeam(flag)
      expect(env[DEEPSEEK_PROVIDER_ENV_KEY]).toBeUndefined()
    }
  })

  it('keeps a DeepSeek team in-process when its shim would route to a remote runtime', () => {
    const service = new ClaudeAgentTeamsService('linux')
    for (const routing of [{ DOLPHIN_PAIRING_CODE: 'abc' }, { DOLPHIN_ENVIRONMENT: 'hub' }]) {
      const baseEnv = { PATH: '/usr/bin', ...routing }
      const deepSeek = service.createLaunchEnvFactory({
        leaderHandle: 'leader',
        baseEnv,
        launchAgent: 'deepseek-agent-teams'
      })
      expect(deepSeek('/shim', '/usr/bin/dolphin', ['/shim'])).toBeNull()
      // A Claude team keeps its remote routing exactly as before.
      const claude = service.createLaunchEnvFactory({
        leaderHandle: 'leader',
        baseEnv,
        launchAgent: 'claude-agent-teams'
      })
      expect(claude('/shim', '/usr/bin/dolphin', ['/shim'])).toMatchObject(routing)
    }
    expect(service.getActiveTeamCount()).toBe(2)
  })

  it('turns a refused team env into an in-process launch plan', async () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-teams-deepseek-cli-'))
    tempDirs.push(root)
    const cliName = process.platform === 'win32' ? 'dolphin-dev.cmd' : 'dolphin-dev'
    writeFileSync(join(root, cliName), '#!/usr/bin/env sh\n', { mode: 0o755 })
    const createTeamEnv = vi.fn(() => null)
    const plan = await buildClaudeAgentTeamsLaunchPlan({
      command: 'claude',
      mode: 'native-panes-shim',
      baseEnv: { PATH: root },
      resolveGitBash: () => 'C:/Program Files/Git/bin/bash.exe',
      createTeamEnv
    })
    expect(createTeamEnv).toHaveBeenCalledTimes(1)
    expect(plan?.teammateMode).toBe('in-process')
  })
})
