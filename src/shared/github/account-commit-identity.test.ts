import { describe, expect, it } from 'vitest'
import { parseGhAccountProfile, suggestCommitIdentityForGhProfile } from './account-commit-identity'

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

describe('parseGhAccountProfile', () => {
  it('reads the fields gh prints and trims them', () => {
    expect(
      parseGhAccountProfile(
        '{"login":"ana-corp","name":" Ana Dev ","email":"","id":42}\n',
        'github.com'
      )
    ).toEqual({ login: 'ana-corp', name: 'Ana Dev', email: null, id: 42, host: 'github.com' })
  })

  it('returns null for output that is not a usable profile', () => {
    expect(parseGhAccountProfile('not json', 'github.com')).toBeNull()
    expect(parseGhAccountProfile('null', 'github.com')).toBeNull()
    expect(parseGhAccountProfile('{"login":"  ","id":1}', 'github.com')).toBeNull()
    expect(parseGhAccountProfile('{"name":"Ana"}', 'github.com')).toBeNull()
  })

  it('drops an id that cannot form a noreply address', () => {
    expect(parseGhAccountProfile('{"login":"ana","id":-1}', 'github.com')?.id).toBeNull()
    expect(parseGhAccountProfile('{"login":"ana","id":"42"}', 'github.com')?.id).toBeNull()
  })
})
