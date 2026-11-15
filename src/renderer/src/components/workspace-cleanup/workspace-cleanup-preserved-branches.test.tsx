// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceCleanupPreservedBranches } from './workspace-cleanup-preserved-branches'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const branch = {
  repoId: 'repo-1',
  repoName: 'Repo',
  worktreePath: '/wt/feature',
  branchName: 'feature',
  head: 'abc',
  preservedAt: 1
}

describe('WorkspaceCleanupPreservedBranches', () => {
  let container: HTMLDivElement
  let root: Root
  const list = vi.fn()
  const remove = vi.fn()

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    list.mockReset().mockResolvedValueOnce([branch]).mockResolvedValue([])
    remove.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { workspaceCleanup: { listPreservedBranches: list, deletePreservedBranch: remove } }
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const button = (text: string) =>
    [...container.querySelectorAll('button')].find((el) => el.textContent?.includes(text))

  it('deletes a kept branch only after a second click', async () => {
    await act(async () => root.render(<WorkspaceCleanupPreservedBranches now={2} />))
    await act(async () => button('Kept branches')?.click())
    expect(container.textContent).toContain('feature')

    await act(async () => button('Delete')?.click())
    expect(remove).not.toHaveBeenCalled()
    await act(async () => button('Discard commits')?.click())
    expect(remove).toHaveBeenCalledWith({ repoId: 'repo-1', branchName: 'feature' })
    // Reloaded after deleting: the section disappears once nothing is left.
    expect(container.textContent).toBe('')
  })

  it('renders nothing when no branch was kept', async () => {
    list.mockReset().mockResolvedValue([])
    await act(async () => root.render(<WorkspaceCleanupPreservedBranches now={2} />))
    expect(container.textContent).toBe('')
  })
})
