import React, { useMemo, useState } from 'react'
import { FolderTree, Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import RepoBadgeLabel from '@/components/repo/RepoBadgeLabel'
import { getFolderSourceRepos } from '@/components/sidebar/folder-workspace-composer-helpers'
import { EMPTY_PROJECT_GROUPS } from '@/components/sidebar/worktree-list/viewport/viewport-props'
import { translate } from '@/i18n/i18n'
import { searchRepos } from '@/lib/repo-search'
import { useAppStore } from '@/store'
import { useMultiProjectComposerSelectionStore } from '@/store/multi-project-composer-selection'
import type { Repo } from '../../../../shared/repo-types'
import { isMultiProjectEligibleRepo } from './multi-project-workspace-eligibility'
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
  const projectGroups = useAppStore((s) => s.projectGroups ?? EMPTY_PROJECT_GROUPS)
  const extraRepoIds = useMultiProjectComposerSelectionStore((s) => s.extraRepoIds)
  const addRepoIds = useMultiProjectComposerSelectionStore((s) => s.addRepoIds)
  const removeRepoId = useMultiProjectComposerSelectionStore((s) => s.removeRepoId)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

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
    () => new Set([primaryRepoId, ...selectedRepos.map((repo) => repo.id)]),
    [primaryRepoId, selectedRepos]
  )
  const availableRepos = useMemo(
    () => repos.filter((repo) => isMultiProjectEligibleRepo(repo) && !takenRepoIds.has(repo.id)),
    [repos, takenRepoIds]
  )
  const groupPresets = useMemo(
    () =>
      projectGroups
        .map((group) => ({
          group,
          repoIds: getFolderSourceRepos(repos, projectGroups, group)
            .filter((repo) => isMultiProjectEligibleRepo(repo) && !takenRepoIds.has(repo.id))
            .map((repo) => repo.id)
        }))
        .filter((preset) => preset.repoIds.length > 0),
    [projectGroups, repos, takenRepoIds]
  )

  if (
    isProjectGroupTarget ||
    !primaryRepo ||
    !isMultiProjectEligibleRepo(primaryRepo) ||
    !canHostCreateMultiProjectWorkspace()
  ) {
    return null
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredRepos = searchRepos(availableRepos, query)
  const filteredPresets = groupPresets.filter((preset) =>
    preset.group.name.toLowerCase().includes(normalizedQuery)
  )
  const addAndClose = (repoIds: readonly string[]): void => {
    addRepoIds(repoIds)
    setOpen(false)
    setQuery('')
  }
  const canAddMore = availableRepos.length > 0

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
        {canAddMore ? (
          <Popover
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen)
              if (!nextOpen) {
                setQuery('')
              }
            }}
          >
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
              <Command shouldFilter={false}>
                <CommandInput
                  autoFocus
                  placeholder={translate(
                    'auto.components.ui.repo.multi.combobox.a58a0cd100',
                    'Search projects...'
                  )}
                  value={query}
                  onValueChange={setQuery}
                />
                <CommandList>
                  <CommandEmpty>
                    {translate(
                      'auto.components.ui.repo.multi.combobox.4471d4a1c0',
                      'No projects match your search.'
                    )}
                  </CommandEmpty>
                  {filteredRepos.length > 0 ? (
                    <CommandGroup
                      heading={translate(
                        'auto.components.newWorkspace.MultiProjectMembersField.projects',
                        'Projects'
                      )}
                    >
                      {filteredRepos.map((repo) => (
                        <CommandItem
                          key={repo.id}
                          value={`repo:${repo.id}`}
                          onSelect={() => addAndClose([repo.id])}
                        >
                          <div className="min-w-0 flex-1">
                            <RepoBadgeLabel name={repo.displayName} color={repo.badgeColor} />
                            <p className="truncate text-[11px] text-muted-foreground">
                              {repo.path}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {filteredPresets.length > 0 ? (
                    <CommandGroup
                      heading={translate(
                        'auto.components.newWorkspace.MultiProjectMembersField.groups',
                        'Add all projects in a group'
                      )}
                    >
                      {filteredPresets.map((preset) => (
                        <CommandItem
                          key={preset.group.id}
                          value={`group:${preset.group.id}`}
                          onSelect={() => addAndClose(preset.repoIds)}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <FolderTree className="size-3 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">{preset.group.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {preset.repoIds.length}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                </CommandList>
              </Command>
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
