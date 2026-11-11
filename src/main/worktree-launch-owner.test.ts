import { describe, expect, it } from 'vitest'
import type { WorktreeMeta } from '../shared/worktree/meta-types'
import { findLaunchAccountCandidates, type LaunchOwnerRepo } from './worktree-launch-owner'

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
  claudeAccountId: 'claude-company',
  codexAccountId: 'codex-company'
}

function ids(candidates: { accountId: string }[]): string[] {
  return candidates.map((candidate) => candidate.accountId)
}

describe('findLaunchAccountCandidates', () => {
  it('puts the worktree pin before the project default', () => {
    const candidates = findLaunchAccountCandidates(
      source({ [FEATURE_ID]: { agentAccountId: 'claude-pinned' } }, [WORK_REPO]),
      { worktreeId: FEATURE_ID },
      'claude'
    )
    expect(ids(candidates)).toEqual(['claude-pinned', 'claude-company'])
  })

  it('offers each agent its own project default', () => {
    const meta = source({ [FEATURE_ID]: {} }, [WORK_REPO])
    expect(ids(findLaunchAccountCandidates(meta, { worktreeId: FEATURE_ID }, 'claude'))).toEqual([
      'claude-company'
    ])
    expect(ids(findLaunchAccountCandidates(meta, { worktreeId: FEATURE_ID }, 'codex'))).toEqual([
      'codex-company'
    ])
  })

  it('finds the project from a cwd in the main checkout or an unpinned linked worktree', () => {
    const meta = source({ [FEATURE_ID]: {} }, [WORK_REPO])
    expect(
      ids(findLaunchAccountCandidates(meta, { workspacePath: '/repos/work/src' }, 'claude'))
    ).toEqual(['claude-company'])
    expect(
      ids(
        findLaunchAccountCandidates(
          meta,
          { workspacePath: '/repos/work-worktrees/feature' },
          'codex'
        )
      )
    ).toEqual(['codex-company'])
  })

  it('offers nothing for projects without a default and for SSH projects', () => {
    const personal: LaunchOwnerRepo = { id: 'repo-personal', path: '/repos/personal' }
    const remote: LaunchOwnerRepo = { ...WORK_REPO, id: 'repo-ssh', connectionId: 'ssh-1' }
    expect(
      findLaunchAccountCandidates(
        source({}, [personal]),
        { workspacePath: '/repos/personal' },
        'claude'
      )
    ).toEqual([])
    expect(
      findLaunchAccountCandidates(source({}, [remote]), { workspacePath: '/repos/work' }, 'claude')
    ).toEqual([])
  })

  it('keeps worktree-only behavior when the source exposes no projects', () => {
    expect(
      findLaunchAccountCandidates(
        { getWorktreeMeta: () => undefined, getAllWorktreeMeta: () => ({}) },
        { worktreeId: FEATURE_ID },
        'claude'
      )
    ).toEqual([])
  })
})
