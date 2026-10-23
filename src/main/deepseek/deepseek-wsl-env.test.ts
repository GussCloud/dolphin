import { describe, expect, it } from 'vitest'
import {
  DEEPSEEK_CLAUDE_ENV_KEYS,
  DEEPSEEK_PROVIDER_ENV_KEY
} from '../../shared/deepseek-claude-provider'
import { forwardDeepSeekEnvToWsl } from './deepseek-wsl-env'

describe('forwardDeepSeekEnvToWsl', () => {
  it('names every DeepSeek key in WSLENV for a DeepSeek pane, keeping existing entries', () => {
    const env: Record<string, string | undefined> = {
      [DEEPSEEK_PROVIDER_ENV_KEY]: 'deepseek',
      WSLENV: 'CODEX_HOME:CLAUDE_CONFIG_DIR'
    }
    forwardDeepSeekEnvToWsl(env)
    const names = (env.WSLENV ?? '').split(':')
    expect(names.slice(0, 2)).toEqual(['CODEX_HOME', 'CLAUDE_CONFIG_DIR'])
    for (const key of DEEPSEEK_CLAUDE_ENV_KEYS) {
      expect(names).toContain(key)
    }
    expect(names.filter((name) => name === 'CLAUDE_CONFIG_DIR')).toHaveLength(1)
  })

  it('leaves every other pane untouched', () => {
    const env: Record<string, string | undefined> = { WSLENV: 'CODEX_HOME', ANTHROPIC_MODEL: 'x' }
    forwardDeepSeekEnvToWsl(env)
    expect(env.WSLENV).toBe('CODEX_HOME')
  })
})
