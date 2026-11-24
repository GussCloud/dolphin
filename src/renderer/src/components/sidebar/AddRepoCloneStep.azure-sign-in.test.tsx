// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CloneStep } from './AddRepoCloneStep'

vi.mock('./AzureReposClonePicker', () => ({
  AzureReposClonePicker: (props: { disabled?: boolean }) => (
    <div data-testid="azure-repo-picker" data-disabled={String(Boolean(props.disabled))} />
  )
}))
vi.mock('./RemoteFileBrowser', () => ({ RemoteFileBrowser: () => null }))
vi.mock('../azure-devops/use-azure-cli-sign-in-notice', () => ({
  useAzureCliSignInState: () => null
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

async function render(isSigningIn: boolean): Promise<void> {
  await act(async () => {
    root.render(
      <CloneStep
        cloneUrl="https://dev.azure.com/evup/P/_git/app"
        cloneDestination="/projects"
        cloneError="Clone failed: Azure DevOps did not accept the sign-in for this clone."
        cloneProgress={null}
        isCloning={false}
        onUrlChange={vi.fn()}
        onDestChange={vi.fn()}
        onPickDestination={vi.fn()}
        onClone={vi.fn()}
        azureSignIn={{ available: true, isSigningIn, error: null, signIn: vi.fn() }}
      />
    )
  })
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(
    (entry) => entry.textContent === label || entry.getAttribute('aria-label') === label
  )
  if (!found) {
    throw new Error(`missing button ${label}`)
  }
  return found
}

function lockedStates(): boolean[] {
  return [
    ...Array.from(container.querySelectorAll('input')).map((input) => input.disabled),
    container.querySelector('[data-testid="azure-repo-picker"]')?.getAttribute('data-disabled') ===
      'true',
    button('Choose folder').disabled,
    button('Clone').disabled
  ]
}

describe('CloneStep Azure DevOps sign-in', () => {
  it('locks the URL, folder and clone while the code sign-in is pending', async () => {
    await render(true)
    expect(lockedStates()).toEqual([true, true, true, true, true])
    expect(button('Signing in…').disabled).toBe(true)
  })

  it('leaves the form editable before the sign-in starts', async () => {
    await render(false)
    expect(lockedStates()).toEqual([false, false, false, false, false])
    expect(button('Sign in with a code').disabled).toBe(false)
  })
})
