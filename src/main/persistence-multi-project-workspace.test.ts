import { closeTestStores, testState, createStore, makeRepo } from './persistence-test-harness'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { WorkspaceLineage } from '../shared/worktree/lineage-types'
import { folderWorkspaceKey } from '../shared/workspace-scope'

vi.mock('electron', () => ({
  app: { getPath: () => testState.dir },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (plaintext: string) => Buffer.from(plaintext, 'utf-8'),
    decryptString: (ciphertext: Buffer) => ciphertext.toString('utf-8')
  }
}))

vi.mock('./telemetry/client', () => ({ track: vi.fn() }))

function memberLineage(childKey: `worktree:${string}`, parentFolderId: string): WorkspaceLineage {
  return {
    childWorkspaceKey: childKey,
    childInstanceId: null,
    parentWorkspaceKey: folderWorkspaceKey(parentFolderId),
    parentInstanceId: null,
    origin: 'cli',
    capture: { source: 'manual-action', confidence: 'inferred' },
    createdAt: 0
  }
}

describe('Store multi-project workspaces', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'dolphin-test-'))
  })

  afterEach(async () => {
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('keeps a groupless multi-project workspace and its members across a restart', async () => {
    const store = await createStore()
    store.addRepo(makeRepo({ id: 'repo-a', path: '/code/a' }))
    const workspace = store.createFolderWorkspace({
      projectGroupId: null,
      kind: 'multi-project',
      name: 'feature-x',
      folderPath: '/workspaces/feature-x'
    })
    const memberKey = 'worktree:repo-a::/workspaces/feature-x/a' as const
    store.setWorkspaceLineage(memberLineage(memberKey, workspace.id))

    store.flush()
    const restored = await createStore()

    expect(restored.getFolderWorkspace(workspace.id)).toMatchObject({
      projectGroupId: null,
      kind: 'multi-project',
      name: 'feature-x',
      folderPath: '/workspaces/feature-x'
    })
    expect(restored.getWorkspaceLineage(memberKey)?.parentWorkspaceKey).toBe(
      folderWorkspaceKey(workspace.id)
    )
  })

  it('survives deleting a project group it never belonged to', async () => {
    const store = await createStore()
    const group = store.createProjectGroup({
      name: 'CRM',
      parentPath: '/code/crm',
      createdFrom: 'folder-scan'
    })
    const workspace = store.createFolderWorkspace({
      projectGroupId: null,
      kind: 'multi-project',
      folderPath: '/workspaces/feature-y'
    })

    store.deleteProjectGroup(group.id)

    expect(store.getFolderWorkspace(workspace.id)?.name).toBe('Multi-project workspace')
  })

  it('refuses a groupless plain folder workspace and a multi-project one without a folder', async () => {
    const store = await createStore()

    expect(() => store.createFolderWorkspace({ projectGroupId: null })).toThrow(
      'Folder-backed project group not found.'
    )
    expect(() =>
      store.createFolderWorkspace({ projectGroupId: null, kind: 'multi-project' })
    ).toThrow('Multi-project workspace folder is missing.')
  })

  it('drops lineage rows whose folder parent vanished before the restart', async () => {
    const store = await createStore()
    store.addRepo(makeRepo({ id: 'repo-b', path: '/code/b' }))
    const workspace = store.createFolderWorkspace({
      projectGroupId: null,
      kind: 'multi-project',
      folderPath: '/workspaces/feature-z'
    })
    const orphanKey = 'worktree:repo-b::/workspaces/gone/b' as const
    const memberKey = 'worktree:repo-b::/workspaces/feature-z/b' as const
    store.setWorkspaceLineage(memberLineage(orphanKey, 'deleted-folder'))
    store.setWorkspaceLineage(memberLineage(memberKey, workspace.id))

    store.flush()
    const restored = await createStore()

    expect(restored.getWorkspaceLineage(orphanKey)).toBeUndefined()
    expect(restored.getWorkspaceLineage(memberKey)).toBeDefined()
  })
})
