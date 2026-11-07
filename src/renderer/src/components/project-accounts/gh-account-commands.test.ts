import { describe, expect, it } from 'vitest'
import {
  ghAuthLoginCommand,
  ghAuthLogoutCommand,
  normalizeGhHostInput
} from './gh-account-commands'

describe('gh account commands', () => {
  it('builds login and logout commands for valid hosts and logins', () => {
    expect(ghAuthLoginCommand('github.com')).toBe('gh auth login --hostname github.com --web')
    expect(ghAuthLoginCommand(' https://GHE.Example.test/ ')).toBe(
      'gh auth login --hostname ghe.example.test --web'
    )
    expect(ghAuthLogoutCommand('github.com', 'octo-cat')).toBe(
      'gh auth logout --hostname github.com --user octo-cat'
    )
  })

  it('refuses anything a shell could interpret', () => {
    expect(normalizeGhHostInput('github.com; rm -rf ~')).toBeNull()
    expect(normalizeGhHostInput('$(whoami).example')).toBeNull()
    expect(ghAuthLoginCommand('')).toBeNull()
    expect(ghAuthLogoutCommand('github.com', 'octo`id`')).toBeNull()
    expect(ghAuthLogoutCommand('github.com', 'a b')).toBeNull()
  })
})
