import type { DetailCommentRenderersModel } from './use-mobile-tasks-detail-comment-renderers'
import { type PickerOption, View, useMemo } from './mobile-tasks-dependencies'
import {
  type GitHubRepoSources,
  type LinearTeam,
  PROJECT_VIEW_DEFAULT_SORT,
  type RepoSummary,
  type TaskListEntry,
  sortMobileTaskItems,
  getRepoBadgeColor,
  hasGitHubIssueSourceChoice,
  issueSourceSlug,
  taskRepositoryMeta
} from './mobile-tasks-legacy-foundation'
import { styles } from './mobile-tasks-legacy-styles'
import { providerOptions as buildProviderOptions, sortOptions } from './mobile-tasks-options'
import { tasksCopyCatalog } from './tasks-translate'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

export function useMobileTasksPickerProjection(model: DetailCommentRenderersModel) {
  const {
    createRepoId,
    createTeamId,
    githubMode,
    githubProjectAvailableSummaryFields,
    githubProjectSortOverride,
    githubProjectSummaryFields,
    githubProjectTable,
    githubProjectViews,
    githubRepoSources,
    hostedRepos,
    items,
    linearTeams,
    provider,
    reposById,
    selectedHostedRepos,
    selectedRepoIds,
    taskSort,
    visibleProviders,
    workspaceRepos
  } = model
  const t = useMobileTranslation(tasksCopyCatalog)
  const createTargetOptions = useMemo<PickerOption<string>[]>(
    () =>
      provider === 'github' || provider === 'gitlab'
        ? hostedRepos.map((repo) => ({
            value: repo.id,
            label: repo.displayName,
            subtitle: repo.path,
            renderIcon: () => (
              <View
                style={[
                  styles.pickerRepoDot,
                  { backgroundColor: getRepoBadgeColor(repo, repo.displayName) }
                ]}
              />
            )
          }))
        : linearTeams.map((team) => ({
            value: team.id,
            label: team.name,
            subtitle: team.workspaceName
          })),
    [hostedRepos, linearTeams, provider]
  )
  const selectedCreateTarget =
    provider === 'github' || provider === 'gitlab'
      ? (hostedRepos.find((repo) => repo.id === createRepoId) ?? hostedRepos[0] ?? null)
      : (linearTeams.find((team) => team.id === createTeamId) ?? linearTeams[0] ?? null)
  const selectedCreateTargetLabel =
    provider === 'github' || provider === 'gitlab'
      ? ((selectedCreateTarget as RepoSummary | null)?.displayName ?? t('selectTarget'))
      : ((selectedCreateTarget as LinearTeam | null)?.name ?? t('selectTarget'))
  const providerLabel =
    provider === 'github' ? 'GitHub' : provider === 'gitlab' ? 'GitLab' : 'Linear'
  const showHeaderCreateTask =
    provider === 'linear' || (provider === 'github' && githubMode === 'items')
  const providerOptions = useMemo(
    () => buildProviderOptions(t).filter((option) => visibleProviders.includes(option.value)),
    [t, visibleProviders]
  )
  const selectedCreateRepo =
    provider === 'github' || provider === 'gitlab'
      ? (selectedCreateTarget as RepoSummary | null)
      : null
  const selectedCreateGitHubSources =
    provider === 'github' && selectedCreateRepo
      ? githubRepoSources[selectedCreateRepo.id]
      : undefined
  const selectedCreateIssuePreference =
    selectedCreateRepo?.issueSourcePreference === 'origin' ||
    selectedCreateRepo?.issueSourcePreference === 'upstream'
      ? selectedCreateRepo.issueSourcePreference
      : 'upstream'
  const githubIssueSourceRows = useMemo(
    () =>
      selectedHostedRepos
        .map((repo) => ({ repo, sources: githubRepoSources[repo.id] }))
        .filter((entry): entry is { repo: RepoSummary; sources: GitHubRepoSources } =>
          hasGitHubIssueSourceChoice(entry.sources)
        ),
    [githubRepoSources, selectedHostedRepos]
  )
  const githubIssueSourceLabel =
    githubIssueSourceRows.length === 1
      ? issueSourceSlug(
          githubIssueSourceRows[0]!.repo.issueSourcePreference === 'origin'
            ? githubIssueSourceRows[0]!.sources.prs
            : githubIssueSourceRows[0]!.sources.upstreamCandidate
        )
      : t('sourceCount', { count: githubIssueSourceRows.length })
  const repoPickerLabel =
    selectedRepoIds.size === 0 || selectedHostedRepos.length === hostedRepos.length
      ? t('allRepos')
      : selectedHostedRepos.length === 1
        ? selectedHostedRepos[0]!.displayName
        : t('repoCount', { count: selectedHostedRepos.length })
  const repoPickerSelectedRepo =
    selectedRepoIds.size > 0 && selectedHostedRepos.length === 1 ? selectedHostedRepos[0]! : null
  const workspaceRepoOptions = useMemo<PickerOption<string>[]>(
    () =>
      workspaceRepos.map((repo) => ({
        value: repo.id,
        label: repo.displayName,
        subtitle: repo.path,
        renderIcon: () => (
          <View
            style={[
              styles.pickerRepoDot,
              { backgroundColor: getRepoBadgeColor(repo, repo.displayName) }
            ]}
          />
        )
      })),
    [workspaceRepos]
  )
  const sortedItems = useMemo(
    () => sortMobileTaskItems(items, taskSort, reposById),
    [items, reposById, taskSort]
  )
  const displayedEntries = useMemo<TaskListEntry[]>(() => {
    if (taskSort !== 'repository') {
      return sortedItems.map((item) => ({ type: 'item', key: item.key, item }))
    }
    const entries: TaskListEntry[] = []
    let previousRepoKey = ''
    for (const item of sortedItems) {
      const repo = taskRepositoryMeta(item, reposById)
      if (repo.key !== previousRepoKey) {
        entries.push({
          type: 'section',
          key: `section:${repo.key}`,
          label: repo.label,
          color: repo.color
        })
        previousRepoKey = repo.key
      }
      entries.push({ type: 'item', key: item.key, item })
    }
    return entries
  }, [reposById, sortedItems, taskSort])
  const sortLabel =
    sortOptions(t).find((option) => option.value === taskSort)?.label ?? t('updated')
  const githubProjectFields = githubProjectTable?.selectedView.fields ?? []
  const githubProjectViewSort = githubProjectTable?.selectedView.sortByFields?.[0] ?? null
  const githubProjectSortField = githubProjectSortOverride
    ? githubProjectFields.find((field) => field.id === githubProjectSortOverride.fieldId)
    : githubProjectViewSort?.field
  const githubProjectSortDirection =
    githubProjectSortOverride?.direction ?? githubProjectViewSort?.direction ?? null
  const githubProjectSortLabel = githubProjectSortField
    ? githubProjectSortDirection === 'DESC'
      ? t('projectSortLabelDesc', { field: githubProjectSortField.name })
      : t('projectSortLabelAsc', { field: githubProjectSortField.name })
    : t('projectViewOrder')
  const githubProjectFieldsLabel =
    githubProjectAvailableSummaryFields.length > 0
      ? t('projectFieldsCount', {
          shown: githubProjectSummaryFields.length,
          total: githubProjectAvailableSummaryFields.length
        })
      : t('projectFieldsButton')
  const githubProjectSortOptions = useMemo<PickerOption<string>[]>(
    () => [
      {
        value: PROJECT_VIEW_DEFAULT_SORT,
        label: t('projectViewOrder'),
        subtitle: githubProjectViewSort
          ? githubProjectViewSort.direction === 'DESC'
            ? t('projectSortUsesDesc', { field: githubProjectViewSort.field.name })
            : t('projectSortUsesAsc', { field: githubProjectViewSort.field.name })
          : t('projectSortUsesRank')
      },
      ...githubProjectFields.map((field) => {
        const active = githubProjectSortOverride?.fieldId === field.id
        return {
          value: field.id,
          label: field.name,
          subtitle: active
            ? githubProjectSortOverride.direction === 'DESC'
              ? t('projectSortCurrentlyDesc')
              : t('projectSortCurrentlyAsc')
            : t('projectSortAscending')
        }
      })
    ],
    [githubProjectFields, githubProjectSortOverride, githubProjectViewSort, t]
  )
  const githubProjectViewOptions = useMemo<PickerOption<string>[]>(
    () =>
      githubProjectViews.map((view) => ({
        value: view.id,
        label: view.name,
        subtitle:
          view.layout === 'TABLE_LAYOUT'
            ? t('projectViewNumber', { number: view.number })
            : t('projectViewUnsupportedLayout'),
        disabled: view.layout !== 'TABLE_LAYOUT'
      })),
    [githubProjectViews, t]
  )
  return Object.assign(model, {
    createTargetOptions,
    selectedCreateTarget,
    selectedCreateTargetLabel,
    providerLabel,
    showHeaderCreateTask,
    providerOptions,
    selectedCreateRepo,
    selectedCreateGitHubSources,
    selectedCreateIssuePreference,
    githubIssueSourceRows,
    githubIssueSourceLabel,
    repoPickerLabel,
    repoPickerSelectedRepo,
    workspaceRepoOptions,
    sortedItems,
    displayedEntries,
    sortLabel,
    githubProjectFields,
    githubProjectViewSort,
    githubProjectSortField,
    githubProjectSortDirection,
    githubProjectSortLabel,
    githubProjectFieldsLabel,
    githubProjectSortOptions,
    githubProjectViewOptions
  })
}

export type PickerProjectionModel = ReturnType<typeof useMobileTasksPickerProjection>
