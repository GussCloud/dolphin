import React, { useMemo, useState } from 'react'
import { FolderTree } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import RepoBadgeLabel from '@/components/repo/RepoBadgeLabel'
import { getFolderSourceRepos } from '@/components/sidebar/folder-workspace-composer-helpers'
import { EMPTY_PROJECT_GROUPS } from '@/components/sidebar/worktree-list/viewport/viewport-props'
import { translate } from '@/i18n/i18n'
import { searchRepos } from '@/lib/repo-search'
import { useAppStore } from '@/store'
import { isMultiProjectEligibleRepo } from '../../../../shared/multi-project-workspace-eligibility'

/** Eligible projects not already taken, for the pickers that add projects to a workspace. */
export function useAvailableMultiProjectRepos(takenRepoIds: ReadonlySet<string>) {
  const repos = useAppStore((s) => s.repos)
  const projectGroups = useAppStore((s) => s.projectGroups ?? EMPTY_PROJECT_GROUPS)
  return useMemo(() => {
    const isAvailable = (repoId: string, eligible: boolean): boolean =>
      eligible && !takenRepoIds.has(repoId)
    const availableRepos = repos.filter((repo) =>
      isAvailable(repo.id, isMultiProjectEligibleRepo(repo))
    )
    const groupPresets = projectGroups
      .map((group) => ({
        group,
        repoIds: getFolderSourceRepos(repos, projectGroups, group)
          .filter((repo) => isAvailable(repo.id, isMultiProjectEligibleRepo(repo)))
          .map((repo) => repo.id)
      }))
      .filter((preset) => preset.repoIds.length > 0)
    return { availableRepos, groupPresets }
  }, [projectGroups, repos, takenRepoIds])
}

/**
 * Searchable list of projects that can join a multi-project workspace, plus a shortcut that adds
 * every project of a group at once.
 */
export function MultiProjectProjectPicker({
  takenRepoIds,
  onPick
}: {
  takenRepoIds: ReadonlySet<string>
  onPick: (repoIds: readonly string[]) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const { availableRepos, groupPresets } = useAvailableMultiProjectRepos(takenRepoIds)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredRepos = searchRepos(availableRepos, query)
  const filteredPresets = groupPresets.filter((preset) =>
    preset.group.name.toLowerCase().includes(normalizedQuery)
  )

  return (
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
                onSelect={() => onPick([repo.id])}
              >
                <div className="min-w-0 flex-1">
                  <RepoBadgeLabel name={repo.displayName} color={repo.badgeColor} />
                  <p className="truncate text-[11px] text-muted-foreground">{repo.path}</p>
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
                onSelect={() => onPick(preset.repoIds)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FolderTree className="size-3 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{preset.group.name}</span>
                  <span className="text-[11px] text-muted-foreground">{preset.repoIds.length}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  )
}
