import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../dispatcher'
import type { RpcRequest } from '../core'
import type { DolphinRuntimeService } from '../../dolphin-runtime'

const mocks = vi.hoisted(() => ({ listInventory: vi.fn() }))
vi.mock('../../../github/gh-account-binding-inventory', () => ({
  listGhAccountBindingInventory: mocks.listInventory
}))

import { GITHUB_ACCOUNT_BINDING_METHODS } from './github-account-binding-methods'

function makeRequest(params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method: 'github.listHostAccounts', params }
}

describe('github.listHostAccounts', () => {
  beforeEach(() => {
    mocks.listInventory.mockReset()
    mocks.listInventory.mockResolvedValue({ accounts: [] })
  })

  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the method reads nothing from the runtime.
  const runtime = { getRuntimeId: () => 'test-runtime' } as unknown as DolphinRuntimeService
  const dispatcher = new RpcDispatcher({ runtime, methods: GITHUB_ACCOUNT_BINDING_METHODS })

  it("lists the requested WSL distro's gh logins on the runtime host", async () => {
    const response = await dispatcher.dispatch(
      makeRequest({ host: 'github.com', wslDistro: 'Ubuntu' })
    )
    expect(response).toMatchObject({ ok: true })
    expect(mocks.listInventory).toHaveBeenCalledWith(
      { wslDistro: 'Ubuntu' },
      { refreshCapability: false, requiredHost: 'github.com' }
    )
  })

  it('keeps older clients that send no distro on the host gh, and rejects a malformed one', async () => {
    await dispatcher.dispatch(makeRequest({}))
    expect(mocks.listInventory).toHaveBeenCalledWith({}, { refreshCapability: false })
    const rejected = await dispatcher.dispatch(makeRequest({ wslDistro: 'a b;c' }))
    expect(rejected).toMatchObject({ ok: false })
    expect(mocks.listInventory).toHaveBeenCalledTimes(1)
  })
})
