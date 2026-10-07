import type { GitHubProjectTable as SharedGitHubProjectTable } from '../../../src/shared/github/project-types'
import { isIterationCurrent } from '../../../src/shared/github/project-group-sort'
import type { ProjectGroup } from '../../../src/shared/github/project-group-sort'
import type { ProjectSortOverride } from './mobile-tasks-options'
import type {
  GitHubProjectField,
  GitHubProjectFieldMutationValue,
  GitHubProjectFieldValue,
  GitHubProjectRow,
  GitHubProjectTable
} from './mobile-tasks-view-state-types'
import { translateTasks as t } from './tasks-translate'

export function editableProjectFields(table: GitHubProjectTable | null): GitHubProjectField[] {
  return (
    table?.selectedView.fields?.filter((field) =>
      ['TEXT', 'NUMBER', 'DATE', 'SINGLE_SELECT', 'ITERATION'].includes(field.dataType)
    ) ?? []
  )
}

export function projectFieldValueLabel(row: GitHubProjectRow, field: GitHubProjectField): string {
  const value = row.fieldValuesByFieldId?.[field.id]
  if (!value) {
    return t('fieldEmpty')
  }
  if (value.kind === 'single-select') {
    return value.name
  }
  if (value.kind === 'iteration') {
    return value.title
  }
  if (value.kind === 'text') {
    return value.text || t('fieldEmpty')
  }
  if (value.kind === 'number') {
    return String(value.number)
  }
  if (value.kind === 'date') {
    return value.date
  }
  if (value.kind === 'labels') {
    return value.labels.map((label) => label.name).join(', ') || t('fieldEmpty')
  }
  if (value.kind === 'users') {
    return value.users.map((user) => user.login).join(', ') || t('fieldEmpty')
  }
  return t('fieldEmpty')
}

export function projectFieldDisplayLabel(row: GitHubProjectRow, field: GitHubProjectField): string {
  if (field.dataType === 'ASSIGNEES') {
    return row.content.assignees.map((user) => user.login).join(', ') || t('fieldEmpty')
  }
  if (field.dataType === 'LABELS') {
    return row.content.labels.map((label) => label.name).join(', ') || t('fieldEmpty')
  }
  if (field.dataType === 'REPOSITORY') {
    return row.content.repository ?? t('fieldEmpty')
  }
  if (field.dataType === 'PARENT_ISSUE') {
    return row.content.parentIssue ? `#${row.content.parentIssue.number}` : t('fieldEmpty')
  }
  if (field.dataType === 'ISSUE_TYPE') {
    return row.content.issueType?.name ?? t('fieldEmpty')
  }
  if (field.dataType === 'TITLE') {
    return row.content.title
  }
  return projectFieldValueLabel(row, field)
}

export function projectSummaryFields(table: GitHubProjectTable | null): GitHubProjectField[] {
  return (
    table?.selectedView.fields?.filter(
      (field) => field.dataType !== 'TITLE' && field.dataType !== 'REPOSITORY'
    ) ?? []
  )
}

export function projectFieldVisibilityKey(table: GitHubProjectTable | null): string | null {
  if (!table) {
    return null
  }
  // Why: desktop scopes column visibility to project + view; matching that
  // avoids hiding fields across unrelated Project views with colliding IDs.
  return `${table.project.id}:${table.selectedView.id}`
}

export function projectFieldDraftValue(row: GitHubProjectRow, field: GitHubProjectField): string {
  const value = row.fieldValuesByFieldId?.[field.id]
  if (!value) {
    return ''
  }
  if (value.kind === 'text') {
    return value.text
  }
  if (value.kind === 'number') {
    return String(value.number)
  }
  if (value.kind === 'date') {
    return value.date
  }
  return ''
}

export function normalizeProjectTableForMobileSort(
  table: GitHubProjectTable,
  rows: GitHubProjectRow[],
  sortOverride: ProjectSortOverride | null
): SharedGitHubProjectTable {
  const fields = table.selectedView.fields ?? []
  const overrideField = sortOverride
    ? fields.find((field) => field.id === sortOverride.fieldId)
    : undefined
  const normalizedRows = rows.map((row, index) => ({
    ...row,
    content: {
      ...row.content,
      stateReason: row.content.stateReason ?? null,
      parentIssue: row.content.parentIssue ?? null,
      issueType: row.content.issueType ?? null
    },
    fieldValuesByFieldId: row.fieldValuesByFieldId ?? {},
    position: row.position ?? index
  }))

  return {
    ...table,
    selectedView: {
      ...table.selectedView,
      fields,
      groupByFields: table.selectedView.groupByFields ?? [],
      sortByFields:
        sortOverride && overrideField
          ? [{ field: overrideField, direction: sortOverride.direction }]
          : (table.selectedView.sortByFields ?? [])
    },
    rows: normalizedRows,
    parentFieldDropped: table.parentFieldDropped === true
  } as unknown as SharedGitHubProjectTable
}

export function projectGroupMeta(group: ProjectGroup): string {
  const parts = [`${group.rows.length}`]
  if (group.iteration) {
    const endDate = new Date(`${group.iteration.startDate}T00:00:00Z`)
    if (!Number.isNaN(endDate.getTime())) {
      endDate.setUTCDate(endDate.getUTCDate() + group.iteration.duration - 1)
      parts.push(`${group.iteration.startDate} - ${endDate.toISOString().slice(0, 10)}`)
    }
    if (isIterationCurrent(group.iteration)) {
      parts.push(t('iterationCurrent'))
    }
  }
  return parts.join(' · ')
}

export function optimisticProjectFieldValue(
  field: GitHubProjectField,
  value: GitHubProjectFieldMutationValue
): GitHubProjectFieldValue {
  if (value.kind === 'single-select' && field.kind === 'single-select') {
    const option = field.options.find((entry) => entry.id === value.optionId)
    return {
      kind: 'single-select',
      fieldId: field.id,
      optionId: value.optionId,
      name: option?.name ?? t('fieldSelected'),
      color: option?.color ?? 'GRAY'
    }
  }
  if (value.kind === 'iteration' && field.kind === 'iteration') {
    const iteration = field.iterations.find((entry) => entry.id === value.iterationId)
    return {
      kind: 'iteration',
      fieldId: field.id,
      iterationId: value.iterationId,
      title: iteration?.title ?? t('fieldIteration'),
      startDate: iteration?.startDate ?? '',
      duration: iteration?.duration ?? 0
    }
  }
  if (value.kind === 'number') {
    return { kind: 'number', fieldId: field.id, number: value.number }
  }
  if (value.kind === 'date') {
    return { kind: 'date', fieldId: field.id, date: value.date }
  }
  return { kind: 'text', fieldId: field.id, text: value.kind === 'text' ? value.text : '' }
}
