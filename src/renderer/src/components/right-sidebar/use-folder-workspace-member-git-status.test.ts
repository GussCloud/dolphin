// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import { makeWorktree, TEST_REPO } from '@/store/slices/store-test-helpers'
import type { FolderWorkspaceGitMember } from './folder-workspace-git-members'
import { useFolderWorkspaceMemberGitStatus } from './use-folder-workspace-member-git-status'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const refreshMock = vi.hoisted(() => vi.fn())
vi.mock('./git-status-refresh', () => ({
  refreshGitStatusForWorktree: refreshMock
}))
vi.mock('./file-explorer-runtime-owner', () => ({
  getRightSidebarWorktreeRuntimeSettings: () => ({ activeRuntimeEnvironmentId: null })
}))

const repo: Repo = { ...TEST_REPO, kind: 'git', connectionId: null }
const members: FolderWorkspaceGitMember[] = [
  { repo, worktree: makeWorktree({ id: 'repo1::/a', repoId: repo.id, path: '/a' }) },
  { repo, worktree: makeWorktree({ id: 'repo1::/b', repoId: repo.id, path: '/b' }) }
]

let visibilityState: DocumentVisibilityState = 'visible'
let root: Root | null = null
let refreshNow: () => void = () => {}

function HookProbe(): null {
  refreshNow = useFolderWorkspaceMemberGitStatus(members, true)
  return null
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve()
    }
  })
}

async function setVisibility(next: DocumentVisibilityState): Promise<void> {
  visibilityState = next
  document.dispatchEvent(new Event('visibilitychange'))
  await act(async () => {
    vi.advanceTimersByTime(500)
  })
  await flush()
}

describe('useFolderWorkspaceMemberGitStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refreshMock.mockReset().mockResolvedValue(undefined)
    visibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState)
  })

  afterEach(() => {
    if (root) {
      const mounted = root
      act(() => mounted.unmount())
      root = null
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  async function mount(): Promise<void> {
    root = createRoot(document.createElement('div'))
    const mounted = root
    await act(async () => {
      mounted.render(createElement(HookProbe))
    })
    await flush()
  }

  it('stops polling while hidden and refreshes every member as soon as it is visible again', async () => {
    await mount()
    expect(refreshMock).toHaveBeenCalledTimes(members.length)

    await setVisibility('hidden')
    refreshMock.mockClear()
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000)
    })
    await flush()
    expect(refreshMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)

    await setVisibility('visible')
    expect(refreshMock).toHaveBeenCalledTimes(members.length)
  })

  it('keeps the 30s lane and manual refresh while visible', async () => {
    await mount()
    refreshMock.mockClear()

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    await flush()
    expect(refreshMock).toHaveBeenCalledTimes(members.length)

    refreshMock.mockClear()
    refreshNow()
    await flush()
    expect(refreshMock).toHaveBeenCalledTimes(members.length)
  })

  it('aborts in-flight requests on unmount', async () => {
    await mount()
    const signal: AbortSignal = refreshMock.mock.calls[0][0].request.signal
    expect(signal.aborted).toBe(false)
    act(() => root?.unmount())
    root = null
    expect(signal.aborted).toBe(true)
  })
})
