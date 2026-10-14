import { useCallback, useEffect, useRef, useState } from 'react'
import { getAzureDevOpsPullRequestBoard } from '@/lib/azure-devops-host-client'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import { useAppStore } from '@/store'
import type { AzureDevOpsPullRequestBoard } from '../../../../shared/azure-devops-pull-request-board'

const POLL_INTERVAL_MS = 30_000
const LOCAL_TARGET_KEY = 'local'

// Why: returning to the page shows the last board instantly instead of a skeleton while the next read runs.
const lastBoardByTarget = new Map<string, AzureDevOpsPullRequestBoard>()

type BoardState = {
  targetKey: string
  board: AzureDevOpsPullRequestBoard | null
  error: string | null
  // A read is in flight, user-requested or not.
  loading: boolean
  // The in-flight read was requested by the user, so the page dims the list.
  blocking: boolean
}

function initialState(targetKey: string): BoardState {
  return {
    targetKey,
    board: lastBoardByTarget.get(targetKey) ?? null,
    error: null,
    loading: false,
    blocking: false
  }
}

export type AzurePullRequestBoardView = Omit<BoardState, 'targetKey'> & {
  refresh: (manual?: boolean) => void
}

export function useAzurePullRequestBoard(): AzurePullRequestBoardView {
  const runtimeEnvironmentId = useAppStore((s) => s.settings?.activeRuntimeEnvironmentId ?? null)
  const targetKey = runtimeEnvironmentId ?? LOCAL_TARGET_KEY
  const [state, setState] = useState<BoardState>(() => initialState(targetKey))
  const inFlightRef = useRef(false)
  // Bumped whenever the runtime target changes or the page unmounts, so a late response is dropped.
  const generationRef = useRef(0)

  const refresh = useCallback(
    (manual = false): void => {
      const patch = (update: Partial<BoardState>): void =>
        setState((prev) => ({
          ...(prev.targetKey === targetKey ? prev : initialState(targetKey)),
          ...update
        }))
      if (inFlightRef.current) {
        if (manual) {
          patch({ blocking: true })
        }
        return
      }
      inFlightRef.current = true
      const generation = generationRef.current
      patch({ loading: true, blocking: manual })
      void getAzureDevOpsPullRequestBoard({
        activeRuntimeEnvironmentId: runtimeEnvironmentId
      }).then((result) => {
        if (generation !== generationRef.current) {
          return
        }
        inFlightRef.current = false
        if (result.ok) {
          lastBoardByTarget.set(targetKey, result.board)
          patch({
            board: result.board,
            error: null,
            loading: false,
            blocking: false
          })
        } else {
          // The last board stays on screen under the error so a transient failure does not blank the page.
          patch({ error: result.error, loading: false, blocking: false })
        }
      })
    },
    [runtimeEnvironmentId, targetKey]
  )

  useEffect(() => {
    const stopPolling = installWindowVisibilityInterval({
      run: () => refresh(false),
      intervalMs: POLL_INTERVAL_MS
    })
    return () => {
      stopPolling()
      generationRef.current += 1
      inFlightRef.current = false
    }
  }, [refresh])

  const current = state.targetKey === targetKey ? state : initialState(targetKey)
  return {
    board: current.board,
    error: current.error,
    loading: current.loading,
    blocking: current.blocking,
    refresh
  }
}
