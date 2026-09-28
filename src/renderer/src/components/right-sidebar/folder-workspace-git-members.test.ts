import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  getFolderWorkspaceGitMembers,
  resolveSelectedFolderWorkspaceMember
} from './folder-workspace-git-members'

function makeRepo(id: string, displayName: string, kind: Repo['kind'] = 'git'): Repo {
  return { id, path: `/repos/${id}`, displayName, badgeColor: '#000', addedAt: 0, kind }
}

function makeWorktree(id: string, repoId: string): Worktree {
  return {
    id,
    path: `/worktrees/${id}`,
    head: 'abc',
    branch: 'refs/heads/feature',
    isBare: false,
    isMainWorktree: false,
    repoId,
    displayName: id,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    linkedGitLabMR: null,
    linkedGitLabIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0
  }
}

describe('getFolderWorkspaceGitMembers', () => {
  it('keeps git members sorted by repo name and drops folder or unknown repos', () => {
    const repos = new Map([
      ['web', makeRepo('web', 'web')],
      ['api', makeRepo('api', 'api')],
      ['notes', makeRepo('notes', 'notes', 'folder')]
    ])
    const members = getFolderWorkspaceGitMembers(
      [
        makeWorktree('web-wt', 'web'),
        makeWorktree('notes-wt', 'notes'),
        makeWorktree('orphan-wt', 'missing'),
        makeWorktree('api-wt', 'api')
      ],
      repos
    )
    expect(members.map((member) => member.worktree.id)).toEqual(['api-wt', 'web-wt'])
  })
})

describe('resolveSelectedFolderWorkspaceMember', () => {
  const repos = new Map([
    ['api', makeRepo('api', 'api')],
    ['web', makeRepo('web', 'web')]
  ])
  const members = getFolderWorkspaceGitMembers(
    [makeWorktree('api-wt', 'api'), makeWorktree('web-wt', 'web')],
    repos
  )

  it('keeps a selection that is still a member', () => {
    expect(resolveSelectedFolderWorkspaceMember(members, 'web-wt')?.worktree.id).toBe('web-wt')
  })

  it('falls back to the first member when the selection is gone', () => {
    expect(resolveSelectedFolderWorkspaceMember(members, 'removed')?.worktree.id).toBe('api-wt')
    expect(resolveSelectedFolderWorkspaceMember([], 'web-wt')).toBeNull()
  })
})
