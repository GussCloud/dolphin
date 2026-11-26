import { describe, expect, it, vi } from 'vitest'
import { resolveGenerationTarget } from './first-work-generation-target'

describe('resolveGenerationTarget', () => {
  it.each(['claude-api', 'deepseek'])(
    'refuses %s on a WSL worktree before preparing any env',
    async (agentId) => {
      const prepareForClaudeApiLaunch = vi.fn(async () => ({}))
      const prepareForDeepSeekLaunch = vi.fn(async () => ({}))
      const target = await resolveGenerationTarget(
        '\\\\wsl.localhost\\Ubuntu\\home\\me\\repo',
        agentId,
        null,
        { getAgentEnvResolvers: () => ({ prepareForClaudeApiLaunch, prepareForDeepSeekLaunch }) }
      )
      expect(target).toBeNull()
      expect(prepareForClaudeApiLaunch).not.toHaveBeenCalled()
      expect(prepareForDeepSeekLaunch).not.toHaveBeenCalled()
    }
  )

  it('keeps plain claude on a WSL worktree as before', async () => {
    const target = await resolveGenerationTarget(
      '\\\\wsl.localhost\\Ubuntu\\home\\me\\repo',
      'claude',
      null,
      { getAgentEnvResolvers: () => undefined }
    )
    expect(target).toMatchObject({ kind: 'local' })
  })

  it('prepares the API account env for a host worktree, with the worktree for its pin', async () => {
    const prepareForClaudeApiLaunch = vi.fn(async () => ({
      DOLPHIN_CLAUDE_PROVIDER: 'anthropic-api'
    }))
    const target = await resolveGenerationTarget('/repo/wt', 'claude-api', null, {
      getAgentEnvResolvers: () => ({ prepareForClaudeApiLaunch })
    })
    expect(prepareForClaudeApiLaunch).toHaveBeenCalledWith(undefined, { workspacePath: '/repo/wt' })
    expect(target).toMatchObject({
      kind: 'local',
      env: { DOLPHIN_CLAUDE_PROVIDER: 'anthropic-api' }
    })
  })
})
