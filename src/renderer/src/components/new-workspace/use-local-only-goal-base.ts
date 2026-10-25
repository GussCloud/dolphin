import React from 'react'
import { useAppStore } from '@/store'
import { useRepoMap } from '@/store/selectors'
import { getRuntimeEnvironmentIdForRepo } from '@/lib/repo-runtime-owner'
import { searchRuntimeRepoBaseRefDetails } from '@/runtime/runtime-repo-client'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import type { BaseRefSearchResult } from '../../../../shared/repo-types'

const LOCAL_ONLY_BASE_SEARCH_LIMIT = 50

/** A local branch with no remote ref of the same name: worker PRs would target a missing branch. */
export function isLocalOnlyBaseRef(baseBranch: string, refs: BaseRefSearchResult[]): boolean {
  const local = refs.some((ref) => ref.refName === baseBranch && ref.localBranchName === baseBranch)
  const remote = refs.some(
    (ref) => ref.refName !== ref.localBranchName && ref.localBranchName === baseBranch
  )
  return local && !remote
}

/** True only when the picked base is known to be local-only; unknown or default bases never warn. */
export function useLocalOnlyGoalBase(
  repoId: string,
  baseBranch: string | undefined,
  active: boolean
): boolean {
  const repo = useRepoMap().get(repoId)
  const repoHostId = repo ? getRepoExecutionHostId(repo) : undefined
  const runtimeEnvironmentId = useAppStore((state) => getRuntimeEnvironmentIdForRepo(state, repoId))
  const [localOnly, setLocalOnly] = React.useState(false)
  React.useEffect(() => {
    setLocalOnly(false)
    if (!active || !repoId || !baseBranch) {
      return
    }
    let stale = false
    void searchRuntimeRepoBaseRefDetails(
      { activeRuntimeEnvironmentId: runtimeEnvironmentId },
      repoId,
      baseBranch,
      LOCAL_ONLY_BASE_SEARCH_LIMIT,
      repoHostId
    )
      .then((refs) => {
        if (!stale) {
          setLocalOnly(isLocalOnlyBaseRef(baseBranch, refs))
        }
      })
      .catch(() => {})
    return () => {
      stale = true
    }
  }, [active, baseBranch, repoHostId, repoId, runtimeEnvironmentId])
  return localOnly
}
