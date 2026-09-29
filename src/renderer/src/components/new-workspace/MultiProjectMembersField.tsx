import React, { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import RepoBadgeLabel from '@/components/repo/RepoBadgeLabel'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useMultiProjectComposerSelectionStore } from '@/store/multi-project-composer-selection'
import type { Repo } from '../../../../shared/repo-types'
import { isMultiProjectEligibleRepo } from '../../../../shared/multi-project-workspace-eligibility'
import {
  MultiProjectProjectPicker,
  useAvailableMultiProjectRepos
} from './MultiProjectProjectPicker'
import { canHostCreateMultiProjectWorkspace } from './use-multi-project-members'

/**
 * Lets the composer add more projects beside the primary one. Two or more projects turn the create
 * into one workspace holding a worktree per project, all on the same branch.
 */
export function MultiProjectMembersField({
  primaryRepoId,
  isProjectGroupTarget
}: {
  primaryRepoId: string | null
  isProjectGroupTarget: boolean
}): React.JSX.Element | null {
  const repos = useAppStore((s) => s.repos)
  const extraRepoIds = useMultiProjectComposerSelectionStore((s) => s.extraRepoIds)
  const addRepoIds = useMultiProjectComposerSelectionStore((s) => s.addRepoIds)
  const removeRepoId = useMultiProjectComposerSelectionStore((s) => s.removeRepoId)
  const [open, setOpen] = useState(false)

  const repoById = useMemo(() => new Map(repos.map((repo) => [repo.id, repo])), [repos])
  const primaryRepo = primaryRepoId ? repoById.get(primaryRepoId) : undefined
  const selectedRepos = useMemo(
    () =>
      extraRepoIds
        .map((repoId) => repoById.get(repoId))
        .filter(
          (repo): repo is Repo =>
            repo !== undefined && repo.id !== primaryRepoId && isMultiProjectEligibleRepo(repo)
        ),
    [extraRepoIds, primaryRepoId, repoById]
  )
  const takenRepoIds = useMemo(
    () => new Set([primaryRepoId ?? '', ...selectedRepos.map((repo) => repo.id)]),
    [primaryRepoId, selectedRepos]
  )
  const { availableRepos } = useAvailableMultiProjectRepos(takenRepoIds)

  if (
    isProjectGroupTarget ||
    !primaryRepo ||
    !isMultiProjectEligibleRepo(primaryRepo) ||
    !canHostCreateMultiProjectWorkspace()
  ) {
    return null
  }

  return (
    <div className="space-y-1.5 pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedRepos.map((repo) => (
          <Badge key={repo.id} variant="outline" className="h-6">
            <RepoBadgeLabel name={repo.displayName} color={repo.badgeColor} />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate(
                'auto.components.newWorkspace.MultiProjectMembersField.remove',
                'Remove {{value0}}',
                { value0: repo.displayName }
              )}
              onClick={() => removeRepoId(repo.id)}
            >
              <X />
            </Button>
          </Badge>
        ))}
        {availableRepos.length > 0 ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="xs">
                <Plus className="size-3" />
                {translate(
                  'auto.components.newWorkspace.MultiProjectMembersField.add',
                  'Add another project'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(320px,calc(100vw-1rem))]">
              <MultiProjectProjectPicker
                takenRepoIds={takenRepoIds}
                onPick={(repoIds) => {
                  addRepoIds(repoIds)
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
      {selectedRepos.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {translate(
            'auto.components.newWorkspace.MultiProjectMembersField.hint',
            'Each project gets a worktree on the same branch, inside one folder for this workspace.'
          )}
        </p>
      ) : null}
    </div>
  )
}
