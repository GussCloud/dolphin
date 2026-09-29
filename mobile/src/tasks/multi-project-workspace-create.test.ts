import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import { createMultiProjectWorkspace } from './multi-project-workspace-create'

type Reply = { ok: true; result: unknown } | { ok: false; error: { code: string; message: string } }

function client(replies: Record<string, Reply>) {
  const sendRequest = vi.fn(async (method: string) => ({
    id: '1',
    ...replies[method],
    _meta: { runtimeId: 'r' }
  }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: createMultiProjectWorkspace only calls sendRequest.
  return { client: { sendRequest } as unknown as RpcClient, sendRequest }
}

const CREATED: Reply = {
  ok: true,
  result: { folderWorkspace: { id: 'fw-1', name: 'checkout' }, members: [] }
}

describe('createMultiProjectWorkspace', () => {
  it('lands on the container without an agent', async () => {
    const { client: rpc, sendRequest } = client({ 'folderWorkspace.createMultiProject': CREATED })

    await expect(
      createMultiProjectWorkspace({
        client: rpc,
        name: 'checkout',
        repoIds: ['repo-a', 'repo-b'],
        agent: undefined,
        agentLaunchSupported: Promise.resolve({ replay: false })
      })
    ).resolves.toEqual({ worktreeId: 'folder:fw-1', name: 'checkout' })
    expect(sendRequest).toHaveBeenCalledTimes(1)
    expect(sendRequest.mock.calls[0]![1]).toEqual({
      name: 'checkout',
      repoIds: ['repo-a', 'repo-b']
    })
  })

  it('starts the agent in the container folder', async () => {
    const { client: rpc, sendRequest } = client({
      'folderWorkspace.createMultiProject': CREATED,
      'agent.launch': { ok: true, result: { worktreeId: 'folder:fw-1' } }
    })

    await expect(
      createMultiProjectWorkspace({
        client: rpc,
        name: 'checkout',
        repoIds: ['repo-a', 'repo-b'],
        agent: 'claude',
        agentLaunchSupported: Promise.resolve({ replay: false })
      })
    ).resolves.toEqual({ worktreeId: 'folder:fw-1', name: 'checkout' })
    expect(sendRequest.mock.calls[1]![0]).toBe('agent.launch')
    expect(sendRequest.mock.calls[1]![1]).toEqual({
      agent: 'claude',
      target: { kind: 'existing', worktree: 'id:folder:fw-1' }
    })
  })

  it('keeps the workspace and warns when the agent cannot start', async () => {
    const { client: rpc } = client({
      'folderWorkspace.createMultiProject': CREATED,
      'agent.launch': { ok: false, error: { code: 'internal', message: 'pty exhausted' } }
    })

    const result = await createMultiProjectWorkspace({
      client: rpc,
      name: 'checkout',
      repoIds: ['repo-a', 'repo-b'],
      agent: 'claude',
      agentLaunchSupported: Promise.resolve({ replay: false })
    })

    expect(result.worktreeId).toBe('folder:fw-1')
    expect(result.warning).toContain('pty exhausted')
  })

  it('surfaces the host refusal of the create itself', async () => {
    const { client: rpc } = client({
      'folderWorkspace.createMultiProject': {
        ok: false,
        error: { code: 'internal', message: '"C:\\wt\\checkout" already exists.' }
      }
    })

    await expect(
      createMultiProjectWorkspace({
        client: rpc,
        name: 'checkout',
        repoIds: ['repo-a', 'repo-b'],
        agent: undefined,
        agentLaunchSupported: Promise.resolve(false)
      })
    ).rejects.toThrow('already exists')
  })
})
