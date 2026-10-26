import { describe, expect, it, vi } from 'vitest'

// Why: the real invocation runs the orchestration mutation ledger; only the dispatcher's signal is under test.
vi.mock('./dispatcher-unary-method-invocation', () => ({
  invokeDispatcherUnaryMethod: async (args: { method: { handler: () => unknown } }) =>
    args.method.handler()
}))
import { RpcDispatcher } from './dispatcher'
import { defineMethod, type RpcRequest } from './core'
import { DolphinRuntimeService } from '../dolphin-runtime'
import { ORCHESTRATION_CONTRACT_VERSION } from '../../../shared/protocol-version'

function request(method: string): RpcRequest {
  return {
    id: 'req-1',
    authToken: 'tok',
    method,
    orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION
  }
}

function dispatcherWith(names: string[], fail = false) {
  const runtime = new DolphinRuntimeService()
  const progress = vi.fn()
  runtime.subscribeOrchestrationProgress(progress)
  const methods = names.map((name) =>
    defineMethod({
      name,
      params: null,
      handler: () => {
        if (fail) {
          throw new Error('refused')
        }
        return { ok: true }
      }
    })
  )
  return { dispatcher: new RpcDispatcher({ runtime, methods }), progress }
}

describe('RpcDispatcher orchestration progress', () => {
  it('signals progress after a Task or worker change succeeds', async () => {
    const { dispatcher, progress } = dispatcherWith(['orchestration.taskCreate'])
    const response = await dispatcher.dispatch(request('orchestration.taskCreate'))
    expect(response).toMatchObject({ ok: true })
    expect(progress).toHaveBeenCalledTimes(1)
  })

  it('stays quiet for other methods and for failed changes', async () => {
    const quiet = dispatcherWith(['orchestration.check'])
    await quiet.dispatcher.dispatch(request('orchestration.check'))
    expect(quiet.progress).not.toHaveBeenCalled()
    const failing = dispatcherWith(['orchestration.workerStart'], true)
    const response = await failing.dispatcher.dispatch(request('orchestration.workerStart'))
    expect(response.ok).toBe(false)
    expect(failing.progress).not.toHaveBeenCalled()
  })
})
