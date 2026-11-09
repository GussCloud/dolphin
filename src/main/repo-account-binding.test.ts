import { describe, expect, it, vi } from 'vitest'
import type { Repo } from '../shared/repo-types'
import { RepoClone, RepoUpdate } from '../shared/rpc-contract/repo-params'
import { getRepoGitAccountContext } from './project-runtime-git-options'
import { applyRepoAccountBindingToNewRepo } from './repo-account-binding'

const identity = { name: 'Ana Dev', email: 'ana@corp.example' }

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

describe('getRepoGitAccountContext', () => {
  it('carries every binding of a local repo', () => {
    expect(
      getRepoGitAccountContext(
        repo({
          ghAccount: { host: 'github.com', user: 'alice' },
          azureDevOpsAccountId: 'acct',
          commitIdentity: identity
        })
      )
    ).toEqual({
      ghAccount: { host: 'github.com', user: 'alice' },
      azureDevOpsAccountId: 'acct',
      commitIdentity: identity
    })
    expect(getRepoGitAccountContext(repo())).toBeUndefined()
  })

  it('injects nothing for SSH repos, whose git runs in the remote relay', () => {
    expect(
      getRepoGitAccountContext(repo({ connectionId: 'box', commitIdentity: identity }))
    ).toBeUndefined()
  })
})

describe('applyRepoAccountBindingToNewRepo', () => {
  it('stores only valid choices through the host-scoped update path', () => {
    const updateRepo = vi.fn(() => repo({ commitIdentity: identity }))
    applyRepoAccountBindingToNewRepo({ updateRepo }, repo(), {
      commitIdentity: { name: ' Ana Dev ', email: 'ana@corp.example' },
      azureDevOpsAccountId: '../escape'
    })
    expect(updateRepo).toHaveBeenCalledWith('r1', { commitIdentity: identity }, 'local')
  })

  it('does not touch the row when nothing usable was chosen', () => {
    const updateRepo = vi.fn()
    const created = repo()
    expect(applyRepoAccountBindingToNewRepo({ updateRepo }, created, { commitIdentity: {} })).toBe(
      created
    )
    expect(updateRepo).not.toHaveBeenCalled()
  })
})

describe('wire params', () => {
  it('keeps clone requests from older clients valid and normalizes the new binding', () => {
    expect(RepoClone.parse({ url: 'u', destination: 'd' }).accountBinding).toBeUndefined()
    expect(
      RepoClone.parse({
        url: 'u',
        destination: 'd',
        accountBinding: { azureDevOpsAccountId: 'a1' }
      }).accountBinding
    ).toEqual({ azureDevOpsAccountId: 'a1' })
  })

  it('treats null as clear and a malformed value as absent on repo.update', () => {
    const cleared = RepoUpdate.parse({ repo: 'r1', updates: { commitIdentity: null } })
    expect(cleared.updates.commitIdentity).toBeNull()
    const malformed = RepoUpdate.parse({
      repo: 'r1',
      updates: { azureDevOpsAccountId: '../x', commitIdentity: { name: 'x', email: 'bad' } }
    })
    expect(malformed.updates.azureDevOpsAccountId).toBeUndefined()
    expect(malformed.updates.commitIdentity).toBeUndefined()
  })
})
