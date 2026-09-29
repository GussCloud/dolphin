import { describe, expect, it, vi } from 'vitest'
import { FolderWorkspaceCreateMultiProject } from '../../../../shared/rpc-contract/folder-workspace-params'
import type { RpcContext } from '../core'
import { FOLDER_WORKSPACE_METHODS } from './folder-workspace'

const { createForRemoteClient } = vi.hoisted(() => ({
  createForRemoteClient: vi.fn()
}))

vi.mock('../../../ipc/worktrees/create/multi-project-workspace-remote-create', () => ({
  createMultiProjectWorkspaceForRemoteClient: createForRemoteClient
}))

const method = FOLDER_WORKSPACE_METHODS.find(
  (candidate) => candidate.name === 'folderWorkspace.createMultiProject'
)

function call(params: unknown, context: Partial<RpcContext>) {
  const parsed = FolderWorkspaceCreateMultiProject.parse(params)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler reads only the identity fields supplied here.
  return method!.handler(parsed as never, context as RpcContext)
}

describe('folderWorkspace.createMultiProject', () => {
  it('creates through the IPC create and attributes it to the paired device', async () => {
    createForRemoteClient.mockResolvedValueOnce({ folderWorkspace: { id: 'fw-1' }, members: [] })

    const result = await call(
      { name: 'checkout', repoIds: ['repo-a', 'repo-b'], createdWithAgent: 'claude' },
      { clientKind: 'mobile', pairedDeviceId: 'device-1' }
    )

    expect(result).toEqual({ folderWorkspace: { id: 'fw-1' }, members: [] })
    expect(createForRemoteClient).toHaveBeenCalledWith(
      { name: 'checkout', repoIds: ['repo-a', 'repo-b'], createdWithAgent: 'claude' },
      { kind: 'paired-device', deviceId: 'device-1' }
    )
  })

  it('refuses a single project, which is an ordinary worktree create', () => {
    expect(() => FolderWorkspaceCreateMultiProject.parse({ name: 'x', repoIds: ['a'] })).toThrow()
  })
})
