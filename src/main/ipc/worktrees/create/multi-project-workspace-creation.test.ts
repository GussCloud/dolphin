import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import type { WorktreeIpcContext } from '../worktree-ipc-context'

const mocks = vi.hoisted(() => ({
  createLocalWorktree: vi.fn(),
  executeWorktreeRemoval: vi.fn(),
  notifyReposChanged: vi.fn()
}))

vi.mock('../../worktree-remote', () => ({ createLocalWorktree: mocks.createLocalWorktree }))
vi.mock('../removal/execute-worktree-removal', () => ({
  executeWorktreeRemoval: mocks.executeWorktreeRemoval
}))
vi.mock('../../repos/repos-changed-notification', () => ({
  notifyReposChanged: mocks.notifyReposChanged
}))
vi.mock('../../../project-runtime-git-options', () => ({
  getWorktreeMirrorDistro: () => undefined
}))

import { createMultiProjectWorkspace } from './multi-project-workspace-creation'

let workspaceDir: string

function makeRepo(id: string): Repo {
  return {
    id,
    path: join(workspaceDir, 'sources', id),
    displayName: id,
    badgeColor: '#000',
    addedAt: 0,
    kind: 'git',
    projectGroupId: 'group'
  }
}

function makeContext() {
  const group: ProjectGroup = {
    id: 'group',
    name: 'Group',
    parentPath: join(workspaceDir, 'sources'),
    parentGroupId: null,
    createdFrom: 'folder-scan',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 0,
    updatedAt: 0
  }
  const repos = [makeRepo('api'), makeRepo('web')]
  const folderWorkspace: FolderWorkspace = {
    id: 'fw-1',
    projectGroupId: 'group',
    name: 'Feature',
    folderPath: '',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0
  }
  const store = {
    getSettings: () => ({ workspaceDir: join(workspaceDir, 'worktrees'), nestWorkspaces: false }),
    getProjectGroups: () => [group],
    getRepos: () => repos,
    createFolderWorkspace: vi.fn((input: { folderPath: string }) => ({
      ...folderWorkspace,
      folderPath: input.folderPath
    }))
  }
  const runtime = { deleteFolderWorkspace: vi.fn(async () => ({ deleted: true })) }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the orchestrator only touches the store/runtime members stubbed above.
  const context = { store, runtime, mainWindow: {} } as unknown as WorktreeIpcContext
  return { context, store, runtime }
}

describe('createMultiProjectWorkspace', () => {
  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'multi-project-'))
    mocks.createLocalWorktree.mockReset()
    mocks.executeWorktreeRemoval.mockReset()
    mocks.createLocalWorktree.mockImplementation(async (args: { repoId: string }, repo: Repo) => ({
      worktree: { id: `${repo.id}::${join(workspaceDir, 'worktrees', 'Feature', args.repoId)}` }
    }))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('creates one attached worktree per project inside the container', async () => {
    const { context, store } = makeContext()
    const containerPath = join(workspaceDir, 'worktrees', 'Feature')

    const result = await createMultiProjectWorkspace(context, {
      projectGroupId: 'group',
      name: 'Feature',
      repoIds: ['api', 'web'],
      setupDecision: 'skip'
    })

    expect(store.createFolderWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ projectGroupId: 'group', folderPath: containerPath })
    )
    expect(mocks.createLocalWorktree.mock.calls.map((call) => [call[0], call[5]])).toEqual([
      [
        {
          repoId: 'api',
          name: 'Feature',
          setupDecision: 'skip',
          parentWorkspace: 'folder:fw-1',
          telemetrySource: 'sidebar'
        },
        { worktreePath: join(containerPath, 'api') }
      ],
      [
        {
          repoId: 'web',
          name: 'Feature',
          setupDecision: 'skip',
          parentWorkspace: 'folder:fw-1',
          telemetrySource: 'sidebar'
        },
        { worktreePath: join(containerPath, 'web') }
      ]
    ])
    expect(result.members).toHaveLength(2)
    expect(existsSync(containerPath)).toBe(true)
  })

  it('rolls back created members, the workspace and the container when one project fails', async () => {
    const { context, runtime } = makeContext()
    mocks.createLocalWorktree
      .mockImplementationOnce(async (_args: unknown, repo: Repo) => ({
        worktree: { id: `${repo.id}::/created/api` }
      }))
      .mockRejectedValueOnce(new Error('branch exists.'))

    await expect(
      createMultiProjectWorkspace(context, {
        projectGroupId: 'group',
        name: 'Feature',
        repoIds: ['api', 'web']
      })
    ).rejects.toThrow('Could not create the worktree for "web": branch exists. Nothing was kept.')

    expect(mocks.executeWorktreeRemoval).toHaveBeenCalledTimes(1)
    expect(mocks.executeWorktreeRemoval.mock.calls[0][1]).toEqual({
      worktreeId: 'api::/created/api',
      force: true,
      skipArchive: true
    })
    expect(runtime.deleteFolderWorkspace).toHaveBeenCalledWith('fw-1')
    expect(existsSync(join(workspaceDir, 'worktrees', 'Feature'))).toBe(false)
  })

  it('refuses a name whose container folder already exists', async () => {
    const { context, store } = makeContext()
    await createMultiProjectWorkspace(context, {
      projectGroupId: 'group',
      name: 'Feature',
      repoIds: ['api']
    })

    await expect(
      createMultiProjectWorkspace(context, {
        projectGroupId: 'group',
        name: 'Feature',
        repoIds: ['api']
      })
    ).rejects.toThrow('already exists')
    expect(store.createFolderWorkspace).toHaveBeenCalledTimes(1)
  })
})
