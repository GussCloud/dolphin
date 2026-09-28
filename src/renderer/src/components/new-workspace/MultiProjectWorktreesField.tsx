import { useId, useMemo } from 'react'
import { getFolderSourceRepos } from '@/components/sidebar/folder-workspace-composer-helpers'
import { EMPTY_PROJECT_GROUPS } from '@/components/sidebar/worktree-list/viewport/viewport-props'
import { Checkbox } from '@/components/ui/checkbox'
import RepoMultiCombobox from '@/components/ui/repo-multi-combobox'
import { translate } from '@/i18n/i18n'
import { getProjectGroupIdFromNewWorkspaceOptionId } from '@/lib/new-workspace-project-options'
import { useAppStore } from '@/store'
import {
  getMultiProjectWorktreeSelection,
  resolveMultiProjectWorktreeRepoIds,
  useMultiProjectWorktreeSelectionStore
} from '@/store/multi-project-worktree-selection'
import { getMultiProjectEligibleRepos } from './multi-project-workspace-eligibility'

/** Composer opt-in that turns a project-group workspace into one worktree per selected project. */
export function MultiProjectWorktreesField({
  selectedProjectId
}: {
  selectedProjectId: string | null
}): React.JSX.Element | null {
  const checkboxId = useId()
  const projectGroupId = selectedProjectId
    ? getProjectGroupIdFromNewWorkspaceOptionId(selectedProjectId)
    : null
  const projectGroups = useAppStore((s) => s.projectGroups ?? EMPTY_PROJECT_GROUPS)
  const repos = useAppStore((s) => s.repos)
  const selection = useMultiProjectWorktreeSelectionStore((s) =>
    projectGroupId ? getMultiProjectWorktreeSelection(s.byProjectGroupId, projectGroupId) : null
  )
  const setEnabled = useMultiProjectWorktreeSelectionStore((s) => s.setEnabled)
  const setRepoIds = useMultiProjectWorktreeSelectionStore((s) => s.setRepoIds)

  const eligibleRepos = useMemo(() => {
    const group = projectGroups.find((entry) => entry.id === projectGroupId) ?? null
    return getMultiProjectEligibleRepos(group, getFolderSourceRepos(repos, projectGroups, group))
  }, [projectGroupId, projectGroups, repos])

  // Why: web clients reach a remote host, which can't place worktrees on this machine's disk.
  const hostCanCreate = typeof window.api?.worktrees?.createMultiProject === 'function'
  if (!hostCanCreate || !projectGroupId || !selection || eligibleRepos.length === 0) {
    return null
  }
  const selectedRepoIds = new Set(
    resolveMultiProjectWorktreeRepoIds(
      { enabled: true, repoIds: selection.repoIds },
      eligibleRepos.map((repo) => repo.id)
    )
  )

  return (
    <div className="space-y-2 pt-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkboxId}
          checked={selection.enabled}
          onCheckedChange={(checked) => setEnabled(projectGroupId, checked === true)}
        />
        <label htmlFor={checkboxId} className="text-xs font-medium text-muted-foreground">
          {translate(
            'auto.components.newWorkspace.MultiProjectWorktreesField.toggle',
            'Create a worktree in each project'
          )}
        </label>
      </div>
      {selection.enabled ? (
        <div className="space-y-1">
          <RepoMultiCombobox
            repos={eligibleRepos}
            selected={selectedRepoIds}
            onChange={(next) => setRepoIds(projectGroupId, [...next])}
            onSelectAll={() => setRepoIds(projectGroupId, null)}
            triggerClassName="h-9 w-full"
          />
          <p className="text-[11px] text-muted-foreground">
            {translate(
              'auto.components.newWorkspace.MultiProjectWorktreesField.hint',
              'Each project gets a worktree on the same branch, inside one folder for this workspace.'
            )}
          </p>
        </div>
      ) : null}
    </div>
  )
}
