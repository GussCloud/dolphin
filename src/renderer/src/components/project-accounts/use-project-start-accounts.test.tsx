// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useProjectStartAccounts,
  type ProjectStartAccountsState
} from './use-project-start-accounts'

const storeState = vi.hoisted(() => ({
  settings: { commitAuthors: [{ name: 'Ana Azure', email: 'ana@corp.example' }] }
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => storeState } }))

const accountProfile = vi.fn()
let container: HTMLDivElement
let root: Root
let state: ProjectStartAccountsState

function Harness({ enabled }: { enabled: boolean }): null {
  state = useProjectStartAccounts(enabled)
  return null
}

beforeEach(async () => {
  accountProfile.mockReset().mockResolvedValue({
    login: 'ana-corp',
    name: 'Ana Corp',
    email: null,
    id: 7,
    host: 'github.com'
  })
  Object.assign(window, { api: { gh: { accountProfile } } })
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () => root.render(<Harness enabled />))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('useProjectStartAccounts', () => {
  it('suggests the author of the picked GitHub account', async () => {
    await act(async () => state.setGhAccount({ host: 'github.com', user: 'ana-corp' }))
    expect(accountProfile).toHaveBeenCalledWith({ host: 'github.com', user: 'ana-corp' })
    expect(state.accounts.commitIdentity).toEqual({
      name: 'Ana Corp',
      email: '7+ana-corp@users.noreply.github.com'
    })
  })

  it('suggests a registered author whose email is the Azure DevOps login', async () => {
    await act(async () => state.setAzureDevOpsAccount({ id: 'ado', login: 'ANA@corp.example' }))
    expect(state.accounts.commitIdentity).toEqual({ name: 'Ana Azure', email: 'ana@corp.example' })
  })

  it('keeps an author the user picked when the account changes afterwards', async () => {
    const picked = { name: 'Picked', email: 'picked@corp.example' }
    await act(async () => state.setCommitIdentity(picked))
    await act(async () => state.setGhAccount({ host: 'github.com', user: 'ana-corp' }))
    expect(state.accounts.commitIdentity).toEqual(picked)
  })

  it('forgets every pick when the panel no longer applies (dialog closed or another host)', async () => {
    await act(async () => state.setAgentAccount('claude', 'claude-corp'))
    await act(async () => root.render(<Harness enabled={false} />))
    expect(state.get().claudeAccountId).toBeNull()
    await act(async () => root.render(<Harness enabled />))
    expect(state.accounts.claudeAccountId).toBeNull()
  })
})
