import { describe, expect, it } from 'vitest'
import { deletePlatformEnvKeys } from './platform-env-key-deletion'

function env(): Record<string, string> {
  return { Anthropic_Base_Url: 'https://proxy.invalid', ANTHROPIC_AUTH_TOKEN: 't', KEEP: '1' }
}

describe('deletePlatformEnvKeys', () => {
  it('deletes any casing of a requested key on win32', () => {
    const value = env()
    deletePlatformEnvKeys(value, ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'], 'win32')
    expect(value).toEqual({ KEEP: '1' })
  })

  it('keeps exact-case deletion on POSIX, where the names are different variables', () => {
    const value = env()
    deletePlatformEnvKeys(value, ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'], 'linux')
    expect(value).toEqual({ Anthropic_Base_Url: 'https://proxy.invalid', KEEP: '1' })
  })
})
