// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodexManagedAccount } from '../../../../shared/managed-account-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

function codex(id: string): CodexManagedAccount {
  return {
    id,
    email: `${id}@corp.example`,
    managedHomePath: `/data/${id}`,
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  }
}

const storeState = vi.hoisted(() => {
  const settings: Pick<
    GlobalSettings,
    | 'claudeManagedAccounts'
    | 'activeClaudeManagedAccountId'
    | 'activeClaudeManagedAccountIdsByRuntime'
    | 'codexManagedAccounts'
    | 'activeCodexManagedAccountId'
    | 'activeCodexManagedAccountIdsByRuntime'
  > = {
    claudeManagedAccounts: [],
    activeClaudeManagedAccountId: null,
    activeClaudeManagedAccountIdsByRuntime: { host: null, wsl: {} },
    codexManagedAccounts: [],
    activeCodexManagedAccountId: null,
    activeCodexManagedAccountIdsByRuntime: { host: null, wsl: {} }
  }
  return { settings, fetchSettings: vi.fn(async () => {}) }
})
vi.mock('@/store', () => ({ useAppStore: { getState: () => storeState } }))
vi.mock('./project-account-client', () => ({ addAzureDevOpsManagedAccount: vi.fn() }))

import { useStartAccountAdds } from './use-start-account-adds'

const codexApi = {
  add: vi.fn(),
  select: vi.fn(async () => {}),
  cancelPendingLogin: vi.fn(async () => true)
}
const onAgentAdded = vi.fn()
let root: Root
let hook: ReturnType<typeof useStartAccountAdds>

function Harness(): null {
  hook = useStartAccountAdds({ onAzureAdded: vi.fn(), onAgentAdded })
  return null
}

beforeEach(async () => {
  Object.assign(window, { api: { codexAccounts: codexApi } })
  storeState.settings.codexManagedAccounts = [codex('personal')]
  storeState.settings.activeCodexManagedAccountIdsByRuntime = { host: 'personal', wsl: {} }
  codexApi.add.mockReset()
  codexApi.select.mockClear()
  onAgentAdded.mockClear()
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Harness />))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('useStartAccountAdds', () => {
  it('adds a Codex account, selects it for the project, and keeps the PC default', async () => {
    codexApi.add.mockImplementation(async () => {
      // Why: mirrors codex-account-registration, which activates the account it adds.
      storeState.settings.codexManagedAccounts = [codex('personal'), codex('company')]
      storeState.settings.activeCodexManagedAccountIdsByRuntime = { host: 'company', wsl: {} }
    })
    codexApi.select.mockImplementation(async () => {
      storeState.settings.activeCodexManagedAccountIdsByRuntime = { host: 'personal', wsl: {} }
    })
    await act(async () => hook.addAgent('codex'))
    expect(codexApi.select).toHaveBeenCalledWith({
      accountId: 'personal',
      runtime: 'host',
      wslDistro: null
    })
    expect(onAgentAdded).toHaveBeenCalledWith('codex', 'company')
    expect(hook.adding).toBeNull()
  })

  it('cancels the pending login without reporting the rejection as an error', async () => {
    let reject: (error: Error) => void = () => {}
    codexApi.add.mockImplementation(
      () =>
        new Promise((_resolve, rejectLogin) => {
          reject = rejectLogin
        })
    )
    let pending: Promise<void> = Promise.resolve()
    await act(async () => {
      pending = hook.addAgent('codex')
    })
    expect(hook.adding).toBe('codex')
    await act(async () => {
      hook.cancel()
      reject(new Error('Login cancelled'))
      await pending
    })
    expect(codexApi.cancelPendingLogin).toHaveBeenCalled()
    expect(hook.error).toBeNull()
    expect(hook.adding).toBeNull()
    expect(onAgentAdded).not.toHaveBeenCalled()
  })
})
