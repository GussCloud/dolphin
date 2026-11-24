import { describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { WorktreeMeta } from '../../../../shared/worktree/meta-types'
import type { Store } from '../../../persistence/loading-store/store'
import { createFolderWorkspace } from './folder-workspace-creation'

const repo: Repo = {
  id: 'folder-1',
  path: '/notes',
  displayName: 'Notes',
  badgeColor: '#000000',
  addedAt: 1,
  kind: 'folder'
}

function fakeStore(): { store: Store; setWorktreeMeta: ReturnType<typeof vi.fn> } {
  const setWorktreeMeta = vi.fn((_id: string, meta: Partial<WorktreeMeta>) => meta)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: createFolderWorkspace calls only setWorktreeMeta and the optional getProjectHostSetups.
  return { store: { setWorktreeMeta } as unknown as Store, setWorktreeMeta }
}

describe('createFolderWorkspace', () => {
  it('persists the permission policy and exposes it on the created workspace', () => {
    const { store, setWorktreeMeta } = fakeStore()
    const policy = { mode: 'catalog' as const, categories: ['mounted-drive' as const] }

    const result = createFolderWorkspace(
      { repoId: repo.id, name: 'notes', createdWithAgent: 'claude', agentPermissionPolicy: policy },
      repo,
      store
    )

    expect(setWorktreeMeta).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ agentPermissionPolicy: policy })
    )
    expect(result.worktree.agentPermissionPolicy).toEqual(policy)
  })

  it('stores no policy when none was chosen', () => {
    const { store, setWorktreeMeta } = fakeStore()

    const result = createFolderWorkspace({ repoId: repo.id, name: 'notes' }, repo, store)

    expect(setWorktreeMeta.mock.lastCall?.[1]).not.toHaveProperty('agentPermissionPolicy')
    expect(result.worktree).not.toHaveProperty('agentPermissionPolicy')
  })
})
