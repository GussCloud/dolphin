import { afterEach, describe, expect, it } from 'vitest'
import type { RpcContext } from '../../../core'
import { createOrchestrationRpcHarness } from '../rpc-test-harness'

describe('orchestration heavy-job queue RPC', () => {
  const h = createOrchestrationRpcHarness()
  let ctx: RpcContext

  afterEach(() => {
    h.cleanup()
  })

  function call(name: string, params: Record<string, unknown>) {
    return h.call(name, params, ctx)
  }

  it('wakes a long-polling waiter as soon as the holder releases', async () => {
    ;({ ctx } = h.setup(false))
    const params = { queueKey: 'host|/repo/.git', holder: 'test' }
    const holder = ticketOf(await call('orchestration.heavyJobAcquire', params))
    const startedAt = Date.now()
    const waiting = call('orchestration.heavyJobAcquire', { ...params, waitMs: 10_000 })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await call('orchestration.heavyJobRelease', { ticket: holder })).toEqual({
      released: true
    })
    expect(await waiting).toMatchObject({ granted: true, ahead: 0 })
    expect(Date.now() - startedAt).toBeLessThan(5_000)
  })

  it('answers still-queued without waiting when no wait is requested', async () => {
    ;({ ctx } = h.setup(false))
    const params = { queueKey: 'host|/repo/.git', holder: 'test' }
    const holder = ticketOf(await call('orchestration.heavyJobAcquire', params))
    expect(await call('orchestration.heavyJobAcquire', params)).toMatchObject({
      granted: false,
      ahead: 1
    })
    expect(await call('orchestration.heavyJobHeartbeat', { ticket: holder })).toEqual({
      held: true
    })
  })
})

function ticketOf(result: unknown): string {
  const ticket: unknown =
    result && typeof result === 'object' && 'ticket' in result ? result.ticket : undefined
  if (typeof ticket !== 'string') {
    throw new Error('acquire returned no ticket')
  }
  return ticket
}
