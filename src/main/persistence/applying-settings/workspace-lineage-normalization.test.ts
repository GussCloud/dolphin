import { describe, expect, it } from 'vitest'
import { normalizeWorkspaceLineageByChildKey } from './ui-interaction-merge'

const lineage = {
  'worktree:repo-a::/w/feature/a': {
    childWorkspaceKey: 'worktree:repo-a::/w/feature/a',
    parentWorkspaceKey: 'folder:kept'
  },
  'worktree:repo-b::/w/feature/b': {
    childWorkspaceKey: 'worktree:repo-b::/w/feature/b',
    parentWorkspaceKey: 'folder:deleted'
  },
  'worktree:repo-c::/w/child': {
    childWorkspaceKey: 'worktree:repo-c::/w/child',
    parentWorkspaceKey: 'worktree:repo-c::/w/parent'
  }
}

describe('normalizeWorkspaceLineageByChildKey', () => {
  it('drops rows whose folder parent no longer exists', () => {
    const result = normalizeWorkspaceLineageByChildKey(lineage, new Set(['kept']))

    expect(Object.keys(result).sort()).toEqual([
      'worktree:repo-a::/w/feature/a',
      'worktree:repo-c::/w/child'
    ])
  })

  it('keeps every row when no folder catalog is given', () => {
    expect(Object.keys(normalizeWorkspaceLineageByChildKey(lineage))).toHaveLength(3)
  })
})
