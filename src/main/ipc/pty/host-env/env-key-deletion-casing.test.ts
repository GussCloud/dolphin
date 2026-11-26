import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLAUDE_API_CONFLICTING_ENV_KEYS } from '../../../../shared/claude-api-provider'
import { enforceLocalPtySpawnEnvironmentOverrides } from '../../../providers/local-pty-spawn-environment'
import { deleteRequestedEnvKeys } from './path'

const originalPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

afterEach(() => {
  setPlatform(originalPlatform)
  vi.restoreAllMocks()
})

function inheritedEnv(): Record<string, string> {
  return {
    Anthropic_Base_Url: 'https://proxy.invalid',
    anthropic_auth_token: 'inherited-token',
    ANTHROPIC_API_KEY: 'sk-ant-fake',
    KEEP: '1'
  }
}

describe('API-key conflict strip and env-name casing', () => {
  it('removes any casing of a conflicting key on Windows, in both delete passes', () => {
    setPlatform('win32')
    const ipcEnv = inheritedEnv()
    deleteRequestedEnvKeys(ipcEnv, [...CLAUDE_API_CONFLICTING_ENV_KEYS])
    expect(ipcEnv).toEqual({ ANTHROPIC_API_KEY: 'sk-ant-fake', KEEP: '1' })

    const providerEnv = inheritedEnv()
    enforceLocalPtySpawnEnvironmentOverrides(
      { cols: 80, rows: 24, envToDelete: [...CLAUDE_API_CONFLICTING_ENV_KEYS] },
      providerEnv
    )
    expect(providerEnv).toEqual({ ANTHROPIC_API_KEY: 'sk-ant-fake', KEEP: '1' })
  })

  it('keeps exact-case deletion on POSIX', () => {
    setPlatform('linux')
    const value = inheritedEnv()
    deleteRequestedEnvKeys(value, [...CLAUDE_API_CONFLICTING_ENV_KEYS])
    expect(value).toEqual(inheritedEnv())
  })
})
