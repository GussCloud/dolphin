import { describe, expect, it } from 'vitest'
import { filterAzureDevOpsRepositories } from './AzureReposClonePicker'

const repos = [
  {
    name: 'api',
    project: 'Platform',
    remoteUrl: 'u1',
    sshUrl: null,
    webUrl: null,
    defaultBranch: null
  },
  {
    name: 'web',
    project: 'Frontend',
    remoteUrl: 'u2',
    sshUrl: null,
    webUrl: null,
    defaultBranch: null
  }
]

describe('filterAzureDevOpsRepositories', () => {
  it('matches project or repository name, case-insensitively', () => {
    expect(filterAzureDevOpsRepositories(repos, 'FRONT').map((repo) => repo.name)).toEqual(['web'])
    expect(filterAzureDevOpsRepositories(repos, 'platform/api').map((repo) => repo.name)).toEqual([
      'api'
    ])
    expect(filterAzureDevOpsRepositories(repos, '  ')).toHaveLength(2)
  })
})
