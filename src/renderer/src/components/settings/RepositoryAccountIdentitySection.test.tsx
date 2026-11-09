// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import { RepositoryAccountIdentitySection } from './RepositoryAccountIdentitySection'

const { storeState, listAzureMock, warningsMock } = vi.hoisted(() => {
  const repos: Repo[] = []
  return {
    storeState: { settings: null, repos, settingsSearchQuery: '' },
    listAzureMock: vi.fn(),
    warningsMock: vi.fn()
  }
})

vi.mock('../../store', () => {
  const useAppStore = (selector: (state: typeof storeState) => unknown) => selector(storeState)
  useAppStore.getState = () => storeState
  return { useAppStore }
})
vi.mock('@/lib/repo-runtime-owner', () => ({
  getRepoOwnerRoutedSettings: (settings: unknown) => settings
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({
  getActiveRuntimeTarget: () => ({ kind: 'local' })
}))
vi.mock('../project-accounts/project-account-client', () => ({
  listAzureDevOpsManagedAccounts: listAzureMock,
  listGhHostAccounts: vi.fn(),
  listTerminalGitAccountWarnings: warningsMock
}))

const REPO: Repo = {
  id: 'repo-1',
  path: '/home/user/project',
  displayName: 'My Project',
  badgeColor: '#000000',
  addedAt: 0
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  listAzureMock.mockReset().mockResolvedValue([])
  warningsMock.mockReset().mockResolvedValue([])
  storeState.repos = [REPO]
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

type Update = { commitIdentity?: { name: string; email: string } | null }

async function render(updateRepo: (id: string, update: Update) => unknown) {
  await act(async () => {
    root.render(
      <RepositoryAccountIdentitySection
        repo={REPO}
        azureDevOpsRemote={false}
        updateRepo={updateRepo}
        forceVisible
      />
    )
  })
}

async function type(label: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function saveButton(): HTMLButtonElement {
  return Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === 'Save author'
  )!
}

describe('RepositoryAccountIdentitySection', () => {
  it('saves a valid author and confirms the host kept it', async () => {
    const updateRepo = vi.fn(async (_id: string, update: Update) => {
      storeState.repos = [{ ...REPO, commitIdentity: update.commitIdentity ?? undefined }]
      return true
    })
    await render(updateRepo)
    await type('Author name', 'Dev')
    expect(saveButton().disabled).toBe(true)
    await type('Author email', 'dev@example.test')
    expect(saveButton().disabled).toBe(false)
    await act(async () => saveButton().click())
    expect(updateRepo).toHaveBeenCalledWith('repo-1', {
      commitIdentity: { name: 'Dev', email: 'dev@example.test' }
    })
    expect(container.textContent).not.toContain('not enforced')
  })

  it('reports "not enforced" when an older host drops the field', async () => {
    await render(vi.fn(async () => true))
    await type('Author name', 'Dev')
    await type('Author email', 'dev@example.test')
    await act(async () => saveButton().click())
    expect(container.textContent).toContain('Saved, but not enforced by this runtime')
  })

  it('rejects a malformed email', async () => {
    await render(vi.fn())
    await type('Author name', 'Dev')
    await type('Author email', 'not-an-email')
    expect(saveButton().disabled).toBe(true)
    expect(container.textContent).toContain('Enter a valid email address.')
  })

  it("shows where the binding does not reach this project's terminals", async () => {
    warningsMock.mockResolvedValue([
      "This project's Azure DevOps account was removed; git in its terminals refuses Azure DevOps until you choose another."
    ])
    await render(vi.fn())
    await act(async () => {})
    expect(warningsMock).toHaveBeenCalledWith({ kind: 'local' }, 'repo-1')
    expect(container.textContent).toContain("This project's Azure DevOps account was removed")
  })
})
