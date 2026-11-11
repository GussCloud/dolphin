import { describe, expect, it } from 'vitest'
import type { WorktreeMeta } from '../shared/worktree/meta-types'
import { findLaunchWorktree, type LaunchOwnerRepo } from './worktree-launch-owner'

const FEATURE_ID = 'repo-work::/repos/work-worktrees/feature'

function source(
  metaById: Record<string, Pick<WorktreeMeta, 'agentAccountId'>>,
  repos: LaunchOwnerRepo[]
) {
  return {
    getWorktreeMeta: (id: string) => metaById[id],
    getAllWorktreeMeta: () => metaById,
    getRepos: () => repos
  }
}

const WORK_REPO: LaunchOwnerRepo = {
  id: 'repo-work',
  path: '/repos/work',
  agentAccountId: 'acct-company'
}

describe('findLaunchWorktree', () => {
  it('prefers the worktree pin over the project default', () => {
    const owner = findLaunchWorktree(
      source({ [FEATURE_ID]: { agentAccountId: 'acct-pinned' } }, [WORK_REPO]),
      { worktreeId: FEATURE_ID }
    )
    expect(owner?.meta.agentAccountId).toBe('acct-pinned')
  })

  it('falls back to the project default for an unpinned worktree of that project', () => {
    const owner = findLaunchWorktree(source({ [FEATURE_ID]: {} }, [WORK_REPO]), {
      worktreeId: FEATURE_ID
    })
    expect(owner).toEqual({ worktreeId: FEATURE_ID, meta: { agentAccountId: 'acct-company' } })
  })

  it('uses the project default for a cwd launch inside the main checkout', () => {
    const owner = findLaunchWorktree(source({}, [WORK_REPO]), {
      workspacePath: '/repos/work/src'
    })
    expect(owner?.meta.agentAccountId).toBe('acct-company')
  })

  it('uses the project default for a cwd launch inside an unpinned linked worktree', () => {
    const owner = findLaunchWorktree(source({ [FEATURE_ID]: {} }, [WORK_REPO]), {
      workspacePath: '/repos/work-worktrees/feature'
    })
    expect(owner?.meta.agentAccountId).toBe('acct-company')
  })

  it('keeps the active account for projects without a default and for SSH projects', () => {
    const personal: LaunchOwnerRepo = { id: 'repo-personal', path: '/repos/personal' }
    const remote: LaunchOwnerRepo = {
      id: 'repo-ssh',
      path: '/repos/work',
      agentAccountId: 'acct-company',
      connectionId: 'ssh-1'
    }
    expect(
      findLaunchWorktree(source({}, [personal]), { workspacePath: '/repos/personal' })
    ).toBeNull()
    expect(findLaunchWorktree(source({}, [remote]), { workspacePath: '/repos/work' })).toBeNull()
  })

  it('keeps worktree-only behavior when the source exposes no projects', () => {
    const owner = findLaunchWorktree(
      { getWorktreeMeta: () => undefined, getAllWorktreeMeta: () => ({}) },
      { worktreeId: FEATURE_ID }
    )
    expect(owner).toBeNull()
  })
})
