import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { Repo } from '../../../../shared/repo-types'
import type { WorktreeIpcContext } from '../worktree-ipc-context'

const mocks = vi.hoisted(() => ({ createLocalWorktree: vi.fn() }))

vi.mock('../../worktree-remote', () => ({ createLocalWorktree: mocks.createLocalWorktree }))
vi.mock('../../../project-runtime-git-options', () => ({
  getWorktreeMirrorDistro: () => undefined
}))

import { addMultiProjectWorkspaceMember } from './multi-project-member-addition'

const WORKSPACE_DIR = join('/', 'workspaces')
const CONTAINER = join(WORKSPACE_DIR, 'feature-x')

function makeRepo(id: string): Repo {
  return {
    id,
    path: join('/', 'code', `${id}-home`, id),
    displayName: id,
    badgeColor: '#000',
    addedAt: 0,
    kind: 'git'
  }
}

function makeContext(workspace: Partial<FolderWorkspace> = {}) {
  const folderWorkspace: FolderWorkspace = {
    id: 'mp-1',
    projectGroupId: null,
    kind: 'multi-project',
    name: 'feature-x',
    folderPath: CONTAINER,
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...workspace
  }
  const store = {
    getSettings: () => ({ workspaceDir: WORKSPACE_DIR, nestWorkspaces: false }),
    getRepos: () => [makeRepo('crm-ui'), makeRepo('crm-api')],
    getFolderWorkspace: (id: string) => (id === folderWorkspace.id ? folderWorkspace : undefined),
    getAllWorkspaceLineage: () => ({
      [`worktree:crm-ui::${join(CONTAINER, 'crm-ui')}`]: {
        childWorkspaceKey: `worktree:crm-ui::${join(CONTAINER, 'crm-ui')}`,
        parentWorkspaceKey: 'folder:mp-1'
      }
    })
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the addition only touches the store members stubbed above.
  return { store, runtime: {}, mainWindow: {} } as unknown as WorktreeIpcContext
}

describe('addMultiProjectWorkspaceMember', () => {
  beforeEach(() => {
    mocks.createLocalWorktree.mockReset()
    mocks.createLocalWorktree.mockResolvedValue({ worktree: { id: 'crm-api::created' } })
  })

  it('creates the new member beside the others, on the shared branch', async () => {
    await addMultiProjectWorkspaceMember(makeContext(), {
      folderWorkspaceId: 'mp-1',
      repoId: 'crm-api',
      branchName: 'feature-x'
    })

    expect(mocks.createLocalWorktree.mock.calls[0][0]).toEqual({
      repoId: 'crm-api',
      name: 'feature-x',
      branchNameOverride: 'feature-x',
      parentWorkspace: 'folder:mp-1',
      telemetrySource: 'sidebar'
    })
    expect(mocks.createLocalWorktree.mock.calls[0][5]).toEqual({
      worktreePath: join(CONTAINER, 'crm-api')
    })
  })

  it('refuses a project that is already a member', async () => {
    await expect(
      addMultiProjectWorkspaceMember(makeContext(), { folderWorkspaceId: 'mp-1', repoId: 'crm-ui' })
    ).rejects.toThrow('already in the workspace')
    expect(mocks.createLocalWorktree).not.toHaveBeenCalled()
  })

  it('refuses a plain folder workspace', async () => {
    await expect(
      addMultiProjectWorkspaceMember(makeContext({ kind: undefined, projectGroupId: 'group' }), {
        folderWorkspaceId: 'mp-1',
        repoId: 'crm-api'
      })
    ).rejects.toThrow('Multi-project workspace not found.')
  })
})
