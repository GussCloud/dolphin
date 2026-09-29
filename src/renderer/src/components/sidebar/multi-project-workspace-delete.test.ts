import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { Worktree } from '../../../../shared/worktree/types'

const mocks = vi.hoisted(() => {
  const state: Record<string, unknown> = {}
  return { state, runWorktreeDeleteWithToast: vi.fn() }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('./run-worktree-delete-with-toast', () => ({
  runWorktreeDeleteWithToast: mocks.runWorktreeDeleteWithToast
}))

import {
  deleteMultiProjectWorkspace,
  openMultiProjectDeleteDialogIfNeeded
} from './multi-project-workspace-delete'
import { getMultiProjectWorkspaceMembers } from './multi-project-workspace-members'

function makeWorktree(id: string, repoId: string): Worktree {
  const partial = {
    id,
    repoId,
    path: id.split('::')[1] ?? '',
    displayName: repoId,
    branch: 'refs/heads/feature-x'
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the delete helpers only read id, repoId, hostId and displayName.
  return partial as Worktree
}

function makeWorkspace(overrides: Partial<FolderWorkspace> = {}): FolderWorkspace {
  return {
    id: 'mp-1',
    projectGroupId: null,
    kind: 'multi-project',
    name: 'feature-x',
    folderPath: '/workspaces/feature-x',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

const UI = makeWorktree('crm-ui::/workspaces/feature-x/crm-ui', 'crm-ui')
const API = makeWorktree('crm-api::/workspaces/feature-x/crm-api', 'crm-api')

function memberLineage(worktreeId: string) {
  return {
    childWorkspaceKey: `worktree:${worktreeId}`,
    parentWorkspaceKey: 'folder:mp-1'
  }
}

function seedState(workspace: FolderWorkspace = makeWorkspace()): void {
  mocks.state = {
    folderWorkspaces: [workspace],
    worktreesByRepo: { 'crm-ui': [UI], 'crm-api': [API] },
    workspaceLineageByChildKey: {
      [`worktree:${UI.id}`]: memberLineage(UI.id),
      [`worktree:${API.id}`]: memberLineage(API.id)
    },
    activeWorktreeId: 'folder:mp-1',
    openModal: vi.fn(),
    deleteFolderWorkspace: vi.fn(async () => true),
    setActiveWorktree: vi.fn()
  }
}

describe('multi-project workspace delete', () => {
  beforeEach(() => {
    mocks.runWorktreeDeleteWithToast.mockReset()
    seedState()
  })

  it('finds the member worktrees through lineage', () => {
    expect(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: seedState fills every catalog the lookup reads.
      getMultiProjectWorkspaceMembers(mocks.state as never, 'mp-1').map((member) => member.id)
    ).toEqual([UI.id, API.id])
  })

  it('opens the confirmation only for a multi-project workspace with members', () => {
    expect(openMultiProjectDeleteDialogIfNeeded('mp-1', 'local')).toBe(true)
    expect(mocks.state.openModal).toHaveBeenCalledWith('delete-multi-project-workspace', {
      folderWorkspaceId: 'mp-1',
      executionHostId: 'local'
    })

    seedState(makeWorkspace({ kind: undefined, projectGroupId: 'group' }))
    expect(openMultiProjectDeleteDialogIfNeeded('mp-1')).toBe(false)
  })

  it('deletes every member and then the workspace', async () => {
    mocks.runWorktreeDeleteWithToast.mockResolvedValue(true)

    await expect(
      deleteMultiProjectWorkspace({ folderWorkspaceId: 'mp-1', removeMembers: true })
    ).resolves.toBe(true)

    expect(mocks.runWorktreeDeleteWithToast).toHaveBeenCalledTimes(2)
    expect(mocks.state.deleteFolderWorkspace).toHaveBeenCalledWith('mp-1', undefined)
    expect(mocks.state.setActiveWorktree).toHaveBeenCalledWith(null)
  })

  it('keeps the workspace when a member refuses to delete', async () => {
    mocks.runWorktreeDeleteWithToast.mockResolvedValueOnce(false)

    await expect(
      deleteMultiProjectWorkspace({ folderWorkspaceId: 'mp-1', removeMembers: true })
    ).resolves.toBe(false)

    expect(mocks.runWorktreeDeleteWithToast).toHaveBeenCalledTimes(1)
    expect(mocks.state.deleteFolderWorkspace).not.toHaveBeenCalled()
  })

  it('keeps the member worktrees when asked to', async () => {
    await deleteMultiProjectWorkspace({ folderWorkspaceId: 'mp-1', removeMembers: false })

    expect(mocks.runWorktreeDeleteWithToast).not.toHaveBeenCalled()
    expect(mocks.state.deleteFolderWorkspace).toHaveBeenCalledTimes(1)
  })
})
