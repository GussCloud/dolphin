import { describe, expect, it } from 'vitest'
import { suggestCommitIdentityForGhProfile } from './account-commit-identity'

describe('suggestCommitIdentityForGhProfile', () => {
  it('prefers the public email and the profile name', () => {
    expect(
      suggestCommitIdentityForGhProfile({
        login: 'ana-corp',
        name: 'Ana Dev',
        email: 'ana@corp.example',
        id: 42,
        host: 'github.com'
      })
    ).toEqual({ name: 'Ana Dev', email: 'ana@corp.example' })
  })

  it('falls back to the github.com noreply address and the login for a private profile', () => {
    expect(
      suggestCommitIdentityForGhProfile({
        login: 'ana-corp',
        name: null,
        email: null,
        id: 42,
        host: 'github.com'
      })
    ).toEqual({ name: 'ana-corp', email: '42+ana-corp@users.noreply.github.com' })
  })

  it('suggests nothing for a private GHES profile, whose noreply format is server-specific', () => {
    expect(
      suggestCommitIdentityForGhProfile({
        login: 'ana',
        name: 'Ana',
        email: null,
        id: 7,
        host: 'ghe.corp.example'
      })
    ).toBeNull()
  })
})
