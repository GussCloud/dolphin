import { describe, expect, it, vi } from 'vitest'
import { generateBranchName } from './source-control-text-generation-requests'
import { prepareLocalCommitMessageAgentEnv } from './commit-message-agent-environment'
import { getCommitMessageAgentSpec } from '../../shared/commit-message-agent-spec'
import {
  DEEPSEEK_PROVIDER_ENV_KEY,
  DEEPSEEK_PROVIDER_ENV_VALUE
} from '../../shared/deepseek-claude-provider'

const params = { agentId: 'deepseek' as const, model: 'default' }
const context = { firstPrompt: 'Fix login flow' }

describe('DeepSeek source control generation', () => {
  it('runs the claude CLI without --model, so the DeepSeek main slot answers', () => {
    const spec = getCommitMessageAgentSpec('deepseek')
    expect(spec?.binary).toBe('claude')
    expect(spec?.buildArgs({ prompt: '', model: 'default' })).not.toContain('--model')
  })

  it.each([
    [
      'over SSH',
      {
        kind: 'remote' as const,
        cwd: '/repo',
        missingBinaryLocation: 'remote PATH',
        execute: vi.fn()
      },
      'not on an SSH host'
    ],
    [
      'inside WSL',
      {
        kind: 'local' as const,
        cwd: '/repo',
        wslDistro: 'Ubuntu',
        env: { [DEEPSEEK_PROVIDER_ENV_KEY]: DEEPSEEK_PROVIDER_ENV_VALUE }
      },
      'not inside WSL'
    ],
    ['without its env', { kind: 'local' as const, cwd: '/repo' }, 'nothing was run']
  ])('never runs claude on the Anthropic login %s', async (_case, target, message) => {
    const spawnAgent = vi.fn()
    const result = await generateBranchName({ context, params, target, spawnAgent })
    expect(result).toMatchObject({ success: false, error: expect.stringContaining(message) })
    expect(spawnAgent).not.toHaveBeenCalled()
    if (target.kind === 'remote') {
      expect(target.execute).not.toHaveBeenCalled()
    }
  })

  it('spawns claude once the DeepSeek env is in place', async () => {
    const spawnAgent = vi.fn(() => {
      throw new Error('spawned')
    })
    await generateBranchName({
      context,
      params,
      target: {
        kind: 'local',
        cwd: '/repo',
        env: { [DEEPSEEK_PROVIDER_ENV_KEY]: DEEPSEEK_PROVIDER_ENV_VALUE }
      },
      spawnAgent
    }).catch(() => undefined)
    expect(spawnAgent).toHaveBeenCalledWith(expect.objectContaining({ binary: 'claude' }))
  })
})

describe('prepareLocalCommitMessageAgentEnv for DeepSeek', () => {
  it('refuses without a DeepSeek resolver instead of using the plain claude env', async () => {
    await expect(prepareLocalCommitMessageAgentEnv('deepseek', undefined)).resolves.toEqual({
      ok: false,
      error: 'DeepSeek text generation is not available in this process.'
    })
  })

  it('passes the user-facing reason when the key is missing', async () => {
    const result = await prepareLocalCommitMessageAgentEnv('deepseek', {
      prepareForDeepSeekLaunch: async () => {
        throw new Error('DeepSeek has no API key.')
      }
    })
    expect(result).toEqual({ ok: false, error: 'DeepSeek has no API key.' })
  })

  it('merges the DeepSeek env over the process env', async () => {
    const result = await prepareLocalCommitMessageAgentEnv('deepseek', {
      prepareForDeepSeekLaunch: async () => ({
        [DEEPSEEK_PROVIDER_ENV_KEY]: DEEPSEEK_PROVIDER_ENV_VALUE,
        CLAUDE_CONFIG_DIR: '/home/me/.claude-deepseek'
      })
    })
    expect(result).toMatchObject({
      ok: true,
      env: {
        [DEEPSEEK_PROVIDER_ENV_KEY]: DEEPSEEK_PROVIDER_ENV_VALUE,
        CLAUDE_CONFIG_DIR: '/home/me/.claude-deepseek'
      }
    })
  })
})
