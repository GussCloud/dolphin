// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import { RepositoryAccountIdentitySection } from './RepositoryAccountIdentitySection'

type Author = { name: string; email: string }

const { storeState, listAzureMock, warningsMock } = vi.hoisted(() => {
  const repos: Repo[] = []
  const commitAuthors: Author[] = []
  const storeState = {
    settings: { commitAuthors },
    repos,
    settingsSearchQuery: '',
    updateSettingsOrThrow: vi.fn(async (updates: { commitAuthors?: Author[] }) => {
      storeState.settings = { ...storeState.settings, ...updates }
    })
  }
  return { storeState, listAzureMock: vi.fn(), warningsMock: vi.fn() }
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
// Why: Radix Select needs layout APIs happy-dom lacks; a native select keeps value testable.
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children
  }: {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
  }) => (
    <select value={value} onChange={(event) => onValueChange(event.currentTarget.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  )
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
  storeState.settings = { commitAuthors: [{ name: 'Dev', email: 'dev@example.test' }] }
  storeState.updateSettingsOrThrow.mockClear()
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

function button(text: string): HTMLButtonElement {
  return Array.from(container.querySelectorAll('button')).find((entry) =>
    entry.textContent?.includes(text)
  )!
}

function saveButton(): HTMLButtonElement {
  return button('Save author')
}

function inputValues(): string[] {
  return Array.from(container.querySelectorAll('input')).map((input) => input.value)
}

function authorSelect(): HTMLSelectElement {
  return container.querySelector('select')!
}

async function pickAuthor(label: string) {
  const select = authorSelect()
  await act(async () => {
    select.value = Array.from(select.options).find((o) => o.textContent === label)!.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function click(text: string) {
  await act(async () => button(text).click())
}

describe('RepositoryAccountIdentitySection', () => {
  it('saves an author picked from the registered list and confirms the host kept it', async () => {
    const updateRepo = vi.fn(async (_id: string, update: Update) => {
      storeState.repos = [{ ...REPO, commitIdentity: update.commitIdentity ?? undefined }]
      return true
    })
    await render(updateRepo)
    expect(container.querySelectorAll('input')).toHaveLength(0)
    expect(saveButton().disabled).toBe(true)
    await pickAuthor('Dev <dev@example.test>')
    expect(inputValues()).toEqual(['Dev', 'dev@example.test'])
    expect(saveButton().disabled).toBe(false)
    await click('Save author')
    expect(updateRepo).toHaveBeenCalledWith('repo-1', {
      commitIdentity: { name: 'Dev', email: 'dev@example.test' }
    })
    expect(container.textContent).not.toContain('not enforced')
  })

  it('offers authors other projects already use', async () => {
    storeState.settings = { commitAuthors: [] }
    storeState.repos = [
      REPO,
      { ...REPO, id: 'repo-2', commitIdentity: { name: 'Ops', email: 'ops@example.test' } }
    ]
    await render(vi.fn())
    expect(Array.from(authorSelect().options).map((o) => o.textContent)).toEqual([
      'Git config identity (default)',
      'Ops <ops@example.test>'
    ])
  })

  it('registers a new author in Dolphin and selects it', async () => {
    const updateRepo = vi.fn(async () => true)
    await render(updateRepo)
    await click('New author')
    await type('Author name', 'Second')
    await type('Author email', 'second@example.test')
    await click('Add author')
    expect(storeState.updateSettingsOrThrow).toHaveBeenCalledWith({
      commitAuthors: [
        { name: 'Dev', email: 'dev@example.test' },
        { name: 'Second', email: 'second@example.test' }
      ]
    })
    expect(inputValues()).toEqual(['Second', 'second@example.test'])
    await click('Save author')
    expect(updateRepo).toHaveBeenCalledWith('repo-1', {
      commitIdentity: { name: 'Second', email: 'second@example.test' }
    })
  })

  it('corrects the picked author in the registered list', async () => {
    const updateRepo = vi.fn(async () => true)
    await render(updateRepo)
    await pickAuthor('Dev <dev@example.test>')
    expect(button('Save changes').disabled).toBe(true)
    await type('Author name', 'Dev Fixed')
    await click('Save changes')
    expect(storeState.updateSettingsOrThrow).toHaveBeenCalledWith({
      commitAuthors: [{ name: 'Dev Fixed', email: 'dev@example.test' }]
    })
    expect(authorSelect().selectedOptions[0]?.textContent).toBe('Dev Fixed <dev@example.test>')
    await click('Save author')
    expect(updateRepo).toHaveBeenCalledWith('repo-1', {
      commitIdentity: { name: 'Dev Fixed', email: 'dev@example.test' }
    })
  })

  it('removes the picked author and falls back to the git config identity', async () => {
    await render(vi.fn())
    await pickAuthor('Dev <dev@example.test>')
    await click('Remove')
    expect(storeState.updateSettingsOrThrow).toHaveBeenCalledWith({ commitAuthors: [] })
    expect(authorSelect().selectedOptions[0]?.textContent).toBe('Git config identity (default)')
    expect(container.querySelectorAll('input')).toHaveLength(0)
  })

  it('offers no remove for an author only another project uses', async () => {
    storeState.settings = { commitAuthors: [] }
    storeState.repos = [
      REPO,
      { ...REPO, id: 'repo-2', commitIdentity: { name: 'Ops', email: 'ops@example.test' } }
    ]
    await render(vi.fn())
    await pickAuthor('Ops <ops@example.test>')
    expect(inputValues()).toEqual(['Ops', 'ops@example.test'])
    expect(button('Remove')).toBeUndefined()
  })

  it('reports "not enforced" when an older host drops the field', async () => {
    await render(vi.fn(async () => true))
    await pickAuthor('Dev <dev@example.test>')
    await click('Save author')
    expect(container.textContent).toContain('Saved, but not enforced by this runtime')
  })

  it('rejects a malformed email for a new author', async () => {
    await render(vi.fn())
    await click('New author')
    await type('Author name', 'Dev')
    await type('Author email', 'not-an-email')
    expect(button('Add author').disabled).toBe(true)
    expect(container.textContent).toContain('Enter a valid email address.')
    expect(storeState.updateSettingsOrThrow).not.toHaveBeenCalled()
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
