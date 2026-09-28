import { describe, expect, it, vi } from 'vitest'
import type { GitStatusEntry, GitUpstreamStatus } from '../../../../shared/git-status-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  runFolderWorkspaceBatch,
  type FolderWorkspaceBatchDeps
} from './folder-workspace-batch-git'
import type { FolderWorkspaceGitMember } from './folder-workspace-git-members'

function member(id: string): FolderWorkspaceGitMember {
  const repo: Repo = { id, path: `/r/${id}`, displayName: id, badgeColor: '#000', addedAt: 0 }
  const worktree: Worktree = {
    id: `${id}-wt`,
    path: `/w/${id}`,
    head: 'abc',
    branch: 'refs/heads/feature',
    isBare: false,
    isMainWorktree: false,
    repoId: id,
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
  return { repo, worktree }
}

function entry(area: GitStatusEntry['area'], extra: Partial<GitStatusEntry> = {}): GitStatusEntry {
  return { path: 'file.ts', status: 'modified', area, ...extra }
}

function deps(
  entries: Record<string, GitStatusEntry[]>,
  upstream: Record<string, GitUpstreamStatus>
): FolderWorkspaceBatchDeps {
  return {
    getStatusEntries: (worktreeId) => entries[worktreeId] ?? [],
    getUpstreamStatus: (worktreeId) => upstream[worktreeId],
    commit: vi.fn(async () => {}),
    push: vi.fn(async () => {}),
    pull: vi.fn(async () => {})
  }
}

describe('runFolderWorkspaceBatch', () => {
  it('commits only members with staged changes and no unresolved conflicts', async () => {
    const d = deps(
      {
        'api-wt': [entry('staged')],
        'web-wt': [entry('unstaged')],
        'lib-wt': [entry('staged'), entry('unstaged', { conflictStatus: 'unresolved' })]
      },
      {}
    )
    const outcomes = await runFolderWorkspaceBatch(
      'commit',
      [member('api'), member('web'), member('lib')],
      d,
      'msg'
    )
    expect(outcomes.map((outcome) => [outcome.repoName, outcome.status, outcome.error])).toEqual([
      ['api', 'done', undefined],
      ['web', 'skipped', 'nothing staged'],
      ['lib', 'skipped', 'has unresolved conflicts']
    ])
    expect(d.commit).toHaveBeenCalledTimes(1)
  })

  it('publishes members without upstream and skips up-to-date ones', async () => {
    const d = deps(
      {},
      {
        'web-wt': { hasUpstream: true, ahead: 0, behind: 0 },
        'lib-wt': { hasUpstream: true, ahead: 2, behind: 0 }
      }
    )
    const outcomes = await runFolderWorkspaceBatch(
      'push',
      [member('api'), member('web'), member('lib')],
      d
    )
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['done', 'skipped', 'done'])
    expect(vi.mocked(d.push).mock.calls.map((call) => [call[0].repo.id, call[1]])).toEqual([
      ['api', true],
      ['lib', false]
    ])
  })

  it('keeps going after a failure and reports it', async () => {
    const d = deps(
      {},
      {
        'api-wt': { hasUpstream: true, ahead: 0, behind: 1 },
        'web-wt': { hasUpstream: true, ahead: 0, behind: 1 }
      }
    )
    vi.mocked(d.pull).mockRejectedValueOnce(new Error('diverged'))
    const outcomes = await runFolderWorkspaceBatch('pull', [member('api'), member('web')], d)
    expect(outcomes.map((outcome) => [outcome.status, outcome.error])).toEqual([
      ['failed', 'diverged'],
      ['done', undefined]
    ])
  })
})
