import { describe, expect, it } from 'vitest'
import type { Repo } from './repo-types'
import { needsProjectAccountSetup } from './project-account-setup'

function repo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'r1',
    path: '/work/app',
    displayName: 'app',
    badgeColor: '#000',
    addedAt: 0,
    ...overrides
  }
}

describe('needsProjectAccountSetup', () => {
  it('asks only for a local project from before per-project accounts', () => {
    expect(needsProjectAccountSetup(repo())).toBe(true)
  })

  it('never asks again once reviewed, nor for a project that already has an account', () => {
    expect(needsProjectAccountSetup(repo({ accountSetupReviewedAt: 1 }))).toBe(false)
    expect(needsProjectAccountSetup(repo({ claudeAccountId: 'a' }))).toBe(false)
    expect(needsProjectAccountSetup(repo({ ghAccount: { host: 'github.com', user: 'u' } }))).toBe(
      false
    )
    expect(
      needsProjectAccountSetup(repo({ commitIdentity: { name: 'A', email: 'a@x.test' } }))
    ).toBe(false)
  })

  it('leaves SSH and server projects alone: their agents use that host’s accounts', () => {
    expect(needsProjectAccountSetup(repo({ connectionId: 'ssh-1' }))).toBe(false)
    expect(needsProjectAccountSetup(repo({ executionHostId: 'runtime:env-1' }))).toBe(false)
  })
})
