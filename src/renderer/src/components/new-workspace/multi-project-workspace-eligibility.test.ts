import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import {
  isMultiProjectEligibleRepo,
  resolveMultiProjectMemberRepoIds
} from './multi-project-workspace-eligibility'

function makeRepo(id: string, overrides: Partial<Repo> = {}): Repo {
  return {
    id,
    path: `/code/${id}`,
    displayName: id,
    badgeColor: '#000',
    addedAt: 0,
    kind: 'git',
    ...overrides
  }
}

const repos = [
  makeRepo('saas'),
  makeRepo('crm-ui'),
  makeRepo('crm-api'),
  makeRepo('remote', { connectionId: 'ssh-1' }),
  makeRepo('notes', { kind: 'folder' })
]

describe('isMultiProjectEligibleRepo', () => {
  it.each([
    ['a local Git project', makeRepo('a'), true],
    ['an SSH project', makeRepo('a', { connectionId: 'ssh-1' }), false],
    ['a project on another host', makeRepo('a', { executionHostId: 'ssh:box' }), false],
    ['a folder project', makeRepo('a', { kind: 'folder' }), false],
    ['a custom worktree location', makeRepo('a', { worktreeBasePath: '/elsewhere' }), false]
  ])('%s → %s', (_label, repo, expected) => {
    expect(isMultiProjectEligibleRepo(repo)).toBe(expected)
  })
})

describe('resolveMultiProjectMemberRepoIds', () => {
  it('lists the primary project first, then each added one once', () => {
    expect(
      resolveMultiProjectMemberRepoIds({
        primaryRepoId: 'crm-ui',
        extraRepoIds: ['crm-api', 'saas', 'crm-api', 'crm-ui'],
        repos
      })
    ).toEqual(['crm-ui', 'crm-api', 'saas'])
  })

  it('falls back to a single-project create when nothing eligible was added', () => {
    expect(
      resolveMultiProjectMemberRepoIds({
        primaryRepoId: 'saas',
        extraRepoIds: ['remote', 'notes', 'gone', 'saas'],
        repos
      })
    ).toBeNull()
  })

  it('ignores added projects while the primary one is not eligible', () => {
    expect(
      resolveMultiProjectMemberRepoIds({ primaryRepoId: 'remote', extraRepoIds: ['saas'], repos })
    ).toBeNull()
    expect(
      resolveMultiProjectMemberRepoIds({ primaryRepoId: null, extraRepoIds: ['saas'], repos })
    ).toBeNull()
  })
})
