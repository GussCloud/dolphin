import {
  type PickerOption,
  type TaskProvider,
  TaskProviderLogo,
  colors,
  getLinkedWorkItemSuggestedName,
  type GitHubProjectSettings
} from './mobile-tasks-dependencies'
import type { GitHubProjectSortDirection } from '../../../src/shared/github/project-types'
import type { ProjectGroup } from '../../../src/shared/github/project-group-sort'
import type {
  GitHubMode,
  GitHubPreset,
  GitHubProjectRow,
  GitLabFilter,
  GitLabView,
  LinearDisplayProperty,
  LinearFilter,
  LinearGroupBy,
  LinearOrderBy,
  LinearViewMode,
  TaskSort
} from './mobile-tasks-view-state-types'
import type { ActionableTaskItem } from './mobile-tasks-project-workspace-types'
import type { LinearIssue } from './mobile-tasks-provider-detail-types'
import type { TasksTranslate } from './tasks-translate'

export const providerOptions = (t: TasksTranslate): PickerOption<TaskProvider>[] => [
  {
    value: 'github',
    label: 'GitHub',
    subtitle: t('providerGitHubSubtitle'),
    renderIcon: (selected) => (
      <TaskProviderLogo
        provider="github"
        size={16}
        color={selected ? colors.textPrimary : colors.textSecondary}
      />
    )
  },
  {
    value: 'gitlab',
    label: 'GitLab',
    subtitle: t('providerGitLabSubtitle'),
    renderIcon: (selected) => (
      <TaskProviderLogo
        provider="gitlab"
        size={16}
        color={selected ? colors.textPrimary : colors.textSecondary}
      />
    )
  },
  {
    value: 'linear',
    label: 'Linear',
    subtitle: t('providerLinearSubtitle'),
    renderIcon: (selected) => (
      <TaskProviderLogo
        provider="linear"
        size={16}
        color={selected ? colors.textPrimary : colors.textSecondary}
      />
    )
  }
]

export const gitlabFilterOptions = (t: TasksTranslate): PickerOption<GitLabFilter>[] => [
  { value: 'opened', label: t('open'), subtitle: t('gitlabFilterOpenSubtitle') },
  { value: 'merged', label: t('merged'), subtitle: t('gitlabFilterMergedSubtitle') },
  { value: 'closed', label: t('closed'), subtitle: t('gitlabFilterClosedSubtitle') },
  { value: 'all', label: t('all'), subtitle: t('gitlabFilterAllSubtitle') }
]

export const linearFilterOptions = (t: TasksTranslate): PickerOption<LinearFilter>[] => [
  { value: 'all', label: t('all'), subtitle: t('linearFilterAllSubtitle') },
  {
    value: 'assigned',
    label: t('linearFilterAssigned'),
    subtitle: t('linearFilterAssignedSubtitle')
  },
  { value: 'created', label: t('linearFilterCreated'), subtitle: t('linearFilterCreatedSubtitle') },
  {
    value: 'completed',
    label: t('linearFilterCompleted'),
    subtitle: t('linearFilterCompletedSubtitle')
  }
]

export const linearViewOptions = (t: TasksTranslate): PickerOption<LinearViewMode>[] => [
  { value: 'list', label: t('linearViewList'), subtitle: t('linearViewListSubtitle') },
  { value: 'board', label: t('linearViewBoard'), subtitle: t('linearViewBoardSubtitle') }
]

export function taskWorkspaceFallback(item: ActionableTaskItem): string {
  if (item.provider === 'github' || item.provider === 'gitlab') {
    return `${item.source.type}-${item.source.number}`
  }
  return item.source.identifier.toLowerCase()
}

export function taskWorkspaceSuggestedName(item: ActionableTaskItem): string {
  return getLinkedWorkItemSuggestedName(item) || taskWorkspaceFallback(item)
}

/**
 * Keyed by a vocabulary no provider sends: GitHub's reactions arrive as `'+1'` / `'-1'` and
 * GitLab's carry no content at all, so every real reaction misses this map and the chip renders
 * without a glyph. Left as it is on purpose — the reply reader forwards `content` untouched, so
 * fixing the map is a visible change to what the sheet draws and belongs to its own PR.
 */
export const COMMENT_REACTION_EMOJI: Record<string, string> = {
  thumbs_up: '+1',
  thumbs_down: '-1',
  laugh: 'laugh',
  confused: 'confused',
  heart: 'heart',
  hooray: 'hooray',
  rocket: 'rocket',
  eyes: 'eyes'
}

export const linearGroupOptions = (t: TasksTranslate): PickerOption<LinearGroupBy>[] => [
  { value: 'none', label: t('linearGroupNone') },
  { value: 'status', label: t('status') },
  { value: 'assignee', label: t('assignee') },
  { value: 'priority', label: t('priority') },
  { value: 'team', label: t('team') }
]

