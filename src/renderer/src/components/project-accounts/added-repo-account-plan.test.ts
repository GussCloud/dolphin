import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { GhAuthAccount } from '../../../../shared/github/auth-types'
import { planAddedRepoAccountStep } from './added-repo-account-plan'

const { listGhMock, listAzureMock } = vi.hoisted(() => ({
  listGhMock: vi.fn(),
  listAzureMock: vi.fn()
}))

vi.mock('./project-account-client', () => ({
  listGhHostAccounts: listGhMock,
  listAzureDevOpsManagedAccounts: listAzureMock
}))

const LOCAL = { kind: 'local' } as const

function repo(remoteKey: string | null, overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'repo-1',
    path: '/projects/app',
    displayName: 'app',
    badgeColor: '#000000',
    addedAt: 0,
    ...(remoteKey
      ? { gitRemoteIdentity: { canonicalKey: remoteKey, remoteName: 'origin', remoteUrl: '' } }
      : {}),
    ...overrides
  }
}

function gh(host: string, user: string, source: 'keyring' | 'env' = 'keyring'): GhAuthAccount {
  return {
    host,
    user,
    active: false,
    envToken: source === 'env' ? 'GH_TOKEN' : null,
    source,
    scopes: []
  }
}

beforeEach(() => {
  listGhMock.mockReset().mockResolvedValue({
    capability: 'supported',
    accounts: [gh('github.com', 'work-login'), gh('git.example.test', 'enterprise-login')]
  })
  listAzureMock.mockReset().mockResolvedValue([])
})

describe('planAddedRepoAccountStep', () => {
  it('offers the step for a GitHub remote with a bindable login', async () => {
    const plan = await planAddedRepoAccountStep(repo('github.com/acme/app'), LOCAL)
    expect(plan?.target).toEqual({ provider: 'github', host: 'github.com' })
    expect(plan?.error).toBeNull()
  })

  it('recognizes an enterprise host through the gh inventory', async () => {
    const plan = await planAddedRepoAccountStep(repo('git.example.test/acme/app'), LOCAL)
    expect(plan?.target).toEqual({ provider: 'github', host: 'git.example.test' })
  })

  it('registers as today when there is nothing to choose', async () => {
    listGhMock.mockResolvedValueOnce({
      capability: 'supported',
      accounts: [gh('github.com', 'env-login', 'env')]
    })
    expect(await planAddedRepoAccountStep(repo('github.com/acme/app'), LOCAL)).toBeNull()
    expect(await planAddedRepoAccountStep(repo('dev.azure.com/org/p/_git/app'), LOCAL)).toBeNull()
    expect(await planAddedRepoAccountStep(repo('gitlab.com/acme/app'), LOCAL)).toBeNull()
    expect(await planAddedRepoAccountStep(repo(null), LOCAL)).toBeNull()
  })

  it('skips SSH projects, folders and projects that already have a binding', async () => {
    const remote = 'github.com/acme/app'
    expect(
      await planAddedRepoAccountStep(repo(remote, { connectionId: 'ssh-1' }), LOCAL)
    ).toBeNull()
    expect(await planAddedRepoAccountStep(repo(remote, { kind: 'folder' }), LOCAL)).toBeNull()
    expect(
      await planAddedRepoAccountStep(
        repo(remote, { commitIdentity: { name: 'Dev', email: 'dev@example.test' } }),
        LOCAL
      )
    ).toBeNull()
    expect(listGhMock).not.toHaveBeenCalled()
  })

  it('offers Azure DevOps managed accounts for Azure Repos remotes', async () => {
    listAzureMock.mockResolvedValueOnce([
      { id: 'ado-1', login: 'dev@example.test', configDirName: 'ado-1', createdAt: 1 }
    ])
    const plan = await planAddedRepoAccountStep(repo('dev.azure.com/org/p/_git/app'), LOCAL)
    expect(plan?.target.provider).toBe('azure-devops')
    expect(plan?.azureAccounts).toHaveLength(1)
  })

  it('lists the WSL distro gh for a WSL project and surfaces a listing failure', async () => {
    listGhMock.mockRejectedValueOnce(new Error('Invalid WSL distro name: bad name'))
    const plan = await planAddedRepoAccountStep(
      repo('github.com/acme/app', { path: '\\\\wsl.localhost\\Ubuntu\\home\\dev\\app' }),
      LOCAL
    )
    expect(listGhMock).toHaveBeenCalledWith(LOCAL, { wslDistro: 'Ubuntu' })
    expect(plan?.error).toBe('Invalid WSL distro name: bad name')
  })
})
