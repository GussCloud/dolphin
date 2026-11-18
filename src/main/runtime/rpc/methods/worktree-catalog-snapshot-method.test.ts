import { describe, expect, it, vi } from 'vitest'
import type { DolphinRuntimeService } from '../../dolphin-runtime'
import { RpcDispatcher } from '../dispatcher'
import { WORKTREE_METHODS } from './worktree'
import { WORKTREE_VISIBILITY_SOURCE_DEFAULTS_RUNTIME_CAPABILITY } from '../../../../shared/protocol-version'

function makeRuntime() {
  return {
    getRuntimeId: () => 'test-runtime',
    getWorktreePs: vi.fn().mockResolvedValue({
      worktrees: [],
      totalCount: 0,
      truncated: false
    })
  } as unknown as DolphinRuntimeService
}

describe('worktree.ps catalog snapshots', () => {
  it('preserves the exact legacy response when no snapshot field is sent', async () => {
    const runtime = makeRuntime()
    const dispatcher = new RpcDispatcher({ runtime, methods: WORKTREE_METHODS })
    const response = await dispatcher.dispatch({
      id: 'legacy',
      authToken: 'token',
      method: 'worktree.ps',
      params: { limit: 10_000 }
    })

    expect(response).toMatchObject({
      ok: true,
      result: { worktrees: [], totalCount: 0, truncated: false }
    })
    expect((response as { result: unknown }).result).not.toHaveProperty('snapshotId')
  })

  it('returns a full snapshot followed by a tiny unchanged response', async () => {
    const runtime = makeRuntime()
    const dispatcher = new RpcDispatcher({ runtime, methods: WORKTREE_METHODS })
    const first = await dispatcher.dispatch({
      id: 'first',
      authToken: 'token',
      method: 'worktree.ps',
      params: { limit: 10_000, afterSnapshotId: null }
    })
    const snapshotId = (first as { result: { snapshotId: string } }).result.snapshotId

    const second = await dispatcher.dispatch({
      id: 'second',
      authToken: 'token',
      method: 'worktree.ps',
      params: { limit: 10_000, afterSnapshotId: snapshotId }
    })

    expect(snapshotId).toEqual(expect.any(String))
    expect(second).toMatchObject({
      ok: true,
      result: { unchanged: true, snapshotId }
    })
    expect(runtime.getWorktreePs).toHaveBeenCalledTimes(2)
  })

  it('gates source-default worktree projection by client capability', async () => {
    const runtime = makeRuntime()
    const dispatcher = new RpcDispatcher({ runtime, methods: WORKTREE_METHODS })
    await dispatcher.dispatchStreaming(
      {
        id: 'legacy',
        authToken: 'token',
        method: 'worktree.ps',
        params: { limit: 10_000 }
      },
      () => {},
      { clientCapabilities: [] }
    )
    await dispatcher.dispatchStreaming(
      {
        id: 'current',
        authToken: 'token',
        method: 'worktree.ps',
        params: { limit: 10_000 }
      },
      () => {},
      { clientCapabilities: [WORKTREE_VISIBILITY_SOURCE_DEFAULTS_RUNTIME_CAPABILITY] }
    )
    await dispatcher.dispatchStreaming(
      {
        id: 'mobile',
        authToken: 'token',
        method: 'worktree.ps',
        params: { limit: 10_000, supportsWorktreeVisibilitySourceDefaults: true }
      },
      () => {},
      { clientCapabilities: [] }
    )

    expect(runtime.getWorktreePs).toHaveBeenNthCalledWith(1, 10_000, false)
    expect(runtime.getWorktreePs).toHaveBeenNthCalledWith(2, 10_000, true)
    expect(runtime.getWorktreePs).toHaveBeenNthCalledWith(3, 10_000, true)
  })
})

describe('worktree.ps row deltas', () => {
  const row = (id: string, displayName: string) => ({ worktreeId: id, displayName })
  const catalog = (...worktrees: ReturnType<typeof row>[]) => ({
    worktrees,
    totalCount: worktrees.length,
    truncated: false
  })
  function runtimeReturning(...results: ReturnType<typeof catalog>[]) {
    const getWorktreePs = vi.fn()
    for (const result of results) {
      getWorktreePs.mockResolvedValueOnce(result)
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: worktree.ps reads only these runtime members.
    return { getRuntimeId: () => 'test-runtime', getWorktreePs } as unknown as DolphinRuntimeService
  }
  async function poll(dispatcher: RpcDispatcher, params: Record<string, unknown>) {
    const response = await dispatcher.dispatch({
      id: 'poll',
      authToken: 'token',
      method: 'worktree.ps',
      params
    })
    return (response as { result: Record<string, unknown> & { snapshotId: string } }).result
  }
  const a = row('repo-1::/w/a', 'a')
  const b = row('repo-1::/w/b', 'b')
  const c = row('repo-1::/w/c', 'c')

  it('sends rows the caller holds as indexes into its base catalog', async () => {
    const renamed = row('repo-1::/w/b', 'b2')
    const dispatcher = new RpcDispatcher({
      runtime: runtimeReturning(catalog(a, b, c), catalog(c, renamed, a)),
      methods: WORKTREE_METHODS
    })
    const base = await poll(dispatcher, { limit: 10_000, afterSnapshotId: null })
    const delta = await poll(dispatcher, {
      limit: 10_000,
      afterSnapshotId: base.snapshotId,
      acceptRowDelta: true
    })

    expect(delta).toMatchObject({ baseSnapshotId: base.snapshotId, totalCount: 3 })
    expect(delta.rowsFromBase).toEqual([2, renamed, 0])
    expect(delta).not.toHaveProperty('worktrees')
  })

  it('answers a full catalog to callers that did not opt in or hold an unknown base', async () => {
    const dispatcher = new RpcDispatcher({
      runtime: runtimeReturning(catalog(a), catalog(a, b), catalog(a, b, c)),
      methods: WORKTREE_METHODS
    })
    const base = await poll(dispatcher, { limit: 10_000, afterSnapshotId: null })

    const optedOut = await poll(dispatcher, { limit: 10_000, afterSnapshotId: base.snapshotId })
    const unknownBase = await poll(dispatcher, {
      limit: 10_000,
      afterSnapshotId: 'evicted',
      acceptRowDelta: true
    })

    expect(optedOut.worktrees).toHaveLength(2)
    expect(unknownBase.worktrees).toHaveLength(3)
  })
})