export const linearOrderOptions = (t: TasksTranslate): PickerOption<LinearOrderBy>[] => [
  { value: 'priority', label: t('priority') },
  { value: 'updated', label: t('updated') },
  { value: 'identifier', label: t('linearOrderIdentifier') }
]

export const linearDisplayOptions = (t: TasksTranslate): PickerOption<LinearDisplayProperty>[] => [
  { value: 'state', label: t('status') },
  { value: 'priority', label: t('priority') },
  { value: 'assignee', label: t('assignee') },
  { value: 'team', label: t('team') },
  { value: 'labels', label: t('labels') },
  { value: 'updated', label: t('updated') }
]

export const DEFAULT_LINEAR_DISPLAY_PROPERTIES: LinearDisplayProperty[] = [
  'state',
  'priority',
  'assignee',
  'team',
  'labels',
  'updated'
]

export const githubKindOptions = (t: TasksTranslate): PickerOption<GitHubMode>[] => [
  { value: 'issues', label: t('githubKindIssues'), subtitle: t('githubKindIssuesSubtitle') },
  { value: 'prs', label: t('githubKindPrs'), subtitle: t('githubKindPrsSubtitle') },
  { value: 'project', label: t('githubKindProjects'), subtitle: t('githubKindProjectsSubtitle') }
]

export const issuePresets = (t: TasksTranslate): PickerOption<GitHubPreset>[] => [
  { value: 'issues', label: t('open'), subtitle: t('issuePresetOpenSubtitle') },
  {
    value: 'my-issues',
    label: t('issuePresetAssigned'),
    subtitle: t('issuePresetAssignedSubtitle')
  }
]

export const prPresets = (t: TasksTranslate): PickerOption<GitHubPreset>[] => [
  { value: 'prs', label: t('open'), subtitle: t('prPresetOpenSubtitle') },
  { value: 'my-prs', label: t('prPresetMine'), subtitle: t('prPresetMineSubtitle') },
  { value: 'review', label: t('prPresetReview'), subtitle: t('prPresetReviewSubtitle') }
]

export const gitlabViewOptions = (t: TasksTranslate): PickerOption<GitLabView>[] => [
  { value: 'project', label: t('gitlabViewProject'), subtitle: t('gitlabViewProjectSubtitle') },
  { value: 'todos', label: t('gitlabViewTodos'), subtitle: t('gitlabViewTodosSubtitle') }
]

export const sortOptions = (t: TasksTranslate): PickerOption<TaskSort>[] => [
  { value: 'updated', label: t('updated'), subtitle: t('sortUpdatedSubtitle') },
  { value: 'repository', label: t('repository'), subtitle: t('sortRepositorySubtitle') }
]

export type ProjectSortOverride = { fieldId: string; direction: GitHubProjectSortDirection }

export type ProjectListEntry =
  | { type: 'group'; group: ProjectGroup; collapsed: boolean }
  | { type: 'row'; row: GitHubProjectRow }

export type LinearIssueSection = {
  key: string
  label: string
  color: string
  issues: LinearIssue[]
}

export type LinearListEntry =
  | { type: 'section'; section: LinearIssueSection }
  | { type: 'issue'; issue: LinearIssue }

export const PROJECT_VIEW_DEFAULT_SORT = '__view_default__'

export const GITHUB_REPO_CONCURRENCY = 3

export const MAX_RENDERED_PR_DIFF_LINES = 400

export const GITLAB_PER_PAGE = 50

export const LINEAR_LIMIT = 50

// Why: task detail drawers can launch child sheets; children must layer above
// the still-mounted parent while its dismissal animation/state remains alive.
export const TASK_SECONDARY_DRAWER_Z_INDEX = 1100

// Why: the mobile detail drawer should support quick triage and core actions.
// Desktop keeps the broad metadata editing surface for dense issue/PR work.
export const SHOW_MOBILE_DETAIL_LABEL_CHIPS = false

export const SHOW_MOBILE_DETAIL_METADATA_EDITORS = false

export const SHOW_MOBILE_DETAIL_REVIEW_PANELS = false

export const SHOW_MOBILE_LINEAR_DETAIL_TOOLS = false

export const SHOW_MOBILE_COMMENT_THREAD_TOOLS = false

export const SHOW_MOBILE_PROJECT_METADATA_EDITORS = false

export const SHOW_MOBILE_PROJECT_REVIEW_PANELS = false

export const EMPTY_GITHUB_PROJECT_SETTINGS: GitHubProjectSettings = {
  pinned: [],
  recent: [],
  lastViewByProject: {},
  activeProject: null
}
