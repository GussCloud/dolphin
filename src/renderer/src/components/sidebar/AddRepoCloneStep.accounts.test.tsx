// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CloneStep } from './AddRepoCloneStep'
import {
  EMPTY_NEW_PROJECT_ACCOUNT_DRAFT,
  type NewProjectAccountDraft
} from '../project-accounts/new-project-account-settings'

vi.mock('./AzureReposClonePicker', () => ({ AzureReposClonePicker: () => null }))
vi.mock('./RemoteFileBrowser', () => ({ RemoteFileBrowser: () => null }))
vi.mock('../project-accounts/NewProjectAccountFields', () => ({
  NewProjectAccountFields: (props: { wslDistro?: string | null }) => (
    <div data-testid="account-fields" data-wsl-distro={props.wslDistro ?? ''} />
  )
}))
vi.mock('@/components/ui/dialog', () => ({
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function projectAccounts(draft: NewProjectAccountDraft) {
  return {
    draft,
    setSelection: vi.fn(),
    setIdentity: vi.fn(),
    seedIdentity: vi.fn(),
    reset: vi.fn(),
    preferred: null
  }
}

async function render(props: {
  sshTargetId?: string | null
  draft?: NewProjectAccountDraft
  destination?: string
}) {
  await act(async () => {
    root.render(
      <CloneStep
        cloneUrl="https://github.com/acme/app.git"
        cloneDestination={props.destination ?? '/projects'}
        cloneError={null}
        cloneProgress={null}
        isCloning={false}
        sshTargetId={props.sshTargetId ?? null}
        onUrlChange={vi.fn()}
        onDestChange={vi.fn()}
        onPickDestination={vi.fn()}
        onClone={vi.fn()}
        projectAccounts={projectAccounts(props.draft ?? EMPTY_NEW_PROJECT_ACCOUNT_DRAFT)}
      />
    )
  })
}

function cloneButton(): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (entry) => entry.textContent === 'Clone'
  )
  if (!button) {
    throw new Error('Clone button not found')
  }
  return button
}

describe('CloneStep account fields', () => {
  it('shows the account and author fields for local and runtime clones', async () => {
    await render({})
    expect(container.querySelector('[data-testid="account-fields"]')).not.toBeNull()
    expect(cloneButton().disabled).toBe(false)
  })

  it('hides them for SSH targets and keeps Clone enabled', async () => {
    await render({
      sshTargetId: 'ssh-1',
      draft: { selection: null, identity: { name: 'Dev', email: '' } }
    })
    expect(container.querySelector('[data-testid="account-fields"]')).toBeNull()
    expect(cloneButton().disabled).toBe(false)
  })

  it('disables Clone while the commit author is half-filled', async () => {
    await render({ draft: { selection: null, identity: { name: 'Dev', email: '' } } })
    expect(cloneButton().disabled).toBe(true)
  })

  it('passes the WSL distro of the destination so its gh logins are listed', async () => {
    await render({ destination: '\\\\wsl.localhost\\Ubuntu\\home\\dev' })
    expect(
      container.querySelector('[data-testid="account-fields"]')?.getAttribute('data-wsl-distro')
    ).toBe('Ubuntu')
  })
})
