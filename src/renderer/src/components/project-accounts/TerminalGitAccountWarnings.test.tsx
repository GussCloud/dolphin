// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { TerminalGitAccountWarnings } from './TerminalGitAccountWarnings'

const FILE_TOKEN_WARNING =
  'GitHub account work-login is stored without the system keyring, so terminals in this project use your default gh login.'

let container: HTMLDivElement
let root: Root
const getWarnings = vi.fn()

function installApiWithoutRepos(): void {
  vi.stubGlobal('api', {})
}

function installApi(read: typeof getWarnings | undefined): void {
  vi.stubGlobal('api', { repos: read ? { getTerminalGitAccountWarnings: read } : {} })
}

beforeEach(() => {
  container = document.createElement('div')
  root = createRoot(container)
  getWarnings.mockReset()
})

afterEach(() => {
  act(() => root.unmount())
  vi.unstubAllGlobals()
})

async function render(runtimeTarget: RuntimeClientTarget, bindingKey = 'a'): Promise<void> {
  await act(async () => {
    root.render(
      <TerminalGitAccountWarnings
        repoId="repo-1"
        runtimeTarget={runtimeTarget}
        bindingKey={bindingKey}
      />
    )
  })
}

describe('TerminalGitAccountWarnings', () => {
  it('shows each reason the binding does not reach the terminals', async () => {
    getWarnings.mockResolvedValue([FILE_TOKEN_WARNING])
    installApi(getWarnings)
    await render({ kind: 'local' })
    expect(getWarnings).toHaveBeenCalledWith({ repoId: 'repo-1' })
    expect(container.textContent).toBe(FILE_TOKEN_WARNING)
  })

  it('re-reads the warnings when the binding changes', async () => {
    getWarnings.mockResolvedValueOnce([FILE_TOKEN_WARNING]).mockResolvedValueOnce([])
    installApi(getWarnings)
    await render({ kind: 'local' }, 'a')
    await render({ kind: 'local' }, 'b')
    expect(getWarnings).toHaveBeenCalledTimes(2)
    expect(container.textContent).toBe('')
  })

  it('renders nothing on an older host without the call, a remote runtime, or a failed read', async () => {
    installApi(undefined)
    await render({ kind: 'local' })
    expect(container.textContent).toBe('')

    getWarnings.mockResolvedValue([FILE_TOKEN_WARNING])
    installApi(getWarnings)
    await render({ kind: 'environment', environmentId: 'env-1' })
    expect(getWarnings).not.toHaveBeenCalled()
    expect(container.textContent).toBe('')

    getWarnings.mockRejectedValue(new Error('boom'))
    await render({ kind: 'local' }, 'c')
    expect(container.textContent).toBe('')
  })

  it('renders nothing when the host exposes no repos API at all', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      installApiWithoutRepos()
      await render({ kind: 'local' })
      await act(async () => {})
      expect(container.textContent).toBe('')
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})
