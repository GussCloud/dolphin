import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  toastError: vi.fn(),
  state: {
    repos: [{ id: 'repo-1', path: '/r', executionHostId: 'runtime:env-1' }],
    settings: { activeRuntimeEnvironmentId: null }
  }
}))

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.callRuntimeRpc }))
vi.mock('@/store/slices/worktrees/listing/worktree-owner-settings', () => ({
  settingsForRepoOwner: (_state: unknown, repoId: string) =>
    repoId === 'repo-1' ? { activeRuntimeEnvironmentId: 'env-1' } : null
}))

import { RuntimeRpcCallError } from '@/runtime/runtime-rpc-result'
import { submitDesignFromComposer } from './design-composer-submit'

const input = {
  repoId: 'repo-1',
  name: '  Checkout  ',
  request: ' A checkout flow ',
  agent: 'claude' as const,
  options: { agentAccountId: 'acct-1' }
}

describe('submitDesignFromComposer', () => {
  beforeEach(() => {
    mocks.callRuntimeRpc.mockReset()
    mocks.toastError.mockReset()
  })

  it('records the design on the repo owner host, then creates the worktree with its prompt', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ design: { id: 'd1' }, launchPrompt: 'run design d1' })
    const submitQuick = vi.fn().mockResolvedValue(undefined)
    await expect(submitDesignFromComposer({ ...input, submitQuick })).resolves.toBe(true)
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'design.create',
      { name: 'Checkout', request: 'A checkout flow', agent: 'claude', repoId: 'repo-1' }
    )
    expect(submitQuick).toHaveBeenCalledWith(
      'claude',
      { kind: 'design', prompt: 'run design d1' },
      { agentAccountId: 'acct-1' }
    )
    expect(mocks.callRuntimeRpc.mock.invocationCallOrder[0]).toBeLessThan(
      submitQuick.mock.invocationCallOrder[0]
    )
  })

  it('creates no worktree and explains an older host', async () => {
    mocks.callRuntimeRpc.mockRejectedValue(
      new RuntimeRpcCallError({
        id: 'x',
        ok: false,
        error: { code: 'method_not_found', message: 'Unknown method' },
        _meta: { runtimeId: 'r' }
      })
    )
    const submitQuick = vi.fn()
    await expect(submitDesignFromComposer({ ...input, submitQuick })).resolves.toBe(false)
    expect(submitQuick).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith('Could not create the design', {
      description: 'This host does not support designs yet. Update Dolphin on it and try again.'
    })
  })

  it('creates no worktree when the host answers without a launch prompt', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ design: { id: 'd1' } })
    const submitQuick = vi.fn()
    await expect(submitDesignFromComposer({ ...input, submitQuick })).resolves.toBe(false)
    expect(submitQuick).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledOnce()
  })

  it('gives each "Create more" create its own design and prompt, and skips only a failed one', async () => {
    mocks.callRuntimeRpc
      .mockResolvedValueOnce({ design: { id: 'd1' }, launchPrompt: 'run design d1' })
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce({ design: { id: 'd3' }, launchPrompt: 'run design d3' })
    const submitQuick = vi.fn().mockResolvedValue(undefined)
    const results: boolean[] = []
    for (const name of ['Checkout', 'Refunds', 'Invoices']) {
      results.push(await submitDesignFromComposer({ ...input, name, submitQuick }))
    }
    expect(results).toEqual([true, false, true])
    expect(
      mocks.callRuntimeRpc.mock.calls.map(([, method, params]) => [method, params.name])
    ).toEqual([
      ['design.create', 'Checkout'],
      ['design.create', 'Refunds'],
      ['design.create', 'Invoices']
    ])
    expect(submitQuick.mock.calls.map(([, launch]) => launch)).toEqual([
      { kind: 'design', prompt: 'run design d1' },
      { kind: 'design', prompt: 'run design d3' }
    ])
    expect(mocks.toastError).toHaveBeenCalledOnce()
    expect(mocks.toastError).toHaveBeenCalledWith('Could not create the design', {
      description: 'disk full'
    })
  })
})
