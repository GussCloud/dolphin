import { AppState } from 'react-native'
import type { RuntimeClientEventStreamMessage } from '../../../src/shared/runtime-client-events'
import type { RpcClient } from '../transport/rpc-client'

// Also the floor between change-driven reads, which arrive per agent step.
const WORKTREE_REFRESH_MS = 3000

type WorktreeRefreshOptions = { allowDuringModal?: boolean }
type RepoRefreshOptions = { force?: boolean; queueIfInFlight?: boolean }

type HostWorktreeRefreshArgs = {
  client: RpcClient
  fetchWorktrees: (options?: WorktreeRefreshOptions) => Promise<void>
  fetchRepoMetadata: (options?: RepoRefreshOptions) => Promise<void>
}

export function startHostWorktreeRefresh({
  client,
  fetchWorktrees,
  fetchRepoMetadata
}: HostWorktreeRefreshArgs): () => void {
  let stale = false
  let eventStreamReady = false
  // Set when a backgrounded page skips notices; coming back then re-reads both snapshots once.
  let owed = false
  let lastWorktreeReadAt = 0
  let trailingRead: ReturnType<typeof setTimeout> | undefined
  const hidden = (): boolean => AppState.currentState !== 'active'

  const readWorktrees = (options?: WorktreeRefreshOptions): void => {
    lastWorktreeReadAt = Date.now()
    void fetchWorktrees(options)
  }
  const readEverything = (worktreeOptions?: WorktreeRefreshOptions): void => {
    readWorktrees(worktreeOptions)
    void fetchRepoMetadata({ force: true, queueIfInFlight: true })
  }
  const refreshWorktreesOnChange = (): void => {
    if (trailingRead) {
      return
    }
    const wait = lastWorktreeReadAt + WORKTREE_REFRESH_MS - Date.now()
    if (wait <= 0) {
      readWorktrees()
      return
    }
    trailingRead = setTimeout(() => {
      trailingRead = undefined
      if (!hidden()) {
        readWorktrees()
      }
    }, wait)
  }

  const refreshOnForeground = (): void => {
    if (hidden()) {
      return
    }
    clearTimeout(trailingRead)
    trailingRead = undefined
    if (owed) {
      owed = false
      readEverything({ allowDuringModal: true })
      return
    }
    readWorktrees({ allowDuringModal: true })
    void fetchRepoMetadata({ queueIfInFlight: true })
  }

  const appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      refreshOnForeground()
    }
  })
  const interval = setInterval(() => {
    if (hidden()) {
      return
    }
    void fetchWorktrees()
    // Why: desktop Settings repo edits (icon/color/name, repo removal) now emit `reposChanged`
    // (#11994), but a host on an older build does not; keep this periodic repo.list as the
    // convergence safety-net. fetchRepoMetadata self-throttles to REPO_METADATA_REFRESH_MS
    // (60s), so this is ~1 request/min while foregrounded — the AppState gate is what removes
    // the waste (both stop while backgrounded).
    void fetchRepoMetadata()
  }, WORKTREE_REFRESH_MS)
  const unsubscribe = client.subscribe(
    'runtime.clientEvents.subscribe',
    null,
    (payload: unknown) => {
      if (stale || !payload || typeof payload !== 'object') {
        return
      }
      const event = payload as RuntimeClientEventStreamMessage | { type: 'error' }
      if (event.type === 'ready') {
        const replayedAfterReconnect = eventStreamReady
        eventStreamReady = true
        if (replayedAfterReconnect) {
          // Why: client events are not queued while disconnected, so re-read both snapshots after replay.
          if (hidden()) {
            owed = true
          } else {
            readEverything()
          }
        }
        return
      }
      if (event.type === 'end' || event.type === 'error') {
        eventStreamReady = false
        return
      }
      // Why: notices arrive per agent step; a backgrounded page reads nothing and catches up on return.
      if (hidden()) {
        owed = true
        return
      }
      if (event.type === 'reposChanged') {
        // Why: folder workspace mutations publish reposChanged, and worktree.ps owns this catalog.
        refreshWorktreesOnChange()
        void fetchRepoMetadata({ force: true, queueIfInFlight: true })
      } else if (event.type === 'worktreesChanged') {
        refreshWorktreesOnChange()
      }
    }
  )

  void fetchWorktrees()
  void fetchRepoMetadata({ force: true, queueIfInFlight: true })

  return () => {
    stale = true
    clearTimeout(trailingRead)
    clearInterval(interval)
    appStateSubscription.remove()
    unsubscribe()
  }
}
