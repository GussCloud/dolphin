import { useMemo, useState } from 'react'
import {
  isMultiProjectEligibleRepo,
  resolveMultiProjectMemberRepoIds
} from '../../../src/shared/multi-project-workspace-eligibility'
import type { NewWorktreeMultiProjectState } from './NewWorktreeFormSheet'
import type { MobileWorkspaceRepo } from './new-worktree-modal-types'

export type ExtraProjectPickerItem = {
  id: string
  label: string
  detail: string
  repo: MobileWorkspaceRepo
}

/** The projects added beside the primary one, which turn the create into a multi-project workspace. */
export function useNewWorkspaceMultiProject(args: {
  repos: readonly MobileWorkspaceRepo[]
  selectedRepo: MobileWorkspaceRepo | null
  supported: boolean
}): {
  state: NewWorktreeMultiProjectState | null
  /** Primary first; null while fewer than two eligible projects are picked. */
  memberRepoIds: string[] | null
  pickerItems: ExtraProjectPickerItem[]
  add: (repoId: string) => void
  remove: (repoId: string) => void
} {
  const { repos, selectedRepo, supported } = args
  const [extraRepoIds, setExtraRepoIds] = useState<string[]>([])
  const primaryId = selectedRepo?.id ?? null
  const enabled = supported && selectedRepo != null && isMultiProjectEligibleRepo(selectedRepo)

  const derived = useMemo(() => {
    const extraRepos = extraRepoIds
      .filter((id) => id !== primaryId)
      .map((id) => repos.find((repo) => repo.id === id))
      .filter((repo): repo is MobileWorkspaceRepo => repo != null)
    const pickerItems = repos
      .filter(
        (repo) =>
          repo.id !== primaryId &&
          !extraRepoIds.includes(repo.id) &&
          isMultiProjectEligibleRepo(repo)
      )
      .map((repo) => ({ id: repo.id, label: repo.displayName, detail: repo.path, repo }))
    const memberRepoIds = resolveMultiProjectMemberRepoIds({
      primaryRepoId: primaryId,
      extraRepoIds,
      repos
    })
    return { extraRepos, pickerItems, memberRepoIds }
  }, [extraRepoIds, primaryId, repos])

  return {
    state: enabled
      ? {
          extraRepos: derived.extraRepos,
          canAddMore: derived.pickerItems.length > 0,
          active: derived.memberRepoIds != null
        }
      : null,
    memberRepoIds: enabled ? derived.memberRepoIds : null,
    pickerItems: enabled ? derived.pickerItems : [],
    add: (repoId) => setExtraRepoIds((current) => [...current, repoId]),
    remove: (repoId) => setExtraRepoIds((current) => current.filter((id) => id !== repoId))
  }
}
